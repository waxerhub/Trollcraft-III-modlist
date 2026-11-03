// Run with: node tools/tests/run_all.js disguise   (or node tools/tests/suites/disguise.test.js)
const REPO_ROOT = require('path').resolve(__dirname, '..', '..', '..')
const fs = require('fs')
const R = REPO_ROOT + '/tools/kubejs/server_scripts/'
const W = { tick: 0, q: [], sent: [], logs: [], sys: [], discord: [], persistent: {} }
const global = {}
let mojang = { technoblade: { id: 'b876ec32-e396-476b-a115-8438d83c67d4', name: 'Technoblade' }, sipheon: { id: 'real-sip-uuid', name: 'Sipheon' } }
function Profile(id, name) { this.id = id; this.name = name; this.props = {} }
Profile.prototype.getId = function () { return this.id }
Profile.prototype.getName = function () { return this.name }
Profile.prototype.getProperties = function () { const p = this.props; return { containsKey: k => k in p, _p: p } }
function Buf(size) { this.ops = [] }
Buf.prototype.writerIndex = function () {}
;['writeByte', 'writeVarInt', 'writeUUID', 'writeUtf', 'writeGameProfileProperties', 'writeBoolean'].forEach(m => { Buf.prototype[m] = function () { this.ops.push([m].concat([].slice.call(arguments))); return this } })
const classes = {
  'net.minecraft.network.protocol.game.ClientboundPlayerInfoUpdatePacket': function (buf) { this.kind = 'add'; this.ops = buf.ops },
  'net.minecraft.network.protocol.game.ClientboundPlayerInfoRemovePacket': function (l) { this.kind = 'remove'; this.uuids = l.arr },
  'net.minecraft.network.protocol.game.ClientboundChunksBiomesPacket$ChunkBiomeData': function (pos, data) { this.getReadBuffer = () => new Buf(data.length) },
  'net.minecraft.world.level.ChunkPos': function () {},
  'net.minecraft.core.UUIDUtil': { createOfflinePlayerUUID: n => 'offline-' + n.toLowerCase() },
  'com.mojang.authlib.GameProfile': Profile,
  'java.util.Base64': { getDecoder: () => ({ decode: s => ({ length: s.length / 4 * 3 }) }) },
  'java.util.ArrayList': function () { this.arr = []; this.add = x => this.arr.push(x); this.size = () => this.arr.length },
  'net.minecraft.world.level.block.entity.SkullBlockEntity': { updateGameprofile: (p, cb) => { const m = mojang[p.getName().toLowerCase()]
    W.q.push([W.tick + 5, () => { if (m) { const r = new Profile(m.id, m.name); r.props.textures = 'skin-of-' + m.name; cb(r) } else cb(p) }]) } },
  'net.minecraft.network.chat.Component$Serializer': { fromJsonLenient: j => ({ json: j }) },
  'net.minecraft.network.protocol.game.ClientboundRemoveEntitiesPacket': function (id) { this.kind = 'rmEntity'; this.id = id },
  'net.minecraft.network.protocol.game.ClientboundAddPlayerPacket': function (p) { this.kind = 'addPlayerEntity'; this.id = p.getId() },
  'net.minecraft.network.protocol.game.ClientboundSetEntityDataPacket': function (id, d) { this.kind = 'entityData'; this.id = id },
  'net.minecraft.network.protocol.game.ClientboundSetEquipmentPacket': function (id, l) { this.kind = 'equipment'; this.id = id; this.items = l.arr },
  'net.minecraft.world.entity.EquipmentSlot': { values: () => ['MAINHAND', 'HEAD'] },
  'com.mojang.datafixers.util.Pair': { of: (a, b) => [a, b] },
  'com.hypherionmc.sdlink.core.discord.BotController': { INSTANCE: { isBotReady: () => true } },
  'com.hypherionmc.sdlink.api.accounts.DiscordAuthor': { of: function (d, u, n) { const a = { setPlayerName(x) { a.name = x; return a }, setPlayerAvatar(x, y) { a.avatar = y; return a } }; return a }, getServer: () => { const a = { setPlayerName(n) { a.name = n; return a }, setPlayerAvatar(n, u) { a.avatar = u; return a } }; return a } },
  'com.hypherionmc.sdlink.api.messaging.discord.DiscordMessageBuilder': function (type) { const b = this; b.type = type; b.message = m => { b.msg = m; return b }; b.author = a => { b.auth = a; return b }; b.build = () => ({ sendMessage: () => W.discord.push(b) }) },
  'com.hypherionmc.sdlink.api.messaging.MessageType': { JOIN: 'JOIN', LEAVE: 'LEAVE', CHAT: 'CHAT' },
  'com.mojang.brigadier.arguments.StringArgumentType': { word: () => 'word', greedyString: () => 'greedy', getString: (ctx, n) => ctx.args[n] },
}
const Java = { loadClass: n => { if (!classes[n]) throw new Error('no class ' + n); return classes[n] } }
let eid = 100
function player(name, uuid, op, x) {
  const prof = new Profile('J-' + uuid, name); prof.props.textures = 'own-skin-' + name
  const p = { name, uuid, op: !!op, x: x || 0, z: 0, dim: 'minecraft:overworld', id: eid++, inbox: [], refreshed: 0,
    getGameProfile: () => prof, getStringUuid: () => uuid, getId() { return this.id }, hasPermissions() { return this.op }, isPlayer: () => true,
    get level() { return { dimension: p.dim } }, gameMode: { getGameModeForPlayer: () => ({ getId: () => 0 }) }, latency: 42,
    getEntityData: () => ({ getNonDefaultValues: () => ['data'] }), getItemBySlot: s => s == 'HEAD' ? { isEmpty: () => false, copy: () => 'helmet' } : { isEmpty: () => true },
    refreshDisplayName() { this.refreshed++ }, refreshTabListName() {}, tell(c) { this.inbox.push(c.json || String(c)) },
    connection: { send: pk => W.sent.push({ to: name, pk }) } }
  return p
}
const players = []
const server = { get players() { return { size: () => players.length, get: i => players[i] } },
  getPlayerList: () => ({ broadcastAll: pk => W.sent.push({ to: '@a', pk }), broadcastSystemMessage: c => W.sys.push(c.json), getViewDistance: () => 10 }),
  persistentData: { getString: k => W.persistent[k] || '', putString: (k, v) => { W.persistent[k] = v } },
  runCommandSilent: c => 1, scheduleInTicks: (n, f) => W.q.push([W.tick + n, f]) }
