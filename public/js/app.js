const contentEl = document.getElementById('content');
const config = window.__APP_CONFIG__ || {};
const emailJsConfig = config.emailJs || {};
let emailJsInitialized = false;
const state = {
  accessToken: null,
  refreshToken: null,
  user: null,
  documents: [],
  denied: [],
  auditLogs: [],
  roleRequests: [],
};

const loadRecaptcha = () => {
  if (!config.recaptchaSiteKey) {
    return Promise.resolve();
  }
  return new Promise((resolve) => {
    const script = document.getElementById('recaptcha-script');
    script.src = `https://www.google.com/recaptcha/api.js?render=${config.recaptchaSiteKey}`;
    script.onload = resolve;
    script.onerror = resolve;
  });
};

const executeCaptcha = (action) =>
  new Promise((resolve) => {
    if (!config.recaptchaSiteKey || !window.grecaptcha) {
      resolve('dev');
      return;
    }
    window.grecaptcha.ready(() => {
      window.grecaptcha
        .execute(config.recaptchaSiteKey, { action })
        .then((token) => resolve(token))
        .catch(() => resolve(''));
    });
  });

const render = (html) => {
  contentEl.innerHTML = html;
};

const authFetch = async (url, options = {}) => {
  const headers = options.headers ? { ...options.headers } : {};
  if (state.accessToken) {
    headers.Authorization = `Bearer ${state.accessToken}`;
  }
  const response = await fetch(url, { ...options, headers });
  if (response.status === 401 && state.refreshToken) {
    const refreshRes = await fetch('/api/auth/refresh', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ refreshToken: state.refreshToken }),
    });
    if (refreshRes.ok) {
      const tokens = await refreshRes.json();
      state.accessToken = tokens.accessToken;
      state.refreshToken = tokens.refreshToken;
      headers.Authorization = `Bearer ${state.accessToken}`;
      return fetch(url, { ...options, headers });
    }
  }
  return response;
};

const initEmailJs = () => {
  if (emailJsInitialized) {
    return;
  }
  if (!window.emailjs) {
    console.warn('EmailJS browser SDK is not loaded.');
    return;
  }
  const { publicKey } = emailJsConfig;
  if (!publicKey) {
    console.warn('EmailJS public key missing in config.');
    return;
  }
  try {
    window.emailjs.init({ publicKey });
    emailJsInitialized = true;
  } catch (error) {
    console.error('Failed to initialize EmailJS', error);
  }
};

const generateVerificationToken = () => {
  if (!window.crypto || !window.crypto.getRandomValues) {
    throw new Error('Secure crypto is unavailable in this browser.');
  }
  const bytes = new Uint8Array(32);
  window.crypto.getRandomValues(bytes);
  return Array.from(bytes, (byte) => byte.toString(16).padStart(2, '0')).join('');
};

const ensureEmailJsReady = () => {
  if (!emailJsInitialized && window.emailjs) {
    initEmailJs();
  }
  return emailJsInitialized;
};

const sendVerificationEmail = async ({ email, username, verifyUrl }) => {
  if (!ensureEmailJsReady()) {
    throw new Error('Email service is unavailable. Try again later.');
  }
  const { serviceId, templateId } = emailJsConfig;
  if (!serviceId || !templateId) {
    throw new Error('Email service is misconfigured.');
  }
  try {
    await window.emailjs.send(serviceId, templateId, {
      email,
      username,
      verifyUrl,
      subject: 'Verify your email',
      message: `Click here to verify your email: ${verifyUrl}. Link expires in 1 hour.`,
    });
  } catch (error) {
    if (error && error.text) {
      throw new Error(error.text);
    }
    throw new Error('Unable to send verification email.');
  }
};

