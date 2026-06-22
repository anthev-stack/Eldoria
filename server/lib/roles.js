export const ROLES = ['chief', 'admin', 'moderator', 'donator', 'user'];

export const ROLE_LABELS = {
  chief: 'Chief',
  admin: 'Admin',
  moderator: 'Moderator',
  donator: 'Donator',
  user: 'User',
};

const RANK = { chief: 5, admin: 4, moderator: 3, donator: 2, user: 1 };

export function canPost(role) {
  return (RANK[role] ?? 0) >= RANK.moderator;
}

export function canManageRoles(role) {
  return role === 'chief' || role === 'admin';
}

export function roleRank(role) {
  return RANK[role] ?? 0;
}

export function resolveRoleFromMinecraft(username, discordId, env = process.env) {
  const name = username.toLowerCase();
  const chiefNames = (env.CHIEF_MINECRAFT_USERNAMES || 'cmancnt')
    .split(',')
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean);
  const chiefDiscordIds = (env.DISCORD_CHIEF_IDS || '')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);

  if (chiefNames.includes(name) || chiefDiscordIds.includes(discordId)) {
    return 'chief';
  }

  const staffMap = parseStaffMap(env.STAFF_MINECRAFT_ROLES);
  if (staffMap[name]) return staffMap[name];

  return 'user';
}

function parseStaffMap(raw) {
  const map = {};
  if (!raw) {
    map.nelscnt = 'moderator';
    map.glumlow = 'moderator';
    return map;
  }
  for (const part of raw.split(',')) {
    const [user, role] = part.split(':').map((s) => s.trim());
    if (user && role && ROLES.includes(role)) {
      map[user.toLowerCase()] = role;
    }
  }
  return map;
}
