// Run with: node tools/tests/run_all.js boss_blood   (or node tools/tests/suites/boss_blood.test.js)
const REPO_ROOT = require('path').resolve(__dirname, '..', '..', '..')
const fs = require('fs')
const SRC = fs.readFileSync(REPO_ROOT + '/tools/kubejs/server_scripts/part2/boss_blood.js', 'utf8')
const CHESTS = fs.readFileSync(REPO_ROOT + '/tools/kubejs/server_scripts/part2/twilight_bosses.js', 'utf8')
let fails = 0
const ok = (l, c, e) => { console.log((c ? 'ok   ' : 'FAIL ') + l + (!c && e !== undefined ? '  ' + e : '')); if (!c) fails++ }

const jlist = a => ({ size: () => a.length, get: i => a[i] })
function setup(opts) {
  opts = opts || {}
  const W = { paid: [], cmds: [], saved: {}, handlers: {}, roots: {} }
  const level = d => ({ dimension: d || 'minecraft:twilightforest:twilight_forest' })
  W.players = []
  W.entities = []
  W.server = { get players() { return jlist(W.players) }, get entities() { return jlist(W.entities) },
    persistentData: { getString: k => W.saved[k] || '', putString: (k, v) => { W.saved[k] = v } },
    runCommandSilent: c => { W.cmds.push(c); return 1 } }
  W.player = (name, x, z, more) => {
    const p = Object.assign({ name, x, y: 64, z, inbox: [], creative: false, level: level(), getGameProfile() { return { getName: () => name } },
      getStringUuid: () => 'uuid-' + name, isCreative() { return this.creative }, isSpectator: () => false, isPlayer: () => true,
      getX() { return this.x }, getY() { return this.y }, getZ() { return this.z }, tell(c) { this.inbox.push(c.json || String(c)) } }, more || {})
    W.players.push(p); return p
  }
  W.boss = (id, x, z, more) => {
    const e = Object.assign({ id, x, y: 64, z, alive: true, level: level(), getEncodeId: () => id, isPlayer: () => false,
      getX() { return this.x }, getY() { return this.y }, getZ() { return this.z }, isAlive() { return this.alive } }, more || {})
    W.entities.push(e); return e
  }
  // Kill: health 0 first (TF's die() runs then), like the real death event.
  W.kill = (e, killer, msgId) => { e.alive = false; W.handlers.death({ entity: e, server: W.server, source: { getMsgId: () => msgId || 'player', getActual: () => killer || null } }) }
  const Blood = { addDrops: (n, source, uuid, name) => { W.paid.push({ n, source, uuid, name }); return n } }
  const g = opts.noPool ? {} : { BloodPool: Blood }
  const node = (n, t) => ({ n, t, ch: [], then(c) { this.ch.push(c); return this }, requires(f) { this.req = f; return this }, executes(f) { this.f = f; return this } })
  const ev = { commands: { literal: n => node(n, 'lit') }, register: r => { W.roots[r.n] = r } }
  W.cmd = (line, op) => {
    const toks = line.split(' '); let n = W.roots[toks[0]]; const out = []
    for (let i = 1; i < toks.length; i++) n = n.ch.find(c => c.n == toks[i])
    const src = { server: W.server, hasPermission: () => op !== false, sendSystemMessage: m => out.push(m.json || String(m)) }
    if (n.req && !n.req(src)) return 'DENIED'
    n.f({ source: src }); return out
  }
  const Java = { loadClass: () => ({ fromJsonLenient: s => ({ json: s }) }) }
  const consoleStub = { info: () => {}, warn: m => { W.warned = m }, error: m => { W.error = m } }
  new Function('EntityEvents', 'ServerEvents', 'Java', 'Utils', 'Text', 'console', 'global', SRC)(
    { death: f => { W.handlers.death = f } }, { commandRegistry: f => f(ev) }, Java, { server: W.server }, { of: t => String(t) }, consoleStub, g)
  W.global = g
  return W
}
const paidTotal = W => W.paid.reduce((a, p) => a + p.n, 0)

let W = setup()
const B = W.global.BossBlood.bosses
const ids = Object.keys(B)
const byRank = ids.slice().sort((a, b) => B[a].rank - B[b].rank)
ok('eight bosses, ranks 1 to 8', ids.length == 8 && byRank.every((id, i) => B[id].rank == i + 1))
ok('... easiest first: Naga, Minoshroom, Alpha Yeti, Lich, Knight Phantoms, Hydra, Ur-Ghast, Snow Queen',
  byRank.map(id => B[id].name).join(', ') == 'the Naga, the Minoshroom, the Alpha Yeti, the Lich, the Knight Phantoms, the Hydra, the Ur-Ghast, the Snow Queen',
  byRank.map(id => B[id].name).join(', '))
// The same order as the boss chests (part2/twilight_bosses.js).
const cg = {}
new Function('ServerEvents', 'Item', 'console', 'global', CHESTS)({ entityLootTables: () => {}, chestLootTables: () => {} }, { exists: () => true }, { info() {}, error() {} }, cg)
ok('... the same ranking as the boss chests in twilight_bosses.js', cg.TwilightBosses.BOSSES.map(b => 'the ' + b.name).join() == byRank.map(id => B[id].name).join())
ok('harder bosses always pay more', byRank.every((id, i) => i == 0 || B[id].drops > B[byRank[i - 1]].drops), byRank.map(id => B[id].drops).join())
ok('... from 200 (Naga) to 1,000 (Snow Queen), the same two ends as before', B['twilightforest:naga'].drops == 200 && B['twilightforest:snow_queen'].drops == 1000)
ok('... each step 15-35% more than the last', byRank.every((id, i) => { if (!i) return true; const r = B[id].drops / B[byRank[i - 1]].drops; return r >= 1.15 && r <= 1.35 }))

