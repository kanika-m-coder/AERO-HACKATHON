import { el, $ } from '../../core/util.js';
import { auth } from '../../core/auth.js';

let overlayEl = null;
let currentTab = 'signin'; // 'signin' or 'register'

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
    
    <div class="login-tabs" style="display:flex;margin-bottom:18px;border-bottom:1px solid var(--rule-soft)">
      <button type="button" class="login-tab-btn active" id="tabSignin" style="flex:1;padding:8px;background:none;border:0;border-bottom:2px solid var(--caution);color:var(--ink);font-weight:600;font-size:13px;cursor:pointer">Sign In</button>
      <button type="button" class="login-tab-btn" id="tabRegister" style="flex:1;padding:8px;background:none;border:0;border-bottom:2px solid transparent;color:var(--ink-3);font-size:13px;cursor:pointer">Create Account</button>
    </div>

    <!-- Sign In Form -->
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
      <div style="text-align:center;margin-top:10px">
        <a href="#" id="linkToRegister" style="font-size:12px;color:var(--info);text-decoration:none">Don't have an account? Create Account</a>
      </div>
    </form>

    <!-- Register Form -->
    <form class="login-form" id="registerForm" style="display:none">
      <div class="login-field">
        <label for="regName">FULL NAME</label>
        <input type="text" id="regName" class="login-input" placeholder="e.g. Sarah Connor" required autocomplete="name">
      </div>
      <div class="login-field">
        <label for="regUser">USERNAME OR EMAIL</label>
        <input type="text" id="regUser" class="login-input" placeholder="e.g. sarah.connor" required autocomplete="username">
      </div>
      <div class="login-field">
        <label for="regPass">PASSWORD</label>
        <input type="password" id="regPass" class="login-input" placeholder="••••••••" required autocomplete="new-password">
      </div>
      <div class="login-field">
        <label for="regRole">SECURITY ROLE</label>
        <select id="regRole" class="login-input" style="cursor:pointer">
          <option value="Fleet Manager">Fleet Manager (Fleet Status, Health & Reports)</option>
          <option value="Maintenance Engineer">Maintenance Engineer (Full Diagnostics & Twin Simulation)</option>
        </select>
      </div>
      <div id="regErr" class="login-err" style="display:none"></div>
      <button type="submit" class="login-btn" style="background:var(--nominal)">Create Account & Sign In</button>
      <div style="text-align:center;margin-top:10px">
        <a href="#" id="linkToSignin" style="font-size:12px;color:var(--info);text-decoration:none">Already have an account? Sign In</a>
      </div>
    </form>

    <div style="margin-top:20px;text-align:center;padding-top:12px;border-top:1px solid var(--rule-soft)">
      <span class="security-badge-pill">
        <span class="dot-active"></span>
        SECURE SESSION • JWT • RBAC
      </span>
    </div>
  `;

  overlayEl.appendChild(card);
  document.body.appendChild(overlayEl);

  const tabSignin = card.querySelector('#tabSignin');
  const tabRegister = card.querySelector('#tabRegister');
  const loginForm = card.querySelector('#loginForm');
  const registerForm = card.querySelector('#registerForm');
  const loginErr = card.querySelector('#loginErr');
  const regErr = card.querySelector('#regErr');

  const switchTab = (tab) => {
    currentTab = tab;
    loginErr.style.display = 'none';
    regErr.style.display = 'none';
    if (tab === 'signin') {
      tabSignin.style.borderBottomColor = 'var(--caution)';
      tabSignin.style.color = 'var(--ink)';
      tabSignin.style.fontWeight = '600';

      tabRegister.style.borderBottomColor = 'transparent';
      tabRegister.style.color = 'var(--ink-3)';
      tabRegister.style.fontWeight = '400';

      loginForm.style.display = 'flex';
      registerForm.style.display = 'none';
    } else {
      tabRegister.style.borderBottomColor = 'var(--nominal)';
      tabRegister.style.color = 'var(--ink)';
      tabRegister.style.fontWeight = '600';

      tabSignin.style.borderBottomColor = 'transparent';
      tabSignin.style.color = 'var(--ink-3)';
      tabSignin.style.fontWeight = '400';

      registerForm.style.display = 'flex';
      loginForm.style.display = 'none';
    }
  };

  tabSignin.onclick = () => switchTab('signin');
  tabRegister.onclick = () => switchTab('register');
  card.querySelector('#linkToRegister').onclick = (e) => { e.preventDefault(); switchTab('register'); };
  card.querySelector('#linkToSignin').onclick = (e) => { e.preventDefault(); switchTab('signin'); };

  // Handle Login Submit
  loginForm.onsubmit = (e) => {
    e.preventDefault();
    loginErr.style.display = 'none';
    const u = card.querySelector('#loginUser').value;
    const p = card.querySelector('#loginPass').value;
    const res = auth.login(u, p);
    if (res.success) {
      hideLoginOverlay();
      if (onSuccess) onSuccess(res.user);
    } else {
      loginErr.textContent = res.message || 'Invalid username or password';
      loginErr.style.display = 'block';
    }
  };

  // Handle Register Submit
  registerForm.onsubmit = (e) => {
    e.preventDefault();
    regErr.style.display = 'none';
    const name = card.querySelector('#regName').value;
    const username = card.querySelector('#regUser').value;
    const password = card.querySelector('#regPass').value;
    const role = card.querySelector('#regRole').value;

    const res = auth.register({ name, username, password, role });
    if (res.success) {
      hideLoginOverlay();
      if (onSuccess) onSuccess(res.user);
    } else {
      regErr.textContent = res.message || 'Registration failed';
      regErr.style.display = 'block';
    }
  };

  return overlayEl;
}

export function hideLoginOverlay() {
  if (overlayEl) {
    overlayEl.remove();
    overlayEl = null;
  }
}
