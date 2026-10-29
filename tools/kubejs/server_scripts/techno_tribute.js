// Techno Tribute: a pack of short, temporary tributes to Technoblade, run by ops.
//
//   /techno face [targets] [small|normal|huge]  a firework that bursts into his face (pixel art in coloured particles)
//   /techno crown [targets]                       a golden crown floating over each player's head for 30 s
//   /techno parade [targets]                      glowing "Technoblade" pigs around each player, gone in a puff after 30 s
//   /techno blood [targets]                       BLOOD FOR THE BLOOD GOD: title, red storm, thunder, short thunderstorm
//   /techno potatoes [targets]                    baked potatoes rain down for 10 s (display-only, nothing to pick up)
//   /techno quote [targets]                       "Technoblade never dies." floats in the air for 20 s
//   /techno all [targets]                         all of the above, one after another (about 25 s)
//   /techno stop                                  ends everything at once and removes anything left over
//
// Targets: any selector (@a, @p, a name); without one, the op running it. Nothing is permanent: no blocks are
// placed, nothing goes into inventories, every spawned pig, display or rocket is tagged techno_tribute and removed
// by the script (also after a /reload or restart, as soon as its chunk loads). Pigs are invulnerable and drop
// nothing. The weather is put back after the storm.
//
// Copy to <server>/kubejs/server_scripts/ and run /reload. KubeJS 6 notes: no template strings; `let` inside nested
// blocks; event.cancel() comes last.

