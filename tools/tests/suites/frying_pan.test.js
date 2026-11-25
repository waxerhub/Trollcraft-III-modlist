// frying_pan.js: the Frying Pan (a Tinkers' Melting Pan): /pan give, /pan bless, BONK, SIZZLE and DING.
// Run with: node tools/tests/run_all.js frying_pan   (or node tools/tests/suites/frying_pan.test.js)
const fs = require('fs')
const paths = require('../lib/paths')
const snbt = require('../lib/snbt.js')
const src = fs.readFileSync(paths.server('frying_pan.js'), 'utf8')
let fails = 0
const ok = (l, c, e) => { console.log((c ? 'ok   ' : 'FAIL ') + l + (!c && e !== undefined ? '  ' + e : '')); if (!c) fails++ }

// ---------- the mock ----------
let T = 1700000000000
const realNow = Date.now
Date.now = () => T
const logs = [], cmds = []
let tick = 0, queue = []
const server = { runCommandSilent: c => { cmds.push(c); return 1 }, scheduleInTicks: (n, f) => queue.push({ at: tick + n, f }) }
function advance(n) { for (let i = 0; i < n; i++) { tick++; T += 50; const due = queue.filter(q => q.at <= tick); queue = queue.filter(q => q.at > tick); due.forEach(q => q.f()) } }
const tag = o => ({ _o: o, contains: k => o != null && Object.prototype.hasOwnProperty.call(o, k), getCompound: k => tag(o && typeof o[k] == 'object' ? o[k] : {}) })
function stack(id, obj) {
  const s = { id, count: 1, obj: obj || null, isEmpty: () => id == 'minecraft:air', get nbt() { return s.obj ? tag(s.obj) : null } }
  s.withNBT = t => stack(id, merge(JSON.parse(JSON.stringify(s.obj || {})), t._o))
  return s
}
function merge(a, b) {
  Object.keys(b).forEach(k => { if (a[k] && typeof a[k] == 'object' && !Array.isArray(a[k]) && typeof b[k] == 'object' && !Array.isArray(b[k])) merge(a[k], b[k]); else a[k] = b[k] })
  return a
}
const Item = { of: (id, count, s) => stack(id, s ? snbt(s) : null) }
const NBT = { toTagCompound: s => tag(snbt(s)) }
function entity(type, name, x, z, opts) {
  const e = Object.assign({ type, name, x, y: 64, z, given: [], hand: stack('minecraft:air'), op: false, motion: null, hurtMarked: false, fire: 0,
    hurtTime: 10, alive: true, ground: true, fallDistance: 0, vy: 0, water: false }, opts || {})
  e.isPlayer = () => type == 'minecraft:player'
  e.getStringUuid = () => 'u-' + name.toLowerCase()
  e.getGameProfile = () => ({ getName: () => name })
  e.getX = () => e.x; e.getY = () => e.y; e.getZ = () => e.z
  e.give = s => e.given.push(s)
  e.setMainHandItem = s => { e.hand = s }
  e.setDeltaMovement = (a, b, c) => { e.motion = [a, b, c] }
  e.setSecondsOnFire = n => { e.fire = n }
  e.isAlive = () => e.alive
  e.onGround = () => e.ground
  e.getDeltaMovement = () => ({ y: e.vy })
  e.isInWater = () => e.water
  e.isPassenger = () => false
  Object.defineProperty(e, 'mainHandItem', { get: () => e.hand })
  return e
}
const admin = entity('minecraft:player', 'Admin', 0, 0, { op: true }), ana = entity('minecraft:player', 'Ana', 0, 0)
const zombie = entity('minecraft:zombie', 'Zombie', 3, 4), bob = entity('minecraft:player', 'Bob', -6, 0)
let H = {}, tree = null
const node = (n, kind) => ({ n, kind, ch: [], req: null, f: null, then(c) { this.ch.push(c); return this }, requires(f) { this.req = f; return this }, executes(f) { this.f = f; return this } })
const global = {}
new Function('ServerEvents', 'EntityEvents', 'PlayerEvents', 'Item', 'NBT', 'Java', 'Text', 'Utils', 'console', 'global', src)(
  { commandRegistry: h => h({ commands: { literal: n => node(n, 'lit'), argument: n => node(n, 'arg') },
      arguments: { PLAYER: { create: () => 'player', getResult: (ctx, n) => ctx.args[n] } }, register: t => { tree = t } }) },
  { hurt: h => { H.hurt = h } },
  { tick: h => { H.tick = h } },
  Item, NBT,
  { loadClass: c => ({ fromJsonLenient: j => ({ json: j }) }) },
  { of: t => ({ json: JSON.stringify(t) }) },
  { server },
  { info: m => logs.push(m), warn: m => logs.push('WARN ' + m), error: m => logs.push('ERR ' + m) },
  global)
