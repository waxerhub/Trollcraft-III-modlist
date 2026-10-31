// The Troll Log and the Blood Pool: every troll is logged, scored and paid, and its blood goes into the pool.
//
//  - Logged automatically by the black market (economy/black_market.js): Disguised TNT and Teleport Traps sprung on
//    someone else, Mimic Chests opened, Cursed Food eaten, Anonymous Summons delivered, a Homing Pig reaching the
//    target's bed. Butterfingers and Itching Powder are too easy to land, so they go through manual reports.
//  - Manual reports: /troll report <victim> <what>, witnesses back it with /troll witness <n>, and an op sets the
//    points with /troll approve <n> <points> (or /troll deny <n>).
//  - Each troll pays the troller Hush Coins (less than the troll item cost, so friends can't print coins).
//  - The Blood Pool: every troll's points go in as Drops of Blood, and Hush Coins can be donated (1,000 Drops each).
//    When it's full, the Blood Gate to the new world can open (Protocol Clean Slate, see STORY.md).
//  - Trollers stay anonymous: players see "someone" in the public log; ops see names.
//
// Needs economy/black_market.js (global.Economy: coins, AFK). Uses factions/factions_core.js (global.Factions) for
// the cross-faction bonus. Both looked up when needed. See tools/kubejs/TROLLS.md.
//
// Commands: /trolls log|top|me, /troll report|witness (players), /troll pending|approve|deny (op),
// /bloodpool [donate <coins>] (players), /bloodpool add|set (op). Copy to <server>/kubejs/server_scripts/economy/
// and run /reload.
//
// KubeJS 6 notes: no template strings; `let` inside nested blocks; public messages go to each player with
// player.tell (nothing here is sent with tellraw @a).

