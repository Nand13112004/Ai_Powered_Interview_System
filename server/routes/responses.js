const express = require('express');
const router = express.Router();
const Response = require('../models/Response');
const { authenticateToken } = require('../middleware/auth');
const { logger } = require('../utils/logger');

// Apply authentication middleware to all routes
router.use(authenticateToken);

// Create new response
router.post('/', async (req, res) => {
  try {
    const { userId, interviewId, sessionId, questionId, text, audioData } = req.body;

    // Validate required fields
    if (!userId || !interviewId || !sessionId || !questionId) {
      return res.status(400).json({
        error: 'Missing required fields',
        message: 'userId, interviewId, sessionId, and questionId are required'
      });
    }

    // Ensure user can only submit responses for themselves
    if (req.user.id !== userId) {
      return res.status(403).json({
        error: 'Forbidden',
        message: 'You can only submit responses for yourself'
      });
    }

    const response = await Response.create({
      userId,
      interviewId,
      sessionId,
      questionId,
      text,
      audioData: audioData ? Buffer.from(audioData, 'base64') : undefined
    });

    logger.info(`Response saved for user ${req.user.id}, interview ${interviewId}, question ${questionId}`);

    res.status(201).json({
      success: true,
      message: 'Response saved successfully',
      data: response
    });
  } catch (err) {
    logger.error('Error saving response:', err);
    res.status(500).json({
      error: 'Failed to save response',
      message: 'An error occurred while saving the response'
    });
  }
});

// Get responses for current user by interview
router.get('/my-responses/:interviewId', async (req, res) => {
  try {
    const { interviewId } = req.params;
    const userId = req.user.id;

    if (!interviewId) {
      return res.status(400).json({
        error: 'Missing interview ID',
        message: 'interviewId parameter is required'
      });
    }

    const responses = await Response.find({
      interviewId: req.params.interviewId,
      userId: userId
    }).sort({ createdAt: 1 });

    res.json({
      success: true,
      data: responses
    });
  } catch (err) {
    logger.error('Error fetching user responses:', err);
    res.status(500).json({
      error: 'Failed to fetch responses',
      message: 'An error occurred while fetching your responses'
    });
  }
});

module.exports = router;
