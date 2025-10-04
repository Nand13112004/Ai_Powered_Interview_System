'use client';

import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
// import { Alert, AlertDescription } from '@/components/ui/alert';
import { Clock, Calendar, Key, AlertCircle } from 'lucide-react';
import { api } from '@/lib/api';

interface InterviewEntryProps {
  interviewCode: string;
  onVerified: (sessionId: string, interview: any) => void;
}

export default function InterviewEntry({ interviewCode, onVerified }: InterviewEntryProps) {
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [scheduleError, setScheduleError] = useState('');
  const [interviewDetails, setInterviewDetails] = useState<any>(null);
  const [timeUntilStart, setTimeUntilStart] = useState<number>(0);

  useEffect(() => {
    if (timeUntilStart > 0) {
      const timer = setInterval(() => {
        setTimeUntilStart(prev => Math.max(0, prev - 1));
      }, 1000);
      return () => clearInterval(timer);
    }
  }, [timeUntilStart]);

  const handlePasswordSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    setScheduleError('');

    try {
      const response = await api.post('/sessions/verify-entry', {
        interviewCode,
        password,
        userId: localStorage.getItem('userId') // Get from auth context
      });

      const { sessionId, interview, session, canStart } = response.data;
      
      if (!canStart) {
        if (response.data.timeUntilStart) {
          setTimeUntilStart(Math.floor(response.data.timeUntilStart / 1000));
        }
        setScheduleError(response.data.message || response.data.error);
        setInterviewDetails(interview);
      } else {
        // Verification successful, proceed to interview
        onVerified(sessionId, interview);
      }
    } catch (error: any) {
      setError(error.response?.data?.error || 'Verification failed');
    } finally {
      setLoading(false);
    }
  };

  const formatTimeRemaining = (seconds: number) => {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;
    return `${hours}h ${minutes}m ${secs}s`;
  };

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <CardTitle className="flex items-center justify-center gap-2">
            <Key className="h-6 w-6" />
            Interview Entry
          </CardTitle>
          <p className="text-sm text-gray-600">
            Enter password to join interview: <code className="bg-gray-200 px-2 py-1 rounded">{interviewCode}</code>
          </p>
        </CardHeader>
        
        <CardContent className="space-y-4">
          {interviewDetails && (
            <div className="space-y-2">
              <h3 className="font-semibold">{interviewDetails.title}</h3>
              <div className="flex items-center gap-2 text-sm text-gray-600">
                <Clock className="h-4 w-4" />
                Duration: {interviewDetails.duration} minutes
              </div>
              {interviewDetails.timeSlot?.start && (
                <div className="flex items-center gap-2 text-sm text-gray-600">
                  <Calendar className="h-4 w-4" />
                  Started: {new Date(interviewDetails.timeSlot.start).toLocaleString()}
                </div>
              )}
            </div>
          )}

          {scheduleError && (
            <Alert>
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>
                {scheduleError}
                {timeUntilStart > 0 && (
                  <div className="mt-2 font-mono text-lg">
                    Time until start: {formatTimeRemaining(timeUntilStart)}
                  </div>
                )}
              </AlertDescription>
            </Alert>
          )}

          {error && (
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          <form onSubmit={handlePasswordSubmit} className="space-y-4">
            <div>
              <Label htmlFor="password">Interview Password</Label>
              <Input
                id="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Enter interview password"
                disabled={loading || timeUntilStart > 0}
                required
              />
            </div>
            
            <Button 
              type="submit" 
              className="w-full" 
              disabled={loading || timeUntilStart > 0}
            >
              {loading ? 'Verifying...' : timeUntilStart > 0 ? 'Waiting for interview to start...' : 'Join Interview'}
            </Button>
          </form>

          {interviewDetails?.allowLateJoin && timeUntilStart === 0 && (
            <div className="text-center">
              <Button 
                variant="outline" 
                onClick={handlePasswordSubmit}
                disabled={loading}
              >
                Join Late (Interview in progress)
              </Button>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
