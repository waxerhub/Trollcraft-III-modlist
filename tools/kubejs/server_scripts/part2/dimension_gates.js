// Part II: the Nether and the End open with the Blood Pool (see tools/kubejs/BLOOD_POOL.md, "Dimensions").
//
//  - The Nether opens at the Blood Pool's Nether tier (3), the End at its End tier (9). The tiers are set in
//    part2/blood_pool.js (NETHER_TIER, END_TIER).
//  - Nether portals: the startup script startup_scripts/nether_portal_whitelist.js stops portals lighting until
//    global.netherPortalsUnlocked (or the saved 'trollcraft_nether_unlocked' flag) is true. This script keeps that
//    switch in step with the Blood Pool's tier.
//  - The End: the Eye of Ender can't be crafted until the End tier (a Blood Pool item lock).
//  - Either way in: anyone found in a sealed dimension (a found Eye, a mod teleporter, a portal lit before) is sent
//    back to their last place outside it. Ops, creative and spectator players are exempt.
//
// Commands: /dimensiongates (op): what's open, and re-applies the switch.
// Part II only. Needs part2/blood_pool.js (and the startup script for the Nether portals).
// KubeJS 6 notes: no template strings; `let` inside nested blocks.

(function () {

// ===================== SETTINGS =====================

const CHECK_TICKS = 20                   // how often players in a sealed dimension are looked for (1 second)
const EXEMPT_OPS = true                  // ops (permission level 2) are never sent back
const NETHER = 'minecraft:the_nether'
const END = 'minecraft:the_end'
const NETHER_FLAG = 'trollcraft_nether_unlocked'   // read by startup_scripts/nether_portal_whitelist.js
const TO_DISCORD = true                  // the opening lines with tellraw @a (posted to Discord)
const VOICE = { tag: '[Ministry]', tagColor: 'dark_gray', textColor: 'gray' }
const LINES = {
  netherOpen: 'By order of the Ministry, the Nether is open. Portals may be lit. Bring a permit.',
  endOpen: 'By order of the Ministry, the End is open. Eyes of Ender may be manufactured. Nothing out there has been recorded.',
  bouncedNether: 'The Nether is sealed until the Blood Pool reaches Tier %n. You have been returned.',
  bouncedEnd: 'The End is sealed until the Blood Pool reaches Tier %n. There is nothing in the End. You have been returned.',
}


// ===================== HELPERS =====================

let Serializer = null
try { Serializer = Java.loadClass('net.minecraft.network.chat.Component$Serializer') } catch (e) { }

const S = { token: Date.now(), lastPos: {}, open: { nether: null, end: null } }

function onlinePlayers(server) {
  const list = server.players, out = []
  for (let i = 0; i < list.size(); i++) out.push(list.get(i))
  return out
}
function nameOf(p) { return String(p.getGameProfile().getName()) }
function uuidOf(e) {
  try { return String(e.getStringUuid()).toLowerCase() } catch (err) { }
  return String(e.getStringUUID()).toLowerCase()
}
function dimOf(p) {
  let d = p.level.dimension
  if (d != null && typeof d.location == 'function') d = d.location()
  return String(d)
}
function num(n) { return (Math.round(Number(n) * 100) / 100).toFixed(2) }
function exempt(p) {
  try { if (p.isCreative() || p.isSpectator()) return true } catch (e) { }
  try { if (EXEMPT_OPS && p.hasPermissions(2)) return true } catch (e) { }
  return false
}
function parts(text) { return [{ text: VOICE.tag, color: VOICE.tagColor, bold: true }, { text: ' ' + text, color: VOICE.textColor }] }
function tell(p, text) {
  const json = JSON.stringify([''].concat(parts(text)))
  try { p.tell(Serializer ? Serializer.fromJsonLenient(json) : Text.of(VOICE.tag + ' ' + text)) } catch (e) { }
}
function announce(server, text) {
  if (TO_DISCORD) {
    try { server.runCommandSilent('tellraw @a ' + JSON.stringify([''].concat(parts(text)))); return } catch (e) { }
  }
  onlinePlayers(server).forEach(p => tell(p, text))
}

function pool() { return global.BloodPool || null }
function tiers() {
  const B = pool()
  return { now: B ? Number(B.tier()) : 0, nether: B && B.netherTier != null ? B.netherTier : 3, end: B && B.endTier != null ? B.endTier : 9 }
}
function isOpen(dim) {
  const t = tiers()
  if (dim == NETHER) return t.now >= t.nether
  if (dim == END) return t.now >= t.end
  return true
}


// ===================== THE SWITCH =====================

// Puts the Nether portal switch in step with the tier; announces a dimension that has just opened (if asked).
function sync(server, announceIt) {
  if (!server) return
  const nether = isOpen(NETHER), end = isOpen(END), t = tiers()
  global.netherPortalsUnlocked = nether
  try { server.persistentData.putBoolean(NETHER_FLAG, nether) } catch (e) { console.error('[Gates] Could not save the Nether switch: ' + e) }
  if (announceIt) {
    if (nether && S.open.nether === false) announce(server, LINES.netherOpen)
    if (end && S.open.end === false) announce(server, LINES.endOpen)
  }
  S.open.nether = nether
  S.open.end = end
  console.info('[Gates] Tier ' + t.now + ': Nether ' + (nether ? 'open' : 'sealed until tier ' + t.nether) +
    ', End ' + (end ? 'open' : 'sealed until tier ' + t.end))
}


// ===================== SENDING PEOPLE BACK =====================

// Their last place in an open dimension; otherwise their spawn point; otherwise world spawn.
function returnSpot(server, p) {
  const last = S.lastPos[uuidOf(p)]
  if (last && isOpen(last.dim)) return last
  try {
    let pos = p.getRespawnPosition()
    if (pos != null) {
      let dim = 'minecraft:overworld'
      try { dim = String(p.getRespawnDimension().location()) } catch (e) { }
      if (isOpen(dim)) return { dim: dim, x: Number(pos.getX()) + 0.5, y: Number(pos.getY()) + 1, z: Number(pos.getZ()) + 0.5 }
    }
  } catch (e) { }
  let o = server.overworld
  if (typeof o == 'function') o = server.overworld()
  const s = o.getSharedSpawnPos()
  return { dim: 'minecraft:overworld', x: Number(s.getX()) + 0.5, y: Number(s.getY()), z: Number(s.getZ()) + 0.5 }
}
function sendBack(server, p, dim) {
  const to = returnSpot(server, p), t = tiers()
  try { server.runCommandSilent('execute in ' + to.dim + ' run tp ' + uuidOf(p) + ' ' + num(to.x) + ' ' + num(to.y) + ' ' + num(to.z)) } catch (e) {
    console.error('[Gates] Sending ' + nameOf(p) + ' back failed: ' + e)
    return
  }
  tell(p, (dim == END ? LINES.bouncedEnd : LINES.bouncedNether).replace('%n', dim == END ? t.end : t.nether))
  console.info('[Gates] ' + nameOf(p) + ' was in the sealed ' + dim + '; sent back to ' + to.dim + ' ' + Math.floor(to.x) + ' ' + Math.floor(to.y) + ' ' + Math.floor(to.z))
}
// Every CHECK_TICKS: remember where each player is, and send anyone in a sealed dimension back.
function startLoop(server) {
  const token = S.token
  global.dimensionGatesLoop = token            // a /reload starts a new loop; the old one stops here
  const step = () => {
    if (token != global.dimensionGatesLoop) return
    onlinePlayers(server).forEach(p => {
      try {
        let d = dimOf(p)
        if (isOpen(d)) {
          S.lastPos[uuidOf(p)] = { dim: d, x: Number(p.x), y: Number(p.y), z: Number(p.z) }
        } else if (!exempt(p)) {
          sendBack(server, p, d)
        }
      } catch (e) { }
    })
    server.scheduleInTicks(CHECK_TICKS, step)
  }
  server.scheduleInTicks(1, step)
}


// ===================== EVENTS AND API =====================

function start(server) {
  if (!pool()) console.warn('[Gates] part2/blood_pool.js is not loaded: the Nether and the End stay sealed.')
  sync(server, false)
  startLoop(server)
}
ServerEvents.loaded(event => start(event.server))
if (Utils.server) start(Utils.server)   // after /reload

global.DimensionGates = {
  sync: (server, announceIt) => sync(server, announceIt),   // blood_pool.js calls this whenever the tier changes
  isOpen: dim => isOpen(String(dim)),
}

ServerEvents.commandRegistry(event => {
  const Commands = event.commands
  event.register(Commands.literal('dimensiongates').requires(src => src.hasPermission(2)).executes(ctx => {
    sync(ctx.source.server, false)
    const t = tiers()
    ctx.source.sendSystemMessage(Text.of('[Gates] Blood Pool tier ' + t.now + '. Nether: ' + (isOpen(NETHER) ? 'open' : 'sealed until tier ' + t.nether) +
      '. End: ' + (isOpen(END) ? 'open' : 'sealed until tier ' + t.end) + '. Portal switch re-applied.'))
    return 1
  }))
})

})()
