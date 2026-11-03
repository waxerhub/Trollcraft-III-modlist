# The Blood Pool (Part II)

**Blood for the Blood God.** In Part II all progression is locked into 12 tiers.
- **Filling the Pool:** the server fills one shared **Blood Pool** by trolling, by giving Hush Coins and with the **Potato Tithe**.
- **Opening a tier:** when the Pool reaches a tier, an op breaks the Ministry's seal and that tier opens for everyone.
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
  - **Why the cap:** without it, a bank of Thermal Insolators could reach Tier 12 in about three weeks. With it the arc is about **8 weeks if the server farms, about 17 if it doesn't** (the research's §7).
- **Tithed potatoes never raise anyone's rank** in the Potato War, and offered potatoes never fill the Pool. The two are separate on purpose.
- **Ops** can `/bloodpool add <drops>` or `/bloodpool set <drops>`.
- **Credit:** every Drop is credited to whoever gave it (`/bloodpool top`), for Part II titles.
- **Part I:** troll points don't count. The Pool starts at 0.

## Tiers

| Tier | Name | Drops (total) | Theme | Opens (main) |
|---|---|---|---|---|
| 0 | (start) | | | Vanilla, Twilight Forest (minus its later gear), Tinkers up to the smeltery, and every mod not listed |
| 1 | A Trickle | 20,000 | First Sparks | Create, Mystical Agriculture |
| 2 | A Puddle | 60,000 | The Green Art | Botania, Ars Nouveau, EvilCraft, Hexerei's cauldron |
| 3 | A Basin | 120,000 | Iron and Oil | Immersive Engineering, steel, Create brass; **the Nether** |
| 4 | A Font | 200,000 | The First Circuit | Mekanism (2×), Tinkers' Rapier, Create mechanical crafting, TF steeleaf |
| 5 | A Spring | 320,000 | The Nether Forge | Thermal, Ender IO, the Tinkers foundry and cobalt, Mekanism 3×, the Infusion Altar, TF knightmetal |
| 6 | A Stream | 480,000 | Terrasteel and Storage | AE2 and addons, Extreme Reactors, Reliquary, Alex's Caves, Ice and Fire, Terrasteel, Mekanism 4×, TF fiery and yeti |
| 7 | A River | 700,000 | Power and Rails | RFTools, Modular Powersuits, Redstone Arsenal, Blue Power, Extra Utilities, Create trains, Mekanism 5×, TF carminite and arctic |
| 8 | A Flood | 1,000,000 | The Deep Forge | TAIGA, TC Integrations, Create Big Cannons, Mekanism Tools and Weaponry, Advanced AE, the Tinkers end-game alloys |
| 9 | A Tide | 1,400,000 | Wither and Star | Draconic Evolution, Gaia, the End tier of Ender IO, dragonsteel; **the End** |
| 10 | A Sea | 1,900,000 | Fission and Wyvern | RFTools Dimensions, fission, the MekaSuit, Draconic Wyvern, AE2 quantum and spatial |
| 11 | An Ocean | 2,400,000 | Awakened | Mekanism SPS and antimatter, Draconic Awakened and Chaotic, Advanced AE quantum, Awakened Supremium, the Ender Quarry, the nuke |
| 12 | The Siege | 3,000,000 | | No recipes: the Citadel's Bureaucratic Barrier (`part2/citadel.js`, later) |

**Unlocking a tier:**
1. **When the Pool reaches a tier,** everyone sees "[BLOOD GOD] The Blood Pool overflows. Tier 3 (A Basin) waits for the Ministry's seal to break." (it goes to Discord too). Ops are told to unlock it. Nothing opens yet.
2. **An op runs `/bloodpool unlock`.** The next tier opens:
   - a title for everyone ("THE BLOOD POOL / Tier 3: A Basin"), a Wither roar and a public line;
   - its dimension, if it has one, opens at once, with a Ministry line;
   - a second later the server runs **`/reload`**, so the tier's recipes come back (in JEI too).
3. **One tier per unlock.** If donations jump past several tiers, unlock them one at a time.

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

