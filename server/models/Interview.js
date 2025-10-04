const mongoose = require('mongoose');

const interviewSchema = new mongoose.Schema({
  title: { type: String, required: true },
  description: { type: String },
  role: { type: String, required: true },
  level: { type: String, required: true },
  duration: { type: Number, required: true },
  rubric: { type: Object, default: {} },
  code: { type: String, unique: true, required: true },
  password: { type: String, required: true },
  isActive: { type: Boolean, default: true },
  userId: { type: String, required: true },
  
  // Scheduling fields
  scheduledStartTime: { type: Date },
  scheduledEndTime: { type: Date },
  isScheduled: { type: Boolean, default: false },
  requiresSchedule: { type: Boolean, default: false },
  
  // Additional metadata
  maxParticipants: { type: Number, default: 1 },
  autoStart: { type: Boolean, default: false },
  allowLateJoin: { type: Boolean, default: true },
  timeZone: { type: String, default: 'UTC' }
}, { timestamps: true });

module.exports = mongoose.model('Interview', interviewSchema);

