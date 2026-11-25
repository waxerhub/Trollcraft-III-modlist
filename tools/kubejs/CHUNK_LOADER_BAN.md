# The Chunk Loader Ban

ChickenChunks' **Chunk Loader** and **Spot Loader** are banned (owner decision, for TPS). Loaders keep chunks ticking with nobody there, and more dimensions are coming. ChickenChunks stays installed, so **no modpack update is needed**; two server-side files do the job:

| File | Goes in | What it does |
|---|---|---|
| `startup_scripts/chunk_loader_ban_hooks.js` | `kubejs/startup_scripts/` | Hears Forge's chunk-load event and notes any loader in a chunk as it loads |
| `server_scripts/chunk_loader_ban.js` | `kubejs/server_scripts/` | Removes the loaders it's told about, and stops new ones |

**Nothing is refunded** (owner decision): loaders just vanish.

## How it works
- **Placed loaders are removed:**
  - Every loader keeps its own chunk loaded, so ChickenChunks loads each one's chunk when the server starts (or when the owner logs in, if ChickenChunks has their loaders dormant while they're offline).
  - As the chunk loads, the hook finds the loader among the chunk's block entities and passes it on. It never changes the world itself, because the chunk is still loading.
  - Within a second, the server script replaces it with air (`execute in <dim> if block … run setblock … minecraft:air`). That's a replace, so **nothing drops**.
  - **Its chunks are released:** removing the block runs ChickenChunks' own clean-up. `TileChunkLoaderBase.setRemoved` calls `deactivate`, which calls `removeChunkLoader`. That was checked in ChickenChunks' 1.20.1 source (`TheCBProject/ChickenChunks`, branch `1.20.1`).
  - A loader in a chunk nobody loads stays where it is, doing nothing, until something loads that chunk. Then it's removed.
- **No new loaders:**
  - every recipe making a ChickenChunks item, and every ChickenChunks recipe, is removed;
  - placing a loader is refused, ops included;
  - right-clicking a loader opens nothing, and removes it.
- **Loader items vanish:**
  - from a player's inventory and mouse cursor when one arrives;
  - from their inventory and ender chest at login;
  - from any container a player opens;
  - and a dropped loader never lands.
  - The player is told once per session: *"Chunk loaders have been banned. Any you had are gone."*
- **Logged:** `[ChunkLoaderBan] Removed <id> at <dim> x y z`, and every stack taken from a player.

## Install
1. Copy `chunk_loader_ban_hooks.js` to the server's `kubejs/startup_scripts/` and `chunk_loader_ban.js` to `kubejs/server_scripts/`.
2. **Restart the server.** A startup script only loads at start-up.
3. Check the log for `Removed chickenchunks:…` lines, then run `/loaderban`. It should say the chunk hook is loaded.

Without the hook, the server script still stops new loaders and removes any that are right-clicked, and it warns in the log at start-up.

## Command (op)
| Command | |
|---|---|
| `/loaderban` | How many placed loaders were removed and stacks taken, whether the hook is loaded, and the last 10 removals with their positions |

## Settings (top of chunk_loader_ban.js)
| Setting | Default | |
|---|---|---|
| `BANNED` | `chickenchunks:chunk_loader`, `chickenchunks:spot_loader` | The blocks and items (ids from ChickenChunks' source). The hook has its own copy, `CHUNK_LOADER_BAN_BLOCKS` |
| `MOD` | `chickenchunks` | Whose recipes are removed |
| `CHECK_TICKS` | 20 | How often found loaders are removed |
| `LAST_SIZE` | 50 | Removals kept for `/loaderban` |
| `MESSAGE` | the line above | What players are told |

**Saved data:** `server.persistentData["chunk_loader_ban"]` holds the counts and the last removals. Unreadable data is kept under `chunk_loader_ban_unreadable_<time>`.

**API:** `global.ChunkLoaderBan = { found(list), isBanned(id), stats() }`.

## Test plan (test server)
1. **Before installing:** place a Chunk Loader and a Spot Loader and switch them on. Put spare loaders in a chest, your ender chest and your inventory.
2. **Install and restart.** The log shows both placed loaders removed, and their spots are air. `/loaderban` counts 2 and says the hook is loaded.
3. **Items:** at login the inventory and ender-chest loaders are gone, with one message. Opening the chest clears its loaders.
4. **New ones:** no recipe in JEI's crafting result. A creative loader can't be placed, and thrown on the ground it never appears.
5. **Chunks released:** with nobody near the old loader's spot, `/spark health` (loaded chunks) or a farm there shows it's no longer kept running.

## What couldn't be verified
- **That `ChunkEvent$Load` reaches the hook for chunks loaded at start-up,** and that `getBlockEntitiesPos()` already lists the loader then. It includes block entities still pending from disk, which is why it's used.
- **That `setblock … air` releases ChickenChunks' chunks in game.** The source says `setRemoved` does it, as long as the chunk isn't unloading, which it isn't while the loader holds it.
- **`PlayerEvents.chestOpened`'s `event.inventory`** for modded containers. Some mods' storage may not show up as a plain container.
- **Loaders in chunks that never load again** (an owner who never comes back, with ChickenChunks keeping their loaders dormant) stay in the save, doing nothing.
