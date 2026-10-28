// Bounties: Blood Coins on a player's head. Whoever kills them collects the lot.
//
//  - Bounties stack: every player who places one adds to the same pot. Each player can have only ONE part
//    of a player's bounty at a time; once it's collected (or they cancel their part), they can place again.
//  - Any amount from 1 up to the coins you carry. The pot is exactly what was placed.
//  - Pots are public ("[WANTED] Bob - 37 Blood Coins on their head"); who paid is never shown to players
//    (ops can see it with /bounty list).
//  - Collected when a PLAYER kills the target (placers included). Mobs, falls and Pig Escort deaths pay nothing.
//    Bounties never expire, and offline players can be targeted (the pot waits for them).
//  - A placer can cancel their own part and get their coins back.
//  - Factions: a killer from a rival faction gets a small rival bonus on top (see RIVAL_BONUS).
//
// Needs economy/black_market.js (global.Economy: the coins and the Hooded Merchant). Uses factions/factions_core.js
// (global.Factions) and factions/portal_ambush.js (global.PortalAmbush) when they're there; all looked up when
// needed, so the load order doesn't matter. The merchant's shop window has Place a Bounty and Wanted buttons.
// See tools/kubejs/BOUNTIES.md.
//
// Commands: /bounty (players; at the merchant while the black market is open), /bounty list or /bounties
// (anywhere), /bounty clear|toggle|log (op level 2). Copy to <server>/kubejs/server_scripts/economy/ and /reload.
//
// KubeJS 6 notes: no template strings; `let` inside nested blocks; event.cancel() is never used here; public
// messages use player.tell to each player, never tellraw @a (Simple Discord Link relays that to Discord).

