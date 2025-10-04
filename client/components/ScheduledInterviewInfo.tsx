'use client'

import { useState, useEffect } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Clock, Calendar, AlertCircle, CheckCircle } from 'lucide-react'

interface ScheduledInterviewInfoProps {
  interview: {
    id: string
    title: string
    scheduledStartTime: string
    scheduledEndTime: string
    timeZone: string
    duration: number
  }
  onJoinInterview: () => void
}

export default function ScheduledInterviewInfo({ interview, onJoinInterview }: ScheduledInterviewInfoProps) {
  const [currentTime, setCurrentTime] = useState(new Date())
  const [timeStatus, setTimeStatus] = useState<'upcoming' | 'active' | 'ended'>('upcoming')
  const [timeUntilStart, setTimeUntilStart] = useState(0)
  const [timeSinceEnd, setTimeSinceEnd] = useState(0)

  useEffect(() => {
    const interval = setInterval(() => {
      setCurrentTime(new Date())
    }, 1000)

    return () => clearInterval(interval)
  }, [])

  useEffect(() => {
    const startTime = new Date(interview.scheduledStartTime)
    const endTime = new Date(interview.scheduledEndTime)
    const now = currentTime

    if (now < startTime) {
      setTimeStatus('upcoming')
      setTimeUntilStart(Math.ceil((startTime.getTime() - now.getTime()) / (1000 * 60)))
    } else if (now >= startTime && now <= endTime) {
      setTimeStatus('active')
    } else {
      setTimeStatus('ended')
      setTimeSinceEnd(Math.ceil((now.getTime() - endTime.getTime()) / (1000 * 60)))
    }
  }, [currentTime, interview.scheduledStartTime, interview.scheduledEndTime])

  const formatDateTime = (dateString: string) => {
    return new Date(dateString).toLocaleString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      timeZoneName: 'short'
    })
  }

  const getStatusIcon = () => {
    switch (timeStatus) {
      case 'upcoming':
        return <Clock className="h-5 w-5 text-blue-500" />
      case 'active':
        return <CheckCircle className="h-5 w-5 text-green-500" />
      case 'ended':
        return <AlertCircle className="h-5 w-5 text-red-500" />
    }
  }

  const getStatusColor = () => {
    switch (timeStatus) {
      case 'upcoming':
        return 'bg-blue-100 text-blue-800'
      case 'active':
        return 'bg-green-100 text-green-800'
      case 'ended':
        return 'bg-red-100 text-red-800'
    }
  }

  const getStatusText = () => {
    switch (timeStatus) {
      case 'upcoming':
        return `Starts in ${timeUntilStart} minutes`
      case 'active':
        return 'Interview is now active'
      case 'ended':
        return `Ended ${timeSinceEnd} minutes ago`
    }
  }

  return (
    <Card className="w-full max-w-2xl mx-auto">
      <CardHeader>
        <CardTitle className="flex items-center justify-between">
          <span>{interview.title}</span>
          <Badge className={getStatusColor()}>
            {getStatusText()}
          </Badge>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex items-center space-x-2">
          {getStatusIcon()}
          <span className="font-medium">Interview Status</span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="flex items-center space-x-2">
            <Calendar className="h-4 w-4 text-gray-500" />
            <div>
              <p className="text-sm font-medium">Start Time</p>
              <p className="text-xs text-gray-600">
                {formatDateTime(interview.scheduledStartTime)}
              </p>
            </div>
          </div>

          <div className="flex items-center space-x-2">
            <Calendar className="h-4 w-4 text-gray-500" />
            <div>
              <p className="text-sm font-medium">End Time</p>
              <p className="text-xs text-gray-600">
                {formatDateTime(interview.scheduledEndTime)}
              </p>
            </div>
          </div>
        </div>

        <div className="flex items-center space-x-2">
          <Clock className="h-4 w-4 text-gray-500" />
          <div>
            <p className="text-sm font-medium">Duration</p>
            <p className="text-xs text-gray-600">{interview.duration} minutes</p>
          </div>
        </div>

        {timeStatus === 'active' && (
          <div className="bg-green-50 border border-green-200 rounded-lg p-4">
            <div className="flex items-center space-x-2">
              <CheckCircle className="h-5 w-5 text-green-500" />
              <div>
                <p className="font-medium text-green-800">Ready to Start</p>
                <p className="text-sm text-green-600">
                  The interview is now active. You can join when ready.
                </p>
              </div>
            </div>
            <Button 
              onClick={onJoinInterview}
              className="mt-3 w-full bg-green-600 hover:bg-green-700"
            >
              Join Interview
            </Button>
          </div>
        )}

        {timeStatus === 'upcoming' && (
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
            <div className="flex items-center space-x-2">
              <Clock className="h-5 w-5 text-blue-500" />
              <div>
                <p className="font-medium text-blue-800">Interview Not Started</p>
                <p className="text-sm text-blue-600">
                  Please wait for the scheduled start time to join the interview.
                </p>
              </div>
            </div>
          </div>
        )}

        {timeStatus === 'ended' && (
          <div className="bg-red-50 border border-red-200 rounded-lg p-4">
            <div className="flex items-center space-x-2">
              <AlertCircle className="h-5 w-5 text-red-500" />
              <div>
                <p className="font-medium text-red-800">Interview Ended</p>
                <p className="text-sm text-red-600">
                  The scheduled interview time has ended.
                </p>
              </div>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
