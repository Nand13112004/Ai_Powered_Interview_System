const { PrismaClient } = require('@prisma/client');
const { logger } = require('../utils/logger');
const aiService = require('../services/aiService');

const prisma = new PrismaClient();

// Store active interview sessions in memory (in production, use Redis)
const activeSessions = new Map();

const handleInterviewSession = async (socket, sessionId, audioBlob, timestamp, textMessage = null) => {
  try {
    // Get or create session state
    let sessionState = activeSessions.get(sessionId);
    if (!sessionState) {
      const session = await prisma.session.findFirst({
        where: { id: sessionId },
        include: { interview: true }
      });
      
      if (!session) {
        throw new Error('Session not found');
      }

      sessionState = {
        sessionId,
        interview: session.interview,
        transcript: [],
        currentQuestionIndex: 0,
        startTime: new Date(),
        isActive: true
      };
      
      activeSessions.set(sessionId, sessionState);
    }

    let transcribedText = '';

    // Process audio if provided
    if (audioBlob) {
      try {
        // Convert audio blob to buffer and transcribe
        const audioBuffer = Buffer.from(audioBlob, 'base64');
        transcribedText = await aiService.transcribeAudio(audioBuffer);
      } catch (error) {
        logger.error('Transcription error:', error);
        socket.emit('error', { message: 'Failed to transcribe audio' });
        return;
      }
    } else if (textMessage) {
      transcribedText = textMessage;
    }

    if (!transcribedText.trim()) {
      return;
    }

    // Add to transcript
    sessionState.transcript.push({
      type: 'candidate',
      text: transcribedText,
      timestamp: new Date()
    });

    // Generate AI response
    const aiResponse = await aiService.generateInterviewResponse(sessionState, transcribedText);
    
    // Add AI response to transcript
    sessionState.transcript.push({
      type: 'interviewer',
      text: aiResponse,
      timestamp: new Date()
    });

    // Send response to client
    socket.emit('ai_response', {
      sessionId,
      text: aiResponse,
      timestamp: new Date(),
      questionIndex: sessionState.currentQuestionIndex
    });

    // Generate speech for AI response
    try {
      const audioData = await aiService.generateTextToSpeech(aiResponse);
      if (audioData) {
        socket.emit('ai_audio', {
          sessionId,
          audioData: audioData,
          timestamp: new Date()
        });
      }
    } catch (error) {
      logger.error('TTS error:', error);
      // Continue without audio if TTS fails
    }

    // Update session in database
    await prisma.session.update({
      where: { id: sessionId },
      data: {
        transcript: sessionState.transcript
      }
    });

  } catch (error) {
    logger.error('Error in interview handler:', error);
    socket.emit('error', { message: 'Failed to process interview interaction' });
  }
};


// Clean up inactive sessions
setInterval(() => {
  const now = new Date();
  for (const [sessionId, sessionState] of activeSessions.entries()) {
    if (!sessionState.isActive || (now - sessionState.startTime) > 2 * 60 * 60 * 1000) { // 2 hours
      activeSessions.delete(sessionId);
      logger.info(`Cleaned up inactive session: ${sessionId}`);
    }
  }
}, 30 * 60 * 1000); // Clean up every 30 minutes

module.exports = { handleInterviewSession };
