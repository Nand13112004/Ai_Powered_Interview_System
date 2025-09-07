const { GoogleGenerativeAI } = require('@google/generative-ai');
const { logger } = require('../utils/logger');

class AIService {
  constructor() {
    this.genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
    this.model = this.genAI.getGenerativeModel({ model: 'gemini-1.5-flash' });
  }

  async generateInterviewResponse(sessionState, candidateResponse) {
    try {
      const { interview, transcript, currentQuestionIndex } = sessionState;
      const questions = interview.questions;
      
      // Build conversation context
      const conversationHistory = transcript
        .slice(-10) // Last 10 exchanges
        .map(entry => `${entry.type === 'candidate' ? 'Candidate' : 'Interviewer'}: ${entry.text}`)
        .join('\n');

      const currentQuestion = questions[currentQuestionIndex] || 'Wrap up the interview';
      
      const prompt = `You are a professional AI interviewer conducting a ${interview.level} ${interview.role} interview. 
      
      Interview Details:
      - Role: ${interview.role}
      - Level: ${interview.level}
      - Duration: ${interview.duration} minutes
      
      Instructions:
      1. Be professional, friendly, and encouraging
      2. Ask follow-up questions based on the candidate's responses
      3. Probe deeper into technical knowledge when appropriate
      4. Use the STAR method for behavioral questions
      5. Keep responses concise (1-2 sentences)
      6. If the candidate gives a good answer, acknowledge it and move to the next question
      7. If the answer needs improvement, ask clarifying questions
      8. Maintain a conversational flow
      
      Current Question: ${currentQuestion}
      
      Previous conversation:
      ${conversationHistory}
      
      Candidate's latest response: ${candidateResponse}
      
      Respond as the interviewer. If the candidate has answered well, acknowledge it and ask the next question or provide a follow-up. If you need more information, ask a clarifying question.`;

      const result = await this.model.generateContent(prompt);
      const response = await result.response;
      const text = response.text();
      
      // Check if we should move to the next question
      if (this.shouldMoveToNextQuestion(text, currentQuestionIndex, questions.length)) {
        sessionState.currentQuestionIndex++;
      }

      return text.trim();
    } catch (error) {
      logger.error('Error generating AI response:', error);
      return "I appreciate your response. Let's continue with the interview. Could you tell me more about your experience with this technology?";
    }
  }

  async transcribeAudio(audioBuffer) {
    try {
      // Note: Gemini doesn't have direct audio transcription like Whisper
      // For now, we'll return a placeholder. In production, you might want to:
      // 1. Use Google Cloud Speech-to-Text API
      // 2. Use a different STT service
      // 3. Keep using OpenAI Whisper for transcription
      
      logger.warn('Audio transcription not implemented with Gemini. Consider using Google Cloud Speech-to-Text or OpenAI Whisper.');
      return "Audio transcription placeholder - please use text input for now.";
    } catch (error) {
      logger.error('Error transcribing audio:', error);
      throw new Error('Audio transcription failed');
    }
  }

  async generateTextToSpeech(text) {
    try {
      // Note: Gemini doesn't have TTS capabilities
      // You'll need to use a separate TTS service like:
      // 1. Google Cloud Text-to-Speech
      // 2. ElevenLabs (already configured)
      // 3. Azure Cognitive Services
      
      logger.warn('TTS not implemented with Gemini. Consider using Google Cloud TTS or ElevenLabs.');
      return null;
    } catch (error) {
      logger.error('Error generating speech:', error);
      return null;
    }
  }

  async generateInterviewFeedback(transcript, interviewId) {
    try {
      const prompt = `You are an expert interview evaluator. Analyze this interview transcript and provide detailed feedback.

      Interview Transcript:
      ${JSON.stringify(transcript, null, 2)}

      Please provide feedback in the following JSON format:
      {
        "overallScore": 8.5,
        "scores": {
          "communication": 8.0,
          "technical": 9.0,
          "problemSolving": 8.5,
          "experience": 8.0
        },
        "strengths": [
          "Clear communication",
          "Strong technical knowledge",
          "Good problem-solving approach"
        ],
        "improvements": [
          "Could provide more specific examples",
          "Consider elaborating on technical details"
        ],
        "summary": "Overall strong performance with good technical knowledge and communication skills."
      }

      Be specific and constructive in your feedback.`;

      const result = await this.model.generateContent(prompt);
      const response = await result.response;
      const text = response.text();
      
      // Try to parse JSON from the response
      try {
        const jsonMatch = text.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
          return JSON.parse(jsonMatch[0]);
        }
      } catch (parseError) {
        logger.error('Error parsing AI feedback JSON:', parseError);
      }

      // Fallback response if JSON parsing fails
      return {
        overallScore: 7.0,
        scores: {
          communication: 7.0,
          technical: 7.0,
          problemSolving: 7.0,
          experience: 7.0
        },
        strengths: ["Participated actively in the interview"],
        improvements: ["Could provide more detailed responses"],
        summary: "Interview completed. Consider the feedback provided for improvement."
      };
    } catch (error) {
      logger.error('Error generating interview feedback:', error);
      return {
        overallScore: 6.0,
        scores: {
          communication: 6.0,
          technical: 6.0,
          problemSolving: 6.0,
          experience: 6.0
        },
        strengths: ["Completed the interview"],
        improvements: ["Focus on providing more detailed responses"],
        summary: "Interview completed successfully."
      };
    }
  }

  shouldMoveToNextQuestion(response, currentIndex, totalQuestions) {
    // Simple heuristic to determine if we should move to next question
    const nextQuestionIndicators = [
      'next question',
      'let\'s move on',
      'moving forward',
      'another question',
      'different topic'
    ];
    
    const lowerResponse = response.toLowerCase();
    return nextQuestionIndicators.some(indicator => lowerResponse.includes(indicator)) ||
           currentIndex >= totalQuestions - 1;
  }
}

module.exports = new AIService();
