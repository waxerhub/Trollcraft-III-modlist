// priority: 1000
// Factions: the core. Storage, commands, chat, dimension tracking and the global.Factions API.
// Faction definitions and settings live in factions_config.js (loaded first, priority 1001).
// Other modules that use global.Factions should keep the default priority (0) so they load after this.
// Needs kubejs/startup_scripts/factions_hooks.js for the dimension events and the rank prefix in front of names
// (restart once after adding or updating it).
// See FACTIONS.md for the guide and test plan.
//
// Rules this file sticks to:
//  - Everything is event-driven. Nothing runs every tick.
//  - Faction data is saved in server.persistentData under its own key ('factions') and is never cleared.
//  - Messages go straight to the players who should see them (player.tell), never through /tellraw @a,
//    which Simple Discord Link relays to Discord.
//  - Secret factions (the Syndicate) never show up in anything another player can see: chat, the tab list,
//    nameplates, the display name, command replies, error messages or suggestions.
//  - Public factions' rank prefix goes in front of the player's display name (Forge's NameFormat event, via
//    factions_hooks.js), so chat reads "[Enforcer] <Goruk> hi". Secret members only ever get what an
//    unregistered player shows (by default nothing).
//  - No scoreboard teams (pig_escort.js uses those during its event).
// KubeJS 6 notes: no template strings (strings are joined with +); `let` inside nested blocks; event.cancel()
// stops the handler immediately, so it always comes last.

