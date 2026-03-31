// routes/auth.js
// Merchant authentication with database-backed sessions

const express = require('express');
const router = express.Router();
const crypto = require('crypto');
const { db } = require('../models/db');

const sessionQueries = {
  create: db.prepare(`
    INSERT INTO sessions (token, username, expires_at)
    VALUES (?, ?, ?)
  `),
  get: db.prepare(`SELECT token, username, expires_at FROM sessions WHERE token = ?`),
  delete: db.prepare(`DELETE FROM sessions WHERE token = ?`),
  deleteExpired: db.prepare(`DELETE FROM sessions WHERE expires_at < ?`),
};

const MERCHANT_USERNAME = process.env.MERCHANT_USERNAME || 'admin';
const MERCHANT_PASSWORD = process.env.MERCHANT_PASSWORD || 'smartpay123';

function generateToken() {
  return crypto.randomBytes(32).toString('hex');
}

function safeEquals(a, b) {
  const aBuffer = Buffer.from(a || '', 'utf8');
  const bBuffer = Buffer.from(b || '', 'utf8');
  if (aBuffer.length !== bBuffer.length) return false;
  return crypto.timingSafeEqual(aBuffer, bBuffer);
}

function cleanupExpiredSessions() {
  sessionQueries.deleteExpired.run(Date.now());
}

router.post('/login', (req, res) => {
  cleanupExpiredSessions();

  const { username, password } = req.body;
  if (!username || !password) {
    return res.status(400).json({ success: false, error: 'Username and password required' });
  }

  const isUserValid = safeEquals(username, MERCHANT_USERNAME);
  const isPasswordValid = safeEquals(password, MERCHANT_PASSWORD);

  if (!isUserValid || !isPasswordValid) {
    return res.status(401).json({ success: false, error: 'Invalid credentials' });
  }

  const token = generateToken();
  const expiresAt = Date.now() + 24 * 60 * 60 * 1000;

  sessionQueries.create.run(token, username, expiresAt);
  return res.json({ success: true, token, expiresAt, username });
});

router.post('/logout', (req, res) => {
  const token = req.headers.authorization?.replace('Bearer ', '');
  if (token) sessionQueries.delete.run(token);
  return res.json({ success: true });
});

router.get('/me', (req, res) => {
  cleanupExpiredSessions();
  const token = req.headers.authorization?.replace('Bearer ', '');
  if (!token) return res.status(401).json({ success: false, error: 'Not authenticated' });

  const session = sessionQueries.get.get(token);
  if (!session) {
    return res.status(401).json({ success: false, error: 'Not authenticated' });
  }

  return res.json({ success: true, username: session.username });
});

function requireAuth(req, res, next) {
  if (process.env.NODE_ENV === 'development' && process.env.SKIP_AUTH === 'true') {
    return next();
  }

  cleanupExpiredSessions();

  const token = req.headers.authorization?.replace('Bearer ', '');
  if (!token) return res.status(401).json({ success: false, error: 'Authentication required' });

  const session = sessionQueries.get.get(token);
  if (!session) {
    return res.status(401).json({ success: false, error: 'Session expired. Please login again.' });
  }

  req.merchant = { username: session.username };
  next();
}

module.exports = { router, requireAuth };
