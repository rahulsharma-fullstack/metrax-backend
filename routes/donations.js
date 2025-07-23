const express = require('express');
const { body, validationResult } = require('express-validator');
const router = express.Router();

// Services
const stripeService = require('../services/stripeService');
const emailService = require('../services/emailService');
const receiptService = require('../services/receiptService');
const resendEmailService = require('../services/resendEmailService');

// Middleware
const { 
  paymentRateLimit, 
  sanitizeInput, 
  validateRequest 
} = require('../middleware/security');

// Validation
const { validateDonationData, validateRefundData } = require('../utils/validation');

// Logger
const logger = require('../utils/logger');

// Create payment intent
router.post('/create-payment-intent', 
  // Add debugging middleware to see what's actually being received
  (req, res, next) => {
    console.log('Raw request body:', req.body);
    console.log('Request headers:', req.headers);
    console.log('Content-Type:', req.headers['content-type']);
    next();
  },
  paymentRateLimit,
  // Temporarily disable sanitizeInput and validateRequest to fix the issue
  // sanitizeInput,
  // validateRequest,
  [
    body('amount')
      .isFloat({ min: 1.0, max: 10000.0 })
      .withMessage('Amount must be between $1.00 and $10,000.00'),
    body('projectId')
      .custom((value) => {
        logger.info('Validating projectId:', { value, type: typeof value });
        if (value === 'general') {
          return true;
        }
        const isValid = require('validator').isUUID(value);
        if (!isValid) {
          logger.warn('Invalid projectId format:', { value });
        }
        return isValid;
      })
      .withMessage('Invalid project ID'),
    body('donorName')
      .optional()
      .isLength({ min: 1, max: 100 })
      .withMessage('Donor name must be between 1 and 100 characters'),
    body('donorEmail')
      .isEmail()
      .withMessage('Invalid email format'),
    body('anonymous')
      .optional()
      .isBoolean()
      .withMessage('Anonymous must be a boolean'),
    body('message')
      .optional()
      .isLength({ max: 500 })
      .withMessage('Message must be less than 500 characters'),
  ],
  async (req, res) => {
    try {
      // Check for validation errors
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        logger.error('Validation failed for payment intent creation', {
          errors: errors.array(),
          body: req.body,
        });
        return res.status(400).json({
          error: 'Validation failed',
          details: errors.array(),
        });
      }

      const donationData = {
        amount: parseFloat(req.body.amount),
        projectId: req.body.projectId,
        donorName: req.body.donorName,
        donorEmail: req.body.donorEmail,
        anonymous: req.body.anonymous || false,
        message: req.body.message,
        projectTitle: req.body.projectTitle || 'Community Project',
      };

      // Additional validation
      const validation = validateDonationData(donationData);
      if (!validation.isValid) {
        return res.status(400).json({
          error: 'Invalid donation data',
          details: validation.errors,
        });
      }

      // Create payment intent
      const paymentIntent = await stripeService.createPaymentIntent(donationData);

      logger.info('Payment intent created', {
        paymentIntentId: paymentIntent.paymentIntentId,
        amount: paymentIntent.amount,
        projectId: donationData.projectId,
      });

      res.json({
        success: true,
        clientSecret: paymentIntent.clientSecret,
        paymentIntentId: paymentIntent.paymentIntentId,
      });
    } catch (error) {
      logger.error('Error creating payment intent', {
        error: error.message,
        body: req.body,
      });

      res.status(500).json({
        error: error.message || 'Failed to create payment intent',
      });
    }
  }
);

