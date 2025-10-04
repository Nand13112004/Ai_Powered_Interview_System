const { GoogleGenerativeAI } = require('@google/generative-ai');
const { logger } = require('../utils/logger');

class ScoringService {
  constructor() {
    this.genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
    this.model = this.genAI.getGenerativeModel({ model: 'gemini-pro' });
  }

  async evaluateResponse(question, candidateAnswer, audioText) {
    try {
      const prompt = `
You are an expert interviewer evaluating candidate responses. Score the candidate's answer out of 100 points.

QUESTION: ${question.text}
QUESTION TYPE: ${question.type}
DIFFICULTY: ${question.difficulty}
CATEGORY: ${question.category}

CANDIDATE ANSWERS:
Text Answer: ${candidateAnswer || 'No text answer provided'}
Audio Answer: ${audioText || 'No audio answer provided'}

EVALUATION CRITERIA:
- Technical accuracy and depth of knowledge
- Problem-solving approach and methodology
- Communication clarity and structure
- Relevant experience and examples
- Creativity and innovation

Please provide a JSON response with the following format:
{
  "score": [0-100],
  "breakdown": {
    "technicalAccuracy": 0-100,
    "problemSolving": 0-100,
    "communication": 0-100,
    "experience": 0-100,
    "creativity": 0-100
  },
  "feedback": {
    "strengths": ["strength1", "strength2"],
    "weaknesses": ["weakness1", "weakness2"],
    "suggestions": ["suggestion1", "suggestion2"]
  },
  "overallAssessment": "Detailed overall assessment of the candidate's response"
}

Return ONLY the JSON response, no additional text.
`;

      const result = await this.model.generateContent(prompt);
      const response = await result.response;
      const text = response.text();
      
      // Parse JSON response
      const evaluation = JSON.parse(text);
      
      // Add metadata
      evaluation.evaluatedAt = new Date().toISOString();
      evaluation.questionId = question.id;
      evaluation.criteria = {
        questionType: question.type,
        difficulty: question.difficulty,
        category: question.category
      };

      logger.info(`AI scoring completed for question ${question.id}: ${evaluation.score}/100`);
      return evaluation;
      
    } catch (error) {
      logger.error('AI scoring error:', error);
      
      // Fallback scoring if AI fails
      return {
        score: 0,
        breakdown: {
          technicalAccuracy: 0,
          problemSolving: 0,
          communication: 0,
          experience: 0,
          creativity: 0
        },
        feedback: {
          strengths: [],
          weaknesses: ['Unable to evaluate response due to technical error'],
          suggestions: ['Please try again later']
        },
        overallAssessment: 'Failed to evaluate response due to technical error.',
        evaluatedAt: new Date().toISOString(),
        questionId: question.id,
        error: true
      };
    }
  }

  async evaluateMultipleResponses(responses) {
    try {
      const evaluations = [];
      
      for (const response of responses) {
        const evaluation = await this.evaluateResponse(
          response.question,
          response.text,
          response.text // Using same text for now, can be enhanced with audio transcription
        );
        evaluations.push({
          ...evaluation,
          responseId: response.id
        });
      }
      
      // Calculate overall score
      const totalScore = evaluations.reduce((sum, evaluation) => sum + evaluation.score, 0);
      const averageScore = Math.round(totalScore / evaluations.length);
      
      return {
        questionEvaluations: evaluations,
        overallScore: averageScore,
        totalQuestions: responses.length,
        evaluatedAt: new Date().toISOString()
      };
      
    } catch (error) {
      logger.error('Error evaluating multiple responses:', error);
      throw error;
    }
  }
}

module.exports = new ScoringService();
