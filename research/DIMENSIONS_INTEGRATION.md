# The new dimensions in the Blood Pool and the Potato War (Part II)

How the three dimension mods added in November 2026 could tie into the server's systems: **the Aether 1.5.2**,
**Deeper and Darker 1.3.3** (the Otherside) and **Blue Skies 1.3.31** (the Everbright and the Everdawn).

**A proposal: nothing is built.** Every balance and story call here is the owner's. Each section gives the options
and a recommendation, and the decisions are gathered at the end. The evidence is in [`dimensions/`](dimensions/), with
each claim marked as read from the jars or inferred:
- [`BLUE_SKIES_GEAR.md`](dimensions/BLUE_SKIES_GEAR.md): Blue Skies' gear, its own rules, ladder, numbers and leaks;
- [`BOSSES_AND_CHESTS.md`](dimensions/BOSSES_AND_CHESTS.md): the three mods' bosses, reward chests and structures;
- [`MACHINES_FOOD_LOOT.md`](dimensions/MACHINES_FOOD_LOOT.md): stations, the tree's gear lock, potatoes, Loot
  Integrations, mobs and events.

**How it was read** (25 November 2026):
- the jars' own data, and their classes read with `javap` (nothing from a jar was run);
- the index of their data built with `research/tools/Indexer.java`;
- the Blood Pool's own `tierOf` for every comparison;
- the test server's configs, as a stand-in for the live server's.

**The gear check of 25 November** ([GEAR_BALANCE.md](GEAR_BALANCE.md)) read every sealed and proposed item's numbers and
powers again and confirmed the Blue Skies proposal (charoite and diopside at Tier 4). Resonarium armour moved to Tier 7
(26 November), and every sealed item with a power is now held by a lock (built, owner decisions).

Nothing was tried in game. These key numbers were checked a second time against the bytecode:
- the bosses' health;
- Blue Skies' penalty on outside gear, and its progression rule;
- the Alchemist villager's blaze rods;
- the sapling recipe and the sapling tag.

## At a glance

