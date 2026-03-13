/* ══════════════════════════════════════════════════════════
   LinkVault — Application Logic
   ══════════════════════════════════════════════════════════ */

const API_BASE = window.location.origin + '/api';

// ── State ────────────────────────────────────────────────
let currentUser = null;
let authToken = localStorage.getItem('lv_token') || null;
let authMode = 'login'; // 'login' | 'signup'
let templates = [];
let verifyInterval = null;

// ── Init ─────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {
    initLoadingScreen();
    initNavbar();
    initCounters();
    loadTemplates();

    if (authToken) {
        fetchCurrentUser();
    } else {
        renderNavActions();
    }
});

// ── Loading Screen ───────────────────────────────────────
function initLoadingScreen() {
    setTimeout(() => {
        const screen = document.getElementById('loading-screen');
        screen.classList.add('fade-out');
        setTimeout(() => screen.remove(), 600);
    }, 1800);
}

// ── Navbar Scroll Effect ─────────────────────────────────
function initNavbar() {
    const navbar = document.getElementById('navbar');
    window.addEventListener('scroll', () => {
        navbar.classList.toggle('scrolled', window.scrollY > 40);
    });
}

// ── Counter Animation ────────────────────────────────────
function initCounters() {
    const counters = document.querySelectorAll('.stat-number[data-count]');
    const observer = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
            if (entry.isIntersecting) {
                animateCounter(entry.target);
                observer.unobserve(entry.target);
            }
        });
    }, { threshold: 0.5 });
    counters.forEach(c => observer.observe(c));
}

function animateCounter(el) {
    const target = parseInt(el.dataset.count);
    const duration = 1500;
    const start = performance.now();

    function tick(now) {
        const elapsed = now - start;
        const progress = Math.min(elapsed / duration, 1);
        const eased = 1 - Math.pow(1 - progress, 3);
        el.textContent = Math.floor(target * eased);
        if (progress < 1) requestAnimationFrame(tick);
    }
    requestAnimationFrame(tick);
}

// ── API Helpers ──────────────────────────────────────────
async function apiFetch(endpoint, options = {}) {
    const headers = {
        'Content-Type': 'application/json',
        ...(authToken && { Authorization: `Bearer ${authToken}` }),
        ...options.headers,
    };

    const res = await fetch(`${API_BASE}${endpoint}`, { ...options, headers });
    const data = await res.json();

    if (!res.ok) {
        throw { status: res.status, ...data };
    }

    return data;
}

// ── Auth ─────────────────────────────────────────────────
function renderNavActions() {
    const container = document.getElementById('nav-actions');

    if (currentUser) {
        const initial = currentUser.email.charAt(0).toUpperCase();
        container.innerHTML = `
      <div class="user-menu">
        <span class="user-email">${currentUser.email}</span>
        <div class="user-avatar">${initial}</div>
        <button class="btn btn-glass btn-sm" onclick="handleLogout()">Logout</button>
      </div>
    `;
    } else {
        container.innerHTML = `
      <button class="btn btn-glass btn-sm" onclick="showAuthModal('login')">Sign In</button>
      <button class="btn btn-primary btn-sm" onclick="showAuthModal('signup')">Sign Up</button>
    `;
    }
}

function showAuthModal(mode) {
    authMode = mode;
    const modal = document.getElementById('auth-modal');
    const title = document.getElementById('auth-title');
    const subtitle = document.getElementById('auth-subtitle');
    const btnText = document.getElementById('auth-btn-text');
    const toggleText = document.getElementById('auth-toggle-text');
    const errorEl = document.getElementById('auth-error');

    errorEl.classList.add('hidden');

    if (mode === 'login') {
        title.textContent = 'Welcome Back';
        subtitle.textContent = 'Sign in to your account';
        btnText.textContent = 'Sign In';
        toggleText.innerHTML = `Don't have an account? <a href="#" onclick="toggleAuthMode(event)">Sign Up</a>`;
    } else {
        title.textContent = 'Create Account';
        subtitle.textContent = 'Join LinkVault to unlock content';
        btnText.textContent = 'Create Account';
        toggleText.innerHTML = `Already have an account? <a href="#" onclick="toggleAuthMode(event)">Sign In</a>`;
    }

    modal.classList.remove('hidden');
}

