# Reducing latency: a deep dive

Written 23 November 2026, for the Part II server with the Aether and Deeper and Darker (and Blue Skies, on the test
server only). Everything marked *measured* was run on the test server (the owner's PC: 24 cores, 32 GB; nobody online; 6 GB or 12 GB of
memory). **The live server was not measured.** Its hardware, player load and machines decide the real numbers.

## Update, 25 November 2026: measured with players

The first tests had nobody online, so they missed what players cause. This time nine stand-in players (Forge's
FakePlayer, which loads chunks and lets creatures spawn and act around it as around a player) stood 340 blocks apart in
one dimension. The test ran on the PC's slower cores with the owner's game running.

| Dimension | Tick time, 9 stand-ins apart, distance 6 | Per player | Entities loaded |
|---|---|---|---|
| The Overworld | 92 to 113 ms | 10 to 12 ms | 1,541 to 1,905 |
| The Aether | 93 to 112 ms | 10 to 12 ms | 950 to 1,005 |
| The Aether with `aether_spawn_fix.js` | 50 ms | 5.5 ms | about 980 |
| The Everbright | 72 to 76 ms | 8 ms | 1,315 to 1,335 |
| The Everdawn | 60 to 67 ms | 7 ms | 739 to 865 |
| The Otherside | 57 to 60 ms | 6.5 ms | 1,052 to 1,100 |

What this changes:
- **Per player, the new dimensions cost no more than the Overworld,** except the Aether, which had a flaw (fixed, below).
- **The old estimate was far too low.** "Nine players apart: about 10 to 15 ms", worked out from chunks held with nobody
  online, is really 57 to 113 ms on these cores. Bisect's processor is probably faster, but the comparison holds.
- **Natural spawning is a big part of it.** With players around, Minecraft tries to spawn every kind of creature in
  every running chunk, every tick, until the caps are full. In the profiles it was 14% of the time in the Overworld,
  whose caps fill, then 34% in the Otherside, 51% in the Everdawn and 78% in the Aether. Creatures ticking was 75% in
  the Overworld and 13 to 45% in the others. The earlier "81% creatures" was with nobody online, where nothing spawns.
- **The Aether's flaw:** for each possible Swet spawn, the Aether looked at about 268,000 blocks for a Swet banner. That
  was 42% of the time. `startup_scripts/aether_spawn_fix.js` gives the same answers without the scan and halves the
  Aether's tick time (`tools/kubejs/AETHER_SPAWN_FIX.md`).
- **The adaptive distance script is built** (`tools/kubejs/ADAPTIVE_DISTANCE.md`). Going from 6 to 4 saved 13 to 34%,
  not half: the monster cap is per player, so the same monsters crowd into fewer chunks.

**One more option, not shipped: skipping spawn tries that can't succeed.** Minecraft also tries kinds that never spawn in
a dimension, such as water creatures in the Aether, or the Aether's own kinds outside the Aether. The Aether adds four
spawn categories and Alex's Caves two, and each is tried everywhere. A one-class server mod written for this test
(`research/spawnskip/`) skips them, and nothing else changes. Measured with nine stand-ins:

| Dimension | Without it | With it |
|---|---|---|
| The Everbright | 60 ms | 48 |
| The Everdawn | 52 to 54 | 43 to 45 |
| The Otherside | 41 to 48 | 30 to 33 |
| The Aether, with its fix | 50 | 42 |
| The Overworld | no clear difference (its creature count kept climbing during the test) | |

It's a compiled Java mod, a new kind of file for this server, so it's the owner's call.

**The biggest cost left is in the Overworld:** creatures ticking (75%). That's what ServerCore's activation range (#5
below) is for; it's untested.

## The short answer (23 November)

- **The time goes on creatures, not on dimensions.** In a loaded world, 81% of the server's time was creatures ticking.
  An empty dimension costs 0.01 to 0.03 ms a tick. *(With nobody online. With players, natural spawning is a large
  part too: see the update above.)*
- **Limiting how many dimensions are occupied would save little.** It doesn't change how much ground each player keeps
  loaded, which is what costs. See "The dimension-limit idea".
- **Best first steps:** profile the live server (below), limit chunk loaders, and add a script that lowers the
  simulation distance when the server struggles and raises it again when it's fine. A Lithium-style mod is the one
  that could cut the cost of each creature, and it needs testing.

## What the tick goes on (*measured*)

A 70-second profile (Java Flight Recorder) of the server thread with 2,304 chunks held in each of the four new
dimensions, on the PC's slower cores: the thread was busy more than 99% of the time.

