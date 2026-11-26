# Spawn skip (a prototype, not installed)

A one-class server mod written to measure one thing: how much time Minecraft spends trying to spawn kinds of creature
that can never spawn in a dimension. Examples are water creatures in the Aether, or the Aether's own four kinds in
every other dimension. The results are in `research/LATENCY_DEEP_DIVE.md` ("Update, 25 November 2026"). It saved 17 to
29% of the tick time in the new dimensions with nine stand-in players, and made no clear difference in the Overworld.

**It isn't part of the pack.** It's a compiled Java mod, a new kind of file for this server, so whether to use it is the
owner's call. Before shipping it would need its own doc, tests and a longer run on the test server.

## What it does
- **One mixin,** at the start of `NaturalSpawner.spawnCategoryForChunk` (`m_47045_`): one category's spawn tries in one
  chunk, one tick. If nothing in that dimension can spawn in that category, the tries are skipped.
- **What can spawn** is worked out once per dimension: every biome its generator can make (with Forge's biome
  modifiers applied), plus the spawn overrides of every structure whose biomes are among them.
- **It changes nothing it isn't sure of.** It leaves a dimension alone if its generator has its own spawn rules (it
  overrides `getMobsAt`, as the Twilight Forest's does). It also does nothing if any mod or script listens to Forge's
  `LevelEvent.PotentialSpawns` (none does in this pack: checked across all 209 jars).
- **The log names what's skipped** in each dimension, for example:
  `aether:the_aether: nothing spawns there in: ambient, axolotls, underground_water_creature, water_creature, ...`
- **Server only:** `displayTest="IGNORE_ALL_VERSION"`, so players don't need it.
- Method and field names are Minecraft's SRG names (`m_…`, `f_…`), as on a running Forge 1.20.1 server, so no
  remapping step is needed.

## Building
`bash build.sh <server folder>` compiles it against that server's own libraries and makes
`trollcraft_spawnskip-1.0.0.jar` (about 6 KB). It was built with JDK 17 against Forge 47.4.10.
