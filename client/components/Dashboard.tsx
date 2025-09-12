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
import { useRouter } from 'next/navigation'
import SessionHistory from './SessionHistory'
import Analytics from './Analytics'

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
  createdAt: string
  questions?: Question[]
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
  const router = useRouter()
  const [interviews, setInterviews] = useState<Interview[]>([])
  const [sessions, setSessions] = useState<Session[]>([])
  const [loading, setLoading] = useState(true)
  const [activeTab, setActiveTab] = useState('overview')

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
      router.push(`/interviewroom/${interview.id}`)
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
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-100">
      {/* Header */}
      <header className="bg-white/80 backdrop-blur-sm border-b border-gray-200/50 sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-4 py-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-4">
              <div className="w-12 h-12 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-xl flex items-center justify-center shadow-lg">
                <Brain className="h-6 w-6 text-white" />
              </div>
              <div>
                <h1 className="text-2xl font-bold text-gray-900">AI Interview Platform</h1>
                <p className="text-gray-600">Welcome back, {user?.name || user?.email}!</p>
              </div>
            </div>
            <div className="flex items-center space-x-4">
              <div className="flex items-center space-x-3 px-4 py-2 bg-gray-50 rounded-xl">
                <User className="h-5 w-5 text-gray-500" />
                <span className="text-sm font-medium text-gray-700">{user?.name}</span>
                <Badge className="bg-blue-100 text-blue-800 border-blue-200">{user?.role}</Badge>
              </div>
              <Button 
                variant="outline" 
                size="sm" 
                onClick={handleLogout}
                className="border-gray-300 hover:bg-gray-50 transition-colors duration-200"
              >
                <LogOut className="h-4 w-4 mr-2" />
                Logout
              </Button>
            </div>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 py-8">
        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <TabsList className="grid w-full grid-cols-3 rounded-xl bg-white/70 backdrop-blur p-1 shadow-sm">
            <TabsTrigger value="overview">Overview</TabsTrigger>
            <TabsTrigger value="history">History</TabsTrigger>
            <TabsTrigger value="analytics">Analytics</TabsTrigger>
          </TabsList>

          <TabsContent value="overview" className="space-y-6">
            {/* Stats Cards */}
            <div className="grid md:grid-cols-4 gap-6">
              <Card className="rounded-2xl border-gray-200/60 shadow-md hover:shadow-lg transition-shadow">
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

              <Card className="rounded-2xl border-gray-200/60 shadow-md hover:shadow-lg transition-shadow">
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

              <Card className="rounded-2xl border-gray-200/60 shadow-md hover:shadow-lg transition-shadow">
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

              <Card className="rounded-2xl border-gray-200/60 shadow-md hover:shadow-lg transition-shadow">
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
                  <Card key={interview.id} className="rounded-2xl border-gray-200/60 hover:shadow-lg transition-shadow">
                    <CardHeader>
                      <CardTitle className="flex items-center justify-between">
                        {interview.title}
                        <div className="flex gap-2">
                          <Badge variant="outline">{interview.level}</Badge>
                          {(() => {
                            const attemptedSession = sessions.find(s => s.interview.id === interview.id);
                            const isAttempted = attemptedSession && attemptedSession.status === 'completed';
                            return isAttempted ? (
                              <Badge variant="secondary">Completed</Badge>
                            ) : null;
                          })()}
                        </div>
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
                      {(() => {
                        const attemptedSession = sessions.find(s => s.interview.id === interview.id);
                        const isAttempted = attemptedSession && attemptedSession.status === 'completed';
                        
                        return (
                          <Button 
                            onClick={() => startInterview(interview)}
                            className="w-full rounded-xl"
                            disabled={isAttempted}
                            variant={isAttempted ? "secondary" : "default"}
                          >
                            <Play className="h-4 w-4 mr-2" />
                            {isAttempted ? 'Already Completed' : 'Start Interview'}
                          </Button>
                        );
                      })()}
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
                    <Card key={session.id} className="rounded-2xl border-gray-200/60 hover:shadow-md transition-shadow">
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
