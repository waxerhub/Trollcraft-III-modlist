# Pass 2 — Item ladders and lockable handles

For each progression mod: the namespace the lock must name, the ladder as the **jars' own recipes**
describe it, and the **lockable handle** — whether a whole namespace, a short item list or a tag is the
right thing to put in a tier.

Sources: the pass-1 index (`research/index/`), plus `PROGRESSION_GATES.md`, `MOD_TIERS.md`,
`STARTING_MODS.md` and `CROSS_REFERENCE.md` from `waxerhub/Trollcraft-III-modlist`
(branch `claude/adoring-faraday-5kooyt`). **Where the old docs and the jars disagree, the jars win and
the disagreement is recorded.** Everything marked "wiki" or "not in the jars' data" is flagged.

Reminder from pass 1: `unlocks.mods` entries are matched as **namespaces**. Every "lock as" line below
gives the namespace, not the Forge mod id.

---

## How to read the handles

| Handle | When to use it | Cost |
|---|---|---|
| **whole namespace** (`mods: ['mekanism']`) | the mod is a self-contained ladder and nothing in it is needed before its tier | cheapest to write, blunt |
| **namespace + early items** (`mods:['x']` in tier N, `items:['x:thing']` in tier M<N) | the mod's basics are wanted early, its machines late | the engine keeps the early item's recipe via `not:{output:[…]}` |
| **item list only** | the mod also ships wood, decoration or food that players already inside it need | verbose but surgical — this is what Twilight Forest needs |
| **tag** | a whole metal tier across several mods | `hasTag` is used at runtime; the brief lists it as unverified in game |

---

## Tech mods

### Mekanism — lock as `mekanism`, `mekanismgenerators`, `mekanismtools`, `mekanism_weaponry`, `appmek`

Note the namespaces: **`mekanism_weaponry`** (underscore) for Mekanism Weaponry, **`appmek`** for Applied
Mekanistics. `mekanismcurios` produces **no items at all** (0 outputs) — it is a compat jar and needs no tier.
`jei_mekanism_multiblocks` is client-side.

| Step | Gate item | Routes that make it | Opens |
|---|---|---|---|
| entry | `mekanism:ingot_osmium` | 20 | everything |
| power | `mekanismgenerators:heat_generator` | 1 | passive power on lava |
| **the chokepoint** | `mekanism:steel_casing` | **1** | 33 recipes — *every* machine |
| **the other chokepoint** | `mekanism:basic_control_circuit` | **1** | 51 recipes — all four circuit tiers |
| 2× ore | `mekanism:enrichment_chamber` | 1 | ore doubling |
| 3× | `mekanism:purification_chamber` + `mekanism:advanced_control_circuit` | 1 each | |
| 4× | `mekanism:alloy_reinforced` + `mekanism:elite_control_circuit` | 1 each | |
| 5× | `mekanism:ingot_refined_obsidian` → `mekanism:alloy_atomic` → `mekanism:ultimate_control_circuit` | 9 / 1 / 1 | Ultimate tier, teleportation |
| fission | `mekanismgenerators:fission_reactor_casing` | 1 | |
| end | `mekanism:pellet_polonium` | **1** (fission only) | 35 recipes: MekaSuit, Meka-Tool, QIO, SPS |
| top | `mekanism:pellet_antimatter` | 1 | Nucleosynthesizer, top MekaSuit modules |

Verified against the index: `steel_casing` 1 recipe / 33 uses; `basic_control_circuit` 1 / 51;
`alloy_infused` 1 / 73; `pellet_polonium` 1 / 35. All the circuit and alloy tiers are single-recipe.

**Leaks.** `mekanism:ingot_refined_obsidian` is made by **four jars**: Mekanism, Mystical Agriculture
(essence), TConstruct (casting) and `thermal_integration`. `mekanism:ingot_steel` and `ingot_bronze` are
shared `forge:` tags with IE, Thermal and TConstruct. A whole-namespace lock on `mekanism` catches all of
them (the engine removes by output namespace), so Mekanism needs no item surgery — this is the cleanest
big mod in the pack to tier.

**Handle:** whole namespaces, split across two tiers (`mekanism` + `mekanismgenerators` early-mid,
`mekanismtools` / `mekanism_weaponry` / `appmek` later). Nothing in Mekanism is needed before its tier.

### Thermal Series — lock as **`thermal`** (one namespace for five jars), plus `redstone_arsenal`, `cofh_core`

The five Thermal jars (`thermal_foundation`, `thermal_expansion`, `thermal_dynamics`,
`thermal_innovation`, `thermal_integration`) all write items and recipes into the **`thermal`**
namespace. `cofh_core` owns no items but does own recipe types.

