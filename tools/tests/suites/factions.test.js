// Run with: node tools/tests/run_all.js factions   (or node tools/tests/suites/factions.test.js)
const REPO_ROOT = require('path').resolve(__dirname, '..', '..', '..')
// Mock KubeJS 6 server for factions_config.js + factions_core.js
const fs = require('fs')
const DIR = REPO_ROOT + '/tools/kubejs/server_scripts/factions/'
const CONFIG_SRC = fs.readFileSync(DIR + 'factions_config.js', 'utf8')
const CORE_SRC = fs.readFileSync(DIR + 'factions_core.js', 'utf8')

let fails = 0
const ok = (l, c, e) => { console.log((c ? 'ok   ' : 'FAIL ') + l + (e ? '  ' + e : '')); if (!c) fails++ }

// ---------- text ----------
// Components are lists of styled segments, like Minecraft's: arrays = first element + siblings that inherit
// its style; .append() adds siblings (KubeJS's append).
const COLOR_NAMES = ['black', 'darkBlue', 'darkGreen', 'darkAqua', 'darkRed', 'darkPurple', 'gold', 'gray', 'darkGray', 'blue', 'green', 'aqua', 'red', 'lightPurple', 'yellow', 'white']
const snake = c => c.replace(/[A-Z]/g, m => '_' + m.toLowerCase())
function Comp(segs) {
  const c = { segs, append(o) { this.segs = this.segs.concat(o.segs); return this }, getString() { return this.segs.map(x => x.text).join('') },
    bold() { this.segs.forEach(x => { x.bold = true }); return this } }
  COLOR_NAMES.forEach(n => { c[n] = function () { this.segs.forEach(x => { x.color = snake(n) }); return this } })
  return c
}
function segsOf(j, inh) {
  inh = inh || {}
  if (j == null) return []
  if (typeof j == 'string') return [{ text: j, color: inh.color, bold: inh.bold }]
  if (Array.isArray(j)) {
    if (!j.length) return []
    const h = j[0]
    const st = h && typeof h == 'object' && !Array.isArray(h) ? { color: h.color || inh.color, bold: h.bold || inh.bold } : inh
    return segsOf(h, inh).concat(...j.slice(1).map(x => segsOf(x, st)))
  }
  const st = { color: j.color || inh.color, bold: j.bold || inh.bold }
  return [{ text: j.text || '', color: st.color, bold: st.bold }].concat(j.extra ? segsOf(j.extra, st) : [])
}
function C(json) { return Comp(segsOf(JSON.parse(json))) }
const textOf = c => c && c.segs ? c.getString() : String(c && c.text || c)
const colorOf = (c, text) => { const seg = c.segs.find(x => x.text == text); return seg ? seg.color : 'MISSING' }

// ---------- world ----------
const persistent = {}
const W = { cmds: [], logs: [], q: [], tick: 0 }
const players = []
function player(name, uuid, op, dim) {
  const p = {
    name, uuid, op, dim: dim || 'minecraft:overworld', inbox: [], packets: [],
    getGameProfile() { return { getName: () => p.name, getId: () => p.uuid } },
    getStringUuid: () => p.uuid,
    get level() { return { dimension: { toString: () => p.dim } } },
    tell(c) { p.inbox.push(textOf(c)) },
    hasPermissions: n => p.op,
    isPlayer: () => true,
    // Like Forge: worked out once (firing NameFormat, after FTB Essentials' nickname), cached until refreshed.
    nick: null, _dn: null, refreshes: 0,
    getDisplayName() {
      if (!p._dn) {
        let dn = Comp([{ text: p.nick || p.name }])
        const ev = { getEntity: () => p, getDisplayname: () => dn, setDisplayname: c => { dn = c } }
        if (global.factionsNameHookInstalled && global.factionsHooks && global.factionsHooks.onNameFormat) global.factionsHooks.onNameFormat(ev)
        p._dn = dn
      }
      return p._dn
    },
    refreshDisplayName() { p._dn = null; p.refreshes++ },
    connection: { send: pk => p.packets.push(pk) },
  }
  return p
}
const server = {
  get players() { return { size: () => players.length, get: i => players[i] } },
  persistentData: { getString: k => persistent[k] || '', putString: (k, v) => { persistent[k] = String(v) } },
  runCommandSilent: c => { W.cmds.push(c); return 1 },
  scheduleInTicks: (n, f) => W.q.push([W.tick + n, f]),
}
const Utils = { server: null }

