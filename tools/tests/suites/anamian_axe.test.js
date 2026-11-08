// anamian_axe.js: the levelling super weapon (Souls, levels, enchantments, Timber, Cleave, Bloodthirst, Blood Harvest,
// Judgement, open for grabs, offerings, commands).
// Run with: node tools/tests/run_all.js anamian_axe   (or node tools/tests/suites/anamian_axe.test.js)
const fs = require('fs')
const paths = require('../lib/paths')
const snbt = require('../lib/snbt.js')
const src = fs.readFileSync(paths.server('anamian_axe.js'), 'utf8')
let fails = 0
const ok = (l, c, e) => { console.log((c ? 'ok   ' : 'FAIL ') + l + (!c && e !== undefined ? '  ' + e : '')); if (!c) fails++ }

// ---------- the mock ----------
const OW = 'minecraft:overworld'
let tick = 0, queue = []
const persistent = {}, players = [], entities = [], cmds = [], logs = []
const jlist = arr => ({ size: () => arr.length, get: i => arr[i] })
const blocks = {}
const level = {
  dimension: { location: () => OW },
  getBlock: (x, y, z) => { const id = blocks[x + ',' + y + ',' + z] || 'minecraft:air'; return { id, x, y, z, level, hasTag: t => (t == 'minecraft:logs' ? /_log$/.test(id) : t == 'minecraft:leaves' ? /_leaves$/.test(id) : false) } },
}
const server = {
  get players() { return jlist(players.filter(p => p.online)) },
  get entities() { return jlist(entities.filter(e => e.alive).concat(players.filter(p => p.online))) },
  scheduleInTicks: (n, fn) => queue.push([tick + n, fn]),
  persistentData: { getString: k => persistent[k] || '', putString: (k, v) => { persistent[k] = v } },
  runCommandSilent: c => {
    cmds.push(c)
    let m = c.match(/setblock (-?\d+) (-?\d+) (-?\d+) minecraft:air destroy$/)
    if (m) { const k = m[1] + ',' + m[2] + ',' + m[3]; if (blocks[k]) { delete blocks[k]; return 1 } return 0 }
    m = c.match(/^damage (\S+) ([\d.]+) /)
    if (m) { const e = entities.find(x => x.uuid == m[1]); if (e) { e.damageTaken = (e.damageTaken || 0) + Number(m[2]); fireHurt(e, { getActual: () => null, getImmediate: () => null, getMsgId: () => 'player' }, Number(m[2])) } return 1 }
    return 1
  },
}
function advance(n) { for (let i = 0; i < n; i++) { tick++; const due = queue.filter(q => q[0] <= tick); queue = queue.filter(q => q[0] > tick); due.forEach(q => q[1]()) } }
// NBT view over a parsed SNBT object.
function tag(o) {
  return { contains: k => o != null && Object.prototype.hasOwnProperty.call(o, k), getCompound: k => tag(o && o[k] || {}),
    getInt: k => (o && o[k] != null ? parseInt(String(o[k]), 10) : 0), getBoolean: () => false }
}
function stack(id, count, nbtStr) {
  const parsed = nbtStr ? snbt(nbtStr) : null
  const s = { id, count: count == null ? 1 : count, nbtStr, parsed,
    get nbt() { return parsed ? tag(parsed) : null }, isEmpty() { return this.count <= 0 },
    getCount() { return this.count }, shrink(n) { this.count = Math.max(0, this.count - n) },
    getDamageValue() { return parsed && parsed.Damage != null ? parseInt(parsed.Damage, 10) : 0 } }
  return s
}
const EMPTY = stack('minecraft:air', 0)
const Item = { of: (id, n, nbt) => stack(id, n, nbt) }
function player(name, opts) {
  opts = opts || {}
  const slots = []
  const p = { name, uuid: 'u-' + name, online: true, op: !!opts.op, x: 0, y: 64, z: 0, msgs: [], healed: 0, onGround: true, fall: 0, sneak: false,
    selected: 0, isPlayer: () => true, getGameProfile: () => ({ getName: () => name }), getStringUuid: () => p.uuid,
    getX: () => p.x, getY: () => p.y, getZ: () => p.z, level, server,
    hasPermissions: () => p.op, tell: c => p.msgs.push(Array.isArray(c) ? c.map(x => (typeof x == 'string' ? x : x.text)).join('') : String(c)),
    heal: n => { p.healed += n }, isShiftKeyDown: () => p.sneak, isCrouching: () => p.sneak,
    onGround: () => p.onGround, isInWater: () => false, isPassenger: () => false, get fallDistance() { return p.fall },
    inventory: { getItem: i => slots[i] || EMPTY, setItem: (i, s) => { slots[i] = s } },
    get mainHandItem() { return slots[p.selected] || EMPTY },
    give: s => { for (let i = 0; i < 36; i++) if (!slots[i] || slots[i].isEmpty()) { slots[i] = s; return } }, slots }
  players.push(p)
  return p
}
function mob(type, x, z, opts) {
  opts = opts || {}
  const e = { type, uuid: 'e-' + Math.random().toString(36).slice(2), x, y: 64, z, alive: true, level, damageTaken: 0,
    isPlayer: () => false, getEncodeId: () => type, getX: () => e.x, getY: () => e.y, getZ: () => e.z, isAlive: () => e.alive, isLiving: () => true,
    getStringUuid: () => e.uuid, getType: () => ({ getCategory: () => (opts.hostile ? 'MONSTER' : 'CREATURE') }) }
  Object.assign(e, opts.extra || {})
  entities.push(e)
  return e
}
const handlers = {}
let cmdTree = null
const coins = {}
const Economy = { countCoins: p => coins[p.name] || 0, takeCoins: (p, n) => { if ((coins[p.name] || 0) < n) return false; coins[p.name] -= n; return true } }
const pool = []
const global = { Economy, BloodPool: { addDrops: (n, src2, u, nm) => pool.push({ n, src2, nm }) } }
const node = n => ({ n, ch: [], req: null, f: null, then(c) { this.ch.push(c); return this }, requires(f) { this.req = f; return this }, executes(f) { this.f = f; return this } })
const StringArg = { word: () => 'word', getString: (ctx, k) => ctx.args[k] }
const Serializer = { fromJsonLenient: j => JSON.parse(j) }
new Function('EntityEvents', 'BlockEvents', 'PlayerEvents', 'ServerEvents', 'Java', 'Utils', 'Item', 'Text', 'console', 'global', src)(
  { death: h => { handlers.death = h }, hurt: h => { handlers.hurt = h } },
  { broken: h => { handlers.broken = h } },
  { tick: h => { handlers.tick = h } },
  { loaded: h => { handlers.loaded = h }, commandRegistry: h => h({ commands: { literal: node, argument: n => node(n) }, arguments: { INTEGER: { create: () => 'int', getResult: (ctx, k) => ctx.args[k] } }, register: t => { cmdTree = t } }) },
  { loadClass: n => (/StringArgumentType/.test(n) ? StringArg : Serializer) },
  { server }, Item, { of: s => s },
  { info: m => logs.push(m), warn: m => logs.push('WARN ' + m), error: m => logs.push('ERR ' + m) },
  global)
