'use client'

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer,
  LineChart,
  Line,
  PieChart,
  Pie,
  Cell
} from 'recharts'
import { 
  TrendingUp, 
  TrendingDown, 
  Target, 
  Clock,
  Award,
  MessageSquare
} from 'lucide-react'

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
}

interface AnalyticsProps {
  sessions: Session[]
}

export default function Analytics({ sessions }: AnalyticsProps) {
  const completedSessions = sessions.filter(s => s.status === 'completed')
  
  // Calculate statistics
  const totalSessions = sessions.length
  const totalPracticeTime = completedSessions.reduce((acc, s) => acc + (s.duration || 0), 0)
  const averageScore = completedSessions.length > 0 
    ? completedSessions.reduce((acc, s) => acc + (s.scores?.overall || 0), 0) / completedSessions.length
    : 0
  
  const averageCommunication = completedSessions.length > 0
    ? completedSessions.reduce((acc, s) => acc + (s.scores?.communication || 0), 0) / completedSessions.length
    : 0
    
  const averageTechnical = completedSessions.length > 0
    ? completedSessions.reduce((acc, s) => acc + (s.scores?.technical || 0), 0) / completedSessions.length
    : 0
    
  const averageProblemSolving = completedSessions.length > 0
    ? completedSessions.reduce((acc, s) => acc + (s.scores?.problemSolving || 0), 0) / completedSessions.length
    : 0

  // Prepare data for charts
  const scoreTrendData = completedSessions
    .sort((a, b) => new Date(a.startedAt).getTime() - new Date(b.startedAt).getTime())
    .map((session, index) => ({
      session: `Session ${index + 1}`,
      overall: session.scores?.overall || 0,
      communication: session.scores?.communication || 0,
      technical: session.scores?.technical || 0,
      problemSolving: session.scores?.problemSolving || 0
    }))

  const skillBreakdownData = [
    { name: 'Communication', value: averageCommunication, color: '#3B82F6' },
    { name: 'Technical', value: averageTechnical, color: '#10B981' },
    { name: 'Problem Solving', value: averageProblemSolving, color: '#F59E0B' }
  ]

  const roleDistribution = sessions.reduce((acc, session) => {
    const role = session.interview.role
    acc[role] = (acc[role] || 0) + 1
    return acc
  }, {} as Record<string, number>)

  const roleData = Object.entries(roleDistribution).map(([role, count]) => ({
    name: role,
    value: count
  }))

  const levelDistribution = sessions.reduce((acc, session) => {
    const level = session.interview.level
    acc[level] = (acc[level] || 0) + 1
    return acc
  }, {} as Record<string, number>)

  const levelData = Object.entries(levelDistribution).map(([level, count]) => ({
    name: level,
    value: count
  }))

  if (sessions.length === 0) {
    return (
      <div className="text-center py-12">
        <BarChart className="h-16 w-16 text-gray-400 mx-auto mb-4" />
        <h3 className="text-xl font-semibold text-gray-900 mb-2">
          No Data Available
        </h3>
        <p className="text-gray-600">
          Complete some interviews to see your analytics here.
        </p>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold">Analytics Dashboard</h2>
        <Badge variant="outline">{totalSessions} total sessions</Badge>
      </div>

      {/* Key Metrics */}
      <div className="grid md:grid-cols-4 gap-6">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Average Score</CardTitle>
            <Award className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{averageScore.toFixed(1)}/10</div>
            <p className="text-xs text-muted-foreground">
              Based on {completedSessions.length} completed sessions
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Practice Time</CardTitle>
            <Clock className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{totalPracticeTime}m</div>
            <p className="text-xs text-muted-foreground">
              {Math.round(totalPracticeTime / 60)} hours total
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Completion Rate</CardTitle>
            <Target className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {totalSessions > 0 ? Math.round((completedSessions.length / totalSessions) * 100) : 0}%
            </div>
            <p className="text-xs text-muted-foreground">
              {completedSessions.length} of {totalSessions} sessions
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Sessions This Month</CardTitle>
            <MessageSquare className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {sessions.filter(s => {
                const sessionDate = new Date(s.startedAt)
                const now = new Date()
                return sessionDate.getMonth() === now.getMonth() && 
                       sessionDate.getFullYear() === now.getFullYear()
              }).length}
            </div>
            <p className="text-xs text-muted-foreground">
              Current month
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Charts */}
      <div className="grid lg:grid-cols-2 gap-6">
        {/* Score Trend */}
        {scoreTrendData.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle>Score Trend Over Time</CardTitle>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={300}>
                <LineChart data={scoreTrendData}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="session" />
                  <YAxis domain={[0, 10]} />
                  <Tooltip />
                  <Line 
                    type="monotone" 
                    dataKey="overall" 
                    stroke="#3B82F6" 
                    strokeWidth={2}
                    name="Overall Score"
                  />
                  <Line 
                    type="monotone" 
                    dataKey="communication" 
                    stroke="#10B981" 
                    strokeWidth={2}
                    name="Communication"
                  />
                  <Line 
                    type="monotone" 
                    dataKey="technical" 
                    stroke="#F59E0B" 
                    strokeWidth={2}
                    name="Technical"
                  />
                  <Line 
                    type="monotone" 
                    dataKey="problemSolving" 
                    stroke="#EF4444" 
                    strokeWidth={2}
                    name="Problem Solving"
                  />
                </LineChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        )}

        {/* Skill Breakdown */}
        <Card>
          <CardHeader>
            <CardTitle>Average Skills Breakdown</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={skillBreakdownData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="name" />
                <YAxis domain={[0, 10]} />
                <Tooltip />
                <Bar dataKey="value" fill="#3B82F6" />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        {/* Role Distribution */}
        {roleData.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle>Interview Roles</CardTitle>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={300}>
                <PieChart>
                  <Pie
                    data={roleData}
                    cx="50%"
                    cy="50%"
                    labelLine={false}
                    label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                    outerRadius={80}
                    fill="#8884d8"
                    dataKey="value"
                  >
                    {roleData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={`hsl(${index * 120}, 70%, 50%)`} />
                    ))}
                  </Pie>
                  <Tooltip />
                </PieChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        )}

        {/* Level Distribution */}
        {levelData.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle>Interview Levels</CardTitle>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={levelData}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="name" />
                  <YAxis />
                  <Tooltip />
                  <Bar dataKey="value" fill="#10B981" />
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        )}
      </div>

      {/* Insights */}
      <Card>
        <CardHeader>
          <CardTitle>Performance Insights</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {averageScore >= 8 && (
              <div className="flex items-start space-x-2 p-3 bg-green-50 rounded-lg">
                <TrendingUp className="h-5 w-5 text-green-600 mt-0.5" />
                <div>
                  <p className="font-medium text-green-800">Excellent Performance!</p>
                  <p className="text-sm text-green-700">
                    Your average score of {averageScore.toFixed(1)}/10 shows strong interview skills. 
                    Keep up the great work!
                  </p>
                </div>
              </div>
            )}

            {averageScore >= 6 && averageScore < 8 && (
              <div className="flex items-start space-x-2 p-3 bg-blue-50 rounded-lg">
                <Target className="h-5 w-5 text-blue-600 mt-0.5" />
                <div>
                  <p className="font-medium text-blue-800">Good Progress</p>
                  <p className="text-sm text-blue-700">
                    Your average score of {averageScore.toFixed(1)}/10 shows solid interview skills. 
                    Focus on your weaker areas to improve further.
                  </p>
                </div>
              </div>
            )}

            {averageScore < 6 && (
              <div className="flex items-start space-x-2 p-3 bg-orange-50 rounded-lg">
                <TrendingDown className="h-5 w-5 text-orange-600 mt-0.5" />
                <div>
                  <p className="font-medium text-orange-800">Room for Improvement</p>
                  <p className="text-sm text-orange-700">
                    Your average score of {averageScore.toFixed(1)}/10 indicates areas for improvement. 
                    Practice more and focus on communication skills.
                  </p>
                </div>
              </div>
            )}

            {totalPracticeTime < 60 && (
              <div className="flex items-start space-x-2 p-3 bg-yellow-50 rounded-lg">
                <Clock className="h-5 w-5 text-yellow-600 mt-0.5" />
                <div>
                  <p className="font-medium text-yellow-800">More Practice Needed</p>
                  <p className="text-sm text-yellow-700">
                    You've only practiced for {totalPracticeTime} minutes total. 
                    Regular practice will help improve your interview skills significantly.
                  </p>
                </div>
              </div>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
