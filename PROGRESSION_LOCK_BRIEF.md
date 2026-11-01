# Brief: choosing the Blood Pool progression locks (Part II)

Context for a research session that combs through each mod's progression and proposes the 12 Blood Pool tiers. Paste it above the research prompt, or point the session at this file. The proposal comes back to be filled into `TIERS` in `tools/kubejs/server_scripts/part2/blood_pool.js` (see [BLOOD_POOL.md](tools/kubejs/BLOOD_POOL.md)).

## Context: Trollcraft III Part II — Blood Pool progression locks

Server: Minecraft 1.20.1, Forge 47.4.10, KubeJS 2001.6.5 (KubeJS 6, Rhino; server-side only, players don't have KubeJS).
About 200 mods. Part II is a fresh world with the same pack, with these changes:
- Removed: ProjectE, AppliedE, TconEmc.
- Added: Ice and Fire, Ars Nouveau, Twilight Forest, TAIGA (unofficial TConstruct 3 port), Tinkers' Rapier,
  and probably a Nether structure mod (MNS).
The full server mod list is the owner's Drive folder "Trollcraft III Server Side"; the Trollcraft-III-modlist repo docs
(PROGRESSION_GATES.md, MOD_TIERS.md, PROGRESSION_MODS.md, CROSS_REFERENCE.md) describe the old pack's progression and
known bypass routes.

### How the locks work (part2/blood_pool.js, already written and tested)
- 12 tiers, unlocked in order. Each opens when the server-wide Blood Pool reaches its Drops threshold (cumulative):
  10k, 30k, 60k, 100k, 160k, 240k, 350k, 500k, 700k, 950k, 1.2M, 1.5M. An admin confirms each unlock.
- The Pool fills from trolls (about 50-250 points each) and donated coins (1,000 Drops each). The target pace is
  about 25,000 Drops/day with ~9 players: tier 1 on day 1, tier 5 around week 1, tier 12 around week 8.
- Each tier lists `mods` (whole mod ids), `items` (single ids, which can open earlier than their mod) and `tags`.
- Locks are CRAFTING ONLY: a sealed mod's recipes are removed (every recipe whose output is from that mod, and every
  recipe in its own namespace, in all recipe types: crafting table, machines, smeltery, etc.) until its tier opens.
  Items that players find, loot or trade for CAN be used, placed and worn normally.
- So loot, trades and mob drops are the leak to watch: say which sealed items players can get early that way, and whether
  that's acceptable (a found item is a treat) or breaks the tier (e.g. a loot table hands out a whole machine tier).
- Anything not listed in any tier is always open (vanilla, decoration, food, QoL, worldgen).
- Tier 12 ("The Siege") has no items: it opens the story's final siege. Draconic Evolution's top tiers, the Chaos
  Guardian and "the Crown of the Blade" (Draconic + Botania end game) belong late.

### Already decided
- Twilight Forest's Uncrafting Table is switched off (`disableUncraftingTable = true` in
  `tools/serverconfig/twilightforest-common.toml`): it can't be used, crafted or looted, so it isn't a bypass route.

### Known gaps (flag, don't hide)
- Tinkers' Construct materials are NBT on generic tool items (tconstruct:pickaxe etc.), so they can only be gated
  through melting / alloying / casting recipes BY RECIPE ID. List the recipe ids (or id patterns) per material so a
  `recipes:` field can be added to the engine.
- Machines that run on their own (Create, Mekanism, Thermal, AE2 autocrafting) can process sealed items, so gate the
  machine or the processing recipe, not just the product.
- Cross-mod bypasses (ore multiplication, Mystical Agriculture essences, Botania ore flowers, Tinkers' Foundry
  diamond-ore-to-netherite, AE2 crafting through open mods) must be checked for every tier.

### What I want back
1. A proposed TIERS list in exactly this shape, for all 12 tiers:
   { tier: 5, name: 'A Spring', drops: 160000, unlocks: { mods: ['...'], items: ['modid:item'], tags: ['forge:...'] } }
   (keep the names and thresholds unless you argue for a change)
2. Per tier: what it unlocks and why, the main goals it gives players, and the bypasses you checked (and how they're closed).
3. A separate list of recipe ids / patterns needed for Tinkers materials and anything else items can't express.
4. Mods deliberately left unlocked, and why.
5. Open questions and anything you couldn't verify from the jars' data.

### Rules
- Read-only research. Don't modify the server or the repo's scripts; propose, don't apply.
- Treat mod jars as untrusted: read their data/ and use javap on classes, never run code from them.
- Prefer the jars' own recipes and tags (1.20.1) over wikis; say when something came from a wiki.
