// =====================================================================================================
// PIG ESCORT DETAIL - a Ministry of Trolling server event (KubeJS 6, Minecraft 1.20.1 Forge)
//
// All players are Escorts. They must walk Ambassador Oinkington (a sacred pig) to a temporary
// Ministry-Approved Portal while waves of Piglins, Brutes and Hoglins try to kill it.
// Escorts win when the pig steps into the portal. The Piglins win if the pig dies or time runs out.
// Either way the event ends with the reveal of the Blood God's Syndicate (see FINALE_ENABLED).
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
//   /pigescort finale test success|fail  play that finale now, without a pig run (see PORTAL_FRAME_FROM)
//   /pigescort finale restoreframe       rebuild and relight the test frame (PORTAL_FRAME_FROM / _TO)
//   /pigescort reveal continue           skip the rest of the wait after the Syndicate leader joins
//   /pigescort track test                the Jockie countdown and cue on their own (ops only), for practice
//   /pigescort nether lock|unlock|status switch nether_portal_whitelist.js on or off (the finale unlocks it)
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
// growBy / growEveryWaves / maxWaveSize (optional): waves get growBy bigger every growEveryWaves timed waves, up to
// maxWaveSize. On hard with 5 Escorts: 8, 8, 10, 10, 12, 12, 14, 14, then 16.
// Kinds: piglin (gold sword), marksman (piglin with crossbow), brute (piglin brute, gold axe), hoglin.
const DIFFICULTIES = {
  easy:   { waveEverySeconds: 60, mobsPerWave: 2, maxAlive: 6,  pigDamageMultiplier: 0.25,
            mix: { piglin: 8, hoglin: 2 }, lateMix: {} },
  medium: { waveEverySeconds: 45, mobsPerWave: 3, maxAlive: 10, pigDamageMultiplier: 0.5,
            mix: { piglin: 5, marksman: 2, hoglin: 3 }, lateMix: { brute: 2 } },
  hard:   { waveEverySeconds: 30, mobsPerWave: 6, maxAlive: 24, pigDamageMultiplier: 0.75,
            growBy: 2, growEveryWaves: 2, maxWaveSize: 16,
            mix: { piglin: 4, marksman: 3, hoglin: 3, brute: 4 }, lateMix: { brute: 3 } },
}
const EXTRA_MOB_PER_PLAYERS = 2        // each wave gets +1 mob per this many Escorts
const FIRST_WAVE_DELAY_SECONDS = 20    // grace period before the first wave
const WAVE_SPAWN_MIN_DISTANCE = 10     // waves appear this far from the pig... (keep within 16: piglins can't
const WAVE_SPAWN_MAX_DISTANCE = 15     // notice an attack target further away than that, whatever their follow range)
const RAIDER_REGROUP_DISTANCE = 14     // raiders further than this from the pig are sent back towards it
const RAIDER_RELOCATE_DISTANCE = 22    // fallback mode only: raiders further than this are moved back near the pig
// Raiders of these kinds only ever target the pig: they ignore players, even ones who hit them.
// Kinds: 'piglin', 'marksman' (crossbow piglin), 'brute', 'hoglin'.
const PIG_ONLY_RAIDERS = ['marksman']
const MOB_PLAYER_AGGRO_RANGE = 8       // other raiders go for the pig, unless an Escort comes this close to them
                                       // (creative/spectator players are never targeted; mobs ignore them anyway)
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


// ===================== CONFIG: THE FINALE (the Blood God's Syndicate reveal) =====================
// When the pig reaches the portal (Ending A) or dies or runs out of time (Ending B), the event ends with
// the reveal of the Blood God's Syndicate instead of the Ministry's usual closing words. Both endings lead to
// the same explosion and reveal. The escort itself plays exactly as before.
// All times are in seconds.

const FINALE_ENABLED = true            // false = the old endings ("DELIVERED" / "DIPLOMATIC INCIDENT")
const UNLOCK_NETHER = true             // the reveal ends by switching off nether_portal_whitelist.js

// The Syndicate leader "joins" with /fakejoin (fake_players.js): the join message, the tab list entry with
// their skin, and the Discord join post. '' = no leader. They stay "online" until you run /fakeleave <name>.
// %leader% in any text below is replaced with this name.
const LEADER_NAME = 'hypixel'
const LEADER_EFFECTS_DELAY_SECONDS = 2   // thunder, red column and title this long after the join message
const LEADER_FINALE_DELAY_SECONDS = 20   // with no LEADER_LINES: the rest of the finale (AFTER_LEADER) starts
                                         // this long after the join message
// What the leader says after arriving, before the Ministry responds, one line after another (the first after
// the join message). Each line takes as long as the leader would need to type it (LEADER_TYPING below), so
// longer lines come later; give a line `after: N` to have it come exactly N seconds after the one before.
// Sent with /fakesay (fake_players.js): it shows as <%leader%> text, like real chat, and Discord posts it as the
// leader speaking. [] = no speech.
// effect: what happens at the ruins as the line appears (FINALE_SPEECH below):
//   'strike' (the default) one bolt of lightning   'ring' a ring of lightning and darkness   'none' nothing
const LEADER_LINES = [
  { text: "Sorry about the portal." },
  { text: "I was a friend of Technoblade's. Long before your statues. Long before your laws." },
  { text: "He never asked you to protect his pigs. You decided that after he was gone." },
  { text: "We value every pig. Each one is precious to us. Right up until we are mildly inconvenienced." },
  { text: "The same goes for you." },
  { text: "Some of you already work for us. You will not know which ones." },
  { text: "We have been here the whole time. We will be here when the Ministry is not." },
  { text: "Blood for the Blood God.", effect: 'ring' },
]
// How long the leader takes to "type" a line: pauseSeconds, plus one second for every charsPerSecond characters,
// kept between minSeconds and maxSeconds. With these numbers the lines above take 4.8 to 13.5 s each (about 74 s in all,
// with the first line at 6 s).
const LEADER_TYPING = { pauseSeconds: 2, charsPerSecond: 8, minSeconds: 3, maxSeconds: 14 }
const LEADER_FIRST_LINE_MIN_SECONDS = 6   // the first line comes at least this long after the join message
const LEADER_LINES_END_PAUSE_SECONDS = 8  // after the last line, the rest of the finale (AFTER_LEADER) starts
                                          // (with a FINALE_TRACK: the track starts instead, see below)
// A track (the Technoblade clip) after the leader's last line, before the Ministry responds (with no lines: when
// the Ministry would have responded). The Ministry waits for it to end. While it plays the heartbeat is silent.
// See PIG_ESCORT.md, "The finale track".
const FINALE_TRACK = {
  seconds: 21,          // THE TRACK'S LENGTH. 0 = no track
  startAfter: 4,        // seconds after the last line (instead of LEADER_LINES_END_PAUSE_SECONDS)
  pauseAfter: 2,        // seconds of quiet after it ends, before the Ministry responds
  // In Discord voice, through Jockie Music. The server can't start Jockie itself (it only plays for a person in
  // a voice channel), so ops get a countdown and a cue, and one of them sends jockieStart in Discord.
  // Queue it beforehand: m!play <link>, then m!pause.
  jockie: true,
  jockieStart: 'm!resume',
  jockieStop: 'm!stop',     // shown to ops if the finale is cut short while it plays
  cueCountdown: 5,          // seconds of countdown for ops before the cue
  // In-game too (optional): the sound from a resource pack players have, e.g. 'trollcraft:finale_track'. '' = none
  sound: '',
  volume: 1,
  category: 'master',       // the sound slider it follows: master, music, record, ...
}
// (/pigescort reveal continue skips whatever is left of the wait or the speech.)

// Only for /pigescort finale test and /pigescort finale restoreframe: two opposite corners of an obsidian
// frame (the outer edge, obsidian included), for example { x: 100, y: 64, z: 200 } and { x: 103, y: 68, z: 200 }.
// A real event always uses the portal it built itself. null = tests build the portal at the spot chosen
// with /pigescort setportal (or setportal random) and put the land back afterwards.
const PORTAL_FRAME_FROM = null
const PORTAL_FRAME_TO = null

// Voices: the same tags and colours as factions_config.js. garble is shown scrambled (like §k) before and
// after lines marked garble: true.
const VOICE_MINISTRY = { tag: '[MINISTRY]', tagColor: 'gold', textColor: 'yellow' }
const VOICE_HIJACK = { tag: '[SIGNAL HIJACKED]', tagColor: 'dark_red', textColor: 'red', garble: '||||||', garbleColor: 'dark_red' }