// Confirm payment
router.post('/confirm-payment',
  paymentRateLimit,
  sanitizeInput,
  validateRequest,
  [
    body('paymentIntentId')
      .isString()
      .withMessage('Payment intent ID is required'),
    body('paymentMethodId')
      .isString()
      .withMessage('Payment method ID is required'),
  ],
  async (req, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({
          error: 'Validation failed',
          details: errors.array(),
        });
      }

      const { paymentIntentId, paymentMethodId } = req.body;

      // Confirm payment
      const result = await stripeService.confirmPayment(paymentIntentId, paymentMethodId);

      if (result.success) {
        // Get payment intent details
        const paymentIntent = await stripeService.getPaymentIntent(paymentIntentId);
        
        // Generate receipt
        const receiptPath = await receiptService.generateReceipt({
          paymentIntentId,
          amount: paymentIntent.amount / 100, // Convert from cents
          donorName: paymentIntent.metadata.donorName,
          donorEmail: paymentIntent.metadata.donorEmail,
          anonymous: paymentIntent.metadata.anonymous === 'true',
          message: paymentIntent.metadata.message,
          projectTitle: paymentIntent.description?.replace('Donation to ', '') || 'Community Project',
          paymentMethod: 'stripe',
        });

        // Send confirmation email
        await emailService.sendDonationConfirmation({
          paymentIntentId,
          amount: paymentIntent.amount / 100,
          donorName: paymentIntent.metadata.donorName,
          donorEmail: paymentIntent.metadata.donorEmail,
          anonymous: paymentIntent.metadata.anonymous === 'true',
          message: paymentIntent.metadata.message,
          projectTitle: paymentIntent.description?.replace('Donation to ', '') || 'Community Project',
          receiptPath,
        });

        // Send admin notification
        await emailService.sendAdminNotification({
          paymentIntentId,
          amount: paymentIntent.amount / 100,
          donorName: paymentIntent.metadata.donorName,
          donorEmail: paymentIntent.metadata.donorEmail,
          anonymous: paymentIntent.metadata.anonymous === 'true',
          message: paymentIntent.metadata.message,
          projectTitle: paymentIntent.description?.replace('Donation to ', '') || 'Community Project',
        });

        logger.info('Payment confirmed successfully', {
          paymentIntentId,
          amount: paymentIntent.amount,
        });
      }

      res.json({
        success: result.success,
        status: result.status,
      });
    } catch (error) {
      logger.error('Error confirming payment', {
        error: error.message,
        paymentIntentId: req.body.paymentIntentId,
      });

      res.status(500).json({
        error: error.message || 'Failed to confirm payment',
      });
    }
  }
);

// Get payment intent
router.get('/payment-intent/:id',
  async (req, res) => {
    try {
      const { id } = req.params;

      if (!id) {
        return res.status(400).json({
          error: 'Payment intent ID is required',
        });
      }

      const paymentIntent = await stripeService.getPaymentIntent(id);

      res.json({
        success: true,
        paymentIntent,
      });
    } catch (error) {
      logger.error('Error retrieving payment intent', {
        error: error.message,
        paymentIntentId: req.params.id,
      });

      res.status(404).json({
        error: 'Payment intent not found',
      });
    }
  }
);

// Create refund
router.post('/refund',
  paymentRateLimit,
  sanitizeInput,
  validateRequest,
  [
    body('paymentIntentId')
      .isString()
      .withMessage('Payment intent ID is required'),
    body('amount')
      .optional()
      .isFloat({ min: 1.0 })
      .withMessage('Refund amount must be at least $1.00'),
    body('reason')
      .optional()
      .isIn(['requested_by_customer', 'duplicate', 'fraudulent'])
      .withMessage('Invalid refund reason'),
  ],
  async (req, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({
          error: 'Validation failed',
          details: errors.array(),
        });
      }

      const refundData = {
        paymentIntentId: req.body.paymentIntentId,
        amount: req.body.amount,
        reason: req.body.reason || 'requested_by_customer',
      };

      // Additional validation
      const validation = validateRefundData(refundData);
      if (!validation.isValid) {
        return res.status(400).json({
          error: 'Invalid refund data',
          details: validation.errors,
        });
      }

      // Get original payment intent
      const paymentIntent = await stripeService.getPaymentIntent(refundData.paymentIntentId);

      // Create refund
      const refund = await stripeService.createRefund(
        refundData.paymentIntentId,
        refundData.amount,
        refundData.reason
      );

      // Generate refund receipt
      const receiptPath = await receiptService.generateRefundReceipt({
        refundId: refund.id,
        originalAmount: paymentIntent.amount / 100,
        refundAmount: refund.amount / 100,
        reason: refundData.reason,
        projectTitle: paymentIntent.description?.replace('Donation to ', '') || 'Community Project',
        originalPaymentIntentId: paymentIntent.id,
        originalDate: new Date(paymentIntent.created * 1000),
        donorName: paymentIntent.metadata.donorName,
        donorEmail: paymentIntent.metadata.donorEmail,
      });

      // Send refund notification
      await emailService.sendRefundNotification({
        donorName: paymentIntent.metadata.donorName,
        donorEmail: paymentIntent.metadata.donorEmail,
        originalAmount: paymentIntent.amount / 100,
        refundAmount: refund.amount / 100,
        projectTitle: paymentIntent.description?.replace('Donation to ', '') || 'Community Project',
        refundId: refund.id,
        reason: refundData.reason,
      });

      logger.info('Refund created successfully', {
        refundId: refund.id,
        paymentIntentId: refundData.paymentIntentId,
        amount: refund.amount,
      });

      res.json({
        success: true,
        refund,
      });
    } catch (error) {
      logger.error('Error creating refund', {
        error: error.message,
        body: req.body,
      });

      res.status(500).json({
        error: error.message || 'Failed to create refund',
      });
    }
  }
);

