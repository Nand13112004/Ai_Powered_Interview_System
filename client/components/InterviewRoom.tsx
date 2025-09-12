'use client'

import { useState, useEffect, useRef } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Progress } from '@/components/ui/progress'
import { Badge } from '@/components/ui/badge'
import { 
  Mic, 
  MicOff, 
  Volume2, 
  VolumeX, 
  Square, 
  Play, 
  Pause,
  MessageSquare,
  Clock,
  CheckCircle,
  AlertCircle,
  Brain
} from 'lucide-react'
import { toast } from 'react-hot-toast'
import { socketService } from '@/lib/socket'
import { api } from '@/lib/api'

interface Question {
  id: string
  text: string
  number: number
}

interface Interview {
  id: string
  title: string
  description: string
  role: string
  level: string
  duration: number
  questions: Question[]
}

interface InterviewRoomProps {
  interview: Interview
  onComplete: () => void
}

interface Message {
  type: 'candidate' | 'interviewer'
  text: string
  timestamp: Date
}

export default function InterviewRoom({ interview, onComplete }: InterviewRoomProps) {
  const [isConnected, setIsConnected] = useState(false)
  const [isRecording, setIsRecording] = useState(false)
  const [isPlaying, setIsPlaying] = useState(false)
  const [messages, setMessages] = useState<Message[]>([])
  const [typedResponse, setTypedResponse] = useState('')
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0)
  const [answeredByQuestionId, setAnsweredByQuestionId] = useState<Record<string, boolean>>({})
  // Removed duplicate declaration of currentQuestion state
  const [sessionId, setSessionId] = useState<string | null>(null)
  const [elapsedTime, setElapsedTime] = useState(0)
  const [isCompleted, setIsCompleted] = useState(false)
  const [incidentCount, setIncidentCount] = useState(0)
  const INCIDENT_THRESHOLD = 5
  const cameraStreamRef = useRef<MediaStream | null>(null)
  const audioContextRef = useRef<AudioContext | null>(null)
  const analyserRef = useRef<AnalyserNode | null>(null)
  const faceCountRef = useRef<number>(0)
  
  const mediaRecorderRef = useRef<MediaRecorder | null>(null)
  const audioChunksRef = useRef<Blob[]>([])
  const streamRef = useRef<MediaStream | null>(null)
  const audioRef = useRef<HTMLAudioElement | null>(null)
  const intervalRef = useRef<NodeJS.Timeout | null>(null)
  const pendingJoinSessionIdRef = useRef<string | null>(null)

  // Strict mode configuration
  const STRICT_MODE = true
  const fatalIncidents = new Set([
    'multiple_faces_detected',
    'speech_with_multiple_faces',
    'devtools_suspected'
  ])

  const emitWhenConnected = (event: string, payload: any, attempt: number = 0) => {
    if (socketService.isConnected()) {
      socketService.emit(event, payload)
      console.log(`✅ Emitted ${event} event successfully`)
      return
    }
    if (attempt > 20) {
      toast.error('Connection issue. Please refresh and try again.')
      console.error(`❌ Failed to emit ${event} after 20 attempts`)
      return
    }
    console.log(`⏳ Attempting to emit ${event} (attempt ${attempt + 1})...`)
    setTimeout(() => emitWhenConnected(event, payload, attempt + 1), 200)
  }

  useEffect(() => {
    if (interview.questions && interview.questions.length > 0) {
      setCurrentQuestionIndex(0)
    }
  }, [interview.questions])

  useEffect(() => {
    const ensurePermissions = async () => {
      try {
        // Request mic + cam up-front to simulate real proctored environment
        const cam = navigator.mediaDevices.getUserMedia({ video: true })
        const mic = navigator.mediaDevices.getUserMedia({ audio: true })
        await Promise.allSettled([cam, mic])
      } catch (_) {
        toast.error('Camera/Microphone permission required for proctored interview')
      }
    }

    const enterFullscreen = async () => {
      try {
        if (STRICT_MODE && document.documentElement.requestFullscreen) {
          await document.documentElement.requestFullscreen()
        }
      } catch (_) {}
    }

    const boot = async () => {
      await ensurePermissions()
      await enterFullscreen()
      initializeSocket()
      startSession()
      startTimer()
    }

    boot()

    // Handle browser close/refresh
    const handleBeforeUnload = () => {
      if (sessionId && !isCompleted) {
        // Mark interview as completed when user leaves
        emitWhenConnected('complete_interview', {
          sessionId,
          finalTranscript: messages,
          reason: 'user_left'
        })
      }
    }

    window.addEventListener('beforeunload', handleBeforeUnload)

    // Strict mode: fullscreen exit listener
    const onFullscreenChange = () => {
      const inFs = !!document.fullscreenElement
      if (!inFs && STRICT_MODE) {
        reportIncident('fullscreen_exit')
        toast.error('Fullscreen is required. Ending interview.')
        completeInterview()
      }
    }
    document.addEventListener('fullscreenchange', onFullscreenChange)

    return () => {
      cleanup()
      window.removeEventListener('beforeunload', handleBeforeUnload)
      document.removeEventListener('fullscreenchange', onFullscreenChange)
    }
  }, [])

  // Proctoring: report helper
  const reportIncident = (type: string, meta: Record<string, any> = {}) => {
    try {
      setIncidentCount((c) => c + 1)
      if (sessionId) {
        emitWhenConnected('proctor_event', {
          sessionId,
          type,
          meta,
          at: new Date().toISOString()
        })
      }
      // If too many incidents, auto-complete
      setTimeout(() => {
        if (STRICT_MODE && fatalIncidents.has(type)) {
          toast.error('Strict violation detected. Ending interview.')
          emitWhenConnected('proctor_threshold_breach', {
            sessionId,
            incidents: incidentCount + 1,
            reason: type
          })
          completeInterview()
          return
        }
        if (!isCompleted && (incidentCount + 1 >= INCIDENT_THRESHOLD)) {
          toast.error('Too many proctoring incidents. Ending interview.')
          emitWhenConnected('proctor_threshold_breach', {
            sessionId,
            incidents: incidentCount + 1
          })
          completeInterview()
        }
      }, 0)
    } catch (err) {
      console.warn('Failed to report proctor incident', err)
    }
  }

  // Proctoring: listeners (tab switch, copy/paste, context menu, devtools)
  useEffect(() => {
    const onVisibility = () => {
      if (document.hidden) {
        reportIncident('tab_hidden')
        if (STRICT_MODE) {
          toast.error('Tab switch detected. Ending interview.')
          completeInterview()
        }
      }
    }
    const onBlur = () => {
      reportIncident('window_blur')
      if (STRICT_MODE) {
        toast.error('Window focus lost. Ending interview.')
        completeInterview()
      }
    }
    const onCopy = (e: ClipboardEvent) => reportIncident('copy', { length: (e as any).clipboardData?.getData('text')?.length })
    const onPaste = (e: ClipboardEvent) => reportIncident('paste', { length: (e as any).clipboardData?.getData('text')?.length })
    const onContext = (e: MouseEvent) => reportIncident('contextmenu')
    const onKey = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && (e.key === 'c' || e.key === 'v' || e.key === 'x')) {
        reportIncident('shortcut', { key: e.key })
      }
    }
    // Devtools heuristic: large devtools gap
    const checkDevtools = () => {
      const gap = Math.abs((window.outerWidth - window.innerWidth)) + Math.abs((window.outerHeight - window.innerHeight))
      if (gap > 200) {
        reportIncident('devtools_suspected', { gap })
      }
    }
    const devtoolsInterval = window.setInterval(checkDevtools, 5000)

    document.addEventListener('visibilitychange', onVisibility)
    window.addEventListener('blur', onBlur)
    window.addEventListener('copy', onCopy as any)
    window.addEventListener('paste', onPaste as any)
    window.addEventListener('contextmenu', onContext)
    window.addEventListener('keydown', onKey)

    return () => {
      document.removeEventListener('visibilitychange', onVisibility)
      window.removeEventListener('blur', onBlur)
      window.removeEventListener('copy', onCopy as any)
      window.removeEventListener('paste', onPaste as any)
      window.removeEventListener('contextmenu', onContext)
      window.removeEventListener('keydown', onKey)
      window.clearInterval(devtoolsInterval)
    }
  }, [sessionId])

  // Webcam-based face presence (best-effort)
  useEffect(() => {
    let visionInterval: number | null = null
    const startVision = async () => {
      try {
        // Try using FaceDetector API if available
        const FaceDetectorCtor: any = (window as any).FaceDetector
        // Ensure camera stream
        if (!cameraStreamRef.current) {
          cameraStreamRef.current = await navigator.mediaDevices.getUserMedia({ video: true, audio: false })
        }
        const video = document.createElement('video')
        video.srcObject = cameraStreamRef.current as any
        video.muted = true
        await video.play()

        if (FaceDetectorCtor) {
          const detector = new FaceDetectorCtor({ fastMode: true, maxDetectedFaces: 3 })
          const tick = async () => {
            try {
              const faces = await detector.detect(video)
              const count = Array.isArray(faces) ? faces.length : 0
              faceCountRef.current = count
              if (count === 0) {
                reportIncident('no_face_detected')
              } else if (count > 1) {
                reportIncident('multiple_faces_detected', { count })
              }
            } catch (e) {
              // ignore detection errors
            }
          }
          visionInterval = window.setInterval(tick, 4000)
          return
        }

        // Fallback: TensorFlow.js BlazeFace via CDN
        const loadScript = (src: string) => new Promise<void>((resolve, reject) => {
          const existing = document.querySelector(`script[src="${src}"]`) as HTMLScriptElement | null
          if (existing) {
            if ((existing as any)._loaded) return resolve()
            existing.addEventListener('load', () => resolve())
            existing.addEventListener('error', () => reject(new Error('script load error')))
            return
          }
          const s = document.createElement('script')
          s.src = src
          s.async = true
          ;(s as any)._loaded = false
          s.onload = () => { (s as any)._loaded = true; resolve() }
          s.onerror = () => reject(new Error('script load error'))
          document.head.appendChild(s)
        })

        try {
          await loadScript('https://cdn.jsdelivr.net/npm/@tensorflow/tfjs@4.10.0/dist/tf.min.js')
          await loadScript('https://cdn.jsdelivr.net/npm/@tensorflow-models/blazeface@0.1.0/dist/blazeface.min.js')
          // @ts-ignore
          const model = await (window as any).blazeface.load()
          const tick = async () => {
            try {
              // @ts-ignore
              const preds = await model.estimateFaces(video, false)
              const count = Array.isArray(preds) ? preds.length : 0
              faceCountRef.current = count
              if (count === 0) {
                reportIncident('no_face_detected')
              } else if (count > 1) {
                reportIncident('multiple_faces_detected', { count })
              }
            } catch (e) {
              // ignore detection errors
            }
          }
          visionInterval = window.setInterval(tick, 5000)
        } catch (e) {
          // Fallback load failed; silently ignore
        }
      } catch (err) {
        // Camera permission denied or unsupported; ignore silently
      }
    }

    startVision()

    return () => {
      if (visionInterval) window.clearInterval(visionInterval)
      if (cameraStreamRef.current) {
        cameraStreamRef.current.getTracks().forEach(t => t.stop())
        cameraStreamRef.current = null
      }
    }
  }, [sessionId])

  // Audio analysis: detect speech when no face or multiple faces
  useEffect(() => {
    let audioInterval: number | null = null
    const startAudioAnalysis = async () => {
      try {
        // Reuse existing audio stream if available
        if (!streamRef.current) {
          // If not yet captured, try to get mic access (best-effort)
          try {
            streamRef.current = await navigator.mediaDevices.getUserMedia({ audio: true, video: false })
          } catch (_) {
            return
          }
        }
        const context = new (window.AudioContext || (window as any).webkitAudioContext)()
        audioContextRef.current = context
        const source = context.createMediaStreamSource(streamRef.current)
        const analyser = context.createAnalyser()
        analyser.fftSize = 1024
        analyserRef.current = analyser
        source.connect(analyser)
        const data = new Uint8Array(analyser.frequencyBinCount)

        const check = () => {
          if (!analyserRef.current) return
          analyserRef.current.getByteTimeDomainData(data)
          // Compute RMS
          let sum = 0
          for (let i = 0; i < data.length; i++) {
            const v = (data[i] - 128) / 128
            sum += v * v
          }
          const rms = Math.sqrt(sum / data.length)
          const speaking = rms > 0.06 // heuristic threshold
          if (speaking) {
            const faces = faceCountRef.current
            if (faces === 0) {
              reportIncident('speech_without_face')
            } else if (faces > 1) {
              reportIncident('speech_with_multiple_faces', { faces })
            }
          }
        }

        audioInterval = window.setInterval(check, 2000)
      } catch (err) {
        // ignore
      }
    }

    startAudioAnalysis()

    return () => {
      if (audioInterval) window.clearInterval(audioInterval)
      if (audioContextRef.current) {
        try { audioContextRef.current.close() } catch (_) {}
        audioContextRef.current = null
      }
    }
  }, [sessionId])

  useEffect(() => {
    if (interview.questions && interview.questions.length > 0) {
      // Add current question as interviewer message when currentQuestionIndex changes
      const currentQ = interview.questions[currentQuestionIndex]?.text
      setMessages(prevMessages => {
        // Check if current question already exists in messages
          const exists = prevMessages.some(
            (msg): msg is Message => (msg.type === 'interviewer' || msg.type === 'candidate') && msg.text === currentQ
          )
          if (!exists) {
            const newMessages: Message[] = [...prevMessages, { type: 'interviewer', text: currentQ || '', timestamp: new Date() }]
            // Scroll to bottom after adding new message
            setTimeout(() => {
              const container = document.querySelector('.space-y-4.max-h-96.overflow-y-auto')
              if (container) {
                container.scrollTop = container.scrollHeight
              }
            }, 100)
            return newMessages
          }
          return prevMessages
        })
    }
  }, [currentQuestionIndex, interview.questions])

  const goToNextQuestion = () => {
    if (!interview.questions || interview.questions.length === 0) return

    const currentQ = interview.questions[currentQuestionIndex]
    if (typedResponse.trim()) {
      // Auto-submit typed response before moving on
      sendTextMessage(typedResponse.trim())
      setTypedResponse('')
    }

    // Move to next if exists
    if (currentQuestionIndex < interview.questions.length - 1) {
      setCurrentQuestionIndex(currentQuestionIndex + 1)
    } else {
      // Last question → complete interview
      toast.success('All questions answered. Completing interview...')
      completeInterview()
    }
  }

  const initializeSocket = () => {
    try {
      socketService.connect()
      setIsConnected(true)

      socketService.on('interview_joined', (data: { sessionId: string }) => {
        setSessionId(data.sessionId)
        setCurrentQuestionIndex(0)
        const firstQuestion = interview.questions && interview.questions.length > 0 ? interview.questions[0].text : null
        setMessages([{
          type: 'interviewer',
          text: firstQuestion || 'Welcome! Let\'s begin the interview. Please introduce yourself.',
          timestamp: new Date()
        }])
        // Scroll to bottom after setting messages
        setTimeout(() => {
          const container = document.querySelector('.space-y-4.max-h-96.overflow-y-auto')
          if (container) {
            container.scrollTop = container.scrollHeight
          }
        }, 100)
      })

      // If connect occurs after we requested a join, send it now
      ;(socketService as any).socket?.on?.('connect', () => {
        if (pendingJoinSessionIdRef.current) {
          socketService.emit('join_interview', { sessionId: pendingJoinSessionIdRef.current })
          pendingJoinSessionIdRef.current = null
        }
      })

      socketService.on('ai_response', (data: { text: string }) => {
        setCurrentQuestionIndex(prev => {
          // Optionally update question index if AI response is a new question
          // For now, just keep current index
          return prev
        })
        setMessages(prev => [...prev, {
          type: 'interviewer',
          text: data.text,
          timestamp: new Date()
        }])
      })

      socketService.on('ai_audio', (data: { audioData: string }) => {
        playAudio(data.audioData)
      })

      socketService.on('interview_completed', (data: any) => {
        console.log('✅ Interview completed event received:', data)
        setIsCompleted(true)
        toast.success('Interview completed successfully!')
        
        // Redirect immediately when server confirms completion
        setTimeout(() => {
          toast.success('Redirecting to dashboard...')
          window.location.href = '/dashboard'
        }, 1000)
      })

      socketService.on('error', (error: { message: string }) => {
        toast.error(error.message)
      })

    } catch (error) {
      console.error('Socket connection failed:', error)
      toast.error('Failed to connect to interview room')
    }
  }

  const startSession = async () => {
    try {
      const response = await api.post('/sessions', {
        interviewId: interview.id
      })
      
      const sessionId = response.data.session.id
      if (socketService.isConnected()) {
        socketService.emit('join_interview', { sessionId })
      } else {
        pendingJoinSessionIdRef.current = sessionId
        emitWhenConnected('join_interview', { sessionId })
      }
    } catch (error: any) {
      // Handle 409 Conflict - interview already attempted
      if (error.response?.status === 409 && error.response?.data?.sessionId) {
        const existingSession = error.response.data.existingSession
        console.log('🚫 Interview already attempted:', existingSession)
        
        if (existingSession.status === 'completed') {
          toast.error('You have already completed this interview. Each candidate can only participate once.')
          // Redirect to dashboard after showing error
          setTimeout(() => {
            window.location.href = '/dashboard'
          }, 3000)
        } else {
          toast.success('Resuming existing interview session')
          const existingSessionId = error.response.data.sessionId
          if (socketService.isConnected()) {
            socketService.emit('join_interview', { sessionId: existingSessionId })
          } else {
            pendingJoinSessionIdRef.current = existingSessionId
            emitWhenConnected('join_interview', { sessionId: existingSessionId })
          }
        }
      } else {
        console.error('Session creation failed:', error.response?.data)
        toast.error(error.response?.data?.error || 'Failed to start session')
      }
    }
  }

  const startTimer = () => {
    intervalRef.current = setInterval(() => {
      setElapsedTime(prev => prev + 1)
    }, 1000)
  }

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      streamRef.current = stream
      
      const mediaRecorder = new MediaRecorder(stream)
      mediaRecorderRef.current = mediaRecorder
      audioChunksRef.current = []

      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          audioChunksRef.current.push(event.data)
        }
      }

      mediaRecorder.onstop = () => {
        const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/webm' })
        sendAudioData(audioBlob)
      }

      mediaRecorder.start()
      setIsRecording(true)
      toast.success('Recording started')
    } catch (error) {
      console.error('Error starting recording:', error)
      toast.error('Failed to start recording. Please check microphone permissions.')
    }
  }

  const stopRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop()
      setIsRecording(false)
      toast.success('Recording stopped')
    }
  }

  const sendAudioData = (audioBlob: Blob) => {
    if (!sessionId) return

    const reader = new FileReader()
    reader.onload = () => {
      const base64Audio = reader.result?.toString().split(',')[1]
      if (base64Audio) {
        socketService.emit('audio_data', {
          sessionId,
          audioBlob: base64Audio,
          timestamp: new Date().toISOString(),
          questionId: interview.questions[currentQuestionIndex]?.id
        })

        const qId = interview.questions[currentQuestionIndex]?.id
        if (qId) {
          setAnsweredByQuestionId(prev => ({ ...prev, [qId]: true }))
        }
      }
    }
    reader.readAsDataURL(audioBlob)
  }

  const sendTextMessage = (text: string) => {
    if (!sessionId || !text.trim()) return

    setMessages(prev => [...prev, {
      type: 'candidate',
      text: text.trim(),
      timestamp: new Date()
    }])

    socketService.emit('text_message', {
      sessionId,
      message: text.trim(),
      timestamp: new Date().toISOString(),
      questionId: interview.questions[currentQuestionIndex]?.id
    })

    const qId = interview.questions[currentQuestionIndex]?.id
    if (qId) {
      setAnsweredByQuestionId(prev => ({ ...prev, [qId]: true }))
    }
  }

  const playAudio = (audioData: string) => {
    try {
      const audioBlob = new Blob([Uint8Array.from(atob(audioData), c => c.charCodeAt(0))], { type: 'audio/mpeg' })
      const audioUrl = URL.createObjectURL(audioBlob)
      
      if (audioRef.current) {
        audioRef.current.src = audioUrl
        audioRef.current.play()
        setIsPlaying(true)
        
        audioRef.current.onended = () => {
          setIsPlaying(false)
          URL.revokeObjectURL(audioUrl)
        }
      }
    } catch (error) {
      console.error('Error playing audio:', error)
    }
  }

  const completeInterview = () => {
    if (!sessionId) {
      toast.error('No session found. Please refresh and try again.')
      return
    }

    // Show loading state
    setIsCompleted(true)
    toast.success('Completing interview...')

    // If there is unsent typed text, send it before completing
    if (typedResponse.trim()) {
      sendTextMessage(typedResponse.trim())
      setTypedResponse('')
    }

    // Emit complete interview event
    emitWhenConnected('complete_interview', {
      sessionId,
      finalTranscript: messages
    })

    // Always redirect to dashboard after a reasonable delay
    // This ensures the button always works, even if socket fails
    setTimeout(() => {
      toast.success('Interview completed! Redirecting to dashboard...')
      window.location.href = '/dashboard'
    }, 1000)

    // Fallback: If socket is not connected after 3 seconds, still redirect
    setTimeout(() => {
      if (!socketService.isConnected()) {
        console.warn('⚠️ Socket not connected, but proceeding with completion')
        toast.success('Completing interview offline...')
      }
    }, 3000)
  }

  const cleanup = () => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current)
    }
    
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop())
    }
    
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop()
    }
    
    socketService.disconnect()
  }

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60)
    const secs = seconds % 60
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`
  }

  const progress = (elapsedTime / (interview.duration * 60)) * 100

  const currentQuestion = interview.questions ? interview.questions[currentQuestionIndex]?.text || '' : ''
  const currentQuestionId = interview.questions ? interview.questions[currentQuestionIndex]?.id : undefined
  const isCurrentAnswered = currentQuestionId ? !!answeredByQuestionId[currentQuestionId] : false

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-100">
      {/* Header */}
      <div className="bg-white/80 backdrop-blur-sm border-b border-gray-200/50 sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-4 py-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-4">
              <div className="w-12 h-12 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-xl flex items-center justify-center shadow-lg">
                <Brain className="h-6 w-6 text-white" />
              </div>
              <div>
                <h1 className="text-2xl font-bold text-gray-900">{interview.title}</h1>
                <p className="text-gray-600 mt-1">{interview.role} • {interview.level}</p>
              </div>
            </div>
            <div className="flex items-center space-x-6">
              <div className="text-center">
                <div className="text-sm text-gray-500 font-medium">Duration</div>
                <div className="text-xl font-bold text-gray-900">{interview.duration} min</div>
              </div>
              <div className="text-center">
                <div className="text-sm text-gray-500 font-medium">Progress</div>
                <div className="text-xl font-bold text-gray-900">{currentQuestionIndex + 1}/{interview.questions?.length || 0}</div>
              </div>
              <div className="text-center">
                <div className="text-sm text-gray-500 font-medium">Incidents</div>
                <div className={`text-xl font-bold ${incidentCount > 0 ? 'text-red-600' : 'text-gray-900'}`}>{incidentCount}</div>
              </div>
              <Badge 
                variant={isConnected ? 'default' : 'destructive'}
                className={`px-3 py-1 ${isConnected ? 'bg-green-100 text-green-800 border-green-200' : 'bg-red-100 text-red-800 border-red-200'}`}
              >
                <div className={`w-2 h-2 rounded-full mr-2 ${isConnected ? 'bg-green-500' : 'bg-red-500'}`}></div>
                {isConnected ? 'Connected' : 'Disconnected'}
              </Badge>
            </div>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="max-w-7xl mx-auto px-4 py-8">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Left Column - Question and Chat */}
          <div className="lg:col-span-2 space-y-6">
            {/* Current Question Card */}
            <div className="bg-white rounded-2xl shadow-lg border border-gray-200/50 p-8">
              <div className="flex items-start justify-between mb-6">
                <div className="flex items-center space-x-3">
                  <div className="w-10 h-10 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-full flex items-center justify-center">
                    <span className="text-white font-bold text-lg">{currentQuestionIndex + 1}</span>
                  </div>
                  <div>
                    <h3 className="text-lg font-semibold text-gray-900">Question {currentQuestionIndex + 1}</h3>
                    <p className="text-sm text-gray-500">of {interview.questions?.length || 0}</p>
                  </div>
                </div>
                <Button
                  onClick={goToNextQuestion}
                  disabled={!interview.questions ? true : (!isCurrentAnswered && !typedResponse.trim())}
                  className="bg-gradient-to-r from-blue-500 to-indigo-600 hover:from-blue-600 hover:to-indigo-700 text-white shadow-lg hover:shadow-xl transition-all duration-200"
                >
                  {currentQuestionIndex < (interview.questions?.length || 0) - 1 ? 'Next Question' : 'Finish Interview'}
                </Button>
              </div>
              <div className="prose prose-lg max-w-none">
                <p className="text-gray-800 leading-relaxed">
                  {currentQuestion || 'Waiting for questions...'}
                </p>
              </div>
            </div>

            {/* Messages Area */}
            <div className="bg-white rounded-2xl shadow-lg border border-gray-200/50 p-6">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">Conversation</h3>
              <div className="space-y-4 max-h-96 overflow-y-auto">
                {messages.map((message, index) => (
                  <div
                    key={index}
                    className={`flex ${message.type === 'candidate' ? 'justify-end' : 'justify-start'}`}
                  >
                    <div
                      className={`max-w-xs lg:max-w-md px-4 py-3 rounded-2xl ${
                        message.type === 'candidate'
                          ? 'bg-gradient-to-r from-blue-500 to-indigo-600 text-white'
                          : 'bg-gray-100 text-gray-800'
                      }`}
                    >
                      <p className="text-sm">{message.text}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Right Column - Controls */}
          <div className="space-y-6">
            {/* Audio Controls */}
            <div className="bg-white rounded-2xl shadow-lg border border-gray-200/50 p-6">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">Audio Controls</h3>
              
              {/* Recording Status */}
              <div className="mb-6">
                {isRecording ? (
                  <div className="flex items-center justify-center space-x-3 p-4 bg-red-50 rounded-xl border border-red-200">
                    <div className="w-4 h-4 bg-red-500 rounded-full animate-pulse"></div>
                    <span className="text-red-700 font-medium">Recording in progress...</span>
                  </div>
                ) : (
                  <div className="flex items-center justify-center space-x-3 p-4 bg-gray-50 rounded-xl border border-gray-200">
                    <Mic className="h-5 w-5 text-gray-500" />
                    <span className="text-gray-600">Ready to record</span>
                  </div>
                )}
              </div>

              {/* Record Button */}
              <Button
                onClick={isRecording ? stopRecording : startRecording}
                className={`w-full h-14 text-lg font-semibold rounded-xl transition-all duration-200 ${
                  isRecording 
                    ? 'bg-red-500 hover:bg-red-600 text-white shadow-lg hover:shadow-xl' 
                    : 'bg-gradient-to-r from-blue-500 to-indigo-600 hover:from-blue-600 hover:to-indigo-700 text-white shadow-lg hover:shadow-xl'
                }`}
              >
                {isRecording ? (
                  <>
                    <Square className="h-5 w-5 mr-2" />
                    Stop Recording
                  </>
                ) : (
                  <>
                    <Mic className="h-5 w-5 mr-2" />
                    Start Recording
                  </>
                )}
              </Button>

              {/* Audio Status */}
              <div className="mt-4 flex items-center justify-center space-x-2 text-sm">
                {isPlaying ? (
                  <>
                    <Volume2 className="h-4 w-4 text-green-600" />
                    <span className="text-green-600 font-medium">AI is speaking...</span>
                  </>
                ) : (
                  <>
                    <VolumeX className="h-4 w-4 text-gray-500" />
                    <span className="text-gray-500">Silent mode</span>
                  </>
                )}
              </div>
            </div>

            {/* Quick Actions */}
            <div className="bg-white rounded-2xl shadow-lg border border-gray-200/50 p-6">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">Quick Actions</h3>
              
              {/* Text Response */}
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Type your response
                  </label>
                  <textarea
                    value={typedResponse}
                    onChange={(e) => setTypedResponse(e.target.value)}
                    placeholder="Type your response here..."
                    className="w-full border border-gray-300 rounded-xl p-4 text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none"
                    rows={4}
                  />
                </div>
                
                <Button
                  onClick={() => {
                    const text = typedResponse
                    if (text.trim()) {
                      sendTextMessage(text)
                      setTypedResponse('')
                    }
                  }}
                  className="w-full bg-gradient-to-r from-green-500 to-emerald-600 hover:from-green-600 hover:to-emerald-700 text-white shadow-lg hover:shadow-xl transition-all duration-200"
                >
                  <MessageSquare className="h-4 w-4 mr-2" />
                  Send Response
                </Button>
              </div>

              {/* Complete Interview Button */}
              <div className="mt-6 pt-6 border-t border-gray-200">
                <Button
                  onClick={completeInterview}
                  className={`w-full h-12 text-lg font-semibold rounded-xl transition-all duration-200 ${
                    isCompleted 
                      ? 'bg-gray-400 cursor-not-allowed' 
                      : 'bg-gradient-to-r from-red-500 to-pink-600 hover:from-red-600 hover:to-pink-700 text-white shadow-lg hover:shadow-xl'
                  }`}
                  disabled={isCompleted}
                >
                  <CheckCircle className="h-5 w-5 mr-2" />
                  {isCompleted ? 'Completing...' : 'Complete Interview'}
                </Button>
              </div>
            </div>

            {/* Interview Details */}
            <div className="bg-white rounded-2xl shadow-lg border border-gray-200/50 p-6">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">Interview Details</h3>
              
              <div className="space-y-4">
                <div className="flex items-center justify-between py-2">
                  <span className="text-gray-600 font-medium">Duration</span>
                  <span className="text-gray-900 font-semibold">{interview.duration} minutes</span>
                </div>
                
                <div className="flex items-center justify-between py-2">
                  <span className="text-gray-600 font-medium">Level</span>
                  <Badge className="bg-blue-100 text-blue-800 border-blue-200">
                    {interview.level}
                  </Badge>
                </div>
                
                <div className="flex items-center justify-between py-2">
                  <span className="text-gray-600 font-medium">Role</span>
                  <span className="text-gray-900 font-semibold">{interview.role}</span>
                </div>
                
                <div className="flex items-center justify-between py-2">
                  <span className="text-gray-600 font-medium">Questions</span>
                  <span className="text-gray-900 font-semibold">{interview.questions?.length || 0}</span>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Hidden audio element */}
        <audio ref={audioRef} />
      </div>
    </div>
  )
}
