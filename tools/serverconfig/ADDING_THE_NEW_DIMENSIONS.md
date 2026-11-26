# Adding the Aether, Deeper and Darker and Blue Skies without lag

A checklist for the live server, from the test server's runs of 22 to 25 November 2026. The measurements behind it are
in `research/LATENCY_DEEP_DIVE.md` ("Update, 25 November 2026").

## The jars
| Jar | Needs | Notes |
|---|---|---|
| `aether-1.20.1-1.5.2-neoforge.jar` | Forge 47.1+, Curios 5.3.1+ (the pack has 5.14.1) | Cumulus, Nitrogen and MixinExtras are inside the jar. **owo-lib isn't needed**, and Accessories isn't used by this version: CurseForge lists them for the Aether's other versions. Keep Accessories anyway, because SimpleHats needs it |
| `deeperdarker-forge-1.20.1-1.3.3.jar` | Forge | |
| `blue_skies-1.20.1-1.3.31.jar` | Forge 47.1+, Structure Gel 2.13+ | |
| `structure_gel-1.20.1-2.16.2.jar` | Forge 47.1+ | Blue Skies' library |

All four go in the server's `mods/` **and** the modpack. A player without them can't join a server that has them.

## Before the first start with them
1. **Back up the world** from the Bisect panel.
2. **Upload the scripts:**
   - `kubejs/startup_scripts/aether_spawn_fix.js`, which halves the Aether's cost (`tools/kubejs/AETHER_SPAWN_FIX.md`).
   - `kubejs/server_scripts/adaptive_distance.js` (`tools/kubejs/ADAPTIVE_DISTANCE.md`).
   - The chunk loader ban and its four settings (`tools/kubejs/CHUNK_LOADER_BAN.md`), if not done yet.
   - The Blood Pool scripts with the Aether's and Deeper and Darker's tiers and wear and wield locks are already in the
     repo (`research/AETHER_DEEPERDARKER.md`).
3. **Check `server.properties`:** `simulation-distance=6` (the test server's value; everything here was measured at 6),
   `view-distance=8` or less, `sync-chunk-writes=false`.
4. **Blue Skies' gear isn't in the Blood Pool's tiers yet:** its progression hasn't been read. Until it has, anything
   made there is open from the start. That's the owner's call.

## After the first start
1. The log shows `[AetherSpawnFix] 3 of 3 spawn rules replaced`, and `/simdistance` says "On".
2. **Pregenerate** around where players will arrive (`PREGENERATION.md`), at a quiet time.
3. **Watch an evening:** `spark tps`, and `/simdistance` for any step down.

## What one player costs (measured)
Nine stand-in players 340 blocks apart in one dimension, simulation distance 6, on the test PC's slower cores with its
game running. Bisect's processor is probably faster, so take the comparison more than the numbers.

| Where the player is | Tick time per player standing alone |
|---|---|
| The Overworld (today's cost) | 10 to 12 ms |
| The Aether | 10 to 12 ms; **5.5 ms with `aether_spawn_fix.js`** |
| The Everbright | 8 ms |
| The Everdawn | 7 ms |
| The Otherside | 6.5 ms |

Players together share the cost: two players in one spot cost about one. A tick has 50 ms. Past that, the server falls
behind, and the adaptive distance script starts lowering the costliest dimension at 40.

## Still open
- **The spawn-skip mod** (`research/spawnskip/`): 17 to 29% less in the new dimensions, no gameplay change, but it's a
  compiled mod. That's the owner's call.
- **ServerCore's activation range,** for the Overworld's creatures: untested.
- **Spawn chunks and portals** (`tools/kubejs/CHUNK_LOADER_BAN.md`, "Minecraft's own ways").
