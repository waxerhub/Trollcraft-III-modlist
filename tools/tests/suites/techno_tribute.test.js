// Run with: node tools/tests/run_all.js techno_tribute   (or node tools/tests/suites/techno_tribute.test.js)
const REPO_ROOT = require('path').resolve(__dirname, '..', '..', '..')
// Mock KubeJS 6 server for server_scripts/techno_tribute.js
const fs = require('fs')
const FILE = process.env.TT_FILE || REPO_ROOT + '/tools/kubejs/server_scripts/techno_tribute.js'
let fails = 0
const ok = (l, c, e) => { console.log((c ? 'ok   ' : 'FAIL ') + l + (e !== undefined && !c ? '  ' + e : '')); if (!c) fails++ }
class Exit extends Error {}
const W = { tick: 0, q: [], cmds: [], ents: [], bolts: [], weather: 'clear', logs: [] }
let uid = 0, handlers = {}, roots = {}
function fire(n, ev) { for (const h of handlers[n] || []) { try { h(ev) } catch (e) { if (e instanceof Exit) { ev.cancelled = true; return } throw e } } }
function entity(type, x, y, z, nbt) {
  uid++
  const tagm = (nbt || '').match(/Tags:\["([^"]*)"\]/)
  return { type, x, y, z, nbt, removed: false, get level() { return level }, uuid: 'u' + uid + '-0000', tags: tagm ? [tagm[1]] : [],
    getStringUuid() { return this.uuid }, getX() { return this.x }, getY() { return this.y }, getZ() { return this.z },
    getTags() { const t = this.tags; return { contains: x => t.indexOf(x) >= 0 } }, isRemoved() { return this.removed }, discard() { this.removed = true } }
}
const level = { dimension: 'minecraft:overworld', createEntity: t => ({ setVisualOnly() {}, setPosition(x, y, z) { this.p = [x, y, z] }, spawn() { W.bolts.push(this.p) } }) }
function player(name, x, z, yaw, op) {
  return { name, x, y: 64, z, yaw, op, removed: false, uuid: name.toLowerCase() + '-1111', level, getGameProfile() { return { getName: () => this.name } },
    getStringUuid() { return this.uuid }, getX() { return this.x }, getY() { return this.y }, getZ() { return this.z }, getYRot() { return this.yaw }, isRemoved() { return this.removed } }
}
const alice = player('Alice', 0, 0, 0, true), bob = player('Bob', 100, 0, 90, false), carl = player('Carl', -50, 20, 180, false)
const players = [alice, bob, carl]
const server = {
  get overworld() { return () => ({ isThundering: () => W.weather == 'thunder', isRaining: () => W.weather != 'clear' }) },
  scheduleInTicks: (n, f) => W.q.push([W.tick + n, f]),
  runCommandSilent(c) {
    W.cmds.push(c)
    let m = c.match(/^execute in \S+ run summon (\S+) (\S+) (\S+) (\S+) (\{.*\})$/)
    if (m) { const e = entity(m[1], +m[2], +m[3], +m[4], m[5]); const ev = { entity: e, cancel() { throw new Exit() } }; fire('spawned', ev); if (!ev.cancelled) W.ents.push(e); return 1 }
    if ((m = c.match(/weather (\w+)$/))) { W.weather = m[1]; return 1 }
    if ((m = c.match(/^kill @e\[tag=(\S+)\]$/))) { let n = 0; W.ents.forEach(e => { if (!e.removed && e.tags.indexOf(m[1]) >= 0) { e.removed = true; n++ } }); return n }
    return 1
  },
}
const Utils = { server: null }
const node = (n, type) => ({ n, type, ch: [], req: null, f: null, then(c) { this.ch.push(c); return this }, requires(f) { this.req = f; return this }, executes(f) { this.f = f; return this } })
const replies = []
function cmd(line, as, isOp) {
  const toks = line.replace(/^\//, '').split(' ')
  let n = roots[toks[0]], args = {}
  const src = { server, getPlayer: () => as || null, hasPermission: () => as ? (isOp != null ? isOp : as.op) : true, sendSystemMessage: t => replies.push(t.json || String(t.text)) }
  if (n.req && !n.req(src)) { replies.push('DENIED'); return 0 }
  for (let i = 1; i < toks.length; i++) {
    let lit = n.ch.find(c => c.type == 'lit' && c.n == toks[i])
    if (lit) { n = lit; continue }
    let a = n.ch.find(c => c.type != 'lit')
    args[a.n] = toks[i] == '@a' ? players.slice() : [players.find(p => p.name == toks[i])]
    n = a
  }
  const getResult = (ctx, k) => { if (!(k in ctx.args)) throw new Error('no arg'); const l = ctx.args[k]; return { forEach: f => l.forEach(f) } }
  ARGS.PLAYERS.getResult = getResult
  return n.f({ args, source: src })
}
const ARGS = { PLAYERS: { create: () => 'players' } }
function load() {
  handlers = {}; roots = {}
  const on = n => f => { (handlers[n] = handlers[n] || []).push(f) }
  const ev = { commands: { literal: n => node(n, 'lit'), argument: (n, t) => node(n, t) }, arguments: ARGS, register: r => { roots[r.n] = r; return r } }
  new Function('EntityEvents', 'ServerEvents', 'Utils', 'Java', 'Text', 'console', 'global', fs.readFileSync(FILE, 'utf8'))(
    { spawned: on('spawned') }, { loaded: on('loaded'), commandRegistry: f => f(ev) }, Utils,
    { loadClass: n => { if (n.endsWith('Component$Serializer')) return { fromJsonLenient: s => ({ json: s }) }; throw new Error('no ' + n) } },
    { of: t => ({ text: t }) }, { info: m => W.logs.push('I ' + m), warn: m => W.logs.push('W ' + m), error: m => W.logs.push('E ' + m) }, G)
}
const G = {}
function advance(n) { for (let i = 0; i < n; i++) { W.tick++; const due = W.q.filter(x => x[0] <= W.tick); W.q = W.q.filter(x => x[0] > W.tick); due.forEach(x => x[1]()) } }
const live = () => W.ents.filter(e => !e.removed)
const since = k => W.cmds.slice(k)
load(); Utils.server = server; load()
const PIX = (fs.readFileSync(FILE, 'utf8').match(/const FACE = \[([\s\S]*?)\]/)[1].match(/'([^']*)'/g) || []).join('').replace(/[.']/g, '').length

