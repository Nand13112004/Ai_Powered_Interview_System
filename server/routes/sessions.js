const express = require('express');
const Joi = require('joi');
const { logger } = require('../utils/logger');
const Session = require('../models/Session');
const Interview = require('../models/Interview');

const router = express.Router();

// Using Mongoose models, no Prisma

// Validation schemas
const createSessionSchema = Joi.object({
  interviewId: Joi.string().required()
});

const updateSessionSchema = Joi.object({
  status: Joi.string().valid('in_progress', 'completed', 'cancelled').optional(),
  transcript: Joi.object().optional(),
  audioUrl: Joi.string().optional(),
  videoUrl: Joi.string().optional(),
  scores: Joi.object().optional(),
  feedback: Joi.object().optional()
});

// Get user's sessions
router.get('/', async (req, res) => {
  try {
    const sessionsRaw = await Session.find({ userId: req.user.id }).sort({ createdAt: -1 }).lean();
    // For interview info, fetch in batch
    const interviewIds = [...new Set(sessionsRaw.map(s => s.interviewId))];
    const interviews = await Interview.find({ _id: { $in: interviewIds } }).lean();
    const mapById = new Map(interviews.map(i => [i._id.toString(), i]));
    const sessions = sessionsRaw.map(s => ({
      id: s._id.toString(),
      userId: s.userId,
      interviewId: s.interviewId,
      status: s.status,
      startedAt: s.startedAt,
      completedAt: s.completedAt,
      duration: s.duration,
      createdAt: s.createdAt,
      interview: mapById.get(s.interviewId) ? {
        id: mapById.get(s.interviewId)._id.toString(),
        title: mapById.get(s.interviewId).title,
        role: mapById.get(s.interviewId).role,
        level: mapById.get(s.interviewId).level,
        duration: mapById.get(s.interviewId).duration,
      } : null,
    }));

    res.json({ sessions });
  } catch (error) {
    logger.error('Error fetching sessions:', error);
    res.status(500).json({ error: 'Failed to fetch sessions' });
  }
});

// Get session by ID
router.get('/:id', async (req, res) => {
  try {
    const { id } = req.params;

    const sessionDoc = await Session.findOne({ _id: id, userId: req.user.id }).lean();
    if (!sessionDoc) {
      return res.status(404).json({ error: 'Session not found' });
    }
    const interview = await Interview.findById(sessionDoc.interviewId).lean();
    const session = {
      id: sessionDoc._id.toString(),
      userId: sessionDoc.userId,
      interviewId: sessionDoc.interviewId,
      status: sessionDoc.status,
      startedAt: sessionDoc.startedAt,
      completedAt: sessionDoc.completedAt,
      duration: sessionDoc.duration,
      transcript: sessionDoc.transcript,
      scores: sessionDoc.scores,
      feedback: sessionDoc.feedback,
      interview: interview ? {
        id: interview._id.toString(),
        title: interview.title,
        role: interview.role,
        level: interview.level,
        duration: interview.duration,
      } : null,
    };

    if (!session) {
      return res.status(404).json({ error: 'Session not found' });
    }

    res.json({ session });
  } catch (error) {
    logger.error('Error fetching session:', error);
    res.status(500).json({ error: 'Failed to fetch session' });
  }
});

// Create new session (or resume existing)
router.post('/', async (req, res) => {
  try {
    const { error, value } = createSessionSchema.validate(req.body);
    if (error) {
      return res.status(400).json({ error: error.details[0].message });
    }

    const { interviewId } = value;

    const interview = await Interview.findById(interviewId).lean();

    if (!interview) {
      return res.status(404).json({ error: 'Interview not found' });
    }

    // Check if user already has ANY session for this interview (one-time join policy)
    const existingSession = await Session.findOne({ userId: req.user.id, interviewId }).lean();

    if (existingSession) {
      // If session is completed, don't allow re-entry
      if (existingSession.status === 'completed') {
        return res.status(409).json({ 
          error: 'Interview already completed',
          message: 'You have already completed this interview. Each candidate can only participate once.',
          sessionId: existingSession._id.toString(),
          existingSession: {
            id: existingSession._id.toString(),
            status: existingSession.status,
            startedAt: existingSession.startedAt,
            completedAt: existingSession.completedAt
          }
        });
      }
      
      // If session is pending or in_progress, allow resumption
      return res.status(200).json({ 
        message: 'Resuming existing interview session',
        sessionId: existingSession._id.toString(),
        existingSession: {
          id: existingSession._id.toString(),
          status: existingSession.status,
          startedAt: existingSession.startedAt,
          completedAt: existingSession.completedAt
        }
      });
    }

    const created = await Session.create({ userId: req.user.id, interviewId, status: 'pending' });
    const session = {
      id: created._id.toString(),
      userId: created.userId,
      interviewId: created.interviewId,
      status: created.status,
      startedAt: created.startedAt,
      completedAt: created.completedAt,
      duration: created.duration,
      interview: {
        id: interview._id.toString(),
        title: interview.title,
        role: interview.role,
        level: interview.level,
        duration: interview.duration,
      }
    };

    logger.info(`New session created: ${session.id} for user ${req.user.email}`);

    res.status(201).json({
      message: 'Session created successfully',
      session
    });
  } catch (error) {
    logger.error('Error creating session:', error);
    res.status(500).json({ error: 'Failed to create session' });
  }
});

