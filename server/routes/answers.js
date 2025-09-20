const express = require('express');
const router = express.Router();
const Answer = require('../models/Answer');

// Save or update answer
router.post('/', async (req, res) => {
  try {
    const { interviewId, candidateId, questionId, answerText, audioUrl } = req.body;
    const answer = await Answer.findOneAndUpdate(
      { interviewId, candidateId, questionId },
      { answerText, audioUrl },
      { upsert: true, new: true }
    );
    res.json(answer);
  } catch (err) {
    res.status(500).json({ error: 'Failed to save answer' });
  }
});

// Get all answers for an interview
router.get('/by-interview/:interviewId', async (req, res) => {
  try {
    const answers = await Answer.find({ interviewId: req.params.interviewId });
    res.json(answers);
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch answers' });
  }
});

module.exports = router;