// ----- face -----
let k = W.cmds.length
cmd('techno face', alice)
const rocket = live().find(e => e.type == 'minecraft:firework_rocket')
ok('/techno face: one firework rocket, LifeTime 30, tagged, pink/gold explosion, ~12 blocks in front (yaw 0 = +z)', rocket && /LifeTime:30/.test(rocket.nbt) && /Colors:\[I;16033721,16766720\]/.test(rocket.nbt) &&
  Math.abs(rocket.z - 12) < 0.01 && Math.abs(rocket.x) < 0.01, rocket && JSON.stringify([rocket.x, rocket.z]))
rocket.y = 90
advance(28)
ok('... no face before the burst', !since(k).some(c => /particle minecraft:dust/.test(c)))
advance(2)
const facePx = since(k).filter(c => /particle minecraft:dust/.test(c))
ok('at the burst: one dust particle per non-blank pixel (' + PIX + ')', facePx.length == PIX && PIX > 150, facePx.length)
ok('... colours include pink, gold, black and red', ['0.96 0.65 0.73', '1 0.8 0.16', '0.08 0.08 0.08', '0.82 0.1 0.16'].every(c => facePx.some(x => x.indexOf('dust ' + c) >= 0)), facePx[0])
const coords = facePx.map(c => c.match(/dust \S+ \S+ \S+ \S+ (\S+) (\S+) (\S+)/).slice(1).map(Number))
const zs = new Set(coords.map(c => c[2])), xs = new Set(coords.map(c => c[0]))
ok('... the face is a flat plane facing Alice (all at the same z, spread along x and y)', zs.size == 1 && [...zs][0] == 12 && xs.size > 10)
ok('... centred on where the rocket burst (y around 90)', Math.abs(coords.reduce((a, c) => a + c[1], 0) / coords.length - 90) < 1)
// Alice looks south (+z): her right is west (-x), so the left column (crown point at col 2) has larger x
const top = coords.filter(c => c[1] == Math.max(...coords.map(d => d[1])))
ok('... the right way round: viewed from Alice, the crown is on top and the left side is to her left', top.length == 4 && Math.max(...coords.map(c => c[0])) > 0)
advance(80)
const allFace = since(k).filter(c => /particle minecraft:dust/.test(c)).length
ok('the face is redrawn 15 times (about 3 s), then stops', allFace == PIX * 15, allFace)
k = W.cmds.length
cmd('techno face @a huge', alice); advance(30)
const huge = since(k).filter(c => /particle minecraft:dust/.test(c))
ok('/techno face @a huge: three rockets, three faces', since(k).filter(c => /summon minecraft:firework_rocket/.test(c)).length == 3 && huge.length == PIX * 3, huge.length)
const span = arr => { const v = arr.map(c => Number(c.match(/dust \S+ \S+ \S+ \S+ (\S+)/)[1])); return Math.max(...v) - Math.min(...v) }
ok('... huge faces are wider: 13 blocks across vs 7.8 for normal', Math.abs(span(huge.slice(0, PIX)) - 13) < 0.05 && Math.abs(span(facePx) - 7.8) < 0.05, span(huge.slice(0, PIX)) + ' / ' + span(facePx))
advance(100)

// ----- crown -----
k = W.cmds.length
cmd('techno crown Bob', alice); advance(10)
ok('/techno crown <player>: gold ring + red jewel above their head, following them', since(k).filter(c => /^execute at bob-1111 run particle minecraft:dust 1 0.82 0.15/.test(c)).length >= 10 && since(k).some(c => /~ ~2.3 ~/.test(c)))
advance(30 * 20)
const crownCount = since(k).filter(c => /execute at bob-1111 run particle/.test(c)).length
ok('... for 30 s (120 redraws x 11 particles), then it stops', crownCount == 120 * 11, crownCount)

