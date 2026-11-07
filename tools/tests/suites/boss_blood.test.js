// part2/boss_blood.js: Twilight Forest boss kills fill the Blood Pool, the credit split among the fighters.
// Run with: node tools/tests/run_all.js boss_blood   (or node tools/tests/suites/boss_blood.test.js)
const fs = require('fs')
const paths = require('../lib/paths')
const src = fs.readFileSync(paths.server('part2/boss_blood.js'), 'utf8')
let fails = 0
const ok = (l, c, e) => { console.log((c ? 'ok   ' : 'FAIL ') + l + (!c && e !== undefined ? '  ' + e : '')); if (!c) fails++ }

// ---------- the mock ----------
const OW = 'minecraft:overworld', TF = 'twilightforest:twilight_forest'
const persistent = {}
const players = [], entities = []
const jlist = arr => ({ size: () => arr.length, get: i => arr[i] })
const server = {
  get players() { return jlist(players) },
  get entities() { return jlist(entities.filter(e => e.alive)) },
  persistentData: { getString: k => persistent[k] || '', putString: (k, v) => { persistent[k] = v } },
}
const level = dim => ({ dimension: { location: () => dim } })
function player(name, x, z, opts) {
  opts = opts || {}
  const p = { name, x, y: 64, z, dim: opts.dim || TF, msgs: [], creative: !!opts.creative, op: !!opts.op,
    isPlayer: () => true, getGameProfile: () => ({ getName: () => name }), getStringUuid: () => 'U-' + name,
    getX: () => p.x, getY: () => p.y, getZ: () => p.z, get level() { return level(p.dim) },
    isCreative: () => p.creative, isSpectator: () => false, hasPermissions: () => p.op, tell: c => p.msgs.push(c) }
  players.push(p)
  return p
}
function mob(type, x, z, extra) {
  const e = Object.assign({ type, x, y: 64, z, dim: TF, alive: true,
    isPlayer: () => false, getEncodeId: () => type, getX: () => e.x, getY: () => e.y, getZ: () => e.z,
    get level() { return level(e.dim) }, isAlive: () => e.alive }, extra || {})
  entities.push(e)
  return e
}
const added = []
const BloodPool = { addDrops: (n, source, uuid, name) => { added.push({ n, source, uuid, name }) } }
const global = { BloodPool }
let deathHandler = null, cmdTree = null
const logs = []
const Serializer = { fromJsonLenient: j => JSON.parse(j) }
const node = (n) => ({ n, ch: [], req: null, f: null, then(c) { this.ch.push(c); return this }, requires(f) { this.req = f; return this }, executes(f) { this.f = f; return this } })
new Function('EntityEvents', 'ServerEvents', 'Java', 'Utils', 'Text', 'console', 'global', src)(
  { death: h => { deathHandler = h } },
  { commandRegistry: h => h({ commands: { literal: node }, register: t => { cmdTree = t } }) },
  { loadClass: () => Serializer },
  { server },
  { of: s => s },
  { info: m => logs.push(m), warn: m => logs.push('WARN ' + m), error: m => logs.push('ERR ' + m) },
  global)
const text = c => (Array.isArray(c) ? c.map(x => (typeof x == 'string' ? x : x.text)).join('') : String(c))
function kill(e, killer, msgId) {
  e.alive = false
  deathHandler({ entity: e, server, source: { getMsgId: () => msgId || 'player', getActual: () => killer || null } })
}
function run(args, as) {
  const replies = []
  const src2 = { hasPermission: () => !as || as.op, sendSystemMessage: c => replies.push(text(c)) }
  let n = cmdTree
  args.forEach(a => { n = n.ch.find(c => c.n == a) })
  if (n.req && !n.req(src2)) return ['DENIED']
  n.f({ source: src2 })
  return replies
}
const total = () => added.reduce((a, b) => a + b.n, 0)
const reset = () => { added.length = 0 }

// ---------- checks ----------
const ana = player('Ana', 0, 0), bo = player('Bo', 10, 0)
kill(mob('twilightforest:naga', 5, 0), ana)
ok('a Naga: 200 Drops into the Pool', total() == 200, total())
ok('... split between the two fighters, 100 each', added.length == 2 && added.every(a => a.n == 100 && a.source == 'boss'), JSON.stringify(added))
ok('... and everyone online is told', /\[BLOOD GOD\] The Naga has fallen to (Ana and Bo|Bo and Ana)\. \+200 Drops of Blood\./.test(text(ana.msgs[0])) && bo.msgs.length == 1, text(ana.msgs[0]))

