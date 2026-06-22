import { Router } from 'express';
import crypto from 'crypto';
import { findUserById, setMinecraftUsername, upsertDiscordUser } from '../lib/store.js';
import { publicUser, requireAuth } from '../lib/auth.js';
import { resolveRoleFromMinecraft } from '../lib/roles.js';
import { updateStaffBlurb } from '../lib/store.js';

const MC_USERNAME_RE = /^[a-zA-Z0-9_]{3,16}$/;

export function createAuthRouter(config) {
  const router = Router();
  const { clientId, clientSecret, redirectUri, appUrl } = config;

  router.get('/discord', (req, res) => {
    if (!clientId || !redirectUri) {
      return res.status(503).send('Discord login is not configured on the server.');
    }
    const state = crypto.randomBytes(16).toString('hex');
    req.session.oauthState = state;
    const params = new URLSearchParams({
      client_id: clientId,
      redirect_uri: redirectUri,
      response_type: 'code',
      scope: 'identify',
      state,
      prompt: 'consent',
    });
    res.redirect(`https://discord.com/api/oauth2/authorize?${params}`);
  });

  router.get('/discord/callback', async (req, res) => {
    try {
      const { code, state } = req.query;
      if (!code || state !== req.session.oauthState) {
        return res.redirect(`${appUrl}/?auth=failed`);
      }
      delete req.session.oauthState;

      const tokenRes = await fetch('https://discord.com/api/oauth2/token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({
          client_id: clientId,
          client_secret: clientSecret,
          grant_type: 'authorization_code',
          code: String(code),
          redirect_uri: redirectUri,
        }),
      });

      if (!tokenRes.ok) {
        return res.redirect(`${appUrl}/?auth=failed`);
      }

      const tokenData = await tokenRes.json();
      const userRes = await fetch('https://discord.com/api/users/@me', {
        headers: { Authorization: `Bearer ${tokenData.access_token}` },
      });
      if (!userRes.ok) {
        return res.redirect(`${appUrl}/?auth=failed`);
      }

      const discordUser = await userRes.json();
      const user = upsertDiscordUser({
        discordId: discordUser.id,
        discordUsername: discordUser.global_name || discordUser.username,
        avatar: discordUser.avatar
          ? `https://cdn.discordapp.com/avatars/${discordUser.id}/${discordUser.avatar}.png`
          : null,
      });

      req.session.userId = user.id;

      if (!user.minecraftUsername) {
        return res.redirect(`${appUrl}/settings.html?setup=minecraft`);
      }
      return res.redirect(`${appUrl}/?auth=success`);
    } catch (err) {
      console.error('Discord callback error:', err);
      return res.redirect(`${appUrl}/?auth=failed`);
    }
  });

  router.get('/me', (req, res) => {
    if (!req.session?.userId) {
      return res.json({ user: null });
    }
    const user = findUserById(req.session.userId);
    res.json({ user: publicUser(user) });
  });

  router.post('/minecraft-username', requireAuth, (req, res) => {
    const username = String(req.body?.username ?? '').trim();
    if (!MC_USERNAME_RE.test(username)) {
      return res.status(400).json({
        error: 'Minecraft username must be 3–16 characters (letters, numbers, underscore).',
      });
    }

    const role = resolveRoleFromMinecraft(username, req.user.discordId);
    const updated = setMinecraftUsername(req.user.id, username, role);
    res.json({ user: publicUser(updated) });
  });

  router.patch('/staff-blurb', requireAuth, (req, res) => {
    const rank = { chief: 5, admin: 4, moderator: 3 };
    if ((rank[req.user.role] ?? 0) < 3) {
      return res.status(403).json({ error: 'Staff access required' });
    }
    const blurb = String(req.body?.blurb ?? '').trim().slice(0, 200);
    const updated = updateStaffBlurb(req.user.id, blurb);
    res.json({ user: publicUser(updated) });
  });

  router.post('/logout', (req, res) => {
    req.session = null;
    res.json({ ok: true });
  });

  return router;
}
