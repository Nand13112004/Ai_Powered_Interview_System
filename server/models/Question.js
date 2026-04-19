const mongoose = require('mongoose');

const questionSchema = new mongoose.Schema({
  text:          { type: String, required: true },
  type:          { type: String, required: true }, // 'mcq' | 'text' | 'code'
  category:      { type: String, required: true },
  difficulty:    { type: String, required: true },
  expectedAnswer:{ type: String },
  // MCQ-specific fields
  options:       [{ type: String }],          // ['a) ...', 'b) ...', ...]
  correctAnswer: { type: String },            // 'a' | 'b' | 'c' | 'd'
  rubric:        { type: Object },
  number:        { type: Number, required: true },
  isActive:      { type: Boolean, default: true },
  interviewId:   { type: String, required: true },
}, { timestamps: true });

module.exports = mongoose.model('Question', questionSchema);