// Update session
router.put('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { error, value } = updateSessionSchema.validate(req.body);
    if (error) {
      return res.status(400).json({ error: error.details[0].message });
    }

    // Verify session belongs to user
    const existingSession = await Session.findOne({ _id: id, userId: req.user.id });

    if (!existingSession) {
      return res.status(404).json({ error: 'Session not found' });
    }

    // Update timestamps based on status
    const updateData = { ...value };
    if (value.status === 'in_progress' && !existingSession.startedAt) {
      updateData.startedAt = new Date();
    }
    if (value.status === 'completed' && !existingSession.completedAt) {
      updateData.completedAt = new Date();
      if (existingSession.startedAt) {
        updateData.duration = Math.round(
          (new Date() - existingSession.startedAt) / 60000 // minutes
        );
      }
    }

    await Session.findByIdAndUpdate(id, updateData);
    const sessionDoc = await Session.findById(id).lean();
    const interview = await Interview.findById(sessionDoc.interviewId).lean();
    const session = {
      id: sessionDoc._id.toString(),
      userId: sessionDoc.userId,
      interviewId: sessionDoc.interviewId,
      status: sessionDoc.status,
      startedAt: sessionDoc.startedAt,
      completedAt: sessionDoc.completedAt,
      duration: sessionDoc.duration,
      transcript: sessionDoc.transcript,
      scores: sessionDoc.scores,
      feedback: sessionDoc.feedback,
      interview: interview ? {
        id: interview._id.toString(),
        title: interview.title,
        role: interview.role,
        level: interview.level,
        duration: interview.duration,
      } : null,
    };

    logger.info(`Session updated: ${id} by ${req.user.email}`);

    res.json({
      message: 'Session updated successfully',
      session
    });
  } catch (error) {
    logger.error('Error updating session:', error);
    res.status(500).json({ error: 'Failed to update session' });
  }
});

// Delete session
router.delete('/:id', async (req, res) => {
  try {
    const { id } = req.params;

    // Verify session belongs to user
    const session = await Session.findOne({ _id: id, userId: req.user.id });

    if (!session) {
      return res.status(404).json({ error: 'Session not found' });
    }

    await Session.findByIdAndDelete(id);

    logger.info(`Session deleted: ${id} by ${req.user.email}`);

    res.json({ message: 'Session deleted successfully' });
  } catch (error) {
    logger.error('Error deleting session:', error);
    res.status(500).json({ error: 'Failed to delete session' });
  }
});

// Start fresh session (complete existing one first)
router.post('/fresh', async (req, res) => {
  try {
    const { error, value } = createSessionSchema.validate(req.body);
    if (error) {
      return res.status(400).json({ error: error.details[0].message });
    }

    const { interviewId } = value;

    // Verify interview exists
    const interview = await Interview.findById(interviewId);

    if (!interview) {
      return res.status(404).json({ error: 'Interview not found' });
    }

    // Complete any existing active sessions for this interview
    await Session.updateMany({ userId: req.user.id, interviewId, status: { $in: ['pending', 'in_progress'] } }, { status: 'completed', completedAt: new Date() });

    // Create new session
    const created = await Session.create({ userId: req.user.id, interviewId, status: 'pending' });
    const session = {
      id: created._id.toString(),
      userId: created.userId,
      interviewId: created.interviewId,
      status: created.status,
      interview: {
        id: interview._id.toString(),
        title: interview.title,
        role: interview.role,
        level: interview.level,
        duration: interview.duration,
      }
    };

    logger.info(`New fresh session created: ${session.id} for user ${req.user.email}`);

    res.status(201).json({
      message: 'Fresh session created successfully',
      session
    });
  } catch (error) {
    logger.error('Error creating fresh session:', error);
    res.status(500).json({ error: 'Failed to create fresh session' });
  }
});

module.exports = router;
