// Run with: node tools/tests/run_all.js superaura   (or node tools/tests/suites/superaura.test.js)
const REPO_ROOT = require('path').resolve(__dirname, '..', '..', '..')
const fs = require('fs')
const src = fs.readFileSync(REPO_ROOT + '/tools/kubejs/server_scripts/smite.js', 'utf8')
let fails = 0
const ok = (l, c, e) => { console.log((c ? 'ok   ' : 'FAIL ') + l + (!c && e !== undefined ? '  ' + e : '')); if (!c) fails++ }
function setup(nPlayers) {
  const W = { tick: 0, q: [], cmds: [], spawned: [], replies: [] }
  const level = {
    dimension: { toString: () => 'minecraft:overworld' },
    getBlock: () => ({ id: 'minecraft:air' }),
    createEntity: t => ({ t, visual: false, setVisualOnly(v) { this.visual = v }, setPosition(x, y, z) { this.p = [x, y, z] }, spawn() { W.spawned.push({ p: this.p, visual: this.visual, tick: W.tick }) } }),
  }
  const players = []
  for (let i = 0; i < nPlayers; i++) {
    players.push({ n: 'P' + i, x: 100 + i * 50, y: 64, z: 0, removed: false, inbox: [], level,
      getX() { return this.x }, getY() { return this.y }, getZ() { return this.z }, isRemoved() { return this.removed },
      getGameProfile() { const s = this; return { getName: () => s.n } }, tell(c) { this.inbox.push(c && c.json ? c.json : String(c)) } })
  }
  const server = { runCommandSilent: c => { W.cmds.push({ t: W.tick, c }); return 1 }, scheduleInTicks: (n, f) => W.q.push([W.tick + n, f]),
    get players() { return { size: () => players.length, get: i => players[i] } } }
  const roots = {}
  const node = (n, type) => ({ n, type, ch: [], then(c) { this.ch.push(c); return this }, requires(f) { this.req = f; return this }, executes(f) { this.f = f; return this } })
  const event = { commands: { literal: n => node(n, 'lit'), argument: (n, t) => node(n, t) },
    arguments: { PLAYER: { create: () => 'player', getResult: (ctx, n) => ctx.args[n] }, PLAYERS: { create: () => 'players', getResult: (ctx, n) => ctx.args[n] }, INTEGER: { create: () => 'int', getResult: (ctx, n) => ctx.args[n] } },
    register: r => { roots[r.n] = r } }
  const Java = { loadClass: n => { if (n == 'net.minecraft.network.chat.Component$Serializer') return { fromJsonLenient: s => ({ json: s }) }; throw new Error('no ' + n) } }
  new Function('ServerEvents', 'Text', 'console', 'Java', src)({ commandRegistry: f => f(event) }, { red: t => 'RED ' + t, of: t => String(t) }, { error: m => console.log('ERR ' + m) }, Java)
  W.cmd = (line, op) => {
    const toks = line.split(' ')
    let n = roots[toks[0]], args = {}
    const src2 = { server, hasPermission: () => op !== false, sendSystemMessage: m => W.replies.push(String(m)) }
    if (n.req && !n.req(src2)) return 'DENIED'
    for (let i = 1; i < toks.length; i++) {
      let lit = n.ch.find(c => c.type == 'lit' && c.n == toks[i])
      if (lit) { n = lit; continue }
      let a = n.ch.find(c => c.type != 'lit')
      args[a.n] = toks[i] == '@a' ? { forEach: f => players.forEach(f) } : { forEach: f => f(players.find(p => p.n == toks[i])) }
      n = a
    }
    return n.f({ args, source: src2 })
  }
  W.advance = t => { for (let i = 0; i < t; i++) { W.tick++; const due = W.q.filter(x => x[0] <= W.tick); W.q = W.q.filter(x => x[0] > W.tick); due.forEach(x => x[1]()) } }
  return { W, players }
}
const realBolts = W => W.cmds.filter(x => /summon minecraft:lightning_bolt/.test(x.c)).length
const fireworks = W => W.cmds.filter(x => /summon minecraft:firework_rocket/.test(x.c))
const dusts = W => W.cmds.filter(x => /particle minecraft:dust 0\.6 0 0/.test(x.c))