(function () {

// ===================== SETTINGS =====================

const MAX_TARGETS = 10                 // most players one command will target (each gets their own show)
const FACE_SIZES = { small: 0.35, normal: 0.6, huge: 1.0 }   // blocks between face "pixels"
const FACE_DISTANCE = 12               // the rocket goes up this far in front of the player...
const FACE_SECONDS = 3                 // ...and the face hangs in the sky this long
const CROWN_SECONDS = 30
const PARADE = { pigs: 8, radius: 4, seconds: 30 }
const BLOOD_SECONDS = 10
const POTATO = { seconds: 10, radius: 8, height: 14 }
const QUOTE = { seconds: 20, text: 'Technoblade never dies.', sub: 'If you wish to defeat me, train for another hundred years.' }

// The face: one character per pixel, top row first ('.' = nothing). Colours below are 0-255 RGB.
const FACE = [
  '..G....GG....G..',
  '..GG..GGGG..GG..',
  '..GGGGGRRGGGGG..',
  '..gGGGGGGGGGGg..',
  '.PPPPPPPPPPPPPP.',
  '.PPPPPPPPPPPPPP.',
  '.PPEBPPPPPPBEPP.',
  '.PPEBPPPPPPBEPP.',
  '.PPPPPPPPPPPPPP.',
  '.PPPPNNNNNNPPPP.',
  '.PPPPNnNNnNPPPP.',
  '.PPPPNNNNNNPPPP.',
  '.PPPPPPPPPPPPPP.',
  '.pPPPPPPPPPPPPp.',
  '..pppppppppppp..',
]
const COLOURS = {
  P: [244, 167, 185], p: [214, 120, 140], N: [236, 140, 158], n: [110, 40, 55], E: [250, 250, 250], B: [20, 20, 20],
  G: [255, 205, 40], g: [200, 140, 20], R: [210, 25, 40],
}


// ===================== STATE AND HELPERS =====================

const TAG = 'techno_tribute'
if (!global.technoTributeState) global.technoTributeState = { token: 0, live: {} }
const S = global.technoTributeState
S.token++                       // stops schedules from before a /reload
S.expect = false
S.caught = []
S.weatherBefore = null

let Serializer = null
try { Serializer = Java.loadClass('net.minecraft.network.chat.Component$Serializer') } catch (e) { }

function nameOf(p) { return String(p.getGameProfile().getName()) }
function uuidOf(e) {
  try { return String(e.getStringUuid()) } catch (err) { }
  return String(e.getStringUUID())
}
const POS_WAYS = [e => [e.getX(), e.getY(), e.getZ()], e => [e.x, e.y, e.z]]
function posOf(e) {
  for (let i = 0; i < POS_WAYS.length; i++) {
    let v = null
    try { v = POS_WAYS[i](e) } catch (err) { }
    if (v && isFinite(Number(v[0]))) return { x: Number(v[0]), y: Number(v[1]), z: Number(v[2]) }
  }
  return { x: 0, y: 0, z: 0 }
}
function levelOf(e) { const l = e.level; return typeof l == 'function' ? e.level() : l }
function dimOf(e) {
  const level = levelOf(e)
  let d = level.dimension
  if (typeof d == 'function') d = level.dimension()
  if (d != null && typeof d.location == 'function') d = d.location()
  return String(d)
}
function yawOf(p) { try { return Number(p.getYRot()) } catch (e) { try { return Number(p.yaw) } catch (e2) { return 0 } } }
function hasTag(e, t) { try { return e.getTags().contains(t) } catch (err) { return false } }
function n2(v) { return String(Math.round(v * 100) / 100) }
function rand(a, b) { return a + Math.random() * (b - a) }
function run(server, cmd) { try { return server.runCommandSilent(cmd) } catch (e) { return 0 } }
function runIn(server, dim, cmd) { return run(server, 'execute in ' + dim + ' run ' + cmd) }
// Runs fn after `ticks`, unless /techno stop or a /reload came in between.
function later(server, ticks, fn) {
  const token = S.token
  server.scheduleInTicks(Math.max(1, Math.round(ticks)), () => {
    if (token != S.token) return
    try { fn() } catch (e) { console.error('[TechnoTribute] ' + e) }
  })
}
function every(server, ticks, times, fn, done) {
  let n = 0
  const step = () => {
    fn(n)
    n++
    if (n < times) later(server, ticks, step)
    else if (done) done()
  }
  later(server, 1, step)
}
function comp(json) {
  if (Serializer) { try { return Serializer.fromJsonLenient(JSON.stringify(json)) } catch (e) { } }
  return Text.of(Array.isArray(json) ? json.map(j => j.text || '').join('') : json.text || '')
}
function snbt(s) { return "'" + String(s).replace(/\\/g, '\\\\').replace(/'/g, "\\'") + "'" }

// Summons an entity with our tag and returns it (caught as it joins the world), or null.
function summon(server, dim, type, pos, nbt) {
  S.expect = true
  S.caught = []
  try {
    runIn(server, dim, 'summon ' + type + ' ' + n2(pos.x) + ' ' + n2(pos.y) + ' ' + n2(pos.z) + ' ' + nbt)
  } finally {
    S.expect = false
  }
  const e = S.caught[0] || null
  S.caught = []
  if (e) S.live[uuidOf(e)] = e
  return e
}
function removeEntity(server, e, poof) {
  if (!e) return
  const u = uuidOf(e)
  delete S.live[u]
  try {
    if (poof) {
      let q = posOf(e)
      runIn(server, dimOf(e), 'particle minecraft:poof ' + n2(q.x) + ' ' + n2(q.y + 0.4) + ' ' + n2(q.z) + ' 0.3 0.3 0.3 0.02 12 force')
    }
    if (!e.isRemoved()) e.discard()
  } catch (err) { run(server, 'kill ' + u) }
}
function removeAll(server) {
  Object.keys(S.live).forEach(u => removeEntity(server, S.live[u], false))
  run(server, 'kill @e[tag=' + TAG + ']')
  S.live = {}
}
function soundAt(server, dim, pos, sound, volume, pitch) {
  runIn(server, dim, 'playsound ' + sound + ' master @a ' + n2(pos.x) + ' ' + n2(pos.y) + ' ' + n2(pos.z) + ' ' + (volume || 1) + ' ' + (pitch || 1))
}
function dust(server, dim, rgb, size, x, y, z) {
  runIn(server, dim, 'particle minecraft:dust ' + n2(rgb[0] / 255) + ' ' + n2(rgb[1] / 255) + ' ' + n2(rgb[2] / 255) + ' ' + n2(size) + ' ' +
    n2(x) + ' ' + n2(y) + ' ' + n2(z) + ' 0 0 0 0 1 force')
}


// ===================== THE TRIBUTES =====================

// --- Face fireworks ---
function face(server, p, spacing) {
  const dim = dimOf(p), q = posOf(p)
  const fx = -Math.sin(yawOf(p) * 0.017453292519943295), fz = Math.cos(yawOf(p) * 0.017453292519943295)
  const launch = { x: q.x + fx * FACE_DISTANCE, y: q.y + 1, z: q.z + fz * FACE_DISTANCE }
  const rocket = summon(server, dim, 'minecraft:firework_rocket', launch,
    '{LifeTime:30,Tags:["' + TAG + '"],FireworksItem:{id:"minecraft:firework_rocket",Count:1b,tag:{Fireworks:{Flight:2b,Explosions:[' +
    '{Type:1b,Colors:[I;16033721,16766720],FadeColors:[I;12597547],Trail:1b,Flicker:1b}]}}}}')
  later(server, 29, () => {
    let burst = rocket && !rocket.isRemoved() ? posOf(rocket) : { x: launch.x, y: launch.y + 20, z: launch.z }
    if (rocket) delete S.live[uuidOf(rocket)]
    drawFace(server, dim, burst, posOf(p), spacing)
  })
}
function drawFace(server, dim, burst, viewer, spacing) {
  // the face looks at the viewer: rows go up, columns go along the viewer's left-to-right
  let dx = burst.x - viewer.x, dz = burst.z - viewer.z
  const len = Math.sqrt(dx * dx + dz * dz) || 1
  dx /= len; dz /= len
  const rx = -dz, rz = dx                  // the viewer's right-hand side
  const size = Math.min(4, Math.max(0.6, spacing * 3.2))
  const pixels = []
  FACE.forEach((row, r) => {
    for (let c = 0; c < row.length; c++) {
      let col = COLOURS[row.charAt(c)]
      if (!col) continue
      let off = (c - (row.length - 1) / 2) * spacing, up = ((FACE.length - 1) / 2 - r) * spacing
      pixels.push([col, burst.x + rx * off, burst.y + up, burst.z + rz * off])
    }
  })
  soundAt(server, dim, burst, 'minecraft:entity.firework_rocket.large_blast', 4, 0.8)
  every(server, 4, Math.round(FACE_SECONDS * 5), () => pixels.forEach(px => dust(server, dim, px[0], size, px[1], px[2], px[3])))
}

// --- Crown halo ---
function crown(server, p) {
  const u = uuidOf(p)
  const ring = []
  for (let i = 0; i < 10; i++) {
    let a = i / 10 * 6.283185307179586
    ring.push([Math.cos(a) * 0.38, i % 2 == 0 ? 0.18 : 0, Math.sin(a) * 0.38])   // every other point is a spike
  }
  every(server, 5, CROWN_SECONDS * 4, () => {
    ring.forEach(pt => run(server, 'execute at ' + u + ' run particle minecraft:dust 1 0.82 0.15 0.7 ~' + n2(pt[0]) + ' ~' + n2(2.25 + pt[1]) + ' ~' + n2(pt[2]) + ' 0 0 0 0 1 force'))
    run(server, 'execute at ' + u + ' run particle minecraft:dust 0.85 0.1 0.15 0.8 ~ ~2.3 ~ 0 0 0 0 1 force')
  })
}

// --- Pig parade ---
function parade(server, p) {
  const dim = dimOf(p), q = posOf(p), pigs = []
  for (let i = 0; i < PARADE.pigs; i++) {
    let a = i / PARADE.pigs * 6.283185307179586
    let e = summon(server, dim, 'minecraft:pig', { x: q.x + Math.cos(a) * PARADE.radius, y: q.y + 0.5, z: q.z + Math.sin(a) * PARADE.radius },
      '{Tags:["' + TAG + '"],CustomName:' + snbt(JSON.stringify({ text: '♛ Technoblade', color: 'gold', bold: true })) +
      ',CustomNameVisible:1b,Glowing:1b,Invulnerable:1b,PersistenceRequired:0b,DeathLootTable:"minecraft:empty",' +
      'ActiveEffects:[{Id:1,Amplifier:1b,Duration:' + (PARADE.seconds * 20 + 40) + ',ShowParticles:0b}]}')
    if (e) pigs.push(e)
  }
  soundAt(server, dim, q, 'minecraft:entity.pig.ambient', 2, 0.8)
  every(server, 40, Math.floor(PARADE.seconds / 2), () => {
    pigs.forEach(e => { if (Math.random() < 0.4) { let pq = posOf(e); soundAt(server, dim, pq, 'minecraft:entity.pig.ambient', 1, rand(0.7, 1.3)) } })
  }, () => pigs.forEach(e => removeEntity(server, e, true)))
}

// --- Blood for the Blood God ---
function blood(server, p) {
  const u = uuidOf(p), dim = dimOf(p)
  run(server, 'title ' + u + ' times 10 60 20')
  run(server, 'title ' + u + ' subtitle ' + JSON.stringify({ text: 'Technoblade never dies', color: 'gray', italic: true }))
  run(server, 'title ' + u + ' title ' + JSON.stringify({ text: 'BLOOD FOR THE BLOOD GOD', color: 'dark_red', bold: true }))
  soundAt(server, dim, posOf(p), 'minecraft:entity.lightning_bolt.thunder', 3, 0.7)
  bolt(p)
  if (dim == 'minecraft:overworld') storm(server)
  every(server, 5, BLOOD_SECONDS * 4, i => {
    run(server, 'execute at ' + u + ' run particle minecraft:dust 0.7 0 0.05 1.6 ~ ~6 ~ 5 3 5 0 40 force')
    run(server, 'execute at ' + u + ' run particle minecraft:crimson_spore ~ ~3 ~ 4 2 4 0 30 force')
    if (i % 12 == 6) bolt(p)
  })
}
// Visual-only lightning (no damage, no fire) a few blocks from the player.
function bolt(p) {
  try {
    let q = posOf(p)
    let b = levelOf(p).createEntity('minecraft:lightning_bolt')
    b.setVisualOnly(true)
    b.setPosition(q.x + rand(-8, 8), q.y, q.z + rand(-8, 8))
    b.spawn()
  } catch (e) { }
}
// A short thunderstorm; the weather it found is put back afterwards.
function storm(server) {
  if (S.weatherBefore != null) return
  let before = 'clear'
  try {
    let ow = typeof server.overworld == 'function' ? server.overworld() : server.overworld
    before = ow.isThundering() ? 'thunder' : ow.isRaining() ? 'rain' : 'clear'
  } catch (e) { return }
  if (before == 'thunder') return
  S.weatherBefore = before
  runIn(server, 'minecraft:overworld', 'weather thunder')
  later(server, BLOOD_SECONDS * 20, () => restoreWeather(server))
}
function restoreWeather(server) {
  if (S.weatherBefore == null) return
  runIn(server, 'minecraft:overworld', 'weather ' + S.weatherBefore)
  S.weatherBefore = null
}

// --- Potato rain (item displays: they look like potatoes but can't be picked up, by hoppers or anyone) ---
function potatoes(server, p) {
  const dim = dimOf(p)
  every(server, 3, Math.round(POTATO.seconds * 20 / 3), () => {
    for (let k = 0; k < 2; k++) {
      let q = posOf(p)
      let at = { x: q.x + rand(-POTATO.radius, POTATO.radius), y: q.y + POTATO.height, z: q.z + rand(-POTATO.radius, POTATO.radius) }
      let e = summon(server, dim, 'minecraft:item_display', at,
        '{Tags:["' + TAG + '"],item:{id:"minecraft:baked_potato",Count:1b},transformation:{left_rotation:[0f,0f,0f,1f],right_rotation:[0f,0f,0f,1f],translation:[0f,0f,0f],scale:[0.9f,0.9f,0.9f]}}')
      if (!e) continue
      let u = uuidOf(e), half = rand(-1.5, 1.5)   // half the spin angle: a turn of up to about 170 degrees
      let rot = '[0f,' + n2(Math.sin(half)) + 'f,0f,' + n2(Math.cos(half)) + 'f]'
      // next tick: slide it down to the ground, spinning, then remove it
      later(server, 1, () => runIn(server, dim, 'data merge entity ' + u + ' {start_interpolation:0,interpolation_duration:30,transformation:{left_rotation:' + rot + ',right_rotation:[0f,0f,0f,1f],translation:[0f,-' + POTATO.height + 'f,0f],scale:[0.9f,0.9f,0.9f]}}'))
      later(server, 34, () => removeEntity(server, e, false))
    }
  })
}

// --- Floating quote ---
function quote(server, p) {
  const dim = dimOf(p), q = posOf(p)
  const fx = -Math.sin(yawOf(p) * 0.017453292519943295), fz = Math.cos(yawOf(p) * 0.017453292519943295)
  const text = JSON.stringify([{ text: QUOTE.text, color: 'gold', bold: true }, { text: '\n' + QUOTE.sub, color: 'gray', italic: true, bold: false }])
  const e = summon(server, dim, 'minecraft:text_display', { x: q.x + fx * 4, y: q.y + 2.6, z: q.z + fz * 4 },
    '{Tags:["' + TAG + '"],billboard:"center",alignment:"center",line_width:260,background:1073741824,text:' + snbt(text) +
    ',transformation:{left_rotation:[0f,0f,0f,1f],right_rotation:[0f,0f,0f,1f],translation:[0f,0f,0f],scale:[1.6f,1.6f,1.6f]}}')
  soundAt(server, dim, q, 'minecraft:block.bell.resonate', 1, 0.8)
  later(server, QUOTE.seconds * 20, () => removeEntity(server, e, true))
}

const TRIBUTES = {
  face: (server, p, opt) => face(server, p, FACE_SIZES[opt] || FACE_SIZES.normal),
  crown: (server, p) => crown(server, p),
  parade: (server, p) => parade(server, p),
  blood: (server, p) => blood(server, p),
  potatoes: (server, p) => potatoes(server, p),
  quote: (server, p) => quote(server, p),
}
// /techno all: the whole show, one after another.
const SHOW = [[0, 'blood'], [40, 'crown'], [80, 'parade'], [140, 'potatoes'], [200, 'quote'], [260, 'face'], [300, 'face'], [340, 'face']]
function all(server, p) {
  SHOW.forEach(s => later(server, s[0] + 1, () => { if (!p.isRemoved()) TRIBUTES[s[1]](server, p, s[1] == 'face' && s[0] == 340 ? 'huge' : null) }))
}


// ===================== EVENTS =====================

// Catch our own summons; anything tagged techno_tribute that we didn't just make is a leftover (a /reload or a
// restart in between) and is removed as it loads.
EntityEvents.spawned(event => {
  const e = event.entity
  if (!hasTag(e, TAG)) return
  if (S.expect) { S.caught.push(e); return }
  if (S.live[uuidOf(e)]) return
  event.cancel()
})

function startUp(server) { removeAll(server) }
ServerEvents.loaded(event => startUp(event.server))
if (Utils.server) startUp(Utils.server)


// ===================== COMMANDS =====================

ServerEvents.commandRegistry(event => {
  const Commands = event.commands
  const Arguments = event.arguments
  const reply = (ctx, text, bad) => {
    ctx.source.sendSystemMessage(comp([{ text: '[Techno] ', color: 'gold' }, { text: text, color: bad ? 'red' : 'gray' }]))
    return bad ? 0 : 1
  }
  // fn(server, player); targets: the selector's players, or the op running it.
  const go = (name, opt) => ctx => {
    try {
      let server = ctx.source.server
      let list = []
      let fromSelector = null
      try { fromSelector = Arguments.PLAYERS.getResult(ctx, 'targets') } catch (e) { }
      if (fromSelector != null) fromSelector.forEach(p => list.push(p))
      else { let me = ctx.source.getPlayer(); if (me) list.push(me) }
      if (!list.length) return reply(ctx, 'No players to target. From the console or a command block, give targets, e.g. /techno ' + name + ' @a', true)
      let skipped = Math.max(0, list.length - MAX_TARGETS)
      list = list.slice(0, MAX_TARGETS)
      list.forEach(p => { if (name == 'all') all(server, p); else TRIBUTES[name](server, p, opt) })
      return reply(ctx, (name == 'all' ? 'The full tribute' : 'Tribute "' + name + '"') + ' for ' + list.map(nameOf).join(', ') + '.' + (skipped ? ' (' + skipped + ' more skipped: at most ' + MAX_TARGETS + ' at once.)' : ''))
    } catch (e) {
      console.error('[TechnoTribute] ' + e)
      return reply(ctx, 'Error: ' + e, true)
    }
  }
  const root = Commands.literal('techno').requires(src => src.hasPermission(2))
  Object.keys(TRIBUTES).concat(['all']).forEach(name => {
    let targets = Commands.argument('targets', Arguments.PLAYERS.create(event)).executes(go(name, null))
    if (name == 'face') Object.keys(FACE_SIZES).forEach(sz => targets.then(Commands.literal(sz).executes(go(name, sz))))
    root.then(Commands.literal(name).executes(go(name, null)).then(targets))
  })
  root.then(Commands.literal('stop').executes(ctx => {
    S.token++
    removeAll(ctx.source.server)
    restoreWeather(ctx.source.server)
    return reply(ctx, 'All tributes stopped and cleaned up.')
  }))
  event.register(root)
})

})()
