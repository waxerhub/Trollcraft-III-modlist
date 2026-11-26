# The Blood Pool (Part II)

**Blood for the Blood God.** In Part II all progression is locked into 12 tiers.
- **Filling the Pool:** the server fills one shared **Blood Pool** by trolling, by giving Hush Coins, with the **Potato Tithe**, and by killing Twilight Forest bosses (`part2/boss_blood.js`, see [BOSS_BLOOD.md](BOSS_BLOOD.md)).
- **Opening a tier:** when the Pool reaches a tier, five players vote to break the Ministry's seal (`/bloodpool vote`), or an op breaks it, and that tier opens for everyone.
- **Dimensions:** the Nether opens with Tier 3 and the End with Tier 9.
- **The Potato War:** each player also has a **Potato Standing** (a rank), raised only by potatoes they offer to Techno's war chest. A tier's **crafting-table** recipes need the tier open **and** the crafter's rank at that tier. Machines work for everyone. Some black market items also need a rank (see "The Potato War").
- **Potatoes pay only part of each tier** (owner decision, 15 November 2026): all of Tiers 1–3, 75% of 4–6, 50% of 7–9 and 25% of 10–12. The rest has to be blood: trolls, coins and bosses (see "Filling the Pool").
- **The price revealed** (same day): when Tier 5 opens, the Blood God reveals that the Potato War was never about potatoes. From then on the war's numbers for Tiers 6–8 count **Enchanted Potatoes** and for Tiers 9–12 **Enchanted Baked Potatoes**: the same numbers, a far bigger price. The Potato Press and Potato Oven make them (see "The price revealed").
- **Full Measure** (same day): when Tier 12 opens, every tier's crafting and every upgrade-tree node open for everyone.

See [STORY.md](../../STORY.md). The tier contents come from the progression research, [research/TIER_PROPOSAL.md](../../research/TIER_PROPOSAL.md), which has the reasoning per tier and every bypass that was checked.

**Part II only.** It doesn't belong on the Part I server.

## Files

