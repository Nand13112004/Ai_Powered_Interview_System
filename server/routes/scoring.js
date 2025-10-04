const express = require('express');
const router = express.Router();
const Response = require('../models/Response');
const Question = require('../models/Question');
const Session = require('../models/Session');
const scoringService = require('../services/scoringService');
const { authenticateToken } = require('../middleware/auth');
const { logger } = require('../utils/logger');

// Apply authentication middleware
router.use(authenticateToken);

// Score a single response
router.post('/score-response', async (req, res) => {
  try {
    const { responseId } = req.body;

    if (!responseId) {
      return res.status(400).json({
        error: 'Response ID is required'
      });
    }

    // Get response with question details
    const response = await Response.findById(responseId)
      .populate('questionId');

    if (!response) {
      return res.status(404).json({
        error: 'Response not found'
      });
    }

    // Ensure user has access to this response
    if (response.userId !== req.user.id && req.user.role !== 'interviewer') {
      return res.status(403).json({
        error: 'Access denied'
      });
    }

    // Score the response
    const evaluation = await scoringService.evaluateResponse(
      response.questionId,
      response.text,
      response.text // Using same text for now
    );

    // Update response with score
    response.aiScore = evaluation.score;
    response.aiEvaluation = evaluation;
    await response.save();

    res.json({
      success: true,
      evaluation
    });

  } catch (error) {
    logger.error('Error scoring response:', error);
    res.status(500).json({
      error: 'Failed to score response'
    });
  }
});

// Score all responses for an interview session
router.post('/score-session', async (req, res) => {
  try {
    const { sessionId } = req.body;

    if (!sessionId) {
      return res.status(400).json({
        error: 'Session ID is required'
      });
    }

    // Get all responses for the session
    const responses = await Response.find({ sessionId })
      .populate('questionId')
      .sort({ createdAt: 1 });

    if (responses.length === 0) {
      return res.status(404).json({
        error: 'No responses found for this session'
      });
    }

    // Ensure user has access to this session
    const session = await Session.findById(sessionId);
    if (!session) {
      return res.status(404).json({
        error: 'Session not found'
      });
    }

    if (session.userId !== req.user.id && req.user.role !== 'interviewer') {
      return res.status(403).json({
        error: 'Access denied'
      });
    }

    // Score all responses
    const evaluation = await scoringService.evaluateMultipleResponses(responses);

    // Update session with overall evaluation
    session.aiEvaluation = evaluation;
    session.aiScore = evaluation.overallScore;
    await session.save();

    // Update individual responses with scores
    for (let i = 0; i < responses.length; i++) {
      responses[i].aiScore = evaluation.questionEvaluations[i].score;
      responses[i].aiEvaluation = evaluation.questionEvaluations[i];
      await responses[i].save();
    }

    res.json({
      success: true,
      evaluation,
      sessionScore: evaluation.overallScore
    });

  } catch (error) {
    logger.error('Error scoring session:', error);
    res.status(500).json({
      error: 'Failed to score session'
    });
  }
});

// Get scores for an interview
router.get('/scores/:interviewId', async (req, res) => {
  try {
    const { interviewId } = req.params;

    // Get all sessions for this interview
    const sessions = await Session.find({ interviewId }).populate('userId', 'name email');

    if (req.user.role !== 'interviewer') {
      // Candidates can only see their own sessions
      const userSessions = sessions.filter(session => session.userId.toString() === req.user.id);
      return res.json({ sessions: userSessions });
    }

    res.json({ sessions });

  } catch (error) {
    logger.error('Error fetching scores:', error);
    res.status(500).json({
      error: 'Failed to fetch scores'
    });
  }
});

module.exports = router;
