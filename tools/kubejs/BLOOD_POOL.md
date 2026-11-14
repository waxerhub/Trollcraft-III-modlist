# The Blood Pool (Part II)

**Blood for the Blood God.** In Part II all progression is locked into 12 tiers.
- **Filling the Pool:** the server fills one shared **Blood Pool** by trolling, by giving Hush Coins, with the **Potato Tithe**, and by killing Twilight Forest bosses (`part2/boss_blood.js`, see [BOSS_BLOOD.md](BOSS_BLOOD.md)).
- **Opening a tier:** when the Pool reaches a tier, five players vote to break the Ministry's seal (`/bloodpool vote`), or an op breaks it, and that tier opens for everyone.
- **Dimensions:** the Nether opens with Tier 3 and the End with Tier 9.
- **The Potato War:** each player also has a **Potato Standing** (a rank), raised only by potatoes they offer to Techno's war chest. A tier's **crafting-table** recipes need the tier open **and** the crafter's rank at that tier. Machines work for everyone. Some black market items also need a rank (see "The Potato War").

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

Copy them, restart once (for the startup script), then `/reload` after any later change. The script creates `kubejs/blood_pool_tier.json` by itself (see "Why there's a file").

## Filling the Pool
- **Every troll in the Troll Log** adds its points as Drops: Anonymous Summons 50, Disguised TNT 250, approved reports as set by the admin, and so on. Repeats and revenge are already applied by the Troll Log.
- **Hush Coins:** `/bloodpool donate <coins>` gives coins from your inventory at **1,000 Drops each**.
- **The Potato Tithe:** `/bloodpool tithe` gives every potato you carry, or `/bloodpool tithe <potatoes>` gives that many.
  - **Rate:** **4,000 potatoes = 1,000 Drops** (4 potatoes a Drop, whole Drops only).
  - **What counts:** raw potatoes, plus potato crates from Quark, Farmer's Delight and Thermal at 9 each. Breaking a crate to make up an amount gives the change back as potatoes. Baked and poisonous potatoes and potato dishes don't count.
  - **Daily quota:** **30,000 Drops a day, server-wide** (about 120,000 potatoes). A tithe that would go over takes only what fits and says the quota is full; after that the command refuses until the quota reopens.
  - **Reset:** the quota reopens at **4 am Central** (`America/Chicago`, daylight saving included).
  - **Why the cap:** without it, a bank of Thermal Insolators could reach Tier 12 in about a month. With it the arc is about **11½ weeks if the server farms, about 25 if it doesn't** (the research's §7, rescaled for Tier 12 at 4,400,000).
- **Tithed potatoes never raise anyone's rank** in the Potato War, and offered potatoes never fill the Pool. The two are separate on purpose.
- **Ops** can `/bloodpool add <drops>` or `/bloodpool set <drops>`.
- **Credit:** every Drop is credited to whoever gave it (`/bloodpool top`), for Part II titles.
- **Part I:** troll points don't count. The Pool starts at 0.

## Tiers

| Tier | Name | Drops (total) | Theme | Opens (main) |
|---|---|---|---|---|
| 0 | (start) | | | Vanilla, Twilight Forest (minus its later gear), Tinkers up to the smeltery, and every mod not listed |
| 1 | A Trickle | 20,000 | First Sparks | Create, Mystical Agriculture |
| 2 | A Puddle | 60,000 | The Green Art | Botania, Ars Nouveau, EvilCraft, Hexerei's cauldron; Extra Utilities' spikes and compressed cobblestone, ahead of the rest of the mod at Tier 7 (owner decision, 10 November 2026) |
| 3 | A Basin | 120,000 | Iron and Oil | Immersive Engineering, steel, Create brass; **the Nether** |
| 4 | A Font | 200,000 | The First Circuit | Mekanism (2×), Tinkers' Rapier, Create mechanical crafting, TF steeleaf |
| 5 | A Spring | 320,000 | The Nether Forge | Thermal, Ender IO, the Tinkers foundry and cobalt, netherite, Mekanism 3×, the Infusion Altar, TF knightmetal |
| 6 | A Stream | 480,000 | Terrasteel and Storage | AE2 and addons, Extreme Reactors, Reliquary, Alex's Caves, Ice and Fire, Terrasteel, Mekanism 4×, TF fiery and yeti |
| 7 | A River | 700,000 | Power and Rails | RFTools, Modular Powersuits, Redstone Arsenal, Blue Power, Extra Utilities, Create trains, Mekanism 5×, TF carminite and arctic |
| 8 | A Flood | 1,000,000 | The Deep Forge | TAIGA, TC Integrations, Create Big Cannons, Mekanism Tools and Weaponry, Advanced AE, the Tinkers end-game alloys |
| 9 | A Tide | 1,400,000 | Wither and Star | Draconic Evolution, Gaia, the End tier of Ender IO, dragonsteel; **the End** |
| 10 | A Sea | 1,900,000 | Fission and Wyvern | RFTools Dimensions, fission, the MekaSuit, Draconic Wyvern, AE2 quantum and spatial |
| 11 | An Ocean | 2,400,000 | Awakened | Mekanism SPS and antimatter, Draconic Awakened and Chaotic, Advanced AE quantum, Awakened Supremium, the Ender Quarry, the nuke |
| 12 | Full Measure | 4,400,000 | | No recipes: the last seal, which begins the final act (STORY.md, Act V). Renamed from "The Siege" and raised from 3,000,000 (owner decisions, 13 November 2026) |

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
- **Checked against the jars:**
  - every Twilight Forest and Ice and Fire item id has a recipe in its jar;
  - every recipe rule for Tinkers, Mystical Agriculture, TC Integrations, TAIGA and Ice and Fire matches real recipe ids in the server's versions;
  - the AgriCraft and Mekanism ids come from the research.

