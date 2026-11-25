// syndicate_slayer.js: the Syndicate Slayer (a Tinkers' Mattock with 17 damage that heals on kills): /slayer give,
// /slayer bless and the heal.
// Run with: node tools/tests/run_all.js syndicate_slayer   (or node tools/tests/suites/syndicate_slayer.test.js)
const fs = require('fs')
const paths = require('../lib/paths')
const snbt = require('../lib/snbt.js')
const src = fs.readFileSync(paths.server('syndicate_slayer.js'), 'utf8')
let fails = 0
const ok = (l, c, e) => { console.log((c ? 'ok   ' : 'FAIL ') + l + (!c && e !== undefined ? '  ' + e : '')); if (!c) fails++ }

// ---------- the mock ----------
const logs = []
// A CompoundTag stand-in over a parsed SNBT object.
const tag = o => ({ _o: o, contains: k => o != null && Object.prototype.hasOwnProperty.call(o, k), getCompound: k => tag(o && typeof o[k] == 'object' ? o[k] : {}) })
// An ItemStack stand-in. withNBT merges like KubeJS's (a copy; compounds merge, everything else is replaced).
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
function entity(type, name, opts) {
  const e = Object.assign({ type, name, healed: 0, given: [], msgs: [], hand: stack('minecraft:air'), op: false }, opts || {})
  e.isPlayer = () => type == 'minecraft:player'
  e.getStringUuid = () => 'u-' + name.toLowerCase()
  e.getGameProfile = () => ({ getName: () => name })
  e.heal = n => { e.healed += n }
  e.give = s => e.given.push(s)
  e.setMainHandItem = s => { e.hand = s }
  Object.defineProperty(e, 'mainHandItem', { get: () => e.hand })
  return e
}
const admin = entity('minecraft:player', 'Admin', { op: true }), ana = entity('minecraft:player', 'Ana'), bob = entity('minecraft:player', 'Bob')
const zombie = entity('minecraft:zombie', 'Zombie')
let H = {}, tree = null
const node = (n, kind) => ({ n, kind, ch: [], req: null, f: null, then(c) { this.ch.push(c); return this }, requires(f) { this.req = f; return this }, executes(f) { this.f = f; return this } })
const global = {}
new Function('ServerEvents', 'EntityEvents', 'Item', 'NBT', 'Java', 'Text', 'console', 'global', src)(
  { commandRegistry: h => h({ commands: { literal: n => node(n, 'lit'), argument: n => node(n, 'arg') },
      arguments: { PLAYER: { create: () => 'player', getResult: (ctx, n) => ctx.args[n] } }, register: t => { tree = t } }) },
  { death: h => { H.death = h } },
  Item, NBT,
  { loadClass: c => ({ fromJsonLenient: j => ({ json: j }) }) },
  { of: t => ({ json: JSON.stringify(t) }) },
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
const kill = (killer, victim, msgId) => H.death({ entity: victim, source: { getActual: () => killer || null, getMsgId: () => msgId || 'player' } })
const nameOf = s => { try { return JSON.parse(s.obj.display.Name).text } catch (e) { return '' } }

// ---------- /slayer give ----------
ok('/slayer is op-only', run('/slayer give Ana', ana)[0] == 'DENIED' && !ana.given.length)
ok('/slayer give Ana: she gets it', /Gave The Syndicate Slayer to Ana/.test(run('/slayer give Ana', admin)[0]) && ana.given.length == 1)
const sl = ana.given[0], o = sl.obj
ok('... a Tinkers\' Mattock of Nucleum (axe head), Valyrium (handle) and Tritonite (adze head)', sl.id == 'tconstruct:mattock' &&
  JSON.stringify(o.tic_materials) == JSON.stringify(['taiga:nucleum', 'taiga:valyrium', 'taiga:tritonite']), JSON.stringify(o.tic_materials))
const mods = o.AttributeModifiers || []
const mod = n => mods.find(m => m.AttributeName == 'minecraft:generic.' + n)
ok('... 17 damage: +16 attack damage on the player\'s own 1, in the main hand', !!mod('attack_damage') && mod('attack_damage').Amount == '16d' && mod('attack_damage').Operation == '0' && mod('attack_damage').Slot == 'mainhand')
ok('... and a Mattock\'s attack speed, 0.9 (4 - 3.1)', !!mod('attack_speed') && mod('attack_speed').Amount == '-3.1d' && mod('attack_speed').Slot == 'mainhand')
ok('... the two modifiers have different, fixed UUIDs', mods.length == 2 && mods[0].UUID.join(',') != mods[1].UUID.join(',') && mods[0].UUID.length == 4)
ok('... named The Syndicate Slayer, with its damage and healing in the lore', nameOf(sl) == 'The Syndicate Slayer' &&
  o.display.Lore.some(l => /17 damage/.test(JSON.parse(l).text)) && o.display.Lore.some(l => /Every kill heals its wielder/.test(JSON.parse(l).text)))
ok('... and marked as the Slayer', !!o.trollcraft && o.trollcraft.slayer == '1b' && global.SyndicateSlayer.isSlayer(sl))
ok('the API makes one too', global.SyndicateSlayer.make().id == 'tconstruct:mattock' && global.SyndicateSlayer.isSlayer(global.SyndicateSlayer.make()))

// ---------- healing on kills ----------
ana.hand = sl
kill(ana, zombie)
ok('a mob killed with it in the main hand heals 4 (two hearts)', ana.healed == 4)
kill(ana, bob)
ok('a player killed heals 10 (five hearts)', ana.healed == 14)
ana.hand = Item.of('tconstruct:mattock', 1, '{tic_materials:["minecraft:iron","minecraft:wood","minecraft:iron"]}')
kill(ana, zombie)
ok('an ordinary Mattock doesn\'t heal', ana.healed == 14)
ana.hand = stack('minecraft:air')
kill(ana, zombie)
ok('... nor an empty hand', ana.healed == 14)
ana.hand = sl
kill(zombie, ana)
kill(null, zombie, 'fall')
ok('a zombie\'s kill, or a fall, heals nobody (and doesn\'t fail)', ana.healed == 14 && !logs.some(l => /^(ERR|WARN)/.test(l)))
kill(ana, ana, 'player')
ok('killing yourself doesn\'t heal', ana.healed == 14)

// ---------- /slayer bless ----------
admin.hand = stack('minecraft:air')
ok('/slayer bless with an empty hand: told to hold the tool', /Hold the tool/.test(run('/slayer bless', admin)[0]))
ok('... from the console: told to run it in game', /Run it in game/.test(run('/slayer bless', null)[0]))
admin.hand = Item.of('tconstruct:mattock', 1, '{tic_materials:["taiga:nucleum","taiga:valyrium","taiga:tritonite"],tic_modifiers:[{name:"tconstruct:necrotic",level:2}],display:{Name:\'{"text":"Old"}\'}}')
const before = admin.hand
ok('/slayer bless makes the held tool the Slayer', /is now The Syndicate Slayer: 17 damage, and kills heal you/.test(run('/slayer bless', admin)[0]) && global.SyndicateSlayer.isSlayer(admin.hand))
ok('... keeping its own materials and modifiers', JSON.stringify(admin.hand.obj.tic_materials) == JSON.stringify(before.obj.tic_materials) && admin.hand.obj.tic_modifiers[0].name == 'tconstruct:necrotic')
ok('... renamed, with the damage set', nameOf(admin.hand) == 'The Syndicate Slayer' && admin.hand.obj.AttributeModifiers.some(m => m.Amount == '16d'))
ok('... and it heals now', (() => { const h = admin.healed; kill(admin, zombie); return admin.healed == h + 4 })())
ok('no errors logged', !logs.some(l => /^ERR/.test(l)), logs.join(' | '))

console.log(fails ? fails + ' FAILED' : 'ALL PASSED')
