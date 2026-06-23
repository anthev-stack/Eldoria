package net.eldoria.bridge.http;

import com.google.gson.Gson;
import com.google.gson.GsonBuilder;
import com.sun.net.httpserver.Headers;
import com.sun.net.httpserver.HttpExchange;
import com.sun.net.httpserver.HttpServer;
import net.eldoria.bridge.config.BridgeConfig;
import net.eldoria.bridge.data.PlayerRecord;
import net.eldoria.bridge.data.PlayerRegistry;
import net.eldoria.bridge.util.NumismaticReader;
import net.minecraft.server.MinecraftServer;

import java.io.IOException;
import java.io.OutputStream;
import java.net.InetSocketAddress;
import java.nio.charset.StandardCharsets;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.HashMap;
import java.util.List;
import java.util.Map;

public class StatsHttpServer {
    private static final Gson GSON = new GsonBuilder().create();

    private final BridgeConfig config;
    private final PlayerRegistry registry;
    private final MinecraftServer server;
    private HttpServer httpServer;

    public StatsHttpServer(BridgeConfig config, PlayerRegistry registry, MinecraftServer server) {
        this.config = config;
        this.registry = registry;
        this.server = server;
    }

    public void start() throws IOException {
        httpServer = HttpServer.create(new InetSocketAddress(config.port), 0);
        httpServer.createContext("/api/health", this::handleHealth);
        httpServer.createContext("/api/players", this::handlePlayers);
        httpServer.createContext("/api/server", this::handleServer);
        httpServer.setExecutor(null);
        httpServer.start();
    }

    public void stop() {
        if (httpServer != null) {
            httpServer.stop(0);
        }
    }

    private void route(HttpExchange exchange, Runnable handler) throws IOException {
        addCors(exchange);
        if ("OPTIONS".equalsIgnoreCase(exchange.getRequestMethod())) {
            exchange.sendResponseHeaders(204, -1);
            exchange.close();
            return;
        }
        handler.run();
    }

    private void handleHealth(HttpExchange exchange) throws IOException {
        route(exchange, () -> {
            try {
                if (!authorize(exchange)) {
                    send(exchange, 401, "{\"error\":\"Unauthorized\"}");
                    return;
                }
                send(exchange, 200, "{\"ok\":true}");
            } catch (IOException e) {
                throw new RuntimeException(e);
            }
        });
    }

    private void handlePlayers(HttpExchange exchange) throws IOException {
        route(exchange, () -> {
            try {
                if (!"GET".equalsIgnoreCase(exchange.getRequestMethod())) {
                    send(exchange, 405, "{\"error\":\"Method not allowed\"}");
                    return;
                }
                if (!authorize(exchange)) {
                    send(exchange, 401, "{\"error\":\"Unauthorized\"}");
                    return;
                }

                List<Map<String, Object>> players = new ArrayList<>();
                for (PlayerRecord record : registry.all()) {
                    players.add(toPlayerJson(record));
                }
                players.sort(Comparator.comparingInt((Map<String, Object> p) -> {
                    Map<?, ?> levelz = (Map<?, ?>) p.get("levelz");
                    return levelz != null ? (Integer) levelz.get("level") : 0;
                }).reversed());

                Map<String, Object> body = new HashMap<>();
                body.put("updatedAt", registry.getUpdatedAt());
                body.put("total", players.size());
                body.put("players", players);
                send(exchange, 200, GSON.toJson(body));
            } catch (IOException e) {
                throw new RuntimeException(e);
            }
        });
    }

