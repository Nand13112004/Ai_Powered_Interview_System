require('dotenv').config();
const express = require('express');
const Bytez = require('bytez.js');

const router = express.Router();

// Sample questions as fallback when API is not configured
const getSampleQuestions = (role, level) => [
  {
    question: `1. Can you describe your experience with ${role} at a ${level} level?`,
    options: [
      `a) I have extensive experience in ${role}`,
      `b) I have moderate experience in ${role}`,
      `c) I have basic experience in ${role}`,
      `d) I have no experience in ${role}`
    ],
    correctAnswer: 'a'
  },
  {
    question: `2. What are the key skills required for a ${role} position at ${level} level?`,
    options: [
      `a) Technical skills only`,
      `b) Communication skills only`,
      `c) Both technical and soft skills`,
      `d) Management skills only`
    ],
    correctAnswer: 'c'
  },
  {
    question: `3. How do you handle challenges in your ${role} role?`,
    options: [
      `a) Avoid challenges`,
      `b) Seek help immediately`,
      `c) Analyze and solve systematically`,
      `d) Delegate to others`
    ],
    correctAnswer: 'c'
  },
  {
    question: `4. What tools and technologies are you proficient in for ${role}?`,
    options: [
      `a) Basic tools only`,
      `b) Intermediate tools`,
      `c) Advanced tools and frameworks`,
      `d) No specific tools`
    ],
    correctAnswer: 'c'
  },
  {
    question: `5. Where do you see yourself in the next 2 years as a ${role}?`,
    options: [
      `a) Same position`,
      `b) Senior role`,
      `c) Team lead`,
      `d) Different career path`
    ],
    correctAnswer: 'b'
  }
];

// Function to parse MCQ questions from API output
const parseMCQQuestions = (text) => {
  const questions = [];
  const lines = text.split('\n').filter(line => line.trim().length > 0);
  
  let currentQuestion = null;
  let questionNumber = 1;
  
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();
    
    // Check if line starts with a question number
    const questionMatch = line.match(/^(\d+)\.\s*(.+)$/);
    if (questionMatch) {
      // Save previous question if exists
      if (currentQuestion && currentQuestion.options.length >= 4) {
        questions.push(currentQuestion);
      }
      
      // Start new question
      currentQuestion = {
        question: `${questionNumber}. ${questionMatch[2]}`,
        options: [],
        correctAnswer: null
      };
      questionNumber++;
    }
    // Check if line is an option (a, b, c, d)
    else if (currentQuestion && /^[a-d]\)/.test(line)) {
      currentQuestion.options.push(line);
      
      // Extract answer if it contains "answer:" or similar
      const answerMatch = line.match(/answer:\s*([a-d])/i);
      if (answerMatch) {
        currentQuestion.correctAnswer = answerMatch[1];
      }
    }
    // Check for answer on separate line
    else if (currentQuestion && /answer:\s*([a-d])/i.test(line)) {
      const answerMatch = line.match(/answer:\s*([a-d])/i);
      if (answerMatch) {
        currentQuestion.correctAnswer = answerMatch[1];
      }
    }
  }
  
  // Add last question if it has enough options
  if (currentQuestion && currentQuestion.options.length >= 4) {
    questions.push(currentQuestion);
  }
  
  // If we didn't get proper MCQ format, create structured questions from the text
  if (questions.length === 0 && lines.length >= 5) {
    for (let i = 0; i < Math.min(5, lines.length); i++) {
      questions.push({
        question: `${i + 1}. ${lines[i]}`,
        options: [
          `a) Option A for question ${i + 1}`,
          `b) Option B for question ${i + 1}`,
          `c) Option C for question ${i + 1}`,
          `d) Option D for question ${i + 1}`
        ],
        correctAnswer: 'a'
      });
    }
  }
  
  return questions.slice(0, 5); // Ensure max 5 questions
};

router.post('/', async (req, res) => {
  try {
    const { role, level } = req.body;
    if (!role || !level) {
      return res.status(400).json({ error: 'Role and level are required' });
    }

    // If BYTEZ_API_KEY is not configured, return sample questions
    if (!process.env.BYTEZ_API_KEY) {
      console.warn('⚠️ BYTEZ_API_KEY not configured - returning sample questions');
      return res.json({ 
        questions: getSampleQuestions(role, level),
        isSample: true 
      });
    }

    const sdk = new Bytez(process.env.BYTEZ_API_KEY);
    const model = sdk.model("inference-net/Schematron-3B");
    
    const prompt = `Generate exactly 5 multiple-choice questions for a ${level} ${role} position. 

Format each question exactly like this:
1. [Question text here]
a) [Option A]
b) [Option B] 
c) [Option C]
d) [Option D]
Answer: [a/b/c/d]

2. [Question text here]
a) [Option A]
b) [Option B]
c) [Option C]
d) [Option D]
Answer: [a/b/c/d]

Continue this pattern for all 5 questions. Make sure each question has exactly 4 options and a clear correct answer.`;
    
    const { error, output } = await model.run([
      {
        "role": "user",
        "content": prompt
      }
    ]);

    if (error) {
      console.error('Bytez API error:', error);
      // Fallback to sample questions on API error
      return res.json({ 
        questions: getSampleQuestions(role, level),
        isSample: true,
        note: 'API error - returned sample questions'
      });
    }

    // Parse the output to extract questions with MCQ format
    const outputText = output && output.content ? output.content : '';
    
    if (outputText) {
      // Try to parse structured MCQ questions
      const questions = parseMCQQuestions(outputText);
      if (questions.length > 0) {
        return res.json({ questions, isSample: false });
      }
    }
    
    // Fallback to sample questions if parsing fails
    const questions = getSampleQuestions(role, level);
    res.json({ questions, isSample: true, note: 'Parsing failed - returned sample questions' });
  } catch (error) {
    console.error('Bytez API error:', error);
    // Return sample questions on any error
    res.json({ 
      questions: getSampleQuestions(role, level),
      isSample: true,
      note: 'Error occurred - returned sample questions'
    });
  }
});

module.exports = router;

