// Chunk Loader Ban: nothing a player has may keep chunks loaded (owner decisions, for TPS: ChickenChunks' loaders first,
// then, 2026-11-25, "all methods of chunk loading"). Every mod jar was scanned for code that loads chunks; what each does
// and what stops it is in tools/kubejs/CHUNK_LOADER_BAN.md (some are settings in other mods' files).
// Loaders (BANNED: ChickenChunks' Chunk Loader and Spot Loader, AE2's Spatial Anchor):
//   - No new ones: their recipes are removed, placing one is refused, and right-clicking one removes it.
//   - Placed ones are removed: startup_scripts/chunk_loader_ban_hooks.js notes any loader in a chunk as it loads (each
//     loader keeps its own chunk loaded, so they're found at server start), and this script replaces it with air a
//     moment later. Removing the block runs ChickenChunks' own clean-up (TileChunkLoaderBase.setRemoved ->
//     deactivate -> removeChunkLoader), so its chunks are released.
//   - Loader items vanish from inventories, opened containers and the ground.
//   - Nothing is refunded (owner decision).
// Mekanism's loaders (NO_RECIPE) are off in its own settings, and can't be made. Chunks a mod forces as /forceload does
// and never lets go of (an Alex's Mobs eagle in guided flight) are released within seconds, and so are the ones Alex's
// Caves' Occult Gem and Remote Detonator hold after use. /forceload itself (ops, and this server's scripts) is left alone.
// Works with or without ChickenChunks. Needs the startup hook for loaders already placed (restart once after adding it).
// KubeJS 6 (Rhino): no template strings; `let` inside nested blocks; event.cancel() last.

