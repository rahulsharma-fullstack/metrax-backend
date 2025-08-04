require('dotenv').config();

const config = {
  // Server Configuration
  nodeEnv: process.env.NODE_ENV || 'development',
  port: process.env.PORT || 3001,
  frontendUrl: process.env.FRONTEND_URL || 'http://localhost:8080',

  // Stripe Configuration
  stripe: {
    secretKey: process.env.STRIPE_SECRET_KEY,
    webhookSecret: process.env.STRIPE_WEBHOOK_SECRET,
    currency: 'cad',
    paymentMethods: ['card'],
  },

  // Resend Email Configuration
  resend: {
    apiKey: process.env.RESEND_API_KEY,
    fromDomain: process.env.NODE_ENV === 'production' 
      ? 'mail.metraxindigenous.com' 
      : 'resend.dev',
    adminEmail: process.env.NODE_ENV === 'production'
      ? 'info@metraxindigenous.com'
      : 'jemily12313@gmail.com',
  },

  // JWT Configuration
  jwt: {
    secret: process.env.JWT_SECRET || 'your-secret-key-change-in-production',
    expiresIn: process.env.JWT_EXPIRES_IN || '24h',
  },

  // Rate Limiting
  rateLimit: {
    windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS) || 15 * 60 * 1000, // 15 minutes
    maxRequests: parseInt(process.env.RATE_LIMIT_MAX_REQUESTS) || 100,
    message: 'Too many requests from this IP, please try again later.',
  },

  // Security
  security: {
    bcryptRounds: parseInt(process.env.BCRYPT_ROUNDS) || 12,
    sessionSecret: process.env.SESSION_SECRET || 'your-session-secret-change-in-production',
    corsOrigins: process.env.CORS_ORIGINS 
      ? process.env.CORS_ORIGINS.split(',') 
      : [
          'http://localhost:8080', 
          'http://localhost:8081', 
          'http://localhost:5173', 
          'http://localhost:3000',
          'https://metraxindigenous.com',
          'https://www.metraxindigenous.com'
        ],
  },

  // Logging
  logging: {
    level: process.env.LOG_LEVEL || 'info',
    file: process.env.LOG_FILE || 'logs/app.log',
  },

  // File Upload
  upload: {
    path: process.env.UPLOAD_PATH || './uploads',
    maxFileSize: parseInt(process.env.MAX_FILE_SIZE) || 5 * 1024 * 1024, // 5MB
    allowedTypes: ['application/pdf', 'image/jpeg', 'image/png'],
  },

  // Validation
  validation: {
    minDonationAmount: 1.00,
    maxDonationAmount: 10000.00,
    maxMessageLength: 500,
    maxNameLength: 100,
    maxEmailLength: 254,
  },
};

// Validate required environment variables
const requiredEnvVars = [
  'STRIPE_SECRET_KEY',
  'RESEND_API_KEY',
  'JWT_SECRET',
];

const missingEnvVars = requiredEnvVars.filter(envVar => !process.env[envVar]);

if (missingEnvVars.length > 0 && config.nodeEnv === 'production') {
  throw new Error(`Missing required environment variables: ${missingEnvVars.join(', ')}`);
}

module.exports = config; 