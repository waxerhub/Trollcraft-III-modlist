// Part II: a little more loot in the Twilight Forest boss chests (see tools/kubejs/TWILIGHT_BOSSES.md).
//
//  - When a TF boss dies, TF rolls its loot table into a chest at the arena. This script adds two pools to each of
//    those tables. TF's own pools (trophies, scales, scepters, fiery blood, carminite, fur...) are kept as they are.
//      * potato crates for the Potato War (9 potatoes each: /potatowar offer for Standing, /bloodpool tithe for the Pool);
//      * a few rolls of spoils, more and better the harder the boss (BOSSES is ranked easiest first).
//  - Which table: the Knight Phantoms' chest is a chest loot table (twilightforest:chests/stronghold_boss); the other
//    seven are entity loot tables (twilightforest:entities/<boss>). TF's chests/darktower_boss is never used in game.
//  - Never add a boss's progression item to the spoils (KEY_ITEMS): TF's advancements count holding a trophy, a
//    Naga scale, a Lich scepter or Alpha Yeti fur as beating that boss, which would open the next area early.
//  - If a table isn't found, it's left alone and an error is logged (adding to a missing table would replace TF's).
//    An item id that doesn't exist is skipped and logged too (one bad id would empty the whole table).
//
// Copy to <server>/kubejs/server_scripts/part2/ and run /reload (loot tables reload with it).
// Part II only: Twilight Forest is a Part II mod. Needs nothing else (the crates are Farmer's Delight's).
// KubeJS 6 notes: no template strings; `let` inside nested blocks; closures in loops use forEach.

