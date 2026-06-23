// ─── Eldoria Server Configuration ───────────────────────────────────────────
// Edit these values to match your server setup.

window.ELDORIA_CONFIG = {
  serverName: 'Eldoria',
  tagline: 'An open-world Adventure — Level, Explore, Conquer',

  // Player-facing join address (what appears on the site)
  minecraft: {
    host: 'eldoriarealm.com',
    port: 23383,
    // Shockbyte IP — used only for client-side status fallback; API uses .env on the server
    statusHost: '103.15.237.56',
  },

  // Website API — in dev, Vite proxies /api → localhost:3001
  // Set BRIDGE_URL on the API server to pull live stats from the Shockbyte mod
  api: {
    baseUrl: '/api',
  },

  // Eldoria Bridge mod on your Shockbyte server (Fabric + LevelZ)
  // The website API proxies to this — do NOT put your API key here (it is public)
  bridge: {
    url: 'http://103.15.237.56:26871',
    enabled: true,
  },

  dynmap: {
    url: 'http://103.15.237.56:29165/',
    enabled: true,
    // 'proxy' = /dynmap/ via Caddy (required for HTTPS site)
    mode: 'proxy',
  },

  // Modrinth modpack — "Join Now" button destination
  modrinth: {
    url: 'https://modrinth.com/modpack/eldoria',
    label: 'Get the Modpack on Modrinth',
  },

  // Discord invite (optional)
  discord: {
    url: 'https://discord.gg/eldoria',
    enabled: true,
  },

  staff: [
    {
      name: 'cmancnt',
      role: 'High King',
      roleClass: 'role-king',
    },
    {
      name: 'nelscnt',
      role: 'Warlord',
      roleClass: 'role-warrior',
    },
    {
      name: 'glumlow',
      role: 'Moderator',
      roleClass: 'role-mod',
    },
  ],

  news: [
    {
      date: '2026-06-20',
      title: 'The Rune Age Begins',
      excerpt:
        'Season II launches with new arcane biomes, Viking longhouse templates, and the Great Rune Hunt event. Log in this weekend for exclusive starter kits.',
      tag: 'event',
    },
    {
      date: '2026-06-12',
      title: 'Dynmap Now Live',
      excerpt:
        'Explore Eldoria from your browser. Our live world map is online — scout territories, find allies, and plan your next raid.',
      tag: 'update',
    },
    {
      date: '2026-06-01',
      title: 'Welcome, Wanderers',
      excerpt:
        'Eldoria opens its gates. A modded survival realm where mages weave fate and warriors carve kingdoms from the wild.',
      tag: 'announcement',
    },
  ],

  updates: [
    {
      version: 'v1.2.0',
      date: '2026-06-20',
      changes: [
        'Added Arcane Wastes biome generation',
        'New boss: The Hollow Jarl',
        'Balanced rune enchantment costs',
        'Fixed longship collision on rivers',
      ],
    },
    {
      version: 'v1.1.0',
      date: '2026-06-10',
      changes: [
        'Dynmap integration enabled',
        'Staff application portal opened',
        'Performance improvements for large builds',
      ],
    },
    {
      version: 'v1.0.0',
      date: '2026-06-01',
      changes: [
        'Initial release — Eldoria goes live',
        'Core modpack published on Modrinth',
        'Spawn citadel and starter quests',
      ],
    },
  ],

  serverInfo: {
    version: '1.21.1',
    gamemode: 'Survival',
    difficulty: 'Hard',
    maxPlayers: 16,
    whitelist: false,
    features: [],
  },
};
