import { initAuth } from './auth.js';
import { initChat } from './chat.js';
import { initLayout } from './layout.js';
import { resolveCurrency, aggregateEconomy, formatGoldNetworth } from './currency.js';

const config = window.ELDORIA_CONFIG;
const CURRENCY_ICON_BASE = '/images/currency';

let allPlayers = [];

function $(id) {
  return document.getElementById(id);
}

function formatDate(dateStr) {
  if (!dateStr) return '—';
  const date = new Date(dateStr);
  return date.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
}

function formatPlaytime(minutes) {
  if (minutes == null || minutes < 0) return '—';
  if (minutes === 0) return '0m';
  if (minutes < 60) return `${minutes}m`;
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return m ? `${h}h ${m}m` : `${h}h`;
}

function formatPlaytimeLong(minutes) {
  if (minutes == null || minutes <= 0) return '—';
  const days = Math.floor(minutes / 1440);
  const hours = Math.floor((minutes % 1440) / 60);
  const mins = minutes % 60;
  const parts = [];
  if (days) parts.push(`${days}d`);
  if (hours) parts.push(`${hours}h`);
  if (mins || !parts.length) parts.push(`${mins}m`);
  return parts.join(' ');
}

function currencyCoinImg(type) {
  return `<img class="currency-coin currency-coin-${type}" src="${CURRENCY_ICON_BASE}/${type}.png" alt="" loading="lazy" decoding="async" />`;
}

function currencyPart(amount, type) {
  return `<span class="currency-part"><span class="currency-amount">${amount}</span>${currencyCoinImg(type)}</span>`;
}

function formatCurrency(currency) {
  const { value, gold, silver, bronze } = resolveCurrency(currency ?? {});
  if (!value) return '—';
  const parts = [];
  if (gold) parts.push(currencyPart(gold, 'gold'));
  if (silver) parts.push(currencyPart(silver, 'silver'));
  if (bronze || !parts.length) parts.push(currencyPart(bronze, 'bronze'));
  return `<span class="currency-display">${parts.join('')}</span>`;
}

function renderCurrencyStack(currency) {
  const { value, gold, silver, bronze } = resolveCurrency(currency ?? {});
  if (!value) return '<span class="currency-stack-empty">—</span>';
  const rows = [
    ['bronze', bronze],
    ['silver', silver],
    ['gold', gold],
  ];
  return `<div class="currency-stack">${rows
    .map(
      ([type, amount]) => `
    <div class="currency-stack-row">
      <span class="currency-stack-val">${amount}</span>
      ${currencyCoinImg(type)}
    </div>`
    )
    .join('')}</div>`;
}

function renderCurrencyRowParts({ gold = 0, silver = 0, bronze = 0 }, order = 'bsg') {
  const orderMap = {
    bsg: [['bronze', bronze], ['silver', silver], ['gold', gold]],
    gsb: [['gold', gold], ['silver', silver], ['bronze', bronze]],
  };
  const parts = orderMap[order] ?? orderMap.bsg;
  if (!gold && !silver && !bronze) return '<span class="currency-stack-empty">—</span>';
  return `<div class="currency-row">${parts.map(([type, amount]) => currencyPart(amount, type)).join('')}</div>`;
}

function renderCurrencyRow(currency) {
  const { value, gold, silver, bronze } = resolveCurrency(currency ?? {});
  if (!value) return '<span class="currency-stack-empty">—</span>';
  const parts = [
    ['bronze', bronze],
    ['silver', silver],
    ['gold', gold],
  ];
  return `<div class="currency-row">${parts.map(([type, amount]) => currencyPart(amount, type)).join('')}</div>`;
}

function getServerAddress() {
  const { host, port } = config.minecraft;
  return port && port !== 25565 ? `${host}:${port}` : host;
}

function getApiBase() {
  return config.api?.baseUrl ?? '/api';
}

function headUrl(name) {
  return `https://mc-heads.net/avatar/${encodeURIComponent(name)}/32`;
}

function initBranding() {
  document.title = `${config.serverName} — Minecraft Server`;
  const brandEl = $('brand-name');
  if (brandEl) {
    brandEl.textContent = config.serverName;
    if (document.body.classList.contains('page-home') && config.serverName === 'Eldoria') {
      brandEl.classList.add('eldoria-word');
    }
  }
  $('hero-title').textContent = config.serverName;
  $('hero-tagline').textContent = config.tagline;
  $('server-address').textContent = getServerAddress();
  $('join-address').textContent = getServerAddress();

  if (document.body.classList.contains('page-home') && config.serverName === 'Eldoria') {
    $('hero-title')?.classList.add('eldoria-word');
  }
}

