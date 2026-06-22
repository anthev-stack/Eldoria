import { Router } from 'express';
import { getStore, listUsers, countUsersByRole } from '../lib/store.js';
import { requireModerator } from '../lib/auth.js';
import { ROLE_LABELS } from '../lib/roles.js';

export function createDashboardRouter(getServerSnapshot) {
  const router = Router();

  router.get('/dashboard', requireModerator, async (_req, res) => {
    const store = getStore();
    const users = listUsers();
    const roleCounts = countUsersByRole();
    const staff = users
      .filter((u) => ['chief', 'admin', 'moderator'].includes(u.role))
      .map((u) => ({
        minecraftUsername: u.minecraftUsername,
        discordUsername: u.discordUsername,
        role: u.role,
        roleLabel: ROLE_LABELS[u.role],
        avatarUrl: u.minecraftUsername
          ? `https://mc-heads.net/avatar/${encodeURIComponent(u.minecraftUsername)}/32`
          : null,
      }))
      .sort((a, b) => (a.minecraftUsername ?? '').localeCompare(b.minecraftUsername ?? ''));

    let server = { online: false, livePlayers: 0, maxPlayers: 16, totalPlayers: 0 };
    try {
      server = await getServerSnapshot();
    } catch {
      /* use defaults */
    }

    res.json({
      server,
      registeredUsers: users.length,
      roleCounts,
      staffMembers: staff,
      newsCount: store.news.length,
      updatesCount: store.updates.length,
      chatMessages: store.chat.length,
    });
  });

  return router;
}