const Utils = { server }
let handlers = {}, nodes = {}
function node(n, t) { return { n, t, ch: [], then(c) { this.ch.push(c); return this }, requires(f) { this.req = f; return this }, executes(f) { this.f = f; return this }, suggests() { return this } } }
function load(file) {
  const on = k => f => { (handlers[k] = handlers[k] || []).push(f) }
  const ev = { commands: { literal: n => node(n, 'lit'), argument: (n, t) => node(n, t) }, register: r => { nodes[r.n] = r } }
  new Function('PlayerEvents', 'ServerEvents', 'Text', 'console', 'global', 'Java', 'Utils', fs.readFileSync(R + file, 'utf8'))(
    { loggedIn: on('loggedIn'), chat: on('chat') }, { commandRegistry: f => f(ev), loaded: on('loaded') }, { of: t => ({ text: t }), translate: () => ({ yellow: () => 'Y' }) },
    { error: m => W.logs.push('ERR ' + m), warn: m => W.logs.push('WARN ' + m), info: m => W.logs.push(m) }, global, Java, Utils)
}
function loadAll() { handlers = {}; nodes = {}; load('disguise.js'); load('fake_players.js') }
loadAll()
class Exit extends Error {}
function fire(k, ev) { for (const h of handlers[k] || []) { try { h(ev) } catch (e) { if (e instanceof Exit) { ev.cancelled = true; return } throw e } } }
const replies = []
function cmd(line, as) {
  const t = line.split(' '); let n = nodes[t[0]], args = {}
  const src = { server, getPlayer: () => as, hasPermission: () => as.op, sendSystemMessage: c => replies.push(c.json) }
  if (n.req && !n.req(src)) { replies.push('DENIED'); return 0 }
  for (let i = 1; i < t.length; i++) { let l = n.ch.find(c => c.t == 'lit' && c.n == t[i]); if (l) { n = l; continue } let a = n.ch.find(c => c.t != 'lit'); args[a.n] = t[i]; n = a }
  return n.f({ args, source: src })
}
function advance(n) { for (let i = 0; i < n; i++) { W.tick++; const d = W.q.filter(x => x[0] <= W.tick); W.q = W.q.filter(x => x[0] > W.tick); d.forEach(x => x[1]()) } }
let fails = 0
const ok = (l, c, e) => { console.log((c ? 'ok   ' : 'FAIL ') + l + (e !== undefined && !c ? '  ' + e : '')); if (!c) fails++ }
const flat = j => { try { const o = JSON.parse(j); return (Array.isArray(o) ? o : [o]).map(x => typeof x == 'string' ? x : (x.text || x.translate || '') + (x.with ? ' ' + x.with.map(w => typeof w == 'string' ? w : w.text).join(' ') : '')).join('') } catch (e) { return String(j) } }
const last = () => flat(replies[replies.length - 1])
const sentTo = (who, from) => W.sent.slice(from).filter(s => s.to == who).map(s => s.pk)

