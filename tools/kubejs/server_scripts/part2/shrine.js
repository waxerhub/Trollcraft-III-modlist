// priority: 100
// (Loads before the other scripts, so a knockout at the Shrine is cancelled before any of their death handlers see it:
// a knockout is no kill for bounties, Souls, Grit and the rest. The Gladiator Arena does the same.)
// The Shrine Awakens (Part II, Act I #36): one big evening, run live by ops, in which the Blood God names the Regalia of
// the Blade and Technoblade's Shrine rises out of the ground at the very end (see tools/kubejs/SHRINE.md).
//
// The night, in order (owner decision 2026-11-19: the Shrine is the climax):
//   0-1. /shrine signal (the day before) and /shrine summons (the Blood God's book, with the three fires).
//   2. /shrine braziers: everyone to the start, the night's kit, the event on (knockouts instead of deaths). Three
//      braziers that must all burn within 60 seconds, ambushes on the way; then a red beacon beam over the site.
//   4. The Ignition Rite, around the beam: it begins by itself once every pilgrim has gathered there (or /shrine rite).
//      Waves of Inspectors until the offering is full, each led by a Senior Inspector, the only one carrying the Potato
//      King's Potatoes, which are offered into the beam's red glass; each quarter, the beam surges.
//   5. The Awakening, at the beam: once the offering is full, the Inspectors vanish, everyone is brought back to watch
//      (held there), and it begins by itself: the tribute, the Blood God's words (with the works), the Regalia named,
//      the seals broken up to Tier 4 with no vote, the Pool raised to 230,000 Drops credited to nobody.
//   3. The rise, last: the Shrine builds itself layer by layer from kubejs/data/trollcraft/structures/shrine/l_0 ..
//      l_63, fire and lightning as it goes. When it stands it burns from its feet to its crown, the Regalia book lies on
//      its altar and the steps go up to it; then the night ends: the sky clears to day, everyone is let go, and their
//      belongings come back.
// The stages keep their old numbers (3 is the rise) so the docs and the commands still match.
// Also: the sites (/shrine site set, /shrine brazier set <1-3>, /shrine start set), /shrine status, /shrine stop,
// /shrine reset confirm (the test server), /regalia, the Shrine's guard and /shrine repair, and no monsters in it.
//
// Part II only. Copy to <server>/kubejs/server_scripts/part2/ and the layers to
// <server>/kubejs/data/trollcraft/structures/shrine/, then /reload.
// KubeJS 6 (Rhino): no template strings; `let` inside nested blocks; event.cancel() last.

