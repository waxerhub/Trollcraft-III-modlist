// deepdelver_maul.js (+ startup_scripts/deepdelver_maul_hooks.js): Goruk's levelling Maul. Grit from ore and kills,
// levels (netherite pickaxe, then a Tinkers' Vein Hammer at X), Prospector, White-hot, the Grudge Ledger, Earthshaker,
// open for grabs, commands.
// Run with: node tools/tests/run_all.js deepdelver_maul   (or node tools/tests/suites/deepdelver_maul.test.js)
const fs = require('fs')
const paths = require('../lib/paths')
const snbt = require('../lib/snbt.js')
const src = fs.readFileSync(paths.server('deepdelver_maul.js'), 'utf8')
const hookSrc = fs.readFileSync(paths.server('deepdelver_maul.js').replace(/server_scripts[\\/]deepdelver_maul\.js$/, 'startup_scripts/deepdelver_maul_hooks.js'), 'utf8')
let fails = 0
const ok = (l, c, e) => { console.log((c ? 'ok   ' : 'FAIL ') + l + (!c && e !== undefined ? '  ' + e : '')); if (!c) fails++ }

// ---------- the mock ----------
const OW = 'minecraft:overworld'
let T = 1700000000000
const realNow = Date.now
Date.now = () => T
let tick = 0, queue = []
const persistent = {}, players = [], entities = [], cmds = [], logs = []
const jlist = arr => ({ size: () => arr.length, get: i => arr[i] })
const blocks = {}
const ore = id => /_ore$|^minecraft:ancient_debris$/.test(id)
const level = {
  dimension: { location: () => OW },
  getBlock: (x, y, z) => { const id = blocks[x + ',' + y + ',' + z] || 'minecraft:air'; return { id, x, y, z, level, hasTag: t => t == 'forge:ores' && ore(id) } },
}
const server = {
  get players() { return jlist(players.filter(p => p.online)) },
  get entities() { return jlist(entities.filter(e => e.alive).concat(players.filter(p => p.online))) },
  scheduleInTicks: (n, fn) => queue.push([tick + n, fn]),
  persistentData: { getString: k => persistent[k] || '', putString: (k, v) => { persistent[k] = v } },
  runCommandSilent: c => {
    cmds.push(c)
    const m = c.match(/^damage (\S+) ([\d.]+) \S+ by (\S+)$/)
    if (m) {
      const e = entities.concat(players).find(x => x.uuid == m[1]), by = players.find(p => p.name == m[3])
      if (e) { e.damageTaken = (e.damageTaken || 0) + Number(m[2]); hit(e, by, Number(m[2])) }
    }
    return 1
  },
}
function advance(n) { for (let i = 0; i < n; i++) { tick++; T += 50; const due = queue.filter(q => q[0] <= tick); queue = queue.filter(q => q[0] > tick); due.forEach(q => q[1]()) } }
function tag(o) {
  return { contains: k => o != null && Object.prototype.hasOwnProperty.call(o, k), getCompound: k => tag(o && o[k] || {}),
    getInt: k => (o && o[k] != null ? parseInt(String(o[k]), 10) : 0), getBoolean: () => false }
}
function stack(id, count, nbtStr) {
  const parsed = nbtStr ? snbt(nbtStr) : null
  return { id, count: count == null ? 1 : count, nbtStr, parsed,
    get nbt() { return parsed ? tag(parsed) : null }, isEmpty() { return this.count <= 0 },
    getDamageValue() { return parsed && parsed.Damage != null ? parseInt(parsed.Damage, 10) : 0 } }
}
const EMPTY = stack('minecraft:air', 0)
const Item = { of: (id, n, nbt) => stack(id, n, nbt) }
function player(name, opts) {
  opts = opts || {}
  const slots = []
  const p = { name, uuid: 'u-' + name.toLowerCase(), online: true, op: !!opts.op, x: opts.x || 0, y: 64, z: opts.z || 0, msgs: [], onGround: true, fall: 0,
    hurtTime: 10, alive: true, selected: 0, level, server, damageTaken: 0, creative: false,
    isPlayer: () => true, isLiving: () => true, isAlive: () => p.alive, getGameProfile: () => ({ getName: () => name }), getStringUuid: () => p.uuid,
    getEncodeId: () => 'minecraft:player', getX: () => p.x, getY: () => p.y, getZ: () => p.z,
    hasPermissions: () => p.op, tell: c => p.msgs.push(Array.isArray(c) ? c.map(x => (typeof x == 'string' ? x : x.text)).join('') : String(c)),
    onGround: () => p.onGround, isInWater: () => false, isPassenger: () => false, get fallDistance() { return p.fall },
    getDeltaMovement: () => ({ y: 0 }),
    inventory: { getItem: i => slots[i] || EMPTY, setItem: (i, s) => { slots[i] = s } },
    get mainHandItem() { return slots[p.selected] || EMPTY },
    give: s => { for (let i = 0; i < 36; i++) if (!slots[i] || slots[i].isEmpty()) { slots[i] = s; return } }, slots }
  players.push(p)
  return p
}
function mob(type, x, z, hostile) {
  const e = { type, uuid: 'e-' + Math.random().toString(36).slice(2), x, y: 64, z, alive: true, level, damageTaken: 0,
    isPlayer: () => false, getEncodeId: () => type, getX: () => e.x, getY: () => e.y, getZ: () => e.z, isAlive: () => e.alive, isLiving: () => true,
    getStringUuid: () => e.uuid, getType: () => ({ getCategory: () => (hostile ? 'MONSTER' : 'CREATURE') }) }
  entities.push(e)
  return e
}
const handlers = {}
let cmdTree = null
const global = {}
const node = n => ({ n, ch: [], req: null, f: null, then(c) { this.ch.push(c); return this }, requires(f) { this.req = f; return this }, executes(f) { this.f = f; return this } })
const StringArg = { word: () => 'word', getString: (ctx, k) => ctx.args[k] }
const Serializer = { fromJsonLenient: j => JSON.parse(j) }
new Function('EntityEvents', 'BlockEvents', 'PlayerEvents', 'ServerEvents', 'Java', 'Utils', 'Item', 'Text', 'console', 'global', src)(
  { death: h => { handlers.death = h }, hurt: h => { handlers.hurt = h } },
  { broken: h => { handlers.broken = h } },
  { tick: h => { handlers.tick = h } },
  { loaded: h => { handlers.loaded = h }, commandRegistry: h => h({ commands: { literal: node, argument: n => node(n) }, arguments: { INTEGER: { create: () => 'int', getResult: (ctx, k) => ctx.args[k] } }, register: t => { cmdTree = t } }) },
  { loadClass: n => (/StringArgumentType/.test(n) ? StringArg : Serializer) },
  { server }, Item, { of: s => s },
  { info: m => logs.push(m), warn: m => logs.push('WARN ' + m), error: m => logs.push('ERR ' + m) },
  global)