| Step | Gate item | Routes |
|---|---|---|
| entry | tin / lead / silver / nickel ingots (`thermal:*_ingot`) | 28–29 each, all `forge:`-tagged and shared |
| hand alloys | `thermal:bronze_ingot`, `invar_ingot`, `constantan_ingot`, `electrum_ingot` | 17 each (fire-charge route) |
| **parts** | `thermal:machine_frame`, `thermal:rf_coil`, `thermal:redstone_servo`, `thermal:energy_cell_frame`, `thermal:tinker_bench` | **0 in the jars' data — see below** |
| machines | `thermal:machine_pulverizer`, `machine_smelter`, `machine_press`, `machine_furnace` | 1 each, all need the frame + coil |
| alloys | `thermal:signalum_ingot`, `lumium_ingot`, `enderium_ingot` | 13 each |
| upgrades | `thermal:upgrade_augment_1` → `_2` → `_3` | **0 in the jars' data** |
| side branch | `redstone_arsenal:flux_ingot`, `flux_gem` | 10 / 5 |

> **Disagreement with the old docs, and a flag.** `PROGRESSION_GATES.md` lists `thermal:machine_frame`,
> `thermal:rf_coil`, `thermal:upgrade_augment_2` and `thermal:redstone_servo` as having **1 recipe each**.
> In this jar set **no file under any `data/**/recipes/` produces them.** I checked the extracted trees,
> then grepped the raw `thermal_foundation`, `thermal_expansion` and `cofh_core` jars: the only places the
> strings appear are the machine/dynamo recipes that *consume* them, plus
> `cofh/thermal/expansion/init/data/providers/TExpRecipeProvider.class` — the dev-time datagen provider,
> whose output was not shipped. So Thermal's core parts are registered at runtime in code, not by data.
> **Consequence:** `event.remove({ output: 'thermal:machine_frame' })` acts on the live recipe manager and
> should still remove them, but I cannot confirm that from the jars. **Check in JEI** that Thermal's Machine
> Frame and RF Coil (a) have a recipe at all and (b) disappear while `thermal` is sealed.

**Handle:** `mods: ['thermal']` for everything, with `redstone_arsenal` as a separate, later entry
(flux gear is a gear jump, not a machine tier). `cofh_core` is not worth a tier on its own.

### Immersive Engineering — lock as `immersiveengineering`

| Step | Gate item | Routes |
|---|---|---|
| entry | `immersiveengineering:hammer`, `manual`, `cokebrick` | 1 / 1 / 2 |
| wood | `immersiveengineering:treated_wood_horizontal`, `stick_treated` | 7 / 1 (118 uses) |
| power | `immersiveengineering:windmill` → `dynamo` → `wirecoil_copper` | 1 each |
| **Nether gate** | `immersiveengineering:blastbrick` (Nether Brick + Magma Block) | 2 |
| steel | `immersiveengineering:ingot_steel` → `plate_steel` | 10 / 7 |
| multiblocks | `immersiveengineering:component_steel` | **2**, opens Crusher / Excavator / Arc Furnace |
| blueprints | `immersiveengineering:ingot_aluminum` → `component_electronic`, `circuit_board` | 26 / 1 / 1 |
| end | `immersiveengineering:graphite_electrode` | 2 — the Arc Furnace runs on them |

**Leak:** IE's Arc Furnace makes **other mods'** ingots — the index shows
`immersiveengineering:arcfurnace/ore_cobalt` and friends producing `tconstruct:cobalt_ingot`. Covered by a
whole-namespace lock on `immersiveengineering` (the recipe id is in its namespace), but **not** by an
item-only lock on cobalt. Pass 3 lists these.

**Handle:** whole namespace. Its early tier (hammer, coke oven, treated wood, windmill) is a genuinely
nice tier-1/2 reward; its steel and multiblocks are mid-game. Consider `items: ['immersiveengineering:manual','immersiveengineering:hammer']` in an earlier tier if you want players reading the book before the mod opens.

### Create (+ 10 addons) — lock as `create`, and each addon namespace separately

Addon namespaces and output counts: `createaddition` 90, `createbigcannons` 273, `createdeco` **1727**
(pure decoration), `create_sabers` 11, `create_radar` 23, `create_aquatic_ambitions` 10, `sliceanddice` 2,
`bellsandwhistles` 53, `createappliedkinetics` 13, `rechiseledcreate`, `agricreatecompat` (0 items),
`cmpackagepipebomb`. Four of them (`createaddition`, `create_aquatic_ambitions`, `createdeco`,
`sliceanddice`) write their **recipe ids into the `create` namespace**, so `{mod:'create'}` already
removes them — but `output:'@createdeco'` is what catches their items.

| Step | Gate item | Routes |
|---|---|---|
| entry (andesite age) | `create:andesite_alloy` | 9 — leaky, also made by TConstruct and Thermal |
| kinetics | `create:shaft`, `cogwheel`, `andesite_casing`, `water_wheel`, `mechanical_press`, `millstone`, `mechanical_mixer` | 1–3 each |
| **Nether gate** | `create:blaze_burner` | **0 — not craftable**, you catch a blaze (`empty_blaze_burner` is 1 recipe) |
| brass | `create:brass_casing` | **2** — gate this, not `brass_ingot` (12 routes, shared tag with IE/Thermal/BluePower) |
| logic | `create:electron_tube` (1, 19 uses), `create:polished_rose_quartz` | |
| **the chokepoint** | `create:precision_mechanism` | **1**, sequenced assembly only — opens arms, crafters, trains |
| ore doubling | `create:crushing_wheel` | 1 |
| trains | `create:sturdy_sheet` → `create:railway_casing` | 2 / 1 |
| logistics | `create:packager`, `stock_ticker`, `package_frogport` | 1–2 each |

