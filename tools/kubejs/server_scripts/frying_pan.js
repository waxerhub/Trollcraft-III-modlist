// The Frying Pan: a super weapon that's really a Tinkers' Melting Pan (a Seared Stone pan on a Wood handle).
//   - BONK: every melee hit launches the target away from you, armour or not (it ignores knockback resistance), with
//     a clang. It only launches on a hit that really hurt (the Purge's sanctuary, spawn protection and the like stop it).
//   - SIZZLE: hits set the target alight for a few seconds ("fresh off the stove"), so animals it kills drop cooked meat.
//   - DING: a falling (critical) hit launches harder, rings a bell and leaves the target dizzy (nausea and slowness).
//     Better Combat's delayed hits count if the holder was falling just before (like the Anamian Axe's Judgement).
//   - It hits for 12 at 1 attack a second, set with the item's own AttributeModifiers (Tinkers takes a main-hand
//     weapon's damage from the player's attribute, so the tag decides it; see SYNDICATE_SLAYER.md). It still blocks
//     like a shield and melts what it mines: it's a Melting Pan.
//   - /pan give <player> (op): a new one. /pan bless (op): the tool in your main hand becomes it, as it is.
// Copy to <server>/kubejs/server_scripts/ and run /reload. See tools/kubejs/FRYING_PAN.md.
// KubeJS 6 (Rhino): no template strings; `let` inside nested blocks; event.cancel() last.

