const config = window.ELDORIA_CONFIG;

function $(id) {
  return document.getElementById(id);
}

export function initBranding() {
  const brandEl = $('brand-name');
  if (brandEl) brandEl.textContent = config.serverName;
}

export function initFooterLinks() {
  const discord = $('footer-discord');
  if (config.discord?.enabled && config.discord.url && discord) {
    discord.href = config.discord.url;
    discord.removeAttribute('hidden');
  }
}

export async function initFooterStatus() {
  const el = $('footer-status');
  if (!el) return;
  try {
    const res = await fetch(`${config.api?.baseUrl ?? '/api'}/server`);
    if (!res.ok) throw new Error();
    const data = await res.json();
    el.textContent = data.online
      ? `${data.livePlayers}/${data.maxPlayers} online · ${data.totalPlayers} total players`
      : 'Server offline';
  } catch {
    el.textContent = '—';
  }
}

export function initNavToggle() {
  $('nav-toggle')?.addEventListener('click', () => {
    document.querySelector('.site-nav')?.classList.toggle('open');
  });
}

export function initLayout() {
  initBranding();
  initFooterLinks();
  initNavToggle();
  initFooterStatus();
}
