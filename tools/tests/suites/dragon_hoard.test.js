// part2/dragon_hoard.js: Ice and Fire dragon lair chests get a hoard of bonus stacks when first opened.
// Run with: node tools/tests/run_all.js dragon_hoard   (or node tools/tests/suites/dragon_hoard.test.js)
const fs = require('fs')
const paths = require('../lib/paths')
const src = fs.readFileSync(paths.server('part2/dragon_hoard.js'), 'utf8')
let fails = 0
const ok = (l, c, e) => { console.log((c ? 'ok   ' : 'FAIL ') + l + (!c && e !== undefined ? '  ' + e : '')); if (!c) fails++ }

// ---------- the mock ----------
let tick = 0, queue = []
const persistent = {}, logs = []
const server = {
  scheduleInTicks: (n, fn) => queue.push([tick + n, fn]),
  persistentData: { getString: k => persistent[k] || '', putString: (k, v) => { persistent[k] = v } },
}
function advance(n) { for (let i = 0; i < n; i++) { tick++; const due = queue.filter(q => q[0] <= tick); queue = queue.filter(q => q[0] > tick); due.forEach(q => q[1]()) } }
const Item = { of: (id, n) => ({ id, count: n, isEmpty: () => false }) }
const EMPTY = { isEmpty: () => true }
const blocks = {}
const level = { getBlock: (x, y, z) => blocks[x + ',' + y + ',' + z] }
function chestAt(x, table, size, fillTo) {
  const c = { table, slots: [], getContainerSize: () => size || 27, getItem: i => c.slots[i] || EMPTY, setItem: (i, s) => { c.slots[i] = s }, setChanged: () => {} }
  c.open = () => { c.table = ''; for (let i = 0; i < (fillTo == null ? 4 : fillTo); i++) c.slots[i] = { id: 'minecraft:bone', isEmpty: () => false } }
  const b = { x, y: 40, z: 0, id: 'minecraft:chest', level, entity: c, get entityData() { return { contains: k => k == 'LootTable' && !!c.table, getString: () => c.table } } }
  blocks[x + ',40,0'] = b
  return { b, c }
}
let handler = null
let lockedIds = []
const global = { BloodPool: { isLocked: id => lockedIds.some(l => (l.endsWith(':') ? id.startsWith(l) : id == l)) } }
new Function('BlockEvents', 'Item', 'Utils', 'console', 'global', src)(
  { rightClicked: h => { handler = h } }, Item, { server },
  { info: m => logs.push(m), warn: m => logs.push('WARN ' + m), error: m => logs.push('ERR ' + m) }, global)
function open(ch) { handler({ block: ch.b, server }); ch.c.open(); advance(3) }
const bonus = c => c.slots.filter(s => s && s.id != 'minecraft:bone')

// ---------- checks ----------
const H = global.DragonHoard
ok('nine lair loot tables (fire, ice and lightning: two caves and a roost each)', Object.keys(H.lairs).length == 9)

