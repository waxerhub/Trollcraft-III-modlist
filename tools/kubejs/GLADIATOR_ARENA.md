# The Gladiator Arena

`server_scripts/part2/gladiator_arena.js` (**Part II only**) runs PvP matches in an arena that is built in the sky, far from spawn, for each match and taken down afterwards. The arena is the **Large Form arena** schematic: a round walled bowl, 165 × 67 × 165, with trees, rocks and a monument in the middle.

## Starting a match
1. **The statue:** right-click it at spawn.
   - **What it is:** an armour stand in a heroic pose, in gold-trimmed netherite with its sword raised and a shield, under a floating title "⚔ THE GLADIATOR ARENA ⚔ / Right-click to fight".
   - **Putting it up:** an op runs `/gladiator tile set` standing where it should go, facing the way it should face (rounded to 45°).
   - **Clicking it:** an invisible click box around it takes the click.
   - **Protection:** its gear can't be taken (`DisabledSlots`), and it can't be hurt (except by a player in creative).
2. **The window:**
   - **Who fights (rows 1–3):** a head for every online player (up to 27). Click to add or take out; whoever opened it starts picked.
   - **Gear (rows 4–5):** **own gear**, or one of the **14 kits** (below).
   - **The bottom row:** **rounds** 1–9 (3 to start with), **lives per round** 1–10 (3 to start with), **Cancel** and **Send the challenge**.
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
  - The arena comes down. First everything lying in it that isn't a creature or a player is swept away: items, experience, arrows, tridents, thrown spears, the block and chain. Then 75 fills of air, and the chunks are let go.

## Leaving, restarts
- **A fighter who logs out** (or is `/kill`ed) is out of the match for good. With one fighter left, that fighter wins ("the others left"). They're taken home with their belongings when they're next online, or when they respawn.
- **A restart mid-match** ends it with no winner. The arena comes down, and every fighter is taken home with their belongings at their next login.
- **`/reload` mid-match** loses nothing: the match goes on, and a build or take-down under way picks up again.

## The kits
Every kit item is marked as arena issue and taken back at the end. Endgame gear in a kit, and anything the Blood Pool seals, never leaves the arena. Each kit also has 16 steak (the Troll Smasher: plus 4 golden apples).

| Kit | Weapons | Armour |
|---|---|---|
| Soldier | iron sword, bow, 32 arrows, shield | iron |
| Peasant | wooden sword, 8 bread (instead of steak) | leather |
| Archer | bow, 64 arrows, stone sword | chainmail |
| Gladiator | diamond sword (Sharpness I), diamond axe, 4 golden apples | diamond |
| Troll Smasher | a troll's war hammer (Ice and Fire): slow, huge knockback | mountain troll leather |
| Fire / Ice / Lightning Dragonslayer | that dragonsteel sword, dragonbone bow, 32 dragonbone arrows | that dragonsteel |
| Twilight Knight | knightmetal sword, the block and chain (a thrown flail), knightmetal shield | knightmetal |
| Twilight Ranger | triple, seeker (homing) and ice (slowing) bows, 64 arrows, ironwood sword | steeleaf |
| Myrmex Venom | desert venom sword (poisons), red death worm gauntlet (pulls people in) | desert myrmex |
| Caveman | primitive club (stuns), two limestone spears to throw | primordial helmet, tunic and pants, leather boots |
| Terra Knight | the Terra Blade (swings fire a beam) | terrasteel |
| Saber Duel | a brass saber and a double-bladed one (right-click to light them) | none |

- **Every item is checked:** each is in the Part II pack's item index.
- **Nothing needing setup:** no kit uses mana, energy or ammunition items. Weapons that summon mobs wouldn't work, because no monsters can spawn in the arena.
- **Adding a kit:** add an entry to `KITS` and its id to `KIT_ORDER`. The window has room for 17.

