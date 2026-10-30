// =====================================================================
//  end_lockdown.js: The End Lockdown Initiative (ELI)
//  KubeJS 6, Forge 1.20.1
//  Place in: kubejs/server_scripts/end_lockdown.js, then /reload
//
//  What it does:
//   1. Removes every crafting recipe that makes an Eye of Ender.
//   2. Confiscates ordinary Eyes of Ender from player inventories (and
//      ender chests on login). Unsanctioned Eyes from the black market
//      are allowed.
//   3. Stops ordinary Eyes from being put into End Portal frames.
//   4. Portal-only End: anyone arriving in the End any other way (home,
//      /back, /tpa, /warp, Waystones, /tp) is sent back where they came from.
//      Arriving through an End portal (opened with Unsanctioned Eyes) works.
//   5. Adds admin commands:
//        /endlockdown seal [radius]
//            Run while standing in a stronghold portal room. Removes the
//            eyes from every End Portal frame nearby and shuts the portal.
//            Default radius 12 blocks.
//        /endlockdown give <player> [count]
//            Gives Unsanctioned Eyes of Ender (issued by the Ministry; the
//            black market sells its own, see economy/black_market.js).
//
//  Uses factions/factions_core.js (global.Factions) for dimension changes; without it,
//  the portal-only rule is off (the rest still works). global.EndLockdown is the API the
//  black market uses. See tools/kubejs/END_LOCKDOWN.md.
//
//  To end the lockdown: delete this file and /reload. Crafting comes
//  back, ordinary Eyes stop being confiscated, and the End opens to every route.
//
//  KubeJS 6 notes: no template strings; `let` inside nested blocks (a `const` in a loop keeps its
//  first value in Rhino); event.cancel() stops the handler, so it always comes last.
// =====================================================================

;(function () {

// ---------------- SETTINGS ----------------
const EYE = 'minecraft:ender_eye'
const FRAME = 'minecraft:end_portal_frame'
const PORTAL = 'minecraft:end_portal'
const EXEMPT_CREATIVE = true        // creative-mode players keep ordinary Eyes (for building/testing)
const SWEEP_ENDER_CHEST = true      // also confiscate ordinary Eyes from ender chests at login
const WARN_COOLDOWN_MS = 30000      // at most one confiscation message per player every 30 seconds
const DEFAULT_SEAL_RADIUS = 12

// Portal-only End. A player who arrives within PLATFORM_RADIUS blocks of the obsidian platform's spawn point
// (where the End portal puts everyone) came through a portal; anyone else is sent back.
const PORTAL_ONLY = true
const END = 'minecraft:the_end'
const PLATFORM = { x: 100.5, y: 50, z: 0.5 }
const PLATFORM_RADIUS = 3
const PLATFORM_Y = [47, 53]
const EXEMPT_OPS = true             // ops (permission level 2) aren't sent back (creative and spectator never are)
const POSITION_SAMPLE_TICKS = 40    // where each player is outside the End, remembered every 2 seconds

const UNSANCTIONED_NAME = 'Unsanctioned Eye of Ender'
const UNSANCTIONED_LORE_1 = 'Possession is a crime.'
const UNSANCTIONED_LORE_2 = 'Sold by no one. Bought by no one.'

const CONFISCATED_MSG = 'Unauthorized Eye of Ender confiscated under the End Lockdown Initiative. Your cooperation has been noted.'
const FRAME_BLOCKED_MSG = 'The End is closed. This frame is Ministry property.'
const BOUNCED_MSG = 'There is nothing in the End. You have been returned to where you never left.'
// ------------------------------------------

const DATA_KEY = 'end_lockdown'

// Kept across /reload.
if (!global.endLockdownState) global.endLockdownState = { token: 0, lastPos: {}, hookedFor: null }
const S = global.endLockdownState
S.token++
S.lastWarn = S.lastWarn || {}

let Serializer = null
try { Serializer = Java.loadClass('net.minecraft.network.chat.Component$Serializer') } catch (e) { }

// ---------------- HELPERS ----------------
function nameOf(p) { return String(p.getGameProfile().getName()) }
function uuidOf(e) {
  try { return String(e.getStringUuid()) } catch (err) { }
  return String(e.getStringUUID())
}
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
    let v = NaN
    try { v = Number(e['get' + k.toUpperCase()]()) } catch (err) { }
    if (!isFinite(v)) v = Number(e[k])
    return v
  }
  return { x: read('x'), y: read('y'), z: read('z') }
}
function num(n) { return String(Math.round(n * 100) / 100) }
function onlinePlayers(server) {
  const list = server.players, out = []
  for (let i = 0; i < list.size(); i++) out.push(list.get(i))
  return out
}
function comp(parts) {
  if (Serializer) {
    try { return Serializer.fromJsonLenient(JSON.stringify([''].concat(parts))) } catch (e) { }
  }
  return Text.of(parts.map(p => p.text || '').join(''))
}

