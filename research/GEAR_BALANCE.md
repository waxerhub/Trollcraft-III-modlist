# Gear balance and the seals (Part II)

The owner asked on 25 November 2026 to "check all gear scores, armor, damage, and abilities of the items being sealed,
make sure abilities are locked and make sure the whole thing is balanced". This page is the result:
- the numbers, tier by tier;
- what was changed so that sealed gear's powers are really held (built);
- the placements that looked wrong, and the tier moves made for them (built 26 November).

**The owner's decisions:**
- **25 November, the scope:** lock *all* sealed gear with a real power, not only the dimension mods'. Part I
  carry-overs, loot and trades all count. Weak gear (no better than netherite, and no ability) is left alone.
- **26 November, "apply them":** the recommended tier moves below, and the cap on Draconic's damage modules.

The tables below show the tiers after the moves.

## How it was checked
- **About 1,000 items** from the dimension mods, vanilla with the adventure and magic mods, and the tech mods with Tinkers.
  Numbers come from the jars' classes (read with `javap`, nothing run) and data, and from the configs: the repo's
  `tools/serverconfig/` first, then the test server's. Each value is marked read, config or inferred. The reports and
  their data are in [`gear/`](gear/):
  - [`DIMENSION_GEAR.md`](gear/DIMENSION_GEAR.md): the Aether, Deeper and Darker and Blue Skies, with every ability's
    trigger path checked against the locks;
  - [`REFERENCE_GEAR.md`](gear/REFERENCE_GEAR.md): vanilla, Twilight Forest, Botania, Ice and Fire, Alex's Caves, Ars
    Nouveau, EvilCraft, Reliquary, Hexerei, Immersive Engineering and Create;
  - [`TECH_GEAR.md`](gear/TECH_GEAR.md): Mekanism and its addons, Draconic, Redstone Arsenal, Powersuits, Create Sabers,
    Ender IO, Thermal, Extra Utilities and Tinkers with TAIGA;
  - the `.tsv` files: one row per item.
- **Scores:**
  - **Armour:** what a full set lets through from a hit of 10, 20 and 40. This uses Minecraft's own formula, read from
    the server jar (`CombatRules`): armour is capped at 30 and toughness at 20.
  - **Weapons:** damage a hit, and a second at the shown speed. One target takes at most two full hits a second (the
    hurt cooldown).
  - `node research/gear/score.js` rebuilds `research/gear/scores.txt` from the `.tsv` files.
- **Tiers** are the Blood Pool's own `tierOf`, and the locks were read from `blood_pool.js`.

