// routes/webhook.js
// Cashfree webhook handler - receives real-time payment status updates

const express = require('express');
const router = express.Router();
const crypto = require('crypto');
const { queries } = require('../models/db');

// ─────────────────────────────────────────────
// POST /api/webhook/cashfree
// Cashfree sends payment events here
// Configure in: Cashfree Dashboard → Developers → Webhooks
// ─────────────────────────────────────────────
router.post('/cashfree', express.raw({ type: 'application/json' }), (req, res) => {
  const rawBody = req.body.toString();
  const signature = req.headers['x-webhook-signature'];
  const timestamp = req.headers['x-webhook-timestamp'];
  const webhookSecret = process.env.CASHFREE_WEBHOOK_SECRET;

  // ── Verify Signature ──
  if (webhookSecret && signature && timestamp) {
    try {
      const signedPayload = timestamp + rawBody;
      const expectedSignature = crypto
        .createHmac('sha256', webhookSecret)
        .update(signedPayload)
        .digest('base64');

      if (signature !== expectedSignature) {
        console.warn('Webhook signature mismatch');
        return res.status(401).json({ error: 'Invalid signature' });
      }
    } catch (e) {
      console.error('Signature verification error:', e);
    }
  }

  let event;
  try {
    event = JSON.parse(rawBody);
  } catch (e) {
    return res.status(400).json({ error: 'Invalid JSON' });
  }

  const { type, data } = event;
  console.log(`Webhook received: ${type}`);

  // Log webhook
  try {
    queries.logWebhook.run(
      data?.order?.order_id || 'unknown',
      type,
      rawBody
    );
  } catch (e) {}

  // ── Handle Payment Events ──
  if (type === 'PAYMENT_SUCCESS_WEBHOOK') {
    const orderId = data?.order?.order_id;
    if (orderId) {
      queries.updateOrderStatus.run({
        id: orderId,
        status: 'PAID',
        payment_method: data?.payment?.payment_group || 'UNKNOWN',
        cf_payment_id: String(data?.payment?.cf_payment_id || ''),
        error_reason: null,
        paid_at: new Date().toISOString(),
      });
      console.log(`✅ Payment SUCCESS for order: ${orderId}`);
    }
  }

  else if (type === 'PAYMENT_FAILED_WEBHOOK') {
    const orderId = data?.order?.order_id;
    if (orderId) {
      queries.updateOrderStatus.run({
        id: orderId,
        status: 'FAILED',
        payment_method: data?.payment?.payment_group || null,
        cf_payment_id: String(data?.payment?.cf_payment_id || ''),
        error_reason: data?.payment?.payment_message || 'Payment failed',
        paid_at: null,
      });
      console.log(`❌ Payment FAILED for order: ${orderId}`);
    }
  }

  else if (type === 'PAYMENT_USER_DROPPED_WEBHOOK') {
    const orderId = data?.order?.order_id;
    if (orderId) {
      queries.updateOrderStatus.run({
        id: orderId,
        status: 'DROPPED',
        payment_method: null,
        cf_payment_id: null,
        error_reason: 'User dropped from payment',
        paid_at: null,
      });
    }
  }

  // Always respond 200 quickly
  res.json({ received: true });
});

module.exports = router;
