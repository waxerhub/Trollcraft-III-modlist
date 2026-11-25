# Pass 3 — Bypasses, loot leaks and recipe-id levers

Every route checked against the pass-1 index, with the recipe ids that make it work. A route is a
**bypass** when an *open* mod can produce a *sealed* mod's gate item; it is a **leak** when loot, a trade
or a mob drop hands a player a sealed item; it is a **pace jump** when nothing is bypassed but a tier's
intended grind collapses.

The master query behind most of this is the cross-mod production matrix: for every jar, which foreign
item namespaces it can output. Reproduce it with
`bash research/tools/q.sh makes <item>` on any item, or re-derive the whole matrix from
`research/index/by_output_resolved.tsv` (columns: output, via_tag, recipe_id, type, jar).

---

## 1. Mystical Agriculture — the biggest bypass in the pack

`MysticalAgriculture-1.20.1-7.0.24` produces items in **26 namespaces** through **312
`mysticalagriculture:essence/*` recipes** and **192 `mysticalagriculture:infusion` seed recipes**. It
makes, among others, **every AE2 Inscriber press**, **Terrasteel**, **Elementium**, **Manasteel**,
**Refined Obsidian**, **Draconium**, **Grains of Infinity**, **End Steel**, **Manyullyn**, **Hepatizon**,
**Queen's Slime**, **Cobalt**, and **all four Twilight Forest boss metals**.

### Cross-mod essence recipes, by target (mods that are actually in the pack)

| Target | Recipe ids (`mysticalagriculture:essence/…`) | Why it matters |
|---|---|---|
| **AE2** (9) | `appliedenergistics2/silicon_press`, `logic_press`, `calculation_press`, `engineering_press`, `certus_quartz`, `certus_quartz_dust`, `fluix`, `fluix_dust`, `sky_stone` | **skips the meteorite entirely** — all four presses from essence |
| **Botania** (19) | `botania/terrasteel_ingot`, `elementium_ingot`, `manasteel_ingot`, + 16 `*_mystical_flower` | **skips the Terra Plate, the Alfheim portal and 500k mana per ingot** |
| **Ender IO** (10) | `enderio/grains_of_infinity`, `dark_steel_ingot`, `end_steel_ingot`, `conductive_alloy_ingot`, `copper_alloy_ingot`, `energetic_alloy_ingot`, `pulsating_alloy_ingot`, `redstone_alloy_ingot`, `soularium_ingot`, `vibrant_alloy_ingot` | skips the bedrock fire ritual, the Nether and the End |
| **Tinkers** (8) | `tconstruct/cobalt_ingot`, `manyullyn_ingot`, `hepatizon_ingot`, `queens_slime_ingot`, `slimesteel_ingot`, `amethyst_bronze_ingot`, `pig_iron_ingot`, `rose_gold_ingot` | **skips the Nether, the foundry and Blazing Blood** |
| **Twilight Forest** (4) | `twilightforest/fiery_ingot`, `ironwood_ingot`, `knightmetal_ingot`, `steeleaf_ingot` | **skips the Hydra, the Labyrinth, the Stronghold and the Dark Tower** |
| **Mekanism** (4) | `mekanism/refined_obsidian_ingot`, `osmium_ingot`, `refined_glowstone_ingot`, `fluorite` | skips the 5× gate |
| **Thermal** (6) | `thermal/signalum_ingot`, `lumium_ingot`, `enderium_ingot`, `basalz_rod`, `blitz_rod`, `blizz_rod` | skips the mid-game alloys and the elemental mobs |
| **Draconic** (1) | `draconicevolution/draconium_ingot` | skips deep-ore mining |
| **Extreme Reactors** (2) | `extremereactors2/*` → `bigreactors:yellorium_ingot`, `graphite_ingot`, `cyanite_ingot` | **Cyanite is meant to be reactor waste** |
| **Redstone Arsenal** (2) | `redstone_arsenal/flux_ingot`, `flux_gem` | |
| **IE** (1) | `immersiveengineering/hop_graphite_ingot` | |
| **Create** (5), **Chisel** (3) | `create/asurine`, `crimsite`, `limestone`, `ochrum`, `veridium`; `chisel/*` | decorative only — harmless |

Plus 25 `essence/common/*` and 4 `essence/gems/*` recipes that output **`#forge:` tags**, so they land on
whichever mod owns the tag: `steel_ingot`, `electrum_ingot`, `silver_ingot`, `tin_ingot`, `lead_ingot`,
`nickel_ingot`, `bronze_ingot`, `brass_ingot`, `invar_ingot`, `constantan_ingot`, `aluminum_ingot`,
`uranium_ingot`, `zinc_ingot`, `tungsten_ingot`, `graphite_ingot`, `silicon`, `sulfur`, `saltpeter`,
`niter`, `rubber`, `ruby`, `sapphire`, `peridot`, `apatite`, plus `chrome`, `iridium`, `mithril`,
`platinum`, `titanium` (no owner in this pack — inert).

