const express = require('express');
const router = express.Router();
const Session = require('../models/Session');
const Interview = require('../models/Interview');
const { logger } = require('../utils/logger');
const fetch = require('node-fetch');

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

    // Enforce single attempt - by default, candidates can only take an interview once
    if (!interview.allowMultipleAttempts) {
      const existingSession = await Session.findOne({
        userId: req.user.id,
        interviewId: interviewId
      });
      if (existingSession) {
        return res.status(409).json({
          error: 'You have already taken this interview. Each candidate can only participate once.',
          sessionId: existingSession._id,
          existingSession: {
            id: existingSession._id,
            status: existingSession.status,
            startedAt: existingSession.startedAt,
            completedAt: existingSession.completedAt
          }
        });
      }
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

    // Check if interview is scheduled and enforce real-time scheduling
    if (interview.isScheduled) {
      const now = new Date();
      const startTime = new Date(interview.scheduledStartTime);
      const endTime = new Date(interview.scheduledEndTime);
      
      // Check if interview has started
      if (interview.scheduledStartTime && now < startTime) {
        const timeUntilStart = Math.max(0, startTime - now);
        const minutesUntilStart = Math.ceil(timeUntilStart / (1000 * 60));
        const secondsUntilStart = Math.ceil(timeUntilStart / 1000);
        
        return res.status(403).json({
          error: 'Interview has not started yet',
          scheduledStartTime: interview.scheduledStartTime,
          timeUntilStart: timeUntilStart,
          minutesUntilStart: minutesUntilStart,
          secondsUntilStart: secondsUntilStart,
          message: `Interview starts in ${minutesUntilStart} minutes`,
          canStart: false,
          requiresWaiting: true
        });
      }

      // Check if interview has ended
      if (interview.scheduledEndTime && now > endTime) {
        const timeSinceEnd = now - endTime;
        const minutesSinceEnd = Math.ceil(timeSinceEnd / (1000 * 60));
        
        if (!interview.allowLateJoin) {
          return res.status(403).json({
            error: 'Interview has ended and late join is not allowed',
            scheduledEndTime: interview.scheduledEndTime,
            timeSinceEnd: timeSinceEnd,
            minutesSinceEnd: minutesSinceEnd,
            message: `Interview ended ${minutesSinceEnd} minutes ago`,
            canStart: false
          });
        }
      }
      
      // If we're within the scheduled time window, allow entry
      if (now >= startTime && now <= endTime) {
        // Interview is currently active - allow entry
        console.log(`✅ Interview is currently active for session ${interview._id}`);
      }
    }

    // Check if interview is active
    if (!interview.isActive) {
      return res.status(403).json({
        error: 'Interview is not active'
      });
    }

    // Enforce single attempt - by default, candidates can only take an interview once
    // This is the default behavior unless explicitly allowed multiple attempts
    if (!interview.allowMultipleAttempts) {
      const existingSession = await Session.findOne({
        userId: userId || req.user.id,
        interviewId: interview._id
      });
      if (existingSession) {
        return res.status(403).json({
          error: 'You have already taken this interview. Each candidate can only participate once.',
          existingSession: {
            id: existingSession._id,
            status: existingSession.status,
            startedAt: existingSession.startedAt,
            completedAt: existingSession.completedAt
          }
        });
      }
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

    const session = await Session.findById(sessionId).populate('interviewId');
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

    const interview = session.interviewId;

    // Enforce start time for scheduled interviews
    if (interview.isScheduled && interview.scheduledStartTime) {
      const now = new Date();
      const startTime = new Date(interview.scheduledStartTime);

      if (now < startTime) {
        const timeUntilStart = Math.max(0, startTime - now);
        const minutesUntilStart = Math.ceil(timeUntilStart / (1000 * 60));
        const secondsUntilStart = Math.ceil(timeUntilStart / 1000);

        return res.status(403).json({
          error: 'Interview has not started yet',
          scheduledStartTime: interview.scheduledStartTime,
          timeUntilStart: timeUntilStart,
          minutesUntilStart: minutesUntilStart,
          secondsUntilStart: secondsUntilStart,
          message: `Interview starts in ${minutesUntilStart} minutes`,
          canStart: false
        });
      }

      // Check if interview has ended
      if (interview.scheduledEndTime) {
        const endTime = new Date(interview.scheduledEndTime);
        if (now > endTime) {
          return res.status(403).json({
            error: 'Interview has ended',
            scheduledEndTime: interview.scheduledEndTime,
            message: 'Cannot start interview after scheduled end time',
            canStart: false
          });
        }
      }
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

    // Stop Python cheating detection script for this session
    try {
      const stopResponse = await fetch('http://localhost:3001/stop-python', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          sessionId: sessionId
        }),
      });
      
      if (stopResponse.ok) {
        logger.info(`Python cheating detection stopped for session ${sessionId}`);
      } else {
        logger.warn(`Failed to stop Python script for session ${sessionId}: ${stopResponse.statusText}`);
      }
    } catch (error) {
      logger.warn(`Error stopping Python script for session ${sessionId}:`, error.message);
    }

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

// Secure media access - no direct downloads allowed
router.get('/media/:sessionId/:mediaType', async (req, res) => {
  try {
    const { sessionId, mediaType } = req.params;

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

    // Verify access - only interviewers and admins can access
    if (req.user.role !== 'interviewer' && req.user.role !== 'admin') {
      return res.status(403).json({
        error: 'Access denied. Only interviewers can access media files.'
      });
    }

    const mediaData = mediaType === 'video' ? session.videoData : session.audioData;
    const contentType = mediaType === 'video' ? 'video/webm' : 'audio/webm';

    if (!mediaData) {
      return res.status(404).json({
        error: `${mediaType} not found for this session`
      });
    }

    // Set secure headers to prevent downloading
    res.setHeader('Content-Type', contentType);
    res.setHeader('Content-Security-Policy', "default-src 'self'");
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('X-Frame-Options', 'DENY');
    res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
    res.setHeader('Pragma', 'no-cache');
    res.setHeader('Expires', '0');
    
    // Add watermark to prevent unauthorized use
    const secureData = Buffer.concat([
      Buffer.from('SECURE_INTERVIEW_MEDIA_'), // Security watermark
      mediaData
    ]);

    // Send secure media data
    res.send(secureData);

  } catch (error) {
    logger.error('Error accessing secure media:', error);
    res.status(500).json({
      error: 'Failed to access media file'
    });
  }
});

// Remove direct download endpoint for security
// Media files are now only accessible through secure streaming

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
