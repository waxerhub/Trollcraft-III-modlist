// The story: Part I's acts and the Ministry's decrees (see STORY.md).
//
//  - Acts move forward only when an op says so: /story act next (or /story act set <id>). Each new act is announced
//    with a title for everyone and its opening lines (the Ministry, then a [SIGNAL HIJACKED] reply).
//  - Decrees are announcements only: numbered Ministry proclamations, listed with /decrees. Nothing is blocked by
//    code; breaking a decree is something Enforcers can charge with /accuse (factions/trials.js).
//  - global.Story tells other scripts which act the server is in.
//
// Commands: /decrees (anyone); /story status|act|decree ... (op level 2). Copy to <server>/kubejs/server_scripts/ and
// run /reload, then run /story act set prologue once.
//
// KubeJS 6 notes: no template strings; `let` inside nested blocks. Announcements are public propaganda, so with
// TO_DISCORD they go out with tellraw @a (Simple Discord Link posts them); never put anything secret in them.

(function () {

// ===================== SETTINGS =====================

const TO_DISCORD = true                // acts and decrees with tellraw @a (posted to Discord); false = each player in game only
const DECREE_START = 41                // the first decree's number ("for continuity")

// The acts, in order. title/subtitle: the full-screen title. ministry: the Ministry's opening lines. hijack: the
// reply, after a pause. Lines are read out a few seconds apart.
const ACTS = [
  { id: 'prologue', name: 'Prologue', title: 'TROLLCRAFT III', subtitle: 'Managed Trollocracy',
    ministry: ['Welcome, citizens. The Ministry of Trolling exists to secure your right to troll freely.', 'Freedom is mandatory.'],
    hijack: [] },
  { id: 'act2', name: 'Act II: Inspections', title: 'ACT II', subtitle: 'Inspections',
    ministry: ['Inspections begin today. Citizens suspected of treasonous thoughts will be visited.', 'All thoughts are suspected.'],
    hijack: ['They are counting your thoughts. We are counting your trolls.'] },
  { id: 'act3', name: 'Act III: The Loyalty Audit', title: 'ACT III', subtitle: 'The Loyalty Audit',
    ministry: ['The Ministry thanks its Loyalists for their loyalty, which is now being audited.', 'Loyalty found to be insufficient will be corrected.'],
    hijack: ['Even their friends are not safe. Ask yourselves why.'] },
  { id: 'act4', name: 'Act IV: The End Lockdown', title: 'ACT IV', subtitle: 'The End Lockdown',
    ministry: ['There is nothing in the End.', 'Anyone saying otherwise has been to the End, which is impossible.'],
    hijack: ['Everything they buried is in the End. Go and read it.'] },
  { id: 'finale', name: 'Protocol Clean Slate', title: 'PROTOCOL', subtitle: 'CLEAN SLATE',
    ministry: ['If the Ministry cannot have this world, no one will.', 'This is for your protection.'],
    hijack: ['Fill the Blood Pool. The Gate opens when it is full.', 'Technoblade never dies.'] },
]
const LINE_GAP_SECONDS = 4

// Ready-made decrees: /story decree preset <id>.
const DECREE_PRESETS = {
  licence_act: 'The Trolling Licence Act. All pranks require a permit. Permits are not available. Unlicensed trolling is a chargeable offence.',
  chests_north: 'All chests must face north. Chests facing any other direction are under investigation.',
  floor_safety: 'The Mandatory Floor Safety Initiative. Watch where you step at all times. Questions are a known trip hazard.',
  technoblade_phrase: 'The phrase "Technoblade never dies" is under investigation under the Sanctity of Swine Act. Use the approved alternative: "Technoblade is fondly remembered, within regulations."',
  end_lockdown: 'The End Lockdown Initiative. There is nothing in the End. Do not go to the End.',
  swine_dignity: 'The Swine Dignity Fee. Pig dignity is issued by the Ministry, upon payment.',
  prayer_tax: 'All prayer is taxed. Prayers must be submitted in triplicate, at least three days before they are needed.',
  mandatory_fun: 'Mandatory Fun Day. Fun is compulsory. Unapproved fun will be confiscated.',
}

const VOICE_MINISTRY = { tag: '[MINISTRY]', tagColor: 'gold', textColor: 'yellow' }
const VOICE_HIJACK = { tag: '[SIGNAL HIJACKED]', tagColor: 'dark_red', textColor: 'red' }


// ===================== STATE =====================

const DATA_KEY = 'story'
if (!global.storyState) global.storyState = { token: 0 }
const S = global.storyState
S.token++

let Serializer = null, StringArg = null
try { Serializer = Java.loadClass('net.minecraft.network.chat.Component$Serializer') } catch (e) { }
try { StringArg = Java.loadClass('com.mojang.brigadier.arguments.StringArgumentType') } catch (e) { }

function onlinePlayers(server) {
  const list = server.players, out = []
  for (let i = 0; i < list.size(); i++) out.push(list.get(i))
  return out
}
function nameOf(p) { return String(p.getGameProfile().getName()) }
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
// A public announcement: tellraw @a (Discord sees it) or each player in game.
function announce(server, parts) {
  if (TO_DISCORD) {
    try { server.runCommandSilent('tellraw @a ' + JSON.stringify([''].concat(parts))); return } catch (e) { }
  }
  const c = comp(parts)
  onlinePlayers(server).forEach(p => { try { p.tell(c) } catch (e) { } })
}
function dateText(ms) {
  const d = new Date(ms)
  const two = n => (n < 10 ? '0' : '') + n
  return d.getUTCFullYear() + '-' + two(d.getUTCMonth() + 1) + '-' + two(d.getUTCDate()) + ' ' + two(d.getUTCHours()) + ':' + two(d.getUTCMinutes()) + ' UTC'
}


// ===================== SAVED DATA =====================
// server.persistentData['story'] = JSON { v, act, actStarted, history: [ { act, t } ], nextDecree,
//   decrees: { n: { text, t, by, revoked, revokedAt } } }

let DB = null
function db() {
  if (DB) return DB
  let raw = ''
  try { raw = String(Utils.server.persistentData.getString(DATA_KEY) || '') } catch (e) { }
  let parsed = null
  if (raw) {
    try { parsed = JSON.parse(raw) } catch (e) {
      try { Utils.server.persistentData.putString(DATA_KEY + '_unreadable_' + Date.now(), raw) } catch (e2) { }
      console.error('[Story] Saved data could not be read (' + e + '); a copy was kept and it starts fresh.')
    }
  }
  DB = parsed && parsed.v ? parsed : { v: 1 }
  if (!DB.act) DB.act = ''
  if (!DB.history) DB.history = []
  if (!DB.decrees) DB.decrees = {}
  if (!DB.nextDecree) DB.nextDecree = DECREE_START
  return DB
}
function save() {
  try { Utils.server.persistentData.putString(DATA_KEY, JSON.stringify(db())) } catch (e) { console.error('[Story] Save failed: ' + e) }
}


// ===================== ACTS =====================

function actIndex(id) {
  for (let i = 0; i < ACTS.length; i++) if (ACTS[i].id == id) return i
  return -1
}
function currentAct() { return ACTS[actIndex(db().act)] || null }

// Title for everyone, then the Ministry's lines, then the hijacked reply.
function announceAct(server, a) {
  const token = S.token
  const t = s => JSON.stringify({ text: s, color: 'gold', bold: true })
  try {
    server.runCommandSilent('title @a times 20 100 30')
    server.runCommandSilent('title @a subtitle ' + JSON.stringify({ text: a.subtitle, color: 'yellow', bold: true }))
    server.runCommandSilent('title @a title ' + t(a.title))
    server.runCommandSilent('playsound minecraft:event.raid.horn master @a ~ ~ ~ 100 1')
  } catch (e) { }
  const lines = a.ministry.map(x => voiceParts(VOICE_MINISTRY, x)).concat(a.hijack.map(x => voiceParts(VOICE_HIJACK, x)))
  lines.forEach((parts, i) => {
    server.scheduleInTicks((i + 1) * LINE_GAP_SECONDS * 20, () => { if (token == S.token) announce(server, parts) })
  })
}
function setAct(server, id, by) {
  const a = ACTS[actIndex(id)]
  if (!a) return { ok: false, text: 'Acts: ' + ACTS.map(x => x.id).join(', ') + '.' }
  const D = db()
  D.act = a.id
  D.actStarted = Date.now()
  D.history.push({ act: a.id, t: D.actStarted, by: by })
  save()
  announceAct(server, a)
  console.info('[Story] Act set to ' + a.id + ' by ' + by)
  return { ok: true, text: 'Now in ' + a.name + '.' }
}


// ===================== DECREES =====================

function cleanText(t) { return String(t || '').replace(/[\u0000-\u001f§]/g, '').replace(/\s+/g, ' ').trim().substring(0, 300) }
function issue(server, text, by) {
  const clean = cleanText(text)
  if (!clean) return { ok: false, text: 'What does the decree say?' }
  const D = db(), n = D.nextDecree++
  D.decrees[String(n)] = { text: clean, t: Date.now(), by: by }
  save()
  announce(server, [{ text: VOICE_MINISTRY.tag, color: VOICE_MINISTRY.tagColor, bold: true }, { text: ' DECREE #' + n + ': ', color: 'gold', bold: true },
    { text: clean, color: VOICE_MINISTRY.textColor }])
  try { server.runCommandSilent('playsound minecraft:block.bell.use master @a ~ ~ ~ 100 0.8') } catch (e) { }
  console.info('[Story] Decree #' + n + ' issued by ' + by + ': ' + clean)
  return { ok: true, text: 'Decree #' + n + ' issued.' }
}
function revoke(server, n, by) {
  const d = db().decrees[String(n)]
  if (!d || d.revoked) return { ok: false, text: 'There is no decree #' + n + ' in force.' }
  d.revoked = true
  d.revokedAt = Date.now()
  save()
  announce(server, voiceParts(VOICE_MINISTRY, 'Decree #' + n + ' has been overturned. It was never issued.'))
  console.info('[Story] Decree #' + n + ' revoked by ' + by)
  return { ok: true, text: 'Decree #' + n + ' overturned.' }
}
function inForce() {
  const D = db().decrees
  return Object.keys(D).filter(k => !D[k].revoked).sort((a, b) => Number(a) - Number(b))
}


// ===================== API FOR OTHER SCRIPTS =====================

global.Story = {
  act: () => db().act,                                    // '' before the first /story act set
  actIndex: id => actIndex(String(id)),
  isAtLeast: id => actIndex(db().act) >= actIndex(String(id)) && actIndex(String(id)) >= 0,
  decrees: () => inForce().map(n => ({ number: Number(n), text: db().decrees[n].text })),
  issueDecree: (text, by) => issue(Utils.server, text, by || 'a script'),
}


// ===================== COMMANDS =====================

ServerEvents.commandRegistry(event => {
  const Commands = event.commands
  const Arguments = event.arguments
  const reply = (ctx, text, bad) => {
    ctx.source.sendSystemMessage(comp([{ text: '[Story] ', color: 'gold' }, { text: text, color: bad ? 'red' : 'gray' }]))
    return bad ? 0 : 1
  }
  const safe = fn => ctx => {
    try { return fn(ctx) } catch (e) {
      console.error('[Story] ' + e)
      return reply(ctx, 'Error: ' + e, true)
    }
  }
  const done = (ctx, r) => reply(ctx, r.text, !r.ok)
  const word = name => Commands.argument(name, StringArg.word())
  const rest = name => Commands.argument(name, StringArg.greedyString())
  const str = (ctx, name) => String(StringArg.getString(ctx, name))
  const int = name => Commands.argument(name, Arguments.INTEGER.create(event))
  const num = (ctx, name) => Number(Arguments.INTEGER.getResult(ctx, name))
  const who = ctx => { const p = ctx.source.getPlayer(); return p ? nameOf(p) : 'the console' }

  const listDecrees = (ctx, all) => {
    const D = db().decrees, keys = all ? Object.keys(D).sort((a, b) => Number(a) - Number(b)) : inForce()
    if (!keys.length) return reply(ctx, 'No decrees are in force. Enjoy it while it lasts.')
    reply(ctx, all ? 'All decrees:' : 'Decrees in force:')
    keys.forEach(k => reply(ctx, '#' + k + (D[k].revoked ? ' (overturned)' : '') + ': ' + D[k].text + (all ? ' (' + dateText(D[k].t) + ', ' + D[k].by + ')' : '')))
    return 1
  }

  event.register(Commands.literal('decrees').executes(safe(ctx => listDecrees(ctx, false))))

  event.register(Commands.literal('story')
    .requires(src => src.hasPermission(2))
    .then(Commands.literal('status').executes(safe(ctx => {
      const a = currentAct(), D = db()
      reply(ctx, a ? 'Now in ' + a.name + ', since ' + dateText(D.actStarted) + '.' : 'No act set yet: run /story act set prologue.')
      const i = actIndex(D.act)
      reply(ctx, 'Next: ' + (ACTS[i + 1] ? ACTS[i + 1].name + ' (/story act next)' : 'nothing; this is the last act.'))
      reply(ctx, inForce().length + ' decree(s) in force. Presets: ' + Object.keys(DECREE_PRESETS).join(', ') + '.')
      return 1
    })))
    .then(Commands.literal('act')
      .then(Commands.literal('next').executes(safe(ctx => {
        const i = actIndex(db().act)
        if (!ACTS[i + 1]) return reply(ctx, 'This is the last act.', true)
        return done(ctx, setAct(ctx.source.server, ACTS[i + 1].id, who(ctx)))
      })))
      .then(Commands.literal('set').then(word('act').executes(safe(ctx => done(ctx, setAct(ctx.source.server, str(ctx, 'act'), who(ctx)))))))
      .then(Commands.literal('replay').executes(safe(ctx => {
        const a = currentAct()
        if (!a) return reply(ctx, 'No act set yet.', true)
        announceAct(ctx.source.server, a)
        return reply(ctx, 'Replaying the announcement for ' + a.name + '.')
      }))))
    .then(Commands.literal('decree')
      .then(Commands.literal('issue').then(rest('text').executes(safe(ctx => done(ctx, issue(ctx.source.server, str(ctx, 'text'), who(ctx)))))))
      .then(Commands.literal('preset').then(word('id').executes(safe(ctx => {
        const id = str(ctx, 'id'), text = DECREE_PRESETS[id]
        if (!text) return reply(ctx, 'Presets: ' + Object.keys(DECREE_PRESETS).join(', ') + '.', true)
        return done(ctx, issue(ctx.source.server, text, who(ctx)))
      }))))
      .then(Commands.literal('revoke').then(int('number').executes(safe(ctx => done(ctx, revoke(ctx.source.server, num(ctx, 'number'), who(ctx)))))))
      .then(Commands.literal('list').executes(safe(ctx => listDecrees(ctx, true))))))
})

})()
