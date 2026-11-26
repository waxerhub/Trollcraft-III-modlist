// Adaptive simulation distance: when the server struggles, creatures and machines run a little less far around players,
// in the dimension that costs most, and it goes back as soon as the server copes (see tools/kubejs/ADAPTIVE_DISTANCE.md;
// owner decision, 2026-11-23, after research/LATENCY_DEEP_DIVE.md).
//
//  - simulation-distance (server.properties) is how many chunks around each player run: at 6, 13 x 13 = 169 chunks;
//    at 5, 121; at 4, 81. What a player can see (view-distance) never changes.
//  - Ticks slower than LOWER_ABOVE_MS for a while: the dimension with players in it that takes the most time goes down one
//    step, at lowest to MIN_DISTANCE. Nobody is moved or kept out of anywhere, and other dimensions aren't touched.
//  - Ticks faster than RAISE_BELOW_MS for a while: the last step is given back.
//  - A step that turns out to be needed soon after it was given back makes the next wait twice as long.
//  - Off while the Shrine's night is on (its Inspectors come from further than the lowest distance).
//  - After a restart everything is at the server's own distance.
//
// Commands (op): /simdistance, /simdistance on, /simdistance off.
// Copy to <server>/kubejs/server_scripts/ and run /reload. Don't run it with ServerCore's dynamic distances.
// KubeJS 6 (Rhino): no template strings; `let` inside nested blocks.

