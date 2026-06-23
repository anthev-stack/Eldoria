import express from 'express';
import cors from 'cors';
import cookieSession from 'cookie-session';
import fs from 'fs';
import path from 'path';
import http from 'http';
import { fileURLToPath } from 'url';
import { WebSocketServer } from 'ws';
import { normalizePlayer, SKILL_LABELS, LEVELZ_SKILLS, aggregateEconomy, normalizeEconomyResponse } from './lib/levelz.js';
import { seedContentIfEmpty, seedTitlesIfEmpty, assignDefaultStaffTitles } from './lib/store.js';
import { createAuthRouter } from './routes/auth.js';
import { createPostsRouter, createChatRouter } from './routes/social.js';
import { createDashboardRouter } from './routes/dashboard.js';
import { createStaffRouter, createAdminRouter } from './routes/admin.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

function loadEnvFile() {
  const envPath = path.join(__dirname, '..', '.env');
  if (!fs.existsSync(envPath)) return;
  for (const line of fs.readFileSync(envPath, 'utf8').split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const eq = trimmed.indexOf('=');
    if (eq === -1) continue;
    const key = trimmed.slice(0, eq).trim();
    const value = trimmed.slice(eq + 1).trim();
    if (process.env[key] === undefined) process.env[key] = value;
  }
}

loadEnvFile();

const PORT = Number(process.env.API_PORT) || 3001;
const APP_URL = (process.env.APP_URL || 'http://localhost:5173').replace(/\/$/, '');
const PLAYERS_FILE = process.env.PLAYERS_FILE || path.join(__dirname, 'data', 'players.json');
const MC_HOST = process.env.MC_HOST || '103.15.237.56';
const MC_PORT = Number(process.env.MC_PORT) || 23383;
const MC_JOIN_HOST = process.env.MC_JOIN_HOST || 'eldoriarealm.com';
const SESSION_SECRET = process.env.SESSION_SECRET || 'change-me-in-production';
const DISCORD_CLIENT_ID = process.env.DISCORD_CLIENT_ID || '';
const DISCORD_CLIENT_SECRET = process.env.DISCORD_CLIENT_SECRET || '';
const DISCORD_REDIRECT_URI =
  process.env.DISCORD_REDIRECT_URI || `${APP_URL}/api/auth/discord/callback`;

const BRIDGE_URL = (process.env.BRIDGE_URL || 'http://103.15.237.56:26871').replace(/\/$/, '');
const BRIDGE_API_KEY = process.env.BRIDGE_API_KEY || '';

const SEED_NEWS = [
  {
    date: '2026-06-20',
    title: 'The Rune Age Begins',
    excerpt:
      'Season II launches with new arcane biomes, Viking longhouse templates, and the Great Rune Hunt event.',
    tag: 'event',
  },
  {
    date: '2026-06-12',
    title: 'Dynmap Now Live',
    excerpt: 'Explore Eldoria from your browser — scout territories and plan your next adventure.',
    tag: 'update',
  },
];

const SEED_UPDATES = [
  {
    version: 'v1.2.0',
    date: '2026-06-20',
    changes: ['Added Arcane Wastes biome generation', 'New boss: The Hollow Jarl', 'Balanced rune enchantment costs'],
  },
  {
    version: 'v1.1.0',
    date: '2026-06-10',
    changes: ['Dynmap integration enabled', 'Staff application portal opened'],
  },
];

seedContentIfEmpty(SEED_NEWS, SEED_UPDATES);
seedTitlesIfEmpty();
assignDefaultStaffTitles();

const app = express();
app.use(
  cors({
    origin: APP_URL,
    credentials: true,
  })
);
app.use(express.json());
app.use(
  cookieSession({
    name: 'eldoria_session',
    keys: [SESSION_SECRET],
    maxAge: 30 * 24 * 60 * 60 * 1000,
    httpOnly: true,
    sameSite: 'lax',
    path: '/api',
  })
);

const wsClients = new Set();

function broadcastChat(message) {
  const payload = JSON.stringify({ type: 'chat', message });
  for (const client of wsClients) {
    if (client.readyState === 1) client.send(payload);
  }
}

function loadLocalPlayers() {
  if (!fs.existsSync(PLAYERS_FILE)) {
    return { updatedAt: null, players: [] };
  }
  const raw = JSON.parse(fs.readFileSync(PLAYERS_FILE, 'utf8'));
  return {
    updatedAt: raw.updatedAt ?? null,
    players: (raw.players ?? []).map(normalizePlayer),
  };
}

async function fetchBridge(pathname) {
  if (!BRIDGE_URL) return null;
  const headers = { Accept: 'application/json' };
  if (BRIDGE_API_KEY) headers['X-Api-Key'] = BRIDGE_API_KEY;

  const res = await fetch(`${BRIDGE_URL}${pathname}`, { headers });
  if (!res.ok) throw new Error(`Bridge ${pathname} returned ${res.status}`);
  return res.json();
}