(function () {

// ===================== SETTINGS =====================

const ENABLED_BY_DEFAULT = true        // /bounty toggle changes this and the change is saved
const PRESETS = [5, 10, 25, 50, 100]   // the amount buttons (the window and the chat picker); any amount can be typed
// Placing and cancelling happen at the Hooded Merchant, like every other black market trade. When the black
// market is closed (/bm toggle) or has no vendor spots, they work anywhere instead, so bounties keep working.
const REQUIRE_MERCHANT = true
const ANNOUNCE = true                  // tell everyone online when a pot grows and when it's collected

// The faction link: a killer from a RIVAL faction (both in a faction, different ones) gets extra coins on top
// of the pot, made new by the server. percent of the pot, at most `max`, only if the pot is at least `minPot`,
// never if the killer has a part in this bounty, and only once per killer and target every `cooldownMinutes`
// (so two friends staging kills can't print coins).
// respectSecret: no bonus when the target's faction is secret to the killer (the bonus would give it away).
const RIVAL_BONUS = { enabled: true, percent: 25, max: 10, minPot: 5, cooldownMinutes: 120, respectSecret: true }

const VOICE_WANTED = { tag: '[WANTED]', tagColor: 'dark_red', textColor: 'gold' }
const VOICE_BOUNTY = { tag: '[BOUNTY]', tagColor: 'dark_red', textColor: 'gray' }
const COLLECT_SOUND = 'minecraft:entity.experience_orb.pickup'


// ===================== STATE =====================

const DATA_KEY = 'bounties'
const LOG_SIZE = 50

let Serializer = null, StringArg = null
try { Serializer = Java.loadClass('net.minecraft.network.chat.Component$Serializer') } catch (e) { }
try { StringArg = Java.loadClass('com.mojang.brigadier.arguments.StringArgumentType') } catch (e) { }


// ===================== HELPERS =====================

function nameOf(p) { return String(p.getGameProfile().getName()) }
function uuidOf(e) {
  try { return String(e.getStringUuid()) } catch (err) { }
  return String(e.getStringUUID())
}
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
function E() { return global.Economy || null }         // economy/black_market.js
function F() { return global.Factions || null }        // factions/factions_core.js
function PA() { return global.PortalAmbush || null }   // factions/portal_ambush.js
function dateText(ms) {
  const d = new Date(ms)
  const two = n => (n < 10 ? '0' : '') + n
  return d.getUTCFullYear() + '-' + two(d.getUTCMonth() + 1) + '-' + two(d.getUTCDate()) + ' ' + two(d.getUTCHours()) + ':' + two(d.getUTCMinutes()) + ' UTC'
}
function coins(n) { return n + ' Blood Coin' + (n == 1 ? '' : 's') }

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
function sayAll(server, voice, text) { onlinePlayers(server).forEach(p => say(p, voice, text)) }
function button(label, color, command, hover) {
  return { text: label, color: color, bold: true, clickEvent: { action: 'run_command', value: command }, hoverEvent: { action: 'show_text', contents: hover || command } }
}
function sound(server, p, id) {
  try { server.runCommandSilent('execute as ' + nameOf(p) + ' at @s run playsound ' + id + ' master @s ~ ~ ~ 1 1') } catch (e) { }
}


// ===================== SAVED DATA =====================
// server.persistentData['bounties'] = one JSON string:
//   { v, enabled, bounties: { targetUuid: { targetName, total, created, placers: { uuid: { name, amount, time } } } },
//     known: { uuid: name }, refunds: { uuid: coins }, bonusCooldowns: { "killer|target": ms }, log: [ text ] }

let DB = null
function db() {
  if (DB) return DB
  let raw = ''
  try { raw = String(Utils.server.persistentData.getString(DATA_KEY) || '') } catch (e) { }
  let parsed = null
  if (raw) {
    try { parsed = JSON.parse(raw) } catch (e) {
      try { Utils.server.persistentData.putString(DATA_KEY + '_unreadable_' + Date.now(), raw) } catch (e2) { }
      console.error('[Bounties] Saved data could not be read (' + e + '); a copy was kept and it starts fresh.')
    }
  }
  DB = parsed && parsed.v ? parsed : { v: 1 }
  if (typeof DB.enabled != 'boolean') DB.enabled = ENABLED_BY_DEFAULT
  ;['bounties', 'known', 'refunds', 'bonusCooldowns'].forEach(k => { if (!DB[k]) DB[k] = {} })
  if (!DB.log) DB.log = []
  return DB
}
function save() {
  try { Utils.server.persistentData.putString(DATA_KEY, JSON.stringify(db())) } catch (e) { console.error('[Bounties] Save failed: ' + e) }
}
function isEnabled() { return db().enabled }
function log(text) {
  const D = db()
  D.log.push(dateText(Date.now()) + ': ' + text)
  if (D.log.length > LOG_SIZE) D.log.splice(0, D.log.length - LOG_SIZE)
  console.info('[Bounties] ' + text)
}


// ===================== PLAYERS THE SERVER KNOWS =====================
// Offline players can be targeted: everyone seen since this script was installed, faction members, and
// anyone in the server's profile cache (typed names).

function remember(p) {
  const D = db(), u = uuidOf(p), n = nameOf(p)
  if (D.known[u] == n) return false
  D.known[u] = n
  if (D.bounties[u]) D.bounties[u].targetName = n
  return true
}
function rememberFactionMembers() {
  const f = F()
  if (!f || !f.getFactionIds || !f.getMembers) return
  try {
    f.getFactionIds().forEach(id => {
      if (String(id) == String(f.DEFAULT)) return
      f.getMembers(id).forEach(m => { if (m && m.uuid && m.name && !db().known[String(m.uuid)]) db().known[String(m.uuid)] = String(m.name) })
    })
  } catch (e) { }
}
// A player by name: online, known, or in the profile cache. { uuid, name } or null.
function resolve(server, name) {
  const p = playerByName(server, name)
  if (p) return { uuid: uuidOf(p), name: nameOf(p) }
  const n = String(name).toLowerCase(), known = db().known
  const hit = Object.keys(known).filter(u => String(known[u]).toLowerCase() == n)[0]
  if (hit) return { uuid: hit, name: known[hit] }
  try {
    let opt = server.getProfileCache().get(String(name))
    if (opt && opt.isPresent()) {
      let prof = opt.get()
      return { uuid: String(prof.getId()), name: String(prof.getName()) }
    }
  } catch (e) { }
  return null
}
// Everyone p could put a bounty on: online players first, then known offline ones (by name). [{ uuid, name, online }]
function targetsFor(p) {
  const server = Utils.server, me = uuidOf(p), seen = {}
  const out = []
  onlinePlayers(server).forEach(o => {
    let u = uuidOf(o)
    if (u == me || seen[u]) return
    seen[u] = true
    out.push({ uuid: u, name: nameOf(o), online: true })
  })
  const known = db().known
  Object.keys(known).filter(u => u != me && !seen[u]).sort((a, b) => String(known[a]).toLowerCase() < String(known[b]).toLowerCase() ? -1 : 1)
    .forEach(u => out.push({ uuid: u, name: known[u], online: false }))
  return out
}


// ===================== PLACING, CANCELLING, COLLECTING =====================

// Must this player be at the merchant? Only while the black market is open and the merchant has somewhere to be.
function merchantRequired() {
  const e = E()
  return REQUIRE_MERCHANT && !!e && !!e.merchantRequired && e.merchantRequired()
}
function whyNotHere(p) {
  if (!merchantRequired()) return null
  return E().atMerchant(p) ? null : 'Bounties are placed with the Hooded Merchant. Find him first.'
}
function potOf(u) { const b = db().bounties[u]; return b ? b.total : 0 }
function partOf(placerUuid, targetUuid) {
  const b = db().bounties[targetUuid]
  return b && b.placers[placerUuid] ? b.placers[placerUuid].amount : 0
}
const result = (ok, text) => ({ ok: ok, text: text })

function place(p, targetName, amount) {
  const server = Utils.server, e = E()
  if (!isEnabled()) return result(false, 'Bounties are closed.')
  if (!e) return result(false, 'Nobody is taking Blood Coins right now.')
  const where = whyNotHere(p)
  if (where) return result(false, where)
  const t = resolve(server, targetName)
  if (!t) return result(false, 'Nobody has heard of ' + targetName + '.')
  const me = uuidOf(p)
  if (t.uuid == me) return result(false, 'You can\'t put a bounty on your own head.')
  amount = Math.floor(Number(amount))
  if (!(amount >= 1)) return result(false, 'A bounty is at least 1 Blood Coin.')
  const D = db()
  const b = D.bounties[t.uuid]
  if (b && b.placers[me]) return result(false, 'You already have ' + coins(b.placers[me].amount) + ' on ' + t.name + '. It stays until someone collects it (or you cancel it).')
  const have = e.countCoins(p)
  if (amount > have) return result(false, 'You only carry ' + coins(have) + '.')
  if (!e.takeCoins(p, amount)) return result(false, 'You only carry ' + coins(e.countCoins(p)) + '.')
  const entry = b || { targetName: t.name, total: 0, created: Date.now(), placers: {} }
  entry.targetName = t.name
  entry.placers[me] = { name: nameOf(p), amount: amount, time: Date.now() }
  entry.total += amount
  D.bounties[t.uuid] = entry
  if (!D.known[t.uuid]) D.known[t.uuid] = t.name
  log(nameOf(p) + ' placed ' + amount + ' on ' + t.name + ' (pot ' + entry.total + ')')
  save()
  if (ANNOUNCE) sayAll(server, VOICE_WANTED, t.name + ' - ' + coins(entry.total) + ' on their head.')
  return result(true, 'Your ' + coins(amount) + ' are on ' + t.name + '\'s head. Nobody will know it was you.')
}

function cancel(p, targetName) {
  const server = Utils.server, e = E()
  if (!e) return result(false, 'Nobody is taking Blood Coins right now.')
  const where = whyNotHere(p)
  if (where) return result(false, where)
  const t = resolve(server, targetName)
  const D = db(), me = uuidOf(p)
  const b = t ? D.bounties[t.uuid] : null
  if (!b || !b.placers[me]) return result(false, 'You have no bounty on ' + (t ? t.name : targetName) + '.')
  const amount = b.placers[me].amount
  delete b.placers[me]
  b.total -= amount
  if (!Object.keys(b.placers).length || b.total <= 0) delete D.bounties[t.uuid]
  log(nameOf(p) + ' cancelled their ' + amount + ' on ' + t.name + ' (pot ' + (D.bounties[t.uuid] ? D.bounties[t.uuid].total : 0) + ')')
  save()
  e.giveCoins(p, amount, 'bounty on ' + t.name + ' cancelled')
  return result(true, 'Your bounty on ' + t.name + ' is withdrawn. ' + coins(amount) + ' back in your pocket.')
}

// The rival bonus for this kill, or 0. b is the bounty (still holding its placers).
function rivalBonus(killer, victim, b) {
  const R = RIVAL_BONUS, f = F()
  if (!R.enabled || !f || b.total < R.minPot) return 0
  const ku = uuidOf(killer), vu = uuidOf(victim)
  if (b.placers[ku]) return 0
  let kf = '', vf = ''
  try { kf = String(f.getFaction(killer)); vf = String(f.getFaction(victim)) } catch (e) { return 0 }
  const def = String(f.DEFAULT != null ? f.DEFAULT : 'unregistered')
  if (!kf || !vf || kf == def || vf == def || kf == vf) return 0
  if (R.respectSecret && f.visibleFaction) {
    try { if (String(f.visibleFaction(killer, victim)) != vf) return 0 } catch (e) { return 0 }
  }
  const key = ku + '|' + vu, last = db().bonusCooldowns[key]
  if (last && Date.now() - last < R.cooldownMinutes * 60000) return 0
  return Math.max(0, Math.min(R.max, Math.floor(b.total * R.percent / 100)))
}

function collect(server, killer, victim) {
  const D = db(), vu = uuidOf(victim), b = D.bounties[vu], e = E()
  if (!b || !e) return
  const bonus = rivalBonus(killer, victim, b)
  const total = b.total
  delete D.bounties[vu]
  if (bonus > 0) D.bonusCooldowns[uuidOf(killer) + '|' + vu] = Date.now()
  log(nameOf(killer) + ' collected ' + total + ' on ' + nameOf(victim) + (bonus ? ' (+' + bonus + ' rival bonus)' : '') + '; placed by ' +
    Object.keys(b.placers).map(u => b.placers[u].name + ' ' + b.placers[u].amount).join(', '))
  save()
  e.giveCoins(killer, total + bonus, 'bounty on ' + nameOf(victim))
  if (ANNOUNCE) sayAll(server, VOICE_WANTED, nameOf(killer) + ' collected the ' + total + '-coin bounty on ' + nameOf(victim) + '.')
  say(killer, VOICE_BOUNTY, 'You collected ' + coins(total) + ' for ' + nameOf(victim) + '.' + (bonus ? ' +' + bonus + ' rival bonus.' : ''))
  sound(server, killer, COLLECT_SOUND)
}

// Ops: remove a bounty and give every placer their part back (offline placers get it on their next login).
function clearBounty(server, t) {
  const D = db(), b = D.bounties[t.uuid]
  if (!b) return 0
  delete D.bounties[t.uuid]
  Object.keys(b.placers).forEach(u => refund(server, u, b.placers[u].amount, 'The bounty you placed on ' + t.name + ' was called off. Your coins are back.'))
  log('the bounty on ' + t.name + ' (' + b.total + ') was cleared by an op; placers refunded')
  save()
  return b.total
}
function refund(server, u, amount, text) {
  const p = playerByUuid(server, u)
  if (p && E()) {
    E().giveCoins(p, amount, 'bounty refund')
    say(p, VOICE_BOUNTY, text)
    return
  }
  const D = db()
  D.refunds[u] = (D.refunds[u] || 0) + amount
}

// [{ uuid, name, total, placers, online }], biggest pot first.
function wanted() {
  const D = db(), server = Utils.server
  return Object.keys(D.bounties).map(u => ({ uuid: u, name: D.bounties[u].targetName, total: D.bounties[u].total,
    placers: Object.keys(D.bounties[u].placers).length, online: !!playerByUuid(server, u) })).sort((a, b) => b.total - a.total)
}


// ===================== CHAT MENUS =====================

function menuLine(p, parts) { try { p.tell(comp(parts)) } catch (e) { } }
function presetsFor(p) {
  const have = E() ? E().countCoins(p) : 0
  const out = PRESETS.filter(n => n <= have)
  if (have > 0 && out.indexOf(have) < 0) out.push(have)
  return out
}
function amountButtons(p, name) {
  const have = E() ? E().countCoins(p) : 0
  return presetsFor(p).map(n => button('[' + (n == have && PRESETS.indexOf(n) < 0 ? 'All ' + n : n) + ']', 'gold', '/bounty ' + name + ' ' + n, 'Put ' + coins(n) + ' on ' + name))
}
function chatPicker(p) {
  const have = E() ? E().countCoins(p) : 0
  menuLine(p, voiceParts(VOICE_BOUNTY, 'Whose head? You carry ' + coins(have) + '.'))
  const list = targetsFor(p).slice(0, 20)
  if (!list.length) menuLine(p, [{ text: '  Nobody the server knows.', color: 'gray' }])
  list.forEach(t => {
    let mine = partOf(uuidOf(p), t.uuid), pot = potOf(t.uuid)
    let parts = [{ text: '  ' + t.name, color: t.online ? 'red' : 'dark_gray' }, { text: (pot ? ' (pot ' + pot + ')' : '') + (t.online ? '' : ' (offline)') + ' ', color: 'gray' }]
    if (mine) parts.push(button('[CANCEL MY ' + mine + ']', 'red', '/bounty cancel ' + t.name, 'Withdraw your ' + coins(mine) + ' from ' + t.name + '\'s bounty'))
    else if (!have) parts.push({ text: 'no coins', color: 'dark_gray' })
    else amountButtons(p, t.name).forEach(b => parts.push(b, ' '))
    menuLine(p, parts)
  })
  menuLine(p, [{ text: '  Any amount: /bounty <player> <amount>', color: 'dark_gray', italic: true }])
}
function chatAmounts(p, name) {
  const t = resolve(Utils.server, name)
  if (!t) return 'Nobody has heard of ' + name + '.'
  const mine = partOf(uuidOf(p), t.uuid)
  if (mine) {
    menuLine(p, voiceParts(VOICE_BOUNTY, 'You already have ' + coins(mine) + ' on ' + t.name + '.'))
    menuLine(p, [button('  [CANCEL MY BOUNTY]', 'red', '/bounty cancel ' + t.name, 'Get your ' + coins(mine) + ' back')])
    return null
  }
  const parts = voiceParts(VOICE_BOUNTY, 'How much on ' + t.name + '? (pot ' + potOf(t.uuid) + ') ')
  const btns = amountButtons(p, t.name)
  if (!btns.length) return 'You carry no Blood Coins.'
  btns.forEach(b => parts.push(b, ' '))
  menuLine(p, parts)
  return null
}
function showList(p, asOp) {
  const all = wanted()
  if (!all.length) { say(p, VOICE_WANTED, 'Nobody has a price on their head.'); return }
  say(p, VOICE_WANTED, 'Prices on heads:')
  all.forEach(w => {
    let line = '  ' + w.name + ' - ' + coins(w.total) + (w.online ? '' : ' (offline)')
    if (asOp) {
      let b = db().bounties[w.uuid]
      line += ' [' + Object.keys(b.placers).map(u => b.placers[u].name + ' ' + b.placers[u].amount).join(', ') + ']'
    }
    menuLine(p, [{ text: line, color: 'gold' }])
  })
}


// ===================== API FOR OTHER SCRIPTS =====================
// Used by black_market.js's shop window. place/cancel return { ok, text }.

global.Bounties = {
  place: (player, targetName, amount) => place(player, targetName, amount),
  cancel: (player, targetName) => cancel(player, targetName),
  wanted: () => wanted(),                                    // [{ uuid, name, total, placers, online }]
  targets: player => targetsFor(player),                      // [{ uuid, name, online }]
  potOf: uuid => potOf(String(uuid)),
  myPart: (player, targetUuid) => partOf(uuidOf(player), String(targetUuid)),
  presetsFor: player => presetsFor(player),
  isEnabled: () => isEnabled(),
}


// ===================== EVENTS =====================

// A player killed by another player: the killer collects. Pig Escort deaths are cancelled there (and don't count).
EntityEvents.death(event => {
  const victim = event.entity
  if (!victim || !victim.isPlayer() || !isEnabled()) return
  if (!db().bounties[uuidOf(victim)]) return
  let killer = null
  try { killer = event.source.actual } catch (e) { }
  if (!killer || !killer.isPlayer() || uuidOf(killer) == uuidOf(victim)) return
  const pa = PA()
  try { if (pa && pa.isPigEscortParticipant(victim)) return } catch (e) { }
  try { collect(event.server || Utils.server, killer, victim) } catch (e) { console.error('[Bounties] Collecting failed: ' + e) }
})

PlayerEvents.loggedIn(event => {
  const p = event.player, D = db(), u = uuidOf(p)
  let changed = remember(p)
  if (D.refunds[u] && E()) {
    let n = D.refunds[u]
    delete D.refunds[u]
    E().giveCoins(p, n, 'bounty refund')
    say(p, VOICE_BOUNTY, 'A bounty you placed was called off while you were away. ' + coins(n) + ' back in your pocket.')
    changed = true
  }
  if (changed) save()
})

function startUp(server) {
  onlinePlayers(server).forEach(p => remember(p))
  rememberFactionMembers()
  const D = db(), now = Date.now()
  Object.keys(D.bonusCooldowns).forEach(k => { if (now - D.bonusCooldowns[k] > RIVAL_BONUS.cooldownMinutes * 60000) delete D.bonusCooldowns[k] })
  save()
}
ServerEvents.loaded(event => startUp(event.server))
if (Utils.server) startUp(Utils.server)


// ===================== COMMANDS =====================

ServerEvents.commandRegistry(event => {
  const Commands = event.commands
  const Arguments = event.arguments
  const reply = (ctx, text, bad) => {
    ctx.source.sendSystemMessage(comp([{ text: '[Bounty] ', color: 'dark_red' }, { text: text, color: bad ? 'red' : 'gray' }]))
    return bad ? 0 : 1
  }
  const safe = fn => ctx => {
    try { return fn(ctx) } catch (e) {
      console.error('[Bounties] ' + e)
      return reply(ctx, 'Error: ' + e, true)
    }
  }
  const op = src => src.hasPermission(2)
  const word = name => Commands.argument(name, StringArg.word())
  const str = (ctx, name) => String(StringArg.getString(ctx, name))
  const int = name => Commands.argument(name, Arguments.INTEGER.create(event))
  const num = (ctx, name) => Number(Arguments.INTEGER.getResult(ctx, name))
  const me = ctx => ctx.source.getPlayer()
  // A player, bounties open (cancelling works while closed); fn returns a { ok, text } result, a message, or null
  // (it replied itself).
  const asPlayer = (fn, evenClosed) => safe(ctx => {
    const p = me(ctx)
    if (!p) return reply(ctx, 'Players only.', true)
    if (!evenClosed && !isEnabled()) return reply(ctx, 'Bounties are closed.', true)
    const r = fn(ctx, p)
    if (r == null) return 1
    if (typeof r == 'object') return reply(ctx, r.text, !r.ok)
    return reply(ctx, r)
  })
  const list = safe(ctx => {
    const p = me(ctx)
    if (p) { showList(p, isOp(p)); return 1 }
    const all = wanted()
    if (!all.length) return reply(ctx, 'No bounties.')
    all.forEach(w => reply(ctx, w.name + ': ' + w.total + ' [' + Object.keys(db().bounties[w.uuid].placers).map(u => db().bounties[w.uuid].placers[u].name + ' ' + db().bounties[w.uuid].placers[u].amount).join(', ') + ']'))
    return 1
  })

  event.register(Commands.literal('bounty')
    .executes(asPlayer((ctx, p) => {
      const why = whyNotHere(p)
      if (why) return why
      chatPicker(p)
      return null
    }))
    .then(Commands.literal('list').executes(list))
    .then(Commands.literal('cancel').then(word('player').executes(asPlayer((ctx, p) => cancel(p, str(ctx, 'player')), true))))
    // --- op ---
    .then(Commands.literal('clear').requires(op).then(word('player').executes(safe(ctx => {
      const t = resolve(ctx.source.server, str(ctx, 'player'))
      if (!t) return reply(ctx, 'Unknown player.', true)
      const n = clearBounty(ctx.source.server, t)
      return reply(ctx, n ? 'The ' + n + '-coin bounty on ' + t.name + ' is cleared; every placer got their part back (offline ones on login).' : 'No bounty on ' + t.name + '.')
    }))))
    .then(Commands.literal('toggle').requires(op).executes(safe(ctx => {
      db().enabled = !db().enabled
      save()
      return reply(ctx, 'Bounties are now ' + (db().enabled ? 'OPEN' : 'CLOSED (pots kept; nothing is placed or collected)') + '.')
    })))
    .then(Commands.literal('log').requires(op).executes(safe(ctx => {
      const l = db().log
      if (!l.length) return reply(ctx, 'Nothing yet.')
      l.slice(-15).forEach(x => reply(ctx, x))
      return 1
    })))
    .then(word('player').executes(asPlayer((ctx, p) => {
      const why = whyNotHere(p)
      if (why) return why
      return chatAmounts(p, str(ctx, 'player'))
    }))
      .then(int('amount').executes(asPlayer((ctx, p) => place(p, str(ctx, 'player'), num(ctx, 'amount')))))))
  event.register(Commands.literal('bounties').executes(list))
})

})()
