// Test script to verify interview completion functionality
const axios = require('axios');

const API_URL = 'http://localhost:5000/api';

// Test data
const testData = {
  interviewId: 'test-interview-123',
  candidateId: 'test-candidate-456',
  questionId: 'test-question-789',
  answerText: 'This is a test answer for the interview completion functionality.'
};

async function testAnswerSubmission() {
  try {
    console.log('🧪 Testing answer submission...');
    
    // Test answer submission endpoint
    const response = await axios.post(`${API_URL}/answers`, testData, {
      headers: {
        'Authorization': 'Bearer test-token', // You'll need a real token
        'Content-Type': 'application/json'
      }
    });
    
    console.log('✅ Answer submission successful:', response.data);
    return true;
  } catch (error) {
    console.error('❌ Answer submission failed:', error.response?.data || error.message);
    return false;
  }
}

async function testSessionCompletion() {
  try {
    console.log('🧪 Testing session completion...');
    
    // Test session completion (this would be done via socket in real app)
    const response = await axios.get(`${API_URL}/sessions/test-session-123`, {
      headers: {
        'Authorization': 'Bearer test-token', // You'll need a real token
        'Content-Type': 'application/json'
      }
    });
    
    console.log('✅ Session completion test successful:', response.data);
    return true;
  } catch (error) {
    console.error('❌ Session completion test failed:', error.response?.data || error.message);
    return false;
  }
}

async function runTests() {
  console.log('🚀 Starting interview completion tests...\n');
  
  const answerTest = await testAnswerSubmission();
  const sessionTest = await testSessionCompletion();
  
  console.log('\n📊 Test Results:');
  console.log(`Answer Submission: ${answerTest ? '✅ PASS' : '❌ FAIL'}`);
  console.log(`Session Completion: ${sessionTest ? '✅ PASS' : '❌ FAIL'}`);
  
  if (answerTest && sessionTest) {
    console.log('\n🎉 All tests passed! Interview completion functionality is working.');
  } else {
    console.log('\n⚠️ Some tests failed. Check the server logs for details.');
  }
}

// Run tests if this script is executed directly
if (require.main === module) {
  runTests().catch(console.error);
}

module.exports = { testAnswerSubmission, testSessionCompletion, runTests };