handlers.loaded({ server })
function run(args, as) {
  const replies = []
  const ctx = { args: {}, source: { server, hasPermission: () => !!(as && as.op), getPlayer: () => as || null, sendSystemMessage: c => replies.push(c.map(x => (typeof x == 'string' ? x : x.text)).join('')) } }
  let n = cmdTree
  for (const a of args) {
    let next = n.ch.find(c => c.n == a)
    if (!next) { next = n.ch.find(c => ['player', 'amount', 'souls'].indexOf(c.n) >= 0); ctx.args[next.n] = next.n == 'player' ? a : Number(a) }
    if (next.req && !next.req(ctx.source)) return ['DENIED']
    n = next
  }
  n.f(ctx)
  return replies
}
function kill(victim, killer) { victim.alive = false; handlers.death({ entity: victim, server, source: { getActual: () => killer, getMsgId: () => 'player' } }) }
class Cancel extends Error {}
function fireHurt(victim, source, dmg) {
  let cancelled = false
  try { handlers.hurt({ entity: victim, server, source, damage: dmg, cancel() { cancelled = true; throw new Cancel() } }) } catch (e) { if (!(e instanceof Cancel)) throw e }
  return cancelled
}
function hit(victim, p, dmg) { return fireHurt(victim, { getActual: () => p, getImmediate: () => p, getMsgId: () => 'player' }, dmg) }
const axeOf = p => p.slots.find(s => s && s.parsed && s.parsed.trollcraft)
const ench = s => Object.fromEntries((s.parsed.Enchantments || []).map(e => [e.id.replace('minecraft:', ''), parseInt(e.lvl, 10)]))
const lore = s => s.parsed.display.Lore.map(l => JSON.parse(l).text)
const soulsOf = p => parseInt(axeOf(p).parsed.trollcraft.anamian.souls, 10)
const lastMsg = p => p.msgs[p.msgs.length - 1] || ''

