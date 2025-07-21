const stripe = require('stripe');
const config = require('../config/config');
const logger = require('../utils/logger');
const { validateEmail, validateAmount } = require('../utils/validation');

class StripeService {
  constructor() {
    this.stripe = stripe(config.stripe.secretKey);
  }

  // Create a payment intent
  async createPaymentIntent(donationData) {
    try {
      // Validate input data
      const validation = this.validateDonationData(donationData);
      if (!validation.isValid) {
        throw new Error(validation.errors.join(', '));
      }

      // Convert amount to cents
      const amountInCents = Math.round(donationData.amount * 100);

      // Create payment intent
      const paymentIntent = await this.stripe.paymentIntents.create({
        amount: amountInCents,
        currency: config.stripe.currency,
        payment_method_types: config.stripe.paymentMethods,
        metadata: {
          projectId: donationData.projectId,
          donorName: donationData.anonymous ? 'Anonymous' : donationData.donorName,
          donorEmail: donationData.donorEmail,
          message: donationData.message || '',
          anonymous: donationData.anonymous.toString(),
        },
        description: `Donation to ${donationData.projectTitle}`,
        receipt_email: donationData.donorEmail,
        // Remove automatic_payment_methods since we're using payment_method_types
      });

      logger.info('Payment intent created successfully', {
        paymentIntentId: paymentIntent.id,
        amount: amountInCents,
        projectId: donationData.projectId,
        donorEmail: donationData.donorEmail,
      });

      return {
        clientSecret: paymentIntent.client_secret,
        paymentIntentId: paymentIntent.id,
        amount: amountInCents,
      };
    } catch (error) {
      logger.error('Error creating payment intent', {
        error: error.message,
        donationData: {
          projectId: donationData.projectId,
          donorEmail: donationData.donorEmail,
          amount: donationData.amount,
        },
      });

      // Handle specific Stripe errors
      if (error.type === 'StripeCardError') {
        throw new Error(`Card error: ${error.message}`);
      } else if (error.type === 'StripeInvalidRequestError') {
        throw new Error('Invalid payment request');
      } else if (error.type === 'StripeAPIError') {
        throw new Error('Payment service temporarily unavailable');
      } else {
        throw new Error('Payment processing failed');
      }
    }
  }

  // Confirm a payment
  async confirmPayment(paymentIntentId, paymentMethodId) {
    try {
      const paymentIntent = await this.stripe.paymentIntents.confirm(
        paymentIntentId,
        {
          payment_method: paymentMethodId,
        }
      );

      logger.info('Payment confirmed successfully', {
        paymentIntentId,
        status: paymentIntent.status,
        amount: paymentIntent.amount,
      });

      return {
        success: true,
        paymentIntent,
        status: paymentIntent.status,
      };
    } catch (error) {
      logger.error('Error confirming payment', {
        error: error.message,
        paymentIntentId,
        paymentMethodId,
      });

      throw new Error(`Payment confirmation failed: ${error.message}`);
    }
  }

  // Retrieve a payment intent
  async getPaymentIntent(paymentIntentId) {
    try {
      const paymentIntent = await this.stripe.paymentIntents.retrieve(
        paymentIntentId
      );

      return paymentIntent;
    } catch (error) {
      logger.error('Error retrieving payment intent', {
        error: error.message,
        paymentIntentId,
      });

      throw new Error('Payment not found');
    }
  }

  // Create a refund
  async createRefund(paymentIntentId, amount, reason = 'requested_by_customer') {
    try {
      const refund = await this.stripe.refunds.create({
        payment_intent: paymentIntentId,
        amount: amount ? Math.round(amount * 100) : undefined,
        reason,
      });

      logger.info('Refund created successfully', {
        refundId: refund.id,
        paymentIntentId,
        amount: refund.amount,
        reason,
      });

      return refund;
    } catch (error) {
      logger.error('Error creating refund', {
        error: error.message,
        paymentIntentId,
        amount,
        reason,
      });

      throw new Error(`Refund failed: ${error.message}`);
    }
  }

