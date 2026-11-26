package trollcraft.spawnskip.mixin;

import net.minecraft.server.level.ServerLevel;
import net.minecraft.world.entity.MobCategory;
import net.minecraft.world.level.NaturalSpawner;
import net.minecraft.world.level.chunk.LevelChunk;
import org.spongepowered.asm.mixin.Mixin;
import org.spongepowered.asm.mixin.injection.At;
import org.spongepowered.asm.mixin.injection.Inject;
import org.spongepowered.asm.mixin.injection.callback.CallbackInfo;
import trollcraft.spawnskip.SpawnSkip;

/** m_47045_ is NaturalSpawner.spawnCategoryForChunk: one category's tries in one chunk, one tick. */
@Mixin(value = NaturalSpawner.class, remap = false)
public abstract class NaturalSpawnerMixin {
    @Inject(method = "m_47045_", at = @At("HEAD"), cancellable = true, remap = false)
    private static void trollcraft$skipWhatCantSpawn(MobCategory category, ServerLevel level, LevelChunk chunk,
                                                     NaturalSpawner.SpawnPredicate predicate, NaturalSpawner.AfterSpawnCallback callback, CallbackInfo ci) {
        if (SpawnSkip.on && !SpawnSkip.canSpawn(level, category)) ci.cancel();
    }
}
