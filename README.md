# Metrax Donation Backend API

A secure, scalable backend API for processing donations with Stripe integration, email notifications, and receipt generation.

## Features

- 🔒 **Secure Payment Processing** - Stripe integration with webhook verification
- 📧 **Email Notifications** - Automated confirmation and admin notifications
- 📄 **Receipt Generation** - PDF receipts with tax information
- 🛡️ **Security** - Rate limiting, input validation, CORS, and security headers
- 📊 **Logging** - Comprehensive logging with Winston
- 🔄 **Webhook Handling** - Real-time payment status updates
- 🧪 **Testing** - Built-in test endpoints for development

## Quick Start

### Prerequisites

- Node.js 18+ 
- npm or yarn
- Stripe account
- Email service (Gmail, SendGrid, etc.)

### Installation

1. **Clone and install dependencies:**
   ```bash
   cd backend
   npm install
   ```

2. **Set up environment variables:**
   ```bash
   cp env.example .env
   # Edit .env with your configuration
   ```

3. **Install additional dependencies:**
   ```bash
   npm install pdfkit
   ```

4. **Start the server:**
   ```bash
   # Development
   npm run dev
   
   # Production
   npm start
   ```

## Configuration

### Environment Variables

Create a `.env` file with the following variables:

```env
# Server Configuration
NODE_ENV=development
PORT=3001
FRONTEND_URL=http://localhost:5173

# Stripe Configuration
STRIPE_SECRET_KEY=sk_test_your_stripe_secret_key_here
STRIPE_WEBHOOK_SECRET=whsec_your_webhook_secret_here

# Email Configuration
EMAIL_HOST=smtp.gmail.com
EMAIL_PORT=587
EMAIL_USER=your_email@gmail.com
EMAIL_PASS=your_app_password_here
EMAIL_FROM=donations@yourdomain.com

# JWT Configuration
JWT_SECRET=your_jwt_secret_key_here
JWT_EXPIRES_IN=24h

# Rate Limiting
RATE_LIMIT_WINDOW_MS=900000
RATE_LIMIT_MAX_REQUESTS=100

# Security
BCRYPT_ROUNDS=12
SESSION_SECRET=your_session_secret_here

# Logging
LOG_LEVEL=info
LOG_FILE=logs/app.log

# File Upload
UPLOAD_PATH=./uploads
MAX_FILE_SIZE=5242880
```

### Stripe Setup

