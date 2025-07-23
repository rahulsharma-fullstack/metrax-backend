const express = require('express');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const speedLimit = require('express-slow-down');
const cors = require('cors');
const xss = require('xss-clean');
const hpp = require('hpp');
const config = require('../config/config');
const logger = require('../utils/logger');

// Rate limiting middleware
const createRateLimiter = (windowMs, max, message) => {
  return rateLimit({
    windowMs,
    max,
    message: {
      error: message,
      retryAfter: Math.ceil(windowMs / 1000),
    },
    standardHeaders: true,
    legacyHeaders: false,
    handler: (req, res) => {
      logger.warn(`Rate limit exceeded for IP: ${req.ip}`, {
        ip: req.ip,
        userAgent: req.get('User-Agent'),
        path: req.path,
      });
      res.status(429).json({
        error: message,
        retryAfter: Math.ceil(windowMs / 1000),
      });
    },
  });
};

// Speed limiting middleware
const createSpeedLimiter = (windowMs, delayAfter, delayMs) => {
  return speedLimit({
    windowMs,
    delayAfter,
    delayMs: () => delayMs, // Fixed: Convert to function for new express-slow-down version
    validate: { delayMs: false }, // Disable warning
    handler: (req, res) => {
      logger.info(`Speed limit applied for IP: ${req.ip}`, {
        ip: req.ip,
        path: req.path,
      });
    },
  });
};

// CORS configuration
const corsOptions = {
  origin: function (origin, callback) {
    // Allow requests with no origin (like mobile apps or curl requests)
    if (!origin) return callback(null, true);
    
    if (config.security.corsOrigins.indexOf(origin) !== -1) {
      callback(null, true);
    } else {
      callback(new Error('Not allowed by CORS'));
    }
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With'],
  exposedHeaders: ['Content-Range', 'X-Content-Range'],
};

// Input sanitization middleware
const sanitizeInput = (req, res, next) => {
  if (req.body) {
    Object.keys(req.body).forEach(key => {
      if (typeof req.body[key] === 'string') {
        req.body[key] = xss(req.body[key]);
      }
    });
  }
  
  if (req.query) {
    Object.keys(req.query).forEach(key => {
      if (typeof req.query[key] === 'string') {
        req.query[key] = xss(req.query[key]);
      }
    });
  }
  
  next();
};

// Request validation middleware
const validateRequest = (req, res, next) => {
  // Basic request validation
  if (req.body && Object.keys(req.body).length > 0) {
    const contentType = req.get('Content-Type');
    if (!contentType || !contentType.includes('application/json')) {
      return res.status(400).json({
        error: 'Content-Type must be application/json',
      });
    }
  }
  
  next();
};

// Security headers middleware
const securityHeaders = (req, res, next) => {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('X-XSS-Protection', '1; mode=block');
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  res.setHeader('Permissions-Policy', 'geolocation=(), microphone=(), camera=()');
  next();
};

// Request logging middleware
const requestLogger = (req, res, next) => {
  const start = Date.now();
  
  res.on('finish', () => {
    const duration = Date.now() - start;
    const logData = {
      method: req.method,
      url: req.url,
      status: res.statusCode,
      duration: `${duration}ms`,
      ip: req.ip,
      userAgent: req.get('User-Agent'),
    };
    
    if (res.statusCode >= 400) {
      logger.warn('HTTP Request', logData);
    } else {
      logger.info('HTTP Request', logData);
    }
  });
  
  next();
};

// Error handling middleware
const errorHandler = (err, req, res, next) => {
  logger.error('Error occurred', {
    error: err.message,
    stack: err.stack,
    url: req.url,
    method: req.method,
    ip: req.ip,
  });

  // Don't leak error details in production
  if (config.nodeEnv === 'production') {
    return res.status(500).json({
      error: 'Internal server error',
    });
  }

  res.status(500).json({
    error: err.message,
    stack: err.stack,
  });
};

// 404 handler
const notFoundHandler = (req, res) => {
  res.status(404).json({
    error: 'Endpoint not found',
    path: req.path,
    method: req.method,
  });
};

module.exports = {
  // General rate limiter
  generalRateLimit: createRateLimiter(
    config.rateLimit.windowMs,
    config.rateLimit.maxRequests,
    config.rateLimit.message
  ),
  
  // Stricter rate limiter for payment endpoints
  paymentRateLimit: createRateLimiter(
    15 * 60 * 1000, // 15 minutes
    10, // 10 requests per 15 minutes
    'Too many payment requests, please try again later.'
  ),
  
  // Speed limiter
  speedLimit: createSpeedLimiter(
    15 * 60 * 1000, // 15 minutes
    50, // After 50 requests
    500 // Add 500ms delay
  ),
  
  // CORS
  cors: cors(corsOptions),
  
  // Helmet for security headers
  helmet: helmet({
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        styleSrc: ["'self'", "'unsafe-inline'", "https://fonts.googleapis.com"],
        fontSrc: ["'self'", "https://fonts.gstatic.com"],
        imgSrc: ["'self'", "data:", "https:"],
        scriptSrc: ["'self'", "https://js.stripe.com"],
        frameSrc: ["'self'", "https://js.stripe.com", "https://hooks.stripe.com"],
        connectSrc: ["'self'", "https://api.stripe.com"],
      },
    },
    crossOriginEmbedderPolicy: false,
  }),
  
  // Input sanitization
  sanitizeInput,
  
  // Request validation
  validateRequest,
  
  // Security headers
  securityHeaders,
  
  // Request logging
  requestLogger,
  
  // Error handling
  errorHandler,
  
  // 404 handler
  notFoundHandler,
}; 