package net.eldoria.bridge.util;

import com.google.gson.Gson;
import com.google.gson.JsonObject;
import net.minecraft.server.network.ServerPlayerEntity;
import net.minecraft.stat.Stats;
import net.minecraft.util.WorldSavePath;

import java.io.File;
import java.io.FileReader;
import java.nio.file.Path;
import java.util.UUID;

public final class PlaytimeReader {
    private static final Gson GSON = new Gson();

    private PlaytimeReader() {
    }

    public static long minutesFromPlayer(ServerPlayerEntity player) {
        int ticks = player.getStatHandler().getStat(Stats.CUSTOM, Stats.PLAY_TIME);
        return ticksToMinutes(ticks);
    }

    public static long minutesFromStatsFile(File statsFile) {
        if (statsFile == null || !statsFile.isFile()) {
            return 0;
        }
        try (FileReader reader = new FileReader(statsFile)) {
            JsonObject root = GSON.fromJson(reader, JsonObject.class);
            if (root == null) {
                return 0;
            }
            JsonObject stats = root.getAsJsonObject("stats");
            if (stats == null) {
                return 0;
            }
            JsonObject custom = stats.getAsJsonObject("minecraft:custom");
            if (custom == null || !custom.has("minecraft:play_time")) {
                return 0;
            }
            return ticksToMinutes(custom.get("minecraft:play_time").getAsInt());
        } catch (Exception e) {
            return 0;
        }
    }

    public static File statsFileFor(Path worldRoot, UUID uuid) {
        return worldRoot.resolve("stats").resolve(uuid + ".json").toFile();
    }

    public static Path worldRoot(net.minecraft.server.MinecraftServer server) {
        return server.getSavePath(WorldSavePath.ROOT);
    }

    private static long ticksToMinutes(int ticks) {
        if (ticks <= 0) {
            return 0;
        }
        return ticks / 20L / 60L;
    }
}
