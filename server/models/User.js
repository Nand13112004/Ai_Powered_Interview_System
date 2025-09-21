const mongoose = require('mongoose');

const userSchema = new mongoose.Schema({
  email: { type: String, unique: true, required: true },
  password: String,
  name: String,
  role: { type: String, default: 'candidate' },
  isVerified: { type: Boolean, default: false },
  verificationCode: String,
  verificationExpires: Date,
}, { timestamps: true });

module.exports = mongoose.model('User', userSchema);