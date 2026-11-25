// Paste-ready replacement for the TIERS array in
// tools/kubejs/server_scripts/part2/blood_pool.js
// Thresholds are DOUBLED from the script's defaults: 20,000 -> 3,000,000 (owner's decision).
// Pair with the Potato Tithe (4,000 potatoes = 1,000 Drops): research/TIER_PROPOSAL.md section 7.
// Rationale, per-tier notes and the recipe-id lists: research/TIER_PROPOSAL.md
// Generated 2026-11-01 from the Part II jar set (207 jars). Proposal only - not applied.

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
