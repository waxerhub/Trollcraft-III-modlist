# The Anamian Axe

`server_scripts/anamian_axe.js` turns **The Anamian Axe** into a living super weapon:
- **One axe exists.** It gains **Souls**, levels from I to X, and is rebuilt at each level with stronger enchantments and new abilities.
- **It's open for grabs.** Whoever holds it keeps its level, and the server is told whenever it changes hands or goes missing. It's a Purge prize, like Leelinda's Stake.

It works on both servers. Blood Harvest only acts once Part II's Blood Pool is installed.

## Levels
| Lv | Souls | Item | Enchantments | Unlocks |
|---|---|---|---|---|
| I | 0 | diamond axe | Sharpness I, Efficiency I, Unbreaking I | |
| II | 50 | | Sharpness II, Efficiency II, Unbreaking II | **Timber** |
| III | 150 | | Sharpness III, Efficiency III, Unbreaking II, Looting I | |
| IV | 300 | | Sharpness III, Efficiency IV, Unbreaking III, Looting I | **Cleave** |
| V | 500 | | Sharpness IV, Efficiency IV, Unbreaking III, Looting II | **Bloodthirst** |
| VI | 800 | | Sharpness IV, Efficiency V, Unbreaking IV, Looting II | **Blood Harvest** |
| VII | 1,200 | | Sharpness V, Efficiency V, Unbreaking IV, Looting III, Fortune II | |
| VIII | 1,700 | **netherite axe** | Sharpness V, Efficiency VI, Unbreaking V, Looting III, Fortune III | |
| IX | 2,400 | | as VIII + Sharpness VI, Mending | |
| X | 3,300 | | as IX + Fire Aspect I, and **17 Attack Damage** | **Judgement** |

**How it looks:**
- **The name** changes colour: gray (I–III), gold (IV–VI), red (VII–IX), and dark red and bold at X.
- **The lore** shows:
  - the flavour line (*"Forged for Lord Anamy. It remembers every hand that held it."*);
  - the level and Souls, with a progress bar;
  - each unlocked ability, and the next one to come.

**Level X's 17 Attack Damage** is the tooltip figure, before Sharpness (Sharpness VI adds another 3.5). It's set with item attribute modifiers: +16 to attack damage, plus the axe's usual attack speed (1.0), because modifiers replace the axe's own.

**On a level-up:** every player is told, e.g. "The Anamian Axe has reached Level V in the hands of Anamy. It has learned Bloodthirst." The holder gets a sound and totem particles. Durability carries over through every level.

## Souls
Kills and logs only count when the axe is in the **main hand**.

