# Adaptive simulation distance

When the server can't keep up, the dimension that costs the most has its creatures and machines run a little less far
around its players. When the server copes again, the distance comes back. This was the owner's decision on 23 November
2026, after `research/LATENCY_DEEP_DIVE.md`.

## What it does
- **The distance:** `simulation-distance` in `server.properties` sets how many chunks around each player run
  (creatures, crops, machines). At 6 that's 13 × 13 = 169 chunks, at 5 it's 121, and at 4 it's 81. What players can
  see (`view-distance`) never changes.
- **Lowering:** every second the script reads the server's tick time. If the middle of the last 10 readings is over
  40 ms, the most costly dimension with players in it goes down one step. It never goes below 4.
- **Raising:** after 2 minutes under 30 ms, the last step is given back, one step at a time.
- **No bouncing:** if a step is needed again within 5 minutes of being given back, the next wait is twice as long, up to
  30 minutes.
- **Never during the Shrine's night:** nothing is lowered while it's on, and every step is given back when it starts.
  Nothing is lowered in the first 2 minutes after a start either.
- **A restart** puts everything back to `server.properties`.
- **What players notice:** while a dimension is lowered, creatures, crops, farms and machines that are more than about
  4 chunks (64 blocks) from every player stand still. Nobody is moved, and no dimension is closed.

## Files
| File | Goes in |
|---|---|
| `server_scripts/adaptive_distance.js` | `kubejs/server_scripts/`, then `/reload` |

Server only, so no modpack update. Don't run it alongside ServerCore's dynamic distances (they're off by default, if
that mod is ever added).

## Commands (op)
| Command | |
|---|---|
| `/simdistance` | On or off; the tick time; each dimension in use, with its distance, players and cost; the last 8 changes |
| `/simdistance off` | Everything back to normal, and it stays so (kept over restarts) |
| `/simdistance on` | Starts it again |

Ops who are online see a line in chat at every change (`TELL_OPS`). Every change is also in the log as
`[AdaptiveDistance]`.

## Settings (top of adaptive_distance.js)
| Setting | Default | |
|---|---|---|
| `LOWER_ABOVE_MS` | 40 | A step down when the middle reading is over this (a tick has 50 ms) |
| `RAISE_BELOW_MS` | 30 | A step back after `RAISE_AFTER_SECONDS` under this |
| `MIN_DISTANCE` | 4 | The lowest |
| `SAMPLE_TICKS`, `SAMPLES` | 20, 10 | A reading each second; the middle of 10 decides, so one slow moment (a save, a tier opening) changes nothing |
| `RAISE_AFTER_SECONDS` | 120 | |
| `BOUNCE_SECONDS`, `RAISE_MAX_SECONDS` | 300, 1800 | The doubled wait, and its limit |
| `START_GRACE_SECONDS` | 120 | Nothing lowered this soon after a start |
| `MIN_SHARE_MS` | 2 | A dimension costing less than this is never lowered |
| `NORMAL` | `{}` | A dimension's own normal distance, lower than `server.properties`, e.g. `{ 'blue_skies:everbright': 5 }` |
| `TELL_OPS` | true | |
| `HOLDS` | the Shrine's night | When nothing may be lowered |

**Saved data:** `server.persistentData["adaptive_distance"]` holds only whether it's on. The steps live in
`global.adaptiveDistance`: `/reload` keeps them, a restart clears them, as Minecraft does.

**API:** `global.AdaptiveDistance = { enabled(), distanceOf(dim), lowered() }`.

## What it saves (measured, 25 November 2026)
On the test server, using the PC's slower cores with the owner's game running. Nine stand-in players (Forge's
FakePlayer) stood 340 blocks apart in one dimension. Chunks load, and creatures spawn and act around them as they do
around players. Each cell is the dimension's tick time with nobody anywhere else.

| Dimension | Distance 6 | 5 | 4 | Saved at 4 |
|---|---|---|---|---|
| The Overworld | 92 to 113 ms | 104 | 91 | about 20%, see below |
| The Everbright | 72 to 76 | 64 | 50 | 34% |
| The Everdawn | 60 to 67 | about 51 | 49 | 25% |
| The Otherside | 57 to 60 | 53 | 43 | 27% |
| The Aether, before `aether_spawn_fix.js` | 112 | 98 | 97 | 13% |

- **Why not half,** when 4 runs half the chunks of 6: Minecraft's monster cap is per player (70 for each player
  standing apart), whatever the distance. The same monsters are crowded into fewer chunks, so most of the saving comes
  from spawning and the ground's own ticks.
- **The Overworld's creature count kept growing** during its run (1,541 to 1,905), so its numbers drift.
- **On the test server, with the script itself:** stand-ins in the Aether (9) and the Everbright (4). It lowered the
  Aether 6 → 5 → 4, then the Everbright, within 47 seconds, and the tick time went from 89.5 to 72.5 ms. When the
  stand-ins left, it gave the steps back 2 minutes apart. `/reload` kept the steps, `off` restored everything, and the
  tick time of each dimension was read directly (no fallback warning).

## Test plan (live server)
1. After the upload, `/simdistance` says "On" and shows the distance from `server.properties`.
2. On a busy evening, watch for `[Distance]` lines. `/simdistance` shows which dimension went down and why.
3. If a player's farm stands still while they're away from it, that is the script. `/simdistance off` stops it.

## What couldn't be verified
- **Real players:** stand-ins don't move, fight or farm.
- **Bisect's processor:** if it's faster than the test PC's slower cores, the script will act less often.
- **How players take it:** farms and crops beyond 64 blocks stand still while a dimension is lowered.
