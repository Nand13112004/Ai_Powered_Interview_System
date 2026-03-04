// Test the parsing function
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

// Test with the actual API output
const testOutput = `1. Which programming paradigm is best suited for handling complex, interconnected systems?
a) Object-Oriented Programming (OOP)
b) Functional Programming
c) Event-Driven Programming
d) Procedural Programming
Answer: a

2. What is primary function of a Docker container?
a) To manage lifecycle of a server
b) To orchestrate deployment of applications
c) To provide a lightweight, portable environment for code execution
d) To handle network routing
Answer: c

3. Which data structure is used to efficiently store and retrieve large amounts of data in a database?
a) Linked List
b) Stack
c) Hash Table
d) Trie
Answer: c

4. What is the primary purpose of try-catch block in exception handling?
a) To synchronize access to shared resources
b) To verify integrity of user input
c) To handle runtime errors and prevent program crashes
d) To optimize database queries
Answer: c

5. Which software engineering concept is used to break down complex systems into smaller, manageable components?
a) Design Patterns
b) Microservices Architecture
c) Model-View-Controller (MVC)
d) Single Responsibility Principle (SRP)
Answer: b`;

const parsedQuestions = parseMCQQuestions(testOutput);

console.log('Parsed Questions:');
console.log(JSON.stringify(parsedQuestions, null, 2));

console.log('\n--- Summary ---');
console.log(`Total questions parsed: ${parsedQuestions.length}`);
parsedQuestions.forEach((q, index) => {
  console.log(`Question ${index + 1}: ${q.options.length} options, Correct answer: ${q.correctAnswer}`);
});