## The locks: what changed (built 25 November)
| Gap | Before | Now |
|---|---|---|
| **Gear that's sealed but had no lock** | Only the Aether's and Deeper and Darker's gear was held. MekaSuits, the Meka-Tool, Draconic gear, Kikoku, the flight tiara, brooms, dragonsteel, the gorgon head, the Lich's scepters and the rest worked for anyone who had them | 291 more locks (3 of them with the tier moves on 26 November): 145 worn, 110 wielded, 24 used, 10 carried and 2 projectiles (the lists are in `blood_pool.js`, grouped by tier with the reason) |
| **An item's true tier** | A lock opened at the item's own tier. For a mod sealed by namespace, that's the namespace's tier: dragonsteel would open at 6, terrasteel at 2, the MekaSuit helmet at 4 | `LOCK_TIERS` holds 74 items to the tier their materials need: dragonsteel 9, terrasteel 6, Botania's Gaia gear 9, the MekaSuit 10, Draconic 10 and 11, the Atomic Disassembler 7. Crafting and ranks don't change |
| **The second before the check** | Sealed armour went back on with a right-click, or from the inventory screen, and worked for up to 19 ticks of every 20. In that window a resonarium set cut damage, the gravitite set cancelled falls, and warden leggings gave +50% speed | A right-click can't put it on, and anything put on comes off at once (the inventory event) |
| **Warden armour in the 4th hotbar slot** | It cleared Blindness and Darkness from there, worn or not (`WardenArmorItem.inventoryTick` acts on slot index 3) | Moved out of that slot, and taken-off pieces are never put there |
| **Better Combat's off hand** | Dual wielding swings the off-hand weapon, while scripts still see the main-hand item (`PlayerEntityMixin.getMainHandStack_Redirect`). A sealed sword in the off hand hit freely | The hit lock checks both hands |
| **Items that work by being carried** | Phoenix down, angelheart vial, angelic feather and charm of keeping III worked from the inventory | `CARRY_LOCKS`: moved to the ender chest (or dropped at the feet if it's full) |
| **Sealed arrows** | A dragonbone arrow (30 a shot) fired from an open bow | `PROJECTILE_LOCKS`: its hit does nothing |
| **Event kits** | (None of the old locks touched kit gear) | The arena's Troll Smasher and Terra Knight kits hold sealed gear. Kit items (`GladiatorKit`, `PurgeKit`, `ShrineKit`) are never held |

**Checked:**
- The hit lock cancels Forge's `LivingAttackEvent` at priority HIGH, the first thing `hurt()` does. So
  `hurtEnemy` (launches, fire, freezing, lightning) never runs.
- The right-click refusals stop `use` and `useOn` before they start: the sonorous staff can't charge, gravitite
  tools can't float blocks, and spears can't be thrown.
- Every sealed weapon's power runs through one of those paths. The one exception is Blue Skies' horizonite fire, which
  runs on `AttackEntityEvent`, but horizonite isn't sealed.
- The tests break each lock path on purpose to prove they would catch it. 12 of 12 were caught.
- The new script loaded on the test server with 0 errors and 0 warnings.

**Left alone on purpose:**
- **Weak sealed gear:** lapis and bronze tools, Ice and Fire's silver, copper, myrmex and deathworm gear, Botania's
  elementium, Alex's Caves' hazmat and primordial sets, Twilight's arctic armour, and Mekanism's own modules (the suit
  itself is locked).
- **Gear open on the live server:** at Tier 5, which includes the jetpack (Tier 4) and the netherite diving set (5).
- **Loot the owner chose to keep open** (22 November): the Aether's dungeon gear, life shards and the sculk transmitter.

## The ladder

### Armour (a full set; damage let through from a hit of 10 / 20 / 40; lower is better)
| Tier | Set | Armour / toughness / knockback | 10 / 20 / 40 | Power |
|---|---|---|---|---|
| 0 | Diamond | 20 / 8 / 0 | 3.0 / 8.0 / 24.0 | |
| 0 | Blue Skies charoite *(proposed 4)* | 20 / 8 / 0 | 3.0 / 8.0 / 24.0 | none |
| 0 | Blue Skies diopside *(proposed 4)* | 16 / 18 / 0 | 4.2 / 9.7 / 24.3 | none |
| 0 | Aether Valkyrie, Phoenix (loot) | 20 / 8 / 0 | 3.0 / 8.0 / 24.0 | lift; fire immunity (with gloves) |
| 0 | Aether obsidian (loot) | 20 / 12 / 0 | 2.8 / 7.2 / 20.8 | |
| 4 | Aether gravitite | 20 / 8 / 0 | 3.0 / 8.0 / 24.0 | higher jump, no fall damage (with gloves) |
| 4 | Twilight steeleaf | 20 / 0 / 0 | 4.0 / 12.0 / 33.6 | crafted with Protection II and more |
| 5 | Netherite | 20 / 12 / 0.4 | 2.8 / 7.2 / 20.8 | |
| 5 | Twilight knightmetal | 20 / 4 / 0 | 3.3 / 9.3 / 29.3 | |
| 5 *(was 7)* | Twilight arctic | 16 / 8 / 0 | 4.6 / 11.2 / 30.4 | |
| 6 | Twilight yeti / fiery | 20 / 12; 24 / 6 | 2.8 / 7.2 / 20.8; 2.0 / 5.4 / 19.9 | chills / burns attackers |
| 6 | Ice and Fire dragon scale | 26 / 8 / 0 | 2.0 / 4.0 / 14.4 | dragon breath x0.3 |
| 6 *(lock)* | Botania terrasteel | 20 / 12 / 1.0 | 2.8 / 7.2 / 20.8 | knockback immune |
| 7 *(was 6)* | **Deeper and Darker resonarium** | 18 / 4 / 0 | 4.1 / 10.9 / 32.5, **then nothing with all four** | a full set takes no damage from ordinary hits while its durability lasts |
| 7 *(was 6)* | Ice and Fire sea serpent | 23 / 10 / 0 | 2.0 / 5.2 / 17.4 | Strength IV in rain or water |
| 7 | Deeper and Darker warden | 24 / 16 / 0.4 | 2.0 / 4.0 / 12.3 | +50% walking speed, no blindness, silent steps |
| 7 | Redstone Arsenal flux | 20 / 4 / 0 | 3.3 / 9.3 / 29.3 | cancels 4 whole hits every 30 s |
| 7 | Powersuits (netherite plating) | 30 / 14 / 1.0 | 2.0 / 4.0 / 8.0 | modules |
| 8 | Mekanism Tools refined obsidian | 31 / 20 / 0.8 (30 / 20 counted) | 2.0 / 4.0 / 8.0 | |
| 8 | Mekanism Tools osmium | 21 / 12 / 0.4 | 2.4 / 6.4 / 19.2 | |
| 9 *(lock)* | Ice and Fire dragonsteel | 34 / 24 (30 / 20 counted) | 2.0 / 4.0 / 8.0 | dragon breath x0.3 |
| 10 | MekaSuit | 20 / 12 / 0.4 | **0** while charged | absorbs 100% of most damage |
| 10, 11 | Draconic chestpieces | 8 / 2 + shield | shields of about 750 / 2,650 / 9,300 | flight (draconic, chaotic) |

### Weapons (damage a hit; a second against one target)
| Tier | Weapon | Hit | Speed | A second | Power |
|---|---|---|---|---|---|
| 0 | Diamond sword / axe | 7 / 9 | 1.6 / 1.0 | 11.2 / 9 | |
| 0 | Blue Skies diopside sword / axe *(proposed 4)* | 9 / 12 | 1.2 / 0.5 | 10.8 / 6 | |
| 0 | Blue Skies Crushing Hammer, Different Sword (boss loot) | 12 / 11 | 0.7 / 1.6 | 8.4 / 17.6 | slam through armour / heals its target |
| 4 | Aether gravitite sword | 7 | 1.6 | 11.2 | launches the target |
| 5 | Aether zanite sword | 6 to 13 | 1.6 | up to 20.8 | stronger as it wears |
| 5 | Netherite sword / axe | 8 / 10 | 1.6 / 1.0 | 12.8 / 10 | |
| 5 *(was 2)* | Ars Nouveau enchanter's sword | 8 | 1.6 | 12.8 | casts its spell on hit |
| 5 *(was 8)* | Twilight giant sword | 12 | 0.5 | 6 | +2.5 reach |
| 6 | Ice and Fire elemental dragonbone swords | 9.5 | 1.6 | 15.2 | fire, freezing or lightning |
| 6 *(was 9)* | Botania terra blade | 8 + an 8 beam | 1.6 | 12.8 | |
| 7 | Deeper and Darker warden sword / axe | 9 / 11 | 1.6 / 1.0 | 14.4 / 11 | |
| 8 *(was 6)* | Ice and Fire ghost sword | 11 | 3.0 | 22 + spectral swords | |
| 8 *(was 6)* | **Ice and Fire dread knight sword** (loot) | **17** | 1.6 | **27.2** | |
| 8 | Refined obsidian sword / paxel | 12 / 17 | 1.6 | 19.2 / 27.2 | |
| 8 | Tinkers with TAIGA's triberium: sword / cleaver | 12.4 / 18 | 1.6 / 1.0 | 19.8 / 18 | |
| 8 *(was 4)* | Tinker's Rapier (triberium) | 19 | 2.75 | 38 | sting: an extra hit on a target without a chestplate |
| 9 | Ice and Fire dragonsteel sword / axe | 25 / 30 | 1.6 / 1.0 | 40 / 30 | fire, freezing or lightning |
| 9 *(was 7)* | **Extra Utilities' Kikoku** | **14** | 3.2 | **28** | never breaks |
| 9 *(was 7)* | Extra Utilities' Etheric Sword | 9 | no cooldown | 18 | |
| 9 | Deeper and Darker sonorous staff | up to 50 through armour | 6 s charge | | 14-block beam |
| 10 | Meka-Tool | 37 | 1.6 | 59 | mines anything |
| 10, 11 | Draconic swords | 8.75 to 17.5, **+1 / 2 / 4 per damage module** (was +4 / 8 / 16) | 2 to 3.2 | filled: about 24 / 68 / 206 | |

## The dimension mods' gear (the items being sealed)
| Item | Tier | Verdict |
|---|---|---|
| Aether gravitite armour, tools and gloves | 4 | **Right.** Diamond's numbers, plus a jump and fall cancel that need the gloves. The Valkyrie set (open loot) matches it |
| Aether zanite sword | 5 | **Right.** 6 rising to 13 as it wears |
| Aether netherite gloves | 5 | **Right.** +1 damage |
| Deeper and Darker resonarium tools | 4 | **Right.** Diamond's numbers |
| **Deeper and Darker resonarium armour** | **7** (was 6) | **Moved.** The earlier read had its power backwards. It doesn't cancel falls, poison or the void: it skips exactly those. A full set instead takes **no damage at all** from melee, arrows, explosions, fire and lava, while its durability lasts. Each blocked hit costs every piece that hit's damage in durability, and the 330-durability helmet goes first. That's a shield like Redstone Arsenal's flux armour (7) and stronger than anything else at 6 |
| Deeper and Darker warden armour and tools | 7 | **Right.** 24 / 16 / 0.4 sits just above dragon scale (6) and below refined obsidian (8) |
| Deeper and Darker sonorous staff | 9 | **Right.** Up to 50 through armour and Protection after a 6-second charge (14 blocks); with the Meka-Tool (37, Tier 10) and dragonsteel (25, 9). A resonarium set does *not* stop it, contrary to the earlier note |
| Blue Skies charoite armour and tools (proposed) | 4 | **Right.** Diamond's exact numbers (option: 0) |
| Blue Skies diopside armour and tools (proposed) | 4 | **Right.** About diamond overall: its armour lets more through at 20 (9.7 against 8.0) and the same at 40. Its sword (9) and axe (12) out-hit netherite per hit but not per second (option: the sword and axe at 5) |

## The tier moves (built 26 November)
The owner approved the recommendations ("apply them"). What was done, in order of how much it matters on the live
server:
1. **Resonarium armour, 6 → 7** (above).
2. **Extra Utilities' Kikoku and Etheric Sword, 7 → 9.** Kikoku does 14 at 3.2 swings a second and never breaks, the best
   melee short of dragonsteel. The Etheric Sword has no swing cooldown.
3. **Ice and Fire's dread knight sword and ghost sword, 6 → 8**, with the dread queen's sword. The dread knight sword is
   dungeon loot with no recipe, so its tier only times its lock. At 17 a hit, and 22 a second plus spectral swords, both
   beat refined obsidian (8).
4. **Draconic's damage modules, a quarter of their defaults:** draconium 0.5, wyvern 1, draconic 2 and chaotic 4 a
   module (were 2, 4, 8 and 16). They still stack without a limit, but a filled sword now reaches about 24 (wyvern, with
   dragonsteel), 68 (draconic) and 206 (chaotic) rather than 69, 236 and 770. This is a config file:
   `tools/serverconfig/ModuleStats.cfg`, for the server's `config/brandon3055/` (a restart is needed).
5. **Tinkers' nahuatl, 0 → 5.** It's the best handle in the pack (+25%), and an all-nahuatl sword (8.5) already equals
   netherite (Tier 5).
6. **TAIGA:** the alloys that need an End ore (03 fractum, 04 violium, 05 proxii, 08 imperomite, 13 astrium) or a Tier 9
   alloy (09 solarium, 10 adamant, 11 nihilite) moved from 8 to 9, with 14 to 27. Still no Potato War node covers
   TAIGA.
7. **Mekanism Tools' paxels (8)** hit like axes at sword speed (refined obsidian 17, osmium 14): **accepted**, left as
   they are.
8. **Too high for what they did:** Botania's terra blade 9 → 6 with terrasteel (Thundercaller and Starcaller, made from it,
   follow); Twilight's giant sword and pickaxe 8 → 5 and arctic armour 7 → 5.
