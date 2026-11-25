// /disguise: an op appears to every other player as someone else: any name, with any account's skin.
// See tools/kubejs/DISGUISE.md.
//
//  - The name: chat, /msg, death and advancement messages, /list and the tab list (through
//    startup_scripts/disguise_hooks.js and tab_nicknames.js), and the name above your head.
//  - The skin: copied from any Minecraft account (the disguise name's, or one you name).
//  - Putting it on: "<you> left the game", then "<disguise> joined the game", in game and on Discord. Taking it off
//    does the reverse. Chat while disguised goes out, and to Discord, under the disguise.
//  - Every record (Troll Log, coins, charges) still uses your real account. Ops can always see who is who
//    (/disguise list), and if the real owner of the name logs in, the disguise ends.
//
// Needs: fake_players.js (Discord posts and the join/leave lines), startup_scripts/disguise_hooks.js (the name;
// restart once after adding it) and startup_scripts/tab_nicknames.js (the tab list).
// Commands (op): /disguise <name> [skin account], /disguise list, /undisguise.
// KubeJS 6 notes: no template strings; `let` inside nested blocks; event.cancel() last.

(function () {

// ===================== SETTINGS =====================

const LOOKUP_TIMEOUT_TICKS = 100   // give up waiting for Mojang's skin answer after this long (5 s)
const ANNOUNCE = true              // the fake leave/join (in game and on Discord) when it goes on and off
const RESEND_DELAY_TICKS = 20      // after someone logs in, wait this long before showing them the disguises
const NAME_RULE = /^[A-Za-z0-9_]{1,16}$/


// ===================== STATE =====================

const DATA_KEY = 'disguise'
if (!global.disguiseState) global.disguiseState = { skins: {} }
const S = global.disguiseState       // skins: lower-case account name -> GameProfile (kept across /reload)

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
  try { J.Serializer = Java.loadClass('net.minecraft.network.chat.Component$Serializer') } catch (e) { J.Serializer = null }
  try { J.Skull = Java.loadClass('net.minecraft.world.level.block.entity.SkullBlockEntity') } catch (e) { J.Skull = null }
  // Re-sending the player's body to people who can already see it, so their client rebuilds it with the new
  // name above the head and the new skin.
  try {
    J.RemoveEntities = Java.loadClass('net.minecraft.network.protocol.game.ClientboundRemoveEntitiesPacket')
    J.AddPlayer = Java.loadClass('net.minecraft.network.protocol.game.ClientboundAddPlayerPacket')
    J.EntityData = Java.loadClass('net.minecraft.network.protocol.game.ClientboundSetEntityDataPacket')
  } catch (e) { J.AddPlayer = null; console.warn('[Disguise] Can\'t re-send player bodies (' + e + '): nameplates change once players move out of sight and back.') }
  try {
    J.Equipment = Java.loadClass('net.minecraft.network.protocol.game.ClientboundSetEquipmentPacket')
    J.Slot = Java.loadClass('net.minecraft.world.entity.EquipmentSlot')
    J.Pair = Java.loadClass('com.mojang.datafixers.util.Pair')
  } catch (e) { J.Equipment = null }
  J.ready = true
  return J
}

function onlinePlayers(server) {
  const list = server.players, out = []
  for (let i = 0; i < list.size(); i++) out.push(list.get(i))
  return out
}
function realName(p) { return String(p.getGameProfile().getName()) }
function uuidOf(p) {
  try { return String(p.getStringUuid()).toLowerCase() } catch (e) { }
  return String(p.getGameProfile().getId()).toLowerCase()
}
function isOp(p) { try { return p.hasPermissions(2) } catch (e) { return false } }
function keyOf(name) { return String(name).toLowerCase() }
function comp(json) { return J.Serializer ? J.Serializer.fromJsonLenient(JSON.stringify(json)) : Text.of(String(json.text || '')) }
function tell(p, text) { try { p.tell(comp(['', { text: '[Disguise] ', color: 'dark_gray' }, { text: text, color: 'gray' }])) } catch (e) { } }


// ===================== SAVED DATA =====================
// server.persistentData['disguise'] = JSON { v, players: { realUuid: { real, name, skin, at } } }

let DB = null
function db() {
  if (DB) return DB
  let raw = ''
  try { raw = String(Utils.server.persistentData.getString(DATA_KEY) || '') } catch (e) { }
  let parsed = null
  if (raw) {
    try { parsed = JSON.parse(raw) } catch (e) {
      try { Utils.server.persistentData.putString(DATA_KEY + '_unreadable_' + Date.now(), raw) } catch (e2) { }
      console.error('[Disguise] Saved data could not be read (' + e + '); a copy was kept and it starts fresh.')
    }
  }
  DB = parsed && parsed.v ? parsed : { v: 1 }
  if (!DB.players) DB.players = {}
  return DB
}
function save() {
  try { Utils.server.persistentData.putString(DATA_KEY, JSON.stringify(db())) } catch (e) { console.error('[Disguise] Save failed: ' + e) }
}
function recordOf(p) { return p ? db().players[uuidOf(p)] || null : null }


// ===================== SKINS =====================

// The account's profile with its skin (asked of Mojang in the background, like a player head). An unknown name
// gets the offline-style ID and the default skin.
function lookUp(server, name, done) {
  classes()
  const key = keyOf(name)
  if (S.skins[key]) { done(S.skins[key], true); return }
  let finished = false
  const finish = found => {
    if (finished) return
    finished = true
    let real = found != null && found.getId() != null
    if (real) S.skins[key] = found
    done(real ? found : new J.GameProfile(J.UUIDUtil.createOfflinePlayerUUID(name), name), real)
  }
  if (!J.Skull) { finish(null); return }
  try { J.Skull.updateGameprofile(new J.GameProfile(null, name), found => finish(found)) } catch (e) {
    console.warn('[Disguise] Skin lookup failed for ' + name + ': ' + e)
    finish(null)
    return
  }
  server.scheduleInTicks(LOOKUP_TIMEOUT_TICKS, () => finish(null))
}
// The profile shown for a disguised player: their own UUID (so the game still knows it's them), the disguise
// name, and the skin account's textures.
function shownProfile(p, R) {
  classes()
  const skin = S.skins[keyOf(R.skin)]
  return { uuid: p.getGameProfile().getId(), name: R.name, props: skin ? skin.getProperties() : null }
}
// The skin account's ID, for the chat hover card and the Discord avatar (never the real account's).
function shownId(R) {
  classes()
  const skin = S.skins[keyOf(R.skin)]
  return skin && skin.getId() ? skin.getId() : J.UUIDUtil.createOfflinePlayerUUID(R.name)
}


// ===================== PACKETS =====================

let zeros = 'AAAA'
function blankBuffer(bytes) {
  const chars = Math.ceil(bytes / 3) * 4
  while (zeros.length < chars) zeros += zeros
  const data = J.Base64.getDecoder().decode(zeros.substring(0, chars))
  const buf = new J.ChunkBiomeData(new J.ChunkPos(0, 0), data).getReadBuffer()
  buf.writerIndex(0)
  return buf
}
function gameModeId(p) {
  try { return Number(p.gameMode.getGameModeForPlayer().getId()) } catch (e) { return 0 }
}
function latency(p) {
  try { return Number(p.latency) || 0 } catch (e) { return 0 }
}
// "Add to the tab list" for one player: ADD_PLAYER, UPDATE_GAME_MODE, UPDATE_LISTED, UPDATE_LATENCY (29).
function addPacket(p, shown) {
  classes()
  const buf = blankBuffer(16384)
  buf.writeByte(29)
  buf.writeVarInt(1)
  buf.writeUUID(shown.uuid)
  buf.writeUtf(shown.name, 16)
  if (shown.props) buf.writeGameProfileProperties(shown.props)
  else buf.writeVarInt(0)
  buf.writeVarInt(gameModeId(p))
  buf.writeBoolean(true)
  buf.writeVarInt(latency(p))
  return new J.InfoUpdate(buf)
}
function removePacket(p) {
  classes()
  const list = new J.ArrayList()
  list.add(p.getGameProfile().getId())
  return new J.InfoRemove(list)
}
function send(viewer, packet) { try { viewer.connection.send(packet) } catch (e) { console.warn('[Disguise] send: ' + e) } }
function dimOf(p) {
  let d = p.level.dimension
  if (typeof d == 'function') d = p.level.dimension()
  if (d != null && typeof d.location == 'function') d = d.location()
  return String(d)
}
// Viewers that can already see p's body (same dimension, well inside the view distance).
function canSee(server, viewer, p) {
  if (viewer === p || dimOf(viewer) != dimOf(p)) return false
  let vd = 10
  try { vd = Number(server.getPlayerList().getViewDistance()) || 10 } catch (e) { }
  const dx = Math.abs(Math.floor(Number(viewer.x) / 16) - Math.floor(Number(p.x) / 16))
  const dz = Math.abs(Math.floor(Number(viewer.z) / 16) - Math.floor(Number(p.z) / 16))
  return Math.max(dx, dz) <= Math.max(1, vd - 1)
}
function resendBody(viewer, p) {
  if (!J.AddPlayer) return
  const id = p.getId()
  try {
    send(viewer, new J.RemoveEntities(id))
    send(viewer, new J.AddPlayer(p))
    let data = p.getEntityData().getNonDefaultValues()
    if (data != null) send(viewer, new J.EntityData(id, data))
  } catch (e) { console.warn('[Disguise] resend: ' + e); return }
  if (!J.Equipment) return
  try {
    let list = new J.ArrayList(), slots = J.Slot.values()
    for (let i = 0; i < slots.length; i++) {
      let stack = p.getItemBySlot(slots[i])
      if (stack && !stack.isEmpty()) list.add(J.Pair.of(slots[i], stack.copy()))
    }
    if (list.size() > 0) send(viewer, new J.Equipment(id, list))
  } catch (e) { console.warn('[Disguise] equipment: ' + e) }
}
// Shows player p to one viewer as p is now: disguised (R) or as themselves (R = null).
function showTo(server, viewer, p, R) {
  if (viewer === p) return
  const shown = R ? shownProfile(p, R) : { uuid: p.getGameProfile().getId(), name: realName(p), props: p.getGameProfile().getProperties() }
  send(viewer, removePacket(p))
  send(viewer, addPacket(p, shown))
  if (canSee(server, viewer, p)) resendBody(viewer, p)
}
function showToAll(server, p, R) { onlinePlayers(server).forEach(v => showTo(server, v, p, R)) }
// The display name (chat, tab list) is worked out again by the game, through disguise_hooks.js.
function refreshNames(p) {
  try { p.refreshDisplayName() } catch (e) { }
  try { p.refreshTabListName() } catch (e) { }
}


// ===================== ANNOUNCEMENTS =====================

function FP() { return global.fakePlayers || null }
function announce(server, name, uuid, joined) {
  if (!ANNOUNCE) return
  const F = FP()
  if (F && F.announceAs) { try { F.announceAs(name, uuid, joined); return } catch (e) { console.warn('[Disguise] announce: ' + e) } }
  try { server.getPlayerList().broadcastSystemMessage(comp({ translate: joined ? 'multiplayer.player.joined' : 'multiplayer.player.left', with: [name], color: 'yellow' }), false) } catch (e) { }
}


// ===================== PUTTING IT ON AND OFF =====================

function disguise(server, p, name, skin, reply) {
  if (!NAME_RULE.test(name) || !NAME_RULE.test(skin)) return reply('Names are 1-16 letters, numbers or _.', true)
  const others = onlinePlayers(server).filter(o => o !== p && keyOf(realName(o)) == keyOf(name))
  if (others.length) return reply(name + ' is online right now. Pick a name that isn\'t.', true)
  const taken = Object.keys(db().players).filter(u => u != uuidOf(p) && keyOf(db().players[u].name) == keyOf(name))
  if (taken.length) return reply('Someone else is already disguised as ' + name + '.', true)
  lookUp(server, skin, (profile, real) => {
    const before = recordOf(p)
    const R = { real: realName(p), name: name, skin: skin, at: Date.now() }
    if (!real) delete S.skins[keyOf(skin)]
    db().players[uuidOf(p)] = R
    save()
    announce(server, before ? before.name : realName(p), before ? shownId(before) : p.getGameProfile().getId(), false)
    showToAll(server, p, R)
    refreshNames(p)
    announce(server, name, shownId(R), true)
    console.info('[Disguise] ' + realName(p) + ' is disguised as ' + name + ' (skin: ' + skin + (real ? '' : ', none found') + ')')
    reply('You appear to everyone else as ' + name + (real ? ' with ' + skin + '\'s skin.' : ' (no account named ' + skin + ', so the default skin).') + ' /undisguise to stop.', false)
  })
  return 1
}
function undisguise(server, p, quiet) {
  const R = recordOf(p)
  if (!R) return false
  delete db().players[uuidOf(p)]
  save()
  if (!quiet) announce(server, R.name, shownId(R), false)
  showToAll(server, p, null)
  refreshNames(p)
  if (!quiet) announce(server, realName(p), p.getGameProfile().getId(), true)
  console.info('[Disguise] ' + realName(p) + ' is no longer disguised as ' + R.name)
  return true
}


// ===================== HOOKS AND EVENTS =====================

// For startup_scripts/disguise_hooks.js: the display name while disguised.
global.disguiseHooks = {
  onNameFormat: event => {
    const p = event.getEntity()
    if (!p || !p.isPlayer()) return
    const R = recordOf(p)
    if (R) event.setDisplayname(comp({ text: R.name }))
  },
}

// For other scripts (e.g. factions_core.js leaves out the faction prefix while you're disguised).
global.Disguise = {
  isDisguised: p => !!recordOf(p),
  publicName: p => { const R = recordOf(p); return R ? R.name : realName(p) },
  list: () => Object.keys(db().players).map(u => { const R = db().players[u]; return { uuid: u, real: R.real, name: R.name, skin: R.skin } }),
}

// Chat while disguised goes out under the disguise, in game and on Discord. The original message is cancelled,
// so Discord never sees it under your real name.
PlayerEvents.chat(event => {
  const p = event.player, R = recordOf(p)
  if (!R) return
  const text = String(event.message)
  const F = FP()
  let sent = false
  if (F && F.chatAs) { try { F.chatAs(R.name, shownId(R), text); sent = true } catch (e) { console.warn('[Disguise] chat: ' + e) } }
  if (!sent) { try { event.server.getPlayerList().broadcastSystemMessage(comp({ translate: 'chat.type.text', with: [R.name, text] }), false) } catch (e) { } }
  console.info('[Disguise] <' + R.name + ' (' + R.real + ')> ' + text)
  event.cancel()   // last: cancel() stops this function
})

PlayerEvents.loggedIn(event => {
  const p = event.player, server = event.server
  classes()
  // The real owner of a disguise name has arrived: that disguise ends quietly, so there are never two of them.
  Object.keys(db().players).forEach(u => {
    let R = db().players[u]
    if (keyOf(R.name) != keyOf(realName(p)) || u == uuidOf(p)) return
    let wearer = onlinePlayers(server).filter(o => uuidOf(o) == u)[0]
    if (wearer) {
      undisguise(server, wearer, true)
      tell(wearer, 'The real ' + R.name + ' just logged in, so your disguise has ended. Everyone sees you as ' + realName(wearer) + ' again.')
    } else {
      delete db().players[u]
      save()
    }
    onlinePlayers(server).filter(isOp).forEach(o => tell(o, R.real + '\'s disguise as ' + R.name + ' ended: the real ' + R.name + ' logged in.'))
  })
  server.scheduleInTicks(RESEND_DELAY_TICKS, () => {
    // The new arrival sees everyone who is disguised as their disguise...
    onlinePlayers(server).forEach(o => {
      let R = recordOf(o)
      if (R && o !== p) showTo(server, p, o, R)
    })
    // ...and if they are disguised themselves, everyone else sees them that way (their skin is looked up again
    // after a restart).
    const mine = recordOf(p)
    if (mine) lookUp(server, mine.skin, () => { if (recordOf(p)) { showToAll(server, p, recordOf(p)); refreshNames(p) } })
  })
})


// ===================== COMMANDS =====================

ServerEvents.commandRegistry(event => {
  const Commands = event.commands
  const StringArg = Java.loadClass('com.mojang.brigadier.arguments.StringArgumentType')
  const op = src => src.hasPermission(2)
  const replyTo = ctx => (text, bad) => {
    ctx.source.sendSystemMessage(comp(['', { text: '[Disguise] ', color: 'dark_gray' }, { text: text, color: bad ? 'red' : 'gray' }]))
    return bad ? 0 : 1
  }
  const safe = fn => ctx => {
    try { return fn(ctx) } catch (e) {
      console.error('[Disguise] ' + e)
      return replyTo(ctx)('Error: ' + e, true)
    }
  }
  const str = (ctx, n) => String(StringArg.getString(ctx, n))
  const me = ctx => ctx.source.getPlayer()
  const put = (ctx, name, skin) => {
    const p = me(ctx)
    if (!p) return replyTo(ctx)('Players only.', true)
    classes()
    return disguise(ctx.source.server, p, name, skin, replyTo(ctx))
  }

  event.register(Commands.literal('disguise').requires(op)
    .then(Commands.literal('list').executes(safe(ctx => {
      const L = global.Disguise.list()
      if (!L.length) return replyTo(ctx)('Nobody is disguised.', false)
      L.forEach(d => replyTo(ctx)(d.real + ' appears as ' + d.name + ' (skin: ' + d.skin + ')', false))
      return 1
    })))
    .then(Commands.argument('name', StringArg.word())
      .executes(safe(ctx => put(ctx, str(ctx, 'name'), str(ctx, 'name'))))
      .then(Commands.argument('skin', StringArg.word())
        .executes(safe(ctx => put(ctx, str(ctx, 'name'), str(ctx, 'skin')))))))

  event.register(Commands.literal('undisguise').requires(op).executes(safe(ctx => {
    const p = me(ctx)
    if (!p) return replyTo(ctx)('Players only.', true)
    classes()
    if (!undisguise(ctx.source.server, p, false)) return replyTo(ctx)('You aren\'t disguised.', true)
    return replyTo(ctx)('You appear as yourself again.', false)
  })))
})

})()