handlers.loaded({ server })
// The startup hook, against the same `global`.
const forge = {}
new Function('ForgeEvents', 'global', 'console', hookSrc)({ onEvent: (name, h) => { forge[name.split('.').pop()] = h } }, global,
  { info: m => logs.push(m), error: m => logs.push('ERR ' + m) })
function run(args, as) {
  const replies = []
  const ctx = { args: {}, source: { server, hasPermission: () => !!(as && as.op), getPlayer: () => as || null, sendSystemMessage: c => replies.push(c.map(x => (typeof x == 'string' ? x : x.text)).join('')) } }
  let n = cmdTree
  for (const a of args) {
    let next = n.ch.find(c => c.n == a)
    if (!next) { next = n.ch.find(c => ['player', 'grit'].indexOf(c.n) >= 0); ctx.args[next.n] = next.n == 'player' ? a : Number(a) }
    if (next.req && !next.req(ctx.source)) return ['DENIED']
    n = next
  }
  n.f(ctx)
  return replies
}
function kill(victim, killer) { victim.alive = false; handlers.death({ entity: victim, server, source: { getActual: () => killer, getMsgId: () => 'player' } }) }
function hit(victim, p, dmg) { handlers.hurt({ entity: victim, server, source: { getActual: () => p, getImmediate: () => p, getMsgId: () => 'player' }, damage: dmg }) }
function mine(p, x, y, z) { handlers.broken({ player: p, block: level.getBlock(x, y, z), server }) }
const maulOf = p => p.slots.find(s => s && s.parsed && s.parsed.trollcraft && s.parsed.trollcraft.maul)
const ench = s => Object.fromEntries((s.parsed.Enchantments || []).map(e => [e.id.replace('minecraft:', ''), parseInt(e.lvl, 10)]))
const lore = s => s.parsed.display.Lore.map(l => JSON.parse(l).text)
const gritOf = p => parseInt(maulOf(p).parsed.trollcraft.maul.grit, 10)
const attr = (s, n) => (s.parsed.AttributeModifiers || []).find(m => m.AttributeName == 'minecraft:generic.' + n)
const said = (p, re) => p.msgs.some(m => re.test(m))
const M = () => global.DeepdelverMaul