// The Unsanctioned Eye: a vanilla Eye of Ender with a marker tag, a name, lore and an enchantment glint.
// The marker is what matters. Renaming an ordinary Eye on an anvil can't add it, so it can't be faked.
// extraTag (optional) goes inside the trollcraft tag: the black market adds its purchase id there.
function unsanctionedNbt(extraTag) {
  return '{trollcraft:{unsanctioned:1b' + (extraTag ? ',' + extraTag : '') + '},Enchantments:[{id:"minecraft:unbreaking",lvl:1s}],HideFlags:1,display:{' +
    "Name:'{\"text\":\"" + UNSANCTIONED_NAME + "\",\"color\":\"dark_red\",\"italic\":false}'," +
    "Lore:['{\"text\":\"" + UNSANCTIONED_LORE_1 + "\",\"color\":\"gray\",\"italic\":true}'," +
    "'{\"text\":\"" + UNSANCTIONED_LORE_2 + "\",\"color\":\"dark_gray\",\"italic\":true}']}}"
}
function makeUnsanctioned(count, extraTag) {
  return Item.of(EYE, count, unsanctionedNbt(extraTag))
}

// Reads NBT with stack.nbt, because hasTag()/getTag() are overridden by KubeJS.
function isUnsanctioned(stack) {
  try {
    let n = stack.nbt
    if (!n || !n.contains('trollcraft')) return false
    return !!n.getCompound('trollcraft').getBoolean('unsanctioned')
  } catch (e) {
    return false
  }
}

function isOrdinaryEye(stack) {
  return stack != null && !stack.isEmpty() && String(stack.id) == EYE && !isUnsanctioned(stack)
}

function exempt(player) {
  return EXEMPT_CREATIVE && player.isCreative()
}

function ministry(player, text) {
  try { player.tell(comp([{ text: '[MINISTRY]', color: 'gold', bold: true }, { text: ' ' + text, color: 'yellow' }])) } catch (e) { }
}
function warnConfiscated(player) {
  const key = uuidOf(player)
  const now = Date.now()
  if (S.lastWarn[key] && now - S.lastWarn[key] < WARN_COOLDOWN_MS) return
  S.lastWarn[key] = now
  ministry(player, CONFISCATED_MSG)
}

// Empties ordinary Eyes from a container in place. Returns how many were removed.
function sweepContainer(container) {
  let removed = 0
  for (let i = 0; i < container.containerSize; i++) {
    let s = container.getItem(i)
    if (isOrdinaryEye(s)) {
      removed += s.count
      s.shrink(s.count)
    }
  }
  return removed
}

// Sweeps the player's REAL inventory (inventoryChanged only hands us a copy of the item),
// plus whatever they're holding on the cursor in an open menu.
function sweepPlayer(player, includeEnderChest) {
  if (exempt(player)) return 0
  let removed = sweepContainer(player.inventory)
  try {
    let carried = player.containerMenu.getCarried()
    if (isOrdinaryEye(carried)) {
      removed += carried.count
      carried.shrink(carried.count)
    }
  } catch (e) { }
  if (includeEnderChest && SWEEP_ENDER_CHEST) {
    try { removed += sweepContainer(player.enderChestInventory) } catch (e) { }
  }
  if (removed > 0) warnConfiscated(player)
  return removed
}

// ---------------- SAVED DATA ----------------
// server.persistentData['end_lockdown'] = JSON { legit: { uuid: true } }: players who came into the End through a
// portal (so logging out and back in there is fine).
let DB = null
function db() {
  if (DB) return DB
  let raw = ''
  try { raw = String(Utils.server.persistentData.getString(DATA_KEY) || '') } catch (e) { }
  try { DB = raw ? JSON.parse(raw) : null } catch (e) {
    try { Utils.server.persistentData.putString(DATA_KEY + '_unreadable_' + Date.now(), raw) } catch (e2) { }
    console.error('[ELI] Saved data could not be read (' + e + '); a copy was kept and it starts fresh.')
    DB = null
  }
  if (!DB) DB = {}
  if (!DB.legit) DB.legit = {}
  return DB
}
function save() {
  try { Utils.server.persistentData.putString(DATA_KEY, JSON.stringify(db())) } catch (e) { console.error('[ELI] Save failed: ' + e) }
}

