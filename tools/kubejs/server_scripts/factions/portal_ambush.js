// Portal Ambush: an add-on for the faction core (factions_core.js, global.Factions).
//
//  Mechanic 1 - Nether Ambush:     a ministry player who comes into the Nether (portal or waystone) may be
//                                  met by a war party (piglins and brutes) that only hunts ministry players.
//  Mechanic 2 - Return Inspection: a syndicate player who comes back to the Overworld (portal or waystone) may be
//                                  met by a patrol (vindicators and pillagers) that only hunts syndicate players.
//                                  Secrecy rule: never in front of anyone who isn't in the syndicate.
//  Mechanic 3 - Random Raids:      while a player stays in the dimension hostile to their faction, a per-player
//                                  10-minute countdown rolls for a light, moderate or lethal group (RAID_TIERS).
//
// Arrivals count by portal, waystone or any other trip (ARRIVALS_NEED_PORTAL). Once a group is out, there's no
// flying away: targets can't morph (Walkers/ReMorphed), the mobs reappear next to a target who gets away, flying
// pursuers go after anyone out of reach, and the group follows a target into another dimension. It ends when its
// mobs are dead, its targets are dead or gone, or its time is up.
//
// Mob names and every message are settings below; none of them names a faction, because the factions haven't
// been revealed to players yet.
//
// Needs: factions_core.js (it loads first) and startup_scripts/factions_hooks.js (portal travel events).
// Recommended: startup_scripts/portal_ambush_hooks.js (stops the mobs targeting anyone else at the source, and
// the ZERO_XP option). Restart once after adding a startup script. Without it the mobs are still kept on their
// targets every second and can't hurt anyone else; /ambush status says whether it's loaded.
//
// Admin commands (op level 2): /ambush test nether|overworld|raid <player>, /ambush timer <player>,
// /ambush status, /ambush clear, /ambush toggle. See FACTIONS.md for the test plan.
//
// Rules this file sticks to: event-driven, with one check per second only while something is active or a
// player is in their hostile dimension; no scoreboard teams; no /tellraw @a; saved data under its own key.
// KubeJS 6 notes: no template strings (strings are joined with +); `let` inside nested blocks; event.cancel()
// stops the handler immediately, so it always comes last.

