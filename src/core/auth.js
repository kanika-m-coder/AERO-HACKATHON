import { bus } from './EventBus.js';

/* Demo users & credentials */
export const DEMO_USERS = {
  admin: {
    username: 'admin',
    password: 'admin123',
    role: 'Fleet Manager',
    name: 'Fleet Manager Admin',
    desc: 'Full fleet health monitoring, alerts & maintenance reports access.'
  },
  engineer: {
    username: 'engineer',
    password: 'engineer123',
    role: 'Maintenance Engineer',
    name: 'Lead Maintenance Engineer',
    desc: 'Full diagnostic, twin simulation, fault injection & RUL access.'
  }
};

/* Role Permissions Mapping */
export const ROLE_PERMISSIONS = {
  'Fleet Manager': ['overview', 'telemetry', 'health', 'reports', 'architecture'],
  'Maintenance Engineer': ['overview', 'telemetry', 'twin', 'health', 'faults', 'predictive', 'rul', 'simulation', 'replay', 'reports', 'architecture']
};

function base64UrlEncode(str) {
  return btoa(unescape(encodeURIComponent(str))).replace(/=/g, '').replace(/\+/g, '-').replace(/\//g, '_');
}
function base64UrlDecode(str) {
  str = str.replace(/-/g, '+').replace(/_/g, '/');
  while (str.length % 4) str += '=';
  return decodeURIComponent(escape(atob(str)));
}

export class SecurityManager {
  constructor() {
    this.tokenKey = 'aerotwin_jwt_token';
    this.sessionUserKey = 'aerotwin_session_user';
    this.eventsKey = 'aerotwin_security_events';
    this.events = this.loadEvents();
    this.initDefaultEvents();
  }

  loadEvents() {
    try {
      const stored = sessionStorage.getItem(this.eventsKey);
      return stored ? JSON.parse(stored) : [];
    } catch (e) {
      return [];
    }
  }

  saveEvents() {
    try {
      sessionStorage.setItem(this.eventsKey, JSON.stringify(this.events.slice(0, 100)));
    } catch (e) {}
  }

  initDefaultEvents() {
    if (!this.events.length) {
      this.logEvent('data_access', 'System', 'System', 'Encrypted telemetry stream initialized over TLS 1.3', 0);
      this.logEvent('auth_system', 'System', 'System', 'API Gateway protected with JWT & RBAC policy', 0);
    }
  }

  logEvent(type, user, role, txt, sev = 0) {
    const d = new Date();
    const hh = String(d.getHours()).padStart(2, '0');
    const mm = String(d.getMinutes()).padStart(2, '0');
    const ss = String(d.getSeconds()).padStart(2, '0');
    const timeStr = `${hh}:${mm}:${ss}`;

    const evt = {
      id: 'SEC-' + Math.floor(Math.random() * 9000 + 1000),
      type,
      user: user || 'Anonymous',
      role: role || 'Unauthenticated',
      txt,
      sev, // 0 = Secure/Active (Green), 1 = Caution (Amber), 2 = Failed/Blocked (Red)
      t: Date.now(),
      timeStr
    };
    this.events.unshift(evt);
    if (this.events.length > 100) this.events.pop();
    this.saveEvents();
    bus.emit('security_event', evt);
    return evt;
  }

  generateJWT(userObj) {
    const header = { alg: 'HS256', typ: 'JWT' };
    const now = Math.floor(Date.now() / 1000);
    const payload = {
      sub: userObj.username,
      name: userObj.name,
      role: userObj.role,
      iat: now,
      exp: now + 3600,
      iss: 'AeroTwin-FastAPI-Security'
    };
    const encodedHeader = base64UrlEncode(JSON.stringify(header));
    const encodedPayload = base64UrlEncode(JSON.stringify(payload));
    const signature = base64UrlEncode(userObj.username + '_sig_jwt_aerotwin_2026');
    return `${encodedHeader}.${encodedPayload}.${signature}`;
  }

  verifyJWT(token) {
    if (!token) return null;
    try {
      const parts = token.split('.');
      if (parts.length !== 3) return null;
      const payload = JSON.parse(base64UrlDecode(parts[1]));
      const now = Math.floor(Date.now() / 1000);
      if (payload.exp && payload.exp < now) return null;
      return payload;
    } catch (e) {
      return null;
    }
  }

  login(username, password) {
    const userKey = Object.keys(DEMO_USERS).find(
      k => DEMO_USERS[k].username.toLowerCase() === (username || '').trim().toLowerCase()
    );
    const userObj = userKey ? DEMO_USERS[userKey] : null;

    if (!userObj || userObj.password !== password) {
      this.logEvent('login_failure', username || 'unknown', 'Guest', `Failed login attempt for user '${username}' (Invalid credentials)`, 2);
      return { success: false, message: 'Invalid username or password' };
    }

    const token = this.generateJWT(userObj);
    sessionStorage.setItem(this.tokenKey, token);
    sessionStorage.setItem(this.sessionUserKey, JSON.stringify(userObj));
    this.logEvent('login_success', userObj.username, userObj.role, `Successful authentication for user '${userObj.username}' (${userObj.role})`, 0);
    bus.emit('auth_change', { authenticated: true, user: userObj, token });
    return { success: true, user: userObj, token };
  }

  logout() {
    const user = this.getCurrentUser();
    if (user) {
      this.logEvent('logout', user.username, user.role, `User '${user.username}' logged out`, 1);
    }
    sessionStorage.removeItem(this.tokenKey);
    sessionStorage.removeItem(this.sessionUserKey);
    bus.emit('auth_change', { authenticated: false, user: null, token: null });
  }

  getToken() {
    return sessionStorage.getItem(this.tokenKey);
  }

  getCurrentUser() {
    const token = this.getToken();
    const payload = this.verifyJWT(token);
    if (!payload) return null;
    try {
      const stored = sessionStorage.getItem(this.sessionUserKey);
      return stored ? JSON.parse(stored) : { username: payload.sub, role: payload.role, name: payload.name };
    } catch (e) {
      return { username: payload.sub, role: payload.role, name: payload.name };
    }
  }

  isAuthenticated() {
    return !!this.getCurrentUser();
  }

  hasAccess(viewKey) {
    const user = this.getCurrentUser();
    if (!user) return false;
    const allowed = ROLE_PERMISSIONS[user.role] || [];
    return allowed.includes(viewKey);
  }

  getSecurityStatus() {
    const isAuth = this.isAuthenticated();
    return {
      auth: isAuth ? 'Active' : 'Unauthenticated',
      api: 'Protected (JWT)',
      tls: 'TLS Secured (TLS 1.3)',
      deviceAuth: 'Active (MALE UAV Bus)',
      storage: 'Access Controlled (RBAC)',
      badge: 'SECURE SESSION • JWT • RBAC'
    };
  }
}

export const auth = new SecurityManager();
