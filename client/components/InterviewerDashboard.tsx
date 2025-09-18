'use client';

import { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { User, LogOut, ClipboardList, PlusCircle } from 'lucide-react';
import Link from 'next/link';
import { api } from '@/lib/api';

export default function InterviewerDashboard() {
  const { user, logout } = useAuth();
  const [interviews, setInterviews] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('overview');
  const [showResponsesFor, setShowResponsesFor] = useState<string | null>(null);
  const [responses, setResponses] = useState<any[]>([]);
  const [responsesLoading, setResponsesLoading] = useState(false);

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

  const playAudioBase64 = (b64?: string) => {
    if (!b64) return;
    try {
      const byteChars = atob(b64);
      const byteNumbers = new Array(byteChars.length);
      for (let i = 0; i < byteChars.length; i++) byteNumbers[i] = byteChars.charCodeAt(i);
      const blob = new Blob([new Uint8Array(byteNumbers)], { type: 'audio/webm' });
      const url = URL.createObjectURL(blob);
      const audio = new Audio(url);
      audio.onended = () => URL.revokeObjectURL(url);
      audio.play();
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
                  <table className="min-w-full bg-white border rounded text-sm">
                    <thead>
                      <tr>
                        <th className="px-3 py-2 text-left">Candidate</th>
                        <th className="px-3 py-2 text-left">Question</th>
                        <th className="px-3 py-2 text-left">Answer (text)</th>
                        <th className="px-3 py-2 text-left">Audio</th>
                        <th className="px-3 py-2 text-left">Time</th>
                      </tr>
                    </thead>
                    <tbody>
                      {responses.map((r, idx) => (
                        <tr key={idx} className="border-t">
                          <td className="px-3 py-2">{r.user?.name || r.user?.email}</td>
                          <td className="px-3 py-2">{r.question?.number}. {r.question?.text}</td>
                          <td className="px-3 py-2 whitespace-pre-wrap">{r.text || '-'}</td>
                          <td className="px-3 py-2">
                            {r.audioData ? (
                              <Button size="sm" onClick={() => playAudioBase64(r.audioData)}>Play</Button>
                            ) : (
                              <span className="text-gray-400">No audio</span>
                            )}
                          </td>
                          <td className="px-3 py-2">{new Date(r.createdAt).toLocaleString()}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
