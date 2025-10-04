'use client';

import { useParams, useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import InterviewEntry from '@/components/InterviewEntry';
import InterviewRoom from '@/components/InterviewRoom';
import { api } from '@/lib/api';
import { toast } from 'react-hot-toast';

export default function InterviewPage() {
  const params = useParams();
  const router = useRouter();
  const interviewCode = params.code as string;
  
  const [verified, setVerified] = useState(false);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [interview, setInterview] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (interviewCode) {
      fetchInterviewDetails();
    }
  }, [interviewCode]);

  const fetchInterviewDetails = async () => {
    try {
      const response = await api.get(`/interviews/by-code/${interviewCode}`);
      setInterview(response.data);
    } catch (error) {
      toast.error('Interview not found or invalid code');
      router.push('/');
    } finally {
      setLoading(false);
    }
  };

  const handleVerified = (sessionId: string, interviewData: any) => {
    setSessionId(sessionId);
    setInterview({ ...interview, ...interviewData });
    setVerified(true);
  };

  const handleInterviewComplete = () => {
    toast.success('Interview completed successfully!');
    router.push('/');
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900 mx-auto"></div>
          <p className="mt-4 text-gray-600">Loading interview...</p>
        </div>
      </div>
    );
  }

  if (!interview) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-gray-900 mb-4">Interview Not Found</h1>
          <p className="text-gray-600 mb-4">The interview code "{interviewCode}" is not valid or has expired.</p>
          <button onClick={() => router.push('/')} className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700">
            Go Back Home
          </button>
        </div>
      </div>
    );
  }

  return (
    <>
      {verified && sessionId ? (
        <InterviewRoom 
          interview={interview} 
          sessionId={sessionId}
          onComplete={handleInterviewComplete} 
        />
      ) : (
        <InterviewEntry 
          interviewCode={interviewCode}
          onVerified={handleVerified}
        />
      )}
    </>
  );
}