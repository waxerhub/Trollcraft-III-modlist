// The Deepdelver's Maul: Goruk the dwarf's super weapon, for fighting and mining. One Maul exists, open for grabs
// like the Anamian Axe. It gains Grit from ore mined with it and from kills, and levels I-X: a netherite pickaxe
// whose Efficiency (to V), Fortune (to III) and damage (8 to 18) grow, until at Level X it becomes a Tinkers' Vein
// Hammer.
//   - Prospector: mining an ore marks the ore around it (2 blocks to 5) with small glowing markers, seen through walls
//     for a few seconds. A marker goes as soon as its ore is mined. Sneak + right-click with the Maul turns it off/on.
//   - Forge-touched: ore it mines drops smelted (raw iron comes out as iron ingots; Fortune still counts).
//   - Deepborn: in the main hand where daylight doesn't reach, Night Vision and Haste (Haste II from Level VI).
//   - Iron Blood: kills (hostile mobs, bosses, players) give 2 absorption hearts, up to 8, fading a minute later.
//   - White-hot: hits ignore part of what armour (and protection) would stop (10% at Level I to 50% at Level X).
//   - The Grudge Ledger: a player who hurts the Maul's holder goes on its ledger. The holder hits them harder
//     (+10% to +30%), and killing them with the Maul settles the grudge (and pays Grit).
//   - Earthshaker (Level V): a falling hit slams the ground: everything within 3 blocks (4 from Level VIII) is
//     damaged and slowed. Better Combat's delayed hits count, as for the Anamian Axe's Judgement.
// White-hot and the grudge bonus change a hit's damage, which needs startup_scripts/deepdelver_maul_hooks.js (a Forge
// hook; one restart to install). Without it, everything else works. See tools/kubejs/DEEPDELVER_MAUL.md.
// Finding it: until the first Maul exists, each fresh loot chest Goruk_Lohaus opens has a 10% chance of holding it
// (FINDER, FIND_CHANCE). After that, no chest ever holds one again.
// Copy to <server>/kubejs/server_scripts/ and run /reload. An op can also forge it with /maul give <player>.
// KubeJS 6 (Rhino): no template strings; `let` inside nested blocks; event.cancel() last.