And 194 `essence/minecraft/*` recipes, including `essence/minecraft/netherite_ingot`.

### The seeds behind them

`mysticalagriculture:seed/infusion/<x>` exists for every one of those materials:
`cobalt manyullyn hepatizon queens_slime slimesteel pig_iron rose_gold amethyst_bronze terrasteel
elementium manasteel draconium refined_obsidian refined_glowstone osmium fluorite dark_steel end_steel
grains_of_infinity soularium conductive_alloy copper_alloy energetic_alloy pulsating_alloy redstone_alloy
vibrant_alloy enderium lumium signalum flux_infused_ingot flux_infused_gem yellorium cyanite graphite
hop_graphite fiery_ingot ironwood knightmetal steeleaf certus_quartz fluix sky_stone silicon netherite
steel electrum silver tin lead nickel bronze brass invar constantan aluminum uranium zinc tungsten` …

### How it's closed

Two options. The proposal uses **(b)**.

**(a) Blunt:** put `mysticalagriculture` in the *last* tier that any of those materials belongs to.
Costs you the mod as an early farming mod, and breaks the **Potato Tithe** relic (which wants farming
automation early).

**(b) Surgical, by recipe id** — remove the cross-mod essence and seed recipes, keep the vanilla ones:

```js
// cross-mod essence recipes (every mod in the pack whose gate items it can make)
/^mysticalagriculture:essence\/(appliedenergistics2|botania|enderio|mekanism|tconstruct|thermal|immersiveengineering|draconicevolution|extremereactors2|redstone_arsenal|twilightforest)\//
// the shared-metal essence recipes
/^mysticalagriculture:essence\/common\/(steel|electrum|silver|tin|lead|nickel|bronze|brass|invar|constantan|aluminum|uranium|zinc|tungsten|graphite|silicon)_?(ingot)?$/
// netherite
mysticalagriculture:essence/minecraft/netherite_ingot
// and the matching resource seeds
/^mysticalagriculture:seed\/infusion\/(cobalt|manyullyn|hepatizon|queens_slime|slimesteel|pig_iron|rose_gold|amethyst_bronze|terrasteel|elementium|manasteel|draconium|refined_obsidian|refined_glowstone|osmium|fluorite|dark_steel|end_steel|grains_of_infinity|soularium|conductive_alloy|copper_alloy|energetic_alloy|pulsating_alloy|redstone_alloy|vibrant_alloy|enderium|lumium|signalum|flux_infused_ingot|flux_infused_gem|yellorium|cyanite|graphite|hop_graphite|fiery_ingot|ironwood|knightmetal|steeleaf|certus_quartz|fluix|sky_stone|silicon|netherite|steel|electrum|silver|tin|lead|nickel|bronze|brass|invar|constantan|aluminum|uranium|zinc|tungsten)$/
```

Each of those materials then re-opens with **its own mod's tier**, so the list above is really a
per-tier list — see `TIER_PROPOSAL.md` §3.

### And one accelerant

`thermal_integration` ships **246 `thermal:insolator` recipes that grow Mystical Agriculture crops**
(`thermal:compat/mysticalagriculture/*`). The Phytogenic Insolator automates every essence seed without
farmland. Not a bypass by itself — but once both mods are open, essence production is effectively
unlimited, so the recipe-id removals above have to be in place before Thermal opens.

---

## 2. Tinkers' end-game alloys — four independent cross-mod routes each

This is the second-worst bypass, and it is invisible if you lock Tinkers by item.

