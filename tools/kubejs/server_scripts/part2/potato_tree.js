// Part II: the Potato War's upgrade tree (see tools/kubejs/POTATO_TREE.md, STORY.md).
//
//  - The tree lives in FTB Quests (chapter group "Techno's Potato War", files in tools/ftbquests/). Each node is a
//    quest: stage tasks for the rank and the Blood Pool tier, item tasks that take potatoes and the branch's items,
//    and a stage reward potato_tree_<node>. This script enforces what the nodes unlock, by reading those stages:
//      * gear: Tinkers tools and armour made of a node's materials (and the listed Twilight Forest gear) don't
//        break blocks, hit, or right-click for players without the node; locked armour is taken off;
//      * placing: smelteries, autocrafters, logistics and farm blocks need their node, and so does right-clicking
//        (using) them, even when someone else placed them; AE2 terminals need ME Logistics (the wireless crafting
//        and pattern terminals ME Autocrafting);
//      * potatoes handed in for a node count toward the player's rank (part2/blood_pool.js);
//      * catch-up: when the Blood Pool opens Tier T, every node of Tier T-2 and below is completed for everyone;
//      * parties are switched off (FTB Teams), so every player's quest progress is their own.
//
// Needs: part2/blood_pool.js, FTB Quests + FTB Library + FTB Teams + FTB XMod Compat (without them only the locks
// work). Commands: /potatowar tree (anyone); /potatotree check|grant|revoke|catchup (op).
// Copy to <server>/kubejs/server_scripts/part2/ and run /reload. Part II only.
//
// KubeJS 6 notes: no template strings; `let` inside nested blocks; closures in loops use forEach; event.cancel() last.

