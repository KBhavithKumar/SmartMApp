// routes/payments.js
// Core payment routes: create order, verify, status

const express = require('express');
const router = express.Router();
const { v4: uuidv4 } = require('uuid');
const cf = require('../config/cashfree');
const { queries } = require('../models/db');

// ── Helper: Call Cashfree API ──
async function cfRequest(method, endpoint, body = null) {
  const res = await fetch(`${cf.baseUrl}${endpoint}`, {
    method,
    headers: cf.headers,
    body: body ? JSON.stringify(body) : undefined,
  });
  const data = await res.json();
  if (!res.ok) throw { status: res.status, ...data };
  return data;
}

// ─────────────────────────────────────────────
// POST /api/payments/create-order
// Creates a Cashfree order & returns payment_session_id
// ─────────────────────────────────────────────
router.post('/create-order', async (req, res) => {
  const { customerName, customerEmail, customerPhone, amount, description } = req.body;

  // Validate
  if (!customerName || !customerEmail || !customerPhone || !amount) {
    return res.status(400).json({
      success: false,
      error: 'customerName, customerEmail, customerPhone, and amount are required',
    });
  }

  if (isNaN(amount) || parseFloat(amount) < 1) {
    return res.status(400).json({ success: false, error: 'Amount must be at least ₹1' });
  }

  const orderId = 'ORD_' + uuidv4().replace(/-/g, '').toUpperCase().slice(0, 14);

  try {
    // Create order on Cashfree
    const cfOrder = await cfRequest('POST', '/orders', {
      order_id: orderId,
      order_amount: parseFloat(amount),
      order_currency: cf.currency,
      order_note: description || 'Payment',
      customer_details: {
        customer_id: 'CUST_' + Date.now(),
        customer_name: customerName,
        customer_email: customerEmail,
        customer_phone: customerPhone,
      },
      order_meta: {
        return_url: `${cf.successUrl}?order_id={order_id}&order_token={order_token}`,
        notify_url: process.env.WEBHOOK_URL || '',
      },
    });

    // Save to DB
    queries.createOrder.run({
      id: orderId,
      cf_order_id: cfOrder.cf_order_id || orderId,
      cf_payment_session_id: cfOrder.payment_session_id,
      customer_name: customerName,
      customer_email: customerEmail,
      customer_phone: customerPhone,
      amount: parseFloat(amount),
      currency: cf.currency,
      description: description || 'Payment',
      status: 'CREATED',
    });

    return res.json({
      success: true,
      orderId,
      paymentSessionId: cfOrder.payment_session_id,
      cfOrderId: cfOrder.cf_order_id,
      amount: parseFloat(amount),
      customerName,
    });

  } catch (err) {
    console.error('Create order error:', err);

    // Fallback for sandbox without credentials
    queries.createOrder.run({
      id: orderId,
      cf_order_id: orderId,
      cf_payment_session_id: 'mock_session_' + orderId,
      customer_name: customerName,
      customer_email: customerEmail,
      customer_phone: customerPhone,
      amount: parseFloat(amount),
      currency: cf.currency,
      description: description || 'Payment',
      status: 'CREATED',
    });

    return res.json({
      success: true,
      orderId,
      paymentSessionId: 'mock_session_' + orderId,
      cfOrderId: orderId,
      amount: parseFloat(amount),
      customerName,
      _mock: true,
    });
  }
});

// ─────────────────────────────────────────────
// POST /api/payments/verify
// Verify payment status after redirect
// ─────────────────────────────────────────────
router.post('/verify', async (req, res) => {
  const { orderId } = req.body;
  if (!orderId) return res.status(400).json({ success: false, error: 'orderId required' });

  const order = queries.getOrder.get(orderId);
  if (!order) return res.status(404).json({ success: false, error: 'Order not found' });

  try {
    // Fetch order status from Cashfree
    const cfData = await cfRequest('GET', `/orders/${orderId}`);

    let status = 'PENDING';
    let paymentId = null;
    let paymentMethod = null;
    let errorReason = null;

    if (cfData.order_status === 'PAID') {
      status = 'PAID';
      // Fetch payment details
      try {
        const payments = await cfRequest('GET', `/orders/${orderId}/payments`);
        if (payments && payments.length > 0) {
          const p = payments[0];
          paymentId = p.cf_payment_id;
          paymentMethod = p.payment_group || p.payment_method?.type || 'UNKNOWN';
        }
      } catch (e) {}
    } else if (cfData.order_status === 'EXPIRED') {
      status = 'EXPIRED';
    } else if (cfData.order_status === 'ACTIVE') {
      status = 'ACTIVE';
    }

    // Update DB
    queries.updateOrderStatus.run({
      id: orderId,
      status,
      payment_method: paymentMethod,
      cf_payment_id: paymentId,
      error_reason: errorReason,
      paid_at: status === 'PAID' ? new Date().toISOString() : null,
    });

    return res.json({ success: true, status, orderId, paymentId, paymentMethod });

  } catch (err) {
    console.error('Verify error:', err);
    return res.json({ success: true, status: order.status, orderId });
  }
});

// ─────────────────────────────────────────────
// GET /api/payments/status/:orderId
// Get order status
// ─────────────────────────────────────────────
router.get('/status/:orderId', (req, res) => {
  const order = queries.getOrder.get(req.params.orderId);
  if (!order) return res.status(404).json({ success: false, error: 'Order not found' });
  res.json({ success: true, order });
});

// ─────────────────────────────────────────────
// PATCH /api/payments/:orderId/status  (sandbox testing)
// ─────────────────────────────────────────────
router.patch('/:orderId/status', (req, res) => {
  const { status } = req.body;
  const order = queries.getOrder.get(req.params.orderId);
  if (!order) return res.status(404).json({ success: false, error: 'Order not found' });

  queries.updateOrderStatus.run({
    id: req.params.orderId,
    status: status || 'PAID',
    payment_method: 'SANDBOX',
    cf_payment_id: 'mock_' + Date.now(),
    error_reason: null,
    paid_at: status === 'PAID' ? new Date().toISOString() : null,
  });

  res.json({ success: true, order: queries.getOrder.get(req.params.orderId) });
});

module.exports = router;
