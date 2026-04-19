const Bytez = require('bytez.js');
const { logger } = require('../utils/logger');

class AIService {
  constructor() {
    this.sdk   = new Bytez(process.env.BYTEZ_API_KEY);

    // LLM for interview dialogue + evaluation
    this.model = this.sdk.model('inference-net/Schematron-3B');

    // STT model – Whisper via Bytez
    this.sttModel = this.sdk.model('openai/whisper-large-v3');

    // TTS model – Kokoro via Bytez (lightweight, fast)
    this.ttsModel = this.sdk.model('hexgrad/Kokoro-82M');
  }

  // ────────────────────────────────────────────────────────────────────────
  // AI INTERVIEW DIALOGUE
  // ────────────────────────────────────────────────────────────────────────

  async generateInterviewResponse(sessionState, candidateResponse) {
    try {
      const { interview, transcript, currentQuestionIndex } = sessionState;
      const questions = interview.questions;

      const conversationHistory = transcript
        .slice(-10)
        .map(e => `${e.type === 'candidate' ? 'Candidate' : 'Interviewer'}: ${e.text}`)
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

Respond as the interviewer.`;

      const { error, output } = await this.model.run([{ role: 'user', content: prompt }]);

      if (error) {
        logger.error('Bytez API error:', error);
        throw new Error(error);
      }

      const text = output?.content || "I appreciate your response. Let's continue with the interview.";

      if (this.shouldMoveToNextQuestion(text, currentQuestionIndex, questions.length)) {
        sessionState.currentQuestionIndex++;
      }

      return text.trim();
    } catch (error) {
      logger.error('Error generating AI response:', error);
      return "I appreciate your response. Let's continue with the interview. Could you tell me more about your experience?";
    }
  }

  // ────────────────────────────────────────────────────────────────────────
  // STT — TRANSCRIPTION
  // ────────────────────────────────────────────────────────────────────────

  /**
   * Transcribe an audio buffer using Bytez Whisper.
   * Falls back to a placeholder if the model call fails.
   *
   * @param {Buffer} audioBuffer  - Raw audio bytes (webm/opus)
   * @returns {string}            - Transcript text
   */
  async transcribeAudio(audioBuffer) {
    try {
      // Convert buffer to base64 for Bytez input
      const base64Audio = audioBuffer.toString('base64');

      const { error, output } = await this.sttModel.run({
        audio:  base64Audio,
        format: 'webm',
      });

      if (error) {
        logger.error('Bytez STT error:', error);
        throw new Error(error);
      }

      // Whisper returns { text: "..." } or { chunks: [...] }
      const transcript =
        output?.text ||
        (output?.chunks || []).map(c => c.text).join(' ') ||
        '';

      logger.info(`[AIService] Transcription complete: "${transcript.slice(0, 80)}..."`);
      return transcript.trim();

    } catch (error) {
      logger.warn('[AIService] Bytez STT unavailable, falling back to empty transcript:', error.message);
      // Return empty string — frontend will keep typed input as fallback
      return '';
    }
  }

  // ────────────────────────────────────────────────────────────────────────
  // TTS — TEXT TO SPEECH
  // ────────────────────────────────────────────────────────────────────────

  /**
   * Convert text to speech using Bytez Kokoro TTS.
   * Returns a base64-encoded audio string (mp3/wav).
   *
   * @param {string} text
   * @returns {string|null}  base64 audio or null on failure
   */
  async generateTextToSpeech(text) {
    try {
      const { error, output } = await this.ttsModel.run({
        text,
        voice: 'af_heart', // Kokoro voice preset
      });

      if (error) {
        logger.error('Bytez TTS error:', error);
        throw new Error(error);
      }

      // Kokoro returns audio as base64 or a buffer field
      const audioBase64 =
        output?.audio ||
        (Buffer.isBuffer(output) ? output.toString('base64') : null);

      if (!audioBase64) {
        logger.warn('[AIService] TTS returned no audio data');
        return null;
      }

      logger.info('[AIService] TTS audio generated successfully');
      return audioBase64;

    } catch (error) {
      logger.warn('[AIService] Bytez TTS unavailable:', error.message);
      return null; // Frontend degrades gracefully (text-only)
    }
  }

  // ────────────────────────────────────────────────────────────────────────
  // EVALUATION
  // ────────────────────────────────────────────────────────────────────────

  /**
   * Evaluate a single answer and return a structured score + feedback.
   *
   * @param {string} question
   * @param {string} answerText  - Typed text OR STT transcript
   * @returns {{ score, strengths, weaknesses, improvements }}
   */
  async evaluateAnswer(question, answerText) {
    const fallback = {
      score:        5,
      strengths:    ['Answer was received'],
      weaknesses:   ['Could not fully evaluate the response'],
      improvements: ['Provide a more detailed answer'],
    };

    if (!answerText || answerText.trim().length < 5) {
      return fallback;
    }

    try {
      const prompt = `You are an expert technical interviewer. Evaluate the following interview answer.

Question: ${question}

Candidate Answer: ${answerText}

Respond ONLY with valid JSON in this exact structure:
{
  "score": <integer 0-10>,
  "strengths": ["<point>", "<point>"],
  "weaknesses": ["<point>", "<point>"],
  "improvements": ["<actionable suggestion>", "<actionable suggestion>"]
}

Be concise, specific, and constructive.`;

      const { error, output } = await this.model.run([{ role: 'user', content: prompt }]);

      if (error) {
        logger.error('Bytez evaluation error:', error);
        return fallback;
      }

      const text = output?.content || '';

      // Extract and parse JSON block
      const jsonMatch = text.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        const parsed = JSON.parse(jsonMatch[0]);
        return {
          score:        Math.min(10, Math.max(0, Number(parsed.score) || 5)),
          strengths:    Array.isArray(parsed.strengths)    ? parsed.strengths    : [],
          weaknesses:   Array.isArray(parsed.weaknesses)   ? parsed.weaknesses   : [],
          improvements: Array.isArray(parsed.improvements) ? parsed.improvements : [],
        };
      }

      return fallback;

    } catch (error) {
      logger.error('[AIService] evaluateAnswer error:', error);
      return fallback;
    }
  }

  // ────────────────────────────────────────────────────────────────────────
  // GENERATE NEXT QUESTION
  // ────────────────────────────────────────────────────────────────────────

  /**
   * Generate a fresh interview question based on role, level, and topic.
   *
   * @param {{ role, level, topic, previousQuestions }} opts
   * @returns {string}  Question text
   */
  async generateQuestion({ role, level, topic, previousQuestions = [] }) {
    try {
      const pastQ = previousQuestions.slice(-5).join('\n- ');

      const prompt = `You are an expert interviewer. Generate ONE interview question for a ${level} ${role} candidate.
Topic area: ${topic || 'General'}
${pastQ ? `\nAvoid repeating these previous questions:\n- ${pastQ}` : ''}

Rules:
- Return ONLY the question text, no preamble
- Make it clear, specific, and thought-provoking
- Match difficulty to the ${level} level`;

      const { error, output } = await this.model.run([{ role: 'user', content: prompt }]);

      if (error || !output?.content) {
        return `Tell me about a challenging ${topic || 'technical'} problem you solved recently.`;
      }

      return output.content.trim();

    } catch (error) {
      logger.error('[AIService] generateQuestion error:', error);
      return `Can you walk me through your experience with ${topic || 'this domain'}?`;
    }
  }

  // ────────────────────────────────────────────────────────────────────────
  // FULL SESSION FEEDBACK
  // ────────────────────────────────────────────────────────────────────────

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
  "strengths": ["Clear communication", "Strong technical knowledge"],
  "improvements": ["Could provide more specific examples"],
  "summary": "Overall strong performance."
}

Be specific and constructive in your feedback.`;

      const { error, output } = await this.model.run([{ role: 'user', content: prompt }]);

      if (error) {
        logger.error('Bytez API error for feedback:', error);
        throw new Error(error);
      }

      const text = output?.content || '';

      try {
        const jsonMatch = text.match(/\{[\s\S]*\}/);
        if (jsonMatch) return JSON.parse(jsonMatch[0]);
      } catch (parseError) {
        logger.error('Error parsing AI feedback JSON:', parseError);
      }

      return {
        overallScore: 7.0,
        scores:       { communication: 7.0, technical: 7.0, problemSolving: 7.0, experience: 7.0 },
        strengths:    ['Participated actively in the interview'],
        improvements: ['Could provide more detailed responses'],
        summary:      'Interview completed. Consider the feedback provided for improvement.',
      };

    } catch (error) {
      logger.error('Error generating interview feedback:', error);
      return {
        overallScore: 6.0,
        scores:       { communication: 6.0, technical: 6.0, problemSolving: 6.0, experience: 6.0 },
        strengths:    ['Completed the interview'],
        improvements: ['Focus on providing more detailed responses'],
        summary:      'Interview completed successfully.',
      };
    }
  }

  // ────────────────────────────────────────────────────────────────────────
  // HELPERS
  // ────────────────────────────────────────────────────────────────────────

  shouldMoveToNextQuestion(response, currentIndex, totalQuestions) {
    const indicators = ['next question', "let's move on", 'moving forward', 'another question', 'different topic'];
    const lower = response.toLowerCase();
    return indicators.some(i => lower.includes(i)) || currentIndex >= totalQuestions - 1;
  }
}

module.exports = new AIService();