**Handle:** `create` as a whole namespace for the mod proper. **`createdeco` should be left unlocked** —
1,727 outputs, all decoration. `createbigcannons` deserves its own late tier (273 outputs, weaponry).
`createappliedkinetics` must open no earlier than AE2, because it overrides `ae2:inscriber/*`.

### Applied Energistics 2 (+ 9 addons) — lock as `ae2`, `advanced_ae`, `ae2additions`, `ae2wtlib`, `appbot`, `appmek`, `appliedcooking`, `createappliedkinetics`, `ae2insertexportcard`, `polyeng`

`polyeng` and `ae2ct` ship **no data** — nothing to lock, nothing to tier.

| Step | Gate item | Routes |
|---|---|---|
| entry | `ae2:meteorite_compass`, `ae2:charger` | 1 each |
| presses (meteorite loot) | `ae2:silicon_press`, `logic_processor_press`, `calculation_processor_press`, `engineering_processor_press` | **3 each**: AE2's own inscriber, Mystical Agriculture essence, and `createappliedkinetics` |
| crystals | `ae2:charged_certus_quartz_crystal` → `ae2:fluix_crystal` | 3 / 7 |
| **the chokepoint** | `ae2:logic_processor` / `calculation_processor` / `engineering_processor` | **3 / 2 / 2** routes — AE2 Inscriber, Advanced AE Reaction Chamber, Create Applied Kinetics |
| network | `ae2:drive`, `terminal`, `controller`, `energy_acceptor` | 1–2 each |
| autocrafting | `ae2:pattern_provider`, `molecular_assembler`, `crafting_unit`, `blank_pattern` | 1–2 each |
| end | `ae2:singularity` (1, Advanced AE reaction chamber only) → `ae2:quantum_ring`, `quantum_link`, `spatial_io_port` | |
| Advanced AE top | `advanced_ae:quantum_alloy`, `quantum_processor`, `quantum_core`, `quantum_unit` | 1–2 each |

**Handle:** `ae2` + the small addons as one mid-game tier; `advanced_ae` as a separate late tier (its
quantum tier is a genuine end-game step and it also owns the only Singularity recipe).
**Autocrafting is the real hazard, not the processors** — see pass 3.

### Ender IO — lock as `enderio`

| Step | Gate item | Routes |
|---|---|---|
| entry | `enderio:grains_of_infinity` | **1 craft-table route — and it is Mystical Agriculture's essence recipe.** EnderIO's own route is `enderio:fire_crafting/infinity`, a *loot-table* ritual (light a fire on Overworld bedrock, 50% chance) — not a recipe at all |
| first machine | `enderio:primitive_alloy_smelter` → `enderio:dark_steel_ingot` | 1 / 4 |
| **the two chokepoints** | `enderio:void_chassis` (1, 8 uses) and `enderio:basic_capacitor` (1, 6 uses) | every machine needs both |
| machines | `stirling_generator`, `alloy_smelter`, `sag_mill` | 1 each |
| alloys | conductive / redstone / copper / energetic alloy ingots | 4 each |
| mid | `enderio:vibrant_alloy_ingot`, `double_layer_capacitor`, `soularium_ingot` (Nether), `ensouled_chassis`, `z_logic_controller` | 1–4 each |
| end | `enderio:octadic_capacitor`, `soul_binder`, `powered_spawner`, `end_steel_ingot` (the End) | 1–4 each |

**This is worth knowing:** a crafting lock on `enderio` does **not** stop Grains of Infinity, because the
legitimate route is a fire-crafting loot table, not a recipe. Locking `enderio` while leaving
Mystical Agriculture open removes the *essence* shortcut but leaves the bedrock ritual — which is correct
behaviour (it is a world interaction, like mining), and the first machine is still sealed.

**Handle:** whole namespace.

### Draconic Evolution — lock as `draconicevolution` (+ `brandonscore`, which ships no data)

| Step | Gate item | Routes | Needs |
|---|---|---|---|
| entry | `draconicevolution:draconium_ingot` | 5 (+ Mystical Agriculture essence) | deep Overworld / Nether / End ore |
| **the chokepoint** | `draconicevolution:draconium_core` | **1**, opens **60** recipes | |
| fusion | `draconicevolution:crafting_core` + `basic_crafting_injector` | 1 each | |
| Wyvern | `draconicevolution:wyvern_core` (1, 40 uses) | | **Wither** (Nether Star) |
| Awakened | `draconicevolution:awakened_draconium_ingot` (3) → `awakened_core` (1, 21 uses) | | **Ender Dragon** (`dragon_heart`, 0 recipes — a drop) |
| Chaotic | `draconicevolution:chaotic_core` (1, 15 uses) | | **Chaos Guardian** (`chaos_shard`) + Dragon Egg |
| reactor | `draconicevolution:energy_core`, `draconic_energy_core` | 1 each | |

Boss-gated, and therefore self-pacing. `draconicevolution:fusion_crafting` is its own recipe type (39
recipes) — all removed by a namespace lock.

