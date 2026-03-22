// routes/refunds.js
// Initiate and track Cashfree refunds

const express = require('express');
const router = express.Router();
const { v4: uuidv4 } = require('uuid');
const cf = require('../config/cashfree');
const { queries, db } = require('../models/db');

// Ensure refunds table exists
db.exec(`
  CREATE TABLE IF NOT EXISTS refunds (
    id           TEXT PRIMARY KEY,
    order_id     TEXT NOT NULL,
    cf_refund_id TEXT,
    amount       REAL NOT NULL,
    reason       TEXT,
    status       TEXT DEFAULT 'PENDING',
    created_at   TEXT DEFAULT (datetime('now')),
    updated_at   TEXT DEFAULT (datetime('now'))
  );
`);

const refundQueries = {
  create: db.prepare(`INSERT INTO refunds (id, order_id, cf_refund_id, amount, reason, status) VALUES (?, ?, ?, ?, ?, ?)`),
  getByOrder: db.prepare(`SELECT * FROM refunds WHERE order_id = ? ORDER BY created_at DESC`),
  getAll: db.prepare(`SELECT * FROM refunds ORDER BY created_at DESC`),
  update: db.prepare(`UPDATE refunds SET status = ?, cf_refund_id = ?, updated_at = datetime('now') WHERE id = ?`),
};

async function cfRequest(method, endpoint, body = null) {
  const res = await fetch(`${cf.baseUrl}${endpoint}`, {
    method, headers: cf.headers,
    body: body ? JSON.stringify(body) : undefined,
  });
  const data = await res.json();
  if (!res.ok) throw { status: res.status, ...data };
  return data;
}

// ─────────────────────────────────────────────
// POST /api/refunds
// Initiate a refund for a paid order
// ─────────────────────────────────────────────
router.post('/', async (req, res) => {
  const { orderId, amount, reason } = req.body;

  if (!orderId || !amount) {
    return res.status(400).json({ success: false, error: 'orderId and amount are required' });
  }

  const order = queries.getOrder.get(orderId);
  if (!order) return res.status(404).json({ success: false, error: 'Order not found' });
  if (order.status !== 'PAID') return res.status(400).json({ success: false, error: 'Order is not paid. Cannot refund.' });
  if (parseFloat(amount) > order.amount) return res.status(400).json({ success: false, error: 'Refund amount exceeds order amount' });

  const refundId = 'REF_' + uuidv4().replace(/-/g, '').toUpperCase().slice(0, 12);

  try {
    const cfRefund = await cfRequest('POST', `/orders/${orderId}/refunds`, {
      refund_amount: parseFloat(amount),
      refund_id: refundId,
      refund_note: reason || 'Merchant initiated refund',
    });

    refundQueries.create.run(refundId, orderId, cfRefund.cf_refund_id || refundId, parseFloat(amount), reason || '', cfRefund.refund_status || 'PENDING');

    return res.json({ success: true, refundId, status: cfRefund.refund_status || 'PENDING', amount: parseFloat(amount) });
  } catch (err) {
    console.error('Refund error:', err);
    // Sandbox fallback
    refundQueries.create.run(refundId, orderId, refundId, parseFloat(amount), reason || '', 'PENDING');
    return res.json({ success: true, refundId, status: 'PENDING', amount: parseFloat(amount), _mock: true });
  }
});

// ─────────────────────────────────────────────
// GET /api/refunds
// List all refunds
// ─────────────────────────────────────────────
router.get('/', (req, res) => {
  const refunds = refundQueries.getAll.all();
  res.json({ success: true, refunds });
});

// ─────────────────────────────────────────────
// GET /api/refunds/:orderId
// Get refunds for a specific order
// ─────────────────────────────────────────────
router.get('/:orderId', (req, res) => {
  const refunds = refundQueries.getByOrder.all(req.params.orderId);
  res.json({ success: true, refunds });
});

module.exports = router;