(function () {

// ===================== SETTINGS =====================

const NAME = 'The Deepdelver\'s Maul'
const FLAVOUR = 'Forged in the deep for Goruk the dwarf. It remembers every vein it opened.'
// Level n needs LEVELS[n-1].grit (cumulative). damage: its base attack damage (a player's own 1 included).
// ench: the pickaxe's enchantments. hammer: from here it's a Tinkers' Vein Hammer.
const LEVELS = [
  { grit: 0,    damage: 8,  ench: { efficiency: 1, unbreaking: 1 } },
  { grit: 100,  damage: 9,  ench: { efficiency: 1, unbreaking: 2 } },
  { grit: 300,  damage: 10, ench: { efficiency: 2, unbreaking: 2, fortune: 1 } },
  { grit: 600,  damage: 11, ench: { efficiency: 2, unbreaking: 3, fortune: 1 } },
  { grit: 1000, damage: 12, ench: { efficiency: 3, unbreaking: 3, fortune: 1 } },
  { grit: 1600, damage: 14, ench: { efficiency: 3, unbreaking: 3, fortune: 2 } },
  { grit: 2400, damage: 15, ench: { efficiency: 4, unbreaking: 3, fortune: 2 } },
  { grit: 3400, damage: 16, ench: { efficiency: 4, unbreaking: 3, fortune: 2, mending: 1 } },
  { grit: 4700, damage: 17, ench: { efficiency: 5, unbreaking: 3, fortune: 3, mending: 1 } },
  { grit: 6500, damage: 18, hammer: true },
]
const PICKAXE = 'minecraft:netherite_pickaxe', PICKAXE_SPEED = 1.2, PICKAXE_DURABILITY = 2031
// HAMMER_SPEED: what Tinkers works out for these materials (0.85 base; Hepatizon's Lightweight makes it 0.92).
const HAMMER = 'tconstruct:vein_hammer', HAMMER_SPEED = 0.92
// The Vein Hammer's parts, in order: hammer head, handle, pick head, plate. (Tinkers has no netherite material.)
const HAMMER_MATERIALS = ['tconstruct:manyullyn', 'tconstruct:hepatizon', 'tconstruct:cobalt', 'tconstruct:manyullyn']
// Tinkers ignores enchantments; its own: Haste V (+20 mining speed) and Luck III (Fortune III, and Looting III).
const HAMMER_UPGRADES = [{ name: 'tconstruct:haste', level: 5 }, { name: 'tconstruct:luck', level: 3 }]
const ABILITIES = [
  { id: 'prospector', level: 1, name: 'Prospector' },
  { id: 'forge', level: 1, name: 'Forge-touched' },
  { id: 'deepborn', level: 1, name: 'Deepborn' },
  { id: 'ironblood', level: 1, name: 'Iron Blood' },
  { id: 'whitehot', level: 1, name: 'White-hot' },
  { id: 'grudge', level: 1, name: 'The Grudge Ledger' },
  { id: 'earthshaker', level: 5, name: 'Earthshaker' },
  { id: 'veins', level: 10, name: 'Vein Hammer' },
]
// Prospector: the radius by level (I..X); how long a marker stays (it goes at once when its ore is mined), how often
// it can fire, how many markers at once, and their colour. MARKER_SIZE: a marker is a small copy of the ore in the
// middle of the block (this share of a block), so it hides nothing; only its outline shows through walls.
// MARKER_CHECK_TICKS: how often markers are checked for ore that's gone. Sneak + right-click with the Maul turns
// Prospector off or on for that player; TOGGLE_GAP_MS keeps one press (or a held button) to one switch.
const PROSPECT_RADIUS = [2, 2, 2, 3, 3, 3, 4, 4, 4, 5]
const PROSPECT_SECONDS = 5, PROSPECT_COOLDOWN_MS = 2000, PROSPECT_MAX = 40, PROSPECT_COLOR = 16766720
const MARKER_SIZE = 0.3, MARKER_CHECK_TICKS = 4, TOGGLE_GAP_MS = 600
// Forge-touched: ore it mines drops what a furnace would make of it (and the furnace's experience). Anything with
// no smelting recipe (coal, diamonds, redstone) drops as usual. Recipes the Blood Pool has sealed aren't there to use.
// Deepborn: in the main hand where daylight doesn't reach (sky light DEEP_MAX_SKYLIGHT or less: caves, mines, the
// Nether), Night Vision and Haste, Haste II from DEEP_HASTE2_LEVEL. Refreshed every second for DEEP_SECONDS; after
// DEEP_GRACE_SECONDS without it (time to place a torch), the effects it gave are taken away.
const DEEP_MAX_SKYLIGHT = 7, DEEP_HASTE2_LEVEL = 6, DEEP_SECONDS = 12, DEEP_GRACE_SECONDS = 3
// Iron Blood: a kill (a hostile mob, a boss or a player) gives IRON_HEARTS absorption hearts, up to IRON_MAX_HEARTS.
// What it gave fades IRON_SECONDS after the last kill.
const IRON_HEARTS = 2, IRON_MAX_HEARTS = 8, IRON_SECONDS = 60
// White-hot: the share of what armour, protection and resistance stop that gets through anyway (% at Level I .. X).
const WHITE_HOT_FROM = 10, WHITE_HOT_TO = 50
// The Grudge Ledger: % more damage against a player on it (Level I .. X), and how long a grudge lasts.
const GRUDGE_FROM = 10, GRUDGE_TO = 30, GRUDGE_DAYS = 7
// Earthshaker: radius (3, or 4 from Level VIII), damage as a share of the Maul's, slowness II, cooldown.
const SHAKE_RADIUS = 3, SHAKE_RADIUS_BIG = 4, SHAKE_BIG_LEVEL = 8
const SHAKE_SHARE = 0.4, SHAKE_SLOW_SECONDS = 2, SHAKE_COOLDOWN_MS = 6000, SHAKE_HITS_PLAYERS = true
const CRIT_GRACE_MS = 600             // Better Combat: a hit still counts as falling this long after the fall
// Grit
const GRIT_ORE = 1
const GRIT_RARE_ORES = {
  'minecraft:diamond_ore': 8, 'minecraft:deepslate_diamond_ore': 8, 'minecraft:emerald_ore': 8,
  'minecraft:deepslate_emerald_ore': 8, 'minecraft:ancient_debris': 15,
}
const GRIT_HOSTILE = 3, GRIT_OTHER = 1, GRIT_PLAYER = 25, GRIT_GRUDGE = 40
const BOSS_GRIT = {
  'twilightforest:naga': 100, 'twilightforest:lich': 150, 'twilightforest:minoshroom': 175,
  'twilightforest:knight_phantom': 200, 'twilightforest:hydra': 300, 'twilightforest:ur_ghast': 300,
  'twilightforest:alpha_yeti': 400, 'twilightforest:snow_queen': 500,
  'minecraft:ender_dragon': 500, 'minecraft:wither': 300,
  'iceandfire:fire_dragon': 150, 'iceandfire:ice_dragon': 150, 'iceandfire:lightning_dragon': 150,
}
// Finding it: until the first Maul exists, each fresh loot container FINDER opens (a chest, barrel or the like with a
// loot table, opened for the first time) has FIND_CHANCE of holding it. Once one has been forged (found or given), no
// chest ever holds another: the saved serial never goes back to 0, even if the Maul is lost or re-forged.
const FINDER = 'Goruk_Lohaus'         // the account's username (not a nickname, which anyone could copy); '' = off
const FIND_CHANCE = 0.10
const SCAN_TICKS = 100                // how often to look for who holds it
const LOOSE_AFTER_SCANS = 2           // scans in a row without it (no window open) before it's announced loose
const DATA_KEY = 'deepdelver_maul'

// ===================== STATE =====================

let Serializer = null, StringArg = null
try { Serializer = Java.loadClass('net.minecraft.network.chat.Component$Serializer') } catch (e) { }
try { StringArg = Java.loadClass('com.mojang.brigadier.arguments.StringArgumentType') } catch (e) { }
let RecipeType = null, SimpleContainer = null, LightLayer = null, BlockPos = null
try { RecipeType = Java.loadClass('net.minecraft.world.item.crafting.RecipeType') } catch (e) { }
try { SimpleContainer = Java.loadClass('net.minecraft.world.SimpleContainer') } catch (e) { }
try { LightLayer = Java.loadClass('net.minecraft.world.level.LightLayer') } catch (e) { }
try { BlockPos = Java.loadClass('net.minecraft.core.BlockPos') } catch (e) { }
// pending: victim uuid -> a hit from the Maul waiting for the damage hook. markers: Prospector's, by "dim|x|y|z".
// smeltZones: ore Forge-touched is breaking this tick. smeltCache: item id -> what it smelts into (or null).
// deep: Deepborn's effects given, by player. iron: Iron Blood's absorption given, by player.
const S = { shaking: false, shakeCooldown: {}, prospectAt: {}, falling: {}, pending: {}, markers: {}, markerSeq: 0, markerLoop: false,
  toggledAt: {}, smeltZones: [], smeltCache: {}, deep: {}, deepAt: {}, iron: {}, loopToken: 0, misses: 0, chests: {} }
let data = null
function db() {
  if (data) return data
  data = { serial: 0, holder: '', holderName: '', loose: false, grit: 0, grudges: {},
    stats: { kills: 0, players: 0, bosses: 0, ores: 0, settled: 0 } }
  let raw = ''
  try { raw = String(Utils.server.persistentData.getString(DATA_KEY) || '') } catch (e) { }
  if (raw) {
    try {
      let d = JSON.parse(raw)
      if (d && typeof d.serial == 'number') data = d
    } catch (e) {
      console.error('[Maul] Saved data could not be read; a copy is kept')
      try { Utils.server.persistentData.putString(DATA_KEY + '_unreadable_' + Date.now(), raw) } catch (e2) { }
    }
  }
  if (!data.grudges) data.grudges = {}
  if (!data.prospectOff) data.prospectOff = {}       // players who turned Prospector off
  return data
}
function save() {
  try { Utils.server.persistentData.putString(DATA_KEY, JSON.stringify(db())) } catch (e) { console.error('[Maul] Save failed: ' + e) }
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
function r3(n) { return Math.round(Number(n) * 1000) / 1000 }
function fmt(n) { return String(Math.round(n)).replace(/\B(?=(\d{3})+(?!\d))/g, ',') }
function roman(n) { return ['I', 'II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII', 'IX', 'X'][n - 1] || String(n) }
function run(server, c) { try { return server.runCommandSilent(c) } catch (e) { console.warn('[Maul] ' + c + ': ' + e); return 0 } }
function tell(p, parts) { try { p.tell(comp(parts)) } catch (e) { } }
function tellAll(server, parts) {
  const c = comp(parts)
  list(server.players).forEach(p => { try { p.tell(c) } catch (e) { } })
}
function voice(text, color) { return [{ text: '[THE MAUL] ', color: 'dark_aqua', bold: true }, { text: text, color: color || 'aqua' }] }
// A sound where the player stands (a bare ~ ~ ~ would be the server's own position, out of earshot).
function soundAt(server, p, sound, volume, pitch) {
  const q = pos(p)
  run(server, 'execute in ' + dimOf(p) + ' run playsound ' + sound + ' player @a ' + num(q.x) + ' ' + num(q.y) + ' ' + num(q.z) + ' ' + volume + ' ' + pitch)
}
function attackerOf(source) {
  try { return typeof source.getActual == 'function' ? source.getActual() : source.getEntity() } catch (e) { return null }
}
function directOf(source) {
  try { return typeof source.getImmediate == 'function' ? source.getImmediate() : source.getDirectEntity() } catch (e) { return null }
}
function bool(fn) { try { return !!fn() } catch (e) { return false } }
function sameEntity(a, b) {
  if (!a || !b) return false
  try { return uuidOf(a) == uuidOf(b) } catch (e) { return a === b }
}
function sameRef(a, b) { try { return a === b || (a != null && b != null && a.equals(b)) } catch (e) { return a === b } }

// ===================== THE MAUL =====================

function levelFor(grit) {
  let n = 1
  LEVELS.forEach((L, i) => { if (grit >= L.grit) n = i + 1 })
  return n
}
function has(level, id) { return ABILITIES.some(a => a.id == id && level >= a.level) }
// A value that grows from `from` at Level I to `to` at Level X.
function scale(level, from, to) { return Math.round(from + (Math.min(level, 10) - 1) * (to - from) / 9) }
function whiteHot(level) { return scale(level, WHITE_HOT_FROM, WHITE_HOT_TO) }
function grudgeBonus(level) { return scale(level, GRUDGE_FROM, GRUDGE_TO) }
function prospectRadius(level) { return PROSPECT_RADIUS[Math.min(level, PROSPECT_RADIUS.length) - 1] }
function shakeRadius(level) { return level >= SHAKE_BIG_LEVEL ? SHAKE_RADIUS_BIG : SHAKE_RADIUS }
// { serial, grit } from a stack, or null.
function maulData(stack) {
  try {
    if (!stack || stack.isEmpty()) return null
    let nbt = stack.nbt
    if (nbt == null || !nbt.contains('trollcraft')) return null
    let t = nbt.getCompound('trollcraft')
    if (!t.contains('maul')) return null
    let a = t.getCompound('maul')
    return { serial: Number(a.getInt('serial')), grit: Number(a.getInt('grit')) }
  } catch (e) { return null }
}
function isRealMaul(stack) { const a = maulData(stack); return !!a && a.serial == db().serial && db().serial > 0 }
function damageOf(stack) {
  try { return Number(stack.getDamageValue()) } catch (e) { }
  try { return Number(stack.nbt.getInt('Damage')) } catch (e) { return 0 }
}
function bar(grit, level) {
  if (level >= LEVELS.length) return '██████████'
  const from = LEVELS[level - 1].grit, to = LEVELS[level].grit
  const filled = Math.max(0, Math.min(10, Math.floor((grit - from) / (to - from) * 10)))
  let out = ''
  for (let i = 0; i < 10; i++) out += i < filled ? '█' : '░'
  return out
}
function nameColor(level) { return level >= 10 ? 'dark_aqua' : level >= 7 ? 'aqua' : level >= 4 ? 'gold' : 'gray' }
function abilityText(id, level) {
  if (id == 'prospector') return 'mining ore marks the ore within ' + prospectRadius(level) + ' blocks (sneak + right-click: on/off)'
  if (id == 'forge') return 'ore it mines comes out smelted'
  if (id == 'deepborn') return 'away from daylight, Night Vision and Haste ' + (level >= DEEP_HASTE2_LEVEL ? 'II' : 'I')
  if (id == 'ironblood') return 'kills give ' + IRON_HEARTS + ' absorption hearts (up to ' + IRON_MAX_HEARTS + ')'
  if (id == 'whitehot') return 'hits ignore ' + whiteHot(level) + '% of armour'
  if (id == 'grudge') return 'whoever hurts you goes on the ledger; +' + grudgeBonus(level) + '% damage to them'
  if (id == 'earthshaker') return 'falling hits slam the ground (' + shakeRadius(level) + ' blocks)'
  return 'mines whole ore veins'
}
function maulSnbt(serial, grit, damage) {
  const level = levelFor(grit), L = LEVELS[level - 1]
  const next = level < LEVELS.length ? LEVELS[level].grit : null
  const lore = [
    { text: FLAVOUR, color: 'dark_gray', italic: true },
    { text: 'Level ' + roman(level) + ' · Grit ' + fmt(grit) + (next != null ? ' / ' + fmt(next) : ' (max)'), color: 'gold', italic: false },
    { text: bar(grit, level), color: 'dark_aqua', italic: false },
    { text: L.damage + ' damage', color: 'red', italic: false },
  ]
  ABILITIES.forEach(a => { if (level >= a.level) lore.push({ text: '✦ ' + a.name + ': ' + abilityText(a.id, level), color: 'aqua', italic: false }) })
  const locked = ABILITIES.filter(a => level < a.level)[0]
  if (locked) lore.push({ text: '✧ ' + locked.name + ' at Level ' + roman(locked.level), color: 'dark_gray', italic: false })
  const nameJson = { text: NAME, color: nameColor(level), bold: level >= 10, italic: false }
  const attrs = 'AttributeModifiers:[' +
    '{AttributeName:"minecraft:generic.attack_damage",Name:"maul_damage",Amount:' + r3(L.damage - 1) + 'd,Operation:0,Slot:"mainhand",UUID:[I;1145128268,1430733672,-1347572045,1096174401]},' +
    '{AttributeName:"minecraft:generic.attack_speed",Name:"maul_speed",Amount:' + r3((L.hammer ? HAMMER_SPEED : PICKAXE_SPEED) - 4) + 'd,Operation:0,Slot:"mainhand",UUID:[I;1145128268,1430733672,-1347572045,1096174402]}]'
  const display = 'display:{Name:' + snbtString(JSON.stringify(nameJson)) + ',Lore:[' + lore.map(l => snbtString(JSON.stringify(l))).join(',') + ']}'
  const mark = 'trollcraft:{maul:{serial:' + serial + ',grit:' + Math.floor(grit) + '}}'
  if (L.hammer) {
    return '{tic_materials:[' + HAMMER_MATERIALS.map(m => '"' + m + '"').join(',') + '],tic_upgrades:[' +
      HAMMER_UPGRADES.map(u => '{name:"' + u.name + '",level:' + u.level + '}').join(',') + '],' + attrs + ',' + display + ',' + mark + '}'
  }
  const ench = Object.keys(L.ench).map(k => '{id:"minecraft:' + k + '",lvl:' + L.ench[k] + 's}')
  return '{Damage:' + Math.max(0, Math.floor(damage || 0)) + ',Enchantments:[' + ench.join(',') + '],' + attrs + ',' + display + ',' + mark + '}'
}
function makeMaul(serial, grit, damage) {
  const L = LEVELS[levelFor(grit) - 1]
  return Item.of(L.hammer ? HAMMER : PICKAXE, 1, maulSnbt(serial, grit, L.hammer ? 0 : Math.min(damage || 0, PICKAXE_DURABILITY - 1)))
}
// Where the real Maul is in this player's inventory: a slot number (0-35, 36-39 armour, 40 off-hand) or -1.
function maulSlot(p) {
  try {
    let inv = p.inventory
    for (let i = 0; i <= 40; i++) { if (isRealMaul(inv.getItem(i))) return i }
  } catch (e) { }
  return -1
}
function inMainHand(p) { return bool(() => isRealMaul(p.mainHandItem)) }
function onCursor(p) { return bool(() => isRealMaul(p.containerMenu.getCarried())) }
function hasMaul(p) { return maulSlot(p) >= 0 || onCursor(p) }
function windowOpen(p) {
  try { if (typeof p.hasContainerOpen == 'function') return !!p.hasContainerOpen() } catch (e) { }
  try { return !sameRef(p.containerMenu, p.inventoryMenu) } catch (e) { return false }
}
function heldLevel(p) { const a = maulData(p.mainHandItem); return a ? levelFor(a.grit) : 0 }

// Adds Grit to the Maul this player carries. Below Level X the pickaxe is rebuilt (its wear kept); reaching Level X
// turns it into the Vein Hammer; at Level X only the count grows (the hammer, and anything Tinkers did to it, stays).
function addGrit(p, n) {
  n = Math.floor(n)
  if (!(n > 0)) return
  const slot = maulSlot(p)
  if (slot < 0) return
  const inv = p.inventory, stack = inv.getItem(slot), a = maulData(stack), D = db()
  const before = levelFor(a.grit)
  if (before >= LEVELS.length) { D.grit = Math.max(D.grit, a.grit) + n; save(); return }
  const grit = a.grit + n, after = levelFor(grit)
  inv.setItem(slot, makeMaul(a.serial, grit, damageOf(stack)))
  D.grit = grit
  save()
  if (after > before) levelUp(p, after)
}
function levelUp(p, level) {
  const server = p.server || Utils.server
  const unlocked = ABILITIES.filter(a => a.level == level && a.level > 1)
  let text = NAME + ' has reached Level ' + roman(level) + ' in the hands of ' + nameOf(p) + '.'
  if (unlocked.length) text += ' It has learned ' + unlocked.map(a => a.name).join(' and ') + '.'
  if (LEVELS[level - 1].hammer) text += ' The pick is reforged: it is a Vein Hammer now.'
  tellAll(server, voice(text, level >= 10 ? 'dark_aqua' : 'aqua'))
  soundAt(server, p, 'minecraft:block.anvil.use', 1, 0.6)
  const q = pos(p)
  run(server, 'execute in ' + dimOf(p) + ' run particle minecraft:lava ' + num(q.x) + ' ' + num(q.y + 1) + ' ' + num(q.z) + ' 0.5 0.8 0.5 0.1 30')
  console.info('[Maul] ' + nameOf(p) + ': Level ' + level)
}

// ===================== MINING: GRIT, PROSPECTOR, FORGE-TOUCHED =====================

function isOre(block) { try { return !!block.hasTag('forge:ores') } catch (e) { return false } }
function markerKey(d, x, y, z) { return d + '|' + x + '|' + y + '|' + z }
// A marker: a small glowing copy of the ore in the middle of its block. Inside the ore it can't be seen; its outline
// shows through walls. It never covers anything around it.
function markerSnbt(id, tagName) {
  const s = r3(MARKER_SIZE), t = r3((1 - MARKER_SIZE) / 2)
  return '{block_state:{Name:"' + id + '"},Glowing:1b,glow_color_override:' + PROSPECT_COLOR + ',brightness:{sky:15,block:15},' +
    'Tags:["maul_glow","' + tagName + '"],transformation:{left_rotation:[0f,0f,0f,1f],right_rotation:[0f,0f,0f,1f],' +
    'translation:[' + t + 'f,' + t + 'f,' + t + 'f],scale:[' + s + 'f,' + s + 'f,' + s + 'f]}}'
}
function dropMarker(server, key) {
  const m = S.markers[key]
  if (!m) return
  delete S.markers[key]
  run(server, 'kill @e[type=minecraft:block_display,tag=' + m.tag + ']')
}
function clearMarkers(server) { Object.keys(S.markers).forEach(k => dropMarker(server, k)) }
// Every few ticks while there are markers: drop those whose time is up or whose ore is gone (mined by anyone, by
// a vein-mining hammer, blown up).
function tendMarkers(server) {
  const now = Date.now()
  Object.keys(S.markers).forEach(k => {
    const m = S.markers[k]
    let gone = now >= m.until
    if (!gone) { try { gone = String(m.lv.getBlock(m.x, m.y, m.z).id) != m.id } catch (e) { gone = true } }
    if (gone) dropMarker(server, k)
  })
}
function tendLoop(server) {
  if (S.markerLoop) return
  S.markerLoop = true
  const step = () => {
    try { tendMarkers(server) } catch (e) { console.error('[Maul] Markers: ' + e) }
    if (Object.keys(S.markers).length) server.scheduleInTicks(MARKER_CHECK_TICKS, step)
    else S.markerLoop = false
  }
  server.scheduleInTicks(MARKER_CHECK_TICKS, step)
}
function prospectorOn(p) { return !db().prospectOff[uuidOf(p)] }
// Marks the ore within the level's radius of the mined block, nearest first, for PROSPECT_SECONDS. Ore that's
// already marked keeps its marker (and its time is renewed).
function prospect(server, p, block, level) {
  const u = uuidOf(p), now = Date.now()
  if (!prospectorOn(p)) return 0
  if (S.prospectAt[u] && now - S.prospectAt[u] < PROSPECT_COOLDOWN_MS) return 0
  S.prospectAt[u] = now
  const lv = block.level, d = dimOf(p), r = prospectRadius(level), until = now + PROSPECT_SECONDS * 1000
  const x0 = Number(block.x), y0 = Number(block.y), z0 = Number(block.z)
  const found = []
  for (let dx = -r; dx <= r; dx++) for (let dy = -r; dy <= r; dy++) for (let dz = -r; dz <= r; dz++) {
    if (!dx && !dy && !dz) continue
    let b = lv.getBlock(x0 + dx, y0 + dy, z0 + dz)
    if (isOre(b)) found.push({ x: x0 + dx, y: y0 + dy, z: z0 + dz, id: String(b.id), d: dx * dx + dy * dy + dz * dz })
  }
  if (!found.length) return 0
  found.sort((a, b) => a.d - b.d)
  let n = 0
  found.forEach(o => {
    const key = markerKey(d, o.x, o.y, o.z), m = S.markers[key]
    if (m) { m.until = until; n++; return }
    if (Object.keys(S.markers).length >= PROSPECT_MAX) return
    const tagName = 'maul_m' + (++S.markerSeq)
    // Decimal coordinates: /summon centres whole ones on the block (x + 0.5, z + 0.5), which would put the marker
    // half a block off, across four blocks.
    run(server, 'execute in ' + d + ' run summon minecraft:block_display ' + num(o.x) + ' ' + num(o.y) + ' ' + num(o.z) + ' ' + markerSnbt(o.id, tagName))
    S.markers[key] = { tag: tagName, until: until, lv: lv, id: o.id, x: o.x, y: o.y, z: o.z }
    n++
  })
  if (n) tendLoop(server)
  return n
}

// Forge-touched: what a furnace makes of an item, by id: { id, count, xp }, or null. Looked up once per item.
function smeltingOf(server, lv, stack) {
  const id = String(stack.id)
  if (Object.prototype.hasOwnProperty.call(S.smeltCache, id)) return S.smeltCache[id]
  let out = null
  try {
    let box = new SimpleContainer(1)
    box.setItem(0, stack.copy())
    let found = server.getRecipeManager().getRecipeFor(RecipeType.SMELTING, box, lv)
    if (found.isPresent()) {
      let r = found.get(), res = r.getResultItem(lv.registryAccess())
      if (res && !res.isEmpty()) out = { id: String(res.id), count: Number(res.count) || 1, xp: Number(r.getExperience()) || 0 }
    }
  } catch (e) {
    console.warn('[Maul] Forge-touched: ' + e)
    return null
  }
  S.smeltCache[id] = out
  return out
}
// The ore is about to break: its drops (spawned this tick, inside it) are smelted as they appear (EntityEvents.spawned
// below). A tick later: sparks, a hiss and the furnace's experience, if anything was smelted.
function smeltZone(server, p, b) {
  const zone = { dim: dimOf(p), x: Number(b.x), y: Number(b.y), z: Number(b.z), xp: 0, n: 0 }
  S.smeltZones.push(zone)
  server.scheduleInTicks(1, () => {
    S.smeltZones = S.smeltZones.filter(z => z !== zone)
    if (!zone.n) return
    const xyz = num(zone.x + 0.5) + ' ' + num(zone.y + 0.5) + ' ' + num(zone.z + 0.5)
    run(server, 'execute in ' + zone.dim + ' run particle minecraft:lava ' + xyz + ' 0.2 0.2 0.2 0 3')
    run(server, 'execute in ' + zone.dim + ' run playsound minecraft:block.fire.extinguish block @a ' + xyz + ' 0.3 1.6')
    let xp = Math.floor(zone.xp)
    if (Math.random() < zone.xp - xp) xp++
    if (xp > 0) { try { p.giveExperiencePoints(xp) } catch (e) { } }
  })
}
function inZone(z, d, at) {
  return z.dim == d && at.x >= z.x - 0.5 && at.x <= z.x + 1.5 && at.y >= z.y - 0.5 && at.y <= z.y + 1.5 && at.z >= z.z - 0.5 && at.z <= z.z + 1.5
}
EntityEvents.spawned(event => {
  if (!S.smeltZones.length) return
  const e = event.entity
  if (typeOf(e) != 'minecraft:item') return
  const at = pos(e), d = dimOf(e)
  const zone = S.smeltZones.filter(z => inZone(z, d, at))[0]
  if (!zone) return
  const st = e.getItem(), out = smeltingOf(event.server || Utils.server, levelOf(e), st)
  if (!out) return
  const n = Number(st.count) || 1
  e.setItem(Item.of(out.id, out.count * n))
  zone.xp += out.xp * n
  zone.n += n
})

BlockEvents.broken(event => {
  const p = event.player, b = event.block
  if (!isPlayer(p)) return
  const server = event.server || Utils.server
  if (Object.keys(S.markers).length) {
    let key = markerKey(dimOf(p), Number(b.x), Number(b.y), Number(b.z))
    if (S.markers[key]) dropMarker(server, key)     // a marked ore is mined (by anyone): its marker goes at once
  }
  if (!inMainHand(p) || !isOre(b)) return
  const level = heldLevel(p), id = String(b.id), lv = b.level, x = Number(b.x), y = Number(b.y), z = Number(b.z)
  if (has(level, 'forge')) smeltZone(server, p, b)
  // Grit and Prospector a tick later, once the ore has really gone. A break that something cancelled after this
  // (a protected area, a claim) earns nothing, so nobody can farm Grit off an ore they can't break.
  server.scheduleInTicks(1, () => {
    try {
      if (String(lv.getBlock(x, y, z).id) == id) return
      if (has(level, 'prospector')) prospect(server, p, b, level)
      db().stats.ores++
      addGrit(p, GRIT_RARE_ORES[id] != null ? GRIT_RARE_ORES[id] : GRIT_ORE)
    } catch (e) { console.error('[Maul] Mining: ' + e) }
  })
})

// Sneak + right-click with the Maul (at a block or the air): Prospector off, or back on, for this player.
function sneaking(p) { return bool(() => p.isShiftKeyDown()) }
function offHand(event) { try { return String(event.hand) == 'OFF_HAND' } catch (e) { return false } }
function toggleProspector(event) {
  const p = event.player
  if (!isPlayer(p) || offHand(event) || !sneaking(p) || !inMainHand(p)) return
  const u = uuidOf(p), now = Date.now(), last = S.toggledAt[u]
  S.toggledAt[u] = now
  if (last && now - last < TOGGLE_GAP_MS) return     // the same press: a block and the air, or a held button
  const server = event.server || Utils.server, D = db(), off = !D.prospectOff[u]
  if (off) D.prospectOff[u] = 1
  else delete D.prospectOff[u]
  save()
  if (off) clearMarkers(server)
  tell(p, voice(off ? 'Prospector off. Sneak and right-click again to turn it on.' : 'Prospector on: mining ore marks the ore around it.', off ? 'gray' : 'aqua'))
  soundAt(server, p, 'minecraft:block.note_block.chime', 0.6, off ? 0.7 : 1.4)
}
ItemEvents.rightClicked(event => toggleProspector(event))
BlockEvents.rightClicked(event => toggleProspector(event))

// ===================== FINDING IT =====================

// A new Maul (serial + 1, Level I). holder: the player it's forged for, or null when it's waiting in a chest.
function forge(holder) {
  const D = db()
  D.serial++
  D.grit = 0
  D.holder = holder ? uuidOf(holder) : ''
  D.holderName = holder ? nameOf(holder) : ''
  D.loose = false
  save()
  return makeMaul(D.serial, 0, 0)
}
function lootTableOf(block) {
  try {
    let nbt = block.entityData
    if (nbt != null && nbt.contains('LootTable')) return String(nbt.getString('LootTable'))
  } catch (e) { }
  return ''
}
// Puts the stack in the first empty slot. Returns false if the container is full (or isn't one).
function placeIn(container, stack) {
  try {
    let size = container.getContainerSize()
    for (let i = 0; i < size; i++) {
      if (container.getItem(i).isEmpty()) {
        container.setItem(i, stack)
        try { container.setChanged() } catch (e) { }
        return true
      }
    }
  } catch (e) { }
  return false
}
// FINDER opens a fresh loot container: noted on the right-click while it still has its loot table, then rolled a
// couple of ticks later, once it has opened and its own loot is in (the same method as part2/dragon_hoard.js).
BlockEvents.rightClicked(event => {
  const p = event.player, b = event.block
  if (!FINDER || !isPlayer(p) || nameOf(p).toLowerCase() != FINDER.toLowerCase() || db().serial) return
  if (!lootTableOf(b)) return
  const x = Number(b.x), y = Number(b.y), z = Number(b.z), key = x + '|' + y + '|' + z
  if (S.chests[key]) return
  S.chests[key] = true
  const level = b.level, server = event.server || Utils.server
  server.scheduleInTicks(2, () => {
    delete S.chests[key]
    try {
      let block = level.getBlock(x, y, z)
      if (lootTableOf(block) || db().serial) return          // it didn't open, or the Maul exists by now
      if (Math.random() >= FIND_CHANCE) return
      let st = forge(null)
      if (placeIn(block.entity, st)) tell(p, voice('Under the loot lies something old and heavy, waiting for you.', 'gold'))
      else {
        p.give(st)
        tell(p, voice('Something old and heavy was wedged in the chest. It is yours now.', 'gold'))
      }
      console.info('[Maul] ' + nameOf(p) + ' found ' + NAME + ' (serial ' + db().serial + ') in a chest at ' + x + ' ' + y + ' ' + z)
    } catch (e) { console.error('[Maul] Chest: ' + e) }
  })
})

// ===================== THE GRUDGE LEDGER =====================

function onLedger(u) {
  const g = db().grudges[u]
  if (!g) return false
  if (Date.now() - g.since > GRUDGE_DAYS * 86400000) { delete db().grudges[u]; save(); return false }
  return true
}
// A player hurt the Maul's holder: on the ledger (or the grudge renewed). Checked a tick later, so a hit the Purge's
// sanctuary or protection cancelled (no hurtTime) doesn't count.
function noteWrong(server, holder, offender) {
  let hurt = 0
  try { hurt = Number(holder.hurtTime) || 0 } catch (e) { }
  if (!(hurt > 0) || !hasMaul(holder)) return
  const D = db(), u = uuidOf(offender), fresh = !D.grudges[u]
  D.grudges[u] = { name: nameOf(offender), since: Date.now(), against: nameOf(holder) }
  save()
  if (fresh) tell(holder, voice(nameOf(offender) + ' is written in the ledger. The Maul will remember.', 'gray'))
}

// ===================== KILLS =====================

function isShadowClone(e) {
  try { if (typeof e.isShadowClone == 'function') return !!e.isShadowClone() } catch (err) { }
  try { return !!e.getNbt().getBoolean('ShadowClone') } catch (err) { }
  return false
}
function isHostile(e) {
  try { return String(e.getType().getCategory()).toLowerCase().indexOf('monster') >= 0 } catch (err) { }
  try { return !!e.isMonster() } catch (err) { return false }
}
// Iron Blood: absorption for a kill, up to the cap (absorption from anything else counts towards it). What it gave
// fades IRON_SECONDS after the last kill.
function ironBlood(server, p) {
  const u = uuidOf(p), cap = IRON_MAX_HEARTS * 2
  let cur = 0
  try { cur = Number(p.getAbsorptionAmount()) || 0 } catch (e) { return 0 }
  const s = S.iron[u] || { given: 0, until: 0 }
  S.iron[u] = s
  s.until = Date.now() + IRON_SECONDS * 1000
  const add = Math.min(IRON_HEARTS * 2, cap - cur)
  if (add > 0) {
    p.setAbsorptionAmount(cur + add)
    s.given += add
    soundAt(server, p, 'minecraft:item.armor.equip_iron', 0.8, 0.8)
  }
  if (s.given > 0) server.scheduleInTicks(IRON_SECONDS * 20 + 2, () => ironFade(p, u))
  else delete S.iron[u]
  return add > 0 ? add : 0
}
function ironFade(p, u) {
  const s = S.iron[u]
  if (!s || Date.now() < s.until) return
  delete S.iron[u]
  try { p.setAbsorptionAmount(Math.max(0, (Number(p.getAbsorptionAmount()) || 0) - s.given)) } catch (e) { }
}
EntityEvents.death(event => {
  const e = event.entity, killer = attackerOf(event.source)
  if (!isPlayer(killer) || sameEntity(killer, e) || !inMainHand(killer)) return
  const server = event.server || Utils.server, id = typeOf(e), D = db()
  let grit = 0
  if (isPlayer(e)) {
    grit = GRIT_PLAYER
    D.stats.players++
    if (onLedger(uuidOf(e))) {
      delete D.grudges[uuidOf(e)]
      D.stats.settled++
      grit += GRIT_GRUDGE
      tellAll(server, voice('A grudge is settled. ' + nameOf(e) + ' has paid ' + nameOf(killer) + ' in full.', 'gold'))
    }
  } else if (BOSS_GRIT[id] != null) {
    if (id == 'twilightforest:lich' && isShadowClone(e)) return
    grit = BOSS_GRIT[id]
    D.stats.bosses++
  } else grit = isHostile(e) ? GRIT_HOSTILE : GRIT_OTHER
  D.stats.kills++
  const level = heldLevel(killer)
  addGrit(killer, grit)
  if (has(level, 'ironblood') && (isPlayer(e) || BOSS_GRIT[id] != null || isHostile(e))) ironBlood(server, killer)
})

// ===================== HITS: EARTHSHAKER =====================

function critInfo(p) {
  let ground = null, fall = 0, vy = 0
  try { ground = !!p.onGround() } catch (e) { try { ground = !!p.onGround } catch (e2) { } }
  try { fall = Number(p.fallDistance) || 0 } catch (e) { }
  try {
    let v = p.getDeltaMovement()
    vy = Number(typeof v.y == 'function' ? v.y() : v.y) || 0
  } catch (e) { }
  return { ground: ground, fall: fall, vy: vy, water: bool(() => p.isInWater()), riding: bool(() => p.isPassenger()) }
}
function fallingNow(c) { return c.ground !== true && !c.water && !c.riding && (c.fall > 0 || c.vy < -0.05) }
function isCrit(p) {
  const c = critInfo(p)
  if (c.water || c.riding) return false
  if (fallingNow(c)) return true
  const t = S.falling[uuidOf(p)]
  return !!t && Date.now() - t <= CRIT_GRACE_MS
}
// The sky light stored at a block (0-15), the same by day and night; 0 where there's no sky (the Nether). KubeJS's
// block.skyLight takes the night's darkening off (open ground reads 4 at night), so it's read from the level, or
// the darkening is added back.
function skyLightAt(lv, x, y, z) {
  try { if (LightLayer && BlockPos) return Number(lv.getBrightness(LightLayer.SKY, new BlockPos(x, y, z))) } catch (e) { }
  try { return Number(lv.getBlock(x, y, z).skyLight) + Number(lv.getSkyDarken()) } catch (e) { }
  return NaN
}
// Deepborn: where daylight doesn't reach (the sky light at the head).
function underground(p) {
  const q = pos(p), lv = levelOf(p), x = Math.floor(q.x), y = Math.floor(q.y + 1.5), z = Math.floor(q.z)
  const sky = skyLightAt(lv, x, y, z)
  if (!isNaN(sky)) return sky <= DEEP_MAX_SKYLIGHT
  try { return !lv.getBlock(x, y, z).canSeeSky } catch (e) { return false }
}
// Whether this player's effect (night_vision, haste) is one Deepborn gave: no longer than Deepborn gives it for. A
// potion with a minute left is left alone.
function deepbornEffect(p, id) {
  try {
    let it = p.getActiveEffects().iterator()
    while (it.hasNext()) {
      let fx = it.next()
      if (String(fx.getEffect().getDescriptionId()) == 'effect.minecraft.' + id) return Number(fx.getDuration()) <= (DEEP_SECONDS + 1) * 20
    }
  } catch (e) { }
  return false
}
// Once a second for the holder: Night Vision and Haste while it applies; once it hasn't for DEEP_GRACE_SECONDS, the
// effects it gave are taken away.
function deepborn(server, p) {
  const u = uuidOf(p), level = inMainHand(p) ? heldLevel(p) : 0
  if (level && has(level, 'deepborn') && underground(p)) {
    run(server, 'effect give ' + u + ' minecraft:night_vision ' + DEEP_SECONDS + ' 0 true')
    run(server, 'effect give ' + u + ' minecraft:haste ' + DEEP_SECONDS + ' ' + (level >= DEEP_HASTE2_LEVEL ? 1 : 0) + ' true')
    S.deep[u] = { misses: 0 }
    return true
  }
  const s = S.deep[u]
  if (!s) return false
  s.misses++
  if (s.misses < DEEP_GRACE_SECONDS) return false
  delete S.deep[u]
  const effects = ['night_vision', 'haste']
  effects.forEach(id => { if (deepbornEffect(p, id)) run(server, 'effect clear ' + u + ' minecraft:' + id) })
  return false
}
// Each tick, note when the Maul's holder is falling (only the holder is checked); once a second, Deepborn.
PlayerEvents.tick(event => {
  const p = event.player, D = db()
  if (!D.serial || !D.holder) return
  let u = ''
  try { u = uuidOf(p) } catch (e) { return }
  if (u != D.holder) return
  if (fallingNow(critInfo(p)) && inMainHand(p)) S.falling[u] = Date.now()
  const now = Date.now()
  if (S.deepAt[u] && now - S.deepAt[u] < 1000) return
  S.deepAt[u] = now
  deepborn(event.server || Utils.server, p)
})
function earthshaker(server, p, victim, level) {
  const u = uuidOf(p), now = Date.now()
  if (S.shakeCooldown[u] && now < S.shakeCooldown[u]) return 0
  S.shakeCooldown[u] = now + SHAKE_COOLDOWN_MS
  const r = shakeRadius(level), d = dimOf(p), at = pos(p), dmg = LEVELS[level - 1].damage * SHAKE_SHARE
  const caught = list(server.entities).filter(o => {
    if (sameEntity(o, p)) return false
    if (isPlayer(o) && !SHAKE_HITS_PLAYERS) return false
    try { if (!o.isLiving() || !o.isAlive()) return false } catch (err) { return false }
    return dimOf(o) == d && dist(pos(o), at) <= r
  })
  S.shaking = true
  try {
    caught.forEach(o => {
      if (!sameEntity(o, victim)) run(server, 'damage ' + uuidOf(o) + ' ' + num(dmg) + ' minecraft:player_attack by ' + nameOf(p))
      run(server, 'effect give ' + uuidOf(o) + ' minecraft:slowness ' + SHAKE_SLOW_SECONDS + ' 1 true')
    })
  } finally { S.shaking = false }
  const xyz = num(at.x) + ' ' + num(at.y + 0.1) + ' ' + num(at.z)
  run(server, 'execute in ' + d + ' run particle minecraft:block minecraft:stone ' + xyz + ' ' + r + ' 0.2 ' + r + ' 0.15 120 force')
  run(server, 'execute in ' + d + ' run playsound minecraft:entity.generic.explode player @a ' + xyz + ' 0.7 0.6')
  run(server, 'execute in ' + d + ' run playsound minecraft:block.anvil.land player @a ' + xyz + ' 0.8 0.5')
  return caught.length
}
EntityEvents.hurt(event => {
  const victim = event.entity, server = event.server || Utils.server
  const p = attackerOf(event.source)
  if (!isPlayer(p) || sameEntity(p, victim)) return
  // Someone hurt the Maul's holder: the ledger (a tick later, once the hit has landed).
  if (isPlayer(victim) && db().holder == uuidOf(victim)) server.scheduleInTicks(1, () => noteWrong(server, victim, p))
  if (S.shaking || !inMainHand(p)) return
  const direct = directOf(event.source)
  if (direct && !sameEntity(direct, p)) return          // arrows and other projectiles aren't melee hits
  const level = heldLevel(p)
  if (has(level, 'earthshaker') && isCrit(p)) earthshaker(server, p, victim, level)
})

// ===================== WHITE-HOT AND THE GRUDGE BONUS (the damage hook) =====================
// startup_scripts/deepdelver_maul_hooks.js calls these for every hit: noteHit on Forge's LivingHurtEvent (the damage
// before armour), finalDamage on LivingDamageEvent (after armour, protection, resistance and absorption), which
// returns the new damage, or null to leave it alone.

function noteHit(victim, source, amount) {
  const p = attackerOf(source)
  if (!isPlayer(p) || sameEntity(p, victim) || !inMainHand(p)) return
  S.pending[uuidOf(victim)] = { by: uuidOf(p), amount: Number(amount) || 0, t: Date.now(), level: heldLevel(p) }
}
function finalDamage(victim, source, after) {
  const u = uuidOf(victim), h = S.pending[u]
  if (!h) return null
  delete S.pending[u]
  const p = attackerOf(source)
  if (!isPlayer(p) || uuidOf(p) != h.by || Date.now() - h.t > 1000) return null
  let out = Number(after) || 0
  if (has(h.level, 'whitehot')) out += Math.max(0, h.amount - out) * whiteHot(h.level) / 100
  if (has(h.level, 'grudge') && isPlayer(victim) && onLedger(u)) out *= 1 + grudgeBonus(h.level) / 100
  return out
}

// ===================== WHO HOLDS IT =====================

function scan(server) {
  const D = db()
  if (!Object.keys(S.markers).length) run(server, 'kill @e[type=minecraft:block_display,tag=maul_glow]')   // leftovers from before a restart or /reload
  if (!D.serial) return
  if (purgeKitActive()) { S.misses = 0; return }     // a kit Purge locks it in its holder's vault: it isn't loose
  const players = list(server.players)
  const holder = players.filter(p => hasMaul(p))[0] || null
  if (holder) {
    let u = uuidOf(holder)
    if (u != D.holder) {
      let prev = D.holderName
      D.holder = u
      D.holderName = nameOf(holder)
      D.loose = false
      save()
      let slot = maulSlot(holder)
      let lv = slot >= 0 ? levelFor(maulData(holder.inventory.getItem(slot)).grit) : levelFor(D.grit)
      tellAll(server, voice(nameOf(holder) + ' has claimed ' + NAME + ' (Level ' + roman(lv) + ')!' + (prev && prev != nameOf(holder) ? ' ' + prev + ' has lost it.' : ''), 'gold'))
      console.info('[Maul] Now held by ' + nameOf(holder))
    } else if (D.loose) { D.loose = false; save() }
    S.misses = 0
    return
  }
  const last = players.filter(p => uuidOf(p) == D.holder)[0]
  if (!last || D.loose) return
  if (windowOpen(last)) { S.misses = 0; return }
  S.misses = (S.misses || 0) + 1
  if (S.misses >= LOOSE_AFTER_SCANS) {
    D.loose = true
    save()
    tellAll(server, voice(NAME + ' is loose. ' + D.holderName + ' no longer has it. Open for grabs.', 'red'))
    console.info('[Maul] Loose (last held by ' + D.holderName + ')')
  }
}
function purgeKitActive() {
  try { return !!(global.Purge && global.Purge.kitActive()) } catch (e) { return false }
}
function startLoop(server) {
  const token = ++S.loopToken
  const tick = () => {
    if (token != S.loopToken) return
    try { scan(server) } catch (e) { console.error('[Maul] Scan: ' + e) }
    server.scheduleInTicks(SCAN_TICKS, tick)
  }
  server.scheduleInTicks(SCAN_TICKS, tick)
}
ServerEvents.loaded(event => startLoop(event.server))
try { if (Utils.server) startLoop(Utils.server) } catch (e) { }   // after /reload

// ===================== COMMANDS =====================

function playerByName(server, name) {
  return list(server.players).filter(p => nameOf(p).toLowerCase() == String(name).toLowerCase())[0] || null
}
function ago(ms) {
  const h = Math.floor(ms / 3600000)
  return h >= 24 ? Math.floor(h / 24) + ' d ago' : h >= 1 ? h + ' h ago' : Math.max(1, Math.floor(ms / 60000)) + ' min ago'
}

ServerEvents.commandRegistry(event => {
  const Commands = event.commands, Arguments = event.arguments
  const reply = (ctx, text, bad) => { ctx.source.sendSystemMessage(comp(voice(text, bad ? 'red' : 'aqua'))); return bad ? 0 : 1 }
  const safe = fn => ctx => { try { return fn(ctx) } catch (e) { console.error('[Maul] ' + e); return reply(ctx, 'Error: ' + e, true) } }
  const op = src => src.hasPermission(2)
  const int = name => Commands.argument(name, Arguments.INTEGER.create(event))
  const numArg = (ctx, name) => Number(Arguments.INTEGER.getResult(ctx, name))
  const str = (ctx, name) => String(StringArg.getString(ctx, name))
  const info = ctx => {
    const D = db()
    if (!D.serial) return reply(ctx, NAME + ' has not been forged yet.')
    const lv = levelFor(D.grit)
    const next = lv < LEVELS.length ? ' Next level at ' + fmt(LEVELS[lv].grit) + ' Grit.' : ' It is at its peak.'
    const abilities = ABILITIES.filter(a => lv >= a.level).map(a => a.name).join(', ')
    return reply(ctx, 'Level ' + roman(lv) + ', ' + fmt(D.grit) + ' Grit.' + next + ' Abilities: ' + abilities + '. ' +
      (D.loose ? 'It is loose: open for grabs.' : D.holderName ? 'Held by ' + D.holderName + '.' : ''))
  }
  // The ledger: for whoever holds the Maul, and ops.
  const grudges = ctx => {
    const p = ctx.source.getPlayer(), D = db()
    if (p && !hasMaul(p) && !ctx.source.hasPermission(2)) return reply(ctx, 'Only the Maul\'s holder can read its ledger.', true)
    const open = Object.keys(D.grudges).filter(u => onLedger(u))
    if (!open.length) return reply(ctx, 'The ledger is clean. No grudges are owed.')
    reply(ctx, 'The ledger (' + open.length + ' open, +' + grudgeBonus(levelFor(D.grit)) + '% against each):')
    open.forEach(u => reply(ctx, '  ' + D.grudges[u].name + ': wronged ' + (D.grudges[u].against || 'the holder') + ', ' + ago(Date.now() - D.grudges[u].since)))
    return 1
  }
  const forgive = ctx => {
    const p = ctx.source.getPlayer(), D = db(), name = str(ctx, 'player').toLowerCase()
    if (p && !hasMaul(p) && !ctx.source.hasPermission(2)) return reply(ctx, 'Only the Maul\'s holder can forgive.', true)
    const u = Object.keys(D.grudges).filter(k => String(D.grudges[k].name).toLowerCase() == name)[0]
    if (!u) return reply(ctx, 'Nobody called ' + str(ctx, 'player') + ' is on the ledger.', true)
    const who = D.grudges[u].name
    delete D.grudges[u]
    save()
    return reply(ctx, who + ' is struck from the ledger. Forgiven, if not forgotten.')
  }
  const give = (ctx, force) => {
    const D = db(), p = playerByName(ctx.source.server, str(ctx, 'player'))
    if (!p) return reply(ctx, 'Nobody called ' + str(ctx, 'player') + ' is online.', true)
    if (D.serial && !force) return reply(ctx, NAME + ' already exists (held by ' + (D.holderName || 'nobody') + '). Use /maul give <player> force to forge a new one; the old one becomes an ordinary tool.', true)
    p.give(forge(p))
    console.info('[Maul] Forged (serial ' + D.serial + ') for ' + nameOf(p))
    return reply(ctx, 'Forged ' + NAME + ' for ' + nameOf(p) + ' at Level I.')
  }
  const setGrit = ctx => {
    const p = ctx.source.getPlayer()
    if (!p || !inMainHand(p)) return reply(ctx, 'Hold ' + NAME + ' in your main hand.', true)
    const n = Math.max(0, numArg(ctx, 'grit'))
    const slot = maulSlot(p), stack = p.inventory.getItem(slot), a = maulData(stack)
    const before = levelFor(a.grit)
    p.inventory.setItem(slot, makeMaul(a.serial, n, damageOf(stack)))
    db().grit = n
    save()
    if (levelFor(n) > before) levelUp(p, levelFor(n))
    return reply(ctx, 'Grit set to ' + n + ' (Level ' + roman(levelFor(n)) + ').')
  }
  event.register(Commands.literal('maul')
    .executes(safe(info))
    .then(Commands.literal('grudges').executes(safe(grudges)))
    .then(Commands.literal('forgive').then(Commands.argument('player', StringArg.word()).executes(safe(forgive))))
    .then(Commands.literal('give').requires(op).then(Commands.argument('player', StringArg.word())
      .executes(safe(ctx => give(ctx, false)))
      .then(Commands.literal('force').executes(safe(ctx => give(ctx, true))))))
    .then(Commands.literal('setgrit').requires(op).then(int('grit').executes(safe(setGrit))))
    .then(Commands.literal('stats').requires(op).executes(safe(ctx => {
      const D = db(), s = D.stats
      return reply(ctx, 'Serial ' + D.serial + ', held by ' + (D.holderName || 'nobody') + (D.loose ? ' (loose)' : '') + '. Kills ' + s.kills +
        ' (players ' + s.players + ', bosses ' + s.bosses + '), ore ' + s.ores + ', grudges settled ' + s.settled + '.')
    }))))
})

// ===================== API =====================

global.DeepdelverMaul = {
  levels: LEVELS,
  abilities: ABILITIES,
  levelFor: g => levelFor(Number(g)),
  whiteHot: l => whiteHot(Number(l)),
  grudgeBonus: l => grudgeBonus(Number(l)),
  isRealMaul: stack => isRealMaul(stack),
  onLedger: u => onLedger(String(u).toLowerCase()),
  state: () => JSON.parse(JSON.stringify(db())),
  // What the Maul looks like at a Grit total, as a void copy (serial 0: never the real one). For checking builds.
  preview: g => makeMaul(0, Number(g) || 0, 0),
  // Forge-touched's lookup: what a furnace makes of this stack, { id, count, xp } or null.
  smelting: stack => smeltingOf(Utils.server, Utils.server.overworld(), stack),
  prospectorOn: u => !db().prospectOff[String(u).toLowerCase()],
  markers: () => Object.keys(S.markers).length,
  // For startup_scripts/deepdelver_maul_hooks.js:
  noteHit: (victim, source, amount) => noteHit(victim, source, amount),
  finalDamage: (victim, source, after) => finalDamage(victim, source, after),
}

})()
