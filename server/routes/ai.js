/**
 * /api/ai routes
 *
 * POST /api/ai/question   — Generate next interview question
 * POST /api/ai/tts        — Text → Speech (returns base64 audio)
 * POST /api/ai/transcribe — Audio URL/buffer → Transcript text
 * POST /api/ai/evaluate   — Transcript + question → Score + feedback
 */

const express   = require('express');
const router    = express.Router();
const multer    = require('multer');
const aiService = require('../services/aiService');
const { logger } = require('../utils/logger');

// Multer: memory storage (no disk writes) for audio uploads in this route
const upload = multer({
  storage: multer.memoryStorage(),
  limits:  { fileSize: 50 * 1024 * 1024 }, // 50 MB
});

// ── POST /api/ai/question ────────────────────────────────────────────────
// Body: { role, level, topic, previousQuestions? }
router.post('/question', async (req, res) => {
  try {
    const { role, level, topic, previousQuestions } = req.body;

    if (!role || !level) {
      return res.status(400).json({ error: 'role and level are required' });
    }

    const question = await aiService.generateQuestion({ role, level, topic, previousQuestions });
    res.json({ question });

  } catch (error) {
    logger.error('[/api/ai/question] Error:', error);
    res.status(500).json({ error: 'Failed to generate question' });
  }
});

// ── POST /api/ai/tts ─────────────────────────────────────────────────────
// Body: { text }
// Returns: { audioBase64, mimeType }
router.post('/tts', async (req, res) => {
  try {
    const { text } = req.body;

    if (!text || text.trim().length === 0) {
      return res.status(400).json({ error: 'text is required' });
    }

    const audioBase64 = await aiService.generateTextToSpeech(text.trim());

    if (!audioBase64) {
      // TTS unavailable — inform client to use text-only mode
      return res.json({ audioBase64: null, message: 'TTS unavailable; use text display' });
    }

    res.json({ audioBase64, mimeType: 'audio/mp3' });

  } catch (error) {
    logger.error('[/api/ai/tts] Error:', error);
    res.status(500).json({ error: 'TTS generation failed' });
  }
});

// ── POST /api/ai/transcribe ──────────────────────────────────────────────
// Accepts multipart audio file OR JSON { audioBase64 }
router.post('/transcribe', upload.single('audio'), async (req, res) => {
  try {
    let audioBuffer;

    if (req.file) {
      // Multipart upload
      audioBuffer = req.file.buffer;
    } else if (req.body.audioBase64) {
      // Base64-encoded JSON body
      audioBuffer = Buffer.from(req.body.audioBase64, 'base64');
    } else {
      return res.status(400).json({ error: 'Provide audio file or audioBase64' });
    }

    const transcript = await aiService.transcribeAudio(audioBuffer);
    res.json({ transcript });

  } catch (error) {
    logger.error('[/api/ai/transcribe] Error:', error);
    res.status(500).json({ error: 'Transcription failed' });
  }
});

// ── POST /api/ai/evaluate ────────────────────────────────────────────────
// Body: { question, transcript or answerText }
router.post('/evaluate', async (req, res) => {
  try {
    const { question, transcript, answerText } = req.body;
    const answer = transcript || answerText || '';

    if (!question) {
      return res.status(400).json({ error: 'question is required' });
    }

    const evaluation = await aiService.evaluateAnswer(question, answer);
    res.json(evaluation);

  } catch (error) {
    logger.error('[/api/ai/evaluate] Error:', error);
    res.status(500).json({ error: 'Evaluation failed' });
  }
});

module.exports = router;
