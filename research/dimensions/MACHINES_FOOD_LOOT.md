# The Aether, Deeper and Darker and Blue Skies: machines, food, loot and mobs against the Potato War

Read-only research, 25 November 2026. Sources: `aether-1.20.1-1.5.2-neoforge.jar`, `deeperdarker-forge-1.20.1-1.3.3.jar`,
`blue_skies-1.20.1-1.3.31.jar` (their data files, and their classes read with `javap -p -c`), `lootintegrations-1.20.1-4.7.jar`
and `lootintegrations_moog-2.2.jar`, five Twilight Forest 4.3.2508 classes (the magic tree cores), the test server's configs as a
stand-in for the live server's, and the repo's `potato_tree.js`, `blood_pool.js`, `purge.js`, `gladiator_arena.js` and
`shrine.js`. Blood Pool tiers come from `BP.tierOf` (`tools/ftbquests/load_scripts.js`). The prepared index of the three jars'
data (recipes, loot, tags) and the pack's older index (`research/index/`) were used for searches.

Each claim is marked **(read: where)** or **(inferred)**. The live server is past Tier 5 (POTATO_TREE.md, "Known: only below
Pool Tier 5"); its configs weren't seen.

## The short version

1. **Blue Skies' Alchemy Table turns any sapling plus one echo shard into any sapling in `#minecraft:saplings`**, which in this
   pack holds Twilight Forest's Time, Mining, Sorting and Transformation saplings. Their cores accelerate crops and machines,
   pull ore veins to the tree, and sort items between containers, within 16 blocks. That repeats three Potato War nodes
   (Growth Acceleration, Automated Mining, the logistics nodes) outside the tree, and the alchemy recipes are datapack data the
   Blood Pool never sees. Fix: lock the magic saplings in those nodes, and override one data file.
2. **The Aether's Incubator is the one machine worth a node** (Farms, Tier 5): only incubated moas take a saddle. Its Altar,
   Freezer and Blue Skies' two furnaces are conveniences. Deeper and Darker has no machines.
3. **Saddled Phygs (flying pigs) and Flying Cows can jump in mid-air** and spawn wild in every Aether biome: flight from Tier 0
   on a fresh world (inferred; on the live server the Tier 2 EvilCraft broom already flies).
4. **A Skyroot weapon doubles every mob's drops** on a full-strength melee kill, in any dimension, bosses included except the
   Wither and the Ender Dragon: Ice and Fire dragon eggs and scales (Tier 6), the Ur-Ghast's carminite and the Lich's scepters
   (Tier 7). Two tags stop it.
5. **The tree's gear lock reads the main hand and the four armour slots only**: no Curios (the Aether's gloves), and nothing
   reads Blue Skies' arcs. The Aether's and Deeper and Darker's tiered gear fits the smithy nodes; warden gear needs a new
   Tier 7 node.
6. **Potatoes grow on Aether and Blue Skies farmland** (their hoes till their dirt), around the clock in the Aether (eternal
   day until the Sun Spirit falls) and the Everbright (fixed noon). The Otherside needs carried-in dirt and torches. **Nothing
   from the three mods counts for the tithe, the press or a node.**
7. **Loot Integrations carries none of these mods' chest loot anywhere**: it only mixes vanilla tables into Moog's Soaring
   Structures. Only the Aether's gloves can ride along. Nothing the Pool still seals leaks. The switch, if ever needed, is the
   item tag `lootintegrations:ignored`.
8. **Events**: the Purge's vault leaves worn Curios on, no vault takes Blue Skies' arcs, the Astrolabe teleports up to 300
   blocks, falling out of the Aether lands players anywhere in the Overworld, the Sculk Transmitter opens a chest from any
   distance, and tamed Sculk Snappers drop up to 8 random enchanted books each and breed.

## 1. Machines and crafting stations