// ---------------- PORTAL-ONLY END ----------------
function lockExempt(player) {
  try { if (player.isCreative() || player.isSpectator()) return true } catch (e) { }
  try { if (EXEMPT_OPS && player.hasPermissions(2)) return true } catch (e) { }
  return false
}
function onPlatform(player) {
  const q = posOf(player)
  const dx = q.x - PLATFORM.x, dz = q.z - PLATFORM.z
  return Math.sqrt(dx * dx + dz * dz) <= PLATFORM_RADIUS && q.y >= PLATFORM_Y[0] && q.y <= PLATFORM_Y[1]
}
// Their last place outside the End; otherwise their spawn point; otherwise world spawn.
function returnSpot(server, player) {
  const last = S.lastPos[uuidOf(player)]
  if (last && last.dim != END) return last
  try {
    let pos = player.getRespawnPosition()
    if (pos != null) {
      let dim = 'minecraft:overworld'
      try { dim = String(player.getRespawnDimension().location()) } catch (e) { }
      if (dim != END) return { dim: dim, x: Number(pos.getX()) + 0.5, y: Number(pos.getY()) + 1, z: Number(pos.getZ()) + 0.5 }
    }
  } catch (e) { }
  let o = server.overworld
  if (typeof o == 'function') o = server.overworld()
  const s = o.getSharedSpawnPos()
  return { dim: 'minecraft:overworld', x: Number(s.getX()) + 0.5, y: Number(s.getY()), z: Number(s.getZ()) + 0.5 }
}
function sendBack(server, player) {
  const u = uuidOf(player), token = S.token
  // A tick later: the dimension change is still being finished when the event fires.
  server.scheduleInTicks(1, () => {
    if (token != S.token) return
    try { if (player.isRemoved() || dimOf(player) != END) return } catch (e) { return }
    const to = returnSpot(server, player)
    try { server.runCommandSilent('execute in ' + to.dim + ' run tp ' + u + ' ' + num(to.x) + ' ' + num(to.y) + ' ' + num(to.z)) } catch (e) { console.error('[ELI] Sending ' + nameOf(player) + ' back failed: ' + e) }
    ministry(player, BOUNCED_MSG)
    console.info('[ELI] ' + nameOf(player) + ' reached the End without a portal; sent back to ' + to.dim + ' ' + Math.floor(to.x) + ' ' + Math.floor(to.y) + ' ' + Math.floor(to.z))
  })
}
function onEntered(player, faction, from, to, how) {
  if (!PORTAL_ONLY) return
  const server = Utils.server
  if (!server) return
  const u = uuidOf(player), D = db()
  if (from == END && to != END && D.legit[u]) { delete D.legit[u]; save() }
  if (to != END || lockExempt(player)) return
  if (how == 'travel') {
    if (onPlatform(player)) { D.legit[u] = true; save(); return }
    sendBack(server, player)
  } else if (how == 'login' && !D.legit[u]) {
    sendBack(server, player)
  }
}
// factions_core loads after this file (and again on every /reload), so the listener is (re)attached whenever
// global.Factions is a new object. Its listeners are reset when it reloads, so this never doubles up.
function hookFactions() {
  const F = global.Factions
  if (!F || typeof F.on != 'function' || S.hookedFor === F) return
  S.hookedFor = F
  F.on('enteredDimension', (player, faction, from, to, how) => {
    try { onEntered(player, faction, from, to, how) } catch (e) { console.error('[ELI] ' + e) }
  })
}
// Every POSITION_SAMPLE_TICKS: remember where each player is outside the End, and make sure the hook is attached.
function startLoop(server) {
  const token = S.token
  const step = () => {
    if (token != S.token) return
    hookFactions()
    onlinePlayers(server).forEach(p => {
      try {
        let d = dimOf(p)
        if (d != END) {
          let q = posOf(p)
          S.lastPos[uuidOf(p)] = { dim: d, x: q.x, y: q.y, z: q.z }
        }
      } catch (e) { }
    })
    server.scheduleInTicks(POSITION_SAMPLE_TICKS, step)
  }
  server.scheduleInTicks(1, step)
}