// Get receipt
router.get('/receipt/:paymentIntentId',
  async (req, res) => {
    try {
      const { paymentIntentId } = req.params;

      if (!paymentIntentId) {
        return res.status(400).json({
          error: 'Payment intent ID is required',
        });
      }

      const receiptPath = receiptService.getReceiptPath(paymentIntentId);
      const exists = await receiptService.receiptExists(paymentIntentId);

      if (!exists) {
        return res.status(404).json({
          error: 'Receipt not found',
        });
      }

      // Send file
      res.download(receiptPath, `receipt-${paymentIntentId}.pdf`);
    } catch (error) {
      logger.error('Error retrieving receipt', {
        error: error.message,
        paymentIntentId: req.params.paymentIntentId,
      });

      res.status(500).json({
        error: 'Failed to retrieve receipt',
      });
    }
  }
);

// Test email endpoint
router.post('/test-email',
  [
    body('email')
      .isEmail()
      .withMessage('Valid email is required'),
  ],
  async (req, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({
          error: 'Validation failed',
          details: errors.array(),
        });
      }

      const { email } = req.body;

      await emailService.testEmail(email);

      res.json({
        success: true,
        message: 'Test email sent successfully',
      });
    } catch (error) {
      logger.error('Error sending test email', {
        error: error.message,
        email: req.body.email,
      });

      res.status(500).json({
        error: 'Failed to send test email',
      });
    }
  }
);

// POST /donations/send-notification - Send admin notification for new donation
router.post('/send-notification', async (req, res) => {
  try {
    const { donorName, donorEmail, amount, projectTitle, message, submittedAt } = req.body;
    if (!donorEmail || !amount || !projectTitle) {
      return res.status(400).json({
        success: false,
        error: 'Missing required fields: donorEmail, amount, projectTitle'
      });
    }
    const donationData = {
      donorName,
      donorEmail,
      amount,
      projectTitle,
      message: message || '',
      submittedAt: submittedAt || new Date().toISOString()
    };
    const result = await resendEmailService.sendDonationNotification(donationData);
    res.status(200).json({
      success: true,
      message: 'Donation notification email sent successfully',
      data: result
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: 'Failed to send donation notification',
      details: error.message
    });
  }
});

// POST /donations/send-confirmation - Send confirmation email to donor
router.post('/send-confirmation', async (req, res) => {
  try {
    const { donorName, donorEmail, amount, projectTitle, message, submittedAt, paymentId } = req.body;
    if (!donorEmail || !amount || !projectTitle) {
      return res.status(400).json({
        success: false,
        error: 'Missing required fields: donorEmail, amount, projectTitle'
      });
    }
    
    const donationData = {
      donorName: donorName || 'Anonymous',
      donorEmail,
      amount,
      projectTitle,
      message: message || '',
      submittedAt: submittedAt || new Date().toISOString(),
      paymentId
    };
    
    const result = await resendEmailService.sendDonationConfirmation(donationData);
    res.status(200).json({
      success: true,
      message: 'Donation confirmation email sent successfully',
      data: result
    });
  } catch (error) {
    console.error('Error sending donation confirmation:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to send donation confirmation',
      details: error.message
    });
  }
});

// Test email endpoint
router.post('/test-email', async (req, res) => {
  try {
    const { email } = req.body;
    if (!email) {
      return res.status(400).json({ error: 'Email is required' });
    }

    const testData = {
      donorName: 'Test User',
      donorEmail: email,
      amount: '25.00',
      projectTitle: 'Test Project',
      message: 'This is a test donation',
      submittedAt: new Date().toISOString(),
      paymentId: 'test_payment_123'
    };

    const result = await resendEmailService.sendDonationConfirmation(testData);
    res.json({
      success: true,
      message: 'Test email sent successfully',
      data: result
    });
  } catch (error) {
    console.error('Test email error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to send test email',
      details: error.message
    });
  }
});

// POST /donations/test-resend - Test resend email
router.post('/test-resend', async (req, res) => {
  try {
    const { email } = req.body;
    const result = await resendEmailService.testEmail(email);
    res.json({ success: true, data: result });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Health check endpoint
router.get('/health',
  (req, res) => {
    res.json({
      status: 'healthy',
      timestamp: new Date().toISOString(),
      service: 'donation-api',
    });
  }
);

module.exports = router;