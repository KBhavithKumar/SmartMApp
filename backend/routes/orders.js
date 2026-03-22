// routes/orders.js
// Order management: list, detail, stats, export CSV

const express = require('express');
const router = express.Router();
const { queries } = require('../models/db');

// ─────────────────────────────────────────────
// GET /api/orders
// List all orders with optional status filter
// ─────────────────────────────────────────────
router.get('/', (req, res) => {
  const orders = queries.getAllOrders.all();
  res.json({ success: true, orders });
});

// ─────────────────────────────────────────────
// GET /api/orders/stats
// Summary statistics
// ─────────────────────────────────────────────
router.get('/stats', (req, res) => {
  const stats = queries.getStats.get();
  res.json({ success: true, stats });
});

// ─────────────────────────────────────────────
// GET /api/orders/export/csv
// Download all orders as CSV
// ─────────────────────────────────────────────
router.get('/export/csv', (req, res) => {
  const orders = queries.getAllOrders.all();

  const headers = [
    'Order ID', 'Customer Name', 'Email', 'Phone',
    'Amount (INR)', 'Description', 'Status',
    'Payment Method', 'CF Payment ID',
    'Created At', 'Paid At'
  ];

  const rows = orders.map(o => [
    o.id, o.customer_name, o.customer_email, o.customer_phone,
    o.amount, o.description, o.status,
    o.payment_method || '', o.cf_payment_id || '',
    o.created_at, o.paid_at || ''
  ]);

  const escape = v => `"${String(v ?? '').replace(/"/g, '""')}"`;
  const csv = [headers, ...rows].map(row => row.map(escape).join(',')).join('\n');

  res.setHeader('Content-Type', 'text/csv');
  res.setHeader('Content-Disposition', `attachment; filename="smartpay-orders-${Date.now()}.csv"`);
  res.send(csv);
});

// ─────────────────────────────────────────────
// GET /api/orders/:id
// Single order detail
// ─────────────────────────────────────────────
router.get('/:id', (req, res) => {
  const order = queries.getOrder.get(req.params.id);
  if (!order) return res.status(404).json({ success: false, error: 'Order not found' });
  res.json({ success: true, order });
});

module.exports = router;
