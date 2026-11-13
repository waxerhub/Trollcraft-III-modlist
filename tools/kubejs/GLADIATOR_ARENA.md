# The Gladiator Arena

`server_scripts/gladiator_arena.js` runs PvP matches in an arena that is built in the sky, far from spawn, for each match and taken down afterwards. The arena is the **Large Form arena** schematic: a round walled bowl, 165 × 67 × 165, with trees, rocks and a monument in the middle.

## Starting a match
1. **The tile:** right-click it at spawn. It's any block an op marks with `/gladiator tile set` while looking at it, and the click never opens the block itself.
2. **The window:**
   - **Who fights:** a head for every online player (up to 36). Click to add or take out; whoever opened it starts picked.
   - **Rounds:** 1–9 (3 to start with).
   - **Lives per round:** 1–10 (3 to start with).
   - **Gear:** **own gear**, or one of four preset **kits**: Soldier, Peasant, Archer, Gladiator, as in the Purge.
   - **Send the challenge,** or **Cancel**.
3. **The challenge:**
   - Everyone online hears "Ana calls Bob and Cara to the arena: 3 rounds, 3 lives a round, their own gear."
   - Each player picked gets **[Accept]** and **[Decline]** in chat.
   - **The match starts only once every one of them has accepted,** within 60 seconds. One decline, a logout or the time running out calls it off.
4. **Only one at a time:** while a challenge waits or a match is on, the tile just says what's going on. A Purge and a match can't run at the same time; each refuses to start while the other is on.

## The match
- **The arena rises:**
  - **Where:** at the site, by default centred on x 8000, z 8000, from y 230 to y 296, in the overworld's sky.
  - **How:** its chunks are force-loaded, it checks nothing is already there, then places its 25 pieces, one every 2 ticks (about 3 seconds).
  - **Then:** the fighters are tagged, given a bossbar and taken there.
- **A round:**
  - **The start:** every fighter gets the chosen lives, a spawn point spread around the floor, full health and food, and in a kit match a fresh kit. A 5-second countdown follows, during which nobody can be hurt, then **FIGHT!**
  - **Knockouts:** lethal damage is a knockout, not a death, so nothing drops and there's no corpse. The fighter is healed, gets 3 seconds of Resistance and goes to the spawn point furthest from the others. In a kit match they get a fresh kit.
  - **Out of the round:** losing the last life puts a fighter **out of the round**, up on the wall to watch. A fighter who is out and comes down to the floor is sent back up.
  - **Ring-outs:** leaving the arena counts as a knockout. That means more than 84 blocks from the middle or below its floor, from falling off, an ender pearl or `/home`. A knockout within 10 seconds of a hit goes to whoever hit them.
  - **Winning it:** the **last one standing wins the round**.
  - **Time limit:** a round still going after 10 minutes goes to whoever has the most lives left. A tie means nobody wins it.
- **Between rounds:** 6 seconds, then the next round.
- **Winning the match:** the most rounds won.
  - **Ending early:** it ends as soon as nobody can catch up (3–0 with 2 rounds left).
  - **A tie for the lead:** settled by a **deciding round** between those tied, where the last one standing takes the match. After 3 deciding rounds with no winner it's a draw.
- **Hits:** only between fighters in the current round, while it's being fought. Nobody else can hurt a fighter, and a fighter can't hurt anyone else.
- **The arena is protected:** its blocks can't be broken or built on (creative excepted), explosions in it break no blocks, and no monsters spawn in it.
- **The end:**
  - The result goes to everyone online, for example "Ana wins the gladiator match against Bob and Cara. Rounds won: Ana 2, Bob 1, Cara 0."
  - Every fighter goes back to world spawn, healed and untagged, and in a kit match gets their belongings back.
  - The arena comes down: loose items, experience and arrows are swept, then 75 fills of air, and the chunks are let go.

## Leaving, restarts
- **A fighter who logs out** (or is `/kill`ed) is out of the match for good. With one fighter left, that fighter wins ("the others left"). They're taken home with their belongings when they're next online, or when they respawn.
- **A restart mid-match** ends it with no winner. The arena comes down, and every fighter is taken home with their belongings at their next login.
- **`/reload` mid-match** loses nothing: the match goes on, and a build or take-down under way picks up again.

## Kits and the vault
A kit match holds each fighter's belongings exactly as the Purge does:
- **What's held:** all 41 slots, each stack saved whole (`serializeNBT`, so a bag keeps its contents).
- **Safety:**
  - every stack is checked to rebuild before anything is cleared;
  - a backup file goes in `kubejs/gladiator_vaults/`;
  - KubeJS windows are closed first, since an open window holds the inventory away.
- **If an item can't be stored safely:** nobody fights. Anything already held goes straight back, and nobody is moved.
- **Getting it back:** at the end, the kit is cleared and every stack goes back to its slot. What can't be rebuilt stays in the vault and its file, and ops are told.
- **Curios slots aren't held,** as in the Purge, so worn curios stay on in a kit match.

## Commands
| Command | Who | |
|---|---|---|
| `/gladiator` | anyone | What's going on: who's being waited for, or the round and the score |
| `/gladiator accept <id>`, `/gladiator decline <id>` | the players challenged | What [Accept] and [Decline] run |
| `/gladiator history` | anyone | The last 5 matches |
| `/gladiator menu` | op | Opens the window without the tile |
| `/gladiator tile set` / `clear` | op | The block you look at becomes the tile (or the one under you) |
| `/gladiator site` / `site here` / `site reset` | op | Where the arena goes. `here` centres it on you, from y 230. Not while it's up |
| `/gladiator build` / `clear` | op | Put the arena up without a match, to look at it, or take it down |
| `/gladiator stop` | op | Call off a challenge, or end the match with no winner (everyone home, arena down) |

