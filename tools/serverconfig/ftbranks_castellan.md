# The Castellan: her title, and building at spawn

KitKat, the Castellan (Part II's keeper of the spawn castle, see [STORY.md](../../STORY.md)), gets:
- a `[Castellan]` prefix, from an FTB Ranks rank;
- the right to build at spawn, **without being an operator**.

## Why spawn needs a script
In 1.20.1, vanilla spawn protection (`spawn-protection` in `server.properties`) only lets **operators** build. It's checked before any mod or script sees the action, so nothing can make an exception for one player. FTB Ranks can't either: it only handles commands and name formats (checked in its 1.20.1 source).

So vanilla spawn protection is switched off, and `kubejs/server_scripts/protected_areas.js` protects **the same square** instead, with KitKat on its allowed list:
- **KitKat** can break and place blocks there.
- **Everyone else** can still open doors, press buttons and use chests (`allowUse`), but can't break or place. Buckets, flint and steel and fire charges stay blocked.
- **Ops** are never blocked.
- **KitKat has no operator permissions.**

## 1. The prefix (in game, as an op)
```
/ftbranks create castellan 50
/ftbranks node add castellan ftbranks.name_format "&6[Castellan]&r {name}"
/ftbranks add KitKat castellan
```
- **The format has no `< >`:** vanilla chat adds them, so her chat line reads `<[Castellan] KitKat> hello`.
- **The name is applied straight away.** FTB Ranks refreshes display names when a rank is added; if the tab list doesn't change, she can rejoin.
- **Where it shows:** chat, and Simple Discord Link's name for her messages (both use the display name).
- **To remove it:** `/ftbranks remove KitKat castellan`.

## 2. Building at spawn
1. Note the current `spawn-protection` value in `server.properties` (Bisect: Config Files → Server Properties). It's the radius: 16 by default.
2. Set `spawn-protection=0`.
3. In `kubejs/server_scripts/protected_areas.js`, remove the `//` in front of the **Spawn** entry:
   ```js
   { name: 'Spawn', dim: 'minecraft:overworld', spawnRadius: 16, allowed: ['KitKat'], allowUse: true },
   ```
   - Set `spawnRadius` to the old `spawn-protection` value.
   - Check her **real Minecraft username** (not a nickname); add others to `allowed` if needed.
   - The area is every block within `spawnRadius` of the world spawn, at any height: the same square vanilla protected. It's read live, so it follows `/setworldspawn`.
4. Restart the server (for `server.properties`). After that, `/reload` is enough for changes to the script.

**Not covered** (same as vanilla spawn protection): explosions, fluids flowing in, pistons and mod machines. Disguised TNT already breaks nothing within 64 blocks of world spawn.

## Troubleshooting
| Check | How |
|---|---|
| Does the rank exist? | `/ftbranks list_all_ranks` |
| Does she have it? | `/ftbranks list_ranks_of KitKat` |
| Is the format set? | `/ftbranks node list castellan` |
| Did FTB Ranks load its file? | The server log says "Loaded N ranks" at startup or after `/ftbranks reload`, or "ranks.snbt failed to load" if it's broken |
| Is she an op? | If so, FTB Ranks' default **admin** rank (power 1000) gives her its own green name instead. She shouldn't be an op; if she must be, use `/ftbranks create castellan 1100` |
| Can others still build at spawn? | Is `spawn-protection=0` set and the Spawn entry uncommented? Look for "Loaded script server_scripts:protected_areas.js" in the log |
| Can she not build? | Is her username exact in `allowed`? Is vanilla `spawn-protection` still above 0 (it blocks her before the script runs)? |
