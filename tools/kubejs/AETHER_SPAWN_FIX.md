# The Aether's spawn fix

A flaw in the Aether (1.5.2) makes it the most costly dimension per player. This fix gives two of its creatures the
same spawn rules without the flaw. It was found while measuring the new dimensions with stand-in players, on
25 November 2026 (`research/LATENCY_DEEP_DIVE.md`).

## The flaw
- **Swets:** each time a Swet could spawn naturally, the Aether checks for a Swet banner by looking at every block
  within 40 blocks, a ball of about 268,000 blocks. On the test PC's slower cores that check took 5 to 8 ms. With nine
  players spread over the Aether it was **42% of the server's time**, and natural spawning as a whole was 78%.
- **Aechor Plants:** one time in ten, the Aether makes the same kind of scan for enchanted flowers. That was 5% of the
  time, and 12% once the Swets were fixed.

## The fix
`startup_scripts/aether_spawn_fix.js` replaces the spawn rules of the blue Swet, the golden Swet and the Aechor Plant
(Forge's `SpawnPlacementRegisterEvent`, `REPLACE`):
- **Swets: the same answer, without the scan.** Banners are block entities, so only the block entities of the chunks
  within 40 blocks are looked at. A standing black banner with the Swet pattern within 40 blocks still stops them, and
  so does an armour stand wearing a Swet Cape within 40 (these are the Aether's own rules, read from its code). One
  difference: chunks that aren't loaded are skipped, where the Aether's scan would load them.
- **Aechor Plants: the Aether's own scan, less often.** Its answer is remembered for each chunk for 5 minutes. So
  enchanted flowers planted or removed near a spot can take up to 5 minutes to count there.
- **Everything else is unchanged:** spawners, spawn eggs and anything other than natural spawning use the Aether's own
  rule. So does natural spawning if anything in the fix fails, with one warning in the log.

## Measured (test server, 25 November 2026)
Nine stand-in players 340 blocks apart in the Aether, simulation distance 6, on the PC's slower cores:

| | The Aether's tick time |
|---|---|
| The Aether's own rules | 93 to 107 ms |
| With the fix | 50 ms |

- **The same answers:** on the test server, the fixed Swet rule was compared with the Aether's own at 445 spots. They
  were near a real Swet banner, at its 40-block edge and far from it, near one on a wall, and near a plain black
  banner. There were no differences. Each check took about 0.2 ms instead of 5 to 8.
- **The same spawning:** after 150 seconds each way, around the same stand-ins, there were 4 Swets and 72 Aechor Plants
  with the Aether's own rules, and 4 Swets and 63 Aechor Plants with the fix. Swets are few either way because the
  Aechor Plants, which never move, fill most of the spawn cap the two share.
- **It caught a mistake:** the first version looked for a white banner, from a misreading of the code. Only that
  comparison showed it. The Aether's check is for a black banner (Minecraft's `Blocks.f_50429_`), standing, not on a wall.
- **The offline tests** compare both rules with the Aether's at thousands of made-up spots
  (`tools/tests/suites/aether_spawn_fix.test.js`).

## Install
Copy `startup_scripts/aether_spawn_fix.js` to the server's `kubejs/startup_scripts/` and restart. It's server only:
players don't need it, and it does nothing without the Aether. The log then says
`[AetherSpawnFix] 3 of 3 spawn rules replaced`.

It never logs an error while the game starts. KubeJS refuses to start the server if a startup script does (seen on the
test server).

## Settings (top of aether_spawn_fix.js)
| Setting | Default | |
|---|---|---|
| `RADIUS` | 40 | The Aether's own distance for banners, Swet Capes and enchanted flowers |
| `NEAR_RADIUS` | 10 | The Aether's own distance for flowers right next to an Aechor Plant |
| `LIGHT` | 8 | The Aether's own: brighter than this |
| `BANNER` | the black banner | The Aether's own |
| `FLOWER_SECONDS` | 300 | How long a chunk's answer about enchanted flowers is remembered |
| `REMEMBER_AT_MOST` | 6000 | Chunks remembered; past that, it starts afresh |

**API:** `global.AetherSpawnFix = { on, stats() }`. Set `on = false` from a script to go back to the Aether's own rules
until the next restart. `stats()` gives the rules replaced, the checks made, the flower scans and the last problem.

## Test plan (live server)
1. After the restart, the log shows `3 of 3 spawn rules replaced`.
2. Swets and Aechor Plants still appear in the Aether.
3. A Swet banner (black, with the Swet pattern) still keeps Swets away within 40 blocks.

## What couldn't be verified
- **The Swet Cape on an armour stand,** in game: only the offline tests cover it, following the Aether's code.
- **The Aechor Plant rule spot by spot on the server:** only the Swets were compared there. The offline tests compare
  both.
- **A later Aether version:** if its classes change, the script warns and the Aether's own rules stay. Re-check after
  any update of the Aether.
