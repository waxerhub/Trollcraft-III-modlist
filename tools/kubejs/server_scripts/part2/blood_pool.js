// Part II: Blood for the Blood God. The Blood Pool and its tier locks (see STORY.md, tools/kubejs/BLOOD_POOL.md).
//
//  - All progression is locked into 12 tiers. Locks are crafting only: a tier's mods, items and tags can't be crafted
//    (their recipes are removed, in every recipe type) until the server-wide Blood Pool reaches it AND an op breaks the
//    seal with /bloodpool unlock (which reloads, so the recipes come back). Found, looted or traded items work normally.
//  - The Pool fills with every troll in the Troll Log (economy/trolls.js), with donated Hush Coins and with the
//    Potato Tithe (4,000 potatoes = 1,000 Drops, capped per day; the quota resets at 4 am Central).
//  - Anything not listed in any tier is always open. The Nether and End open at their tiers (part2/dimension_gates.js).
//  - The Potato War: each player's Potato Standing (rank) is the lifetime count of potatoes they've offered to
//    Techno's war chest with /potatowar offer. Those potatoes never fill the Pool (and tithed ones never raise rank).
//    A tier's crafting-table recipes need the tier open AND, for a player crafting them, their rank at that tier
//    (KubeJS stages potato_standing_<n>, checked when the result is made). Machines and autocrafters work for
//    everyone, but placing an autocrafter needs its tier's rank. economy/black_market.js locks some items by rank too.
//
// Commands: /bloodpool [donate <coins>|tithe [potatoes]|top|tiers|check] (anyone);
//           /bloodpool unlock [force]|settier <n>|add|set (op).
//           /potatowar [offer [potatoes]|top|ranks] (anyone); /potatowar check|add|set <player> ... (op).
// Copy to <server>/kubejs/server_scripts/part2/ and run /reload. Part II only: not for the Part I server.
//
// KubeJS 6 notes: no template strings; `let` inside nested blocks; event.cancel() last. Recipes load before the world
// (and its saved data) at server start, so the open tier is also kept in TIER_FILE, which the recipe event reads.