| Part | Share of the server's time (a part can be inside another) |
|---|---|
| Creatures and other entities ticking | 81% |
| — of which movement and collision | 23% |
| — of which AI goals and targets | 13% |
| — of which other mods' hooks that run for each creature | 14% |
| — of which brains (villagers and the like) | 3% |
| Natural spawning | 3% |
| Block entities (machines and such; few in the test world) | 1% |
| This server's own KubeJS scripts (nobody online) | 0.1% |
| World saving | 0.4% |

- **The Aether's flying animals and Blue Skies' Azulfo stand out:** the Aether's code for its rideable and winged
  animals was on the thread for 15% of the time, and the Azulfo's for 9%.
- **About a fifth of the time is block and chunk lookups** (`PalettedContainer`, `ServerChunkCache`, hash maps), which
  creature movement and fluid checks trigger. That's the kind of work Lithium-style mods speed up.
- **Other mods' hooks:** each creature's tick also runs code from other mods (Ice and Fire, Mowzie's Mobs, Quark,
  Mekanism, Curios, Aether armour checks and more). Each is small; together 14%.
- **Memory pauses are not a problem here:** at 6 GB and with 9,216 chunks held, 61 garbage collections in five and a
  half minutes, half of them 6 ms or less and the longest 24 ms. About 3 GB was left in use after each.
- **World saves are not a problem here:** the autosave at 23:04 with 9,216 chunks held took about a quarter of a second
  of the server's time, and a full `save-all flush` on slower cores 1.9 seconds as seen from the console. The live
  server's disk is different; see "First steps".

## How the load scales (*measured*)

All four new dimensions held together, the same amount in each, on fresh ground, nobody online:

| Held in each dimension | Total | Tick time, all cores | TPS | Tick time, slower cores | TPS |
|---|---|---|---|---|---|
| 1,024 chunks | 4,096 | 26 ms | 20 | 41 ms | 20 |
| 2,304 chunks | 9,216 | 47 ms | 20 (at the limit) | 77 ms | 13 |
| 4,096 chunks | 16,384 | 75 ms | 13 | not tested | |

A tick has 50 ms. Per dimension at 1,024 chunks: Everbright 13 ms, Everdawn 6, Aether 5, Otherside 1. They simply add
up (25 ms, against 26 measured), so there is no extra cost for a dimension being in use.

Two things matter for reading this:
- **What a player keeps running:** at the test server's `simulation-distance` of 6, one player makes about 169 chunks
  run creatures. Nine players spread apart come to about 1,500. The 1,024-each row is more than twice that.
- **The table was measured with nothing else heavy running.** A later repeat of the 2,304-each load, with the PC's game
  client open and the profiler recording, took 62 ms a tick instead of 47. Bisect's processor is unknown.

## The dimension-limit idea

The idea: a script that keeps more than three dimensions from being occupied at once.

