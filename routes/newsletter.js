const express = require('express');
const fs = require('fs');
const path = require('path');
const router = express.Router();
const resendEmailService = require('../services/resendEmailService');

const SUBSCRIBERS_FILE = path.join(__dirname, '../newsletter-subscribers.json');

// Helper to read subscribers
function readSubscribers() {
  try {
    if (!fs.existsSync(SUBSCRIBERS_FILE)) return [];
    const data = fs.readFileSync(SUBSCRIBERS_FILE, 'utf-8');
    return JSON.parse(data);
  } catch {
    return [];
  }
}

// Helper to write subscribers
function writeSubscribers(subscribers) {
  fs.writeFileSync(SUBSCRIBERS_FILE, JSON.stringify(subscribers, null, 2));
}

// POST /api/newsletter/subscribe
router.post('/subscribe', async (req, res) => {
  const { email } = req.body;
  if (!email || !/^\S+@\S+\.\S+$/.test(email)) {
    return res.status(400).json({ success: false, error: 'Invalid email address.' });
  }
  
  try {
    let subscribers = readSubscribers();
    if (subscribers.includes(email)) {
      return res.status(409).json({ success: false, error: 'Email already subscribed.' });
    }
    
    subscribers.push(email);
    writeSubscribers(subscribers);

    // Send admin notification email (non-blocking)
    try {
      await resendEmailService.sendNewsletterNotification({
        email,
        submittedAt: new Date().toISOString()
      });
      console.log('Newsletter subscription notification sent successfully');
    } catch (emailError) {
      console.error('Failed to send newsletter notification email:', emailError);
      // Don't fail the subscription if email fails - just log it
    }

    res.json({ success: true, message: 'Subscribed successfully!' });
  } catch (error) {
    console.error('Newsletter subscription error:', error);
    res.status(500).json({ success: false, error: 'Failed to process subscription. Please try again.' });
  }
});

// GET /api/newsletter/subscribers
router.get('/subscribers', (req, res) => {
  try {
    const subscribers = readSubscribers();
    res.json({ subscribers });
  } catch (err) {
    res.status(500).json({ error: 'Failed to read subscribers' });
  }
});

module.exports = router; 