| Station | Does | Recipes (notable) | Fuel | Hoppers and pipes |
|---|---|---|---|---|
| **Altar** `aether:altar` (Aether) | furnace-style enchanting and repairing | 10 `aether:enchanting`: enchanted gravitite (already Tier 4), healing stone from holystone, enchanted berry, golden aercloud, quicksoil glass, enchanted darts and dart shooter, remedy bucket, 2 discs; 97 `aether:repairing`: every vanilla tool, armour piece and glove from wood to netherite, bow, crossbow, shield, fishing rod, flint and steel, and the Aether's skyroot, holystone, zanite and gravitite gear (netherite sword 2,000 ticks) | ambrosium shard 250 ticks, ambrosium block 2,500 | yes, furnace faces: up → input, sides → fuel, down → output |
| **Freezer** `aether:freezer` | furnace-style freezing | 9 `aether:freezing`: lava bucket → obsidian, water bucket → ice, ice → packed → blue ice, cold → blue aercloud, skyroot leaves → crystal leaves, iron or golden ring and pendant → ice ring and pendant, a disc | icestone 400, slab 200, stairs and wall 400 | yes, as the Altar |
| **Incubator** `aether:incubator` | hatches moas | 3 `aether:incubation`: blue, white, black moa egg → a baby moa tagged `PlayerGrown` (1,000 ticks) | ambrosium torch 500 | yes, on the four sides (up and down get the west side's handler) |
| Icestone (Aether block) | freezes water → ice, lava → obsidian within about 2.8 blocks | `aether:icestone_freezable` 2 | none | none |
| Sun Altar (Aether) | sets the Aether's time; the Sun Spirit drops it | none | none | none |
| **Alchemy Table** `blue_skies:alchemy_table` | stonecutter-style conversions: input plus catalyst, the player picks the result | 70 data files (52 "transmute" groups, 18 catalyst recipes); see below | none: each result uses one input and one catalyst | none (no block entity) |
| **Horizonite Forge** | a faster furnace: vanilla smelting recipes at 1/1.5 of their time | vanilla smelting | horizonite and sunstone items (7 data files) | yes: up → input, sides → fuel, down → output and fuel |
| **Snowcap Oven** | a furnace fuelled by hot things | vanilla smelting; 37 fuel entries: blaze rod 2,400, lava bucket 20,000 (→ obsidian), horizonite gear → iron gear, torches, magma | the hot items | yes, furnace faces |
| Food Prep Table | mixes 3+ foods into one multi-use Prepared Food (§3) | none | none | none |
| Toolbox | swaps Blue Skies tool handles (8 types), applies falsite | data | none | none |
| Summoning Table | re-tunes the Summoner's Summoning Tome with soul fragments | none | none | none |
| Trough | baby animals within 7 blocks eat from it (wheat, carrots, pine fruit, scalefruit) | none | none | yes (a container block) |
| Star Emitter, Warding Pearl | §5 | | | |
| Deeper and Darker | **no stations**: its only block entities are crystallized amber (a fossilised item or Sculk Leech) and signs | | | |

Where each line comes from:
- **Altar and Freezer** (read: `AltarBlockEntity`, `FreezerBlockEntity` extend `AbstractAetherFurnaceBlockEntity`, which
  extends vanilla `AbstractFurnaceBlockEntity`; its `getSlotsForFace` and static slot arrays; fuels in
  `AetherBlocks.registerFuels`; recipes in `data/aether/recipes/`). That Forge's furnace item handler is inherited is
  inferred (no override). Repairs cost only ambrosium, no experience (read: `repairTime` only in the recipe).
- **Ice rings and pendants** freeze water and lava they touch (read: `aether:accessory_freezable` lava → obsidian, water →
  ice); that it's under the wearer's feet is inferred.
- **Incubator** (read: `IncubatorBlockEntity` is a `WorldlyContainer` with `SidedInvWrapper` handlers for north, south, east,
  west, and returns the fourth for any other side). Only a player-grown moa can be saddled (read: `Moa.isSaddleable` →
  `isPlayerGrown`), so the Incubator is the only road to a rideable moa. Black moas get 8 mid-air jumps, white 4, blue 3
  (read: `AetherMoaTypes`). Wild moas lay eggs of their own kind on a timer (read: `Moa`, `MoaType.getEgg`); blue and white
  eggs are also silver-dungeon loot.
- **Icestone** (read: `IcestoneBlockEntity.serverTick` → `freezeBlocks`; the radius is inferred from `FreezingBlock.SQRT_8`).
- **Sun Altar** (read: `aether-server.toml`: anyone may use one, "Only whitelisted users access Sun Altars" = false, and only
  in `aether:the_aether`).
- **Treasure chests**: a hopper can't take from a locked dungeon chest (read: `TreasureChestBlockEntity.canTakeItem` returns
  false while locked; its Forge wrapper `$2` wasn't read).
- **Horizonite Forge** (read: `HorizoniteForgeBlockEntity`, `getRecipeCookTime` divides by 1.5, `SidedInvWrapper`). **Snowcap
  Oven** (read: `SnowcapOvenBlockEntity` extends `AbstractFurnaceBlockEntity`; `snowcap_oven_freezing_recipes/`). That a
  fuel turns into its output is inferred from its `freezeFuel` method. Both use the recipe manager, so the Pool's removals
  apply to them (inferred).

### Blue Skies' Alchemy Table, the one with a hole in it

- **Where it comes from:** no recipe. It's a chance in the Alchemist boss's loot bags: a pool with a 60% chance, rolled 0–2
  times, picks among the table, star flares, a disc and a book (read: `loot_tables/loot_bags/alchemist/common.json`; the
  uncommon and rare bags list it too). It drops itself when broken.
- **How it works** (read: `AlchemyTableMenu`, `AlchemyTableMenu$2`): an input slot and a catalyst slot. The player picks the
  result from a list, and each result uses one input and one catalyst.
- **`alchemy_recipes/sapling.json`:** catalyst `minecraft:echo_shard`, inputs `#minecraft:saplings`, results
  `#minecraft:saplings` (read). `CatylistRecipe.getResults` merges every tag member into the list the player picks from
  (read). In this pack the tag holds (read: `research/index` tag members):
  - Twilight Forest's `time_sapling`, `mining_sapling`, `sorting_sapling` and `transformation_sapling`;
  - Tinkers' `ender_slime_sapling` (whose leaves drop ender slime balls; read: loot);
  - Alex's Caves' saplings (a Tier 6 namespace).
- **The magic saplings are finite today:** they come only from TF's tree-cache chests (read: `twilightforest:chests/tree_cache`).
  Their cores drop a plain log and their leaves drop sticks (read: block loot). The table makes them renewable at one echo
  shard each. Echo shards come from ancient cities, Deeper and Darker's temples and Moog's Soaring Structures (read: loot).
- **What the cores do** (read: TF's `TimeLogCoreBlock`, `MineLogCoreBlock`, `SortLogCoreBlock`; ranges from the test server's
  `twilightforest-common.toml`: all four enabled, 16 blocks):
  - **Timewood core:** gives random blocks within 16 extra random ticks **and extra block-entity ticks**, so crops and machines
    both run faster. That's the Growth Acceleration node (Tier 1) and more.
  - **Minewood core:** runs TF's Ore Magnet (`OreMagnetItem.doMagnet`) on random spots within 16, pulling ore veins to the tree.
    That's automated mining (the Automated Mining node is Tier 7).
  - **Sortingwood core:** moves items between item handlers within 16 blocks: logistics (Logistical Transport is Tier 4).
  - Transformation core: changes the biome around it. Harmless.
- **The other notable recipes** (read):
  - stone + nether wart → netherrack;
  - stone + chorus fruit → end stone;
  - sand + soul fragment → soul sand, dirt + soul fragment → soul soil;
  - iron + soul fragment → falsite, iron + blaze rod → horizonite, iron ↔ ventium;
  - redstone ↔ glowstone dust, coal ↔ charcoal;
  - netherite ingot + potion → gold ingot (Blue Skies' own joke file, `gold_lol.json`);
  - colour and wood swaps.
- **The Blood Pool can't see any of this:** `AlchemyRecipeManager` is a `SimpleJsonResourceReloadListener` (read:
  `SkiesDataManager`), not the recipe manager. So KubeJS's recipe event, the crafting locks and `/bloodpool audit` never meet
  these recipes (inferred from the class). The same holds for the Snowcap Oven's fuel table and the forge's fuels. A datapack
  file at the same path replaces a mod's (inferred: standard reload-listener behaviour).
- **The gear read-through** (`BLUE_SKIES_GEAR.md`) proposes the table at Tier 3 with a place lock, for glowstone and soul
  sand before the Nether. The live server is past Tier 3, so that wouldn't stop the sapling route now.

### Which stations deserve a node

| Candidate | Chapter, tier | Lock | Verdict |
|---|---|---|---|
| **Aether Incubator** | Farms, rank 5, Tier 5 (next to Mob Spawning, Tier 5: both make creatures) | `places: ['aether:incubator']` (place and use) | **optional, the one clean candidate.** It gates moa riding (only incubated moas take a saddle). Cost makeable without the node, for example 16 ambrosium torches. On the live server the EvilCraft broom (Tier 2 use lock) already flies, so this is flavour more than balance |
| **TF magic saplings** (via the Alchemy Table or tree caches) | `twilightforest:time_sapling` → Growth Acceleration (n 32, T1); `sorting_sapling` → Logistical Transport (n 14, T4); `mining_sapling` → Automated Mining (n 18, T7) | `places` (a placed sapling is what the lock sees; the core grows from it) | **recommended**: closes both the tree-cache route and the alchemy route. Trees already grown keep working |
| Alchemy Table | none | a use lock would also stop its harmless swaps | fix the data instead (ideas, item 1) |
| Altar | (Smithy, about Tier 3) | use | not needed: its one sealed output, enchanted gravitite, is already Tier 4. Repairs are a convenience |
| Freezer, Horizonite Forge, Snowcap Oven, Food Prep Table, Trough | none | none | no: ordinary conveniences ("regular machines aren't locked", POTATO_TREE.md) |

## 2. Gear the tree could lock per player

### How the two kinds of lock reach gear today (read)

**`potato_tree.js`** (`gearLock`, the lock handlers, `checkArmor`):
- A node's `gear` list is checked by item id, and Tinkers tools by their `tic_materials`.
- Hits and block breaking check **only the main hand**. Right-click checks the item used.
- The armour check takes **slots 36–39** every 40 ticks.
- There's **no Curios pass and no offhand pass**.

**`blood_pool.js`** (`takeOffSealed`): its wear locks also empty **Curios** slots, every 20 ticks
(`CuriosApi.getCuriosInventory(p)` → `getEquippedCurios()`).

**Where the new mods keep worn gear:**
- The Aether's gloves, rings, pendants, capes, shield and other accessories are Curios items (read:
  `data/curios/tags/items/aether_*.json` → `#aether:accessories_*`).
