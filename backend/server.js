// server.js - SmartPay Main Server
require('dotenv').config();

const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const path = require('path');

const { logger, apiLimiter } = require('./middleware/security');
const paymentRoutes = require('./routes/payments');
const orderRoutes = require('./routes/orders');
const webhookRoutes = require('./routes/webhook');
const refundRoutes = require('./routes/refunds');
const { router: authRouter, requireAuth } = require('./routes/auth');

const app = express();

app.use(helmet({ contentSecurityPolicy: false, crossOriginEmbedderPolicy: false }));

const allowedOrigins = [
  process.env.FRONTEND_URL,
  'http://localhost:3000',
  'http://localhost:5000',
  'http://localhost:5500',
  'http://127.0.0.1:5500',
].filter(Boolean);

app.use(cors({
  origin: (origin, callback) => {
    if (!origin || process.env.NODE_ENV === 'development' || allowedOrigins.includes(origin)) {
      callback(null, true);
    } else {
      callback(new Error('Not allowed by CORS'));
    }
  },
  methods: ['GET', 'POST', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
  credentials: true,
}));

// Webhook first (raw body needed)
app.use('/api/webhook', webhookRoutes);

app.use(express.json({ limit: '10kb' }));
app.use(express.urlencoded({ extended: true }));
app.use(logger);

// Serve frontend
app.use(express.static(path.join(__dirname, '../frontend')));

// Health
app.get('/', (req, res) => res.json({ status: 'ok', app: 'SmartPay API', version: '2.0.0', environment: process.env.NODE_ENV || 'development', cashfree: process.env.CASHFREE_ENV || 'SANDBOX' }));
app.get('/health', (req, res) => res.json({ status: 'ok' }));

// Public routes
app.use('/api/auth', apiLimiter, authRouter);
app.use('/api/payments', apiLimiter, paymentRoutes);

// Protected routes
app.use('/api/orders', apiLimiter, requireAuth, orderRoutes);
app.use('/api/refunds', apiLimiter, requireAuth, refundRoutes);

// 404
app.use('/api/*', (req, res) => res.status(404).json({ success: false, error: `Route ${req.path} not found` }));

// Error handler
app.use((err, req, res, next) => {
  console.error('Error:', err.message);
  res.status(500).json({ success: false, error: 'Internal server error' });
});

const PORT = process.env.PORT || 5000;
app.listen(PORT, '0.0.0.0', () => {
  console.log(`SmartPay v2.0 running on port ${PORT} | ${process.env.CASHFREE_ENV || 'SANDBOX'} mode`);
});