(function () {

// ===================== CONSTANTS =====================

const DATA_KEY = 'factions'
const COLORS = ['black', 'dark_blue', 'dark_green', 'dark_aqua', 'dark_red', 'dark_purple', 'gold', 'gray',
  'dark_gray', 'blue', 'green', 'aqua', 'red', 'light_purple', 'yellow', 'white']
const EVENT_NAMES = ['joinedFaction', 'leftFaction', 'rankChanged', 'enteredDimension', 'leftDimension']

// Kept across /reload: pending invites, each online player's last known dimension, and the config history.
if (!global.factionsState) global.factionsState = { invites: {}, lastDim: {}, configStamp: null, lastValidConfig: null }
const S = global.factionsState


// ===================== BUILT-IN DEFAULTS =====================
// Used only if factions_config.js has never loaded successfully since the server started.

const BUILTIN_CONFIG = {
  stamp: 'builtin',
  settings: {},
  factions: [
    { id: 'ministry', displayName: "Techno's Crownsworn", memberTitle: 'Loyalist', color: 'gold', secret: false,
      ranks: ['Recruit', 'Loyalist', 'Enforcer', 'Minister'], chatPrefix: '[%rank%]', inviteRank: 'Enforcer',
      voice: { tag: '[MINISTRY]', tagColor: 'gold', textColor: 'yellow', title: 'MINISTRY', subtitle: 'Your paperwork has been processed.' },
      chatLabel: '[MINISTRY CHANNEL]', info: ['The government. Glory to Managed Trollocracy.'],
      welcome: ['Welcome, %title%. Your paperwork has been processed. Your freedom has been managed.'],
      inviteText: 'You have been selected for citizenship processing by %inviter%.',
      leaveText: 'Your resignation has been filed under "Disappointments".',
      desertionText: 'NOTICE OF DESERTION: %player% has abandoned their post.' },
    { id: 'syndicate', displayName: "The Blood God's Syndicate", memberTitle: 'Operative', color: 'dark_red', secret: true,
      ranks: ['Sympathizer', 'Operative', 'Cell Leader'], chatPrefix: '[%rank%]', inviteRank: 'Cell Leader',
      voice: { tag: '[SIGNAL HIJACKED]', tagColor: 'dark_red', textColor: 'red', title: 'SIGNAL HIJACKED', subtitle: 'You were never here.' },
      chatLabel: '[ENCRYPTED]', info: ['There is no Syndicate. If there were, it would answer to no one.'],
      welcome: ['You were never here. Neither were we. Welcome to the Syndicate.'],
      inviteText: 'Someone has been watching you. The pigs say you can be trusted.',
      leaveText: 'Connection terminated. We were never here.', desertionText: '' },
    { id: 'unregistered', displayName: 'Unregistered Citizens', memberTitle: 'Citizen', color: 'gray', secret: false,
      ranks: ['Citizen'], chatPrefix: '', inviteRank: '',
      voice: { tag: '[MINISTRY]', tagColor: 'gold', textColor: 'gray', title: 'UNREGISTERED', subtitle: 'Your file is incomplete.' },
      info: ['Citizens who have not yet completed their paperwork.'], welcome: ['You are now an Unregistered Citizen.'] },
  ],
}

const DEFAULT_SETTINGS = {
  DEFAULT_FACTION: 'unregistered',
  INVITE_MINUTES: 5,
  ANNOUNCE_DESERTION: true,
  REJOIN_COOLDOWN_MINUTES: 0,
  SHOW_PUBLIC_PREFIX: true,
  SECRET_PREFIX_FOR_MEMBERS: false,
  ADMINS_READ_FACTION_CHAT: false,
  LOG_CHANGES: false,
}


// ===================== CONFIG =====================

function isStr(v) { return typeof v == 'string' || (v != null && typeof v == 'object' && v instanceof String) }
function strList(v) { return Array.isArray(v) ? v.filter(isStr).map(String) : [] }

// Checks a config and fills in optional fields. Returns { errors: [...], cfg }.
function normalizeConfig(raw) {
  const errors = []
  const cfg = { settings: {}, byId: {}, order: [], def: null }
  const settings = (raw && raw.settings) || {}
  Object.keys(DEFAULT_SETTINGS).forEach(k => {
    let v = settings[k]
    let d = DEFAULT_SETTINGS[k]
    if (v == null) v = d
    else if (typeof d == 'number' && !(typeof v == 'number' && v >= 0)) { errors.push('settings.' + k + ' must be a number of 0 or more'); v = d }
    else if (typeof d == 'boolean' && typeof v != 'boolean') { errors.push('settings.' + k + ' must be true or false'); v = d }
    else if (typeof d == 'string' && !isStr(v)) { errors.push('settings.' + k + ' must be text'); v = d }
    cfg.settings[k] = typeof d == 'string' ? String(v) : v
  })

  const list = raw && raw.factions
  if (!Array.isArray(list) || !list.length) {
    errors.push('factions must be a list with at least one faction')
    return { errors: errors, cfg: cfg }
  }
  list.forEach((f, i) => {
    let where = 'factions[' + i + ']'
    if (!f || typeof f != 'object') { errors.push(where + ' is not a faction'); return }
    let id = isStr(f.id) ? String(f.id) : ''
    if (!/^[a-z0-9_]+$/.test(id)) { errors.push(where + '.id must be lowercase letters, numbers or _'); return }
    where = 'faction "' + id + '"'
    if (cfg.byId[id]) { errors.push(where + ' is listed twice'); return }
    let ranks = strList(f.ranks).filter(r => r.trim().length)
    if (!ranks.length) errors.push(where + ' needs at least one rank')
    let seen = {}
    ranks.forEach(r => { if (seen[r.toLowerCase()]) errors.push(where + ' has the rank "' + r + '" twice'); seen[r.toLowerCase()] = true })
    let color = isStr(f.color) ? String(f.color) : 'white'
    if (COLORS.indexOf(color) < 0) errors.push(where + '.color "' + color + '" is not a Minecraft colour name')
    if (f.secret != null && typeof f.secret != 'boolean') errors.push(where + '.secret must be true or false')
    let inviteRank = isStr(f.inviteRank) ? String(f.inviteRank) : ''
    if (inviteRank && ranks.map(r => r.toLowerCase()).indexOf(inviteRank.toLowerCase()) < 0) {
      errors.push(where + '.inviteRank "' + inviteRank + '" is not one of its ranks')
    }
    let voice = f.voice || {}
    let fac = {
      id: id,
      displayName: isStr(f.displayName) && String(f.displayName) ? String(f.displayName) : id,
      memberTitle: isStr(f.memberTitle) ? String(f.memberTitle) : (isStr(f.displayName) ? String(f.displayName) : id),
      color: COLORS.indexOf(color) >= 0 ? color : 'white',
      secret: f.secret === true,
      ranks: ranks.length ? ranks : ['Member'],
      chatPrefix: isStr(f.chatPrefix) ? String(f.chatPrefix) : '',
      inviteRank: inviteRank,
      voice: {
        tag: isStr(voice.tag) ? String(voice.tag) : '[' + id.toUpperCase() + ']',
        tagColor: COLORS.indexOf(String(voice.tagColor)) >= 0 ? String(voice.tagColor) : color,
        textColor: COLORS.indexOf(String(voice.textColor)) >= 0 ? String(voice.textColor) : 'white',
        title: isStr(voice.title) ? String(voice.title) : '',
        subtitle: isStr(voice.subtitle) ? String(voice.subtitle) : '',
      },
      chatLabel: isStr(f.chatLabel) ? String(f.chatLabel) : '',
      info: strList(f.info),
      welcome: strList(f.welcome),
      inviteText: isStr(f.inviteText) ? String(f.inviteText) : '',
      inviteReply: isStr(f.inviteReply) && String(f.inviteReply) ? String(f.inviteReply) : 'Your request has been filed.',
      leaveText: isStr(f.leaveText) ? String(f.leaveText) : '',
      desertionText: isStr(f.desertionText) ? String(f.desertionText) : '',
    }
    cfg.byId[id] = fac
    cfg.order.push(id)
  })
  const def = cfg.byId[cfg.settings.DEFAULT_FACTION]
  if (!def) errors.push('settings.DEFAULT_FACTION "' + cfg.settings.DEFAULT_FACTION + '" is not one of the factions')
  else if (def.secret) errors.push('the default faction can\'t be secret')
  cfg.def = cfg.settings.DEFAULT_FACTION
  return { errors: errors, cfg: cfg }
}

// Picks the config to use: this load's factions_config.js if it ran and is valid, otherwise the last valid
// one (from before this /reload), otherwise the built-in defaults.
function loadConfig() {
  const raw = global.FactionsConfigSource
  let problem = null
  if (!raw) problem = 'factions_config.js has not loaded (it is missing or has an error)'
  else if (raw.stamp === S.configStamp) problem = 'factions_config.js did not run on this /reload, so it probably has a syntax error (see the KubeJS error above)'
  if (raw) S.configStamp = raw.stamp
  if (!problem) {
    let r = normalizeConfig(raw)
    if (!r.errors.length) { S.lastValidConfig = r.cfg; S.configProblem = null; return r.cfg }
    problem = 'factions_config.js has problems: ' + r.errors.join('; ')
  }
  S.configProblem = problem + '. Using ' + (S.lastValidConfig ? 'the last working config' : 'the built-in defaults') + '.'
  console.error('[Factions] ' + S.configProblem)
  return S.lastValidConfig || normalizeConfig(BUILTIN_CONFIG).cfg
}

const CFG = loadConfig()
const SET = CFG.settings
const DEF = CFG.def

function fac(id) { return CFG.byId[id] || CFG.byId[DEF] }


// ===================== SMALL HELPERS =====================

function nameOf(p) { return String(p.getGameProfile().getName()) }
function uuidOf(p) {
  if (isStr(p)) return String(p).toLowerCase()
  try { return String(p.getStringUuid()).toLowerCase() } catch (e) { }   // KubeJS's name for getStringUUID
  return String(p.getGameProfile().getId()).toLowerCase()
}
function levelOf(e) { const l = e.level; return typeof l == 'function' ? e.level() : l }
function dimensionId(level) {
  let d = level.dimension
  if (typeof d == 'function') d = level.dimension()
  if (d != null && typeof d.location == 'function') d = d.location()
  return String(d)
}
// A dimension key from a Forge event (ResourceKey<Level>) as "minecraft:the_nether".
function keyId(k) {
  if (k == null) return null
  try { if (typeof k.location == 'function') return String(k.location()) } catch (e) { }
  const s = String(k)
  const m = s.match(/\/\s*([^\]\s]+)\s*\]$/)
  return m ? m[1] : s
}
function isOp(p) {
  try { return p.hasPermissions(2) } catch (e) { }
  try { return p.isOp() } catch (e) { }
  return false
}
function onlinePlayers() {
  const out = []
  const s = Utils.server
  if (!s) return out
  const list = s.players
  for (let i = 0; i < list.size(); i++) out.push(list.get(i))
  return out
}
function onlineByUuid(uuid) {
  const list = onlinePlayers()
  for (let i = 0; i < list.length; i++) if (uuidOf(list[i]) == uuid) return list[i]
  return null
}
function fill(text, values) {
  let out = String(text)
  Object.keys(values).forEach(k => { out = out.split('%' + k + '%').join(String(values[k])) })
  return out
}
function findRank(f, rank) {
  if (rank == null) return null
  const want = String(rank).trim().toLowerCase().replace(/_/g, ' ')
  for (let i = 0; i < f.ranks.length; i++) if (f.ranks[i].toLowerCase() == want) return f.ranks[i]
  return null
}
function rankIndex(f, rank) {
  const r = findRank(f, rank)
  return r == null ? -1 : f.ranks.indexOf(r)
}


