const express = require('express');
const Joi = require('joi');
const { PrismaClient } = require('@prisma/client');
const { logger } = require('../utils/logger');

const router = express.Router();

// Initialize Prisma client with error handling
let prisma;
try {
  prisma = new PrismaClient();
} catch (error) {
  logger.error('Failed to initialize Prisma client in sessions routes:', error);
  prisma = null;
}

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
    const sessions = await prisma.session.findMany({
      where: { userId: req.user.id },
      include: {
        interview: {
          select: {
            id: true,
            title: true,
            role: true,
            level: true,
            duration: true,
            questions: true
          }
        }
      },
      orderBy: { createdAt: 'desc' }
    });

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

    const session = await prisma.session.findFirst({
      where: { 
        id,
        userId: req.user.id // Ensure user can only access their own sessions
      },
      include: {
        interview: true
      }
    });

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

    // Verify interview exists
    const interview = await prisma.interview.findUnique({
      where: { id: interviewId }
    });

    if (!interview) {
      return res.status(404).json({ error: 'Interview not found' });
    }

    // Check if user already has ANY session for this interview (one-time join policy)
    const existingSession = await prisma.session.findFirst({
      where: {
        userId: req.user.id,
        interviewId
      }
    });

    if (existingSession) {
      return res.status(409).json({ 
        error: 'Interview already attempted',
        message: 'You have already participated in this interview. Each candidate can only join once.',
        sessionId: existingSession.id,
        existingSession: {
          id: existingSession.id,
          status: existingSession.status,
          startedAt: existingSession.startedAt,
          completedAt: existingSession.completedAt
        }
      });
    }

    const session = await prisma.session.create({
      data: {
        userId: req.user.id,
        interviewId,
        status: 'pending'
      },
      include: {
        interview: true
      }
    });

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
    const existingSession = await prisma.session.findFirst({
      where: { 
        id,
        userId: req.user.id
      }
    });

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

    const session = await prisma.session.update({
      where: { id },
      data: updateData,
      include: {
        interview: true
      }
    });

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
    const session = await prisma.session.findFirst({
      where: { 
        id,
        userId: req.user.id
      }
    });

    if (!session) {
      return res.status(404).json({ error: 'Session not found' });
    }

    await prisma.session.delete({
      where: { id }
    });

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
    const interview = await prisma.interview.findUnique({
      where: { id: interviewId }
    });

    if (!interview) {
      return res.status(404).json({ error: 'Interview not found' });
    }

    // Complete any existing active sessions for this interview
    if (prisma) {
      try {
        await prisma.session.updateMany({
          where: {
            userId: req.user.id,
            interviewId,
            status: { in: ['pending', 'in_progress'] }
          },
          data: {
            status: 'completed',
            completedAt: new Date()
          }
        });
      } catch (dbError) {
        logger.warn('Failed to complete existing sessions:', dbError.message);
      }
    }

    // Create new session
    const session = await prisma.session.create({
      data: {
        userId: req.user.id,
        interviewId,
        status: 'pending'
      },
      include: {
        interview: true
      }
    });

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
