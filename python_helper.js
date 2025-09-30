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
// Launch Python script
// -------------------
app.post('/run-python', (req, res) => {
  const { sessionId, serverUrl, strict } = req.body;

  if (!sessionId || !serverUrl) {
    return res.status(400).json({ error: 'Missing sessionId or serverUrl' });
  }

  // Prevent multiple scripts for the same session
  if (runningProcesses[sessionId]) {
    return res.status(400).json({ error: 'Cheating detection already running for this session' });
  }

  console.log(`🚀 Launching Python cheating detection script for session: ${sessionId}`);

  const args = ['cheating_detection.py', '--session-id', sessionId, '--server-url', serverUrl];
  if (strict) args.push('--strict');

  const pythonProcess = spawn('python', args, { stdio: ['ignore', 'pipe', 'pipe'], detached: true });

  // Capture stdout
  pythonProcess.stdout.on('data', (data) => {
    console.log(`[Python stdout][${sessionId}]: ${data.toString()}`);
  });

  // Capture stderr
  pythonProcess.stderr.on('data', (data) => {
    console.error(`[Python stderr][${sessionId}]: ${data.toString()}`);
  });

  // Handle process exit
  pythonProcess.on('close', (code) => {
    console.log(`❌ Python process for session ${sessionId} exited with code ${code}`);
    delete runningProcesses[sessionId];
  });

  pythonProcess.on('error', (err) => {
    console.error(`❌ Failed to start Python process for session ${sessionId}:`, err);
    delete runningProcesses[sessionId];
  });

  // Detach process
  pythonProcess.unref();
  runningProcesses[sessionId] = pythonProcess;

  res.json({ message: 'Python cheating detection script launched successfully', sessionId });
});

// -------------------
// Stop Python script
// -------------------
app.post('/stop-python', (req, res) => {
  const { sessionId } = req.body;

  const pythonProcess = runningProcesses[sessionId];
  if (!pythonProcess) {
    return res.status(404).json({ error: 'No running script for this session' });
  }

  pythonProcess.kill();
  delete runningProcesses[sessionId];
  console.log(`🛑 Stopped Python script for session: ${sessionId}`);

  res.json({ message: 'Python cheating detection script stopped', sessionId });
});

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