function toggleAuthMode(e) {
    e.preventDefault();
    showAuthModal(authMode === 'login' ? 'signup' : 'login');
}

async function handleAuth(e) {
    e.preventDefault();

    const email = document.getElementById('auth-email').value;
    const password = document.getElementById('auth-password').value;
    const errorEl = document.getElementById('auth-error');
    const btn = document.getElementById('auth-submit-btn');
    const btnText = document.getElementById('auth-btn-text');
    const spinner = document.getElementById('auth-spinner');

    errorEl.classList.add('hidden');
    btn.disabled = true;
    btnText.style.opacity = '0';
    spinner.classList.remove('hidden');

    try {
        const endpoint = authMode === 'login' ? '/login' : '/signup';
        const data = await apiFetch(endpoint, {
            method: 'POST',
            body: JSON.stringify({ email, password }),
        });

        authToken = data.data.token;
        currentUser = data.data.user;
        localStorage.setItem('lv_token', authToken);

        closeModal('auth-modal');
        renderNavActions();
        loadTemplates(); // Refresh to show unlock buttons
        showToast(`Welcome${authMode === 'login' ? ' back' : ''}, ${currentUser.email}!`, 'success');
    } catch (err) {
        errorEl.textContent = err.message || 'Authentication failed. Please try again.';
        errorEl.classList.remove('hidden');
    } finally {
        btn.disabled = false;
        btnText.style.opacity = '1';
        spinner.classList.add('hidden');
    }
}

async function fetchCurrentUser() {
    try {
        const data = await apiFetch('/user');
        currentUser = data.data.user;
        renderNavActions();
    } catch (err) {
        // Token expired or invalid
        authToken = null;
        currentUser = null;
        localStorage.removeItem('lv_token');
        renderNavActions();
    }
}

function handleLogout() {
    authToken = null;
    currentUser = null;
    localStorage.removeItem('lv_token');
    renderNavActions();
    loadTemplates();
    showToast('Logged out successfully', 'info');
}

// ── Templates ────────────────────────────────────────────
async function loadTemplates() {
    const grid = document.getElementById('templates-grid');

    try {
        const data = await apiFetch('/templates');
        templates = data.data.templates;

        if (templates.length === 0) {
            grid.innerHTML = `
        <div class="templates-loading">
          <p>No templates available yet. Run <code>npm run db:seed</code> to add samples.</p>
        </div>
      `;
            return;
        }

        grid.innerHTML = templates.map(t => `
      <div class="template-card" id="template-${t.id}">
        <div class="template-image">
          <img src="${t.image}" alt="${t.title}" loading="lazy" 
               onerror="this.src='data:image/svg+xml,%3Csvg xmlns=%22http://www.w3.org/2000/svg%22 width=%22400%22 height=%22200%22 fill=%22%2316161f%22%3E%3Crect width=%22400%22 height=%22200%22/%3E%3Ctext x=%2250%25%22 y=%2250%25%22 dominant-baseline=%22middle%22 text-anchor=%22middle%22 fill=%22%235e5e72%22 font-size=%2218%22 font-family=%22Inter%22%3E${encodeURIComponent(t.title)}%3C/text%3E%3C/svg%3E'">
        </div>
        <div class="template-body">
          <h3 class="template-title">${escapeHtml(t.title)}</h3>
          <p class="template-desc">${escapeHtml(t.description)}</p>
          <div class="template-footer">
            <div class="template-price">
              <span class="price-value">$${parseFloat(t.price).toFixed(2)}</span>
              <span class="price-currency">USD</span>
            </div>
            <button class="btn btn-primary btn-sm" onclick="handleUnlockClick(${t.id})">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 9.9-1"/></svg>
              Unlock
            </button>
          </div>
        </div>
      </div>
    `).join('');
    } catch (err) {
        grid.innerHTML = `
      <div class="templates-loading">
        <p style="color: var(--error)">Failed to load templates. Is the server running?</p>
        <button class="btn btn-glass btn-sm" onclick="loadTemplates()" style="margin-top: 12px">Retry</button>
      </div>
    `;
    }
}

