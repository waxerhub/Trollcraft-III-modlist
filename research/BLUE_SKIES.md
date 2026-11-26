# Blue Skies on the Part II server: stress test

`blue_skies-1.20.1-1.3.31.jar` with `structure_gel-1.20.1-2.16.2.jar` (its required API), tried on the test server on
22–23 November 2026, on top of the pack with the Aether and Deeper and Darker. The question was how much lag it adds.
**It isn't in the pack:** the owner's call. Its progression (its gear against the Blood Pool's tiers) hasn't been
read yet. The heavier test with all four new dimensions together, and what to do about lag, is in
[LATENCY_DEEP_DIVE.md](LATENCY_DEEP_DIVE.md).

**Corrections (23 November):** the first version of this page had some wrong or unchecked statements. They're fixed
below: the 206 ms tick, what happened to the creatures, how much disk a chunk takes, the number of "new" log lines,
and the claims about portals.

**Rolling back the test server:** the world from just before is in
`trollcraft-test-server/backups/world_2026-11-22_before_blueskies` (436 MB). Removing the two jars without restoring it
leaves Blue Skies' blocks and chunks in the world as missing entries. (The test world has since had chunks generated
and held for testing, and Everbright creatures removed in places.)

## The jars

- **Blue Skies 1.3.31:** needs Forge 47.1 or later, Minecraft 1.20.1, Structure Gel 2.13 or later. 84 MB.
- **Structure Gel API 2.16.2:** Forge 47.1 or later, Minecraft 1.20.1. Both sides (server and every player).
- **Two dimensions,** `blue_skies:everbright` and `blue_skies:everdawn`: 384 blocks tall (the Aether is 256, the
  Otherside 128), with the Overworld's x and z (`coordinate_scale` 1.0).
- **At each start it fetches a supporters list** from moddinglegacy.com (2 seconds on the test server), on a thread of
  its own. Forge's usual version check also asks its site.

## Results of the first test

Test PC, no players online. Same methods as the Aether and Deeper and Darker run (`AETHER_DEEPERDARKER.md`): Chunky, a
400-block square (2,601 chunks) at 0, 0; then a crowd of creatures in one force-loaded spot in the Overworld; spark for
ticks and memory. One run each, so small differences don't mean much.

**Starting and reloading:**
| | Before | With Blue Skies |
|---|---|---|
| Startup (first log line to "Done") | 46.5 s | 47.4 s |
| Recipes | 39,260 | 40,114 (+854) |
| Datapack load (about what each tier's `/reload` costs) | 11.2 s | 11.9 s |

No error named Blue Skies or Structure Gel at startup. The other new lines included Forge's usual registry-ID notices
for a mod added to an existing world and Blue Skies' config files being written.

**Generating new ground** (2,601 chunks each; a minute's slowest tick after each):
| Dimension | Time | Average rate | Slowest tick after |
|---|---|---|---|
| The Aether | 19 s | 137 a second | 52 ms |
| The Otherside | 31 s | 84 a second | 35 ms |
| **The Everbright** | 31 s | 84 a second | 52 ms |
| **The Everdawn** | 32 s | 81 a second | 119 ms (one tick) |

In later, larger runs the rates were: Everbright 119 a second (16,129 chunks in 2 minutes 16 seconds), Everdawn 115,
with no lag warnings; the Otherside about 61 to 84 a second and the Aether 137 to 296, depending on the area.
TPS stayed at 20 (19.95 at the lowest) while generating.

**Disk:** 16,129 chunks (a 1,000-block square) took 152 MB in the Everbright and 158 MB in the Everdawn: about 10 KB a
chunk (the first version said 12 and 14, from a smaller area).

**A crowd of creatures** (31 kinds of its ordinary creatures; no bosses or their parts):
| Crowd | Ticks (fastest / median / 95% / slowest, last 10 s) | TPS |
|---|---|---|
| Aether and Deeper and Darker: 218 summoned | 4.7 / 9.3 / 15.6 / 22.1 ms | 20 |
| Blue Skies: 217 summoned, 137 still alive after 25 s | 4.7 / 8.7 / 17.9 / 206 ms | 20 |
| Blue Skies: another 217, 276 alive | 6.3 / 11.0 / 18.2 / 25.0 ms | 20 |

Some of the 217 had died by then; which ones and why wasn't checked beyond the flatfish (a fish, all gone by the second
check). The one 206 ms tick was in the 10 seconds before the reading (about 25 seconds after the last creature was
summoned); its cause is unknown.

**Memory** (spark's snapshot, which moves with garbage collection, so roughly): 2.4 GB at the start, 3.3 GB after both
dimensions, 4.2 GB with the 276 creatures, of 6 GB. Later checks: about 3 GB is left in use after a garbage collection
(`LATENCY_DEEP_DIVE.md`), so memory isn't what limits it.

## With players (25 November)

Nine stand-in players apart in one dimension (`LATENCY_DEEP_DIVE.md`, "Update, 25 November 2026"): the Everbright
took 72 to 76 ms a tick and the Everdawn 60 to 67, against 92 to 113 for the Overworld under the same test. So a
player in Blue Skies costs less than one in the Overworld. Half of the Everdawn's time went on Minecraft's spawn
tries, much of it on kinds of creature that never spawn there (`research/spawnskip/`).

## What it would add

- **Tick time, not memory:** creatures are what cost. Held to 4,096 chunks, the Everbright cost 21.7 ms a tick with its
  1,084 creatures and items, and 2.75 ms with them removed. The Overworld (29 ms) and the Aether (17 ms) cost similar
  amounts at the same size.
- **Two more dimensions** for players to spread over, each about as costly as the Aether per chunk of loaded ground
  (the Everbright more on the ground tested).
- **Exploring new ground** in either dimension can cost a long tick now and then (119 ms once while generating the
  Everdawn). Pregenerating around spawn and the bases takes that away (`tools/serverconfig/PREGENERATION.md`).
- **Joining and tier openings:** under a second more on each `/reload`.

## Not tested

- Its bosses and dungeons, with players fighting in them.
- Players in its dimensions: only the server was measured, not their frame rate.
- **Portals,** in game. *Read from the mod's data on 25 November:* they start in Gatekeeper houses in the Overworld,
  lit with a Zeal Lighter (8 emeralds from the Gatekeeper), and their frames can later be crafted from stone found in
  the dimensions (`tools/serverconfig/PREGENERATION.md`).
- Its progression: its gear, and its own rule that tools and weapons from outside its dimensions work poorly inside them
  ("It seems this tool doesn't work as well here", in its language file), against the Blood Pool's tiers. That would be
  the next read-through, as for the Aether and Deeper and Darker.