**Handle:** split by item, not one namespace, because the ladder spans four tiers:
`items:['draconicevolution:draconium_ingot','draconicevolution:draconium_core', …]` early-late, then
`mods:['draconicevolution']` at the tier where the Wyvern tier opens, with the Chaotic items listed later
still. Note the engine's rule: an item in an **earlier** tier than its mod keeps its recipe, so
`items` + a later `mods` entry is exactly the shape this ladder wants.

### Extreme Reactors 2 — lock as `bigreactors` (mod id, not the jar name; `zerocore` ships no data)

| Step | Gate item | Routes |
|---|---|---|
| fuel | `bigreactors:yellorium_ingot` | **16**, from four jars, and it shares `forge:ingots/uranium` with Mekanism and IE uranium |
| moderator | `bigreactors:graphite_ingot` | 8 |
| **gate the machine, not the metal** | `bigreactors:basic_reactorcasing` (3 routes, 10 uses) and `basic_reactorcontroller` | |
| turbines | `bigreactors:cyanite_ingot` (4) — reactor waste → `basic_turbinecasing` | |
| reinforced | `bigreactors:reinforced_reactorcasing`, `reinforced_turbinecasing` | 4 each, need steel |
| end | `bigreactors:reprocessorcasing` → `blutonium_ingot` → `ludicrite` → `ridiculite` → `inanite` | 1–5 each |

**Handle:** whole namespace `bigreactors`. It also injects 4 compat recipes into `thermal`, which a
`thermal` lock catches and a `bigreactors` lock does not — harmless either way.

### RFTools — lock as `rftoolsbase`, `rftoolsutility`, `rftoolsbuilder`, `rftoolsdim` (`mcjtylib` ships no data)

| Step | Gate item | Routes |
|---|---|---|
| entry | `rftoolsbase:dimensionalshard` | 1 |
| **the chokepoint** | `rftoolsbase:machine_frame` | **1**, opens **30** recipes across all four jars |
| | `rftoolsbase:machine_base` (1, 14 uses), `infused_diamond`, `infused_enderpearl` | |
| utility | `rftoolsutility:crafter1`, `screen`, `matter_transmitter`, `dialing_device` | 1 each |
| builder | `rftoolsbuilder:builder`, `shape_card_quarry` | 1 / 2 |
| **end** | `rftoolsdim:dimension_builder`, `enscriber`, `empty_dimlet` | 1 each |

`rftoolsbuilder:shape_card_quarry` is a **quarry in a card** — an ore-multiplication-adjacent power jump;
it belongs no earlier than the tier that opens serious power. `rftoolsdim` is end-game.

**Handle:** `rftoolsbase` + `rftoolsutility` + `rftoolsbuilder` in one mid tier, `rftoolsdim` late.

### Modular Powersuits — lock as `powersuits` and `numina`

`numina:component_control_circuit` is **1 recipe opening 52**, and `numina:component_wiring` **1 opening
53** — the tightest pair of chokepoints in the pack. Battery ladder: `numina:battery_basic` (needs steel)
→ `battery_advanced` → `battery_elite` → `battery_ultimate` (needs Thermal electrum).
`powersuits:tinkertable` → `powerarmor_torso` / `powerfist` → modules.

**Needs from outside:** steel (Mekanism or IE) and electrum (Thermal). So Modular Powersuits cannot open
before whichever tier gives steel. Note the known in-game bug: Numina ships its language file as
`us_en.json`, so component names may show as raw keys.

**Handle:** both namespaces in one tier, after steel.

### Blue Power — lock as `bluepower`, or leave it out

368 outputs, but `PROGRESSION_MODS.md` records that in this alpha build only 2 of its 23 logic gates are
craftable and red alloy wire, tubes and the sorting machine have no recipes. Its metals
(`bluepower:silver_ingot` 12 routes, `brass_ingot` 7, `tungsten_ingot` 12) **do** share `forge:` tags with
Thermal and IE, so it is a quiet ore-and-alloy source. See pass 3.

**Handle:** one late-ish tier entry for `bluepower`, mainly to stop it being a free silver/brass source
before Thermal opens. Not worth a tier of its own.

### Extra Utilities Reborn — lock as `extrautilitiesreborn`

Survival/Furnace Generator → `extrautilitiesreborn:machine_block` (1, 3 uses) → Resonator + Enchanter →
`redstone_crystal` (1, 11 uses) → `ender_infused_obsidian` → **Ender Quarry** → Rainbow Generator (needs
one of every generator). `angel_block` and `golden_bag_of_holding` are strong QoL. The **Ender Quarry** is
an ore-multiplication-adjacent item and belongs late.

**Handle:** whole namespace, mid-to-late; or `items:['extrautilitiesreborn:angel_block']` earlier if you
want the building block without the machines.

---

## Magic mods

### Botania — lock as `botania`

