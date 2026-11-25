// Chunk Loader Ban: ChickenChunks' Chunk Loader and Spot Loader are banned (owner decision, for TPS).
//   - No new ones: their recipes are removed, placing one is refused, and right-clicking one removes it.
//   - Placed ones are removed: startup_scripts/chunk_loader_ban_hooks.js notes any loader in a chunk as it loads (each
//     loader keeps its own chunk loaded, so they're found at server start), and this script replaces it with air a
//     moment later. Removing the block runs ChickenChunks' own clean-up (TileChunkLoaderBase.setRemoved ->
//     deactivate -> removeChunkLoader), so its chunks are released.
//   - Loader items vanish from inventories, opened containers and the ground.
//   - Nothing is refunded (owner decision).
// ChickenChunks stays installed. Needs the startup hook (restart once after adding it). See tools/kubejs/CHUNK_LOADER_BAN.md.
// KubeJS 6 (Rhino): no template strings; `let` inside nested blocks; event.cancel() last.

(function () {

// ===================== SETTINGS =====================

const BANNED = ['chickenchunks:chunk_loader', 'chickenchunks:spot_loader']   // blocks and their items (checked in its 1.20.1 source)
const MOD = 'chickenchunks'
const CHECK_TICKS = 20                 // how often found loaders are removed
const LAST_SIZE = 50                   // removals kept for /loaderban
const VOICE = { tag: '[Chunk Loaders]', tagColor: 'dark_red', textColor: 'red' }
const MESSAGE = 'Chunk loaders have been banned. Any you had are gone.'
const DATA_KEY = 'chunk_loader_ban'

// ===================== STATE =====================

let Serializer = null
try { Serializer = Java.loadClass('net.minecraft.network.chat.Component$Serializer') } catch (e) { }
const S = { queue: [], told: {} }
let data = null

function db() {
  if (data) return data
  data = { removed: 0, items: 0, last: [] }
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
  const tick = () => {
    if (global.__chunkLoaderBanLoop != token) return
    try { removeQueued(server) } catch (e) { console.error('[ChunkLoaderBan] ' + e) }
    server.scheduleInTicks(CHECK_TICKS, tick)
  }
  server.scheduleInTicks(CHECK_TICKS, tick)
}
ServerEvents.loaded(event => {
  if (!global.chunkLoaderBanHooksInstalled) console.warn('[ChunkLoaderBan] startup_scripts/chunk_loader_ban_hooks.js is not loaded: loaders already placed are only removed when right-clicked. Add it and restart.')
  loop(event.server)
})
try { if (Utils.server) loop(Utils.server) } catch (e) { }   // after /reload

// ===================== NO NEW LOADERS =====================

ServerEvents.recipes(event => {
  try { event.remove({ output: '@' + MOD }) } catch (e) { console.error('[ChunkLoaderBan] recipes: ' + e) }
  try { event.remove({ mod: MOD }) } catch (e) { }
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

ServerEvents.commandRegistry(event => {
  const Commands = event.commands
  const reply = (ctx, text) => { ctx.source.sendSystemMessage(comp([{ text: VOICE.tag + ' ', color: VOICE.tagColor }, { text: text, color: 'gray' }])); return 1 }
  event.register(Commands.literal('loaderban').requires(src => src.hasPermission(2)).executes(ctx => {
    const D = db()
    reply(ctx, D.removed + ' placed loader' + (D.removed == 1 ? '' : 's') + ' removed, ' + D.items + ' loader stack' + (D.items == 1 ? '' : 's') + ' taken. ' +
      (global.chunkLoaderBanHooksInstalled ? 'The chunk hook is loaded.' : 'The chunk hook is NOT loaded (add startup_scripts/chunk_loader_ban_hooks.js and restart).'))
    D.last.slice(0, 10).forEach(r => reply(ctx, new Date(r.t).toISOString().slice(0, 16).replace('T', ' ') + ' ' + r.id + ' at ' + r.dim + ' ' + r.x + ' ' + r.y + ' ' + r.z))
    return 1
  }))
})

// ===================== API =====================

global.ChunkLoaderBan = {
  found: list => found(list),
  isBanned: id => isBanned(id),
  stats: () => JSON.parse(JSON.stringify(db())),
}

})()