function initServerInfo() {
  const info = config.serverInfo;
  const body = $('server-info-body');
  const rows = [
    ['Version', info.version],
    ['Mode', info.gamemode],
    ['Difficulty', info.difficulty],
    ['Max Players', info.maxPlayers],
    ['Whitelist', info.whitelist ? 'Yes' : 'Open'],
  ];
  const features = info.features?.length
    ? `<div class="feature-tags">${info.features.map((f) => `<span class="feature-tag">${f}</span>`).join('')}</div>`
    : '';
  body.innerHTML = `
    <ul class="info-list">
      ${rows.map(([k, v]) => `<li><span class="info-key">${k}</span><span class="info-val">${v}</span></li>`).join('')}
    </ul>
    ${features}
  `;
}

function escapeHtml(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function formatHomeText(str) {
  const safe = escapeHtml(str);
  if (!document.body.classList.contains('page-home')) return safe;
  return safe.replace(/Eldoria/g, '<span class="eldoria-word">Eldoria</span>');
}

function initNews() {
  fetchNews();
  window.addEventListener('eldoria:news-updated', fetchNews);
}

function initUpdates() {
  fetchUpdates();
  window.addEventListener('eldoria:updates-updated', fetchUpdates);
}

async function fetchNews() {
  const feed = $('news-feed');
  try {
    const res = await fetch(`${getApiBase()}/news`, { credentials: 'include' });
    if (!res.ok) throw new Error();
    const data = await res.json();
    const items = data.items ?? [];
    if (!items.length) {
      feed.innerHTML = '<p class="feed-empty">No news yet.</p>';
      return;
    }
    feed.innerHTML = items
      .map(
        (item) => `
    <article class="feed-item">
      <div class="feed-meta">
        <time class="feed-date" datetime="${item.date}">${formatDate(item.date)}</time>
        <span class="feed-tag ${item.tag}">${item.tag}</span>
      </div>
      <h3 class="feed-title">${formatHomeText(item.title)}</h3>
      <p class="feed-excerpt">${formatHomeText(item.excerpt)}</p>
    </article>`
      )
      .join('');
  } catch {
    feed.innerHTML = '<p class="feed-empty">Could not load news.</p>';
  }
}

async function fetchUpdates() {
  const feed = $('updates-feed');
  try {
    const res = await fetch(`${getApiBase()}/updates`, { credentials: 'include' });
    if (!res.ok) throw new Error();
    const data = await res.json();
    const items = data.items ?? [];
    if (!items.length) {
      feed.innerHTML = '<p class="feed-empty">No updates yet.</p>';
      return;
    }
    feed.innerHTML = items
      .map(
        (item) => `
    <article class="feed-item">
      <div class="feed-meta">
        <span class="update-version">${escapeHtml(item.version)}</span>
        <time class="feed-date" datetime="${item.date}">${formatDate(item.date)}</time>
      </div>
      <ul class="update-changes">
        ${item.changes.map((c) => `<li>${formatHomeText(c)}</li>`).join('')}
      </ul>
    </article>`
      )
      .join('');
  } catch {
    feed.innerHTML = '<p class="feed-empty">Could not load updates.</p>';
  }
}

function initStaff() {
  fetchStaff();
}

async function fetchStaff() {
  const grid = $('staff-grid');
  try {
    const res = await fetch(`${getApiBase()}/staff`);
    if (!res.ok) throw new Error();
    const data = await res.json();
    const members = data.members ?? [];
    if (!members.length) {
      grid.innerHTML = '<p class="feed-empty">No staff members yet.</p>';
      return;
    }
    grid.innerHTML = members
      .map(
        (m) => `
    <div class="staff-card">
      <div class="staff-avatar">
        <img src="${headUrl(m.name)}" alt="${escapeHtml(m.name)}" width="64" height="64" loading="lazy" />
      </div>
      <div class="staff-name">${escapeHtml(m.name)}</div>
      ${
        m.title
          ? `<span class="staff-title-badge" style="--title-color:${m.titleColor || '#1bd96a'}">${escapeHtml(m.title)}</span>`
          : `<span class="staff-role role-badge role-${m.role}">${escapeHtml(m.roleLabel)}</span>`
      }
      ${m.blurb ? `<p class="staff-motto">"${escapeHtml(m.blurb)}"</p>` : ''}
    </div>`
      )
      .join('');
  } catch {
    grid.innerHTML = '<p class="feed-empty">Could not load staff team.</p>';
  }
}

function getTopSkills(skills, count = 3) {
  return Object.entries(skills)
    .sort((a, b) => b[1] - a[1])
    .slice(0, count);
}

function renderSkillBars(skills, maxLevel = 20) {
  const top = getTopSkills(skills, 3);
  return top
    .map(
      ([name, val]) => `
    <div class="skill-bar-row">
      <span class="skill-bar-label">${name}</span>
      <div class="skill-bar-track">
        <div class="skill-bar-fill" style="width:${Math.min(100, (val / maxLevel) * 100)}%"></div>
      </div>
      <span class="skill-bar-val">${val}</span>
    </div>`
    )
    .join('');
}

function openPlayerModal(player) {
  const modal = $('player-modal');
  const body = $('player-modal-body');
  const skills = Object.entries(player.levelz.skills)
    .sort((a, b) => b[1] - a[1])
    .map(
      ([name, val]) => `
    <div class="modal-skill">
      <span>${name}</span>
      <span>${val}</span>
    </div>`
    )
    .join('');

  body.innerHTML = `
    <div class="modal-player-head">
      <img src="${headUrl(player.name)}" alt="" width="48" height="48" />
      <div>
        <h3>${player.name}${player.online ? ' <span class="player-online" title="Online"></span>' : ''}</h3>
        <p>Level ${player.levelz.level} · ${player.levelz.experience.toLocaleString()} XP · ${formatCurrency(player.currency)} · ${formatPlaytime(player.playtimeMinutes)} played</p>
      </div>
    </div>
    <div class="modal-skills-grid">${skills}</div>
  `;
  modal.showModal();
}

function renderPlayerStats(players, onlineNames = new Set()) {
  const tbody = $('player-stats-body');
  if (!players.length) {
    tbody.innerHTML = `<tr><td colspan="8" class="table-empty">No player data yet. Run the LevelZ sync on your server.</td></tr>`;
    return;
  }

  tbody.innerHTML = players
    .map((p, i) => {
      const online = onlineNames.has(p.name) || p.online;
      return `
    <tr class="${online ? 'online-row' : ''}" data-name="${p.name.toLowerCase()}">
      <td>
        <div class="player-cell">
          <img class="player-avatar" src="${headUrl(p.name)}" alt="" width="32" height="32" loading="lazy" />
          <span class="player-name">${p.name}${online ? '<span class="player-online" title="Online"></span>' : ''}</span>
        </div>
      </td>
      <td><span class="level-badge">${p.levelz.level}</span></td>
      <td>${p.levelz.experience.toLocaleString()}</td>
      <td><div class="skill-bars">${renderSkillBars(p.levelz.skills)}</div></td>
      <td><div class="currency-stack-wrap">${renderCurrencyStack(p.currency)}</div></td>
      <td>${formatPlaytime(p.playtimeMinutes)}</td>
      <td>${formatDate(p.lastSeen)}</td>
      <td><button class="btn-icon" data-player-idx="${i}" title="View all skills">View</button></td>
    </tr>`;
    })
    .join('');

  tbody.querySelectorAll('[data-player-idx]').forEach((btn) => {
    btn.addEventListener('click', () => {
      openPlayerModal(players[Number(btn.dataset.playerIdx)]);
    });
  });
}

function filterPlayers(query) {
  const q = query.toLowerCase().trim();
  const filtered = q ? allPlayers.filter((p) => p.name.toLowerCase().includes(q)) : allPlayers;
  renderPlayerStats(filtered);
}

function economyForDisplay(fallbackEconomy) {
  if (allPlayers.length) return aggregateEconomy(allPlayers);
  if (!fallbackEconomy) return null;
  const converted = resolveCurrency(fallbackEconomy);
  const raw = fallbackEconomy.raw ?? {
    gold: Number(fallbackEconomy.rawGold ?? converted.gold),
    silver: Number(fallbackEconomy.rawSilver ?? converted.silver),
    bronze: Number(fallbackEconomy.rawBronze ?? converted.bronze),
  };
  return {
    raw,
    gold: converted.gold,
    silver: converted.silver,
    bronze: converted.bronze,
    value: converted.value,
    totalValue: converted.totalValue ?? converted.value,
    totalPlaytimeMinutes: fallbackEconomy.totalPlaytimeMinutes ?? 0,
  };
}

function renderServerEconomy(economy, playerCount = 0) {
  if (!economy) return;
  const economyTotal = $('economy-total');
  const economyConverted = $('economy-converted');
  const playtimeTotal = $('playtime-total');
  const playtimePlayers = $('playtime-players');
  if (economyTotal && economy.raw) {
    economyTotal.innerHTML = renderCurrencyRowParts(economy.raw, 'bsg');
  }
  if (economyConverted) {
    const networth = formatGoldNetworth(economy.totalValue ?? economy.value ?? 0);
    economyConverted.innerHTML = `<span class="economy-networth">${currencyPart(networth, 'gold')}</span>`;
  }
  if (playtimeTotal) playtimeTotal.textContent = formatPlaytimeLong(economy.totalPlaytimeMinutes);
  if (playtimePlayers) {
    playtimePlayers.textContent = playerCount
      ? `Across ${playerCount} tracked player${playerCount === 1 ? '' : 's'}`
      : '—';
  }
}

async function fetchServerStats() {
  try {
    const res = await fetch(`${getApiBase()}/server`);
    if (!res.ok) throw new Error();
    const data = await res.json();

    $('live-players').textContent = data.livePlayers ?? '—';
    $('total-players').textContent = data.totalPlayers ?? '—';
    $('max-players').textContent = data.maxPlayers ?? '—';

    const dot = $('connection-dot');
    const statusText = $('status-text');
    dot.classList.toggle('online', data.online);
    dot.classList.toggle('offline', !data.online);
    statusText.textContent = data.online
      ? `${data.livePlayers} player${data.livePlayers !== 1 ? 's' : ''} online`
      : 'Server offline';

    $('footer-status').textContent = data.online
      ? `${data.livePlayers}/${data.maxPlayers} online · ${data.totalPlayers} total players`
      : 'Server offline';

    if (data.statsUpdatedAt) {
      $('stats-updated').textContent = `Updated ${formatDate(data.statsUpdatedAt)}`;
    }

    renderServerEconomy(economyForDisplay(data.economy), data.totalPlayers ?? allPlayers.length);

    const onlineNames = new Set((data.playersOnlineList ?? []).map((p) => p.name_clean ?? p.name));
    renderPlayerStats(allPlayers, onlineNames);
  } catch {
    $('status-text').textContent = 'Could not reach API';
    fetchPlayerCountFallback();
  }
}

async function fetchPlayers() {
  try {
    const res = await fetch(`${getApiBase()}/players`);
    if (!res.ok) throw new Error();
    const data = await res.json();
    allPlayers = data.players ?? [];
    renderPlayerStats(allPlayers);
    renderServerEconomy(aggregateEconomy(allPlayers), allPlayers.length);
    if (data.updatedAt) {
      $('stats-updated').textContent = `Updated ${formatDate(data.updatedAt)}`;
    }
  } catch {
    $('player-stats-body').innerHTML =
      `<tr><td colspan="8" class="table-empty">Could not load player stats. Start the API with <code>npm run api</code>.</td></tr>`;
  }
}

async function fetchPlayerCountFallback() {
  const { host, port } = config.minecraft;
  try {
    const res = await fetch(`https://api.mcstatus.io/v2/status/java/${encodeURIComponent(host)}:${port}`);
    if (!res.ok) throw new Error();
    const data = await res.json();
    $('live-players').textContent = data.online ? data.players.online : '—';
    $('max-players').textContent = data.players?.max ?? '—';
    const dot = $('connection-dot');
    dot.classList.toggle('online', data.online);
    dot.classList.toggle('offline', !data.online);
    $('status-text').textContent = data.online ? `${data.players.online} players online` : 'Server offline';
  } catch {
    /* ignore */
  }
}

function getDynmapUrl(dynmap) {
  const base = dynmap.url.replace(/\/?$/, '/');
  if (dynmap.mode === 'proxy') return '/dynmap/';
  if (dynmap.embedUrl) return dynmap.embedUrl.replace(/\/?$/, '/');
  return base;
}

function initDynmap() {
  const { dynmap } = config;
  const frame = $('map-frame');
  const iframe = $('dynmap-iframe');
  const loader = $('map-loader');
  const loaderText = $('map-loader-text');
  const loadBtn = $('map-load-btn');
  const fallbackLink = $('map-fallback-link');
  const fullscreenLink = $('dynmap-fullscreen');

  if (!dynmap.enabled || !dynmap.url) {
    loaderText.textContent = 'Dynmap not configured';
    loadBtn.hidden = true;
    fullscreenLink.style.display = 'none';
    return;
  }

  const externalUrl = dynmap.url.replace(/\/?$/, '/');
  const embedUrl = getDynmapUrl(dynmap);

  fullscreenLink.href = externalUrl;
  fallbackLink.href = externalUrl;

  let started = false;
  let revealed = false;

  const reveal = () => {
    if (revealed) return;
    revealed = true;
    loader.classList.add('hidden');
  };

  const startLoad = () => {
    if (started) return;
    started = true;
    loadBtn.hidden = true;
    loaderText.textContent = 'Loading map…';

    iframe.addEventListener('load', () => setTimeout(reveal, 400), { once: true });
    iframe.addEventListener('error', () => {
      loaderText.textContent = 'Could not embed map';
      loadBtn.hidden = false;
      loadBtn.textContent = 'Retry';
      started = false;
    }, { once: true });

    iframe.src = embedUrl;

    // Never stay stuck on "Loading" — always reveal the iframe after 2s
    setTimeout(reveal, 2000);
  };

  loadBtn.addEventListener('click', startLoad);

  // Auto-load once the map panel is visible and laid out
  const observer = new IntersectionObserver(
    (entries) => {
      if (entries.some((e) => e.isIntersecting)) {
        observer.disconnect();
        requestAnimationFrame(() => requestAnimationFrame(startLoad));
      }
    },
    { rootMargin: '80px', threshold: 0.01 }
  );
  observer.observe(frame);

  // If already on screen (e.g. wide desktop), load immediately
  requestAnimationFrame(() => {
    const rect = frame.getBoundingClientRect();
    if (rect.top < window.innerHeight && rect.bottom > 0) {
      observer.disconnect();
      requestAnimationFrame(() => requestAnimationFrame(startLoad));
    }
  });
}

function initLinks() {
  const discord = $('footer-discord');
  if (config.discord?.enabled && config.discord.url) {
    discord.href = config.discord.url;
    discord.hidden = false;
  }
}

async function initModrinthLinks() {
  const links = [$('modrinth-link'), $('modrinth-hero-link')].filter(Boolean);
  const fallback = config.modrinth?.url || '#';

  try {
    const res = await fetch(`${getApiBase()}/modrinth`);
    if (!res.ok) throw new Error();
    const data = await res.json();
    const url = data.downloadUrl || fallback;
    const isHostedFile = data.source === 'upload';

    for (const link of links) {
      link.href = url;
      if (isHostedFile) {
        link.setAttribute('download', '');
      } else {
        link.removeAttribute('download');
      }
      if (!data.available && url === '#') {
        link.setAttribute('aria-disabled', 'true');
        link.classList.add('btn-disabled');
      } else {
        link.removeAttribute('aria-disabled');
        link.classList.remove('btn-disabled');
      }
    }
  } catch {
    for (const link of links) {
      link.href = fallback;
      link.removeAttribute('download');
    }
  }
}

function initCopyButtons() {
  const copy = async (text, btn) => {
    try {
      await navigator.clipboard.writeText(text);
      const orig = btn.textContent;
      btn.textContent = 'Copied!';
      setTimeout(() => { btn.textContent = orig; }, 1500);
    } catch {
      btn.textContent = 'Failed';
    }
  };
  $('copy-address').addEventListener('click', () => copy(getServerAddress(), $('copy-address')));
  $('copy-join-address').addEventListener('click', () => copy(getServerAddress(), $('copy-join-address')));
}

function initNav() {
  $('nav-toggle').addEventListener('click', () => {
    document.querySelector('.site-nav').classList.toggle('open');
  });
  $('modal-close').addEventListener('click', () => $('player-modal').close());
  $('player-search').addEventListener('input', (e) => filterPlayers(e.target.value));
}

async function init() {
  initLayout();
  initBranding();
  initServerInfo();
  initNews();
  initUpdates();
  initStaff();
  initDynmap();
  initLinks();
  await initModrinthLinks();
  initCopyButtons();
  initNav();

  await initAuth();
  initChat();

  await fetchPlayers();
  await fetchServerStats();
  setInterval(async () => {
    await fetchPlayers();
    await fetchServerStats();
  }, 30_000);
}

document.addEventListener('DOMContentLoaded', init);