// ---------- forging ----------
const anamy = player('Anamy'), bo = player('Bo'), admin = player('Admin', { op: true })
ok('/anamian before it exists: not forged yet', /not been forged/.test(run([], bo)[0]))
ok('/anamian give is op-only', run(['give', 'Anamy'], bo)[0] == 'DENIED')
ok('/anamian give Anamy forges it at Level I', /Forged The Anamian Axe for Anamy at Level I/.test(run(['give', 'Anamy'], admin)[0]) && axeOf(anamy))
let ax = axeOf(anamy)
ok('... a diamond axe with Sharpness I, Efficiency I, Unbreaking I (no Fortune 255)', ax.id == 'minecraft:diamond_axe' && JSON.stringify(ench(ax)) == '{"sharpness":1,"efficiency":1,"unbreaking":1}', JSON.stringify(ench(ax)))
ok('... its lore: flavour, level and Souls, a bar, and the next ability', /Lord Anamy/.test(lore(ax)[0]) && /Level I · Souls 0 \/ 50/.test(lore(ax)[1]) && /░{10}/.test(lore(ax)[2]) && /Timber at Level II/.test(lore(ax).join('|')), lore(ax).join(' | '))
ok('a second give is refused', /already exists/.test(run(['give', 'Bo'], admin)[0]))

// ---------- Souls from kills ----------
anamy.selected = 0
const z1 = mob('minecraft:zombie', 1, 0, { hostile: true }); kill(z1, anamy)
ok('a hostile mob kill: +3 Souls', soulsOf(anamy) == 3, soulsOf(anamy))
const cow = mob('minecraft:cow', 1, 0); kill(cow, anamy)
ok('a passive mob: +1', soulsOf(anamy) == 4)
anamy.selected = 5
kill(mob('minecraft:zombie', 1, 0, { hostile: true }), anamy)
ok('not counted when the axe isn\'t in the main hand', soulsOf(anamy) == 4)
anamy.selected = 0
kill(mob('minecraft:zombie', 1, 0, { hostile: true }), bo)
ok('kills by others don\'t count', soulsOf(anamy) == 4)
kill(mob('twilightforest:lich', 2, 0, { extra: { isShadowClone: () => true } }), anamy)
ok('a Lich shadow clone gives nothing', soulsOf(anamy) == 4)
kill(mob('twilightforest:naga', 2, 0), anamy)
ok('a Naga: +100 Souls, and the Axe reaches Level II', soulsOf(anamy) == 104 && /Level II/.test(lore(axeOf(anamy))[1]))
ok('... announced to everyone, naming the new ability', bo.msgs.some(m => /reached Level II in the hands of Anamy\. It has learned Timber/.test(m)), bo.msgs.join(' / '))
ok('... and the boss kill itself is announced', bo.msgs.some(m => /drinks deep: Anamy felled a mighty foe\. \+100 Souls/.test(m)))
ok('... Level II enchantments', JSON.stringify(ench(axeOf(anamy))) == '{"sharpness":2,"efficiency":2,"unbreaking":2}')

// ---------- Timber ----------
function tree(x0) {
  for (let y = 64; y < 69; y++) blocks[x0 + ',' + y + ',0'] = 'minecraft:oak_log'
  for (let dx = -1; dx <= 1; dx++) for (let dz = -1; dz <= 1; dz++) if (dx || dz) blocks[(x0 + dx) + ',68,' + dz] = 'minecraft:oak_leaves'
}
function chop(p, x, y) {
  const id = blocks[x + ',' + y + ',0']
  handlers.broken({ player: p, server, block: { id, x, y, z: 0, level, hasTag: t => (t == 'minecraft:logs' ? /_log$/.test(id) : false) } })
  delete blocks[x + ',' + y + ',0']
}
tree(100)
const s0 = soulsOf(anamy)
chop(anamy, 100, 64)
ok('Timber fells the whole tree (4 more logs above)', [65, 66, 67, 68].every(y => !blocks['100,' + y + ',0']), JSON.stringify(Object.keys(blocks).filter(k => /^100,/.test(k) && /log/.test(blocks[k]))))
ok('... each log gives a Soul (5)', soulsOf(anamy) == s0 + 5, soulsOf(anamy) - s0)
ok('... and costs durability (4)', axeOf(anamy).getDamageValue() == 4)
ok('... the leaves are left alone', blocks['99,68,0'] == 'minecraft:oak_leaves')
for (let y = 64; y < 69; y++) blocks['200,' + y + ',0'] = 'minecraft:spruce_log'
chop(anamy, 200, 64)
ok('a log pillar with no leaves (a build) isn\'t felled', blocks['200,65,0'] == 'minecraft:spruce_log')
tree(300)
anamy.sneak = true
chop(anamy, 300, 64)
ok('sneaking chops one log only', blocks['300,65,0'] == 'minecraft:oak_log')
anamy.sneak = false
tree(400)
global.PROTECTED_AREAS = undefined
const fresh = player('Fresh')
fresh.slots[0] = stack('minecraft:diamond_axe', 1, '{trollcraft:{anamian:{serial:99,souls:500}}}')
chop(fresh, 400, 64)
ok('an axe with an old serial is just an axe (no Timber, no Souls)', blocks['400,65,0'] == 'minecraft:oak_log')

