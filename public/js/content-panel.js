import { canPost } from './auth.js';

const config = window.ELDORIA_CONFIG;

function $(id) {
  return document.getElementById(id);
}

function apiBase() {
  return config.api?.baseUrl ?? '/api';
}

async function contentFetch(path, options = {}) {
  const res = await fetch(`${apiBase()}${path}`, {
    credentials: 'include',
    headers: { 'Content-Type': 'application/json', ...options.headers },
    ...options,
  });
  if (res.status === 204) return null;
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

function formatDate(dateStr) {
  if (!dateStr) return '—';
  const date = new Date(dateStr);
  return date.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
}

let modalsInitialized = false;

export function initPostModals(onSaved) {
  if (modalsInitialized || !$('post-news-form')) return;
  modalsInitialized = true;

  $('post-news-close')?.addEventListener('click', () => $('post-news-modal')?.close());
  $('post-update-close')?.addEventListener('click', () => $('post-update-modal')?.close());

  $('post-news-form')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const err = $('post-news-error');
    err.textContent = '';
    const id = $('post-news-id')?.value;
    const body = {
      title: $('post-news-title').value,
      excerpt: $('post-news-excerpt').value,
      tag: $('post-news-tag').value,
      date: $('post-news-date').value || undefined,
    };
    try {
      if (id) {
        await contentFetch(`/news/${id}`, { method: 'PATCH', body: JSON.stringify(body) });
      } else {
        await contentFetch('/news', { method: 'POST', body: JSON.stringify(body) });
      }
      $('post-news-form').reset();
      $('post-news-id').value = '';
      $('post-news-modal')?.close();
      window.dispatchEvent(new CustomEvent('eldoria:news-updated'));
      onSaved?.();
    } catch (error) {
      err.textContent = error.message;
    }
  });

  $('post-update-form')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const err = $('post-update-error');
    err.textContent = '';
    const id = $('post-update-id')?.value;
    const changes = $('post-update-changes').value.split('\n').map((l) => l.trim()).filter(Boolean);
    const body = {
      version: $('post-update-version').value,
      changes,
      date: $('post-update-date').value || undefined,
    };
    try {
      if (id) {
        await contentFetch(`/updates/${id}`, { method: 'PATCH', body: JSON.stringify(body) });
      } else {
        await contentFetch('/updates', { method: 'POST', body: JSON.stringify(body) });
      }
      $('post-update-form').reset();
      $('post-update-id').value = '';
      $('post-update-modal')?.close();
      window.dispatchEvent(new CustomEvent('eldoria:updates-updated'));
      onSaved?.();
    } catch (error) {
      err.textContent = error.message;
    }
  });
}

function openNewsModal(item = null) {
  const modal = $('post-news-modal');
  const title = modal?.querySelector('.modal-title');
  const submit = $('post-news-form')?.querySelector('[type="submit"]');
  $('post-news-error').textContent = '';
  $('post-news-id').value = item?.id ?? '';
  $('post-news-title').value = item?.title ?? '';
  $('post-news-excerpt').value = item?.excerpt ?? '';
  $('post-news-tag').value = item?.tag ?? 'announcement';
  $('post-news-date').value = item?.date ?? new Date().toISOString().slice(0, 10);
  if (title) title.textContent = item ? 'Edit News' : 'Post News';
  if (submit) submit.textContent = item ? 'Save Changes' : 'Publish';
  modal?.showModal();
}

function openUpdateModal(item = null) {
  const modal = $('post-update-modal');
  const title = modal?.querySelector('.modal-title');
  const submit = $('post-update-form')?.querySelector('[type="submit"]');
  $('post-update-error').textContent = '';
  $('post-update-id').value = item?.id ?? '';
  $('post-update-version').value = item?.version ?? '';
  $('post-update-changes').value = item?.changes?.join('\n') ?? '';
  $('post-update-date').value = item?.date ?? new Date().toISOString().slice(0, 10);
  if (title) title.textContent = item ? 'Edit Update' : 'Post Update';
  if (submit) submit.textContent = item ? 'Save Changes' : 'Publish';
  modal?.showModal();
}

