'use client'

import { useState, useEffect } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { 
  Lock, 
  Clock, 
  Calendar, 
  AlertCircle, 
  CheckCircle, 
  Eye, 
  EyeOff,
  Users,
  Timer
} from 'lucide-react'
import { toast } from 'react-hot-toast'
import { api } from '@/lib/api'
import WaitingRoom from './WaitingRoom'

interface InterviewEntryProps {
  interviewCode: string
  onSuccess: (sessionId: string, interview: any) => void
  onError: (error: string) => void
}

export default function InterviewEntry({ 
  interviewCode, 
  onSuccess, 
  onError 
}: InterviewEntryProps) {
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [loading, setLoading] = useState(false)
  const [interview, setInterview] = useState<any>(null)
  const [timeUntilStart, setTimeUntilStart] = useState(0)
  const [showWaitingRoom, setShowWaitingRoom] = useState(false)

  // Load interview details on mount
  useEffect(() => {
    const loadInterview = async () => {
      try {
        const response = await api.get(`/interviews/by-code/${interviewCode}`)
        setInterview(response.data)
      } catch (error) {
        console.error('Failed to load interview:', error)
        onError('Failed to load interview details')
      }
    }
    loadInterview()
  }, [interviewCode, onError])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!password.trim()) {
      toast.error('Please enter the interview password')
      return
    }

    setLoading(true)
    try {
      const response = await api.post('/sessions/verify-entry', {
        interviewCode,
        password: password.trim()
      })

      const { sessionId, interview: interviewData, session } = response.data

      // Check if interview is scheduled and not yet started
      if (interviewData.timeSlot?.start && new Date() < new Date(interviewData.timeSlot.start)) {
        const startTime = new Date(interviewData.timeSlot.start).getTime()
        const currentTime = new Date().getTime()
        const timeUntilStart = Math.ceil((startTime - currentTime) / 1000)
        setTimeUntilStart(timeUntilStart)
        setShowWaitingRoom(true)
        return
      }

      // Interview can start immediately
      onSuccess(sessionId, interviewData)
    } catch (error: any) {
      console.error('Interview entry failed:', error)
      
      if (error.response?.status === 403 && error.response?.data?.requiresWaiting) {
        // Interview hasn't started yet - show waiting room
        const timeUntilStart = error.response.data.secondsUntilStart || 0
        setTimeUntilStart(timeUntilStart)
        setShowWaitingRoom(true)
        return
      }

      const errorMessage = error.response?.data?.error || 'Failed to enter interview'
      toast.error(errorMessage)
      onError(errorMessage)
    } finally {
      setLoading(false)
    }
  }

  const handleInterviewStart = () => {
    setShowWaitingRoom(false)
    // Retry entry now that interview should be active
    handleSubmit(new Event('submit') as any)
  }

  const handleRefresh = () => {
    // Check if interview has started
    if (interview?.timeSlot?.start) {
      const now = new Date()
      const startTime = new Date(interview.timeSlot.start)
      
      if (now >= startTime) {
        setShowWaitingRoom(false)
        handleSubmit(new Event('submit') as any)
      } else {
        const startTimeMs = startTime.getTime()
        const nowMs = now.getTime()
        const timeUntilStart = Math.ceil((startTimeMs - nowMs) / 1000)
        setTimeUntilStart(timeUntilStart)
      }
    }
  }

  if (showWaitingRoom && interview) {
    return (
      <WaitingRoom
        interview={{
          id: interview.id,
          title: interview.title,
          scheduledStartTime: interview.timeSlot?.start,
          scheduledEndTime: interview.timeSlot?.end,
          duration: interview.duration
        }}
        timeUntilStart={timeUntilStart}
        onInterviewStart={handleInterviewStart}
        onRefresh={handleRefresh}
      />
    )
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-indigo-50 to-purple-50 flex items-center justify-center p-4">
      <div className="max-w-md w-full">
        <Card className="shadow-xl border-0 bg-white/80 backdrop-blur-sm">
          <CardHeader className="text-center pb-6">
            <div className="w-16 h-16 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-full flex items-center justify-center mx-auto mb-4">
              <Lock className="h-8 w-8 text-white" />
            </div>
            <CardTitle className="text-2xl font-bold text-gray-900">
              Enter Interview
            </CardTitle>
            <p className="text-gray-600 mt-2">
              Please enter the interview password to continue
            </p>
          </CardHeader>

          <CardContent>
            {interview && (
              <div className="bg-blue-50 rounded-xl p-4 mb-6 border border-blue-200">
                <h3 className="text-lg font-semibold text-gray-900 mb-3 flex items-center">
                  <Calendar className="h-5 w-5 mr-2 text-blue-600" />
                  Interview Details
                </h3>
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-gray-600">Title:</span>
                    <span className="text-gray-900 font-medium">{interview.title}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600">Duration:</span>
                    <span className="text-gray-900 font-medium">{interview.duration} minutes</span>
                  </div>
                  {interview.timeSlot && (
                    <>
                      <div className="flex justify-between">
                        <span className="text-gray-600">Start:</span>
                        <span className="text-gray-900 font-medium">
                          {new Date(interview.timeSlot.start).toLocaleString()}
                        </span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-gray-600">End:</span>
                        <span className="text-gray-900 font-medium">
                          {new Date(interview.timeSlot.end).toLocaleString()}
                        </span>
                      </div>
                    </>
                  )}
                </div>
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-6">
              <div className="space-y-2">
                <Label htmlFor="password" className="text-sm font-medium text-gray-700">
                  Interview Password
                </Label>
                <div className="relative">
                  <Input
                    id="password"
                    type={showPassword ? 'text' : 'password'}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="Enter interview password"
                    className="pr-10"
                    required
                    disabled={loading}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                    disabled={loading}
                  >
                    {showPassword ? (
                      <EyeOff className="h-4 w-4" />
                    ) : (
                      <Eye className="h-4 w-4" />
                    )}
                  </button>
                </div>
              </div>

              <Button
                type="submit"
                className="w-full bg-gradient-to-r from-blue-500 to-indigo-600 hover:from-blue-600 hover:to-indigo-700 text-white shadow-lg hover:shadow-xl transition-all duration-200"
                disabled={loading || !password.trim()}
              >
                {loading ? (
                  <>
                    <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin mr-2"></div>
                    Verifying...
                  </>
                ) : (
                  <>
                    <Lock className="h-4 w-4 mr-2" />
                    Enter Interview
                  </>
                )}
              </Button>
            </form>

            <div className="mt-6 text-center">
              <Badge 
                variant="outline" 
                className="bg-green-100 text-green-800 border-green-200 px-3 py-1"
              >
                <CheckCircle className="h-4 w-4 mr-1" />
                Secure Entry Required
              </Badge>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}