| File | Where it goes | What it does |
|---|---|---|
| `server_scripts/part2/blood_pool.js` | `kubejs/server_scripts/part2/` | The Pool, the tiers, the locks, the Potato Tithe and the Potato War. Settings and the tier lists are at the top |
| `server_scripts/part2/dimension_gates.js` | `kubejs/server_scripts/part2/` | The Nether and End gates (see "Dimensions") |
| `server_scripts/part2/blood_tank.js` | `kubejs/server_scripts/part2/` | The tank: a tower that fills with blood as tiers open (see "The tank") |
| `startup_scripts/nether_portal_whitelist.js` | `kubejs/startup_scripts/` | Stops Nether portals lighting while the Nether is sealed. **Restart** after adding it. For Part II, empty its `ALLOWED_PORTALS` list (its two entries are Part I's event portals) |
| `server_scripts/economy/trolls.js` | `kubejs/server_scripts/economy/` | Every logged troll fills the Pool |
| `server_scripts/economy/black_market.js` | (as Part I) | Hush Coins for donations. Its `STANDING_LOCKS` sell some items only to high enough ranks (no effect without the Blood Pool) |
| `startup_scripts/potato_press.js` | `kubejs/startup_scripts/` on the server **and in the modpack** | Enchanted Potatoes, Enchanted Baked Potatoes, the Potato Press and the Potato Oven (see [POTATO_PRESS.md](POTATO_PRESS.md)). **Restart** after adding it. The server also needs `mixin.perf.faster_capabilities=false` in `config/modernfix-mixins.properties` for hoppers and pipes to reach the machines |
| `data/alexsmobs/loot_tables/gameplay/transmutation_table_common.json`, `_uncommon.json`, `_rare.json` | `kubejs/data/alexsmobs/loot_tables/gameplay/` | Replace Alex's Mobs' three Transmutation Table lists (see "Routes closed by config"). A `/reload` picks them up |
| `tools/serverconfig/alexsmobs.toml` | `config/alexsmobs.toml` | `limitTransmutingToLootTables = true`, so a Transmutation Table only offers its lists. **Restart** after changing it |

Copy them, restart once (for the startup scripts), then `/reload` after any later change. The script creates `kubejs/blood_pool_tier.json` by itself (see "Why there's a file").

## Filling the Pool
- **Every troll in the Troll Log** adds its points as Drops: Anonymous Summons 50, Disguised TNT 250, approved reports as set by the admin, and so on. Repeats and revenge are already applied by the Troll Log.
- **Hush Coins:** `/bloodpool donate <coins>` gives coins from your inventory at **1,000 Drops each**.
- **The Potato Tithe:** `/bloodpool tithe` gives every potato you carry, or `/bloodpool tithe <n>` gives that many of the tithe's unit.
  - **Rate:** **4,000 potatoes = 1,000 Drops** (4 potatoes a Drop, whole Drops only). After the price is revealed (Tier 5), the tithe toward Tiers 6–8 takes **4 Enchanted Potatoes** a Drop (640 potatoes' worth), and toward Tiers 9–12 **4 Enchanted Baked Potatoes** a Drop (102,400). `<n>` counts in that unit.
  - **What counts:** raw potatoes, potato crates from Quark, Farmer's Delight and Thermal at 9 each, Enchanted Potatoes at 160 and Enchanted Baked Potatoes at 25,600. Smaller kinds are taken first. Breaking one to make up an amount gives the change back as Enchanted Potatoes and potatoes. Baked and poisonous potatoes and potato dishes don't count.
  - **Only the next tier** (owner decision, 15 November 2026): the tithe fills the tier after the open one, never past its threshold ("That fills Tier 5."). Once that tier is full, the tithe is refused until its seal breaks ("Tier 5 (A Spring) is full. Its seal must break before the Pool takes more potatoes.").
  - **Potatoes' share of a tier** (`POTATO_SHARE`, same decision): potatoes may pay at most this share of a tier's Drops (its threshold minus the last one's). Blood fills the rest: trolls, Hush Coins and bosses add Drops freely, past the share.

    | Tiers | Potatoes may pay | Example |
    |---|---|---|
    | 1–3 | all of it | |
    | 4–6 | 75% | Tier 5 is 120,000 Drops; potatoes may pay 90,000 |
    | 7–9 | 50% | Tier 8 is 300,000; potatoes may pay 150,000 |
    | 10–12 | 25% | Tier 12 is 2,000,000; potatoes may pay 500,000 |

    A tithe that would go past the share takes only what fits ("That is all potatoes may pay toward Tier 5; the rest must be blood."), and after that it's refused. `/bloodpool` shows how much potatoes may still pay toward the next tier, and `/bloodpool tiers` each tier's share. Counted per tier from when this went in (`potatoByTier`): potatoes tithed earlier aren't counted against it.
  - **Daily quota:** **30,000 Drops a day, server-wide** (about 120,000 potatoes). A tithe that would go over takes only what fits and says the quota is full; after that the command refuses until the quota reopens.
  - **Reset:** the quota reopens at **4 am Central** (`America/Chicago`, daylight saving included).
  - **Why the cap:** without it, a bank of Thermal Insolators could reach Tier 12 in about a month. With it the arc is about **11½ weeks if the server farms, about 25 if it doesn't** (the research's §7, rescaled for Tier 12 at 4,400,000). Those figures are from before the potato share and the reveal, which slow the late tiers further.
- **Tithed potatoes never raise anyone's rank** in the Potato War, and offered potatoes never fill the Pool. The two are separate on purpose.
- **Ops** can `/bloodpool add <drops>` or `/bloodpool set <drops>`.
- **Credit:** every Drop is credited to whoever gave it (`/bloodpool top`), for Part II titles.
- **Part I:** troll points don't count. The Pool starts at 0.

## Tiers

| Tier | Name | Drops (total) | Theme | Opens (main) |
|---|---|---|---|---|
| 0 | (start) | | | Vanilla, Twilight Forest, the Aether and Deeper and Darker's Otherside (each minus its later gear), Tinkers up to the smeltery, and every mod not listed |
| 1 | A Trickle | 20,000 | First Sparks | Create, Mystical Agriculture |
| 2 | A Puddle | 60,000 | The Green Art | Botania, Ars Nouveau, EvilCraft, Hexerei's cauldron; Extra Utilities' spikes and compressed cobblestone, ahead of the rest of the mod at Tier 7 (owner decision, 10 November 2026) |
| 3 | A Basin | 120,000 | Iron and Oil | Immersive Engineering, steel, Create brass; **the Nether** |
| 4 | A Font | 200,000 | The First Circuit | Mekanism (2×), Create mechanical crafting, TF steeleaf, the Aether's gravitite, resonarium tools |
| 5 | A Spring | 320,000 | The Nether Forge | Thermal, Ender IO, the Tinkers foundry and cobalt, netherite, Mekanism 3×, the Infusion Altar, TF knightmetal, the zanite sword; Tinkers' nahuatl, TF's giant sword and pickaxe and arctic armour, Ars Nouveau's enchanter's sword (gear check, 26 November 2026); **the price revealed**, and the Potato Press |
| 6 | A Stream | 480,000 | Terrasteel and Storage | AE2 and addons, Extreme Reactors, Reliquary, Alex's Caves, Ice and Fire, Terrasteel and the terra blade, Mekanism 4×, TF fiery and yeti |
| 7 | A River | 700,000 | Power and Rails | RFTools, Modular Powersuits, Redstone Arsenal, Blue Power, Extra Utilities, Create trains, Mekanism 5×, TF carminite, Deeper and Darker's warden gear and resonarium armour, Ice and Fire's sea serpent armour |
| 8 | A Flood | 1,000,000 | The Deep Forge | TAIGA, TC Integrations, Create Big Cannons, Mekanism Tools and Weaponry, Advanced AE, the Tinkers end-game alloys, Tinker's Rapier, Ice and Fire's dread knight and ghost swords and dragonbone arrows, the Potato Oven |
| 9 | A Tide | 1,400,000 | Wither and Star | Draconic Evolution, Gaia, the End tier of Ender IO, dragonsteel, the sonorous staff, Kikoku and the Etheric Sword, TAIGA's alloys that need End ores; **the End** |
| 10 | A Sea | 1,900,000 | Fission and Wyvern | RFTools Dimensions, fission, the MekaSuit, Draconic Wyvern, AE2 quantum and spatial |
| 11 | An Ocean | 2,400,000 | Awakened | Mekanism SPS and antimatter, Draconic Awakened and Chaotic, Advanced AE quantum, Awakened Supremium, the Ender Quarry, the nuke |
| 12 | Full Measure | 4,400,000 | | No recipes of its own: the last seal, which begins the final act (STORY.md, Act V). Renamed from "The Siege" and raised from 3,000,000 (owner decisions, 13 November 2026). The Blood God's power is full: every tier's crafting and every upgrade-tree node open for everyone (`OPEN_ALL_TIER`, owner decision, 15 November 2026) |

**The gear check's moves** (owner decision, 26 November 2026; the numbers are in [research/GEAR_BALANCE.md](../../research/GEAR_BALANCE.md)):

| Item | Tier |
|---|---|
| Deeper and Darker's resonarium armour | 6 → 7 |
| Ice and Fire's sea serpent armour | 6 → 7 |
| Extra Utilities' Kikoku and Etheric Sword | 7 → 9 |
| Ice and Fire's dread knight sword, dread queen's sword, ghost sword and dragonbone arrows | 6 → 8 |
| Tinker's Rapier (the mod) | 4 → 8 |
| TAIGA's alloys that need an End ore or a Tier 9 alloy (03 fractum, 04 violium, 05 proxii, 08 imperomite, 09 solarium, 10 adamant, 11 nihilite, 13 astrium) | 8 → 9 |
| Tinkers' nahuatl (the best handle in the pack) | 0 → 5 |
| Ars Nouveau's enchanter's sword (netherite's numbers) | 2 → 5 |
| Botania's terra blade (Thundercaller and Starcaller follow it) | 9 → 6 |
| Twilight's giant sword and pickaxe, and arctic armour | 8 and 7 → 5 |

- **Draconic's damage modules** give a quarter of their defaults: draconium 0.5, wyvern 1, draconic 2, chaotic 4 a module, instead of 2, 4, 8 and 16. They stack without a limit. A sword filled with them reached about 69 (wyvern), 236 (draconic) and 770 (chaotic); now about 24 (dragonsteel's level), 68 and 206, energy permitting. This is a config file, not a script: `tools/serverconfig/ModuleStats.cfg` goes to the server's `config/brandon3055/ModuleStats.cfg` (a restart is needed). Players' tooltips may show the defaults unless the modpack gets the same file.
- **Mekanism Tools' paxels** stay at Tier 8 as they are (accepted).
- **The item tooltips** (`client_scripts/potato_tooltips.js`, generated) show the new tiers, and a "Use: Blood Pool Tier n" line where a lock waits longer than the recipe. They go in the modpack.

**Unlocking a tier:** the players break the seal by vote (owner decision, 10 November 2026).
1. **When the Pool reaches a tier,** everyone sees "[BLOOD GOD] The Blood Pool overflows. Tier 3 (A Basin) waits for the Ministry's seal to break." (it goes to Discord too). Nothing opens yet.
   - Everyone online is told how to vote: "Tier 3 (A Basin) is ready. 0 of 5 votes break the Ministry's seal. Vote with /bloodpool vote."
   - Ops are told they can also open it at once with `/bloodpool unlock`.
2. **Players vote with `/bloodpool vote`.** One vote per player per tier (`VOTES_TO_BREAK`, 5 different players).
   - Each vote is told to everyone online ("Ana voted to break the seal on Tier 3 (A Basin): 2 of 5"), not to Discord.
   - **`/bloodpool unvote`** takes a vote back while the seal still holds, and everyone online is told the new count. The player can vote again later. Once the seal breaks, the votes are spent.
   - Votes are saved, so they add up across sessions and restarts.
   - While a tier is ready, every player who logs on is told, five seconds after joining, with the count and whether they've voted.
   - `/bloodpool` shows the count too.
3. **The fifth vote breaks the seal,** with a public line naming the five ("5 voices broke the Ministry's seal: Ana, Bo, …"). An op's `/bloodpool unlock` does the same at once. Either way the next tier opens:
   - a title for everyone ("THE BLOOD POOL / Tier 3: A Basin"), a Wither roar and a public line;
   - its dimension, if it has one, opens at once, with a Ministry line;
   - a second later the server runs **`/reload`**, so the tier's recipes come back (in JEI too). That can freeze the server for a few seconds.
4. **One tier at a time.** The votes start again for the next tier. If the Pool already fills it too, everyone is told a new vote is open.

**Netherite opens at Tier 5** (owner decision):
- **Sealed until then:** scrap, ingots, blocks and vanilla gear, other mods' netherite items, and every other route found: Tinkers' casting, melting and alloy, its Netherite upgrade, Mekanism's and Immersive Engineering's processing, Bygone Nether's withered blocks, and the two recipes that make ancient debris (Botania's Orechid Ignem and Immersive Engineering's Excavator vein).
- **Not sealed:** it's crafting only, like every lock. Debris can still be mined, and looted netherite keeps working, so a player with a looted ingot can use it in recipes that aren't sealed. The smithing template isn't locked.
- **Ranks:** crafting-table recipes, such as scrap into ingots, need Potato Soldier at Tiers 5 and 6, and catch-up opens them to everyone at Tier 7. Furnaces and the smithing table have no rank check.
- **Crops:** Mystical Agriculture's and AgriCraft's netherite stay at Tier 8.
- **The Foundry's diamond route is off at every tier:** melting diamond ore in a Foundry normally also gives molten debris, which casts into scrap. The script rebuilds those recipes without that byproduct (`STRIP_BYPRODUCTS`), so the ore still melts into the same molten diamond.
- **What waits for it:** a few items with no tier of their own need netherite, so before Tier 5 they can only be made with looted netherite: Hexerei's Warhammer, Alex's Mobs' Straddleboard, Quark's Flamerang, Toolbelt's last pouch upgrade, the blue heart canister, the pigstep disc from essence, and Tinkers' Ender Staff and its Unbreakable, Worldbound, Flamewake and item frame modifiers.

## What each tier opens: `TIERS` in `blood_pool.js`

```js
{ tier: 4, name: 'A Font', drops: 200000, unlocks: {
    mods: ['mekanism', 'mekanismgenerators', 'tinker_rapier'],
    items: ['create:precision_mechanism', 'twilightforest:steeleaf_chestplate', ...],
    tags: [],
    recipes: [TINKERS_MATERIALS(['osmium', 'steeleaf']), MA_SEEDS(['osmium', 'steeleaf']), ...] } },
```

- **`mods`:** item namespaces. Every item of that mod can't be crafted, and every recipe in its namespace is removed.
- **`items`:** single items.
  - **Listed in a later tier than its mod** (the usual case): it stays sealed after its mod opens. This is how big mods open at their first tier while their end-game items wait.
  - **Listed in an earlier tier than its mod:** it opens early.
- **`tags`:** item tags without the `#`. Only `forge:ingots/steel` is used, as insurance.
- **`recipes`:** recipe ids, exact (`'agricraft:diamond'`) or a regex (`/^mekanism:nucleosynthesizing\//`). They cover what an item can't express:
  - **Tinkers materials,** which are stored on generic tools: `TINKERS_MATERIALS([...])` seals each material's part-builder, casting, composite and melting recipes.
  - **The Tinkers smeltery and foundry:** a locked metal can't be melted or cast until its tier opens.
    - **Melting:** `TINKERS_MELTING([...])` seals melting the metal's ore, raw metal, ingots, nuggets, blocks and the gear made from it. With no melting recipe, the smeltery won't melt it.
    - **Casting:** `TINKERS_CASTING([...])` seals casting molten metal into ingots, nuggets and blocks. These recipes name their result as a tag (`forge:ingots/cobalt`), which an item lock might not catch.

    | Tier | Metals that can't be melted or cast until then |
    |---|---|
    | 3 | steel |
    | 4 | osmium, steeleaf, refined glowstone |
    | 5 | cobalt, knightmetal, enderium, lumium, signalum |
    | 6 | electrum, invar, constantan, silver, lead, pewter, aluminum, fiery, uranium |
    | 7 | refined obsidian |
    | 8 | Manyullyn, Hepatizon, Queen's Slime, Cinderslime (and every TAIGA metal, through its namespace) |
    | 9 | dragonsteel (TC Integrations) |

    **Always meltable:** iron, gold, copper, netherite and the day-0 Tinkers metals (bronze, amethyst bronze, rose gold, pig iron, slimesteel), as well as ironwood, tin, zinc, nickel and other base metals that aren't locked. Every rule matches real recipe ids in TConstruct 3.11.2.166.
  - **Mystical Agriculture's cross-mod essences and seeds:** `MA_ESSENCE(dir, [...])` and `MA_SEEDS([...])`. Seeds cover both the infusion and the crafting-table versions.
  - **Recipes whose output is a vanilla item that has to stay open,** such as AgriCraft's diamond, emerald and netherite crops.
- **Anything not listed** in any tier is always open (vanilla, decoration, food, worldgen and every mod left out; the research's §4 lists them).
- **Never locked as a namespace:**
  - **Twilight Forest:** its wood, doors and stonecutting would vanish for players inside it.
  - **Tinkers:** the smeltery and every cross-mod melt depend on it.

  Their gear and materials are tiered by item and recipe id. **Ironwood** (Twilight Forest's first metal, about iron tier) is open from day 0.
- **The Aether and Deeper and Darker** (added 22 November 2026) follow Twilight Forest: both dimensions are open, and their gear is tiered by item against what's already tiered, stat for stat ([research/AETHER_DEEPERDARKER.md](../../research/AETHER_DEEPERDARKER.md)). Owner decisions, 22 November 2026:

  | Tier | Items | Comparable |
  |---|---|---|
  | 0 | skyroot, holystone and zanite gear (except the sword), rings, pendants, the Altar, Freezer and Incubator; everything else in Deeper and Darker | iron, ironwood |
  | 4 | the Aether's gravitite armour, gloves, tools and enchanted gravitite; resonarium tools | diamond with modest powers, like steeleaf |
  | 5 | the zanite sword (6 damage new, up to 13 as it wears); the Aether's netherite gloves | beyond netherite's 8 |
  | 6 | resonarium armour (a full set cancels every armour-bypassing hit) | dragon scale, terrasteel |
  | 7 | warden armour and tools, the reinforced echo shard, the warden upgrade template | between fiery (6) and refined obsidian (8) |
  | 9 | the sonorous staff (up to 50 armour-ignoring damage along an 18-block beam) | dragonsteel |

  Some of this gear is also loot (the zanite sword and gravitite gear in Aether dungeons), so it has wear and wield locks too (see "The locks").
- **Checked against the jars:**
  - every Twilight Forest and Ice and Fire item id has a recipe in its jar;
  - every recipe rule for Tinkers, Mystical Agriculture, TC Integrations, TAIGA and Ice and Fire matches real recipe ids in the server's versions;
  - the AgriCraft and Mekanism ids come from the research.

## The locks: crafting only
A sealed mod, item, tag or recipe **can't be crafted** until its tier opens. Its recipes are removed in every recipe type: the crafting table, furnaces, every machine, the smeltery and so on. They also disappear from JEI.

**Everything else works.** Sealed items that players find, loot, trade for or get from mobs can be used, placed, worn and fought with normally (owner decision). A found item is a treat, not a way round the tier. The exceptions are below: what Part I players brought, and the Aether's and Deeper and Darker's sealed gear.

**The exception: what Part I players brought (`USE_LOCKS`, `PLACE_LOCKS`, `SPAWN_LOCKS`).** Players kept their whole Part I inventory, and everything was craftable in Part I, so a sealed item made then would work from day one. These items can't be used or placed until their tier opens, however a player got one. Each item's tier is its own in `TIERS`, so it works again the moment that tier opens. The player is told why on the action bar ("The Raygun is sealed until the Blood Pool opens Tier 6 (A Stream).").

- **History:** owner requests, 9 November 2026. First the Raygun, after one carried over from Part I still fired. Then the right-click items and Tier 11 blocks from the carry-over list. A Part I player file from 20 October had a Nuclear Bomb, among other things.
- **Use locks (`USE_LOCKS`):** 63 items that work by being used (39 from 9 November, 24 more on 25 November with the rest of the sealed gear, below). Each has a mode:
  - `use`: right-clicking with it is refused, in the air or on a block or mob that doesn't take the click.
  - `block`: that, and right-clicking a block with it, for tools that act on the block they're used on. A gun is only `use`, so holding one doesn't stop a player opening a chest.
  - `mob`: that, and right-clicking a mob with it.

  | Kind | Items (tier) |
  |---|---|
  | Guns and bows | IE Railgun, Revolver, Chemthrower (3); Mekanism Electric Bow, Flamethrower (4); Raygun, Dreadbow, AE2 Matter Cannon, Reliquary Handgun (6); Flux Bow, Flux Trident (7); Mekanism Weaponry Railgun, Tesla Minigun (8); Draconic wyvern, draconic and chaotic bows (9) |
  | Staffs, maces, grenades | EvilCraft Necromancer Staff, Mace of Distortion, Lightning Grenade (2); Reliquary Pyromancer Staff, Glacial Staff, Ice Magus Rod, Destruction Catalyst (`block`), Galena Gauntlet (6); Mace of Destruction (11) |
  | Travel and flight | EvilCraft broom, Rod of the Skies (2); Portable Teleporter (4); Staff of Travelling (5); Ender Staff, Rending Gale (6); Dislocator (9); Dimensional Carver (11) |
  | Used on blocks or mobs | Rods of the Lands, the Highlands and the Shifting Crust (`block`), Rod of Terra Firma (2); Entropy Manipulator (`block`), Totem of Possession (`mob`) (6) |
- **Place locks (`PLACE_LOCKS`):** the **Nuclear Bomb**, the **Tremorzilla Egg** and the **Ender Quarry** (all Tier 11) can't be placed by a player, a fake player (a Deployer) or anything else.
- **Spawn locks (`SPAWN_LOCKS`):** a dispenser fires a Nuclear Bomb as a primed bomb, with no block placed. That's Alex's Caves' own dispenser behaviour (`ACItemRegistry$7`, read with `javap`), so the place lock can't catch it. So a `alexscaves:nuclear_bomb` entity is stopped from spawning until Tier 11, and the log says so. The dispenser still uses up the bomb. It also stops `/summon` of a primed bomb.
- **How a refused use stops an item:** the click is refused before the item's own use starts, so nothing happens on the server. The raygun only fires while it's being used, and its damage is dealt only on the server (`RaygunItem.onUseTick` in Alex's Caves 2.0.2, read with `javap`). The other items weren't read one by one; see "What couldn't be verified".
- **Who:** ops in survival are refused too, so an op can test it. Creative players are exempt.
- **Covered since 25 November 2026:** Part I's weapons that hit, tools that mine (the Draconic staffs, the Meka-Tool, the Atomic Disassembler), armour and Curios (the Flight Tiara, Draconic chestpieces). The owner decided to lock all sealed gear with a real power, which the wear, wield and carry locks below now do. `LOCK_TIERS` closes the two gaps in `TIERS`:
  - the MekaSuit helmet, pants and boots (Mekanism's Tier 4) are held until Tier 10, with the body armour;
  - Draconic's wyvern gear is held until 10 and its draconic and chaotic gear until 11, though the mod is Tier 9.
- **Adding an item:** put its id in `USE_LOCKS` with its mode, a block in `PLACE_LOCKS`, or gear in `WEAR_LOCKS` or `WIELD_LOCKS`. The script warns at load if an id is in no tier (it would never be locked) or a mode is misspelt.

**Wear, wield and carry locks (`WEAR_LOCKS`, `WIELD_LOCKS`, `CARRY_LOCKS`, `PROJECTILE_LOCKS`):**
- **History:**
  - **22 November 2026 (owner decision):** the Aether's dungeons hand out the zanite sword and gravitite gear, which crafting locks can't touch, and Deeper and Darker's gear could be traded or brought. So both mods' sealed gear can't be worn or fought with until its tier opens.
  - **25 November 2026 (owner decision):** "lock all sealed gear". Every sealed item with a real power is held now, however it was got (a Part I inventory, loot, a drop, a trade). The gear check behind the lists is [research/GEAR_BALANCE.md](../../research/GEAR_BALANCE.md).
- **Who:** the player is told why on the action bar, ops in survival are held too, and creative players are exempt.
- **Kit items** handed out by the Gladiator Arena, the Purge or the Shrine's night (marked `GladiatorKit`, `PurgeKit` or `ShrineKit`, `KIT_MARKS`) are never held. The arena's Troll Smasher and Terra Knight kits carry sealed gear.
- **Which tier:** each lock opens at the item's own tier in `TIERS`, or at a later one in `LOCK_TIERS`.
  - **Why `LOCK_TIERS`:** a mod sealed by namespace gives all its gear the namespace's tier, though some of it needs later materials. 74 items wait longer: dragonsteel until 9 (Ice and Fire is 6), terrasteel until 6 and Botania's Gaia gear until 9 (Botania is 2), the MekaSuit until 10 (Mekanism is 4), Draconic's wyvern gear until 10 and draconic and chaotic until 11 (the mod is 9), the Atomic Disassembler until 7.
  - **Crafting and ranks don't change:** those items' recipes are held by their materials already.
- **Wear (`WEAR_LOCKS`, 159 pieces):**
  - **The first 14:** gravitite armour and gloves (Tier 4), the Aether's netherite gloves (5), resonarium armour (7; 6 until 26 November) and warden armour (7).
  - **The rest:**
    - **Tier 6:** dragon scale, troll leather, fiery and yeti armour, terrasteel, the cloak and hood of darkness, rainbounce boots and the Ring of Far Reach.
    - **Tier 7:** sea serpent armour, Redstone Arsenal's flux armour and elytra, and Powersuits.
    - **Tier 8:** refined obsidian armour and the tarantula hawk elytra.
    - **Tier 9:** dragonsteel armour, the flight tiara, Botania's cloaks, pendants, belt and Ring of Odin.
    - **Tiers 10 and 11:** the MekaSuit and Draconic chestpieces.
  - **When they're checked:** every second (`WEAR_CHECK_TICKS`), each player's armour slots and Curios slots are checked, and a piece put on from the inventory screen or by a dispenser comes off at once (`PlayerEvents.inventoryChanged`). A sealed piece is taken off into the inventory, or dropped at the player's feet if it's full, and the log says whose and what.
  - **Right-clicking one to put it on is refused** (armour, and Curios' right-click equip).
  - **Warden armour in main slot 3** (the 4th hotbar slot) clears Blindness and Darkness worn or not (`SLOT_3_LOCKS`). So a sealed piece there is moved out, and pieces taken off are never put back there.
- **Wield (`WIELD_LOCKS`, 127 items):**
  - **The first 17:** gravitite and resonarium tools (Tier 4), the zanite sword (5), warden tools (7) and the sonorous staff (9).
  - **The rest:**
    - **Tier 5:** Ars Nouveau's enchanter's sword, and Twilight's giant sword and pickaxe.
    - **Tier 6:** Ice and Fire's troll weapons, elemental dragonbone swords, tide trident and others; Twilight's fiery sword and pickaxe; the Terra Blade, Thundercaller, Starcaller, Terra Shatterer and Terra Truncator; Alex's Caves' weapons; Reliquary's swords.
    - **Tier 7:** the Healing Axe, Redstone Arsenal's flux tools, the power fist and the Atomic Disassembler.
    - **Tier 8:** Ice and Fire's dread knight and ghost swords, Tinker's Rapier and estoc, Create's sabers, the gauntlet, refined obsidian gear and Mekanism Tools' paxels.
    - **Tier 9:** dragonsteel tools, Kikoku, the Etheric Sword and the extinction spear.
    - **Tiers 10 and 11:** the Meka-Tool and Draconic's tools, swords and staffs.
  - **With one in either hand, a hit does nothing** (the damage is cancelled). Either hand, because Better Combat (in the pack) lets two one-handed weapons take turns: its off-hand swing uses the off-hand weapon, while scripts still see the main-hand item.
  - **With one in the main hand, no block can be broken.**
  - **Right-clicking with it is refused,** in the air or on a block, in either hand (the use locks' `block` mode): a gravitite tool can't float a block, the staff can't fire, a spear can't be thrown and a saber or shield can't block.
- **Carry (`CARRY_LOCKS`, 10 items):** items that work from the inventory or a Curios slot without being worn or held. A sealed one found on a player (main inventory, off hand, Curios) goes into their ender chest, or is dropped at their feet if that's full, checked with the wear lock:
  - **Tier 6:** Reliquary's phoenix down, angelheart vial, angelic feather, infernal claws, kraken shell, twilight cloak and witherless rose;
  - **Tier 7:** Extra Utilities' advanced chicken wing ring and Twilight's charm of keeping III;
  - **Tier 9:** the salamander eye.
- **Projectiles (`PROJECTILE_LOCKS`):** a sealed arrow fired by a player hits for nothing: Ice and Fire's dragonbone arrow (30 a shot from any bow, Tier 8) and hydra arrow (Tier 6).
- **Left alone on purpose:**
  - **weak sealed gear** (no better than netherite and no ability): lapis and bronze tools, Ice and Fire's silver, copper, myrmex and deathworm gear, Botania's elementium, Twilight's arctic armour (Tier 5 since 26 November);
  - **gear already open on the live server;**
  - **the Aether's dungeon loot:** the Valkyrie, Neptune and Phoenix gear, the dungeon swords, life shards and the sculk transmitter are boss rewards, like Twilight Forest's, and have no tier.

**Routes the cohesion audit found and sealed** ([PROGRESSION_AUDIT.md](../../PROGRESSION_AUDIT.md)). Their results are tags or secondary outputs, neither of which an item lock can see, so they're locked by recipe id:
- **Tier 1:** Create Aquatic Ambitions' three prismarine and nautilus crushing recipes, whose **secondary** outputs are Create experience and copper nuggets. Found in game by `/bloodpool audit` at Tier 0, not by the offline audit: that mod is one of the "not on hand" mods it can't read.
- **Tier 4:** Tinkers' refined glowstone casting.
- **Tier 5:** Immersive Engineering's cobalt (crusher, arc furnace, press, hammer); Thermal's enderium, lumium and signalum alloyed and cast in the Tinkers smeltery; the **knightly** Tinkers material (knightmetal shards).
- **Tier 6:** fiery ingots and blocks cast in the smeltery.
- **Tier 7:** refined obsidian alloyed and cast in the smeltery.
- **Tier 8:** IE's arc furnace and alloy kiln making manyullyn, hepatizon and queen's slime.
- **Tiers 6–11, `COMPAT(n)`:** 134 **cross-mod compat recipes** — one mod's machine making another mod's sealed item. Ender IO's SAG mill and alloy smelter ship smelting recipes for TAIGA, Alex's Caves, AE2, Ice and Fire, Blue Power, Extra Utilities, Extreme Reactors, Create Big Cannons and Draconic; Thermal's machines do the same for TConstruct, Redstone Arsenal and Mekanism; Botania's elven trade makes Elementium, Pixie Dust, Dragonstone and Dreamwood. All 134 report `kubejsSeesIt: false`.

  These only appear once their **host** mod opens — at Tier 0 the `enderio` and `thermal` namespace locks hide them, so the Tier 0 audit saw none and the Tier 5 audit saw all 134. The worst was TAIGA: its ores are worldgen, so an Ender IO alloy smelter at Tier 5 gave Tier 8 ingots, three tiers early.

  They are sealed by **exact recipe id**, keyed by the tier of the item each one leaks (`COMPAT_LEAKS` in `blood_pool.js`). Exact ids rather than a per-mod regex because two prefixes span tiers — `enderio:smelting/bigreactors` is Tier 6 for graphite and cyanite but Tier 10 for blutonium and magentite, and `enderio:smelting/draconicevolution` is Tier 9 for draconium but Tier 11 for awakened draconium — and because a per-mod regex would also seal that mod's recipes for items that were never locked. After the fix the recipe count fell by exactly 134 (27,787 → 27,653), which is the check that nothing else was caught.

  **To refresh the list after a mod update:** run `/bloodpool audit` at Tier 5, read `sealedItemsStillMade` from `kubejs/progression_audit.json`, and key each id by its `tier`.

  **What the audit still lists:** 8 recipes across Tiers 1 to 9, none of them sealed yet. The 4 `bigreactors:reprocessor/*_to_*` recipes at Tiers 6 to 9 make Tier 10 ingots, but every Reprocessor part needs the Tier 10 casing, so nobody can build one until then. The 4 `create:crushing/` recipes `tuff`, `tuff_recycling`, `ochrum` and `ochrum_recycling` at Tiers 1 to 4 can give `thermal:electrum_nugget` (Tier 5) as a secondary output. Sealing those would also remove their other outputs until Tier 5, so that's left for the owner to decide.

**Routes closed by config and data, not by the scripts** (configs are in `tools/serverconfig/`, each changed line marked `#TROLLCRAFT`; data files are in `tools/kubejs/data/`):
- **Twilight Forest's Uncrafting Table** is switched off (`disableUncraftingTable = true` in `twilightforest-common.toml`).
- **Alex's Mobs' Transmutation Table** (owner decisions, 20 November 2026). Its recipe is open from the start, and a transmutation isn't a recipe, so no lock reached it.
  - **How it works:** a player puts in a stack and is offered three choices, one from each of the table's loot lists (common, uncommon, rare). A pick costs 3 XP levels and turns the whole stack into that item. The player gets the same share of a full stack, so 64 cobblestone gives 64, 16 ender pearls give 64, and one tool that doesn't stack gives a full 64. The choices reroll after every use, so a player can reroll for 3 levels by transmuting a single dirt.
  - **It only offers its lists** (`limitTransmutingToLootTables = true` in `alexsmobs.toml`). Before, it remembered anything a player fed it 2 or more of at once and offered it back, up to 1 roll in 5. A player's report of "unlimited nether stars" came down to this: feeding stars back 3 at a time to keep them on offer still netted about 49 stars a loop. It worked on Pool-sealed items too.
  - **Its lists are replaced** (`data/alexsmobs/loot_tables/gameplay/transmutation_table_*.json`):
    - **What came out:** the Nether and End items (blaze rods, ghast tears, gilded blackstone, netherrack, quartz, glowstone dust, ender pearls, shulker shells, end rods) and diamonds. Diamonds came up about 1 roll in 124, and blaze rods 1 in 10, 64 at a time.
    - **The rare list's odds:** its removed weight went to the ordinary items on it (raw copper, amethyst, lapis, prismarine), so emeralds (1 in 62), Mimicream and nautilus shells (1 in 124) are exactly as rare as before.
    - **What it still gives:** junk into raw iron, copper and gold, coal, flint, redstone, lapis, amethyst and prismarine. Emeralds are the most valuable thing left.
  - **The code:** read in `TileEntityTransmutationTable`, `TransmutationData` and `MenuTransmutationTable` (Alex's Mobs 1.22.9) with `javap`. The table reads its lists by name from the server's loot data, so the `kubejs/data` files replace them. Not tried in game.
  - **Tables already built:** each one saves the three choices it's showing, so one already offering a learned item, a diamond or a Nether item keeps that offer until its next transmutation.

**Things the research flagged and left open on purpose:**
- **Cobalt in the Overworld** (found 2026-11-20): Tinkers' own cobalt is Nether-only, but ADLODS (Large Ore Deposits, `config/adlods/Deposits/cobalt.cfg`, its default) places cobalt deposits in the Overworld: 700–1,400 ore each, about one every 3,094 chunks, between heights 16 and 64. The ore can be mined early, but every way of working it is sealed until Tier 5. The owner keeps them as the supply for the Axe of Peace (1,000 blocks of cobalt, about four veins; STORY.md #37). ADLODS' ancient debris deposits stay in the Nether.
- **Botania's Orechid Ignem** (netherrack to ancient debris, from Tier 2) and **IE's Excavator** (ancient debris veins) are ore routes. Both need a mature setup first. The research's §3c has the one recipe id to add if netherite should stay a Nether trip.
- **The Timewood Core** (Twilight Forest) speeds up any mod's machines within 8 blocks. It's a natural block, so no crafting lock can stop it; only its config can.
- **Ender Storage, Walkers and ReMorphed** can't be gated by recipes.
- **Origins of Darkness** (EvilCraft's guide book, Tier 2) has no recipe: a Spirit Portal turns a thrown Book into it, and the portal comes from a mob fed a Darkened Apple. So no recipe lock reaches it. Its only use is opening the manual, and it's in no recipe, so it's left usable (owner decision, 10 November 2026). The Darkened Apple's own recipe is sealed until Tier 2, so new copies need an apple brought from Part I.

### Why there's a file
At server start, recipes load **before** the world and its saved data, so the recipe step can't see the open tier. The tier is therefore also written to **`kubejs/blood_pool_tier.json`**, and the recipe step reads that.
- **The saved data is the authority.** If the two ever disagree, the file is fixed and ops are told to `/reload`.
- **If the file is missing or broken,** every tier's recipes stay removed (nothing opens by accident).
- **Don't edit the file by hand.** Use `/bloodpool settier`.

## The Potato War: each player's Potato Standing
**The upgrade tree** ([POTATO_TREE.md](POTATO_TREE.md)) builds on these ranks. It's an FTB Quests book of nodes bought with potatoes and items, locking Tinkers metals, smelteries, autocrafters, logistics and farms per player.

Techno's Potato War runs alongside the Pool. **The Pool decides what the server can make; your rank decides what you can make.**

- **Offering:** `/potatowar offer` gives every potato you carry to Techno's war chest, or `/potatowar offer <n>` gives that many of the unit your next rank counts in (potatoes, or after the reveal Enchanted or Enchanted Baked Potatoes).
  - Every kind counts at its worth, as with the tithe: crates 9, Enchanted Potatoes 160, Enchanted Baked Potatoes 25,600. Change comes back as Enchanted Potatoes and potatoes.
  - **Offered potatoes only count toward your rank.** They never fill the Pool, and there's no daily cap.
  - **Your Standing is the lifetime worth you've offered, in potatoes.** It never goes down (an op can change it). After the reveal, `/potatowar` calls it "potatoes' worth" and shows the next rank in its unit: "Potato Sergeant at 400,000 Enchanted Potatoes (393,750 Enchanted Potatoes to go)".
  - **Ranks wait for the Blood Pool** (`RANK_LEAD`, owner decision, 9 November 2026). A rank can be at most one above the Pool's open tier, so rank n needs Tier n−1. Potato Farmer needs none; at Tier 0 it's the highest rank there is.
    - **Potatoes offered past the cap still count.** `/potatowar` says "Potato Lieutenant waits for the Blood Pool to open Tier 6 (your potatoes already cover it)".
    - **When `/bloodpool unlock` opens the tier,** everyone it was holding back gets the rank their potatoes earned, with the usual title and public rank-up line. The quiet `/bloodpool settier` gives the rank silently.
    - **Everything that reads rank follows the capped one:** crafting at a table, the rank stages, the upgrade tree's rank tasks, the black market, `/potatowar top`.
    - **Ranks held before the cap are kept** (owner decision, same day: some players were already Potato Privates at Tier 1).
      - The first time the cap loads, it records every player already above it, from their saved potatoes, in `rankFloor`. The log names them: "Kept from before: …".
      - They keep that rank, and `/potatowar` shows "(kept from before ranks waited for the Blood Pool)". Their next rank waits for its tier like anyone's.
      - It's a one-time snapshot (`rankFloorSince`): later progress is always capped. An op who lowers someone's potatoes lowers a kept rank too.
- **Ranks** (`STANDING` and `RANKS` in `blood_pool.js`). Rank n crafts Tier n:

  | Rank | Name | Lifetime (the number) | Counts, after the reveal | In potatoes, after the reveal | Crafts |
  |---|---|---|---|---|---|
  | 0 | Unenlisted | 0 | | | Nothing in any tier |
  | 1 | Potato Farmer | 250 | potatoes | 250 | Tier 1 (Create, Mystical Agriculture) |
  | 2 | Potato Peeler | 1,000 | potatoes | 1,000 | Tier 2 |
  | 3 | Potato Recruit | 2,500 | potatoes | 2,500 | Tier 3 (IE, so the Garden Cloche) |
  | 4 | Potato Private | 25,000 | potatoes | 25,000 | Tier 4 |
  | 5 | Potato Soldier | 50,000 | potatoes | 50,000 | Tier 5 (Thermal, so the Insolator) |
  | 6 | Potato Sergeant | 400,000 | Enchanted Potatoes | 64,000,000 | Tier 6 |
  | 7 | Potato Lieutenant | 700,000 | Enchanted Potatoes | 112,000,000 | Tier 7 |
  | 8 | Potato Captain | 1,200,000 | Enchanted Potatoes | 192,000,000 | Tier 8 |
  | 9 | Potato General | 2,000,000 | Enchanted Baked Potatoes | 51.2 billion | Tier 9 |
  | 10 | Potato Warlord | 3,000,000 | Enchanted Baked Potatoes | 76.8 billion | Tier 10 |
  | 11 | Potato Emperor | 4,400,000 | Enchanted Baked Potatoes | 112.6 billion | Tier 11 (Tier 12 has no recipes) |

  Ranks 9–11 are out of reach by design: those tiers come by catch-up, and at Full Measure (Tier 12) to everyone.

  Owner decisions, 9 November 2026: ranks 1–3 are the first ladder's (250 to 2,500), cheap so a hand-farm reaches the Garden Cloche. Ranks 4 and 5 are 25,000 and 50,000 (they were 5,000 and 10,000). Ranks 6 and up are 20x the first ladder (they were 20,000 to 220,000), so Potato Sergeant is a big step up from Potato Soldier. Raising the ladder can lower a player's rank: their rank stages follow at `/reload` (players online) or their next login. Tree nodes they bought stay, and catch-up still opens crafting up to Tier T−2.

  **A rank, once earned, is never lost** (owner decision):
  - Each player's record has a `peak`: the highest rank their potatoes have bought. A rank never drops below it, so a Purge's Potato Heist (`takeStanding`) can take potatoes but not the rank.
  - A record from before the peak existed starts at the rank its potatoes buy now, so nobody's rank changed when it was added. Ranks bought under the launch numbers aren't brought back.
  - **Only an op can lower a rank,** with `/potatowar set <player> <potatoes>`, which sets it to what that total buys. `/potatowar add`, offers and tree hand-ins never lower it.
- **Ranking up:** a title and a sound for the player, and a public line: "Ana has risen to Potato Soldier in Techno's Potato War" (sent to Discord with `TO_DISCORD`; `RANKUP_PUBLIC = false` keeps it quiet).

### Relics break the seals
Owner decisions 2026-11-20 (STORY.md #37: "I need something tied to progression, something that ties in with the plot"). From **Tier 5**, a seal also needs one more of the Regalia's relics restored at the Shrine (`RELIC_SEALS`): Tier 5 needs 1, Tier 6 needs 2, and so on to 7 at Tier 11; Tier 12 needs 7 too. The Crown isn't counted: it's for the final act. Any relics count, in any order.
- **Who counts them:** `part2/shrine.js` (`global.Regalia.restoredForSeals()`). Without it on the server, no seal waits on relics.
- **While a ready seal is short:**
  - the ready line is followed by "[BLOOD GOD] The seal on Tier 6 holds. Bring me 1 more of my Regalia.";
  - the vote notice (and the one at login) says the seal holds until N more are restored (/regalia);
  - `/bloodpool vote` and `/bloodpool unlock` are refused, saying how many are in;
  - `/bloodpool` says the same.
- **When a relic is restored** (`global.BloodPool.relicsChanged`, from the Shrine): if the ready seal no longer waits, "[BLOOD GOD] The seal on Tier 6 (A Stream) can break now.", and the vote notice goes out; if it still waits, how many more.
- **What still opens a tier anyway:** `/bloodpool unlock force`, `/bloodpool settier`, and the Shrine's own `openTo` (the Awakening's Tiers 3–4).
- **API:** `global.BloodPool.relicsNeeded(n)` (the relics tier n's seal needs) and `relicsChanged(server)`.

### The price revealed (Tier 5)
Owner decisions, 15 November 2026. A big potato farm (tens of thousands an hour) made ranks and the upgrade tree's potato costs meaningless. The fix is a story beat: the numbers stay, and what they count changes.
- **When Tier 5 opens** (`REVEAL_TIER`), the Blood God speaks, after the reload the tier opening starts (`PENDING_DELAY_TICKS`, 6 seconds, so the tier's own title has played):
  - a title for everyone: "IT WAS NEVER POTATOES / The price is revealed", with the Elder Guardian's curse sound;
  - three [BLOOD GOD] lines (`REVEAL_LINES`). They **name the Ministry**: the Blood God's power is all that holds it back, and every seal broken wakes more of it;
  - a [POTATO WAR] line on the Potato Press.

  It plays once (`pending` in the saved data). The quiet `/bloodpool settier` reveals the price without the lines.
- **From then on, the same numbers count in `UNITS`:** the ranks, upgrade-tree nodes and tithe of Tiers 6–8 in Enchanted Potatoes (160 potatoes each), of Tiers 9–12 in Enchanted Baked Potatoes (160 Enchanted Potatoes, 25,600 potatoes, each). `/potatowar ranks` shows "6. Potato Sergeant: 400,000 Enchanted Potatoes". Before the reveal everything counts in potatoes. Nothing priced in a unit can be bought before it anyway: ranks wait for the Pool, and nodes need their tier.
- **Ranks are priced again at the reveal** (`repriceRanks`): a player's kept rank (the peak) can't stay above Potato Soldier unless what they've offered still buys it, or it was kept from before the cap. A farm that offered a million potatoes before Tier 5 had "earned" Potato Lieutenant at the old prices; it now has Potato Soldier, and Potato Sergeant needs 400,000 Enchanted Potatoes. The log names everyone whose peak came down ("Peaks lowered: Ana 7->5").
- **Everyone gets the stage `potato_war_revealed`** (at the reveal, at login, after `/reload`). The quest book's Tier 6+ nodes wait for it (see POTATO_TREE.md).
- **The Potato Press** opens at Tier 5 and the **Potato Oven** at Tier 8 (`MACHINE_RECIPES`, in `TIERS`). Their recipes need **no Potato War rank**: a rank priced in Enchanted Potatoes can't wait for the machine that makes them. When Tier 8 opens, a [POTATO WAR] line announces the Oven. While sealed, a machine's recipe isn't added at all (KubeJS's `event.remove` doesn't reach a recipe added in the same event, seen on the test server). The blocks themselves are in `startup_scripts/potato_press.js` ([POTATO_PRESS.md](POTATO_PRESS.md)); without it they get no recipes.

  | Machine | Recipe |
  |---|---|
  | Potato Press | 3 potato crates (any of the three) over piston, barrel, piston, over 3 iron ingots |
  | Potato Oven | 7 Enchanted Potatoes around a blast furnace, with a Potato Press in the bottom middle |

### What a rank gates
- **Crafting-table recipes:** every `minecraft:crafting_shaped` and `crafting_shapeless` recipe in an open tier **above catch-up** gets a **result check** for its tier (KubeJS's `modifyResult`). When a player crafts it, the check asks for the KubeJS stage `potato_standing_<tier>`. Players hold the stage for every rank they've reached.
  - **At or below catch-up** (Tiers 1 to T−2 at Pool Tier T), recipes have no check. Everyone can craft them, so they stay as the mod wrote them and any machine can make them.
  - **KubeJS only runs that check on its own recipe types,** so the script switches each of these recipes to `kubejs:shaped` or `kubejs:shapeless` where it stands. Without the switch the game ignores the check. Nothing is removed or added, and the recipe's JSON stays as the mod wrote it.
  - **Checked by comparing every crafting recipe before and after, at Tier 11, with every open tier's recipes switched:** 17,120 recipes, 6,416 switched, and none lost, added or changed in group, category, notification, size, result or ingredients. Custom ingredients (`forge:nbt`, IE fluids and others) carry over.
  - **`/bloodpool gatecheck` confirms it from the recipes the game holds.** Run it after a KubeJS update: the switch relies on KubeJS 2001.6.5's public `type` field.
  - **A recipe's tier** is the highest lock that applies to it, by the same rules as the removal: its result (by item, then tag, then the result's mod), the recipe's own mod (unless its result is listed by id), and the recipe-id rules. So Mekanism's crafting recipe for a Create part needs rank 4.
  - **Without the rank,** the crafting grid shows no result. That covers the crafting table, the inventory grid, and a mod's crafting grid the player has open (AE2's crafting terminal, for one), found through the player's open window. The Tinkers Crafting Station and Create's Blueprint name the player to Forge instead. At the Station the slot can still show the result, because the client works it out alone, but it can't be taken (seen in game).
  - **Untouched:** machines, furnaces, the smeltery, Create's mechanical crafting and every other recipe type work for everyone. So do sealed tiers: their recipes are still removed for everybody.
  - **Mods' own crafting-table formats** (owner decision): about 620 Mystical Agriculture recipes (`cucumber:shaped_no_mirror`, `cucumber:shaped_tag`) and Mekanism's machine recipes (`mekanism:mek_data`) use formats the check can't see. The recipe step rebuilds those above catch-up as KubeJS shaped recipes:
    - same id, pattern, ingredients and result, with no mirroring;
    - they get the rank check;
    - nothing about what they need or make changes (`CONVERT_RECIPE_TYPES`).
    - **Left as they are:**
      - Mekanism's tier upgrades: an input that is a lower tier of the same item, a factory, or anything another `mek_data` recipe makes (jetpacks, drives, machines), so upgrading keeps contents and installed upgrades;
      - Mystical Agriculture's durability-keeping tool upgrades;
      - recipes with an ingredient only the mod understands;
      - recipes whose **result item is not registered**: Mystical Agriculture ships three essence recipes for Chisel marble, basalt and limestone behind a `forge:mod_loaded` check for `chisel`, which passes, but Chisel 2.0.0 for 1.20.1 no longer has those stone types, so `chisel:marble/raw` and friends do not exist. They can make nothing, so they are skipped. (Before this was handled, handing `event.shaped` an empty result logged three KubeJS errors on every reload and left the console permanently reporting "KubeJS errors found [3]", which would have hidden any real error. Found in game at Tier 1.)
      - They all need an item that's already rank-locked, or can make nothing at all.
    - **Tag results** (`shaped_tag`, e.g. titanium ingots) give the tag's first item.
    - A Mekanism base machine made from an energy tablet or tank starts empty instead of keeping that item's charge.
    - The log says how many were rebuilt ("Mod crafting recipes: N rebuilt with the rank check").
  - **Autocrafters only make what every player can already craft** (owner decision). KubeJS tells a recipe's check nothing about the block that's crafting, so a script can't tell whose machine it is. A recipe with a check gives a machine nothing, so the newest two tiers (T−1 and T) are crafted by hand, even by top ranks, until catch-up reaches them. With `CATCH_UP_GAP = 0`, no machine makes a recipe that needs a rank.
    - **What this costs:** AE2 opens at Tier 6, but its assemblers can't make Tier 6 crafting-table recipes until Tier 8.
    - **Create's Mixer, Press and Mechanical Crafter** skip recipes with a check through Create's own list, `create:automation_ignore`. The Mixer and Press would otherwise read the result without running the check.
    - **Banned: Bibliocraft's Fancy Crafters and the Ars Nouveau Wixie** (`BANNED_CRAFTERS`). They read a recipe's result themselves, so no check reaches them. Their recipes are removed, and placing or using them is refused, including the Wixie Charm, which turns a plain cauldron into a Wixie Cauldron. Ops and creative players are exempt. As far as I remember, the Wixie's potion brewing goes with it (not checked).
    - **Placing an autocrafter needs the rank of its own tier, or a fixed rank** (owner decision), set in `AUTOCRAFTERS`:

      | Autocrafter | Id | Rank to place |
      |---|---|---|
      | Create Mechanical Crafter | `create:mechanical_crafter` | 4 Potato Private |
      | Quark Crafter | `quark:crafter` | 4 Potato Private (fixed) |
      | Botania Crafty Crate | `botania:crafty_crate` | 4 Potato Private (fixed) |
      | Mekanism Formulaic Assemblicator | `mekanism:formulaic_assemblicator` | 4 Potato Private |
      | Ender IO Crafter | `enderio:crafter` | 5 Potato Soldier |
      | AE2 Molecular Assembler | `ae2:molecular_assembler` | 6 Potato Sergeant |
      | RFTools Crafter (tiers 1–3) | `rftoolsutility:crafter1/2/3` | 7 Potato Lieutenant |
      | Blue Power Auto Project Table | `bluepower:auto_project_table` | 7 Potato Lieutenant |
      | Advanced AE Quantum Crafter | `advanced_ae:quantum_crafter` | 8 Potato Captain |

      A player below the rank is told "Only a Potato Sergeant or higher knows how to set up a Molecular Assembler" and the block isn't placed. Ops and creative players are exempt. Blocks placed by machines (deployers, the RFTools Builder) aren't checked.
    - **With the upgrade tree installed** (`part2/potato_tree.js`), the tree's nodes decide placing (and using) autocrafters instead of this rank rule. This rule stays as the fallback without it.
  - **Off switch:** `STANDING_CRAFTING = false` stops rank gating crafting (and placing autocrafters); it then only gates the black market.
- **The black market** (`economy/black_market.js`, `STANDING_LOCKS`): some items are only sold to a rank or higher. The shop shows "(needs Potato Soldier)" in place of [BUY], or a red "Needs …" line in the window, and refuses the sale before any coins are taken.

  | Rank | Items |
  |---|---|
  | 1 Potato Farmer | Itching Powder, Butterfingers, Anonymous Summons |
  | 2 Potato Peeler | Mimic Chest, Cursed Food, Tip-off contract |
  | 3 Potato Recruit | Writ of Protection |
  | 4 Potato Private | Disguised TNT, Tracker Compass, Squad contract |
  | 6 Potato Sergeant | Teleport Trap, Homing Pig |
  | 8 Potato Captain | War Party contract |
  | anyone | Certified Alibi, Unsanctioned Eye, under-the-counter stock, bounties |

  Under-the-counter stock can be locked with a `custom` entry, and anything else by adding its key (see BLACK_MARKET.md). Part I's server has no Blood Pool, so nothing there is locked.
- **When stages are given:** on every offer, at login, after `/reload`, when a tier opens, and when an op changes a rank (which also takes away stages above the new rank). KubeJS saves stages with the player.
- **Every player also gets `blood_pool_tier_<n>`** for each open tier. The upgrade tree's quests check it.
- **Catch-up** (owner decision): when the Pool opens Tier T, every player can craft Tiers 1..T−2 at a table, whatever their rank (`CATCH_UP_GAP = 2`; 0 = off).
  - **Full Measure:** at Tier 12 (`OPEN_ALL_TIER`) every tier opens to everyone: all 11 rank stages, no crafting recipe keeps a rank check, and the upgrade tree grants every node. Without it, Tier 11's crafting-table recipes would never open (catch-up stops at Tier 10).
  - The rank's name, rank-ups and the black market still use the real rank.
  - `/potatowar` shows "Crafting access: Tier 3 (catch-up)".
  - The upgrade tree catches its nodes up in the same way.
- **The Purge's Potato Heist** (`part2/purge.js`, see PURGE.md) moves potatoes between players' totals with `global.BloodPool.takeStanding(uuid, name, n)` and `giveStanding(uuid, name, n)`. These work for offline players too, and `standingOfUuid(uuid)` reads a total.
  - **A loss never lowers a rank:** the highest rank reached is kept, so only progress toward the next rank is lost.
  - **A gain can rank the thief up.**
- **Story events open tiers** with `global.BloodPool.openTo(n, by)`. The Shrine's Awakening uses it to break the third and fourth seals itself, with no vote (`openTo(4, 'the Shrine')`, see SHRINE.md).
  - It opens the tier as `/bloodpool unlock` does, announced: the title, the lines, the dimension gates, ranks held back, the tree's catch-up, and the `/reload` for the recipes.
  - It never lowers the tier, and does nothing if that tier is already open. It returns the tier now open.
  - The unlock log records who opened it ("the Shrine").

## Dimensions (`dimension_gates.js`)
| Dimension | Opens at | How it's held shut before then |
|---|---|---|
| The Nether | Tier 3 (`NETHER_TIER`) | **Portals don't light.** The startup script's switch (`global.netherPortalsUnlocked`, saved as `trollcraft_nether_unlocked`) is kept in step with the tier |
| The End | Tier 9 (`END_TIER`) | **No Eyes of Ender.** The Eye's recipe is a Tier 9 item lock |

- **Getting in anyway:** anyone found in a sealed dimension is sent back to their last place in an open one, with a Ministry line (the Ministry is the one keeping you out). That covers a found Eye, a mod teleporter, or a portal lit while it was open. Ops, creative and spectator players are exempt.
- **When the tier opens,** the dimension opens at once and the Blood God announces that the Ministry's seal has shattered. `settier` changes it quietly.
- **Portals lit before the gate closes** keep their frame. Anyone who uses one is just sent back.

## The tank (`blood_tank.js`)
A tower in the world shows the Pool. It's 5 × 5 and 8 tall:
```
roof (top)   5x5 chiseled nether bricks
6 layers     corners: nether gold ore · sides: glass (3 wide) · inside: the 3x3 chamber
floor        5x5 chiseled nether bricks
```
- **One layer of blood for every 2 tiers opened.** Tier 2 fills 1 layer, Tier 4 fills 2, and Tier 12 fills all 6.
  - **The blood** is EvilCraft's (`evilcraft:blood`). If it can't be placed, red stained glass is used instead.
  - **When a tier opens,** the new layer rises with a bubbling sound and red particles.
  - **When the tier goes down** with `settier`, it drains again.
- **Building it:**
  - `/bloodtank build <x y z>` builds the tower with its floor centred on that block (`~ ~ ~5` works) and fills it.
  - `/bloodtank add <x y z>` registers one you built by hand (the position is the floor's centre block). It checks the build first and names the first wrong block.
- **Several tanks** can be registered (e.g. at spawn and at the Shrine).
- **Unloaded tanks:** a tank whose area isn't loaded when a tier opens is filled when a player next comes within 48 blocks. A check every 10 s also repairs a tank that's out of step.
- **Protection:** players who aren't ops can't break or place blocks in a tank ("The Blood Pool is sacred. The Blood God does not share it."). Ops can.

## Commands

| Command | Who | |
|---|---|---|
| `/bloodpool` | anyone | Drops, the open tier, the next tier and how far off it is (or "ready"), and how much of it potatoes may still pay |
| `/bloodpool donate <coins>` | players | Give Hush Coins (1,000 Drops each) |
| `/bloodpool tithe [n]` | players | The Potato Tithe: everything you carry, or that many of the tithe's unit (potatoes, or after the reveal Enchanted / Enchanted Baked Potatoes) |
| `/bloodpool top` | anyone | The 10 biggest contributors |
| `/bloodpool tiers` | anyone | Every tier: threshold, what it opens (mods, item count, recipe rules, dimension), OPEN / READY / sealed, and the rank its crafting needs |
| `/bloodpool check` | anyone | Which tier lets the item in your hand be crafted, and the rank (with yours). For an item in `USE_LOCKS`, `PLACE_LOCKS`, `WEAR_LOCKS` or `WIELD_LOCKS`, it also says that using, placing or wearing one is sealed |
| `/potatowar` | players | Your potatoes offered, your rank and the next one (and your catch-up crafting access, if higher) |
| `/potatowar tree` | players | Opens the upgrade tree (FTB Quests; see [POTATO_TREE.md](POTATO_TREE.md)) |
| `/potatowar next` | players | Your rank, your crafting access, what the full open tier needs, and the tree nodes you can buy now or nearly |
| `/bloodpool gatecheck` | op | Reads the recipes the game holds now and reports how many of those given a rank check on the last reload really have it, naming any that ignore it or failed to load |
| `/bloodpool audit` | op | Reloads and writes `kubejs/progression_audit.json`: every crafting-type recipe above catch-up without the rank check, and every recipe still making a sealed item (with whether KubeJS sees it). A summary goes to the log |
| `/potatowar offer [n]` | players | Offer everything you carry, or that many of your next rank's unit, to raise your rank |
| `/potatowar pay [node] [n]` | players | Hand in potatoes, crates and Enchanted Potatoes toward an upgrade-tree node's price, whole ones only and only while they fit (see [POTATO_TREE.md](POTATO_TREE.md), "Paying for a node") |
| `/potatowar top` | anyone | The 10 highest ranks |
| `/potatowar ranks` | anyone | Every rank, its number in its unit (potatoes, or after the reveal Enchanted / Enchanted Baked Potatoes), the tier it crafts and the Pool tier it needs |
| `/potatowar check <player>` | op | A player's potatoes and rank (online, or anyone who has offered) |
| `/potatowar add <player> <potatoes>`, `/potatowar set <player> <potatoes>` | op | Change a player's Standing; stages follow at once (or at their next login) |
| `/bloodpool vote` | players | Vote to break the seal on the next tier, once it's ready. The fifth player's vote opens it, as `/bloodpool unlock` does |
| `/bloodpool unvote` | players | Take your vote back while the seal still holds |
| `/bloodpool unlock` | op | Open the next tier at once (it must be ready), without waiting for votes; announces and reloads |
| `/bloodpool unlock force` | op | Open the next tier even if the Pool isn't there |
| `/bloodpool settier <0-12>` | op | Set the open tier directly, quietly (testing, or undoing a mistake); reloads |
| `/bloodpool top clear confirm` | op | Empty the contributors list (`/bloodpool top`). The Drops, the tiers and the Potato War stay. For the test server between rehearsals; without `confirm` it only explains |
| `/bloodpool add <drops>`, `/bloodpool set <drops>` | op | Adjust the Pool |
| `/dimensiongates` | op | What's open; re-applies the Nether switch |
| `/bloodtank build <x y z>`, `/bloodtank add <x y z>` | op | Build a tank, or register a hand-built one |
| `/bloodtank list`, `/bloodtank remove <n>`, `/bloodtank refill` | op | The tanks and their fill; unregister one (its blocks stay); re-apply the fill |

## Settings

| Setting | Default | |
|---|---|---|
| `TIERS` | 12 tiers, filled from the research | Names, thresholds and what each opens |
| `NETHER_TIER`, `END_TIER` | 3, 9 | When the dimensions open |
| `DROPS_PER_TROLL_POINT` | 1 | |
| `DROPS_PER_COIN` | 1000 | |
| `POTATOES_PER_DROP` | 4 | 4,000 potatoes = 1,000 Drops |
| `POTATO_DROPS_CAP_PER_DAY` | 30000 | The whole server's daily tithe; 0 = no cap |
| `POTATO_DROPS_CAP_PER_PLAYER` | 0 (off) | Set it (e.g. 4000) if one big farm keeps taking the whole day's quota |
| `TITHE_ZONE`, `TITHE_RESET_HOUR` | `America/Chicago`, 4 | When the tithe quota reopens |
| `POTATO_WORTH` | potato 1, the three crates 9, Enchanted Potato 160, Enchanted Baked Potato 25,600 | What the tithe, `/potatowar offer` and `/potatowar pay` accept, and its worth in potatoes |
| `POTATO_SHARE` | Tiers 1–3: 1, 4–6: 0.75, 7–9: 0.5, 10–12: 0.25 | The share of each tier's Drops potatoes may pay |
| `REVEAL_TIER` | 5 | The tier whose opening reveals the price |
| `UNITS` | from Tier 6: Enchanted Potato (160); from Tier 9: Enchanted Baked Potato (25,600) | What the Potato War's numbers count after the reveal, by tier |
| `REVEAL_STAGE` | `potato_war_revealed` | The stage everyone gets once the price is revealed (the quest book waits for it) |
| `REVEAL_TITLE`, `REVEAL_LINES`, `REVEAL_WAR_LINE` | see "The price revealed" | What the reveal says |
| `OVEN_TIER`, `OVEN_WAR_LINE` | 8 | The Potato Oven's tier, and its line when it opens |
| `OPEN_ALL_TIER` | 12 | Full Measure: every tier's crafting and every tree node open for everyone |
| `MACHINE_RECIPES` | the Potato Press and Oven | Their recipes, added once their tier is open, with no rank needed |
| `STANDING` | 250 … 4,400,000 (11 ranks) | The number for each rank (lifetime potatoes, or after the reveal its unit for ranks 6–11); rank n crafts Tier n |
| `RANK_LEAD` | 1 | A rank can be at most this many above the open Pool tier (rank n needs Tier n − 1). `null` = no cap |
| `RANKS` | Unenlisted, Potato Farmer … Potato Emperor | The rank names (the first is rank 0) |
| `STANDING_CRAFTING` | true | Rank gates crafting-table recipes for players and placing autocrafters. false = it only gates the black market |
| `AUTOCRAFTERS` | 11 blocks (see "Autocrafters only make") | Autocrafters that need their tier's rank to place. `{ name }`, or `{ name, rank }` for a fixed rank |
| `BANNED_CRAFTERS` | Fancy Crafters, Wixie Cauldron, Wixie Charm | Autocrafters no check can reach: recipes removed, placing and using refused. Take an id out to allow it again, which breaks the autocrafter rule for that block |
| `USE_LOCKS` | 63 items, each `use`, `block` or `mob` | Items that can't be used until their tier opens, however they were got (see "The exception: what Part I players brought"). Creative players are exempt; ops in survival aren't |
| `PLACE_LOCKS` | Nuclear Bomb, Tremorzilla Egg, Ender Quarry | Blocks that can't be placed until their tier opens, by anyone but a creative player |
| `SPAWN_LOCKS` | `alexscaves:nuclear_bomb` (the primed bomb) | Entities stopped from spawning while the item named for them is sealed |
| `WEAR_LOCKS` | 159 armour pieces and worn accessories (built from family lists: `SETS`, `EACH`) | Gear that's taken off (armour and Curios slots) while sealed, however it was got, and can't be put on with a right-click. Creative players are exempt |
| `SLOT_3_LOCKS` | the four warden armour pieces | Worn pieces that also work from main inventory slot 3: moved out of it while sealed |
| `WIELD_LOCKS` | 127 weapons and tools | Gear that can't hit (in either hand), break blocks or be right-clicked while sealed. Creative players are exempt |
| `CARRY_LOCKS` | 10 items | Items that work by being carried: moved to the ender chest (or dropped) while sealed |
| `PROJECTILE_LOCKS` | `iceandfire:dragon_arrow`, `iceandfire:hydra_arrow` (entity → item) | Projectiles whose hits do nothing while their item is sealed |
| `LOCK_TIERS` | 74 items | Items whose use, wear, wield or carry lock waits for a later tier than their own in `TIERS` (dragonsteel 9, terrasteel 6, Botania's Gaia gear 9, the MekaSuit 10, Draconic 10 and 11, the Atomic Disassembler 7). Crafting and ranks don't change |
| `KIT_MARKS` | `GladiatorKit`, `PurgeKit`, `ShrineKit` | NBT marks of event kit items, which no lock holds |
| `WEAR_CHECK_TICKS` | 20 | How often worn and carried gear is checked (every second); a piece put on is checked at once too |
| `STAGE_PREFIX` | `potato_standing_` | The KubeJS stage name for rank n |
| `RANKUP_PUBLIC` | true | Announce rank-ups to everyone |
| `CATCH_UP_GAP` | 2 | Catch-up: at Pool Tier T, everyone can craft Tiers 1..T−2 (and gets the tree's nodes up to there), and machines can make those tiers' recipes; 0 = off |
| `CONVERT_RECIPE_TYPES` | `cucumber:shaped_no_mirror`, `cucumber:shaped_tag`, `mekanism:mek_data` | Mods' crafting formats rebuilt with the rank check when above catch-up; `[]` = none |
| `STRIP_BYPRODUCTS` | `/molten_debris$/` | Byproducts Tinkers' ore melting may not give, at any tier. `null` turns the Foundry's diamond-to-debris route back on |
| `AUDIT_FILE`, `AUDIT_FLAG_FILE` | `kubejs/progression_audit.json`, `kubejs/progression_audit_request.json` | `/bloodpool audit`'s report, and its request (cleared after the run) |
| `black_market.js`: `STANDING_LOCKS` | see "The Potato War" | The rank each black market item needs |
| `TO_DISCORD` | true | Ready and unlock lines with `tellraw @a` |
| `TIER_FILE` | `kubejs/blood_pool_tier.json` | |
| `RELOAD_DELAY_TICKS` | 20 | Between the unlock announcement and `/reload` |
| `VOTES_TO_BREAK` | 5 | Different players' `/bloodpool vote` needed to break the seal on a ready tier. `0` = no voting (ops only) |
| `LOGIN_NOTICE_DELAY_TICKS` | 100 | How long after joining a player is told that a tier is ready (after the join messages) |
| `dimension_gates.js`: `CHECK_TICKS`, `EXEMPT_OPS` | 20, true | How often sealed dimensions are checked (1 s); ops exempt |
| `blood_tank.js`: `TIERS_PER_LAYER`, `BLOOD_BLOCK`, `BLOOD_FALLBACK` | 2, `evilcraft:blood`, red stained glass | The fill rule and the blood |
| `blood_tank.js`: `FLOOR_BLOCK`, `ROOF_BLOCK`, `CORNER_BLOCK`, `SIDE_BLOCK` | chiseled nether bricks, nether gold ore, glass | The design (`add` checks against these) |
| `blood_tank.js`: `LOOP_SECONDS`, `NEAR`, `PROTECT` | 10, 48, true | The repair check, how close counts as loaded, protection |

## Saved data
- **`persistentData["blood_pool"]`:**
  - the Drops and the open tier;
  - which tiers have been announced as ready;
  - totals by source (trolls, coins, potatoes, ops);
  - contributors, and every unlock (who, when);
  - the tithe day and its totals (server-wide and per player);
  - the Potato War: each player's lifetime potatoes offered (`standing`);
  - the votes to break the seal on the next tier (`vote`: the tier and who voted), cleared whenever the tier changes;
  - the ranks kept from before the Pool cap (`rankFloor`), and when that one-time snapshot was taken (`rankFloorSince`). Don't delete `rankFloorSince` on a live server: the next load would take a new snapshot, keeping everyone's current rank;
  - the Drops potatoes have paid toward each tier (`potatoByTier`, for `POTATO_SHARE`);
  - story lines waiting for the reload a tier opening starts (`pending`: `reveal`, `oven`).
- **The players' KubeJS stages** (`potato_standing_<n>`, `blood_pool_tier_<n>`, `potato_war_revealed`): saved by KubeJS with each player, and rebuilt from `standing` and the tier at login.
- **`kubejs/blood_pool_tier.json`:** a copy of the open tier, for the recipe step.
- **`kubejs/progression_audit.json`:** the last `/bloodpool audit` report.
- **`persistentData["trollcraft_nether_unlocked"]`:** the Nether portal switch (kept in step by `dimension_gates.js`).
- **`persistentData["blood_tank"]`:** the registered tanks (dimension, floor centre, layers filled).

## Test plan (an op and a player)
1. **`/bloodpool tiers`:** 12 tiers from 20,000 to 4,400,000, with the Nether at 3 and the End at 9.
   - In JEI, Create and the Twilight Forest steeleaf chestplate have no recipes.
   - Ironwood tools and the Tinkers smeltery do.
2. **Try to light a Nether portal:** it doesn't light.
   - `/give` yourself an Eye of Ender: as a non-op it's usable. Go through an End portal and you're sent back with the Ministry line.
3. **Tithe:**
   - carry 100 potatoes and 2 Quark potato crates; `/bloodpool tithe`: 29 Drops, and 2 potatoes come back as change;
   - `/bloodpool tithe 3`: refused, too few.
4. **`/bloodpool set 120000`, then `/bloodpool unlock` three times:**
   - the third opens Tier 3 with the Nether line;
   - portals now light;
   - after the reload, Immersive Engineering and steel recipes are back, but Mekanism's are still gone.
5. **Mystical Agriculture and Tinkers:** at Tier 4, the steeleaf Tinkers material casts, and Mystical Agriculture's steel seed recipe exists. The cobalt material still doesn't cast.
6. **Restart the server:** the tier stays open (the file), and the Nether stays open.
7. **The tank:** stand in an open space and run `/bloodtank build ~ ~ ~5`.
   - `/bloodpool settier 2`: one layer of blood.
   - `settier 12`: full.
   - `settier 0`: empty.
   - As a non-op, try to break the glass: refused.
8. **`/bloodpool settier 0`** puts everything back, including the Nether switch.
   - **Breaking the seal by vote:** with the next tier ready, have five players run `/bloodpool vote`. Each vote is announced with the count; a second vote from the same player is refused. One player runs `/bloodpool unvote`: the count drops by one, everyone online is told, and a second `unvote` is refused. They vote again. Relog a sixth player before the last vote: five seconds after joining, they're told the tier is ready, with the count. The fifth vote opens the tier, with the "5 voices broke the Ministry's seal" line, and the server reloads.
   - **The raygun (a use lock):** in survival, `/give @s alexscaves:raygun` and `/give @s alexscaves:uranium_rod 4` (its ammo), then hold right-click at a mob. Nothing happens, the mob isn't hurt, all four rods are still there, and the action bar says the Raygun is sealed until Tier 6 (A Stream). `/bloodpool check` with it in hand says using one is sealed too. In creative it fires. After `/bloodpool settier 6` it fires in survival; `settier 0` seals it again.
   - **The rest of the list, at Tier 5:** an AE2 Matter Cannon and a Rending Gale do nothing, and say why. An Entropy Manipulator does nothing on a block. A Totem of Possession does nothing on a mob. Holding the raygun, a chest still opens.
   - **The Nuclear Bomb:** placing one is refused. Put one in a dispenser and power it: the bomb is used up, nothing explodes, and the log says `Stopped alexscaves:nuclear_bomb from spawning`. Test this away from anything you care about, in case the spawn lock fails. At `/bloodpool settier 11` the bomb places (don't light it).
   - **Wear and wield locks, at Tier 5** (in survival): put on a resonarium chestplate (Tier 6) and a gravitite helmet (Tier 4). Within a second the chestplate comes off into the inventory, the action bar says it's sealed until Tier 6 (A Stream), and the helmet stays on. With a full inventory, warden boots drop at your feet. Put the Aether's netherite gloves (Tier 5) in the gloves slot: they stay on; at `settier 4` they come off. Hit a mob with a warden sword (Tier 7): no damage, and the action bar says why. Mine stone with a warden pickaxe: it doesn't break. The zanite sword (Tier 5) and a gravitite pickaxe (Tier 4) work. Right-click with the sonorous staff (Tier 9): nothing fires. In creative all of it works. After `settier 7` the warden gear works and stays on.
   - **The rest of the sealed gear, at Tier 5** (in survival):
     - Right-click a warden helmet: it doesn't go on. Shift-click it into the helmet slot: it comes off at once.
     - Put a warden piece in the 4th hotbar slot: it moves.
     - Put a MekaSuit helmet on: it comes off, and the action bar says Tier 10.
     - With Better Combat, hold a diamond sword and a Kikoku in the off hand and attack: no damage.
     - Pick up a phoenix down: it goes to the ender chest. With the ender chest full, it drops at your feet.
     - Shoot a dragonbone arrow from a plain bow: no damage.
     - Use the gorgon head: refused.
     - In a Gladiator Arena match with the Troll Smasher kit, the troll hammer and troll armour work.
9. **The Potato War** (a non-op player in survival; an op runs the commands):
   - **After lowering the tier to retest:** two things stay behind. Caught-up tree nodes stay until `/potatotree revoke` (`/potatowar set` only changes potatoes). A Tinkers Crafting Station keeps its last recipe through a reload, so one used at the higher tier can still make that recipe without its rank check. Craft something else in it, replace it or restart.
   - **Netherite:** below Tier 5, ancient debris won't smelt and a netherite ingot won't craft. At Tier 5, debris smelts, and melting diamond ore in a Foundry gives molten diamond but no molten debris.
   - **The audit:** at Tier 0, run `/bloodpool audit`, then again at Tier 5. Send `kubejs/progression_audit.json` back after each.
   - **Autocrafters:** at Tier 3, a Quark Crafter makes a Tier 1 recipe but not a Tier 2 one, even for a player of rank 2 who can craft it by hand. A Mixer makes a vanilla shapeless recipe and a Tier 1 one, but not a Tier 2 one. A Fancy Crafter can't be placed or used.
   - **The live check:** after each tier change, `/bloodpool gatecheck` should say every rank check is live. A recipe listed as failed to load doesn't exist in the game, so there's nothing to gate (`mekanism_weaponry:alien_paint_bucket` is the one known at Tier 11).
   - **Rebuilt recipes:** at Tier 5 with `CATCH_UP_GAP = 0`, an Unenlisted player can't turn steeleaf essence into ingots (rank 4) or craft a Purification Chamber (rank 5). An op can.
   - Set `CATCH_UP_GAP = 0` for this test (or catch-up lets everyone craft Tiers 1–3 at Tier 5), then `/bloodpool settier 5`.
   - **Unenlisted:** the player can't craft a Create cogwheel at a crafting table or in the inventory grid (no result shows), but a Thermal machine (Pulverizer etc.) built by an op works for them.
   - `/potatowar set <player> 250`: they're told they're a Potato Farmer, everyone sees the line, and the cogwheel now crafts. A Thermal machine frame still doesn't (rank 5).
   - **The rank cap:** at Tier 2, `/potatowar set <player> 30000`: they're a Potato Recruit (rank 3), not a Potato Private, and `/potatowar` says Potato Private waits for Tier 3. `/bloodpool unlock force`: they become a Potato Private, with the rank-up line.
   - **Kept ranks:** on the live server, the first `/reload` with this version logs "Kept from before: …" with every player who was above the cap. Each of them still shows their rank in `/potatowar check <player>`, marked "(kept from before ranks waited for the Blood Pool)".
   - Carry 300 potatoes and `/potatowar offer 100`: Standing goes up by 100 and `/bloodpool` shows the Pool unchanged. `/bloodpool tithe` with the rest: the Pool goes up and `/potatowar` doesn't.
   - `/potatowar set <player> 50000`: the machine frame crafts. Relog: it still does.
   - **Autocrafting:** at Potato Sergeant, place an AE2 Molecular Assembler and autocraft the cogwheel: it works. Then let an Unenlisted player try to place a Molecular Assembler: refused, with the rank named. (With the upgrade tree installed, it names the ME Autocrafting node instead.)
   - **A mod's crafting grid:** an Unenlisted player at a Tinkers Crafting Station gets no cogwheel; a Potato Farmer does.
   - **Black market:** at the merchant, an unranked player sees "(needs Potato Farmer)" for Itching Powder and is refused; at Potato Farmer they can buy it.
   - **Catch-up:** set `CATCH_UP_GAP = 2` again and `/reload`. An unranked player can now craft the cogwheel (Tier 1, three tiers behind the Pool), and `/potatowar` says "Crafting access: Tier 3 (catch-up)". The black market still refuses them Itching Powder.

10. **The potato share and the price revealed** (one player with the farm's output; an op):
    - At Tier 4, `/bloodpool set 200000`. Tithe potatoes: `/bloodpool` shows "Potatoes may pay 90,000 of its 120,000 Drops (n paid)". `/bloodpool set` doesn't reset the share; tithe up to 90,000 Drops' worth and the next tithe is refused with "the rest must be blood". A troll still adds Drops.
    - `/bloodpool set 320000` then `/bloodpool unlock`: about 6 seconds after the reload, the title "IT WAS NEVER POTATOES", the three Blood God lines naming the Ministry, and the Potato Press line. It doesn't play again after another `/reload`.
    - `/potatowar ranks` shows ranks 6–8 in Enchanted Potatoes and 9–11 in Enchanted Baked Potatoes. `/potatowar` shows the next rank in its unit.
    - The Potato Press crafts at a crafting table for a player with no rank. Before Tier 5 it has no recipe in JEI.
    - Tithe 40 plain potatoes: refused ("takes Enchanted Potatoes in fours"). Tithe 4 Enchanted Potatoes: 1 Drop.
    - At Tier 8 (`/bloodpool unlock` from 7): the Potato Oven line, and the Oven crafts.
    - `/bloodpool settier 12`: an unranked player can craft a Tier 11 item at a table, and `/potatotree check <player>` lists every node.

**Testing Tinkers after lowering the tier:** restart the server first, or break and replace the smeltery or foundry controller and the casting tables. Tinkers remembers the last recipe each slot used and keeps reusing it while the same item sits there, even after `/reload` has removed it. So a smeltery that melted raw cobalt at Tier 12 keeps melting it after `settier 0`. This only happens when going **down** (testing). In play the tier only rises, and a locked recipe can't be remembered before it exists.

## What couldn't be verified for KubeJS 6 on 1.20.1
**The potato share and the price revealed** (15 November 2026). On the test server, by console:
- the machine recipes are absent at Tier 2 and the Potato Press's is present at Tier 5 (the Oven's still absent). The first version added them and relied on the seal's removal, which doesn't reach them: both crafted at Tier 2. Fixed;
- opening Tier 5 with `/bloodpool unlock` logged "The price is revealed" (no peaks to lower) and, after the reload, "The price was revealed to the server";
- `/potatowar ranks` showed the units, and `/bloodpool` the potato share;
- FTB Quests loaded all 63 quests, the Enchanted tasks too.

Still to confirm with a player: the title and lines on screen, the tithe and offers taking Enchanted Potatoes (and change), the Press recipe at a crafting table without a rank, and the Oven line at Tier 8. The mock tests cover all of these.

**The use, place and spawn locks** weren't tried in game, because the test server has no player. The mock tests cover:
- refusing a use in either hand, on a block or on a mob, by mode;
- open tiers working, and items off the list left alone;
- the action bar line and the inventory resend;
- placing by a player, an op, a non-player and a creative player;
- the primed bomb's spawn;
- `/bloodpool check`, and opening at the item's tier.

Still to confirm in game:
- **That each item works through its use.** Only the raygun was read in the jar. An item whose effect also comes from somewhere else gets past a use lock: something it does while merely held, or a different click than the mode covers. That would show up as an item that still works after the refusal message.
- **Mob clicks:** the `mob` mode relies on KubeJS's `ItemEvents.entityInteracted` giving the player as `event.player`, like the other item events.
- **The dispenser nuke:** that cancelling the spawn leaves nothing behind. Alex's Caves spawns the bomb, then uses up the stack whether or not the spawn worked.

**The wear and wield locks** (22 November 2026). The mock tests cover: every listed id in a tier; armour taken off at the once-a-second check (and not before), into the inventory or at the player's feet; open pieces and creative players left alone; hits and block breaks cancelled with a sealed item in the main hand, and allowed with an open one, an ordinary weapon or a bare hand; right-clicks refused in the air and on a block; `/bloodpool check`; and the gear working once its tier opens.

**All sealed gear** (25 November 2026). Added to the mock tests:
- **Load and tiers:**
  - every lock list's ids in a tier;
  - `LOCK_TIERS` (the MekaSuit helmet 10, dragonsteel 9, terrasteel 6, the Ring of Odin 9, Draconic 10 and 11);
  - `/bloodpool check` naming a lock's later tier;
  - at Tier 6, dragon scale armour, the gorgon head and dragonbone arrows open, while dragonsteel and Kikoku stay held.
- **The worn lock:**
  - armour put on between checks coming off at once (the inventory event);
  - a right-click refused for sealed armour and allowed for open armour, while clicking a block isn't refused;
  - warden armour moved out of hotbar slot 4, and never put back there or into it when it's the only free slot.
- **The hit lock:** a sealed sword in the off hand stopping hits.
- **Kits:** arena, Purge and Shrine kit items not held.
- **Carried items:** going to the ender chest (from the main inventory, the off hand and Curios), or dropped when it's full.
- **Projectiles:** a dragonbone arrow's hit cancelled.

12 deliberate breaks of the lock code were each caught. The new script loaded on the test server (25 November) with 0 errors and 0 warnings; nothing was tried with a player.

**Seen on the test server** (22 November 2026, one player in survival, gear put on and hits dealt from the console with `/item replace` and `/damage … by <player>`):
- at Tier 5, a resonarium chestplate and warden boots came off into the inventory within a second, with a log line each; gravitite helmet and leggings stayed on. Later, with no console command running, the player put the boots on by hand (22:19 and 22:52) and each time they came off;
- at Tier 4, the Aether's netherite gloves came off their Curios gloves slot (`aether_gloves`) into the inventory;
- at Tier 5, hits with the warden sword and the sonorous staff did no damage, and the zanite sword's did;
- at Tier 7, warden boots stayed on and the warden sword's hits did damage; back at Tier 5 the boots came off again;
- the script loaded with no warnings (Curios found), and Tier 5 held back 16 more recipes than before.

Still to confirm in game:
- **Breaking blocks and right-clicks by hand:** a warden pickaxe not breaking stone, and the sonorous staff not firing.
- **`/bloodpool check` as a player:** its reply goes to the player's chat, not the console, so it wasn't read.
- **Better Combat's off-hand swings** (25 November): they're stopped by checking both hands, read from Better Combat's code (`PlayerEntityMixin`), not tried with a player.
- **Carried items going to the ender chest,** a dragonbone arrow's hit (the lock reads the hit's direct entity, `source.directEntity`), Curios' right-click equip being refused, and arena kit gear in a real match: offline tests only.
- **What a cancelled hit stops** (read on 25 November, not tried in game): KubeJS posts `EntityEvents.hurt` from Forge's `LivingAttackEvent` at priority HIGH, the first thing a hit does, so the item's own on-hit effects (the gravitite sword's launch, a dragonbone sword's fire) never run. None of the sealed items acts earlier, on `AttackEntityEvent` (research/gear/DIMENSION_GEAR.md). The sonorous staff's beam is a use, which is refused.
- **A piece put straight back on:** fixed on 25 November. A right-click can't put a sealed piece on, and one put on from the inventory screen comes off at once. Gloves put on from the Curios screen still wait for the next check (up to a second, +1 damage at most).
- **Block breaking with a sealed tool held in the off hand:** only the main hand is checked, since that's the hand that mines.

**The raygun** in particular. Two things to watch for:
- **The holder's own screen:** the client starts using the item before the server refuses it. The player holding it sees the active texture and their own beam, and hears it, until they let go. Nothing is hurt or broken: the damage is dealt only in the server's use tick, which never starts.
- **What others see:** the beam is drawn only for a player the server says is using it, so others see no beam. But while "firing", Alex's Caves sends the gun's data from the client to the server, which takes it as it is (`UpdateItemTagMessage` → `ItemStack.setTag`). So others may see the gun's glow flicker.
- **A free charge:** the same message can give the server's raygun the full charge of the client's pretend reload, without the server taking a Uranium Rod. So a locked raygun can sit charged, ready for Tier 6. That's one free reload, and nothing fires.
- **Ammo shown as spent:** that client-side reload also spends a rod on the holder's screen. The inventory is sent again a tick later, so the count should come back. If it doesn't, relogging fixes it, since the server never took any.
- **Closing all of these:** only a client script in the modpack can, by refusing the click in the player's own game (`potato_tooltips.js` already reads the Blood Pool stages there).

**Confirmed on the server:** going from Tier 12 to 0, Tinkers kept melting raw cobalt in a smeltery that had melted it before, while cobalt ingots were refused.
- **The cause** is Tinkers' per-slot recipe cache (`MeltingModule.lastRecipe` in TConstruct 3.11.2.166). It isn't saved, so a restart or a rebuilt controller clears it.
- **The lock list is right:** `tconstruct:smeltery/melting/metal/cobalt/raw` is removed at Tier 0.
A mock-server test passed 170 checks: catch-up, the rebuilt mod recipes (ids, patterns, tag results, upgrades left alone, sealed ones removed), `/bloodpool audit` and `/potatowar next`. The upgrade tree's test re-runs the earlier checks with the tree loaded: 117 pass (see POTATO_TREE.md).
- the real tier list (sealed mods, items, tags, and recipe rules both exact and regex);
- items listed later than their mod staying sealed after it opens;
- the chestplates;
- the Potato Tithe: crates and change, whole Drops, negative and too-large amounts, the 30,000 cap, the 4 am Central rollover, credit;
- the Nether switch following the tier;
- players sent back from sealed dimensions, ops exempt;
- the opening announcement, `/dimensiongates`, and no stacked loops after `/reload`;
- the tank:
  - the build;
  - the fill at tiers 0, 1, 2, 4, 5 and 12, and draining;
  - the rising effect;
  - the red-glass fallback;
  - repair of an out-of-step tank;
  - an unloaded tank filled when a player comes near;
  - `add` naming a wrong block, and `~` positions;
  - protection;
- the Potato War:
  - each crafting-table recipe's result check and its tier (result item, listed item, tag, the recipe's mod over its result's, recipe-id rules); untiered, sealed-tier, machine and mechanical crafting recipes left alone; no stages on recipes; one shared check per tier; one pass;
  - the check: a player at a table with and without the rank, a mod's grid found through the player's open window, autocrafters (no player) getting every result, an error giving the result;
  - placing autocrafters: below and at the rank, each block's tier, ordinary blocks untouched, ops and creative exempt, `/bloodpool check` naming the rank;
  - offering: everything or a count, crates and change, refusals; the Pool and the tithe untouched; the tithe never raising rank;
  - ranks, stages given and taken away, the rank-up title and line;
  - `/potatowar`, `top`, `ranks`, the op commands (op only), `/bloodpool tiers` and `check`;
  - stages after login and `/reload`;
  - the black market: locked items refused with no coins taken (command and window), "(needs …)" in the chat shop, a red line in the window, a locked contract not opening its target page, buying at the rank. The Part I black market test (no Blood Pool) still passes unchanged.

These depend on the real game:
- **Regex recipe ids:** `event.remove({ id: /regex/ })` with a JS regex. If KubeJS ignores a regex, those materials, essences and seeds stay craftable (check the Tinkers steel material at Tier 0).
- **`java.time` in scripts** (the 4 am reset). If KubeJS blocks the class, the script falls back to a fixed offset (09:00 UTC, which is 4 am CDT or 3 am CST).
- **Recipe filters with `not`:** used only when an item opens before its mod. The current tiers never do that.
- **Thermal's machine frame, coils and augments:** none of the jars ship a recipe for them. Check in JEI that they exist and disappear while Thermal is sealed.
- **AlmostUnified:** checked on the test server (its default config), 25 November 2026. It does: steel, tin, lead, silver, nickel, bronze, electrum, invar and constantan all become Thermal's, so below Tier 5 nothing makes them. See [POTATO_TREE.md](POTATO_TREE.md), "Known: only below Pool Tier 5".
- **Relic seals** (2026-11-20, mock-tested): a ready Tier 5+ seal waiting on relics, as players see it (the lines, the refused vote and unlock), and the vote opening when the Shrine restores the relic it waited for.
- **The Transmutation Table** (after the restart and `/reload`):
  - Feed a table 3 of something not on its lists, transmute a few times, and check that it never comes back as a choice.
  - Over a few dozen rolls, no diamond, blaze rod, ghast tear, ender pearl, quartz or other removed item should be offered. If one is, the `kubejs/data` lists aren't loading.
- **The Dragon Heart:** test one dragon kill before Tier 10 matters. The dragon-fight mods may change the drop.
- **Running `reload` from a script**, and **JsonIO** writing the tier file, as before.
- **Rebuilt mod recipes** (read from KubeJS 2001.6.5's jar, not seen in game):
  - `event.shaped(...).noMirror().id(sameId)` replacing the removed original;
  - `Ingredient.of('#tag').getItemIds()` for tag results;
  - A Mekanism factory upgrade keeping its upgrades. (Mystical Agriculture essence → ingots being refused below the rank was seen in game at Tier 1.)
  - Check JEI still shows them.
- **`/bloodpool audit`:** `forEachRecipe('*')` over every recipe, and JsonIO writing the nested report.
- **The tier-open message** and `/potatowar next`, as seen by players.
- **The Potato War's crafting gate** (seen in game at Tiers 1 and 3 only: shaped and shapeless recipes, both mirrorings, a crystal that survives crafting, the Quark Crafter and the Mixer):
  - "Potato War: N crafting recipes need a rank" in the server log counts attempts, not working checks. `/bloodpool gatecheck` is the real count. (`modifyResult` alone once did nothing on these recipes while this line reported success; see TEST_REPORT.md.)
  - **Mods' own crafting-table formats that aren't rebuilt** stay craftable by any rank once their tier opens: IE's `shaped_fluid` and `turn_and_copy`, Reliquary's alkahestry, RFTools' shape-card copies, Botania, EvilCraft and Numina specials, and the upgrades left as they are. Each needs an item that's already rank-locked, or is cosmetic (PROGRESSION_AUDIT.md section 2).
  - **Mods' crafting grids:** the Tinkers Crafting Station and Create's Blueprint refuse an unranked player (seen in game). AE2's crafting terminal hasn't been tried: the script finds its player through the open window. A grid that shows neither its window nor its player counts as an autocrafter and gives every result. Mekanism's QIO dashboard looks like one, read from its jar and not tried in game: it works out the result with no player attached. It's a Tier 10 item, so the risk is small.
  - **Machines not tried in game:** the Crafty Crate, Mechanical Crafter, Formulaic Assemblicator, Ender IO Crafter, Thermal's Sequential Fabricator, RFTools Crafters, AE2's assemblers, IE's Assembler and the Auto Project Table. Their jars show they use the recipe's check, but a machine could still lose ingredients when it gets an empty result. Try each with a recipe above catch-up and watch its ingredients. The Quark Crafter kept its ingredients.
  - **The Mechanical Press and Mechanical Crafter** use the same skip list as the Mixer, which was seen in game. They weren't tried themselves.
  - **Other routes read from the jars, not tried:** IE's Metal Press with an Unpacking Mold reads the result directly for single-ingredient recipes, so it may skip the check (you'd already need the block it unpacks). Botania's Assembly Halo and Mekanism's QIO window count as machines, so they make nothing above catch-up, even for a player of the rank.
  - **Autocrafters** that do have a player window open on them could be counted as that player's grid. Confirm one AE2 pattern crafts while someone has the assembler's screen open.
  - **Client-side previews** (Polymorph, the recipe book) may show a result that the server then doesn't give. The server decides.
  - **JEI** still lists rank-locked recipes for everyone. The result simply doesn't appear without the rank.
  - **The placing check** uses `BlockEvents.placed`. Check that a refused autocrafter stays in the player's hand.
- **The tank:**
  - whether EvilCraft's blood places as a still source in each cell and looks right through the glass (otherwise set `BLOOD_BLOCK` to the fallback);
  - the `<x y z>` argument (KubeJS's block-position argument);
  - that `fill` can only reach loaded areas (by design; the repair check covers it).
