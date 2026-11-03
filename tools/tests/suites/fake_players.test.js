// Run with: node tools/tests/run_all.js fake_players   (or node tools/tests/suites/fake_players.test.js)
const REPO_ROOT = require('path').resolve(__dirname, '..', '..', '..')
const fs = require('fs')
const src = fs.readFileSync(REPO_ROOT + '/tools/kubejs/server_scripts/fake_players.js', 'utf8')
const W = { tick: 0, q: [], cmds: [], sent: [], logs: [], sys: [], discord: [] }
const global = {}
let skullCalls = 0, mojangDelay = 10, mojang = { notch: { id: '069a79f4-44e9-4726-a5be-fca90e38aaf5', name: 'Notch' } }
function Profile(id, name) { this.id = id; this.name = name; this.props = {} }
Profile.prototype.getId = function () { return this.id }
Profile.prototype.getName = function () { return this.name }
Profile.prototype.getProperties = function () { const p = this.props; return { containsKey: k => k in p, _p: p } }
function Buf(size) { this.cap = size; this.ops = []; this.w = size }
Buf.prototype.writerIndex = function (i) { this.w = i }
;['writeByte', 'writeVarInt', 'writeUUID', 'writeUtf', 'writeGameProfileProperties', 'writeBoolean'].forEach(m => {
  Buf.prototype[m] = function () { this.ops.push([m].concat([].slice.call(arguments))); return this } })
const classes = {
  'net.minecraft.network.protocol.game.ClientboundPlayerInfoUpdatePacket': function (buf) { this.kind = 'add'; this.ops = buf.ops },
  'net.minecraft.network.protocol.game.ClientboundPlayerInfoRemovePacket': function (l) { this.kind = 'remove'; this.uuids = l.arr },
  'net.minecraft.network.protocol.game.ClientboundChunksBiomesPacket$ChunkBiomeData': function (pos, data) { this.getReadBuffer = () => new Buf(data.length) },
  'net.minecraft.world.level.ChunkPos': function () {},
  'net.minecraft.core.UUIDUtil': { createOfflinePlayerUUID: n => 'offline-' + n.toLowerCase() },
  'com.mojang.authlib.GameProfile': Profile,
  'java.util.Base64': { getDecoder: () => ({ decode: s => { if (s.length % 4) throw new Error('bad b64'); return { length: s.length / 4 * 3 } } }) },
  'java.util.ArrayList': function () { this.arr = []; this.add = x => this.arr.push(x) },
  'net.minecraft.world.level.block.entity.SkullBlockEntity': { updateGameprofile: (p, cb) => { skullCalls++; const m = mojang[p.getName().toLowerCase()]
    W.q.push([W.tick + mojangDelay, () => { if (m) { const r = new Profile(m.id, m.name); r.props.textures = 'skin'; cb(r) } else cb(p) }]) } },
  'net.minecraft.network.chat.Component$Serializer': { fromJson: () => { throw new Error('InternalError: The choice of Java method ... fromJson matching JavaScript argument types (string) is ambiguous') }, fromJsonLenient: j => ({ json: j }) },
  'com.hypherionmc.sdlink.core.discord.BotController': { INSTANCE: { isBotReady: () => true } },
  'com.hypherionmc.sdlink.core.config.SDLinkConfig': { get INSTANCE() { throw new Error('has no public instance field or method named "INSTANCE"') }, _old: { chatConfig: { playerJoin: true, playerLeave: true }, messageFormatting: { playerJoined: '*%player% has joined the server!*', playerLeft: '*%player% has left the server!*' } } },
  'com.hypherionmc.sdlink.api.accounts.DiscordAuthor': { of: function (d, u, n) { if (arguments.length != 3) throw new Error('wrong overload'); const a = { of: [d, u, n], setPlayerName(x) { a.name = x; return a }, setPlayerAvatar(x, y) { a.avatar = y; return a } }; return a }, getServer: () => { const a = { setPlayerName(n) { a.name = n; return a }, setPlayerAvatar(n, u) { a.avatar = u; return a } }; return a } },
  'com.hypherionmc.sdlink.api.messaging.discord.DiscordMessageBuilder': function (type) { const b = this; b.type = type; b.message = m => { b.msg = m; return b }; b.author = a => { b.auth = a; return b }; b.build = () => ({ sendMessage: () => W.discord.push(b) }) },
  'com.hypherionmc.sdlink.api.messaging.MessageType': { JOIN: 'JOIN', LEAVE: 'LEAVE', CHAT: 'CHAT' },
  'com.mojang.brigadier.arguments.StringArgumentType': { word: () => 'word', greedyString: () => 'greedy', getString: (ctx, n) => n == 'message' ? ctx.message : ctx.name },
}
const Java = { loadClass: n => { if (!classes[n]) throw new Error('no class ' + n); return classes[n] } }
function player(name, uuid) { return { name, uuid, getGameProfile() { return { getName: () => this.name, getId: () => this.uuid } }, getUuid() { return this.uuid },
  connection: { send: pk => W.sent.push({ to: name, pk }) } } }
