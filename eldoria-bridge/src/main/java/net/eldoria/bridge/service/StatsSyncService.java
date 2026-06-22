package net.eldoria.bridge.service;

import net.eldoria.bridge.EldoriaBridgeMod;
import net.eldoria.bridge.data.PlayerRecord;
import net.eldoria.bridge.data.PlayerRegistry;
import net.eldoria.bridge.util.LevelzReader;
import net.eldoria.bridge.util.NumismaticReader;
import net.eldoria.bridge.util.PlaytimeReader;
import net.fabricmc.fabric.api.networking.v1.ServerPlayConnectionEvents;
import net.minecraft.server.MinecraftServer;
import net.minecraft.server.network.ServerPlayerEntity;

import java.io.File;
import java.nio.file.Path;
import java.util.HashSet;
import java.util.Set;
import java.util.UUID;

public class StatsSyncService {
    private final MinecraftServer server;
    private final PlayerRegistry registry;
    private Thread syncThread;

    public StatsSyncService(MinecraftServer server, PlayerRegistry registry) {
        this.server = server;
        this.registry = registry;
    }

    public void start() {
        ServerPlayConnectionEvents.JOIN.register((handler, sender, server) -> {
            ServerPlayerEntity player = handler.player;
            server.execute(() -> updateOnlinePlayer(player));
        });

        ServerPlayConnectionEvents.DISCONNECT.register((handler, server) -> {
            ServerPlayerEntity player = handler.player;
            server.execute(() -> {
                PlayerRecord record = registry.getOrCreate(player.getUuid(), player.getGameProfile().getName());
                record.online = false;
                applyLevelz(record, LevelzReader.fromPlayer(player));
                applyPlaytime(record, player);
                applyCurrency(record, NumismaticReader.fromPlayer(player));
                registry.put(record);
                registry.save();
            });
        });

        syncThread = new Thread(this::syncLoop, "eldoria-bridge-sync");
        syncThread.setDaemon(true);
        syncThread.start();
    }

    public void stop() {
        if (syncThread != null) {
            syncThread.interrupt();
        }
    }

    private void syncLoop() {
        while (!Thread.currentThread().isInterrupted()) {
            try {
                Thread.sleep(EldoriaBridgeMod.CONFIG.syncIntervalSeconds * 1000L);
                server.execute(this::syncAll);
            } catch (InterruptedException e) {
                Thread.currentThread().interrupt();
            } catch (Exception e) {
                EldoriaBridgeMod.LOGGER.error("Sync loop error", e);
            }
        }
    }

    private void syncAll() {
        Set<UUID> onlineIds = new HashSet<>();

        for (ServerPlayerEntity player : server.getPlayerManager().getPlayerList()) {
            onlineIds.add(player.getUuid());
            updateOnlinePlayer(player);
        }

        for (PlayerRecord record : registry.all()) {
            record.online = onlineIds.contains(record.uuid);
        }

        scanOfflinePlayerdata();
        registry.save();
    }

    private void updateOnlinePlayer(ServerPlayerEntity player) {
        PlayerRecord record = registry.getOrCreate(player.getUuid(), player.getGameProfile().getName());
        record.online = true;
        record.lastSeen = java.time.Instant.now().toString();
        applyLevelz(record, LevelzReader.fromPlayer(player));
        applyPlaytime(record, player);
        applyCurrency(record, NumismaticReader.fromPlayer(player));
        registry.put(record);
    }

    private void applyPlaytime(PlayerRecord record, ServerPlayerEntity player) {
        record.playtimeMinutes = PlaytimeReader.minutesFromPlayer(player);
    }

    private void applyPlaytime(PlayerRecord record, UUID uuid) {
        Path worldRoot = PlaytimeReader.worldRoot(server);
        File statsFile = PlaytimeReader.statsFileFor(worldRoot, uuid);
        record.playtimeMinutes = PlaytimeReader.minutesFromStatsFile(statsFile);
    }

    private void applyCurrency(PlayerRecord record, NumismaticReader.CurrencySnapshot snapshot) {
        record.currencyValue = snapshot.value;
        record.currencyGold = snapshot.gold;
        record.currencySilver = snapshot.silver;
        record.currencyBronze = snapshot.bronze;
    }

    private void applyLevelz(PlayerRecord record, LevelzReader.LevelzSnapshot snapshot) {
        record.level = snapshot.level;
        record.points = snapshot.points;
        record.experience = snapshot.experience;
        record.skills.clear();
        record.skills.putAll(snapshot.skills);
    }

    private void scanOfflinePlayerdata() {
        Path playerdata = server.getSavePath(net.minecraft.util.WorldSavePath.PLAYERDATA);
        File dir = playerdata.toFile();
        if (!dir.isDirectory()) {
            return;
        }

        File[] files = dir.listFiles((d, name) -> name.endsWith(".dat"));
        if (files == null) {
            return;
        }

        for (File file : files) {
            try {
                String uuidRaw = file.getName().replace(".dat", "");
                UUID uuid = uuidFromRaw(uuidRaw);
                if (uuid == null) {
                    continue;
                }

                if (registry.all().stream().anyMatch(p -> p.uuid.equals(uuid) && p.online)) {
                    continue;
                }

                PlayerRecord record = registry.getOrCreate(uuid, guessName(uuid));
                if (!record.online) {
                    applyLevelz(record, LevelzReader.fromPlayerFile(file));
                    applyCurrency(record, NumismaticReader.fromPlayerFile(file));
                    applyPlaytime(record, uuid);
                    record.lastSeen = java.time.Instant.from(
                            java.time.Instant.ofEpochMilli(file.lastModified())
                    ).toString();
                }
                registry.put(record);
            } catch (Exception e) {
                EldoriaBridgeMod.LOGGER.debug("Skipped playerdata {}", file.getName());
            }
        }
    }

    private static UUID uuidFromRaw(String raw) {
        if (raw.length() != 32) {
            return null;
        }
        String dashed = raw.replaceFirst(
                "(\\p{XDigit}{8})(\\p{XDigit}{4})(\\p{XDigit}{4})(\\p{XDigit}{4})(\\p{XDigit}+)",
                "$1-$2-$3-$4-$5"
        );
        try {
            return UUID.fromString(dashed);
        } catch (IllegalArgumentException e) {
            return null;
        }
    }

    private String guessName(UUID uuid) {
        for (ServerPlayerEntity player : server.getPlayerManager().getPlayerList()) {
            if (player.getUuid().equals(uuid)) {
                return player.getGameProfile().getName();
            }
        }
        return "Player_" + uuid.toString().substring(0, 8);
    }
}