reset()
const cy = player('Cy', 20, 0)
kill(mob('twilightforest:minoshroom', 5, 0), bo)
ok('an odd split: 350 among three is 118 + 116 + 116, the remainder to the killer', total() == 350 && added[0].name == 'Bo' && added[0].n == 118 && added[1].n == 116 && added[2].n == 116, JSON.stringify(added))

reset()
const clone = mob('twilightforest:lich', 5, 0, { isShadowClone: () => true })
kill(clone, ana)
ok('a Lich shadow clone pays nothing', total() == 0)
const clone2 = mob('twilightforest:lich', 5, 0, { getNbt: () => ({ getBoolean: k => k == 'ShadowClone' }) })
kill(clone2, ana)
ok('... nor one recognised only by its NBT', total() == 0)
kill(mob('twilightforest:lich', 5, 0, { isShadowClone: () => false }), ana)
ok('the real Lich pays 300', total() == 300, total())

reset()
const knights = [0, 1, 2, 3, 4, 5].map(i => mob('twilightforest:knight_phantom', i * 3, 5))
knights.slice(0, 5).forEach(k => kill(k, ana))
ok('the first five Knight Phantoms pay nothing', total() == 0, total())
kill(knights[5], ana)
ok('the last of the group pays 400, once', total() == 400, total())

reset()
kill(mob('twilightforest:hydra', 5, 0), null, 'genericKill')
ok('/kill pays nothing', total() == 0)
kill(mob('twilightforest:ur_ghast', 5, 0), null, 'outOfWorld')
ok('the void pays nothing', total() == 0)
kill(mob('twilightforest:snow_queen', 5000, 5000), null)
ok('a boss with no player nearby pays nothing', total() == 0)
const dee = player('Dee', 5000, 5003, { creative: true })
kill(mob('twilightforest:alpha_yeti', 5000, 5000), dee)
ok('creative players aren\'t fighters (so nothing is paid)', total() == 0)
const eve = player('Eve', 0, 0, { dim: OW })
kill(mob('twilightforest:hydra', 0, 0), ana)
ok('a player in another dimension at the same spot isn\'t a fighter', total() == 600 && !added.some(a => a.name == 'Eve'), JSON.stringify(added))
reset()
kill(mob('minecraft:zombie', 5, 0), ana)
ok('ordinary mobs are ignored', total() == 0)

const D = JSON.parse(persistent.boss_blood || '{}')
ok('kills and drops are saved per boss', D.kills['twilightforest:naga'] == 1 && D.kills['twilightforest:knight_phantom'] == 1 && D.drops['twilightforest:lich'] == 300, persistent.boss_blood)
ok('... with a log, newest first', D.log.length == 5 && D.log[0].boss == 'twilightforest:hydra', JSON.stringify(D.log.map(k => k.boss)))

const ladder = run([], ana)
ok('/bossblood lists the 8 bosses with their rewards and kills', ladder.length == 9 && /I\. The Naga: 200 Drops \(slain 1x, 200 so far\)/.test(ladder.join('\n')) && /IV\. The Snow Queen: 1,000 Drops/.test(ladder.join('\n')), ladder.join(' | '))
ok('/bossblood log is op-only', run(['log'], ana)[0] == 'DENIED')
const op = player('Op', 9999, 9999, { op: true, dim: OW })
ok('... and lists the kills for ops', /the Hydra \+600 \(Ana/.test(run(['log'], op)[0]), run(['log'], op)[0])

global.BloodPool = undefined
reset()
kill(mob('twilightforest:naga', 5, 0), ana)
ok('without the Blood Pool: nothing paid, one warning', total() == 0 && logs.filter(l => /not installed/.test(l)).length == 1)
kill(mob('twilightforest:naga', 5, 0), ana)
ok('... only warned once', logs.filter(l => /not installed/.test(l)).length == 1)
ok('no errors logged', !logs.some(l => /^ERR/.test(l)), logs.filter(l => /^ERR/.test(l)).join('; '))

console.log(fails ? fails + ' FAILED' : 'ALL PASSED')