(function () {

// ===================== SETTINGS =====================

// The tiers, in order. drops: the Pool total that makes it ready. unlocks: what it opens.
//   mods:    item namespaces (every item and block of the mod, and every recipe in its namespace)
//   items:   item ids. Listed in a LATER tier than its mod: still sealed after the mod opens (the usual case:
//            a mod opens at its first tier, its end-game items later). Listed EARLIER than its mod: opens early.
//   tags:    item tags without the # (e.g. 'forge:ingots/steel')
//   recipes: recipe ids, exact ('iceandfire:dragonforge/dragonsteel_fire_ingot') or a regex (/^mod:path\//),
//            for what an item can't express: Tinkers materials (NBT on generic tools), Mystical Agriculture's
//            cross-mod essences and seeds, recipes whose output is a vanilla item that must stay open.
// Filled from research/TIER_PROPOSAL.md (the reasoning per tier is there). Twilight Forest and Tinkers are never
// locked as namespaces (their gear and materials are tiered by item and recipe id), so both work from day 0.
// Ironwood (TF's first metal, about iron tier) is open from the start.
const TINKERS_MATERIALS = list => new RegExp('^tconstruct:tools/materials/((casting|melting|composite)/)?(' + list.join('|') + ')(/|$)')
// Tinkers casts its metals into ingots, nuggets and blocks with recipes whose result is a TAG (forge:ingots/cobalt),
// which an item lock may not see, so each sealed metal's casting is also locked by recipe id.
const TINKERS_CASTING = list => new RegExp('^tconstruct:smeltery/casting/metal/(' + list.join('|') + ')/')
// Melting a sealed metal in the smeltery or foundry (its ore, raw metal, ingots, nuggets, blocks and gear made of
// it) is locked too, so locked materials can't enter the smeltery at all until their tier.
const TINKERS_MELTING = list => new RegExp('^tconstruct:smeltery/melting/(metal/)?(' + list.join('|') + ')/')
const MA_ESSENCE = (dir, list) => new RegExp('^mysticalagriculture:essence/' + dir + '/(' + list.join('|') + ')$')
const MA_SEEDS = list => new RegExp('^mysticalagriculture:seed/(infusion|crafting)/(' + list.join('|') + ')$')
const TIERS = [
  { tier: 1, name: 'A Trickle', drops: 20000, unlocks: {
      mods: ['create', 'mysticalagriculture'],
      items: [], tags: [], recipes: [] } },

  { tier: 2, name: 'A Puddle', drops: 60000, unlocks: {
      mods: ['botania', 'ars_nouveau', 'evilcraft'],
      items: ['hexerei:mixing_cauldron', 'hexerei:blood_bottle'],
      tags: [],
      recipes: [
        MA_ESSENCE('botania', ['manasteel_ingot', '[a-z_]+_mystical_flower']), MA_SEEDS(['manasteel', 'mystical_flower'])] } },

  { tier: 3, name: 'A Basin', drops: 120000, unlocks: {
      mods: ['immersiveengineering'],
      items: [
        'create:copper_casing', 'create:fluid_pipe', 'create:mechanical_pump', 'create:fluid_tank',
        'create:steam_engine', 'create:electron_tube', 'create:brass_casing', 'create:brass_hand',
        'create:crushing_wheel', 'create:spout', 'create:item_drain',
        'tconstruct:steel_ingot'],
      tags: ['forge:ingots/steel'],
      recipes: [
        TINKERS_MATERIALS(['steel']), TINKERS_CASTING(['steel']), TINKERS_MELTING(['steel']),
        MA_ESSENCE('immersiveengineering', ['hop_graphite_ingot']), MA_ESSENCE('common', ['steel_ingot', 'aluminum_ingot']),
        MA_SEEDS(['steel', 'aluminum', 'hop_graphite'])] } },

  { tier: 4, name: 'A Font', drops: 200000, unlocks: {
      mods: ['mekanism', 'mekanismgenerators', 'tinker_rapier'],
      items: [
        'create:precision_mechanism', 'create:mechanical_crafter', 'create:deployer',
        'create:mechanical_arm', 'create:rotation_speed_controller',
        'twilightforest:steeleaf_ingot', 'twilightforest:steeleaf_block',
        'twilightforest:steeleaf_helmet', 'twilightforest:steeleaf_chestplate',
        'twilightforest:steeleaf_leggings', 'twilightforest:steeleaf_boots',
        'twilightforest:steeleaf_sword', 'twilightforest:steeleaf_pickaxe',
        'twilightforest:steeleaf_axe', 'twilightforest:steeleaf_shovel', 'twilightforest:steeleaf_hoe'],
      tags: [],
      recipes: [
        TINKERS_MATERIALS(['osmium', 'steeleaf']), TINKERS_CASTING(['osmium', 'steeleaf']),
        TINKERS_MELTING(['osmium', 'steeleaf', 'refined_glowstone']),
        TINKERS_CASTING(['refined_glowstone']), 'tconstruct:compat/refined_glowstone_ingot',   // its result is a tag (audit)
        MA_ESSENCE('mekanism', ['osmium_ingot', 'refined_glowstone_ingot', 'fluorite']), MA_ESSENCE('twilightforest', ['steeleaf_ingot']),
        MA_SEEDS(['osmium', 'refined_glowstone', 'fluorite', 'steeleaf'])] } },

  { tier: 5, name: 'A Spring', drops: 320000, unlocks: {
      mods: ['thermal', 'enderio'],
      items: [
        'tconstruct:cobalt_ingot', 'tconstruct:raw_cobalt', 'tconstruct:raw_cobalt_block', 'tconstruct:cobalt_block',
        'tconstruct:nether_grout', 'tconstruct:scorched_brick', 'tconstruct:foundry_controller',
        'tconstruct:scorched_alloyer', 'tconstruct:scorched_fuel_gauge', 'tconstruct:scorched_ingot_gauge',
        'mekanism:purification_chamber', 'mekanism:advanced_control_circuit',
        'mekanism:chemical_injection_chamber', 'mekanism:electrolytic_separator',
        'mysticalagriculture:infusion_altar', 'mysticalagriculture:infusion_pedestal',
        'mysticalagriculture:soulium_ingot', 'mysticalagriculture:soulium_seed_base',
        'mysticalagriculture:soul_jar', 'mysticalagriculture:soulium_dagger',
        'twilightforest:knightmetal_ingot', 'twilightforest:armor_shard_cluster', 'twilightforest:knightmetal_block',
        'twilightforest:knightmetal_helmet', 'twilightforest:knightmetal_chestplate',
        'twilightforest:knightmetal_leggings', 'twilightforest:knightmetal_boots',
        'twilightforest:knightmetal_sword', 'twilightforest:knightmetal_axe', 'twilightforest:knightmetal_pickaxe',
        'twilightforest:knightmetal_ring', 'twilightforest:knightmetal_shield', 'twilightforest:block_and_chain'],
      tags: [],
      recipes: [
        TINKERS_MATERIALS(['cobalt', 'scorched_stone', 'knightmetal', 'knightly']), TINKERS_CASTING(['cobalt', 'knightmetal']),
        // the audit found these routes, whose results are tags the item locks can't see: Thermal's alloys made in the
        // Tinkers smeltery, and Immersive Engineering's cobalt (crusher, arc furnace, press, hammer)
        TINKERS_CASTING(['enderium', 'lumium', 'signalum']), /^tconstruct:smeltery\/alloys\/molten_(enderium|lumium|signalum)$/,
        /^immersiveengineering:.*cobalt/,
        TINKERS_MELTING(['cobalt', 'knightmetal', 'enderium', 'lumium', 'signalum']),
        'tconstruct:common/materials/cobalt_ingot_blasting', 'tconstruct:common/materials/cobalt_nugget_blasting',
        /^mysticalagriculture:essence\/(enderio|thermal)\//,
        MA_ESSENCE('tconstruct', ['cobalt_ingot']), MA_ESSENCE('twilightforest', ['knightmetal_ingot']),
        MA_ESSENCE('common', ['tin_ingot', 'lead_ingot', 'nickel_ingot', 'silver_ingot', 'bronze_ingot', 'brass_ingot', 'invar_ingot',
          'constantan_ingot', 'electrum_ingot', 'zinc_ingot', 'tungsten_ingot', 'graphite_ingot', 'silicon']),
        MA_ESSENCE('gems', ['ruby', 'sapphire', 'peridot', 'apatite']),
        MA_SEEDS(['cobalt', 'knightmetal', 'dark_steel', 'grains_of_infinity', 'soularium', 'conductive_alloy', 'copper_alloy',
          'energetic_alloy', 'pulsating_alloy', 'redstone_alloy', 'vibrant_alloy', 'enderium', 'lumium', 'signalum',
          'basalz', 'blitz', 'blizz', 'tin', 'lead', 'nickel', 'silver', 'bronze', 'brass', 'invar', 'constantan', 'electrum',
          'zinc', 'tungsten', 'graphite', 'silicon', 'ruby', 'sapphire', 'peridot', 'apatite'])] } },

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
        'twilightforest:fiery_ingot', 'twilightforest:fiery_block',
        'twilightforest:fiery_helmet', 'twilightforest:fiery_chestplate', 'twilightforest:fiery_leggings',
        'twilightforest:fiery_boots', 'twilightforest:fiery_sword', 'twilightforest:fiery_pickaxe',
        'twilightforest:yeti_helmet', 'twilightforest:yeti_chestplate', 'twilightforest:yeti_leggings', 'twilightforest:yeti_boots'],
      tags: [],
      recipes: [
        TINKERS_MATERIALS(['electrum', 'invar', 'constantan', 'silver', 'lead', 'pewter', 'aluminum', 'fiery']),
        TINKERS_MELTING(['electrum', 'invar', 'constantan', 'silver', 'lead', 'pewter', 'aluminum', 'fiery', 'uranium']),
        /^tconstruct:tables\/recycling\/twilightforest\/yeti_/,
        /^tconstruct:smeltery\/casting\/fiery\//,                         // fiery ingots and blocks (a tag result; audit)
        /^mysticalagriculture:essence\/(appliedenergistics2|extremereactors2)\//,
        MA_ESSENCE('botania', ['terrasteel_ingot', 'elementium_ingot']), MA_ESSENCE('common', ['uranium_ingot']),
        MA_ESSENCE('twilightforest', ['fiery_ingot']),
        MA_SEEDS(['certus_quartz', 'fluix', 'sky_stone', 'terrasteel', 'elementium', 'yellorium', 'cyanite', 'uranium', 'uraninite', 'fiery_ingot'])] } },

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
        'twilightforest:carminite', 'twilightforest:carminite_block', 'twilightforest:carminite_reactor',
        'twilightforest:carminite_builder',
        'twilightforest:arctic_fur', 'twilightforest:arctic_helmet', 'twilightforest:arctic_chestplate',
        'twilightforest:arctic_leggings', 'twilightforest:arctic_boots', 'twilightforest:charm_of_keeping_3',
        'twilightforest:twilight_scepter', 'twilightforest:zombie_scepter',
        'twilightforest:lifedrain_scepter', 'twilightforest:fortification_scepter'],
      tags: [],
      recipes: [
        /^tconstruct:tables\/recycling\/twilightforest\/arctic_/,
        TINKERS_MELTING(['refined_obsidian']),
        TINKERS_CASTING(['refined_obsidian']), 'tconstruct:compat/refined_obsidian_ingot', 'tconstruct:smeltery/alloys/molten_refined_obsidian',
        /^mysticalagriculture:essence\/redstone_arsenal\//, MA_ESSENCE('mekanism', ['refined_obsidian_ingot']),
        MA_SEEDS(['flux_infused_ingot', 'flux_infused_gem', 'refined_obsidian'])] } },

  { tier: 8, name: 'A Flood', drops: 1000000, unlocks: {
      mods: ['taiga', 'tcintegrations', 'createbigcannons', 'mekanismtools', 'mekanism_weaponry',
             'advanced_ae', 'create_sabers'],
      items: [
        'tconstruct:manyullyn_ingot', 'tconstruct:manyullyn_block', 'tconstruct:manyullyn_nugget',
        'tconstruct:hepatizon_ingot', 'tconstruct:hepatizon_block', 'tconstruct:hepatizon_nugget',
        'tconstruct:queens_slime_ingot', 'tconstruct:queens_slime_block', 'tconstruct:queens_slime_nugget',
        'tconstruct:cinderslime_ingot', 'tconstruct:cinderslime_block', 'tconstruct:cinderslime_nugget',
        'hexerei:mahogany_broom', 'hexerei:broom_netherite_tip',
        'alexsmobs:tarantula_hawk_elytra',
        'twilightforest:giant_sword', 'twilightforest:giant_pickaxe'],
      tags: [],
      recipes: [
        TINKERS_MATERIALS(['manyullyn', 'hepatizon', 'queens_slime', 'cinderslime', 'necronium', 'blazing_bone', 'blazewood',
          'ancient', 'enderslime', 'ichor']),
        TINKERS_CASTING(['manyullyn', 'hepatizon', 'queens_slime', 'cinderslime']),
        TINKERS_MELTING(['manyullyn', 'hepatizon', 'queens_slime', 'cinderslime']),
        /^immersiveengineering:.*(manyullyn|hepatizon|queens_slime|cinderslime)/,   // IE's arc furnace and alloy kiln (audit)
        'agricraft:diamond', 'agricraft:emerald', 'agricraft:netherite_scrap',
        MA_ESSENCE('tconstruct', ['manyullyn_ingot', 'hepatizon_ingot', 'queens_slime_ingot']),
        MA_ESSENCE('minecraft', ['netherite_ingot']),
        MA_SEEDS(['manyullyn', 'hepatizon', 'queens_slime', 'netherite', 'diamond', 'emerald'])] } },

  { tier: 9, name: 'A Tide', drops: 1400000, unlocks: {
      mods: ['draconicevolution'],
      items: [
        'minecraft:ender_eye',
        'botania:gaia_pylon', 'botania:gaia_ingot', 'botania:flight_tiara', 'botania:terra_sword',
        'enderio:octadic_capacitor', 'enderio:soul_binder', 'enderio:powered_spawner', 'enderio:end_steel_ingot',
        'iceandfire:dragonforge_fire_core_disabled', 'iceandfire:dragonforge_ice_core_disabled',
        'iceandfire:dragonforge_lightning_core_disabled',
        'iceandfire:dragonsteel_fire_ingot', 'iceandfire:dragonsteel_ice_ingot', 'iceandfire:dragonsteel_lightning_ingot',
        'alexscaves:quarry', 'alexscaves:conversion_crucible', 'alexscaves:extinction_spear',
        'mekanism:boiler_casing', 'mekanismgenerators:turbine_casing'],
      tags: [],
      recipes: [
        TINKERS_MATERIALS(['dragon_scale']),
        /^tcintegrations:tools\/materials\/((casting|melting|composite)\/)?dragonsteel_(fire|ice|lightning)(\/|$)/,
        /^tcintegrations:smeltery\/(melting|casting)\/metal\/dragonsteel_(fire|ice|lightning)\//,
        /^taiga:alloy\/(1[4-9]|2[0-7])_/,
        'iceandfire:dragonforge/dragonsteel_fire_ingot', 'iceandfire:dragonforge/dragonsteel_ice_ingot',
        'iceandfire:dragonforge/dragonsteel_lightning_ingot',
        /^mysticalagriculture:essence\/draconicevolution\//, MA_ESSENCE('enderio', ['end_steel_ingot']),
        MA_SEEDS(['draconium', 'end_steel'])] } },

  { tier: 10, name: 'A Sea', drops: 1900000, unlocks: {
      mods: ['rftoolsdim'],
      items: [
        'mekanismgenerators:fission_reactor_casing', 'mekanismgenerators:fission_fuel_assembly',
        'mekanismgenerators:control_rod_assembly',
        'mekanism:pellet_polonium', 'mekanism:pellet_plutonium', 'mekanism:module_base',
        'mekanism:mekasuit_bodyarmor', 'mekanism:meka_tool', 'mekanism:basic_induction_cell',
        'mekanism:qio_drive_array', 'mekanism:qio_dashboard', 'mekanism:qio_drive_base',
        'mekanism:isotopic_centrifuge', 'mekanism:solar_neutron_activator', 'mekanism:thermal_evaporation_controller',
        'draconicevolution:wyvern_core', 'draconicevolution:wyvern_crafting_injector',
        'draconicevolution:energy_core', 'draconicevolution:wyvern_energy_core', 'draconicevolution:module_core',
        'bigreactors:reprocessorcasing', 'bigreactors:blutonium_ingot', 'bigreactors:ludicrite_ingot',
        'bigreactors:ridiculite_ingot', 'bigreactors:inanite_ingot', 'bigreactors:magentite_ingot',
        'ae2:cell_component_64k', 'ae2:cell_component_256k', 'ae2:singularity', 'ae2:quantum_ring',
        'ae2:quantum_link', 'ae2:spatial_io_port', 'ae2:me_p2p_tunnel', 'ae2:spatial_cell_component_2'],
      tags: [], recipes: [] } },

  { tier: 11, name: 'An Ocean', drops: 2400000, unlocks: {
      mods: [],
      items: [
        'mekanism:pellet_antimatter', 'mekanism:sps_casing', 'mekanism:sps_port',
        'mekanism:supercharged_coil', 'mekanism:antiprotonic_nucleosynthesizer',
        'mekanismgenerators:fusion_reactor_controller', 'mekanismgenerators:fusion_reactor_frame',
        'draconicevolution:awakened_draconium_ingot', 'draconicevolution:awakened_core',
        'draconicevolution:awakened_crafting_injector', 'draconicevolution:draconic_energy_core',
        'draconicevolution:chaotic_core', 'draconicevolution:chaotic_crafting_injector',
        'draconicevolution:chaos_shard', 'draconicevolution:large_chaos_frag', 'draconicevolution:medium_chaos_frag',
        'advanced_ae:quantum_alloy', 'advanced_ae:shattered_singularity',
        'advanced_ae:quantum_processor', 'advanced_ae:quantum_core', 'advanced_ae:quantum_unit',
        'mysticalagriculture:awakening_altar', 'mysticalagriculture:awakening_pedestal',
        'mysticalagriculture:essence_vessel', 'mysticalagriculture:awakened_supremium_essence',
        'mysticalagriculture:awakened_supremium_ingot',
        'evilcraft:garmonbozia', 'evilcraft:sanguinary_environmental_accumulator', 'evilcraft:mace_of_destruction',
        'numina:battery_ultimate', 'numina:component_ion_thruster',
        'extrautilitiesreborn:ender_quarry', 'extrautilitiesreborn:rainbow_generator',
        'alexsmobs:dimensional_carver', 'alexscaves:tremorzilla_egg', 'alexscaves:nuclear_bomb'],
      tags: [],
      recipes: [/^mekanism:nucleosynthesizing\//] } },

  // Tier 12 unlocks no recipes. It opens the Siege: part2/citadel.js checks global.BloodPool.tier() >= 12.
  { tier: 12, name: 'The Siege', drops: 3000000, unlocks: { mods: [], items: [], tags: [], recipes: [] } },
]
// Dimensions (part2/dimension_gates.js): the Nether opens at this tier, the End at this one.
const NETHER_TIER = 3
const END_TIER = 9
const DROPS_PER_TROLL_POINT = 1        // each Troll Log point
const DROPS_PER_COIN = 1000            // each donated Hush Coin
// The Potato Tithe: /bloodpool tithe. POTATOES_PER_DROP potatoes make one Drop (4 = 4,000 potatoes per 1,000 Drops).
const POTATOES_PER_DROP = 4
const POTATO_DROPS_CAP_PER_DAY = 30000  // most Drops the WHOLE SERVER can tithe in a day; 0 = no cap
const POTATO_DROPS_CAP_PER_PLAYER = 0   // and per player per day; 0 = off (turn on if the server cap becomes a race)
const TITHE_ZONE = 'America/Chicago'    // the tithe day starts at TITHE_RESET_HOUR in this time zone
const TITHE_RESET_HOUR = 4
const POTATO_WORTH = {                  // what the tithe accepts, in potatoes. The crates are 3x3 = 9.
  'minecraft:potato': 1,
  'quark:potato_crate': 9,
  'farmersdelight:potato_crate': 9,
  'thermal:potato_block': 9,
}

// --- The Potato War: each player's Potato Standing ---
// /potatowar offer: potatoes (and crates, by POTATO_WORTH) go to Techno's war chest. They count only toward the
// giver's Standing, never the Pool; the tithe counts only toward the Pool. Standing is the lifetime total, no cap.
// STANDING[n - 1]: lifetime potatoes for rank n. Rank n lets a player craft Tier n's items at a crafting table
// (once the Pool has opened that tier). The early ranks are cheap so the IE Garden Cloche (Tier 3) and Thermal
// Insolator (Tier 5) potato farms are within reach.
// From rank 4 (Tier 4) the potatoes are 5x what they were (owner decision, Nov 2026).
const STANDING = [250, 1000, 2500, 25000, 50000, 100000, 175000, 300000, 500000, 750000, 1100000]
// The numbers before that change. Only used to keep the ranks players had already earned (see standingOf).
const LEGACY_STANDING = [250, 1000, 2500, 5000, 10000, 20000, 35000, 60000, 100000, 150000, 220000]
// RANKS[n]: the name of rank n (RANKS[0] = no rank yet).
const RANKS = ['Unenlisted', 'Potato Farmer', 'Potato Peeler', 'Potato Recruit', 'Potato Private', 'Potato Soldier',
  'Potato Sergeant', 'Potato Lieutenant', 'Potato Captain', 'Potato General', 'Potato Warlord', 'Potato Emperor']
// true: crafting-table recipes (minecraft:crafting_shaped / crafting_shapeless) of open tiers need the rank when a
// player crafts them (a crafting table, the inventory grid, or a mod's crafting grid the player has open: the result
// stays empty without the rank). Autocrafters, which have no player, craft them for anyone; placing an autocrafter
// needs its own tier's rank (AUTOCRAFTERS). false = rank only gates the black market.
const STANDING_CRAFTING = true
const STAGE_PREFIX = 'potato_standing_'  // the KubeJS stage for rank n is potato_standing_<n>
// Mods' own crafting-table recipe formats, which the rank check can't see. Each is rebuilt as a KubeJS shaped recipe
// with the same id, pattern, ingredients and result (no mirroring), so it gets the rank check too. Nothing about what
// it needs or makes changes. Mekanism tier upgrades (an input already carries data: a lower tier of the same item,
// a factory, or anything another mek_data recipe makes) are left as they are, so upgrading keeps contents and
// installed upgrades. Owner decision. [] = convert nothing.
const CONVERT_RECIPE_TYPES = ['cucumber:shaped_no_mirror', 'cucumber:shaped_tag', 'mekanism:mek_data']
// /bloodpool audit: the next /reload writes this report (every crafting-type recipe without the rank check, and
// every recipe whose result is still sealed). The request is kept in AUDIT_FLAG_FILE until then.
const AUDIT_FILE = 'kubejs/progression_audit.json'
const AUDIT_FLAG_FILE = 'kubejs/progression_audit_request.json'
// Autocrafters: only a player of the block's own tier's rank (or higher) may place one. rank: a fixed rank instead.
// Ops and creative players are exempt. Machines placed by something other than a player aren't checked.
const AUTOCRAFTERS = {
  'create:mechanical_crafter': { name: 'Mechanical Crafter' },          // Tier 4
  'mekanism:formulaic_assemblicator': { name: 'Formulaic Assemblicator' }, // Tier 4
  'enderio:crafter': { name: 'Crafter' },                                // Tier 5
  'ae2:molecular_assembler': { name: 'Molecular Assembler' },            // Tier 6
  'rftoolsutility:crafter1': { name: 'Crafter' },                        // Tier 7
  'rftoolsutility:crafter2': { name: 'Crafter' },
  'rftoolsutility:crafter3': { name: 'Crafter' },
  'advanced_ae:quantum_crafter': { name: 'Quantum Crafter' },            // Tier 8
}
const RANKUP_PUBLIC = true               // announce rank-ups to everyone (and Discord, with TO_DISCORD)
// Catch-up: when the Pool opens Tier T, every player can craft Tiers 1..T-CATCH_UP_GAP whatever their rank (their
// rank's name still comes from potatoes only, and the black market uses that). part2/potato_tree.js uses the same
// gap for the upgrade tree. 0 = off.
const CATCH_UP_GAP = 2
const TIER_STAGE_PREFIX = 'blood_pool_tier_' // every player gets blood_pool_tier_<n> for each open tier (FTB Quests checks it)

const TO_DISCORD = true                // public Pool lines with tellraw @a (posted to Discord); false = in game only
const TIER_FILE = 'kubejs/blood_pool_tier.json'
const RELOAD_DELAY_TICKS = 20          // /bloodpool unlock reloads this long after announcing

const VOICE_BLOOD = { tag: '[BLOOD GOD]', tagColor: 'dark_red', textColor: 'red' }
const VOICE_POOL = { tag: '[Blood Pool]', tagColor: 'dark_red', textColor: 'gray' }
const VOICE_WAR = { tag: '[POTATO WAR]', tagColor: 'gold', textColor: 'yellow' }
const LINES = {
  ready: 'The Blood Pool overflows. Tier %n (%name) waits for the Ministry\'s seal to break.',
  unlocked: 'The seal breaks. Tier %n (%name) is open. Blood for the Blood God.',
}


// ===================== STATE =====================

const DATA_KEY = 'blood_pool'

let Serializer = null, StringArg = null
try { Serializer = Java.loadClass('net.minecraft.network.chat.Component$Serializer') } catch (e) { }
try { StringArg = Java.loadClass('com.mojang.brigadier.arguments.StringArgumentType') } catch (e) { }

function onlinePlayers(server) {
  const list = server.players, out = []
  for (let i = 0; i < list.size(); i++) out.push(list.get(i))
  return out
}
function nameOf(p) { return String(p.getGameProfile().getName()) }
function uuidOf(e) {
  try { return String(e.getStringUuid()).toLowerCase() } catch (err) { }
  return String(e.getStringUUID()).toLowerCase()
}
function isOp(p) { try { return p.hasPermissions(2) } catch (e) { return false } }
function fmt(n) { return String(Math.round(n)).replace(/\B(?=(\d{3})+(?!\d))/g, ',') }
function comp(parts) {
  const json = JSON.stringify([''].concat(parts))
  if (Serializer) {
    try { return Serializer.fromJsonLenient(json) } catch (e) { }
  }
  return Text.of(parts.map(p => (typeof p == 'string' ? p : p.text || '')).join(''))
}
function voiceParts(voice, text) {
  return [{ text: voice.tag, color: voice.tagColor, bold: true }, { text: ' ' + text, color: voice.textColor }]
}
function tell(p, voice, text) { try { p.tell(comp(voiceParts(voice, text))) } catch (e) { } }
function announce(server, voice, text) {
  const parts = voiceParts(voice, text)
  if (TO_DISCORD) {
    try { server.runCommandSilent('tellraw @a ' + JSON.stringify([''].concat(parts))); return } catch (e) { }
  }
  const c = comp(parts)
  onlinePlayers(server).forEach(p => { try { p.tell(c) } catch (e) { } })
}
function line(key, T) { return LINES[key].replace('%n', T.tier).replace('%name', T.name) }
function tierDef(n) { return TIERS.filter(T => T.tier == n)[0] || null }


// ===================== SAVED DATA =====================
// server.persistentData['blood_pool'] = JSON { v, drops, tier, announced: { n: true }, from: { troll, coins, potatoes, op },
//   contributors: { uuid: { name, drops, coins } }, unlocks: [ { tier, t, by } ],
//   potatoDay: 'YYYY-MM-DD' (the tithe day), potatoDrops: Drops tithed that day, potatoByPlayer: { uuid: Drops },
//   standing: { uuid: { name, potatoes } } (the Potato War: lifetime potatoes offered) }

let DB = null
function db() {
  if (DB) return DB
  let raw = ''
  try { raw = String(Utils.server.persistentData.getString(DATA_KEY) || '') } catch (e) { }
  let parsed = null
  if (raw) {
    try { parsed = JSON.parse(raw) } catch (e) {
      try { Utils.server.persistentData.putString(DATA_KEY + '_unreadable_' + Date.now(), raw) } catch (e2) { }
      console.error('[BloodPool] Saved data could not be read (' + e + '); a copy was kept and it starts fresh.')
    }
  }
  DB = parsed && parsed.v ? parsed : { v: 1 }
  if (!DB.drops) DB.drops = 0
  if (!DB.tier) DB.tier = 0
  if (!DB.announced) DB.announced = {}
  if (!DB.from) DB.from = { troll: 0, coins: 0, op: 0 }
  if (!DB.contributors) DB.contributors = {}
  if (!DB.unlocks) DB.unlocks = []
  if (!DB.potatoDay) DB.potatoDay = ''
  if (!DB.potatoDrops) DB.potatoDrops = 0
  if (!DB.potatoByPlayer) DB.potatoByPlayer = {}
  if (!DB.standing) DB.standing = {}
  return DB
}
function save() {
  try { Utils.server.persistentData.putString(DATA_KEY, JSON.stringify(db())) } catch (e) { console.error('[BloodPool] Save failed: ' + e) }
}

// The open tier in TIER_FILE, or null if it's missing or unreadable.
function readTierFile() {
  try {
    let m = JsonIO.read(TIER_FILE)
    if (m == null) return null
    let v = typeof m.get == 'function' ? m.get('tier') : m.tier
    let n = Number(v)
    return isFinite(n) && n >= 0 ? Math.floor(n) : null
  } catch (e) { return null }
}
// The open tier, as the recipe event sees it. Missing or unreadable = 0 (everything stays locked).
function tierFromFile() { const n = readTierFile(); return n == null ? 0 : n }
function writeTierFile(n) {
  try { JsonIO.write(TIER_FILE, { tier: String(n) }); return true } catch (e) {
    console.error('[BloodPool] Could not write ' + TIER_FILE + ' (recipes will stay locked after a restart): ' + e)
    return false
  }
}


// ===================== WHAT EACH TIER LOCKS =====================
// An item listed in a tier wins over its tag, which wins over its mod.

const ITEM_TIER = {}, MOD_TIER = {}, TAG_TIERS = []
TIERS.forEach(T => {
  const u = T.unlocks || {}
  ;(u.items || []).forEach(id => { ITEM_TIER[String(id)] = T.tier })
  ;(u.mods || []).forEach(m => { if (MOD_TIER[m] == null) MOD_TIER[String(m)] = T.tier })
  ;(u.tags || []).forEach(t => TAG_TIERS.push({ tag: String(t).replace(/^#/, ''), tier: T.tier }))
})

function hasTag(obj, tag) {
  if (!obj) return false
  try { return !!obj.hasTag(tag) } catch (e) { return false }
}
// The tier that opens this item/block (0 = not in any tier). obj: the stack or block, for tag checks.
function tierOf(id, obj) {
  id = String(id || '')
  if (!id || id == 'minecraft:air') return 0
  if (ITEM_TIER[id] != null) return ITEM_TIER[id]
  for (let i = 0; i < TAG_TIERS.length; i++) if (hasTag(obj, TAG_TIERS[i].tag)) return TAG_TIERS[i].tier
  const m = MOD_TIER[id.split(':')[0]]
  return m != null ? m : 0
}
function isLocked(id, obj) { return tierOf(id, obj) > db().tier }


// ===================== RECIPES =====================

// The Potato War: every crafting-table recipe left in an open tier gets that tier's result check, so only players of
// that rank can craft it (autocrafters, with no player, always can). A recipe's tier is the highest that locks it, the same rules the removal below uses: its
// result (item, then tag, then the result's mod), its own mod (unless its result is listed by id) and the recipe
// id rules. One pass over the crafting recipes.
const CRAFTING_TYPES = [{ type: 'minecraft:crafting_shaped' }, { type: 'minecraft:crafting_shapeless' }]
// Who is crafting: the player at a crafting table or inventory grid, else the online player whose open window is
// this grid's (a mod's crafting grid). null = no player: an autocrafter.
function crafterOf(grid) {
  let p = null
  try { p = grid.getPlayer() } catch (e) { }
  if (p) return p
  let menu = null
  try { menu = grid.getMenu() } catch (e) { }
  if (!menu || !Utils.server) return null
  return onlinePlayers(Utils.server).filter(o => { try { return menu.equals(o.containerMenu) } catch (e) { return false } })[0] || null
}
function hasRank(p, n) {
  try { return !!p.stages.has(STAGE_PREFIX + n) } catch (e) { }
  return craftAccess(uuidOf(p)) >= n
}
// One result check per rank, shared by every recipe of that tier. Errors give the result (never eat a craft).
let gateErrors = 0
function rankGate(n) {
  return (grid, result) => {
    try {
      let p = crafterOf(grid)
      return !p || hasRank(p, n) ? result : Item.empty
    } catch (e) {
      if (gateErrors++ < 3) console.error('[BloodPool] Potato War crafting check (the craft was allowed): ' + e)
      return result
    }
  }
}
const RANK_GATES = {}
STANDING.forEach((need, i) => { RANK_GATES[i + 1] = rankGate(i + 1) })
function ruleMatches(rule, id) { return typeof rule == 'string' ? rule == id : rule.test(id) }
function recipeTier(r, open) {
  let out = null
  try { out = r.getOriginalRecipeResult() } catch (e) { }
  return recipeTierFor(String(r.getId()), out && !out.isEmpty() ? String(out.id) : '', out, open)
}
function recipeTierFor(id, outId, out, open) {
  let t = 0
  if (outId) t = tierOf(outId, out)
  if (!(outId && ITEM_TIER[outId] != null)) t = Math.max(t, MOD_TIER[id.split(':')[0]] || 0)
  TIERS.forEach(T => {
    if (T.tier <= t || T.tier > open) return
    if (((T.unlocks || {}).recipes || []).some(rule => ruleMatches(rule, id))) t = T.tier
  })
  return t
}
let GATED = {}                                  // recipe ids given the rank check this reload (for the audit)
let GATED_BY_TIER = {}
function gate(r, id, t) {
  r.modifyResult(RANK_GATES[t])
  GATED[id] = t
  GATED_BY_TIER[t] = (GATED_BY_TIER[t] || 0) + 1
}
function stageCrafting(event, open) {
  let staged = 0, failed = 0
  const counts = {}
  try {
    event.forEachRecipe(CRAFTING_TYPES, r => {
      let t = 0
      try { t = recipeTier(r, open) } catch (e) { failed++; return }
      if (!(t >= 1 && t <= open && t <= STANDING.length)) return
      try { gate(r, String(r.getId()), t); staged++; counts[t] = (counts[t] || 0) + 1 } catch (e) { failed++ }
    })
  } catch (e) { console.error('[BloodPool] Potato War: crafting recipes could not be given a rank check (rank does not gate crafting): ' + e); return }
  console.info('[BloodPool] Potato War: ' + staged + ' crafting recipes need a rank (' +
    Object.keys(counts).map(k => 'rank ' + k + ': ' + counts[k]).join(', ') + ')' + (failed ? '; ' + failed + ' could not be read' : ''))
}

// ----- Mods' own crafting-table formats (CONVERT_RECIPE_TYPES) -----
function jsonItems(node, out) {
  if (Array.isArray(node)) node.forEach(x => jsonItems(x, out))
  else if (node && typeof node == 'object') {
    if (typeof node.item == 'string') out.push(node.item)
    Object.keys(node).forEach(k => { if (k != 'item' && node[k] && typeof node[k] == 'object') jsonItems(node[k], out) })
  }
  return out
}
// A recipe key entry as a KubeJS ingredient, or null if it uses something only the mod understands.
function keyIngredient(v) {
  if (Array.isArray(v)) {
    let parts = v.map(keyIngredient)
    return parts.some(x => x == null || typeof x != 'string') ? null : parts
  }
  if (!v || typeof v != 'object') return null
  const keys = Object.keys(v)
  if (keys.length == 1 && keys[0] == 'item') return String(v.item)
  if (keys.length == 1 && keys[0] == 'tag') return '#' + v.tag
  return null
}
function family(id) { return String(id).split(':')[1].replace(/^(basic|advanced|elite|ultimate)_/, '') }
function isMekUpgrade(j, outId, dataItems) {
  if (/factory/.test(outId)) return true
  return jsonItems(j.key || {}, []).some(i => /^mekanism/.test(i) && (family(i) == family(outId) || dataItems[i]))
}
let CONVERTED = { done: 0, upgrades: 0, skipped: 0, sealed: 0, failed: 0 }
function convertRecipes(event, open) {
  CONVERTED = { done: 0, upgrades: 0, skipped: 0, sealed: 0, failed: 0 }
  if (!CONVERT_RECIPE_TYPES.length) return
  const found = [], dataItems = {}
  try {
    event.forEachRecipe(CONVERT_RECIPE_TYPES.map(t => ({ type: t })), r => {
      try { found.push({ id: String(r.getId()), type: String(r.getType()), j: JSON.parse(String(r.json)) }) } catch (e) { CONVERTED.failed++ }
    })
  } catch (e) { console.error('[BloodPool] Mod crafting recipes could not be read (left as they are): ' + e); return }
  found.forEach(f => { if (f.type == 'mekanism:mek_data' && f.j.result && f.j.result.item) dataItems[f.j.result.item] = true })
  found.forEach(f => {
    try {
      let res = f.j.result || {}, outId = res.item ? String(res.item) : ''
      if (!outId && res.tag) {
        let ids = Ingredient.of('#' + res.tag).getItemIds().toArray()
        if (!ids.length) { CONVERTED.skipped++; return }
        outId = String(ids[0])
      }
      if (!outId || !f.j.pattern || !f.j.key) { CONVERTED.skipped++; return }
      let t = recipeTierFor(f.id, outId, null, open)
      if (t > open) { event.remove({ id: f.id }); CONVERTED.sealed++; return }   // missed by the removal (a tag result): seal it now
      if (f.type == 'mekanism:mek_data' && isMekUpgrade(f.j, outId, dataItems)) { CONVERTED.upgrades++; return }
      let key = {}, ok = true
      Object.keys(f.j.key).forEach(k => { let v = keyIngredient(f.j.key[k]); if (v == null) ok = false; else key[k] = v })
      if (!ok) { CONVERTED.skipped++; return }
      let count = Number(res.count) || 1
      let result = res.nbt ? Item.of(outId, count, typeof res.nbt == 'string' ? res.nbt : JSON.stringify(res.nbt)) : Item.of(outId, count)
      let nr = event.shaped(result, f.j.pattern, key).noMirror().id(f.id)
      event.remove({ id: f.id })
      CONVERTED.done++
      if (STANDING_CRAFTING && t >= 1 && t <= open && t <= STANDING.length) gate(nr, f.id, t)
    } catch (e) { CONVERTED.failed++ }
  })
  console.info('[BloodPool] Mod crafting recipes: ' + CONVERTED.done + ' rebuilt with the rank check; ' + CONVERTED.upgrades +
    ' Mekanism upgrades left as they are; ' + CONVERTED.skipped + ' skipped (unusual ingredients or an empty tag)' +
    (CONVERTED.sealed ? '; ' + CONVERTED.sealed + ' sealed (their tier is not open)' : '') +
    (CONVERTED.failed ? '; ' + CONVERTED.failed + ' failed (left as they are)' : ''))
}

// ----- /bloodpool audit -----
const TABLE_TYPES = /(crafting|shaped|shapeless|mek_data|copy_nbt|nbt_output|armor_upgrade|mana_upgrade|turn_and_copy|_upgrade$|_fluid$)/
const NOT_TABLE = { 'tconstruct:material_fluid': 1, 'create:mechanical_crafting': 1, 'draconicevolution:fusion_crafting': 1,
  'enderio:fire_crafting': 1, 'twilightforest:uncrafting': 1 }
function auditRequested() {
  try {
    let m = JsonIO.read(AUDIT_FLAG_FILE)
    if (m == null) return false
    let v = typeof m.get == 'function' ? m.get('requested') : m.requested
    return String(v) == 'true'
  } catch (e) { return false }
}
function outputsOf(j) {
  const out = []
  Object.keys(j || {}).forEach(k => { if (/^(result|results|output|outputs)$/.test(k)) jsonItems(j[k], out) })
  return out
}
function runAudit(event, open) {
  const ungated = [], survivors = []
  let total = 0
  event.forEachRecipe('*', r => {
    total++
    let id = String(r.getId()), type = String(r.getType())
    let out = null
    try { out = r.getOriginalRecipeResult() } catch (e) { }
    let outId = out && !out.isEmpty() ? String(out.id) : ''
    if (TABLE_TYPES.test(type.split(':')[1] || '') && !NOT_TABLE[type] && GATED[id] == null && CRAFTING_TYPES.every(c => c.type != type)) {
      let t = 0
      try { t = recipeTierFor(id, outId, out, open) } catch (e) { }
      if (t >= 1 && ungated.length < 1000) ungated.push({ type: type, id: id, result: outId, tier: t })
    }
    let j = null
    try { j = JSON.parse(String(r.json)) } catch (e) { }
    outputsOf(j).forEach(o => {
      let t = tierOf(o, null)
      if (t > open && survivors.length < 1000) survivors.push({ id: id, type: type, item: o, tier: t, kubejsSeesIt: o == outId })
    })
  })
  const report = { open: open, recipes: total, gatedByTier: GATED_BY_TIER, converted: CONVERTED,
    ungatedCraftingRecipes: ungated, sealedItemsStillMade: survivors }
  try { JsonIO.write(AUDIT_FILE, report) } catch (e) { console.error('[BloodPool] Audit: could not write ' + AUDIT_FILE + ': ' + e) }
  try { JsonIO.write(AUDIT_FLAG_FILE, { requested: 'false' }) } catch (e) { }
  console.info('[BloodPool] Audit (tier ' + open + ', ' + total + ' recipes): ' + Object.keys(GATED).length + ' crafting recipes carry the rank check; ' +
    ungated.length + ' crafting-type recipes in a tier do not; ' + survivors.length + ' recipes still make a sealed item. Written to ' + AUDIT_FILE)
}

ServerEvents.recipes(event => {
  const open = tierFromFile()
  let removed = 0
  TIERS.forEach(T => {
    if (T.tier <= open) return
    const u = T.unlocks || {}
    ;(u.mods || []).forEach(m => {
      // Items of this mod that open earlier (and are open now) keep their recipes.
      let keep = Object.keys(ITEM_TIER).filter(id => id.split(':')[0] == m && ITEM_TIER[id] <= open)
      let filter = keep.length ? { output: '@' + m, not: { output: keep } } : { output: '@' + m }
      event.remove(filter)
      event.remove(keep.length ? { mod: m, not: { output: keep } } : { mod: m })
      removed++
    })
    ;(u.items || []).forEach(id => { event.remove({ output: id }); removed++ })
    ;(u.tags || []).forEach(t => { event.remove({ output: '#' + String(t).replace(/^#/, '') }); removed++ })
    ;(u.recipes || []).forEach(r => { event.remove({ id: r }); removed++ })   // exact id or regex
  })
  console.info('[BloodPool] Recipes: tier ' + open + ' open; ' + removed + ' locked entries removed')
  GATED = {}
  GATED_BY_TIER = {}
  convertRecipes(event, open)
  if (STANDING_CRAFTING) stageCrafting(event, open)
  if (auditRequested()) { try { runAudit(event, open) } catch (e) { console.error('[BloodPool] Audit failed: ' + e) } }
})


// ===================== FILLING THE POOL =====================

function credit(uuid, name, drops, coins) {
  if (!uuid) return
  const C = db().contributors
  if (!C[uuid]) C[uuid] = { name: name || '?', drops: 0, coins: 0 }
  if (name) C[uuid].name = name
  C[uuid].drops += drops
  C[uuid].coins += coins || 0
}
// The next tiers the Pool has reached are announced once each (an op still has to unlock them).
function checkReady(server) {
  const D = db()
  TIERS.forEach(T => {
    if (T.tier <= D.tier || D.announced[T.tier] || D.drops < T.drops) return
    D.announced[T.tier] = true
    if (!server) return
    announce(server, VOICE_BLOOD, line('ready', T))
    onlinePlayers(server).filter(isOp).forEach(o => tell(o, VOICE_POOL, 'Tier ' + T.tier + ' is ready. Unlock it with /bloodpool unlock (one tier at a time).'))
    console.info('[BloodPool] Tier ' + T.tier + ' is ready (' + D.drops + ' Drops)')
  })
}
function addDrops(n, source, uuid, name, coins) {
  n = Math.max(0, Math.round(Number(n) || 0))
  if (!n) return 0
  const D = db()
  D.drops += n
  D.from[source] = (D.from[source] || 0) + n
  credit(uuid, name, n, coins)
  checkReady(Utils.server)
  save()
  return n
}
function nextTier() { return tierDef(db().tier + 1) }
function statusText() {
  const D = db(), cur = tierDef(D.tier), next = nextTier()
  let t = 'The Blood Pool: ' + fmt(D.drops) + ' Drops. ' + (cur ? 'Tier ' + cur.tier + ' (' + cur.name + ') is open.' : 'No tier is open yet.')
  if (!next) return t + ' Every tier is open.'
  t += ' Next: Tier ' + next.tier + ' (' + next.name + ') at ' + fmt(next.drops)
  return t + (D.drops >= next.drops ? ': ready, waiting for the seal to break.' : ' (' + fmt(next.drops - D.drops) + ' to go).')
}
function contents(T) {
  const u = T.unlocks || {}, parts = []
  if ((u.mods || []).length) parts.push('mods: ' + u.mods.join(', '))
  if ((u.items || []).length) parts.push(u.items.length + ' item' + (u.items.length == 1 ? '' : 's'))
  if ((u.tags || []).length) parts.push('tags: ' + u.tags.join(', '))
  if ((u.recipes || []).length) parts.push(u.recipes.length + ' recipe rule' + (u.recipes.length == 1 ? '' : 's'))
  if (T.tier == NETHER_TIER) parts.push('the Nether')
  if (T.tier == END_TIER) parts.push('the End')
  return parts.length ? parts.join('; ') : (T.tier == 12 ? 'the Siege' : 'nothing listed yet')
}

// Opens tier n (and everything below): saved, written to TIER_FILE, announced, then /reload brings the recipes back.
function setTier(server, n, by, announceIt) {
  const D = db()
  D.tier = Math.max(0, Math.min(TIERS.length, n))
  D.unlocks.push({ tier: D.tier, t: Date.now(), by: by })
  Object.keys(D.announced).forEach(k => { if (Number(k) <= D.tier) delete D.announced[k] })
  save()
  writeTierFile(D.tier)
  const T = tierDef(D.tier)
  if (announceIt && T) {
    try {
      server.runCommandSilent('title @a times 10 80 20')
      server.runCommandSilent('title @a subtitle ' + JSON.stringify({ text: 'Tier ' + T.tier + ': ' + T.name, color: 'red' }))
      server.runCommandSilent('title @a title ' + JSON.stringify({ text: 'THE BLOOD POOL', color: 'dark_red', bold: true }))
      server.runCommandSilent('playsound minecraft:entity.wither.spawn master @a ~ ~ ~ 100 0.7')
    } catch (e) { }
    announce(server, VOICE_BLOOD, line('unlocked', T))
  }
  checkReady(server)
  save()
  const G = global.DimensionGates
  if (G) { try { G.sync(server, announceIt) } catch (e) { console.error('[BloodPool] dimension gates: ' + e) } }
  const K = global.BloodTank
  if (K) { try { K.sync(server, true) } catch (e) { console.error('[BloodPool] tank: ' + e) } }
  onlinePlayers(server).forEach(p => { try { syncStages(p) } catch (e) { } })
  const PT = global.PotatoTree
  if (PT) { try { PT.catchUp(server) } catch (e) { console.error('[BloodPool] potato tree catch-up: ' + e) } }
  if (announceIt && T) onlinePlayers(server).forEach(p => { try { tierMessage(p, T) } catch (e) { console.error('[BloodPool] tier message: ' + e) } })
  console.info('[BloodPool] Tier set to ' + D.tier + ' by ' + by + '; reloading')
  server.scheduleInTicks(RELOAD_DELAY_TICKS, () => { try { server.runCommandSilent('reload') } catch (e) { console.error('[BloodPool] reload: ' + e) } })
}

// Each player, privately: what the new tier means for them (crafting by rank or catch-up, nodes now buyable).
function tierMessage(p, T) {
  const uuid = uuidOf(p), s = standingOf(uuid), acc = craftAccess(uuid)
  let text = 'Tier ' + T.tier + ' (' + T.name + ') is open.'
  if (T.tier <= STANDING.length) {
    if (acc >= T.tier) text += ' You can craft its items at a crafting table.'
    else text += ' Crafting its items at a table needs ' + rankName(T.tier) + ': ' + fmt(Math.max(0, STANDING[T.tier - 1] - s.potatoes)) +
      ' more potatoes (/potatowar offer), or it comes to you by catch-up at Tier ' + (T.tier + CATCH_UP_GAP) + '.'
  }
  const PT = global.PotatoTree
  if (PT) {
    let ready = []
    try { ready = PT.buyable(p) } catch (e) { }
    if (ready.length) text += ' Ready in the upgrade tree (/potatowar tree): ' + ready.join(', ') + '.'
  }
  tell(p, VOICE_WAR, text)
}

// The saved data is the authority; keep the file in step (a restart then loads the right recipes).
function syncFile(server) {
  const D = db(), f = readTierFile()
  if (f == D.tier) return
  writeTierFile(D.tier)
  if (f == null && D.tier == 0) return                         // first run: nothing was open anyway
  console.warn('[BloodPool] ' + TIER_FILE + ' said tier ' + f + ', the saved data says ' + D.tier + '; file fixed. Run /reload to apply the recipes.')
  onlinePlayers(server).filter(isOp).forEach(o => tell(o, VOICE_POOL, 'The tier file was out of step (' + f + ' vs ' + D.tier + '); fixed. Run /reload so recipes match.'))
}


// The saved data is the authority for the open tier; the file only follows it.
ServerEvents.loaded(event => syncFile(event.server))
if (Utils.server) syncFile(Utils.server)


// ===================== THE POTATO TITHE =====================

let ZonedDateTime = null, ZoneId = null
try { ZonedDateTime = Java.loadClass('java.time.ZonedDateTime'); ZoneId = Java.loadClass('java.time.ZoneId') } catch (e) { }
// The tithe day: a date that turns over at TITHE_RESET_HOUR in TITHE_ZONE (daylight saving included).
function titheDay() {
  if (ZonedDateTime && ZoneId) {
    try { return String(ZonedDateTime.now(ZoneId.of(TITHE_ZONE)).minusHours(TITHE_RESET_HOUR).toLocalDate().toString()) } catch (e) { }
  }
  return new Date(Date.now() - 9 * 3600000).toISOString().slice(0, 10)   // fallback: about 4 am Central
}
function potatoToday(uuid) {
  const D = db(), day = titheDay()
  if (D.potatoDay != day) { D.potatoDay = day; D.potatoDrops = 0; D.potatoByPlayer = {} }
  return { server: D.potatoDrops || 0, player: D.potatoByPlayer[uuid] || 0 }
}
// Drops this player may still tithe today; -1 = no limit.
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
// Main inventory and hotbar (slots 0-35), the same slots the black market takes coins from.
function potatoWorth(s) {
  if (!s || s.isEmpty()) return 0
  return POTATO_WORTH[String(s.id)] || 0
}
function countPotatoes(p) {
  const inv = p.inventory
  let n = 0
  for (let i = 0; i < 36; i++) { let s = inv.getItem(i), w = potatoWorth(s); if (w) n += w * s.getCount() }
  return n
}
// Takes n potatoes' worth: loose potatoes first, then crates; change from a broken crate comes back as potatoes.
function takePotatoes(p, n) {
  const inv = p.inventory
  let left = n
  ;[1, 9].forEach(worth => {
    for (let i = 0; i < 36 && left > 0; i++) {
      let s = inv.getItem(i)
      if (potatoWorth(s) != worth) continue
      let use = Math.min(s.getCount(), Math.ceil(left / worth))
      s.shrink(use)
      left -= use * worth
    }
  })
  if (left < 0) {
    let change = -left
    while (change > 0) { let k = Math.min(64, change); p.give(Item.of('minecraft:potato', k)); change -= k }
  }
  return left <= 0
}


// ===================== THE POTATO WAR =====================

function standingTierOf(potatoes, table) {
  let n = 0
  ;(table || STANDING).forEach((need, i) => { if (potatoes >= need) n = i + 1 })
  return n
}
// The highest rank a player has reached and keeps (ranks are never lost to a change of thresholds). A record from
// before `peak` existed keeps the rank its potatoes bought under the old numbers.
function peakOf(r) {
  if (!r) return 0
  if (r.peak != null) return r.peak
  return standingTierOf(r.potatoes || 0, LEGACY_STANDING)
}
function rankName(n) { return RANKS[n] || ('Potato rank ' + n) }
// { potatoes, tier, rank, next (potatoes for the next rank, 0 = top), nextRank }
function standingOf(uuid) {
  const r = db().standing[uuid]
  const potatoes = r ? r.potatoes || 0 : 0, tier = Math.max(standingTierOf(potatoes), peakOf(r))
  const top = tier >= STANDING.length
  return { potatoes: potatoes, tier: tier, rank: rankName(tier), next: top ? 0 : STANDING[tier], nextRank: top ? '' : rankName(tier + 1) }
}
function standingText(s) {
  let t = fmt(s.potatoes) + ' potatoes offered: ' + s.rank + '.'
  return t + (s.next ? ' ' + s.nextRank + ' at ' + fmt(s.next) + ' (' + fmt(s.next - s.potatoes) + ' to go).' : ' The highest rank there is.')
}
function playerByUuid(server, uuid) { return onlinePlayers(server).filter(o => uuidOf(o) == uuid)[0] || null }
// Gives the player the stages for every rank they hold and takes away the rest (an op may lower a rank).
// The tiers a player can craft at a table: their rank, or the catch-up tier if that's higher.
function catchUpTier() { return CATCH_UP_GAP > 0 ? Math.max(0, Math.min(STANDING.length, db().tier - CATCH_UP_GAP)) : 0 }
function craftAccess(uuid) { return Math.max(standingOf(uuid).tier, catchUpTier()) }
function setStage(st, p, stage, on) {
  try {
    if (on) { if (!st.has(stage)) st.add(stage) }
    else if (st.has(stage)) st.remove(stage)
  } catch (e) { console.error('[BloodPool] stage ' + stage + ' for ' + nameOf(p) + ': ' + e) }
}
// Gives the player the stages for every rank they can craft at (rank or catch-up) and every open Pool tier, and
// takes away the rest (an op may lower a rank or the tier).
function syncStages(p) {
  let st = null
  try { st = p.stages } catch (e) { }
  if (!st) return
  const n = craftAccess(uuidOf(p)), open = db().tier
  for (let i = 1; i <= STANDING.length; i++) setStage(st, p, STAGE_PREFIX + i, i <= n)
  for (let i = 1; i <= TIERS.length; i++) setStage(st, p, TIER_STAGE_PREFIX + i, i <= open)
}
function rankUp(server, p, name, n) {
  if (p) {
    try {
      server.runCommandSilent('title ' + name + ' times 10 70 20')
      server.runCommandSilent('title ' + name + ' subtitle ' + JSON.stringify({ text: 'Techno\'s Potato War', color: 'yellow' }))
      server.runCommandSilent('title ' + name + ' title ' + JSON.stringify({ text: rankName(n), color: 'gold', bold: true }))
      server.runCommandSilent('playsound minecraft:ui.toast.challenge_complete master ' + name + ' ~ ~ ~ 1 1')
    } catch (e) { }
    tell(p, VOICE_WAR, 'You are now a ' + rankName(n) + '. You can craft Tier ' + n + '\'s items at a crafting table once the Blood Pool opens it.')
  }
  if (RANKUP_PUBLIC) announce(server, VOICE_WAR, name + ' has risen to ' + rankName(n) + ' in Techno\'s Potato War.')
  console.info('[BloodPool] Potato War: ' + name + ' is now rank ' + n + ' (' + rankName(n) + ')')
}
// Sets a player's lifetime offered potatoes. Online players get their stages at once (offline ones at login).
// resetPeak: an op setting a player's total may lower their rank; offers, hand-ins and /potatowar add never do.
function setStanding(server, uuid, name, potatoes, announceIt, resetPeak) {
  const D = db(), before = standingOf(uuid).tier
  if (!D.standing[uuid]) D.standing[uuid] = { name: name || '?', potatoes: 0 }
  if (name) D.standing[uuid].name = name
  D.standing[uuid].potatoes = Math.max(0, Math.round(potatoes))
  const earned = standingTierOf(D.standing[uuid].potatoes)
  D.standing[uuid].peak = resetPeak ? earned : Math.max(before, earned)
  save()
  const after = standingOf(uuid).tier
  const p = server ? playerByUuid(server, uuid) : null
  if (p) syncStages(p)
  if (announceIt && server && after > before) rankUp(server, p, D.standing[uuid].name, after)
  return after
}
// A player by name: online, or one the Potato War already knows. { uuid, name } or null.
function standingTarget(server, name) {
  const low = String(name).toLowerCase()
  const p = onlinePlayers(server).filter(o => nameOf(o).toLowerCase() == low)[0]
  if (p) return { uuid: uuidOf(p), name: nameOf(p) }
  const S = db().standing, u = Object.keys(S).filter(k => String(S[k].name).toLowerCase() == low)[0]
  return u ? { uuid: u, name: S[u].name } : null
}

PlayerEvents.loggedIn(event => { try { syncStages(event.player) } catch (e) { console.error('[BloodPool] login stages: ' + e) } })

// The rank needed to place this block (an autocrafter), or 0.
function autocrafterRank(id) {
  const a = Object.prototype.hasOwnProperty.call(AUTOCRAFTERS, id) ? AUTOCRAFTERS[id] : null
  if (!a) return 0
  const n = Number(a.rank) > 0 ? Number(a.rank) : tierOf(id, null)
  return Math.max(0, Math.min(STANDING.length, n))
}
BlockEvents.placed(event => {
  if (!STANDING_CRAFTING) return
  if (global.PotatoTree && global.PotatoTree.handlesPlacing) return   // the upgrade tree decides (part2/potato_tree.js)
  const p = event.player
  if (!p) return
  const id = String(event.block.id), need = autocrafterRank(id)
  if (!need || isOp(p)) return
  try { if (p.isCreative()) return } catch (e) { }
  const mine = standingOf(uuidOf(p))
  if (mine.tier >= need) return
  tell(p, VOICE_WAR, 'Only a ' + rankName(need) + ' or higher knows how to set up a ' + AUTOCRAFTERS[id].name + '. You are ' + mine.rank + '. (/potatowar)')
  event.cancel()
})
if (Utils.server) onlinePlayers(Utils.server).forEach(p => { try { syncStages(p) } catch (e) { } })


// ===================== API FOR OTHER SCRIPTS =====================

global.BloodPool = {
  drops: () => db().drops,
  tier: () => db().tier,
  // source: 'troll', 'coins', 'op' or another script's name. uuid/name: who to credit.
  addDrops: (n, source, uuid, name) => addDrops(Number(n) * (source == 'troll' ? DROPS_PER_TROLL_POINT : 1), source || 'other', uuid ? String(uuid) : '', name ? String(name) : ''),
  isLocked: (id, obj) => isLocked(id, obj),          // true = can't be crafted yet
  tierOf: (id, obj) => tierOf(id, obj),
  tierCount: TIERS.length,
  netherTier: NETHER_TIER,                           // part2/dimension_gates.js
  endTier: END_TIER,
  // The Potato War. standing(player) = { potatoes, tier (rank number, 0 = none), rank (its name), next, nextRank }.
  standing: player => standingOf(uuidOf(player)),
  rankName: n => rankName(Number(n)),
  rankCount: STANDING.length,
  // Adds potatoes handed in elsewhere (part2/potato_tree.js's quest costs) to the player's Standing, with rank-ups.
  creditStanding: (player, n) => {
    n = Math.floor(Number(n) || 0)
    if (!(n > 0)) return
    const u = uuidOf(player)
    setStanding(player.server || Utils.server, u, nameOf(player), standingOf(u).potatoes + n, true)
    console.info('[BloodPool] Potato War: ' + nameOf(player) + ' handed in ' + n + ' potatoes (upgrade tree)')
  },
  craftAccess: player => craftAccess(uuidOf(player)),   // the highest tier this player can craft (rank or catch-up)
  tiers: TIERS,                                        // read-only: the tier lists (tools, the quest generator, the audit)
  standingThresholds: STANDING,
  autocrafters: AUTOCRAFTERS,
  catchUpGap: CATCH_UP_GAP,
  syncStages: player => syncStages(player),
}


// ===================== COMMANDS =====================

ServerEvents.commandRegistry(event => {
  const Commands = event.commands
  const Arguments = event.arguments
  const reply = (ctx, text, bad) => {
    ctx.source.sendSystemMessage(comp([{ text: '[Blood Pool] ', color: 'dark_red' }, { text: text, color: bad ? 'red' : 'gray' }]))
    return bad ? 0 : 1
  }
  const safe = fn => ctx => {
    try { return fn(ctx) } catch (e) {
      console.error('[BloodPool] ' + e)
      return reply(ctx, 'Error: ' + e, true)
    }
  }
  const int = name => Commands.argument(name, Arguments.INTEGER.create(event))
  const num = (ctx, name) => Number(Arguments.INTEGER.getResult(ctx, name))
  const op = src => src.hasPermission(2)
  const me = ctx => ctx.source.getPlayer()
  const who = ctx => { const p = me(ctx); return p ? nameOf(p) : 'the console' }
  // asked: how many potatoes (0 = all you carry; a negative number is refused, it would mean "everything").
  const tithe = (ctx, asked) => {
    const p = me(ctx)
    if (!p) return reply(ctx, 'Players only.', true)
    if (asked < 0) return reply(ctx, 'What is spilled into the Pool stays in the Pool.', true)
    const uuid = uuidOf(p), have = countPotatoes(p)
    if (asked > have) return reply(ctx, 'You only carry ' + fmt(have) + ' potatoes (crates count as 9).', true)
    let drops = Math.floor((asked > 0 ? asked : have) / POTATOES_PER_DROP)
    if (drops < 1) return reply(ctx, 'The Blood God takes potatoes in fours at the least. You carry ' + fmt(have) + '.', true)
    const room = potatoRoom(uuid)
    if (room == 0) return reply(ctx, 'The Pool has drunk its fill of potatoes today. The tithe opens again at ' + TITHE_RESET_HOUR + ' am.', true)
    if (room > 0 && drops > room) drops = room
    const spend = drops * POTATOES_PER_DROP
    if (!takePotatoes(p, spend)) return reply(ctx, 'The potatoes slipped away. Nothing was tithed.', true)
    const D = db()
    D.potatoDrops = (D.potatoDrops || 0) + drops
    D.potatoByPlayer[uuid] = (D.potatoByPlayer[uuid] || 0) + drops
    addDrops(drops, 'potatoes', uuid, nameOf(p), 0)
    console.info('[BloodPool] ' + nameOf(p) + ' tithed ' + spend + ' potatoes (' + drops + ' Drops)')
    let msg = fmt(spend) + ' potatoes spilled into the Pool: ' + fmt(drops) + ' Drops. (Tithes don\'t raise your rank in the Potato War: /potatowar offer does.)'
    if (room > 0 && drops == room) msg += ' That fills the day\'s tithe.'
    return reply(ctx, msg + ' ' + statusText())
  }
  const unlock = (ctx, force) => {
    const D = db(), next = nextTier()
    if (!next) return reply(ctx, 'Every tier is already open.', true)
    if (!force && D.drops < next.drops) return reply(ctx, 'Tier ' + next.tier + ' needs ' + fmt(next.drops) + ' Drops; the Pool has ' + fmt(D.drops) + '. (/bloodpool unlock force to open it anyway.)', true)
    setTier(ctx.source.server, next.tier, who(ctx), true)
    return reply(ctx, 'Tier ' + next.tier + ' (' + next.name + ') unlocked: ' + contents(next) + '. Reloading so its recipes come back.')
  }

  event.register(Commands.literal('bloodpool')
    .executes(safe(ctx => reply(ctx, statusText())))
    .then(Commands.literal('donate').then(int('coins').executes(safe(ctx => {
      const p = me(ctx), e = global.Economy, n = Math.floor(num(ctx, 'coins'))
      if (!p) return reply(ctx, 'Players only.', true)
      if (!e) return reply(ctx, 'The Blood Pool can\'t take coins right now.', true)
      if (!(n >= 1)) return reply(ctx, 'Give at least one coin.', true)
      const have = e.countCoins(p)
      if (have < n) return reply(ctx, 'You only carry ' + have + ' Hush Coin' + (have == 1 ? '' : 's') + '.', true)
      e.takeCoins(p, n)
      addDrops(n * DROPS_PER_COIN, 'coins', uuidOf(p), nameOf(p), n)
      console.info('[BloodPool] ' + nameOf(p) + ' gave ' + n + ' coins')
      return reply(ctx, n + ' Hush Coin' + (n == 1 ? '' : 's') + ' given to the Blood Pool (' + fmt(n * DROPS_PER_COIN) + ' Drops). ' + statusText())
    }))))
    .then(Commands.literal('tithe')
      .executes(safe(ctx => tithe(ctx, 0)))
      .then(int('potatoes').executes(safe(ctx => tithe(ctx, Math.floor(num(ctx, 'potatoes')))))))
    .then(Commands.literal('top').executes(safe(ctx => {
      const C = db().contributors, list = Object.keys(C).sort((a, b) => C[b].drops - C[a].drops).slice(0, 10)
      if (!list.length) return reply(ctx, 'Nobody has given blood yet.')
      reply(ctx, 'The Blood Pool\'s greatest contributors:')
      list.forEach((u, i) => reply(ctx, '  ' + (i + 1) + '. ' + C[u].name + ': ' + fmt(C[u].drops) + ' Drops' + (C[u].coins ? ' (' + C[u].coins + ' coins)' : '')))
      return 1
    })))
    .then(Commands.literal('tiers').executes(safe(ctx => {
      const D = db()
      TIERS.forEach(T => reply(ctx, 'Tier ' + T.tier + ' · ' + T.name + ' · ' + fmt(T.drops) + ' Drops · ' + contents(T) + ' · ' +
        (T.tier <= D.tier ? 'OPEN' : D.drops >= T.drops ? 'READY' : 'sealed') +
        (STANDING_CRAFTING && T.tier <= STANDING.length ? ' · crafting needs ' + rankName(T.tier) : '')))
      return 1
    })))
    .then(Commands.literal('check').executes(safe(ctx => {
      const p = me(ctx)
      if (!p) return reply(ctx, 'Players only.', true)
      const s = p.mainHandItem
      if (!s || s.isEmpty()) return reply(ctx, 'Hold the item to check.', true)
      const n = tierOf(s.id, s), T = tierDef(n)
      if (!n) return reply(ctx, String(s.id) + ' isn\'t in any tier: it can always be crafted.')
      let rank = ''
      if (STANDING_CRAFTING && n <= STANDING.length) {
        let mine = standingOf(uuidOf(p))
        rank = ' At a crafting table it also needs ' + rankName(n) + ' in the Potato War (you: ' + mine.rank + ').'
        let PT = global.PotatoTree, node = PT && PT.handlesPlacing ? PT.placeNode(String(s.id)) : null
        let place = autocrafterRank(String(s.id))
        if (node) rank += ' Placing it needs ' + node + ' (/potatowar tree).'
        else if (place && !(PT && PT.handlesPlacing)) rank += ' Placing it needs ' + rankName(place) + '.'
      }
      return reply(ctx, String(s.id) + ' can be crafted from Tier ' + n + (T ? ' (' + T.name + ')' : '') + ': ' +
        (n <= db().tier ? 'open now.' : 'sealed for now (found ones still work).') + rank)
    })))
    .then(Commands.literal('audit').requires(op).executes(safe(ctx => {
      try { JsonIO.write(AUDIT_FLAG_FILE, { requested: 'true' }) } catch (e) { return reply(ctx, 'Could not write ' + AUDIT_FLAG_FILE + ': ' + e, true) }
      ctx.source.server.scheduleInTicks(RELOAD_DELAY_TICKS, () => { try { ctx.source.server.runCommandSilent('reload') } catch (e) { } })
      return reply(ctx, 'Reloading. The report goes to ' + AUDIT_FILE + ' (a summary in the server log).')
    })))
    .then(Commands.literal('unlock').requires(op)
      .executes(safe(ctx => unlock(ctx, false)))
      .then(Commands.literal('force').executes(safe(ctx => unlock(ctx, true)))))
    .then(Commands.literal('settier').requires(op).then(int('tier').executes(safe(ctx => {
      const n = num(ctx, 'tier')
      if (!(n >= 0 && n <= TIERS.length)) return reply(ctx, 'A tier from 0 (everything sealed) to ' + TIERS.length + '.', true)
      setTier(ctx.source.server, n, who(ctx), false)
      return reply(ctx, 'Open tier set to ' + n + ' (quietly). Reloading.')
    }))))
    .then(Commands.literal('add').requires(op).then(int('drops').executes(safe(ctx => {
      addDrops(num(ctx, 'drops'), 'op', '', '')
      return reply(ctx, statusText())
    }))))
    .then(Commands.literal('set').requires(op).then(int('drops').executes(safe(ctx => {
      const D = db()
      D.drops = Math.max(0, num(ctx, 'drops'))
      Object.keys(D.announced).forEach(k => { let T = tierDef(Number(k)); if (T && D.drops < T.drops) delete D.announced[k] })
      checkReady(ctx.source.server)
      save()
      return reply(ctx, statusText())
    })))))

  // ----- The Potato War -----
  const war = (ctx, text, bad) => {
    ctx.source.sendSystemMessage(comp([{ text: '[Potato War] ', color: 'gold' }, { text: text, color: bad ? 'red' : 'yellow' }]))
    return bad ? 0 : 1
  }
  const word = name => Commands.argument(name, StringArg.word())
  const str = (ctx, name) => String(StringArg.getString(ctx, name))
  // asked: how many potatoes (0 = all you carry).
  const offer = (ctx, asked) => {
    const p = me(ctx)
    if (!p) return war(ctx, 'Players only.', true)
    if (asked < 0) return war(ctx, 'Techno\'s war chest takes potatoes. It doesn\'t hand them out.', true)
    const have = countPotatoes(p)
    if (asked > have) return war(ctx, 'You only carry ' + fmt(have) + ' potatoes (crates count as 9).', true)
    const n = asked > 0 ? asked : have
    if (n < 1) return war(ctx, 'You carry no potatoes. Crates count as 9.', true)
    if (!takePotatoes(p, n)) return war(ctx, 'The potatoes slipped away. Nothing was offered.', true)
    const u = uuidOf(p)
    setStanding(ctx.source.server, u, nameOf(p), standingOf(u).potatoes + n, true)
    console.info('[BloodPool] Potato War: ' + nameOf(p) + ' offered ' + n + ' potatoes')
    return war(ctx, fmt(n) + ' potatoes offered to Techno\'s war chest. ' + standingText(standingOf(u)))
  }
  const opSet = (ctx, add) => {
    const t = standingTarget(ctx.source.server, str(ctx, 'player'))
    if (!t) return war(ctx, 'Nobody by that name is online or has offered potatoes.', true)
    const n = num(ctx, 'potatoes'), cur = standingOf(t.uuid).potatoes
    setStanding(ctx.source.server, t.uuid, t.name, add ? cur + n : n, true, !add)
    console.info('[BloodPool] Potato War: ' + who(ctx) + (add ? ' added ' : ' set ') + n + ' potatoes for ' + t.name)
    return war(ctx, t.name + ': ' + standingText(standingOf(t.uuid)))
  }
  event.register(Commands.literal('potatowar')
    .executes(safe(ctx => {
      const p = me(ctx)
      if (!p) return war(ctx, 'Players only.', true)
      const s = standingOf(uuidOf(p)), acc = craftAccess(uuidOf(p))
      let extra = acc > s.tier ? ' Crafting access: Tier ' + acc + ' (catch-up: the Blood Pool is at Tier ' + db().tier + ').' : ''
      return war(ctx, standingText(s) + extra + ' Offer potatoes with /potatowar offer [count]; they raise your rank, not the Blood Pool.')
    }))
    .then(Commands.literal('next').executes(safe(ctx => {
      const p = me(ctx)
      if (!p) return war(ctx, 'Players only.', true)
      const s = standingOf(uuidOf(p)), acc = craftAccess(uuidOf(p)), open = Math.min(db().tier, STANDING.length)
      war(ctx, standingText(s))
      if (open < 1) war(ctx, 'The Blood Pool hasn\'t opened a tier yet.')
      else if (acc >= open) war(ctx, 'You can craft everything the Blood Pool has opened (Tier ' + db().tier + ').')
      else war(ctx, 'Crafting access: Tier ' + acc + (acc > s.tier ? ' (catch-up)' : '') + ' of ' + open + ' open. ' + rankName(open) + ' crafts it all: ' +
        fmt(Math.max(0, STANDING[open - 1] - s.potatoes)) + ' potatoes to go.')
      const PT = global.PotatoTree
      if (PT) {
        let st = PT.status(p)
        war(ctx, st.ready.length ? 'Ready in the upgrade tree (/potatowar tree): ' + st.ready.join(', ') + '.' : 'Nothing in the upgrade tree is ready to buy yet.')
        st.soon.slice(0, 5).forEach(x => war(ctx, '  Next: ' + x.name + ' (needs ' + x.missing.join(', ') + ')'))
      }
      return 1
    })))
    .then(Commands.literal('tree').executes(safe(ctx => {
      const p = me(ctx), PT = global.PotatoTree
      if (!p) return war(ctx, 'Players only.', true)
      if (!PT) return war(ctx, 'The upgrade tree isn\'t installed.', true)
      PT.open(p)
      return 1
    })))
    .then(Commands.literal('offer')
      .executes(safe(ctx => offer(ctx, 0)))
      .then(int('potatoes').executes(safe(ctx => offer(ctx, Math.floor(num(ctx, 'potatoes')))))))
    .then(Commands.literal('top').executes(safe(ctx => {
      const S = db().standing, list = Object.keys(S).filter(u => S[u].potatoes > 0).sort((a, b) => S[b].potatoes - S[a].potatoes).slice(0, 10)
      if (!list.length) return war(ctx, 'Nobody has offered a potato yet.')
      war(ctx, 'Techno\'s Potato War, by potatoes offered:')
      list.forEach((u, i) => war(ctx, '  ' + (i + 1) + '. ' + S[u].name + ': ' + rankName(standingTierOf(S[u].potatoes)) + ' (' + fmt(S[u].potatoes) + ')'))
      return 1
    })))
    .then(Commands.literal('ranks').executes(safe(ctx => {
      STANDING.forEach((need, i) => war(ctx, (i + 1) + '. ' + rankName(i + 1) + ': ' + fmt(need) + ' potatoes' +
        (STANDING_CRAFTING ? ' · crafts Tier ' + (i + 1) + ' (' + (tierDef(i + 1) || { name: '?' }).name + ')' : '')))
      return 1
    })))
    .then(Commands.literal('check').requires(op).then(word('player').executes(safe(ctx => {
      const t = standingTarget(ctx.source.server, str(ctx, 'player'))
      if (!t) return war(ctx, 'Nobody by that name is online or has offered potatoes.', true)
      return war(ctx, t.name + ': ' + standingText(standingOf(t.uuid)))
    }))))
    .then(Commands.literal('add').requires(op).then(word('player').then(int('potatoes').executes(safe(ctx => opSet(ctx, true))))))
    .then(Commands.literal('set').requires(op).then(word('player').then(int('potatoes').executes(safe(ctx => opSet(ctx, false)))))))
})

})()
