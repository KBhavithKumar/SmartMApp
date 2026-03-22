// middleware/security.js

const rateLimit = require('express-rate-limit');

// Rate limit for payment creation - prevent abuse
const paymentLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 20,
  message: { success: false, error: 'Too many payment requests. Please try again later.' },
  standardHeaders: true,
  legacyHeaders: false,
});

// General API rate limit
const apiLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 100,
  message: { success: false, error: 'Too many requests.' },
});

// Request logger
const logger = (req, res, next) => {
  console.log(`${new Date().toISOString()} ${req.method} ${req.path}`);
  next();
};

module.exports = { paymentLimiter, apiLimiter, logger };
