import { findUserById, getStore } from './store.js';
import { ROLE_LABELS } from './roles.js';

export function publicUser(user) {
  if (!user) return null;
  const title = user.titleId ? getStore().titles.find((t) => t.id === user.titleId) : null;
  return {
    id: user.id,
    discordUsername: user.discordUsername,
    minecraftUsername: user.minecraftUsername,
    role: user.role,
    roleLabel: ROLE_LABELS[user.role] ?? user.role,
    titleId: user.titleId ?? null,
    title: title?.name ?? null,
    titleColor: title?.color ?? null,
    staffBlurb: user.staffBlurb ?? '',
    paused: Boolean(user.paused),
    needsMinecraftUsername: !user.minecraftUsername,
    avatarUrl: user.minecraftUsername
      ? `https://mc-heads.net/avatar/${encodeURIComponent(user.minecraftUsername)}/32`
      : null,
  };
}

export function publicUserListEntry(user) {
  const title = user.titleId ? getStore().titles.find((t) => t.id === user.titleId) : null;
  return {
    id: user.id,
    discordUsername: user.discordUsername,
    minecraftUsername: user.minecraftUsername,
    role: user.role,
    roleLabel: ROLE_LABELS[user.role] ?? user.role,
    titleId: user.titleId ?? null,
    title: title?.name ?? null,
    titleColor: title?.color ?? null,
    paused: Boolean(user.paused),
    createdAt: user.createdAt,
    avatarUrl: user.minecraftUsername
      ? `https://mc-heads.net/avatar/${encodeURIComponent(user.minecraftUsername)}/32`
      : null,
  };
}

export function requireAuth(req, res, next) {
  if (!req.session?.userId) {
    return res.status(401).json({ error: 'Not authenticated' });
  }
  const user = findUserById(req.session.userId);
  if (!user) {
    req.session = null;
    return res.status(401).json({ error: 'Not authenticated' });
  }
  req.user = user;
  next();
}

export function requireModerator(req, res, next) {
  requireAuth(req, res, () => {
    const rank = { chief: 5, admin: 4, moderator: 3 };
    if ((rank[req.user.role] ?? 0) < 3) {
      return res.status(403).json({ error: 'Moderator access required' });
    }
    next();
  });
}

export function requireAdmin(req, res, next) {
  requireAuth(req, res, () => {
    if (req.user.role !== 'chief' && req.user.role !== 'admin') {
      return res.status(403).json({ error: 'Admin access required' });
    }
    next();
  });
}

export function requireChief(req, res, next) {
  requireAuth(req, res, () => {
    if (req.user.role !== 'chief') {
      return res.status(403).json({ error: 'Chief access required' });
    }
    next();
  });
}

export function parseCookies(header) {
  const cookies = {};
  if (!header) return cookies;
  for (const part of header.split(';')) {
    const [key, ...rest] = part.trim().split('=');
    if (key) cookies[key] = decodeURIComponent(rest.join('='));
  }
  return cookies;
}
