// part2/deep_records.js: Deep Record books in structure chests, unlocking by Blood Pool tier; the big reveals only in
// End Cities; chest minecarts; the discovery log of unlisted loot tables; /deeprecords.
// Run with: node tools/tests/run_all.js deep_records   (or node tools/tests/suites/deep_records.test.js)
const fs = require('fs')
const paths = require('../lib/paths')
const snbt = require('../lib/snbt.js')
const src = fs.readFileSync(paths.server('part2/deep_records.js'), 'utf8')
let fails = 0
const ok = (l, c, e) => { console.log((c ? 'ok   ' : 'FAIL ') + l + (!c && e !== undefined ? '  ' + e : '')); if (!c) fails++ }

// ---------- the mock ----------
let tick = 0, queue = []
const persistent = {}, players = [], logs = []
const jlist = arr => ({ size: () => arr.length, get: i => arr[i] })
const server = {
  get players() { return jlist(players) },
  scheduleInTicks: (n, fn) => queue.push([tick + n, fn]),
  persistentData: { getString: k => persistent[k] || '', putString: (k, v) => { persistent[k] = v } },
  runCommandSilent: c => { logs.push('CMD ' + c); return 1 },
}
function advance(n) { for (let i = 0; i < n; i++) { tick++; const due = queue.filter(q => q[0] <= tick); queue = queue.filter(q => q[0] > tick); due.forEach(q => q[1]()) } }
const Item = { of: (id, n, nbt) => ({ id, count: n, nbt, isEmpty: () => false }) }
const EMPTY = { isEmpty: () => true }
// A container (chest block entity or minecart) with a loot table that empties when opened.
function container(table, size, fillTo) {
  const c = { table, slots: [], getContainerSize: () => size, getItem: i => c.slots[i] || EMPTY, setItem: (i, s) => { c.slots[i] = s }, setChanged: () => {} }
  c.open = () => { c.table = ''; for (let i = 0; i < (fillTo || 3); i++) c.slots[i] = { id: 'minecraft:bone', isEmpty: () => false } }
  return c
}
const nbtOf = c => ({ contains: k => k == 'LootTable' && !!c.table, getString: () => c.table })
const blocks = {}
const level = { getBlock: (x, y, z) => blocks[x + ',' + y + ',' + z] }
function chestAt(x, table, size, fillTo) {
  const c = container(table, size || 27, fillTo)
  const b = { x, y: 64, z: 0, id: 'minecraft:chest', level, entity: c, get entityData() { return nbtOf(c) } }
  blocks[x + ',64,0'] = b
  return { b, c }
}
let blockHandler = null, entityHandler = null, cmdTree = null
const BP = { t: 0, tier: () => BP.t }
const global = { BloodPool: BP }
const node = (n) => ({ n, ch: [], req: null, f: null, then(c) { this.ch.push(c); return this }, requires(f) { this.req = f; return this }, executes(f) { this.f = f; return this } })
const StringArg = { word: () => 'word', getString: (ctx, k) => ctx.args[k] }
const Serializer = { fromJsonLenient: j => JSON.parse(j) }
let rand = 0
const MathR = Object.create(Math); MathR.random = () => rand
new Function('BlockEvents', 'ItemEvents', 'ServerEvents', 'Java', 'Utils', 'Item', 'Text', 'console', 'global', 'Math', src)(
  { rightClicked: h => { blockHandler = h } },
  { entityInteracted: h => { entityHandler = h } },
  { commandRegistry: h => h({ commands: { literal: node, argument: (n) => node(n) }, arguments: { INTEGER: { create: () => 'int', getResult: (ctx, k) => ctx.args[k] } }, register: t => { cmdTree = t } }) },
  { loadClass: n => (/StringArgumentType/.test(n) ? StringArg : Serializer) },
  { server }, Item, { of: s => s },
  { info: m => logs.push(m), warn: m => logs.push('WARN ' + m), error: m => logs.push('ERR ' + m) },
  global, MathR)
