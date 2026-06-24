import { getUser, onAuthChange, setMinecraftUsername, loginUrl, canPost } from './auth.js';
import { renderPlayerDetailHtml } from './player-stats-ui.js';

const config = window.ELDORIA_CONFIG;

function $(id) {
  return document.getElementById(id);
}

function apiBase() {
  return config.api?.baseUrl ?? '/api';
}

function headUrl(name) {
  return `https://mc-heads.net/avatar/${encodeURIComponent(name)}/64`;
}

function escapeHtml(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

async function fetchOnlineNames() {
  try {
    const res = await fetch(`${apiBase()}/server`);
    if (!res.ok) return new Set();
    const data = await res.json();
    return new Set((data.playersOnlineList ?? []).map((p) => p.name_clean ?? p.name));
  } catch {
    return new Set();
  }
}

async function loadPlayerStats() {
  const panel = $('settings-player-stats');
  const body = $('settings-player-stats-body');
  const user = getUser();
  if (!panel || !body) return;

  if (!user) {
    panel.setAttribute('hidden', '');
    return;
  }

  panel.removeAttribute('hidden');

  const mcName = user.minecraftUsername?.trim();
  if (!mcName) {
    body.innerHTML =
      '<p class="table-empty">Save your Minecraft username to see your LevelZ stats here.</p>';
    return;
  }

  body.innerHTML = '<p class="table-empty">Loading player stats…</p>';

  try {
    const [playersRes, onlineNames] = await Promise.all([
      fetch(`${apiBase()}/players`),
      fetchOnlineNames(),
    ]);
    if (!playersRes.ok) throw new Error();
    const data = await playersRes.json();
    const players = data.players ?? [];
    const player = players.find((p) => p.name.toLowerCase() === mcName.toLowerCase());

    if (!player) {
      body.innerHTML = `<p class="table-empty">No stats found for <strong>${escapeHtml(mcName)}</strong> yet. Join the server once your account has synced.</p>`;
      return;
    }

    body.innerHTML = renderPlayerDetailHtml({
      ...player,
      online: onlineNames.has(player.name) || player.online,
    });
  } catch {
    body.innerHTML = '<p class="table-empty">Could not load player stats.</p>';
  }
}

function renderSettings() {
  const user = getUser();
  const guest = $('settings-guest');
  const formWrap = $('settings-form-wrap');
  if (!guest || !formWrap) return;

  if (!user) {
    guest.removeAttribute('hidden');
    formWrap.setAttribute('hidden', '');
    return;
  }

  guest.setAttribute('hidden', '');
  formWrap.removeAttribute('hidden');

  const mcName = user.minecraftUsername || '';
  $('settings-avatar').src = user.avatarUrl || headUrl('Steve');
  $('settings-display-name').textContent = mcName || user.discordUsername;
  $('settings-discord-name').textContent = user.discordUsername;
  $('settings-mc-username').value = mcName;

  const badge = $('settings-role-badge');
  if (user.title) {
    badge.textContent = user.title;
    badge.className = 'staff-title-badge';
    badge.style.setProperty('--title-color', user.titleColor || '#1bd96a');
    badge.removeAttribute('hidden');
  } else if (user.role && user.role !== 'user') {
    badge.textContent = user.roleLabel;
    badge.className = `role-badge role-${user.role}`;
    badge.removeAttribute('hidden');
  } else {
    badge.setAttribute('hidden', '');
  }

  const staffSection = $('settings-staff-section');
  if (canPost()) {
    staffSection?.removeAttribute('hidden');
    $('settings-staff-blurb').value = user.staffBlurb || '';
  } else {
    staffSection?.setAttribute('hidden', '');
  }

  loadPlayerStats();
}

function handleSetupParam() {
  const params = new URLSearchParams(window.location.search);
  if (params.get('setup') === 'minecraft') {
    $('settings-mc-username')?.focus();
    window.history.replaceState({}, '', window.location.pathname);
  }
}

function initSettingsForm() {
  $('settings-form')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const err = $('settings-error');
    const ok = $('settings-success');
    err.textContent = '';
    ok.setAttribute('hidden', '');

    try {
      await setMinecraftUsername($('settings-mc-username').value.trim());
      ok.removeAttribute('hidden');
      renderSettings();
      setTimeout(() => ok.setAttribute('hidden', ''), 3000);
      if (getUser()?.minecraftUsername && new URLSearchParams(window.location.search).get('setup') === 'minecraft') {
        setTimeout(() => { window.location.href = '/'; }, 800);
      }
    } catch (error) {
      err.textContent = error.message;
    }
  });

  $('staff-blurb-form')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const err = $('staff-blurb-error');
    const ok = $('staff-blurb-success');
    err.textContent = '';
    ok.setAttribute('hidden', '');
    try {
      const res = await fetch(`${apiBase()}/auth/staff-blurb`, {
        method: 'PATCH',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ blurb: $('settings-staff-blurb').value.trim() }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to save');
      ok.removeAttribute('hidden');
      setTimeout(() => ok.setAttribute('hidden', ''), 3000);
    } catch (error) {
      err.textContent = error.message;
    }
  });

  $('settings-login-btn')?.addEventListener('click', () => {
    window.location.href = loginUrl();
  });
}

export function initSettings() {
  renderSettings();
  initSettingsForm();

  onAuthChange(() => {
    renderSettings();
    handleSetupParam();
  });

  handleSetupParam();
}
