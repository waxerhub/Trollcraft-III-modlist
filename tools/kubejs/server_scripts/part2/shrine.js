// The Shrine Awakens (Part II, Act I #36): one big evening, run live by ops, in which Technoblade's Shrine rises out of
// the ground and the Blood God names the Regalia of the Blade. Every stage is one op command (see
// tools/kubejs/SHRINE.md).
//
// Built so far:
//   - The sites, set where an op stands: /shrine site set (the Shrine's centre, at ground level) and
//     /shrine brazier set <1-3>. /shrine status shows them, each brazier's direction and distance from the castle
//     (world spawn), and the stage.
//   - Stage 3, the rise (/shrine rise): the Shrine builds itself from the ground up, one layer of the statue every
//     LAYER_TICKS, from kubejs/data/trollcraft/structures/shrine/l_0 .. l_63. Each layer's slice is cleared first, so
//     the ground and anything on it give way. Players in the footprint are moved to its edge. Rumbles, dust and smoke at
//     every layer, and thunder when the pedestal is done and when the head is placed. A /reload or restart carries on
//     from the last layer. /shrine stop pauses it (/shrine rise carries on).
//   - /shrine reset confirm (the test server): takes the Shrine down and forgets the night. The sites are kept.
// Still to come: the Signal and the Summons, the braziers and the beam, the Ignition Rite and the Awakening.
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
const LAYER_TICKS = 80                    // a layer every 4 seconds: about 4 1/2 minutes for the 64
const LOAD_WAIT_SECONDS = 90              // how long to wait for the site's chunks to load before pausing the rise
const CLEAR_SLAB = 18                     // taking it down: fills of 42 x 18 x 43 blocks (fill's limit is 32,768)
const EDGE_GAP = 3                        // players moved out of the footprint land this far outside its edge
const NEAR = 128                          // players this close to the Shrine hear about the rise
const BRAZIERS = 3
const DATA_KEY = 'shrine'

// ===================== STATE =====================

let Serializer = null, ResourceLocation = null
try { Serializer = Java.loadClass('net.minecraft.network.chat.Component$Serializer') } catch (e) { }
try { ResourceLocation = Java.loadClass('net.minecraft.resources.ResourceLocation') } catch (e) { }
let data = null
// D.site: the Shrine's centre at ground level { dim, x, y, z }. D.braziers: [site or null] x 3. D.rise: { state:
// 'none' | 'rising' | 'stopped' | 'risen', next: the next layer to place, site: where it's rising }.
// The rise's token is on global, so a /reload stops the old loop.
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

// ===================== THE RISE =====================

function riseState() { return db().rise.state }
// One layer: clear its slice of the box, then place the statue's layer there, with the rumble.
function placeLayer(server, st, n) {
  const c = corner(st), y = c.y + n, mid = centreOf(st)
  run(server, 'execute in ' + st.dim + ' run fill ' + c.x + ' ' + y + ' ' + c.z + ' ' + (c.x + SIZE[0] - 1) + ' ' + y + ' ' + (c.z + SIZE[2] - 1) + ' minecraft:air')
  const ok = run(server, 'execute in ' + st.dim + ' run place template ' + STRUCTURE + '/l_' + n + ' ' + c.x + ' ' + y + ' ' + c.z)
  if (!ok) return false
  const at = mid.x + ' ' + (y + 0.5) + ' ' + mid.z
  run(server, 'execute in ' + st.dim + ' run playsound minecraft:block.deepslate.place block @a ' + at + ' 3 0.6')
  if (n % 8 == 0) run(server, 'execute in ' + st.dim + ' run playsound minecraft:entity.warden.dig hostile @a ' + at + ' 4 0.6')
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
// Takes the Shrine down (fills of air, from the top) and forgets the night. The sites are kept. done() after.
function resetShrine(server, done) {
  const D = db(), R = D.rise, st = R.site
  global.__shrineRise = (global.__shrineRise || 0) + 1
  const forget = () => {
    D.rise = { state: 'none', next: 0, site: null }
    save()
    if (done) done()
  }
  if (!st || (R.state == 'none' && R.next == 0)) { forget(); return }
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
  return out
}

// ===================== EVENTS AND COMMANDS =====================

ServerEvents.loaded(event => {
  if (db().rise.state == 'rising') startRise(event.server, true)
})
// After /reload: a rise under way carries on from its last layer.
try {
  if (Utils.server && db().rise.state == 'rising') startRise(Utils.server, true)
} catch (e) { console.error('[Shrine] After reload: ' + e) }

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

  const setSite = ctx => {
    const p = self(ctx)
    if (!p) return reply(ctx, 'Run this as a player, standing at the Shrine\'s centre on the ground.', true)
    const R = db().rise
    if (R.state != 'none') return reply(ctx, 'The Shrine is already ' + (R.state == 'risen' ? 'up' : 'half risen') + ' at ' + siteText(R.site) + '. It can\'t move now (/shrine reset confirm takes it down, on the test server).', true)
    db().site = here(p)
    save()
    const c = corner(db().site)
    return reply(ctx, 'The Shrine will rise here, centred on ' + siteText(db().site) + ': ' + SIZE[0] + ' x ' + SIZE[2] + ' blocks (' + c.x + ' ' + c.z + ' to ' +
      (c.x + SIZE[0] - 1) + ' ' + (c.z + SIZE[2] - 1) + ') and ' + SIZE[1] + ' tall. Everything in that box above the ground is cleared as it rises.')
  }
  const setBrazier = ctx => {
    const p = self(ctx)
    if (!p) return reply(ctx, 'Run this as a player, standing where the brazier should go.', true)
    const n = Number(Arguments.INTEGER.getResult(ctx, 'n'))
    if (!(n >= 1 && n <= BRAZIERS)) return reply(ctx, 'Braziers are numbered 1 to ' + BRAZIERS + '.', true)
    db().braziers[n - 1] = here(p)
    save()
    return reply(ctx, 'Brazier ' + n + ' set at ' + siteText(db().braziers[n - 1]) + ': the Summons will call it ' + ordinal(n - 1) + ', ' +
      fromCastle(ctx.source.server, db().braziers[n - 1]) + ' from the castle.')
  }

  event.register(Commands.literal('shrine').requires(op)
    .then(Commands.literal('status').executes(safe(ctx => {
      statusLines(ctx.source.server).forEach((l, i) => reply(ctx, l))
      return 1
    })))
    .then(Commands.literal('site').then(Commands.literal('set').executes(safe(setSite))))
    .then(Commands.literal('brazier').then(Commands.literal('set').then(Commands.argument('n', Arguments.INTEGER.create(event)).executes(safe(setBrazier)))))
    .then(Commands.literal('rise').executes(safe(ctx => {
      const R = db().rise, resuming = R.state == 'stopped'
      const why = startRise(ctx.source.server, false)
      if (why) return reply(ctx, why, true)
      return reply(ctx, resuming ? 'The rise carries on from layer ' + R.next + '.' :
        'The Shrine rises: ' + SIZE[1] + ' layers, one every ' + (LAYER_TICKS / 20) + ' seconds (about ' + Math.ceil(SIZE[1] * LAYER_TICKS / 20 / 60) + ' minutes).')
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
  fromCastle: st => fromCastle(Utils.server, st),
}

})()
