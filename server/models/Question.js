const mongoose = require('mongoose');

const questionSchema = new mongoose.Schema({
  text: { type: String, required: true },
  type: { type: String, required: true },
  category: { type: String, required: true },
  difficulty: { type: String, required: true },
  expectedAnswer: { type: String },
  rubric: { type: Object },
  number: { type: Number, required: true },
  isActive: { type: Boolean, default: true },
  interviewId: { type: String, required: true },
}, { timestamps: true });

module.exports = mongoose.model('Question', questionSchema);

