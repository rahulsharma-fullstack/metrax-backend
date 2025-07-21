const express = require('express');
const { body, validationResult } = require('express-validator');
const sanitizeHtml = require('sanitize-html');
const resendEmailService = require('../services/resendEmailService');
const rateLimit = require('express-rate-limit');

const router = express.Router();

// Rate limiting for contact form submissions
const contactFormLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 3, // Limit each IP to 3 requests per windowMs
  message: {
    error: 'Too many contact form submissions from this IP, please try again after 15 minutes.'
  },
  standardHeaders: true,
  legacyHeaders: false,
});

// Contact form submission validation
const validateContactForm = [
  body('name')
    .trim()
    .isLength({ min: 2, max: 100 })
    .withMessage('Name must be between 2 and 100 characters')
    .escape(),
  body('email')
    .isEmail()
    .normalizeEmail()
    .withMessage('Please provide a valid email address'),
  body('subject')
    .trim()
    .isLength({ min: 5, max: 200 })
    .withMessage('Subject must be between 5 and 200 characters')
    .escape(),
  body('message')
    .optional()
    .trim()
    .isLength({ max: 2000 })
    .withMessage('Message must not exceed 2000 characters')
    .customSanitizer(value => {
      return sanitizeHtml(value, {
        allowedTags: [],
        allowedAttributes: {}
      });
    })
];

// POST /api/contact - Submit contact form
router.post('/contact', contactFormLimiter, validateContactForm, async (req, res) => {
  try {
    // Check for validation errors
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        error: 'Validation failed',
        details: errors.array()
      });
    }

    const { name, email, subject, message } = req.body;
    const submittedAt = new Date().toISOString();

    // Prepare contact data
    const contactData = {
      name,
      email,
      subject,
      message: message || '',
      submittedAt
    };

    // Send notification email to admin (non-blocking)
    try {
      await resendEmailService.sendContactNotification(contactData);
      console.log('Admin notification email sent successfully');
    } catch (emailError) {
      console.error('Failed to send admin notification email:', emailError);
      // Don't fail the request if email fails - just log it
    }

    // Return success response
    res.status(200).json({
      success: true,
      message: 'Contact form submitted successfully. We will get back to you soon!',
      data: {
        name,
        email,
        subject,
        submittedAt
      }
    });

  } catch (error) {
    console.error('Contact form submission error:', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error. Please try again later.'
    });
  }
});

// POST /api/contact/send-notification - Manual trigger for sending notifications (admin only)
router.post('/contact/send-notification', async (req, res) => {
  try {
    const { name, email, subject, message, submittedAt } = req.body;

    if (!name || !email || !subject) {
      return res.status(400).json({
        success: false,
        error: 'Missing required fields: name, email, subject'
      });
    }

    const contactData = {
      name,
      email,
      subject,
      message: message || '',
      submittedAt: submittedAt || new Date().toISOString()
    };

    const result = await resendEmailService.sendContactNotification(contactData);

    res.status(200).json({
      success: true,
      message: 'Notification email sent successfully',
      data: result
    });

  } catch (error) {
    console.error('Manual notification error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to send notification email',
      details: error.message
    });
  }
});

// POST /volunteers/send-notification - Send admin notification for new volunteer application
router.post('/volunteers/send-notification', async (req, res) => {
  try {
    const data = req.body;
    // Basic required fields check
    if (!data.firstName || !data.lastName || !data.email) {
      return res.status(400).json({
        success: false,
        error: 'Missing required fields: firstName, lastName, email'
      });
    }
    data.submittedAt = data.submittedAt || new Date().toISOString();
    const result = await resendEmailService.sendVolunteerNotification(data);
    res.status(200).json({
      success: true,
      message: 'Volunteer application notification email sent successfully',
      data: result
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: 'Failed to send volunteer application notification',
      details: error.message
    });
  }
});

// POST /enrollments/send-notification - Send admin notification for new course enrollment
router.post('/enrollments/send-notification', async (req, res) => {
  try {
    const data = req.body;
    // Basic required fields check
    if (!data.firstName || !data.lastName || !data.email || !data.courseId) {
      return res.status(400).json({
        success: false,
        error: 'Missing required fields: firstName, lastName, email, courseId'
      });
    }
    data.submittedAt = data.submittedAt || new Date().toISOString();
    const result = await resendEmailService.sendEnrollmentNotification(data);
    res.status(200).json({
      success: true,
      message: 'Course enrollment notification email sent successfully',
      data: result
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: 'Failed to send course enrollment notification',
      details: error.message
    });
  }
});

module.exports = router;