| Step | Gate item | Routes |
|---|---|---|
| entry | `botania:lexicon`, `apothecary_default`, `pure_daisy` | 1 each |
| **the chokepoint** | `botania:livingrock` | **2** (Pure Daisy; the shaped recipe just rejoins slabs) — **50 uses** |
| mana | `botania:endoflame`, `mana_spreader`, `mana_pool` | 1 each |
| infusion | `botania:manasteel_ingot` (6), `mana_pearl`, `mana_diamond` | |
| runes | `botania:runic_altar` (2) → the five elemental runes (1 each) | |
| **Terrasteel** | `botania:terra_plate` (1) → `botania:terrasteel_ingot` | **4** routes incl. Mystical Agriculture essence |
| Alfheim | `botania:alfheim_portal` + `natura_pylon` → `elementium_ingot` (4), `pixie_dust`, `dragonstone` | trade-only portal |
| end | `botania:gaia_pylon` → **Gaia Guardian** → `botania:life_essence` (**0 recipes — a boss drop**) → `gaia_ingot`, `flight_tiara` | needs a Beacon → needs a **Nether Star** |

`botania:orechid` (16 recipes) and `orechid_ignem` (3) are ore generation — pass 3.

**Handle:** whole namespace, split in two tiers if you want the Pure-Daisy/mana start early and
Terrasteel+ later: `items:['botania:lexicon','botania:apothecary_default','botania:pure_daisy','botania:livingwood_log','botania:livingrock','botania:endoflame','botania:mana_spreader','botania:mana_pool','botania:twig_wand']`
in the earlier tier, `mods:['botania']` in the later one. Gaia Spirit is a drop, so the Gaia tier paces
itself; what the lock buys you is the *gear made from it*.

### Mystical Agriculture — lock as `mysticalagriculture` (+ `cucumber`, which owns recipe types but no items)

| Step | Gate item | Routes |
|---|---|---|
| entry | `mysticalagriculture:inferium_essence`, `prosperity_shard`, `inferium_seeds` | 5 / 2 / 2 |
| **the chokepoint** | `mysticalagriculture:infusion_crystal` | **1**, and it is what upgrades essence tiers |
| **the other one** | `mysticalagriculture:infusion_altar` + `infusion_pedestal` | 1 each — **all resource seeds are made here** |
| tiers | prudentium → tertium → imperium → supremium essence | 2–3 each |
| mob seeds | `mysticalagriculture:soulium_ingot` (Nether) + `soul_jar` + `soulium_dagger` | 1–3 each |
| end | `master_infusion_crystal`, `awakening_altar`, `awakened_supremium_essence`; `cognizant_dust` is **0 recipes** (Wither/Dragon kill with an enlightened weapon) | |

**This is the pack's single biggest bypass.** The index shows Mystical Agriculture producing items in
**26 namespaces** and 192 `mysticalagriculture:infusion` recipes. Pass 3 enumerates every essence recipe
that makes another mod's gate item.

**Handle:** `mysticalagriculture` must open **no earlier than** the latest tier of anything its essences
can make — or its cross-mod essence recipes must be removed by id. Both options are set out in pass 3; the
proposal uses the recipe-id list, because the mod itself is a fine early-game farming mod and the Potato
Tithe relic wants it.

### Ars Nouveau — lock as `ars_nouveau` (new in Part II; no old-pack doc, read entirely from the jar)

| Step | Gate item | Recipe | Notes |
|---|---|---|---|
| entry | `ars_nouveau:novice_spell_book` | shapeless: book + iron shovel/pickaxe/axe/sword | day one, no magic needed |
| glyphs | `ars_nouveau:scribes_table` | archwood slab + gold nuggets + `#forge:logs/archwood` | archwood is worldgen |
| source | `ars_nouveau:imbuement_chamber` | archwood planks + gold | |
| | `ars_nouveau:source_gem` | `ars_nouveau:imbuement` from **amethyst shard** or `#forge:gems/lapis` | two cheap routes |
| | `ars_nouveau:sourcestone` → `arcane_core`, `arcane_pedestal` | sourcestone + gold + source gem | |
| **the chokepoint** | `ars_nouveau:enchanting_apparatus` | sourcestone + `#forge:gems/diamond` + gold | **75 `ars_nouveau:enchanting_apparatus` recipes** hang off it: all armour, all threads, all familiar charms, the Dominion Wand, the storage lectern |
| automation | `agronomic_sourcelink`, `alchemical_sourcelink`, `mycelial_sourcelink`, relays | 1 each | |
| **book tier 2** | `ars_nouveau:apprentice_spell_book` | `ars_nouveau:book_upgrade`: novice book + obsidian + diamond + quartz block + **blaze rod** | Nether gate |
| **book tier 3** | `ars_nouveau:archmage_spell_book` | apprentice book + **`minecraft:nether_star`** + **`ars_nouveau:wilden_tribute`** + emerald + ender pearl + **totem of undying** | Wither **and** the Wilden Chimera |
| familiars | `drygmy_charm`, `starbuncle_charm`, `whirlisprig_charm`, `wixie_charm` | apparatus, from the matching shard (a mob drop) | **the Drygmy is a bypass — pass 3** |
| armour | sorcerer / arcanist / battlemage sets + 22 `thread_*` | apparatus | |
| ritual | `ars_nouveau:ritual_awakening` | archwood logs/saplings + `#forge:gems/source` | |

