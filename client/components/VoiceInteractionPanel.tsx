'use client'

/**
 * VoiceInteractionPanel.tsx
 *
 * Self-contained voice panel for the interview room.
 * Handles: record → upload → transcribe → evaluate → display result
 */

import { useState, useRef, useEffect, useCallback } from 'react'
import { Mic, MicOff, Upload, Loader2, CheckCircle2, AlertCircle, Volume2 } from 'lucide-react'
import { toast } from 'react-hot-toast'
import { uploadAudio, type EvaluationResult } from '@/lib/audioApi'

// ── Types ────────────────────────────────────────────────────────────────

type PanelState =
  | 'idle'
  | 'recording'
  | 'uploading'
  | 'transcribing'
  | 'evaluating'
  | 'done'
  | 'error'

interface VoiceInteractionPanelProps {
  sessionId:   string
  interviewId: string
  questionId:  string
  question:    string
  onComplete?: (result: {
    transcript:   string
    audioUrl:     string
    evaluation:   EvaluationResult
  }) => void
}

// ── State label map ───────────────────────────────────────────────────────

const STATE_LABELS: Record<PanelState, string> = {
  idle:         'Press mic to record your answer',
  recording:    'Recording... Press again to stop',
  uploading:    'Uploading audio...',
  transcribing: 'Transcribing speech...',
  evaluating:   'Evaluating your answer...',
  done:         'Analysis complete',
  error:        'Something went wrong — try again',
}

// ── Waveform canvas ───────────────────────────────────────────────────────

function WaveformCanvas({ analyser }: { analyser: AnalyserNode | null }) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const animRef   = useRef<number>(0)

  useEffect(() => {
    if (!analyser || !canvasRef.current) return

    const canvas  = canvasRef.current
    const ctx     = canvas.getContext('2d')!
    const bufLen  = analyser.frequencyBinCount
    const dataArr = new Uint8Array(bufLen)

    const draw = () => {
      animRef.current = requestAnimationFrame(draw)
      analyser.getByteTimeDomainData(dataArr)

      ctx.clearRect(0, 0, canvas.width, canvas.height)
      ctx.lineWidth   = 2
      ctx.strokeStyle = '#6366f1'
      ctx.beginPath()

      const sliceW = canvas.width / bufLen
      let x = 0

      for (let i = 0; i < bufLen; i++) {
        const v = dataArr[i] / 128.0
        const y = (v * canvas.height) / 2

        if (i === 0) ctx.moveTo(x, y)
        else         ctx.lineTo(x, y)
        x += sliceW
      }

      ctx.lineTo(canvas.width, canvas.height / 2)
      ctx.stroke()
    }

    draw()
    return () => cancelAnimationFrame(animRef.current)
  }, [analyser])

  return (
    <canvas
      ref={canvasRef}
      width={400}
      height={60}
      className="w-full rounded-lg bg-slate-800/50"
    />
  )
}

// ── Score badge ───────────────────────────────────────────────────────────

function ScoreBadge({ score }: { score: number }) {
  const color =
    score >= 8 ? 'bg-emerald-500' :
    score >= 5 ? 'bg-amber-500'   :
                 'bg-red-500'

  return (
    <div className={`${color} text-white text-xl font-bold w-14 h-14 rounded-full flex items-center justify-center shadow-lg shrink-0`}>
      {score.toFixed(1)}
    </div>
  )
}

// ── Main Component ────────────────────────────────────────────────────────

