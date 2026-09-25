import { el, $ } from '../../core/util.js';
import { auth } from '../../core/auth.js';
import { panel } from '../components/panel.js';
import { toast } from '../components/toast.js';
import { VIEWS } from './registry.js';
import { bus } from '../../core/EventBus.js';

VIEWS.admin = {
  layer: '11',
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
    const isAdmin = currentUser && (currentUser.username === 'admin' || currentUser.role === 'Fleet Manager');
    const users = auth.getAllUsers();

    users.forEach(u => {
      const tr = el('tr');
      const passId = `pass-${u.username}`;

      tr.innerHTML = `
        <td>
          <div style="font-weight:600;color:var(--ink)">${u.name}</div>
          <div class="mono dimmer" style="font-size:11px">@${u.username}</div>
        </td>
        <td>
          <span class="pill ${u.role === 'Maintenance Engineer' ? 'cau' : 'nom'}">${u.role}</span>
        </td>
        <td>
          <div style="display:flex;align-items:center;gap:6px">
            <span class="mono" id="${passId}" style="font-size:12px;letter-spacing:1px">••••••••</span>
            <button type="button" class="btn mono" style="padding:2px 6px;font-size:10px" id="btn-toggle-${u.username}" title="Show/Hide Password">
              👁️ Show
            </button>
          </div>
        </td>
        <td>
          <span class="dimmer" style="font-size:11px">${u.isDefault ? 'Default System User' : 'Registered User'}</span>
        </td>
        <td style="text-align:right">
          <div style="display:inline-flex;gap:4px">
            <button type="button" class="btn mono" id="btn-edit-${u.username}" style="padding:3px 7px;font-size:11px" ${!isAdmin ? 'disabled' : ''}>✏️ Edit</button>
            <button type="button" class="btn mono wrn" id="btn-del-${u.username}" style="padding:3px 7px;font-size:11px" ${u.username === 'admin' || !isAdmin ? 'disabled' : ''}>🗑️ Delete</button>
          </div>
        </td>
      `;

      this.userTableBody.appendChild(tr);

      // Password Toggle Handler
      const passSpan = tr.querySelector(`#${passId}`);
      const toggleBtn = tr.querySelector(`#btn-toggle-${u.username}`);
      let shown = false;
      toggleBtn.onclick = () => {
        shown = !shown;
        if (shown) {
          passSpan.textContent = u.password;
          toggleBtn.textContent = '🔒 Hide';
        } else {
          passSpan.textContent = '••••••••';
          toggleBtn.textContent = '👁️ Show';
        }
      };

      // Edit Button Handler
      const editBtn = tr.querySelector(`#btn-edit-${u.username}`);
      editBtn.onclick = () => this.showEditForm(u);

      // Delete Button Handler
      const delBtn = tr.querySelector(`#btn-del-${u.username}`);
      delBtn.onclick = () => {
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

    this.editFormContainer.querySelector('#btnCancelEdit').onclick = () => {
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
        <span style="flex:1;color:var(--ink-2)">${e.txt}</span>
        <span class="mono dimmer" style="font-size:10px">@${e.user}</span>
      `;
      this.auditLogBody.appendChild(row);
    });
  },

  update() {
    this.renderUsers();
    this.renderAuditLog();
  },
  seed() {}
};
