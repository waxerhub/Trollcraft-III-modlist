# The Deepdelver's Maul

`server_scripts/deepdelver_maul.js` (with `startup_scripts/deepdelver_maul_hooks.js`) makes **The Deepdelver's Maul**: Goruk the dwarf's super weapon, for fighting and mining. It works like the [Anamian Axe](ANAMIAN_AXE.md):
- **One exists.** It carries a serial number, and a copy (or the old one after a re-forge) is an ordinary tool.
- **It's open for grabs.** Whoever holds it keeps its level, and the server is told when it changes hands or goes loose.

It **levels I–X on Grit**: a **netherite pickaxe** whose Efficiency, Fortune and damage grow, until at **Level X it's reforged as a Tinkers' Vein Hammer**.

## Levels
| Level | Grit | Item | Damage | Mining | Prospector | White-hot | Grudge bonus | Earthshaker |
|---|---|---|---|---|---|---|---|---|
| I | 0 | netherite pickaxe | 6 | Efficiency I, Unbreaking I | 2 blocks | 10% | +10% | |
| II | 100 | | 7 | Eff I, Unb II | 2 | 14% | +12% | |
| III | 300 | | 8 | Eff II, Unb II, Fortune I | 2 | 19% | +14% | |
| IV | 600 | | 8 | Eff II, Unb III, Fortune I | 3 | 23% | +17% | |
| V | 1,000 | | 9 | Eff III, Fortune I | 3 | 28% | +19% | ✦ 3 blocks |
| VI | 1,600 | | 10 | Eff III, Fortune II | 3 | 32% | +21% | 3 |
| VII | 2,400 | | 11 | Eff IV, Fortune II | 4 | 37% | +23% | 3 |
| VIII | 3,400 | | 12 | Eff IV, Fortune II, Mending | 4 | 41% | +26% | 4 |
| IX | 4,700 | | 13 | **Eff V, Fortune III**, Mending | 4 | 46% | +28% | 4 |
| **X** | 6,500 | **Tinkers' Vein Hammer** | **14** | Haste V, Luck III | **5** | **50%** | **+30%** | 4 |

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

## Abilities
- **Prospector:** mining an ore with it makes the ore within the level's radius **glow through walls** for 5 seconds.
  - The glow is a gold outline: a glowing block display of each ore. Anyone near can see it.
  - Up to 40 ores at a time, at most once every 2 seconds. Leftover displays from a restart are cleared within 5 seconds.
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
`LEVELS` (Grit, damage and enchantments per level), the pickaxe's and hammer's ids, speeds and durability, `HAMMER_MATERIALS`, `HAMMER_UPGRADES`, `PROSPECT_RADIUS` and the glow's time, cooldown, cap and colour, `WHITE_HOT_FROM/TO`, `GRUDGE_FROM/TO/DAYS`, Earthshaker's radius, share, slowness, cooldown and `SHAKE_HITS_PLAYERS`, `CRIT_GRACE_MS`, the Grit values, `BOSS_GRIT`, and how often it looks for its holder.

**Saved data:** `persistentData["deepdelver_maul"]`: its serial, holder, whether it's loose, its Grit, the ledger and the stats.

**API:** `global.DeepdelverMaul = { levels, abilities, levelFor(grit), whiteHot(level), grudgeBonus(level), isRealMaul(stack), onLedger(uuid), state(), preview(grit), noteHit(...), finalDamage(...) }`. `preview` builds a void copy (serial 0) to check what a level looks like.

## Install
1. Copy `deepdelver_maul.js` to `kubejs/server_scripts/`, and `deepdelver_maul_hooks.js` to `kubejs/startup_scripts/`.
2. Restart the server, for the hook.
3. `/maul give Goruk`.

It needs Tinkers' Construct for Level X.

## Test plan (Goruk, a second account, an op)
1. `/maul give Goruk`: a netherite pickaxe named The Deepdelver's Maul, Level I. The tooltip shows "6 damage" and its four abilities.
2. **Grit:** mine coal ore (+1) and diamond ore (+8), and kill a zombie (+3). `/maul` shows the Grit.
3. **Prospector:** mine an ore next to others. The others glow gold through the stone for 5 seconds.
4. **The ledger:** let the second account hit Goruk. Goruk alone is told it's on the ledger, and `/maul grudges` lists it. Kill it with the Maul: everyone hears the grudge is settled.
5. **White-hot:** hit an armoured zombie with and without the hook installed. It takes more with the hook.
6. **Earthshaker:** `/maul setgrit 1000`, jump and hit a mob in a crowd. Everything within 3 blocks is hit and slowed, with a stone burst.
7. **Level X:** `/maul setgrit 6500`. It becomes a Vein Hammer with Haste V and Luck III, and mines whole veins.
8. **Open for grabs:** Goruk drops it: "loose" within about 10 seconds. The second account picks it up: "claimed".

## Checked on the local test server (11 Nov 2026)
Built in real KubeJS with `preview()` (no player online) and read back:
- **The hook loads:** 2 of 2 startup scripts, 0 errors.
- **Level I:** a netherite pickaxe with Efficiency I and Unbreaking I. The game reads +5 attack damage and −2.8 speed (6 damage, 1.2 speed). The lore is right.
- **Level X:** Tinkers built the Vein Hammer from the four materials.
  - It has **Haste V and Luck III** applied, plus the traits: Manyullyn's **Insatiable II** (damage builds on consecutive hits), Cobalt's **Momentum** (mining speeds up as you go), Hepatizon's **Lightweight** and the hammer's **Pierce II**.
  - 6,875 durability, netherite mining tier, mining speed 10.3 (the vein hammer's ×0.3).
  - The game reads +13 attack damage: 14 damage.

## What couldn't be verified
- **In a fight and in a mine:** the mock tests pass, but nobody has used it yet. Things to watch:
  - how strong White-hot and the grudge bonus feel with the hook;
  - whether Tinkers' vein mining gives Grit (and Prospector) for every ore in a vein or only the first one broken (it depends on whether Tinkers fires a break event for each block);
  - the glow's look.