// ===================== TEXT =====================
// Messages are built as JSON text components (the same format /tellraw uses) and turned into real text
// with Minecraft's own reader, then sent with player.tell.

// fromJsonLenient, not fromJson: fromJson has a text and a JSON-object version, and KubeJS can turn a
// string into either, so the script engine refuses to pick one ("ambiguous").
let Serializer = null
try { Serializer = Java.loadClass('net.minecraft.network.chat.Component$Serializer') } catch (e) { }

let textWarned = false
function comp(parts) {
  const json = JSON.stringify([''].concat(parts))
  if (Serializer) {
    try { return Serializer.fromJsonLenient(json) } catch (e) {
      if (!textWarned) {
        textWarned = true
        console.warn('[Factions] Text error, using plain KubeJS text instead: ' + e + ' (in ' + json.substring(0, 120) + ')')
      }
    }
  }
  return compFallback(parts)
}
// The same text built with KubeJS's own text methods, keeping colours and bold (click/hover are dropped).
function camel(s) { return String(s).replace(/_([a-z])/g, (m, c) => c.toUpperCase()) }
function compFallback(parts) {
  let out = Text.of('')
  parts.forEach(p => {
    let t = Text.of(isStr(p) ? String(p) : (p.text || ''))
    if (!isStr(p)) {
      if (p.color && typeof t[camel(p.color)] == 'function') t = t[camel(p.color)]()
      if (p.bold) { try { t = t.bold() } catch (e) { } }
    }
    out = out.append(t)
  })
  return out
}
function tell(p, parts) { try { p.tell(comp(parts)) } catch (e) { console.error('[Factions] Could not message a player: ' + e) } }
function voice(f, text) {
  return [{ text: f.voice.tag, color: f.voice.tagColor, bold: true }, { text: ' ' + text, color: f.voice.textColor }]
}
function plain(text, color) { return [{ text: String(text), color: color || 'yellow' }] }
function bad(text) { return plain(text, 'red') }

// A private title on one player's screen (packets, so no command is run).
let TitlePkt = null, SubtitlePkt = null, TimesPkt = null
function showTitle(p, f) {
  if (!f.voice.title) return
  try {
    if (!TitlePkt) {
      TitlePkt = Java.loadClass('net.minecraft.network.protocol.game.ClientboundSetTitleTextPacket')
      SubtitlePkt = Java.loadClass('net.minecraft.network.protocol.game.ClientboundSetSubtitleTextPacket')
      TimesPkt = Java.loadClass('net.minecraft.network.protocol.game.ClientboundSetTitlesAnimationPacket')
    }
    p.connection.send(new TimesPkt(10, 70, 20))
    p.connection.send(new SubtitlePkt(comp([{ text: f.voice.subtitle, color: f.voice.textColor }])))
    p.connection.send(new TitlePkt(comp([{ text: f.voice.title, color: f.voice.tagColor, bold: true }])))
  } catch (e) {
    console.warn('[Factions] Title failed, showing it in chat instead: ' + e)
    tell(p, voice(f, f.voice.title + (f.voice.subtitle ? ' - ' + f.voice.subtitle : '')))
  }
}


// ===================== STORAGE =====================
// server.persistentData['factions'] = JSON { v: 1, players: { uuid: { f: id, r: rank, n: lastName } }, left: { uuid: ms } }
// Players in the default faction aren't stored. Data is read fresh after every /reload and written on every
// change. Unknown faction ids (e.g. a faction removed from the config) are kept as they are and read as the
// default faction, so putting the faction back restores its members.

let DB = null
function db() {
  if (DB) return DB
  const pd = Utils.server.persistentData
  let parsed = null
  let raw = ''
  try { raw = String(pd.getString(DATA_KEY) || '') } catch (e) { raw = '' }
  if (raw) {
    try { parsed = JSON.parse(raw) } catch (e) {
      // Never throw saved data away: keep a copy before starting over.
      let backup = DATA_KEY + '_unreadable_' + Date.now()
      pd.putString(backup, raw)
      console.error('[Factions] Saved faction data could not be read (' + e + '). A copy was kept in persistentData "' + backup + '".')
    }
  }
  DB = parsed && parsed.players ? parsed : { v: 1, players: {}, left: {} }
  if (!DB.left) DB.left = {}
  return DB
}
function save() { Utils.server.persistentData.putString(DATA_KEY, JSON.stringify(DB)) }

// A player's current faction and rank (always valid for the current config).
function recordOf(uuid) {
  const r = db().players[uuid]
  if (!r || !CFG.byId[r.f]) return { f: DEF, r: fac(DEF).ranks[0] }
  const f = CFG.byId[r.f]
  return { f: f.id, r: findRank(f, r.r) || f.ranks[0] }
}