const registerUser = async (event) => {
  event.preventDefault();
  const formData = new FormData(event.target);
  const formPayload = Object.fromEntries(formData.entries());
  const submitButton = event.target.querySelector('button[type="submit"]');
  const statusEl = document.getElementById('register-status');

  if (submitButton) {
    submitButton.disabled = true;
  }
  statusEl.textContent = 'Sending verification email...';
  statusEl.className = '';

  const verificationToken = generateVerificationToken();
  const baseUrl = config.appUrl || window.location.origin;
  const verifyUrl = `${baseUrl}/verify.html?token=${verificationToken}`;

  try {
    await sendVerificationEmail({ email: formPayload.email, username: formPayload.username, verifyUrl });
  } catch (error) {
    statusEl.textContent = error.message || 'Unable to send verification email.';
    statusEl.className = 'error';
    if (submitButton) {
      submitButton.disabled = false;
    }
    return;
  }

  statusEl.textContent = 'Email sent. Creating account...';

  const registrationPayload = {
    ...formPayload,
    captchaToken: await executeCaptcha('register'),
    verificationToken,
  };

  if (!registrationPayload.verificationToken) {
    statusEl.textContent = 'Unable to generate verification token. Please refresh and try again.';
    statusEl.className = 'error';
    if (submitButton) {
      submitButton.disabled = false;
    }
    return;
  }

  const res = await fetch('/api/auth/register', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(registrationPayload),
  });

  if (res.status === 400) {
    console.warn('Registration payload rejected', registrationPayload ? Object.keys(registrationPayload) : null);
  }

  const data = await res.json();
  statusEl.textContent = res.ok ? data.message : data.error;
  statusEl.className = res.ok ? 'success' : 'error';
  if (submitButton) {
    submitButton.disabled = false;
  }
};

