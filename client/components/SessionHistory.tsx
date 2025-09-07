'use client'

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { 
  Calendar, 
  Clock, 
  TrendingUp, 
  Download,
  Eye,
  MessageSquare
} from 'lucide-react'
import { useState } from 'react'

interface Session {
  id: string
  status: string
  startedAt: string
  completedAt?: string
  duration?: number
  interview: {
    id: string
    title: string
    role: string
    level: string
    duration: number
  }
  scores?: {
    overall: number
    communication: number
    technical: number
    problemSolving: number
  }
  feedback?: {
    strengths: string[]
    improvements: string[]
    summary: string
  }
}

interface SessionHistoryProps {
  sessions: Session[]
}

export default function SessionHistory({ sessions }: SessionHistoryProps) {
  const [selectedSession, setSelectedSession] = useState<Session | null>(null)

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'completed':
        return 'default'
      case 'in_progress':
        return 'secondary'
      case 'cancelled':
        return 'destructive'
      default:
        return 'outline'
    }
  }

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    })
  }

  const exportSession = (session: Session) => {
    const data = {
      session: {
        id: session.id,
        interview: session.interview,
        duration: session.duration,
        completedAt: session.completedAt
      },
      scores: session.scores,
      feedback: session.feedback
    }

    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `interview-session-${session.id}.json`
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(url)
  }

  if (sessions.length === 0) {
    return (
      <div className="text-center py-12">
        <MessageSquare className="h-16 w-16 text-gray-400 mx-auto mb-4" />
        <h3 className="text-xl font-semibold text-gray-900 mb-2">
          No Interview Sessions Yet
        </h3>
        <p className="text-gray-600">
          Start your first interview to see your session history here.
        </p>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold">Session History</h2>
        <Badge variant="outline">{sessions.length} total sessions</Badge>
      </div>

      <div className="grid gap-6">
        {sessions.map((session) => (
          <Card key={session.id} className="hover:shadow-lg transition-shadow">
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="flex items-center space-x-2">
                    <span>{session.interview.title}</span>
                    <Badge variant={getStatusColor(session.status)}>
                      {session.status}
                    </Badge>
                  </CardTitle>
                  <p className="text-sm text-gray-600 mt-1">
                    {session.interview.role} • {session.interview.level}
                  </p>
                </div>
                <div className="flex space-x-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setSelectedSession(session)}
                  >
                    <Eye className="h-4 w-4 mr-2" />
                    View Details
                  </Button>
                  {session.status === 'completed' && (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => exportSession(session)}
                    >
                      <Download className="h-4 w-4 mr-2" />
                      Export
                    </Button>
                  )}
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <div className="grid md:grid-cols-4 gap-4">
                <div className="flex items-center space-x-2">
                  <Calendar className="h-4 w-4 text-gray-500" />
                  <div>
                    <p className="text-sm font-medium">Started</p>
                    <p className="text-xs text-gray-600">
                      {formatDate(session.startedAt)}
                    </p>
                  </div>
                </div>

                {session.completedAt && (
                  <div className="flex items-center space-x-2">
                    <Calendar className="h-4 w-4 text-gray-500" />
                    <div>
                      <p className="text-sm font-medium">Completed</p>
                      <p className="text-xs text-gray-600">
                        {formatDate(session.completedAt)}
                      </p>
                    </div>
                  </div>
                )}

                {session.duration && (
                  <div className="flex items-center space-x-2">
                    <Clock className="h-4 w-4 text-gray-500" />
                    <div>
                      <p className="text-sm font-medium">Duration</p>
                      <p className="text-xs text-gray-600">
                        {session.duration} minutes
                      </p>
                    </div>
                  </div>
                )}

                {session.scores && (
                  <div className="flex items-center space-x-2">
                    <TrendingUp className="h-4 w-4 text-gray-500" />
                    <div>
                      <p className="text-sm font-medium">Overall Score</p>
                      <p className="text-xs text-gray-600">
                        {session.scores.overall}/10
                      </p>
                    </div>
                  </div>
                )}
              </div>

              {session.scores && (
                <div className="mt-4 p-4 bg-gray-50 rounded-lg">
                  <h4 className="font-medium mb-2">Scores Breakdown</h4>
                  <div className="grid grid-cols-3 gap-4 text-sm">
                    <div>
                      <span className="text-gray-600">Communication:</span>
                      <span className="ml-2 font-medium">{session.scores.communication}/10</span>
                    </div>
                    <div>
                      <span className="text-gray-600">Technical:</span>
                      <span className="ml-2 font-medium">{session.scores.technical}/10</span>
                    </div>
                    <div>
                      <span className="text-gray-600">Problem Solving:</span>
                      <span className="ml-2 font-medium">{session.scores.problemSolving}/10</span>
                    </div>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Session Details Modal */}
      {selectedSession && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <Card className="w-full max-w-2xl max-h-[80vh] overflow-y-auto">
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle>Session Details</CardTitle>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setSelectedSession(null)}
                >
                  Close
                </Button>
              </div>
            </CardHeader>
            <CardContent className="space-y-6">
              <div>
                <h3 className="font-semibold mb-2">Interview Information</h3>
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <span className="text-gray-600">Title:</span>
                    <span className="ml-2">{selectedSession.interview.title}</span>
                  </div>
                  <div>
                    <span className="text-gray-600">Role:</span>
                    <span className="ml-2">{selectedSession.interview.role}</span>
                  </div>
                  <div>
                    <span className="text-gray-600">Level:</span>
                    <span className="ml-2">{selectedSession.interview.level}</span>
                  </div>
                  <div>
                    <span className="text-gray-600">Duration:</span>
                    <span className="ml-2">{selectedSession.duration} minutes</span>
                  </div>
                </div>
              </div>

              {selectedSession.scores && (
                <div>
                  <h3 className="font-semibold mb-2">Scores</h3>
                  <div className="space-y-2">
                    <div className="flex justify-between">
                      <span>Overall Score:</span>
                      <span className="font-medium">{selectedSession.scores.overall}/10</span>
                    </div>
                    <div className="flex justify-between">
                      <span>Communication:</span>
                      <span className="font-medium">{selectedSession.scores.communication}/10</span>
                    </div>
                    <div className="flex justify-between">
                      <span>Technical Knowledge:</span>
                      <span className="font-medium">{selectedSession.scores.technical}/10</span>
                    </div>
                    <div className="flex justify-between">
                      <span>Problem Solving:</span>
                      <span className="font-medium">{selectedSession.scores.problemSolving}/10</span>
                    </div>
                  </div>
                </div>
              )}

              {selectedSession.feedback && (
                <div>
                  <h3 className="font-semibold mb-2">Feedback</h3>
                  <div className="space-y-4">
                    <div>
                      <h4 className="font-medium text-green-600 mb-1">Strengths</h4>
                      <ul className="list-disc list-inside text-sm text-gray-600">
                        {selectedSession.feedback.strengths.map((strength, index) => (
                          <li key={index}>{strength}</li>
                        ))}
                      </ul>
                    </div>
                    <div>
                      <h4 className="font-medium text-orange-600 mb-1">Areas for Improvement</h4>
                      <ul className="list-disc list-inside text-sm text-gray-600">
                        {selectedSession.feedback.improvements.map((improvement, index) => (
                          <li key={index}>{improvement}</li>
                        ))}
                      </ul>
                    </div>
                    <div>
                      <h4 className="font-medium mb-1">Summary</h4>
                      <p className="text-sm text-gray-600">{selectedSession.feedback.summary}</p>
                    </div>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  )
}
