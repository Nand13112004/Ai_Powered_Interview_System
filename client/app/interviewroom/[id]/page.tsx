'use client'

import { useEffect, useState } from 'react'
import InterviewRoom from '@/components/InterviewRoom'
import { api } from '@/lib/api'
import { useRouter } from 'next/navigation'

interface Question { id: string; text: string; number: number }
interface Interview {
  id: string
  title: string
  description: string
  role: string
  level: string
  duration: number
  questions: Question[]
}

export default function InterviewRoomPage({ params }: { params: { id: string } }) {
  const router = useRouter()
  const [interview, setInterview] = useState<Interview | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const load = async () => {
      try {
        const res = await api.get(`/interviews/${params.id}`)
        setInterview(res.data.interview)
      } catch (e) {
        router.push('/dashboard')
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [params.id])

  if (loading) return <div className="p-8">Loading...</div>
  if (!interview) return <div className="p-8">Interview not found</div>

  return (
    <InterviewRoom
      interview={interview}
      onComplete={() => router.push('/dashboard')}
    />
  )
}