## The Blood Pool and progress
Nothing in the arena counts towards the Blood Pool or anyone's progress:
- **A knockout is no kill.**
  - **How:** the script loads early (`// priority: 100`), so its death handler cancels a knockout before any other script sees it. A cancelled event goes no further.
  - **So:** Blood Harvest pays no Drops into the Pool, bounties don't pay out, and there are no Souls, Grit or Iron Blood. The same goes for the Syndicate Slayer's healing, Portal Ambush and the rest.
  - **Checked live:** a probe loaded after the arena saw none of a fighter's knockouts, but did see a real death.
- **Kit gear never leaves the arena:**
  - At the end, every fighter's inventory is cleared before their own things come back, and everything left lying in the arena is swept away.
  - In a kit match, the worn **Curios** and **Tool Belt's belt slot** are held too, so there's no belt, backpack or wireless terminal to hide gear in.
  - Every 10 seconds (`STRIP_SECONDS`), anyone not in a kit match loses any arena kit item they carry, in their inventory, curios or ender chest, and is told.
- **Advancements earned in a match are revoked** when the fighter goes home (or next logs in). This matters because Twilight Forest opens its areas by advancements, and kit gear earns some the moment it's handed out (the Caveman kit: Encino Man, Law of Club and Fang). Recipe-book unlocks are left alone.
- **Quests:** no Potato War item task asks for a kit item. They want ingots, and hand-ins are used up.
- **Use-locks:** none of the kit items are among the Blood Pool's `USE_LOCKS`, so they work in the arena at any tier.

## The vault
A kit match holds each fighter's belongings exactly as the Purge does, plus their worn curios and Tool Belt's belt slot:
- **What's held:** all 41 slots, each stack saved whole (`serializeNBT`, so a bag keeps its contents).
- **Safety:**
  - every stack is checked to rebuild before anything is cleared;
  - a backup file goes in `kubejs/gladiator_vaults/`;
  - KubeJS windows are closed first, since an open window holds the inventory away.
- **If an item can't be stored safely:** nobody fights. Anything already held goes straight back, and nobody is moved.
- **Getting it back:** at the end, the kit is cleared and every stack goes back to its slot. What can't be rebuilt stays in the vault and its file, and ops are told.
- **Curios and the belt slot:** unlike the Purge, a kit match holds worn curios and Tool Belt's belt slot as well, and puts them back in their slots at the end (or in the inventory if a slot is taken).

