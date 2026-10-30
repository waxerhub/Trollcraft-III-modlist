// /smite <player>  - strikes the player with lightning. It damages as normal, but any fire it starts
//                    (blocks or the player) is put out at once. Fire that was already burning nearby is kept.
// /aura <player>   - a swarm of lightning around the player for 2 seconds that follows them as they move.
//                    By default it's visual only: flash and thunder, no damage, no fire.
// /superaura <players> [lightning|blood|both]  (default both; @a works, up to SUPER_AURA_MAX_TARGETS players)
//                    lightning: 100 visual-only bolts in 5 seconds around each player, following them.
//                    blood: the Blood God's aura for 10 seconds: a spinning helix of red dust, crimson spores
//                    and red/black fireworks bursting high overhead (too high to hurt anyone).
//                    Everyone online is told with a [SIGNAL HIJACKED] line, sent to each player (not to Discord).
// Operators only (permission level 2). To give a rank access with FTB Ranks:
//   /ftbranks node add <rank> command.smite true
//   /ftbranks node add <rank> command.aura true
//   /ftbranks node add <rank> command.superaura true
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

// /superaura
const SUPER_AURA = { seconds: 5, bolts: 100, everyTicks: 2, minRadius: 2, maxRadius: 6 }   // 50 pulses of 2 bolts
const BLOOD_AURA = {
  seconds: 10,
  particleEveryTicks: 3,
  fireworkEveryTicks: 20,
  fireworkLifeTime: 30,          // ticks before a rocket bursts: about 15 blocks up, well out of its 5-block blast
  colors: [11141120, 16711680],  // dark red, red
  fade: [1973019],               // black
}
const SUPER_AURA_MAX_TARGETS = 5
const VOICE_BLOOD = { tag: '[SIGNAL HIJACKED]', tagColor: 'dark_red', textColor: 'red' }
const SUPER_AURA_LINES = {
  lightning: 'The sky splits open above %s.',
  blood: 'The Blood God\'s gaze falls upon %s.',
  both: 'The Blood God descends upon %s.',
}

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