## The locks: crafting only
A sealed mod, item, tag or recipe **can't be crafted** until its tier opens. Its recipes are removed in every recipe type: the crafting table, furnaces, every machine, the smeltery and so on. They also disappear from JEI.

**Everything else works.** Sealed items that players find, loot, trade for or get from mobs can be used, placed, worn and fought with normally (owner decision). A found item is a treat, not a way round the tier.

**The exception: what Part I players brought (`USE_LOCKS`, `PLACE_LOCKS`, `SPAWN_LOCKS`).** Players kept their whole Part I inventory, and everything was craftable in Part I, so a sealed item made then would work from day one. These items can't be used or placed until their tier opens, however a player got one. Each item's tier is its own in `TIERS`, so it works again the moment that tier opens. The player is told why on the action bar ("The Raygun is sealed until the Blood Pool opens Tier 6 (A Stream).").

- **History:** owner requests, 9 November 2026. First the Raygun, after one carried over from Part I still fired. Then the right-click items and Tier 11 blocks from the carry-over list. A Part I player file from 20 October had a Nuclear Bomb, among other things.
- **Use locks (`USE_LOCKS`):** 39 items that work by being used. Each has a mode:
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
- **Not covered yet:** weapons that hit, tools that mine (the Draconic staffs, the Meka-Tool, the Atomic Disassembler), armour and Curios (jetpacks, the Flight Tiara, Draconic chestpieces). Those need a gear lock like the upgrade tree's. Two gaps in `TIERS` matter for that lock:
  - the MekaSuit helmet, pants and boots fall back to Mekanism's Tier 4, since only the body armour is listed at Tier 10;
  - Draconic's chaotic gear opens with Draconic at Tier 9, though its parts are Tier 11.
- **Adding an item:** put its id in `USE_LOCKS` with its mode, or a block in `PLACE_LOCKS`. The script warns at load if an id is in no tier (it would never be locked) or a mode is misspelt.

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

**Things the research flagged and left open on purpose:**
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

- **Offering:** `/potatowar offer` gives every potato you carry to Techno's war chest, or `/potatowar offer <potatoes>` gives that many.
  - Crates count as 9, and change from a broken crate comes back as potatoes, as with the tithe.
  - **Offered potatoes only count toward your rank.** They never fill the Pool, and there's no daily cap.
  - **Your Standing is the lifetime total you've offered.** It never goes down (an op can change it).
  - **Ranks wait for the Blood Pool** (`RANK_LEAD`, owner decision, 9 November 2026). A rank can be at most one above the Pool's open tier, so rank n needs Tier n−1. Potato Farmer needs none; at Tier 0 it's the highest rank there is.
    - **Potatoes offered past the cap still count.** `/potatowar` says "Potato Lieutenant waits for the Blood Pool to open Tier 6 (your potatoes already cover it)".
    - **When `/bloodpool unlock` opens the tier,** everyone it was holding back gets the rank their potatoes earned, with the usual title and public rank-up line. The quiet `/bloodpool settier` gives the rank silently.
    - **Everything that reads rank follows the capped one:** crafting at a table, the rank stages, the upgrade tree's rank tasks, the black market, `/potatowar top`.
    - **Ranks held before the cap are kept** (owner decision, same day: some players were already Potato Privates at Tier 1).
      - The first time the cap loads, it records every player already above it, from their saved potatoes, in `rankFloor`. The log names them: "Kept from before: …".
      - They keep that rank, and `/potatowar` shows "(kept from before ranks waited for the Blood Pool)". Their next rank waits for its tier like anyone's.
      - It's a one-time snapshot (`rankFloorSince`): later progress is always capped. An op who lowers someone's potatoes lowers a kept rank too.
