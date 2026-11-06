// back_toll.js: /back costs 2 Hush Coins, refunded if FTB Essentials doesn't teleport the player.
// Run with: node tools/tests/run_all.js back_toll   (or node tools/tests/suites/back_toll.test.js)
const fs = require('fs')
const paths = require('../lib/paths')
const src = fs.readFileSync(paths.server('back_toll.js'), 'utf8')
let fails = 0
const ok = (l, c, e) => { console.log((c ? 'ok   ' : 'FAIL ') + l + (!c && e !== undefined ? '  ' + e : '')); if (!c) fails++ }

// ---------- the mock ----------
let tick = 0, queue = []
const persistent = {}
const players = []
const server = {
  players: { size: () => players.filter(p => p.online).length, get: i => players.filter(p => p.online)[i] },
  scheduleInTicks: (n, fn) => queue.push([tick + n, fn]),
  persistentData: { getString: k => persistent[k] || '', putString: (k, v) => { persistent[k] = v } },
}
function advance(n) {
  for (let i = 0; i < n; i++) {
    tick++
    const due = queue.filter(q => q[0] <= tick); queue = queue.filter(q => q[0] > tick)
    due.forEach(q => q[1]())
  }
}
function player(name, coins, op) {
  const p = {
    name, coins, op: !!op, online: true, msgs: [], x: 0, y: 64, z: 0, dim: 'minecraft:overworld',
    getGameProfile: () => ({ getName: () => name }), getStringUuid: () => 'uuid-' + name,
    getX: () => p.x, getY: () => p.y, getZ: () => p.z,
    get level() { return { dimension: { location: () => p.dim } } },
    tell: t => p.msgs.push(String(t && t.text !== undefined ? t.text : t)),
  }
  players.push(p)
  return p
}
const econLog = []
let economy = {
  countCoins: p => p.coins,
  takeCoins: (p, n) => { if (p.coins < n) return false; p.coins -= n; return true },
  giveCoins: (p, n, why) => { p.coins += n; econLog.push(why) },
  coinText: n => n + ' Hush Coin' + (n == 1 ? '' : 's'),
}
const global = { Economy: economy }
let commandHandler = null, loginHandler = null, commandName = null
const Serializer = { fromJsonLenient: j => JSON.parse(j) }
const logs = []
class Cancel extends Error {}
new Function('ServerEvents', 'PlayerEvents', 'Java', 'console', 'global', src)(
  { command: (name, h) => { commandName = name; commandHandler = h } },
  { loggedIn: h => { loginHandler = h } },
  { loadClass: () => Serializer },
  { info: m => logs.push(m), warn: m => logs.push('WARN ' + m), error: m => logs.push('ERR ' + m) },
  global)
// Runs /back for p. Returns true if the command was let through (not cancelled).
function back(p, source) {
  const src2 = source || { getPlayer: () => p, hasPermission: n => p.op }
  let cancelled = false
  const ev = { server, getParseResults: () => ({ getContext: () => ({ getSource: () => src2 }) }), cancel() { cancelled = true; throw new Cancel() } }
  try { commandHandler(ev) } catch (e) { if (!(e instanceof Cancel)) throw e }
  return !cancelled
}
const last = p => p.msgs[p.msgs.length - 1] || ''

// ---------- checks ----------
ok('it listens for the back command', commandName == 'back' && typeof commandHandler == 'function', commandName)

const ana = player('Ana', 5)
ok('/back with 5 coins: let through, 2 taken', back(ana) && ana.coins == 3, ana.coins)
ok('... and told it was paid', /2 Hush Coins paid for \/back/.test(last(ana)), last(ana))
advance(100)   // FTB Essentials' warmup: the teleport lands at 5 s
ana.x = 500; ana.z = -300
advance(80)
ok('a teleport during the wait: no refund', ana.coins == 3, ana.coins)

const bo = player('Bo', 1)
ok('/back with 1 coin: refused, nothing taken', !back(bo) && bo.coins == 1, bo.coins)
ok('... and told the price', /\/back costs 2 Hush Coins\. You have 1\./.test(last(bo)), last(bo))

const cy = player('Cy', 4)
ok('Cy pays for /back', back(cy) && cy.coins == 2)
ok('a second /back while the first is on its way: refused', !back(cy) && cy.coins == 2 && /still on its way/.test(last(cy)), last(cy))
advance(8 * 20 + 20)
ok('no teleport (cooldown or nothing to go back to): refunded after the wait', cy.coins == 4 && /your 2 Hush Coins are back/.test(last(cy)), cy.coins + ' / ' + last(cy))
ok('... and Cy can pay again afterwards', back(cy) && cy.coins == 2)
// walking about during the wait (warmup broken by moving): still refunded
for (let i = 0; i < 16; i++) { cy.x += 2; advance(10) }
advance(40)
ok('walking during the wait: refunded', cy.coins == 4, cy.coins)

const dee = player('Dee', 2)
ok('Dee pays the last 2 coins', back(dee) && dee.coins == 0)
advance(100)
dee.dim = 'minecraft:the_nether'
advance(20)
ok('a change of dimension counts as the teleport: no refund', dee.coins == 0, dee.coins)

const op = player('Op', 0, true)
ok('an operator: free', back(op) && op.coins == 0 && op.msgs.length == 0)
ok('the console: let through', back(null, { getPlayer: () => null, hasPermission: () => true }))

const eve = player('Eve', 3)
ok('Eve pays', back(eve) && eve.coins == 1)
advance(30)
eve.online = false
advance(200)
ok('logging out while waiting: nothing given yet (Eve is offline)', eve.coins == 1)
ok('... the refund is saved', JSON.parse(persistent.back_toll || '{}').owed['uuid-Eve'] == 2, persistent.back_toll)
eve.online = true
loginHandler({ player: eve, server })
ok('... and given back at the next login', eve.coins == 3 && /logged out before your \/back happened/.test(last(eve)), eve.coins + ' / ' + last(eve))
ok('... only once', !JSON.parse(persistent.back_toll).owed['uuid-Eve'])

global.Economy = undefined
const fin = player('Fin', 0)
ok('without the black market: /back is free', back(fin) && fin.coins == 0)
ok('... with one warning in the log', logs.filter(l => /not installed/.test(l)).length == 1)
back(fin)
ok('... only warned once', logs.filter(l => /not installed/.test(l)).length == 1)

ok('refunds are logged as such', econLog.every(w => /back refund/.test(w)) && econLog.length == 3, econLog.join(', '))
ok('no errors logged', !logs.some(l => /^ERR/.test(l)), logs.filter(l => /^ERR/.test(l)).join('; '))

console.log(fails ? fails + ' FAILED' : 'ALL PASSED')