// ---------- Cleave ----------
const target = mob('minecraft:zombie', 10, 0, { hostile: true }), near = mob('minecraft:skeleton', 11, 1, { hostile: true }), far = mob('minecraft:zombie', 30, 0, { hostile: true })
anamy.x = 8
hit(target, anamy, 8)
ok('below Level IV: no Cleave', near.damageTaken == 0)
run(['setsouls', '300'], Object.assign(anamy, { op: true }))
anamy.op = false
ok('/anamian setsouls 300 (op) brings Level IV', /Level IV/.test(lore(axeOf(anamy))[1]) && /Cleave/.test(lore(axeOf(anamy)).join('|')))
const pal = player('Pal'); pal.x = 10.5; pal.z = 0.5
hit(target, anamy, 8)
ok('Cleave: a mob within 3 blocks takes half the damage (4)', near.damageTaken == 4, near.damageTaken)
ok('... a mob further away takes nothing', far.damageTaken == 0)
ok('... players nearby are never cleaved', !cmds.some(c => /damage u-Pal/.test(c)))
ok('... and cleave hits don\'t cleave again', cmds.filter(c => /^damage /.test(c)).length == 1, cmds.filter(c => /^damage /.test(c)).join(' / '))

// ---------- Bloodthirst and Blood Harvest ----------
run(['setsouls', '800'], Object.assign(anamy, { op: true })); anamy.op = false
const before = anamy.healed
kill(mob('minecraft:zombie', 1, 0, { hostile: true }), anamy)
ok('Bloodthirst (V): a kill heals 2', anamy.healed == before + 2)
ok('Blood Harvest (VI): a kill pours 5 Drops into the Pool', pool.length && pool[pool.length - 1].n == 5 && pool[pool.length - 1].src2 == 'anamian' && pool[pool.length - 1].nm == 'Anamy', JSON.stringify(pool))
kill(bo, anamy); bo.alive = true
ok('... a player kill: +25 Souls, heals 6, pours 50', anamy.healed == before + 8 && pool[pool.length - 1].n == 50)

// ---------- Level VIII, X and Judgement ----------
run(['setsouls', '1700'], Object.assign(anamy, { op: true })); anamy.op = false
ok('below Level X: no attribute modifiers (the axe\'s own damage)', !axeOf(anamy).parsed.AttributeModifiers)
ok('Level VIII: the axe becomes netherite, durability kept', axeOf(anamy).id == 'minecraft:netherite_axe' && axeOf(anamy).getDamageValue() == 4)
ok('... with Efficiency VI, Unbreaking V, Fortune III', ench(axeOf(anamy)).efficiency == 6 && ench(axeOf(anamy)).unbreaking == 5 && ench(axeOf(anamy)).fortune == 3)
ok('... and it says so', bo.msgs.some(m => /Its edge turns to netherite/.test(m)))
const crit = mob('minecraft:zombie', 50, 0, { hostile: true })
anamy.onGround = false; anamy.fall = 1
hit(crit, anamy, 10)
ok('below Level X: a crit calls no lightning', !cmds.some(c => /lightning_bolt/.test(c)))
run(['setsouls', '3300'], Object.assign(anamy, { op: true })); anamy.op = false
ok('Level X: Sharpness VI, Mending, Fire Aspect, and a dark red bold name', ench(axeOf(anamy)).sharpness == 6 && ench(axeOf(anamy)).mending == 1 && ench(axeOf(anamy)).fire_aspect == 1 && JSON.parse(axeOf(anamy).parsed.display.Name).bold === true && JSON.parse(axeOf(anamy).parsed.display.Name).color == 'dark_red')
const am = axeOf(anamy).parsed.AttributeModifiers
ok('Level X: 17 attack damage (a +16 main-hand modifier) with the axe\'s usual attack speed', am && am.length == 2 &&
  am[0].AttributeName == 'minecraft:generic.attack_damage' && parseFloat(am[0].Amount) == 16 && am[0].Slot == 'mainhand' &&
  am[1].AttributeName == 'minecraft:generic.attack_speed' && parseFloat(am[1].Amount) == -3, JSON.stringify(am))
