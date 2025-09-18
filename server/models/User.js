const mongoose = require('mongoose');

const userSchema = new mongoose.Schema({
  email: { type: String, unique: true, required: true },
  password: { type: String, required: true },
  name: { type: String, required: true },
  role: { type: String, enum: ['candidate', 'interviewer', 'admin'], default: 'candidate' },
  isVerified: { type: Boolean, default: false },
  verificationCode: { type: String },
  verificationExpires: { type: Date },
}, { timestamps: true });

module.exports = mongoose.model('User', userSchema);