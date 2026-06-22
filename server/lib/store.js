import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import crypto from 'crypto';
import { ROLE_LABELS, roleRank } from './roles.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const STORE_FILE = process.env.SITE_STORE_FILE || path.join(__dirname, '..', 'data', 'site-store.json');

const DEFAULT_TITLES = [
  { id: 'title-high-king', name: 'High King', color: '#fcd34d' },
  { id: 'title-warlord', name: 'Warlord', color: '#f87171' },
  { id: 'title-mage', name: 'Mage', color: '#a78bfa' },
  { id: 'title-moderator', name: 'Moderator', color: '#60a5fa' },
];

const DEFAULT_STORE = {
  users: {},
  titles: [],
  news: [],
  updates: [],
  chat: [],
  modrinthInstance: null,
};

function readStore() {
  if (!fs.existsSync(STORE_FILE)) {
    return structuredClone({ ...DEFAULT_STORE, titles: DEFAULT_TITLES.map((t) => ({ ...t })) });
  }
  try {
    const data = JSON.parse(fs.readFileSync(STORE_FILE, 'utf8'));
    return {
      ...DEFAULT_STORE,
      ...data,
      titles: data.titles?.length ? data.titles : DEFAULT_TITLES.map((t) => ({ ...t })),
    };
  } catch {
    return structuredClone({ ...DEFAULT_STORE, titles: DEFAULT_TITLES.map((t) => ({ ...t })) });
  }
}

function writeStore(data) {
  fs.mkdirSync(path.dirname(STORE_FILE), { recursive: true });
  fs.writeFileSync(STORE_FILE, JSON.stringify(data, null, 2));
}

export function withStore(mutator) {
  const data = readStore();
  const result = mutator(data);
  writeStore(data);
  return result;
}

export function getStore() {
  return readStore();
}

export function seedTitlesIfEmpty() {
  return withStore((store) => {
    if (!store.titles?.length) {
      store.titles = DEFAULT_TITLES.map((t) => ({ ...t }));
    }
    return store.titles;
  });
}

export function getTitleById(id) {
  if (!id) return null;
  return readStore().titles.find((t) => t.id === id) ?? null;
}

export function listTitles() {
  return readStore().titles;
}

export function createTitle({ name, color }) {
  return withStore((store) => {
    const title = {
      id: crypto.randomUUID(),
      name: name.trim(),
      color,
    };
    store.titles.push(title);
    return title;
  });
}

export function updateTitle(id, { name, color }) {
  return withStore((store) => {
    const title = store.titles.find((t) => t.id === id);
    if (!title) return null;
    if (name !== undefined) title.name = name.trim();
    if (color !== undefined) title.color = color;
    return title;
  });
}

export function deleteTitle(id) {
  return withStore((store) => {
    const idx = store.titles.findIndex((t) => t.id === id);
    if (idx === -1) return false;
    store.titles.splice(idx, 1);
    for (const user of Object.values(store.users)) {
      if (user.titleId === id) user.titleId = null;
    }
    return true;
  });
}

export function findUserByDiscordId(discordId) {
  const store = readStore();
  return Object.values(store.users).find((u) => u.discordId === discordId) ?? null;
}

export function findUserById(id) {
  return readStore().users[id] ?? null;
}

function normalizeUser(user) {
  if (user.paused === undefined) user.paused = false;
  if (user.titleId === undefined) user.titleId = null;
  if (user.staffBlurb === undefined) user.staffBlurb = '';
  return user;
}

export function upsertDiscordUser({ discordId, discordUsername, avatar }) {
  return withStore((store) => {
    let user = Object.values(store.users).find((u) => u.discordId === discordId);
    if (!user) {
      const id = crypto.randomUUID();
      user = normalizeUser({
        id,
        discordId,
        discordUsername,
        discordAvatar: avatar ?? null,
        minecraftUsername: null,
        role: 'user',
        titleId: null,
        staffBlurb: '',
        paused: false,
        createdAt: new Date().toISOString(),
      });
      store.users[id] = user;
    } else {
      normalizeUser(user);
      user.discordUsername = discordUsername;
      user.discordAvatar = avatar ?? user.discordAvatar;
    }
    return user;
  });
}

export function listUsers() {
  return Object.values(readStore().users).map(normalizeUser);
}

export function countUsersByRole() {
  const counts = { chief: 0, admin: 0, moderator: 0, donator: 0, user: 0 };
  for (const user of listUsers()) {
    counts[user.role] = (counts[user.role] ?? 0) + 1;
  }
  return counts;
}

export function setMinecraftUsername(userId, minecraftUsername, autoRole) {
  return withStore((store) => {
    const user = store.users[userId];
    if (!user) return null;
    normalizeUser(user);
    const isFirst = !user.minecraftUsername;
    user.minecraftUsername = minecraftUsername;
    if (isFirst && autoRole) user.role = autoRole;
    return user;
  });
}

export function updateStaffBlurb(userId, blurb) {
  return withStore((store) => {
    const user = store.users[userId];
    if (!user) return null;
    user.staffBlurb = blurb;
    return user;
  });
}