export async function renderContentManagement(container) {
  if (!canPost() || !container) return;

  container.innerHTML = '<p class="table-empty">Loading content…</p>';

  try {
    const [newsRes, updatesRes] = await Promise.all([
      contentFetch('/news'),
      contentFetch('/updates'),
    ]);
    const news = newsRes.items ?? [];
    const updates = updatesRes.items ?? [];

    container.innerHTML = `
      <div class="content-mgmt-grid">
        <div class="card dashboard-card admin-card">
          <div class="card-header card-header-row">
            <h3>News Posts</h3>
            <button type="button" class="btn btn-primary btn-sm" id="content-new-news">+ New Post</button>
          </div>
          <div class="card-body table-wrap">
            ${
              news.length
                ? `<table class="stats-table content-table">
              <thead>
                <tr>
                  <th>Title</th>
                  <th>Tag</th>
                  <th>Date</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                ${news
                  .map(
                    (item) => `
                <tr data-news-id="${item.id}">
                  <td>
                    <strong class="content-row-title">${escapeHtml(item.title)}</strong>
                    <span class="content-row-excerpt">${escapeHtml(item.excerpt)}</span>
                  </td>
                  <td><span class="feed-tag ${escapeHtml(item.tag)}">${escapeHtml(item.tag)}</span></td>
                  <td>${formatDate(item.date)}</td>
                  <td>
                    <div class="admin-actions">
                      <button type="button" class="btn btn-ghost btn-sm btn-edit-news">Edit</button>
                      <button type="button" class="btn btn-ghost btn-sm btn-delete-news">Delete</button>
                    </div>
                  </td>
                </tr>`
                  )
                  .join('')}
              </tbody>
            </table>`
                : '<p class="feed-empty">No news posts yet.</p>'
            }
          </div>
        </div>

        <div class="card dashboard-card admin-card">
          <div class="card-header card-header-row">
            <h3>Update Logs</h3>
            <button type="button" class="btn btn-secondary btn-sm" id="content-new-update">+ New Update</button>
          </div>
          <div class="card-body table-wrap">
            ${
              updates.length
                ? `<table class="stats-table content-table">
              <thead>
                <tr>
                  <th>Version</th>
                  <th>Changes</th>
                  <th>Date</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                ${updates
                  .map(
                    (item) => `
                <tr data-update-id="${item.id}">
                  <td><strong>${escapeHtml(item.version)}</strong></td>
                  <td><span class="content-row-excerpt">${item.changes.length} change${item.changes.length === 1 ? '' : 's'}</span></td>
                  <td>${formatDate(item.date)}</td>
                  <td>
                    <div class="admin-actions">
                      <button type="button" class="btn btn-ghost btn-sm btn-edit-update">Edit</button>
                      <button type="button" class="btn btn-ghost btn-sm btn-delete-update">Delete</button>
                    </div>
                  </td>
                </tr>`
                  )
                  .join('')}
              </tbody>
            </table>`
                : '<p class="feed-empty">No updates yet.</p>'
            }
          </div>
        </div>
      </div>
    `;

    $('content-new-news')?.addEventListener('click', () => openNewsModal());
    $('content-new-update')?.addEventListener('click', () => openUpdateModal());

    container.querySelectorAll('.btn-edit-news').forEach((btn) => {
      btn.addEventListener('click', () => {
        const id = btn.closest('tr')?.dataset.newsId;
        const item = news.find((n) => n.id === id);
        if (item) openNewsModal(item);
      });
    });

    container.querySelectorAll('.btn-delete-news').forEach((btn) => {
      btn.addEventListener('click', async () => {
        const id = btn.closest('tr')?.dataset.newsId;
        const item = news.find((n) => n.id === id);
        if (!item || !confirm(`Delete news post "${item.title}"?`)) return;
        try {
          await contentFetch(`/news/${id}`, { method: 'DELETE' });
          await renderContentManagement(container);
        } catch (e) {
          alert(e.message);
        }
      });
    });

    container.querySelectorAll('.btn-edit-update').forEach((btn) => {
      btn.addEventListener('click', () => {
        const id = btn.closest('tr')?.dataset.updateId;
        const item = updates.find((u) => u.id === id);
        if (item) openUpdateModal(item);
      });
    });

    container.querySelectorAll('.btn-delete-update').forEach((btn) => {
      btn.addEventListener('click', async () => {
        const id = btn.closest('tr')?.dataset.updateId;
        const item = updates.find((u) => u.id === id);
        if (!item || !confirm(`Delete update "${item.version}"?`)) return;
        try {
          await contentFetch(`/updates/${id}`, { method: 'DELETE' });
          await renderContentManagement(container);
        } catch (e) {
          alert(e.message);
        }
      });
    });
  } catch {
    container.innerHTML = '<p class="table-empty">Could not load content.</p>';
  }
}