(function () {

// ===================== SETTINGS =====================

const BANNED = ['chickenchunks:chunk_loader', 'chickenchunks:spot_loader', 'ae2:spatial_anchor']   // blocks and their items
// Off in Mekanism's own settings (allowChunkloading = false in config/Mekanism/general.toml, which both check); only their
// recipes go, so nobody makes one for nothing. Ones already made do nothing.
const NO_RECIPE = ['mekanism:dimensional_stabilizer', 'mekanism:upgrade_anchor']
const MOD = 'chickenchunks'
const CHECK_TICKS = 20                 // how often found loaders are removed
// Chunks forced the vanilla way. An Alex's Mobs Bald Eagle flown with a Falconry Glove forces the 3 x 3 chunks around it
// all along its way and never releases them (read in its code); they'd stay loaded for good, restarts included. Any chunk
// forced by something other than a /forceload command is released. Ops' and this server's scripts' /forceload commands
// are heard (ServerEvents.command) and their chunks kept.
const RELEASE_FORCED = true
const FORCED_TICKS = 100               // how often
const REPORT_MINUTES = 10              // a line in the log at most this often, for each dimension
// Alex's Caves items that hold the 3 x 3 chunks around what they're linked to until the next restart: where the item keeps
// that position and its dimension. Those chunks are let go LINKED_TICKS after a use (a Beholder being looked through
// holds its own while somebody looks, and a nuclear blast its own).
const LINKED = { 'alexscaves:occult_gem': ['BeholderPos', 'BeholderDimension'], 'alexscaves:remote_detonator': ['BombPos', 'BombDimension'] }
const LINKED_TICKS = 200
const LAST_SIZE = 50                   // removals kept for /loaderban
const VOICE = { tag: '[Chunk Loaders]', tagColor: 'dark_red', textColor: 'red' }
const MESSAGE = 'Chunk loaders have been banned. Any you had are gone.'
const DATA_KEY = 'chunk_loader_ban'

// ===================== STATE =====================

let Serializer = null
try { Serializer = Java.loadClass('net.minecraft.network.chat.Component$Serializer') } catch (e) { }
let ForgeChunks = null, ForcedData = null
try { ForgeChunks = Java.loadClass('net.minecraftforge.common.world.ForgeChunkManager') } catch (e) { }
try { ForcedData = Java.loadClass('net.minecraft.world.level.ForcedChunksSavedData') } catch (e) { }
// Forge's call by its full signature: Rhino can't choose between its three forms (checked on the test server).
const FORCE_BY_UUID = 'forceChunk(net.minecraft.server.level.ServerLevel,java.lang.String,java.util.UUID,int,int,boolean,boolean)'
const S = { queue: [], told: {}, reported: {}, pending: {} }
let data = null

function db() {
  if (data) return data
  data = { removed: 0, items: 0, last: [] }                // + held, baseline, released (see CHUNKS FORCED THE VANILLA WAY)
  let raw = ''
  try { raw = String(Utils.server.persistentData.getString(DATA_KEY) || '') } catch (e) { }
  if (raw) {
    try {
      let d = JSON.parse(raw)
      if (d && typeof d.removed == 'number') data = d
    } catch (e) {
      console.error('[ChunkLoaderBan] Saved data could not be read; a copy is kept')
      try { Utils.server.persistentData.putString(DATA_KEY + '_unreadable_' + Date.now(), raw) } catch (e2) { }
    }
  }
  return data
}
function save() {
  try { Utils.server.persistentData.putString(DATA_KEY, JSON.stringify(db())) } catch (e) { console.error('[ChunkLoaderBan] Save failed: ' + e) }
}

// ===================== HELPERS =====================

function comp(parts) {
  const json = JSON.stringify([''].concat(parts))
  if (Serializer) { try { return Serializer.fromJsonLenient(json) } catch (e) { } }
  return Text.of(parts.map(p => (typeof p == 'string' ? p : p.text || '')).join(''))
}
function tell(p, text) { try { p.tell(comp([{ text: VOICE.tag + ' ', color: VOICE.tagColor, bold: true }, { text: text, color: VOICE.textColor }])) } catch (e) { } }
function nameOf(p) { try { return String(p.getGameProfile().getName()) } catch (e) { return '?' } }
function uuidOf(p) {
  try { return String(p.getStringUuid()).toLowerCase() } catch (e) { }
  try { return String(p.getStringUUID()).toLowerCase() } catch (e) { return nameOf(p) }
}
function isBanned(id) { return BANNED.indexOf(String(id || '')) >= 0 }
function stackId(s) { try { return s && !s.isEmpty() ? String(s.id) : '' } catch (e) { return '' } }
function emptyStack() { try { return Item.empty } catch (e) { return Item.of('minecraft:air') } }
function dimOf(level) {
  let d = level.dimension
  if (typeof d == 'function') d = level.dimension()
  if (d != null && typeof d.location == 'function') d = d.location()
  return String(d)
}
function tellOnce(p) {
  const u = uuidOf(p)
  if (S.told[u]) return
  S.told[u] = true
  tell(p, MESSAGE)
}

// ===================== PLACED LOADERS =====================

function found(list) { (list || []).forEach(f => { if (f && isBanned(f.id)) S.queue.push(f) }) }
function takeStartupQueue() {
  const q = global.chunkLoaderBanQueue
  if (!q || !q.length) return
  found(q.splice(0, q.length))
}
// Replaces each found loader with air, if it's still there: `setblock … air` replaces without drops (nothing refunded)
// and runs the block entity's removal, which releases its chunks.
function removeQueued(server) {
  takeStartupQueue()
  if (!S.queue.length) return
  const D = db(), batch = S.queue.splice(0, S.queue.length), seen = {}
  let n = 0
  batch.forEach(f => {
    let key = f.dim + ' ' + f.x + ' ' + f.y + ' ' + f.z
    if (seen[key]) return
    seen[key] = true
    let at = f.x + ' ' + f.y + ' ' + f.z, r = 0
    try { r = server.runCommandSilent('execute in ' + f.dim + ' if block ' + at + ' ' + f.id + ' run setblock ' + at + ' minecraft:air') } catch (e) { console.error('[ChunkLoaderBan] ' + key + ': ' + e) }
    if (!(r > 0)) return
    n++
    D.removed++
    D.last.unshift({ t: Date.now(), id: f.id, dim: f.dim, x: f.x, y: f.y, z: f.z })
    console.info('[ChunkLoaderBan] Removed ' + f.id + ' at ' + key)
  })
  if (D.last.length > LAST_SIZE) D.last.length = LAST_SIZE
  if (n) save()
}
function loop(server) {
  const token = (global.__chunkLoaderBanLoop = (global.__chunkLoaderBanLoop || 0) + 1)   // one loop, even after /reload
  let ticks = 0
  const tick = () => {
    if (global.__chunkLoaderBanLoop != token) return
    try { removeQueued(server) } catch (e) { console.error('[ChunkLoaderBan] ' + e) }
    ticks += CHECK_TICKS
    if (ticks % FORCED_TICKS < CHECK_TICKS) { try { releaseForced(server) } catch (e) { console.error('[ChunkLoaderBan] forced chunks: ' + e) } }
    server.scheduleInTicks(CHECK_TICKS, tick)
  }
  server.scheduleInTicks(CHECK_TICKS, tick)
}
ServerEvents.loaded(event => {
  if (!global.chunkLoaderBanHooksInstalled) console.warn('[ChunkLoaderBan] startup_scripts/chunk_loader_ban_hooks.js is not loaded: loaders already placed are only removed when right-clicked. Add it and restart.')
  loop(event.server)
})
try { if (Utils.server) loop(Utils.server) } catch (e) { }   // after /reload

// ===================== CHUNKS FORCED THE VANILLA WAY =====================

// D.held: dimension -> { 'cx,cz': 1 }, chunks a /forceload command asked for. D.baseline: what was already forced when this
// was first installed (nobody knows by whom): kept until /loaderban release. D.released: how many have been let go.
function held(D, dim) { if (!D.held) D.held = {}; if (!D.held[dim]) D.held[dim] = {}; return D.held[dim] }
function levels(server) { const out = []; server.getAllLevels().forEach(lv => out.push(lv)); return out }
// A level's forced chunks as [x, z]. They're packed in one long each: x in the low 32 bits, z in the high 32.
function forcedIn(level) {
  const out = [], set = level.getForcedChunks()
  if (set == null || set.isEmpty()) return out
  const arr = set.toLongArray()
  for (let i = 0; i < arr.length; i++) {
    let l = Number(arr[i]), x = ((l % 4294967296) + 4294967296) % 4294967296
    if (x >= 2147483648) x -= 4294967296
    out.push([x, Math.floor(l / 4294967296)])
  }
  return out
}
function takeBaseline(server) {
  const D = db()
  if (D.baseline) return
  D.baseline = {}
  const told = []
  levels(server).forEach(lv => {
    const dim = dimOf(lv), keep = held(D, dim)
    const list = forcedIn(lv).map(c => c[0] + ',' + c[1]).filter(k => !keep[k])
    if (!list.length) return
    D.baseline[dim] = list
    told.push(list.length + ' in ' + dim)
  })
  save()
  if (told.length) console.warn('[ChunkLoaderBan] Chunks already forced when this was installed: ' + told.join(', ') + '. With no event on, /loaderban release lets them go.')
}
// Lets go of every forced chunk nobody asked for with /forceload. Returns how many.
function releaseForced(server) {
  if (!RELEASE_FORCED) return 0
  const D = db()
  takeBaseline(server)
  let total = 0
  levels(server).forEach(lv => {
    const all = forcedIn(lv)
    if (!all.length) return
    const dim = dimOf(lv), keep = held(D, dim), old = D.baseline[dim] || []
    const extra = all.filter(c => !keep[c[0] + ',' + c[1]] && old.indexOf(c[0] + ',' + c[1]) < 0)
    if (!extra.length) return
    extra.forEach(c => lv.setChunkForced(c[0], c[1], false))
    total += extra.length
    S.pending[dim] = (S.pending[dim] || 0) + extra.length
    const now = Date.now()
    if (S.reported[dim] && now - S.reported[dim] < REPORT_MINUTES * 60000) return
    S.reported[dim] = now
    console.info('[ChunkLoaderBan] Let go of ' + S.pending[dim] + ' chunk(s) a mod had force-loaded in ' + dim + ' (the last at chunk ' + extra[0][0] + ' ' + extra[0][1] + ')')
    S.pending[dim] = 0
  })
  if (total) { D.released = (D.released || 0) + total; save() }
  return total
}
// The chunks left from before: let go of, but for any a /forceload command has asked for since.
function releaseBaseline(server) {
  const D = db()
  takeBaseline(server)
  let total = 0
  levels(server).forEach(lv => {
    const dim = dimOf(lv), keep = held(D, dim), old = D.baseline[dim] || []
    if (!old.length) return
    forcedIn(lv).forEach(c => {
      const k = c[0] + ',' + c[1]
      if (keep[k] || old.indexOf(k) < 0) return
      lv.setChunkForced(c[0], c[1], false)
      total++
    })
  })
  D.baseline = {}
  D.released = (D.released || 0) + total
  save()
  return total
}
// A /forceload command, typed or run by a script: what it asks for is kept, and what it lets go of forgotten.
// 'execute in <dim> run forceload add|remove <x> <z> [<x2> <z2>]' or 'forceload remove all', blocks or ~.
function hearForceload(event) {
  const input = String(event.getInput())
  if (input.indexOf('forceload') < 0) return
  const m = input.match(/(?:^|[\s\/:])forceload\s+(add|remove)\s+(all|\S+\s+\S+(?:\s+\S+\s+\S+)?)\s*$/)
  if (!m) return
  const src = event.getParseResults().getContext().getSource()
  const inDim = input.match(/(?:^|\s)in\s+([a-z0-9_.\-]+:[a-z0-9_.\-\/]+)\s+run\s+(?:minecraft:)?forceload\s/)
  const dim = inDim ? inDim[1] : dimOf(src.getLevel())
  const D = db(), keep = held(D, dim)
  if (m[2] == 'all') { if (m[1] == 'remove') D.held[dim] = {}; save(); return }
  let at = null
  const n = m[2].split(/\s+/).map((t, i) => {
    if (t.charAt(0) != '~') return Math.floor(Number(t))
    if (!at) at = src.getPosition()
    return Math.floor(Number(i % 2 ? at.z() : at.x()) + Number(t.slice(1) || 0))
  })
  if (n.some(v => !isFinite(v))) return
  const x1 = Math.floor(n[0] / 16), z1 = Math.floor(n[1] / 16), x2 = n.length > 2 ? Math.floor(n[2] / 16) : x1, z2 = n.length > 3 ? Math.floor(n[3] / 16) : z1
  if ((Math.abs(x2 - x1) + 1) * (Math.abs(z2 - z1) + 1) > 256) return      // Minecraft refuses these
  for (let x = Math.min(x1, x2); x <= Math.max(x1, x2); x++) {
    for (let z = Math.min(z1, z2); z <= Math.max(z1, z2); z++) { if (m[1] == 'add') keep[x + ',' + z] = 1; else delete keep[x + ',' + z] }
  }
  save()
}
ServerEvents.command(event => { try { hearForceload(event) } catch (e) { console.error('[ChunkLoaderBan] forceload: ' + e) } })

// ===================== ALEX'S CAVES' LINKED ITEMS =====================

function levelOf(server, dim) { let hit = null; levels(server).forEach(lv => { if (dimOf(lv) == dim) hit = lv }); return hit }
// The 3 x 3 chunks one of these holds for the player who used it.
function releaseLinked(server, uuid, dim, x, z) {
  const level = levelOf(server, dim)
  if (!level || !ForgeChunks) return 0
  const cx = Math.floor(x / 16), cz = Math.floor(z / 16)
  let n = 0
  for (let dx = -1; dx <= 1; dx++) {
    for (let dz = -1; dz <= 1; dz++) { if (ForgeChunks[FORCE_BY_UUID](level, 'alexscaves', uuid, cx + dx, cz + dz, false, true)) n++ }
  }
  if (n) console.info('[ChunkLoaderBan] Let go of ' + n + ' chunks held by an Alex\'s Caves item in ' + dim + ' at chunk ' + cx + ' ' + cz)
  return n
}
ItemEvents.rightClicked(event => {
  const link = LINKED[stackId(event.item)]
  if (!link || !event.player) return
  try {
    let tag = event.item.nbt
    if (tag == null || !tag.contains(link[0]) || !tag.contains(link[1])) return
    let pos = tag.getCompound(link[0]), dim = String(tag.getString(link[1])), server = event.server || Utils.server
    let x = Number(pos.getInt('X')), z = Number(pos.getInt('Z')), uuid = event.player.getUuid()
    server.scheduleInTicks(LINKED_TICKS, () => { try { releaseLinked(server, uuid, dim, x, z) } catch (e) { console.error('[ChunkLoaderBan] linked item: ' + e) } })
  } catch (e) { console.error('[ChunkLoaderBan] linked item: ' + e) }
})

// ===================== NO NEW LOADERS =====================

ServerEvents.recipes(event => {
  try { event.remove({ output: '@' + MOD }) } catch (e) { console.error('[ChunkLoaderBan] recipes: ' + e) }
  try { event.remove({ mod: MOD }) } catch (e) { }
  BANNED.concat(NO_RECIPE).forEach(id => { try { event.remove({ output: id }) } catch (e) { console.error('[ChunkLoaderBan] recipes of ' + id + ': ' + e) } })
})

BlockEvents.placed(event => {
  if (!isBanned(event.block.id)) return
  if (event.player) tell(event.player, 'Chunk loaders have been banned. It won\'t go down.')
  event.cancel()
})

BlockEvents.rightClicked(event => {
  const b = event.block
  if (!isBanned(b.id)) return
  let dim = ''
  try { dim = dimOf(event.level) } catch (e) { try { dim = String(b.getDimension()) } catch (e2) { } }
  if (dim) S.queue.push({ dim: dim, x: Number(b.x), y: Number(b.y), z: Number(b.z), id: String(b.id) })
  if (event.player) tellOnce(event.player)
  event.cancel()
})

// ===================== LOADER ITEMS =====================

// Empties banned stacks from a container. Returns how many stacks went.
function sweep(inv) {
  let n = 0, size = 0
  try { size = Number(typeof inv.getContainerSize == 'function' ? inv.getContainerSize() : inv.containerSize) } catch (e) { return 0 }
  for (let i = 0; i < size; i++) {
    let s = null
    try { s = inv.getItem(i) } catch (e) { }
    if (!isBanned(stackId(s))) continue
    try { inv.setItem(i, emptyStack()); n++ } catch (e) { }
  }
  return n
}
function sweepPlayer(p) {
  let n = sweep(p.inventory)
  try {
    let menu = p.containerMenu
    if (menu && isBanned(stackId(menu.getCarried()))) { menu.setCarried(emptyStack()); n++ }
  } catch (e) { }
  if (n) {
    db().items += n
    save()
    tellOnce(p)
    console.info('[ChunkLoaderBan] Took ' + n + ' loader stack(s) from ' + nameOf(p))
  }
  return n
}

// Minecraft hands this event a copy of the changed item: it's only used to notice, then the real inventory is swept.
PlayerEvents.inventoryChanged(event => {
  if (!isBanned(stackId(event.item))) return
  sweepPlayer(event.player)
})
PlayerEvents.loggedIn(event => {
  const p = event.player
  let n = sweepPlayer(p)
  try { n += sweep(p.enderChestInventory) } catch (e) { }
  if (n) tellOnce(p)
})
PlayerEvents.chestOpened(event => {
  let n = 0
  try { n = sweep(event.inventory) } catch (e) { }
  if (!n) return
  db().items += n
  save()
  tellOnce(event.player)
})
EntityEvents.spawned(event => {
  const e = event.entity
  let item = null
  try { if (String(e.getEncodeId()) != 'minecraft:item') return } catch (err) { return }
  try { item = e.getItem() } catch (err) { try { item = e.item } catch (err2) { } }
  if (!isBanned(stackId(item))) return
  event.cancel()
})

// ===================== COMMAND =====================

// Chunks mods hold through Forge (not /forceload) in a level: block and entity tickets together; null if it can't be read.
function forgeHeld(level) {
  if (!ForcedData) return null
  try {
    let d = level.getDataStorage().get(tag => ForcedData.load(tag), 'chunks'), n = 0
    if (d == null) return 0
    ;[d.getBlockForcedChunks(), d.getEntityForcedChunks()].forEach(t => [t.getChunks(), t.getTickingChunks()].forEach(m => m.values().forEach(set => { n += Number(set.size()) })))
    return n
  } catch (e) { return null }
}
function report(server) {
  const D = db(), out = []
  takeBaseline(server)
  levels(server).forEach(lv => {
    const dim = dimOf(lv), all = forcedIn(lv), keep = held(D, dim), old = D.baseline[dim] || [], forge = forgeHeld(lv)
    const asked = all.filter(c => keep[c[0] + ',' + c[1]]).length, before = all.filter(c => !keep[c[0] + ',' + c[1]] && old.indexOf(c[0] + ',' + c[1]) >= 0).length
    if (!all.length && !forge) return
    out.push(dim + ': ' + asked + ' forced with /forceload' + (before ? ', ' + before + ' from before this was installed (/loaderban release)' : '') +
      (all.length - asked - before ? ', ' + (all.length - asked - before) + ' by a mod (about to be let go)' : '') + (forge ? ', ' + forge + ' held by a mod through Forge' : ''))
  })
  if (!out.length) out.push('No chunks are being kept loaded.')
  out.push((D.released || 0) + ' let go of so far.')
  return out
}

ServerEvents.commandRegistry(event => {
  const Commands = event.commands
  const reply = (ctx, text) => { ctx.source.sendSystemMessage(comp([{ text: VOICE.tag + ' ', color: VOICE.tagColor }, { text: text, color: 'gray' }])); return 1 }
  event.register(Commands.literal('loaderban').requires(src => src.hasPermission(2)).executes(ctx => {
    const D = db()
    reply(ctx, D.removed + ' placed loader' + (D.removed == 1 ? '' : 's') + ' removed, ' + D.items + ' loader stack' + (D.items == 1 ? '' : 's') + ' taken. ' +
      (global.chunkLoaderBanHooksInstalled ? 'The chunk hook is loaded.' : 'The chunk hook is NOT loaded (add startup_scripts/chunk_loader_ban_hooks.js and restart).'))
    D.last.slice(0, 10).forEach(r => reply(ctx, new Date(r.t).toISOString().slice(0, 16).replace('T', ' ') + ' ' + r.id + ' at ' + r.dim + ' ' + r.x + ' ' + r.y + ' ' + r.z))
    report(ctx.source.server).forEach(t => reply(ctx, t))
    return 1
  })
  .then(Commands.literal('release').executes(ctx => {
    const n = releaseBaseline(ctx.source.server)
    return reply(ctx, n ? 'Let go of ' + n + ' chunks that were forced before this was installed.' : 'No chunks are left from before this was installed.')
  })))
})

// ===================== API =====================

global.ChunkLoaderBan = {
  found: list => found(list),
  isBanned: id => isBanned(id),
  stats: () => JSON.parse(JSON.stringify(db())),
  releaseForced: server => releaseForced(server || Utils.server),       // what the loop does
  releaseLinked: (uuid, dim, x, z) => releaseLinked(Utils.server, uuid, String(dim), Number(x), Number(z)),
  report: server => report(server || Utils.server),
}

})()