const players = [admin, ana, bob]
function run(line, as) {
  const parts = line.split(' ').slice(1), replies = [], args = {}
  const source = { hasPermission: () => !as || as.op, getPlayer: () => as || null, sendSystemMessage: c => replies.push(JSON.parse(c.json).map(x => (typeof x == 'string' ? x : x.text)).join('')) }
  if (tree.req && !tree.req(source)) return ['DENIED']
  let n = tree
  for (const a of parts) {
    const next = n.ch.find(c => c.kind == 'lit' && c.n == a) || n.ch.find(c => c.kind == 'arg')
    if (!next) return ['NO SUCH COMMAND']
    if (next.kind == 'arg') args[next.n] = players.find(p => p.name == a)
    n = next
  }
  n.f({ source, args })
  return replies
}
// A melee hit (the direct entity is the attacker), or an arrow (it isn't).
const hit = (attacker, victim, arrow) => H.hurt({ entity: victim, server, source: { getActual: () => attacker, getImmediate: () => (arrow ? { getStringUuid: () => 'arrow-1' } : attacker) } })
const reset = v => { v.motion = null; v.fire = 0; v.hurtTime = 10; v.alive = true }
const len = m => Math.sqrt(m[0] * m[0] + m[2] * m[2])
const nameOf = s => { try { return JSON.parse(s.obj.display.Name).text } catch (e) { return '' } }

// ---------- /pan give ----------
ok('/pan is op-only', run('/pan give Ana', ana)[0] == 'DENIED' && !ana.given.length)
ok('/pan give Ana: she gets it', /Gave The Frying Pan to Ana/.test(run('/pan give Ana', admin)[0]) && ana.given.length == 1)
const pan = ana.given[0], o = pan.obj
ok('... a Tinkers\' Melting Pan of Seared Stone (the pan) and Wood (the handle)', pan.id == 'tconstruct:melting_pan' && JSON.stringify(o.tic_materials) == JSON.stringify(['tconstruct:seared_stone', 'tconstruct:wood']))
const mod = n => (o.AttributeModifiers || []).find(m => m.AttributeName == 'minecraft:generic.' + n)
ok('... 12 damage (+11 on the player\'s 1) at 1 attack a second (4 - 3), main hand', mod('attack_damage').Amount == '11d' && mod('attack_speed').Amount == '-3d' && mod('attack_damage').Slot == 'mainhand')
ok('... named The Frying Pan, with the lore, and marked', nameOf(pan) == 'The Frying Pan' && o.display.Lore.some(l => /BONK/.test(JSON.parse(l).text)) && o.trollcraft.frying_pan == '1b' && global.FryingPan.isPan(pan))

// ---------- BONK and SIZZLE ----------
ana.hand = pan
hit(ana, zombie)
ok('nothing happens until the next tick (the hit has to land first)', zombie.motion == null)
advance(1)
ok('BONK: the zombie is launched straight away from Ana (3,4 from her), at 1.6, lifted 0.45', !!zombie.motion && Math.abs(len(zombie.motion) - 1.6) < 1e-9 &&
  Math.abs(zombie.motion[0] / zombie.motion[2] - 3 / 4) < 1e-9 && zombie.motion[0] > 0 && zombie.motion[1] == 0.45 && zombie.hurtMarked, JSON.stringify(zombie.motion))
