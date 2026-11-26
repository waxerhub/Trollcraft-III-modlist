# The Chunk Loader Ban

Nothing a player has may keep chunks loaded (owner decisions, for TPS: ChickenChunks' loaders first, then "all methods of chunk loading in this modpack", 25 November 2026). Chunks kept loaded go on costing the server with nobody there, and a single force-loaded chunk keeps its whole dimension ticking.

**How the list was made:** every class in the 210 mod jars (and the jars inside them) was searched as data for the calls that load chunks: Forge's `ForgeChunkManager`, Minecraft's `setChunkForced` and its chunk tickets. Each mod that came up was then read. No jar ships a `/forceload` in its datapack functions.

## What keeps chunks loaded, and what stops it
| What | How it loads chunks | What stops it |
|---|---|---|
| **ChickenChunks** (Chunk and Spot Loaders) | for good | The script bans both. The mod stays installed, on the server and in the modpack: only its blocks are disabled (owner, 25 November 2026) |
| **Mekanism** (Dimensional Stabilizer, Anchor Upgrade) | for good; the Anchor Upgrade is craftable from Tier 4 | **A setting:** `allowChunkloading = false`. Both check it. Their recipes are removed too, so nobody makes one for nothing |
| **AE2's Spatial Anchor** | for good; craftable from Tier 10 | The script bans it like a loader (AE2 has no setting for it) |
| **RFTools Builder** (quarry) | for good while it runs, one chunk at a time; Tier 7 | **A setting:** `quarryChunkloads = false`. The quarry then waits at chunks that aren't loaded |
| **Alex's Mobs: a Bald Eagle in guided flight** (Falconry Glove and Hood, craftable from the start) | **every chunk it passes, 3 × 3 around it, and never lets go**, restarts included | The script lets go of any chunk a mod forces this way, within 5 seconds. Falconry still works |
| **Alex's Caves: Occult Gem, Remote Detonator** (Tier 6) | the 3 × 3 chunks around what they're linked to, **until the next restart** | The script lets go of them 10 seconds after each use. Both still work |
| **Create Big Cannons** (shells and their smoke) | a few chunks along the shot, for a moment | **A setting:** `projectilesCanChunkload`, `smokeCloudsCanChunkload`. A shell then stops at chunks that aren't loaded |
| Alex's Caves: a Beholder somebody looks through, a nuclear blast | only meanwhile | nothing needed |
| Ars Nouveau's scrying camera; Hexerei's courier owls | only meanwhile (the script also lets an owl's go) | nothing needed |
| Ice and Fire's Summoning Crystal | never: its chunk-loading code only runs where it can't | nothing needed (`"Chunk Load Summon Crystal"` does nothing) |
| Teleports and portals (Waystones, Twilight Forest, the Aether, the Otherside, Blue Skies, Botania, Mekanism's Robit, Brandon's Core `/tpx`), the Ender Dragon's and Chaos Guardian's fights | seconds, or while the fight is on | left alone: they need it |
| `/forceload` and Chunky | ops only | left alone |
| This server's own scripts (the Hooded Merchant's chunk, the Pig Escort's road, the Gladiator Arena, the Shrine) | with `/forceload`, while they need it | left alone: the script hears their commands |

**Still open (Minecraft's own):** the spawn chunks always stay loaded, and mobs or items sent through a portal keep both ends loaded for 15 seconds. See "Minecraft's own ways".

## Files
| File | Goes in | What it does |
|---|---|---|
| `server_scripts/chunk_loader_ban.js` | `kubejs/server_scripts/` | Bans the loaders, lets go of forced chunks, `/loaderban` |
| `startup_scripts/chunk_loader_ban_hooks.js` | `kubejs/startup_scripts/` | Hears Forge's chunk-load event and notes any loader already placed |

Server only: no modpack update. They work with or without ChickenChunks.

## Install
1. Copy the two files.
2. **Change these lines by hand** in the server's own files (the server stopped):
   | File | Line |
   |---|---|
   | `config/Mekanism/general.toml` | `allowChunkloading = false` |
   | `world/serverconfig/rftoolsbuilder-server.toml` | `quarryChunkloads = false` |
   | `world/serverconfig/createbigcannons-server.toml` | `projectilesCanChunkload = false` and `smokeCloudsCanChunkload = false` |
   (`world` is the world's folder.)
3. **Leave ChickenChunks installed,** on the server and in the modpack: the script disables its blocks (owner, 25 November 2026). Don't take it out of only one side:
   - a player without it can't join a server that has it;
   - a player who has it can join a server without it, but **their game crashes when they open the creative inventory** (seen on the test server, 25 November 2026: "Registry Object not present: chickenchunks:chunk_loader"). The server takes ChickenChunks' items out of their game as they join, and ChickenChunks then can't find its own loader.

   If it's ever taken out, take it out of both at once, keep CodeChickenLib (Draconic Evolution, Brandon's Core and Ender Storage need it), and have players update before they join.
4. Start the server. The log names any loader it removes and how many chunks were already forced.
5. **Let go of what's left from before:** run `/loaderban`. If it shows chunks "from before this was installed" (eagles' flights, most likely), wait until no event is on, run `/reload` so the server's scripts ask for theirs again, then `/loaderban release`.

## How it works
- **The loaders (`BANNED`):**
  - **No new ones:** their recipes go, placing one is refused (ops included), and right-clicking one opens nothing and removes it.
  - **Placed ones are removed.** Every loader keeps its own chunk loaded, so it loads when the server starts. The hook finds it among the chunk's block entities, and a second later the server script replaces it with air. Nothing drops.
  - **Loader items vanish** from inventories, the cursor, ender chests at login, opened containers and the ground. Nothing is refunded (owner decision).
- **`NO_RECIPE`** (Mekanism's two) only lose their recipes. Ones already made are left with their owner and do nothing.
- **Forced chunks:** every 5 seconds, any chunk forced in any dimension by something other than a `/forceload` command is released.
  - **Whose is whose:** the script hears every `/forceload` command, typed or run by a script, and keeps a record of what was asked for (`held`).
  - **What was already forced** when the script was first installed is nobody's: it's noted (`baseline`), logged and left alone until `/loaderban release`.
- **Alex's Caves' items:** the script reads the linked spot from the item and gives back the player's own hold on the 3 × 3 chunks, through Forge's call by its full signature (Rhino can't choose between its three forms otherwise).

## Command (op)
| Command | |
|---|---|
| `/loaderban` | Loaders removed and items taken, whether the hook is loaded, the last 10 removals; then, for each dimension, what's kept loaded and by whom, and how many chunks have been let go of |
| `/loaderban release` | Lets go of the chunks that were already forced when the script was installed (not ones `/forceload` has asked for since) |

## Settings (top of chunk_loader_ban.js)
| Setting | Default | |
|---|---|---|
| `BANNED` | ChickenChunks' two loaders, AE2's Spatial Anchor | Blocks and items removed wherever they're found. The hook has its own copy, `CHUNK_LOADER_BAN_BLOCKS` |
| `NO_RECIPE` | Mekanism's Dimensional Stabilizer and Anchor Upgrade | Only their recipes go |
| `MOD` | `chickenchunks` | Whose recipes all go |
| `RELEASE_FORCED`, `FORCED_TICKS` | true, 100 | Let go of chunks mods force, every 5 seconds |
| `REPORT_MINUTES` | 10 | A log line about it at most this often per dimension |
| `LINKED`, `LINKED_TICKS` | the gem and the detonator, 200 | Items that hold chunks around a linked spot, and when to let go |
| `CHECK_TICKS`, `LAST_SIZE`, `MESSAGE` | 20, 50, the line players see | |

**Saved data:** `server.persistentData["chunk_loader_ban"]`: the counts, the last removals, `held`, `baseline` and `released`. Unreadable data is kept under `chunk_loader_ban_unreadable_<time>`.

**API:** `global.ChunkLoaderBan = { found(list), isBanned(id), stats(), releaseForced(), releaseLinked(uuid, dim, x, z), report() }`.

## Minecraft's own ways
Not touched; the owner's call:
- **The spawn chunks** (19 × 19 around the world spawn) are always loaded, and run while anyone is in the Overworld. ModernFix can stop that: `mixin.perf.remove_spawn_chunks=true` in `config/modernfix-mixins.properties`. Not tried here.
- **Portals:** a mob or item that goes through a Nether portal holds the chunks at the other side for 15 seconds, so a steady stream keeps both ends loaded. Stopping it would mean no mobs or items through portals, which breaks some farms.

## Seen on the test server (25 November 2026)
By console, no player online, without ChickenChunks:
- **The scan's eagle case,** forced as the eagle does it: 9 chunks in the Aether gone within 8 seconds, and not back after a restart.
- **The gem's case:** 9 chunks held through Forge as the gem holds them, 9 let go.
- **A placed Spatial Anchor** was removed as its chunk loaded at start-up. (The hook first failed: it called `level.dimension()`, which KubeJS makes a property, so until then it never found a loader.)
- **Mekanism's Dimensional Stabilizer,** powered, with all 25 chunks chosen: 25 chunks held with the setting on, 0 with it off.
- **Recipes:** none left for the Spatial Anchor, the Stabilizer or the Anchor Upgrade; Mekanism's other upgrades keep theirs.
- **`/forceload`** typed by an op was kept; `/loaderban release` let go of the two chunks from before and kept that one.
- **ChickenChunks taken out:** the server started normally, placed loaders turned to air, loader items vanished from a chest, the rest of the chest and Ender Storage were fine.
- The settings in step 2 loaded and stayed.

## Test plan (with a player)
1. **An eagle:** tame a Bald Eagle, put a Falconry Hood on it, and fly it 20 chunks out. `/forceload query` shows none a few seconds later, and it still flies.
2. **The gem and detonator** (Tier 6): link, use, and look at `/loaderban` 15 seconds later.
3. **A Spatial Anchor** (creative): it can't be placed.
4. **The RFTools quarry** stops at a chunk that isn't loaded, and goes on when a player comes.

## What couldn't be verified
- **A real eagle flight, gem or detonator:** their effect was made by script, from their code.
- **`PlayerEvents.chestOpened`'s `event.inventory`** for modded containers. Some mods' storage may not show up as a plain container.
- **A running ChickenChunks loader's chunks** after the mod is taken out: Forge's code drops a missing mod's chunks, but a loader only runs for a player.
- **The RFTools quarry and Create Big Cannons** with their settings off: read in their settings, not tried.
