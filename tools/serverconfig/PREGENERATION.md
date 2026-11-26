# Pregenerating the new dimensions (live server)

The Aether, the Otherside and Blue Skies' two dimensions. Generating new terrain causes the lag spikes these mods add
while players explore. Their steady cost is creatures and spawning (`research/LATENCY_DEEP_DIVE.md`, "Update, 25
November 2026"). On the test server, a full 20 TPS held while
generating, but a few players flying into fresh Otherside ground at once can still cause short lag spikes. Generating
the ground players will reach first, while nobody is on, takes that cost away. Plan written 22 November 2026, from the
test server's stress test. Nothing here has been run on the live server.

## What the test server measured

Chunky 1.3.146, a 400-block square (2,601 chunks) in each dimension, no players online:

| Dimension | Time | Average rate | Disk per chunk | Notes |
|---|---|---|---|---|
| The Aether (`aether:the_aether`) | 19 s | about 137 chunks a second | about 9 KB | mostly sky, cheap to make. Later runs: 137 to 296 a second |
| The Otherside (`deeperdarker:otherside`) | 31 s | about 84 chunks a second | about 12 KB | one 9-second pause at 13%, then about 50 a second. A later run on fresh ground: about 61 a second |

- TPS stayed at 20 throughout; the slowest tick in the minute after each run was 52 ms (the Aether) and 35 ms (the
  Otherside), against 50 ms for a full tick.
- Memory rose from 2.8 to 4.2 GB (of 6 GB) over both runs.
- The test server is a home PC. Bisect's hardware is unknown, so the times below also show a run **4 times slower**.

## Where players arrive

Both dimensions use **the same x and z as the Overworld** (`coordinate_scale` 1.0 in each mod's `dimension_type`):
- **The Aether:** wherever someone builds a glowstone portal, so near the bases. Pregenerate around spawn and the bases.
- **The Otherside:** its portal needs a frame of reinforced deepslate, which is in **ancient cities**. No recipe or loot
  in the pack gives that block, but mods that move blocks weren't checked, so a portal elsewhere can't be ruled out.
  In practice players arrive above the ancient cities they find. Pregenerate around the cities nearest the bases.

## The plan

| Step | Dimension | Centre | Square radius | Chunks | Time (test PC / 4× slower) | Disk |
|---|---|---|---|---|---|---|
| 1 | The Aether | world spawn (the castle) | 1,000 blocks, or the farthest base + 500 | 16,129 | 2 / 8 min | about 140 MB |
| 2 | The Otherside | each of the 2–3 ancient cities nearest the bases | 500 blocks each | 4,225 each | 1 / 3 min each | about 50 MB each |

**If the bases are spread wider than 1,000 blocks from spawn,** raise the Aether radius:

| Square radius | Chunks | Aether time | Aether disk | Otherside time | Otherside disk |
|---|---|---|---|---|---|
| 500 | 4,225 | 0.5 / 2 min | 38 MB | 1 / 3 min | 51 MB |
| 1,000 | 16,129 | 2 / 8 min | 143 MB | 3 / 13 min | 190 MB |
| 1,500 | 35,721 | 4 / 17 min | 318 MB | 7 / 28 min | 425 MB |
| 2,000 | 63,001 | 8 / 31 min | 561 MB | 13 / 50 min | 750 MB |

Check the server's disk allowance on Bisect before going past 1,500.

## How

**Before:**
1. **Chunky:** `Chunky-1.3.146.jar` has been in the Server Mods folder since 24 October, so the live server should
   have it. Type `chunky help` in the console: it lists its commands if it's there. It runs on the server only; players
   don't need it.
2. **Let a restart resume a run:** in `config/chunky/config.json`, set `"continueOnRestart": true` (it ships as
   `false`), then restart. Otherwise a restart mid-run loses the progress, though not the chunks already made.
3. **Back up the world** from the Bisect panel.
4. **Pick a quiet time.** Generation competes with players for the server's time. With nobody on, it can run flat out.
5. **Write down the coordinates:**
   - **Spawn:** stand on the castle's spawn point and read x and z from F3.
   - **The bases:** the farthest base from spawn sets the Aether radius (JourneyMap's waypoints, or ask the players).
   - **Ancient cities:** in the Overworld, stand at each base (or use
     `execute positioned <x> -40 <z> run locate structure minecraft:ancient_city` from the console) and note the
     city's x and z. `locate` can take a few seconds.

**The Aether** (console commands, no slash; in game, add a `/`):
```
chunky world aether:the_aether
chunky shape square
chunky center <spawn x> <spawn z>
chunky radius 1000
chunky start
```

**The Otherside**, once the Aether is finished (one city at a time):
```
chunky world deeperdarker:otherside
chunky shape square
chunky center <city x> <city z>
chunky radius 500
chunky start
```
Repeat `chunky center` and `chunky start` for each city.

**While it runs:**
- Every few seconds Chunky prints `Task running for … Rate: N cps, ETA: …`. The first minute's rate tells you how
  Bisect compares with the test PC (137 for the Aether, 84 for the Otherside).
- `chunky progress` shows where it is; `chunky quiet 30` prints only every 30 seconds.
- If someone joins and it lags, `chunky pause`, then `chunky continue` later.
- `spark tps` and `spark health` show the tick rate and memory. Below about 19 TPS, or memory near the limit with
  players on, pause it.

**After:**
- `chunky cancel` only if a run needs stopping for good. A finished run needs nothing.
- Players can still go beyond the generated square: those chunks are made as they arrive, as before. This isn't a
  border.

## Blue Skies (the Everbright and the Everdawn)

Being added with the Aether and Deeper and Darker (owner, 25 November 2026; checklist in `ADDING_THE_NEW_DIMENSIONS.md`).
Its two dimensions, `blue_skies:everbright` and `blue_skies:everdawn`, also use the Overworld's x and z.

**Where players arrive** (read from the mod's data, 25 November):
- **At first, at a Gatekeeper's house in the Overworld.** Each house has both portals built in. They're lit with a
  Zeal Lighter, which the Gatekeeper sells for 8 emeralds. Houses stand in plains and savanna, snowy and taiga, and
  mountain biomes, roughly every 500 to 1,100 blocks.
- **Houses only generate in new ground.** In an existing world, the nearest ones are in parts of the Overworld nobody
  has visited yet. To find them, from the console:
  `execute positioned <base x> 70 <base z> run locate structure #blue_skies:gatekeeper_houses`. It only names houses
  that exist or can still generate. (On the test server the nearest were 601 and 1,017 blocks from the points tried.)
- **Later, anywhere:** the frames are Turquoise Stonebrick (the Everbright) and Lunar Stonebrick (the Everdawn), which
  are crafted from stone found in those dimensions.

**The plan:** pregenerate both dimensions in a 1,000-block square around the two or three houses nearest the bases.
Pregenerate the Overworld in a 200-block square around each house too, so the first trip there isn't through fresh
ground. Add the bases later, once players start building their own portals. Rates on the test PC: 115 to 119
chunks a second over a 1,000-block square (85 to 103 over a smaller one), about 10 KB a chunk. That square is
16,129 chunks each: about 2.5 minutes (10 if Bisect is 4 times slower) and about 155 MB.

```
chunky world blue_skies:everbright
chunky shape square
chunky center <house x> <house z>
chunky radius 1000
chunky start
```
Then the same with `chunky world blue_skies:everdawn`.

## What couldn't be checked

- **Bisect's speed and memory:** only the test PC was measured. Watch the first minute's rate.
- **The live world's coordinates:** spawn, the bases and the ancient cities aren't in the repo, so the centres are
  steps to fill in, not numbers.
- **`chunky spawn`** (Chunky's own "centre on spawn") wasn't tried in the Aether, whose spawn may not be the
  Overworld's. Use the coordinates.
- **Two 17-minute stalls on the test server** on 22 November (20:04 and 21:25) came with no players and no generation.
  Windows' power log confirms the PC was asleep for both. The test server also paused for 5 to 10 seconds a few other
  times that day for a reason that isn't known yet (`research/LATENCY_DEEP_DIVE.md`); the live server never sleeps.
