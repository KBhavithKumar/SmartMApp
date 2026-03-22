// routes/auth.js
// Simple merchant authentication with token-based sessions

const express = require('express');
const router = express.Router();
const crypto = require('crypto');

// In-memory session store (replace with Redis/DB for production)
const sessions = new Map();

// ── Merchant credentials from env ──
// Set MERCHANT_USERNAME and MERCHANT_PASSWORD in your .env
const MERCHANT_USERNAME = process.env.MERCHANT_USERNAME || 'admin';
const MERCHANT_PASSWORD = process.env.MERCHANT_PASSWORD || 'smartpay123';

function generateToken() {
  return crypto.randomBytes(32).toString('hex');
}

// ─────────────────────────────────────────────
// POST /api/auth/login
// ─────────────────────────────────────────────
router.post('/login', (req, res) => {
  const { username, password } = req.body;

  if (!username || !password) {
    return res.status(400).json({ success: false, error: 'Username and password required' });
  }

  if (username !== MERCHANT_USERNAME || password !== MERCHANT_PASSWORD) {
    return res.status(401).json({ success: false, error: 'Invalid credentials' });
  }

  const token = generateToken();
  const expiresAt = Date.now() + 24 * 60 * 60 * 1000; // 24 hours
  sessions.set(token, { username, expiresAt });

  res.json({ success: true, token, expiresAt, username });
});

// ─────────────────────────────────────────────
// POST /api/auth/logout
// ─────────────────────────────────────────────
router.post('/logout', (req, res) => {
  const token = req.headers['authorization']?.replace('Bearer ', '');
  if (token) sessions.delete(token);
  res.json({ success: true });
});

// ─────────────────────────────────────────────
// GET /api/auth/me
// ─────────────────────────────────────────────
router.get('/me', (req, res) => {
  const token = req.headers['authorization']?.replace('Bearer ', '');
  const session = token && sessions.get(token);
  if (!session || session.expiresAt < Date.now()) {
    return res.status(401).json({ success: false, error: 'Not authenticated' });
  }
  res.json({ success: true, username: session.username });
});

// ── Auth middleware (export for use in other routes) ──
function requireAuth(req, res, next) {
  // Skip auth in development
  if (process.env.NODE_ENV === 'development' && process.env.SKIP_AUTH === 'true') {
    return next();
  }

  const token = req.headers['authorization']?.replace('Bearer ', '');
  if (!token) return res.status(401).json({ success: false, error: 'Authentication required' });

  const session = sessions.get(token);
  if (!session || session.expiresAt < Date.now()) {
    sessions.delete(token);
    return res.status(401).json({ success: false, error: 'Session expired. Please login again.' });
  }

  req.merchant = { username: session.username };
  next();
}

module.exports = { router, requireAuth };
