// config/cashfree.js
// Cashfree API configuration

const config = {
  appId: process.env.CASHFREE_APP_ID,
  secretKey: process.env.CASHFREE_SECRET_KEY,
  env: process.env.CASHFREE_ENV || 'SANDBOX',

  get baseUrl() {
    return this.env === 'PRODUCTION'
      ? 'https://api.cashfree.com/pg'
      : 'https://sandbox.cashfree.com/pg';
  },

  get headers() {
    return {
      'Content-Type': 'application/json',
      'x-client-id': this.appId,
      'x-client-secret': this.secretKey,
      'x-api-version': '2023-08-01',
    };
  },

  currency: process.env.CURRENCY || 'INR',
  merchantName: process.env.MERCHANT_NAME || 'SmartPay',
  successUrl: process.env.PAYMENT_SUCCESS_URL || 'http://localhost:3000/payment-status.html',
  failureUrl: process.env.PAYMENT_FAILURE_URL || 'http://localhost:3000/payment-status.html',
};

module.exports = config;