Ars Nouveau's own progression is already three-staged by the Nether and the Nether Star, which maps
neatly onto the middle and late tiers.

**Handle:** whole namespace `ars_nouveau`, with the entry kept early if you want it as a starter mod:
`items:['ars_nouveau:novice_spell_book','ars_nouveau:scribes_table','ars_nouveau:imbuement_chamber']`.
The Archmage book needs no lock at all — a Nether Star and a Chimera trophy are gate enough.

### EvilCraft — lock as `evilcraft` (+ `evilcraftcompat`, 0 items; `cyclopscore` ships no data)

`evilcraft:dark_gem` (1, 19 uses) → `blood_extractor` + `dark_spike` → **`evilcraft:dark_power_gem`**
(2 routes, 9 uses) → `hardened_blood_shard` → `blood_infusion_core` (1, 11 uses) → `blood_infuser` →
Promises of Tenacity I/II/III → `spirit_furnace` (Dark Blood Bricks), `spirit_reanimator` → end game
`evilcraft:garmonbozia` → `sanguinary_environmental_accumulator`, `mace_of_destruction`.
`evilcraft:box_of_eternal_closure` is **0 recipes** (Dark Temple loot).
`evilcraft:blood_infuser` is its own recipe type (37 recipes).

**Story note:** the **Chalice of Blood** relic wants 1,000 buckets of EvilCraft blood, so EvilCraft must
open early enough for that grind to fit — the Blood Extractor is the item that matters, not the end game.

**Handle:** `items:['evilcraft:dark_gem','evilcraft:dark_spike','evilcraft:blood_extractor']` early (for
the relic), `mods:['evilcraft']` mid.

### Hexerei — lock as `hexerei`

One short ladder: `hexerei:mixing_cauldron` (1) → `hexerei:blood_bottle` (1, 4 uses) → `willow_broom`
(gold) → `witch_hazel_broom` (diamond) → `mahogany_broom` (netherite) → `broom_netherite_tip`.
980 outputs, but **1,066 of the pack's recipes are `hexerei:woodcutting`** — almost all of Hexerei's
output count is wood and decoration. Its logs (`willow_log`, `witch_hazel_log`, `mahogany_log`) and
`mandrake_root`, `sage_seed`, `selenite_shard` are **0 recipes** — worldgen.

**Handle:** item list, not the namespace — locking `hexerei` would take out a whole wood set. Lock
`items: ['hexerei:blood_bottle','hexerei:willow_broom','hexerei:witch_hazel_broom','hexerei:mahogany_broom','hexerei:broom_netherite_tip']`
and leave the wood and candles open. Brooms are flight, so they belong mid-to-late.

---

## Equipment and exploration mods

### Tinkers' Construct + TAIGA + TCIntegrations + Tinkers' Rapier + Levelling Addon

Namespaces: `tconstruct` (2,981 outputs), `taiga` (467), `tcintegrations` (205), `tinker_rapier` (13);
`mantle` and `tinkerslevellingaddon` ship no items.

**The ladder (TConstruct):** `tconstruct:pattern` → `part_builder` + `tinker_station` → `grout` →
`seared_brick` (5, 29 uses) → `seared_melter` → `smeltery_controller` → mid-game alloys (slimesteel,
amethyst bronze, rose gold, pig iron; 10–13 routes each) → `tinkers_anvil` → **Nether**:
`tconstruct:cobalt_ingot` (**16 routes**) + `nether_grout` → `scorched_brick` → `foundry_controller` →
end game Manyullyn / Hepatizon / Queen's Slime (needs Blazing Blood).

**The ladder (TAIGA)** — read entirely from the jar, no old-pack doc:

| Dimension | Base ores (melt in the smeltery, 17 `taiga:melting/*_ore` recipes) |
|---|---|
| Overworld | karmesine, ovium, jauxum, dilithium, eezo, vibranium, + `taiga:meteor` |
| Nether | tiberium, prometheum, osram, valyrium |
| End | abyssum, aurorium, palladium, + `taiga:end_deposit` |
| other | duranite, uru, basalt, magma, obsidiorite, meteorite (block-derived) |

Then **28 `tconstruct:alloy` recipes**, and TAIGA numbers them in tier order in the recipe id — which is a
gift for tiering:

```
00_terrax  01/02_triberium  03_fractum  04_violium  05_proxii  06_tritonite  07_ignitz
08_imperomite  09_solarium  10_adamant  11_nihilite  12_seismum  13_astrium  14_niob
15/16/17_yrdeen  18/19_iox  20_lumix  21_obsidiorite  22/23/24_nucleum  25/26_dyonite  27_nitronite
```

The deepest ones (`09_solarium`, `10_adamant`, `11_nihilite`, `18/19_iox`, `25/26_dyonite`) chain through
three or four earlier alloys plus End ores, so they are genuinely end-game. The repo already overrides
`taiga:worldgen/placed_feature/eezo_ore.json`, so eezo placement has been tuned once already.