1. Create a Stripe account at [stripe.com](https://stripe.com)
2. Get your API keys from the Stripe Dashboard
3. Set up webhooks in the Stripe Dashboard:
   - URL: `https://yourdomain.com/api/webhooks/stripe`
   - Events: `payment_intent.succeeded`, `payment_intent.payment_failed`, `charge.refunded`
4. Copy the webhook secret to your `.env` file

### Email Setup

#### Gmail Example:
1. Enable 2-factor authentication
2. Generate an App Password
3. Use the App Password in your `.env` file

#### SendGrid Example:
```env
EMAIL_HOST=smtp.sendgrid.net
EMAIL_PORT=587
EMAIL_USER=apikey
EMAIL_PASS=your_sendgrid_api_key
```

## API Endpoints

### Donations

#### Create Payment Intent
```http
POST /api/donations/create-payment-intent
Content-Type: application/json

{
  "amount": 50.00,
  "projectId": "uuid-here",
  "donorName": "John Doe",
  "donorEmail": "john@example.com",
  "anonymous": false,
  "message": "Keep up the great work!",
  "projectTitle": "Community Center Project"
}
```

#### Confirm Payment
```http
POST /api/donations/confirm-payment
Content-Type: application/json

{
  "paymentIntentId": "pi_xxx",
  "paymentMethodId": "pm_xxx"
}
```

#### Get Payment Intent
```http
GET /api/donations/payment-intent/:id
```

#### Create Refund
```http
POST /api/donations/refund
Content-Type: application/json

{
  "paymentIntentId": "pi_xxx",
  "amount": 25.00,
  "reason": "requested_by_customer"
}
```

#### Get Receipt
```http
GET /api/donations/receipt/:paymentIntentId
```

#### Test Email
```http
POST /api/donations/test-email
Content-Type: application/json

{
  "email": "test@example.com"
}
```

### Webhooks

#### Stripe Webhook
```http
POST /api/webhooks/stripe
```

#### Test Webhook
```http
POST /api/webhooks/test
Content-Type: application/json

{
  "eventType": "payment_intent.succeeded",
  "eventData": {
    "id": "pi_test",
    "amount": 5000,
    "metadata": {
      "projectId": "test-project",
      "donorName": "Test Donor",
      "donorEmail": "test@example.com"
    }
  }
}
```

### Health Checks

```http
GET /api/health
GET /api/donations/health
GET /api/webhooks/health
```

## Security Features

### Rate Limiting
- General: 100 requests per 15 minutes
- Payment endpoints: 10 requests per 15 minutes
- Speed limiting: 500ms delay after 50 requests

### Input Validation
- All inputs are sanitized and validated
- Amount limits: $1.00 - $10,000.00
- Email format validation
- UUID validation for project IDs

### Security Headers
- Helmet.js for security headers
- CORS protection
- Content Security Policy
- XSS protection

### Webhook Security
- Stripe signature verification
- Timestamp validation
- Replay attack prevention

## Email Templates

The system includes several email templates:

- `donation-confirmation.hbs` - Donation confirmation with receipt
- `admin-notification.hbs` - Admin notification for new donations
- `refund-notification.hbs` - Refund confirmation
- `payment-failure.hbs` - Payment failure notification
- `monthly-summary.hbs` - Monthly donation summary
- `project-update.hbs` - Project update notifications

## Receipt Generation

Receipts are generated as PDF files with:

- Organization branding
- Donor information
- Project details
- Tax information
- Transaction details
- Download links

## Logging

Logs are written to:
- `logs/app.log` - All logs
- `logs/error.log` - Error logs only
- Console output in development

Log levels: `error`, `warn`, `info`, `debug`

## Development

### Running in Development Mode
```bash
npm run dev
```

### Testing Endpoints
```bash
# Test email service
curl -X POST http://localhost:3001/api/donations/test-email \
  -H "Content-Type: application/json" \
  -d '{"email": "test@example.com"}'

# Test webhook
curl -X POST http://localhost:3001/api/webhooks/test \
  -H "Content-Type: application/json" \
  -d '{"eventType": "payment_intent.succeeded"}'
```

### File Structure
```
backend/
├── config/
│   └── config.js          # Configuration management
├── middleware/
│   └── security.js        # Security middleware
├── routes/
│   ├── donations.js       # Donation API routes
│   └── webhooks.js        # Webhook handlers
├── services/
│   ├── stripeService.js   # Stripe integration
│   ├── emailService.js    # Email service
│   └── receiptService.js  # PDF generation
├── templates/
│   └── emails/            # Email templates
├── utils/
│   ├── logger.js          # Logging utility
│   └── validation.js      # Validation utilities
├── uploads/               # Generated receipts
├── logs/                  # Application logs
├── package.json
├── server.js              # Main server file
└── README.md
```

## Production Deployment

### Environment Setup
1. Set `NODE_ENV=production`
2. Use strong, unique secrets
3. Configure proper CORS origins
4. Set up SSL/TLS certificates
5. Configure reverse proxy (nginx)

### Security Checklist
- [ ] Change all default secrets
- [ ] Set up HTTPS
- [ ] Configure firewall rules
- [ ] Set up monitoring and alerting
- [ ] Regular security updates
- [ ] Database backups
- [ ] Log rotation

### Performance Optimization
- [ ] Enable compression
- [ ] Set up caching
- [ ] Use CDN for static files
- [ ] Database connection pooling
- [ ] Load balancing

## Troubleshooting

### Common Issues

1. **Email not sending**
   - Check SMTP credentials
   - Verify email service settings
   - Check firewall/network restrictions

2. **Stripe webhook failures**
   - Verify webhook secret
   - Check webhook URL accessibility
   - Review webhook event types

3. **Receipt generation errors**
   - Check file permissions
   - Verify upload directory exists
   - Ensure sufficient disk space

4. **Rate limiting issues**
   - Check client IP detection
   - Verify proxy configuration
   - Review rate limit settings

### Debug Mode
Set `LOG_LEVEL=debug` in your `.env` file for detailed logging.

## Support

For issues and questions:
1. Check the logs in `logs/` directory
2. Review the configuration
3. Test individual services
4. Check Stripe Dashboard for payment issues

## License

MIT License - see LICENSE file for details. 