const cors = require('cors');
const { logger } = require('../utils/logger');

// Environment-specific CORS configuration
const getCorsOptions = () => {
  const isProduction = process.env.NODE_ENV === 'production';
  const allowedOrigins = isProduction
    ? process.env.ALLOWED_ORIGINS?.split(',') || []
    : ['http://localhost:3000', 'http://localhost:3001', 'http://127.0.0.1:3000'];

  const corsOptions = {
    origin: (origin, callback) => {
      // Allow requests with no origin (like mobile apps or curl requests)
      if (!origin) return callback(null, true);

      if (allowedOrigins.includes(origin)) {
        callback(null, true);
      } else {
        logger.warn(`CORS blocked origin: ${origin}`);
        callback(new Error('Not allowed by CORS'));
      }
    },
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS', 'PATCH'],
    allowedHeaders: [
      'Origin',
      'X-Requested-With',
      'Content-Type',
      'Accept',
      'Authorization',
      'X-HTTP-Method-Override',
      'X-CSRF-Token'
    ],
    exposedHeaders: ['X-Total-Count', 'X-Rate-Limit-Remaining'],
    maxAge: isProduction ? 86400 : 0, // Cache preflight for 24 hours in production
    optionsSuccessStatus: 200 // Some legacy browsers choke on 204
  };

  return corsOptions;
};

// Enhanced CORS middleware with logging
const corsMiddleware = (req, res, next) => {
  const corsHandler = cors(getCorsOptions());

  // Log CORS requests in development
  if (process.env.NODE_ENV !== 'production') {
    const origin = req.headers.origin;
    if (origin) {
      logger.info(`CORS request from: ${origin} - ${req.method} ${req.path}`);
    }
  }

  corsHandler(req, res, (err) => {
    if (err) {
      logger.error('CORS error:', {
        origin: req.headers.origin,
        method: req.method,
        path: req.path,
        error: err.message
      });
      return res.status(403).json({
        error: 'CORS policy violation',
        message: 'Origin not allowed'
      });
    }
    next();
  });
};

// Pre-configured CORS middleware for different environments
const corsConfig = {
  development: cors({
    origin: ['http://localhost:3000', 'http://localhost:3001', 'http://127.0.0.1:3000'],
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS', 'PATCH'],
    allowedHeaders: ['Origin', 'X-Requested-With', 'Content-Type', 'Accept', 'Authorization'],
    maxAge: 0
  }),

  production: cors({
    origin: function (origin, callback) {
      const allowedOrigins = process.env.ALLOWED_ORIGINS?.split(',') || [];
      if (!origin || allowedOrigins.includes(origin)) {
        callback(null, true);
      } else {
        logger.warn(`Blocked CORS request from: ${origin}`);
        callback(new Error('Not allowed by CORS'));
      }
    },
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS', 'PATCH'],
    allowedHeaders: ['Origin', 'X-Requested-With', 'Content-Type', 'Accept', 'Authorization'],
    maxAge: 86400
  }),

  strict: cors({
    origin: function (origin, callback) {
      const allowedOrigins = process.env.ALLOWED_ORIGINS?.split(',') || [];
      if (allowedOrigins.includes(origin)) {
        callback(null, true);
      } else {
        callback(new Error('Not allowed by CORS'));
      }
    },
    credentials: true,
    methods: ['GET', 'POST'],
    allowedHeaders: ['Content-Type', 'Authorization'],
    maxAge: 3600
  })
};

module.exports = {
  corsMiddleware,
  corsConfig,
  getCorsOptions
};
