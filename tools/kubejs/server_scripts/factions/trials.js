// Trials: the Ministry's docket. Judges file charges against players and rule on them; everything ends up on the
// accused's permanent record.
//
//  - Judges: ops, and members of the Crownsworn (faction id 'ministry') ranked Enforcer or above (JUDGES).
//  - /accuse <player> <charge> files a numbered charge. Offline players the server knows can be charged.
//  - A judge rules on a charge: GUILTY or ACQUITTED. A verdict is only recorded and announced; any punishment is
//    handed out by hand. Nobody rules on a charge against themselves.
//  - A Certified Alibi (bought from the Hooded Merchant, economy/black_market.js) dismisses one OPEN charge. It's
//    used by the accused: right-click it, or /trial alibi <#>.
//  - Hurting a Homing Pig (black market) files a Sanctity of Swine Act charge automatically, through global.Trials.
//
// Uses factions/factions_core.js (global.Factions) for the judges' rank and economy/black_market.js
// (global.Economy) for the alibis; both looked up when needed, so the load order doesn't matter. Without
// factions_core only ops are judges. See tools/kubejs/TRIALS.md.
//
// Commands: /accuse, /trial docket|guilty|acquit|drop (judges), /charges, /record (anyone), /trial alibi (the
// accused), /trial log (op level 2). Copy to <server>/kubejs/server_scripts/factions/ and run /reload.
//
// KubeJS 6 notes: no template strings; `let` inside nested blocks; announcements use player.tell to each player,
// never tellraw @a (Simple Discord Link relays that to Discord).

