import { resolveCurrency } from './currency.js';

const CURRENCY_ICON_BASE = '/images/currency';

export function headUrl(name, size = 48) {
  return `https://mc-heads.net/avatar/${encodeURIComponent(name)}/${size}`;
}

export function formatDate(dateStr) {
  if (!dateStr) return '—';
  const date = new Date(dateStr);
  return date.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
}

export function formatPlaytime(minutes) {
  if (minutes == null || minutes < 0) return '—';
  if (minutes === 0) return '0m';
  if (minutes < 60) return `${minutes}m`;
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return m ? `${h}h ${m}m` : `${h}h`;
}

function currencyCoinImg(type) {
  return `<img class="currency-coin currency-coin-${type}" src="${CURRENCY_ICON_BASE}/${type}.png" alt="" loading="lazy" decoding="async" />`;
}

export function renderCurrencyStack(currency) {
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

export function renderPlayerDetailHtml(player) {
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

  const onlineBadge = player.online ? '<span class="player-online" title="Online"></span>' : '';

  return `
    <div class="modal-player-head">
      <img src="${headUrl(player.name, 64)}" alt="" width="64" height="64" />
      <div>
        <h3>${player.name}${onlineBadge}</h3>
        <p>Level ${player.levelz.level} · ${player.levelz.experience.toLocaleString()} XP · ${formatPlaytime(player.playtimeMinutes)} played</p>
      </div>
    </div>
    <div class="settings-player-extra">
      <div class="settings-player-extra-row">
        <span class="settings-player-extra-label">Currency</span>
        <div class="currency-stack-wrap">${renderCurrencyStack(player.currency)}</div>
      </div>
      <div class="settings-player-extra-row">
        <span class="settings-player-extra-label">Last seen</span>
        <span>${formatDate(player.lastSeen)}</span>
      </div>
    </div>
    <h4 class="settings-stats-skills-title">All skills</h4>
    <div class="modal-skills-grid">${skills}</div>
  `;
}