- Blue Skies' arcs are **not** Curios. They live in Blue Skies' own player capability (read:
  `ISkiesPlayer.getArcInventory()`), so neither script sees them.

**Gloves switch the Aether's set abilities on** (read: `aether-server.toml`, "Require gloves for set abilities" = true). So a
Curios lock on the gloves alone would switch off the gravitite, Valkyrie, Phoenix and Neptune set abilities and leave the
armour's defence (inferred).

### Where the already-tiered gear fits

| Gear (Pool tier) | Join | Note |
|---|---|---|
| gravitite helmet, chestplate, leggings, boots, sword, pickaxe, axe, shovel, hoe (4); resonarium sword, pickaxe, axe, shovel, hoe (4) | **Osmium & Steeleaf** (n 3, rank 4, Tier 4) | diamond-class with powers, like steeleaf |
| gravitite gloves (4) | the same node, **only once `checkArmor` gets the Curios pass** `takeOffSealed` already has | otherwise the lock never sees them |
| zanite sword (5) | **Cobalt Smithing** (n 5, Tier 5) | 11–13 damage when worn down |
| netherite gloves (5) | leave to the Pool's `WEAR_LOCKS` | the tree doesn't lock vanilla netherite |
| resonarium helmet, chestplate, leggings, boots (6) | **Alloy Smithing** (n 6, Tier 6) | |
| warden helmet, chestplate, leggings, boots, sword, pickaxe, axe, shovel, hoe (7) | **a new Tier 7 node** (below) | |
| sonorous staff (9) | **Dragonsteel** (n 8, Tier 9) | the tree's right-click lock stops its beam (read: `ItemEvents.rightClicked` cancels with a locked item) |
| soul elytra (no lock) | none | needs an elytra from the End (Tier 9) |