// The timelines. Each step happens `at` seconds after its timeline starts and is one of:
//   { at, ministry: 'text' }                  a [MINISTRY] line for everyone
//   { at, hijack: 'text', garble: true }      a [SIGNAL HIJACKED] line (garble: scrambled characters around it)
//   { at, action: 'name' }                    one of the actions set up below
// Ending A: from the moment the pig enters the portal.
const ENDING_SUCCESS = [
  { at: 0, action: 'gather' },
  { at: 0, action: 'fireworks' },
  { at: 0, ministry: 'The Swine has been delivered. Nether access is hereby authorized. Celebration is permitted for thirty (30) seconds.' },
  { at: 5, ministry: 'Each Escort will receive Form 88-D (Commendation, Pending) within 6 to 8 business weeks.' },
  { at: 9, action: 'portal_hum' },
  { at: 9, action: 'darkness' },
  { at: 11, hijack: 'Thank you for the escort.', garble: true },
  { at: 14, action: 'explosion' },
  { at: 17, hijack: 'The Ministry wanted one door: guarded, stamped, and taxed. Now every door is open.' },
  { at: 21, action: 'reveal' },
]
// Ending B: from the pig's death (or the moment time runs out).
const ENDING_FAIL = [
  { at: 0, action: 'gather' },
  { at: 0, ministry: 'The Swine has been lost. An inquiry will determine which of you is responsible. Preliminary findings: all of you.' },
  { at: 4, ministry: 'Nether access is denied indefinitely. Please return to your homes and reflect.' },
  { at: 8, action: 'blood_trail' },
  { at: 11, hijack: 'Spilled blood still pays the toll.', garble: true },
  { at: 14, action: 'explosion' },
  { at: 17, hijack: 'They would have kept him behind a wall of laws. We spent him, and the door opened. Every door is open now.' },
  { at: 21, action: 'reveal' },
]
// The reveal, after either ending.
const REVEAL = [
  { at: 0, action: 'reveal_title' },
  { at: 4, hijack: 'Honor the player, not the statue. Tend your fields, grow your strength, answer to no one.' },
  { at: 8, action: 'leader' },
]
// After the leader: once the leader's lines are said (or LEADER_FINALE_DELAY_SECONDS after the join message if
// there are none, or straight away with /pigescort reveal continue).
const AFTER_LEADER = [
  { at: 0, ministry: 'The preceding broadcast was not authorized. There is no Syndicate. Citizens who heard it are asked to un-hear it by end of day.' },
  { at: 5, action: 'unlock' },
  { at: 8, action: 'end' },     // the event ends: the usual cleanup (the land around the portal is put back)
]

// The actions.
// fireworks: gold fireworks this high above the top of the frame (high enough that they can't hurt anyone;
// firework damage to players is also cancelled during the finale).
const FINALE_FIREWORKS = { height: 12, count: 5, colors: [0xFFD700, 0xFFAA00], fadeColors: [0xFFFFFF], lifeTicks: 10 }
// portal_hum: the portal gets louder for everyone this close.
const FINALE_PORTAL_HUM = { sound: 'minecraft:block.portal.trigger', volume: 1, pitch: 0.7, radius: 48 }
// darkness: the screen darkens briefly for everyone this close.
const FINALE_DARKNESS = { seconds: 3, radius: 48 }
// gather: the escort party is brought to the portal to watch the rest. Escorts online in the Overworld and more
// than minDistance blocks from the portal are teleported `distance` blocks in front of it (on the side the pig
// came from: on a delivery the side of the route's start, after a death the side it died on, so the blood trail
// passes them), side by side `spacing` blocks apart, facing it. successMessage on a delivery, message otherwise.
// In a test (/pigescort finale test) only the op who ran it is brought.
const FINALE_GATHER = {
  distance: 10, spacing: 2, minDistance: 16,
  message: 'All Escorts are to report to the portal for the inquiry. You have been reported.',
  successMessage: 'All Escorts are to report to the portal for the commendation ceremony. Attendance is mandatory.',
}
// blood_trail: red dust rising from where the pig died and drifting to the portal (particles only). If the pig
// died further away than maxDistance, the trail starts maxDistance blocks out, in the direction it died.
const FINALE_BLOOD_TRAIL = { color: '0.7 0 0', size: 1.5, seconds: 3, steps: 12, rise: 3, maxDistance: 20 }
// explosion: VISUAL ONLY. Particles and sounds, then the portal blocks become air and the frame crying
// obsidian (nothing else changes), and a gentle push with no damage for players this close.
const FINALE_EXPLOSION = {
  particles: ['minecraft:large_smoke', 'minecraft:lava'],
  sounds: ['minecraft:entity.generic.explode', 'minecraft:entity.wither.spawn'],
  soundRadius: 96, knockbackRadius: 6, knockbackStrength: 0.8,
}
// reveal_title: the title for everyone online.
const FINALE_REVEAL_TITLE = {
  title: 'THE BLOOD GOD\'S', titleColor: 'dark_red', subtitle: 'SYNDICATE', subtitleColor: 'red', subtitleBold: true,
  fadeIn: 10, stay: 80, fadeOut: 20, sound: 'minecraft:entity.elder_guardian.curse',
}
// Lightning: VISUAL ONLY (a flash and thunder; no damage, no fire, nothing nearby is changed by it). If the game
// won't make a visual-only bolt, sparks and a thunder sound are used instead. Each burst: `bolts` bolts landing
// minRadius to maxRadius blocks from the middle of the portal (center: true = the first one right in the middle;
// ring: true = evenly around), spread over `seconds`.
const FINALE_LIGHTNING = {
  explosion: { bolts: 7, seconds: 1.5, minRadius: 1, maxRadius: 6, center: true },  // as the portal disappears
  arrival: { bolts: 3, seconds: 0.5, minRadius: 2, maxRadius: 5 },    // as the leader arrives
  line: { bolts: 1, seconds: 0, minRadius: 3, maxRadius: 10 },        // a leader's line with effect 'strike'
  ring: { bolts: 10, seconds: 1, minRadius: 6, maxRadius: 6, ring: true },  // a leader's line with effect 'ring'
}
// While the leader speaks (from their arrival until the Ministry responds; only if there are LEADER_LINES).
const FINALE_SPEECH = {
  weather: 'rain',        // 'rain', 'thunder' or 'none'. Put back the way it was when the finale ends.
                          // 'thunder' also brings the game's own REAL lightning (fire, damage) anywhere in the world.
  pulseSeconds: 2,        // this often at the ruins: a swirl of red dust and crimson spores, and a heartbeat
  pulseRadius: 32,        // who hears the heartbeat
  heartbeat: 'minecraft:entity.warden.heartbeat',
  dustColor: '0.6 0 0',
  ringDarkness: 3,        // seconds of darkness (for everyone within pulseRadius) with a 'ring' line
  ringSound: 'minecraft:entity.elder_guardian.curse',
}
// leader: thunder, lightning, a red column at the portal, and a title, once the join message is out.
const FINALE_LEADER = {
  sounds: ['minecraft:entity.lightning_bolt.thunder', 'minecraft:entity.lightning_bolt.impact'],
  columnColor: '0.8 0 0', columnHeight: 30,
  title: '%leader%', titleColor: 'dark_red', subtitle: 'has entered the server.', subtitleColor: 'gray',
  fadeIn: 10, stay: 60, fadeOut: 20,
}
// unlock: the Ministry's last word (only if UNLOCK_NETHER).
const FINALE_UNLOCK_MESSAGE = 'Due to an unscheduled structural event, Nether access is now unrestricted. This was always the plan.'
// Shown to ops only. %seconds% = LEADER_FINALE_DELAY_SECONDS.
// Told to a player who walks into the event portal before the explosion (nothing goes through it).
const FINALE_PORTAL_CLOSED = 'This portal is closed pending an inquiry. Step away from the portal.'
const FINALE_OP_NOTICE = '%leader% has joined. %speech%The rest of the finale runs in %seconds% s. Run /pigescort reveal continue to run it now.'


// ===================== CONSTANTS =====================

// Math.PI is missing in the server's script engine (it came out as NaN), so the value is written out here.
const TWO_PI = 6.283185307179586

const TAG_PIG = 'pig_escort_ambassador'
const TAG_MOB = 'pig_escort_raider'
const TAG_PLAYER = 'pig_escort_participant'
const TEAM_ESCORTS = 'pe_escorts'
const TEAM_RAIDERS = 'pe_raiders'
const BOSSBAR = 'kubejs:pig_escort'
const OVERWORLD = 'minecraft:overworld'
const SNAPSHOT_KEY = 'pig_escort_snapshot'
const SNAPSHOT_FILE = 'kubejs/pig_escort_snapshot.json'
// nether_portal_whitelist.js lets every portal light while this is true in the server's saved data.
const NETHER_UNLOCK_KEY = 'trollcraft_nether_unlocked'
const LEADER_JOIN_TIMEOUT_TICKS = 140  // longest wait for /fakejoin's message (it looks up the skin first)

