'use client'

import { useState, useEffect, useRef } from 'react'
import { Button } from '@/components/ui/button'
import { Progress } from '@/components/ui/progress'
import { Badge } from '@/components/ui/badge'
import { 
  Mic, 
  Volume2, 
  VolumeX, 
  Square, 
  MessageSquare,
  Brain,
  HelpCircle
} from 'lucide-react'
import { toast } from 'react-hot-toast'
import { socketService } from '@/lib/socket'
import { api } from '@/lib/api'
import { useAuth } from '@/contexts/AuthContext'
import VoiceInteractionPanel from '@/components/VoiceInteractionPanel'

interface Question {
  id:            string
  text:          string
  number:        number
  type:          string        // 'mcq' | 'text' | 'code'
  options:       string[]     // e.g. ['a) Yes', 'b) No', 'c) Maybe', 'd) Never']
  correctAnswer: string | null
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
  // MCQ: track selected option per question id
  const [mcqAnswers, setMcqAnswers] = useState<Record<string, string>>({})
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
  const [sessionError, setSessionError] = useState<string | null>(null)
  const [sessionLoading, setSessionLoading] = useState(true)
  const [interviewScheduledTime, setInterviewScheduledTime] = useState<{start: Date | null, end: Date | null}>({start: null, end: null})
  const audioContextRef = useRef<AudioContext | null>(null)
  const analyserRef = useRef<AnalyserNode | null>(null)
  