(function () {

// ===================== SETTINGS =====================

// points: the troll's value (also its Drops of Blood). coins: Hush Coins paid to the troller (about a quarter of the
// item's price). perCurse: extra points per curse a Cursed Food brought.
const TROLL_TYPES = {
  summons: { name: 'Anonymous Summons', points: 50, coins: 1 },
  food: { name: 'Cursed Food', points: 100, perCurse: 25, coins: 2 },
  mimic: { name: 'Mimic Chest', points: 150, coins: 3 },
  pig: { name: 'Homing Pig', points: 150, coins: 5 },
  tp: { name: 'Teleport Trap', points: 200, coins: 5 },
  tnt: { name: 'Disguised TNT', points: 250, coins: 6 },
  manual: { name: 'Reported troll', points: 0, coinsPer100: 1 },   // points set by the op who approves it
}
// Trolling someone of the opposite faction: this much more blood goes into the pool. Never shown per troll (the
// Syndicate is secret, so a visible bonus would give it away).
const CROSS_FACTION_BONUS = 1.5
const REVENGE = { multiplier: 2, hours: 24 }                // a victim who trolls their troller back within 24 h
const REPEAT = { hours: 24, factors: [1, 0.5, 0.25] }       // the same troller and victim: 1st, 2nd, 3rd+ in 24 h
const GOOD_SPORT = 0.1                                      // the victim's share, as personal points (no coins)
const SKIP_AFK = true                                       // no credit for trolling an AFK player
const SKIP_SAME_IP = true                                   // ...or a player on the same IP (alts)
// The Blood Pool. exodusQuota: when the pool reaches it, the Blood Gate to the new world can open.
const POOL = { dropsPerCoin: 1000, exodusQuota: 100000, milestones: [25, 50, 75, 100] }
const REPORT = { witnessesNeeded: 1, maxText: 120, expireDays: 14 }
const RECAP_DAYS = 7                                        // the Ministry's weekly recap
const LOG_SIZE = 500

const VOICE_LOG = { tag: '[TROLL LOG]', tagColor: 'dark_purple', textColor: 'light_purple' }
const VOICE_MINISTRY = { tag: '[MINISTRY]', tagColor: 'gold', textColor: 'yellow' }
const VOICE_HIJACK = { tag: '[SIGNAL HIJACKED]', tagColor: 'dark_red', textColor: 'red' }
const MILESTONE_LINES = {
  25: 'Blood has been placed in the Blood Pool. A quarter full. Keep trolling.',
  50: 'The Blood Pool is half full. They are starting to notice.',
  75: 'Three quarters. The Gate can hear you now.',
  100: 'The Blood Pool is full. The Blood Gate is ready. Blood for the Blood God.',
}


// ===================== STATE =====================

const DATA_KEY = 'trolls'
if (!global.trollsState) global.trollsState = { token: 0 }
const S = global.trollsState
S.token++

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
function E() { return global.Economy || null }     // economy/black_market.js
function F() { return global.Factions || null }    // factions/factions_core.js
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
function line(p, parts) { try { p.tell(comp(parts)) } catch (e) { } }
function coins(n) {
  const e = E()
  if (e && e.coinText) return String(e.coinText(n))
  return n + ' Hush Coin' + (n == 1 ? '' : 's')
}
function fmt(n) { return String(Math.round(n)).replace(/\B(?=(\d{3})+(?!\d))/g, ',') }
function ago(ms) {
  const m = Math.floor(ms / 60000)
  if (m < 60) return m + ' min ago'
  const h = Math.floor(m / 60)
  return h < 48 ? h + ' h ago' : Math.floor(h / 24) + ' days ago'
}


// ===================== SAVED DATA =====================
// server.persistentData['trolls'] = one JSON string:
//   { v, log: [ { t, by, byName, on, onName, type, pts, detail } ], players: { uuid: { name, points, trolls, trolled,
//     coins, donated } }, pool: { drops, fromTrolls, fromCoins, milestones: { "25": true } }, reports: { n: {...} },
//     nextReport, pairs: { "troller|victim": [ms] }, lastTrolledBy: { victim: { by, t } }, pendingCoins: { uuid: n },
//     week: { start, count, points } }

let DB = null
function db() {
  if (DB) return DB
  let raw = ''
  try { raw = String(Utils.server.persistentData.getString(DATA_KEY) || '') } catch (e) { }
  let parsed = null
  if (raw) {
    try { parsed = JSON.parse(raw) } catch (e) {
      try { Utils.server.persistentData.putString(DATA_KEY + '_unreadable_' + Date.now(), raw) } catch (e2) { }
      console.error('[Trolls] Saved data could not be read (' + e + '); a copy was kept and it starts fresh.')
    }
  }
  DB = parsed && parsed.v ? parsed : { v: 1 }
  if (!DB.log) DB.log = []
  ;['players', 'reports', 'pairs', 'lastTrolledBy', 'pendingCoins'].forEach(k => { if (!DB[k]) DB[k] = {} })
  if (!DB.pool) DB.pool = { drops: 0, fromTrolls: 0, fromCoins: 0, milestones: {} }
  if (!DB.pool.milestones) DB.pool.milestones = {}
  if (!DB.nextReport) DB.nextReport = 1
  if (!DB.week) DB.week = { start: Date.now(), count: 0, points: 0 }
  return DB
}
function save() {
  try { Utils.server.persistentData.putString(DATA_KEY, JSON.stringify(db())) } catch (e) { console.error('[Trolls] Save failed: ' + e) }
}
function stats(u, name) {
  const D = db()
  if (!D.players[u]) D.players[u] = { name: name || '?', points: 0, trolls: 0, trolled: 0, coins: 0, donated: 0 }
  if (name) D.players[u].name = name
  return D.players[u]
}


// ===================== THE BLOOD POOL =====================

function poolFull() { return db().pool.drops >= POOL.exodusQuota }
function addDrops(server, n, source) {
  const P = db().pool
  n = Math.max(0, Math.round(n))
  if (!n) return
  P.drops += n
  if (source == 'coins') P.fromCoins += n
  else if (source == 'trolls') P.fromTrolls += n
  POOL.milestones.forEach(m => {
    if (P.milestones[m] || P.drops < POOL.exodusQuota * m / 100) return
    P.milestones[m] = true
    if (server) sayAll(server, VOICE_HIJACK, MILESTONE_LINES[m] || ('The Blood Pool is ' + m + '% full.'))
    if (m >= 100 && server) {
      onlinePlayers(server).filter(isOp).forEach(o => say(o, VOICE_LOG, 'The Blood Pool is full (' + fmt(P.drops) + ' Drops). The Blood Gate can open for Protocol Clean Slate.'))
      console.info('[Trolls] The Blood Pool is full: ' + P.drops + ' Drops')
    }
  })
}
function poolText() {
  const P = db().pool
  return fmt(P.drops) + ' / ' + fmt(POOL.exodusQuota) + ' Drops of Blood (' + Math.min(100, Math.floor(P.drops * 100 / POOL.exodusQuota)) + '%)'
}


// ===================== RECORDING A TROLL =====================

function factionOf(u) {
  const f = F()
  if (!f) return ''
  try { return String(f.getFaction(u)) } catch (e) { return '' }
}
function crossFaction(a, b) {
  const f = F()
  if (!f) return false
  const def = String(f.DEFAULT != null ? f.DEFAULT : 'unregistered')
  const fa = factionOf(a), fb = factionOf(b)
  return !!fa && !!fb && fa != def && fb != def && fa != fb
}
function ipOf(p) { try { return String(p.getIpAddress()) } catch (e) { return '' } }
function payCoins(server, u, n) {
  if (n <= 0) return
  const p = playerByUuid(server, u), e = E()
  if (p && e) { e.giveCoins(p, n, 'troll'); return }
  const D = db()
  D.pendingCoins[u] = (D.pendingCoins[u] || 0) + n
}

// troller / victim: a player, or { uuid, name }. opts: { curses, detail, points (manual), manual }.
// Returns the log entry, or null with the reason in S.lastSkip.
function record(troller, victim, type, opts) {
  opts = opts || {}
  const server = Utils.server, def = TROLL_TYPES[type]
  S.lastSkip = ''
  if (!def || !troller || !victim) { S.lastSkip = 'unknown troll'; return null }
  const tu = troller.uuid ? String(troller.uuid) : uuidOf(troller)
  const vu = victim.uuid ? String(victim.uuid) : uuidOf(victim)
  const D = db()
  const tn = troller.name ? String(troller.name) : (troller.uuid ? (D.players[tu] ? D.players[tu].name : '?') : nameOf(troller))
  const vn = victim.name ? String(victim.name) : (victim.uuid ? (D.players[vu] ? D.players[vu].name : '?') : nameOf(victim))
  if (!tu || !vu || tu == vu) { S.lastSkip = 'self'; return null }
  const tp = server ? playerByUuid(server, tu) : null, vp = server ? playerByUuid(server, vu) : null
  if (!opts.manual) {
    if (SKIP_AFK && vp && E() && E().isAfk) {
      try { if (E().isAfk(vp)) { S.lastSkip = 'afk'; return null } } catch (e) { }
    }
    if (SKIP_SAME_IP && vp && tp && ipOf(vp) && ipOf(vp) == ipOf(tp)) { S.lastSkip = 'same ip'; return null }
  }
  const now = Date.now()
  let pts = opts.points != null ? Number(opts.points) : def.points + (def.perCurse || 0) * (opts.curses || 0)
  let factor = 1, revenge = false
  if (!opts.manual) {
    let key = tu + '|' + vu
    let recent = (D.pairs[key] || []).filter(t => now - t < REPEAT.hours * 3600000)
    factor = REPEAT.factors[Math.min(recent.length, REPEAT.factors.length - 1)]
    recent.push(now)
    D.pairs[key] = recent
    let last = D.lastTrolledBy[tu]
    if (last && last.by == vu && now - last.t < REVENGE.hours * 3600000) {
      revenge = true
      delete D.lastTrolledBy[tu]
    }
  }
  pts = Math.round(pts * factor * (revenge ? REVENGE.multiplier : 1))
  let coinPay = type == 'manual' ? Math.floor(pts / 100) * (def.coinsPer100 || 0) : Math.floor((def.coins || 0) * factor)
  const ts = stats(tu, tn), vs = stats(vu, vn)
  ts.points += pts
  ts.trolls++
  ts.coins += coinPay
  vs.trolled++
  vs.points += Math.round(pts * GOOD_SPORT)
  D.lastTrolledBy[vu] = { by: tu, t: now }
  const entry = { t: now, by: tu, byName: tn, on: vu, onName: vn, type: type, pts: pts, detail: opts.detail ? String(opts.detail).substring(0, 80) : '' }
  D.log.push(entry)
  if (D.log.length > LOG_SIZE) D.log.splice(0, D.log.length - LOG_SIZE)
  D.week.count++
  D.week.points += pts
  if (server) payCoins(server, tu, coinPay)
  addDrops(server, pts * (crossFaction(tu, vu) ? CROSS_FACTION_BONUS : 1), 'trolls')
  save()
  if (tp) say(tp, VOICE_LOG, 'Troll logged: ' + def.name + ' on ' + vn + '. +' + pts + ' points' + (coinPay ? ', +' + coins(coinPay) : '') +
    (revenge ? ' (revenge!)' : factor < 1 ? ' (same victim again: less)' : '') + '.')
  console.info('[Trolls] ' + tn + ' trolled ' + vn + ' (' + type + '): ' + pts + ' points, ' + coinPay + ' coins')
  return entry
}


// ===================== MANUAL REPORTS =====================

const result = (ok, text) => ({ ok: ok, text: text })
function cleanText(t) { return String(t || '').replace(/[\u0000-\u001f§]/g, '').replace(/\s+/g, ' ').trim().substring(0, REPORT.maxText) }
function report(server, p, victimName, text) {
  const v = playerByName(server, victimName)
  const known = v ? { uuid: uuidOf(v), name: nameOf(v) } : knownByName(victimName)
  if (!known) return result(false, 'Nobody has heard of ' + victimName + '.')
  if (known.uuid == uuidOf(p)) return result(false, 'Trolling yourself doesn\'t count. It\'s just sad.')
  const what = cleanText(text)
  if (!what) return result(false, 'What did you do?')
  const D = db(), n = D.nextReport++
  D.reports[String(n)] = { by: uuidOf(p), byName: nameOf(p), on: known.uuid, onName: known.name, text: what, t: Date.now(), witnesses: {}, status: 'open' }
  save()
  onlinePlayers(server).filter(isOp).forEach(o => say(o, VOICE_LOG, 'Troll report #' + n + ': ' + nameOf(p) + ' → ' + known.name + ': ' + what + ' (/troll pending)'))
  return result(true, 'Troll report #' + n + ' filed. Witnesses can back it with /troll witness ' + n + '; an admin decides the points.')
}
function knownByName(name) {
  const D = db(), n = String(name).toLowerCase()
  const u = Object.keys(D.players).filter(k => String(D.players[k].name).toLowerCase() == n)[0]
  return u ? { uuid: u, name: D.players[u].name } : null
}
function witness(p, n) {
  const r = db().reports[String(n)]
  if (!r || r.status != 'open') return result(false, 'There is no open troll report #' + n + '.')
  const u = uuidOf(p)
  if (u == r.by || u == r.on) return result(false, 'The troller and the victim can\'t witness their own troll.')
  if (r.witnesses[u]) return result(false, 'You already backed report #' + n + '.')
  r.witnesses[u] = nameOf(p)
  save()
  return result(true, 'You backed troll report #' + n + ': ' + r.byName + ' → ' + r.onName + ': ' + r.text + '.')
}
function approve(server, n, points) {
  const r = db().reports[String(n)]
  if (!r || r.status != 'open') return result(false, 'There is no open troll report #' + n + '.')
  points = Math.floor(Number(points))
  if (!(points >= 1)) return result(false, 'Give it at least 1 point.')
  r.status = 'approved'
  r.points = points
  const entry = record({ uuid: r.by, name: r.byName }, { uuid: r.on, name: r.onName }, 'manual', { points: points, detail: r.text, manual: true })
  save()
  return result(!!entry, entry ? 'Report #' + n + ' approved: ' + r.byName + ' gets ' + entry.pts + ' points.' : 'Report #' + n + ' couldn\'t be recorded (' + S.lastSkip + ').')
}
function deny(n) {
  const r = db().reports[String(n)]
  if (!r || r.status != 'open') return result(false, 'There is no open troll report #' + n + '.')
  r.status = 'denied'
  save()
  return result(true, 'Report #' + n + ' denied.')
}
function pruneReports() {
  const D = db(), now = Date.now()
  Object.keys(D.reports).forEach(k => { if (now - D.reports[k].t > REPORT.expireDays * 86400000 && D.reports[k].status != 'open') delete D.reports[k] })
}


// ===================== WEEKLY RECAP, LOGIN =====================

function weeklyCheck(server) {
  const W = db().week, now = Date.now()
  if (now - W.start < RECAP_DAYS * 86400000) return
  sayAll(server, VOICE_MINISTRY, 'This week, ' + W.count + ' incident' + (W.count == 1 ? '' : 's') + ' of Unlicensed Humour ' + (W.count == 1 ? 'was' : 'were') +
    ' recorded (' + fmt(W.points) + ' points of damage to public order). The Ministry is not amused. The Ministry is never amused.')
  db().week = { start: now, count: 0, points: 0 }
  pruneReports()
  save()
}
function startLoop(server) {
  const token = S.token
  const step = () => {
    if (token != S.token) return
    try { weeklyCheck(server) } catch (e) { console.error('[Trolls] ' + e) }
    server.scheduleInTicks(6000, step)
  }
  server.scheduleInTicks(200, step)
}
PlayerEvents.loggedIn(event => {
  const p = event.player, u = uuidOf(p), D = db()
  stats(u, nameOf(p))
  const owed = D.pendingCoins[u]
  if (owed && E()) {
    delete D.pendingCoins[u]
    E().giveCoins(p, owed, 'trolls while away')
    say(p, VOICE_LOG, 'Your trolls paid ' + coins(owed) + ' while you were away.')
  }
  save()
})
ServerEvents.loaded(event => startLoop(event.server))
if (Utils.server) startLoop(Utils.server)


// ===================== API FOR OTHER SCRIPTS =====================

global.Trolls = {
  record: (troller, victim, type, opts) => record(troller, victim, type, opts),
  poolDrops: () => db().pool.drops,
  poolQuota: POOL.exodusQuota,
  poolFull: () => poolFull(),
  addDrops: (n, source) => { addDrops(Utils.server, n, source || 'other'); save() },
  stats: uuid => db().players[String(uuid)] || null,
}


// ===================== COMMANDS =====================

ServerEvents.commandRegistry(event => {
  const Commands = event.commands
  const Arguments = event.arguments
  const reply = (ctx, text, bad) => {
    ctx.source.sendSystemMessage(comp([{ text: '[Troll Log] ', color: 'dark_purple' }, { text: text, color: bad ? 'red' : 'gray' }]))
    return bad ? 0 : 1
  }
  const safe = fn => ctx => {
    try { return fn(ctx) } catch (e) {
      console.error('[Trolls] ' + e)
      return reply(ctx, 'Error: ' + e, true)
    }
  }
  const done = (ctx, r) => reply(ctx, r.text, !r.ok)
  const op = src => src.hasPermission(2)
  const word = name => Commands.argument(name, StringArg.word())
  const rest = name => Commands.argument(name, StringArg.greedyString())
  const str = (ctx, name) => String(StringArg.getString(ctx, name))
  const int = name => Commands.argument(name, Arguments.INTEGER.create(event))
  const num = (ctx, name) => Number(Arguments.INTEGER.getResult(ctx, name))
  const me = ctx => ctx.source.getPlayer()
  const out = (ctx, parts) => { const p = me(ctx); if (p) line(p, parts); else reply(ctx, parts.map(x => x.text).join('')); return 1 }
  const asPlayer = fn => safe(ctx => { const p = me(ctx); if (!p) return reply(ctx, 'Players only.', true); return fn(ctx, p) })

  const showLog = safe(ctx => {
    const p = me(ctx), ops = !p || isOp(p), L = db().log.slice(-10).reverse()
    if (!L.length) return reply(ctx, 'No trolls logged yet. Suspicious.')
    reply(ctx, 'The last ' + L.length + ' trolls:')
    L.forEach(e => out(ctx, [{ text: '  ' + ago(Date.now() - e.t) + ': ', color: 'dark_gray' },
      { text: (ops ? e.byName : 'someone'), color: 'light_purple' }, { text: ' → ', color: 'gray' }, { text: e.onName, color: 'light_purple' },
      { text: ': ' + (TROLL_TYPES[e.type] ? TROLL_TYPES[e.type].name : e.type) + (e.detail && e.type == 'manual' ? ' (' + e.detail + ')' : '') + ', +' + e.pts, color: 'gray' }]))
    return 1
  })
  const showTop = safe(ctx => {
    const P = db().players
    const list = Object.keys(P).filter(u => P[u].trolls > 0).sort((a, b) => P[b].points - P[a].points).slice(0, 10)
    if (!list.length) return reply(ctx, 'Nobody has trolled anyone yet. The Ministry is pleased.')
    reply(ctx, 'The greatest trolls:')
    list.forEach((u, i) => out(ctx, [{ text: '  ' + (i + 1) + '. ', color: 'gold' }, { text: P[u].name, color: 'light_purple', bold: i == 0 },
      { text: ': ' + fmt(P[u].points) + ' points, ' + P[u].trolls + ' troll' + (P[u].trolls == 1 ? '' : 's'), color: 'gray' }]))
    return 1
  })
  const showMe = asPlayer((ctx, p) => {
    const u = uuidOf(p), s = db().players[u]
    if (!s) return reply(ctx, 'You haven\'t trolled anyone yet.')
    reply(ctx, 'You: ' + fmt(s.points) + ' points, ' + s.trolls + ' troll' + (s.trolls == 1 ? '' : 's') + ', trolled ' + s.trolled + ' time' + (s.trolled == 1 ? '' : 's') +
      ', ' + coins(s.coins) + ' earned' + (s.donated ? ', ' + coins(s.donated) + ' given to the Blood Pool' : '') + '.')
    db().log.filter(e => e.by == u).slice(-5).reverse().forEach(e => reply(ctx, '  ' + ago(Date.now() - e.t) + ': ' +
      (TROLL_TYPES[e.type] ? TROLL_TYPES[e.type].name : e.type) + ' on ' + e.onName + ', +' + e.pts))
    return 1
  })

  event.register(Commands.literal('trolls')
    .executes(showMe)
    .then(Commands.literal('log').executes(showLog))
    .then(Commands.literal('top').executes(showTop))
    .then(Commands.literal('me').executes(showMe)))

  event.register(Commands.literal('troll')
    .then(Commands.literal('report').then(word('victim').then(rest('what').executes(asPlayer((ctx, p) => done(ctx, report(ctx.source.server, p, str(ctx, 'victim'), str(ctx, 'what'))))))))
    .then(Commands.literal('witness').then(int('number').executes(asPlayer((ctx, p) => done(ctx, witness(p, num(ctx, 'number')))))))
    .then(Commands.literal('pending').requires(op).executes(safe(ctx => {
      const R = db().reports, open = Object.keys(R).filter(k => R[k].status == 'open').sort((a, b) => Number(a) - Number(b))
      if (!open.length) return reply(ctx, 'No troll reports waiting.')
      open.forEach(k => {
        let r = R[k], w = Object.keys(r.witnesses).map(u => r.witnesses[u])
        reply(ctx, '#' + k + ' ' + r.byName + ' → ' + r.onName + ': ' + r.text + ' (' + ago(Date.now() - r.t) + '; witnesses: ' +
          (w.length ? w.join(', ') : 'none') + (w.length < REPORT.witnessesNeeded ? ', needs ' + REPORT.witnessesNeeded : '') + ')')
      })
      return 1
    })))
    .then(Commands.literal('approve').requires(op).then(int('number').then(int('points').executes(safe(ctx => done(ctx, approve(ctx.source.server, num(ctx, 'number'), num(ctx, 'points'))))))))
    .then(Commands.literal('deny').requires(op).then(int('number').executes(safe(ctx => done(ctx, deny(num(ctx, 'number'))))))))

  event.register(Commands.literal('bloodpool')
    .executes(safe(ctx => reply(ctx, 'The Blood Pool: ' + poolText() + '. Every troll fills it; so does every Hush Coin given (' + fmt(POOL.dropsPerCoin) + ' Drops each, /bloodpool donate <coins>).')))
    .then(Commands.literal('donate').then(int('coins').executes(asPlayer((ctx, p) => {
      const e = E(), n = Math.floor(num(ctx, 'coins'))
      if (!e) return reply(ctx, 'The Blood Pool can\'t take coins right now.', true)
      if (!(n >= 1)) return reply(ctx, 'Give at least one coin.', true)
      if (e.countCoins(p) < n) return reply(ctx, 'You only carry ' + coins(e.countCoins(p)) + '.', true)
      e.takeCoins(p, n)
      stats(uuidOf(p), nameOf(p)).donated += n
      addDrops(ctx.source.server, n * POOL.dropsPerCoin, 'coins')
      save()
      console.info('[Trolls] ' + nameOf(p) + ' gave ' + n + ' coins to the Blood Pool')
      return reply(ctx, coins(n) + ' given to the Blood Pool. ' + poolText() + '.')
    }))))
    .then(Commands.literal('add').requires(op).then(int('drops').executes(safe(ctx => {
      addDrops(ctx.source.server, num(ctx, 'drops'), 'other')
      save()
      return reply(ctx, 'The Blood Pool: ' + poolText() + '.')
    }))))
    .then(Commands.literal('set').requires(op).then(int('drops').executes(safe(ctx => {
      const P = db().pool
      P.drops = Math.max(0, num(ctx, 'drops'))
      Object.keys(P.milestones).forEach(m => { if (P.drops < POOL.exodusQuota * Number(m) / 100) delete P.milestones[m] })
      save()
      return reply(ctx, 'The Blood Pool set to ' + poolText() + '.')
    })))))
})

})()
