// Protocol Clean Slate: the end of Part I (see STORY.md and tools/kubejs/CLEAN_SLATE.md).
//
//  - It begins when the Ender Dragon is killed for the first time: the dragon guarded the Ministry's Archives, so with
//    the records exposed the Ministry fires its doomsday procedure to wipe them, and the world with them. An op can
//    also start it with /cleanslate start.
//  - A 4-day countdown (bossbar for everyone). The world burns without a block being changed: endless thunder,
//    visual-only lightning near players, and Ministry broadcasts that fall apart as zero comes closer.
//  - The way out is the Blood Portal (events/blood_portal.js): ten Blood Relics from End Cities, then the event.
//  - At zero: the Last Broadcast, and everyone still here who didn't escape falls (spectator mode).
//
// Story: starting it sets the act to `finale` (story.js), whose lines announce it. Setting the act to `finale` with
// /story starts it too.
//
// Commands (op): /cleanslate status|start [hours]|extend <hours>|pause|resume|cancel|test. Copy to
// <server>/kubejs/server_scripts/ and run /reload.
//
// KubeJS 6 notes: no template strings; `let` inside nested blocks. Broadcasts are public propaganda, so with
// TO_DISCORD they go out with tellraw @a (Simple Discord Link posts them); never put anything secret in them.