const MOB_TYPES = { piglin: 'minecraft:piglin', marksman: 'minecraft:piglin', brute: 'minecraft:piglin_brute', hoglin: 'minecraft:hoglin' }
const MOB_NAMES = { 'minecraft:piglin': 'Piglin', 'minecraft:piglin_brute': 'Piglin Brute', 'minecraft:hoglin': 'Hoglin' }


// ===================== STATE =====================
// S.phase: idle -> staged -> countdown -> running -> (finale ->) ending -> idle
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
  fin: null,          // the finale in progress (see THE FINALE)
  diag: { hookCalls: {}, discard: 'not used yet', snapshotFile: 'not written yet', position: 'not used yet' },
}
global.pigEscortState = S
const WAS_INTERRUPTED = PREVIOUS_STATE != null &&
  (PREVIOUS_STATE.phase == 'countdown' || PREVIOUS_STATE.phase == 'running' || PREVIOUS_STATE.phase == 'finale' || PREVIOUS_STATE.phase == 'ending')
if (PREVIOUS_STATE) {
  // The old version's scheduled callbacks check its own token and phase; this makes them all stop.
  S.token = (PREVIOUS_STATE.token || 0) + 1
  PREVIOUS_STATE.token++
  PREVIOUS_STATE.phase = 'reloaded'
}

