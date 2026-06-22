import { Router } from 'express';
import crypto from 'crypto';
import {
  getStore,
  addNewsItem,
  addUpdateItem,
  updateNewsItem,
  deleteNewsItem,
  updateUpdateItem,
  deleteUpdateItem,
  addChatMessage,
  getChatMessages,
} from '../lib/store.js';
import { requireAuth, requireModerator } from '../lib/auth.js';

export function createPostsRouter() {
  const router = Router();

  router.get('/news', (_req, res) => {
    const { news } = getStore();
    res.json({ items: [...news].sort((a, b) => new Date(b.date) - new Date(a.date)) });
  });

  router.get('/updates', (_req, res) => {
    const { updates } = getStore();
    res.json({ items: [...updates].sort((a, b) => new Date(b.date) - new Date(a.date)) });
  });

  router.post('/news', requireModerator, (req, res) => {
    const { title, excerpt, tag = 'announcement', date } = req.body ?? {};
    if (!title?.trim() || !excerpt?.trim()) {
      return res.status(400).json({ error: 'Title and excerpt are required.' });
    }
    const item = addNewsItem({
      id: crypto.randomUUID(),
      title: title.trim(),
      excerpt: excerpt.trim(),
      tag: tag.trim() || 'announcement',
      date: date || new Date().toISOString().slice(0, 10),
      authorId: req.user.id,
      authorName: req.user.minecraftUsername,
      createdAt: new Date().toISOString(),
    });
    res.status(201).json({ item });
  });

  router.post('/updates', requireModerator, (req, res) => {
    const { version, changes, date } = req.body ?? {};
    const list = Array.isArray(changes) ? changes.map((c) => String(c).trim()).filter(Boolean) : [];
    if (!version?.trim() || !list.length) {
      return res.status(400).json({ error: 'Version and at least one change are required.' });
    }
    const item = addUpdateItem({
      id: crypto.randomUUID(),
      version: version.trim(),
      changes: list,
      date: date || new Date().toISOString().slice(0, 10),
      authorId: req.user.id,
      authorName: req.user.minecraftUsername,
      createdAt: new Date().toISOString(),
    });
    res.status(201).json({ item });
  });

  router.patch('/news/:id', requireModerator, (req, res) => {
    const { title, excerpt, tag, date } = req.body ?? {};
    if (title !== undefined && !String(title).trim()) {
      return res.status(400).json({ error: 'Title cannot be empty.' });
    }
    if (excerpt !== undefined && !String(excerpt).trim()) {
      return res.status(400).json({ error: 'Excerpt cannot be empty.' });
    }
    const item = updateNewsItem(req.params.id, { title, excerpt, tag, date });
    if (!item) return res.status(404).json({ error: 'News post not found.' });
    res.json({ item });
  });

  router.delete('/news/:id', requireModerator, (req, res) => {
    if (!deleteNewsItem(req.params.id)) {
      return res.status(404).json({ error: 'News post not found.' });
    }
    res.status(204).end();
  });

  router.patch('/updates/:id', requireModerator, (req, res) => {
    const { version, changes, date } = req.body ?? {};
    if (version !== undefined && !String(version).trim()) {
      return res.status(400).json({ error: 'Version cannot be empty.' });
    }
    if (changes !== undefined) {
      const list = Array.isArray(changes) ? changes.map((c) => String(c).trim()).filter(Boolean) : [];
      if (!list.length) {
        return res.status(400).json({ error: 'At least one change is required.' });
      }
    }
    const item = updateUpdateItem(req.params.id, { version, changes, date });
    if (!item) return res.status(404).json({ error: 'Update not found.' });
    res.json({ item });
  });

  router.delete('/updates/:id', requireModerator, (req, res) => {
    if (!deleteUpdateItem(req.params.id)) {
      return res.status(404).json({ error: 'Update not found.' });
    }
    res.status(204).end();
  });

  return router;
}

export function createChatRouter(broadcastChat) {
  const router = Router();

  router.get('/messages', (_req, res) => {
    res.json({ messages: getChatMessages(80) });
  });

  router.post('/messages', requireAuth, (req, res) => {
    if (!req.user.minecraftUsername) {
      return res.status(400).json({ error: 'Set your Minecraft username before chatting.' });
    }
    if (req.user.paused) {
      return res.status(403).json({ error: 'Your account is paused and cannot send chat messages.' });
    }
    const text = String(req.body?.message ?? '').trim();
    if (!text || text.length > 500) {
      return res.status(400).json({ error: 'Message must be 1–500 characters.' });
    }

    const message = {
      id: crypto.randomUUID(),
      userId: req.user.id,
      minecraftUsername: req.user.minecraftUsername,
      role: req.user.role,
      message: text,
      createdAt: new Date().toISOString(),
    };
    addChatMessage(message);
    broadcastChat(message);
    res.status(201).json({ message });
  });

  return router;
}
