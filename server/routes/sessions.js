const express = require('express');
const router = express.Router();
const Session = require('../models/Session');
const Interview = require('../models/Interview');
const { logger } = require('../utils/logger');

// Get user's sessions
router.get('/', async (req, res) => {
  try {
    const sessions = await Session.find({ userId: req.user.id })
      .populate('interviewId', 'title duration level role')
      .sort({ createdAt: -1 });

    // Transform sessions to match client expectations
    const transformedSessions = sessions.map(session => ({
      id: session._id,
      status: session.status,
      startedAt: session.startedAt || session.createdAt,
      completedAt: session.completedAt,
      duration: session.duration,
      interview: {
        id: session.interviewId._id,
        title: session.interviewId.title,
        duration: session.interviewId.duration,
        level: session.interviewId.level,
        role: session.interviewId.role
      },
      scores: session.scores,
      feedback: session.feedback
    }));

    res.json({ sessions: transformedSessions });
  } catch (error) {
    logger.error('Error fetching sessions:', error);
    res.status(500).json({ error: 'Failed to fetch sessions' });
  }
});

// Create and start a new session
router.post('/', async (req, res) => {
  try {
    const { interviewId } = req.body;

    if (!interviewId) {
      return res.status(400).json({ error: 'Interview ID is required' });
    }

    // Check if interview exists
    const interview = await Interview.findById(interviewId);
    if (!interview) {
      return res.status(404).json({ error: 'Interview not found' });
    }

    // Create session
    const session = await Session.create({
      userId: req.user.id,
      interviewId: interviewId,
      status: 'in_progress',
      startedAt: new Date()
    });

    logger.info(`Session ${session._id} created and started for user ${req.user.id}`);

    res.json({ sessionId: session._id });
  } catch (error) {
    logger.error('Error creating session:', error);
    res.status(500).json({ error: 'Failed to create session' });
  }
});

// Verify interview password and check scheduling
router.post('/verify-entry', async (req, res) => {
  try {
    const { interviewCode, password, userId } = req.body;

    if (!interviewCode || !password) {
      return res.status(400).json({
        error: 'Interview code and password are required'
      });
    }

    // Find interview
    const interview = await Interview.findOne({ code: interviewCode });
    if (!interview) {
      return res.status(404).json({
        error: 'Interview not found'
      });
    }

    // Check password
    if (interview.password !== password) {
      return res.status(401).json({
        error: 'Invalid password'
      });
    }

    // Check if interview is scheduled
    if (interview.isScheduled) {
      const now = new Date();
      
      // Check if interview has started
      if (interview.scheduledStartTime && now < interview.scheduledStartTime) {
        const timeUntilStart = Math.max(0, interview.scheduledStartTime - now);
        return res.status(403).json({
          error: 'Interview has not started yet',
          scheduledStartTime: interview.scheduledStartTime,
          timeUntilStart: timeUntilStart,
          canStart: false
        });
      }

      // Check if interview has ended
      if (interview.scheduledEndTime && now > interview.scheduledEndTime) {
        if (!interview.allowLateJoin) {
          return res.status(403).json({
            error: 'Interview has ended and late join is not allowed',
            scheduledEndTime: interview.scheduledEndTime,
            canStart: false
          });
        }
      }
    }

    // Check if interview is active
    if (!interview.isActive) {
      return res.status(403).json({
        error: 'Interview is not active'
      });
    }

    // Create or update session
    let session = await Session.findOne({ 
      userId: userId || req.user.id, 
      interviewId: interview._id,
      status: { $in: ['pending', 'in_progress'] }
    });

    if (!session) {
      session = await Session.create({
        userId: userId || req.user.id,
        interviewId: interview._id,
        status: 'pending',
        entryTime: new Date()
      });
    } else {
      session.entryTime = new Date();
      await session.save();
    }

    res.json({
      success: true,
      sessionId: session._id,
      interview: {
        id: interview._id,
        title: interview.title,
        timeSlot: {
          start: interview.scheduledStartTime,
          end: interview.scheduledEndTime
        },
        duration: interview.duration,
        allowLateJoin: interview.allowLateJoin
      },
      session: {
        id: session._id,
        status: session.status,
        entryTime: session.entryTime
      }
    });

  } catch (error) {
    logger.error('Error verifying interview entry:', error);
    res.status(500).json({
      error: 'Failed to verify interview entry'
    });
  }
});

