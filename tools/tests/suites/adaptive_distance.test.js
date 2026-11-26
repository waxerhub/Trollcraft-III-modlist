// adaptive_distance.js: the simulation distance lowered per dimension while the server struggles, and given back.
// Run with: node tools/tests/run_all.js adaptive_distance   (or node tools/tests/suites/adaptive_distance.test.js)
const fs = require('fs')
const paths = require('../lib/paths')
const SRC = fs.readFileSync(paths.server('adaptive_distance.js'), 'utf8')
let fails = 0
const ok = (l, c, e) => { console.log((c ? 'ok   ' : 'FAIL ') + l + (!c && e !== undefined ? '  ' + e : '')); if (!c) fails++ }

const OW = 'minecraft:overworld', NE = 'minecraft:the_nether', EB = 'blue_skies:everbright', AE = 'aether:the_aether', DD = 'deeperdarker:otherside'

// A server whose ticks cost what its dimensions cost: each dimension's cost (at distance 6) shrinks with the chunks that
// run around its players. `extra` is added to every tick.
function world(opts) {
  opts = opts || {}
  const W = { now: 1.7e12, tick: 0, q: [], logs: [], cmds: [], persistent: opts.persistent || {}, cost: {}, n: {}, dist: {}, sets: [], extra: 0, override: null, base: opts.base || 6, noTickTime: !!opts.noTickTime }
  const dims = [OW, NE, EB, AE, DD]
  const mkLevel = dim => ({
    dimension: { toString: () => dim },                        // KubeJS: the id, not a method
    get players() { return { size: () => W.n[dim] || 0 } },
    getChunkSource: () => ({ setSimulationDistance: d => { W.dist[dim] = d; W.sets.push(dim + ' ' + d) } }),
  })
  W.levels = dims.map(mkLevel)
  dims.forEach(d => { W.dist[d] = W.base; W.cost[d] = 0; W.n[d] = 0 })
  W.addLevel = dim => { W.levels.push(mkLevel(dim)); W.dist[dim] = W.base; W.cost[dim] = 0; W.n[dim] = 0 }
  const share = dim => Math.pow(2 * W.dist[dim] + 1, 2) / 169
  W.costOf = dim => W.cost[dim] * share(dim)
  W.ticks = () => (W.override != null ? W.override : W.extra + W.levels.reduce((a, l) => a + W.costOf(String(l.dimension)), 0))
  W.players = []
  W.player = (name, op) => { const p = { name, msgs: [], hasPermissions: () => !!op, tell: c => p.msgs.push(c.text) }; W.players.push(p); return p }
  const srv = {
    get players() { return { size: () => W.players.length, get: i => W.players[i] } },
    getAllLevels: () => W.levels,
    getProperties: () => ({ simulationDistance: W.base }),
    getPlayerList: () => ({ getSimulationDistance: () => W.base }),
    getAverageTickTime: () => W.ticks(),
    getTickTime: key => { if (W.noTickTime) throw new Error('no'); return new Array(100).fill(W.costOf(String(key)) * 1000000) },
    persistentData: { getString: k => W.persistent[k] || '', putString: (k, v) => { W.persistent[k] = v } },
    scheduleInTicks: (n, f) => W.q.push([W.tick + n, f]),
    runCommandSilent: c => { W.cmds.push(c); return 1 },
  }
  W.srv = srv
  const H = { loaded: [] }
  const node = n => ({ n, ch: [], then(c) { this.ch.push(c); return this }, requires(f) { this.req = f; return this }, executes(f) { this.f = f; return this } })
  let tree = null
  const g = opts.global || {}
  W.global = g
  const Java = { loadClass: c => {
    if (/Serializer/.test(c)) return { fromJsonLenient: j => ({ text: JSON.parse(j).map(x => (typeof x == 'string' ? x : x.text)).join('') }) }
    if (/ResourceKey$/.test(c)) return { create: (reg, id) => id }
    if (/Registries$/.test(c)) return { DIMENSION: 'dimension' }
    if (/ResourceLocation$/.test(c)) return function (s) { this.toString = () => s }
    throw new Error('no ' + c)
  } }
  function FakeDate(v) { return v === undefined ? new Date(W.now) : new Date(v) }
  FakeDate.now = () => W.now
  W.load = (started, edit) => {
    H.loaded = []
    new Function('ServerEvents', 'Java', 'Utils', 'Text', 'console', 'global', 'Date', (edit || (s => s))(SRC))(
      { loaded: h => H.loaded.push(h), commandRegistry: h => h({ commands: { literal: node }, register: t => { tree = t } }) },
      Java, { get server() { return started ? srv : W.late ? srv : null } }, { of: s => ({ text: s }) },
      { info: m => W.logs.push(m), warn: m => W.logs.push('WARN ' + m), error: m => W.logs.push('ERR ' + m) }, g, FakeDate)
  }
  W.start = edit => { W.load(false, edit); W.late = true; H.loaded.forEach(h => h({ server: srv })) }
  W.advance = secs => { for (let i = 0; i < secs * 20; i++) { W.tick++; W.now += 50; const due = W.q.filter(x => x[0] <= W.tick); W.q = W.q.filter(x => x[0] > W.tick); due.forEach(x => x[1]()) } }
  W.cmd = (sub, op) => {
    const out = [], src = { server: srv, hasPermission: () => op !== false, sendSystemMessage: c => out.push(c.text) }
    if (tree.req && !tree.req(src)) return ['DENIED']
    ;(sub ? tree.ch.find(x => x.n == sub) : tree).f({ source: src })
    return out
  }
  return W
}
const errs = W => W.logs.filter(l => /^ERR/.test(l))

