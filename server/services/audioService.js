const { uploadAudio }       = require('./cloudinaryService');
const aiService             = require('./aiService');
const InterviewResponse     = require('../models/Response');
const { logger }            = require('../utils/logger');

/**
 * Full voice-answer pipeline:
 *  1. Upload audio buffer → Cloudinary
 *  2. Transcribe via Bytez STT
 *  3. Evaluate transcript via Bytez LLM
 *  4. Persist InterviewResponse document
 *  5. Return combined result
 *
 * @param {Object} opts
 * @param {Buffer}  opts.audioBuffer
 * @param {string}  opts.question       - Question text (for context + evaluation)
 * @param {string}  opts.sessionId
 * @param {string}  opts.interviewId
 * @param {string}  opts.questionId
 * @param {string}  opts.userId
 * @returns {Object}  { audioUrl, publicId, transcript, score, strengths, weaknesses, improvements }
 */
async function processVoiceAnswer({ audioBuffer, question, sessionId, interviewId, questionId, userId }) {
  try {
    // ── Step 1: Upload to Cloudinary ──────────────────────────────────────
    const cloudPublicId = `session_${sessionId}_q_${questionId}_${Date.now()}`;
    logger.info(`[AudioService] Uploading audio for session ${sessionId}, question ${questionId}`);
    const { url: audioUrl, publicId } = await uploadAudio(audioBuffer, cloudPublicId);

    // ── Step 2: Transcribe ────────────────────────────────────────────────
    logger.info(`[AudioService] Transcribing audio`);
    const transcript = await aiService.transcribeAudio(audioBuffer);

    // ── Step 3: Evaluate ──────────────────────────────────────────────────
    logger.info(`[AudioService] Evaluating answer`);
    const answerText = transcript || ''; // fallback if STT unavailable
    const evaluation = await aiService.evaluateAnswer(question, answerText);

    // ── Step 4: Persist ───────────────────────────────────────────────────
    const respDoc = await InterviewResponse.findOneAndUpdate(
      { sessionId, questionId, userId },
      {
        $set: {
          userId,
          sessionId,
          interviewId,
          questionId,
          question,
          answerText,
          audioUrl,
          publicId,
          transcript,
          inputMode:    'voice',
          score:        evaluation.score,
          strengths:    evaluation.strengths,
          weaknesses:   evaluation.weaknesses,
          improvements: evaluation.improvements,
        },
      },
      { upsert: true, new: true }
    );

    logger.info(`[AudioService] InterviewResponse saved: ${respDoc._id}`);

    return {
      responseId:   respDoc._id,
      audioUrl,
      publicId,
      transcript,
      score:        evaluation.score,
      strengths:    evaluation.strengths,
      weaknesses:   evaluation.weaknesses,
      improvements: evaluation.improvements,
    };

  } catch (error) {
    logger.error('[AudioService] processVoiceAnswer error:', error);
    throw error;
  }
}

/**
 * Save a text answer with AI evaluation (no audio).
 */
async function processTextAnswer({ answerText, question, sessionId, interviewId, questionId, userId }) {
  try {
    logger.info(`[AudioService] Evaluating text answer for session ${sessionId}`);
    const evaluation = await aiService.evaluateAnswer(question, answerText);

    const respDoc = await InterviewResponse.findOneAndUpdate(
      { sessionId, questionId, userId },
      {
        $set: {
          userId,
          sessionId,
          interviewId,
          questionId,
          question,
          answerText,
          inputMode:    'text',
          score:        evaluation.score,
          strengths:    evaluation.strengths,
          weaknesses:   evaluation.weaknesses,
          improvements: evaluation.improvements,
        },
      },
      { upsert: true, new: true }
    );

    return {
      responseId:   respDoc._id,
      score:        evaluation.score,
      strengths:    evaluation.strengths,
      weaknesses:   evaluation.weaknesses,
      improvements: evaluation.improvements,
    };

  } catch (error) {
    logger.error('[AudioService] processTextAnswer error:', error);
    throw error;
  }
}

module.exports = { processVoiceAnswer, processTextAnswer };
