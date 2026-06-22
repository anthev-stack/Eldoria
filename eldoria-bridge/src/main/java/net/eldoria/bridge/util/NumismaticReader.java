package net.eldoria.bridge.util;

import net.minecraft.nbt.NbtCompound;
import net.minecraft.nbt.NbtElement;
import net.minecraft.nbt.NbtIo;
import net.minecraft.nbt.NbtSizeTracker;
import net.minecraft.server.network.ServerPlayerEntity;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

import java.io.File;

public final class NumismaticReader {
    private static final Logger LOGGER = LoggerFactory.getLogger("eldoria-bridge");
    private static final String COMPONENT_KEY = "numismatic-overhaul:currency";
    private static final String VALUE_KEY = "Value";
    private static final int GOLD_VALUE = 10000;
    private static final int SILVER_VALUE = 100;

    private NumismaticReader() {
    }

    public static CurrencySnapshot fromPlayer(ServerPlayerEntity player) {
        try {
            Class<?> modComponents = Class.forName("com.glisco.numismaticoverhaul.ModComponents");
            Object currencyKey = modComponents.getField("CURRENCY").get(null);
            Object component = currencyKey.getClass().getMethod("get", Object.class).invoke(currencyKey, player);
            long value = ((Number) component.getClass().getMethod("getValue").invoke(component)).longValue();
            return fromRawValue(value);
        } catch (ClassNotFoundException e) {
            return new CurrencySnapshot();
        } catch (Exception e) {
            LOGGER.debug("Could not read Numismatic currency for {}", player.getGameProfile().getName(), e);
            return new CurrencySnapshot();
        }
    }

    public static CurrencySnapshot fromPlayerFile(File file) {
        try {
            NbtCompound nbt = NbtIo.readCompressed(file.toPath(), NbtSizeTracker.ofUnlimitedBytes());
            return fromNbt(nbt);
        } catch (Exception e) {
            return new CurrencySnapshot();
        }
    }

    public static CurrencySnapshot fromNbt(NbtCompound root) {
        if (root == null || !root.contains("cardinal_components", NbtElement.COMPOUND_TYPE)) {
            return new CurrencySnapshot();
        }
        NbtCompound components = root.getCompound("cardinal_components");
        if (!components.contains(COMPONENT_KEY, NbtElement.COMPOUND_TYPE)) {
            return new CurrencySnapshot();
        }
        long value = components.getCompound(COMPONENT_KEY).getLong(VALUE_KEY);
        return fromRawValue(value);
    }

    public static CurrencySnapshot fromRawValue(long value) {
        CurrencySnapshot snapshot = new CurrencySnapshot();
        snapshot.value = Math.max(0, value);
        snapshot.gold = (int) (snapshot.value / GOLD_VALUE);
        long remainder = snapshot.value % GOLD_VALUE;
        snapshot.silver = (int) (remainder / SILVER_VALUE);
        snapshot.bronze = (int) (remainder % SILVER_VALUE);
        return snapshot;
    }

    public static class CurrencySnapshot {
        public long value = 0;
        public int gold = 0;
        public int silver = 0;
        public int bronze = 0;
    }
}
