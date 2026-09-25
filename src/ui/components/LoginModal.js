import { el, $ } from '../../core/util.js';
import { auth } from '../../core/auth.js';
import { toast } from './toast.js';

let overlayEl = null;
let currentTab = 'signin'; // 'signin' or 'register'

export function buildLoginOverlay(onSuccess) {
  if (overlayEl) overlayEl.remove();

  overlayEl = el('div', 'login-overlay');
  const card = el('div', 'login-card');

  card.innerHTML = `
    <div class="login-card-scanline"></div>
    <div class="launch-progress-beam" id="launchBeam"></div>

    <div class="login-header">
      <img src="./assets/logo.jpg" alt="AeroTwin AI Logo" class="login-brand-logo">
      <div class="login-title">AeroTwin AI</div>
      <div class="login-sub">LAYER 00 · GATEWAY SECURITY</div>
    </div>
    
    <div class="login-tabs">
      <button type="button" class="login-tab-btn active" id="tabSignin">Sign In</button>
      <button type="button" class="login-tab-btn" id="tabRegister">Create Account</button>
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
      <button type="submit" class="login-btn" id="btnSignIn">
        <span>Authenticate & Launch Session</span>
      </button>
      <div style="text-align:center;margin-top:8px">
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
      <button type="submit" class="login-btn btn-register" id="btnRegister">
        <span>Create Account & Sign In</span>
      </button>
      <div style="text-align:center;margin-top:8px">
        <a href="#" id="linkToSignin" style="font-size:12px;color:var(--info);text-decoration:none">Already have an account? Sign In</a>
      </div>
    </form>
  `;

  overlayEl.appendChild(card);
  document.body.appendChild(overlayEl);

  const tabSignin = card.querySelector('#tabSignin');
  const tabRegister = card.querySelector('#tabRegister');
  const loginForm = card.querySelector('#loginForm');
  const registerForm = card.querySelector('#registerForm');
  const loginErr = card.querySelector('#loginErr');
  const regErr = card.querySelector('#regErr');
  const launchBeam = card.querySelector('#launchBeam');

  const switchTab = (tab) => {
    currentTab = tab;
    loginErr.style.display = 'none';
    regErr.style.display = 'none';
    if (tab === 'signin') {
      tabSignin.classList.add('active');
      tabRegister.classList.remove('active');
      loginForm.style.display = 'flex';
      registerForm.style.display = 'none';
    } else {
      tabRegister.classList.add('active');
      tabSignin.classList.remove('active');
      registerForm.style.display = 'flex';
      loginForm.style.display = 'none';
    }
  };

  tabSignin.onclick = () => switchTab('signin');
  tabRegister.onclick = () => switchTab('register');
  card.querySelector('#linkToRegister').onclick = (e) => { e.preventDefault(); switchTab('register'); };
  card.querySelector('#linkToSignin').onclick = (e) => { e.preventDefault(); switchTab('signin'); };

  // Launch transition helper
  const triggerLaunchAnimation = (submitBtn, user, callback) => {
    submitBtn.classList.add('launching');
    submitBtn.innerHTML = `<span class="mono">⚡ VERIFYING JWT & TELEMETRY...</span>`;
    if (launchBeam) launchBeam.style.width = '45%';

    setTimeout(() => {
      submitBtn.innerHTML = `<span class="mono">🛡️ ACCESS GRANTED · LAUNCHING SESSION...</span>`;
      if (launchBeam) launchBeam.style.width = '100%';
    }, 380);

    setTimeout(() => {
      card.classList.add('launching-exit');
      overlayEl.classList.add('launching-exit');
    }, 750);

    setTimeout(() => {
      hideLoginOverlay();
      toast(`Authenticated: Welcome ${user.name || user.username} (${user.role})`);
      if (callback) callback(user);
    }, 1150);
  };

  // Handle Login Submit
  loginForm.onsubmit = (e) => {
    e.preventDefault();
    loginErr.style.display = 'none';
    const u = card.querySelector('#loginUser').value;
    const p = card.querySelector('#loginPass').value;
    const res = auth.login(u, p);
    if (res.success) {
      triggerLaunchAnimation(card.querySelector('#btnSignIn'), res.user, onSuccess);
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
      triggerLaunchAnimation(card.querySelector('#btnRegister'), res.user, onSuccess);
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
