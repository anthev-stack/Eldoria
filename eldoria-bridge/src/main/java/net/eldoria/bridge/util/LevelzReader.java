package net.eldoria.bridge.util;

import net.levelz.access.LevelManagerAccess;
import net.levelz.level.LevelManager;
import net.levelz.level.PlayerSkill;
import net.levelz.level.Skill;
import net.minecraft.entity.player.PlayerEntity;
import net.minecraft.nbt.NbtCompound;
import net.minecraft.nbt.NbtElement;
import net.minecraft.nbt.NbtIo;
import net.minecraft.nbt.NbtList;
import net.minecraft.nbt.NbtSizeTracker;

import java.io.File;
import java.util.LinkedHashMap;
import java.util.Map;

public final class LevelzReader {
    private LevelzReader() {
    }

    public static LevelzSnapshot fromPlayer(PlayerEntity player) {
        LevelManager manager = ((LevelManagerAccess) player).getLevelManager();
        return fromManager(manager);
    }

    public static LevelzSnapshot fromManager(LevelManager manager) {
        LevelzSnapshot snapshot = new LevelzSnapshot();
        snapshot.level = manager.getOverallLevel();
        snapshot.points = manager.getSkillPoints();
        snapshot.experience = manager.getTotalLevelExperience();

        for (Skill skill : LevelManager.SKILLS.values()) {
            int skillLevel = manager.getSkillLevel(skill.getId());
            snapshot.skills.put(skill.getKey(), skillLevel);
        }
        return snapshot;
    }

    public static LevelzSnapshot fromNbt(NbtCompound nbt) {
        LevelzSnapshot snapshot = new LevelzSnapshot();
        if (nbt == null || nbt.isEmpty()) {
            return snapshot;
        }

        snapshot.level = nbt.getInt("Level");
        snapshot.points = nbt.getInt("SkillPoints");
        snapshot.experience = nbt.getInt("TotalLevelExperience");

        if (nbt.contains("Skills", NbtElement.LIST_TYPE)) {
            NbtList skills = nbt.getList("Skills", NbtElement.COMPOUND_TYPE);
            for (int i = 0; i < skills.size(); i++) {
                NbtCompound skillNbt = skills.getCompound(i);
                int id = skillNbt.getInt("Id");
                int level = skillNbt.getInt("Level");
                Skill skill = LevelManager.SKILLS.get(id);
                if (skill != null) {
                    snapshot.skills.put(skill.getKey(), level);
                }
            }
        }

        for (Skill skill : LevelManager.SKILLS.values()) {
            snapshot.skills.putIfAbsent(skill.getKey(), 0);
        }
        return snapshot;
    }

    public static LevelzSnapshot fromPlayerFile(File file) {
        try {
            NbtCompound nbt = NbtIo.readCompressed(file.toPath(), NbtSizeTracker.ofUnlimitedBytes());
            return fromNbt(nbt);
        } catch (Exception e) {
            return new LevelzSnapshot();
        }
    }

    public static class LevelzSnapshot {
        public int level = 1;
        public int points = 0;
        public int experience = 0;
        public Map<String, Integer> skills = new LinkedHashMap<>();
    }
}