// ---------- a healthy server ----------
{
  const W = world(); W.start()
  Object.assign(W.cost, { [OW]: 12, [EB]: 8 }); Object.assign(W.n, { [OW]: 5, [EB]: 3 })
  W.advance(600)
  ok('a healthy server: every dimension at the server\'s own distance, nothing lowered', [OW, NE, EB, AE, DD].every(d => W.dist[d] == 6) && !W.global.AdaptiveDistance.lowered().length)
  ok('... each set once, not over and over', W.sets.length == 5, W.sets.length)
  ok('/simdistance: on, the normal distance, the busy dimensions', /On\. Ticks: 20 ms\. Normal distance: 6\./.test(W.cmd()[0]) && W.cmd().some(t => /minecraft:overworld: 6, 5 players, 12 ms/.test(t)) && !W.cmd().some(t => /the_nether/.test(t)), W.cmd().join(' | '))
  ok('/simdistance is op-only', W.cmd(null, false)[0] == 'DENIED')
  ok('no errors', !errs(W).length, errs(W).join())
}

// ---------- it lowers where the time goes ----------
{
  const W = world(), op = W.player('Op', true), ana = W.player('Ana', false)
  W.start()
  Object.assign(W.cost, { [OW]: 18, [EB]: 26, [AE]: 4, [DD]: 1, [NE]: 30 }); Object.assign(W.n, { [OW]: 4, [EB]: 4, [AE]: 1, [DD]: 1, [NE]: 0 })
  W.cost[NE] = 0
  W.advance(115)
  ok('49 ms right after the start: nothing yet (2 minutes\' grace)', W.dist[EB] == 6 && W.ticks() == 49, W.ticks())
  W.advance(10)
  ok('... then the dimension that costs most goes down a step, and only that one', W.dist[EB] == 5 && W.dist[OW] == 6 && W.dist[AE] == 6, JSON.stringify(W.dist))
  ok('... ops are told why, other players aren\'t, and nothing goes through tellraw', op.msgs.some(m => /The server is struggling: blue_skies:everbright 6 -> 5 \(ticks 49 ms, 26 ms of it there, 4 players there\)/.test(m)) && !ana.msgs.length && !W.cmds.length, op.msgs.join('|'))
  W.advance(12)
  ok('41.6 ms is still over 40: another step there', W.dist[EB] == 4 && W.dist[OW] == 6, JSON.stringify(W.dist) + ' ' + W.ticks())
  ok('... and the log says what the first step did', W.global.adaptiveDistance.history.some(h => /6 -> 5 .*, then 41\.6 ms/.test(h.text)), JSON.stringify(W.global.adaptiveDistance.history))
  W.advance(60)
  ok('35.5 ms: between the two limits, it stays as it is', W.dist[EB] == 4 && W.dist[OW] == 6 && W.global.AdaptiveDistance.lowered().length == 2, W.ticks())
  W.extra = 10
  W.advance(12)
  ok('slower again: that dimension is at its lowest, so the next most costly goes', W.dist[EB] == 4 && W.dist[OW] == 5, JSON.stringify(W.dist))
  W.extra = 40
  W.advance(300)
  ok('never below 4, whatever the ticks; a dimension costing under 2 ms is left alone', W.dist[OW] == 4 && W.dist[EB] == 4 && W.dist[AE] == 4 && W.dist[DD] == 6 && W.dist[NE] == 6, JSON.stringify(W.dist))
  ok('/simdistance shows it', W.cmd().some(t => /blue_skies:everbright: 4 \(normally 6\), 4 players/.test(t)) && /Steps down now: 6/.test(W.cmd()[0]), W.cmd().join(' | '))

  // ---------- and gives it back, last step first ----------
  W.extra = 0; Object.assign(W.cost, { [OW]: 8, [EB]: 6, [AE]: 1 })
  W.advance(115)
  ok('fast again: nothing is given back for 2 minutes', W.global.AdaptiveDistance.lowered().length == 6)
  W.advance(20)
  ok('... then the last step, one at a time', W.global.AdaptiveDistance.lowered().length == 5 && W.dist[AE] == 5, JSON.stringify(W.dist))
  W.advance(125)
  ok('... and the next 2 minutes later', W.global.AdaptiveDistance.lowered().length == 4 && W.dist[AE] == 6)
  W.advance(800)
  ok('... until everything is normal', [OW, NE, EB, AE, DD].every(d => W.dist[d] == 6) && op.msgs.some(m => /The server copes again/.test(m)), JSON.stringify(W.dist))
  ok('no errors', !errs(W).length, errs(W).join())
}

