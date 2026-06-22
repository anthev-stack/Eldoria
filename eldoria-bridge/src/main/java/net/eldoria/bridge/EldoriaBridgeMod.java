package net.eldoria.bridge;

import net.eldoria.bridge.config.BridgeConfig;
import net.eldoria.bridge.data.PlayerRegistry;
import net.eldoria.bridge.http.StatsHttpServer;
import net.eldoria.bridge.service.StatsSyncService;
import net.fabricmc.api.DedicatedServerModInitializer;
import net.fabricmc.fabric.api.event.lifecycle.v1.ServerLifecycleEvents;
import net.minecraft.server.MinecraftServer;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

public class EldoriaBridgeMod implements DedicatedServerModInitializer {
    public static final Logger LOGGER = LoggerFactory.getLogger("eldoria-bridge");
    public static MinecraftServer SERVER;
    public static BridgeConfig CONFIG;
    public static PlayerRegistry REGISTRY;
    public static StatsHttpServer HTTP_SERVER;
    public static StatsSyncService SYNC_SERVICE;

    @Override
    public void onInitializeServer() {
        CONFIG = BridgeConfig.load();
        REGISTRY = PlayerRegistry.load();

        ServerLifecycleEvents.SERVER_STARTED.register(server -> {
            SERVER = server;
            SYNC_SERVICE = new StatsSyncService(server, REGISTRY);
            SYNC_SERVICE.start();

            try {
                HTTP_SERVER = new StatsHttpServer(CONFIG, REGISTRY, server);
                HTTP_SERVER.start();
                LOGGER.info("Eldoria Bridge API listening on port {}", CONFIG.port);
                LOGGER.info("Website endpoint: http://YOUR_IP:{}/api/players", CONFIG.port);
            } catch (Exception e) {
                LOGGER.error("Failed to start Eldoria Bridge HTTP server", e);
            }
        });

        ServerLifecycleEvents.SERVER_STOPPING.register(server -> {
            if (SYNC_SERVICE != null) {
                SYNC_SERVICE.stop();
            }
            if (HTTP_SERVER != null) {
                HTTP_SERVER.stop();
            }
            if (REGISTRY != null) {
                REGISTRY.save();
            }
        });
    }
}