function openChest(ch) {
  blockHandler({ block: ch.b, server })
  ch.c.open()
  advance(3)
}
const books = c => c.slots.filter(s => s && s.id == 'minecraft:written_book')
const idOf = s => snbt(s.nbt).trollcraft.deeprecord
const text = c => (Array.isArray(c) ? c.map(x => (typeof x == 'string' ? x : x.text)).join('') : String(c))
function run(args, as) {
  const replies = []
  const ctx = { args: {}, source: { server, hasPermission: () => !!(as && as.op), sendSystemMessage: c => replies.push(text(c)) } }
  let n = cmdTree
  if (n.req && !n.req(ctx.source)) return ['DENIED']
  args.forEach(a => {
    let next = n.ch.find(c => c.n == a)
    if (!next) { next = n.ch.find(c => c.n == 'player' || c.n == 'number'); ctx.args[next.n] = next.n == 'number' ? Number(a) : a }
    n = next
  })
  n.f(ctx)
  return replies
}

// ---------- the books ----------
const R = global.DeepRecords.records
ok('nine books (eight that drop, and the Surveyor\'s notes given by command)', R.length == 9 && R[8].id == 'surveyor_notes' && R[8].giveOnly)
ok('every title fits a written book (32 characters)', R.every(r => r.title.length <= 32), R.map(r => r.title.length).join(','))
ok('every page is short enough to show (256 characters)', R.every(r => r.pages.every(p => p.length <= 256)), R.map(r => Math.max.apply(null, r.pages.map(p => p.length))).join(','))
ok('nothing names the Ministry (it is still unrevealed)', R.every(r => !/ministry/i.test(r.title + r.pages.join(' '))))

