// Black Market: Blood Coins, a wandering Hooded Merchant, Ambush Contracts and Writs of Protection.
//
//  - Blood Coins are real items (gold nuggets with hidden NBT): they can be dropped, stolen and looted.
//  - The Hooded Merchant appears at one of the VENDOR_LOCATIONS for a while, then vanishes and turns up
//    somewhere else. Right-click him for the shop (a clickable chat menu). Everyone can trade with him.
//  - Ambush Contracts call an ambush (portal_ambush.js's mobs) on a chosen player when right-clicked.
//    The buyer is never shown to players; ops can read it with /blackmarket inspect (for Ministry trials).
//  - A Writ of Protection turns away the next contract called on its holder.
//  - Ops can sell any item, NBT and all, with /bm hand add <price>.
//
// Needs: factions/factions_core.js (global.Factions) and factions/portal_ambush.js (global.PortalAmbush).
// No new items are registered, so players don't need a modpack update. See tools/kubejs/BLACK_MARKET.md.
//
// Commands: /blackmarket (or /bm) for players at the vendor; /coins and most /blackmarket subcommands are
// op level 2. Copy to <server>/kubejs/server_scripts/economy/ and run /reload.
//
// KubeJS 6 notes: no template strings (strings are joined with +); `let` inside nested blocks; closures made in
// a loop use forEach; event.cancel() stops the handler immediately, so it always comes last; secret messages use
// player.tell, never tellraw @a (Simple Discord Link relays that to Discord).

