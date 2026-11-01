// Part II: the Blood Pool tank. A tower in the world that fills with blood as the Blood Pool's tiers open
// (see tools/kubejs/BLOOD_POOL.md, "The tank").
//
//  - The tower: 5x5, 8 tall. Floor and roof of chiseled nether bricks; nether gold ore corner columns; glass sides;
//    a 3x3x6 chamber inside. One layer of the chamber fills with blood for every 2 tiers opened (full at Tier 12).
//  - /bloodtank build <pos> builds one with its floor centred on <pos>; /bloodtank add <pos> registers one built
//    by hand (pos = the floor's centre block). Several tanks are allowed.
//  - The fill follows the tier: when a tier opens (blood_pool.js calls global.BloodTank.sync) and, for tanks that
//    were unloaded then, every LOOP_SECONDS while a player is near. Non-ops can't break or place blocks in a tank.
//
// Commands (op): /bloodtank build|add <pos>, list, remove <n>, refill.
// Part II only. Needs part2/blood_pool.js. KubeJS 6 notes: no template strings; `let` inside nested blocks;
// event.cancel() last.

(function () {

// ===================== SETTINGS =====================

const TIERS_PER_LAYER = 2                 // one layer of blood for every this many tiers opened
const BLOOD_BLOCK = 'evilcraft:blood'     // EvilCraft's blood; if it can't be placed, BLOOD_FALLBACK is used
const BLOOD_FALLBACK = 'minecraft:red_stained_glass'
const FLOOR_BLOCK = 'minecraft:chiseled_nether_bricks'
const ROOF_BLOCK = 'minecraft:chiseled_nether_bricks'
const CORNER_BLOCK = 'minecraft:nether_gold_ore'
const SIDE_BLOCK = 'minecraft:glass'
const LOOP_SECONDS = 10                   // how often loaded tanks are checked against the tier
const NEAR = 48                           // a tank counts as loaded while a player in its dimension is this close
const PROTECT = true                      // non-ops can't break or place blocks in a tank
const PROTECT_MSG = 'The Blood Pool is Ministry evidence. Do not touch the evidence.'
const RISE_SOUND = 'minecraft:block.bubble_column.upwards_ambient'
const RISE_SOUND_2 = 'minecraft:item.bucket.fill_lava'

// Geometry, relative to the floor's centre block: x/z from -2 to 2, y from 0 (floor) to 7 (roof).
const HEIGHT = 8
const LAYERS = 6                          // chamber layers: y = 1 .. 6


// ===================== HELPERS =====================

const DATA_KEY = 'blood_tank'
let Serializer = null
try { Serializer = Java.loadClass('net.minecraft.network.chat.Component$Serializer') } catch (e) { }

function onlinePlayers(server) {
  const list = server.players, out = []
  for (let i = 0; i < list.size(); i++) out.push(list.get(i))
  return out
}
function isOp(p) { try { return p.hasPermissions(2) } catch (e) { return false } }
function dimId(level) {
  let d = level.dimension
  if (typeof d == 'function') d = level.dimension()
  if (d != null && typeof d.location == 'function') d = d.location()
  return String(d)
}
function tell(p, text) {
  const json = JSON.stringify(['', { text: '[Blood Pool]', color: 'dark_red', bold: true }, { text: ' ' + text, color: 'gray' }])
  try { p.tell(Serializer ? Serializer.fromJsonLenient(json) : Text.of('[Blood Pool] ' + text)) } catch (e) { }
}
function run(server, c) {
  try { return Number(server.runCommandSilent(c)) || 0 } catch (e) { console.warn('[BloodTank] ' + c + ': ' + e); return 0 }
}
function tier() { const B = global.BloodPool; try { return B ? Number(B.tier()) : 0 } catch (e) { return 0 } }
function targetLayers() { return Math.max(0, Math.min(LAYERS, Math.floor(tier() / TIERS_PER_LAYER))) }


// ===================== SAVED DATA =====================
// server.persistentData['blood_tank'] = JSON { v, tanks: [ { dim, x, y, z, layers } ] }   (x y z = floor centre)

let DB = null
function db() {
  if (DB) return DB
  let raw = ''
  try { raw = String(Utils.server.persistentData.getString(DATA_KEY) || '') } catch (e) { }
  let parsed = null
  if (raw) {
    try { parsed = JSON.parse(raw) } catch (e) {
      try { Utils.server.persistentData.putString(DATA_KEY + '_unreadable_' + Date.now(), raw) } catch (e2) { }
      console.error('[BloodTank] Saved data could not be read (' + e + '); a copy was kept and it starts fresh.')
    }
  }
  DB = parsed && parsed.v ? parsed : { v: 1 }
  if (!DB.tanks) DB.tanks = []
  return DB
}
function save() {
  try { Utils.server.persistentData.putString(DATA_KEY, JSON.stringify(db())) } catch (e) { console.error('[BloodTank] Save failed: ' + e) }
}


// ===================== THE TANK =====================

function box(T, x1, y1, z1, x2, y2, z2) {
  return (T.x + x1) + ' ' + (T.y + y1) + ' ' + (T.z + z1) + ' ' + (T.x + x2) + ' ' + (T.y + y2) + ' ' + (T.z + z2)
}
function fill(server, T, x1, y1, z1, x2, y2, z2, block) {
  return run(server, 'execute in ' + T.dim + ' run fill ' + box(T, x1, y1, z1, x2, y2, z2) + ' ' + block)
}
// The block expected at a spot of the structure (relative coordinates), or null inside the chamber.
function expected(dx, dy, dz) {
  if (dy == 0) return FLOOR_BLOCK
  if (dy == HEIGHT - 1) return ROOF_BLOCK
  const edgeX = Math.abs(dx) == 2, edgeZ = Math.abs(dz) == 2
  if (edgeX && edgeZ) return CORNER_BLOCK
  if (edgeX || edgeZ) return SIDE_BLOCK
  return null
}
function build(server, T) {
  fill(server, T, -2, 0, -2, 2, 0, 2, FLOOR_BLOCK)
  fill(server, T, -2, HEIGHT - 1, -2, 2, HEIGHT - 1, 2, ROOF_BLOCK)
  fill(server, T, -2, 1, -2, 2, HEIGHT - 2, 2, SIDE_BLOCK)
  ;[[-2, -2], [-2, 2], [2, -2], [2, 2]].forEach(c => fill(server, T, c[0], 1, c[1], c[0], HEIGHT - 2, c[1], CORNER_BLOCK))
  fill(server, T, -1, 1, -1, 1, LAYERS, 1, 'minecraft:air')
}
// Sets the chamber to n layers of blood (and air above). Returns the block used for the blood.
function setLayers(server, T, n) {
  let used = BLOOD_BLOCK
  if (n > 0 && fill(server, T, -1, 1, -1, 1, n, 1, BLOOD_BLOCK) <= 0) {
    used = BLOOD_FALLBACK
    if (fill(server, T, -1, 1, -1, 1, n, 1, BLOOD_FALLBACK) > 0 && !S.warnedFallback) {
      S.warnedFallback = true
      console.warn('[BloodTank] ' + BLOOD_BLOCK + ' could not be placed; using ' + BLOOD_FALLBACK)
    }
  }
  if (n < LAYERS) fill(server, T, -1, n + 1, -1, 1, LAYERS, 1, 'minecraft:air')
  T.layers = n
  return used
}
function rise(server, T) {
  const at = (T.x + 0.5) + ' ' + (T.y + T.layers + 0.5) + ' ' + (T.z + 0.5)
  run(server, 'execute in ' + T.dim + ' run playsound ' + RISE_SOUND + ' block @a ' + at + ' 2 0.6')
  run(server, 'execute in ' + T.dim + ' run playsound ' + RISE_SOUND_2 + ' block @a ' + at + ' 2 0.5')
  run(server, 'execute in ' + T.dim + ' run particle minecraft:dust 0.55 0 0 1.6 ' + at + ' 1.2 0.4 1.2 0 60 force')
  run(server, 'execute in ' + T.dim + ' run particle minecraft:falling_lava ' + (T.x + 0.5) + ' ' + (T.y + HEIGHT + 0.2) + ' ' + (T.z + 0.5) + ' 1.5 0.1 1.5 0 20 force')
}

function levelOf(server, dim) {
  try { return server.getLevel(dim) } catch (e) { return null }
}
// A tank counts as loaded while a player in its dimension is within NEAR blocks (no chunk is ever loaded for it).
function loaded(server, T) {
  return onlinePlayers(server).some(p => {
    try {
      if (dimId(p.level) != T.dim) return false
      let dx = Number(p.x) - T.x, dz = Number(p.z) - T.z
      return dx * dx + dz * dz <= NEAR * NEAR
    } catch (e) { return false }
  })
}
function blockId(level, x, y, z) {
  try { return String(level.getBlock(x, y, z).id) } catch (e) { return '' }
}
function isBlood(id) { return id == BLOOD_BLOCK || id == BLOOD_FALLBACK }
// The chamber, as it is in the world: true if every layer's centre is blood up to n and air above.
function matches(server, T, n) {
  const level = levelOf(server, T.dim)
  if (!level) return true
  for (let i = 1; i <= LAYERS; i++) {
    let id = blockId(level, T.x, T.y + i, T.z)
    if (i <= n ? !isBlood(id) : id != 'minecraft:air') return false
  }
  return true
}
// The first block of a hand-built tank that isn't what the design expects, or null if it's right.
function checkStructure(level, T) {
  for (let dy = 0; dy < HEIGHT; dy++) {
    for (let dx = -2; dx <= 2; dx++) {
      for (let dz = -2; dz <= 2; dz++) {
        let want = expected(dx, dy, dz)
        if (!want) continue
        let id = blockId(level, T.x + dx, T.y + dy, T.z + dz)
        if (id != want) return { x: T.x + dx, y: T.y + dy, z: T.z + dz, want: want, found: id }
      }
    }
  }
  return null
}

// Brings every loaded tank to the current tier. effects: play the rising effect where a layer was added.
function sync(server, effects) {
  if (!server) return
  const n = targetLayers()
  let changed = false
  db().tanks.forEach(T => {
    if (!loaded(server, T)) return
    let before = T.layers || 0
    if (before == n && matches(server, T, n)) return
    setLayers(server, T, n)
    changed = true
    if (effects && n > before) rise(server, T)
  })
  if (changed) save()
}


// ===================== THE LOOP =====================

if (!global.bloodTankState) global.bloodTankState = {}
const S = global.bloodTankState
function startLoop(server) {
  const token = Date.now() + Math.random()
  S.loop = token                                       // a /reload starts a new loop; the old one stops
  const step = () => {
    if (S.loop != token) return
    try { sync(server, false) } catch (e) { console.error('[BloodTank] ' + e) }
    server.scheduleInTicks(LOOP_SECONDS * 20, step)
  }
  server.scheduleInTicks(LOOP_SECONDS * 20, step)
}
ServerEvents.loaded(event => startLoop(event.server))
if (Utils.server) startLoop(Utils.server)


// ===================== PROTECTION =====================

function inTank(level, x, y, z) {
  if (!level) return null
  const d = dimId(level)
  return db().tanks.filter(T => T.dim == d && Math.abs(x - T.x) <= 2 && Math.abs(z - T.z) <= 2 && y >= T.y && y <= T.y + HEIGHT - 1)[0] || null
}
function guarded(event) {
  if (!PROTECT) return false
  const p = event.player
  if (!p || isOp(p)) return false
  let b = event.block, hit = null
  try { hit = inTank(b.level, Number(b.x), Number(b.y), Number(b.z)) } catch (e) { return false }
  if (!hit) return false
  tell(p, PROTECT_MSG)
  return true
}
BlockEvents.broken(event => { if (guarded(event)) event.cancel() })
BlockEvents.placed(event => { if (guarded(event)) event.cancel() })


// ===================== API =====================

global.BloodTank = {
  sync: (server, effects) => sync(server, effects),   // blood_pool.js calls this whenever the tier changes
  count: () => db().tanks.length,
}


// ===================== COMMANDS =====================

ServerEvents.commandRegistry(event => {
  const Commands = event.commands
  const Arguments = event.arguments
  const reply = (ctx, text, bad) => {
    const json = JSON.stringify(['', { text: '[Blood Tank] ', color: 'dark_red' }, { text: text, color: bad ? 'red' : 'gray' }])
    ctx.source.sendSystemMessage(Serializer ? Serializer.fromJsonLenient(json) : Text.of('[Blood Tank] ' + text))
    return bad ? 0 : 1
  }
  const safe = fn => ctx => {
    try { return fn(ctx) } catch (e) {
      console.error('[BloodTank] ' + e)
      return reply(ctx, 'Error: ' + e, true)
    }
  }
  const pos = () => Commands.argument('pos', Arguments.BLOCK_POS.create(event))
  const posOf = ctx => {
    const b = Arguments.BLOCK_POS.getResult(ctx, 'pos')
    return { dim: dimId(ctx.source.getLevel()), x: Number(b.getX()), y: Number(b.getY()), z: Number(b.getZ()), layers: 0 }
  }
  const same = (a, b) => a.dim == b.dim && a.x == b.x && a.y == b.y && a.z == b.z
  const where = T => T.dim + ' ' + T.x + ' ' + T.y + ' ' + T.z
  const register = (ctx, T) => {
    const D = db()
    if (D.tanks.some(o => same(o, T))) return reply(ctx, 'That tank is already registered.', true)
    D.tanks.push(T)
    setLayers(ctx.source.server, T, targetLayers())
    save()
    return reply(ctx, 'Tank ' + D.tanks.length + ' registered at ' + where(T) + ': ' + T.layers + ' of ' + LAYERS + ' layers of blood (Tier ' + tier() + ').')
  }

  event.register(Commands.literal('bloodtank').requires(src => src.hasPermission(2))
    .then(Commands.literal('build').then(pos().executes(safe(ctx => {
      const T = posOf(ctx)
      if (db().tanks.some(o => same(o, T))) return reply(ctx, 'That tank is already registered.', true)
      build(ctx.source.server, T)
      return register(ctx, T)
    }))))
    .then(Commands.literal('add').then(pos().executes(safe(ctx => {
      const T = posOf(ctx), bad = checkStructure(ctx.source.getLevel(), T)
      if (bad) return reply(ctx, 'Not a tank yet: ' + bad.x + ' ' + bad.y + ' ' + bad.z + ' should be ' + bad.want + ' (found ' + (bad.found || 'nothing') + '). The position is the floor\'s centre block.', true)
      return register(ctx, T)
    }))))
    .then(Commands.literal('list').executes(safe(ctx => {
      const D = db()
      if (!D.tanks.length) return reply(ctx, 'No tanks yet. /bloodtank build <pos> builds one.')
      D.tanks.forEach((T, i) => reply(ctx, (i + 1) + '. ' + where(T) + ': ' + (T.layers || 0) + ' of ' + LAYERS + ' layers'))
      return reply(ctx, 'Tier ' + tier() + ' fills ' + targetLayers() + ' of ' + LAYERS + ' layers.')
    })))
    .then(Commands.literal('remove').then(Commands.argument('n', Arguments.INTEGER.create(event)).executes(safe(ctx => {
      const D = db(), n = Number(Arguments.INTEGER.getResult(ctx, 'n'))
      if (!(n >= 1 && n <= D.tanks.length)) return reply(ctx, 'No tank ' + n + ' (/bloodtank list).', true)
      const T = D.tanks.splice(n - 1, 1)[0]
      save()
      return reply(ctx, 'Tank at ' + where(T) + ' unregistered. Its blocks are left as they are.')
    }))))
    .then(Commands.literal('refill').executes(safe(ctx => {
      const D = db(), n = targetLayers()
      let done = 0
      D.tanks.forEach(T => { setLayers(ctx.source.server, T, n); done++ })
      save()
      return reply(ctx, done + ' tank(s) set to ' + n + ' of ' + LAYERS + ' layers. (A tank in an unloaded area is fixed when someone comes near.)')
    }))))
})

})()