(function () {

// ===================== SETTINGS =====================

const NAME = 'The Frying Pan'
const NAME_COLOR = 'gold'
const TOOL = 'tconstruct:melting_pan'
const MATERIALS = ['tconstruct:seared_stone', 'tconstruct:wood']   // the pan (its plating), the handle (its limb)
const DAMAGE = 12                     // base attack damage, a player's own 1 included
const ATTACK_SPEED = 1.0              // attacks a second
// BONK: the speed the target is launched at (blocks a tick, away from you) and lifted at.
const LAUNCH = 1.6                    // about 8-10 blocks for a mob on flat ground
const LIFT = 0.45
// DING (a falling, critical hit): a bigger launch, a bell, and a dizzy target.
const DING_LAUNCH = 2.6
const DING_LIFT = 0.7
const DIZZY_SECONDS = 3               // nausea, and slowness II
const CRIT_GRACE_MS = 600             // Better Combat: a hit still counts as falling this long after the fall
// SIZZLE: seconds the target burns after a hit.
const SIZZLE_SECONDS = 3
const LORE = ['BONK. Hits send them flying.', 'Fresh off the stove: hits sizzle.', 'Hit while falling to ring the bell.']

// ===================== HELPERS =====================

let Serializer = null
try { Serializer = Java.loadClass('net.minecraft.network.chat.Component$Serializer') } catch (e) { }
const S = { falling: {} }             // uuid -> when the Pan's holder was last falling (ms)
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
function isPlayer(e) { try { return !!e && e.isPlayer() } catch (err) { return false } }
function sameEntity(a, b) {
  if (!a || !b) return false
  try { return uuidOf(a) == uuidOf(b) } catch (e) { return a === b }
}
function attackerOf(source) {
  try { return typeof source.getActual == 'function' ? source.getActual() : source.getEntity() } catch (e) { return null }
}
function directOf(source) {
  try { return typeof source.getImmediate == 'function' ? source.getImmediate() : source.getDirectEntity() } catch (e) { return null }
}
function bool(fn) { try { return !!fn() } catch (e) { return false } }
function pos(e) {
  try { return { x: Number(e.getX()), y: Number(e.getY()), z: Number(e.getZ()) } } catch (err) { }
  return { x: Number(e.x), y: Number(e.y), z: Number(e.z) }
}
function run(server, c) { try { return server.runCommandSilent(c) } catch (e) { return 0 } }
function snbtString(s) { return "'" + String(s).replace(/\\/g, '\\\\').replace(/'/g, "\\'") + "'" }
function r3(n) { return Math.round(Number(n) * 1000) / 1000 }
function trollcraftTag(stack) {
  if (!stack || stack.isEmpty()) return null
  const nbt = stack.nbt
  if (nbt == null || !nbt.contains('trollcraft')) return null
  return nbt.getCompound('trollcraft')
}
function isPan(stack) {
  try {
    let t = trollcraftTag(stack)
    return t != null && t.contains('frying_pan')
  } catch (e) { return false }
}
function inMainHand(p) { return bool(() => isPan(p.mainHandItem)) }

// ===================== THE PAN =====================

// What makes a tool the Frying Pan (the inside of an NBT compound): its damage and speed, its name and lore, its mark.
function panNbt() {
  const nameJson = { text: NAME, color: NAME_COLOR, bold: true, italic: false }
  const lore = [{ text: DAMAGE + ' damage', color: 'red', italic: false }].concat(LORE.map(l => ({ text: l, color: 'gray', italic: true })))
  return 'AttributeModifiers:[' +
    '{AttributeName:"minecraft:generic.attack_damage",Name:"pan_damage",Amount:' + r3(DAMAGE - 1) + 'd,Operation:0,Slot:"mainhand",UUID:[I;1180985454,1197417838,-1594437519,1885429281]},' +
    '{AttributeName:"minecraft:generic.attack_speed",Name:"pan_speed",Amount:' + r3(ATTACK_SPEED - 4) + 'd,Operation:0,Slot:"mainhand",UUID:[I;1180985454,1197417838,-1594437519,1885429282]}]' +
    ',display:{Name:' + snbtString(JSON.stringify(nameJson)) + ',Lore:[' + lore.map(l => snbtString(JSON.stringify(l))).join(',') + ']}' +
    ',trollcraft:{frying_pan:1b}'
}
// A new Pan. Setting its tag makes Tinkers build the tool from its materials.
function makePan() {
  return Item.of(TOOL, 1, '{tic_materials:[' + MATERIALS.map(m => '"' + m + '"').join(',') + '],' + panNbt() + '}')
}

// ===================== BONK, SIZZLE, DING =====================

// In the air and coming down, not in water, not riding: vanilla's critical hit.
function fallingNow(p) {
  let ground = null, fall = 0, vy = 0
  try { ground = !!p.onGround() } catch (e) { try { ground = !!p.onGround } catch (e2) { } }
  try { fall = Number(p.fallDistance) || 0 } catch (e) { }
  try {
    let v = p.getDeltaMovement()
    vy = Number(typeof v.y == 'function' ? v.y() : v.y) || 0
  } catch (e) { }
  return ground !== true && !bool(() => p.isInWater()) && !bool(() => p.isPassenger()) && (fall > 0 || vy < -0.05)
}
function isCrit(p) {
  if (bool(() => p.isInWater()) || bool(() => p.isPassenger())) return false
  if (fallingNow(p)) return true
  const t = S.falling[uuidOf(p)]
  return !!t && Date.now() - t <= CRIT_GRACE_MS
}
// Note when a Pan holder is falling, for Better Combat's delayed hits.
PlayerEvents.tick(event => {
  const p = event.player
  if (!inMainHand(p)) return
  if (fallingNow(p)) S.falling[uuidOf(p)] = Date.now()
})

// The launch, a tick after the hit: only if the hit really hurt (hurtTime is set), and the victim is still alive.
function bonk(server, from, victim, ding) {
  let hurt = 0
  try { hurt = Number(victim.hurtTime) || 0 } catch (e) { }
  if (!(hurt > 0) || !bool(() => victim.isAlive())) return
  const v = pos(victim)
  let dx = v.x - from.x, dz = v.z - from.z
  const d = Math.sqrt(dx * dx + dz * dz)
  if (d < 0.01) {
    let a = Math.random() * 6.2832
    dx = Math.cos(a); dz = Math.sin(a)
  } else { dx /= d; dz /= d }
  const speed = ding ? DING_LAUNCH : LAUNCH
  try {
    victim.setDeltaMovement(dx * speed, ding ? DING_LIFT : LIFT, dz * speed)
    victim.hurtMarked = true                         // sends the new motion to a player's game
  } catch (e) { console.warn('[Pan] Launch: ' + e) }
  try { victim.setSecondsOnFire(SIZZLE_SECONDS) } catch (e) { }
  const at = ' ' + r3(v.x) + ' ' + r3(v.y + 1) + ' ' + r3(v.z)
  run(server, 'playsound minecraft:block.anvil.land player @a' + at + ' 0.6 1.8')
  run(server, 'particle minecraft:crit' + at + ' 0.3 0.4 0.3 0.2 12 force')
  if (!ding) return
  const u = uuidOf(victim)
  run(server, 'playsound minecraft:block.bell.use player @a' + at + ' 1.0 1.4')
  run(server, 'particle minecraft:enchanted_hit' + at + ' 0.4 0.5 0.4 0.3 24 force')
  run(server, 'effect give ' + u + ' minecraft:nausea ' + (DIZZY_SECONDS + 2) + ' 0 true')
  run(server, 'effect give ' + u + ' minecraft:slowness ' + DIZZY_SECONDS + ' 1 true')
}
EntityEvents.hurt(event => {
  const victim = event.entity, source = event.source
  const attacker = attackerOf(source)
  if (!isPlayer(attacker) || sameEntity(attacker, victim)) return
  if (!sameEntity(directOf(source), attacker)) return   // a melee hit, not an arrow
  if (!inMainHand(attacker)) return
  const server = event.server || Utils.server, from = pos(attacker), ding = isCrit(attacker)
  server.scheduleInTicks(1, () => bonk(server, from, victim, ding))
})

// ===================== COMMANDS =====================

ServerEvents.commandRegistry(event => {
  const Commands = event.commands, Arguments = event.arguments
  const reply = (ctx, text, bad) => { ctx.source.sendSystemMessage(comp([{ text: '[Pan] ', color: NAME_COLOR }, { text: text, color: bad ? 'red' : 'gray' }])); return bad ? 0 : 1 }
  const safe = fn => ctx => { try { return fn(ctx) } catch (e) { console.error('[Pan] ' + e); return reply(ctx, 'Error: ' + e, true) } }
  event.register(Commands.literal('pan').requires(src => src.hasPermission(2))
    .then(Commands.literal('give').then(Commands.argument('player', Arguments.PLAYER.create(event)).executes(safe(ctx => {
      const p = Arguments.PLAYER.getResult(ctx, 'player'), st = makePan()
      if (!st || st.isEmpty()) return reply(ctx, TOOL + ' isn\'t in the pack.', true)
      p.give(st)
      console.info('[Pan] Gave ' + NAME + ' to ' + nameOf(p))
      return reply(ctx, 'Gave ' + NAME + ' to ' + nameOf(p) + '.')
    }))))
    .then(Commands.literal('bless').executes(safe(ctx => {
      const p = ctx.source.getPlayer()
      if (!p) return reply(ctx, 'Run it in game, holding the tool.', true)
      const held = p.mainHandItem
      if (!held || held.isEmpty()) return reply(ctx, 'Hold the tool that should become ' + NAME + '.', true)
      p.setMainHandItem(held.withNBT(NBT.toTagCompound('{' + panNbt() + '}')))
      console.info('[Pan] ' + nameOf(p) + ' made their ' + String(held.id) + ' into ' + NAME)
      return reply(ctx, 'Your ' + String(held.id) + ' is now ' + NAME + '. BONK.')
    }))))
})

// ===================== API =====================

global.FryingPan = {
  make: () => makePan(),
  isPan: stack => isPan(stack),
}

})()