| Source | Souls |
|---|---|
| Hostile mob kill | 3 |
| Other mob kill | 1 |
| Player kill | 25 |
| Twilight Forest bosses | Naga 100, Lich 150, Minoshroom 175, Knight Phantoms 200 (once per group), Hydra 300, Ur-Ghast 300, Alpha Yeti 400, Snow Queen 500 |
| Ender Dragon / Wither | 500 / 300 |
| Ice and Fire dragon | 150 |
| Log broken (Timber logs included) | 1 each |
| `/anamian offer coins <n>` | 15 per Hush Coin |
| `/anamian offer potatoes <n>` | 5 per 100 potatoes (they don't count toward the Potato War or the Blood Pool) |

Lich shadow clones give nothing. A boss kill is announced: "The Anamian Axe drinks deep: Anamy felled a mighty foe. +100 Souls."

## Abilities
All abilities work from the main hand only.

- **Timber (II).** Breaking a log fells the connected logs above and beside it, up to 128.
  - It only fells a real tree (the logs must touch leaves), never a log build.
  - Each log drops, costs 1 durability (the axe is never broken by it) and gives a Soul.
  - Sneak to chop one log. It doesn't reach into `protected_areas.js` areas the holder isn't allowed in.
- **Cleave (IV).** A melee hit also deals half its damage to other mobs within 3 blocks of the target. Players are never cleaved, so no accidental friendly fire.
- **Bloodthirst (V).** A kill heals 2 HP, or 6 HP for a player or a boss.
- **Blood Harvest (VI).** Kills pour Drops into the Blood Pool, credited to the holder: 5 for a mob, 50 for a player, 100 for a boss.
- **Judgement (X, the capstone).** A **critical hit** calls down a real lightning bolt on the target.
  - **What counts as critical:** a melee hit while in the air and coming down (a fall distance, or moving downward), or within **0.6 seconds** of having been in the air and falling. Not in water or riding. Arrows and other projectiles don't count.
  - **Why the 0.6 seconds:** Better Combat (in the pack, 1.9.0) swings with a wind-up. The server only gets the hit once the swing lands, by which time a jump attack has usually touched down. Checked in its jar: the attack request runs `ServerPlayer.attack` after the wind-up. So the script notes, each tick, when the axe's holder is falling, and counts a hit inside that window (`CRIT_GRACE_MS`).
  - **Logged:** each bolt is written to the server log (`[AnamianAxe] Judgement by …`).
  - The holder is never hurt by their own bolt: its damage is cancelled for a second, and they get a short Fire Resistance.
  - Any fire it starts is put out.
  - It has a 3-second cooldown.

## Open for grabs
- **Watching for it:** every 5 seconds the script looks for the axe in online players' inventories, including armour and off-hand slots.
- **When it changes hands:** "Bo has claimed The Anamian Axe (Level V)! Anamy has lost it."
- **When nobody online has it:** if the last holder is online but doesn't have it (dropped, put in a chest, or left in their corpse), it's announced once: "The Anamian Axe is loose. Anamy no longer has it. Open for grabs." Where it is isn't said.
  - It must be missing for **two checks in a row** (about 10 seconds).
  - **Not while a window is open.** The black market's shop window takes the player's inventory away until it's closed, so nothing is announced while any chest or shop window is open.
  - The axe still counts as held while it's on the mouse cursor.
- **A holder who logs off** with the axe keeps it. That isn't "loose".
- **It isn't soulbound.** The Corpse mod keeps a dead holder's items in their corpse, so looting the corpse claims it.

## Commands
| Command | Who | What it does |
|---|---|---|
| `/anamian` | anyone | Level, Souls, the next level, abilities, and who holds it (or that it's loose) |
| `/anamian offer coins <n>` | the holder (axe in hand) | Feed it Hush Coins |
| `/anamian offer potatoes <n>` | the holder (axe in hand) | Feed it potatoes, in hundreds |
| `/anamian give <player>` | op | Forge the axe at Level I. Refused if one already exists |
| `/anamian give <player> force` | op | Forge a new one; the old one becomes an ordinary axe to the script |
| `/anamian setsouls <n>` | op | Set the Souls of the axe in your hand (testing, fixes) |
| `/anamian debug` | op | Toggle a hit report for yourself: every hit with the Axe shows the level, the damage, and what the crit check saw (on the ground, fall distance, downward speed, how long ago you last fell), and whether Judgement fired |
| `/anamian stats` | op | Serial, holder, kills (players, bosses), logs, Souls from offerings |

**Replacing the hand-made axe** (Fortune 255): run `/anamian give <player>` and remove the old one. The script only recognises the axe it forged.

## Settings (top of anamian_axe.js)
| Setting | Meaning |
|---|---|
| `LEVELS` | Souls, item and enchantments for each level |
| `ABILITIES` | Each ability's unlock level and lore text |
| `SOULS_HOSTILE`, `SOULS_OTHER`, `SOULS_PLAYER`, `SOULS_PER_LOG` | Souls per source |
| `SOULS_PER_COIN`, `POTATOES_PER_OFFER`, `SOULS_PER_POTATO_OFFER` | Offerings |
| `BOSS_SOULS` | Boss id → Souls |
| `TIMBER_MAX`, `CLEAVE_RADIUS`, `CLEAVE_SHARE` | Timber and Cleave |
| `HEAL_KILL`, `HEAL_BIG` | Bloodthirst |
| `HARVEST_MOB`, `HARVEST_PLAYER`, `HARVEST_BOSS` | Blood Harvest |
| `JUDGEMENT_COOLDOWN_MS`, `JUDGEMENT_SAFE_MS` | Judgement |
| `CRIT_GRACE_MS` | How long after falling a hit still counts as critical (600, for Better Combat's wind-up) |
| `SCAN_TICKS` | How often to look for the holder (100 = 5 s) |
| `LOOSE_AFTER_SCANS` | Checks in a row without it (no window open) before it's announced loose (2) |

**Saved data:** `server.persistentData["anamian_axe"]` holds the serial, holder, whether it's loose, its Souls and the stats. The axe's own Souls are stored on the item.

**API:** `global.AnamianAxe = { levels, abilities, levelFor(souls), isRealAxe(stack), state() }`.

## Install
Copy `anamian_axe.js` to `kubejs/server_scripts/` and run `/reload`, then `/anamian give <player>`.

## Test plan
1. **`/anamian give <you>`:** a diamond axe named The Anamian Axe, Level I lore, Sharpness/Efficiency/Unbreaking I.
2. **Level up:** `/anamian setsouls 160` (axe in hand) gives Level III, with enchantments and lore updated and the level-up announced.
3. **Timber:** at Level II or above, chop the bottom log of a tree and the tree falls. A log pillar without leaves doesn't. Sneaking chops one.
4. **Cleave:** at IV (`setsouls 300`), hit a zombie in a group and the others take damage. A player standing next to it doesn't.
5. **Bloodthirst and Blood Harvest:** at VI (`setsouls 800`), kills heal you, and `/bloodpool top` shows your Drops rising.
6. **Netherite, damage and Judgement:** at X (`setsouls 3300`), the axe is netherite and its tooltip reads 17 Attack Damage. Turn on `/anamian debug`, then jump and hit a mob on the way down: the report says JUDGEMENT, lightning strikes the target, and you take no damage. A second crit within 3 seconds says "on cooldown".
7. **Open for grabs:** drop the axe and the loose message appears. A second player picks it up and is announced as its holder.
8. **Offerings:** `/anamian offer coins 2` adds 30 Souls.

## What couldn't be verified
- **Rebuilding the axe in its inventory slot** (`inventory.setItem`) keeps it in the same hand and slot. If it doesn't, the axe still exists with its Souls, just in the slot it was rebuilt into.
- **Timber** breaks logs with `setblock … destroy`: they drop as if mined, but without the axe's Fortune or Silk Touch (logs aren't affected by either).
- **Cleave** deals its damage with the `/damage … by <holder>` command (1.20.1). Mobs see the holder as the attacker.
- **Critical hits** are judged from the holder's ground state, fall distance and downward speed. Mods that change attacks (Better Combat is in the pack) may not match vanilla exactly. `/anamian debug` shows what the check sees on every hit, so a miss can be traced.
- **Existing axes** pick up a change to their level's settings (like Level X's damage) only when they're rebuilt: on their next Soul gain, or with `/anamian setsouls <their Souls>`.
- **The Corpse mod:** an axe in a corpse is invisible to the scan until someone loots it. Then it's announced as claimed.