(function () {

// ===================== SETTINGS =====================

// The nodes. n: a fixed number that makes the quest's id (never reuse or change one; add new nodes with new numbers).
//   rank: the Potato War rank needed; tier: the Blood Pool tier needed (0 = none); needs: nodes below it.
//   potatoes + items: the cost (taken by the quest). materials: Tinkers material ids it unlocks; gear: other item
//   ids it unlocks (tools and armour); places: items/blocks it lets you place; parts: the ones among them that are
//   placed ONTO another block (AE2 parts, Thermal attachments, conduits): those are checked when right-clicked with,
//   the rest when the block is placed; use: blocks it lets you right-click (defaults to places); wireless: wireless
//   terminal items it lets you use. x, y: position in the quest book.
// The quest files are generated from this list (tools/ftbquests/); change both together (see POTATO_TREE.md).
const NODES = [
  // ---- Tinkers' Smithy ----
  { n: 1, id: 'seared_smeltery', name: 'Seared Smeltery', chapter: 'smithy', rank: 1, tier: 0, needs: [],
    potatoes: 250, items: [['tconstruct:seared_brick', 16]], icon: 'tconstruct:smeltery_controller', x: 0, y: 0,
    places: ['tconstruct:smeltery_controller'], desc: 'Build your own smeltery.' },
  { n: 2, id: 'steel_smithing', name: 'Steel Smithing', chapter: 'smithy', rank: 3, tier: 3, needs: ['seared_smeltery'],
    potatoes: 2500, items: [['tconstruct:steel_ingot', 32]], icon: 'tconstruct:steel_ingot', x: 0, y: -2,
    materials: ['tconstruct:steel'], desc: 'Use Tinkers tools made with steel.' },
  { n: 3, id: 'osmium_steeleaf', name: 'Osmium & Steeleaf', chapter: 'smithy', rank: 4, tier: 4, needs: ['steel_smithing'],
    potatoes: 25000, items: [['mekanism:ingot_osmium', 16], ['twilightforest:steeleaf_ingot', 16]], icon: 'twilightforest:steeleaf_ingot', x: 0, y: -4,
    materials: ['tconstruct:osmium', 'tconstruct:steeleaf'],
    gear: ['twilightforest:steeleaf_helmet', 'twilightforest:steeleaf_chestplate', 'twilightforest:steeleaf_leggings', 'twilightforest:steeleaf_boots',
      'twilightforest:steeleaf_sword', 'twilightforest:steeleaf_pickaxe', 'twilightforest:steeleaf_axe', 'twilightforest:steeleaf_shovel', 'twilightforest:steeleaf_hoe'],
    desc: 'Use osmium and steeleaf Tinkers tools, and Twilight Forest steeleaf gear.' },
  { n: 4, id: 'foundry', name: 'The Foundry', chapter: 'smithy', rank: 5, tier: 5, needs: ['seared_smeltery'],
    potatoes: 25000, items: [['tconstruct:scorched_brick', 64]], icon: 'tconstruct:foundry_controller', x: 3, y: -2,
    places: ['tconstruct:foundry_controller', 'tconstruct:scorched_alloyer'], desc: 'Build your own foundry and alloyer.' },
  { n: 5, id: 'cobalt_smithing', name: 'Cobalt Smithing', chapter: 'smithy', rank: 5, tier: 5, needs: ['osmium_steeleaf'],
    potatoes: 50000, items: [['tconstruct:cobalt_ingot', 32], ['twilightforest:knightmetal_ingot', 8]], icon: 'tconstruct:cobalt_ingot', x: 0, y: -6,
    materials: ['tconstruct:cobalt', 'tconstruct:knightmetal', 'tconstruct:knightly', 'tconstruct:scorched_stone'],
    gear: ['twilightforest:knightmetal_helmet', 'twilightforest:knightmetal_chestplate', 'twilightforest:knightmetal_leggings', 'twilightforest:knightmetal_boots',
      'twilightforest:knightmetal_sword', 'twilightforest:knightmetal_axe', 'twilightforest:knightmetal_pickaxe', 'twilightforest:knightmetal_ring',
      'twilightforest:knightmetal_shield', 'twilightforest:block_and_chain'],
    desc: 'Use cobalt, knightmetal (and knightly) and scorched stone Tinkers tools, and Twilight Forest knightmetal gear.' },
  { n: 6, id: 'alloy_smithing', name: 'Alloy Smithing', chapter: 'smithy', rank: 6, tier: 6, needs: ['cobalt_smithing'],
    potatoes: 100000, items: [['thermal:electrum_ingot', 16], ['twilightforest:fiery_ingot', 8]], icon: 'thermal:electrum_ingot', x: 0, y: -8,
    materials: ['tconstruct:electrum', 'tconstruct:invar', 'tconstruct:constantan', 'tconstruct:silver', 'tconstruct:lead',
      'tconstruct:pewter', 'tconstruct:aluminum', 'tconstruct:fiery'],
    gear: ['twilightforest:fiery_helmet', 'twilightforest:fiery_chestplate', 'twilightforest:fiery_leggings', 'twilightforest:fiery_boots',
      'twilightforest:fiery_sword', 'twilightforest:fiery_pickaxe'],
    desc: 'Use electrum, invar, constantan, silver, lead, pewter, aluminum and fiery Tinkers tools, and Twilight Forest fiery gear.' },
  { n: 7, id: 'masterwork', name: 'Masterwork', chapter: 'smithy', rank: 8, tier: 8, needs: ['alloy_smithing', 'foundry'],
    potatoes: 300000, items: [['tconstruct:manyullyn_ingot', 16], ['tconstruct:hepatizon_ingot', 16]], icon: 'tconstruct:manyullyn_ingot', x: 1.5, y: -10,
    materials: ['tconstruct:manyullyn', 'tconstruct:hepatizon', 'tconstruct:queens_slime', 'tconstruct:cinderslime', 'tconstruct:necronium',
      'tconstruct:blazing_bone', 'tconstruct:blazewood', 'tconstruct:ancient', 'tconstruct:enderslime', 'tconstruct:ichor'],
    desc: 'Use manyullyn, hepatizon, queen\'s slime, cinderslime and the other Nether masterwork materials.' },
  { n: 8, id: 'dragonsteel', name: 'Dragonsteel', chapter: 'smithy', rank: 9, tier: 9, needs: ['masterwork'],
    potatoes: 500000, items: [['iceandfire:dragonsteel_fire_ingot', 8], ['iceandfire:dragonsteel_ice_ingot', 8], ['iceandfire:dragonsteel_lightning_ingot', 8]],
    icon: 'iceandfire:dragonsteel_fire_ingot', x: 1.5, y: -12,
    materials: ['tconstruct:dragon_scale', 'tcintegrations:dragonsteel_fire', 'tcintegrations:dragonsteel_ice', 'tcintegrations:dragonsteel_lightning'],
    desc: 'Use dragon scale and dragonsteel Tinkers tools.' },

  // ---- Logistics ----
  { n: 11, id: 'create_logistics', name: 'Create Logistics', chapter: 'logistics', rank: 1, tier: 1, needs: [],
    potatoes: 500, items: [['create:andesite_alloy', 16]], icon: 'create:brass_funnel', x: 0, y: 0,
    places: ['create:andesite_funnel', 'create:brass_funnel', 'create:andesite_tunnel', 'create:brass_tunnel', 'create:smart_chute', 'create:portable_storage_interface',
      'create:andesite_belt_funnel', 'create:brass_belt_funnel'],   // a funnel placed on a belt becomes a belt funnel block
    desc: 'Place and use Create funnels, tunnels, smart chutes and portable storage interfaces.' },
  { n: 12, id: 'create_automation', name: 'Create Automation', chapter: 'logistics', rank: 4, tier: 4, needs: ['create_logistics'],
    potatoes: 25000, items: [['create:precision_mechanism', 8]], icon: 'create:mechanical_arm', x: 0, y: -2,
    places: ['create:deployer', 'create:mechanical_arm'], desc: 'Place and use Deployers and Mechanical Arms (and so Sequenced Assembly).' },
  { n: 13, id: 'immersive_logistics', name: 'Immersive Logistics', chapter: 'logistics', rank: 3, tier: 3, needs: [],
    potatoes: 2500, items: [['immersiveengineering:ingot_steel', 16]], icon: 'immersiveengineering:conveyor_basic', x: 3, y: 0,
    places: ['immersiveengineering:conveyor_basic', 'immersiveengineering:sorter', 'immersiveengineering:fluid_sorter'],
    desc: 'Place and use Immersive Engineering conveyors and sorters.' },
  { n: 14, id: 'logistical_transport', name: 'Logistical Transport', chapter: 'logistics', rank: 4, tier: 4, needs: [],
    potatoes: 25000, items: [['mekanism:basic_control_circuit', 8]], icon: 'mekanism:basic_logistical_transporter', x: 6, y: 0,
    places: ['mekanism:basic_logistical_transporter', 'mekanism:advanced_logistical_transporter', 'mekanism:elite_logistical_transporter',
      'mekanism:ultimate_logistical_transporter', 'mekanism:restrictive_transporter', 'mekanism:diversion_transporter', 'mekanism:logistical_sorter',
      'mekanism:qio_importer', 'mekanism:qio_exporter'],
    desc: 'Place and use Mekanism logistical transporters, the logistical sorter and QIO importers and exporters.' },
  { n: 15, id: 'thermal_servos', name: 'Thermal Servos', chapter: 'logistics', rank: 5, tier: 5, needs: [],
    potatoes: 50000, items: [['thermal:tin_gear', 8]], icon: 'thermal:servo_attachment', x: 9, y: 0,
    places: ['thermal:servo_attachment', 'thermal:turbo_servo_attachment', 'thermal:filter_attachment'], use: [],
    parts: ['thermal:servo_attachment', 'thermal:turbo_servo_attachment', 'thermal:filter_attachment'],
    desc: 'Attach Thermal servos and filters to ducts.' },
  { n: 16, id: 'item_conduits', name: 'Item Conduits', chapter: 'logistics', rank: 5, tier: 5, needs: [],
    potatoes: 50000, items: [['enderio:conduit_binder', 16]], icon: 'enderio:item_conduit', x: 12, y: 0,
    places: ['enderio:item_conduit', 'enderio:vacuum_chest', 'enderio:xp_vacuum'], use: ['enderio:vacuum_chest', 'enderio:xp_vacuum'],
    parts: ['enderio:item_conduit'], desc: 'Place Ender IO item conduits, and place and use the Vacuum Chest and XP Vacuum.' },
  { n: 17, id: 'me_logistics', name: 'ME Logistics', chapter: 'logistics', rank: 6, tier: 6, needs: [],
    potatoes: 100000, items: [['ae2:logic_processor', 16]], icon: 'ae2:interface', x: 6, y: -2,
    places: ['ae2:import_bus', 'ae2:export_bus', 'ae2:interface', 'ae2:cable_interface', 'ae2:storage_bus', 'ae2:annihilation_plane',
      'ae2:formation_plane', 'ae2:toggle_bus', 'ae2:inverted_toggle_bus', 'ae2:item_p2p_tunnel', 'ae2:fluid_p2p_tunnel', 'ae2:fe_p2p_tunnel',
      'ae2:me_p2p_tunnel', 'ae2:redstone_p2p_tunnel', 'ae2:light_p2p_tunnel', 'advanced_ae:import_export_bus_part', 'advanced_ae:stock_export_bus_part',
      'enderio:me_conduit', 'enderio:dense_me_conduit'],
    parts: ['ae2:import_bus', 'ae2:export_bus', 'ae2:cable_interface', 'ae2:storage_bus', 'ae2:annihilation_plane', 'ae2:formation_plane',
      'ae2:toggle_bus', 'ae2:inverted_toggle_bus', 'ae2:item_p2p_tunnel', 'ae2:fluid_p2p_tunnel', 'ae2:fe_p2p_tunnel', 'ae2:me_p2p_tunnel',
      'ae2:redstone_p2p_tunnel', 'ae2:light_p2p_tunnel', 'advanced_ae:import_export_bus_part', 'advanced_ae:stock_export_bus_part',
      'enderio:me_conduit', 'enderio:dense_me_conduit'],
    use: [],
    desc: 'Place AE2 import, export and storage buses, interfaces, annihilation and formation planes, toggle buses and P2P tunnels (and Advanced AE\'s buses). Basic ME storage and terminals need no node.' },

  // Tier 7: the Digital Miner needs a teleportation core (Tier 7), and the Mechanical Miner is Extra Utilities (Tier 7).
  { n: 18, id: 'automated_mining', name: 'Automated Mining', chapter: 'logistics', rank: 7, tier: 7, needs: [],
    potatoes: 175000, items: [['mekanism:ingot_osmium', 32]], icon: 'mekanism:digital_miner', x: 9, y: -2,
    places: ['mekanism:digital_miner', 'extrautilitiesreborn:mechanical_miner', 'extrautilitiesreborn:ender_quarry', 'alexscaves:quarry'],
    desc: 'Place and use the Digital Miner, the Mechanical Miner, the Ender Quarry and Alex\'s Caves\' Quarry (each also needs its own Blood Pool tier to be made).' },

  // ---- Autocrafting ----
  { n: 21, id: 'mechanical_crafting', name: 'Mechanical Crafting', chapter: 'autocrafting', rank: 4, tier: 4, needs: ['create_automation'],
    potatoes: 25000, items: [['create:precision_mechanism', 8]], icon: 'create:mechanical_crafter', x: 0, y: 0,
    places: ['create:mechanical_crafter'], desc: 'Place and use Create Mechanical Crafters.' },
  { n: 22, id: 'formulaic_assembly', name: 'Formulaic Assembly', chapter: 'autocrafting', rank: 4, tier: 4, needs: [],
    potatoes: 25000, items: [['mekanism:basic_control_circuit', 4]], icon: 'mekanism:formulaic_assemblicator', x: 3, y: 0,
    places: ['mekanism:formulaic_assemblicator'], desc: 'Place and use the Formulaic Assemblicator.' },
  { n: 23, id: 'enderio_crafting', name: 'Ender IO Crafting', chapter: 'autocrafting', rank: 5, tier: 5, needs: [],
    potatoes: 50000, items: [['enderio:void_chassis', 2]], icon: 'enderio:crafter', x: 6, y: 0,
    places: ['enderio:crafter'], desc: 'Place and use the Ender IO Crafter.' },
  { n: 24, id: 'thermal_fabrication', name: 'Thermal Fabrication', chapter: 'autocrafting', rank: 5, tier: 5, needs: [],
    potatoes: 50000, items: [['thermal:machine_frame', 4]], icon: 'thermal:machine_crafter', x: 9, y: 0,
    places: ['thermal:machine_crafter'], desc: 'Place and use the Sequential Fabricator.' },
  { n: 25, id: 'me_autocrafting', name: 'ME Autocrafting', chapter: 'autocrafting', rank: 6, tier: 6, needs: ['me_logistics'],
    potatoes: 100000, items: [['ae2:engineering_processor', 16]], icon: 'ae2:molecular_assembler', x: 3, y: -2,
    places: ['ae2:pattern_provider', 'ae2:cable_pattern_provider', 'ae2:pattern_encoding_terminal', 'ae2:crafting_unit', 'ae2:crafting_accelerator',
      'ae2:1k_crafting_storage', 'ae2:4k_crafting_storage', 'ae2:16k_crafting_storage', 'ae2:64k_crafting_storage', 'ae2:256k_crafting_storage',
      'ae2:crafting_monitor', 'ae2:molecular_assembler', 'advanced_ae:adv_pattern_provider', 'advanced_ae:adv_pattern_provider_part',
      'advanced_ae:small_adv_pattern_provider', 'advanced_ae:small_adv_pattern_provider_part'],
    parts: ['ae2:cable_pattern_provider', 'ae2:pattern_encoding_terminal', 'advanced_ae:adv_pattern_provider_part', 'advanced_ae:small_adv_pattern_provider_part'],
    use: ['ae2:pattern_provider', 'ae2:crafting_unit', 'ae2:crafting_accelerator', 'ae2:1k_crafting_storage', 'ae2:4k_crafting_storage',
      'ae2:16k_crafting_storage', 'ae2:64k_crafting_storage', 'ae2:256k_crafting_storage', 'ae2:crafting_monitor', 'ae2:molecular_assembler',
      'advanced_ae:adv_pattern_provider', 'advanced_ae:small_adv_pattern_provider'],
    wireless: ['ae2:wireless_crafting_terminal', 'advanced_ae:wireless_quantum_crafter_terminal',
      'ae2wtlib:wireless_universal_terminal', 'ae2wtlib:wireless_pattern_encoding_terminal', 'ae2wtlib:wireless_pattern_access_terminal'],
    desc: 'Place and use AE2 (and Advanced AE) pattern providers, crafting CPUs and Molecular Assemblers, and use wireless crafting and pattern terminals.' },
  { n: 26, id: 'rftools_crafting', name: 'RFTools Crafting', chapter: 'autocrafting', rank: 7, tier: 7, needs: ['enderio_crafting'],
    potatoes: 175000, items: [['rftoolsbase:machine_frame', 4]], icon: 'rftoolsutility:crafter1', x: 6, y: -2,
    places: ['rftoolsutility:crafter1', 'rftoolsutility:crafter2', 'rftoolsutility:crafter3'], desc: 'Place and use RFTools Crafters.' },
  // Tier 11: the Quantum Crafter's parts (quantum units, processors) are Tier 11 items.
  { n: 27, id: 'quantum_crafting', name: 'Quantum Crafting', chapter: 'autocrafting', rank: 11, tier: 11, needs: ['me_autocrafting'],
    potatoes: 500000, items: [['ae2:calculation_processor', 16]], icon: 'advanced_ae:quantum_crafter', x: 3, y: -4,
    places: ['advanced_ae:quantum_crafter', 'advanced_ae:quantum_crafter_terminal'], use: ['advanced_ae:quantum_crafter'],
    parts: ['advanced_ae:quantum_crafter_terminal'],
    desc: 'Place and use Advanced AE\'s Quantum Crafter.' },

  { n: 28, id: 'immersive_assembly', name: 'Immersive Assembly', chapter: 'autocrafting', rank: 4, tier: 4, needs: [],
    potatoes: 25000, items: [['immersiveengineering:component_steel', 8]], icon: 'immersiveengineering:component_steel', x: 12, y: 0,
    places: [], use: ['immersiveengineering:assembler'],
    desc: 'Use Immersive Engineering\'s Assembler multiblock (it is formed with the hammer, so only using it is locked).' },

  // ---- Farms ----
  { n: 31, id: 'create_farming', name: 'Create Farming', chapter: 'farms', rank: 1, tier: 1, needs: [],
    potatoes: 500, items: [['create:andesite_casing', 8]], icon: 'create:mechanical_harvester', x: 0, y: 0,
    places: ['create:mechanical_harvester', 'create:mechanical_plough'], desc: 'Place Mechanical Harvesters and Ploughs.' },
  { n: 32, id: 'growth_acceleration', name: 'Growth Acceleration', chapter: 'farms', rank: 2, tier: 1, needs: [],
    potatoes: 1000, items: [['mysticalagriculture:inferium_essence', 16]], icon: 'mysticalagriculture:inferium_growth_accelerator', x: 3, y: 0,
    places: ['mysticalagriculture:inferium_growth_accelerator', 'mysticalagriculture:prudentium_growth_accelerator',
      'mysticalagriculture:tertium_growth_accelerator', 'mysticalagriculture:imperium_growth_accelerator',
      'mysticalagriculture:supremium_growth_accelerator', 'mysticalagriculture:harvester'],
    desc: 'Place Mystical Agriculture growth accelerators and the Harvester.' },
  { n: 33, id: 'garden_cloche', name: 'Garden Cloche', chapter: 'farms', rank: 3, tier: 3, needs: [],
    potatoes: 2500, items: [['immersiveengineering:treated_wood_horizontal', 8]], icon: 'immersiveengineering:cloche', x: 6, y: 0,
    places: ['immersiveengineering:cloche'], desc: 'Place and use the Garden Cloche.' },
  { n: 34, id: 'insolation', name: 'Phytogenic Insolation', chapter: 'farms', rank: 5, tier: 5, needs: ['garden_cloche'],
    potatoes: 50000, items: [['thermal:phytogro', 4]], icon: 'thermal:machine_insolator', x: 6, y: -2,
    places: ['thermal:machine_insolator'], desc: 'Place and use the Phytogenic Insolator.' },
  // Tier 5 (the Soulium Spawner's tier); the Ender IO, RFTools and Draconic spawners come with their own tiers.
  { n: 35, id: 'powered_spawning', name: 'Mob Spawning', chapter: 'farms', rank: 5, tier: 5, needs: [],
    potatoes: 50000, items: [['mysticalagriculture:soulium_ingot', 8]], icon: 'enderio:powered_spawner', x: 9, y: 0,
    places: ['enderio:powered_spawner', 'mysticalagriculture:soulium_spawner', 'rftoolsutility:spawner', 'draconicevolution:stabilized_spawner'],
    desc: 'Place and use powered mob spawners: Ender IO\'s Powered Spawner, Mystical Agriculture\'s Soulium Spawner, the RFTools Spawner and Draconic Evolution\'s Stabilized Spawner.' },
]
const CHAPTERS = {          // chapter key: [id number, title, icon, file name]; listed in book order
  start: [6, 'Start Here', 'minecraft:book', 'potato_war_start'],
  ranks: [1, 'The Ranks', 'minecraft:potato', 'potato_war_ranks'],
  blood_pool: [7, 'The Blood Pool', 'minecraft:redstone_block', 'potato_war_blood_pool'],
  smithy: [2, 'Tinkers\' Smithy', 'tconstruct:smeltery_controller', 'potato_war_smithy'],
  logistics: [3, 'Logistics', 'create:brass_funnel', 'potato_war_logistics'],
  autocrafting: [4, 'Autocrafting', 'ae2:molecular_assembler', 'potato_war_autocrafting'],
  farms: [5, 'Farms', 'immersiveengineering:cloche', 'potato_war_farms'],
}
const NO_PARTIES = true          // switch FTB Teams parties off, so every player's quest progress is their own
const LOCK_ARMOR = true          // take locked armour off (checked every ARMOR_CHECK_TICKS)
const ARMOR_CHECK_TICKS = 40
const MESSAGE_COOLDOWN_TICKS = 60
const CATCH_UP_LOGIN_DELAY_TICKS = 60   // after a login, before catching that player up (FTB Quests loads their data)
const STAGE_PREFIX = 'potato_tree_'
const ID_PREFIX = '507A7000'     // every id in the quest files starts with this (the rest is the node's n)
const VOICE = { tag: '[POTATO WAR]', tagColor: 'gold', textColor: 'yellow' }


// ===================== HELPERS =====================

let Serializer = null, StringArg = null
try { Serializer = Java.loadClass('net.minecraft.network.chat.Component$Serializer') } catch (e) { }
try { StringArg = Java.loadClass('com.mojang.brigadier.arguments.StringArgumentType') } catch (e) { }

if (!global.potatoTreeState) global.potatoTreeState = { token: 0 }
const S = global.potatoTreeState
S.token++
S.lastMsg = {}
S.forcing = false

function hex8(v) { return ('00000000' + Number(v).toString(16).toUpperCase()).slice(-8) }
function questId(node) { return ID_PREFIX + hex8(0x10000 + node.n) }
function chapterId(key) { return ID_PREFIX + hex8(0xC000 + CHAPTERS[key][0]) }

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
function exempt(p) {
  if (isOp(p)) return true
  try { if (p.isCreative() || p.isSpectator()) return true } catch (e) { }
  return false
}
function comp(text) {
  const json = JSON.stringify(['', { text: VOICE.tag, color: VOICE.tagColor, bold: true }, { text: ' ' + text, color: VOICE.textColor }])
  if (Serializer) { try { return Serializer.fromJsonLenient(json) } catch (e) { } }
  return Text.of(VOICE.tag + ' ' + text)
}
function tell(p, text) { try { p.tell(comp(text)) } catch (e) { } }
// A short notice on the action bar, at most once every MESSAGE_COOLDOWN_TICKS per player.
function warn(p, text) {
  const server = p.server || Utils.server, u = uuidOf(p), now = server ? server.tickCount : 0
  if (S.lastMsg[u] != null && now - S.lastMsg[u] < MESSAGE_COOLDOWN_TICKS) return
  S.lastMsg[u] = now
  let c = null
  try { c = Serializer ? Serializer.fromJsonLenient(JSON.stringify({ text: text, color: 'gold' })) : Text.of(text) } catch (e) { c = Text.of(text) }
  try { p.setStatusMessage(c); return } catch (e) { }
  tell(p, text)
}
function BP() { return global.BloodPool || null }
function gap() { const b = BP(); return b && b.catchUpGap != null ? Number(b.catchUpGap) : 2 }


// ===================== WHAT EACH NODE UNLOCKS =====================

const NODE = {}, MATERIAL_NODE = {}, GEAR_NODE = {}, PLACE_NODE = {}, PART_NODE = {}, USE_NODE = {}, WIRELESS_NODE = {}
NODES.forEach(N => {
  NODE[N.id] = N
  ;(N.materials || []).forEach(m => { MATERIAL_NODE[m] = N })
  ;(N.gear || []).forEach(i => { GEAR_NODE[i] = N })
  ;(N.places || []).forEach(i => { PLACE_NODE[i] = N })
  ;(N.parts || []).forEach(i => { PART_NODE[i] = N })
  ;(N.use != null ? N.use : (N.places || [])).forEach(b => { USE_NODE[b] = N })
  ;(N.wireless || []).forEach(i => { WIRELESS_NODE[i] = N })
})
// The tier a node belongs to for catch-up: its Blood Pool tier or its rank, whichever is higher (at least 1).
function nodeTier(N) { return Math.max(1, N.tier || 0, N.rank || 0) }

function has(p, N) {
  try { return !!p.stages.has(STAGE_PREFIX + N.id) } catch (e) { return false }
}
function needText(N) { return N.name + ' needed (/potatowar tree)' }

// Tinkers tools and armour list their materials in NBT: tic_materials, a list of ids ("tconstruct:cobalt",
// sometimes with a variant after #).
function materialsOf(s) {
  const out = []
  try {
    let tag = s.nbt
    if (!tag || !tag.contains('tic_materials')) return out
    let list = tag.getList('tic_materials', 8)
    for (let i = 0; i < list.size(); i++) out.push(String(list.getString(i)).split('#')[0])
  } catch (e) { }
  return out
}
// The node this item needs and the player lacks, or null.
function gearLock(p, s) {
  if (!s || s.isEmpty()) return null
  const id = String(s.id)
  if (GEAR_NODE[id] && !has(p, GEAR_NODE[id])) return GEAR_NODE[id]
  const mats = materialsOf(s)
  for (let i = 0; i < mats.length; i++) {
    let N = MATERIAL_NODE[mats[i]]
    if (N && !has(p, N)) return N
  }
  return null
}


// ===================== THE LOCKS =====================

// Breaking blocks with locked gear.
BlockEvents.broken(event => {
  const p = event.player
  if (!p || exempt(p)) return
  const N = gearLock(p, p.mainHandItem)
  if (!N) return
  warn(p, needText(N))
  event.cancel()
})

// Hitting with locked gear.
EntityEvents.hurt(event => {
  let a = null
  try { a = event.source.actual } catch (e) { }
  if (!a || !a.isPlayer() || exempt(a)) return
  const N = gearLock(a, a.mainHandItem)
  if (!N) return
  warn(a, needText(N))
  event.cancel()
})

// Right-clicking locked gear (bows, crossbows, shields) or a wireless terminal.
ItemEvents.rightClicked(event => {
  const p = event.player
  if (!p || exempt(p)) return
  const s = event.item
  if (!s || s.isEmpty()) return
  let N = gearLock(p, s)
  const w = WIRELESS_NODE[String(s.id)]
  if (!N && w && !has(p, w)) N = w
  if (!N) return
  warn(p, needText(N))
  event.cancel()
})

// Right-clicking a block: putting a locked part onto it (AE2 parts on cables, Thermal attachments on ducts,
// conduits; they never fire a block placement of their own), or using a locked block (opening it, configuring
// it), whoever placed it. Ordinary locked blocks are checked when placed, so holding one doesn't stop you
// opening a chest.
BlockEvents.rightClicked(event => {
  const p = event.player
  if (!p || exempt(p)) return
  let N = null
  const s = event.item
  if (s && !s.isEmpty()) {
    let partN = PART_NODE[String(s.id)]
    if (partN && !has(p, partN)) N = partN
  }
  if (!N) {
    let useN = USE_NODE[String(event.block.id)]
    if (useN && !has(p, useN)) N = useN
  }
  if (!N) return
  warn(p, needText(N))
  event.cancel()
})

// Fallback for placing: the block itself (also stops deployers and other fake players).
BlockEvents.placed(event => {
  const p = event.player
  if (!p || exempt(p)) return
  const N = PLACE_NODE[String(event.block.id)]
  if (!N || has(p, N)) return
  warn(p, needText(N))
  event.cancel()
})

// Locked armour comes off: into the inventory, or dropped if it's full.
function checkArmor(p) {
  if (exempt(p)) return
  const inv = p.inventory
  for (let i = 36; i < 40; i++) {
    let s = inv.getItem(i)
    let N = gearLock(p, s)
    if (!N) continue
    let copy = s.copy()
    inv.setItem(i, Item.empty)
    p.give(copy)
    warn(p, needText(N) + ': armour taken off')
  }
}
function armorLoop(server, token) {
  if (token != S.token) return
  if (LOCK_ARMOR) onlinePlayers(server).forEach(p => { try { checkArmor(p) } catch (e) { console.error('[PotatoTree] armour: ' + e) } })
  server.scheduleInTicks(ARMOR_CHECK_TICKS, () => armorLoop(server, token))
}
function startLoops(server) {
  if (S.loopStarted == S.token) return
  S.loopStarted = S.token
  const token = S.token
  server.scheduleInTicks(ARMOR_CHECK_TICKS, () => armorLoop(server, token))
}


// ===================== FTB QUESTS AND FTB TEAMS =====================

// Potatoes handed in for a node (the item task tagged potato_offer) count toward the player's rank.
if (typeof FTBQuestsEvents != 'undefined') {
  try {
    FTBQuestsEvents.completed('#potato_offer', event => {
      if (S.forcing) return                       // catch-up and op grants take no potatoes
      let p = null
      try { p = event.player } catch (e) { }
      if (!p) { try { let m = event.onlineMembers; if (m && m.size() > 0) p = m.get(0) } catch (e) { } }
      let n = 0
      try { n = Number(event.object.getMaxProgress()) } catch (e) { }
      const b = BP()
      if (!p || !b || !(n > 0)) return
      try { b.creditStanding(p, n) } catch (e) { console.error('[PotatoTree] rank credit: ' + e) }
    })
  } catch (e) { console.error('[PotatoTree] FTB Quests events unavailable (potatoes won\'t count toward rank): ' + e) }
} else {
  console.warn('[PotatoTree] FTB Quests (with FTB XMod Compat) isn\'t installed: the locks work, the quest book doesn\'t.')
}

// Parties off: every player stays their own FTB Teams team, so quest progress (and unlocks) are personal.
function lockParties() {
  if (!NO_PARTIES) return
  try {
    Java.loadClass('dev.ftb.mods.ftbteams.api.FTBTeamsAPI').api().setPartyCreationFromAPIOnly(true)
  } catch (e) { console.warn('[PotatoTree] Could not switch FTB Teams parties off: ' + e) }
}
lockParties()

// Completes a node for a player: its quest (so the book shows it), and its stage. Nothing is taken or credited.
function grant(server, p, N) {
  S.forcing = true
  try { server.runCommandSilent('ftbquests change_progress ' + nameOf(p) + ' complete ' + questId(N)) } catch (e) { }
  finally { S.forcing = false }
  try { if (!p.stages.has(STAGE_PREFIX + N.id)) p.stages.add(STAGE_PREFIX + N.id) } catch (e) { console.error('[PotatoTree] stage: ' + e) }
}
function revoke(server, p, N) {
  S.forcing = true
  try { server.runCommandSilent('ftbquests change_progress ' + nameOf(p) + ' reset ' + questId(N)) } catch (e) { }
  finally { S.forcing = false }
  try { if (p.stages.has(STAGE_PREFIX + N.id)) p.stages.remove(STAGE_PREFIX + N.id) } catch (e) { }
}

// Catch-up: when the Pool is at Tier T, every node of Tier T-gap and below is granted to everyone online (players
// who were offline are caught up at login). Nodes are granted in list order, so a node's prerequisites come first.
function catchUpPlayer(server, p) {
  const b = BP(), g = gap()
  if (!b || g <= 0) return []
  const T = Number(b.tier()), limit = T - g
  if (limit < 1) return []
  const given = []
  NODES.forEach(N => {
    if (nodeTier(N) > limit || has(p, N)) return
    grant(server, p, N)
    given.push(N.name)
  })
  if (given.length) {
    tell(p, 'The war waits for no one. The Blood Pool reached Tier ' + T + ', so you have been granted: ' + given.join(', ') + '.')
    console.info('[PotatoTree] Catch-up for ' + nameOf(p) + ' (Pool tier ' + T + '): ' + given.join(', '))
  }
  return given
}
function catchUp(server) {
  let total = 0
  onlinePlayers(server).forEach(p => { try { total += catchUpPlayer(server, p).length } catch (e) { console.error('[PotatoTree] catch-up: ' + e) } })
  return total
}

PlayerEvents.loggedIn(event => {
  const p = event.player, server = p.server || Utils.server
  if (!server) return
  server.scheduleInTicks(CATCH_UP_LOGIN_DELAY_TICKS, () => { try { catchUpPlayer(server, p) } catch (e) { console.error('[PotatoTree] catch-up: ' + e) } })
})
ServerEvents.loaded(event => {
  lockParties()
  startLoops(event.server)
  event.server.scheduleInTicks(CATCH_UP_LOGIN_DELAY_TICKS, () => catchUp(event.server))
})
if (Utils.server) {
  startLoops(Utils.server)
  Utils.server.scheduleInTicks(20, () => catchUp(Utils.server))   // after /reload
}

// What a player can do next in the tree: { owned: [names], ready: [names], soon: [{ name, missing: [text] }] }.
// ready = everything but the cost is met; soon = one or two things missing.
function status(p) {
  const b = BP(), out = { owned: [], ready: [], soon: [] }
  // the quests check potato_standing_<n>, which catch-up also gives, so compare with crafting access
  const tier = b ? Number(b.tier()) : 0, rank = b ? Number(b.craftAccess(p)) : 0
  NODES.forEach(N => {
    if (has(p, N)) { out.owned.push(N.name); return }
    const missing = []
    if ((N.rank || 0) > rank) missing.push(b ? b.rankName(N.rank) : 'rank ' + N.rank)
    if ((N.tier || 0) > tier) missing.push('Blood Pool Tier ' + N.tier)
    ;(N.needs || []).forEach(id => { if (NODE[id] && !has(p, NODE[id])) missing.push(NODE[id].name) })
    if (!missing.length) out.ready.push(N.name)
    else if (missing.length <= 2) out.soon.push({ name: N.name, missing: missing })
  })
  return out
}
// The nodes a player can buy now (all requirements but the cost met), by name, for the tier-open messages.
function buyable(p) { return status(p).ready }

function open(p) {
  const server = p.server || Utils.server
  try { server.runCommandSilent('execute as ' + nameOf(p) + ' run ftbquests open_book ' + chapterId('ranks')) } catch (e) { }
}


// ===================== API =====================

global.PotatoTree = {
  open: p => open(p),
  has: (p, id) => !!NODE[id] && has(p, NODE[id]),
  nodes: NODES,
  chapters: CHAPTERS,
  questId: id => NODE[id] ? questId(NODE[id]) : null,
  chapterId: key => CHAPTERS[key] ? chapterId(key) : null,
  idPrefix: ID_PREFIX,
  stagePrefix: STAGE_PREFIX,
  catchUp: server => catchUp(server),
  status: p => status(p),
  buyable: p => buyable(p),
  handlesPlacing: true,                      // part2/blood_pool.js's autocrafter rule steps aside
  placeNode: id => PLACE_NODE[String(id)] ? PLACE_NODE[String(id)].name : null,
}


// ===================== COMMANDS (op) =====================

ServerEvents.commandRegistry(event => {
  const Commands = event.commands
  const Arguments = event.arguments
  const reply = (ctx, text, bad) => {
    ctx.source.sendSystemMessage(comp(text))
    return bad ? 0 : 1
  }
  const safe = fn => ctx => {
    try { return fn(ctx) } catch (e) { console.error('[PotatoTree] ' + e); return reply(ctx, 'Error: ' + e, true) }
  }
  const op = src => src.hasPermission(2)
  const player = () => Commands.argument('player', Arguments.PLAYER.create(event))
  const target = ctx => Arguments.PLAYER.getResult(ctx, 'player')
  const nodeArg = () => Commands.argument('node', StringArg.word())
  const nodeOf = ctx => NODE[String(StringArg.getString(ctx, 'node'))] || null

  event.register(Commands.literal('potatotree').requires(op)
    .then(Commands.literal('check').then(player().executes(safe(ctx => {
      const p = target(ctx)
      const mine = NODES.filter(N => has(p, N)).map(N => N.name)
      return reply(ctx, nameOf(p) + ' has ' + mine.length + ' of ' + NODES.length + ' nodes' + (mine.length ? ': ' + mine.join(', ') : '') + '.')
    }))))
    .then(Commands.literal('grant').then(player().then(nodeArg().executes(safe(ctx => {
      const p = target(ctx), N = nodeOf(ctx)
      if (!N) return reply(ctx, 'No such node. Ids: ' + NODES.map(x => x.id).join(', '), true)
      grant(ctx.source.server, p, N)
      console.info('[PotatoTree] ' + N.id + ' granted to ' + nameOf(p))
      return reply(ctx, N.name + ' granted to ' + nameOf(p) + ' (nothing taken, no potatoes credited).')
    })))))
    .then(Commands.literal('revoke').then(player().then(nodeArg().executes(safe(ctx => {
      const p = target(ctx), N = nodeOf(ctx)
      if (!N) return reply(ctx, 'No such node. Ids: ' + NODES.map(x => x.id).join(', '), true)
      revoke(ctx.source.server, p, N)
      console.info('[PotatoTree] ' + N.id + ' revoked from ' + nameOf(p))
      return reply(ctx, N.name + ' revoked from ' + nameOf(p) + ' (its quest is reset; nothing is given back).')
    })))))
    .then(Commands.literal('catchup').executes(safe(ctx => reply(ctx, 'Catch-up ran: ' + catchUp(ctx.source.server) + ' nodes granted.')))))
})

})()