**TCIntegrations** adds other mods' metals as Tinkers materials, including **Ice and Fire dragonsteel**
(`tcintegrations:dragonsteel_fire/ice/lightning`), **Botania manasteel** and `livingwood`, plus `brass`,
`calorite`, `desh`, `neptunium`, `ostrum`, `soul_stained_steel`. So Tinkers is a back door into dragon and
mana materials — and a tool made of `tcintegrations:dragonsteel_fire` is NBT, not an item id.

**Tinkers' Rapier** adds one tool and its casts (13 outputs, `tinker_rapier:tools/parts/builder/*`).

**The material problem.** A Tinkers tool is `tconstruct:pickaxe` with the material in NBT, so no item id
can gate a material. The handles are **recipe ids**, and they are regular:

| Pattern | Count | What it does |
|---|---|---|
| `tconstruct:tools/materials/casting/<material>` | 39 | cast a tool part from the molten metal |
| `tconstruct:tools/materials/composite/<material>` | ~20 | composite casting |
| `tconstruct:tools/materials/melting/<material>` | 39 | melt a part back |
| `tconstruct:tools/materials/<material>/*` | 3 each | the `tconstruct:material` stat definitions |
| `tconstruct:tools/parts/builder/*` | 25 | Part Builder parts |
| `taiga:materials/<material>_casting` | 30 | TAIGA material casting |
| `taiga:materials/*` | 90 | TAIGA material definitions |
| `taiga:alloy/NN_<alloy>` | 28 | the alloy tree, tier-numbered |
| `tcintegrations:tools/materials/casting/<material>` | 10 | dragonsteel, manasteel, … |
| `tcintegrations:tools/materials/<material>/*` | 3 each | definitions |
| `tinker_rapier:tools/parts/builder/*`, `tinker_rapier:smeltery/casts/*` | 5 | the rapier |

Pass 3 turns these into the explicit `recipes:` list the brief asks for.

**Handle:** never lock `tconstruct` as a namespace — it would remove 2,981 outputs including seared
bricks, the smeltery and every compat melt the pack depends on. Lock by **item** for the blocks
(`foundry_controller`, `scorched_alloyer`, the Nether tier) and by **recipe id** for materials. `taiga`
*can* be locked as a namespace: everything it ships is a progression metal.

### Ice and Fire — lock as `iceandfire` (new in Part II; read entirely from the jar)

Everything above the entry gates on killing a dragon, which paces itself:

| Step | Gate item | Needs |
|---|---|---|
| entry | bestiary, copper/silver tools, `iceandfire:armor_*` from scales | scales (dragon drop) |
| forge | `iceandfire:dragonforge_fire_brick` ← stone bricks + `#forge:storage_blocks/scales/dragon/fire` | 9 scales per block |
| forge core | `iceandfire:dragonforge_fire_core_disabled` ← brick + **`iceandfire:fire_dragon_heart`** | a dragon heart |
| **the material** | `iceandfire:dragonsteel_fire_ingot` ← `iceandfire:dragonforge` recipe: `#forge:ingots/iron` + **`iceandfire:fire_dragon_blood`** | ×3 (fire / ice / lightning) |
| gear | `dragonsteel_*` armour and dragon armour from `dragonsteel_*_block` | |
| bone gear | `iceandfire:dragonbone` ← `dragon_bone_block`; `dragonbone_sword` + blood → elemental swords | `#forge:bones/wither` |
| other bosses | `deathworm_gauntlet_*`, `cockatrice_scepter`, myrmex, siren, hippogryph gear | mob drops |

`iceandfire:dragonforge` is its own recipe type (**3 recipes**) — the three dragonsteel ingots. Removing
those three recipes alone seals all of dragonsteel.

**Handle:** whole namespace `iceandfire` is safe (it ships no wood set the player needs) — but if you want
dragon hunting available early as a *fight*, lock by item:
`items:['iceandfire:dragonforge_fire_core_disabled', … , 'iceandfire:dragonsteel_fire_ingot', …]` and leave
the scale armour craftable. See the proposal.

### Twilight Forest — **never lock the namespace** (owner decision: TF is open from the start)

Confirmed from the jar: 444 recipes, 532 loot tables, 321 advancements. Its own
`tfEnforcedProgression` gamerule is the gate, and the Uncrafting Table is already off in
`tools/serverconfig/twilightforest-common.toml` (`twilightforest:uncrafting` — 2 recipes — is therefore
dead).

A namespace lock would remove TF planks, doors, chests, boats, banisters and 3,401-worth of stonecutting
for players already inside the dimension. So the handle is an **item list**. From the jar, the craftable
gear and materials — everything else TF gives is a drop or chest loot:

