# The Deepdelver's Maul

`server_scripts/deepdelver_maul.js` (with `startup_scripts/deepdelver_maul_hooks.js`) makes **The Deepdelver's Maul**: Goruk the dwarf's super weapon, for fighting and mining. It works like the [Anamian Axe](ANAMIAN_AXE.md):
- **One exists.** It carries a serial number, and a copy (or the old one after a re-forge) is an ordinary tool.
- **It's open for grabs.** Whoever holds it keeps its level, and the server is told when it changes hands or goes loose.

It **levels I–X on Grit**: a **netherite pickaxe** whose Efficiency, Fortune and damage (8 to 18) grow, until at **Level X it's reforged as a Tinkers' Vein Hammer**.

From Level I it has seven abilities: **Prospector** (marks nearby ore, switched off and on with sneak + right-click), **Forge-touched** (ore comes out smelted), **Deepborn** (Night Vision and Haste away from daylight), **Iron Blood** (kills give absorption hearts), **White-hot**, **the Grudge Ledger**, then **Earthshaker** from Level V.

## Finding it
Until the first Maul exists, **each fresh loot container Goruk_Lohaus opens has a 10% chance of holding it** (`FINDER`, `FIND_CHANCE`).
- **Which containers:** a chest, barrel or anything else with a loot table, on its first opening, when its loot is made. A chest someone placed has no loot table, and doesn't count.
- **Where it goes:** the Maul is forged into the chest at Level I, after the chest's own loot. Only he gets a hint: "Under the loot lies something old and heavy, waiting for you." If the chest is full, it goes straight to him instead.
- **When he takes it,** the server hears "Goruk_Lohaus has claimed The Deepdelver's Maul (Level I)!".
- **It never spawns again.** Once a Maul has been forged (found in a chest or given by an op), no chest ever holds another, whether he has collected it, left it, or lost it. Each roll checks the saved serial number, which never goes back to 0. If it's lost for good, an op re-forges it with `/maul give <player> force`.
- **Only Goruk_Lohaus.** `FINDER` is the account's username, not a nickname, which anyone could copy. Set it to `''` to switch finding off.
- **Same method as the Dragon's Hoard:** the chest is noted on the right-click while it still has its loot table, then filled two ticks later, once it has opened.

## Levels
| Level | Grit | Item | Damage | Mining | Prospector | Deepborn | White-hot | Grudge bonus | Earthshaker |
|---|---|---|---|---|---|---|---|---|---|
| I | 0 | netherite pickaxe | 8 | Efficiency I, Unbreaking I | 2 blocks | Haste I | 10% | +10% | |
| II | 100 | | 9 | Eff I, Unb II | 2 | I | 14% | +12% | |
| III | 300 | | 10 | Eff II, Unb II, Fortune I | 2 | I | 19% | +14% | |
| IV | 600 | | 11 | Eff II, Unb III, Fortune I | 3 | I | 23% | +17% | |
| V | 1,000 | | 12 | Eff III, Fortune I | 3 | I | 28% | +19% | ✦ 3 blocks |
| VI | 1,600 | | 14 | Eff III, Fortune II | 3 | **Haste II** | 32% | +21% | 3 |
| VII | 2,400 | | 15 | Eff IV, Fortune II | 4 | II | 37% | +23% | 3 |
| VIII | 3,400 | | 16 | Eff IV, Fortune II, Mending | 4 | II | 41% | +26% | 4 |
| IX | 4,700 | | 17 | **Eff V, Fortune III**, Mending | 4 | II | 46% | +28% | 4 |
| **X** | 6,500 | **Tinkers' Vein Hammer** | **18** | Haste V, Luck III | **5** | II | **50%** | **+30%** | 4 |

Forge-touched and Iron Blood are the same at every level.

- **Damage** is the item's own `AttributeModifiers`, a player's own 1 included, as for the Anamian Axe and the Syndicate Slayer. The attack speed is set too: a pickaxe's 1.2, then 0.92 for the hammer (what Tinkers works out for its materials, Lightweight included).
- **Level X is a Tinkers' Vein Hammer:** Manyullyn hammer head, Hepatizon handle, Cobalt pick head and Manyullyn plate (Tinkers has no netherite material).
  - Tinkers ignores vanilla enchantments, so its Efficiency and Fortune become Tinkers' own **Haste V** (+20 mining speed) and **Luck III** (Fortune III, plus Looting III).
  - It mines **whole ore veins**, and Tinkers makes it slower per block for that (×0.3 mining speed). It comes with Tinkers' **Pierce II** trait, which adds armour-piercing damage of its own.
  - Its durability starts fresh. At Level X, more Grit is only counted and the hammer is never rebuilt, so anything Tinkers does to it (repairs, new modifiers) stays.