| Alloy | Routes outside TConstruct |
|---|---|
| **Manyullyn** | `createaddition:compat/tconstruct/manyullyn` (`create:mixing` — a Create **basin**) · `immersiveengineering:alloysmelter/manyullyn` · `immersiveengineering:arcfurnace/alloy_manyullyn` · `immersiveengineering:arcfurnace/dust_manyullyn` · `thermal:compat/tconstruct/smelter_alloy_tconstruct_manyullyn_ingot` (Induction Smelter) · `mysticalagriculture:essence/tconstruct/manyullyn_ingot` |
| **Hepatizon** | `createaddition:compat/tconstruct/hepatizon` · `thermal:compat/tconstruct/smelter_alloy_tconstruct_hepatizon_ingot` · MA essence |
| **Queen's Slime** | `createaddition:compat/tconstruct/queens_slime` · `thermal:compat/tconstruct/smelter_alloy_tconstruct_queens_slime_ingot` · MA essence |
| **Slimesteel** | `createaddition:compat/tconstruct/slimesteel` · `thermal:compat/tconstruct/smelter_alloy_tconstruct_slimesteel_ingot` · MA essence |
| **Rose Gold / Amethyst Bronze / Pig Iron / Tinkers Bronze** | `createaddition:compat/tconstruct/*` (`create:mixing`) · `thermal:compat/tconstruct/*` · `immersiveengineering:alloysmelter/rose_gold` · MA essence |
| **Cobalt** | `immersiveengineering:arcfurnace/{ore,raw_ore,raw_block,dust}_cobalt` · `thermal:compat/tconstruct/smelter_tconstruct_{cobalt_ore,raw_cobalt}` · `thermal:compat/tconstruct/chiller_tconstruct_cobalt_ingot` · MA essence |
| **Cinderslime** | **clean** — TConstruct only |

**The Axe of Peace relic** wants "a Tinkers broad axe with a Manyullyn or Hepatizon head". Create's
Mechanical Mixer can make Manyullyn without ever entering the Nether, so if Create opens before Tinkers'
Nether tier, that relic's grind is gone.

**How it's closed.** The product-side locks (`items: ['tconstruct:manyullyn_ingot', …]`) remove *all* of
these, because `event.remove({ output: 'tconstruct:manyullyn_ingot' })` matches by output item regardless
of which jar owns the recipe. This is the one case where **item locks are stronger than namespace locks**
and should be preferred.

### What is *not* a bypass (checked and cleared)

- **`tconstruct:smeltery/casting/fiery/ingot`** needs the fluid `tconstruct:fiery_liquid`, and **nothing
  in the pack produces that fluid except melting existing fiery gear**
  (`tconstruct:smeltery/melting/fiery/twilightforest_*`). The smeltery can only recycle TF fiery gear, not
  create it. Same for `molten_knightmetal` and `molten_steeleaf` — melting-only.
- **`tcintegrations:smeltery/casting/metal/dragonsteel_*/ingot_*_cast`** needs molten dragonsteel, which
  comes only from melting dragonsteel. Dragon kills are still required.
- `tconstruct:smeltery/casting/metal/<x>/*` for Mekanism, Bluepower and Botania targets only produce
  **ingots/blocks/nuggets of metals that already exist** — pack-plumbing, not creation.

---

## 3. Tinkers material gating — the recipe-id levers

A Tinkers tool is `tconstruct:pickaxe` with the material in NBT, so **no item id can gate a material**.
The levers are recipe ids, and they follow four regular patterns. For a material `<m>`, removing these
seals it completely:

| Pattern | What it is | Count in pack |
|---|---|---|
| `tconstruct:tools/materials/<m>/{ingot,nugget,block}` | **Part Builder** — the item→material mapping | 3 per material |
| `tconstruct:tools/materials/casting/<m>` | **Casting Table** — molten metal → material part | 39 |
| `tconstruct:tools/materials/composite/<m>` | composite casting onto another material | ~20 |
| `tconstruct:tools/materials/melting/<m>` | melt a part back (close it too, or parts launder) | 39 |
| `tcintegrations:tools/materials/<m>/{ingot,nugget,block}` + `tcintegrations:tools/materials/{casting,melting}/<m>` | the same, for cross-mod materials | 10 + 10 + 30 |
| `taiga:materials/<m>_{ingot,nugget,block}` + `taiga:materials/<m>_casting` + `taiga:materials/<m>_melting` | the same, for TAIGA | 90 + 30 + 30 |
| `taiga:alloy/NN_<alloy>` | the TAIGA alloy tree, **numbered 00–27 in tier order** | 28 |
| `tconstruct:smeltery/alloys/molten_<x>` | TConstruct's own alloying | 22 |
| `tinker_rapier:tools/parts/builder/*`, `tinker_rapier:smeltery/casts/{sand,red_sand}/builder_{block,cast}/*` | the rapier part and its casts | 5 |

A single regex per material does it:

```js
// e.g. seal Manyullyn as a Tinkers material
/^tconstruct:tools\/materials\/(manyullyn\/|casting\/manyullyn$|composite\/manyullyn$|melting\/manyullyn$)/
// e.g. seal every TAIGA material at once
/^taiga:(materials|alloy)\//
```

The per-tier lists are in `TIER_PROPOSAL.md` §3.

**Materials that exist in this pack** (so that nothing is missed):

