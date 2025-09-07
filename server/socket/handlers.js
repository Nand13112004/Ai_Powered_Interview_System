const jwt = require('jsonwebtoken');
const { PrismaClient } = require('@prisma/client');
const { logger } = require('../utils/logger');
const { handleInterviewSession } = require('./interviewHandler');

const prisma = new PrismaClient();

const setupSocketHandlers = (io) => {
  // Authentication middleware for socket connections
  io.use(async (socket, next) => {
    try {
      const token = socket.handshake.auth.token;
      
      if (!token) {
        return next(new Error('Authentication error: No token provided'));
      }

      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      
      // Verify user exists
      const user = await prisma.user.findUnique({
        where: { id: decoded.userId },
        select: { id: true, email: true, name: true, role: true }
      });

      if (!user) {
        return next(new Error('Authentication error: User not found'));
      }

      socket.userId = user.id;
      socket.user = user;
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
        
        // Verify session belongs to user
        const session = await prisma.session.findFirst({
          where: {
            id: sessionId,
            userId: socket.userId
          },
          include: {
            interview: true
          }
        });

        if (!session) {
          socket.emit('error', { message: 'Session not found' });
          return;
        }

        // Join interview room
        socket.join(`interview_${sessionId}`);
        
        // Update session status if needed
        if (session.status === 'pending') {
          await prisma.session.update({
            where: { id: sessionId },
            data: { 
              status: 'in_progress',
              startedAt: new Date()
            }
          });
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
        const { sessionId, audioBlob, timestamp } = data;
        
        // Verify user is in the interview room
        const rooms = Array.from(socket.rooms);
        if (!rooms.includes(`interview_${sessionId}`)) {
          socket.emit('error', { message: 'Not in interview session' });
          return;
        }

        // Process audio data (send to AI for transcription and response)
        await handleInterviewSession(socket, sessionId, audioBlob, timestamp);
        
      } catch (error) {
        logger.error('Error processing audio data:', error);
        socket.emit('error', { message: 'Failed to process audio' });
      }
    });

    // Handle text messages (fallback for audio issues)
    socket.on('text_message', async (data) => {
      try {
        const { sessionId, message, timestamp } = data;
        
        // Verify user is in the interview room
        const rooms = Array.from(socket.rooms);
        if (!rooms.includes(`interview_${sessionId}`)) {
          socket.emit('error', { message: 'Not in interview session' });
          return;
        }

        // Process text message
        await handleInterviewSession(socket, sessionId, null, timestamp, message);
        
      } catch (error) {
        logger.error('Error processing text message:', error);
        socket.emit('error', { message: 'Failed to process message' });
      }
    });

    // Handle interview completion
    socket.on('complete_interview', async (data) => {
      try {
        const { sessionId, finalTranscript } = data;
        
        // Update session status
        const session = await prisma.session.findFirst({
          where: {
            id: sessionId,
            userId: socket.userId
          }
        });

        if (!session) {
          socket.emit('error', { message: 'Session not found' });
          return;
        }

        const completedSession = await prisma.session.update({
          where: { id: sessionId },
          data: {
            status: 'completed',
            completedAt: new Date(),
            transcript: finalTranscript,
            duration: session.startedAt ? 
              Math.round((new Date() - session.startedAt) / 60000) : null
          }
        });

        // Generate AI feedback and scores
        const aiService = require('../services/aiService');
        const feedback = await aiService.generateInterviewFeedback(finalTranscript, session.interviewId);
        
        // Update session with feedback
        await prisma.session.update({
          where: { id: sessionId },
          data: {
            scores: feedback.scores,
            feedback: feedback
          }
        });

        socket.emit('interview_completed', {
          sessionId,
          duration: completedSession.duration,
          message: 'Interview completed successfully'
        });

        logger.info(`Interview completed: ${sessionId} by ${socket.user.email}`);
      } catch (error) {
        logger.error('Error completing interview:', error);
        socket.emit('error', { message: 'Failed to complete interview' });
      }
    });

    // Handle disconnection
    socket.on('disconnect', (reason) => {
      logger.info(`User disconnected: ${socket.user.email} (${socket.id}) - ${reason}`);
    });

    // Handle errors
    socket.on('error', (error) => {
      logger.error(`Socket error for user ${socket.user.email}:`, error);
    });
  });
};

module.exports = { setupSocketHandlers };
