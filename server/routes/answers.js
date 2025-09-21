const express = require('express');
const router = express.Router();
const Answer = require('../models/Answer');
const { authenticateToken } = require('../middleware/auth');
const { logger } = require('../utils/logger');

// Apply authentication middleware to all routes
router.use(authenticateToken);

// Save or update answer
router.post('/', async (req, res) => {
  try {
    const { interviewId, candidateId, questionId, answerText, audioUrl } = req.body;

    // Validate required fields
    if (!interviewId || !candidateId || !questionId) {
      return res.status(400).json({
        error: 'Missing required fields',
        message: 'interviewId, candidateId, and questionId are required'
      });
    }

    // Ensure user can only submit answers for themselves
    if (req.user.id !== candidateId) {
      return res.status(403).json({
        error: 'Forbidden',
        message: 'You can only submit answers for yourself'
      });
    }

    const answer = await Answer.findOneAndUpdate(
      { interviewId, candidateId, questionId },
      {
        answerText,
        audioUrl,
        createdAt: new Date()
      },
      { upsert: true, new: true }
    );

    logger.info(`Answer saved for user ${req.user.id}, interview ${interviewId}, question ${questionId}`);

    res.json({
      success: true,
      message: 'Answer saved successfully',
      data: answer
    });
  } catch (err) {
    logger.error('Error saving answer:', err);
    res.status(500).json({
      error: 'Failed to save answer',
      message: 'An error occurred while saving the answer'
    });
  }
});

// Get all answers for an interview
router.get('/by-interview/:interviewId', async (req, res) => {
  try {
    const { interviewId } = req.params;

    if (!interviewId) {
      return res.status(400).json({
        error: 'Missing interview ID',
        message: 'interviewId parameter is required'
      });
    }

    const answers = await Answer.find({ interviewId: req.params.interviewId });

    res.json({
      success: true,
      data: answers
    });
  } catch (err) {
    logger.error('Error fetching answers:', err);
    res.status(500).json({
      error: 'Failed to fetch answers',
      message: 'An error occurred while fetching answers'
    });
  }
});

// Get answers for current user by interview
router.get('/my-answers/:interviewId', async (req, res) => {
  try {
    const { interviewId } = req.params;
    const userId = req.user.id;

    if (!interviewId) {
      return res.status(400).json({
        error: 'Missing interview ID',
        message: 'interviewId parameter is required'
      });
    }

    const answers = await Answer.find({
      interviewId: req.params.interviewId,
      candidateId: userId
    });

    res.json({
      success: true,
      data: answers
    });
  } catch (err) {
    logger.error('Error fetching user answers:', err);
    res.status(500).json({
      error: 'Failed to fetch answers',
      message: 'An error occurred while fetching your answers'
    });
  }
});

module.exports = router;
