// The Anamian Axe: a living super weapon. One axe exists. It gains Souls from kills, boss kills, felled trees and
// offerings, levels I-X, and is rebuilt at each level with stronger enchantments and new abilities:
//   II Timber (fell a whole tree)   IV Cleave (hits splash nearby mobs)   V Bloodthirst (kills heal)
//   VI Blood Harvest (kills feed the Blood Pool)   VIII it becomes netherite   X Judgement (crits call lightning)
// It's open for grabs: whoever holds it keeps its level, and the server is told when it changes hands or goes loose.
// Works in Part I and Part II (Blood Harvest only acts with part2/blood_pool.js). See tools/kubejs/ANAMIAN_AXE.md.
// Copy to <server>/kubejs/server_scripts/ and run /reload. Give it with /anamian give <player>.
// KubeJS 6 (Rhino): no template strings; `let` inside nested blocks.

(function () {

// ===================== SETTINGS =====================

const NAME = 'The Anamian Axe'
const FLAVOUR = 'Forged for Lord Anamy. It remembers every hand that held it.'
// Level n needs LEVELS[n-1].souls (cumulative). ench: the full enchantment list at that level.
const LEVELS = [
  { souls: 0,    item: 'minecraft:diamond_axe', ench: { sharpness: 1, efficiency: 1, unbreaking: 1 } },
  { souls: 50,   item: 'minecraft:diamond_axe', ench: { sharpness: 2, efficiency: 2, unbreaking: 2 } },
  { souls: 150,  item: 'minecraft:diamond_axe', ench: { sharpness: 3, efficiency: 3, unbreaking: 2, looting: 1 } },
  { souls: 300,  item: 'minecraft:diamond_axe', ench: { sharpness: 3, efficiency: 4, unbreaking: 3, looting: 1 } },
  { souls: 500,  item: 'minecraft:diamond_axe', ench: { sharpness: 4, efficiency: 4, unbreaking: 3, looting: 2 } },
  { souls: 800,  item: 'minecraft:diamond_axe', ench: { sharpness: 4, efficiency: 5, unbreaking: 4, looting: 2 } },
  { souls: 1200, item: 'minecraft:diamond_axe', ench: { sharpness: 5, efficiency: 5, unbreaking: 4, looting: 3, fortune: 2 } },
  { souls: 1700, item: 'minecraft:netherite_axe', ench: { sharpness: 5, efficiency: 6, unbreaking: 5, looting: 3, fortune: 3 } },
  { souls: 2400, item: 'minecraft:netherite_axe', ench: { sharpness: 6, efficiency: 6, unbreaking: 5, looting: 3, fortune: 3, mending: 1 } },
  { souls: 3300, item: 'minecraft:netherite_axe', damage: 17, ench: { sharpness: 6, efficiency: 6, unbreaking: 5, looting: 3, fortune: 3, mending: 1, fire_aspect: 1 } },
]
// A level with `damage` sets the axe's attack damage (the tooltip's "N Attack Damage", before Sharpness) through item
// attribute modifiers. Those replace the axe's own, so the attack speed is set too (an axe's usual 1.0).
const ATTACK_SPEED_MODIFIER = -3.0
const ABILITIES = [
  { id: 'timber', level: 2, name: 'Timber', text: 'fells the whole tree (sneak to chop one log)' },
  { id: 'cleave', level: 4, name: 'Cleave', text: 'hits also strike nearby mobs' },
  { id: 'bloodthirst', level: 5, name: 'Bloodthirst', text: 'kills heal you' },
  { id: 'harvest', level: 6, name: 'Blood Harvest', text: 'kills feed the Blood Pool' },
  { id: 'judgement', level: 10, name: 'Judgement', text: 'critical hits call down lightning' },
]
// Souls
const SOULS_HOSTILE = 3, SOULS_OTHER = 1, SOULS_PLAYER = 25, SOULS_PER_LOG = 1
const SOULS_PER_COIN = 15, POTATOES_PER_OFFER = 100, SOULS_PER_POTATO_OFFER = 5
const BOSS_SOULS = {
  'twilightforest:naga': 100, 'twilightforest:lich': 150, 'twilightforest:minoshroom': 175,
  'twilightforest:knight_phantom': 200, 'twilightforest:hydra': 300, 'twilightforest:ur_ghast': 300,
  'twilightforest:alpha_yeti': 400, 'twilightforest:snow_queen': 500,
  'minecraft:ender_dragon': 500, 'minecraft:wither': 300,
  'iceandfire:fire_dragon': 150, 'iceandfire:ice_dragon': 150, 'iceandfire:lightning_dragon': 150,
}
// Abilities
const TIMBER_MAX = 128
const CLEAVE_RADIUS = 3, CLEAVE_SHARE = 0.5
const HEAL_KILL = 2, HEAL_BIG = 6
const HARVEST_MOB = 5, HARVEST_PLAYER = 50, HARVEST_BOSS = 100
const JUDGEMENT_COOLDOWN_MS = 3000, JUDGEMENT_SAFE_MS = 1000
// Better Combat swings have a wind-up: the server gets the hit after the swing lands, when a jump attack has usually
// already touched down. So a hit counts as critical if the holder was in the air and falling up to this long before.
const CRIT_GRACE_MS = 600
const FIRE_CHECK_RADIUS = 3, FIRE_CHECK_TICKS = 12
const SCAN_TICKS = 100                      // how often to look for who holds it
const LOOSE_AFTER_SCANS = 2                 // scans in a row without it (no window open) before it's announced loose
const DATA_KEY = 'anamian_axe'

// ===================== STATE =====================

let Serializer = null, StringArg = null
try { Serializer = Java.loadClass('net.minecraft.network.chat.Component$Serializer') } catch (e) { }
try { StringArg = Java.loadClass('com.mojang.brigadier.arguments.StringArgumentType') } catch (e) { }
const S = { cleaving: false, judged: {}, judgeCooldown: {}, loopToken: 0, debug: {}, falling: {} }
let data = null
function db() {
  if (data) return data
  data = { serial: 0, holder: '', holderName: '', loose: false, souls: 0, stats: { kills: 0, players: 0, bosses: 0, logs: 0, offered: 0 } }
  let raw = ''
  try { raw = String(Utils.server.persistentData.getString(DATA_KEY) || '') } catch (e) { }
  if (raw) {
    try {
      let d = JSON.parse(raw)
      if (d && typeof d.serial == 'number') data = d
    } catch (e) {
      console.error('[AnamianAxe] Saved data could not be read; a copy is kept')
      try { Utils.server.persistentData.putString(DATA_KEY + '_unreadable_' + Date.now(), raw) } catch (e2) { }
    }
  }
  return data
}
function save() {
  try { Utils.server.persistentData.putString(DATA_KEY, JSON.stringify(db())) } catch (e) { console.error('[AnamianAxe] Save failed: ' + e) }
}

// ===================== HELPERS =====================

function snbtString(s) { return "'" + String(s).replace(/\\/g, '\\\\').replace(/'/g, "\\'") + "'" }
function comp(parts) {
  const json = JSON.stringify([''].concat(parts))
  if (Serializer) { try { return Serializer.fromJsonLenient(json) } catch (e) { } }
  return Text.of(parts.map(p => (typeof p == 'string' ? p : p.text || '')).join(''))
}
function nameOf(p) { return String(p.getGameProfile().getName()) }
function uuidOf(e) {
  try { return String(e.getStringUuid()).toLowerCase() } catch (err) { }
  return String(e.getStringUUID()).toLowerCase()
}
function typeOf(e) { try { let id = e.getEncodeId(); return id == null ? '' : String(id) } catch (err) { return '' } }
function isPlayer(e) { try { return !!e && e.isPlayer() } catch (err) { return false } }
function levelOf(e) { const l = e.level; return typeof l == 'function' ? e.level() : l }
function dimOf(e) {
  let d = levelOf(e).dimension
  if (typeof d == 'function') d = levelOf(e).dimension()
  if (d != null && typeof d.location == 'function') d = d.location()
  return String(d)
}
function pos(e) {
  try { return { x: Number(e.getX()), y: Number(e.getY()), z: Number(e.getZ()) } } catch (err) { }
  return { x: Number(e.x), y: Number(e.y), z: Number(e.z) }
}
function dist(a, b) { const dx = a.x - b.x, dy = a.y - b.y, dz = a.z - b.z; return Math.sqrt(dx * dx + dy * dy + dz * dz) }
function list(javaList) { const out = []; for (let i = 0; i < javaList.size(); i++) out.push(javaList.get(i)); return out }
function num(n) { return (Math.round(n * 100) / 100).toFixed(2) }
function fmt(n) { return String(Math.round(n)).replace(/\B(?=(\d{3})+(?!\d))/g, ',') }
function roman(n) { return ['I', 'II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII', 'IX', 'X'][n - 1] || String(n) }
function run(server, c) { try { return server.runCommandSilent(c) } catch (e) { console.warn('[AnamianAxe] ' + c + ': ' + e); return 0 } }
function tellAll(server, parts) {
  const c = comp(parts)
  list(server.players).forEach(p => { try { p.tell(c) } catch (e) { } })
}
function voice(text, color) { return [{ text: '[ANAMIAN AXE] ', color: 'gold', bold: true }, { text: text, color: color || 'yellow' }] }
function damageType(source) {
  try { return String(typeof source.getMsgId == 'function' ? source.getMsgId() : source.getType()) } catch (e) { return '' }
}
function attackerOf(source) {
  try { return typeof source.getActual == 'function' ? source.getActual() : source.getEntity() } catch (e) { return null }
}
function directOf(source) {
  try { return typeof source.getImmediate == 'function' ? source.getImmediate() : source.getDirectEntity() } catch (e) { return null }
}
function bool(fn) { try { return !!fn() } catch (e) { return false } }

// ===================== THE AXE =====================

function levelFor(souls) {
  let n = 1
  LEVELS.forEach((L, i) => { if (souls >= L.souls) n = i + 1 })
  return n
}
function has(level, id) { return ABILITIES.some(a => a.id == id && level >= a.level) }
// { serial, souls } from a stack, or null.
function axeData(stack) {
  try {
    if (!stack || stack.isEmpty()) return null
    let nbt = stack.nbt
    if (nbt == null || !nbt.contains('trollcraft')) return null
    let t = nbt.getCompound('trollcraft')
    if (!t.contains('anamian')) return null
    let a = t.getCompound('anamian')
    return { serial: Number(a.getInt('serial')), souls: Number(a.getInt('souls')) }
  } catch (e) { return null }
}
function isRealAxe(stack) { const a = axeData(stack); return !!a && a.serial == db().serial && db().serial > 0 }
function damageOf(stack) {
  try { return Number(stack.getDamageValue()) } catch (e) { }
  try { return Number(stack.nbt.getInt('Damage')) } catch (e) { return 0 }
}
function maxDamageOf(id) { return id == 'minecraft:netherite_axe' ? 2031 : 1561 }
function bar(souls, level) {
  if (level >= LEVELS.length) return '██████████'
  const from = LEVELS[level - 1].souls, to = LEVELS[level].souls
  const filled = Math.max(0, Math.min(10, Math.floor((souls - from) / (to - from) * 10)))
  let out = ''
  for (let i = 0; i < 10; i++) out += i < filled ? '█' : '░'
  return out
}
function nameColor(level) { return level >= 10 ? 'dark_red' : level >= 7 ? 'red' : level >= 4 ? 'gold' : 'gray' }
function axeSnbt(serial, souls, damage) {
  const level = levelFor(souls), L = LEVELS[level - 1]
  const ench = Object.keys(L.ench).map(k => '{id:"minecraft:' + k + '",lvl:' + L.ench[k] + 's}')
  const next = level < LEVELS.length ? LEVELS[level].souls : null
  const lore = [
    { text: FLAVOUR, color: 'dark_gray', italic: true },
    { text: 'Level ' + roman(level) + ' · Souls ' + fmt(souls) + (next != null ? ' / ' + fmt(next) : ' (max)'), color: 'gold', italic: false },
    { text: bar(souls, level), color: 'dark_red', italic: false },
  ]
  ABILITIES.forEach(a => {
    if (level >= a.level) lore.push({ text: '✦ ' + a.name + ': ' + a.text, color: 'red', italic: false })
  })
  const locked = ABILITIES.filter(a => level < a.level)[0]
  if (locked) lore.push({ text: '✧ ' + locked.name + ' at Level ' + roman(locked.level), color: 'dark_gray', italic: false })
  const nameJson = { text: NAME, color: nameColor(level), bold: level >= 10, italic: false }
  return '{Damage:' + Math.max(0, Math.floor(damage || 0)) + ',Enchantments:[' + ench.join(',') + ']' +
    (L.damage ? ',AttributeModifiers:[' +
      '{AttributeName:"minecraft:generic.attack_damage",Name:"anamian_damage",Amount:' + (L.damage - 1) + 'd,Operation:0,Slot:"mainhand",UUID:[I;1095647553,1294356821,-1801154134,1361185305]},' +
      '{AttributeName:"minecraft:generic.attack_speed",Name:"anamian_speed",Amount:' + ATTACK_SPEED_MODIFIER + 'd,Operation:0,Slot:"mainhand",UUID:[I;1095647553,1294356821,-1801154134,1361185306]}]' : '') +
    ',display:{Name:' + snbtString(JSON.stringify(nameJson)) + ',Lore:[' + lore.map(l => snbtString(JSON.stringify(l))).join(',') + ']}' +
    ',trollcraft:{anamian:{serial:' + serial + ',souls:' + Math.floor(souls) + '}}}'
}
function makeAxe(serial, souls, damage) {
  const L = LEVELS[levelFor(souls) - 1]
  return Item.of(L.item, 1, axeSnbt(serial, souls, Math.min(damage || 0, maxDamageOf(L.item) - 1)))
}
// Where the real axe is in this player's inventory: a slot number (0-35, 36-39 armour, 40 off-hand) or -1.
function axeSlot(p) {
  try {
    let inv = p.inventory
    for (let i = 0; i <= 40; i++) { if (isRealAxe(inv.getItem(i))) return i }
  } catch (e) { }
  return -1
}
function inMainHand(p) { return bool(() => isRealAxe(p.mainHandItem)) }
// Held on the mouse cursor while moving items about.
function onCursor(p) { return bool(() => isRealAxe(p.containerMenu.getCarried())) }
function hasAxe(p) { return axeSlot(p) >= 0 || onCursor(p) }
// A chest, the black market's shop window or any other container is open. The black market takes the player's
// inventory away while its window is open (it hands it back on close), so the axe can't be seen then.
function windowOpen(p) {
  try { if (typeof p.hasContainerOpen == 'function') return !!p.hasContainerOpen() } catch (e) { }
  try { return !sameRef(p.containerMenu, p.inventoryMenu) } catch (e) { return false }
}
function sameRef(a, b) { try { return a === b || (a != null && b != null && a.equals(b)) } catch (e) { return a === b } }

// Adds Souls to the axe this player holds (main hand). Rebuilds it, announcing a level-up.
function addSouls(p, n, why) {
  n = Math.floor(n)
  if (!(n > 0)) return
  const slot = axeSlot(p)
  if (slot < 0) return
  const inv = p.inventory, stack = inv.getItem(slot), a = axeData(stack)
  const before = levelFor(a.souls), souls = a.souls + n, after = levelFor(souls)
  inv.setItem(slot, makeAxe(a.serial, souls, damageOf(stack) + 0))
  const D = db()
  D.souls = souls
  save()
  if (after > before) levelUp(p, after)
}
function levelUp(p, level) {
  const server = p.server || Utils.server
  const unlocked = ABILITIES.filter(a => a.level == level)
  let text = NAME + ' has reached Level ' + roman(level) + ' in the hands of ' + nameOf(p) + '.'
  if (unlocked.length) text += ' It has learned ' + unlocked.map(a => a.name).join(' and ') + '.'
  if (level == 8) text += ' Its edge turns to netherite.'
  tellAll(server, voice(text, level >= 10 ? 'red' : 'yellow'))
  run(server, 'playsound minecraft:ui.toast.challenge_complete master ' + nameOf(p) + ' ~ ~ ~ 1 0.8')
  const q = pos(p)
  run(server, 'execute in ' + dimOf(p) + ' run particle minecraft:totem_of_undying ' + num(q.x) + ' ' + num(q.y + 1) + ' ' + num(q.z) + ' 0.6 1 0.6 0.3 60')
  console.info('[AnamianAxe] ' + nameOf(p) + ': Level ' + level)
}
// Adds Damage to the held axe (Timber), never breaking it.
function wear(p, n) {
  const slot = axeSlot(p)
  if (slot < 0 || n <= 0) return
  const inv = p.inventory, stack = inv.getItem(slot), a = axeData(stack)
  inv.setItem(slot, makeAxe(a.serial, a.souls, damageOf(stack) + n))
}

// ===================== KILLS =====================

function isShadowClone(e) {
  try { if (typeof e.isShadowClone == 'function') return !!e.isShadowClone() } catch (err) { }
  try { return !!e.getNbt().getBoolean('ShadowClone') } catch (err) { }
  return false
}
function otherKnightsAlive(server, e) {
  const d = dimOf(e), here = pos(e)
  return list(server.entities).some(o => {
    if (sameEntity(o, e) || typeOf(o) != 'twilightforest:knight_phantom') return false
    try { if (!o.isAlive()) return false } catch (err) { }
    return dimOf(o) == d && dist(pos(o), here) <= 64
  })
}
function isHostile(e) {
  try { return String(e.getType().getCategory()).toLowerCase().indexOf('monster') >= 0 } catch (err) { }
  try { return !!e.isMonster() } catch (err) { return false }
}

EntityEvents.death(event => {
  const e = event.entity
  const killer = attackerOf(event.source)
  if (!isPlayer(killer) || sameEntity(killer, e) || !inMainHand(killer)) return
  const server = event.server || Utils.server
  const id = typeOf(e), victimIsPlayer = isPlayer(e)
  let souls = 0, big = false
  if (victimIsPlayer) { souls = SOULS_PLAYER; big = true }
  else if (BOSS_SOULS[id] != null) {
    if (id == 'twilightforest:lich' && isShadowClone(e)) return
    if (id == 'twilightforest:knight_phantom' && otherKnightsAlive(server, e)) return
    souls = BOSS_SOULS[id]
    big = true
  } else souls = isHostile(e) ? SOULS_HOSTILE : SOULS_OTHER
  const before = levelFor(axeData(killer.mainHandItem).souls)
  const D = db()
  D.stats.kills++
  if (victimIsPlayer) D.stats.players++
  if (big && !victimIsPlayer) D.stats.bosses++
  if (has(before, 'bloodthirst')) { try { killer.heal(big ? HEAL_BIG : HEAL_KILL) } catch (err) { } }
  if (has(before, 'harvest') && global.BloodPool) {
    try { global.BloodPool.addDrops(victimIsPlayer ? HARVEST_PLAYER : big ? HARVEST_BOSS : HARVEST_MOB, 'anamian', uuidOf(killer), nameOf(killer)) } catch (err) { }
  }
  addSouls(killer, souls, 'kill')
  if (big && !victimIsPlayer) tellAll(server, voice(NAME + ' drinks deep: ' + nameOf(killer) + ' felled a mighty foe. +' + souls + ' Souls.'))
})

// ===================== HITS: CLEAVE AND JUDGEMENT =====================

// What the crit check sees (shown by /anamian debug).
function critInfo(p) {
  let ground = null, fall = 0, vy = 0
  try { ground = !!p.onGround() } catch (e) { try { ground = !!p.isOnGround() } catch (e2) { try { ground = !!p.onGround } catch (e3) { } } }
  try { fall = Number(p.fallDistance) || 0 } catch (e) { }
  try { let v = p.getDeltaMovement(); vy = Number(typeof v.y == 'function' ? v.y() : v.y) || 0 } catch (e) { }
  return { ground: ground, fall: fall, vy: vy, water: bool(() => p.isInWater()), riding: bool(() => p.isPassenger()) }
}
function fallingNow(c) { return c.ground !== true && !c.water && !c.riding && (c.fall > 0 || c.vy < -0.05) }
// A critical hit: in the air and coming down (vanilla's rule), not in water, not riding; or, for Better Combat's
// delayed hits, falling within CRIT_GRACE_MS before the hit.
function isCrit(p) {
  const c = critInfo(p)
  if (c.water || c.riding) return false
  if (fallingNow(c)) return true
  const t = S.falling[uuidOf(p)]
  return !!t && Date.now() - t <= CRIT_GRACE_MS
}
// Each tick, note when the axe's holder is falling (only the holder is checked).
PlayerEvents.tick(event => {
  const p = event.player
  const D = db()
  if (!D.serial || !D.holder) return
  let u = ''
  try { u = uuidOf(p) } catch (e) { return }
  if (u != D.holder) return
  if (fallingNow(critInfo(p)) && inMainHand(p)) S.falling[u] = Date.now()
})
function sameEntity(a, b) {
  if (!a || !b) return false
  try { return uuidOf(a) == uuidOf(b) } catch (e) { return a === b }
}
function isFire(level, x, y, z) {
  try { return String(level.getBlock(x, y, z).id) == 'minecraft:fire' } catch (e) { return false }
}
function judgement(server, p, target) {
  const u = uuidOf(p), now = Date.now()
  if (S.judgeCooldown[u] && now < S.judgeCooldown[u]) return false
  S.judgeCooldown[u] = now + JUDGEMENT_COOLDOWN_MS
  S.judged[u] = now + JUDGEMENT_SAFE_MS
  run(server, 'effect give ' + nameOf(p) + ' minecraft:fire_resistance 3 0 true')
  const level = levelOf(target), d = dimOf(target), t = pos(target)
  const bx = Math.floor(t.x), by = Math.floor(t.y), bz = Math.floor(t.z), r = FIRE_CHECK_RADIUS
  const existing = {}
  for (let dx = -r; dx <= r; dx++) for (let dy = -2; dy <= 3; dy++) for (let dz = -r; dz <= r; dz++) {
    if (isFire(level, bx + dx, by + dy, bz + dz)) existing[(bx + dx) + ',' + (by + dy) + ',' + (bz + dz)] = true
  }
  run(server, 'execute in ' + d + ' run summon minecraft:lightning_bolt ' + num(t.x) + ' ' + num(t.y) + ' ' + num(t.z))
  ;[1, 3, 5, 7, 9, 11].filter(k => k <= FIRE_CHECK_TICKS).forEach(k => {
    server.scheduleInTicks(k, () => {
      for (let dx = -r; dx <= r; dx++) for (let dy = -2; dy <= 3; dy++) for (let dz = -r; dz <= r; dz++) {
        let x2 = bx + dx, y2 = by + dy, z2 = bz + dz
        if (!existing[x2 + ',' + y2 + ',' + z2] && isFire(level, x2, y2, z2)) run(server, 'execute in ' + d + ' run setblock ' + x2 + ' ' + y2 + ' ' + z2 + ' minecraft:air')
      }
    })
  })
  console.info('[AnamianAxe] Judgement by ' + nameOf(p) + ' at ' + num(t.x) + ' ' + num(t.y) + ' ' + num(t.z) + ' (' + d + ')')
  return true
}

EntityEvents.hurt(event => {
  const victim = event.entity
  const server = event.server || Utils.server
  // The holder is never hurt by their own Judgement.
  if (isPlayer(victim) && damageType(event.source) == 'lightningBolt') {
    let until = S.judged[uuidOf(victim)]
    if (until && Date.now() < until) event.cancel()   // last: cancel() stops this function
  }
  if (S.cleaving) return
  const p = attackerOf(event.source)
  if (!isPlayer(p) || sameEntity(p, victim) || !inMainHand(p)) return
  const direct = directOf(event.source)
  if (direct && !sameEntity(direct, p)) return          // arrows and other projectiles aren't melee hits
  const level = levelFor(axeData(p.mainHandItem).souls)
  let amount = 0
  try { amount = Number(event.damage) } catch (e) { }
  if (!(amount > 0)) { try { amount = Number(event.getDamage()) } catch (e) { } }
  if (has(level, 'cleave') && amount > 0) {
    let d = dimOf(victim), here = pos(victim)
    let splash = list(server.entities).filter(o => {
      if (sameEntity(o, victim) || sameEntity(o, p) || isPlayer(o)) return false
      try { if (!o.isLiving() || !o.isAlive()) return false } catch (err) { return false }
      return dimOf(o) == d && dist(pos(o), here) <= CLEAVE_RADIUS
    })
    S.cleaving = true
    try {
      splash.forEach(o => { run(server, 'damage ' + uuidOf(o) + ' ' + num(amount * CLEAVE_SHARE) + ' minecraft:player_attack by ' + nameOf(p)) })
    } finally { S.cleaving = false }
  }
  const crit = has(level, 'judgement') && isCrit(p)
  let fired = false
  if (crit) fired = judgement(server, p, victim)
  if (S.debug[uuidOf(p)]) {
    let c = critInfo(p)
    try {
      let ago = S.falling[uuidOf(p)] ? Date.now() - S.falling[uuidOf(p)] : -1
      p.tell(comp(voice('hit: Level ' + roman(level) + ', damage ' + num(amount) + ', ground ' + c.ground + ', fall ' + num(c.fall) + ', vy ' + num(c.vy) +
        ', last fell ' + (ago < 0 ? 'never' : ago + ' ms ago') +
        (c.water ? ', in water' : '') + (c.riding ? ', riding' : '') + ' -> ' + (has(level, 'judgement') ? (crit ? (fired ? 'JUDGEMENT' : 'crit, on cooldown') : 'not a crit') : 'no Judgement yet'), 'gray')))
    } catch (e) { }
  }
})

// ===================== TREES: SOULS AND TIMBER =====================

function isLog(block) { try { return !!block.hasTag('minecraft:logs') } catch (e) { return false } }
function isLeaves(block) { try { return !!block.hasTag('minecraft:leaves') } catch (e) { return false } }
function blockedByArea(p, dim, x, y, z) {
  if (typeof PROTECTED_AREAS == 'undefined') return false
  try { if (p.hasPermissions(2)) return false } catch (e) { }
  const name = nameOf(p)
  return PROTECTED_AREAS.some(a => a.dim == dim && a.allowed.indexOf(name) < 0 &&
    x >= Math.min(a.x1, a.x2) && x <= Math.max(a.x1, a.x2) && y >= Math.min(a.y1, a.y2) && y <= Math.max(a.y1, a.y2) &&
    z >= Math.min(a.z1, a.z2) && z <= Math.max(a.z1, a.z2))
}
// The connected logs above and beside (x0,y0,z0), or [] if they don't touch leaves (not a tree) or exceed the cap.
function treeFrom(level, x0, y0, z0) {
  const seen = {}, logs = [], queue = [[x0, y0, z0]]
  let leaves = false
  seen[x0 + ',' + y0 + ',' + z0] = true
  while (queue.length) {
    let c = queue.shift()
    for (let dx = -1; dx <= 1; dx++) for (let dy = 0; dy <= 1; dy++) for (let dz = -1; dz <= 1; dz++) {
      let x = c[0] + dx, y = c[1] + dy, z = c[2] + dz, k = x + ',' + y + ',' + z
      if (seen[k]) continue
      seen[k] = true
      let b = level.getBlock(x, y, z)
      if (isLeaves(b)) { leaves = true; continue }
      if (!isLog(b) || y < y0) continue
      logs.push([x, y, z])
      if (logs.length > TIMBER_MAX) return []
      queue.push([x, y, z])
    }
  }
  return leaves ? logs : []
}

BlockEvents.broken(event => {
  const p = event.player, b = event.block
  if (!isPlayer(p) || !inMainHand(p) || !isLog(b)) return
  const server = event.server || Utils.server
  const level = levelFor(axeData(p.mainHandItem).souls)
  let felled = 0
  if (has(level, 'timber') && !bool(() => p.isShiftKeyDown()) && !bool(() => p.isCrouching())) {
    let d = dimOf(p), lv = b.level
    treeFrom(lv, Number(b.x), Number(b.y), Number(b.z)).forEach(c => {
      if (blockedByArea(p, d, c[0], c[1], c[2])) return
      if (run(server, 'execute in ' + d + ' run setblock ' + c[0] + ' ' + c[1] + ' ' + c[2] + ' minecraft:air destroy') > 0) felled++
    })
    if (felled) wear(p, felled)
  }
  const D = db()
  D.stats.logs += 1 + felled
  addSouls(p, SOULS_PER_LOG * (1 + felled), 'logs')
})

// ===================== WHO HOLDS IT =====================

function scan(server) {
  const D = db()
  if (!D.serial) return
  const players = list(server.players)
  const holder = players.filter(p => hasAxe(p))[0] || null
  if (holder) {
    let u = uuidOf(holder)
    if (u != D.holder) {
      let prev = D.holderName
      D.holder = u
      D.holderName = nameOf(holder)
      D.loose = false
      save()
      let slot = axeSlot(holder)
      let lv = slot >= 0 ? levelFor(axeData(holder.inventory.getItem(slot)).souls) : levelFor(D.souls)
      tellAll(server, voice(nameOf(holder) + ' has claimed ' + NAME + ' (Level ' + roman(lv) + ')!' + (prev && prev != nameOf(holder) ? ' ' + prev + ' has lost it.' : ''), 'gold'))
      console.info('[AnamianAxe] Now held by ' + nameOf(holder))
    } else if (D.loose) { D.loose = false; save() }
    S.misses = 0
    return
  }
  // Nobody online has it. If its last holder is online, it was dropped, stashed or lost in a corpse: it's loose.
  const last = players.filter(p => uuidOf(p) == D.holder)[0]
  if (!last || D.loose) return
  if (windowOpen(last)) { S.misses = 0; return }     // a chest or shop window is open: wait until it's closed
  S.misses = (S.misses || 0) + 1
  if (S.misses >= LOOSE_AFTER_SCANS) {
    D.loose = true
    save()
    tellAll(server, voice(NAME + ' is loose. ' + D.holderName + ' no longer has it. Open for grabs.', 'red'))
    console.info('[AnamianAxe] Loose (last held by ' + D.holderName + ')')
  }
}
function startLoop(server) {
  const token = ++S.loopToken
  const tick = () => {
    if (token != S.loopToken) return
    try { scan(server) } catch (e) { console.error('[AnamianAxe] Scan: ' + e) }
    server.scheduleInTicks(SCAN_TICKS, tick)
  }
  server.scheduleInTicks(SCAN_TICKS, tick)
}
ServerEvents.loaded(event => startLoop(event.server))
try { if (Utils.server) startLoop(Utils.server) } catch (e) { }   // after /reload

// ===================== COMMANDS =====================

function countItem(p, id) {
  let n = 0
  try { for (let i = 0; i < 36; i++) { let s = p.inventory.getItem(i); if (!s.isEmpty() && String(s.id) == id) n += s.getCount() } } catch (e) { }
  return n
}
function takeItem(p, id, n) {
  let left = n
  for (let i = 0; i < 36 && left > 0; i++) {
    let s = p.inventory.getItem(i)
    if (s.isEmpty() || String(s.id) != id) continue
    let use = Math.min(left, s.getCount())
    s.shrink(use)
    left -= use
  }
  return left == 0
}
function playerByName(server, name) {
  return list(server.players).filter(p => nameOf(p).toLowerCase() == String(name).toLowerCase())[0] || null
}

ServerEvents.commandRegistry(event => {
  const Commands = event.commands, Arguments = event.arguments
  const reply = (ctx, text, bad) => { ctx.source.sendSystemMessage(comp(voice(text, bad ? 'red' : 'yellow'))); return bad ? 0 : 1 }
  const safe = fn => ctx => { try { return fn(ctx) } catch (e) { console.error('[AnamianAxe] ' + e); return reply(ctx, 'Error: ' + e, true) } }
  const op = src => src.hasPermission(2)
  const int = name => Commands.argument(name, Arguments.INTEGER.create(event))
  const numArg = (ctx, name) => Number(Arguments.INTEGER.getResult(ctx, name))
  const str = (ctx, name) => String(StringArg.getString(ctx, name))
  const holderCheck = ctx => {
    const p = ctx.source.getPlayer()
    if (!p) return { err: 'Players only.' }
    if (!inMainHand(p)) return { err: 'Hold ' + NAME + ' in your main hand.' }
    return { p: p }
  }
  const info = ctx => {
    const D = db()
    if (!D.serial) return reply(ctx, NAME + ' has not been forged yet.')
    const souls = D.souls, lv = levelFor(souls)
    const next = lv < LEVELS.length ? ' Next level at ' + fmt(LEVELS[lv].souls) + '.' : ' It is at its peak.'
    const abilities = ABILITIES.filter(a => lv >= a.level).map(a => a.name).join(', ') || 'none yet'
    return reply(ctx, 'Level ' + roman(lv) + ', ' + fmt(souls) + ' Souls.' + next + ' Abilities: ' + abilities + '. ' +
      (D.loose ? 'It is loose: open for grabs.' : D.holderName ? 'Held by ' + D.holderName + '.' : ''))
  }
  const offerCoins = ctx => {
    const h = holderCheck(ctx)
    if (h.err) return reply(ctx, h.err, true)
    const n = numArg(ctx, 'amount'), E = global.Economy
    if (!E) return reply(ctx, 'The black market is not installed.', true)
    if (!(n > 0)) return reply(ctx, 'Offer at least one coin.', true)
    if (E.countCoins(h.p) < n) return reply(ctx, 'You only carry ' + E.countCoins(h.p) + ' Hush Coins.', true)
    if (!E.takeCoins(h.p, n)) return reply(ctx, 'The coins slipped away.', true)
    db().stats.offered += n * SOULS_PER_COIN
    addSouls(h.p, n * SOULS_PER_COIN, 'coins')
    return reply(ctx, 'The Axe drinks ' + n + ' Hush Coin' + (n == 1 ? '' : 's') + ': +' + (n * SOULS_PER_COIN) + ' Souls.')
  }
  const offerPotatoes = ctx => {
    const h = holderCheck(ctx)
    if (h.err) return reply(ctx, h.err, true)
    const n = numArg(ctx, 'amount')
    const lots = Math.floor(n / POTATOES_PER_OFFER)
    if (lots < 1) return reply(ctx, 'The Axe takes potatoes in hundreds.', true)
    const spend = lots * POTATOES_PER_OFFER
    if (countItem(h.p, 'minecraft:potato') < spend) return reply(ctx, 'You only carry ' + countItem(h.p, 'minecraft:potato') + ' potatoes.', true)
    takeItem(h.p, 'minecraft:potato', spend)
    db().stats.offered += lots * SOULS_PER_POTATO_OFFER
    addSouls(h.p, lots * SOULS_PER_POTATO_OFFER, 'potatoes')
    return reply(ctx, 'The Axe takes ' + spend + ' potatoes: +' + (lots * SOULS_PER_POTATO_OFFER) + ' Souls.')
  }
  const give = (ctx, force) => {
    const D = db(), p = playerByName(ctx.source.server, str(ctx, 'player'))
    if (!p) return reply(ctx, 'Nobody called ' + str(ctx, 'player') + ' is online.', true)
    if (D.serial && !force) return reply(ctx, NAME + ' already exists (held by ' + (D.holderName || 'nobody') + '). Use /anamian give <player> force to forge a new one; the old one becomes an ordinary axe.', true)
    D.serial++
    D.souls = 0
    D.holder = uuidOf(p)
    D.holderName = nameOf(p)
    D.loose = false
    save()
    p.give(makeAxe(D.serial, 0, 0))
    console.info('[AnamianAxe] Forged (serial ' + D.serial + ') for ' + nameOf(p))
    return reply(ctx, 'Forged ' + NAME + ' for ' + nameOf(p) + ' at Level I.')
  }
  const setSouls = ctx => {
    const h = holderCheck(ctx)
    if (h.err) return reply(ctx, h.err, true)
    const n = Math.max(0, numArg(ctx, 'souls'))
    const slot = axeSlot(h.p), stack = h.p.inventory.getItem(slot), a = axeData(stack)
    const before = levelFor(a.souls)
    h.p.inventory.setItem(slot, makeAxe(a.serial, n, damageOf(stack)))
    db().souls = n
    save()
    if (levelFor(n) > before) levelUp(h.p, levelFor(n))
    return reply(ctx, 'Souls set to ' + n + ' (Level ' + roman(levelFor(n)) + ').')
  }
  event.register(Commands.literal('anamian')
    .executes(safe(info))
    .then(Commands.literal('offer')
      .then(Commands.literal('coins').then(int('amount').executes(safe(offerCoins))))
      .then(Commands.literal('potatoes').then(int('amount').executes(safe(offerPotatoes)))))
    .then(Commands.literal('give').requires(op).then(Commands.argument('player', StringArg.word())
      .executes(safe(ctx => give(ctx, false)))
      .then(Commands.literal('force').executes(safe(ctx => give(ctx, true))))))
    .then(Commands.literal('setsouls').requires(op).then(int('souls').executes(safe(setSouls))))
    .then(Commands.literal('debug').requires(op).executes(safe(ctx => {
      const p = ctx.source.getPlayer()
      if (!p) return reply(ctx, 'Players only.', true)
      const u = uuidOf(p)
      S.debug[u] = !S.debug[u]
      return reply(ctx, 'Debug ' + (S.debug[u] ? 'on: every hit with the Axe shows what the crit check sees.' : 'off.'))
    })))
    .then(Commands.literal('stats').requires(op).executes(safe(ctx => {
      const D = db(), s = D.stats
      return reply(ctx, 'Serial ' + D.serial + ', held by ' + (D.holderName || 'nobody') + (D.loose ? ' (loose)' : '') + '. Kills ' + s.kills +
        ' (players ' + s.players + ', bosses ' + s.bosses + '), logs ' + s.logs + ', Souls from offerings ' + s.offered + '.')
    }))))
})

global.AnamianAxe = {
  levels: LEVELS,
  abilities: ABILITIES,
  levelFor: s => levelFor(Number(s)),
  isRealAxe: stack => isRealAxe(stack),
  state: () => JSON.parse(JSON.stringify(db())),
}

})()
