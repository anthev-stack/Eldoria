package net.eldoria.bridge.data;

import java.util.LinkedHashMap;
import java.util.Map;
import java.util.UUID;

public class PlayerRecord {
    public UUID uuid;
    public String name;
    public String firstJoined;
    public String lastSeen;
    public long playtimeMinutes;
    public long currencyValue;
    public int currencyGold;
    public int currencySilver;
    public int currencyBronze;
    public int level;
    public int points;
    public int experience;
    public Map<String, Integer> skills = new LinkedHashMap<>();
    public boolean online;

    public PlayerRecord() {
    }

    public PlayerRecord(UUID uuid, String name) {
        this.uuid = uuid;
        this.name = name;
        String now = java.time.Instant.now().toString();
        this.firstJoined = now;
        this.lastSeen = now;
    }
}