**What it would do to the cost:**
- The cost follows *how many separate areas of chunks are running creatures*, not which dimensions they're in. Nine
  players each in their own area is about 1,500 running chunks, whether the areas are in one dimension or nine.
  (1,521 chunks × 0.0064 ms on fast cores ≈ 10 ms; ≈ 15 ms on slower cores. *Corrected on 25 November: measured with
  stand-ins, it's 57 to 113 ms on slower cores. See the update above.*)
- With at most three dimensions, nine players can still be in nine areas, so the cost doesn't change.
- It would only save time if it also kept players near each other. Three groups of three at the same spot would be
  about 500 running chunks: a saving of about 6 ms on fast cores and 10 ms on slower ones. That's a rule about staying
  together, not about dimensions.
- An empty dimension costs almost nothing (0.01 to 0.03 ms a tick, measured), so shutting the others saves nothing.

**What it would cost players:** someone couldn't enter the Nether, the End, Twilight Forest, the Aether or a Blue Skies
dimension while other people are elsewhere, and the rules for deaths, portals, logging in, `/back` and `/home` would
all need handling so nobody is trapped.

**It can be built** (`dimension_gates.js` already sends players back from sealed dimensions), but I'd put it last.

## What to do instead (ranked)

| # | Change | What it does | Evidence | Effort |
|---|---|---|---|---|
| 1 | **Profile the live server** (below) | Shows what really slows your server: creatures, a machine, a mod, the disk | needed first | 10 minutes of your time |
| 2 | **Cap chunk loaders** (`config/ChickenChunks.cfg`). *Since replaced: all chunk loading is being switched off (owner, 25 November 2026; `tools/kubejs/CHUNK_LOADER_BAN.md`). That search also found that flying an Alex's Mobs eagle force-loads every chunk it passes for good* | Stops thousands of always-running chunks. The test server allows 5,000 chunks per player, even offline | *measured*: the load scales with running chunks | a config file |
| 3 | **Adaptive simulation distance (a script).** *Built: `tools/kubejs/ADAPTIVE_DISTANCE.md`; from 6 to 4 saved 13 to 34% (25 November)* | Watches the tick time; when it's high, lowers the distance players run creatures at (6, then 5, then 4), and raises it back when it's fine | *feasible* (a script can change it: tested). At 4 instead of 6, each player runs 81 chunks instead of 169, about half | one KubeJS script, needs a balance decision |
| 4 | **Test a Lithium-style mod**, Radium Re-Reforged 0.15.0 (a Forge 1.20.1 build) | Cheaper creature AI, collisions and block lookups | claimed by its page; not tested here. The page doesn't mention Create, Alex's Mobs or Twilight Forest; it fixes known conflicts with Ice and Fire | test on the test server first |
| 5 | **Test ServerCore** 1.5.0 (Forge 1.20.1) | Entity activation range (creatures far from players tick less often) and dynamic distances. Its settings are off by default | claimed by its page; not tested here | test first |
| 6 | **Thin the crowded dimensions' creatures** | Fewer creatures to tick in new ground | *measured*: creatures are most of the cost | a data file; only affects new ground |
| 7 | **`sync-chunk-writes=false`** in `server.properties` | Saves don't wait for the disk. Already off on the test server; check the live server's | known setting | a one-line check |
| 8 | **Java memory flags** (`-Xms`, G1 tuning) | Smoother memory pauses. The test's pauses were short (24 ms at most), so a small gain at most | *measured* | low |
| 9 | **Lower `view-distance` and `entity-broadcast-range-percentage`** | Less network and chunk loading for players, not fewer creatures running | known settings | a config change |

**Also from earlier work:** pregenerate the new dimensions (`tools/serverconfig/PREGENERATION.md`). It removes lag while
exploring, not the cost of creatures.

### 1. Profile the live server first

This is the missing piece: your real players, machines and hardware. On the live server's console (no slash):

```
spark tps
spark health
spark profiler start
```

Wait about five minutes **while people are playing**, then:

```
spark profiler stop --save-to-file
```

It writes `config/spark/profile-<date>.sparkprofile` and says so; it does not upload anything. (Without
`--save-to-file` it uploads the profile to spark's website.) Send me that file and the `spark tps` and `spark health`
output. `spark tps` alone also tells whether the server is lagging at all.

### 3. How the adaptive script would work

Every few seconds it reads the tick time (`getAverageTickTime`). Above about 40 ms for a while, it lowers the simulation
distance by one, down to 4; below about 30 ms it raises it again, up to the server's normal setting. Nobody is blocked
from going anywhere. The cost is that farms and machines more than a few chunks from a player slow down while it's on,
which is why it's a balance decision. It would be tested here before you use it.

### 4 and 5. Testing the mods

Each needs its jar on the test server (a CurseForge or Modrinth download), then the same held-chunk test before and
after. I'd test one at a time. Radium Re-Reforged and Canary do the same job, so only one of them should be installed.

## What I couldn't measure

- **The live server:** its hardware, disk, memory and the players' machines. A profile (step 1) answers this.
- **Players in the test:** nobody was online, so natural spawning around players, network traffic and machines weren't
  part of it. The dimension costs above are creatures that generate with the ground. *(Stand-in players were measured
  on 25 November: see the update. Network traffic and machines still weren't.)*
- **Mods for creature speed:** only their pages were read.
- **Bisect's actual disk and autosave cost.** On the test server, the autosave I timed was quick (about a quarter of a
  second). On 22 November the same server paused for 5 to 10 seconds several times with nobody on. Some pauses came
  with a world save (the log shows it starting in the same second), and two didn't. I don't know the cause; the PC or a
  background program is possible.
- **Two other test-server notes:** its PC slept for parts of 22 November, which explains the 17-minute stalls (Windows'
  power log shows it). And the chunks held for the test came back after a restart, because Minecraft's
  `forceload remove` seems to save the change only when the last chunk it removes was held. They're released now, and
  the file on disk is empty; from 22:58 to 23:06 on 23 November, though, the server was running that full load again
  while the PC's game client was starting.

## Sources

- [ServerCore on Modrinth](https://modrinth.com/project/servercore) and its Forge 1.20.1 file page
  ([CurseForge, file 5230942](https://www.curseforge.com/minecraft/mc-mods/servercore/files/5230942)); its feature list
  (activation range, dynamic distances, off by default).
- [Radium Re-Reforged](https://www.curseforge.com/minecraft/mc-mods/radium-re-reforged): the Forge 1.20.1 build, what it
  optimises, known conflicts.
- [Canary on CurseForge](https://www.curseforge.com/minecraft/mc-mods/canary): the Forge 1.20.1 build, last updated
  February 2024.
- The mods' pages list server-side or both sides inconsistently, so check each file's page before installing.