export default function VoiceInteractionPanel({
  sessionId,
  interviewId,
  questionId,
  question,
  onComplete,
}: VoiceInteractionPanelProps) {
  const [panelState, setPanelState] = useState<PanelState>('idle')
  const [transcript, setTranscript] = useState('')
  const [audioUrl,   setAudioUrl]   = useState('')
  const [evaluation, setEvaluation] = useState<EvaluationResult | null>(null)

  // Refs for recording
  const mediaRecorderRef = useRef<MediaRecorder | null>(null)
  const audioChunksRef   = useRef<Blob[]>([])
  const streamRef        = useRef<MediaStream | null>(null)
  const audioCtxRef      = useRef<AudioContext | null>(null)
  const analyserRef      = useRef<AnalyserNode | null>(null)
  const playbackRef      = useRef<HTMLAudioElement | null>(null)

  // ── Cleanup on unmount ─────────────────────────────────────────────────
  useEffect(() => {
    return () => {
      streamRef.current?.getTracks().forEach(t => t.stop())
      audioCtxRef.current?.close()
    }
  }, [])

  // ── Start recording ────────────────────────────────────────────────────
  const startRecording = useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true },
      })
      streamRef.current = stream

      // Set up analyser for waveform
      const audioCtx = new AudioContext()
      const source   = audioCtx.createMediaStreamSource(stream)
      const analyser = audioCtx.createAnalyser()
      analyser.fftSize = 256
      source.connect(analyser)
      audioCtxRef.current = audioCtx
      analyserRef.current = analyser

      // MediaRecorder
      const mimeType =
        MediaRecorder.isTypeSupported('audio/webm;codecs=opus')
          ? 'audio/webm;codecs=opus'
          : 'audio/webm'

      const recorder = new MediaRecorder(stream, { mimeType })
      mediaRecorderRef.current = recorder
      audioChunksRef.current   = []

      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) audioChunksRef.current.push(e.data)
      }

      recorder.onstop = handleRecordingStopped
      recorder.start(500)

      setPanelState('recording')

    } catch {
      toast.error('Microphone access denied or unavailable.')
      setPanelState('error')
    }
  }, [])

  // ── Stop recording ─────────────────────────────────────────────────────
  const stopRecording = useCallback(() => {
    mediaRecorderRef.current?.stop()
    streamRef.current?.getTracks().forEach(t => t.stop())
    audioCtxRef.current?.close()
    analyserRef.current = null
  }, [])

  // ── Handle recording stopped → run pipeline ───────────────────────────
  const handleRecordingStopped = useCallback(async () => {
    const chunks = audioChunksRef.current
    if (!chunks.length) {
      setPanelState('idle')
      toast.error('No audio captured. Please try again.')
      return
    }

    const blob = new Blob(chunks, { type: 'audio/webm' })

    try {
      // Upload
      setPanelState('uploading')
      toast.loading('Uploading audio...', { id: 'upload' })

      const result = await uploadAudio(blob, {
        question,
        sessionId,
        interviewId,
        questionId,
      })

      toast.dismiss('upload')
      toast.success('Audio uploaded!')

      // Update state with results
      setTranscript(result.transcript || '')
      setAudioUrl(result.audioUrl   || '')

      const eval_: EvaluationResult = {
        score:        result.score,
        strengths:    result.strengths,
        weaknesses:   result.weaknesses,
        improvements: result.improvements,
      }
      setEvaluation(eval_)
      setPanelState('done')

      onComplete?.({
        transcript:   result.transcript,
        audioUrl:     result.audioUrl,
        evaluation:   eval_,
      })

    } catch (error: any) {
      toast.dismiss('upload')
      toast.error(error?.response?.data?.error || 'Upload failed. Please try again.')
      setPanelState('error')
    }
  }, [question, sessionId, interviewId, questionId, onComplete])

  // ── Mic toggle ─────────────────────────────────────────────────────────
  const handleMicToggle = () => {
    if (panelState === 'recording') {
      stopRecording()
    } else if (panelState === 'idle' || panelState === 'error') {
      setEvaluation(null)
      setTranscript('')
      startRecording()
    }
  }

  // ── Retry ──────────────────────────────────────────────────────────────
  const handleRetry = () => {
    setEvaluation(null)
    setTranscript('')
    setAudioUrl('')
    setPanelState('idle')
  }

  // ── Play back recorded audio (if URL available) ───────────────────────
  const handlePlayback = () => {
    if (!audioUrl) return
    if (playbackRef.current) {
      playbackRef.current.pause()
    }
    const el = new Audio(audioUrl)
    playbackRef.current = el
    el.play()
  }

  // ── UI ─────────────────────────────────────────────────────────────────

  const isProcessing = ['uploading', 'transcribing', 'evaluating'].includes(panelState)
  const isRecording  = panelState === 'recording'
  const isDone       = panelState === 'done'

  return (
    <div className="rounded-2xl border border-slate-700 bg-slate-900 p-5 space-y-4 shadow-xl">

      {/* ── State label ── */}
      <div className="flex items-center gap-2 text-sm text-slate-400">
        {isProcessing && <Loader2 className="h-4 w-4 animate-spin text-indigo-400" />}
        {isDone        && <CheckCircle2 className="h-4 w-4 text-emerald-400" />}
        {panelState === 'error' && <AlertCircle className="h-4 w-4 text-red-400" />}
        <span>{STATE_LABELS[panelState]}</span>
      </div>

      {/* ── Waveform (only while recording) ── */}
      {isRecording && <WaveformCanvas analyser={analyserRef.current} />}

      {/* ── Mic button + playback ── */}
      <div className="flex items-center justify-center gap-4">
        <button
          onClick={handleMicToggle}
          disabled={isProcessing}
          className={`
            relative flex h-16 w-16 items-center justify-center rounded-full shadow-lg
            transition-all duration-200 focus:outline-none focus:ring-4
            ${isRecording
              ? 'bg-red-500 hover:bg-red-600 focus:ring-red-500/30'
              : isProcessing
                ? 'cursor-not-allowed bg-slate-700 opacity-60'
                : 'bg-indigo-600 hover:bg-indigo-700 focus:ring-indigo-500/30'
            }
          `}
          aria-label={isRecording ? 'Stop recording' : 'Start recording'}
        >
          {/* Pulse ring when recording */}
          {isRecording && (
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-red-400 opacity-40" />
          )}
          {isProcessing
            ? <Loader2 className="h-7 w-7 animate-spin text-white" />
            : isRecording
              ? <MicOff className="h-7 w-7 text-white" />
              : <Mic className="h-7 w-7 text-white" />
          }
        </button>

        {/* Playback button — shown when audio URL available */}
        {audioUrl && (
          <button
            onClick={handlePlayback}
            className="flex h-10 w-10 items-center justify-center rounded-full bg-slate-700 hover:bg-slate-600 text-slate-300 transition-colors"
            aria-label="Play back your recording"
          >
            <Volume2 className="h-5 w-5" />
          </button>
        )}
      </div>

      {/* ── Transcript preview ── */}
      {transcript && (
        <div className="rounded-xl bg-slate-800 p-4 text-sm leading-relaxed text-slate-200 border border-slate-700">
          <div className="mb-1 text-xs font-semibold uppercase tracking-wider text-indigo-400">
            Transcript
          </div>
          {transcript}
        </div>
      )}

      {/* ── Evaluation result ── */}
      {evaluation && isDone && (
        <div className="space-y-3 animate-in fade-in slide-in-from-bottom-2 duration-300">
          {/* Score + summary row */}
          <div className="flex items-start gap-4 rounded-xl bg-slate-800 p-4 border border-slate-700">
            <ScoreBadge score={evaluation.score} />
            <div className="space-y-1 min-w-0">
              <div className="text-xs font-semibold uppercase tracking-wider text-slate-400">Your Score</div>
              <div className="text-slate-200 text-sm font-medium">
                {evaluation.score >= 8
                  ? '🌟 Excellent answer!'
                  : evaluation.score >= 6
                    ? '👍 Good response — a little more detail would help.'
                    : '📚 Keep practising — see the tips below.'}
              </div>
            </div>
          </div>

          {/* Strengths */}
          {evaluation.strengths?.length > 0 && (
            <div className="rounded-xl bg-emerald-950/40 border border-emerald-800/40 p-4">
              <div className="mb-2 text-xs font-semibold uppercase tracking-wider text-emerald-400">
                ✅ Strengths
              </div>
              <ul className="space-y-1">
                {evaluation.strengths.map((s, i) => (
                  <li key={i} className="text-sm text-emerald-200">{s}</li>
                ))}
              </ul>
            </div>
          )}

          {/* Weaknesses */}
          {evaluation.weaknesses?.length > 0 && (
            <div className="rounded-xl bg-amber-950/40 border border-amber-800/40 p-4">
              <div className="mb-2 text-xs font-semibold uppercase tracking-wider text-amber-400">
                ⚠️ Areas to Improve
              </div>
              <ul className="space-y-1">
                {evaluation.weaknesses.map((w, i) => (
                  <li key={i} className="text-sm text-amber-200">{w}</li>
                ))}
              </ul>
            </div>
          )}

          {/* Improvements */}
          {evaluation.improvements?.length > 0 && (
            <div className="rounded-xl bg-blue-950/40 border border-blue-800/40 p-4">
              <div className="mb-2 text-xs font-semibold uppercase tracking-wider text-blue-400">
                💡 Tips
              </div>
              <ul className="space-y-1">
                {evaluation.improvements.map((imp, i) => (
                  <li key={i} className="text-sm text-blue-200">{imp}</li>
                ))}
              </ul>
            </div>
          )}

          {/* Retry button */}
          <button
            onClick={handleRetry}
            className="w-full rounded-xl bg-slate-800 hover:bg-slate-700 border border-slate-700 px-4 py-2 text-sm text-slate-300 transition-colors"
          >
            🔄 Record again
          </button>
        </div>
      )}
    </div>
  )
}