// ---------- java ----------
function Pkt(kind) { return function (a, b, c) { this.kind = kind; this.text = a && a.segs ? textOf(a) : [a, b, c] } }
const classes = {
  'net.minecraft.network.chat.Component$Serializer': { fromJson: () => { throw new Error('InternalError: The choice of Java method ... fromJson matching JavaScript argument types (string) is ambiguous') }, fromJsonLenient: s => { if (W.breakJson) throw new Error('broken reader'); return C(s) }, toJson: c => JSON.stringify(c.segs) },
  'net.minecraft.network.protocol.game.ClientboundSetTitleTextPacket': Pkt('title'),
  'net.minecraft.network.protocol.game.ClientboundSetSubtitleTextPacket': Pkt('subtitle'),
  'net.minecraft.network.protocol.game.ClientboundSetTitlesAnimationPacket': Pkt('times'),
  'com.mojang.brigadier.arguments.StringArgumentType': { word: () => 'word', greedyString: () => 'greedy', getString: (ctx, n) => ctx.args[n] },
}
const Java = { loadClass: n => { if (!classes[n]) throw new Error('no class ' + n); return classes[n] } }
const Text = { of: s => Comp([{ text: String(s) }]) }
const console2 = { info: m => W.logs.push('INFO ' + m), warn: m => W.logs.push('WARN ' + m), error: m => W.logs.push('ERR ' + m) }

// ---------- events / commands ----------
let handlers, root
class EventExit extends Error {}
function node(n, type) {
  return { n, type, ch: [], req: null, then(c) { this.ch.push(c); return this }, requires(f) { this.req = f; return this },
    executes(f) { this.f = f; return this }, suggests(f) { this.sug = f; return this } }
}
function load(opts) {
  opts = opts || {}
  handlers = { loggedIn: [], loggedOut: [], respawned: [], decorateChat: [], chat: [] }
  const PlayerEvents = {}
  Object.keys(handlers).forEach(k => { PlayerEvents[k] = f => handlers[k].push(f) })
  const event = { commands: { literal: n => node(n, 'lit'), argument: (n, t) => node(n, t) },
    arguments: { PLAYER: { create: () => 'player', getResult: (ctx, n) => ctx.args[n] } }, register: r => { root = r } }
  const ServerEvents = { commandRegistry: f => f(event) }
  const run = src => new Function('PlayerEvents', 'ServerEvents', 'Utils', 'Text', 'console', 'global', 'Java', src)(
    PlayerEvents, ServerEvents, Utils, Text, console2, global, Java)
  if (!opts.skipConfig) run(opts.configSrc || CONFIG_SRC)
  run(CORE_SRC)
}
const global = {}

