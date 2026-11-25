// chunk_loader_ban.js + startup_scripts/chunk_loader_ban_hooks.js: ChickenChunks' loaders banned and removed.
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
const server = {
  get players() { return jlist(players) },
  persistentData: { getString: k => persistent[k] || '', putString: (k, v) => { persistent[k] = v } },
  scheduleInTicks: (n, f) => queue.push({ at: tick + n, f }),
  runCommandSilent: c => {
    cmds.push(c)
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

const H = { loaded: [], recipes: [], placed: [], rightClicked: [], inventoryChanged: [], loggedIn: [], chestOpened: [], spawned: [], chunk: [] }
let cmdTree = null
const node = (n) => ({ n, ch: [], req: null, f: null, then(c) { this.ch.push(c); return this }, requires(f) { this.req = f; return this }, executes(f) { this.f = f; return this } })
const global = {}
let serverStarted = false
const Java = { loadClass: c => {
  if (/Serializer/.test(c)) return { fromJsonLenient: j => JSON.parse(j) }
  if (/ForgeRegistries/.test(c)) return { BLOCKS: { getKey: b => b.id } }
  throw new Error('no ' + c)
} }
const consoleMock = { info: m => logs.push(m), warn: m => logs.push('WARN ' + m), error: m => logs.push('ERR ' + m) }
function loadHook() {
  new Function('ForgeEvents', 'Java', 'global', 'console', hookSrc)(
    { onEvent: (name, h) => { if (/ChunkEvent\$Load/.test(name)) H.chunk.push(h) } }, Java, global, consoleMock)
}
function loadServer() {
  new Function('ServerEvents', 'BlockEvents', 'PlayerEvents', 'EntityEvents', 'Java', 'Utils', 'Item', 'Text', 'console', 'global', serverSrc)(
    { loaded: h => H.loaded.push(h), recipes: h => H.recipes.push(h), commandRegistry: h => h({ commands: { literal: node }, register: t => { cmdTree = t } }) },
    { placed: h => H.placed.push(h), rightClicked: h => H.rightClicked.push(h) },
    { inventoryChanged: h => H.inventoryChanged.push(h), loggedIn: h => H.loggedIn.push(h), chestOpened: h => H.chestOpened.push(h) },
    { spawned: h => H.spawned.push(h) },
    Java, { get server() { return serverStarted ? server : null } }, { empty: EMPTY, of: id => stack(id) }, { of: s => s }, consoleMock, global)
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
    getLevel: () => ({ isClientSide: () => !!clientSide, dimension: () => ({ location: () => dim }), setBlock() { changed.world = true } }),
    getChunk: () => ({ getBlockEntitiesPos: () => posList, getBlockState: pos => ({ getBlock: () => ({ id: pos.b.id }) }) }),
  }
  H.chunk.forEach(h => h(ev))
  return changed
}
const place = (dim, x, y, z, id) => { world[dim + ' ' + x + ' ' + y + ' ' + z] = id }
const at = (dim, x, y, z) => world[dim + ' ' + x + ' ' + y + ' ' + z]
const DB = () => JSON.parse(persistent.chunk_loader_ban || '{"removed":0,"items":0,"last":[]}')
function run(as) {
  const replies = []
  const src = { hasPermission: () => !!as.op, sendSystemMessage: c => replies.push(text(c)) }
  if (cmdTree.req && !cmdTree.req(src)) return ['DENIED']
  cmdTree.f({ source: src })
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

loadServer()
serverStarted = true
H.loaded.forEach(h => h({ server }))
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

// ---------- command, reload ----------
ok('/loaderban is op-only', run(ana)[0] == 'DENIED')
const r = run(admin)
ok('/loaderban reports the counts and that the hook is loaded', /5 placed loaders removed, \d+ loader stacks taken\. The chunk hook is loaded\./.test(r[0]) && r.length >= 6, r[0])
const tokens = global.__chunkLoaderBanLoop
loadServer()
ok('after /reload there is still only one loop', global.__chunkLoaderBanLoop == tokens + 1)
place(OW, 1, 1, 1, 'chickenchunks:chunk_loader')
chunkEvent(OW, [{ x: 1, y: 1, z: 1, id: 'chickenchunks:chunk_loader' }])
advance(40)
ok('... and it still removes loaders', at(OW, 1, 1, 1) === undefined && DB().removed == 6)
ok('the API', global.ChunkLoaderBan.isBanned('chickenchunks:spot_loader') && !global.ChunkLoaderBan.isBanned('minecraft:chest') && global.ChunkLoaderBan.stats().removed == 6)
ok('no errors logged', !logs.some(l => /^ERR/.test(l)), logs.filter(l => /^ERR/.test(l)).join('; '))

console.log(fails ? fails + ' FAILED' : 'ALL PASSED')