// Optional "clean" APIs. Each one is only used when USE_CLEAN_APIS is true and it loaded.
let CLEAN = { heightmap: null, memory: null, effectDeny: null, walkTarget: null }
if (USE_CLEAN_APIS) {
  try { CLEAN.heightmap = Java.loadClass('net.minecraft.world.level.levelgen.Heightmap$Types').MOTION_BLOCKING_NO_LEAVES } catch (e) { }
  try { CLEAN.memory = Java.loadClass('net.minecraft.world.entity.ai.memory.MemoryModuleType') } catch (e) { }
  try { CLEAN.walkTarget = Java.loadClass('net.minecraft.world.entity.ai.memory.WalkTarget') } catch (e) { }
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

// What has to be put back for one cell of the portal layout.
function snapshotCell(level, p) {
  const b = level.getBlock(p.x, p.y, p.z)
  const nbt = b.entityData
  return { x: p.x, y: p.y, z: p.z, s: stateString(b), n: nbt != null ? String(nbt.toString()) : null }
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
    let angle = Math.random() * TWO_PI
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

// A random standable spot WAVE_SPAWN_MIN..MAX_DISTANCE blocks from the pig, or null (counts failures).
function spotNearPig(server) {
  const R = S.run, pig = R.pig, level = overworldOf(server)
  let angle = Math.random() * TWO_PI
  let d = WAVE_SPAWN_MIN_DISTANCE + Math.random() * (WAVE_SPAWN_MAX_DISTANCE - WAVE_SPAWN_MIN_DISTANCE)
  let px = ex(pig), py = ey(pig), pz = ez(pig)
  let x = Math.floor(px + Math.cos(angle) * d)
  let z = Math.floor(pz + Math.sin(angle) * d)
  let top = Math.floor(py) + 16
  if (!isFinite(x) || !isFinite(z) || !isFinite(top)) {
    throw new Error('bad spawn position: pig ' + px + ' ' + py + ' ' + pz + ', angle ' + angle + ', distance ' + d + ' -> ' + x + ' ' + top + ' ' + z)
  }
  let g = findGround(level, x, z, top, top - 40)
  if (!g || g.fluid || g.bad) return null
  return { x: x + 0.5, y: g.y + 1, z: z + 0.5 }
}

function spawnRaider(server, kind) {
  const R = S.run
  for (let attempt = 0; attempt < 6; attempt++) {
    let spot = spotNearPig(server)
    if (!spot) { R.waveStats.noGround++; continue }
    S.lastMob = null
    S.expectMob = true
    let result = 0
    try {
      result = runOW(server, 'summon ' + MOB_TYPES[kind] + ' ' + spot.x + ' ' + spot.y + ' ' + spot.z + ' ' + mobNbt(kind))
    } finally {
      S.expectMob = false
    }
    let m = S.lastMob
    S.lastMob = null
    if (!result) { R.waveStats.summonFailed++; continue }   // /summon itself was rejected
    if (!m) { R.waveStats.removedOnSpawn++; continue }      // summoned, but something removed it as it appeared
    if (m) {
      R.mobs[uuidOf(m)] = m
      R.mobKinds[uuidOf(m)] = kind
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

// How many raiders the next wave asks for (before the maxAlive room).
function waveSize(R) {
  const D = R.diff
  let n = D.mobsPerWave + Math.floor(Object.keys(R.participants).length / EXTRA_MOB_PER_PLAYERS)
  if (D.growBy) n = Math.min(D.maxWaveSize || Infinity, n + D.growBy * Math.floor((R.waveCount || 0) / (D.growEveryWaves || 1)))
  return n
}
// manual = /pigescort wave: it doesn't count towards the waves growing.
function maybeSpawnWave(server, manual) {
  const R = S.run
  if (server.tickCount < R.nextWaveTick) return
  R.nextWaveTick = server.tickCount + R.diff.waveEverySeconds * 20
  const size = waveSize(R)
  if (!manual) R.waveCount = (R.waveCount || 0) + 1
  const room = R.diff.maxAlive - aliveMobs().length
  if (room <= 0) return
  const want = Math.min(room, size)
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

function setMobTarget(server, mob, target) {
  const isHoglin = typeOf(mob) == 'minecraft:hoglin'
  if (CLEAN.memory) {
    try {
      if (isHoglin) mob.getBrain().setMemory(CLEAN.memory.ATTACK_TARGET, target)
      else mob.getBrain().setMemoryWithExpiry(CLEAN.memory.ANGRY_AT, javaUuidOf(target), 600)
      return
    } catch (e) { }
  }
  // Fallback: write the piglin's anger memory with /data. This restarts its AI, so it's only done when the
  // target changes (or to renew it). Hoglins have no anger memory, so in fallback mode they only go for
  // players near them; set USE_CLEAN_APIS = true for hoglins to target the pig too.
  if (isHoglin) return
  run(server, 'data merge entity ' + uuidOf(mob) + ' {Brain:{memories:{"minecraft:angry_at":{value:' + uuidIntArray(uuidOf(target)) + ',ttl:600L}}}}')
}

// Sends a raider that has drifted away back towards the pig. Piglins can't notice a target more than 16 blocks
// away, so without this they wander off. Clean mode: walk it there. Fallback: move it back once it's far out.
function regroup(server, mob, dPig) {
  const R = S.run
  if (CLEAN.memory && CLEAN.walkTarget) {
    try {
      mob.getBrain().setMemory(CLEAN.memory.WALK_TARGET, new CLEAN.walkTarget(R.pig, 1.0, 3))
      return
    } catch (e) { }
  }
  if (dPig <= RAIDER_RELOCATE_DISTANCE) return
  const id = uuidOf(mob)
  if (R.relocated[id] && server.tickCount - R.relocated[id] < 200) return
  const spot = spotNearPig(server)
  if (!spot) return
  R.relocated[id] = server.tickCount
  runOW(server, 'tp ' + id + ' ' + spot.x + ' ' + spot.y + ' ' + spot.z)
}

// Creative and spectator players can't be attacked, so don't aim mobs at them.
function canBeTargeted(player) {
  try { return !player.isCreative() && !player.isSpectator() } catch (e) { return true }
}

// Raiders go for the pig; an Escort who gets within MOB_PLAYER_AGGRO_RANGE of a raider draws it off
// (except PIG_ONLY_RAIDERS). A mob's target is only rewritten when it changes, or every 20 seconds to renew it.
// Pig-only raiders are pointed back at the pig regularly, because piglins turn on whoever hits them.
function retargetMobs(server, escorts) {
  const R = S.run, pig = R.pig
  const renew = (server.tickCount - R.lastRetarget) >= 400
  if (renew) R.lastRetarget = server.tickCount
  // Clean mode can do it every second (it doesn't disturb the AI); the /data fallback only every 5 seconds.
  const reassert = CLEAN.memory ? true : (server.tickCount - R.lastPigOnlyAssert) >= 100
  if (reassert) R.lastPigOnlyAssert = server.tickCount
  const targets = escorts.filter(canBeTargeted)
  aliveMobs().forEach(m => {
    const dPig = dist3({ x: ex(m), y: ey(m), z: ez(m) }, { x: ex(pig), y: ey(pig), z: ez(pig) })
    if (dPig > MOB_MAX_DISTANCE_FROM_PIG || dimOf(m) != OVERWORLD) {
      S.allowRemoval = true
      try { run(server, 'kill ' + uuidOf(m)) } finally { S.allowRemoval = false }
      return
    }
    if (dPig > RAIDER_REGROUP_DISTANCE) regroup(server, m, dPig)
    const id = uuidOf(m)
    const pigOnly = PIG_ONLY_RAIDERS.indexOf(R.mobKinds[id]) >= 0
    let target = pig
    if (!pigOnly) {
      let best = MOB_PLAYER_AGGRO_RANGE
      targets.forEach(p => {
        const d = dist3({ x: ex(m), y: ey(m), z: ez(m) }, { x: ex(p), y: ey(p), z: ez(p) })
        if (d < best) { best = d; target = p }
      })
    }
    const targetId = uuidOf(target)
    if (R.mobTargets[id] == targetId && !renew && !(pigOnly && reassert)) return
    R.mobTargets[id] = targetId
    setMobTarget(server, m, target)
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
  // Note: event.cancel() stops this function immediately (KubeJS 6), so it's called at each exit point.
  player.setHealth(player.getMaxHealth())
  extinguish(player)
  player.resetFallDistance()
  if (typeof player.setFoodLevel == "function") player.setFoodLevel(20)
  if (server.tickCount < info.processingUntil) { event.cancel(); return } // already being processed
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
  event.cancel()   // last: cancel() stops this function
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
    mobs: {}, nextWaveTick: 0, waveStats: { noGround: 0, summonFailed: 0, removedOnSpawn: 0 }, lastWave: null, halfTick: 0, endTick: 0, lastRetarget: 0, lastPigOnlyAssert: 0, mobTargets: {}, mobKinds: {}, relocated: {}, lastRegen: 0, lastPortalRepair: -1000,
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
    blocks.push(snapshotCell(level, p))
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

  if (wasRunning && FINALE_ENABLED && (result == 'delivered' || result == 'pig_died' || result == 'timeout')) {
    console.info('[PigEscort] Event ended: ' + result + ' (finale)')
    finaleRewards(server, result == 'delivered')
    startFinale(server, { kind: result == 'delivered' ? 'success' : 'fail', test: false, frame: siteFrame(R.site), from: pigEndPos(R, result) })
    return
  }

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
  S.fin = null
  S.token++
}


// ===================== THE FINALE (the Blood God's Syndicate reveal) =====================
// S.fin = { kind: 'success'|'fail', test, frame, from, startTick, leaderAt, afterLeader, keepSetup }.
// Every step is scheduled with the current token: /pigescort stop, a /reload or the cleanup bumps the token,
// and every step still waiting is dropped.

function fill(text) { return String(text).split('%leader%').join(LEADER_NAME) }

// A voice line: tag, text, and the scrambled characters around it when garble is set.
function voiceJson(voice, text, garble) {
  const g = garble && voice.garble ? { text: voice.garble, color: voice.garbleColor || voice.tagColor, obfuscated: true } : null
  const parts = ['']
  if (g) parts.push(g, { text: ' ' })
  parts.push({ text: voice.tag, color: voice.tagColor, bold: true }, { text: ' ' + fill(text), color: voice.textColor })
  if (g) parts.push({ text: ' ' }, g)
  return JSON.stringify(parts)
}
function say(server, voice, text, garble) { run(server, 'tellraw @a ' + voiceJson(voice, text, garble)) }

// Shown to operators only (and logged).
function tellOps(server, text) {
  console.info('[PigEscort] ' + text)
  const json = JSON.stringify(['', { text: '[Escort] ', color: 'gold' }, { text: text, color: 'yellow' }])
  onlinePlayers(server).forEach(p => {
    let op = false
    try { op = p.hasPermissions(2) } catch (e) { }
    if (op) run(server, 'tellraw ' + nameOf(p) + ' ' + json)
  })
}

function titleAll(server, t) {
  run(server, 'title @a times ' + t.fadeIn + ' ' + t.stay + ' ' + t.fadeOut)
  const sub = { text: fill(t.subtitle), color: t.subtitleColor }
  if (t.subtitleBold) sub.bold = true
  run(server, 'title @a subtitle ' + JSON.stringify(sub))
  run(server, 'title @a title ' + JSON.stringify({ text: fill(t.title), color: t.titleColor, bold: true }))
}

// Runs a command at a point in the Overworld, so ~ ~ ~ and @a[distance=..] work from there.
function at(server, p, command) {
  return run(server, 'execute in ' + OVERWORLD + ' positioned ' + num(p.x) + ' ' + num(p.y) + ' ' + num(p.z) + ' run ' + command)
}
function particleAt(server, id, p, spread, speed, count) {
  runOW(server, 'particle ' + id + ' ' + num(p.x) + ' ' + num(p.y) + ' ' + num(p.z) + ' ' + spread + ' ' + speed + ' ' + count + ' force @a')
}
// A sound everyone within radius hears at full volume.
function soundAround(server, p, id, radius, volume, pitch) {
  at(server, p, 'playsound ' + id + ' master @a[distance=..' + radius + '] ~ ~ ~ ' + volume + ' ' + pitch + ' 1')
}

// The frame: its cells ({x, y, z, kind: 'frame'|'portal'}), the portal's axis, the middle of the portal
// opening, and the four outer corners.
function frameInfo(cells, axis) {
  const frame = cells.filter(c => c.kind == 'frame'), portal = cells.filter(c => c.kind == 'portal')
  const mid = list => {
    let x = 0, y = 0, z = 0
    list.forEach(c => { x += c.x; y += c.y; z += c.z })
    return { x: x / list.length + 0.5, y: y / list.length + 0.5, z: z / list.length + 0.5 }
  }
  const minOf = k => Math.min.apply(null, frame.map(c => c[k])), maxOf = k => Math.max.apply(null, frame.map(c => c[k]))
  const lo = axis == 'x' ? minOf('x') : minOf('z'), hi = axis == 'x' ? maxOf('x') : maxOf('z')
  const center = mid(portal.length ? portal : frame)
  const point = (u, y) => axis == 'x' ? { x: u + 0.5, y: y + 0.5, z: center.z } : { x: center.x, y: y + 0.5, z: u + 0.5 }
  const bottom = minOf('y'), top = maxOf('y')
  return { cells: cells, axis: axis, center: center, bottom: bottom, top: top,
    corners: [point(lo, bottom), point(hi, bottom), point(lo, top), point(hi, top)] }
}
// The portal the event built.
function siteFrame(site) {
  return frameInfo(portalLayout(site).filter(p => p.kind == 'frame' || p.kind == 'portal'), site.axis)
}
// The frame from PORTAL_FRAME_FROM / _TO: null if they aren't set, { error } if they don't describe a frame.
function cornerFrame() {
  if (!PORTAL_FRAME_FROM || !PORTAL_FRAME_TO) return null
  const a = PORTAL_FRAME_FROM, b = PORTAL_FRAME_TO
  let axis
  if (a.z == b.z) axis = 'x'
  else if (a.x == b.x) axis = 'z'
  else return { error: 'PORTAL_FRAME_FROM and PORTAL_FRAME_TO must have the same x or the same z (a portal frame is flat).' }
  const uMin = axis == 'x' ? Math.min(a.x, b.x) : Math.min(a.z, b.z), uMax = axis == 'x' ? Math.max(a.x, b.x) : Math.max(a.z, b.z)
  const yMin = Math.min(a.y, b.y), yMax = Math.max(a.y, b.y)
  if (uMax - uMin < 2 || yMax - yMin < 2) return { error: 'The frame from PORTAL_FRAME_FROM to PORTAL_FRAME_TO has no room for portal blocks inside.' }
  const cells = []
  for (let u = uMin; u <= uMax; u++) {
    for (let y = yMin; y <= yMax; y++) {
      let edge = u == uMin || u == uMax || y == yMin || y == yMax
      cells.push(axis == 'x' ? { x: u, y: y, z: a.z, kind: edge ? 'frame' : 'portal' } : { x: a.x, y: y, z: u, kind: edge ? 'frame' : 'portal' })
    }
  }
  return frameInfo(cells, axis)
}
// The portal opening, grown by half a block, for spotting anything that walks into it.
function finaleBox(frame) {
  const portal = frame.cells.filter(c => c.kind == 'portal')
  const lo = k => Math.min.apply(null, portal.map(c => c[k])), hi = k => Math.max.apply(null, portal.map(c => c[k]))
  return { minX: lo('x') - 0.5, maxX: hi('x') + 1.5, minY: lo('y') - 0.5, maxY: hi('y') + 1.5, minZ: lo('z') - 0.5, maxZ: hi('z') + 1.5 }
}
// During the finale nothing goes through the event portal; players are put back in front of it.
function finaleTravel(event) {
  const e = event.getEntity(), F = S.fin
  if (!F || dimOf(e) != OVERWORLD || !entityInBox(e, F.box)) return
  event.setCanceled(true)
  if (!e.isPlayer()) return
  const server = Utils.server, n = nameOf(e), fr = F.frame, c = fr.center
  const along = fr.axis == 'x' ? ez(e) - c.z : ex(e) - c.x
  const spot = frontOf(fr, along >= 0 ? 2 : -2)
  runOW(server, 'tp ' + uuidOf(e) + ' ' + num(spot.x) + ' ' + fr.bottom + ' ' + num(spot.z))
  if (!F.pushCooldown[n] || server.tickCount - F.pushCooldown[n] > 60) {
    F.pushCooldown[n] = server.tickCount
    tell(server, n, FINALE_PORTAL_CLOSED, 'red')
  }
}
// A point `d` blocks in front of the portal, at the bottom of the frame.
function frontOf(frame, d) {
  const c = frame.center
  return frame.axis == 'x' ? { x: c.x, y: frame.bottom + 1, z: c.z + d } : { x: c.x + d, y: frame.bottom + 1, z: c.z }
}

// The escort party (or, in a test, the op who ran it) is teleported in front of the portal, facing it.
function gatherParty(server) {
  const G = FINALE_GATHER, F = S.fin, fr = F.frame, c = fr.center
  const names = F.test ? (F.testBy ? [F.testBy] : []) : (S.run ? Object.keys(S.run.participants) : [])
  const players = onlinePlayers(server).filter(p => names.indexOf(nameOf(p)) >= 0 && dimOf(p) == OVERWORLD &&
    horizDist(ex(p), ez(p), c.x, c.z) > G.minDistance)
  if (!players.length) return
  // On a real delivery the pig is in the portal, so the route's start says which side they came from.
  const ref = F.kind == 'success' && !F.test && S.run && S.run.start ? S.run.start : F.from
  const along = ref ? (fr.axis == 'x' ? ref.z - c.z : ref.x - c.x) : 1
  const base = frontOf(fr, (along >= 0 ? 1 : -1) * G.distance), level = overworldOf(server)
  players.forEach((p, i) => {
    let off = (i - (players.length - 1) / 2) * G.spacing
    let x = Math.floor(fr.axis == 'x' ? base.x + off : base.x), z = Math.floor(fr.axis == 'x' ? base.z : base.z + off)
    let spot = safeSpot(level, { x: x, y: base.y, z: z })
    runOW(server, 'tp ' + uuidOf(p) + ' ' + (x + 0.5) + ' ' + (spot ? spot.y : base.y) + ' ' + (z + 0.5) +
      ' facing ' + num(c.x) + ' ' + num(c.y) + ' ' + num(c.z))
    tell(server, nameOf(p), F.kind == 'success' ? G.successMessage : G.message, 'yellow')
  })
  console.info('[PigEscort] Brought ' + players.length + ' escort' + (players.length == 1 ? '' : 's') + ' to the portal')
}
// Where the blood trail starts: `from`, or maxDistance blocks from the portal in its direction if it's further.
function trailStart(from, to, maxDistance) {
  const d = horizDist(from.x, from.z, to.x, to.z)
  if (!maxDistance || d <= maxDistance) return from
  const k = maxDistance / d
  return { x: to.x + (from.x - to.x) * k, y: to.y + (from.y - to.y) * k, z: to.z + (from.z - to.z) * k }
}

// Where the pig was when the event ended (for the blood trail), or null.
function pigEndPos(R, result) {
  if (result == 'pig_died' && R.pigDeathPos) return R.pigDeathPos
  try { if (R.pig && !R.pig.isRemoved()) return { x: ex(R.pig), y: ey(R.pig), z: ez(R.pig) } } catch (e) { }
  return R.lastValid ? { x: R.lastValid.x, y: R.lastValid.y, z: R.lastValid.z } : null
}

// The same rewards as the old endings, given quietly: everyone on a delivery, the top killer either way.
function finaleRewards(server, delivered) {
  const R = S.run
  const players = participantPlayers(server)
  let top = null, topKills = 0
  Object.keys(R.participants).forEach(n => { if (R.participants[n].kills > topKills) { topKills = R.participants[n].kills; top = n } })
  if (delivered) players.forEach(p => rewardPlayer(p, REWARD_AMOUNT, 'Pig Escort Detail: Ambassador delivered'))
  if (top) players.filter(p => nameOf(p) == top).forEach(p => rewardPlayer(p, TOP_KILLER_BONUS_AMOUNT, 'Pig Escort Detail: most kills'))
}

// Runs fn after `ticks`, unless the finale was stopped or replaced in the meantime.
function later(server, ticks, fn) {
  const token = S.token
  server.scheduleInTicks(Math.max(1, Math.round(ticks)), () => {
    if (token != S.token || S.phase != 'finale') return
    try {
      fn()
    } catch (e) {
      console.error('[PigEscort] Finale step failed: ' + e)
    }
  })
}
// Every step is one tick later than its `at`, so a step at 0 keeps its place relative to the others.
function runSteps(server, steps) {
  steps.forEach(step => later(server, 1 + step.at * 20, () => doStep(server, step)))
}
function doStep(server, step) {
  if (step.ministry != null) say(server, VOICE_MINISTRY, step.ministry, step.garble)
  if (step.hijack != null) say(server, VOICE_HIJACK, step.hijack, step.garble)
  if (step.action) {
    let action = FINALE_ACTIONS[step.action]
    if (!action) throw new Error('unknown finale action "' + step.action + '"')
    action(server)
  }
}

// Starts a finale. The pig and the raiders leave at once, so nobody is fighting during it.
function startFinale(server, fin) {
  S.phase = 'finale'
  hooks.running = true   // the portal stays closed to travellers until the explosion (see hooks.onTravel)
  global.trollcraftEventActive = true
  S.token++
  fin.box = finaleBox(fin.frame)
  fin.pushCooldown = {}
  fin.startTick = server.tickCount
  fin.leaderAt = null
  fin.afterLeader = false
  S.fin = fin
  removeTagged(server, TAG_PIG)
  removeTagged(server, TAG_MOB)
  run(server, 'bossbar remove ' + BOSSBAR)
  console.info('[PigEscort] Finale started: ' + fin.kind + (fin.test ? ' (test)' : ''))
  runSteps(server, fin.kind == 'success' ? ENDING_SUCCESS : ENDING_FAIL)
}

function finishFinale(server) {
  const keep = S.fin ? S.fin.keepSetup : null
  console.info('[PigEscort] Finale finished')
  stopTrack(server)
  restoreWeather(server)
  cleanup(server, S.snap)
  if (keep) { S.setup = keep; S.phase = 'staged' }   // a test at the staged portal site leaves the setup as it was
}

function stopFinale(server) {
  S.token++
  finishFinale(server)
}

// The leader: /fakejoin, then wait for the join message (the skin lookup can take a few seconds).
function leaderStep(server) {
  if (!LEADER_NAME) { leaderJoined(server, false); return }
  const key = LEADER_NAME.toLowerCase()
  const fakes = () => (global.fakePlayers && global.fakePlayers.fakes) || {}
  if (fakes()[key]) {
    tellOps(server, LEADER_NAME + ' was already pretending to be online, so there was no join message. Run /fakeleave ' + LEADER_NAME + ' before the next run.')
    leaderJoined(server, true)
    return
  }
  let ok = 0
  try { ok = run(server, 'fakejoin ' + LEADER_NAME) } catch (e) { console.error('[PigEscort] /fakejoin failed: ' + e) }
  if (!ok) {
    tellOps(server, '/fakejoin ' + LEADER_NAME + ' failed (is fake_players.js installed?). The finale goes on without the join message.')
    leaderJoined(server, true)
    return
  }
  const wait = waited => {
    if (fakes()[key] || waited >= LEADER_JOIN_TIMEOUT_TICKS) { leaderJoined(server, true); return }
    later(server, 5, () => wait(waited + 5))
  }
  wait(0)
}
function leaderJoined(server, arrived) {
  const F = S.fin
  if (F.leaderAt != null) return
  F.leaderAt = server.tickCount
  // The leader's lines, only if they're really "online" to say them (not if /fakejoin failed).
  const fakes = (global.fakePlayers && global.fakePlayers.fakes) || {}
  const lines = arrived && LEADER_NAME && fakes[LEADER_NAME.toLowerCase()] ? LEADER_LINES : []
  let t = 0
  lines.forEach((line, i) => {
    t += i == 0 ? Math.max(LEADER_FIRST_LINE_MIN_SECONDS, lineDelay(line)) : lineDelay(line)
    later(server, t * 20, () => leaderSays(server, line))
  })
  if (lines.length) speechStart(server)
  // Then the track (if there is one), then the rest of the finale.
  const T = FINALE_TRACK, wanted = !!(T.jockie || T.sound), track = wanted && T.seconds > 0
  if (wanted && !(T.seconds > 0)) tellOps(server, 'FINALE_TRACK.seconds (the length of the track) isn\'t set in pig_escort.js, so the finale track was skipped.')
  let wait = lines.length ? t + (track ? T.startAfter : LEADER_LINES_END_PAUSE_SECONDS) : LEADER_FINALE_DELAY_SECONDS
  if (track) {
    if (T.jockie) {
      // forEach, so each scheduled step keeps its own number
      countdownNumbers(Math.min(T.cueCountdown, Math.floor(wait))).forEach(n => later(server, (wait - n) * 20, () => jockieCountdown(server, n)))
    }
    later(server, wait * 20, () => playTrack(server))
    wait += T.seconds + T.pauseAfter
  }
  if (arrived) {
    later(server, LEADER_EFFECTS_DELAY_SECONDS * 20, () => FINALE_ACTIONS.leader_arrival(server))
    tellOps(server, fill(FINALE_OP_NOTICE).split('%speech%').join(lines.length ? 'They say ' + lines.length + ' line' + (lines.length == 1 ? '' : 's') + '. ' : '')
      .split('%seconds%').join(num(wait)))
  }
  later(server, wait * 20, () => afterLeader(server))
}
// Seconds from the line before to this one: `after` if the line has it, otherwise the time to type it.
function lineDelay(line) {
  let sec = line.after
  if (sec == null) {
    let T = LEADER_TYPING
    sec = Math.min(T.maxSeconds, Math.max(T.minSeconds, T.pauseSeconds + String(line.text).length / T.charsPerSecond))
  }
  return Math.round(sec * 20) / 20   // whole ticks
}
// One of the leader's lines, as real-looking chat (and on Discord as them), and its effect at the ruins.
// Nothing once the Ministry has the floor.
function leaderSays(server, line) {
  if (!S.fin || S.fin.afterLeader) return
  const fp = global.fakePlayers
  if (!fp || typeof fp.say != 'function') {
    if (!S.fin.sayMissing) tellOps(server, 'The leader\'s lines need fake_players.js (global.fakePlayers.say). They were skipped.')
    S.fin.sayMissing = true
    return
  }
  const result = String(fp.say(LEADER_NAME, fill(line.text)))
  if (!/^</.test(result)) console.warn('[PigEscort] Leader line not said: ' + result)
  lineEffect(server, line.effect || 'strike')
}
function lineEffect(server, effect) {
  if (effect == 'none') return
  if (effect == 'ring') {
    let Sp = FINALE_SPEECH, c = S.fin.frame.center
    lightningBurst(server, FINALE_LIGHTNING.ring)
    at(server, c, 'effect give @a[distance=..' + Sp.pulseRadius + '] minecraft:darkness ' + Sp.ringDarkness + ' 0 true')
    soundAround(server, c, Sp.ringSound, Sp.pulseRadius, 1, 1)
    return
  }
  if (effect != 'strike') console.warn('[PigEscort] Unknown leader line effect "' + effect + '" (a strike is used)')
  lightningBurst(server, FINALE_LIGHTNING.line)
}

// While the leader speaks: the weather turns (put back by finishFinale) and the ruins pulse until the Ministry
// has the floor.
function speechStart(server) {
  const W = FINALE_SPEECH.weather
  if (W == 'rain' || W == 'thunder') {
    let before = null
    try {
      let level = overworldOf(server)
      before = level.isThundering() ? 'thunder' : level.isRaining() ? 'rain' : 'clear'
    } catch (e) {
      console.warn('[PigEscort] Could not read the weather, so it is left alone: ' + e)
    }
    // Already stormy enough: leave it (and don't calm a thunderstorm down to rain).
    if (before != null && before != W && before != 'thunder') {
      S.fin.weatherBefore = before
      runOW(server, 'weather ' + W)
    }
  }
  S.fin.pulses = 0
  later(server, FINALE_SPEECH.pulseSeconds * 20, () => speechPulse(server))
}
function speechPulse(server) {
  const F = S.fin, Sp = FINALE_SPEECH
  if (!F || F.afterLeader) return
  const c = F.frame.center, n = 8, turn = F.pulses++ * 0.4
  for (let i = 0; i < n; i++) {
    let a = turn + i / n * TWO_PI
    particleAt(server, 'minecraft:dust ' + Sp.dustColor + ' 2', { x: c.x + Math.cos(a) * 2.5, y: F.frame.bottom + 1 + (i % 4), z: c.z + Math.sin(a) * 2.5 }, '0.1 0.3 0.1', 0, 6)
  }
  particleAt(server, 'minecraft:crimson_spore', c, '3 2 3', 0, 40)
  if (!F.trackPlaying) soundAround(server, c, Sp.heartbeat, Sp.pulseRadius, 1, 1)
  later(server, Sp.pulseSeconds * 20, () => speechPulse(server))
}
function restoreWeather(server) {
  if (!S.fin || !S.fin.weatherBefore) return
  runOW(server, 'weather ' + S.fin.weatherBefore)
  S.fin.weatherBefore = null
}

// Visual-only lightning (as /aura in smite.js): a flash and thunder, no damage, no fire. If it can't be made,
// sparks and a thunder sound instead. Never real lightning.
let boltWarned = false
function visualBolt(server, p) {
  try {
    let bolt = overworldOf(server).createEntity('minecraft:lightning_bolt')
    bolt.setVisualOnly(true)
    bolt.setPosition(p.x, p.y, p.z)
    bolt.spawn()
    return
  } catch (e) {
    if (!boltWarned) console.warn('[PigEscort] Visual-only lightning failed (sparks are used instead): ' + e)
    boltWarned = true
  }
  particleAt(server, 'minecraft:electric_spark', { x: p.x, y: p.y + 1, z: p.z }, '0.3 2 0.3', 0.1, 60)
  at(server, p, 'playsound minecraft:entity.lightning_bolt.thunder weather @a ~ ~ ~ 4 1')
}
// A burst of FINALE_LIGHTNING around the portal: the first bolt now, the rest spread over spec.seconds.
function lightningBurst(server, spec) {
  if (!spec || !(spec.bolts > 0)) return
  const fr = S.fin.frame, c = fr.center
  const bolts = []
  for (let i = 0; i < spec.bolts; i++) {
    let p
    if (i == 0 && spec.center) {
      p = { x: c.x, y: fr.bottom, z: c.z }
    } else {
      let a = spec.ring ? i / spec.bolts * TWO_PI : Math.random() * TWO_PI
      let d = spec.minRadius + Math.random() * (spec.maxRadius - spec.minRadius)
      p = { x: c.x + Math.cos(a) * d, y: fr.bottom, z: c.z + Math.sin(a) * d }
    }
    bolts.push({ p: p, ticks: spec.bolts > 1 ? i / (spec.bolts - 1) * spec.seconds * 20 : 0 })
  }
  // forEach, so each scheduled bolt keeps its own spot
  bolts.forEach(b => {
    if (b.ticks < 1) visualBolt(server, b.p)
    else later(server, b.ticks, () => visualBolt(server, b.p))
  })
}
function afterLeader(server) {
  if (!S.fin || S.fin.afterLeader) return
  S.fin.afterLeader = true
  stopTrack(server)
  runSteps(server, AFTER_LEADER)
}
// FINALE_TRACK starts: the cue for ops (Jockie), and in-game for everyone online, where each of them stands.
function playTrack(server) {
  if (!S.fin || S.fin.afterLeader) return
  const T = FINALE_TRACK
  S.fin.trackPlaying = true
  S.fin.trackEnds = server.tickCount + T.seconds * 20
  if (T.jockie) jockieCue(server)
  if (T.sound) run(server, 'execute as @a at @s run playsound ' + T.sound + ' ' + T.category + ' @s ~ ~ ~ ' + T.volume + ' 1 1')
  console.info('[PigEscort] Finale track started')
}
// When the Ministry takes over or the finale ends; if that's before the track has ended, it's cut off
// (and ops are told how to stop Jockie).
function stopTrack(server) {
  if (!S.fin || !S.fin.trackPlaying) return
  const T = FINALE_TRACK
  S.fin.trackPlaying = false
  if (server.tickCount >= S.fin.trackEnds) return
  if (T.sound) run(server, 'stopsound @a ' + T.category + ' ' + T.sound)
  if (T.jockie) opsCopyLine(server, 'The finale was cut short. Stop the track in Jockie: ', T.jockieStop)
}

// The Jockie cue, for ops only.
function opsOnline(server) {
  return onlinePlayers(server).filter(p => {
    try { return p.hasPermissions(2) } catch (e) { return false }
  })
}
function countdownNumbers(from) {
  const out = []
  for (let k = from; k >= 1; k--) out.push(k)
  return out
}
function jockieCountdown(server, n) {
  const json = JSON.stringify({ text: 'Finale track (Jockie) in ' + n + '...', color: 'gold' })
  opsOnline(server).forEach(p => run(server, 'title ' + nameOf(p) + ' actionbar ' + json))
}
function jockieCue(server) {
  const T = FINALE_TRACK
  opsOnline(server).forEach(p => {
    title(server, nameOf(p), 'START THE TRACK', 'gold', 'Jockie: ' + T.jockieStart, 'aqua')
    sound(server, nameOf(p), 'minecraft:block.note_block.pling', 1, 2)
  })
  opsCopyLine(server, 'Start the finale track in Jockie now: ', T.jockieStart)
}
// A chat line for ops with a command to click and copy.
function opsCopyLine(server, text, command) {
  const json = JSON.stringify(['', { text: '[Escort] ', color: 'gold' }, { text: text, color: 'yellow' },
    { text: command, color: 'aqua', bold: true, underlined: true, clickEvent: { action: 'copy_to_clipboard', value: command },
      hoverEvent: { action: 'show_text', contents: 'Click to copy' } }])
  console.info('[PigEscort] ' + text + command)
  opsOnline(server).forEach(p => run(server, 'tellraw ' + nameOf(p) + ' ' + json))
}
// /pigescort track test: the countdown and cue on their own, to practise with Jockie.
function trackTest(ctx) {
  const server = ctx.source.server, T = FINALE_TRACK
  if (!T.jockie) { reply(ctx, 'FINALE_TRACK.jockie is off, so there is no cue to test.'); return 0 }
  countdownNumbers(T.cueCountdown).forEach(n => server.scheduleInTicks(Math.max(1, (T.cueCountdown - n) * 20), () => jockieCountdown(server, n)))
  server.scheduleInTicks(Math.max(1, T.cueCountdown * 20), () => jockieCue(server))
  reply(ctx, 'Cue test: the countdown starts now and the cue comes in ' + T.cueCountdown + ' s (ops only). The track is ' + T.seconds + ' s long.')
  return 1
}

const FINALE_ACTIONS = {
  fireworks: server => {
    const F = FINALE_FIREWORKS, fr = S.fin.frame, c = fr.center
    const nbt = '{LifeTime:' + F.lifeTicks + ',FireworksItem:{id:"minecraft:firework_rocket",Count:1b,tag:{Fireworks:{Flight:1b,Explosions:[{Type:1b,Flicker:1b,Trail:1b,Colors:[I;' +
      F.colors.join(',') + '],FadeColors:[I;' + F.fadeColors.join(',') + ']}]}}}}'
    for (let i = 0; i < F.count; i++) {
      let off = (i - (F.count - 1) / 2) * 2
      let x = fr.axis == 'x' ? c.x + off : c.x, z = fr.axis == 'x' ? c.z : c.z + off
      runOW(server, 'summon minecraft:firework_rocket ' + num(x) + ' ' + (fr.top + F.height) + ' ' + num(z) + ' ' + nbt)
    }
  },
  portal_hum: server => {
    const H = FINALE_PORTAL_HUM
    soundAround(server, S.fin.frame.center, H.sound, H.radius, H.volume, H.pitch)
  },
  darkness: server => {
    at(server, S.fin.frame.center, 'effect give @a[distance=..' + FINALE_DARKNESS.radius + '] minecraft:darkness ' + FINALE_DARKNESS.seconds + ' 0 true')
  },
  gather: server => gatherParty(server),
  blood_trail: server => {
    const B = FINALE_BLOOD_TRAIL, F = S.fin, to = F.frame.center
    const from = trailStart(F.from || frontOf(F.frame, 10), to, B.maxDistance)
    const steps = []
    for (let i = 0; i <= B.steps; i++) steps.push(i / B.steps)
    // forEach, so each scheduled step keeps its own t
    steps.forEach(t => later(server, t * B.seconds * 20, () => {
      const p = { x: from.x + (to.x - from.x) * t, y: from.y + 0.5 + (to.y - from.y - 0.5) * t + Math.sin(t * 3.14159) * B.rise, z: from.z + (to.z - from.z) * t }
      particleAt(server, 'minecraft:dust ' + B.color + ' ' + B.size, p, '0.3 0.3 0.3', 0, 15)
    }))
  },
  explosion: server => {
    const E = FINALE_EXPLOSION, fr = S.fin.frame, c = fr.center
    fr.corners.concat([c]).forEach(p => particleAt(server, 'minecraft:explosion_emitter', p, '0 0 0', 0, 1))
    E.particles.forEach(id => particleAt(server, id, c, '1.5 2 1.5', 0.05, 60))
    E.sounds.forEach(id => soundAround(server, c, id, E.soundRadius, 1, 1))
    lightningBurst(server, FINALE_LIGHTNING.explosion)
    // Portal blocks first (a changed frame would break them anyway), then the frame. Nothing else changes.
    fr.cells.filter(p => p.kind == 'portal').forEach(p => runOW(server, 'setblock ' + p.x + ' ' + p.y + ' ' + p.z + ' minecraft:air'))
    fr.cells.filter(p => p.kind == 'frame').forEach(p => runOW(server, 'setblock ' + p.x + ' ' + p.y + ' ' + p.z + ' minecraft:crying_obsidian'))
    // A gentle push away from the portal. No damage.
    onlinePlayers(server).forEach(p => {
      if (dimOf(p) != OVERWORLD) return
      let dx = c.x - ex(p), dz = c.z - ez(p)
      if (Math.sqrt(dx * dx + (c.y - ey(p)) * (c.y - ey(p)) + dz * dz) > E.knockbackRadius) return
      if (Math.abs(dx) + Math.abs(dz) < 0.01) { dx = Math.random() - 0.5; dz = Math.random() - 0.5 }
      try {
        p.knockback(E.knockbackStrength, dx, dz)
        p.hurtMarked = true   // sends the new motion to the player's game
      } catch (e) {
        console.warn('[PigEscort] Explosion push failed for ' + nameOf(p) + ': ' + e)
      }
    })
  },
  reveal: server => runSteps(server, REVEAL),
  reveal_title: server => {
    titleAll(server, FINALE_REVEAL_TITLE)
    sound(server, '@a', FINALE_REVEAL_TITLE.sound, 1, 1)
  },
  leader: server => leaderStep(server),
  leader_arrival: server => {
    const L = FINALE_LEADER, c = S.fin.frame.center
    L.sounds.forEach(id => sound(server, '@a', id, 1, 1))
    lightningBurst(server, FINALE_LIGHTNING.arrival)
    const half = L.columnHeight / 2
    ;[0, 10, 20, 30].forEach(t => later(server, t, () =>
      particleAt(server, 'minecraft:dust ' + L.columnColor + ' 2', { x: c.x, y: S.fin.frame.bottom + half, z: c.z }, '0.2 ' + half + ' 0.2', 0, 300)))
    titleAll(server, L)
  },
  unlock: server => {
    if (!UNLOCK_NETHER) return
    if (S.fin.test) tellOps(server, 'Test run: the Nether was NOT unlocked (/pigescort nether unlock does it by hand).')
    else setNetherUnlocked(server, true)
    say(server, VOICE_MINISTRY, FINALE_UNLOCK_MESSAGE, false)
  },
  end: server => finishFinale(server),
}

// The Nether portal whitelist switch (read by startup_scripts/nether_portal_whitelist.js). Saved with the
// world, so it survives restarts.
function setNetherUnlocked(server, on) {
  server.persistentData.putBoolean(NETHER_UNLOCK_KEY, on)
  global.netherPortalsUnlocked = on
  console.info('[PigEscort] Nether portals ' + (on ? 'unlocked' : 'locked'))
}
function netherUnlocked(server) {
  try { return !!server.persistentData.getBoolean(NETHER_UNLOCK_KEY) } catch (e) { return global.netherPortalsUnlocked === true }
}

// /pigescort finale test success|fail
function finaleTest(ctx, kind) {
  const server = ctx.source.server
  if (S.phase != 'idle' && S.phase != 'staged') { reply(ctx, 'Not while the event is ' + S.phase + '. /pigescort stop first.'); return 0 }
  if (global.trollcraftEventActive) { reply(ctx, 'Another event is active.'); return 0 }
  let frame = cornerFrame()
  if (frame && frame.error) { reply(ctx, frame.error); return 0 }
  // A test during a setup leaves the setup as it was.
  const keepSetup = S.phase == 'staged' ? S.setup : null
  const usesSite = !frame
  if (!frame) {
    let site = S.phase == 'staged' ? S.setup.portal : null
    if (!site) {
      reply(ctx, 'No frame to test with. Either set PORTAL_FRAME_FROM / PORTAL_FRAME_TO at the top of pig_escort.js (and /reload), or run /pigescort setup and /pigescort setportal (or setportal random) first.')
      return 0
    }
    let problem = checkPortalSite(server, site, false)
    if (problem) { reply(ctx, 'The portal site can\'t be used: ' + problem + '.'); return 0 }
    // Build the event portal like a real run, remembering the land so the cleanup puts it back.
    let level = overworldOf(server)
    S.snap = { site: site, blocks: portalLayout(site).map(p => snapshotCell(level, p)), forced: [], participants: [], prevTeams: {}, keepInv: null }
    saveSnapshot(server)
    buildPortal(server, site, false)
    frame = siteFrame(site)
  }
  const me = ctx.source.getPlayer()
  startFinale(server, { kind: kind, test: true, frame: frame, from: frontOf(frame, 15), keepSetup: keepSetup, testBy: me ? nameOf(me) : null })
  const c = frame.center
  reply(ctx, 'Test finale (' + (kind == 'success' ? 'Ending A' : 'Ending B') + ') started at ' + Math.floor(c.x) + ' ' + Math.floor(c.y) + ' ' + Math.floor(c.z) +
    '. Everyone online sees and hears it. No rewards, and the Nether is not unlocked. /pigescort stop ends it.' +
    (usesSite ? ' The land at the portal site is put back afterwards.' : ' The frame stays crying obsidian: /pigescort finale restoreframe rebuilds it.'))
  return 1
}

// /pigescort finale restoreframe
function restoreFrame(ctx) {
  const server = ctx.source.server
  if (S.phase == 'running' || S.phase == 'countdown' || S.phase == 'finale') { reply(ctx, 'Not while the event is ' + S.phase + '.'); return 0 }
  const frame = cornerFrame()
  if (!frame) { reply(ctx, 'Set PORTAL_FRAME_FROM / PORTAL_FRAME_TO first. (Tests at the /pigescort setportal spot put the land back by themselves.)'); return 0 }
  if (frame.error) { reply(ctx, frame.error); return 0 }
  frame.cells.filter(p => p.kind == 'frame').forEach(p => runOW(server, 'setblock ' + p.x + ' ' + p.y + ' ' + p.z + ' minecraft:obsidian'))
  const portal = frame.cells.filter(p => p.kind == 'portal')
  const lo = k => Math.min.apply(null, portal.map(p => p[k])), hi = k => Math.max.apply(null, portal.map(p => p[k]))
  runOW(server, 'fill ' + lo('x') + ' ' + lo('y') + ' ' + lo('z') + ' ' + hi('x') + ' ' + hi('y') + ' ' + hi('z') + ' minecraft:nether_portal[axis=' + frame.axis + ']')
  reply(ctx, 'Frame rebuilt and relit.')
  return 1
}

// /pigescort reveal continue
function revealContinue(ctx) {
  const F = S.fin
  if (S.phase != 'finale' || !F) { reply(ctx, 'No finale is running.'); return 0 }
  if (F.leaderAt == null) { reply(ctx, 'The finale hasn\'t reached the leader yet.'); return 0 }
  if (F.afterLeader) { reply(ctx, 'Already continuing.'); return 0 }
  afterLeader(ctx.source.server)
  reply(ctx, 'Continuing the finale.')
  return 1
}


// ===================== HOOKS (called from the startup script) =====================

const hooks = {
  running: false,

  // Something is about to change dimension.
  onTravel: event => {
    count('travel')
    if (S.phase == 'finale') { finaleTravel(event); return }
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
  if (S.phase == 'finale') {
    // The celebration fireworks never hurt anyone.
    if (event.entity.isPlayer() && damageTypeOf(event.source) == 'fireworks') event.cancel()   // last: cancel() stops this function
    return
  }
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
      try { R.pigDeathPos = { x: ex(e), y: ey(e), z: ez(e) } } catch (err) { }
      let token = S.token
      server.scheduleInTicks(1, () => { if (token == S.token) endEvent(server, 'pig_died') })
    } else {
      // Anything else that somehow killed it is overruled.
      e.setHealth(Math.max(1, R.lastValid ? R.lastValid.health : PIG_MAX_HEALTH))
      announce(server, 'The Ambassador\'s death has been ruled unlawful and is therefore cancelled.', 'red')
      event.cancel()   // last: cancel() stops this function
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
  if (event.player) tell(Utils.server, nameOf(event.player), 'The Ministry-Approved Portal is protected property.', 'red')
  event.cancel()
})

BlockEvents.placed(event => {
  if (S.phase != 'running') return
  const b = event.block
  if (String(b.getDimension()) != OVERWORLD || !S.run.footprint[key(b.x, b.y, b.z)]) return
  if (event.player) tell(Utils.server, nameOf(event.player), 'Construction within the Ministry-Approved Portal zone requires a permit. You do not have one.', 'red')
  event.cancel()
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
  if (S.phase == 'finale' && S.fin) {
    let F = S.fin
    reply(ctx, 'Finale: ' + (F.kind == 'success' ? 'Ending A (delivered)' : 'Ending B (lost)') + (F.test ? ', TEST run' : '') +
      ' | running for ' + clock(Math.floor((server.tickCount - F.startTick) / 20)) +
      ' | leader: ' + (F.leaderAt == null ? 'not yet' : (F.afterLeader ? 'joined, last part running' : 'joined, waiting (/pigescort reveal continue)')))
    return 1
  }
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
    (R.diff.growBy ? ' | Waves so far: ' + (R.waveCount || 0) + ' (next: ' + waveSize(R) + ' mobs)' : '') +
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
  // WalkTarget has no constant to read, so this only checks that the class loads (calling toString() on the
  // class itself is refused by the script engine, which made this probe always fail).
  probe('WalkTarget (raiders walking back to the pig)', () => { if (!Java.loadClass('net.minecraft.world.entity.ai.memory.WalkTarget')) throw new Error('class not found') })
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
        if (S.phase == 'finale') {
          stopFinale(ctx.source.server)
          reply(ctx, 'Finale stopped and cleaned up.')
          return 1
        }
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
        maybeSpawnWave(ctx.source.server, true)
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
      .then(Commands.literal('finale')
        .then(Commands.literal('test')
          .then(Commands.literal('success').executes(safe(ctx => finaleTest(ctx, 'success'))))
          .then(Commands.literal('fail').executes(safe(ctx => finaleTest(ctx, 'fail')))))
        .then(Commands.literal('restoreframe').executes(safe(ctx => restoreFrame(ctx)))))
      .then(Commands.literal('reveal')
        .then(Commands.literal('continue').executes(safe(ctx => revealContinue(ctx)))))
      .then(Commands.literal('track')
        .then(Commands.literal('test').executes(safe(ctx => trackTest(ctx)))))
      .then(Commands.literal('nether')
        .then(Commands.literal('lock').executes(safe(ctx => {
          setNetherUnlocked(ctx.source.server, false)
          reply(ctx, 'Nether portals are limited to nether_portal_whitelist.js again.')
          return 1
        })))
        .then(Commands.literal('unlock').executes(safe(ctx => {
          setNetherUnlocked(ctx.source.server, true)
          reply(ctx, 'Nether portals can be lit anywhere (nether_portal_whitelist.js is switched off).')
          return 1
        })))
        .then(Commands.literal('status').executes(safe(ctx => {
          reply(ctx, netherUnlocked(ctx.source.server) ? 'Unlocked: Nether portals can be lit anywhere.' : 'Locked: only the portals allowed in nether_portal_whitelist.js can be lit (if it is installed).')
          return 1
        }))))
  )
})

})()
