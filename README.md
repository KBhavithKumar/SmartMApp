# SmartPay — Cashfree Payment Gateway

Complete payment gateway with merchant dashboard and customer checkout.

---

## 📁 Project Structure

```
smartpay/
├── render.yaml                  ← Render deployment config
├── .gitignore
│
├── backend/                     ← Node.js API Server
│   ├── server.js                ← Main entry point
│   ├── package.json
│   ├── .env.example             ← Copy to .env and fill values
│   ├── config/
│   │   └── cashfree.js          ← Cashfree API config
│   ├── routes/
│   │   ├── payments.js          ← Create order, verify, status
│   │   ├── orders.js            ← List, stats, export CSV
│   │   └── webhook.js           ← Cashfree webhook handler
│   ├── middleware/
│   │   └── security.js          ← Rate limiting, logger
│   └── models/
│       └── db.js                ← SQLite database
│
└── frontend/                    ← Static HTML/JS/CSS
    ├── assets/
    │   ├── style.css            ← Shared styles
    │   └── config.js            ← API URL + utilities
    ├── merchant/
    │   └── index.html           ← Merchant dashboard
    └── customer/
        └── pay.html             ← Customer payment page
```

---

## 🔌 API Routes

### Payments
| Method | Route | Description |
|--------|-------|-------------|
| POST | `/api/payments/create-order` | Create Cashfree order, returns payment_session_id |
| POST | `/api/payments/verify` | Verify payment after redirect |
| GET | `/api/payments/status/:orderId` | Get order status |
| PATCH | `/api/payments/:orderId/status` | Sandbox: manually set status |

### Orders
| Method | Route | Description |
|--------|-------|-------------|
| GET | `/api/orders` | List all orders |
| GET | `/api/orders/stats` | Stats (total, paid, pending, failed) |
| GET | `/api/orders/:id` | Single order detail |
| GET | `/api/orders/export/csv` | Download CSV |

### Webhooks
| Method | Route | Description |
|--------|-------|-------------|
| POST | `/api/webhook/cashfree` | Receive Cashfree payment events |

---

## ⚙️ Configuration

### Step 1 — Get Cashfree Credentials
1. Sign up at https://merchant.cashfree.com
2. Go to **Developers → API Keys**
3. Copy **App ID** and **Secret Key** (use Sandbox tab for testing)

### Step 2 — Set Environment Variables on Render

| Variable | Value | Description |
|----------|-------|-------------|
| `CASHFREE_APP_ID` | `TEST12345...` | From Cashfree dashboard |
| `CASHFREE_SECRET_KEY` | `TESTsecret...` | From Cashfree dashboard |
| `CASHFREE_ENV` | `SANDBOX` | Change to `PRODUCTION` when live |
| `CASHFREE_WEBHOOK_SECRET` | `your_secret` | Set in Cashfree → Webhooks |
| `FRONTEND_URL` | `https://smartmapp-frontend.onrender.com` | Your frontend URL |
| `PAYMENT_SUCCESS_URL` | `https://smartmapp-frontend.onrender.com/customer/pay.html` | After payment redirect |
| `MERCHANT_NAME` | `Your Business Name` | Shown on payment page |

### Step 3 — Set Webhook URL in Cashfree
1. Cashfree Dashboard → **Developers → Webhooks**
2. Add URL: `https://smartmapp.onrender.com/api/webhook/cashfree`
3. Select events: `PAYMENT_SUCCESS`, `PAYMENT_FAILED`, `PAYMENT_USER_DROPPED`
4. Copy the webhook secret → add to `CASHFREE_WEBHOOK_SECRET` env var

---

## 🚀 Deploy to Render

### Backend
- **Root Directory**: `backend`
- **Build Command**: `npm install`
- **Start Command**: `node server.js`

### Frontend (Static Site)
- **Root Directory**: `frontend`
- **Publish Directory**: `.` (dot)

---

## 💻 Local Development

```bash
cd backend
cp .env.example .env
# Fill in your Cashfree sandbox credentials in .env

npm install
npm run dev
# API: http://localhost:5000

# Open frontend directly in browser:
# frontend/merchant/index.html  → Merchant dashboard
# frontend/customer/pay.html    → Customer payment page
```

---

## 💳 Payment Flow

```
1. Merchant opens dashboard → New Payment
2. Enters customer details + amount
3. Backend creates Cashfree order → gets payment_session_id
4. Cashfree JS SDK opens checkout modal/redirect
5. Customer completes payment (UPI/Card/Netbanking)
6. Cashfree redirects back with order_status
7. Backend verifies payment via API
8. Webhook fires → updates DB in real time
9. Dashboard shows PAID status
```

---

## 🔒 Going Live (Production)

1. Change `CASHFREE_ENV` → `PRODUCTION`
2. Use production App ID and Secret Key
3. In `frontend/customer/pay.html` line with `load({ mode: 'sandbox' })` → change to `load({ mode: 'production' })`
4. Update all URLs from sandbox to production