// ---------- short spikes ----------
{
  const W = world(); W.start()
  Object.assign(W.cost, { [OW]: 20 }); W.n[OW] = 5
  W.advance(200)
  for (let k = 0; k < 10; k++) { W.override = 900; W.advance(4); W.override = null; W.advance(16) }
  ok('4 slow seconds in every 20 (a save, a tier opening) change nothing', W.dist[OW] == 6 && !W.global.AdaptiveDistance.lowered().length)
  W.override = 60; W.advance(8); W.override = 35; W.advance(30)
  ok('... nor do 8 slow seconds before it settles between the limits', W.dist[OW] == 5 || W.dist[OW] == 6)
}

// ---------- nobody to lower for ----------
{
  const W = world(); W.start()
  Object.assign(W.cost, { [OW]: 60 })
  W.advance(400)
  ok('slow with nobody on (machines, chunk loaders): nothing is lowered, it wouldn\'t help', W.dist[OW] == 6 && !W.global.AdaptiveDistance.lowered().length)
}

// ---------- a step needed again soon after it was given back ----------
{
  const W = world(); W.start()
  Object.assign(W.cost, { [EB]: 45 }); W.n[EB] = 5
  W.advance(140)
  ok('45 ms: one step brings it to 32', W.dist[EB] == 5, W.ticks())
  W.override = 25; W.advance(140); W.override = null
  ok('a calm spell gives it back', W.dist[EB] == 6)
  W.advance(12)
  ok('... and it\'s needed again at once', W.dist[EB] == 5)
  W.override = 25; W.advance(140)
  ok('... so the next wait is twice as long: not after 2 minutes', W.dist[EB] == 5)
  W.advance(120)
  ok('... but after 4', W.dist[EB] == 6)
  W.override = null
  for (let k = 0; k < 8; k++) { W.advance(12); W.override = 25; W.advance(40); W.override = null; W.advance(1); W.override = 25; W.advance(2000); W.override = null }
  ok('the wait never passes half an hour', /after 1800 s of calm|after \d{2,3} s of calm/.test((W.advance(12), W.cmd()[0])), W.cmd()[0])
  ok('no errors', !errs(W).length, errs(W).join())
}