**Things the research flagged and left open on purpose:**
- **Botania's Orechid Ignem** (netherrack to ancient debris, from Tier 2) and **IE's Excavator** (ancient debris veins) are ore routes. Both need a mature setup first. The research's §3c has the one recipe id to add if netherite should stay a Nether trip.
- **The Timewood Core** (Twilight Forest) speeds up any mod's machines within 8 blocks. It's a natural block, so no crafting lock can stop it; only its config can.
- **Ender Storage, Walkers and ReMorphed** can't be gated by recipes.

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
- **Ranks** (`STANDING` and `RANKS` in `blood_pool.js`). Rank n crafts Tier n:

  | Rank | Name | Lifetime potatoes | Crafts |
  |---|---|---|---|
  | 0 | Unenlisted | 0 | Nothing in any tier |
  | 1 | Potato Farmer | 250 | Tier 1 (Create, Mystical Agriculture) |
  | 2 | Potato Peeler | 1,000 | Tier 2 |
  | 3 | Potato Recruit | 2,500 | Tier 3 (IE, so the Garden Cloche) |
  | 4 | Potato Private | 5,000 | Tier 4 |
  | 5 | Potato Soldier | 10,000 | Tier 5 (Thermal, so the Insolator) |
  | 6 | Potato Sergeant | 20,000 | Tier 6 |
  | 7 | Potato Lieutenant | 35,000 | Tier 7 |
  | 8 | Potato Captain | 60,000 | Tier 8 |
  | 9 | Potato General | 100,000 | Tier 9 |
  | 10 | Potato Warlord | 150,000 | Tier 10 |
  | 11 | Potato Emperor | 220,000 | Tier 11 (Tier 12 has no recipes) |

  The early ranks are cheap so a hand-farm reaches the Garden Cloche, and the Cloche reaches the Insolator.
- **Ranking up:** a title and a sound for the player, and a public line: "Ana has risen to Potato Soldier in Techno's Potato War" (sent to Discord with `TO_DISCORD`; `RANKUP_PUBLIC = false` keeps it quiet).