function cooldownLeft(uuid) {
  const t = db().left[uuid]
  if (!t || !SET.REJOIN_COOLDOWN_MINUTES) return 0
  const left = t + SET.REJOIN_COOLDOWN_MINUTES * 60000 - Date.now()
  return left > 0 ? left : 0
}


// ===================== EVENTS FOR OTHER MODULES =====================

const listeners = {}
EVENT_NAMES.forEach(n => { listeners[n] = [] })

function emit(name) {
  const args = Array.prototype.slice.call(arguments, 1)
  listeners[name].slice().forEach(cb => {
    try { cb.apply(null, args) } catch (e) { console.error('[Factions] A "' + name + '" listener failed: ' + e) }
  })
}


// ===================== CHANGING FACTION =====================

// The one place membership changes. how: 'accept' | 'leave' | 'admin' | 'remove' | 'api'.
// Returns false if nothing changed.
function applyChange(player, newId, newRank, how) {
  const uuid = uuidOf(player)
  const old = recordOf(uuid)
  const f = fac(newId)
  const rank = findRank(f, newRank) || f.ranks[0]
  if (old.f == f.id && old.r == rank) return false

  const data = db()
  if (f.id == DEF) delete data.players[uuid]
  else data.players[uuid] = { f: f.id, r: rank, n: nameOf(player) }
  if (old.f != f.id && old.f != DEF) data.left[uuid] = Date.now()
  if (f.id != DEF) delete S.invites[uuid]
  save()
  if (SET.LOG_CHANGES) console.info('[Factions] faction change for ' + uuid)
  refreshName(player)

  if (old.f == f.id) {
    emit('rankChanged', player, old.r, rank)
  } else {
    if (old.f != DEF) emit('leftFaction', player, old.f)
    if (f.id != DEF) emit('joinedFaction', player, old.f, f.id)
  }
  return true
}

function welcome(player, f, rank) {
  showTitle(player, f)
  const values = { title: f.memberTitle, rank: rank, player: nameOf(player) }
  f.welcome.forEach(line => tell(player, voice(f, fill(line, values))))
  try {
    Utils.server.runCommandSilent('execute as ' + nameOf(player) + ' at @s run playsound ' +
      (f.secret ? 'minecraft:entity.pig.ambient master @s ~ ~ ~ 0.6 0.6' : 'minecraft:block.note_block.chime master @s ~ ~ ~ 0.6 1.2'))
  } catch (e) { }
}

// Public notice when someone leaves a non-secret faction that has desertionText. Sent to each player directly.
function announceDesertion(player, f) {
  if (!SET.ANNOUNCE_DESERTION || f.secret || !f.desertionText) return
  const line = voice(f, fill(f.desertionText, { player: nameOf(player) }))
  onlinePlayers().forEach(p => tell(p, line))
}


// ===================== INVITES =====================
// S.invites[targetUuid][factionId] = { from: inviterUuid, expires: ms }. Kept in memory only (they last minutes).

function invitesFor(uuid) {
  const all = S.invites[uuid]
  if (!all) return []
  const now = Date.now()
  const out = []
  Object.keys(all).forEach(id => {
    if (all[id].expires <= now || !CFG.byId[id]) delete all[id]
    else out.push(id)
  })
  if (!out.length) delete S.invites[uuid]
  return out
}

function canInvite(player) {
  const rec = recordOf(uuidOf(player))
  const f = fac(rec.f)
  if (f.id == DEF || !f.inviteRank) return null
  return rankIndex(f, rec.r) >= rankIndex(f, f.inviteRank) ? f : null
}

// Sends the invitation if the target can take it. The inviter always gets the same reply, so it never tells
// them which faction the target is in, or whether they're on cooldown.
function invite(inviter, target, reply) {
  const f = canInvite(inviter)
  if (!f) return reply(bad('You are not authorised to recruit.'))
  const tu = uuidOf(target)
  if (tu == uuidOf(inviter)) return reply(bad('You cannot recruit yourself.'))
  const eligible = recordOf(tu).f == DEF && !cooldownLeft(tu)
  if (eligible) {
    if (!S.invites[tu]) S.invites[tu] = {}
    S.invites[tu][f.id] = { from: uuidOf(inviter), expires: Date.now() + SET.INVITE_MINUTES * 60000 }
    let text = fill(f.inviteText || ('You have been invited to join the ' + f.displayName + '.'), { inviter: nameOf(inviter) })
    tell(target, voice(f, text))
    tell(target, [
      { text: '[Accept]', color: 'green', bold: true,
        clickEvent: { action: 'run_command', value: '/faction accept ' + f.id },
        hoverEvent: { action: 'show_text', contents: 'Click to accept' } },
      { text: '  ' },
      { text: '[Decline]', color: 'red', bold: true,
        clickEvent: { action: 'run_command', value: '/faction decline ' + f.id },
        hoverEvent: { action: 'show_text', contents: 'Click to decline' } },
      { text: '  Expires in ' + SET.INVITE_MINUTES + ' minutes.', color: 'gray' },
    ])
  }
  return reply(voice(f, f.inviteReply))
}

function pickInvite(player, wanted, reply) {
  const pending = invitesFor(uuidOf(player))
  if (!pending.length) { reply(bad('You have no pending invitations (they expire after ' + SET.INVITE_MINUTES + ' minutes).')); return null }
  if (wanted) {
    let id = String(wanted).toLowerCase()
    if (pending.indexOf(id) < 0) { reply(bad('You have no pending invitation from that faction.')); return null }
    return id
  }
  if (pending.length == 1) return pending[0]
  reply(plain('You have more than one invitation. Use /faction accept <faction>: ' + pending.join(', ')))
  return null
}

function accept(player, wanted, reply) {
  const id = pickInvite(player, wanted, reply)
  if (!id) return 0
  const uuid = uuidOf(player)
  if (recordOf(uuid).f != DEF) return reply(bad('Leave your current faction first (/faction leave).'))
  const wait = cooldownLeft(uuid)
  if (wait) return reply(bad('You can\'t join a faction for another ' + Math.ceil(wait / 60000) + ' minute(s).'))
  const inv = S.invites[uuid][id]
  const f = fac(id)
  applyChange(player, f.id, f.ranks[0], 'accept')
  welcome(player, f, f.ranks[0])
  // Only the inviter hears about it, and they're in the same faction.
  const inviter = onlineByUuid(inv.from)
  if (inviter) tell(inviter, voice(f, nameOf(player) + ' has accepted.'))
  return 1
}