- TConstruct tier-1/2: `iron gold copper bronze amethyst_bronze rose_gold pig_iron slimesteel invar
  constantan electrum silver lead aluminum osmium steel pewter`
- TConstruct Nether/end: `cobalt hepatizon manyullyn queens_slime cinderslime necronium blazing_bone
  blazewood ancient`
- TConstruct non-metal: `wood(11 logs + planks + bamboo) rock(6) flint(3) bone necrotic_bone obsidian
  glass quartz ice(3) slimeball(4) slimewood(4 woods) enderslime earthslime skyslime ichor leather
  string wool(16) paper feather gunpowder prismarine shulker endstone end_rod chorus_popped cactus
  magma magnetite blaze phantom_membrane rabbit_hide leaves vine(3) treated_wood nahuatl venombone
  darkthread knightly **dragon_scale**`
- From other mods: `fiery ironwood knightmetal steeleaf` (Twilight Forest) ·
  `tcintegrations:{brass,calorite,desh,neptunium,ostrum,soul_stained_steel,manasteel,manastring,
  livingwood,livingrock,dragonsteel_fire,dragonsteel_ice,dragonsteel_lightning}`
- TAIGA (30): base `karmesine ovium jauxum tiberium dilithium aurorium duranite prometheum palladium
  eezo abyssum osram uru valyrium vibranium basalt meteorite obsidiorite` · alloys `terrax triberium
  fractum violium proxii tritonite ignitz imperomite solarium adamant nihilite seismum astrium niob
  yrdeen iox lumix nucleum dyonite nitronite`

TAIGA's base ores split by dimension — Overworld: karmesine, ovium, jauxum, dilithium, eezo, vibranium,
`taiga:meteor`; Nether: tiberium, prometheum, osram, valyrium; End: abyssum, aurorium, palladium,
`taiga:end_deposit`. That is the natural tiering: Overworld base → Nether base → End base → alloys
00–13 → alloys 14–27.

---

## 4. Ore multiplication and ore creation

Nothing here bypasses a *tier*, but several routes collapse the mining grind, and two create ore from
nothing.

### Ore creation from renewable blocks — the ones that matter

| Route | Recipe id | Makes |
|---|---|---|
| **Botania Orechid Ignem** | `botania:orechid_ignem/ancient_debris` | **ancient debris from netherrack** — unlimited netherite with mana |
| Botania Orechid | `botania:orechid/*` (16) | all eight vanilla ores + deepslate variants, from stone/deepslate |
| **IE Excavator** | `immersiveengineering:mineral/ancient_debris`, `.../uraninite`, + 20 more veins | ancient debris and uranium at industrial scale |
| **Mekanism SPS/Nucleosynthesizer** | `mekanism:nucleosynthesizing/*` (20) | **`dragon_egg`**, **`wither_skeleton_skull`**, `end_crystal`, `diamond`, `emerald`, `trident`, `enchanted_golden_apple`, `heart_of_the_sea`, `nautilus_shell`, `respawn_anchor` |
| Mekanism | `mekanism:processing/netherite/dust_to_ancient_debris` (combining) | ancient debris from dust |
| **AgriCraft resource crops** | `agricraft:diamond`, `agricraft:netherite_scrap`, `agricraft:emerald`, `agricraft:amethyst_shard`, `agricraft:quartz`, `agricraft:coal`, `agricraft:copper_ingot` | needs the ore block under the soil, so **one** diamond block seeds unlimited diamonds |
| TF | `twilightforest:ore_magnet` (chest loot) | drags ore veins toward the player |

**`mekanism:nucleosynthesizing/wither_skeleton_skull` and `/dragon_egg` deserve a note of their own.**
Wither skulls → unlimited Nether Stars → the **Wither's Due** relic (8 Nether Stars) and Draconic's
Wyvern tier; `dragon_egg` is half of Draconic's **Chaotic** gate. Both need antimatter, which needs the
SPS, which needs a fission reactor — so they are tier-11/12 content in any sane ordering, and the
Nucleosynthesizer should not open before the Chaotic tier it would short-circuit.

### Multiplication (ore → more ingots)

