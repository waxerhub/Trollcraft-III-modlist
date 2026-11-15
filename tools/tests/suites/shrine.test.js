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
// The ground: solid below y 64, open above.
const level = {
  dimension: { location: () => OW },
  getBlock: (x, y, z) => ({ id: y < 64 ? 'minecraft:grass_block' : 'minecraft:air' }),
  hasChunk: () => tick >= chunksAt,
  getSharedSpawnPos: () => ({ getX: () => 0, getY: () => 64, getZ: () => 0 }),
}
const jlist = arr => ({ size: () => arr.length, get: i => arr[i], iterator() { let i = 0; return { hasNext: () => i < arr.length, next: () => arr[i++] } } })
function textOf(c) { return Array.isArray(c) ? c.map(x => (typeof x == 'string' ? x : x.text || '')).join('') : String(c) }
const players = []
function player(name, x, y, z, op) {
  const p = { name, op: !!op, x, y, z, msgs: [], level, isPlayer: () => true, getGameProfile: () => ({ getName: () => name }),
    getX: () => p.x, getY: () => p.y, getZ: () => p.z, tell: c => p.msgs.push(textOf(c)) }
  players.push(p)
  return p
}
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
    discard: () => { m.discarded = true } }
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
    return 1
  },
}
// KubeJS events and commands
let handlers = {}, cmdTree = null
const on = name => h => { (handlers[name] = handlers[name] || []).push(h) }
const node = n => ({ n, ch: [], req: null, f: null, then(c) { this.ch.push(c); return this }, requires(f) { this.req = f; return this }, executes(f) { this.f = f; return this } })
const global = {}
let started = false
const Utils = { get server() { return started ? server : null } }
function RL(s) { this.s = s }
// Loads (or reloads) the script, as /reload does: fresh handlers and commands, the same saved data and globals.
function load() {
  handlers = {}
  new Function('ServerEvents', 'EntityEvents', 'Java', 'Utils', 'Text', 'console', 'global', src)(
    { loaded: on('loaded'), commandRegistry: h => h({ commands: { literal: node, argument: n => Object.assign(node(n), { arg: true }) }, arguments: { INTEGER: { create: () => 'int', getResult: (ctx, k) => ctx.args[k] } }, register: t => { cmdTree = t } }) },
    { spawned: on('spawned') },
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
    if (!next) { next = n.ch.find(c => c.arg); if (next) ctx.args[next.n] = Number(a) }
    if (!next) throw new Error('no command shrine ' + line)
    n = next
  }
  n.f(ctx)
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
global.Purge = { busy: () => 'a Purge is running' }
r = cmd('rise', admin)
ok('a Purge on: refused', /A Purge is on/.test(r[0]) && S().rise.state == 'none', r[0])
global.Purge = { busy: () => '' }
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
ok('... and nothing is waiting to run', queue.length == 0, queue.length)
ok('/shrine rise once risen: refused', /already risen/.test(cmd('rise', admin)[0]))
ok('status: risen', /The Shrine has risen, at 1000 64 2000/.test(cmd('status', admin)[4]))
ok('when it has risen, a zombie walled in on the way is taken away', walledIn.discarded && logs.some(l => /Took away 1 monster from the Shrine/.test(l)))
const lurker = mob('minecraft:husk', 'MONSTER', 990.5, 120, 2010.5); mobs.push(lurker)
const pet = mob('minecraft:zombie', 'MONSTER', 991.5, 120, 2010.5, { named: true }); mobs.push(pet)
r = cmd('clearmobs', admin)
ok('/shrine clearmobs takes away a monster standing in it, and leaves a named one', lurker.discarded && !pet.discarded && /Took away 1 monster/.test(r[0]), r[0])
ok('... and again: nothing left', /No monsters in the Shrine/.test(cmd('clearmobs', admin)[0]))

// ---------- the reset ----------
r = cmd('reset', admin)
ok('/shrine reset alone only explains (it needs confirm)', /reset confirm/.test(r[0]) && S().rise.state == 'risen')
cmds = []
bob.x = 1000.5; bob.y = 90; bob.z = 2000.5                        // on the Shrine
r = cmd('reset confirm', admin)
advance(2)
const fills = cmds.filter(c => /run fill /.test(c))
ok('/shrine reset confirm: four fills of air from the top, covering all 64 layers', fills.length == 4 && /fill 979 110 1979 1020 127 2021 minecraft:air/.test(fills[0]) && /fill 979 64 1979 1020 73 2021 minecraft:air/.test(fills[3]), fills.join('\n'))
ok('... each within fill\'s 32,768-block limit', fills.every(f => { const n = f.match(/fill (\S+) (\S+) (\S+) (\S+) (\S+) (\S+)/).slice(1).map(Number); return (n[3] - n[0] + 1) * (n[4] - n[1] + 1) * (n[5] - n[2] + 1) <= 32768 }))
ok('... Bob, standing on it, is moved off first', bob.x != 1000.5 || bob.z != 2000.5)
ok('... loose items in the box are removed', cmds.some(c => /kill @e\[type=minecraft:item,x=979,y=64,z=1979,dx=41,dy=64,dz=42\]/.test(c)))
ok('... the night is forgotten and the sites are kept', S().rise.state == 'none' && S().rise.next == 0 && S().site.x == 1000 && S().braziers[0].x == 1900 && !global.Shrine.risen())
ok('once it\'s taken down, monsters spawn there as usual again', !spawn(mob('minecraft:zombie', 'MONSTER', 1000.5, 64, 2000.5)))
ok('/shrine clearmobs with no Shrine: refused', /no Shrine standing/.test(cmd('clearmobs', admin)[0]))
r = cmd('reset confirm', admin)
ok('a reset with nothing built: nothing to take down', /Nothing was built/.test(r[0]))
// the saved data survives a reload
load()
ok('the sites survive a /reload', S().site.x == 1000 && S().braziers[2].z == -300)
persistent.shrine = '{not json'
load()
ok('unreadable saved data: a copy is kept and it starts fresh', S().site == null && Object.keys(persistent).some(k => /^shrine_unreadable_/.test(k)) && logs.some(l => /could not be read/.test(l)))

console.log(logs.filter(l => /^ERR /.test(l) && !/Layer 23|could not be read/.test(l)).join('\n') || '(no unexpected errors logged)')
console.log(fails ? fails + ' FAILED' : 'ALL PASSED')