### What a rank gates
- **Crafting-table recipes:** every `minecraft:crafting_shaped` and `crafting_shapeless` recipe in an open tier gets a **result check** for its tier (KubeJS's `modifyResult`). When a player crafts it, the check asks for the KubeJS stage `potato_standing_<tier>`. Players hold the stage for every rank they've reached.
  - **A recipe's tier** is the highest lock that applies to it, by the same rules as the removal: its result (by item, then tag, then the result's mod), the recipe's own mod (unless its result is listed by id), and the recipe-id rules. So Mekanism's crafting recipe for a Create part needs rank 4.
  - **Without the rank,** the crafting grid shows no result. That covers the crafting table, the inventory grid, and a mod's crafting grid the player has open (the Tinkers Crafting Station, AE2's crafting terminal, a backpack's crafting upgrade), found through the player's open window.
  - **Untouched:** machines, furnaces, the smeltery, Create's mechanical crafting and every other recipe type work for everyone. So do sealed tiers: their recipes are still removed for everybody.
  - **Autocrafting works.** An autocrafter has no player behind it, so it gets every result of an open tier.
    - **Placing an autocrafter needs the rank of its own tier** (owner decision), set in `AUTOCRAFTERS`:

      | Autocrafter | Id | Rank to place |
      |---|---|---|
      | Create Mechanical Crafter | `create:mechanical_crafter` | 4 Potato Private |
      | Mekanism Formulaic Assemblicator | `mekanism:formulaic_assemblicator` | 4 Potato Private |
      | Ender IO Crafter | `enderio:crafter` | 5 Potato Soldier |
      | AE2 Molecular Assembler | `ae2:molecular_assembler` | 6 Potato Sergeant |
      | RFTools Crafter (tiers 1–3) | `rftoolsutility:crafter1/2/3` | 7 Potato Lieutenant |
      | Advanced AE Quantum Crafter | `advanced_ae:quantum_crafter` | 8 Potato Captain |

      A player below the rank is told "Only a Potato Sergeant or higher knows how to set up a Molecular Assembler" and the block isn't placed. Ops and creative players are exempt. Blocks placed by machines (deployers, the RFTools Builder) aren't checked.
    - **With the upgrade tree installed** (`part2/potato_tree.js`), the tree's nodes decide placing (and using) autocrafters instead of this rank rule. This rule stays as the fallback without it.
    - **The gap that remains:** an autocrafter doesn't know who owns it. Once someone of the rank has placed one, anyone who can use it (a shared AE2 network, a friend's crafters) can automate any open tier's table recipes, whatever their own rank.
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
| `/bloodpool check` | anyone | Which tier lets the item in your hand be crafted, and the rank (with yours) |
| `/potatowar` | players | Your potatoes offered, your rank and the next one (and your catch-up crafting access, if higher) |
| `/potatowar tree` | players | Opens the upgrade tree (FTB Quests; see [POTATO_TREE.md](POTATO_TREE.md)) |
| `/potatowar offer [potatoes]` | players | Offer everything you carry, or that many, to raise your rank |
| `/potatowar top` | anyone | The 10 highest ranks |
| `/potatowar ranks` | anyone | Every rank, its potatoes and the tier it crafts |
| `/potatowar check <player>` | op | A player's potatoes and rank (online, or anyone who has offered) |
| `/potatowar add <player> <potatoes>`, `/potatowar set <player> <potatoes>` | op | Change a player's Standing; stages follow at once (or at their next login) |
| `/bloodpool unlock` | op | Open the next tier (it must be ready); announces and reloads |
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
| `STANDING` | 250 … 220,000 (11 ranks) | Lifetime potatoes for each rank; rank n crafts Tier n |
| `RANKS` | Unenlisted, Potato Farmer … Potato Emperor | The rank names (the first is rank 0) |
| `STANDING_CRAFTING` | true | Rank gates crafting-table recipes for players and placing autocrafters. false = it only gates the black market |
| `AUTOCRAFTERS` | 8 blocks (see "Autocrafting works") | Autocrafters that need their tier's rank to place. `{ name }`, or `{ name, rank }` for a fixed rank |
| `STAGE_PREFIX` | `potato_standing_` | The KubeJS stage name for rank n |
| `RANKUP_PUBLIC` | true | Announce rank-ups to everyone |
| `CATCH_UP_GAP` | 2 | Catch-up: at Pool Tier T, everyone can craft Tiers 1..T−2 (and gets the tree's nodes up to there); 0 = off |
| `black_market.js`: `STANDING_LOCKS` | see "The Potato War" | The rank each black market item needs |
| `TO_DISCORD` | true | Ready and unlock lines with `tellraw @a` |
| `TIER_FILE` | `kubejs/blood_pool_tier.json` | |
| `RELOAD_DELAY_TICKS` | 20 | Between the unlock announcement and `/reload` |
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
  - the Potato War: each player's lifetime potatoes offered (`standing`).
- **The players' KubeJS stages** (`potato_standing_<n>`, `blood_pool_tier_<n>`): saved by KubeJS with each player, and rebuilt from `standing` and the tier at login.
- **`kubejs/blood_pool_tier.json`:** a copy of the open tier, for the recipe step.
- **`persistentData["trollcraft_nether_unlocked"]`:** the Nether portal switch (kept in step by `dimension_gates.js`).
- **`persistentData["blood_tank"]`:** the registered tanks (dimension, floor centre, layers filled).

## Test plan (an op and a player)
1. **`/bloodpool tiers`:** 12 tiers from 20,000 to 3,000,000, with the Nether at 3 and the End at 9.
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
9. **The Potato War** (a non-op player; an op runs the commands):
   - Set `CATCH_UP_GAP = 0` for this test (or catch-up lets everyone craft Tiers 1–3 at Tier 5), then `/bloodpool settier 5`.
   - **Unenlisted:** the player can't craft a Create cogwheel at a crafting table or in the inventory grid (no result shows), but a Thermal machine (Pulverizer etc.) built by an op works for them.
   - `/potatowar set <player> 250`: they're told they're a Potato Farmer, everyone sees the line, and the cogwheel now crafts. A Thermal machine frame still doesn't (rank 5).
   - Carry 300 potatoes and `/potatowar offer 100`: Standing goes up by 100 and `/bloodpool` shows the Pool unchanged. `/bloodpool tithe` with the rest: the Pool goes up and `/potatowar` doesn't.
   - `/potatowar set <player> 10000`: the machine frame crafts. Relog: it still does.
   - **Autocrafting:** at Potato Sergeant, place an AE2 Molecular Assembler and autocraft the cogwheel: it works. Then let an Unenlisted player try to place a Molecular Assembler: refused, with the rank named. (With the upgrade tree installed, it names the ME Autocrafting node instead.)
   - **A mod's crafting grid:** an Unenlisted player at a Tinkers Crafting Station gets no cogwheel; a Potato Farmer does.
   - **Black market:** at the merchant, an unranked player sees "(needs Potato Farmer)" for Itching Powder and is refused; at Potato Farmer they can buy it.
   - **Catch-up:** set `CATCH_UP_GAP = 2` again and `/reload`. An unranked player can now craft the cogwheel (Tier 1, three tiers behind the Pool), and `/potatowar` says "Crafting access: Tier 3 (catch-up)". The black market still refuses them Itching Powder.

**Testing Tinkers after lowering the tier:** restart the server first, or break and replace the smeltery or foundry controller and the casting tables. Tinkers remembers the last recipe each slot used and keeps reusing it while the same item sits there, even after `/reload` has removed it. So a smeltery that melted raw cobalt at Tier 12 keeps melting it after `settier 0`. This only happens when going **down** (testing). In play the tier only rises, and a locked recipe can't be remembered before it exists.

## What couldn't be verified for KubeJS 6 on 1.20.1
**Confirmed on the server:** going from Tier 12 to 0, Tinkers kept melting raw cobalt in a smeltery that had melted it before, while cobalt ingots were refused.
- **The cause** is Tinkers' per-slot recipe cache (`MeltingModule.lastRecipe` in TConstruct 3.11.2.166). It isn't saved, so a restart or a rebuilt controller clears it.
- **The lock list is right:** `tconstruct:smeltery/melting/metal/cobalt/raw` is removed at Tier 0.
A mock-server test passed 116 checks, catch-up included. The upgrade tree's test re-runs the earlier checks with the tree loaded: 101 pass (see POTATO_TREE.md).
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
- **The Potato War's crafting gate** (read from KubeJS 2001.6.5's jar, not seen in game):
  - `event.forEachRecipe` with a list of type filters, and `recipe.modifyResult(...)` on mods' existing crafting recipes turning them into KubeJS's versions with the check. The server log says how many recipes got a rank ("Potato War: N crafting recipes need a rank"). If it says 0, or logs an error, rank isn't gating crafting.
  - **Mods' own crafting-table recipe types** aren't checked: for example Mekanism's NBT-keeping recipes (`mekanism:mek_data`), IE's `shaped_fluid` and Forge's NBT recipes. Those items stay craftable by any rank once their tier opens. Check a few Mekanism machines at a crafting table with an unranked player.
  - **Mods' crafting grids** (the Tinkers Crafting Station, AE2's crafting terminal, backpack crafting upgrades): the script finds the player whose open window holds the grid. If a mod builds its grid so that it can't, the grid counts as an autocrafter and gives every result. Check the Crafting Station with an unranked player.
  - **Autocrafters** that do have a player window open on them could be counted as that player's grid. Confirm one AE2 pattern crafts while someone has the assembler's screen open.
  - **Client-side previews** (Polymorph, the recipe book) may show a result that the server then doesn't give. The server decides.
  - **JEI** still lists rank-locked recipes for everyone. The result simply doesn't appear without the rank.
  - **The placing check** uses `BlockEvents.placed`. Check that a refused autocrafter stays in the player's hand.
- **The tank:**
  - whether EvilCraft's blood places as a still source in each cell and looks right through the glass (otherwise set `BLOOD_BLOCK` to the fallback);
  - the `<x y z>` argument (KubeJS's block-position argument);
  - that `fill` can only reach loaded areas (by design; the repair check covers it).
