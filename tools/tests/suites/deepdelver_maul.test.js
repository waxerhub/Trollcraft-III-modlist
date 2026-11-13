// deepdelver_maul.js (+ startup_scripts/deepdelver_maul_hooks.js): Goruk's levelling Maul. Grit from ore and kills,
// levels (netherite pickaxe, then a Tinkers' Vein Hammer at X), Prospector (markers, on/off), Forge-touched, Deepborn,
// Iron Blood, White-hot, the Grudge Ledger, Earthshaker,
// open for grabs, commands.
// Run with: node tools/tests/run_all.js deepdelver_maul   (or node tools/tests/suites/deepdelver_maul.test.js)
const fs = require('fs')
const paths = require('../lib/paths')
const snbt = require('../lib/snbt.js')
const realSrc = fs.readFileSync(paths.server('deepdelver_maul.js'), 'utf8')
// The real finder is Goruk_Lohaus; this suite's Goruk stands in for him.
const FINDER_LINE = "const FINDER = 'Goruk_Lohaus'"
if (realSrc.indexOf(FINDER_LINE) < 0) throw new Error('FINDER is not Goruk_Lohaus in deepdelver_maul.js')
const src = realSrc.replace(FINDER_LINE, "const FINDER = 'Goruk'")
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
// Loot containers: key -> { loot (its loot table until it's opened), slots }.
const chests = {}
let skyLight = 15                             // the sky light everywhere (Deepborn: 7 or less is away from daylight)
let darken = 0                                // the night's darkening, which KubeJS's block.skyLight takes off (11 at night)
// Smelting recipes: input -> [result, count, experience]. recipeLookups: how often the recipe manager was asked.
const SMELT = { 'minecraft:raw_iron': ['minecraft:iron_ingot', 1, 0.7], 'minecraft:ancient_debris': ['minecraft:netherite_scrap', 1, 2] }
let recipeLookups = 0
const level = {
  dimension: { location: () => OW },
  registryAccess: () => ({}),
  getBrightness: (layer, p) => (layer == 'sky' && p instanceof BlockPosMock ? skyLight : NaN),
  getSkyDarken: () => darken,
  getBlock: (x, y, z) => {
    const k = x + ',' + y + ',' + z, c = chests[k]
    if (c) {
      return { id: 'minecraft:chest', x, y, z, level, hasTag: () => false, entityData: tag(c.loot ? { LootTable: c.loot } : {}),
        entity: { getContainerSize: () => 27, getItem: i => c.slots[i] || EMPTY, setItem: (i, s) => { c.slots[i] = s }, setChanged: () => { } } }
    }
    const id = blocks[k] || 'minecraft:air'
    return { id, x, y, z, level, skyLight: skyLight - darken, hasTag: t => t == 'forge:ores' && ore(id) }
  },
}
const server = {
  get players() { return jlist(players.filter(p => p.online)) },
  get entities() { return jlist(entities.filter(e => e.alive).concat(players.filter(p => p.online))) },
  scheduleInTicks: (n, fn) => queue.push([tick + n, fn]),
  persistentData: { getString: k => persistent[k] || '', putString: (k, v) => { persistent[k] = v } },
  overworld: () => level,
  getRecipeManager: () => ({ getRecipeFor: (type, box) => {
    recipeLookups++
    const r = type == 'smelting' && SMELT[box.items[0].id]
    return { isPresent: () => !!r, get: () => ({ getResultItem: () => stack(r[0], r[1]), getExperience: () => r[2] }) }
  } }),
  runCommandSilent: c => {
    cmds.push(c)
    const m = c.match(/^damage (\S+) ([\d.]+) \S+ by (\S+)$/)
    if (m) {
      const e = entities.concat(players).find(x => x.uuid == m[1]), by = players.find(p => p.name == m[3])
      if (e) { e.damageTaken = (e.damageTaken || 0) + Number(m[2]); hit(e, by, Number(m[2])) }
    }
    const give = c.match(/^effect give (\S+) minecraft:(\S+) (\d+) (\d+) true$/), clear = c.match(/^effect clear (\S+) minecraft:(\S+)$/)
    const who = players.find(p => p.uuid == ((give || clear || [])[1]))
    if (who && give) who.fx[give[2]] = { dur: Number(give[3]) * 20, amp: Number(give[4]) }
    if (who && clear) delete who.fx[clear[2]]
    return 1
  },
}
function advance(n) { for (let i = 0; i < n; i++) { tick++; T += 50; const due = queue.filter(q => q[0] <= tick); queue = queue.filter(q => q[0] > tick); due.forEach(q => q[1]()) } }
function tag(o) {
  return { contains: k => o != null && Object.prototype.hasOwnProperty.call(o, k), getCompound: k => tag(o && o[k] || {}),
    getInt: k => (o && o[k] != null ? parseInt(String(o[k]), 10) : 0), getBoolean: () => false, getString: k => (o && o[k] != null ? String(o[k]) : '') }
}
function stack(id, count, nbtStr) {
  const parsed = nbtStr ? snbt(nbtStr) : null
  return { id, count: count == null ? 1 : count, nbtStr, parsed,
    copy() { return stack(id, this.count, nbtStr) },
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
    sneak: false, isShiftKeyDown: () => p.sneak,
    absorption: 0, getAbsorptionAmount: () => p.absorption, setAbsorptionAmount: n => { p.absorption = n },
    xp: 0, giveExperiencePoints: n => { p.xp += n },
    // effects by id: { dur (ticks), amp }, as /effect gives them
    fx: {}, getActiveEffects: () => {
      const all = Object.keys(p.fx).map(k => ({ getEffect: () => ({ getDescriptionId: () => 'effect.minecraft.' + k }), getDuration: () => p.fx[k].dur }))
      return { iterator: () => { let i = 0; return { hasNext: () => i < all.length, next: () => all[i++] } } }
    },
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
// Event handlers: several scripts' worth can listen to one event (the Maul has two for BlockEvents.rightClicked).
const handlers = {}
const on = name => h => { (handlers[name] = handlers[name] || []).push(h) }
const fire = (name, ev) => (handlers[name] || []).forEach(h => h(ev))
let cmdTree = null
const global = {}
const node = n => ({ n, ch: [], req: null, f: null, then(c) { this.ch.push(c); return this }, requires(f) { this.req = f; return this }, executes(f) { this.f = f; return this } })
const StringArg = { word: () => 'word', getString: (ctx, k) => ctx.args[k] }
const Serializer = { fromJsonLenient: j => JSON.parse(j) }
const RecipeTypeMock = { SMELTING: 'smelting' }
function BlockPosMock(x, y, z) { this.x = x; this.y = y; this.z = z }
function SimpleContainerMock() { this.items = [] }
SimpleContainerMock.prototype.setItem = function (i, s) { this.items[i] = s }
new Function('EntityEvents', 'BlockEvents', 'PlayerEvents', 'ServerEvents', 'ItemEvents', 'Java', 'Utils', 'Item', 'Text', 'console', 'global', src)(
  { death: on('death'), hurt: on('hurt'), spawned: on('spawned') },
  { broken: on('broken'), rightClicked: on('rightClicked') },
  { tick: on('tick') },
  { loaded: on('loaded'), commandRegistry: h => h({ commands: { literal: node, argument: n => node(n) }, arguments: { INTEGER: { create: () => 'int', getResult: (ctx, k) => ctx.args[k] } }, register: t => { cmdTree = t } }) },
  { rightClicked: on('itemClicked') },
  { loadClass: n => (/StringArgumentType/.test(n) ? StringArg : /RecipeType/.test(n) ? RecipeTypeMock : /SimpleContainer/.test(n) ? SimpleContainerMock :
    /LightLayer/.test(n) ? { SKY: 'sky' } : /BlockPos/.test(n) ? BlockPosMock : Serializer) },
  { server }, Item, { of: s => s },
  { info: m => logs.push(m), warn: m => logs.push('WARN ' + m), error: m => logs.push('ERR ' + m) },
  global)
fire('loaded', { server })
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
function kill(victim, killer) { victim.alive = false; fire('death', { entity: victim, server, source: { getActual: () => killer, getMsgId: () => 'player' } }) }
function hit(victim, p, dmg) { fire('hurt', { entity: victim, server, source: { getActual: () => p, getImmediate: () => p, getMsgId: () => 'player' }, damage: dmg }) }
// Mining a block, as the game does: the break event; then (unless something cancels it, like a protected area) the
// block goes and its drops ([[id, count], ...]) appear inside it, or in the block at `spawnAt`, in the same tick; then
// a tick passes. The block is put back afterwards, so a test can mine the same ore again.
function mine(p, x, y, z, opts) {
  opts = opts || {}
  const k = x + ',' + y + ',' + z, was = blocks[k], s = opts.spawnAt || [x, y, z]
  fire('broken', { player: p, block: level.getBlock(x, y, z), server })
  if (!opts.cancelled) blocks[k] = 'minecraft:air'
  const items = opts.cancelled ? [] : (opts.drops || []).map(d => dropItem(s[0] + 0.5, s[1] + 0.3, s[2] + 0.5, d[0], d[1]))
  advance(1)
  if (was) blocks[k] = was
  else delete blocks[k]
  return items
}
// An item entity appearing (EntityEvents.spawned), as a block's drops do.
function dropItem(x, y, z, id, n) {
  let st = stack(id, n)
  const e = { uuid: 'i-' + Math.random().toString(36).slice(2), level, getEncodeId: () => 'minecraft:item', isPlayer: () => false,
    getX: () => x, getY: () => y, getZ: () => z, getStringUuid: () => e.uuid, getItem: () => st, setItem: s => { st = s } }
  fire('spawned', { entity: e, server })
  return e
}
function mineDrops(p, x, y, z, drops, spawnAt) { return mine(p, x, y, z, { drops, spawnAt }) }
const click = (p, hand, onBlock) => (onBlock ? fire('rightClicked', { player: p, hand, block: level.getBlock(9, 9, 9), server }) : fire('itemClicked', { player: p, hand, server }))
const count = (p, re) => p.msgs.filter(m => re.test(m)).length
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

// ---------- finding it in a loot chest (only Goruk, 10%, while none exists) ----------
const realRandom = Math.random
let roll = 0.5
Math.random = () => roll
// Right-click a container, and (unless `shut`) let it open: its loot table goes and its loot goes in.
function openChest(p, x, z, opts) {
  opts = opts || {}
  const k = x + ',20,' + z
  if (!chests[k]) chests[k] = { loot: opts.player ? '' : 'minecraft:chests/simple_dungeon', slots: [] }
  fire('rightClicked', { player: p, block: level.getBlock(x, 20, z), server })
  if (!opts.shut && chests[k].loot) { chests[k].loot = ''; chests[k].slots[0] = stack('minecraft:bread', 3) }
  advance(2)
  return chests[k]
}
roll = 0.01
let ch = openChest(ana, 0, 0)
ok('Ana opens a fresh loot chest, even with all the luck in the world: no Maul (only Goruk can find it)', !ch.slots.some(s => s && s.parsed) && M().state().serial == 0)
ch = openChest(goruk, 1, 0, { player: true })
ok('Goruk opens a chest someone placed (no loot table): no Maul', !ch.slots.some(s => s && s.parsed) && M().state().serial == 0)
ch = openChest(goruk, 2, 0, { shut: true })
ok('... nor when a loot chest doesn\'t open', !ch.slots.some(s => s && s.parsed) && M().state().serial == 0)
roll = 0.5
ch = openChest(goruk, 3, 0)
ok('Goruk opens a fresh loot chest and misses the 10%: no Maul', !ch.slots.some(s => s && s.parsed) && M().state().serial == 0)
roll = 0.05
ch = openChest(goruk, 4, 0)
const found = ch.slots.find(s => s && s.parsed && s.parsed.trollcraft)
ok('Goruk opens one and the 10% comes up: the Maul is in it at Level I, after the chest\'s own loot', !!found && ch.slots[0].id == 'minecraft:bread' && ch.slots[1] === found &&
  found.id == 'minecraft:netherite_pickaxe' && M().isRealMaul(found) && M().state().serial == 1)
ok('... only Goruk gets a hint, and nobody holds it yet', said(goruk, /something old and heavy, waiting for you/) && !said(ana, /old and heavy/) && M().state().holder == '')
roll = 0.01
ch = openChest(goruk, 5, 0)
ok('once it exists, no other chest holds one', !ch.slots.some(s => s && s.parsed) && M().state().serial == 1)
Math.random = realRandom
goruk.slots[5] = found; chests['4,20,0'].slots[1] = EMPTY
advance(100)
ok('Goruk takes it: everyone hears he has claimed it', said(ana, /Goruk has claimed The Deepdelver's Maul \(Level I\)!/) && M().state().holderName == 'Goruk')
Math.random = () => 0
ch = openChest(goruk, 6, 0)
ok('after he has collected it, no chest he opens ever spawns another', !ch.slots.some(s => s && s.parsed) && M().state().serial == 1)
goruk.slots[5] = EMPTY                        // it falls in lava: lost
advance(200)
ch = openChest(goruk, 7, 0)
ok('... not even once it\'s lost (it existed: that\'s enough)', !ch.slots.some(s => s && s.parsed) && M().state().serial == 1)
Math.random = realRandom
ok('the real script\'s finder is Goruk_Lohaus', realSrc.indexOf(FINDER_LINE) >= 0)

ok('/maul give is op-only', run(['give', 'Goruk'], goruk)[0] == 'DENIED')
ok('/maul give Goruk force forges a new one at Level I', /Forged The Deepdelver's Maul for Goruk at Level I/.test(run(['give', 'Goruk', 'force'], admin)[0]) && !!maulOf(goruk))
const m1 = maulOf(goruk)
ok('... a netherite pickaxe with Efficiency I and Unbreaking I', m1.id == 'minecraft:netherite_pickaxe' && JSON.stringify(ench(m1)) == JSON.stringify({ efficiency: 1, unbreaking: 1 }))
ok('... 8 damage (+7) at a pickaxe\'s 1.2 speed (-2.8)', attr(m1, 'attack_damage').Amount == '7d' && attr(m1, 'attack_speed').Amount == '-2.8d')
ok('... the lore: level, Grit, damage, and its Level I abilities with their values', lore(m1).some(l => /^Level I · Grit 0 \/ 100$/.test(l)) && lore(m1).includes('8 damage') &&
  lore(m1).some(l => /Prospector: .*within 2 blocks \(sneak \+ right-click: on\/off\)/.test(l)) && lore(m1).some(l => /Forge-touched: ore it mines comes out smelted/.test(l)) &&
  lore(m1).some(l => /Deepborn: away from daylight, Night Vision and Haste I$/.test(l)) && lore(m1).some(l => /Iron Blood: kills give 2 absorption hearts \(up to 8\)/.test(l)) &&
  lore(m1).some(l => /White-hot: hits ignore 10% of armour/.test(l)) &&
  lore(m1).some(l => /Grudge Ledger: .*\+10% damage/.test(l)) && lore(m1).some(l => /✧ Earthshaker at Level V/.test(l)), lore(m1).join(' | '))
ok('... marked with its serial and Grit', m1.parsed.trollcraft.maul.serial == '2' && m1.parsed.trollcraft.maul.grit == '0' && M().isRealMaul(m1))
ok('a second /maul give is refused (only one exists)', /already exists \(held by Goruk\)/.test(run(['give', 'Ana'], admin)[0]) && !maulOf(ana))

// ---------- mining: Grit and Prospector ----------
goruk.selected = goruk.slots.indexOf(m1)
blocks['0,10,0'] = 'minecraft:coal_ore'
blocks['1,10,0'] = 'minecraft:iron_ore'; blocks['0,12,1'] = 'minecraft:diamond_ore'; blocks['3,10,0'] = 'minecraft:gold_ore'; blocks['0,9,0'] = 'minecraft:stone'
let c0 = cmds.length
mine(goruk, 0, 10, 0)
ok('mining coal ore: +1 Grit', gritOf(goruk) == 1)
const glows = cmds.slice(c0).filter(c => /summon minecraft:block_display/.test(c))
ok('Prospector: the iron and diamond ore within 2 blocks are marked (not the gold 3 away, not the stone)', glows.length == 2 &&
  glows.some(c => / 1\.00 10\.00 0\.00 \{block_state:\{Name:"minecraft:iron_ore"\},Glowing:1b,glow_color_override:16766720,brightness:\{sky:15,block:15\},Tags:\["maul_glow","maul_m1"\],/.test(c)) &&
  glows.some(c => /diamond_ore/.test(c)) && !glows.some(c => /gold_ore|stone"/.test(c)), glows.join(' | '))
ok('... by small markers in the middle of each ore (0.3 of a block), not a full-size copy over it', glows.every(c => /translation:\[0\.35f,0\.35f,0\.35f\],scale:\[0\.3f,0\.3f,0\.3f\]\}\}$/.test(c)), glows[0])
ok('... summoned at the block\'s corner in decimals (/summon centres whole numbers, which put markers half a block off)', glows.every(c => /summon minecraft:block_display -?\d+\.00 -?\d+\.00 -?\d+\.00 \{/.test(c)))
c0 = cmds.length
blocks['0,10,0'] = 'minecraft:coal_ore'
mine(goruk, 0, 10, 0)
ok('... not again within 2 seconds (but the Grit still counts)', !cmds.slice(c0).some(c => /block_display/.test(c)) && gritOf(goruk) == 2)
advance(100)
ok('... and the markers go after 5 seconds', cmds.includes('kill @e[type=minecraft:block_display,tag=maul_m1]') && cmds.includes('kill @e[type=minecraft:block_display,tag=maul_m2]') && M().markers() == 0)
blocks['0,10,0'] = 'minecraft:diamond_ore'
mine(goruk, 0, 10, 0)
ok('a diamond is worth 8', gritOf(goruk) == 10)
mine(goruk, 0, 9, 0)
ok('stone is worth nothing', gritOf(goruk) == 10)
// The diamond mined just now marked the iron (maul_m3) and the diamond ore (maul_m4) again.
c0 = cmds.length
mine(ana, 1, 10, 0)
ok('a marker goes the moment its ore is mined, by anyone', cmds.slice(c0).includes('kill @e[type=minecraft:block_display,tag=maul_m3]') && M().markers() == 1)
blocks['0,12,1'] = 'minecraft:air'
c0 = cmds.length
advance(4)
ok('... or within a few ticks once its ore is gone some other way (a vein-mining hammer, an explosion)', cmds.slice(c0).includes('kill @e[type=minecraft:block_display,tag=maul_m4]') && M().markers() == 0)
blocks['0,12,1'] = 'minecraft:diamond_ore'

// ---------- Prospector off and on: sneak + right-click ----------
T += 3000
blocks['0,10,0'] = 'minecraft:coal_ore'
mine(goruk, 0, 10, 0)
const marked = M().markers()
goruk.sneak = true
c0 = cmds.length
click(goruk, 'MAIN_HAND', true); click(goruk, 'MAIN_HAND')
ok('Goruk sneaks and right-clicks with it: Prospector off, switched once (at a block, the block and the air both fire)', marked == 2 && !M().prospectorOn('u-goruk') &&
  count(goruk, /Prospector off\. Sneak and right-click again to turn it on\./) == 1)
ok('... its markers go at once, with a chime where he stands', cmds.slice(c0).filter(c => /^kill @e\[type=minecraft:block_display,tag=maul_m/.test(c)).length == 2 && M().markers() == 0 &&
  cmds.slice(c0).some(c => /playsound minecraft:block\.note_block\.chime player @a 0\.00 64\.00 0\.00 0\.6 0\.7$/.test(c)))
ok('... it\'s saved', M().state().prospectOff['u-goruk'] == 1)
T += 3000
c0 = cmds.length
mine(goruk, 0, 10, 0)
ok('... mining ore marks nothing now (the Grit still counts)', !cmds.slice(c0).some(c => /block_display/.test(c)) && gritOf(goruk) == 12)
T += 1000
click(goruk, 'MAIN_HAND'); T += 200; click(goruk, 'MAIN_HAND'); T += 200; click(goruk, 'MAIN_HAND')
ok('again: back on, and holding the button down doesn\'t flip it back and forth', M().prospectorOn('u-goruk') && count(goruk, /Prospector on/) == 1 && count(goruk, /Prospector off/) == 1)
T += 1000
click(goruk, 'OFF_HAND')
goruk.sneak = false; T += 1000; click(goruk, 'MAIN_HAND')
ana.sneak = true; T += 1000; click(ana, 'MAIN_HAND'); ana.sneak = false
ok('the off hand, not sneaking, or no Maul: nothing switches', M().prospectorOn('u-goruk') && count(goruk, /Prospector/) == 2 && count(ana, /Prospector/) == 0)
T += 3000
blocks['0,10,0'] = 'minecraft:diamond_ore'
let gc = gritOf(goruk)
const ores0 = M().state().stats.ores
c0 = cmds.length
mine(goruk, 0, 10, 0, { cancelled: true }); mine(goruk, 0, 10, 0, { cancelled: true })
ok('a break something cancels (a protected area) earns no Grit and marks nothing: no farming an ore he can\'t break', gritOf(goruk) == gc && !cmds.slice(c0).some(c => /block_display/.test(c)) && M().state().stats.ores == ores0)
mine(goruk, 0, 10, 0)
ok('... when it does break, it counts', gritOf(goruk) == gc + 8)

// ---------- Forge-touched ----------
blocks['4,10,4'] = 'minecraft:iron_ore'
let xp0 = goruk.xp
c0 = cmds.length
let drops = mineDrops(goruk, 4, 10, 4, [['minecraft:raw_iron', 3]])
ok('Forge-touched: iron ore mined with it drops iron ingots, all 3 that Fortune gave', drops[0].getItem().id == 'minecraft:iron_ingot' && drops[0].getItem().count == 3, drops[0].getItem().id)
ok('... with sparks and a hiss, and the furnace\'s experience (3 x 0.7)', cmds.slice(c0).some(c => /particle minecraft:lava 4\.50 10\.50 4\.50 /.test(c)) &&
  cmds.slice(c0).some(c => /playsound minecraft:block\.fire\.extinguish block @a 4\.50 10\.50 4\.50/.test(c)) && goruk.xp - xp0 >= 2 && goruk.xp - xp0 <= 3, goruk.xp - xp0)
blocks['5,10,4'] = 'minecraft:coal_ore'
c0 = cmds.length
drops = mineDrops(goruk, 5, 10, 4, [['minecraft:coal', 1]])
ok('... coal (no smelting recipe) drops as usual, with no sparks', drops[0].getItem().id == 'minecraft:coal' && !cmds.slice(c0).some(c => /particle minecraft:lava/.test(c)))
blocks['6,10,4'] = 'minecraft:iron_ore'
drops = mineDrops(goruk, 6, 10, 4, [['minecraft:raw_iron', 1]], [20, 10, 4])
ok('... an item that appears elsewhere that tick is left alone', drops[0].getItem().id == 'minecraft:raw_iron')
const lookups = recipeLookups
blocks['7,10,4'] = 'minecraft:iron_ore'
drops = mineDrops(goruk, 7, 10, 4, [['minecraft:raw_iron', 1]])
ok('... each item\'s recipe is looked up once', drops[0].getItem().id == 'minecraft:iron_ingot' && recipeLookups == lookups)
blocks['8,10,4'] = 'minecraft:iron_ore'
ana.slots[0] = stack('minecraft:netherite_pickaxe', 1); ana.selected = 0
drops = mineDrops(ana, 8, 10, 4, [['minecraft:raw_iron', 2]])
ana.slots[0] = EMPTY
ok('... with an ordinary pickaxe, raw iron stays raw', drops[0].getItem().id == 'minecraft:raw_iron')
ok('ancient debris comes out as netherite scrap (the API\'s lookup)', M().smelting(stack('minecraft:ancient_debris', 1)).id == 'minecraft:netherite_scrap')
drops = dropItem(4.5, 10.3, 4.5, 'minecraft:raw_iron', 1)
ok('... and once the ore has broken, nothing more is smelted there', drops.getItem().id == 'minecraft:raw_iron')

// ---------- Deepborn ----------
skyLight = 0
T += 1000
fire('tick', { player: goruk, server })
ok('Deepborn: holding it away from daylight, Night Vision and Haste I for 12 seconds, refreshed each second', !!goruk.fx.night_vision && goruk.fx.night_vision.dur == 240 &&
  !!goruk.fx.haste && goruk.fx.haste.amp == 0)
c0 = cmds.length
T += 500
fire('tick', { player: goruk, server })
ok('... not more than once a second', !cmds.slice(c0).some(c => /^effect/.test(c)))
goruk.selected = 30                           // an empty slot: he's placing a torch
T += 1000; fire('tick', { player: goruk, server }); T += 1000; fire('tick', { player: goruk, server })
ok('... switching away for a moment (a torch) keeps the effects', !!goruk.fx.night_vision && !!goruk.fx.haste)
goruk.selected = goruk.slots.indexOf(maulOf(goruk))
T += 1000; fire('tick', { player: goruk, server })
goruk.fx.night_vision = { dur: 3600, amp: 0 }  // he drinks a potion of Night Vision
skyLight = 15
c0 = cmds.length
T += 1000; fire('tick', { player: goruk, server }); T += 1000; fire('tick', { player: goruk, server })
ok('under the sky: nothing for 2 seconds', !cmds.slice(c0).some(c => /^effect clear/.test(c)) && !!goruk.fx.haste)
T += 1000; fire('tick', { player: goruk, server })
ok('... then the Haste it gave is taken away, but not his 3-minute potion', !goruk.fx.haste && !!goruk.fx.night_vision && goruk.fx.night_vision.dur == 3600)
skyLight = 7
T += 1000; fire('tick', { player: goruk, server })
ok('sky light 7 (deep in a mine entrance) counts as away from daylight', !!goruk.fx.haste)
skyLight = 15; darken = 11                    // open ground at night: KubeJS's block.skyLight reads 4 here
c0 = cmds.length
T += 1000; fire('tick', { player: goruk, server })
ok('open ground at night is not away from daylight (the sky light is read whole, not darkened)', !cmds.slice(c0).some(c => /^effect give/.test(c)))
darken = 0
delete goruk.fx.haste; delete goruk.fx.night_vision
T += 5000; fire('tick', { player: goruk, server })

// ---------- levelling ----------
ok('/maul setgrit is op-only', run(['setgrit', '99'], goruk)[0] == 'DENIED')
goruk.op = true; run(['setgrit', '99'], goruk); goruk.op = false
maulOf(goruk).parsed.Damage = '50'
blocks['0,10,0'] = 'minecraft:coal_ore'
mine(goruk, 0, 10, 0)
const m2 = maulOf(goruk)
ok('100 Grit: Level II, Unbreaking II, 9 damage, its wear kept', gritOf(goruk) == 100 && ench(m2).unbreaking == 2 && attr(m2, 'attack_damage').Amount == '8d' && m2.parsed.Damage == '50')
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

// ---------- Iron Blood ----------
ok('Iron Blood: the zombie and the Naga gave 2 absorption hearts each, the cow nothing', goruk.absorption == 8, goruk.absorption)
ok('... with the clank of iron where he stands', cmds.some(c => /playsound minecraft:item\.armor\.equip_iron player @a /.test(c)))
kill(mob('minecraft:zombie', 5, 5, true), goruk); kill(mob('minecraft:zombie', 5, 5, true), goruk); kill(mob('minecraft:zombie', 5, 5, true), goruk)
ok('... up to 8 hearts, no more', goruk.absorption == 16)
goruk.absorption = 10                         // a skeleton's arrows took some
advance(60 * 20 + 2)
ok('... a minute after the last kill, what it gave fades', goruk.absorption == 0)
goruk.absorption = 14                         // a golden apple and more
kill(mob('minecraft:zombie', 5, 5, true), goruk)
ok('... absorption from anything else counts towards the 8 hearts', goruk.absorption == 16)
advance(60 * 20 + 2)
ok('... and only what it gave fades', goruk.absorption == 14)
goruk.absorption = 0
g = gritOf(goruk)

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
ok('a falling hit: everything within 3 blocks is hit for 40% (4.8 of Level V\'s 12) and slowed; the target only slowed', sh.includes('damage ' + near.uuid + ' 4.80 minecraft:player_attack by Goruk') &&
  sh.includes('damage u-bob 4.80 minecraft:player_attack by Goruk') && !sh.some(c => c.indexOf('damage ' + target.uuid) == 0) && !sh.some(c => c.indexOf(far.uuid) >= 0) &&
  sh.includes('effect give ' + target.uuid + ' minecraft:slowness 2 1 true') && sh.includes('effect give ' + near.uuid + ' minecraft:slowness 2 1 true'), sh.join(' | '))
ok('... with stone bursting out and a boom', sh.some(c => /particle minecraft:block minecraft:stone .* 3 0.2 3 /.test(c)) && sh.some(c => /entity\.generic\.explode/.test(c)))
ok('... and its own damage doesn\'t set off another (one slam)', sh.filter(c => /^damage /.test(c)).length == 2)
c0 = cmds.length
hit(target, goruk, 9)
ok('... not again within 6 seconds', !cmds.slice(c0).some(c => /slowness/.test(c)))
goruk.onGround = true; goruk.fall = 0
T += 7000
fire('tick', { player: goruk })
goruk.onGround = false; goruk.fall = 1; fire('tick', { player: goruk }); goruk.onGround = true; goruk.fall = 0
T += 300
c0 = cmds.length
hit(target, goruk, 9)
ok('Better Combat: a hit 300 ms after the fall still slams', cmds.slice(c0).some(c => /slowness/.test(c)))
c0 = cmds.length
ok('an arrow from Goruk doesn\'t slam', (() => { T += 7000; goruk.onGround = false; goruk.fall = 1; fire('hurt', { entity: target, server, source: { getActual: () => goruk, getImmediate: () => ({ getStringUuid: () => 'arrow' }) } }); goruk.onGround = true; goruk.fall = 0; return !cmds.slice(c0).some(c => /slowness/.test(c)) })())

// ---------- Level X: the Vein Hammer ----------
goruk.op = true; run(['setgrit', '6500'], goruk); goruk.op = false
const mx = maulOf(goruk)
ok('Level X: it becomes a Tinkers\' Vein Hammer (Manyullyn, Hepatizon, Cobalt, Manyullyn)', mx.id == 'tconstruct:vein_hammer' &&
  JSON.stringify(mx.parsed.tic_materials) == JSON.stringify(['tconstruct:manyullyn', 'tconstruct:hepatizon', 'tconstruct:cobalt', 'tconstruct:manyullyn']))
ok('... with Haste V and Luck III (its Efficiency and Fortune), and no vanilla enchantments', JSON.stringify(mx.parsed.tic_upgrades) == JSON.stringify([{ name: 'tconstruct:haste', level: '5' }, { name: 'tconstruct:luck', level: '3' }]) && !mx.parsed.Enchantments)
ok('... 18 damage (+17) at the hammer\'s 0.92 (-3.08: what Tinkers works out for its materials)', attr(mx, 'attack_damage').Amount == '17d' && attr(mx, 'attack_speed').Amount == '-3.08d')
ok('... announced as reforged, with Prospector at 5 blocks and Earthshaker at 4', said(ana, /Level X .* The pick is reforged: it is a Vein Hammer now/) &&
  lore(mx).some(l => /within 5 blocks/.test(l)) && lore(mx).some(l => /\(4 blocks\)/.test(l)) && lore(mx).some(l => /ignore 50%/.test(l)))
ok('... and Deepborn gives Haste II (from Level VI)', lore(mx).some(l => /Night Vision and Haste II$/.test(l)) &&
  (() => { skyLight = 0; T += 2000; fire('tick', { player: goruk, server }); skyLight = 15; return goruk.fx.haste && goruk.fx.haste.amp == 1 })())
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
ok('/maul give Bob force: a new one; the old one is an ordinary tool now', /Forged .* for Bob at Level I/.test(run(['give', 'Bob', 'force'], admin)[0]) && !M().isRealMaul(mx) && M().state().serial == 3)
ana.selected = 0
blocks['0,10,0'] = 'minecraft:coal_ore'
const before = M().state().grit
mine(ana, 0, 10, 0)
ok('... mining with the old one earns nothing', M().state().grit == before && ana.slots[0] === mx)
ok('preview(6500) shows a Level X hammer that is never the real Maul', M().preview(6500).id == 'tconstruct:vein_hammer' && !M().isRealMaul(M().preview(6500)))
ok('/maul stats (op)', /Serial 3, held by Bob\. Kills \d+ .*ore \d+, grudges settled 1/.test(run(['stats'], admin)[0]))
ok('no errors logged', !logs.some(l => /^ERR/.test(l)), logs.filter(l => /^ERR/.test(l)).join(' | '))

Date.now = realNow
console.log(fails ? fails + ' FAILED' : 'ALL PASSED')