**A Tier 7 smithy node,** for example "Warden Forging":
- chapter smithy, rank 7, tier 7, needs Alloy Smithing;
- 175,000, the price of the other Tier 7 nodes (Enchanted Potatoes after the reveal), plus 4
  `deeperdarker:reinforced_echo_shard` (Tier 7, makeable at Tier 7 without the node);
- `gear`: the nine warden ids;
- a never-used `n`: 9, 10, 19, 20 and 36 and up aren't in `NODES` today. Check the history before taking one.

Folding warden gear into Masterwork (Tier 8) instead would hold it a tier past its Pool tier.

**Loot-only Aether gear the Pool can't hold** (it isn't in `TIERS`, and the wear and wield locks need a tier). The tree could
hold it per player, as it does Twilight Forest gear (stats in `research/AETHER_DEEPERDARKER.md`; owner's call):
- the Valkyrie set, tools and lance (lift and reach; flight-like, so the Tier 7 node);
- Phoenix armour and bow, obsidian armour (fire immunity; netherite-class, so Tier 5 or 6);
- the dungeon swords (flaming, lightning, holy, vampire, Pig Slayer: 7 damage plus effects, like fiery at Tier 6);
- the Hammer of Kingbdogz and the cloud staff;
- the invisibility cloak, regeneration stone and shield of repulsion. These are Curios, so they need the Curios pass.

**For the Blue Skies gear read-through** (read):
- its 95 tool recipes are its own types (`blue_skies:<material>_<tool>`), not in `CONVERT_RECIPE_TYPES`, so once open they'd
  skip the rank check;
- its arcs need the capability above;
- its villagers sell tools (`SkiesVillagerTrades$ToolWithFalsiteTrade`, a pyrope shovel), and its chests hold aquite and
  pyrope gear (read: loot).

## 3. Food, crops and potatoes

### Potatoes in each dimension

Crops need light 9 to grow, and light 8 or open sky to stay planted (vanilla `CropBlock`; inferred, not read here).

| Dimension | Ground a hoe tills | Takes potatoes? | Light | Verdict |
|---|---|---|---|---|
| **The Aether** | Aether grass, enchanted grass, Aether dirt and dirt path → Aether farmland (read: `AbilityHooks$ToolHooks`, `HOE_TILL`) | yes: `AetherFarmBlock.canSustainPlant` accepts any CROP or PLAINS plant (read) | sky; **eternal day until the Sun Spirit is beaten** ("Disables eternal day" = false; read: config comment). Vanilla torches and lanterns can't be placed there (read: `aether:block_placement_ban`) | grows without pause (inferred) |
| **The Everbright** | turquoise and lunar grass and dirt, comet grass → turquoise and lunar farmland (read: `ToolCompat.HOE_TILLING`) | yes: `SkyFarmlandBlock` accepts any CROP (read) | fixed noon (read: `fixed_time` 6000) | grows without pause |
| **The Everdawn** | the same | yes | fixed dawn (read: 23200). That gives sky light about 10 clear and about 8 in rain (inferred from vanilla's sky-darkening formula) | grows, stalls in rain (inferred) |
| **The Otherside** | none: Deeper and Darker has no tilling code (read: no `HOE_TILL`). Its blooming moss is in `#minecraft:dirt`, but vanilla tilling takes only vanilla blocks (inferred) | on carried-in dirt only | no skylight, fixed midnight (read: dimension type) | grows on carried dirt under torches (inferred) |

All of the Aether's and Blue Skies' dirt and grass are in `#minecraft:dirt` (read: tags).

### Potatoes and the tithe

- **Nothing of theirs is a potato:**
  - no potato item, crop, crate or potato tag in any of the three (read: no "potato" in their data or class names);
  - none of their items is in `POTATO_WORTH` or the press and oven input tags (read: `blood_pool.js`,
    `tools/kubejs/data/kubejs/tags/items/`).
  - So nothing of theirs can count for the tithe, the war chest or a node.
- **The only potato** is a baked potato in Blue Skies' plains Gatekeeper house chest (read: loot). It isn't accepted anywhere.
- **The Food Prep Table takes any edible item,** so raw potatoes can disappear into a Prepared Food. Enchanted Potatoes are
  safe: `potato_press.js` gives them no food properties, and the table needs `isEdible` (read: `FoodPrepUtils.isValidIngredient`).
- **The Trough takes no potatoes** (read: tag `blue_skies:trough_foods`).
- **Their crops are ordinary food** (read: `SkiesFoods`, `AetherFoods`):
  - Blue Skies: pine fruit, scalefruit, winter leaves, fiery beans (4 hunger); solnuts (2); cryo roots (3, 5% chance of 2 s
    Slowness); crescent fruit (5); brewberries and comet berries (2).
  - The Aether: blue berries (2) and white apples.
- **Sky farms:** constant day in the Aether and the Everbright lets an unlit potato farm grow around the clock. The Pool side
  is already bounded:
  - the tithe has a server-wide cap of 30,000 Drops a day (120,000 potatoes);
  - potatoes pay only `POTATO_SHARE` of each tier;
  - ranks are held by `RANK_LEAD` (read: `blood_pool.js`).
  So the effect is faster ranks up to that cap, not a faster Pool (inferred).

### Food that matters

| Food | Effect | Source | Matters for |
|---|---|---|---|
| **Healing Stone** (Aether) | always edible, no hunger, **Regeneration I for 30.5 s** (read: `AetherFoods`, 610 ticks) | Altar, from holystone: renewable and hopper-fed | own-gear fights |
| **Ambrosium shard** (Aether) | edible by config ("Ambrosium Shards are edible" = true): **heals 1 HP in 16 ticks** (read: `AmbrosiumShardItem`) | ambrosium ore | own-gear fights: 1.25 HP a second while eating |
| Gummy Swet, blue or golden (Aether) | 20 hunger, 0.9 saturation | dungeon loot only | none |
| Enchanted berry (Aether) | 6 hunger, 0.8 saturation | Altar | none |
| White apple (Aether) | always edible; Remedy (cures the Aether's poison) | crystal fruit leaves | none |
| **Life Shard** (Aether) | **+2 maximum health each, up to 10 (+20)**: a modifier on the player (read: `AetherPlayerCapability`), so kits and vaults keep it | gold dungeon loot | the Shrine's, the Purge's and the arena's balance |
| Pink brewberry (Blue Skies) | always edible, Regeneration III for 2 s (read) | nature dungeon loot | none |
| Black brewberry (Blue Skies) | always edible; cures poison, wither, deadly venom (read: `BlackBrewberryItem`) | nature dungeon loot | none |
| **Prepared Food** (Blue Skies, Food Prep Table) | 3 or more foods, at most 2 potions; hunger = the sum + 2.5 per different food; uses = hunger ÷ 6; effects merged and spread over the uses at 1.1× (1.4× with a brewberry); instant effects other than saturation dropped (read: `FoodPrepUtils`) | the table | stretches golden-apple effects by 10–40% |
| Enchanted golden apples | vanilla | Otherside temples, apex and basement chests (read: loot) | unsealed |

## 4. Loot Integrations

**How it works** (read: `LootModifierManager`, `GlobalLootModifierIntegration`, mixin `LootTableLootIntegrations`):
- A definition file (`data/<ns>/loot/*.json`) names a source table T and target tables X, each with a count n.
- When an X is rolled (it hooks `LootTable.getRandomItems` at return), it rolls T in the same context, so T's global loot
  modifiers run, and adds up to n of T's items to X.
- Modded items are 4× as likely as vanilla ones (`moddedItemWeight` 3, plus 1). Items in the tag `lootintegrations:ignored` are
  skipped. `max_result_itemcount` caps the result.
- **Nothing is discovered by itself:** `EventHandler` only registers that reload listener and a debug click (read).

**In this pack** (read: a scan of all 211 jars; no definition files in the repo's `tools/kubejs/data` or the test server's
datapacks):
- **The only definitions** are Loot Integrations' own 43 files and the Moog add-on's 6. The own files map vanilla tables into
  seven categories.
- **Only one Moog mod is installed.** The Moog add-on feeds the categories into the chests of nine Moog mods, of which only
  Moog's Soaring Structures (`mss`) is in the pack.
- **The live chain:** an `mss` chest → the easy, medium and village categories → vanilla simple dungeon, mineshaft, pillager
  outpost, desert pyramid, mansion, stronghold and village tables.
- **Three categories are dormant:** `hard` (ancient city, End city), `nether` and `water` are fed only to Moog mods that
  aren't installed.
- **Vanilla chests receive nothing.** They appear as targets only in `dungeonloot_no_overflow.json`, with 0 items from an empty
  table.

**What reaches other chests from these three mods:**
- **No chest table of the Aether, Deeper and Darker or Blue Skies** is in any definition.
- Their items get into other chests only through their own global loot modifiers on vanilla rolls (read: `loot_modifiers/`):
  - **The Aether's `gloves_loot`:** any container loot holding armour of a material gets that material's gloves (leather,
    chain, iron, gold, diamond, netherite). Riding the vanilla rolls, iron, chain, gold, diamond and leather gloves can land in
    `mss` chests (inferred: vanilla tables aren't in the index). `mss` chests also hold diamond, iron and leather armour of their
    own (read: `research/index` loot), so they get gloves directly too.
  - **Deeper and Darker:** a 45% warden upgrade template and a 20% warden carapace in `minecraft:chests/ancient_city`; a heart
    of the deep and 1–3 carapaces from Wardens. Ancient cities only feed the dormant `hard` category.
  - **Blue Skies:** no loot modifiers (read).

**Sealed items at risk.** Over every item the three mods' loot tables name (1,023 entries), `BP.tierOf` finds these sealed:
- gravitite armour, tools, gloves and enchanted gravitite (Tier 4);
- the zanite sword (Tier 5);
- the warden upgrade smithing template (Tier 7).

None of them travels through Loot Integrations today. At the live tier only the template is still sealed, and every recipe it
feeds makes a Tier 7 warden item, which is removed until Tier 7, so it's inert. Looted gravitite and zanite are held by the
wear and wield locks anyway.

**The setting that would stop it:**
- `config/lootintegrations.json` has only 5 options and no per-mod switch (read).
- The lever is the **item tag `lootintegrations:ignored`**: a `data/lootintegrations/tags/items/ignored.json` with
  `"replace": false` could ship in `tools/kubejs/data/`.
  - Candidates if it's ever needed: `aether:netherite_gloves` (matters only below Tier 5), the warden template, and any Blue
    Skies gear that gets tiered.
  - And never add a definition file that lists these mods' tables.

**Not Loot Integrations, but worth knowing** (read):
- Deeper and Darker replaces 17 vanilla ancient-city wall pieces to add ancient vases (structure files).
  - Breaking a fake vase (16%) spawns Sculk Leeches, or a Stalker (31.25%) (config, `DeeperDarkerEvents`).
- Blue Skies adds two trades, `BLINDING_DUNGEON_OFFER` and `POPULATION_DUNGEON_OFFER`, to one vanilla profession
  (`SkiesEvents.onVillagerTradesAssigned`; the field is `VillagerProfession.f_35588_`, the cartographer by the trades' names:
  inferred).
- Its own villagers sell the Astrolabe and tools (`SkiesVillagerTrades`).

## 5. Mobs that matter

### Farm targets (read: entity loot tables unless noted)

| Mob | Drops | Why it matters |
|---|---|---|
| Sludge (Otherside) | resonarium | the material of resonarium tools (Tier 4) and armour (Tier 6); unsealed |
| Stalker (from fake vases) | soul crystal | sonorous staff (Tier 9), soul elytra |
| Shattered | sculk bone | the staff |
| **Sculk Snapper, tamed** | **enchanted books**. With its owner within 5 blocks, a chance of 1 in 4,000 a tick (about every 200 s): a random enchantment from every registered one, at a random level, with a 20% chance of a second. Up to 8 per snapper (`snapperDropLimit`), and snappers breed (read: `SculkSnapper.tick`, `getBreedOffspring`, config) | a renewable book farm over every mod's enchantments |
| Golden Swet (Aether) | a glowstone block | glowstone outside the Nether |
| Firefly (Blue Skies) | glowstone dust | the same |
| Frost Spirit, Polargeist (Blue Skies) | soul fragments | alchemy catalyst; Warding Pearls |
| Warden (vanilla) | heart of the deep, 1–3 carapaces | the Otherside's key |
| **any mob killed with a Skyroot weapon** | **every drop twice** | see below |

**Skyroot double drops** (read: `DoubleDropsModifier.doApply`, `EquipmentUtil.isFullStrength`, the
`aether:no_skyroot_double_drops` tags):
- **When:** the direct killer is a living entity holding a `SkyrootWeapon`, at full strength (a player's attack charged; any
  other living entity always counts).
- **What:** every drop gets a second copy, for any mob in any dimension, except players, the Wither and the Ender Dragon.
- **Items never doubled:** dungeon keys, the victory medal, heads and skulls, the nether star, a few Aether items.
- **Not excluded** (read: `research/index` entity loot; tiers from `tierOf`):
  - Ice and Fire dragons: scales, flesh and **dragon eggs**, all Tier 6;
  - the Hydra's fiery blood, the Ur-Ghast's fiery tears and **carminite (Tier 7)**, the Lich's **four scepters (Tier 7)**,
    every boss trophy;
  - Wardens: whether the heart and carapaces are doubled depends on the modifiers' order (not determined).
- **The Skyroot sword is wooden**, crafted at Tier 0.

**Pig Slayer** (gold dungeon loot) (read: `PigDropsModifier`, tag `aether:pigs`):
- extra damage against pigs, Phygs, hoglins, piglins and zombified piglins, and 0–3 extra porkchops;
- any pig an event or the black market uses (the Homing Pig) dies fast to it.

### Mounts

- **Phyg (a flying pig) and Flying Cow:**
  - They spawn wild in all four Aether biomes (read: `worldgen/biome/*.json`).
  - `WingedAnimal.canJump()` returns only "is saddled", and their fall is slowed (read: `WingedAnimal`). So a saddled one can
    keep jumping in mid-air: **flight from Tier 0** (inferred; confirm in game).
  - No mount class checks the dimension (read: no dimension call in `WingedAnimal`, `MountableAnimal`, `MountableMob`).
  - Falling out of the Aether moves ridden and saddled mounts into the Overworld too (read: `EntityMixin.travel`). Whether
    the rider stays on wasn't traced. Portals presumably work too (inferred).
- **Moas:** see the Incubator: 8, 4 or 3 jumps, then a glide.
- **Blue Skies' mounts** (Crogre, Crystal Camel, Reindeer) stay on the ground (read: `SkiesMountEntity` and its subclasses).
- **On the live server** the EvilCraft broom (Tier 2 use lock) and Hexerei's brooms (Tier 6) already fly. So this is a
  fresh-world concern, and a story hook: Techno's pigs can fly.

### What could harm the server's events

- **Spawning: none of the three adds creatures to Overworld biomes.**
  - No Forge biome modifiers in the Aether or Deeper and Darker, and Blue Skies' only one (`purify`) filters its own
    dimensions (read).
  - Their creatures come from their own biome files.
  - Their bosses' block-breaking and teleporting stay in their dungeons (read: a scan of every entity class for block breaking,
    `setBlock`, teleports and explosions):
    - the Aether's Valkyrie Queen, Slider (crush), Sun Spirit (fire) and Sentries (explosions);
    - Blue Skies' Starlit Crusher, its illager bosses (teleporting themselves), and keystones that pull nearby players into a
      boss room.
  - Blue Skies denies mob griefing and explosions inside its own dungeons (read: `SkiesEvents.onMobGrief`,
    `onExplosionStart`).
- **Ways out of an event:**
  - Aether portals (glowstone frame and water; read: "Disables Aether Portal creation" = false) and Blue Skies portals (Zeal
    Lighter, 8 emeralds from the Gatekeeper; read: `blue_skies-common.toml`) can be built anywhere. For Blue Skies, that its
    frames can be crafted is from `research/BLUE_SKIES.md`.
  - The **Astrolabe** teleports its holder to its Star Emitter within 300 blocks in the same dimension. It's refused only during
    a Blue Skies boss fight, and it's sold by Blue Skies villagers (read: `AstrolabeItem`, `SkiesVillagerTrades`).
  - `purge.js`, `gladiator_arena.js` and `shrine.js` check none of these (read: no references).
- **Falling out of the Aether** below its floor, in its biomes, moves into the Overworld: players, anything ridden, saddled
  mounts, projectiles a player shot and items a player dropped (read: `EntityMixin.travel` → `entityFell`; config "Disables
  falling into the Overworld" = false). That they land at the same x and z, so anyone can drop in from above anywhere, onto
  an arena in the sky too, is inferred.
- **Vaults:**
  - The Purge's vault takes only the inventory's slots (read: `purge.js` `vaultRecord`). **Worn Curios stay on in its kit
    fights:** Aether gloves (+0.25 to +1 damage, per `research/AETHER_DEEPERDARKER.md`), the regeneration stone, the shield
    of repulsion, the invisibility cloak.
  - The arena and the Shrine do vault Curios (read).
  - **No vault takes Blue Skies' arcs** (read), such as the Dusk arc (invisibility), the Poison arc (damage and venom) and the
    Ethereal arc (speed).
- **Life Shards** (+20 maximum health, kept through any kit) and edible ambrosium (1 HP every 0.8 s) matter in own-gear fights
  and in how hard the Shrine's night is.
- **Sculk Transmitter** (Otherside temple loot): opens its linked chest from any distance in the same dimension (read: no
  distance check in `SculkTransmitterItem`).
  - In own-gear arena matches that's resupply from home.
  - Opening a far chest presumably loads its chunk (inferred).
- **Snowcap mushrooms** (Blue Skies) put out nearby campfires on random ticks (read: `SnowcapMushroomBlock.randomTick` →
  `snowcap_mushroom_freezing/extinguish_campfire.json`). The Shrine's braziers are campfires (read: `shrine.js`). The radius
  wasn't read.
- **Warding Pearl** (crafted): cancels natural and spawner monster spawns within 25 blocks, in **any** dimension (read:
  `SkiesEvents.onEntityCheckSpawn`).
  - Scripted spawns such as the Shrine's Inspectors aren't natural, so events are safe (inferred).
  - It also stops vanilla spawners and natural mob farms near it.

### Cost to the server

- **Measured** (`research/LATENCY_DEEP_DIVE.md`):
  - in a 70 s profile, the Aether's rideable and winged animals' code took 15% of the thread, Blue Skies' Azulfo 9%;
  - spawn attempts are 34–78% of the new dimensions' time with players there;
  - the Swet banner scan is fixed by `aether_spawn_fix.js`.
- **From the code, not measured** (inferred cost):
  - Blue Skies looks for a trough within 7 blocks on baby animals' ticks, in every dimension;
  - it looks for a Warding Pearl within 25 blocks on every natural monster spawn, in every dimension;
  - Deeper and Darker's Shattered and Stalkers carry vibration listeners, as Wardens do;
  - Aether whirlwinds push entities within 2.5 blocks.

## Ideas for the Potato War

1. **Close the magic-sapling route.**
   - Add `twilightforest:time_sapling` to Growth Acceleration's `places`, `sorting_sapling` to Logistical Transport's and
     `mining_sapling` to Automated Mining's.
   - Ship `tools/kubejs/data/blue_skies/blue_skies/alchemy_recipes/sapling.json` with vanilla saplings as its only `results`.
2. **Put the Aether's and Deeper and Darker's tiered gear into the smithy nodes** (the table in §2), and add a Tier 7 "Warden
   Forging" node. Give `checkArmor` the Curios pass `takeOffSealed` already has: that also lets one glove lock switch off the
   Aether's set abilities.
3. **Moa Hatchery** (Farms, Tier 5, optional): place and use `aether:incubator`.
4. **"Techno's Air Cavalry"**, a story hook: Phygs are flying pigs.
   - A node that unlocks saddling and riding Phygs, Flying Cows and moas, at Tier 7 with the Pool's other flight.
   - It needs a new entity-interaction lock in `potato_tree.js`; KubeJS 6's `ItemEvents.entityInteracted` wasn't checked here.
5. **Stop Skyroot doubling of boss drops.** Add the Ice and Fire dragons, the Twilight bosses and the Warden to the entity tag
   `aether:no_skyroot_double_drops`, and dragon eggs, scales, carminite, scepters, fiery blood and tears to the item tag of the
   same name (`replace: false`, in `tools/kubejs/data/aether/tags/`).
6. **Events:**
   - vault Curios in the Purge;
   - vault Blue Skies' arcs in all three (through `getArcInventory()`);
   - refuse the Astrolabe and the Sculk Transmitter while a match or the Shrine's night runs;
   - consider "Ambrosium Shards are edible" = false for own-gear matches.
7. **Sculk Snappers:** if enchanted books should stay scarce, lower `snapperDropLimit` in `deeperdarker-common.toml`.
8. **Loot Integrations:** nothing to do now. Use `lootintegrations:ignored` if Blue Skies gear is ever tiered.

## What couldn't be determined

- **Mounts:**
  - whether saddled Phygs and Flying Cows fly for as long as you keep jumping (read pieces only; test in game);
  - whether mounts pass through Aether and Blue Skies portals.
- **Skyroot doubling:**
  - the order of global loot modifiers (Skyroot doubling against Deeper and Darker's Warden additions);
  - whether a Create Deployer's fake player counts as "full strength".
- **Locks and overrides:**
  - whether KubeJS 6's entity-interaction event fires for an empty-hand mount;
  - whether the `sapling.json` override takes effect (standard datapack behaviour, not tried).
- **Unread code:**
  - the treasure chest's Forge wrapper (`$2`);
  - how the Snowcap Oven converts its fuel;
  - the radii of icestone (about 2.8, inferred) and snowcap mushrooms (not read);
  - the Astrolabe's cooldown value;
  - what Blue Skies' two cartographer trades are, and whether they search for structures.
- **Reasoned, not seen:**
  - the Everdawn rain stall (from vanilla's formula);
  - which vanilla chest tables hold armour of each material: vanilla tables aren't in the index, so gloves riding into `mss`
    chests is inferred.
- **Live server:** its current tier and configs. The test server's configs were the stand-in, and they may differ (its
  `twilightforest-common.toml` has `disableUncraftingTable = false`; the research notes say the live server has `true`).
