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
  const target = { level, getX: () => 10.5, getY: () => 64, getZ: () => -3.5, gone: false, dead: false, isRemoved() { return this.gone }, isAlive() { return !this.dead }, getGameProfile: () => ({ getName: () => 'Bob' }), burning: true, extinguish() { this.burning = false } }
  let reg = {}
  const event = { commands: { literal: n => { const node = { n, then(c) { if (!this.c) this.c = c; return this }, requires() { return this }, executes(f) { this.f = f; return this } }; return node }, argument: (n) => ({ n, kids: {}, then(c) { this.kids[c.n] = c; return this }, executes(f) { this.f = f; return this } }) },
    arguments: { PLAYER: { create: () => 'player', getResult: () => target }, PLAYERS: { create: () => 'players' }, INTEGER: { create: () => 'int', getResult: () => W.times } }, register: node => { reg[node.n] = node.c.f; if (node.c.kids && node.c.kids.times) reg[node.n + ' times'] = node.c.kids.times.f } }
  W.replies = []
  new Function('ServerEvents', 'Text', 'console', src)({ commandRegistry: f => f(event) }, { red: t => t, of: t => t }, { error: m => console.log('ERR ' + m) })
  const ctx = { source: { server, sendSystemMessage: m => W.replies.push(String(m)) } }
  W.advance = ticks => { for (let i = 0; i < ticks; i++) { W.tick++; const due = W.q.filter(x => x[0] <= W.tick); W.q = W.q.filter(x => x[0] > W.tick); due.forEach(x => x[1]()) } }
  W.run = (cmd, ticks) => { reg[cmd](ctx); W.advance(ticks) }
  W.smiteTimes = (n, ticks) => { W.times = n; W.run('smite times', ticks) }
  W.bolts = () => W.cmds.filter(c => /summon minecraft:lightning_bolt/.test(c)).length
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
ok('/smite speaks for the Syndicate, in its colours', W.cmds.some(c => /\[SYNDICATE\].*dark_red.*smitten by order of the Syndicate\..*"red"/.test(c)))
ok('... and never mentions the Ministry', !W.cmds.some(c => /ministry/i.test(c)))
// /smite <player> <times>
;({ W, target } = setup())
W.smiteTimes(3, 0)
ok('/smite 3: the first strike lands at once, one announcement', W.bolts() == 1 && W.cmds.filter(c => /smitten 3 times by order of the Syndicate\./.test(c)).length == 1)
W.advance(14); ok('... no second strike before 15 ticks', W.bolts() == 1)
W.advance(1); ok('... the second lands at 15', W.bolts() == 2)
W.advance(15); ok('... the third at 30', W.bolts() == 3)
W.advance(60); ok('... and no more', W.bolts() == 3)
ok('every strike\'s fire is put out', !Object.keys(W.blocks).length, JSON.stringify(W.blocks))
ok('the player is put out too', target.burning === false)
;({ W, target } = setup()); W.smiteTimes(1, 40)
ok('/smite 1 reads like plain /smite', W.bolts() == 1 && W.cmds.some(c => /has been smitten by order of the Syndicate\./.test(c)))
;({ W, target } = setup()); W.smiteTimes(0, 40)
ok('/smite 0 is refused, and nothing strikes', W.bolts() == 0 && /at least once/.test(W.replies.join()) && !W.cmds.some(c => /smitten/.test(c)))
;({ W, target } = setup()); W.smiteTimes(-2, 40)
ok('a negative number is refused too', W.bolts() == 0)
;({ W, target } = setup()); W.smiteTimes(500, 400)
ok('a huge number is capped at 20 strikes, and the op is told', W.bolts() == 20 && /Capped at 20/.test(W.replies.join()) && W.cmds.some(c => /smitten 20 times/.test(c)))
;({ W, target } = setup()); W.smiteTimes(5, 20); target.gone = true; W.advance(100)
ok('strikes stop when the player logs out', W.bolts() == 2, W.bolts())
;({ W, target } = setup()); W.smiteTimes(5, 20); target.dead = true; W.advance(100)
ok('strikes stop when the player dies', W.bolts() == 2, W.bolts())
// aura: visual only by default
;({ W, target } = setup())
W.run('aura', 60)
ok('/aura speaks for the Syndicate', W.cmds.some(c => /\[SYNDICATE\].*Syndicate-sanctioned aura/.test(c)) && !W.cmds.some(c => /ministry/i.test(c)))
ok('/aura spawns visual-only bolts for 2 s (20 pulses x 2)', W.spawned.length == 40 && W.spawned.every(b => b.visual), W.spawned.length + ' bolts')
ok('no real lightning in default aura', !W.cmds.some(c => /summon minecraft:lightning_bolt/.test(c)))
const d = W.spawned.map(b => Math.hypot(b.p[0] - 10.5, b.p[2] + 3.5))
ok('aura bolts 1.5-4 blocks from the player', d.every(x => x >= 1.49 && x <= 4.01))
// aura damaging mode
;({ W, target } = setup(s => s.replace('const AURA_DAMAGES = false', 'const AURA_DAMAGES = true')))
W.run('aura', 80)
ok('damaging aura: 40 real bolts, all fire cleaned', W.cmds.filter(c => /summon minecraft:lightning_bolt/.test(c)).length == 40 && Object.keys(W.blocks).length == 0, Object.keys(W.blocks).length + ' fires left')
console.log(fails ? fails + ' FAILED' : 'ALL PASSED')
