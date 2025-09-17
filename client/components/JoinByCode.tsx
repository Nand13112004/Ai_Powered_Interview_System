"use client";
import { useState } from "react";
import { api } from "@/lib/api";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

export default function JoinByCode({ onSuccess }: { onSuccess?: (interviewId: string) => void }) {
  const [code, setCode] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function handleJoin(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setLoading(true);
    setError("");
    try {
      const res = await api.post("/interviews/join-by-code", { code, password });
      if (onSuccess) onSuccess(res.data.interviewId);
    } catch (err: any) {
      if (err.response?.data?.error) setError(err.response.data.error);
      else setError("Failed to join interview");
    } finally {
      setLoading(false);
    }
  }

  return (
    <Card className="w-full max-w-md mx-auto mt-8">
      <CardHeader>
        <CardTitle>Join Interview by Code</CardTitle>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleJoin} className="flex flex-col gap-4">
          <input
            className="border rounded px-3 py-2"
            value={code}
            onChange={e => setCode(e.target.value)}
            placeholder="Enter Interview Code"
            required
          />
          <input
            className="border rounded px-3 py-2"
            type="password"
            value={password}
            onChange={e => setPassword(e.target.value)}
            placeholder="Enter Interview Password"
            required
          />
          <Button type="submit" disabled={loading}>
            {loading ? "Joining..." : "Join Interview"}
          </Button>
        </form>
        {error && <p className="text-red-600 mt-2">{error}</p>}
      </CardContent>
    </Card>
  );
}