const loginUser = async (event) => {
  event.preventDefault();
  const formData = new FormData(event.target);
  const payload = Object.fromEntries(formData.entries());

  const res = await fetch('/api/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  const data = await res.json();
  const statusEl = document.getElementById('login-status');
  if (!res.ok) {
    statusEl.textContent = data.error || 'Unable to login';
    statusEl.className = 'error';
    return;
  }

  state.accessToken = data.accessToken;
  state.refreshToken = data.refreshToken;
  statusEl.textContent = 'Login successful';
  statusEl.className = 'success';
  await loadDashboard();
};

const loadDashboard = async () => {
  const profileRes = await authFetch('/api/auth/me');
  if (!profileRes.ok) {
    renderAuth();
    return;
  }
  state.user = await profileRes.json();

  const docsRes = await authFetch('/api/documents');
  if (docsRes.ok) {
    const payload = await docsRes.json();
    state.documents = payload.documents || [];
    state.denied = payload.denied || [];
  }

  const auditRes = await authFetch('/api/audit');
  if (auditRes.ok) {
    const payload = await auditRes.json();
    state.auditLogs = payload.logs || [];
  } else {
    state.auditLogs = [];
  }

  const requestsRes = await authFetch('/api/users/role-requests');
  if (requestsRes.ok) {
    const payload = await requestsRes.json();
    state.roleRequests = payload.requests || [];
  } else {
    state.roleRequests = [];
  }

  renderDashboard();
};

const renderAuth = () => {
  render(`
    <section class="grid two-columns">
      <div class="card">
        <h2>Create Account</h2>
        <form id="register-form">
          <label>Username<input name="username" required /></label>
          <label>Email<input name="email" type="email" required /></label>
          <label>Password<input name="password" type="password" required /></label>
          <label title="Leave blank unless you have an admin invite code">
            Admin Access Code
            <input name="adminAccessCode" type="password" autocomplete="off" />
          </label>
          <button class="primary" type="submit">Register</button>
          <p id="register-status"></p>
        </form>
      </div>
      <div class="card">
        <h2>Login</h2>
        <form id="login-form">
          <label>Email<input name="email" type="email" required /></label>
          <label>Password<input name="password" type="password" required /></label>
          <label>OTP (if MFA enabled)<input name="otp" /></label>
          <button class="primary" type="submit">Login</button>
          <p id="login-status"></p>
        </form>
      </div>
    </section>
  `);

  document.getElementById('register-form').addEventListener('submit', registerUser);
  document.getElementById('login-form').addEventListener('submit', loginUser);
};

const renderDashboard = () => {
  const roles = (state.user.roles || []).join(', ');
  render(`
    <section class="grid two-columns">
      <div class="card">
        <h2>Welcome, ${state.user.username}</h2>
        <p><strong>Email:</strong> ${state.user.email}</p>
        <p><strong>Security Level:</strong> ${state.user.security_level}</p>
        <p><strong>Roles:</strong> ${roles || 'None'}</p>
        <button id="logout-btn">Logout</button>
      </div>
      <div class="card">
        <h2>Documents (${state.documents.length})</h2>
        <ul class="documents">
          ${
            state.documents.length
              ? state.documents.map((doc) => `<li><strong>${doc.name}</strong> (${doc.classification})</li>`).join('')
              : '<li>No accessible documents</li>'
          }
        </ul>
        ${
          state.denied.length
            ? `<details><summary>Denied (${state.denied.length})</summary><ul>${state.denied
                .map((doc) => `<li>${doc.name}: ${doc.reasons.join(', ')}</li>`)
                .join('')}</ul></details>`
            : ''
        }
      </div>
      <div class="card">
        <h2>Profile</h2>
        <form id="profile-form">
          <label>Username<input name="username" value="${state.user.username}" /></label>
          <label>Phone<input name="phone_number" value="${state.user.phone_number || ''}" /></label>
          <button class="primary" type="submit">Update Profile</button>
          <p id="profile-status"></p>
        </form>
        <form id="password-form">
          <label>Current Password<input type="password" name="currentPassword" required /></label>
          <label>New Password<input type="password" name="newPassword" required /></label>
          <button type="submit">Change Password</button>
          <p id="password-status"></p>
        </form>
      </div>
      <div class="card">
        <h2>Role Request</h2>
        <form id="role-request-form">
          <label>Role<input name="role" required /></label>
          <label>Justification<textarea name="justification" required></textarea></label>
          <button type="submit">Submit Request</button>
          <p id="role-status"></p>
        </form>
        <h3>MFA</h3>
        <button id="mfa-setup-btn">Generate Secret</button>
        <div id="mfa-setup"></div>
        <form id="mfa-enable-form">
          <label>OTP<input name="token" required /></label>
          <button type="submit">Enable MFA</button>
          <p id="mfa-status"></p>
        </form>
      </div>
      ${
        state.auditLogs.length
          ? `<div class="card"><h2>Recent Audit Logs</h2><ul class="audit">${state.auditLogs
              .map((log) => `<li><strong>${log.action}</strong> (${log.severity})</li>`)
              .join('')}</ul></div>`
          : ''
      }
      ${
        state.roleRequests.length
          ? `<div class="card"><h2>Role Requests</h2><ul>${state.roleRequests
              .map((req) => `<li>#${req.id} ${req.requested_role} - ${req.status}</li>`)
              .join('')}</ul></div>`
          : ''
      }
    </section>
  `);

  document.getElementById('logout-btn').onclick = async () => {
    await fetch('/api/auth/logout', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ refreshToken: state.refreshToken }),
    });
    state.accessToken = null;
    state.refreshToken = null;
    state.user = null;
    renderAuth();
  };

  document.getElementById('profile-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const formData = new FormData(e.target);
    const res = await authFetch('/api/auth/profile', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(Object.fromEntries(formData.entries())),
    });
    const statusEl = document.getElementById('profile-status');
    statusEl.textContent = res.ok ? 'Profile updated' : 'Unable to update';
    statusEl.className = res.ok ? 'success' : 'error';
  });

  document.getElementById('password-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const formData = new FormData(e.target);
    const res = await authFetch('/api/auth/password/change', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(Object.fromEntries(formData.entries())),
    });
    const statusEl = document.getElementById('password-status');
    statusEl.textContent = res.ok ? 'Password updated' : 'Unable to update password';
    statusEl.className = res.ok ? 'success' : 'error';
  });

  document.getElementById('role-request-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const formData = new FormData(e.target);
    const res = await authFetch('/api/auth/role-request', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(Object.fromEntries(formData.entries())),
    });
    const statusEl = document.getElementById('role-status');
    statusEl.textContent = res.ok ? 'Request submitted' : 'Unable to submit';
    statusEl.className = res.ok ? 'success' : 'error';
  });

  document.getElementById('mfa-setup-btn').onclick = async () => {
    const res = await authFetch('/api/auth/mfa/setup', { method: 'POST' });
    const payload = await res.json();
    const el = document.getElementById('mfa-setup');
    el.textContent = res.ok ? `Secret: ${payload.secret}` : (payload.error || 'Unable to generate');
  };

  document.getElementById('mfa-enable-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const formData = new FormData(e.target);
    const res = await authFetch('/api/auth/mfa/enable', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(Object.fromEntries(formData.entries())),
    });
    const statusEl = document.getElementById('mfa-status');
    statusEl.textContent = res.ok ? 'MFA enabled' : 'Unable to enable';
    statusEl.className = res.ok ? 'success' : 'error';
  });
};

const init = async () => {
  await loadRecaptcha();
  initEmailJs();
  renderAuth();
};

init();

