// /fakejoin <name>   - shows "<name> joined the game" and adds <name> to everyone's tab player list.
//                      If <name> is a real Minecraft account, the tab list shows that player's skin.
// /fakeleave <name>  - shows "<name> left the game" and takes <name> off the tab list.
// /fakeplayers       - lists the pretend players.
// Players who log in later see the pretend players too. They're only for show: they aren't in /list or the
// server-browser player count, and can't be teleported to or messaged.
// With Simple Discord Link installed, the join/leave is also posted to Discord like a real one.
// They're forgotten when the server restarts (a /reload keeps them).
// If the real player logs in while pretending to be online, the pretend one is quietly dropped.
// Operators only (permission level 2). For an FTB Ranks rank:
//   /ftbranks node add <rank> command.fakejoin true
//   /ftbranks node add <rank> command.fakeleave true
//   /ftbranks node add <rank> command.fakeplayers true
// Copy to <server>/kubejs/server_scripts/ and run /reload.
// Note: KubeJS 6's script engine (Rhino) has no `template strings`, so strings are joined with +.

(function () {

// ===================== SETTINGS =====================

const LOOK_UP_SKINS = true        // ask Mojang for the account's skin (runs in the background, no lag)
const LOOKUP_TIMEOUT_TICKS = 100  // give up waiting for Mojang after this long (20 ticks = 1 second)
const MAX_FAKE_PLAYERS = 20
const PING_MIN = 25               // the connection bars shown in the tab list, in milliseconds
const PING_MAX = 90
const GAME_MODE = 0               // 0 survival, 1 creative, 2 adventure, 3 spectator (spectators sort last)
const POST_TO_DISCORD = true      // post the join/leave through Simple Discord Link, as for a real player
// The Discord wording, matching playerJoined/playerLeft in config/simple-discord-link/simple-discord-link.toml.
// If you change those, change these too. (Scripts can't read that config themselves.)
// 🪂 is the parachute emoji and 📋 the clipboard; ** ** makes the name bold.
const DISCORD_JOINED = '🪂 **%player%** has deployed. The Ministry is watching.'
const DISCORD_LEFT = '📋 **%player%** has left the battlefield. Their absence has been noted.'


// ===================== HELPERS =====================

if (!global.fakePlayers) global.fakePlayers = { fakes: {}, profiles: {}, pending: {} }
const state = global.fakePlayers

// The tab list is updated with the same network packets the game sends when a real player joins or leaves.
const J = {}
function classes() {
  if (J.ready) return J
  J.InfoUpdate = Java.loadClass('net.minecraft.network.protocol.game.ClientboundPlayerInfoUpdatePacket')
  J.InfoRemove = Java.loadClass('net.minecraft.network.protocol.game.ClientboundPlayerInfoRemovePacket')
  J.ChunkBiomeData = Java.loadClass('net.minecraft.network.protocol.game.ClientboundChunksBiomesPacket$ChunkBiomeData')
  J.ChunkPos = Java.loadClass('net.minecraft.world.level.ChunkPos')
  J.UUIDUtil = Java.loadClass('net.minecraft.core.UUIDUtil')
  J.GameProfile = Java.loadClass('com.mojang.authlib.GameProfile')
  J.Base64 = Java.loadClass('java.util.Base64')
  J.ArrayList = Java.loadClass('java.util.ArrayList')
  J.ready = true
  try { J.Serializer = Java.loadClass('net.minecraft.network.chat.Component$Serializer') } catch (e) { J.Serializer = null }
  try { J.Skull = Java.loadClass('net.minecraft.world.level.block.entity.SkullBlockEntity') } catch (e) { J.Skull = null }
  return J
}

const NAME_RULE = /^[A-Za-z0-9_]{1,16}$/

function nameOf(p) { return String(p.getGameProfile().getName()) }
function keyOf(name) { return String(name).toLowerCase() }
function uuidOf(p) {
  try { return String(p.getUuid()) } catch (e) { }   // KubeJS's name for Minecraft's getUUID
  return String(p.getGameProfile().getId())
}
function fakeList() { return Object.keys(state.fakes).map(k => state.fakes[k]) }

function onlinePlayer(server, name, uuid) {
  const list = server.players
  for (let i = 0; i < list.size(); i++) {
    let p = list.get(i)
    if (keyOf(nameOf(p)) == keyOf(name) || (uuid != null && uuidOf(p) == String(uuid))) return p
  }
  return null
}

// A blank buffer to write a packet into. (KubeJS blocks the usual way of making one, so this borrows a
// harmless game class that wraps a plain byte array.)
let zeros = 'AAAA'
function blankBuffer(bytes) {
  const chars = Math.ceil(bytes / 3) * 4
  while (zeros.length < chars) zeros += zeros
  const data = J.Base64.getDecoder().decode(zeros.substring(0, chars))
  const buf = new J.ChunkBiomeData(new J.ChunkPos(0, 0), data).getReadBuffer()
  buf.writerIndex(0)
  return buf
}

// "Add to the tab list" packet: the actions ADD_PLAYER, UPDATE_GAME_MODE, UPDATE_LISTED and UPDATE_LATENCY
// (bits 0, 2, 3 and 4 = 29), then each player's details in that order.
function addPacket(fakes) {
  classes()
  const buf = blankBuffer(1024 + fakes.length * 8192)
  buf.writeByte(29)
  buf.writeVarInt(fakes.length)
  fakes.forEach(f => {
    buf.writeUUID(f.uuid)
    buf.writeUtf(f.name, 16)
    buf.writeGameProfileProperties(f.profile.getProperties())   // the skin, if there is one
    buf.writeVarInt(GAME_MODE)
    buf.writeBoolean(true)
    buf.writeVarInt(f.ping)
  })
  return new J.InfoUpdate(buf)
}

function removePacket(uuids) {
  classes()
  const list = new J.ArrayList()
  uuids.forEach(u => list.add(u))
  return new J.InfoRemove(list)
}

function sendToAll(server, packet) { server.getPlayerList().broadcastAll(packet) }

// The same yellow message as a real join or leave, including the name's hover card and click-to-message.
// It's sent the way the game sends a real one (not with /tellraw, which Discord bridges relay as server
// chat), so it also shows in the server console and log like a real join.
function announce(server, f, joined) {
  const name = {
    text: f.name, insertion: f.name,
    clickEvent: { action: 'suggest_command', value: '/tell ' + f.name + ' ' },
    hoverEvent: { action: 'show_entity', contents: { type: 'minecraft:player', id: String(f.uuid), name: { text: f.name } } },
  }
  const key = joined ? 'multiplayer.player.joined' : 'multiplayer.player.left'
  let sent = false
  if (J.Serializer) {
    try {
      server.getPlayerList().broadcastSystemMessage(J.Serializer.fromJson(JSON.stringify({ translate: key, with: [name], color: 'yellow' })), false)
      sent = true
    } catch (e) { console.warn('[FakePlayers] ' + e) }
  }
  if (!sent) server.tell(Text.translate(key, f.name).yellow())   // plainer, but still not relayed as chat
  return postToDiscord(f, joined)
}

// Simple Discord Link's own join/leave message, built the same way it builds one for a real player.
// Returns what happened, for the command's reply. Each step is checked separately so the reply says
// exactly where it stopped. (Simple Discord Link itself only logs send errors when its "debugging"
// setting is on.) To stop fake joins reaching Discord, set POST_TO_DISCORD to false.
const SDLINK = 'com.hypherionmc.sdlink.'
function postToDiscord(f, joined) {
  if (!POST_TO_DISCORD) return 'Discord: off (POST_TO_DISCORD).'
  let step = 'loading Simple Discord Link'
  try {
    // (Simple Discord Link's config object can't be reached from scripts, because KubeJS hides fields
    // marked "transient", so the wording comes from DISCORD_JOINED / DISCORD_LEFT above.)
    let Bot = Java.loadClass(SDLINK + 'core.discord.BotController')
    let Author = Java.loadClass(SDLINK + 'api.accounts.DiscordAuthor')
    let Builder = Java.loadClass(SDLINK + 'api.messaging.discord.DiscordMessageBuilder')
    let Type = Java.loadClass(SDLINK + 'api.messaging.MessageType')
    step = 'checking the bot'
    if (Bot.INSTANCE == null || !Bot.INSTANCE.isBotReady()) return 'Discord: not posted, the bot is not connected.'
    let text = (joined ? DISCORD_JOINED : DISCORD_LEFT).split('%player%').join(f.name)
    step = 'building the message'
    let author = Author.getServer().setPlayerName(f.name).setPlayerAvatar(f.name, String(f.uuid))
    let message = new Builder(joined ? Type.JOIN : Type.LEAVE).message(text).author(author).build()
    step = 'sending'
    message.sendMessage()
    return 'Discord: sent "' + text + '".'
  } catch (e) {
    let detail = String(e)
    try { if (e.javaException) detail = String(e.javaException) } catch (e2) { }
    console.error('[FakePlayers] Discord post failed while ' + step + ': ' + detail)
    return 'Discord: failed while ' + step + ': ' + detail
  }
}

// Finds the real account for a name, with its skin. Mojang is asked in the background, the same way a
// player head looks up its skin, and the answer comes back on the server thread. Names with no account
// get the offline-style ID and the default skin.
function lookUp(server, name, done) {
  const key = keyOf(name)
  if (state.profiles[key]) { done(state.profiles[key]); return }
  let finished = false
  const finish = found => {
    if (finished) return
    finished = true
    let real = found != null && found.getId() != null
    if (real) state.profiles[key] = found
    done(real ? found : new J.GameProfile(J.UUIDUtil.createOfflinePlayerUUID(name), name))
  }
  if (!LOOK_UP_SKINS || !J.Skull) { finish(null); return }
  try {
    J.Skull.updateGameprofile(new J.GameProfile(null, name), found => finish(found))
  } catch (e) {
    console.warn('[FakePlayers] Skin lookup failed for ' + name + ': ' + e)
    finish(null)
    return
  }
  server.scheduleInTicks(LOOKUP_TIMEOUT_TICKS, () => finish(null))
}


// ===================== JOIN & LEAVE =====================

function fakeJoin(server, name, reply) {
  classes()
  const key = keyOf(name)
  if (!NAME_RULE.test(name)) return reply('Names are 1-16 letters, numbers or _.', true)
  if (state.fakes[key] || state.pending[key]) return reply(name + ' is already pretending to be online.', true)
  if (onlinePlayer(server, name, null)) return reply(name + ' is really online.', true)
  if (fakeList().length >= MAX_FAKE_PLAYERS) return reply('Already ' + MAX_FAKE_PLAYERS + ' pretend players (MAX_FAKE_PLAYERS).', true)

  state.pending[key] = true
  lookUp(server, name, profile => {
    delete state.pending[key]
    try {
      let shown = String(profile.getName())   // the account's own capitals, e.g. notch -> Notch
      if (onlinePlayer(server, shown, profile.getId())) return reply(shown + ' is really online.', true)
      let f = { name: shown, uuid: profile.getId(), profile: profile, ping: PING_MIN + Math.floor(Math.random() * (PING_MAX - PING_MIN + 1)) }
      state.fakes[key] = f
      let skin = profile.getProperties().containsKey('textures')
      try {
        sendToAll(server, addPacket([f]))
      } catch (e) {
        console.error('[FakePlayers] Tab list update failed: ' + e)
        reply('The join message was sent, but the tab list could not be updated: ' + e, true)
      }
      let discord = announce(server, f, true)
      reply(shown + ' has "joined"' + (skin ? ' (with their skin).' : ' (no Mojang account found, so the default skin).') + ' ' + discord, false)
    } catch (e) {
      console.error('[FakePlayers] ' + e)
      reply('Error: ' + e, true)
    }
  })
  return 1
}

function fakeLeave(server, name, reply) {
  const key = keyOf(name)
  const f = state.fakes[key]
  if (!f) return reply(name + ' is not a pretend player. /fakeplayers lists them.', true)
  delete state.fakes[key]
  try {
    sendToAll(server, removePacket([f.uuid]))
  } catch (e) {
    console.error('[FakePlayers] Tab list update failed: ' + e)
    reply('The leave message was sent, but the tab list could not be updated: ' + e, true)
  }
  let discord = announce(server, f, false)
  reply(f.name + ' has "left". ' + discord, false)
  return 1
}

// Late arrivals get the pretend players too. If someone logs in under a pretend player's name, the
// pretend one is dropped without a leave message.
PlayerEvents.loggedIn(event => {
  const player = event.player, server = event.server
  const key = keyOf(nameOf(player))
  const same = state.fakes[key]
  if (same) {
    delete state.fakes[key]
    if (String(same.uuid) != uuidOf(player)) {
      try { sendToAll(server, removePacket([same.uuid])) } catch (e) { console.error('[FakePlayers] ' + e) }
    }
  }
  if (!fakeList().length) return
  server.scheduleInTicks(5, () => {
    let list = fakeList()
    if (!list.length) return
    try { player.connection.send(addPacket(list)) } catch (e) { console.error('[FakePlayers] Could not show pretend players to ' + nameOf(player) + ': ' + e) }
  })
})


// ===================== COMMANDS =====================

ServerEvents.commandRegistry(event => {
  const Commands = event.commands
  const StringArgumentType = Java.loadClass('com.mojang.brigadier.arguments.StringArgumentType')

  const replier = ctx => (text, bad) => {
    ctx.source.sendSystemMessage(bad ? Text.red(text) : Text.yellow(text))
    return bad ? 0 : 1
  }
  const run = (fn, what) => ctx => {
    const reply = replier(ctx)
    try {
      return fn(ctx.source.server, String(StringArgumentType.getString(ctx, 'name')), reply)
    } catch (e) {
      console.error('[FakePlayers] /' + what + ' failed: ' + e)
      return reply('/' + what + ' failed: ' + e, true)
    }
  }

  event.register(Commands.literal('fakejoin')
    .requires(source => source.hasPermission(2))
    .then(Commands.argument('name', StringArgumentType.word()).executes(run(fakeJoin, 'fakejoin'))))

  event.register(Commands.literal('fakeleave')
    .requires(source => source.hasPermission(2))
    .then(Commands.argument('name', StringArgumentType.word())
      .suggests((ctx, builder) => {
        fakeList().forEach(f => builder.suggest(f.name))
        return builder.buildFuture()
      })
      .executes(run(fakeLeave, 'fakeleave'))))

  event.register(Commands.literal('fakeplayers')
    .requires(source => source.hasPermission(2))
    .executes(ctx => {
      const names = fakeList().map(f => f.name)
      return replier(ctx)(names.length ? 'Pretend players: ' + names.join(', ') : 'No pretend players right now.', false)
    }))
})

})()