const admin = player('Sipheon', 'sip', true, 0), bob = player('Bob', 'bob', false, 20), far = player('Far', 'far', false, 5000), carl = player('Carl', 'carl', false, 30)
carl.dim = 'minecraft:the_nether'
players.push(admin, bob, far, carl)

// ----- putting it on -----
cmd('disguise Technoblade', bob); ok('/disguise is op-only', replies[replies.length - 1] == 'DENIED')
let s0 = W.sent.length, y0 = W.sys.length, d0 = W.discord.length
cmd('disguise Technoblade', admin)
ok('nothing until Mojang answers the skin lookup', W.sent.length == s0)
advance(6)
ok('reply: disguised with the skin', /appear to everyone else as Technoblade with Technoblade's skin/.test(last()), last())
const toBob = sentTo('Bob', s0)
ok('Bob gets: info remove, info add (same UUID, new name, skin), then the body re-sent (remove, add, data, equipment)',
  toBob.map(k => k.kind).join(',') == 'remove,add,rmEntity,addPlayerEntity,entityData,equipment' &&
  toBob[0].uuids[0] == 'J-sip' && toBob[1].ops[2][1] == 'J-sip' && toBob[1].ops[3][1] == 'Technoblade' && toBob[1].ops[4][1]._p.textures == 'skin-of-Technoblade' &&
  toBob[5].items[0][1] == 'helmet', toBob.map(k => k.kind).join(','))
ok('Far (out of range) and Carl (other dimension) get the new profile, but no body re-send', sentTo('Far', s0).map(k => k.kind).join(',') == 'remove,add' && sentTo('Carl', s0).map(k => k.kind).join(',') == 'remove,add')
ok('nothing is sent to the disguised player', sentTo('Sipheon', s0).length == 0)
const ann = W.sys.slice(y0).map(j => JSON.parse(j))
ok('everyone sees "Sipheon left", then "Technoblade joined"', ann.length == 2 && ann[0].translate == 'multiplayer.player.left' && ann[0].with[0].text == 'Sipheon' &&
  ann[1].translate == 'multiplayer.player.joined' && ann[1].with[0].text == 'Technoblade' && ann[1].with[0].hoverEvent.contents.id == 'b876ec32-e396-476b-a115-8438d83c67d4')
const dc = W.discord.slice(d0)
ok('Discord: LEAVE for Sipheon, JOIN for Technoblade (with Technoblade\'s avatar)', dc.length == 2 && dc[0].type == 'LEAVE' && /Sipheon/.test(dc[0].msg) && dc[1].type == 'JOIN' && /Technoblade/.test(dc[1].msg) && dc[1].auth.avatar == 'b876ec32-e396-476b-a115-8438d83c67d4')
ok('the display name is refreshed', admin.refreshed >= 1)
// name hook
let set = null
global.disguiseHooks.onNameFormat({ getEntity: () => admin, setDisplayname: c => { set = c } })
ok('the name hook sets the display name to the disguise', set && JSON.parse(set.json).text == 'Technoblade')
set = null; global.disguiseHooks.onNameFormat({ getEntity: () => bob, setDisplayname: c => { set = c } })
ok('... and leaves everyone else alone', set == null)
ok('API: isDisguised / publicName', global.Disguise.isDisguised(admin) && !global.Disguise.isDisguised(bob) && global.Disguise.publicName(admin) == 'Technoblade' && global.Disguise.publicName(bob) == 'Bob')

// ----- chat -----
y0 = W.sys.length; d0 = W.discord.length
const chat = { player: admin, message: 'Technoblade never dies', server, cancel() { throw new Exit() } }
fire('chat', chat)
ok('chat while disguised: original cancelled, re-sent as <Technoblade>, posted to Discord as Technoblade', chat.cancelled && JSON.parse(W.sys[y0]).with[0].text == 'Technoblade' &&
  W.discord[d0].type == 'CHAT' && W.discord[d0].msg == 'Technoblade never dies' && W.discord[d0].auth.name == 'Technoblade' && W.discord[d0].auth.avatar == 'b876ec32-e396-476b-a115-8438d83c67d4')
ok('the console keeps the real name', W.logs.some(l => /<Technoblade \(Sipheon\)> Technoblade never dies/.test(l)))
const chat2 = { player: bob, message: 'hi', server, cancel() { throw new Exit() } }
fire('chat', chat2); ok('other players\' chat is untouched', !chat2.cancelled)

// ----- list, names, late joiner -----
cmd('disguise list', admin); ok('/disguise list shows the real name', /Sipheon appears as Technoblade \(skin: Technoblade\)/.test(last()), last())
cmd('disguise Bob', admin); advance(6); ok('can\'t use the name of someone online', /Bob is online right now/.test(last()), last())
cmd('disguise bad-name!', admin); advance(6); ok('bad names refused', /1-16 letters/.test(last()))
const dave = player('Dave', 'dave', false, 10); players.push(dave)
s0 = W.sent.length
fire('loggedIn', { player: dave, server }); advance(25)
ok('a late joiner gets the disguised profile and the body', sentTo('Dave', s0).map(k => k.kind).join(',') == 'remove,add,rmEntity,addPlayerEntity,entityData,equipment' && sentTo('Dave', s0)[1].ops[3][1] == 'Technoblade')

// ----- a different skin, then switching -----
y0 = W.sys.length
cmd('disguise Ghost Sipheon', admin); advance(6)
ok('a made-up name with another account\'s skin', /as Ghost with Sipheon's skin/.test(last()), last())
const ann2 = W.sys.slice(y0).map(j => JSON.parse(j))
ok('switching: "Technoblade left", "Ghost joined"', ann2.length == 2 && ann2[0].with[0].text == 'Technoblade' && ann2[1].with[0].text == 'Ghost')
cmd('disguise Nobody_Here', admin); advance(6)
const nb = W.sent.filter(s => s.to == 'Bob' && s.pk.kind == 'add').pop()
ok('no such account: default skin (no skin properties), same UUID', /default skin/.test(last()) && nb.pk.ops[2][1] == 'J-sip' && nb.pk.ops[3][1] == 'Nobody_Here' && nb.pk.ops[4][0] == 'writeVarInt' && nb.pk.ops[4][1] == 0, last())

// ----- persistence -----
loadAll()
ok('/reload keeps the disguise', global.Disguise.isDisguised(admin) && global.Disguise.publicName(admin) == 'Nobody_Here')

// ----- the real owner logs in -----
cmd('disguise Technoblade', admin); advance(6)
const techno = player('Technoblade', 'techno', false, 40); players.push(techno)
y0 = W.sys.length; s0 = W.sent.length
fire('loggedIn', { player: techno, server }); advance(25)
ok('the real Technoblade logs in: the disguise ends quietly, the wearer and ops are told', !global.Disguise.isDisguised(admin) && /real Technoblade just logged in/.test(admin.inbox.join(' ')) && W.sys.length == y0)
ok('... everyone is shown Sipheon again (own profile and skin)', sentTo('Bob', s0).some(k => k.kind == 'add' && k.ops[3][1] == 'Sipheon' && k.ops[4][1]._p.textures == 'own-skin-Sipheon'))
players.splice(players.indexOf(techno), 1)

// ----- taking it off -----
cmd('disguise Technoblade', admin); advance(6)
y0 = W.sys.length; d0 = W.discord.length; s0 = W.sent.length
cmd('undisguise', admin)
const ann3 = W.sys.slice(y0).map(j => JSON.parse(j))
ok('/undisguise: "Technoblade left", "Sipheon joined", real profile back for everyone', !global.Disguise.isDisguised(admin) && ann3.length == 2 && ann3[0].with[0].text == 'Technoblade' && ann3[1].with[0].text == 'Sipheon' &&
  sentTo('Bob', s0).some(k => k.kind == 'add' && k.ops[3][1] == 'Sipheon') && W.discord.length == d0 + 2)
cmd('undisguise', admin); ok('/undisguise when not disguised', /aren't disguised/.test(last()))

console.log(W.logs.filter(l => /^ERR/.test(l)).join('\n') || '(no errors logged)')
console.log(fails ? fails + ' FAILED' : 'ALL PASSED')