// ---------- forging ----------
const admin = player('Admin', { op: true }), goruk = player('Goruk'), ana = player('Ana', { x: 2 }), bob = player('Bob', { x: 50 })
ok('/maul before it exists', /has not been forged yet/.test(run([], goruk)[0]))
ok('/maul give is op-only', run(['give', 'Goruk'], goruk)[0] == 'DENIED')
ok('/maul give Goruk forges it at Level I', /Forged The Deepdelver's Maul for Goruk at Level I/.test(run(['give', 'Goruk'], admin)[0]) && !!maulOf(goruk))
const m1 = maulOf(goruk)
ok('... a netherite pickaxe with Efficiency I and Unbreaking I', m1.id == 'minecraft:netherite_pickaxe' && JSON.stringify(ench(m1)) == JSON.stringify({ efficiency: 1, unbreaking: 1 }))
ok('... 6 damage (+5) at a pickaxe\'s 1.2 speed (-2.8)', attr(m1, 'attack_damage').Amount == '5d' && attr(m1, 'attack_speed').Amount == '-2.8d')
ok('... the lore: level, Grit, damage, and its Level I abilities with their values', lore(m1).some(l => /^Level I · Grit 0 \/ 100$/.test(l)) && lore(m1).includes('6 damage') &&
  lore(m1).some(l => /Prospector: .*within 2 blocks/.test(l)) && lore(m1).some(l => /White-hot: hits ignore 10% of armour/.test(l)) &&
  lore(m1).some(l => /Grudge Ledger: .*\+10% damage/.test(l)) && lore(m1).some(l => /✧ Earthshaker at Level V/.test(l)), lore(m1).join(' | '))
ok('... marked with its serial and Grit', m1.parsed.trollcraft.maul.serial == '1' && m1.parsed.trollcraft.maul.grit == '0' && M().isRealMaul(m1))
ok('a second /maul give is refused (only one exists)', /already exists \(held by Goruk\)/.test(run(['give', 'Ana'], admin)[0]) && !maulOf(ana))

// ---------- mining: Grit and Prospector ----------
goruk.selected = goruk.slots.indexOf(m1)
blocks['0,10,0'] = 'minecraft:coal_ore'
blocks['1,10,0'] = 'minecraft:iron_ore'; blocks['0,12,1'] = 'minecraft:diamond_ore'; blocks['3,10,0'] = 'minecraft:gold_ore'; blocks['0,9,0'] = 'minecraft:stone'
let c0 = cmds.length
mine(goruk, 0, 10, 0)
ok('mining coal ore: +1 Grit', gritOf(goruk) == 1)
const glows = cmds.slice(c0).filter(c => /summon minecraft:block_display/.test(c))
ok('Prospector: the iron and diamond ore within 2 blocks glow (not the gold 3 away, not the stone)', glows.length == 2 &&
  glows.some(c => / 1 10 0 \{block_state:\{Name:"minecraft:iron_ore"\},Glowing:1b,glow_color_override:16766720,Tags:\["maul_glow","maul_glow_1"\]/.test(c)) &&
  glows.some(c => /diamond_ore/.test(c)) && !glows.some(c => /gold_ore|stone"/.test(c)), glows.join(' | '))
c0 = cmds.length
blocks['0,10,0'] = 'minecraft:coal_ore'
mine(goruk, 0, 10, 0)
ok('... not again within 2 seconds (but the Grit still counts)', !cmds.slice(c0).some(c => /block_display/.test(c)) && gritOf(goruk) == 2)
advance(100)
ok('... and the glow goes after 5 seconds', cmds.includes('kill @e[type=minecraft:block_display,tag=maul_glow_1]'))
blocks['0,10,0'] = 'minecraft:diamond_ore'
mine(goruk, 0, 10, 0)
ok('a diamond is worth 8', gritOf(goruk) == 10)
mine(goruk, 0, 9, 0)
ok('stone is worth nothing', gritOf(goruk) == 10)

// ---------- levelling ----------
ok('/maul setgrit is op-only', run(['setgrit', '99'], goruk)[0] == 'DENIED')
goruk.op = true; run(['setgrit', '99'], goruk); goruk.op = false
maulOf(goruk).parsed.Damage = '50'
blocks['0,10,0'] = 'minecraft:coal_ore'
mine(goruk, 0, 10, 0)
const m2 = maulOf(goruk)
ok('100 Grit: Level II, Unbreaking II, 7 damage, its wear kept', gritOf(goruk) == 100 && ench(m2).unbreaking == 2 && attr(m2, 'attack_damage').Amount == '6d' && m2.parsed.Damage == '50')
ok('... announced to everyone', said(ana, /The Deepdelver's Maul has reached Level II in the hands of Goruk/))
ok('... and White-hot and the ledger grow (14%, +12%)', lore(m2).some(l => /ignore 14% of armour/.test(l)) && lore(m2).some(l => /\+12% damage/.test(l)), lore(m2).join(' | '))

// ---------- kills ----------
let g = gritOf(goruk)
kill(mob('minecraft:zombie', 5, 5, true), goruk)
ok('a zombie: +3', gritOf(goruk) == g + 3)
kill(mob('minecraft:cow', 5, 5, false), goruk)
ok('a cow: +1', gritOf(goruk) == g + 4)
kill(mob('twilightforest:naga', 5, 5, true), goruk)
ok('the Naga: +100', gritOf(goruk) == g + 104)

// ---------- the Grudge Ledger ----------
hit(goruk, ana, 4)
ok('Ana hits Goruk: nothing until the hit has landed (a tick)', !M().onLedger('u-ana'))
advance(1)
ok('... then Ana is on the ledger, and only Goruk is told', M().onLedger('u-ana') && said(goruk, /Ana is written in the ledger/) && !said(ana, /written in the ledger/))
const n0 = goruk.msgs.length
hit(goruk, ana, 4); advance(1)
ok('... another hit renews it without telling him again', M().onLedger('u-ana') && !goruk.msgs.slice(n0).some(m => /written/.test(m)))
goruk.hurtTime = 0
hit(goruk, bob, 4); advance(1)
goruk.hurtTime = 10
ok('a hit that didn\'t land (sanctuary, protection) puts nobody on it', !M().onLedger('u-bob'))
ok('/maul grudges: Goruk reads it', run(['grudges'], goruk).some(r => /Ana: wronged Goruk/.test(r)))
ok('... Ana can\'t', /Only the Maul's holder can read its ledger/.test(run(['grudges'], ana)[0]))
// the damage hook (startup script) with White-hot and the grudge bonus
const lv2 = 2, wh = M().whiteHot(lv2), gb = M().grudgeBonus(lv2)
const src2 = { getActual: () => goruk, getImmediate: () => goruk }
let set = null
forge.LivingHurtEvent({ getEntity: () => ana, getSource: () => src2, getAmount: () => 10 })
forge.LivingDamageEvent({ getEntity: () => ana, getSource: () => src2, getAmount: () => 6, setAmount: n => { set = n } })
ok('the hook: a 10 hit cut to 6 by armour on Ana (on the ledger) becomes (6 + 4 x 14%) x 1.12', set != null && Math.abs(set - (6 + 4 * wh / 100) * (1 + gb / 100)) < 1e-9, set)
set = null
const zed = mob('minecraft:zombie', 1, 1, true)
forge.LivingHurtEvent({ getEntity: () => zed, getSource: () => src2, getAmount: () => 10 })
forge.LivingDamageEvent({ getEntity: () => zed, getSource: () => src2, getAmount: () => 6, setAmount: n => { set = n } })
ok('... a zombie (no grudge): just White-hot, 6 + 4 x 14%', Math.abs(set - (6 + 4 * wh / 100)) < 1e-9, set)
set = null
const srcAna = { getActual: () => ana, getImmediate: () => ana }
forge.LivingHurtEvent({ getEntity: () => zed, getSource: () => srcAna, getAmount: () => 10 })
forge.LivingDamageEvent({ getEntity: () => zed, getSource: () => srcAna, getAmount: () => 6, setAmount: n => { set = n } })
ok('... someone without the Maul: left alone', set == null)
ok('White-hot reaches 50% and the grudge bonus +30% at Level X', M().whiteHot(10) == 50 && M().grudgeBonus(10) == 30 && M().whiteHot(1) == 10 && M().grudgeBonus(1) == 10)
g = gritOf(goruk)
ana.alive = true
kill(ana, goruk)
ok('Goruk kills Ana with it: the grudge is settled, for everyone to hear', !M().onLedger('u-ana') && said(bob, /A grudge is settled\. Ana has paid Goruk in full/))
ok('... and it pays 25 + 40 Grit', gritOf(goruk) == g + 65)
hit(goruk, bob, 4); advance(1)
ok('/maul forgive Bob strikes him off', M().onLedger('u-bob') && /Bob is struck from the ledger/.test(run(['forgive', 'Bob'], goruk)[0]) && !M().onLedger('u-bob'))
hit(goruk, bob, 4); advance(1)
T += 8 * 86400000
ok('a grudge lapses after 7 days', !M().onLedger('u-bob'))

// ---------- Earthshaker ----------
goruk.op = true; run(['setgrit', '1000'], goruk); goruk.op = false
ok('Level V: Earthshaker learned', said(ana, /reached Level V .* It has learned Earthshaker/) && lore(maulOf(goruk)).some(l => /Earthshaker: falling hits slam the ground \(3 blocks\)/.test(l)))
const target = mob('minecraft:zombie', 1, 0, true), near = mob('minecraft:skeleton', 0, 2, true), far = mob('minecraft:creeper', 6, 0, true)
bob.x = 2; bob.z = 1
admin.x = 100; zed.x = 100                    // out of the way: only the skeleton and Bob are within 3 blocks
c0 = cmds.length
hit(target, goruk, 9)
ok('an ordinary hit: no Earthshaker', !cmds.slice(c0).some(c => /slowness|block minecraft:stone/.test(c)))
goruk.onGround = false; goruk.fall = 1.5
c0 = cmds.length
hit(target, goruk, 9)
const sh = cmds.slice(c0)
ok('a falling hit: everything within 3 blocks is hit for 40% (3.6) and slowed; the target only slowed', sh.includes('damage ' + near.uuid + ' 3.60 minecraft:player_attack by Goruk') &&
  sh.includes('damage u-bob 3.60 minecraft:player_attack by Goruk') && !sh.some(c => c.indexOf('damage ' + target.uuid) == 0) && !sh.some(c => c.indexOf(far.uuid) >= 0) &&
  sh.includes('effect give ' + target.uuid + ' minecraft:slowness 2 1 true') && sh.includes('effect give ' + near.uuid + ' minecraft:slowness 2 1 true'), sh.join(' | '))
ok('... with stone bursting out and a boom', sh.some(c => /particle minecraft:block minecraft:stone .* 3 0.2 3 /.test(c)) && sh.some(c => /entity\.generic\.explode/.test(c)))
ok('... and its own damage doesn\'t set off another (one slam)', sh.filter(c => /^damage /.test(c)).length == 2)
c0 = cmds.length
hit(target, goruk, 9)
ok('... not again within 6 seconds', !cmds.slice(c0).some(c => /slowness/.test(c)))
goruk.onGround = true; goruk.fall = 0
T += 7000
handlers.tick({ player: goruk })
goruk.onGround = false; goruk.fall = 1; handlers.tick({ player: goruk }); goruk.onGround = true; goruk.fall = 0
T += 300
c0 = cmds.length
hit(target, goruk, 9)
ok('Better Combat: a hit 300 ms after the fall still slams', cmds.slice(c0).some(c => /slowness/.test(c)))
c0 = cmds.length
ok('an arrow from Goruk doesn\'t slam', (() => { T += 7000; goruk.onGround = false; goruk.fall = 1; handlers.hurt({ entity: target, server, source: { getActual: () => goruk, getImmediate: () => ({ getStringUuid: () => 'arrow' }) } }); goruk.onGround = true; goruk.fall = 0; return !cmds.slice(c0).some(c => /slowness/.test(c)) })())

// ---------- Level X: the Vein Hammer ----------
goruk.op = true; run(['setgrit', '6500'], goruk); goruk.op = false
const mx = maulOf(goruk)
ok('Level X: it becomes a Tinkers\' Vein Hammer (Manyullyn, Hepatizon, Cobalt, Manyullyn)', mx.id == 'tconstruct:vein_hammer' &&
  JSON.stringify(mx.parsed.tic_materials) == JSON.stringify(['tconstruct:manyullyn', 'tconstruct:hepatizon', 'tconstruct:cobalt', 'tconstruct:manyullyn']))
ok('... with Haste V and Luck III (its Efficiency and Fortune), and no vanilla enchantments', JSON.stringify(mx.parsed.tic_upgrades) == JSON.stringify([{ name: 'tconstruct:haste', level: '5' }, { name: 'tconstruct:luck', level: '3' }]) && !mx.parsed.Enchantments)
ok('... 14 damage (+13) at the hammer\'s 0.92 (-3.08: what Tinkers works out for its materials)', attr(mx, 'attack_damage').Amount == '13d' && attr(mx, 'attack_speed').Amount == '-3.08d')
ok('... announced as reforged, with Prospector at 5 blocks and Earthshaker at 4', said(ana, /Level X .* The pick is reforged: it is a Vein Hammer now/) &&
  lore(mx).some(l => /within 5 blocks/.test(l)) && lore(mx).some(l => /\(4 blocks\)/.test(l)) && lore(mx).some(l => /ignore 50%/.test(l)))
blocks['0,10,0'] = 'minecraft:coal_ore'
T += 3000
mine(goruk, 0, 10, 0)
ok('at Level X, more Grit doesn\'t rebuild the hammer (whatever Tinkers did to it stays), but it\'s counted', maulOf(goruk) === mx && M().state().grit == 6501)

// ---------- open for grabs ----------
const slotX = goruk.slots.indexOf(mx)
goruk.slots[slotX] = EMPTY
advance(200)
ok('Goruk loses it: after two scans it\'s announced loose', said(ana, /The Deepdelver's Maul is loose\. Goruk no longer has it\. Open for grabs\./))
ana.slots[0] = mx
advance(100)
ok('Ana picks it up: announced', said(bob, /Ana has claimed The Deepdelver's Maul \(Level X\)! Goruk has lost it\./) && M().state().holderName == 'Ana')
global.Purge = { kitActive: () => true }
ana.slots[0] = EMPTY
advance(300)
ok('in a kit Purge (it\'s in her vault) it isn\'t called loose', !said(bob, /Ana no longer has it/))
delete global.Purge
ana.slots[0] = mx

// ---------- reforging ----------
ok('/maul give Bob force: a new one; the old one is an ordinary tool now', /Forged .* for Bob at Level I/.test(run(['give', 'Bob', 'force'], admin)[0]) && !M().isRealMaul(mx) && M().state().serial == 2)
ana.selected = 0
blocks['0,10,0'] = 'minecraft:coal_ore'
const before = M().state().grit
mine(ana, 0, 10, 0)
ok('... mining with the old one earns nothing', M().state().grit == before && ana.slots[0] === mx)
ok('preview(6500) shows a Level X hammer that is never the real Maul', M().preview(6500).id == 'tconstruct:vein_hammer' && !M().isRealMaul(M().preview(6500)))
ok('/maul stats (op)', /Serial 2, held by Bob\. Kills \d+ .*ore \d+, grudges settled 1/.test(run(['stats'], admin)[0]))
ok('no errors logged', !logs.some(l => /^ERR/.test(l)), logs.filter(l => /^ERR/.test(l)).join(' | '))

Date.now = realNow
console.log(fails ? fails + ' FAILED' : 'ALL PASSED')
