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
  
  // Enhanced tracking
  entryTime: { type: Date }, // When candidate entered interview room
  answerCount: { type: Number, default: 0 },
  timeSpentPerQuestion: [{ questionId: String, timeSpent: Number }],
  
  // AI Scoring
  aiScore: { type: Number },
  aiEvaluation: { type: Object },
  
  // Media metadata
  audioFormat: { type: String, default: 'webm' },
  videoFormat: { type: String, default: 'webm' },
  recordingQuality: { type: String, default: 'medium' },
  fileSizes: { 
    audio: { type: Number }, 
    video: { type: Number } 
  }
}, { timestamps: true });

module.exports = mongoose.model('Session', sessionSchema);

