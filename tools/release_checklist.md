# Part II: Blue Skies, the lag fixes, the crate button and the Potato Press fix

This folder brings the Part II server and the modpack up to date for 25 November 2026:
- **Blue Skies** (the Everbright and the Everdawn), joining the Aether and Deeper and Darker;
- **Lag:** the Aether's spawn fix (it halves the Aether's cost), the adaptive simulation distance, and the ban on every way of keeping chunks loaded;
- **The crate button:** each upgrade-tree node has a potato crate next to its potato. One click hands in everything you carry: loose potatoes, any mod's potato crates (9 each) and Enchanted Potatoes (160 each);
- **The Potato Press and Oven fix:** the Press now takes potato crates and the Oven Enchanted Potatoes, by hand and from hoppers. Until now both refused everything but plain potatoes. Hoppers and pipes can take only what they make out of them, never the potatoes or crates waiting inside.

It's built from the repo by `tools/make_release.sh`; `FILES.txt` lists every file. It builds on the last update (the Enchanted Potatoes, the Shrine night, the Aether and Deeper and Darker). That update's other files haven't changed.

**Never copy a file from the test server to the live one.** The test server's `blood_pool.js` needs only 2 votes to break a seal (`VOTES_TO_BREAK = 2`). The live one needs 5, as the file here has.

## 1. The modpack update (every player)
Copy the contents of `modpack/` into the modpack:
- `mods/`: the four mods, if this folder has them: `aether-1.20.1-1.5.2-neoforge.jar`, `deeperdarker-forge-1.20.1-1.3.3.jar`, `blue_skies-1.20.1-1.3.31.jar`, `structure_gel-1.20.1-2.16.2.jar`. (If `mods/` is missing here, add them from the Server Mods folder.) **A player without them can't join.** The Aether needs nothing else: Cumulus is inside its jar, the pack's Curios is new enough, and owo-lib isn't needed.
- `kubejs/startup_scripts/potato_press.js`: the Press fix. With the old one, a crate placed in a Press by hand jumps back for a moment before it goes in.
- `kubejs/client_scripts/potato_tooltips.js`: unchanged; it's here so the two sides match.

**Keep ChickenChunks in the modpack.** It stays on the server too; only its blocks are disabled. A player whose game has it, joining a server without it, crashes on opening the creative inventory (and the other way round can't join at all).

Players need the update before they join.

## 2. The server (stop it first)
1. **Stop the server**, and **back up the world** from the Bisect panel.
2. **Copy the contents of `server/` into the server's folder.** It goes into `mods/`, `kubejs/` and `config/`, and replaces the files of the same name:

   | In `server/` | What it is |
   |---|---|
   | `mods/` (the four jars, if here) | The Aether, Deeper and Darker, Blue Skies and Structure Gel. If they're not in this folder, add them from the Server Mods folder |
   | `kubejs/server_scripts/part2/potato_tree.js` | The upgrade tree, with the crate button |
   | `kubejs/server_scripts/part2/blood_pool.js` | The same file as the last update's. It's here because the crate button needs it |
   | `kubejs/server_scripts/adaptive_distance.js` | New. When the server falls behind, the busiest dimension's creatures and machines run a chunk less far around players, down to 4; it gives the steps back when the server copes. `/simdistance` |
   | `kubejs/server_scripts/chunk_loader_ban.js` | Bans ChickenChunks' loaders and AE2's Spatial Anchor, and lets go of chunks mods force (an Alex's Mobs eagle in flight, Alex's Caves' gem and detonator). `/loaderban` |
   | `kubejs/startup_scripts/chunk_loader_ban_hooks.js` | Its hook (finds loaders already placed) |
   | `kubejs/startup_scripts/aether_spawn_fix.js` | New. The Aether's Swets and Aechor Plants spawn as before, without the Aether's 270,000-block scans |
   | `kubejs/startup_scripts/potato_press.js` | The Press fix: the same file as the modpack's |
   | `kubejs/data/kubejs/tags/items/potato_press_input.json`, `potato_oven_input.json` | New. What the Press and the Oven take |
   | `config/ftbquests/quests/chapters/potato_war_*.snbt` | The seven Potato War chapters, with the crate tasks. Keep exactly one file per chapter (no `(1)` copies) |

3. **If the chunk-loader ban's settings aren't in yet,** change these lines by hand (`world` is the world's folder):

   | File | Line |
   |---|---|
   | `config/Mekanism/general.toml` | `allowChunkloading = false` |
   | `world/serverconfig/rftoolsbuilder-server.toml` | `quarryChunkloads = false` |
   | `world/serverconfig/createbigcannons-server.toml` | `projectilesCanChunkload = false` and `smokeCloudsCanChunkload = false` |

4. **Keep ChickenChunks** in the server's `mods/`.

## 3. Start the server and check
- The log says `[AetherSpawnFix] 3 of 3 spawn rules replaced` and `[PotatoPress] Hoppers and pipes can reach the Potato Press and Oven`.
- KubeJS loads every server script with 0 errors (`logs/kubejs/server.log`: "Loaded … KubeJS server scripts … with 0 errors").
- `/simdistance` says "On", with the normal distance from `server.properties`.
- `/loaderban` says the chunk hook is loaded. If it lists chunks "from before this was installed", wait until no event is on, run `/reload`, then `/loaderban release`.
- **The crate button:** in the book, open a node you haven't paid for. Next to the potato there's a potato crate ("Click to hand in crates (9 each), Enchanted Potatoes (160 each) and loose potatoes"). Click it with crates on you: the potato's number goes up, and chat says what went in.
- **The Press:** put potato crates in a Potato Press by hand. Every second, 18 crates (162 potatoes) make 1 Enchanted Potato. A hopper under it takes the Enchanted Potatoes and leaves the crates.
- The quest book shows the crates. If it still shows the old chapters, run `/ftbquests reload` from the **server console**.

## 4. Pregenerate (while nobody is on)
`PREGENERATION.md` in this folder has the plan, the Chunky commands, the times and the disk space:
- the Aether, around spawn;
- the Otherside, around the ancient cities nearest the bases;
- the Everbright and the Everdawn, around the Gatekeeper houses nearest the bases (`locate` finds them), and the Overworld around those houses.

## 5. Once players are on
A 5-minute `spark` profile on a busy evening gives the first real numbers for the new dimensions:
```
spark profiler start
spark profiler stop --save-to-file
```
Send the file from `config/spark/`.

## Not decided yet
- **Blue Skies' gear isn't sealed by the Blood Pool.** Anything made there can be crafted from the start. It needs the same read-through the Aether and Deeper and Darker had.
- **The spawn-skip mod** (`research/spawnskip/`): 17 to 29% less lag in the new dimensions, but it's a compiled mod.

## Still to see in game
- **Lag:** all the numbers were measured with stand-in players on the test PC (`research/LATENCY_DEEP_DIVE.md`); real players and Bisect's processor will differ.
- **The adaptive distance** with real players: farms and crops beyond 64 blocks stand still while a dimension is lowered.
- **The Aether fix:** an armour stand wearing a Swet Cape keeping Swets away (offline tests only).
- **The Press:** pipes, Create funnels and AE2 (hoppers and a player's hands were tried).
