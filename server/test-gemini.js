require('dotenv').config();
const Bytez = require('bytez.js');

async function testBytezAPI() {
  try {
    const sdk = new Bytez(process.env.BYTEZ_API_KEY);
    const model = sdk.model("inference-net/Schematron-3B");
    
    const prompt = 'generate 5 question for difficult level software engineer role';
    
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
    
    console.log('Bytez API response:', output);
  } catch (error) {
    console.error('Bytez API error:', error.message);
  }
}

testBytezAPI();