(function () {

// ===================== SETTINGS =====================

const CRATE = 'farmersdelight:potato_crate'   // worth 9 potatoes (POTATO_WORTH in part2/blood_pool.js)

// The bosses, easiest first. table: 'entity' (twilightforest:entities/<id path>) or 'chest' (twilightforest:chests/...).
//   crates: [min, max] potato crates, always. rolls: how many spoils are drawn (each draw can repeat an entry).
//   spoils: { item, count: [min, max], weight } or { book: [min, max] enchanting levels, treasure, weight }.
const BOSSES = [
  { rank: 1, name: 'Naga', table: 'entity', id: 'twilightforest:naga', crates: [8, 16], rolls: 2, spoils: [
    { item: 'minecraft:emerald', count: [3, 6], weight: 20 },
    { item: 'minecraft:gold_ingot', count: [4, 8], weight: 20 },
    { item: 'minecraft:experience_bottle', count: [4, 8], weight: 20 },
    { item: 'minecraft:golden_apple', count: [1, 2], weight: 15 },
    { item: 'minecraft:diamond', count: [1, 2], weight: 10 },
    { item: 'twilightforest:charm_of_life_1', count: [1, 1], weight: 5 }] },
  // Ranks 2-4 are from play on the server: the Lich is harder than the Minoshroom and the Alpha Yeti.
  { rank: 2, name: 'Minoshroom', table: 'entity', id: 'twilightforest:minoshroom', crates: [12, 24], rolls: 2, spoils: [
    { item: 'minecraft:emerald', count: [4, 8], weight: 20 },
    { item: 'minecraft:experience_bottle', count: [8, 12], weight: 20 },
    { item: 'minecraft:golden_apple', count: [1, 2], weight: 15 },
    { item: 'minecraft:diamond', count: [1, 3], weight: 15 },
    { book: [15, 25], weight: 15 },
    { item: 'twilightforest:charm_of_life_1', count: [1, 1], weight: 10 }] },
  { rank: 3, name: 'Alpha Yeti', table: 'entity', id: 'twilightforest:alpha_yeti', crates: [16, 32], rolls: 2, spoils: [
    { item: 'minecraft:experience_bottle', count: [8, 16], weight: 20 },
    { item: 'minecraft:diamond', count: [2, 3], weight: 20 },
    { item: 'minecraft:emerald', count: [4, 8], weight: 15 },
    { item: 'minecraft:golden_apple', count: [2, 3], weight: 15 },
    { book: [20, 30], weight: 15 },
    { item: 'twilightforest:charm_of_keeping_1', count: [1, 1], weight: 10 },
    { item: 'twilightforest:charm_of_life_1', count: [1, 1], weight: 5 }] },
  { rank: 4, name: 'Lich', table: 'entity', id: 'twilightforest:lich', crates: [20, 40], rolls: 3, spoils: [
    { item: 'minecraft:lapis_lazuli', count: [8, 16], weight: 20 },
    { item: 'minecraft:experience_bottle', count: [12, 16], weight: 20 },
    { book: [20, 30], weight: 20 },
    { item: 'minecraft:emerald', count: [6, 10], weight: 15 },
    { item: 'minecraft:diamond', count: [2, 4], weight: 15 },
    { item: 'twilightforest:charm_of_keeping_1', count: [1, 1], weight: 10 }] },
  { rank: 5, name: 'Knight Phantoms', table: 'chest', id: 'twilightforest:stronghold_boss', crates: [24, 48], rolls: 3, spoils: [
    { item: 'minecraft:diamond', count: [3, 5], weight: 20 },
    { item: 'minecraft:experience_bottle', count: [16, 24], weight: 20 },
    { book: [25, 30], weight: 20 },
    { item: 'minecraft:emerald_block', count: [1, 2], weight: 15 },
    { item: 'minecraft:golden_apple', count: [3, 5], weight: 15 },
    { item: 'twilightforest:charm_of_life_1', count: [1, 1], weight: 5 },
    { item: 'twilightforest:charm_of_keeping_2', count: [1, 1], weight: 5 }] },
  { rank: 6, name: 'Hydra', table: 'entity', id: 'twilightforest:hydra', crates: [32, 48], rolls: 3, spoils: [
    { item: 'minecraft:diamond', count: [4, 6], weight: 20 },
    { item: 'minecraft:experience_bottle', count: [24, 32], weight: 20 },
    { book: [30, 30], treasure: true, weight: 20 },
    { item: 'minecraft:emerald_block', count: [1, 3], weight: 15 },
    { item: 'minecraft:golden_apple', count: [4, 6], weight: 10 },
    { item: 'twilightforest:charm_of_life_2', count: [1, 1], weight: 5 },
    { item: 'twilightforest:charm_of_keeping_2', count: [1, 1], weight: 5 },
    { item: 'minecraft:enchanted_golden_apple', count: [1, 1], weight: 3 }] },
  { rank: 7, name: 'Ur-Ghast', table: 'entity', id: 'twilightforest:ur_ghast', crates: [40, 56], rolls: 4, spoils: [
    { item: 'minecraft:diamond', count: [4, 8], weight: 20 },
    { item: 'minecraft:experience_bottle', count: [32, 32], weight: 20 },
    { book: [30, 30], treasure: true, weight: 20 },
    { item: 'minecraft:emerald_block', count: [2, 3], weight: 15 },
    { item: 'minecraft:golden_apple', count: [4, 8], weight: 10 },
    { item: 'twilightforest:charm_of_life_2', count: [1, 1], weight: 5 },
    { item: 'twilightforest:charm_of_keeping_2', count: [1, 1], weight: 5 },
    { item: 'minecraft:enchanted_golden_apple', count: [1, 1], weight: 5 }] },
  { rank: 8, name: 'Snow Queen', table: 'entity', id: 'twilightforest:snow_queen', crates: [48, 64], rolls: 4, spoils: [
    { item: 'minecraft:experience_bottle', count: [32, 48], weight: 20 },
    { book: [30, 30], treasure: true, weight: 20 },
    { item: 'minecraft:diamond_block', count: [1, 2], weight: 15 },
    { item: 'minecraft:emerald_block', count: [2, 4], weight: 15 },
    { item: 'twilightforest:charm_of_life_2', count: [1, 1], weight: 10 },
    { item: 'minecraft:enchanted_golden_apple', count: [1, 1], weight: 8 },
    { item: 'minecraft:totem_of_undying', count: [1, 1], weight: 7 },
    { item: 'twilightforest:charm_of_keeping_2', count: [1, 1], weight: 5 }] },
]

// TF progression items: holding one counts as beating its boss (see the file header). Never added as spoils.
const KEY_ITEMS = ['twilightforest:naga_trophy', 'twilightforest:lich_trophy', 'twilightforest:minoshroom_trophy',
  'twilightforest:hydra_trophy', 'twilightforest:knight_phantom_trophy', 'twilightforest:ur_ghast_trophy',
  'twilightforest:alpha_yeti_trophy', 'twilightforest:snow_queen_trophy', 'twilightforest:quest_ram_trophy',
  'twilightforest:naga_scale', 'twilightforest:twilight_scepter', 'twilightforest:lifedrain_scepter',
  'twilightforest:zombie_scepter', 'twilightforest:fortification_scepter', 'twilightforest:alpha_yeti_fur',
  'twilightforest:meef_stroganoff', 'twilightforest:lamp_of_cinders']

// ===================== END OF SETTINGS =====================

function itemExists(id) {
  try { return Item.exists(id) } catch (e) { return true }   // can't check: let Minecraft's loader judge it
}

function uniform(range) { return { type: 'minecraft:uniform', min: range[0], max: range[1] } }

// One spoils entry as loot table JSON, or null (logged) if it must not or cannot be added.
function spoilJson(boss, s) {
  if (s.book) {
    return { type: 'minecraft:item', name: 'minecraft:book', weight: s.weight,
      functions: [{ function: 'minecraft:enchant_with_levels', levels: uniform(s.book), treasure: !!s.treasure }] }
  }
  if (KEY_ITEMS.indexOf(s.item) >= 0) {
    console.error('[TwilightBosses] ' + boss.name + ': ' + s.item + ' is a TF progression item; not added')
    return null
  }
  if (!itemExists(s.item)) {
    console.error('[TwilightBosses] ' + boss.name + ': no item ' + s.item + '; not added')
    return null
  }
  const j = { type: 'minecraft:item', name: s.item, weight: s.weight }
  if (s.count[0] != 1 || s.count[1] != 1) j.functions = [{ function: 'minecraft:set_count', count: uniform(s.count) }]
  return j
}

// Adds the boss's two pools to its table. TF's pools are already in table.pools; if there are none, the table wasn't
// found, so throwing here stops KubeJS writing a table made only of ours.
function addPools(boss, table) {
  if (!table.pools || table.pools.size() == 0) throw new Error('loot table not found')
  if (itemExists(CRATE)) {
    table.addPool(pool => {
      pool.setUniformRolls(1, 1)
      pool.addEntry({ type: 'minecraft:item', name: CRATE,
        functions: [{ function: 'minecraft:set_count', count: uniform(boss.crates) }] })
    })
  } else {
    console.error('[TwilightBosses] no item ' + CRATE + '; no potato crates added')
  }
  const entries = []
  boss.spoils.forEach(s => { const j = spoilJson(boss, s); if (j) entries.push(j) })
  if (!entries.length) return
  table.addPool(pool => {
    pool.setUniformRolls(boss.rolls, boss.rolls)
    entries.forEach(j => pool.addEntry(j))
  })
}

function modifyAll(event, kind) {
  BOSSES.filter(b => b.table == kind).forEach(boss => {
    try {
      event.modify(boss.id, table => addPools(boss, table))
      console.info('[TwilightBosses] ' + boss.name + ': added potato crates and ' + boss.rolls + ' spoils')
    } catch (e) {
      console.error('[TwilightBosses] ' + boss.name + ' (' + boss.id + '): ' + e + '; left as TF made it')
    }
  })
}

ServerEvents.entityLootTables(event => modifyAll(event, 'entity'))
ServerEvents.chestLootTables(event => modifyAll(event, 'chest'))

global.TwilightBosses = { BOSSES: BOSSES, KEY_ITEMS: KEY_ITEMS }

})()