    private void handleServer(HttpExchange exchange) throws IOException {
        route(exchange, () -> {
            try {
                if (!"GET".equalsIgnoreCase(exchange.getRequestMethod())) {
                    send(exchange, 405, "{\"error\":\"Method not allowed\"}");
                    return;
                }
                if (!authorize(exchange)) {
                    send(exchange, 401, "{\"error\":\"Unauthorized\"}");
                    return;
                }

                int online = server.getPlayerManager().getCurrentPlayerCount();
                int max = server.getPlayerManager().getMaxPlayerCount();

                Map<String, Object> body = new HashMap<>();
                body.put("online", true);
                body.put("livePlayers", online);
                body.put("maxPlayers", max);
                body.put("totalPlayers", registry.size());
                body.put("version", server.getVersion());
                body.put("statsUpdatedAt", registry.getUpdatedAt());
                body.put("economy", aggregateEconomy());
                send(exchange, 200, GSON.toJson(body));
            } catch (IOException e) {
                throw new RuntimeException(e);
            }
        });
    }

    private void addCors(HttpExchange exchange) {
        Headers headers = exchange.getResponseHeaders();
        headers.set("Access-Control-Allow-Origin", config.allowedOrigin);
        headers.set("Access-Control-Allow-Headers", "X-Api-Key, Authorization, Content-Type");
        headers.set("Access-Control-Allow-Methods", "GET, OPTIONS");
    }

    private Map<String, Object> toPlayerJson(PlayerRecord record) {
        Map<String, Object> levelz = new HashMap<>();
        levelz.put("level", record.level);
        levelz.put("points", record.points);
        levelz.put("experience", record.experience);
        levelz.put("skills", record.skills);

        Map<String, Object> json = new HashMap<>();
        json.put("uuid", record.uuid.toString());
        json.put("name", record.name);
        json.put("firstJoined", record.firstJoined);
        json.put("lastSeen", record.lastSeen);
        json.put("playtimeMinutes", record.playtimeMinutes);
        json.put("online", record.online);
        json.put("levelz", levelz);
        json.put("currency", currencyJson(record));
        return json;
    }

    private Map<String, Object> currencyJson(PlayerRecord record) {
        Map<String, Object> currency = new HashMap<>();
        currency.put("value", record.currencyValue);
        currency.put("gold", record.currencyGold);
        currency.put("silver", record.currencySilver);
        currency.put("bronze", record.currencyBronze);
        return currency;
    }

    private Map<String, Object> aggregateEconomy() {
        int totalGold = 0;
        int totalSilver = 0;
        int totalBronze = 0;
        long totalPlaytime = 0;

        for (PlayerRecord record : registry.all()) {
            totalGold += record.currencyGold;
            totalSilver += record.currencySilver;
            totalBronze += record.currencyBronze;
            totalPlaytime += record.playtimeMinutes;
        }

        NumismaticReader.CurrencySnapshot totals = NumismaticReader.fromRawValue(
                (long) totalGold * 10000 + (long) totalSilver * 100 + totalBronze
        );
        Map<String, Object> raw = new HashMap<>();
        raw.put("gold", totalGold);
        raw.put("silver", totalSilver);
        raw.put("bronze", totalBronze);
        Map<String, Object> economy = new HashMap<>();
        economy.put("raw", raw);
        economy.put("totalValue", totals.value);
        economy.put("gold", totals.gold);
        economy.put("silver", totals.silver);
        economy.put("bronze", totals.bronze);
        economy.put("totalPlaytimeMinutes", totalPlaytime);
        return economy;
    }

    private boolean authorize(HttpExchange exchange) {
        if (!config.requireApiKey) {
            return true;
        }
        String headerKey = exchange.getRequestHeaders().getFirst("X-Api-Key");
        if (headerKey == null) {
            headerKey = exchange.getRequestHeaders().getFirst("Authorization");
            if (headerKey != null && headerKey.startsWith("Bearer ")) {
                headerKey = headerKey.substring(7);
            }
        }
        return config.apiKey != null && config.apiKey.equals(headerKey);
    }

    private void send(HttpExchange exchange, int status, String body) throws IOException {
        byte[] bytes = body.getBytes(StandardCharsets.UTF_8);
        exchange.getResponseHeaders().set("Content-Type", "application/json; charset=utf-8");
        exchange.sendResponseHeaders(status, bytes.length);
        try (OutputStream os = exchange.getResponseBody()) {
            os.write(bytes);
        }
    }
}
