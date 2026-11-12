// The Syndicate Slayer: a named Tinkers' Mattock (a Nucleum axe head, a Valyrium handle and a Tritonite adze head)
// that deals 17 base damage and heals whoever holds it with every kill.
//   - /slayer give <player> (op): a new one, built from its three materials (Tinkers fills in its stats and traits).
//   - /slayer bless (op): the tool in your main hand becomes the Slayer as it is (materials, modifiers and all), with
//     the damage, the healing and the name added.
//   - The damage is the item's own AttributeModifiers. Vanilla reads an item's tag before Tinkers' attributes, and
//     Tinkers takes a main-hand weapon's damage from the player's attribute, so the tag decides it. It replaces the
//     attack speed too, so that's set here as well: a Mattock's own 0.9.
//   - A kill made with it in the main hand heals HEAL_KILL, or HEAL_PLAYER for a player.
// Copy to <server>/kubejs/server_scripts/ and run /reload. See tools/kubejs/SYNDICATE_SLAYER.md.
// KubeJS 6 (Rhino): no template strings; `let` inside nested blocks; event.cancel() last.

(function () {

// ===================== SETTINGS =====================

const NAME = 'The Syndicate Slayer'
const NAME_COLOR = 'dark_red'
const TOOL = 'tconstruct:mattock'
// In the Mattock's part order: axe head, handle, adze head. (Its tooltip lists the two heads first.)
const MATERIALS = ['taiga:nucleum', 'taiga:valyrium', 'taiga:tritonite']
const DAMAGE = 17                     // base attack damage, a player's own 1 included (Strength and the like add to it)
const ATTACK_SPEED = 0.9              // attacks a second: a Mattock's own
const HEAL_KILL = 4                   // health healed per kill (2 = one heart)
const HEAL_PLAYER = 10                // ... per player killed
const LORE = ['Every kill heals its wielder.']

// ===================== HELPERS =====================

let Serializer = null
try { Serializer = Java.loadClass('net.minecraft.network.chat.Component$Serializer') } catch (e) { }
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
function snbtString(s) { return "'" + String(s).replace(/\\/g, '\\\\').replace(/'/g, "\\'") + "'" }
function r3(n) { return Math.round(Number(n) * 1000) / 1000 }
function trollcraftTag(stack) {
  if (!stack || stack.isEmpty()) return null
  const nbt = stack.nbt
  if (nbt == null || !nbt.contains('trollcraft')) return null
  return nbt.getCompound('trollcraft')
}
function isSlayer(stack) {
  try {
    let t = trollcraftTag(stack)
    return t != null && t.contains('slayer')
  } catch (e) { return false }
}

// ===================== THE SLAYER =====================

// What makes a tool the Slayer (the inside of an NBT compound): its damage and speed, its name and lore, its mark.
function slayerNbt() {
  const nameJson = { text: NAME, color: NAME_COLOR, bold: true, italic: false }
  const lore = [{ text: DAMAGE + ' damage', color: 'red', italic: false }].concat(LORE.map(l => ({ text: l, color: 'gray', italic: true })))
  return 'AttributeModifiers:[' +
    '{AttributeName:"minecraft:generic.attack_damage",Name:"slayer_damage",Amount:' + r3(DAMAGE - 1) + 'd,Operation:0,Slot:"mainhand",UUID:[I;1399419243,1098083689,-1871017463,1802396241]},' +
    '{AttributeName:"minecraft:generic.attack_speed",Name:"slayer_speed",Amount:' + r3(ATTACK_SPEED - 4) + 'd,Operation:0,Slot:"mainhand",UUID:[I;1399419243,1098083689,-1871017463,1802396242]}]' +
    ',display:{Name:' + snbtString(JSON.stringify(nameJson)) + ',Lore:[' + lore.map(l => snbtString(JSON.stringify(l))).join(',') + ']}' +
    ',trollcraft:{slayer:1b}'
}
// A new Slayer. Setting its tag makes Tinkers build the tool from its materials (stats, traits and all).
function makeSlayer() {
  return Item.of(TOOL, 1, '{tic_materials:[' + MATERIALS.map(m => '"' + m + '"').join(',') + '],' + slayerNbt() + '}')
}

// A kill with the Slayer in the main hand heals the killer.
EntityEvents.death(event => {
  const victim = event.entity, killer = attackerOf(event.source)
  if (!isPlayer(killer) || sameEntity(killer, victim)) return
  let held = null
  try { held = killer.mainHandItem } catch (e) { return }
  if (!isSlayer(held)) return
  try { killer.heal(isPlayer(victim) ? HEAL_PLAYER : HEAL_KILL) } catch (e) { console.warn('[Slayer] Heal: ' + e) }
})

// ===================== COMMANDS =====================

ServerEvents.commandRegistry(event => {
  const Commands = event.commands, Arguments = event.arguments
  const reply = (ctx, text, bad) => { ctx.source.sendSystemMessage(comp([{ text: '[Slayer] ', color: NAME_COLOR }, { text: text, color: bad ? 'red' : 'gray' }])); return bad ? 0 : 1 }
  const safe = fn => ctx => { try { return fn(ctx) } catch (e) { console.error('[Slayer] ' + e); return reply(ctx, 'Error: ' + e, true) } }
  event.register(Commands.literal('slayer').requires(src => src.hasPermission(2))
    .then(Commands.literal('give').then(Commands.argument('player', Arguments.PLAYER.create(event)).executes(safe(ctx => {
      const p = Arguments.PLAYER.getResult(ctx, 'player'), st = makeSlayer()
      if (!st || st.isEmpty()) return reply(ctx, TOOL + ' isn\'t in the pack.', true)
      p.give(st)
      console.info('[Slayer] Gave ' + NAME + ' to ' + nameOf(p))
      return reply(ctx, 'Gave ' + NAME + ' to ' + nameOf(p) + '.')
    }))))
    .then(Commands.literal('bless').executes(safe(ctx => {
      const p = ctx.source.getPlayer()
      if (!p) return reply(ctx, 'Run it in game, holding the tool.', true)
      const held = p.mainHandItem
      if (!held || held.isEmpty()) return reply(ctx, 'Hold the tool that should become ' + NAME + '.', true)
      p.setMainHandItem(held.withNBT(NBT.toTagCompound('{' + slayerNbt() + '}')))
      console.info('[Slayer] ' + nameOf(p) + ' made their ' + String(held.id) + ' into ' + NAME)
      return reply(ctx, 'Your ' + String(held.id) + ' is now ' + NAME + ': ' + DAMAGE + ' damage, and kills heal you.')
    }))))
})

// ===================== API =====================

global.SyndicateSlayer = {
  make: () => makeSlayer(),
  isSlayer: stack => isSlayer(stack),
}

})()