async function getPlayersData() {
  if (BRIDGE_URL) {
    try {
      const remote = await fetchBridge('/api/players');
      if (remote && Array.isArray(remote.players)) {
        return {
          updatedAt: remote.updatedAt ?? null,
          players: remote.players.map(normalizePlayer),
          source: 'bridge',
        };
      }
    } catch (err) {
      console.warn('Bridge unavailable:', err.message);
      return { updatedAt: null, players: [], source: 'bridge-error' };
    }
  }

  return { ...loadLocalPlayers(), source: 'local' };
}

function mcJoinAddress() {
  return MC_JOIN_HOST;
}

async function fetchMcStatus() {
  const url = `https://api.mcstatus.io/v2/status/java/${encodeURIComponent(MC_HOST)}:${MC_PORT}`;
  const res = await fetch(url);
  if (!res.ok) throw new Error('mcstatus failed');
  return res.json();
}

app.get('/api/health', (_req, res) => {
  res.json({
    ok: true,
    bridge: Boolean(BRIDGE_URL),
    discordAuth: Boolean(DISCORD_CLIENT_ID && DISCORD_CLIENT_SECRET),
  });
});

app.get('/api/server', async (_req, res) => {
  const { players, updatedAt, source } = await getPlayersData();
  const economy = aggregateEconomy(players);
  let status = { online: false, players: { online: 0, max: 16 }, version: { name_clean: '—' } };

  try {
    const bridgeServer = await fetchBridge('/api/server');
    if (bridgeServer) {
      return res.json({
        online: bridgeServer.online ?? true,
        livePlayers: bridgeServer.livePlayers ?? 0,
        maxPlayers: bridgeServer.maxPlayers ?? 16,
        version: bridgeServer.version ?? '—',
        totalPlayers: bridgeServer.totalPlayers ?? players.length,
        statsUpdatedAt: bridgeServer.statsUpdatedAt ?? updatedAt,
        economy: normalizeEconomyResponse(bridgeServer.economy) ?? economy,
        address: mcJoinAddress(),
        source: 'bridge',
      });
    }
  } catch {
    /* fall through */
  }

  try {
    status = await fetchMcStatus();
  } catch {
    /* use defaults */
  }

  res.json({
    online: status.online,
    livePlayers: status.players?.online ?? 0,
    maxPlayers: status.players?.max ?? 16,
    version: status.version?.name_clean ?? '—',
    motd: status.motd?.clean ?? '',
    totalPlayers: players.length,
    playersOnlineList: status.players?.list ?? [],
    statsUpdatedAt: updatedAt,
    economy,
    address: mcJoinAddress(),
    source,
  });
});

app.get('/api/players', async (_req, res) => {
  const { players, updatedAt, source } = await getPlayersData();
  res.json({
    updatedAt,
    total: players.length,
    skillLabels: SKILL_LABELS,
    skills: LEVELZ_SKILLS,
    players: players.sort((a, b) => b.levelz.level - a.levelz.level || a.name.localeCompare(b.name)),
    source,
  });
});

app.use(
  '/api/auth',
  createAuthRouter({
    clientId: DISCORD_CLIENT_ID,
    clientSecret: DISCORD_CLIENT_SECRET,
    redirectUri: DISCORD_REDIRECT_URI,
    appUrl: APP_URL,
  })
);
app.use('/api', createPostsRouter());
app.use('/api', createStaffRouter());
app.use('/api/admin', createAdminRouter());
app.use('/api/chat', createChatRouter(broadcastChat));
app.use(
  '/api',
  createDashboardRouter(async () => {
    const { players } = await getPlayersData();
    try {
      const bridgeServer = await fetchBridge('/api/server');
      if (bridgeServer) {
        return {
          online: bridgeServer.online ?? true,
          livePlayers: bridgeServer.livePlayers ?? 0,
          maxPlayers: bridgeServer.maxPlayers ?? 16,
          totalPlayers: bridgeServer.totalPlayers ?? players.length,
        };
      }
    } catch {
      /* fall through */
    }
    try {
      const status = await fetchMcStatus();
      return {
        online: status.online,
        livePlayers: status.players?.online ?? 0,
        maxPlayers: status.players?.max ?? 16,
        totalPlayers: players.length,
      };
    } catch {
      return {
        online: false,
        livePlayers: 0,
        maxPlayers: 16,
        totalPlayers: players.length,
      };
    }
  })
);

const server = http.createServer(app);
const wss = new WebSocketServer({ server, path: '/ws' });

wss.on('connection', (ws) => {
  wsClients.add(ws);
  ws.on('close', () => wsClients.delete(ws));
});

server.listen(PORT, () => {
  console.log(`Eldoria API running on http://localhost:${PORT}`);
  if (BRIDGE_URL) console.log(`Proxying LevelZ stats from ${BRIDGE_URL}`);
  if (DISCORD_CLIENT_ID) console.log(`Discord OAuth redirect: ${DISCORD_REDIRECT_URI}`);
  else console.log('Discord OAuth not configured — set DISCORD_CLIENT_ID and DISCORD_CLIENT_SECRET in .env');
});