(function () {

// ===================== SETTINGS =====================

const START_ON_DRAGON_KILL = true      // the first Ender Dragon kill starts it
const START_DELAY_SECONDS = 12         // ...this long after the kill (the dragon's death takes about 10 s)
const DURATION_HOURS = 96              // 4 days
const TO_DISCORD = true                // broadcasts with tellraw @a (posted to Discord); false = each player in game only
const BOSSBAR = 'trollcraft:clean_slate'
const BOSSBAR_COLOR = 'red'
const THUNDER_EVERY_MINUTES = 5        // the thunderstorm is renewed this often
const STOP_FIRE_SPREAD = true          // doFireTick off while it runs (lightning can't burn bases); put back afterwards
// Visual-only lightning (no damage, no fire) near each player under the open sky in the Overworld: one bolt every
// `fromSeconds` at the start, every `toSeconds` at the end, between `distance` blocks away.
const LIGHTNING = { fromSeconds: 120, toSeconds: 15, distance: [6, 20] }
const FALL_ON_LOGIN = true             // players who log in after zero (and didn't escape) are put in spectator
const TEST_MINUTES = 2                 // /cleanslate test: a short run that only the op sees

// Broadcasts, at this much time left. The Ministry's line is garbled more the closer zero is; the hijacked reply
// is clear. `hijack` is used while the Relics are still being hunted; `gathered` (if given) once one player has
// carried all ten. The start itself is announced by the `finale` act (story.js).
const MILESTONES = [
  { hours: 72, ministry: 'Protocol Clean Slate proceeds on schedule. Citizens in possession of Ministry records should hand them in for safe burning.',
    hijack: 'Three days. Ten Blood Relics sleep in the End City treasure chests. Find them.',
    gathered: 'Three days. The Relics are gathered. Open the Blood Portal: /bloodportal start' },
  { hours: 48, ministry: 'Thunder is part of the cleaning process. Please do not read anything you find in the End.',
    hijack: 'Two days. Search the End City treasure chests. One of you must carry all ten Relics at once.',
    gathered: 'Two days. The Blood Portal is waiting: /bloodportal start' },
  { hours: 24, ministry: 'Reminder: there were never any records. That is why they must be destroyed.',
    hijack: 'One day. The Relics are still out there in the End Cities, and the Blood Portal is thirsty.',
    gathered: 'One day. The Blood Portal is thirsty.' },
  { hours: 12, ministry: 'The Ministry has everything under control. Everything. Under. Control.',
    hijack: 'Twelve hours. Every End City chest left unopened may hold a Relic.',
    gathered: 'Twelve hours.' },
  { hours: 6, ministry: 'Please do not panic. Panicking requires a permit. Permits are being burned.',
    hijack: 'Six hours. Get to the End Cities. If you have the Relics, bring them together.',
    gathered: 'Six hours. If you have not opened the Blood Portal, do it now.' },
  { hours: 1, ministry: 'Final shredding has begun. The Ministry thanks you for not reading.',
    hijack: 'One hour. Get to the Blood Portal.' },
  { hours: 0.5, ministry: 'All outstanding paperwork must be completed before it is destroyed.',
    hijack: 'Thirty minutes.' },
  { hours: 10 / 60, ministry: 'We regret nothing. Our regret has been filed in triplicate, and shredded.',
    hijack: 'Ten minutes. Technoblade never dies. Neither should you.' },
  { hours: 1 / 60, ministry: 'Thank you for choosing the Ministry of Trolling.',
    hijack: 'Run.' },
]
// A hijacked reminder about the Relics every RELIC_REMINDER_HOURS (first one that long after the start), until one
// player has carried all ten. They take turns; the count of Relics found so far is added.
const RELIC_REMINDER_HOURS = 6
const RELIC_REMINDERS = [
  'The Ministry hid ten Blood Relics in the End City treasure chests. Find them before they burn.',
  'Unopened End City chests still hold Relics. Look in the treasure chests, deep inside the cities.',
  'One of you must carry all ten Relics at once. Then the Blood Portal opens: /bloodportal start',
]
const LAST_BROADCAST = [
  'Protocol Clean Slate is complete. All records have been destroyed.',
  'There is no evidence of wrongdoing. There is no evidence of anything. Compliance is at one hundred percent.',
  'The Ministry thanks you for your cooperation. This broadcast will now end.',
]
const FALLEN_TITLE = { title: 'CLEAN SLATE', subtitle: 'You did not escape.' }

const VOICE_MINISTRY = { tag: '[MINISTRY]', tagColor: 'gold', textColor: 'yellow' }
const VOICE_HIJACK = { tag: '[SIGNAL HIJACKED]', tagColor: 'dark_red', textColor: 'red' }


// ===================== STATE =====================

const DATA_KEY = 'clean_slate'
const OVERWORLD = 'minecraft:overworld'
const END = 'minecraft:the_end'
if (!global.cleanSlateState) global.cleanSlateState = { token: 0 }
const S = global.cleanSlateState
S.token++
S.lastBolt = {}

let Serializer = null, Heightmap = null
try { Serializer = Java.loadClass('net.minecraft.network.chat.Component$Serializer') } catch (e) { }
try { Heightmap = Java.loadClass('net.minecraft.world.level.levelgen.Heightmap$Types') } catch (e) { }

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
function isOp(p) { try { return p.hasPermissions(2) } catch (e) { return false } }
function inPlay(p) { try { return !p.isCreative() && !p.isSpectator() } catch (e) { return true } }
function levelOf(e) { const l = e.level; return typeof l == 'function' ? e.level() : l }
function dimensionId(level) {
  let d = level.dimension
  if (typeof d == 'function') d = level.dimension()
  if (d != null && typeof d.location == 'function') d = d.location()
  return String(d)
}
function dimOf(e) { return dimensionId(levelOf(e)) }
function posOf(e) {
  const read = k => {
    try { return Number(e['get' + k.toUpperCase()]()) } catch (err) { }
    return Number(e[k])
  }
  return { x: read('x'), y: read('y'), z: read('z') }
}
function num(v) { return (Math.round(v * 100) / 100).toString() }
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
function run(server, c) {
  try { return server.runCommandSilent(c) } catch (e) { console.warn('[CleanSlate] ' + c + ': ' + e); return 0 }
}


// ===================== SAVED DATA =====================
// server.persistentData['clean_slate'] = JSON { v, state: idle|pending|running|ended, startAt (pending), startedAt,
//   endsAt, total, by, pausedLeft, test: uuid|null, fired: { hours: true }, lastThunder, oldFireTick,
//   dragonKilled: { t, by }, fallen: { uuid: name }, endedAt }

let DB = null
function db() {
  if (DB) return DB
  let raw = ''
  try { raw = String(Utils.server.persistentData.getString(DATA_KEY) || '') } catch (e) { }
  let parsed = null
  if (raw) {
    try { parsed = JSON.parse(raw) } catch (e) {
      try { Utils.server.persistentData.putString(DATA_KEY + '_unreadable_' + Date.now(), raw) } catch (e2) { }
      console.error('[CleanSlate] Saved data could not be read (' + e + '); a copy was kept and it starts fresh.')
    }
  }
  DB = parsed && parsed.v ? parsed : { v: 1, state: 'idle' }
  if (!DB.fired) DB.fired = {}
  if (!DB.fallen) DB.fallen = {}
  return DB
}
function save() {
  try { Utils.server.persistentData.putString(DATA_KEY, JSON.stringify(db())) } catch (e) { console.error('[CleanSlate] Save failed: ' + e) }
}


// ===================== WHO HEARS IT =====================
// A test run is only for the op who started it; the real thing is for everyone.

function audience(server) {
  const D = db(), all = onlinePlayers(server)
  return D.test ? all.filter(p => uuidOf(p) == D.test) : all
}
// only: the players a test run started with (its last lines come after the test has ended).
function announce(server, parts, only) {
  if (TO_DISCORD && !db().test && !only) {
    try { server.runCommandSilent('tellraw @a ' + JSON.stringify([''].concat(parts))); return } catch (e) { }
  }
  const c = comp(parts)
  ;(only || audience(server)).forEach(p => { try { p.tell(c) } catch (e) { } })
}
function selector(server) {
  const D = db()
  if (!D.test) return '@a'
  const p = audience(server)[0]
  return p ? nameOf(p) : null
}

// The Ministry's voice breaking up: `level` 0 (clear) to 1 (mostly static).
function garbled(text, level) {
  const parts = [{ text: VOICE_MINISTRY.tag, color: VOICE_MINISTRY.tagColor, bold: true }, ' ']
  if (level > 0.5) parts.push({ text: '[STATIC] ', color: 'dark_gray' })
  String(text).split(' ').forEach((w, i) => {
    let lost = i > 0 && Math.random() < level * 0.5
    parts.push(lost ? { text: w, color: 'dark_gray', obfuscated: true } : { text: w, color: VOICE_MINISTRY.textColor })
    parts.push(' ')
  })
  parts.pop()
  return parts
}


// ===================== TIME =====================

function leftMs() {
  const D = db()
  if (D.state != 'running') return 0
  if (D.pausedLeft != null) return D.pausedLeft
  return Math.max(0, D.endsAt - Date.now())
}
function leftText(ms) {
  const s = Math.ceil(ms / 1000)
  const d = Math.floor(s / 86400), h = Math.floor(s % 86400 / 3600), m = Math.floor(s % 3600 / 60), sec = s % 60
  if (s >= 3600) return (d ? d + 'd ' : '') + h + 'h ' + m + 'm'
  return (m ? m + 'm ' : '') + sec + 's'
}
function progress() {
  const D = db()
  return D.total ? Math.min(1, Math.max(0, 1 - leftMs() / D.total)) : 0
}


// ===================== STARTING AND ENDING =====================

function start(server, hours, by, opts) {
  opts = opts || {}
  const D = db()
  if (D.state == 'running') return { ok: false, text: 'Protocol Clean Slate is already running (' + leftText(leftMs()) + ' left).' }
  if (D.state == 'ended' && !opts.test) return { ok: false, text: 'Protocol Clean Slate has already happened. /cleanslate cancel resets it.' }
  const total = Math.round(hours * 3600000)
  D.state = 'running'
  D.startedAt = Date.now()
  D.endsAt = D.startedAt + total
  D.total = total
  D.by = by
  D.pausedLeft = null
  D.test = opts.test || null
  D.fired = {}
  D.lastReminder = D.startedAt
  D.reminderN = 0
  D.startAt = null
  // Broadcasts for more time than this run has are skipped.
  MILESTONES.forEach(m => { if (m.hours * 3600000 >= total) D.fired[String(m.hours)] = true })
  if (!D.test && STOP_FIRE_SPREAD) {
    D.oldFireTick = run(server, 'gamerule doFireTick') ? true : false
    run(server, 'gamerule doFireTick false')
  }
  save()
  thunder(server)
  run(server, 'bossbar add ' + BOSSBAR + ' ' + JSON.stringify({ text: 'PROTOCOL CLEAN SLATE', color: 'dark_red', bold: true }))
  run(server, 'bossbar set ' + BOSSBAR + ' color ' + BOSSBAR_COLOR)
  run(server, 'bossbar set ' + BOSSBAR + ' max 1000')
  updateBar(server)
  // The finale act (story.js) announces it. A test, or a server without story.js, gets a short version.
  const St = global.Story
  if (!D.test && St && St.setAct && !opts.fromStory) {
    try { St.setAct('finale', by) } catch (e) { console.warn('[CleanSlate] Story: ' + e) }
  } else if (D.test || !St) {
    announce(server, garbled('Protocol Clean Slate is now in effect. All records, and the world they are kept in, will be cleaned.', 0))
    announce(server, voiceParts(VOICE_HIJACK, 'They are burning the world to bury what they did. This world has ' + leftText(total) + '.'))
  }
  console.info('[CleanSlate] Started by ' + by + (D.test ? ' (test)' : '') + ', ' + hours + ' h')
  startLoop(server)
  return { ok: true, text: 'Protocol Clean Slate is running: ' + leftText(total) + (D.test ? ' (test: only you see it).' : '.') }
}

function clearEffects(server) {
  const D = db()
  run(server, 'bossbar remove ' + BOSSBAR)
  if (!D.test) {
    run(server, 'weather clear')
    if (STOP_FIRE_SPREAD && D.oldFireTick != null) run(server, 'gamerule doFireTick ' + (D.oldFireTick ? 'true' : 'false'))
  }
  D.oldFireTick = null
}

function escaped(u) {
  const B = global.BloodPortal
  try { return !!(B && B.hasEscaped(u)) } catch (e) { return false }
}

function fall(server, p) {
  const D = db(), u = uuidOf(p), name = nameOf(p)
  try {
    let q = posOf(p)
    visualBolt(server, levelOf(p), dimOf(p), q.x, q.y, q.z)
  } catch (e) { }
  run(server, 'title ' + name + ' times 10 100 40')
  run(server, 'title ' + name + ' subtitle ' + JSON.stringify({ text: FALLEN_TITLE.subtitle, color: 'red' }))
  run(server, 'title ' + name + ' title ' + JSON.stringify({ text: FALLEN_TITLE.title, color: 'dark_red', bold: true }))
  if (D.test) {
    try { p.tell(comp([{ text: '[Clean Slate test] ', color: 'gold' }, { text: 'Here you would be put in spectator mode.', color: 'gray' }])) } catch (e) { }
    return
  }
  run(server, 'gamemode spectator ' + name)
  D.fallen[u] = name
  console.info('[CleanSlate] ' + name + ' fell')
}

function finish(server) {
  const D = db(), only = D.test ? audience(server) : null
  LAST_BROADCAST.forEach((line, i) => {
    server.scheduleInTicks(i * 80, () => announce(server, garbled(line, 0), only))
  })
  run(server, 'execute as ' + (selector(server) || '@a') + ' at @s run playsound minecraft:entity.wither.death master @s ~ ~ ~ 1 0.5')
  audience(server).forEach(p => {
    if (inPlay(p) && !escaped(uuidOf(p))) fall(server, p)
  })
  clearEffects(server)
  if (D.test) {
    D.state = 'idle'
    D.test = null
    console.info('[CleanSlate] Test finished')
  } else {
    D.state = 'ended'
    D.endedAt = Date.now()
    console.info('[CleanSlate] Protocol Clean Slate is complete')
  }
  save()
}


// ===================== THE WORLD BURNING =====================

function thunder(server) {
  const D = db()
  D.lastThunder = Date.now()
  if (!D.test) run(server, 'weather thunder 12000')
}

function updateBar(server) {
  const D = db(), left = leftMs(), who = selector(server)
  run(server, 'bossbar set ' + BOSSBAR + ' name ' + JSON.stringify([{ text: 'PROTOCOL CLEAN SLATE: ', color: 'dark_red', bold: true },
    { text: leftText(left) + (D.pausedLeft != null ? ' (paused)' : ''), color: 'red' }]))
  run(server, 'bossbar set ' + BOSSBAR + ' value ' + Math.round(1000 * left / Math.max(1, D.total)))
  if (who) run(server, 'bossbar set ' + BOSSBAR + ' players ' + who)
}

function visualBolt(server, level, dim, x, y, z) {
  try {
    let bolt = level.createEntity('minecraft:lightning_bolt')
    bolt.setVisualOnly(true)
    bolt.setPosition(x, y, z)
    bolt.spawn()
    return
  } catch (e) { }
  run(server, 'execute in ' + dim + ' run particle minecraft:electric_spark ' + num(x) + ' ' + num(y + 1) + ' ' + num(z) + ' 0.3 2 0.3 0.1 60 force')
  run(server, 'execute in ' + dim + ' run playsound minecraft:entity.lightning_bolt.thunder weather @a ' + num(x) + ' ' + num(y) + ' ' + num(z) + ' 4 1')
}
function surfaceY(level, x, z, fallback) {
  if (Heightmap) {
    try { return Number(level.getHeight(Heightmap.MOTION_BLOCKING, Math.floor(x), Math.floor(z))) } catch (e) { }
  }
  return fallback
}
// Bolts land on the surface, so a player underground only hears them.
function lightning(server) {
  const now = Date.now(), t = progress()
  const every = (LIGHTNING.fromSeconds + (LIGHTNING.toSeconds - LIGHTNING.fromSeconds) * t) * 1000
  audience(server).forEach(p => {
    if (dimOf(p) != OVERWORLD) return
    let u = uuidOf(p)
    if (S.lastBolt[u] && now - S.lastBolt[u] < every) return
    S.lastBolt[u] = now
    let q = posOf(p), a = Math.random() * 6.2832
    let d = LIGHTNING.distance[0] + Math.random() * (LIGHTNING.distance[1] - LIGHTNING.distance[0])
    let x = q.x + Math.cos(a) * d, z = q.z + Math.sin(a) * d
    visualBolt(server, levelOf(p), OVERWORLD, x, surfaceY(levelOf(p), x, z, q.y), z)
  })
}

function milestones(server) {
  const D = db(), left = leftMs()
  const due = MILESTONES.filter(m => !D.fired[String(m.hours)] && left <= m.hours * 3600000)
  if (!due.length) return
  due.forEach(m => { D.fired[String(m.hours)] = true })
  save()
  const m = due[due.length - 1]                 // after a long downtime, only the latest one is read out
  const level = Math.min(0.9, progress()), only = D.test ? audience(server) : null
  const reply = relicsGathered() && m.gathered ? m.gathered : m.hijack
  announce(server, garbled(m.ministry, level), only)
  server.scheduleInTicks(80, () => announce(server, voiceParts(VOICE_HIJACK, reply), only))
}

function BP() { return global.BloodPortal || null }
function relicsGathered() { const B = BP(); try { return !!(B && B.unlocked()) } catch (e) { return false } }
function relicReminder(server) {
  const D = db()
  if (D.test || relicsGathered() || !RELIC_REMINDER_HOURS) return
  if (Date.now() - (D.lastReminder || D.startedAt) < RELIC_REMINDER_HOURS * 3600000) return
  D.lastReminder = Date.now()
  const n = D.reminderN || 0
  D.reminderN = n + 1
  save()
  let count = ''
  const B = BP()
  try { if (B && B.relicsFound) count = ' (' + B.relicsFound() + ' of ' + (B.relicCount || 10) + ' have surfaced so far.)' } catch (e) { }
  announce(server, voiceParts(VOICE_HIJACK, RELIC_REMINDERS[n % RELIC_REMINDERS.length] + count))
}

function finalSeconds(server, left) {
  const s = Math.ceil(left / 1000), who = selector(server)
  if (!who || s > 10 || s < 1 || S.lastCount == s) return
  S.lastCount = s
  run(server, 'title ' + who + ' times 0 25 5')
  run(server, 'title ' + who + ' title ' + JSON.stringify({ text: String(s), color: 'dark_red', bold: true }))
  run(server, 'execute as ' + who + ' at @s run playsound minecraft:block.note_block.basedrum master @s ~ ~ ~ 1 0.5')
}


// ===================== THE LOOP =====================
// Once a second. Times are real time, so a restart or /reload loses nothing.

function tick(server) {
  const D = db()
  if (D.state == 'pending' && Date.now() >= D.startAt) {
    D.state = 'idle'
    start(server, DURATION_HOURS, D.pendingBy || 'the death of the dragon', {})
    return
  }
  if (D.state != 'running') return
  const left = leftMs()
  if (left <= 0) { finish(server); return }
  if (D.pausedLeft != null) return
  S.n = (S.n || 0) + 1
  if (left < 60000 || S.n % 20 == 0) updateBar(server)
  milestones(server)
  relicReminder(server)
  finalSeconds(server, left)
  if (Date.now() - (D.lastThunder || 0) >= THUNDER_EVERY_MINUTES * 60000) { thunder(server); save() }
  lightning(server)
}
function startLoop(server) {
  if (S.looping == S.token) return
  S.looping = S.token
  const token = S.token
  const loop = () => {
    if (token != S.token) return
    try { tick(server) } catch (e) { console.error('[CleanSlate] ' + e) }
    const D = db()
    if (D.state == 'running' || D.state == 'pending') server.scheduleInTicks(20, loop)
    else S.looping = 0
  }
  server.scheduleInTicks(20, loop)
}
ServerEvents.loaded(event => { const D = db(); if (D.state == 'running' || D.state == 'pending') startLoop(event.server) })
if (Utils.server) {
  let D0 = db()
  if (D0.state == 'running' || D0.state == 'pending') startLoop(Utils.server)
}


// ===================== EVENTS =====================

// The first Ender Dragon kill (after /cleanslate rearm, the next one). by: the killer's name, or ''.
function dragonDied(server, by) {
  const D = db()
  if (D.dragonKilled) return
  D.dragonKilled = { t: Date.now(), by: by }
  D.fightBaseline = true
  console.info('[CleanSlate] The Ender Dragon was killed' + (by ? ' by ' + by : ''))
  if (START_ON_DRAGON_KILL && D.state == 'idle') {
    D.state = 'pending'
    D.startAt = Date.now() + START_DELAY_SECONDS * 1000
    D.pendingBy = by ? by + ' (the dragon)' : 'the death of the dragon'
    startLoop(server)
  }
  save()
}
EntityEvents.death(event => {
  const e = event.entity
  let type = ''
  try { type = String(e.getEncodeId()) } catch (err) { }
  if (type != 'minecraft:ender_dragon') return
  try { if (dimOf(e) != END) return } catch (err) { return }
  if (db().dragonKilled) return
  let by = ''
  try {
    let a = event.source.actual
    if (a == null) a = event.source.getActual()
    if (a != null && a.isPlayer()) by = nameOf(a)
  } catch (err) { }
  dragonDied(event.server, by)
})

// The backup: /kill on the dragon (or a mod ending the fight its own way) fires no death event, so the End's dragon
// fight is checked every 5 s. Only a change from "never killed" to "killed" counts; the first reading is the
// baseline, so a world whose dragon died before this script was installed doesn't trigger anything.
function endLevel(server) {
  try { let l = server.getLevel(END); if (l) return l } catch (e) { }
  try {
    let found = null
    server.getAllLevels().forEach(l => { if (!found && dimensionId(l) == END) found = l })
    return found
  } catch (e) { }
  return null
}
function fightKilled(server) {
  try {
    let f = endLevel(server).getDragonFight()
    return f == null ? null : !!f.hasPreviouslyKilledDragon()
  } catch (e) { return null }
}
function watchFight(server) {
  const D = db()
  if (D.dragonKilled || D.state != 'idle') return
  const k = fightKilled(server)
  if (k == null) return
  if (D.fightBaseline == null) { D.fightBaseline = k; save(); return }
  if (k && !D.fightBaseline) {
    console.info('[CleanSlate] The dragon fight ended without a death event (/kill?); treating it as the kill')
    dragonDied(server, '')
    let B = global.BloodPortal
    try { if (B && B.dragonFallen) B.dragonFallen() } catch (e) { console.warn('[CleanSlate] Bill: ' + e) }
  } else if (!k && D.fightBaseline) {
    D.fightBaseline = false                                   // the fight was reset (YUNG's /end_island reset)
    save()
  }
}
function startWatch(server) {
  if (S.watching == S.token) return
  S.watching = S.token
  const token = S.token
  const loop = () => {
    if (token != S.token) return
    try { watchFight(server) } catch (e) { console.error('[CleanSlate] ' + e) }
    server.scheduleInTicks(100, loop)
  }
  server.scheduleInTicks(100, loop)
}
ServerEvents.loaded(event => startWatch(event.server))
if (Utils.server) startWatch(Utils.server)

PlayerEvents.loggedIn(event => {
  const p = event.player, D = db()
  if (D.state == 'running' && !D.test) event.server.scheduleInTicks(40, () => updateBar(event.server))
  if (D.state == 'ended' && FALL_ON_LOGIN && inPlay(p) && !escaped(uuidOf(p))) {
    event.server.scheduleInTicks(40, () => { if (inPlay(p)) fall(event.server, p); save() })
  }
})


// ===================== API FOR OTHER SCRIPTS =====================

global.CleanSlate = {
  active: () => db().state == 'running' && !db().test,
  state: () => db().state,
  endsAt: () => db().endsAt || 0,
  leftMs: () => leftMs(),
  // story.js calls this when the act becomes `finale`.
  onFinaleAct: by => {
    const D = db()
    if (D.state == 'ended' || (D.state == 'running' && !D.test)) return
    if (D.test) { clearEffects(Utils.server); D.test = null }
    D.state = 'idle'
    start(Utils.server, DURATION_HOURS, by || 'the story', { fromStory: true })
  },
}


// ===================== COMMANDS =====================

ServerEvents.commandRegistry(event => {
  const Commands = event.commands
  const Arguments = event.arguments
  const reply = (ctx, text, bad) => {
    ctx.source.sendSystemMessage(comp([{ text: '[Clean Slate] ', color: 'dark_red' }, { text: text, color: bad ? 'red' : 'gray' }]))
    return bad ? 0 : 1
  }
  const safe = fn => ctx => {
    try { return fn(ctx) } catch (e) {
      console.error('[CleanSlate] ' + e)
      return reply(ctx, 'Error: ' + e, true)
    }
  }
  const done = (ctx, r) => reply(ctx, r.text, !r.ok)
  const int = name => Commands.argument(name, Arguments.INTEGER.create(event))
  const num = (ctx, name) => Number(Arguments.INTEGER.getResult(ctx, name))
  const who = ctx => { const p = ctx.source.getPlayer(); return p ? nameOf(p) : 'the console' }
  const op = src => src.hasPermission(2)

  const status = ctx => {
    const D = db()
    if (D.state == 'running') {
      reply(ctx, (D.test ? 'Test run' : 'Running') + ': ' + leftText(leftMs()) + ' left' + (D.pausedLeft != null ? ' (paused)' : '') + '. Started by ' + D.by + '.')
    } else if (D.state == 'pending') reply(ctx, 'Starting in a few seconds (the dragon is dead).')
    else if (D.state == 'ended') reply(ctx, 'Over. ' + Object.keys(D.fallen).length + ' player(s) fell.')
    else reply(ctx, 'Not started. It begins when the Ender Dragon is killed' + (START_ON_DRAGON_KILL ? '' : ' (switched off: START_ON_DRAGON_KILL)') + ', or with /cleanslate start.')
    const fk = fightKilled(ctx.source.server)
    reply(ctx, 'The dragon: ' + (D.dragonKilled ? 'killed' + (D.dragonKilled.by ? ' by ' + D.dragonKilled.by : '') + ' (only the first kill counts; /cleanslate rearm for a new End)' : 'not killed yet') +
      '. The End\'s fight says: ' + (fk == null ? 'unknown' : fk ? 'dragon previously killed' : 'never killed') + '.')
    const B = global.BloodPortal
    if (B) { try { reply(ctx, 'Blood Portal: ' + B.summary() + '.') } catch (e) { } }
    return 1
  }

  event.register(Commands.literal('cleanslate').requires(op)
    .executes(safe(status))
    .then(Commands.literal('status').executes(safe(status)))
    .then(Commands.literal('start')
      .executes(safe(ctx => done(ctx, start(ctx.source.server, DURATION_HOURS, who(ctx), {}))))
      .then(int('hours').executes(safe(ctx => {
        const h = num(ctx, 'hours')
        if (!(h >= 1)) return reply(ctx, 'At least 1 hour.', true)
        return done(ctx, start(ctx.source.server, h, who(ctx), {}))
      }))))
    .then(Commands.literal('test').executes(safe(ctx => {
      const p = ctx.source.getPlayer()
      if (!p) return reply(ctx, 'Run this as a player.', true)
      if (db().state != 'idle') return reply(ctx, 'Only when Clean Slate isn\'t running.', true)
      return done(ctx, start(ctx.source.server, TEST_MINUTES / 60, who(ctx), { test: uuidOf(p) }))
    })))
    .then(Commands.literal('extend').then(int('hours').executes(safe(ctx => {
      const D = db(), h = num(ctx, 'hours')
      if (D.state != 'running') return reply(ctx, 'It isn\'t running.', true)
      if (D.pausedLeft != null) D.pausedLeft += h * 3600000
      else D.endsAt += h * 3600000
      D.total += h * 3600000
      MILESTONES.forEach(m => { if (leftMs() > m.hours * 3600000) delete D.fired[String(m.hours)] })
      save()
      updateBar(ctx.source.server)
      return reply(ctx, 'Extended by ' + h + ' h: ' + leftText(leftMs()) + ' left.')
    }))))
    .then(Commands.literal('pause').executes(safe(ctx => {
      const D = db()
      if (D.state != 'running' || D.pausedLeft != null) return reply(ctx, 'It isn\'t running.', true)
      D.pausedLeft = leftMs()
      save()
      updateBar(ctx.source.server)
      return reply(ctx, 'Paused with ' + leftText(D.pausedLeft) + ' left.')
    })))
    .then(Commands.literal('resume').executes(safe(ctx => {
      const D = db()
      if (D.state != 'running' || D.pausedLeft == null) return reply(ctx, 'It isn\'t paused.', true)
      D.endsAt = Date.now() + D.pausedLeft
      D.pausedLeft = null
      save()
      updateBar(ctx.source.server)
      return reply(ctx, 'Resumed: ' + leftText(leftMs()) + ' left.')
    })))
    .then(Commands.literal('cancel').executes(safe(ctx => {
      const D = db()
      if (D.state == 'idle') return reply(ctx, 'Nothing to cancel.', true)
      clearEffects(ctx.source.server)
      D.state = 'idle'
      D.test = null
      D.pausedLeft = null
      D.fallen = {}
      save()
      console.info('[CleanSlate] Cancelled by ' + who(ctx))
      return reply(ctx, 'Cancelled quietly. Fallen players stay in spectator until you change their game mode. Another dragon kill won\'t start it (/cleanslate rearm re-arms it; /cleanslate start starts it now).')
    })))
    .then(Commands.literal('rearm').executes(safe(ctx => {
      const D = db(), fell = Object.keys(D.fallen || {}).length
      if (D.state == 'running') clearEffects(ctx.source.server)
      D.state = 'idle'
      D.test = null
      D.pausedLeft = null
      D.startAt = null
      delete D.dragonKilled
      delete D.fightBaseline
      D.fallen = {}
      save()
      const B = global.BloodPortal
      try { if (B && B.rearm) B.rearm() } catch (e) { }
      console.info('[CleanSlate] Re-armed by ' + who(ctx))
      return reply(ctx, 'Re-armed: the next Ender Dragon kill starts Protocol Clean Slate, and its killer gets Draft Bill 9-D.' +
        (fell ? ' ' + fell + ' fallen player(s) are still in spectator: /gamemode survival <player>.' : ''))
    }))))
})

})()
