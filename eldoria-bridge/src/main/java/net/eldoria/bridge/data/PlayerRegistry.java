package net.eldoria.bridge.data;

import com.google.gson.Gson;
import com.google.gson.GsonBuilder;
import com.google.gson.reflect.TypeToken;
import net.eldoria.bridge.EldoriaBridgeMod;
import net.fabricmc.loader.api.FabricLoader;

import java.io.IOException;
import java.lang.reflect.Type;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.ArrayList;
import java.util.Collection;
import java.util.Map;
import java.util.UUID;
import java.util.concurrent.ConcurrentHashMap;

public class PlayerRegistry {
    private static final Gson GSON = new GsonBuilder().setPrettyPrinting().create();
    private static final Type LIST_TYPE = new TypeToken<ArrayList<PlayerRecord>>() {}.getType();
    private static final Path PATH = FabricLoader.getInstance()
            .getConfigDir()
            .resolve("eldoria-bridge-players.json");

    private final Map<UUID, PlayerRecord> players = new ConcurrentHashMap<>();
    private String updatedAt = java.time.Instant.now().toString();

    public static PlayerRegistry load() {
        PlayerRegistry registry = new PlayerRegistry();
        if (Files.exists(PATH)) {
            try {
                String json = Files.readString(PATH);
                RegistryFile file = GSON.fromJson(json, RegistryFile.class);
                if (file != null && file.players != null) {
                    for (PlayerRecord record : file.players) {
                        if (record.uuid != null) {
                            record.online = false;
                            registry.players.put(record.uuid, record);
                        }
                    }
                    registry.updatedAt = file.updatedAt != null ? file.updatedAt : registry.updatedAt;
                }
            } catch (IOException e) {
                EldoriaBridgeMod.LOGGER.warn("Could not load player registry", e);
            }
        }
        return registry;
    }

    public void save() {
        updatedAt = java.time.Instant.now().toString();
        RegistryFile file = new RegistryFile();
        file.updatedAt = updatedAt;
        file.players = new ArrayList<>(players.values());
        try {
            Files.writeString(PATH, GSON.toJson(file));
        } catch (IOException e) {
            EldoriaBridgeMod.LOGGER.error("Could not save player registry", e);
        }
    }

    public PlayerRecord getOrCreate(UUID uuid, String name) {
        return players.compute(uuid, (id, existing) -> {
            if (existing == null) {
                PlayerRecord created = new PlayerRecord(id, name);
                return created;
            }
            existing.name = name;
            existing.lastSeen = java.time.Instant.now().toString();
            return existing;
        });
    }

    public void put(PlayerRecord record) {
        players.put(record.uuid, record);
    }

    public Collection<PlayerRecord> all() {
        return players.values();
    }

    public int size() {
        return players.size();
    }

    public String getUpdatedAt() {
        return updatedAt;
    }

    private static class RegistryFile {
        String updatedAt;
        ArrayList<PlayerRecord> players;
    }
}