  // Validate donation data
  validateDonationData(donationData) {
    const errors = [];

    // Required fields
    if (!donationData.amount) {
      errors.push('Amount is required');
    } else if (!validateAmount(donationData.amount)) {
      errors.push(`Amount must be between $${config.validation.minDonationAmount} and $${config.validation.maxDonationAmount}`);
    }

    if (!donationData.projectId) {
      errors.push('Project ID is required');
    }

    if (!donationData.donorName && !donationData.anonymous) {
      errors.push('Donor name is required for non-anonymous donations');
    }

    if (!donationData.donorEmail) {
      errors.push('Donor email is required');
    } else if (!validateEmail(donationData.donorEmail)) {
      errors.push('Invalid email format');
    }

    if (donationData.donorName && donationData.donorName.length > config.validation.maxNameLength) {
      errors.push(`Donor name must be less than ${config.validation.maxNameLength} characters`);
    }

    if (donationData.donorEmail && donationData.donorEmail.length > config.validation.maxEmailLength) {
      errors.push(`Email must be less than ${config.validation.maxEmailLength} characters`);
    }

    if (donationData.message && donationData.message.length > config.validation.maxMessageLength) {
      errors.push(`Message must be less than ${config.validation.maxMessageLength} characters`);
    }

    return {
      isValid: errors.length === 0,
      errors,
    };
  }

  // Handle webhook events
  async handleWebhook(event) {
    try {
      switch (event.type) {
        case 'payment_intent.succeeded':
          await this.handlePaymentSucceeded(event.data.object);
          break;
        case 'payment_intent.payment_failed':
          await this.handlePaymentFailed(event.data.object);
          break;
        case 'charge.refunded':
          await this.handleRefund(event.data.object);
          break;
        default:
          logger.info(`Unhandled webhook event: ${event.type}`);
      }
    } catch (error) {
      logger.error('Error handling webhook event', {
        error: error.message,
        eventType: event.type,
        eventId: event.id,
      });
      throw error;
    }
  }

  // Handle successful payment
  async handlePaymentSucceeded(paymentIntent) {
    logger.info('Payment succeeded', {
      paymentIntentId: paymentIntent.id,
      amount: paymentIntent.amount,
      metadata: paymentIntent.metadata,
    });

    // Here you would typically:
    // 1. Update your database with the successful payment
    // 2. Send confirmation email
    // 3. Generate receipt
    // 4. Update project progress
    
    // For now, we'll just log the success
    return { success: true };
  }

  // Handle failed payment
  async handlePaymentFailed(paymentIntent) {
    logger.warn('Payment failed', {
      paymentIntentId: paymentIntent.id,
      lastPaymentError: paymentIntent.last_payment_error,
    });

    // Here you would typically:
    // 1. Update your database with the failed payment
    // 2. Send failure notification email
    // 3. Log the failure for follow-up

    return { success: false };
  }

  // Handle refund
  async handleRefund(charge) {
    logger.info('Refund processed', {
      chargeId: charge.id,
      refundId: charge.refunds?.data[0]?.id,
      amount: charge.amount_refunded,
    });

    // Here you would typically:
    // 1. Update your database with the refund
    // 2. Send refund confirmation email
    // 3. Update project progress (subtract refunded amount)

    return { success: true };
  }

  // Get payment methods for a customer
  async getPaymentMethods(customerId) {
    try {
      const paymentMethods = await this.stripe.paymentMethods.list({
        customer: customerId,
        type: 'card',
      });

      return paymentMethods.data;
    } catch (error) {
      logger.error('Error retrieving payment methods', {
        error: error.message,
        customerId,
      });

      throw new Error('Failed to retrieve payment methods');
    }
  }

  // Create a customer
  async createCustomer(email, name) {
    try {
      const customer = await this.stripe.customers.create({
        email,
        name,
      });

      logger.info('Customer created successfully', {
        customerId: customer.id,
        email,
      });

      return customer;
    } catch (error) {
      logger.error('Error creating customer', {
        error: error.message,
        email,
        name,
      });

      throw new Error('Failed to create customer');
    }
  }
}

module.exports = new StripeService(); 