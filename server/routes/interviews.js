const express = require('express');
const Joi = require('joi');
const { PrismaClient } = require('@prisma/client');
const { logger } = require('../utils/logger');

const router = express.Router();
const prisma = new PrismaClient();

// Validation schemas
const createInterviewSchema = Joi.object({
  title: Joi.string().min(3).required(),
  description: Joi.string().optional(),
  role: Joi.string().required(),
  level: Joi.string().valid('junior', 'mid', 'senior').required(),
  duration: Joi.number().min(15).max(120).required(),
  questions: Joi.array().items(Joi.string()).min(1).required(),
  rubric: Joi.object().required()
});

// Get all interviews
router.get('/', async (req, res) => {
  try {
    const interviews = await prisma.interview.findMany({
      where: { isActive: true, userId: req.user.id },
      select: {
        id: true,
        title: true,
        description: true,
        role: true,
        level: true,
        duration: true,
        createdAt: true
      },
      orderBy: { createdAt: 'desc' }
    });

    res.json({ interviews });
  } catch (error) {
    logger.error('Error fetching interviews:', error);
    res.status(500).json({ error: 'Failed to fetch interviews' });
  }
});

// Get interview by ID
router.get('/:id', async (req, res) => {
  try {
    const { id } = req.params;

    const interview = await prisma.interview.findUnique({
      where: { id },
      select: {
        id: true,
        title: true,
        description: true,
        role: true,
        level: true,
        duration: true,
        questions: true,
        rubric: true,
        createdAt: true
      }
    });

    if (!interview) {
      return res.status(404).json({ error: 'Interview not found' });
    }

    res.json({ interview });
  } catch (error) {
    logger.error('Error fetching interview:', error);
    res.status(500).json({ error: 'Failed to fetch interview' });
  }
});

// Create new interview (admin only)
router.post('/', async (req, res) => {
  try {
    if (req.user.role !== 'admin' && req.user.role !== 'interviewer') {
      return res.status(403).json({ error: 'Admin or interviewer access required' });
    }

    const { error, value } = createInterviewSchema.validate(req.body);
    if (error) {
      return res.status(400).json({ error: error.details[0].message });
    }

    const { title, description, role, level, duration, questions, rubric } = value;

    const interview = await prisma.interview.create({
      data: {
        title,
        description,
        role,
        level,
        duration,
        questions,
        rubric,
        userId: req.user.id
      }
    });

    logger.info(`New interview created: ${title} by ${req.user.email}`);

    res.status(201).json({
      message: 'Interview created successfully',
      interview
    });
  } catch (error) {
    logger.error('Error creating interview:', error);
    res.status(500).json({ error: 'Failed to create interview' });
  }
});

// Update interview (admin only)
router.put('/:id', async (req, res) => {
  try {
    if (req.user.role !== 'admin') {
      return res.status(403).json({ error: 'Admin access required' });
    }

    const { id } = req.params;
    const { error, value } = createInterviewSchema.validate(req.body);
    if (error) {
      return res.status(400).json({ error: error.details[0].message });
    }

    const interview = await prisma.interview.update({
      where: { id },
      data: value
    });

    logger.info(`Interview updated: ${id} by ${req.user.email}`);

    res.json({
      message: 'Interview updated successfully',
      interview
    });
  } catch (error) {
    logger.error('Error updating interview:', error);
    res.status(500).json({ error: 'Failed to update interview' });
  }
});

// Delete interview (admin only)
router.delete('/:id', async (req, res) => {
  try {
    if (req.user.role !== 'admin') {
      return res.status(403).json({ error: 'Admin access required' });
    }

    const { id } = req.params;

    await prisma.interview.update({
      where: { id },
      data: { isActive: false }
    });

    logger.info(`Interview deactivated: ${id} by ${req.user.email}`);

    res.json({ message: 'Interview deleted successfully' });
  } catch (error) {
    logger.error('Error deleting interview:', error);
    res.status(500).json({ error: 'Failed to delete interview' });
  }
});

module.exports = router;