(function () {

// ===================== SETTINGS =====================

const STRUCTURE = 'trollcraft:shrine'     // the statue, one piece per layer: STRUCTURE + '/l_' + n
const SIZE = [42, 64, 43]                 // x, layers, z (Technoblade's statue: technoblade_statue.schem)
const CENTRE = [21, 21]                   // the site's centre, as an offset from the statue's corner (x, z)
const PEDESTAL_TOP = 21                   // the pedestal's last layer: thunder when it's placed
const LAYER_TICKS = 9                     // a layer every 9 ticks: about 29 seconds for the 64 (owner, 2026-11-14)
const LOAD_WAIT_SECONDS = 90              // how long to wait for the site's chunks to load before pausing the rise
const CLEAR_SLAB = 18                     // taking it down: fills of 42 x 18 x 43 blocks (fill's limit is 32,768)
const EDGE_GAP = 3                        // players moved out of the footprint land this far outside its edge
const NEAR = 128                          // players this close to the Shrine hear about the rise
// No monsters spawn in the Shrine's box (from its base to above the head) or this many blocks around it, once any of it
// stands. Event mobs (tagged by this script, the ambushes, the Purge or the arena) and named ones an op summons can.
const SPAWN_MARGIN = 2
const KEEP_TAGS = /shrine|portal_ambush|gladiator|purge/
const BRAZIERS = 3
const DATA_KEY = 'shrine'

// --- Stage 2: the braziers, the beam and the ambushes ---
const FIRE_WINDOW_SECONDS = 60            // all three must burn within this long of the first one catching
// The night's event (owner, 2026-11-15, after a death to an ambush on the test server): /shrine braziers starts it and
// teleports every player online to the start (/shrine start set). From then until the Awakening ends, a lethal hit
// knocks anyone out instead of killing them: they wake beside the last brazier lit that still burns, or at the start if
// none does (at the Shrine's edge if they're near it during the rite, as before).
const WAKE_BESIDE_FIRE = 3                // knocked out: woken this many blocks east of the brazier, on the ground
const FIRE_BOSSBAR = 'trollcraft:shrine_fires'
// A brazier, built on the ground at its site: a 3 x 3 plinth, the campfire on it in the middle, walls with chains at the
// corners. [dx, dy, dz, block] from the site (the spot an op stood on).
const BRAZIER_PARTS = [
  [-1, 0, -1, 'minecraft:polished_blackstone_bricks'], [0, 0, -1, 'minecraft:polished_blackstone_bricks'], [1, 0, -1, 'minecraft:polished_blackstone_bricks'],
  [-1, 0, 0, 'minecraft:polished_blackstone_bricks'], [0, 0, 0, 'minecraft:polished_blackstone_bricks'], [1, 0, 0, 'minecraft:polished_blackstone_bricks'],
  [-1, 0, 1, 'minecraft:polished_blackstone_bricks'], [0, 0, 1, 'minecraft:polished_blackstone_bricks'], [1, 0, 1, 'minecraft:polished_blackstone_bricks'],
  [0, 1, 0, 'minecraft:campfire[lit=false,signal_fire=false]'],
  [-1, 1, -1, 'minecraft:polished_blackstone_wall'], [1, 1, -1, 'minecraft:polished_blackstone_wall'],
  [-1, 1, 1, 'minecraft:polished_blackstone_wall'], [1, 1, 1, 'minecraft:polished_blackstone_wall'],
  [-1, 2, -1, 'minecraft:chain[axis=y]'], [1, 2, -1, 'minecraft:chain[axis=y]'], [-1, 2, 1, 'minecraft:chain[axis=y]'], [1, 2, 1, 'minecraft:chain[axis=y]'],
]
// The beam: a beacon under the Shrine site's centre, on a 3 x 3 of iron, with red glass in the ground above it. What
// those blocks replace is kept and put back when the rise begins. [dx, dy, dz, block] from the site.
const BEAM_PARTS = [
  [-1, -3, -1, 'minecraft:iron_block'], [0, -3, -1, 'minecraft:iron_block'], [1, -3, -1, 'minecraft:iron_block'],
  [-1, -3, 0, 'minecraft:iron_block'], [0, -3, 0, 'minecraft:iron_block'], [1, -3, 0, 'minecraft:iron_block'],
  [-1, -3, 1, 'minecraft:iron_block'], [0, -3, 1, 'minecraft:iron_block'], [1, -3, 1, 'minecraft:iron_block'],
  [0, -2, 0, 'minecraft:beacon'], [0, -1, 0, 'minecraft:red_stained_glass'],
]
const SKY_CHECK = 96                      // blocks above the site checked for anything that would stop the beam
// The ambushes on the way: the first pilgrim within `radius` blocks of a brazier that isn't lit yet is ambushed once,
// with anyone within `team` blocks of them: base + 1 per pilgrim Inspectors (at most max), ring blocks away.
const AMBUSH = { radius: 200, team: 32, base: 2, max: 6, ring: [8, 12] }
// The Inspectors (unsigned: never "Ministry"). armour protects them, though illagers don't show it.
const INSPECTOR = { name: 'Inspector', color: 'gold', armour: 'iron', voice: 'Unregistered pilgrims. Remain where you are.' }

// --- Stage 4: the Ignition Rite ---
const POTATOES_PER_PLAYER = 8             // the altar needs this many Potato King's Potatoes per player present
// The waves (owner decisions at the rehearsal, 2026-11-19): they keep coming until the altar is full, and every one is
// led by a Senior Inspector, the only one who carries the Potato King's Potatoes (SENIOR.potatoes; the ordinary
// Inspectors drop nothing). per = ordinary Inspectors per player present (at least min, at most WAVE_MAX), their
// armour, and shields on the vindicators. Wave n uses WAVES[n], and every wave after the list uses its last entry.
const WAVES = [
  { per: 1, min: 3, armour: 'iron' },
  { per: 1.5, min: 3, armour: 'iron', shields: true },
  { per: 1, min: 3, armour: 'diamond' },
  { per: 1.5, min: 3, armour: 'diamond', shields: true },
]
const WAVE_MAX = 12
const RITE_ALIVE_MAX = 30                 // the next wave waits while this many of the rite's Inspectors are still up
const WAVE_RING = [30, 45]                // they appear this many blocks from the Shrine's centre, on the ground
const SURFACE_SCAN = [40, 20]             // Inspectors' ground: looked for from 40 above the site's height to 20 below
const SPAWN_TRIES = 12                    // spots tried for each Inspector (not in water, a cave or a tree) before falling back
const NEXT_WAVE = { share: 0.75, minutes: 3 }   // the next wave: once this share of the last is down, or after this long
// One leads every wave. potatoes: what he drops (a fixed 8, owner decision); helpers: called at half health, once.
const SENIOR = { name: 'Senior Inspector', health: 150, potatoes: 8, helpers: 2 }
const KINGS_POTATO = { name: 'Potato King\'s Potato', lore: 'Technoblade\'s own. Hoarded by the Inspectors.' }
const BANDS = 4                           // the statue lights up in this many bands, one per quarter of the bar
const LIGHT_SPACING = 4                   // in a lit band, a light block every this many blocks (where there's air)
const KNOCKOUT_RESISTANCE_SECONDS = 3     // after a knockout at the Shrine
const RITE_BOSSBAR = 'trollcraft:shrine_rite', SENIOR_BOSSBAR = 'trollcraft:shrine_senior'   // each Senior's bar: SENIOR_BOSSBAR_<wave>

// --- Stage 5: the Awakening ---
// The altar: the lectern in the statue (Shrine-local offset from the corner, as in technoblade_statue.schem), with
// Technoblade's head on top. It's left empty when the Shrine rises; the Regalia book appears there at the Awakening, and
// a copy taken from it is put back (checked every LECTERN_CHECK_TICKS).
const ALTAR = { lectern: [28, 22, 20], facing: 'east' }
// The steps up to the altar (owner, 2026-11-14, after the test rite: the pedestal is 22 blocks high, nobody in survival
// could reach the lectern, and the Shrine won't let them build up to it). Barriers, solid and invisible, laid when the
// rise ends: a flight 3 wide (statue z 19..21, the lectern's row) from the platform's edge east of the lectern (statue
// x 38, level with layer 21), one block out and one down per step toward the rising sun, until a step is all ground
// (at most `below` under the base). They fill air only, so the build and the land are never cut into. Faint red dust
// marks them every glowTicks while anyone is within glowRadius. Monsters can't spawn on barriers.
const STAIRS = { top: [38, 21], z: [19, 21], below: 12, glowTicks: 20, glowRadius: 48 }
const LECTERN_CHECK_TICKS = 100
const PRESENT_RADIUS = 64                 // players this close to the Shrine count as present
// Stage 0, the Signal (/shrine signal, the day before): a scrambled, unsigned message, sent to each player (never
// tellraw @a, so not to Discord: the owner posts the time there), and to anyone who joins within SIGNAL_HOURS.
// Parts: [scrambled, text]. A scrambled stretch shows as shifting glyphs, so only its length matters.
const SIGNAL_HOURS = 24
const SIGNAL = [
  [true, 'xq vrtno lam'], [false, ' ...the third seal... '], [true, 'kwtr pe d'], [false, ' ...three fires... '],
  [true, 'bnaxuoe'], [false, ' ...gather at the castle... '], [true, 'qe wvr'], [false, ' ...tomorrow, when the sun goes down... '],
  [true, 'mzrta'],
]
// Stage 1, the Summons (/shrine summons, at the castle): the book A Summons, signed by the Blood God, for everyone online;
// anyone who joins later gets it, until the Awakening. Each page is a list of paragraphs; 'BRAZIERS' is the page of
// the three fires, each with its direction and distance from the castle, worked out when the command runs.
const SUMMONS = {
  title: 'A Summons', author: 'The Blood God', braziers: 'Three fires wait in three far places:',
  pages: [
    ['BLOOD FOR THE BLOOD GOD.', 'You have bled for their seals. Two lie broken. The third still holds.'],
    ['Beneath this land sleeps something older than any seal: my Shrine.', 'It will not wake for one of you. It wakes for all of you, or for none.'],
    'BRAZIERS',
    ['Light them as one. A fire that burns alone will die within the minute.', 'When all three burn, I will show you where to stand.'],
    ['Bring your blades. They will come for what is mine.', 'Take back from them what they took from me.'],
    ['They want the Pool full.', 'So do I.'],
  ],
}
const JOIN_DELAY_TICKS = 100              // after a player joins, before the Signal or the Summons reaches them
// During the night's event, the Ignition Rite begins by itself this long after every pilgrim online has gathered at the
// beam (owner decisions, 2026-11-19). 0 = an op starts it with /shrine rite. Outside the event it never starts alone.
const AUTO_RITE_SECONDS = 8
// The Awakening's Pool (owner decisions, 2026-11-19): no vote. The Pool is raised to POOL_AFTER (a quarter of the way
// from Tier 4's threshold to Tier 5's: 230,000 Drops), and the Shrine breaks the seals up to OPEN_TIER itself (the
// Nether's with them). It never lowers the Pool or closes a tier. The Drops are the Blood God's own: credited to
// nobody, like an op's /bloodpool add (owner decision, 2026-11-19, at the rehearsal).
const POOL_AFTER = { past: 4, fraction: 0.25 }
const OPEN_TIER = 4
// The Awakening's steps, in ticks from /shrine awaken: the tribute first (/techno all takes about 25 seconds), then the
// Blood God's words, the book on the altar, the third seal, and the Pool.
const AWAKEN_STEPS = [
  { at: 0, step: 'begin' },
  { at: 560, step: 'line', text: 'You lit my fires. You fed my Shrine. You remembered.' },
  { at: 680, step: 'line', text: 'Eight things were mine. They were scattered, stolen, forgotten. Restore them here, and my name returns with them.' },
  { at: 760, step: 'book' },
  { at: 880, step: 'line', text: 'I break the third seal, and the fourth with it. Blood for the Blood God.', last: true },
  { at: 920, step: 'pool' },
  { at: 980, step: 'end' },                 // a moment for his last words ("BLOOD FOR THE BLOOD GOD.") before everyone is let go
]
const VOICE_BLOOD = { tag: '[BLOOD GOD]', tagColor: 'dark_red', textColor: 'red' }   // as part2/blood_pool.js has it
// The Regalia of the Blade: the eight relics, in the book's order. need and unit are placeholders until the owner sets
// them (STORY.md, Act II); the deliveries come with Act II.
const RELICS = [
  { id: 'war_chest', name: 'The War Chest', need: 10000, unit: 'potatoes', honours: 'For the Potato War, which I won.', asks: 'Fill it again: ten thousand potatoes.' },
  { id: 'axe_of_peace', name: 'The Axe of Peace', need: 1, unit: 'axe', honours: 'I carried it in peace. Mostly.', asks: 'Forge me its equal: a broad axe of manyullyn or hepatizon, made netherite.' },
  { id: 'totem_hoard', name: 'The Totem Hoard', need: 64, unit: 'Totems of Undying', honours: 'I never died. I simply declined to.', asks: 'Bring me sixty-four Totems of Undying.' },
  { id: 'withers_due', name: 'The Wither\'s Due', need: 8, unit: 'Nether Stars', honours: 'I once loosed withers on a nation that wronged me.', asks: 'Bring me eight Nether Stars.' },
  { id: 'chalice', name: 'The Chalice of Blood', need: 1000, unit: 'buckets of blood', honours: 'Blood for the Blood God. It was never a metaphor.', asks: 'Fill it: a thousand buckets of blood.' },
  { id: 'carls_bridle', name: 'Carl\'s Bridle', need: 1, unit: 'horse', honours: 'For Carl, the finest horse who ever lived.', asks: 'Breed me his equal: swift as wind, and a jump to clear any wall.' },
  { id: 'swines_oath', name: 'The Swine\'s Oath', need: 10, unit: 'Pig Escorts', honours: 'For the pig who wore the crown.', asks: 'See the pigs safely home, ten times over.' },
  { id: 'crown', name: 'The Crown of the Blade', need: 1, unit: 'crown', honours: 'My crown. They wore it. They used it.', asks: 'Last, and hardest: awakened draconium, a dragon\'s heart, a Gaia spirit and a shard of chaos.', after: 'When the Crown returns, so does my name.' },
]
const BOOK = { title: 'The Regalia of the Blade', author: 'The Blood God', intro: 'Eight things were mine. Restore them at my Shrine, and my name returns with them.' }

// --- The night's end, by itself (owner decision at the rehearsal, 2026-11-19) ---
// During the event, once the offering is full: the Inspectors vanish, everyone is brought back to the viewing spots
// (VIEW), facing the beam, and the Awakening begins this long after. They're held there while it plays and while the
// Shrine rises after it (put back if they wander more than HOLD_RADIUS blocks), and let go when the night ends.
const AUTO_AWAKEN_SECONDS = 10
const FINALE_TICKS = 100                  // from the Shrine standing (the night's last act) to the night's end
const GATHER_DELAY_TICKS = 60             // from the altar filling to everyone being brought to the steps
// The viewing spots: this far east of the furthest the steps can reach (about 55 blocks from the centre), 7 to a row,
// 2 apart, looking at the centre lookUp blocks above the ground.
const VIEW = { out: 4, row: 7, gap: 2, lookUp: 20 }
const HOLD_RADIUS = 2.5

// --- The night's kit (owner decisions at the rehearsal, 2026-11-19) ---
// From /shrine braziers until the Awakening ends, everyone in survival or adventure fights in this kit, all of it
// Unbreaking X, and their own belongings are held safe (every slot, worn curios, Tool Belt's belt slot), with a backup
// file in VAULT_DIR, and handed back when the Awakening ends (or at their next login). Anyone joining mid-event is
// kitted when they arrive. Kit items can't leave the event: outside it, any found on a player are taken back.
// items: [id, count, extra NBT]; armor: head .. feet; gear gets ENCHANT (the food doesn't).
const KIT = {
  items: [['minecraft:diamond_sword', 1, 'Enchantments:[{id:"minecraft:sharpness",lvl:4s},{id:"minecraft:unbreaking",lvl:10s}]'], ['minecraft:cooked_beef', 16, ''],
    ['minecraft:flint_and_steel', 1, 'Enchantments:[{id:"minecraft:unbreaking",lvl:10s}]']],   // to light the braziers (owner, 2026-11-19)
  armor: ['minecraft:diamond_helmet', 'minecraft:diamond_chestplate', 'minecraft:diamond_leggings', 'minecraft:diamond_boots'],
  offhand: 'minecraft:shield',
  enchant: 'Enchantments:[{id:"minecraft:unbreaking",lvl:10s}]',
  lore: 'Issued for the Shrine Awakens. Taken back at its end.',
}
// The backup files: here if that folder exists; KubeJS won't make it, so on the test server they went to
// kubejs/shrine_vault_<name>_<uuid>.json (the fallback), as the arena's and the Purge's do.
const VAULT_DIR = 'kubejs/shrine_vaults/'
const KIT_SWEEP_TICKS = 200               // outside the event, kit items are looked for on players this often

// --- Effects (owner decisions at the rehearsal, 2026-11-19: the fires and the beam, the rise, the rite, the Awakening) ---
// The rise turns the sky to night with a thunderstorm (the whole Overworld), and the Awakening's end clears it to day.
// Lightning here is only for show: a bolt that can't burn or hurt (with flashes and thunder in its place if the game
// won't make one).
const SKY = { night: 'time set midnight', storm: 'weather thunder 72000', clear: 'weather clear', day: 'time set day' }
const TITLE_TIMES = 'times 10 60 20'
const LINE_TICKS = 40                     // the Blood God's words on screen: one sentence every 2 seconds
// While the Blood God speaks (owner, 2026-11-19: "Fire particles, lightning, heart beats. The works"): a heartbeat
// everyone hears (every `beat` ticks, `lastBeat` on his last line), a growl as each line begins, a blood mist with each
// beat, and with each sentence fire up the statue, lava and soul fire from the head, flame at the watchers' feet, and
// `bolts` bolts for show in a ring `ring` blocks out (beyond the seals' ring, 26).
const SPEAK = { beat: 20, lastBeat: 10, bolts: 2, ring: 34 }

// ===================== STATE =====================

let Serializer = null, ResourceLocation = null, ItemStackClass = null, CuriosApi = null, BeltSlot = null
try { Serializer = Java.loadClass('net.minecraft.network.chat.Component$Serializer') } catch (e) { }
try { ResourceLocation = Java.loadClass('net.minecraft.resources.ResourceLocation') } catch (e) { }
try { ItemStackClass = Java.loadClass('net.minecraft.world.item.ItemStack') } catch (e) { }
try { CuriosApi = Java.loadClass('top.theillusivec4.curios.api.CuriosApi') } catch (e) { }
try { BeltSlot = Java.loadClass('dev.gigaherz.toolbelt.slot.BeltExtensionSlot') } catch (e) { }
let data = null
// D.site: the Shrine's centre at ground level { dim, x, y, z }. D.braziers: [site or null] x 3. D.rise: { state:
// 'none' | 'rising' | 'stopped' | 'risen', next: the next layer to place, site: where it's rising }.
// D.fires: { state: 'none' | 'placed' | 'counting' | 'lit' | 'done', sites: the braziers as built, built, lit and
// ambushed: [bool] x 3, firstLitAt: ms }. D.beam: { up, at: the site, saved: [{ x, y, z, state }] it replaced }.
// The loops' tokens are on global, so a /reload stops the old ones.
function freshFires() { return { state: 'none', sites: [], built: [false, false, false], lit: [false, false, false], litAt: [0, 0, 0], ambushed: [false, false, false], firstLitAt: 0 } }
// D.rite: { state: 'none' | 'running' | 'paused' | 'full' | 'done', offered: uuid -> { name, n } (potatoes offered at the
// altar), total, need, present (players counted at the start), wave (the last one sent, -1 none), waveAt, waveSize,
// lit (bands lit), seniors: wave -> { called } for each wave whose Senior Inspector is up (his bar shows) }.
function freshRite(offered) {
  return { state: 'none', offered: offered || {}, total: 0, need: 0, present: 0, wave: -1, waveAt: 0, waveSize: 0, lit: 0, seniors: {} }
}
function db() {
  if (data) return data
  data = { site: null, braziers: [null, null, null], rise: { state: 'none', next: 0, site: null } }
  let raw = ''
  try { raw = String(Utils.server.persistentData.getString(DATA_KEY) || '') } catch (e) { }
  if (raw) {
    try {
      let d = JSON.parse(raw)
      if (d && d.rise && d.braziers) data = d
    } catch (e) {
      console.error('[Shrine] Saved data could not be read; a copy is kept')
      try { Utils.server.persistentData.putString(DATA_KEY + '_unreadable_' + Date.now(), raw) } catch (e2) { }
    }
  }
  if (!data.fires) data.fires = freshFires()
  if (!data.beam) data.beam = { up: false, at: null, saved: [] }
  if (!data.awake) data.awake = { state: 'none', step: 0, added: 0, spots: {} }   // state: none, running or done; added: the Drops it put in
  if (!data.regalia) data.regalia = { open: false, progress: {} }          // progress: relic id -> { have, by: { uuid: { name, n } } }
  if (!data.rite || !data.rite.state) data.rite = freshRite((data.rite && data.rite.offered) || {})
  if (!data.rite.seniors) data.rite.seniors = {}                           // saved before every wave had a Senior
  if (!data.vaults) data.vaults = {}                                       // uuid -> a player's belongings held for the night
  if (!data.kitOut) data.kitOut = false                                    // a kit was ever handed out (the sweep looks for strays)
  if (!data.awake.spots) data.awake.spots = {}                             // uuid -> { x, y, z } where they watch the Awakening
  if (!(data.stairs >= 0)) data.stairs = 0                                 // the steps to the altar laid (0: none)
  if (data.start === undefined) data.start = null                          // the start: { dim, x, y, z }
  if (!data.event) data.event = { on: false, at: 0 }                       // the night's event: knockouts for everyone
  if (!data.signal) data.signal = { at: 0, told: {} }                      // the Signal: when, and who has had it
  if (!data.summons) data.summons = { at: 0, pages: [], given: {} }        // the Summons: when, its pages, who has a copy
  return data
}
function save() {
  try { Utils.server.persistentData.putString(DATA_KEY, JSON.stringify(db())); return true } catch (e) {
    console.error('[Shrine] Save failed: ' + e)
    return false
  }
}

// ===================== HELPERS =====================

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
function levelOfEntity(e) { const l = e.level; return typeof l == 'function' ? e.level() : l }
function dimKey(lv) {
  let d = lv.dimension
  if (typeof d == 'function') d = lv.dimension()
  if (d != null && typeof d.location == 'function') d = d.location()
  return String(d)
}
function dimOf(e) { return dimKey(levelOfEntity(e)) }
function pos(e) {
  try { return { x: Number(e.getX()), y: Number(e.getY()), z: Number(e.getZ()) } } catch (err) { }
  return { x: Number(e.x), y: Number(e.y), z: Number(e.z) }
}
function list(javaList) { const out = []; for (let i = 0; i < javaList.size(); i++) out.push(javaList.get(i)); return out }
function players(server) { return list(server.players) }
function run(server, c) { try { return server.runCommandSilent(c) } catch (e) { console.warn('[Shrine] ' + c + ': ' + e); return 0 } }
// Narration: grey italic, to each player (never tellraw @a, which Simple Discord Link relays).
function narrate(p, text, color) { try { p.tell(comp([{ text: text, color: color || 'gray', italic: true }])) } catch (e) { } }
function levelByDim(server, dim) {
  try {
    let it = server.getAllLevels().iterator()
    while (it.hasNext()) {
      let lv = it.next()
      if (dimKey(lv) == dim) return lv
    }
  } catch (e) { }
  try { if (dim == 'minecraft:overworld') return server.overworld() } catch (e) { }
  return null
}
function siteText(st) { return st ? st.x + ' ' + st.y + ' ' + st.z + (st.dim == 'minecraft:overworld' ? '' : ' (' + st.dim + ')') : 'not set' }
function snbtString(s) { return "'" + String(s).replace(/\\/g, '\\\\').replace(/'/g, "\\'") + "'" }
// Block state as text /setblock accepts, e.g. minecraft:oak_stairs[facing=east,half=bottom] (as in pig_escort.js).
function stateString(block) {
  const s = String(block.blockState.toString())
  const m = s.match(/^Block\{([^}]+)\}(\[.*\])?$/)
  return m ? m[1] + (m[2] || '') : String(block.id)
}
function clock(seconds) {
  seconds = Math.max(0, Math.ceil(seconds))
  return Math.floor(seconds / 60) + ':' + (seconds % 60 < 10 ? '0' : '') + (seconds % 60)
}
function flat(a, b) { const dx = a.x - b.x, dz = a.z - b.z; return Math.sqrt(dx * dx + dz * dz) }
function fmt(n) { return String(Math.floor(Number(n) || 0)).replace(/\B(?=(\d{3})+(?!\d))/g, ',') }
// Everyone online gets the line (player.tell each, never tellraw @a).
function narrateAll(server, text, color) { players(server).forEach(p => narrate(p, text, color)) }
function opsOnline(server) { return players(server).filter(p => { try { return !!p.hasPermissions(2) } catch (e) { return false } }) }

// --- Effects (sent per player or played in the world: never through chat) ---
// A title on each of `who`'s screens: title text (may be ''), subtitle (optional).
function titleTo(server, who, title, subtitle) {
  who.forEach(p => {
    const n = nameOf(p)
    run(server, 'title ' + n + ' ' + TITLE_TIMES)
    if (subtitle) run(server, 'title ' + n + ' subtitle ' + JSON.stringify(subtitle))
    run(server, 'title ' + n + ' title ' + JSON.stringify(title || ''))
  })
}
// A sound each of `who` hears where they stand.
function hearAll(server, who, sound, vol, pitch) {
  who.forEach(p => run(server, 'execute as ' + nameOf(p) + ' at @s run playsound ' + sound + ' master @s ~ ~ ~ ' + vol + ' ' + pitch))
}
// Lightning for show: a bolt that can't burn or hurt. If the game won't make one, a flash, sparks and thunder instead
// (never a real bolt: it would set fires and hurt the players nearby).
function strike(server, dim, x, y, z) {
  try {
    let bolt = levelByDim(server, dim).createEntity('minecraft:lightning_bolt')
    bolt.setVisualOnly(true)
    bolt.moveTo(x, y, z)
    bolt.spawn()
    return true
  } catch (e) { }
  run(server, 'execute in ' + dim + ' run particle minecraft:flash ' + x + ' ' + (y + 1) + ' ' + z + ' 0 0 0 0 1 force')
  run(server, 'execute in ' + dim + ' run particle minecraft:electric_spark ' + x + ' ' + (y + 8) + ' ' + z + ' 0.2 8 0.2 0.1 200 force')
  run(server, 'execute in ' + dim + ' run playsound minecraft:entity.lightning_bolt.thunder weather @a ' + x + ' ' + y + ' ' + z + ' 8 1')
  return false
}
// Strikes in a ring of `n` around a point, each on the ground there.
function strikeRing(server, dim, cx, cz, around, r, n) {
  const lv = levelByDim(server, dim)
  for (let k = 0; k < n; k++) {
    let a = k * 2 * 3.14159265 / n, x = Math.floor(cx + Math.cos(a) * r), z = Math.floor(cz + Math.sin(a) * r)
    strike(server, dim, x + 0.5, standY(lv, x, z, around), z + 0.5)
  }
}
// Red fireworks bursting high over the Shrine, well above anyone standing near it.
function redFireworks(server, st, n) {
  const m = centreOf(st), y = st.y + SIZE[1] + 2
  for (let k = 0; k < n; k++) {
    let x = m.x + (k % 3 - 1) * 6, z = m.z + (Math.floor(k / 3) % 3 - 1) * 6
    run(server, 'execute in ' + st.dim + ' run summon minecraft:firework_rocket ' + x + ' ' + y + ' ' + z +
      ' {LifeTime:' + (20 + k * 4) + ',FireworksItem:{id:"minecraft:firework_rocket",Count:1b,tag:{Fireworks:{Flight:2b,Explosions:[{Type:1b,Flicker:1b,Trail:1b,Colors:[I;16711680,11141120],FadeColors:[I;4456448]}]}}}}')
  }
}
// Soul fire rising at the four corners of the Shrine.
function soulColumns(server, st) {
  const c = corner(st)
  ;[[0, 0], [SIZE[0] - 1, 0], [0, SIZE[2] - 1], [SIZE[0] - 1, SIZE[2] - 1]].forEach(k => {
    let x = c.x + k[0] + 0.5, z = c.z + k[1] + 0.5
    run(server, 'execute in ' + st.dim + ' run particle minecraft:soul_fire_flame ' + x + ' ' + (c.y + 16) + ' ' + z + ' 0.3 16 0.3 0.01 300 force')
  })
}
// The sky for the night (during the event only: it's the whole Overworld's): night and a storm, then day.
function skyNight(server) {
  if (!eventOn() || db().event.sky) return
  db().event.sky = true
  save()
  run(server, SKY.night)
  run(server, SKY.storm)
}
function skyClear(server) {
  if (!db().event.sky) return
  db().event.sky = false
  save()
  run(server, SKY.clear)
  run(server, SKY.day)
}
// Players who can be ambushed or count as pilgrims: alive, in survival or adventure.
function pilgrim(p) {
  try { if (p.isCreative() || p.isSpectator()) return false } catch (e) { }
  try { return p.isAlive() } catch (e) { return true }
}
// Force-loads the chunks over x0..x1, z0..z1, runs fn(lv) once they're loaded, then lets them go. fn isn't run if they
// don't load within LOAD_WAIT_SECONDS.
function withChunks(server, dim, x0, z0, x1, z1, fn) {
  const lv = levelByDim(server, dim)
  if (!lv) return
  run(server, 'execute in ' + dim + ' run forceload add ' + x0 + ' ' + z0 + ' ' + x1 + ' ' + z1)
  let waited = 0
  const ready = () => {
    for (let cx = Math.floor(x0 / 16); cx <= Math.floor(x1 / 16); cx++) {
      for (let cz = Math.floor(z0 / 16); cz <= Math.floor(z1 / 16); cz++) {
        let ok = false
        try { ok = !!lv.hasChunk(cx, cz) } catch (e) { }
        if (!ok) return false
      }
    }
    return true
  }
  const step = () => {
    if (!ready()) {
      waited += 10
      if (waited > LOAD_WAIT_SECONDS * 20) {
        console.error('[Shrine] Chunks at ' + x0 + ' ' + z0 + ' did not load')
        run(server, 'execute in ' + dim + ' run forceload remove ' + x0 + ' ' + z0 + ' ' + x1 + ' ' + z1)
        return
      }
      server.scheduleInTicks(10, step)
      return
    }
    try { fn(lv) } catch (e) { console.error('[Shrine] ' + e) }
    run(server, 'execute in ' + dim + ' run forceload remove ' + x0 + ' ' + z0 + ' ' + x1 + ' ' + z1)
  }
  step()
}
function ordinal(n) { return ['the first', 'the second', 'the third'][n] || '#' + (n + 1) }

// The castle is world spawn. Directions as the Summons gives them: east is toward the rising sun, west toward the
// setting sun. Distances to the nearest 50 blocks.
function castle(server) {
  try { let sp = server.overworld().getSharedSpawnPos(); return { x: Number(sp.getX()), z: Number(sp.getZ()) } } catch (e) { return { x: 0, z: 0 } }
}
function directionText(dx, dz) {
  const a = Math.atan2(dx, -dz) * 180 / 3.14159265       // 0 = north (-z), 90 = east (+x)
  const i = Math.round(((a % 360) + 360) % 360 / 45) % 8
  return ['north', 'north-east', 'toward the rising sun', 'south-east', 'south', 'south-west', 'toward the setting sun', 'north-west'][i]
}
function distanceText(d) { return 'about ' + Math.max(50, Math.round(d / 50) * 50) + ' blocks' }
function fromCastle(server, st) {
  const c = castle(server), dx = st.x + 0.5 - c.x, dz = st.z + 0.5 - c.z
  return distanceText(Math.sqrt(dx * dx + dz * dz)) + ' ' + directionText(dx, dz)
}

// ===================== THE SHRINE'S BOX =====================

function corner(st) { return { dim: st.dim, x: st.x - CENTRE[0], y: st.y, z: st.z - CENTRE[1] } }
function centreOf(st) { return { x: st.x + 0.5, y: st.y, z: st.z + 0.5 } }
// Where the night is held: where the Shrine stands or rises, or, before it rises (the rite and the Awakening are at the
// beam, over its site), the site.
function siteNow() { const D = db(); return D.rise.site || D.site }
function risen() { return db().rise.state == 'risen' }
function forceload(server, st, add) {
  const c = corner(st)
  run(server, 'execute in ' + st.dim + ' run forceload ' + (add ? 'add ' : 'remove ') + c.x + ' ' + c.z + ' ' + (c.x + SIZE[0] - 1) + ' ' + (c.z + SIZE[2] - 1))
}
function chunksReady(lv, c) {
  for (let cx = Math.floor(c.x / 16); cx <= Math.floor((c.x + SIZE[0] - 1) / 16); cx++) {
    for (let cz = Math.floor(c.z / 16); cz <= Math.floor((c.z + SIZE[2] - 1) / 16); cz++) {
      let loaded = false
      try { loaded = !!lv.hasChunk(cx, cz) } catch (e) { }
      if (!loaded) return false
    }
  }
  return true
}
// Whether the layers are installed (kubejs/data/trollcraft/structures/shrine/). Unknown counts as yes.
function layersInstalled(server) {
  try { return !!server.getStructureManager().get(new ResourceLocation(STRUCTURE + '/l_0')).isPresent() } catch (e) { return true }
}
// In the footprint, from just under the ground to above the head?
function inFootprint(st, d, q) {
  if (!st || d != st.dim) return false
  const c = corner(st)
  return q.x >= c.x && q.x < c.x + SIZE[0] && q.z >= c.z && q.z < c.z + SIZE[2] && q.y >= c.y - 1 && q.y < c.y + SIZE[1] + 2
}
function isOpen(id) { return /(^|:)(cave_|void_)?air$/.test(String(id)) }
function isStep(id) { return /(^|:)barrier$/.test(String(id)) }   // the steps up to the altar: not ground to land on
// Somewhere to stand in the column at x, z: the top of the ground near the site's height (two open blocks over a solid
// one). Falls back to the site's own height.
function standY(lv, x, z, around) {
  if (!lv) return around
  for (let y = around + 20; y >= around - 20; y--) {
    let below = '', feet = '', head = ''
    try { below = lv.getBlock(x, y - 1, z).id; feet = lv.getBlock(x, y, z).id; head = lv.getBlock(x, y + 1, z).id } catch (e) { return around }
    if (!isOpen(below) && !isStep(below) && isOpen(feet) && isOpen(head)) return y
  }
  return around
}
// Ground for an Inspector in the column at x, z: coming down from SURFACE_SCAN[0] above `around`, the first block that
// isn't air, through any leaves (onto the forest floor). Null where it's no good: the column starts inside a hill (the
// old way found a cave under it: an Inspector spawned underground on the test server), the ground is water or lava (one
// landed in a lake), a tree trunk or the Shrine's steps, or there's nothing within SURFACE_SCAN[1] below.
function groundAt(lv, x, z, around) {
  if (!lv) return null
  try {
    if (!isOpen(lv.getBlock(x, around + SURFACE_SCAN[0], z).id)) return null
    for (let y = around + SURFACE_SCAN[0]; y > around - SURFACE_SCAN[1]; y--) {
      let below = String(lv.getBlock(x, y - 1, z).id)
      if (isOpen(below) || /leaves$/.test(below)) continue
      if (/(^|:)(water|lava|bubble_column|barrier|light)$|_(log|stem|wood|hyphae)$/.test(below)) return null
      return y
    }
  } catch (e) { }
  return null
}
// A spot on the ground rMin..rMax blocks from (cx, cz), about angle a: SPAWN_TRIES spots are tried round it, then as many
// again anywhere on the ring (on the test server a lake filled the whole north side of the rite's ring, and with only
// the nearby tries an Inspector was put in it). Only then the first spot's standY as before, with a warning.
function groundSpot(lv, cx, cz, around, rMin, rMax, a) {
  let first = null
  for (let t = 0; t < SPAWN_TRIES * 2; t++) {
    let ang = t == 0 ? a : t < SPAWN_TRIES ? a + (Math.random() - 0.5) * 1.2 : Math.random() * 2 * 3.14159265
    let r = rMin + Math.random() * (rMax - rMin)
    let x = Math.floor(cx + Math.cos(ang) * r), z = Math.floor(cz + Math.sin(ang) * r)
    if (!first) first = { x: x, z: z }
    let y = groundAt(lv, x, z, around)
    if (y !== null) return { x: x + 0.5, y: y, z: z + 0.5 }
  }
  console.warn('[Shrine] No dry ground ' + rMin + ' to ' + rMax + ' blocks from ' + Math.floor(cx) + ' ' + Math.floor(cz) + '; one placed at ' + first.x + ' ' + first.z + ' anyway')
  return { x: first.x + 0.5, y: standY(lv, first.x, first.z, around), z: first.z + 0.5 }
}
// Moves a player out of the footprint to the nearest side, EDGE_GAP blocks out, onto the ground there.
function moveOut(server, lv, st, p) {
  const c = corner(st), q = pos(p)
  const gaps = [
    { d: q.x - c.x, x: c.x - EDGE_GAP, z: q.z },
    { d: c.x + SIZE[0] - q.x, x: c.x + SIZE[0] + EDGE_GAP, z: q.z },
    { d: q.z - c.z, x: q.x, z: c.z - EDGE_GAP },
    { d: c.z + SIZE[2] - q.z, x: q.x, z: c.z + SIZE[2] + EDGE_GAP },
  ]
  let best = gaps[0]
  gaps.forEach(g => { if (g.d < best.d) best = g })
  const bx = Math.floor(best.x), bz = Math.floor(best.z)
  const y = standY(lv, bx, bz, st.y)
  run(server, 'execute in ' + st.dim + ' run tp ' + nameOf(p) + ' ' + (bx + 0.5) + ' ' + y + ' ' + (bz + 0.5))
}
function clearFootprint(server, lv, st) {
  let n = 0
  players(server).forEach(p => {
    if (inFootprint(st, dimOf(p), pos(p))) { moveOut(server, lv, st, p); narrate(p, 'The ground lurches under your feet. Stand back.', 'dark_red'); n++ }
  })
  return n
}

// ===================== NO MONSTERS IN THE SHRINE =====================

// Where the Shrine's blocks are (rising, paused or risen), or null.
function shrineStanding() { const R = db().rise; return R.state != 'none' && R.site ? R.site : null }
// The box and SPAWN_MARGIN around it, from the base to just above the head.
function inShrineSpace(st, d, q) {
  if (!st || d != st.dim) return false
  const c = corner(st)
  return q.x >= c.x - SPAWN_MARGIN && q.x < c.x + SIZE[0] + SPAWN_MARGIN && q.z >= c.z - SPAWN_MARGIN && q.z < c.z + SIZE[2] + SPAWN_MARGIN &&
    q.y >= c.y - 1 && q.y < c.y + SIZE[1] + 2
}
// In KubeJS 6, entity.getType() is the id as text ("minecraft:zombie"), so the category comes from entityType; checked
// on the test server, where isMonster() also works.
function isMonster(e) {
  try { return String(e.entityType.getCategory()).toLowerCase().indexOf('monster') >= 0 } catch (err) { }
  try { return !!e.isMonster() } catch (err) { return false }
}
// Event mobs and an op's named ones stay.
function keepMob(e) {
  try { if (e.hasCustomName()) return true } catch (err) { }
  let tags = ''
  try { tags = String(e.getTags()) } catch (err) { }
  return KEEP_TAGS.test(tags)
}
function unwanted(st, e) {
  try { if (e.isPlayer()) return false } catch (err) { }
  return isMonster(e) && !keepMob(e) && inShrineSpace(st, dimOf(e), pos(e))
}
// Takes away the monsters already in the Shrine's space (walled in by the rise, or there before the spawn ban).
function sweepMonsters(server, st) {
  let all = []
  try { all = list(server.entities) } catch (e) { return 0 }
  let n = 0
  all.forEach(e => {
    let gone = false
    try { if (unwanted(st, e)) { e.discard(); gone = true } } catch (err) { }
    if (gone) n++
  })
  if (n) console.info('[Shrine] Took away ' + n + ' monster' + (n == 1 ? '' : 's') + ' from the Shrine')
  return n
}
EntityEvents.spawned(event => {
  const st = shrineStanding(), e = event.entity
  if (!st || !e || !unwanted(st, e)) return
  event.cancel()
})

// ===================== THE RISE =====================

function riseState() { return db().rise.state }
// One layer: clear its slice of the box, then place the statue's layer there, with the rumble.
function placeLayer(server, st, n) {
  const c = corner(st), y = c.y + n, mid = centreOf(st)
  run(server, 'execute in ' + st.dim + ' run fill ' + c.x + ' ' + y + ' ' + c.z + ' ' + (c.x + SIZE[0] - 1) + ' ' + y + ' ' + (c.z + SIZE[2] - 1) + ' minecraft:air')
  const ok = run(server, 'execute in ' + st.dim + ' run place template ' + STRUCTURE + '/l_' + n + ' ' + c.x + ' ' + y + ' ' + c.z)
  if (!ok) return false
  const at = mid.x + ' ' + (y + 0.5) + ' ' + mid.z
  // Stone, not sculk (owner, after the test rise: the Warden's dig sounded like squishing). Every layer: deepslate set
  // down; every 3rd: grinding stone; every 8th: the wither's crunch; at the start, the pedestal's top and the head: the
  // respawn anchor's charge, the Blood God's power gathering.
  run(server, 'execute in ' + st.dim + ' run playsound minecraft:block.deepslate.place block @a ' + at + ' 3 0.6')
  if (n % 3 == 0) run(server, 'execute in ' + st.dim + ' run playsound minecraft:block.grindstone.use block @a ' + at + ' 2 0.5')
  if (n % 8 == 4) run(server, 'execute in ' + st.dim + ' run playsound minecraft:entity.wither.break_block hostile @a ' + at + ' 1.5 0.5')
  if (n == 0 || n == PEDESTAL_TOP || n == SIZE[1] - 1) run(server, 'execute in ' + st.dim + ' run playsound minecraft:block.respawn_anchor.charge block @a ' + at + ' 4 0.5')
  run(server, 'execute in ' + st.dim + ' run particle minecraft:campfire_cosy_smoke ' + at + ' 9 0.3 9 0.01 30 force')
  run(server, 'execute in ' + st.dim + ' run particle minecraft:large_smoke ' + at + ' 11 0.2 11 0.02 40 force')
  if (n == PEDESTAL_TOP || n == SIZE[1] - 1) run(server, 'execute in ' + st.dim + ' run playsound minecraft:entity.lightning_bolt.thunder weather @a ' + at + ' 10 0.8')
  // Fire and lightning as the ground shakes (owner, 2026-11-19: no Darkness): flames along every layer, lava sparks every
  // 3rd, and with every wither's crunch a burst of fire and a bolt for show at one of the Shrine's corners, in turn;
  // lightning rings the Shrine when the head is placed.
  const corners = [[-3, -3], [SIZE[0] + 2, -3], [SIZE[0] + 2, SIZE[2] + 2], [-3, SIZE[2] + 2]]
  run(server, 'execute in ' + st.dim + ' run particle minecraft:flame ' + at + ' 10 0.2 10 0.01 40 force')
  if (n % 3 == 0) run(server, 'execute in ' + st.dim + ' run particle minecraft:lava ' + at + ' 10 0.3 10 0 12 force')
  if (n % 8 == 4) {
    let k = corners[Math.floor(n / 8) % 4], x = c.x + k[0], z = c.z + k[1]
    strike(server, st.dim, x + 0.5, standY(levelByDim(server, st.dim), x, z, st.y), z + 0.5)
    run(server, 'execute in ' + st.dim + ' run particle minecraft:flame ' + at + ' 12 0.5 12 0.06 250 force')
    run(server, 'execute in ' + st.dim + ' run playsound minecraft:entity.blaze.shoot block @a ' + at + ' 4 0.5')
  }
  if (n == SIZE[1] - 1) strikeRing(server, st.dim, mid.x, mid.z, st.y, 28, 6)
  return true
}
function nearby(server, st) {
  const m = centreOf(st)
  return players(server).filter(p => dimOf(p) == st.dim && Math.abs(pos(p).x - m.x) <= NEAR && Math.abs(pos(p).z - m.z) <= NEAR)
}
// Starts the rise (or carries it on from R.next). Returns '' or why not. A new rise waits for the braziers' beam
// (owner, 2026-11-14: so it can't be started out of order by mistake); force skips that.
function startRise(server, resumed, force) {
  const D = db(), R = D.rise
  if (R.state == 'rising' && !resumed) return 'The Shrine is already rising (layer ' + R.next + ' of ' + SIZE[1] + ').'
  if (R.state == 'risen') return 'The Shrine has already risen. (/shrine reset confirm takes it down, on the test server.)'
  const st = R.state == 'none' ? D.site : R.site
  if (!st) return 'Set the Shrine\'s site first: stand at its centre, on the ground, and run /shrine site set.'
  if (!resumed) {
    let why = otherBusy()
    if (why) return why
  }
  const lv = levelByDim(server, st.dim)
  if (!lv) return 'There is no dimension ' + st.dim + '.'
  if (!layersInstalled(server)) return 'The Shrine\'s layers are missing (kubejs/data/trollcraft/structures/shrine/l_0 .. l_63).'
  if (!resumed && !force && R.state == 'none' && D.awake.state != 'done') {
    return 'The Shrine rises last (owner, 2026-11-19): after the Ignition Rite at the beam and the Awakening, it rises by itself. /shrine rise force raises it anyway.'
  }
  const first = R.next == 0
  R.state = 'rising'
  R.site = st
  save()
  forceload(server, st, true)
  const c = corner(st), token = (global.__shrineRise = (global.__shrineRise || 0) + 1)   // one rise, even across /reload
  let waited = 0
  const step = () => {
    if (token != global.__shrineRise || db().rise.state != 'rising') return
    if (!chunksReady(lv, c)) {
      waited += 20
      if (waited > LOAD_WAIT_SECONDS * 20) {
        R.state = 'stopped'
        save()
        console.error('[Shrine] The site\'s chunks did not load within ' + LOAD_WAIT_SECONDS + ' seconds; the rise is paused at layer ' + R.next)
        return
      }
      server.scheduleInTicks(20, step)
      return
    }
    clearFootprint(server, lv, st)
    if (R.next == 0) {
      // The beam comes out and its ground goes back; the braziers' stage ends; the ambushers left are taken away.
      lowerBeam(server, lv)
      endFires(server)
      clearInspectors(server, 'shrine_ambush')
      sweepMonsters(server, st)
    }
    if (!placeLayer(server, st, R.next)) {
      R.state = 'stopped'
      save()
      console.error('[Shrine] Layer ' + R.next + ' could not be placed; the rise is paused (/shrine rise carries on)')
      return
    }
    R.next++
    if (R.next >= SIZE[1]) {
      R.state = 'risen'
      save()
      sweepMonsters(server, st)
      emptyLectern(server, st)                    // the altar waits for the Regalia book (the Awakening)
      forceload(server, st, false)
      layStairs(server, st)                       // after the box's chunks are let go: the steps force-load their own
      nearby(server, st).forEach(p => narrate(p, 'The last stone settles. Technoblade\'s Shrine stands.', 'gold'))
      console.info('[Shrine] The Shrine has risen at ' + siteText(st))
      if (db().awake.state == 'done') shrineStands(server)   // the night's last act: it stands, and the night ends
      return
    }
    save()
    server.scheduleInTicks(LAYER_TICKS, step)
  }
  if (first && !resumed) {
    skyNight(server)                                // night and a storm roll in (during the event)
    nearby(server, st).forEach(p => {
      narrate(p, 'The ground beneath the beam begins to shake. Something is coming up.', 'dark_red')
      run(server, 'title ' + nameOf(p) + ' title ' + JSON.stringify({ text: 'The Shrine rises', color: 'dark_red' }))
    })
  }
  console.info('[Shrine] The rise ' + (first ? 'begins' : 'carries on from layer ' + R.next) + ' at ' + siteText(st))
  server.scheduleInTicks(resumed ? 20 : 1, step)
  return ''
}
function stopRise() {
  const R = db().rise
  if (R.state != 'rising') return false
  global.__shrineRise = (global.__shrineRise || 0) + 1
  R.state = 'stopped'
  save()
  return true
}
// Takes the Shrine, the braziers and the beam down (the Shrine with fills of air, from the top) and forgets the night.
// The sites are kept. done() after.
function resetShrine(server, done) {
  const D = db(), R = D.rise, st = R.site
  global.__shrineRise = (global.__shrineRise || 0) + 1
  global.__shrineAwaken = (global.__shrineAwaken || 0) + 1      // an Awakening under way stops
  global.__shrineLectern = (global.__shrineLectern || 0) + 1    // and so does the lectern's watch
  global.__shrineRite = (global.__shrineRite || 0) + 1          // and the rite's waves
  resetFires(server)
  clearInspectors(server, 'shrine_inspector')
  riteBarsOff(server)
  crumbleKings(server)
  global.__shrineAutoAwaken = (global.__shrineAutoAwaken || 0) + 1   // an Awakening due to begin by itself won't
  global.__shrineFinale = (global.__shrineFinale || 0) + 1           // nor the night's end after the Shrine stands
  releaseWatchers()
  skyClear(server)
  D.awake = { state: 'none', step: 0, added: 0, spots: {} }
  D.regalia = { open: false, progress: {} }
  D.rite = freshRite({})
  D.event = { on: false, at: 0 }
  restoreAll(server)                                             // the kit goes, belongings come back
  D.signal = { at: 0, told: {} }
  D.summons = { at: 0, pages: [], given: {} }
  if (st) clearStairs(server, st)
  D.stairs = 0
  const forget = () => {
    D.rise = { state: 'none', next: 0, site: null }
    save()
    if (done) done()
  }
  if (!st || (R.state == 'none' && R.next == 0)) { lowerBeam(server, null); forget(); return }
  const lv = levelByDim(server, st.dim), c = corner(st)
  forceload(server, st, true)
  const token = (global.__shrineClear = (global.__shrineClear || 0) + 1)
  let waited = 0
  const step = () => {
    if (token != global.__shrineClear) return
    if (lv && !chunksReady(lv, c)) {
      waited += 20
      if (waited > LOAD_WAIT_SECONDS * 20) { console.error('[Shrine] The site\'s chunks did not load; /shrine reset confirm again'); return }
      server.scheduleInTicks(20, step)
      return
    }
    lowerBeam(server, lv)
    clearFootprint(server, lv, st)
    for (let y0 = SIZE[1] - CLEAR_SLAB; y0 > -CLEAR_SLAB; y0 -= CLEAR_SLAB) {
      let lo = Math.max(0, y0), hi = Math.min(SIZE[1], y0 + CLEAR_SLAB) - 1
      run(server, 'execute in ' + st.dim + ' run fill ' + c.x + ' ' + (c.y + lo) + ' ' + c.z + ' ' + (c.x + SIZE[0] - 1) + ' ' + (c.y + hi) + ' ' + (c.z + SIZE[2] - 1) + ' minecraft:air')
    }
    run(server, 'execute in ' + st.dim + ' run kill @e[type=minecraft:item,x=' + c.x + ',y=' + c.y + ',z=' + c.z + ',dx=' + (SIZE[0] - 1) + ',dy=' + SIZE[1] + ',dz=' + (SIZE[2] - 1) + ']')
    forceload(server, st, false)
    console.info('[Shrine] Taken down at ' + siteText(st))
    forget()
  }
  server.scheduleInTicks(1, step)
}

// ===================== THE STEPS UP TO THE ALTAR =====================

function stairSpan() { return STAIRS.top[1] + STAIRS.below + 1 }   // the most steps there can be
// Step k's blocks (k = 0 at the top), across the flight's width.
function stairCells(st, k) {
  const c = corner(st), out = []
  for (let z = STAIRS.z[0]; z <= STAIRS.z[1]; z++) out.push({ x: c.x + STAIRS.top[0] + k, y: c.y + STAIRS.top[1] - k, z: c.z + z })
  return out
}
function withStairChunks(server, st, fn) {
  const c = corner(st)
  withChunks(server, st.dim, c.x + STAIRS.top[0], c.z + STAIRS.z[0], c.x + STAIRS.top[0] + stairSpan() - 1, c.z + STAIRS.z[1], fn)
}
// Lays the steps, top down, where there's air (or a light block), and stops at the first step that's all ground. Laying
// them again (/shrine repair) only fills the gaps. Their count goes in db().stairs, and the glow starts.
function layStairs(server, st) {
  withStairChunks(server, st, lv => {
    let n = 0
    for (let k = 0; k < stairSpan(); k++) {
      let cells = stairCells(st, k), ground = 0
      cells.forEach(q => {
        let id = ''
        try { id = String(lv.getBlock(q.x, q.y, q.z).id) } catch (e) { }
        if (isOpen(id) || /(^|:)light$/.test(id)) run(server, 'execute in ' + st.dim + ' run setblock ' + q.x + ' ' + q.y + ' ' + q.z + ' minecraft:barrier')
        else if (!isStep(id)) ground++
      })
      if (ground == cells.length) break
      n = k + 1
    }
    db().stairs = n
    save()
    startStairGlow(server)
    console.info('[Shrine] The steps to the altar: ' + n)
  })
}
// Takes every step away (barriers only, over the whole span), and stops the glow.
function clearStairs(server, st) {
  global.__shrineStairs = (global.__shrineStairs || 0) + 1
  withStairChunks(server, st, lv => {
    for (let k = 0; k < stairSpan(); k++) {
      let cells = stairCells(st, k), a = cells[0], b = cells[cells.length - 1]
      run(server, 'execute in ' + st.dim + ' run fill ' + a.x + ' ' + a.y + ' ' + a.z + ' ' + b.x + ' ' + b.y + ' ' + b.z + ' minecraft:air replace minecraft:barrier')
    }
  })
}
// Faint red dust over the middle of each step, while anyone is near.
function startStairGlow(server) {
  const token = (global.__shrineStairs = (global.__shrineStairs || 0) + 1)
  const tick = () => {
    if (token != global.__shrineStairs) return
    const D = db(), st = D.rise.site
    if (D.rise.state != 'risen' || !st || !D.stairs) return
    const half = stairCells(st, Math.floor(D.stairs / 2)), mid = half[Math.floor(half.length / 2)]
    if (players(server).some(p => dimOf(p) == st.dim && flat(pos(p), mid) <= STAIRS.glowRadius)) {
      for (let k = 0; k < D.stairs; k++) {
        let cells = stairCells(st, k), q = cells[Math.floor(cells.length / 2)]
        run(server, 'execute in ' + st.dim + ' run particle minecraft:dust 0.55 0 0 1 ' + (q.x + 0.5) + ' ' + (q.y + 1.05) + ' ' + (q.z + 0.5) + ' 0.3 0 1 0 2 normal')
      }
    }
    server.scheduleInTicks(STAIRS.glowTicks, tick)
  }
  server.scheduleInTicks(STAIRS.glowTicks, tick)
}

// ===================== STAGE 2: THE BRAZIERS =====================

function firePos(b) { return { x: b.x, y: b.y + 1, z: b.z } }
function firesActive() { const s = db().fires.state; return s == 'placed' || s == 'counting' || s == 'lit' }
function litCount() { return db().fires.lit.filter(x => x).length }
function brazierForceload(server, b, add) {
  run(server, 'execute in ' + b.dim + ' run forceload ' + (add ? 'add ' : 'remove ') + (b.x - 1) + ' ' + (b.z - 1) + ' ' + (b.x + 1) + ' ' + (b.z + 1))
}
function brazierLoaded(lv, b) {
  const corners = [[-1, -1], [1, -1], [-1, 1], [1, 1]]
  return corners.every(c => {
    try { return !!lv.hasChunk(Math.floor((b.x + c[0]) / 16), Math.floor((b.z + c[1]) / 16)) } catch (e) { return false }
  })
}
function buildBrazier(server, b) {
  BRAZIER_PARTS.forEach(part => run(server, 'execute in ' + b.dim + ' run setblock ' + (b.x + part[0]) + ' ' + (b.y + part[1]) + ' ' + (b.z + part[2]) + ' ' + part[3]))
}
function clearBrazier(server, b) {
  run(server, 'execute in ' + b.dim + ' run fill ' + (b.x - 1) + ' ' + b.y + ' ' + (b.z - 1) + ' ' + (b.x + 1) + ' ' + (b.y + 2) + ' ' + (b.z + 1) + ' minecraft:air')
}
// Whether the brazier's campfire burns: true, false, or null when it isn't there (broken or replaced).
function fireLit(lv, b) {
  const f = firePos(b)
  let blk = null
  try { blk = lv.getBlock(f.x, f.y, f.z) } catch (e) { return null }
  if (!blk || String(blk.id) != 'minecraft:campfire') return null
  try { return String(blk.properties.get('lit')) == 'true' } catch (e) { return null }
}
function setFire(server, b, lit) {
  const f = firePos(b)
  run(server, 'execute in ' + b.dim + ' run setblock ' + f.x + ' ' + f.y + ' ' + f.z + ' minecraft:campfire[lit=' + (lit ? 'true' : 'false') + ',signal_fire=false]')
}
// The braziers' blocks, so they can't be broken (outside creative).
function brazierAt(d, x, y, z) {
  const F = db().fires
  if (F.state == 'none') return false
  return F.sites.some(b => b.dim == d && x >= b.x - 1 && x <= b.x + 1 && z >= b.z - 1 && z <= b.z + 1 && y >= b.y && y <= b.y + 2)
}

// Puts the braziers out (each is built once its chunk is loaded) and starts watching them. '' or why not.
function placeBraziers(server) {
  const D = db(), F = D.fires
  if (F.state == 'placed' || F.state == 'counting') return 'The braziers are already out (' + litCount() + ' of 3 lit).'
  if (F.state == 'lit') return 'The three fires already burn.'
  const missing = []
  for (let i = 0; i < BRAZIERS; i++) { if (!D.braziers[i]) missing.push(i + 1) }
  if (missing.length) return 'Set every brazier first: /shrine brazier set ' + missing.join(', ') + '.'
  if (!D.start) return 'Set the start first: /shrine start set, where everyone is gathered when the braziers go out.'
  const why = otherBusy()
  if (why) return why
  D.fires = freshFires()
  D.fires.state = 'placed'
  D.fires.sites = D.braziers.map(b => ({ dim: b.dim, x: b.x, y: b.y, z: b.z }))
  if (!D.event.on) D.event = { on: true, at: Date.now() }
  save()
  D.fires.sites.forEach(b => brazierForceload(server, b, true))   // kept loaded while the fires are watched
  gatherAll(server)
  startFireWatch(server)
  console.info('[Shrine] The braziers are out; the event is on')
  return ''
}
// Every player online goes to the start, wherever they are, and the pilgrims are armed for the night (the kit).
function gatherAll(server) {
  const s = db().start
  players(server).forEach(p => {
    run(server, 'execute in ' + s.dim + ' run tp ' + nameOf(p) + ' ' + (s.x + 0.5) + ' ' + s.y + ' ' + (s.z + 0.5))
    narrate(p, 'The pilgrimage begins. Until the Shrine awakens, falling is not the end: you wake by the last fire lit, or here.', 'dark_red')
    try { kitUp(server, p) } catch (e) { console.error('[Shrine] Kit for ' + nameOf(p) + ': ' + e) }
  })
  console.info('[Shrine] Everyone gathered at the start, ' + siteText(s))
}
function eventOn() { return !!db().event.on }
function endEvent() {
  const D = db()
  if (!D.event.on) return
  D.event = { on: false, at: 0 }
  save()
  console.info('[Shrine] The event is over: deaths are deaths again')
}
// The brazier lit last that still burns, or null.
function lastLitBrazier() {
  const F = db().fires
  let best = -1, at = -1
  F.sites.forEach((b, i) => {
    let t = (F.litAt && F.litAt[i]) || 0
    if (F.lit[i] && t >= at) { best = i; at = t }
  })
  return best < 0 ? null : F.sites[best]
}
function bossbar(server, name, value, color) {
  run(server, 'bossbar add ' + FIRE_BOSSBAR + ' ' + JSON.stringify(name))
  run(server, 'bossbar set ' + FIRE_BOSSBAR + ' name ' + JSON.stringify(name))
  run(server, 'bossbar set ' + FIRE_BOSSBAR + ' max ' + FIRE_WINDOW_SECONDS)
  run(server, 'bossbar set ' + FIRE_BOSSBAR + ' value ' + Math.max(0, Math.min(FIRE_WINDOW_SECONDS, Math.round(value))))
  run(server, 'bossbar set ' + FIRE_BOSSBAR + ' color ' + (color || 'red'))
  run(server, 'bossbar set ' + FIRE_BOSSBAR + ' players @a')
}
function bossbarOff(server) { run(server, 'bossbar remove ' + FIRE_BOSSBAR) }
// Once a second while the fires are out: build what's not built, see which burn, the 60-second window, the ambushes.
function startFireWatch(server) {
  const token = (global.__shrineFires = (global.__shrineFires || 0) + 1)
  const step = () => {
    if (token != global.__shrineFires || !firesActive()) return
    try { fireTick(server) } catch (e) { console.error('[Shrine] Fires: ' + e) }
    server.scheduleInTicks(20, step)
  }
  server.scheduleInTicks(1, step)
}
function fireTick(server) {
  const F = db().fires, now = Date.now()
  let changed = false
  F.sites.forEach((b, i) => {
    let lv = levelByDim(server, b.dim)
    if (!lv || !brazierLoaded(lv, b)) return
    if (!F.built[i]) { buildBrazier(server, b); F.built[i] = true; changed = true; return }
    let lit = fireLit(lv, b)
    if (lit === null) { setFire(server, b, F.state == 'lit'); return }   // broken or replaced: put back
    if (F.state == 'lit') { if (!lit) setFire(server, b, true); return }  // they burn for the rest of the night
    if (lit && !F.lit[i]) {
      F.lit[i] = true
      if (F.litAt) F.litAt[i] = now
      changed = true
      if (F.state == 'placed') { F.state = 'counting'; F.firstLitAt = now }
      let n = litCount()
      narrateAll(server, n == 1 ? 'Far away, a fire catches. 1 of 3. The others have a minute.' : 'Another fire catches. ' + n + ' of 3.', 'dark_red')
      run(server, 'execute in ' + b.dim + ' run playsound minecraft:item.firecharge.use block @a ' + (b.x + 0.5) + ' ' + (b.y + 1.5) + ' ' + (b.z + 0.5) + ' 2 0.7')
      // a column of flame and smoke over it, and a roar everyone hears
      run(server, 'execute in ' + b.dim + ' run particle minecraft:flame ' + (b.x + 0.5) + ' ' + (b.y + 4) + ' ' + (b.z + 0.5) + ' 0.25 3 0.25 0.02 160 force')
      run(server, 'execute in ' + b.dim + ' run particle minecraft:campfire_signal_smoke ' + (b.x + 0.5) + ' ' + (b.y + 6) + ' ' + (b.z + 0.5) + ' 0.3 4 0.3 0.01 60 force')
      hearAll(server, players(server), 'minecraft:entity.blaze.shoot', 0.8, 0.5)
    } else if (!lit && F.lit[i]) { F.lit[i] = false; changed = true }    // put out before the others caught
  })
  if (F.state == 'counting') {
    let left = FIRE_WINDOW_SECONDS - (now - F.firstLitAt) / 1000
    if (litCount() == BRAZIERS) allLit(server)
    else if (left <= 0) gutter(server)
    else if (litCount() == 0) { F.state = 'placed'; F.firstLitAt = 0; bossbarOff(server) }   // all put out: start over
    else bossbar(server, [{ text: 'The fires: ' + litCount() + ' / 3', color: 'red' }, { text: '   ' + clock(left), color: 'gray' }], left)
    changed = true
  }
  if (F.state == 'placed' || F.state == 'counting') ambushCheck(server)
  if (F.state == 'lit') gatheredCheck(server)
  if (changed) save()
}
function allLit(server) {
  db().fires.state = 'lit'
  save()
  bossbar(server, { text: 'Three fires burn as one', color: 'gold' }, FIRE_WINDOW_SECONDS, 'yellow')
  server.scheduleInTicks(120, () => { if (db().fires.state != 'counting') bossbarOff(server) })
  narrateAll(server, 'Three fires burn as one. Above the land, a red light rises toward the sky.', 'gold')
  players(server).forEach(p => run(server, 'execute as ' + nameOf(p) + ' at @s run playsound minecraft:block.beacon.activate master @s ~ ~ ~ 1 0.8'))
  db().fires.sites.forEach(b => strike(server, b.dim, b.x + 0.5, b.y + 1, b.z + 0.5))
  titleTo(server, players(server), { text: 'THREE FIRES BURN', color: 'gold', bold: true }, { text: 'A red light rises over the Shrine', color: 'red' })
  raiseBeam(server)
  console.info('[Shrine] All three fires burn')
}
function gutter(server) {
  const F = db().fires
  F.sites.forEach((b, i) => {
    if (!F.lit[i]) return
    setFire(server, b, false)
    let at = (b.x + 0.5) + ' ' + (b.y + 1.5) + ' ' + (b.z + 0.5)
    run(server, 'execute in ' + b.dim + ' run particle minecraft:large_smoke ' + at + ' 0.3 0.4 0.3 0.02 30 force')
    run(server, 'execute in ' + b.dim + ' run playsound minecraft:block.fire.extinguish block @a ' + at + ' 2 0.8')
  })
  F.lit = [false, false, false]
  F.state = 'placed'
  F.firstLitAt = 0
  save()
  bossbarOff(server)
  narrateAll(server, 'The fires gutter out. They must burn together.', 'dark_red')
  console.info('[Shrine] The fires guttered out')
}
// All three lit by an op (/shrine fires light), say if a team can't get there.
function lightAll(server) {
  const F = db().fires
  if (F.state != 'placed' && F.state != 'counting') return false
  F.sites.forEach(b => setFire(server, b, true))
  F.lit = [true, true, true]
  allLit(server)
  return true
}
// The rise has begun: the fires stay as they are, the watching stops and their chunks are let go.
function endFires(server) {
  const F = db().fires
  if (!firesActive()) return
  global.__shrineFires = (global.__shrineFires || 0) + 1
  F.sites.forEach(b => brazierForceload(server, b, false))
  F.state = 'done'
  save()
  bossbarOff(server)
}
// Takes the braziers away (the test server's reset) and forgets the fires.
function resetFires(server) {
  const F = db().fires
  global.__shrineFires = (global.__shrineFires || 0) + 1
  bossbarOff(server)
  clearInspectors(server, 'shrine_ambush')
  if (F.state != 'none') F.sites.forEach(b => withChunks(server, b.dim, b.x - 1, b.z - 1, b.x + 1, b.z + 1, lv => clearBrazier(server, b)))
  db().fires = freshFires()
  save()
}

// ===================== THE NIGHT'S KIT AND THE VAULT =====================
// As in part2/gladiator_arena.js and part2/purge.js: every slot is saved whole (serializeNBT, so items that keep their
// contents in a Forge capability come back full), every stack is checked to rebuild before anything is cleared, a
// backup file is kept, and everything is handed back at the end (or at the next login).

function emptyStack() { try { return Item.empty } catch (e) { return Item.of('minecraft:air') } }
function stackNbt(s) { try { return s.nbt != null ? String(s.nbt) : '' } catch (e) { return '' } }
function stackFull(s) { try { return String(s.serializeNBT()) } catch (e) { return '' } }
function savedStack(s, slot) { return { id: String(s.id), count: Number(s.count), nbt: stackNbt(s), full: stackFull(s), slot: slot } }
function rebuild(r) {
  if (!r.full) return Item.of(r.id, r.count, r.nbt || null)
  if (!ItemStackClass || typeof NBT == 'undefined') throw new Error('ItemStack.of is not available')
  const st = ItemStackClass.of(NBT.toTagCompound(r.full))
  if (!st || st.isEmpty()) throw new Error('unknown item ' + r.id)
  return st
}
function rebuilds(r) {
  if (!r.full) return false
  try {
    let st = rebuild(r)
    if (String(st.id) != r.id || Number(st.count) != r.count) return false
    return !/ForgeCaps/.test(r.full) || /ForgeCaps/.test(stackFull(st))
  } catch (e) {
    console.error('[Shrine] Can\'t rebuild ' + r.id + ': ' + e)
    return false
  }
}
function invSize(p) { try { return Number(p.inventory.getContainerSize()) } catch (e) { return 41 } }
function clearInventory(p) {
  try { p.inventory.clearContent(); return } catch (e) { }
  const n = invSize(p)
  for (let i = 0; i < n; i++) { try { p.inventory.setItem(i, emptyStack()) } catch (e) { } }
}
function isKitItem(s) {
  try { let t = s.nbt; if (t != null && typeof t.contains == 'function') return !!t.contains('ShrineKit') } catch (e) { }
  return /ShrineKit:1b/.test(stackNbt(s))
}
// The player's worn curios (Curios API) as an item handler: getSlots, getStackInSlot, setStackInSlot. null without.
function curiosOf(p) {
  if (!CuriosApi) return null
  try {
    let opt = CuriosApi.getCuriosInventory(p).resolve()
    if (opt.isPresent()) return opt.get().getEquippedCurios()
  } catch (e) { }
  try {
    let opt2 = CuriosApi.getCuriosHelper().getEquippedCurios(p).resolve()
    if (opt2.isPresent()) return opt2.get()
  } catch (e) { }
  return null
}
// Tool Belt's own belt slot (separate from Curios): getContents / setContents, or null without the mod.
function beltSlotOf(p) {
  if (!BeltSlot) return null
  try {
    let opt = BeltSlot.get(p).resolve()
    if (opt.isPresent()) return opt.get().getBelt()
  } catch (e) { }
  return null
}
// Kit items can't leave the night: takes any the player carries (inventory, curios, ender chest). Returns how many.
function stripKit(p) {
  let n = 0
  const take = (get, set, size) => {
    for (let i = 0; i < size; i++) {
      let s = get(i)
      if (s && !s.isEmpty() && isKitItem(s)) { set(i, emptyStack()); n++ }
    }
  }
  try { take(i => p.inventory.getItem(i), (i, s) => p.inventory.setItem(i, s), invSize(p)) } catch (e) { }
  const cur = curiosOf(p)
  if (cur) { try { take(i => cur.getStackInSlot(i), (i, s) => cur.setStackInSlot(i, s), Number(cur.getSlots())) } catch (e) { } }
  try {
    let ec = p.getEnderChestInventory()
    take(i => ec.getItem(i), (i, s) => ec.setItem(i, s), Number(ec.getContainerSize()))
  } catch (e) { }
  return n
}
function backup(rec) {
  const file = rec.name + '_' + rec.uuid + '.json'
  try { JsonIO.write(VAULT_DIR + file, rec) } catch (e) {
    try { JsonIO.write('kubejs/shrine_vault_' + file, rec) } catch (e2) { console.warn('[Shrine] Backup file for ' + rec.name + ': ' + e2) }
  }
}
function kitSnbt(extra) {
  return '{ShrineKit:1b,' + (extra ? extra + ',' : '') + 'display:{Lore:[' + snbtString(JSON.stringify({ text: KIT.lore, color: 'dark_gray', italic: false })) + ']}}'
}
// The kit: the sword and the food in the hotbar, the armour worn, the shield in the off hand.
function giveKit(p) {
  clearInventory(p)
  KIT.items.forEach((it, i) => { p.inventory.setItem(i, Item.of(it[0], it[1], kitSnbt(it[2]))) })
  KIT.armor.forEach((id, i) => { p.inventory.setItem(39 - i, Item.of(id, 1, kitSnbt(KIT.enchant))) })   // 39 head .. 36 feet
  if (KIT.offhand) p.inventory.setItem(40, Item.of(KIT.offhand, 1, kitSnbt(KIT.enchant)))
  if (!db().kitOut) { db().kitOut = true; save() }
}
// Holds a player's belongings: every slot, the worn curios and Tool Belt's belt slot. '' or why it couldn't (then
// nothing was touched).
function vault(p) {
  const D = db(), u = uuidOf(p)
  if (D.vaults[u]) return ''
  const slots = [], worn = [], n = invSize(p), cur = curiosOf(p), beltSlot = beltSlotOf(p)
  let belt = null
  if (beltSlot) {
    let b = beltSlot.getContents()
    if (b && !b.isEmpty() && !isKitItem(b)) belt = savedStack(b, 0)
  }
  for (let i = 0; i < n; i++) {
    let s = p.inventory.getItem(i)
    if (s && !s.isEmpty() && !isKitItem(s)) slots.push(savedStack(s, i))
  }
  if (cur) {
    for (let i = 0; i < Number(cur.getSlots()); i++) {
      let s = cur.getStackInSlot(i)
      if (s && !s.isEmpty() && !isKitItem(s)) worn.push(savedStack(s, i))
    }
  }
  const bad = slots.concat(worn).concat(belt ? [belt] : []).filter(s => !rebuilds(s))
  if (bad.length) return bad.length + ' of their items (' + bad[0].id + ') could not be stored safely'
  const rec = { name: nameOf(p), uuid: u, t: Date.now(), slots: slots, curios: worn, belt: belt }
  D.vaults[u] = rec
  if (!save()) { delete D.vaults[u]; return 'their belongings could not be saved' }
  backup(rec)
  clearInventory(p)
  worn.forEach(r => { try { cur.setStackInSlot(r.slot, emptyStack()) } catch (e) { } })
  if (belt) { try { beltSlot.setContents(emptyStack()) } catch (e) { } }
  return ''
}
// Hands belongings back: the kit goes (inventory, curios, ender chest), then every slot. What can't be rebuilt stays in
// the vault (and its backup file), and the ops are told.
function unvault(server, p) {
  const D = db(), u = uuidOf(p), V = D.vaults[u]
  if (!V) return true
  if (!V.partial) clearInventory(p)
  stripKit(p)
  const bad = [], badWorn = [], cur = curiosOf(p)
  V.slots.forEach(s => {
    try {
      if (V.partial) p.give(rebuild(s))
      else p.inventory.setItem(s.slot, rebuild(s))
    } catch (e) { bad.push(s); console.error('[Shrine] ' + V.name + ' slot ' + s.slot + ' (' + s.id + '): ' + e) }
  })
  ;(V.curios || []).forEach(s => {
    try {
      let st = rebuild(s)
      if (cur && !V.partial && cur.getStackInSlot(s.slot).isEmpty()) cur.setStackInSlot(s.slot, st)
      else p.give(st)                                 // no curio slot free (or no Curios): into the inventory
    } catch (e) { badWorn.push(s); console.error('[Shrine] ' + V.name + ' curio ' + s.slot + ' (' + s.id + '): ' + e) }
  })
  if (V.belt) {
    try {
      let st = rebuild(V.belt), bs = beltSlotOf(p)
      if (bs && !V.partial && bs.getContents().isEmpty()) bs.setContents(st)
      else p.give(st)
    } catch (e) { badWorn.push(V.belt); console.error('[Shrine] ' + V.name + ' belt slot (' + V.belt.id + '): ' + e) }
    V.belt = null
  }
  if (bad.length || badWorn.length) {
    V.curios = badWorn
    V.slots = bad
    V.partial = true
    save()
    backup(V)
    opsOnline(server).forEach(o => narrate(o, '[Shrine] ' + (bad.length + badWorn.length) + ' of ' + V.name + '\'s items could not be handed back. They stay held, in the saved data and the backup file (kubejs/shrine_vault_' + V.name + '_' + V.uuid + '.json).', 'red'))
    return false
  }
  V.restored = Date.now()
  backup(V)
  delete D.vaults[u]
  save()
  narrate(p, 'The night is over. Your own belongings are back.', 'gold')
  console.info('[Shrine] ' + V.name + '\'s belongings handed back')
  return true
}
// Arms a pilgrim for the night: their belongings into the vault, the kit on. Creative and spectators are left alone.
function kitUp(server, p) {
  if (!pilgrim(p)) return false
  const D = db(), u = uuidOf(p)
  if (D.vaults[u]) return true                    // already held (back from a logout, or a second /shrine braziers)
  const why = vault(p)
  if (why) {
    narrate(p, 'Your belongings couldn\'t be held safely (' + why + '), so you fight in your own gear tonight.', 'red')
    opsOnline(server).forEach(o => narrate(o, '[Shrine] ' + nameOf(p) + ' fights in their own gear: ' + why + '.', 'red'))
    console.warn('[Shrine] No kit for ' + nameOf(p) + ': ' + why)
    return false
  }
  giveKit(p)
  narrate(p, 'You are armed for the night: the Shrine\'s kit, which will not break. Your own belongings are safe until the Shrine awakens.', 'gold')
  console.info('[Shrine] Kit for ' + nameOf(p))
  return true
}
// The night is over (the Awakening's end, or a reset): everyone online gets their belongings back; the kit goes.
function restoreAll(server) {
  players(server).forEach(p => {
    try {
      if (db().vaults[uuidOf(p)]) unvault(server, p)
      else stripKit(p)
    } catch (e) { console.error('[Shrine] Handing back ' + nameOf(p) + '\'s belongings: ' + e) }
  })
}
// Outside the night: belongings still held go back to anyone online, and stray kit items are taken.
function startKitSweep(server) {
  const token = (global.__shrineKitSweep = (global.__shrineKitSweep || 0) + 1)
  const step = () => {
    if (token != global.__shrineKitSweep) return
    try { if (!eventOn() && (db().kitOut || Object.keys(db().vaults).length)) sweepKit(server) } catch (e) { console.error('[Shrine] Kit sweep: ' + e) }
    server.scheduleInTicks(KIT_SWEEP_TICKS, step)
  }
  server.scheduleInTicks(KIT_SWEEP_TICKS, step)
}
function sweepKit(server) {
  players(server).forEach(p => {
    if (db().vaults[uuidOf(p)]) { unvault(server, p); return }
    let n = stripKit(p)
    if (!n) return
    narrate(p, 'The Shrine\'s kit stays with the night: ' + n + ' item' + (n == 1 ? '' : 's') + ' taken back.', 'gray')
    console.warn('[Shrine] Took ' + n + ' kit items from ' + nameOf(p))
  })
}

// ===================== STAGE 2: THE BEAM =====================

function beamCells(st) { return BEAM_PARTS.map(p => ({ x: st.x + p[0], y: st.y + p[1], z: st.z + p[2], state: p[3] })) }
// Puts the beacon in under the Shrine site, keeping what it replaces.
function raiseBeam(server) {
  const st = db().site
  if (!st || db().beam.up) return false
  withChunks(server, st.dim, st.x - 1, st.z - 1, st.x + 1, st.z + 1, lv => setBeam(server, lv, st))
  return true
}
function setBeam(server, lv, st) {
  const B = db().beam
  if (B.up) return
  const cells = beamCells(st)
  B.saved = cells.map(c => {
    let s = 'minecraft:air'
    try { s = stateString(lv.getBlock(c.x, c.y, c.z)) } catch (e) { }
    return { x: c.x, y: c.y, z: c.z, state: s }
  })
  cells.forEach(c => run(server, 'execute in ' + st.dim + ' run setblock ' + c.x + ' ' + c.y + ' ' + c.z + ' ' + c.state))
  B.up = true
  B.at = { dim: st.dim, x: st.x, y: st.y, z: st.z }
  save()
  const blocked = skyBlock(lv, st)
  if (blocked) console.warn('[Shrine] Something above the site may stop the beam: ' + blocked)
  console.info('[Shrine] The beam is up at ' + siteText(st))
}
// Puts back what the beam replaced. lv: the site's level with its chunk loaded, or null to load it first.
function lowerBeam(server, lv) {
  const B = db().beam
  if (!B.up || !B.at) return
  const at = B.at
  const put = () => {
    B.saved.forEach(c => run(server, 'execute in ' + at.dim + ' run setblock ' + c.x + ' ' + c.y + ' ' + c.z + ' ' + c.state))
    B.up = false
    B.saved = []
    save()
    console.info('[Shrine] The beam is down')
  }
  if (lv) put()
  else withChunks(server, at.dim, at.x - 1, at.z - 1, at.x + 1, at.z + 1, l => put())
}
// The first block above the site's centre that may stop the beam ('' if the sky is open).
function skyBlock(lv, st) {
  for (let y = st.y; y < st.y + SKY_CHECK; y++) {
    let id = ''
    try { id = String(lv.getBlock(st.x, y, st.z).id) } catch (e) { return '' }
    if (!isOpen(id)) return id + ' at ' + st.x + ' ' + y + ' ' + st.z
  }
  return ''
}

// ===================== STAGE 2: THE AMBUSHES (the Shrine's own Inspectors) =====================
// Part II has no portal_ambush.js, so the Shrine spawns its Inspectors itself (the rite's waves will use them too).

// opts: armour ('iron' or 'diamond'), shield (vindicators), axe (the item id), name, health, tags (more tags).
// They see players up to 64 blocks off, so the rite's waves, coming from 30-45 blocks out, find their way in.
function inspectorNbt(kind, tag, opts) {
  opts = opts || {}
  const metal = opts.armour || INSPECTOR.armour
  const armour = ['boots', 'leggings', 'chestplate', 'helmet'].map(s => '{id:"minecraft:' + metal + '_' + s + '",Count:1b}')
  const main = kind == 'pillager' ? '{id:"minecraft:crossbow",Count:1b}' : '{id:"' + (opts.axe || 'minecraft:' + metal + '_axe') + '",Count:1b}'
  const off = opts.shield && kind != 'pillager' ? '{id:"minecraft:shield",Count:1b}' : '{}'
  const tags = ['shrine_inspector', tag].concat(opts.tags || [])
  const attrs = ['{Name:"minecraft:generic.follow_range",Base:64.0d}'].concat(opts.health ? ['{Name:"minecraft:generic.max_health",Base:' + opts.health + '.0d}'] : [])
  return '{PersistenceRequired:1b,CanPickUpLoot:0b,CanJoinRaid:0b,PatrolLeader:0b,Patrolling:0b,DeathLootTable:"minecraft:empty"' +
    ',Tags:[' + tags.map(t => '"' + t + '"').join(',') + ']' +
    ',CustomName:' + snbtString(JSON.stringify({ text: opts.name || INSPECTOR.name, color: INSPECTOR.color, italic: false, bold: !!opts.name })) + ',CustomNameVisible:1b' +
    ',HandItems:[' + main + ',' + off + '],HandDropChances:[0f,0f],ArmorItems:[' + armour.join(',') + '],ArmorDropChances:[0f,0f,0f,0f]' +
    ',Attributes:[' + attrs.join(',') + ']' + (opts.health ? ',Health:' + opts.health + 'f' : '') + '}'
}
function summonInspector(server, dim, x, y, z, kind, tag, opts) {
  return !!run(server, 'execute in ' + dim + ' run summon minecraft:' + kind + ' ' + x + ' ' + y + ' ' + z + ' ' + inspectorNbt(kind, tag, opts))
}
// An ambush on p and the pilgrims within AMBUSH.team blocks: Inspectors on the ground in a ring round them. Returns how
// many came.
function ambush(server, p) {
  const d = dimOf(p), q = pos(p), lv = levelOfEntity(p), who = nameOf(p)
  const team = players(server).filter(o => dimOf(o) == d && (nameOf(o) == who || (pilgrim(o) && flat(pos(o), q) <= AMBUSH.team)))
  const n = Math.min(AMBUSH.max, AMBUSH.base + team.length)
  let made = 0
  for (let i = 0; i < n; i++) {
    let s = groundSpot(lv, q.x, q.z, Math.floor(q.y), AMBUSH.ring[0], AMBUSH.ring[1], i * 2 * 3.14159265 / n + Math.random() * 0.6)
    if (summonInspector(server, d, s.x, s.y, s.z, i % 2 == 0 ? 'vindicator' : 'pillager', 'shrine_ambush')) made++
  }
  team.forEach(o => {
    narrate(o, 'Figures close in, clipboards first.', 'gray')
    try { o.tell(comp([{ text: INSPECTOR.name + ': ', color: INSPECTOR.color, bold: true }, { text: '"' + INSPECTOR.voice + '"', color: 'yellow' }])) } catch (e) { }
  })
  console.info('[Shrine] Ambush on ' + team.map(nameOf).join(', ') + ': ' + made + ' Inspectors')
  return made
}
// The automatic ambush, once per brazier: the nearest pilgrim within AMBUSH.radius of a brazier that isn't lit.
function ambushCheck(server) {
  const F = db().fires
  F.sites.forEach((b, i) => {
    if (F.ambushed[i] || F.lit[i]) return
    let best = null, bestD = 0
    players(server).forEach(p => {
      if (!pilgrim(p) || dimOf(p) != b.dim) return
      let dd = flat(pos(p), b)
      if (dd <= AMBUSH.radius && (!best || dd < bestD)) { best = p; bestD = dd }
    })
    if (!best) return
    F.ambushed[i] = true
    save()
    ambush(server, best)
  })
}
// Takes away the Inspectors with that tag (no drops). Returns how many.
function clearInspectors(server, tag) {
  let all = []
  try { all = list(server.entities) } catch (e) { return 0 }
  let n = 0
  all.forEach(e => {
    let tags = ''
    try { tags = String(e.getTags()) } catch (err) { }
    if (tags.indexOf(tag) < 0) return
    try { e.discard(); n++ } catch (err) { }
  })
  return n
}

// ===================== STAGE 4: THE IGNITION RITE =====================

// --- The Potato King's Potatoes: Technoblade's own, hoarded by the Inspectors; only the altar takes them ---
function kingsTag() {
  return '{trollcraft:{kingspotato:1b},display:{Name:' + snbtString(JSON.stringify({ text: KINGS_POTATO.name, color: 'gold', italic: false })) +
    ',Lore:[' + snbtString(JSON.stringify({ text: KINGS_POTATO.lore, color: 'gray', italic: true })) + ']},Enchantments:[{id:"minecraft:unbreaking",lvl:1s}],HideFlags:1}'
}
function isKingsPotato(s) {
  if (!s || s.isEmpty() || String(s.id) != 'minecraft:potato') return false
  try { return s.nbt != null && s.nbt.contains('trollcraft') && s.nbt.getCompound('trollcraft').contains('kingspotato') } catch (e) { return false }
}
function dropKings(server, dim, q, n) {
  run(server, 'execute in ' + dim + ' run summon minecraft:item ' + q.x + ' ' + (q.y + 0.5) + ' ' + q.z + ' {Item:{id:"minecraft:potato",Count:' + n + 'b,tag:' + kingsTag() + '},PickupDelay:10s}')
}
// Takes every Potato King's Potato the player carries (hotbar, inventory, off hand). Returns how many.
function takeKings(p) {
  const inv = p.inventory
  let n = 0
  for (let i = 0; i < 41; i++) {
    let s = inv.getItem(i)
    if (!isKingsPotato(s)) continue
    n += s.getCount()
    s.shrink(s.getCount())
  }
  return n
}
// The Awakening: leftovers crumble, in pockets and on the ground.
function crumbleKings(server) {
  players(server).forEach(p => {
    let n = 0
    try { n = takeKings(p) } catch (e) { }
    if (n > 0) narrate(p, 'The Potato King\'s Potatoes you carried crumble to dust. Their work is done.', 'gray')
  })
  run(server, 'kill @e[type=minecraft:item,nbt={Item:{tag:{trollcraft:{kingspotato:1b}}}}]')
}

// --- The waves ---
function riteOn() { const s = db().rite.state; return s == 'running' || s == 'full' }
function waveSize(w, n) { return Math.min(WAVE_MAX, Math.max(w.min, Math.ceil(w.per * n))) }
function ringSpot(lv, st, rMin, rMax, a) { const m = centreOf(st); return groundSpot(lv, m.x, m.z, st.y, rMin, rMax, a) }
function riteTold(server, text, color) { presentAt(server, siteNow()).forEach(p => narrate(p, text, color)) }
function waveDef(i) { return WAVES[Math.min(i, WAVES.length - 1)] }
function seniorBar(i) { return SENIOR_BOSSBAR + '_' + i }
// Wave i: its ordinary Inspectors (they drop nothing) and the Senior Inspector at their head, with his own bar.
function spawnWave(server, i) {
  const D = db(), R = D.rite, st = siteNow(), w = waveDef(i), lv = levelByDim(server, st.dim)
  const n = waveSize(w, R.present)
  let made = 0
  for (let k = 0; k < n; k++) {
    let q = ringSpot(lv, st, WAVE_RING[0], WAVE_RING[1], k * 2 * 3.14159265 / n + Math.random() * 0.5)
    if (summonInspector(server, st.dim, q.x, q.y, q.z, k % 3 == 2 ? 'pillager' : 'vindicator', 'shrine_rite',
      { armour: w.armour, shield: w.shields, tags: ['shrine_wave_' + i] })) made++
  }
  let q = ringSpot(lv, st, WAVE_RING[0], WAVE_RING[1], Math.random() * 2 * 3.14159265)
  if (summonInspector(server, st.dim, q.x, q.y, q.z, 'vindicator', 'shrine_rite',
    { armour: 'diamond', axe: 'minecraft:netherite_axe', name: SENIOR.name, health: SENIOR.health, tags: ['shrine_wave_' + i, 'shrine_senior', 'shrine_pot_' + SENIOR.potatoes] })) {
    made++
    R.seniors[i] = { called: false }
    let bar = seniorBar(i)
    run(server, 'effect give @e[tag=shrine_senior] minecraft:resistance infinite 0 true')
    run(server, 'bossbar add ' + bar + ' ' + JSON.stringify({ text: SENIOR.name + ' (wave ' + (i + 1) + ')', color: 'gold', bold: true }))
    run(server, 'bossbar set ' + bar + ' color yellow')
    run(server, 'bossbar set ' + bar + ' max ' + SENIOR.health)
    run(server, 'bossbar set ' + bar + ' value ' + SENIOR.health)
    run(server, 'bossbar set ' + bar + ' players @a')
  }
  R.wave = i
  R.waveAt = Date.now()
  R.waveSize = made
  save()
  riteTold(server, 'Wave ' + (i + 1) + ': ' + made + ' Inspectors close in on the Shrine, a Senior Inspector at their head.', 'gold')
  const here = presentAt(server, st)
  titleTo(server, here, { text: 'WAVE ' + (i + 1), color: 'dark_red', bold: true }, { text: 'A Senior Inspector leads them', color: 'gold' })
  hearAll(server, here, 'minecraft:event.raid.horn', 1, 1)
  console.info('[Shrine] Rite wave ' + (i + 1) + ': ' + made + ' Inspectors')
}
function riteMobs(server) {
  let all = []
  try { all = list(server.entities) } catch (e) { return [] }
  return all.filter(e => {
    let tags = ''
    try { tags = String(e.getTags()) } catch (err) { }
    if (tags.indexOf('shrine_rite') < 0) return false
    try { return e.isAlive() && !e.isRemoved() } catch (err) { return true }
  })
}
// An exact tag (shrine_wave_1 isn't shrine_wave_10). getTags() reads as "[a, b, c]".
function hasTag(e, t) {
  try { return String(e.getTags()).replace(/^\[|\]$/g, '').split(', ').indexOf(t) >= 0 } catch (err) { return false }
}
function riteBar(server) {
  const R = db().rite
  const name = R.state == 'full' ? [{ text: 'The Shrine burns to its crown', color: 'gold', bold: true }] :
    [{ text: 'The Ignition Rite: ', color: 'dark_red', bold: true }, { text: R.total + ' / ' + R.need + ' potatoes', color: 'gold' }]
  run(server, 'bossbar add ' + RITE_BOSSBAR + ' ' + JSON.stringify(name))
  run(server, 'bossbar set ' + RITE_BOSSBAR + ' name ' + JSON.stringify(name))
  run(server, 'bossbar set ' + RITE_BOSSBAR + ' color ' + (R.state == 'full' ? 'yellow' : 'red'))
  run(server, 'bossbar set ' + RITE_BOSSBAR + ' max ' + Math.max(1, R.need))
  run(server, 'bossbar set ' + RITE_BOSSBAR + ' value ' + Math.min(R.need, R.total))
  run(server, 'bossbar set ' + RITE_BOSSBAR + ' players @a')
}
// Takes down the rite's bar and every Senior's (the ones up are forgotten: they're taken away with the Inspectors).
function riteBarsOff(server) {
  run(server, 'bossbar remove ' + RITE_BOSSBAR)
  seniorBarsOff(server)
}
function seniorBarsOff(server) {
  const R = db().rite
  run(server, 'bossbar remove ' + SENIOR_BOSSBAR)          // the single bar, from before every wave had a Senior
  Object.keys(R.seniors || {}).forEach(i => run(server, 'bossbar remove ' + seniorBar(i)))
  R.seniors = {}
  save()
}
// Once a second during the rite: Inspectors go after the pilgrims at the Shrine, each Senior Inspector's bar and his
// call for help, and the next wave (once NEXT_WAVE.share of the last is down, or after NEXT_WAVE.minutes, while
// fewer than RITE_ALIVE_MAX are up), until the altar is full.
function startRiteLoop(server) {
  const token = (global.__shrineRite = (global.__shrineRite || 0) + 1)
  const step = () => {
    if (token != global.__shrineRite || !riteOn()) return
    try { riteTick(server) } catch (e) { console.error('[Shrine] Rite: ' + e) }
    server.scheduleInTicks(20, step)
  }
  server.scheduleInTicks(20, step)
}
function riteTick(server) {
  const D = db(), R = D.rite, st = siteNow()
  const alive = riteMobs(server)
  const pilgrims = presentAt(server, st).filter(pilgrim)
  alive.forEach(m => {
    let t = null
    try { t = m.getTarget() } catch (e) { }
    if (t || !pilgrims.length) return
    let q = pos(m), best = pilgrims[0]
    pilgrims.forEach(p => { if (flat(pos(p), q) < flat(pos(best), q)) best = p })
    try { m.setTarget(best) } catch (e) { }
  })
  // the Senior Inspectors, each with his own bar (two can be up at once)
  Object.keys(R.seniors).forEach(i => {
    let S = R.seniors[i], senior = alive.filter(m => hasTag(m, 'shrine_senior') && hasTag(m, 'shrine_wave_' + i))[0]
    if (!senior) {
      delete R.seniors[i]
      save()
      run(server, 'bossbar remove ' + seniorBar(i))
      riteTold(server, 'The Senior Inspector falls. His clipboard does not.', 'gold')
      return
    }
    let hp = SENIOR.health
    try { hp = Number(senior.getHealth()) } catch (e) { }
    run(server, 'bossbar set ' + seniorBar(i) + ' value ' + Math.max(0, Math.round(hp)))
    if (!S.called && hp <= SENIOR.health / 2) {
      S.called = true
      save()
      let lv = levelByDim(server, st.dim), q = pos(senior)
      for (let k = 0; k < SENIOR.helpers; k++) {
        let a = k * 3.14159265 + Math.random(), x = Math.floor(q.x + Math.cos(a) * 4), z = Math.floor(q.z + Math.sin(a) * 4)
        summonInspector(server, st.dim, x + 0.5, standY(lv, x, z, Math.floor(q.y)), z + 0.5, 'vindicator', 'shrine_rite',
          { armour: 'diamond', tags: ['shrine_wave_' + i] })
      }
      riteTold(server, 'The Senior Inspector calls for assistance.', 'gold')
    }
  })
  // the next wave, until the altar is full
  if (R.state == 'running' && alive.length < RITE_ALIVE_MAX) {
    let up = alive.filter(m => hasTag(m, 'shrine_wave_' + R.wave)).length
    if (R.waveSize - up >= R.waveSize * NEXT_WAVE.share || Date.now() - R.waveAt >= NEXT_WAVE.minutes * 60000) spawnWave(server, R.wave + 1)
  }
  riteBar(server)
}

// --- The altar and the light ---
// Lights band k of the statue (its layers k*16 .. k*16+15): light blocks, LIGHT_SPACING apart, wherever there's air,
// and flames rising along it. Once all four are lit, the statue glows at night.
function lightBand(server, st, k) {
  const c = corner(st), per = SIZE[1] / BANDS, y0 = k * per, mid = centreOf(st)
  withChunks(server, st.dim, c.x, c.z, c.x + SIZE[0] - 1, c.z + SIZE[2] - 1, lv => {
    for (let y = y0; y < y0 + per; y += LIGHT_SPACING) {
      for (let x = 1; x < SIZE[0]; x += LIGHT_SPACING) {
        for (let z = 1; z < SIZE[2]; z += LIGHT_SPACING) {
          let id = ''
          try { id = String(lv.getBlock(c.x + x, c.y + y, c.z + z).id) } catch (e) { continue }
          if (isOpen(id)) run(server, 'execute in ' + st.dim + ' run setblock ' + (c.x + x) + ' ' + (c.y + y) + ' ' + (c.z + z) + ' minecraft:light[level=15]')
        }
      }
    }
    let at = mid.x + ' ' + (c.y + y0 + per / 2) + ' ' + mid.z
    run(server, 'execute in ' + st.dim + ' run particle minecraft:flame ' + at + ' 8 ' + (per / 3) + ' 8 0.03 300 force')
    run(server, 'execute in ' + st.dim + ' run playsound minecraft:item.firecharge.use block @a ' + at + ' 3 0.6')
    // a flash of flame up the band's height
    run(server, 'execute in ' + st.dim + ' run particle minecraft:flash ' + at + ' 0 0 0 0 1 force')
    run(server, 'execute in ' + st.dim + ' run particle minecraft:lava ' + at + ' 10 ' + (per / 2) + ' 10 0 80 force')
    run(server, 'execute in ' + st.dim + ' run playsound minecraft:entity.blaze.shoot block @a ' + at + ' 4 0.5')
  })
}
// The beam's red glass, where it comes out of the ground: the offering place before the Shrine rises (owner, 2026-11-19).
function beamGlass() {
  const B = db().beam
  if (!B.up || !B.at) return null
  return { dim: B.at.dim, x: B.at.x, y: B.at.y - 1, z: B.at.z }
}
// The rite's quarter k: on the Shrine, its band k lights up; before it rises, the beam surges: a ring of fire round it,
// wider each quarter, and a bolt for show into it.
function riteSurge(server, k) {
  const st = siteNow()
  if (risen()) { lightBand(server, st, k); return }
  const m = centreOf(st), r = 3 + k * 3
  for (let i = 0; i < 16; i++) {
    let a = i * 2 * 3.14159265 / 16
    run(server, 'execute in ' + st.dim + ' run particle minecraft:flame ' + (m.x + Math.cos(a) * r).toFixed(1) + ' ' + (st.y + 0.2) + ' ' + (m.z + Math.sin(a) * r).toFixed(1) + ' 0.4 0.1 0.4 0.02 20 force')
  }
  run(server, 'execute in ' + st.dim + ' run particle minecraft:lava ' + m.x + ' ' + (st.y + 1) + ' ' + m.z + ' ' + r + ' 0.2 ' + r + ' 0 40 force')
  run(server, 'execute in ' + st.dim + ' run playsound minecraft:entity.blaze.shoot block @a ' + m.x + ' ' + st.y + ' ' + m.z + ' 4 0.5')
  strike(server, st.dim, m.x, st.y, m.z)
}
// Right-clicking the offering place (the beam's red glass before the Shrine rises; its altar, the lectern or
// Technoblade's head, once it stands) with Potato King's Potatoes offers every one carried.
function offerAt(server, p) {
  const D = db(), R = D.rite, st = siteNow()
  const n = takeKings(p)
  if (!n) return
  const u = uuidOf(p)
  R.offered[u] = { name: nameOf(p), n: (R.offered[u] ? R.offered[u].n : 0) + n }
  R.total += n
  save()
  const L = risen() ? lecternPos(st) : beamGlass() || { x: st.x, y: st.y - 1, z: st.z }, at = (L.x + 0.5) + ' ' + (L.y + 1) + ' ' + (L.z + 0.5)
  run(server, 'execute in ' + st.dim + ' run particle minecraft:flame ' + at + ' 0.4 0.4 0.4 0.02 40 force')
  run(server, 'execute in ' + st.dim + ' run playsound minecraft:block.respawn_anchor.charge block @a ' + at + ' 2 1.2')
  riteTold(server, nameOf(p) + ' offers ' + n + ' Potato King\'s Potato' + (n == 1 ? '' : 'es') + (risen() ? ' at the altar. ' : ' to the beam. ') +
    Math.min(R.total, R.need) + ' of ' + R.need + '.', 'gold')
  const bands = Math.min(BANDS, Math.floor(R.total * BANDS / Math.max(1, R.need)))
  while (R.lit < bands) { riteSurge(server, R.lit); R.lit++ }
  save()
  if (R.total >= R.need && R.state == 'running') riteFull(server)
  else riteBar(server)
}
function riteFull(server) {
  const R = db().rite
  R.state = 'full'
  while (R.lit < BANDS) { riteSurge(server, R.lit); R.lit++ }
  save()
  riteBar(server)
  riteTold(server, risen() ? 'The last band catches. The Shrine burns from its feet to its crown.' : 'The beam blazes. Beneath it, something enormous stirs.', 'gold')
  console.info('[Shrine] The altar is full: ' + R.total + ' of ' + R.need)
  if (eventOn() && AUTO_AWAKEN_SECONDS > 0 && db().awake.state == 'none') { queueAutoAwaken(server); return }
  opsOnline(server).forEach(p => narrate(p, 'The altar is full. When you\'re ready: /shrine awaken', 'yellow'))
}

// --- The night's end, by itself (during the event) ---
// The Inspectors vanish, everyone is brought to the foot of the steps (GATHER_DELAY_TICKS later), and the Awakening
// begins AUTO_AWAKEN_SECONDS after that. When it's due is saved (rise.awakenAt), so a /reload or restart carries on.
function queueAutoAwaken(server) {
  const D = db()
  vanishInspectors(server)
  D.rise.awakenAt = Date.now() + GATHER_DELAY_TICKS * 50 + AUTO_AWAKEN_SECONDS * 1000
  save()
  riteTold(server, 'The Inspectors crumble to ash. Nothing stands between you and the Shrine now.', 'dark_red')
  opsOnline(server).forEach(p => narrate(p, '[Shrine] The altar is full: everyone is brought to watch, and the Awakening begins by itself in ' +
    (GATHER_DELAY_TICKS / 20 + AUTO_AWAKEN_SECONDS) + ' seconds (/shrine stop holds it).', 'yellow'))
  console.info('[Shrine] The Awakening begins by itself in ' + (GATHER_DELAY_TICKS / 20 + AUTO_AWAKEN_SECONDS) + ' seconds')
  scheduleAutoAwaken(server)
}
function scheduleAutoAwaken(server) {
  const R = db().rise
  if (!R.awakenAt) return
  const token = (global.__shrineAutoAwaken = (global.__shrineAutoAwaken || 0) + 1)
  if (Object.keys(db().awake.spots).length) startHold(server)
  else {
    let gatherIn = Math.max(1, Math.round((R.awakenAt - AUTO_AWAKEN_SECONDS * 1000 - Date.now()) / 50))
    server.scheduleInTicks(gatherIn, () => { if (token == global.__shrineAutoAwaken && db().rise.awakenAt) gatherToWatch(server) })
  }
  server.scheduleInTicks(Math.max(20, Math.round((R.awakenAt - Date.now()) / 50)), () => {
    if (token != global.__shrineAutoAwaken) return
    const D = db()
    if (!D.rise.awakenAt) return
    D.rise.awakenAt = 0
    save()
    if (D.awake.state != 'none') return
    if (!Object.keys(D.awake.spots).length) gatherToWatch(server)
    const why = awaken(server, false)
    if (why) {
      console.warn('[Shrine] The Awakening didn\'t begin by itself: ' + why)
      opsOnline(server).forEach(p => narrate(p, '[Shrine] The Awakening didn\'t begin by itself: ' + why, 'red'))
    } else console.info('[Shrine] The Awakening began by itself')
  })
}
// Every Inspector goes in a puff of smoke, and the Seniors' bars with them.
function vanishInspectors(server) {
  let all = []
  try { all = list(server.entities) } catch (e) { }
  all.forEach(e => {
    if (!hasTag(e, 'shrine_inspector')) return
    try {
      let q = pos(e)
      run(server, 'execute in ' + dimOf(e) + ' run particle minecraft:large_smoke ' + q.x + ' ' + (q.y + 1) + ' ' + q.z + ' 0.3 0.6 0.3 0.02 25 force')
      e.discard()
    } catch (err) { }
  })
  seniorBarsOff(server)
}
// The viewing spots, where everyone watches the Awakening at the beam and then the Shrine rise: in rows of VIEW.row, east
// of the site, VIEW.out blocks beyond where the steps can reach (so nobody stands where one will be laid, and the whole
// statue is in view), on the ground there.
function viewSpots(server, n) {
  const st = siteNow(), c = corner(st), lv = levelByDim(server, st.dim)
  const x0 = c.x + STAIRS.top[0] + stairSpan() + VIEW.out, zc = c.z + Math.round((STAIRS.z[0] + STAIRS.z[1]) / 2)
  const out = []
  for (let k = 0; k < n; k++) {
    let col = k % VIEW.row, row = Math.floor(k / VIEW.row)
    let x = x0 + row * VIEW.gap, z = zc + (col % 2 ? -1 : 1) * Math.ceil(col / 2) * VIEW.gap   // 0, -2, +2, -4 ...
    out.push({ x: x + 0.5, y: standY(lv, x, z, st.y), z: z + 0.5 })
  }
  return out
}
// Watchers face the beam (and the Shrine, once it rises), a little above the ground.
function facingShrine() { const m = centreOf(siteNow()); return m.x + ' ' + (m.y + VIEW.lookUp) + ' ' + m.z }
function placeWatcher(server, p, q) {
  run(server, 'execute in ' + siteNow().dim + ' run tp ' + nameOf(p) + ' ' + q.x + ' ' + q.y + ' ' + q.z + ' facing ' + facingShrine())
}
// Everyone but spectators to the viewing spots, facing the beam, to watch the Awakening and the rise; held there until
// the Shrine stands.
function gatherToWatch(server) {
  const D = db(), st = siteNow()
  const who = players(server).filter(p => { try { return !p.isSpectator() } catch (e) { return true } })
  const spots = viewSpots(server, who.length)
  D.awake.spots = {}
  who.forEach((p, k) => {
    D.awake.spots[uuidOf(p)] = spots[k]
    placeWatcher(server, p, spots[k])
    narrate(p, risen() ? 'You are drawn before the Shrine. Watch.' : 'You are drawn back from the beam. Watch.', 'dark_red')
  })
  save()
  hearAll(server, who, 'minecraft:block.beacon.power_select', 1, 0.5)
  soulColumns(server, st)
  startHold(server)
  console.info('[Shrine] Everyone brought to watch: ' + who.length)
}
// While the Awakening and the rise play (and in the moments before), anyone who wanders off their spot is put back,
// until releaseWatchers().
function startHold(server) {
  const token = (global.__shrineHold = (global.__shrineHold || 0) + 1)
  const step = () => {
    if (token != global.__shrineHold) return
    const D = db(), spots = D.awake.spots || {}
    if (!Object.keys(spots).length) return
    players(server).forEach(p => {
      let q = spots[uuidOf(p)]
      if (!q) return
      let at = pos(p)
      if (dimOf(p) != siteNow().dim || flat(at, q) > HOLD_RADIUS || Math.abs(at.y - q.y) > 4) placeWatcher(server, p, q)
    })
    server.scheduleInTicks(20, step)
  }
  server.scheduleInTicks(20, step)
}
function releaseWatchers() {
  global.__shrineHold = (global.__shrineHold || 0) + 1
  db().awake.spots = {}
  save()
}

// /shrine rite: the waves begin (or carry on, after /shrine stop). '' or why not.
function startRite(server) {
  const D = db(), R = D.rite
  if (!risen() && !D.beam.up) return 'The beam isn\'t up: the rite is fought around it (/shrine braziers, then the three fires; or /shrine beam up).'
  if (D.awake.state != 'none') return 'The Shrine has already awakened.'
  if (R.state == 'running') return 'The rite is already under way (wave ' + (R.wave + 1) + ').'
  if (R.state == 'full') return 'The altar is already full: /shrine awaken.'
  const why = otherBusy()
  if (why) return why
  const st = siteNow()
  if (R.state == 'paused') {
    R.state = 'running'
    save()
    spawnWave(server, Math.max(0, R.wave))     // the wave that was cleared away comes again
    startRiteLoop(server)
    return ''
  }
  const n = Math.max(1, presentAt(server, st).filter(pilgrim).length)
  D.rite = freshRite({})
  D.rite.state = 'running'
  D.rite.present = n
  D.rite.need = n * POTATOES_PER_PLAYER
  save()
  skyNight(server)                                // night and a storm roll in (during the event)
  riteTold(server, 'Figures gather on the land around the ' + (risen() ? 'Shrine' : 'beam') + '. They are carrying something that is not theirs.', 'dark_red')
  riteTold(server, 'Take the Potato King\'s Potatoes from the Senior Inspectors and offer them ' + (risen() ? 'at the altar' : 'to the beam, at its root') + ': ' +
    D.rite.need + ' in all.', 'gold')
  spawnWave(server, 0)
  riteBar(server)
  startRiteLoop(server)
  console.info('[Shrine] The Ignition Rite begins: ' + n + ' present, ' + D.rite.need + ' potatoes needed')
  return ''
}
// The rite by itself (AUTO_RITE_SECONDS): queued during the night's event once the beam is up and every pilgrim online
// has gathered at it (within PRESENT_RADIUS of the site). The time it's due is saved (rise.riteAt), so a /reload or
// restart in between still starts it. An op can start it sooner with /shrine rite.
function queueAutoRite(server) {
  const R = db().rise
  if (!(AUTO_RITE_SECONDS > 0) || !eventOn() || R.riteAt || db().rite.state != 'none' || db().awake.state != 'none') return false
  R.riteAt = Date.now() + AUTO_RITE_SECONDS * 1000
  save()
  nearby(server, siteNow()).forEach(p => narrate(p, 'All are gathered. Something stirs on the land around the ' + (risen() ? 'Shrine' : 'beam') + '.', 'dark_red'))
  console.info('[Shrine] Everyone is gathered at the beam: the rite begins by itself in ' + AUTO_RITE_SECONDS + ' seconds')
  scheduleAutoRite(server)
  return true
}
// Called once a second while the fires burn: every pilgrim online at the beam? Then the rite is queued.
function gatheredCheck(server) {
  const D = db()
  if (!eventOn() || !D.beam.up || D.rise.riteAt || D.rise.riteHeld || D.rite.state != 'none' || D.awake.state != 'none') return
  const all = players(server).filter(pilgrim)
  if (!all.length) return
  const here = presentAt(server, siteNow()).filter(pilgrim)
  if (here.length == all.length) queueAutoRite(server)
}
function scheduleAutoRite(server) {
  const R = db().rise
  if (!R.riteAt) return
  const token = (global.__shrineAutoRite = (global.__shrineAutoRite || 0) + 1)
  const ticks = Math.max(20, Math.round((R.riteAt - Date.now()) / 50))
  server.scheduleInTicks(ticks, () => {
    if (token != global.__shrineAutoRite) return
    const D = db()
    if (!D.rise.riteAt) return
    D.rise.riteAt = 0
    save()
    if ((!risen() && !D.beam.up) || D.rite.state != 'none' || D.awake.state != 'none' || !eventOn()) return
    const why = startRite(server)
    if (why) {
      console.warn('[Shrine] The Ignition Rite didn\'t begin by itself: ' + why)
      players(server).filter(p => { try { return p.hasPermissions(2) } catch (e) { return false } })
        .forEach(p => narrate(p, '[Shrine] The rite didn\'t begin by itself: ' + why + ' Start it with /shrine rite.', 'red'))
    } else console.info('[Shrine] The Ignition Rite began by itself, ' + AUTO_RITE_SECONDS + ' seconds after everyone gathered')
  })
}
// /shrine stop during the rite: the waves stop and the Inspectors go; the bar is kept. /shrine rite carries on.
function pauseRite(server) {
  const R = db().rite
  if (R.state != 'running') return false
  global.__shrineRite = (global.__shrineRite || 0) + 1
  R.state = 'paused'
  save()
  clearInspectors(server, 'shrine_rite')
  riteBarsOff(server)
  return true
}

// --- Knockouts: lethal damage heals the player and wakes them somewhere safe, nothing dropped. Near the Shrine while
// the rite is on: at its edge. Anywhere else while the night's event is on: beside the last brazier lit, or at the start.
function damageType(source) {
  try { return String(typeof source.getMsgId == 'function' ? source.getMsgId() : source.getType()) } catch (e) { return '' }
}
// Where a player knocked out now wakes ({ shrine }, { brazier } or { start }), or null: no rule covers them.
function wakeSpot(p) {
  const D = db(), st = siteNow()
  if (riteOn() && st && dimOf(p) == st.dim && flat(pos(p), centreOf(st)) <= PRESENT_RADIUS) return { shrine: st }
  if (!eventOn()) return null
  const b = lastLitBrazier()
  if (b) return { brazier: b }
  return D.start ? { start: D.start } : null
}
function knockout(server, p, why, to) {
  const n = nameOf(p)
  let where = ''
  try { p.setHealth(p.getMaxHealth()) } catch (e) { try { p.health = 20 } catch (e2) { } }
  try { p.clearFire() } catch (e) { }
  try { p.fallDistance = 0 } catch (e) { }
  run(server, 'effect clear ' + n)                      // as the arena and the Purge do: no wither or poison to finish the job
  if (to.shrine) {
    moveOut(server, levelByDim(server, to.shrine.dim), to.shrine, p)
    narrate(p, 'Knocked down. The Shrine will not let you fall here: you wake at its edge.', 'gray')
    where = 'the Shrine\'s edge'
  } else if (to.brazier) {
    let b = to.brazier, lv = levelByDim(server, b.dim), x = b.x + WAKE_BESIDE_FIRE, z = b.z
    let y = groundAt(lv, x, z, b.y)
    if (y === null) y = standY(lv, x, z, b.y)
    run(server, 'execute in ' + b.dim + ' run tp ' + n + ' ' + (x + 0.5) + ' ' + y + ' ' + (z + 0.5))
    narrate(p, 'Knocked down. You wake beside the last fire lit.', 'gray')
    where = 'the brazier at ' + siteText(b)
  } else {
    let s = to.start
    run(server, 'execute in ' + s.dim + ' run tp ' + n + ' ' + (s.x + 0.5) + ' ' + s.y + ' ' + (s.z + 0.5))
    narrate(p, 'Knocked down. You wake where the pilgrimage began.', 'gray')
    where = 'the start'
  }
  run(server, 'effect give ' + n + ' minecraft:resistance ' + KNOCKOUT_RESISTANCE_SECONDS + ' 4 true')
  console.info('[Shrine] Knockout: ' + n + (why ? ' (' + why + ')' : '') + ', woken at ' + where)
}
EntityEvents.death(event => {
  const e = event.entity, server = event.server || Utils.server
  let player = false
  try { player = !!e.isPlayer() } catch (err) { }
  if (player) {
    let why = damageType(event.source)
    if (why == 'genericKill') return                    // /kill still kills
    let to = wakeSpot(e)
    if (!to) return
    knockout(server, e, why, to)
    event.cancel()
    return
  }
  // an Inspector of the rite drops its potatoes (only the Seniors carry any); a Senior falls in a burst of red
  let tags = ''
  try { tags = String(e.getTags()) } catch (err) { return }
  if (tags.indexOf('shrine_rite') < 0) return
  if (tags.indexOf('shrine_senior') >= 0) {
    let q = pos(e), at = q.x + ' ' + (q.y + 1) + ' ' + q.z
    run(server, 'execute in ' + dimOf(e) + ' run particle minecraft:dust 0.8 0 0 2 ' + at + ' 0.6 1 0.6 0 120 force')
    run(server, 'execute in ' + dimOf(e) + ' run particle minecraft:flash ' + at + ' 0 0 0 0 1 force')
    run(server, 'execute in ' + dimOf(e) + ' run playsound minecraft:entity.evoker.death hostile @a ' + at + ' 3 0.6')
  }
  const m = tags.match(/shrine_pot_(\d+)/)
  if (!m) return
  dropKings(server, dimOf(e), pos(e), Number(m[1]))
})
// Only the altar takes the potatoes: they can't be eaten or planted.
ItemEvents.rightClicked(event => {
  const p = event.player
  let held = null
  try { held = event.item } catch (e) { }
  if (!held) { try { held = p.mainHandItem } catch (e) { return } }
  if (!isKingsPotato(held)) return
  narrate(p, 'Only the Shrine\'s altar will take these.', 'gray')
  event.cancel()
})
BlockEvents.rightClicked(event => {
  const p = event.player, blk = event.block
  let held = null
  try { held = event.item } catch (e) { }
  if (!held) { try { held = p.mainHandItem } catch (e) { return } }
  if (!isKingsPotato(held)) return
  let hand = ''
  try { hand = String(event.hand) } catch (e) { }
  const st = siteNow(), glass = beamGlass()
  let atAltar = false
  try {
    let d = dimKey(blk.level), x = Number(blk.x), y = Number(blk.y), z = Number(blk.z)
    atAltar = (!!st && risen() && d == st.dim && altarAt(st, x, y, z)) || (!!glass && !risen() && d == glass.dim && x == glass.x && y == glass.y && z == glass.z)
  } catch (e) { }
  if (atAltar && riteOn() && (!hand || hand.indexOf('MAIN') >= 0)) offerAt(event.server || Utils.server, p)
  else if (!atAltar) narrate(p, 'Only the beam, where it leaves the ground (or the Shrine\'s altar, once it stands), will take these.', 'gray')
  event.cancel()
})

// ===================== STAGES 0-1: THE SIGNAL AND THE SUMMONS =====================

function signalParts() {
  return [{ text: '', color: 'dark_red' }].concat(SIGNAL.map(s => s[0] ? { text: s[1], color: 'dark_red', obfuscated: true } : { text: s[1], color: 'red', italic: true }))
}
function tellSignal(p) { try { p.tell(comp(signalParts())); return true } catch (e) { return false } }
function signalOpen() { const S = db().signal; return !!S.at && Date.now() - S.at < SIGNAL_HOURS * 3600000 }
// Sends the Signal to everyone online; anyone who joins within SIGNAL_HOURS gets it too. Returns how many got it.
function sendSignal(server) {
  const told = {}
  players(server).forEach(p => { if (tellSignal(p)) told[uuidOf(p)] = nameOf(p) })
  db().signal = { at: Date.now(), told: told }
  save()
  console.info('[Shrine] The Signal went to ' + Object.keys(told).length + ' players')
  return Object.keys(told).length
}
// The Summons' pages, as written-book page text. Page 1 opens in the Blood God's red.
function summonsPages(server) {
  const page = parts => snbtString(JSON.stringify([''].concat(parts)))
  return SUMMONS.pages.map((pg, i) => {
    if (pg == 'BRAZIERS') {
      let parts = [{ text: SUMMONS.braziers + '\n\n', color: 'black' }]
      db().braziers.forEach((b, k) => {
        parts.push({ text: ordinal(k) + ': ', color: 'dark_red', italic: true }, { text: fromCastle(server, b) + (k < BRAZIERS - 1 ? '\n' : ''), color: 'black' })
      })
      return page(parts)
    }
    return page(pg.map((line, k) => ({ text: line + (k < pg.length - 1 ? '\n\n' : ''), color: i == 0 && k == 0 ? 'dark_red' : 'black', bold: i == 0 && k == 0 })))
  })
}
function summonsNbt(pages) {
  return '{title:' + snbtString(SUMMONS.title) + ',author:' + snbtString(SUMMONS.author) + ',resolved:1b,pages:[' + pages.join(',') + ']}'
}
function giveSummons(server, p) { return !!run(server, 'give ' + nameOf(p) + ' minecraft:written_book' + summonsNbt(db().summons.pages)) }
function summonsOpen() { return !!db().summons.at && db().awake.state != 'done' }
// Gives everyone online the Summons. { why } if it can't (the braziers aren't all set), else { n }.
function sendSummons(server) {
  const D = db()
  if (D.braziers.some(b => !b)) return { why: 'Set the three braziers first (/shrine brazier set <1-3>): the book gives their direction and distance from the castle.' }
  const given = {}
  D.summons = { at: Date.now(), pages: summonsPages(server), given: given }
  players(server).forEach(p => { if (giveSummons(server, p)) given[uuidOf(p)] = nameOf(p) })
  save()
  console.info('[Shrine] The Summons went to ' + Object.keys(given).length + ' players')
  return { n: Object.keys(given).length }
}
// Late arrivals: the Signal within SIGNAL_HOURS, the Summons until the Awakening. Each player once.
PlayerEvents.loggedIn(event => {
  const p = event.player, server = (p && p.server) || Utils.server
  if (!p || !server) return
  server.scheduleInTicks(JOIN_DELAY_TICKS, () => {
    try {
      let D = db(), u = uuidOf(p)
      // the night's kit: anyone joining mid-event is armed (first, so the Summons below stays in their hands); anyone
      // back after it ended gets their belongings
      if (eventOn() && !D.vaults[u]) kitUp(server, p)
      else if (!eventOn() && D.vaults[u]) unvault(server, p)
      if (signalOpen() && !D.signal.told[u] && tellSignal(p)) { D.signal.told[u] = nameOf(p); save() }
      if (summonsOpen() && !D.summons.given[u] && giveSummons(server, p)) {
        D.summons.given[u] = nameOf(p)
        save()
        narrate(p, 'A book was left for you: ' + SUMMONS.title + '.', 'dark_red')
      }
    } catch (e) { console.error('[Shrine] Join: ' + e) }
  })
})
// /kill still kills during the event (the kit drops): back from it, the kit again (their belongings are still held).
PlayerEvents.respawned(event => {
  const p = event.player, server = (p && p.server) || Utils.server
  if (!p || !server || !eventOn() || !db().vaults[uuidOf(p)]) return
  server.scheduleInTicks(2, () => { try { if (eventOn() && db().vaults[uuidOf(p)]) giveKit(p) } catch (e) { console.error('[Shrine] Respawn kit: ' + e) } })
})

// ===================== STAGE 5: THE AWAKENING =====================

function lecternPos(st) { const c = corner(st); return { x: c.x + ALTAR.lectern[0], y: c.y + ALTAR.lectern[1], z: c.z + ALTAR.lectern[2] } }
function lecternState(hasBook) { return 'minecraft:lectern[facing=' + ALTAR.facing + ',has_book=' + (hasBook ? 'true' : 'false') + ',powered=false]' }
// The book's pages, as written-book page text: the intro, then one page per relic (what it honours, what it asks). A
// relic's `after` line gets a page of its own after it: a page holds 14 lines, and the Crown's page ran over (seen on
// the test server, where "When the Crown returns, so does my name." was cut off).
function bookPages() {
  const page = parts => snbtString(JSON.stringify([''].concat(parts)))
  const pages = [page([{ text: BOOK.title.toUpperCase() + '\n\n', color: 'dark_red', bold: true }, { text: BOOK.intro, color: 'black' }])]
  RELICS.forEach(r => {
    pages.push(page([{ text: r.name.toUpperCase() + '\n\n', color: 'dark_red', bold: true }, { text: r.honours + '\n\n', color: 'black' }, { text: r.asks, color: 'dark_gray', italic: true }]))
    if (r.after) pages.push(page([{ text: r.after, color: 'dark_red' }]))
  })
  return pages
}
function bookNbt() {
  return '{Book:{id:"minecraft:written_book",Count:1b,tag:{title:' + snbtString(BOOK.title) + ',author:' + snbtString(BOOK.author) +
    ',resolved:1b,pages:[' + bookPages().join(',') + ']}},Page:0}'
}
// Empties the altar's lectern (the schematic's lectern is in its "has a book" state with no book in it).
function emptyLectern(server, st) {
  const L = lecternPos(st)
  run(server, 'execute in ' + st.dim + ' run setblock ' + L.x + ' ' + L.y + ' ' + L.z + ' ' + lecternState(false))
}
// Puts the Regalia book on the altar's lectern.
function placeBook(server, st) {
  const L = lecternPos(st)
  run(server, 'execute in ' + st.dim + ' run setblock ' + L.x + ' ' + L.y + ' ' + L.z + ' ' + lecternState(false))
  return !!run(server, 'execute in ' + st.dim + ' run setblock ' + L.x + ' ' + L.y + ' ' + L.z + ' ' + lecternState(true) + bookNbt())
}
// After the Awakening, a book taken from the lectern is put back (when its chunk is loaded, i.e. someone is near).
function startLecternWatch(server) {
  const token = (global.__shrineLectern = (global.__shrineLectern || 0) + 1)
  const step = () => {
    if (token != global.__shrineLectern) return
    const D = db()
    if (D.awake.state == 'none' || !D.regalia.open || D.rise.state != 'risen' || !D.rise.site) return   // from the book on, until a reset
    try {
      let st = D.rise.site, lv = levelByDim(server, st.dim), L = lecternPos(st)
      let loaded = false
      try { loaded = !!lv.hasChunk(Math.floor(L.x / 16), Math.floor(L.z / 16)) } catch (e) { }
      if (loaded) {
        let blk = lv.getBlock(L.x, L.y, L.z)
        if (String(blk.id) == 'minecraft:lectern' && String(blk.properties.get('has_book')) != 'true') {
          placeBook(server, st)
          console.info('[Shrine] The Regalia book was taken from the altar; another is in its place')
        }
      }
    } catch (e) { console.error('[Shrine] Lectern: ' + e) }
    server.scheduleInTicks(LECTERN_CHECK_TICKS, step)
  }
  server.scheduleInTicks(LECTERN_CHECK_TICKS, step)
}
function presentAt(server, st) {
  const m = centreOf(st)
  return players(server).filter(p => dimOf(p) == st.dim && flat(pos(p), m) <= PRESENT_RADIUS)
}
function tierThreshold(n) {
  try {
    let t = global.BloodPool.tiers.filter(x => Number(x.tier) == n)[0]
    return t ? Number(t.drops) : 0
  } catch (e) { return 0 }
}
// The Drops the Awakening raises the Pool to (POOL_AFTER): 0 if the tiers can't be read.
function poolTarget() {
  const a = tierThreshold(POOL_AFTER.past), b = tierThreshold(POOL_AFTER.past + 1)
  if (!a) return 0
  return Math.floor(a + Math.max(0, b - a) * POOL_AFTER.fraction)
}
// Raises the Pool to poolTarget(). The Drops are credited to nobody: they count toward the tiers, but go on no
// player's contribution (owner decision, 2026-11-19). Returns how many were added.
function topUpPool() {
  const BP = global.BloodPool
  if (!BP || typeof BP.addDrops != 'function') { console.warn('[Shrine] No Blood Pool: the Awakening adds no Drops'); return 0 }
  const need = Math.max(0, poolTarget() - Number(BP.drops()))
  if (!(need > 0)) return 0
  BP.addDrops(need, 'shrine', '', '')
  db().awake.added = (db().awake.added || 0) + need
  save()
  console.info('[Shrine] The Awakening added ' + need + ' Drops, credited to nobody')
  return need
}
// The Shrine breaks the seals up to OPEN_TIER: no vote. The Blood Pool opens them as /bloodpool unlock does (its title,
// line and the Nether's), then reloads. Nothing happens if they're already open.
function openSeals() {
  const BP = global.BloodPool
  if (!BP || typeof BP.openTo != 'function') { console.warn('[Shrine] The Blood Pool can\'t open tiers (an older blood_pool.js?): the seals stay for a vote or an op'); return 0 }
  let before = 0
  try { before = Number(BP.tier()) } catch (e) { }
  if (before >= OPEN_TIER) return before
  const now = Number(BP.openTo(OPEN_TIER, 'the Shrine'))
  console.info('[Shrine] The Awakening broke the seals: Tier ' + before + ' to ' + now)
  return now
}
function bloodGod(server, text) {
  players(server).forEach(p => { try { p.tell(comp([{ text: VOICE_BLOOD.tag, color: VOICE_BLOOD.tagColor, bold: true }, { text: ' ' + text, color: VOICE_BLOOD.textColor }])) } catch (e) { } })
}
// One step of the Awakening.
function awakenStep(server, s) {
  const st = siteNow(), m = centreOf(st), here = m.x + ' ' + (m.y + 23) + ' ' + m.z
  if (s.step == 'begin') {
    global.__shrineRite = (global.__shrineRite || 0) + 1         // the rite is over: its waves stop
    if (db().rite.state != 'none') { db().rite.state = 'done'; save() }
    riteBarsOff(server)
    crumbleKings(server)
    clearInspectors(server, 'shrine_inspector')
    bossbarOff(server)
    presentAt(server, st).forEach(p => {
      run(server, 'title ' + nameOf(p) + ' title ' + JSON.stringify({ text: 'The Shrine awakens', color: 'dark_red' }))
      run(server, 'execute as ' + nameOf(p) + ' at @s run playsound minecraft:block.respawn_anchor.set_spawn master @s ~ ~ ~ 1 0.6')
    })
    run(server, 'execute in ' + st.dim + ' positioned ' + m.x + ' ' + m.y + ' ' + m.z + ' run techno all @a[distance=..' + PRESENT_RADIUS + ']')
    run(server, 'superaura @a')
    soulColumns(server, st)
  } else if (s.step == 'line') {
    bloodGod(server, s.text)
    wordsOnScreen(server, s)
    godSpeaks(server, s)
    redFireworks(server, st, 3)
  } else if (s.step == 'book') {
    // The Regalia is named and /regalia opens. Its book goes on the altar: now, if the Shrine stands; when it has
    // risen, if not (the Shrine rises last).
    db().regalia.open = true
    save()
    if (risen()) bookOnAltar(server)
    else regaliaTold(server, 'The Blood God has named the Regalia of the Blade. Its book will lie on his Shrine\'s altar. ')
  } else if (s.step == 'pool') {
    // The seals first, then the Drops: Drops landing on a sealed tier make the Pool announce it ready and call for a
    // vote, a moment before the Shrine opens it anyway (seen at the rehearsal, 2026-11-19).
    openSeals()
    topUpPool()
    strikeRing(server, st.dim, m.x, m.z, st.y, 26, 8)
    redFireworks(server, st, 9)
    soulColumns(server, st)
  }
}
// The Regalia book on the altar's lectern, with sparkles and a page turning; everyone is told, with a [/regalia].
function bookOnAltar(server) {
  const st = db().rise.site
  placeBook(server, st)
  let L = lecternPos(st), at = (L.x + 0.5) + ' ' + (L.y + 1) + ' ' + (L.z + 0.5)
  run(server, 'execute in ' + st.dim + ' run particle minecraft:enchant ' + at + ' 0.6 0.6 0.6 1 120 force')
  run(server, 'execute in ' + st.dim + ' run playsound minecraft:block.enchantment_table.use block @a ' + at + ' 2 0.8')
  run(server, 'execute in ' + st.dim + ' run playsound minecraft:item.book.page_turn block @a ' + at + ' 2 0.8')
  regaliaTold(server, 'The Regalia of the Blade lies on the Shrine\'s altar. ')
  startLecternWatch(server)
}
function regaliaTold(server, text) {
  players(server).forEach(p => {
    try {
      p.tell(comp([{ text: '[REGALIA] ', color: 'gold', bold: true }, { text: text, color: 'yellow' },
        { text: '[/regalia]', color: 'gold', bold: true, clickEvent: { action: 'run_command', value: '/regalia' }, hoverEvent: { action: 'show_text', contents: 'The eight relics' } }]))
    } catch (e) { }
  })
}
// The night's last act (owner, 2026-11-19: the Shrine is the climax): once the Blood God has spoken at the beam, the
// Shrine rises over its site, watched from the viewing spots. If it can't (the layers missing, a Purge on), the night
// ends without it and the ops are told.
function riseFinale(server) {
  const why = startRise(server, false, true)
  if (!why) { console.info('[Shrine] The Shrine rises: the night\'s last act'); return }
  console.warn('[Shrine] The Shrine couldn\'t rise after the Awakening: ' + why)
  opsOnline(server).forEach(p => narrate(p, '[Shrine] The Shrine couldn\'t rise: ' + why + ' The night is over; /shrine rise raises it.', 'red'))
  finishNight(server)
}
// The Shrine stands, at the end of the night: it burns from its feet to its crown, the Regalia book goes on its altar,
// lightning and fireworks; FINALE_TICKS later the night ends.
function shrineStands(server) {
  const st = db().rise.site, m = centreOf(st), token = (global.__shrineFinale = (global.__shrineFinale || 0) + 1)
  for (let k = 0; k < BANDS; k++) lightBand(server, st, k)
  if (db().regalia.open) bookOnAltar(server)
  titleTo(server, players(server), { text: 'TECHNOBLADE\'S SHRINE', color: 'dark_red', bold: true }, { text: 'stands once more', color: 'gold' })
  hearAll(server, players(server), 'minecraft:block.end_portal.spawn', 0.8, 0.7)
  strikeRing(server, st.dim, m.x, m.z, st.y, 26, 8)
  redFireworks(server, st, 9)
  soulColumns(server, st)
  console.info('[Shrine] The Shrine stands: the night ends in ' + (FINALE_TICKS / 20) + ' seconds')
  server.scheduleInTicks(FINALE_TICKS, () => { if (token == global.__shrineFinale) finishNight(server) })
}
// The night is over: the storm passes and day comes, everyone is let go from their spots, deaths are deaths again, and
// the kit goes as everyone's belongings come back.
function finishNight(server) {
  global.__shrineFinale = (global.__shrineFinale || 0) + 1
  skyClear(server)
  releaseWatchers()
  endEvent()
  restoreAll(server)
}
function sentencesOf(text) { return (String(text).match(/[^.!?]+[.!?]+/g) || [String(text)]).map(x => x.trim()) }
// The Blood God's words on everyone's screen, a sentence at a time (LINE_TICKS apart), as well as in chat. The very last
// sentence he speaks fills the screen ("BLOOD FOR THE BLOOD GOD.").
function wordsOnScreen(server, s) {
  const parts = sentencesOf(s.text), token = global.__shrineAwaken
  parts.forEach((p, k) => server.scheduleInTicks(1 + k * LINE_TICKS, () => {
    if (token != global.__shrineAwaken) return
    if (s.last && k == parts.length - 1) titleTo(server, players(server), { text: p.toUpperCase(), color: 'dark_red', bold: true }, { text: '' })
    else titleTo(server, players(server), '', { text: p, color: 'red' })
  }))
}
// The works while he speaks (SPEAK): heartbeats and a blood mist, a growl, and with each sentence fire, lava and
// lightning. Stops if the Awakening is stopped or reloaded (its token).
function godSpeaks(server, s) {
  const st = siteNow(), m = centreOf(st), c = corner(st), top = c.y + SIZE[1], dim = st.dim, token = global.__shrineAwaken
  const parts = sentencesOf(s.text), beat = s.last ? SPEAK.lastBeat : SPEAK.beat, beats = []
  const inDim = cmd => run(server, 'execute in ' + dim + ' run ' + cmd)
  const live = () => token == global.__shrineAwaken && db().awake.state == 'running'
  hearAll(server, players(server), 'minecraft:entity.ender_dragon.growl', 0.7, 0.5)
  for (let t = 0; t < parts.length * LINE_TICKS; t += beat) beats.push(t)
  beats.forEach(t => server.scheduleInTicks(1 + t, () => {
    if (!live()) return
    hearAll(server, players(server), 'minecraft:entity.warden.heartbeat', 1, 0.8)
    inDim('particle minecraft:dust 0.6 0 0 2.5 ' + m.x + ' ' + (c.y + 24) + ' ' + m.z + ' 14 12 14 0 150 force')
  }))
  parts.forEach((p, k) => server.scheduleInTicks(1 + k * LINE_TICKS, () => {
    if (!live()) return
    inDim('particle minecraft:flame ' + m.x + ' ' + (c.y + 32) + ' ' + m.z + ' 5 30 5 0.03 600 force')
    inDim('particle minecraft:lava ' + m.x + ' ' + top + ' ' + m.z + ' 6 2 6 0 60 force')
    inDim('particle minecraft:soul_fire_flame ' + m.x + ' ' + (top - 4) + ' ' + m.z + ' 3 3 3 0.05 200 force')
    let spots = db().awake.spots || {}
    Object.keys(spots).forEach(u => { let q = spots[u]; inDim('particle minecraft:flame ' + q.x + ' ' + (q.y + 0.1) + ' ' + q.z + ' 1.5 0.05 1.5 0.01 25 force') })
    let lv = levelByDim(server, dim)
    for (let b = 0; b < SPEAK.bolts; b++) {
      let a = Math.random() * 2 * 3.14159265, x = Math.floor(m.x + Math.cos(a) * SPEAK.ring), z = Math.floor(m.z + Math.sin(a) * SPEAK.ring)
      strike(server, dim, x + 0.5, standY(lv, x, z, st.y), z + 0.5)
    }
  }))
}
// Runs the Awakening's steps from step `from` (a /reload or restart carries on where it was).
function runAwakening(server, from) {
  const token = (global.__shrineAwaken = (global.__shrineAwaken || 0) + 1)
  const A = db().awake
  const next = i => {
    if (token != global.__shrineAwaken || db().awake.state != 'running') return
    if (i >= AWAKEN_STEPS.length) {
      A.state = 'done'
      save()
      console.info('[Shrine] The Awakening is done')
      if (risen()) finishNight(server)            // it already stands (a rehearsal raised it first): the night ends
      else riseFinale(server)                     // the Shrine rises last; the night ends when it stands
      return
    }
    try { awakenStep(server, AWAKEN_STEPS[i]) } catch (e) { console.error('[Shrine] Awakening, ' + AWAKEN_STEPS[i].step + ': ' + e) }
    A.step = i + 1
    save()
    let wait = i + 1 < AWAKEN_STEPS.length ? AWAKEN_STEPS[i + 1].at - AWAKEN_STEPS[i].at : 1
    server.scheduleInTicks(Math.max(1, wait), () => next(i + 1))
  }
  server.scheduleInTicks(from == 0 ? 1 : 20, () => next(from))
}
// /shrine repair: the Shrine put back as it was built. Every layer is placed again over it (nothing is cleared, so only
// missing or broken blocks change; Technoblade's head comes back with its skin), then the altar: the Regalia book if
// it's open, an empty lectern if not. Returns false if there's no risen Shrine.
function repairShrine(server) {
  const D = db(), st = D.rise.site
  if (D.rise.state != 'risen' || !st) return false
  const c = corner(st)
  withChunks(server, st.dim, c.x, c.z, c.x + SIZE[0] - 1, c.z + SIZE[2] - 1, lv => {
    let placed = 0
    for (let n = 0; n < SIZE[1]; n++) {
      if (run(server, 'execute in ' + st.dim + ' run place template ' + STRUCTURE + '/l_' + n + ' ' + c.x + ' ' + (c.y + n) + ' ' + c.z)) placed++
    }
    if (db().regalia.open) placeBook(server, st)
    else emptyLectern(server, st)
    console.info('[Shrine] Repaired: ' + placed + ' of ' + SIZE[1] + ' layers placed again')
  })
  layStairs(server, st)                           // any missing steps go back (and a Shrine risen before them gets them)
  return true
}
// /shrine awaken. '' or why not.
function awaken(server, force) {
  const D = db(), R = D.rite
  if (!siteNow()) return 'Set the Shrine\'s site first: /shrine site set.'
  if (D.awake.state == 'running') return 'The Awakening is already under way.'
  if (D.awake.state == 'done') return 'The Shrine has already awakened. (/shrine reset confirm forgets the night, on the test server.)'
  if (R.state != 'full' && !force) return (R.state == 'none' ? 'The Ignition Rite hasn\'t been held (/shrine rite).' : 'The altar isn\'t full yet (' + R.total + ' of ' + R.need + ' potatoes).') +
    ' /shrine awaken force goes ahead anyway.'
  D.rise.awakenAt = 0                             // begun by hand while it was due: it doesn't begin twice
  global.__shrineAutoAwaken = (global.__shrineAutoAwaken || 0) + 1
  D.awake = { state: 'running', step: 0, added: 0, spots: D.awake.spots || {} }
  save()
  console.info('[Shrine] The Awakening begins')
  runAwakening(server, 0)
  return ''
}

// ===================== /regalia =====================

function relicProgress(id) { const P = db().regalia.progress[id]; return P ? P : { have: 0, by: {} } }
function regaliaLines() {
  const R = db().regalia
  if (!R.open) return null
  const restored = RELICS.filter(r => relicProgress(r.id).have >= r.need).length
  const lines = [[{ text: 'THE REGALIA OF THE BLADE', color: 'dark_red', bold: true }, { text: '   restored at the Shrine: ' + restored + ' of ' + RELICS.length, color: 'gray' }]]
  RELICS.forEach(r => {
    let P = relicProgress(r.id), done = P.have >= r.need
    let by = Object.keys(P.by).map(u => P.by[u]).sort((a, b) => b.n - a.n).slice(0, 3).map(x => x.name + ' ' + x.n)
    lines.push([{ text: (done ? ' ✔ ' : ' • '), color: done ? 'green' : 'dark_red' },
      { text: r.name, color: done ? 'green' : 'gold', hoverEvent: { action: 'show_text', contents: r.honours + '\n' + r.asks } },
      { text: '  ' + fmt(Math.min(P.have, r.need)) + ' / ' + fmt(r.need) + ' ' + r.unit + (by.length ? ' (' + by.join(', ') + ')' : ''), color: 'gray' }])
  })
  lines.push([{ text: 'Read them on the Shrine\'s altar. Hover over a relic for what it asks.', color: 'dark_gray', italic: true }])
  return lines
}

// What else is on that the Shrine mustn't overlap: a Purge or a Gladiator match. '' if nothing.
// A Purge running or counting down, or a Gladiator match. Not global.Purge.busy(): that says why a Purge can't start,
// and the Shrine itself is one of the reasons, so the Shrine would wait on itself (seen on the test server once the
// night's event kept the Shrine busy from the braziers on).
function otherBusy() {
  try {
    let P = global.Purge
    if (P && ((typeof P.active == 'function' && P.active()) || (typeof P.pending == 'function' && P.pending()))) return 'A Purge is on. The Shrine waits until it ends.'
  } catch (e) { }
  try { if (global.Gladiator && typeof global.Gladiator.busy == 'function' && global.Gladiator.busy()) return 'A Gladiator match is on. The Shrine waits until it ends.' } catch (e) { }
  return ''
}

// ===================== STATUS =====================

function statusLines(server) {
  const D = db(), R = D.rise, out = []
  out.push('Shrine site: ' + siteText(D.site) + (D.site ? '' : ' (/shrine site set, standing at its centre on the ground)'))
  for (let i = 0; i < BRAZIERS; i++) {
    let b = D.braziers[i]
    out.push('Brazier ' + (i + 1) + ': ' + (b ? siteText(b) + ', ' + fromCastle(server, b) + ' from the castle' : 'not set (/shrine brazier set ' + (i + 1) + ')'))
  }
  if (R.state == 'none') out.push('The rise: not started (the Shrine rises last, by itself, once the Blood God has spoken at the beam).' +
    (layersInstalled(server) ? '' : ' The layers are missing (kubejs/data/trollcraft/structures/shrine/).'))
  else if (R.state == 'rising') out.push('The rise: layer ' + R.next + ' of ' + SIZE[1] + ', at ' + siteText(R.site) + '.')
  else if (R.state == 'stopped') out.push('The rise: paused at layer ' + R.next + ' of ' + SIZE[1] + ' (/shrine rise carries on).')
  else out.push('The Shrine has risen, at ' + siteText(R.site) + '. ' + (D.stairs ? D.stairs + ' steps up to the altar.' : 'No steps up to the altar yet (/shrine repair lays them).'))
  const F = D.fires, ambushed = F.ambushed.filter(x => x).length
  if (F.state == 'none') out.push('The fires: not out yet (/shrine braziers, once all three sites are set).')
  else if (F.state == 'placed') out.push('The fires: out, none lit. Ambushes so far: ' + ambushed + ' of 3.')
  else if (F.state == 'counting') out.push('The fires: ' + litCount() + ' of 3 lit, ' + clock(FIRE_WINDOW_SECONDS - (Date.now() - F.firstLitAt) / 1000) + ' left. Ambushes so far: ' + ambushed + ' of 3.')
  else if (F.state == 'lit') out.push('The fires: all three burn.')
  else out.push('The fires: done (the rise has begun).')
  out.push(D.beam.up ? 'The beam: up at ' + siteText(D.beam.at) + '.' : 'The beam: down.')
  const RT = D.rite
  if (RT.state == 'none') out.push(D.rise.riteAt ? 'The Ignition Rite: begins by itself in ' + Math.max(0, Math.ceil((D.rise.riteAt - Date.now()) / 1000)) + 's (/shrine stop holds it).' :
    'The Ignition Rite: not yet. During the event it begins by itself once everyone has gathered at the beam; /shrine rite starts it by hand.')
  else if (RT.state == 'running') out.push('The Ignition Rite: wave ' + (RT.wave + 1) + ' (' + Object.keys(RT.seniors || {}).length + ' Senior Inspectors up); ' + RT.total + ' of ' + RT.need +
    ' potatoes offered; ' + RT.lit + ' of ' + BANDS + (risen() ? ' bands lit.' : ' surges of the beam.'))
  else if (RT.state == 'paused') out.push('The Ignition Rite: paused at wave ' + (RT.wave + 1) + '; ' + RT.total + ' of ' + RT.need + ' potatoes (/shrine rite carries on).')
  else if (RT.state == 'full') out.push('The Ignition Rite: the altar is full (' + RT.total + ' of ' + RT.need + '). /shrine awaken.')
  else out.push('The Ignition Rite: done (' + RT.total + ' potatoes offered).')
  const A = D.awake
  if (A.state == 'none' && D.rise.awakenAt) out.push('The Awakening: begins by itself in ' + Math.max(0, Math.ceil((D.rise.awakenAt - Date.now()) / 1000)) + 's (/shrine stop holds it).')
  else if (A.state == 'none') out.push('The Awakening: not yet. During the event it begins by itself once the altar is full; /shrine awaken by hand.')
  else if (A.state == 'running') out.push('The Awakening: under way (step ' + A.step + ' of ' + AWAKEN_STEPS.length + ').')
  else out.push('The Awakening: done. The Regalia is open; ' + (A.added > 0 ? fmt(A.added) + ' Drops added, credited to nobody.' : 'no Drops added (the Pool was already there).'))
  out.push('The start: ' + (D.start ? siteText(D.start) + ' (/shrine braziers brings everyone here)' : 'not set (/shrine start set, where everyone gathers)'))
  out.push(D.event.on ? 'The event: on. Knockouts instead of deaths for everyone, until the Awakening ends.' : 'The event: off (/shrine braziers starts it).')
  const hours = at => Math.max(0, Math.round((Date.now() - at) / 3600000))
  out.push(D.signal.at ? 'The Signal: sent ' + hours(D.signal.at) + 'h ago to ' + Object.keys(D.signal.told).length + ' players' +
    (signalOpen() ? '; anyone joining in the next ' + Math.max(1, SIGNAL_HOURS - hours(D.signal.at)) + 'h gets it too.' : '.') : 'The Signal: not sent (/shrine signal, the day before).')
  out.push(D.summons.at ? 'The Summons: given to ' + Object.keys(D.summons.given).length + ' players' + (summonsOpen() ? '; late arrivals get it until the Awakening.' : '.') :
    'The Summons: not given (/shrine summons, at the castle, once the braziers are set).')
  const held = Object.keys(D.vaults).map(u => D.vaults[u].name + (D.vaults[u].partial ? ' (partly)' : ''))
  out.push(held.length ? 'The kit: belongings held for ' + held.join(', ') + (D.event.on ? ' (handed back when the Awakening ends).' : ' (handed back when they\'re online).') :
    'The kit: nobody\'s belongings are held (/shrine braziers kits everyone in survival).')
  return out
}

// ===================== EVENTS AND COMMANDS =====================

// A restart or /reload carries on what was under way: a rise from its last layer, the fires' watch, the Awakening from
// its next step, and the lectern's watch.
function resume(server, restart) {
  const D = db()
  if (D.rise.state == 'rising') startRise(server, true)
  if (firesActive()) {
    if (restart) D.fires.sites.forEach(b => brazierForceload(server, b, true))
    startFireWatch(server)
  }
  if (riteOn()) startRiteLoop(server)
  if (D.rise.riteAt) scheduleAutoRite(server)
  if (D.rise.awakenAt) scheduleAutoAwaken(server)
  if (D.awake.state == 'running') runAwakening(server, D.awake.step)
  if (Object.keys(D.awake.spots).length) startHold(server)          // still watching (the Awakening, or the rise after it)
  // the night's end was due (the Shrine stood after the Awakening) when the /reload or restart came: end it now
  global.__shrineFinale = (global.__shrineFinale || 0) + 1
  if (D.event.on && D.awake.state == 'done' && D.rise.state == 'risen') finishNight(server)
  startKitSweep(server)
  if (D.awake.state != 'none' && D.regalia.open && D.rise.state == 'risen') startLecternWatch(server)
  if (D.rise.state == 'risen' && D.stairs) startStairGlow(server)
}
ServerEvents.loaded(event => { resume(event.server, true) })
try {
  if (Utils.server) resume(Utils.server, false)
} catch (e) { console.error('[Shrine] After reload: ' + e) }

// The braziers can't be broken (outside creative) once they're out.
BlockEvents.broken(event => {
  const blk = event.block
  let d = ''
  try { d = dimKey(blk.level) } catch (e) { return }
  if (!brazierAt(d, Number(blk.x), Number(blk.y), Number(blk.z))) return
  let creative = false
  try { creative = !!event.player.isCreative() } catch (e) { }
  if (creative) return
  try { narrate(event.player, 'The brazier will not move.', 'gray') } catch (e) { }
  event.cancel()
})

// The Shrine can't be broken or built on outside creative, and the altar (the lectern and Technoblade's head) not even in
// creative, where a stray left-click would break it (it happened on the test server). Explosions in it break nothing.
function blockInShrine(st, d, x, y, z) {
  if (!st || d != st.dim) return false
  const c = corner(st)
  return x >= c.x && x < c.x + SIZE[0] && z >= c.z && z < c.z + SIZE[2] && y >= c.y && y < c.y + SIZE[1]
}
function altarAt(st, x, y, z) { const L = lecternPos(st); return x == L.x && z == L.z && (y == L.y || y == L.y + 1) }
function guardShrine(event) {
  const st = shrineStanding(), blk = event.block, p = event.player
  if (!st || !blk) return
  let d = ''
  try { d = dimKey(blk.level) } catch (e) { return }
  const x = Number(blk.x), y = Number(blk.y), z = Number(blk.z)
  if (!blockInShrine(st, d, x, y, z)) return
  const altar = altarAt(st, x, y, z)
  let creative = false
  try { creative = !!p.isCreative() } catch (e) { }
  if (creative && !altar) return
  try { narrate(p, altar ? 'The altar will not move. (An op\'s /shrine repair puts the Shrine back.)' : 'The Shrine will not be changed.', 'gray') } catch (e) { }
  event.cancel()
}
BlockEvents.broken(event => guardShrine(event))
BlockEvents.placed(event => guardShrine(event))
// The beam's blocks (the beacon, its iron, the red glass where the potatoes are offered) can't be broken while it's up,
// outside creative.
BlockEvents.broken(event => {
  const B = db().beam, blk = event.block, p = event.player
  if (!B.up || !B.at || !blk) return
  let hit = false
  try {
    let d = dimKey(blk.level), x = Number(blk.x), y = Number(blk.y), z = Number(blk.z)
    hit = d == B.at.dim && beamCells(B.at).some(c => c.x == x && c.y == y && c.z == z)
  } catch (e) { return }
  if (!hit) return
  let creative = false
  try { creative = !!p.isCreative() } catch (e) { }
  if (creative) return
  try { narrate(p, 'The beam will not be broken.', 'gray') } catch (e) { }
  event.cancel()
})
LevelEvents.afterExplosion(event => {
  const st = shrineStanding()
  if (!st) return
  try {
    let q = { x: Math.floor(Number(event.x)), y: Math.floor(Number(event.y)), z: Math.floor(Number(event.z)) }
    if (inShrineSpace(st, dimKey(event.level), q)) event.removeAllAffectedBlocks()
  } catch (e) { }
})

ServerEvents.commandRegistry(event => {
  const Commands = event.commands, Arguments = event.arguments
  const reply = (ctx, text, bad) => {
    ctx.source.sendSystemMessage(comp([{ text: '[SHRINE] ', color: 'dark_red', bold: true }, { text: text, color: bad ? 'red' : 'gray' }]))
    return bad ? 0 : 1
  }
  const safe = fn => ctx => { try { return fn(ctx) } catch (e) { console.error('[Shrine] ' + e); return reply(ctx, 'Error: ' + e, true) } }
  const op = src => src.hasPermission(2)
  const self = ctx => ctx.source.getPlayer()
  const here = p => { const q = pos(p); return { dim: dimOf(p), x: Math.floor(q.x), y: Math.floor(q.y + 0.01), z: Math.floor(q.z) } }
  const intArg = (ctx, k) => Number(Arguments.INTEGER.getResult(ctx, k))
  // Where to set: the coordinates given (in the Overworld, so the console can do it too), or where the op stands.
  const spotOf = (ctx, given) => {
    if (given) return { dim: 'minecraft:overworld', x: intArg(ctx, 'x'), y: intArg(ctx, 'y'), z: intArg(ctx, 'z') }
    const p = self(ctx)
    return p ? here(p) : null
  }
  const awakenReply = (ctx, force) => {
    const why = awaken(ctx.source.server, force)
    if (why) return reply(ctx, why, true)
    return reply(ctx, 'The Awakening begins: the tribute, the Blood God\'s words, the Regalia named, then the seals broken up to Tier ' +
      OPEN_TIER + ' (no vote) and the Pool raised to ' + fmt(poolTarget()) + ' Drops, credited to nobody. About ' + Math.round(AWAKEN_STEPS[AWAKEN_STEPS.length - 1].at / 20) + ' seconds' +
      (risen() ? '.' : '; then the Shrine rises, and the night ends when it stands.'))
  }
  const riseReply = force => ctx => {
    const R = db().rise, resuming = R.state == 'stopped'
    const why = startRise(ctx.source.server, false, force)
    if (why) return reply(ctx, why, true)
    return reply(ctx, resuming ? 'The rise carries on from layer ' + R.next + '.' :
      'The Shrine rises: ' + SIZE[1] + ' layers in about ' + Math.round(SIZE[1] * LAYER_TICKS / 20) + ' seconds.')
  }
  const xyz = fn => Commands.argument('x', Arguments.INTEGER.create(event)).then(Commands.argument('y', Arguments.INTEGER.create(event))
    .then(Commands.argument('z', Arguments.INTEGER.create(event)).executes(safe(fn))))

  const setSite = given => ctx => {
    const st = spotOf(ctx, given)
    if (!st) return reply(ctx, 'Run this as a player, standing at the Shrine\'s centre on the ground, or give its coordinates: /shrine site set <x> <y> <z>.', true)
    const R = db().rise
    if (R.state != 'none') return reply(ctx, 'The Shrine is already ' + (R.state == 'risen' ? 'up' : 'half risen') + ' at ' + siteText(R.site) + '. It can\'t move now (/shrine reset confirm takes it down, on the test server).', true)
    db().site = st
    save()
    const c = corner(db().site)
    return reply(ctx, 'The Shrine will rise ' + (given ? 'there' : 'here') + ', centred on ' + siteText(db().site) + ': ' + SIZE[0] + ' x ' + SIZE[2] + ' blocks (' + c.x + ' ' + c.z + ' to ' +
      (c.x + SIZE[0] - 1) + ' ' + (c.z + SIZE[2] - 1) + ') and ' + SIZE[1] + ' tall. Everything in that box above the ground is cleared as it rises.')
  }
  const setStart = given => ctx => {
    const st = spotOf(ctx, given)
    if (!st) return reply(ctx, 'Run this as a player, standing where everyone should gather, or give its coordinates: /shrine start set <x> <y> <z>.', true)
    db().start = st
    save()
    return reply(ctx, 'The start is ' + (given ? 'there' : 'here') + ', at ' + siteText(st) + ': /shrine braziers brings every player here, and anyone knocked out before a brazier burns wakes here.')
  }
  const setBrazier = given => ctx => {
    const st = spotOf(ctx, given)
    if (!st) return reply(ctx, 'Run this as a player, standing where the brazier should go, or give its coordinates: /shrine brazier set <1-3> <x> <y> <z>.', true)
    const n = intArg(ctx, 'n')
    if (!(n >= 1 && n <= BRAZIERS)) return reply(ctx, 'Braziers are numbered 1 to ' + BRAZIERS + '.', true)
    db().braziers[n - 1] = st
    save()
    return reply(ctx, 'Brazier ' + n + ' set at ' + siteText(db().braziers[n - 1]) + ': the Summons will call it ' + ordinal(n - 1) + ', ' +
      fromCastle(ctx.source.server, db().braziers[n - 1]) + ' from the castle.')
  }

  event.register(Commands.literal('shrine').requires(op)
    .then(Commands.literal('status').executes(safe(ctx => {
      statusLines(ctx.source.server).forEach((l, i) => reply(ctx, l))
      return 1
    })))
    .then(Commands.literal('site').then(Commands.literal('set').executes(safe(setSite(false))).then(xyz(setSite(true)))))
    .then(Commands.literal('start').then(Commands.literal('set').executes(safe(setStart(false))).then(xyz(setStart(true)))))
    .then(Commands.literal('brazier').then(Commands.literal('set').then(Commands.argument('n', Arguments.INTEGER.create(event)).executes(safe(setBrazier(false)))
      .then(xyz(setBrazier(true))))))
    .then(Commands.literal('rise').executes(safe(riseReply(false))).then(Commands.literal('force').executes(safe(riseReply(true)))))
    .then(Commands.literal('signal').executes(safe(ctx => {
      const n = sendSignal(ctx.source.server)
      return reply(ctx, 'The Signal went to ' + n + ' player' + (n == 1 ? '' : 's') + ', each privately (not to Discord). Anyone who joins in the next ' +
        SIGNAL_HOURS + ' hours gets it too.')
    })))
    .then(Commands.literal('summons').executes(safe(ctx => {
      const server = ctx.source.server, r = sendSummons(server)
      if (r.why) return reply(ctx, r.why, true)
      return reply(ctx, 'A Summons went to ' + r.n + ' player' + (r.n == 1 ? '' : 's') + '. Late arrivals get it when they join, until the Awakening. Its fires: ' +
        db().braziers.map((b, i) => ordinal(i) + ' ' + fromCastle(server, b)).join('; ') + '.')
    })))
    .then(Commands.literal('braziers').executes(safe(ctx => {
      const why = placeBraziers(ctx.source.server)
      if (why) return reply(ctx, why, true)
      const server = ctx.source.server
      return reply(ctx, 'The braziers are going out: ' + db().fires.sites.map((b, i) => (i + 1) + ' at ' + siteText(b) + ' (' + fromCastle(server, b) + ')').join('; ') +
        '. They must all burn within ' + FIRE_WINDOW_SECONDS + ' seconds of the first. Each team is ambushed once on the way. Everyone is at the start (' + siteText(db().start) +
        '), and the event is on: knockouts instead of deaths, for everyone, until the Awakening ends.')
    })))
    .then(Commands.literal('fires')
      .then(Commands.literal('light').executes(safe(ctx => {
        if (!lightAll(ctx.source.server)) return reply(ctx, 'The braziers aren\'t out, or they already burn.', true)
        return reply(ctx, 'All three fires lit by hand. The beam goes up at the Shrine site.')
      })))
      .then(Commands.literal('out').executes(safe(ctx => {
        if (db().fires.state != 'counting') return reply(ctx, 'No fire is burning against the clock.', true)
        gutter(ctx.source.server)
        return reply(ctx, 'The fires guttered out.')
      }))))
    .then(Commands.literal('beam')
      .then(Commands.literal('up').executes(safe(ctx => {
        if (!db().site) return reply(ctx, 'Set the Shrine\'s site first (/shrine site set).', true)
        if (db().beam.up) return reply(ctx, 'The beam is already up.', true)
        raiseBeam(ctx.source.server)
        return reply(ctx, 'The beam goes up at ' + siteText(db().site) + ' (a beacon under the site, red glass in the ground). It needs open sky above; the log says if something is in the way.')
      })))
      .then(Commands.literal('down').executes(safe(ctx => {
        if (!db().beam.up) return reply(ctx, 'The beam isn\'t up.', true)
        lowerBeam(ctx.source.server, null)
        return reply(ctx, 'The beam comes down and the ground is put back.')
      }))))
    .then(Commands.literal('ambush').then(Commands.argument('player', Arguments.PLAYER.create(event)).executes(safe(ctx => {
      const p = Arguments.PLAYER.getResult(ctx, 'player')
      const n = ambush(ctx.source.server, p)
      return reply(ctx, n ? n + ' Inspectors close in on ' + nameOf(p) + '.' : 'No Inspector could be placed near ' + nameOf(p) + '.', !n)
    }))))
    .then(Commands.literal('rite').executes(safe(ctx => {
      const R = db().rite, resuming = R.state == 'paused'
      const why = startRite(ctx.source.server)
      if (why) return reply(ctx, why, true)
      return reply(ctx, resuming ? 'The rite carries on: wave ' + (db().rite.wave + 1) + ' comes again.' :
        'The Ignition Rite begins: ' + db().rite.present + ' present, so the altar needs ' + db().rite.need + ' Potato King\'s Potatoes. Waves come until it\'s full, each led by a Senior Inspector who drops ' +
        SENIOR.potatoes + ', so at least ' + Math.ceil(db().rite.need / SENIOR.potatoes) + ' must fall.')
    })))
    .then(Commands.literal('need').then(Commands.argument('n', Arguments.INTEGER.create(event)).executes(safe(ctx => {
      const R = db().rite, n = intArg(ctx, 'n')
      if (R.state != 'running' && R.state != 'paused') return reply(ctx, 'The rite isn\'t under way.', true)
      if (!(n >= 1)) return reply(ctx, 'The altar needs at least 1.', true)
      R.need = n
      save()
      if (R.total >= R.need && R.state == 'running') riteFull(ctx.source.server)
      else if (R.state == 'running') riteBar(ctx.source.server)
      return reply(ctx, 'The altar now needs ' + n + ' potatoes (' + R.total + ' offered).')
    }))))
    .then(Commands.literal('awaken').executes(safe(ctx => awakenReply(ctx, false)))
      .then(Commands.literal('force').executes(safe(ctx => awakenReply(ctx, true)))))
    .then(Commands.literal('repair').executes(safe(ctx => {
      if (!repairShrine(ctx.source.server)) return reply(ctx, 'There is no risen Shrine to repair.', true)
      return reply(ctx, 'The Shrine is put back as it was built: every layer placed again, Technoblade\'s head included' +
        (db().regalia.open ? ', the Regalia book on the altar' : '') + ', and any missing steps up to it.')
    })))
    .then(Commands.literal('book').executes(safe(ctx => {
      const st = shrineStanding()
      if (!st || db().rise.state != 'risen') return reply(ctx, 'The Shrine hasn\'t risen.', true)
      return placeBook(ctx.source.server, st) ? reply(ctx, 'The Regalia book is on the altar.') : reply(ctx, 'The lectern couldn\'t be set (is its chunk loaded?).', true)
    })))
    .then(Commands.literal('clearmobs').executes(safe(ctx => {
      const st = shrineStanding()
      if (!st) return reply(ctx, 'There is no Shrine standing.', true)
      const n = sweepMonsters(ctx.source.server, st)
      return reply(ctx, n ? 'Took away ' + n + ' monster' + (n == 1 ? '' : 's') + ' from the Shrine. (Event mobs and named ones stay.)' : 'No monsters in the Shrine.')
    })))
    .then(Commands.literal('stop').executes(safe(ctx => {
      if (stopRise()) return reply(ctx, 'The rise is paused at layer ' + db().rise.next + '. /shrine rise carries on.')
      if (db().rise.riteAt) {
        db().rise.riteAt = 0
        db().rise.riteHeld = true                 // and it isn't queued again (everyone is still gathered)
        global.__shrineAutoRite = (global.__shrineAutoRite || 0) + 1
        save()
        return reply(ctx, 'The rite won\'t begin by itself. Start it with /shrine rite.')
      }
      if (db().rise.awakenAt) {
        db().rise.awakenAt = 0
        global.__shrineAutoAwaken = (global.__shrineAutoAwaken || 0) + 1
        releaseWatchers()
        return reply(ctx, 'The Awakening won\'t begin by itself, and everyone is free to move. Start it with /shrine awaken.')
      }
      if (pauseRite(ctx.source.server)) return reply(ctx, 'The rite is paused: the waves stop and the Inspectors are gone; the altar keeps its ' + db().rite.total + ' potatoes. /shrine rite carries on.')
      return reply(ctx, 'Nothing is running.', true)
    })))
    .then(Commands.literal('reset').executes(safe(ctx => reply(ctx, 'This takes the Shrine down and forgets the night (the sites are kept). For the test server. To do it: /shrine reset confirm', true)))
      .then(Commands.literal('confirm').executes(safe(ctx => {
        const st = db().rise.site
        resetShrine(ctx.source.server, () => { })
        return reply(ctx, st ? 'Taking the Shrine down at ' + siteText(st) + '. The sites are kept.' : 'Nothing was built. The night is forgotten; the sites are kept.')
      })))))

  // /regalia, for everyone: the eight relics and how far each has come (opened at the Awakening).
  event.register(Commands.literal('regalia').executes(safe(ctx => {
    const lines = regaliaLines()
    if (!lines) {
      ctx.source.sendSystemMessage(comp([{ text: '[REGALIA] ', color: 'gold', bold: true }, { text: 'The Blood God has named nothing yet.', color: 'gray' }]))
      return 1
    }
    lines.forEach(l => ctx.source.sendSystemMessage(comp(l)))
    return 1
  })))
})

// ===================== API =====================

global.Shrine = {
  // Why a Purge or a match should wait ('' if they needn't): for now, only while the Shrine is rising.
  busy: () => (db().rise.state == 'rising' ? 'the Shrine is rising' : riteOn() ? 'the Ignition Rite is on at the Shrine' : eventOn() ? 'the Shrine Awakens is on' : ''),
  eventOn: () => eventOn(),
  riteOn: () => riteOn(),
  isKingsPotato: s => isKingsPotato(s),
  state: () => JSON.parse(JSON.stringify(db())),
  site: () => db().site,
  risen: () => db().rise.state == 'risen',
  fires: () => db().fires.state,                     // none, placed, counting, lit or done
  beamUp: () => !!db().beam.up,
  awakened: () => db().awake.state == 'done',
  fromCastle: st => fromCastle(Utils.server, st),
}
// The relic hunt (Act II builds the deliveries on this): whether it's open, the relics, and each one's progress.
global.Regalia = {
  isOpen: () => !!db().regalia.open,
  relics: RELICS,
  progress: id => JSON.parse(JSON.stringify(relicProgress(String(id)))),
}

})()