function decline(player, wanted, reply) {
  const id = pickInvite(player, wanted, reply)
  if (!id) return 0
  delete S.invites[uuidOf(player)][id]
  invitesFor(uuidOf(player))
  return reply(plain('Invitation declined.', 'gray'))   // the inviter isn't told
}

function leave(player, reply) {
  const rec = recordOf(uuidOf(player))
  if (rec.f == DEF) return reply(bad('You are not in a faction.'))
  const f = fac(rec.f)
  applyChange(player, DEF, null, 'leave')
  if (f.leaveText) tell(player, voice(f, f.leaveText))
  else reply(plain('You have left the ' + f.displayName + '.'))
  announceDesertion(player, f)
  return 1
}


// ===================== CHAT =====================

function prefixFor(f, rank) {
  if (!f.chatPrefix) return ''
  return fill(f.chatPrefix, { rank: rank, title: f.memberTitle })
}

// What everyone else is shown for this player: their own faction, or for a secret faction, exactly what a
// player in the default faction shows.
function publicFaction(uuid) {
  const rec = recordOf(uuid)
  const f = fac(rec.f)
  if (f.secret) return { f: fac(DEF), r: fac(DEF).ranks[0] }
  return { f: f, r: rec.r }
}

// The coloured prefix as text, e.g. a gold "[Enforcer] ", or null if this faction has none.
function prefixComponent(f, rank) {
  const prefix = prefixFor(f, rank)
  return prefix ? comp([{ text: prefix + ' ', color: f.color }]) : null
}

// The public prefix goes in front of the player's display name (see onNameFormat below), so it shows before the
// name in chat, death messages, /msg and on Discord. It works together with FTB Essentials: the nickname is set
// first (HIGHEST priority), then this prefix, then its recording icon (LOWEST): "⏺ [Enforcer] Nick".
function nameFormat(event) {
  if (!Utils.server || !SET.SHOW_PUBLIC_PREFIX) return
  const player = event.getEntity()
  if (!player || !player.isPlayer()) return
  const pub = publicFaction(uuidOf(player))
  const pre = prefixComponent(pub.f, pub.r)
  if (pre) event.setDisplayname(pre.append(event.getDisplayname()))
}

// Makes Minecraft work out the player's display name again (after a faction or rank change, or a /reload).
let NameUtil
function refreshName(player) {
  if (NameUtil === undefined) {
    try { NameUtil = Java.loadClass('dev.ftb.mods.ftblibrary.util.PlayerDisplayNameUtil') } catch (e) { NameUtil = null }
  }
  try { if (NameUtil) { NameUtil.refreshDisplayName(player); return } } catch (e) { }
  try { player.refreshDisplayName() } catch (e) { }
}

// Fallback for when the name hook isn't loaded yet (factions_hooks.js needs a restart): the prefix is added to
// the start of the message instead, "<Goruk> [Enforcer] hi".
PlayerEvents.decorateChat(event => {
  if (!SET.SHOW_PUBLIC_PREFIX || global.factionsNameHookInstalled) return
  const player = event.player
  const uuid = uuidOf(player)
  if (SET.SECRET_PREFIX_FOR_MEMBERS && fac(recordOf(uuid).f).secret) return   // handled below, per viewer
  const pub = publicFaction(uuid)
  const pre = prefixComponent(pub.f, pub.r)
  if (!pre) return
  try {
    event.setComponent(pre.append(event.getComponent()))
  } catch (e) { console.error('[Factions] Chat prefix failed: ' + e) }
})

// Optional (SECRET_PREFIX_FOR_MEMBERS, off by default): a secret faction member's chat is cancelled and every
// viewer gets their own copy. Fellow members see the prefix; everyone else sees what a default-faction player
// would show. See FACTIONS.md for what this changes. This runs after FTB Essentials' mute check, so muted
// players stay muted.
if (SET.SECRET_PREFIX_FOR_MEMBERS) {
  PlayerEvents.chat(event => {
    const player = event.player
    const uuid = uuidOf(player)
    const rec = recordOf(uuid)
    const f = fac(rec.f)
    if (!f.secret) return
    const message = event.getComponent()
    // Everyone else: "<Name> msg" (the display name already carries whatever an unregistered player shows).
    // Fellow members: "[Cell Leader] <Name> msg".
    const line = pre => (pre || comp([])).append(comp(['<'])).append(player.getDisplayName()).append(comp(['> '])).append(message)
    const forOthers = line(null)
    const forMembers = line(prefixComponent(f, rec.r))
    onlinePlayers().forEach(p => {
      try { p.tell(recordOf(uuidOf(p)).f == f.id ? forMembers : forOthers) } catch (e) { }
    })
    console.info('<' + nameOf(player) + '> ' + event.getMessage())   // keeps the chat log like normal chat
    event.cancel()   // last: cancel() stops this function
  })
}

function factionChat(player, message, reply) {
  const rec = recordOf(uuidOf(player))
  const f = fac(rec.f)
  if (f.id == DEF) return reply(bad('Unregistered Citizens have no private channel.'))
  const prefix = prefixFor(f, rec.r)
  const line = comp([
    { text: (f.chatLabel || '[' + f.displayName + ']') + ' ', color: f.color, bold: true },
    { text: (prefix ? prefix + ' ' : '') + nameOf(player) + ': ', color: f.color },
    { text: message, color: f.voice.textColor },
  ])
  onlinePlayers().forEach(p => {
    let member = recordOf(uuidOf(p)).f == f.id
    if (member || (SET.ADMINS_READ_FACTION_CHAT && isOp(p))) {
      try { p.tell(line) } catch (e) { }
    }
  })
  return 1
}


