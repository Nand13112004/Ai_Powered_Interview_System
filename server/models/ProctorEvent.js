const mongoose = require('mongoose');

const proctorEventSchema = new mongoose.Schema({
  sessionId: { type: String, required: true },
  type: { type: String, required: true },
  metadata: { type: String, default: '{}' },
  createdAt: { type: Date, default: Date.now },
});

module.exports = mongoose.model('ProctorEvent', proctorEventSchema);