// ── Unlock Flow ──────────────────────────────────────────
function handleUnlockClick(templateId) {
    if (!currentUser) {
        showAuthModal('login');
        showToast('Please sign in to unlock content', 'info');
        return;
    }
    startPayment(templateId);
}

async function startPayment(templateId) {
    const template = templates.find(t => t.id === templateId);
    if (!template) return;

    const modal = document.getElementById('payment-modal');
    const content = document.getElementById('payment-content');

    content.innerHTML = `
    <div class="payment-header">
      <h2>💳 Complete Payment</h2>
      <p>Scan the QR code with your Bakong app</p>
    </div>
    <div class="payment-template-info">
      <img src="${template.image}" alt="${escapeHtml(template.title)}" 
           onerror="this.style.display='none'">
      <div class="info-text">
        <h4>${escapeHtml(template.title)}</h4>
        <p>Digital Content Unlock</p>
      </div>
    </div>
    <div style="text-align: center; padding: 20px 0;">
      <div class="spinner"></div>
      <p style="color: var(--text-muted); margin-top: 12px; font-size: 14px;">Generating KHQR code...</p>
    </div>
  `;

    modal.classList.remove('hidden');

    try {
        const data = await apiFetch('/create-payment', {
            method: 'POST',
            body: JSON.stringify({ template_id: templateId }),
        });

        const payment = data.data;

        content.innerHTML = `
      <div class="payment-header">
        <h2>💳 Scan & Pay</h2>
        <p>Scan with your Bakong-enabled banking app</p>
      </div>
      <div class="payment-template-info">
        <img src="${template.image}" alt="${escapeHtml(template.title)}" 
             onerror="this.style.display='none'">
        <div class="info-text">
          <h4>${escapeHtml(template.title)}</h4>
          <p>Digital Content Unlock</p>
        </div>
      </div>
      <div class="qr-section">
        <div class="qr-code-box" id="qr-code-container">
          <canvas id="qr-canvas"></canvas>
        </div>
        <div class="payment-amount">$${parseFloat(payment.amount).toFixed(2)}</div>
        <div class="payment-amount-label">Amount to pay (USD)</div>
      </div>
      <div class="payment-txn">
        TXN: ${payment.transaction_id}
      </div>
      <div class="payment-status checking" id="payment-status">
        <div class="spinner" style="width: 20px; height: 20px; margin: 0 auto 8px;"></div>
        <p>Waiting for payment...</p>
      </div>
      <button class="btn btn-primary btn-full" onclick="checkPaymentStatus('${payment.transaction_id}', ${templateId})" style="margin-top: 16px;" id="verify-btn">
        Verify Payment
      </button>
    `;

        // Generate QR code
        generateQRCode(payment.qr_data);

        // Auto-poll payment status
        startPaymentPolling(payment.transaction_id, templateId);
    } catch (err) {
        if (err.message && err.message.includes('already completed')) {
            closeModal('payment-modal');
            unlockTemplate(templateId);
            return;
        }
        content.innerHTML = `
      <div style="text-align: center; padding: 40px 0;">
        <p style="color: var(--error); font-size: 16px; margin-bottom: 12px;">⚠️ ${err.message || 'Failed to create payment'}</p>
        <button class="btn btn-glass btn-sm" onclick="closeModal('payment-modal')">Close</button>
      </div>
    `;
    }
}

