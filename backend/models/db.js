// models/db.js
// SQLite database setup using better-sqlite3

const Database = require('better-sqlite3');
const path = require('path');
const fs = require('fs');

const DB_PATH = path.join(__dirname, '../data/smartpay.db');

// Ensure data directory exists
fs.mkdirSync(path.dirname(DB_PATH), { recursive: true });

const db = new Database(DB_PATH);

// Enable WAL mode for better performance
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

// ── Create Tables ──
db.exec(`
  CREATE TABLE IF NOT EXISTS orders (
    id          TEXT PRIMARY KEY,
    cf_order_id TEXT,
    cf_payment_session_id TEXT,
    customer_name  TEXT NOT NULL,
    customer_email TEXT NOT NULL,
    customer_phone TEXT NOT NULL,
    amount         REAL NOT NULL,
    currency       TEXT DEFAULT 'INR',
    description    TEXT,
    status         TEXT DEFAULT 'CREATED',
    payment_method TEXT,
    cf_payment_id  TEXT,
    error_reason   TEXT,
    created_at     TEXT DEFAULT (datetime('now')),
    updated_at     TEXT DEFAULT (datetime('now')),
    paid_at        TEXT
  );

  CREATE TABLE IF NOT EXISTS webhooks (
    id         INTEGER PRIMARY KEY AUTOINCREMENT,
    order_id   TEXT,
    event_type TEXT,
    payload    TEXT,
    received_at TEXT DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS sessions (
    token       TEXT PRIMARY KEY,
    username    TEXT NOT NULL,
    expires_at  INTEGER NOT NULL,
    created_at  TEXT DEFAULT (datetime('now'))
  );
`);

// ── Order Queries ──
const queries = {
  createOrder: db.prepare(`
    INSERT INTO orders (id, cf_order_id, cf_payment_session_id, customer_name, customer_email, customer_phone, amount, currency, description, status)
    VALUES (@id, @cf_order_id, @cf_payment_session_id, @customer_name, @customer_email, @customer_phone, @amount, @currency, @description, @status)
  `),

  getOrder: db.prepare(`SELECT * FROM orders WHERE id = ?`),

  getOrderByCfId: db.prepare(`SELECT * FROM orders WHERE cf_order_id = ?`),

  getAllOrders: db.prepare(`SELECT * FROM orders ORDER BY created_at DESC`),

  updateOrderStatus: db.prepare(`
    UPDATE orders SET status = @status, payment_method = @payment_method, cf_payment_id = @cf_payment_id,
    error_reason = @error_reason, paid_at = @paid_at, updated_at = datetime('now')
    WHERE id = @id
  `),

  getStats: db.prepare(`
    SELECT
      COUNT(*) as total,
      SUM(CASE WHEN status = 'PAID' THEN 1 ELSE 0 END) as paid,
      SUM(CASE WHEN status = 'CREATED' OR status = 'ACTIVE' THEN 1 ELSE 0 END) as pending,
      SUM(CASE WHEN status = 'FAILED' OR status = 'EXPIRED' THEN 1 ELSE 0 END) as failed,
      SUM(CASE WHEN status = 'PAID' THEN amount ELSE 0 END) as total_amount
    FROM orders
  `),

  logWebhook: db.prepare(`
    INSERT INTO webhooks (order_id, event_type, payload) VALUES (?, ?, ?)
  `),
};

module.exports = { db, queries };
