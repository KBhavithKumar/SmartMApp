// assets/config.js - Shared frontend configuration

const CONFIG = {
  API_URL: window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1'
    ? 'http://localhost:5000/api'
    : 'https://smartmapp.onrender.com/api',

  MERCHANT_NAME: 'SmartPay',
  CURRENCY: 'INR',
};

const Auth = {
  getToken: () => localStorage.getItem('sp_token'),
  getUser: () => localStorage.getItem('sp_user'),
  isLoggedIn: () => !!localStorage.getItem('sp_token'),
  logout: async () => {
    try {
      await fetch(`${CONFIG.API_URL}/auth/logout`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${Auth.getToken()}` },
      });
    } catch (e) {}
    localStorage.removeItem('sp_token');
    localStorage.removeItem('sp_user');
    window.location.href = './login.html';
  },
  requireAuth: () => {
    if (!Auth.isLoggedIn()) {
      window.location.href = './login.html';
      return false;
    }
    return true;
  },
};

const Utils = {
  fmt: (amount) => new Intl.NumberFormat('en-IN', {
    style: 'currency', currency: 'INR', maximumFractionDigits: 0
  }).format(amount),

  timeAgo: (iso) => {
    if (!iso) return '—';
    const diff = Date.now() - new Date(iso);
    const m = Math.floor(diff / 60000);
    if (m < 1) return 'just now';
    if (m < 60) return `${m}m ago`;
    const h = Math.floor(m / 60);
    if (h < 24) return `${h}h ago`;
    return new Date(iso).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
  },

  showToast: (msg, type = 'success') => {
    document.querySelectorAll('.toast').forEach(t => t.remove());
    const t = document.createElement('div');
    t.className = `toast ${type === 'error' ? 'error' : ''}`;
    t.innerHTML = `<span>${type === 'success' ? '✓' : '⚠'}</span> ${msg}`;
    document.body.appendChild(t);
    setTimeout(() => t.remove(), 3500);
  },

  api: async (method, endpoint, body = null) => {
    const headers = { 'Content-Type': 'application/json' };
    const token = Auth.getToken();
    if (token) headers['Authorization'] = `Bearer ${token}`;

    const res = await fetch(`${CONFIG.API_URL}${endpoint}`, {
      method, headers,
      body: body ? JSON.stringify(body) : undefined,
    });

    if (res.status === 401) {
      localStorage.removeItem('sp_token');
      window.location.href = './login.html';
      throw new Error('Session expired');
    }

    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Request failed');
    return data;
  },

  badge: (status) => `<span class="badge badge-${status}">${status}</span>`,
};