9. **Too low:** Ars Nouveau's enchanter's sword 2 → 5 (netherite's numbers: 8 damage, 2,031 uses); Ice and Fire's sea
   serpent armour 6 → 7 (Strength IV in rain); dragonbone arrows 6 → 8 (30 a shot); Tinker's Rapier 4 → 8 (two heads
   and two handles at full weight). The enchanter's sword and the rapier joined the wield lock.
10. **Not changed, the owner's call:** flight comes early:
    - EvilCraft's broom and Ars Nouveau's Glide (2);
    - Mekanism's jetpack (4: real flight);
    - Hexerei's brooms and the cloak of darkness (6);
    - the flight tiara (9) and Draconic (11).

    Powersuits' jetpack needs a Tier 11 part, so the earlier "flight at Tier 7 (Powersuits)" was wrong.
11. **Not a tier move:** one-shot and through-armour items in own-gear events. The gorgon head (Ice and Fire, 6) kills what
    you look at. The others are the sonorous staff, the glass sword (Twilight loot, 40 once) and the Crushing Hammer's
    slam. They're worth keeping out of own-gear Purges and arena rounds.

**Checked:**
- The tests cover every move's tier.
- On the test server at Tier 5 (26 November), the in-game audit (`/bloodpool audit`) found **0 recipes still making a
  sealed item** (29,475 recipes).
- The scripts loaded with 0 errors, and Draconic kept the shipped module config.
- The offline audit (`tools/progression_audit.py`) wasn't re-run: this machine has no Python.
- **The upgrade tree is unchanged:** none of the moved items is in a node. TAIGA and Tinker's Rapier still have only the
  crafting seal, plus the rapier's wield lock.

## What couldn't be verified
- **In game, with a player** (the tests are offline, and the test server only loaded the script):
  - Better Combat's off-hand hit being stopped;
  - carried items going to the ender chest;
  - a dragonbone arrow's hit (the lock reads the hit's direct entity, `source.directEntity`);
  - Curios' right-click equip being refused;
  - kit gear in a real match.
- **The live server's** tier (assumed 5), difficulty and configs. The test server's configs were the stand-in, and
  `tools/serverconfig/` holds only a few mods'.
- **Some numbers** the reports list as unread: Draconic shields in use, Alex's Caves' staffs and spears, Botania's
  missile damage, Ice and Fire's siren flute, and Mekanism Weaponry's heat.
- **Which Part I items players still carry:** that needs the world's player data. The locks hold whatever they have.