- **Below Level X** the pickaxe is rebuilt at each Grit gain, keeping its wear.

## Grit
| | Grit |
|---|---|
| Ore mined with it (anything in `#forge:ores`) | 1 |
| Diamond or emerald ore | 8 |
| Ancient debris | 15 |
| Kills with it in the main hand: a mob / a hostile mob | 1 / 3 |
| A player | 25 |
| Settling a grudge (killing a player on the ledger) | +40 |
| Bosses | Naga 100 … Snow Queen 500, the Ender Dragon 500, the Wither 300, Ice and Fire dragons 150 |

**The Knight Phantoms are one boss:** they come six to a group, and the group pays its 200 once, with the last knight (another knight alive within 64 blocks means the group isn't beaten). The first five count as hostile mobs (+3 each, and for Iron Blood), so a fight is worth about 215, not 1,200. The Lich's shadow clones pay nothing. The Anamian Axe and Boss Blood count them the same way.

Ore only counts once it has really broken (checked a tick later). A break that a protected area or a claim cancels earns nothing and marks nothing, so nobody can farm Grit off an ore they can't break.

## Abilities
- **Prospector:** mining an ore with it **marks the ore within the level's radius** for 5 seconds, seen through walls.
  - **A marker is small:** a glowing copy of the ore at 0.3 of a block, in the middle of the ore's block (`MARKER_SIZE`). Inside the ore it's hidden; only its gold outline shows through walls. It never covers anything around it, so it doesn't get in the way of seeing or mining.
  - **A marker goes the moment its ore is mined,** by anyone. If the ore goes some other way (vein mining, an explosion), its marker goes within 4 ticks.
  - **Off and on:** sneak and right-click with the Maul (at a block or the air). One press switches it once, even held down. It's saved per player, and switching it off clears the markers.
  - Up to 40 markers at a time, at most once every 2 seconds. Anyone near can see the outlines. Leftover markers from a restart or `/reload` are cleared within 5 seconds.
- **Forge-touched:** ore it mines **drops smelted**, as a furnace would make it: raw iron comes out as iron ingots, ancient debris as netherite scrap.
  - **Fortune still counts:** 3 raw iron becomes 3 ingots.
  - **The furnace's experience** comes too, with sparks and a hiss.
  - **Unchanged:** anything with no smelting recipe drops as usual (coal, diamonds, redstone, lapis).
  - **The Blood Pool's locks hold:** a recipe it has sealed isn't there to use, so the raw ore stays raw.
  - **How:** the drops are changed as they appear, so nothing raw is ever on the ground.
- **Deepborn:** in the main hand **where daylight doesn't reach**, **Night Vision and Haste I**, **Haste II from Level VI**.
  - **Where:** the sky light at its holder's head is 7 or less (`DEEP_MAX_SKYLIGHT`). That covers caves, mines and the Nether, but not under a tree or a roof with daylight around.
  - **No particles,** refreshed every second, so Night Vision never flickers while it applies.
  - **After 3 seconds without it** (put away, or out in daylight), the effects it gave are taken away. A quick switch to place a torch keeps them. A potion of the same effect with more than 13 seconds left is left alone.
- **Iron Blood:** a kill with it of a **hostile mob, a boss or a player** gives **2 absorption hearts, up to 8**.
  - Animals don't count.
  - Absorption from anything else (a golden apple) counts towards the 8.
  - **What it gave fades a minute after the last kill** (`IRON_SECONDS`).
- **White-hot:** part of what armour, Protection, Resistance and absorption would stop **gets through anyway**: 10% at Level I, 50% at Level X.
- **The Grudge Ledger:** a player who hurts the Maul's holder **goes on the Maul's ledger**, and only the holder is told.
  - The holder deals **+10% (Level I) to +30% (Level X)** damage to anyone on it.
  - **Killing them with the Maul settles the grudge.** Everyone is told "A grudge is settled. X has paid Y in full.", and the Maul gains 40 extra Grit.
  - **Who counts:** players only. A hit that didn't land doesn't count (the Purge's sanctuary, protection). A grudge lasts 7 days.
  - **The ledger belongs to the Maul:** a new holder inherits it.
- **Earthshaker (Level V):** a falling hit (vanilla's critical hit) slams the ground.
  - Everything within **3 blocks (4 from Level VIII)** takes 40% of the Maul's damage (the target itself isn't hit twice) and gets **slowness II for 2 seconds**, with stone bursting out and a boom.
  - **Players count too** (`SHAKE_HITS_PLAYERS`). The cooldown is 6 seconds.
  - Better Combat's delayed hits count if the holder was falling up to 0.6 seconds before, as for the Anamian Axe's Judgement.

## Installing the damage hook
White-hot and the grudge bonus change how much a hit does. KubeJS's `EntityEvents.hurt` can't do that, and Forge events can only be listened to from **startup scripts**. So `startup_scripts/deepdelver_maul_hooks.js` hooks two Forge events:
- **LivingHurtEvent:** the damage before armour;
- **LivingDamageEvent:** the damage after it.

It hands both to `global.DeepdelverMaul`, so the logic stays in the server script and reloads with `/reload`. **It needs one server restart to install.** Without it, everything else works, and White-hot and the grudge bonus simply don't apply.

## Commands
| Command | Who | |
|---|---|---|
| `/maul` | anyone | Its level, Grit, abilities, and who holds it (or that it's loose) |
| `/maul grudges` | its holder, ops | The ledger: who wronged whom, and when |
| `/maul forgive <player>` | its holder, ops | Strike a name from the ledger |
| `/maul give <player>` | op | Forge it (once). `/maul give <player> force` forges a new one; the old one becomes an ordinary tool |
| `/maul setgrit <grit>` | op, holding it | Set its Grit (and level) |
| `/maul stats` | op | Serial, holder, kills, ore mined, grudges settled |

## Settings (top of deepdelver_maul.js)
- **Levels and the tool:** `LEVELS` (Grit, damage and enchantments per level), `ABILITIES` (the level each is learned at), the pickaxe's and hammer's ids, speeds and durability, `HAMMER_MATERIALS`, `HAMMER_UPGRADES`.
- **Prospector:** `PROSPECT_RADIUS`, the markers' time, cooldown, cap, colour and size (`MARKER_SIZE`), how often they're checked, and `TOGGLE_GAP_MS`.
- **Deepborn and Iron Blood:** `DEEP_MAX_SKYLIGHT`, `DEEP_HASTE2_LEVEL`, `DEEP_SECONDS`, `DEEP_GRACE_SECONDS`; `IRON_HEARTS`, `IRON_MAX_HEARTS`, `IRON_SECONDS`.
- **Combat:** `WHITE_HOT_FROM/TO`, `GRUDGE_FROM/TO/DAYS`, Earthshaker's radius, share, slowness, cooldown and `SHAKE_HITS_PLAYERS`, `CRIT_GRACE_MS`.
- **Grit and the rest:** the Grit values, `BOSS_GRIT`, the finder, and how often it looks for its holder.

**Saved data:** `persistentData["deepdelver_maul"]`: its serial, holder, whether it's loose, its Grit, the ledger, the stats, and who has Prospector off.

**API:** `global.DeepdelverMaul = { levels, abilities, levelFor(grit), whiteHot(level), grudgeBonus(level), isRealMaul(stack), onLedger(uuid), state(), preview(grit), smelting(stack), prospectorOn(uuid), markers(), noteHit(...), finalDamage(...) }`. `preview` builds a void copy (serial 0) to check what a level looks like. `smelting` is Forge-touched's lookup: `{ id, count, xp }`, or null.

## Install
1. Copy `deepdelver_maul.js` to `kubejs/server_scripts/`, and `deepdelver_maul_hooks.js` to `kubejs/startup_scripts/`.
2. Restart the server, for the hook.
3. Goruk_Lohaus finds it in a loot chest, or an op forges it with `/maul give Goruk_Lohaus`. Either way, no chest spawns one after that.

It needs Tinkers' Construct for Level X.

## Test plan (Goruk_Lohaus, a second account, an op)
0. **Finding it** (before anyone has it). To test quickly, set `FIND_CHANCE` to 1 and `/reload`; put it back afterwards.
   - The second account opens a fresh loot chest: no Maul.
   - Goruk_Lohaus opens one: the Maul is in it, after the loot, and only he gets the hint.
   - He takes it: "Goruk_Lohaus has claimed…".
   - More fresh chests, even after it's lost: never a second Maul.
1. `/maul give Goruk_Lohaus` (or the one he found): a netherite pickaxe named The Deepdelver's Maul, Level I. The tooltip shows "8 damage" and its seven Level I abilities.
2. **Grit:** mine coal ore (+1) and diamond ore (+8), and kill a zombie (+3). `/maul` shows the Grit.
3. **Prospector:** mine an ore next to others.
   - Small gold outlines mark the others through the stone for 5 seconds, and nothing blocks the view.
   - Mine a marked ore: its marker goes at once.
   - Sneak and right-click: "Prospector off", and the markers go. Mining marks nothing now. Again: "Prospector on".
4. **Forge-touched:** mine iron or copper ore. Ingots drop, with sparks, a hiss and a little experience. Coal and diamonds drop as usual.
5. **Deepborn:** in a cave, hold the Maul: Night Vision and Haste I, with no particles. Walk out into daylight: about 3 seconds later they're gone.
6. **Iron Blood:** kill a few zombies: 2 absorption hearts each, up to 8. They fade a minute after the last kill. A cow gives none.
7. **The ledger:** let the second account hit Goruk. Goruk alone is told it's on the ledger, and `/maul grudges` lists it. Kill it with the Maul: everyone hears the grudge is settled.
8. **White-hot:** hit an armoured zombie with and without the hook installed. It takes more with the hook.
9. **Earthshaker:** `/maul setgrit 1000`, jump and hit a mob in a crowd. Everything within 3 blocks is hit and slowed, with a stone burst.
10. **Level X:** `/maul setgrit 6500`. It becomes a Vein Hammer with Haste V and Luck III, does 18 damage, and mines whole veins. Deepborn gives Haste II.
11. **Open for grabs:** Goruk drops it: "loose" within about 10 seconds. The second account picks it up: "claimed".

## Checked on the local test server (12 Nov 2026)
**The rework, with a Forge fake player** holding the real Maul (a probe script, since removed). It mined ore 40 blocks from spawn, sneak + right-clicked, and killed a zombie. Results:
- **Damage:** the game reads +7 and +17 attack damage: 8 at Level I and 18 at Level X.
- **Forge-touched:** iron ore dropped an iron ingot in the same tick, so nothing raw ever lay on the ground. Copper ore dropped 5 copper ingots, and experience was given.
  - The lookup finds the furnace recipes (raw iron and raw copper: ingots, 0.7 experience). Coal has none.
  - Ancient debris has none on the test server because the Blood Pool seals netherite scrap, as intended.
- **Prospector:** mining an ore marked the 2 ores within 2 blocks, at their own block corners, 0.3 of a block in size.
  - Mining a marked ore removed its marker at once. A marked ore set to air lost its marker within 6 ticks. All markers were gone after 5 seconds.
- **The switch:** sneak + right-click switched it off and cleared the markers, a second click at once was ignored, mining then marked nothing, and another click a second later switched it back on.
- **Iron Blood:** the zombie kill gave 4 absorption (2 hearts).
- **Protected areas:** a diamond ore inside the protected spawn didn't break and gave no Grit.
- **Deepborn's sky light:** at night, open sky reads 4 through KubeJS's `block.skyLight` (it takes off the night's darkening, 11), but 15 raw. Deepborn reads the raw value.

**Three bugs this found, all fixed:**
- **Markers half a block off:** `/summon` centres whole-number coordinates, so every marker sat across four blocks. The first, full-size markers did the same, which put a ghost block in the tunnel. They're summoned with decimal coordinates now.
- **Night counted as away from daylight:** the darkened reading would have switched Deepborn on outdoors at night.
- **Grit from a cancelled break:** a protected area cancels the break after the Maul has seen it, so an ore that can't be broken could be farmed for Grit. Grit and Prospector now wait a tick and count only if the ore has gone.

**The first build (11 Nov 2026),** with the first damage numbers (6 to 14). The way the item is built hasn't changed since, only the numbers. Built in real KubeJS with `preview()` (no player online) and read back:
- **The hook loads:** 2 of 2 startup scripts, 0 errors.
- **Level I:** a netherite pickaxe with Efficiency I and Unbreaking I. The game reads +5 attack damage and −2.8 speed (6 damage, 1.2 speed). The lore is right.
- **Level X:** Tinkers built the Vein Hammer from the four materials.
  - It has **Haste V and Luck III** applied, plus the traits: Manyullyn's **Insatiable II** (damage builds on consecutive hits), Cobalt's **Momentum** (mining speeds up as you go), Hepatizon's **Lightweight** and the hammer's **Pierce II**.
  - 6,875 durability, netherite mining tier, mining speed 10.3 (the vein hammer's ×0.3).
  - The game reads +13 attack damage: 14 damage.

## What couldn't be verified
- **What needs a real player** (a fake player isn't ticked, has no client and isn't in the level):
  - **Deepborn's effects:** they come from the player tick. The sky light and the effect calls it uses were checked.
  - **The absorption hearts and the markers on screen:** how they show, and how the markers look.
  - **The switch at a block:** it was checked at the air. At a block, the block and the air both fire, and the 600 ms gap keeps that to one switch.
  - **Vein mining at Level X:** whether Tinkers' Vein Hammer smelts (and gives Grit for) the whole vein or only the first block.
- **The chest timing:** that a loot chest's own loot is in two ticks after the right-click (the same method as the Dragon's Hoard and the Deep Records).
- **In a fight and in a mine:** the mock tests pass, but nobody has used it yet. Things to watch:
  - how strong White-hot and the grudge bonus feel with the hook;
  - whether Tinkers' vein mining gives Grit (and Prospector) for every ore in a vein or only the first one broken (it depends on whether Tinkers fires a break event for each block);
  - the glow's look.
