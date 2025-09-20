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
import dynamic from 'next/dynamic'
import { useAuth } from '@/contexts/AuthContext'
import InterviewCompletionModal from './InterviewCompletionModal'

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
  const { user } = useAuth(); // user?.id is your candidateId
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
  const [showCompletionModal, setShowCompletionModal] = useState(false)
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
          await document.documentElement.requestFullscreen();
        }
      } catch (_) {}
    }

    const boot = async () => {
      await ensurePermissions();
      await enterFullscreen();
      initializeSocket();
      startSession();
      startTimer();
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
      const inFs = !!document.fullscreenElement;
      if (!inFs && STRICT_MODE && !isCompleted) {
        reportIncident('fullscreen_exit');
        toast.error('You must stay in fullscreen for the interview. Ending interview.');
        completeInterview();
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
          toast.error('Tab switch detected. Interview terminated.')
          completeInterview('tab_change')
          window.location.href = '/dashboard'
        }
      }
    }
    const onBlur = () => {
      reportIncident('window_blur')
      if (STRICT_MODE) {
        toast.error('Window focus lost. Interview terminated.')
        completeInterview('tab_change')
        window.location.href = '/dashboard'
      }
    }
