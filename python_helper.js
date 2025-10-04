const express = require('express');
const { spawn } = require('child_process');
const cors = require('cors');

const app = express();
const PORT = 3001;

// Middleware
app.use(cors());
app.use(express.json());

// Track running Python processes per session
const runningProcesses = {}; // { sessionId: pythonProcess }

// -------------------
// Launch Python script for real-time cheating detection
// -------------------
app.post('/run-python', (req, res) => {
  const { sessionId, serverUrl, strict = true } = req.body;

  if (!sessionId || !serverUrl) {
    return res.status(400).json({ error: 'Missing sessionId or serverUrl' });
  }

  // Prevent multiple scripts for the same session
  if (runningProcesses[sessionId]) {
    return res.status(400).json({ error: 'Cheating detection already running for this session' });
  }

  console.log(`🚀 Launching real-time Python cheating detection for session: ${sessionId}`);

  const args = ['cheating_detection.py', '--session-id', sessionId, '--server-url', serverUrl];
  if (strict) args.push('--strict');

  const pythonProcess = spawn('python', args, { 
    stdio: ['ignore', 'pipe', 'pipe'], 
    detached: true,
    env: { ...process.env, PYTHONUNBUFFERED: '1' } // Ensure real-time output
  });

  // Capture stdout for real-time monitoring
  pythonProcess.stdout.on('data', (data) => {
    const output = data.toString().trim();
    if (output) {
      console.log(`[Python stdout][${sessionId}]: ${output}`);
    }
  });

  // Capture stderr for error monitoring
  pythonProcess.stderr.on('data', (data) => {
    const error = data.toString().trim();
    if (error) {
      console.error(`[Python stderr][${sessionId}]: ${error}`);
    }
  });

  // Handle process exit
  pythonProcess.on('close', (code) => {
    console.log(`❌ Python cheating detection for session ${sessionId} exited with code ${code}`);
    delete runningProcesses[sessionId];
    
    if (code === 0) {
      console.log(`✅ Python cheating detection completed normally for session ${sessionId}`);
    } else {
      console.log(`⚠️ Python cheating detection exited with error code ${code} for session ${sessionId}`);
    }
  });

  pythonProcess.on('error', (err) => {
    console.error(`❌ Failed to start Python process for session ${sessionId}:`, err);
    delete runningProcesses[sessionId];
  });

  // Detach process to run independently
  pythonProcess.unref();
  runningProcesses[sessionId] = {
    process: pythonProcess,
    startTime: Date.now(),
    pid: pythonProcess.pid
  };

  res.json({ 
    message: 'Real-time Python cheating detection launched successfully', 
    sessionId,
    status: 'running'
  });
});

// -------------------
// Stop Python script
// -------------------
app.post('/stop-python', (req, res) => {
  const { sessionId } = req.body;

  const processInfo = runningProcesses[sessionId];
  if (!processInfo) {
    return res.status(404).json({ error: 'No running script for this session' });
  }

  // Try graceful shutdown first
  processInfo.process.kill('SIGTERM');
  
  // Force kill after 5 seconds if still running
  setTimeout(() => {
    if (runningProcesses[sessionId]) {
      console.log(`🔨 Force killing Python process for session: ${sessionId}`);
      processInfo.process.kill('SIGKILL');
    }
  }, 5000);

  delete runningProcesses[sessionId];
  console.log(`🛑 Stopped Python cheating detection for session: ${sessionId}`);

  res.json({ message: 'Python cheating detection script stopped', sessionId });
});

// -------------------
// Check Python script status
// -------------------
app.get('/status/:sessionId', (req, res) => {
  const { sessionId } = req.params;
  const isRunning = !!runningProcesses[sessionId];
  
  res.json({ 
    sessionId, 
    isRunning,
    status: isRunning ? 'active' : 'inactive'
  });
});

// -------------------
// Get all running processes
// -------------------
app.get('/processes', (req, res) => {
  const processes = Object.keys(runningProcesses).map(sessionId => ({
    sessionId,
    status: 'running',
    pid: runningProcesses[sessionId].pid,
    startTime: runningProcesses[sessionId].startTime,
    runtime: Date.now() - runningProcesses[sessionId].startTime
  }));
  
  res.json({ 
    totalProcesses: processes.length,
    processes 
  });
});

// -------------------
// Stop all Python processes
// -------------------
app.post('/stop-all', (req, res) => {
  const sessionIds = Object.keys(runningProcesses);
  
  if (sessionIds.length === 0) {
    return res.json({ message: 'No running processes to stop', stoppedCount: 0 });
  }

  sessionIds.forEach(sessionId => {
    const processInfo = runningProcesses[sessionId];
    if (processInfo) {
      processInfo.process.kill('SIGTERM');
      delete runningProcesses[sessionId];
      console.log(`🛑 Stopped Python process for session: ${sessionId}`);
    }
  });

  console.log(`🛑 Stopped ${sessionIds.length} Python processes`);
  res.json({ 
    message: `Stopped ${sessionIds.length} Python processes`,
    stoppedCount: sessionIds.length,
    stoppedSessions: sessionIds
  });
});

// -------------------
// Auto-cleanup: Stop processes that have been running too long
// -------------------
setInterval(() => {
  const now = Date.now();
  const maxRunTime = 2 * 60 * 60 * 1000; // 2 hours max runtime
  
  Object.keys(runningProcesses).forEach(sessionId => {
    const processInfo = runningProcesses[sessionId];
    if (processInfo.startTime && (now - processInfo.startTime) > maxRunTime) {
      console.log(`🧹 Auto-stopping long-running Python process for session: ${sessionId}`);
      processInfo.process.kill('SIGTERM');
      delete runningProcesses[sessionId];
    }
  });
}, 60000); // Check every minute

// -------------------
// Health check
// -------------------
app.get('/health', (req, res) => {
  res.json({ status: 'OK' });
});

// -------------------
// Start server
// -------------------
app.listen(PORT, () => {
  console.log(`Python Helper Server running on port ${PORT}`);
  console.log('Ready to launch cheating detection scripts');
});
