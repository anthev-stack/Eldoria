import { isChief, canManageUsers } from './auth.js';

const config = window.ELDORIA_CONFIG;

function $(id) {
  return document.getElementById(id);
}

function apiBase() {
  return config.api?.baseUrl ?? '/api';
}

async function adminFetch(path, options = {}) {
  const res = await fetch(`${apiBase()}/admin${path}`, {
    credentials: 'include',
    headers: { 'Content-Type': 'application/json', ...options.headers },
    ...options,
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || 'Request failed');
  return data;
}

function escapeHtml(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function titleOptions(titles, selectedId) {
  const opts = ['<option value="">No title</option>'];
  for (const t of titles) {
    opts.push(`<option value="${t.id}" ${t.id === selectedId ? 'selected' : ''}>${escapeHtml(t.name)}</option>`);
  }
  return opts.join('');
}

function roleOptions(selected) {
  const roles = ['chief', 'admin', 'moderator', 'donator', 'user'];
  return roles
    .map((r) => `<option value="${r}" ${r === selected ? 'selected' : ''}>${r.charAt(0).toUpperCase() + r.slice(1)}</option>`)
    .join('');
}

export async function renderUserManagement(container) {
  if (!canManageUsers() || !container) return;

  container.innerHTML = '<p class="table-empty">Loading users…</p>';

  try {
    const data = await adminFetch('/users');
    const chief = isChief();

    container.innerHTML = `
      <div class="card dashboard-card-wide admin-card">
        <div class="card-header card-header-row">
          <h3>User Management</h3>
          <span class="meta-pill">${data.users.length} accounts</span>
        </div>
        <div class="card-body table-wrap">
          <table class="stats-table admin-table">
            <thead>
              <tr>
                <th>User</th>
                <th>Role</th>
                ${chief ? '<th>Title</th>' : ''}
                <th>Status</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              ${data.users
                .map(
                  (u) => `
                <tr data-user-id="${u.id}">
                  <td>
                    <div class="player-cell">
                      <img class="player-avatar" src="${u.avatarUrl || ''}" alt="" width="28" height="28" />
                      <span>${escapeHtml(u.minecraftUsername || u.discordUsername)}</span>
                    </div>
                  </td>
                  <td>
                    ${
                      chief
                        ? `<select class="form-input form-input-sm user-role-select">${roleOptions(u.role)}</select>`
                        : `<span class="role-badge role-${u.role}">${escapeHtml(u.roleLabel)}</span>`
                    }
                  </td>
                  ${
                    chief
                      ? `<td><select class="form-input form-input-sm user-title-select">${titleOptions(data.titles, u.titleId)}</select></td>`
                      : ''
                  }
                  <td>${u.paused ? '<span class="status-paused">Paused</span>' : '<span class="status-active">Active</span>'}</td>
                  <td class="admin-actions">
                    <button type="button" class="btn btn-ghost btn-sm btn-pause-user">${u.paused ? 'Unpause' : 'Pause'}</button>
                    <button type="button" class="btn btn-ghost btn-sm btn-delete-user">Delete</button>
                    ${chief ? '<button type="button" class="btn btn-primary btn-sm btn-save-user">Save</button>' : ''}
                  </td>
                </tr>`
                )
                .join('')}
            </tbody>
          </table>
        </div>
      </div>
    `;

    container.querySelectorAll('tr[data-user-id]').forEach((row) => {
      const id = row.dataset.userId;
      row.querySelector('.btn-pause-user')?.addEventListener('click', async () => {
        const paused = row.querySelector('.btn-pause-user').textContent === 'Pause';
        try {
          await adminFetch(`/users/${id}`, { method: 'PATCH', body: JSON.stringify({ paused }) });
          await renderUserManagement(container);
        } catch (e) {
          alert(e.message);
        }
      });
      row.querySelector('.btn-delete-user')?.addEventListener('click', async () => {
        const name = row.querySelector('.player-cell span')?.textContent;
        if (!confirm(`Delete account for ${name}? This cannot be undone.`)) return;
        try {
          await adminFetch(`/users/${id}`, { method: 'DELETE' });
          await renderUserManagement(container);
        } catch (e) {
          alert(e.message);
        }
      });
      row.querySelector('.btn-save-user')?.addEventListener('click', async () => {
        const role = row.querySelector('.user-role-select')?.value;
        const titleId = row.querySelector('.user-title-select')?.value ?? '';
        try {
          await adminFetch(`/users/${id}`, {
            method: 'PATCH',
            body: JSON.stringify({ role, titleId }),
          });
          row.querySelector('.btn-save-user').textContent = 'Saved!';
          setTimeout(() => { row.querySelector('.btn-save-user').textContent = 'Save'; }, 1500);
        } catch (e) {
          alert(e.message);
        }
      });
    });
  } catch {
    container.innerHTML = '<p class="table-empty">Could not load users.</p>';
  }
}

export async function renderTitleManagement(container) {
  if (!isChief() || !container) return;

  container.innerHTML = '<p class="table-empty">Loading titles…</p>';

  try {
    const titlesRes = await fetch(`${apiBase()}/titles`);
    const titlesData = await titlesRes.json();
    const titles = titlesData.titles ?? [];

    container.innerHTML = `
      <div class="card dashboard-card-wide admin-card">
        <div class="card-header"><h3>Title Management</h3></div>
        <div class="card-body">
          <form id="create-title-form" class="title-create-form">
            <input class="form-input" id="new-title-name" placeholder="Title name" maxlength="40" required />
            <input class="form-input form-input-color" id="new-title-color" type="color" value="#1bd96a" />
            <button type="submit" class="btn btn-primary btn-sm">Create Title</button>
          </form>
          <p class="form-error" id="title-create-error"></p>
          <ul class="title-list" id="title-list">
            ${titles
              .map(
                (t) => `
              <li class="title-list-item" data-title-id="${t.id}">
                <span class="staff-title-badge" style="--title-color:${t.color}">${escapeHtml(t.name)}</span>
                <input type="color" class="form-input form-input-color title-color-input" value="${t.color}" />
                <button type="button" class="btn btn-ghost btn-sm btn-delete-title">Delete</button>
              </li>`
              )
              .join('')}
          </ul>
        </div>
      </div>
    `;

    $('create-title-form')?.addEventListener('submit', async (e) => {
      e.preventDefault();
      const err = $('title-create-error');
      err.textContent = '';
      try {
        await adminFetch('/titles', {
          method: 'POST',
          body: JSON.stringify({
            name: $('new-title-name').value,
            color: $('new-title-color').value,
          }),
        });
        await renderTitleManagement(container);
      } catch (error) {
        err.textContent = error.message;
      }
    });

    container.querySelectorAll('.title-color-input').forEach((input) => {
      input.addEventListener('change', async () => {
        const li = input.closest('.title-list-item');
        const id = li.dataset.titleId;
        const name = li.querySelector('.staff-title-badge').textContent;
        try {
          await adminFetch(`/titles/${id}`, {
            method: 'PATCH',
            body: JSON.stringify({ name, color: input.value }),
          });
          li.querySelector('.staff-title-badge').style.setProperty('--title-color', input.value);
        } catch (e) {
          alert(e.message);
        }
      });
    });

    container.querySelectorAll('.btn-delete-title').forEach((btn) => {
      btn.addEventListener('click', async () => {
        const li = btn.closest('.title-list-item');
        const id = li.dataset.titleId;
        const name = li.querySelector('.staff-title-badge').textContent;
        if (!confirm(`Delete title "${name}"?`)) return;
        try {
          await adminFetch(`/titles/${id}`, { method: 'DELETE' });
          await renderTitleManagement(container);
        } catch (e) {
          alert(e.message);
        }
      });
    });
  } catch {
    container.innerHTML = '<p class="table-empty">Could not load titles.</p>';
  }
}
