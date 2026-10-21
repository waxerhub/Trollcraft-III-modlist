// =====================================================================================================
// PIG ESCORT DETAIL - a Ministry of Trolling server event (KubeJS 6, Minecraft 1.20.1 Forge)
//
// All players are Escorts. They must walk Ambassador Oinkington (a sacred pig) to a temporary
// Ministry-Approved Portal while waves of Piglins, Brutes and Hoglins try to kill it.
// Escorts win when the pig steps into the portal. The Piglins win if the pig dies or time runs out.
// Nothing ever actually travels through the event portal.
//
// Needs kubejs/startup_scripts/pig_escort_hooks.js too (restart once after installing it).
//
// Admin commands (op level 2):
//   /pigescort setup                     start setting up (nothing spawns yet)
//   /pigescort setstart                  pig start point = where you stand (default: world spawn)
//   /pigescort setportal                 portal = where you stand, walk-through direction = where you look
//   /pigescort setportal random          random spot 300-600 blocks from the start (default)
//   /pigescort settime <minutes>         event length (default 20)
//   /pigescort difficulty <easy|medium|hard>
//   /pigescort addcheckpoint             add a respawn checkpoint where you stand (replaces the automatic ones)
//   /pigescort clearcheckpoints          go back to automatic checkpoints
//   /pigescort preview                   particles at the start, checkpoints and portal (only you see them)
//   /pigescort start                     launch it; everything after this is automatic
//   /pigescort stop                      end now with no winner and clean up
//   /pigescort cancel                    discard a setup that hasn't started
//   /pigescort status                    current state, settings, time left, pig health, players
//   /pigescort wave                      send a raider wave now (testing)
//   /pigescort purge                     remove stray event pigs/mobs left in loaded chunks (only when idle)
//   /pigescort diagnostics               which version of each uncertain API is in use (see USE_CLEAN_APIS)
//
// Note: KubeJS 6's script engine (Rhino) has no `template strings`, so strings are joined with +,
// and loops use let rather than const.
// =====================================================================================================


