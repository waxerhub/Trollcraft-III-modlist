// priority: 100
// (Loads before the other scripts, so a knockout at the Shrine is cancelled before any of their death handlers see it:
// a knockout is no kill for bounties, Souls, Grit and the rest. The Gladiator Arena does the same.)
// The Shrine Awakens (Part II, Act I #36): one big evening, run live by ops, in which Technoblade's Shrine rises out of
// the ground and the Blood God names the Regalia of the Blade. Every stage is one op command (see
// tools/kubejs/SHRINE.md).
//
// Built so far:
//   - The sites, set where an op stands: /shrine site set (the Shrine's centre, at ground level) and
//     /shrine brazier set <1-3>, or at coordinates in the Overworld (/shrine site set <x> <y> <z>, also from the
//     console). /shrine status shows them, each brazier's direction and distance from the castle (world spawn), and the
//     stage.
//   - Stage 3, the rise (/shrine rise): the Shrine builds itself from the ground up, one layer of the statue every
//     LAYER_TICKS, from kubejs/data/trollcraft/structures/shrine/l_0 .. l_63. Each layer's slice is cleared first, so
//     the ground and anything on it give way. Players in the footprint are moved to its edge. Rumbles, dust and smoke at
//     every layer, and thunder when the pedestal is done and when the head is placed. A /reload or restart carries on
//     from the last layer. /shrine stop pauses it (/shrine rise carries on).
//   - /shrine reset confirm (the test server): takes the Shrine down and forgets the night. The sites are kept.
//   - No monsters spawn in or right around the Shrine once any of it stands (event mobs and named ones are let be);
//     those already there are taken away as it starts and finishes rising, or with /shrine clearmobs.
//   - Stage 2, the pilgrimage (/shrine braziers): a brazier (an unlit campfire on a blackstone plinth) at each of the
//     three sites. The first one lit starts a 60-second clock (a boss bar for everyone); if all three aren't burning
//     by then, they gutter out and the teams try again. When all three burn they stay lit, and a red beacon beam rises
//     at the Shrine site (the beacon, its iron and red glass go under the site; what they replace is put back when the
//     rise begins). The braziers can't be broken outside creative. /shrine fires light|out, /shrine beam up|down.
//   - The ambushes: the Shrine's own Inspectors (Part II has no portal_ambush.js). The first pilgrim within 200
//     blocks of a brazier that isn't lit is ambushed there once, with anyone near them; /shrine ambush <player> for more.
//     Deaths in an ambush are ordinary. Ambushers left over are taken away when the rise begins.
//   - Stage 5, the Awakening (/shrine awaken, once the Shrine has risen): the Techno Tribute and a server-wide
//     /superaura, the Blood God's words, the Regalia book on the altar's lectern (put back if taken), /regalia opened,
//     and the Pool topped up to Tier 3, credited by the potatoes offered (or shared by those present), with the vote.
//     /regalia (anyone) lists the eight relics. The Shrine can't be broken or built on outside creative, nor its altar
//     even in creative; /shrine repair puts it back as it was built.
// Still to come: the Signal and the Summons, and the Ignition Rite.
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
// The waves: per = Inspectors per player present (at least min, at most WAVE_MAX), their armour, shields on the
// vindicators, and how many potatoes each one drops. The last wave brings the Senior Inspector.
const WAVES = [
  { per: 1, min: 3, armour: 'iron', potatoes: 2 },
  { per: 1.5, min: 3, armour: 'iron', shields: true, potatoes: 2 },
  { per: 1, min: 3, armour: 'diamond', potatoes: 2 },
  { per: 1, min: 3, armour: 'diamond', potatoes: 2, senior: true },
]
const WAVE_MAX = 12
const WAVE_RING = [30, 45]                // they appear this many blocks from the Shrine's centre, on the ground
const SURFACE_SCAN = [40, 20]             // Inspectors' ground: looked for from 40 above the site's height to 20 below
const SPAWN_TRIES = 12                    // spots tried for each Inspector (not in water, a cave or a tree) before falling back
const NEXT_WAVE = { share: 0.75, minutes: 3 }   // the next wave: once this share of the last is down, or after this long
const SENIOR = { name: 'Senior Inspector', health: 150, potatoes: 8, helpers: 2 }   // helpers: called at half health
const KINGS_POTATO = { name: 'Potato King\'s Potato', lore: 'Technoblade\'s own. Hoarded by the Inspectors.' }
const BANDS = 4                           // the statue lights up in this many bands, one per quarter of the bar
const LIGHT_SPACING = 4                   // in a lit band, a light block every this many blocks (where there's air)
const KNOCKOUT_RESISTANCE_SECONDS = 3     // after a knockout at the Shrine
const RITE_BOSSBAR = 'trollcraft:shrine_rite', SENIOR_BOSSBAR = 'trollcraft:shrine_senior'

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
const TOP_UP_TIER = 3                     // the Pool is topped up to this tier's threshold (the Nether's seal)
// The Awakening's steps, in ticks from /shrine awaken: the tribute first (/techno all takes about 25 seconds), then the
// Blood God's words, the book on the altar, the third seal, and the Pool.
const AWAKEN_STEPS = [
  { at: 0, step: 'begin' },
  { at: 560, step: 'line', text: 'You lit my fires. You fed my Shrine. You remembered.' },
  { at: 680, step: 'line', text: 'Eight things were mine. They were scattered, stolen, forgotten. Restore them here, and my name returns with them.' },
  { at: 760, step: 'book' },
  { at: 880, step: 'line', text: 'The third seal is yours to break.' },
  { at: 920, step: 'pool' },
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

// ===================== STATE =====================

let Serializer = null, ResourceLocation = null
try { Serializer = Java.loadClass('net.minecraft.network.chat.Component$Serializer') } catch (e) { }
try { ResourceLocation = Java.loadClass('net.minecraft.resources.ResourceLocation') } catch (e) { }
let data = null
// D.site: the Shrine's centre at ground level { dim, x, y, z }. D.braziers: [site or null] x 3. D.rise: { state:
// 'none' | 'rising' | 'stopped' | 'risen', next: the next layer to place, site: where it's rising }.
// D.fires: { state: 'none' | 'placed' | 'counting' | 'lit' | 'done', sites: the braziers as built, built, lit and
// ambushed: [bool] x 3, firstLitAt: ms }. D.beam: { up, at: the site, saved: [{ x, y, z, state }] it replaced }.
// The loops' tokens are on global, so a /reload stops the old ones.
function freshFires() { return { state: 'none', sites: [], built: [false, false, false], lit: [false, false, false], litAt: [0, 0, 0], ambushed: [false, false, false], firstLitAt: 0 } }
// D.rite: { state: 'none' | 'running' | 'paused' | 'full' | 'done', offered: uuid -> { name, n } (potatoes offered at the
// altar), total, need, present (players counted at the start), wave (the last one sent, -1 none), waveAt, waveSize,
// lit (bands lit), seniorUp, seniorCalled }.
function freshRite(offered) {
  return { state: 'none', offered: offered || {}, total: 0, need: 0, present: 0, wave: -1, waveAt: 0, waveSize: 0, lit: 0, seniorUp: false, seniorCalled: false }
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
  if (!data.awake) data.awake = { state: 'none', step: 0, credited: {} }   // state: none, running or done
  if (!data.regalia) data.regalia = { open: false, progress: {} }          // progress: relic id -> { have, by: { uuid: { name, n } } }
  if (!data.rite || !data.rite.state) data.rite = freshRite((data.rite && data.rite.offered) || {})
  if (!(data.stairs >= 0)) data.stairs = 0                                 // the steps to the altar laid (0: none)
  if (data.start === undefined) data.start = null                          // the start: { dim, x, y, z }
  if (!data.event) data.event = { on: false, at: 0 }                       // the night's event: knockouts for everyone
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
  if (!resumed && !force && R.state == 'none' && !D.beam.up) {
    return 'The beam isn\'t up yet: the braziers come first (/shrine braziers), and the Shrine rises under the beam. /shrine rise force raises it anyway.'
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
      return
    }
    save()
    server.scheduleInTicks(LAYER_TICKS, step)
  }
  if (first && !resumed) {
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
  D.awake = { state: 'none', step: 0, credited: {} }
  D.regalia = { open: false, progress: {} }
  D.rite = freshRite({})
  D.event = { on: false, at: 0 }
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
// Every player online goes to the start, wherever they are.
function gatherAll(server) {
  const s = db().start
  players(server).forEach(p => {
    run(server, 'execute in ' + s.dim + ' run tp ' + nameOf(p) + ' ' + (s.x + 0.5) + ' ' + s.y + ' ' + (s.z + 0.5))
    narrate(p, 'The pilgrimage begins. Until the Shrine awakens, falling is not the end: you wake by the last fire lit, or here.', 'dark_red')
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
  if (changed) save()
}
function allLit(server) {
  db().fires.state = 'lit'
  save()
  bossbar(server, { text: 'Three fires burn as one', color: 'gold' }, FIRE_WINDOW_SECONDS, 'yellow')
  server.scheduleInTicks(120, () => { if (db().fires.state != 'counting') bossbarOff(server) })
  narrateAll(server, 'Three fires burn as one. Above the land, a red light rises toward the sky.', 'gold')
  players(server).forEach(p => run(server, 'execute as ' + nameOf(p) + ' at @s run playsound minecraft:block.beacon.activate master @s ~ ~ ~ 1 0.8'))
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
function riteTold(server, text, color) { presentAt(server, db().rise.site).forEach(p => narrate(p, text, color)) }
function spawnWave(server, i) {
  const D = db(), R = D.rite, st = D.rise.site, w = WAVES[i], lv = levelByDim(server, st.dim)
  const n = waveSize(w, R.present)
  let made = 0
  for (let k = 0; k < n; k++) {
    let q = ringSpot(lv, st, WAVE_RING[0], WAVE_RING[1], k * 2 * 3.14159265 / n + Math.random() * 0.5)
    if (summonInspector(server, st.dim, q.x, q.y, q.z, k % 3 == 2 ? 'pillager' : 'vindicator', 'shrine_rite',
      { armour: w.armour, shield: w.shields, tags: ['shrine_wave_' + i, 'shrine_pot_' + w.potatoes] })) made++
  }
  if (w.senior) {
    let q = ringSpot(lv, st, WAVE_RING[0], WAVE_RING[1], Math.random() * 2 * 3.14159265)
    if (summonInspector(server, st.dim, q.x, q.y, q.z, 'vindicator', 'shrine_rite',
      { armour: 'diamond', axe: 'minecraft:netherite_axe', name: SENIOR.name, health: SENIOR.health, tags: ['shrine_wave_' + i, 'shrine_senior', 'shrine_pot_' + SENIOR.potatoes] })) {
      made++
      R.seniorUp = true
      run(server, 'effect give @e[tag=shrine_senior] minecraft:resistance infinite 0 true')
      run(server, 'bossbar add ' + SENIOR_BOSSBAR + ' ' + JSON.stringify({ text: SENIOR.name, color: 'gold', bold: true }))
      run(server, 'bossbar set ' + SENIOR_BOSSBAR + ' color yellow')
      run(server, 'bossbar set ' + SENIOR_BOSSBAR + ' max ' + SENIOR.health)
      run(server, 'bossbar set ' + SENIOR_BOSSBAR + ' value ' + SENIOR.health)
      run(server, 'bossbar set ' + SENIOR_BOSSBAR + ' players @a')
    }
  }
  R.wave = i
  R.waveAt = Date.now()
  R.waveSize = made
  save()
  riteTold(server, 'Wave ' + (i + 1) + ' of ' + WAVES.length + ': ' + made + ' Inspectors close in on the Shrine' + (w.senior ? ', a Senior Inspector at their head.' : '.'), 'gold')
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
function hasTag(e, t) { try { return String(e.getTags()).indexOf(t) >= 0 } catch (err) { return false } }
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
function riteBarsOff(server) {
  run(server, 'bossbar remove ' + RITE_BOSSBAR)
  run(server, 'bossbar remove ' + SENIOR_BOSSBAR)
}
// Once a second during the rite: Inspectors go after the pilgrims at the Shrine, the Senior Inspector's bar and his
// call for help, and the next wave (once NEXT_WAVE.share of the last is down, or after NEXT_WAVE.minutes).
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
  const D = db(), R = D.rite, st = D.rise.site
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
  // the Senior Inspector
  const senior = alive.filter(m => hasTag(m, 'shrine_senior'))[0]
  if (senior) {
    let hp = SENIOR.health
    try { hp = Number(senior.getHealth()) } catch (e) { }
    run(server, 'bossbar set ' + SENIOR_BOSSBAR + ' value ' + Math.max(0, Math.round(hp)))
    if (!R.seniorCalled && hp <= SENIOR.health / 2) {
      R.seniorCalled = true
      save()
      let lv = levelByDim(server, st.dim), q = pos(senior)
      for (let k = 0; k < SENIOR.helpers; k++) {
        let a = k * 3.14159265 + Math.random(), x = Math.floor(q.x + Math.cos(a) * 4), z = Math.floor(q.z + Math.sin(a) * 4)
        summonInspector(server, st.dim, x + 0.5, standY(lv, x, z, Math.floor(q.y)), z + 0.5, 'vindicator', 'shrine_rite',
          { armour: 'diamond', tags: ['shrine_wave_' + R.wave, 'shrine_pot_' + WAVES[WAVES.length - 1].potatoes] })
      }
      riteTold(server, 'The Senior Inspector calls for assistance.', 'gold')
    }
  } else if (R.seniorUp) {
    R.seniorUp = false
    save()
    run(server, 'bossbar remove ' + SENIOR_BOSSBAR)
    riteTold(server, 'The Senior Inspector falls. His clipboard does not.', 'gold')
  }
  // the next wave
  if (R.state == 'running' && R.wave < WAVES.length - 1) {
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
  })
}
// Right-clicking the altar (the lectern or Technoblade's head) with Potato King's Potatoes offers every one carried.
function offerAt(server, p) {
  const D = db(), R = D.rite, st = D.rise.site
  const n = takeKings(p)
  if (!n) return
  const u = uuidOf(p)
  R.offered[u] = { name: nameOf(p), n: (R.offered[u] ? R.offered[u].n : 0) + n }
  R.total += n
  save()
  const L = lecternPos(st), at = (L.x + 0.5) + ' ' + (L.y + 1) + ' ' + (L.z + 0.5)
  run(server, 'execute in ' + st.dim + ' run particle minecraft:flame ' + at + ' 0.4 0.4 0.4 0.02 40 force')
  run(server, 'execute in ' + st.dim + ' run playsound minecraft:block.respawn_anchor.charge block @a ' + at + ' 2 1.2')
  riteTold(server, nameOf(p) + ' offers ' + n + ' Potato King\'s Potato' + (n == 1 ? '' : 'es') + ' at the altar. ' + Math.min(R.total, R.need) + ' of ' + R.need + '.', 'gold')
  const bands = Math.min(BANDS, Math.floor(R.total * BANDS / Math.max(1, R.need)))
  while (R.lit < bands) { lightBand(server, st, R.lit); R.lit++ }
  save()
  if (R.total >= R.need && R.state == 'running') riteFull(server)
  else riteBar(server)
}
function riteFull(server) {
  const R = db().rite, st = db().rise.site
  R.state = 'full'
  while (R.lit < BANDS) { lightBand(server, st, R.lit); R.lit++ }
  save()
  riteBar(server)
  riteTold(server, 'The last band catches. The Shrine burns from its feet to its crown.', 'gold')
  players(server).forEach(p => {
    let isOp = false
    try { isOp = !!p.hasPermissions(2) } catch (e) { }
    if (isOp) narrate(p, 'The altar is full. When you\'re ready: /shrine awaken', 'yellow')
  })
  console.info('[Shrine] The altar is full: ' + R.total + ' of ' + R.need)
}

// /shrine rite: the waves begin (or carry on, after /shrine stop). '' or why not.
function startRite(server) {
  const D = db(), R = D.rite
  if (D.rise.state != 'risen') return 'The Shrine hasn\'t risen yet (/shrine rise).'
  if (D.awake.state != 'none') return 'The Shrine has already awakened.'
  if (R.state == 'running') return 'The rite is already under way (wave ' + (R.wave + 1) + ' of ' + WAVES.length + ').'
  if (R.state == 'full') return 'The altar is already full: /shrine awaken.'
  const why = otherBusy()
  if (why) return why
  const st = D.rise.site
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
  riteTold(server, 'Figures gather on the land around the Shrine. They are carrying something that is not theirs.', 'dark_red')
  riteTold(server, 'Take the Potato King\'s Potatoes from the Inspectors and offer them at the altar: ' + D.rite.need + ' in all.', 'gold')
  spawnWave(server, 0)
  riteBar(server)
  startRiteLoop(server)
  console.info('[Shrine] The Ignition Rite begins: ' + n + ' present, ' + D.rite.need + ' potatoes needed')
  return ''
}
// /shrine stop during the rite: the waves stop and the Inspectors go; the bar is kept. /shrine rite carries on.
function pauseRite(server) {
  const R = db().rite
  if (R.state != 'running') return false
  global.__shrineRite = (global.__shrineRite || 0) + 1
  R.state = 'paused'
  R.seniorUp = false
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
  const D = db(), st = D.rise.site
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
  // an Inspector of the rite drops its potatoes
  let tags = ''
  try { tags = String(e.getTags()) } catch (err) { return }
  const m = tags.match(/shrine_pot_(\d+)/)
  if (!m || tags.indexOf('shrine_rite') < 0) return
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
  const st = db().rise.site
  let atAltar = false
  try { atAltar = !!st && db().rise.state == 'risen' && dimKey(blk.level) == st.dim && altarAt(st, Number(blk.x), Number(blk.y), Number(blk.z)) } catch (e) { }
  if (atAltar && riteOn() && (!hand || hand.indexOf('MAIN') >= 0)) offerAt(event.server || Utils.server, p)
  else if (!atAltar) narrate(p, 'Only the Shrine\'s altar will take these.', 'gray')
  event.cancel()
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
// Tops the Pool up to Tier TOP_UP_TIER's threshold, credited by the potatoes each player offered at the altar (or, if
// nobody offered any, shared by those present). Returns { added, shares: [{ name, n }] }.
function topUpPool(server, present) {
  const BP = global.BloodPool
  if (!BP || typeof BP.addDrops != 'function') { console.warn('[Shrine] No Blood Pool: the Awakening adds no Drops'); return { added: 0, shares: [] } }
  const target = tierThreshold(TOP_UP_TIER), need = Math.max(0, target - Number(BP.drops()))
  if (!(need > 0)) return { added: 0, shares: [] }
  const offered = db().rite.offered || {}
  let shares = Object.keys(offered).filter(u => offered[u].n > 0).map(u => ({ uuid: u, name: offered[u].name, w: offered[u].n }))
  if (!shares.length) shares = present.map(p => ({ uuid: uuidOf(p), name: nameOf(p), w: 1 }))
  if (!shares.length) { BP.addDrops(need, 'shrine', '', ''); return { added: need, shares: [] } }
  const W = shares.reduce((a, s) => a + s.w, 0)
  let given = 0
  shares.forEach(s => { s.n = Math.floor(need * s.w / W); given += s.n })
  shares.sort((a, b) => b.w - a.w)
  shares[0].n += need - given                       // what rounding left over goes to the biggest share
  const credited = db().awake.credited
  shares.forEach(s => {
    if (s.n <= 0) return
    BP.addDrops(s.n, 'shrine', s.uuid, s.name)
    credited[s.uuid] = { name: s.name, n: (credited[s.uuid] ? credited[s.uuid].n : 0) + s.n }
  })
  save()
  console.info('[Shrine] The Awakening added ' + need + ' Drops: ' + shares.map(s => s.name + ' ' + s.n).join(', '))
  return { added: need, shares: shares.map(s => ({ name: s.name, n: s.n })) }
}
function bloodGod(server, text) {
  players(server).forEach(p => { try { p.tell(comp([{ text: VOICE_BLOOD.tag, color: VOICE_BLOOD.tagColor, bold: true }, { text: ' ' + text, color: VOICE_BLOOD.textColor }])) } catch (e) { } })
}
// One step of the Awakening.
function awakenStep(server, s) {
  const st = db().rise.site, m = centreOf(st), here = m.x + ' ' + (m.y + 23) + ' ' + m.z
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
  } else if (s.step == 'line') {
    bloodGod(server, s.text)
  } else if (s.step == 'book') {
    placeBook(server, st)
    let L = lecternPos(st), at = (L.x + 0.5) + ' ' + (L.y + 1) + ' ' + (L.z + 0.5)
    run(server, 'execute in ' + st.dim + ' run particle minecraft:enchant ' + at + ' 0.6 0.6 0.6 1 120 force')
    run(server, 'execute in ' + st.dim + ' run playsound minecraft:block.enchantment_table.use block @a ' + at + ' 2 0.8')
    run(server, 'execute in ' + st.dim + ' run playsound minecraft:item.book.page_turn block @a ' + at + ' 2 0.8')
    db().regalia.open = true
    save()
    players(server).forEach(p => {
      try {
        p.tell(comp([{ text: '[REGALIA] ', color: 'gold', bold: true }, { text: 'The Regalia of the Blade lies on the Shrine\'s altar. ', color: 'yellow' },
          { text: '[/regalia]', color: 'gold', bold: true, clickEvent: { action: 'run_command', value: '/regalia' }, hoverEvent: { action: 'show_text', contents: 'The eight relics' } }]))
      } catch (e) { }
    })
    startLecternWatch(server)
  } else if (s.step == 'pool') {
    let present = presentAt(server, st)
    topUpPool(server, present)
    let open = 0
    try { open = Number(global.BloodPool.tier()) } catch (e) { }
    if (open < TOP_UP_TIER) {
      present.forEach(p => {
        try {
          p.tell(comp([{ text: 'Everyone here: break the third seal together. ', color: 'gray', italic: true },
            { text: '[/bloodpool vote]', color: 'dark_red', bold: true, clickEvent: { action: 'run_command', value: '/bloodpool vote' }, hoverEvent: { action: 'show_text', contents: 'Five voices break it' } }]))
        } catch (e) { }
      })
    }
  }
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
      endEvent()
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
  if (D.rise.state != 'risen') return 'The Shrine hasn\'t risen yet (/shrine rise).'
  if (D.awake.state == 'running') return 'The Awakening is already under way.'
  if (D.awake.state == 'done') return 'The Shrine has already awakened. (/shrine reset confirm forgets the night, on the test server.)'
  if (R.state != 'full' && !force) return (R.state == 'none' ? 'The Ignition Rite hasn\'t been held (/shrine rite).' : 'The altar isn\'t full yet (' + R.total + ' of ' + R.need + ' potatoes).') +
    ' /shrine awaken force goes ahead anyway.'
  D.awake = { state: 'running', step: 0, credited: {} }
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
  if (R.state == 'none') out.push('The rise: not started (/shrine rise, once the beam is up).' + (layersInstalled(server) ? '' : ' The layers are missing (kubejs/data/trollcraft/structures/shrine/).'))
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
  if (RT.state == 'none') out.push('The Ignition Rite: not yet (/shrine rite, once the Shrine has risen).')
  else if (RT.state == 'running') out.push('The Ignition Rite: wave ' + (RT.wave + 1) + ' of ' + WAVES.length + '; ' + RT.total + ' of ' + RT.need + ' potatoes offered; ' + RT.lit + ' of ' + BANDS + ' bands lit.')
  else if (RT.state == 'paused') out.push('The Ignition Rite: paused at wave ' + (RT.wave + 1) + '; ' + RT.total + ' of ' + RT.need + ' potatoes (/shrine rite carries on).')
  else if (RT.state == 'full') out.push('The Ignition Rite: the altar is full (' + RT.total + ' of ' + RT.need + '). /shrine awaken.')
  else out.push('The Ignition Rite: done (' + RT.total + ' potatoes offered).')
  const A = D.awake, credited = Object.keys(A.credited || {}).map(u => A.credited[u])
  if (A.state == 'none') out.push('The Awakening: not yet (/shrine awaken, once the Shrine has risen).')
  else if (A.state == 'running') out.push('The Awakening: under way (step ' + A.step + ' of ' + AWAKEN_STEPS.length + ').')
  else out.push('The Awakening: done. The Regalia is open' + (credited.length ? '; Drops credited: ' + credited.map(c => c.name + ' ' + fmt(c.n)).join(', ') : '') + '.')
  out.push('The start: ' + (D.start ? siteText(D.start) + ' (/shrine braziers brings everyone here)' : 'not set (/shrine start set, where everyone gathers)'))
  out.push(D.event.on ? 'The event: on. Knockouts instead of deaths for everyone, until the Awakening ends.' : 'The event: off (/shrine braziers starts it).')
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
  if (D.awake.state == 'running') runAwakening(server, D.awake.step)
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
    return reply(ctx, 'The Awakening begins: the tribute, the Blood God\'s words, the Regalia book on the altar, then the Pool topped up to Tier ' + TOP_UP_TIER +
      ' (' + fmt(tierThreshold(TOP_UP_TIER)) + ' Drops) and the vote. About ' + Math.round(AWAKEN_STEPS[AWAKEN_STEPS.length - 1].at / 20) + ' seconds.')
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
        'The Ignition Rite begins: ' + db().rite.present + ' present, so the altar needs ' + db().rite.need + ' Potato King\'s Potatoes. ' + WAVES.length + ' waves, the last with the Senior Inspector.')
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
