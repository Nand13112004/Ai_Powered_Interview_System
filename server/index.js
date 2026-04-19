const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
require('dotenv').config();

const authRoutes = require('./routes/auth');
const interviewRoutes = require('./routes/interviews');
const sessionRoutes = require('./routes/sessions');
const scoringRoutes = require('./routes/scoring');
const generateQuestionsRoute = require('./routes/generateQuestions');
const answersRouter = require('./routes/answers');
const responsesRouter = require('./routes/responses');
const aiRoutes = require('./routes/ai');
const audioRoutes = require('./routes/audio');
const { authenticateToken } = require('./middleware/auth');
const { setupSocketHandlers } = require('./socket/handlers');
const { logger } = require('./utils/logger');
const connectMongo = require('./utils/mongo');

// Import security middlewares
const { corsMiddleware } = require('./middleware/cors');
const { securityMiddleware } = require('./middleware/security');

const app = express();
const server = http.createServer(app);

// Environment-specific configuration
const isProduction = process.env.NODE_ENV === 'production';
const clientUrl = process.env.CLIENT_URL || "http://localhost:3000";

// Connect to MongoDB
connectMongo();

// Apply environment-specific security middleware
const securityConfig = securityMiddleware[isProduction ? 'production' : 'development'];
securityConfig.forEach(middleware => app.use(middleware));

// CORS
app.use(corsMiddleware);

// Body parsing — 50mb to accommodate base64 audio payloads
app.use(express.json({
  limit: process.env.MAX_REQUEST_SIZE || '50mb',
  verify: (req, res, buf) => {
    if (req.headers['content-type']?.includes('application/json')) {
      req.rawBody = buf;
    }
  }
}));
app.use(express.urlencoded({
  extended: true,
  limit: process.env.MAX_REQUEST_SIZE || '50mb'
}));

// Request logging
app.use((req, res, next) => {
  const start = Date.now();
  logger.info(`${req.method} ${req.path}`, {
    ip: req.ip,
    userAgent: req.get('User-Agent'),
    origin: req.headers.origin
  });

  res.on('finish', () => {
    const duration = Date.now() - start;
    logger.info(`${req.method} ${req.path} - ${res.statusCode} - ${duration}ms`);
  });

  next();
});

// Health check
app.get('/health', (req, res) => {
  res.json({ status: 'OK', timestamp: new Date().toISOString() });
});

// API routes
app.use('/api/auth', authRoutes);
app.use('/api/interviews', authenticateToken, interviewRoutes);
app.use('/api/sessions', authenticateToken, sessionRoutes);
app.use('/api/scoring', authenticateToken, scoringRoutes);
app.use('/api/generate-questions', generateQuestionsRoute);
app.use('/api/answers', answersRouter);
app.use('/api/responses', responsesRouter);
// Voice + AI pipeline routes
app.use('/api/ai', authenticateToken, aiRoutes);
app.use('/api/audio', authenticateToken, audioRoutes);

// Socket.IO setup
const io = socketIo(server, {
  cors: {
    origin: clientUrl,
    methods: ["GET", "POST"],
    credentials: true
  },
  transports: ['websocket', 'polling'],
  allowEIO3: true
});

setupSocketHandlers(io);

// Error handling
app.use((err, req, res, next) => {
  logger.error('Unhandled error:', err);
  res.status(500).json({
    error: 'Internal server error',
    message: process.env.NODE_ENV === 'development' ? err.message : 'Something went wrong'
  });
});

// 404 handler
app.use('*', (req, res) => {
  res.status(404).json({ error: 'Route not found' });
});

const PORT = process.env.PORT || 5000;
server.listen(PORT, () => {
  logger.info(`🚀 Server running on port ${PORT}`);
  logger.info(`Environment: ${process.env.NODE_ENV || 'development'}`);
});

module.exports = { app, server, io };
