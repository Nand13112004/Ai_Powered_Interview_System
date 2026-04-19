/**
 * audioApi.ts
 * Clean API helpers for the voice interaction pipeline.
 * All calls go through the existing axios instance (lib/api) which
 * already attaches the JWT Authorization header.
 */

import { api } from './api';

// ── Types ────────────────────────────────────────────────────────────────

export interface EvaluationResult {
  score:        number;         // 0-10
  strengths:    string[];
  weaknesses:   string[];
  improvements: string[];
}

export interface UploadAudioResult {
  responseId:   string;
  audioUrl:     string;
  publicId:     string;
  transcript:   string;
  score:        number;
  strengths:    string[];
  weaknesses:   string[];
  improvements: string[];
}

export interface SessionResponse {
  id:           string;
  questionId:   string;
  question:     string;
  answerText:   string;
  inputMode:    'text' | 'voice';
  audioUrl:     string | null;
  transcript:   string | null;
  score:        number;
  strengths:    string[];
  weaknesses:   string[];
  improvements: string[];
  createdAt:    string;
}

// ── Upload + full pipeline ───────────────────────────────────────────────

/**
 * Upload an audio Blob to the server.
 * Server will: upload → Cloudinary, transcribe, evaluate, persist.
 */
export async function uploadAudio(
  blob: Blob,
  opts: { question: string; sessionId: string; interviewId: string; questionId: string }
): Promise<UploadAudioResult> {
  const form = new FormData();
  form.append('audio', blob, `recording_${Date.now()}.webm`);
  form.append('question',    opts.question);
  form.append('sessionId',   opts.sessionId);
  form.append('interviewId', opts.interviewId);
  form.append('questionId',  opts.questionId);

  const res = await api.post('/audio/upload', form, {
    headers: { 'Content-Type': 'multipart/form-data' },
    timeout: 120_000, // 2 min — STT + evaluation can be slow
  });

  return res.data;
}

// ── Transcription only ───────────────────────────────────────────────────

/**
 * Send an audio Blob to the server for transcription only.
 */
export async function transcribeAudio(blob: Blob): Promise<string> {
  const form = new FormData();
  form.append('audio', blob, `audio_${Date.now()}.webm`);

  const res = await api.post('/ai/transcribe', form, {
    headers: { 'Content-Type': 'multipart/form-data' },
    timeout: 60_000,
  });

  return res.data.transcript ?? '';
}

// ── Evaluation only ──────────────────────────────────────────────────────

/**
 * Evaluate a text/transcript answer.
 */
export async function evaluateAnswer(
  question: string,
  transcript: string
): Promise<EvaluationResult> {
  const res = await api.post('/ai/evaluate', { question, transcript });
  return res.data;
}

// ── Text-to-Speech ───────────────────────────────────────────────────────

/**
 * Request TTS audio for a given text.
 * Returns a playable object URL (or null if TTS is unavailable).
 */
export async function generateTTS(text: string): Promise<string | null> {
  try {
    const res = await api.post('/ai/tts', { text }, { timeout: 30_000 });
    const { audioBase64, mimeType } = res.data;

    if (!audioBase64) return null;

    const bytes = Uint8Array.from(atob(audioBase64), c => c.charCodeAt(0));
    const audioBlob = new Blob([bytes], { type: mimeType || 'audio/mp3' });
    return URL.createObjectURL(audioBlob);

  } catch {
    return null; // Degrade gracefully — text-only display
  }
}

// ── Generate next question ───────────────────────────────────────────────

export async function generateQuestion(opts: {
  role: string;
  level: string;
  topic?: string;
  previousQuestions?: string[];
}): Promise<string> {
  const res = await api.post('/ai/question', opts);
  return res.data.question ?? '';
}

// ── Fetch full session with audio + transcripts ──────────────────────────

export async function fetchSessionDetails(sessionId: string): Promise<{
  session: object;
  interview: object;
  responses: SessionResponse[];
}> {
  const res = await api.get(`/audio/session/${sessionId}`);
  return res.data;
}