// Start interview session
router.post('/start/:sessionId', async (req, res) => {
  try {
    const { sessionId } = req.params;
    const { startVideoRecording = true, startAudioRecording = true } = req.body;

    const session = await Session.findById(sessionId);
    if (!session) {
      return res.status(404).json({
        error: 'Session not found'
      });
    }

    // Verify access
    if (session.userId !== req.user.id && req.user.role !== 'interviewer') {
      return res.status(403).json({
        error: 'Access denied'
      });
    }

    // Update session
    session.status = 'in_progress';
    session.startedAt = new Date();
    session.recordingSettings = {
      video: startVideoRecording,
      audio: startAudioRecording,
      quality: 'medium',
      startedAt: new Date()
    };
    await session.save();

    logger.info(`Interview session ${sessionId} started for user ${req.user.id}`);

    res.json({
      success: true,
      session: {
        id: session._id,
        status: session.status,
        startedAt: session.startedAt,
        recordingSettings: session.recordingSettings
      }
    });

  } catch (error) {
    logger.error('Error starting session:', error);
    res.status(500).json({
      error: 'Failed to start session'
    });
  }
});

// Complete interview session
router.post('/complete/:sessionId', async (req, res) => {
  try {
    const { sessionId } = req.params;
    const { videoData, audioData, transcript } = req.body;

    const session = await Session.findById(sessionId);
    if (!session) {
      return res.status(404).json({
        error: 'Session not found'
      });
    }

    // Verify access
    if (session.userId !== req.user.id && req.user.role !== 'interviewer') {
      return res.status(403).json({
        error: 'Access denied'
      });
    }

    // Calculate duration
    const now = new Date();
    const duration = session.startedAt ? 
      Math.round((now - session.startedAt) / 1000 / 60) : 0;

    // Update session
    session.status = 'completed';
    session.completedAt = now;
    session.duration = duration;
    
    if (videoData) {
      session.videoData = Buffer.from(videoData, 'base64');
      session.fileSizes = session.fileSizes || {};
      session.fileSizes.video = session.videoData.length;
    }
    
    if (audioData) {
      session.audioData = Buffer.from(audioData, 'base64');
      session.fileSizes = session.fileSizes || {};
      session.fileSizes.audio = session.audioData.length;
    }
    
    if (transcript) {
      session.transcript = transcript;
    }

    await session.save();

    logger.info(`Interview session ${sessionId} completed. Duration: ${duration} minutes`);

    res.json({
      success: true,
      session: {
        id: session._id,
        status: session.status,
        duration: session.duration,
        completedAt: session.completedAt,
        fileSizes: session.fileSizes
      }
    });

  } catch (error) {
    logger.error('Error completing session:', error);
    res.status(500).json({
      error: 'Failed to complete session'
    });
  }
});

// Download session media files
router.get('/download/:sessionId/:mediaType', async (req, res) => {
  try {
    const { sessionId, mediaType } = req.params;
    const { type = 'original' } = req.query; // original, compressed, etc.

    if (!['video', 'audio'].includes(mediaType)) {
      return res.status(400).json({
        error: 'Invalid media type. Use "video" or "audio"'
      });
    }

    const session = await Session.findById(sessionId);
    if (!session) {
      return res.status(404).json({
        error: 'Session not found'
      });
    }

    // Verify access
    if (session.userId !== req.user.id && req.user.role !== 'interviewer') {
      return res.status(403).json({
        error: 'Access denied'
      });
    }

    const mediaData = mediaType === 'video' ? session.videoData : session.audioData;
    const contentType = mediaType === 'video' ? 'video/webm' : 'audio/webm';

    if (!mediaData) {
      return res.status(404).json({
        error: `${mediaType} not found for this session`
      });
    }

    // Set headers for file download
    const fileName = `interview_${sessionId}_${mediaType}_${new Date().getTime()}.webm`;
    res.setHeader('Content-Type', contentType);
    res.setHeader('Content-Disposition', `attachment; filename="${fileName}"`);
    res.setHeader('Content-Length', mediaData.length);

    // Send file data
    res.send(mediaData);

  } catch (error) {
    logger.error('Error downloading media:', error);
    res.status(500).json({
      error: 'Failed to download media file'
    });
  }
});

// Get session details with time tracking
router.get('/:sessionId', async (req, res) => {
  try {
    const { sessionId } = req.params;

    const session = await Session.findById(sessionId)
      .populate('userId', 'name email')
      .populate('interviewId', 'title duration');

    if (!session) {
      return res.status(404).json({
        error: 'Session not found'
      });
    }

    // Verify access
    if (session.userId._id !== req.user.id && req.user.role !== 'interviewer') {
      return res.status(403).json({
        error: 'Access denied'
      });
    }

    res.json({
      success: true,
      session: {
        id: session._id,
        status: session.status,
        startedAt: session.startedAt,
        completedAt: session.completedAt,
        entryTime: session.entryTime,
        duration: session.duration,
        answerCount: session.answerCount,
        aiScore: session.aiScore,
        aiEvaluation: session.aiEvaluation,
        fileSizes: session.fileSizes,
        timeSpentPerQuestion: session.timeSpentPerQuestion
      },
      interview: session.interviewId,
      user: session.userId
    });

  } catch (error) {
    logger.error('Error fetching session:', error);
    res.status(500).json({
      error: 'Failed to fetch session'
    });
  }
});

module.exports = router;
