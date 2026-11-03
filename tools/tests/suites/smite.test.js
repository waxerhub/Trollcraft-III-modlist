// Run with: node tools/tests/run_all.js smite   (or node tools/tests/suites/smite.test.js)
const REPO_ROOT = require('path').resolve(__dirname, '..', '..', '..')
const fs = require('fs')
function setup(patch) {
  let src = fs.readFileSync(REPO_ROOT + '/tools/kubejs/server_scripts/smite.js', 'utf8')
  if (patch) src = patch(src)
  const W = { tick: 0, q: [], cmds: [], blocks: {}, spawned: [] }
  const level = {
    dimension: { toString: () => 'minecraft:overworld' },
    getBlock: (x, y, z) => ({ id: W.blocks[x + ',' + y + ',' + z] || 'minecraft:air' }),
    createEntity: t => { const e = { t, visual: false, setVisualOnly(v) { this.visual = v }, setPosition(x, y, z) { this.p = [x, y, z] }, spawn() { W.spawned.push(this) } }; return e },
  }
  const server = { runCommandSilent: c => {
      W.cmds.push(c)
      let m = c.match(/summon minecraft:lightning_bolt (\S+) (\S+) (\S+)/)
      if (m) { const x = Math.floor(+m[1]), y = Math.floor(+m[2]), z = Math.floor(+m[3]); W.q.push([W.tick + 1, () => { W.blocks[x + ',' + y + ',' + z] = 'minecraft:fire'; W.blocks[(x + 1) + ',' + y + ',' + z] = 'minecraft:fire' }]) }
      m = c.match(/setblock (\S+) (\S+) (\S+) minecraft:air/); if (m) delete W.blocks[m[1] + ',' + m[2] + ',' + m[3]]
      return 1 },
    scheduleInTicks: (n, f) => W.q.push([W.tick + n, f]) }
  const target = { level, getX: () => 10.5, getY: () => 64, getZ: () => -3.5, isRemoved: () => false, getGameProfile: () => ({ getName: () => 'Bob' }), burning: true, extinguish() { this.burning = false } }
  let reg = {}
  const event = { commands: { literal: n => { const node = { n, then(c) { if (!this.c) this.c = c; return this }, requires() { return this }, executes(f) { this.f = f; return this } }; return node }, argument: (n) => ({ then() { return this }, executes(f) { this.f = f; return this } }) },
    arguments: { PLAYER: { create: () => 'player', getResult: () => target }, PLAYERS: { create: () => 'players' } }, register: node => { reg[node.n] = node.c.f } }
  new Function('ServerEvents', 'Text', 'console', src)({ commandRegistry: f => f(event) }, { red: t => t }, { error: m => console.log('ERR ' + m) })
  const ctx = { source: { server, sendSystemMessage: m => console.log('reply: ' + m) } }
  W.run = (cmd, ticks) => { reg[cmd](ctx); for (let i = 0; i < ticks; i++) { W.tick++; const due = W.q.filter(x => x[0] <= W.tick); W.q = W.q.filter(x => x[0] > W.tick); due.forEach(x => x[1]()) } }
  return { W, target }
}
let fails = 0
const ok = (l, c, e) => { console.log((c ? 'ok   ' : 'FAIL ') + l + (e ? '  ' + e : '')); if (!c) fails++ }
// smite: existing fireplace fire nearby is kept, new fire removed, target extinguished
let { W, target } = setup()
W.blocks['11,64,-3'] = 'minecraft:fire'   // pre-existing fire 1 block away... gets overwritten by the strike's own fire spot? use a different one:
W.blocks = { '9,65,-5': 'minecraft:fire' }
W.run('smite', 30)
ok('/smite summons one real bolt', W.cmds.filter(c => /summon minecraft:lightning_bolt/.test(c)).length == 1)
ok('new fire from the strike is removed', !W.blocks['10,64,-4'] && !W.blocks['11,64,-4'], JSON.stringify(W.blocks))
ok('fire that was already there is kept', W.blocks['9,65,-5'] == 'minecraft:fire')
ok('target extinguished', target.burning === false)
ok('announced', W.cmds.some(c => /smitten/.test(c)))
// aura: visual only by default
;({ W, target } = setup())
W.run('aura', 60)
ok('/aura spawns visual-only bolts for 2 s (20 pulses x 2)', W.spawned.length == 40 && W.spawned.every(b => b.visual), W.spawned.length + ' bolts')
ok('no real lightning in default aura', !W.cmds.some(c => /summon minecraft:lightning_bolt/.test(c)))
const d = W.spawned.map(b => Math.hypot(b.p[0] - 10.5, b.p[2] + 3.5))
ok('aura bolts 1.5-4 blocks from the player', d.every(x => x >= 1.49 && x <= 4.01))
// aura damaging mode
;({ W, target } = setup(s => s.replace('const AURA_DAMAGES = false', 'const AURA_DAMAGES = true')))
W.run('aura', 80)
ok('damaging aura: 40 real bolts, all fire cleaned', W.cmds.filter(c => /summon minecraft:lightning_bolt/.test(c)).length == 40 && Object.keys(W.blocks).length == 0, Object.keys(W.blocks).length + ' fires left')
console.log(fails ? fails + ' FAILED' : 'ALL PASSED')
