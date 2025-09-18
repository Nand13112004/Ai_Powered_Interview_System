const mongoose = require('mongoose');

const responseSchema = new mongoose.Schema({
  userId: { type: String, required: true },
  interviewId: { type: String, required: true },
  sessionId: { type: String, required: true },
  questionId: { type: String, required: true },
  text: { type: String },
  audioData: { type: Buffer },
  createdAt: { type: Date, default: Date.now },
});

module.exports = mongoose.model('Response', responseSchema);