// ---------------- API FOR OTHER SCRIPTS ----------------
// economy/black_market.js sells Unsanctioned Eyes through this while the lockdown is active.
global.EndLockdown = {
  active: true,
  makeUnsanctioned: (count, extraTag) => makeUnsanctioned(count, extraTag),
  isUnsanctioned: stack => isUnsanctioned(stack),
}

// ---------------- EVENTS ----------------
// 1. RECIPES: remove every recipe that outputs an Eye of Ender (vanilla and modded).
ServerEvents.recipes(event => {
  event.remove({ output: EYE })
})

// 2a. Any time an Eye enters a player's inventory, sweep the real inventory.
PlayerEvents.inventoryChanged(event => {
  if (String(event.item.id) != EYE) return
  sweepPlayer(event.player, false)
})

// 2b. Picking up an ordinary Eye from the ground: refuse it and delete the dropped item.
ItemEvents.pickedUp(event => {
  if (!isOrdinaryEye(event.item) || exempt(event.player)) return
  try { event.itemEntity.discard() } catch (e) { try { event.itemEntity.kill() } catch (e2) { } }
  warnConfiscated(event.player)
  event.cancel()   // last
})

// 2c. Login sweep: inventory and ender chest (catches Eyes stored before the lockdown).
PlayerEvents.loggedIn(event => {
  sweepPlayer(event.player, true)
})

// 3. Ordinary Eyes can't go into End Portal frames. Unsanctioned Eyes can.
BlockEvents.rightClicked(event => {
  if (String(event.block.id) != FRAME) return
  if (!isOrdinaryEye(event.item) || exempt(event.player)) return
  ministry(event.player, FRAME_BLOCKED_MSG)
  event.cancel()   // last
})

ServerEvents.loaded(event => startLoop(event.server))
if (Utils.server) startLoop(Utils.server)

// 4. Admin commands (op level 2)
function seal(player, radius) {
  const level = levelOf(player)
  const q = posOf(player)
  const px = Math.floor(q.x), py = Math.floor(q.y), pz = Math.floor(q.z)
  let frames = 0, portals = 0
  for (let x = px - radius; x <= px + radius; x++) {
    for (let y = py - radius; y <= py + radius; y++) {
      for (let z = pz - radius; z <= pz + radius; z++) {
        let block = level.getBlock(x, y, z)
        let id = String(block.id)
        if (id == PORTAL) {
          block.set('minecraft:air')
          portals++
        } else if (id == FRAME) {
          let props = block.properties
          if (String(props.get('eye')) == 'true') {
            block.set(FRAME, { facing: String(props.get('facing')), eye: 'false' })
            frames++
          }
        }
      }
    }
  }
  return { frames: frames, portals: portals }
}

ServerEvents.commandRegistry(event => {
  const Commands = event.commands
  const Arguments = event.arguments
  const reply = (ctx, text, bad) => {
    ctx.source.sendSystemMessage(comp([{ text: '[ELI] ', color: 'gold' }, { text: text, color: bad ? 'red' : 'yellow' }]))
    return bad ? 0 : 1
  }

  const doSeal = (ctx, radius) => {
    const player = ctx.source.getPlayer()
    if (!player) return reply(ctx, 'Run this as a player standing in the portal room.', true)
    const r = seal(player, radius)
    return reply(ctx, 'Sealed: ' + r.frames + ' frame eye(s) removed, ' + r.portals + ' portal block(s) closed (radius ' + radius + ').')
  }

  const doGive = (ctx, count) => {
    const target = Arguments.PLAYER.getResult(ctx, 'player')
    target.give(makeUnsanctioned(count))
    return reply(ctx, 'Gave ' + count + ' Unsanctioned Eye(s) of Ender to ' + nameOf(target) + '.')
  }

  event.register(Commands.literal('endlockdown')
    .requires(src => src.hasPermission(2))
    .then(Commands.literal('seal')
      .executes(ctx => doSeal(ctx, DEFAULT_SEAL_RADIUS))
      .then(Commands.argument('radius', Arguments.INTEGER.create(event))
        .executes(ctx => doSeal(ctx, Math.max(1, Math.min(32, Arguments.INTEGER.getResult(ctx, 'radius')))))))
    .then(Commands.literal('give')
      .then(Commands.argument('player', Arguments.PLAYER.create(event))
        .executes(ctx => doGive(ctx, 1))
        .then(Commands.argument('count', Arguments.INTEGER.create(event))
          .executes(ctx => doGive(ctx, Math.max(1, Math.min(64, Arguments.INTEGER.getResult(ctx, 'count')))))))))
})

})()
