// chunk_loader_ban.js + startup_scripts/chunk_loader_ban_hooks.js: ChickenChunks' loaders and AE2's Spatial Anchor banned
// and removed; chunks other mods force-load let go of.
// Run with: node tools/tests/run_all.js chunk_loader_ban   (or node tools/tests/suites/chunk_loader_ban.test.js)
const fs = require('fs')
const paths = require('../lib/paths')
const serverSrc = fs.readFileSync(paths.server('chunk_loader_ban.js'), 'utf8')
const hookSrc = fs.readFileSync(paths.kubejs('startup_scripts/chunk_loader_ban_hooks.js'), 'utf8')
let fails = 0
const ok = (l, c, e) => { console.log((c ? 'ok   ' : 'FAIL ') + l + (!c && e !== undefined ? '  ' + e : '')); if (!c) fails++ }

// ---------- the mock ----------
const EXIT = { exit: true }
const persistent = {}, cmds = [], logs = []
let tick = 0, queue = []
const world = {}            // 'dim x y z' -> block id
const players = []
const jlist = arr => ({ size: () => arr.length, get: i => arr[i] })
// ---- levels: the chunks forced in each, as Minecraft keeps them (a set of longs), and Forge's own tickets ----
const DIMS = ['minecraft:overworld', 'minecraft:the_nether', 'aether:the_aether']
const forced = {}, forge = {}, forgeCalls = []
let forgeUnreadable = false
const pack = (x, z) => (x < 0 ? x + 4294967296 : x) + z * 4294967296
const tracker = n => ({ getChunks: () => new Map(), getTickingChunks: () => new Map(n ? [['owner', { size: () => n }]] : []) })
const levels = DIMS.map(dim => { forced[dim] = new Map(); forge[dim] = 0; return {
  dimension: dim,
  getForcedChunks: () => ({ isEmpty: () => !forced[dim].size, toLongArray: () => [...forced[dim].values()].map(c => pack(c[0], c[1])) }),
  setChunkForced: (x, z, on) => { const k = x + ',' + z, had = forced[dim].has(k); if (on) forced[dim].set(k, [x, z]); else forced[dim].delete(k); return on != had },
  getDataStorage: () => ({ get: (f, name) => { if (forgeUnreadable) throw new Error('no'); return name == 'chunks' ? { getBlockForcedChunks: () => tracker(forge[dim]), getEntityForcedChunks: () => tracker(0) } : null } }),
} })
const inDim = dim => [...forced[dim].keys()].sort().join(' ')
// What runs any command: the command event first (as Forge fires it), then /forceload itself.
function command(c, at) {
  const input = c.replace(/^\//, '')
  H.command.forEach(h => h({ getInput: () => input, getParseResults: () => ({ getContext: () => ({ getSource: () => ({ getLevel: () => levels.find(l => l.dimension == ((at && at.dim) || DIMS[0])), getPosition: () => ({ x: () => at.x, z: () => at.z }) }) }) }) }))
  const m = input.match(/^(?:execute in (\S+) run )?forceload (add|remove) (all|.*)$/)
  if (!m) return
  const dim = m[1] || (at && at.dim) || DIMS[0], lv = levels.find(l => l.dimension == dim)
  if (m[3] == 'all') { forced[dim].clear(); return }
  const n = m[3].trim().split(/\s+/).map((t, i) => Math.floor((t[0] == '~' ? (i % 2 ? at.z : at.x) + Number(t.slice(1) || 0) : Number(t)) / 16))
  const x2 = n.length > 2 ? n[2] : n[0], z2 = n.length > 3 ? n[3] : n[1]
  for (let x = Math.min(n[0], x2); x <= Math.max(n[0], x2); x++) for (let z = Math.min(n[1], z2); z <= Math.max(n[1], z2); z++) lv.setChunkForced(x, z, m[2] == 'add')
}
const server = {
  get players() { return jlist(players) },
  persistentData: { getString: k => persistent[k] || '', putString: (k, v) => { persistent[k] = v } },
  scheduleInTicks: (n, f) => queue.push({ at: tick + n, f }),
  getAllLevels: () => levels,
  runCommandSilent: c => {
    cmds.push(c)
    if (/forceload/.test(c)) { command(c); return 1 }
    const m = c.match(/^execute in (\S+) if block (\S+) (\S+) (\S+) (\S+) run setblock \S+ \S+ \S+ minecraft:air$/)
    if (!m) return 1
    const key = m[1] + ' ' + m[2] + ' ' + m[3] + ' ' + m[4]
    if (world[key] != m[5]) return 0
    delete world[key]
    return 1
  },
}
function advance(n) { for (let i = 0; i < n; i++) { tick++; const due = queue.filter(q => q.at <= tick); queue = queue.filter(q => q.at > tick); due.forEach(q => q.f()) } }
const EMPTY = { id: 'minecraft:air', isEmpty: () => true }
const stack = id => ({ id, isEmpty: () => false })
function container(n) {
  const slots = []
  for (let i = 0; i < n; i++) slots.push(EMPTY)
  return { slots, getContainerSize: () => n, getItem: i => slots[i], setItem: (i, s) => { slots[i] = s } }
}
const text = c => (Array.isArray(c) ? c.map(x => (typeof x == 'string' ? x : x.text)).join('') : String(c))
function player(name, op) {
  const p = { name, op: !!op, msgs: [], inventory: container(41), enderChestInventory: container(27), carried: EMPTY,
    getGameProfile: () => ({ getName: () => name }), getStringUuid: () => 'u-' + name, tell: c => p.msgs.push(text(c)) }
  p.containerMenu = { getCarried: () => p.carried, setCarried: s => { p.carried = s } }
  players.push(p)
  return p
}

const H = { command: [], itemClicked: [], loaded: [], recipes: [], placed: [], rightClicked: [], inventoryChanged: [], loggedIn: [], chestOpened: [], spawned: [], chunk: [] }
let cmdTree = null
const node = (n) => ({ n, ch: [], req: null, f: null, then(c) { this.ch.push(c); return this }, requires(f) { this.req = f; return this }, executes(f) { this.f = f; return this } })
const global = {}
let serverStarted = false
const Java = { loadClass: c => {
  if (/Serializer/.test(c)) return { fromJsonLenient: j => JSON.parse(j) }
  if (/ForgeRegistries/.test(c)) return { BLOCKS: { getKey: b => b.id } }
  if (/ForgeChunkManager/.test(c)) return { 'forceChunk(net.minecraft.server.level.ServerLevel,java.lang.String,java.util.UUID,int,int,boolean,boolean)': (lv, mod, uuid, x, z, add, ticking) => {
    forgeCalls.push([lv.dimension, mod, uuid, x, z, add, ticking].join(' ')); return true } }
  if (/ForcedChunksSavedData/.test(c)) return { load: () => null }
  throw new Error('no ' + c)
} }
const consoleMock = { info: m => logs.push(m), warn: m => logs.push('WARN ' + m), error: m => logs.push('ERR ' + m) }
function loadHook() {
  new Function('ForgeEvents', 'Java', 'global', 'console', hookSrc)(
    { onEvent: (name, h) => { if (/ChunkEvent\$Load/.test(name)) H.chunk.push(h) } }, Java, global, consoleMock)
}
function loadServer() {
  new Function('ServerEvents', 'BlockEvents', 'PlayerEvents', 'EntityEvents', 'Java', 'Utils', 'Item', 'Text', 'console', 'global', 'ItemEvents', serverSrc)(
    { command: h => H.command.push(h), loaded: h => H.loaded.push(h), recipes: h => H.recipes.push(h), commandRegistry: h => h({ commands: { literal: node }, register: t => { cmdTree = t } }) },
    { placed: h => H.placed.push(h), rightClicked: h => H.rightClicked.push(h) },
    { inventoryChanged: h => H.inventoryChanged.push(h), loggedIn: h => H.loggedIn.push(h), chestOpened: h => H.chestOpened.push(h) },
    { spawned: h => H.spawned.push(h) },
    Java, { get server() { return serverStarted ? server : null } }, { empty: EMPTY, of: id => stack(id) }, { of: s => s }, consoleMock, global, { rightClicked: h => H.itemClicked.push(h) })
}
function fire(kind, ev) {
  let cancelled = false
  ev.cancel = () => { cancelled = true; throw EXIT }
  H[kind].forEach(h => { try { h(ev) } catch (e) { if (e !== EXIT) throw e } })
  return cancelled
}
// A chunk with block entities at these spots ({x,y,z,id}); the hook reads getBlockEntitiesPos and getBlockState.
function chunkEvent(dim, bes, clientSide) {
  const changed = { world: false }
  const posList = bes.map(b => ({ getX: () => b.x, getY: () => b.y, getZ: () => b.z, b }))
  const ev = {
    // as KubeJS gives a level: dimension is the id, not a method (calling it throws on the real server)
    getLevel: () => ({ isClientSide: () => !!clientSide, dimension: { toString: () => dim }, setBlock() { changed.world = true } }),
    getChunk: () => ({ getBlockEntitiesPos: () => posList, getBlockState: pos => ({ getBlock: () => ({ id: pos.b.id }) }) }),
  }
  H.chunk.forEach(h => h(ev))
  return changed
}
const place = (dim, x, y, z, id) => { world[dim + ' ' + x + ' ' + y + ' ' + z] = id }
const at = (dim, x, y, z) => world[dim + ' ' + x + ' ' + y + ' ' + z]
const DB = () => JSON.parse(persistent.chunk_loader_ban || '{"removed":0,"items":0,"last":[]}')
function run(as, sub) {
  const replies = []
  const src = { hasPermission: () => !!as.op, sendSystemMessage: c => replies.push(text(c)) }
  if (cmdTree.req && !cmdTree.req(src)) return ['DENIED']
  src.server = server
  ;(sub ? cmdTree.ch.find(x => x.n == sub) : cmdTree).f({ source: src })
  return replies
}

// ---------- server start: the hook runs before the server scripts ----------
const OW = 'minecraft:overworld', NE = 'minecraft:the_nether'
loadHook()
place(OW, 100, 64, 200, 'chickenchunks:chunk_loader')
place(NE, -5, 40, 9, 'chickenchunks:spot_loader')
place(OW, 101, 64, 200, 'minecraft:chest')
let c = chunkEvent(OW, [{ x: 100, y: 64, z: 200, id: 'chickenchunks:chunk_loader' }, { x: 101, y: 64, z: 200, id: 'minecraft:chest' }])
chunkEvent(NE, [{ x: -5, y: 40, z: 9, id: 'chickenchunks:spot_loader' }])
ok('the hook notes only the loaders, in a queue until the server script loads', global.chunkLoaderBanQueue && global.chunkLoaderBanQueue.length == 2 &&
  global.chunkLoaderBanQueue[0].id == 'chickenchunks:chunk_loader' && global.chunkLoaderBanQueue[0].dim == OW && global.chunkLoaderBanQueue[1].dim == NE, JSON.stringify(global.chunkLoaderBanQueue))
ok('... and changes nothing in the world while the chunk loads', !c.world && cmds.length == 0)
chunkEvent(OW, [{ x: 0, y: 0, z: 0, id: 'chickenchunks:chunk_loader' }], true)
ok('a client-side chunk is ignored', global.chunkLoaderBanQueue.length == 2)
ok('the hook says it is installed', global.chunkLoaderBanHooksInstalled == 1)

levels[0].setChunkForced(40, -40, true); levels[0].setChunkForced(41, -40, true); levels[2].setChunkForced(-3000, 5, true)   // from before: nobody knows by whom
loadServer()
serverStarted = true
H.loaded.forEach(h => h({ server }))
server.runCommandSilent('execute in minecraft:overworld run forceload add 656 -640')    // a script's own, asked for again at start-up: chunk 41 -40
ok('no warning when the hook is loaded', !logs.some(l => /is not loaded/.test(l)))
advance(20)
ok('within a second both placed loaders are replaced with air', at(OW, 100, 64, 200) === undefined && at(NE, -5, 40, 9) === undefined)
ok('... by setblock in the right dimension (a replace: no drops, no refund)', cmds.some(x => /^execute in minecraft:the_nether if block -5 40 9 chickenchunks:spot_loader run setblock -5 40 9 minecraft:air$/.test(x)))
ok('... the chest beside one is untouched', at(OW, 101, 64, 200) == 'minecraft:chest')
ok('... logged and counted', logs.some(l => /Removed chickenchunks:chunk_loader at minecraft:overworld 100 64 200/.test(l)) && DB().removed == 2 && DB().last.length == 2)
ok('... and the startup queue is emptied', global.chunkLoaderBanQueue.length == 0)

// a chunk loading later goes straight to the server script
place(OW, 7, 70, 7, 'chickenchunks:chunk_loader')
chunkEvent(OW, [{ x: 7, y: 70, z: 7, id: 'chickenchunks:chunk_loader' }])
ok('a loader in a chunk loaded later goes straight to the script', global.chunkLoaderBanQueue.length == 0)
advance(20)
ok('... and is removed', at(OW, 7, 70, 7) === undefined && DB().removed == 3)
// already gone (broken by someone first): skipped, not counted
chunkEvent(OW, [{ x: 8, y: 70, z: 8, id: 'chickenchunks:chunk_loader' }])
advance(20)
ok('a spot where the loader is already gone is skipped, not counted', DB().removed == 3)
// the same spot reported twice in one batch
place(OW, 9, 70, 9, 'chickenchunks:spot_loader')
chunkEvent(OW, [{ x: 9, y: 70, z: 9, id: 'chickenchunks:spot_loader' }])
chunkEvent(OW, [{ x: 9, y: 70, z: 9, id: 'chickenchunks:spot_loader' }])
const n0 = cmds.length
advance(20)
ok('the same spot twice in a batch is tried once', cmds.length - n0 == 1 && DB().removed == 4)

// ---------- no new loaders ----------
const removed = []
H.recipes.forEach(h => h({ remove: f => removed.push(f) }))
ok('recipes: every recipe making a ChickenChunks item, and its own recipes, are removed', removed.some(f => f.output == '@chickenchunks') && removed.some(f => f.mod == 'chickenchunks'))
ok('... and those of the other loaders: AE2\'s Spatial Anchor, Mekanism\'s Dimensional Stabilizer and Anchor Upgrade', ['ae2:spatial_anchor', 'mekanism:dimensional_stabilizer', 'mekanism:upgrade_anchor'].every(i => removed.some(f => f.output == i)))
const ana = player('Ana'), admin = player('Admin', true)
ok('placing a Chunk Loader is refused, with a message', fire('placed', { block: { id: 'chickenchunks:chunk_loader' }, player: ana }) && /won't go down/.test(ana.msgs[0]))
ok('... placing anything else is not', !fire('placed', { block: { id: 'minecraft:stone' }, player: ana }))
ok('... ops are refused too', fire('placed', { block: { id: 'chickenchunks:spot_loader' }, player: admin }))
place(OW, 50, 65, 50, 'chickenchunks:chunk_loader')
ok('right-clicking a loader: no GUI (cancelled)', fire('rightClicked', { block: { id: 'chickenchunks:chunk_loader', x: 50, y: 65, z: 50 }, level: { dimension: OW }, player: ana }))
advance(20)
ok('... and it is removed', at(OW, 50, 65, 50) === undefined && DB().removed == 5)
ok('right-clicking other blocks is left alone', !fire('rightClicked', { block: { id: 'minecraft:chest', x: 0, y: 0, z: 0 }, level: { dimension: OW }, player: ana }))

// ---------- items ----------
const bo = player('Bo')
bo.inventory.slots[3] = stack('chickenchunks:chunk_loader')
bo.inventory.slots[7] = stack('minecraft:diamond')
bo.carried = stack('chickenchunks:spot_loader')
fire('inventoryChanged', { player: bo, item: stack('chickenchunks:chunk_loader') })
ok('a loader item arriving in an inventory: the whole inventory and cursor are swept', bo.inventory.slots[3].isEmpty() && bo.carried.isEmpty() && bo.inventory.slots[7].id == 'minecraft:diamond')
ok('... the player is told once', bo.msgs.filter(m => /Chunk loaders have been banned/.test(m)).length == 1 && DB().items == 2)
bo.inventory.slots[1] = stack('chickenchunks:chunk_loader')
fire('inventoryChanged', { player: bo, item: stack('chickenchunks:chunk_loader') })
ok('... and not told again this session', bo.msgs.filter(m => /Chunk loaders have been banned/.test(m)).length == 1 && bo.inventory.slots[1].isEmpty())
fire('inventoryChanged', { player: bo, item: stack('minecraft:dirt') })
ok('other items changing don\'t trigger a sweep', DB().items == 3)
const cy = player('Cy')
cy.inventory.slots[0] = stack('chickenchunks:spot_loader')
cy.enderChestInventory.slots[5] = stack('chickenchunks:chunk_loader')
fire('loggedIn', { player: cy })
ok('at login, the inventory and ender chest are swept', cy.inventory.slots[0].isEmpty() && cy.enderChestInventory.slots[5].isEmpty() && /banned/.test(cy.msgs[0]))
const chest = container(27)
chest.slots[10] = stack('chickenchunks:chunk_loader')
chest.slots[11] = stack('minecraft:gold_ingot')
fire('chestOpened', { player: ana, inventory: chest })
ok('opening a container sweeps it', chest.slots[10].isEmpty() && chest.slots[11].id == 'minecraft:gold_ingot')
ok('a dropped loader item never lands', fire('spawned', { entity: { getEncodeId: () => 'minecraft:item', getItem: () => stack('chickenchunks:spot_loader') } }))
ok('... other dropped items and mobs do', !fire('spawned', { entity: { getEncodeId: () => 'minecraft:item', getItem: () => stack('minecraft:dirt') } }) &&
  !fire('spawned', { entity: { getEncodeId: () => 'minecraft:zombie' } }))

// ---------- the Spatial Anchor, and Mekanism's items left alone ----------
place(OW, 60, 65, 60, 'ae2:spatial_anchor')
chunkEvent(OW, [{ x: 60, y: 65, z: 60, id: 'ae2:spatial_anchor' }])
advance(20)
ok('a placed Spatial Anchor is removed like a loader', at(OW, 60, 65, 60) === undefined && fire('placed', { block: { id: 'ae2:spatial_anchor' }, player: admin }))
const removedBefore = DB().removed
const dee = player('Dee')
dee.inventory.slots[2] = stack('mekanism:upgrade_anchor')
fire('loggedIn', { player: dee })
ok('an Anchor Upgrade somebody has stays theirs (Mekanism\'s setting makes it do nothing)', dee.inventory.slots[2].id == 'mekanism:upgrade_anchor' && !fire('placed', { block: { id: 'mekanism:dimensional_stabilizer' }, player: dee }))

// ---------- chunks forced the vanilla way ----------
const AE = 'aether:the_aether'
ok('what was forced before the install is noted, not touched', inDim(OW) == '40,-40 41,-40' && inDim(AE) == '-3000,5' && DB().baseline[OW].join() == '40,-40' && DB().baseline[AE].join() == '-3000,5', JSON.stringify(DB().baseline))
ok('... with a line in the log saying how to let it go', logs.some(l => /^WARN .*Chunks already forced when this was installed: 1 in minecraft:overworld, 1 in aether:the_aether\. .*\/loaderban release/.test(l)), logs.filter(l => /installed/.test(l)).join('; '))
ok('a chunk a script asked for with /forceload is on record', DB().held[OW]['41,-40'] == 1)
for (let dx = -1; dx <= 1; dx++) for (let dz = -1; dz <= 1; dz++) { levels[0].setChunkForced(500 + dx, -700 + dz, true); levels[1].setChunkForced(-20 + dx, 3 + dz, true) }   // an eagle's flight
advance(100)
ok('chunks a mod forced are let go of within 5 seconds, in every dimension', inDim(OW) == '40,-40 41,-40' && inDim(NE) == '' && DB().released == 18, inDim(OW) + ' | ' + inDim(NE) + ' | ' + DB().released)
ok('... one line in the log for each dimension', logs.filter(l => /Let go of 9 chunk\(s\) a mod had force-loaded in/.test(l)).length == 2, logs.filter(l => /force-loaded/.test(l)).join('; '))
levels[0].setChunkForced(900, 900, true); advance(100)
ok('... and not another line every 5 seconds', inDim(OW) == '40,-40 41,-40' && logs.filter(l => /force-loaded in minecraft:overworld/.test(l)).length == 1)
server.runCommandSilent('execute in minecraft:the_nether run forceload add -17 33 16 64'); advance(200)
ok('a range a script forces is kept, every chunk of it', inDim(NE).split(' ').length == 12 && Object.keys(DB().held[NE]).length == 12, inDim(NE))
server.runCommandSilent('execute in minecraft:the_nether run forceload remove -17 33 16 64'); levels[1].setChunkForced(-1, 3, true); advance(100)
ok('... and once the script lets go, they\'re nobody\'s again', inDim(NE) == '' && Object.keys(DB().held[NE]).length == 0, inDim(NE))
command('/forceload add ~ ~', { dim: AE, x: -100.5, z: 37 }); advance(100)
ok('an op\'s /forceload where they stand is kept', inDim(AE) == '-3000,5 -7,2' && DB().held[AE]['-7,2'] == 1, inDim(AE))
command('forceload add 0 0 5000 5000', { dim: OW, x: 0, z: 0 }); forced[OW].forEach((c, k) => { if (c[0] >= 0 && c[1] >= 0) forced[OW].delete(k) })
ok('a range Minecraft refuses (over 256 chunks) isn\'t put on record', Object.keys(DB().held[OW]).join() == '41,-40', Object.keys(DB().held[OW]).length)
command('say forceload add 1 1', { dim: OW, x: 0, z: 0 }); command('forceload query', { dim: OW, x: 0, z: 0 }); command('forceload add nonsense here', { dim: OW, x: 0, z: 0 })
ok('other text with the word in it changes nothing', Object.keys(DB().held[OW]).length <= 2 && !DB().held[OW]['NaN,NaN'])
command('forceload remove all', { dim: AE, x: 0, z: 0 })
ok('/forceload remove all forgets that dimension', Object.keys(DB().held[AE]).length == 0)
levels[2].setChunkForced(-3000, 5, true); delete DB().x
let rep = run(admin)
ok('/loaderban says what is kept loaded and by whom', rep.some(t => /minecraft:overworld: 1 forced with \/forceload, 1 from before this was installed \(\/loaderban release\)/.test(t)) && rep.some(t => /aether:the_aether: 0 forced with \/forceload, 1 from before/.test(t)) && rep.some(t => /^.*2\d let go of so far/.test(t)), rep.join(' | '))
forge[NE] = 25; rep = run(admin)
ok('... and what mods hold through Forge', rep.some(t => /minecraft:the_nether: 0 forced with \/forceload, 25 held by a mod through Forge/.test(t)), rep.join(' | '))
forge[NE] = 0; forgeUnreadable = true; rep = run(admin); forgeUnreadable = false
ok('... and still answers if Forge\'s can\'t be read', rep.some(t => /minecraft:overworld: 1 forced/.test(t)))
ok('/loaderban release lets the old ones go, and only those', /Let go of 2 chunks/.test(run(admin, 'release')[0]) && inDim(OW) == '41,-40' && inDim(AE) == '', inDim(OW) + ' | ' + inDim(AE))
ok('... once', /No chunks are left/.test(run(admin, 'release')[0]))

// ---------- Alex's Caves' linked items ----------
const gem = (x, z, dim) => ({ id: 'alexscaves:occult_gem', isEmpty: () => false, nbt: { contains: k => k == 'BeholderPos' || k == 'BeholderDimension', getCompound: () => ({ getInt: k => (k == 'X' ? x : z) }), getString: () => dim } })
ana.getUuid = () => 'JAVA-UUID'
H.itemClicked.forEach(h => h({ item: gem(-5, 170, NE), player: ana, server }))
advance(199)
ok('an Occult Gem\'s chunks are held while it starts to look', forgeCalls.length == 0)
advance(1)
ok('... and let go of 10 seconds after: the 3 x 3 around the Beholder, as that player\'s ticking tickets', forgeCalls.length == 9 && forgeCalls.every(x => /^minecraft:the_nether alexscaves JAVA-UUID -?\d+ \d+ false true$/.test(x)) &&
  forgeCalls[0] == 'minecraft:the_nether alexscaves JAVA-UUID -2 9 false true' && forgeCalls[8] == 'minecraft:the_nether alexscaves JAVA-UUID 0 11 false true', forgeCalls.join('; '))
H.itemClicked.forEach(h => h({ item: { id: 'alexscaves:remote_detonator', isEmpty: () => false, nbt: null }, player: ana, server }))
H.itemClicked.forEach(h => h({ item: stack('minecraft:stick'), player: ana, server }))
H.itemClicked.forEach(h => h({ item: gem(0, 0, 'gone:dimension'), player: ana, server }))
advance(200)
ok('an unlinked one, other items and a dimension that\'s gone do nothing', forgeCalls.length == 9)

// ---------- command, reload ----------
ok('/loaderban is op-only', run(ana)[0] == 'DENIED')
const r = run(admin)
ok('/loaderban reports the counts and that the hook is loaded', /6 placed loaders removed, \d+ loader stacks taken\. The chunk hook is loaded\./.test(r[0]) && r.length >= 6, r[0])
const tokens = global.__chunkLoaderBanLoop
loadServer()
ok('after /reload there is still only one loop', global.__chunkLoaderBanLoop == tokens + 1)
place(OW, 1, 1, 1, 'chickenchunks:chunk_loader')
chunkEvent(OW, [{ x: 1, y: 1, z: 1, id: 'chickenchunks:chunk_loader' }])
advance(40)
ok('... and it still removes loaders', at(OW, 1, 1, 1) === undefined && DB().removed == 7)
levels[1].setChunkForced(77, 77, true); advance(100)
ok('... lets go of forced chunks, and remembers what was asked for', inDim(NE) == '' && inDim(OW) == '41,-40')
ok('the API', global.ChunkLoaderBan.isBanned('chickenchunks:spot_loader') && !global.ChunkLoaderBan.isBanned('minecraft:chest') && global.ChunkLoaderBan.stats().removed == 7)
ok('no errors logged', !logs.some(l => /^ERR/.test(l)), logs.filter(l => /^ERR/.test(l)).join('; '))

console.log(fails ? fails + ' FAILED' : 'ALL PASSED')