(function () {

// ===================== SETTINGS =====================

const OVERWORLD = 'minecraft:overworld'
const NETHER = 'minecraft:the_nether'

// Which dimension is hostile to which faction (faction id -> dimension). Players of other factions are ignored.
const HOSTILE_DIMENSION = {
  ministry: NETHER,
  syndicate: OVERWORLD,
}

// --- Mechanic 1 and 2: portal arrivals ---
const NETHER_AMBUSH_CHANCE = 0.5        // chance a ministry arrival in the Nether is ambushed
const OVERWORLD_PATROL_CHANCE = 0.5     // chance a syndicate arrival in the Overworld is inspected
const ARRIVAL_GROUP_SECONDS = 10        // players coming through the same portal this close together share one roll
const ARRIVAL_GROUP_RADIUS = 8          // ...if they arrive within this many blocks of each other
const PORTAL_CHECK_RADIUS = 2           // a nether_portal block this close to the arrival point = came through a portal
const AMBUSH_DELAY_SECONDS = 3          // pause between arriving and the group appearing
const NETHER_AMBUSH_BASE_SIZE = 3       // +1 per extra target, up to the cap
const NETHER_AMBUSH_MAX_SIZE = 8
const PATROL_BASE_SIZE = 2
const PATROL_MAX_SIZE = 6

// --- Mechanic 3: random raids ---
const RAID_MINUTES = {}                 // countdown length (random between min and max), per hostile dimension.
RAID_MINUTES[NETHER] = [10, 10]         // It only runs while the player is in their hostile dimension and not
RAID_MINUTES[OVERWORLD] = [10, 10]      // fighting a group, and restarts when a raid starts.
// What a countdown reaching zero brings: one roll, at most one tier (chances add up to 0.85, so 15% = nothing).
// The post-ambush cooldown doesn't apply to these rolls (it still does to portal arrivals).
//   size     mobs (random between min and max), +1 per extra target, never more than GROUP_MAX_MOBS
//   health / damage   multiply the mob kinds' stats below
//   strength Strength level the mobs get for as long as they live (0 = none; 1 = Strength I, +3 melee damage)
//   mix      which mobs, per hostile dimension (nether / overworld); no mix = the war party's or patrol's own
//   maxEvokers  at most this many evokers in one group (their summoned vexes join the group too)
//   lethal   true = the lethal warning instead of the usual one
const RAID_TIERS = [
  { id: 'light', chance: 0.50, size: [2, 3], health: 0.75, damage: 0.75, strength: 0,
    mix: { nether: [['piglin', 1]], overworld: [['vindicator', 0.5], ['pillager', 0.5]] } },
  { id: 'moderate', chance: 0.25, size: [3, 5], health: 1, damage: 1, strength: 0 },
  { id: 'lethal', chance: 0.10, size: [6, 8], health: 1.5, damage: 1.25, strength: 1, maxEvokers: 2, lethal: true,
    mix: { nether: [['brute', 0.45], ['piglin', 0.25], ['evoker', 0.15], ['vex', 0.15]],
           overworld: [['vindicator', 0.45], ['pillager', 0.15], ['evoker', 0.2], ['vex', 0.2]] } },
]
// Vexes in an ambush group (lethal raids' own, and the ones their evokers summon) get these effects for as long as
// they live, instead of the tier's Strength. Levels: 3 = Strength III (+9 melee damage) and Speed III. 0 = none.
const VEX_EFFECTS = { strength: 3, speed: 3 }
const RAID_SPOT_TRIES = 16              // spots checked for one out of the player's line of sight
const RAID_WARNING_SECONDS = 3          // the warning comes this long before the raid arrives
const RAID_POSTPONE_MINUTES = [2, 5]    // Overworld raid with a witness nearby: try again after this long...
const RAID_MAX_POSTPONES = 3            // ...this many times, then start a new countdown

// --- Shared ---
// How far away every group spawns: [min, max] blocks from the player (raids, contracts) or from the arrival
// point (portal ambushes). Raids and contracts prefer spots out of the player's sight; this close there often
// isn't one, and then a mob can appear in view.
const SPAWN_DISTANCE = [8, 10]
const EXTRA_TARGET_RADIUS = 24          // other same-faction players this close join the group (and add a mob each)
const RETARGET_RADIUS = 32              // mobs only chase targets this close; raid targets are picked within this
const SECRECY_RADIUS = 48               // syndicate rule: nobody outside the syndicate this close, or no patrol
const TARGET_LOST_SECONDS = 60          // group leaves this long after every target is offline (or in creative/spectator)
const GROUP_MAX_MINUTES = 10            // group leaves after this long, whatever happens
const COOLDOWN_MINUTES = 10             // after a group ends, its targets can't be targeted again for this long
const GROUP_MAX_MOBS = 8                // hard cap per group
const SERVER_MAX_MOBS = 24              // hard cap for all ambush mobs alive at once
const SPAWN_SAFE_RADIUS = 64            // nothing happens within this many blocks of world spawn (Overworld)...
const PIG_ESCORT_PORTAL_RADIUS = 64     // ...or of an active Pig Escort event portal
// Other safe areas: { dim, x, z, r } (a circle of radius r). Countdowns pause and nothing spawns inside.
const SAFE_ZONES = [
  // { dim: OVERWORLD, x: 0, z: 0, r: 100 },
]
const ZERO_XP = false                   // true = ambush mobs drop no XP (needs portal_ambush_hooks.js)
const ENABLED_BY_DEFAULT = true         // /ambush toggle changes this and the change is saved

// --- No getting away ---
// Walkers / ReMorphed: a target is turned back into a human and can't morph (Walkers' player blacklist) until they
// leave the group: it ends, they die, or they log out and it ends. Without Walkers nothing happens.
const MORPH_LOCK = true
// A target further than `distance` blocks from every mob for `seconds`: the mobs that aren't fighting anyone else
// reappear `spot` blocks from them. Distance never ends a group; its time, deaths and logouts do.
const FOLLOW = { distance: 24, seconds: 5, spot: [8, 10] }
// A target out of reach (gliding, flying, aboveGround+ blocks over the ground, or nowhere to stand near them) for
// airborneSeconds: a flying pursuer joins the group, at most perGroup, one every cooldownSeconds. They're on top of
// GROUP_MAX_MOBS (SERVER_MAX_MOBS still applies) and get VEX_EFFECTS when they're vexes.
const FLYERS = { kind: 'vex', perGroup: 2, airborneSeconds: 3, cooldownSeconds: 20, aboveGround: 6 }
// A target who changes dimension (portal, waystone, /tp) is followed: DIMENSION_DELAY_SECONDS after they arrive,
// the mobs chasing them reappear next to them there (fresh copies of the same kinds). false = the trip is an escape.
const FOLLOW_ACROSS_DIMENSIONS = true
const DIMENSION_DELAY_SECONDS = 2
// false = any Overworld <-> Nether trip can bring an arrival ambush (waystones, mods); true = only Nether portals.
const ARRIVALS_NEED_PORTAL = false

// --- The war party (Nether) ---
const WAR_PARTY = {
  name: 'Blood-Marked Piglin',
  nameColor: 'dark_red',
  chestplateColor: 0x8B0000,            // dark red leather
  mix: [['piglin', 0.7], ['brute', 0.3]],
  reward: { item: 'minecraft:gold_nugget', min: 1, max: 3 },   // dropped by each one killed
}

// --- The patrol (Overworld) ---
const PATROL = {
  name: 'Ministry Inspector',
  nameColor: 'gold',
  chestplateColor: 0xD4AF37,            // gold leather
  mix: [['vindicator', 0.5], ['pillager', 0.5]],
  reward: { item: 'minecraft:emerald', min: 0, max: 1 },
}

// Mob kinds: entity id, weapon choices [weapon, weight] and how tough they are.
// A weapon is { item, enchants: { enchantment: level } }. ammo (crossbow users only) goes in the off hand and
// is shot instead of plain arrows until it runs out.
// Stats are tuned for players in full diamond or netherite armour with Protection IV:
//   health      max health (vanilla: piglin 16, brute 50, vindicator 24, pillager 24)
//   damage      melee damage before the weapon and Sharpness (vanilla: 5)
//   armor       built-in armour that doesn't show (a full netherite set is 20)
//   toughness   built-in armour toughness (a full netherite set is 12)
//   knockback   knockback resistance, 0 (none) to 1 (immune)
// On Normal, against full netherite with Protection IV, a brute hits for about 2 hearts and a sword piglin or
// vindicator for 1 to 1.5, plus fire or Harming. Hard is 1.5 times that; without Protection, about 3 times.
const MOB_KINDS = {
  piglin: {
    id: 'minecraft:piglin', piglin: true,
    weapons: [
      [{ item: 'minecraft:netherite_sword', enchants: { sharpness: 5, fire_aspect: 2 } }, 0.5],
      [{ item: 'minecraft:crossbow', enchants: { quick_charge: 3, multishot: 1 } }, 0.5],
    ],
    stats: { health: 40, damage: 9, armor: 10, toughness: 4, knockback: 0.3 },
  },
  brute: {
    id: 'minecraft:piglin_brute', piglin: true,
    weapons: [[{ item: 'minecraft:netherite_axe', enchants: { sharpness: 5 } }, 1]],
    stats: { health: 90, damage: 14, armor: 16, toughness: 8, knockback: 0.6 },
  },
  vindicator: {
    id: 'minecraft:vindicator', illager: true,
    weapons: [[{ item: 'minecraft:netherite_axe', enchants: { sharpness: 5 } }, 1]],
    stats: { health: 50, damage: 9, armor: 12, toughness: 6, knockback: 0.4 },
  },
  pillager: {
    id: 'minecraft:pillager', illager: true,
    weapons: [[{ item: 'minecraft:crossbow', enchants: { quick_charge: 2, piercing: 2 } }, 1]],
    ammo: { item: 'minecraft:tipped_arrow', potion: 'minecraft:harming', count: 64 },   // 3 hearts, ignores armour (not Protection)
    stats: { health: 36, damage: 5, armor: 8, toughness: 4, knockback: 0.2 },
  },
  // Lethal raids only (RAID_TIERS). An evoker's own summoned vexes join its group.
  evoker: {
    id: 'minecraft:evoker', illager: true,
    weapons: [],
    stats: { health: 60, armor: 8, toughness: 4, knockback: 0.3 },
  },
  vex: {
    id: 'minecraft:vex',
    weapons: [[{ item: 'minecraft:iron_sword', enchants: { sharpness: 3 } }, 1]],
    stats: { health: 20, damage: 6 },
  },
}

// --- Messages (only the targeted players see them) ---
const VOICE_SIGNAL = { tag: '[SIGNAL HIJACKED]', tagColor: 'dark_red', textColor: 'red' }
const VOICE_MINISTRY = { tag: '[MINISTRY]', tagColor: 'gold', textColor: 'yellow' }
const MESSAGES = {
  nether_ambush: { voice: VOICE_SIGNAL, text: 'Blood for the Blood God.', sound: 'minecraft:entity.piglin_brute.angry' },
  return_inspection: { voice: VOICE_MINISTRY, text: 'Routine border inspection. Please do not resist.', sound: 'minecraft:event.raid.horn' },
  raid_warning_nether: { voice: VOICE_SIGNAL, text: 'The Blood God has found you.', sound: 'minecraft:entity.piglin.angry' },
  raid_warning_overworld: { voice: VOICE_MINISTRY, text: 'Inspectors have been dispatched to your location.', sound: 'minecraft:block.bell.use' },
  lethal_warning_nether: { voice: VOICE_SIGNAL, text: 'The Blood God demands your blood.', sound: 'minecraft:entity.elder_guardian.curse' },
  lethal_warning_overworld: { voice: VOICE_MINISTRY, text: 'Lethal force has been authorised.', sound: 'minecraft:event.raid.horn' },
}


// ===================== STATE =====================

const TAG = 'portal_ambush'
const TAG_SUMMONED = 'portal_ambush_summoned'
const DATA_KEY = 'portal_ambush'
const SAVE_EVERY_SECONDS = 15
const TWO_PI = 6.283185307179586   // Math.PI is missing in the server's script engine

// Kept across /reload. Groups from before a /reload are ended (their mobs removed) when the script loads.
if (!global.portalAmbushState) global.portalAmbushState = { token: 0, groups: {}, mobGroup: {}, inGroup: {}, buckets: [], counter: 0 }
const S = global.portalAmbushState
if (!S.lastArrival) S.lastArrival = {}
if (!S.parkedGroup) S.parkedGroup = {}   // mob uuid -> group id, for group mobs whose chunk unloaded (see tickGroup)
S.token++                 // stops loops and timers from before a /reload
S.loopRunning = false
S.expectMob = false
S.lastMob = null
S.allowRemoval = false

// Optional Minecraft classes (the same ones Pig Escort uses for targeting).
let MEMORY = null, WALK_TARGET = null, SERIALIZER = null
try { MEMORY = Java.loadClass('net.minecraft.world.entity.ai.memory.MemoryModuleType') } catch (e) { }
try { WALK_TARGET = Java.loadClass('net.minecraft.world.entity.ai.memory.WalkTarget') } catch (e) { }
// fromJsonLenient, not fromJson: fromJson has a text and a JSON-object version, and KubeJS can turn a
// string into either, so the script engine refuses to pick one ("ambiguous").
try { SERIALIZER = Java.loadClass('net.minecraft.network.chat.Component$Serializer') } catch (e) { }


// ===================== SMALL HELPERS (from pig_escort.js) =====================

function nameOf(p) { return String(p.getGameProfile().getName()) }
function uuidOf(e) {
  try { return String(e.getStringUuid()).toLowerCase() } catch (err) { }   // KubeJS's name for getStringUUID
  return String(e.getStringUUID()).toLowerCase()
}
function javaUuidOf(e) { return typeof e.getUuid == 'function' ? e.getUuid() : e.getUUID() }
const POS_WAYS = [
  (e, k) => e['get' + k.toUpperCase()](),
  (e, k) => { const v = e.position(); return typeof v[k] == 'function' ? v[k]() : v[k] },
  (e, k) => Number(e.block[k]) + (k == 'y' ? 0 : 0.5),
  (e, k) => e[k],
]
function coord(e, k) {
  for (let i = 0; i < POS_WAYS.length; i++) {
    let v = NaN
    try { v = Number(POS_WAYS[i](e, k)) } catch (err) { }
    if (isFinite(v)) return v
  }
  throw new Error('could not read the position of ' + e)
}
function posOf(e) { return { x: coord(e, 'x'), y: coord(e, 'y'), z: coord(e, 'z') } }
function dist(a, b) { const dx = a.x - b.x, dy = a.y - b.y, dz = a.z - b.z; return Math.sqrt(dx * dx + dy * dy + dz * dz) }
function horiz(a, b) { const dx = a.x - b.x, dz = a.z - b.z; return Math.sqrt(dx * dx + dz * dz) }
function attackerOf(source) {
  try { return source.actual } catch (e) { }   // KubeJS's name for DamageSource.getEntity
  try { return source.getActual() } catch (e) { }
  return null
}
function overworldOf(server) { const o = server.overworld; return typeof o == 'function' ? server.overworld() : o }
function levelOf(e) { const l = e.level; return typeof l == 'function' ? e.level() : l }
function dimensionId(level) {
  let d = level.dimension
  if (typeof d == 'function') d = level.dimension()
  if (d != null && typeof d.location == 'function') d = d.location()
  return String(d)
}
function dimOf(e) { return dimensionId(levelOf(e)) }
function hasTag(e, tag) { return e != null && e.getTags().contains(tag) }
function typeOf(e) { const id = e.getEncodeId(); return id == null ? '' : String(id) }
function onlinePlayers(server) {
  const list = server.players
  const out = []
  for (let i = 0; i < list.size(); i++) out.push(list.get(i))
  return out
}
function isAirId(id) { return id == 'minecraft:air' || id == 'minecraft:cave_air' || id == 'minecraft:void_air' }
function isFluidId(id) { return id.indexOf('water') >= 0 || id.indexOf('lava') >= 0 || id == 'minecraft:bubble_column' || id.indexOf('kelp') >= 0 || id.indexOf('seagrass') >= 0 }
function isBadGround(id) { return id.indexOf('leaves') >= 0 || id.indexOf('_log') >= 0 || id.indexOf('_wood') >= 0 || id == 'minecraft:powder_snow' || id == 'minecraft:magma_block' || id == 'minecraft:cactus' || id == 'minecraft:bedrock' }
function isSolid(block, id) {
  try { return block.blockState.blocksMotion() } catch (e) { return !isAirId(id) }
}
function canBeTargeted(p) {
  try { return p.isAlive() && !p.isCreative() && !p.isSpectator() } catch (e) { return true }
}
function isSpectator(p) { try { return p.isSpectator() } catch (e) { return false } }
function randInt(min, max) { return min + Math.floor(Math.random() * (max - min + 1)) }
function pickWeighted(list) {
  let total = 0
  list.forEach(x => { total += x[1] })
  let roll = Math.random() * total
  for (let i = 0; i < list.length; i++) {
    roll -= list[i][1]
    if (roll <= 0) return list[i][0]
  }
  return list[0][0]
}
function clock(seconds) {
  seconds = Math.max(0, Math.round(seconds))
  const m = Math.floor(seconds / 60), s = seconds % 60
  return m + ':' + (s < 10 ? '0' : '') + s
}
function factionOf(p) {
  try { return String(global.Factions.getFaction(p)) } catch (e) { return '' }
}
function huntedDimOf(p) { return HOSTILE_DIMENSION[factionOf(p)] || null }
function factionHuntedIn(dim) {
  const ids = Object.keys(HOSTILE_DIMENSION)
  for (let i = 0; i < ids.length; i++) if (HOSTILE_DIMENSION[ids[i]] == dim) return ids[i]
  return null
}


// ===================== MESSAGES =====================

function comp(parts) {
  const json = JSON.stringify([''].concat(parts))
  if (SERIALIZER) {
    try { return SERIALIZER.fromJsonLenient(json) } catch (e) { }
  }
  return Text.of(parts.map(p => p.text || '').join(''))
}
function sendMessage(server, players, key) {
  const m = MESSAGES[key]
  const line = comp([{ text: m.voice.tag, color: m.voice.tagColor, bold: true }, { text: ' ' + m.text, color: m.voice.textColor }])
  players.forEach(p => {
    try { p.tell(line) } catch (e) { }
    if (m.sound) {
      try { server.runCommandSilent('execute as ' + nameOf(p) + ' at @s run playsound ' + m.sound + ' hostile @s ~ ~ ~ 1 1') } catch (e) { }
    }
  })
}


// ===================== SAVED DATA =====================
// server.persistentData['portal_ambush'] = JSON { v, enabled, cooldowns: { uuid: untilMs }, raid: { uuid: { left, postpones, tier } },
//   morphLocked: { uuid: name } }
// Only this key is ever touched. Raid countdowns are seconds left, so logging out or restarting doesn't reset
// them or set them off early. Cooldowns are real-time end times.

let DB = null
let lastSave = 0, dirty = false
function db() {
  if (DB) return DB
  let raw = ''
  try { raw = String(Utils.server.persistentData.getString(DATA_KEY) || '') } catch (e) { }
  let parsed = null
  if (raw) {
    try { parsed = JSON.parse(raw) } catch (e) {
      Utils.server.persistentData.putString(DATA_KEY + '_unreadable_' + Date.now(), raw)
      console.error('[PortalAmbush] Saved data could not be read (' + e + '); a copy was kept and it starts fresh.')
    }
  }
  DB = parsed && parsed.v ? parsed : { v: 1, enabled: ENABLED_BY_DEFAULT }
  if (!DB.cooldowns) DB.cooldowns = {}
  if (!DB.raid) DB.raid = {}
  if (!DB.morphLocked) DB.morphLocked = {}   // uuid -> name: players this script has blocked from morphing
  // Countdowns saved under longer settings are cut to the longest one now.
  const longest = Math.max.apply(null, Object.keys(RAID_MINUTES).map(d => RAID_MINUTES[d][1])) * 60
  Object.keys(DB.raid).forEach(u => { if (DB.raid[u] && DB.raid[u].left > longest) DB.raid[u].left = longest })
  if (typeof DB.enabled != 'boolean') DB.enabled = ENABLED_BY_DEFAULT
  return DB
}
function save() {
  const now = Date.now()
  const cd = db().cooldowns
  Object.keys(cd).forEach(u => { if (cd[u] <= now) delete cd[u] })
  Utils.server.persistentData.putString(DATA_KEY, JSON.stringify(DB))
  lastSave = now
  dirty = false
}
function saveSoon() {
  dirty = true
  if (Date.now() - lastSave >= SAVE_EVERY_SECONDS * 1000) save()
}

function cooldownLeftMs(uuid) {
  const t = db().cooldowns[uuid]
  return t && t > Date.now() ? t - Date.now() : 0
}
function startCooldown(uuid) {
  db().cooldowns[uuid] = Date.now() + COOLDOWN_MINUTES * 60000
  dirty = true
}
function newRaidTimer(dim) {
  const r = RAID_MINUTES[dim] || [10, 10]
  return { left: Math.round((r[0] + Math.random() * (r[1] - r[0])) * 60), postpones: 0, postponed: false }
}
function tierById(id) { return RAID_TIERS.filter(t => t.id == id)[0] || null }
// One roll for a countdown that reached zero: a tier, or null (nothing this time).
// anyTier (the test command): never nothing, the tiers in proportion to their chances.
function pickTier(anyTier) {
  let total = 0
  RAID_TIERS.forEach(t => { total += t.chance })
  let roll = Math.random() * (anyTier ? total : 1)
  for (let i = 0; i < RAID_TIERS.length; i++) {
    if (roll < RAID_TIERS[i].chance) return RAID_TIERS[i]
    roll -= RAID_TIERS[i].chance
  }
  return null
}
function tierOdds() {
  let none = 1
  RAID_TIERS.forEach(t => { none -= t.chance })
  return RAID_TIERS.map(t => t.id + ' ' + Math.round(t.chance * 100) + '%').join(', ') + ', nothing ' + Math.max(0, Math.round(none * 100)) + '%'
}


// ===================== CONDITIONS =====================

function isEnabled() { return db().enabled }
function isPeaceful(server) {
  try {
    let d = overworldOf(server).getDifficulty()   // Minecraft's Difficulty: PEACEFUL, EASY, NORMAL, HARD
    if (d != null) return String(d).toLowerCase().indexOf('peaceful') >= 0
  } catch (e) { }
  try { return server.runCommandSilent('difficulty') == 0 } catch (e) { }
  return false
}
function worldSpawn(server) {
  const p = overworldOf(server).getSharedSpawnPos()
  return { x: p.getX(), y: p.getY(), z: p.getZ() }
}
function pigEscortActive() {
  const pe = global.pigEscortState
  return pe && (pe.phase == 'countdown' || pe.phase == 'running' || pe.phase == 'ending') && pe.run && pe.run.site ? pe : null
}
function isPigEscortParticipant(p) {
  const pe = pigEscortActive()
  return !!(pe && hasTag(p, 'pig_escort_participant'))
}
// Inside a configured safe zone, near world spawn, or near an active Pig Escort portal.
function inSafeZone(server, dim, pos) {
  for (let i = 0; i < SAFE_ZONES.length; i++) {
    let z = SAFE_ZONES[i]
    if (z.dim == dim && horiz(pos, z) <= z.r) return true
  }
  if (dim == OVERWORLD) {
    try { if (horiz(pos, worldSpawn(server)) <= SPAWN_SAFE_RADIUS) return true } catch (e) { }
    let pe = pigEscortActive()
    if (pe && horiz(pos, pe.run.site) <= PIG_ESCORT_PORTAL_RADIUS) return true
  }
  return false
}
// Can this player be put in a new group? opts.ignoreCooldown / opts.anyFaction are for the test commands.
function eligible(server, p, factionId, opts) {
  opts = opts || {}
  const uuid = uuidOf(p)
  if (!opts.anyFaction && factionOf(p) != factionId) return false
  if (S.inGroup[uuid]) return false
  if (!opts.ignoreCooldown && cooldownLeftMs(uuid) > 0) return false
  if (!canBeTargeted(p) || isPigEscortParticipant(p)) return false
  if (!opts.ignoreSafeZones && inSafeZone(server, dimOf(p), posOf(p))) return false
  return true
}
// Secrecy rule: players near pos (same dimension) who aren't in the syndicate. Spectators don't count.
function witnesses(server, dim, pos) {
  return onlinePlayers(server).filter(p => dimOf(p) == dim && !isSpectator(p) && factionOf(p) != 'syndicate' && dist(posOf(p), pos) <= SECRECY_RADIUS)
}
function nearbyEligible(server, factionId, dim, pos, radius, exclude, opts) {
  return onlinePlayers(server).filter(p => exclude.indexOf(uuidOf(p)) < 0 && dimOf(p) == dim && dist(posOf(p), pos) <= radius && eligible(server, p, factionId, opts))
}


// ===================== SPAWNING =====================

// Scans one column down from fromY for solid ground with 2 free blocks above (pig_escort.js findGround).
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

// A random standable spot minD..maxD blocks from center, or null: never inside blocks, in fluid, on bad ground
// or over the void, and in the Nether always below the bedrock roof.
function randomSpot(level, dim, center, minD, maxD) {
  const angle = Math.random() * TWO_PI
  const d = minD + Math.random() * (maxD - minD)
  const x = Math.floor(center.x + Math.cos(angle) * d)
  const z = Math.floor(center.z + Math.sin(angle) * d)
  let top = Math.floor(center.y) + 8
  if (dim == NETHER) top = Math.min(top, 122)
  const g = findGround(level, x, z, top, Math.floor(center.y) - 16)
  if (!g || g.fluid || g.bad) return null
  return { x: x + 0.5, y: g.y + 1, z: z + 0.5 }
}

// True if something solid blocks the straight line from the player's eyes to the spot.
function hiddenFrom(level, eye, spot) {
  const target = { x: spot.x, y: spot.y + 1.5, z: spot.z }
  const steps = Math.max(1, Math.ceil(dist(eye, target)))
  for (let i = 1; i < steps; i++) {
    let t = i / steps
    let x = Math.floor(eye.x + (target.x - eye.x) * t), y = Math.floor(eye.y + (target.y - eye.y) * t), z = Math.floor(eye.z + (target.z - eye.z) * t)
    let block = level.getBlock(x, y, z)
    if (isSolid(block, String(block.id))) return true
  }
  return false
}

function pickSpot(level, dim, center, minD, maxD, hideFrom) {
  let fallback = null
  for (let i = 0; i < (hideFrom ? RAID_SPOT_TRIES : 12); i++) {
    let s = randomSpot(level, dim, center, minD, maxD)
    if (!s) continue
    if (!hideFrom) return s
    if (!fallback) fallback = s
    if (hideFrom.some(eye => hiddenFrom(level, eye, s))) return s
  }
  return fallback
}

function snbtString(s) { return "'" + String(s).replace(/\\/g, '\\\\').replace(/'/g, "\\'") + "'" }

function weaponNbt(w) {
  const ench = Object.keys(w.enchants || {}).map(e => '{id:"minecraft:' + e + '",lvl:' + w.enchants[e] + 's}')
  return '{id:"' + w.item + '",Count:1b' + (ench.length ? ',tag:{Enchantments:[' + ench.join(',') + ']}' : '') + '}'
}
function ammoNbt(a) {
  if (!a) return '{}'
  return '{id:"' + a.item + '",Count:' + (a.count || 64) + 'b' + (a.potion ? ',tag:{Potion:"' + a.potion + '"}' : '') + '}'
}
function attributesNbt(st) {
  const list = ['{Name:"minecraft:generic.follow_range",Base:48d}']
  if (st.health) list.push('{Name:"minecraft:generic.max_health",Base:' + st.health + 'd}')
  if (st.damage) list.push('{Name:"minecraft:generic.attack_damage",Base:' + st.damage + 'd}')
  if (st.armor) list.push('{Name:"minecraft:generic.armor",Base:' + st.armor + 'd}')
  if (st.toughness) list.push('{Name:"minecraft:generic.armor_toughness",Base:' + st.toughness + 'd}')
  if (st.knockback) list.push('{Name:"minecraft:generic.knockback_resistance",Base:' + st.knockback + 'd}')
  return '[' + list.join(',') + ']'
}

// A raid tier's health and damage multipliers on a mob kind's stats.
function scaledStats(st, tier) {
  if (!tier) return st
  const out = {}
  Object.keys(st).forEach(k => { out[k] = st[k] })
  if (out.health) out.health = Math.round(out.health * (tier.health || 1))
  if (out.damage) out.damage = Math.round(out.damage * (tier.damage || 1))
  return out
}
function mobNbt(kindName, def, groupId, tier, extraTag) {
  const kind = MOB_KINDS[kindName]
  const weapon = kind.weapons.length ? pickWeighted(kind.weapons) : null
  const stats = scaledStats(kind.stats || {}, tier)
  let nbt = '{PersistenceRequired:1b,CanPickUpLoot:0b,DeathLootTable:"minecraft:empty"' +
    ',Tags:["' + TAG + '","' + TAG + '_g_' + groupId + '"' + (extraTag ? ',"' + extraTag + '"' : '') + ']' +
    ',CustomName:' + snbtString(JSON.stringify({ text: def.name, color: def.nameColor, italic: false })) + ',CustomNameVisible:1b' +
    ',HandItems:[' + (weapon ? weaponNbt(weapon) : '{}') + ',' + (weapon && weapon.item == 'minecraft:crossbow' ? ammoNbt(kind.ammo) : '{}') + '],HandDropChances:[0f,0f]' +
    ',ArmorItems:[{},{},{id:"minecraft:leather_chestplate",Count:1b,tag:{display:{color:' + def.chestplateColor + '}}},{}]' +
    ',ArmorDropChances:[0f,0f,0f,0f]' +
    ',Attributes:' + attributesNbt(stats) + (stats.health ? ',Health:' + stats.health + 'f' : '')
  if (kind.piglin) nbt += ',IsImmuneToZombification:1b,CannotHunt:1b'
  if (kind.illager) nbt += ',CanJoinRaid:0b,PatrolLeader:0b,Patrolling:0b'
  return nbt + '}'
}

// Summons one mob and returns it (caught as it joins the world), or null.
function summonMob(server, dim, kindName, def, groupId, spot, tier, extraTag) {
  S.lastMob = null
  S.expectMob = true
  let result = 0
  try {
    result = server.runCommandSilent('execute in ' + dim + ' run summon ' + MOB_KINDS[kindName].id + ' ' + spot.x + ' ' + spot.y + ' ' + spot.z + ' ' + mobNbt(kindName, def, groupId, tier, extraTag))
  } finally {
    S.expectMob = false
  }
  const m = S.lastMob
  S.lastMob = null
  return result && m ? m : null
}

function aliveAmbushMobs() {
  let n = 0
  Object.keys(S.groups).forEach(id => { n += Object.keys(S.groups[id].mobs).length })
  return n
}


// ===================== GROUPS =====================

// The group definition: given by the caller (API, e.g. contracts), or by mechanic and dimension.
function defOf(g) { return g.def || defFor(g.mechanic, g.dim) }
function defFor(mechanic, dim) {
  if (mechanic == 'nether_ambush') return WAR_PARTY
  if (mechanic == 'return_inspection') return PATROL
  return dim == NETHER ? WAR_PARTY : PATROL
}

function updateHookState() {
  if (global.portalAmbushHooks) global.portalAmbushHooks.anyActive = Object.keys(S.groups).length > 0
}

// Creates a group around center and spawns up to `size` mobs. targets: player objects. Returns the group or null.
// tier (raids): RAID_TIERS entry for the mix, stats, Strength and evoker cap.
// opts (global.PortalAmbush.startGroup): { def, onEnd(group, reason), contractId, extraTag }.
function startGroup(server, mechanic, dim, center, targets, size, minD, maxD, hideFrom, tier, opts) {
  opts = opts || {}
  const level = levelOf(targets[0])
  const room = Math.min(size, GROUP_MAX_MOBS, SERVER_MAX_MOBS - aliveAmbushMobs())
  if (room <= 0) return null
  S.counter++
  const id = Date.now().toString(36) + S.counter.toString(36)
  const def = opts.def || defFor(mechanic, dim)
  const g = newGroup(id, mechanic, dim, center, Date.now(), tier ? tier.id : null, opts)
  g.targets = targets.map(uuidOf)
  const mix = tier && tier.mix ? tier.mix[dim == NETHER ? 'nether' : 'overworld'] || def.mix : def.mix
  let evokers = 0
  targets.forEach(p => { g.names[uuidOf(p)] = nameOf(p) })
  S.groups[id] = g     // registered first, so the spawn guard and hooks accept its mobs
  for (let i = 0; i < room; i++) {
    let spot = pickSpot(level, dim, center, minD, maxD, hideFrom)
    if (!spot) continue
    let m = null
    let kind = pickWeighted(mix)
    if (kind == 'evoker' && tier && tier.maxEvokers != null && evokers >= tier.maxEvokers) {
      let others = mix.filter(x => x[0] != 'evoker')
      kind = others.length ? pickWeighted(others) : null
    }
    if (!kind) continue
    try { m = summonMob(server, dim, kind, def, id, spot, tier, opts.extraTag) } catch (e) { console.error('[PortalAmbush] Spawn failed: ' + e) }
    if (!m) continue
    if (kind == 'evoker') evokers++
    armMob(server, m, kind, tier)
    addMob(g, m, kind)
  }
  if (!Object.keys(g.mobs).length) {
    delete S.groups[id]
    console.warn('[PortalAmbush] No safe spot found for a ' + mechanic + ' group; skipped.')
    return null
  }
  g.targets.forEach(u => { S.inGroup[u] = id })
  targets.forEach(p => lockMorph(server, p))
  updateHookState()
  retargetGroup(server, g)
  startLoop(server)
  return g
}
// A group record. opts: { def, onEnd, contractId, extraTag } (the API's; null for portal ambushes and raids).
function newGroup(id, mechanic, dim, center, start, tierId, opts) {
  return {
    id: id, mechanic: mechanic, dim: dim, center: center, start: start, lostSince: null,
    targets: [], names: {}, mobs: {}, mobTarget: {}, kinds: {}, tier: tierId,
    def: opts.def || null, onEnd: opts.onEnd || null, contractId: opts.contractId || null, extraTag: opts.extraTag || null,
    farSince: {}, airSince: {}, awaySince: {}, awayChasers: {}, noSpot: {}, flyers: 0, lastFlyer: 0, parked: {},
  }
}
function addMob(g, m, kind) {
  const u = uuidOf(m)
  g.mobs[u] = m
  g.kinds[u] = kind
  S.mobGroup[u] = g.id
}
// A new mob's effects: vexes get VEX_EFFECTS, everything else the tier's Strength.
function armMob(server, m, kind, tier) {
  if (kind == 'vex') giveVexEffects(server, uuidOf(m))
  else if (tier && tier.strength > 0) {
    try { server.runCommandSilent('effect give ' + uuidOf(m) + ' minecraft:strength infinite ' + (tier.strength - 1) + ' true') } catch (e) { }
  }
}

// Removes a group's mobs quietly (no drops) and gives its targets their cooldown.
// reason (for the API's onEnd): killed_all, timeout, targets_lost, cleared or reload.
function endGroup(server, g, giveCooldowns, reason) {
  if (!S.groups[g.id]) return
  delete S.groups[g.id]
  Object.keys(g.parked || {}).forEach(u => { delete S.parkedGroup[u] })   // removed as their chunk loads
  S.allowRemoval = true
  try {
    Object.keys(g.mobs).forEach(u => {
      let m = g.mobs[u]
      try { if (!m.isRemoved()) m.discard() } catch (e) {
        try { server.runCommandSilent('kill ' + u) } catch (e2) { }
      }
      delete S.mobGroup[u]
    })
  } finally {
    S.allowRemoval = false
  }
  g.targets.forEach(u => {
    if (S.inGroup[u] == g.id) delete S.inGroup[u]
    if (giveCooldowns) startCooldown(u)
    unlockMorph(server, u)
  })
  updateHookState()
  saveSoon()
  if (typeof g.onEnd == 'function') {
    try { g.onEnd(g, reason || 'cleared') } catch (e) { console.error('[PortalAmbush] onEnd failed: ' + e) }
  }
}

// A target leaves the group (died, or left the dimension with FOLLOW_ACROSS_DIMENSIONS off): only they go.
function dropTarget(g, uuid) {
  const i = g.targets.indexOf(uuid)
  if (i < 0) return
  g.targets.splice(i, 1)
  if (S.inGroup[uuid] == g.id) delete S.inGroup[uuid]
  startCooldown(uuid)
  unlockMorph(Utils.server, uuid)
}

function groupOfMob(m) {
  const id = S.mobGroup[uuidOf(m)]
  return id ? S.groups[id] : null
}

// Removes every loaded portal_ambush mob, in every dimension (pig_escort.js removeTagged).
function removeTagged(server) {
  let removed = 0
  S.allowRemoval = true
  try {
    try {
      let all = server.entities
      let found = []
      for (let i = 0; i < all.size(); i++) if (hasTag(all.get(i), TAG)) found.push(all.get(i))
      found.forEach(e => { e.discard(); removed++ })
    } catch (e) { }
    removed += server.runCommandSilent('kill @e[tag=' + TAG + ']')
  } finally {
    S.allowRemoval = false
  }
  return removed
}

function endAll(server, reason) {
  Object.keys(S.groups).forEach(id => endGroup(server, S.groups[id], false, reason || 'cleared'))
  S.groups = {}
  S.mobGroup = {}
  S.parkedGroup = {}
  S.inGroup = {}
  S.buckets = []
  updateHookState()
  return removeTagged(server)
}


// ===================== TARGETING =====================

function setMobTarget(server, mob, target) {
  const kind = typeOf(mob)
  if (kind == 'minecraft:piglin' || kind == 'minecraft:piglin_brute') {
    if (MEMORY) {
      try {
        mob.getBrain().setMemoryWithExpiry(MEMORY.ANGRY_AT, javaUuidOf(target), 600)
        mob.getBrain().setMemoryWithExpiry(MEMORY.ATTACK_TARGET, target, 600)
        return
      } catch (e) { }
    }
    return
  }
  try { if (mob.getTarget() !== target) mob.setTarget(target) } catch (e) { }
}

// Piglins only notice targets within 16 blocks, so strays are walked back towards their target.
function regroup(mob, target) {
  if (!MEMORY || !WALK_TARGET) return
  try { mob.getBrain().setMemory(MEMORY.WALK_TARGET, new WALK_TARGET(target, 1.0, 3)) } catch (e) { }
}

function validTargets(server, g) {
  const out = []
  g.targets.forEach(u => {
    let p = server.getPlayerList().getPlayer(javaUuidFromString(u))
    if (p && canBeTargeted(p) && dimOf(p) == g.dim) out.push(p)
  })
  return out
}
let UUID = null
function javaUuidFromString(u) {
  if (!UUID) UUID = Java.loadClass('java.util.UUID')
  return UUID.fromString(u)
}

function retargetGroup(server, g) {
  const players = validTargets(server, g)
  Object.keys(g.mobs).forEach(u => {
    let m = g.mobs[u]
    let mp = posOf(m)
    let best = null, bestD = RETARGET_RADIUS
    players.forEach(p => {
      let d = dist(mp, posOf(p))
      if (d <= bestD) { best = p; bestD = d }
    })
    if (!best) return
    g.mobTarget[u] = uuidOf(best)
    setMobTarget(server, m, best)
    if (bestD > 14) regroup(m, best)
  })
}

// Once a second for each group: prune, drop lost targets, despawn rules, retarget.
function tickGroup(server, g, now) {
  Object.keys(g.mobs).forEach(u => {
    let m = g.mobs[u]
    let gone = true
    try { gone = m.isRemoved() || !m.isAlive() } catch (e) { }
    if (!gone) return
    // Left behind in a chunk that unloaded (a target who flew off): parked, and replaced next to the target when
    // the group follows. If its chunk loads first, it simply rejoins (EntityEvents.spawned).
    if (unloadedNotDead(m) && g.kinds[u]) { g.parked[u] = g.kinds[u]; S.parkedGroup[u] = g.id }
    delete g.mobs[u]; delete S.mobGroup[u]; delete g.mobTarget[u]
  })
  // Every mob killed: the group is beaten.
  if (!Object.keys(g.mobs).length && !Object.keys(g.parked).length) return endGroup(server, g, true, 'killed_all')
  if (now - g.start >= GROUP_MAX_MINUTES * 60000) return endGroup(server, g, true, 'timeout')
  // Targets in another dimension: followed there after DIMENSION_DELAY_SECONDS (or dropped, with following off).
  g.targets.slice().forEach(u => {
    let p = server.getPlayerList().getPlayer(javaUuidFromString(u))
    if (!p || dimOf(p) == g.dim) { delete g.awaySince[u]; delete g.awayChasers[u]; return }
    if (!FOLLOW_ACROSS_DIMENSIONS) { dropTarget(g, u); return }
    if (!g.awaySince[u]) {
      g.awaySince[u] = now
      // Who was chasing them, before the mobs turn to the targets still here.
      g.awayChasers[u] = Object.keys(g.mobTarget).filter(m => g.mobTarget[m] == u)
      return
    }
    if (now - g.awaySince[u] >= DIMENSION_DELAY_SECONDS * 1000) {
      try { followAcross(server, g, p, now) } catch (e) { console.error('[PortalAmbush] Following across dimensions failed: ' + e) }
    }
  })
  if (!S.groups[g.id]) return
  if (!g.targets.length) return endGroup(server, g, true, 'targets_lost')
  // Any target online, alive and in survival here? Distance doesn't count: the mobs come to them.
  const players = validTargets(server, g)
  if (!players.length) {
    if (g.lostSince == null) g.lostSince = now
    if (now - g.lostSince >= TARGET_LOST_SECONDS * 1000) return endGroup(server, g, true, 'targets_lost')
    return
  }
  g.lostSince = null
  players.forEach(p => lockMorph(server, p))
  followTargets(server, g, players, now)
  sendFlyers(server, g, players, now)
  retargetGroup(server, g)
}


// ===================== NO GETTING AWAY =====================

// --- Morphing (Walkers / ReMorphed), through Walkers' own commands ---
function walkers(server, command) {
  try { return server.runCommandSilent('walkers ' + command) } catch (e) { return 0 }
}
function onlineByUuid(server, u) {
  try { return server.getPlayerList().getPlayer(javaUuidFromString(u)) } catch (e) { return null }
}
// Back to human, and blocked from morphing until unlockMorph.
function lockMorph(server, p) {
  if (!MORPH_LOCK) return
  const u = uuidOf(p), D = db()
  if (D.morphLocked[u]) return
  D.morphLocked[u] = nameOf(p)
  save()   // at once: a crash must not leave them blocked with no record of it
  walkers(server, 'playerBlacklist add ' + nameOf(p))
  walkers(server, 'switchShape ' + nameOf(p) + ' normal')
  try { p.tell(comp([{ text: 'You can\'t change shape while you\'re being hunted.', color: 'gray', italic: true }])) } catch (e) { }
}
// Lifted now if they're online, otherwise when they next log in.
function unlockMorph(server, u) {
  const D = db()
  if (!D.morphLocked[u] || !server) return
  const p = onlineByUuid(server, u)
  if (!p) return
  walkers(server, 'playerBlacklist remove ' + nameOf(p))
  delete D.morphLocked[u]
  save()
}
// Anyone still blocked who isn't in a group (after a crash, a /reload, or a group that ended while they were away).
function releaseMorphLocks(server) {
  Object.keys(db().morphLocked).forEach(u => {
    let id = S.inGroup[u]
    if (!id || !S.groups[id]) unlockMorph(server, u)
  })
}

// --- Following a target who gets away ---
// Removed because its chunk unloaded (not killed or discarded)?
function unloadedNotDead(m) {
  let r = null
  try { r = m.getRemovalReason() } catch (e) { return false }
  try { return r != null && !r.shouldDestroy() } catch (e) { return false }
}
// Fresh copies of the group's parked mobs (left in unloaded chunks), at spots around target p. Returns how many.
function recallParked(server, g, p, q, level) {
  const tier = g.tier ? tierById(g.tier) : null, u = uuidOf(p)
  let made = 0
  Object.keys(g.parked).forEach(old => {
    let spot = followSpot(level, g.dim, q)
    if (!spot || aliveAmbushMobs() >= SERVER_MAX_MOBS) return
    let kind = g.parked[old], m = null
    try { m = summonMob(server, g.dim, kind, defOf(g), g.id, spot, tier, g.extraTag) } catch (e) { console.error('[PortalAmbush] Spawn failed: ' + e) }
    if (!m) return
    delete g.parked[old]
    delete S.parkedGroup[old]   // the old one is removed if its chunk ever loads
    armMob(server, m, kind, tier)
    addMob(g, m, kind)
    g.mobTarget[uuidOf(m)] = u
    setMobTarget(server, m, p)
    puff(server, g.dim, spot)
    made++
  })
  if (made) updateHookState()
  return made
}
// A spot to stand FOLLOW.spot blocks from q; for a target high in the air, around the ground below them. Or null.
function followSpot(level, dim, q) {
  const s = pickSpot(level, dim, q, FOLLOW.spot[0], FOLLOW.spot[1], null)
  if (s) return s
  const below = findGround(level, Math.floor(q.x), Math.floor(q.z), Math.floor(q.y), Math.floor(q.y) - 64)
  if (!below || below.fluid) return null
  return pickSpot(level, dim, { x: q.x, y: below.y + 1, z: q.z }, FOLLOW.spot[0], FOLLOW.spot[1], null)
}
function puff(server, dim, spot) {
  try {
    server.runCommandSilent('execute in ' + dim + ' run particle minecraft:portal ' + spot.x + ' ' + (spot.y + 1) + ' ' + spot.z + ' 0.4 0.8 0.4 0.3 30')
    server.runCommandSilent('execute in ' + dim + ' run playsound minecraft:entity.enderman.teleport hostile @a ' + spot.x + ' ' + spot.y + ' ' + spot.z + ' 1 0.7')
  } catch (e) { }
}
// A target further than FOLLOW.distance from every mob for FOLLOW.seconds: the mobs that aren't near any target
// reappear around them. Not into a safe zone (the mobs wait; the group's time keeps running).
function followTargets(server, g, players, now) {
  const mobs = Object.keys(g.mobs), mpos = {}
  mobs.forEach(m => { try { mpos[m] = posOf(g.mobs[m]) } catch (e) { } })
  const tpos = players.map(p => posOf(p))
  players.forEach((p, i) => {
    let u = uuidOf(p), q = tpos[i]
    if (mobs.some(m => mpos[m] && dist(mpos[m], q) <= FOLLOW.distance)) { delete g.farSince[u]; delete g.noSpot[u]; return }
    if (!g.farSince[u]) { g.farSince[u] = now; return }
    if (now - g.farSince[u] < FOLLOW.seconds * 1000) return
    if (inSafeZone(server, g.dim, q)) return
    let idle = mobs.filter(m => mpos[m] && !tpos.some(t => dist(mpos[m], t) <= FOLLOW.distance))
    if (!idle.length && !Object.keys(g.parked).length) return
    let level = levelOf(p)
    let first = followSpot(level, g.dim, q)
    if (!first) { g.noSpot[u] = now; return }   // nowhere to stand: the flyers deal with it
    delete g.noSpot[u]
    recallParked(server, g, p, q, level)
    idle.forEach((m, k) => {
      let spot = k == 0 ? first : (followSpot(level, g.dim, q) || first)
      try { server.runCommandSilent('execute in ' + g.dim + ' run tp ' + m + ' ' + spot.x + ' ' + spot.y + ' ' + spot.z) } catch (e) { return }
      mpos[m] = spot
      puff(server, g.dim, spot)
      g.mobTarget[m] = u
      setMobTarget(server, g.mobs[m], p)
    })
    delete g.farSince[u]
  })
}

// --- Flying pursuers ---
function isFlying(p) {
  try { if (p.isFallFlying()) return true } catch (e) { }
  try { if (p.getAbilities().flying) return true } catch (e) { }
  try { if (p.abilities.flying) return true } catch (e) { }
  return false
}
function outOfReach(g, p, q) {
  if (isFlying(p) || g.noSpot[uuidOf(p)]) return true
  // Ground within FLYERS.aboveGround blocks below their feet (water counts as ground)?
  return !findGround(levelOf(p), Math.floor(q.x), Math.floor(q.z), Math.floor(q.y) + 1, Math.floor(q.y) - FLYERS.aboveGround)
}
// An open spot for a flyer 4-6 blocks from the target, at their height. Or null.
function airSpot(level, q) {
  for (let i = 0; i < 12; i++) {
    let angle = Math.random() * TWO_PI, d = 4 + Math.random() * 2
    let x = Math.floor(q.x + Math.cos(angle) * d), y = Math.floor(q.y) + (i % 2), z = Math.floor(q.z + Math.sin(angle) * d)
    let a = level.getBlock(x, y, z), b = level.getBlock(x, y + 1, z)
    if (!isSolid(a, String(a.id)) && !isSolid(b, String(b.id)) && !isFluidId(String(a.id))) return { x: x + 0.5, y: y, z: z + 0.5 }
  }
  return null
}
function sendFlyers(server, g, players, now) {
  if (!FLYERS.perGroup || !MOB_KINDS[FLYERS.kind]) return
  players.forEach(p => {
    let u = uuidOf(p), q = posOf(p)
    if (!outOfReach(g, p, q)) { delete g.airSince[u]; return }
    if (!g.airSince[u]) { g.airSince[u] = now; return }
    if (now - g.airSince[u] < FLYERS.airborneSeconds * 1000) return
    if (g.flyers >= FLYERS.perGroup || now - g.lastFlyer < FLYERS.cooldownSeconds * 1000) return
    if (aliveAmbushMobs() >= SERVER_MAX_MOBS || inSafeZone(server, g.dim, q)) return
    let spot = airSpot(levelOf(p), q)
    if (!spot) return
    let tier = g.tier ? tierById(g.tier) : null, m = null
    try { m = summonMob(server, g.dim, FLYERS.kind, defOf(g), g.id, spot, tier, g.extraTag) } catch (e) { console.error('[PortalAmbush] Flyer spawn failed: ' + e) }
    if (!m) return
    armMob(server, m, FLYERS.kind, tier)
    addMob(g, m, FLYERS.kind)
    g.flyers++
    g.lastFlyer = now
    g.mobTarget[uuidOf(m)] = u
    setMobTarget(server, m, p)
    updateHookState()
  })
}

// --- Following into another dimension ---
// Target p is in another dimension. The mobs chasing them (all of them, if p is the only target) are replaced by
// fresh copies next to p there. The only target: the whole group moves (same id, time, contract). Otherwise p and
// their chasers split off into a new group with the same time. Waits while p is in a safe zone or there's nowhere
// to stand.
function followAcross(server, g, p, now) {
  const u = uuidOf(p), dim = dimOf(p), q = posOf(p), level = levelOf(p)
  if (!canBeTargeted(p) || isPigEscortParticipant(p) || inSafeZone(server, dim, q)) return
  if (!followSpot(level, dim, q)) return
  const others = g.targets.filter(x => x != u)
  let movers = Object.keys(g.mobs).filter(m => !hasTag(g.mobs[m], TAG_SUMMONED) && g.kinds[m])
  if (others.length) {
    let was = g.awayChasers[u] || []
    let chasers = movers.filter(m => was.indexOf(m) >= 0)
    movers = chasers.length ? chasers : movers.slice(0, 1)
  }
  let dest = g
  if (others.length) {
    S.counter++
    dest = newGroup(Date.now().toString(36) + S.counter.toString(36), g.mechanic, dim, q, g.start, g.tier, { def: g.def, extraTag: g.extraTag })
    dest.targets = [u]
    dest.names[u] = g.names[u] || nameOf(p)
    g.targets.splice(g.targets.indexOf(u), 1)
    delete g.awaySince[u]
    delete g.awayChasers[u]
    S.groups[dest.id] = dest
    S.inGroup[u] = dest.id
  }
  // The old mobs go: the movers, and with the whole group moving, everything left behind (an evoker's vexes).
  const leaving = others.length ? movers.slice() : Object.keys(g.mobs)
  const kinds = movers.map(m => g.kinds[m])
  if (!others.length) {   // the whole group moves: the parked ones come along too
    Object.keys(g.parked).forEach(old => { kinds.push(g.parked[old]); delete S.parkedGroup[old] })
    g.parked = {}
  }
  S.allowRemoval = true
  try {
    leaving.forEach(m => {
      try { g.mobs[m].discard() } catch (e) { try { server.runCommandSilent('kill ' + m) } catch (e2) { } }
      delete g.mobs[m]; delete g.kinds[m]; delete g.mobTarget[m]; delete S.mobGroup[m]
    })
  } finally {
    S.allowRemoval = false
  }
  if (!others.length) {
    g.dim = dim
    g.center = q
    g.farSince = {}; g.airSince = {}; g.awaySince = {}; g.awayChasers = {}; g.noSpot = {}
  }
  const tier = g.tier ? tierById(g.tier) : null
  let made = 0
  kinds.forEach(kind => {
    let spot = followSpot(level, dim, q)
    if (!spot) return
    let m = null
    try { m = summonMob(server, dim, kind, defOf(dest), dest.id, spot, tier, dest.extraTag) } catch (e) { console.error('[PortalAmbush] Spawn failed: ' + e) }
    if (!m) return
    armMob(server, m, kind, tier)
    addMob(dest, m, kind)
    dest.mobTarget[uuidOf(m)] = u
    setMobTarget(server, m, p)
    puff(server, dim, spot)
    made++
  })
  updateHookState()
  console.info('[PortalAmbush] ' + nameOf(p) + ' changed dimension during an ambush; ' + made + ' mob(s) followed them to ' + dim)
}


// ===================== MECHANICS 1 & 2: PORTAL ARRIVALS =====================

function nearPortalBlock(p) {
  const level = levelOf(p), pos = posOf(p)
  const bx = Math.floor(pos.x), by = Math.floor(pos.y), bz = Math.floor(pos.z), r = PORTAL_CHECK_RADIUS
  for (let dx = -r; dx <= r; dx++) for (let dy = -2; dy <= 3; dy++) for (let dz = -r; dz <= r; dz++) {
    if (String(level.getBlock(bx + dx, by + dy, bz + dz).id) == 'minecraft:nether_portal') return true
  }
  return false
}
// Came through a Nether portal (not /tp or a mod's teleport)? Minecraft starts a short portal cooldown just
// before a portal trip, so that's checked first; the portal block check covers mods that move the player.
function cameThroughPortal(p) {
  try { if (p.isOnPortalCooldown()) return true } catch (e) { }
  return nearPortalBlock(p)
}

// What happened on each player's last trip between dimensions, and why it did or didn't lead to an ambush
// (shown by /ambush timer). Kept in memory only, never logged.
function shortDim(d) { return String(d).replace('minecraft:', '') }
function noteArrival(p, text) {
  const u = uuidOf(p), old = S.lastArrival[u]
  S.lastArrival[u] = { time: Date.now(), trip: old ? old.trip : '', text: text }
}
function noteTrip(p, from, to, how) { S.lastArrival[uuidOf(p)] = { time: Date.now(), trip: shortDim(from) + ' -> ' + shortDim(to) + ' (' + how + ')', text: '' } }
function whyNotEligible(server, p, factionId) {
  const uuid = uuidOf(p)
  if (factionOf(p) != factionId) return 'not in the hunted faction'
  if (S.inGroup[uuid]) return 'already in an active group'
  if (cooldownLeftMs(uuid) > 0) return 'on cooldown (' + clock(cooldownLeftMs(uuid) / 1000) + ' left)'
  if (!canBeTargeted(p)) return 'in creative or spectator'
  if (isPigEscortParticipant(p)) return 'taking part in a Pig Escort'
  if (inSafeZone(server, dimOf(p), posOf(p))) return 'arrived inside a safe zone'
  return null
}

function arrival(server, p, mechanic) {
  if (!isEnabled()) return noteArrival(p, 'add-on is OFF (/ambush toggle)')
  if (isPeaceful(server)) return noteArrival(p, 'difficulty is Peaceful')
  const factionId = mechanic == 'nether_ambush' ? 'ministry' : 'syndicate'
  const why = whyNotEligible(server, p, factionId)
  if (why) return noteArrival(p, 'skipped: ' + why)
  const now = Date.now(), pos = posOf(p), dim = dimOf(p), uuid = uuidOf(p)
  S.buckets = S.buckets.filter(b => now - b.time < ARRIVAL_GROUP_SECONDS * 1000)
  // (A player coming back through the same portal a few seconds later doesn't share their own earlier roll.)
  const b = S.buckets.filter(x => x.mechanic == mechanic && x.dim == dim && dist(x.pos, pos) <= ARRIVAL_GROUP_RADIUS && x.players.indexOf(uuid) < 0)[0]
  if (b) {
    // Same portal, same few seconds: no new roll. Join the group if it's already here.
    if (b.players.indexOf(uuid) < 0) b.players.push(uuid)
    let g = b.groupId ? S.groups[b.groupId] : null
    if (g && g.targets.indexOf(uuid) < 0) {
      g.targets.push(uuid)
      g.names[uuid] = nameOf(p)
      S.inGroup[uuid] = g.id
      sendMessage(server, [p], mechanic)
    }
    return noteArrival(p, 'came through with others; shared their roll')
  }
  const nb = { mechanic: mechanic, dim: dim, pos: pos, time: now, players: [uuid], groupId: null }
  S.buckets.push(nb)
  if (mechanic == 'return_inspection' && witnesses(server, dim, pos).length) return noteArrival(p, 'skipped: someone outside the faction was within ' + SECRECY_RADIUS + ' blocks')
  const chance = mechanic == 'nether_ambush' ? NETHER_AMBUSH_CHANCE : OVERWORLD_PATROL_CHANCE
  const roll = Math.random()
  if (roll >= chance) return noteArrival(p, 'rolled ' + Math.round(roll * 100) + '%, needed under ' + Math.round(chance * 100) + '%: no ambush this time')
  noteArrival(p, 'roll succeeded; ambush in ' + AMBUSH_DELAY_SECONDS + ' s')
  const token = S.token
  server.scheduleInTicks(AMBUSH_DELAY_SECONDS * 20, () => {
    if (token != S.token) return
    try {
      let g = spawnArrivalGroup(server, nb, {})
      if (!g) noteArrival(p, 'roll succeeded, but nothing spawned (no safe ground nearby, the mob cap, or the player left)')
    } catch (e) { console.error('[PortalAmbush] ' + e) }
  })
  startLoop(server)
}

// After the delay: gather the bucket's players (and other eligible same-faction players nearby) and spawn.
// opts.forced (test command): opts.player is targeted whatever their faction and cooldown; secrecy is skipped.
function spawnArrivalGroup(server, b, opts) {
  if (!isEnabled() && !opts.forced) return null
  const factionId = b.mechanic == 'nether_ambush' ? 'ministry' : 'syndicate'
  const targets = []
  b.players.forEach(u => {
    let p = server.getPlayerList().getPlayer(javaUuidFromString(u))
    if (!p || dimOf(p) != b.dim) return
    let forcedOne = opts.forced && opts.player && uuidOf(opts.player) == u
    if (forcedOne ? (!S.inGroup[u] && canBeTargeted(p)) : eligible(server, p, factionId)) targets.push(p)
  })
  if (!targets.length) return null
  const extra = nearbyEligible(server, factionId, b.dim, b.pos, EXTRA_TARGET_RADIUS, targets.map(uuidOf))
  extra.forEach(p => targets.push(p))
  if (b.mechanic == 'return_inspection' && !opts.forced && witnesses(server, b.dim, b.pos).length) return null
  const base = b.mechanic == 'nether_ambush' ? NETHER_AMBUSH_BASE_SIZE : PATROL_BASE_SIZE
  const cap = b.mechanic == 'nether_ambush' ? NETHER_AMBUSH_MAX_SIZE : PATROL_MAX_SIZE
  const size = Math.min(cap, base + targets.length - 1)
  const g = startGroup(server, b.mechanic, b.dim, b.pos, targets, size, SPAWN_DISTANCE[0], SPAWN_DISTANCE[1], null)
  if (!g) return null
  b.groupId = g.id
  sendMessage(server, targets, b.mechanic)
  return g
}


// ===================== MECHANIC 3: RANDOM RAIDS =====================

function resetRaidTimer(uuid, dim) {
  db().raid[uuid] = newRaidTimer(dim)
  dirty = true
}

// Starts (or postpones) a raid on p. Returns a short description for the test command.
function attemptRaid(server, p, forced, tier) {
  const dim = dimOf(p), uuid = uuidOf(p)
  const factionId = factionHuntedIn(dim)
  const r = db().raid[uuid] || newRaidTimer(dim)
  db().raid[uuid] = r
  tier = tier || tierById(r.tier) || tierById('moderate') || RAID_TIERS[0]
  if (dim == OVERWORLD && witnesses(server, dim, posOf(p)).length) {
    if (r.postpones < RAID_MAX_POSTPONES) {
      r.postpones++
      r.postponed = true
      r.tier = tier.id
      r.left = randInt(RAID_POSTPONE_MINUTES[0] * 60, RAID_POSTPONE_MINUTES[1] * 60)
      dirty = true
      return 'postponed (someone outside the faction is within ' + SECRECY_RADIUS + ' blocks); retry ' + r.postpones + '/' + RAID_MAX_POSTPONES + ' in ' + clock(r.left)
    }
    resetRaidTimer(uuid, dim)
    return 'given up after ' + RAID_MAX_POSTPONES + ' postponements; new countdown started'
  }
  resetRaidTimer(uuid, dim)
  const targets = [p].concat(nearbyEligible(server, factionId, dim, posOf(p), RETARGET_RADIUS, [uuid], { ignoreCooldown: true }))
  const extras = targets.filter(t => t !== p && dist(posOf(t), posOf(p)) <= EXTRA_TARGET_RADIUS).length
  const size = Math.min(GROUP_MAX_MOBS, randInt(tier.size[0], tier.size[1]) + extras)
  targets.forEach(t => { S.inGroup[uuidOf(t)] = 'pending' })   // nothing else targets them during the warning
  sendMessage(server, targets, (tier.lethal ? 'lethal_warning_' : 'raid_warning_') + (dim == NETHER ? 'nether' : 'overworld'))
  const token = S.token
  server.scheduleInTicks(RAID_WARNING_SECONDS * 20, () => {
    targets.forEach(t => { if (S.inGroup[uuidOf(t)] == 'pending') delete S.inGroup[uuidOf(t)] })
    if (token != S.token) return
    try {
      let still = targets.filter(t => !t.isRemoved() && dimOf(t) == dim && canBeTargeted(t))
      if (!still.length) return
      if (dim == OVERWORLD && !forced && witnesses(server, dim, posOf(still[0])).length) return   // someone walked up during the warning
      let eyes = still.map(t => { let q = posOf(t); return { x: q.x, y: q.y + 1.62, z: q.z } })
      startGroup(server, 'raid', dim, posOf(still[0]), still, size, SPAWN_DISTANCE[0], SPAWN_DISTANCE[1], eyes, tier)
    } catch (e) { console.error('[PortalAmbush] Raid spawn failed: ' + e) }
  })
  return tier.id + ' raid: warning sent; ' + size + ' mob(s) arriving in ' + RAID_WARNING_SECONDS + ' s'
}

// Once a second: advance the countdown of every online player who is in their hostile dimension.
function tickRaids(server) {
  if (!isEnabled() || isPeaceful(server)) return
  onlinePlayers(server).forEach(p => {
    let dim = huntedDimOf(p)
    if (!dim || dimOf(p) != dim) return
    let uuid = uuidOf(p)
    let r = db().raid[uuid]
    if (!r) { r = db().raid[uuid] = newRaidTimer(dim); dirty = true }
    if (S.inGroup[uuid] || !canBeTargeted(p) || isPigEscortParticipant(p) || inSafeZone(server, dim, posOf(p))) return   // paused
    r.left--
    dirty = true
    if (r.left > 0) return
    // A postponed raid keeps its tier; otherwise roll (no cooldown check: the countdown already paused in fights).
    const tier = r.postponed ? tierById(r.tier) : pickTier(false)
    if (!tier) { resetRaidTimer(uuid, dim); return }
    attemptRaid(server, p, false, tier)
  })
}


// ===================== THE ONE-SECOND LOOP =====================
// Runs only while there are groups, recent arrivals, or a player in their hostile dimension.

function needsLoop(server) {
  if (Object.keys(S.groups).length || S.buckets.length) return true
  if (!isEnabled()) return false
  return onlinePlayers(server).some(p => { let d = huntedDimOf(p); return d && dimOf(p) == d })
}

function startLoop(server) {
  if (S.loopRunning) return
  S.loopRunning = true
  const token = S.token
  const step = () => {
    if (token != S.token) return
    const now = Date.now()
    try {
      Object.keys(S.groups).forEach(id => { if (S.groups[id]) tickGroup(server, S.groups[id], now) })
      S.buckets = S.buckets.filter(b => now - b.time < ARRIVAL_GROUP_SECONDS * 1000 || (b.groupId && S.groups[b.groupId]))
      tickRaids(server)
      if (dirty && now - lastSave >= SAVE_EVERY_SECONDS * 1000) save()
    } catch (e) {
      console.error('[PortalAmbush] ' + e)
    }
    if (!needsLoop(server)) {
      S.loopRunning = false
      if (dirty) save()
      return
    }
    server.scheduleInTicks(20, step)
  }
  server.scheduleInTicks(20, step)
}


// ===================== API FOR OTHER SCRIPTS =====================
// global.PortalAmbush, refreshed on every load. Used by economy/black_market.js (Ambush Contracts).

global.PortalAmbush = {
  // Spawns a group like a raid (SPAWN_DISTANCE blocks out, out of the targets' sight where possible) around the first target.
  // o: { targets: [uuid], mechanic, dim, size, def, tier, onEnd(group, reason), contractId, extraTag }.
  // Targets must be online and in `dim`. A 'contract' group's mobs are also tagged contract_ambush.
  // Returns the group (g.id, g.mobs, g.targets, g.contractId) or null if nothing could spawn.
  startGroup: o => {
    const server = Utils.server
    if (!server || !o || !o.targets || !o.targets.length) return null
    const players = []
    o.targets.forEach(u => {
      let p = null
      try { p = server.getPlayerList().getPlayer(javaUuidFromString(u)) } catch (e) { }
      if (p && dimOf(p) == o.dim && canBeTargeted(p)) players.push(p)
    })
    if (!players.length) return null
    const eyes = players.map(t => { let q = posOf(t); return { x: q.x, y: q.y + 1.62, z: q.z } })
    const mechanic = o.mechanic || 'contract'
    const g = startGroup(server, mechanic, o.dim, posOf(players[0]), players, o.size || 1, SPAWN_DISTANCE[0], SPAWN_DISTANCE[1], eyes, o.tier || null,
      { def: o.def || null, onEnd: o.onEnd || null, contractId: o.contractId || null, extraTag: o.extraTag || (mechanic == 'contract' ? 'contract_ambush' : null) })
    if (g) startLoop(server)
    return g
  },
  cooldownLeftMs: uuid => cooldownLeftMs(uuid),
  startCooldown: uuid => startCooldown(uuid),
  inGroup: uuid => !!S.inGroup[uuid],                        // in an active group, or about to be (raid warning)
  groupOf: entity => groupOfMob(entity),                      // the group an ambush mob belongs to, or null
  inSafeZone: (server, dim, pos) => inSafeZone(server, dim, pos),
  isPigEscortParticipant: p => isPigEscortParticipant(p),
  isEnabled: () => isEnabled(),
  isPeaceful: server => isPeaceful(server),
  mobRoom: () => Math.max(0, SERVER_MAX_MOBS - aliveAmbushMobs()),
  groupMax: GROUP_MAX_MOBS,
  tiers: RAID_TIERS,
  warParty: WAR_PARTY,
}


// ===================== EVENTS =====================

// Hooks for startup_scripts/portal_ambush_hooks.js. They return at once unless a group is active.
global.portalAmbushHooks = {
  anyActive: false,
  // A portal_ambush mob may only target its own group's targets.
  onChangeTarget: event => {
    const m = event.getEntity()
    if (!hasTag(m, TAG)) return
    const t = event.getNewTarget()
    if (t == null) return
    const g = groupOfMob(m)
    const ok = g && t.isPlayer() && g.targets.indexOf(uuidOf(t)) >= 0
    if (!ok) event.setCanceled(true)
  },
  onXpDrop: event => {
    if (ZERO_XP && hasTag(event.getEntity(), TAG)) event.setDroppedExperience(0)
  },
}
updateHookState()

if (global.Factions) {
  // Portal arrivals, and targets escaping. how = 'travel' (portal, /tp, mods), 'login' or 'respawn'.
  global.Factions.on('enteredDimension', (player, faction, from, to, how) => {
    const server = Utils.server
    if (!server) return
    // An old factions_core.js doesn't say how the player arrived, so portal trips can't be recognised.
    if (how === undefined && from != null) {
      if (!S.coreOutdated) console.error('[PortalAmbush] factions_core.js is outdated (its dimension events don\'t say how the player arrived), so portal arrivals can\'t be detected. Update factions_core.js.')
      S.coreOutdated = true
    }
    if (from != null) {
      try {
        let viaPortal = how == 'travel' && cameThroughPortal(player)
        noteTrip(player, from, to, how == 'travel' && !viaPortal ? 'travel, no portal: waystone or teleport' : how || '?')
        let pair = (from == OVERWORLD && to == NETHER) || (from == NETHER && to == OVERWORLD)
        let hunted =(to == NETHER && faction == 'ministry') || (to == OVERWORLD && faction == 'syndicate')
        if (!pair) noteArrival(player, 'only Overworld <-> Nether trips can be ambushed')
        else if (!hunted) noteArrival(player, 'faction "' + faction + '" isn\'t hunted in ' + shortDim(to))
        else if (how != 'travel') noteArrival(player, 'not a portal trip (' + (how || 'factions_core.js outdated') + ')')
        else if (ARRIVALS_NEED_PORTAL && !viaPortal) noteArrival(player, 'no Nether portal where they arrived (teleported, not a portal trip)')
        else arrival(server, player, to == NETHER ? 'nether_ambush' : 'return_inspection')
      } catch (e) {
        noteArrival(player, 'error: ' + e)
        console.error('[PortalAmbush] Portal arrival check failed: ' + e)
      }
    }
    if (needsLoop(server)) startLoop(server)
  })
  global.Factions.on('leftDimension', (player, faction, dim, how) => {
    if (how == 'logout') return   // logging out isn't escaping: the 60-second rule handles it
    if (how == 'travel' && FOLLOW_ACROSS_DIMENSIONS) return   // followed (tickGroup)
    const id = S.inGroup[uuidOf(player)]
    const g = id ? S.groups[id] : null
    if (g && g.dim == dim) dropTarget(g, uuidOf(player))
  })
  // A new faction means a new hostile dimension: start the countdown over.
  let resetOnFactionChange = player => {
    delete db().raid[uuidOf(player)]
    dirty = true
    if (Utils.server) startLoop(Utils.server)
  }
  global.Factions.on('joinedFaction', resetOnFactionChange)
  global.Factions.on('leftFaction', resetOnFactionChange)
} else {
  console.error('[PortalAmbush] global.Factions is missing: factions_core.js must load first. Portal Ambush is inactive.')
}

PlayerEvents.loggedOut(event => { if (dirty) save() })
// Morphing blocked by a group that ended while they were away: lifted now.
PlayerEvents.loggedIn(event => {
  const p = event.player, u = uuidOf(p), id = S.inGroup[u]
  if (db().morphLocked[u] && (!id || !S.groups[id])) unlockMorph(event.server || Utils.server, u)
})
// A target who dies is out of their group (it ends when nobody is left).
EntityEvents.death(event => {
  const e = event.entity
  if (!e || !e.isPlayer()) return
  const u = uuidOf(e), id = S.inGroup[u], g = id ? S.groups[id] : null
  if (g) dropTarget(g, u)
})

// Damage from an ambush mob (including its arrows) only counts against its own group's targets.
EntityEvents.hurt(event => {
  if (!global.portalAmbushHooks.anyActive) return
  const attacker = attackerOf(event.source)
  if (!attacker || !hasTag(attacker, TAG)) return
  const g = groupOfMob(attacker)
  const victim = event.entity
  if (g && victim.isPlayer() && g.targets.indexOf(uuidOf(victim)) >= 0) return
  event.cancel()   // last: cancel() stops this function
})

// The config reward (vanilla loot is already off), only for mobs killed while their group is active.
EntityEvents.death(event => {
  const e = event.entity
  if (!hasTag(e, TAG) || S.allowRemoval) return
  const u = uuidOf(e)
  const g = groupOfMob(e)
  delete S.mobGroup[u]
  if (!g) return
  delete g.mobs[u]
  if (hasTag(e, TAG_SUMMONED)) return   // an evoker's vex: no reward (evokers can summon them endlessly)
  const def = defOf(g)
  const n = def.reward ? randInt(def.reward.min, def.reward.max) : 0
  if (n <= 0) return
  try {
    e.block.popItem(Item.of(def.reward.item, n))
  } catch (err) {
    let p = posOf(e)
    Utils.server.runCommandSilent('execute in ' + g.dim + ' run summon minecraft:item ' + p.x + ' ' + p.y + ' ' + p.z + ' {Item:{id:"' + def.reward.item + '",Count:' + n + 'b}}')
  }
})

// Catches the mobs this script summons, keeps live group mobs (they re-join when their chunk reloads), and
// removes any other portal_ambush mob as it loads (leftovers from before a restart or /reload).
EntityEvents.spawned(event => {
  const e = event.entity
  const tags = e.getTags()
  if (tags.isEmpty() && !S.expectMob) { adoptSummonedVex(e); return }
  if (tags.isEmpty() || !tags.contains(TAG)) return
  if (S.expectMob) { S.lastMob = e; return }
  const u = uuidOf(e)
  const g = S.mobGroup[u] ? S.groups[S.mobGroup[u]] : null
  if (g) { g.mobs[u] = e; return }
  // A parked mob (see tickGroup) whose chunk loaded again before the group followed: it rejoins.
  const pg = S.parkedGroup[u] ? S.groups[S.parkedGroup[u]] : null
  if (pg && pg.parked[u] && typeOf(e) == MOB_KINDS[pg.parked[u]].id && dimOf(e) == pg.dim) {
    addMob(pg, e, pg.parked[u])
    delete pg.parked[u]
    delete S.parkedGroup[u]
    return
  }
  event.cancel()
})

// A vex summoned by one of our evokers joins the evoker's group: tagged, kept on the group's targets (so it can't
// go after anyone else) and removed with the group. Vanilla gives summoned vexes a short life anyway.
function giveVexEffects(server, uuid) {
  Object.keys(VEX_EFFECTS).forEach(eff => {
    let lvl = VEX_EFFECTS[eff]
    if (lvl > 0) { try { server.runCommandSilent('effect give ' + uuid + ' minecraft:' + eff + ' infinite ' + (lvl - 1) + ' true') } catch (e) { } }
  })
}
function adoptSummonedVex(e) {
  let owner = null
  try {
    if (typeOf(e) != 'minecraft:vex') return
    owner = e.getOwner()
  } catch (err) { return }
  if (!owner) return
  const gid = S.mobGroup[uuidOf(owner)]
  const g = gid ? S.groups[gid] : null
  if (!g) return
  const u = uuidOf(e)
  try {
    e.addTag(TAG)
    e.addTag(TAG + '_g_' + gid)
    e.addTag(TAG_SUMMONED)
  } catch (err) {
    console.warn('[PortalAmbush] Could not tag an evoker\'s vex (it stays a plain vex): ' + err)
    return
  }
  addMob(g, e, 'vex')
  updateHookState()
  // A tick later: the vex is still joining the world now, so /effect can't find it yet.
  const token = S.token, server = Utils.server
  if (server) server.scheduleInTicks(1, () => { if (token == S.token && S.mobGroup[u] == gid) giveVexEffects(server, u) })
}

// Server start: clear leftovers in the loaded chunks, then start the loop if anyone needs it.
ServerEvents.loaded(event => {
  const server = event.server
  removeTagged(server)
  if (MORPH_LOCK) walkers(server, 'playerBlacklist preventMorphing true')
  releaseMorphLocks(server)
  if (needsLoop(server)) startLoop(server)
})

// After a /reload: end the old groups, clear their mobs and restart the loop for online players.
if (Utils.server) {
  endAll(Utils.server, 'reload')
  if (MORPH_LOCK) walkers(Utils.server, 'playerBlacklist preventMorphing true')
  releaseMorphLocks(Utils.server)
  if (needsLoop(Utils.server)) startLoop(Utils.server)
}


// ===================== COMMANDS =====================

ServerEvents.commandRegistry(event => {
  const Commands = event.commands
  const Arguments = event.arguments
  const reply = (ctx, text, bad) => { ctx.source.sendSystemMessage(bad ? Text.red(text) : Text.gold('[Ambush] ').append(Text.yellow(text))); return bad ? 0 : 1 }
  const safe = fn => ctx => {
    try { return fn(ctx) } catch (e) {
      console.error('[PortalAmbush] ' + e)
      return reply(ctx, 'Error: ' + e, true)
    }
  }
  const target = ctx => Arguments.PLAYER.getResult(ctx, 'player')

  const testArrival = mechanic => safe(ctx => {
    const server = ctx.source.server, p = target(ctx)
    if (S.inGroup[uuidOf(p)]) return reply(ctx, nameOf(p) + ' is already in an active group.', true)
    if (!canBeTargeted(p)) return reply(ctx, nameOf(p) + ' is in creative or spectator; mobs can\'t attack them. Switch to survival.', true)
    const b = { mechanic: mechanic, dim: dimOf(p), pos: posOf(p), time: Date.now(), players: [uuidOf(p)], groupId: null }
    S.buckets.push(b)
    const token = S.token
    server.scheduleInTicks(AMBUSH_DELAY_SECONDS * 20, () => {
      if (token != S.token) return
      try {
        let g = spawnArrivalGroup(server, b, { forced: true, player: p })
        reply(ctx, g ? 'Spawned ' + Object.keys(g.mobs).length + ' mob(s) for ' + Object.keys(g.names).map(u => g.names[u]).join(', ') + '.' : 'Nothing spawned (no safe ground nearby, or the server-wide cap is reached).', !g)
      } catch (e) { reply(ctx, 'Error: ' + e, true) }
    })
    startLoop(server)
    return reply(ctx, (mechanic == 'nether_ambush' ? 'Nether ambush' : 'Return inspection') + ' on ' + nameOf(p) + ' in ' + AMBUSH_DELAY_SECONDS + ' seconds' +
      (mechanic == 'return_inspection' ? ' (secrecy check skipped for this test).' : '.'))
  })

  // /ambush test raid <player> [light|moderate|lethal]: no tier = one rolled by the odds (never nothing).
  const testRaid = (ctx, tierId) => {
    const server = ctx.source.server, p = target(ctx)
    const dim = huntedDimOf(p)
    if (!dim) return reply(ctx, nameOf(p) + ' is not in a faction that has a hostile dimension.', true)
    if (dimOf(p) != dim) return reply(ctx, nameOf(p) + ' must be in ' + dim + ' for a raid.', true)
    if (S.inGroup[uuidOf(p)]) return reply(ctx, nameOf(p) + ' is already in an active group.', true)
    if (!canBeTargeted(p)) return reply(ctx, nameOf(p) + ' is in creative or spectator. Switch to survival.', true)
    const tier = tierId ? tierById(tierId) : pickTier(true)
    if (!tier) return reply(ctx, 'No raid tier called ' + tierId + '.', true)
    const result = attemptRaid(server, p, true, tier)
    startLoop(server)
    return reply(ctx, 'Raid on ' + nameOf(p) + ': ' + result + '.')
  }

  event.register(Commands.literal('ambush')
    .requires(source => source.hasPermission(2))
    .then(Commands.literal('test')
      .then(Commands.literal('nether').then(Commands.argument('player', Arguments.PLAYER.create(event)).executes(testArrival('nether_ambush'))))
      .then(Commands.literal('overworld').then(Commands.argument('player', Arguments.PLAYER.create(event)).executes(testArrival('return_inspection'))))
      .then(Commands.literal('raid').then(Commands.argument('player', Arguments.PLAYER.create(event)).executes(safe(ctx => testRaid(ctx, null)))
        .then(Commands.literal('light').executes(safe(ctx => testRaid(ctx, 'light'))))
        .then(Commands.literal('moderate').executes(safe(ctx => testRaid(ctx, 'moderate'))))
        .then(Commands.literal('lethal').executes(safe(ctx => testRaid(ctx, 'lethal')))))))
    .then(Commands.literal('timer').then(Commands.argument('player', Arguments.PLAYER.create(event)).executes(safe(ctx => {
      const p = target(ctx), u = uuidOf(p)
      const r = db().raid[u]
      const dim = huntedDimOf(p)
      const cd = cooldownLeftMs(u)
      return reply(ctx, nameOf(p) + ': ' +
        (dim ? 'hostile dimension ' + dim + (dimOf(p) == dim ? ' (there now)' : ' (not there)') : 'no hostile dimension') +
        '; raid countdown ' + (r ? clock(r.left) + (r.postponed ? ' (postponed ' + (r.tier || '') + ' raid, ' + r.postpones + '/' + RAID_MAX_POSTPONES + ')' : '') : 'not started') +
        ' (then: ' + tierOdds() + ')' +
        '; cooldown ' + (cd ? clock(cd / 1000) : 'none') +
        (S.inGroup[u] ? '; in an active group' : '') + '.' +
        (S.lastArrival[u] ? ' Last trip (' + clock((Date.now() - S.lastArrival[u].time) / 1000) + ' ago): ' + S.lastArrival[u].trip + ': ' + (S.lastArrival[u].text || 'no result') + '.' :
          ' No dimension change seen since the server started' + (global.factionsHooksInstalled ? '' : ' (factions_hooks.js is NOT loaded)') + '.'))
    }))))
    .then(Commands.literal('status').executes(safe(ctx => {
      const server = ctx.source.server
      const ids = Object.keys(S.groups)
      reply(ctx, (isEnabled() ? 'ON' : 'OFF') + (isPeaceful(server) ? ' (Peaceful: paused)' : '') +
        ' | hooks: ' + (global.portalAmbushHooksInstalled ? 'loaded' : 'NOT loaded (restart after adding portal_ambush_hooks.js)') +
        (global.factionsHooksInstalled ? '' : ' | factions_hooks.js NOT loaded: portal arrivals can\'t be detected') +
        (S.coreOutdated ? ' | factions_core.js is OUTDATED: portal arrivals can\'t be detected, update it' : '') +
        ' | groups: ' + ids.length + ' | ambush mobs: ' + aliveAmbushMobs() + '/' + SERVER_MAX_MOBS +
        ' | raid roll every ' + RAID_MINUTES[NETHER][0] + ' min in the hostile dimension: ' + tierOdds())
      ids.forEach(id => {
        let g = S.groups[id]
        reply(ctx, '  ' + g.mechanic + (g.tier ? ' (' + g.tier + ')' : '') + ' in ' + g.dim + ': ' + Object.keys(g.mobs).length + ' mob(s)' +
          (Object.keys(g.parked).length ? ' + ' + Object.keys(g.parked).length + ' left behind' : '') + (g.flyers ? ', ' + g.flyers + ' flyer(s)' : '') + ', targets ' +
          g.targets.map(u => g.names[u] || u).join(', ') + ', ' + clock((Date.now() - g.start) / 1000) + ' old' +
          (g.lostSince ? ', targets lost for ' + clock((Date.now() - g.lostSince) / 1000) : ''))
      })
      return 1
    })))
    .then(Commands.literal('clear').executes(safe(ctx => {
      const n = endAll(ctx.source.server)
      return reply(ctx, 'All ambush groups ended (' + n + ' leftover mob(s) removed).')
    })))
    .then(Commands.literal('toggle').executes(safe(ctx => {
      const server = ctx.source.server
      db().enabled = !db().enabled
      save()
      if (!db().enabled) endAll(server)
      else if (needsLoop(server)) startLoop(server)
      return reply(ctx, 'Portal Ambush is now ' + (db().enabled ? 'ON' : 'OFF (data kept; countdowns paused)') + '.')
    })))
  )
})

})()