Every one of these is removed with its mod's namespace; the figures are recipe counts, not yields:
`mekanism:enriching` 252, `mekanism:crushing` 312, `mekanism:purifying` 28, `mekanism:injecting` 76,
`mekanism:combining` 66 (the 2×→5× chain) · `create:crushing` 226, `create:milling` 241,
`create:splashing` 66 (crushing wheels) · `thermal:pulverizer` 102, `thermal:smelter` 108,
`thermal:centrifuge` 69 · `immersiveengineering:crusher` 108, `arc_furnace` 78 ·
`enderio:sag_milling` 65 · `tconstruct:ore_melting` 136 (the smeltery's 2× ore melting) ·
`bigreactors:reprocessor` 5 · `extrautilitiesreborn:ender_quarry` · `rftoolsbuilder:shape_card_quarry` ·
`alexscaves:quarry` (the Magnetic Quarry).

**Nether Ores Plus+** (`netheroresplus`) has 6 recipes, all of which **output `minecraft:` items** — its
Nether ore variants smelt to vanilla ingots. So `output:'@netheroresplus'` matches nothing; only
`{mod:'netheroresplus'}` bites. Worth leaving open: it is worldgen, not a ladder.

**AlmostUnified** ships **no `data/` at all.** Its tag unification happens at runtime from
`config/almostunified/`, where it can make a sealed mod's ingot interchangeable with an open one's by
rewriting recipe ingredients. **I cannot verify its behaviour from the jars** — see §9.

---

## 5. Autocrafting and autonomous machines

The engine removes recipes from the live recipe manager, so **autocrafting cannot craft a sealed
recipe**: AE2 patterns validate against the recipe, Create's Mechanical Crafters use the crafting-table
recipe, and Sequenced Assembly / machine recipes are themselves recipes. Checked:
`create:mechanical_crafting` 12, `create:sequenced_assembly` 13, `create:deploying` 112,
`create:item_application` 11, `ae2:inscriber` 24, `sliceanddice` (2 outputs),
`createappliedkinetics` (13 outputs, 16 of them `ae2:` ids).

The real hazard is the inverse, and it is §1 and §2: **an open mod's machine recipe whose output is a
sealed mod's item.** Two specific orderings to respect:

- **`createappliedkinetics` overrides `ae2:inscriber/silicon_press`** and the other press recipes. It
  must not open before AE2, or AE2's presses become craftable through Create's kinetics while `ae2` is
  still sealed. (Its recipe ids are in the **`ae2` namespace**, so `{mod:'ae2'}` does catch them — but
  `output:'@ae2'` is what you are relying on, and that holds too. Checked: safe either way, but keep the
  tiers in order.)
- **`thermal_integration` is the compat jar that makes everyone else's metals.** It outputs
  `mysticalagriculture` (246), `tconstruct` (49), `mekanism` (22), `create` (22),
  `immersiveengineering` (20), `redstone_arsenal` (6) items. Its recipe ids are all in the **`thermal`**
  namespace, so a `thermal` lock removes them; but if `thermal` opens before those mods, it is an open
  door. **`thermal` should open no earlier than Mekanism and Tinkers' mid tier.**

Other cross-mod producers, for completeness (jar → foreign namespace, distinct items):
`TConstruct → thermal 60, immersiveengineering 48, mekanism 24, bluepower 14, create 12,
createbigcannons 10, twilightforest 10, createaddition 8, botania 7, ceramics 10` ·
`ImmersiveEngineering → thermal 49, mekanism 26, bluepower 12, createaddition 12, enderio 7,
create 6, tconstruct 5` · `create → immersiveengineering 26, thermal 12, mekanism 8, ae2 5` ·
`createaddition → immersiveengineering 20, create 17, tconstruct 8` · `AdvancedAE → ae2 12` ·
`TCIntegrations → iceandfire 6, tconstruct 5` · `Mekanism → ae2 33 (decorative and dusts only —
harmless)`.

---

## 6. Loot, trades and mob drops

### No loot table in the pack hands out a machine tier — checked

I scanned every non-block loot table (1,906 rows of progression-mod items) for machine-shaped ids
across `mekanism mekanismgenerators thermal enderio create ae2 advanced_ae draconicevolution bigreactors
rftools* immersiveengineering tconstruct extrautilitiesreborn alexscaves`. **Nothing gives a machine
block.** The only near-misses are a handful of Create *andesite-tier* devices at count 1 in IDAS chests
(`millstone`, `mechanical_saw`, `gearbox`, `hand_crank`, `andesite_casing`, `linked_controller`), which
are a treat, not a tier.

### What loot does hand out

| Source | Sealed items it gives | Verdict |
|---|---|---|
| **`idas:chests/*`** (Integrated Dungeons & Structures, 594 rows) | lots of Create: `experience_nugget`, `rose_quartz`, `raw_zinc`, `zinc_ingot`, `andesite_alloy`, `shaft`, `cogwheel`, `large_cogwheel`, `gearbox`, `goggles`, `wrench`, `brass_ingot/nugget/hand`, `electron_tube`, **`sturdy_sheet`**, **`track`**, `golden_sheet`, `iron_sheet`, `powdered_obsidian`. Ars Nouveau: `source_gem`, all 20+ `ritual_*` tablets, `dowsing_rod`, `dominion_wand`, `spell_bow`, `summon_focus`, `shapers_focus`, the four elemental essences, **a full `sorcerer_*` armour set**, **`apprentice_spell_book`**, `worn_notebook`, wilden parts. Ice and Fire: `dragonbone`, `dread_*` gear, `silver_*`, `sapphire_gem`, **`ice_dragon_heart`**, **`ice_dragon_blood`**, `dragonegg_blue`, iron/diamond dragon armour | **treat**, with two to watch: a found `sorcerer` set + `apprentice_spell_book` is most of Ars Nouveau's mid-game gear, and `ice_dragon_heart` + `ice_dragon_blood` is two thirds of a Dragonforge **without killing a dragon** (the forge bricks still need 9 ice scales each) |
| **`integrated_villages:chests/*`** (346) and **`integrated_stronghold:chests/*`** (66) | the same Create andesite/brass parts, plus `empty_schematic`, `framed_glass`, `propeller`, `mechanical_saw` | treat |
| **`twilightforest:chests/*`** (172) | `ironwood_ingot`, `steeleaf_ingot`, `knightmetal_ingot`, `raw_ironwood`, `liveroot`, `armor_shard`, `carminite`, `fiery_tears`, plus **whole gear pieces**: steeleaf full set, `knightmetal_{sword,axe,pickaxe,chestplate}`, `ironwood_{chestplate,pickaxe,sword}`, `mazebreaker_pickaxe`, `phantom_{helmet,chestplate}`, `ice_sword`, `ice_bow`, `glass_sword`, `ender_bow`, `arctic_*`, `charm_of_keeping_1/2`, `charm_of_life_1`, `moonworm_queen`, `lamp_of_cinders`, **`ore_magnet`**, `uncrafting_table`, `experiment_115`, the tree saplings | **by design** — the brief's own answer. TF's materials are meant to be found. `uncrafting_table` is already dead (`disableUncraftingTable = true` also removes it from loot). `ore_magnet` is the one to watch |
| `twilightforest:entities/*` (41) | `naga_scale`, `fiery_blood`, `fiery_tears`, `carminite`, `alpha_yeti_fur`, `arctic_fur`, `armor_shard`, `giant_sword`, `giant_pickaxe`, `diamond_minotaur_axe`, `seeker_bow`, `triple_bow`, all four scepters, `crumble_horn`, `magic_map_focus`, `maze_map_focus`, `charm_of_keeping_1`, the seven trophies | **by design** — these are the boss rewards |
| **`botania:inject/*`** | injects `botania:manasteel_ingot`, `lexicon`, `mana_bottle`, `black_lotus`, `overgrowth_seed` into **vanilla** `simple_dungeon`, `stronghold_corridor`, `abandoned_mineshaft`, `desert_pyramid`, `jungle_temple`, `village_chest` and **`spawn_bonus_chest`** | treat — single Manasteel ingots from day-one vanilla loot |
| **`immersiveengineering:chests/engineers_house`** | `component_steel`, `component_iron`, `blueprint`, `ingot_aluminum`, `coal_coke`, treated/steel/aluminum sticks | treat — `component_steel` is IE's heavy-multiblock part, but the multiblocks themselves stay sealed |
| **`immersiveengineering:gameplay/hero_of_the_village/*`** | **Faraday armour set**, `component_steel`, `component_iron`, revolver magazine upgrade, shader bags | treat, but note raids are available on day one |
| `enderio:chests/{common_loot,alloy_loot}` | `dark_steel_ingot`, `dark_steel_sword`, `loot_capacitor`, and the conductive/redstone/copper/pulsating/vibrant alloy ingots, EnderIO gears | treat. **Nothing in the pack's data references these two tables** — they are attached in code, so I cannot say which structures roll them |
| `alexscaves:chests/*` (100) | `diving_*` suit, **`hazmat_*` set**, `primordial_*` set, `frostmint_spear`, `limestone_spear`, `telecore`, `occult_gem`, `uranium_rod`, `radiant_essence`, `azure/scarlet_neodymium_ingot`, `cave_tablet`, `cave_book` | treat — but the **Hazmat set is the Toxic Caves gate**, so Alex's Caves partly gates itself through loot |
| `iceandfire:entities/*` (112) and `iceandfire:chest/*` (83) | dragon scales, blood, hearts, bones, myrmex/siren/hippogryph parts, dread gear | **by design** — this is how Ice and Fire works |
| `reliquary:inject/*` (72) | Reliquary's mob-drop components injected into vanilla chests (`simple_dungeon`, `stronghold_*`, `nether_bridge`, `end_city_treasure`, `desert_pyramid`, `jungle_temple`, `igloo_chest`, `abandoned_mineshaft`, `village_weaponsmith`) and ~20 vanilla mob tables | treat |
| `botania:gaia_guardian`, `gaia_guardian_2`, `botania:dice/*` | Gaia Spirit, the Relics of the Aesir | by design — boss drops |
| `createbigcannons:boring_scrap/*` (28) | cannon scrap | harmless |
| **Chance Cubes** | **checked all 82 reward files: every item id is `minecraft:` or `chancecubes:`.** Not a bypass | clear |

### Trades

**No mod in the pack ships data-driven villager trades.** The only trade-shaped data is
`alexsmobs:loot_tables/gameplay/trader_elephant_chest`, the Hero-of-the-Village tables above, Botania's
`botania:elven_trade` (14 recipes — a *recipe type*, removed with the `botania` namespace), Alex's Caves'
Deep One trading (code), and Mowzie's Umvuthi trade (code). Wandering-trader and villager offers are
vanilla/code, so **trades cannot hand out a modded sealed item** unless a mod adds them in code —
which `lootintegrations` might; see §9.

### Ars Nouveau's Drygmy

`ars_nouveau:tags/entity_types/drygmy_blacklist` contains **exactly one entry: `minecraft:iron_golem`.**
So the Drygmy can harvest the loot table of **every other mob in the pack**, without killing it, from a
Mob Jar. What that automates:

- `twilightforest:armor_shard` from `twilightforest:entities/blockchain_goblin` — a common TF mob, so
  **armour shards (and therefore knightmetal) become farmable without the Labyrinth or the Stronghold.**
  The `knightmetal_ingot` *recipe* is still sealed, so this only matters once that tier opens.
- `minecraft:wither_skeleton_skull`, blaze rods, ender pearls, ghast tears — standard Nether grinds.
- Ice and Fire scales and blood from jarable small dragons and other mobs.
- **Reliquary is safe**: its drops require a *player* kill, and the Drygmy is not one.
- TF **bosses cannot be jarred**, so naga scales, fiery blood, fiery tears, carminite and alpha yeti fur
  are not farmable this way.

The Drygmy Charm is `ars_nouveau:drygmy_charm`, made on the Enchanting Apparatus from a
`drygmy_shard` (a mob drop) — so it is sealed with `ars_nouveau`, and the Mob Jar
(`ars_nouveau:mob_jar`) with it.

---

## 7. Twilight Forest specifics

- **`twilightforest:crumble_horn`** — 36 recipes, checked individually. Every output is a vanilla or TF
  *decorative* block: stone↔gravel, coarse dirt→dirt, the copper oxidation stages, cracked brick
  variants, `twilightforest:{castle_brick,deadrock,mazestone_brick,nagastone_pillar,towerwood,underbrick}`
  and their cracked forms. **No sealed item. Not a bypass.**
- **`twilightforest:transformation_powder`** — 16 recipes, all **mob→mob**: vanilla ↔ TF pairs
  (`cow↔bighorn_sheep`, `pig↔boar`, `chicken↔tiny_bird`, `wolf↔hostile_wolf`, `spider↔hedge_spider`,
  `slime↔maze_slime`, `witch↔skeleton_druid`, `ghast↔carminite_ghastguard`, `vex↔wraith`,
  `silverfish↔towerwood_borer`, `bat↔raven`, `rabbit↔dwarf_rabbit`, `parrot↔penguin`,
  `cave_spider↔swarm_spider`, `zombified_piglin↔minotaur`). **No items at all. Not a bypass.** Worth
  knowing that it can make `carminite_ghastguard` from a ghast and `minotaur` from a zombified piglin,
  which a Drygmy could then farm.
- **`twilightforest:uncrafting`** — 2 recipes, dead: `disableUncraftingTable = true` in
  `tools/serverconfig/twilightforest-common.toml` disables all use **and** removes it from loot and
  crafting. Confirmed from the config file; the chest-loot entry I found is therefore inert.
- **The magic tree cores.** Already mitigated in the shipped config: `timeCoreRange = 8` (down from 16)
  and `sortingCoreRange = 8`. The Timewood Core still gives any mod's machines within 8 blocks ~24 extra
  ticks a second, which can out-run a tier's intended pace.
  **Recommendation: leave `disableTimeCore = false` and keep range 8.** Reasons: it is a *natural block*
  found in a magic tree, so it is a found-item treat exactly like TF's gear; through tiers 1–5 the
  machines it would accelerate are sealed anyway; and turning it off removes a signature TF reward. If
  the owner wants belt-and-braces, set `disableTimeCore = true` until the tier that opens Mekanism and
  Create's brass age, then flip it — but that needs a restart, not a `/reload`, so it is a worse fit for
  this engine. **Owner's call; nothing applied.**
- **Portal and progression:** per the owner's decision TF is open from the start. No
  `portalUnlockedByAdvancement`, no `disablePortalCreation`, and `tfEnforcedProgression` stays on
  (default). Nothing to change.

---

## 8. Smaller leaks worth a line each

| Thing | Why it is on the list | Verdict |
|---|---|---|
| `enderstorage` (Ender Chests / Pouches, 3+3 recipes) | cross-dimension and cross-player item transfer; a sealed item can be handed from a player who found one | leave open, but know that it defeats "each player earns their own" |
| `extrautilitiesreborn:angel_block`, `golden_bag_of_holding` | creative-flight-adjacent building block, big inventory | mid tier with the rest of the mod |
| `gravitygun` (2 recipes incl. `gravitygun:supercharged_gravitygun`) | block moving / grief tool on a troll server | owner's call; it is not a progression bypass |
| `remorphed` + `walkers` (no data) | players gain mob abilities, including flight from some mobs | **cannot be gated by recipes at all** — config only |
| `trashcans`, `elevatorid`, `waystones` | QoL; `waystones:warp_plate` (2 recipes) is travel | leave open |
| `alexscaves:nuclear_bomb` | a craftable nuke on a trolling server | put it late, or leave it to the owner's rules |
| `botania:loonium` | its 74 loot rows pull **vanilla structure tables**, including `minecraft:elytra` (end_city) and `minecraft:totem_of_undying` (mansion) | not a sealed-item bypass, but it automates the **Totem Hoard** relic (64 totems) and the Elytra |
| `bluepower` metals | `silver_ingot` (12 routes), `brass_ingot` (7), `tungsten_ingot` (12) share `forge:` tags with Thermal and IE | give `bluepower` a tier so it is not a free silver/brass source before Thermal |
| `worldedit` | op-only; permissions, not recipes | check LuckPerms, not the tier list |

---

## 9. What I could not verify from the jars' data

These are honest gaps, not oversights.

1. **Thermal's core parts have no shipped recipe.** `thermal:machine_frame`, `thermal:rf_coil`,
   `thermal:redstone_servo`, `thermal:energy_cell_frame`, `thermal:tinker_bench` and
   `thermal:upgrade_augment_1/2/3` appear only as *ingredients*. The only other mention is
   `cofh/thermal/expansion/init/data/providers/TExpRecipeProvider.class`, the datagen provider. They must
   be registered at runtime. **Check in JEI** that they have recipes and that those recipes vanish while
   `thermal` is sealed.
2. **`enderio:chests/common_loot` and `alloy_loot` are not referenced by any loot table in the pack's
   data** — they are attached in code, so I cannot say which structures roll them or how often.
3. **AlmostUnified ships no data.** Its tag-unification rules live in `config/almostunified/` and are
   applied at runtime; it can rewrite recipe *ingredients* so that a sealed mod's ingot is accepted where
   an open mod's was expected, or vice versa. **Read that config on the server** and check that no
   `forge:ingots/*` tag has a sealed mod as its unified target.
4. **`lootintegrations` + `lootintegrations_moog`** replace vanilla and Moog structure loot with their
   own `lootintegrations:chests/{easy,medium,hard,nether,water,village,jungle_temple,empty}` tables.
   Those tables are **not in the jars' data** — they are code-registered. So I cannot list what they
   hand out. **Check in game**, or disable loot integration for the structures you care about.
5. **`dragonfight` and `bfendcities` ship no data but change the Ender Dragon fight and End cities at
   runtime.** Whether Draconic's `draconicevolution:dragon_heart` still drops above the exit portal is
   not something the jars' data can tell me. The old `PROGRESSION_MODS.md` flags the same thing. **Test
   one dragon kill before relying on it for tiers 10–12.**
6. **Villager and wandering-trader offers** are code in 1.20.1. I verified no mod *ships* trade data, but
   a mod could still add offers in code.
7. **`remorphed` / `walkers` flight**, **Timewood Core acceleration** and **`tfEnforcedProgression`** are
   config/runtime behaviours; the tier engine cannot touch them.
8. **`mekanismcurios` outputs zero items** — probably correct (it is a slot-registration jar), but if
   something is expected from it, it is not in the data.
9. The index's `tag_members.tsv` records only the **first** jar that declares each tag. Several jars
   declare the same `forge:` tags; use `tags.tsv` if you need all declarers.
