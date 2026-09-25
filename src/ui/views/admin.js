import { el, $ } from '../../core/util.js';
import { auth } from '../../core/auth.js';
import { panel } from '../components/panel.js';
import { toast } from '../components/toast.js';
import { VIEWS } from './registry.js';
import { bus } from '../../core/EventBus.js';

VIEWS.admin = {
  layer: '12',
  nav: 'Admin & Users',
  title: 'User Management & Security Administration',
  desc: 'Comprehensive access control for System Admin. View all registered users, inspect passwords, edit security roles, delete accounts, and monitor live authentication audit logs.',

  build() {
    const root = el('div', 'grid g2');
    
    // Panel 1: User Accounts Table
    const userPanel = panel('User Accounts Database', 'ADMIN PRIVILEGED ACCESS');
    this.userTableBody = el('tbody');
    const table = el('table');
    table.innerHTML = `
      <thead>
        <tr>
          <th>USERNAME & NAME</th>
          <th>ROLE</th>
          <th>PASSWORD</th>
          <th>TYPE</th>
          <th style="text-align:right">ACTIONS</th>
        </tr>
      </thead>
    `;
    table.appendChild(this.userTableBody);
    
    const tableWrap = el('div', 'tbl-wrap');
    tableWrap.appendChild(table);
    userPanel.body.appendChild(tableWrap);

    // Edit Modal / Inline Container
    this.editFormContainer = el('div', 'panel-body');
    this.editFormContainer.style.display = 'none';
    this.editFormContainer.style.borderTop = '1px solid var(--rule-soft)';
    this.editFormContainer.style.background = 'var(--bg-2)';
    userPanel.body.appendChild(this.editFormContainer);

    root.appendChild(userPanel);

    // Panel 2: Live Security Audit Log
    const auditPanel = panel('Authentication & Security Log', 'REAL-TIME EVENTS');
    this.auditLogBody = el('div', 'log');
    auditPanel.body.appendChild(this.auditLogBody);
    root.appendChild(auditPanel);

    // Initial renders
    this.renderUsers();
    this.renderAuditLog();

    // Listen to security events and auth changes
    bus.on('security_event', () => {
      this.renderAuditLog();
    });
    bus.on('auth_change', () => {
      this.renderUsers();
      this.renderAuditLog();
    });

    return root;
  },

  renderUsers() {
    if (!this.userTableBody) return;
    this.userTableBody.innerHTML = '';

    const currentUser = auth.getCurrentUser();
    const isAdmin = !currentUser || currentUser.username === 'admin' || currentUser.role === 'Fleet Manager' || auth.isAuthenticated();
    const users = auth.getAllUsers();

    users.forEach(u => {
      const tr = el('tr');

      // User & Handle
      const tdUser = el('td');
      tdUser.innerHTML = `
        <div style="font-weight:600;color:var(--ink)">${u.name}</div>
        <div class="mono dimmer" style="font-size:11px">@${u.username}</div>
      `;

      // Role Badge
      const tdRole = el('td');
      tdRole.innerHTML = `<span class="pill ${u.role === 'Maintenance Engineer' ? 'cau' : 'nom'}">${u.role}</span>`;

      // Password & Show/Hide Toggle Button
      const tdPass = el('td');
      const passSpan = el('span', 'mono', '••••••••');
      passSpan.style.cssText = 'font-size:12px;letter-spacing:1px;margin-right:6px;';

      let shown = false;
      const toggleBtn = el('button', 'btn mono', '👁️ Show');
      toggleBtn.type = 'button';
      toggleBtn.style.cssText = 'padding:2px 6px;font-size:10px;cursor:pointer;line-height:1.2;';
      toggleBtn.title = 'Show/Hide Password';
      toggleBtn.onclick = (e) => {
        e.preventDefault();
        e.stopPropagation();
        shown = !shown;
        if (shown) {
          passSpan.textContent = u.password;
          toggleBtn.textContent = '🔒 Hide';
        } else {
          passSpan.textContent = '••••••••';
          toggleBtn.textContent = '👁️ Show';
        }
      };

      const passFlex = el('div');
      passFlex.style.cssText = 'display:flex;align-items:center;gap:6px;';
      passFlex.appendChild(passSpan);
      passFlex.appendChild(toggleBtn);
      tdPass.appendChild(passFlex);

      // Type Badge
      const tdType = el('td');
      tdType.innerHTML = `<span class="dimmer" style="font-size:11px">${u.isDefault ? 'Default System User' : 'Registered User'}</span>`;

      // Action Buttons (Edit & Delete)
      const tdActions = el('td');
      tdActions.style.textAlign = 'right';
      const actGroup = el('div');
      actGroup.style.cssText = 'display:inline-flex;gap:4px;';

      const editBtn = el('button', 'btn mono', '✏️ Edit');
      editBtn.type = 'button';
      editBtn.style.cssText = 'padding:3px 7px;font-size:11px;cursor:pointer;';
      if (!isAdmin) editBtn.disabled = true;
      editBtn.onclick = (e) => {
        e.preventDefault();
        e.stopPropagation();
        this.showEditForm(u);
      };

      const delBtn = el('button', 'btn mono wrn', '🗑️ Delete');
      delBtn.type = 'button';
      delBtn.style.cssText = 'padding:3px 7px;font-size:11px;cursor:pointer;';
      if (u.username === 'admin' || !isAdmin) delBtn.disabled = true;
      delBtn.onclick = (e) => {
        e.preventDefault();
        e.stopPropagation();
        if (confirm(`Are you sure you want to delete user account '@${u.username}'?`)) {
          const res = auth.deleteUser(u.username);
          if (res.success) {
            toast(`User '@${u.username}' deleted successfully`);
            this.renderUsers();
          } else {
            toast(res.message || 'Failed to delete user');
          }
        }
      };

      actGroup.appendChild(editBtn);
      actGroup.appendChild(delBtn);
      tdActions.appendChild(actGroup);

      tr.appendChild(tdUser);
      tr.appendChild(tdRole);
      tr.appendChild(tdPass);
      tr.appendChild(tdType);
      tr.appendChild(tdActions);

      this.userTableBody.appendChild(tr);
    });
  },

  showEditForm(user) {
    if (!this.editFormContainer) return;
    this.editFormContainer.style.display = 'block';
    this.editFormContainer.innerHTML = `
      <div style="font-weight:600;font-size:13px;margin-bottom:10px;color:var(--info)">
        EDIT USER PROFILE: @${user.username}
      </div>
      <form id="formEditUser" style="display:flex;flex-direction:column;gap:10px">
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px">
          <div>
            <label style="font-size:10px;font-family:var(--mono);color:var(--ink-3)">FULL NAME</label>
            <input type="text" id="editName" value="${user.name}" required>
          </div>
          <div>
            <label style="font-size:10px;font-family:var(--mono);color:var(--ink-3)">PASSWORD</label>
            <input type="text" id="editPass" value="${user.password}" required>
          </div>
        </div>
        <div>
          <label style="font-size:10px;font-family:var(--mono);color:var(--ink-3)">SECURITY ROLE</label>
          <select id="editRole">
            <option value="Fleet Manager" ${user.role === 'Fleet Manager' ? 'selected' : ''}>Fleet Manager</option>
            <option value="Maintenance Engineer" ${user.role === 'Maintenance Engineer' ? 'selected' : ''}>Maintenance Engineer</option>
          </select>
        </div>
        <div style="display:flex;gap:8px;justify-content:flex-end;margin-top:6px">
          <button type="button" class="btn" id="btnCancelEdit">Cancel</button>
          <button type="submit" class="btn primary">Save Changes</button>
        </div>
      </form>
    `;

    this.editFormContainer.querySelector('#btnCancelEdit').onclick = (e) => {
      e.preventDefault();
      this.editFormContainer.style.display = 'none';
    };

    this.editFormContainer.querySelector('#formEditUser').onsubmit = (e) => {
      e.preventDefault();
      const name = this.editFormContainer.querySelector('#editName').value;
      const password = this.editFormContainer.querySelector('#editPass').value;
      const role = this.editFormContainer.querySelector('#editRole').value;

      const res = auth.updateUser(user.username, { name, password, role });
      if (res.success) {
        toast(`User profile @${user.username} updated!`);
        this.editFormContainer.style.display = 'none';
        this.renderUsers();
      } else {
        toast(res.message || 'Update failed');
      }
    };
  },

  renderAuditLog() {
    if (!this.auditLogBody) return;
    this.auditLogBody.innerHTML = '';
    const events = auth.events || [];

    if (!events.length) {
      this.auditLogBody.innerHTML = '<div class="dim padding-8">No security events logged yet.</div>';
      return;
    }

    events.slice(0, 30).forEach(e => {
      const row = el('div', 'log-row');
      const sevClass = e.sev === 2 ? 'wrn' : e.sev === 1 ? 'cau' : 'nom';
      const typeLabel = e.type ? e.type.toUpperCase() : 'EVENT';
      
      row.innerHTML = `
        <span class="ts">${e.timeStr || ''}</span>
        <span class="sev ${sevClass}">${typeLabel}</span>
        <span class="txt">${e.txt}</span>
        <span class="usr">@${e.user}</span>
      `;
      this.auditLogBody.appendChild(row);
    });
  },

  update() {
    this.renderAuditLog();
  },
  seed() {}
};
