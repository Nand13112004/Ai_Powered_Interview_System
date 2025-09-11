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
  AlertCircle
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
  
  const mediaRecorderRef = useRef<MediaRecorder | null>(null)
  const audioChunksRef = useRef<Blob[]>([])
  const streamRef = useRef<MediaStream | null>(null)
  const audioRef = useRef<HTMLAudioElement | null>(null)
  const intervalRef = useRef<NodeJS.Timeout | null>(null)
  const pendingJoinSessionIdRef = useRef<string | null>(null)

  const emitWhenConnected = (event: string, payload: any, attempt: number = 0) => {
    if (socketService.isConnected()) {
      socketService.emit(event, payload)
      return
    }
    if (attempt > 20) {
      toast.error('Connection issue. Please refresh and try again.')
      return
    }
    setTimeout(() => emitWhenConnected(event, payload, attempt + 1), 200)
  }

  useEffect(() => {
    if (interview.questions && interview.questions.length > 0) {
      setCurrentQuestionIndex(0)
    }
  }, [interview.questions])

  useEffect(() => {
    initializeSocket()
    startSession()
    startTimer()

    return () => {
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
        setIsCompleted(true)
        toast.success('Interview completed successfully!')
        setTimeout(() => {
          onComplete()
        }, 3000)
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
      toast.error(error.response?.data?.error || 'Failed to start session')
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
    if (!sessionId) return

    // If there is unsent typed text, send it before completing
    if (typedResponse.trim()) {
      sendTextMessage(typedResponse.trim())
      setTypedResponse('')
    }

    emitWhenConnected('complete_interview', {
      sessionId,
      finalTranscript: messages
    })

    // Redirect to dashboard after short delay to allow server to process
    setTimeout(() => {
      window.location.href = '/dashboard'
    }, 500)
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
    <div className="interview-container">
      <div className="container mx-auto px-4 py-8">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">{interview.title}</h1>
            <p className="text-gray-600">{interview.role} • {interview.level}</p>
          </div>
          <div className="flex items-center space-x-4">
            <Badge variant={isConnected ? 'default' : 'destructive'}>
              {isConnected ? 'Connected' : 'Disconnected'}
            </Badge>
            <div className="text-right">

            {/* Messages */}
            
          </div>
        </div>

        {/* Current Question + Next */}
        <div className="mt-4 flex items-center justify-between">
          <div className="text-lg font-semibold text-gray-800">
            {currentQuestion || 'Waiting for questions...'}
          </div>
          <Button
            onClick={goToNextQuestion}
            disabled={!interview.questions ? true : (!isCurrentAnswered && !typedResponse.trim())}
          >
            {currentQuestionIndex < (interview.questions?.length || 0) - 1 ? 'Next Question' : 'Finish Interview'}
          </Button>
        </div>

        {/* Controls */}
        <div className="space-y-6">
          {/* Audio Controls */}
          <Card>
            <CardHeader>
              <CardTitle>Audio Controls</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="audio-visualizer">
                {isRecording ? (
                  <div className="flex items-center space-x-2 text-red-600">
                    <div className="w-3 h-3 bg-red-500 rounded-full animate-pulse"></div>
                    <span>Recording...</span>
                  </div>
                ) : (
                  <span className="text-gray-500">Click to start recording</span>
                )}
              </div>

              <div className="flex space-x-2">
                <Button
                  onClick={isRecording ? stopRecording : startRecording}
                  variant={isRecording ? 'destructive' : 'default'}
                  className="flex-1"
                >
                  {isRecording ? (
                    <>
                      <Square className="h-4 w-4 mr-2" />
                      Stop
                    </>
                  ) : (
                    <>
                      <Mic className="h-4 w-4 mr-2" />
                      Record
                    </>
                  )}
                </Button>
              </div>

              <div className="flex items-center space-x-2 text-sm text-gray-600">
                {isPlaying ? (
                  <>
                    <Volume2 className="h-4 w-4" />
                    <span>AI is speaking...</span>
                  </>
                ) : (
                  <>
                    <VolumeX className="h-4 w-4" />
                    <span>Silent</span>
                  </>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Quick Actions */}
          <Card>
            <CardHeader>
              <CardTitle>Quick Actions</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              <div className="space-y-2">
                <textarea
                  value={typedResponse}
                  onChange={(e) => setTypedResponse(e.target.value)}
                  placeholder="Type your response here..."
                  className="w-full border rounded p-2 text-sm"
                  rows={3}
                />
                <Button
                  onClick={() => {
                    const text = typedResponse
                    if (text.trim()) {
                      sendTextMessage(text)
                      setTypedResponse('')
                    }
                  }}
                  variant="outline"
                  className="w-full"
                >
                  <MessageSquare className="h-4 w-4 mr-2" />
                  Send Response
                </Button>
              </div>

              {!isCompleted && (
                <Button
                  onClick={completeInterview}
                  variant="outline"
                  className="w-full"
                >
                  <CheckCircle className="h-4 w-4 mr-2" />
                  Complete Interview
                </Button>
              )}
            </CardContent>
          </Card>

            {/* Interview Info */}
            <Card>
              <CardHeader>
                <CardTitle>Interview Details</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-gray-600">Duration:</span>
                  <span>{interview.duration} minutes</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">Level:</span>
                  <Badge variant="outline">{interview.level}</Badge>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">Role:</span>
                  <span>{interview.role}</span>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>

        {/* Hidden audio element */}
        <audio ref={audioRef} />
      </div>
    </div>
  )
}
