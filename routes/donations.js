const express = require('express');
const { body, validationResult } = require('express-validator');
const validator = require('validator');
const router = express.Router();

// Services
const stripeService = require('../services/stripeService');
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

const FRIENDLY_PROJECT_ID_REGEX = /^[a-z0-9-]{3,64}$/i;

const normalizeDonationPayload = (req, res, next) => {
  if (!req.body || typeof req.body !== 'object') {
    return next();
  }

  const body = req.body;

  // Normalize projectId
  if (!body.projectId) {
    body.projectId = body.project_id || body.projectSlug || body.project_slug || null;
  }
  if (typeof body.projectId === 'string') {
    body.projectId = body.projectId.trim();
  }

  // Normalize donorName - handle anonymous case
  if (!body.donorName) {
    if (body.donor_name) {
      body.donorName = body.donor_name;
    } else if (body.firstName || body.lastName) {
      const composedName = [body.firstName, body.lastName].filter(Boolean).join(' ').trim();
      if (composedName) {
        body.donorName = composedName;
      }
    }
  }
  if (typeof body.donorName === 'string') {
    body.donorName = body.donorName.trim();
  }
  // If anonymous and no name provided, set to 'Anonymous'
  if (body.anonymous && (!body.donorName || body.donorName.trim() === '')) {
    body.donorName = 'Anonymous';
  }

  // Normalize donorEmail
  if (!body.donorEmail) {
    body.donorEmail = body.donor_email || body.email || null;
  }
  if (typeof body.donorEmail === 'string') {
    body.donorEmail = body.donorEmail.trim().toLowerCase();
  }

  // Normalize anonymous flag
  if (typeof body.anonymous === 'string') {
    const normalizedAnonymous = body.anonymous.toLowerCase();
    if (normalizedAnonymous === 'true' || normalizedAnonymous === 'false') {
      body.anonymous = normalizedAnonymous === 'true';
    }
  }
  if (body.anonymous === undefined || body.anonymous === null) {
    body.anonymous = false;
  }

  // Normalize amount
  if (typeof body.amount === 'string') {
    const cleanedAmount = parseFloat(body.amount.replace(/[^0-9.]/g, ''));
    if (!Number.isNaN(cleanedAmount)) {
      body.amount = cleanedAmount;
    }
  }

  // Normalize message
  if (!body.message && (body.note || body.comment)) {
    body.message = body.note || body.comment;
  }
  if (body.message === null || body.message === undefined) {
    body.message = '';
  }

  // Ensure projectTitle exists
  if (!body.projectTitle && body.project_title) {
    body.projectTitle = body.project_title;
  }

  next();
};