hit(crit, anamy, 10)
ok('Judgement: a critical hit summons lightning on the target', cmds.some(c => /summon minecraft:lightning_bolt 50\.00 64\.00 0\.00/.test(c)), cmds.filter(c => /lightning/.test(c)).join(' / '))
ok('... the holder gets Fire Resistance', cmds.some(c => /effect give Anamy minecraft:fire_resistance/.test(c)))
ok('... and isn\'t hurt by the bolt', fireHurt(anamy, { getActual: () => null, getImmediate: () => null, getMsgId: () => 'lightningBolt' }, 5) === true)
const bolts = () => cmds.filter(c => /lightning_bolt/.test(c)).length
hit(crit, anamy, 10)
ok('... with a cooldown (no second bolt straight away)', bolts() == 1)
anamy.onGround = true; anamy.fall = 0
ok('a non-critical hit never calls lightning', (() => { const n = bolts(); hit(crit, anamy, 10); return bolts() == n })())
// Rhino may hand the same player back as a different wrapper: compare by UUID, not identity.
const anamyTwin = Object.assign(Object.create(Object.getPrototypeOf(anamy)), anamy)
const crit2 = mob('minecraft:zombie', 60, 0, { hostile: true })
anamy.onGround = false; anamy.fall = 0; anamy.vy = -0.4
anamy.getDeltaMovement = () => ({ y: () => anamy.vy })
const nBefore = bolts()
global.__now = Date.now
Date.now = () => global.__now() + 10000           // past the cooldown
fireHurt(crit2, { getActual: () => anamy, getImmediate: () => anamyTwin, getMsgId: () => 'player' }, 10)
ok('... fires even when the attacker comes back as a different object (same UUID)', bolts() == nBefore + 1)
ok('... and counts a falling hit (moving down) as a crit even with no fall distance recorded', cmds.filter(c => /lightning_bolt 60\.00/.test(c)).length == 1)
Date.now = () => global.__now() + 20000
const arrow = { getStringUuid: () => 'arrow-1', isPlayer: () => false }
const nArrow = bolts()
fireHurt(crit2, { getActual: () => anamy, getImmediate: () => arrow, getMsgId: () => 'arrow' }, 10)
ok('... but not for a projectile', bolts() == nArrow)
ok('/anamian debug is op-only', run(['debug'], anamy)[0] == 'DENIED')
anamy.op = true
ok('/anamian debug turns on the hit report', /Debug on/.test(run(['debug'], anamy)[0]))
Date.now = () => global.__now() + 30000
fireHurt(crit2, { getActual: () => anamy, getImmediate: () => anamy, getMsgId: () => 'player' }, 10)
ok('... which shows what the crit check saw', /hit: Level X, damage 10\.00, ground false, fall 0\.00, vy -0\.40, last fell never -> JUDGEMENT/.test(lastMsg(anamy)), lastMsg(anamy))
// Better Combat: the hit arrives after the swing's wind-up, when the jump has already landed.
const crit3 = mob('minecraft:zombie', 70, 0, { hostile: true })
let clock = global.__now() + 40000
Date.now = () => clock
anamy.onGround = false; anamy.vy = -0.3; anamy.fall = 0.8
handlers.tick({ player: anamy })                 // falling, axe in hand
anamy.onGround = true; anamy.vy = 0; anamy.fall = 0
clock += 400
let nGrace = bolts()
fireHurt(crit3, { getActual: () => anamy, getImmediate: () => anamy, getMsgId: () => 'player' }, 10)
ok('Better Combat: a hit 0.4 s after landing from a jump still counts as a crit', bolts() == nGrace + 1, lastMsg(anamy))
ok('... and the debug line says when the holder last fell', /last fell 400 ms ago -> JUDGEMENT/.test(lastMsg(anamy)), lastMsg(anamy))
clock += 5000
handlers.tick({ player: anamy })                 // on the ground now
clock += 100
nGrace = bolts()
fireHurt(crit3, { getActual: () => anamy, getImmediate: () => anamy, getMsgId: () => 'player' }, 10)
ok('... but a hit long after landing isn\'t a crit', bolts() == nGrace && /not a crit/.test(lastMsg(anamy)), lastMsg(anamy))
const boTick = () => { bo.onGround = false; bo.vy = -0.5; handlers.tick({ player: bo }); bo.onGround = true; bo.vy = 0 }
boTick()
run(['debug'], anamy); anamy.op = false
Date.now = global.__now
anamy.vy = 0
ok('other players are still hurt by lightning', fireHurt(bo, { getActual: () => null, getImmediate: () => null, getMsgId: () => 'lightningBolt' }, 5) === false)

