const axios = require('axios');

async function testGenerateQuestions() {
  try {
    console.log('Testing question generation API...');
    
    const response = await axios.post('http://localhost:5000/api/generate-questions', {
      role: 'software engineer',
      level: 'intermediate'
    });
    
    console.log('API Response Status:', response.status);
    console.log('Response Data:');
    console.log(JSON.stringify(response.data, null, 2));
    
    // Check if questions are properly structured
    if (response.data.questions && Array.isArray(response.data.questions)) {
      console.log('\n--- Question Analysis ---');
      response.data.questions.forEach((q, index) => {
        console.log(`Question ${index + 1}:`);
        console.log(`  Type: ${typeof q}`);
        console.log(`  Has question property: ${q.question ? 'Yes' : 'No'}`);
        console.log(`  Has options: ${q.options ? 'Yes' : 'No'}`);
        console.log(`  Options count: ${q.options ? q.options.length : 0}`);
        console.log(`  Has correctAnswer: ${q.correctAnswer ? 'Yes' : 'No'}`);
        console.log('');
      });
    }
    
  } catch (error) {
    console.error('Test failed:', error.message);
    if (error.response) {
      console.error('Response data:', error.response.data);
      console.error('Status:', error.response.status);
    }
  }
}

testGenerateQuestions();