ok('... SIZZLE: set alight for 3 seconds', zombie.fire == 3)
ok('... with a clang and sparks where it was hit', cmds.some(c => /^playsound minecraft:block\.anvil\.land player @a 3 65 4 /.test(c)) && cmds.some(c => /^particle minecraft:crit 3 65 4 /.test(c)))
ok('... and no DING on an ordinary hit', !cmds.some(c => /bell|nausea/.test(c)))
reset(zombie)
hit(ana, bob); advance(1)
ok('a player is launched the same way (westward from Ana)', !!bob.motion && bob.motion[0] < -1.5 && bob.hurtMarked && bob.fire == 3)

// ---------- DING ----------
reset(zombie)
ana.ground = false; ana.fallDistance = 1.2
const c0 = cmds.length
hit(ana, zombie); advance(1)
ok('DING: a falling hit launches harder (2.6, lifted 0.7)', Math.abs(len(zombie.motion) - 2.6) < 1e-9 && zombie.motion[1] == 0.7, JSON.stringify(zombie.motion))
ok('... rings the bell, and leaves it dizzy (nausea 5 s, slowness II 3 s)', cmds.slice(c0).some(c => /^playsound minecraft:block\.bell\.use/.test(c)) &&
  cmds.slice(c0).includes('effect give u-zombie minecraft:nausea 5 0 true') && cmds.slice(c0).includes('effect give u-zombie minecraft:slowness 3 1 true'))
// Better Combat: the hit arrives just after landing.
reset(zombie)
H.tick({ player: ana })                       // she's falling, holding the Pan: noted
ana.ground = true; ana.fallDistance = 0
T += 300
hit(ana, zombie); advance(1)
ok('Better Combat: a hit 300 ms after the fall still DINGs', Math.abs(len(zombie.motion) - 2.6) < 1e-9)
reset(zombie)
T += 1000
hit(ana, zombie); advance(1)
ok('... but not one a second later', Math.abs(len(zombie.motion) - 1.6) < 1e-9)
reset(zombie)
ana.water = true; ana.ground = false; ana.fallDistance = 2
hit(ana, zombie); advance(1)
ok('no DING in water (vanilla doesn\'t crit there either)', Math.abs(len(zombie.motion) - 1.6) < 1e-9)
ana.water = false; ana.ground = true; ana.fallDistance = 0

// ---------- when it does nothing ----------
reset(zombie)
hit(ana, zombie, true); advance(1)
ok('an arrow Ana shoots launches nothing (melee only)', zombie.motion == null && zombie.fire == 0)
reset(zombie)
zombie.hurtTime = 0
hit(ana, zombie); advance(1)
ok('a hit that didn\'t hurt (cancelled: sanctuary, protection) launches nothing', zombie.motion == null && zombie.fire == 0)
reset(zombie)
zombie.alive = false
hit(ana, zombie); advance(1)
ok('... nor a hit that killed it', zombie.motion == null)
reset(zombie)
ana.hand = Item.of('tconstruct:melting_pan', 1, '{tic_materials:["tconstruct:seared_stone","tconstruct:wood"]}')
hit(ana, zombie); advance(1)
ok('an ordinary Melting Pan does nothing special', zombie.motion == null)
reset(zombie)
ana.hand = pan
hit(zombie, ana); advance(1)
ok('a zombie hitting Ana isn\'t launched by her Pan (only the attacker\'s Pan counts)', ana.motion == null)

// ---------- /pan bless ----------
admin.hand = stack('minecraft:air')
ok('/pan bless with an empty hand: told to hold the tool', /Hold the tool/.test(run('/pan bless', admin)[0]))
admin.hand = Item.of('tconstruct:melting_pan', 1, '{tic_materials:["tconstruct:seared_stone","tconstruct:wood"],tic_modifiers:[{name:"tconstruct:reinforced",level:1}]}')
ok('/pan bless makes the held tool the Pan, keeping its modifiers', /is now The Frying Pan/.test(run('/pan bless', admin)[0]) && global.FryingPan.isPan(admin.hand) &&
  admin.hand.obj.tic_modifiers[0].name == 'tconstruct:reinforced' && nameOf(admin.hand) == 'The Frying Pan')
ok('the API makes one too', global.FryingPan.isPan(global.FryingPan.make()))
ok('no errors or warnings logged', !logs.some(l => /^(ERR|WARN)/.test(l)), logs.join(' | '))

Date.now = realNow
console.log(fails ? fails + ' FAILED' : 'ALL PASSED')