// ---------- offerings ----------
coins.Anamy = 3
run(['setsouls', '0'], Object.assign(anamy, { op: true })); anamy.op = false
ok('/anamian offer coins 2: +30 Souls', /\+30 Souls/.test(run(['offer', 'coins', '2'], anamy)[0]) && soulsOf(anamy) == 30 && coins.Anamy == 1)
ok('... refused with too few coins', /only carry 1/.test(run(['offer', 'coins', '5'], anamy)[0]))
anamy.slots[3] = stack('minecraft:potato', 64); anamy.slots[4] = stack('minecraft:potato', 64)
ok('/anamian offer potatoes 128: takes 100, +5 Souls', /\+5 Souls/.test(run(['offer', 'potatoes', '128'], anamy)[0]) && soulsOf(anamy) == 35 && anamy.slots[3].count + anamy.slots[4].count == 28)
ok('... only the holder, axe in hand', /Hold The Anamian Axe/.test(run(['offer', 'coins', '1'], bo)[0]))

// ---------- open for grabs ----------
advance(120)
const held = axeOf(anamy), idx = anamy.slots.indexOf(held)
// The black market's shop window takes the inventory away while it's open: not "loose".
anamy.slots[idx] = EMPTY
anamy.hasContainerOpen = () => true
advance(400)
ok('while a shop window or chest is open, a missing axe isn\'t announced loose', !bo.msgs.some(m => /is loose/.test(m)))
anamy.hasContainerOpen = () => false
anamy.slots[idx] = held
advance(120)
ok('... and it\'s back when the window closes, with no claim message', !bo.msgs.some(m => /Anamy has claimed/.test(m)))
// Held on the mouse cursor while sorting the inventory: still held.
anamy.slots[idx] = EMPTY
anamy.containerMenu = { getCarried: () => held }
advance(400)
ok('on the mouse cursor it still counts as held', !bo.msgs.some(m => /is loose/.test(m)))
anamy.containerMenu = { getCarried: () => EMPTY }
advance(110)
ok('one check without it isn\'t enough to call it loose', !bo.msgs.some(m => /is loose/.test(m)))
advance(120)
ok('dropped: announced once as loose', bo.msgs.filter(m => /is loose\. Anamy no longer has it\. Open for grabs/.test(m)).length == 1, bo.msgs.slice(-3).join(' / '))
advance(240)
ok('... and not again', bo.msgs.filter(m => /is loose/.test(m)).length == 1)
bo.slots[2] = held
advance(120)
ok('Bo picks it up: "Bo has claimed The Anamian Axe (Level I)! Anamy has lost it."', bo.msgs.some(m => /Bo has claimed The Anamian Axe \(Level I\)! Anamy has lost it\./.test(m)))
ok('... it keeps its Souls', parseInt(held.parsed.trollcraft.anamian.souls, 10) == 35)
ok('/anamian shows the holder', /Held by Bo/.test(run([], anamy)[0]))
bo.online = false
advance(240)
ok('its holder logging off with it doesn\'t make it loose', bo.msgs.filter(m => /is loose/.test(m)).length == 1)
bo.online = true
ok('/anamian stats is op-only and reports', run(['stats'], anamy)[0] == 'DENIED' && /Serial 1, held by Bo/.test(run(['stats'], admin)[0]))
ok('/anamian give force forges a new one; the old serial stops counting', /Forged/.test(run(['give', 'Admin', 'force'], admin)[0]) && !global.AnamianAxe.isRealAxe(held))
ok('no errors logged', !logs.some(l => /^ERR/.test(l)), logs.filter(l => /^ERR/.test(l)).join('; '))

console.log(fails ? fails + ' FAILED' : 'ALL PASSED')