// ===================== DIMENSIONS =====================
// Forge's PlayerChangedDimensionEvent (forwarded by startup_scripts/factions_hooks.js) fires after a trip
// succeeds, including cross-dimension /tp. Blocked portals never fire it. Login, logout and respawning
// somewhere else don't fire it, so those are handled here using each player's last known dimension.

// how: 'travel' (portal, /tp or a mod, from the Forge hook), 'login' or 'respawn'.
function dimEnter(player, from, to, how) {
  S.lastDim[uuidOf(player)] = to
  emit('enteredDimension', player, recordOf(uuidOf(player)).f, from, to, how)
}
function dimLeave(player, dim, how) {
  emit('leftDimension', player, recordOf(uuidOf(player)).f, dim, how)
}

global.factionsHooks = {
  onNameFormat: nameFormat,
  onChangedDimension: event => {
    const player = event.getEntity()
    if (!player || !player.isPlayer()) return
    const from = keyId(event.getFrom()), to = keyId(event.getTo())
    if (from == to) return
    dimLeave(player, from, 'travel')
    dimEnter(player, from, to, 'travel')
  },
}

PlayerEvents.loggedIn(event => {
  const player = event.player
  const uuid = uuidOf(player)
  // Keep the stored name up to date (players are stored by UUID, so a name change loses nothing).
  const r = db().players[uuid]
  if (r && r.n != nameOf(player)) { r.n = nameOf(player); save() }
  dimEnter(player, null, dimensionId(levelOf(player)), 'login')
  if (S.configProblem && isOp(player)) tell(player, bad('[Factions] ' + S.configProblem))
  if (!global.factionsHooksInstalled && isOp(player)) {
    tell(player, bad('[Factions] startup_scripts/factions_hooks.js is not active, so dimension events only fire on login, logout and respawn. Restart the server once to load it.'))
  } else if (!global.factionsNameHookInstalled && isOp(player)) {
    tell(player, bad('[Factions] The rank prefix is shown after the name until the server restarts with the updated factions_hooks.js.'))
  }
})

PlayerEvents.loggedOut(event => {
  const uuid = uuidOf(event.player)
  const dim = S.lastDim[uuid] || dimensionId(levelOf(event.player))
  delete S.lastDim[uuid]
  dimLeave(event.player, dim, 'logout')
})

PlayerEvents.respawned(event => {
  const player = event.player
  const uuid = uuidOf(player)
  const now = dimensionId(levelOf(player))
  const before = S.lastDim[uuid]
  if (before && before != now) {
    dimLeave(player, before, 'respawn')
    dimEnter(player, before, now, 'respawn')
  } else {
    S.lastDim[uuid] = now
  }
})

// After a /reload, refresh the dimension memory and display name (prefixes may have changed) of everyone online.
onlinePlayers().forEach(p => { S.lastDim[uuidOf(p)] = dimensionId(levelOf(p)); refreshName(p) })
// After a /reload, tell online ops about a config problem.
if (S.configProblem) onlinePlayers().filter(isOp).forEach(p => tell(p, bad('[Factions] ' + S.configProblem)))


// ===================== THE API =====================

function resolveOnline(p) {
  if (p == null) return null
  if (isStr(p)) return onlineByUuid(String(p).toLowerCase())
  return p
}

global.Factions = {
  DEFAULT: DEF,
  // A player object or a UUID string.
  getFaction: p => recordOf(uuidOf(p)).f,
  getRank: p => recordOf(uuidOf(p)).r,
  isInFaction: (p, id) => recordOf(uuidOf(p)).f == String(id),
  // True if the player's rank is at least `rank` in their own faction (or in factionId, if given and it
  // isn't their faction, false).
  hasRankAtLeast: (p, rank, factionId) => {
    const rec = recordOf(uuidOf(p))
    if (factionId != null && String(factionId) != rec.f) return false
    const f = fac(rec.f)
    const need = rankIndex(f, rank)
    return need >= 0 && rankIndex(f, rec.r) >= need
  },
  // Moves an ONLINE player. rank is optional (default: the faction's first rank). Shows the welcome unless
  // options.silent. Returns { ok, error }.
  setFaction: (p, id, rank, options) => {
    const player = resolveOnline(p)
    if (!player) return { ok: false, error: 'player is not online' }
    const f = CFG.byId[String(id)]
    if (!f) return { ok: false, error: 'unknown faction ' + id }
    if (rank != null && !findRank(f, rank)) return { ok: false, error: 'unknown rank ' + rank + ' for ' + f.id }
    const before = recordOf(uuidOf(player)).f
    const changed = applyChange(player, f.id, rank, 'api')
    if (changed && before != f.id && f.id != DEF && !(options && options.silent)) welcome(player, f, recordOf(uuidOf(player)).r)
    return { ok: true, changed: changed }
  },
  // Everyone stored in a faction (online or not): [{ uuid, name, rank, online }]. For the default faction,
  // only online players can be listed (nobody else is stored).
  getMembers: id => {
    id = String(id)
    const out = []
    if (id == DEF) {
      onlinePlayers().forEach(p => { if (recordOf(uuidOf(p)).f == DEF) out.push({ uuid: uuidOf(p), name: nameOf(p), rank: fac(DEF).ranks[0], online: true }) })
      return out
    }
    const players = db().players
    Object.keys(players).forEach(u => {
      let rec = recordOf(u)
      if (rec.f == id) out.push({ uuid: u, name: players[u].n, rank: rec.r, online: onlineByUuid(u) != null })
    })
    return out
  },
  // Subscribe to an event. Returns a function that unsubscribes. Listeners are cleared on /reload (every
  // script re-registers when it reloads).
  on: (name, cb) => {
    if (!listeners[name]) throw new Error('[Factions] Unknown event "' + name + '". Events: ' + EVENT_NAMES.join(', '))
    listeners[name].push(cb)
    return () => { listeners[name] = listeners[name].filter(x => x !== cb) }
  },
  // What `viewer` is allowed to see of `target`'s faction: the real one for admins, themselves and fellow
  // secret-faction members, otherwise the public one. Use this whenever a module shows factions to players.
  visibleFaction: (viewer, target) => {
    const tu = uuidOf(target)
    const rec = recordOf(tu)
    if (!fac(rec.f).secret) return rec.f
    if (viewer && (uuidOf(viewer) == tu || isOp(viewer) || recordOf(uuidOf(viewer)).f == rec.f)) return rec.f
    return DEF
  },
  getFactionIds: () => CFG.order.slice(),
  getFactionInfo: id => {
    const f = CFG.byId[String(id)]
    return f ? { id: f.id, displayName: f.displayName, memberTitle: f.memberTitle, color: f.color, secret: f.secret, ranks: f.ranks.slice(), chatPrefix: f.chatPrefix } : null
  },
  isSecret: id => !!(CFG.byId[String(id)] && CFG.byId[String(id)].secret),
}


