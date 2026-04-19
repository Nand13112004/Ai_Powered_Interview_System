/**
 * /api/audio routes
 *
 * POST /api/audio/upload         — Upload audio blob → Cloudinary, transcribe, evaluate, save
 * GET  /api/interview/session/:id — Full session with audio URLs + transcripts
 */

const express       = require('express');
const router        = express.Router();
const multer        = require('multer');
const audioService  = require('../services/audioService');
const InterviewResponse = require('../models/Response');
const Session       = require('../models/Session');
const { logger }    = require('../utils/logger');

// Memory storage — process buffer in-flight, no temp files
const upload = multer({
  storage: multer.memoryStorage(),
  limits:  { fileSize: 50 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    const allowed = ['audio/webm', 'audio/ogg', 'audio/wav', 'audio/mp4', 'audio/mpeg', 'video/webm'];
    if (allowed.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error(`Unsupported audio type: ${file.mimetype}`));
    }
  },
});

// ── POST /api/audio/upload ───────────────────────────────────────────────
// Accepts multipart: audio file + fields { question, sessionId, interviewId, questionId }
// OR JSON: { audioBase64, question, sessionId, interviewId, questionId }
router.post('/upload', upload.single('audio'), async (req, res) => {
  try {
    const {
      question    = '',
      sessionId,
      interviewId,
      questionId,
    } = req.body;

    const userId = req.user?.id || req.user?._id;

    if (!sessionId || !questionId) {
      return res.status(400).json({ error: 'sessionId and questionId are required' });
    }

    let audioBuffer;
    if (req.file) {
      audioBuffer = req.file.buffer;
    } else if (req.body.audioBase64) {
      audioBuffer = Buffer.from(req.body.audioBase64, 'base64');
    } else {
      return res.status(400).json({ error: 'Provide audio file or audioBase64' });
    }

    logger.info(`[/api/audio/upload] Processing voice answer — session:${sessionId}, question:${questionId}`);

    const result = await audioService.processVoiceAnswer({
      audioBuffer,
      question,
      sessionId,
      interviewId: interviewId || '',
      questionId,
      userId,
    });

    res.json({
      success: true,
      ...result,
    });

  } catch (error) {
    logger.error('[/api/audio/upload] Error:', error);
    res.status(500).json({ error: error.message || 'Audio upload failed' });
  }
});

// ── GET /api/audio/session/:sessionId ────────────────────────────────────
// Returns full session data with all audio URLs + transcripts
router.get('/session/:sessionId', async (req, res) => {
  try {
    const { sessionId } = req.params;

    // Verify session belongs to this user (or user is interviewer/admin)
    const session = await Session.findById(sessionId)
      .populate('interviewId', 'title role level duration questions');

    if (!session) {
      return res.status(404).json({ error: 'Session not found' });
    }

    const userId = req.user?.id || req.user?._id;
    const isOwner    = session.userId?.toString() === userId?.toString();
    const isPrivileged = ['interviewer', 'admin'].includes(req.user?.role);

    if (!isOwner && !isPrivileged) {
      return res.status(403).json({ error: 'Access denied' });
    }

    // Fetch all responses for this session
    const responses = await InterviewResponse.find({ sessionId })
      .sort({ createdAt: 1 })
      .lean();

    res.json({
      session: {
        id:          session._id,
        status:      session.status,
        startedAt:   session.startedAt,
        completedAt: session.completedAt,
        duration:    session.duration,
      },
      interview: session.interviewId,
      responses: responses.map(r => ({
        id:           r._id,
        questionId:   r.questionId,
        question:     r.question,
        answerText:   r.answerText,
        inputMode:    r.inputMode,
        audioUrl:     r.audioUrl || null,
        transcript:   r.transcript || null,
        score:        r.score,
        strengths:    r.strengths,
        weaknesses:   r.weaknesses,
        improvements: r.improvements,
        createdAt:    r.createdAt,
      })),
    });

  } catch (error) {
    logger.error('[/api/audio/session] Error:', error);
    res.status(500).json({ error: 'Failed to fetch session details' });
  }
});

module.exports = router;