```
ironwood:    ironwood_ingot ironwood_helmet ironwood_leggings ironwood_boots
             ironwood_sword ironwood_pickaxe ironwood_axe ironwood_shovel ironwood_hoe
steeleaf:    steeleaf_ingot steeleaf_helmet steeleaf_leggings steeleaf_boots
             steeleaf_sword steeleaf_pickaxe steeleaf_axe steeleaf_shovel steeleaf_hoe
knightmetal: knightmetal_ingot armor_shard_cluster knightmetal_helmet knightmetal_leggings
             knightmetal_boots knightmetal_sword knightmetal_axe knightmetal_pickaxe
             knightmetal_ring knightmetal_shield block_and_chain
fiery:       fiery_ingot fiery_helmet fiery_leggings fiery_boots fiery_sword fiery_pickaxe
yeti/arctic: yeti_helmet yeti_leggings yeti_boots arctic_fur arctic_helmet arctic_leggings arctic_boots
naga:        naga_leggings
carminite:   carminite carminite_reactor carminite_builder
maps/charms: magic_map magic_map_focus maze_map ore_map
             charm_of_keeping_2 charm_of_keeping_3 charm_of_life_2
scepters:    twilight_scepter zombie_scepter lifedrain_scepter fortification_scepter
giant:       giant_sword giant_pickaxe
devices:     encased_fire_jet encased_smoker cicada_jar firefly_jar
```

**Checked and harmless:** `twilightforest:crumble_horn` (36 recipes) converts only vanilla and TF
decorative blocks (stone↔gravel, copper oxidation stages, cracked bricks) — no sealed item.
`twilightforest:transformation_powder` (16) converts **mobs only** (vanilla ↔ TF passive and hostile
mobs, e.g. ghast ↔ carminite_ghastguard). Neither is a bypass.

**Still to decide (config, not recipes):** the magic tree cores. `disableTimeCore` and friends are the
only lever; the Timewood Core accelerates machines from any mod within 8 blocks, which can outrun a tier.
Recommendation and trade-off are in the proposal.

### Alex's Caves — lock as `alexscaves`

No crafting ladder to speak of: the **Spelunkery Table** has no recipe at all (only
`alexscaves:blocks/spelunkery_table`, a block loot table — you find it in an Underground Cabin), and Cave
Tablets, the Cave Codex and the Cave Biome Map come from `alexscaves:cave_map`, its own recipe type
(1 recipe). What **is** craftable, and therefore lockable, is the gear:

`alexscaves:galena_gauntlet`, `quarry`, `quarry_smasher`, `nuclear_furnace_component`,
`conversion_crucible`, `hazmat_helmet/chestplate/leggings/boots`, `raygun`, `dreadbow`,
`totem_of_possession`, `sack_of_sating`, `ominous_catalyst`, `extinction_spear`, `frostmint_spear`,
`limestone_spear`, `nuclear_bomb`, `tremorzilla_egg`.

**`alexscaves:quarry` (the Magnetic Quarry) and `alexscaves:nuclear_bomb` are the two that matter** — one
is ore automation, one is a grief weapon on a troll server.

**Handle:** item list for the gear, with `quarry` and `nuclear_bomb` late. Locking the whole namespace
would also remove its many building blocks, which are harmless and fun.

### Reliquary, Mowzie's Mobs, Alex's Mobs

- **Reliquary** (`reliquary`, 141 outputs): a flat mob-drop grind. `reliquary:alkahestry_tome` (1) is the
  gate; `witch_hat` is 0 recipes. Mid-game at most. `reliquary:handgun` is a ranged-weapon jump.
- **Mowzie's Mobs** (`mowziesmobs`, **8 outputs**): no ladder. Boss drops only. Nothing worth a tier.
- **Alex's Mobs** (`alexsmobs`, 79 outputs): mob-drop gear. The one item that matters is the
  **Tarantula Hawk Elytra** (needs a vanilla Elytra) and the `alexsmobs:dimensional_carver` (Void Worm +
  netherite). `alexsdelight` writes into the `alexsmobs` namespace.

**Handle:** leave `mowziesmobs` unlocked. `alexsmobs` by item for the elytra and carver; `reliquary` as a
namespace, mid.

### AgriCraft

`agricraft` has only **13 craftable outputs**: crop sticks, iron crop sticks, the seed analyzer, the
magnifying glass. Its whole progression is in-world cross-breeding. Resource crops need the ore block
under the soil, so they cannot outrun ore access. The **Potato Tithe** relic wants AgriCraft open early.

**Handle:** leave unlocked, or at most `items:['agricraft:iron_crop_sticks']` for the stat ceiling.

---

## What this pass found that changes the plan

1. **Thermal is one namespace, `thermal`, for five jars** — and its Machine Frame / RF Coil / Redstone
   Servo / Integral Components have **no recipe in the shipped data at all**. Flagged, needs a JEI check.
2. **Ender IO's Grains of Infinity has no real recipe either** — the only craft-table route in the pack is
   Mystical Agriculture's essence. The legitimate route is a loot-table fire ritual.
3. **Mystical Agriculture outputs items in 26 namespaces; TConstruct in 21.** Namespace locks on *those two*
   do far more than lock their own mods, and item locks on other mods' metals do far less than they look.
4. **Twilight Forest, Hexerei, Create Deco and TConstruct must be locked by item, never by namespace** —
   each ships a wood set, a decoration set or compat recipes the rest of the pack needs.
5. **TAIGA numbers its alloy tree 00–27 in its recipe ids**, and its base ores split cleanly by dimension.
   That is the tidiest tiering handle in the pack.
6. **`createdeco` (1,727 outputs), `mowziesmobs` (8), `agricraft` (13), `mekanismcurios` (0) and the 64
   data-less jars need no tier.**
