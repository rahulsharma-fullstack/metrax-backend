const validator = require('validator');
const config = require('../config/config');

const FRIENDLY_PROJECT_ID_REGEX = /^[a-z0-9-]{3,64}$/i;

// Validate email format
const validateEmail = (email) => {
  if (!email || typeof email !== 'string') {
    return false;
  }
  
  return validator.isEmail(email) && email.length <= config.validation.maxEmailLength;
};

// Validate amount
const validateAmount = (amount) => {
  if (typeof amount !== 'number' || isNaN(amount)) {
    return false;
  }
  
  return amount >= config.validation.minDonationAmount && 
         amount <= config.validation.maxDonationAmount;
};

// Validate name
const validateName = (name) => {
  if (!name || typeof name !== 'string') {
    return false;
  }
  
  // Remove extra whitespace and check length
  const trimmedName = name.trim();
  return trimmedName.length > 0 && 
         trimmedName.length <= config.validation.maxNameLength &&
         /^[\p{L}\s\-'\.]+$/u.test(trimmedName); // Allow Unicode letters, spaces, hyphens, apostrophes, and periods
};

// Validate message
const validateMessage = (message) => {
  if (!message) {
    return true; // Optional field
  }
  
  if (typeof message !== 'string') {
    return false;
  }
  
  return message.length <= config.validation.maxMessageLength;
};

// Validate project ID
const validateProjectId = (projectId) => {
  if (!projectId || typeof projectId !== 'string') {
    return false;
  }

  const normalizedProjectId = projectId.trim();

  // Allow "general" as a special project ID for general donations (case insensitive)
  if (normalizedProjectId.toLowerCase() === 'general') {
    return true;
  }

  // UUID format validation
  if (validator.isUUID(normalizedProjectId)) {
    return true;
  }

  // Allow friendly slugs/IDs for legacy marketing pages
  return FRIENDLY_PROJECT_ID_REGEX.test(normalizedProjectId);
};

// Validate payment method
const validatePaymentMethod = (paymentMethod) => {
  const allowedMethods = ['stripe', 'manual', 'check', 'cash'];
  return allowedMethods.includes(paymentMethod);
};

// Validate anonymous flag
const validateAnonymous = (anonymous) => {
  return typeof anonymous === 'boolean';
};

// Sanitize string input
const sanitizeString = (input) => {
  if (typeof input !== 'string') {
    return '';
  }
  
  return validator.escape(input.trim());
};

// Validate donation data object
const validateDonationData = (donationData) => {
  const errors = [];

  // Required fields
  if (!donationData.amount) {
    errors.push('Amount is required');
  } else if (!validateAmount(donationData.amount)) {
    errors.push(`Amount must be between $${config.validation.minDonationAmount} and $${config.validation.maxDonationAmount}`);
  }

  if (!donationData.projectId) {
    errors.push('Project ID is required');
  } else if (!validateProjectId(donationData.projectId)) {
    errors.push('Invalid project ID format');
  }

  if (!donationData.donorEmail) {
    errors.push('Donor email is required');
  } else if (!validateEmail(donationData.donorEmail)) {
    errors.push('Invalid email format');
  }

  // Conditional validation
  if (!donationData.anonymous) {
    if (!donationData.donorName || donationData.donorName.trim() === '') {
      errors.push('Donor name is required for non-anonymous donations');
    } else if (!validateName(donationData.donorName)) {
      errors.push('Invalid donor name format');
    }
  } else {
    // For anonymous donations, donorName can be empty or 'Anonymous'
    if (donationData.donorName && 
        donationData.donorName !== 'Anonymous' && 
        !validateName(donationData.donorName)) {
      errors.push('Invalid donor name format');
    }
  }

  // Optional fields
  if (donationData.message && !validateMessage(donationData.message)) {
    errors.push(`Message must be less than ${config.validation.maxMessageLength} characters`);
  }

  if (donationData.paymentMethod && !validatePaymentMethod(donationData.paymentMethod)) {
    errors.push('Invalid payment method');
  }

  if (donationData.anonymous !== undefined && !validateAnonymous(donationData.anonymous)) {
    errors.push('Invalid anonymous flag');
  }

  return {
    isValid: errors.length === 0,
    errors,
  };
};

// Validate refund data
const validateRefundData = (refundData) => {
  const errors = [];

  if (!refundData.paymentIntentId) {
    errors.push('Payment intent ID is required');
  } else if (!validator.isUUID(refundData.paymentIntentId)) {
    errors.push('Invalid payment intent ID format');
  }

  if (refundData.amount && !validateAmount(refundData.amount)) {
    errors.push(`Refund amount must be between $${config.validation.minDonationAmount} and $${config.validation.maxDonationAmount}`);
  }

  const allowedReasons = ['requested_by_customer', 'duplicate', 'fraudulent'];
  if (refundData.reason && !allowedReasons.includes(refundData.reason)) {
    errors.push('Invalid refund reason');
  }

  return {
    isValid: errors.length === 0,
    errors,
  };
};

// Validate webhook signature
const validateWebhookSignature = (payload, signature, secret) => {
  try {
    const crypto = require('crypto');
    const expectedSignature = crypto
      .createHmac('sha256', secret)
      .update(payload, 'utf8')
      .digest('hex');
    
    return crypto.timingSafeEqual(
      Buffer.from(signature.replace('whsec_', ''), 'hex'),
      Buffer.from(expectedSignature, 'hex')
    );
  } catch (error) {
    return false;
  }
};

// Validate API key
const validateApiKey = (apiKey) => {
  if (!apiKey || typeof apiKey !== 'string') {
    return false;
  }
  
  // In production, you would validate against a database
  // For now, we'll use a simple format check
  return apiKey.length >= 32 && /^[a-zA-Z0-9_-]+$/.test(apiKey);
};

// Validate pagination parameters
const validatePagination = (page, limit) => {
  const pageNum = parseInt(page) || 1;
  const limitNum = parseInt(limit) || 10;
  
  return {
    page: Math.max(1, pageNum),
    limit: Math.min(100, Math.max(1, limitNum)),
  };
};

// Validate date range
const validateDateRange = (startDate, endDate) => {
  const start = new Date(startDate);
  const end = new Date(endDate);
  
  if (isNaN(start.getTime()) || isNaN(end.getTime())) {
    return false;
  }
  
  if (start > end) {
    return false;
  }
  
  // Check if date range is not too large (e.g., max 1 year)
  const oneYear = 365 * 24 * 60 * 60 * 1000;
  if (end - start > oneYear) {
    return false;
  }
  
  return true;
};

// Validate search query
const validateSearchQuery = (query) => {
  if (!query || typeof query !== 'string') {
    return false;
  }
  
  const trimmedQuery = query.trim();
  return trimmedQuery.length >= 2 && trimmedQuery.length <= 100;
};

// Validate file upload
const validateFileUpload = (file) => {
  if (!file) {
    return { isValid: false, error: 'No file provided' };
  }
  
  // Check file size
  if (file.size > config.upload.maxFileSize) {
    return { 
      isValid: false, 
      error: `File size must be less than ${config.upload.maxFileSize / (1024 * 1024)}MB` 
    };
  }
  
  // Check file type
  if (!config.upload.allowedTypes.includes(file.mimetype)) {
    return { 
      isValid: false, 
      error: `File type not allowed. Allowed types: ${config.upload.allowedTypes.join(', ')}` 
    };
  }
  
  return { isValid: true };
};

module.exports = {
  validateEmail,
  validateAmount,
  validateName,
  validateMessage,
  validateProjectId,
  validatePaymentMethod,
  validateAnonymous,
  sanitizeString,
  validateDonationData,
  validateRefundData,
  validateWebhookSignature,
  validateApiKey,
  validatePagination,
  validateDateRange,
  validateSearchQuery,
  validateFileUpload,
}; 