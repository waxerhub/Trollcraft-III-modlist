// /back costs Hush Coins. FTB Essentials' /back (its 5 s warmup and 30 s cooldown are in ftbessentials.snbt) now
// takes PRICE coins from players who aren't operators. The coins are destroyed.
//
// FTB Essentials can still turn /back down after the coins are taken (on cooldown, nothing to go back to, or the
// warmup broken by moving or taking damage), so the player is watched for CHECK_SECONDS: if they don't teleport
// (change dimension, or jump more than JUMP_BLOCKS between two looks), the coins are given back.
// Needs economy/black_market.js (global.Economy) for the coins; without it /back stays free.
// Copy to <server>/kubejs/server_scripts/ and run /reload. See tools/kubejs/BACK_TOLL.md.
// KubeJS 6 (Rhino): no template strings; `let` inside nested blocks.

(function () {

// ===================== SETTINGS =====================

const PRICE = 2                       // Hush Coins per /back
const COMMAND = 'back'                // FTB Essentials' command name
const WARMUP_SECONDS = 5              // FTB Essentials' back.warmup (ftbessentials.snbt)
const CHECK_SECONDS = WARMUP_SECONDS + 3   // how long to wait for the teleport before refunding
const SAMPLE_TICKS = 10               // how often the player is looked at while waiting
const JUMP_BLOCKS = 32                // a move this far between two looks is the teleport (elytra and horses stay under it)
const EXEMPT_OPS = true               // operators (permission level 2) pay nothing
const DATA_KEY = 'back_toll'          // server.persistentData: refunds owed to players who logged out while waiting

// ===================== STATE =====================

let Serializer = null
try { Serializer = Java.loadClass('net.minecraft.network.chat.Component$Serializer') } catch (e) { }

const pending = {}                    // uuid -> { name, left, last } while a paid /back is being watched
let warnedNoEconomy = false
let data = null

function load(server) {
  if (data) return data
  data = { owed: {} }
  let raw = null
  try { raw = server.persistentData.getString(DATA_KEY) } catch (e) { }
  if (raw) {
    try {
      let d = JSON.parse(String(raw))
      if (d && typeof d.owed == 'object') data = d
    } catch (e) {
      console.error('[BackToll] Saved data could not be read; a copy is kept under ' + DATA_KEY + '_broken')
      try { server.persistentData.putString(DATA_KEY + '_broken', String(raw)) } catch (e2) { }
    }
  }
  return data
}
function save(server) {
  try { server.persistentData.putString(DATA_KEY, JSON.stringify(load(server))) } catch (e) { console.error('[BackToll] Could not save: ' + e) }
}

// ===================== HELPERS =====================

function econ() { return global.Economy || null }
function nameOf(p) { return String(p.getGameProfile().getName()) }
function uuidOf(p) {
  try { return String(p.getStringUuid()) } catch (e) { }
  return String(p.getStringUUID())
}
function levelOf(e) { const l = e.level; return typeof l == 'function' ? e.level() : l }
function dimOf(e) {
  let d = levelOf(e).dimension
  if (typeof d == 'function') d = levelOf(e).dimension()
  if (d != null && typeof d.location == 'function') d = d.location()
  return String(d)
}
function where(p) {
  let x = 0, y = 0, z = 0
  try { x = Number(p.getX()); y = Number(p.getY()); z = Number(p.getZ()) } catch (e) { x = Number(p.x); y = Number(p.y); z = Number(p.z) }
  return { dim: dimOf(p), x: x, y: y, z: z }
}
function dist(a, b) { const dx = a.x - b.x, dy = a.y - b.y, dz = a.z - b.z; return Math.sqrt(dx * dx + dy * dy + dz * dz) }
function findPlayer(server, uuid) {
  const list = server.players
  for (let i = 0; i < list.size(); i++) {
    let p = list.get(i)
    if (uuidOf(p) == uuid) return p
  }
  return null
}
function coins(n) { const E = econ(); return E ? E.coinText(n) : n + ' Hush Coin' + (n == 1 ? '' : 's') }
function tell(p, text, color) {
  const json = JSON.stringify({ text: text, color: color || 'gold' })
  if (Serializer) { try { p.tell(Serializer.fromJsonLenient(json)); return } catch (e) { } }
  try { p.tell(text) } catch (e) { }
}

// ===================== THE TOLL =====================

function refund(p, why) {
  const E = econ()
  if (!E) return
  E.giveCoins(p, PRICE, 'back refund')
  tell(p, '/back didn\'t happen' + (why ? ' (' + why + ')' : '') + ': your ' + coins(PRICE) + ' are back.', 'yellow')
  console.info('[BackToll] ' + nameOf(p) + ': refunded ' + PRICE + (why ? ' (' + why + ')' : ''))
}

function watch(server, uuid) {
  const P = pending[uuid]
  if (!P) return
  const p = findPlayer(server, uuid)
  if (!p) {
    // Logged out while waiting: the coins are owed, and given back at the next login.
    delete pending[uuid]
    let D = load(server)
    D.owed[uuid] = (D.owed[uuid] || 0) + PRICE
    save(server)
    console.info('[BackToll] ' + P.name + ' logged out while waiting; ' + PRICE + ' owed at next login')
    return
  }
  const now = where(p)
  if (now.dim != P.last.dim || dist(now, P.last) > JUMP_BLOCKS) {
    delete pending[uuid]
    console.info('[BackToll] ' + P.name + ': /back done, ' + PRICE + ' paid')
    return
  }
  P.last = now
  P.left--
  if (P.left <= 0) {
    delete pending[uuid]
    refund(p, '')
    return
  }
  server.scheduleInTicks(SAMPLE_TICKS, () => watch(server, uuid))
}

ServerEvents.command(COMMAND, event => {
  const source = event.getParseResults().getContext().getSource()
  const p = source.getPlayer()
  if (p == null) return                                   // console and command blocks
  if (EXEMPT_OPS && source.hasPermission(2)) return
  const E = econ()
  if (!E) {
    if (!warnedNoEconomy) console.warn('[BackToll] economy/black_market.js is not installed: /back is free')
    warnedNoEconomy = true
    return
  }
  const server = event.server
  const uuid = uuidOf(p)
  let problem = null
  if (pending[uuid]) problem = 'Your last /back is still on its way.'
  else if (E.countCoins(p) < PRICE) problem = '/back costs ' + coins(PRICE) + '. You have ' + E.countCoins(p) + '.'
  else if (!E.takeCoins(p, PRICE)) problem = '/back costs ' + coins(PRICE) + '.'
  if (problem) {
    tell(p, problem, 'red')
    event.cancel()   // last: in KubeJS 6, cancel() stops this function immediately
  }
  pending[uuid] = { name: nameOf(p), left: Math.ceil(CHECK_SECONDS * 20 / SAMPLE_TICKS), last: where(p) }
  tell(p, coins(PRICE) + ' paid for /back. (Given back if it doesn\'t happen.)', 'gold')
  console.info('[BackToll] ' + nameOf(p) + ': charged ' + PRICE + ' for /back')
  server.scheduleInTicks(SAMPLE_TICKS, () => watch(server, uuid))
})

PlayerEvents.loggedIn(event => {
  const p = event.player
  const server = event.server
  const D = load(server)
  const uuid = uuidOf(p)
  const n = D.owed[uuid] || 0
  if (!n || !econ()) return
  econ().giveCoins(p, n, 'back refund (logged out while waiting)')
  delete D.owed[uuid]
  save(server)
  tell(p, 'You logged out before your /back happened: your ' + coins(n) + ' are back.', 'yellow')
})

})()
