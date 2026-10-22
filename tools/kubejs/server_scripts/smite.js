// /smite <player>  - strikes the player with lightning. It damages as normal, but any fire it starts
//                    (blocks or the player) is put out at once. Fire that was already burning nearby is kept.
// /aura <player>   - a swarm of lightning around the player for 2 seconds that follows them as they move.
//                    By default it's visual only: flash and thunder, no damage, no fire.
// Operators only (permission level 2). To give a rank access with FTB Ranks:
//   /ftbranks node add <rank> command.smite true
//   /ftbranks node add <rank> command.aura true
// Copy to <server>/kubejs/server_scripts/ and run /reload.
// Note: KubeJS 6's script engine (Rhino) has no `template strings`, so strings are joined with +.
// Heads-up: real lightning still does what lightning does to mobs nearby (pigs -> zombified piglins,
// villagers -> witches, creepers -> charged).

(function () {

// ===================== SETTINGS =====================

const ANNOUNCE = true            // tell everyone who was smitten
const EXTINGUISH_TARGET = true   // put out the player if the strike sets them on fire

const AURA_SECONDS = 2
const AURA_EVERY_TICKS = 2       // a pulse of lightning this often (20 ticks = 1 second)
const AURA_BOLTS_PER_PULSE = 2
const AURA_MIN_RADIUS = 1.5      // bolts land this far from the player...
const AURA_MAX_RADIUS = 4        // ...up to this far
const AURA_DAMAGES = false       // true = real, damaging lightning (fire is still put out)

const FIRE_CHECK_RADIUS = 2      // lightning only lights fire within a block or so of where it hits...
const FIRE_CHECK_TICKS = 12      // ...during its first few ticks, so this is all that needs checking

// Math.PI is missing in the server's script engine, so the value is written out here.
const TWO_PI = 6.283185307179586


// ===================== HELPERS =====================

// Some Minecraft names behave differently in KubeJS's script engine (level, dimension, position),
// so these read them in a way that works either way.
function levelOf(entity) { const l = entity.level; return typeof l == 'function' ? entity.level() : l }
function dimensionId(level) {
  let d = level.dimension
  if (typeof d == 'function') d = level.dimension()
  if (d != null && typeof d.location == 'function') d = d.location()
  return String(d)
}
function pos(entity) {
  const read = k => {
    let v = NaN
    try { v = Number(entity['get' + k.toUpperCase()]()) } catch (e) { }
    if (!isFinite(v)) v = Number(entity[k])
    return v
  }
  return { x: read('x'), y: read('y'), z: read('z') }
}
function nameOf(player) { return String(player.getGameProfile().getName()) }
function num(n) { return String(Math.round(n * 100) / 100) }
function extinguish(entity) {
  try { if (typeof entity.extinguish == 'function') entity.extinguish(); else entity.clearFire() } catch (e) { }
}

function ministry(server, text) {
  server.runCommandSilent('tellraw @a ' + JSON.stringify(['',
    { text: '[MINISTRY]', color: 'gold', bold: true }, { text: ' ' + text, color: 'yellow' }]))
}

function isFire(level, x, y, z) {
  const id = String(level.getBlock(x, y, z).id)
  return id == 'minecraft:fire' || id == 'minecraft:soul_fire'
}

// Real lightning. Fire it starts is removed for FIRE_CHECK_TICKS; fire already there before is left alone.
function realBolt(server, level, dim, x, y, z) {
  const bx = Math.floor(x), by = Math.floor(y), bz = Math.floor(z), r = FIRE_CHECK_RADIUS
  const existing = {}
  for (let dx = -r; dx <= r; dx++) for (let dy = -2; dy <= 3; dy++) for (let dz = -r; dz <= r; dz++) {
    if (isFire(level, bx + dx, by + dy, bz + dz)) existing[(bx + dx) + ',' + (by + dy) + ',' + (bz + dz)] = true
  }
  server.runCommandSilent('execute in ' + dim + ' run summon minecraft:lightning_bolt ' + num(x) + ' ' + num(y) + ' ' + num(z))
  for (let t = 1; t <= FIRE_CHECK_TICKS; t += 2) {
    server.scheduleInTicks(t, () => {
      for (let dx = -r; dx <= r; dx++) for (let dy = -2; dy <= 3; dy++) for (let dz = -r; dz <= r; dz++) {
        let x2 = bx + dx, y2 = by + dy, z2 = bz + dz
        if (!existing[x2 + ',' + y2 + ',' + z2] && isFire(level, x2, y2, z2)) {
          server.runCommandSilent('execute in ' + dim + ' run setblock ' + x2 + ' ' + y2 + ' ' + z2 + ' minecraft:air')
        }
      }
    })
  }
}

// Visual-only lightning: flash and thunder, no damage, no fire. If that can't be created, a spark and
// thunder sound are used instead (still harmless).
function visualBolt(server, level, dim, x, y, z) {
  try {
    let bolt = level.createEntity('minecraft:lightning_bolt')
    bolt.setVisualOnly(true)
    bolt.setPosition(x, y, z)
    bolt.spawn()
    return
  } catch (e) { }
  server.runCommandSilent('execute in ' + dim + ' run particle minecraft:electric_spark ' + num(x) + ' ' + num(y + 1) + ' ' + num(z) + ' 0.3 2 0.3 0.1 60 force')
  server.runCommandSilent('execute in ' + dim + ' run playsound minecraft:entity.lightning_bolt.thunder weather @a ' + num(x) + ' ' + num(y) + ' ' + num(z) + ' 4 1')
}

function smite(server, target) {
  const level = levelOf(target), dim = dimensionId(level), p = pos(target)
  realBolt(server, level, dim, p.x, p.y, p.z)
  if (EXTINGUISH_TARGET) {
    for (let t = 1; t <= 10; t += 3) server.scheduleInTicks(t, () => extinguish(target))
  }
  if (ANNOUNCE) ministry(server, nameOf(target) + ' has been smitten by order of the Ministry.')
}

function aura(server, target) {
  const pulses = Math.max(1, Math.round(AURA_SECONDS * 20 / AURA_EVERY_TICKS))
  for (let i = 0; i < pulses; i++) {
    server.scheduleInTicks(i * AURA_EVERY_TICKS + 1, () => {
      if (target.isRemoved()) return // logged out
      const level = levelOf(target), dim = dimensionId(level), p = pos(target)
      for (let b = 0; b < AURA_BOLTS_PER_PULSE; b++) {
        let angle = Math.random() * TWO_PI
        let d = AURA_MIN_RADIUS + Math.random() * (AURA_MAX_RADIUS - AURA_MIN_RADIUS)
        let x = p.x + Math.cos(angle) * d, z = p.z + Math.sin(angle) * d
        if (AURA_DAMAGES) realBolt(server, level, dim, x, p.y, z)
        else visualBolt(server, level, dim, x, p.y, z)
      }
      if (AURA_DAMAGES && EXTINGUISH_TARGET) extinguish(target)
    })
  }
  if (ANNOUNCE) ministry(server, nameOf(target) + ' has been granted a Ministry-sanctioned aura.')
}


// ===================== COMMANDS =====================

ServerEvents.commandRegistry(event => {
  const Commands = event.commands
  const Arguments = event.arguments

  const run = (fn, what) => ctx => {
    try {
      let target = Arguments.PLAYER.getResult(ctx, 'player')
      fn(ctx.source.server, target)
      return 1
    } catch (e) {
      console.error('[Smite] /' + what + ' failed: ' + e)
      ctx.source.sendSystemMessage(Text.red('/' + what + ' failed: ' + e))
      return 0
    }
  }

  event.register(Commands.literal('smite')
    .requires(source => source.hasPermission(2))
    .then(Commands.argument('player', Arguments.PLAYER.create(event)).executes(run(smite, 'smite'))))

  event.register(Commands.literal('aura')
    .requires(source => source.hasPermission(2))
    .then(Commands.argument('player', Arguments.PLAYER.create(event)).executes(run(aura, 'aura'))))
})

})()
