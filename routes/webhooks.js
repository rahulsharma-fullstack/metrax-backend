const express = require('express');
const router = express.Router();

// Services
const stripeService = require('../services/stripeService');
const emailService = require('../services/emailService');

// Middleware
const { sanitizeInput } = require('../middleware/security');

// Validation
const { validateWebhookSignature } = require('../utils/validation');

// Logger
const logger = require('../utils/logger');

// Config
const config = require('../config/config');

// Stripe webhook endpoint
router.post('/stripe',
  express.raw({ type: 'application/json' }), // Raw body for signature verification
  async (req, res) => {
    try {
      const sig = req.headers['stripe-signature'];
      const payload = req.body;

      if (!sig) {
        logger.warn('Stripe webhook received without signature', {
          headers: req.headers,
        });
        return res.status(400).json({ error: 'Missing signature' });
      }

      // Verify webhook signature
      const isValidSignature = validateWebhookSignature(
        payload,
        sig,
        config.stripe.webhookSecret
      );

      if (!isValidSignature) {
        logger.warn('Invalid Stripe webhook signature', {
          signature: sig,
          ip: req.ip,
        });
        return res.status(400).json({ error: 'Invalid signature' });
      }

      // Parse the webhook event
      let event;
      try {
        event = JSON.parse(payload);
      } catch (err) {
        logger.error('Error parsing webhook payload', {
          error: err.message,
        });
        return res.status(400).json({ error: 'Invalid payload' });
      }

      logger.info('Stripe webhook received', {
        eventType: event.type,
        eventId: event.id,
      });

      // Handle the webhook event
      await stripeService.handleWebhook(event);

      // Send appropriate response
      res.json({ received: true });
    } catch (error) {
      logger.error('Error processing Stripe webhook', {
        error: error.message,
        headers: req.headers,
      });

      res.status(500).json({ error: 'Webhook processing failed' });
    }
  }
);

// Test webhook endpoint (for development)
router.post('/test',
  sanitizeInput,
  async (req, res) => {
    try {
      const { eventType, eventData } = req.body;

      if (!eventType) {
        return res.status(400).json({
          error: 'Event type is required',
        });
      }

      // Create a mock event object
      const mockEvent = {
        id: `evt_${Date.now()}`,
        type: eventType,
        data: {
          object: eventData || {},
        },
        created: Math.floor(Date.now() / 1000),
      };

      logger.info('Test webhook received', {
        eventType,
        eventId: mockEvent.id,
      });

      // Handle the test event
      await stripeService.handleWebhook(mockEvent);

      res.json({
        success: true,
        message: 'Test webhook processed successfully',
        eventId: mockEvent.id,
      });
    } catch (error) {
      logger.error('Error processing test webhook', {
        error: error.message,
        body: req.body,
      });

      res.status(500).json({
        error: 'Test webhook processing failed',
      });
    }
  }
);

// Webhook health check
router.get('/health',
  (req, res) => {
    res.json({
      status: 'healthy',
      timestamp: new Date().toISOString(),
      service: 'webhook-handler',
      endpoints: {
        stripe: '/webhooks/stripe',
        test: '/webhooks/test',
      },
    });
  }
);

module.exports = router; 