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
// Still to come: the Signal and the Summons, the Ignition Rite and the Awakening.
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
function freshFires() { return { state: 'none', sites: [], built: [false, false, false], lit: [false, false, false], ambushed: [false, false, false], firstLitAt: 0 } }
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
// Somewhere to stand in the column at x, z: the top of the ground near the site's height (two open blocks over a solid
// one). Falls back to the site's own height.
function standY(lv, x, z, around) {
  if (!lv) return around
  for (let y = around + 20; y >= around - 20; y--) {
    let below = '', feet = '', head = ''
    try { below = lv.getBlock(x, y - 1, z).id; feet = lv.getBlock(x, y, z).id; head = lv.getBlock(x, y + 1, z).id } catch (e) { return around }
    if (!isOpen(below) && isOpen(feet) && isOpen(head)) return y
  }
  return around
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
// Starts the rise (or carries it on from R.next). Returns '' or why not.
function startRise(server, resumed) {
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
      forceload(server, st, false)
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
  resetFires(server)
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
  D.fires = freshFires()
  D.fires.state = 'placed'
  D.fires.sites = D.braziers.map(b => ({ dim: b.dim, x: b.x, y: b.y, z: b.z }))
  save()
  D.fires.sites.forEach(b => brazierForceload(server, b, true))   // kept loaded while the fires are watched
  startFireWatch(server)
  console.info('[Shrine] The braziers are out')
  return ''
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

function inspectorNbt(kind, tag) {
  const armour = ['boots', 'leggings', 'chestplate', 'helmet'].map(s => '{id:"minecraft:' + INSPECTOR.armour + '_' + s + '",Count:1b}')
  const hand = kind == 'pillager' ? '{id:"minecraft:crossbow",Count:1b}' : '{id:"minecraft:iron_axe",Count:1b}'
  return '{PersistenceRequired:1b,CanPickUpLoot:0b,CanJoinRaid:0b,PatrolLeader:0b,Patrolling:0b,DeathLootTable:"minecraft:empty"' +
    ',Tags:["shrine_inspector","' + tag + '"]' +
    ',CustomName:' + snbtString(JSON.stringify({ text: INSPECTOR.name, color: INSPECTOR.color, italic: false })) + ',CustomNameVisible:1b' +
    ',HandItems:[' + hand + ',{}],HandDropChances:[0f,0f],ArmorItems:[' + armour.join(',') + '],ArmorDropChances:[0f,0f,0f,0f]}'
}
function summonInspector(server, dim, x, y, z, kind, tag) {
  return !!run(server, 'execute in ' + dim + ' run summon minecraft:' + kind + ' ' + x + ' ' + y + ' ' + z + ' ' + inspectorNbt(kind, tag))
}
// An ambush on p and the pilgrims within AMBUSH.team blocks: Inspectors on the ground in a ring round them. Returns how
// many came.
function ambush(server, p) {
  const d = dimOf(p), q = pos(p), lv = levelOfEntity(p), who = nameOf(p)
  const team = players(server).filter(o => dimOf(o) == d && (nameOf(o) == who || (pilgrim(o) && flat(pos(o), q) <= AMBUSH.team)))
  const n = Math.min(AMBUSH.max, AMBUSH.base + team.length)
  let made = 0
  for (let i = 0; i < n; i++) {
    let a = i * 2 * 3.14159265 / n + Math.random() * 0.6
    let r = AMBUSH.ring[0] + Math.random() * (AMBUSH.ring[1] - AMBUSH.ring[0])
    let x = Math.floor(q.x + Math.cos(a) * r), z = Math.floor(q.z + Math.sin(a) * r)
    let y = standY(lv, x, z, Math.floor(q.y))
    if (summonInspector(server, d, x + 0.5, y, z + 0.5, i % 2 == 0 ? 'vindicator' : 'pillager', 'shrine_ambush')) made++
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

// What else is on that the Shrine mustn't overlap: a Purge or a Gladiator match. '' if nothing.
function otherBusy() {
  try { if (global.Purge && typeof global.Purge.busy == 'function' && String(global.Purge.busy() || '')) return 'A Purge is on. The Shrine waits until it ends.' } catch (e) { }
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
  if (R.state == 'none') out.push('The rise: not started.' + (layersInstalled(server) ? '' : ' The layers are missing (kubejs/data/trollcraft/structures/shrine/).'))
  else if (R.state == 'rising') out.push('The rise: layer ' + R.next + ' of ' + SIZE[1] + ', at ' + siteText(R.site) + '.')
  else if (R.state == 'stopped') out.push('The rise: paused at layer ' + R.next + ' of ' + SIZE[1] + ' (/shrine rise carries on).')
  else out.push('The Shrine has risen, at ' + siteText(R.site) + '.')
  const F = D.fires, ambushed = F.ambushed.filter(x => x).length
  if (F.state == 'none') out.push('The fires: not out yet (/shrine braziers, once all three sites are set).')
  else if (F.state == 'placed') out.push('The fires: out, none lit. Ambushes so far: ' + ambushed + ' of 3.')
  else if (F.state == 'counting') out.push('The fires: ' + litCount() + ' of 3 lit, ' + clock(FIRE_WINDOW_SECONDS - (Date.now() - F.firstLitAt) / 1000) + ' left. Ambushes so far: ' + ambushed + ' of 3.')
  else if (F.state == 'lit') out.push('The fires: all three burn.')
  else out.push('The fires: done (the rise has begun).')
  out.push(D.beam.up ? 'The beam: up at ' + siteText(D.beam.at) + '.' : 'The beam: down.')
  return out
}

// ===================== EVENTS AND COMMANDS =====================

ServerEvents.loaded(event => {
  if (db().rise.state == 'rising') startRise(event.server, true)
  if (firesActive()) {
    db().fires.sites.forEach(b => brazierForceload(event.server, b, true))
    startFireWatch(event.server)
  }
})
// After /reload: a rise under way carries on from its last layer, and the fires are watched again.
try {
  if (Utils.server && db().rise.state == 'rising') startRise(Utils.server, true)
  if (Utils.server && firesActive()) startFireWatch(Utils.server)
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
    .then(Commands.literal('brazier').then(Commands.literal('set').then(Commands.argument('n', Arguments.INTEGER.create(event)).executes(safe(setBrazier(false)))
      .then(xyz(setBrazier(true))))))
    .then(Commands.literal('rise').executes(safe(ctx => {
      const R = db().rise, resuming = R.state == 'stopped'
      const why = startRise(ctx.source.server, false)
      if (why) return reply(ctx, why, true)
      return reply(ctx, resuming ? 'The rise carries on from layer ' + R.next + '.' :
        'The Shrine rises: ' + SIZE[1] + ' layers in about ' + Math.round(SIZE[1] * LAYER_TICKS / 20) + ' seconds.')
    })))
    .then(Commands.literal('braziers').executes(safe(ctx => {
      const why = placeBraziers(ctx.source.server)
      if (why) return reply(ctx, why, true)
      const server = ctx.source.server
      return reply(ctx, 'The braziers are going out: ' + db().fires.sites.map((b, i) => (i + 1) + ' at ' + siteText(b) + ' (' + fromCastle(server, b) + ')').join('; ') +
        '. They must all burn within ' + FIRE_WINDOW_SECONDS + ' seconds of the first. Each team is ambushed once on the way.')
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
    .then(Commands.literal('clearmobs').executes(safe(ctx => {
      const st = shrineStanding()
      if (!st) return reply(ctx, 'There is no Shrine standing.', true)
      const n = sweepMonsters(ctx.source.server, st)
      return reply(ctx, n ? 'Took away ' + n + ' monster' + (n == 1 ? '' : 's') + ' from the Shrine. (Event mobs and named ones stay.)' : 'No monsters in the Shrine.')
    })))
    .then(Commands.literal('stop').executes(safe(ctx => {
      if (!stopRise()) return reply(ctx, 'Nothing is running.', true)
      return reply(ctx, 'The rise is paused at layer ' + db().rise.next + '. /shrine rise carries on.')
    })))
    .then(Commands.literal('reset').executes(safe(ctx => reply(ctx, 'This takes the Shrine down and forgets the night (the sites are kept). For the test server. To do it: /shrine reset confirm', true)))
      .then(Commands.literal('confirm').executes(safe(ctx => {
        const st = db().rise.site
        resetShrine(ctx.source.server, () => { })
        return reply(ctx, st ? 'Taking the Shrine down at ' + siteText(st) + '. The sites are kept.' : 'Nothing was built. The night is forgotten; the sites are kept.')
      })))))
})

// ===================== API =====================

global.Shrine = {
  // Why a Purge or a match should wait ('' if they needn't): for now, only while the Shrine is rising.
  busy: () => (db().rise.state == 'rising' ? 'the Shrine is rising' : ''),
  state: () => JSON.parse(JSON.stringify(db())),
  site: () => db().site,
  risen: () => db().rise.state == 'risen',
  fires: () => db().fires.state,                     // none, placed, counting, lit or done
  beamUp: () => !!db().beam.up,
  fromCastle: st => fromCastle(Utils.server, st),
}

})()