function cmd(p, line) {
  const toks = line.replace(/^\//, '').split(' ')
  const source = { getPlayer: () => p, hasPermission: n => p ? p.op : true, sendSystemMessage: c => (p ? p.inbox : W.console = W.console || []).push(textOf(c)), server }
  if (toks[0] != root.n) return 'unknown'
  let n = root, args = {}
  for (let i = 1; i < toks.length; i++) {
    let lit = n.ch.find(c => c.type == 'lit' && c.n == toks[i])
    if (lit) { if (lit.req && !lit.req(source)) return 'unknown'; n = lit; continue }
    let arg = n.ch.find(c => c.type != 'lit')
    if (!arg) return 'unknown'
    if (arg.type == 'greedy') { args[arg.n] = toks.slice(i).join(' '); n = arg; break }
    if (arg.type == 'player') { args[arg.n] = players.find(x => x.name.toLowerCase() == toks[i].toLowerCase()); if (!args[arg.n]) return 'no player' }
    else args[arg.n] = toks[i]
    n = arg
  }
  if (!n.f) return 'incomplete'
  return n.f({ source, args })
}
function fire(name, ev) {
  for (const h of handlers[name]) {
    try { h(ev) } catch (e) { if (e instanceof EventExit) { ev.cancelled = true; return } throw e }
  }
}
function chat(p, text) {
  const dec = { player: p, comp: C(JSON.stringify({ text })), getComponent() { return this.comp }, setComponent(c) { this.comp = c } }
  fire('decorateChat', dec)
  const ev = { player: p, getComponent: () => dec.comp, getMessage: () => text, cancel() { throw new EventExit() } }
  fire('chat', ev)
  return { shown: textOf(dec.comp), cancelled: !!ev.cancelled }
}
const login = p => { players.push(p); fire('loggedIn', { player: p, server }) }
const logout = p => { fire('loggedOut', { player: p, server }); players.splice(players.indexOf(p), 1) }
const last = p => p.inbox[p.inbox.length - 1]
const clear = () => players.forEach(p => { p.inbox = []; p.packets = [] })

// ---------- go ----------
load()                       // server starting: Utils.server not ready yet
Utils.server = server
const alice = player('Alice', 'a-1', true), bob = player('Bob', 'b-2', false), carl = player('Carl', 'c-3', false), dana = player('Dana', 'd-4', false)
const evlog = []
const subscribe = () => ['joinedFaction', 'leftFaction', 'rankChanged', 'enteredDimension', 'leftDimension'].forEach(n =>
  global.Factions.on(n, function () { evlog.push(n + '(' + Array.prototype.slice.call(arguments, 1).map(x => x === null ? 'null' : x).join(',') + ')') }))
subscribe()
;[alice, bob, carl, dana].forEach(login)
ok('login fires enteredDimension(null -> overworld)', evlog.filter(e => e == 'enteredDimension(unregistered,null,minecraft:overworld,login)').length == 4, evlog[0])
ok('new players are unregistered', global.Factions.getFaction(bob) == 'unregistered' && global.Factions.getRank(bob) == 'Citizen')
ok('ops not warned about config; warned that the startup hook is missing', !alice.inbox.some(l => /has problems/.test(l)) && alice.inbox.some(l => /factions_hooks.js is not active/.test(l)))
clear(); evlog.length = 0

ok('non-op cannot use /faction set', cmd(bob, '/faction set Bob ministry') == 'unknown')
cmd(alice, '/faction set Bob ministry Enforcer')
ok('admin set: Bob is Enforcer of the Ministry', global.Factions.getFaction(bob) == 'ministry' && global.Factions.getRank(bob) == 'Enforcer')
ok('Bob gets a private title + welcome', bob.packets.some(p => p.kind == 'title' && p.text == 'MINISTRY') && bob.inbox.some(l => /Welcome, Loyalist/.test(l)))
ok('nobody else is told', carl.inbox.length == 0 && dana.inbox.length == 0)
ok('joinedFaction fired', evlog.join() == 'joinedFaction(unregistered,ministry)', evlog.join())
ok('saved by UUID in persistentData["factions"]', JSON.parse(persistent.factions).players['b-2'].f == 'ministry')
cmd(alice, '/faction set Dana syndicate Cell Leader')
ok('greedy rank with a space: Dana is Cell Leader', global.Factions.getRank(dana) == 'Cell Leader')
ok('Dana gets the [SIGNAL HIJACKED] welcome privately', dana.inbox.some(l => /^\[SIGNAL HIJACKED\] You were never here/.test(l)) && !bob.inbox.some(l => /Dana|SIGNAL|Syndicate/.test(l)) && !carl.inbox.some(l => /Dana|SIGNAL|Syndicate/.test(l)))
clear(); evlog.length = 0

// ----- invites -----
cmd(bob, '/faction invite Carl')
const replyEligible = last(bob)
ok('Ministry invite reaches Carl, naming Bob, with buttons', carl.inbox.some(l => /citizenship processing by Bob/.test(l)) && carl.inbox.some(l => /\[Accept\]/.test(l)))
cmd(bob, '/faction invite Dana')
ok('Ministry -> Syndicate member: same reply, Dana gets nothing', last(bob) == replyEligible && dana.inbox.length == 0, last(bob))
cmd(dana, '/faction invite Bob')
const danaReplyIneligible = last(dana)
cmd(dana, '/faction invite Carl')
ok('Syndicate invite: same reply eligible or not; Bob gets nothing', last(dana) == danaReplyIneligible && !bob.inbox.some(l => /watching|SIGNAL/.test(l)))
ok('Syndicate invite to Carl is anonymous', carl.inbox.some(l => /^\[SIGNAL HIJACKED\] Someone has been watching you/.test(l)) && !carl.inbox.some(l => /Dana/.test(l)))
ok('Unregistered Carl cannot invite', (cmd(carl, '/faction invite Bob'), /not authorised/.test(last(carl))))
cmd(carl, '/faction accept')
ok('two invites: accept asks which', /more than one invitation/.test(last(carl)), last(carl))
clear(); evlog.length = 0
cmd(carl, '/faction accept syndicate')
ok('Carl joins the Syndicate as Sympathizer', global.Factions.getFaction(carl) == 'syndicate' && global.Factions.getRank(carl) == 'Sympathizer')
ok('Dana (inviter) is told; Bob and Alice are not', dana.inbox.some(l => /Carl has accepted/.test(l)) && bob.inbox.length == 0 && alice.inbox.length == 0)
ok('accepting clears the other invite', (cmd(carl, '/faction accept ministry'), /no pending/.test(last(carl))))

// ----- info / me -----
clear()
cmd(bob, '/faction info'); cmd(carl, '/faction info')
ok('/faction info: Bob (not a member) also reads the listed Syndicate, with its info', bob.inbox.some(l => /Techno's Crownsworn/.test(l)) && bob.inbox.some(l => /Unregistered Citizens/.test(l)) && bob.inbox.some(l => /The Blood God's Syndicate/.test(l)) && bob.inbox.some(l => /There is no Syndicate/.test(l)))
ok('... but nothing in it says who is a member', !bob.inbox.some(l => /Carl/.test(l)))
ok('/faction info: Carl also sees the Syndicate', carl.inbox.some(l => /The Blood God's Syndicate/.test(l)))
cmd(carl, '/faction me')
ok('/faction me is private and marks it secret', /Sympathizer of the The Blood God's Syndicate \(secret/.test(last(carl)) && !bob.inbox.some(l => /Sympathizer/.test(l)))

// ----- chat -----
let r = chat(bob, 'hello')
ok('Ministry public prefix in chat', r.shown == '[Enforcer] hello' && !r.cancelled, r.shown)
r = chat(carl, 'oink')
ok('Syndicate member chat looks like an unregistered player', r.shown == 'oink' && !r.cancelled, r.shown)
clear()
cmd(carl, '/faction chat meet at the pigpen')
ok('Syndicate faction chat: only Carl and Dana', carl.inbox.length == 1 && dana.inbox.length == 1 && bob.inbox.length == 0 && alice.inbox.length == 0 && /\[ENCRYPTED\] \[Sympathizer\] Carl: meet/.test(dana.inbox[0]), dana.inbox[0])
cmd(bob, '/faction chat paperwork')
ok('Ministry faction chat: only Bob', bob.inbox.length == 1 && carl.inbox.length == 1 && /MINISTRY CHANNEL/.test(bob.inbox[0]))

// ----- admin views -----
clear()
cmd(alice, '/faction whois Carl')
ok('whois shows secret membership to admin', /Carl: The Blood God's Syndicate - Sympathizer \[SECRET\]/.test(last(alice)), last(alice))
cmd(alice, '/faction list')
ok('list includes secret members', alice.inbox.some(l => /The Blood God's Syndicate \[SECRET\] \(2\)/.test(l)) && alice.inbox.some(l => /Cell Leader: Dana/.test(l)))
ok('non-op cannot whois/list', cmd(bob, '/faction whois Carl') == 'unknown' && cmd(bob, '/faction list') == 'unknown')
ok('accept suggestions only show your own invites', (() => { const s = []; root.ch.find(c => c.n == 'accept').ch[0].sug({ source: { getPlayer: () => bob } }, { suggest: x => s.push(x), buildFuture: () => 0 }); return s.length == 0 })())

// ----- API -----
ok('hasRankAtLeast', global.Factions.hasRankAtLeast(bob, 'Loyalist') && !global.Factions.hasRankAtLeast(bob, 'Minister') && !global.Factions.hasRankAtLeast(bob, 'Operative') && global.Factions.hasRankAtLeast(dana, 'cell_leader'))
ok('visibleFaction hides the Syndicate from Bob, not from Dana/Alice/Carl', global.Factions.visibleFaction(bob, carl) == 'unregistered' && global.Factions.visibleFaction(dana, carl) == 'syndicate' && global.Factions.visibleFaction(alice, carl) == 'syndicate' && global.Factions.visibleFaction(carl, carl) == 'syndicate')
ok('getMembers', global.Factions.getMembers('syndicate').map(m => m.name).sort().join() == 'Carl,Dana')
evlog.length = 0
cmd(alice, '/faction set Bob syndicate')
ok('cross-faction move fires leftFaction then joinedFaction', evlog.join(' ') == 'leftFaction(ministry) joinedFaction(ministry,syndicate)', evlog.join(' '))
evlog.length = 0
cmd(alice, '/faction rank Bob Operative')
ok('rankChanged fired', evlog.join() == 'rankChanged(Sympathizer,Operative)', evlog.join())
ok('API setFaction validates', global.Factions.setFaction(bob, 'nope').ok === false && global.Factions.setFaction(bob, 'ministry', 'Overlord').ok === false)
global.Factions.setFaction(bob, 'ministry', 'Loyalist')
ok('API setFaction works', global.Factions.getRank(bob) == 'Loyalist')
let threw = global.Factions.on('rankChanged', () => { throw new Error('boom') })
global.Factions.setFaction(bob, 'ministry', 'Recruit')
ok('a throwing listener is logged and the change still happens', global.Factions.getRank(bob) == 'Recruit' && W.logs.some(l => /"rankChanged" listener failed: Error: boom/.test(l)))
threw()

// ----- leaving -----
clear()
cmd(carl, '/faction leave')
ok('leaving the Syndicate: Carl told privately, nobody else', global.Factions.getFaction(carl) == 'unregistered' && /Connection terminated/.test(last(carl)) && bob.inbox.length == 0 && dana.inbox.length == 0 && alice.inbox.length == 0)
cmd(bob, '/faction leave')
ok('leaving the Ministry: desertion notice to everyone', global.Factions.getFaction(bob) == 'unregistered' && [alice, carl, dana].every(p => p.inbox.some(l => /NOTICE OF DESERTION: Bob/.test(l))))
ok('no tellraw (or any broadcast command) used', !W.cmds.some(c => /tellraw|^say |title @a/.test(c)), W.cmds.filter(c => !/playsound/.test(c)).join(' | '))

// ----- dimensions -----
evlog.length = 0
dana.dim = 'minecraft:the_nether'
global.factionsHooks.onChangedDimension({ getEntity: () => dana, getFrom: () => ({ location: () => 'minecraft:overworld' }), getTo: () => ({ location: () => 'minecraft:the_nether' }) })
ok('portal trip: leftDimension then enteredDimension', evlog.join(' ') == 'leftDimension(syndicate,minecraft:overworld,travel) enteredDimension(syndicate,minecraft:overworld,minecraft:the_nether,travel)', evlog.join(' '))
evlog.length = 0
global.factionsHooks.onChangedDimension({ getEntity: () => dana, getFrom: () => 'ResourceKey[minecraft:dimension / minecraft:the_nether]', getTo: () => 'ResourceKey[minecraft:dimension / minecraft:the_end]' })
ok('works with ResourceKey toString too', /enteredDimension\(syndicate,minecraft:the_nether,minecraft:the_end,travel\)/.test(evlog.join()), evlog.join())
evlog.length = 0
dana.dim = 'minecraft:overworld'
fire('respawned', { player: dana })
ok('respawn in another dimension fires both', evlog.join(' ') == 'leftDimension(syndicate,minecraft:the_end,respawn) enteredDimension(syndicate,minecraft:the_end,minecraft:overworld,respawn)', evlog.join(' '))
evlog.length = 0
fire('respawned', { player: dana })
ok('respawn in the same dimension fires nothing', evlog.length == 0)
logout(dana)
ok('logout fires leftDimension', evlog.join() == 'leftDimension(syndicate,minecraft:overworld,logout)', evlog.join())

// ----- /reload -----
cmd(alice, '/faction invite Carl')   // Alice isn't in a faction: refused
cmd(alice, '/faction set Alice ministry Minister'); cmd(alice, '/faction invite Carl')
const before = persistent.factions
load()
evlog.length = 0
ok('/reload: data kept', persistent.factions == before && global.Factions.getFaction(alice) == 'ministry' && global.Factions.getMembers('syndicate').some(m => m.name == 'Dana'))
ok('/reload: pending invite kept', (cmd(carl, '/faction accept'), global.Factions.getFaction(carl) == 'ministry'))
ok('/reload: old listeners are gone', evlog.length == 0)

// ----- config errors -----
W.logs = []
load({ skipConfig: true })
ok('config skipped on /reload (syntax error): logged, last valid kept', W.logs.some(l => /did not run on this \/reload/.test(l) && /last working config/.test(l)) && global.Factions.getFactionIds().join() == 'ministry,syndicate,unregistered')
ok('online ops are told', alice.inbox.some(l => /\[Factions\] factions_config.js did not run/.test(l)))
W.logs = []
load({ configSrc: CONFIG_SRC.replace("color: 'gold',", "color: 'golden',") })
ok('invalid config: errors listed, last valid kept', W.logs.some(l => /colour name/.test(l)) && global.Factions.getFactionInfo('ministry').color == 'gold')
load({ configSrc: CONFIG_SRC.replace("displayName: \"Techno's Crownsworn\"", "displayName: 'Ministry of Silly Walks'") })
ok('a fixed config is picked up', global.Factions.getFactionInfo('ministry').displayName == 'Ministry of Silly Walks')
const savedState = global.factionsState
delete global.factionsState; delete global.FactionsConfigSource
W.logs = []
load({ skipConfig: true })
ok('fresh start with a broken config: built-in defaults', W.logs.some(l => /built-in defaults/.test(l)) && global.Factions.getFactionIds().join() == 'ministry,syndicate,unregistered')
global.factionsState = savedState
load({ configSrc: CONFIG_SRC.replace(/\{\s*id: 'syndicate'[\s\S]*?\n    \},\n/, '') })
ok('faction removed from config: members read as unregistered, data kept', global.Factions.getFaction(dana) == 'unregistered' && JSON.parse(persistent.factions).players['d-4'].f == 'syndicate')
load()
ok('faction back in config: members restored', global.Factions.getFaction(dana) == 'syndicate')

// ----- corrupt data -----
persistent.factions = '{not json'
load()
global.Factions.getFaction(bob)
ok('unreadable data is backed up, not lost', Object.keys(persistent).some(k => /^factions_unreadable_/.test(k) && persistent[k] == '{not json') && W.logs.some(l => /could not be read/.test(l)))
persistent.factions = before; load()

// ----- secret prefix mode -----
login(dana)
load({ configSrc: CONFIG_SRC.replace('SECRET_PREFIX_FOR_MEMBERS: false', 'SECRET_PREFIX_FOR_MEMBERS: true') })
clear()
r = chat(dana, 'viva la swine')
ok('private prefix mode: Dana\'s chat is cancelled and re-sent', r.cancelled)
ok('Syndicate viewers see the prefix before the name, others do not', dana.inbox[0] == '[Cell Leader] <Dana> viva la swine' && bob.inbox[0] == '<Dana> viva la swine' && alice.inbox[0] == '<Dana> viva la swine', JSON.stringify([dana.inbox[0], bob.inbox[0]]))
r = chat(alice, 'order!')
ok('private prefix mode leaves other chat alone', !r.cancelled && r.shown == '[Minister] order!', r.shown)
load()

// ----- prefix in front of the name (display name, NameFormat hook) -----
global.factionsNameHookInstalled = 1
players.forEach(p => { p._dn = null })
cmd(alice, '/faction set Bob ministry Enforcer')
let dn = bob.getDisplayName()
ok('Crownsworn display name: gold "[Enforcer] " in front', textOf(dn) == '[Enforcer] Bob' && colorOf(dn, '[Enforcer] ') == 'gold', textOf(dn) + ' ' + colorOf(dn, '[Enforcer] '))
r = chat(bob, 'hi')
ok('chat message itself is left alone (the name carries the prefix)', r.shown == 'hi', r.shown)
ok('Syndicate member: no prefix on the name', textOf(dana.getDisplayName()) == 'Dana')
const before2 = bob.refreshes
cmd(alice, '/faction rank Bob Loyalist')
ok('rank change refreshes the name at once', bob.refreshes > before2 && textOf(bob.getDisplayName()) == '[Loyalist] Bob', textOf(bob.getDisplayName()))
bob.nick = 'Sir Bob'; bob.refreshDisplayName()
ok('works with an FTB Essentials nickname', textOf(bob.getDisplayName()) == '[Loyalist] Sir Bob')
cmd(alice, '/faction remove Bob')
ok('leaving the faction removes the prefix', textOf(bob.getDisplayName()) == 'Sir Bob', textOf(bob.getDisplayName()))
bob.nick = null
const before3 = carl.refreshes
load()
ok('/reload refreshes everyone online', carl.refreshes > before3)
load({ configSrc: CONFIG_SRC.replace('SHOW_PUBLIC_PREFIX: true', 'SHOW_PUBLIC_PREFIX: false') })
cmd(alice, '/faction set Bob ministry Enforcer')
ok('SHOW_PUBLIC_PREFIX false: no prefix', textOf(bob.getDisplayName()) == 'Bob')
load()
delete global.factionsNameHookInstalled
players.forEach(p => { p._dn = null })
r = chat(bob, 'fallback')
ok('without the name hook: prefix falls back into the message, still gold', r.shown == '[Enforcer] fallback' && textOf(bob.getDisplayName()) == 'Bob', r.shown)

// ----- coloured fallback when Minecraft's text reader fails -----
W.breakJson = true
clear()
cmd(bob, '/faction me')
const meLine = bob.inbox[bob.inbox.length - 1]
ok('fallback text still reads right', /You are a Enforcer of the Techno's Crownsworn/.test(meLine) || /Enforcer/.test(meLine), meLine)
let fb = null
bob.tell = c => { fb = c; bob.inbox.push(textOf(c)) }
cmd(alice, '/faction rank Bob Minister')
ok('fallback keeps colours (gold bold [MINISTRY] tag)', fb && colorOf(fb, '[MINISTRY]') == 'gold' && fb.segs[1].bold === true, fb && JSON.stringify(fb.segs))
ok('reader failure logged once', W.logs.filter(l => /Text error/.test(l)).length == 1)
W.breakJson = false

// ----- an unlisted secret faction (listed: false): hidden from non-members, shown to members and ops -----
load({ configSrc: CONFIG_SRC.replace('listed: true,', 'listed: false,') })
clear()
cmd(bob, '/faction info'); cmd(alice, '/faction info')
ok('listed: false hides the Syndicate from a non-member', !bob.inbox.some(l => /Syndicate/.test(l)) && bob.inbox.some(l => /Techno's Crownsworn/.test(l)))
ok('... an op still sees it', alice.inbox.some(l => /The Blood God's Syndicate/.test(l)))
load({ configSrc: CONFIG_SRC.replace('listed: true,', 'listed: "yes",') })
ok('a listed value that isn\'t true/false is reported', W.logs.some(l => /listed must be true or false/.test(l)))

// ----- leak sweep: Bob (never Syndicate-aware except when he was in it) -----
console.log(W.logs.filter(l => /ERR/.test(l) && !/factions_config|built-in|listener failed|could not be read/.test(l)).join('\n') || '(no unexpected errors)')
console.log(fails ? fails + ' FAILED' : 'ALL PASSED')
