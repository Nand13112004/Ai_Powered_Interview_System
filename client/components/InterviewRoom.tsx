'use client'

import { useState, useEffect, useRef, useMemo } from 'react'
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
  Brain,
  HelpCircle
} from 'lucide-react'
import { toast } from 'react-hot-toast'
import { socketService } from '@/lib/socket'
import { api } from '@/lib/api'
import axios from 'axios'
import dynamic from 'next/dynamic'
import { useAuth } from '@/contexts/AuthContext'

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
  sessionId?: string
  onComplete: () => void
}

interface Message {
  type: 'candidate' | 'interviewer'
  text: string
  timestamp: Date
}

export default function InterviewRoom({ interview, sessionId: propSessionId, onComplete }: InterviewRoomProps) {
  const { user } = useAuth(); // user?.id is your candidateId
  const [isConnected, setIsConnected] = useState(false)
  const [isRecording, setIsRecording] = useState(false)
  const [isPlaying, setIsPlaying] = useState(false)
  const [messages, setMessages] = useState<Message[]>([])
  const [typedResponse, setTypedResponse] = useState('')
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0)
  const [answeredByQuestionId, setAnsweredByQuestionId] = useState<Record<string, boolean>>({})
  const [draftAnswersByQuestionId, setDraftAnswersByQuestionId] = useState<Record<string, string>>({})
  // Removed duplicate declaration of currentQuestion state
  const [sessionId, setSessionId] = useState<string | null>(propSessionId || null)
  const [elapsedTime, setElapsedTime] = useState(0)
  const [sessionStartTime, setSessionStartTime] = useState<Date | null>(null)
  const [questionStartTime, setQuestionStartTime] = useState<Date | null>(null)
  const [timeSpentPerQuestion, setTimeSpentPerQuestion] = useState<Record<string, number>>({})
  const [isCompleted, setIsCompleted] = useState(false)
  const [incidentCount, setIncidentCount] = useState(0)
  const [incidents, setIncidents] = useState<Array<{type: string, meta: any, timestamp: Date}>>([])
  const [sessionError, setSessionError] = useState<string | null>(null)
  const [sessionLoading, setSessionLoading] = useState(true)
  const [pythonCommand, setPythonCommand] = useState<string | null>(null)
  const [interviewScheduledTime, setInterviewScheduledTime] = useState<{start: Date | null, end: Date | null}>({start: null, end: null})
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

  // Strict mode configuration - enabled for anti-cheating
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
        if (document.documentElement.requestFullscreen) {
          await document.documentElement.requestFullscreen();
          toast.success('Fullscreen mode enabled for secure interview');
        }
      } catch (error) {
        console.warn('Fullscreen request failed:', error);
        toast.error('Fullscreen is required for this interview. Please enable it manually.');
        // Give user a chance to enable fullscreen manually
        setTimeout(() => {
          if (!document.fullscreenElement) {
            toast.error('Please enable fullscreen mode to continue the interview');
          }
        }, 3000);
      }
    }

    const boot = async () => {
      await ensurePermissions();
      await enterFullscreen();
      initializeSocket();
      startSession();
      startTimer();
    }

    boot();

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
      const inFs = !!document.fullscreenElement;
      if (!inFs && STRICT_MODE && !isCompleted) {
        reportIncident('fullscreen_exit');
        // Immediate warning
        toast.error('Fullscreen exit detected! Please return to fullscreen immediately.');
        // Give user 3 seconds to return to fullscreen
        setTimeout(() => {
          if (!document.fullscreenElement && !isCompleted) {
            toast.error('Interview terminated due to fullscreen exit.');
            completeInterview('fullscreen_exit');
          }
        }, 3000); // 3 seconds to return to fullscreen
      }
    };
    document.addEventListener('fullscreenchange', onFullscreenChange);

    return () => {
      cleanup();
      window.removeEventListener('beforeunload', handleBeforeUnload);
      document.removeEventListener('fullscreenchange', onFullscreenChange);
    }
  // Prevent exiting fullscreen until interview is complete
  useEffect(() => {
    if (!isCompleted && STRICT_MODE) {
      const preventKey = (e: KeyboardEvent) => {
        // Prevent ESC key
        if (e.key === 'Escape') {
          e.preventDefault();
          e.stopPropagation();
        }
      };
      window.addEventListener('keydown', preventKey, true);
      return () => window.removeEventListener('keydown', preventKey, true);
    }
  }, [isCompleted]);
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
          toast.error('🚨 STRICT VIOLATION DETECTED! Ending interview immediately.', {
            duration: 8000,
            style: {
              background: '#fee2e2',
              color: '#dc2626',
              border: '3px solid #ef4444',
              fontSize: '18px',
              fontWeight: 'bold'
            }
          });
          emitWhenConnected('proctor_threshold_breach', {
            sessionId,
            incidents: incidentCount + 1,
            reason: type
          })
          completeInterview()
          return
        }
        if (!isCompleted && (incidentCount + 1 >= INCIDENT_THRESHOLD)) {
          toast.error('🚨 TOO MANY INCIDENTS! Interview terminated due to multiple violations.', {
            duration: 8000,
            style: {
              background: '#fee2e2',
              color: '#dc2626',
              border: '3px solid #ef4444',
              fontSize: '18px',
              fontWeight: 'bold'
            }
          });
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
          // Immediate warning
          toast.error('Tab switch detected! Please return to the interview tab immediately.');
          // Give user 2 seconds to return
          setTimeout(() => {
            if (document.hidden && !isCompleted) {
              toast.error('Interview terminated due to tab switch.');
              completeInterview('tab_change')
              window.location.href = '/dashboard'
            }
          }, 2000); // 2 seconds to return
        }
      }
    }
    const onBlur = () => {
      reportIncident('window_blur')
      if (STRICT_MODE) {
        // Immediate warning
        toast.error('Window focus lost! Please return focus immediately.');
        // Give user 2 seconds to return focus
        setTimeout(() => {
          if (!document.hasFocus() && !isCompleted) {
            toast.error('Interview terminated due to focus loss.');
            completeInterview('tab_change')
            window.location.href = '/dashboard'
          }
        }, 2000); // 2 seconds to return focus
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

  const currentQuestion = interview.questions ? interview.questions[currentQuestionIndex]?.text || '' : ''
  const currentQuestionId = interview.questions ? interview.questions[currentQuestionIndex]?.id : undefined
  const isCurrentAnswered = currentQuestionId ? !!answeredByQuestionId[currentQuestionId] : false

  const goToNextQuestion = async () => {
    if (!interview.questions || interview.questions.length === 0) return

    const currentQ = interview.questions[currentQuestionIndex]
    if (typedResponse.trim() && currentQuestionId) {
      sendTextMessage(typedResponse.trim())
      setTypedResponse('')
      // Clear draft when answer is submitted
      setDraftAnswersByQuestionId(prev => ({ ...prev, [currentQuestionId]: '' }))
    }

    // Move to next if exists
    if (currentQuestionIndex < interview.questions.length - 1) {
      setCurrentQuestionIndex(currentQuestionIndex + 1)
    }
  }

  // Save draft when navigating away from question
  const handleQuestionNavigation = (newIndex: number) => {
    if (!currentQuestionId || !interview.questions) return

    // Save current typed response as draft if it exists
    if (typedResponse.trim()) {
      setDraftAnswersByQuestionId(prev => ({
        ...prev,
        [currentQuestionId]: typedResponse.trim()
      }))
    }

    setCurrentQuestionIndex(newIndex)
  }

  // Restore draft when returning to question
  useEffect(() => {
    if (currentQuestionId && draftAnswersByQuestionId[currentQuestionId]) {
      setTypedResponse(draftAnswersByQuestionId[currentQuestionId])
    } else if (currentQuestionId) {
      setTypedResponse('')
    }
  }, [currentQuestionIndex, currentQuestionId, draftAnswersByQuestionId])
  





  const finishInterview = async () => {
    if (!sessionId) {
      toast.error('Session not ready. Please wait a moment and try again.');
      return;
    }
    if (isCompleted) return; // Prevent double completion

    try {
      // Submit any remaining typed response
      if (typedResponse.trim() && currentQuestionId) {
        sendTextMessage(typedResponse.trim());
        setTypedResponse('');
      }

      // Submit all answers that haven't been submitted yet
      await submitAllAnswers();

      toast.success('All answers submitted. Completing interview...')
      completeInterview()
    } catch (error) {
      console.error('Error finishing interview:', error);
      toast.error('Failed to submit answers. Please try again.');
    }
  }

  const submitAllAnswers = async () => {
    if (!interview.questions || !user?.id) return;

    const submittedAnswers = new Set<string>();

    // Create a map of question responses from messages
    const questionResponses = new Map<string, string>();
    
    // Group messages by question index (assuming order matches question order)
    let questionIndex = 0;
    for (const message of messages) {
      if (message.type === 'interviewer') {
        // This is a question, increment index
        questionIndex++;
      } else if (message.type === 'candidate' && message.text.trim()) {
        // This is a candidate response
        const currentQIndex = Math.max(0, questionIndex - 1);
        if (currentQIndex < interview.questions.length) {
          const questionId = interview.questions[currentQIndex].id;
          if (!questionResponses.has(questionId)) {
            questionResponses.set(questionId, message.text.trim());
          }
        }
      }
    }

    // Submit answers for all questions that have responses via WebSocket
    questionResponses.forEach((responseText, questionId) => {
      if (!answeredByQuestionId[questionId] && responseText.trim()) {
        sendTextMessage(responseText);
        submittedAnswers.add(questionId);
      }
    });

    // Note: WebSocket submissions are asynchronous, no need to wait
    console.log(`Submitting ${submittedAnswers.size} answers via WebSocket`);
  }

  const initializeSocket = () => {
    try {
      console.log('🔄 Initializing socket connection...')
      socketService.connect()
      setIsConnected(true)
      console.log('✅ Socket connection initialized successfully')

      socketService.on('interview_joined', async (data: { sessionId: string }) => {
        console.log('✅ Interview joined successfully:', data)
        setSessionId(data.sessionId)
        setCurrentQuestionIndex(0)
        const firstQuestion = interview.questions && interview.questions.length > 0 ? interview.questions[0].text : null
        setMessages([{
          type: 'interviewer',
          text: firstQuestion || 'Welcome! Let\'s begin the interview. Please introduce yourself.',
          timestamp: new Date()
        }])
        // Automatically launch Python cheating detection script
        const serverUrl = 'http://localhost:5000' // Server URL for Python script to connect to /proctor namespace
        try {
          const response = await fetch('http://localhost:3001/run-python', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              sessionId: data.sessionId,
              serverUrl: serverUrl
            }),
          })
          if (response.ok) {
            console.log('✅ Python cheating detection script launched successfully')
            toast.success('Cheating detection activated')
          } else {
            console.error('❌ Failed to launch Python script:', response.statusText)
            toast.error('Failed to activate cheating detection. Please run the command manually.')
            // Fallback: set the command for manual execution
            setPythonCommand(`python cheating_detection.py --session-id ${data.sessionId} --server-url ${serverUrl}`)
          }
        } catch (error) {
          console.error('❌ Error launching Python script:', error)
          toast.error('Failed to activate cheating detection. Please run the command manually.')
          // Fallback: set the command for manual execution
          setPythonCommand(`python cheating_detection.py --session-id ${data.sessionId} --server-url ${serverUrl}`)
        }
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

      socketService.on('proctor_detection', (data: { type: string, meta: any, at: number }) => {
        const incident = {
          type: data.type,
          meta: data.meta,
          timestamp: new Date(data.at * 1000)
        }
        setIncidents(prev => {
          const newIncidents = [...prev, incident]
          return newIncidents.length > 10 ? newIncidents.slice(-10) : newIncidents
        })
        setIncidentCount(prev => prev + 1)
        console.log('Proctor detection received:', data)
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
    setSessionLoading(true)
    setSessionError(null)
    try {
      console.log('🔄 Starting session creation for interview:', interview.id)
      console.log('🔄 Current sessionId before creation:', sessionId)
      console.log('🔄 Current pendingJoinSessionId:', pendingJoinSessionIdRef.current)
      console.log('🔄 User info:', user)

      const response = await api.post('/sessions', {
        interviewId: interview.id
      })

      console.log('✅ Session creation response:', response.data)
      const newSessionId = response.data.session?.id || response.data.sessionId
      console.log('✅ Session ID extracted:', newSessionId)

      if (!newSessionId) {
        throw new Error('No session ID received from server')
      }

      setSessionId(newSessionId)
      setSessionLoading(false)
      setSessionError(null)
      console.log('✅ Session ID set in state:', newSessionId)
      
      // Show appropriate message for new session vs resumption
      if (response.data.message?.includes('Resuming')) {
        toast.success('Resuming your interview session')
      } else {
        toast.success('Interview session started')
      }

      if (socketService.isConnected()) {
        console.log('🔄 Socket is connected, emitting join_interview')
        socketService.emit('join_interview', { sessionId: newSessionId })
      } else {
        console.log('🔄 Socket not connected, storing in pending join')
        pendingJoinSessionIdRef.current = newSessionId
        emitWhenConnected('join_interview', { sessionId: newSessionId })
      }
    } catch (error: any) {
      console.error('❌ Session creation error:', error)
      console.error('❌ Error response:', error.response?.data)
      console.error('❌ Error status:', error.response?.status)

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
          console.log('✅ Using existing session ID:', existingSessionId)

          setSessionId(existingSessionId)
          setSessionLoading(false)
          setSessionError(null)

          if (socketService.isConnected()) {
            socketService.emit('join_interview', { sessionId: existingSessionId })
          } else {
            pendingJoinSessionIdRef.current = existingSessionId
            emitWhenConnected('join_interview', { sessionId: existingSessionId })
          }
        }
      } else if (error.response?.status === 401) {
        toast.error('Authentication failed. Please login again.')
        setTimeout(() => {
          window.location.href = '/'
        }, 2000)
      } else if (error.response?.status === 404) {
        toast.error('Interview not found. Please check the interview ID.')
        setTimeout(() => {
          window.location.href = '/dashboard'
        }, 2000)
      } else {
        setSessionError(error.response?.data?.error || 'Failed to start session')
        setSessionLoading(false)
        toast.error(error.response?.data?.error || 'Failed to start session')
      }
    }
  }

  // Add a timeout to fail gracefully if sessionId is not set
  useEffect(() => {
    if (sessionId || isCompleted) {
      setSessionLoading(false)
      setSessionError(null)
      return
    }
    setSessionLoading(true)
    setSessionError(null)
    const timeout = setTimeout(() => {
      if (!sessionId && !isCompleted) {
        setSessionError('Failed to prepare your interview session. Please check your connection and try again.')
        setSessionLoading(false)
      }
    }, 10000)
    return () => clearTimeout(timeout)
  }, [sessionId, isCompleted])

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
          console.log('Audio chunk received:', event.data.size, 'bytes')
        }
      }

      mediaRecorder.onstop = () => {
        const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/webm' })
        console.log('Audio recording stopped. Total size:', audioBlob.size, 'bytes')
        sendAudioData(audioBlob)
      }

      mediaRecorder.start()
      setIsRecording(true)
      toast.success('Recording started')
      console.log('Audio recording started')
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

  const sendAudioData = async (audioBlob: Blob) => {
    if (!sessionId) return

    console.log('Sending audio data. Blob size:', audioBlob.size, 'bytes')
    console.log('Blob type:', audioBlob.type)

    const reader = new FileReader()
    reader.onload = async () => {
      const base64Audio = reader.result?.toString().split(',')[1]
      if (base64Audio) {
        console.log('Base64 audio length:', base64Audio.length)
        const questionId = interview.questions[currentQuestionIndex]?.id
        
        // Send via WebSocket for real-time processing (this will also save to database)
        socketService.emit('audio_data', {
          sessionId,
          audioBlob: base64Audio,
          timestamp: new Date().toISOString(),
          questionId
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

  const completeInterview = async (reason?: string) => {
    console.log('🔄 Complete interview called. Current sessionId:', sessionId)
    console.log('🔄 Current state - isConnected:', isConnected, 'isCompleted:', isCompleted)

    if (!sessionId) {
      console.error('❌ No sessionId found when trying to complete interview')
      console.log('❌ Debug info:', {
        interviewId: interview.id,
        userId: user?.id,
        isConnected,
        isCompleted,
        messagesCount: messages.length,
        currentQuestionIndex,
        pendingJoinSessionId: pendingJoinSessionIdRef.current
      })

      // Try to recover session from pending join
      if (pendingJoinSessionIdRef.current) {
        console.log('🔄 Attempting to recover session from pending join:', pendingJoinSessionIdRef.current)
        setSessionId(pendingJoinSessionIdRef.current)
        pendingJoinSessionIdRef.current = null
      } else {
        toast.error('No session found. Please refresh and try again.');
        return;
      }
    }

    setIsCompleted(true);
    toast.success('Completing interview...');

    // Emit complete interview event
    emitWhenConnected('complete_interview', {
      sessionId,
      finalTranscript: messages,
      reason,
    });

    // Wait a moment for the server to process completion
    setTimeout(() => {
      toast.success('Interview completed! Redirecting to dashboard...');
      // Use router.push for better navigation
      window.location.href = '/dashboard';
    }, 1500);

    // Fallback timeout in case socket doesn't respond
    setTimeout(() => {
      if (!socketService.isConnected()) {
        console.warn('⚠️ Socket not connected, but proceeding with completion');
        toast.success('Completing interview offline...');
        window.location.href = '/dashboard';
      }
    }, 5000);
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

  // Helper function to get question ID for a given index
  const getQuestionId = (index: number) => interview.questions ? interview.questions[index]?.id : undefined

  // Current question data - must be declared before useEffects that use them
  

  const submitAnswerToBackend = async (answer: string, questionId: string) => {
    if (!interview.id || !questionId || !answer.trim() || !user?.id) {
      console.warn('Missing required data for answer submission:', {
        interviewId: interview.id,
        questionId,
        answer: answer.trim(),
        userId: user?.id
      });
      return;
    }

    try {
      // Submit to Answer collection (for answer tracking)
      const answerResponse = await api.post('/answers', {
        interviewId: interview.id,
        candidateId: user.id,
        questionId,
        answerText: answer.trim(),
      });

      console.log('✅ Answer submitted successfully:', answerResponse.data);

      // Also submit to Response collection (for interviewer view)
      if (sessionId) {
        try {
          const responseResponse = await api.post('/responses', {
            userId: user.id,
            interviewId: interview.id,
            sessionId,
            questionId,
            text: answer.trim(),
          });
          console.log('✅ Response submitted successfully:', responseResponse.data);
        } catch (responseError) {
          console.warn('Failed to submit response:', responseError);
          // Don't fail the whole process if response submission fails
        }
      }

      // Mark question as answered
      setAnsweredByQuestionId(prev => ({ ...prev, [questionId]: true }));

      return answerResponse.data;
    } catch (error: any) {
      console.error('❌ Failed to submit answer:', error);
      const errorMessage = error.response?.data?.message || error.message || 'Unknown error';
      toast.error(`Failed to save answer: ${errorMessage}`);

      // Don't throw error to prevent breaking the interview flow
      // The answer will still be saved via socket for real-time processing
    }
  };

  // Retry handler
  const handleRetrySession = () => {
    setSessionError(null)
    setSessionLoading(true)
    startSession()
  }

  // Show loading or error UI
  // if ((sessionLoading || (!sessionId && !isCompleted)) && !sessionError) {
  //   return (
  //     <div className="flex items-center justify-center min-h-screen">
  //       <div className="text-lg text-gray-700">
  //         Preparing your interview session...
  //       </div>
  //     </div>
  //   )
  // }

  // if (sessionError) {
  //   return (
  //     <div className="flex flex-col items-center justify-center min-h-screen">
  //       <div className="text-lg text-red-600 mb-4">{sessionError}</div>
  //       <Button onClick={handleRetrySession} className="bg-blue-600 text-white px-6 py-2 rounded-lg">
  //         Retry
  //       </Button>
  //     </div>
  //   )
  // }

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
          {/* Left Column - Question and Answer */}
          <div className="lg:col-span-2 space-y-6">
            {/* Question Box styled like the image */}
            <div className="relative">
              <div className="relative rounded-3xl border-2 border-red-500 bg-white p-6 pt-8 shadow-sm">
                <div className="absolute -top-4 left-1/2 -translate-x-1/2 bg-white">
                  <div className="w-10 h-10 rounded-full border-2 border-red-500 flex items-center justify-center text-red-600 bg-white">
                    <HelpCircle className="h-6 w-6" />
                  </div>
                </div>
                <div className="flex items-start justify-between">
                  <div>
                    <h3 className="text-sm font-semibold text-gray-500 mb-1">Question {currentQuestionIndex + 1} of {interview.questions?.length || 0}</h3>
                    <p className="text-lg font-semibold text-gray-900">
                      {currentQuestion || 'Waiting for questions...'}
                    </p>
                  </div>
                </div>
              </div>
            </div>

            {/* Answer Section */}
            <div className="bg-white rounded-2xl shadow-lg border border-gray-200/50 p-6">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">Answer</h3>

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

                {/* <Button
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
                </Button> */}
              </div>

              {/* Next Question Button */}
              <div className="mt-6 pt-6 border-t border-gray-200">
                <Button
                  onClick={currentQuestionIndex < (interview.questions?.length || 0) - 1 ? goToNextQuestion : finishInterview}
                  disabled={
                    !interview.questions || !sessionId
                  }
                  className="w-full bg-gradient-to-r from-blue-500 to-indigo-600 hover:from-blue-600 hover:to-indigo-700 text-white shadow-lg hover:shadow-xl transition-all duration-200"
                >
                  {currentQuestionIndex < (interview.questions?.length || 0) - 1 ? 'Next Question' : 'Finish Interview'}
                </Button>
              </div>

              {/* Question Navigation */}
              {interview.questions && interview.questions.length > 1 && (
                <div className="mt-6 pt-6 border-t border-gray-200">
                  <h4 className="text-sm font-medium text-gray-700 mb-3">Jump to Question:</h4>
                  <div className="flex flex-wrap gap-2">
                    {interview.questions.map((question, index) => {
                      const isAnswered = answeredByQuestionId[question.id]
                      const isCurrent = index === currentQuestionIndex

                      return (
                        <button
                          key={question.id}
                          onClick={() => setCurrentQuestionIndex(index)}
                          disabled={!sessionId}
                          className={`
                            w-10 h-10 rounded-lg border-2 font-semibold text-sm transition-all duration-200
                            flex items-center justify-center
                            ${isCurrent
                              ? 'border-blue-500 bg-blue-500 text-white shadow-lg'
                              : isAnswered
                                ? 'border-green-500 bg-green-500 text-white hover:bg-green-600 hover:border-green-600'
                                : 'border-gray-300 bg-white text-gray-700 hover:border-gray-400 hover:bg-gray-50'
                            }
                            ${!sessionId ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}
                          `}
                        >
                          {index + 1}
                        </button>
                      )
                    })}
                  </div>
                  <div className="mt-2 flex items-center justify-between text-xs text-gray-500">
                    <span>Click any number to jump to that question</span>
                    <div className="flex items-center space-x-4">
                      <div className="flex items-center space-x-1">
                        <div className="w-3 h-3 rounded border-2 border-gray-300 bg-white"></div>
                        <span>Not answered</span>
                      </div>
                      <div className="flex items-center space-x-1">
                        <div className="w-3 h-3 rounded border-2 border-green-500 bg-green-500"></div>
                        <span>Answered</span>
                      </div>
                    </div>
                  </div>
                </div>
              )}
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

            {/* Python Cheating Detection */}
            <div className="bg-white rounded-2xl shadow-lg border border-gray-200/50 p-6">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">Cheating Detection (Python)</h3>
              <div className="bg-green-50 rounded-xl p-4 mb-4 border border-green-200">
                <div className="flex items-center justify-center space-x-2 mb-2">
                  <CheckCircle className="h-5 w-5 text-green-600" />
                  <span className="text-sm font-medium text-green-800">Automatic Launch Active</span>
                </div>
                <p className="text-xs text-green-700 text-center">
                  Python cheating detection script is launched automatically when entering the interview room.
                </p>
              </div>
              {pythonCommand && (
                <div className="bg-yellow-50 rounded-xl p-4 mb-4 border border-yellow-200">
                  <p className="text-sm text-yellow-700 mb-2">Fallback: If automatic launch fails, run this command manually:</p>
                  <div className="bg-black text-green-400 rounded-lg p-3 font-mono text-xs overflow-x-auto">
                    <code>{pythonCommand}</code>
                  </div>
                  <p className="text-xs text-yellow-600 mt-2">
                    Ensure dependencies are installed: <code>pip install opencv-python mediapipe ultralytics python-socketio</code>.
                  </p>
                </div>
              )}
              <div className="flex items-center justify-center text-xs text-blue-600">
                <AlertCircle className="h-4 w-4 mr-1" />
                <span>Browser-based detection is active as fallback.</span>
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