// ===================== COMMANDS =====================

ServerEvents.commandRegistry(event => {
  const Commands = event.commands
  const Arguments = event.arguments
  const StringArg = Java.loadClass('com.mojang.brigadier.arguments.StringArgumentType')

  const replier = ctx => parts => { ctx.source.sendSystemMessage(comp(parts)); return parts === null ? 0 : 1 }
  // Player-only commands. Errors are shown to the player rather than failing silently.
  const asPlayer = fn => ctx => {
    const reply = replier(ctx)
    const player = ctx.source.getPlayer()
    if (!player) { reply(bad('Only players can use this.')); return 0 }
    try { return fn(player, ctx, reply) } catch (e) {
      console.error('[Factions] ' + e)
      reply(bad('Something went wrong: ' + e))
      return 0
    }
  }
  const asAdmin = fn => ctx => {
    const reply = replier(ctx)
    try { return fn(ctx, reply) } catch (e) {
      console.error('[Factions] ' + e)
      reply(bad('Error: ' + e))
      return 0
    }
  }
  const str = (ctx, n) => String(StringArg.getString(ctx, n))
  const target = ctx => Arguments.PLAYER.getResult(ctx, 'player')
  const admin = source => source.hasPermission(2)

  const suggestFactions = (ctx, b) => { CFG.order.forEach(id => b.suggest(id)); return b.buildFuture() }
  const suggestRanks = factionOf => (ctx, b) => {
    let f = null
    try { f = factionOf(ctx) } catch (e) { }
    const ids = f ? [f.id] : CFG.order
    ids.forEach(id => fac(id).ranks.forEach(r => b.suggest(r)))
    return b.buildFuture()
  }
  // Only the player's own pending invites are suggested (it's their own information).
  const suggestInvites = (ctx, b) => {
    const p = ctx.source.getPlayer()
    if (p) invitesFor(uuidOf(p)).forEach(id => b.suggest(id))
    return b.buildFuture()
  }
  const suggestKnownNames = (ctx, b) => {
    const seen = {}
    onlinePlayers().forEach(p => { seen[nameOf(p)] = true })
    const players = db().players
    Object.keys(players).forEach(u => { if (players[u].n) seen[players[u].n] = true })
    Object.keys(seen).forEach(n => b.suggest(n))
    return b.buildFuture()
  }

  // ---- player commands ----

  const me = asPlayer((player, ctx, reply) => {
    const rec = recordOf(uuidOf(player))
    const f = fac(rec.f)
    if (f.id == DEF) return reply([{ text: 'You are an ', color: 'gray' }, { text: f.memberTitle, color: f.color }, { text: ' of the ' + f.displayName + '.', color: 'gray' }])
    return reply([{ text: 'You are a ', color: 'gray' }, { text: rec.r, color: f.color, bold: true },
      { text: ' of the ', color: 'gray' }, { text: f.displayName, color: f.color }, { text: f.secret ? ' (secret: only you and admins can see this)' : '', color: 'dark_gray' }])
  })

  const info = asPlayer((player, ctx, reply) => {
    const mine = recordOf(uuidOf(player)).f
    reply([{ text: '--- Factions of Trollcraft ---', color: 'gold', bold: true }])
    CFG.order.forEach(id => {
      let f = fac(id)
      if (f.secret && mine != f.id) return
      reply([{ text: f.displayName, color: f.color, bold: true }, { text: ' (' + f.memberTitle + 's)', color: 'gray' }])
      f.info.forEach(line => reply([{ text: '  ' + line, color: 'gray' }]))
    })
    return 1
  })

  event.register(Commands.literal('faction')
    .executes(me)
    .then(Commands.literal('me').executes(me))
    .then(Commands.literal('info').executes(info))
    .then(Commands.literal('invite')
      .then(Commands.argument('player', Arguments.PLAYER.create(event))
        .executes(asPlayer((player, ctx, reply) => invite(player, target(ctx), reply)))))
    .then(Commands.literal('accept')
      .executes(asPlayer((player, ctx, reply) => accept(player, null, reply)))
      .then(Commands.argument('faction', StringArg.word()).suggests(suggestInvites)
        .executes(asPlayer((player, ctx, reply) => accept(player, str(ctx, 'faction'), reply)))))
    .then(Commands.literal('decline')
      .executes(asPlayer((player, ctx, reply) => decline(player, null, reply)))
      .then(Commands.argument('faction', StringArg.word()).suggests(suggestInvites)
        .executes(asPlayer((player, ctx, reply) => decline(player, str(ctx, 'faction'), reply)))))
    .then(Commands.literal('leave').executes(asPlayer((player, ctx, reply) => leave(player, reply))))
    .then(Commands.literal('chat')
      .then(Commands.argument('message', StringArg.greedyString())
        .executes(asPlayer((player, ctx, reply) => factionChat(player, str(ctx, 'message'), reply)))))

    // ---- admin commands (op level 2; hidden from everyone else, including suggestions) ----

    .then(Commands.literal('set').requires(admin)
      .then(Commands.argument('player', Arguments.PLAYER.create(event))
        .then(Commands.argument('faction', StringArg.word()).suggests(suggestFactions)
          .executes(asAdmin((ctx, reply) => adminSet(target(ctx), str(ctx, 'faction'), null, reply)))
          .then(Commands.argument('rank', StringArg.greedyString()).suggests(suggestRanks(ctx => CFG.byId[str(ctx, 'faction')]))
            .executes(asAdmin((ctx, reply) => adminSet(target(ctx), str(ctx, 'faction'), str(ctx, 'rank'), reply)))))))
    .then(Commands.literal('rank').requires(admin)
      .then(Commands.argument('player', Arguments.PLAYER.create(event))
        .then(Commands.argument('rank', StringArg.greedyString()).suggests(suggestRanks(ctx => fac(recordOf(uuidOf(target(ctx))).f)))
          .executes(asAdmin((ctx, reply) => adminRank(target(ctx), str(ctx, 'rank'), reply))))))
    .then(Commands.literal('remove').requires(admin)
      .then(Commands.argument('player', Arguments.PLAYER.create(event))
        .executes(asAdmin((ctx, reply) => adminRemove(target(ctx), reply)))))
    .then(Commands.literal('whois').requires(admin)
      .then(Commands.argument('name', StringArg.word()).suggests(suggestKnownNames)
        .executes(asAdmin((ctx, reply) => adminWhois(str(ctx, 'name'), reply)))))
    .then(Commands.literal('list').requires(admin)
      .executes(asAdmin((ctx, reply) => adminList(null, reply)))
      .then(Commands.argument('faction', StringArg.word()).suggests(suggestFactions)
        .executes(asAdmin((ctx, reply) => adminList(str(ctx, 'faction'), reply)))))
  )
})

