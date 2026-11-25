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
  // lightning for show (the Shrine's effects): each bolt made is kept in bolts
  createEntity: type => { const b = { type, visual: false, at: null, setVisualOnly(v) { b.visual = v }, moveTo(x, y, z) { b.at = [x, y, z] }, spawn() { bolts.push(b) } }; return b },
}
const bolts = []
const jlist = arr => ({ size: () => arr.length, get: i => arr[i], iterator() { let i = 0; return { hasNext: () => i < arr.length, next: () => arr[i++] } } })
function textOf(c) { return Array.isArray(c) ? c.map(x => (typeof x == 'string' ? x : x.text || '')).join('') : String(c) }
// Item stacks: an id, a count, (for the King's Potatoes) a marked tag, or (the night's kit, a player's belongings)
// SNBT, as KubeJS gives them; serializeNBT saves them whole, as the vault does.
// The tags the relics look for (as KubeJS's item.hasTag)
const ITEM_TAGS = { 'tconstruct:cobalt_ingot': ['forge:ingots/cobalt'], 'tconstruct:cobalt_block': ['forge:storage_blocks/cobalt'],
  'tconstruct:pig_iron_ingot': ['forge:ingots/pig_iron'], 'tconstruct:pig_iron_block': ['forge:storage_blocks/pig_iron'] }
