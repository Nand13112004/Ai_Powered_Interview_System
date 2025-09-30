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

// Body parsing
app.use(express.json({
  limit: process.env.MAX_REQUEST_SIZE || '10mb',
  verify: (req, res, buf) => {
    if (req.headers['content-type']?.includes('application/json')) {
      req.rawBody = buf;
    }
  }
}));
app.use(express.urlencoded({
  extended: true,
  limit: process.env.MAX_REQUEST_SIZE || '10mb'
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
app.use('/api/generate-questions', generateQuestionsRoute);
app.use('/api/answers', answersRouter);
app.use('/api/responses', responsesRouter);

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

// Proctor namespace
const proctorIo = io.of('/proctor');
const ProctorEvent = require('./models/ProctorEvent');
const Session = require('./models/Session');

proctorIo.on('connection', (socket) => {
  logger.info(`✅ Proctor client connected: ${socket.id}`);
  socket.emit('connected', { msg: 'Connected to /proctor namespace' });

  socket.on('proctor_event', async (payload) => {
    try {
      const { sessionId, type, meta, at } = payload || {};
      logger.info(`📡 Proctor event: ${type} for session ${sessionId}`, { meta, at });

      if (sessionId) {
        const session = await Session.findById(sessionId);
        if (!session) {
          logger.warn(`⚠️ Invalid sessionId for proctor event: ${sessionId}`);
          return;
        }
        await ProctorEvent.create({
          sessionId,
          type,
          metadata: meta ? JSON.stringify(meta) : '{}',
          createdAt: at ? new Date(at) : new Date()
        });
      }
    } catch (err) {
      logger.error('❌ Error handling proctor_event:', err);
    }
  });

  socket.on('disconnect', () => {
    logger.info(`❎ Proctor client disconnected: ${socket.id}`);
  });
});

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
