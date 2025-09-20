const mongoose = require('mongoose');

const answerSchema = new mongoose.Schema({
  interviewId: { type: String, required: true },
  candidateId: { type: String, required: true },
  questionId: { type: String, required: true },
  answerText: String,
  audioUrl: String,
  createdAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model('Answer', answerSchema);