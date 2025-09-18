const mongoose = require('mongoose');

const sessionSchema = new mongoose.Schema({
  userId: { type: String, required: true },
  interviewId: { type: String, required: true },
  status: { type: String, enum: ['pending', 'in_progress', 'completed', 'cancelled'], default: 'pending' },
  startedAt: { type: Date },
  completedAt: { type: Date },
  duration: { type: Number },
  transcript: { type: Array },
  audioData: { type: Buffer },
  videoData: { type: Buffer },
  scores: { type: Object },
  feedback: { type: Object },
}, { timestamps: true });

module.exports = mongoose.model('Session', sessionSchema);

