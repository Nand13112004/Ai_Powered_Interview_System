#!/usr/bin/env node

/**
 * Script to stop all running Python cheating detection processes
 * Run this if you need to immediately stop all Python processes
 */

const http = require('http');

function makeRequest(url, options = {}) {
  return new Promise((resolve, reject) => {
    const urlObj = new URL(url);
    const requestOptions = {
      hostname: urlObj.hostname,
      port: urlObj.port,
      path: urlObj.pathname,
      method: options.method || 'GET',
      headers: {
        'Content-Type': 'application/json',
        ...options.headers
      }
    };

    const req = http.request(requestOptions, (res) => {
      let data = '';
      res.on('data', (chunk) => data += chunk);
      res.on('end', () => {
        try {
          const result = JSON.parse(data);
          resolve({ ok: res.statusCode >= 200 && res.statusCode < 300, status: res.statusCode, json: () => result });
        } catch (e) {
          resolve({ ok: res.statusCode >= 200 && res.statusCode < 300, status: res.statusCode, json: () => ({ message: data }) });
        }
      });
    });

    req.on('error', reject);
    
    if (options.body) {
      req.write(JSON.stringify(options.body));
    }
    
    req.end();
  });
}

async function stopAllPythonProcesses() {
  try {
    console.log('🛑 Stopping all Python cheating detection processes...');
    
    const response = await makeRequest('http://localhost:3001/stop-all', {
      method: 'POST'
    });

    if (response.ok) {
      const result = await response.json();
      console.log('✅ Success:', result.message);
      console.log(`📊 Stopped ${result.stoppedCount} processes`);
      if (result.stoppedSessions && result.stoppedSessions.length > 0) {
        console.log('📝 Stopped sessions:', result.stoppedSessions.join(', '));
      }
    } else {
      console.error('❌ Failed to stop processes:', response.status);
    }
  } catch (error) {
    console.error('❌ Error stopping processes:', error.message);
    console.log('💡 Make sure the Python helper server is running on port 3001');
  }
}

// Check current processes first
async function checkProcesses() {
  try {
    const response = await makeRequest('http://localhost:3001/processes');
    if (response.ok) {
      const result = await response.json();
      console.log(`📊 Currently running: ${result.totalProcesses} Python processes`);
      if (result.processes.length > 0) {
        console.log('📝 Running sessions:', result.processes.map(p => p.sessionId).join(', '));
      }
    }
  } catch (error) {
    console.log('⚠️ Could not check processes (Python helper server may not be running)');
  }
}

async function main() {
  console.log('🔍 Checking current Python processes...');
  await checkProcesses();
  
  console.log('\n🛑 Stopping all processes...');
  await stopAllPythonProcesses();
  
  console.log('\n✅ Done! All Python cheating detection processes have been stopped.');
}

main().catch(console.error);
