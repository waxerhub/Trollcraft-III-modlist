// Run with: node tools/tests/run_all.js portal_ambush   (or node tools/tests/suites/portal_ambush.test.js)
const REPO_ROOT = require('path').resolve(__dirname, '..', '..', '..')
// Mock KubeJS 6 server for portal_ambush.js
const fs = require('fs')
const SRC_NEW = fs.readFileSync(REPO_ROOT + '/tools/kubejs/server_scripts/factions/portal_ambush.js', 'utf8')
// The older rules (real portals only; a portal is an escape) for the original checks; the new rules are tested at the end.
const SRC = SRC_NEW.replace('const ARRIVALS_NEED_PORTAL = false', 'const ARRIVALS_NEED_PORTAL = true').replace('const FOLLOW_ACROSS_DIMENSIONS = true', 'const FOLLOW_ACROSS_DIMENSIONS = false')
let fails = 0
const ok = (l, c, e) => { console.log((c ? 'ok   ' : 'FAIL ') + l + (e !== undefined && !c ? '  ' + e : '')); if (!c) fails++ }

const OW = 'minecraft:overworld', NE = 'minecraft:the_nether'
const W = { time: 1e12, tick: 0, q: [], cmds: [], logs: [], drops: [], persistent: {}, difficulty: 'NORMAL', portals: {}, entities: [] }
const Datex = { now: () => W.time }
class Exit extends Error {}