const players = [player('Admin', 'u-admin')]
const server = { players: { size: () => players.length, get: i => players[i] }, getPlayerList: () => ({ broadcastAll: pk => W.sent.push({ to: '@a', pk }), broadcastSystemMessage: (c, o) => W.sys.push(c.json) }),
  runCommandSilent: c => { W.cmds.push(c); return 1 }, scheduleInTicks: (n, f) => W.q.push([W.tick + n, f]) }
const nodes = {}
function node(n) { return { n, ch: [], then(c) { this.ch.push(c); return this }, requires() { return this }, executes(f) { this.f = f; return this }, suggests(f) { this.sug = f; return this } } }
const event = { commands: { literal: node, argument: node }, register: r => { nodes[r.n] = r } }
let login
const Utils = { server: null }
new Function('PlayerEvents', 'ServerEvents', 'Text', 'console', 'global', 'Java', 'Utils', src)(
  { loggedIn: f => { login = f } }, { commandRegistry: f => f(event) }, { red: t => 'RED ' + t, yellow: t => t, of: t => 'PLAIN ' + t },
  { error: m => W.logs.push('ERR ' + m), warn: m => W.logs.push('WARN ' + m), info: m => W.logs.push(m) }, global, Java, Utils)
const replies = []
const ctx = name => ({ name, source: { server, sendSystemMessage: m => replies.push(m) } })
const run = (c, name) => (name == null ? nodes[c] : nodes[c].ch[0]).f(ctx(name))
function advance(n) { for (let i = 0; i < n; i++) { W.tick++; const due = W.q.filter(x => x[0] <= W.tick); W.q = W.q.filter(x => x[0] > W.tick); due.forEach(x => x[1]()) } }
let fails = 0
const ok = (l, c, e) => { console.log((c ? 'ok   ' : 'FAIL ') + l + (e ? '  ' + e : '')); if (!c) fails++ }
const last = () => replies[replies.length - 1]

run('fakejoin', 'notch')
ok('nothing happens until Mojang answers', W.sent.length == 0 && W.sys.length == 0)
advance(12)
const add = W.sent[0]
ok('add packet broadcast to everyone', add && add.to == '@a' && add.pk.kind == 'add')
const ops = add.pk.ops.map(o => o[0] + (o[0] == 'writeUtf' ? ':' + o[1] + ',' + o[2] : o[0] == 'writeByte' || o[0] == 'writeVarInt' ? ':' + o[1] : ''))
ok('packet layout: actions 29, count 1, uuid, name(16), properties, gamemode, listed, ping',
  ops.slice(0, 6).join(' ') == 'writeByte:29 writeVarInt:1 writeUUID writeUtf:Notch,16 writeGameProfileProperties writeVarInt:0' && ops[6] == 'writeBoolean' && /^writeVarInt:\d+$/.test(ops[7]) && ops.length == 8, ops.join(' '))
