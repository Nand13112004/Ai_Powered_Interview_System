'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import {
  CheckCircle,
  Download,
  Share2,
  Home,
  FileText,
  Trophy,
  Clock,
  MessageSquare
} from 'lucide-react'

interface InterviewCompletionModalProps {
  isOpen: boolean
  onClose: () => void
  interview: {
    title: string
    duration: number
    questions?: any[]
  }
  sessionData: {
    totalQuestions: number
    answeredQuestions: number
    duration: number
    incidentCount: number
  }
}

export default function InterviewCompletionModal({
  isOpen,
  onClose,
  interview,
  sessionData
}: InterviewCompletionModalProps) {
  const [isGeneratingReport, setIsGeneratingReport] = useState(false)

  if (!isOpen) return null

  const handleGenerateReport = async () => {
    setIsGeneratingReport(true)
    // Simulate report generation
    setTimeout(() => {
      setIsGeneratingReport(false)
      // In a real app, this would trigger a download
      console.log('Report generated')
    }, 2000)
  }

  const handleShareResults = () => {
    if (navigator.share) {
      navigator.share({
        title: 'Interview Results',
        text: `I just completed the "${interview.title}" interview!`,
        url: window.location.href,
      })
    } else {
      // Fallback to copying to clipboard
      navigator.clipboard.writeText(window.location.href)
    }
  }

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="bg-gradient-to-r from-green-500 to-emerald-600 text-white p-6 rounded-t-2xl">
          <div className="flex items-center justify-center mb-4">
            <div className="w-16 h-16 bg-white/20 rounded-full flex items-center justify-center">
              <CheckCircle className="h-8 w-8" />
            </div>
          </div>
          <h2 className="text-xl font-bold text-center mb-2">Interview Completed!</h2>
          <p className="text-green-100 text-center text-sm">
            Congratulations on completing your interview
          </p>
        </div>

        {/* Content */}
        <div className="p-6">
          {/* Interview Summary */}
          <div className="bg-gray-50 rounded-xl p-4 mb-6">
            <h3 className="font-semibold text-gray-900 mb-3">Interview Summary</h3>
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div className="flex items-center space-x-2">
                <FileText className="h-4 w-4 text-blue-500" />
                <div>
                  <div className="text-gray-600">Questions</div>
                  <div className="font-semibold">{sessionData.answeredQuestions}/{sessionData.totalQuestions}</div>
                </div>
              </div>
              <div className="flex items-center space-x-2">
                <Clock className="h-4 w-4 text-green-500" />
                <div>
                  <div className="text-gray-600">Duration</div>
                  <div className="font-semibold">{Math.floor(sessionData.duration / 60)}:{(sessionData.duration % 60).toString().padStart(2, '0')}</div>
                </div>
              </div>
              <div className="flex items-center space-x-2">
                <MessageSquare className="h-4 w-4 text-purple-500" />
                <div>
                  <div className="text-gray-600">Responses</div>
                  <div className="font-semibold">{sessionData.answeredQuestions}</div>
                </div>
              </div>
              <div className="flex items-center space-x-2">
                <Trophy className="h-4 w-4 text-yellow-500" />
                <div>
                  <div className="text-gray-600">Incidents</div>
                  <div className={`font-semibold ${sessionData.incidentCount === 0 ? 'text-green-600' : 'text-red-600'}`}>
                    {sessionData.incidentCount}
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Performance Badge */}
          <div className="text-center mb-6">
            <Badge
              className={`px-4 py-2 text-sm ${
                sessionData.incidentCount === 0 && sessionData.answeredQuestions === sessionData.totalQuestions
                  ? 'bg-green-100 text-green-800 border-green-200'
                  : 'bg-yellow-100 text-yellow-800 border-yellow-200'
              }`}
            >
              {sessionData.incidentCount === 0 && sessionData.answeredQuestions === sessionData.totalQuestions
                ? 'Excellent Performance!'
                : 'Good Performance!'}
            </Badge>
          </div>

          {/* Actions */}
          <div className="space-y-3">
            <Button
              onClick={handleGenerateReport}
              disabled={isGeneratingReport}
              className="w-full bg-gradient-to-r from-blue-500 to-indigo-600 hover:from-blue-600 hover:to-indigo-700 text-white shadow-md hover:shadow-lg transition-all duration-200"
            >
              <Download className="h-4 w-4 mr-2" />
              {isGeneratingReport ? 'Generating Report...' : 'Download Report'}
            </Button>

            <Button
              onClick={handleShareResults}
              variant="outline"
              className="w-full border-gray-300 hover:bg-gray-50"
            >
              <Share2 className="h-4 w-4 mr-2" />
              Share Results
            </Button>

            <Button
              onClick={() => window.location.href = '/dashboard'}
              className="w-full bg-gradient-to-r from-gray-500 to-gray-600 hover:from-gray-600 hover:to-gray-700 text-white shadow-md hover:shadow-lg transition-all duration-200"
            >
              <Home className="h-4 w-4 mr-2" />
              Back to Dashboard
            </Button>
          </div>

          {/* Footer */}
          <div className="mt-6 pt-4 border-t border-gray-200 text-center">
            <p className="text-xs text-gray-500">
              Your interview responses have been saved and will be reviewed by the interviewer.
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}