function generateQRCode(data) {
    const canvas = document.getElementById('qr-canvas');
    if (!canvas) return;

    // Simple QR-like visual (uses a grid pattern based on data hash)
    const ctx = canvas.getContext('2d');
    const size = 200;
    const modules = 25;
    const moduleSize = size / modules;

    canvas.width = size;
    canvas.height = size;

    ctx.fillStyle = '#FFFFFF';
    ctx.fillRect(0, 0, size, size);

    // Generate deterministic pattern from QR data
    let hash = 0;
    for (let i = 0; i < data.length; i++) {
        hash = ((hash << 5) - hash + data.charCodeAt(i)) | 0;
    }

    ctx.fillStyle = '#000000';

    // Draw finder patterns (top-left, top-right, bottom-left)
    drawFinderPattern(ctx, 0, 0, moduleSize);
    drawFinderPattern(ctx, (modules - 7) * moduleSize, 0, moduleSize);
    drawFinderPattern(ctx, 0, (modules - 7) * moduleSize, moduleSize);

    // Draw data modules
    const rng = seedRandom(Math.abs(hash));
    for (let y = 0; y < modules; y++) {
        for (let x = 0; x < modules; x++) {
            // Skip finder areas
            if ((x < 8 && y < 8) || (x >= modules - 8 && y < 8) || (x < 8 && y >= modules - 8)) continue;

            if (rng() > 0.55) {
                ctx.fillRect(x * moduleSize, y * moduleSize, moduleSize, moduleSize);
            }
        }
    }
}

function drawFinderPattern(ctx, x, y, s) {
    // Outer
    ctx.fillStyle = '#000';
    ctx.fillRect(x, y, 7 * s, 7 * s);
    // White ring
    ctx.fillStyle = '#FFF';
    ctx.fillRect(x + s, y + s, 5 * s, 5 * s);
    // Inner
    ctx.fillStyle = '#000';
    ctx.fillRect(x + 2 * s, y + 2 * s, 3 * s, 3 * s);
}

function seedRandom(seed) {
    return function () {
        seed = (seed * 16807) % 2147483647;
        return (seed - 1) / 2147483646;
    };
}

// ── Payment Verification ─────────────────────────────────
function startPaymentPolling(transactionId, templateId) {
    if (verifyInterval) clearInterval(verifyInterval);

    let attempts = 0;
    const maxAttempts = 60; // 5 minutes (every 5 sec)

    verifyInterval = setInterval(async () => {
        attempts++;
        if (attempts > maxAttempts) {
            clearInterval(verifyInterval);
            const status = document.getElementById('payment-status');
            if (status) {
                status.className = 'payment-status failed';
                status.innerHTML = '<p>⏰ Payment verification timed out. Try clicking Verify Payment.</p>';
            }
            return;
        }

        await checkPaymentStatus(transactionId, templateId, true);
    }, 5000);
}

async function checkPaymentStatus(transactionId, templateId, silent = false) {
    const statusEl = document.getElementById('payment-status');
    const verifyBtn = document.getElementById('verify-btn');

    if (!silent && verifyBtn) {
        verifyBtn.disabled = true;
        verifyBtn.innerHTML = '<div class="btn-spinner"></div> Verifying...';
    }

    try {
        const data = await apiFetch('/verify-payment', {
            method: 'POST',
            body: JSON.stringify({ transaction_id: transactionId }),
        });

        if (data.status === 'success') {
            if (verifyInterval) clearInterval(verifyInterval);

            if (statusEl) {
                statusEl.className = 'payment-status success';
                statusEl.innerHTML = '<p>✅ Payment confirmed!</p>';
            }

            showToast('Payment successful! Unlocking content...', 'success');

            setTimeout(() => {
                closeModal('payment-modal');
                unlockTemplate(templateId);
            }, 1500);
        } else if (!silent) {
            if (statusEl) {
                statusEl.className = 'payment-status checking';
                statusEl.innerHTML = `
          <div class="spinner" style="width: 20px; height: 20px; margin: 0 auto 8px;"></div>
          <p>Payment not yet received. Please complete the payment.</p>
        `;
            }
        }
    } catch (err) {
        if (!silent) {
            showToast(err.message || 'Verification failed', 'error');
        }
    } finally {
        if (!silent && verifyBtn) {
            verifyBtn.disabled = false;
            verifyBtn.innerHTML = 'Verify Payment';
        }
    }
}

