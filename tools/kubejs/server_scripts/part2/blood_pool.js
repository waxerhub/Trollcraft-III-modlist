// Part II: Blood for the Blood God. The Blood Pool and its tier locks (see STORY.md, tools/kubejs/BLOOD_POOL.md).
//
//  - All progression is locked into 12 tiers. Locks are crafting only: a tier's mods, items and tags can't be crafted
//    (their recipes are removed, in every recipe type) until the server-wide Blood Pool reaches it AND an op breaks the
//    seal with /bloodpool unlock (which reloads, so the recipes come back). Found, looted or traded items work normally.
//  - The Pool fills with every troll in the Troll Log (economy/trolls.js), with donated Hush Coins and with the
//    Potato Tithe (4,000 potatoes = 1,000 Drops, capped per day; the quota resets at 4 am Central).
//  - Anything not listed in any tier is always open. The Nether and End open at their tiers (part2/dimension_gates.js).
//
// Commands: /bloodpool [donate <coins>|tithe [potatoes]|top|tiers|check] (anyone);
//           /bloodpool unlock [force]|settier <n>|add|set (op).
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
        TINKERS_MATERIALS(['steel']), TINKERS_CASTING(['steel']),
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
        TINKERS_MATERIALS(['cobalt', 'scorched_stone', 'knightmetal']), TINKERS_CASTING(['cobalt', 'knightmetal']),
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
        /^tconstruct:tables\/recycling\/twilightforest\/yeti_/,
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
const TO_DISCORD = true                // public Pool lines with tellraw @a (posted to Discord); false = in game only
const TIER_FILE = 'kubejs/blood_pool_tier.json'
const RELOAD_DELAY_TICKS = 20          // /bloodpool unlock reloads this long after announcing

const VOICE_BLOOD = { tag: '[BLOOD GOD]', tagColor: 'dark_red', textColor: 'red' }
const VOICE_POOL = { tag: '[Blood Pool]', tagColor: 'dark_red', textColor: 'gray' }
const LINES = {
  ready: 'The Blood Pool overflows. Tier %n (%name) waits for the Ministry\'s seal to break.',
  unlocked: 'The seal breaks. Tier %n (%name) is open. Blood for the Blood God.',
}


// ===================== STATE =====================

const DATA_KEY = 'blood_pool'

let Serializer = null
try { Serializer = Java.loadClass('net.minecraft.network.chat.Component$Serializer') } catch (e) { }

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
//   potatoDay: 'YYYY-MM-DD' (the tithe day), potatoDrops: Drops tithed that day, potatoByPlayer: { uuid: Drops } }

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
  console.info('[BloodPool] Tier set to ' + D.tier + ' by ' + by + '; reloading')
  server.scheduleInTicks(RELOAD_DELAY_TICKS, () => { try { server.runCommandSilent('reload') } catch (e) { console.error('[BloodPool] reload: ' + e) } })
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
    if (asked < 0) return reply(ctx, 'The Ministry does not refund potatoes.', true)
    const uuid = uuidOf(p), have = countPotatoes(p)
    if (asked > have) return reply(ctx, 'You only carry ' + fmt(have) + ' potatoes (crates count as 9).', true)
    let drops = Math.floor((asked > 0 ? asked : have) / POTATOES_PER_DROP)
    if (drops < 1) return reply(ctx, 'The Ministry weighs potatoes in fours at the least. You carry ' + fmt(have) + '.', true)
    const room = potatoRoom(uuid)
    if (room == 0) return reply(ctx, 'The Ministry will not weigh another potato today. The quota opens again at ' + TITHE_RESET_HOUR + ' am.', true)
    if (room > 0 && drops > room) drops = room
    const spend = drops * POTATOES_PER_DROP
    if (!takePotatoes(p, spend)) return reply(ctx, 'The potatoes slipped away. Nothing was tithed.', true)
    const D = db()
    D.potatoDrops = (D.potatoDrops || 0) + drops
    D.potatoByPlayer[uuid] = (D.potatoByPlayer[uuid] || 0) + drops
    addDrops(drops, 'potatoes', uuid, nameOf(p), 0)
    console.info('[BloodPool] ' + nameOf(p) + ' tithed ' + spend + ' potatoes (' + drops + ' Drops)')
    let msg = fmt(spend) + ' potatoes weighed and accepted: ' + fmt(drops) + ' Drops.'
    if (room > 0 && drops == room) msg += ' That fills the day\'s quota.'
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
        (T.tier <= D.tier ? 'OPEN' : D.drops >= T.drops ? 'READY' : 'sealed')))
      return 1
    })))
    .then(Commands.literal('check').executes(safe(ctx => {
      const p = me(ctx)
      if (!p) return reply(ctx, 'Players only.', true)
      const s = p.mainHandItem
      if (!s || s.isEmpty()) return reply(ctx, 'Hold the item to check.', true)
      const n = tierOf(s.id, s), T = tierDef(n)
      if (!n) return reply(ctx, String(s.id) + ' isn\'t in any tier: it can always be crafted.')
      return reply(ctx, String(s.id) + ' can be crafted from Tier ' + n + (T ? ' (' + T.name + ')' : '') + ': ' +
        (n <= db().tier ? 'open now.' : 'sealed for now (found ones still work).'))
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
})

})()
