// /wings <player>       - toggles pink particle fairy wings on a player (they flap gently)
// /wings <player> off   - takes them away
// /wings list           - who has wings
// Wings stay on through logouts and restarts (stored as a player tag) until taken away.
// Operators only (permission level 2). For an FTB Ranks rank: /ftbranks node add <rank> command.wings true
// Copy to <server>/kubejs/server_scripts/ and run /reload.
//
// Kept light on purpose: about 34 particles per frame, ~6 frames a second, sent only to players within
// 32 blocks, positions worked out here instead of with per-particle selectors, and nothing runs at all
// while nobody online has wings.
// Note: KubeJS 6's script engine (Rhino) has no `template strings`, so strings are joined with +.

(function () {

// ===================== SETTINGS =====================

const MAX_WINGED_PLAYERS = 5      // most players with wings at once
const FRAME_EVERY_TICKS = 3       // redraw this often (20 ticks = 1 second); higher = cheaper, choppier
const FLAP_SPEED = 0.35           // flap cycles per second... roughly
const FLAP_DEGREES = 25           // how far the wings swing open and shut
const BASE_DEGREES = 15           // how far back the wings sit when closed
const OUTLINE_COLOR = [1.0, 0.41, 0.71]   // pink (red, green, blue from 0 to 1)
const INNER_COLOR = [1.0, 0.75, 0.86]     // light pink
const PARTICLE_SIZE = 0.7
const TAG = 'fairy_wings'

// One wing as [sideways distance from the spine, height above the feet]. Mirrored for the other wing.
const WING_OUTLINE = [
  [0.15, 1.55], [0.35, 1.8], [0.6, 1.95], [0.85, 1.98], [1.0, 1.85], [0.95, 1.65], [0.75, 1.5], [0.5, 1.42],
  [0.4, 1.25], [0.6, 1.1], [0.7, 0.92], [0.6, 0.8], [0.4, 0.85], [0.2, 1.05],
]
const WING_INNER = [[0.55, 1.7], [0.75, 1.75], [0.45, 1.05]]

const TWO_PI = 6.283185307179586   // Math.PI is missing in the server's script engine
const DEG = TWO_PI / 360


// ===================== HELPERS =====================

if (!global.fairyWings) global.fairyWings = { token: 0, running: false }
const state = global.fairyWings
state.token++          // stops the loop from before a /reload
state.running = false

function nameOf(p) { return String(p.getGameProfile().getName()) }
function num(n) { return String(Math.round(n * 1000) / 1000) }
function levelOf(e) { const l = e.level; return typeof l == 'function' ? e.level() : l }
function dimensionId(level) {
  let d = level.dimension
  if (typeof d == 'function') d = level.dimension()
  if (d != null && typeof d.location == 'function') d = d.location()
  return String(d)
}
function read(e, getter, prop) {
  let v = NaN
  try { v = Number(e[getter]()) } catch (err) { }
  if (!isFinite(v)) v = Number(e[prop])
  return v
}
function yawOf(p) {
  let v = NaN
  try { v = Number(p.getYaw()) } catch (e) { }          // KubeJS's name for Minecraft's getYRot
  if (!isFinite(v)) { try { v = Number(p.getYRot()) } catch (e) { } }
  return isFinite(v) ? v : 0
}
function hasWings(p) { return p.getTags().contains(TAG) }

function wingedPlayers(server) {
  const out = []
  const list = server.players
  for (let i = 0; i < list.size(); i++) if (hasWings(list.get(i))) out.push(list.get(i))
  return out
}

function hidden(p) {
  try { if (p.isSpectator()) return true } catch (e) { }
  try { if (p.isInvisible()) return true } catch (e) { }
  return false
}

function dust(color) { return 'minecraft:dust ' + color[0] + ' ' + color[1] + ' ' + color[2] + ' ' + PARTICLE_SIZE }
const OUTLINE_DUST = dust(OUTLINE_COLOR)
const INNER_DUST = dust(INNER_COLOR)

function drawWings(server, p, time) {
  if (hidden(p)) return
  const x = read(p, 'getX', 'x'), y = read(p, 'getY', 'y'), z = read(p, 'getZ', 'z')
  if (!isFinite(x) || !isFinite(y) || !isFinite(z)) return
  const yaw = yawOf(p) * DEG
  // Facing direction and the player's left, flat on the ground (yaw 0 = facing south, +z).
  const fx = -Math.sin(yaw), fz = Math.cos(yaw)
  const lx = Math.cos(yaw), lz = Math.sin(yaw)
  const open = (BASE_DEGREES + FLAP_DEGREES * (0.5 + 0.5 * Math.sin(time * FLAP_SPEED * TWO_PI))) * DEG
  const c = Math.cos(open), s = Math.sin(open)
  const prefix = 'execute in ' + dimensionId(levelOf(p)) + ' run particle '
  const draw = (points, particle) => {
    for (let i = 0; i < points.length; i++) {
      let r = points[i][0], h = points[i][1]
      let side = r * c, back = 0.25 + r * s          // swing each point backwards around the spine
      for (let m = -1; m <= 1; m += 2) {             // m = 1 left wing, -1 right wing
        let px = x + lx * side * m - fx * back
        let pz = z + lz * side * m - fz * back
        server.runCommandSilent(prefix + particle + ' ' + num(px) + ' ' + num(y + h) + ' ' + num(pz) + ' 0 0 0 0 1 normal')
      }
    }
  }
  draw(WING_OUTLINE, OUTLINE_DUST)
  draw(WING_INNER, INNER_DUST)
}

// The drawing loop. Only scheduled while someone online has wings.
function startLoop(server) {
  if (state.running) return
  state.running = true
  const token = state.token
  const step = () => {
    if (token != state.token) return
    const winged = wingedPlayers(server)
    if (!winged.length) { state.running = false; return }
    const time = server.tickCount / 20
    winged.forEach(p => drawWings(server, p, time))
    server.scheduleInTicks(FRAME_EVERY_TICKS, step)
  }
  server.scheduleInTicks(1, step)
}


// ===================== EVENTS & COMMANDS =====================

PlayerEvents.loggedIn(event => {
  if (hasWings(event.player)) startLoop(event.server)
})

if (Utils.server && wingedPlayers(Utils.server).length) startLoop(Utils.server)

ServerEvents.commandRegistry(event => {
  const Commands = event.commands
  const Arguments = event.arguments
  const reply = (ctx, text) => ctx.source.sendSystemMessage(Text.lightPurple(text))

  const setWings = (ctx, on) => {
    try {
      let server = ctx.source.server
      let p = Arguments.PLAYER.getResult(ctx, 'player')
      let name = nameOf(p)
      if (on == null) on = !hasWings(p)
      if (on) {
        if (!hasWings(p) && wingedPlayers(server).length >= MAX_WINGED_PLAYERS) {
          reply(ctx, 'Already ' + MAX_WINGED_PLAYERS + ' players have wings (MAX_WINGED_PLAYERS). Take some away first.')
          return 0
        }
        server.runCommandSilent('tag ' + name + ' add ' + TAG)
        startLoop(server)
        reply(ctx, name + ' now has fairy wings.')
      } else {
        server.runCommandSilent('tag ' + name + ' remove ' + TAG)
        reply(ctx, name + "'s fairy wings have been revoked.")
      }
      return 1
    } catch (e) {
      console.error('[FairyWings] ' + e)
      reply(ctx, 'Error: ' + e)
      return 0
    }
  }

  event.register(Commands.literal('wings')
    .requires(source => source.hasPermission(2))
    .then(Commands.literal('list').executes(ctx => {
      const names = wingedPlayers(ctx.source.server).map(nameOf)
      reply(ctx, names.length ? 'Winged (online): ' + names.join(', ') : 'Nobody online has wings.')
      return 1
    }))
    .then(Commands.argument('player', Arguments.PLAYER.create(event))
      .executes(ctx => setWings(ctx, null))
      .then(Commands.literal('on').executes(ctx => setWings(ctx, true)))
      .then(Commands.literal('off').executes(ctx => setWings(ctx, false)))))
})

})()
