package net.eldoria.bridge.config;

import com.google.gson.Gson;
import com.google.gson.GsonBuilder;
import net.eldoria.bridge.EldoriaBridgeMod;
import net.fabricmc.loader.api.FabricLoader;

import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;

public class BridgeConfig {
    private static final Gson GSON = new GsonBuilder().setPrettyPrinting().create();
    private static final Path PATH = FabricLoader.getInstance()
            .getConfigDir()
            .resolve("eldoria-bridge.json");

    public int port = 26871;
    public String apiKey = "change-this-key";
    public String allowedOrigin = "*";
    public int syncIntervalSeconds = 30;
    public boolean requireApiKey = true;

    public static BridgeConfig load() {
        if (Files.exists(PATH)) {
            try {
                String json = Files.readString(PATH);
                return GSON.fromJson(json, BridgeConfig.class);
            } catch (IOException e) {
                EldoriaBridgeMod.LOGGER.warn("Could not read config, using defaults", e);
            }
        }
        BridgeConfig config = new BridgeConfig();
        config.save();
        return config;
    }

    public void save() {
        try {
            Files.createDirectories(PATH.getParent());
            Files.writeString(PATH, GSON.toJson(this));
        } catch (IOException e) {
            EldoriaBridgeMod.LOGGER.error("Could not save config", e);
        }
    }
}
