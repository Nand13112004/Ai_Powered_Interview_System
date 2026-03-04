require('dotenv').config();
const Bytez = require('bytez.js');

async function testQuestionGeneration() {
  try {
    const sdk = new Bytez(process.env.BYTEZ_API_KEY);
    const model = sdk.model("inference-net/Schematron-3B");
    
    const role = 'software engineer';
    const level = 'intermediate';
    
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
    
    console.log('Testing Bytez API with improved prompt...');
    
    const { error, output } = await model.run([
      {
        "role": "user",
        "content": prompt
      }
    ]);

    if (error) {
      console.error('Bytez API error:', error);
      return;
    }
    
    console.log('Raw API Output:');
    console.log(output);
    console.log('\n--- Content ---');
    console.log(output.content);
    
  } catch (error) {
    console.error('Test error:', error.message);
  }
}

testQuestionGeneration();