function stack(id, count, marked, snbt) {
  const s = { id, count, marked: !!marked, snbt: snbt || null, isEmpty: () => s.count <= 0 || s.id == 'minecraft:air', getCount: () => s.count, shrink: n => { s.count = Math.max(0, s.count - n) },
    hasTag: t => (ITEM_TAGS[s.id] || []).indexOf(String(t)) >= 0,
    get nbt() { return s.marked ? { contains: k => k == 'trollcraft', getCompound: () => ({ contains: k => k == 'kingspotato' }) } : s.snbt },
    serializeNBT() { return JSON.stringify({ id: s.id, Count: s.count, marked: s.marked, tag: s.snbt }) } }
  return s
}
const kings = n => stack('minecraft:potato', n, true)
const Item = { of: (id, n, nbt) => stack(id, n == null ? 1 : n, false, nbt || null), get empty() { return stack('minecraft:air', 0) } }
const ItemStackClass = { of: j => { const o = JSON.parse(j); return stack(o.id, o.Count, o.marked, o.tag) } }
const NBT = { toTagCompound: s => s }
const vaultFiles = {}
const JsonIO = { write: (path, obj) => { vaultFiles[path] = JSON.parse(JSON.stringify(obj)) } }
const players = []
function player(name, x, y, z, op) {
  const slots = [], ender = []
  for (let i = 0; i < 41; i++) slots.push(stack('minecraft:air', 0))
  for (let i = 0; i < 27; i++) ender.push(stack('minecraft:air', 0))
  const p = { name, op: !!op, x, y, z, msgs: [], level, creative: false, spectator: false, isPlayer: () => true, getGameProfile: () => ({ getName: () => name }),
    getX: () => p.x, getY: () => p.y, getZ: () => p.z, tell: c => { p.msgs.push(textOf(c)); p.raw.push(c) }, raw: [],
    isCreative: () => p.creative, isSpectator: () => p.spectator, isAlive: () => true, getStringUuid: () => name.toLowerCase() + '-uuid',
    hasPermissions: () => p.op, health: 20, fire: 0, crouch: false, isCrouching: () => p.crouch, getHealth: () => p.health, hurtTime: 0, setHealth: h => { p.health = h }, getMaxHealth: () => 20, clearFire: () => { p.fire = 0 },
    inventory: { getItem: i => slots[i], setItem: (i, s) => { slots[i] = s }, getContainerSize: () => 41 }, slots, ender,
    getEnderChestInventory: () => ({ getItem: i => ender[i], setItem: (i, s) => { ender[i] = s }, getContainerSize: () => 27 }),
    give: s => { const i = slots.findIndex(x => x.isEmpty()); if (i >= 0) slots[i] = s },
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
    if ((m = c.match(/run tp (\S+) ([-\d.]+) ([-\d.]+) ([-\d.]+)(?: facing [-\d. ]+)?$/))) { const p = byName(m[1]); if (p) { p.x = +m[2]; p.y = +m[3]; p.z = +m[4] } return 1 }
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
    // /fill ... <block> replace air: that block wherever it's open (the viewing platform's barriers)
    if ((m = c.match(/run fill (-?\d+) (-?\d+) (-?\d+) (-?\d+) (-?\d+) (-?\d+) (\S+) replace air$/))) {
      const b = m.slice(1, 7).map(Number)
      for (let x = b[0]; x <= b[3]; x++) for (let y = b[1]; y <= b[4]; y++) for (let z = b[2]; z <= b[5]; z++) if (blockAt(x, y, z).id == 'minecraft:air') world[x + ',' + y + ',' + z] = m[7]
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
  new Function('ServerEvents', 'PlayerEvents', 'EntityEvents', 'BlockEvents', 'LevelEvents', 'ItemEvents', 'Java', 'Utils', 'Text', 'Item', 'NBT', 'JsonIO', 'console', 'global', src)(
    { loaded: on('loaded'), commandRegistry: h => h({ commands: { literal: node, argument: (n, t) => Object.assign(node(n), { arg: true, type: t }) },
      arguments: { INTEGER: { create: () => 'int', getResult: (ctx, k) => ctx.args[k] }, PLAYER: { create: () => 'player', getResult: (ctx, k) => ctx.args[k] } }, register: t => { roots[t.n] = t; cmdTree = roots.shrine || t } }) },
    { loggedIn: on('loggedIn'), respawned: on('respawned') },
    { spawned: on('spawned'), death: on('death') },
    { broken: on('broken'), placed: on('placed'), rightClicked: on('blockRightClicked') },
    { afterExplosion: on('afterExplosion') },
    { rightClicked: on('itemRightClicked') },
    { loadClass: n => {
      if (/Component\$Serializer/.test(n)) return { fromJsonLenient: j => JSON.parse(j) }
      if (/ResourceLocation/.test(n)) return RL
      if (/world\.item\.ItemStack$/.test(n)) return ItemStackClass
      throw new Error('no class ' + n)
    } },
    Utils, { of: s => s }, Item, NBT, JsonIO,
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
const layerTicks = Number(src.match(/const LAYER_TICKS = (\d+)/)[1])   // 14 since 2026-11-21 (a 45-second rise)

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
ok('/shrine rise before the Awakening: refused, the Shrine rises last (force goes ahead)', /The Shrine rises last/.test(r[0]) && /\/shrine rise force raises it anyway/.test(r[0]) && S().rise.state == 'none' && placed().length == 0, r[0])
r = cmd('rise force', admin)
ok('/shrine rise: 64 layers in about 45 seconds', /64 layers in about 45 seconds\./.test(r[0]) && S().rise.state == 'rising', r[0])
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
ok('the next layer comes 14 ticks later (LAYER_TICKS: a 45-second rise), one block up', placed().join() == '0,1' && cmds.some(c => / place template trollcraft:shrine\/l_1 979 65 1979$/.test(c)))
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
// the pillars of fire round it, growing with it (owner, 2026-11-21: a 45-second rise, and "the major climax of the shrine
// being built would be fantastic")
const pillarsSeen = (from) => {
  const by = {}
  cmds.slice(from || 0).forEach(c => {
    const m = c.match(/^execute in minecraft:overworld run particle minecraft:flame (\S+) (\S+) (\S+) 0\.5 (\S+) 0\.5 0\.02 /)
    if (m) { const k = m[1] + ' ' + m[3]; (by[k] = by[k] || []).push({ mid: Number(m[2]), spread: Number(m[4]) }) }
  })
  return by
}
const pil = pillarsSeen(), pilSpots = Object.keys(pil)
ok('the rise: pillars of fire on a ring beyond its corners, each growing with the statue', pilSpots.length == 8 &&
  pilSpots.every(k => { const xz = k.split(' ').map(Number), d = Math.hypot(xz[0] - 1000.5, xz[1] - 2000.5); return d > 34 && d < 38 }) &&
  pilSpots.every(k => pil[k][pil[k].length - 1].mid > pil[k][0].mid + 5 && pil[k][pil[k].length - 1].spread > pil[k][0].spread), pilSpots.join(' | '))
ok('... pulsing twice a layer (every 7 ticks)', pilSpots.every(k => pil[k].length >= 40), pilSpots.map(k => pil[k].length).join())

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
const lastLayerAt = cmds.findIndex(c => / place template trollcraft:shrine\/l_63 /.test(c)), afterLast = cmds.slice(lastLayerAt)
ok('the last stone, the climax: every pillar roars to full height with blasts up it, the crown blasts, and a shockwave of fire rolls out from the base in rings',
  logs.some(l => /\[Shrine\] The rise's climax: 8 pillars of fire/.test(l)) && afterLast.filter(c => /particle minecraft:explosion [\d.]+ 99 [\d.]+ 0\.5 23\.3 0\.5 0 12 force/.test(c)).length == 8 &&
  afterLast.some(c => /particle minecraft:explosion_emitter 1000\.5 130 2000\.5 /.test(c)) && afterLast.some(c => /playsound minecraft:entity\.generic\.explode block @a 1000\.5 128 2000\.5 8 0\.6/.test(c)) &&
  [23.5, 27.5, 31.5, 35.5, 39.5].every(r => afterLast.some(c => c.indexOf('particle minecraft:flame ' + (1000.5 + r).toFixed(1) + ' 65 2000.5 0.4 0.2 0.4 0.03 6') >= 0)))
const fullAfter = pillarsSeen(lastLayerAt)
ok('... and the pillars burn on at full height after it (until the night ends)', Object.keys(fullAfter).length == 8 && Object.keys(fullAfter).every(k => fullAfter[k].filter(q => q.mid == 99).length >= 3),
  Object.keys(fullAfter).map(k => fullAfter[k].length).join())
// (owner, 2026-11-19: no Darkness; more fire, sparks and lightning instead)
const riseCorners = ['976.5,1976.5', '1023.5,1976.5', '1023.5,2024.5', '976.5,2024.5']
ok('... the ground shakes: flames along the layers, lava sparks, and with every wither\'s crunch a burst of fire and a bolt for show at a corner, in turn; no Darkness',
  bolts.length == 14 && bolts.slice(0, 8).every((b, i) => b.visual && b.at[0] + ',' + b.at[2] == riseCorners[i % 4] && b.at[1] == 64) &&
  cmds.some(c => /run particle minecraft:flame [\d.]+ [\d.]+ [\d.]+ 10 0\.2 10 /.test(c)) && cmds.some(c => /run particle minecraft:lava [\d.]+ [\d.]+ [\d.]+ 10 0\.3 10 /.test(c)) &&
  cmds.some(c => /run particle minecraft:flame [\d.]+ [\d.]+ [\d.]+ 12 0\.5 12 0\.06 250 /.test(c)) && !cmds.some(c => /darkness/.test(c)),
  bolts.map(b => b.at.join(',')).join(' '))
ok('... and lightning for show rings the Shrine as the head is placed', bolts.slice(8).every(b => b.visual && Math.abs(Math.hypot(b.at[0] - 1000.5, b.at[2] - 2000.5) - 28) < 1.5))
ok('... outside the night\'s event the sky is left alone (it\'s the whole Overworld\'s)', !cmds.some(c => /^time set|^weather/.test(c)) && !S().event.sky)
ok('... the forceload is removed', cmds.some(c => c == 'execute in minecraft:overworld run forceload remove 979 1979 1020 2021'))
ok('... and nothing is waiting to run but the steps\' glow and the kit\'s sweep', queue.length == 2, queue.length)
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
// lit as if someone knelt at it (since 2026-11-21 a brazier lights only that way: KINDLE); litByOther is any other way
const lightFire = b => global.Shrine.kindle(S().braziers.findIndex(x => x.x == b.x && x.z == b.z))
const litByOther = b => { world[fireKey(b)] = 'minecraft:campfire[lit=true,signal_fire=false]' }
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
// the night's kit (owner decisions at the rehearsal, 2026-11-19): Carol's own things are held; Bob carries something
// that can't be stored safely
const own = (id, n, snbt) => stack(id, n, false, snbt || null)
const kitOf = p => p.slots.filter(s => !s.isEmpty() && /ShrineKit:1b/.test(s.snbt || ''))
carol.slots[0] = own('minecraft:netherite_sword', 1, '{Damage:12}'); carol.slots[7] = own('minecraft:oak_log', 32); carol.slots[38] = own('minecraft:iron_chestplate', 1)
const unsavable = own('mod:odd_thing', 1); unsavable.serializeNBT = () => ''
bob.slots[3] = unsavable; bob.slots[4] = own('minecraft:bread', 5)
cmds = []
r = cmd('braziers', admin)
ok('/shrine braziers: all three go out, each with its place and direction', B().state == 'placed' && /1 at 1900 70 0 \(about 1900 blocks toward the rising sun\)/.test(r[0]) &&
  /within 45 seconds/.test(r[0]), r[0])
ok('... the event begins: every player online is brought to the start, and told', players.every(p => p.x == 5000.5 && p.y == 64 && p.z == 5000.5 && said(p, /The pilgrimage begins/)) &&
  global.Shrine.eventOn() && /Everyone is at the start \(5000 64 5000\), and the event is on/.test(r[0]), players.map(p => p.name + ' ' + p.x + ' ' + p.z).join(', '))
ok('... status: the start and the event', /The start: 5000 64 5000/.test(cmd('status', admin)[9]) && /The event: on/.test(cmd('status', admin)[10]), cmd('status', admin).slice(9).join(' | '))
ok('the night\'s kit: Carol has a diamond sword (Sharpness IV) and 16 steak (no flint and steel since the braziers are lit by kneeling), diamond armour on, a shield in her off hand, all the gear Unbreaking X',
  carol.slots[0].id == 'minecraft:diamond_sword' && /sharpness",lvl:4s/.test(carol.slots[0].snbt) && /unbreaking",lvl:10s/.test(carol.slots[0].snbt) &&
  carol.slots[1].id == 'minecraft:cooked_beef' && carol.slots[1].count == 16 && carol.slots[2].isEmpty() && carol.slots[39].id == 'minecraft:diamond_helmet' && carol.slots[38].id == 'minecraft:diamond_chestplate' &&
  carol.slots[37].id == 'minecraft:diamond_leggings' && carol.slots[36].id == 'minecraft:diamond_boots' && carol.slots[40].id == 'minecraft:shield' &&
  [36, 37, 38, 39, 40].every(i => /unbreaking",lvl:10s/.test(carol.slots[i].snbt)) && kitOf(carol).length == 7 && said(carol, /armed for the night/), carol.slots.filter(s => !s.isEmpty()).map(s => s.id).join())
ok('... her own things are held, in the saved data and a backup file; nothing is left with her but the kit',
  S().vaults['carol-uuid'].slots.map(s => s.id + '@' + s.slot).sort().join() == 'minecraft:iron_chestplate@38,minecraft:netherite_sword@0,minecraft:oak_log@7' &&
  !!vaultFiles['kubejs/shrine_vaults/Carol_carol-uuid.json'] && carol.slots.filter(s => !s.isEmpty()).length == 7)
ok('... the op in creative is left alone: no kit, nothing held', !S().vaults['admin-uuid'] && kitOf(admin).length == 0)
ok('... an item that can\'t be stored safely: Bob keeps his own gear, and the op is told', !S().vaults['bob-uuid'] && bob.slots[4].id == 'minecraft:bread' && kitOf(bob).length == 0 &&
  said(bob, /you fight in your own gear tonight/) && said(admin, /Bob fights in their own gear/))
ok('... status lists whose belongings are held', /The kit: belongings held for .*Carol.*\(handed back when the Awakening ends\)/.test(cmd('status', admin)[13]), cmd('status', admin)[13])
// Ivy joins mid-event: armed on arrival; then she logs out, still in the kit
const ivy = player('Ivy', 0.5, 64, 0.5)
ivy.slots[2] = own('minecraft:diamond', 9)
;(handlers.loggedIn || []).forEach(h => h({ player: ivy }))
advance(100)
ok('someone joining mid-event is armed when they arrive, their own things held', ivy.slots[0].id == 'minecraft:diamond_sword' && S().vaults['ivy-uuid'].slots[0].id == 'minecraft:diamond')
players.splice(players.indexOf(ivy), 1)
// Jay is in creative when he joins (no kit), then switches to survival: the next sweep arms him. At the fifth run
// (2026-11-20) the owner, in creative at /shrine braziers, never got the kit and was knocked out over and over.
const jay = player('Jay', 0.5, 64, 0.5)
jay.creative = true
jay.slots[3] = own('minecraft:emerald', 5)
;(handlers.loggedIn || []).forEach(h => h({ player: jay }))
advance(100)
ok('someone in creative mid-event isn\'t armed, nothing held', kitOf(jay).length == 0 && !S().vaults['jay-uuid'])
const bobRefusals = () => bob.msgs.filter(m => /fight in your own gear/.test(m)).length, bobBefore = bobRefusals()
jay.creative = false
advance(200)
ok('... switching to survival, he\'s armed at the next sweep (every 10 seconds), his own things held', kitOf(jay).length == 7 && said(jay, /armed for the night/) &&
  S().vaults['jay-uuid'].slots.some(s => s.id == 'minecraft:emerald'))
advance(400)
ok('... and Bob, whose things couldn\'t be held, isn\'t told again at every sweep', bobRefusals() == bobBefore, bobRefusals() + ' vs ' + bobBefore)
players.splice(players.indexOf(jay), 1)
// the opening (owner decisions 2026-11-20: fires on the horizon and an Inspector broadcast, about 30 seconds, nobody held),
// all 800 ticks of it played by now
const titleCmds = cmds.filter(c => /^title Carol (title|subtitle) /.test(c))
ok('the opening: "THE PILGRIMAGE" on everyone\'s screen, with a bell', titleCmds.some(c => /title Carol title .*THE PILGRIMAGE/.test(c)) &&
  titleCmds.some(c => /Three fires must burn as one/.test(c)) && cmds.some(c => /^execute as Carol at @s run playsound minecraft:block\.bell\.use/.test(c)), titleCmds.slice(0, 4).join(' | '))
ok('... then each fire by name, with its distance and direction from the start', ['The first fire', 'The second fire', 'The third fire'].every(n => titleCmds.some(c => c.indexOf(n) >= 0)) &&
  titleCmds.filter(c => /subtitle .*about \d+ blocks (north|south|toward|north-|south-)/.test(c)).length >= 3, titleCmds.join(' | '))
ok('... lightning on each brazier, only for show', [b1, b2, b3].every(b => bolts.some(x => x.visual && x.at[0] == b.x + 0.5 && x.at[2] == b.z + 0.5)))
ok('... thunder from each fire\'s direction, for each player', [b1, b2, b3].every(b => cmds.indexOf('execute as Carol at @s facing ' + (b.x + 0.5) + ' ' + (b.y + 1) + ' ' + (b.z + 0.5) +
  ' run playsound minecraft:entity.lightning_bolt.thunder master @s ^ ^ ^16 3 0.8') >= 0))
const pillars = cmds.map(c => c.match(/^execute in minecraft:overworld run particle minecraft:flame (\S+) (\S+) (\S+) 0\.4 10 0\.4/)).filter(m => m).map(m => ({ x: Number(m[1]), z: Number(m[3]) }))
const fromStart = q => Math.sqrt(Math.pow(q.x - 5000.5, 2) + Math.pow(q.z - 5000.5, 2))
ok('... the fires are thousands of blocks away, so each flares on the horizon toward it, 96 blocks out, and over the brazier itself',
  [b1, b2, b3].every(b => pillars.some(q => Math.abs(fromStart(q) - 96) < 0.01 && Math.abs(Math.atan2(q.x - 5000.5, q.z - 5000.5) - Math.atan2(b.x - 5000, b.z - 5000)) < 0.01) &&
    pillars.some(q => q.x == b.x + 0.5 && q.z == b.z + 0.5)), pillars.length + ' pillars')
const heard = carol.msgs.filter(m => /^\[INTERCEPTED\]/.test(m))
ok('... then the Inspectors\' channel, overheard: three scrambled lines to each player', heard.length == 3 && /unregistered gathering at the castle/.test(heard[0]) &&
  /No fire is to be lit/.test(heard[1]) && /Inspectors to every site/.test(heard[2]) && carol.raw.some(c => JSON.stringify(c).indexOf('"obfuscated":true') >= 0), heard.join(' | '))
ok('... never through tellraw (Discord), and nobody is told the Ministry\'s name', !cmds.some(c => /^tellraw @a/.test(c)) && !players.some(p => p.msgs.some(m => /Ministry/i.test(m))))
ok('at the start each player gets the fires\' coordinates, how far and which way, and how to light them (owner, 2026-11-21: "in case the fires are out of view distance")',
  said(carol, /^The three fires wait at:$/) && carol.msgs.some(m => /^  The first fire: 1900 70 0 \(about \d+ blocks (north|south|toward)/.test(m)) &&
  carol.msgs.some(m => /^  The third fire: /.test(m)) && said(carol, /Kneel at a fire to light it: hold sneak beside it for a second and a half without being hurt. All three must burn within 45 seconds/),
  carol.msgs.filter(m => /fire/.test(m)).join(' | '))
ok('... and Ivy, joining while they\'re out, gets them too', said(ivy, /^The three fires wait at:$/) && ivy.msgs.some(m => /^  The second fire: /.test(m)))
ok('the fires flare again every 30 seconds after the start (the first time at 30 seconds, after the opening)', [b1, b2, b3].every(b =>
  cmds.indexOf('execute in minecraft:overworld run playsound minecraft:entity.blaze.shoot block @a ' + (b.x + 0.5) + ' ' + (b.y + 1) + ' ' + (b.z + 0.5) + ' 4 0.5') >= 0))
ok('... and "Light the fires" ends it',titleCmds.some(c => /title Carol title .*Light the fires/.test(c)) && logs.some(l => /The opening is over/.test(l)))
ok('... nobody was held: /shrine stop after it has nothing of the opening to cut', !/opening/.test(cmd('stop', admin)[0]))
// Carol is /kill'ed (the kit drops) and respawns
for (let i = 0; i < 41; i++) carol.slots[i] = stack('minecraft:air', 0)
;(handlers.respawned || []).forEach(h => h({ player: carol }))
advance(3)
ok('/kill still kills, and back from it Carol has the kit again (her own things still held)', carol.slots[0].id == 'minecraft:diamond_sword' && kitOf(carol).length == 7 && !!S().vaults['carol-uuid'])
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
// her kit made new every 3rd knockout (owner, 2026-11-21: "kits need to be refreshed after every 3 knock outs"): she has
// eaten most of her steak, lost her shield, worn her sword, and carries a King's potato and something she picked up
const carolAt = [carol.x, carol.y, carol.z]
carol.slots[1].count = 3
carol.slots[40] = stack('minecraft:air', 0)
carol.slots[0].snbt = carol.slots[0].snbt.replace('{ShrineKit:1b,', '{ShrineKit:1b,Damage:900,')
carol.slots[5] = stack('minecraft:potato', 2, true); carol.slots[6] = stack('minecraft:string', 4)
carol.msgs = []
fall(carol, 'mob'); fall(carol, 'mob')
ok('two knockouts: the kit as it was', carol.slots[1].count == 3 && carol.slots[40].isEmpty() && /Damage:900/.test(carol.slots[0].snbt) && !said(carol, /kit is made new/))
fall(carol, 'mob')
ok('the third: her kit is made new, the steak a full 16 again, the sword whole, the lost shield back in her off hand, and she is told',
  carol.slots[1].id == 'minecraft:cooked_beef' && carol.slots[1].count == 16 && carol.slots[0].id == 'minecraft:diamond_sword' && !/Damage:900/.test(carol.slots[0].snbt) &&
  carol.slots[40].id == 'minecraft:shield' && /ShrineKit:1b/.test(carol.slots[40].snbt) && kitOf(carol).length == 7 &&
  said(carol, /Your kit is made new: whole again, and the steak restocked, with what you lost\./) && logs.some(l => /\[Shrine\] Kit made new for Carol \(knockout 3, 1 pieces put back\)/.test(l)),
  carol.slots.map((s, i) => s.isEmpty() ? '' : i + ':' + s.id + 'x' + s.count).filter(x => x).join(' '))
ok('... and what else she carries is untouched: the King\'s potatoes, and what she picked up', carol.slots[5].id == 'minecraft:potato' && carol.slots[5].count == 2 && carol.slots[5].marked &&
  carol.slots[6].id == 'minecraft:string' && carol.slots[6].count == 4)
fall(carol, 'mob'); fall(carol, 'mob')
ok('... the 4th and 5th knockouts don\'t, the 6th does', !logs.some(l => /Kit made new for Carol \(knockout [45]/.test(l)) && (fall(carol, 'mob'), logs.some(l => /Kit made new for Carol \(knockout 6\)/.test(l))))
carol.slots[5] = stack('minecraft:air', 0); carol.slots[6] = stack('minecraft:air', 0)
carol.x = carolAt[0]; carol.y = carolAt[1]; carol.z = carolAt[2]
// Waves at the braziers (owner decision at the fifth run's rerun, 2026-11-20: 7 to 8 players on the night, "Waves should
// continuously spawn"): while a brazier is unlit, a group every 20 seconds at the pilgrims within 40 blocks of it (made harder
// before release, 2026-11-21: 3 + 1 per pilgrim, at most 8 a wave and 16 up)
const atB2 = () => mobs.filter(m => !m.discarded && m.tags.indexOf('shrine_brazier_1') >= 0)
const spotsOf = ms => ms.map(m => m.x + ' ' + m.y + ' ' + m.z).join(', ')
carol.x = b2.x + 20.5; carol.z = b2.z + 0.5; dave.x = b2.x - 15.5; dave.z = b2.z + 5.5; carol.msgs = []
advance(25)
ok('two pilgrims within 40 blocks of unlit brazier 2: a group comes at once, 3 + 1 for each of them, on the ground 6 to 12 blocks from the fire',
  atB2().length == 5 && atB2().every(m => { const d = Math.hypot(m.x - (b2.x + 0.5), m.z - (b2.z + 0.5)); return d >= 5.2 && d <= 12.8 && m.y == 64 && m.tags.indexOf('shrine_ambush') >= 0 }) &&
  said(carol, /More Inspectors close in on the fire/) && logs.some(l => /\[Shrine\] Brazier 2 wave: 5 Inspectors for 2 near \(/.test(l)), spotsOf(atB2()))
seconds(15)
ok('... 15 seconds later, no more yet', atB2().length == 5)
seconds(6)
ok('... 20 seconds after the first, the next group', atB2().length == 10)
seconds(60 * 3)
ok('... they keep coming every 20 seconds until 16 of the fire\'s own are up (the last group tops it up), then wait', atB2().length == 16)
atB2().forEach(m => { m.discarded = true })
dave.x = 9000; carol.x = 1060.5; carol.z = 2000.5
seconds(40)
ok('... with nobody near, no more come', atB2().length == 0)
// lighting by kneeling (owner, 2026-11-21: "instead of flint and steel lighting them immediately players should have to
// shift for 2 seconds without taking damage to light them")
const daveHeld = dave.slots[0]
players.forEach(p => { p.msgs = [] })
dave.x = b2.x + 2.5; dave.y = b2.y + 1; dave.z = b2.z + 0.5
dave.slots[0] = stack('minecraft:flint_and_steel', 1)
const rightClickOn = (p, x, y, z) => { const e = { player: p, item: p.slots[0], hand: 'MAIN_HAND', block: { level, x, y, z }, server, cancelled: false, cancel() { e.cancelled = true; throw EXIT } }
  ;(handlers.blockRightClicked || []).forEach(h => { try { h(e) } catch (err) { if (err !== EXIT) throw err } }); return e.cancelled }
ok('flint and steel at a brazier: refused, and told how to light it', rightClickOn(dave, b2.x, b2.y + 1, b2.z) && said(dave, /won't take from that\. Kneel at a fire to light it: hold sneak beside it for a second and a half without being hurt./))
dave.slots[0] = daveHeld
litByOther(b2); advance(20)
ok('a brazier lit some other way (a flaming arrow) is put out, and those near are told how', fireOf(b2) == 'minecraft:campfire[lit=false,signal_fire=false]' && !B().lit[1] &&
  B().state == 'placed' && dave.msgs.filter(m => /won't take from that/.test(m)).length == 2)
cmds = []
advance(10)
ok('beside an unlit fire, not sneaking: the action bar says how', cmds.some(c => /^title Dave actionbar .*Hold sneak to kindle the second fire/.test(c)))
dave.crouch = true; cmds = []
advance(10)
ok('kneeling (sneaking within 3 blocks of it): the kindling fills on the action bar, with sparks; half a second in, not lit yet', !B().lit[1] &&
  cmds.some(c => /^title Dave actionbar .*Kindling the second fire/.test(c)) && cmds.some(c => /run particle minecraft:flame -499\.5 \S+ 10\.5 /.test(c)), cmds.filter(c => /Dave actionbar/.test(c)).slice(-1)[0])
dave.health -= 3
advance(5)
ok('... a blow scatters it: start again', cmds.some(c => /^title Dave actionbar .*Struck! The kindling scatters/.test(c)) && !B().lit[1])
advance(10)
ok('... half a second unhurt after it: not yet', !B().lit[1])
advance(50)
ok('... a second and a half unhurt: the fire takes, and counts as caught (1 of 3)', B().lit[1] && B().state == 'counting' && fireOf(b2) == 'minecraft:campfire[lit=true,signal_fire=false]' &&
  said(carol, /Far away, a fire catches\. 1 of 3/) && logs.some(l => /\[Shrine\] Dave kindled brazier 2/.test(l)) && cmds.some(c => /^title Dave actionbar .*The fire takes/.test(c)))
// every 30 seconds the unlit fires flare again; a lit one doesn't
cmds = []
advance(620)
const flareCmd = b => 'execute in minecraft:overworld run playsound minecraft:entity.blaze.shoot block @a ' + (b.x + 0.5) + ' ' + (b.y + 1) + ' ' + (b.z + 0.5) + ' 4 0.5'
ok('every 30 seconds each unlit fire flares again (its pillar and a roar), the lit one not', cmds.indexOf(flareCmd(b1)) >= 0 && cmds.indexOf(flareCmd(b3)) >= 0 &&
  cmds.indexOf(flareCmd(b2)) < 0 && cmds.some(c => c.indexOf('run particle minecraft:flame ' + (b1.x + 0.5) + ' ' + (b1.y + 13) + ' ' + (b1.z + 0.5) + ' 0.4 10 0.4') >= 0))
douse(b2); advance(20)
dave.crouch = false; dave.health = 20; dave.x = 9000
atB2().forEach(m => { m.discarded = true })
ok('... put out again before the others: back to waiting, none lit', B().state == 'placed' && !B().lit[1])

// lighting: one, two, then the clock runs out
players.forEach(p => { p.msgs = [] })
lightFire(b1)
advance(20)
ok('lighting one starts the clock: 1 of 3, and everyone is told', B().state == 'counting' && B().lit[0] && said(carol, /Far away, a fire catches\. 1 of 3\. The others have 45 seconds\./) && said(far, /1 of 3/))
ok('... a column of flame and smoke over it, and a roar everyone hears', cmds.some(c => /particle minecraft:flame 1900\.5 74 0\.5 0\.25 3 0\.25/.test(c)) &&
  cmds.some(c => /particle minecraft:campfire_signal_smoke 1900\.5 76 0\.5/.test(c)) && cmds.some(c => /^execute as Far at @s run playsound minecraft:entity\.blaze\.shoot/.test(c)))
bob.x = 3000.5; bob.z = 3000.5
ok('a knockout with a fire lit: woken beside it, 3 blocks east, on the ground', fall(bob, 'mob') && bob.x == 1903.5 && bob.y == 64 && bob.z == 0.5 && said(bob, /beside the last fire lit/),
  [bob.x, bob.y, bob.z].join(' '))
ok('... the boss bar shows the fires and the time left', cmds.some(c => /^bossbar set trollcraft:shrine_fires name .*The fires: 1 \/ 3.*0:4[45]/.test(c)) && cmds.some(c => c == 'bossbar set trollcraft:shrine_fires players @a'))
advance(100)
ok('... counting down', cmds.some(c => /^bossbar set trollcraft:shrine_fires name .*The fires: 1 \/ 3.*0:[34]\d/.test(c)) && /The fires: 1 of 3 lit, 0:[34]\d left/.test(cmd('status', admin)[5]), cmd('status', admin)[5])
lightFire(b2)
advance(20)
ok('a second: 2 of 3', B().lit[1] && said(carol, /Another fire catches\. 2 of 3/))
ok('... a knockout now wakes beside the second, the last one lit', fall(bob, 'arrow') && bob.x == -496.5 && bob.z == 10.5, [bob.x, bob.y, bob.z].join(' '))
advance(40)
ok('... a lit brazier sends no waves, even with a pilgrim beside it', atB2().length == 0)
// a /reload while the clock runs: the watch carries on
load()
seconds(45)
ok('after 45 seconds without the third, the lit ones gutter out (even across a /reload)', B().state == 'placed' && fireOf(b1) == 'minecraft:campfire[lit=false,signal_fire=false]' &&
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
ok('... and the brazier stage\'s Inspectors are driven off by the fires: the rite begins clean', inspectors().length == 0 && said(carol, /The Inspectors fall back from the fires/))
ok('... lightning for show strikes each brazier (a bolt that can\'t burn or hurt), and "THREE FIRES BURN" fills every screen',
  [b1, b2, b3].every(b => bolts.some(x => x.visual && x.at[0] == b.x + 0.5 && x.at[1] == b.y + 1 && x.at[2] == b.z + 0.5)) && bolts.every(x => x.visual) &&
  cmds.some(c => /^title Far title .*THREE FIRES BURN/.test(c)) && cmds.some(c => /^title Carol subtitle .*A red light rises over the Shrine/.test(c)), bolts.length)
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
ok('/shrine rise with the beam up but no Awakening yet: refused (the Shrine rises last)', /The Shrine rises last/.test(r[0]) && S().rise.state == 'none', r[0])
r = cmd('rise force', admin)
ok('/shrine rise force during the event: it rises, and the Shrine doesn\'t wait on itself (the Purge names it)', /64 layers in about 45 seconds/.test(r[0]), r[0])
ok('... during the event the sky turns to night and a storm rolls in', cmds.indexOf('time set midnight') >= 0 && cmds.indexOf('weather thunder 72000') >= 0 && S().event.sky)
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
ok('... the sky clears to day', cmds.indexOf('weather clear') >= 0 && cmds.indexOf('time set day') >= 0 && !S().event.sky)
ok('... and Carol\'s own things come back to the slots they were in; the kit is gone; the backup file says so',
  carol.slots[0].id == 'minecraft:netherite_sword' && carol.slots[0].snbt == '{Damage:12}' && carol.slots[7].id == 'minecraft:oak_log' && carol.slots[7].count == 32 &&
  carol.slots[38].id == 'minecraft:iron_chestplate' && kitOf(carol).length == 0 && !S().vaults['carol-uuid'] && !!vaultFiles['kubejs/shrine_vaults/Carol_carol-uuid.json'].restored &&
  said(carol, /Your own belongings are back/), carol.slots.filter(s => !s.isEmpty()).map(s => s.id).join())
ok('... Bob, who kept his own gear, still has it', bob.slots[3] === unsavable && bob.slots[4].id == 'minecraft:bread')
ok('... status: nobody\'s belongings are held but Ivy\'s and Jay\'s, who are offline', /The kit: belongings held for Ivy, Jay \(handed back when they're online\)/.test(cmd('status', admin)[13]), cmd('status', admin)[13])
players.push(ivy)
;(handlers.loggedIn || []).forEach(h => h({ player: ivy }))
advance(100)
ok('Ivy, offline when the night ended, gets her belongings back when she next joins', ivy.slots[2].id == 'minecraft:diamond' && ivy.slots[2].count == 9 && kitOf(ivy).length == 0 && !S().vaults['ivy-uuid'])
players.splice(players.indexOf(ivy), 1)
players.push(jay)
;(handlers.loggedIn || []).forEach(h => h({ player: jay }))
advance(100)
ok('... Jay too, armed late in the night', jay.slots[3].id == 'minecraft:emerald' && kitOf(jay).length == 0 && !S().vaults['jay-uuid'])
players.splice(players.indexOf(jay), 1)
// a kit item that got out (into Carol's ender chest): the sweep takes it back
carol.ender[4] = Item.of('minecraft:diamond_sword', 1, '{ShrineKit:1b}')
carol.msgs = []
advance(220)
ok('outside the night, a kit item found on a player (here in the ender chest) is taken back, and they\'re told', carol.ender[4].isEmpty() && said(carol, /The Shrine's kit stays with the night: 1 item taken back/))
bob.slots[3] = stack('minecraft:air', 0); bob.slots[4] = stack('minecraft:air', 0)

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
ok('/shrine rite with neither the beam up nor the Shrine risen: refused, the rite is fought around the beam', /The beam isn't up: the rite is fought around it/.test(cmd('rite', admin)[0]), cmd('rite', admin)[0])
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
// Every wave is led by a Senior Inspector, the only one carrying potatoes (owner decisions at the rehearsal, 2026-11-19).
const isSenior = m => m.tags.indexOf('shrine_senior') >= 0
const ordinary = i => waveMobs(i).filter(m => !isSenior(m))
const seniorOf = i => waveMobs(i).filter(isSenior)[0]
const carriesNothing = m => !m.tags.some(t => /^shrine_pot_/.test(t))
ok('the Inspectors\' ground: never on the steps, in a hill\'s cave or a lake; under leaves, the forest floor', ordinary(0).map(colOf).sort().join(' ') == '1002,64,2030 1025,64,1983 973,64,1987',
  ordinary(0).map(colOf).join(' '))
terrain.forEach(k => { delete world[k] })
ok('/shrine rite: 2 present (the op in creative doesn\'t count), so the altar needs 16 potatoes: at least 8 Senior Inspectors must fall',
  /2 present, so the altar needs 16 Potato King's Potatoes\. Waves come until it's full, led by Senior Inspectors who drop 2 each, more of them with every wave, so at least 8 must fall\./.test(r[0]) &&
  RT().state == 'running' && RT().need == 16, r[0])
ok('... wave 1: 3 Inspectors (1 per player, at least 3), in iron, seeing 64 blocks, carrying no potatoes', ordinary(0).length == 3 &&
  ordinary(0).every(m => /iron_chestplate/.test(m.nbt) && /generic\.follow_range",Base:64\.0d/.test(m.nbt) && carriesNothing(m) && m.tags.indexOf('shrine_inspector') >= 0))
ok('... and a Senior Inspector at their head, the only one carrying potatoes (2): 150 health, a netherite axe, named in bold', !!seniorOf(0) &&
  seniorOf(0).tags.indexOf('shrine_pot_2') >= 0 && /"text":"Senior Inspector","color":"gold","italic":false,"bold":true/.test(seniorOf(0).nbt) && /netherite_axe/.test(seniorOf(0).nbt) && seniorOf(0).health == 150)
ok('... with Resistance and his own boss bar, "Senior Inspector (wave 1)"', cmds.indexOf('effect give @e[tag=shrine_senior] minecraft:resistance infinite 0 true') >= 0 &&
  cmds.some(c => /^bossbar add trollcraft:shrine_senior_0 .*Senior Inspector \(wave 1\)/.test(c)) && Object.keys(RT().seniors).join() == '0')
ok('... on the land around the Shrine, 30 to 45 blocks from its centre', waveMobs(0).every(m => { const d = Math.hypot(m.x - 1000.5, m.z - 2000.5); return d >= 29 && d <= 46 }),
  waveMobs(0).map(m => Math.hypot(m.x - 1000.5, m.z - 2000.5).toFixed(0)).join(','))
ok('... those present are told what to do; someone far away isn\'t', said(carol, /Take the Potato King's Potatoes from the Senior Inspectors and offer them at the altar: 16 in all/) &&
  said(bob, /Wave 1: 4 Inspectors close in on the Shrine, a Senior Inspector at their head\./) && !said(far, /Wave 1/))
ok('... a horn sounds and "WAVE 1" fills the screens of those present', cmds.some(c => /^title Carol title .*WAVE 1/.test(c)) && cmds.some(c => /^title Bob subtitle .*A Senior Inspector leads them/.test(c)) &&
  cmds.some(c => /^execute as Bob at @s run playsound minecraft:event\.raid\.horn/.test(c)) && !cmds.some(c => /^title Far /.test(c)))
ok('... the rite\'s boss bar: 0 / 16 potatoes', cmds.some(c => /^bossbar set trollcraft:shrine_rite name .*The Ignition Rite: .*0 \/ 16 potatoes/.test(c)))
ok('/shrine awaken now: refused, the altar isn\'t full (force goes ahead)', /The altar isn't full yet \(0 of 16 potatoes\)\. \/shrine awaken force goes ahead anyway\./.test(cmd('awaken', admin)[0]))
ok('global.Shrine.busy(): the Purge and the arena wait', /Ignition Rite is on/.test(global.Shrine.busy()))
ok('/shrine rite again: already under way', /already under way \(wave 1\)/.test(cmd('rite', admin)[0]))
advance(20)
ok('the Inspectors go after the pilgrims at the Shrine (not the op in creative)', waveMobs(0).every(m => m.target === carol || m.target === bob))
// an ordinary Inspector of the rite dies: nothing
cmds = []
kill(ordinary(0)[0])
ok('an ordinary Inspector killed drops no potatoes', !cmds.some(c => /summon minecraft:item/.test(c)), cmds.filter(c => /summon minecraft:item/.test(c)).join('\n'))
// the next wave comes when three-quarters of the last are down (the Senior counts as one of them)
kill(ordinary(0)[0])
advance(20)
ok('with 2 of 4 down, no new wave yet', RT().wave == 0)
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
kill(ordinary(0)[0])
cmds = []
advance(20)
Math.random = random
ok('with 3 of 4 down (the Senior still up): wave 2, 3 Inspectors (1.5 per player), the vindicators with shields, led by its own Senior', RT().wave == 1 && ordinary(1).length == 3 &&
  ordinary(1).filter(m => m.type == 'minecraft:vindicator').every(m => /minecraft:shield/.test(m.nbt)) && !!seniorOf(1) && said(carol, /Wave 2: 4 Inspectors/))
ok('... with a lake over all the ring but one corner, every one still lands on dry ground there', waveMobs(1).every(m => m.x > 1002 && m.z > 2002 && m.y == 64) &&
  !logs.some(l => /No dry ground/.test(l)), waveMobs(1).map(m => m.x + ' ' + m.y + ' ' + m.z).join(', '))
ok('... two Senior Inspectors up at once, each with his own bar; status counts them', !!seniorOf(0) && Object.keys(RT().seniors).sort().join() == '0,1' &&
  cmds.some(c => /^bossbar add trollcraft:shrine_senior_1 .*Senior Inspector \(wave 2\)/.test(c)) && /The Ignition Rite: wave 2 \(2 Senior Inspectors up\)/.test(cmd('status', admin)[7]), cmd('status', admin)[7])
lake.forEach(k => { delete world[k] })
// /shrine stop pauses the rite; /shrine rite brings the wave back
cmds = []
r = cmd('stop', admin)
ok('/shrine stop pauses the rite: the waves stop, the Inspectors go (Seniors too), every bar goes, the altar keeps its count', /The rite is paused/.test(r[0]) && RT().state == 'paused' &&
  riteMobsNow().length == 0 && cmds.indexOf('bossbar remove trollcraft:shrine_rite') >= 0 && cmds.indexOf('bossbar remove trollcraft:shrine_senior_0') >= 0 &&
  cmds.indexOf('bossbar remove trollcraft:shrine_senior_1') >= 0 && Object.keys(RT().seniors).length == 0, r[0])
ok('... status says so', /The Ignition Rite: paused at wave 2/.test(cmd('status', admin)[7]), cmd('status', admin)[7])
r = cmd('rite', admin)
ok('/shrine rite carries on: wave 2 comes again, with its Senior', /wave 2 comes again/.test(r[0]) && RT().state == 'running' && ordinary(1).length == 3 && !!seniorOf(1) &&
  Object.keys(RT().seniors).join() == '1', r[0])
// a wave nobody clears: the next comes after 3 minutes anyway
seconds(181)
ok('after 3 minutes, wave 3 comes anyway: in diamond, with its Senior', RT().wave == 2 && ordinary(2).length == 3 && ordinary(2).every(m => /diamond_chestplate/.test(m.nbt)) && !!seniorOf(2))
seniorOf(2).health = 70
cmds = []
advance(20)
ok('at half health a Senior calls two Inspectors in diamond to help, once', ordinary(2).length == 5 && ordinary(2).every(m => /diamond/.test(m.nbt)) && said(carol, /calls for assistance/) &&
  cmds.indexOf('bossbar set trollcraft:shrine_senior_2 value 70') >= 0)
advance(40)
ok('... only once', ordinary(2).length == 5)
cmds = []
kill(ordinary(2)[4])
ok('... his helpers carry no potatoes either', !cmds.some(c => /summon minecraft:item/.test(c)))
cmds = []
players.forEach(p => { p.msgs = [] })
kill(seniorOf(2))
advance(20)
ok('a Senior Inspector falls: 2 Potato King\'s Potatoes, marked, named in gold, with a glint; his bar goes; those present are told',
  cmds.some(c => /run summon minecraft:item .*Count:2b,tag:\{trollcraft:\{kingspotato:1b\}.*Potato King\\'s Potato.*Enchantments/.test(c)) &&
  cmds.indexOf('bossbar remove trollcraft:shrine_senior_2') >= 0 && said(carol, /The Senior Inspector falls/), cmds.filter(c => /summon minecraft:item|shrine_senior/.test(c)).join('\n'))
ok('... in a burst of red', cmds.some(c => /run particle minecraft:dust 0\.8 0 0 2 /.test(c)) && cmds.some(c => /playsound minecraft:entity\.evoker\.death/.test(c)))
ok('... the other Senior still up keeps his bar', Object.keys(RT().seniors).join() == '1' && cmds.indexOf('bossbar remove trollcraft:shrine_senior_1') < 0)
// past the list of waves: they keep coming, like the last one
waveMobs(1).concat(waveMobs(2)).forEach(m => kill(m))
advance(20)
ok('the next wave once the last is down: wave 4, in diamond with shields', RT().wave == 3 && ordinary(3).length == 3 && ordinary(3).every(m => /diamond_chestplate/.test(m.nbt)) && !!seniorOf(3))
waveMobs(3).forEach(m => kill(m))
players.forEach(p => { p.msgs = [] })
advance(20)
ok('... and they keep coming past the list until the altar is full: wave 5, like the last, with its Senior', RT().wave == 4 && ordinary(4).length == 3 &&
  ordinary(4).filter(m => m.type == 'minecraft:vindicator').every(m => /diamond_chestplate/.test(m.nbt) && /minecraft:shield/.test(m.nbt)) && !!seniorOf(4) && said(carol, /Wave 5: 4 Inspectors/))
// a rite nobody fights: a wave every 3 minutes, until RITE_ALIVE_MAX (30) are up; then they wait
seconds(60 * 40)
const capped = RT().wave
seconds(60 * 10)
ok('a rite nobody fights: a wave every 3 minutes until 30 Inspectors are up, then no more', riteMobsNow().length >= 30 && riteMobsNow().length < 35 && RT().wave == capped && capped > 4,
  riteMobsNow().length + ' up, wave ' + (capped + 1))
riteMobsNow().forEach(m => kill(m))
// Nobody at the site (everyone gone, or the server restarted mid-rite): the rite waits. In game the Inspectors then sit
// in chunks nobody has loaded, out of the script's sight, which read as every wave beaten: on the test server
// (2026-11-20) 49 waves, 147 Inspectors, piled up with nobody online. Here no mob is up, as the script would see it.
const homes = players.map(p => [p.x, p.z]), waitWave = RT().wave
players.forEach(p => { p.x = 3000.5; p.z = 3000.5 })
seconds(60 * 10)
ok('nobody within 64 blocks of the site: no wave comes, however long', RT().wave == waitWave && riteMobsNow().length == 0, 'wave ' + (RT().wave + 1))
admin.x = 1000.5; admin.z = 2030.5
advance(20)
ok('... an op comes back (even in creative): the next wave comes', RT().wave == waitWave + 1 && riteMobsNow().length > 0)
players.forEach((p, k) => { p.x = homes[k][0]; p.z = homes[k][1] })
riteMobsNow().forEach(m => kill(m))
// A stray from an earlier night, loading with its chunk, is taken away before it can fight (fifth run, 2026-11-20: 16
// of run 4's Inspectors, five Seniors among them, in a lake 100 blocks off, a reset and a day later). This rite's own,
// loading again, stay.
const strayOf = tags => mob('minecraft:vindicator', 'MONSTER', 1100.5, 64, 2100.5, { tags: tags, named: true })
const oldSenior = strayOf(['shrine_inspector', 'shrine_rite', 'shrine_rs_12345', 'shrine_wave_9', 'shrine_senior', 'shrine_pot_8'])
cmds = []
ok('a stray Senior Inspector from an earlier rite, loading with its chunk: taken away, no potatoes dropped', spawn(oldSenior) && (advance(2), oldSenior.discarded) &&
  !cmds.some(c => /summon minecraft:item/.test(c)) && logs.some(l => /A stray Inspector from an earlier night, taken away as its chunk loaded/.test(l)))
const ownAgain = strayOf(['shrine_inspector', 'shrine_rite', 'shrine_rs_' + RT().serial, 'shrine_wave_' + RT().wave])
ok('... one of this rite\'s, loading again: it stays', RT().serial > 0 && !spawn(ownAgain))
ownAgain.discarded = true
ok('... an ambush Inspector from another night: taken away', spawn(strayOf(['shrine_inspector', 'shrine_ambush', 'shrine_ev_777'])))
advance(20)
ok('... and every Inspector the rite summons carries its rite\'s tag', riteMobsNow().length > 0 && riteMobsNow().every(m => m.tags.indexOf('shrine_rs_' + RT().serial) >= 0),
  riteMobsNow().map(m => m.tags.join('/')).join(' | '))
riteMobsNow().forEach(m => kill(m))
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
ok('... each band with a flash of flame up its height', cmds.filter(c => /run particle minecraft:flash /.test(c)).length == 2 && cmds.filter(c => /run particle minecraft:lava /.test(c)).length == 2)
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
const wFull = RT().wave
ok('... the bar says so, and no more waves come', cmds.some(c => /^bossbar set trollcraft:shrine_rite name .*The Shrine burns to its crown/.test(c)) && (advance(20 * 200), RT().wave == wFull))
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
ok('the Awakening finishes after the rite', S().awake.state == 'done' && S().rite.offered['bob-uuid'].n == 10)
cmd('reset confirm', admin); advance(40)
ok('the reset forgets the rite', RT().state == 'none' && RT().total == 0)
admin.creative = false

// ---------- Stage 5: the Awakening, the Regalia book, /regalia ----------
// A stand-in Blood Pool: 66,000 Drops at Tier 2. The Awakening raises it a quarter of the way from Tier 4 (200,000) to
// Tier 5 (320,000), 230,000 Drops, and opens the seals up to Tier 4 itself (owner decisions, 2026-11-19: no vote).
const pool = { drops: 66000, tier: 2, adds: [], opens: [] }
global.BloodPool = { drops: () => pool.drops, tier: () => pool.tier,
  tiers: [{ tier: 1, drops: 20000 }, { tier: 2, drops: 60000 }, { tier: 3, drops: 120000 }, { tier: 4, drops: 200000 }, { tier: 5, drops: 320000 }],
  addDrops: (n, source, uuid, name) => { pool.drops += n; pool.adds.push({ n, source, uuid, name, tierThen: pool.tier }) },
  openTo: (n, by) => { pool.opens.push({ n, by }); if (n > pool.tier) pool.tier = n; return pool.tier } }
const LECTERN = '1007,86,1999'                                   // the corner (979 64 1979) + (28, 22, 20)
const bookOf = () => worldNbt[LECTERN] || ''
const awakeTicks = 980                          // the Awakening, to its last step (the end, 3 seconds after his last words)
ok('/regalia before the Awakening: nothing named yet', /The Blood God has named nothing yet/.test(regalia(carol)[0]))
ok('/shrine awaken before the rite: refused (force goes ahead)', /The Ignition Rite hasn't been held/.test(cmd('awaken', admin)[0]), cmd('awaken', admin)[0])
cmd('rise force', admin)
advance(layerTicks * 66 + 30)
ok('when the Shrine has risen, the altar\'s lectern is left empty (no hollow book)', S().rise.state == 'risen' && world[LECTERN] == 'minecraft:lectern[facing=east,has_book=false,powered=false]', world[LECTERN])
// who's there: Carol and Bob at the Shrine; Far and the op elsewhere; an Inspector still about
carol.x = 1010.5; carol.z = 2010.5; bob.x = 1030.5; bob.y = 64; bob.z = 2000.5; admin.x = 5000.5; admin.z = 5000.5
players.forEach(p => { p.msgs = [] })
const straggler = mob('minecraft:vindicator', 'MONSTER', 1040.5, 64, 2000.5, { tags: ['shrine_inspector', 'shrine_rite'], named: true }); mobs.push(straggler)
cmds = []
const bolts0 = bolts.length
r = cmd('awaken force', admin)
ok('/shrine awaken: the tribute, the words and the book in about 49 seconds; when the night ends, the seals broken to Tier 4 (no vote) and the Pool raised to 230,000', /The Awakening begins/.test(r[0]) &&
  /When the night ends, the seals break up to Tier 4 \(no vote\) and the Pool is raised to 230,000 Drops, credited to nobody/.test(r[0]) && /about 49 seconds/.test(r[0]), r[0])
advance(2)
ok('it begins: every Inspector left is taken away', straggler.discarded)
ok('... those present see "The Shrine awakens" and hear it; someone far away doesn\'t get the title', cmds.some(c => /^title Carol title .*The Shrine awakens/.test(c)) && cmds.some(c => /^title Bob title/.test(c)) && !cmds.some(c => /^title Far title/.test(c)))
ok('... the Techno Tribute for everyone at the Shrine, and a server-wide /superaura', cmds.indexOf('execute in minecraft:overworld positioned 1000.5 64 2000.5 run techno all @a[distance=..64]') >= 0 && cmds.indexOf('superaura @a') >= 0)
ok('... nothing said yet while the tribute plays', !said(carol, /BLOOD GOD/))
advance(560)
ok('then the Blood God speaks, to everyone online', said(carol, /\[BLOOD GOD\] You lit my fires\. You fed my Shrine\. You remembered\./) && said(far, /You lit my fires/))
advance(120)
ok('... and names the Regalia', said(far, /\[BLOOD GOD\] Eight things were mine\. They were scattered, stolen, forgotten\. Restore them here, and my name returns with them\./))
ok('... the words also fill everyone\'s screen, a sentence at a time', ['You lit my fires.', 'You fed my Shrine.', 'You remembered.', 'Eight things were mine.'].every(t =>
  cmds.some(c => c.indexOf('title Far subtitle ' + JSON.stringify({ text: t, color: 'red' })) == 0)), cmds.filter(c => /^title Far subtitle/.test(c)).join(' | '))
ok('... with red fireworks bursting high over the Shrine', cmds.filter(c => /run summon minecraft:firework_rocket [\d.]+ 130 [\d.]+ .*Colors:\[I;16711680/.test(c)).length >= 6)
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
ok('... the Axe of Peace asks 1,000 blocks of cobalt, the Swine\'s Oath 128 blocks of pig iron (owner decisions 2026-11-20), in /regalia and the book',
  /The Axe of Peace {2}0 \/ 1,000 blocks of cobalt/.test(r[2]) && /The Swine's Oath {2}0 \/ 128 blocks of pig iron/.test(r[7]) &&
  pageTexts.some(t => /^THE AXE OF PEACE[\s\S]*Bring me the metal to forge its equal: a thousand blocks of cobalt\.$/.test(t)) &&
  pageTexts.some(t => /^THE SWINE'S OATH[\s\S]*Forge me pig iron, iron and blood made one: a hundred and twenty-eight blocks\.$/.test(t)), r[2] + ' | ' + r[7])
ok('global.Regalia: open, eight relics', global.Regalia.isOpen() && global.Regalia.relics.length == 8 && global.Regalia.progress('war_chest').have == 0)
advance(120)
ok('the Blood God: "I break the third seal, and the fourth with it. Blood for the Blood God."', said(carol, /\[BLOOD GOD\] I break the third seal, and the fourth with it\. Blood for the Blood God\./))
advance(40)
ok('... the seals crack, but the Pool waits for the night\'s end (its reload would stall the server mid-show; fifth run, 2026-11-20)', pool.drops == 66000 &&
  pool.adds.length == 0 && pool.opens.length == 0 && pool.tier == 2, JSON.stringify(pool))
const ringOf = r => bolts.slice(bolts0).filter(b => b.visual && Math.abs(Math.hypot(b.at[0] - 1000.5, b.at[2] - 2000.5) - r) < 1.5).length
ok('... as the seals break, lightning for show rings the Shrine (8 bolts), soul fire rises at its corners, and more fireworks',
  ringOf(26) == 8 && cmds.some(c => /run particle minecraft:soul_fire_flame /.test(c)) && cmds.filter(c => /summon minecraft:firework_rocket/.test(c)).length >= 15,
  ringOf(26) + ' bolts; fireworks ' + cmds.filter(c => /firework_rocket/.test(c)).length)
ok('... not over yet: a moment for his last words before everyone is let go', S().awake.state == 'running')
advance(60)
ok('the Awakening is done; status says so, with the Drops it added', S().awake.state == 'done' && global.Shrine.awakened() &&
  /The Awakening: done\. The Regalia is open; 164,000 Drops added, credited to nobody\./.test(cmd('status', admin)[8]), cmd('status', admin)[8])
// the Shrine stood already (raised first), so the night ends as the Awakening does, and the seals break then
ok('the night over, the Pool is raised to a quarter past Tier 4, 230,000: 164,000 Drops in one, credited to nobody (owner decision at the rehearsal, 2026-11-19)', pool.drops == 230000 &&
  pool.adds.length == 1 && pool.adds[0].n == 164000 && pool.adds[0].source == 'shrine' && pool.adds[0].uuid === '' && pool.adds[0].name === '' &&
  logs.some(l => /The Awakening added 164000 Drops, credited to nobody/.test(l)), JSON.stringify(pool.adds))
ok('... and the Shrine breaks the seals itself: Tiers 3 and 4 open, by "the Shrine"', pool.opens.length == 1 && pool.opens[0].n == 4 && pool.opens[0].by == 'the Shrine' &&
  pool.tier == 4 && logs.some(l => /The Awakening broke the seals: Tier 2 to 4/.test(l)), JSON.stringify(pool.opens))
ok('... the seals break before the Drops land, so the Pool never calls a vote on a tier about to open (rehearsal, 2026-11-19)', pool.adds.every(a => a.tierThen == 4), JSON.stringify(pool.adds))
ok('... no vote is asked for', !carol.msgs.some(m => /bloodpool vote|break the third seal together/.test(m)))
// While he speaks: "Fire particles, lightning, heart beats. The works" (owner, 2026-11-19)
const heartbeats = cmds.filter(c => /^execute as Far at @s run playsound minecraft:entity\.warden\.heartbeat/.test(c)).length
ok('while the Blood God speaks: a heartbeat everyone hears, every second (twice as fast on his last line), and a growl as each line begins',
  heartbeats == 6 + 8 + 8 && cmds.filter(c => /^execute as Far at @s run playsound minecraft:entity\.ender_dragon\.growl/.test(c)).length == 3, heartbeats)
ok('... a blood mist with each beat; with each sentence, fire up the statue, lava and soul fire from the head',
  cmds.filter(c => /run particle minecraft:dust 0\.6 0 0 2\.5 /.test(c)).length == 22 && cmds.filter(c => /run particle minecraft:flame 1000\.5 96 2000\.5 5 30 5 /.test(c)).length == 9 &&
  cmds.filter(c => /run particle minecraft:lava 1000\.5 128 2000\.5 /.test(c)).length == 9 && cmds.some(c => /run particle minecraft:soul_fire_flame 1000\.5 124 2000\.5 3 3 3 /.test(c)))
ok('... and two bolts for show with each sentence, in a ring beyond the seals\' (18 in all)', ringOf(34) == 18, ringOf(34))
ok('... and the Regalia\'s line now says what the relics are for: "With each one returned, I break another seal."',
  said(far, /Restore them here, and my name returns with them\. With each one returned, I break another seal\./))
ok('... his last words fill the screen: "BLOOD FOR THE BLOOD GOD."', cmds.some(c => c == 'title Far title ' + JSON.stringify({ text: 'BLOOD FOR THE BLOOD GOD.', color: 'dark_red', bold: true })) &&
  cmds.some(c => c == 'title Far subtitle ' + JSON.stringify({ text: 'I break the third seal, and the fourth with it.', color: 'red' })))
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

// ---------- Act II: the Regalia restored at the altar (owner decisions 2026-11-20: relics break the seals) ----------
const ALTAR_AT = LECTERN.split(',').map(Number)
const hand = (p, id, n) => { p.slots[0] = stack(id, n) }
const tally = id => S().regalia.progress[id] ? S().regalia.progress[id].have : 0
const atAltar = p => clickBlock(p, ALTAR_AT[0], ALTAR_AT[1], ALTAR_AT[2])
players.forEach(p => { p.msgs = [] })
cmds = []
hand(carol, 'minecraft:totem_of_undying', 10)
atAltar(carol)
ok('ten totems given at the altar: all counted for the Totem Hoard, credited to Carol, and she\'s told', tally('totem_hoard') == 10 && carol.slots[0].count == 0 &&
  S().regalia.progress.totem_hoard.by['carol-uuid'].n == 10 && said(carol, /You give 10 Totems of Undying to The Totem Hoard: 10 of 64 Totems of Undying\./), carol.msgs.join(' | '))
hand(bob, 'minecraft:totem_of_undying', 64)
atAltar(bob)
ok('... only what it still needs is taken: 54 of Bob\'s 64, the rest left in his hand', tally('totem_hoard') == 64 && bob.slots[0].count == 10)
ok('... restored: "THE TOTEM HOARD is restored" on every screen, the Blood God speaks, and the seal relics are counted',
  cmds.some(c => /^title Far title .*THE TOTEM HOARD/.test(c)) && said(far, /\[BLOOD GOD\] The Totem Hoard is mine again\. Another seal will break for you\./) &&
  said(far, /The Totem Hoard is restored: 1 of 7 relics for the seals/) && global.Regalia.restoredForSeals() == 1 && global.Regalia.isRestored('totem_hoard'))
bob.msgs = []
atAltar(bob)
ok('... once restored, it takes no more', bob.slots[0].count == 10 && said(bob, /The Totem Hoard is already restored/))
const raiders = () => mobs.filter(m => !m.discarded && m.tags.indexOf('shrine_raid') >= 0)
advance(205)
ok('... 10 seconds later, Inspectors come for it on the ring round the Shrine, in diamond (STORY.md #38)', raiders().length >= 3 &&
  raiders().every(m => { const d = Math.hypot(m.x - 1000.5, m.z - 2000.5); return d >= 29 && d <= 46 && /diamond_chestplate/.test(m.nbt) }) &&
  logs.some(l => /\[Shrine\] Relic raid for totem_hoard: \d+ Inspectors/.test(l)), raiders().length)
raiders().forEach(m => { m.discarded = true })
// cobalt and pig iron by the block, ingots counting 9 to one
players.forEach(p => { p.msgs = [] })
hand(carol, 'tconstruct:cobalt_block', 64); atAltar(carol)
hand(carol, 'tconstruct:cobalt_ingot', 5); atAltar(carol)
ok('cobalt blocks and ingots for the Axe of Peace, counted in ingots, told in blocks', tally('axe_of_peace') == 64 * 9 + 5 &&
  said(carol, /You give 64 blocks of cobalt to The Axe of Peace: 64 of 1,000 blocks of cobalt\./) && said(carol, /You give 5 cobalt ingots to The Axe of Peace: 64 of 1,000 blocks of cobalt\./), carol.msgs.join(' | '))
hand(carol, 'tconstruct:cobalt_block', 190); atAltar(carol)
ok('... each quarter, everyone is told', said(far, /The Axe of Peace is a quarter restored: 254 of 1,000 blocks of cobalt\./))
hand(dave, 'tconstruct:pig_iron_ingot', 18); atAltar(dave)
ok('pig iron ingots for the Swine\'s Oath', tally('swines_oath') == 18 && said(dave, /You give 2 blocks of pig iron to The Swine's Oath: 2 of 128 blocks of pig iron\./), dave.msgs.join(' | '))
// potatoes and crates for the War Chest; never the Potato King's
hand(bob, 'minecraft:potato', 3000); atAltar(bob)
hand(bob, 'quark:potato_crate', 10); atAltar(bob)
ok('potatoes and potato crates (9 each) for the War Chest', tally('war_chest') == 3090)
// blood for the Chalice: a bucket of it, and the bucket comes back empty
hand(carol, 'evilcraft:bucket_blood', 1); carol.msgs = []
atAltar(carol)
ok('a bucket of blood for the Chalice: 1,000 mB counted, an empty bucket back', tally('chalice') == 1000 && carol.slots[0].id == 'minecraft:bucket' &&
  said(carol, /You give 1 buckets of blood to The Chalice of Blood: 1 of 1,000 buckets of blood\./), carol.msgs.join(' | '))
// anything else at the altar: the lectern's book reads as usual
hand(carol, 'minecraft:dirt', 5)
ok('anything else at the altar is left alone (the book reads as usual)', !atAltar(carol).cancelled && carol.slots[0].count == 5)
const regaliaNow = regalia(carol)
ok('/regalia shows each relic in its own unit, its contributors, and how many seal relics are in', /The Axe of Peace {2}254 \/ 1,000 blocks of cobalt \(Carol 254\)/.test(regaliaNow[2]) &&
  /The Totem Hoard {2}64 \/ 64 Totems of Undying \(Bob 54, Carol 10\)/.test(regaliaNow[3]) && /each one restored breaks another seal \(1 of 7\)/.test(regaliaNow[9]), regaliaNow.join(' | '))
// Carl's Bridle (owner decision 2026-11-20, it was a bred horse): 32 saddles and 16 diamond horse armour, each filled
// on its own. Neither stacks, so everything of it the giver carries goes in at once.
players.forEach(p => { p.msgs = [] })
for (let i = 0; i < 5; i++) carol.slots[i] = stack('minecraft:saddle', 1)
carol.slots[6] = stack('minecraft:diamond_horse_armor', 1)
atAltar(carol)
ok('Carl\'s Bridle: the five saddles Carol carries go in at once (not the horse armour), and she\'s told each part\'s count',
  [0, 1, 2, 3, 4].every(i => carol.slots[i].count == 0) && carol.slots[6].count == 1 && S().regalia.progress.carls_bridle.parts['minecraft:saddle'] == 5 &&
  said(carol, /You give 5 saddles to Carl's Bridle: saddles 5 of 32, diamond horse armour 0 of 16\./), carol.msgs.join(' | '))
for (let i = 0; i < 30; i++) bob.slots[i] = stack('minecraft:saddle', 1)
atAltar(bob)
const bobSaddles = () => bob.slots.filter(s => s.id == 'minecraft:saddle' && s.count > 0).length
ok('... only the saddles it still needs: 27 of Bob\'s 30', S().regalia.progress.carls_bridle.parts['minecraft:saddle'] == 32 && bobSaddles() == 3)
bob.slots[0] = stack('minecraft:saddle', 1); bob.msgs = []
atAltar(bob)
ok('... then no more saddles: it has all it needs', said(bob, /Carl's Bridle has all the saddles it needs/) && bobSaddles() == 4)
for (let i = 0; i < 16; i++) dave.slots[i] = stack('minecraft:diamond_horse_armor', 1)
atAltar(dave)
ok('... and with 16 diamond horse armour, Carl\'s Bridle is restored', global.Regalia.isRestored('carls_bridle') && said(far, /Carl's Bridle is mine again/) &&
  global.Regalia.restoredForSeals() == 2 && dave.slots.every(s => s.id != 'minecraft:diamond_horse_armor' || s.count == 0))
const rTack = regalia(carol)
ok('/regalia shows Carl\'s Bridle part by part', /Carl's Bridle {2}saddles 32 \/ 32, diamond horse armour 16 \/ 16/.test(rTack[6]), rTack[6])
advance(205)
raiders().forEach(m => { m.discarded = true })

// a second night (test server): whoever offered the potatoes, the Drops go to nobody, and a /reload mid-way carries on
cmd('reset confirm', admin); advance(40)
ok('the reset forgets the Awakening and closes the Regalia', S().awake.state == 'none' && !global.Regalia.isOpen() && /named nothing yet/.test(regalia(carol)[0]))
cmd('rise force', admin); advance(layerTicks * 66 + 30)
const saved = JSON.parse(persistent.shrine)
saved.rite.offered = { 'carol-uuid': { name: 'Carol', n: 30 }, 'bob-uuid': { name: 'Bob', n: 10 } }
persistent.shrine = JSON.stringify(saved)
load()
pool.drops = 70000; pool.tier = 2; pool.adds = []; pool.opens = []
far.msgs = []
cmd('awaken force', admin)
advance(600)
load()                                            // a /reload just after the first words
advance(awakeTicks)
ok('a /reload mid-Awakening carries on from the next step: nothing said twice', far.msgs.filter(m => /You lit my fires/.test(m)).length == 1 && far.msgs.filter(m => /Eight things were mine/.test(m)).length == 1 &&
  S().awake.state == 'done', far.msgs.length)
ok('... Carol offered 30 potatoes and Bob 10, and still the 160,000 Drops go to nobody, added once', pool.drops == 230000 && pool.adds.length == 1 && pool.adds[0].n == 160000 &&
  pool.adds[0].uuid === '' && /160,000 Drops added, credited to nobody/.test(cmd('status', admin)[8]), JSON.stringify(pool.adds))
ok('... and the seals are broken once (the /reload didn\'t open them twice)', pool.opens.length == 1 && pool.tier == 4, JSON.stringify(pool.opens))
// a third night with the Pool already past 230,000 but Tier 3 still sealed: no Drops, the seals still broken
// (this night begins with the braziers: the event runs from them to the Awakening's end)
cmd('reset confirm', admin); advance(40)
cmd('braziers', admin); advance(2)
ok('a night begun with /shrine braziers: the event is on', global.Shrine.eventOn())
// (2026-11-21, on the test server: its start is near the braziers, and 21 Inspectors came at second 0 of the opening)
const carolWas = [carol.x, carol.z], nearB1 = () => mobs.filter(m => !m.discarded && (m.tags.indexOf('shrine_brazier_0') >= 0 || m.tags.indexOf('shrine_ambush') >= 0))
carol.x = b1.x + 10.5; carol.z = b1.z + 0.5
advance(100)
ok('no ambush and no brazier wave while the opening plays, even beside a brazier', nearB1().length == 0, nearB1().length + ' Inspectors')
cmds = []
r = cmd('stop', admin)
advance(100)
ok('/shrine stop during the opening cuts it short; the night goes on without the rest of it', /The opening is cut short/.test(r[0]) && global.Shrine.eventOn() && S().fires.state == 'placed' &&
  !cmds.some(c => /THE PILGRIMAGE|The first fire/.test(c)), r[0])
ok('... and with the opening over, the Inspectors come', nearB1().length > 0, nearB1().length + ' Inspectors')
nearB1().forEach(m => { m.discarded = true })
carol.x = carolWas[0]; carol.z = carolWas[1]
cmd('rise force', admin); advance(layerTicks * 66 + 30)
ok('... still on once the Shrine has risen (and the fires\' stage is done)', global.Shrine.eventOn() && S().fires.state == 'done')
pool.drops = 240000; pool.tier = 2; pool.adds = []; pool.opens = []; carol.msgs = []
cmd('awaken force', admin)
advance(awakeTicks - 20)
ok('... and through the Awakening', global.Shrine.eventOn() && S().awake.state == 'running')
advance(25)
ok('with the Pool already past 230,000: no Drops added, but the seals are still broken to Tier 4', pool.adds.length == 0 && pool.drops == 240000 && pool.tier == 4 && pool.opens.length == 1 && S().awake.state == 'done' &&
  /no Drops added \(the Pool was already there\)/.test(cmd('status', admin)[8]), cmd('status', admin)[8])
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

// ---------- the new order (owner decision, 2026-11-19: the Shrine is the climax) ----------
// The braziers and the beam; the Ignition Rite fought around the beam, beginning by itself once everyone has gathered
// there, the King's Potatoes offered into the beam's red glass; the Awakening at the beam, beginning by itself once the
// offering is full; and the Shrine rising last, the night ending when it stands.
const riseUntilRisen = () => { for (let i = 0; i < 1200 && S().rise.state != 'risen'; i++) advance(1) }
const toTheBeam = () => { cmd('braziers', admin); advance(2); cmd('fires light', admin); advance(25) }
const allAtTheBeam = () => { players.forEach((p, k) => { p.x = 990.5 + k * 8; p.y = 64; p.z = 2030.5 }) }
const GLASS = [1000, 63, 2000]                                    // the beam's red glass: the site (1000 64 2000), one down
carol.slots[8] = own('minecraft:compass', 1)
pool.drops = 66000; pool.tier = 2; pool.adds = []; pool.opens = []
toTheBeam()
ok('(the night: the fires lit, the beam up, nothing risen)', S().beam.up && S().rise.state == 'none' && world[GLASS.join(',')] == 'minecraft:red_stained_glass')
allAtTheBeam(); far.x = 3000.5; far.z = 3000.5
advance(40)
ok('the rite waits while a pilgrim is still away from the beam', !S().rise.riteAt && RT().state == 'none')
far.x = 1000.5; far.z = 2040.5
players.forEach(p => { p.msgs = [] })
advance(20)
ok('everyone gathered at the beam: the rite is due 8 seconds later, and they hear something stir', !!S().rise.riteAt && RT().state == 'none' &&
  said(carol, /All are gathered\. Something stirs on the land around the beam/))
ok('... status says when', /The Ignition Rite: begins by itself in [78]s \(\/shrine stop holds it\)/.test(cmd('status', admin)[7]), cmd('status', admin)[7])
advance(150)
ok('... not before then', RT().state == 'none')
advance(15)
ok('... then the Ignition Rite begins by itself, around the beam, and night and a storm roll in', RT().state == 'running' && !S().rise.riteAt &&
  logs.some(l => /The Ignition Rite began by itself, 8 seconds after everyone gathered/.test(l)) && said(carol, /Figures gather on the land around the beam/) &&
  said(carol, /offer them to the beam, at its root: 40 in all/) && S().event.sky && S().rise.state == 'none')
// the offering: into the beam's red glass
players.forEach(p => { p.msgs = [] })
cmds = []
carol.slots[0] = kings(4)
clickBlock(carol, GLASS[0], GLASS[1], GLASS[2])
ok('the King\'s Potatoes go into the beam (its red glass): counted, and those present are told', RT().total == 4 && said(bob, /Carol offers 4 Potato King's Potatoes to the beam\. 4 of 40\./))
carol.slots[0] = kings(6)
const bolts1 = bolts.length
clickBlock(carol, GLASS[0], GLASS[1], GLASS[2])
ok('... a quarter: the beam surges, a ring of fire round it and a bolt for show into it (no statue to light)', RT().lit == 1 &&
  cmds.filter(c => /run particle minecraft:flame [\d.]+ 64\.2 [\d.]+ 0\.4 0\.1 0\.4 /.test(c)).length == 16 && bolts.slice(bolts1).some(b => b.at[0] == 1000.5 && b.at[2] == 2000.5) &&
  !cmds.some(c => /minecraft:light\[level=15\]/.test(c)))
ok('... status counts the surges', /10 of 40 potatoes offered; 1 of 4 surges of the beam/.test(cmd('status', admin)[7]), cmd('status', admin)[7])
carol.slots[0] = kings(2)
carol.msgs = []
clickBlock(carol, 1003, 64, 2000)
ok('anywhere else, they\'re refused', RT().total == 10 && said(carol, /Only the beam, where it leaves the ground/))
ev = { block: { level, x: GLASS[0], y: GLASS[1], z: GLASS[2] }, player: bob, cancelled: false, cancel() { ev.cancelled = true; throw EXIT } }
;(handlers.broken || []).forEach(h => { try { h(ev) } catch (e) { if (e !== EXIT) throw e } })
ok('the beam can\'t be broken while it\'s up', ev.cancelled && said(bob, /The beam will not be broken/))
// the offering filled during the event: the Inspectors vanish, everyone is brought back to watch
players.forEach(p => { p.msgs = [] })
cmds = []
far.spectator = true
const farAt = [far.x, far.z]
// a tree's canopy, vines hanging from it, over where everyone will watch: they stand on the ground under it, not on top
// (at the fifth run, 2026-11-20, the owner was put on a tree, vines between them and the Shrine)
const canopy = []
for (let x = 1053; x <= 1062; x++) for (let z = 1985; z <= 2015; z++) for (let y = 66; y <= 70; y++) {
  world[x + ',' + y + ',' + z] = y >= 69 ? 'minecraft:oak_leaves' : 'minecraft:vine'; canopy.push(x + ',' + y + ',' + z)
}
carol.slots[0] = kings(30)
clickBlock(carol, GLASS[0], GLASS[1], GLASS[2])
ok('the offering is full: the beam blazes, every Inspector vanishes, and the op is told the Awakening begins by itself', RT().state == 'full' && riteMobsNow().length == 0 &&
  said(carol, /The beam blazes\. Beneath it, something enormous stirs\./) && said(carol, /The Inspectors crumble to ash/) && said(admin, /the Awakening begins by itself in 13 seconds/))
advance(61)
const x0 = 979 + 38 + 34 + 4, watchers = [admin, bob, carol, dave]
ok('3 seconds later, everyone but spectators is brought back from the beam: east of the site, beyond where the steps will go, side by side, facing it, on the ground under the trees',
  watchers.every(p => p.x == x0 + 0.5 && p.y == 64) && new Set(watchers.map(p => p.z)).size == 4 &&
  cmds.some(c => c.indexOf('run tp Carol ' + (x0 + 0.5) + ' 64 ') > 0 && / facing 1000\.5 84 2000\.5$/.test(c)) && far.x == farAt[0] && far.z == farAt[1] &&
  said(carol, /drawn back from the beam/), watchers.map(p => p.name + ' ' + p.x + ' ' + p.y + ' ' + p.z).join(', '))
carol.x += 10
advance(20)
ok('... and held there: Carol wanders off and is put back', carol.x == x0 + 0.5, carol.x)
advance(170)
ok('... the Awakening not begun yet', S().awake.state == 'none')
advance(15)
ok('then the Awakening begins by itself, at the beam (the Shrine not risen)', S().awake.state == 'running' && logs.some(l => /\[Shrine\] The Awakening began by itself/.test(l)) &&
  !S().rise.awakenAt && S().rise.state == 'none')
advance(780)
ok('... the Regalia is named, its book to lie on the Shrine\'s altar once it stands', global.Regalia.isOpen() && said(carol, /\[REGALIA\] The Blood God has named the Regalia of the Blade\. Its book will lie on his Shrine's altar\./))
advance(awakeTicks - 780 + 30)
ok('when the Awakening is done, the Shrine rises: the night\'s last act. Everyone is still held, still in the kit, the event still on', S().awake.state == 'done' && S().rise.state == 'rising' &&
  global.Shrine.eventOn() && Object.keys(S().awake.spots).length == 4 && kitOf(carol).length >= 6 && logs.some(l => /The Shrine rises: the night's last act/.test(l)), S().rise.state)
ok('... and the beam comes out as it rises', !S().beam.up)
ok('... the Pool still untouched while the Shrine rises: the seals break when the night ends (owner, fifth run, 2026-11-20)', pool.drops == 66000 && pool.adds.length == 0 &&
  pool.opens.length == 0 && /the seals break and the Pool rises when the night ends/.test(cmd('status', admin)[8]), cmd('status', admin)[8])
carol.x += 10
advance(20)
ok('... still held while it rises', carol.x == x0 + 0.5)
cmds = []
players.forEach(p => { p.msgs = [] })
riseUntilRisen()
advance(2)
ok('the Shrine stands: "TECHNOBLADE\'S SHRINE stands once more", it burns from its feet to its crown, and the Regalia book lies on its altar',
  S().rise.state == 'risen' && cmds.some(c => /^title Carol title .*TECHNOBLADE'S SHRINE/.test(c)) && cmds.some(c => /run setblock \d+ 1[01]\d \d+ minecraft:light\[level=15\]$/.test(c)) &&
  world[LECTERN] == 'minecraft:lectern[facing=east,has_book=true,powered=false]' && said(carol, /\[REGALIA\] The Regalia of the Blade lies on the Shrine's altar/) && S().stairs > 0)
ok('... the night isn\'t over until a moment later, and the Pool waits for it', global.Shrine.eventOn() && Object.keys(S().awake.spots).length == 4 && pool.adds.length == 0 && pool.opens.length == 0)
advance(110)
ok('then the night is over: the sky clears, everyone is let go, and the belongings come back (the kit goes)', !global.Shrine.eventOn() && Object.keys(S().awake.spots).length == 0 &&
  cmds.indexOf('weather clear') >= 0 && cmds.indexOf('time set day') >= 0 && carol.slots[8].id == 'minecraft:compass' && kitOf(carol).length == 0 && kitOf(bob).length == 0 &&
  Object.keys(S().vaults).length == 0, Object.keys(S().vaults).join())
ok('... and then the seals break and the Pool rises: Tiers 3 and 4 open, 230,000 Drops, once', pool.opens.length == 1 && pool.opens[0].n == 4 && pool.tier == 4 &&
  pool.drops == 230000 && pool.adds.length == 1 && /164,000 Drops added, credited to nobody/.test(cmd('status', admin)[8]), JSON.stringify(pool))
carol.x += 10
advance(40)
ok('... and free to move', carol.x == x0 + 10.5)
far.spectator = false
cmd('reset confirm', admin); advance(40)
// /shrine stop while the rite is due; outside the event the rite never begins by itself
toTheBeam(); allAtTheBeam(); advance(20)
r = cmd('stop', admin)
advance(200)
ok('/shrine stop while the rite is due: it won\'t begin by itself (/shrine rite still starts it)', /won't begin by itself/.test(r[0]) && RT().state == 'none' && !S().rise.riteAt, r[0])
cmd('reset confirm', admin); advance(40)
cmd('beam up', admin); advance(5); allAtTheBeam(); advance(200)
ok('outside the night\'s event (the beam raised by hand), the rite never begins by itself', !global.Shrine.eventOn() && S().beam.up && RT().state == 'none' && !S().rise.riteAt)
cmd('reset confirm', admin); advance(40)
// a /reload while the rite is due, and while the Awakening is due; a /reload mid-rise after the Awakening
const ritesBegun = () => logs.filter(l => /The Ignition Rite began by itself/.test(l)).length
let begun = ritesBegun()
toTheBeam(); allAtTheBeam(); advance(60); load(); advance(140)
ok('a /reload while the rite is due: it still begins, on time and once', RT().state == 'running' && ritesBegun() == begun + 1)
const awakenings = () => logs.filter(l => /\[Shrine\] The Awakening began by itself/.test(l)).length
begun = awakenings()
carol.slots[0] = kings(RT().need); clickBlock(carol, GLASS[0], GLASS[1], GLASS[2])
advance(100); load(); advance(200)
ok('a /reload while the Awakening is due: it still begins, once', S().awake.state == 'running' && awakenings() == begun + 1)
advance(awakeTicks + 30); advance(200)
ok('(the Shrine rising after the Awakening)', S().rise.state == 'rising')
load()
riseUntilRisen(); advance(120)
ok('a /reload mid-rise: it carries on, and the night still ends when the Shrine stands', S().rise.state == 'risen' && !global.Shrine.eventOn() && Object.keys(S().vaults).length == 0 &&
  Object.keys(S().awake.spots).length == 0)
// The viewing platform (owner decisions at the fifth run, 2026-11-20, after mobs kept spawning round the owner held on
// the ground): /shrine view set lays a 6 x 6 floor of barriers under the spot with a rail round it; everyone watches from
// it, and when the night ends they're set down in front of the lectern and it's taken away
canopy.forEach(k => { delete world[k] })
cmd('reset confirm', admin); advance(40)
ok('status: the viewing spot picked by itself until it\'s set', /The viewing spot: picked by itself, on the ground east of the steps/.test(cmd('status', admin)[14]), cmd('status', admin)[14])
r = cmd('view set 1000 100 2010', null)
ok('/shrine view set over the Shrine\'s footprint: refused', /over the Shrine's footprint/.test(r[0]) && !S().view, r[0])
const barrier = (x, y, z) => world[x + ',' + y + ',' + z] == 'minecraft:barrier'
r = cmd('view set 1000 120 2090', null)
r = cmd('view set 1000 120 2080', null)
ok('/shrine view set <x> <y> <z>: the platform is built there, 80 blocks from the Shrine\'s centre, and status says so',
  /The viewing platform is built there, at 1000 120 2080, 80 blocks from the Shrine's centre: a 6 x 6 floor of barriers with an invisible rail round it/.test(r[0]) &&
  S().platformUp && /The viewing spot: a platform in the sky at 1000 120 2080 \(\/shrine view set moves it\)/.test(cmd('status', admin)[14]), r[0])
ok('... a 6 x 6 floor of barriers just under the spot, a rail 2 high round its edge, and room to stand on it', barrier(998, 119, 2078) && barrier(1003, 119, 2083) &&
  !barrier(997, 119, 2080) && barrier(997, 120, 2080) && barrier(1004, 121, 2083) && barrier(1000, 121, 2077) && !barrier(997, 122, 2080) && !barrier(1000, 120, 2080) && !barrier(1000, 121, 2080))
ok('... moved there from where it was set first: the old platform came down', !barrier(998, 119, 2088) && !barrier(997, 120, 2090) && S().view.z == 2080)
// /shrine stop while the Awakening is due: it won't begin, and everyone on the platform is set down at the start (the
// Shrine hasn't risen); the platform goes
toTheBeam(); allAtTheBeam(); advance(200)
carol.slots[0] = kings(RT().need); clickBlock(carol, GLASS[0], GLASS[1], GLASS[2])
advance(61)
const onIt = [admin, bob, carol, dave, far], wherePs = ps => ps.map(p => p.name + ' ' + p.x + ' ' + p.y + ' ' + p.z).join(', ')
ok('brought back to watch: onto the platform, the first on the owner\'s spot, the rest on the cells nearest it', admin.x == 1000.5 && admin.y == 120 && admin.z == 2080.5 &&
  onIt.every(p => p.y == 120 && p.x >= 998 && p.x < 1004 && p.z >= 2078 && p.z < 2084) && new Set(onIt.map(p => p.x + ',' + p.z)).size == 5 && S().platformUp, wherePs(onIt))
r = cmd('stop', admin)
ok('/shrine stop while the Awakening is due: it won\'t begin by itself; everyone is set down at the start, and the platform goes',
  /The Awakening won't begin by itself, and everyone is free to move/.test(r[0]) && S().awake.state == 'none' && !S().rise.awakenAt &&
  onIt.every(p => p.x == 5000.5 && p.y == 64 && p.z == 5000.5) && !S().platformUp && !barrier(998, 119, 2078) && !barrier(997, 120, 2080), wherePs(onIt))
cmd('reset confirm', admin); advance(40)
ok('... /shrine reset confirm keeps the viewing spot, as it keeps the sites', S().view && S().view.x == 1000)
// a whole night from the platform: when the Shrine stands and the night ends, everyone is set down in front of the
// lectern, facing it, and the platform goes. Dave, offline then and still where it was, is set down there when he joins.
toTheBeam(); allAtTheBeam(); advance(200)
carol.slots[0] = kings(RT().need); clickBlock(carol, GLASS[0], GLASS[1], GLASS[2])
advance(61)
ok('(the platform built again for the night, everyone on it)', S().platformUp && barrier(998, 119, 2078) && onIt.every(p => p.y == 120))
players.splice(players.indexOf(dave), 1)
advance(awakeTicks + 30)
riseUntilRisen()
cmds = []
advance(120)
const stayed = [admin, bob, carol, far]
ok('the night over: everyone is set down in front of the lectern, facing it, and the platform is taken away', stayed.every(p => p.x == 1008.5 && p.y == 86 && p.z == 1999.5) &&
  cmds.some(c => /run tp Carol 1008\.5 86 1999\.5 facing 1007\.5 87 1999\.5$/.test(c)) && !S().platformUp && !barrier(998, 119, 2078) && !barrier(997, 120, 2080) &&
  !global.Shrine.eventOn(), wherePs(stayed))
players.push(dave)
;(handlers.loggedIn || []).forEach(h => h({ player: dave }))
advance(100)
ok('... Dave, offline then and still where the platform was, is set down there too when he joins', dave.x == 1008.5 && dave.y == 86 && dave.z == 1999.5, wherePs([dave]))
cmd('reset confirm', admin); advance(40)
const noView = JSON.parse(persistent.shrine); noView.view = null; persistent.shrine = JSON.stringify(noView); load()
// a night saved before the seals waited for the night's end (the fifth run's): its Awakening broke them as it ran
const oldNight = JSON.parse(persistent.shrine); oldNight.awake = { state: 'done', step: 7, added: 164000, spots: {} }; persistent.shrine = JSON.stringify(oldNight); load()
ok('a night saved before the seals waited for the night\'s end counts as having broken them', S().awake.pooled === true &&
  /164,000 Drops added, credited to nobody/.test(cmd('status', admin)[8]), cmd('status', admin)[8])
cmd('reset confirm', admin); advance(40)

// ---------- Where the waves come from (owner decision, 2026-11-20: Inspectors kept spawning in caves and water) ----------
// Around the braziers until half the potatoes are offered, then 4 to 6 blocks from the beam's red glass. Two braziers
// near the beam, the third too far to use (141 blocks). East of brazier 1 is water: lily pads on it, kelp and seagrass
// up to its surface.
const oldBraziers = S().braziers.map(b => b.x + ' ' + b.y + ' ' + b.z)
cmd('brazier set 1 1040 64 2000', null); cmd('brazier set 2 1010 64 2040', null); cmd('brazier set 3 1100 64 2100', null)
const wetKeys = []
for (let x = 1042; x <= 1048; x++) for (let z = 1992; z <= 2008; z++) {
  const kind = (x + z) % 3
  if (kind == 0) { world[x + ',63,' + z] = 'minecraft:water'; world[x + ',64,' + z] = 'minecraft:lily_pad'; wetKeys.push(x + ',64,' + z) }
  else world[x + ',63,' + z] = kind == 1 ? 'minecraft:kelp' : 'minecraft:seagrass'
  wetKeys.push(x + ',63,' + z)
}
const B1 = [1040.5, 2000.5], B2 = [1010.5, 2040.5], from = (m, b) => Math.hypot(m.x - b[0], m.z - b[1])
const nearest = m => Math.min(from(m, B1), from(m, B2)), whereAre = ms => ms.map(m => m.x + ' ' + m.y + ' ' + m.z).join(', ')
players.forEach(p => { p.msgs = [] })
toTheBeam(); allAtTheBeam(); advance(200)
const wave1 = riteMobsNow()
ok('braziers near the beam: the rite opens "by the braziers", and wave 1 comes from them, 3 to 7 blocks out, shared by the two near ones (not the third, 141 blocks off)',
  RT().state == 'running' && said(carol, /Figures gather by the braziers/) && said(carol, /Wave 1: \d+ Inspectors come from the braziers/) && wave1.length >= 4 &&
  wave1.every(m => nearest(m) >= 2.2 && nearest(m) <= 7.8) && wave1.some(m => from(m, B1) <= 7.8) && wave1.some(m => from(m, B2) <= 7.8), whereAre(wave1))
ok('... none in the water by brazier 1: not on a lily pad, nor on kelp or seagrass reaching the surface', wave1.filter(m => from(m, B1) <= 7.8).every(m => m.x < 1042 && m.y == 64),
  whereAre(wave1.filter(m => from(m, B1) <= 7.8)))
// several Senior Inspectors to a wave (owner decision 2026-11-21: "each drops 2 but add more senior inspectors as the waves
// increase", still about 8 waves)
const shares = JSON.parse(src.match(/const SENIORS_PER_PLAYER = (\[[^\]]*\])/)[1]), perSenior = Number(src.match(/potatoes: (\d+), helpers/)[1])
ok('the Seniors\' shares fill the offering at the 8th wave: they add up to 8 potatoes per player at 2 a Senior (8 players: 2, 2, 3, 4, 4, 5, 6, 6)',
  shares.length == 8 && Math.abs(shares.reduce((a, b) => a + b, 0) * perSenior - Number(src.match(/const POTATOES_PER_PLAYER = (\d+)/)[1])) < 1e-9 &&
  shares.map(s => Math.ceil(s * 8 - 1e-9)).join() == '2,2,3,4,4,5,6,6' && shares.every((s, k) => k == 0 || s >= shares[k - 1]), shares.join())
const sr1 = wave1.filter(isSenior), want1 = Math.max(1, Math.ceil(shares[0] * RT().present - 1e-9))
ok('... ' + RT().present + ' present: wave 1 is led by ' + want1 + ' Senior Inspectors, each tagged with his place in it, each carrying 2', want1 > 1 && sr1.length == want1 &&
  sr1.every(m => m.tags.indexOf('shrine_pot_2') >= 0) && sr1.map(m => m.tags.filter(t => /^shrine_sid_/.test(t))[0]).sort().join() == sr1.map((m, k) => 'shrine_sid_0_' + k).join(),
  sr1.map(m => m.tags.join('/')).join(' | '))
ok('... one bar for the wave, their health together ("Senior Inspectors (wave 1): ' + want1 + ' of ' + want1 + ' standing"); status counts them',
  cmds.some(c => c.indexOf('bossbar add trollcraft:shrine_senior_0 ') == 0 && c.indexOf('Senior Inspectors (wave 1): ' + want1 + ' of ' + want1 + ' standing') >= 0) &&
  cmds.indexOf('bossbar set trollcraft:shrine_senior_0 max ' + (150 * want1)) >= 0 && cmd('status', admin)[7].indexOf('(' + want1 + ' Senior Inspectors up)') >= 0, cmd('status', admin)[7])
cmds = []; carol.msgs = []
kill(sr1[0]); advance(20)
ok('... one falls: his 2 potatoes, the wave\'s bar stays with one fewer standing, and those present are told how many still stand',
  cmds.some(c => /run summon minecraft:item .*Count:2b,tag:\{trollcraft:\{kingspotato:1b\}/.test(c)) && cmds.indexOf('bossbar remove trollcraft:shrine_senior_0') < 0 &&
  cmds.some(c => c.indexOf('bossbar set trollcraft:shrine_senior_0 name ') == 0 && c.indexOf((want1 - 1) + ' of ' + want1 + ' standing') >= 0) &&
  said(carol, want1 == 2 ? /A Senior Inspector falls\. His clipboard does not\. One more of wave 1 still stands\./ : /A Senior Inspector falls\. His clipboard does not\. \d+ more of wave 1 still stand\./),
  carol.msgs.join(' | '))
players.forEach(p => { p.msgs = [] })
carol.slots[0] = kings(RT().need / 2); clickBlock(carol, GLASS[0], GLASS[1], GLASS[2])
ok('half the offering in the beam (its second surge): those present are told the waves now rise around the beam', RT().lit == 2 &&
  said(carol, /Half the offering burns in the beam\. The Inspectors come for it now: the next waves rise around the beam itself\./))
riteMobsNow().forEach(m => kill(m))
advance(20)
ok('... the rest of wave 1\'s Seniors down: its bar goes', cmds.indexOf('bossbar remove trollcraft:shrine_senior_0') >= 0 && !RT().seniors[0])
const wave2 = riteMobsNow()
ok('... the next wave rises around the red glass, 4 to 6 blocks out, on the ground', RT().wave == 1 && said(carol, /Wave 2: \d+ Inspectors rise around the beam/) && wave2.length >= 4 &&
  wave2.every(m => { const d = Math.hypot(m.x - 1000.5, m.z - 2000.5); return d >= 3.2 && d <= 6.8 && m.y == 64 }), whereAre(wave2))
ok('... the log says where each wave came from and where every Inspector landed', logs.some(l => /\[Shrine\] Rite wave 1: \d+ Inspectors, from the braziers \((-?\d+ 64 -?\d+; )+Senior -?\d+ 64 -?\d+(; Senior -?\d+ 64 -?\d+)*\)/.test(l)) &&
  logs.some(l => /\[Shrine\] Rite wave 2: \d+ Inspectors, round the red glass \(/.test(l)), logs.filter(l => /Rite wave [12]:/.test(l)).slice(-2).join(' | '))
// a Senior's helpers: on dry ground near him, not in the water on his east side (the old way could put them on water)
const sen = wave2.filter(isSenior)[0], sx = Math.floor(sen.x), sz = Math.floor(sen.z), flooded = []
for (let x = sx + 1; x <= sx + 6; x++) for (let z = sz - 6; z <= sz + 6; z++) {
  const k = x + ',63,' + z
  if ((Math.abs(x - 1000) <= 1 && Math.abs(z - 2000) <= 1) || world[k]) continue
  world[k] = 'minecraft:water'; flooded.push(k)
}
sen.health = 70
advance(20)
const helpers = riteMobsNow().filter(m => wave2.indexOf(m) < 0)
ok('a Senior\'s two helpers land on dry ground 2 to 5 blocks from him, none in the water beside him', helpers.length == 2 &&
  helpers.every(m => { const d = Math.hypot(m.x - sen.x, m.z - sen.z); return d >= 1.2 && d <= 5.8 && flooded.indexOf(Math.floor(m.x) + ',63,' + Math.floor(m.z)) < 0 && m.y == 64 }), whereAre(helpers))
flooded.forEach(k => { delete world[k] })
riteMobsNow().forEach(m => kill(m))
cmd('reset confirm', admin); advance(40)
wetKeys.forEach(k => { delete world[k] })
oldBraziers.forEach((b, i) => cmd('brazier set ' + (i + 1) + ' ' + b, null))

// ---------- Stage 0, the Signal, and Stage 1, the Summons (the drafts as approved, 2026-11-19) ----------
// A player joining: online, and PlayerEvents.loggedIn fires.
const joins = p => { if (players.indexOf(p) < 0) players.push(p); (handlers.loggedIn || []).forEach(h => h({ player: p })) }
r = cmd('status', admin)
ok('status: the Signal not sent, the Summons not given', /The Signal: not sent/.test(r[11]) && /The Summons: not given/.test(r[12]), r.slice(11).join(' | '))
players.forEach(p => { p.msgs = []; p.raw = [] })
cmds = []
r = cmd('signal', admin)
ok('/shrine signal: to everyone online, each privately', /The Signal went to 5 players, each privately/.test(r[0]) && /next 24 hours/.test(r[0]) &&
  players.every(p => said(p, /\.\.\.the third seal\.\.\./)), r[0])
const sig = carol.raw[0] || []
ok('... the fragments readable (red italic), the rest scrambled (obfuscated)', sig.filter(x => x.obfuscated && x.color == 'dark_red').length == 5 &&
  sig.filter(x => x.italic && !x.obfuscated).map(x => x.text.trim()).join('|') == '...the third seal...|...three fires...|...gather at the castle...|...tomorrow, when the sun goes down...', JSON.stringify(sig))
ok('... never with tellraw (Discord would get it), and unsigned', !cmds.some(c => /tellraw/.test(c)) && !said(carol, /BLOOD GOD|Ministry|Shrine/))
const eve = player('Eve', 0.5, 64, 0.5)
joins(eve)
ok('someone joining within 24 hours: not at once...', !said(eve, /the third seal/))
advance(100)
ok('... but 5 seconds after they join', said(eve, /\.\.\.the third seal\.\.\./) && S().signal.told['eve-uuid'] == 'Eve')
eve.msgs = []; bob.msgs = []; joins(eve); joins(bob); advance(100)
ok('... once only: back again, nothing (nor for anyone who had it when it was sent)', !said(eve, /the third seal/) && !said(bob, /the third seal/))
r = cmd('status', admin)
ok('status: when, to how many, and that late arrivals get it', /The Signal: sent 0h ago to 6 players; anyone joining in the next 24h gets it too\./.test(r[11]), r[11])
T += 25 * 3600000
const finn = player('Finn', 0.5, 64, 0.5)
joins(finn); advance(100)
ok('someone joining after 24 hours: no Signal', !said(finn, /the third seal/) && !S().signal.told['finn-uuid'])
ok('... and status says when it went', /The Signal: sent 25h ago to 6 players\.$/.test(cmd('status', admin)[11]), cmd('status', admin)[11])
// the Summons needs all three braziers (it gives their directions)
const savedShrine = persistent.shrine
const noBrazier = JSON.parse(savedShrine); noBrazier.braziers[1] = null; persistent.shrine = JSON.stringify(noBrazier); load()
r = cmd('summons', admin)
ok('/shrine summons with a brazier not set: refused, says why', /Set the three braziers first/.test(r[0]) && !S().summons.at, r[0])
persistent.shrine = savedShrine; load()
players.forEach(p => { p.msgs = [] })
cmds = []
r = cmd('summons', admin)
const gives = cmds.filter(c => /^give \S+ minecraft:written_book\{/.test(c))
ok('/shrine summons: a book for everyone online; the reply gives the fires', gives.length == 7 && /A Summons went to 7 players/.test(r[0]) &&
  /the first about 1900 blocks toward the rising sun; the second about 500 blocks toward the setting sun; the third about 400 blocks north-east/.test(r[0]), r[0])
const summ = gives.find(c => /^give Carol /.test(c)) || ''
ok('... "A Summons", by the Blood God, 6 pages', /title:'A Summons'/.test(summ) && /author:'The Blood God'/.test(summ) && (summ.match(/'\["",/g) || []).length == 6, summ.slice(0, 120))
const sPages = (summ.match(/'(\[.*?\])'/g) || []).map(s => JSON.parse(s.slice(1, -1).replace(/\\'/g, "'").replace(/\\\\/g, '\\')))
const sText = sPages.map(pg => pg.map(x => (typeof x == 'string' ? x : x.text)).join(''))
ok('... page 1 opens in the Blood God\'s red: "BLOOD FOR THE BLOOD GOD."', sPages.length == 6 && sPages[0][1].color == 'dark_red' && sPages[0][1].bold &&
  sText[0] == 'BLOOD FOR THE BLOOD GOD.\n\nYou have bled for their seals. Two lie broken. The third still holds.', sText[0])
ok('... page 3: the three fires, each from the castle as the braziers stand, "the first:" in red italics', sPages[2][2].text == 'the first: ' && sPages[2][2].italic &&
  sText[2] == 'Three fires wait in three far places:\n\nthe first: about 1900 blocks toward the rising sun\nthe second: about 500 blocks toward the setting sun\nthe third: about 400 blocks north-east', sText[2])
ok('... the last page: "They want the Pool full. So do I."', sText[5] == 'They want the Pool full.\n\nSo do I.', sText[5])
// as the Regalia pages: 14 lines a page, about 19 characters a line (14 for page 1's bold capitals)
const plainLines = t => t.split('\n').reduce((n, para) => n + Math.max(1, Math.ceil(para.length / 19)), 0)
ok('... every page fits a book page', pageLines(sText[0]) <= 14 && sText.every(t => plainLines(t) <= 14 && t.length < 256), sText.map(plainLines).join(','))
ok('... and the Ministry isn\'t named', !sText.some(t => /Ministry/.test(t)))
const gwen = player('Gwen', 0.5, 64, 0.5)
cmds = []
joins(gwen); advance(100)
const gwenBook = cmds.find(c => /^give Gwen /.test(c)) || ''
ok('someone joining later gets the book 5 seconds in, and is told', !!gwenBook && said(gwen, /A book was left for you: A Summons\./) && S().summons.given['gwen-uuid'] == 'Gwen')
ok('... the same book as everyone else', gwenBook.replace(/^give Gwen /, '') == summ.replace(/^give Carol /, ''))
cmds = []; gwen.msgs = []; joins(gwen); advance(100)
ok('... once only', !cmds.some(c => /^give Gwen/.test(c)) && !said(gwen, /A book was left/))
ok('status: how many have it, and that late arrivals get it', /The Summons: given to 8 players; late arrivals get it until the Awakening\./.test(cmd('status', admin)[12]), cmd('status', admin)[12])
const beforeAwake = persistent.shrine
const awoken = JSON.parse(beforeAwake); awoken.awake.state = 'done'; persistent.shrine = JSON.stringify(awoken); load()
const hal = player('Hal', 0.5, 64, 0.5)
cmds = []
joins(hal); advance(100)
ok('after the Awakening: no more books', !cmds.some(c => /^give Hal/.test(c)) && !said(hal, /A book was left/) && /The Summons: given to 8 players\.$/.test(cmd('status', admin)[12]), cmd('status', admin)[12])
persistent.shrine = beforeAwake; load()
cmd('reset confirm', admin); advance(40)
ok('/shrine reset confirm forgets the Signal and the Summons', !S().signal.at && !S().summons.at && /The Signal: not sent/.test(cmd('status', admin)[11]) && /The Summons: not given/.test(cmd('status', admin)[12]))
;[eve, finn, gwen, hal].forEach(p => players.splice(players.indexOf(p), 1))
// the saved data survives a reload
load()
ok('the sites survive a /reload', S().site.x == 1000 && S().braziers[2].z == -300)
persistent.shrine = '{not json'
load()
ok('unreadable saved data: a copy is kept and it starts fresh', S().site == null && Object.keys(persistent).some(k => /^shrine_unreadable_/.test(k)) && logs.some(l => /could not be read/.test(l)))

console.log(logs.filter(l => /^ERR /.test(l) && !/Layer 23|could not be read/.test(l)).join('\n') || '(no unexpected errors logged)')
console.log(fails ? fails + ' FAILED' : 'ALL PASSED')