## Commands
| Command | Who | |
|---|---|---|
| `/gladiator` | anyone | What's going on: who's being waited for, or the round and the score |
| `/gladiator accept <id>`, `/gladiator decline <id>` | the players challenged | What [Accept] and [Decline] run |
| `/gladiator history` | anyone | The last 5 matches |
| `/gladiator menu` | op | Opens the window without the tile |
| `/gladiator tile` | op | Where the statue is |
| `/gladiator tile set` | op | Puts the statue up where you stand, facing your way (an old one goes) |
| `/gladiator tile fix` / `clear` | op | Rebuild the statue where it was (if it's been killed), or take it away |
| `/gladiator site` / `site here` / `site reset` | op | Where the arena goes. `here` centres it on you, from y 230. Not while it's up |
| `/gladiator build` / `clear` | op | Put the arena up without a match, to look at it, or take it down |
| `/gladiator stop` | op | Call off a challenge, or end the match with no winner (everyone home, arena down) |

## Settings (top of gladiator_arena.js)
- **The arena:** `STRUCTURE`, `SIZE`, `PIECE`, `CENTRE`, `SPAWNS`, `STANDS` (these come from the converter, below), `RING_RADIUS`, `FLOOR_RADIUS`, `DEFAULT_SITE`.
- **Building and taking down:** `PIECES_PER_STEP`, `STEP_TICKS`, `CLEAR_SLAB`, `FILLS_PER_STEP`, `LOAD_WAIT_SECONDS`, `HOME_RADIUS`.
- **The rules:** `ROUNDS`, `LIVES`, `INVITE_SECONDS`, `COUNTDOWN_SECONDS`, `BETWEEN_SECONDS`, `ROUND_MINUTES`, `MAX_DECIDERS`, `RESPAWN_RESISTANCE_SECONDS`, `LAST_HIT_SECONDS`, `STRIP_SECONDS`.
- **The kits:** `KITS`, `KIT_ORDER`.
- **The statue:** `TILE_TAG`, `TITLE`, `TITLE_HEIGHT`, `STATUE_POSE`, `TRIM`, `STATUE_ARMOR`, `STATUE_HANDS`.

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
1. Copy `part2/gladiator_arena.js` to `kubejs/server_scripts/part2/`, and the folder `tools/kubejs/data/trollcraft/structures/gladiator_arena/` to `kubejs/data/trollcraft/structures/gladiator_arena/` (25 `.nbt` files).
2. Also upload `part2/purge.js`, so a Purge won't start during a match.
3. `/reload`. It has to be the full `/reload`: `/kubejs reload server_scripts` reloads the script's events but not its `/gladiator` commands, which would then still run the old copy. On the test server that made [Accept] say the challenge wasn't open.
4. Stand at spawn where the statue should go, face the way it should face, and run `/gladiator tile set`.
5. **Once, before the first match:** `/gladiator build`, then `/gladiator clear`.
   - The first build at a site generates its 144 chunks, which held the test server up for about 10 seconds.
   - After that, a build takes about 5 seconds with no lag.
   - To use another spot, run `/gladiator site here` far out first.

## Test plan (three players and an op)
1. **The window:** right-click the statue.
   - Pick the others, change rounds and lives, look through the 14 kits, choose one, then own gear again.
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

**Played with two players (13 Nov 2026),** with Sipheon and leelinda, over seven matches:
- **Starting matches:**
  - The statue ("looks fantastic"), the window and the challenge with [Accept] all worked.
  - A challenge left unanswered was called off after 60 seconds.
  - The arena was up about 10 seconds after the last accept.
- **The fighting:**
  - Knockouts, the wall for fighters who are out, rounds and the bossbar all worked.
  - A ring-out by ender pearl pulled the fighter back.
  - A round that hit the 10-minute limit with equal lives went to a deciding round.
  - `/kill` gave a walkover, and `/gladiator stop` ended a match.
- **Kits:** the Gladiator, Archer, Caveman and Twilight Knight kits; Caveman spears thrown and left lying were swept away.
- **Belongings:** inventories came back whole (Sipheon 24 stacks, leelinda 11), and so did a Tool Belt worn in a Curios slot.
- **The Blood Pool checks:**
  - **Knockouts:** none of a fighter's knockouts reached a probe loaded after the arena, and a real death did.
  - **Advancements:** both Alex's Caves advancements the Caveman kit earns were revoked from each fighter as the match ended.
- **Feedback acted on:**
  - the statue instead of a block;
  - Sharpness I on the Gladiator kit's sword;
  - the advancement revoke;
  - the Blood Pool checks.

## What couldn't be verified
- **Tool Belt's own belt slot:** held in kit matches, but only in the mock tests. Nobody on the test server wore a belt there.
- **The other modded kits in a fight:** Troll Smasher, the Dragonslayers, Twilight Ranger, Myrmex Venom, Terra Knight and Saber Duel were built and shown in the window, and their items are in the pack's index, but nobody fought with them yet.
- **A `/kill`ed fighter's corpse:** in an own-gear match, a fighter `/kill`ed by an op leaves a corpse (Corpse mod) holding their real things. The sweep sends corpses to world spawn rather than away. That's mock-tested only, since nobody was `/kill`ed in an own-gear match.
- **Lag on the live server:** the test server had no players on it, and the hosting differs.
- **The look in the sky:** the arena is a floating island above the clouds, and its underside is the bottom of the schematic.
