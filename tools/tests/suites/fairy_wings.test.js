// Run with: node tools/tests/run_all.js fairy_wings   (or node tools/tests/suites/fairy_wings.test.js)
const REPO_ROOT = require('path').resolve(__dirname, '..', '..', '..')
const fs = require('fs')
const src = fs.readFileSync(REPO_ROOT + '/tools/kubejs/server_scripts/fairy_wings.js', 'utf8')
const W = { tick: 0, q: [], cmds: [] }
const global = {}
function player(name, yaw) {
  return { name, tags: [], yaw, x: 0.5, y: 64, z: 0.5, level: { dimension: { toString: () => 'minecraft:overworld' } },
    getGameProfile() { return { getName: () => this.name } }, getTags() { const t = this.tags; return { contains: x => t.indexOf(x) >= 0 } },
    getX() { return this.x }, getY() { return this.y }, getZ() { return this.z }, getYaw() { return this.yaw }, isSpectator: () => false, isInvisible() { return !!this.invis } }
}
const players = [player('Fae', 0), player('Bob', 90), player('C', 0), player('D', 0), player('E', 0), player('F', 0)]
const server = { get tickCount() { return W.tick }, players: { size: () => players.length, get: i => players[i] },
  runCommandSilent: c => { W.cmds.push(c); const m = c.match(/^tag (\S+) (add|remove) (\S+)/); if (m) { const p = players.find(p => p.name == m[1]); if (m[2] == 'add') p.tags.push(m[3]); else p.tags = p.tags.filter(t => t != m[3]) } return 1 },
  scheduleInTicks: (n, f) => W.q.push([W.tick + n, f]) }
let root
const event = { commands: { literal: n => ({ n, ch: [], then(c) { this.ch.push(c); return this }, requires() { return this }, executes(f) { this.f = f; return this } }), argument: n => ({ n, arg: true, ch: [], then(c) { this.ch.push(c); return this }, executes(f) { this.f = f; return this } }) },
  arguments: { PLAYER: { create: () => 'p', getResult: ctx => ctx.target } }, register: r => { root = r } }
new Function('PlayerEvents', 'ServerEvents', 'Utils', 'Text', 'console', 'global', src)(
  { loggedIn: () => {} }, { commandRegistry: f => f(event) }, { server: null }, { lightPurple: t => t }, { error: m => console.log('ERR ' + m) }, global)
const replies = []
function cmd(args, target) {
  let node = root
  for (const a of args) node = node.ch.find(c => c.n == a) || node.ch.find(c => c.arg)
  return node.f({ target, source: { server, sendSystemMessage: m => replies.push(m) } })
}
function advance(n) { for (let i = 0; i < n; i++) { W.tick++; const due = W.q.filter(x => x[0] <= W.tick); W.q = W.q.filter(x => x[0] > W.tick); due.forEach(x => x[1]()) } }
let fails = 0
const ok = (l, c, e) => { console.log((c ? 'ok   ' : 'FAIL ') + l + (e ? '  ' + e : '')); if (!c) fails++ }
cmd(['player'], players[0])
let start = W.cmds.length
advance(30)
const parts = W.cmds.slice(start).filter(c => /particle minecraft:dust/.test(c))
const frames = 30 / 3
ok('~34 particles per frame, ~6-7 frames/s', Math.abs(parts.length / frames - 34) < 4, (parts.length / frames).toFixed(1) + ' per frame')
const pts = parts.slice(0, 34).map(c => c.match(/dust [\d. ]+? (\S+) (\S+) (\S+) 0 0 0/).slice(1).map(Number))
ok('all behind the player (facing south = +z, so z < 0.5)', pts.every(p => p[2] < 0.5))
const xs = pts.map(p => p[0] - 0.5)
ok('mirrored left/right', Math.abs(xs.reduce((a, b) => a + b, 0)) < 0.01 && xs.some(x => x > 0.5) && xs.some(x => x < -0.5))
ok('wings between 0.8 and 2 blocks up', pts.every(p => p[1] >= 64.79 && p[1] <= 66.01))
// Bob faces west (-x): wings should be behind him at +x
cmd(['player'], players[0]); cmd(['player', 'on'], players[1])
start = W.cmds.length; advance(6)
const bob = W.cmds.slice(start).filter(c => /particle/.test(c)).map(c => c.match(/dust [\d. ]+? (\S+) (\S+) (\S+) 0 0 0/).slice(1).map(Number))
ok('turning the player turns the wings (facing west -> wings at +x)', bob.length && bob.every(p => p[0] > 0.5), bob.length + ' pts')
players[1].invis = true; start = W.cmds.length; advance(6)
ok('hidden while invisible', !W.cmds.slice(start).some(c => /particle/.test(c)))
cmd(['player', 'off'], players[1]); advance(10); start = W.cmds.length; advance(30)
ok('loop stops when nobody has wings', !W.cmds.slice(start).length && W.q.length == 0)
players.slice(0, 5).forEach(p => cmd(['player', 'on'], p))
const r = cmd(['player', 'on'], players[5])
ok('MAX_WINGED_PLAYERS enforced', r == 0 && /Already 5/.test(replies[replies.length - 1]))
console.log(fails ? fails + ' FAILED' : 'ALL PASSED')