ok('uses the real account UUID and capitals', add.pk.ops[2][1] == '069a79f4-44e9-4726-a5be-fca90e38aaf5')
ok('skin properties passed', add.pk.ops[4][1]._p.textures == 'skin')
const msg = JSON.parse(W.sys[0])
ok('no tellraw used (so Discord does not relay it as chat)', W.cmds.length == 0)
ok('Discord JOIN post like a real join', W.discord.length == 1 && W.discord[0].type == 'JOIN' && W.discord[0].msg == '🪂 **Notch** has deployed. The Ministry is watching.' && W.discord[0].auth.name == 'Notch' && W.discord[0].auth.avatar == '069a79f4-44e9-4726-a5be-fca90e38aaf5')
ok('yellow vanilla join message', msg.translate == 'multiplayer.player.joined' && msg.color == 'yellow' && msg.with[0].text == 'Notch' && msg.with[0].hoverEvent.contents.id == '069a79f4-44e9-4726-a5be-fca90e38aaf5')
ok('reply mentions skin and Discord result', /with their skin\). Discord: sent "🪂 \*\*Notch\*\* has deployed/.test(last()), last())

run('fakejoin', 'Notch')
ok('duplicate refused', /already pretending/.test(last()))
run('fakejoin', 'admin')
ok('real online player refused', /really online/.test(last()))
run('fakejoin', 'bad-name!')
ok('bad name refused', /1-16/.test(last()))

run('fakejoin', 'Goruk_The_Dwarf')
advance(12)
const g = W.sent[W.sent.length - 1]
ok('unknown name: offline uuid, no skin', g.pk.ops[2][1] == 'offline-goruk_the_dwarf' && /default skin/.test(last()), last())

const calls = skullCalls
run('fakeleave', 'Notch'); run('fakejoin', 'NOTCH'); advance(1)
ok('second join of a known name reuses the cached skin (no new Mojang call)', skullCalls == calls && W.sent[W.sent.length - 1].pk.ops[3][2] == 16)

mojangDelay = 500
run('fakejoin', 'SlowNet'); advance(101)
ok('Mojang timeout falls back to default skin', /default skin/.test(last()))
advance(400)
ok('late Mojang answer ignored', replies.filter(r => /SlowNet/.test(r)).length == 1)
mojangDelay = 10

const sugg = []
nodes.fakeleave.ch[0].sug(null, { suggest: s => sugg.push(s), buildFuture: () => 'f' })
ok('/fakeleave suggests pretend names', sugg.join(',') == 'Goruk_The_Dwarf,Notch,SlowNet', sugg.join(','))
run('fakeplayers')
ok('/fakeplayers lists them', /Goruk_The_Dwarf, Notch, SlowNet/.test(last()))

const before = W.sent.length
run('fakeleave', 'goruk_the_dwarf')
const rm = W.sent[before]
ok('remove packet with the right uuid', rm.pk.kind == 'remove' && rm.pk.uuids[0] == 'offline-goruk_the_dwarf')
ok('yellow vanilla leave message', JSON.parse(W.sys[W.sys.length - 1]).translate == 'multiplayer.player.left')
ok('Discord LEAVE post', W.discord[W.discord.length - 1].type == 'LEAVE' && W.discord[W.discord.length - 1].msg == '📋 **Goruk_The_Dwarf** has left the battlefield. Their absence has been noted.')
run('fakeleave', 'nobody')
ok('leaving a non-pretend name refused', /not a pretend player/.test(last()))

const newbie = player('Newbie', 'u-new'); players.push(newbie)
login({ player: newbie, server }); advance(6)
const late = W.sent.filter(s => s.to == 'Newbie')
ok('late joiner gets all pretend players in one packet', late.length == 1 && late[0].pk.ops[1][1] == 2)

const realNotch = player('Notch', '069a79f4-44e9-4726-a5be-fca90e38aaf5'); players.push(realNotch)
const n0 = W.sent.length, c0 = W.sys.length
login({ player: realNotch, server }); advance(6)
ok('real Notch logs in: pretend Notch dropped silently, no remove packet (same uuid)', !W.sent.slice(n0).some(s => s.pk.kind == 'remove') && W.sys.length == c0)
run('fakeplayers')
ok('only SlowNet left', /Pretend players: SlowNet$/.test(last()), last())

