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

    if (!process.env.GEMINI_API_KEY) {
      return res.status(500).json({ error: 'GEMINI_API_KEY is not configured on the server' });
    }

    const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
    const model = genAI.getGenerativeModel({ model: 'gemini-1.5-flash' });
    const prompt = `Generate 5 concise interview questions for a ${level} ${role}. Return only the questions as a simple list, no explanations.`;
    const result = await model.generateContent(prompt);
    const response = await result.response;
    const text = response.text();

    // Split into array by newlines, clean up numbering
    const questions = text
      .split('\n')
      .map(q => q
        // strip markdown bullets or numbers like "1.", "1)", "- ", "* "
        .replace(/^([\s>*-]*)([\d]+[\).\-]?\s*|[\-*+]\s*)?/, '')
        .trim()
      )
      .filter(q => q.length > 0)
      .slice(0, 5);

    res.json({ questions });
  } catch (error) {
    console.error('Gemini API error:', error);
    const message = process.env.NODE_ENV === 'development' && error?.message ? error.message : 'Failed to generate questions';
    res.status(500).json({ error: message });
  }
});

module.exports = router;
