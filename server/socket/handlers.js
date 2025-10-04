const jwt = require('jsonwebtoken');
const { logger } = require('../utils/logger');
const { handleInterviewSession } = require('./interviewHandler');
const User = require('../models/User');
const Session = require('../models/Session');
const ProctorEvent = require('../models/ProctorEvent');

// Using Mongoose models, no Prisma

const setupSocketHandlers = (io) => {
  // Authentication middleware for socket connections
  io.use(async (socket, next) => {
    try {
      const token = socket.handshake.auth.token;
      
      if (!token) {
        return next(new Error('Authentication error: No token provided'));
      }

      const decoded = jwt.verify(token, process.env.JWT_SECRET || 'my_super_secret');
      
      const userDoc = await User.findById(decoded.userId).select('email name role');
      if (!userDoc) {
        return next(new Error('Authentication error: User not found'));
      }
      socket.userId = userDoc._id.toString();
      socket.user = { id: userDoc._id.toString(), email: userDoc.email, name: userDoc.name, role: userDoc.role };
      
      next();
    } catch (error) {
      logger.error('Socket authentication error:', error);
      next(new Error('Authentication error: Invalid token'));
    }
  });

  io.on('connection', (socket) => {
    logger.info(`User connected: ${socket.user.email} (${socket.id})`);

    // Join user to their personal room
    socket.join(`user_${socket.userId}`);

    // Handle interview session events
    socket.on('join_interview', async (data) => {
      try {
        const { sessionId } = data;
        
        // Try to verify session belongs to user if database is available
        let session = await Session.findOne({ _id: sessionId, userId: socket.userId }).lean();

        if (!session) {
          // Create mock session for testing
          session = {
            id: sessionId,
            status: 'in_progress',
            interview: {
              id: 'mock-interview',
              title: 'Mock Interview',
              description: 'A test interview session',
              role: 'Software Engineer',
              level: 'Mid-level',
              duration: 30,
              questions: [
                { id: 'q1', text: 'Tell me about yourself', number: 1 },
                { id: 'q2', text: 'What are your strengths?', number: 2 },
                { id: 'q3', text: 'Where do you see yourself in 5 years?', number: 3 }
              ]
            }
          };
          logger.info(`Created mock session for ${sessionId}`);
        }

        // Join interview room
        socket.join(`interview_${sessionId}`);
        
        // Update session status if needed and database is available
        if (session && session.status === 'pending') {
          await Session.findByIdAndUpdate(sessionId, { status: 'in_progress', startedAt: new Date() });
        }

        socket.emit('interview_joined', {
          sessionId,
          interview: session.interview,
          status: 'in_progress'
        });

        logger.info(`User ${socket.user.email} joined interview session ${sessionId}`);
      } catch (error) {
        logger.error('Error joining interview:', error);
        socket.emit('error', { message: 'Failed to join interview' });
      }
    });

    // Handle audio data from client
    socket.on('audio_data', async (data) => {
      try {
        const { sessionId, audioBlob, timestamp, questionId } = data;
        
        // Verify user is in the interview room
        const rooms = Array.from(socket.rooms);
        if (!rooms.includes(`interview_${sessionId}`)) {
          socket.emit('error', { message: 'Not in interview session' });
          return;
        }

        // Process audio data (send to AI for transcription and response)
        await handleInterviewSession(socket, sessionId, audioBlob, timestamp, null, questionId);
        
      } catch (error) {
        logger.error('Error processing audio data:', error);
        socket.emit('error', { message: 'Failed to process audio' });
      }
    });

    // Handle text messages (fallback for audio issues)
    socket.on('text_message', async (data) => {
      try {
        const { sessionId, message, timestamp, questionId } = data;
        
        // Verify user is in the interview room
        const rooms = Array.from(socket.rooms);
        if (!rooms.includes(`interview_${sessionId}`)) {
          socket.emit('error', { message: 'Not in interview session' });
          return;
        }

        // Process text message
        await handleInterviewSession(socket, sessionId, null, timestamp, message, questionId);
        
      } catch (error) {
        logger.error('Error processing text message:', error);
        socket.emit('error', { message: 'Failed to process message' });
      }
    });

    // Handle interview completion
    socket.on('complete_interview', async (data) => {
      try {
        const { sessionId, finalTranscript, reason } = data;
        
        // Update session status if database is available
        let session = await Session.findOne({ _id: sessionId, userId: socket.userId });
        if (session) {
          const duration = session.startedAt ? Math.round((new Date() - session.startedAt) / 60000) : null;
          session.status = 'completed';
          session.completedAt = new Date();
          session.transcript = finalTranscript;
          session.duration = duration;
          try {
            const aiService = require('../services/aiService');
            const feedback = await aiService.generateInterviewFeedback(finalTranscript, session.interviewId);
            session.scores = feedback.scores;
            session.feedback = feedback;
          } catch (aiError) {
            logger.warn('Failed to generate AI feedback:', aiError.message);
          }
          await session.save();
        }

        socket.emit('interview_completed', {
          sessionId,
          duration: 30, // Mock duration
          message: 'Interview completed successfully'
        });

        const completionReason = reason === 'user_left' ? ' (user left/disconnected)' : ''
        logger.info(`Interview completed: ${sessionId} by ${socket.user.email}${completionReason}`);
      } catch (error) {
        logger.error('Error completing interview:', error);
        socket.emit('error', { message: 'Failed to complete interview' });
      }
    });

    // Proctoring: receive client incidents
    socket.on('proctor_event', async (payload) => {
  try {
    const { sessionId, type, meta, at } = payload || {};
    logger.info(`Proctor event: ${type} for session ${sessionId} by ${socket.user?.email}`, { meta, at });

    if (sessionId) {
      // Save to DB
      try {
        await ProctorEvent.create({
          sessionId,
          type,
          metadata: typeof meta === 'string' ? meta : JSON.stringify(meta || {}),
          createdAt: at ? new Date(at) : new Date()
        });
      } catch (dbErr) {
        logger.warn('Proctor event DB save failed:', dbErr.message);
      }

      // Prepare meta for emitting
      let metaForEmit = {};
      if (typeof meta === 'string') {
        try {
          metaForEmit = JSON.parse(meta);
        } catch (err) {
          metaForEmit = {};
        }
      } else if (typeof meta === 'object' && meta !== null) {
        metaForEmit = meta;
      }

      // Handle interview termination due to cheating
      if (type === 'interview_terminated') {
        logger.warn(`🚨 Interview terminated due to cheating for session ${sessionId}`);
        
        // Update session status to completed with cheating flag
        try {
          await Session.findByIdAndUpdate(sessionId, { 
            status: 'completed', 
            completedAt: new Date(),
            cheatingDetected: true,
            cheatingScore: metaForEmit.score || 0,
            cheatingWarnings: metaForEmit.warnings || {}
          });
        } catch (dbErr) {
          logger.warn('Failed to update session with cheating flag:', dbErr.message);
        }

        // Emit interview completion event to client
        io.to(`interview_${sessionId}`).emit('interview_completed', {
          sessionId,
          reason: 'cheating_detected',
          message: 'Interview terminated due to cheating detection',
          cheatingScore: metaForEmit.score || 0,
          warnings: metaForEmit.warnings || {}
        });
      }

      // Relay to clients
      io.to(`interview_${sessionId}`).emit('proctor_detection', { type, meta: metaForEmit, at });
    }
  } catch (err) {
    logger.error('Error handling proctor_event:', err);
  }
});

    // Proctoring: threshold breach
    socket.on('proctor_threshold_breach', async (payload) => {
      try {
        const { sessionId, incidents } = payload || {}
        logger.warn(`Proctor threshold breach for session ${sessionId} by ${socket.user?.email}. Incidents=${incidents}`)
        if (prisma && sessionId) {
          try {
            await prisma.session.update({
              where: { id: sessionId },
              data: { status: 'completed', completedAt: new Date() }
            })
          } catch (e) {
            logger.error('Failed to mark session completed on threshold breach:', e)
          }
        }
        socket.emit('interview_completed', { sessionId, reason: 'proctor_threshold' })
      } catch (err) {
        logger.error('Error handling proctor_threshold_breach:', err)
      }
    })

    // Handle disconnection
    socket.on('disconnect', async (reason) => {
      logger.info(`User disconnected: ${socket.user.email} (${socket.id}) - ${reason}`);
      
      // Auto-complete any active interviews when user disconnects
      try {
        const activeSessions = await Session.find({ userId: socket.userId, status: { $in: ['pending', 'in_progress'] } });
        for (const s of activeSessions) {
          s.status = 'completed';
          s.completedAt = new Date();
          s.duration = s.startedAt ? Math.round((new Date() - s.startedAt) / 60000) : null;
          await s.save();
          logger.info(`Auto-completed session ${s._id.toString()} due to disconnect`);
        }
        if (activeSessions.length > 0) {
          logger.info(`Auto-completed ${activeSessions.length} session(s) for ${socket.user.email} due to disconnect`);
        }
      } catch (error) {
        logger.error('Error auto-completing sessions on disconnect:', error);
      }
    });

    // Handle errors
    socket.on('error', (error) => {
      logger.error(`Socket error for user ${socket.user.email}:`, error);
    });
  });
};

module.exports = { setupSocketHandlers };