// ---------- the Shrine's night ----------
{
  const W = world(), op = W.player('Op', true)
  let night = false
  W.global.Shrine = { eventOn: () => night, riteOn: () => false }
  W.start()
  Object.assign(W.cost, { [OW]: 55 }); W.n[OW] = 8
  W.advance(135)
  ok('(slow, so it\'s lowered)', W.dist[OW] < 6)
  night = true; W.advance(3)
  ok('when the Shrine\'s night begins everything goes back to normal, and ops hear why', W.dist[OW] == 6 && op.msgs.some(m => /Back to normal everywhere: the Shrine's night is on/.test(m)), op.msgs.join('|'))
  W.advance(300)
  ok('... and nothing is lowered while it lasts', W.dist[OW] == 6 && /nothing is lowered while the Shrine's night is on/.test(W.cmd()[0]))
  night = false; W.advance(15)
  ok('... but is again after it', W.dist[OW] == 5, W.dist[OW])
  W.global.Shrine = { eventOn: () => { throw new Error('x') } }
  W.cost[OW] = 70; W.advance(60)
  ok('a Shrine script that fails doesn\'t stop it', W.dist[OW] == 4 && !errs(W).length)
}

// ---------- off and on ----------
{
  const W = world(); W.start()
  Object.assign(W.cost, { [OW]: 70 }); W.n[OW] = 8
  W.advance(150)
  ok('(lowered)', W.dist[OW] == 4)
  ok('/simdistance off puts everything back and keeps it there', /Off/.test(W.cmd('off')[0]) && W.dist[OW] == 6 && (W.advance(300), W.dist[OW] == 6))
  const later = world({ persistent: W.persistent }); later.start()
  Object.assign(later.cost, { [OW]: 70 }); later.n[OW] = 8; later.advance(300)
  ok('... a restart keeps it off', later.dist[OW] == 6 && /^\[Distance\] Off/.test(later.cmd()[0]), later.cmd()[0])
  later.cmd('on'); later.advance(30)
  ok('/simdistance on starts it again', later.dist[OW] < 6)
  const bad = world({ persistent: { adaptive_distance: '{broken' } }); bad.start(); bad.advance(5)
  ok('saved data that can\'t be read is kept, and it runs', Object.keys(bad.persistent).some(k => /_unreadable_/.test(k)) && /On/.test(bad.cmd()[0]))
}

// ---------- /reload and restarts ----------
{
  const W = world(); W.start()
  Object.assign(W.cost, { [EB]: 46, [OW]: 4 }); W.n[EB] = 4; W.n[OW] = 1
  W.advance(150)
  ok('(lowered)', W.dist[EB] == 5 && W.global.AdaptiveDistance.lowered().join() == EB)
  W.load(true); W.advance(5)
  ok('/reload keeps the step, and only one loop runs', W.dist[EB] == 5 && W.global.AdaptiveDistance.lowered().join() == EB && W.q.length == 1, W.q.length)
  W.extra = 30; W.advance(13)
  ok('... and it goes on working', W.dist[EB] == 4)
  const R = world(); R.start()
  ok('a restart starts at the normal distance', !R.global.AdaptiveDistance.lowered().length)
}

// ---------- settings, and what can't be read ----------
{
  const W = world(); W.start(s => s.replace('const NORMAL = {}', "const NORMAL = { 'blue_skies:everbright': 5, 'minecraft:overworld': 12 }"))
  Object.assign(W.cost, { [EB]: 10, [OW]: 10 }); W.n[EB] = 2; W.n[OW] = 2
  W.advance(5)
  ok('a dimension\'s own normal distance holds from the start, and can only be lower than the server\'s', W.dist[EB] == 5 && W.dist[OW] == 6, JSON.stringify(W.dist))
  W.cost[EB] = 60; W.advance(150)
  ok('... and it still goes down from there when needed', W.dist[EB] == 4)
  const low = world({ base: 3 }); low.start()
  Object.assign(low.cost, { [OW]: 70 }); low.n[OW] = 8; low.advance(300)
  ok('a server already below the lowest is left as it is', low.dist[OW] == 3 && !low.global.AdaptiveDistance.lowered().length)
  const X = world({ noTickTime: true }); X.start()
  Object.assign(X.cost, { [OW]: 20, [EB]: 30 }); X.n[OW] = 6; X.n[EB] = 2
  X.advance(125)
  ok('if tick times per dimension can\'t be read, the one with the most players goes first, with one warning', X.dist[OW] == 5 && X.dist[EB] == 6 && X.logs.filter(l => /^WARN/.test(l)).length == 1, JSON.stringify(X.dist) + X.logs.join('|'))
  const N = world(); N.start(); N.advance(5); N.addLevel('rftoolsdim:mining'); N.advance(5)
  ok('a dimension made later is set too', N.sets.indexOf('rftoolsdim:mining 6') >= 0)
  ok('the API', N.global.AdaptiveDistance.distanceOf(OW) == 6 && N.global.AdaptiveDistance.enabled() === true)
  ;[W, low, X, N].forEach(w => ok('no errors', !errs(w).length, errs(w).join()))
}

console.log(fails ? fails + ' FAILED' : 'ALL PASSED')
