const express = require('express');
const compression = require('compression');
const morgan = require('morgan');
const path = require('path');

// Import configuration and utilities
const config = require('./config/config');
const logger = require('./utils/logger');

// Import middleware
const {
  cors,
  helmet,
  generalRateLimit,
  speedLimit,
  sanitizeInput,
  validateRequest,
  securityHeaders,
  requestLogger,
  errorHandler,
  notFoundHandler,
} = require('./middleware/security');

// Import routes
const donationRoutes = require('./routes/donations');
const webhookRoutes = require('./routes/webhooks');
const expressionRoutes = require('./routes/expressions');
const contactRoutes = require('./routes/contact');
const newsletterRoutes = require('./routes/newsletter');

// Create Express app
const app = express();

// Trust proxy (important for rate limiting and IP detection)
app.set('trust proxy', 1);

// Middleware
app.use(compression()); // Compress responses
app.use(morgan('combined', { stream: logger.stream })); // HTTP request logging
app.use(helmet); // Security headers
app.use(cors); // CORS configuration
app.use(generalRateLimit); // Rate limiting
app.use(speedLimit); // Speed limiting
app.use(securityHeaders); // Additional security headers
app.use(requestLogger); // Custom request logging

// Body parsing middleware
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Input sanitization and validation - removed global application
// app.use(sanitizeInput);
// app.use(validateRequest);

// Static file serving (for receipts and uploads)
app.use('/uploads', express.static(path.join(__dirname, config.upload.path)));

// API Routes
app.use('/api/donations', donationRoutes);
app.use('/api/webhooks', webhookRoutes);
app.use('/api/expressions-of-interest', expressionRoutes);
app.use('/api', contactRoutes);
app.use('/api/newsletter', newsletterRoutes);

// Root endpoint
app.get('/', (req, res) => {
  res.json({
    message: 'Metrax Donation API',
    version: '1.0.0',
    environment: config.nodeEnv,
    timestamp: new Date().toISOString(),
    endpoints: {
      donations: '/api/donations',
      webhooks: '/api/webhooks',
      expressions: '/api/expressions-of-interest',
      contact: '/api/contact',
      health: '/api/health',
    },
  });
});

// API health check
app.get('/api/health', (req, res) => {
  res.json({
    status: 'healthy',
    timestamp: new Date().toISOString(),
    environment: config.nodeEnv,
    uptime: process.uptime(),
    memory: process.memoryUsage(),
  });
});

// 404 handler
app.use(notFoundHandler);

// Error handling middleware (must be last)
app.use(errorHandler);

// Graceful shutdown
const gracefulShutdown = (signal) => {
  logger.info(`Received ${signal}. Starting graceful shutdown...`);
  
  server.close(() => {
    logger.info('HTTP server closed');
    process.exit(0);
  });

  // Force close after 10 seconds
  setTimeout(() => {
    logger.error('Could not close connections in time, forcefully shutting down');
    process.exit(1);
  }, 10000);
};

// Handle uncaught exceptions
process.on('uncaughtException', (error) => {
  logger.error('Uncaught Exception', {
    error: error.message,
    stack: error.stack,
  });
  process.exit(1);
});

// Handle unhandled promise rejections
process.on('unhandledRejection', (reason, promise) => {
  logger.error('Unhandled Rejection', {
    reason: reason,
    promise: promise,
  });
  process.exit(1);
});

// Handle shutdown signals
process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));

// Start server
const server = app.listen(config.port, '0.0.0.0', () => {
  logger.info(`Server started successfully`, {
    port: config.port,
    environment: config.nodeEnv,
    nodeVersion: process.version,
    platform: process.platform,
  });

  // Log startup information
  const baseUrl = config.nodeEnv === 'production' 
    ? `https://metrax-backend.onrender.com` 
    : `http://localhost:${config.port}`;

  console.log(`
╔══════════════════════════════════════════════════════════════╗
║                    Metrax Donation API                       ║
╠══════════════════════════════════════════════════════════════╣
║  Environment: ${config.nodeEnv.padEnd(47)} ║
║  Port: ${config.port.toString().padEnd(52)} ║
║  Node Version: ${process.version.padEnd(45)} ║
║  Platform: ${process.platform.padEnd(48)} ║
╠══════════════════════════════════════════════════════════════╣
║  API Endpoints:                                              ║
║    • Donations: ${baseUrl}/api/donations${' '.repeat(Math.max(0, 25 - baseUrl.length))} ║
║    • Webhooks:  ${baseUrl}/api/webhooks${' '.repeat(Math.max(0, 26 - baseUrl.length))} ║
║    • Health:    ${baseUrl}/api/health${' '.repeat(Math.max(0, 28 - baseUrl.length))} ║
╠══════════════════════════════════════════════════════════════╣
║  Logs: ${config.logging.file.padEnd(49)} ║
╚══════════════════════════════════════════════════════════════╝
  `);
});

module.exports = app; 