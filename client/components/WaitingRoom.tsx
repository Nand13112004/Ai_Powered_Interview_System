'use client'

import { useState, useEffect } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Clock, Users, Calendar, AlertCircle, CheckCircle } from 'lucide-react'
import { toast } from 'react-hot-toast'

interface WaitingRoomProps {
  interview: {
    id: string
    title: string
    scheduledStartTime: string
    scheduledEndTime: string
    duration: number
  }
  timeUntilStart: number
  onInterviewStart: () => void
  onRefresh: () => void
}

export default function WaitingRoom({ 
  interview, 
  timeUntilStart, 
  onInterviewStart, 
  onRefresh 
}: WaitingRoomProps) {
  const [timeRemaining, setTimeRemaining] = useState(timeUntilStart)
  const [isAutoRefresh, setIsAutoRefresh] = useState(true)

  useEffect(() => {
    if (timeRemaining <= 0) {
      toast.success('Interview is now starting!')
      onInterviewStart()
      return
    }

    const interval = setInterval(() => {
      setTimeRemaining(prev => {
        if (prev <= 1) {
          clearInterval(interval)
          toast.success('Interview is now starting!')
          onInterviewStart()
          return 0
        }
        return prev - 1
      })
    }, 1000)

    return () => clearInterval(interval)
  }, [timeRemaining, onInterviewStart])

  const formatTime = (seconds: number) => {
    const hours = Math.floor(seconds / 3600)
    const minutes = Math.floor((seconds % 3600) / 60)
    const secs = seconds % 60

    if (hours > 0) {
      return `${hours}h ${minutes}m ${secs}s`
    } else if (minutes > 0) {
      return `${minutes}m ${secs}s`
    } else {
      return `${secs}s`
    }
  }

  const startTime = new Date(interview.scheduledStartTime)
  const endTime = new Date(interview.scheduledEndTime)

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-indigo-50 to-purple-50 flex items-center justify-center p-4">
      <div className="max-w-2xl w-full">
        <Card className="shadow-xl border-0 bg-white/80 backdrop-blur-sm">
          <CardHeader className="text-center pb-6">
            <div className="w-16 h-16 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-full flex items-center justify-center mx-auto mb-4">
              <Clock className="h-8 w-8 text-white" />
            </div>
            <CardTitle className="text-2xl font-bold text-gray-900">
              Interview Waiting Room
            </CardTitle>
            <p className="text-gray-600 mt-2">
              Please wait for the interview to begin
            </p>
          </CardHeader>

          <CardContent className="space-y-6">
            {/* Interview Details */}
            <div className="bg-gradient-to-r from-blue-50 to-indigo-50 rounded-xl p-6 border border-blue-200">
              <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center">
                <Calendar className="h-5 w-5 mr-2 text-blue-600" />
                Interview Details
              </h3>
              <div className="space-y-3">
                <div className="flex justify-between items-center">
                  <span className="text-gray-600 font-medium">Interview:</span>
                  <span className="text-gray-900 font-semibold">{interview.title}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-gray-600 font-medium">Duration:</span>
                  <span className="text-gray-900 font-semibold">{interview.duration} minutes</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-gray-600 font-medium">Start Time:</span>
                  <span className="text-gray-900 font-semibold">
                    {startTime.toLocaleString()}
                  </span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-gray-600 font-medium">End Time:</span>
                  <span className="text-gray-900 font-semibold">
                    {endTime.toLocaleString()}
                  </span>
                </div>
              </div>
            </div>

            {/* Countdown Timer */}
            <div className="text-center">
              <div className="bg-gradient-to-r from-green-50 to-emerald-50 rounded-xl p-8 border border-green-200">
                <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center justify-center">
                  <Clock className="h-5 w-5 mr-2 text-green-600" />
                  Time Until Interview Starts
                </h3>
                
                {timeRemaining > 0 ? (
                  <div className="space-y-4">
                    <div className="text-4xl font-bold text-green-600">
                      {formatTime(timeRemaining)}
                    </div>
                    <div className="text-sm text-gray-600">
                      The interview will start automatically when the time comes
                    </div>
                  </div>
                ) : (
                  <div className="space-y-4">
                    <div className="text-4xl font-bold text-green-600 flex items-center justify-center">
                      <CheckCircle className="h-12 w-12 mr-2" />
                      Starting Now!
                    </div>
                    <div className="text-sm text-gray-600">
                      Redirecting to interview room...
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Instructions */}
            <div className="bg-yellow-50 rounded-xl p-6 border border-yellow-200">
              <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center">
                <AlertCircle className="h-5 w-5 mr-2 text-yellow-600" />
                Important Instructions
              </h3>
              <ul className="space-y-2 text-sm text-gray-700">
                <li className="flex items-start">
                  <span className="w-2 h-2 bg-yellow-500 rounded-full mt-2 mr-3 flex-shrink-0"></span>
                  Ensure you have a stable internet connection
                </li>
                <li className="flex items-start">
                  <span className="w-2 h-2 bg-yellow-500 rounded-full mt-2 mr-3 flex-shrink-0"></span>
                  Test your camera and microphone before the interview starts
                </li>
                <li className="flex items-start">
                  <span className="w-2 h-2 bg-yellow-500 rounded-full mt-2 mr-3 flex-shrink-0"></span>
                  Find a quiet, well-lit environment
                </li>
                <li className="flex items-start">
                  <span className="w-2 h-2 bg-yellow-500 rounded-full mt-2 mr-3 flex-shrink-0"></span>
                  Keep your ID ready for verification
                </li>
                <li className="flex items-start">
                  <span className="w-2 h-2 bg-yellow-500 rounded-full mt-2 mr-3 flex-shrink-0"></span>
                  Do not refresh or close this page
                </li>
              </ul>
            </div>

            {/* Auto-refresh Toggle */}
            <div className="flex items-center justify-between bg-gray-50 rounded-xl p-4">
              <div className="flex items-center space-x-3">
                <input
                  type="checkbox"
                  id="autoRefresh"
                  checked={isAutoRefresh}
                  onChange={(e) => setIsAutoRefresh(e.target.checked)}
                  className="w-4 h-4 text-blue-600 bg-gray-100 border-gray-300 rounded focus:ring-blue-500"
                />
                <label htmlFor="autoRefresh" className="text-sm font-medium text-gray-700">
                  Auto-refresh when interview starts
                </label>
              </div>
              <Button
                onClick={onRefresh}
                variant="outline"
                size="sm"
                className="text-blue-600 border-blue-200 hover:bg-blue-50"
              >
                Refresh Now
              </Button>
            </div>

            {/* Status Badge */}
            <div className="text-center">
              <Badge 
                variant="outline" 
                className="bg-blue-100 text-blue-800 border-blue-200 px-4 py-2"
              >
                <Clock className="h-4 w-4 mr-2" />
                Waiting for Interview to Start
              </Badge>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
