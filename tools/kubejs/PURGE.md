# The Purge (Part II)

`server_scripts/part2/purge.js` runs **the Purges**: timed server events with a game mode, started by an op with `/purge`. It's an engine that game modes plug into. The first mode is **the Potato Heist**.

- **The story:** the Purge's declarations are **unsigned**. Nothing in the script names the Ministry. Players don't know who runs the Purges, or that a cut of every theft quietly disappears (the Tithe). See STORY.md, Act IV.
- **It needs** `part2/blood_pool.js` for the Heist (the Potato War totals).
- **It uses, when installed,** `protected_areas.js` (the sanctuary) and `economy/black_market.js` (AFK).

## The engine
- **A timer and a red boss bar:** the mode, the time left, and a mode line (the Heist's is the richest war chest).
- **A 30-second countdown first** (`COUNTDOWN_SECONDS`), for every start: `/purge start` or an [Unsigned Declaration](BLACK_MARKET.md#the-unsigned-declaration) from the black market.
  - Everyone is told what's coming (mode, length, kit) and that their belongings will be held, so they can put things away. A declared one starts *"An unsigned declaration has been posted."*: nobody is named.
  - A title and a bell at 30, 20 and 10 seconds, then the last five counted down one by one, with a rising note.
  - Nothing is vaulted and no teleport is blocked until the Purge itself begins.
  - `/purge` shows the time left, a second start is refused, and `/purge stop` calls it off ("The Purge has been called off.").
  - It's saved: a restart or `/reload` carries on, and if it ran out while the server was down, the Purge begins at once.
- **The opening:**
  - midnight and a thunderstorm for the Purge's length;
  - the raid horn and a title for everyone;
  - the rules, the kit and the sanctuary, told to every player.
- **The closing:**
  - a title: *"Your participation has been recorded. Thank you."*;
  - the mode's summary, the winner, and each fighter's own result, sent privately;
  - the boss bar and glowing cleared, and loose kit on the ground removed;
  - belongings handed back;
  - an entry in `/purge history`.
- **Kills:**
  - the player who struck the killing blow;
  - or, for a fall, lava or mobs, the player who **last hit the victim within 10 seconds**;
  - **combat logging:** logging out within **15 seconds** of a player's hit counts as being killed by them. The theft works while they're offline, and they're told at their next login.
  - **Nothing counts** for killing yourself, an **AFK** victim, `/kill`, or a death **in the sanctuary**.
- **Everyone is invisible, glows, and has their name hidden:** while a Purge runs, everyone in it is invisible (no particles), glows (an outline seen through walls), and the name over their head is hidden. That's every fighter, or in a mode without kits, everyone playing.
  - **Invisible but glowing,** a fighter shows as an outline. Vanilla invisibility doesn't hide armour or held items, so the kit stays visible. Teammates can't see each other's faint shapes either (`seeFriendlyInvisibles false`).
  - The invisibility is refreshed with the glow, and cleared at the end, but only for the players the Purge made invisible (`INVISIBLE_EVERYONE`).
  - It's done with two vanilla scoreboard teams, both with `nametagVisibility never`: `purge` (white glow) and `purge_marked` (gold glow). A mode can mark players: the Heist marks the **three richest war chests**, who glow gold.
  - The glow is refreshed every 5 seconds, and straight after a knockout or a respawn (both clear effects). A player is only moved between the teams when their mark changes.
  - **Their own team comes back:** if a player was already on a vanilla team (`pig_escort.js` uses them), it's noted when they're taken in.
    - At the end they're put back on it, by name, so offline players are covered too.
    - Then both Purge teams are removed, and names show again.
  - The team colour also colours names in chat and the tab list during the Purge: white, or gold for the marked. Colours from FTB Ranks name formats still show.
  - Creative and spectator players are left alone.
  - Settings: `GLOW_EVERYONE` and `HIDE_NAMETAGS`. With both off, no teams are used, and only the marked players glow (in white).
- **The sanctuary:** the areas named in `SANCTUARY` (`Spawn` and `The Castle` from `protected_areas.js`).
  - Nobody can hurt anyone there during a Purge, and nothing counts there.
  - Players there when the Purge starts keep their own gear until they step out.
  - **Once a player is fighting, they fight until the end,** even if they go back in. They're still safe while inside.
- **No escaping a fight:** FTB Essentials' `home`, `back`, `spawn`, `warp`, `tpa`, `tpahere`, `tpaccept`, `rtp` and `tpl` are refused for fighters.
  - **Ops are exempt** (`BLOCK_OPS_TOO`). So is anyone in the sanctuary who isn't fighting.
  - `back_toll.js` doesn't charge for a `/back` the Purge refuses.
- **The Tithe:** a hidden count that any mode can add to (the Heist adds its 20% cut). Only ops can see it (`/purge tithe`). It's the Benefactor's Harvest count, for the reveal later.
- **A restart or `/reload` mid-Purge:** it carries on. If its time ran out while the server was down, it ends with the summary and hands everything back.

## Kits and the vault
A mode with kits (the Heist has all four) makes **everyone fight with the same gear**, so nobody has the clear advantage.

| Kit | Items |
|---|---|
| `soldier` | iron sword, shield (off-hand), bow, 32 arrows, full iron armour, 16 steak |
| `peasant` | wooden sword, full leather armour, 8 bread (Mianite's old rules) |
| `archer` | bow, 64 arrows, stone sword, full chainmail, 16 steak |
| `gladiator` | diamond sword, diamond axe, full diamond armour, 4 golden apples, 16 steak |

The op names the kit, or one is picked at random. Kit items are plain and unenchanted, with the lore *"Purge issue. Returned at the end."*

**Who fights:** every player online in survival or adventure. That includes players who log in during the Purge, and players stepping out of the sanctuary. Players in creative or spectator don't fight.

**Becoming a fighter:**
1. **The vault:** every inventory slot (main inventory, armour and off-hand) is saved **whole**, as the game itself saves a stack (Forge's `serializeNBT()`): id, count, tag *and* `ForgeCaps`.
   - It goes into the saved data and a backup file, `kubejs/purge_vaults/<name>_<uuid>.json`.
   - `JsonIO` can't create that folder. If it doesn't exist, the file goes in `kubejs/` as `purge_vault_<name>_<uuid>.json`.
   - **Why whole:** some mods keep an item's contents in a Forge capability, outside its tag. Extra Utilities' **Golden Bag of Holding** keeps its 54 slots there, and EvilCraft's **Broom** keeps its blood there. Rebuilt from id + tag, such an item comes back empty.
   - KubeJS's own `toNBTJS()` can't be used: it's hidden from scripts, and calling it fails.
   - Each record also keeps `nbt` (the tag) for reading. A record saved before `full` existed is rebuilt from id, count and tag.
2. The inventory is cleared only if three things hold: the save worked, every stack was saved whole, and every stack rebuilds as the same item and count, keeping its `ForgeCaps`. Otherwise the player isn't touched and sits the Purge out, and the ops are told which item it was. There's no quiet fallback to id + tag.
3. Effects are cleared, and the kit is given with the armour worn.

**Keeping it fair:**
- **Every second,** anything a fighter has that isn't their kit (from a chest, the ender chest, the ground, a mined block) is moved to their vault's **extras** and handed back at the end. They're told once.
- **Kit items carry their owner and "life".** A life is one stretch between respawns. Another player's kit, or your own from before you died, is simply taken away. So dropping and picking up kit never adds up to more than one kit.
- **With an arena set, nobody dies** (see "The arena" below): a fatal blow is a knockout.
- **Without an arena, on death,** a fighter's inventory is cleared first, so nothing drops and there's no kit in their corpse. They respawn with a fresh kit and 10 seconds of **Resistance V** against spawn camping.
  - The Corpse mod still makes a corpse: an empty one, gone 30 seconds after death (`corpse.despawn.time = 600` ticks).
  - **Curios slots aren't vaulted** (see below), so a fighter's own rings, belts and charms drop into that corpse. With `corpse.access.only_owner = false`, anyone can take them. A knockout in the arena isn't a death, so nothing drops there.

## The arena
An op sets it in game: stand on the spot and run **`/purge arena set [radius]`** (40 blocks if no radius is given). It's saved, so it survives restarts, and it can be moved or cleared at any time (`/purge arena clear`). With no arena set, fighters fight where they stand and die as usual.

- **Going in:** when a player becomes a fighter (at the start, on logging in mid-Purge, or on leaving the sanctuary), the place they're standing is saved with their vault. That's the dimension, the position and which way they face.
  - Then they're sent to a **random safe spot** within the radius, chosen by vanilla `spreadplayers`, which avoids lava, water and fire. This works from any dimension.
  - If no safe spot is found, or the radius is 0, they land on the arena point itself.
- **The sanctuary doesn't keep anyone out** while an arena is set. Everyone in survival or adventure is taken in.
  - The sanctuary still stops all fighting inside it.
  - Creative and spectator players stay where they are.
- **Knockouts instead of deaths:** damage that would kill a fighter is a knockout, decided at the moment of death (after armour and effects), the way a Totem of Undying works.
  - **Who gets the kill:** it counts for the player who struck the blow, or who hit them in the last 10 seconds, exactly like a kill.
  - **What happens to them:** they're healed, put out, fed, and given a **fresh kit** (a new life). They're sent to a **new random spot** in the arena, with 10 seconds of Resistance V.
  - **Nothing is left behind:** the death never happens, so nothing drops, there's no corpse, and curios stay on.
  - **`/kill` still kills.** The fighter respawns with a fresh kit and is sent back into the arena.
- **Coming back:** when their belongings are handed back, each fighter is taken back to the exact spot they left from, then given their things. That's at the end for everyone online, at login for anyone offline, and with `/purge restore`.
- **Arenas under a roof:** set `ARENA_HEADROOM`, and players land below arena y + that. In the Nether, the roof is always avoided (arena y + 10).
- **Modes without kits** don't use the arena yet: they have no fighters list to send in.

**Handing back:**
- At the end, each fighter's inventory is cleared and **every slot is put back exactly**, then the extras are given. They drop at the player's feet if the inventory is full.
- **A dead player** gets theirs when they respawn. **An offline player** gets theirs when they next log in.
- If an item can't be made any more (its mod was removed), **only that part stays in the vault**, marked partial. The ops are told, and `/purge restore` hands it over later without clearing anything.
- The backup file is marked `restored` once it's done.

## The Potato Heist (`heist`)
Every kill steals from the victim's **Potato War total**, their "war chest": the lifetime potatoes in `/potatowar`.

| Rule | Value (owner decisions) |
|---|---|
| Stolen per kill | **5%** of the victim's total, at least 50, at most **2,500** |
| Kept by the killer | **80%**. The other **20% vanishes** into the hidden Tithe |
| Ranks | **Never lost.** The victim keeps their rank and crafting access (the peak rank in `blood_pool.js`); theft only costs progress toward the next rank. The killer can rank up |
| Who can be robbed | **Rank 3 and up** (2,500+ potatoes), so new players aren't farmed |
| The same killer robbing the same victim again | ×0.5, then ×0.25 |
| **Grudge:** killing someone who robbed you this Heist | **×2**, even below rank 3. Each robbery gives one grudge |
| The richest war chests | The top 3 online **glow** |

**Effects:**
- potato particles burst from the body (particles only, never real items);
- the killer gets a title (*"+2,000 potatoes"*) and a sound;
- the victim is told how much they lost, and that their rank is safe;
- everyone hears *"Anamy raided Goruk's war chest."*

**The summary** gives the biggest hauls and the hardest hit. The winner is the best net gain.

## Commands
| Command | Who | What it does |
|---|---|---|
| `/purge` | anyone | The running Purge: mode, kit, time left, your score, the richest war chest. Otherwise, the last Purge |
| `/purge top` | anyone | The leaderboard |
| `/purge modes` | anyone | The game modes |
| `/purge kits` | anyone | The kits and what's in each |
| `/purge start <mode> <minutes> [kit]` | op | Start the 30-second countdown to a Purge (1–240 minutes). A random kit if none is named |
| `/purge stop` | op | During the countdown: call it off. During a Purge: end it now, with the summary, and hand everything back |
| `/purge vaults` | op | Vaults not yet handed back, and why (fighting now, or waiting for them to log in) |
| `/purge restore <player>` | op | Hand a vault back by hand (online, alive, not fighting) |
| `/purge history` | op | The last 20 Purges: mode, kit, length, fighters, winner |
| `/purge tithe` | op | The hidden Tithe total, by source |
| `/purge arena` | anyone | Where the arena is, and its radius |
| `/purge arena set [radius]` | op | Set the arena where you stand (radius 0–500; 40 if not given). In game only |
| `/purge arena clear` | op | No arena: fighters fight where they stand (anyone already taken in is still brought back) |

## Settings (top of purge.js)
| Setting | Default | Meaning |
|---|---|---|
| `MAX_MINUTES` | 240 | The longest Purge |
| `COUNTDOWN_SECONDS`, `COUNTDOWN_MARKS` | 30, [30, 20, 10, 5, 4, 3, 2, 1] | The countdown before every Purge (0 = none), and when everyone gets a title and a tick |
| `INVISIBLE_EVERYONE` | true | Everyone in the Purge is invisible, with no particles |
| `LAST_HIT_SECONDS` | 10 | A death this soon after a player's hit is their kill |
| `COMBAT_LOG_SECONDS` | 15 | Logging out this soon after a hit counts as a death |
| `RESPAWN_RESISTANCE_SECONDS` | 10 | Resistance V after respawning |
| `SANCTUARY` | `['Spawn', 'The Castle']` | `protected_areas.js` areas where nobody fights |
| `BLOCKED_COMMANDS`, `BLOCK_OPS_TOO` | the teleports above, false | Commands fighters can't use |
| `SKIP_AFK` | true | AFK victims count for nothing |
| `KITS` | the four above | The kits |
| `STEAL_SHARE`, `STEAL_MIN`, `STEAL_MAX` | 0.05, 50, 2500 | How much a kill steals |
| `TITHE_SHARE` | 0.2 | The cut that vanishes |
| `MIN_VICTIM_RANK` | 3 | Below this rank, nobody can rob you (except a grudge) |
| `REPEAT_FACTORS`, `GRUDGE_FACTOR` | [1, 0.5, 0.25], 2 | Repeat robberies and revenge |
| `GLOW_TOP` | 3 | How many of the richest war chests glow gold (the Heist's marked players) |
| `GLOW_EVERYONE` | true | Everyone in the Purge glows (false: only the marked, the richest three) |
| `HIDE_NAMETAGS` | true | Names over heads are hidden during the Purge |
| `TEAM_ALL`, `TEAM_MARKED`, `MARKED_COLOR` | `purge`, `purge_marked`, gold | The two vanilla teams, and the marked players' glow colour |
| `ARENA_RADIUS` | 40 | The landing radius when `/purge arena set` is given none |
| `ARENA_HEADROOM` | 0 | Land below arena y + this (an arena under a roof); 0 = on the surface |

**Saved data:** `server.persistentData["purge"]` holds:
- the countdown, if one is on (mode, kit, minutes, when it ends, whether it was declared);
- the running Purge (ledger, fighters, lives, the mode's data, who it made invisible, everyone's own team);
- the vaults (each with `from`, where its owner is taken back to);
- the arena;
- the Tithe;
- reports for players who ran;
- the history.

Unreadable data is kept under `purge_unreadable_<time>`. Last hits are kept in memory only.

**API:** `global.Purge = { start(mode, minutes, kit, opts), stop(reason), busy(), pending(), lastEnded(), maxMinutes, active(), mode(), kitActive(), arena(), isFighter(player), blocksCommand(player, cmd), ledger(), tithed(), addTithe(n, source), modes, kits }`. `start` returns `''` when the countdown (or, with no countdown, the Purge) is under way, or why not. `opts.declared` marks a start from an Unsigned Declaration. `stop` also calls off a countdown. `busy()` says why a Purge can't start now (`''` if it can). `lastEnded()` is when the last Purge ended. The black market's Unsigned Declaration uses these.

It also uses `global.BloodPool.standingOfUuid`, `takeStanding` and `giveStanding` (added to `blood_pool.js` for the Heist). `anamian_axe.js` doesn't call the Axe loose during a kit Purge, because it's in its holder's vault.

## Adding a mode
Add an entry to `MODES`:
```js
mymode: {
  name: 'The Swine Heist', blurb: 'One line for /purge modes.',
  rules: ['Lines told to everyone at the start.'],
  kits: ['soldier', 'archer'],            // leave out for "bring your own gear"
  score: e => e.kills,                    // from the ledger entry { name, kills, deaths, gain, loss }
  scoreLabel: 'kills',
  onStart: server => { },                 // set up db().cur.modeData
  onKill: (server, ctx) => { },           // ctx: killer, killerUuid, killerName, victim (null if they ran), victimUuid, victimName, offline
  onTick: server => { },                  // every 5 seconds
  marked: server => [],                   // names that glow gold (the Heist: the richest war chests)
  bossbar: server => '',                  // extra boss bar text
  status: (server, player) => '',         // extra /purge line
  onEnd: (server, rows) => [],            // summary lines; rows are ranked { uuid, e, score }
},
```

## Install
Copy `purge.js` to `kubejs/server_scripts/part2/`, and the updated `blood_pool.js` (same folder), `anamian_axe.js` and `back_toll.js`. Then run `/reload`.

Optionally create an empty `kubejs/purge_vaults/` folder, so the vault backup files go there and not loose in `kubejs/`.

## Test plan (two survival accounts at rank 3+, and an op)
1. **Start:** fill your inventory with enchanted gear and armour, then run `/purge start heist 5 peasant`.
   - **The countdown:** "THE PURGE begins in 30 seconds", titles at 30, 20 and 10, then 5, 4, 3, 2, 1. Your things are still yours until it ends. Try `/purge stop` in another one: "called off".
   - The horn, the title, night and thunder, and the boss bar appear.
   - You're invisible with no particles, and glowing.
   - Your inventory becomes a wooden sword, bread and leather armour.
   - `kubejs/purge_vaults/` (or `kubejs/purge_vault_…json`) has your file.
2. **Fairness:**
   - Take a diamond from a chest: within a second it's gone, with the "kept for you" message.
   - Drop your sword and let the other account pick it up: it's taken from them.
   - `/home` is refused.
3. **The Heist:** kill the other account.
   - `/potatowar` on both shows 5% moved, 80% to you.
   - Their rank and crafting are unchanged, and `/purge tithe` shows the 20%.
4. **Repeat and grudge:** kill them again: half as much. Let them kill you: double.
5. **Last hit:** hit them, then let them die to a fall within 10 seconds: it's yours.
6. **Combat log:** hit them, then they log out: they're robbed, and told at their next login.
7. **Death:** no corpse with items. You respawn with the kit and Resistance.
8. **Sanctuary:** standing inside it, you can't be hurt. Someone who starts there keeps their gear until they step out.
9. **Glow and names:** everyone fighting glows white, the three richest war chests gold, and the boss bar names the richest.
   - No names show over heads. Check from the other account, or in third person (F5) for your own outline.
   - Put one account on a team first (`/team add testers`, `/team join testers <name>`). At the end it's back on `testers`, `/team list` shows no `purge` teams, and names show again.
10. **The end** (`/purge stop` or the timer):
    - your inventory comes back slot for slot, plus the diamond;
    - a Golden Bag of Holding (or a filled EvilCraft Broom) you were carrying still holds what it held;
    - an account that was offline gets theirs at login;
    - one that was dead at the end gets theirs at respawn.
11. **Restart:** restart the server mid-Purge. It carries on with its time and vaults.
12. **The arena:** stand where it should be and run `/purge arena set 20`. Go somewhere else, the sanctuary included, and start a Purge.
    - Everyone lands at a random spot within 20 blocks of the arena, the account at spawn too.
    - Take a fatal blow (a fall, or the other account): no death screen and no corpse. You're healed, have a fresh kit, and are at a new spot in the arena. The kill counts for whoever hit you.
    - `/kill` yourself: you die, respawn, and are sent back into the arena with a kit.
    - At the end, each account lands exactly where it was before, facing the same way, with its own things. An account that was offline at the end is moved at its next login.

## Settled from the mod jars
These were checked in the pack's own jars (class files read with `javap`; nothing run). They didn't need a game.
- **Better Combat 1.9.0: delayed hits are seen.** Its server handler (`net.bettercombat.network.ServerNetwork`) applies each hit with the player's own `ServerPlayer.attack`, either directly or through vanilla's attack packet. So `EntityEvents.hurt` gets a normal player-attack damage source with the player as the attacker.
- **Corpse 1.0.23: the corpse is empty.**
  - Its death and drops handlers run at `LOWEST` priority, after this script has cleared the inventory. It records only what is still in the inventory and in the drops.
  - It always spawns a corpse, even an empty one. An empty corpse despawns after `corpse.despawn.time` (600 ticks on this server).
- **Curios 5.14.1: curios drop into the corpse.** Curios adds worn curios to the drops at `HIGHEST` priority, unless the keepInventory gamerule is on or `keepCurios` says to keep them. This server has `keepCurios = "DEFAULT"`, which follows keepInventory. Corpse then puts them in the corpse.
- **Waystones 14.1.21 can be blocked.** Every waystone, warp stone and scroll teleport fires `net.blay09.mods.waystones.api.WaystoneTeleportEvent$Pre`.
  - It's a `@Cancelable` Forge event, posted on Forge's event bus by Balm. Waystones stops the teleport when it's cancelled.
  - KubeJS 6 only offers `ForgeEvents.onEvent` in **startup** scripts, so a block needs a small startup script and one restart (see "Proposed" below).
- **`/weather thunder 1800s` is valid.** In 1.20.1 the duration is a time argument (`TimeArgument`, minimum 1 tick), so `s` means seconds.
- **`Item.of(id, count, snbt)` doesn't rebuild every modded item exactly.**
  - The SNBT string is parsed by `TagParser` and applied with `withNBT`. That's exact for anything kept in the tag: enchantments, Tinkers tools, Mekanism's `mekData`, backpacks' UUIDs.
  - But `s.nbt` is only the tag. Data a mod keeps in a Forge capability is in `ForgeCaps`, outside it.
  - A real Part I player file had 13 Golden Bags of Holding and 2 Brooms with `ForgeCaps`. The bag's own code (`initCapabilities`, `getShareTag`) shows its inventory lives only in the capability. The `Inventory` copy in its tag is for the client and is overwritten from the capability on the next sync.
  - **Fixed:** the vault now saves `serializeNBT()` (the whole stack) and rebuilds with `ItemStack.of`. It was tested on the local test server (see below).
  - `blood_portal.js` used the old method for the Part I exodus files. That's past, but any bag that came through that way arrived empty.

## Tested on the local test server (10 Nov 2026)
This was a copy of the pack with one player, and the Purge started from the console.
- **Round 1, with the first fix (`toNBTJS()`):** the bag came back empty.
  - A probe showed `toNBTJS` is hidden from scripts, so the save quietly fell back to id + tag.
  - The backup file wasn't written, because `kubejs/purge_vaults/` didn't exist.
- **Round 2, with `serializeNBT()`, after both fixes:**
  - The vault saved a Golden Bag of Holding whole (64 diamond blocks, 16 ender pearls and 5 golden apples in its `ForgeCaps`).
  - The bag came back in the same slot with all three stacks, and still held them 10 seconds later, after the game had synced it.
  - The enchanted, renamed sword, the worn chestplate, the potatoes, the extras (3 diamonds taken during the Purge) and the backup file (in `kubejs/`, marked `restored`) all checked out.
  - There were no Purge errors in the log.
- **Sanctuary:** a player standing at spawn when the Purge started kept their gear, and was enlisted on stepping out.
- **Blocked commands:**
  - A non-op fighter's `/back` and `/home` were refused with the red message, and they weren't teleported.
  - As an op, the same player's `/back` worked, as `BLOCK_OPS_TOO = false` intends. An op who fights can still teleport out unless that's set to `true`.
- **The arena (11 Nov 2026):**
  - Set in game with `/purge arena set 20`. A player standing in the spawn sanctuary was pulled in, landing 16 blocks from the arena point.
  - **Knockout:** 1,000 fall damage. There was no death message, no corpse and no death screen. Health was back to 20, the kit was fresh (second life), and the player was at a new spot in the arena.
  - **Return:** read in the same instant the Purge ended, the player was exactly on the saved spot, facing the saved way, and still there 3 seconds later.
  - Two earlier runs measured the player 10 and 28 blocks off, after they had moved: it was midnight (the Purge's doing) and hostile mobs were attacking.
  - Each teleport logs a vanilla "moved too quickly!" warning, sized to the teleport. It's harmless: the server keeps the new position.
- **The glow and hidden names (11 Nov 2026):**
  - The player had been put on their own team, `testers`. During the Purge they were on `purge` and glowing. The glow was back straight after a knockout, with the player still on the team.
  - At the end the Purge teams were gone (`/team list`: only `testers`), the player was back on `testers`, and the glow was off.
  - With one account, nobody could look at the hidden name from outside. The gold team for the richest wasn't seen either, since the test server's `blood_pool.js` has no Heist API, so nobody counted as rich.
- **Not covered:** kills, the Heist, and the test server's `blood_pool.js` (from `local-testing`, without `takeStanding`), since there was only one account.

## Proposed (not built: the owner decides)
- **Vault the Curios slots too**, so curios can't be used in a kit Purge or looted from a corpse.
  - Curios 5.14.1's API: `CuriosApi.getCuriosInventory(player)` returns a `LazyOptional<ICuriosItemHandler>`.
  - `.getCurios()` is a map of slot id → `ICurioStacksHandler`, each with `getStacks()` and `getCosmeticStacks()` (`getSlots`, `getStackInSlot`, `setStackInSlot`).
  - The vault would save each non-empty curio stack whole, with its slot id, index and cosmetic flag, then empty the slot. At the end it would put it back in the same slot, or give it if that slot no longer exists.
  - From KubeJS: `Java.loadClass('top.theillusivec4.curios.api.CuriosApi')`.
- **Block waystones for fighters:** a startup script, `ForgeEvents.onEvent('net.blay09.mods.waystones.api.WaystoneTeleportEvent$Pre', e => ...)`.
  - It would call `global.Purge` (looked up when the event fires) with `e.getContext().getEntity()`, and run `e.setCanceled(true)` for a fighter.
  - It would follow the same rule as the blocked commands (`BLOCK_OPS_TOO`), and need one restart.

## What couldn't be verified
- **The countdown and invisibility in game.** Both pass the mock tests, and the scripts load on the test server, but no player has watched them yet; it's left for the live server. To check:
  - the titles at 30, 20 and 10 and the counted-down 5–1, with their sounds;
  - that `/purge stop` calls the countdown off;
  - that fighters are invisible with no particles, show as glowing outlines (armour and held items visible), can't see each other's faint shapes, and are visible again at the end.
- **Other capability items** in the vault: only the Golden Bag of Holding was tested in game. Any item whose `ForgeCaps` doesn't survive the rebuild makes its owner sit the Purge out (with an op message), so nothing is lost.
- **Beacon effects** near a base still apply to fighters.
- **Kit items put in a chest or ender chest** stay there after the Purge, as plain items with the kit lore. Loose kit on the ground in loaded chunks is removed at the end.
- **The live server's Corpse and Curios settings:** the values above come from the local test server's copy (`world/serverconfig/`).
