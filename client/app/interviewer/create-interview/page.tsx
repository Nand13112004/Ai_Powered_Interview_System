"use client";
import { useState } from "react";
import Link from "next/link";
import { useAuth } from "@/contexts/AuthContext";
import axios from "axios";
import { api } from "@/lib/api";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Brain, Plus, X } from "lucide-react";

export default function CreateInterview() {
  const [title, setTitle] = useState("");
  const { logout } = useAuth();
  const [role, setRole] = useState("");
  const [level, setLevel] = useState("");
  const [duration, setDuration] = useState(30);
  const [description, setDescription] = useState("");
  const [questions, setQuestions] = useState<string[]>([""]);
  // Removed rubric input
  const [password, setPassword] = useState("");
  const [createdCode, setCreatedCode] = useState("");
  const [createdPassword, setCreatedPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState("");

  const addQuestion = () => {
    setQuestions([...questions, ""]);
  };

  const removeQuestion = (index: number) => {
    setQuestions(questions.filter((_, i) => i !== index));
  };

  const updateQuestion = (index: number, value: string) => {
    const newQuestions = [...questions];
    newQuestions[index] = value;
    setQuestions(newQuestions);
  };

  async function generateQuestions() {
    if (!role || !level) return;
    setLoading(true);
    setError("");
    try {
      const res = await api.post("/generate-questions", { role, level });
      if (res.data.questions && Array.isArray(res.data.questions)) {
        setQuestions(res.data.questions);
      } else {
        setError("Failed to generate questions");
      }
    } catch (err: any) {
      if (err.response?.data?.error) setError(err.response.data.error);
      else setError("Error generating questions");
    } finally {
      setLoading(false);
    }
  }

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setLoading(true);
    setError("");
    setSuccess(false);

    try {
      const filteredQuestions = questions.filter((q) => q.trim() !== "");
      if (filteredQuestions.length === 0) {
        throw new Error("At least one question is required");
      }
      if (!password || password.length < 4) {
        throw new Error("Password must be at least 4 characters");
      }

      const res = await api.post("/interviews", {
        title,
        role,
        level,
        duration,
        description,
        questions: filteredQuestions,
        password,
      });

      setSuccess(true);
      setCreatedCode(res.data.interview.code);
      setCreatedPassword(password);

      // Reset form
      setTitle("");
      setRole("");
      setLevel("");
      setDuration(30);
      setDescription("");
      setQuestions([""]);
      setPassword("");
    } catch (err: any) {
      if (err.response?.data?.error) setError(err.response.data.error);
      else if (err instanceof Error) setError(err.message);
      else setError("Unknown error");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white shadow-sm border-b">
        <div className="container mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center space-x-4">
            <Brain className="h-8 w-8 text-blue-600" />
            <h1 className="text-2xl font-bold text-gray-900">AI Interview Platform</h1>
          </div>
          <div className="flex items-center space-x-2">
            <Link href="/interviewer/dashboard">
              <button className="px-4 py-2 rounded bg-gray-100 hover:bg-gray-200 text-gray-800 font-medium border border-gray-200">Dashboard</button>
            </Link>
            <button
              className="px-4 py-2 rounded bg-red-500 hover:bg-red-600 text-white font-medium"
              onClick={logout}
            >
              Logout
            </button>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 py-8 flex justify-center">
        <Card className="w-full max-w-lg">
          <CardHeader>
            <CardTitle>Create New Interview</CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="flex flex-col gap-4">
              <input
                className="border rounded px-3 py-2"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="Interview Title"
                minLength={3}
                required
              />
              <input
                className="border rounded px-3 py-2"
                value={role}
                onChange={(e) => setRole(e.target.value)}
                placeholder="Role (e.g. Frontend Developer)"
                required
              />
              <select
                className="border rounded px-3 py-2"
                value={level}
                onChange={(e) => setLevel(e.target.value)}
                required
              >
                <option value="">Select Level</option>
                <option value="junior">Junior</option>
                <option value="mid">Mid</option>
                <option value="senior">Senior</option>
              </select>
              <input
                className="border rounded px-3 py-2"
                type="number"
                value={duration}
                onChange={(e) => setDuration(Number(e.target.value))}
                placeholder="Duration (minutes)"
                min={1}
                max={120}
                required
              />
              <textarea
                className="border rounded px-3 py-2"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Description"
              />

              {/* Password Section */}
              <input
                className="border rounded px-3 py-2"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Set Interview Password (min 4 chars)"
                minLength={4}
                maxLength={32}
                required
              />

              {/* Questions Section */}
              <div>
                <label className="block text-sm font-medium mb-2">Questions</label>
                {questions.map((question, index) => (
                  <div key={index} className="flex gap-2 mb-2">
                    <input
                      className="border rounded px-3 py-2 flex-1"
                      value={question}
                      onChange={(e) => updateQuestion(index, e.target.value)}
                      placeholder={`Question ${index + 1}`}
                      required
                    />
                    {questions.length > 1 && (
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => removeQuestion(index)}
                      >
                        <X className="h-4 w-4" />
                      </Button>
                    )}
                  </div>
                ))}
                <div className="flex gap-2">
                  <Button type="button" variant="outline" onClick={addQuestion}>
                    <Plus className="h-4 w-4 mr-2" /> Add Question
                  </Button>
                  <Button
                    type="button"
                    variant="default"
                    onClick={generateQuestions}
                    disabled={!role || !level || loading}
                  >
                    {loading ? "Generating..." : "Generate with Gemini"}
                  </Button>
                </div>
              </div>

              

              <Button type="submit" disabled={loading}>
                {loading ? "Creating..." : "Create Interview"}
              </Button>
            </form>

            {success && (
              <div className="text-green-600 mt-2">
                <p>Interview created successfully!</p>
                {createdCode && (
                  <div className="mt-2 p-2 border rounded bg-green-50">
                    <div><b>Code:</b> <span className="font-mono">{createdCode}</span></div>
                    <div><b>Password:</b> <span className="font-mono">{createdPassword}</span></div>
                  </div>
                )}
              </div>
            )}
            {error && <p className="text-red-600 mt-2">{error}</p>}
          </CardContent>
        </Card>
      </main>
    </div>
  );
}
