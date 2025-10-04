'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import InterviewEntry from '@/components/InterviewEntry'
import { api } from '@/lib/api'
import { toast } from 'react-hot-toast'

interface InterviewPageProps {
  params: { code: string }
}

export default function InterviewPage({ params }: InterviewPageProps) {
  const router = useRouter()
  const [loading, setLoading] = useState(true)
  const [interview, setInterview] = useState<any>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const loadInterview = async () => {
      try {
        const response = await api.get(`/interviews/by-code/${params.code}`)
        setInterview(response.data)
      } catch (error: any) {
        console.error('Failed to load interview:', error)
        setError(error.response?.data?.error || 'Failed to load interview')
        toast.error('Interview not found or access denied')
      } finally {
        setLoading(false)
      }
    }
    loadInterview()
  }, [params.code])

  const handleSuccess = (sessionId: string, interviewData: any) => {
    toast.success('Interview access granted! Redirecting...')
    // Redirect to interview room
    router.push(`/interviewroom/${interviewData.id}?sessionId=${sessionId}`)
  }

  const handleError = (errorMessage: string) => {
    setError(errorMessage)
    toast.error(errorMessage)
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 via-indigo-50 to-purple-50 flex items-center justify-center">
        <div className="text-center">
          <div className="w-16 h-16 border-4 border-blue-500 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-gray-600">Loading interview...</p>
        </div>
      </div>
    )
  }

  if (error || !interview) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-red-50 via-pink-50 to-rose-50 flex items-center justify-center p-4">
        <div className="max-w-md w-full text-center">
          <div className="bg-white rounded-xl shadow-xl p-8">
            <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <svg className="h-8 w-8 text-red-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.732-.833-2.5 0L4.268 19.5c-.77.833.192 2.5 1.732 2.5z" />
              </svg>
            </div>
            <h1 className="text-2xl font-bold text-gray-900 mb-2">Access Denied</h1>
            <p className="text-gray-600 mb-6">{error || 'Interview not found'}</p>
            <button
              onClick={() => router.push('/dashboard')}
              className="bg-blue-500 hover:bg-blue-600 text-white px-6 py-2 rounded-lg transition-colors"
            >
              Return to Dashboard
            </button>
          </div>
        </div>
      </div>
    )
  }

  return (
    <InterviewEntry
      interviewCode={params.code}
      onSuccess={handleSuccess}
      onError={handleError}
    />
  )
}