(function () {

// ===================== SETTINGS =====================

const LOWER_ABOVE_MS = 40           // a tick has 50 ms; slower than this (the middle of the last SAMPLES samples): a step down
const RAISE_BELOW_MS = 30           // faster than this for RAISE_AFTER_SECONDS: a step back
const MIN_DISTANCE = 4              // the lowest, in chunks (a creature further than about 64 blocks from everyone stands still)
const SAMPLE_TICKS = 20             // a sample of the tick time this often
const SAMPLES = 10                  // ... and the middle of this many decides, so one slow moment (a save, a tier opening) doesn't
const RAISE_AFTER_SECONDS = 120
const BOUNCE_SECONDS = 300          // needing a step again this soon after giving one back ...
const RAISE_MAX_SECONDS = 1800      // ... doubles the wait, up to this
const START_GRACE_SECONDS = 120     // nothing is lowered this soon after the server starts
const MIN_SHARE_MS = 2              // a dimension costing less than this isn't worth lowering
// A dimension's own normal distance, where it should be lower than server.properties' from the start ({} = none).
// e.g. 'blue_skies:everbright': 5
const NORMAL = {}
const TELL_OPS = true               // a line in chat to ops on every change (always in the log)
const HISTORY = 8                   // changes kept for /simdistance
const DATA_KEY = 'adaptive_distance'

// When nothing may be lowered: [what, whether it's on now].
const HOLDS = [
  ['the Shrine\'s night is on', () => { const s = global.Shrine; return !!s && ((s.eventOn && s.eventOn()) || (s.riteOn && s.riteOn())) }],
]


// ===================== STATE =====================

let Serializer = null, ResourceKey = null, Registries = null, ResourceLocation = null
try { Serializer = Java.loadClass('net.minecraft.network.chat.Component$Serializer') } catch (e) { }
try {
  ResourceKey = Java.loadClass('net.minecraft.resources.ResourceKey')
  Registries = Java.loadClass('net.minecraft.core.registries.Registries')
  ResourceLocation = Java.loadClass('net.minecraft.resources.ResourceLocation')
} catch (e) { console.warn('[AdaptiveDistance] Tick times per dimension can\'t be read, so the dimension with the most players goes first: ' + e) }

// Kept across /reload (a restart starts afresh, as Minecraft does): steps: the dimensions lowered, in order, one entry a
// step; applied: dimension -> the distance last set.
if (!global.adaptiveDistance) global.adaptiveDistance = { token: 0, steps: [], applied: {}, history: [], startedAt: 0 }
const S = global.adaptiveDistance
S.token++
const W = { samples: [], calmSince: 0, lastRaise: 0, wait: RAISE_AFTER_SECONDS, held: '', pendingResult: null, warned: false }
let data = null

function db() {
  if (data) return data
  data = { enabled: true }
  let raw = ''
  try { raw = String(Utils.server.persistentData.getString(DATA_KEY) || '') } catch (e) { }
  if (raw) {
    try {
      let d = JSON.parse(raw)
      if (d && typeof d.enabled == 'boolean') data = d
    } catch (e) {
      console.error('[AdaptiveDistance] Saved data could not be read; a copy is kept')
      try { Utils.server.persistentData.putString(DATA_KEY + '_unreadable_' + Date.now(), raw) } catch (e2) { }
    }
  }
  return data
}
function save() {
  try { Utils.server.persistentData.putString(DATA_KEY, JSON.stringify(db())) } catch (e) { console.error('[AdaptiveDistance] Save failed: ' + e) }
}


// ===================== HELPERS =====================

function comp(text, color) {
  const json = JSON.stringify(['', { text: '[Distance] ', color: 'dark_aqua' }, { text: text, color: color || 'gray' }])
  if (Serializer) { try { return Serializer.fromJsonLenient(json) } catch (e) { } }
  return Text.of('[Distance] ' + text)
}
function tellOps(srv, text) {
  if (!TELL_OPS) return
  const list = srv.players
  for (let i = 0; i < list.size(); i++) {
    let p = list.get(i)
    try { if (p.hasPermissions(2)) p.tell(comp(text)) } catch (e) { }
  }
}
function dimOf(level) {
  let d = level.dimension
  if (typeof d == 'function') d = level.dimension()
  if (d != null && typeof d.location == 'function') d = d.location()
  return String(d)
}
function levels(srv) { const out = []; srv.getAllLevels().forEach(lv => out.push(lv)); return out }
function playersIn(level) { try { return Number(level.players.size()) } catch (e) { return 0 } }
function median(list) {
  const a = list.slice().sort((x, y) => x - y), n = a.length
  return n ? (n % 2 ? a[(n - 1) / 2] : (a[n / 2 - 1] + a[n / 2]) / 2) : 0
}
function ms(v) { return (Math.round(v * 10) / 10) + ' ms' }

// The server's own simulation distance (server.properties), which every restart goes back to.
function base(srv) {
  try { let n = Number(srv.getProperties().simulationDistance); if (n > 0) return n } catch (e) { }
  try { let n = Number(srv.getPlayerList().getSimulationDistance()); if (n > 0) return n } catch (e) { }
  return 10
}
function normalFor(srv, dim) { const b = base(srv); return NORMAL[dim] > 0 ? Math.min(NORMAL[dim], b) : b }
function lowestFor(srv, dim) { return Math.min(MIN_DISTANCE, normalFor(srv, dim)) }
function stepsOf(dim) { return S.steps.filter(d => d == dim).length }
function distanceFor(srv, dim) { return Math.max(lowestFor(srv, dim), normalFor(srv, dim) - stepsOf(dim)) }

// Milliseconds a tick this dimension takes (Forge keeps each one's last 100 ticks), or null if it can't be read.
function cost(srv, dim) {
  if (!ResourceKey) return null
  try {
    let arr = srv.getTickTime(ResourceKey.create(Registries.DIMENSION, new ResourceLocation(dim)))
    if (arr == null || !arr.length) return 0
    let sum = 0
    for (let i = 0; i < arr.length; i++) sum += Number(arr[i])
    return sum / arr.length / 1000000
  } catch (e) {
    if (!W.warned) { W.warned = true; console.warn('[AdaptiveDistance] Tick time of ' + dim + ' can\'t be read: ' + e) }
    return null
  }
}

// Sets every dimension to the distance it should have now. Minecraft does nothing for one that already has it.
function apply(srv) {
  levels(srv).forEach(lv => {
    const dim = dimOf(lv), want = distanceFor(srv, dim)
    if (S.applied[dim] == want) return
    try { lv.getChunkSource().setSimulationDistance(want); S.applied[dim] = want } catch (e) { console.error('[AdaptiveDistance] ' + dim + ': ' + e) }
  })
}
function note(text) {
  S.history.unshift({ t: Date.now(), text: text })
  if (S.history.length > HISTORY) S.history.length = HISTORY
}


// ===================== DECIDING =====================

// Why nothing may be lowered now, '' if it may.
function holding() {
  for (let i = 0; i < HOLDS.length; i++) {
    let on = false
    try { on = !!HOLDS[i][1]() } catch (e) { }
    if (on) return HOLDS[i][0]
  }
  return ''
}
// Gives every step back.
function restore(srv, why) {
  if (!S.steps.length) return
  S.steps = []
  apply(srv)
  W.samples = []
  W.calmSince = 0
  const text = 'Back to normal everywhere: ' + why + '.'
  note(text)
  console.info('[AdaptiveDistance] ' + text)
  tellOps(srv, text)
}
// The dimension to lower: the one with players in it that takes the most time and isn't at its lowest. { dim, ms, n } or null.
function worst(srv) {
  let best = null
  levels(srv).forEach(lv => {
    const dim = dimOf(lv), n = playersIn(lv)
    if (n < 1 || distanceFor(srv, dim) <= lowestFor(srv, dim)) return
    const c = cost(srv, dim)
    if (c != null && c < MIN_SHARE_MS) return
    if (!best || (c != null && best.ms != null ? c > best.ms : n > best.n)) best = { dim: dim, ms: c, n: n }
  })
  return best
}
function lower(srv, m, now) {
  const w = worst(srv)
  if (!w) return
  if (W.lastRaise && now - W.lastRaise < BOUNCE_SECONDS * 1000) W.wait = Math.min(RAISE_MAX_SECONDS, W.wait * 2)
  const from = distanceFor(srv, w.dim)
  S.steps.push(w.dim)
  apply(srv)
  const text = w.dim + ' ' + from + ' -> ' + distanceFor(srv, w.dim) + ' (ticks ' + ms(m) + (w.ms != null ? ', ' + ms(w.ms) + ' of it there' : '') + ', ' + w.n + ' player' + (w.n == 1 ? '' : 's') + ' there)'
  note(text)
  console.info('[AdaptiveDistance] ' + text)
  tellOps(srv, 'The server is struggling: ' + text + '.')
  W.pendingResult = S.history[0]
  W.samples = []
  W.calmSince = 0
}
function raise(srv, m, now) {
  const dim = S.steps[S.steps.length - 1], from = distanceFor(srv, dim)
  S.steps.pop()
  apply(srv)
  W.lastRaise = now
  W.samples = []
  W.calmSince = now
  const text = dim + ' ' + from + ' -> ' + distanceFor(srv, dim) + ' (ticks ' + ms(m) + ')'
  note(text)
  console.info('[AdaptiveDistance] ' + text)
  tellOps(srv, 'The server copes again: ' + text + '.')
}
function sample(srv) {
  const now = Date.now()
  apply(srv)                              // a dimension made since (RFTools) or NORMAL
  if (!db().enabled) return
  const hold = holding()
  if (hold != W.held) {
    W.held = hold
    if (hold) restore(srv, hold)
  }
  W.samples.push(Number(srv.getAverageTickTime()))
  if (W.samples.length > SAMPLES) W.samples.shift()
  if (W.samples.length < SAMPLES) return
  const m = median(W.samples)
  if (W.pendingResult) { W.pendingResult.text += ', then ' + ms(m); W.pendingResult = null }
  if (hold) return
  if (W.wait > RAISE_AFTER_SECONDS && (!W.lastRaise || now - W.lastRaise > 2 * RAISE_MAX_SECONDS * 1000)) W.wait = RAISE_AFTER_SECONDS
  if (m > LOWER_ABOVE_MS) {
    W.calmSince = 0
    if (now - S.startedAt >= START_GRACE_SECONDS * 1000) lower(srv, m, now)
    return
  }
  if (m >= RAISE_BELOW_MS) { W.calmSince = 0; return }
  if (!W.calmSince) W.calmSince = now
  if (S.steps.length && now - W.calmSince >= W.wait * 1000) raise(srv, m, now)
}
function loop(srv) {
  const token = S.token
  const tick = () => {
    if (token != S.token) return          // a /reload started a new one
    try { sample(srv) } catch (e) { console.error('[AdaptiveDistance] ' + e) }
    srv.scheduleInTicks(SAMPLE_TICKS, tick)
  }
  srv.scheduleInTicks(SAMPLE_TICKS, tick)
}
ServerEvents.loaded(event => {
  S.startedAt = Date.now()
  S.steps = []
  S.applied = {}
  loop(event.server)
})
try { if (Utils.server) loop(Utils.server) } catch (e) { }   // after /reload


// ===================== COMMAND =====================

ServerEvents.commandRegistry(event => {
  const Commands = event.commands
  const reply = (ctx, text) => { ctx.source.sendSystemMessage(comp(text)); return 1 }
  event.register(Commands.literal('simdistance').requires(src => src.hasPermission(2))
    .executes(ctx => {
      const srv = ctx.source.server, hold = holding()
      reply(ctx, (db().enabled ? 'On' : 'Off') + (hold ? ' (nothing is lowered while ' + hold + ')' : '') + '. Ticks: ' + ms(Number(srv.getAverageTickTime())) + '. Normal distance: ' + base(srv) +
        (S.steps.length ? '. Steps down now: ' + S.steps.length + ', the next back after ' + W.wait + ' s of calm.' : '.'))
      levels(srv).forEach(lv => {
        const dim = dimOf(lv), n = playersIn(lv), c = cost(srv, dim), d = distanceFor(srv, dim)
        if (!n && d == normalFor(srv, dim) && !(c >= MIN_SHARE_MS)) return
        reply(ctx, '  ' + dim + ': ' + d + (d < normalFor(srv, dim) ? ' (normally ' + normalFor(srv, dim) + ')' : '') + ', ' + n + ' player' + (n == 1 ? '' : 's') + (c != null ? ', ' + ms(c) : ''))
      })
      S.history.forEach(h => reply(ctx, '  ' + new Date(h.t).toISOString().slice(11, 19) + ' UTC: ' + h.text))
      return 1
    })
    .then(Commands.literal('on').executes(ctx => {
      db().enabled = true
      save()
      W.samples = []
      return reply(ctx, 'On.')
    }))
    .then(Commands.literal('off').executes(ctx => {
      restore(ctx.source.server, 'switched off')
      db().enabled = false
      save()
      return reply(ctx, 'Off: every dimension is at its normal distance, and stays there.')
    })))
})


// ===================== API =====================

global.AdaptiveDistance = {
  enabled: () => db().enabled,
  distanceOf: dim => distanceFor(Utils.server, String(dim)),
  lowered: () => S.steps.slice(),
}

})()