(function () {

// ===================== SETTINGS =====================

const JUDGES = { faction: 'ministry', rank: 'Enforcer' }   // this rank or above in this faction (ops always)
const ANNOUNCE = true                  // tell everyone online about charges, verdicts and dismissals
const MAX_CHARGE_LENGTH = 120          // characters
const RECORD_LINES = 15                // /record shows this many, newest first

const VOICE = { tag: '[MINISTRY]', tagColor: 'gold', textColor: 'yellow' }
const VOICE_COURT = { tag: '[COURT]', tagColor: 'gold', textColor: 'gray' }
const GAVEL_SOUND = 'minecraft:block.anvil.land'

const GUILTY_LINES = ['The Ministry has never lost a trial.', 'Justice has been served. Seconds are available on request.',
  'The record has been updated. The record is permanent.']
const ACQUIT_LINES = ['The Ministry regrets the inconvenience to itself.', 'This changes nothing. The Ministry is watching.',
  'Innocence has been noted, and will be reviewed.']


// ===================== STATE =====================

const DATA_KEY = 'trials'
const LOG_SIZE = 100

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
function dateText(ms) {
  const d = new Date(ms)
  const two = n => (n < 10 ? '0' : '') + n
  return d.getUTCFullYear() + '-' + two(d.getUTCMonth() + 1) + '-' + two(d.getUTCDate()) + ' ' + two(d.getUTCHours()) + ':' + two(d.getUTCMinutes()) + ' UTC'
}
function pick(list) { return list[Math.floor(Math.random() * list.length)] }

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
function button(label, color, command, hover) {
  return { text: label, color: color, bold: true, clickEvent: { action: 'run_command', value: command }, hoverEvent: { action: 'show_text', contents: hover || command } }
}
function gavel(server) {
  onlinePlayers(server).forEach(p => {
    try { server.runCommandSilent('execute as ' + uuidOf(p) + ' at @s run playsound ' + GAVEL_SOUND + ' master @s ~ ~ ~ 0.4 1.6') } catch (e) { }
  })
}


// ===================== SAVED DATA =====================
// server.persistentData['trials'] = one JSON string:
//   { v, next, charges: { "12": { target, targetName, text, by, byName, filed, status, ruledBy, ruledAt, note } },
//     known: { uuid: name }, notices: { uuid: [ text ] }, log: [ text ] }
// Statuses: open, guilty, acquitted, dismissed (alibi), dropped.

let DB = null
function db() {
  if (DB) return DB
  let raw = ''
  try { raw = String(Utils.server.persistentData.getString(DATA_KEY) || '') } catch (e) { }
  let parsed = null
  if (raw) {
    try { parsed = JSON.parse(raw) } catch (e) {
      try { Utils.server.persistentData.putString(DATA_KEY + '_unreadable_' + Date.now(), raw) } catch (e2) { }
      console.error('[Trials] Saved data could not be read (' + e + '); a copy was kept and it starts fresh.')
    }
  }
  DB = parsed && parsed.v ? parsed : { v: 1 }
  if (!DB.next) DB.next = 1
  ;['charges', 'known', 'notices'].forEach(k => { if (!DB[k]) DB[k] = {} })
  if (!DB.log) DB.log = []
  return DB
}
function save() {
  try { Utils.server.persistentData.putString(DATA_KEY, JSON.stringify(db())) } catch (e) { console.error('[Trials] Save failed: ' + e) }
}
function log(text) {
  const D = db()
  D.log.push(dateText(Date.now()) + ': ' + text)
  if (D.log.length > LOG_SIZE) D.log.splice(0, D.log.length - LOG_SIZE)
  console.info('[Trials] ' + text)
}


// ===================== PEOPLE =====================

// A judge: an op, or JUDGES.rank or above in JUDGES.faction. null (the console, a command block) counts as a judge.
function isJudge(p) {
  if (!p) return true
  if (isOp(p)) return true
  const f = F()
  if (!f || !f.hasRankAtLeast) return false
  try { return !!f.hasRankAtLeast(p, JUDGES.rank, JUDGES.faction) } catch (e) { return false }
}
function remember(p) {
  const D = db(), u = uuidOf(p), n = nameOf(p)
  if (D.known[u] == n) return false
  D.known[u] = n
  Object.keys(D.charges).forEach(k => { if (D.charges[k].target == u) D.charges[k].targetName = n })
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
// Tells an online player now, or keeps it for their next login.
function notify(server, u, text) {
  const p = playerByUuid(server, u)
  if (p) { say(p, VOICE_COURT, text); return }
  const D = db()
  if (!D.notices[u]) D.notices[u] = []
  D.notices[u].push(text)
  if (D.notices[u].length > 20) D.notices[u].splice(0, D.notices[u].length - 20)
}


// ===================== CHARGES =====================

const result = (ok, text) => ({ ok: ok, text: text })
function chargeOf(n) { return db().charges[String(Math.floor(Number(n)))] || null }
function chargeNumbers(filter) {
  const D = db()
  return Object.keys(D.charges).filter(k => filter(D.charges[k])).map(k => Number(k)).sort((a, b) => a - b)
}
function openCharges(u) { return chargeNumbers(c => c.target == u && c.status == 'open') }
function cleanText(text) {
  return String(text || '').replace(/[\u0000-\u001f§]/g, '').replace(/\s+/g, ' ').trim().substring(0, MAX_CHARGE_LENGTH)
}

// Files a charge. by: the accusing player, or null with byName (e.g. 'The Ministry' for automatic charges).
// Returns the charge number.
function file(server, target, text, by, byName) {
  const D = db(), n = D.next++
  D.charges[String(n)] = { target: target.uuid, targetName: target.name, text: text, by: by ? uuidOf(by) : '', byName: by ? nameOf(by) : String(byName || 'The Ministry'),
    filed: Date.now(), status: 'open' }
  if (!D.known[target.uuid]) D.known[target.uuid] = target.name
  const c = D.charges[String(n)]
  log('#' + n + ' filed against ' + target.name + ' by ' + c.byName + ': ' + text)
  if (ANNOUNCE) sayAll(server, VOICE, 'Charge #' + n + ' filed against ' + target.name + ': ' + text + '. Filed by ' + c.byName + '.')
  notify(server, target.uuid, 'You stand accused (#' + n + '): ' + text + '. /charges lists what you stand accused of.')
  save()
  return n
}

function accuse(server, judge, targetName, text) {
  if (!isJudge(judge)) return result(false, 'Only Enforcers and above may file charges.')
  const t = resolve(server, targetName)
  if (!t) return result(false, 'Nobody has heard of ' + targetName + '.')
  if (judge && t.uuid == uuidOf(judge)) return result(false, 'You can\'t accuse yourself. Confessions go through the usual channels.')
  const clean = cleanText(text)
  if (!clean) return result(false, 'What is the charge?')
  const n = file(server, t, clean, judge, judge ? null : 'the Court')
  return result(true, 'Charge #' + n + ' filed against ' + t.name + '.')
}

// status: guilty, acquitted or dropped. judge: a player, or null (the console).
function rule(server, judge, n, status, note) {
  if (!isJudge(judge)) return result(false, 'Only Enforcers and above may rule on charges.')
  const c = chargeOf(n)
  if (!c) return result(false, 'There is no charge #' + n + '.')
  if (c.status != 'open') return result(false, 'Charge #' + n + ' is already closed (' + c.status + ').')
  if (judge && c.target == uuidOf(judge)) return result(false, 'You can\'t rule on a charge against yourself.')
  c.status = status
  c.ruledBy = judge ? nameOf(judge) : 'the Court'
  c.ruledAt = Date.now()
  const clean = cleanText(note)
  if (clean) c.note = clean
  log('#' + n + ' (' + c.targetName + ': ' + c.text + ') ' + status + ' by ' + c.ruledBy + (clean ? ' - ' + clean : ''))
  save()
  const extra = clean ? ' Note: ' + clean + '.' : ''
  if (status == 'guilty') {
    if (ANNOUNCE) { sayAll(server, VOICE, 'Charge #' + n + ': ' + c.targetName + ' is found GUILTY of ' + c.text + '. ' + pick(GUILTY_LINES) + extra); gavel(server) }
    notify(server, c.target, 'Verdict on #' + n + ': GUILTY.' + extra)
  } else if (status == 'acquitted') {
    if (ANNOUNCE) { sayAll(server, VOICE, 'Charge #' + n + ': ' + c.targetName + ' is ACQUITTED of ' + c.text + '. ' + pick(ACQUIT_LINES) + extra); gavel(server) }
    notify(server, c.target, 'Verdict on #' + n + ': ACQUITTED.' + extra)
  } else {
    if (ANNOUNCE) sayAll(server, VOICE, 'Charge #' + n + ' against ' + c.targetName + ' has been withdrawn.')
    notify(server, c.target, 'Charge #' + n + ' against you has been withdrawn.')
  }
  return result(true, 'Charge #' + n + ': ' + status + '.')
}

// The accused uses a Certified Alibi on one of their open charges. The alibi itself is checked and used up by
// the black market (global.Economy.takeAlibi), which keeps the serial numbers.
function useAlibi(server, p, n) {
  const c = chargeOf(n)
  if (!c || c.target != uuidOf(p)) return result(false, 'You have no charge #' + n + '.')
  if (c.status != 'open') return result(false, 'Charge #' + n + ' is already closed (' + c.status + '). Alibis only work before the verdict.')
  const e = E()
  if (!e || !e.takeAlibi) return result(false, 'Nobody certifies alibis right now.')
  const r = e.takeAlibi(p, '#' + n)
  if (!r || !r.ok) return result(false, r && r.text ? r.text : 'You aren\'t carrying a Certified Alibi.')
  c.status = 'dismissed'
  c.ruledBy = 'alibi ' + r.serial
  c.ruledAt = Date.now()
  log('#' + n + ' (' + c.targetName + ': ' + c.text + ') dismissed by Certified Alibi ' + r.serial)
  save()
  if (ANNOUNCE) sayAll(server, VOICE, 'Charge #' + n + ' against ' + c.targetName + ' is dismissed: alibi certified.')
  return result(true, 'Charge #' + n + ' is dismissed. Your alibi is on file now.')
}

const STATUS_TEXT = { open: 'OPEN', guilty: 'GUILTY', acquitted: 'acquitted', dismissed: 'dismissed (alibi)', dropped: 'withdrawn' }
const STATUS_COLOR = { open: 'yellow', guilty: 'red', acquitted: 'green', dismissed: 'aqua', dropped: 'gray' }
function chargeLine(n, c, withName) {
  return [{ text: '  #' + n + ' ', color: 'gold' }, { text: (withName ? c.targetName + ': ' : '') + c.text, color: 'white' },
    { text: ' - ' + STATUS_TEXT[c.status] + ', filed ' + dateText(c.filed) + ' by ' + c.byName + (c.ruledBy && c.status != 'open' ? ', ' + c.ruledBy : '') +
      (c.note ? ' (' + c.note + ')' : ''), color: STATUS_COLOR[c.status] || 'gray' }]
}
// For a player (chat lines) or the console (replies).
function showCharges(out, t, mine) {
  const list = openCharges(t.uuid)
  if (!list.length) return out.text((mine ? 'You stand' : t.name + ' stands') + ' accused of nothing. For now.')
  out.text((mine ? 'You stand' : t.name + ' stands') + ' accused of:')
  list.forEach(n => out.parts(chargeLine(n, chargeOf(n), false)))
  return 1
}
function showRecord(out, t) {
  const list = chargeNumbers(c => c.target == t.uuid).reverse()
  if (!list.length) return out.text(t.name + ' has a clean record. Suspicious.')
  const guilty = list.filter(n => chargeOf(n).status == 'guilty').length
  out.text('The permanent record of ' + t.name + ' (' + list.length + ' charge' + (list.length == 1 ? '' : 's') + ', ' + guilty + ' guilty):')
  list.slice(0, RECORD_LINES).forEach(n => out.parts(chargeLine(n, chargeOf(n), false)))
  if (list.length > RECORD_LINES) out.text('...and ' + (list.length - RECORD_LINES) + ' older.')
  return 1
}
function showDocket(out) {
  const list = chargeNumbers(c => c.status == 'open')
  if (!list.length) return out.text('The docket is empty. Suspicious.')
  out.text('Open charges:')
  list.forEach(n => out.parts(chargeLine(n, chargeOf(n), true)))
  return 1
}
// The alibi's right-click (from the black market): the player's open charges with [USE] buttons.
function alibiMenu(p) {
  const list = openCharges(uuidOf(p))
  if (!list.length) { say(p, VOICE_COURT, 'You have nothing to be innocent of. Yet.'); return }
  say(p, VOICE_COURT, 'Which charge does your alibi cover?')
  list.forEach(n => {
    let c = chargeOf(n)
    line(p, [{ text: '  #' + n + ' ' + c.text + ' ', color: 'white' }, button('[USE]', 'aqua', '/trial alibi ' + n, 'Dismiss charge #' + n + ' with your Certified Alibi')])
  })
}


// ===================== API FOR OTHER SCRIPTS =====================

global.Trials = {
  // Files a charge against a player (online or not). Returns the charge number.
  fileCharge: (targetUuid, targetName, text, byName) => file(Utils.server, { uuid: String(targetUuid), name: String(targetName) }, cleanText(text), null, byName),
  openCharges: uuid => openCharges(String(uuid)).map(n => { const c = chargeOf(n); return { number: n, text: c.text, filed: c.filed, byName: c.byName } }),
  useAlibi: (player, number) => useAlibi(Utils.server, player, number),
  alibiMenu: player => alibiMenu(player),
  isJudge: player => isJudge(player),
}


// ===================== EVENTS =====================

PlayerEvents.loggedIn(event => {
  const p = event.player, D = db(), u = uuidOf(p)
  let changed = remember(p)
  if (D.notices[u] && D.notices[u].length) {
    D.notices[u].forEach(t => say(p, VOICE_COURT, 'While you were away: ' + t))
    delete D.notices[u]
    changed = true
  }
  if (changed) save()
})

function startUp(server) {
  onlinePlayers(server).forEach(p => remember(p))
  rememberFactionMembers()
  save()
}
ServerEvents.loaded(event => startUp(event.server))
if (Utils.server) startUp(Utils.server)


// ===================== COMMANDS =====================

ServerEvents.commandRegistry(event => {
  const Commands = event.commands
  const Arguments = event.arguments
  const reply = (ctx, text, bad) => {
    ctx.source.sendSystemMessage(comp([{ text: '[Court] ', color: 'gold' }, { text: text, color: bad ? 'red' : 'gray' }]))
    return bad ? 0 : 1
  }
  const safe = fn => ctx => {
    try { return fn(ctx) } catch (e) {
      console.error('[Trials] ' + e)
      return reply(ctx, 'Error: ' + e, true)
    }
  }
  const op = src => src.hasPermission(2)
  const word = name => Commands.argument(name, StringArg.word())
  const rest = name => Commands.argument(name, StringArg.greedyString())
  const str = (ctx, name) => String(StringArg.getString(ctx, name))
  const int = name => Commands.argument(name, Arguments.INTEGER.create(event))
  const num = (ctx, name) => Number(Arguments.INTEGER.getResult(ctx, name))
  const me = ctx => ctx.source.getPlayer()
  const done = (ctx, r) => reply(ctx, r.text, !r.ok)
  // Where a listing goes: chat lines for a player, replies for the console.
  const out = ctx => ({
    text: t => { reply(ctx, t); return 1 },
    parts: parts => { const p = me(ctx); if (p) line(p, parts); else reply(ctx, parts.map(x => x.text).join('')); return 1 },
  })
  const judgeOnly = fn => safe(ctx => {
    if (!isJudge(me(ctx))) return reply(ctx, 'Only Enforcers and above may do that.', true)
    return fn(ctx)
  })
  const verdict = status => judgeOnly(ctx => done(ctx, rule(ctx.source.server, me(ctx), num(ctx, 'number'), status, '')))
  const verdictNote = status => judgeOnly(ctx => done(ctx, rule(ctx.source.server, me(ctx), num(ctx, 'number'), status, str(ctx, 'note'))))

  event.register(Commands.literal('accuse')
    .then(word('player').then(rest('charge').executes(judgeOnly(ctx => done(ctx, accuse(ctx.source.server, me(ctx), str(ctx, 'player'), str(ctx, 'charge'))))))))

  event.register(Commands.literal('charges')
    .executes(safe(ctx => {
      const p = me(ctx)
      if (!p) return reply(ctx, 'Name a player: /charges <player>.', true)
      return showCharges(out(ctx), { uuid: uuidOf(p), name: nameOf(p) }, true)
    }))
    .then(word('player').executes(safe(ctx => {
      const t = resolve(ctx.source.server, str(ctx, 'player'))
      if (!t) return reply(ctx, 'Nobody has heard of ' + str(ctx, 'player') + '.', true)
      const p = me(ctx)
      return showCharges(out(ctx), t, !!p && uuidOf(p) == t.uuid)
    }))))

  event.register(Commands.literal('record')
    .executes(safe(ctx => {
      const p = me(ctx)
      if (!p) return reply(ctx, 'Name a player: /record <player>.', true)
      return showRecord(out(ctx), { uuid: uuidOf(p), name: nameOf(p) })
    }))
    .then(word('player').executes(safe(ctx => {
      const t = resolve(ctx.source.server, str(ctx, 'player'))
      if (!t) return reply(ctx, 'Nobody has heard of ' + str(ctx, 'player') + '.', true)
      return showRecord(out(ctx), t)
    }))))

  event.register(Commands.literal('trial')
    .then(Commands.literal('docket').executes(judgeOnly(ctx => showDocket(out(ctx)))))
    .then(Commands.literal('guilty').then(int('number').executes(verdict('guilty')).then(rest('note').executes(verdictNote('guilty')))))
    .then(Commands.literal('acquit').then(int('number').executes(verdict('acquitted')).then(rest('note').executes(verdictNote('acquitted')))))
    .then(Commands.literal('drop').then(int('number').executes(verdict('dropped'))))
    .then(Commands.literal('alibi').executes(safe(ctx => {
      const p = me(ctx)
      if (!p) return reply(ctx, 'Players only.', true)
      alibiMenu(p)
      return 1
    })).then(int('number').executes(safe(ctx => {
      const p = me(ctx)
      if (!p) return reply(ctx, 'Players only.', true)
      return done(ctx, useAlibi(ctx.source.server, p, num(ctx, 'number')))
    }))))
    .then(Commands.literal('log').requires(op).executes(safe(ctx => {
      const l = db().log
      if (!l.length) return reply(ctx, 'Nothing yet.')
      l.slice(-15).forEach(x => reply(ctx, x))
      return 1
    }))))
})

})()