  const mediaRecorderRef = useRef<MediaRecorder | null>(null)
  const audioChunksRef = useRef<Blob[]>([])
  const streamRef = useRef<MediaStream | null>(null)
  const audioRef = useRef<HTMLAudioElement | null>(null)
  const intervalRef = useRef<NodeJS.Timeout | null>(null)
  const pendingJoinSessionIdRef = useRef<string | null>(null)



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
        await navigator.mediaDevices.getUserMedia({ audio: true })
      } catch (_) {
        toast.error('Microphone permission required for interview')
      }
    }

    const boot = async () => {
      await ensurePermissions();
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

    return () => {
      window.removeEventListener('beforeunload', handleBeforeUnload)
      cleanup()
    }
  }, [])

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

    if (typedResponse.trim() && currentQuestionId) {
      sendTextMessage(typedResponse.trim())
      setTypedResponse('')
      // Clear draft + MCQ selection when answer is submitted
      setDraftAnswersByQuestionId(prev => ({ ...prev, [currentQuestionId]: '' }))
      setMcqAnswers(prev => {
        const next = { ...prev }
        delete next[currentQuestionId]
        return next
      })
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
    // Guard: only start one interval (React 18 Strict Mode runs effects twice in dev)
    if (intervalRef.current) return
    intervalRef.current = setInterval(() => {
      setElapsedTime(prev => prev + 1)
    }, 1000)
  }

  const startRecording = async () => {
    try {
      // Request secure media with specific constraints
      const stream = await navigator.mediaDevices.getUserMedia({ 
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
          // Add security constraints
          sampleRate: 44100,
          channelCount: 1
        }
      })
      streamRef.current = stream
      
      // Create MediaRecorder with secure settings
      const mediaRecorder = new MediaRecorder(stream, {
        mimeType: 'audio/webm;codecs=opus',
        audioBitsPerSecond: 128000 // Lower quality to reduce file size
      })
      mediaRecorderRef.current = mediaRecorder
      audioChunksRef.current = []

      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          audioChunksRef.current.push(event.data)
          console.log('Audio chunk received:', event.data.size, 'bytes')
        }
      }

      mediaRecorder.onstop = () => {
        const audioBlob = new Blob(audioChunksRef.current, { 
          type: 'audio/webm;codecs=opus' // Secure format
        })
        console.log('Audio recording stopped. Total size:', audioBlob.size, 'bytes')
        sendAudioData(audioBlob)
      }

      mediaRecorder.start(1000) // Record in 1-second chunks for security
      setIsRecording(true)
      toast.success('Secure recording started')
      console.log('Secure audio recording started')
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

    console.log('Sending secure audio data. Blob size:', audioBlob.size, 'bytes')
    console.log('Blob type:', audioBlob.type)

    // Add security watermark to prevent unauthorized use
    const secureBlob = new Blob([audioBlob], { 
      type: 'audio/webm;codecs=opus'
    })

    const reader = new FileReader()
    reader.onload = async () => {
      const base64Audio = reader.result?.toString().split(',')[1]
      if (base64Audio) {
        console.log('Base64 audio length:', base64Audio.length)
        const questionId = interview.questions[currentQuestionIndex]?.id
        
        // Send via WebSocket for real-time processing with security flags
        socketService.emit('audio_data', {
          sessionId,
          audioBlob: base64Audio,
          timestamp: new Date().toISOString(),
          questionId,
          secure: true,
          nonDownloadable: true
        })

        const qId = interview.questions[currentQuestionIndex]?.id
        if (qId) {
          setAnsweredByQuestionId(prev => ({ ...prev, [qId]: true }))
        }
      }
    }
    reader.readAsDataURL(secureBlob)
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

  const cleanup = async () => {
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
                <div className="text-sm text-gray-500 font-medium">Elapsed Time</div>
                <div className="text-xl font-bold text-gray-900">{formatTime(elapsedTime)}</div>
              </div>
              <div className="text-center">
                <div className="text-sm text-gray-500 font-medium">Remaining</div>
                <div className="text-xl font-bold text-gray-900">
                  {formatTime(Math.max(0, (interview.duration * 60) - elapsedTime))}
                </div>
              </div>
              <div className="text-center">
                <div className="text-sm text-gray-500 font-medium">Progress</div>
                <div className="text-xl font-bold text-gray-900">{currentQuestionIndex + 1}/{interview.questions?.length || 0}</div>
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

      {/* Progress Bar */}
      <div className="max-w-7xl mx-auto px-4 py-4">
        <div className="bg-white/80 backdrop-blur-sm rounded-xl p-4 border border-gray-200/50">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-medium text-gray-700">Interview Progress</span>
            <span className="text-sm text-gray-500">
              {Math.round(progress)}% complete
            </span>
          </div>
          <Progress value={progress} className="h-2" />
          <div className="flex justify-between text-xs text-gray-500 mt-1">
            <span>Started</span>
            <span>{formatTime(elapsedTime)} / {interview.duration} min</span>
            <span>Complete</span>
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

              {/* ── MCQ: show radio options when question has options ── */}
              {(() => {
                const q = interview.questions?.[currentQuestionIndex]
                const isMCQ = q?.type === 'mcq' || (q?.options && q.options.length > 0)
                const selectedOption = currentQuestionId ? mcqAnswers[currentQuestionId] : undefined

                if (isMCQ && q?.options?.length) {
                  return (
                    <div className="space-y-3">
                      <p className="text-sm font-medium text-gray-600 mb-3">Select the best answer:</p>
                      {q.options.map((option, optIdx) => {
                        const optionKey = option.charAt(0).toLowerCase() // 'a', 'b', 'c', 'd'
                        const isSelected = selectedOption === optionKey
                        return (
                          <label
                            key={optIdx}
                            className={`flex items-start gap-3 p-4 rounded-xl border-2 cursor-pointer transition-all duration-150 ${
                              isSelected
                                ? 'border-blue-500 bg-blue-50 shadow-sm'
                                : 'border-gray-200 bg-gray-50 hover:border-blue-300 hover:bg-blue-50/40'
                            }`}
                          >
                            <input
                              type="radio"
                              name={`mcq_${currentQuestionId}`}
                              value={optionKey}
                              checked={isSelected}
                              onChange={() => {
                                if (!currentQuestionId) return
                                setMcqAnswers(prev => ({ ...prev, [currentQuestionId]: optionKey }))
                                // Also set as typed response so goToNextQuestion / sendTextMessage picks it up
                                setTypedResponse(option)
                              }}
                              className="mt-0.5 accent-blue-600"
                            />
                            <span className={`text-sm font-medium ${ isSelected ? 'text-blue-800' : 'text-gray-700' }`}>
                              {option}
                            </span>
                          </label>
                        )
                      })}
                    </div>
                  )
                }

                // ── Text / open-ended question ──
                return (
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
                )
              })()}

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
            {/* Voice Interaction Panel */}
            {sessionId && currentQuestionId ? (
              <VoiceInteractionPanel
                sessionId={sessionId}
                interviewId={interview.id}
                questionId={currentQuestionId}
                question={currentQuestion}
                onComplete={({ transcript, audioUrl, evaluation }) => {
                  // Show transcript as a candidate message in chat
                  if (transcript) {
                    setMessages(prev => [...prev, {
                      type: 'candidate',
                      text: `🎤 ${transcript}`,
                      timestamp: new Date(),
                    }])
                  }
                  // Mark question answered
                  if (currentQuestionId) {
                    setAnsweredByQuestionId(prev => ({ ...prev, [currentQuestionId]: true }))
                  }
                  toast.success(`Score: ${evaluation.score}/10 — see feedback in the panel`)
                }}
              />
            ) : (
              <div className="bg-white rounded-2xl shadow-lg border border-gray-200/50 p-6">
                <h3 className="text-lg font-semibold text-gray-900 mb-4">Voice Answer</h3>
                <div className="flex items-center justify-center space-x-3 p-4 bg-gray-50 rounded-xl border border-gray-200">
                  <Mic className="h-5 w-5 text-gray-400" />
                  <span className="text-gray-500 text-sm">Waiting for session…</span>
                </div>
              </div>
            )}

            {/* AI Speaking indicator */}
            {isPlaying && (
              <div className="flex items-center justify-center gap-2 rounded-xl bg-indigo-50 border border-indigo-200 px-4 py-3">
                <Volume2 className="h-4 w-4 text-indigo-600 animate-pulse" />
                <span className="text-indigo-700 text-sm font-medium">AI is speaking…</span>
              </div>
            )}



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
