// shrine.js (the Shrine Awakens): the sites and /shrine status, the directions from the castle, the rise layer by
// layer (players moved out, chunk loading, the effects, pausing, failures, /reload and restarts), and the reset.
// Run with: node tools/tests/run_all.js shrine   (or node tools/tests/suites/shrine.test.js)
const fs = require('fs')
const paths = require('../lib/paths')
const src = fs.readFileSync(paths.server('part2/shrine.js'), 'utf8')
let fails = 0
const ok = (l, c, e) => { console.log((c ? 'ok   ' : 'FAIL ') + l + (!c && e !== undefined ? '  ' + e : '')); if (!c) fails++ }

// ---------- the mock ----------
const OW = 'minecraft:overworld'
let T = 1700000000000
Date.now = () => T
let tick = 0, queue = []
function advance(n) { for (let i = 0; i < n; i++) { tick++; T += 50; const due = queue.filter(q => q[0] <= tick); queue = queue.filter(q => q[0] > tick); due.forEach(q => q[1]()) } }
const seconds = n => advance(n * 20)
const persistent = {}, logs = []
let cmds = []
let chunksAt = 0, layersThere = true, placeWorks = true
// The ground: solid below y 64, open above, plus whatever /setblock put down (world: "x,y,z" -> block state text).
const world = {}, worldNbt = {}
function blockAt(x, y, z) {
  const s = world[x + ',' + y + ',' + z] || (y < 64 ? 'minecraft:grass_block' : 'minecraft:air')
  const m = s.match(/^([^\[]+)(?:\[(.*)\])?$/), props = {}
  if (m[2]) m[2].split(',').forEach(kv => { const i = kv.indexOf('='); props[kv.slice(0, i)] = kv.slice(i + 1) })
  return { id: m[1], blockState: { toString: () => 'Block{' + m[1] + '}' + (m[2] ? '[' + m[2] + ']' : '') }, properties: { get: k => (k in props ? props[k] : null) } }
}
const level = {
  dimension: { location: () => OW },
  getBlock: blockAt,
  hasChunk: () => tick >= chunksAt,
  getSharedSpawnPos: () => ({ getX: () => 0, getY: () => 64, getZ: () => 0 }),
}
const jlist = arr => ({ size: () => arr.length, get: i => arr[i], iterator() { let i = 0; return { hasNext: () => i < arr.length, next: () => arr[i++] } } })
function textOf(c) { return Array.isArray(c) ? c.map(x => (typeof x == 'string' ? x : x.text || '')).join('') : String(c) }
// Item stacks: an id, a count and (for the King's Potatoes) a marked tag, as KubeJS gives them.
function stack(id, count, marked) {
  const s = { id, count, marked: !!marked, isEmpty: () => s.count <= 0 || s.id == 'minecraft:air', getCount: () => s.count, shrink: n => { s.count = Math.max(0, s.count - n) },
    get nbt() { return s.marked ? { contains: k => k == 'trollcraft', getCompound: () => ({ contains: k => k == 'kingspotato' }) } : null } }
  return s
}
const kings = n => stack('minecraft:potato', n, true)
const players = []
function player(name, x, y, z, op) {
  const slots = []
  for (let i = 0; i < 41; i++) slots.push(stack('minecraft:air', 0))
  const p = { name, op: !!op, x, y, z, msgs: [], level, creative: false, isPlayer: () => true, getGameProfile: () => ({ getName: () => name }),
    getX: () => p.x, getY: () => p.y, getZ: () => p.z, tell: c => p.msgs.push(textOf(c)),
    isCreative: () => p.creative, isSpectator: () => false, isAlive: () => true, getStringUuid: () => name.toLowerCase() + '-uuid',
    hasPermissions: () => p.op, health: 20, fire: 0, setHealth: h => { p.health = h }, getMaxHealth: () => 20, clearFire: () => { p.fire = 0 },
    inventory: { getItem: i => slots[i], setItem: (i, s) => { slots[i] = s }, getContainerSize: () => 41 }, slots,
    get mainHandItem() { return slots[0] } }
  players.push(p)
  return p
}
const kingsCarried = p => p.slots.filter(s => s.marked && s.count > 0).reduce((a, s) => a + s.count, 0)
const byName = n => players.find(p => p.name == n)
// Mobs: what spawns (EntityEvents.spawned) and what's already about (server.entities).
const nether = { dimension: { location: () => 'minecraft:the_nether' } }
const mobs = []
function mob(type, category, x, y, z, opts) {
  opts = opts || {}
  // As KubeJS 6 has them on the server (seen with a probe): getType() is the id as text, the category is on entityType.
  const m = { type, x, y, z, level: opts.level || level, discarded: false, tags: opts.tags || [], named: !!opts.named,
    getType: () => type, entityType: { getCategory: () => category }, isPlayer: () => false, hasCustomName: () => m.named,
    getTags: () => ({ toString: () => '[' + m.tags.join(', ') + ']' }), getX: () => m.x, getY: () => m.y, getZ: () => m.z,
    discard: () => { m.discarded = true }, dead: false, target: null, health: 24,
    isAlive: () => !m.dead && !m.discarded, isRemoved: () => m.discarded, getTarget: () => m.target, setTarget: t => { m.target = t },
    getHealth: () => m.health, getMaxHealth: () => 24 }
  return m
}
const EXIT = { exit: true }
// Fires EntityEvents.spawned for a mob; true if a handler cancelled it. A mob that isn't cancelled joins the world.
function spawn(m) {
  const ev = { entity: m, cancelled: false, cancel() { ev.cancelled = true; throw EXIT } }
  ;(handlers.spawned || []).forEach(h => { try { h(ev) } catch (e) { if (e !== EXIT) throw e } })
  if (!ev.cancelled) mobs.push(m)
  return ev.cancelled
}
const server = {
  get players() { return jlist(players) },
  get entities() { return jlist(players.concat(mobs.filter(m => !m.discarded))) },
  scheduleInTicks: (n, fn) => queue.push([tick + n, fn]),
  persistentData: { getString: k => persistent[k] || '', putString: (k, v) => { persistent[k] = v } },
  getAllLevels: () => jlist([level]),
  overworld: () => level,
  getStructureManager: () => ({ get: () => ({ isPresent: () => layersThere }) }),
  runCommandSilent: c => {
    cmds.push(c)
    let m
    if ((m = c.match(/run tp (\S+) ([-\d.]+) ([-\d.]+) ([-\d.]+)$/))) { const p = byName(m[1]); if (p) { p.x = +m[2]; p.y = +m[3]; p.z = +m[4] } return 1 }
    if (/run place template /.test(c)) return placeWorks ? 1 : 0
    // /setblock x y z block[state]{nbt}: the NBT (a lectern's book) is kept in worldNbt.
    if ((m = c.match(/run setblock (-?\d+) (-?\d+) (-?\d+) ([^\s{\[]+(?:\[[^\]]*\])?)(\{.*\})?$/))) {
      const k = m[1] + ',' + m[2] + ',' + m[3]
      if (world[k] == m[4] && !m[5]) return 0              // like the game: setting the same block is an error
      world[k] = m[4]
      if (m[5]) worldNbt[k] = m[5]; else delete worldNbt[k]
      return 1
    }
    // /fill ... minecraft:air, or only where a given block is (fill ... minecraft:air replace <block>)
    if ((m = c.match(/run fill (-?\d+) (-?\d+) (-?\d+) (-?\d+) (-?\d+) (-?\d+) minecraft:air(?: replace (\S+))?$/))) {
      const b = m.slice(1, 7).map(Number), only = m[7]
      Object.keys(world).forEach(k => { const q = k.split(',').map(Number); if (q[0] >= b[0] && q[0] <= b[3] && q[1] >= b[1] && q[1] <= b[4] && q[2] >= b[2] && q[2] <= b[5] && (!only || world[k] == only)) delete world[k] })
      return 1
    }
    // A summoned mob joins the world (and goes through EntityEvents.spawned), named and tagged as its NBT says.
    if ((m = c.match(/run summon minecraft:(\S+) ([-\d.]+) ([-\d.]+) ([-\d.]+) (\{.*\})$/))) {
      const tm = m[5].match(/Tags:\[([^\]]*)\]/)
      const mb = mob('minecraft:' + m[1], m[1] == 'item' ? 'MISC' : 'MONSTER', +m[2], +m[3], +m[4], { tags: tm ? tm[1].split(',').map(s => s.replace(/"/g, '')) : [], named: /CustomName/.test(m[5]) })
      mb.nbt = m[5]
      const hm = m[5].match(/,Health:(\d+)f/); if (hm) mb.health = +hm[1]
      return spawn(mb) ? 0 : 1
    }
    return 1
  },
}
// KubeJS events and commands (roots: every command registered, by name; cmdTree: /shrine)
let handlers = {}, cmdTree = null
const roots = {}
const on = name => h => { (handlers[name] = handlers[name] || []).push(h) }
const node = n => ({ n, ch: [], req: null, f: null, then(c) { this.ch.push(c); return this }, requires(f) { this.req = f; return this }, executes(f) { this.f = f; return this } })
const global = {}
let started = false
const Utils = { get server() { return started ? server : null } }
function RL(s) { this.s = s }
// Loads (or reloads) the script, as /reload does: fresh handlers and commands, the same saved data and globals.
function load() {
  handlers = {}
  new Function('ServerEvents', 'EntityEvents', 'BlockEvents', 'LevelEvents', 'ItemEvents', 'Java', 'Utils', 'Text', 'console', 'global', src)(
    { loaded: on('loaded'), commandRegistry: h => h({ commands: { literal: node, argument: (n, t) => Object.assign(node(n), { arg: true, type: t }) },
      arguments: { INTEGER: { create: () => 'int', getResult: (ctx, k) => ctx.args[k] }, PLAYER: { create: () => 'player', getResult: (ctx, k) => ctx.args[k] } }, register: t => { roots[t.n] = t; cmdTree = roots.shrine || t } }) },
    { spawned: on('spawned'), death: on('death') },
    { broken: on('broken'), placed: on('placed'), rightClicked: on('blockRightClicked') },
    { afterExplosion: on('afterExplosion') },
    { rightClicked: on('itemRightClicked') },
    { loadClass: n => {
      if (/Component\$Serializer/.test(n)) return { fromJsonLenient: j => JSON.parse(j) }
      if (/ResourceLocation/.test(n)) return RL
      throw new Error('no class ' + n)
    } },
    Utils, { of: s => s },
    { info: m => logs.push(m), warn: m => logs.push('WARN ' + m), error: m => logs.push('ERR ' + m) },
    global)
}
load()
started = true
;(handlers.loaded || []).forEach(h => h({ server }))
function cmd(line, as) {
  const replies = []
  const ctx = { args: {}, source: { server, hasPermission: () => !as || as.op, getPlayer: () => as || null, sendSystemMessage: c => replies.push(textOf(c)) } }
  if (cmdTree.req && !cmdTree.req(ctx.source)) return ['DENIED']
  let n = cmdTree
  for (const a of line.split(' ')) {
    let next = n.ch.find(c => c.n == a && !c.arg)
    if (!next) { next = n.ch.find(c => c.arg); if (next) ctx.args[next.n] = next.type == 'player' ? byName(a) : Number(a) }
    if (!next) throw new Error('no command shrine ' + line)
    n = next
  }
  n.f(ctx)
  return replies
}
// /regalia, which anyone can run
function regalia(as) {
  const replies = []
  roots.regalia.f({ args: {}, source: { server, hasPermission: () => !as || as.op, getPlayer: () => as || null, sendSystemMessage: c => replies.push(textOf(c)) } })
  return replies
}
const S = () => global.Shrine.state()
const said = (p, re) => p.msgs.some(m => re.test(m))
const placed = () => cmds.filter(c => /run place template trollcraft:shrine\/l_\d+ /.test(c)).map(c => +c.match(/l_(\d+) /)[1])
const layerTicks = 9

const admin = player('Admin', 1000.5, 64, 2000.5, true)
const bob = player('Bob', 1000.5, 64, 2000.5)          // standing right where the Shrine will rise
const carol = player('Carol', 1060.5, 64, 2000.5)      // watching from outside the footprint
const far = player('Far', 5000.5, 64, 5000.5)          // nowhere near

// ---------- the sites and the status ----------
let r = cmd('status', admin)
ok('status with nothing set: no site, no braziers, not started', /Shrine site: not set/.test(r[0]) && /Brazier 1: not set/.test(r[1]) && /Brazier 3: not set/.test(r[3]) && /not started/.test(r[4]), r.join(' | '))
ok('/shrine is op only', cmd('status', bob)[0] == 'DENIED')
r = cmd('rise', admin)
ok('/shrine rise with no site: refused, says how to set it', /site first/.test(r[0]) && !S().rise.state.match(/rising/), r[0])
r = cmd('braziers', admin)
ok('/shrine braziers with no brazier sites: refused, says which to set', /Set every brazier first: \/shrine brazier set 1, 2, 3/.test(r[0]) && S().fires.state == 'none', r[0])
r = cmd('site set', null)
ok('/shrine site set from the console: refused, says how to give coordinates', /Run this as a player/.test(r[0]) && /site set <x> <y> <z>/.test(r[0]))
r = cmd('site set 5000 120 -3000', null)
ok('/shrine site set <x> <y> <z> from the console: set in the Overworld', S().site.x == 5000 && S().site.y == 120 && S().site.z == -3000 && S().site.dim == OW && /will rise there/.test(r[0]), r[0])
r = cmd('brazier set 2 -40 70 900', null)
ok('/shrine brazier set <n> <x> <y> <z> from the console', S().braziers[1].x == -40 && S().braziers[1].z == 900 && /about 900 blocks south/.test(r[0]), r[0])
r = cmd('brazier set 2', null)
ok('/shrine brazier set <n> from the console with no coordinates: refused', /brazier set <1-3> <x> <y> <z>/.test(r[0]))
r = cmd('site set', admin)
ok('/shrine site set: the centre at the op\'s feet, with the box it will clear', S().site.x == 1000 && S().site.y == 64 && S().site.z == 2000 &&
  /979 1979 to 1020 2021/.test(r[0]) && /42 x 43 blocks/.test(r[0]) && /64 tall/.test(r[0]), r[0])
const at = (x, y, z) => { admin.x = x + 0.5; admin.y = y; admin.z = z + 0.5 }
at(1900, 70, 0); r = cmd('brazier set 1', admin)
ok('brazier 1, 1,900 east of the castle: "about 1900 blocks toward the rising sun"', /Brazier 1 set at 1900 70 0/.test(r[0]) && /the first, about 1900 blocks toward the rising sun from the castle/.test(r[0]), r[0])
at(-500, 64, 10); r = cmd('brazier set 2', admin)
ok('brazier 2, west: "about 500 blocks toward the setting sun"', /the second, about 500 blocks toward the setting sun/.test(r[0]), r[0])
at(300, 64, -300); r = cmd('brazier set 3', admin)
ok('brazier 3, north-east, 424 blocks rounds to about 400', /the third, about 400 blocks north-east/.test(r[0]), r[0])
at(0, 64, 20); r = cmd('brazier set 4', admin)
ok('brazier 4: refused (there are three)', /numbered 1 to 3/.test(r[0]) && S().braziers.length == 3, r[0])
ok('the directions: south and north-west too', global.Shrine.fromCastle({ x: 0, z: 1000 }) == 'about 1000 blocks south' && global.Shrine.fromCastle({ x: -700, z: -700 }) == 'about 1000 blocks north-west')
ok('... and a brazier at the castle is still "about 50 blocks"', /^about 50 blocks/.test(global.Shrine.fromCastle({ x: 3, z: 0 })))
r = cmd('status', admin)
ok('status lists the site and each brazier from the castle', /Shrine site: 1000 64 2000/.test(r[0]) && /Brazier 1: 1900 70 0, about 1900 blocks toward the rising sun from the castle/.test(r[1]) && /Brazier 2: -500 64 10/.test(r[2]), r.join(' | '))
at(1000, 64, 1940)

// ---------- refusals before the rise ----------
layersThere = false
r = cmd('rise', admin)
ok('the layers missing: refused, nothing placed', /layers are missing/.test(r[0]) && S().rise.state == 'none' && placed().length == 0, r[0])
ok('... and status says so', /layers are missing/.test(cmd('status', admin)[4]))
layersThere = true
// A stand-in Purge shaped like purge.js: busy() says why a Purge can't start, and the Shrine is one of the reasons;
// active() and pending() say whether one runs or counts down.
const purgeStandIn = running => ({ active: () => running, pending: () => null,
  busy: () => (running ? 'A Purge is already running' : global.Shrine && global.Shrine.busy() ? 'The Shrine Awakens is on (' + global.Shrine.busy() + '). The Purge waits.' : '') })
global.Purge = purgeStandIn(true)
r = cmd('rise', admin)
ok('a Purge on: refused', /A Purge is on/.test(r[0]) && S().rise.state == 'none', r[0])
global.Purge = purgeStandIn(false)
global.Gladiator = { busy: () => true }
r = cmd('rise', admin)
ok('a Gladiator match on: refused', /Gladiator match is on/.test(r[0]) && S().rise.state == 'none', r[0])
global.Gladiator = { busy: () => false }

// ---------- the rise ----------
// Before any of it stands, monsters spawn there as usual; a zombie and a tagged ambush mob are about already.
ok('no Shrine yet: a zombie can spawn at the site', !spawn(mob('minecraft:zombie', 'MONSTER', 1000.5, 64, 2000.5)))
const oldZombie = mobs[mobs.length - 1]
const ambusher = mob('minecraft:vindicator', 'MONSTER', 1005.5, 64, 2005.5, { tags: ['portal_ambush'] }); mobs.push(ambusher)
chunksAt = tick + 30                                  // the site's chunks take a moment to load
cmds = []
r = cmd('rise', admin)
ok('/shrine rise before the braziers\' beam is up: refused, the braziers come first (force goes ahead)', /The beam isn't up yet/.test(r[0]) && /\/shrine rise force raises it anyway/.test(r[0]) && S().rise.state == 'none' && placed().length == 0, r[0])
r = cmd('rise force', admin)
ok('/shrine rise: 64 layers in about 29 seconds', /64 layers in about 29 seconds\./.test(r[0]) && S().rise.state == 'rising', r[0])
ok('... the site is force-loaded', cmds.some(c => c == 'execute in minecraft:overworld run forceload add 979 1979 1020 2021'), cmds.join('\n'))
ok('... nearby players are told and get the title; someone far away isn\'t', said(carol, /ground beneath the beam begins to shake/) && cmds.some(c => /^title Carol title .*The Shrine rises/.test(c)) && !said(far, /shake/))
ok('global.Shrine.busy() while it rises', global.Shrine.busy() == 'the Shrine is rising')
advance(10)
ok('nothing is placed until the chunks are loaded', placed().length == 0)
advance(31)                                           // checked once a second: they're ready at the third look
ok('then layer 0: its slice cleared first, then placed at the corner', placed().join() == '0' &&
  cmds.indexOf('execute in minecraft:overworld run fill 979 64 1979 1020 64 2021 minecraft:air') >= 0 &&
  cmds.indexOf('execute in minecraft:overworld run fill 979 64 1979 1020 64 2021 minecraft:air') < cmds.indexOf('execute in minecraft:overworld run place template trollcraft:shrine/l_0 979 64 1979'), cmds.filter(c => /fill|place/.test(c)).join('\n'))
ok('Bob, standing in the footprint, was moved to the nearest edge onto the ground, and told', bob.x == 1024.5 && bob.y == 64 && bob.z == 2000.5 && said(bob, /lurches/), [bob.x, bob.y, bob.z].join(' '))
ok('Carol, outside it, wasn\'t moved', carol.x == 1060.5)
ok('as it starts, the zombie already there is taken away; the ambush mob stays', oldZombie.discarded && !ambusher.discarded)
// While any of it stands: no monsters spawn in its box or 2 blocks around it.
ok('a zombie spawning inside the Shrine: cancelled', spawn(mob('minecraft:zombie', 'MONSTER', 1000.5, 90, 2000.5)))
ok('... at its top, and in the 2-block margin round it: cancelled', spawn(mob('minecraft:skeleton', 'MONSTER', 1000.5, 128.5, 2000.5)) &&
  spawn(mob('minecraft:creeper', 'MONSTER', 977.5, 64, 2000.5)) && spawn(mob('minecraft:spider', 'MONSTER', 1000.5, 64, 2022.5)))
ok('... 3 blocks out, below its base, or in another dimension: allowed', !spawn(mob('minecraft:zombie', 'MONSTER', 976.5, 64, 2000.5)) &&
  !spawn(mob('minecraft:zombie', 'MONSTER', 1000.5, 62, 2000.5)) && !spawn(mob('minecraft:zombie', 'MONSTER', 1000.5, 90, 2000.5, { level: nether })))
ok('... a cow, an ambush mob, a Shrine event mob and an op\'s named mob inside: allowed', !spawn(mob('minecraft:cow', 'CREATURE', 1000.5, 90, 2000.5)) &&
  !spawn(mob('minecraft:vindicator', 'MONSTER', 1000.5, 90, 2000.5, { tags: ['portal_ambush', 'pa_g1'] })) &&
  !spawn(mob('minecraft:vindicator', 'MONSTER', 1000.5, 90, 2000.5, { tags: ['shrine_inspector'] })) &&
  !spawn(mob('minecraft:zombie', 'MONSTER', 1000.5, 90, 2000.5, { named: true })))
ok('... with the stone sounds, the anchor\'s charge as it starts, dust and smoke', cmds.some(c => /playsound minecraft:block\.deepslate\.place block @a 1000\.5 64\.5 2000\.5/.test(c)) &&
  cmds.some(c => /playsound minecraft:block\.grindstone\.use block @a 1000\.5 64\.5/.test(c)) && cmds.some(c => /playsound minecraft:block\.respawn_anchor\.charge block @a 1000\.5 64\.5/.test(c)) &&
  cmds.some(c => /particle minecraft:large_smoke/.test(c)))
advance(layerTicks)
ok('the next layer comes 9 ticks later, one block up', placed().join() == '0,1' && cmds.some(c => / place template trollcraft:shrine\/l_1 979 65 1979$/.test(c)))
bob.x = 1000.5; bob.y = 66; bob.z = 1985.5                       // walks back in
advance(layerTicks)
ok('walking back in gets you moved out again (nearest edge: the north side)', bob.z == 1976.5 && bob.x == 1000.5, [bob.x, bob.y, bob.z].join(' '))
const thunderBefore = cmds.filter(c => /lightning_bolt\.thunder/.test(c)).length
advance(layerTicks * 19)
ok('layer 21, the pedestal\'s last: thunder', placed().length == 22 && cmds.filter(c => /lightning_bolt\.thunder/.test(c)).length == thunderBefore + 1, placed().length)
ok('... the anchor\'s charge there too, and the wither\'s crunch at layers 4, 12 and 20', cmds.some(c => /respawn_anchor\.charge block @a 1000\.5 85\.5/.test(c)) &&
  [68.5, 76.5, 84.5].every(y => cmds.some(c => new RegExp('entity\\.wither\\.break_block hostile @a 1000\\.5 ' + String(y).replace('.', '\\.') + ' ').test(c))))
ok('... and never the Warden\'s dig (it sounded like squishing)', !cmds.some(c => /warden/.test(c)))
ok('status: rising, layer 22 of 64', /layer 22 of 64/.test(cmd('status', admin)[4]))

// pause and carry on
r = cmd('stop', admin)
ok('/shrine stop pauses it', /paused at layer 22/.test(r[0]) && S().rise.state == 'stopped' && global.Shrine.busy() == '', r[0])
advance(layerTicks * 3)
ok('... nothing more is placed while it\'s paused', placed().length == 22)
ok('/shrine stop again: nothing running', /Nothing is running/.test(cmd('stop', admin)[0]))
r = cmd('site set', admin)
ok('the site can\'t move once it has begun', /can't move now/.test(r[0]) && S().site.z == 2000, r[0])
r = cmd('rise', admin)
ok('/shrine rise carries on from layer 22', /carries on from layer 22/.test(r[0]) && S().rise.state == 'rising', r[0])
advance(2)
ok('... with layer 22 next', placed().slice(-1)[0] == 22 && placed().length == 23, placed().slice(-3).join())
ok('a second /shrine rise while it\'s rising: refused', /already rising/.test(cmd('rise', admin)[0]))

// a layer that won't place: paused there
placeWorks = false
advance(layerTicks)
ok('a layer that fails to place pauses the rise there, with an error in the log', S().rise.state == 'stopped' && S().rise.next == 23 && logs.some(l => /ERR .*Layer 23 could not be placed/.test(l)), S().rise.next)
placeWorks = true
cmd('rise', admin); advance(2)
ok('... /shrine rise tries that layer again', S().rise.next == 24 && placed().filter(n => n == 23).length == 2)

// /reload mid-rise: the old loop stops, the new one carries on, nothing is placed twice
const before = placed().length
load()
advance(layerTicks * 2 + 25)
const counts = {}
placed().forEach(n => { counts[n] = (counts[n] || 0) + 1 })
ok('/reload mid-rise: it carries on from its last layer, one loop only', S().rise.state == 'rising' && placed().length > before && Object.keys(counts).every(n => counts[n] == 1 || n == '23'), JSON.stringify(counts))
// a restart (ServerEvents.loaded) mid-rise
load()
;(handlers.loaded || []).forEach(h => h({ server }))
advance(layerTicks + 25)
const counts2 = {}
placed().forEach(n => { counts2[n] = (counts2[n] || 0) + 1 })
ok('a restart mid-rise: it carries on too, still one loop', S().rise.state == 'rising' && placed().length > before + 2 && Object.keys(counts2).every(n => counts2[n] == 1 || n == '23'), JSON.stringify(counts2))

// to the top (a zombie wanders in on the way, and gets walled in)
carol.msgs = []
const walledIn = mob('minecraft:zombie', 'MONSTER', 1010.5, 100, 1990.5); mobs.push(walledIn)
advance(layerTicks * 64)
const all = placed()
const missing = []
for (let n = 0; n < 64; n++) if (all.indexOf(n) < 0) missing.push(n)
ok('every layer 0..63 was placed, and the Shrine has risen', missing.length == 0 && S().rise.state == 'risen' && global.Shrine.risen() && S().rise.next == 64, 'missing ' + missing.join())
ok('... the head at the top: thunder, and the watchers are told', cmds.some(c => / place template trollcraft:shrine\/l_63 979 127 1979$/.test(c)) && said(carol, /Technoblade's Shrine stands/))
ok('... the forceload is removed', cmds.some(c => c == 'execute in minecraft:overworld run forceload remove 979 1979 1020 2021'))
ok('... and nothing is waiting to run but the steps\' glow', queue.length == 1, queue.length)
ok('/shrine rise once risen: refused', /already risen/.test(cmd('rise', admin)[0]))
ok('status: risen', /The Shrine has risen, at 1000 64 2000/.test(cmd('status', admin)[4]))
ok('when it has risen, a zombie walled in on the way is taken away', walledIn.discarded && logs.some(l => /Took away 1 monster from the Shrine/.test(l)))
const lurker = mob('minecraft:husk', 'MONSTER', 990.5, 120, 2010.5); mobs.push(lurker)
const pet = mob('minecraft:zombie', 'MONSTER', 991.5, 120, 2010.5, { named: true }); mobs.push(pet)
r = cmd('clearmobs', admin)
ok('/shrine clearmobs takes away a monster standing in it, and leaves a named one', lurker.discarded && !pet.discarded && /Took away 1 monster/.test(r[0]), r[0])
ok('... and again: nothing left', /No monsters in the Shrine/.test(cmd('clearmobs', admin)[0]))

// ---------- the steps up to the altar ----------
// Corner 979 64 1979: the top step is at statue (38, 21), z 19..21, so 1017 85 1998..2000; each one out and one down, to
// the ground at y 64 (22 steps: a 23rd, at y 63, would be all ground).
const stepAt = (k, dz) => world[(1017 + k) + ',' + (85 - k) + ',' + (1998 + (dz || 0))]
ok('when it has risen, the steps up to the altar are laid: barriers 3 wide, from the platform\'s edge to the ground (22)',
  S().stairs == 22 && [0, 1, 2].every(dz => stepAt(0, dz) == 'minecraft:barrier' && stepAt(21, dz) == 'minecraft:barrier') && !stepAt(22, 1) &&
  !world['1016,85,1999'] && !world['1017,85,1997'] && logs.some(l => /The steps to the altar: 22/.test(l)), S().stairs)
ok('... status says so', /22 steps up to the altar/.test(cmd('status', admin)[4]), cmd('status', admin)[4])
const spots = players.map(p => [p.x, p.z])
carol.x = 1030.5; carol.z = 1990.5
cmds = []
advance(20)
ok('... faint red dust over the middle of each step while someone is near', cmds.filter(c => /run particle minecraft:dust 0\.55 0 0 1 [\d.]+ [\d.]+ 1999\.5 0\.3 0 1 0 2 normal$/.test(c)).length == 22,
  cmds.filter(c => /dust/.test(c)).length)
players.forEach(p => { p.x = 9000.5; p.z = 9000.5 })
cmds = []
advance(20)
ok('... and none with nobody near', !cmds.some(c => /particle minecraft:dust/.test(c)))
players.forEach((p, i) => { p.x = spots[i][0]; p.z = spots[i][1] })
// /shrine repair: missing steps go back, and what stands in their way (a tree grown there) is left alone
delete world['1020,82,1998']; world['1020,82,1999'] = 'minecraft:oak_log'; delete world['1030,72,2000']
r = cmd('repair', admin)
advance(2)
ok('/shrine repair lays any missing steps again, and leaves what stands in their way', stepAt(3, 0) == 'minecraft:barrier' && stepAt(3, 1) == 'minecraft:oak_log' &&
  stepAt(13, 2) == 'minecraft:barrier' && S().stairs == 22 && /any missing steps/.test(r[0]), r[0])
// where the land rises to meet them, the flight ends there
;[0, 1, 2].forEach(dz => { world[(1027) + ',' + (75) + ',' + (1998 + dz)] = 'minecraft:stone' })
cmd('repair', admin)
advance(2)
ok('... and where the land rises to meet them, the flight ends there (10 steps)', S().stairs == 10, S().stairs)
;[0, 1, 2].forEach(dz => { delete world['1027,75,' + (1998 + dz)] })
delete world['1020,82,1999']
cmd('repair', admin)
advance(2)
ok('... the land gone again, the 22 steps are back', S().stairs == 22 && [0, 1, 2].every(dz => stepAt(10, dz) == 'minecraft:barrier'))
load()                                            // a /reload: the glow carries on, one loop only
carol.x = 1030.5; carol.z = 1990.5
cmds = []
advance(20)
ok('after a /reload the glow carries on, from one loop only', cmds.filter(c => /particle minecraft:dust/.test(c)).length == 22, cmds.filter(c => /dust/.test(c)).length)
players.forEach((p, i) => { p.x = spots[i][0]; p.z = spots[i][1] })

// ---------- the reset ----------
r = cmd('reset', admin)
ok('/shrine reset alone only explains (it needs confirm)', /reset confirm/.test(r[0]) && S().rise.state == 'risen')
cmds = []
bob.x = 1000.5; bob.y = 90; bob.z = 2000.5                        // on the Shrine
r = cmd('reset confirm', admin)
advance(2)
const fills = cmds.filter(c => /run fill /.test(c) && !/ replace /.test(c))
ok('/shrine reset confirm: four fills of air from the top, covering all 64 layers', fills.length == 4 && /fill 979 110 1979 1020 127 2021 minecraft:air/.test(fills[0]) && /fill 979 64 1979 1020 73 2021 minecraft:air/.test(fills[3]), fills.join('\n'))
ok('... the steps go too: every barrier along the flight, and nothing else', cmds.filter(c => /run fill \d+ \d+ \d+ \d+ \d+ \d+ minecraft:air replace minecraft:barrier$/.test(c)).length == 34 &&
  !Object.keys(world).some(k => world[k] == 'minecraft:barrier') && S().stairs == 0)
ok('... each within fill\'s 32,768-block limit', fills.every(f => { const n = f.match(/fill (\S+) (\S+) (\S+) (\S+) (\S+) (\S+)/).slice(1).map(Number); return (n[3] - n[0] + 1) * (n[4] - n[1] + 1) * (n[5] - n[2] + 1) <= 32768 }))
ok('... Bob, standing on it, is moved off first', bob.x != 1000.5 || bob.z != 2000.5)
ok('... loose items in the box are removed', cmds.some(c => /kill @e\[type=minecraft:item,x=979,y=64,z=1979,dx=41,dy=64,dz=42\]/.test(c)))
ok('... the night is forgotten and the sites are kept', S().rise.state == 'none' && S().rise.next == 0 && S().site.x == 1000 && S().braziers[0].x == 1900 && !global.Shrine.risen())
ok('once it\'s taken down, monsters spawn there as usual again', !spawn(mob('minecraft:zombie', 'MONSTER', 1000.5, 64, 2000.5)))
ok('/shrine clearmobs with no Shrine: refused', /no Shrine standing/.test(cmd('clearmobs', admin)[0]))
r = cmd('reset confirm', admin)
ok('a reset with nothing built: nothing to take down', /Nothing was built/.test(r[0]))

// ---------- Stage 2: the braziers, the beam and the ambushes ----------
const B = () => S().fires
const fireKey = b => b.x + ',' + (b.y + 1) + ',' + b.z
const fireOf = b => world[fireKey(b)] || ''
const lightFire = b => { world[fireKey(b)] = 'minecraft:campfire[lit=true,signal_fire=false]' }
const douse = b => { world[fireKey(b)] = 'minecraft:campfire[lit=false,signal_fire=false]' }
const [b1, b2, b3] = S().braziers
const inspectors = () => mobs.filter(m => !m.discarded && m.tags.indexOf('shrine_ambush') >= 0)
players.forEach(p => { p.msgs = [] })
admin.creative = true                                   // the op watches; creative players are never ambushed
// the start: where /shrine braziers brings everyone (owner, 2026-11-15)
r = cmd('braziers', admin)
ok('/shrine braziers with no start set: refused, says how to set it', /Set the start first: \/shrine start set/.test(r[0]) && B().state == 'none' && !global.Shrine.eventOn(), r[0])
ok('status: no start, the event off', /The start: not set/.test(cmd('status', admin)[9]) && /The event: off/.test(cmd('status', admin)[10]), cmd('status', admin).slice(9).join(' | '))
r = cmd('start set 5000 64 5000', null)
ok('/shrine start set <x> <y> <z> from the console', S().start.x == 5000 && S().start.y == 64 && S().start.z == 5000 && /The start is there, at 5000 64 5000/.test(r[0]), r[0])
global.Purge = purgeStandIn(true)
ok('/shrine braziers during a Purge: refused, the event doesn\'t start', /A Purge is on/.test(cmd('braziers', admin)[0]) && B().state == 'none' && !global.Shrine.eventOn())
global.Purge = purgeStandIn(false)
cmds = []
r = cmd('braziers', admin)
ok('/shrine braziers: all three go out, each with its place and direction', B().state == 'placed' && /1 at 1900 70 0 \(about 1900 blocks toward the rising sun\)/.test(r[0]) &&
  /within 60 seconds/.test(r[0]), r[0])
ok('... the event begins: every player online is brought to the start, and told', players.every(p => p.x == 5000.5 && p.y == 64 && p.z == 5000.5 && said(p, /The pilgrimage begins/)) &&
  global.Shrine.eventOn() && /Everyone is at the start \(5000 64 5000\), and the event is on/.test(r[0]), players.map(p => p.name + ' ' + p.x + ' ' + p.z).join(', '))
ok('... status: the start and the event', /The start: 5000 64 5000/.test(cmd('status', admin)[9]) && /The event: on/.test(cmd('status', admin)[10]), cmd('status', admin).slice(9).join(' | '))
ok('... global.Shrine.busy(): the Purge and the arena wait all night, not just for the rite', global.Shrine.busy() == 'the Shrine Awakens is on')
ok('... their chunks are force-loaded while they\'re watched', [b1, b2, b3].every(b => cmds.indexOf('execute in minecraft:overworld run forceload add ' + (b.x - 1) + ' ' + (b.z - 1) + ' ' + (b.x + 1) + ' ' + (b.z + 1)) >= 0))
advance(2)
ok('... and each is built: a blackstone plinth, an unlit campfire on it, walls and chains at the corners',
  [b1, b2, b3].every(b => world[b.x + ',' + b.y + ',' + b.z] == 'minecraft:polished_blackstone_bricks' && fireOf(b) == 'minecraft:campfire[lit=false,signal_fire=false]' &&
    world[(b.x + 1) + ',' + (b.y + 1) + ',' + (b.z + 1)] == 'minecraft:polished_blackstone_wall' && world[(b.x - 1) + ',' + (b.y + 2) + ',' + (b.z - 1)] == 'minecraft:chain[axis=y]'))
ok('... status: the fires are out, none lit', /The fires: out, none lit/.test(cmd('status', admin)[5]), cmd('status', admin)[5])
ok('/shrine braziers again: they\'re already out', /already out/.test(cmd('braziers', admin)[0]))
// breaking one
let ev = { block: { level, x: b1.x, y: b1.y, z: b1.z }, player: bob, cancelled: false, cancel() { ev.cancelled = true; throw EXIT } }
;(handlers.broken || []).forEach(h => { try { h(ev) } catch (e) { if (e !== EXIT) throw e } })
ok('a player can\'t break a brazier', ev.cancelled && said(bob, /The brazier will not move/))
ev = { block: { level, x: b1.x, y: b1.y, z: b1.z }, player: admin, cancelled: false, cancel() { ev.cancelled = true; throw EXIT } }
;(handlers.broken || []).forEach(h => { try { h(ev) } catch (e) { if (e !== EXIT) throw e } })
ok('... an op in creative can', !ev.cancelled)

// the automatic ambush: Carol comes within 200 blocks of brazier 3 (300, -300); Dave walks with her; Admin in creative too
const dave = player('Dave', 300 + 150, 64, -300 + 10)
carol.x = 300 + 160; carol.z = -300; carol.msgs = []
const admin0 = { x: admin.x, z: admin.z }
admin.x = 300 + 100; admin.z = -300
advance(20)
ok('the first pilgrim within 200 blocks of an unlit brazier is ambushed there, with those near them', B().ambushed[2] && inspectors().length == 4 &&
  said(carol, /Inspector: "Unregistered pilgrims\. Remain where you are\."/) && said(dave, /clipboards first/) && !said(admin, /clipboards/), inspectors().length)
ok('... Inspectors named in gold, unsigned (never "Ministry"), in iron, tagged as event mobs', inspectors().every(m => /"text":"Inspector","color":"gold"/.test(m.nbt) &&
  !/Ministry/i.test(m.nbt) && /iron_chestplate/.test(m.nbt) && /PersistenceRequired:1b/.test(m.nbt) && m.tags.indexOf('shrine_inspector') >= 0))
ok('... on the ground in a ring 8 to 12 blocks round Dave (the nearest to the brazier, so the one ambushed)', inspectors().every(m => { const d = Math.hypot(m.x - dave.x, m.z - dave.z); return d >= 7.5 && d <= 12.8 && m.y == 64 }),
  inspectors().map(m => Math.hypot(m.x - dave.x, m.z - dave.z).toFixed(1) + '@' + m.y).join(' '))
advance(60)
ok('... only once per brazier', inspectors().length == 4 && B().ambushed.filter(x => x).length == 1)
admin.x = admin0.x; admin.z = admin0.z
dave.x = 9000; carol.x = 1060.5; carol.z = 2000.5
// /shrine ambush <player>
bob.x = 5000.5; bob.z = 2000.5; bob.msgs = []
r = cmd('ambush Bob', admin)
ok('/shrine ambush Bob: Inspectors close in on him (2 + 1 for Bob)', /3 Inspectors close in on Bob/.test(r[0]) && inspectors().length == 7 && said(bob, /Remain where you are/), r[0])
// knockouts all night (the event): anyone, anywhere
const fall = (p, type) => { const ev = { entity: p, server, source: { getMsgId: () => type || 'mob' }, cancelled: false, cancel() { ev.cancelled = true; throw EXIT } }
  ;(handlers.death || []).forEach(h => { try { h(ev) } catch (e) { if (e !== EXIT) throw e } }); return ev.cancelled }
bob.health = 0; bob.msgs = []; cmds = []
ok('the event on: Bob, killed by an ambush, is knocked out instead; with no fire lit he wakes at the start, healed, effects cleared',
  fall(bob, 'mob') && bob.x == 5000.5 && bob.y == 64 && bob.z == 5000.5 && bob.health == 20 && said(bob, /You wake where the pilgrimage began/) &&
  cmds.indexOf('effect clear Bob') >= 0 && cmds.indexOf('effect clear Bob') < cmds.indexOf('effect give Bob minecraft:resistance 3 4 true') &&
  logs.some(l => l == '[Shrine] Knockout: Bob (mob), woken at the start'), [bob.x, bob.y, bob.z].join(' '))
ok('... /kill still kills', !fall(bob, 'genericKill'))

// lighting: one, two, then the clock runs out
players.forEach(p => { p.msgs = [] })
lightFire(b1)
advance(20)
ok('lighting one starts the clock: 1 of 3, and everyone is told', B().state == 'counting' && B().lit[0] && said(carol, /Far away, a fire catches\. 1 of 3/) && said(far, /1 of 3/))
bob.x = 3000.5; bob.z = 3000.5
ok('a knockout with a fire lit: woken beside it, 3 blocks east, on the ground', fall(bob, 'mob') && bob.x == 1903.5 && bob.y == 64 && bob.z == 0.5 && said(bob, /beside the last fire lit/),
  [bob.x, bob.y, bob.z].join(' '))
ok('... the boss bar shows the fires and the time left', cmds.some(c => /^bossbar set trollcraft:shrine_fires name .*The fires: 1 \/ 3.*(1:00|0:5\d)/.test(c)) && cmds.some(c => c == 'bossbar set trollcraft:shrine_fires players @a'))
advance(100)
ok('... counting down', cmds.some(c => /^bossbar set trollcraft:shrine_fires name .*The fires: 1 \/ 3.*0:5[45]/.test(c)) && /The fires: 1 of 3 lit, 0:5\d left/.test(cmd('status', admin)[5]), cmd('status', admin)[5])
lightFire(b2)
advance(20)
ok('a second: 2 of 3', B().lit[1] && said(carol, /Another fire catches\. 2 of 3/))
ok('... a knockout now wakes beside the second, the last one lit', fall(bob, 'arrow') && bob.x == -496.5 && bob.z == 10.5, [bob.x, bob.y, bob.z].join(' '))
// a /reload while the clock runs: the watch carries on
load()
seconds(60)
ok('after a minute without the third, the lit ones gutter out (even across a /reload)', B().state == 'placed' && fireOf(b1) == 'minecraft:campfire[lit=false,signal_fire=false]' &&
  fireOf(b2) == 'minecraft:campfire[lit=false,signal_fire=false]' && said(carol, /The fires gutter out\. They must burn together\./), B().state)
ok('... with smoke and a hiss, and the boss bar goes', cmds.some(c => /particle minecraft:large_smoke 1900\.5 71\.5 0\.5/.test(c)) && cmds.some(c => /block\.fire\.extinguish/.test(c)) &&
  cmds.lastIndexOf('bossbar remove trollcraft:shrine_fires') > cmds.findIndex(c => /The fires: 2 \/ 3/.test(c)))
ok('/shrine fires out with no clock running: refused', /No fire is burning against the clock/.test(cmd('fires out', admin)[0]))
ok('with the fires guttered out, a knockout wakes at the start again', fall(bob, 'mob') && bob.x == 5000.5 && bob.z == 5000.5)
// all three in time
players.forEach(p => { p.msgs = [] })
lightFire(b1); advance(20)
lightFire(b2); lightFire(b3); advance(20)
ok('all three within the minute: they burn as one, and everyone is told', B().state == 'lit' && said(carol, /Three fires burn as one/) && said(far, /red light rises/))
advance(15)
ok('... the beam goes up under the Shrine site: iron, a beacon, red glass in the ground', world['999,61,1999'] == 'minecraft:iron_block' && world['1001,61,2001'] == 'minecraft:iron_block' &&
  world['1000,62,2000'] == 'minecraft:beacon' && world['1000,63,2000'] == 'minecraft:red_stained_glass' && S().beam.up && global.Shrine.beamUp())
ok('... keeping what it replaced (the ground there)', S().beam.saved.length == 11 && S().beam.saved.every(c => c.state == 'minecraft:grass_block'))
ok('... the beacon\'s sound plays to everyone', cmds.some(c => /execute as Carol at @s run playsound minecraft:block\.beacon\.activate/.test(c)))
advance(110)
ok('... and the boss bar goes after a few seconds', cmds.lastIndexOf('bossbar remove trollcraft:shrine_fires') > cmds.findIndex(c => /Three fires burn as one/.test(c)))
ok('status: all three burn, the beam is up', /The fires: all three burn/.test(cmd('status', admin)[5]) && /The beam: up at 1000 64 2000/.test(cmd('status', admin)[6]))
douse(b3)
advance(20)
ok('once they all burn, one put out is lit again (they burn for the night)', fireOf(b3) == 'minecraft:campfire[lit=true,signal_fire=false]')
delete world[fireKey(b2)]
advance(20)
ok('... and a campfire taken away is put back, lit', fireOf(b2) == 'minecraft:campfire[lit=true,signal_fire=false]')
ok('/shrine braziers while they burn: refused', /already burn/.test(cmd('braziers', admin)[0]))

// the rise: the beam comes out (its ground back), the fires' stage ends, the ambushers go
ok('(the Purge, asked why it can\'t start, names the Shrine: the Shrine mustn\'t take that for a Purge running)', /The Shrine Awakens is on/.test(global.Purge.busy()))
cmds = []
r = cmd('rise', admin)
ok('/shrine rise with the beam up and the event on: no force needed, and the Shrine doesn\'t wait on itself', /64 layers in about 29 seconds/.test(r[0]), r[0])
advance(25)
ok('when the rise begins, the beam comes out and its ground is put back', !S().beam.up && world['1000,62,2000'] == 'minecraft:grass_block' && world['999,61,1999'] == 'minecraft:grass_block')
ok('... the fires\' stage ends: they stay lit, their chunks are let go', B().state == 'done' && fireOf(b1) == 'minecraft:campfire[lit=true,signal_fire=false]' &&
  cmds.indexOf('execute in minecraft:overworld run forceload remove ' + (b1.x - 1) + ' ' + (b1.z - 1) + ' ' + (b1.x + 1) + ' ' + (b1.z + 1)) >= 0)
ok('... and the Inspectors left from the ambushes are taken away', inspectors().length == 0)
ok('status: the fires are done, the beam is down', /The fires: done/.test(cmd('status', admin)[5]) && /The beam: down/.test(cmd('status', admin)[6]))
advance(layerTicks * 66)
ok('(the Shrine rises as before)', S().rise.state == 'risen')
// the reset takes the braziers too
cmd('reset confirm', admin)
advance(40)
ok('/shrine reset confirm also takes the braziers away and forgets the fires', B().state == 'none' && [b1, b2, b3].every(b => !world[fireKey(b)] && !world[b.x + ',' + b.y + ',' + b.z]))
ok('... and ends the event (the start is kept)', !global.Shrine.eventOn() && global.Shrine.busy() == '' && S().start.x == 5000 && (bob.health = 0, !fall(bob, 'mob')))

// by hand: /shrine fires light, /shrine beam up|down
cmd('braziers', admin); advance(2)
r = cmd('fires light', admin)
advance(5)
ok('/shrine fires light lights all three and raises the beam', /All three fires lit by hand/.test(r[0]) && B().state == 'lit' && [b1, b2, b3].every(b => /lit=true/.test(fireOf(b))) && S().beam.up)
ok('/shrine fires light again: refused', /aren't out, or they already burn/.test(cmd('fires light', admin)[0]))
r = cmd('beam down', admin)
ok('/shrine beam down puts the ground back', /comes down/.test(r[0]) && !S().beam.up && world['1000,62,2000'] == 'minecraft:grass_block')
ok('/shrine beam down again: refused', /isn't up/.test(cmd('beam down', admin)[0]))
r = cmd('beam up', admin)
ok('/shrine beam up raises it by hand', /goes up at 1000 64 2000/.test(r[0]) && S().beam.up && world['1000,62,2000'] == 'minecraft:beacon')
cmd('reset confirm', admin)
advance(40)
ok('a reset with no Shrine standing still brings the beam down', !S().beam.up && world['1000,62,2000'] == 'minecraft:grass_block' && B().state == 'none')
admin.creative = false

// ---------- Stage 4: the Ignition Rite ----------
const riteMobsNow = () => mobs.filter(m => !m.discarded && !m.dead && m.tags.indexOf('shrine_rite') >= 0)
const waveMobs = i => riteMobsNow().filter(m => m.tags.indexOf('shrine_wave_' + i) >= 0)
const kill = m => { m.dead = true; ;(handlers.death || []).forEach(h => { try { h({ entity: m, server, source: { getMsgId: () => 'player' }, cancel() { throw EXIT } }) } catch (e) { if (e !== EXIT) throw e } }) }
const dies = (p, type) => { const ev = { entity: p, server, source: { getMsgId: () => type || 'mob' }, cancelled: false, cancel() { ev.cancelled = true; throw EXIT } }
  ;(handlers.death || []).forEach(h => { try { h(ev) } catch (e) { if (e !== EXIT) throw e } }); return ev.cancelled }
const RT = () => S().rite
const riteOnNow = () => global.Shrine.riteOn()
ok('/shrine rite before the Shrine has risen: refused', /hasn't risen yet/.test(cmd('rite', admin)[0]))
cmd('rise force', admin)
advance(layerTicks * 66 + 30)
// at the Shrine: Carol and Bob in survival, the op in creative (not counted); Far is far away
carol.x = 1010.5; carol.z = 2010.5; bob.x = 1030.5; bob.y = 64; bob.z = 2000.5
admin.creative = true; admin.x = 1000.5; admin.z = 1975.5; far.x = 5000.5; far.z = 5000.5
players.forEach(p => { p.msgs = [] })
cmds = []
// The Inspectors' ground. With Math.random at 0, each one's first spot is 30 blocks out at 0, 120 and 240 degrees, and
// its second 0.6 radians before that. The first spots: (1030, 2000) is on the steps; (985, 2026) is under a hill that
// rises past the scan's top (the old way found a cave in it); (985, 1974) is a lake. The third one's second spot,
// (973, 1987), is forest floor under a canopy of leaves: fine.
const terrain = []
const put = (x, y, z, b) => { world[x + ',' + y + ',' + z] = b; terrain.push(x + ',' + y + ',' + z) }
for (let y = 64; y <= 110; y++) put(985, y, 2026, 'minecraft:stone')
put(985, 63, 1974, 'minecraft:water')
put(973, 70, 1987, 'minecraft:oak_leaves'); put(973, 71, 1987, 'minecraft:oak_leaves')
const random = Math.random
Math.random = () => 0
r = cmd('rite', admin)
Math.random = random
const colOf = m => Math.floor(m.x) + ',' + m.y + ',' + Math.floor(m.z)
ok('the Inspectors\' ground: never on the steps, in a hill\'s cave or a lake; under leaves, the forest floor', waveMobs(0).map(colOf).sort().join(' ') == '1002,64,2030 1025,64,1983 973,64,1987',
  waveMobs(0).map(colOf).join(' '))
terrain.forEach(k => { delete world[k] })
ok('/shrine rite: 2 present (the op in creative doesn\'t count), so the altar needs 16 potatoes', /2 present, so the altar needs 16 Potato King's Potatoes/.test(r[0]) && RT().state == 'running' && RT().need == 16, r[0])
ok('... wave 1: 3 Inspectors (1 per player, at least 3), in iron, seeing 64 blocks, each to drop 2 potatoes', waveMobs(0).length == 3 &&
  waveMobs(0).every(m => /iron_chestplate/.test(m.nbt) && /generic\.follow_range",Base:64\.0d/.test(m.nbt) && m.tags.indexOf('shrine_pot_2') >= 0 && m.tags.indexOf('shrine_inspector') >= 0))
ok('... on the land around the Shrine, 30 to 45 blocks from its centre', waveMobs(0).every(m => { const d = Math.hypot(m.x - 1000.5, m.z - 2000.5); return d >= 29 && d <= 46 }),
  waveMobs(0).map(m => Math.hypot(m.x - 1000.5, m.z - 2000.5).toFixed(0)).join(','))
ok('... those present are told what to do; someone far away isn\'t', said(carol, /Take the Potato King's Potatoes from the Inspectors and offer them at the altar: 16 in all/) &&
  said(bob, /Wave 1 of 4: 3 Inspectors close in on the Shrine/) && !said(far, /Wave 1/))
ok('... the rite\'s boss bar: 0 / 16 potatoes', cmds.some(c => /^bossbar set trollcraft:shrine_rite name .*The Ignition Rite: .*0 \/ 16 potatoes/.test(c)))
ok('/shrine awaken now: refused, the altar isn\'t full (force goes ahead)', /The altar isn't full yet \(0 of 16 potatoes\)\. \/shrine awaken force goes ahead anyway\./.test(cmd('awaken', admin)[0]))
ok('global.Shrine.busy(): the Purge and the arena wait', /Ignition Rite is on/.test(global.Shrine.busy()))
ok('/shrine rite again: already under way', /already under way \(wave 1 of 4\)/.test(cmd('rite', admin)[0]))
advance(20)
ok('the Inspectors go after the pilgrims at the Shrine (not the op in creative)', waveMobs(0).every(m => m.target === carol || m.target === bob))
// an Inspector of the rite dies: 2 Potato King's Potatoes
cmds = []
kill(waveMobs(0)[0])
ok('an Inspector killed drops 2 Potato King\'s Potatoes, marked, named in gold, with a glint', cmds.some(c => /run summon minecraft:item .*Count:2b,tag:\{trollcraft:\{kingspotato:1b\}.*Potato King\\'s Potato.*Enchantments/.test(c)), cmds.filter(c => /summon minecraft:item/.test(c)).join('\n'))
// the next wave comes when three-quarters of the last are down
kill(waveMobs(0)[0])
advance(20)
ok('with 2 of 3 down, no new wave yet', RT().wave == 0)
// A lake over the whole ring but its south-east corner (on the test server one filled the ring's north side, and an
// Inspector was put in it): they look all round the ring for dry ground.
const lake = []
for (let x = 952; x <= 1049; x++) {
  for (let z = 1952; z <= 2049; z++) {
    const d = Math.hypot(x + 0.5 - 1000.5, z + 0.5 - 2000.5)
    if (d >= 28 && d <= 48 && !(x > 1002 && z > 2002)) { world[x + ',63,' + z] = 'minecraft:water'; lake.push(x + ',63,' + z) }
  }
}
let seed = 0
Math.random = () => { seed = (seed + 0.6180339887) % 1; return seed }
kill(waveMobs(0)[0])
advance(20)
Math.random = random
ok('with all 3 down: wave 2, 3 Inspectors (1.5 per player), the vindicators with shields', RT().wave == 1 && waveMobs(1).length == 3 &&
  waveMobs(1).filter(m => m.type == 'minecraft:vindicator').every(m => /minecraft:shield/.test(m.nbt)) && said(carol, /Wave 2 of 4/))
ok('... with a lake over all the ring but one corner, every one still lands on dry ground there', waveMobs(1).every(m => m.x > 1002 && m.z > 2002 && m.y == 64) &&
  !logs.some(l => /No dry ground/.test(l)), waveMobs(1).map(m => m.x + ' ' + m.y + ' ' + m.z).join(', '))
lake.forEach(k => { delete world[k] })
// /shrine stop pauses the rite; /shrine rite brings the wave back
r = cmd('stop', admin)
ok('/shrine stop pauses the rite: the waves stop, the Inspectors go, the altar keeps its count', /The rite is paused/.test(r[0]) && RT().state == 'paused' && riteMobsNow().length == 0 &&
  cmds.indexOf('bossbar remove trollcraft:shrine_rite') >= 0, r[0])
ok('... status says so', /The Ignition Rite: paused at wave 2/.test(cmd('status', admin)[7]), cmd('status', admin)[7])
r = cmd('rite', admin)
ok('/shrine rite carries on: wave 2 comes again', /wave 2 comes again/.test(r[0]) && RT().state == 'running' && waveMobs(1).length == 3, r[0])
// a wave nobody clears: the next comes after 3 minutes anyway
seconds(181)
ok('after 3 minutes, wave 3 comes anyway: in diamond', RT().wave == 2 && waveMobs(2).length == 3 && waveMobs(2).every(m => /diamond_chestplate/.test(m.nbt)))
waveMobs(1).concat(waveMobs(2)).forEach(m => kill(m))
cmds = []
advance(20)
const senior = () => riteMobsNow().filter(m => m.tags.indexOf('shrine_senior') >= 0)[0]
ok('wave 4: 3 Inspectors and the Senior Inspector (150 health, netherite axe, named in bold)', RT().wave == 3 && waveMobs(3).length == 4 && !!senior() &&
  /"text":"Senior Inspector","color":"gold","italic":false,"bold":true/.test(senior().nbt) && /netherite_axe/.test(senior().nbt) && senior().health == 150 && said(carol, /a Senior Inspector at their head/))
ok('... with Resistance and his own boss bar', cmds.indexOf('effect give @e[tag=shrine_senior] minecraft:resistance infinite 0 true') >= 0 && cmds.some(c => /^bossbar add trollcraft:shrine_senior .*Senior Inspector/.test(c)))
ok('... the last wave: no more come after it', (advance(20 * 200), RT().wave == 3))
senior().health = 70
cmds = []
advance(20)
ok('at half health he calls two Inspectors to help, once', riteMobsNow().filter(m => m.tags.indexOf('shrine_senior') < 0 && /diamond/.test(m.nbt)).length == 5 && said(carol, /calls for assistance/) &&
  cmds.indexOf('bossbar set trollcraft:shrine_senior value 70') >= 0)
advance(40)
ok('... only once', riteMobsNow().length == 6)
cmds = []
kill(senior())
advance(20)
ok('the Senior Inspector falls: 8 potatoes, his bar goes, and those present are told', cmds.some(c => /summon minecraft:item .*Count:8b/.test(c)) && cmds.indexOf('bossbar remove trollcraft:shrine_senior') >= 0 &&
  said(carol, /The Senior Inspector falls/))
// the potatoes: only the altar takes them
carol.slots[0] = kings(6); carol.slots[5] = kings(2)
let ce = { player: carol, item: carol.slots[0], cancelled: false, cancel() { ce.cancelled = true; throw EXIT } }
;(handlers.itemRightClicked || []).forEach(h => { try { h(ce) } catch (e) { if (e !== EXIT) throw e } })
ok('a Potato King\'s Potato can\'t be eaten', ce.cancelled && said(carol, /Only the Shrine's altar will take these/))
const clickBlock = (p, x, y, z) => { const e = { player: p, item: p.slots[0], hand: 'MAIN_HAND', block: { level, x, y, z }, server, cancelled: false, cancel() { e.cancelled = true; throw EXIT } }
  ;(handlers.blockRightClicked || []).forEach(h => { try { h(e) } catch (err) { if (err !== EXIT) throw err } }); return e.cancelled }
ok('... or planted (a right-click on any other block)', clickBlock(carol, 990, 63, 1990) && kingsCarried(carol) == 8)
cmds = []
players.forEach(p => { p.msgs = [] })
ok('right-clicking the altar\'s lectern offers every one Carol carries (8)', clickBlock(carol, 1007, 86, 1999) && kingsCarried(carol) == 0 && RT().total == 8 && RT().offered['carol-uuid'].n == 8 &&
  said(bob, /Carol offers 8 Potato King's Potatoes at the altar\. 8 of 16\./))
ok('... half the bar: the statue\'s first two bands light up (light blocks where there\'s air, flames rising)', RT().lit == 2 &&
  cmds.some(c => /run setblock \d+ (6[4-9]|7\d|8\d|9[0-5]) \d+ minecraft:light\[level=15\]$/.test(c)) && !cmds.some(c => /run setblock \d+ (9[6-9]|1[0-2]\d) \d+ minecraft:light/.test(c)) &&
  cmds.filter(c => /particle minecraft:flame .* 8 [\d.]+ 8 0\.03 300 force/.test(c)).length == 2)
ok('... the bar shows 8 / 16', cmds.some(c => /^bossbar set trollcraft:shrine_rite name .*8 \/ 16 potatoes/.test(c)))
// knockouts while the rite is on
carol.health = 0; carol.x = 1000.5; carol.y = 90; carol.z = 2000.5; carol.fire = 5; carol.msgs = []
ok('a pilgrim at the Shrine who would die is knocked down instead: the death is cancelled', dies(carol, 'mob'))
ok('... healed, fire out, set down at the Shrine\'s edge with a few seconds of Resistance', carol.health == 20 && carol.fire == 0 && (carol.x > 1020 || carol.x < 979 || carol.z > 2021 || carol.z < 1979) &&
  cmds.indexOf('effect give Carol minecraft:resistance 3 4 true') >= 0 && said(carol, /you wake at its edge/), [carol.x, carol.y, carol.z].join(' '))
ok('... on the ground, under the steps (the east edge, 1024 2000), not on them', carol.x == 1024.5 && carol.z == 2000.5 && carol.y == 64 && world['1024,78,2000'] == 'minecraft:barrier',
  [carol.x, carol.y, carol.z].join(' '))
ok('... the log says what would have killed her, and where she woke', logs.some(l => l == '[Shrine] Knockout: Carol (mob), woken at the Shrine\'s edge'))
ok('... someone dying far from the Shrine dies as usual; /kill still kills', !dies(far, 'mob') && !dies(bob, 'genericKill'))
// Bob fills the altar at Technoblade's head
bob.slots[0] = kings(10)
players.forEach(p => { p.msgs = [] })
cmds = []
clickBlock(bob, 1007, 87, 1999)
ok('Bob offers 10 at the head: 18 of 16, the altar is full', RT().total == 18 && RT().state == 'full' && RT().offered['bob-uuid'].n == 10)
ok('... the last bands catch: the Shrine burns to its crown', RT().lit == 4 && cmds.some(c => /run setblock \d+ 1[0-2]\d \d+ minecraft:light\[level=15\]$/.test(c)) && said(carol, /The Shrine burns from its feet to its crown/))
ok('... the op is told: /shrine awaken', said(admin, /The altar is full\. When you're ready: \/shrine awaken/) && !said(carol, /shrine awaken/))
ok('... the bar says so, and no more waves come', cmds.some(c => /^bossbar set trollcraft:shrine_rite name .*The Shrine burns to its crown/.test(c)) && (advance(20 * 200), RT().wave == 3))
ok('status: the altar is full', /The Ignition Rite: the altar is full \(18 of 16\)\. \/shrine awaken\./.test(cmd('status', admin)[7]), cmd('status', admin)[7])
// the Awakening ends the rite: leftovers crumble, the Inspectors go
carol.slots[3] = kings(3)
cmds = []
r = cmd('awaken', admin)
advance(2)
ok('/shrine awaken (no force needed now): the leftover potatoes crumble, in pockets and on the ground', /The Awakening begins/.test(r[0]) && kingsCarried(carol) == 0 && said(carol, /crumble to dust/) &&
  cmds.indexOf('kill @e[type=minecraft:item,nbt={Item:{tag:{trollcraft:{kingspotato:1b}}}}]') >= 0, r[0])
ok('... the rite is done: its Inspectors go, its bars go', RT().state == 'done' && riteMobsNow().length == 0 && cmds.indexOf('bossbar remove trollcraft:shrine_rite') >= 0 && !riteOnNow())
ok('... no knockouts once it\'s done', !dies(carol, 'mob'))
advance(1000)
ok('the Awakening finishes after the rite (the shares by potatoes offered are checked with a Pool below)', S().awake.state == 'done' && S().rite.offered['bob-uuid'].n == 10)
cmd('reset confirm', admin); advance(40)
ok('the reset forgets the rite', RT().state == 'none' && RT().total == 0)
admin.creative = false

// ---------- Stage 5: the Awakening, the Regalia book, /regalia ----------
// A stand-in Blood Pool: 66,000 Drops at Tier 2; Tier 3 opens at 120,000.
const pool = { drops: 66000, tier: 2, adds: [] }
global.BloodPool = { drops: () => pool.drops, tier: () => pool.tier, tiers: [{ tier: 1, drops: 20000 }, { tier: 2, drops: 60000 }, { tier: 3, drops: 120000 }],
  addDrops: (n, source, uuid, name) => { pool.drops += n; pool.adds.push({ n, source, uuid, name }) } }
const LECTERN = '1007,86,1999'                                   // the corner (979 64 1979) + (28, 22, 20)
const bookOf = () => worldNbt[LECTERN] || ''
const awakeTicks = 920
ok('/regalia before the Awakening: nothing named yet', /The Blood God has named nothing yet/.test(regalia(carol)[0]))
ok('/shrine awaken before the Shrine has risen: refused', /hasn't risen yet/.test(cmd('awaken', admin)[0]))
cmd('rise force', admin)
advance(layerTicks * 66 + 30)
ok('when the Shrine has risen, the altar\'s lectern is left empty (no hollow book)', S().rise.state == 'risen' && world[LECTERN] == 'minecraft:lectern[facing=east,has_book=false,powered=false]', world[LECTERN])
// who's there: Carol and Bob at the Shrine; Far and the op elsewhere; an Inspector still about
carol.x = 1010.5; carol.z = 2010.5; bob.x = 1030.5; bob.y = 64; bob.z = 2000.5; admin.x = 5000.5; admin.z = 5000.5
players.forEach(p => { p.msgs = [] })
const straggler = mob('minecraft:vindicator', 'MONSTER', 1040.5, 64, 2000.5, { tags: ['shrine_inspector', 'shrine_rite'], named: true }); mobs.push(straggler)
cmds = []
r = cmd('awaken force', admin)
ok('/shrine awaken: the tribute, the words, the book, the Pool and the vote, in about 46 seconds', /The Awakening begins/.test(r[0]) && /Tier 3 \(120,000 Drops\)/.test(r[0]) && /About 46 seconds/.test(r[0]), r[0])
advance(2)
ok('it begins: every Inspector left is taken away', straggler.discarded)
ok('... those present see "The Shrine awakens" and hear it; someone far away doesn\'t get the title', cmds.some(c => /^title Carol title .*The Shrine awakens/.test(c)) && cmds.some(c => /^title Bob title/.test(c)) && !cmds.some(c => /^title Far title/.test(c)))
ok('... the Techno Tribute for everyone at the Shrine, and a server-wide /superaura', cmds.indexOf('execute in minecraft:overworld positioned 1000.5 64 2000.5 run techno all @a[distance=..64]') >= 0 && cmds.indexOf('superaura @a') >= 0)
ok('... nothing said yet while the tribute plays', !said(carol, /BLOOD GOD/))
advance(560)
ok('then the Blood God speaks, to everyone online', said(carol, /\[BLOOD GOD\] You lit my fires\. You fed my Shrine\. You remembered\./) && said(far, /You lit my fires/))
advance(120)
ok('... and names the Regalia', said(far, /\[BLOOD GOD\] Eight things were mine\. They were scattered, stolen, forgotten\. Restore them here, and my name returns with them\./))
advance(80)
ok('the book appears on the altar\'s lectern', world[LECTERN] == 'minecraft:lectern[facing=east,has_book=true,powered=false]' && /id:"minecraft:written_book"/.test(bookOf()), world[LECTERN])
ok('... "The Regalia of the Blade", by the Blood God, 10 pages: the intro, one per relic, and the closing line', /title:'The Regalia of the Blade'/.test(bookOf()) && /author:'The Blood God'/.test(bookOf()) &&
  (bookOf().match(/'\["",/g) || []).length == 10, (bookOf().match(/'\["",/g) || []).length)
const pageTexts = (bookOf().match(/'(\[.*?\])'/g) || []).map(s => JSON.parse(s.slice(1, -1).replace(/\\'/g, "'").replace(/\\\\/g, '\\')).map(x => (typeof x == 'string' ? x : x.text)).join(''))
ok('... the War Chest\'s page: what it honours, what it asks', pageTexts.some(t => /^THE WAR CHEST\n\nFor the Potato War, which I won\.\n\nFill it again: ten thousand potatoes\.$/.test(t)), pageTexts[1])
ok('... the Crown\'s page ends on what it asks; "When the Crown returns, so does my name." is the last page, on its own', /^THE CROWN OF THE BLADE[\s\S]*a shard of chaos\.$/.test(pageTexts[8]) &&
  pageTexts[9] == 'When the Crown returns, so does my name.', pageTexts[8] + ' || ' + pageTexts[9])
// A book page holds 14 lines, about 19 characters each (14 in bold capitals): on the test server, the Crown's page
// with the closing line ran to 15 and was cut off. This estimate, a little pessimistic, has to come out at 14 or fewer.
const pageLines = t => t.split('\n').reduce((n, para, i) => n + Math.max(1, Math.ceil(para.length / (i == 0 ? 14 : 19))), 0)
ok('... every page fits a book page: 14 lines or fewer, under 256 characters', pageTexts.length == 10 && pageTexts.every(t => pageLines(t) <= 14 && t.length < 256), pageTexts.map(pageLines).join(','))
ok('... (the estimate does catch the old Crown page, which was cut off)', pageLines(pageTexts[8] + '\n\n' + pageTexts[9]) > 14, pageLines(pageTexts[8] + '\n\n' + pageTexts[9]))
ok('... with sparkles and a page turning; everyone is told, with a [/regalia] to click', cmds.some(c => /particle minecraft:enchant 1007\.5 87 1999\.5/.test(c)) && said(far, /\[REGALIA\] The Regalia of the Blade lies on the Shrine's altar/) &&
  carol.msgs.some(m => /\[\/regalia\]/.test(m)))
r = regalia(carol)
ok('/regalia: the eight relics, none restored yet', /THE REGALIA OF THE BLADE {3}restored at the Shrine: 0 of 8/.test(r[0]) && r.length == 10 && /The War Chest {2}0 \/ 10,000 potatoes/.test(r[1]) &&
  /The Crown of the Blade {2}0 \/ 1 crown/.test(r[8]), r.slice(0, 3).join(' | '))
ok('global.Regalia: open, eight relics', global.Regalia.isOpen() && global.Regalia.relics.length == 8 && global.Regalia.progress('war_chest').have == 0)
advance(120)
ok('the Blood God: "The third seal is yours to break."', said(carol, /\[BLOOD GOD\] The third seal is yours to break\./))
advance(40)
ok('the Pool is topped up to Tier 3\'s 120,000: 54,000 Drops, shared by those present (nobody offered potatoes)', pool.drops == 120000 && pool.adds.length == 2 &&
  pool.adds.every(a => a.source == 'shrine' && a.n == 27000) && pool.adds.map(a => a.name).sort().join() == 'Bob,Carol', JSON.stringify(pool.adds))
ok('... and those present are asked to break the third seal, with a [/bloodpool vote] to click', carol.msgs.some(m => /break the third seal together/.test(m)) && !said(far, /break the third seal together/))
ok('the Awakening is done; status says so, with who was credited', S().awake.state == 'done' && global.Shrine.awakened() && /The Awakening: done\. The Regalia is open; Drops credited: (Carol 27,000, Bob 27,000|Bob 27,000, Carol 27,000)/.test(cmd('status', admin)[8]), cmd('status', admin)[8])
ok('/shrine awaken again: refused', /already awakened/.test(cmd('awaken', admin)[0]))
// someone takes the book from the lectern
world[LECTERN] = 'minecraft:lectern[facing=east,has_book=false,powered=false]'; delete worldNbt[LECTERN]
advance(100)
ok('a book taken from the altar is put back within 5 seconds', world[LECTERN] == 'minecraft:lectern[facing=east,has_book=true,powered=false]' && /The Regalia of the Blade/.test(bookOf()))
// the Shrine can't be broken (as happened on the test server: the lectern and the head, by an op in creative)
function blockEvent(name, p, x, y, z) {
  const e = { block: { level, x, y, z }, player: p, cancelled: false, cancel() { e.cancelled = true; throw EXIT } }
  ;(handlers[name] || []).forEach(h => { try { h(e) } catch (err) { if (err !== EXIT) throw err } })
  return e.cancelled
}
carol.msgs = []
ok('a player can\'t break the Shrine, or build on it', blockEvent('broken', carol, 990, 70, 1990) && blockEvent('placed', carol, 1000, 90, 2000) && said(carol, /The Shrine will not be changed/))
ok('... outside its box, anything goes', !blockEvent('broken', carol, 970, 70, 1990) && !blockEvent('broken', carol, 990, 63, 1990))
admin.creative = true
ok('an op in creative can change the Shrine\'s other blocks', !blockEvent('broken', admin, 990, 70, 1990))
ok('... but not the altar: the lectern and Technoblade\'s head stay, even in creative', blockEvent('broken', admin, 1007, 86, 1999) && blockEvent('broken', admin, 1007, 87, 1999) &&
  said(admin, /The altar will not move\. \(An op's \/shrine repair puts the Shrine back\.\)/))
admin.creative = false
let blasted = false
;(handlers.afterExplosion || []).forEach(h => h({ x: 1000.3, y: 80.5, z: 2000.6, level, removeAllAffectedBlocks: () => { blasted = true } }))
ok('an explosion in the Shrine breaks none of its blocks', blasted)
blasted = false
;(handlers.afterExplosion || []).forEach(h => h({ x: 900.3, y: 80.5, z: 2000.6, level, removeAllAffectedBlocks: () => { blasted = true } }))
ok('... one outside it is left alone', !blasted)
// /shrine repair
cmds = []
delete world[LECTERN]; delete worldNbt[LECTERN]
r = cmd('repair', admin)
ok('/shrine repair places every layer again over the Shrine (nothing cleared), then puts the book back on the altar', /put back as it was built/.test(r[0]) &&
  cmds.filter(c => /run place template trollcraft:shrine\/l_\d+ 979 \d+ 1979$/.test(c)).length == 64 && !cmds.some(c => /run fill .* minecraft:air$/.test(c)) &&
  world[LECTERN] == 'minecraft:lectern[facing=east,has_book=true,powered=false]' && /The Regalia of the Blade/.test(bookOf()), r[0])
ok('... with its chunks loaded for it, and let go after', cmds.indexOf('execute in minecraft:overworld run forceload add 979 1979 1020 2021') >= 0 && cmds.indexOf('execute in minecraft:overworld run forceload remove 979 1979 1020 2021') >= 0)

// a second night (test server): the potatoes offered decide the shares, and a /reload mid-way carries on
cmd('reset confirm', admin); advance(40)
ok('the reset forgets the Awakening and closes the Regalia', S().awake.state == 'none' && !global.Regalia.isOpen() && /named nothing yet/.test(regalia(carol)[0]))
cmd('rise force', admin); advance(layerTicks * 66 + 30)
const saved = JSON.parse(persistent.shrine)
saved.rite.offered = { 'carol-uuid': { name: 'Carol', n: 30 }, 'bob-uuid': { name: 'Bob', n: 10 } }
persistent.shrine = JSON.stringify(saved)
load()
pool.drops = 70000; pool.adds = []
far.msgs = []
cmd('awaken force', admin)
advance(600)
load()                                            // a /reload just after the first words
advance(awakeTicks)
ok('a /reload mid-Awakening carries on from the next step: nothing said twice', far.msgs.filter(m => /You lit my fires/.test(m)).length == 1 && far.msgs.filter(m => /Eight things were mine/.test(m)).length == 1 &&
  S().awake.state == 'done', far.msgs.length)
ok('... the potatoes offered decide the shares: Carol 30, Bob 10 of 50,000 Drops', pool.drops == 120000 && pool.adds.find(a => a.name == 'Carol').n == 37500 && pool.adds.find(a => a.name == 'Bob').n == 12500, JSON.stringify(pool.adds))
// a third night with the Pool already past Tier 3 and open: no Drops, no vote prompt
// (this night begins with the braziers: the event runs from them to the Awakening's end)
cmd('reset confirm', admin); advance(40)
cmd('braziers', admin); advance(2)
ok('a night begun with /shrine braziers: the event is on', global.Shrine.eventOn())
cmd('rise force', admin); advance(layerTicks * 66 + 30)
ok('... still on once the Shrine has risen (and the fires\' stage is done)', global.Shrine.eventOn() && S().fires.state == 'done')
pool.drops = 130000; pool.tier = 3; pool.adds = []; carol.msgs = []
cmd('awaken force', admin)
advance(awakeTicks - 20)
ok('... and through the Awakening', global.Shrine.eventOn() && S().awake.state == 'running')
advance(25)
ok('with the Pool already past Tier 3 and open: no Drops added, no vote asked for', pool.adds.length == 0 && !carol.msgs.some(m => /break the third seal/.test(m)) && S().awake.state == 'done')
ok('the Awakening done, the event ends: deaths are deaths again, and the Purge and the arena may run', !global.Shrine.eventOn() && global.Shrine.busy() == '' &&
  (carol.health = 0, !fall(carol, 'mob')) && logs.some(l => /The event is over/.test(l)))
// and with no Blood Pool at all
cmd('reset confirm', admin); advance(40)
cmd('rise force', admin); advance(layerTicks * 66 + 30)
const keepPool = global.BloodPool
delete global.BloodPool
cmd('awaken force', admin); advance(awakeTicks + 5)
ok('without the Blood Pool script: the Awakening still runs, and the log says no Drops were added', S().awake.state == 'done' && logs.some(l => /No Blood Pool: the Awakening adds no Drops/.test(l)) && /\[BLOOD GOD\]/.test(far.msgs.join('\n')))
global.BloodPool = keepPool
cmd('reset confirm', admin); advance(40)
// the saved data survives a reload
load()
ok('the sites survive a /reload', S().site.x == 1000 && S().braziers[2].z == -300)
persistent.shrine = '{not json'
load()
ok('unreadable saved data: a copy is kept and it starts fresh', S().site == null && Object.keys(persistent).some(k => /^shrine_unreadable_/.test(k)) && logs.some(l => /could not be read/.test(l)))

console.log(logs.filter(l => /^ERR /.test(l) && !/Layer 23|could not be read/.test(l)).join('\n') || '(no unexpected errors logged)')
console.log(fails ? fails + ' FAILED' : 'ALL PASSED')
