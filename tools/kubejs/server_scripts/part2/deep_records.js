// Part II: the Deep Records. Written books in structure chests that, read in order, reveal the Ministry's real
// objective in the new world: the Harvest. (The seals are a pump, not a prison. Everything poured into the Blood
// Pool to break them is meant to be drained at the twelfth seal to power the Citadel's Bureaucratic Barrier.)
// The Ministry is still unrevealed in Part II: the books are signed [REDACTED] and never name it.
//
// - Each book waits for a Blood Pool tier, so the reveal follows the season.
// - Books 1-5 turn up across the overworld (ancient cities most often); the biggest plot points, books 6-8, only in
//   End City chests (the End opens at Tier 9).
// - The least-found unlocked book comes first, so every book turns up before any repeats.
// - Unlooted containers with loot tables not listed here are counted (/deeprecords tables), so modded structures'
//   chests can be added to SITES later.
// Copy to <server>/kubejs/server_scripts/part2/ and run /reload. See tools/kubejs/DEEP_RECORDS.md.
// KubeJS 6 (Rhino): no template strings; `let` inside nested blocks.

(function () {

// ===================== SETTINGS =====================

const AUTHOR = '[REDACTED]'
const LORE = 'CLASSIFIED: Deep Record #'
const DISCOVERY_LOG = true          // count (and log once) unlooted containers whose loot table isn't in SITES
const DATA_KEY = 'deep_records'

// The books. minTier: the Blood Pool tier before it can turn up. Titles within 32 characters, pages within ~250.
const RECORDS = [
  { id: 'site_survey', minTier: 0, title: 'Site Survey: New Holding', pages: [
    'SITE SURVEY\nHolding: NEW\nFiled by: [REDACTED]\n\nTerrain: fertile.\nWater: plentiful.\nOre: adequate.\nSuitability for cultivation: EXCELLENT.',
    'Crop to be cultivated: ____________\n\n(Do not fill in this line. Do not discuss this line. The Office knows what is grown here.)',
    'Arrivals: on schedule, through the red door. All of them came. They always come.\n\nRecommendation: let them settle. Settled things grow.',
  ] },
  { id: 'records_security', minTier: 0, title: 'Records Security Transfer', pages: [
    'NOTICE OF TRANSFER\n\nPost: Head of Records Security\nPrevious holder: the Dragon (deceased, regrettably)\nNew holder: the Warden',
    'The Warden cannot see. It does not need to. Its hearing is excellent, and it does not take bribes, because nobody has ever lived long enough to offer one.',
    'The old records are kept below, in the deep cities, where no one digs.\n\nIf anyone digs, the Warden will hear them. That is the point.',
  ] },
  { id: 'seal_log', minTier: 1, title: 'Seal Maintenance Log', pages: [
    'SEAL MAINTENANCE LOG\n\nSeal 1: holding. Pressure building as intended.\nSeal 2: holding. Subjects frustrated. Good.\nSeal 3: holding. Subjects bleeding for it. Very good.',
    'REMINDER TO ALL STAFF: do NOT reinforce the seals.\n\nThe seals are not there to keep anything in. They are there to be broken, slowly, at the right price.',
    'Every seal they break, they will call a victory. Let them.\n\nLog each one as a payment.',
  ] },
  { id: 'blood_god_memo', minTier: 3, title: 'Memo: Re: The Blood God', pages: [
    'MEMORANDUM\nTo: the Office of Morale\nRe: the so-called Blood God\n\nQuestion raised: should the cult be suppressed?',
    'Answer: absolutely not. Let them believe it is listening. A god makes them generous. Faith fills faster than force.',
    'Whether anything is actually listening is not the Office\'s concern.\n\nThe Office is concerned only with where the blood goes.',
  ] },
  { id: 'yield', minTier: 5, title: 'Yield Projections, Q3', pages: [
    'YIELD PROJECTIONS (Q3)\n\nTrolls: steady. They cannot stop themselves.\nCoins: modest. They hoard.\nPotatoes: EXCELLENT.',
    'Recommendation: encourage the potatoes. Praise the potato. Hold a festival for the potato if necessary.\n\nThey think the tithe is worship. It is a quota.',
    'Projected date of full yield: the breaking of the twelfth seal.\n\nThe Office reminds all staff that "full" is the important word.',
  ] },
  { id: 'pump', minTier: 9, title: 'Requisition: Pumping Station', pages: [
    'REQUISITION FORM 12-B\n\nItem: one (1) pump, industrial, blood-rated.\nQuantity: one. It only needs to work once.\nLocation: beneath the basin.',
    'Installation notes: run the pipes deep, under the bedrock if you must.\n\nDo not let them see the pipes.',
    'Do not let them see the meter.\n\nDo NOT let them ask why a pool needs a drain.',
  ] },
  { id: 'power_budget', minTier: 10, title: 'Citadel Power Budget', pages: [
    'CITADEL POWER BUDGET\n\nThe Bureaucratic Barrier draws more than any reactor in either world.\nGenerators: insufficient.\nReactors: insufficient.\nVolunteers: insufficient.',
    'Approved source: one (1) full Blood Pool.\n\nEstimated runtime: one century of uninterrupted governance.',
    'Cost to the Office: nothing. They are filling it for free.\n\nThey are filling it for us.',
  ] },
  { id: 'full_measure', minTier: 11, title: 'Protocol Full Measure', pages: [
    'PROTOCOL FULL MEASURE\nStandard Operating Procedure\n\nPurpose: collection of the yield.',
    'Step 1: wait for the twelfth seal to break.\nStep 2: open the drain.\nStep 3: thank them for their cooperation.',
    'Step 4: raise the Barrier. The Citadel will be untouchable. Forever, give or take a century.\n\nIn the margin, in red: They will think they won.',
  ] },
  // Never drops: the admins give it (/deeprecords give <player> 9) and place it, e.g. in a dragon lair.
  // It points players to the plot and to where the other books are found.
  { id: 'surveyor_notes', minTier: 0, giveOnly: true, title: 'Surveyor\'s Last Field Notes', pages: [
    'FIELD NOTES\nSurveyor 7, the Office\n\nDay 41. The dragon has not noticed me yet. I am writing this in case it does.\n\nIf you are reading this, it did.',
    'The Office sent me to count what the new world can yield. I counted.\n\nThen I read the orders I was carrying. I should not have read them.',
    'The seals are not locks. Every seal you break, you pay for in blood, and the blood is not going where you think.\n\nAsk why a pool would need a drain.',
    'The Office keeps its papers where no one wanders: the deep cities, where the Warden listens; the old strongholds; chests buried in sand and under the sea; the mines and the dungeons.',
    'And in the Twilight: the Lich\'s library above all, and the vaults the great beasts guard.\n\nRead them in order. Each seal you break opens another drawer.',
    'The last orders are kept beyond the End\'s gate, in the cities that float. Read those before the twelfth seal breaks. After that, it will not matter.\n\n(The rest of the page is scorched.)',
  ] },
]
const OVERWORLD_BOOKS = ['site_survey', 'records_security', 'seal_log', 'blood_god_memo', 'yield']
const END_BOOKS = ['pump', 'power_budget', 'full_measure']

// Where the books turn up: loot tables, the chance per unlooted chest, and which books.
const SITES = [
  { name: 'ancient city', chance: 0.5, books: OVERWORLD_BOOKS,
    tables: ['minecraft:chests/ancient_city', 'minecraft:chests/ancient_city_ice_box'] },
  { name: 'stronghold', chance: 0.2, books: OVERWORLD_BOOKS,
    tables: ['minecraft:chests/stronghold_library', 'minecraft:chests/stronghold_corridor', 'minecraft:chests/stronghold_crossing'] },
  { name: 'buried or ruined site', chance: 0.15, books: OVERWORLD_BOOKS,
    tables: ['minecraft:chests/buried_treasure', 'minecraft:chests/underwater_ruin_small', 'minecraft:chests/underwater_ruin_big'] },
  { name: 'mineshaft or dungeon', chance: 0.1, books: OVERWORLD_BOOKS,
    tables: ['minecraft:chests/abandoned_mineshaft', 'minecraft:chests/simple_dungeon'] },
  { name: 'End City', chance: 0.5, books: END_BOOKS,
    tables: ['minecraft:chests/end_city_treasure'] },
  // Twilight Forest (loot tables from twilightforest-1.20.1-4.3.2508). Left out: darktower_key (the key chest),
  // quest_grove_dropper (a dropper) and useless (empty filler).
  { name: 'Twilight Forest key room', chance: 0.5, books: OVERWORLD_BOOKS,
    tables: tf(['tower_library', 'labyrinth_vault', 'labyrinth_vault_jackpot', 'stronghold_boss', 'darktower_boss', 'aurora_cache']) },
  { name: 'Twilight Forest troll cave', chance: 0.3, books: OVERWORLD_BOOKS,
    tables: tf(['troll_vault', 'troll_vault_with_lamp', 'troll_garden']) },
  { name: 'Twilight Forest', chance: 0.1, books: OVERWORLD_BOOKS,
    tables: tf(['tower_room', 'labyrinth_room', 'labyrinth_dead_end', 'stronghold_room', 'stronghold_cache', 'darktower_cache',
      'aurora_room', 'hill_1', 'hill_2', 'hill_3', 'hedge_maze', 'tree_cache', 'basement', 'foundation_basement', 'graveyard',
      'fancy_well', 'well']) },
]
function tf(names) { return names.map(n => 'twilightforest:chests/' + n) }

// ===================== STATE =====================

let Serializer = null, StringArg = null
try { Serializer = Java.loadClass('net.minecraft.network.chat.Component$Serializer') } catch (e) { }
try { StringArg = Java.loadClass('com.mojang.brigadier.arguments.StringArgumentType') } catch (e) { }
const pending = {}
let data = null

function db() {
  if (data) return data
  data = { found: {}, chests: {}, tables: {} }
  let raw = ''
  try { raw = String(Utils.server.persistentData.getString(DATA_KEY) || '') } catch (e) { }
  if (raw) {
    try {
      let d = JSON.parse(raw)
      if (d && d.found && d.chests && d.tables) data = d
    } catch (e) {
      console.error('[DeepRecords] Saved data could not be read; a copy is kept')
      try { Utils.server.persistentData.putString(DATA_KEY + '_unreadable_' + Date.now(), raw) } catch (e2) { }
    }
  }
  return data
}
function save() {
  try { Utils.server.persistentData.putString(DATA_KEY, JSON.stringify(db())) } catch (e) { console.error('[DeepRecords] Save failed: ' + e) }
}

// ===================== HELPERS =====================

function snbtString(s) { return "'" + String(s).replace(/\\/g, '\\\\').replace(/'/g, "\\'") + "'" }
function comp(parts) {
  const json = JSON.stringify([''].concat(parts))
  if (Serializer) { try { return Serializer.fromJsonLenient(json) } catch (e) { } }
  return Text.of(parts.map(p => (typeof p == 'string' ? p : p.text || '')).join(''))
}
function nameOf(p) { return String(p.getGameProfile().getName()) }
function playerByName(server, name) {
  const list = server.players
  for (let i = 0; i < list.size(); i++) {
    let p = list.get(i)
    if (nameOf(p).toLowerCase() == String(name).toLowerCase()) return p
  }
  return null
}
function recordDef(id) { return RECORDS.filter(r => r.id == id)[0] || null }
function number(r) { return RECORDS.indexOf(r) + 1 }
function currentTier() {
  const BP = global.BloodPool
  try { return BP ? Number(BP.tier()) || 0 : 0 } catch (e) { return 0 }
}
function siteFor(table) { return SITES.filter(s => s.tables.indexOf(table) >= 0)[0] || null }

function bookSnbt(r) {
  const pages = r.pages.map(t => snbtString(JSON.stringify({ text: String(t) })))
  return '{title:' + snbtString(r.title) + ',author:' + snbtString(AUTHOR) + ',generation:0,resolved:1b,pages:[' + pages.join(',') + ']' +
    ',display:{Lore:[' + snbtString(JSON.stringify({ text: LORE + number(r), color: 'dark_red', italic: false })) + ']},trollcraft:{deeprecord:"' + r.id + '"}}'
}
function bookItem(r) { return Item.of('minecraft:written_book', 1, bookSnbt(r)) }

// The least-found unlocked book of this site (ties at random), or null if none is unlocked yet.
function pickBook(site) {
  const tier = currentTier(), found = db().found
  const open = site.books.map(recordDef).filter(r => r && r.minTier <= tier)
  if (!open.length) return null
  let min = Infinity
  open.forEach(r => { min = Math.min(min, found[r.id] || 0) })
  const pool = open.filter(r => (found[r.id] || 0) == min)
  return pool[Math.floor(Math.random() * pool.length)]
}

// A container's loot table while it's still unlooted ('' once its loot has been made).
function blockLootTable(block) {
  try {
    let nbt = block.entityData
    if (nbt != null && nbt.contains('LootTable')) return String(nbt.getString('LootTable'))
  } catch (e) { }
  return ''
}
function entityLootTable(entity) {
  let nbt = null
  try { nbt = entity.getNbt() } catch (e) { }
  if (nbt == null) { try { nbt = entity.nbt } catch (e) { } }
  try { if (nbt != null && nbt.contains('LootTable')) return String(nbt.getString('LootTable')) } catch (e) { }
  return ''
}
// Puts the book in the container's first empty slot (a chest's block entity, or a chest minecart).
function putIn(container, r) {
  try {
    let size = container.getContainerSize()
    for (let i = 0; i < size; i++) {
      if (container.getItem(i).isEmpty()) {
        container.setItem(i, bookItem(r))
        try { container.setChanged() } catch (e) { }
        return true
      }
    }
  } catch (e) { console.warn('[DeepRecords] Could not fill a container: ' + e) }
  return false
}

function discovered(table, what) {
  if (!DISCOVERY_LOG) return
  const D = db()
  if (!D.tables[table]) console.info('[DeepRecords] Unlisted loot table ' + table + ' (' + what + '). Add it to SITES to let books appear there.')
  D.tables[table] = (D.tables[table] || 0) + 1
  save()
}

// After the container has made its loot: roll, then place a book.
function roll(site, container, where) {
  const D = db()
  D.chests[site.name] = (D.chests[site.name] || 0) + 1
  if (Math.random() < site.chance) {
    let r = pickBook(site)
    if (r && putIn(container, r)) {
      D.found[r.id] = (D.found[r.id] || 0) + 1
      console.info('[DeepRecords] "' + r.title + '" placed in a ' + site.name + ' chest at ' + where)
    }
  }
  save()
}

// ===================== CHESTS =====================
// The loot is made when the container is first opened, so it's noted on the right-click (while it still has its
// LootTable) and topped up a couple of ticks later, once it's open.

BlockEvents.rightClicked(event => {
  const b = event.block
  const table = blockLootTable(b)
  if (!table) return
  const x = Number(b.x), y = Number(b.y), z = Number(b.z)
  const site = siteFor(table)
  if (!site) { discovered(table, String(b.id)); return }
  const key = 'b|' + x + '|' + y + '|' + z
  if (pending[key]) return
  pending[key] = true
  const level = b.level
  event.server.scheduleInTicks(2, () => {
    delete pending[key]
    try {
      let block = level.getBlock(x, y, z)
      if (blockLootTable(block)) return                     // it didn't open (protected, cancelled)
      roll(site, block.entity, x + ' ' + y + ' ' + z)
    } catch (e) { console.error('[DeepRecords] Chest: ' + e) }
  })
})

// Chest minecarts (mineshafts) are entities, not blocks.
ItemEvents.entityInteracted(event => {
  const t = event.target
  const table = entityLootTable(t)
  if (!table) return
  const site = siteFor(table)
  if (!site) { discovered(table, 'minecart'); return }
  let key = 'e|'
  try { key += String(t.getStringUuid()) } catch (e) { key += String(t.getStringUUID()) }
  if (pending[key]) return
  pending[key] = true
  event.server.scheduleInTicks(2, () => {
    delete pending[key]
    try {
      if (entityLootTable(t)) return                         // it didn't open
      roll(site, t, 'a minecart')
    } catch (e) { console.error('[DeepRecords] Minecart: ' + e) }
  })
})

// ===================== COMMANDS =====================

ServerEvents.commandRegistry(event => {
  const Commands = event.commands
  const Arguments = event.arguments
  const reply = (ctx, text, bad) => { ctx.source.sendSystemMessage(comp([{ text: '[Deep Records] ', color: 'dark_red' }, { text: text, color: bad ? 'red' : 'gray' }])); return bad ? 0 : 1 }
  const safe = fn => ctx => { try { return fn(ctx) } catch (e) { console.error('[DeepRecords] ' + e); return reply(ctx, 'Error: ' + e, true) } }
  const op = src => src.hasPermission(2)
  const str = (ctx, name) => String(StringArg.getString(ctx, name))
  const give = (ctx, n) => {
    const p = playerByName(ctx.source.server, str(ctx, 'player'))
    if (!p) return reply(ctx, 'Nobody called ' + str(ctx, 'player') + ' is online.', true)
    const list = n == null ? RECORDS : [RECORDS[n - 1]]
    if (!list[0]) return reply(ctx, 'Deep Records are 1 to ' + RECORDS.length + '.', true)
    list.forEach(r => { try { p.give(bookItem(r)) } catch (e) { ctx.source.server.runCommandSilent('give ' + nameOf(p) + ' minecraft:written_book' + bookSnbt(r)) } })
    return reply(ctx, 'Gave ' + nameOf(p) + ' ' + (n == null ? 'all ' + RECORDS.length + ' Deep Records' : '"' + list[0].title + '"') + '.')
  }
  event.register(Commands.literal('deeprecords').requires(op)
    .then(Commands.literal('list').executes(safe(ctx => {
      const D = db(), tier = currentTier()
      reply(ctx, 'Blood Pool tier ' + tier + '. Chests rolled: ' + (Object.keys(D.chests).map(k => k + ' ' + D.chests[k]).join(', ') || 'none') + '.')
      RECORDS.forEach(r => reply(ctx, number(r) + '. ' + r.title + (r.giveOnly ? ': given by command (/deeprecords give <player> ' + number(r) + ')' :
        ' (tier ' + r.minTier + ', ' + (END_BOOKS.indexOf(r.id) >= 0 ? 'End Cities' : 'overworld and Twilight Forest') + '): ' +
        (r.minTier <= tier ? 'unlocked' : 'sealed') + ', found ' + (D.found[r.id] || 0) + 'x')))
      return 1
    })))
    .then(Commands.literal('tables').executes(safe(ctx => {
      const T = db().tables, keys = Object.keys(T).sort((a, b) => T[b] - T[a])
      if (!keys.length) return reply(ctx, 'No unlisted loot tables seen yet.')
      reply(ctx, 'Unlooted containers opened with loot tables not in SITES:')
      keys.forEach(k => reply(ctx, k + ': ' + T[k] + 'x'))
      return 1
    })))
    .then(Commands.literal('give').then(Commands.argument('player', StringArg.word())
      .then(Commands.literal('all').executes(safe(ctx => give(ctx, null))))
      .then(Commands.argument('number', Arguments.INTEGER.create(event)).executes(safe(ctx => give(ctx, Number(Arguments.INTEGER.getResult(ctx, 'number')))))))))
})

global.DeepRecords = {
  records: RECORDS,
  sites: SITES,
  found: () => JSON.parse(JSON.stringify(db().found)),
}

})()