| # | Area | Recommendation | Does it change the live server now? |
|---|---|---|---|
| 1 | Blue Skies' gear | Charoite and diopside at Tier 4, with wear and wield locks. The rest stays open | Only per player: the rank check on the armour, and the tree node if it's added (#6) |
| 2 | The Alchemy Table's sapling recipe | Override one data file so it stops making Twilight Forest's magic saplings | **Yes, at once** |
| 3 | Boss Blood | The eight dimension bosses pay 200 to 1,000. The Warden and the Wither pay for each player's first kill. The Ender Dragon pays for the server's first kill | Yes: new Drops |
| 4 | Bonus loot | Potato crates and spoils in the Aether's Treasure Chests, and from key-summoned Blue Skies bosses | Yes |
| 5 | Deep Records | The Otherside's temples first, then the Aether's Treasure Chests and Blue Skies' libraries | Yes |
| 6 | The Potato War tree | The already-tiered gear goes into the smithy nodes, plus a new Tier 7 Warden node, and the gear check learns Curios slots | Yes, per player |
| 7 | Skyroot double drops | Not on bosses | Yes, at once |
| 8 | Events | Vault Curios in the Purge, and Blue Skies' arcs in every event. No Astrolabe or Sculk Transmitter during an event | Yes |
| 9 | The dimensions | Stay open | No change |

## Where things stand

| | The Aether | Deeper and Darker | Blue Skies |
|---|---|---|---|
| Dimension | Open from day one (glowstone frame, lit with water) | Open from day one (a Warden's Heart of the Deep lights the portal) | Open from day one (portals start in Gatekeeper houses; the Zeal Lighter costs 8 emeralds) |
| Gear in the Pool's tiers | Done 22 Nov: gravitite 4, zanite sword and netherite gloves 5 | Done 22 Nov: resonarium tools 4 and armour 6 (7 since 26 Nov), warden gear 7, sonorous staff 9 | **None: all of it is craftable at Tier 0** |
| Looted copies held | Yes (`WEAR_LOCKS`, `WIELD_LOCKS`) | Yes | No |
| In the Potato War tree | No | No | No |
| Bosses pay Boss Blood | No | No boss (the Warden doesn't pay either) | No |
| Deep Records sites | No | No | No |

### What still bites on the live server
The live Pool was past Tier 5 on 25 November (`tools/kubejs/POTATO_TREE.md`, "Known: only below Pool Tier 5"). This page
assumes Tier 5: Tier 6 needs 480,000 Drops and two relics. At Tier 5:
- **The Pool's seals at Tier 5 or below change nothing for now.** The item is already open, and its wear and wield locks do
  nothing.
- **The rank check still bites for Tier 4 and 5 items made at a crafting table.** Rank 4 or 5 is needed until catch-up opens
  them to everyone: Tier 4 at Pool Tier 6, Tier 5 at Pool Tier 7.
- **Tree nodes still bite per player** until catch-up gives them to everyone at the same two-tier gap. Every node up to Tier 3 is
  already everyone's.
- **Seals at Tier 6 and up, data fixes and new content** (Boss Blood, bonus loot, records) work at once.

So on the live server, gear is reached through the ranks and the tree. The Pool's seals are what a fresh world would feel.

## 1. Blue Skies' gear

### Blue Skies polices itself
In the Everbright and the Everdawn, gear from other mods works poorly. Read from `SkiesEntityHooks`, `PlayerHooks` and
`LivingEntityHooks`:
- **Melee:** a hit with an outside weapon does `min(7, damage × 0.3)`. A netherite sword's 8 becomes 2.4.
- **Projectiles:** capped at 5, unless the projectile is Blue Skies' own (its spears).
- **Armour:** each outside piece (except leather, gold and turtle) loses 2 to 4 armour points. Full diamond shows 9.
- **Tools:** outside tools mine at bare-hand speed, and can't break anything that needs a stone tool.

"Outside" means any item outside the `blue_skies` namespace that is a tiered tool above wood, stone and gold, or whose id ends
in one of 21 tool and weapon words (sword, axe, pickaxe, spear, mattock…).

**The penalty never lifts in survival.** A player is exempt once their progression is 3 in both dimensions. But Blue Skies
1.3.31 has two bosses in each dimension, and they're worth progression 1 and 2:
- `EntityUtil.hasPlayerCompletedProgression` needs 3 in both (read);
- the four bosses' `getProgression` return 1, 1, 2 and 2 (read).

Only creative players and the op command `/blue_skies set_progression` escape it. There's no config switch.

So, like the Aether's tool debuff, other mods' gear can't skip Blue Skies' ladder inside its dimensions. **Outside them, Blue
Skies gear works at its full numbers.** That's what the tiers below are about.

### The ladder and the numbers
Read from `SkiesArmorMaterial`, `SkiesItemTier` and `SkiesItems`. Armour is a full set's defence / toughness. The tier after
each comparable item is its `tierOf` today. The full table is in `BLUE_SKIES_GEAR.md`.

| Gear | How it's got | Armour | Weapon and tools | Comparable (tier) |
|---|---|---|---|---|
| Wood, comet wood, turquoise and lunar stone tools | crafted | | swords 4 to 5 | vanilla wood and stone (0) |
| Pyrope | gems from ore, both dimensions | 12 / 0 (chainmail) | sword 5.5; tools stone level, very fast | chainmail, iron (0) |
| Aquite | ore, both dimensions | 15 / 0 (iron) | sword 6; tools iron level | iron, ironwood, zanite armour (0) |
| Horizonite | ore, the Everdawn | 12 / 0 | sword 6; tools diamond level but only 250 uses; sets targets alight and smelts block drops | iron (0) |
| Spears | crafted | | 4 melee, **8 thrown**, Loyalty | trident (0) |
| **Charoite** | ore, both dimensions: 1 vein a chunk, iron pickaxe | **20 / 8** | **sword 7**; tools diamond level, 1,561 uses | diamond (0); steeleaf, gravitite, resonarium tools (4) |
| **Diopside** | gems from ore, both dimensions: 1 vein a chunk, iron pickaxe | **16 / 18** | **sword 9 (1.2 speed), axe 12 (0.5 speed)**; tools diamond level, 1,661 uses | diamond (0); netherite, 8 a hit (5); zanite sword (5) |
| Different Sword (the Arachnarch's rarer loot bags) | loot | | **11**; every hit gives the *target* Regeneration IV for 2 s | netherite (5), fiery (6), warden (7) |
| Crushing Hammer (the Starlit Crusher's rarer bags) | loot | | 12; a charged slam does 6 to everything within 7 blocks | the Aether's dungeon loot (unsealed) |
| Arcs (each boss's loot bag) | loot | | Ethereal: +10 to 20% speed. Dusk: invisible while sneaking. Nature: 2 to 6 extra health. Poison: +1 to 3 damage while poisoned | heart canisters (0); the Aether's life shards (unsealed loot) |

Blue Skies has no set bonuses, and nothing in it needs a diamond pickaxe. Shadow armour (20/12) and the Infused Arc Sword
exist in the code but have no recipe or loot, so 1.3.31 never hands them out.

### Proposed tiers

| What | Tier | Why |
|---|---|---|
| The Everbright and the Everdawn | open | As the Aether and the Otherside are; Blue Skies' own penalty holds outside gear back |
| Wood, stone, pyrope, aquite and horizonite gear; spears; the moonstone shield; every ore, gem and ingot; the Zeal Lighter | 0 | Wood to iron strength, like ironwood and zanite |
| **Charoite armour and tools** | **4** | Diamond's exact numbers. Modded diamond-class gear sits at 4 (steeleaf, gravitite, resonarium tools). *Option: 0, since it's no stronger than vanilla diamond (0)* |
| **Diopside armour and tools** | **4** | Diamond-class overall. *Option: the sword and axe at 5. Their 9 and 12 a hit beat netherite's 8 and 10 (the zanite sword's reason for Tier 5), though they're slower per second* |
| Boss loot: arcs, the Different Sword, Crushing Hammer, staffs, Summoning Table | not sealed | Loot only, like Twilight Forest's and the Aether's boss rewards. *Option: the Different Sword at 5, with a wield lock* |
| **The Alchemy Table** (the Alchemist boss's loot) | **3, with a place lock** | Its villager sells blaze rods, and it turns redstone into glowstone and sand into soul sand: Nether things before the Nether. This does nothing on the live server, where the Nether is open; it protects a fresh world |

**Wear and wield locks:** the eight charoite and diopside armour pieces (`WEAR_LOCKS`) and the ten tools (`WIELD_LOCKS`). These
are needed because villagers sell the gear:
- armourers, weaponsmiths and toolsmiths in Blue Skies villages sell diopside armour and tools, and charoite swords and axes, in
  place of diamond ones;
- the Shoveler sells shovels up to charoite;
- the Nightwatcher sells charoite gems.

No `USE_LOCKS` are needed.

**Two gaps to know about:**
- **The tool recipes skip the rank check.** The armour recipes are ordinary shaped recipes, so they get the rank check. The 95
  tool recipes are Blue Skies' own recipe types (`blue_skies:diopside_sword`…), with no pattern in their JSON to rebuild them
  from. Once Tier 4 is open, the tools can be crafted without rank 4. Catch-up opens them to everyone anyway at Pool Tier 6.
  Closing the gap would mean replacing ten recipes with KubeJS shaped ones and losing Blue Skies' choice of handle.
  **Recommendation: accept it.**
- **`/bloodpool audit` can't see those tool recipes,** because their JSON names no result. KubeJS should still find the result
  when it removes recipes by output (inferred). So also add the id pattern
  `/^blue_skies:(charoite|diopside)_(sword|pickaxe|axe|shovel|hoe)$/` to Tier 4's `recipes`, and look in JEI after the reload.

**Arcs can't be held by any lock.** They sit in Blue Skies' own four arc slots, not in Curios. None is proposed for sealing.
If one ever is, the lock needs a Blue Skies hook: `SkiesPlayer.getIfPresent(player, …)` and `getArcInventory()` (read; not
tried from KubeJS).

**Charoite or diopside gear already made on the live server** (crafted or bought since Blue Skies went in): at Pool Tier 5,
the Pool's locks wouldn't touch it, because Tier 4 is open. It would only meet the tree's lock if added to Osmium & Steeleaf
(#6). Then players without that node would have it taken off.

## 2. The Alchemy Table's sapling recipe

**The biggest finding for the live server.** Blue Skies' Alchemy Table has no recipe; it turns up in the Alchemist boss's
loot bags. One of its catalyst recipes is `blue_skies:alchemy_recipes/sapling.json` (read):
```json
{ "type": "blue_skies:catylist", "catylists": ["minecraft:echo_shard"],
  "input_tags": ["minecraft:saplings"], "results_tags": ["minecraft:saplings"] }
```
In this pack, `#minecraft:saplings` holds Twilight Forest's **time, mining, sorting and transformation saplings** (read: the
pack's tags). So any sapling plus one echo shard makes a Timewood, Minewood or Sortingwood sapling, as often as wanted. Echo
shards come from ancient cities, the Otherside's temples and Moog's Soaring Structures.

**Why it matters:** the earlier research kept the magic tree cores switched on because each was "a natural block found in a
magic tree… a found-item treat" (`research/TIER_PROPOSAL.md` 5.3, `03_BYPASSES.md`). What the cores do:
- the **Timewood core** gives machines and crops within 8 blocks extra ticks (the range set in the shipped
  `tools/serverconfig/twilightforest-common.toml`);
- the **Minewood core** pulls ore veins to its tree;
- the **Sortingwood core** moves items between containers.

With this recipe the cores are unlimited, and several can be stacked around a base. Together they do the work of three Potato
War nodes outside the tree: Growth Acceleration, Logistical Transport (Tier 4) and Automated Mining (Tier 7).

**The Pool can't see it.** The Alchemy Table's recipes are Blue Skies' own data (`data/blue_skies/blue_skies/alchemy_recipes/`),
loaded by its own reload listener, not by the recipe manager. No recipe lock, rank check or audit reaches them.

**Options:**
1. **Override the file (recommended).** Ship `tools/kubejs/data/blue_skies/blue_skies/alchemy_recipes/sapling.json` listing
   only vanilla and Blue Skies saplings, as explicit `inputs` and `results` (the form other catalyst recipes use, such as
   `soul_sand_from_sand.json`). It works at any tier. A datapack file at the same path normally replaces a reload listener's
   file, but this hasn't been tried: check it on the test server.
2. **Also lock the magic saplings in the tree:** `twilightforest:sorting_sapling` in Logistical Transport's `places`, and
   `mining_sapling` in Automated Mining's. This also covers saplings from tree-cache chests, which the earlier decision kept as a
   treat. Putting `time_sapling` in Growth Acceleration would do nothing on the live server, because catch-up has already given
   that Tier 1 node to everyone.
3. Lock the Alchemy Table itself in a node. This would also stop its harmless colour and wood swaps.

The table's other conversions don't matter on the live server, where the Nether is open: glowstone dust from redstone, soul
sand and soul soil (with soul fragments), netherrack (with a nether wart) and end stone (with a chorus fruit). They're what the
Tier 3 place lock in section 1 is for, on a fresh world.

## 3. Boss Blood

Today `boss_blood.js` pays for the eight Twilight Forest bosses only (Naga 200 to Snow Queen 1,000, about a quarter more for each
rank). The amounts below put the new bosses on that scale. Rank is set by how hard the fight is, not by how hard each blow hits:
these bosses hit much harder than Twilight's. Health and attacks are read from each boss's class.

| Boss | Entity id | Fight | Drops | Twilight peer |
|---|---|---|---|---|
| Slider | `aether:slider` | 400 health; only pickaxes hurt it; one predictable attack (6). Bronze dungeons are the most common | **200** | the Naga |
| Stalker (mini-boss) | `deeperdarker:stalker` | 200 health, 4 armour, 22-damage hits, a damage ring and leeches. It comes from about 5% of temple vases | **250** | the Minoshroom |
| Summoner | `blue_skies:summoner` | 350 health (+200 for each extra player); minions, heals, dodges projectiles, hits capped at 15 | **400** | the Lich |
| Alchemist | `blue_skies:alchemist` | 500 (+150); fire, poison and blindness | **500** | the Knight Phantoms |
| Valkyrie Queen | `aether:valkyrie_queen` | 500; 13.5 melee, homing crystals, teleports. She needs 10 Victory Medals first, one from each Valkyrie | **650** | the Hydra |
| Starlit Crusher | `blue_skies:starlit_crusher` | 500 (+150); 10 melee, area attacks, summons | **650** | the Hydra |
| Arachnarch | `blue_skies:arachnarch` | 500 (+200), 6 armour, 14 melee; drops from the ceiling, heals 50 | **800** | the Ur-Ghast |
| Sun Spirit | `aether:sun_spirit` | 500; it can only be hurt for 8.75 seconds after its own ice crystal is hit back into it. Its fire and its minions deal 15 | **1,000** | the Snow Queen |
| Warden | `minecraft:warden` | 500 health, 30 melee, a sonic boom through armour | **500, each player's first** | the Knight Phantoms |
| Wither | `minecraft:wither` | 300 health; built at will once the Nether is open | **500, each player's first** | |
| Ender Dragon | `minecraft:ender_dragon` | the End opens at Tier 9 | **1,250, the server's first kill** | |

One of each of the eight dimension bosses pays 4,450 Drops; Twilight's eight pay 4,100.

**Detecting the kill:** by entity id through `EntityEvents.death`, as now. None of these is multi-part, and each dies through
`super.die()`, so the death event fires (read; not tried in game). Minions have ids of their own. The guards:
- **The Aether:** each boss is placed once with its dungeon. Pay only a boss with the NBT `Dungeon` tag, which a `/summon`ed
  one doesn't have.
- **Blue Skies:** **farmable.** Each boss's arc summons it again every 3 minutes, and so does a stack of 4 keys (the Gatekeeper
  sells keys). Pay only when `BossRespawned` is false and `DungeonSpawned` is true, and once for each `BossHomePos` (each dungeon).
- **The Stalker:** finite, since vases don't come back.
- **The Warden and the Wither:** they can be summoned again at will (the Otherside's temples have shriekers that summon Wardens),
  so pay each player's first kill only.
- **The Ender Dragon:** the server's first kill only, since respawning it is cheap once the End is open.

**To build:** `boss_blood.test.js` checks for exactly the eight Twilight bosses, matching `twilight_bosses.js`, so the new
ones belong in a second table with their own guards. The `/bossblood` header says "Twilight Forest bosses".

*Optional:* the Anamian Axe's `BOSS_SOULS` and the Deepdelver's Maul's `BOSS_GRIT` list only Twilight Forest, Ice and Fire, the
Wither and the Dragon. The new bosses could join them.

## 4. Bonus loot

- **The Aether's Treasure Chests** (`aether:treasure_chest`):
  - each is placed with its dungeon, with `Kind` bronze, silver or gold, and locked by its boss's key;
  - its loot table is `aether:chests/dungeon/<kind>/<kind>_dungeon_reward`;
  - the gold one already fills all 27 slots in about 31% of openings (simulated from its loot table), so adding pools to the
    table would lose items. Instead, fill empty slots after opening, the way the Dragon Hoard does;
  - add potato crates and spoils on Twilight's scale by rank (bronze as an early boss, gold as the last), skipping sealed
    items (`isLocked`).
- **Blue Skies' bosses** leave no chest. Each nearby player gets a loot bag only they can see. Adding to the bag tables would
  pay out on every 3-minute arc re-summon. So reward from the death hook instead, with the same guard as Boss Blood
  (key-summoned, once a dungeon).
- **The Otherside's temples** are already rich (enchanted golden apples, diamonds, warden templates). Leave them as they are.
- **Never add these as spoils** (as Twilight's `KEY_ITEMS` aren't): the Aether's dungeon keys and Victory Medals, Blue Skies'
  keys and arcs, and the Heart of the Deep. They open fights or portals.

## 5. Deep Records

| Site | Loot tables | Chance | Why |
|---|---|---|---|
| **The Otherside's temples** | `deeperdarker:chests/ancient_temple_apex`, `…_secret` | **50%**, books 1–5 | The books' own lore (below). Getting there takes a Warden kill |
| The Otherside's temples, other chests | `…_basement`, `…_storage`, `…_fountain` | 15–20% | Many chests to a temple |
| **The Aether's Treasure Chests** | `aether:chests/dungeon/{bronze,silver,gold}/*_dungeon_reward` | **50%** | Boss vaults, like Twilight's key rooms |
| **Blue Skies' dungeon libraries** | `blue_skies:chests/blinding_dungeon/library_chest`, `library_chest_key` | **50%** | Libraries |
| Other dungeon chests | the Aether's `bronze_dungeon` and `silver_dungeon`; Blue Skies' `study_chest` and the nature and poison dungeons' chests | 10–30% | Dungeon crawls |

- **Why the Otherside fits best:**
  - Book 2 says the Warden replaced the dead dragon as Records Security, and the old records are kept in the deep cities.
  - The Surveyor's notes (#9) point to the deep cities, where the Warden listens.
  - The Otherside lies beneath the ancient cities, and opens with a Warden's heart.
- **Books 1–5 only.** Books 6–8 stay in End Cities (owner decision).
- *Story options, the owner's call:*
  - a record of the Otherside's own (the archive the books keep pointing to);
  - Blood God lines for the server's first Warden kill;
  - a line for the Sun Spirit's death, which ends the Aether's eternal day.

  The books' rule stands either way: signed `[REDACTED]`, and never naming the Ministry.

## 6. The Potato War tree

### Gear, per player
**How the tree's lock reaches gear** (read: `potato_tree.js`):
- hits and breaking blocks: the main hand;
- right-clicks: the item used;
- armour: slots 36–39, every 40 ticks;
- no Curios slots and no offhand.

The Pool's own wear lock does check Curios (`takeOffSealed`).

| Node (tier) | Add to its `gear` | On the live server (Pool Tier 5) |
|---|---|---|
| Osmium & Steeleaf (4) | Gravitite armour and tools (9), resonarium tools (5); the gravitite gloves once the lock checks Curios. Charoite and diopside (18), if section 1 is accepted | Per player until Pool Tier 6 |
| Cobalt Smithing (5) | The zanite sword | Per player until Pool Tier 7 |
| **Warden Forging (7), new** | Warden armour and tools (9), and resonarium armour (4; Tier 7 since 26 November) | Yes |
| Dragonsteel (9) | The sonorous staff (the tree's right-click lock stops its beam) | Yes |

- **Warden Forging, the new node:**
  - smithy chapter, rank 7, Tier 7, needs Alloy Smithing;
  - it also takes resonarium armour, which moved to Tier 7 (26 November);
  - 175,000 like the other Tier 7 nodes (Enchanted Potatoes after the reveal), plus 4 `deeperdarker:reinforced_echo_shard`;
  - an `n` not used before (check the history).
  - Folding warden gear into Masterwork instead would hold it a tier past its Pool tier (8 against 7).
- **The Curios check:** give `checkArmor` the Curios pass that `takeOffSealed` already has. The Aether requires gloves for set
  abilities (its default), so a glove lock also switches off the gravitite set's powers.
- **The Aether's loot-only gear** (Valkyrie, Phoenix, the dungeon swords): the tree could hold it per player, since its lock
  needs no Pool tier. But the 22 November decision left dungeon loot open. Not recommended unless that's revisited.

### Stations
- **The Aether's Incubator: an optional "Moa Hatchery"** (farms, Tier 5, beside Mob Spawning). Only incubated moas take a
  saddle, and they get 8, 4 or 3 jumps in mid-air. Flavour more than balance: brooms already fly from Tier 2.
- **No node needed:** the Altar (its one sealed result, enchanted gravitite, is already Tier 4), the Freezer, Blue Skies'
  Horizonite Forge and Snowcap Oven, the Food Prep Table and the Trough. They're conveniences, and "regular machines aren't
  locked". Hoppers and pipes work on all of the furnace-like ones.
- **Deeper and Darker has no machines.**

### Flying mounts
- **Phygs and Flying Cows** spawn wild in every Aether biome. When saddled they can jump in mid-air (read: `WingedAnimal.canJump`;
  that this adds up to flight is inferred).
- They can be ridden anywhere, including off the Aether's edge into the Overworld.
- Not a problem on the live server, where brooms fly from Tier 2.
- *A story hook if wanted:* Techno's pigs can fly. A lock would need new entity-interaction code.

## 7. Potatoes in the new dimensions
- **Potatoes grow on the Aether's and Blue Skies' farmland.** Their hoes till their grass and dirt, and their farmland takes
  any crop (read). Light in each dimension:
  - **the Aether:** eternal day until its Sun Spirit is beaten;
  - **the Everbright:** fixed at noon;
  - **the Everdawn:** fixed at dawn. Its sky light is about 10, so growth may stall in rain (inferred);
  - **the Otherside:** no skylight. It needs carried-in dirt and torches.

  So farms in the Aether and the Everbright grow around the clock.
- **Nothing in the three mods is a potato,** or counts for the tithe, the Press or a node. The only potato is a baked one in a
  Gatekeeper house chest.
- **The Pool is already protected** by the tithe's 30,000 Drops a day, `POTATO_SHARE` and `RANK_LEAD`. Sky farms mean faster
  ranks, not a faster Pool.
- **Recommendation: nothing to change.**

## 8. Skyroot double drops
- **What it does:** the Aether doubles every drop of a mob killed with a fully charged Skyroot weapon, in any dimension (read:
  `DoubleDropsModifier`). Skyroot weapons are wooden, at Tier 0.
- **What its exclusion tags hold:** players, the Wither and the Ender Dragon, and a few items (dungeon keys, the Victory Medal,
  heads, the nether star) (read).
- **What can come twice:**
  - the Lich's scepters (Tier 7);
  - the Ur-Ghast's carminite (Tier 7);
  - the Hydra's fiery blood;
  - Wardens' drops (it depends on the order of loot modifiers, not determined);
  - Ice and Fire dragon loot (dragons are harvested from their corpses, so whether the doubling reaches it is unknown).

**Recommendation:** add the Twilight Forest bosses, the Warden, Ice and Fire's dragons and the dimension bosses to the entity
tag `aether:no_skyroot_double_drops`, in a `replace: false` file in `tools/kubejs/data/aether/tags/entity_types/`. Keep the
doubling for ordinary mobs: it's the Aether's own feature.

## 9. Events (the Purge, the Gladiator Arena, the Shrine)
Read from `purge.js`, `gladiator_arena.js` and `shrine.js`:
- **The Purge's vault takes only the inventory.** Worn Curios stay on in its kit fights: the Aether's gloves (+0.25 to +1
  damage), the regeneration stone, the shield of repulsion and the invisibility cloak. The arena and the Shrine do vault
  Curios.
- **No vault takes Blue Skies' arcs:** up to +20% speed, invisibility while sneaking, 6 extra health, and +3 damage while
  poisoned.
- **Life Shards** (the Aether's gold dungeons) give +20 maximum health that no kit takes away.
- **Ways out or around:**
  - the **Astrolabe**, sold by Blue Skies villagers, teleports its holder to its Star Emitter within 300 blocks;
  - the **Sculk Transmitter** (Otherside temple loot) opens a linked chest from any distance in the same dimension: resupply in
    own-gear matches;
  - portals can be built anywhere;
  - falling out of the Aether lands at the same x and z in the Overworld (onto an arena in the sky too, inferred).
- **An event in the Everbright or the Everdawn:** Blue Skies' penalty caps every outside weapon at 7 a hit and ranged hits at
  5. That includes the Anamian Axe, the Syndicate Slayer and the Maul.
- **Own-gear fights:** still open from `AETHER_DEEPERDARKER.md`: the sonorous staff ignores armour (a resonarium set does
  *not* stop it, as that doc first said; corrected 25 November), and a full resonarium set shrugs off ordinary hits. Add
  Blue Skies' Different Sword and Crushing Hammer, and spears' full thrown damage.

**Recommendation:**
- vault Curios in the Purge;
- vault arcs in all three events (through the capability above; it needs testing);
- refuse the Astrolabe and the Sculk Transmitter while a match or the Shrine's night runs.

Own-gear matches are the owner's call.

## 10. Smaller things worth knowing
- **Tamed Sculk Snappers** drop enchanted books: any registered enchantment at a random level, up to 8 per snapper, and they
  breed (config `snapperDropLimit`). A renewable book farm. Leave it, or lower the limit.
- **Warding Pearls** (Blue Skies, crafted) stop natural and spawner monster spawns within 25 blocks, in any dimension. Mob
  farms near one stop. Events' scripted spawns aren't natural, so events are safe (inferred).
- **Snowcap mushrooms** put out nearby campfires, and the Shrine's braziers are campfires. The radius wasn't read.
- **Loot Integrations** only mixes vanilla tables into Moog's Soaring Structures chests. None of the three mods' chest loot
  travels anywhere, and nothing still sealed leaks. Nothing to do. If it's ever needed, the lever is the item tag
  `lootintegrations:ignored`.
- **The Aether's ruined portals** don't generate: their built-in datapack is off on the test world.

## 11. The dimensions themselves
Keep all three open:
- the Aether's and Blue Skies' penalties hold outside gear back in their own dimensions;
- the Otherside needs a Warden kill to open.

Gating one would follow `dimension_gates.js` (players sent back), but nothing here argues for it.

## Decisions for the owner
1. **Blue Skies' gear:** charoite and diopside armour and tools at Tier 4, with wear and wield locks (recommended). The
   options: charoite at 0; diopside sword and axe at 5; the Different Sword at 5.
2. **The Alchemy Table:**
   - override its sapling recipe (recommended);
   - and/or put the sorting and mining saplings in their nodes' `places`;
   - and put the table itself at Tier 3 with a place lock, for a fresh world.
3. **Boss Blood:**
   - the eight dimension bosses at the amounts in section 3 (recommended);
   - the Warden and the Wither: each player's first kill (recommended), every kill, or not at all;
   - the Ender Dragon: the server's first kill (recommended), or not at all.
4. **Bonus loot:** crates and spoils in the Aether's Treasure Chests and from key-summoned Blue Skies bosses (recommended).
5. **Deep Records:**
   - the Otherside's temples, the Aether's Treasure Chests and Blue Skies' libraries at 50%, books 1–5 (recommended);
   - the lesser chests at 10–30% (optional);
   - a record of the Otherside's own (a story call).
6. **The tree:**
   - the Aether's and Deeper and Darker's tiered gear in the smithy nodes, a Tier 7 Warden Forging node, and the Curios check
     (recommended);
   - Blue Skies' Tier 4 gear in Osmium & Steeleaf, if 1 is accepted;
   - the Moa Hatchery (optional).
7. **Skyroot double drops:** not on bosses (recommended), or leave them as the Aether made them.
8. **Events:**
   - vault Curios in the Purge, and arcs in every event (recommended);
   - no Astrolabe or Sculk Transmitter during events (recommended);
   - own-gear matches (the sonorous staff, Different Sword, Crushing Hammer): your call.
9. **Sculk Snapper books:** leave them (recommended), or lower `snapperDropLimit`.
10. **To confirm:** the live Pool's tier. This page assumes Tier 5.

## What couldn't be determined
- **Nothing was tried in game.** Untested:
  - whether the sapling override takes effect;
  - whether KubeJS removes Blue Skies' code-built tool recipes by output;
  - whether the wield lock refuses Blue Skies tools' right-clicks;
  - whether the bosses' deaths reach `EntityEvents.death` (inferred from the bytecode);
  - the Treasure Chest's timing for a hoard;
  - whether a script can empty arc slots and remove the arcs' bonuses.
- **Mounts:** whether saddled Phygs and Flying Cows keep flying for as long as you jump.
- **Skyroot doubling:** the order of loot modifiers (Wardens), and Ice and Fire's corpse harvesting.
- **How common structures really are:** spacing was read, but how often terrain and biome allow one wasn't measured.
- **Some attack numbers:** the casters' spells, and the Warden's sonic boom as dealt.
- **The live server:** its tier, difficulty and configs. Blue Skies' loot-bag rarity depends on the difficulty. The test
  server's configs were the stand-in; for example, its Twilight Forest core ranges are 16 where the shipped config's are 8.
- **Blue Skies' professions:** which villager types can take them, which decides whether the Alchemist villager's blaze rods
  reach beyond Blue Skies' own villagers.

## For building: the ids
**Tier 4 `items` (Blue Skies):**
```js
'blue_skies:charoite_helmet', 'blue_skies:charoite_chestplate', 'blue_skies:charoite_leggings', 'blue_skies:charoite_boots',
'blue_skies:charoite_sword', 'blue_skies:charoite_pickaxe', 'blue_skies:charoite_axe', 'blue_skies:charoite_shovel',
'blue_skies:charoite_hoe',
'blue_skies:diopside_helmet', 'blue_skies:diopside_chestplate', 'blue_skies:diopside_leggings', 'blue_skies:diopside_boots',
'blue_skies:diopside_sword', 'blue_skies:diopside_pickaxe', 'blue_skies:diopside_axe', 'blue_skies:diopside_shovel',
'blue_skies:diopside_hoe',
```
- **Tier 4 `recipes`:** `/^blue_skies:(charoite|diopside)_(sword|pickaxe|axe|shovel|hoe)$/`.
- **Tier 3:** `'blue_skies:alchemy_table'` in `items` and in `PLACE_LOCKS`.
- **`WEAR_LOCKS`:** the eight armour ids above.
- **`WIELD_LOCKS`:** the ten tool ids above.

**Tree `gear` lists:**
- **Osmium & Steeleaf:** `aether:gravitite_{helmet,chestplate,leggings,boots,sword,pickaxe,axe,shovel,hoe}`,
  `deeperdarker:resonarium_{sword,pickaxe,axe,shovel,hoe}`, and `aether:gravitite_gloves` with the Curios check.
- **Cobalt Smithing:** `aether:zanite_sword`.
- **Alloy Smithing:** `deeperdarker:resonarium_{helmet,chestplate,leggings,boots}`.
- **Warden Forging:** `deeperdarker:warden_{helmet,chestplate,leggings,boots,sword,pickaxe,axe,shovel,hoe}`.
- **Dragonsteel:** `deeperdarker:sonorous_staff`.

**Data files** (`tools/kubejs/data/`):
- `blue_skies/blue_skies/alchemy_recipes/sapling.json`: the sapling override;
- `aether/tags/entity_types/no_skyroot_double_drops.json`, with `"replace": false`. Its values:
  - the eight Twilight bosses (as in `boss_blood.js`);
  - `minecraft:warden`;
  - the dimension bosses above;
  - Ice and Fire's `iceandfire:fire_dragon`, `ice_dragon` and `lightning_dragon` (check the ids; `"required": false`).

**Boss Blood:** the ids and amounts in section 3, with the guards listed there.
