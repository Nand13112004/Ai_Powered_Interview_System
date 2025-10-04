'use client';

import { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { User, LogOut, ClipboardList, PlusCircle, Play, Download, Clock, Calendar, Key } from 'lucide-react';
import Link from 'next/link';
import { api } from '@/lib/api';
import { toast } from 'react-hot-toast';

export default function InterviewerDashboard() {
  const { user, logout } = useAuth();
  const [interviews, setInterviews] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('overview');
  const [showResponsesFor, setShowResponsesFor] = useState<string | null>(null);
  const [responses, setResponses] = useState<any[]>([]);
  const [responsesLoading, setResponsesLoading] = useState(false);
  const [selectedInterview, setSelectedInterview] = useState<any>(null);
  const [schedulingDialog, setSchedulingDialog] = useState(false);
  const [scoreResults, setScoreResults] = useState<any>(null);

  useEffect(() => {
    fetchInterviews();
  }, []);

  const fetchInterviews = async () => {
    try {
      const res = await api.get('/interviews');
      setInterviews(res.data.interviews || []);
    } catch (error) {
      console.error('Error fetching interviews:', error);
      setInterviews([]);
    } finally {
      setLoading(false);
    }
  };

  const fetchResponses = async (interviewId: string) => {
    try {
      setResponsesLoading(true);
      const res = await api.get(`/interviews/${interviewId}/responses`);
      setResponses(res.data.responses || []);
      setShowResponsesFor(interviewId);
    } catch (error) {
      console.error('Error fetching responses:', error);
    } finally {
      setResponsesLoading(false);
    }
  };

  const scheduleInterview = async (interviewId: string, scheduleData: any) => {
    try {
      const res = await api.put(`/interviews/${interviewId}`, {
        scheduledStartTime: scheduleData.startTime,
        scheduledEndTime: scheduleData.endTime,
        isScheduled: true,
        requiresSchedule: true
      });
      
      toast.success('Interview scheduled successfully');
      setSchedulingDialog(false);
      fetchInterviews();
    } catch (error) {
      console.error('Error scheduling interview:', error);
      toast.error('Failed to schedule interview');
    }
  };

  const generateAI = async (sessionId: string) => {
    try {
      toast.loading('Generating AI scores...');
      const res = await api.post('/scoring/score-session', { sessionId });
      
      setScoreResults(res.data.evaluation);
      toast.success('AI scoring completed');
    } catch (error) {
      console.error('Error generating scores:', error);
      toast.error('Failed to generate AI scores');
    }
  };

  const downloadMedia = async (sessionId: string, mediaType: 'video' | 'audio') => {
    try {
      const res = await api.get(`/sessions/download/${sessionId}/${mediaType}`, {
        responseType: 'blob'
      });
      
      const url = window.URL.createObjectURL(new Blob([res.data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `interview_${sessionId}_${mediaType}.webm`);
      document.body.appendChild(link);
      link.click();
      link.remove();
      
      toast.success(`${mediaType} download started`);
    } catch (error) {
      console.error(`Error downloading ${mediaType}:`, error);
      toast.error(`Failed to download ${mediaType}`);
    }
  };

  const playAudioBase64 = (b64?: string) => {
    if (!b64) return;
    try {
      const byteChars = atob(b64);
      const byteNumbers = new Array(byteChars.length);
      for (let i = 0; i < byteChars.length; i++) byteNumbers[i] = byteChars.charCodeAt(i);
      
      // Try different audio formats
      const formats = ['audio/webm', 'audio/mp4', 'audio/wav', 'audio/ogg'];
      let audioBlob;
      
      for (const format of formats) {
        try {
          audioBlob = new Blob([new Uint8Array(byteNumbers)], { type: format });
          break;
        } catch (e) {
          continue;
        }
      }
      
      if (!audioBlob) {
        // Fallback to generic audio format
        audioBlob = new Blob([new Uint8Array(byteNumbers)], { type: 'audio/webm' });
      }
      
      const url = URL.createObjectURL(audioBlob);
      const audio = new Audio(url);
      
      audio.onloadeddata = () => {
        console.log('Audio loaded successfully');
      };
      
      audio.onerror = (e) => {
        console.error('Audio playback error:', e);
        URL.revokeObjectURL(url);
      };
      
      audio.onended = () => {
        URL.revokeObjectURL(url);
      };
      
      audio.play().catch(e => {
        console.error('Failed to play audio:', e);
        URL.revokeObjectURL(url);
      });
    } catch (e) {
      console.error('Failed to play audio', e);
    }
  };

  const handleLogout = () => {
    logout();
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white shadow-sm border-b">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-4">
              <ClipboardList className="h-8 w-8 text-blue-600" />
              <h1 className="text-2xl font-bold text-gray-900">MockMate AI</h1>
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
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="overview">Overview</TabsTrigger>
            <TabsTrigger value="interviews">Interviews</TabsTrigger>
          </TabsList>

          <TabsContent value="overview" className="space-y-6">
            <div className="grid md:grid-cols-2 gap-6">
              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Total Interviews</CardTitle>
                  <ClipboardList className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{interviews.length}</div>
                  <p className="text-xs text-muted-foreground">Created by you</p>
                </CardContent>
              </Card>
              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Create Interview</CardTitle>
                  <PlusCircle className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <Link href="/interviewer/create-interview">
                    <Button variant="default">+ New Interview</Button>
                  </Link>
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          <TabsContent value="interviews" className="space-y-6">
            <h2 className="text-lg font-semibold">Your Interviews</h2>
            {loading ? (
              <p>Loading interviews...</p>
            ) : interviews.length === 0 ? (
              <p>No interviews created yet.</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="min-w-full bg-white border rounded">
                  <thead>
                    <tr>
                      <th className="px-4 py-2 text-left">Title</th>
                      <th className="px-4 py-2 text-left">Role</th>
                      <th className="px-4 py-2 text-left">Level</th>
                      <th className="px-4 py-2 text-left">Duration</th>
                      <th className="px-4 py-2 text-left">Created</th>
                      <th className="px-4 py-2 text-left">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {interviews.map((interview: any) => (
                      <tr key={interview.id}>
                        <td className="px-4 py-2">{interview.title}</td>
                        <td className="px-4 py-2">{interview.role}</td>
                        <td className="px-4 py-2">{interview.level}</td>
                        <td className="px-4 py-2">{interview.duration} min</td>
                        <td className="px-4 py-2">{new Date(interview.createdAt).toLocaleDateString()}</td>
                        <td className="px-4 py-2">
                          <Button size="sm" variant="outline" onClick={() => fetchResponses(interview.id)}>
                            View Details
                          </Button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </TabsContent>
        </Tabs>

        {/* Responses Modal */}
        {showResponsesFor && (
          <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
            <div className="bg-white rounded-lg shadow-xl w-full max-w-4xl max-h-[80vh] overflow-hidden">
              <div className="flex items-center justify-between px-4 py-3 border-b">
                <h3 className="font-semibold">Responses</h3>
                <Button variant="outline" size="sm" onClick={() => setShowResponsesFor(null)}>Close</Button>
              </div>
              <div className="p-4 overflow-auto">
                {responsesLoading ? (
                  <p>Loading...</p>
                ) : responses.length === 0 ? (
                  <p>No responses yet.</p>
                ) : (
                  <>
                    <div className="mb-4 flex justify-between items-center">
                      <h3 className="text-lg font-semibold">Interview Responses</h3>
                      <div className="flex gap-2">
                        <Button onClick={() => generateAI(responses[0]?.sessionId)} size="sm" variant="outline">
                          Generate AI Scores
                        </Button>
                        <Button 
                          size="sm" 
                          variant="outline"
                          onClick={() => setSchedulingDialog(true)}
                        >
                          <Calendar className="h-4 w-4 mr-2" />
                          Schedule Interview
                        </Button>
                      </div>
                    </div>

                    {/* AI Scoring Results */}
                    {scoreResults && (
                      <Card className="mb-4">
                        <CardHeader>
                          <CardTitle className="flex items-center gap-2">
                            <ClipboardList className="h-5 w-5" />
                            AI Scoring Results
                          </CardTitle>
                        </CardHeader>
                        <CardContent>
                          <div className="grid grid-cols-2 gap-4">
                            <div>
                              <div className="text-2xl font-bold text-green-600">{scoreResults.overallScore}/100</div>
                              <div className="text-sm text-gray-600">Overall Score</div>
                            </div>
                            <div>
                              <div className="text-sm">
                                <strong>Strengths:</strong> {scoreResults.questionEvaluations[0]?.feedback?.strengths.join(', ')}
                              </div>
                              <div className="text-sm">
                                <strong>Suggestions:</strong> {scoreResults.questionEvaluations[0]?.feedback?.suggestions.join(', ')}
                              </div>
                            </div>
                          </div>
                        </CardContent>
                      </Card>
                    )}

                    <table className="min-w-full bg-white border rounded text-sm">
                      <thead>
                        <tr className="bg-gray-50">
                          <th className="px-3 py-2 text-left">Candidate</th>
                          <th className="px-3 py-2 text-left">Question</th>
                          <th className="px-3 py-2 text-left">Answer (text)</th>
                          <th className="px-3 py-2 text-left">Audio</th>
                          <th className="px-3 py-2 text-left">AI Score</th>
                          <th className="px-3 py-2 text-left">Media</th>
                          <th className="px-3 py-2 text-left">Time</th>
                        </tr>
                      </thead>
                      <tbody>
                        {responses.map((r, idx) => (
                          <tr key={idx} className="border-t hover:bg-gray-50">
                            <td className="px-3 py-2">{r.user?.name || r.user?.email}</td>
                            <td className="px-3 py-2">{r.question?.number}. {r.question?.text}</td>
                            <td className="px-3 py-2 whitespace-pre-wrap max-w-xs">{r.text || '-'}</td>
                            <td className="px-3 py-2">
                              {r.audioData ? (
                                <div className="flex items-center space-x-2">
                                  <Button 
                                    size="sm" 
                                    variant="outline"
                                    onClick={() => playAudioBase64(r.audioData)}
                                    className="flex items-center gap-1"
                                  >
                                    <Play className="h-3 w-3" />
                                    Play
                                  </Button>
                                  <span className="text-xs text-gray-500">
                                    {Math.round(r.audioData.length / 1024)}KB
                                  </span>
                                </div>
                              ) : (
                                <span className="text-gray-400">No audio</span>
                              )}
                            </td>
                            <td className="px-3 py-2">
                              {r.aiScore ? (
                                <Badge variant={r.aiScore >= 70 ? "default" : r.aiScore >= 50 ? "secondary" : "destructive"}>
                                  {r.aiScore}/100
                                </Badge>
                              ) : (
                                <span className="text-gray-400">Not scored</span>
                              )}
                            </td>
                            <td className="px-3 py-2">
                              <div className="flex gap-1">
                                <Button 
                                  size="sm" 
                                  variant="outline"
                                  onClick={() => downloadMedia(r.sessionId, 'audio')}
                                  disabled={!r.audioData}
                                  className="flex items-center gap-1"
                                >
                                  <Download className="h-3 w-3" />
                                  Audio
                                </Button>
                                <Button 
                                  size="sm" 
                                  variant="outline"
                                  onClick={() => downloadMedia(r.sessionId, 'video')}
                                  className="flex items-center gap-1"
                                >
                                  <Download className="h-3 w-3" />
                                  Video
                                </Button>
                              </div>
                            </td>
                            <td className="px-3 py-2">
                              <div className="flex items-center gap-1">
                                <Clock className="h-3 w-3 text-gray-400" />
                                {new Date(r.createdAt).toLocaleString()}
                              </div>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </>
                )}
              </div>
            </div>
          </div>
        )}
      </main>
      
      {/* Simple Scheduling Modal */}
      {schedulingDialog && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white p-6 rounded-lg max-w-md w-full mx-4">
            <h3 className="text-lg font-semibold mb-4">Schedule Interview</h3>
            <ScheduleInterviewForm onSubmit={(data) => scheduleInterview(responses[0]?.interviewId, data)} />
            <Button 
              variant="outline" 
              onClick={() => setSchedulingDialog(false)}
              className="mt-2 w-full"
            >
              Cancel
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}

// Schedule Interview Form Component
function ScheduleInterviewForm({ onSubmit }: { onSubmit: (data: any) => void }) {
  const [startTime, setStartTime] = useState('');
  const [endTime, setEndTime] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSubmit({
      startTime: new Date(startTime),
      endTime: new Date(endTime)
    });
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <Label htmlFor="startTime">Interview Start Time</Label>
        <Input
          id="startTime"
          type="datetime-local"
          value={startTime}
          onChange={(e) => setStartTime(e.target.value)}
          required
        />
      </div>
      
      <div>
        <Label htmlFor="endTime">Interview End Time</Label>
        <Input
          type="datetime-local"
          value={endTime}
          onChange={(e) => setEndTime(e.target.value)}
          required
        />
      </div>
      
      <div className="flex justify-end gap-2">
        <Button type="submit">Schedule Interview</Button>
        <Button type="button" variant="outline">Cancel</Button>
      </div>
    </form>
  );
}