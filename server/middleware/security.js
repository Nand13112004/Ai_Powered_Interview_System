const rateLimit = require('express-rate-limit');
const helmet = require('helmet');
const { logger } = require('../utils/logger');

// Rate limiting configurations
const createRateLimit = (windowMs, max, message = 'Too many requests') => {
  return rateLimit({
    windowMs,
    max,
    message: {
      error: message,
      retryAfter: Math.ceil(windowMs / 1000)
    },
    standardHeaders: true,
    legacyHeaders: false,
    handler: (req, res) => {
      logger.warn('Rate limit exceeded', {
        ip: req.ip,
        path: req.path,
        method: req.method
      });
      res.status(429).json({
        error: message,
        retryAfter: Math.ceil(windowMs / 1000)
      });
    }
  });
};

// Specific rate limiters for different endpoints
const authLimiter = createRateLimit(
  15 * 60 * 1000, // 15 minutes
  5, // 5 attempts per window
  'Too many authentication attempts, please try again later'
);

const apiLimiter = createRateLimit(
  15 * 60 * 1000, // 15 minutes
  100, // 100 requests per window
  'Too many API requests, please try again later'
);

const strictLimiter = createRateLimit(
  60 * 1000, // 1 minute
  10, // 10 requests per minute
  'Rate limit exceeded for this endpoint'
);

// Security headers middleware
const securityHeaders = helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'", "https://fonts.googleapis.com"],
      fontSrc: ["'self'", "https://fonts.gstatic.com"],
      scriptSrc: ["'self'"],
      imgSrc: ["'self'", "data:", "https:"],
      connectSrc: ["'self'", "https://api.openai.com", "https://generativelanguage.googleapis.com"],
      frameSrc: ["'none'"],
      objectSrc: ["'none'"],
      upgradeInsecureRequests: [],
    },
  },
  hsts: {
    maxAge: 31536000,
    includeSubDomains: true,
    preload: true
  },
  noSniff: true,
  frameguard: { action: 'deny' },
  xssFilter: true,
  referrerPolicy: { policy: 'strict-origin-when-cross-origin' }
});

// Request sanitization middleware
const sanitizeRequest = (req, res, next) => {
  // Remove sensitive headers that shouldn't be logged
  const sanitizedHeaders = { ...req.headers };
  delete sanitizedHeaders.authorization;
  delete sanitizedHeaders.cookie;
  delete sanitizedHeaders['x-api-key'];

  // Log security-relevant information
  if (req.ip !== req.connection.remoteAddress) {
    logger.info('Request forwarded', {
      originalIp: req.connection.remoteAddress,
      forwardedIp: req.ip,
      userAgent: req.headers['user-agent'],
      path: req.path,
      method: req.method
    });
  }

  next();
};

// SQL injection protection middleware
const sqlInjectionProtection = (req, res, next) => {
  const suspiciousPatterns = [
    /(\b(union|select|insert|update|delete|drop|create|alter|exec|execute)\b)/gi,
    /('|(\\x27)|(\\x2D\\x2D)|(\;)|(\\x3B))/gi,
    /(\bor\b|\band\b)/gi,
    /(\bscript\b|\bjavascript\b|\bon\w+\s*=)/gi
  ];

  const checkValue = (value) => {
    if (typeof value === 'string') {
      for (const pattern of suspiciousPatterns) {
        if (pattern.test(value)) {
          logger.warn('Potential SQL injection attempt detected', {
            ip: req.ip,
            path: req.path,
            method: req.method,
            suspiciousValue: value.substring(0, 100)
          });
          return res.status(400).json({
            error: 'Invalid input detected',
            message: 'Your request contains potentially malicious content'
          });
        }
      }
    } else if (typeof value === 'object' && value !== null) {
      Object.values(value).forEach(checkValue);
    }
  };

  // Check query parameters
  if (req.query) {
    Object.values(req.query).forEach(checkValue);
  }

  // Check body parameters
  if (req.body) {
    checkValue(req.body);
  }

  next();
};

// XSS protection middleware
const xssProtection = (req, res, next) => {
  const xssPatterns = [
    /<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi,
    /javascript:/gi,
    /on\w+\s*=/gi,
    /<iframe\b[^>]*>/gi,
    /<object\b[^>]*>/gi,
    /<embed\b[^>]*>/gi
  ];

  const checkValue = (value) => {
    if (typeof value === 'string') {
      for (const pattern of xssPatterns) {
        if (pattern.test(value)) {
          logger.warn('Potential XSS attempt detected', {
            ip: req.ip,
            path: req.path,
            method: req.method,
            suspiciousValue: value.substring(0, 100)
          });
          return res.status(400).json({
            error: 'Invalid input detected',
            message: 'Your request contains potentially malicious content'
          });
        }
      }
    } else if (typeof value === 'object' && value !== null) {
      Object.values(value).forEach(checkValue);
    }
  };

  // Check query parameters
  if (req.query) {
    Object.values(req.query).forEach(checkValue);
  }

  // Check body parameters
  if (req.body) {
    checkValue(req.body);
  }

  next();
};

// Request size limiting middleware
const requestSizeLimit = (req, res, next) => {
  const maxSize = process.env.MAX_REQUEST_SIZE || 10 * 1024 * 1024; // 10MB default

  if (req.headers['content-length'] && parseInt(req.headers['content-length']) > maxSize) {
    logger.warn('Request size limit exceeded', {
      ip: req.ip,
      path: req.path,
      method: req.method,
      size: req.headers['content-length']
    });
    return res.status(413).json({
      error: 'Request too large',
      message: `Request size exceeds ${maxSize} bytes limit`
    });
  }

  next();
};

// Environment-specific security middleware
const securityMiddleware = {
  development: [
    helmet({
      contentSecurityPolicy: false,
      hsts: false
    }),
    sanitizeRequest
  ],

  production: [
    securityHeaders,
    sanitizeRequest,
    sqlInjectionProtection,
    xssProtection,
    requestSizeLimit
  ],

  strict: [
    securityHeaders,
    sanitizeRequest,
    sqlInjectionProtection,
    xssProtection,
    requestSizeLimit,
    // Additional strict mode protections
    (req, res, next) => {
      // Disable common debugging headers
      res.removeHeader('X-Powered-By');
      res.setHeader('X-Content-Type-Options', 'nosniff');
      res.setHeader('X-Frame-Options', 'DENY');
      res.setHeader('X-XSS-Protection', '1; mode=block');
      next();
    }
  ]
};

module.exports = {
  authLimiter,
  apiLimiter,
  strictLimiter,
  securityMiddleware,
  sanitizeRequest,
  sqlInjectionProtection,
  xssProtection,
  requestSizeLimit
};