// Create payment intent
router.post('/create-payment-intent',
  normalizeDonationPayload,
  paymentRateLimit,
  // Temporarily remove sanitizeInput and validateRequest to debug
  // sanitizeInput,
  // validateRequest,
  [
    body('amount')
      .isFloat({ min: 1.0, max: 10000.0 })
      .withMessage('Amount must be between $1.00 and $10,000.00'),
    body('projectId')
      .custom((value) => {
        if (!value || typeof value !== 'string') {
          logger.warn('Project ID missing or not a string', { value });
          return false;
        }

        const trimmedValue = value.trim();
        if (trimmedValue.toLowerCase() === 'general') {
          return true;
        }

        if (validator.isUUID(trimmedValue)) {
          return true;
        }

        if (FRIENDLY_PROJECT_ID_REGEX.test(trimmedValue)) {
          return true;
        }

        logger.warn('Invalid projectId format', { value });
        return false;
      })
      .withMessage('Invalid project ID'),
    body('donorName')
      .if((value, { req }) => !req.body.anonymous)
      .notEmpty()
      .withMessage('Donor name is required when not anonymous')
      .isLength({ min: 1, max: 100 })
      .withMessage('Donor name must be between 1 and 100 characters'),
    body('donorName')
      .optional({ checkFalsy: true })
      .isLength({ max: 100 })
      .withMessage('Donor name must be less than 100 characters'),
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
        donorName: req.body.anonymous ? 'Anonymous' : (req.body.donorName || 'Anonymous'),
        donorEmail: req.body.donorEmail,
        anonymous: req.body.anonymous || false,
        message: req.body.message || '',
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
  [
    body('paymentIntentId')
      .notEmpty()
      .withMessage('Payment intent ID is required')
      .isString()
      .withMessage('Payment intent ID must be a string'),
    body('projectId')
      .notEmpty()
      .withMessage('Project ID is required')
      .isString()
      .withMessage('Project ID must be a string'),
    body('amount')
      .isNumeric()
      .withMessage('Amount must be a number')
      .isFloat({ min: 1.0, max: 10000.0 })
      .withMessage('Amount must be between $1.00 and $10,000.00'),
    body('donorEmail')
      .isEmail()
      .normalizeEmail()
      .withMessage('Invalid email format'),
    body('donorName')
      .optional({ checkFalsy: true })
      .isString()
      .isLength({ max: 100 })
      .withMessage('Donor name must be less than 100 characters'),
    body('anonymous')
      .optional()
      .isBoolean()
      .withMessage('Anonymous must be a boolean'),
    body('message')
      .optional({ checkFalsy: true })
      .isString()
      .isLength({ max: 500 })
      .withMessage('Message must be less than 500 characters'),
  ],
  async (req, res) => {
    try {
      console.log('=== CONFIRM PAYMENT REQUEST ===');
      console.log('Body:', JSON.stringify(req.body, null, 2));
      console.log('Body keys:', Object.keys(req.body));
      
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        console.log('=== VALIDATION ERRORS ===');
        console.log(JSON.stringify(errors.array(), null, 2));
        logger.error('Validation failed for payment confirmation', {
          errors: errors.array(),
          body: req.body,
        });
        return res.status(400).json({
          error: 'Validation failed',
          details: errors.array(),
        });
      }

      const {
        paymentIntentId,
        projectId,
        amount,
        donorName,
        donorEmail,
        anonymous = false,
        message = '',
        projectTitle,
      } = req.body;

      // Get payment intent details from Stripe
      const paymentIntent = await stripeService.getPaymentIntent(paymentIntentId);

      if (paymentIntent.status !== 'succeeded') {
        logger.warn('Payment intent not succeeded', {
          paymentIntentId,
          status: paymentIntent.status,
        });
        return res.status(400).json({
          error: 'Payment not completed',
          status: paymentIntent.status,
        });
      }

      // Verify amount matches (Stripe uses cents)
      const expectedAmount = Math.round(amount * 100);
      if (paymentIntent.amount !== expectedAmount) {
        logger.error('Amount mismatch', {
          expected: expectedAmount,
          received: paymentIntent.amount,
        });
        return res.status(400).json({
          error: 'Amount mismatch',
        });
      }

      logger.info('Payment confirmed successfully', {
        paymentIntentId,
        projectId,
        amount: parseFloat(amount),
        donorEmail,
      });

      res.json({
        success: true,
        status: paymentIntent.status,
        paymentIntent: {
          id: paymentIntent.id,
          amount: paymentIntent.amount,
          status: paymentIntent.status,
        },
      });
    } catch (error) {
      console.error('Error confirming payment:', error);
      logger.error('Error confirming payment', {
        error: error.message,
        stack: error.stack,
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

      // TODO: Generate refund receipt (currently disabled)
      // const receiptPath = await receiptService.generateRefundReceipt({...});

      // TODO: Send refund notification (currently using Resend)
      // await emailService.sendRefundNotification({...});

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

      // TODO: Receipt generation is currently disabled
      // Using Resend email receipts instead of PDF receipts
      return res.status(501).json({
        error: 'PDF receipt generation is currently disabled. Receipts are sent via email.',
        message: 'Check your email for the donation confirmation receipt.'
      });

      // const receiptPath = receiptService.getReceiptPath(paymentIntentId);
      // const exists = await receiptService.receiptExists(paymentIntentId);

      // if (!exists) {
      //   return res.status(404).json({
      //     error: 'Receipt not found',
      //   });
      // }

      // Send file
      // res.download(receiptPath, `receipt-${paymentIntentId}.pdf`);
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

// Test email endpoint (old emailService - disabled)
router.post('/test-email-old',
  [
    body('email')
      .isEmail()
      .withMessage('Valid email is required'),
  ],
  async (req, res) => {
    try {
      return res.status(501).json({
        error: 'Old email service is disabled',
        message: 'Use /test-resend endpoint instead'
      });

      // const errors = validationResult(req);
      // if (!errors.isEmpty()) {
      //   return res.status(400).json({
      //     error: 'Validation failed',
      //     details: errors.array(),
      //   });
      // }

      // const { email } = req.body;

      // await emailService.testEmail(email);

      // res.json({
      //   success: true,
      //   message: 'Test email sent successfully',
      // });
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

// POST /donations/update-project-amount - Update project amount after successful donation
router.post('/update-project-amount', async (req, res) => {
  try {
    const { projectId, amount } = req.body;
    
    if (!projectId || !amount) {
      return res.status(400).json({
        success: false,
        error: 'Missing required fields: projectId, amount'
      });
    }

    // Import Supabase with service role key to bypass RLS
    const { createClient } = require('@supabase/supabase-js');
    const supabaseUrl = process.env.SUPABASE_URL;
    const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    
    if (!supabaseUrl || !supabaseServiceKey) {
      console.error('Missing Supabase credentials');
      return res.status(500).json({
        success: false,
        error: 'Server configuration error'
      });
    }

    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);
    
    // Get current project
    const { data: project, error: fetchError } = await supabaseAdmin
      .from('projects')
      .select('amount_raised, supporters')
      .eq('id', projectId)
      .single();

    if (fetchError) {
      console.error('Error fetching project:', fetchError);
      return res.status(500).json({
        success: false,
        error: 'Failed to fetch project'
      });
    }

    if (project) {
      const newAmountRaised = project.amount_raised + parseFloat(amount);
      const newSupporters = project.supporters + 1;

      const { error: updateError } = await supabaseAdmin
        .from('projects')
        .update({ 
          amount_raised: newAmountRaised,
          supporters: newSupporters,
          updated_at: new Date().toISOString()
        })
        .eq('id', projectId);

      if (updateError) {
        console.error('Error updating project:', updateError);
        return res.status(500).json({
          success: false,
          error: 'Failed to update project'
        });
      }

      console.log(`Project ${projectId} updated: $${amount} added, now $${newAmountRaised} with ${newSupporters} supporters`);
      
      res.status(200).json({
        success: true,
        message: 'Project amount updated successfully',
        data: {
          projectId,
          amountAdded: amount,
          newAmountRaised,
          newSupporters
        }
      });
    } else {
      res.status(404).json({
        success: false,
        error: 'Project not found'
      });
    }
  } catch (error) {
    console.error('Error updating project amount:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to update project amount',
      details: error.message
    });
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