export function updateUserAdmin(userId, { role, titleId, paused }) {
  return withStore((store) => {
    const user = store.users[userId];
    if (!user) return null;
    normalizeUser(user);
    if (role !== undefined) user.role = role;
    if (titleId !== undefined) user.titleId = titleId || null;
    if (paused !== undefined) user.paused = Boolean(paused);
    return user;
  });
}

export function deleteUser(userId) {
  return withStore((store) => {
    if (!store.users[userId]) return false;
    delete store.users[userId];
    return true;
  });
}

export function getStaffMembers() {
  const store = readStore();
  const titleMap = Object.fromEntries(store.titles.map((t) => [t.id, t]));

  return listUsers()
    .filter((u) => u.minecraftUsername && (u.titleId || roleRank(u.role) >= roleRank('moderator')))
    .map((u) => {
      const title = u.titleId ? titleMap[u.titleId] : null;
      return {
        name: u.minecraftUsername,
        title: title?.name ?? null,
        titleColor: title?.color ?? null,
        blurb: u.staffBlurb || '',
        role: u.role,
        roleLabel: ROLE_LABELS[u.role] ?? u.role,
        avatarUrl: `https://mc-heads.net/avatar/${encodeURIComponent(u.minecraftUsername)}/64`,
      };
    })
    .sort((a, b) => roleRank(b.role) - roleRank(a.role) || a.name.localeCompare(b.name));
}

export function addChatMessage(message) {
  return withStore((store) => {
    store.chat.push(message);
    if (store.chat.length > 300) {
      store.chat = store.chat.slice(-300);
    }
    return message;
  });
}

export function getChatMessages(limit = 80) {
  const store = readStore();
  return store.chat.slice(-limit);
}

export function addNewsItem(item) {
  return withStore((store) => {
    store.news.unshift(item);
    return item;
  });
}

export function addUpdateItem(item) {
  return withStore((store) => {
    store.updates.unshift(item);
    return item;
  });
}

export function updateNewsItem(id, patch) {
  return withStore((store) => {
    const item = store.news.find((n) => n.id === id);
    if (!item) return null;
    if (patch.title !== undefined) item.title = String(patch.title).trim();
    if (patch.excerpt !== undefined) item.excerpt = String(patch.excerpt).trim();
    if (patch.tag !== undefined) item.tag = String(patch.tag).trim() || 'announcement';
    if (patch.date !== undefined) item.date = String(patch.date).trim();
    item.updatedAt = new Date().toISOString();
    return item;
  });
}

export function deleteNewsItem(id) {
  return withStore((store) => {
    const idx = store.news.findIndex((n) => n.id === id);
    if (idx === -1) return false;
    store.news.splice(idx, 1);
    return true;
  });
}

export function updateUpdateItem(id, patch) {
  return withStore((store) => {
    const item = store.updates.find((u) => u.id === id);
    if (!item) return null;
    if (patch.version !== undefined) item.version = String(patch.version).trim();
    if (patch.changes !== undefined) {
      item.changes = Array.isArray(patch.changes)
        ? patch.changes.map((c) => String(c).trim()).filter(Boolean)
        : [];
    }
    if (patch.date !== undefined) item.date = String(patch.date).trim();
    item.updatedAt = new Date().toISOString();
    return item;
  });
}

export function deleteUpdateItem(id) {
  return withStore((store) => {
    const idx = store.updates.findIndex((u) => u.id === id);
    if (idx === -1) return false;
    store.updates.splice(idx, 1);
    return true;
  });
}

export function seedContentIfEmpty(seedNews, seedUpdates) {
  return withStore((store) => {
    if (!store.news.length && seedNews?.length) {
      store.news = seedNews.map((item) => ({ ...item, id: crypto.randomUUID() }));
    }
    if (!store.updates.length && seedUpdates?.length) {
      store.updates = seedUpdates.map((item) => ({ ...item, id: crypto.randomUUID() }));
    }
    return store;
  });
}

export function assignDefaultStaffTitles() {
  const defaults = {
    cmancnt: 'title-high-king',
    nelscnt: 'title-warlord',
    glumlow: 'title-moderator',
  };
  return withStore((store) => {
    for (const user of Object.values(store.users)) {
      if (!user.minecraftUsername || user.titleId) continue;
      const key = user.minecraftUsername.toLowerCase();
      if (defaults[key] && store.titles.some((t) => t.id === defaults[key])) {
        user.titleId = defaults[key];
      }
    }
  });
}

export function getModrinthInstanceMeta() {
  return readStore().modrinthInstance ?? null;
}

export function setModrinthFileMeta({ originalName, size, uploadedBy }) {
  return withStore((store) => {
    store.modrinthInstance = {
      ...store.modrinthInstance,
      originalName,
      size,
      uploadedAt: new Date().toISOString(),
      uploadedBy,
      externalUrl: store.modrinthInstance?.externalUrl ?? null,
    };
    return store.modrinthInstance;
  });
}

export function setModrinthExternalUrl(externalUrl, updatedBy) {
  return withStore((store) => {
    store.modrinthInstance = {
      ...store.modrinthInstance,
      externalUrl: externalUrl || null,
      updatedAt: new Date().toISOString(),
      updatedBy,
    };
    return store.modrinthInstance;
  });
}

export function clearModrinthInstance() {
  return withStore((store) => {
    store.modrinthInstance = null;
    return null;
  });
}
