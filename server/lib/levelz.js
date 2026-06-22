/** LevelZ skill keys (1.21.x default skills) */
export const LEVELZ_SKILLS = [
  'constitution',
  'melee',
  'defense',
  'archery',
  'agility',
  'magic',
  'mining',
  'smithing',
  'farming',
  'cooking',
  'bartering',
  'luck',
];

export const SKILL_LABELS = {
  constitution: 'Constitution',
  melee: 'Melee',
  defense: 'Defense',
  archery: 'Archery',
  agility: 'Agility',
  magic: 'Magic',
  mining: 'Mining',
  smithing: 'Smithing',
  farming: 'Farming',
  cooking: 'Cooking',
  bartering: 'Bartering',
  luck: 'Luck',
};

/**
 * Extract LevelZ stats from a parsed player .dat NBT root.
 * LevelZ stores data under several possible keys depending on version.
 */
export function extractLevelzFromNbt(root) {
  const sources = [
    root?.levelz,
    root?.LevelZ,
    root?.levelZ,
    root?.PlayerPersisted?.levelz,
    root?.fabricPlayerData?.levelz,
  ];

  for (const raw of sources) {
    if (!raw || typeof raw !== 'object') continue;

    const skills = {};
    for (const skill of LEVELZ_SKILLS) {
      const val = raw[skill] ?? raw.skills?.[skill];
      if (typeof val === 'number') skills[skill] = val;
    }

    return {
      level: Number(raw.level ?? raw.playerLevel ?? 1),
      points: Number(raw.points ?? raw.skillPoints ?? 0),
      experience: Number(raw.experience ?? raw.xp ?? 0),
      skills,
    };
  }

  return null;
}

export function normalizePlayer(entry) {
  const levelz = entry.levelz ?? { level: 1, points: 0, experience: 0, skills: {} };
  const rawSkills = levelz.skills ?? {};
  const skills = {};
  const currency = entry.currency ?? {};

  for (const skill of LEVELZ_SKILLS) {
    skills[skill] = Number(rawSkills[skill] ?? 0);
  }
  for (const [skill, val] of Object.entries(rawSkills)) {
    if (!(skill in skills)) skills[skill] = Number(val);
  }

  const currencyValue = Number(currency.value ?? 0);

  return {
    uuid: entry.uuid,
    name: entry.name,
    online: Boolean(entry.online),
    firstJoined: entry.firstJoined ?? null,
    lastSeen: entry.lastSeen ?? null,
    playtimeMinutes: Number(entry.playtimeMinutes ?? 0),
    currency: {
      value: currencyValue,
      gold: Number(currency.gold ?? 0),
      silver: Number(currency.silver ?? 0),
      bronze: Number(currency.bronze ?? 0),
    },
    levelz: {
      level: Number(levelz.level ?? 1),
      points: Number(levelz.points ?? 0),
      experience: Number(levelz.experience ?? 0),
      skills,
    },
  };
}

export function splitCurrencyValue(value) {
  const total = Math.max(0, Number(value) || 0);
  const gold = Math.floor(total / 10000);
  const remainder = total % 10000;
  const silver = Math.floor(remainder / 100);
  const bronze = remainder % 100;
  return { value: total, gold, silver, bronze };
}

export function aggregateEconomy(players) {
  const totalValue = players.reduce((sum, player) => sum + (player.currency?.value ?? 0), 0);
  const totalPlaytimeMinutes = players.reduce((sum, player) => sum + (player.playtimeMinutes ?? 0), 0);
  return { ...splitCurrencyValue(totalValue), totalPlaytimeMinutes };
}

export function formatCurrency(currency) {
  if (!currency || !currency.value) return '—';
  const parts = [];
  if (currency.gold) parts.push(`${currency.gold}g`);
  if (currency.silver) parts.push(`${currency.silver}s`);
  if (currency.bronze || !parts.length) parts.push(`${currency.bronze}b`);
  return parts.join(' ');
}
