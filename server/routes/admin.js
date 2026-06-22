import { Router } from 'express';
import express from 'express';
import {
  listUsers,
  listTitles,
  getStaffMembers,
  createTitle,
  updateTitle,
  deleteTitle,
  updateUserAdmin,
  deleteUser,
  findUserById,
  getModrinthInstanceMeta,
  setModrinthFileMeta,
  setModrinthExternalUrl,
  clearModrinthInstance,
} from '../lib/store.js';
import { publicUserListEntry, requireAdmin, requireChief } from '../lib/auth.js';
import { ROLES } from '../lib/roles.js';
import {
  deleteModrinthFile,
  getPublicModrinthInfo,
  isAllowedModrinthFilename,
  modrinthFileExists,
  MODRINTH_STORED_FILE,
  saveModrinthFile,
} from '../lib/modrinth.js';

const COLOR_RE = /^#[0-9A-Fa-f]{6}$/;
const uploadParser = express.raw({ limit: '150mb', type: 'application/octet-stream' });

function parseExternalUrl(url) {
  const value = String(url ?? '').trim();
  if (!value) return null;
  try {
    const parsed = new URL(value);
    if (!['http:', 'https:'].includes(parsed.protocol)) return null;
    return parsed.toString();
  } catch {
    return null;
  }
}

function formatBytes(bytes) {
  if (!bytes) return '—';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}
function parseColor(color) {
  const c = String(color ?? '').trim();
  return COLOR_RE.test(c) ? c : null;
}

export function createStaffRouter() {
  const router = Router();

  router.get('/staff', (_req, res) => {
    res.json({ members: getStaffMembers() });
  });

  router.get('/titles', (_req, res) => {
    res.json({ titles: listTitles() });
  });

  router.get('/modrinth', (_req, res) => {
    res.json(getPublicModrinthInfo());
  });

  router.get('/modrinth/download', (req, res) => {
    if (!modrinthFileExists()) {
      return res.status(404).json({ error: 'No Modrinth instance file available.' });
    }
    const meta = getModrinthInstanceMeta();
    const filename = meta?.originalName ?? 'eldoria-instance.mrpack';
    res.download(MODRINTH_STORED_FILE, filename);
  });

  return router;
}

export function createAdminRouter() {
  const router = Router();

  router.get('/users', requireAdmin, (_req, res) => {
    const users = listUsers()
      .map(publicUserListEntry)
      .sort((a, b) => (a.minecraftUsername ?? a.discordUsername ?? '').localeCompare(b.minecraftUsername ?? b.discordUsername ?? ''));
    res.json({ users, titles: listTitles() });
  });

  router.patch('/users/:id', requireAdmin, (req, res) => {
    const target = findUserById(req.params.id);
    if (!target) return res.status(404).json({ error: 'User not found' });

    const isChief = req.user.role === 'chief';
    const { role, titleId, paused } = req.body ?? {};

    if (role !== undefined && !isChief) {
      return res.status(403).json({ error: 'Only Chief can change roles' });
    }
    if (titleId !== undefined && !isChief) {
      return res.status(403).json({ error: 'Only Chief can assign titles' });
    }
    if (role !== undefined && !ROLES.includes(role)) {
      return res.status(400).json({ error: 'Invalid role' });
    }
    if (titleId && !listTitles().some((t) => t.id === titleId)) {
      return res.status(400).json({ error: 'Invalid title' });
    }
    if (target.id === req.user.id && paused === true) {
      return res.status(400).json({ error: 'You cannot pause your own account' });
    }
    if (target.id === req.user.id && role && role !== req.user.role) {
      return res.status(400).json({ error: 'You cannot change your own role' });
    }
    if (target.role === 'chief' && req.user.role !== 'chief') {
      return res.status(403).json({ error: 'Cannot modify Chief accounts' });
    }

    const updated = updateUserAdmin(target.id, {
      role: isChief ? role : undefined,
      titleId: isChief ? (titleId === '' ? null : titleId) : undefined,
      paused,
    });
    res.json({ user: publicUserListEntry(updated) });
  });

  router.delete('/users/:id', requireAdmin, (req, res) => {
    const target = findUserById(req.params.id);
    if (!target) return res.status(404).json({ error: 'User not found' });
    if (target.id === req.user.id) {
      return res.status(400).json({ error: 'You cannot delete your own account' });
    }
    if (target.role === 'chief' && req.user.role !== 'chief') {
      return res.status(403).json({ error: 'Cannot delete Chief accounts' });
    }
    deleteUser(target.id);
    res.json({ ok: true });
  });

  router.post('/titles', requireChief, (req, res) => {
    const name = String(req.body?.name ?? '').trim();
    const color = parseColor(req.body?.color);
    if (!name || name.length > 40) {
      return res.status(400).json({ error: 'Title name is required (max 40 chars)' });
    }
    if (!color) return res.status(400).json({ error: 'Valid hex color required (e.g. #fcd34d)' });
    const title = createTitle({ name, color });
    res.status(201).json({ title });
  });

  router.patch('/titles/:id', requireChief, (req, res) => {
    const name = req.body?.name !== undefined ? String(req.body.name).trim() : undefined;
    const color = req.body?.color !== undefined ? parseColor(req.body.color) : undefined;
    if (name !== undefined && !name) {
      return res.status(400).json({ error: 'Title name cannot be empty' });
    }
    if (req.body?.color !== undefined && !color) {
      return res.status(400).json({ error: 'Valid hex color required' });
    }
    const title = updateTitle(req.params.id, { name, color });
    if (!title) return res.status(404).json({ error: 'Title not found' });
    res.json({ title });
  });

  router.delete('/titles/:id', requireChief, (req, res) => {
    if (!deleteTitle(req.params.id)) {
      return res.status(404).json({ error: 'Title not found' });
    }
    res.json({ ok: true });
  });

  router.get('/modrinth-instance', requireChief, (_req, res) => {
    const meta = getModrinthInstanceMeta();
    res.json({
      meta,
      hasFile: modrinthFileExists(),
      public: getPublicModrinthInfo(),
      fileSizeLabel: formatBytes(meta?.size),
    });
  });

  router.post('/modrinth-instance/file', requireChief, uploadParser, (req, res) => {
    const originalName = String(req.headers['x-filename'] ?? 'eldoria-instance.mrpack');
    if (!isAllowedModrinthFilename(originalName)) {
      return res.status(400).json({ error: 'File must be a .mrpack or .zip Modrinth instance.' });
    }
    if (!req.body?.length) {
      return res.status(400).json({ error: 'No file uploaded.' });
    }

    try {
      saveModrinthFile(req.body);
      const meta = setModrinthFileMeta({
        originalName,
        size: req.body.length,
        uploadedBy: req.user.id,
      });
      res.status(201).json({ meta, public: getPublicModrinthInfo() });
    } catch (err) {
      console.error('Modrinth upload error:', err);
      res.status(500).json({ error: 'Could not save instance file.' });
    }
  });

  router.patch('/modrinth-instance', requireChief, (req, res) => {
    const externalUrl = parseExternalUrl(req.body?.externalUrl);
    if (req.body?.externalUrl && !externalUrl) {
      return res.status(400).json({ error: 'Enter a valid http(s) URL.' });
    }
    const meta = setModrinthExternalUrl(externalUrl, req.user.id);
    res.json({ meta, public: getPublicModrinthInfo() });
  });

  router.delete('/modrinth-instance', requireChief, (_req, res) => {
    deleteModrinthFile();
    clearModrinthInstance();
    res.json({ ok: true, public: getPublicModrinthInfo() });
  });

  return router;
}