const fakeSlow = player('SlowNet', 'real-slow'); players.push(fakeSlow)
const n1 = W.sent.length
login({ player: fakeSlow, server })
ok('real player with different uuid: pretend entry removed from tab', W.sent.slice(n1).some(s => s.pk.kind == 'remove' && s.pk.uuids[0] == 'offline-slownet'))

delete classes['com.hypherionmc.sdlink.core.discord.BotController']
const d0 = W.discord.length
run('fakejoin', 'NoBridge'); advance(12); run('fakeleave', 'NoBridge')
ok('without Simple Discord Link: still works and says why in the reply', W.discord.length == d0 && /left.*Discord: failed while loading Simple Discord Link/.test(last()), last())
W.logs = W.logs.filter(l => !/Discord post failed/.test(l))
classes['com.hypherionmc.sdlink.core.discord.BotController'] = { INSTANCE: { isBotReady: () => false } }
run('fakejoin', 'NoBot'); advance(12)
ok('bot offline reported', /Discord: not posted, the bot is not connected/.test(last()), last())
classes['com.hypherionmc.sdlink.core.discord.BotController'] = { INSTANCE: { isBotReady: () => true } }
run('fakeleave', 'NoBot')
ok('leave posted again once the bot is back', /Discord: sent "📋 \*\*NoBot\*\* has left the battlefield/.test(last()), last())

// ----- /fakesay -----
const sayCmd = (name, message) => nodes.fakesay.ch[0].ch[0].f({ name, message, source: { server, sendSystemMessage: m => replies.push(m) } })
let r = sayCmd('Ghost', 'boo')
ok('/fakesay refuses a name that is not a pretend player', r == 0 && /not a pretend player/.test(last()), last())
run('fakejoin', 'hypixel'); advance(12)
const s0 = W.sys.length, d1 = W.discord.length
r = sayCmd('hypixel', '  Blood for the Blood God.  ')
const line = JSON.parse(W.sys[s0])
ok('chat line looks like real chat: chat.type.text with the name hover and the text', r == 1 && line.translate == 'chat.type.text' && line.with[0].text == 'hypixel' &&
  line.with[0].hoverEvent.action == 'show_entity' && line.with[0].clickEvent.value == '/tell hypixel ' && line.with[1] == 'Blood for the Blood God.', W.sys[s0])
const dm = W.discord[d1]
ok('posted to Discord as hypixel chat: CHAT type, DiscordAuthor.of(name, uuid, name), avatar', dm && dm.type == 'CHAT' && dm.msg == 'Blood for the Blood God.' &&
  dm.auth.of.join() == 'hypixel,offline-hypixel,hypixel' && dm.auth.name == 'hypixel' && dm.auth.avatar == 'offline-hypixel', dm && JSON.stringify(dm.auth))
ok('reply says what happened', /<hypixel> Blood for the Blood God\. Discord: sent\./.test(last()), last())
ok('no /tellraw used', !W.cmds.some(c => /tellraw/.test(c)))
r = sayCmd('hypixel', '   ')
ok('empty text refused', r == 0)
const long = 'x'.repeat(300)
sayCmd('hypixel', long)
ok('long text trimmed to 256', JSON.parse(W.sys[W.sys.length - 1]).with[1].length == 256)
Utils.server = server
const d2 = W.discord.length
const res = global.fakePlayers.say('HYPIXEL', 'From a script.')
ok('global.fakePlayers.say works (any capitals) and returns the reply', /<hypixel> From a script\. Discord: sent/.test(res) && W.discord.length == d2 + 1, res)
ok('global.fakePlayers.say on someone not pretending', /not a pretend player/.test(global.fakePlayers.say('Nobody', 'x')))
global.fakePlayers.fakes = {}; Object.keys(classes).length
console.log(W.logs.filter(l => /ERR|WARN/.test(l)).join('\n') || '(no errors logged)')
console.log(fails ? fails + ' FAILED' : 'ALL PASSED')