// both (default)
let { W, players } = setup(1)
let p = players[0]
W.cmd('superaura P0')
W.advance(50)
p.x += 30           // they move: it follows
W.advance(150)
ok('100 visual bolts over 5 s, none real', W.spawned.length == 100 && W.spawned.every(b => b.visual) && realBolts(W) == 0, W.spawned.length)
ok('... all within 5 s (100 ticks)', W.spawned.every(b => b.tick <= 100))
const dd = W.spawned.map(b => Math.hypot(b.p[0] - (b.tick <= 50 ? 100 : 130), b.p[2]))
ok('... 2-6 blocks from the player, following them as they move', dd.every(x => x >= 1.99 && x <= 6.01), dd.filter(x => x < 1.99 || x > 6.01).length)
ok('blood: 10 fireworks over 10 s, LifeTime 30, red and dark red with a black fade', fireworks(W).length == 10 && fireworks(W).every(x => /LifeTime:30/.test(x.c) && /Colors:\[I;11141120,16711680\]/.test(x.c) && /FadeColors:\[I;1973019\]/.test(x.c)) &&
  fireworks(W).every(x => x.t <= 200), fireworks(W).length)
ok('... the red helix: 12 dust points every 3 ticks for 10 s', dusts(W).length == 12 * 67 && dusts(W).every(x => x.t <= 200), dusts(W).length)
ok('... crimson spores and dark dust too', W.cmds.some(x => /particle minecraft:crimson_spore/.test(x.c)) && W.cmds.some(x => /particle minecraft:dust 0\.15 0 0/.test(x.c)))
ok('... the helix follows the player', dusts(W).filter(x => x.t > 60).every(x => { const a = x.c.split(' '); return Math.abs(+a[10] - 130) <= 1.3 }))
ok('... wither and crimson forest sounds at the start', W.cmds.some(x => /playsound minecraft:entity.wither.spawn/.test(x.c)) && W.cmds.some(x => /playsound minecraft:ambient.crimson_forest.mood/.test(x.c)))
ok('everyone online is told, [SIGNAL HIJACKED] "The Blood God descends upon P0.", not with tellraw', /SIGNAL HIJACKED/.test(p.inbox.join()) && /The Blood God descends upon P0\./.test(p.inbox.join()) && !W.cmds.some(x => /tellraw/.test(x.c)), p.inbox.join())
W.advance(100)
const after = W.cmds.length
W.advance(100)
ok('nothing more after it ends', W.cmds.length == after)

// lightning only / blood only
;({ W, players } = setup(1))
W.cmd('superaura P0 lightning'); W.advance(220)
ok('lightning: only the bolts', W.spawned.length == 100 && fireworks(W).length == 0 && dusts(W).length == 0 && /sky splits open above P0/.test(players[0].inbox.join()))
;({ W, players } = setup(1))
W.cmd('superaura P0 blood'); W.advance(220)
ok('blood: only the aura', W.spawned.length == 0 && fireworks(W).length == 10 && dusts(W).length > 0 && /gaze falls upon P0/.test(players[0].inbox.join()))
// logout stops it
;({ W, players } = setup(1))
W.cmd('superaura P0'); W.advance(40); players[0].removed = true
const b40 = W.spawned.length, c40 = W.cmds.length
W.advance(200)
ok('a player who logs out: it stops', W.spawned.length == b40 && W.cmds.length == c40)
// @a cap
;({ W, players } = setup(7))
const r = W.cmd('superaura @a lightning'); W.advance(110)
ok('@a with 7 players: 5 get it, and the reply says so', r == 5 && W.spawned.length == 500 && /only the first 5 of 7/.test(W.replies.join()), W.replies.join())
ok('... and all 7 hear about each of the 5', players.every(q => q.inbox.length == 5))
ok('non-ops are denied', W.cmd('superaura P0', false) == 'DENIED')
console.log(fails ? fails + ' FAILED' : 'ALL PASSED')