- **Ranks** (`STANDING` and `RANKS` in `blood_pool.js`). Rank n crafts Tier n:

  | Rank | Name | Lifetime potatoes | Crafts |
  |---|---|---|---|
  | 0 | Unenlisted | 0 | Nothing in any tier |
  | 1 | Potato Farmer | 250 | Tier 1 (Create, Mystical Agriculture) |
  | 2 | Potato Peeler | 1,000 | Tier 2 |
  | 3 | Potato Recruit | 2,500 | Tier 3 (IE, so the Garden Cloche) |
  | 4 | Potato Private | 25,000 | Tier 4 |
  | 5 | Potato Soldier | 50,000 | Tier 5 (Thermal, so the Insolator) |
  | 6 | Potato Sergeant | 400,000 | Tier 6 |
  | 7 | Potato Lieutenant | 700,000 | Tier 7 |
  | 8 | Potato Captain | 1,200,000 | Tier 8 |
  | 9 | Potato General | 2,000,000 | Tier 9 |
  | 10 | Potato Warlord | 3,000,000 | Tier 10 |
  | 11 | Potato Emperor | 4,400,000 | Tier 11 (Tier 12 has no recipes) |

  Owner decisions, 9 November 2026: ranks 1–3 are the first ladder's (250 to 2,500), cheap so a hand-farm reaches the Garden Cloche. Ranks 4 and 5 are 25,000 and 50,000 (they were 5,000 and 10,000). Ranks 6 and up are 20x the first ladder (they were 20,000 to 220,000), so Potato Sergeant is a big step up from Potato Soldier. Raising the ladder can lower a player's rank: their rank stages follow at `/reload` (players online) or their next login. Tree nodes they bought stay, and catch-up still opens crafting up to Tier T−2.

  **A rank, once earned, is never lost** (owner decision):
  - Each player's record has a `peak`: the highest rank their potatoes have bought. A rank never drops below it, so a Purge's Potato Heist (`takeStanding`) can take potatoes but not the rank.
  - A record from before the peak existed starts at the rank its potatoes buy now, so nobody's rank changed when it was added. Ranks bought under the launch numbers aren't brought back.
  - **Only an op can lower a rank,** with `/potatowar set <player> <potatoes>`, which sets it to what that total buys. `/potatowar add`, offers and tree hand-ins never lower it.
- **Ranking up:** a title and a sound for the player, and a public line: "Ana has risen to Potato Soldier in Techno's Potato War" (sent to Discord with `TO_DISCORD`; `RANKUP_PUBLIC = false` keeps it quiet).

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
  - The rank's name, rank-ups and the black market still use the real rank.
  - `/potatowar` shows "Crafting access: Tier 3 (catch-up)".
  - The upgrade tree catches its nodes up in the same way.
