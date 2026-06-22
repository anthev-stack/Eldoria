# Eldoria Bridge (Fabric Mod)

A **Fabric mod** (not a Paper plugin) that exposes live **LevelZ** player stats over HTTP for the Eldoria website. Designed for [Shockbyte](https://shockbyte.com) and other hosts where you cannot run file-sync scripts.

## Requirements

- Minecraft **1.21.1** Fabric server
- [LevelZ](https://modrinth.com/mod/levelz) installed
- [Fabric API](https://modrinth.com/mod/fabric-api)
- An **extra port** opened in Shockbyte (e.g. `26871`)

## Install

1. Build the mod (see below) or download the JAR from releases
2. Upload `eldoria-bridge-1.0.0.jar` to your server's `mods/` folder
3. Restart the server
4. Edit `config/eldoria-bridge.json` (created on first start)
5. Open the configured port in Shockbyte → **Ports** → add TCP port

## Config (`config/eldoria-bridge.json`)

```json
{
  "port": 26871,
  "apiKey": "your-secret-key-here",
  "allowedOrigin": "*",
  "syncIntervalSeconds": 30,
  "requireApiKey": true
}
```

| Setting | Description |
|---------|-------------|
| `port` | HTTP port the mod listens on (use your Shockbyte extra port) |
| `apiKey` | Secret key — required in `X-Api-Key` header |
| `allowedOrigin` | CORS origin (`*` or your website URL) |
| `syncIntervalSeconds` | How often to refresh player stats |
| `requireApiKey` | Set `false` only for testing |

## API endpoints

| Endpoint | Description |
|----------|-------------|
| `GET /api/health` | Health check |
| `GET /api/players` | All players + LevelZ skills |
| `GET /api/server` | Online count, player base, version |

Example:

```bash
curl -H "X-Api-Key: your-secret-key-here" http://103.15.237.56:26871/api/players
```

## Connect to your website

On whatever runs your website API (`npm run api`), set environment variables:

```bash
BRIDGE_URL=http://103.15.237.56:26871
BRIDGE_API_KEY=your-secret-key-here
```

The website API proxies bridge data to the frontend — your API key stays on the server, not in the public website.

## Build from source

Requires **Java 21** and an internet connection:

```bash
cd eldoria-bridge
./gradlew build
```

JAR output: `build/libs/eldoria-bridge-1.0.0.jar`

On Windows:

```powershell
cd eldoria-bridge
gradlew.bat build
```

## How it works

- Reads **live LevelZ data** from online players via LevelZ's `LevelManager`
- Scans `world/playerdata/*.dat` for offline players' saved skills
- Tracks every player who has ever had save data (player base count)
- Saves a registry to `config/eldoria-bridge-players.json`
- Runs a lightweight HTTP server on your chosen port

## Shockbyte notes

1. Go to **Shockbyte Panel → Ports** and allocate a port (e.g. `26871`)
2. Set that port in `eldoria-bridge.json`
3. Use your server IP + port in `BRIDGE_URL`
4. If the website is on HTTPS, use the Node API proxy (browsers block HTTP iframes/fetch from HTTPS pages)

## Troubleshooting

- **401 Unauthorized** — Check `X-Api-Key` header matches config
- **Connection refused** — Port not open in Shockbyte firewall
- **Empty players** — Wait for sync interval or have players join once
- **Mod won't load** — Ensure LevelZ and Fabric API are installed for 1.21.1
