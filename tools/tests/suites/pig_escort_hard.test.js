// Run with: node tools/tests/run_all.js pig_escort_hard   (or node tools/tests/suites/pig_escort_hard.test.js)
const REPO_ROOT = require('path').resolve(__dirname, '..', '..', '..')
// Hard mode: growing waves (+2 every other wave, up to 16) and more brutes.
const { makeWorld, loadScript, buildCommands } = require('../lib/mock')
const FILE = process.env.PE_FILE || REPO_ROOT + '/tools/kubejs/server_scripts/events/pig_escort.js'
let fails = 0
function check(label, cond, extra) { console.log((cond ? 'ok   ' : 'FAIL ') + label + (cond || extra === undefined ? '' : '  ' + extra)); if (!cond) fails++ }

function run(difficulty, players, minutes, killEachWave) {
  const W = makeWorld({})
  W.log2 = []
  const orig = W.server.runCommandSilent
  W.server.runCommandSilent = cmd => { W.log2.push({ t: W.tick, c: cmd }); return orig(cmd) }
  loadScript(W, FILE, s => s.replace('const TEST_MODE = false', 'const TEST_MODE = true').replace('const FINALE_ENABLED = true', 'const FINALE_ENABLED = false'))
  W.serverStarted = true
  W.fire('loaded', { server: W.server })
  buildCommands(W)
  W.advance(25)
  const ps = []
  for (let i = 0; i < players; i++) { const p = W.addPlayer('P' + i, 0.5 + i, 65, 0.5); p.hasPermissions = n => i == 0; ps.push(p) }
  const admin = ps[0]
  W.cmd('pigescort setup', admin)
  W.cmd('pigescort setstart', admin)
  admin.x = 0.5; admin.z = 200.5
  W.cmd('pigescort setportal', admin)
  admin.x = 0.5; admin.z = 0.5
  W.cmd('pigescort settime ' + minutes, admin)
  W.cmd('pigescort difficulty ' + difficulty, admin)
  W.cmd('pigescort start', admin)
  W.advance(10 * 20 + 2)
  const S = W.global.pigEscortState
  const waves = []
  let lastWaveObj = null
  const kill = () => W.entities.forEach(e => { if (e._tags.indexOf('pig_escort_raider') >= 0 && !e.removed) { e.removed = true; e.alive = false } })
  for (let t = 0; t < minutes * 60 * 20 && S.phase == 'running'; t += 20) {
    W.advance(20)
    if (S.run && S.run.lastWave && S.run.lastWave !== lastWaveObj) {
      lastWaveObj = S.run.lastWave
      waves.push({ t: W.tick, wanted: lastWaveObj.wanted, spawned: lastWaveObj.spawned, half: W.tick >= S.run.halfTick })
      if (killEachWave) kill()
    }
    // keep the pig safe and in place
    const pig = W.entities.find(e => e.type == 'minecraft:pig' && !e.removed)
    if (pig) pig.health = 100
  }
  return { W, S, waves, admin }
}