// ---- admin actions ----
// Replies go only to the admin who ran the command. The player is told privately, in their faction's voice.

function adminSet(player, id, rank, reply) {
  const f = CFG.byId[String(id).toLowerCase()]
  if (!f) return reply(bad('Unknown faction "' + id + '". Factions: ' + CFG.order.join(', ')))
  if (rank != null && !findRank(f, rank)) return reply(bad('Unknown rank "' + rank + '". ' + f.displayName + ' ranks: ' + f.ranks.join(', ')))
  const old = recordOf(uuidOf(player))
  const oldF = fac(old.f)
  if (!applyChange(player, f.id, rank, 'admin')) return reply(plain(nameOf(player) + ' is already ' + old.r + ' of ' + f.displayName + '.', 'gray'))
  const now = recordOf(uuidOf(player))
  if (old.f != f.id) {
    if (old.f != DEF && oldF.leaveText) tell(player, voice(oldF, oldF.leaveText))
    if (f.id != DEF) welcome(player, f, now.r)
    else tell(player, voice(f, 'Your faction registration has been revoked.'))
  } else {
    tell(player, voice(f, 'Your rank is now ' + now.r + '.'))
  }
  return reply(plain(nameOf(player) + ' is now ' + now.r + ' of the ' + f.displayName + '.'))
}

function adminRank(player, rank, reply) {
  const rec = recordOf(uuidOf(player))
  const f = fac(rec.f)
  if (f.id == DEF) return reply(bad(nameOf(player) + ' is not in a faction. Use /faction set first.'))
  const r = findRank(f, rank)
  if (!r) return reply(bad('Unknown rank "' + rank + '". ' + f.displayName + ' ranks: ' + f.ranks.join(', ')))
  if (!applyChange(player, f.id, r, 'admin')) return reply(plain(nameOf(player) + ' is already ' + r + '.', 'gray'))
  tell(player, voice(f, 'Your rank is now ' + r + '.'))
  return reply(plain(nameOf(player) + ' is now ' + r + ' of the ' + f.displayName + '.'))
}

function adminRemove(player, reply) {
  const rec = recordOf(uuidOf(player))
  if (rec.f == DEF) return reply(plain(nameOf(player) + ' is already unregistered.', 'gray'))
  const f = fac(rec.f)
  applyChange(player, DEF, null, 'remove')
  tell(player, voice(f, f.secret ? 'Signal lost. You are on your own now.' : 'Your faction registration has been revoked.'))
  return reply(plain(nameOf(player) + ' has been removed from the ' + f.displayName + ' (now ' + fac(DEF).displayName + ').'))
}

function adminWhois(name, reply) {
  const want = String(name).toLowerCase()
  let uuid = null, shown = name, online = false
  onlinePlayers().forEach(p => { if (nameOf(p).toLowerCase() == want) { uuid = uuidOf(p); shown = nameOf(p); online = true } })
  if (!uuid) {
    let players = db().players
    Object.keys(players).forEach(u => { if (String(players[u].n || '').toLowerCase() == want) { uuid = u; shown = players[u].n } })
  }
  if (!uuid) return reply(plain(name + ' is not online and has no faction on record (so: ' + fac(DEF).displayName + ').', 'gray'))
  const rec = recordOf(uuid)
  const f = fac(rec.f)
  const stored = db().players[uuid]
  const note = stored && !CFG.byId[stored.f] ? ' (saved as "' + stored.f + '", which is no longer in the config)' : ''
  return reply([{ text: shown + (online ? '' : ' (offline)') + ': ', color: 'yellow' },
    { text: f.displayName + ' - ' + rec.r, color: f.color, bold: true },
    { text: (f.secret ? ' [SECRET]' : '') + note, color: 'dark_gray' }])
}

function adminList(id, reply) {
  const ids = id ? [String(id).toLowerCase()] : CFG.order
  if (id && !CFG.byId[ids[0]]) return reply(bad('Unknown faction "' + id + '". Factions: ' + CFG.order.join(', ')))
  ids.forEach(fid => {
    let f = fac(fid)
    let members = global.Factions.getMembers(fid)
    reply([{ text: f.displayName + (f.secret ? ' [SECRET]' : '') + ' (' + members.length + (fid == DEF ? ' online' : '') + ')', color: f.color, bold: true }])
    f.ranks.slice().reverse().forEach(r => {
      let inRank = members.filter(m => m.rank == r)
      if (inRank.length) reply([{ text: '  ' + r + ': ', color: f.color }, { text: inRank.map(m => m.name + (m.online ? '' : '*')).join(', '), color: 'white' }])
    })
  })
  return reply(plain('* = offline', 'dark_gray'))
}

})()