// Every boss pays its amount to one fighter nearby.
byRank.forEach(id => {
  W = setup()
  const p = W.player('Ann', 10, 0)
  W.kill(W.boss(id, 0, 0), p)
  ok(B[id].name + ' pays ' + B[id].drops + ' Drops, source "boss"', W.paid.length == 1 && W.paid[0].n == B[id].drops && W.paid[0].source == 'boss' && W.paid[0].uuid == 'uuid-ann', JSON.stringify(W.paid))
})

// The split: equal shares, the killer takes the remainder.
W = setup()
const a = W.player('Ann', 5, 0), b2 = W.player('Bob', 0, 20), c = W.player('Cy', 30, 30)
W.player('Far', 500, 0)
W.kill(W.boss('twilightforest:hydra', 0, 0), b2)
ok('Hydra with three fighters: 216 each, and the killer also takes the 2 left over', W.paid.map(p => p.name + ' ' + p.n).join(', ') == 'Bob 218, Ann 216, Cy 216', W.paid.map(p => p.name + ' ' + p.n).join(', '))
ok('... adds up to 650, and the player 500 blocks away gets nothing', paidTotal(W) == 650 && !W.paid.some(p => p.name == 'Far'))
ok('... everyone online is told with player.tell (never tellraw @a)', W.players.every(p => /The Hydra has fallen to Bob, Ann and Cy\. \+650 Drops of Blood\./.test(p.inbox.join())) && !W.cmds.some(x => /tellraw/.test(x)), W.players[0].inbox.join())

// The Lich's shadow clones pay nothing.
W = setup()
let p = W.player('Ann', 5, 0)
W.kill(W.boss('twilightforest:lich', 0, 0, { isShadowClone: () => true }), p)
ok('a Lich shadow clone pays nothing', W.paid.length == 0)
W.kill(W.boss('twilightforest:lich', 0, 0, { isShadowClone: () => false }), p)
ok('... the real Lich pays 400', paidTotal(W) == 400)

// Knight Phantoms: the group pays once, when the last one dies.
W = setup()
p = W.player('Ann', 5, 0)
const knights = [0, 1, 2, 3, 4, 5].map(i => W.boss('twilightforest:knight_phantom', i * 3, 0))
knights.slice(0, 5).forEach(k => W.kill(k, p))
ok('five Knight Phantoms dead: nothing yet', W.paid.length == 0)
W.kill(knights[5], p)
ok('... the sixth: the group pays 500 once', W.paid.length == 1 && paidTotal(W) == 500)
ok('... and the message says "have fallen"', /The Knight Phantoms have fallen to Ann\./.test(p.inbox.join()))

// What never pays.
W = setup(); p = W.player('Ann', 5, 0)
W.kill(W.boss('twilightforest:snow_queen', 0, 0), p, 'genericKill')
W.kill(W.boss('twilightforest:snow_queen', 0, 0), p, 'outOfWorld')
ok('/kill and the void pay nothing', W.paid.length == 0)
W = setup(); W.player('Ann', 200, 0)
W.kill(W.boss('twilightforest:snow_queen', 0, 0), null)
ok('no player within 64 blocks: nothing', W.paid.length == 0)
W = setup(); p = W.player('Ann', 5, 0); p.creative = true
W.kill(W.boss('twilightforest:snow_queen', 0, 0), p)
ok('a creative player alone: nothing', W.paid.length == 0)
W = setup(); p = W.player('Ann', 5, 0)
W.kill(W.boss('twilightforest:lich_minion', 0, 0), p)
ok('a boss\'s minions pay nothing', W.paid.length == 0)
W = setup({ noPool: true }); p = W.player('Ann', 5, 0)
W.kill(W.boss('twilightforest:naga', 0, 0), p)
ok('without blood_pool.js: nothing paid, a warning logged', /not installed/.test(W.warned || ''))

// /bossblood lists them in rank order; the log and stats are kept.
W = setup(); p = W.player('Ann', 5, 0)
W.kill(W.boss('twilightforest:ur_ghast', 0, 0), p)
const out = W.cmd('bossblood')
const rows = out.slice(1).map(s => JSON.parse(s)[2].text)
ok('/bossblood: eight rows, I. to VIII., easiest first', rows.length == 8 && /^I\. The Naga: 200 Drops$/.test(rows[0]) && /^VIII\. The Snow Queen: 1,000 Drops$/.test(rows[7]) && /^II\. The Minoshroom: 250 Drops$/.test(rows[1]) && /^III\. The Alpha Yeti: 300 Drops$/.test(rows[2]) && /^IV\. The Lich: 400 Drops$/.test(rows[3]), rows.join(' | '))
ok('... with what each has paid so far', /^VII\. The Ur-Ghast: 800 Drops \(slain 1x, 800 so far\)$/.test(rows[6]), rows[6])
ok('/bossblood log is for ops', W.cmd('bossblood log', false) == 'DENIED' && /Ur-Ghast \+800 \(Ann\)/.test(W.cmd('bossblood log').join()))
ok('the kill is saved', JSON.parse(W.saved.boss_blood).kills['twilightforest:ur_ghast'] == 1)

console.log(fails ? fails + ' FAILED' : 'ALL PASSED')