## Settings (top of gladiator_arena.js)
- **The arena:** `STRUCTURE`, `SIZE`, `PIECE`, `CENTRE`, `SPAWNS`, `STANDS` (these come from the converter, below), `RING_RADIUS`, `FLOOR_RADIUS`, `DEFAULT_SITE`.
- **Building and taking down:** `PIECES_PER_STEP`, `STEP_TICKS`, `CLEAR_SLAB`, `FILLS_PER_STEP`, `LOAD_WAIT_SECONDS`, `HOME_RADIUS`.
- **The rules:** `ROUNDS`, `LIVES`, `INVITE_SECONDS`, `COUNTDOWN_SECONDS`, `BETWEEN_SECONDS`, `ROUND_MINUTES`, `MAX_DECIDERS`, `RESPAWN_RESISTANCE_SECONDS`, `LAST_HIT_SECONDS`.
- **The kits:** `KITS`, `KIT_ORDER`.

**Saved data:** `persistentData["gladiator_arena"]` holds:
- the tile and the site;
- the arena's state (none, building, built, clearing);
- the challenge or the match;
- the vaults;
- who is owed a trip home;
- the last 20 matches.

**API:** `global.Gladiator = { busy(), state(), isFighter(uuid), site(), arenaUp() }`.

## The arena's files
The schematic was turned into vanilla structure pieces by `tools/schematic/schem_to_structures.js`:
```bash
node tools/schematic/schem_to_structures.js Large_Form_arena.schem tools/kubejs/data/trollcraft/structures/gladiator_arena
```
- **The pieces:** 25 pieces of 33 × 67 × 33 (`p_<i>_<k>.nbt`, 476 KB in all), with air left out.
- **The data version:** each keeps the schematic's (2975, Minecraft 1.18.2), so the game upgrades any block that changed.
- **The layout:** the converter also prints the spawn points (16 on the floor, 30–58 blocks from the middle, solid ground with open sky) and the stands (8 on top of the wall), which are pasted into the settings.
- **What's in it:** no chests, signs or mobs, only vanilla blocks.
- **Placing it safely:** none of its concrete powder or anvils sit over air, so nothing falls when it's placed in the sky.

## Install
1. Copy `gladiator_arena.js` to `kubejs/server_scripts/`, and the folder `tools/kubejs/data/trollcraft/structures/gladiator_arena/` to `kubejs/data/trollcraft/structures/gladiator_arena/` (25 `.nbt` files).
2. On a Part II server, also upload `part2/purge.js`, so a Purge won't start during a match.
3. `/reload`.
4. Stand at spawn, look at the block that should be the tile, and run `/gladiator tile set`.
5. **Once, before the first match:** `/gladiator build`, then `/gladiator clear`.
   - The first build at a site generates its 144 chunks, which held the test server up for about 10 seconds.
   - After that, a build takes about 5 seconds with no lag.
   - To use another spot, run `/gladiator site here` far out first.

## Test plan (three players and an op)
1. **The window:** right-click the tile.
   - Pick the others, change rounds and lives, choose a kit, then own gear again.
   - Sending with only yourself picked is refused.
2. **The challenge:**
   - Send it: everyone hears it, and those picked get [Accept] and [Decline].
   - One declines: called off. Send again and let the time run out: called off, naming who didn't answer.
3. **The arena:** everyone accepts.
   - It rises far out in the sky within a few seconds (watch for lag), and everyone is taken to spread spawn points.
   - The bossbar shows the round, lives and wins, and there's a countdown.
4. **A round:** fight. A lethal hit heals and moves the fighter, the last life puts them on the wall, and the last one standing wins the round.
5. **A ring-out:** jump off the edge. You're back on the floor with one life fewer.
6. **The end:**
   - Win the match: everyone hears the result and goes back to spawn.
   - The arena comes down, so check from far away that nothing is left.
7. **A kit match:**
   - Your inventory is the kit, and a knockout gives a fresh one.
   - At the end your own things are back, in their slots.
8. **Leaving:** log out mid-match. The other fighter wins, and on logging back in you're taken to spawn.
9. **Protection:** try to break the arena's blocks, place blocks in it, and blow up TNT in it. Nothing changes.

## Checked on the local test server (13 Nov 2026)
- **Loading:** the script loads with 0 errors (22 of 22 scripts), and the 25 pieces load from `kubejs/data/`.
- **The first build** at 8000, 8000: built in about 10 seconds. The server fell 10 seconds behind once, while the site's chunks generated for the first time.
- **Placed correctly:** seven reference blocks across the arena:
  - the diorite floor's middle;
  - the monument's top wall (`up=true`);
  - the wall's cobbled deepslate;
  - grass on the floor;
  - dark oak wood (`axis=y`);
  - a top-half brick stair facing south;
  - air below the floor.
- **Taking it down, rebuilding, taking it down again:** about 5 seconds each, with **no lag warnings**.
  - Afterwards, the same blocks are air and no items are left.
  - No chunks stay force-loaded.

## What couldn't be verified
- **The window, the challenge, and fighting:** these need real players. They're covered by the mock tests (81 checks), not the server.
- **Lag on the live server:** the test server had no players on it, and the hosting differs.
- **The look in the sky:** the arena is a floating island above the clouds, and its underside is the bottom of the schematic.
