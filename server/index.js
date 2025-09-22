const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
require('dotenv').config();

const authRoutes = require('./routes/auth');
const interviewRoutes = require('./routes/interviews');
const sessionRoutes = require('./routes/sessions');
const generateQuestionsRoute = require('./routes/generateQuestions');
const answersRouter = require('./routes/answers');
const responsesRouter = require('./routes/responses');
const { authenticateToken } = require('./middleware/auth');
const { setupSocketHandlers } = require('./socket/handlers');
const { logger } = require('./utils/logger');
const connectMongo = require('./utils/mongo');

// Import security middlewares
const { corsMiddleware } = require('./middleware/cors');
const { securityMiddleware, apiLimiter, authLimiter } = require('./middleware/security');

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

// CORS configuration
app.use(corsMiddleware);

// Body parsing middleware with security limits
app.use(express.json({
  limit: process.env.MAX_REQUEST_SIZE || '10mb',
  verify: (req, res, buf) => {
    // Store raw body for signature verification if needed
    if (req.headers['content-type']?.includes('application/json')) {
      req.rawBody = buf;
    }
  }
}));
app.use(express.urlencoded({
  extended: true,
  limit: process.env.MAX_REQUEST_SIZE || '10mb'
}));

// Request logging middleware
app.use((req, res, next) => {
  const start = Date.now();
  logger.info(`${req.method} ${req.path}`, {
    ip: req.ip,
    userAgent: req.get('User-Agent'),
    origin: req.headers.origin
  });

  // Log response time
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
app.use('/api/generate-questions', generateQuestionsRoute);
app.use('/api/answers', answersRouter);
app.use('/api/responses', responsesRouter);

// Socket.IO connection handling with enhanced security
const io = socketIo(server, {
  cors: {
    origin: clientUrl,
    methods: ["GET", "POST"],
    credentials: true
  },
  transports: ['websocket', 'polling'],
  allowEIO3: true,
  maxHttpBufferSize: 1e6, // 1MB
  connectTimeout: 45000,
  pingTimeout: 30000,
  pingInterval: 25000
});

setupSocketHandlers(io);

// Error handling middleware
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
  logger.info(`Server running on port ${PORT}`);
  logger.info(`Environment: ${process.env.NODE_ENV || 'development'}`);
});

module.exports = { app, server, io };