// Everything is wrapped in a function so its names can't clash with other server scripts
// (KubeJS 6 runs all server scripts in one shared scope).
(function () {

// ===================== CONFIG =====================

// Fewest players online for /pigescort start to work.
const MIN_PLAYERS = 3
// true = testing: ignores MIN_PLAYERS so you can start the event alone. Set back to false afterwards.
const TEST_MODE = false

// Event length if /pigescort settime isn't used, and the longest allowed.
const DEFAULT_DURATION_MINUTES = 20
const MAX_DURATION_MINUTES = 120

// The Ambassador.
const PIG_NAME = 'Ambassador Oinkington'
const PIG_MAX_HEALTH = 100
const PIG_REGEN_AMOUNT = 1             // health regained...
const PIG_REGEN_EVERY_SECONDS = 3      // ...this often

// Random portal placement (/pigescort setportal random, or no portal set).
const RANDOM_PORTAL_MIN_DISTANCE = 300
const RANDOM_PORTAL_MAX_DISTANCE = 600
const RANDOM_PORTAL_ATTEMPTS = 30
const WORLD_BORDER_MARGIN = 16         // keep this many blocks inside the world border
const PORTAL_PLATFORM_BLOCK = 'minecraft:polished_blackstone_bricks'

// Rewards. rewardPlayer() further down is a stub that gives this item; swap it for Ministry Merits later.
const REWARD_ITEM = 'minecraft:diamond'
const REWARD_AMOUNT = 1                // each participant, if the pig is delivered
const TOP_KILLER_BONUS_AMOUNT = 1      // extra for the player with the most kills, win or lose

// Backup only: deaths are normally intercepted (see checkpoints). true = keepInventory is turned on for
// the event in case a death slips through, and put back to its old value afterwards.
const KEEP_INVENTORY_DURING_EVENT = true

// Removes stray copies of the Ambassador or event mobs whenever they load into the world (e.g. one
// released later from a capture item or AE2 spatial storage, or left over from a crash).
// It always runs during an event. false = it does nothing at all when no event is running.
const STRAY_PIG_GUARD_WHEN_IDLE = true

// Raider mobs.
const DEFAULT_DIFFICULTY = 'medium'
// mix / lateMix = relative chance of each kind; lateMix is added after half the time has passed.
// Kinds: piglin (gold sword), marksman (piglin with crossbow), brute (piglin brute, gold axe), hoglin.
const DIFFICULTIES = {
  easy:   { waveEverySeconds: 60, mobsPerWave: 2, maxAlive: 6,  pigDamageMultiplier: 0.25,
            mix: { piglin: 8, hoglin: 2 }, lateMix: {} },
  medium: { waveEverySeconds: 45, mobsPerWave: 3, maxAlive: 10, pigDamageMultiplier: 0.5,
            mix: { piglin: 5, marksman: 2, hoglin: 3 }, lateMix: { brute: 2 } },
  hard:   { waveEverySeconds: 30, mobsPerWave: 4, maxAlive: 16, pigDamageMultiplier: 0.75,
            mix: { piglin: 4, marksman: 3, hoglin: 3, brute: 2 }, lateMix: {} },
}
const EXTRA_MOB_PER_PLAYERS = 2        // each wave gets +1 mob per this many Escorts
const FIRST_WAVE_DELAY_SECONDS = 20    // grace period before the first wave
const WAVE_SPAWN_MIN_DISTANCE = 20     // waves appear this far from the pig...
const WAVE_SPAWN_MAX_DISTANCE = 35
const MOB_TARGET_PIG_RANGE = 16        // mobs this close to the pig go for the pig, others for the nearest Escort
const MOB_MAX_DISTANCE_FROM_PIG = 96   // mobs that wander further than this are removed
const RAIDER_MOBS_GLOW = true          // raider mobs glow red so they can be seen through walls

// Checkpoints: Escorts who take a fatal hit are healed and sent to the latest secured checkpoint instead.
const AUTO_CHECKPOINTS = [1 / 3, 2 / 3] // fractions of the way from start to portal (start counts as #0)
const CHECKPOINT_RADIUS = 10           // pig this close = checkpoint secured
const RESPAWN_PENALTY_SECONDS = 6      // "Ministry processing": Slowness + Blindness after a fatal hit
const PROTECT_DURING_PROCESSING = true // also immune to damage while being processed

// Tamper detection.
const TELEPORT_LIMIT_HORIZONTAL = 15   // pig moving more than this in one second = tampering
const TELEPORT_LIMIT_VERTICAL = 60     // generous, so falling off a cliff doesn't count
const SHAME_SECONDS = 30               // Glowing + Slowness for the identified culprit
const MAX_TAMPERS = 10                 // more than this in one event voids it (stops endless respawn loops)

const PREVIEW_SECONDS = 30

// false = use the safe fallback for every API that couldn't be verified for KubeJS 6 (see the list in the
// README section of the test plan). Run /pigescort diagnostics; if every "clean" check says OK, you can
// set this to true for slightly cheaper mob targeting and effect blocking.
const USE_CLEAN_APIS = false


// ===================== CONSTANTS =====================

const TAG_PIG = 'pig_escort_ambassador'
const TAG_MOB = 'pig_escort_raider'
const TAG_PLAYER = 'pig_escort_participant'
const TEAM_ESCORTS = 'pe_escorts'
const TEAM_RAIDERS = 'pe_raiders'
const BOSSBAR = 'kubejs:pig_escort'
const OVERWORLD = 'minecraft:overworld'
const SNAPSHOT_KEY = 'pig_escort_snapshot'
const SNAPSHOT_FILE = 'kubejs/pig_escort_snapshot.json'

const MOB_TYPES = { piglin: 'minecraft:piglin', marksman: 'minecraft:piglin', brute: 'minecraft:piglin_brute', hoglin: 'minecraft:hoglin' }
const MOB_NAMES = { 'minecraft:piglin': 'Piglin', 'minecraft:piglin_brute': 'Piglin Brute', 'minecraft:hoglin': 'Hoglin' }


// ===================== STATE =====================
// S.phase: idle -> staged -> countdown -> running -> ending -> idle
// `global` survives /reload; the previous state is only used to know whether an event was interrupted.

const PREVIOUS_STATE = global.pigEscortState
const S = {
  phase: 'idle',
  token: 0,           // bumped to cancel scheduled callbacks from an older run
  setup: null,        // staged settings
  run: null,          // live event data
  snap: null,         // what cleanup needs; also saved to disk for crash recovery
  allowRemoval: false,// true while the script itself removes its pig/mobs
  expectPig: false,   // true while the script is summoning the pig
  expectMob: false,   // true while the script is summoning a raider
  lastMob: null,
  previewToken: 0,
  diag: { hookCalls: {}, discard: 'not used yet', snapshotFile: 'not written yet', position: 'not used yet' },
}
global.pigEscortState = S
const WAS_INTERRUPTED = PREVIOUS_STATE != null &&
  (PREVIOUS_STATE.phase == 'countdown' || PREVIOUS_STATE.phase == 'running' || PREVIOUS_STATE.phase == 'ending')
if (PREVIOUS_STATE) {
  // The old version's scheduled callbacks check its own token and phase; this makes them all stop.
  S.token = (PREVIOUS_STATE.token || 0) + 1
  PREVIOUS_STATE.token++
  PREVIOUS_STATE.phase = 'reloaded'
}

// Optional "clean" APIs. Each one is only used when USE_CLEAN_APIS is true and it loaded.
let CLEAN = { heightmap: null, memory: null, effectDeny: null }
if (USE_CLEAN_APIS) {
  try { CLEAN.heightmap = Java.loadClass('net.minecraft.world.level.levelgen.Heightmap$Types').MOTION_BLOCKING_NO_LEAVES } catch (e) { }
  try { CLEAN.memory = Java.loadClass('net.minecraft.world.entity.ai.memory.MemoryModuleType') } catch (e) { }
  try { CLEAN.effectDeny = Java.loadClass('net.minecraftforge.eventbus.api.Event$Result').DENY } catch (e) { }
}


// ===================== SMALL HELPERS =====================

function run(server, command) { return server.runCommandSilent(command) }
function runOW(server, command) { return server.runCommandSilent('execute in ' + OVERWORLD + ' run ' + command) }
function nameOf(player) { return String(player.getGameProfile().getName()) }
// KubeJS renames some Minecraft methods for scripts (getStringUUID -> getStringUuid, clearFire -> extinguish,
// DamageSource.getEntity -> getActual, getMsgId -> getType, ...). These helpers use KubeJS's name and fall
// back to Minecraft's, so they work either way.
function uuidOf(entity) { return String(typeof entity.getStringUuid == 'function' ? entity.getStringUuid() : entity.getStringUUID()) }
function javaUuidOf(entity) { return typeof entity.getUuid == 'function' ? entity.getUuid() : entity.getUUID() }
function extinguish(entity) { if (typeof entity.extinguish == 'function') entity.extinguish(); else entity.clearFire() }
// Entity position. On the live server neither `pig.x` nor `pig.getX()` gave a number for the pig (players
// were fine), so this tries several independent ways and uses the first that gives a real number:
//   1. Minecraft's getX()   2. Minecraft's position() vector   3. KubeJS's entity.block (the block it's in)
// Which one worked is shown by /pigescort diagnostics.
const POS_WAYS = [
  ['getX()', (e, k) => e['get' + k.toUpperCase()]()],
  ['position()', (e, k) => { const v = e.position(); return typeof v[k] == 'function' ? v[k]() : v[k] }],
  ['entity.block', (e, k) => Number(e.block[k]) + (k == 'y' ? 0 : 0.5)],
  ['.x property', (e, k) => e[k]],
]
function coord(e, k) {
  for (let i = 0; i < POS_WAYS.length; i++) {
    let v = NaN
    try { v = Number(POS_WAYS[i][1](e, k)) } catch (err) { }
    if (isFinite(v)) {
      if (S.diag.position != POS_WAYS[i][0]) S.diag.position = POS_WAYS[i][0]
      return v
    }
  }
  throw new Error('could not read the ' + k + ' position of ' + e + ' (' + positionReport(e) + ')')
}
function positionReport(e) {
  return POS_WAYS.map(w => {
    let r
    try { r = String(w[1](e, 'x')) } catch (err) { r = 'error: ' + err }
    return w[0] + ' = ' + r
  }).join('; ')
}
function ex(e) { return coord(e, 'x') }
function ey(e) { return coord(e, 'y') }
function ez(e) { return coord(e, 'z') }
// Who is responsible for damage (the shooter for arrows), or null.
function attackerOf(source) { return typeof source.getActual == 'function' ? source.getActual() : source.getEntity() }
function damageTypeOf(source) { return String(typeof source.getMsgId == 'function' ? source.getMsgId() : source.getType()) }
// Some names exist both as a Minecraft method and as a KubeJS getter (level, dimension, overworld), and
// Rhino doesn't pick the same one for each: on this server `server.overworld` is the overworld() method,
// while `player.level` and `level.dimension` are KubeJS's values. These helpers work with either form.
function overworldOf(server) { const o = server.overworld; return typeof o == 'function' ? server.overworld() : o }
function levelOf(entity) { const l = entity.level; return typeof l == 'function' ? entity.level() : l }
function dimensionId(level) {
  let d = level.dimension
  if (typeof d == 'function') d = level.dimension()      // Minecraft's: a ResourceKey
  if (d != null && typeof d.location == 'function') d = d.location()
  return String(d)                                        // KubeJS's is already the ID
}
function dimOf(entity) { return dimensionId(levelOf(entity)) }
// Entity ID like minecraft:hoglin (getEncodeId is plain Minecraft; null for players).
function typeOf(entity) { const id = entity.getEncodeId(); return id == null ? '' : String(id) }
function hasTag(entity, tag) { return entity != null && entity.getTags().contains(tag) }
function num(n) { return String(Math.round(n * 100) / 100) }
function horizDist(ax, az, bx, bz) { const dx = ax - bx, dz = az - bz; return Math.sqrt(dx * dx + dz * dz) }
function dist3(a, b) { const dx = a.x - b.x, dy = a.y - b.y, dz = a.z - b.z; return Math.sqrt(dx * dx + dy * dy + dz * dz) }
function clock(seconds) { const m = Math.floor(seconds / 60), s = seconds % 60; return m + ':' + (s < 10 ? '0' : '') + s }
function isAirId(id) { return id == 'minecraft:air' || id == 'minecraft:cave_air' || id == 'minecraft:void_air' }
function isFluidId(id) { return id.indexOf('water') >= 0 || id.indexOf('lava') >= 0 || id == 'minecraft:bubble_column' || id.indexOf('kelp') >= 0 || id.indexOf('seagrass') >= 0 }
function isBadGround(id) { return id.indexOf('leaves') >= 0 || id.indexOf('_log') >= 0 || id.indexOf('_wood') >= 0 || id == 'minecraft:powder_snow' || id == 'minecraft:magma_block' || id == 'minecraft:cactus' }
function isSolid(block, id) {
  try { return block.blockState.blocksMotion() } catch (e) { return !isAirId(id) }
}

// "[MINISTRY]" in bold gold, then the message.
function ministryJson(text, color) {
  return JSON.stringify(['', { text: '[MINISTRY]', color: 'gold', bold: true }, { text: ' ' + text, color: color || 'yellow' }])
}
function announce(server, text, color) { run(server, 'tellraw @a ' + ministryJson(text, color)) }
function tell(server, target, text, color) { run(server, 'tellraw ' + target + ' ' + ministryJson(text, color)) }
function title(server, target, text, color, subtitle, subColor) {
  run(server, 'title ' + target + ' times 5 50 15')
  run(server, 'title ' + target + ' subtitle ' + JSON.stringify({ text: subtitle || '', color: subColor || 'yellow' }))
  run(server, 'title ' + target + ' title ' + JSON.stringify({ text: text, color: color || 'gold', bold: true }))
}
function sound(server, target, id, volume, pitch) {
  run(server, 'execute as ' + target + ' at @s run playsound ' + id + ' master @s ~ ~ ~ ' + volume + ' ' + pitch)
}
function reply(ctx, text) { ctx.source.sendSystemMessage(Text.gold('[Pig Escort] ').append(Text.yellow(text))) }

function hasEffect(entity, descriptionId) {
  const it = entity.getActiveEffects().iterator()
  while (it.hasNext()) if (String(it.next().getEffect().getDescriptionId()) == descriptionId) return true
  return false
}

function onlinePlayers(server) {
  const list = server.players
  const out = []
  for (let i = 0; i < list.size(); i++) out.push(list.get(i))
  return out
}

// Stand-in for the Ministry Merits system: gives REWARD_ITEM and logs it.
function rewardPlayer(player, amount, reason) {
  player.give(Item.of(REWARD_ITEM, amount))
  console.info('[PigEscort] Reward: ' + nameOf(player) + ' x' + amount + ' ' + REWARD_ITEM + ' (' + reason + ')')
}


// ===================== GROUND FINDING =====================

// Scans one column from fromY down to toY. Returns the first solid block with at least 2 free blocks
// above it: { y, id, fluid, bad } (fluid = it's water/lava, bad = leaves, logs, cactus...), or null.
function findGround(level, x, z, fromY, toY) {
  let clear = 0
  for (let y = fromY; y >= toY; y--) {
    let block = level.getBlock(x, y, z)
    let id = String(block.id)
    if (isFluidId(id)) {
      if (clear >= 2) return { y: y, id: id, fluid: true, bad: true }
      clear = 0
    } else if (isSolid(block, id)) {
      if (clear >= 2) return { y: y, id: id, fluid: false, bad: isBadGround(id) }
      clear = 0
    } else {
      clear++
    }
  }
  return null
}

// The surface of a column, from the sky down.
function findSurface(level, x, z) {
  let top = 319, bottom = -64
  try { top = level.getMaxBuildHeight() - 1; bottom = level.getMinBuildHeight() } catch (e) { }
  if (CLEAN.heightmap) {
    try { top = Math.min(top, level.getHeight(CLEAN.heightmap, x, z) + 2) } catch (e) { }
  }
  return findGround(level, x, z, top, bottom)
}

// A safe place to put a player or the pig near p: keeps p if it's standable, otherwise uses the surface.
function safeSpot(level, p) {
  const feet = level.getBlock(p.x, p.y, p.z), head = level.getBlock(p.x, p.y + 1, p.z), below = level.getBlock(p.x, p.y - 1, p.z)
  const fid = String(feet.id), hid = String(head.id), bid = String(below.id)
  if (!isSolid(feet, fid) && !isSolid(head, hid) && !isFluidId(fid) && isSolid(below, bid) && !isFluidId(bid)) return p
  const g = findSurface(level, p.x, p.z)
  if (!g || g.fluid) return null
  return { x: p.x, y: g.y + 1, z: p.z }
}

function insideWorldBorder(server, x, z) {
  const level = overworldOf(server)
  if (USE_CLEAN_APIS) {
    try {
      let b = level.getWorldBorder()
      return x > b.getMinX() + WORLD_BORDER_MARGIN && x < b.getMaxX() - WORLD_BORDER_MARGIN &&
             z > b.getMinZ() + WORLD_BORDER_MARGIN && z < b.getMaxZ() - WORLD_BORDER_MARGIN
    } catch (e) { }
  }
  // Fallback: /worldborder get returns the border's size; assumes the border is centred on 0,0 (the default).
  const half = run(server, 'worldborder get') / 2
  if (half <= 0) return true
  return Math.abs(x) < half - WORLD_BORDER_MARGIN && Math.abs(z) < half - WORLD_BORDER_MARGIN
}


// ===================== PORTAL LAYOUT =====================
// A site is { x, y, z, axis }. y is the platform layer. axis 'x' = the portal spans east-west and you
// walk through it north-south; axis 'z' = the other way round.
// Local coordinates: u along the portal's width, w through it, dy up from the platform.
//   platform: u -2..3, w -2..2, dy 0
//   frame:    u -1..2, w 0, dy 1..5 (obsidian ring); portal blocks: u 0..1, dy 2..4
//   air:      everything else above the platform up to dy 6, so it's never buried

function local(site, u, dy, w) {
  return site.axis == 'x'
    ? { x: site.x + u, y: site.y + dy, z: site.z + w }
    : { x: site.x + w, y: site.y + dy, z: site.z + u }
}

function portalLayout(site) {
  const cells = []
  for (let dy = 0; dy <= 6; dy++) {
    for (let u = -2; u <= 3; u++) {
      for (let w = -2; w <= 2; w++) {
        let kind = 'air'
        if (dy == 0) kind = 'platform'
        else if (w == 0 && u >= -1 && u <= 2 && dy <= 5) kind = (u == -1 || u == 2 || dy == 1 || dy == 5) ? 'frame' : 'portal'
        let p = local(site, u, dy, w)
        p.kind = kind
        cells.push(p)
      }
    }
  }
  return cells
}

function key(x, y, z) { return x + ',' + y + ',' + z }

// World-space box of the portal blocks, grown by margin on every side.
function portalBox(site, margin) {
  const a = local(site, 0, 2, 0), b = local(site, 1, 4, 0)
  return {
    minX: Math.min(a.x, b.x) - margin, maxX: Math.max(a.x, b.x) + 1 + margin,
    minY: a.y - margin, maxY: b.y + 1 + margin,
    minZ: Math.min(a.z, b.z) - margin, maxZ: Math.max(a.z, b.z) + 1 + margin,
  }
}

function portalCenter(site) {
  const a = local(site, 0, 2, 0), b = local(site, 1, 2, 0)
  return { x: (a.x + b.x) / 2 + 0.5, y: a.y, z: (a.z + b.z) / 2 + 0.5 }
}

function entityInBox(e, box) {
  const hw = e.getBbWidth() / 2, h = e.getBbHeight()
  return ex(e) + hw > box.minX && ex(e) - hw < box.maxX && ey(e) + h > box.minY && ey(e) < box.maxY && ez(e) + hw > box.minZ && ez(e) - hw < box.maxZ
}

// Block state as text a /setblock command accepts, e.g. minecraft:oak_stairs[facing=east,half=bottom].
function stateString(block) {
  const s = String(block.blockState.toString())
  const m = s.match(/^Block\{([^}]+)\}(\[.*\])?$/)
  return m ? m[1] + (m[2] || '') : String(block.id)
}

// Checks a site can be used. Returns null if OK, otherwise the reason it can't.
function checkPortalSite(server, site, strict) {
  const level = overworldOf(server)
  let top = 319, bottom = -64
  try { top = level.getMaxBuildHeight() - 1; bottom = level.getMinBuildHeight() } catch (e) { }
  if (site.y < bottom + 1 || site.y + 7 > top) return 'it is too close to the top or bottom of the world'
  const c = portalCenter(site)
  if (!insideWorldBorder(server, c.x, c.z)) return 'it is outside (or too close to) the world border'
  const cells = portalLayout(site)
  for (let i = 0; i < cells.length; i++) {
    let p = cells[i]
    let block = level.getBlock(p.x, p.y, p.z)
    let id = String(block.id)
    if (block.entityData != null) return 'there is a ' + id + ' at ' + p.x + ' ' + p.y + ' ' + p.z + '. The Ministry does not demolish private property'
    if (isFluidId(id)) return 'there is ' + id + ' at ' + p.x + ' ' + p.y + ' ' + p.z
    if (id == 'minecraft:bedrock' || id.indexOf('portal') >= 0 || id == 'minecraft:end_portal_frame') return 'there is ' + id + ' at ' + p.x + ' ' + p.y + ' ' + p.z
  }
  // Don't build right next to another Nether portal.
  for (let dy = 1; dy <= 6; dy++) {
    for (let u = -3; u <= 4; u++) {
      for (let w = -3; w <= 3; w++) {
        let p = local(site, u, dy, w)
        if (String(level.getBlock(p.x, p.y, p.z).id) == 'minecraft:nether_portal') return 'it is next to an existing Nether portal'
      }
    }
  }
  if (strict) {
    // Random sites: most of the platform must sit on solid ground.
    let supported = 0
    for (let u = -2; u <= 3; u++) {
      for (let w = -2; w <= 2; w++) {
        let p = local(site, u, -1, w)
        let b = level.getBlock(p.x, p.y, p.z)
        if (isSolid(b, String(b.id))) supported++
      }
    }
    if (supported < 24) return 'the ground there is too uneven'
  }
  return null
}

// Site from where a player stands: the block under their feet becomes the platform,
// and they walk through the portal in the direction they're facing.
function siteFromPlayer(player) {
  const facing = String(player.facing)
  return {
    x: Math.floor(ex(player)), y: Math.floor(ey(player)) - 1, z: Math.floor(ez(player)),
    axis: (facing == 'north' || facing == 'south') ? 'x' : 'z',
  }
}

function pickRandomPortal(server, start) {
  const level = overworldOf(server)
  for (let attempt = 0; attempt < RANDOM_PORTAL_ATTEMPTS; attempt++) {
    let angle = Math.random() * Math.PI * 2
    let d = RANDOM_PORTAL_MIN_DISTANCE + Math.random() * (RANDOM_PORTAL_MAX_DISTANCE - RANDOM_PORTAL_MIN_DISTANCE)
    let x = Math.floor(start.x + Math.cos(angle) * d), z = Math.floor(start.z + Math.sin(angle) * d)
    if (!insideWorldBorder(server, x, z)) continue
    let g = findSurface(level, x, z)
    if (!g || g.fluid || g.bad) continue
    // Walk-through direction points at the start, so the portal faces the way the Escorts arrive.
    let site = { x: x, y: g.y, z: z, axis: Math.abs(start.x - x) > Math.abs(start.z - z) ? 'z' : 'x' }
    if (!checkPortalSite(server, site, true)) return site
  }
  return null
}

function worldSpawn(server) {
  const p = overworldOf(server).getSharedSpawnPos()
  return { x: p.getX(), y: p.getY(), z: p.getZ() }
}

// Checkpoints along the straight line from start to portal (or the ones the admin placed).
function buildCheckpoints(server, start, site, manual) {
  if (manual && manual.length) return manual.map(c => ({ x: c.x, y: c.y, z: c.z }))
  const level = overworldOf(server)
  const end = portalCenter(site)
  const out = []
  AUTO_CHECKPOINTS.forEach(f => {
    const nudges = [[0, 0], [4, 0], [-4, 0], [0, 4], [0, -4], [8, 8], [-8, -8], [8, -8], [-8, 8]]
    for (let i = 0; i < nudges.length; i++) {
      let x = Math.floor(start.x + (end.x - start.x) * f) + nudges[i][0]
      let z = Math.floor(start.z + (end.z - start.z) * f) + nudges[i][1]
      let g = findSurface(level, x, z)
      if (g && !g.fluid && !g.bad) { out.push({ x: x, y: g.y + 1, z: z }); return }
    }
    console.warn('[PigEscort] No dry ground for the checkpoint at ' + Math.round(f * 100) + '% of the route; skipping it')
  })
  return out
}


// ===================== CRASH-SAFE SNAPSHOT =====================
// Everything cleanup needs: original blocks, chunks we force-loaded, previous keepInventory value,
// previous teams, participants. Saved in the world data and in a file (the world data on its own
// could be lost if the server crashed before its next autosave).

function saveSnapshot(server) {
  const json = JSON.stringify(S.snap)
  server.persistentData.putString(SNAPSHOT_KEY, json)
  try {
    JsonIO.write(SNAPSHOT_FILE, { snapshot: json })
    S.diag.snapshotFile = 'OK'
  } catch (e) {
    if (S.diag.snapshotFile != 'FAILED') console.warn('[PigEscort] Could not write ' + SNAPSHOT_FILE + ' (world data copy still saved): ' + e)
    S.diag.snapshotFile = 'FAILED'
  }
}

function loadSnapshot(server) {
  let json = String(server.persistentData.getString(SNAPSHOT_KEY) || '')
  if (!json.length) {
    try {
      let m = JsonIO.read(SNAPSHOT_FILE)
      if (m && m.get('snapshot')) json = String(m.get('snapshot'))
    } catch (e) { }
  }
  if (!json.length) return null
  try { return JSON.parse(json) } catch (e) { return null }
}

function clearSnapshot(server) {
  server.persistentData.remove(SNAPSHOT_KEY)
  try { JsonIO.write(SNAPSHOT_FILE, { snapshot: '' }) } catch (e) { }
}


// ===================== CHUNK LOADING =====================

function chunkKey(x, z) { return (Math.floor(x) >> 4) + ',' + (Math.floor(z) >> 4) }

// Force-loads the chunk containing x,z (unless someone else already had it force-loaded).
function forceChunk(server, x, z) {
  const R = S.run, k = chunkKey(x, z)
  if (R.forced[k] || R.forcedByOthers[k]) return
  if (runOW(server, 'forceload query ' + Math.floor(x) + ' ' + Math.floor(z)) > 0) { R.forcedByOthers[k] = true; return }
  runOW(server, 'forceload add ' + Math.floor(x) + ' ' + Math.floor(z))
  R.forced[k] = [Math.floor(x), Math.floor(z)]
  S.snap.forced = Object.keys(R.forced).map(kk => R.forced[kk])
  saveSnapshot(server)
}

function unforceChunk(server, k) {
  const R = S.run
  if (!R.forced[k] || R.keepForced[k]) return
  runOW(server, 'forceload remove ' + R.forced[k][0] + ' ' + R.forced[k][1])
  delete R.forced[k]
  S.snap.forced = Object.keys(R.forced).map(kk => R.forced[kk])
  saveSnapshot(server)
}


// ===================== THE PIG =====================

function pigNbt(health) {
  const name = JSON.stringify({ text: PIG_NAME, color: 'gold', bold: true })
  return '{CustomName:\'' + name + '\',CustomNameVisible:1b,PersistenceRequired:1b,Glowing:1b,' +
    'DeathLootTable:"minecraft:empty",Tags:["' + TAG_PIG + '"],' +
    'Attributes:[{Name:"minecraft:generic.max_health",Base:' + PIG_MAX_HEALTH + 'd}],Health:' + num(health) + 'f}'
}

function pigName(pig) {
  const n = pig.getCustomName()
  return n ? String(n.getString()) : ''
}

// Summons the pig. The spawn listener below stores the new entity in S.run.pig.
function spawnPig(server, pos, health) {
  const R = S.run
  forceChunk(server, pos.x, pos.z)
  R.pig = null
  S.expectPig = true
  try {
    runOW(server, 'summon minecraft:pig ' + num(pos.x) + ' ' + num(pos.y) + ' ' + num(pos.z) + ' ' + pigNbt(health))
  } finally {
    S.expectPig = false
  }
  if (R.pig) {
    R.pigUuid = uuidOf(R.pig)
    R.pigChunk = chunkKey(pos.x, pos.z)
    R.lastValid = { x: pos.x, y: pos.y, z: pos.z, health: health }
  }
  return R.pig
}

// Removes every loaded entity with a tag, in every dimension. Returns how many.
function removeTagged(server, tag) {
  let removed = 0
  S.allowRemoval = true
  try {
    if (USE_CLEAN_APIS) {
      try {
        let all = server.entities
        let found = []
        for (let i = 0; i < all.size(); i++) if (hasTag(all.get(i), tag)) found.push(all.get(i))
        found.forEach(e => { e.discard(); removed++ })
        S.diag.discard = 'clean (discard) OK'
      } catch (e) {
        S.diag.discard = 'clean (discard) FAILED: ' + e
      }
    } else {
      S.diag.discard = 'fallback (/kill)'
    }
    // Fallback (and a sweep for anything the clean path missed). The hurt/death listeners let this through.
    removed += run(server, 'kill @e[tag=' + tag + ']')
  } finally {
    S.allowRemoval = false
  }
  return removed
}

function noteInteraction(player) {
  if (S.run && player) S.run.lastInteract = { name: nameOf(player), tick: Utils.server.tickCount }
}

// Right-click whitelist: a lead (attach), or an empty hand to unhook the pig from yourself.
function interactionAllowed(player, pig, item) {
  if (String(item.id) == 'minecraft:lead') return true
  if (item.isEmpty() && pig.isLeashed()) {
    let holder = pig.getLeashHolder()
    return holder != null && uuidOf(holder) == uuidOf(player)
  }
  return false
}

// Who to blame: the last player to touch the pig in the last 10 seconds, else the nearest player within 10 blocks.
function findCulprit(server) {
  const R = S.run
  if (R.lastInteract && server.tickCount - R.lastInteract.tick <= 200) return R.lastInteract.name
  let best = null, bestD = 10
  onlinePlayers(server).forEach(p => {
    if (dimOf(p) != OVERWORLD) return
    const d = dist3({ x: ex(p), y: ey(p), z: ez(p) }, R.lastValid)
    if (d <= bestD) { bestD = d; best = nameOf(p) }
  })
  return best
}

function handleTamper(server, reason) {
  const R = S.run
  R.tampers++
  if (R.tampers > MAX_TAMPERS) {
    announce(server, 'Persistent tampering with the Ambassador has rendered this operation unworkable. It is hereby voided.', 'red')
    endEvent(server, 'voided')
    return
  }
  const culprit = findCulprit(server)
  removeTagged(server, TAG_PIG)
  const pig = spawnPig(server, R.lastValid, Math.max(1, R.lastValid.health))
  if (!pig) {
    announce(server, 'The Ambassador could not be reinstated. The operation is voided pending an inquiry.', 'red')
    endEvent(server, 'voided')
    return
  }
  announce(server, 'Tampering with Ambassador Oinkington detected (' + reason + '). The Ministry has reversed it. Nothing happened.', 'red')
  if (culprit) {
    announce(server, culprit + ' has been identified as a Person of Interest and will glow with shame for ' + SHAME_SECONDS + ' seconds.', 'red')
    run(server, 'effect give ' + culprit + ' minecraft:glowing ' + SHAME_SECONDS + ' 0 true')
    run(server, 'effect give ' + culprit + ' minecraft:slowness ' + SHAME_SECONDS + ' 1 true')
  }
  console.warn('[PigEscort] Tampering: ' + reason + (culprit ? ' (culprit: ' + culprit + ')' : ''))
}

// Runs every second. Returns false if it had to step in.
function checkPig(server) {
  const R = S.run, pig = R.pig
  if (R.pigDead) return false // killed by raiders; the event is ending
  let problem = null
  if (!pig || pig.isRemoved() || !pig.isAlive()) problem = 'the Ambassador went missing'
  else if (dimOf(pig) != OVERWORLD) problem = 'the Ambassador left the Overworld'
  else {
    let dy = Math.abs(ey(pig) - R.lastValid.y)
    if (horizDist(ex(pig), ez(pig), R.lastValid.x, R.lastValid.z) > TELEPORT_LIMIT_HORIZONTAL || dy > TELEPORT_LIMIT_VERTICAL) {
      problem = 'unauthorized relocation'
    } else if (pig.isPassenger() || pig.getPassengers().size() > 0) {
      problem = 'the Ambassador was mounted or put in a vehicle'
    } else if (pig.isLeashed()) {
      let h = pig.getLeashHolder()
      if (h != null && !h.isPlayer() && typeOf(h) != 'minecraft:leash_knot') problem = 'the Ambassador was attached to ' + typeOf(h)
    }
    if (!problem && (!hasTag(pig, TAG_PIG) || pigName(pig) != PIG_NAME || Math.abs(pig.getMaxHealth() - PIG_MAX_HEALTH) > 0.01)) {
      problem = 'the Ambassador was altered'
    }
  }
  if (problem) {
    handleTamper(server, problem)
    return false
  }
  // Effects: blocked as they're applied when USE_CLEAN_APIS works; otherwise cleared here every second.
  if (pig.getActiveEffects().size() > 0) run(server, 'effect clear ' + R.pigUuid)
  if (pig.isOnFire()) extinguish(pig)
  R.lastValid = { x: ex(pig), y: ey(pig), z: ez(pig), health: pig.getHealth() }
  return true
}


// ===================== THE PORTAL =====================

function buildPortal(server, site, framesOnly) {
  const cells = portalLayout(site)
  cells.forEach(p => {
    if (framesOnly && p.kind != 'frame') return
    if (p.kind == 'platform') runOW(server, 'setblock ' + p.x + ' ' + p.y + ' ' + p.z + ' ' + PORTAL_PLATFORM_BLOCK)
    else if (p.kind == 'frame') runOW(server, 'setblock ' + p.x + ' ' + p.y + ' ' + p.z + ' minecraft:obsidian')
    else if (p.kind == 'air') runOW(server, 'setblock ' + p.x + ' ' + p.y + ' ' + p.z + ' minecraft:air')
  })
  // Portal blocks last, once the frame is complete (otherwise they break themselves).
  const a = local(site, 0, 2, 0), b = local(site, 1, 4, 0)
  runOW(server, 'fill ' + a.x + ' ' + a.y + ' ' + a.z + ' ' + b.x + ' ' + b.y + ' ' + b.z + ' minecraft:nether_portal[axis=' + site.axis + ']')
}

// Puts the frame and portal blocks back if anything (machines, mods) changed them.
function checkPortalIntact(server) {
  const R = S.run, level = overworldOf(server)
  let broken = false
  for (let i = 0; i < R.frameCells.length && !broken; i++) {
    let p = R.frameCells[i]
    let want = p.kind == 'frame' ? 'minecraft:obsidian' : 'minecraft:nether_portal'
    if (String(level.getBlock(p.x, p.y, p.z).id) != want) broken = true
  }
  if (!broken) return
  if (server.tickCount - R.lastPortalRepair < 100) return
  R.lastPortalRepair = server.tickCount
  buildPortal(server, R.site, true)
  announce(server, 'Unauthorized modification of the Ministry-Approved Portal has been reversed. It was always like this.', 'red')
}

// Pushes a player back out of the portal onto the platform, facing away.
function pushOut(server, player) {
  const R = S.run, site = R.site
  const c = portalCenter(site)
  const along = site.axis == 'x' ? ez(player) - c.z : ex(player) - c.x
  const side = along >= 0 ? 2 : -2
  const spot = local(site, 0, 1, side) // on the platform, 2 blocks in front of or behind the frame
  const x = site.axis == 'x' ? c.x : spot.x + 0.5
  const z = site.axis == 'x' ? spot.z + 0.5 : c.z
  // Face away from the portal. Yaw: 0 = south, 90 = west, 180 = north, -90 = east.
  let yaw
  if (site.axis == 'x') yaw = side > 0 ? 0 : 180
  else yaw = side > 0 ? -90 : 90
  runOW(server, 'tp ' + uuidOf(player) + ' ' + num(x) + ' ' + spot.y + ' ' + num(z) + ' ' + yaw + ' 0')
}


// ===================== RAIDER MOBS =====================

function mobNbt(kind) {
  let nbt = '{PersistenceRequired:1b,IsImmuneToZombification:1b,DeathLootTable:"minecraft:empty",Tags:["' + TAG_MOB + '"]' +
    (RAIDER_MOBS_GLOW ? ',Glowing:1b' : '') +
    ',Attributes:[{Name:"minecraft:generic.follow_range",Base:48d}]'
  // /summon with NBT skips the normal equipment roll, so weapons are given here.
  if (kind == 'piglin') nbt += ',HandItems:[{id:"minecraft:golden_sword",Count:1b},{}],HandDropChances:[0f,0f]'
  if (kind == 'marksman') nbt += ',HandItems:[{id:"minecraft:crossbow",Count:1b},{}],HandDropChances:[0f,0f]'
  if (kind == 'brute') nbt += ',HandItems:[{id:"minecraft:golden_axe",Count:1b},{}],HandDropChances:[0f,0f]'
  return nbt + '}'
}

function pickKind(R, server) {
  const weights = {}
  Object.keys(R.diff.mix).forEach(k => { weights[k] = R.diff.mix[k] })
  if (server.tickCount >= R.halfTick) Object.keys(R.diff.lateMix).forEach(k => { weights[k] = (weights[k] || 0) + R.diff.lateMix[k] })
  let total = 0
  Object.keys(weights).forEach(k => { total += weights[k] })
  let roll = Math.random() * total
  const kinds = Object.keys(weights)
  for (let i = 0; i < kinds.length; i++) {
    roll -= weights[kinds[i]]
    if (roll <= 0) return kinds[i]
  }
  return kinds[0]
}

function spawnRaider(server, kind) {
  const R = S.run, pig = R.pig, level = overworldOf(server)
  for (let attempt = 0; attempt < 6; attempt++) {
    let angle = Math.random() * Math.PI * 2
    let d = WAVE_SPAWN_MIN_DISTANCE + Math.random() * (WAVE_SPAWN_MAX_DISTANCE - WAVE_SPAWN_MIN_DISTANCE)
    let px = ex(pig), py = ey(pig), pz = ez(pig)
    let x = Math.floor(px + Math.cos(angle) * d)
    let z = Math.floor(pz + Math.sin(angle) * d)
    let top = Math.floor(py) + 16
    if (!isFinite(x) || !isFinite(z) || !isFinite(top)) {
      throw new Error('bad spawn position: pig ' + px + ' ' + py + ' ' + pz + ', angle ' + angle + ', distance ' + d + ' -> ' + x + ' ' + top + ' ' + z)
    }
    let g = findGround(level, x, z, top, top - 40)
    if (!g || g.fluid || g.bad) { R.waveStats.noGround++; continue }
    S.lastMob = null
    S.expectMob = true
    let result = 0
    try {
      result = runOW(server, 'summon ' + MOB_TYPES[kind] + ' ' + (x + 0.5) + ' ' + (g.y + 1) + ' ' + (z + 0.5) + ' ' + mobNbt(kind))
    } finally {
      S.expectMob = false
    }
    let m = S.lastMob
    S.lastMob = null
    if (!result) { R.waveStats.summonFailed++; continue }   // /summon itself was rejected
    if (!m) { R.waveStats.removedOnSpawn++; continue }      // summoned, but something removed it as it appeared
    if (m) {
      R.mobs[uuidOf(m)] = m
      run(server, 'team join ' + TEAM_RAIDERS + ' ' + uuidOf(m))
      return true
    }
  }
  return false
}

function aliveMobs() {
  const R = S.run, out = []
  Object.keys(R.mobs).forEach(k => {
    const m = R.mobs[k]
    if (m.isRemoved() || !m.isAlive()) delete R.mobs[k]
    else out.push(m)
  })
  return out
}

function maybeSpawnWave(server) {
  const R = S.run
  if (server.tickCount < R.nextWaveTick) return
  R.nextWaveTick = server.tickCount + R.diff.waveEverySeconds * 20
  const room = R.diff.maxAlive - aliveMobs().length
  if (room <= 0) return
  const want = Math.min(room, R.diff.mobsPerWave + Math.floor(Object.keys(R.participants).length / EXTRA_MOB_PER_PLAYERS))
  let spawned = 0
  R.waveStats = { noGround: 0, summonFailed: 0, removedOnSpawn: 0 }
  for (let i = 0; i < want; i++) if (spawnRaider(server, pickKind(R, server))) spawned++
  R.waveStats.spawned = spawned
  R.waveStats.wanted = want
  R.lastWave = R.waveStats
  if (spawned > 0) announce(server, 'A Piglin delegation of ' + spawned + ' has arrived to contest the transfer. Please remain calm and keep the Ambassador away from them.', 'red')
  if (spawned < want) {
    console.warn('[PigEscort] Wave spawned ' + spawned + '/' + want + ' raiders. Failed attempts: no usable ground ' + R.waveStats.noGround +
      ', /summon rejected or cancelled by another mod ' + R.waveStats.summonFailed + ', removed as it spawned ' + R.waveStats.removedOnSpawn +
      '. World difficulty: ' + ['peaceful', 'easy', 'normal', 'hard'][run(server, 'difficulty')])
  }
}

// Turns a UUID string into the [I;a,b,c,d] form NBT uses.
function uuidIntArray(u) {
  const h = u.replace(/-/g, '')
  const out = []
  for (let i = 0; i < 4; i++) {
    let n = parseInt(h.substr(i * 8, 8), 16)
    if (n > 0x7fffffff) n -= 0x100000000
    out.push(n)
  }
  return '[I;' + out.join(',') + ']'
}

function setMobTarget(server, mob, target, refresh) {
  const isHoglin = typeOf(mob) == 'minecraft:hoglin'
  if (CLEAN.memory) {
    try {
      if (isHoglin) mob.getBrain().setMemory(CLEAN.memory.ATTACK_TARGET, target)
      else mob.getBrain().setMemoryWithExpiry(CLEAN.memory.ANGRY_AT, javaUuidOf(target), 200)
      return
    } catch (e) { }
  }
  // Fallback: write the piglin's anger memory with /data. This resets its AI, so only every few seconds.
  // Hoglins have no anger memory, so in fallback mode they just go for nearby players on their own.
  if (isHoglin || !refresh) return
  run(server, 'data merge entity ' + uuidOf(mob) + ' {Brain:{memories:{"minecraft:angry_at":{value:' + uuidIntArray(uuidOf(target)) + ',ttl:200L}}}}')
}

function retargetMobs(server, escorts) {
  const R = S.run, pig = R.pig
  const refresh = (server.tickCount - R.lastRetarget) >= 60
  if (refresh) R.lastRetarget = server.tickCount
  aliveMobs().forEach(m => {
    const dPig = dist3({ x: ex(m), y: ey(m), z: ez(m) }, { x: ex(pig), y: ey(pig), z: ez(pig) })
    if (dPig > MOB_MAX_DISTANCE_FROM_PIG || dimOf(m) != OVERWORLD) {
      S.allowRemoval = true
      try { run(server, 'kill ' + uuidOf(m)) } finally { S.allowRemoval = false }
      return
    }
    let target = pig
    if (dPig > MOB_TARGET_PIG_RANGE) {
      let best = 32
      escorts.forEach(p => {
        const d = dist3({ x: ex(m), y: ey(m), z: ez(m) }, { x: ex(p), y: ey(p), z: ez(p) })
        if (d < best) { best = d; target = p }
      })
    }
    setMobTarget(server, m, target, refresh)
  })
}


// ===================== CHECKPOINTS & "DEATH" =====================

function respawnPoint(server) {
  const R = S.run
  const p = R.cpSecured > 0 ? R.checkpoints[R.cpSecured - 1] : R.start
  return safeSpot(overworldOf(server), { x: Math.floor(p.x), y: Math.floor(p.y), z: Math.floor(p.z) }) || R.start
}

function checkCheckpoints(server) {
  const R = S.run, pig = R.pig
  if (R.cpSecured >= R.checkpoints.length) return
  const cp = R.checkpoints[R.cpSecured]
  const end = portalCenter(R.site)
  const near = horizDist(ex(pig), ez(pig), cp.x, cp.z)
  // Secured when the pig gets close, or has got past it (closer to the portal) without straying too far.
  const past = horizDist(ex(pig), ez(pig), end.x, end.z) <= horizDist(cp.x, cp.z, end.x, end.z) && near <= 48
  if (near <= CHECKPOINT_RADIUS || past) {
    R.cpSecured++
    announce(server, 'Checkpoint ' + R.cpSecured + ' of ' + R.checkpoints.length + ' secured. Escorts will now be reassigned here after any workplace incident.', 'green')
    sound(server, '@a', 'minecraft:block.note_block.chime', 0.6, 1.4)
  }
}

// A participant took fatal damage: cancel the death, heal them and send them to the checkpoint.
function interceptDeath(server, event, player) {
  const R = S.run
  const name = nameOf(player)
  const info = R.participants[name]
  event.cancel()
  player.setHealth(player.getMaxHealth())
  extinguish(player)
  player.resetFallDistance()
  if (typeof player.setFoodLevel == "function") player.setFoodLevel(20)
  if (server.tickCount < info.processingUntil) return // already being processed
  info.processingUntil = server.tickCount + RESPAWN_PENALTY_SECONDS * 20
  info.deaths++
  const killer = attackerOf(event.source)
  if (killer && hasTag(killer, TAG_MOB)) {
    announce(server, 'Escort ' + name + ' has been temporarily decommissioned by a ' + (MOB_NAMES[typeOf(killer)] || 'Piglin') + '. Reassignment to the nearest checkpoint is underway.', 'red')
  } else {
    announce(server, 'Escort ' + name + ' has suffered a workplace incident (' + damageTypeOf(event.source) + '). Reassignment to the nearest checkpoint is underway.', 'red')
  }
  const spot = respawnPoint(server)
  const token = S.token
  server.scheduleInTicks(1, () => {
    if (token != S.token || S.phase != 'running') return
    run(server, 'effect clear ' + name)
    run(server, 'effect give ' + name + ' minecraft:glowing infinite 0 true')
    run(server, 'effect give ' + name + ' minecraft:slowness ' + RESPAWN_PENALTY_SECONDS + ' 3 true')
    run(server, 'effect give ' + name + ' minecraft:blindness ' + RESPAWN_PENALTY_SECONDS + ' 0 true')
    if (PROTECT_DURING_PROCESSING) run(server, 'effect give ' + name + ' minecraft:resistance ' + RESPAWN_PENALTY_SECONDS + ' 4 true')
    runOW(server, 'tp ' + name + ' ' + (spot.x + 0.5) + ' ' + spot.y + ' ' + (spot.z + 0.5))
    title(server, name, 'MINISTRY PROCESSING', 'gold', 'Please hold. Your reassignment is important to us.', 'yellow')
  })
}


// ===================== HUD =====================

function updateHud(server, secondsLeft) {
  const R = S.run, pig = R.pig
  const hp = Math.max(0, Math.ceil(pig.getHealth()))
  const c = portalCenter(R.site)
  const d = Math.round(horizDist(ex(pig), ez(pig), c.x, c.z))
  run(server, 'bossbar set ' + BOSSBAR + ' players @a')
  run(server, 'bossbar set ' + BOSSBAR + ' value ' + hp)
  run(server, 'bossbar set ' + BOSSBAR + ' name ' + JSON.stringify([
    { text: PIG_NAME + '  ', color: 'gold', bold: true },
    { text: '❤ ' + hp + '/' + PIG_MAX_HEALTH, color: 'red' },
    { text: '   Portal: ' + d + ' m   Time left: ' + clock(secondsLeft), color: 'white' },
  ]))
  // Particle column on the portal (force = visible from far away), and on the next checkpoint.
  runOW(server, 'particle minecraft:end_rod ' + num(c.x) + ' ' + (c.y + 12) + ' ' + num(c.z) + ' 0.2 10 0.2 0.01 40 force @a')
  if (R.cpSecured < R.checkpoints.length) {
    let cp = R.checkpoints[R.cpSecured]
    runOW(server, 'particle minecraft:happy_villager ' + (cp.x + 0.5) + ' ' + (cp.y + 6) + ' ' + (cp.z + 0.5) + ' 0.2 6 0.2 0 20 force @a')
  }
}


// ===================== EVENT FLOW =====================

function participantPlayers(server) {
  const R = S.run
  return onlinePlayers(server).filter(p => R.participants[nameOf(p)] != null)
}

// /pigescort start: checks, choose the portal, then the 10 second countdown.
function startEvent(server) {
  if (S.phase != 'staged') return 'Run /pigescort setup first.'
  if (global.trollcraftEventActive) return 'Another event is already running.'
  const players = onlinePlayers(server)
  if (!TEST_MODE && players.length < MIN_PLAYERS) return 'At least ' + MIN_PLAYERS + ' players must be online (' + players.length + ' are). Set TEST_MODE to test alone.'
  if (players.length < 1) return 'Nobody is online.'
  // /difficulty with no argument returns 0 = peaceful ... 3 = hard. Hostile mobs can't exist on peaceful.
  if (run(server, 'difficulty') == 0) return 'The world is on Peaceful, so the Piglin raiders would vanish instantly. Use /difficulty easy (or higher) first.'

  const setup = S.setup
  const level = overworldOf(server)
  const startRaw = setup.start || worldSpawn(server)
  const start = safeSpot(level, startRaw)
  if (!start) return 'The start point isn\'t safe to stand on (water or lava?). Use /pigescort setstart somewhere dry.'
  let site = setup.portal
  if (!site) {
    site = pickRandomPortal(server, start)
    if (!site) return 'Couldn\'t find dry, flat ground for a random portal after ' + RANDOM_PORTAL_ATTEMPTS + ' tries. Try again, or use /pigescort setportal.'
    setup.portal = site
  }
  const problem = checkPortalSite(server, site, false)
  if (problem) return 'The portal site can\'t be used: ' + problem + '.'

  S.run = {
    start: start, site: site, minutes: setup.minutes, difficulty: setup.difficulty, diff: DIFFICULTIES[setup.difficulty],
    checkpoints: buildCheckpoints(server, start, site, setup.checkpoints), cpSecured: 0,
    participants: {}, pig: null, pigDead: false, pigUuid: '', pigChunk: '', lastValid: null, lastInteract: null,
    mobs: {}, nextWaveTick: 0, waveStats: { noGround: 0, summonFailed: 0, removedOnSpawn: 0 }, lastWave: null, halfTick: 0, endTick: 0, lastRetarget: 0, lastRegen: 0, lastPortalRepair: -1000,
    forced: {}, forcedByOthers: {}, keepForced: {}, tampers: 0, pushCooldown: {},
    portalBoxStrict: portalBox(site, 0), portalBoxLoose: portalBox(site, 0.5), frameCells: [], footprint: {}, solidKeys: {},
  }
  S.phase = 'countdown'
  global.trollcraftEventActive = true
  const token = S.token

  announce(server, 'By order of the Ministry of Trolling, PIG ESCORT DETAIL begins in 10 seconds. Ambassador Oinkington must be escorted to a Ministry-Approved Portal for repatriation to his Piglin counterparts. Difficulty: ' + setup.difficulty.toUpperCase() + '. Time allotted: ' + setup.minutes + ' minutes.', 'yellow')
  ;[10, 9, 8, 7, 6, 5, 4, 3, 2, 1].forEach(n => {
    server.scheduleInTicks((10 - n) * 20 + 1, () => {
      if (token != S.token || S.phase != 'countdown') return
      run(server, 'title @a times 0 25 5')
      run(server, 'title @a subtitle ' + JSON.stringify({ text: 'Pig Escort Detail', color: 'yellow' }))
      run(server, 'title @a title ' + JSON.stringify({ text: String(n), color: 'gold', bold: true }))
      sound(server, '@a', 'minecraft:block.note_block.hat', 0.6, 1)
    })
  })
  server.scheduleInTicks(10 * 20 + 1, () => {
    if (token != S.token || S.phase != 'countdown') return
    try {
      beginEvent(server)
    } catch (e) {
      console.error('[PigEscort] Failed to start: ' + e)
      announce(server, 'An administrative error has delayed Pig Escort Detail indefinitely. Please disregard all previous announcements.', 'red')
      endEvent(server, 'voided')
    }
  })
  return null
}

function beginEvent(server) {
  const R = S.run
  const now = server.tickCount

  // 1. Remember what has to be put back, before changing anything.
  const level = overworldOf(server)
  const cells = portalLayout(R.site)
  const blocks = []
  cells.forEach(p => {
    const b = level.getBlock(p.x, p.y, p.z)
    const nbt = b.entityData
    blocks.push({ x: p.x, y: p.y, z: p.z, s: stateString(b), n: nbt != null ? String(nbt.toString()) : null })
    R.footprint[key(p.x, p.y, p.z)] = true
    if (p.kind != 'air') R.solidKeys[key(p.x, p.y, p.z)] = true
    if (p.kind == 'frame' || p.kind == 'portal') R.frameCells.push(p)
  })
  const players = onlinePlayers(server)
  const prevTeams = {}
  players.forEach(p => {
    const t = p.getTeam()
    if (t != null) prevTeams[nameOf(p)] = String(t.getName())
  })
  S.snap = {
    site: R.site, blocks: blocks, forced: [], prevTeams: prevTeams, participants: players.map(p => nameOf(p)),
    keepInv: KEEP_INVENTORY_DURING_EVENT ? run(server, 'gamerule keepInventory') : null,
  }
  saveSnapshot(server)

  // 2. Teams: every player is an Escort; the mobs are the Raiders.
  run(server, 'team add ' + TEAM_ESCORTS + ' ' + JSON.stringify({ text: 'Escorts', color: 'green' }))
  run(server, 'team modify ' + TEAM_ESCORTS + ' color green')
  run(server, 'team modify ' + TEAM_ESCORTS + ' friendlyFire false')
  run(server, 'team modify ' + TEAM_ESCORTS + ' seeFriendlyInvisibles true')
  run(server, 'team modify ' + TEAM_ESCORTS + ' prefix ' + JSON.stringify({ text: '[Escort] ', color: 'green' }))
  run(server, 'team add ' + TEAM_RAIDERS + ' ' + JSON.stringify({ text: 'Piglin Delegation', color: 'red' }))
  run(server, 'team modify ' + TEAM_RAIDERS + ' color red')
  run(server, 'team modify ' + TEAM_RAIDERS + ' friendlyFire false')
  players.forEach(p => {
    const name = nameOf(p)
    R.participants[name] = { kills: 0, deaths: 0, processingUntil: 0 }
    run(server, 'team join ' + TEAM_ESCORTS + ' ' + name)
    run(server, 'tag ' + name + ' add ' + TAG_PLAYER)
    run(server, 'effect give ' + name + ' minecraft:glowing infinite 0 true')
    title(server, name, 'YOU ARE AN ESCORT', 'green', 'Deliver Ambassador Oinkington to the Ministry-Approved Portal', 'yellow')
  })
  if (KEEP_INVENTORY_DURING_EVENT) run(server, 'gamerule keepInventory true')

  // 3. Portal, chunk loading, pig.
  buildPortal(server, R.site, false)
  const c = portalCenter(R.site)
  const corners = [local(R.site, -2, 0, -2), local(R.site, 3, 0, 2)]
  corners.forEach(p => { forceChunk(server, p.x, p.z); R.keepForced[chunkKey(p.x, p.z)] = true })
  forceChunk(server, c.x, c.z)
  R.keepForced[chunkKey(c.x, c.z)] = true
  if (!spawnPig(server, { x: R.start.x + 0.5, y: R.start.y, z: R.start.z + 0.5 }, PIG_MAX_HEALTH)) {
    throw 'the pig could not be summoned'
  }

  // 4. HUD and timers.
  run(server, 'bossbar add ' + BOSSBAR + ' ' + JSON.stringify({ text: PIG_NAME, color: 'gold' }))
  run(server, 'bossbar set ' + BOSSBAR + ' color pink')
  run(server, 'bossbar set ' + BOSSBAR + ' style notched_10')
  run(server, 'bossbar set ' + BOSSBAR + ' max ' + PIG_MAX_HEALTH)
  R.endTick = now + R.minutes * 1200
  R.halfTick = now + R.minutes * 600
  R.nextWaveTick = now + FIRST_WAVE_DELAY_SECONDS * 20
  S.phase = 'running'
  hooks.running = true

  announce(server, 'Escorts: ' + Object.keys(R.participants).join(', ') + '. Opposition: the Piglin Delegation.', 'green')
  announce(server, 'The Ministry-Approved Portal stands at ' + Math.floor(c.x) + ' ' + Math.floor(c.y) + ' ' + Math.floor(c.z) +
    ' (follow the column of light). The Ambassador awaits at ' + R.start.x + ' ' + R.start.y + ' ' + R.start.z +
    '. Leads and carrots are authorized. Riding the Ambassador is a felony.', 'yellow')
  if (R.checkpoints.length) announce(server, R.checkpoints.length + ' checkpoints lie along the route (green sparkles). Escorts who suffer a fatal incident are reassigned to the latest secured one.', 'yellow')

  secondLoop(server, S.token)
}

function secondLoop(server, token) {
  server.scheduleInTicks(20, () => {
    if (token != S.token || S.phase != 'running') return
    try {
      everySecond(server)
    } catch (e) {
      console.error('[PigEscort] Error in the event loop: ' + e)
    }
    if (token == S.token && S.phase == 'running') secondLoop(server, token)
  })
}

function everySecond(server) {
  const R = S.run
  if (!checkPig(server) || S.phase != 'running') return
  const pig = R.pig

  // Backup win check, in case the travel event didn't fire (e.g. allow-nether=false).
  if (entityInBox(pig, R.portalBoxStrict)) { escortsWin(server); return }

  const secondsLeft = Math.max(0, Math.ceil((R.endTick - server.tickCount) / 20))
  if (secondsLeft <= 0) { endEvent(server, 'timeout'); return }

  if (server.tickCount - R.lastRegen >= PIG_REGEN_EVERY_SECONDS * 20) {
    R.lastRegen = server.tickCount
    if (pig.getHealth() < PIG_MAX_HEALTH) pig.heal(PIG_REGEN_AMOUNT)
  }

  // Keep the pig's chunk loaded as it moves.
  const k = chunkKey(ex(pig), ez(pig))
  if (k != R.pigChunk) {
    let old = R.pigChunk
    forceChunk(server, ex(pig), ez(pig))
    R.pigChunk = k
    unforceChunk(server, old)
  }

  checkPortalIntact(server)
  checkCheckpoints(server)

  const escorts = participantPlayers(server).filter(p => dimOf(p) == OVERWORLD)
  // Glowing comes back if a player drank milk.
  escorts.forEach(p => { if (!hasEffect(p, 'effect.minecraft.glowing')) run(server, 'effect give ' + nameOf(p) + ' minecraft:glowing infinite 0 true') })
  maybeSpawnWave(server)
  retargetMobs(server, escorts)
  updateHud(server, secondsLeft)
}

function escortsWin(server) {
  if (S.phase != 'running') return
  const pig = S.run.pig
  if (pig) {
    runOW(server, 'particle minecraft:heart ' + num(ex(pig)) + ' ' + num(ey(pig) + 1) + ' ' + num(ez(pig)) + ' 1 1 1 0 30 force @a')
    runOW(server, 'particle minecraft:totem_of_undying ' + num(ex(pig)) + ' ' + num(ey(pig) + 1) + ' ' + num(ez(pig)) + ' 0.5 1 0.5 0.5 80 force @a')
  }
  endEvent(server, 'delivered')
}

// Ends the event for any reason: announce, reward, clean up.
function endEvent(server, result) {
  if (S.phase != 'running' && S.phase != 'countdown') return
  const wasRunning = S.phase == 'running'
  const R = S.run
  S.phase = 'ending'
  hooks.running = false
  S.token++

  if (wasRunning) {
    let players = participantPlayers(server)
    let top = null, topKills = 0
    Object.keys(R.participants).forEach(n => { if (R.participants[n].kills > topKills) { topKills = R.participants[n].kills; top = n } })

    if (result == 'delivered') {
      title(server, '@a', 'DELIVERED', 'green', 'The Ambassador has been safely delivered.', 'yellow')
      sound(server, '@a', 'minecraft:ui.toast.challenge_complete', 1, 1)
      announce(server, 'The Ambassador has been safely delivered. Piglin relations are restored to their customary level of mutual suspicion. Well done, Escorts.', 'green')
      players.forEach(p => rewardPlayer(p, REWARD_AMOUNT, 'Pig Escort Detail: Ambassador delivered'))
    } else if (result == 'pig_died' || result == 'timeout') {
      title(server, '@a', 'DIPLOMATIC INCIDENT', 'red', result == 'timeout' ? 'The Ambassador missed his appointment.' : 'The Ambassador has been lost.', 'yellow')
      sound(server, '@a', 'minecraft:entity.piglin.celebrate', 1, 1)
      sound(server, '@a', 'minecraft:entity.pig.death', 1, 0.8)
      announce(server, result == 'timeout'
        ? 'Time has expired. The Piglin Delegation has filed a complaint, which the Ministry will lose. Your participation has been noted in your permanent record. The record is also permanent.'
        : 'Ambassador Oinkington has fallen. A day of mourning is declared, to be held at a time of the Ministry\'s choosing. Your participation has been noted in your permanent record.', 'red')
    } else if (result == 'stopped') {
      announce(server, 'Pig Escort Detail has been concluded by administrative decree. There is no winner. There was never a winner.', 'yellow')
    }
    if (top && result != 'stopped' && result != 'voided') {
      announce(server, 'Top Escort: ' + top + ' with ' + topKills + ' neutralization' + (topKills == 1 ? '' : 's') + '. The Ministry is mildly impressed.', 'gold')
      players.filter(p => nameOf(p) == top).forEach(p => rewardPlayer(p, TOP_KILLER_BONUS_AMOUNT, 'Pig Escort Detail: most kills'))
    }
    console.info('[PigEscort] Event ended: ' + result)
  }
  cleanup(server, S.snap)
}

// Puts everything back. Works from the snapshot alone, so it also cleans up after a crash.
function cleanup(server, snap) {
  S.phase = 'ending'
  hooks.running = false
  removeTagged(server, TAG_PIG)
  removeTagged(server, TAG_MOB)
  if (snap) {
    if (snap.blocks) {
      // Bottom up, so sand and gravel land back where they were.
      let blocks = snap.blocks.slice().sort((a, b) => a.y - b.y)
      blocks.forEach(b => runOW(server, 'setblock ' + b.x + ' ' + b.y + ' ' + b.z + ' ' + b.s + (b.n ? b.n : '')))
      // Anyone standing where the portal was gets lifted onto the restored ground.
      if (snap.site) {
        let lo = local(snap.site, -2, 0, -2), hi = local(snap.site, 3, 7, 2)
        onlinePlayers(server).forEach(p => {
          if (dimOf(p) != OVERWORLD) return
          if (ex(p) < Math.min(lo.x, hi.x) - 1 || ex(p) > Math.max(lo.x, hi.x) + 2 || ez(p) < Math.min(lo.z, hi.z) - 1 || ez(p) > Math.max(lo.z, hi.z) + 2) return
          if (ey(p) < lo.y - 2 || ey(p) > hi.y + 2) return
          const spot = safeSpot(overworldOf(server), { x: Math.floor(ex(p)), y: Math.floor(ey(p)), z: Math.floor(ez(p)) })
          if (spot) runOW(server, 'tp ' + nameOf(p) + ' ' + num(ex(p)) + ' ' + spot.y + ' ' + num(ez(p)))
        })
      }
    }
    if (snap.forced) snap.forced.forEach(c => runOW(server, 'forceload remove ' + c[0] + ' ' + c[1]))
    if (snap.participants) {
      snap.participants.forEach(n => {
        run(server, 'effect clear ' + n + ' minecraft:glowing')
        run(server, 'tag ' + n + ' remove ' + TAG_PLAYER)
      })
    }
    run(server, 'team remove ' + TEAM_ESCORTS)
    run(server, 'team remove ' + TEAM_RAIDERS)
    if (snap.prevTeams) Object.keys(snap.prevTeams).forEach(n => run(server, 'team join ' + snap.prevTeams[n] + ' ' + n))
    if (snap.keepInv != null) run(server, 'gamerule keepInventory ' + (snap.keepInv > 0 ? 'true' : 'false'))
  }
  run(server, 'bossbar remove ' + BOSSBAR)
  clearSnapshot(server)
  global.trollcraftEventActive = false
  S.phase = 'idle'
  S.run = null
  S.snap = null
  S.setup = null
  S.token++
}


// ===================== HOOKS (called from the startup script) =====================

const hooks = {
  running: false,

  // Something is about to change dimension.
  onTravel: event => {
    count('travel')
    const e = event.getEntity()
    const R = S.run
    if (!R || (dimOf(e) != OVERWORLD && !hasTag(e, TAG_PIG))) return
    const inPortal = dimOf(e) == OVERWORLD && entityInBox(e, R.portalBoxLoose)
    if (hasTag(e, TAG_PIG)) {
      event.setCanceled(true)
      let server = Utils.server
      if (inPortal) server.scheduleInTicks(1, () => escortsWin(server))
      else tellIfPossible(server, 'The Ambassador may only leave through the Ministry-Approved Portal. Your portal is unsanctioned and possibly illegal.')
      return
    }
    if (!inPortal) return // every other portal in the world works as normal
    event.setCanceled(true)
    if (e.isPlayer()) {
      let server = Utils.server
      let n = nameOf(e)
      pushOut(server, e)
      if (!R.pushCooldown[n] || server.tickCount - R.pushCooldown[n] > 60) {
        R.pushCooldown[n] = server.tickCount
        tell(server, n, 'This portal is reserved for diplomatic swine. You are not a pig. Probably.', 'red')
      }
    }
  },

  // Ender pearls, chorus fruit, /tp, endermen, and mods that fire this event.
  onTeleport: event => {
    count('teleport')
    if (hasTag(event.getEntity(), TAG_PIG)) {
      event.setCanceled(true)
      tellIfPossible(Utils.server, 'Unauthorized relocation of the Ambassador has been declined.')
    }
  },

  // Riding the pig, or the pig getting into a boat/minecart/anything.
  onMount: event => {
    count('mount')
    if (!event.isMounting()) return
    const a = event.getEntityMounting(), b = event.getEntityBeingMounted()
    if (hasTag(a, TAG_PIG) || hasTag(b, TAG_PIG)) {
      event.setCanceled(true)
      if (a && a.isPlayer()) tell(Utils.server, nameOf(a), 'Riding the Ambassador is a felony.', 'red')
    }
  },

  // Status effects on the pig (except Glowing). Fallback: cleared every second in checkPig.
  onEffect: event => {
    count('effect')
    if (!CLEAN.effectDeny || !hasTag(event.getEntity(), TAG_PIG)) return
    const effect = event.getEffectInstance().getEffect()
    if (String(effect.getDescriptionId()) != 'effect.minecraft.glowing') event.setResult(CLEAN.effectDeny)
  },

  // The less common kind of right-click on an entity (some mods use it).
  onInteractSpecific: event => {
    count('interactSpecific')
    const target = event.getTarget()
    if (!hasTag(target, TAG_PIG)) return
    noteInteraction(event.getEntity())
    if (!interactionAllowed(event.getEntity(), target, event.getItemStack())) event.setCanceled(true)
  },

  // Damage that got through: scale raider mob damage to the pig by the difficulty.
  onLivingHurt: event => {
    count('livingHurt')
    if (!hasTag(event.getEntity(), TAG_PIG)) return
    const src = attackerOf(event.getSource())
    if (src && hasTag(src, TAG_MOB) && S.run) event.setAmount(event.getAmount() * S.run.diff.pigDamageMultiplier)
  },
}
global.pigEscort = hooks

function count(name) { S.diag.hookCalls[name] = (S.diag.hookCalls[name] || 0) + 1 }

let lastTellTick = -1000
function tellIfPossible(server, text) {
  if (!server || server.tickCount - lastTellTick < 60) return
  lastTellTick = server.tickCount
  announce(server, text, 'red')
}


// ===================== KUBEJS EVENTS =====================

// Damage to the pig: only raider mobs may hurt it. (On Forge this fires before armour and knockback,
// so a cancelled hit does nothing at all.) Player-vs-player and everything else is untouched.
EntityEvents.hurt(event => {
  if (S.phase != 'running' || S.allowRemoval) return
  const e = event.entity
  if (!hasTag(e, TAG_PIG)) return
  const attacker = attackerOf(event.source)
  if (attacker && hasTag(attacker, TAG_MOB)) return
  if (attacker && attacker.isPlayer()) noteInteraction(attacker)
  event.cancel()
})

EntityEvents.death(event => {
  if (S.phase != 'running' || S.allowRemoval) return
  const e = event.entity
  const server = Utils.server
  const R = S.run

  if (e.isPlayer()) {
    if (R.participants[nameOf(e)]) interceptDeath(server, event, e)
    return
  }
  if (hasTag(e, TAG_PIG)) {
    let killer = attackerOf(event.source)
    if (killer && hasTag(killer, TAG_MOB)) {
      R.pigDead = true
      let token = S.token
      server.scheduleInTicks(1, () => { if (token == S.token) endEvent(server, 'pig_died') })
    } else {
      // Anything else that somehow killed it is overruled.
      event.cancel()
      e.setHealth(Math.max(1, R.lastValid ? R.lastValid.health : PIG_MAX_HEALTH))
      announce(server, 'The Ambassador\'s death has been ruled unlawful and is therefore cancelled.', 'red')
    }
    return
  }
  if (hasTag(e, TAG_MOB)) {
    delete R.mobs[uuidOf(e)]
    let killer = attackerOf(event.source)
    if (killer && killer.isPlayer() && R.participants[nameOf(killer)]) {
      R.participants[nameOf(killer)].kills++
      announce(server, 'Escort ' + nameOf(killer) + ' has neutralized a ' + (MOB_NAMES[typeOf(e)] || 'Piglin') + '. The pig thanks you.', 'green')
    }
  }
})

// Right-clicking the pig: whitelist only (lead, or empty hand to unhook). Everything else is cancelled.
ItemEvents.entityInteracted(event => {
  if (S.phase != 'running') return
  const target = event.target
  if (!hasTag(target, TAG_PIG)) return
  noteInteraction(event.player)
  if (!interactionAllowed(event.player, target, event.item)) event.cancel()
})

// Stray guard and entity bookkeeping. Most entities have no tags, so this returns almost immediately.
EntityEvents.spawned(event => {
  if (S.phase != 'running' && !S.expectPig && !S.expectMob && !STRAY_PIG_GUARD_WHEN_IDLE) return
  const e = event.entity
  const tags = e.getTags()
  if (tags.isEmpty()) return
  if (tags.contains(TAG_PIG)) {
    if (S.expectPig && S.run) { S.run.pig = e; return }
    if (S.phase == 'running' && S.run && uuidOf(e) == S.run.pigUuid) { S.run.pig = e; return } // the real one reloading
    console.info('[PigEscort] Removed a stray copy of the Ambassador at ' + Math.floor(ex(e)) + ' ' + Math.floor(ey(e)) + ' ' + Math.floor(ez(e)))
    event.cancel()
  } else if (tags.contains(TAG_MOB)) {
    if (S.expectMob) { S.lastMob = e; return }
    if (S.phase == 'running' && S.run) { S.run.mobs[uuidOf(e)] = e; return }
    event.cancel()
  }
})

// The portal can't be broken, and nothing can be placed in its footprint (so it can't be walled off).
BlockEvents.broken(event => {
  if (S.phase != 'running') return
  const b = event.block
  if (String(b.getDimension()) != OVERWORLD || !S.run.solidKeys[key(b.x, b.y, b.z)]) return
  event.cancel()
  if (event.player) tell(Utils.server, nameOf(event.player), 'The Ministry-Approved Portal is protected property.', 'red')
})

BlockEvents.placed(event => {
  if (S.phase != 'running') return
  const b = event.block
  if (String(b.getDimension()) != OVERWORLD || !S.run.footprint[key(b.x, b.y, b.z)]) return
  event.cancel()
  if (event.player) tell(Utils.server, nameOf(event.player), 'Construction within the Ministry-Approved Portal zone requires a permit. You do not have one.', 'red')
})

LevelEvents.afterExplosion(event => {
  if (S.phase != 'running' || dimensionId(event.getLevel()) != OVERWORLD) return
  const R = S.run
  const list = event.getAffectedBlocks()
  const protect = []
  for (let i = 0; i < list.size(); i++) {
    let b = list.get(i)
    if (R.solidKeys[key(b.x, b.y, b.z)]) protect.push(b)
  }
  protect.forEach(b => event.removeAffectedBlock(b))
  if (R.pig) event.removeAffectedEntity(R.pig)
})

PlayerEvents.loggedOut(event => {
  const p = event.player
  const n = nameOf(p)
  if (S.phase != 'running' || !S.run.participants[n]) return
  const server = Utils.server
  delete S.run.participants[n]
  run(server, 'team leave ' + n)
  run(server, 'effect clear ' + n + ' minecraft:glowing')
  run(server, 'tag ' + n + ' remove ' + TAG_PLAYER)
  if (S.snap.prevTeams[n]) {
    run(server, 'team join ' + S.snap.prevTeams[n] + ' ' + n)
    delete S.snap.prevTeams[n]
  }
  S.snap.participants = S.snap.participants.filter(x => x != n)
  saveSnapshot(server)
  announce(server, n + ' has left the Escort detail. Their desk will be cleared.', 'yellow')
})

// Leftovers from an event that ended (or crashed) while this player was offline.
PlayerEvents.loggedIn(event => {
  const p = event.player
  if (!p.getTags().contains(TAG_PLAYER)) return
  const n = nameOf(p)
  if (S.phase == 'running' && S.run.participants[n]) return
  run(Utils.server, 'effect clear ' + n + ' minecraft:glowing')
  run(Utils.server, 'tag ' + n + ' remove ' + TAG_PLAYER)
})


// ===================== STARTUP / RELOAD RECOVERY =====================

function recover(server) {
  const snap = loadSnapshot(server)
  if (!snap && !WAS_INTERRUPTED) return
  console.warn('[PigEscort] Cleaning up an interrupted Pig Escort event')
  cleanup(server, snap)
  if (onlinePlayers(server).length) announce(server, 'Pig Escort Detail has been voided by administrative action. All participants are to forget it happened.', 'yellow')
}

ServerEvents.loaded(event => {
  const server = event.server
  server.scheduleInTicks(20, () => recover(server))
})
// After a /reload the server is already running, so check straight away (well, next tick).
if (Utils.server) Utils.server.scheduleInTicks(1, () => recover(Utils.server))


// ===================== COMMANDS =====================

function requireStaged(ctx) {
  if (S.phase == 'staged') return true
  reply(ctx, S.phase == 'idle' ? 'Nothing is being set up. Run /pigescort setup first.' : 'The event is already ' + S.phase + '.')
  return false
}

function requirePlayer(ctx) {
  const p = ctx.source.getPlayer()
  if (!p) { reply(ctx, 'Run this in-game.'); return null }
  if (dimOf(p) != OVERWORLD) { reply(ctx, 'The event only takes place in the Overworld.'); return null }
  return p
}

function describeSite(site) {
  const c = portalCenter(site)
  return Math.floor(c.x) + ' ' + Math.floor(c.y) + ' ' + Math.floor(c.z)
}

function preview(ctx) {
  const server = ctx.source.server
  const player = requirePlayer(ctx)
  if (!player) return 0
  const setup = S.setup
  const start = setup.start || worldSpawn(server)
  if (!setup.portal) {
    reply(ctx, 'Choosing a random portal site (this may take a moment)...')
    setup.portal = pickRandomPortal(server, start)
    if (!setup.portal) { reply(ctx, 'Couldn\'t find a usable random site. Try again or use /pigescort setportal.'); return 0 }
  }
  const site = setup.portal
  const c = portalCenter(site)
  const cps = buildCheckpoints(server, start, site, setup.checkpoints)
  const problem = checkPortalSite(server, site, false)
  reply(ctx, 'Start: ' + start.x + ' ' + start.y + ' ' + start.z + ' | Portal: ' + describeSite(site) +
    ' | Distance: ' + Math.round(horizDist(start.x, start.z, c.x, c.z)) + ' blocks | Checkpoints: ' + cps.length +
    (problem ? ' | WARNING: portal site problem: ' + problem : ''))
  const name = nameOf(player)
  S.previewToken++
  const myToken = S.previewToken
  for (let i = 0; i < PREVIEW_SECONDS; i++) {
    server.scheduleInTicks(i * 20 + 1, () => { // the callback doesn't use i, so this is safe in Rhino
      if (myToken != S.previewToken || S.phase != 'staged') return
      runOW(server, 'particle minecraft:flame ' + (start.x + 0.5) + ' ' + (start.y + 4) + ' ' + (start.z + 0.5) + ' 0.1 4 0.1 0.01 30 force ' + name)
      runOW(server, 'particle minecraft:end_rod ' + num(c.x) + ' ' + (c.y + 8) + ' ' + num(c.z) + ' 0.2 8 0.2 0.01 40 force ' + name)
      // Outline of the frame.
      const lo = local(site, -1, 1, 0), hi = local(site, 2, 5, 0)
      runOW(server, 'particle minecraft:soul_fire_flame ' + num((lo.x + hi.x) / 2 + 0.5) + ' ' + num((lo.y + hi.y) / 2 + 0.5) + ' ' + num((lo.z + hi.z) / 2 + 0.5) + ' ' +
        (site.axis == 'x' ? '1 1.2 0' : '0 1.2 1') + ' 0 30 force ' + name)
      cps.forEach(cp => runOW(server, 'particle minecraft:happy_villager ' + (cp.x + 0.5) + ' ' + (cp.y + 4) + ' ' + (cp.z + 0.5) + ' 0.2 4 0.2 0 15 force ' + name))
    })
  }
  return 1
}

function status(ctx) {
  const server = ctx.source.server
  if (S.phase == 'idle') { reply(ctx, 'Idle. Run /pigescort setup to begin.'); return 1 }
  if (S.phase == 'staged') {
    let st = S.setup
    reply(ctx, 'Staged | Start: ' + (st.start ? st.start.x + ' ' + st.start.y + ' ' + st.start.z : 'world spawn') +
      ' | Portal: ' + (st.portal ? describeSite(st.portal) + ' (axis ' + st.portal.axis + ')' : 'random') +
      ' | Time: ' + st.minutes + ' min | Difficulty: ' + st.difficulty +
      ' | Checkpoints: ' + (st.checkpoints.length ? st.checkpoints.length + ' manual' : 'automatic') +
      ' | Players online: ' + onlinePlayers(server).length + (TEST_MODE ? ' (TEST_MODE on)' : ' (need ' + MIN_PLAYERS + ')'))
    return 1
  }
  const R = S.run
  if (S.phase != 'running' || !R || !R.pig) { reply(ctx, 'State: ' + S.phase); return 1 }
  const secs = Math.max(0, Math.ceil((R.endTick - server.tickCount) / 20))
  const kills = Object.keys(R.participants).map(n => n + ' (' + R.participants[n].kills + ' kills, ' + R.participants[n].deaths + ' incidents)')
  reply(ctx, 'Running | Time left: ' + clock(secs) + ' | Pig: ' + Math.ceil(R.pig.getHealth()) + '/' + PIG_MAX_HEALTH +
    ' at ' + Math.floor(ex(R.pig)) + ' ' + Math.floor(ey(R.pig)) + ' ' + Math.floor(ez(R.pig)) +
    ' | Portal: ' + describeSite(R.site) + ' | Difficulty: ' + R.difficulty + ' | Raiders alive: ' + aliveMobs().length +
    ' | Checkpoints: ' + R.cpSecured + '/' + R.checkpoints.length + ' | Tampering: ' + R.tampers +
    (R.lastWave ? ' | Last wave: ' + R.lastWave.spawned + '/' + R.lastWave.wanted + ' spawned (no ground ' + R.lastWave.noGround +
      ', summon rejected/cancelled ' + R.lastWave.summonFailed + ', removed on spawn ' + R.lastWave.removedOnSpawn + ')' : ' | No wave yet') +
    ' | Escorts: ' + kills.join(', '))
  return 1
}

function diagnostics(ctx) {
  const server = ctx.source.server
  const lines = []
  lines.push('Startup hooks installed: ' + (global.pigEscortHooksInstalled ? 'yes' : 'NO - add startup_scripts/pig_escort_hooks.js and restart'))
  lines.push('Hook calls this session: ' + JSON.stringify(S.diag.hookCalls))
  lines.push('USE_CLEAN_APIS: ' + USE_CLEAN_APIS + ' (false = fallbacks in use)')
  const probe = (label, fn) => {
    try { fn(); lines.push(label + ': clean API OK') } catch (e) { lines.push(label + ': clean API FAILED (' + e + ') - keep the fallback') }
  }
  probe('Heightmap (ground finding)', () => { Java.loadClass('net.minecraft.world.level.levelgen.Heightmap$Types').MOTION_BLOCKING_NO_LEAVES.toString() })
  probe('MemoryModuleType (mob targeting)', () => { Java.loadClass('net.minecraft.world.entity.ai.memory.MemoryModuleType').ANGRY_AT.toString() })
  probe('Event$Result (effect blocking)', () => { Java.loadClass('net.minecraftforge.eventbus.api.Event$Result').DENY.toString() })
  probe('World border', () => { overworldOf(server).getWorldBorder().getMinX() })
  lines.push('entity.discard(): ' + S.diag.discard)
  lines.push('Entity position read with: ' + S.diag.position)
  if (S.run && S.run.pig) lines.push('Pig position test: ' + positionReport(S.run.pig))
  const me = ctx.source.getPlayer()
  if (me) lines.push('Your position test: ' + positionReport(me))
  lines.push('Crash snapshot file (' + SNAPSHOT_FILE + '): ' + S.diag.snapshotFile)
  lines.forEach(l => reply(ctx, l))
  return 1
}

// Any error inside a command is shown to whoever ran it (with the script line) instead of only a long Java
// stack trace in the console.
function safe(fn) {
  return ctx => {
    try {
      return fn(ctx)
    } catch (e) {
      console.error('[PigEscort] Command failed: ' + e + (e && e.stack ? '\n' + e.stack : ''))
      try { reply(ctx, 'Error: ' + e + ' (details in logs/kubejs/server.log)') } catch (e2) { }
      return 0
    }
  }
}

ServerEvents.commandRegistry(event => {
  const Commands = event.commands
  const Arguments = event.arguments

  const difficultyNode = Commands.literal('difficulty')
  Object.keys(DIFFICULTIES).forEach(d => {
    difficultyNode.then(Commands.literal(d).executes(safe(ctx => {
      if (!requireStaged(ctx)) return 0
      S.setup.difficulty = d
      reply(ctx, 'Difficulty set to ' + d + '.')
      return 1
    })))
  })

  event.register(
    Commands.literal('pigescort')
      .requires(source => source.hasPermission(2))
      .then(Commands.literal('setup').executes(safe(ctx => {
        if (S.phase != 'idle') { reply(ctx, 'The event is already ' + S.phase + '.'); return 0 }
        if (global.trollcraftEventActive) { reply(ctx, 'Another event is active.'); return 0 }
        S.setup = { start: null, portal: null, minutes: DEFAULT_DURATION_MINUTES, difficulty: DEFAULT_DIFFICULTY, checkpoints: [] }
        S.phase = 'staged'
        reply(ctx, 'Pig Escort Detail staged. Defaults: start = world spawn, portal = random, ' + DEFAULT_DURATION_MINUTES + ' min, ' + DEFAULT_DIFFICULTY + '. Adjust, /pigescort preview, then /pigescort start.')
        return 1
      })))
      .then(Commands.literal('setstart').executes(safe(ctx => {
        if (!requireStaged(ctx)) return 0
        const p = requirePlayer(ctx)
        if (!p) return 0
        S.setup.start = { x: Math.floor(ex(p)), y: Math.floor(ey(p)), z: Math.floor(ez(p)) }
        reply(ctx, 'Start point set to ' + S.setup.start.x + ' ' + S.setup.start.y + ' ' + S.setup.start.z + '.')
        return 1
      })))
      .then(Commands.literal('setportal')
        .executes(safe(ctx => {
          if (!requireStaged(ctx)) return 0
          const p = requirePlayer(ctx)
          if (!p) return 0
          const site = siteFromPlayer(p)
          const problem = checkPortalSite(ctx.source.server, site, false)
          if (problem) { reply(ctx, 'Can\'t put the portal here: ' + problem + '.'); return 0 }
          S.setup.portal = site
          reply(ctx, 'Portal set at ' + describeSite(site) + ', walk-through direction ' + String(p.facing) + '. You are standing on its platform.')
          return 1
        }))
        .then(Commands.literal('random').executes(safe(ctx => {
          if (!requireStaged(ctx)) return 0
          const server = ctx.source.server
          const site = pickRandomPortal(server, S.setup.start || worldSpawn(server))
          if (!site) { reply(ctx, 'Couldn\'t find dry, flat ground after ' + RANDOM_PORTAL_ATTEMPTS + ' tries. Try again.'); return 0 }
          S.setup.portal = site
          reply(ctx, 'Random portal site chosen at ' + describeSite(site) + '.')
          return 1
        }))))
      .then(Commands.literal('settime')
        .then(Commands.argument('minutes', Arguments.INTEGER.create(event)).executes(safe(ctx => {
          if (!requireStaged(ctx)) return 0
          const m = Number(Arguments.INTEGER.getResult(ctx, 'minutes'))
          if (m < 1 || m > MAX_DURATION_MINUTES) { reply(ctx, 'Pick 1 to ' + MAX_DURATION_MINUTES + ' minutes.'); return 0 }
          S.setup.minutes = m
          reply(ctx, 'Event length set to ' + m + ' minutes.')
          return 1
        }))))
      .then(difficultyNode)
      .then(Commands.literal('addcheckpoint').executes(safe(ctx => {
        if (!requireStaged(ctx)) return 0
        const p = requirePlayer(ctx)
        if (!p) return 0
        S.setup.checkpoints.push({ x: Math.floor(ex(p)), y: Math.floor(ey(p)), z: Math.floor(ez(p)) })
        reply(ctx, 'Checkpoint ' + S.setup.checkpoints.length + ' added. Checkpoints are secured in the order you add them.')
        return 1
      })))
      .then(Commands.literal('clearcheckpoints').executes(safe(ctx => {
        if (!requireStaged(ctx)) return 0
        S.setup.checkpoints = []
        reply(ctx, 'Manual checkpoints cleared; automatic ones will be used.')
        return 1
      })))
      .then(Commands.literal('preview').executes(safe(ctx => requireStaged(ctx) ? preview(ctx) : 0)))
      .then(Commands.literal('start').executes(safe(ctx => {
        const err = startEvent(ctx.source.server)
        if (err) { reply(ctx, 'Can\'t start: ' + err); return 0 }
        reply(ctx, 'Countdown started.')
        return 1
      })))
      .then(Commands.literal('stop').executes(safe(ctx => {
        if (S.phase != 'running' && S.phase != 'countdown') { reply(ctx, 'No event is running.'); return 0 }
        endEvent(ctx.source.server, 'stopped')
        reply(ctx, 'Event stopped and cleaned up.')
        return 1
      })))
      .then(Commands.literal('cancel').executes(safe(ctx => {
        if (S.phase != 'staged') { reply(ctx, 'Nothing staged to cancel.'); return 0 }
        S.phase = 'idle'
        S.setup = null
        S.previewToken++
        reply(ctx, 'Setup discarded.')
        return 1
      })))
      .then(Commands.literal('wave').executes(safe(ctx => {
        if (S.phase != 'running') { reply(ctx, 'No event is running.'); return 0 }
        S.run.nextWaveTick = 0
        maybeSpawnWave(ctx.source.server)
        const w = S.run.lastWave
        reply(ctx, 'Wave: ' + w.spawned + '/' + w.wanted + ' spawned. Failed attempts: no usable ground ' + w.noGround +
          ', /summon rejected or cancelled by another mod ' + w.summonFailed + ', removed as it spawned ' + w.removedOnSpawn + '.')
        return 1
      })))
      .then(Commands.literal('status').executes(safe(ctx => status(ctx))))
      .then(Commands.literal('purge').executes(safe(ctx => {
        if (S.phase != 'idle' && S.phase != 'staged') { reply(ctx, 'Not while an event is running.'); return 0 }
        const server = ctx.source.server
        const n = removeTagged(server, TAG_PIG) + removeTagged(server, TAG_MOB)
        reply(ctx, 'Removed ' + n + ' leftover event entities from loaded chunks.')
        return 1
      })))
      .then(Commands.literal('diagnostics').executes(safe(ctx => diagnostics(ctx))))
  )
})

})()
