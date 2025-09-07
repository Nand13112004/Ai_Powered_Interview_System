require('dotenv').config();
const express = require('express');
const { GoogleGenerativeAI } = require('@google/generative-ai');

const router = express.Router();

router.post('/', async (req, res) => {
  try {
    const { role, level } = req.body;
    if (!role || !level) {
      return res.status(400).json({ error: 'Role and level are required' });
    }

    const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
    const model = genAI.getGenerativeModel({ model: 'gemini-1.5-flash' });
    const prompt = `generate 5 question for ${level} level ${role} role`;
    const result = await model.generateContent(prompt);
    const response = await result.response;
    const text = response.text();

    // Split into array by newlines, clean up numbering
    const questions = text
      .split('\n')
      .map(q => q.replace(/^[\d]+[\).\s-]?\s*/, '').trim())
      .filter(q => q.length > 0);

    res.json({ questions });
  } catch (error) {
    console.error('Gemini API error:', error.message);
    res.status(500).json({ error: 'Failed to generate questions' });
  }
});

module.exports = router;
