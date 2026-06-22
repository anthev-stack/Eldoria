/**
 * Sync player + LevelZ stats from your Minecraft server world folder.
 *
 * Usage:
 *   WORLD_PATH=/path/to/world node server/sync-levelz.js
 *
 * Reads world/playerdata/*.dat for LevelZ NBT and world/stats/*.json for names/playtime.
 * Writes server/data/players.json for the website API.
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import nbt from 'prismarine-nbt';
import { extractLevelzFromNbt, normalizePlayer } from './lib/levelz.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const WORLD_PATH = process.env.WORLD_PATH;
const USERCACHE_PATH = process.env.USERCACHE_PATH;
const OUTPUT = path.join(__dirname, 'data', 'players.json');

if (!WORLD_PATH) {
  console.error('Set WORLD_PATH to your Minecraft world folder (contains playerdata/ and stats/).');
  process.exit(1);
}

const playerdataDir = path.join(WORLD_PATH, 'playerdata');
const statsDir = path.join(WORLD_PATH, 'stats');

function loadNameMap() {
  const map = new Map();

  if (USERCACHE_PATH && fs.existsSync(USERCACHE_PATH)) {
    const cache = JSON.parse(fs.readFileSync(USERCACHE_PATH, 'utf8'));
    for (const entry of cache) {
      map.set(entry.uuid.replace(/-/g, ''), entry.name);
      map.set(entry.uuid, entry.name);
    }
  }

  if (fs.existsSync(statsDir)) {
    for (const file of fs.readdirSync(statsDir)) {
      if (!file.endsWith('.json')) continue;
      const uuid = file.replace('.json', '');
      try {
        const stats = JSON.parse(fs.readFileSync(path.join(statsDir, file), 'utf8'));
        const name = stats?.stats?.['minecraft:custom']?.['minecraft:player_name'];
        if (name) map.set(uuid, name);
      } catch {
        /* skip malformed */
      }
    }
  }

  return map;
}

function playtimeFromStats(uuid) {
  const statsFile = path.join(statsDir, `${uuid}.json`);
  if (!fs.existsSync(statsFile)) return 0;
  try {
    const stats = JSON.parse(fs.readFileSync(statsFile, 'utf8'));
    const ticks = stats?.stats?.['minecraft:custom']?.['minecraft:play_time'] ?? 0;
    return Math.floor(ticks / 20 / 60);
  } catch {
    return 0;
  }
}

async function parsePlayerDat(filePath) {
  const buffer = fs.readFileSync(filePath);
  const { parsed } = await nbt.parse(buffer);
  return nbt.simplify(parsed);
}

async function main() {
  const names = loadNameMap();
  const players = [];

  if (!fs.existsSync(playerdataDir)) {
    console.error(`No playerdata folder at ${playerdataDir}`);
    process.exit(1);
  }

  for (const file of fs.readdirSync(playerdataDir)) {
    if (!file.endsWith('.dat')) continue;
    const uuid = file.replace('.dat', '');
    const dashedUuid = `${uuid.slice(0, 8)}-${uuid.slice(8, 12)}-${uuid.slice(12, 16)}-${uuid.slice(16, 20)}-${uuid.slice(20)}`;

    try {
      const root = await parsePlayerDat(path.join(playerdataDir, file));
      const levelz = extractLevelzFromNbt(root);
      const stat = fs.statSync(path.join(playerdataDir, file));

      players.push(
        normalizePlayer({
          uuid: dashedUuid,
          name: names.get(uuid) ?? names.get(dashedUuid) ?? `Player_${uuid.slice(0, 8)}`,
          firstJoined: stat.birthtime.toISOString(),
          lastSeen: stat.mtime.toISOString(),
          playtimeMinutes: playtimeFromStats(uuid),
          levelz: levelz ?? { level: 1, points: 0, experience: 0, skills: {} },
        })
      );
    } catch (err) {
      console.warn(`Skipped ${file}:`, err.message);
    }
  }

  players.sort((a, b) => b.levelz.level - a.levelz.level || a.name.localeCompare(b.name));

  const output = {
    updatedAt: new Date().toISOString(),
    players,
  };

  fs.mkdirSync(path.dirname(OUTPUT), { recursive: true });
  fs.writeFileSync(OUTPUT, JSON.stringify(output, null, 2));
  console.log(`Synced ${players.length} players → ${OUTPUT}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