- **The Purge's Potato Heist** (`part2/purge.js`, see PURGE.md) moves potatoes between players' totals with `global.BloodPool.takeStanding(uuid, name, n)` and `giveStanding(uuid, name, n)`. These work for offline players too, and `standingOfUuid(uuid)` reads a total.
  - **A loss never lowers a rank:** the highest rank reached is kept, so only progress toward the next rank is lost.
  - **A gain can rank the thief up.**

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
| `/bloodpool` | anyone | Drops, the open tier, the next tier and how far off it is (or "ready") |
| `/bloodpool donate <coins>` | players | Give Hush Coins (1,000 Drops each) |
| `/bloodpool tithe [potatoes]` | players | The Potato Tithe: everything you carry, or that many |
| `/bloodpool top` | anyone | The 10 biggest contributors |
| `/bloodpool tiers` | anyone | Every tier: threshold, what it opens (mods, item count, recipe rules, dimension), OPEN / READY / sealed, and the rank its crafting needs |
| `/bloodpool check` | anyone | Which tier lets the item in your hand be crafted, and the rank (with yours). For an item in `USE_LOCKS` or `PLACE_LOCKS`, it also says that using or placing one is sealed |
| `/potatowar` | players | Your potatoes offered, your rank and the next one (and your catch-up crafting access, if higher) |
| `/potatowar tree` | players | Opens the upgrade tree (FTB Quests; see [POTATO_TREE.md](POTATO_TREE.md)) |
| `/potatowar next` | players | Your rank, your crafting access, what the full open tier needs, and the tree nodes you can buy now or nearly |
| `/bloodpool gatecheck` | op | Reads the recipes the game holds now and reports how many of those given a rank check on the last reload really have it, naming any that ignore it or failed to load |
| `/bloodpool audit` | op | Reloads and writes `kubejs/progression_audit.json`: every crafting-type recipe above catch-up without the rank check, and every recipe still making a sealed item (with whether KubeJS sees it). A summary goes to the log |
| `/potatowar offer [potatoes]` | players | Offer everything you carry, or that many, to raise your rank |
| `/potatowar top` | anyone | The 10 highest ranks |
| `/potatowar ranks` | anyone | Every rank, its potatoes, the tier it crafts and the Pool tier it needs |
| `/potatowar check <player>` | op | A player's potatoes and rank (online, or anyone who has offered) |
| `/potatowar add <player> <potatoes>`, `/potatowar set <player> <potatoes>` | op | Change a player's Standing; stages follow at once (or at their next login) |
| `/bloodpool vote` | players | Vote to break the seal on the next tier, once it's ready. The fifth player's vote opens it, as `/bloodpool unlock` does |
| `/bloodpool unvote` | players | Take your vote back while the seal still holds |
| `/bloodpool unlock` | op | Open the next tier at once (it must be ready), without waiting for votes; announces and reloads |
| `/bloodpool unlock force` | op | Open the next tier even if the Pool isn't there |
| `/bloodpool settier <0-12>` | op | Set the open tier directly, quietly (testing, or undoing a mistake); reloads |
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
| `POTATO_WORTH` | potato 1, the three crates 9 | What the tithe and `/potatowar offer` accept |
| `STANDING` | 250 … 4,400,000 (11 ranks) | Lifetime potatoes for each rank; rank n crafts Tier n |
| `RANK_LEAD` | 1 | A rank can be at most this many above the open Pool tier (rank n needs Tier n − 1). `null` = no cap |
| `RANKS` | Unenlisted, Potato Farmer … Potato Emperor | The rank names (the first is rank 0) |
| `STANDING_CRAFTING` | true | Rank gates crafting-table recipes for players and placing autocrafters. false = it only gates the black market |
| `AUTOCRAFTERS` | 11 blocks (see "Autocrafters only make") | Autocrafters that need their tier's rank to place. `{ name }`, or `{ name, rank }` for a fixed rank |
| `BANNED_CRAFTERS` | Fancy Crafters, Wixie Cauldron, Wixie Charm | Autocrafters no check can reach: recipes removed, placing and using refused. Take an id out to allow it again, which breaks the autocrafter rule for that block |
| `USE_LOCKS` | 39 items, each `use`, `block` or `mob` | Items that can't be used until their tier opens, however they were got (see "The exception: what Part I players brought"). Creative players are exempt; ops in survival aren't |
| `PLACE_LOCKS` | Nuclear Bomb, Tremorzilla Egg, Ender Quarry | Blocks that can't be placed until their tier opens, by anyone but a creative player |
| `SPAWN_LOCKS` | `alexscaves:nuclear_bomb` (the primed bomb) | Entities stopped from spawning while the item named for them is sealed |
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
  - the ranks kept from before the Pool cap (`rankFloor`), and when that one-time snapshot was taken (`rankFloorSince`). Don't delete `rankFloorSince` on a live server: the next load would take a new snapshot, keeping everyone's current rank.
- **The players' KubeJS stages** (`potato_standing_<n>`, `blood_pool_tier_<n>`): saved by KubeJS with each player, and rebuilt from `standing` and the tier at login.
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

**Testing Tinkers after lowering the tier:** restart the server first, or break and replace the smeltery or foundry controller and the casting tables. Tinkers remembers the last recipe each slot used and keeps reusing it while the same item sits there, even after `/reload` has removed it. So a smeltery that melted raw cobalt at Tier 12 keeps melting it after `settier 0`. This only happens when going **down** (testing). In play the tier only rises, and a locked recipe can't be remembered before it exists.

## What couldn't be verified for KubeJS 6 on 1.20.1
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
- **AlmostUnified:** check its config so no `forge:ingots/*` tag unifies to a sealed mod's item.
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