// ---------- world ----------
function blockAt(dim, x, y, z) {
  const k = dim + ':' + x + ',' + y + ',' + z
  if (W.portals[k]) return 'minecraft:nether_portal'
  if (dim == NE) return y >= 127 ? 'minecraft:bedrock' : (y <= 40 ? 'minecraft:netherrack' : 'minecraft:air')
  return y <= 64 ? 'minecraft:stone' : 'minecraft:air'
}
const levels = {}
;[OW, NE].forEach(d => {
  levels[d] = {
    dimension: { toString: () => d },
    getBlock: (x, y, z) => { const id = blockAt(d, x, y, z); return { id, blockState: { blocksMotion: () => id != 'minecraft:air' && id != 'minecraft:nether_portal' } } },
    getSharedSpawnPos: () => ({ getX: () => 0, getY: () => 65, getZ: () => 0 }),
    getDifficulty: () => ({ toString: () => W.difficulty }),
  }
})
function tags(arr) { return { contains: t => arr.indexOf(t) >= 0, isEmpty: () => arr.length == 0, add: t => arr.push(t), arr } }
let uid = 0
function entity(type, dim, x, y, z, tagList, extra) {
  uid++
  const e = Object.assign({
    type, dim, x, y, z, _tags: tagList || [], uuid: 'e' + uid + '-0000', removed: false, alive: true, target: null, memories: {},
    get level() { return levels[this.dim] },
    getTags() { return tags(this._tags) }, getStringUuid() { return this.uuid }, getUuid() { return 'J' + this.uuid },
    getX() { return this.x }, getY() { return this.y }, getZ() { return this.z },
    isRemoved() { return this.removed }, isAlive() { return this.alive && !this.removed },
    discard() { this.removed = true }, isPlayer: () => false,
    getRemovalReason() { return this.unloaded ? { shouldDestroy: () => false } : this.removed ? { shouldDestroy: () => true } : null }, getEncodeId() { return type }, addTag(t) { this._tags.push(t); return true },
    getBrain() { const self = this; return { setMemoryWithExpiry: (k, v, t) => { self.memories[k] = v }, setMemory: (k, v) => { self.memories[k] = v } } },
    setTarget(t) { this.target = t }, getTarget() { return this.target },
    get block() { const self = this; return { popItem: item => W.drops.push({ item: item.id, count: item.count, by: self.type }) } },
  }, extra || {})
  return e
}
function player(name, faction, dim, x, y, z) {
  const p = entity('minecraft:player', dim, x, y, z, [], {
    name, faction, inbox: [], creative: false,
    getGameProfile() { return { getName: () => this.name } }, isPlayer: () => true, getEncodeId: () => null,
    isCreative() { return this.creative }, isSpectator: () => false, tell(c) { this.inbox.push(c.json || String(c)) },
  })
  p.uuid = name.toLowerCase() + '-1111'
  return p
}
const players = []
const server = {
  get players() { return { size: () => players.length, get: i => players[i] } },
  get entities() { const all = W.entities.filter(e => !e.removed).concat(players); return { size: () => all.length, get: i => all[i] } },
  get overworld() { return () => levels[OW] },
  get tickCount() { return W.tick },
  getPlayerList: () => ({ getPlayer: u => players.find(p => p.uuid == u) || null }),
  persistentData: { getString: k => W.persistent[k] || '', putString: (k, v) => { W.persistent[k] = String(v) } },
  scheduleInTicks: (n, f) => W.q.push([W.tick + n, f]),
  runCommandSilent(c) {
    W.cmds.push(c)
    let m = c.match(/^execute in (\S+) run summon (\S+) (\S+) (\S+) (\S+) (\{.*\})$/)
    if (m && m[2] != 'minecraft:item') {
      const tagList = (m[6].match(/Tags:\[([^\]]*)\]/)[1]).split(',').map(s => s.replace(/"/g, ''))
      const e = entity(m[2], m[1], +m[3], +m[4], +m[5], tagList, { nbt: m[6] })
      if (!fireSpawn(e)) return 1
      W.entities.push(e)
      return 1
    }
    if (m) { W.drops.push({ item: 'summon', cmd: c }); return 1 }
    if ((m = c.match(/^kill @e\[tag=(\S+)\]$/))) {
      let n = 0
      W.entities.filter(e => !e.removed && e._tags.indexOf(m[1]) >= 0).forEach(e => { fire('death', { entity: e, source: {} }); e.removed = true; n++ })
      return n
    }
    if ((m = c.match(/^execute in (\S+) run tp (\S+) (\S+) (\S+) (\S+)$/))) {
      const e = W.entities.find(x => !x.removed && x.uuid == m[2]); if (!e) return 0
      e.dim = m[1]; e.x = +m[3]; e.y = +m[4]; e.z = +m[5]; return 1
    }
    if (c == 'difficulty') return W.difficulty == 'PEACEFUL' ? 0 : 2
    return 1
  },
}
const Utils = { server: null }

// ---------- Factions stub ----------
const flist = {}
const Factions = { getFaction: p => p.faction || 'unregistered', on: (n, cb) => { (flist[n] = flist[n] || []).push(cb) } }
const emit = (n, ...a) => (flist[n] || []).forEach(cb => cb(...a))
function travel(p, to, viaPortal, how) {
  const from = p.dim
  emit('leftDimension', p, p.faction, from, how || 'travel')
  p.dim = to
  if (viaPortal) W.portals[to + ':' + Math.floor(p.x) + ',' + Math.floor(p.y) + ',' + Math.floor(p.z)] = true
  emit('enteredDimension', p, p.faction, from, to, how || 'travel')
}

// ---------- KubeJS ----------
let handlers, root
const Java = { loadClass: n => ({
  'net.minecraft.world.entity.ai.memory.MemoryModuleType': { ANGRY_AT: 'angry_at', ATTACK_TARGET: 'attack_target', WALK_TARGET: 'walk_target' },
  'net.minecraft.world.entity.ai.memory.WalkTarget': function (t) { this.t = t },
  'net.minecraft.network.chat.Component$Serializer': { fromJson: () => { throw new Error('InternalError: The choice of Java method ... fromJson matching JavaScript argument types (string) is ambiguous') }, fromJsonLenient: s => ({ json: s }) },
  'java.util.UUID': { fromString: s => s },
})[n] || (() => { throw new Error('no class ' + n) })() }
const mkText = t => ({ text: String(t), append(o) { this.text += o.text; return this } })
const Text = { red: mkText, gold: mkText, yellow: mkText, of: mkText }
const Item = { of: (id, count) => ({ id, count }) }
function fire(n, ev) { for (const h of handlers[n] || []) { try { h(ev) } catch (e) { if (e instanceof Exit) { ev.cancelled = true; return } throw e } } }
function fireSpawn(e) { const ev = { entity: e, cancel() { throw new Exit() } }; fire('spawned', ev); return !ev.cancelled }
const node = (n, type) => ({ n, type, ch: [], then(c) { this.ch.push(c); return this }, requires() { return this }, executes(f) { this.f = f; return this } })
const glob = {}
function load(src) {
  handlers = {}
  for (const k in flist) delete flist[k]
  const on = name => f => { (handlers[name] = handlers[name] || []).push(f) }
  const ev = { commands: { literal: n => node(n, 'lit'), argument: (n, t) => node(n, t) },
    arguments: { PLAYER: { create: () => 'player', getResult: (ctx, n) => ctx.args[n] } }, register: r => { root = r } }
  glob.Factions = Factions
  new Function('PlayerEvents', 'EntityEvents', 'ServerEvents', 'Utils', 'Text', 'Item', 'console', 'global', 'Java', 'Date', src)(
    { loggedOut: on('loggedOut'), loggedIn: on('loggedIn') }, { hurt: on('hurt'), death: on('death'), spawned: on('spawned') },
    { loaded: on('loaded'), commandRegistry: f => f(ev) }, Utils, Text, Item,
    { info: m => W.logs.push('I ' + m), warn: m => W.logs.push('W ' + m), error: m => W.logs.push('E ' + m) }, glob, Java, Datex)
}
const replies = []
function cmd(line, as) {
  const toks = line.split(' ')
  let n = root, args = {}
  for (let i = 1; i < toks.length; i++) {
    let lit = n.ch.find(c => c.type == 'lit' && c.n == toks[i])
    if (lit) { n = lit; continue }
    let a = n.ch.find(c => c.type != 'lit'); args[a.n] = players.find(p => p.name == toks[i]); n = a
  }
  return n.f({ args, source: { server, sendSystemMessage: t => replies.push(t.text) } })
}
function advance(ticks) { for (let i = 0; i < ticks; i++) { W.tick++; W.time += 50; const due = W.q.filter(x => x[0] <= W.tick); W.q = W.q.filter(x => x[0] > W.tick); due.forEach(x => x[1]()) } }
const mobs = () => W.entities.filter(e => !e.removed && e._tags.indexOf('portal_ambush') >= 0)
const S = () => glob.portalAmbushState
const groups = () => Object.values(S().groups)
const msgs = p => p.inbox.join('\n')
const set = (src, a, b) => { if (src.indexOf(a) < 0) throw new Error('no ' + a); return src.replace(a, b) }
function resetWorld() { W.entities = []; W.drops = []; players.forEach(p => { p.inbox = [] }); }

// ===== load with certain rolls =====
let SRC1 = set(set(SRC, 'NETHER_AMBUSH_CHANCE = 0.5', 'NETHER_AMBUSH_CHANCE = 1'), 'OVERWORLD_PATROL_CHANCE = 0.5', 'OVERWORLD_PATROL_CHANCE = 1')
load(SRC1)
Utils.server = server
fire('loaded', { server })
const bob = player('Bob', 'ministry', OW, 500.5, 65, 500.5)
const cara = player('Cara', 'ministry', OW, 501.5, 65, 500.5)
const dan = player('Dan', 'syndicate', NE, 300.5, 41, 300.5)
const alice = player('Alice', 'unregistered', OW, 900.5, 65, 900.5)
players.push(bob, cara, dan, alice)

// --- Mechanic 1 ---
bob.y = 41; travel(bob, NE, false)
advance(80)
ok('/tp into the Nether (no portal block) does not trigger', mobs().length == 0)
bob.dim = OW; bob.y = 65
bob.y = 41; travel(bob, NE, false, 'respawn'); W.portals[NE + ':500,41,500'] = true
advance(80)
ok('respawning next to a portal does not trigger', mobs().length == 0)
bob.dim = OW; delete W.portals[NE + ':500,41,500']
bob.y = 41; travel(bob, NE, true)
advance(40)
ok('nothing before the 3-second delay', mobs().length == 0)
advance(30)
let g = groups()[0]
ok('war party of 3 after 3 s', g && mobs().length == 3 && g.mechanic == 'nether_ambush', mobs().length)
ok('mobs are piglins/brutes with the right NBT', mobs().every(m => /piglin/.test(m.type) && /IsImmuneToZombification:1b/.test(m.nbt) && /CanPickUpLoot:0b/.test(m.nbt) && /color:9109504/.test(m.nbt) && /Blood-Marked Piglin/.test(m.nbt) && /CustomNameVisible:1b/.test(m.nbt) && /DeathLootTable:"minecraft:empty"/.test(m.nbt) && /ArmorDropChances:\[0f,0f,0f,0f\]/.test(m.nbt)))
ok('each mob has the group tag', mobs().every(m => m._tags.indexOf('portal_ambush_g_' + g.id) >= 0))
ok('spawned 8-10 blocks from the arrival point, on safe ground below the roof', mobs().every(m => { const d = Math.hypot(m.x - 500.5, m.z - 500.5); return d >= 7.2 && d <= 10.8 && m.y == 41 }), mobs().map(m => [m.x, m.y, m.z]).join(' '))
ok('only Bob gets the message', /Blood for the Blood God/.test(msgs(bob)) && !msgs(cara) && !msgs(dan) && !msgs(alice))
ok('no tellraw @a / broadcast', !W.cmds.some(c => /tellraw @a|title @a/.test(c)))
ok('piglins are pointed at Bob', mobs().every(m => m.memories.angry_at == 'J' + bob.uuid))

// targeting and damage filters
const hook = glob.portalAmbushHooks
const changeEv = (m, t) => ({ cancelled: false, getEntity: () => m, getNewTarget: () => t, setCanceled(v) { this.cancelled = v } })
let ce = changeEv(mobs()[0], alice); hook.onChangeTarget(ce)
let ce2 = changeEv(mobs()[0], bob); hook.onChangeTarget(ce2)
let ce3 = changeEv(mobs()[0], mobs()[1]); hook.onChangeTarget(ce3)
let ce4 = changeEv(mobs()[0], dan); hook.onChangeTarget(ce4)
ok('change-target: Alice, Dan, another ambush mob refused; Bob allowed', ce.cancelled && ce4.cancelled && ce3.cancelled && !ce2.cancelled)
const hurt = (attacker, victim) => { const e = { entity: victim, source: { actual: attacker }, cancel() { throw new Exit() } }; fire('hurt', e); return !!e.cancelled }
ok('damage: to Bob allowed; to Dan, Alice and another ambush mob blocked', !hurt(mobs()[0], bob) && hurt(mobs()[0], dan) && hurt(mobs()[0], alice) && hurt(mobs()[0], mobs()[1]))
const normalPiglin = entity('minecraft:piglin', NE, 0, 41, 0, [])
ok('damage to a normal piglin blocked; players hitting mobs untouched', hurt(mobs()[0], normalPiglin) && !hurt(bob, mobs()[0]))

// drops
let m0 = mobs()[0]
fire('death', { entity: m0, source: { actual: bob } }); m0.removed = true
ok('kill reward: 1-3 gold nuggets, nothing else', W.drops.length == 1 && W.drops[0].item == 'minecraft:gold_nugget' && W.drops[0].count >= 1 && W.drops[0].count <= 3, JSON.stringify(W.drops))
advance(20)
ok('group tracks the dead mob', Object.keys(g.mobs).length == 2)

// escape
travel(bob, OW, true)
advance(20)
ok('Bob escaping through the portal ends the group (he was the only target), mobs removed quietly', !S().groups[g.id] && mobs().length == 0 && W.drops.length == 1)
ok('Bob now has a cooldown', /cooldown \d+:\d+/.test((cmd('ambush timer Bob'), replies[replies.length - 1])) && !/cooldown none/.test(replies[replies.length - 1]), replies[replies.length - 1])
bob.inbox = []
bob.dim = OW; travel(bob, NE, true); advance(80)
ok('cooldown: no new ambush on the next portal trip', mobs().length == 0 && !msgs(bob))

// group roll: Cara + Eve arrive together
const eve = player('Eve', 'ministry', OW, 600.5, 65, 600.5); players.push(eve)
cara.x = 600.5; cara.z = 600.5; cara.y = 41; eve.y = 41
travel(cara, NE, true)
advance(20)
eve.x = 601.5; travel(eve, NE, true)
advance(60)
g = groups()[0]
ok('two players through the same portal: one shared group, 3 + 1 mobs', groups().length == 1 && g.targets.length == 2 && mobs().length == 4, groups().length + ' ' + mobs().length)
ok('both are told', /Blood for/.test(msgs(cara)) && /Blood for/.test(msgs(eve)))

// getting away no longer works: the mobs come to them
cara.x += 200; eve.x += 200
advance(20 * 30)
ok('targets far away: the group is still there after 30 s, and its mobs came to them', !!S().groups[g.id] && mobs().every(m => Math.min(Math.abs(m.x - cara.x), Math.abs(m.x - eve.x)) <= 12),
  mobs().map(m => m.x).join(','))
// lost-target despawn: now only when no target can be fought (offline, creative, spectator)
cara.creative = true; eve.creative = true
advance(20 * 30)
ok('targets out of the game: group still there after 30 s', !!S().groups[g.id])
advance(20 * 32)
ok('... and gone after 60 s, quietly', !S().groups[g.id] && mobs().length == 0)
cara.creative = false; eve.creative = false
cmd('ambush timer Cara')
ok('Cara and Eve get cooldowns', !/cooldown none/.test(replies[replies.length - 1]))

// --- Mechanic 2 + secrecy ---
dan.x = 400.5; dan.z = 400.5; dan.y = 65
alice.dim = OW; alice.x = 420.5; alice.z = 400.5
dan.dim = NE; travel(dan, OW, true)
advance(80)
ok('return inspection skipped silently with a non-syndicate player within 48 blocks', mobs().length == 0 && !msgs(dan))
alice.x = 900.5
dan.dim = NE; W.time += 20000; travel(dan, OW, true)
advance(80)
g = groups()[0]
ok('inspection patrol of 2 when nobody is watching', g && g.mechanic == 'return_inspection' && mobs().length == 2)
ok('patrol: vindicators/pillagers, gold chestplate, no raids', mobs().every(m => /vindicator|pillager/.test(m.type) && /CanJoinRaid:0b/.test(m.nbt) && /PatrolLeader:0b/.test(m.nbt) && /color:13938487/.test(m.nbt) && /Ministry Inspector/.test(m.nbt)))
ok('illagers target Dan', mobs().every(m => m.target === dan))
ok('Dan gets the inspection message', /Routine border inspection/.test(msgs(dan)))
ok('a ministry player is not a valid target for the patrol', hurt(mobs()[0], bob))
let pm = mobs()[0]; fire('death', { entity: pm, source: { actual: dan } }); pm.removed = true
ok('inspector reward is 0-1 emerald', W.drops.filter(d => d.item == 'minecraft:emerald').every(d => d.count == 1) && !W.drops.some(d => d.item == 'minecraft:gold_nugget' && d.by != 'minecraft:piglin' && d.by != 'minecraft:piglin_brute'))
cmd('ambush clear')
ok('/ambush clear removes everything', groups().length == 0 && mobs().length == 0)

// --- safe zone near world spawn ---
const fay = player('Fay', 'syndicate', NE, 10.5, 65, 10.5); players.push(fay)
travel(fay, OW, true); advance(80)
ok('no inspection within 64 blocks of world spawn', mobs().length == 0)

// --- caps ---
let SRC2 = set(SRC1, 'const SERVER_MAX_MOBS = 24', 'const SERVER_MAX_MOBS = 4')
load(SRC2); resetWorld()
const gus = player('Gus', 'ministry', NE, 700.5, 41, 700.5); players.push(gus)
cmd('ambush test nether Gus'); advance(70)
ok('test nether: 3 mobs', mobs().length == 3)
const hal = player('Hal', 'ministry', NE, 800.5, 41, 800.5); players.push(hal)
cmd('ambush test nether Hal'); advance(70)
ok('server-wide cap: second group only gets 1 more (cap 4)', mobs().length == 4, mobs().length)
cmd('ambush clear')

// --- Mechanic 3: raids ---
// short countdowns, and always a moderate raid (today's raid)
let SRC3 = set(set(set(set(set(SRC, 'RAID_MINUTES[NETHER] = [10, 10]', 'RAID_MINUTES[NETHER] = [0.1, 0.1]'), 'RAID_MINUTES[OVERWORLD] = [10, 10]', 'RAID_MINUTES[OVERWORLD] = [0.1, 0.1]'),
  "id: 'light', chance: 0.50", "id: 'light', chance: 0"), "id: 'moderate', chance: 0.25", "id: 'moderate', chance: 1"), "id: 'lethal', chance: 0.10", "id: 'lethal', chance: 0")
W.persistent = {}
load(SRC3); resetWorld()
players.length = 0
const ian = player('Ian', 'ministry', NE, 1000.5, 41, 1000.5)
players.push(ian)
emit('enteredDimension', ian, 'ministry', null, NE, 'login')
advance(20 * 2)
let data = JSON.parse(W.persistent.portal_ambush || '{"raid":{}}')
advance(20 * 4)
ok('raid countdown runs out: warning first', /The Blood God has found you/.test(msgs(ian)) && mobs().length == 0, msgs(ian))
advance(20 * 3 + 5)
g = groups()[0]
ok('raid arrives 3 s later, a moderate raid of 3-5 mobs', g && g.mechanic == 'raid' && g.tier == 'moderate' && mobs().length >= 3 && mobs().length <= 5, mobs().length)
ok('raid mobs 8-10 blocks away', mobs().every(m => { const d = Math.hypot(m.x - 1000.5, m.z - 1000.5); return d >= 7.2 && d <= 10.8 }), mobs().map(m => Math.hypot(m.x - 1000.5, m.z - 1000.5).toFixed(1)).join(' '))
cmd('ambush clear')
// Overworld raid with a witness: postponed
const jo = player('Jo', 'syndicate', OW, 2000.5, 65, 2000.5), kim = player('Kim', 'unregistered', OW, 2010.5, 65, 2000.5)
players.push(jo, kim)
cmd('ambush test raid Jo')
ok('overworld test raid postponed with a witness nearby', /postponed/.test(replies[replies.length - 1]) && mobs().length == 0, replies[replies.length - 1])
cmd('ambush timer Jo')
ok('postponement shows in the timer (2-5 minutes)', /postponed moderate raid, 1\/3/.test(replies[replies.length - 1]), replies[replies.length - 1])
kim.x = 5000
cmd('ambush test raid Jo'); advance(70)
ok('without the witness the raid comes: [MINISTRY] warning + patrol', /Inspectors have been dispatched/.test(msgs(jo)) && mobs().length >= 2 && mobs().every(m => /vindicator|pillager/.test(m.type)))
cmd('ambush clear')

// persistence across reload
W.persistent = {}
let SRC4 = SRC
load(SRC4); resetWorld(); players.length = 0
const lou = player('Lou', 'ministry', NE, 3000.5, 41, 3000.5); players.push(lou)
emit('enteredDimension', lou, 'ministry', null, NE, 'login')
advance(20 * 20)
let before = JSON.parse(W.persistent.portal_ambush).raid[lou.uuid].left
ok('countdown 10 minutes, saved', before >= 10 * 60 - 25 && before <= 10 * 60, before)
load(SRC4)   // /reload
advance(20 * 20)
let after = JSON.parse(W.persistent.portal_ambush).raid[lou.uuid].left
ok('/reload keeps the countdown (it keeps counting down, no reset)', after < before && after >= before - 25, before + ' -> ' + after)
lou.dim = OW
advance(20 * 5)
let paused1 = JSON.parse(W.persistent.portal_ambush).raid[lou.uuid].left
advance(20 * 60)
let paused = JSON.parse(W.persistent.portal_ambush).raid[lou.uuid].left
ok('countdown pauses outside the hostile dimension (saved when the loop stops)', paused == paused1, paused1 + ' -> ' + paused)
ok('loop stops when nobody needs it', W.q.length == 0)
lou.dim = NE
emit('enteredDimension', lou, 'ministry', OW, NE, 'travel')
W.difficulty = 'PEACEFUL'
advance(20 * 20)
let pz = JSON.parse(W.persistent.portal_ambush || '{}').raid[lou.uuid].left
advance(20 * 20)
ok('Peaceful pauses countdowns', JSON.parse(W.persistent.portal_ambush).raid[lou.uuid].left >= pz - 1)
W.difficulty = 'NORMAL'

// toggle
cmd('ambush toggle')
ok('toggle off is saved', JSON.parse(W.persistent.portal_ambush).enabled === false)
lou.dim = OW; travel(lou, NE, true); advance(80)
ok('while off: no ambush, data kept', mobs().length == 0 && JSON.parse(W.persistent.portal_ambush).raid[lou.uuid])
cmd('ambush toggle')

// stray removal
const stray = entity('minecraft:piglin', NE, 1, 41, 1, ['portal_ambush', 'portal_ambush_g_old'])
ok('a leftover ambush mob loading from a chunk is removed', !fireSpawn(stray))
ok('normal piglins loading are untouched', fireSpawn(entity('minecraft:piglin', NE, 1, 41, 1, [])))

// status
cmd('ambush status')
ok('status shows hooks not loaded (no startup script in the mock)', /hooks: NOT loaded/.test(replies.find(r => /hooks:/.test(r)) || ''))

// ----- arrival reasons and outdated core -----
load(SRC); resetWorld(); players.length = 0
const max = player('Max', 'ministry', OW, 4000.5, 41, 4000.5); players.push(max)
max.creative = true
travel(max, NE, true)
cmd('ambush timer Max')
ok('timer explains a skipped arrival (creative)', /Last trip .*overworld -> the_nether \(travel\): skipped: in creative or spectator/.test(replies[replies.length - 1]), replies[replies.length - 1])
max.creative = false; max.dim = OW; max.x += 20
travel(max, NE, false)
cmd('ambush timer Max')
ok('timer explains a /tp arrival', /no Nether portal where they arrived/.test(replies[replies.length - 1]), replies[replies.length - 1])
max.dim = OW; max.x += 50
travel(max, NE, true)
cmd('ambush timer Max')
ok('timer shows the roll', /rolled \d+%|roll succeeded/.test(replies[replies.length - 1]), replies[replies.length - 1])
max.dim = OW; W.logs = []
emit('enteredDimension', max, 'ministry', OW, NE)   // an old factions_core.js: no "how"
cmd('ambush status')
ok('outdated factions_core.js is reported', replies.some(r => /factions_core.js is OUTDATED/.test(r)) && W.logs.some(l => /outdated/.test(l)))
cmd('ambush clear')

// same player back through the same portal within 10 s: a fresh roll, not their own earlier one
load(set(SRC, 'const NETHER_AMBUSH_CHANCE = 0.5', 'const NETHER_AMBUSH_CHANCE = 0')); resetWorld(); players.length = 0
const ned = player('Ned', 'ministry', OW, 5000.5, 41, 5000.5); players.push(ned)
travel(ned, NE, true); advance(20)
ned.dim = OW; travel(ned, NE, true)
cmd('ambush timer Ned')
ok('re-arrival within 10 s gets its own roll', /rolled \d+%/.test(replies[replies.length - 1]) && !/shared/.test(replies[replies.length - 1]), replies[replies.length - 1])
// portal cooldown counts as a portal trip even without a portal block (a mod moved the player)
load(set(SRC, 'const NETHER_AMBUSH_CHANCE = 0.5', 'const NETHER_AMBUSH_CHANCE = 1')); resetWorld(); players.length = 0
const oz = player('Oz', 'ministry', OW, 6000.5, 41, 6000.5); players.push(oz)
oz.isOnPortalCooldown = () => true
travel(oz, NE, false); advance(80)
ok('portal cooldown alone is enough to count as a portal trip', mobs().length == 3, mobs().length)
cmd('ambush clear')
oz.isOnPortalCooldown = () => false; W.time += 3600e3
oz.dim = OW; oz.x += 100; travel(oz, NE, false)
cmd('ambush timer Oz')
ok('no cooldown and no portal block: teleport', /no Nether portal where they arrived/.test(replies[replies.length - 1]), replies[replies.length - 1])
// non-hunted trips are explained too
const pia = player('Pia', 'unregistered', OW, 7000.5, 41, 7000.5); players.push(pia)
travel(pia, NE, true)
cmd('ambush timer Pia')
ok('timer explains a trip that is not hunted', /overworld -> the_nether \(travel\): faction "unregistered" isn't hunted in the_nether/.test(replies[replies.length - 1]), replies[replies.length - 1])
const quin = player('Quin', 'ministry', NE, 7100.5, 41, 7100.5); players.push(quin)
cmd('ambush timer Quin')
ok('timer with no trip seen', /No dimension change seen since the server started/.test(replies[replies.length - 1]), replies[replies.length - 1])
// a broken check is reported, not silent
const rae = player('Rae', 'ministry', OW, 7200.5, 41, 7200.5); players.push(rae)
rae.isOnPortalCooldown = () => { throw new Error('x') }
const lv = levels[NE].getBlock; levels[NE].getBlock = () => { throw new Error('boom') }
travel(rae, NE, true)
levels[NE].getBlock = lv
cmd('ambush timer Rae')
ok('an error in the arrival check shows in the timer and the log', /error: .*boom/.test(replies[replies.length - 1]) && W.logs.some(l => /Portal arrival check failed/.test(l)), replies[replies.length - 1])
W.logs = W.logs.filter(l => !/Portal arrival check failed/.test(l))

// ----- mob strength: the summon NBT parses and carries weapons, enchantments, stats and ammo -----
function snbt(src) {
  let i = 0
  const ws = () => { while (/\s/.test(src[i])) i++ }
  const val = () => {
    ws()
    if (src[i] == '{') { i++; const o = {}; ws(); if (src[i] == '}') { i++; return o }
      for (;;) { ws(); let k = src[i] == '"' || src[i] == "'" ? str() : src.slice(i).match(/^[A-Za-z0-9_.+-]+/)[0]; if (typeof k != 'string') throw 0; if (k == src.slice(i, i + k.length)) i += k.length
        ws(); if (src[i++] != ':') throw new Error('expected : at ' + i); o[k] = val(); ws(); if (src[i] == ',') { i++; continue } if (src[i++] != '}') throw new Error('expected } at ' + i); return o } }
    if (src[i] == '[') { i++; const a = []; ws(); if (src[i] == ']') { i++; return a }
      for (;;) { a.push(val()); ws(); if (src[i] == ',') { i++; continue } if (src[i++] != ']') throw new Error('expected ] at ' + i); return a } }
    if (src[i] == '"' || src[i] == "'") return str()
    const m = src.slice(i).match(/^-?[0-9.]+[bsfdL]?|^[A-Za-z_][A-Za-z0-9_.:+-]*/)
    if (!m) throw new Error('bad value at ' + i + ': ' + src.slice(i, i + 20))
    i += m[0].length; return m[0]
  }
  const str = () => { const q = src[i++]; let out = ''; while (src[i] != q) { if (src[i] == '\\') i++; out += src[i++]; if (i > src.length) throw new Error('unterminated') } i++; return out }
  const v = val(); ws(); if (i != src.length) throw new Error('trailing at ' + i); return v
}
load(SRC); resetWorld(); players.length = 0; W.cmds = []
const sam = player('Sam', 'ministry', NE, 8000.5, 41, 8000.5); players.push(sam)
for (let k = 0; k < 6; k++) { cmd('ambush test nether Sam'); advance(70); cmd('ambush clear') }
const tim = player('Tim', 'syndicate', OW, 9000.5, 65, 9000.5); players.push(tim)
for (let k = 0; k < 6; k++) { cmd('ambush test overworld Tim'); advance(70); cmd('ambush clear') }
const sums = W.cmds.filter(c => / run summon /.test(c) && !/minecraft:item/.test(c)).map(c => ({ type: c.split(' ')[5], nbt: c.slice(c.indexOf('{')) }))
let parsed = []
try { parsed = sums.map(x => ({ type: x.type, t: snbt(x.nbt) })) } catch (e) { ok('summon NBT parses', false, e.message) }
ok('summon NBT parses (' + parsed.length + ' mobs)', parsed.length >= 20)
const attr = (t, n) => { const a = t.Attributes.find(x => x.Name == 'minecraft:generic.' + n); return a ? parseFloat(a.Base) : null }
ok('every mob has its health, damage, armour and toughness', parsed.every(x => { const k = { 'minecraft:piglin': 'piglin', 'minecraft:piglin_brute': 'brute', 'minecraft:vindicator': 'vindicator', 'minecraft:pillager': 'pillager' }[x.type]
  return k && attr(x.t, 'max_health') > 30 && parseFloat(x.t.Health) == attr(x.t, 'max_health') && attr(x.t, 'attack_damage') >= 5 && attr(x.t, 'armor') > 0 && attr(x.t, 'armor_toughness') > 0 && attr(x.t, 'follow_range') == 48 }))
ok('brutes and vindicators get Sharpness V netherite axes', parsed.filter(x => /brute|vindicator/.test(x.type)).every(x => x.t.HandItems[0].id == 'minecraft:netherite_axe' && x.t.HandItems[0].tag.Enchantments[0].id == 'minecraft:sharpness' && x.t.HandItems[0].tag.Enchantments[0].lvl == '5s'))
const pigs = parsed.filter(x => x.type == 'minecraft:piglin')
ok('piglins: netherite sword (Sharpness, Fire Aspect) or crossbow, empty off hand', pigs.length && pigs.every(x => (x.t.HandItems[0].id == 'minecraft:netherite_sword' && x.t.HandItems[0].tag.Enchantments.length == 2 || x.t.HandItems[0].id == 'minecraft:crossbow') && Object.keys(x.t.HandItems[1]).length == 0))
const pils = parsed.filter(x => x.type == 'minecraft:pillager')
ok('pillagers: crossbow + 64 Harming arrows in the off hand, nothing dropped', pils.length && pils.every(x => x.t.HandItems[0].id == 'minecraft:crossbow' && x.t.HandItems[1].id == 'minecraft:tipped_arrow' && x.t.HandItems[1].Count == '64b' && x.t.HandItems[1].tag.Potion == 'minecraft:harming' && x.t.HandDropChances.join() == '0f,0f'))

// ======================= Tiered raids (RAID_TIERS) =======================
const SRC_T = set(set(SRC, 'RAID_MINUTES[NETHER] = [10, 10]', 'RAID_MINUTES[NETHER] = [0.1, 0.1]'), 'RAID_MINUTES[OVERWORLD] = [10, 10]', 'RAID_MINUTES[OVERWORLD] = [0.1, 0.1]')
function tierRun(v, faction, dim, persist) {
  W.persistent = persist ? { portal_ambush: JSON.stringify(persist) } : {}
  load(SRC_T); resetWorld(); players.length = 0; W.cmds = []
  const y = dim == NE ? 41 : 65
  const p = player('Zed', faction, dim, 11000.5, y, 11000.5); players.push(p)
  const orig = Math.random
  Math.random = () => v
  try { emit('enteredDimension', p, faction, null, dim, 'login'); advance(20 * 12) } finally { Math.random = orig }
  return { p, g: groups()[0] }
}
const sumNbts = () => W.cmds.filter(c => / run summon /.test(c) && !/minecraft:item/.test(c)).map(c => ({ type: c.split(' ')[5], t: snbt(c.slice(c.indexOf('{'))) }))
{
  let r = tierRun(0.49, 'ministry', NE)
  const n = sumNbts()
  ok('roll 0.49: a light raid (usual warning), 2-3 piglins only', r.g && r.g.tier == 'light' && /The Blood God has found you/.test(msgs(r.p)) && mobs().length >= 2 && mobs().length <= 3 && mobs().every(m => m.type == 'minecraft:piglin'), r.g && r.g.tier + ' ' + mobs().length)
  ok('... light piglins: 30 health (x0.75), 7 attack (6.75 rounded), no Strength', n.every(x => attr(x.t, 'max_health') == 30 && parseFloat(x.t.Health) == 30 && attr(x.t, 'attack_damage') == 7) && !W.cmds.some(c => /effect give/.test(c)), JSON.stringify(n.map(x => [attr(x.t, 'max_health'), attr(x.t, 'attack_damage')])))
  r = tierRun(0.74, 'ministry', NE)
  ok('roll 0.74: a moderate raid (the normal war party, normal stats)', r.g && r.g.tier == 'moderate' && mobs().length >= 3 && mobs().length <= 5 && sumNbts().every(x => attr(x.t, 'max_health') == (x.type == 'minecraft:piglin' ? 40 : 90)), r.g && r.g.tier)
  r = tierRun(0.84, 'ministry', NE)
  ok('roll 0.84: a lethal raid with the lethal warning', r.g && r.g.tier == 'lethal' && /The Blood God demands your blood/.test(msgs(r.p)) && !/has found you/.test(msgs(r.p)), r.g && r.g.tier + ' ' + msgs(r.p))
  ok('... 6-8 mobs, at most 2 evokers', mobs().length >= 6 && mobs().length <= 8 && mobs().filter(m => m.type == 'minecraft:evoker').length <= 2, mobs().map(m => m.type).join(','))
  ok('... every mob but the vexes gets Strength I for good', mobs().filter(m => m.type != 'minecraft:vex').every(m => W.cmds.indexOf('effect give ' + m.uuid + ' minecraft:strength infinite 0 true') >= 0))
  ok('... vexes get Strength III and Speed III instead (no Strength I)', mobs().filter(m => m.type == 'minecraft:vex').every(m => W.cmds.indexOf('effect give ' + m.uuid + ' minecraft:strength infinite 2 true') >= 0 &&
    W.cmds.indexOf('effect give ' + m.uuid + ' minecraft:speed infinite 2 true') >= 0 && W.cmds.indexOf('effect give ' + m.uuid + ' minecraft:strength infinite 0 true') < 0), mobs().map(m => m.type).join(','))
  r = tierRun(0.86, 'ministry', NE)
  cmd('ambush timer Zed')
  ok('roll 0.86: nothing (no warning, no mobs, countdown restarted)', !r.g && !mobs().length && !r.p.inbox.length && /raid countdown 0:0\d \(then/.test(replies[replies.length - 1]), replies[replies.length - 1])
  r = tierRun(0.84, 'syndicate', OW)
  ok('Overworld lethal raid: [MINISTRY] "Lethal force has been authorised."', r.g && r.g.tier == 'lethal' && /Lethal force has been authorised/.test(msgs(r.p)) && !/Inspectors have been dispatched/.test(msgs(r.p)), msgs(r.p))
}
{
  // cooldown doesn't block raid rolls
  const r = tierRun(0.49, 'ministry', NE, { v: 1, enabled: true, cooldowns: { 'zed-1111': 1e15 }, raid: {} })
  ok('a player on cooldown still gets the raid roll', r.g && r.g.tier == 'light', r.g)
}
{
  // old long countdowns are cut to 10 min
  W.persistent = { portal_ambush: JSON.stringify({ v: 1, enabled: true, cooldowns: {}, raid: { 'zed-1111': { left: 4800, postpones: 0, postponed: false } } }) }
  load(SRC); resetWorld(); players.length = 0
  const p = player('Zed', 'ministry', NE, 11000.5, 41, 11000.5); players.push(p)
  emit('enteredDimension', p, 'ministry', null, NE, 'login'); advance(20 * 20)
  const left = JSON.parse(W.persistent.portal_ambush).raid[p.uuid].left
  ok('an 80-minute countdown saved under the old settings is cut to 10 minutes', left <= 600 && left >= 570, left)
  cmd('ambush timer Zed')
  ok('timer shows the odds', /light 50%, moderate 25%, lethal 10%, nothing 15%/.test(replies[replies.length - 1]), replies[replies.length - 1])
  cmd('ambush status')
  ok('status shows the roll and odds', replies.some(x => /raid roll every 10 min in the hostile dimension: light 50%, moderate 25%, lethal 10%, nothing 15%/.test(x)))
}
{
  // lethal stats, evokers and vexes, over a few test raids
  W.persistent = {}
  load(SRC); resetWorld(); players.length = 0; W.cmds = []
  const p = player('Zed', 'ministry', NE, 12000.5, 41, 12000.5); players.push(p)
  for (let k = 0; k < 8; k++) { cmd('ambush test raid Zed lethal'); advance(80); if (k < 7) cmd('ambush clear') }
  ok('/ambush test raid <player> lethal works', /lethal raid: warning sent/.test(replies[replies.length - 8 > 0 ? replies.length - 1 : 0]) || replies.some(x => /Raid on Zed: lethal raid: warning sent/.test(x)))
  const n = sumNbts(), by = t => n.filter(x => x.type == t)
  ok('lethal brutes: 135 health, 18 attack (17.5 rounded), Sharpness V netherite axe', by('minecraft:piglin_brute').length && by('minecraft:piglin_brute').every(x => attr(x.t, 'max_health') == 135 && parseFloat(x.t.Health) == 135 && attr(x.t, 'attack_damage') == 18 && x.t.HandItems[0].id == 'minecraft:netherite_axe'),
    JSON.stringify(by('minecraft:piglin_brute').map(x => [attr(x.t, 'max_health'), attr(x.t, 'attack_damage')])))
  ok('lethal evokers: 90 health, no weapon, not a raid captain, the war party name and chestplate', by('minecraft:evoker').length && by('minecraft:evoker').every(x => attr(x.t, 'max_health') == 90 && Object.keys(x.t.HandItems[0]).length == 0 &&
    x.t.CanJoinRaid == '0b' && /Blood-Marked Piglin/.test(x.t.CustomName)), by('minecraft:evoker').length)
  ok('lethal vexes: 30 health, 8 attack (7.5 rounded), Sharpness III iron sword', by('minecraft:vex').length && by('minecraft:vex').every(x => attr(x.t, 'max_health') == 30 && attr(x.t, 'attack_damage') == 8 && x.t.HandItems[0].id == 'minecraft:iron_sword' && x.t.HandItems[0].tag.Enchantments[0].lvl == '3s'),
    by('minecraft:vex').length)
  // an evoker's own vex joins its group; others are left alone
  for (let k = 0; k < 30 && !mobs().some(m => m.type == 'minecraft:evoker'); k++) { cmd('ambush clear'); cmd('ambush test raid Zed lethal'); advance(80) }
  const g = groups()[0], evo = mobs().find(m => m.type == 'minecraft:evoker')
  ok('(a lethal group with an evoker is up)', g && evo)
  if (g && evo) {
    const before = Object.keys(g.mobs).length
    const vex = entity('minecraft:vex', NE, 12001, 41, 12001, [], { getOwner: () => evo })
    ok('a vex summoned by a raid evoker spawns normally', fireSpawn(vex))
    advance(1)
    ok('... and a tick later gets Strength III and Speed III', W.cmds.indexOf('effect give ' + vex.uuid + ' minecraft:strength infinite 2 true') >= 0 && W.cmds.indexOf('effect give ' + vex.uuid + ' minecraft:speed infinite 2 true') >= 0)
    ok('... and joins its group (tagged, counted, marked summoned)', g.mobs[vex.uuid] === vex && S().mobGroup[vex.uuid] == g.id && vex._tags.indexOf('portal_ambush') >= 0 && vex._tags.indexOf('portal_ambush_g_' + g.id) >= 0 && vex._tags.indexOf('portal_ambush_summoned') >= 0 && Object.keys(g.mobs).length == before + 1)
    const other = entity('minecraft:evoker', NE, 0, 41, 0, [])
    const vex2 = entity('minecraft:vex', NE, 12001, 41, 12001, [], { getOwner: () => other })
    ok('a vex from some other evoker is left alone', fireSpawn(vex2) && vex2._tags.length == 0 && !g.mobs[vex2.uuid] && (advance(1), !W.cmds.some(c => c.indexOf(vex2.uuid) >= 0)))
    const vex3 = entity('minecraft:vex', NE, 12001, 41, 12001, [], { getOwner: () => { throw new Error('no getOwner') } })
    ok('a vex whose owner can\'t be read is left alone', fireSpawn(vex3) && vex3._tags.length == 0)
    W.drops = []
    fire('death', { entity: vex, source: {} })
    ok('killing a summoned vex drops no reward', W.drops.length == 0 && !g.mobs[vex.uuid])
    const piglinM = mobs().find(m => m.type != 'minecraft:vex' && m.type != 'minecraft:evoker') || evo
    W.drops = []
    for (let k = 0; k < 10; k++) { const pm = mobs().find(m => g.mobs[m.uuid] && m._tags.indexOf('portal_ambush_summoned') < 0); if (!pm) break; fire('death', { entity: pm, source: {} }); pm.removed = true }
    ok('killing the group\'s own mobs still drops gold nuggets sometimes', W.drops.some(d => d.item == 'minecraft:gold_nugget'), JSON.stringify(W.drops))
  }
  cmd('ambush clear')
  cmd('ambush test raid Zed light'); advance(80)
  ok('/ambush test raid <player> light', groups()[0] && groups()[0].tier == 'light')
  cmd('ambush clear')
  cmd('ambush test raid Zed'); advance(80)
  ok('/ambush test raid <player> with no tier rolls one (never nothing)', groups()[0] && ['light', 'moderate', 'lethal'].indexOf(groups()[0].tier) >= 0)
  cmd('ambush clear')
}
{
  // a postponed Overworld raid keeps its tier
  W.persistent = {}
  load(SRC); resetWorld(); players.length = 0; W.cmds = []
  const jo2 = player('Jo', 'syndicate', OW, 13000.5, 65, 13000.5), kim2 = player('Kim', 'unregistered', OW, 13010.5, 65, 13000.5)
  players.push(jo2, kim2)
  cmd('ambush test raid Jo lethal')
  cmd('ambush timer Jo')
  ok('postponed lethal raid shows in the timer', /postponed lethal raid, 1\/3/.test(replies[replies.length - 1]), replies[replies.length - 1])
  kim2.x = 50000
  emit('enteredDimension', jo2, 'syndicate', null, OW, 'login')
  advance(20 * 60 * 5 + 20 * 10)
  ok('... when it comes back, it is still lethal', groups()[0] && groups()[0].tier == 'lethal' && /Lethal force has been authorised/.test(msgs(jo2)), groups()[0] && groups()[0].tier)
  cmd('ambush clear')
}

// ======================= No getting away (the new rules) =======================
const SRC_N = set(set(SRC_NEW, 'NETHER_AMBUSH_CHANCE = 0.5', 'NETHER_AMBUSH_CHANCE = 1'), 'OVERWORLD_PATROL_CHANCE = 0.5', 'OVERWORLD_PATROL_CHANCE = 1')
const PDB = () => JSON.parse(W.persistent.portal_ambush || '{}')
function fresh() {
  W.persistent = {}
  load(SRC_N); Utils.server = server; resetWorld(); players.length = 0; W.cmds = []
  fire('loaded', { server })
}
const near = (m, p, r) => m.dim == p.dim && Math.sqrt((m.x - p.x) ** 2 + (m.z - p.z) ** 2) <= r
{
  fresh()
  ok('start-up: Walkers is told the blacklist blocks morphing', W.cmds.indexOf('walkers playerBlacklist preventMorphing true') >= 0)
  const p = player('Fly', 'ministry', NE, 20000.5, 41, 20000.5); players.push(p)
  cmd('ambush test raid Fly moderate'); advance(80)
  const g = groups()[0]
  ok('(a moderate raid on Fly)', !!g && mobs().length >= 3, mobs().length)
  ok('morphing: Fly is blacklisted in Walkers and turned back into a human, and told', W.cmds.indexOf('walkers playerBlacklist add Fly') >= 0 && W.cmds.indexOf('walkers switchShape Fly normal') >= 0 &&
    PDB().morphLocked && PDB().morphLocked['fly-1111'] == 'Fly' && /can't change shape while you're being hunted/.test(msgs(p)), msgs(p))
  advance(40)
  ok('... only once per group', W.cmds.filter(c => c == 'walkers playerBlacklist add Fly').length == 1)
  // following
  p.x += 40
  advance(20 * 4)
  ok('40 blocks away for 4 s: the mobs haven\'t moved yet', mobs().every(m => !near(m, p, 24)))
  advance(20 * 2)
  ok('after 5 s: every mob reappears 8-10 blocks from Fly, with a portal puff', mobs().length && mobs().every(m => near(m, p, 10.8) && !near(m, p, 7)) && W.cmds.some(c => /particle minecraft:portal/.test(c)),
    mobs().map(m => Math.round(Math.sqrt((m.x - p.x) ** 2 + (m.z - p.z) ** 2))).join(','))
  ok('... and they go after Fly', mobs().every(m => m.target === p || m.memories.attack_target === p))
  p.x += 3000
  advance(20 * 6)
  ok('3000 blocks away: they still come', mobs().every(m => near(m, p, 11)))
  advance(20 * 70)
  ok('distance never ends it: still on after 80 s', !!S().groups[g.id])
  // flying: pursuers
  p.y = 80
  advance(20 * 2)
  ok('Fly 39 blocks up for 2 s: no flyer yet', g.flyers == 0)
  advance(20 * 2)
  const vexes = () => mobs().filter(m => m.type == 'minecraft:vex')
  ok('3 s out of reach: a vex joins the group, near Fly, at Fly\'s height, with Strength III and Speed III', g.flyers == 1 && vexes().length == 1 && near(vexes()[0], p, 6.5) && Math.abs(vexes()[0].y - 80) <= 1 &&
    W.cmds.indexOf('effect give ' + vexes()[0].uuid + ' minecraft:strength infinite 2 true') >= 0 && g.mobs[vexes()[0].uuid] && /Blood-Marked Piglin/.test(vexes()[0].nbt), JSON.stringify(vexes().map(v => [v.x, v.y, v.z])) + ' fly ' + g.flyers)
  advance(20 * 10)
  ok('... no second one inside the 20 s cooldown', g.flyers == 1)
  advance(20 * 12)
  ok('... a second one after it', g.flyers == 2 && vexes().length == 2)
  advance(20 * 30)
  ok('... never more than 2 per group', g.flyers == 2 && vexes().length == 2)
  p.y = 41
  // dying ends it
  fire('death', { entity: p, source: {} })
  advance(20)
  ok('Fly dies: out of the group, which ends (cooldown given), morphing allowed again', !S().groups[g.id] && mobs().length == 0 && W.cmds.indexOf('walkers playerBlacklist remove Fly') >= 0 && !PDB().morphLocked['fly-1111'] &&
    /cooldown \d+:\d+/.test((cmd('ambush timer Fly'), replies[replies.length - 1])), replies[replies.length - 1])
}
{
  // through a waystone (no portal) into the Overworld: the whole group follows
  fresh()
  const p = player('Way', 'ministry', NE, 21000.5, 41, 21000.5); players.push(p)
  const contractEnds = []
  const g = glob.PortalAmbush.startGroup({ targets: ['way-1111'], dim: NE, size: 3, mechanic: 'contract', contractId: 'c1', onEnd: (gg, why) => contractEnds.push(why) })
  ok('(a contract group of 3 on Way)', g && mobs().length == 3 && mobs().every(m => m._tags.indexOf('contract_ambush') >= 0))
  const oldIds = mobs().map(m => m.uuid)
  p.x = 500.5; p.z = 500.5; p.y = 65
  travel(p, OW, false)
  advance(20)
  ok('Way leaves for the Overworld: still in the group, mobs still in the Nether for now', S().inGroup['way-1111'] == g.id && mobs().every(m => m.dim == NE))
  advance(40)
  ok('2 s later: 3 fresh mobs of the same kinds next to Way in the Overworld; the old ones are gone', mobs().length == 3 && mobs().every(m => m.dim == OW && near(m, p, 10.8) && oldIds.indexOf(m.uuid) < 0) &&
    W.entities.filter(e => oldIds.indexOf(e.uuid) >= 0).every(e => e.removed), mobs().map(m => m.dim + ' ' + m.x).join(','))
  ok('... the same group: id, contract, start time; its mobs keep the contract tag and the group tag', S().groups[g.id] === g && g.dim == OW && g.contractId == 'c1' &&
    mobs().every(m => m._tags.indexOf('contract_ambush') >= 0 && m._tags.indexOf('portal_ambush_g_' + g.id) >= 0 && S().mobGroup[m.uuid] == g.id))
  ok('... and the move ended nothing (the contract wasn\'t settled)', contractEnds.length == 0)
  mobs().forEach(m => { fire('death', { entity: m, source: {} }); m.removed = true })
  advance(20)
  ok('killing them ends it once', contractEnds.join() == 'killed_all')
}
{
  // two targets: the one who leaves takes their chasers with them
  fresh()
  const a = player('Ana', 'ministry', NE, 22000.5, 41, 22000.5), b = player('Ben', 'ministry', NE, 22001.5, 41, 22000.5); players.push(a, b)
  const g = glob.PortalAmbush.startGroup({ targets: ['ana-1111', 'ben-1111'], dim: NE, size: 4, mechanic: 'raid' })
  ok('(a group of 4 on Ana and Ben)', g && mobs().length == 4 && g.targets.length == 2)
  const chasingBen = Object.keys(g.mobTarget).filter(m => g.mobTarget[m] == 'ben-1111').length
  b.x = 700.5; b.z = 700.5; b.y = 65
  travel(b, OW, false)
  advance(60)
  const ng = groups().find(x => x.id != g.id)
  ok('Ben goes to the Overworld: a new group follows him with his chasers; Ana keeps the rest', ng && ng.dim == OW && ng.targets.join() == 'ben-1111' && g.targets.join() == 'ana-1111' &&
    Object.keys(ng.mobs).length == Math.max(1, chasingBen) && Object.keys(g.mobs).length == 4 - Math.max(1, chasingBen) && ng.start == g.start && S().inGroup['ben-1111'] == ng.id,
    ng && [Object.keys(ng.mobs).length, Object.keys(g.mobs).length, chasingBen].join())
}
{
  // into a safe zone (world spawn): the mobs wait at the edge of the game, the timer runs
  fresh()
  const p = player('Saf', 'ministry', NE, 26000.5, 41, 26000.5); players.push(p)
  const g = glob.PortalAmbush.startGroup({ targets: ['saf-1111'], dim: NE, size: 2, mechanic: 'raid' })
  p.x = 10.5; p.z = 10.5; p.y = 65
  travel(p, OW, false)
  advance(20 * 10)
  ok('a target who takes a waystone to spawn (a safe zone) isn\'t followed there; the group waits', S().groups[g.id] && g.dim == NE && mobs().every(m => m.dim == NE))
  p.x = 300.5; p.z = 300.5
  advance(40)
  ok('... and follows once they step out of it', g.dim == OW && mobs().length == 2 && mobs().every(m => m.dim == OW && near(m, p, 10.8)))
  p.x = 20.5; p.z = 20.5
  advance(20 * 8)
  ok('mobs don\'t teleport into the spawn area after them', mobs().every(m => !near(m, p, 24)))
}
{
  // a target flies so far that the mobs' chunks unload: they're kept, and replaced next to the target
  fresh()
  const p = player('Ely', 'ministry', NE, 27000.5, 41, 27000.5); players.push(p)
  const g = glob.PortalAmbush.startGroup({ targets: ['ely-1111'], dim: NE, size: 3, mechanic: 'contract', contractId: 'c2', onEnd: () => {} })
  const left = mobs().slice()
  left.forEach(m => { m.removed = true; m.unloaded = true })
  p.x += 400
  advance(20)
  ok('the mobs\' chunk unloads: not counted as killed, the group is still on (3 left behind)', S().groups[g.id] && Object.keys(g.parked).length == 3 && Object.keys(g.mobs).length == 0)
  cmd('ambush status')
  ok('... /ambush status shows them', replies.some(x => /0 mob\(s\) \+ 3 left behind/.test(x)), replies.slice(-2).join(' | '))
  advance(20 * 5)
  ok('5 s later: 3 fresh copies of the same kinds appear next to Ely (contract tag kept)', mobs().filter(m => left.indexOf(m) < 0).length == 3 && mobs().every(m => near(m, p, 10.8) && m._tags.indexOf('contract_ambush') >= 0) &&
    Object.keys(g.parked).length == 0 && Object.keys(g.mobs).length == 3, mobs().length)
  left.forEach(m => { m.removed = false; m.unloaded = false })
  ok('an old one loading again later is removed (it was replaced)', left.every(m => !fireSpawn(m)))
  // a parked mob whose chunk reloads before the group follows simply rejoins
  const one = W.entities.find(e => g.mobs[e.uuid])
  one.removed = true; one.unloaded = true
  advance(20)
  ok('(one parked)', g.parked[one.uuid])
  one.removed = false; one.unloaded = false
  ok('... its chunk loads again before anything else: it rejoins the group', fireSpawn(one) && g.mobs[one.uuid] === one && !g.parked[one.uuid])
}
{
  // the morph block is lifted on login when the group ended while they were offline
  fresh()
  const p = player('Off', 'ministry', NE, 23000.5, 41, 23000.5); players.push(p)
  glob.PortalAmbush.startGroup({ targets: ['off-1111'], dim: NE, size: 2, mechanic: 'raid' })
  players.length = 0
  advance(20 * 65)
  ok('Off logs out; 60 s later the group ends, but the block stays on record (offline)', !groups().length && PDB().morphLocked['off-1111'] && W.cmds.indexOf('walkers playerBlacklist remove Off') < 0)
  players.push(p)
  fire('loggedIn', { player: p, server })
  ok('... and is lifted when Off logs back in', W.cmds.indexOf('walkers playerBlacklist remove Off') >= 0 && !PDB().morphLocked['off-1111'])
  // a /reload clears blocks left with no group
  W.persistent.portal_ambush = JSON.stringify(Object.assign(PDB(), { morphLocked: { 'off-1111': 'Off' } }))
  W.cmds = []; load(SRC_N)
  ok('a block left from a crash is lifted at start-up', W.cmds.indexOf('walkers playerBlacklist remove Off') >= 0 && !PDB().morphLocked['off-1111'])
}
{
  // waystone arrivals roll
  fresh()
  const p = player('Wes', 'ministry', OW, 24000.5, 41, 24000.5); players.push(p)
  travel(p, NE, false)
  advance(80)
  ok('Overworld -> Nether by waystone (no portal block): a Nether ambush', groups().length == 1 && groups()[0].mechanic == 'nether_ambush' && /Blood for the Blood God/.test(msgs(p)), msgs(p))
  cmd('ambush timer Wes')
  ok('... and /ambush timer says it was a waystone or teleport trip', /no portal: waystone or teleport/.test(replies[replies.length - 1]), replies[replies.length - 1])
  ok('login still never rolls', (() => { cmd('ambush clear'); W.cmds = []; const q = player('Lou2', 'ministry', OW, 25000.5, 41, 25000.5); players.push(q); q.dim = NE; emit('enteredDimension', q, 'ministry', null, NE, 'login'); advance(80); return !groups().some(x => x.targets.indexOf('lou2-1111') >= 0) })())
}

console.log(W.logs.filter(l => /^E /.test(l) && !/outdated/.test(l)).join('\n') || '(no errors logged)')
console.log(fails ? fails + ' FAILED' : 'ALL PASSED')
