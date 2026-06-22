const config = window.ELDORIA_CONFIG;

let currentUser = null;
const listeners = new Set();

function apiBase() {
  return config.api?.baseUrl ?? '/api';
}

function headUrl(name) {
  return `https://mc-heads.net/avatar/${encodeURIComponent(name)}/32`;
}

export function getUser() {
  return currentUser;
}

export function canPost() {
  return ['chief', 'admin', 'moderator'].includes(currentUser?.role);
}

export function canAccessDashboard() {
  return canPost();
}

export function isChief() {
  return currentUser?.role === 'chief';
}

export function canManageUsers() {
  return currentUser?.role === 'chief' || currentUser?.role === 'admin';
}

export function onAuthChange(fn) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

function notify() {
  for (const fn of listeners) fn(currentUser);
  window.dispatchEvent(new CustomEvent('eldoria:auth-changed', { detail: currentUser }));
}

async function apiFetch(path, options = {}) {
  const res = await fetch(`${apiBase()}${path}`, {
    credentials: 'include',
    headers: { 'Content-Type': 'application/json', ...options.headers },
    ...options,
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || 'Request failed');
  return data;
}

export async function refreshUser() {
  try {
    const data = await apiFetch('/auth/me');
    currentUser = data.user;
  } catch {
    currentUser = null;
  }
  notify();
  return currentUser;
}

export function loginUrl() {
  return `${apiBase()}/auth/discord`;
}

export async function logout() {
  await apiFetch('/auth/logout', { method: 'POST' });
  currentUser = null;
  notify();
}

export async function setMinecraftUsername(username) {
  const data = await apiFetch('/auth/minecraft-username', {
    method: 'POST',
    body: JSON.stringify({ username }),
  });
  currentUser = data.user;
  notify();
  return currentUser;
}

function $(id) {
  return document.getElementById(id);
}

function setAuthPanel(el, visible) {
  if (!el) return;
  if (visible) {
    el.removeAttribute('hidden');
  } else {
    el.setAttribute('hidden', '');
  }
}

function renderAuthNav() {
  const guest = $('auth-guest');
  const userBar = $('auth-user');
  if (!guest || !userBar) return;

  if (!currentUser) {
    setAuthPanel(guest, true);
    setAuthPanel(userBar, false);
    return;
  }

  setAuthPanel(guest, false);
  setAuthPanel(userBar, true);
  $('auth-avatar').src = currentUser.avatarUrl || headUrl('Steve');
  $('auth-avatar').alt = currentUser.minecraftUsername || currentUser.discordUsername;
  $('auth-username').textContent = currentUser.minecraftUsername || currentUser.discordUsername;
  if (currentUser.role && currentUser.role !== 'user') {
    $('auth-role').textContent = currentUser.roleLabel;
    $('auth-role').className = `auth-role role-badge role-${currentUser.role}`;
    $('auth-role').hidden = false;
  } else {
    $('auth-role').hidden = true;
  }
}

function toggleStaffNav() {
  const link = $('nav-dashboard');
  if (!link) return;
  if (canPost()) link.removeAttribute('hidden');
  else link.setAttribute('hidden', '');
}

function openSettingsPage() {
  window.location.href = '/settings.html';
}

function handleQueryParams() {
  const params = new URLSearchParams(window.location.search);
  if (params.has('auth')) {
    window.history.replaceState({}, '', window.location.pathname + window.location.hash);
  }
}

function initAuthButtons() {
  $('btn-create-account')?.addEventListener('click', () => {
    window.location.href = loginUrl();
  });
  $('btn-login')?.addEventListener('click', () => {
    window.location.href = loginUrl();
  });
  $('btn-logout')?.addEventListener('click', async () => {
    await logout();
  });
  $('auth-username-btn')?.addEventListener('click', () => {
    openSettingsPage();
  });
}

export async function initAuth() {
  renderAuthNav();
  initAuthButtons();

  onAuthChange(() => {
    renderAuthNav();
    toggleStaffNav();
    if (currentUser?.needsMinecraftUsername && !window.location.pathname.includes('settings')) {
      openSettingsPage();
    }
  });

  await refreshUser();
  handleQueryParams();
  toggleStaffNav();
  if (currentUser?.needsMinecraftUsername && !window.location.pathname.includes('settings')) {
    openSettingsPage();
  }
}