{
  const { W, waves } = run('hard', 5, 12, true)
  const sizes = waves.slice(0, 11).map(w => w.wanted)
  check('hard, 5 escorts: waves 8, 8, 10, 10, 12, 12, 14, 14, 16, 16, 16', sizes.join(',') == '8,8,10,10,12,12,14,14,16,16,16', sizes.join(','))
  check('... every 30 s', waves.slice(1, 10).every((w, i) => w.t - waves[i].t == 600), waves.slice(0, 5).map(w => w.t).join(','))
  check('... never above 16', waves.every(w => w.wanted <= 16))
  const summons = W.log2.filter(e => /summon minecraft:(piglin|piglin_brute|hoglin) /.test(e.c))
  check('no script errors', !W.errors, W.errors)
}
{
  // without killing: the 24 cap limits what spawns
  const { waves } = run('hard', 5, 5, false)
  check('hard, nobody killed: waves fill up to 24 alive and stop', waves[0].spawned == 8 && waves[1].spawned == 8 && waves[2].spawned == 8 && (waves[3] ? waves[3].wanted == 0 || waves[3].spawned == 0 : true),
    JSON.stringify(waves.slice(0, 5)))
}
{
  // early/late from tick stamps
  let early = { b: 0, n: 0 }, late = { b: 0, n: 0 }
  for (let r = 0; r < 4; r++) {
    const { W, waves } = run('hard', 5, 20, true)
    const halfTick = (waves.find(w => w.half) || {}).t || Infinity
    W.log2.filter(e => /summon minecraft:(piglin|piglin_brute|hoglin) /.test(e.c)).forEach(e => {
      const bucket = e.t >= halfTick ? late : early
      bucket.n++
      if (/summon minecraft:piglin_brute /.test(e.c)) bucket.b++
    })
  }
  const pe = early.b / early.n, pl = late.b / late.n
  check('brutes about 29% of raiders in the first half, about 41% in the second', Math.abs(pe - 4 / 14) < 0.06 && Math.abs(pl - 7 / 17) < 0.06,
    (pe * 100).toFixed(1) + '% of ' + early.n + ', ' + (pl * 100).toFixed(1) + '% of ' + late.n)
}
{
  const { waves } = run('medium', 5, 5, true)
  check('medium unchanged: 3 + 2 = 5 every wave, no growth', waves.length >= 5 && waves.every(w => w.wanted == 5), waves.map(w => w.wanted).join(','))
  const e = run('easy', 1, 4, true).waves
  check('easy unchanged: 2 every wave', e.length >= 3 && e.every(w => w.wanted == 2), e.map(w => w.wanted).join(','))
}
{
  // /pigescort wave doesn't count towards growth; status shows the count and the next size
  const W = makeWorld({})
  W.log2 = []
  loadScript(W, FILE, s => s.replace('const TEST_MODE = false', 'const TEST_MODE = true'))
  W.serverStarted = true; W.fire('loaded', { server: W.server }); buildCommands(W); W.advance(25)
  const ps = []
  for (let i = 0; i < 5; i++) { const p = W.addPlayer('P' + i, 0.5 + i, 65, 0.5); p.hasPermissions = n => i == 0; ps.push(p) }
  const admin = ps[0]
  W.cmd('pigescort setup', admin); W.cmd('pigescort setstart', admin)
  admin.z = 200.5; W.cmd('pigescort setportal', admin); admin.z = 0.5
  W.cmd('pigescort difficulty hard', admin); W.cmd('pigescort start', admin)
  W.advance(10 * 20 + 2)
  const S = W.global.pigEscortState
  for (let i = 0; i < 3; i++) W.cmd('pigescort wave', admin)
  check('/pigescort wave x3: each 8, waves so far still 0', S.run.lastWave.wanted == 8 && (S.run.waveCount || 0) == 0, S.run.lastWave.wanted + ' ' + S.run.waveCount)
  const r = W.cmd('pigescort status', admin)
  check('status: "Waves so far: 0 (next: 8 mobs)"', /Waves so far: 0 \(next: 8 mobs\)/.test(r.replies[0]), r.replies[0])
  check('no script errors', !W.errors)
}
// ======================= Elite raiders on hard =======================
function summonsFor(file, difficulty, minutes) {
  const save = process.env.PE_FILE
  const W = makeWorld({})
  W.log2 = []
  const orig = W.server.runCommandSilent
  W.server.runCommandSilent = cmd => { W.log2.push({ t: W.tick, c: cmd }); return orig(cmd) }
  loadScript(W, file, s => s.replace('const TEST_MODE = false', 'const TEST_MODE = true').replace('const FINALE_ENABLED = true', 'const FINALE_ENABLED = false'))
  W.serverStarted = true; W.fire('loaded', { server: W.server }); buildCommands(W); W.advance(25)
  const admin = W.addPlayer('P0', 0.5, 65, 0.5); admin.hasPermissions = n => true
  W.cmd('pigescort setup', admin); W.cmd('pigescort setstart', admin)
  admin.z = 200.5; W.cmd('pigescort setportal', admin); admin.z = 0.5
  W.cmd('pigescort difficulty ' + difficulty, admin); W.cmd('pigescort settime ' + minutes, admin); W.cmd('pigescort start', admin)
  W.advance(10 * 20 + 2)
  for (let i = 0; i < 30; i++) {
    W.cmd('pigescort wave', admin)
    W.entities.forEach(e => { if (e._tags.indexOf('pig_escort_raider') >= 0) { e.removed = true; e.alive = false } })
  }
  W.advance(20 * 60 * minutes / 2 + 40)   // into the second half (brutes on medium)
  for (let i = 0; i < 30; i++) {
    W.cmd('pigescort wave', admin)
    W.entities.forEach(e => { if (e._tags.indexOf('pig_escort_raider') >= 0) { e.removed = true; e.alive = false } })
  }
  const nbts = {}
  W.log2.filter(e => /summon minecraft:(piglin|piglin_brute|hoglin) /.test(e.c)).forEach(e => {
    const m = e.c.match(/summon (\S+) \S+ \S+ \S+ (\{.*\})$/)
    const kind = m[1] == 'minecraft:piglin' ? (/crossbow/.test(m[2]) ? 'marksman' : 'piglin') : m[1] == 'minecraft:piglin_brute' ? 'brute' : 'hoglin'
    nbts[kind] = nbts[kind] || {}
    nbts[kind][m[2]] = true
  })
  return { W, nbts, admin }
}
{
  const { W, nbts, admin } = summonsFor(FILE, 'hard', 20)
  const one = k => Object.keys(nbts[k] || {})
  check('hard: every kind spawned, each with one fixed elite NBT', ['piglin', 'marksman', 'brute', 'hoglin'].every(k => one(k).length == 1), JSON.stringify(Object.keys(nbts).map(k => k + ':' + one(k).length)))
  const pig = one('piglin')[0] || '', mk = one('marksman')[0] || '', br = one('brute')[0] || '', ho = one('hoglin')[0] || ''
  check('... piglin: netherite sword, Sharpness V + Fire Aspect II, 40 HP (spawns full), 9 attack, 10 armor, 4 toughness, 0.3 knockback res.',
    /HandItems:\[\{id:"minecraft:netherite_sword",Count:1b,tag:\{Enchantments:\[\{id:"minecraft:sharpness",lvl:5s\},\{id:"minecraft:fire_aspect",lvl:2s\}\]\}\},\{\}\],HandDropChances:\[0f,0f\]/.test(pig) &&
    /generic.max_health",Base:40d/.test(pig) && /Health:40f/.test(pig) && /generic.attack_damage",Base:9d/.test(pig) && /generic.armor",Base:10d/.test(pig) &&
    /generic.armor_toughness",Base:4d/.test(pig) && /generic.knockback_resistance",Base:0.3d/.test(pig) && /generic.follow_range",Base:48d/.test(pig), pig)
  check('... marksman: Quick Charge III + Multishot crossbow, 40 HP', /minecraft:crossbow",Count:1b,tag:\{Enchantments:\[\{id:"minecraft:quick_charge",lvl:3s\},\{id:"minecraft:multishot",lvl:1s\}\]/.test(mk) && /Health:40f/.test(mk) && !/attack_damage/.test(mk), mk)
  check('... brute: Sharpness V netherite axe, 90 HP, 14 attack, 16 armor', /netherite_axe",Count:1b,tag:\{Enchantments:\[\{id:"minecraft:sharpness",lvl:5s\}\]/.test(br) && /Health:90f/.test(br) && /attack_damage",Base:14d/.test(br) && /armor",Base:16d/.test(br), br)
  check('... hoglin: 60 HP, 10 attack, no hand items', /Health:60f/.test(ho) && /attack_damage",Base:10d/.test(ho) && !/HandItems/.test(ho), ho)
  check('... all: kept persistent, never zombify, drop nothing, glow, tagged', [pig, mk, br, ho].every(n => /^\{PersistenceRequired:1b,IsImmuneToZombification:1b,DeathLootTable:"minecraft:empty",Tags:\["pig_escort_raider"\],Glowing:1b,/.test(n) && (!/HandItems/.test(n) || /HandDropChances:\[0f,0f\]/.test(n))))
  // pig damage scaling: 0.4 on hard
  const S = W.global.pigEscortState
  const pigE = W.entities.find(e => e.type == 'minecraft:pig' && !e.removed)
  const mob = W.makeEntity('minecraft:piglin', 0, 65, 0, ['pig_escort_raider'])
  let amount = 20
  W.global.pigEscort.onLivingHurt({ getEntity: () => pigE, getSource: () => ({ getActual: () => mob }), getAmount: () => amount, setAmount: v => { amount = v } })
  check('hard: a raider hit on the pig is scaled by 0.4 (20 -> 8)', Math.abs(amount - 8) < 1e-9, amount)
  const r = W.cmd('pigescort status', admin)
  check('status says elite raiders on hard', /Difficulty: hard \(elite raiders\)/.test(r.replies[0]), r.replies[0])
  check('no script errors (hard)', !W.errors)
}
{
  ['easy', 'medium'].forEach(d => {
    // (Before the harness moved into the repo, this compared against a copy of pig_escort.js from before the elite change.)
    const now = summonsFor(FILE, d, 20).nbts
    const flat = o => Object.keys(o).sort().map(k => k + '=' + Object.keys(o[k]).sort().join('|')).join('\n')
    check(d + ': raiders spawn, without the hard-mode elite gear', flat(now).length > 0 && !/sharpness",lvl:5s|quick_charge",lvl:3s|Health:90f/.test(flat(now)), flat(now))
  })
  const W = summonsFor(FILE, 'medium', 20).W
  const pigE = W.entities.find(e => e.type == 'minecraft:pig' && !e.removed)
  const mob = W.makeEntity('minecraft:piglin', 0, 65, 0, ['pig_escort_raider'])
  let amount = 20
  W.global.pigEscort.onLivingHurt({ getEntity: () => pigE, getSource: () => ({ getActual: () => mob }), getAmount: () => amount, setAmount: v => { amount = v } })
  check('medium: still scaled by 0.5', amount == 10, amount)
}
console.log(fails ? fails + ' FAILED' : 'ALL PASSED')
