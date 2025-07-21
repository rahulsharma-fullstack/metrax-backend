const express = require('express');
const fs = require('fs');
const path = require('path');
const router = express.Router();

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
router.post('/subscribe', (req, res) => {
  const { email } = req.body;
  if (!email || !/^\S+@\S+\.\S+$/.test(email)) {
    return res.status(400).json({ success: false, error: 'Invalid email address.' });
  }
  let subscribers = readSubscribers();
  if (subscribers.includes(email)) {
    return res.status(409).json({ success: false, error: 'Email already subscribed.' });
  }
  subscribers.push(email);
  writeSubscribers(subscribers);
  res.json({ success: true, message: 'Subscribed successfully!' });
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