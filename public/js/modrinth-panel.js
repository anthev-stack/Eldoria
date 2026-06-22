import { isChief } from './auth.js';

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

function formatBytes(bytes) {
  if (!bytes) return '—';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function formatDate(dateStr) {
  if (!dateStr) return '—';
  return new Date(dateStr).toLocaleDateString('en-GB', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
}

function escapeHtml(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

export async function renderModrinthManagement(container) {
  if (!isChief() || !container) return;

  container.innerHTML = '<p class="table-empty">Loading Modrinth settings…</p>';

  try {
    const data = await adminFetch('/modrinth-instance');
    const meta = data.meta;
    const hasFile = data.hasFile;

    container.innerHTML = `
      <div class="card dashboard-card-wide admin-card">
        <div class="card-header card-header-row">
          <h3>Modrinth Instance</h3>
          <span class="meta-pill">${hasFile || meta?.externalUrl ? 'Live on site' : 'Not configured'}</span>
        </div>
        <div class="card-body">
          <p class="form-hint modrinth-panel-desc">
            Upload the Eldoria <code>.mrpack</code> instance file. The homepage
            <strong>Download Instance</strong> button will use this file when uploaded.
          </p>

          <div class="modrinth-status">
            <p><strong>Uploaded file:</strong> ${hasFile ? meta?.originalName ?? 'eldoria-instance.mrpack' : 'None'}</p>
            <p><strong>File size:</strong> ${hasFile ? formatBytes(meta?.size) : '—'}</p>
            <p><strong>Last updated:</strong> ${formatDate(meta?.uploadedAt ?? meta?.updatedAt)}</p>
            <p><strong>Fallback URL:</strong> ${meta?.externalUrl ? escapeHtml(meta.externalUrl) : 'None'}</p>
          </div>

          <form id="modrinth-upload-form" class="modrinth-upload-form">
            <label class="form-label" for="modrinth-file">Upload instance (.mrpack or .zip)</label>
            <input class="form-input" id="modrinth-file" type="file" accept=".mrpack,.zip,application/zip" required />
            <button type="submit" class="btn btn-primary btn-sm">Upload Instance</button>
          </form>
          <p class="form-error" id="modrinth-upload-error"></p>

          <form id="modrinth-url-form" class="modrinth-url-form">
            <label class="form-label" for="modrinth-external-url">Or set a download URL</label>
            <input
              class="form-input"
              id="modrinth-external-url"
              type="url"
              placeholder="https://modrinth.com/modpack/..."
              value="${escapeHtml(meta?.externalUrl ?? '')}"
            />
            <div class="admin-actions">
              <button type="submit" class="btn btn-secondary btn-sm">Save URL</button>
              ${hasFile || meta?.externalUrl ? '<button type="button" class="btn btn-ghost btn-sm" id="modrinth-clear">Remove</button>' : ''}
            </div>
          </form>
          <p class="form-error" id="modrinth-url-error"></p>
        </div>
      </div>
    `;

    $('modrinth-upload-form')?.addEventListener('submit', async (e) => {
      e.preventDefault();
      const err = $('modrinth-upload-error');
      err.textContent = '';
      const input = $('modrinth-file');
      const file = input?.files?.[0];
      if (!file) {
        err.textContent = 'Choose a file to upload.';
        return;
      }
      if (!/\.(mrpack|zip)$/i.test(file.name)) {
        err.textContent = 'File must be .mrpack or .zip';
        return;
      }

      const btn = e.target.querySelector('[type="submit"]');
      const original = btn.textContent;
      btn.disabled = true;
      btn.textContent = 'Uploading…';

      try {
        const res = await fetch(`${apiBase()}/admin/modrinth-instance/file`, {
          method: 'POST',
          credentials: 'include',
          headers: {
            'Content-Type': 'application/octet-stream',
            'X-Filename': file.name,
          },
          body: file,
        });
        const payload = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(payload.error || 'Upload failed');
        await renderModrinthManagement(container);
      } catch (error) {
        err.textContent = error.message;
        btn.disabled = false;
        btn.textContent = original;
      }
    });

    $('modrinth-url-form')?.addEventListener('submit', async (e) => {
      e.preventDefault();
      const err = $('modrinth-url-error');
      err.textContent = '';
      try {
        await adminFetch('/modrinth-instance', {
          method: 'PATCH',
          body: JSON.stringify({ externalUrl: $('modrinth-external-url').value }),
        });
        await renderModrinthManagement(container);
      } catch (error) {
        err.textContent = error.message;
      }
    });

    $('modrinth-clear')?.addEventListener('click', async () => {
      if (!confirm('Remove the uploaded instance and download URL?')) return;
      const err = $('modrinth-url-error');
      err.textContent = '';
      try {
        await adminFetch('/modrinth-instance', { method: 'DELETE' });
        await renderModrinthManagement(container);
      } catch (error) {
        err.textContent = error.message;
      }
    });
  } catch {
    container.innerHTML = '<p class="table-empty">Could not load Modrinth settings.</p>';
  }
}