(function () {

// ===================== SETTINGS =====================

const ENABLED_BY_DEFAULT = true        // /blackmarket toggle changes this and the change is saved

// --- Friendly fire and range ---
const ALLOW_SAME_FACTION = true        // contracts on players of your own faction
const MAX_CALL_RANGE = 0               // 0 = a contract works from any distance; otherwise the caller must be
                                       // within this many blocks of the target, in the same dimension

// --- Blood Coins ---
const COIN_ITEM = 'minecraft:gold_nugget'
const COIN_NAME = 'Blood Coin'
const COIN_LORE = 'Accepted where questions are not.'
const BLOCK_COIN_CRAFTING = true       // vanilla crafting recipes won't take coins as gold nuggets (see the docs)
// Ambush mobs killed by a player drop this many coins (portal_ambush.js groups). Off by default.
const AMBUSH_COIN_DROPS = { enabled: false, min: 0, max: 2 }

// What the merchant buys from players. EMPTY on purpose: Magical Crops, ProjectE and similar mods make most
// items farmable, so anything sellable would be an endless coin source. Only add things nobody can farm.
// Entry: { key: what /blackmarket sell <key> uses, item: exact item id (plain items only, no NBT),
//          per: how many items make one sale, coins: paid per sale }
//   e.g. { key: 'dragon_egg', item: 'minecraft:dragon_egg', per: 1, coins: 50 }
const SELL_LIST = []

// --- The vendor ---
const VENDOR_ENTITY = 'minecraft:wandering_trader'
const VENDOR_NAME = 'Hooded Merchant'
const VENDOR_NAME_COLOR = 'dark_purple'
// Where he can appear: { dim, x, y, z, name }. Ops can also add spots in game with /bm vendor addspot <name>
// (saved with the world). With no spots at all, he never appears.
const VENDOR_LOCATIONS = [
  // { dim: 'minecraft:overworld', x: 120, y: 64, z: -340, name: 'the old crossroads' },
]
const VENDOR_STAY_MINUTES = 90         // how long he stays at a spot
const VENDOR_GONE_MINUTES = 30         // how long he's gone before turning up at the next one
const NIGHT_ONLY = false               // true = he only appears during Overworld night
const VENDOR_RANGE = 6                 // players must be this close to him to buy or sell (checked on the server)
const PIG_ESCORT_PORTAL_RADIUS = 64    // never at a spot this close to an active Pig Escort portal
const RUMORS_TO_DISCORD = false        // true = the rumor goes out with tellraw @a, so Simple Discord Link posts it
const WHISPER_COORDS_TO = []           // faction ids whose members also get his exact coordinates, e.g. ['syndicate']

// --- Contracts ---
// tier: the RAID_TIERS entry in portal_ambush.js whose health/damage/Strength the mobs get.
// size: [min, max] mobs. mix: which mobs, per dimension (the Nether always uses the Blood-Marked Piglins' look).
const CONTRACTS = [
  { id: 'tipoff', name: 'Tip-off', price: 8, size: [2, 2], tier: 'light',
    desc: 'Two hired hands, just enough to make a point.',
    mix: { nether: [['piglin', 1]], overworld: [['vindicator', 0.5], ['pillager', 0.5]] } },
  { id: 'squad', name: 'Squad', price: 20, size: [4, 4], tier: 'moderate',
    desc: 'Four professionals. Bring armour.',
    mix: { nether: [['piglin', 0.7], ['brute', 0.3]], overworld: [['vindicator', 0.5], ['pillager', 0.5]] } },
  { id: 'warparty', name: 'War Party', price: 45, size: [6, 8], tier: 'lethal',
    desc: 'Six to eight killers, brutes or vindicators among them. Not a misunderstanding.',
    mix: { nether: [['brute', 0.5], ['piglin', 0.5]], overworld: [['vindicator', 0.6], ['pillager', 0.4]] } },
]
const WRIT_PRICE = 15
const TOKEN_EXPIRY_DAYS = 7            // real days a contract stays valid
const CONTRACT_COOLDOWN_MINUTES = 45   // after a contract is called on someone, no new contract on them this long
const HEAT_WINDOW_HOURS = 24           // heat = contracts called on a player in this window
const HEAT_PRICE_STEP = 0.5            // price = base x (1 + 0.5 x heat), rounded up
const AFK_MINUTES = 5                  // a target who hasn't moved or turned this long is AFK (no contract)
const CALL_WARNING_SECONDS = 3         // the target's warning comes this long before the mobs

// Overworld (and other dimension) contract mobs: their own look, so they aren't mistaken for Ministry Inspectors.
const HIRED_BLADES = {
  name: 'Hired Blade',
  nameColor: 'dark_gray',
  chestplateColor: 0x1D1D21,           // black leather
  mix: [['vindicator', 0.5], ['pillager', 0.5]],
  reward: { item: 'minecraft:iron_nugget', min: 1, max: 3 },
}

// --- Messages ---
const VOICE_CONTRACT = { tag: '[CONTRACT]', tagColor: 'dark_gray', textColor: 'red' }
const VOICE_CALLER = { tag: '[CONTRACT]', tagColor: 'dark_gray', textColor: 'gray' }
const VOICE_RUMOR = { tag: '[RUMOR]', tagColor: 'dark_purple', textColor: 'gray' }
const VOICE_MARKET = { tag: '[BLACK MARKET]', tagColor: 'dark_red', textColor: 'gray' }
const WARNING_SOUND = 'minecraft:entity.wither.ambient'


// ===================== STATE =====================

const DATA_KEY = 'economy'
const TAG_VENDOR = 'black_market_vendor'
const TAG_CONTRACT_MOB = 'contract_ambush'
const SAVE_EVERY_SECONDS = 15
const SLOW_LOOP_SECONDS = 30
const OVERWORLD = 'minecraft:overworld'
const NETHER = 'minecraft:the_nether'

// Kept across /reload (only things that can't be rebuilt from saved data).
if (!global.blackMarketState) global.blackMarketState = { token: 0 }
const S = global.blackMarketState
S.token++                      // stops loops from before a /reload
S.fastLoop = false
S.slowLoop = false
S.vendor = null                // the live vendor entity
S.expectVendor = false
S.lastVendor = null
S.lastUse = {}                 // uuid -> server tick of the last contract click (one click can fire two events)
if (!S.afk) S.afk = {}         // uuid -> { key, since }

let Serializer = null, StringArg = null
try { Serializer = Java.loadClass('net.minecraft.network.chat.Component$Serializer') } catch (e) { }
try { StringArg = Java.loadClass('com.mojang.brigadier.arguments.StringArgumentType') } catch (e) { }


// ===================== HELPERS =====================

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
function dist(a, b) { const dx = a.x - b.x, dy = a.y - b.y, dz = a.z - b.z; return Math.sqrt(dx * dx + dy * dy + dz * dz) }
function horiz(a, b) { const dx = a.x - b.x, dz = a.z - b.z; return Math.sqrt(dx * dx + dz * dz) }
function levelOf(e) { const l = e.level; return typeof l == 'function' ? e.level() : l }
function dimensionId(level) {
  let d = level.dimension
  if (typeof d == 'function') d = level.dimension()
  if (d != null && typeof d.location == 'function') d = d.location()
  return String(d)
}
function dimOf(e) { return dimensionId(levelOf(e)) }
function hasTag(e, tag) { return e != null && e.getTags().contains(tag) }
function onlinePlayers(server) {
  const list = server.players, out = []
  for (let i = 0; i < list.size(); i++) out.push(list.get(i))
  return out
}
function playerByUuid(server, u) {
  const all = onlinePlayers(server)
  for (let i = 0; i < all.length; i++) if (uuidOf(all[i]) == u) return all[i]
  return null
}
function playerByName(server, name) {
  const all = onlinePlayers(server), n = String(name).toLowerCase()
  for (let i = 0; i < all.length; i++) if (nameOf(all[i]).toLowerCase() == n) return all[i]
  return null
}
function isOp(p) { try { return p.hasPermissions(2) } catch (e) { return false } }
function randInt(min, max) { return min + Math.floor(Math.random() * (max - min + 1)) }
function factionOf(p) { try { return String(global.Factions.getFaction(p)) } catch (e) { return '' } }
function PA() { return global.PortalAmbush || null }       // looked up when needed (factions/ loads after economy/)
function snbtString(s) { return "'" + String(s).replace(/\\/g, '\\\\').replace(/'/g, "\\'") + "'" }
function dateText(ms) {
  const d = new Date(ms)
  const two = n => (n < 10 ? '0' : '') + n
  return d.getUTCFullYear() + '-' + two(d.getUTCMonth() + 1) + '-' + two(d.getUTCDate()) + ' ' + two(d.getUTCHours()) + ':' + two(d.getUTCMinutes()) + ' UTC'
}
function shortId() { return (Date.now() % 1679616).toString(36) + Math.floor(Math.random() * 1296).toString(36) }

// Text components: JSON (the /tellraw format) read by Minecraft's own reader. fromJsonLenient, not fromJson:
// fromJson has a text and a JSON-object version and the script engine refuses to pick one.
function comp(parts) {
  const json = JSON.stringify([''].concat(parts))
  if (Serializer) {
    try { return Serializer.fromJsonLenient(json) } catch (e) { }
  }
  return Text.of(parts.map(p => (typeof p == 'string' ? p : p.text || '')).join(''))
}
function voiceParts(voice, text) {
  return [{ text: voice.tag, color: voice.tagColor, bold: true }, { text: ' ' + text, color: voice.textColor }]
}
function say(p, voice, text) { try { p.tell(comp(voiceParts(voice, text))) } catch (e) { } }
function sound(server, p, id, pitch) {
  try { server.runCommandSilent('execute as ' + nameOf(p) + ' at @s run playsound ' + id + ' master @s ~ ~ ~ 1 ' + (pitch || 1)) } catch (e) { }
}
function button(label, color, command, hover) {
  return { text: label, color: color, bold: true, clickEvent: { action: 'run_command', value: command }, hoverEvent: { action: 'show_text', contents: hover || command } }
}


// ===================== SAVED DATA =====================
// server.persistentData['economy'] = one JSON string:
//   { v, enabled, nextId, contracts: { id: { tier, target, targetName, buyer, buyerName, issued, status, ... } },
//     heat: { uuid: [ms] }, cooldowns: { uuid: untilMs }, vendor: { ... }, vendorSpots: [ ... ],
//     notices: { uuid: [ { text, time } ] }, shop: { custom: { id: { ... } } } }
// Contract statuses: issued, calling, active, fulfilled, survived, interrupted, refused, expired.

let DB = null
let lastSave = 0, dirty = false
function db() {
  if (DB) return DB
  let raw = ''
  try { raw = String(Utils.server.persistentData.getString(DATA_KEY) || '') } catch (e) { }
  let parsed = null
  if (raw) {
    try { parsed = JSON.parse(raw) } catch (e) {
      try { Utils.server.persistentData.putString(DATA_KEY + '_unreadable_' + Date.now(), raw) } catch (e2) { }
      console.error('[BlackMarket] Saved data could not be read (' + e + '); a copy was kept and it starts fresh.')
    }
  }
  DB = parsed && parsed.v ? parsed : { v: 1 }
  if (typeof DB.enabled != 'boolean') DB.enabled = ENABLED_BY_DEFAULT
  if (!DB.nextId) DB.nextId = 1
  ;['contracts', 'heat', 'cooldowns', 'notices'].forEach(k => { if (!DB[k]) DB[k] = {} })
  if (!DB.vendor) DB.vendor = { present: false, nextAt: 0 }
  if (!DB.vendorSpots) DB.vendorSpots = []
  if (!DB.shop) DB.shop = {}
  if (!DB.shop.custom) DB.shop.custom = {}
  return DB
}
function save() {
  try { Utils.server.persistentData.putString(DATA_KEY, JSON.stringify(db())) } catch (e) { console.error('[BlackMarket] Save failed: ' + e) }
  lastSave = Date.now()
  dirty = false
}
function saveSoon() {
  dirty = true
  if (Date.now() - lastSave >= SAVE_EVERY_SECONDS * 1000) save()
}
function isEnabled() { return db().enabled }

// Removes old entries: finished contracts and notices after 30 days, heat outside its window, old cooldowns.
function prune() {
  const D = db(), now = Date.now(), month = 30 * 86400000
  Object.keys(D.contracts).forEach(id => {
    let c = D.contracts[id]
    let done = ['issued', 'calling', 'active'].indexOf(c.status) < 0
    if (done && now - (c.endedAt || c.issued) > month) delete D.contracts[id]
    else if (c.status == 'issued' && now - c.issued > TOKEN_EXPIRY_DAYS * 86400000 + month) delete D.contracts[id]
  })
  Object.keys(D.heat).forEach(u => {
    D.heat[u] = D.heat[u].filter(t => now - t < HEAT_WINDOW_HOURS * 3600000)
    if (!D.heat[u].length) delete D.heat[u]
  })
  Object.keys(D.cooldowns).forEach(u => { if (D.cooldowns[u] <= now) delete D.cooldowns[u] })
  Object.keys(D.notices).forEach(u => {
    D.notices[u] = D.notices[u].filter(n => now - n.time < month)
    if (!D.notices[u].length) delete D.notices[u]
  })
  dirty = true
}


// ===================== ITEMS =====================
// Built from vanilla items with NBT, always the same way, so coins stack.

function trollcraftTag(stack) {
  if (!stack || stack.isEmpty()) return null
  const nbt = stack.nbt
  if (nbt == null || !nbt.contains('trollcraft')) return null
  return nbt.getCompound('trollcraft')
}
function isCoin(stack) {
  if (!stack || stack.isEmpty() || String(stack.id) != COIN_ITEM) return false
  const t = trollcraftTag(stack)
  return t != null && t.contains('coin')
}
function contractIdOf(stack) {
  const t = trollcraftTag(stack)
  if (t == null || !t.contains('contract')) return null
  return String(t.getCompound('contract').getString('id'))
}
function isWrit(stack) {
  const t = trollcraftTag(stack)
  return t != null && t.contains('writ')
}
function displayNbt(name, color, lore) {
  return 'display:{Name:' + snbtString(JSON.stringify({ text: name, color: color, italic: false })) +
    ',Lore:[' + lore.map(l => snbtString(JSON.stringify({ text: l.text, color: l.color || 'gray', italic: !!l.italic }))).join(',') + ']}'
}
// The enchantment is only there for the glint, and hidden from the tooltip (HideFlags:1).
function coinStack(n) {
  return Item.of(COIN_ITEM, n, '{trollcraft:{coin:1b},' + displayNbt(COIN_NAME, 'dark_red', [{ text: COIN_LORE, color: 'dark_gray', italic: true }]) +
    ',Enchantments:[{id:"minecraft:unbreaking",lvl:1s}],HideFlags:1}')
}
function contractStack(c, id) {
  const def = contractDef(c.tier)
  const tierName = def ? def.name : c.tier
  return Item.of('minecraft:skull_banner_pattern', 1, '{trollcraft:{contract:{id:"' + id + '",tier:"' + c.tier + '",target:"' + c.target +
    '",targetName:' + snbtString(c.targetName) + ',issued:' + c.issued + 'L}},' +
    displayNbt('Ambush Contract (' + tierName + ')', 'dark_red', [
      { text: 'Target: ' + c.targetName, color: 'gray' },
      { text: 'Right-click to call it in.', color: 'dark_gray', italic: true },
      { text: 'Expires: ' + dateText(c.issued + TOKEN_EXPIRY_DAYS * 86400000), color: 'dark_gray' },
    ]) + ',Enchantments:[{id:"minecraft:unbreaking",lvl:1s}],HideFlags:33}')
}
function voidContractStack() {
  return Item.of('minecraft:skull_banner_pattern', 1, '{' + displayNbt('Void Contract', 'dark_gray', [{ text: 'Worthless now.', color: 'dark_gray', italic: true }]) + ',HideFlags:32}')
}
function writStack() {
  return Item.of('minecraft:paper', 1, '{trollcraft:{writ:1b},' + displayNbt('Writ of Protection', 'gold', [
    { text: 'The next contract called on you is refused.', color: 'gray' },
    { text: 'Used up when it does.', color: 'dark_gray', italic: true },
  ]) + ',Enchantments:[{id:"minecraft:unbreaking",lvl:1s}],HideFlags:1}')
}

// Main inventory and hotbar = slots 0-35; 40 = offhand.
function invSlots(withOffhand) {
  const out = []
  for (let i = 0; i < 36; i++) out.push(i)
  if (withOffhand) out.push(40)
  return out
}
function countCoins(p) {
  const inv = p.inventory
  let n = 0
  invSlots(false).forEach(i => { let s = inv.getItem(i); if (isCoin(s)) n += s.getCount() })
  return n
}
function takeCoins(p, n) {
  if (countCoins(p) < n) return false
  const inv = p.inventory
  let left = n
  invSlots(false).forEach(i => {
    if (left <= 0) return
    let s = inv.getItem(i)
    if (!isCoin(s)) return
    let k = Math.min(left, s.getCount())
    s.shrink(k)
    left -= k
  })
  return true
}
// Gives n coins (stacks of 64); anything that doesn't fit drops at the player's feet.
function giveCoins(p, n) {
  let left = Math.max(0, Math.floor(n))
  while (left > 0) {
    let k = Math.min(64, left)
    p.give(coinStack(k))
    left -= k
  }
}
function findSlot(p, test, withOffhand) {
  const inv = p.inventory, slots = invSlots(withOffhand)
  for (let i = 0; i < slots.length; i++) {
    let s = inv.getItem(slots[i])
    if (test(s)) return slots[i]
  }
  return -1
}
function removeContractItem(p, id) {
  const slot = findSlot(p, s => contractIdOf(s) == id, true)
  if (slot < 0) return false
  p.inventory.getItem(slot).shrink(1)
  return true
}


// ===================== CONTRACTS, HEAT, COOLDOWNS =====================

function contractDef(id) { return CONTRACTS.filter(c => c.id == id)[0] || null }
function heatOf(u) {
  const now = Date.now()
  return (db().heat[u] || []).filter(t => now - t < HEAT_WINDOW_HOURS * 3600000).length
}
function priceFor(def, targetUuid) { return Math.ceil(def.price * (1 + HEAT_PRICE_STEP * heatOf(targetUuid))) }
function contractCooldownLeft(u) { const t = db().cooldowns[u]; return t && t > Date.now() ? t - Date.now() : 0 }
function newContractId() {
  const D = db()
  const id = 'c' + D.nextId.toString(36) + Math.floor(Math.random() * 1296).toString(36)
  D.nextId++
  return id
}
function createContract(tierId, target, buyer, price) {
  const id = newContractId()
  const c = { tier: tierId, target: target.uuid, targetName: target.name, buyer: buyer ? uuidOf(buyer) : 'server', buyerName: buyer ? nameOf(buyer) : 'server',
    issued: Date.now(), status: 'issued', price: price }
  db().contracts[id] = c
  save()
  return { id: id, c: c, stack: contractStack(c, id) }
}
function notify(server, u, voice, text) {
  const p = server ? playerByUuid(server, u) : null
  if (p) { say(p, voice, text); return }
  const D = db()
  if (!D.notices[u]) D.notices[u] = []
  D.notices[u].push({ text: text, time: Date.now() })
  dirty = true
}

// AFK: sampled every SLOW_LOOP_SECONDS. A player whose position and view haven't changed for AFK_MINUTES is AFK.
function viewKey(p) {
  const q = posOf(p)
  let yaw = 0, pitch = 0
  try { yaw = p.getYRot(); pitch = p.getXRot() } catch (e) { try { yaw = p.yaw; pitch = p.pitch } catch (e2) { } }
  return [q.x, q.y, q.z, yaw, pitch].map(v => Math.round(Number(v) * 10)).join(',')
}
function sampleAfk(server) {
  const now = Date.now(), seen = {}
  onlinePlayers(server).forEach(p => {
    let u = uuidOf(p), k = viewKey(p)
    seen[u] = true
    if (!S.afk[u] || S.afk[u].key != k) S.afk[u] = { key: k, since: now }
  })
  Object.keys(S.afk).forEach(u => { if (!seen[u]) delete S.afk[u] })
}
function isAfk(p) {
  const a = S.afk[uuidOf(p)]
  return !!a && Date.now() - a.since >= AFK_MINUTES * 60000 && a.key == viewKey(p)
}

// Can a contract be called on target right now? Returns null, or a short reason that never gives away where
// the target is.
function whyCantCall(server, caller, target) {
  const pa = PA()
  if (!isEnabled()) return 'The black market is closed.'
  if (!pa) return 'Nobody is taking contracts right now.'
  if (pa.isPeaceful(server) || !pa.isEnabled()) return 'Nobody is taking contracts right now.'
  if (!target) return 'The target is not around.'
  const tu = uuidOf(target)
  if (tu == uuidOf(caller)) return 'You can\'t take a contract out on yourself.'
  if (!ALLOW_SAME_FACTION && factionOf(target) && factionOf(target) == factionOf(caller) && factionOf(caller) != 'unregistered') return 'Contracts on your own people are not accepted.'
  try { if (target.isCreative() || target.isSpectator()) return 'The target can\'t be reached right now.' } catch (e) { }
  if (isAfk(target)) return 'The target isn\'t moving. The hired hands won\'t go after an easy mark.'
  const tp = posOf(target), td = dimOf(target)
  if (pa.isPigEscortParticipant(target) || pa.inSafeZone(server, td, tp)) return 'The target is somewhere the hired hands won\'t go.'
  if (pa.inGroup(tu)) return 'The target is already dealing with company.'
  if (pa.cooldownLeftMs(tu) > 0 || contractCooldownLeft(tu) > 0) return 'The target was hit recently. Try again later.'
  if (MAX_CALL_RANGE > 0 && (dimOf(caller) != td || dist(posOf(caller), tp) > MAX_CALL_RANGE)) return 'You\'re too far from the target to call it in.'
  return null
}

// The tier object for portal_ambush: the RAID_TIERS entry's stats with this contract's mob mix (no evokers).
function contractTier(def) {
  const pa = PA()
  const base = pa ? pa.tiers.filter(t => t.id == def.tier)[0] : null
  const t = {}
  if (base) Object.keys(base).forEach(k => { t[k] = base[k] })
  t.id = def.tier
  t.mix = def.mix
  t.maxEvokers = 0
  return t
}

// Right-click with a contract (in the air or on a block). Returns true if the click was a contract.
function useContract(server, p, stack) {
  const id = contractIdOf(stack)
  if (id == null) return false
  const D = db(), c = D.contracts[id]
  const now = Date.now()
  if (c && c.status == 'calling') { say(p, VOICE_CALLER, 'This contract is already being called in.'); return true }
  if (!c || c.status != 'issued') {
    stack.shrink(stack.getCount())
    say(p, VOICE_CALLER, 'This contract is void.')
    return true
  }
  if (now - c.issued > TOKEN_EXPIRY_DAYS * 86400000) {
    c.status = 'expired'
    c.endedAt = now
    save()
    stack.shrink(1)
    p.give(voidContractStack())
    say(p, VOICE_CALLER, 'This contract has expired. It\'s worthless now.')
    return true
  }
  const def = contractDef(c.tier)
  const target = playerByUuid(server, c.target)
  let why = whyCantCall(server, p, target)
  if (!why && def && PA().mobRoom() < def.size[0]) why = 'Nobody is free to take the job right now. Try again later.'
  if (!why && !def) why = 'This kind of contract isn\'t offered any more.'
  if (why) { say(p, VOICE_CALLER, why); return true }
  // The Writ of Protection: both the writ and the contract are used up.
  const writSlot = findSlot(target, isWrit, true)
  if (writSlot >= 0) {
    target.inventory.getItem(writSlot).shrink(1)
    stack.shrink(1)
    c.status = 'refused'
    c.endedAt = now
    save()
    say(p, VOICE_CALLER, 'The contract was refused. The target was protected.')
    say(target, VOICE_CALLER, 'Your Writ of Protection turned away a contract on your life. It is used up.')
    return true
  }
  // Calling: the target is warned now, the mobs come CALL_WARNING_SECONDS later.
  c.status = 'calling'
  save()
  say(target, VOICE_CONTRACT, 'Someone has paid for your death.')
  sound(server, target, WARNING_SOUND, 0.6)
  const token = S.token, callerUuid = uuidOf(p)
  server.scheduleInTicks(CALL_WARNING_SECONDS * 20, () => {
    if (token != S.token) return   // the script reloaded: the load-time sweep puts it back to issued
    try { finishCall(server, id, callerUuid) } catch (e) {
      console.error('[BlackMarket] Calling contract ' + id + ' failed: ' + e)
      let cc = db().contracts[id]
      if (cc && cc.status == 'calling') { cc.status = 'issued'; save() }
    }
  })
  return true
}

function finishCall(server, id, callerUuid) {
  const c = db().contracts[id]
  if (!c || c.status != 'calling') return
  const def = contractDef(c.tier), pa = PA()
  const caller = playerByUuid(server, callerUuid)
  const target = playerByUuid(server, c.target)
  let g = null
  if (target && pa && def && !pa.inGroup(c.target) && !pa.inSafeZone(server, dimOf(target), posOf(target)) && !pa.isPigEscortParticipant(target)) {
    let dim = dimOf(target)
    g = pa.startGroup({
      targets: [c.target], mechanic: 'contract', dim: dim, size: Math.min(pa.groupMax, randInt(def.size[0], def.size[1])),
      def: dim == NETHER ? null : HIRED_BLADES, tier: contractTier(def), contractId: id,
      // Looked up when the group ends, so a /reload in between still reaches the current script.
      onEnd: (group, reason) => { if (global.Economy && global.Economy._groupEnded) global.Economy._groupEnded(id, reason) },
    })
  }
  if (!g) {
    c.status = 'issued'
    save()
    if (caller) say(caller, VOICE_CALLER, 'The contract could not be carried out.')
    return
  }
  c.status = 'active'
  c.calledAt = Date.now()
  c.groupId = g.id
  const D = db()
  if (!D.heat[c.target]) D.heat[c.target] = []
  D.heat[c.target].push(Date.now())
  D.cooldowns[c.target] = Date.now() + CONTRACT_COOLDOWN_MINUTES * 60000
  save()
  if (caller) {
    removeContractItem(caller, id)
    say(caller, VOICE_CALLER, 'Your contract has been called in.')
  }
  console.info('[BlackMarket] Contract ' + id + ' (' + c.tier + ') called on ' + c.targetName + ' by ' + c.buyerName + ': ' + Object.keys(g.mobs).length + ' mob(s)')
}

// From portal_ambush (through global.Economy): a contract's group ended.
function groupEnded(id, reason) {
  const c = db().contracts[id]
  if (!c || c.status != 'active') return
  const server = Utils.server
  c.endedAt = Date.now()
  if (reason == 'reload' || reason == 'cleared') {
    c.status = 'interrupted'
    notify(server, c.buyer, VOICE_CALLER, 'The contract was interrupted.')
  } else {
    c.status = 'survived'
    notify(server, c.buyer, VOICE_CALLER, 'The target survived.')
  }
  save()
}

const listeners = []
function fulfilled(server, id, c) {
  c.status = 'fulfilled'
  c.endedAt = Date.now()
  save()
  notify(server, c.buyer, VOICE_CALLER, 'Contract fulfilled.')
  listeners.forEach(fn => {
    try { fn(c.buyer, c.target, id) } catch (e) { console.error('[BlackMarket] A contract-fulfilled listener failed: ' + e) }
  })
}

// After a restart (or a /reload, once portal_ambush has ended its groups): anything still active has no
// group any more, and a contract that was mid-call never spawned.
function sweepContracts(server) {
  const D = db()
  Object.keys(D.contracts).forEach(id => {
    let c = D.contracts[id]
    if (c.status == 'calling') c.status = 'issued'
    else if (c.status == 'active') {
      let alive = false
      try {
        let st = global.portalAmbushState
        alive = !!(st && c.groupId && st.groups[c.groupId])
      } catch (e) { }
      if (!alive) {
        c.status = 'interrupted'
        c.endedAt = Date.now()
        notify(server, c.buyer, VOICE_CALLER, 'The contract was interrupted.')
      }
    }
  })
  save()
}


// ===================== THE VENDOR =====================

function allSpots() { return VENDOR_LOCATIONS.concat(db().vendorSpots) }
// Underscores in a typed name stand for spaces (command arguments are one word).
function spotByName(name) {
  const n = String(name).replace(/_/g, ' ').toLowerCase()
  return allSpots().filter(s => String(s.name).toLowerCase() == n)[0] || null
}
function nearPigEscort(spot) {
  const pe = global.pigEscortState
  const active = pe && (pe.phase == 'countdown' || pe.phase == 'running' || pe.phase == 'ending' || pe.phase == 'finale') && pe.run && pe.run.site
  return !!(active && spot.dim == OVERWORLD && horiz(spot, pe.run.site) <= PIG_ESCORT_PORTAL_RADIUS)
}
function overworldOf(server) { const o = server.overworld; return typeof o == 'function' ? server.overworld() : o }
function isNight(server) {
  try {
    let t = Number(overworldOf(server).getDayTime()) % 24000
    return t >= 13000 && t < 23000
  } catch (e) { }
  return true
}
function chunkOf(spot) { return [Math.floor(spot.x) >> 4, Math.floor(spot.z) >> 4] }
function forceload(server, spot, on) {
  try { server.runCommandSilent('execute in ' + spot.dim + ' run forceload ' + (on ? 'add ' : 'remove ') + Math.floor(spot.x) + ' ' + Math.floor(spot.z)) } catch (e) { }
}
function vendorPos() {
  const v = db().vendor
  return v.spot ? { x: Math.floor(v.spot.x) + 0.5, y: Math.floor(v.spot.y), z: Math.floor(v.spot.z) + 0.5 } : null
}
function vendorAlive() {
  try { return S.vendor != null && !S.vendor.isRemoved() && S.vendor.isAlive() } catch (e) { return false }
}

// Summons the vendor at the saved spot with the saved id. The entity is caught as it joins (EntityEvents.spawned).
function summonVendor(server) {
  const v = db().vendor, q = vendorPos()
  if (!q) return false
  const nbt = '{NoAI:1b,Invulnerable:1b,Silent:1b,PersistenceRequired:1b,DespawnDelay:0,Offers:{Recipes:[]}' +
    ',CustomName:' + snbtString(JSON.stringify({ text: VENDOR_NAME, color: VENDOR_NAME_COLOR, italic: false })) + ',CustomNameVisible:1b' +
    ',Tags:["' + TAG_VENDOR + '","bm_vendor_' + v.id + '"]}'
  S.lastVendor = null
  S.expectVendor = true
  let ok = 0
  try { ok = server.runCommandSilent('execute in ' + v.spot.dim + ' run summon ' + VENDOR_ENTITY + ' ' + q.x + ' ' + q.y + ' ' + q.z + ' ' + nbt) } finally { S.expectVendor = false }
  S.vendor = S.lastVendor
  S.lastVendor = null
  return !!(ok && S.vendor)
}
function removeVendorEntities(server) {
  if (S.vendor) { try { S.vendor.discard() } catch (e) { } }
  S.vendor = null
  try { server.runCommandSilent('kill @e[tag=' + TAG_VENDOR + ']') } catch (e) { }
}

// He turns up at a spot (a random one unless spotName is given). Returns a reply for the commands.
function vendorAppear(server, spotName, quiet) {
  const D = db(), v = D.vendor
  if (v.present) vendorLeave(server, true)
  let spot = null
  if (spotName) {
    spot = spotByName(spotName)
    if (!spot) return 'No vendor spot called "' + spotName + '". /bm vendor spots lists them.'
    if (nearPigEscort(spot)) return 'That spot is too close to the Pig Escort portal right now.'
  } else {
    let options = allSpots().filter(s => !nearPigEscort(s))
    let others = options.filter(s => !v.lastSpot || s.name != v.lastSpot)
    if (others.length) options = others
    if (!options.length) return 'There are no vendor spots (add one with /bm vendor addspot <name>).'
    spot = options[Math.floor(Math.random() * options.length)]
  }
  v.present = true
  v.spot = { dim: spot.dim, x: spot.x, y: spot.y, z: spot.z, name: spot.name }
  v.id = shortId()
  v.until = Date.now() + VENDOR_STAY_MINUTES * 60000
  save()
  forceload(server, spot, true)
  // The chunk loads over the next ticks; summon once it's there.
  const token = S.token
  server.scheduleInTicks(40, () => {
    if (token != S.token || !db().vendor.present || db().vendor.id != v.id) return
    if (!summonVendor(server)) console.warn('[BlackMarket] The vendor could not be summoned at ' + spot.name)
    startFastLoop(server)
  })
  if (!quiet) rumor(server, spot)
  console.info('[BlackMarket] The vendor appears at ' + spot.name + ' (' + spot.dim + ' ' + spot.x + ' ' + spot.y + ' ' + spot.z + ')')
  return 'The Hooded Merchant appears near ' + spot.name + ' (' + spot.dim + ' ' + spot.x + ' ' + spot.y + ' ' + spot.z + ') for ' + VENDOR_STAY_MINUTES + ' minutes.'
}
function vendorLeave(server, moving) {
  const D = db(), v = D.vendor
  if (!v.present) return
  const q = vendorPos()
  if (q) {
    try { server.runCommandSilent('execute in ' + v.spot.dim + ' run particle minecraft:large_smoke ' + q.x + ' ' + (q.y + 1) + ' ' + q.z + ' 0.3 0.6 0.3 0.02 40 force') } catch (e) { }
  }
  removeVendorEntities(server)
  if (v.spot) forceload(server, v.spot, false)
  v.lastSpot = v.spot ? v.spot.name : null
  v.present = false
  v.spot = null
  v.nextAt = Date.now() + (moving ? 0 : VENDOR_GONE_MINUTES * 60000)
  save()
}
function rumor(server, spot) {
  const text = 'A hooded merchant has been seen near ' + spot.name + '.'
  if (RUMORS_TO_DISCORD) {
    try { server.runCommandSilent('tellraw @a ' + JSON.stringify([''].concat(voiceParts(VOICE_RUMOR, text)))) } catch (e) { }
  } else {
    onlinePlayers(server).forEach(p => say(p, VOICE_RUMOR, text))
  }
  if (WHISPER_COORDS_TO.length) {
    onlinePlayers(server).forEach(p => {
      if (WHISPER_COORDS_TO.indexOf(factionOf(p)) >= 0) say(p, VOICE_RUMOR, 'Exact location: ' + spot.dim.replace('minecraft:', '') + ' ' + Math.floor(spot.x) + ' ' + Math.floor(spot.y) + ' ' + Math.floor(spot.z) + '.')
    })
  }
}
// Within VENDOR_RANGE of the live vendor, in the same dimension?
function nearVendor(p) {
  const v = db().vendor
  if (!v.present || !vendorAlive() || !v.spot || dimOf(p) != v.spot.dim) return false
  return dist(posOf(p), posOf(S.vendor)) <= VENDOR_RANGE
}

// Once every SLOW_LOOP_SECONDS: AFK samples, the vendor's comings and goings, pruning, saving.
function slowTick(server) {
  sampleAfk(server)
  const D = db(), v = D.vendor, now = Date.now()
  if (!isEnabled()) {
    if (v.present) vendorLeave(server, false)
  } else if (v.present && now >= v.until) {
    vendorLeave(server, false)
  } else if (!v.present && now >= (v.nextAt || 0) && allSpots().length && (!NIGHT_ONLY || isNight(server))) {
    vendorAppear(server, null, false)
  } else if (v.present && NIGHT_ONLY && !isNight(server)) {
    vendorLeave(server, false)
  }
  if (!D.lastPrune || now - D.lastPrune > 3600000) { prune(); D.lastPrune = now }
  if (dirty) save()
}
function startSlowLoop(server) {
  if (S.slowLoop) return
  S.slowLoop = true
  const token = S.token
  const step = () => {
    if (token != S.token) return
    try { slowTick(server) } catch (e) { console.error('[BlackMarket] ' + e) }
    server.scheduleInTicks(SLOW_LOOP_SECONDS * 20, step)
  }
  server.scheduleInTicks(20, step)
}
// Once a second, only while the vendor is out: put him back if he's been pushed, bring him back if he's gone.
function startFastLoop(server) {
  if (S.fastLoop) return
  S.fastLoop = true
  const token = S.token
  const step = () => {
    if (token != S.token) return
    const v = db().vendor
    if (!v.present) { S.fastLoop = false; return }
    try {
      let q = vendorPos()
      if (!vendorAlive()) summonVendor(server)
      else if (dist(posOf(S.vendor), q) > 0.5) server.runCommandSilent('execute in ' + v.spot.dim + ' run tp ' + uuidOf(S.vendor) + ' ' + q.x + ' ' + q.y + ' ' + q.z)
    } catch (e) { console.error('[BlackMarket] ' + e) }
    server.scheduleInTicks(20, step)
  }
  server.scheduleInTicks(20, step)
}


// ===================== SHOP =====================

function menuLine(p, parts) { try { p.tell(comp(parts)) } catch (e) { } }
function openShop(p) {
  const coins = countCoins(p)
  menuLine(p, voiceParts(VOICE_MARKET, 'The Hooded Merchant lowers his voice. You carry ' + coins + ' Blood Coin' + (coins == 1 ? '' : 's') + '.'))
  menuLine(p, [{ text: ' Contracts', color: 'dark_red', bold: true }])
  CONTRACTS.forEach(d => {
    menuLine(p, [{ text: '  Ambush Contract: ' + d.name, color: 'red', hoverEvent: { action: 'show_text', contents: d.desc + ' Price rises with the target\'s heat.' } },
      { text: ' - from ' + d.price + ' coins ', color: 'gray' }, button('[BUY]', 'gold', '/blackmarket buy contract ' + d.id, 'Choose a target')])
  })
  menuLine(p, [{ text: '  Writ of Protection', color: 'gold', hoverEvent: { action: 'show_text', contents: 'Keep it on you: the next contract called on you is refused, and the writ is used up.' } },
    { text: ' - ' + WRIT_PRICE + ' coins ', color: 'gray' }, button('[BUY]', 'gold', '/blackmarket buy writ', 'Buy a Writ of Protection')])
  const custom = db().shop.custom, ids = Object.keys(custom)
  if (ids.length) {
    menuLine(p, [{ text: ' Under the counter', color: 'dark_purple', bold: true }])
    ids.forEach(id => {
      let e = custom[id]
      let hover = { action: 'show_item', contents: { id: e.item, count: e.count } }
      if (e.snbt) hover.contents.tag = e.snbt
      menuLine(p, [{ text: '  ' + e.name + (e.count > 1 ? ' x' + e.count : ''), color: 'light_purple', hoverEvent: hover },
        { text: ' - ' + e.price + ' coins' + (e.stock > 0 ? ' (' + e.stock + ' left) ' : ' '), color: 'gray' }, button('[BUY]', 'gold', '/blackmarket buy custom ' + id, 'Buy ' + e.name)])
    })
  }
  if (SELL_LIST.length) menuLine(p, [{ text: ' He buys', color: 'dark_green', bold: true }])
  SELL_LIST.forEach(s => {
    menuLine(p, [{ text: '  ' + s.item.replace(/^[^:]*:/, '').replace(/_/g, ' '), color: 'green' },
      { text: ' - ' + s.coins + ' coin' + (s.coins == 1 ? '' : 's') + ' per ' + s.per + ' ', color: 'gray' }, button('[SELL]', 'green', '/blackmarket sell ' + s.key, 'Sell all you carry')])
  })
}
function openTargetMenu(p, def) {
  menuLine(p, voiceParts(VOICE_MARKET, 'Who is the Ambush Contract (' + def.name + ') for?'))
  const server = p.server || Utils.server
  const others = onlinePlayers(server).filter(o => uuidOf(o) != uuidOf(p))
  if (!others.length) menuLine(p, [{ text: '  Nobody else is around. Type /blackmarket buy contract ' + def.id + ' <name> for someone the server knows.', color: 'gray' }])
  others.forEach(o => {
    let price = priceFor(def, uuidOf(o)), heat = heatOf(uuidOf(o))
    menuLine(p, [button('  ' + nameOf(o), 'red', '/blackmarket buy contract ' + def.id + ' ' + nameOf(o), 'Buy the contract on ' + nameOf(o)),
      { text: ' - ' + price + ' coins' + (heat ? ' (heat ' + heat + ')' : ''), color: 'gray' }])
  })
}
// A target by name: online, or known to the server (profile cache). { uuid, name } or null.
function resolveTarget(server, name) {
  const p = playerByName(server, name)
  if (p) return { uuid: uuidOf(p), name: nameOf(p) }
  try {
    let opt = server.getProfileCache().get(String(name))
    if (opt && opt.isPresent()) {
      let prof = opt.get()
      return { uuid: String(prof.getId()), name: String(prof.getName()) }
    }
  } catch (e) { }
  return null
}

function buyContract(server, p, tierId, targetName) {
  const def = contractDef(tierId)
  if (!def) return 'No such contract.'
  if (!targetName) { openTargetMenu(p, def); return null }
  const t = resolveTarget(server, targetName)
  if (!t) return 'The merchant has never heard of ' + targetName + '.'
  if (t.uuid == uuidOf(p)) return 'You can\'t take a contract out on yourself.'
  if (!ALLOW_SAME_FACTION) {
    let tp = playerByUuid(server, t.uuid)
    if (tp && factionOf(tp) == factionOf(p) && factionOf(p) && factionOf(p) != 'unregistered') return 'Contracts on your own people are not accepted.'
  }
  const price = priceFor(def, t.uuid)
  if (countCoins(p) < price) return 'That costs ' + price + ' Blood Coins. You have ' + countCoins(p) + '.'
  const made = createContract(def.id, t, p, price)   // the item first, so nothing is paid if it can't be made
  takeCoins(p, price)
  p.give(made.stack)
  return 'Ambush Contract (' + def.name + ') on ' + t.name + ' bought for ' + price + ' coins. Right-click it to call it in.'
}
function buyWrit(p) {
  if (countCoins(p) < WRIT_PRICE) return 'A writ costs ' + WRIT_PRICE + ' Blood Coins. You have ' + countCoins(p) + '.'
  const item = writStack()
  takeCoins(p, WRIT_PRICE)
  p.give(item)
  return 'Writ of Protection bought. Keep it on you.'
}
function buyCustom(p, id) {
  const D = db(), e = D.shop.custom[id]
  if (!e) return 'That isn\'t for sale any more.'
  if (countCoins(p) < e.price) return e.name + ' costs ' + e.price + ' Blood Coins. You have ' + countCoins(p) + '.'
  const item = e.snbt ? Item.of(e.item, e.count, e.snbt) : Item.of(e.item, e.count)
  takeCoins(p, e.price)
  p.give(item)
  if (e.stock > 0) {
    e.stock--
    if (e.stock <= 0) delete D.shop.custom[id]
  }
  save()
  return 'Bought ' + e.name + (e.count > 1 ? ' x' + e.count : '') + ' for ' + e.price + ' coins.'
}
function sell(p, key) {
  if (!SELL_LIST.length) return 'He isn\'t buying anything.'
  const s = SELL_LIST.filter(x => x.key == key)[0]
  if (!s) return 'He doesn\'t buy that.'
  const inv = p.inventory
  let have = 0
  invSlots(false).forEach(i => { let st = inv.getItem(i); if (String(st.id) == s.item && st.nbt == null) have += st.getCount() })
  const sales = Math.floor(have / s.per)
  if (sales <= 0) return 'You need at least ' + s.per + ' plain ' + s.item.replace(/^[^:]*:/, '').replace(/_/g, ' ') + ' to sell.'
  let left = sales * s.per
  invSlots(false).forEach(i => {
    if (left <= 0) return
    let st = inv.getItem(i)
    if (String(st.id) != s.item || st.nbt != null) return
    let k = Math.min(left, st.getCount())
    st.shrink(k)
    left -= k
  })
  giveCoins(p, sales * s.coins)
  return 'Sold ' + sales * s.per + ' for ' + sales * s.coins + ' Blood Coins.'
}


// ===================== API FOR OTHER SCRIPTS =====================

global.Economy = {
  // Gives physical coins (overflow drops at the player's feet). reason is for the log.
  giveCoins: (player, amount, reason) => {
    giveCoins(player, amount)
    console.info('[BlackMarket] ' + nameOf(player) + ' +' + amount + ' coins' + (reason ? ' (' + reason + ')' : ''))
  },
  countCoins: player => countCoins(player),
  takeCoins: (player, amount) => takeCoins(player, amount),
  isCoin: stack => isCoin(stack),
  // fn(buyerUuid, targetUuid, contractId), called when a contract's target is killed by its mobs.
  onContractFulfilled: fn => { if (typeof fn == 'function') listeners.push(fn) },
  _groupEnded: (id, reason) => groupEnded(id, reason),
}


// ===================== EVENTS =====================

// Coins can't stand in for gold nuggets in vanilla crafting recipes (a plain-nugget-only ingredient, the same
// kind enchanted_porkchop.js uses). Recipes that ask for the gold nugget tag, and modded machines, still take them.
ServerEvents.recipes(event => {
  if (!BLOCK_COIN_CRAFTING) return
  try {
    let plain = Ingredient.custom(Ingredient.of(COIN_ITEM), stack => !isCoin(stack))
    ;['minecraft:crafting_shaped', 'minecraft:crafting_shapeless'].forEach(t => event.replaceInput({ type: t, input: COIN_ITEM }, COIN_ITEM, plain))
  } catch (e) { console.error('[BlackMarket] Coin crafting block failed (coins can still be crafted): ' + e) }
})

// Right-click with a contract, in the air or on a block. One click can fire both events: the second is ignored.
function contractClick(event) {
  const p = event.player
  if (!p) return
  let hand = ''
  try { hand = String(event.hand) } catch (e) { }
  if (hand && hand.indexOf('MAIN') < 0) return
  const stack = p.mainHandItem
  if (contractIdOf(stack) == null) return
  const server = p.server || Utils.server
  const tick = server.tickCount, u = uuidOf(p)
  if (!(S.lastUse[u] != null && tick - S.lastUse[u] <= 4)) {
    S.lastUse[u] = tick
    try { useContract(server, p, stack) } catch (e) { console.error('[BlackMarket] Contract use failed: ' + e) }
  }
  event.cancel()   // last: cancel() stops this function
}
ItemEvents.rightClicked(event => contractClick(event))
BlockEvents.rightClicked(event => contractClick(event))

// The vendor: right-click = the shop; nothing else (no trade screen, leads, name tags).
ItemEvents.entityInteracted(event => {
  const t = event.target
  if (!hasTag(t, TAG_VENDOR)) return
  let hand = ''
  try { hand = String(event.hand) } catch (e) { }
  if (!hand || hand.indexOf('MAIN') >= 0) {
    try {
      if (isEnabled()) openShop(event.player)
      else say(event.player, VOICE_MARKET, 'The merchant ignores you.')
    } catch (e) { console.error('[BlackMarket] Shop failed: ' + e) }
  }
  event.cancel()   // last
})

EntityEvents.hurt(event => {
  if (!hasTag(event.entity, TAG_VENDOR)) return
  event.cancel()   // the vendor can't be hurt
})

// A contract target killed by their contract's mobs = fulfilled. Ambush mobs killed by players may drop coins.
EntityEvents.death(event => {
  const e = event.entity
  let attacker = null
  try { attacker = event.source.actual } catch (err) { }
  if (e.isPlayer()) {
    if (!attacker || !hasTag(attacker, TAG_CONTRACT_MOB)) return
    let pa = PA()
    let g = pa ? pa.groupOf(attacker) : null
    if (!g || !g.contractId) return
    let c = db().contracts[g.contractId]
    if (c && c.status == 'active' && c.target == uuidOf(e)) fulfilled(event.server || Utils.server, g.contractId, c)
    return
  }
  if (!AMBUSH_COIN_DROPS.enabled || !hasTag(e, 'portal_ambush') || hasTag(e, 'portal_ambush_summoned')) return
  if (global.portalAmbushState && global.portalAmbushState.allowRemoval) return
  if (!attacker || !attacker.isPlayer()) return
  const n = randInt(AMBUSH_COIN_DROPS.min, AMBUSH_COIN_DROPS.max)
  if (n > 0) { try { e.block.popItem(coinStack(n)) } catch (err) { } }
})

// Vendors: catch ours as it's summoned; keep the current one if its chunk reloads; remove any other.
EntityEvents.spawned(event => {
  const e = event.entity
  const tags = e.getTags()
  if (tags.isEmpty() || !tags.contains(TAG_VENDOR)) return
  if (S.expectVendor) { S.lastVendor = e; return }
  const v = db().vendor
  if (v.present && v.id && tags.contains('bm_vendor_' + v.id)) { S.vendor = e; return }
  event.cancel()   // a stale vendor
})

PlayerEvents.loggedIn(event => {
  const p = event.player, u = uuidOf(p)
  const n = db().notices[u]
  if (n && n.length) {
    n.forEach(x => say(p, VOICE_CALLER, x.text))
    delete db().notices[u]
    saveSoon()
  }
  delete S.afk[u]
})
PlayerEvents.loggedOut(event => { if (dirty) save() })

function startUp(server) {
  removeVendorEntities(server)
  const v = db().vendor
  if (v.present && v.spot) {
    if (Date.now() < v.until && isEnabled()) {
      // Still his time at this spot: back he comes (no new rumor), with a new id so old copies are stale.
      v.id = shortId()
      save()
      forceload(server, v.spot, true)
      let token = S.token
      server.scheduleInTicks(40, () => { if (token == S.token && db().vendor.present) { summonVendor(server); startFastLoop(server) } })
    } else {
      vendorLeave(server, false)
    }
  }
  // After everything has loaded (and portal_ambush has ended its old groups on a /reload).
  server.scheduleInTicks(2, () => { try { sweepContracts(server) } catch (e) { console.error('[BlackMarket] ' + e) } })
  startSlowLoop(server)
}
ServerEvents.loaded(event => startUp(event.server))
if (Utils.server) startUp(Utils.server)


// ===================== COMMANDS =====================

ServerEvents.commandRegistry(event => {
  const Commands = event.commands
  const Arguments = event.arguments
  const reply = (ctx, text, bad) => {
    ctx.source.sendSystemMessage(comp([{ text: '[Black Market] ', color: 'dark_red' }, { text: text, color: bad ? 'red' : 'gray' }]))
    return bad ? 0 : 1
  }
  const safe = fn => ctx => {
    try { return fn(ctx) } catch (e) {
      console.error('[BlackMarket] ' + e)
      return reply(ctx, 'Error: ' + e, true)
    }
  }
  const op = src => src.hasPermission(2)
  const word = name => Commands.argument(name, StringArg.word())
  const str = (ctx, name) => String(StringArg.getString(ctx, name))
  const int = name => Commands.argument(name, Arguments.INTEGER.create(event))
  const num = (ctx, name) => Number(Arguments.INTEGER.getResult(ctx, name))
  const me = ctx => ctx.source.getPlayer()
  // Every buy and sell: a player, the add-on on, and standing at the vendor.
  const atVendor = fn => safe(ctx => {
    const p = me(ctx)
    if (!p) return reply(ctx, 'Players only.', true)
    if (!isEnabled()) return reply(ctx, 'The black market is closed.', true)
    if (!nearVendor(p)) return reply(ctx, 'The merchant is not here.', true)
    const r = fn(ctx, p)
    if (r == null) return 1
    return reply(ctx, r)
  })

  const root = Commands.literal('blackmarket')
    .then(Commands.literal('shop').executes(atVendor((ctx, p) => { openShop(p); return null })))
    .then(Commands.literal('buy')
      .then(Commands.literal('contract').then(word('tier').executes(atVendor((ctx, p) => buyContract(ctx.source.server, p, str(ctx, 'tier'), null)))
        .then(word('target').executes(atVendor((ctx, p) => buyContract(ctx.source.server, p, str(ctx, 'tier'), str(ctx, 'target')))))))
      .then(Commands.literal('writ').executes(atVendor((ctx, p) => buyWrit(p))))
      .then(Commands.literal('custom').then(word('id').executes(atVendor((ctx, p) => buyCustom(p, str(ctx, 'id')))))))
    .then(Commands.literal('sell').then(word('item').executes(atVendor((ctx, p) => sell(p, str(ctx, 'item'))))))
    // --- op ---
    .then(Commands.literal('inspect').requires(op).executes(safe(ctx => {
      const p = me(ctx)
      if (!p) return reply(ctx, 'Hold the contract and run this as a player.', true)
      const id = contractIdOf(p.mainHandItem)
      if (id == null) return reply(ctx, 'Hold an Ambush Contract in your main hand.', true)
      const c = db().contracts[id]
      if (!c) return reply(ctx, 'Contract ' + id + ': not on record (forged or from another world). It is void.')
      return reply(ctx, 'Contract ' + id + ': ' + c.tier + ' on ' + c.targetName + ', bought by ' + c.buyerName + ' on ' + dateText(c.issued) + ' for ' + (c.price || 0) + ' coins. Status: ' + c.status + '.')
    })))
    .then(Commands.literal('vendor').requires(op)
      .then(Commands.literal('spawn').executes(safe(ctx => reply(ctx, vendorAppear(ctx.source.server, null, false))))
        .then(word('location').executes(safe(ctx => reply(ctx, vendorAppear(ctx.source.server, str(ctx, 'location'), false))))))
      .then(Commands.literal('move').executes(safe(ctx => reply(ctx, vendorAppear(ctx.source.server, null, false)))))
      .then(Commands.literal('remove').executes(safe(ctx => { vendorLeave(ctx.source.server, false); return reply(ctx, 'The vendor is gone. He returns in ' + VENDOR_GONE_MINUTES + ' minutes.') })))
      .then(Commands.literal('where').executes(safe(ctx => {
        const v = db().vendor
        if (!v.present) return reply(ctx, 'Gone. Next appearance in about ' + Math.max(0, Math.round(((v.nextAt || 0) - Date.now()) / 60000)) + ' min' + (NIGHT_ONLY ? ' (at night)' : '') + '.')
        return reply(ctx, 'At ' + v.spot.name + ': ' + v.spot.dim + ' ' + v.spot.x + ' ' + v.spot.y + ' ' + v.spot.z + ', for ' + Math.round((v.until - Date.now()) / 60000) + ' more min. Entity ' + (vendorAlive() ? 'loaded' : 'not loaded') + '.')
      })))
      .then(Commands.literal('addspot').then(word('name').executes(safe(ctx => {
        const p = me(ctx)
        if (!p) return reply(ctx, 'Run this as a player, standing on the spot.', true)
        const name = str(ctx, 'name')
        if (spotByName(name)) return reply(ctx, 'There is already a spot called ' + name + '.', true)
        const q = posOf(p)
        db().vendorSpots.push({ dim: dimOf(p), x: Math.floor(q.x), y: Math.floor(q.y), z: Math.floor(q.z), name: name.replace(/_/g, ' ') })
        save()
        return reply(ctx, 'Vendor spot "' + name.replace(/_/g, ' ') + '" saved here. Underscores in the name show as spaces.')
      }))))
      .then(Commands.literal('delspot').then(word('name').executes(safe(ctx => {
        const name = str(ctx, 'name').replace(/_/g, ' ').toLowerCase()
        const before = db().vendorSpots.length
        db().vendorSpots = db().vendorSpots.filter(s => String(s.name).toLowerCase() != name)
        save()
        return reply(ctx, before == db().vendorSpots.length ? 'No saved spot by that name (spots in VENDOR_LOCATIONS are changed in the script).' : 'Spot removed.')
      }))))
      .then(Commands.literal('spots').executes(safe(ctx => {
        const all = allSpots()
        if (!all.length) return reply(ctx, 'No spots. Stand somewhere and run /bm vendor addspot <name>.')
        all.forEach(s => reply(ctx, s.name + ': ' + s.dim + ' ' + s.x + ' ' + s.y + ' ' + s.z + (VENDOR_LOCATIONS.indexOf(s) >= 0 ? ' (script)' : ' (saved)')))
        return 1
      }))))
    .then(Commands.literal('contracts').requires(op).executes(safe(ctx => {
      const D = db(), ids = Object.keys(D.contracts).sort((a, b) => D.contracts[b].issued - D.contracts[a].issued).slice(0, 20)
      if (!ids.length) return reply(ctx, 'No contracts on record.')
      ids.forEach(id => { let c = D.contracts[id]; reply(ctx, id + ': ' + c.tier + ' on ' + c.targetName + ' by ' + c.buyerName + ', ' + c.status + ', ' + dateText(c.issued)) })
      return 1
    })))
    .then(Commands.literal('heat').requires(op).then(word('player').executes(safe(ctx => {
      const t = resolveTarget(ctx.source.server, str(ctx, 'player'))
      if (!t) return reply(ctx, 'Unknown player.', true)
      return reply(ctx, t.name + ': heat ' + heatOf(t.uuid) + ' (contracts in the last ' + HEAT_WINDOW_HOURS + ' h); contract cooldown ' + Math.ceil(contractCooldownLeft(t.uuid) / 60000) + ' min.')
    })).then(Commands.literal('reset').executes(safe(ctx => {
      const t = resolveTarget(ctx.source.server, str(ctx, 'player'))
      if (!t) return reply(ctx, 'Unknown player.', true)
      delete db().heat[t.uuid]
      save()
      return reply(ctx, t.name + '\'s heat reset.')
    })))))
    .then(Commands.literal('test').requires(op).then(Commands.literal('contract').then(word('tier').then(word('target').executes(safe(ctx => {
      const p = me(ctx)
      if (!p) return reply(ctx, 'Players only.', true)
      const def = contractDef(str(ctx, 'tier'))
      if (!def) return reply(ctx, 'Tiers: ' + CONTRACTS.map(c => c.id).join(', ') + '.', true)
      const t = resolveTarget(ctx.source.server, str(ctx, 'target'))
      if (!t) return reply(ctx, 'Unknown player.', true)
      const made = createContract(def.id, t, p, 0)
      p.give(made.stack)
      return reply(ctx, 'Free Ambush Contract (' + def.name + ') on ' + t.name + ' (' + made.id + ').')
    }))))))
    .then(Commands.literal('toggle').requires(op).executes(safe(ctx => {
      db().enabled = !db().enabled
      save()
      if (!db().enabled) vendorLeave(ctx.source.server, false)
      return reply(ctx, 'The black market is now ' + (db().enabled ? 'OPEN' : 'CLOSED (data kept)') + '.')
    })))
    .then(Commands.literal('hand').requires(op)
      .then(Commands.literal('add').then(int('price').executes(safe(ctx => handAdd(ctx, num(ctx, 'price'), 0)))
        .then(int('stock').executes(safe(ctx => handAdd(ctx, num(ctx, 'price'), num(ctx, 'stock')))))))
      .then(Commands.literal('list').executes(safe(ctx => {
        const custom = db().shop.custom, ids = Object.keys(custom)
        if (!ids.length) return reply(ctx, 'No custom stock. Hold an item and run /bm hand add <price>.')
        ids.forEach(id => {
          let e = custom[id]
          ctx.source.sendSystemMessage(comp([{ text: id + ': ' + e.name + ' x' + e.count + ' for ' + e.price + ' coins' + (e.stock > 0 ? ', ' + e.stock + ' left ' : ' '), color: 'gray' },
            button('[REMOVE]', 'red', '/blackmarket hand remove ' + id, 'Remove ' + e.name + ' from the shop')]))
        })
        return 1
      })))
      .then(Commands.literal('remove').then(word('id').executes(safe(ctx => {
        const id = str(ctx, 'id'), custom = db().shop.custom
        if (!custom[id]) return reply(ctx, 'No custom entry ' + id + '.', true)
        const name = custom[id].name
        delete custom[id]
        save()
        return reply(ctx, 'Removed ' + name + ' (' + id + ').')
      }))))
      .then(Commands.literal('price').then(word('id').then(int('price').executes(safe(ctx => {
        const id = str(ctx, 'id'), e = db().shop.custom[id], price = num(ctx, 'price')
        if (!e) return reply(ctx, 'No custom entry ' + id + '.', true)
        if (price < 1) return reply(ctx, 'The price must be at least 1.', true)
        e.price = price
        save()
        return reply(ctx, e.name + ' now costs ' + price + ' coins.')
      }))))))

  // /bm hand add <price> [stock]: the op's main-hand item, NBT and all, for sale.
  function handAdd(ctx, price, stock) {
    const p = me(ctx)
    if (!p) return reply(ctx, 'Players only.', true)
    const stack = p.mainHandItem
    if (!stack || stack.isEmpty()) return reply(ctx, 'Hold the item to sell in your main hand.', true)
    if (price < 1) return reply(ctx, 'The price must be at least 1.', true)
    if (stock < 0) return reply(ctx, 'The stock can\'t be negative (0 = unlimited).', true)
    if (isCoin(stack) || contractIdOf(stack) != null || isWrit(stack)) return reply(ctx, 'Blood Coins, contracts and writs can\'t be sold this way (copies would be fake or void).', true)
    const id = String(stack.id), nbt = stack.nbt
    let name = id
    try { name = String(stack.getHoverName().getString()) } catch (e) { }
    const D = db()
    let key = ''
    do { key = 'i' + shortId() } while (D.shop.custom[key])
    D.shop.custom[key] = { item: id, count: stack.getCount(), snbt: nbt == null ? null : String(nbt), price: price, stock: stock || 0,
      name: name, addedBy: nameOf(p), added: Date.now() }
    save()
    const warn = id.indexOf('shulker_box') >= 0 || id == 'minecraft:bundle' ? ' Note: its contents are sold with it.' : ''
    return reply(ctx, 'Added ' + key + ': ' + name + ' x' + stack.getCount() + ' for ' + price + ' coins' + (stock > 0 ? ', ' + stock + ' in stock' : '') + '.' + warn)
  }

  const node = event.register(root)
  event.register(Commands.literal('bm').redirect(node))

  // /coins give|take <player> <amount>, /coins check <player>
  event.register(Commands.literal('coins').requires(op)
    .then(Commands.literal('give').then(Commands.argument('player', Arguments.PLAYER.create(event)).then(int('amount').executes(safe(ctx => {
      const p = Arguments.PLAYER.getResult(ctx, 'player'), n = num(ctx, 'amount')
      if (n < 1) return reply(ctx, 'The amount must be at least 1.', true)
      giveCoins(p, n)
      console.info('[BlackMarket] /coins give ' + nameOf(p) + ' ' + n)
      return reply(ctx, 'Gave ' + nameOf(p) + ' ' + n + ' Blood Coins.')
    })))))
    .then(Commands.literal('take').then(Commands.argument('player', Arguments.PLAYER.create(event)).then(int('amount').executes(safe(ctx => {
      const p = Arguments.PLAYER.getResult(ctx, 'player'), n = num(ctx, 'amount')
      const have = countCoins(p)
      takeCoins(p, Math.min(n, have))
      return reply(ctx, 'Took ' + Math.min(n, have) + ' Blood Coins from ' + nameOf(p) + (have < n ? ' (all they had).' : '.'))
    })))))
    .then(Commands.literal('check').then(Commands.argument('player', Arguments.PLAYER.create(event)).executes(safe(ctx => {
      const p = Arguments.PLAYER.getResult(ctx, 'player')
      return reply(ctx, nameOf(p) + ' carries ' + countCoins(p) + ' Blood Coins (main inventory and hotbar).')
    })))))
})

})()