// ---------- chests ----------
rand = 0   // every roll succeeds, ties pick the first
const a1 = chestAt(1, 'minecraft:chests/ancient_city'); openChest(a1)
ok('an ancient city chest gets a book', books(a1.c).length == 1)
ok('... in the first empty slot, after the loot', a1.c.slots[3] && a1.c.slots[3].id == 'minecraft:written_book')
const nbt1 = snbt(books(a1.c)[0].nbt)
ok('... a signed [REDACTED] book with its Deep Record lore', nbt1.author == '[REDACTED]' && /CLASSIFIED: Deep Record #1/.test(nbt1.display.Lore[0]), JSON.stringify(nbt1.display))
ok('... whose pages are valid text components', nbt1.pages.every(p => typeof JSON.parse(p).text == 'string'))
ok('at Tier 0 only books 1-2 can turn up', idOf(books(a1.c)[0]) == 'site_survey')
const a2 = chestAt(2, 'minecraft:chests/ancient_city_ice_box'); openChest(a2)
ok('the ice box counts too, and the least-found book comes next', books(a2.c).length == 1 && idOf(books(a2.c)[0]) == 'records_security', books(a2.c).map(idOf))
const a3 = chestAt(3, 'minecraft:chests/ancient_city'); openChest(a3)
ok('with both found once, Tier 0 repeats book 1 or 2 (no later book)', ['site_survey', 'records_security'].indexOf(idOf(books(a3.c)[0])) >= 0)
BP.t = 5
const seen = []
for (let i = 0; i < 6; i++) { let ch = chestAt(10 + i, 'minecraft:chests/stronghold_library'); openChest(ch); seen.push(idOf(books(ch.c)[0])) }
ok('at Tier 5 a stronghold gives books 3-5 first (the least found)', seen.slice(0, 3).sort().join(',') == 'blood_god_memo,seal_log,yield', seen.join(','))
ok('... and never the End City books', seen.every(id => ['pump', 'power_budget', 'full_measure'].indexOf(id) < 0))
BP.t = 12
const overworld = []
;['minecraft:chests/buried_treasure', 'minecraft:chests/underwater_ruin_big', 'minecraft:chests/simple_dungeon'].forEach((t, i) => { let ch = chestAt(30 + i, t); openChest(ch); overworld.push(idOf(books(ch.c)[0])) })
ok('even at Tier 12, overworld chests never hold books 6-8', overworld.every(id => ['pump', 'power_budget', 'full_measure'].indexOf(id) < 0), overworld.join(','))
BP.t = 9
const e1 = chestAt(40, 'minecraft:chests/end_city_treasure'); openChest(e1)
ok('an End City chest at Tier 9 gives the pump requisition', idOf(books(e1.c)[0]) == 'pump')
const e2 = chestAt(41, 'minecraft:chests/end_city_treasure'); openChest(e2)
ok('... and nothing later yet (book 7 waits for Tier 10)', idOf(books(e2.c)[0]) == 'pump')
BP.t = 11
const endSeen = []
for (let i = 0; i < 2; i++) { let ch = chestAt(42 + i, 'minecraft:chests/end_city_treasure'); openChest(ch); endSeen.push(idOf(books(ch.c)[0])) }
ok('at Tier 11 the End Cities give the power budget and Full Measure', endSeen.sort().join(',') == 'full_measure,power_budget', endSeen.join(','))

rand = 0.99
const miss = chestAt(50, 'minecraft:chests/ancient_city'); openChest(miss)
ok('a failed roll leaves the chest alone', books(miss.c).length == 0)
rand = 0.12
const mine = chestAt(51, 'minecraft:chests/simple_dungeon'); openChest(mine)
ok('a dungeon\'s chance is 10% (a 12% roll misses)', books(mine.c).length == 0)
const strong = chestAt(52, 'minecraft:chests/stronghold_corridor'); openChest(strong)
ok('... a stronghold\'s is 20% (a 12% roll hits)', books(strong.c).length == 1)
rand = 0
const full = chestAt(53, 'minecraft:chests/ancient_city', 3, 3); openChest(full)
ok('a full chest takes no book, and nothing errors', books(full.c).length == 0 && !logs.some(l => /^ERR/.test(l)))
const shut = chestAt(54, 'minecraft:chests/ancient_city')
blockHandler({ block: shut.b, server }); advance(3)
ok('a chest that didn\'t open (still unlooted) gets nothing', books(shut.c).length == 0 && shut.c.table)

// chest minecarts
const cart = container('minecraft:chests/abandoned_mineshaft', 27)
cart.getNbt = () => nbtOf(cart); cart.getStringUuid = () => 'cart-1'
entityHandler({ target: cart, server }); cart.open(); advance(3)
ok('a mineshaft chest minecart gets a book', books(cart).length == 1)

// discovery log
const odd = chestAt(60, 'betterstrongholds:chests/library'); openChest(odd)
ok('an unlisted loot table gets no book', books(odd.c).length == 0)
ok('... but is logged once and counted', logs.filter(l => /Unlisted loot table betterstrongholds:chests\/library/.test(l)).length == 1 && JSON.parse(persistent.deep_records).tables['betterstrongholds:chests/library'] == 1)
const odd2 = chestAt(61, 'betterstrongholds:chests/library'); openChest(odd2)
ok('... the second one is counted, not logged again', logs.filter(l => /Unlisted loot table/.test(l)).length == 1 && JSON.parse(persistent.deep_records).tables['betterstrongholds:chests/library'] == 2)
ok('found counts are saved', JSON.parse(persistent.deep_records).found.site_survey >= 1)

// ---------- commands ----------
const ana = { op: false }, admin = { op: true }
ok('/deeprecords is op-only', run(['list'], ana)[0] == 'DENIED')
const listing = run(['list'], admin)
ok('/deeprecords list shows the tier, each book and what is unlocked', /Blood Pool tier 11/.test(listing[0]) && /8\. Protocol Full Measure \(tier 11, End Cities\): unlocked/.test(listing.join('\n')) && /9\. Surveyor's Last Field Notes: given by command/.test(listing.join('\n')), listing.join(' | '))
ok('/deeprecords tables lists the unlisted loot tables', /betterstrongholds:chests\/library: 2x/.test(run(['tables'], admin).join('\n')))
const p = { name: 'Ana', got: [], getGameProfile: () => ({ getName: () => 'Ana' }), give: s => p.got.push(s) }
players.push(p)
ok('/deeprecords give Ana all hands out all nine', /all 9 Deep Records/.test(run(['give', 'Ana', 'all'], admin)[0]) && p.got.length == 9)
ok('/deeprecords give Ana 4 hands out the Blood God memo', /Memo: Re: The Blood God/.test(run(['give', 'Ana', '4'], admin)[0]) && p.got.length == 10)
ok('/deeprecords give Ana 9 hands out the Surveyor\'s notes', /Surveyor's Last Field Notes/.test(run(['give', 'Ana', '9'], admin)[0]) && snbt(p.got[10].nbt).trollcraft.deeprecord == 'surveyor_notes' && /Deep Record #9/.test(snbt(p.got[10].nbt).display.Lore[0]))
ok('... and refuses a number out of range', /1 to 9/.test(run(['give', 'Ana', '10'], admin)[0]))

// Twilight Forest chests (BP.t is 11 here: every overworld book is unlocked)
rand = 0.4
const lib = chestAt(80, 'twilightforest:chests/tower_library'); openChest(lib)
ok('a Lich Tower library chest is a key room (50%: a 40% roll hits)', books(lib.c).length == 1)
const room = chestAt(81, 'twilightforest:chests/tower_room'); openChest(room)
ok('an ordinary Lich Tower room is 10% (a 40% roll misses)', books(room.c).length == 0)
rand = 0.25
const vault = chestAt(82, 'twilightforest:chests/troll_vault'); openChest(vault)
ok('a troll vault is 30% (a 25% roll hits)', books(vault.c).length == 1)
rand = 0
const tfSeen = []
;['labyrinth_vault', 'stronghold_boss', 'darktower_boss', 'aurora_cache', 'hill_2', 'hedge_maze', 'well'].forEach((n, i) => {
  let ch = chestAt(90 + i, 'twilightforest:chests/' + n); openChest(ch); tfSeen.push(books(ch.c).length ? idOf(books(ch.c)[0]) : 'none')
})
ok('Twilight chests give books, but never books 6-8', tfSeen.every(id => id != 'none' && ['pump', 'power_budget', 'full_measure'].indexOf(id) < 0), tfSeen.join(','))
const key = chestAt(99, 'twilightforest:chests/darktower_key'); openChest(key)
ok('the Dark Tower key chest is left out (counted as unlisted)', books(key.c).length == 0 && JSON.parse(persistent.deep_records).tables['twilightforest:chests/darktower_key'] == 1)

// Ice and Fire dragon lairs (25%)
rand = 0.2
const lair = chestAt(400, 'iceandfire:chest/fire_dragon_male_cave'); openChest(lair)
ok('a dragon lair cave chest can hold a book (25%: a 20% roll hits)', books(lair.c).length == 1 && ['pump', 'power_budget', 'full_measure'].indexOf(idOf(books(lair.c)[0])) < 0)
const roost = chestAt(401, 'iceandfire:chest/lightning_dragon_roost'); openChest(roost)
ok('... and so can a roost', books(roost.c).length == 1)
rand = 0.3
const lair2 = chestAt(402, 'iceandfire:chest/ice_dragon_female_cave'); openChest(lair2)
ok('... but a 30% roll misses', books(lair2.c).length == 0)
rand = 0

// the Surveyor's notes never drop, whatever the chest
BP.t = 12
rand = 0
const everySite = []
global.DeepRecords.sites.forEach((site, si) => site.tables.forEach((tbl, ti) => {
  for (let k = 0; k < 4; k++) { let ch = chestAt(1000 + si * 100 + ti * 5 + k, tbl); openChest(ch); books(ch.c).forEach(b => everySite.push(idOf(b))) }
}))
ok('the Surveyor\'s notes never drop from any chest, even at Tier 12', everySite.length > 50 && everySite.indexOf('surveyor_notes') < 0, everySite.length)
BP.t = 11

// without the Blood Pool
global.BloodPool = undefined
const solo = []
for (let i = 0; i < 3; i++) { let ch = chestAt(70 + i, 'minecraft:chests/ancient_city'); openChest(ch); solo.push(idOf(books(ch.c)[0])) }
ok('without the Blood Pool only the tier-0 books turn up', solo.every(id => id == 'site_survey' || id == 'records_security'), solo.join(','))
ok('no errors logged', !logs.some(l => /^ERR/.test(l)), logs.filter(l => /^ERR/.test(l)).join('; '))

console.log(fails ? fails + ' FAILED' : 'ALL PASSED')