// ── Unlock Template ──────────────────────────────────────
async function unlockTemplate(templateId) {
    const modal = document.getElementById('unlock-modal');
    const content = document.getElementById('unlock-content');

    content.innerHTML = `
    <div style="text-align: center; padding: 40px 0;">
      <div class="spinner"></div>
      <p style="color: var(--text-muted); margin-top: 12px;">Unlocking content...</p>
    </div>
  `;
    modal.classList.remove('hidden');

    try {
        const data = await apiFetch('/unlock', {
            method: 'POST',
            body: JSON.stringify({ template_id: templateId }),
        });

        const { unlock_url, unlock_password } = data.data;

        content.innerHTML = `
      <div class="unlock-success">
        <div class="unlock-success-icon">
          <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2.5">
            <polyline points="20 6 9 17 4 12"/>
          </svg>
        </div>
        <h2>Content Unlocked! 🎉</h2>
        <p>Your premium content is ready to access</p>
        <div class="unlock-data">
          <div class="unlock-field">
            <label>Download URL</label>
            <div class="unlock-field-value">
              <span id="unlock-url-text">${escapeHtml(unlock_url)}</span>
              <button class="copy-btn" onclick="copyToClipboard('${escapeHtml(unlock_url)}', this)" title="Copy">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>
              </button>
            </div>
          </div>
          <div class="unlock-field">
            <label>Access Password</label>
            <div class="unlock-field-value">
              <span id="unlock-pass-text">${escapeHtml(unlock_password)}</span>
              <button class="copy-btn" onclick="copyToClipboard('${escapeHtml(unlock_password)}', this)" title="Copy">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>
              </button>
            </div>
          </div>
        </div>
        <a href="${escapeHtml(unlock_url)}" target="_blank" class="btn btn-success btn-full">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/><polyline points="15 3 21 3 21 9"/><line x1="10" y1="14" x2="21" y2="3"/></svg>
          Open Download Link
        </a>
      </div>
    `;
    } catch (err) {
        if (err.status === 402) {
            closeModal('unlock-modal');
            startPayment(templateId);
            return;
        }
        content.innerHTML = `
      <div style="text-align: center; padding: 40px 0;">
        <p style="color: var(--error); margin-bottom: 16px;">⚠️ ${err.message || 'Failed to unlock'}</p>
        <button class="btn btn-glass btn-sm" onclick="closeModal('unlock-modal')">Close</button>
      </div>
    `;
    }
}

// ── Utility ──────────────────────────────────────────────
function closeModal(id) {
    const modal = document.getElementById(id);
    modal.classList.add('hidden');
    if (id === 'payment-modal' && verifyInterval) {
        clearInterval(verifyInterval);
    }
}

function scrollToTemplates() {
    document.getElementById('templates').scrollIntoView({ behavior: 'smooth' });
}

function showToast(message, type = 'info') {
    const container = document.getElementById('toast-container');
    const toast = document.createElement('div');
    toast.className = `toast ${type}`;

    const icons = {
        success: '✅',
        error: '❌',
        info: 'ℹ️',
    };

    toast.innerHTML = `<span>${icons[type] || ''}</span><span>${message}</span>`;
    container.appendChild(toast);

    setTimeout(() => {
        toast.classList.add('removing');
        setTimeout(() => toast.remove(), 300);
    }, 4000);
}

function copyToClipboard(text, btn) {
    navigator.clipboard.writeText(text).then(() => {
        const original = btn.innerHTML;
        btn.innerHTML = '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--success)" stroke-width="2"><polyline points="20 6 9 17 4 12"/></svg>';
        setTimeout(() => btn.innerHTML = original, 1500);
        showToast('Copied to clipboard!', 'success');
    });
}

function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

// Close modals on overlay click
document.addEventListener('click', (e) => {
    if (e.target.classList.contains('modal-overlay')) {
        e.target.classList.add('hidden');
        if (verifyInterval) clearInterval(verifyInterval);
    }
});

// Keyboard shortcut: Escape to close modals
document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
        document.querySelectorAll('.modal-overlay:not(.hidden)').forEach(m => {
            m.classList.add('hidden');
        });
        if (verifyInterval) clearInterval(verifyInterval);
    }
});
