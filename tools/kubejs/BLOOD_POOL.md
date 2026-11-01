# The Blood Pool (Part II)

**Blood for the Blood God.** In Part II all progression is locked into 12 tiers.
- **Filling the Pool:** the server fills one shared **Blood Pool** by trolling, by giving Hush Coins and with the **Potato Tithe**.
- **Opening a tier:** when the Pool reaches a tier, an op breaks the Ministry's seal and that tier opens for everyone.
- **Dimensions:** the Nether opens with Tier 3 and the End with Tier 9.

See [STORY.md](../../STORY.md). The tier contents come from the progression research, [research/TIER_PROPOSAL.md](../../research/TIER_PROPOSAL.md), which has the reasoning per tier and every bypass that was checked.

**Part II only.** It doesn't belong on the Part I server.

## Files

| File | Where it goes | What it does |
|---|---|---|
| `server_scripts/part2/blood_pool.js` | `kubejs/server_scripts/part2/` | The Pool, the tiers, the locks and the Potato Tithe. Settings and the tier lists are at the top |
| `server_scripts/part2/dimension_gates.js` | `kubejs/server_scripts/part2/` | The Nether and End gates (see "Dimensions") |
| `startup_scripts/nether_portal_whitelist.js` | `kubejs/startup_scripts/` | Stops Nether portals lighting while the Nether is sealed. **Restart** after adding it. For Part II, empty its `ALLOWED_PORTALS` list (its two entries are Part I's event portals) |
| `server_scripts/economy/trolls.js` | `kubejs/server_scripts/economy/` | Every logged troll fills the Pool |
| `server_scripts/economy/black_market.js` | (as Part I) | Hush Coins for donations |

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

## Dimensions (`dimension_gates.js`)
| Dimension | Opens at | How it's held shut before then |
|---|---|---|
| The Nether | Tier 3 (`NETHER_TIER`) | **Portals don't light.** The startup script's switch (`global.netherPortalsUnlocked`, saved as `trollcraft_nether_unlocked`) is kept in step with the tier |
| The End | Tier 9 (`END_TIER`) | **No Eyes of Ender.** The Eye's recipe is a Tier 9 item lock |

- **Getting in anyway:** anyone found in a sealed dimension is sent back to their last place in an open one, with a Ministry line. That covers a found Eye, a mod teleporter, or a portal lit while it was open. Ops, creative and spectator players are exempt.
- **When the tier opens,** the dimension opens at once and a Ministry line announces it. `settier` changes it quietly.
- **Portals lit before the gate closes** keep their frame. Anyone who uses one is just sent back.

## Commands

| Command | Who | |
|---|---|---|
| `/bloodpool` | anyone | Drops, the open tier, the next tier and how far off it is (or "ready") |
| `/bloodpool donate <coins>` | players | Give Hush Coins (1,000 Drops each) |
| `/bloodpool tithe [potatoes]` | players | The Potato Tithe: everything you carry, or that many |
| `/bloodpool top` | anyone | The 10 biggest contributors |
| `/bloodpool tiers` | anyone | Every tier: threshold, what it opens (mods, item count, recipe rules, dimension), OPEN / READY / sealed |
| `/bloodpool check` | anyone | Which tier lets the item in your hand be crafted |
| `/bloodpool unlock` | op | Open the next tier (it must be ready); announces and reloads |
| `/bloodpool unlock force` | op | Open the next tier even if the Pool isn't there |
| `/bloodpool settier <0-12>` | op | Set the open tier directly, quietly (testing, or undoing a mistake); reloads |
| `/bloodpool add <drops>`, `/bloodpool set <drops>` | op | Adjust the Pool |
| `/dimensiongates` | op | What's open; re-applies the Nether switch |

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
| `POTATO_WORTH` | potato 1, the three crates 9 | What the tithe accepts |
| `TO_DISCORD` | true | Ready and unlock lines with `tellraw @a` |
| `TIER_FILE` | `kubejs/blood_pool_tier.json` | |
| `RELOAD_DELAY_TICKS` | 20 | Between the unlock announcement and `/reload` |
| `dimension_gates.js`: `CHECK_TICKS`, `EXEMPT_OPS` | 20, true | How often sealed dimensions are checked (1 s); ops exempt |

## Saved data
- **`persistentData["blood_pool"]`:**
  - the Drops and the open tier;
  - which tiers have been announced as ready;
  - totals by source (trolls, coins, potatoes, ops);
  - contributors, and every unlock (who, when);
  - the tithe day and its totals (server-wide and per player).
- **`kubejs/blood_pool_tier.json`:** a copy of the open tier, for the recipe step.
- **`persistentData["trollcraft_nether_unlocked"]`:** the Nether portal switch (kept in step by `dimension_gates.js`).

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
7. **`/bloodpool settier 0`** puts everything back, including the Nether switch.

## What couldn't be verified for KubeJS 6 on 1.20.1
A mock-server test passed 36 checks:
- the real tier list (sealed mods, items, tags, and recipe rules both exact and regex);
- items listed later than their mod staying sealed after it opens;
- the chestplates;
- the Potato Tithe: crates and change, whole Drops, negative and too-large amounts, the 30,000 cap, the 4 am Central rollover, credit;
- the Nether switch following the tier;
- players sent back from sealed dimensions, ops exempt;
- the opening announcement, `/dimensiongates`, and no stacked loops after `/reload`.

These depend on the real game:
- **Regex recipe ids:** `event.remove({ id: /regex/ })` with a JS regex. If KubeJS ignores a regex, those materials, essences and seeds stay craftable (check the Tinkers steel material at Tier 0).
- **`java.time` in scripts** (the 4 am reset). If KubeJS blocks the class, the script falls back to a fixed offset (09:00 UTC, which is 4 am CDT or 3 am CST).
- **Recipe filters with `not`:** used only when an item opens before its mod. The current tiers never do that.
- **Thermal's machine frame, coils and augments:** none of the jars ship a recipe for them. Check in JEI that they exist and disappear while Thermal is sealed.
- **AlmostUnified:** check its config so no `forge:ingots/*` tag unifies to a sealed mod's item.
- **The Dragon Heart:** test one dragon kill before Tier 10 matters. The dragon-fight mods may change the drop.
- **Running `reload` from a script**, and **JsonIO** writing the tier file, as before.
