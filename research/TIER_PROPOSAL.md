# Pass 4 — The 12 Blood Pool tiers (proposal)

For `TIERS` at the top of `tools/kubejs/server_scripts/part2/blood_pool.js`.
Names are **unchanged**; the **thresholds are doubled** (owner's decision), so the Pool now runs
20,000 → 3,000,000 instead of 10,000 → 1,500,000. Every item id below was checked against the pass-1
index — each one has at least one real recipe in this jar set, with three deliberate exceptions noted
in §6.1.

Doubling the thresholds is paid for by a **new income source: the Potato Tithe** — 4,000 potatoes for
1,000 Drops, capped at 30,000 Drops/day server-wide. §7 specifies it. The short version: the original
8-week arc is still reachable, but only by a server that farms, and the cap means no amount of farming
gets there faster. §7.3 has the throughput numbers the cap is sized against.

Everything the brief left open is **decided**: §5 lists the twelve judgement calls, what each one is, and the
one edit that overrules it. §6 is the separate list of things the jars genuinely cannot answer, each of
which needs a look at the running server.

**The design in one paragraph.** Tinkers' Construct and Twilight Forest stay open from the start, so
day 0 is playable: vanilla tools, a smeltery, and a whole dimension to explore. Tiers 1–4 land in the
first four days and hand out the five starter mods from `STARTING_MODS.md`. Tier 5, at about week 1, is
the Nether: cobalt, the foundry, Thermal and Ender IO. Tiers 6–8 are storage, automation and the deep
forge. Tiers 9–11 are the boss tiers — Gaia, the Wither, the Dragon, the Chaos Guardian — and tier 12
is the Siege. Big mods go in by **namespace at the tier they start**, and their end-game items are
listed in **later** tiers, which is exactly what the engine's `ITEM_TIER`-beats-`MOD_TIER` rule supports.

---

## 1. The `TIERS` list

```js
const TIERS = [
  { tier: 1, name: 'A Trickle', drops: 20000, unlocks: {
      mods: ['create', 'mysticalagriculture'],
      items: [],
      tags: [] } },

  { tier: 2, name: 'A Puddle', drops: 60000, unlocks: {
      mods: ['botania', 'ars_nouveau', 'evilcraft'],
      items: ['hexerei:mixing_cauldron', 'hexerei:blood_bottle'],
      tags: [] } },

  { tier: 3, name: 'A Basin', drops: 120000, unlocks: {
      mods: ['immersiveengineering'],
      items: [
        'create:copper_casing', 'create:fluid_pipe', 'create:mechanical_pump', 'create:fluid_tank',
        'create:steam_engine', 'create:electron_tube', 'create:brass_casing', 'create:brass_hand',
        'create:crushing_wheel', 'create:spout', 'create:item_drain',
        'tconstruct:steel_ingot'],
      tags: ['forge:ingots/steel'] } },

  { tier: 4, name: 'A Font', drops: 200000, unlocks: {
      mods: ['mekanism', 'mekanismgenerators', 'tinker_rapier'],
      items: [
        'create:precision_mechanism', 'create:mechanical_crafter', 'create:deployer',
        'create:mechanical_arm', 'create:rotation_speed_controller',
        'twilightforest:steeleaf_ingot', 'twilightforest:steeleaf_helmet',
        'twilightforest:steeleaf_leggings', 'twilightforest:steeleaf_boots',
        'twilightforest:steeleaf_sword', 'twilightforest:steeleaf_pickaxe',
        'twilightforest:steeleaf_axe', 'twilightforest:steeleaf_shovel', 'twilightforest:steeleaf_hoe'],
      tags: [] } },

  { tier: 5, name: 'A Spring', drops: 320000, unlocks: {
      mods: ['thermal', 'enderio'],
      items: [
        'tconstruct:cobalt_ingot', 'tconstruct:raw_cobalt', 'tconstruct:cobalt_block',
        'tconstruct:nether_grout', 'tconstruct:scorched_brick', 'tconstruct:foundry_controller',
        'tconstruct:scorched_alloyer', 'tconstruct:scorched_fuel_gauge',
        'tconstruct:scorched_ingot_gauge',
        'mekanism:purification_chamber', 'mekanism:advanced_control_circuit',
        'mekanism:chemical_injection_chamber', 'mekanism:electrolytic_separator',
        'mysticalagriculture:infusion_altar', 'mysticalagriculture:infusion_pedestal',
        'mysticalagriculture:soulium_ingot', 'mysticalagriculture:soulium_seed_base',
        'mysticalagriculture:soul_jar', 'mysticalagriculture:soulium_dagger',
        'twilightforest:knightmetal_ingot', 'twilightforest:armor_shard_cluster',
        'twilightforest:knightmetal_helmet', 'twilightforest:knightmetal_leggings',
        'twilightforest:knightmetal_boots', 'twilightforest:knightmetal_sword',
        'twilightforest:knightmetal_axe', 'twilightforest:knightmetal_pickaxe',
        'twilightforest:knightmetal_ring', 'twilightforest:knightmetal_shield',
        'twilightforest:block_and_chain'],
      tags: [] } },

  { tier: 6, name: 'A Stream', drops: 480000, unlocks: {
      mods: ['ae2', 'ae2additions', 'ae2wtlib', 'ae2insertexportcard', 'appliedcooking', 'appbot',
             'appmek', 'createappliedkinetics', 'bigreactors', 'reliquary', 'alexscaves', 'iceandfire'],
      items: [
        'botania:terra_plate', 'botania:terrasteel_ingot', 'botania:alfheim_portal',
        'botania:natura_pylon', 'botania:mana_pylon', 'botania:dreamwood_log',
        'botania:elementium_ingot', 'botania:pixie_dust', 'botania:dragonstone',
        'botania:alchemy_catalyst', 'botania:conjuration_catalyst',
        'mekanism:alloy_reinforced', 'mekanism:elite_control_circuit',
        'mysticalagriculture:supremium_essence', 'mysticalagriculture:supremium_ingot',
        'mysticalagriculture:supremium_gemstone', 'mysticalagriculture:master_infusion_crystal',
        'hexerei:willow_broom', 'hexerei:witch_hazel_broom',
        'twilightforest:fiery_ingot', 'twilightforest:fiery_helmet', 'twilightforest:fiery_leggings',
        'twilightforest:fiery_boots', 'twilightforest:fiery_sword', 'twilightforest:fiery_pickaxe',
        'twilightforest:yeti_helmet', 'twilightforest:yeti_leggings', 'twilightforest:yeti_boots'],
      tags: [] } },

  { tier: 7, name: 'A River', drops: 700000, unlocks: {
      mods: ['rftoolsbase', 'rftoolsutility', 'rftoolsbuilder', 'powersuits', 'numina',
             'redstone_arsenal', 'bluepower', 'extrautilitiesreborn'],
      items: [
        'create:sturdy_sheet', 'create:railway_casing', 'create:track', 'create:track_station',
        'create:controls', 'create:packager', 'create:stock_ticker', 'create:package_frogport',
        'create:item_vault', 'create:mechanical_roller',
        'mekanism:ingot_refined_obsidian', 'mekanism:alloy_atomic', 'mekanism:ultimate_control_circuit',
        'mekanism:chemical_dissolution_chamber', 'mekanism:chemical_washer',
        'mekanism:chemical_crystallizer', 'mekanism:teleportation_core', 'mekanism:chemical_infuser',
        'thermal:upgrade_augment_1', 'thermal:upgrade_augment_2', 'thermal:upgrade_augment_3',
        'bigreactors:reinforced_reactorcasing', 'bigreactors:reinforced_turbinecasing',
        'twilightforest:carminite', 'twilightforest:carminite_reactor', 'twilightforest:carminite_builder',
        'twilightforest:arctic_fur', 'twilightforest:arctic_helmet', 'twilightforest:arctic_leggings',
        'twilightforest:arctic_boots', 'twilightforest:charm_of_keeping_3',
        'twilightforest:twilight_scepter', 'twilightforest:zombie_scepter',
        'twilightforest:lifedrain_scepter', 'twilightforest:fortification_scepter'],
      tags: [] } },

  { tier: 8, name: 'A Flood', drops: 1000000, unlocks: {
      mods: ['taiga', 'tcintegrations', 'createbigcannons', 'mekanismtools', 'mekanism_weaponry',
             'advanced_ae', 'create_sabers'],
      items: [
        'tconstruct:manyullyn_ingot', 'tconstruct:manyullyn_block', 'tconstruct:manyullyn_nugget',
        'tconstruct:hepatizon_ingot', 'tconstruct:hepatizon_block', 'tconstruct:hepatizon_nugget',
        'tconstruct:queens_slime_ingot', 'tconstruct:queens_slime_block',
        'tconstruct:queens_slime_nugget',
        'tconstruct:cinderslime_ingot', 'tconstruct:cinderslime_block', 'tconstruct:cinderslime_nugget',
        'hexerei:mahogany_broom', 'hexerei:broom_netherite_tip',
        'alexsmobs:tarantula_hawk_elytra',
        'twilightforest:giant_sword', 'twilightforest:giant_pickaxe'],
      tags: [] } },

  { tier: 9, name: 'A Tide', drops: 1400000, unlocks: {
      mods: ['draconicevolution'],
      items: [
        'botania:gaia_pylon', 'botania:gaia_ingot', 'botania:flight_tiara', 'botania:terra_sword',
        'enderio:octadic_capacitor', 'enderio:soul_binder', 'enderio:powered_spawner',
        'enderio:end_steel_ingot',
        'iceandfire:dragonforge_fire_core_disabled', 'iceandfire:dragonforge_ice_core_disabled',
        'iceandfire:dragonforge_lightning_core_disabled',
        'iceandfire:dragonsteel_fire_ingot', 'iceandfire:dragonsteel_ice_ingot',
        'iceandfire:dragonsteel_lightning_ingot',
        'alexscaves:quarry', 'alexscaves:conversion_crucible', 'alexscaves:extinction_spear',
        'mekanism:boiler_casing', 'mekanismgenerators:turbine_casing'],
      tags: [] } },

  { tier: 10, name: 'A Sea', drops: 1900000, unlocks: {
      mods: ['rftoolsdim'],
      items: [
        'mekanismgenerators:fission_reactor_casing', 'mekanismgenerators:fission_fuel_assembly',
        'mekanismgenerators:control_rod_assembly',
        'mekanism:pellet_polonium', 'mekanism:pellet_plutonium', 'mekanism:module_base',
        'mekanism:mekasuit_bodyarmor', 'mekanism:meka_tool', 'mekanism:basic_induction_cell',
        'mekanism:qio_drive_array', 'mekanism:qio_dashboard', 'mekanism:qio_drive_base',
        'mekanism:isotopic_centrifuge', 'mekanism:solar_neutron_activator',
        'mekanism:thermal_evaporation_controller',
        'draconicevolution:wyvern_core', 'draconicevolution:wyvern_crafting_injector',
        'draconicevolution:energy_core', 'draconicevolution:wyvern_energy_core',
        'draconicevolution:module_core',
        'bigreactors:reprocessorcasing', 'bigreactors:blutonium_ingot', 'bigreactors:ludicrite_ingot',
        'bigreactors:ridiculite_ingot', 'bigreactors:inanite_ingot', 'bigreactors:magentite_ingot',
        'ae2:cell_component_64k', 'ae2:cell_component_256k', 'ae2:singularity', 'ae2:quantum_ring',
        'ae2:quantum_link', 'ae2:spatial_io_port', 'ae2:me_p2p_tunnel',
        'ae2:spatial_cell_component_2'],
      tags: [] } },

  { tier: 11, name: 'An Ocean', drops: 2400000, unlocks: {
      mods: [],
      items: [
        'mekanism:pellet_antimatter', 'mekanism:sps_casing', 'mekanism:sps_port',
        'mekanism:supercharged_coil', 'mekanism:antiprotonic_nucleosynthesizer',
        'mekanismgenerators:fusion_reactor_controller', 'mekanismgenerators:fusion_reactor_frame',
        'draconicevolution:awakened_draconium_ingot', 'draconicevolution:awakened_core',
        'draconicevolution:awakened_crafting_injector', 'draconicevolution:draconic_energy_core',
        'draconicevolution:chaotic_core', 'draconicevolution:chaotic_crafting_injector',
        'draconicevolution:chaos_shard', 'draconicevolution:large_chaos_frag',
        'draconicevolution:medium_chaos_frag',
        'advanced_ae:quantum_alloy', 'advanced_ae:shattered_singularity',
        'advanced_ae:quantum_processor', 'advanced_ae:quantum_core', 'advanced_ae:quantum_unit',
        'mysticalagriculture:awakening_altar', 'mysticalagriculture:awakening_pedestal',
        'mysticalagriculture:essence_vessel', 'mysticalagriculture:awakened_supremium_essence',
        'mysticalagriculture:awakened_supremium_ingot',
        'evilcraft:garmonbozia', 'evilcraft:sanguinary_environmental_accumulator',
        'evilcraft:mace_of_destruction',
        'numina:battery_ultimate', 'numina:component_ion_thruster',
        'extrautilitiesreborn:ender_quarry', 'extrautilitiesreborn:rainbow_generator',
        'alexsmobs:dimensional_carver', 'alexscaves:tremorzilla_egg', 'alexscaves:nuclear_bomb'],
      tags: [] } },

  // Tier 12 unlocks no recipes. It opens the Bureaucratic Barrier at the Citadel (part2/citadel.js).
  { tier: 12, name: 'The Siege', drops: 3000000, unlocks: { mods: [], items: [], tags: [] } },
]
```

---

### What the doubled thresholds mean for the schedule

`STORY.md` targets ~25,000 Drops/day from trolls and Hush Coins with about 9 players. At 2× thresholds
that alone stretches the arc to roughly 17 weeks. The Potato Tithe is what brings it back — and because
the tithe is **capped at 30,000 Drops/day** (§7.4), the two columns below are a genuine floor and ceiling
rather than a guess: 25,000/day is the slowest the Pool can fill if nobody farms, 55,000/day is the
fastest it can fill however hard they do.

| Tier | Name | Drops | Floor — trolls + coins only (25k/day) | Ceiling — tithe at the daily cap (55k/day) | `STORY.md` target |
|---|---|---|---|---|---|
| 1 | A Trickle | 20,000 | day 1 | **day 1** | day 1 |
| 2 | A Puddle | 60,000 | day 2 | **day 1** | |
| 3 | A Basin | 120,000 | day 5 | **day 2** | |
| 4 | A Font | 200,000 | day 8 | **day 4** | |
| 5 | A Spring | 320,000 | day 13 | **day 6** | about week 1 |
| 6 | A Stream | 480,000 | day 19 | **day 9** | |
| 7 | A River | 700,000 | day 28 | **day 13** | about week 2 |
| 8 | A Flood | 1,000,000 | day 40 | **day 18** | about week 3 |
| 9 | A Tide | 1,400,000 | day 56 | **day 26** | about week 4 |
| 10 | A Sea | 1,900,000 | day 76 | **day 35** | |
| 11 | An Ocean | 2,400,000 | day 96 | **day 44** | |
| 12 | The Siege | 3,000,000 | day 120 | **day 55** | about week 8 |

The right-hand column lands on `STORY.md`'s schedule almost exactly. That is the deal the doubling makes:
**the old pace is still available, but a server that only trolls now runs at about half speed.** Potatoes
are the difference between an 8-week arc and a 17-week one — and the cap means no amount of extra farming
can take it below 8.

The per-tier headings below use the ceiling column, since filling the daily quota is the intended play.

---

## 2. Tier by tier — what it opens, why, the goals, and the bypasses closed

### Tier 0 — before the first unlock

**Open:** vanilla, **Twilight Forest** (the whole dimension, minus the gear listed in tiers 4–9),
**Tinkers' Construct** up to the smeltery and its tier-1/2 alloys, and everything in §4.

**Goals:** survive, build a Part II base on the ruins, light the TF portal, beat the Naga and the Lich,
start the Troll Log. Tinkers gives tools, TF gives a dimension — there is a real game here before
anything unlocks, which matters because tier 1 is only a day away.

**Why TF is open:** owner's decision, and it is the right one. `tfEnforcedProgression` already gates TF
biome by boss, the portal cannot be gated by recipes (a diamond thrown in a flower-ringed pool), and a
namespace lock would remove TF planks, doors, chests, boats, banisters and its stonecutting for players
standing inside the dimension. Its *gear* is tiered by item instead.

### Tier 1 — A Trickle · 20,000 · day 1 — "First Sparks"

**Unlocks:** `create`, `mysticalagriculture`.

**Why:** these are two of the five mods `STARTING_MODS.md` says to begin with, and the two that pay off
over time. Create's andesite age needs no Nether and runs the same machines all game. Mystical
Agriculture's Inferium seeds need to be in the ground on day 1 to matter by week 8 — and the
**Potato Tithe** relic (10,000 potatoes) wants farming automation early.

**Goals:** Water Wheel → Mechanical Press → Mixer; Andesite Casing and belts; Engineer's Goggles.
Inferium and Prosperity ore → Inferium Seeds → the Infusion Crystal → Prudentium and Tertium.

**Bypasses checked:**
- Mystical Agriculture's 312 cross-mod essence recipes and ~60 cross-mod resource seeds are removed by
  recipe id and re-open with their own mods' tiers (§3). Without that, tier 1 would hand out AE2's
  presses, Terrasteel, Draconium, Manyullyn and all four Twilight Forest boss metals on day one.
- Create's Mechanical Mixer can alloy **Manyullyn, Hepatizon, Queen's Slime, Slimesteel, Rose Gold,
  Amethyst Bronze and Pig Iron** (`createaddition:compat/tconstruct/*`). The Tinkers alloy **items** are
  sealed until tiers 5/8, and `event.remove({output:'tconstruct:manyullyn_ingot'})` matches by output
  regardless of which jar owns the recipe, so the mixer route dies with them.
- `create:crushing_wheel` (ore doubling) and `create:precision_mechanism` are held to tiers 3 and 4.
- `create:blaze_burner` has **no recipe** — you catch a blaze. Nothing to lock.
- `createdeco` (1,727 decorative outputs) is left open deliberately; it is not progression.

### Tier 2 — A Puddle · 60,000 · ~day 1 — "The Green Art"

**Unlocks:** `botania`, `ars_nouveau`, `evilcraft`, plus Hexerei's Mixing Cauldron and Bottle of Blood.

**Why:** the magic half of the pack, all three of which start from Overworld materials and build slowly.
Botania's mana is the classic slow-burn. Ars Nouveau's Novice Spell Book is iron tools and a book, so it
is a genuine day-2 mod. EvilCraft's **Blood Extractor** is here specifically for the **Chalice of Blood**
relic — 1,000 buckets of blood is weeks of grinding and has to start early.

**Goals:** Petal Apothecary → Pure Daisy → Livingrock and Livingwood → a bank of Endoflames → Mana
Spreader and Mana Pool → Manasteel → the Runic Altar and the five runes. Scribes Table → glyphs →
Imbuement Chamber → source gems → Arcane Core and the **Enchanting Apparatus** (75 recipes hang off it).
Dark Gems → Blood Extractor → Dark Power Gem → Blood Infuser.

**Bypasses checked:**
- `botania:livingrock` has exactly 2 recipes and only the Pure Daisy really makes it, so Botania paces
  itself from here.
- Botania's **Terra Plate, Terrasteel, Alfheim portal, Elementium, Pixie Dust and Dragonstone are listed
  in tier 6**, and Gaia in tier 9, so opening the namespace now does not open the end game.
- `botania:orechid` (16 recipes: all eight vanilla ores from stone) and **`botania:orechid_ignem`
  (ancient debris from netherrack)** open with the namespace. The Ignem variant is the one to watch — it
  is unlimited netherite — but it needs a mature mana farm and the Nether, so in practice it lands around
  the time tier 5 opens anyway. **Flagged, not blocked** (§5.10).
- `botania:loonium` pulls **vanilla structure loot tables**, including `minecraft:elytra` (end city) and
  `minecraft:totem_of_undying` (mansion). It automates the **Totem Hoard** relic. Not a sealed-item
  bypass; it is a Botania player being rewarded for building Botania.
- Ars Nouveau's **Drygmy** opens here, and its blacklist contains only `minecraft:iron_golem`, so it can
  farm any other mob's loot table without killing. The one that matters is
  `twilightforest:armor_shard` from the Blockchain Goblin → knightmetal; the **knightmetal recipes are
  sealed until tier 5**, so the shards just pile up. `ars_nouveau:apprentice_spell_book` needs a blaze
  rod and `archmage_spell_book` a **Nether Star plus a Wilden Tribute**, so Ars Nouveau's own top tier is
  self-gating and needs no entry.
- Hexerei is locked **by item, not namespace**: its 980 outputs are mostly wood and candles (1,066
  `hexerei:woodcutting` recipes), and sealing the namespace would take a whole wood set away.

### Tier 3 — A Basin · 120,000 · ~day 2 — "Iron and Oil"

**Unlocks:** `immersiveengineering`; Create's copper and brass tier; steel, as the tag
`forge:ingots/steel` plus `tconstruct:steel_ingot` by name.

**Why:** steel is the pack's first real cross-mod gate — Modular Powersuits, Extreme Reactors' Reinforced
tier and IE's own multiblocks all need it, and five mods share `forge:ingots/steel`. Putting steel and IE
in the same tier makes "the first industrial step" one event. Create's brass tier arrives with it because
brass needs a blaze and so does the first Nether trip.

**Goals:** Engineer's Manual and Hammer → Coke Oven → Treated Wood → Windmill on a Kinetic Dynamo →
**Blast Bricks** → steel → the Crusher and Metal Press. Create: Blaze Burner → brass → Brass Casing →
Electron Tubes → Crushing Wheels. The first Nether trip, which five mods want.

**Bypasses checked:**
- The tag `forge:ingots/steel` covers `immersiveengineering:ingot_steel`, `mekanism:ingot_steel`,
  `thermal:steel_ingot`, `tconstruct:steel_ingot` and `createbigcannons:steel_ingot` in one line. Four of
  those are sealed by their own namespaces anyway; the tag exists to catch **`tconstruct:steel_ingot`**,
  which is otherwise open at tier 0 — and that item is **also listed by name**, so the lock does not
  depend on the tag at all. **This is the only tag in the proposal**, and it is there as insurance against
  AlmostUnified folding another mod's steel into the tag later (§6.3). The reasoning is in §5.2.
- `create:brass_casing` (2 recipes) is the handle, not `create:brass_ingot` (12 routes, shared tag with
  IE, Thermal and Blue Power).
- IE's **Arc Furnace and Alloy Smelter make Manyullyn, Rose Gold and cobalt**
  (`immersiveengineering:arcfurnace/{alloy_manyullyn,ore_cobalt,…}`, `alloysmelter/manyullyn`). Those
  items are sealed until tiers 5 and 8, so the routes are dead until then.
- IE's **Excavator mineral veins include `ancient_debris` and `uraninite`** — industrial netherite and
  uranium. The Excavator needs `component_steel`, which needs blueprints and aluminum, so it is a tier-5
  build in practice. **Flagged.**
- `immersiveengineering:chests/engineers_house` loot gives `component_steel` and the
  Hero-of-the-Village tables give a Faraday armour set. Both are treats: the multiblocks stay sealed.

### Tier 4 — A Font · 200,000 · ~day 4 — "The First Circuit"

**Unlocks:** `mekanism`, `mekanismgenerators`, `tinker_rapier`; Create's Precision Mechanism and
mechanical crafting; Twilight Forest's steeleaf set.

**Why:** Mekanism is the pack's default main tech mod and `STARTING_MODS.md` makes it the recommended
first. It needs nothing but Overworld materials. Create's Precision Mechanism unlocks mechanical crafting
and arms, which is the automation step that makes everything after this faster — it belongs with the
first circuit, not before it. Steeleaf is the Labyrinth/Minoshroom reward, which is where a week-1 TF
player is.

**Goals:** Osmium → Heat Generator → Metallurgic Infuser → Steel Casing → Basic Control Circuit →
Enrichment Chamber (2× ore). Sequenced assembly for the Precision Mechanism → Mechanical Crafter →
Mechanical Arm. Beat the Minoshroom.

**Bypasses checked:**
- `mekanism:steel_casing` (1 recipe, 33 uses) and `mekanism:basic_control_circuit` (1 recipe, 51 uses)
  are the two tightest chokepoints in the pack — this tier is exactly those two recipes becoming legal.
- **Mekanism's 3×/4×/5× chain is listed in tiers 5, 6 and 7**, so opening the namespace gives 2× only.
- `mekanism:ingot_refined_obsidian` has 9 routes across four jars (Mekanism, Mystical Agriculture,
  TConstruct casting, `thermal_integration` chiller). Listing the **item** in tier 7 removes all nine.
- `mekanism:nucleosynthesizing` (20 recipes — `dragon_egg`, `wither_skeleton_skull`, `end_crystal`,
  `diamond`, `trident`, `enchanted_golden_apple`) needs antimatter; the Nucleosynthesizer is listed in
  tier 11 and antimatter with it. This matters: wither skulls → unlimited Nether Stars would short-circuit
  the **Wither's Due** relic and Draconic's Wyvern tier.
- `mekanismcurios` produces zero items and needs no tier. `appmek` (Applied Mekanistics) waits for AE2 in
  tier 6.

### Tier 5 — A Spring · 320,000 · ~day 6, week 1 — "The Nether Forge"

**Unlocks:** `thermal`, `enderio`; Tinkers' Nether tier; Mekanism 3×; Mystical Agriculture's **Infusion
Altar**, Soulium and mob seeds; Twilight Forest's knightmetal set.

**Why:** this is the Nether tier, and it is the one the whole pack converges on — Create's blaze, IE's
blast bricks, Tinkers' cobalt, Ender IO's Soularium and Mystical Agriculture's Soulium are one trip.
Thermal and Ender IO are the second and third tech mods, which is the right time for them.

**Note on Thermal:** the lock must say **`'thermal'`**, not `'thermal_foundation'`. All five Thermal jars
write items and recipes into the single `thermal` namespace; the Forge mod ids never appear as an item
namespace, so `mods: ['thermal_foundation']` would seal nothing at all. (Pass 1, §"the single most
important finding".)

**Goals:** a Nether trip that feeds five mods. Cobalt → Nether Grout → Scorched Alloyer → the Foundry.
Thermal's hand alloys → Machine Frame → Pulverizer and Induction Smelter. Ender IO's Grains of Infinity
(a fire on Overworld bedrock) → Primitive Alloy Smelter → Dark Steel → Void Chassis. The Infusion Altar
and its eight pedestals, so resource seeds begin. Soul Jars for mob seeds. Beat the Knight Phantoms.

**Bypasses checked:**
- **Thermal cannot open earlier than this**, because `thermal_integration` produces **246**
  `mysticalagriculture` items (the Phytogenic Insolator grows every essence crop), **49** `tconstruct`
  items, 22 `mekanism`, 22 `create`, 20 `immersiveengineering` and 6 `redstone_arsenal`. Every one of
  those mods is now open or item-gated, so the compat recipes land on things players already have.
  `redstone_arsenal` is the exception and is held to tier 7, so
  `thermal:compat/redstone_arsenal/smelter_rsa_alloy_flux` is dead until then (the `flux_ingot` item is
  sealed with the namespace).
- `tconstruct:cobalt_ingot` has **16 routes** across four jars (TConstruct, IE arc furnace,
  `thermal_integration` smelter/chiller/press, Mystical Agriculture essence). The **item** lock removes
  all 16; a namespace lock on `tconstruct` would not, and would also take out seared bricks and every
  compat melt the pack depends on.
- **Ender IO's Grains of Infinity has no craft-table recipe of its own.** Its route is
  `enderio:fire_crafting/infinity`, a loot-table ritual on Overworld bedrock — a world interaction, like
  mining, and correctly unaffected by a crafting lock. The only recipe route in the pack is Mystical
  Agriculture's essence, which §3 removes until this tier.
- `enderio:chests/{common_loot,alloy_loot}` hand out Dark Steel and the mid alloys. **Nothing in the
  pack's data references those two tables** — they are attached in code, so I cannot say which structures
  roll them. Treat-level either way; see §6.2.
- TAIGA stays sealed until tier 8. Its Nether base ores (tiberium, prometheum, osram, valyrium) are
  minable now, but nothing can be melted or cast from them.
- **The Infusion Altar sits here, not at tier 3**, because it is the thing that turns essence into
  *resources*. At tier 3 it would have meant unlimited vanilla diamond, gold and redstone from about day
  three, which flattens mining through the whole of week 1. Here it arrives with Soulium and the mob
  seeds, which is where Mystical Agriculture's mid game belongs anyway, and the **Potato Tithe** relic is
  unaffected — that relic wants the *crop* side, which has been open since tier 1. The diamond, emerald
  and netherite resource seeds are held further, to tier 8 (§3a).

### Tier 6 — A Stream · 480,000 · ~day 9 — "Terrasteel and Storage"

**Unlocks:** AE2 and its small addons (`ae2`, `ae2additions`, `ae2wtlib`, `ae2insertexportcard`,
`appliedcooking`, `appbot`, `appmek`, `createappliedkinetics`), `bigreactors`, `reliquary`,
`alexscaves`, `iceandfire`; Botania's Terrasteel and Alfheim; Mekanism 4×; Supremium; the first two
Hexerei brooms; Twilight Forest's fiery and yeti sets.

**Why:** AE2 is a mid-game storage mod and the meteorite can be scouted long before it. Extreme Reactors
is the natural next power step once steel exists. Alex's Caves and Ice and Fire open as *fights* — their
biomes and dragons have been there since day 0; this tier opens the gear you make from what you kill.
Botania's Terrasteel is 500,000 mana an ingot, so it needs a mature mana farm, which is about now.

**Goals:** meteorite → presses → Inscriber → processors → ME Drive and a first network → autocrafting.
Terra Plate → Terrasteel → the Alfheim portal → Elementium and Pixie Dust. A Basic reactor → Cyanite → a
turbine. Hunt a dragon; explore the six cave biomes. Beat the Hydra and the Alpha Yeti.

**Bypasses checked:**
- **All four AE2 Inscriber presses** have 3 routes each: AE2's own Inscriber, **Mystical Agriculture
  essence**, and **`createappliedkinetics`**, which overrides `ae2:inscriber/silicon_press` and friends in
  the **`ae2` namespace**. The essence routes are removed until now by §3; `createappliedkinetics` is in
  this same tier, so it can never precede AE2.
- `ae2:singularity` (1 recipe, Advanced AE's Reaction Chamber only) and everything quantum/spatial is
  listed in tier 10; `advanced_ae` itself in tier 8 and its quantum items in tier 11.
- **Autocrafting is not a bypass.** AE2 patterns validate against the recipe, Create's Mechanical
  Crafters use the crafting-table recipe, and Sequenced Assembly is itself a recipe type — so a sealed
  recipe cannot be autocrafted. The hazard is always the reverse (an open machine whose *output* is
  sealed), which is what the item lists handle.
- `bigreactors:yellorium_ingot` has **16 routes** and shares `forge:ingots/uranium` with Mekanism and IE
  uranium. The handle is the **Reactor Casing and Controller** (3 and 2 recipes), which open with the
  namespace, and the Reinforced tier is held to tier 7 — exactly the old doc's advice. Cyanite is reactor
  waste by design.
- **Ice and Fire paces itself**: the Dragonforge brick needs 9 dragon scales a block, the forge core
  needs a dragon heart, and dragonsteel needs dragon blood. The **forge cores and the three dragonsteel
  ingots are held to tier 9**, so this tier is scale armour and dragon hunting, not dragonsteel.
  `tcintegrations` (which makes dragonsteel a Tinkers material) waits for tier 8.
  Watch one thing: `idas:chests/*` can drop **`iceandfire:ice_dragon_heart` and `ice_dragon_blood`**, so a
  lucky player can have two thirds of a forge without a kill — the bricks still need scales, and the
  cores are sealed until tier 9.
- **Alex's Caves partly gates itself through loot**: the Hazmat set (the Toxic Caves gate), the diving
  suit and the primordial set are all `alexscaves:chests/*` entries. Its **Magnetic Quarry
  (`alexscaves:quarry`) is held to tier 9** and the nuke to tier 11.
- `reliquary` is safe from the Drygmy: its drops require a **player** kill.

### Tier 7 — A River · 700,000 · ~week 2 — "Power and Rails"

**Unlocks:** `rftoolsbase`, `rftoolsutility`, `rftoolsbuilder`, `powersuits`, `numina`,
`redstone_arsenal`, `bluepower`, `extrautilitiesreborn`; Create's trains and package logistics;
Mekanism 5×; Thermal's Integral Components; Extreme Reactors' Reinforced tier; Twilight Forest's
carminite and arctic sets and the four scepters.

**Why:** this is the "big power, big logistics" tier. Modular Powersuits needs steel (tier 3) and Thermal
electrum (tier 5), so it can only land here. RFTools needs steady FE. Create's trains need the Sturdy
Sheet. Mekanism's 5× needs Refined Obsidian. All of it is the same step: the server stops being short of
power and starts being short of time.

**Goals:** 5× ore processing. Power armour and the Power Fist. Matter Transmitters and the Builder with a
quarry card. Trains and the Packager/Stock Ticker network. Reinforced reactors and turbines. Beat the
Ur-Ghast and the Snow Queen.

**Bypasses checked:**
- `numina:component_control_circuit` (1 recipe, **52** uses) and `numina:component_wiring` (1, **53**) are
  the tightest pair in the pack; this tier is those two recipes.
- `rftoolsbase:machine_frame` (1 recipe, 30 uses across all four RFTools jars) is the single handle for
  the family. `rftoolsdim` is held to tier 10.
- **`rftoolsbuilder:shape_card_quarry` and `extrautilitiesreborn:ender_quarry` are quarries.** The Shape
  Card opens here with the mod (it needs the Builder and real power); the **Ender Quarry is held to tier
  11** because it is cheap to run once built.
- `bluepower` is in this tier mainly so it is not a free `forge:ingots/silver` / `brass` / `tungsten`
  source before Thermal. `PROGRESSION_MODS.md` records that only 2 of its 23 logic gates are craftable in
  this alpha build, so it is a metal mod in practice, not a redstone mod.
- `thermal:upgrade_augment_1/2/3` are listed here, **but no jar in the pack ships a recipe for them** —
  see §6.1. If they turn out to be code-registered, the `output:` filter still removes them from the live
  recipe manager; if they genuinely have no recipe, the lines are harmless no-ops.
- `extrautilitiesreborn:angel_block` opens with the namespace. It is a build-anywhere block, not
  progression; if you would rather have it earlier, move just that item to tier 3.

### Tier 8 — A Flood · 1,000,000 · ~week 3 — "The Deep Forge"

**Unlocks:** `taiga`, `tcintegrations`, `createbigcannons`, `mekanismtools`, `mekanism_weaponry`,
`advanced_ae`, `create_sabers`; Tinkers' end-game alloys; AgriCraft's resource crops; the netherite
broom; the Tarantula Hawk Elytra; Twilight Forest's giant gear.

**Why:** this is the gear tier, and the one the **Axe of Peace** relic needs — "a Tinkers broad axe with a
Manyullyn or Hepatizon head, a Netherite upgrade and set modifiers". Manyullyn and Hepatizon need Blazing
Blood, which needs the foundry from tier 5, so a two-tier gap is about right. TAIGA lands here as one
block: 30 extra Tinkers materials and a 28-step alloy tree is a whole mod's worth of end-game material
content, and it has no earlier use.

**Goals:** Blazing Blood → Manyullyn, Hepatizon, Queen's Slime, Cinderslime → Plate Armor and the broad
tools. The TAIGA alloy tree (its recipe ids are numbered `00_terrax` … `27_nitronite` in tier order).
Mekanism Tools and Weaponry. Advanced AE's Reaction Chamber. Cannons.

**Bypasses checked — this is the tier with the most of them:**
- Each Tinkers end-game alloy has **four independent cross-mod routes**: Create's Mechanical Mixer
  (`createaddition:compat/tconstruct/*`), IE's Alloy Smelter and Arc Furnace, Thermal's Induction Smelter
  (`thermal:compat/tconstruct/smelter_alloy_*`), and Mystical Agriculture essence. All four are removed by
  the **item** locks here, because `event.remove({ output: 'tconstruct:manyullyn_ingot' })` matches by
  output whatever jar owns the recipe. **Cinderslime is the only one TConstruct makes alone.**
- The **material** side needs recipe ids, because a Tinkers tool is `tconstruct:pickaxe` with the material
  in NBT. §3 lists them.
- `tcintegrations` adds **Ice and Fire dragonsteel and Botania manasteel as Tinkers materials**. It opens
  here, one tier before dragonsteel itself (tier 9) — deliberate: the material definitions are useless
  until the metal exists, and `tcintegrations:smeltery/casting/metal/dragonsteel_*` needs molten
  dragonsteel, which only comes from melting dragonsteel.
- AgriCraft's resource crops are an ore route — they need the ore block **under the soil**, so one diamond
  block seeds unlimited diamonds. **They cannot be locked by item**: `agricraft:diamond`,
  `agricraft:emerald` and `agricraft:netherite_scrap` are *recipe* ids whose outputs are the **vanilla**
  items, which must stay open. They go in the `recipes:` list at this tier (§3c), not in `items`.
- `taiga` sealed as a whole namespace is safe: every single thing TAIGA ships is a progression metal. Its
  base ores are minable from day 0 but inert.

### Tier 9 — A Tide · 1,400,000 · ~week 4 — "Wither and Star"

**Unlocks:** `draconicevolution`; Botania's Gaia tier; Ender IO's End tier; Ice and Fire's Dragonforge
and dragonsteel; Alex's Caves' Magnetic Quarry and Extinction Spear; Mekanism's boiler and turbine.

**Why:** the first boss tier. Draconic's entry needs a **Nether Star** for the Wyvern tier, Botania's Gaia
Guardian is fought at a **Beacon** (also a Nether Star), and the **Wither's Due** relic is 8 Nether Stars.
One tier, one theme: the server starts killing Withers. Ice and Fire's dragonsteel lands here because by
now players have killed dragons and banked hearts and blood.

**Goals:** kill Withers. Gaia Pylons around a Beacon → the Guardian of Gaia → Gaia Spirit → the Flügel
Tiara. Build a Dragonforge → dragonsteel armour. End Steel from the End. Fusion Crafting Core and
Draconium Cores.

**Bypasses checked:**
- `draconicevolution:draconium_core` is 1 recipe opening **60**, and `draconium_ingot` has 5 routes plus
  Mystical Agriculture essence — closed by §3 until now. The **Wyvern tier is tier 10** and the
  Awakened/Chaotic tiers are tier 11, so opening the namespace here gives the entry tier only.
- `botania:life_essence` (Gaia Spirit) has **0 recipes** — a boss drop. The lock buys you the *gear made
  from it* (`gaia_ingot`, `flight_tiara`, `terra_sword`), which is the right lever.
- `iceandfire:dragonforge` is its own recipe type with exactly **3 recipes** (the three dragonsteel
  ingots). Removing those three plus the three forge cores seals all of dragonsteel, and tier 8's
  `tcintegrations` entry cannot pre-empt it.
- Mekanism's **fission reactor is tier 10**, so the boiler and turbine here are for Thermal/Extreme
  Reactors steam, not for Polonium.

### Tier 10 — A Sea · 1,900,000 · ~week 5 — "Fission and Wyvern"

**Unlocks:** `rftoolsdim`; Mekanism's fission reactor, MekaSuit, Meka-Tool and QIO; Draconic's Wyvern
tier and Energy Core; Extreme Reactors' Reprocessor and top coils; AE2's Singularity, Quantum Bridge,
P2P and Spatial IO.

**Why:** the "everything scales" tier. Fission gives Polonium, which is 35 recipes of MekaSuit and QIO.
The Wyvern tier needs the Nether Stars from tier 9. Spatial IO and RFTools Dimensions both need a lot of
steady power, which fission provides.

**Goals:** a fission reactor and an industrial turbine. The MekaSuit and the Meka-Tool. Wyvern armour and
a Draconic Energy Core. A Quantum Network Bridge. A custom dimension.

**Bypasses checked:**
- `mekanism:pellet_polonium` has exactly **1 recipe** and only a running fission reactor makes it. This
  is the strongest natural gate in the pack; the lock just stops the reactor being built early.
- `draconicevolution:dragon_heart` has **0 recipes** — it drops above the exit portal. **But
  `dragonfight` and `bfendcities` change the Ender Dragon fight and ship no data**, so I cannot confirm
  from the jars that it still drops. **Test one dragon kill before this tier matters** (§6.5).
- `ae2:singularity` is made only by Advanced AE's Reaction Chamber (1 recipe), which opened in tier 8 —
  the Singularity **item** is listed here, so the chamber can run for two tiers without producing it.
- `bigreactors:blutonium_ingot` and the Ludicrite→Ridiculite→Inanite chain are single-recipe each.

### Tier 11 — An Ocean · 2,400,000 · ~week 6 — "Awakened"

**Unlocks:** Mekanism's SPS, antimatter and Nucleosynthesizer; Draconic's Awakened, Draconic and
**Chaotic** tiers; Advanced AE's quantum tier; Awakened Supremium; EvilCraft's Garmonbozia; the Ender
Quarry and Rainbow Generator; the Dimensional Carver; the Tremorzilla Egg and the nuke.

**Why:** everything that trivialises something else. This is the last tier with items, because **tier 12
has none** — so the **Crown of the Blade** (Awakened Draconium + a Dragon Heart + Gaia Spirit + a Chaos
Shard) must be assemblable here, which means the Chaotic tier and `chaos_shard` belong here, not in 12.

**Goals:** the Chaos Guardian, the Draconic Reactor, Awakened Supremium gear, antimatter, and the Crown.
The Regalia is completed and the Siege is next.

**Bypasses checked:**
- `mekanism:antiprotonic_nucleosynthesizer` is held to this tier precisely because
  `mekanism:nucleosynthesizing/wither_skeleton_skull` is unlimited Nether Stars and
  `/dragon_egg` is half of the Chaotic gate. Opening it before tier 11 would hollow out tiers 9 and 10
  and the **Wither's Due** relic.
- `draconicevolution:chaotic_core` is 1 recipe opening 15, fusion-crafted from Chaos Shards. Nothing else
  in the pack makes a Chaos Shard.
- `extrautilitiesreborn:ender_quarry` and `rainbow_generator` are here because the Ender Quarry is the
  cheapest-to-run ore route in the pack once built.
- `alexscaves:nuclear_bomb` is in this tier as a judgement call, not a progression one — a craftable nuke
  on a trolling server is an owner decision — §5.4 says how to remove it outright.
- `evilcraft:garmonbozia` needs the Piercing Vengeance Focus and Vengeance Essence, which are deep
  EvilCraft; it is here so the **Chalice of Blood** grind (open since tier 2) has somewhere to end.

### Tier 12 — The Siege · 3,000,000 · ~week 8

**No recipes.** It opens the Citadel's Bureaucratic Barrier (`part2/citadel.js`), the phased fight with
the Minister, and the Crown Restored. Exactly as the brief and `BLOOD_POOL.md` specify.

---

## 3. Recipe ids and patterns the `items` field cannot express

The engine needs a `recipes:` field (BLOOD_POOL.md calls it "a planned addition"). Each entry below
belongs to the tier shown; until that tier opens, remove it.

### 3a. Mystical Agriculture's cross-mod essence and seed recipes

These are the single biggest bypass in the pack: 312 essence recipes and ~190 seed recipes, producing
items in 26 namespaces. Remove each group until the tier that owns the material.

| Tier | Remove until then |
|---|---|
| 2 | `/^mysticalagriculture:essence\/botania\//` · `/^mysticalagriculture:seed\/infusion\/(manasteel)$/` |
| 3 | `/^mysticalagriculture:essence\/immersiveengineering\//` · `/^mysticalagriculture:essence\/common\/(steel|aluminum)_ingot$/` · `/^mysticalagriculture:seed\/infusion\/(steel|aluminum)$/` |
| 4 | `/^mysticalagriculture:essence\/mekanism\/(osmium_ingot|refined_glowstone_ingot|fluorite)$/` · `/^mysticalagriculture:seed\/infusion\/(osmium|refined_glowstone|fluorite)$/` |
| 5 | `/^mysticalagriculture:essence\/(enderio|thermal)\//` · `/^mysticalagriculture:essence\/tconstruct\/cobalt_ingot$/` · `/^mysticalagriculture:essence\/common\/(tin|lead|nickel|silver|bronze|brass|invar|constantan|electrum|zinc|tungsten|graphite|silicon)_?(ingot)?$/` · `/^mysticalagriculture:essence\/gems\/(ruby|sapphire|peridot|apatite)$/` · `/^mysticalagriculture:seed\/infusion\/(cobalt|dark_steel|grains_of_infinity|soularium|conductive_alloy|copper_alloy|energetic_alloy|pulsating_alloy|redstone_alloy|vibrant_alloy|enderium|lumium|signalum|tin|lead|nickel|silver|bronze|brass|invar|constantan|electrum|zinc|tungsten|graphite|silicon)$/` |
| 6 | `/^mysticalagriculture:essence\/(appliedenergistics2|extremereactors2)\//` · `/^mysticalagriculture:essence\/botania\/(terrasteel_ingot|elementium_ingot)$/` · `/^mysticalagriculture:essence\/common\/uranium_ingot$/` · `/^mysticalagriculture:seed\/infusion\/(certus_quartz|fluix|sky_stone|terrasteel|elementium|yellorium|cyanite|uranium)$/` |
| 7 | `/^mysticalagriculture:essence\/redstone_arsenal\//` · `/^mysticalagriculture:essence\/mekanism\/refined_obsidian_ingot$/` · `/^mysticalagriculture:seed\/infusion\/(flux_infused_ingot|flux_infused_gem|refined_obsidian)$/` |
| 8 | `/^mysticalagriculture:essence\/tconstruct\//` (the rest: manyullyn, hepatizon, queens_slime, slimesteel, amethyst_bronze, pig_iron, rose_gold) · `/^mysticalagriculture:essence\/minecraft\/netherite_ingot$/` · `/^mysticalagriculture:seed\/infusion\/(manyullyn|hepatizon|queens_slime|slimesteel|amethyst_bronze|pig_iron|rose_gold|netherite|diamond|emerald)$/` — the last two are **vanilla** seeds, held back on purpose so mining still matters through week 1 |
| 9 | `/^mysticalagriculture:essence\/draconicevolution\//` · `/^mysticalagriculture:essence\/twilightforest\//` · `/^mysticalagriculture:seed\/infusion\/(draconium|end_steel|fiery_ingot|ironwood|knightmetal|steeleaf)$/` |

Always open: the 194 `essence/minecraft/*` recipes except `netherite_ingot`; the `essence/create/*` and
`essence/chisel/*` decorative stones; and the essence recipes for mods not in the pack (`powah`,
`astralsorcery`, `integrateddynamics`, `refinedstorage`, `pneumaticcraft` — inert).

The vanilla **resource seeds** (`seed/infusion/{iron,gold,copper,coal,redstone,lapis_lazuli,
nether_quartz,amethyst,obsidian,glowstone,…}`) are not in the table, so they open with the Infusion Altar
at **tier 5** — only `diamond`, `emerald` and `netherite` are held to tier 8. The **mob** seeds
(`seed/infusion/{zombie,skeleton,spider,creeper,enderman,blaze,ghast,wither_skeleton,…}`) likewise open at
tier 5 with Soulium and the Soul Jar, which is their real gate.

### 3b. Tinkers materials, by material

A Tinkers tool is `tconstruct:pickaxe` with the material in NBT, so these are the only handles. For a
material `<m>`, one regex per family seals it:

```
/^tconstruct:tools\/materials\/<m>\//                     the Part Builder mapping (ingot/nugget/block)
/^tconstruct:tools\/materials\/casting\/<m>$/             Casting Table: molten metal -> material part
/^tconstruct:tools\/materials\/composite\/<m>$/           composite casting
/^tconstruct:tools\/materials\/melting\/<m>$/             melt a part back (close it, or parts launder)
```

| Tier | Materials to seal until then |
|---|---|
| 3 | `steel` (with the `forge:ingots/steel` tag) |
| 4 | `osmium` |
| 5 | `cobalt`, `scorched_stone`, and `tconstruct:smeltery/alloys/molten_*` for the Nether alloys |
| 6 | `electrum`, `invar`, `constantan`, `silver`, `lead`, `pewter`, `aluminum`, `knightmetal`, `fiery`, `ironwood`, `steeleaf` (the TF four follow their items' tiers: see tiers 4–9) |
| 8 | `manyullyn`, `hepatizon`, `queens_slime`, `cinderslime`, `necronium`, `blazing_bone`, `blazewood`, `ancient`, `enderslime`, `ichor`, plus **all of TAIGA**: `/^taiga:(materials|alloy)\//` (90 + 30 + 30 + 28 ids), plus `tcintegrations`: `/^tcintegrations:tools\/materials\/(brass|calorite|desh|neptunium|ostrum|soul_stained_steel|manasteel|manastring|livingwood|livingrock)(\/|$)/` and `/^tcintegrations:tools\/materials\/(casting|melting)\/(brass|calorite|desh|neptunium|ostrum|soul_stained_steel|manasteel)$/` |
| 9 | `/^tcintegrations:tools\/materials\/dragonsteel_(fire|ice|lightning)(\/|$)/` and `/^tcintegrations:tools\/materials\/(casting|melting)\/dragonsteel_(fire|ice|lightning)$/` · `tconstruct:tools/materials/dragon_scale` |
| 4 | `/^tinker_rapier:(tools\/parts\/builder|smeltery\/casts)\//` (5 ids — the rapier part and its casts) |

Always open (tier 0, so Tinkers works from the start): `iron gold copper bronze amethyst_bronze rose_gold
pig_iron slimesteel seared_stone wood(11 logs + planks + bamboo) rock(6) flint(3) bone necrotic_bone
obsidian glass quartz ice(3) slimeball(4) slimewood(4) earthslime skyslime leather string wool(16) paper
feather gunpowder prismarine shulker endstone end_rod chorus_popped cactus magma magnetite blaze
phantom_membrane rabbit_hide leaves vine(3) treated_wood nahuatl venombone darkthread knightly glowstone
amethyst`.

Also worth holding: `/^tconstruct:tables\/recycling\/twilightforest\//` (17 ids) lets the Part Builder
recycle **looted** TF gear into ironwood / steeleaf / knightmetal / yeti fur / arctic fur. Found gear
should stay usable, but recycling it into bulk material is manufacturing, so tie each of those 17 ids to
the same tier as its material (4, 5, 6, 7).

### 3c. Everything else items cannot express

| Tier | Recipe ids | Why |
|---|---|---|
| 8 | `agricraft:diamond`, `agricraft:emerald`, `agricraft:netherite_scrap` | AgriCraft's resource crops. **Only expressible as recipe ids** — their outputs are the vanilla `minecraft:diamond` / `emerald` / `netherite_scrap`, which must stay open, so an `items:` entry is impossible. `agricraft:coal`, `copper_ingot`, `quartz` and `amethyst_shard` are left open |
| 8 | `/^taiga:alloy\/(0[0-9]|1[0-3])_/` | TAIGA alloys 00–13 (terrax … astrium) |
| 9 | `/^taiga:alloy\/(1[4-9]|2[0-7])_/` | TAIGA alloys 14–27 (niob, yrdeen, iox, lumix, nucleum, dyonite, nitronite) — the deepest chains, three or four alloys and End ores each |
| 9 | `iceandfire:dragonforge/dragonsteel_fire_ingot`, `…ice_ingot`, `…lightning_ingot` | belt-and-braces alongside the ingot items: the whole `iceandfire:dragonforge` type is only these three |
| 11 | `/^mekanism:nucleosynthesizing\//` (20) | the item lock on the Nucleosynthesizer should be enough, but these 20 include `wither_skeleton_skull` and `dragon_egg` and are worth naming |
| 2 | `botania:orechid_ignem/ancient_debris` | **optional** — if you would rather netherite stayed a Nether trip, remove just this one id until tier 8; the other `orechid_ignem/*` and all 16 `orechid/*` are vanilla ores and fine |
| 8 | `/^createaddition:compat\/tconstruct\//` (9) · `immersiveengineering:alloysmelter/manyullyn` · `immersiveengineering:alloysmelter/rose_gold` · `/^immersiveengineering:arcfurnace\/(alloy|dust)_(manyullyn|rose_gold)$/` · `/^thermal:compat\/tconstruct\/smelter_alloy_/` | **redundant** with the item locks, but listing them documents the four cross-mod alloy routes and survives an item id changing |

---

## 4. Mods deliberately left unlocked

**Twilight Forest** — owner decision, and its gear is tiered by item (tiers 4–9). Locking the namespace
would remove TF planks, doors, chests, boats, banisters and its stonecutting from players standing in the
dimension. `twilightforest:uncrafting` (2 recipes) is already dead via
`disableUncraftingTable = true`.

**Tinkers' Construct (`tconstruct`)** — 2,981 outputs, including seared bricks, the smeltery and every
cross-mod melt and cast the pack depends on. Tiered by item and recipe id instead, so the smeltery works
from day 0 and its materials arrive on schedule.

**`createdeco`** — 1,727 outputs, all decoration.
**`mowziesmobs`** — 8 outputs, no ladder; its bosses are fights, and their drops make good ingredients.
**`agricraft`** — 13 craftable outputs; only `diamond`, `emerald` and `netherite_scrap` are progression
and those are in tier 8. The **Potato Tithe** relic wants the rest early.
**`mekanismcurios`** — zero items.
**`hexerei`** as a namespace — mostly a wood set (1,066 `hexerei:woodcutting` recipes); the brooms and the
Bottle of Blood are tiered by item.
**`alexsmobs`** as a namespace — mob-drop gear; only the Elytra and the Dimensional Carver are tiered.
**`netheroresplus`** — worldgen; its 6 recipes output `minecraft:` items.
**`adlods`** (Large Ore Deposits) and **`almostunified`** — no `data/` at all; worldgen and runtime tag
folding (but read Almost Unified's config, §6.3).
**`chancecubes`** — checked all 82 reward files: every item is `minecraft:` or `chancecubes:`. Not a
bypass.

And the whole appendix from `PROGRESSION_MODS.md`: Farmer's Delight, Alex's Delight, Pam's HarvestCraft 2,
Cooking for Blockheads, Quark (+ Zeta, Quark Recipes Unexplored), Supplementaries (+ Squared), Regions
Unexplored (+ RU Expansion, Farmer's Cutting, mcwregionsunexplored), Integrated Dungeons and Structures,
Integrated Villages, Integrated Stronghold, Moog's Soaring Structures, Sky Villages, all seven YUNG's
mods, BiblioCraft, Chisel, Rechiseled (+ AE2, Create), Factory Blocks, all seven Macaw's mods, Fusion,
Cosmetic Armor Reworked, Simple Hats, Better Combat, Corpse, Baubley Heart Canisters, Elevator Mod, Trash
Cans, Tesseract, Secret Rooms, Iron Chests, Ender Storage, Chicken Chunks, Tool Belt, Waystones, Gravity
Gun, Walkers, ReMorphed, The Joke Book, Create More: Pipe Bombs, Bells & Whistles, Create Radar, Create
Aquatic Ambitions, Slice & Dice, and all **64 jars with no `data/` payload** (libraries, performance,
client QoL — listed in `01_INDEX.md`).

Four of those are owner judgement calls rather than progression calls, and I have left them open:
**Ender Storage** (defeats "each player earns their own" — a found sealed item can be handed around),
**Baubley Heart Canisters** (permanent max-health), **Gravity Gun** (block moving on a troll server) and
**ReMorphed / Walkers** (mob abilities including flight — and **not gateable by recipes at all**, only by
config).

---

## 5. Decisions taken

These were the judgement calls the brief left open, plus the two the owner has since made. Each one is now **decided and folded into §1–§3**;
the reasoning is here so you can overrule any of them with one edit.

**5.1 — Mystical Agriculture's Infusion Altar sits at tier 5, not tier 3.** It is the machine that turns
essence into *resources*, and at tier 3 it meant unlimited vanilla diamond, gold and redstone from about
day three, which flattens mining for the whole of week 1. At tier 5 it arrives with Soulium and the mob
seeds, which is where the mod's mid game belongs. The **diamond, emerald and netherite resource seeds are
held to tier 8** (§3a). The **Potato Tithe** relic is unaffected: it wants the crop side, open since
tier 1. *To overrule:* move `mysticalagriculture:infusion_altar` and `infusion_pedestal` back to tier 3
and drop `diamond|emerald` from the tier-8 seed regex.

**5.2 — The one tag stays, and the item it exists for is also listed by name.** `forge:ingots/steel` in
tier 3 covers all five mods' steel in one line. I had flagged `hasTag` as a risk; on reading
`blood_pool.js` again that was overcautious — **tag *locking* does not use `hasTag` at all.** Tags are
removed with `event.remove({ output: '#' + tag })` (line ~190), which is KubeJS's own tag resolution.
`hasTag` is only reached from `tierOf()`, which serves `/bloodpool check` and the `global.BloodPool` API
(lines 292–293, 358). So the worst a `hasTag` failure can do is make `/bloodpool check` misreport an item
that is covered *only* by a tag — and `tconstruct:steel_ingot`, the single item the tag uniquely catches,
is now **also listed explicitly in tier 3's `items`**, so `ITEM_TIER` answers first and the report is
exact. The tag is kept purely as insurance in case AlmostUnified folds another mod's steel into
`forge:ingots/steel` later (§6.3).

**5.3 — The Timewood Core stays on.** Recommendation: leave `disableTimeCore = false` and keep
`timeCoreRange = 8`, as the shipped `tools/serverconfig/twilightforest-common.toml` already has it.
Reasons: it is a *natural block* found in a magic tree, so it is a found-item treat exactly like Twilight
Forest's gear, which the owner has already decided is fine; through tiers 1–5 the machines it would
accelerate are sealed anyway; and it is one of TF's signature rewards. The belt-and-braces alternative —
`disableTimeCore = true` until about tier 6 — needs a **server restart**, not a `/reload`, so it fits this
engine badly: the whole point of the tier engine is that an unlock is one op command. Same reasoning for
`sortingCoreRange`, already 8. **Nothing applied.**

**5.4 — `alexscaves:nuclear_bomb` stays in tier 11, and that is a pacing decision, not a verdict on
whether you want it.** The tier engine's job is *when*, not *whether*. If you would rather it did not
exist on a server whose premise is trolling, that is a one-line removal independent of the Blood Pool:

```js
ServerEvents.recipes(event => { event.remove({ output: 'alexscaves:nuclear_bomb' }) })
```

Put that in its own script and it is gone at every tier. The same applies to
`gravitygun:supercharged_gravitygun` and `cmpackagepipebomb`, which I have left open.

**5.5 — Dimension locks: if Part I's carry over, tie them to tiers 3 and 9.** Tiers 3 and 5 assume the
Nether is reachable by about day 3 (IE's blast bricks, Create's blaze, Tinkers' cobalt, Ender IO's
Soularium and Mystical Agriculture's Soulium are one trip), and tiers 9–11 assume the End (End Steel, the
Chaos Islands, the Dragon). So:

- **Nether** — if the Pig Escort lock (`events/pig_escort.js`) returns in Part II, **open it at tier 3**.
  That is the tier that needs it, and it makes the Escort the tier-3 event rather than a separate gate
  players bounce off.
- **End** — if the End Lockdown Initiative (`end_lockdown.js`) returns, **open it at tier 9**, the tier
  that first needs the End and the first boss tier.

Both are one-line engine grants at unlock time, the same way a custom advancement would be. I cannot tell
from the jars or the repo whether either lock is planned for Part II — that is the one thing in this
section I am guessing at, so **confirm it** (§6.7).

**5.6 — Twilight Forest is open from the start, by item not by namespace.** Owner's decision, confirmed
as the right mechanism: `tfEnforcedProgression` already gates TF biome by boss, the portal cannot be
gated by recipes, and a namespace lock would strip TF planks, doors, chests, boats, banisters and its
stonecutting from players standing in the dimension. Its gear is spread across tiers 4–9 to mirror TF's
own boss order (steeleaf → knightmetal → fiery and yeti → carminite and arctic → giant). No
`portalUnlockedByAdvancement`, no `disablePortalCreation`, no `adminOnlyPortals`.

**5.7 — Tinkers' Construct is never locked as a namespace.** 2,981 outputs including seared bricks, the
smeltery and every cross-mod melt and cast the pack depends on. Tiered by item and recipe id instead, so
the smeltery works from day 0 and the materials arrive on schedule. Same call for `hexerei` (a wood set),
`createdeco` (1,727 decorative outputs) and `alexsmobs` (mob-drop gear).

**5.8 — `tinkerslevellingaddon` is left unlocked.** It ships no items, so there is nothing to put in a
tier. It does give tools extra modifier slots as they level, which is a quiet power curve the engine
cannot see — worth knowing, not worth acting on.

**5.9 — The proposal never uses the `not: { output: [...] }` filter.** By putting each big mod's namespace
at the tier it *starts* and its end-game items in *later* tiers, every removal is a plain
`{ output: id }` or `{ mod: ns }`. That is deliberate: the one filter form `BLOOD_POOL.md` lists as
unverified in game is now unused. Worth re-testing anyway if you later add an early item for a late mod.

**5.10 — Ore-creation routes are flagged, not blocked.** Three routes make ore from renewable blocks and
I have left all three to their mods' tiers rather than cutting them: `botania:orechid_ignem/ancient_debris`
(netherrack → ancient debris, tier 2 with Botania — it needs a mature mana farm, so in practice it lands
around tier 5), `immersiveengineering:mineral/ancient_debris` (Excavator veins, tier 3 — but the Excavator
needs `component_steel`, so tier 5 in practice), and AgriCraft's resource crops (tier 8 by recipe id).
If you want netherite to stay a Nether trip, §3c has the single id to remove.


**5.11 — Thresholds doubled, nothing re-tiered.** Owner's decision: 20,000 → 3,000,000. The *contents*
of the twelve tiers are unchanged — what each tier gives is still the right shape, it simply costs twice
as much blood to get there. I did **not** also make recipes dearer (that was the alternative reading, and
it was declined), so every item in §1 still costs exactly what its mod ships. The one knock-on is the
pace, which §1's table works through and §7 pays for.

**5.12 — The Potato Tithe is 4,000:1,000, capped at 30,000 Drops/day server-wide.** §7 specifies it as
`POTATOES_PER_DROP = 4` with `POTATO_DROPS_CAP_PER_DAY = 30000`. The rate is exactly as asked; the cap is
there because §7.3 found that this pack farms potatoes with the IE Garden Cloche (tier 3) and the Thermal
Phytogenic Insolator (tier 5), both farmland-free, so an uncapped 4:1 would have let a ten-machine bank
earn ~150,000 Drops/day against a 25,000/day trolling target and reach tier 12 in about three weeks. With
the cap the arc is bounded at **8 weeks fastest, ~17 weeks if nobody farms**, and §1's two columns become a
real floor and ceiling rather than an estimate. The per-player cap (`POTATO_DROPS_CAP_PER_PLAYER`) ships
off; §7.4 says when to turn it on. *To overrule:* set the cap to `0` and consider the decaying rate in
§7.4 instead.

---

## 6. What I could not verify from the jars

These are honest gaps, not oversights. Each one needs a look at the running server, not at the jars.

**6.1 — Thermal's core parts have no shipped recipe.** `thermal:machine_frame`, `thermal:rf_coil`,
`thermal:redstone_servo`, `thermal:energy_cell_frame`, `thermal:tinker_bench` and
`thermal:upgrade_augment_1/2/3` appear in the jars only as *ingredients*. I checked the extracted trees,
then grepped the raw `thermal_foundation`, `thermal_expansion` and `cofh_core` jars: the only other
mention is `cofh/thermal/expansion/init/data/providers/TExpRecipeProvider.class`, the dev-time datagen
provider, whose output was not shipped. `PROGRESSION_GATES.md` claims 1 recipe each, so either the old
research counted the provider or Thermal registers them at runtime. **Check in JEI** that they have
recipes at all, and that those recipes disappear while `thermal` is sealed. The proposal does not depend
on it — the `thermal` namespace lock covers the machines either way — but the three
`thermal:upgrade_augment_*` lines in tier 7 are no-ops if the recipes do not exist.

**6.2 — `enderio:chests/common_loot` and `alloy_loot`** hand out Dark Steel and the mid alloys, but
**nothing in the pack's data references them** — they are attached in code, so I cannot say which
structures roll them or how often.

**6.3 — AlmostUnified ships no `data/` at all.** Its tag unification is applied at runtime from
`config/almostunified/`, and it can rewrite recipe *ingredients* so a sealed mod's ingot is accepted where
an open mod's was expected. **Read that config on the server** and check that no `forge:ingots/*` tag has
a sealed mod as its unified target. This is the one thing that could quietly change what the tier-3 steel
tag covers.

**6.4 — `lootintegrations` + `lootintegrations_moog`** replace vanilla and Moog structure loot with
`lootintegrations:chests/{easy,medium,hard,nether,water,village,jungle_temple,empty}`. Those tables are
**not in the jars' data** — code-registered — so I cannot list what they give. Everything in
`03_BYPASSES.md` §6 about structure loot is therefore about the *mods'* tables, not these.

**6.5 — `dragonfight` and `bfendcities` ship no data but change the Ender Dragon fight and End cities.**
Whether `draconicevolution:dragon_heart` still drops above the exit portal is not something the data can
tell me, and tiers 10–11 depend on it. **Test one dragon kill** before tier 10 matters.
`PROGRESSION_MODS.md` flags the same thing.

**6.6 — The `recipes:` field does not exist yet.** `BLOOD_POOL.md` calls it "a planned addition". §3
assumes it accepts exact ids and regexes, the way `event.remove({ id: … })` already does. Until it is
built, §3a and §3b drop into a separate `ServerEvents.recipes` handler that reads
`kubejs/blood_pool_tier.json` the same way the main one does.

**6.7 — Whether the Nether and End locks carry into Part II.** §5.5 recommends tiers 3 and 9 if they do,
but nothing in the jars or the repo says whether they are planned. This is the only decision in §5 built
on a guess.

**6.8 — MNS is not in the folder.** The tiers are planned without a Nether structure mod. If it is added,
it needs a pass-3-style loot scan, but **no tier would move**: every structure mod in this pack gives
components and gear, never a machine (checked across 1,906 rows of non-block loot —
`03_BYPASSES.md` §6).

**6.9 — Runtime behaviours the tier engine cannot touch at all.** `remorphed` and `walkers` give players
mob abilities including flight; the Timewood Core accelerates any mod's machines; `tfEnforcedProgression`
gates TF; `enderstorage` lets a found sealed item be handed to anyone. All config or design, not recipes.

**6.10 — Nothing came from a wiki.** Every recipe count, item id, recipe type, tag member and loot entry
in this document and in passes 1–3 came from the Part II jars' own `data/`. The only non-jar sources are
the repo's own docs (`PROGRESSION_GATES.md`, `MOD_TIERS.md`, `STARTING_MODS.md`, `PROGRESSION_MODS.md`,
`STORY.md`, `BLOOD_POOL.md`), the shipped `twilightforest-common.toml`, and `blood_pool.js` itself — and
where those disagreed with the jars, the jars won and the disagreement is recorded (§6.1 is the one case).

---

## 7. The Potato Tithe — potatoes into the Blood Pool

**The rate, as asked: 4,000 potatoes = 1,000 Drops.** Expressed as an integer so the Pool never has to
hold a fraction of a Drop: **`POTATOES_PER_DROP = 4`**. A stack of 64 potatoes is 16 Drops; a full
inventory of 36 stacks is 576 Drops; a Hush Coin (1,000 Drops) is worth 4,000 potatoes.

It fits the fiction exactly: the Potato War is the Technoblade reference `STORY.md` already builds the
**Potato Tithe** relic on, and the Ministry accepting potatoes at a humiliating rate is the right kind of
bureaucratic insult.

### 7.1 What it looks like in play

| Command | Who | What it does |
|---|---|---|
| `/bloodpool tithe` | players | Tithes **every** potato you are carrying, rounded down to whole Drops |
| `/bloodpool tithe <potatoes>` | players | Tithes exactly that many |

Crates count, so nobody has to un-craft a warehouse by hand: `quark:potato_crate`,
`farmersdelight:potato_crate` and `thermal:potato_block` are each **9 potatoes** (all three verified as
3×3 recipes in the jars). If taking a crate overshoots what was asked for, the change comes back as loose
potatoes. Only the raw potato counts — `minecraft:poisonous_potato`, baked potatoes and every
`pamhc2food*` potato dish are worth nothing, by design.

Drops from the tithe are credited to the player like coins, so `/bloodpool top` and the Part II titles
pick them up, and they are tracked separately in the saved data as `from.potatoes`.

**The daily quota.** The tithe is capped at **30,000 Drops a day server-wide** (§7.4), which is about
120,000 potatoes. A tithe that would go over takes only what fits and says so; once the quota is full the
command refuses until UTC midnight. Nothing is consumed when it refuses.

### 7.2 Reference implementation

A drop-in for `blood_pool.js`, in the script's own style (no template strings, `let` inside blocks,
`const` at function level). **Untested** — see the note at the end of this section.

```js
// ===== SETTINGS: add next to DROPS_PER_COIN =====

const POTATOES_PER_DROP = 4             // 4,000 potatoes = 1,000 Drops. See BLOOD_POOL.md.
const POTATO_DROPS_CAP_PER_DAY = 30000  // most Drops the WHOLE SERVER can tithe in a day; 0 = no cap
const POTATO_DROPS_CAP_PER_PLAYER = 0   // and per player per day; 0 = off. Turn on if the server cap becomes a race.
// What the tithe accepts, and what each is worth in potatoes. All three crates are 3x3 = 9.
const POTATO_WORTH = {
  'minecraft:potato': 1,
  'quark:potato_crate': 9,
  'farmersdelight:potato_crate': 9,
  'thermal:potato_block': 9,
}

// ===== SAVED DATA: three more defaults in db(), beside the other DB default lines =====

  if (!DB.potatoDay) DB.potatoDay = ''           // the UTC date the two counters below belong to (YYYY-MM-DD)
  if (!DB.potatoDrops) DB.potatoDrops = 0        // Drops tithed server-wide today
  if (!DB.potatoByPlayer) DB.potatoByPlayer = {} // uuid -> Drops tithed today

// ===== HELPERS: add near countPotatoes' neighbours =====

function potatoWorth(stack) {
  try { return POTATO_WORTH[String(stack.getId())] || 0 } catch (e) { return 0 }
}
// Potatoes the player is carrying, counting each crate as 9.
function countPotatoes(p) {
  const inv = p.inventory
  let total = 0
  for (let i = 0; i < inv.size; i++) {
    let s = inv.get(i)
    if (s && !s.isEmpty()) total += potatoWorth(s) * s.getCount()
  }
  return total
}
// Takes at least n potatoes' worth: loose potatoes first, then crates. Any overshoot from breaking a
// crate is given back as loose potatoes. Returns what was actually consumed (== n when it succeeds).
function takePotatoes(p, n) {
  const inv = p.inventory
  let left = n
  ;[1, 9].forEach(worth => {
    for (let i = 0; i < inv.size && left > 0; i++) {
      let s = inv.get(i)
      if (!s || s.isEmpty() || potatoWorth(s) != worth) continue
      let want = Math.ceil(left / worth)
      let use = Math.min(s.getCount(), want)
      s.setCount(s.getCount() - use)
      inv.set(i, s.getCount() > 0 ? s : Item.empty)
      left -= use * worth
    }
  })
  if (left < 0) {                                   // a crate overshot: hand back the change
    try { p.give(Item.of('minecraft:potato', -left)) } catch (e) { console.error('[BloodPool] potato change: ' + e) }
    left = 0
  }
  return n - left
}
// Rolls the daily counters over at UTC midnight, then reports today's totals.
function potatoToday(uuid) {
  const D = db(), today = new Date().toISOString().slice(0, 10)
  if (D.potatoDay != today) { D.potatoDay = today; D.potatoDrops = 0; D.potatoByPlayer = {} }
  return { server: D.potatoDrops || 0, player: D.potatoByPlayer[uuid] || 0 }
}
// Drops this player may still tithe today. -1 = no limit at all.
function potatoRoom(uuid) {
  if (POTATO_DROPS_CAP_PER_DAY <= 0 && POTATO_DROPS_CAP_PER_PLAYER <= 0) return -1
  const t = potatoToday(uuid)
  let room = -1
  if (POTATO_DROPS_CAP_PER_DAY > 0) room = POTATO_DROPS_CAP_PER_DAY - t.server
  if (POTATO_DROPS_CAP_PER_PLAYER > 0) {
    let mine = POTATO_DROPS_CAP_PER_PLAYER - t.player
    room = room < 0 ? mine : Math.min(room, mine)
  }
  return Math.max(0, room)
}

// ===== COMMAND: add to the /bloodpool chain, beside the 'donate' branch =====
// The Math.max(0) matters: Arguments.INTEGER allows negatives, and a negative asked would fall through
// to the tithe-everything branch, so /bloodpool tithe -5 would empty the player out.

    .then(Commands.literal('tithe')
      .executes(safe(ctx => tithe(ctx, 0)))
      .then(int('potatoes').executes(safe(ctx => tithe(ctx, Math.max(0, Math.floor(num(ctx, 'potatoes'))))))))

// ===== and the handler, beside the other command helpers =====

function tithe(ctx, asked) {
  const p = me(ctx)
  if (!p) return reply(ctx, 'Players only.', true)
  const uuid = uuidOf(p), have = countPotatoes(p)
  if (have < POTATOES_PER_DROP) return reply(ctx, 'The Ministry weighs potatoes by the thousand. You carry ' + have + '.', true)

  let want = asked > 0 ? Math.min(asked, have) : have
  let drops = Math.floor(want / POTATOES_PER_DROP)          // only whole Drops
  if (!drops) return reply(ctx, 'That is not enough potatoes to register. ' + POTATOES_PER_DROP + ' potatoes make one Drop.', true)

  const room = potatoRoom(uuid)                             // -1 = uncapped
  if (room == 0) return reply(ctx, 'The Ministry will not weigh another potato today. Come back tomorrow.', true)
  if (room > 0 && drops > room) drops = room

  const spend = drops * POTATOES_PER_DROP
  if (takePotatoes(p, spend) < spend) return reply(ctx, 'The potatoes slipped away. Nothing was tithed.', true)

  const D = db()
  D.potatoDrops = (D.potatoDrops || 0) + drops
  D.potatoByPlayer[uuid] = (D.potatoByPlayer[uuid] || 0) + drops
  addDrops(drops, 'potatoes', uuid, nameOf(p), 0)
  console.info('[BloodPool] ' + nameOf(p) + ' tithed ' + spend + ' potatoes (' + drops + ' Drops)')
  let msg = fmt(spend) + ' potatoes weighed and accepted: ' + fmt(drops) + ' Drops.'
  if (room > 0 && drops == room) msg += ' That is the day\'s quota filled.'
  return reply(ctx, msg + ' ' + statusText())
}
```

Three other one-line edits to match: add `potatoes` to the `from` totals in the saved-data comment, add
`tithe` to the command list in the file header, and add a line to `BLOOD_POOL.md`'s "Filling the Pool"
table.

### 7.3 Why 4,000:1,000 is far more generous than it sounds — what the cap is sized against

"Drastically inflated" is true for a player with a hoe. It is not true for this pack, because **four
different mods automate potatoes with no farmland at all**, and three of them open early:

| Route | Opens | From the jar | Net yield |
|---|---|---|---|
| Mystical Agriculture essence | **tier 1** | `mysticalagriculture:essence/minecraft/potato` | Inferium essence → potatoes, day one |
| Botania mana infusion | **tier 2** | `botania:mana_infusion/wheat_seeds_to_potato` | wheat seeds (infinitely renewable) → potatoes, limited only by mana |
| **IE Garden Cloche** | **tier 3** | `immersiveengineering:cloche/potato` — `time: 800` ticks, `results: 2`, input 1 | **net +1 potato per 40 s per cloche** → ~90/hour, ~180/hour with Fertilizer. Cloches are cheap and tile |
| **Thermal Phytogenic Insolator** | **tier 5** | `thermal:machines/insolator/insolator_potato` — `chance: 2.5` out per 1 in | **net +1.5 potatoes per cycle**, and the cycle takes speed augments → roughly 2,000–2,700/hour per machine |

What that converts to at 4 potatoes per Drop:

| Potato production | Drops/hour | Drops/day | Against the 25,000/day trolling target |
|---|---|---|---|
| hand farming | ~50 | ~1,000 | a rounding error |
| 1 Garden Cloche | 22 | ~540 | a rounding error |
| ~20 cloches, or 1 augmented Insolator | 500 | **12,000** | half the server's trolling |
| a real farm (~5,000 potatoes/hour) | 1,250 | **30,000** | **matches the entire server's trolling** |
| a 10-Insolator bank (tier 5) | 6,250 | **150,000** | **6× the entire server's trolling** |

So the rate is self-balancing for the first few days and then isn't. **This table is what the daily cap is
sized against**: the cap is set at the "a real farm" row — 30,000 Drops/day — which is the number that
brings the doubled thresholds back to `STORY.md`'s 8-week arc. Everything below that row is unaffected and
earns exactly what it farms; everything above it earns the same 30,000 as one good farm, so the bottom two
rows of this table collapse into each other and the Insolator-bank three-week run cannot happen. §7.4 has
the setting and the consequences.

### 7.4 The daily cap — what is set, and why

**`POTATO_DROPS_CAP_PER_DAY = 30000`, server-wide. Owner's decision, and it is on in §7.2.**

The cap keeps the 4,000:1,000 rate completely untouched — it only stops the fire hose. One good potato
farm still earns its full 30,000 Drops/day; a ten-Insolator bank earns exactly the same, so there is no
reason to over-build and no advantage in doing so. The effects are worth spelling out:

- **The arc is now bounded at both ends**: 8 weeks at the fastest, ~17 weeks if nobody farms. Before the
  cap the fast end was about three weeks, which would have hollowed out tiers 5–12.
- **Trolling stays the main engine.** At the cap, potatoes contribute 30,000/day against trolling's
  25,000 — a bit over half the Pool. Significant, which is the point, but not dominant.
- **Filling the quota is a daily ritual**, which suits a server built on daily events: ~120,000 potatoes a
  day, about a 5,000/hour farm running flat out, or a smaller farm plus a buffer.
- The player who fills the last of the quota is told so (`That is the day's quota filled.`), so nobody
  wastes a warehouse run.

**The one rough edge: the cap is server-wide, so it is first-come-first-served.** One player with a big
farm can take the whole day's quota at breakfast. If that annoys people, set
`POTATO_DROPS_CAP_PER_PLAYER = 4000` — with nine players that is the same 30,000/day ceiling, but shared
out, and both caps are checked so whichever is tighter binds. It ships at `0` (off) because splitting a
quota nine ways only matters once someone complains.

**Two alternatives I did not use**, recorded in case the cap disappoints:

- **Worsen the rate instead.** `POTATOES_PER_DROP = 64` — a stack per Drop. A 5,000/hour farm then earns
  1,875 Drops/day rather than 30,000, making potatoes flavour rather than economy. That pushes §1's
  schedule back towards the 17-week column, so it only works if some thresholds come back down.
- **A decaying rate — the most thematic.** The Ministry devalues the potato as the Pool floods: add 1 to
  `POTATOES_PER_DROP` for every 100,000 potatoes the server has ever tithed. Early potatoes are 4:1, the
  millionth is 14:1, and no cap or policing is needed because the curve does it. About six lines on top of
  §7.2, and it reads like something the Ministry would actually do. If you ever want to drop the cap, this
  is what to replace it with.

### 7.5 Two interactions worth knowing

**The relic of the same name.** `STORY.md`'s Regalia includes **The Potato Tithe** — 10,000 potatoes
delivered to the Shrine. At 4:1 those same 10,000 potatoes are only 2,500 Drops, so the relic is cheap by
comparison and players will simply do both. That is fine, and the shared name is the joke rather than a
clash, but the two sinks should not surprise anyone: consider having a relic delivery **also** credit its
Drops, so one potato grind pays twice and nobody feels they picked the wrong pile.

**Hush Coins.** 1 coin = 1,000 Drops = 4,000 potatoes. Whether potatoes matter at all depends on how
freely `economy/black_market.js` hands out coins — if coins are easy, nobody will ever tithe a potato; if
coins are scarce, the tithe becomes the floor on Pool income. I have not read `black_market.js` in this
pass, so **check the coin faucets against this rate** before going live.

### 7.6 What is not verified

The code in §7.2 has **not been run.** CLAUDE.md records that the mock KubeJS server lived in an earlier
session's scratchpad and is not in the repo, so there was nothing here to test against. Three specific
things to check when it is wired in:

- **The inventory API.** `p.inventory`, `.size`, `.get(i)`, `.set(i, stack)`, `Item.empty` and
  `p.give(Item.of(...))` are the KubeJS 6 names I believe are right for 2001.6.5, but they are the one
  part I could not confirm from the jars. If they differ, only `countPotatoes` and `takePotatoes` change.
- **`stack.getId()`** returning the plain `namespace:path` for crates as well as potatoes.
- **The change refund** when a crate is broken to cover a remainder — tithe 5 potatoes while carrying only
  crates and check that 4 come back.
- **The daily rollover.** `new Date().toISOString().slice(0, 10)` makes the quota reset at **UTC
  midnight**, not server-local midnight — so for a UK-evening server the quota refreshes mid-session. That
  is deliberate (it needs no timezone config and cannot drift), but if the reset wants to land at, say,
  5am local, offset the date before slicing it.
- **The counters survive a restart.** `db()` fills in missing keys without stripping unknown ones and
  `save()` writes the whole object, so `potatoDay`, `potatoDrops` and `potatoByPlayer` persist — I checked
  that against `blood_pool.js` rather than assuming it. The three default lines in §7.2 are only there to
  make the schema explicit, in the style of the existing ones.
