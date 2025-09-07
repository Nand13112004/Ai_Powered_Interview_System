'use client'

import { useState, useEffect } from 'react'
import { useAuth } from '@/contexts/AuthContext'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Badge } from '@/components/ui/badge'
import { Progress } from '@/components/ui/progress'
import { 
  Brain, 
  Mic, 
  BarChart3, 
  Clock, 
  Play, 
  History, 
  Settings, 
  LogOut,
  User,
  Calendar,
  TrendingUp
} from 'lucide-react'
import { toast } from 'react-hot-toast'
import { api } from '@/lib/api'
import InterviewRoom from './InterviewRoom'
import SessionHistory from './SessionHistory'
import Analytics from './Analytics'

interface Interview {
  id: string
  title: string
  description: string
  role: string
  level: string
  duration: number
  createdAt: string
}

interface Session {
  id: string
  status: string
  startedAt: string
  completedAt?: string
  duration?: number
  interview: Interview
  scores?: any
  feedback?: any
}

export default function Dashboard() {
  const { user, logout } = useAuth()
  const [interviews, setInterviews] = useState<Interview[]>([])
  const [sessions, setSessions] = useState<Session[]>([])
  const [loading, setLoading] = useState(true)
  const [activeTab, setActiveTab] = useState('overview')
  const [selectedInterview, setSelectedInterview] = useState<Interview | null>(null)

  useEffect(() => {
    fetchData()
  }, [])

  const fetchData = async () => {
    try {
      const [interviewsRes, sessionsRes] = await Promise.all([
        api.get('/interviews'),
        api.get('/sessions')
      ])
      
      setInterviews(interviewsRes.data.interviews)
      setSessions(sessionsRes.data.sessions)
    } catch (error) {
      console.error('Error fetching data:', error)
      toast.error('Failed to load dashboard data')
    } finally {
      setLoading(false)
    }
  }

  const startInterview = async (interview: Interview) => {
    try {
      const response = await api.post('/sessions', {
        interviewId: interview.id
      })
      
      setSelectedInterview(interview)
      setActiveTab('interview')
      toast.success('Interview session started!')
    } catch (error: any) {
      toast.error(error.response?.data?.error || 'Failed to start interview')
    }
  }

  const handleLogout = () => {
    logout()
    toast.success('Logged out successfully')
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-blue-600"></div>
      </div>
    )
  }

  const completedSessions = sessions.filter(s => s.status === 'completed')
  const totalPracticeTime = completedSessions.reduce((acc, s) => acc + (s.duration || 0), 0)
  const averageScore = completedSessions.length > 0 
    ? completedSessions.reduce((acc, s) => acc + (s.scores?.overall || 0), 0) / completedSessions.length
    : 0

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white shadow-sm border-b">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-4">
              <Brain className="h-8 w-8 text-blue-600" />
              <h1 className="text-2xl font-bold text-gray-900">AI Interview Platform</h1>
            </div>
            <div className="flex items-center space-x-4">
              <div className="flex items-center space-x-2">
                <User className="h-5 w-5 text-gray-500" />
                <span className="text-sm text-gray-700">{user?.name}</span>
                <Badge variant="secondary">{user?.role}</Badge>
              </div>
              <Button variant="outline" size="sm" onClick={handleLogout}>
                <LogOut className="h-4 w-4 mr-2" />
                Logout
              </Button>
            </div>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 py-8">
        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <TabsList className="grid w-full grid-cols-4">
            <TabsTrigger value="overview">Overview</TabsTrigger>
            <TabsTrigger value="interview">Interview</TabsTrigger>
            <TabsTrigger value="history">History</TabsTrigger>
            <TabsTrigger value="analytics">Analytics</TabsTrigger>
          </TabsList>

          <TabsContent value="overview" className="space-y-6">
            {/* Stats Cards */}
            <div className="grid md:grid-cols-4 gap-6">
              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Total Sessions</CardTitle>
                  <History className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{sessions.length}</div>
                  <p className="text-xs text-muted-foreground">
                    {completedSessions.length} completed
                  </p>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Practice Time</CardTitle>
                  <Clock className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{totalPracticeTime}m</div>
                  <p className="text-xs text-muted-foreground">
                    Total interview time
                  </p>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Average Score</CardTitle>
                  <TrendingUp className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{averageScore.toFixed(1)}/10</div>
                  <p className="text-xs text-muted-foreground">
                    Based on {completedSessions.length} sessions
                  </p>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Available Interviews</CardTitle>
                  <Brain className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{interviews.length}</div>
                  <p className="text-xs text-muted-foreground">
                    Ready to practice
                  </p>
                </CardContent>
              </Card>
            </div>

            {/* Available Interviews */}
            <div>
              <h2 className="text-2xl font-bold mb-6">Available Interviews</h2>
              <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
                {interviews.map((interview) => (
                  <Card key={interview.id} className="hover:shadow-lg transition-shadow">
                    <CardHeader>
                      <CardTitle className="flex items-center justify-between">
                        {interview.title}
                        <Badge variant="outline">{interview.level}</Badge>
                      </CardTitle>
                      <CardDescription>{interview.description}</CardDescription>
                    </CardHeader>
                    <CardContent>
                      <div className="space-y-2 mb-4">
                        <div className="flex items-center text-sm text-gray-600">
                          <User className="h-4 w-4 mr-2" />
                          {interview.role}
                        </div>
                        <div className="flex items-center text-sm text-gray-600">
                          <Clock className="h-4 w-4 mr-2" />
                          {interview.duration} minutes
                        </div>
                      </div>
                      <Button 
                        onClick={() => startInterview(interview)}
                        className="w-full"
                      >
                        <Play className="h-4 w-4 mr-2" />
                        Start Interview
                      </Button>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </div>

            {/* Recent Sessions */}
            {sessions.length > 0 && (
              <div>
                <h2 className="text-2xl font-bold mb-6">Recent Sessions</h2>
                <div className="space-y-4">
                  {sessions.slice(0, 5).map((session) => (
                    <Card key={session.id}>
                      <CardContent className="p-4">
                        <div className="flex items-center justify-between">
                          <div>
                            <h3 className="font-semibold">{session.interview.title}</h3>
                            <p className="text-sm text-gray-600">
                              {new Date(session.startedAt).toLocaleDateString()}
                            </p>
                          </div>
                          <div className="flex items-center space-x-4">
                            <Badge 
                              variant={session.status === 'completed' ? 'default' : 'secondary'}
                            >
                              {session.status}
                            </Badge>
                            {session.duration && (
                              <span className="text-sm text-gray-600">
                                {session.duration}m
                              </span>
                            )}
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              </div>
            )}
          </TabsContent>

          <TabsContent value="interview">
            {selectedInterview ? (
              <InterviewRoom 
                interview={selectedInterview}
                onComplete={() => {
                  setSelectedInterview(null)
                  setActiveTab('overview')
                  fetchData() // Refresh data
                }}
              />
            ) : (
              <div className="text-center py-12">
                <Brain className="h-16 w-16 text-gray-400 mx-auto mb-4" />
                <h3 className="text-xl font-semibold text-gray-900 mb-2">
                  No Active Interview
                </h3>
                <p className="text-gray-600 mb-6">
                  Select an interview from the overview tab to get started
                </p>
                <Button onClick={() => setActiveTab('overview')}>
                  Browse Interviews
                </Button>
              </div>
            )}
          </TabsContent>

          <TabsContent value="history">
            <SessionHistory sessions={sessions} />
          </TabsContent>

          <TabsContent value="analytics">
            <Analytics sessions={sessions} />
          </TabsContent>
        </Tabs>
      </main>
    </div>
  )
}
