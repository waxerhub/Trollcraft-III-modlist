package trollcraft.spawnskip;

import net.minecraft.core.Holder;
import net.minecraft.core.registries.Registries;
import net.minecraft.server.level.ServerLevel;
import net.minecraft.world.entity.MobCategory;
import net.minecraft.world.level.biome.Biome;
import net.minecraft.world.level.biome.MobSpawnSettings;
import net.minecraft.world.level.chunk.ChunkGenerator;
import net.minecraft.world.level.levelgen.structure.Structure;
import net.minecraft.world.level.levelgen.structure.StructureSpawnOverride;
import net.minecraftforge.common.MinecraftForge;
import net.minecraftforge.event.level.LevelEvent;
import net.minecraftforge.event.server.ServerStoppedEvent;
import net.minecraftforge.eventbus.api.IEventListener;
import net.minecraftforge.eventbus.api.EventPriority;
import net.minecraftforge.fml.common.Mod;
import org.apache.logging.log4j.LogManager;
import org.apache.logging.log4j.Logger;

import java.util.HashMap;
import java.util.Map;
import java.util.Set;
import java.util.StringJoiner;

/**
 * Minecraft tries to spawn every kind of creature category in every chunk that runs, every tick, even a category that nothing
 * in that dimension belongs to (the Aether's four categories in the Overworld, water creatures in the Aether ...). Each such
 * try looks up biomes and structures and then spawns nothing. This works out once per dimension which categories anything
 * there can spawn in, and skips the rest. What spawns, where and how often doesn't change.
 *
 * Names starting with m_ and f_ are Minecraft's own names as they are on a running Forge 1.20.1 server.
 */
@Mod("trollcraft_spawnskip")
public class SpawnSkip {
    public static final Logger LOG = LogManager.getLogger("SpawnSkip");
    private static final Map<ServerLevel, boolean[]> FLAGS = new HashMap<>();
    private static ServerLevel lastLevel;
    private static boolean[] lastFlags;
    public static volatile boolean on = true;

    public SpawnSkip() {
        MinecraftForge.EVENT_BUS.addListener((ServerStoppedEvent e) -> { FLAGS.clear(); lastLevel = null; lastFlags = null; });
        MinecraftForge.EVENT_BUS.addListener((LevelEvent.Unload e) -> { if (e.getLevel() instanceof ServerLevel l) { FLAGS.remove(l); if (lastLevel == l) { lastLevel = null; lastFlags = null; } } });
    }

    /** Whether anything can spawn naturally in this category in this dimension. Server thread only. */
    public static boolean canSpawn(ServerLevel level, MobCategory category) {
        if (level != lastLevel) {
            lastFlags = FLAGS.computeIfAbsent(level, SpawnSkip::work);
            lastLevel = level;
        }
        int i = category.ordinal();
        return i >= lastFlags.length || lastFlags[i];
    }

    private static boolean[] work(ServerLevel level) {
        MobCategory[] cats = MobCategory.values();
        boolean[] can = new boolean[cats.length];
        String name = String.valueOf(level.m_46472_().m_135782_());
        try {
            ChunkGenerator gen = level.m_7726_().m_8481_();
            if (customSpawns(gen) || someoneAddsSpawns()) {
                java.util.Arrays.fill(can, true);
                LOG.info("{}: left alone (its spawns can't be read from its biomes)", name);
                return can;
            }
            Set<Holder<Biome>> biomes = gen.m_62218_().m_207840_();
            for (Holder<Biome> h : biomes) {
                MobSpawnSettings s = h.m_203334_().m_47518_();
                for (MobCategory c : cats) if (!s.m_151798_(c).m_146337_()) can[c.ordinal()] = true;
            }
            for (Structure st : level.m_9598_().m_175515_(Registries.f_256944_)) {
                boolean here = false;
                for (Holder<Biome> h : st.m_226559_()) if (biomes.contains(h)) { here = true; break; }
                if (!here) continue;
                for (Map.Entry<MobCategory, StructureSpawnOverride> e : st.m_226612_().entrySet())
                    if (!e.getValue().f_210044_().m_146337_()) can[e.getKey().ordinal()] = true;
            }
            StringJoiner skipped = new StringJoiner(", ");
            for (MobCategory c : cats) if (c != MobCategory.MISC && !can[c.ordinal()]) skipped.add(c.m_21607_());
            LOG.info("{}: nothing spawns there in: {}", name, skipped);
        } catch (Throwable t) {
            java.util.Arrays.fill(can, true);
            LOG.warn("{}: left alone, its biomes could not be read", name, t);
        }
        return can;
    }

    /** A generator with its own spawn rules (the Twilight Forest's) is left alone. */
    private static boolean customSpawns(ChunkGenerator gen) {
        for (Class<?> k = gen.getClass(); k != null && k != ChunkGenerator.class; k = k.getSuperclass())
            for (java.lang.reflect.Method m : k.getDeclaredMethods())
                if (m.getName().equals("m_223133_")) return true;
        return false;
    }

    /** Whether anything listens to Forge's event for adding spawns at a spot. */
    private static boolean someoneAddsSpawns() {
        for (IEventListener l : new LevelEvent.PotentialSpawns(null, null, null, net.minecraft.util.random.WeightedRandomList.m_146332_()).getListenerList().getListeners(0))
            if (!(l instanceof EventPriority)) return true;
        return false;
    }
}
