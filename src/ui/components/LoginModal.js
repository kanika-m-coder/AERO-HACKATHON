import { el, $ } from '../../core/util.js';
import { auth } from '../../core/auth.js';

let overlayEl = null;

export function buildLoginOverlay(onSuccess) {
  if (overlayEl) overlayEl.remove();

  overlayEl = el('div', 'login-overlay');
  const card = el('div', 'login-card');

  card.innerHTML = `
    <div class="login-header">
      <img src="./assets/logo.jpg" alt="AeroTwin AI Logo" class="login-brand-logo" onerror="this.style.display='none'">
      <div class="login-title">AeroTwin AI</div>
      <div class="login-sub">SECURE AGENT & TELEMETRY ACCESS</div>
    </div>
    <form class="login-form" id="loginForm">
      <div class="login-field">
        <label for="loginUser">USERNAME OR EMAIL</label>
        <input type="text" id="loginUser" class="login-input" placeholder="e.g. admin or engineer" required autocomplete="username">
      </div>
      <div class="login-field">
        <label for="loginPass">PASSWORD</label>
        <input type="password" id="loginPass" class="login-input" placeholder="••••••••" required autocomplete="current-password">
      </div>
      <div id="loginErr" class="login-err" style="display:none"></div>
      <button type="submit" class="login-btn">Authenticate & Launch Session</button>
    </form>
    <div class="login-demos">
      <p>PROTOTYPE DEMO CREDENTIALS:</p>
      <div class="demo-btn-group">
        <button type="button" class="demo-btn" id="demoFleet">
          <strong>Fleet Manager</strong>
          admin / admin123
        </button>
        <button type="button" class="demo-btn" id="demoEng">
          <strong>Maintenance Engineer</strong>
          engineer / engineer123
        </button>
      </div>
    </div>
    <div style="margin-top:16px;text-align:center">
      <span class="security-badge-pill">
        <span class="dot-active"></span>
        SECURE SESSION • JWT • RBAC
      </span>
    </div>
  `;

  overlayEl.appendChild(card);
  document.body.appendChild(overlayEl);

  const form = card.querySelector('#loginForm');
  const userInput = card.querySelector('#loginUser');
  const passInput = card.querySelector('#loginPass');
  const errDiv = card.querySelector('#loginErr');

  const handleLogin = (u, p) => {
    errDiv.style.display = 'none';
    const res = auth.login(u, p);
    if (res.success) {
      hideLoginOverlay();
      if (onSuccess) onSuccess(res.user);
    } else {
      errDiv.textContent = res.message || 'Invalid username or password';
      errDiv.style.display = 'block';
    }
  };

  form.onsubmit = (e) => {
    e.preventDefault();
    handleLogin(userInput.value, passInput.value);
  };

  card.querySelector('#demoFleet').onclick = () => {
    userInput.value = 'admin';
    passInput.value = 'admin123';
    handleLogin('admin', 'admin123');
  };

  card.querySelector('#demoEng').onclick = () => {
    userInput.value = 'engineer';
    passInput.value = 'engineer123';
    handleLogin('engineer', 'engineer123');
  };

  return overlayEl;
}

export function hideLoginOverlay() {
  if (overlayEl) {
    overlayEl.remove();
    overlayEl = null;
  }
}