let caveCounts = [], roostCounts = [], allIds = {}
for (let i = 0; i < 300; i++) {
  let cave = chestAt(i, 'iceandfire:chest/fire_dragon_female_cave'); open(cave)
  caveCounts.push(bonus(cave.c).length); bonus(cave.c).forEach(s => { allIds[s.id] = true })
  let roost = chestAt(1000 + i, 'iceandfire:chest/ice_dragon_roost'); open(roost)
  roostCounts.push(bonus(roost.c).length); bonus(roost.c).forEach(s => { allIds[s.id] = true })
}
ok('a cave chest gets 3-5 bonus stacks', Math.min.apply(null, caveCounts) == 3 && Math.max.apply(null, caveCounts) == 5, [Math.min.apply(null, caveCounts), Math.max.apply(null, caveCounts)])
ok('a roost chest gets 1-3', Math.min.apply(null, roostCounts) == 1 && Math.max.apply(null, roostCounts) == 3, [Math.min.apply(null, roostCounts), Math.max.apply(null, roostCounts)])
ok('the bonus goes into empty slots after the chest\'s own loot', (() => { const ch = chestAt(5000, 'iceandfire:chest/fire_dragon_male_cave'); open(ch); return ch.c.slots.slice(0, 4).every(s => s.id == 'minecraft:bone') && ch.c.slots[4] && ch.c.slots[4].id != 'minecraft:bone' })())
const ids = Object.keys(allIds)
let fireScales = {}, iceScales = {}
for (let i = 0; i < 300; i++) {
  let f = chestAt(6000 + i, 'iceandfire:chest/fire_dragon_male_cave'); open(f); bonus(f.c).forEach(s => { if (/dragonscales_|blood/.test(s.id)) fireScales[s.id] = true })
  let l = chestAt(7000 + i, 'iceandfire:chest/lightning_dragon_male_cave'); open(l); bonus(l.c).forEach(s => { if (/dragonscales_|blood/.test(s.id)) iceScales[s.id] = true })
}
ok('fire caves: red, green, bronze or gray scales and fire dragon blood only', Object.keys(fireScales).every(id => /dragonscales_(red|green|bronze|gray)$|fire_dragon_blood/.test(id)) && fireScales['iceandfire:fire_dragon_blood'], Object.keys(fireScales).join(','))
ok('lightning caves: electric, amythest, copper or black scales and lightning blood only', Object.keys(iceScales).every(id => /dragonscales_(electric|amythest|copper|black)$|lightning_dragon_blood/.test(id)), Object.keys(iceScales).join(','))
ok('the hoard includes gold, diamonds and dragon bones', allIds['minecraft:gold_ingot'] && allIds['minecraft:diamond'] && allIds['iceandfire:dragonbone'])
ok('no entry twice in one chest', (() => { for (let i = 0; i < 50; i++) { const ch = chestAt(8000 + i, 'iceandfire:chest/ice_dragon_female_cave'); open(ch); const b = bonus(ch.c).map(s => s.id.replace(/dragonscales_.*/, 'scales')); if (new Set(b).size != b.length) return false } return true })())

lockedIds = ['iceandfire:']
let sealedSeen = {}
for (let i = 0; i < 200; i++) { let ch = chestAt(9000 + i, 'iceandfire:chest/fire_dragon_female_cave'); open(ch); bonus(ch.c).forEach(s => { sealedSeen[s.id] = true }) }
ok('while the Pool seals Ice and Fire, its items are skipped (vanilla treasure only)', Object.keys(sealedSeen).every(id => id.startsWith('minecraft:')) && Object.keys(sealedSeen).length > 3, Object.keys(sealedSeen).join(','))
lockedIds = []

const other = chestAt(9900, 'minecraft:chests/simple_dungeon'); open(other)
ok('other chests are left alone', bonus(other.c).length == 0)
const full = chestAt(9901, 'iceandfire:chest/fire_dragon_male_cave', 4, 4); open(full)
ok('a full chest takes nothing, and nothing errors', bonus(full.c).length == 0 && !logs.some(l => /^ERR/.test(l)))
const shut = chestAt(9902, 'iceandfire:chest/fire_dragon_male_cave')
handler({ block: shut.b, server }); advance(3)
ok('a chest that didn\'t open gets nothing', bonus(shut.c).length == 0)
const D = JSON.parse(persistent.dragon_hoard || '{}')
ok('chests and stacks are counted', D.chests > 1000 && D.stacks > D.chests, persistent.dragon_hoard)
ok('each hoard is logged', logs.some(l => /\[DragonHoard\] fire dragon cave chest at .*: \d+ /.test(l)))
global.BloodPool = undefined
const noPool = chestAt(9950, 'iceandfire:chest/fire_dragon_male_cave'); open(noPool)
ok('without the Blood Pool the hoard still works', bonus(noPool.c).length >= 3)
ok('no errors logged', !logs.some(l => /^ERR/.test(l)), logs.filter(l => /^ERR/.test(l)).join('; '))

console.log(fails ? fails + ' FAILED' : 'ALL PASSED')