let Serializer = null
try { Serializer = Java.loadClass('net.minecraft.network.chat.Component$Serializer') } catch (e) { }
function onlinePlayers(server) {
  const list = server.players, out = []
  for (let i = 0; i < list.size(); i++) out.push(list.get(i))
  return out
}
// To each online player with player.tell, so Simple Discord Link (which relays tellraw @a) doesn't post it.
function bloodLine(server, text) {
  const parts = ['', { text: VOICE_BLOOD.tag, color: VOICE_BLOOD.tagColor, bold: true }, { text: ' ' + text, color: VOICE_BLOOD.textColor }]
  let c = null
  if (Serializer) { try { c = Serializer.fromJsonLenient(JSON.stringify(parts)) } catch (e) { } }
  if (c == null) c = Text.of(VOICE_BLOOD.tag + ' ' + text)
  onlinePlayers(server).forEach(p => { try { p.tell(c) } catch (e) { } })
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

// 100 visual-only bolts over 5 seconds, around wherever the player is at each pulse.
function superLightning(server, target) {
  const pulses = Math.max(1, Math.round(SUPER_AURA.seconds * 20 / SUPER_AURA.everyTicks))
  const perPulse = Math.max(1, Math.round(SUPER_AURA.bolts / pulses))
  for (let i = 0; i < pulses; i++) {
    server.scheduleInTicks(i * SUPER_AURA.everyTicks + 1, () => {
      if (target.isRemoved()) return
      const level = levelOf(target), dim = dimensionId(level), p = pos(target)
      for (let b = 0; b < perPulse; b++) {
        let angle = Math.random() * TWO_PI
        let d = SUPER_AURA.minRadius + Math.random() * (SUPER_AURA.maxRadius - SUPER_AURA.minRadius)
        visualBolt(server, level, dim, p.x + Math.cos(angle) * d, p.y, p.z + Math.sin(angle) * d)
      }
    })
  }
}

function particle(server, dim, what, x, y, z, spread, speed, count) {
  server.runCommandSilent('execute in ' + dim + ' run particle ' + what + ' ' + num(x) + ' ' + num(y) + ' ' + num(z) + ' ' + spread + ' ' + speed + ' ' + count + ' force')
}
function bloodFirework(server, dim, p) {
  const angle = Math.random() * TWO_PI, d = 2 + Math.random() * 2
  const type = Math.random() < 0.5 ? 1 : 4   // large ball or burst
  const nbt = '{LifeTime:' + BLOOD_AURA.fireworkLifeTime + ',FireworksItem:{id:"minecraft:firework_rocket",Count:1b,tag:{Fireworks:{Flight:2b,Explosions:[{Type:' + type + 'b' +
    ',Colors:[I;' + BLOOD_AURA.colors.join(',') + '],FadeColors:[I;' + BLOOD_AURA.fade.join(',') + '],Trail:1b,Flicker:1b}]}}}}'
  server.runCommandSilent('execute in ' + dim + ' run summon minecraft:firework_rocket ' + num(p.x + Math.cos(angle) * d) + ' ' + num(p.y + 1) + ' ' + num(p.z + Math.sin(angle) * d) + ' ' + nbt)
}
// The Blood God's aura: 10 seconds of a spinning red helix, crimson spores and dark dust around the player, with a
// red/black firework every second, all following them.
function bloodAura(server, target) {
  const start = pos(target), dim0 = dimensionId(levelOf(target))
  server.runCommandSilent('execute in ' + dim0 + ' run playsound minecraft:entity.wither.spawn hostile @a ' + num(start.x) + ' ' + num(start.y) + ' ' + num(start.z) + ' 0.6 0.6')
  server.runCommandSilent('execute in ' + dim0 + ' run playsound minecraft:ambient.crimson_forest.mood ambient @a ' + num(start.x) + ' ' + num(start.y) + ' ' + num(start.z) + ' 2 0.8')
  const total = BLOOD_AURA.seconds * 20, ticks = []
  for (let t = 0; t < total; t += BLOOD_AURA.particleEveryTicks) ticks.push(t)
  // forEach, not the for loop: each scheduled pulse needs its own tick (closures in a loop share one in Rhino)
  ticks.forEach(tick => {
    server.scheduleInTicks(tick + 1, () => {
      if (target.isRemoved()) return
      const dim = dimensionId(levelOf(target)), p = pos(target), phase = tick * 0.35
      for (let strand = 0; strand < 2; strand++) {
        for (let i = 0; i < 6; i++) {
          let a = phase + i * 0.9 + strand * TWO_PI / 2
          particle(server, dim, 'minecraft:dust 0.6 0 0 1.6', p.x + Math.cos(a) * 1.2, p.y + 0.1 + i * 0.4, p.z + Math.sin(a) * 1.2, '0 0 0', 0, 1)
        }
      }
      particle(server, dim, 'minecraft:crimson_spore', p.x, p.y + 1, p.z, '0.8 1 0.8', 0, 12)
      particle(server, dim, 'minecraft:dust 0.15 0 0 1.2', p.x, p.y + 0.3, p.z, '0.7 0.1 0.7', 0, 4)
    })
  })
  for (let t = 0; t < total; t += BLOOD_AURA.fireworkEveryTicks) {
    server.scheduleInTicks(t + 2, () => {
      if (target.isRemoved()) return
      bloodFirework(server, dimensionId(levelOf(target)), pos(target))
    })
  }
}

function superAura(server, target, mode) {
  if (mode != 'blood') superLightning(server, target)
  if (mode != 'lightning') bloodAura(server, target)
  bloodLine(server, SUPER_AURA_LINES[mode].replace('%s', nameOf(target)))
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

  const superRun = mode => ctx => {
    try {
      let list = []
      Arguments.PLAYERS.getResult(ctx, 'targets').forEach(p => list.push(p))
      let picked = list.slice(0, SUPER_AURA_MAX_TARGETS)
      picked.forEach(p => superAura(ctx.source.server, p, mode))
      ctx.source.sendSystemMessage(Text.of('Super aura (' + mode + ') on ' + picked.map(nameOf).join(', ') +
        (list.length > picked.length ? ' (only the first ' + SUPER_AURA_MAX_TARGETS + ' of ' + list.length + ')' : '') + '.'))
      return picked.length
    } catch (e) {
      console.error('[Smite] /superaura failed: ' + e)
      ctx.source.sendSystemMessage(Text.red('/superaura failed: ' + e))
      return 0
    }
  }
  event.register(Commands.literal('superaura')
    .requires(source => source.hasPermission(2))
    .then(Commands.argument('targets', Arguments.PLAYERS.create(event)).executes(superRun('both'))
      .then(Commands.literal('both').executes(superRun('both')))
      .then(Commands.literal('lightning').executes(superRun('lightning')))
      .then(Commands.literal('blood').executes(superRun('blood')))))
})

})()
