const mongoose = require('mongoose');

const responseSchema = new mongoose.Schema({
  // ── Identity ──────────────────────────────────────────────────────────
  userId:      { type: String, required: true, index: true },
  sessionId:   { type: String, required: true, index: true },
  interviewId: { type: String, required: true, index: true },
  questionId:  { type: String, required: true },

  // ── Content ───────────────────────────────────────────────────────────
  question:    { type: String },          // snapshot of question text at answer time
  answerText:  { type: String },          // typed text OR STT transcript
  inputMode:   { type: String, enum: ['text', 'voice'], default: 'text' },

  // ── Audio (voice answers) ─────────────────────────────────────────────
  audioUrl:    { type: String },          // Cloudinary secure_url
  publicId:    { type: String },          // Cloudinary public_id (for deletion)
  transcript:  { type: String },          // raw Bytez STT output

  // ── Evaluation ────────────────────────────────────────────────────────
  score:        { type: Number, min: 0, max: 10 },
  strengths:    [{ type: String }],
  weaknesses:   [{ type: String }],
  improvements: [{ type: String }],

  createdAt:   { type: Date, default: Date.now },
}, {
  timestamps: true,
});

// Compound index to prevent duplicate responses per question per session
responseSchema.index({ sessionId: 1, questionId: 1, userId: 1 }, { unique: true });

module.exports = mongoose.model('InterviewResponse', responseSchema);
