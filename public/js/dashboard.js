import { onAuthChange, canPost, getUser, isChief, canManageUsers } from './auth.js';
import { renderUserManagement, renderTitleManagement } from './admin-panel.js';
import { renderContentManagement, initPostModals } from './content-panel.js';
import { renderModrinthManagement } from './modrinth-panel.js';

const config = window.ELDORIA_CONFIG;

function $(id) {
  return document.getElementById(id);
}

function apiBase() {
  return config.api?.baseUrl ?? '/api';
}

function headUrl(name) {
  return `https://mc-heads.net/avatar/${encodeURIComponent(name)}/32`;
}

function toggleDashboardNav() {
  const link = $('nav-dashboard');
  if (!link) return;
  if (canPost()) link.removeAttribute('hidden');
  else link.setAttribute('hidden', '');
}

function showAccessDenied() {
  $('dashboard-denied')?.removeAttribute('hidden');
  $('dashboard-content')?.setAttribute('hidden', '');
}

function renderDashboard(data) {
  const el = $('dashboard-content');
  if (!el) return;

  el.removeAttribute('hidden');
  $('dashboard-denied')?.setAttribute('hidden', '');

  const server = data.server ?? {};
  const roles = data.roleCounts ?? {};

  el.innerHTML = `
    <div class="dashboard-stat-cards">
      <div class="dashboard-stat">
        <span class="dashboard-stat-value ${server.online ? 'online' : 'offline'}">${server.livePlayers ?? 0}</span>
        <span class="dashboard-stat-label">Live Players</span>
      </div>
      <div class="dashboard-stat">
        <span class="dashboard-stat-value">${server.totalPlayers ?? 0}</span>
        <span class="dashboard-stat-label">MC Player Base</span>
      </div>
      <div class="dashboard-stat">
        <span class="dashboard-stat-value">${data.registeredUsers ?? 0}</span>
        <span class="dashboard-stat-label">Site Accounts</span>
      </div>
      <div class="dashboard-stat">
        <span class="dashboard-stat-value">${data.chatMessages ?? 0}</span>
        <span class="dashboard-stat-label">Chat Messages</span>
      </div>
    </div>

    <div class="card dashboard-card">
      <div class="card-header"><h3>Site Members by Role</h3></div>
      <div class="card-body">
        <ul class="dashboard-role-list">
          <li><span>Chief</span><strong>${roles.chief ?? 0}</strong></li>
          <li><span>Admin</span><strong>${roles.admin ?? 0}</strong></li>
          <li><span>Moderator</span><strong>${roles.moderator ?? 0}</strong></li>
          <li><span>Donator</span><strong>${roles.donator ?? 0}</strong></li>
          <li><span>User</span><strong>${roles.user ?? 0}</strong></li>
        </ul>
      </div>
    </div>

    <div class="card dashboard-card dashboard-card-wide">
      <div class="card-header"><h3>Staff on Site (${data.staffMembers?.length ?? 0})</h3></div>
      <div class="card-body">
        ${
          data.staffMembers?.length
            ? `<div class="dashboard-staff-list">${data.staffMembers
                .map(
                  (m) => `
              <div class="dashboard-staff-row">
                <img src="${m.avatarUrl || headUrl('Steve')}" alt="" width="32" height="32" />
                <span class="dashboard-staff-name">${m.minecraftUsername || m.discordUsername}</span>
                <span class="role-badge role-${m.role}">${m.roleLabel}</span>
              </div>`
                )
                .join('')}</div>`
            : '<p class="feed-empty">No staff accounts registered yet.</p>'
        }
      </div>
    </div>

    <div class="card dashboard-card">
      <div class="card-header"><h3>Content</h3></div>
      <div class="card-body">
        <ul class="dashboard-role-list">
          <li><span>News posts</span><strong>${data.newsCount ?? 0}</strong></li>
          <li><span>Update logs</span><strong>${data.updatesCount ?? 0}</strong></li>
        </ul>
      </div>
    </div>
  `;

  loadAdminPanels();
}

async function loadAdminPanels() {
  const contentMgmt = $('admin-content-management');
  const userMgmt = $('admin-user-management');
  const titleMgmt = $('admin-title-management');
  const modrinthMgmt = $('admin-modrinth-management');

  if (canPost() && contentMgmt) {
    await renderContentManagement(contentMgmt);
  } else if (contentMgmt) {
    contentMgmt.innerHTML = '';
  }
  if (canManageUsers() && userMgmt) {
    await renderUserManagement(userMgmt);
  } else if (userMgmt) {
    userMgmt.innerHTML = '';
  }
  if (isChief() && titleMgmt) {
    await renderTitleManagement(titleMgmt);
  } else if (titleMgmt) {
    titleMgmt.innerHTML = '';
  }
  if (isChief() && modrinthMgmt) {
    await renderModrinthManagement(modrinthMgmt);
  } else if (modrinthMgmt) {
    modrinthMgmt.innerHTML = '';
  }
}

async function loadDashboard() {
  if (!canPost()) {
    showAccessDenied();
    return;
  }

  const el = $('dashboard-content');
  if (!el) return;

  el.innerHTML = '<p class="table-empty">Loading dashboard…</p>';
  el.removeAttribute('hidden');

  try {
    const res = await fetch(`${apiBase()}/dashboard`, { credentials: 'include' });
    if (!res.ok) throw new Error();
    const data = await res.json();
    renderDashboard(data);
    await loadAdminPanels();
  } catch {
    el.innerHTML = '<p class="table-empty">Could not load dashboard.</p>';
  }
}

export function initDashboard() {
  initPostModals(() => {
    const contentMgmt = $('admin-content-management');
    if (contentMgmt) renderContentManagement(contentMgmt);
  });

  onAuthChange(() => {
    toggleDashboardNav();
    if ($('dashboard-content') && getUser()) {
      loadDashboard();
    }
  });

  toggleDashboardNav();

  if ($('dashboard-content')) {
    loadDashboard();
  }
}