// ----- parade -----
k = W.cmds.length
cmd('techno parade', alice)
const pigs = live().filter(e => e.type == 'minecraft:pig')
ok('/techno parade: 8 glowing, invulnerable "Technoblade" pigs, no loot, in a ring', pigs.length == 8 && pigs.every(p => /Glowing:1b/.test(p.nbt) && /Invulnerable:1b/.test(p.nbt) && /DeathLootTable:"minecraft:empty"/.test(p.nbt) && /Technoblade/.test(p.nbt)) &&
  pigs.every(p => Math.abs(Math.hypot(p.x, p.z) - 4) < 0.05))
advance(31 * 20)
ok('... after 30 s they vanish in a puff of smoke', pigs.every(p => p.removed) && since(k).filter(c => /particle minecraft:poof/.test(c)).length == 8)

// ----- blood -----
k = W.cmds.length; W.weather = 'clear'
cmd('techno blood @a', alice); advance(5)
ok('/techno blood @a: title for each player', ['alice', 'bob', 'carl'].every(u => since(k).some(c => c.indexOf('title ' + u + '-1111 title') == 0 && /BLOOD FOR THE BLOOD GOD/.test(c))))
ok('... a thunderstorm (set once) and visual-only lightning', W.weather == 'thunder' && since(k).filter(c => /weather thunder/.test(c)).length == 1 && W.bolts.length >= 3)
advance(11 * 20)
ok('... the weather goes back to clear afterwards', W.weather == 'clear')
W.weather = 'rain'; cmd('techno blood', alice); advance(11 * 20)
ok('... and back to rain if it was raining', W.weather == 'rain')
W.weather = 'clear'

// ----- potatoes -----
k = W.cmds.length
cmd('techno potatoes', alice); advance(3)
const pot = live().filter(e => e.type == 'minecraft:item_display')
ok('/techno potatoes: item displays (not items) of baked potatoes, high above', pot.length >= 2 && pot.every(p => /baked_potato/.test(p.nbt) && p.y == 78) && !since(k).some(c => /summon minecraft:item /.test(c)))
ok('... each slides down to the ground with a proper (unit) rotation', since(k).some(c => /data merge entity u\d+-0000 \{start_interpolation:0,interpolation_duration:30/.test(c)) &&
  since(k).filter(c => /left_rotation:\[0f,(-?[\d.]+)f,0f,(-?[\d.]+)f\]/.test(c)).every(c => { const m = c.match(/left_rotation:\[0f,(-?[\d.]+)f,0f,(-?[\d.]+)f\]/); return Math.abs(m[1] * m[1] + m[2] * m[2] - 1) < 0.03 }))
advance(10 * 20 + 40)
ok('... after 10 s it stops and every potato is gone', W.ents.filter(e => e.type == 'minecraft:item_display').every(e => e.removed) && W.ents.filter(e => e.type == 'minecraft:item_display').length > 100)

// ----- quote -----
cmd('techno quote', alice)
const q = live().find(e => e.type == 'minecraft:text_display')
ok('/techno quote: a text display with the quote, in front of Alice', q && /Technoblade never dies\./.test(q.nbt) && /hundred years/.test(q.nbt) && Math.abs(q.z - 4) < 0.01)
advance(20 * 20 + 2)
ok('... removed after 20 s', q.removed)

// ----- all, stop, leftovers, permissions -----
k = W.cmds.length
cmd('techno all', alice); advance(100)
ok('/techno all: the show runs in sequence (blood, crown, parade so far)', since(k).some(c => /BLOOD FOR THE BLOOD GOD/.test(c)) && live().some(e => e.type == 'minecraft:pig'))
cmd('techno stop', alice)
ok('/techno stop: everything spawned is removed and the weather restored', !live().length && W.weather == 'clear')
const k2 = W.cmds.length; advance(400)
ok('... and nothing else runs afterwards', !since(k2).length, since(k2).slice(0, 3).join(' | '))
const stale = entity('minecraft:pig', 0, 64, 0, '{Tags:["techno_tribute"]}')
const ev = { entity: stale, cancel() { throw new Exit() } }; fire('spawned', ev)
ok('a leftover tribute pig loading after a restart is removed', ev.cancelled)
const wild = entity('minecraft:pig', 0, 64, 0, '{}'); const ev2 = { entity: wild, cancel() { throw new Exit() } }; fire('spawned', ev2)
ok('... ordinary pigs are left alone', !ev2.cancelled)
ok('non-ops are denied', cmd('techno face', bob, false) == 0 && replies[replies.length - 1] == 'DENIED')
const many = []; for (let i = 0; i < 14; i++) many.push(player('P' + i, i, i, 0, false))
players.push(...many)
k = W.cmds.length; cmd('techno quote @a', alice)
ok('at most 10 players per command, and the reply says so', since(k).filter(c => /summon minecraft:text_display/.test(c)).length == 10 && /more skipped/.test(replies[replies.length - 1]))
ok('no errors logged', !W.logs.some(l => /^E /.test(l)), W.logs.filter(l => /^E /.test(l)).join(' | '))
console.log(fails ? fails + ' FAILED' : 'ALL PASSED')
