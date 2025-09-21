import { useRouter } from 'next/router'
import { Button } from '@/components/ui/button'

interface Interview {
  id: string
  title: string
  // add other fields if needed
}

interface InterviewLobbyProps {
  interview: Interview
}

export default function InterviewLobby({ interview }: InterviewLobbyProps) {
  const router = useRouter()
  if (!interview) return <div>Interview not found.</div>
  return (
    <div className="flex flex-col items-center justify-center min-h-screen">
      <h1 className="text-2xl font-bold mb-4">{interview.title}</h1>
      <p className="mb-8">Ready to begin your interview?</p>
      <Button
        onClick={() => router.push(`/interview/${interview.id}`)}
        className="bg-blue-600 text-white px-6 py-2 rounded-lg"
      >
        Start Interview
      </Button>
    </div>
  )
}

