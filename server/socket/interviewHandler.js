const { logger } = require('../utils/logger');
const aiService = require('../services/aiService');
const Session = require('../models/Session');
const Interview = require('../models/Interview');
const Question = require('../models/Question');
const Response = require('../models/Response');

// Using Mongoose models, no Prisma

// Store active interview sessions in memory (in production, use Redis)
const activeSessions = new Map();

const handleInterviewSession = async (socket, sessionId, audioBlob, timestamp, textMessage = null, questionId = null) => {
  try {
    // Get or create session state
    let sessionState = activeSessions.get(sessionId);
    if (!sessionState) {
      // Try to get session from database if available
      const session = await Session.findById(sessionId).lean();
      if (session) {
        const interview = await Interview.findById(session.interviewId).lean();
        const questions = await Question.find({ interviewId: session.interviewId }).sort({ number: 1 }).lean();
        if (interview && questions.length > 0) {
          sessionState = {
            sessionId,
            interview: {
              id: interview._id.toString(),
              title: interview.title,
              questions: questions.map(q => ({ id: q._id.toString(), text: q.text, number: q.number }))
            },
            transcript: [],
            currentQuestionIndex: 0,
            startTime: new Date(),
            isActive: true
          };
        }
      }
      
      // Fallback: create a mock session if database is not available
      if (!sessionState) {
        sessionState = {
          sessionId,
          interview: {
            id: 'mock-interview',
            title: 'Mock Interview',
            questions: [
              { id: 'q1', text: 'Tell me about yourself', number: 1 },
              { id: 'q2', text: 'What are your strengths?', number: 2 },
              { id: 'q3', text: 'Where do you see yourself in 5 years?', number: 3 }
            ]
          },
          transcript: [],
          currentQuestionIndex: 0,
          startTime: new Date(),
          isActive: true
        };
        logger.info(`Created fallback session for ${sessionId}`);
      }
      
      activeSessions.set(sessionId, sessionState);
    }

    let transcribedText = '';

    // Process audio if provided
    if (audioBlob) {
      try {
        // Convert audio blob to buffer and transcribe
        const audioBuffer = Buffer.from(audioBlob, 'base64');
        transcribedText = await aiService.transcribeAudio(audioBuffer);
        // Persist response with audio
        const currentQuestion = questionId 
          ? sessionState.interview.questions.find(q => q.id === questionId)
          : sessionState.interview.questions[sessionState.currentQuestionIndex];
        if (currentQuestion) {
          try {
            await Response.create({
              userId: socket.userId,
              interviewId: sessionState.interview.id,
              sessionId,
              questionId: currentQuestion.id,
              text: transcribedText || null,
              audioData: audioBuffer
            });
            logger.info(`Response saved to database for question ${currentQuestion.id}`);
          } catch (dbError) {
            logger.warn('Failed to save response to database:', dbError.message);
          }
        } else if (currentQuestion) {
          logger.info(`Response recorded (mock mode): ${transcribedText.substring(0, 50)}...`);
        }
      } catch (error) {
        logger.error('Transcription error:', error);
        socket.emit('error', { message: 'Failed to transcribe audio' });
        return;
      }
    } else if (textMessage) {
      transcribedText = textMessage;
      // Persist text-only response
      const currentQuestion = questionId 
        ? sessionState.interview.questions.find(q => q.id === questionId)
        : sessionState.interview.questions[sessionState.currentQuestionIndex];
      if (currentQuestion) {
        try {
          await Response.create({ userId: socket.userId, interviewId: sessionState.interview.id, sessionId, questionId: currentQuestion.id, text: transcribedText });
          logger.info(`Text response saved to database for question ${currentQuestion.id}`);
        } catch (dbError) {
          logger.warn('Failed to save text response to database:', dbError.message);
        }
      } else if (currentQuestion) {
        logger.info(`Text response recorded (mock mode): ${transcribedText}`);
      }
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
    try {
      await Session.findByIdAndUpdate(sessionId, { transcript: sessionState.transcript });
    } catch (dbError) {
      logger.warn('Failed to update session in database:', dbError.message);
    }

    // Advance to next question if provided question was answered
    if (questionId) {
      const idx = sessionState.interview.questions.findIndex(q => q.id === questionId);
      if (idx >= 0 && idx === sessionState.currentQuestionIndex && idx < sessionState.interview.questions.length - 1) {
        sessionState.currentQuestionIndex = idx + 1;
      }
    }

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
