// Run with: node tools/tests/run_all.js end_lockdown   (or node tools/tests/suites/end_lockdown.test.js)
const REPO_ROOT = require('path').resolve(__dirname, '..', '..', '..')
// Mock KubeJS 6 server running economy/black_market.js together with factions/portal_ambush.js.
const fs = require('fs')
const snbt = require('../lib/snbt.js')
const BM_FILE = process.env.BM_FILE || REPO_ROOT + '/tools/kubejs/server_scripts/economy/black_market.js'
const BOUNTY_FILE = process.env.BOUNTY_FILE || REPO_ROOT + '/tools/kubejs/server_scripts/economy/bounties.js'
const ELI_FILE = REPO_ROOT + '/tools/kubejs/server_scripts/end_lockdown.js'
const TRIALS_FILE = process.env.TRIALS_FILE || REPO_ROOT + '/tools/kubejs/server_scripts/factions/trials.js'
const PA_FILE = process.env.PA_FILE || REPO_ROOT + '/tools/kubejs/server_scripts/factions/portal_ambush.js'
let fails = 0
const ok = (l, c, e) => { console.log((c ? 'ok   ' : 'FAIL ') + l + (e !== undefined && !c ? '  ' + e : '')); if (!c) fails++ }
class Exit extends Error {}

const OW = 'minecraft:overworld', NE = 'minecraft:the_nether'
const W = { placed: {}, explosions: [], time: 1.7e12, tick: 0, q: [], cmds: [], logs: [], drops: [], persistent: {}, entities: [], recipes: [], dayTime: 15000 }
function Datex(ms) { return arguments.length ? new Date(ms) : new Date(W.time) }
Datex.now = () => W.time

// ---------- NBT / items ----------
function tagWrap(obj, src) {
  return {
    _o: obj,
    contains: k => obj != null && Object.prototype.hasOwnProperty.call(obj, k),
    getCompound: k => tagWrap(obj && typeof obj[k] == 'object' ? obj[k] : {}, null),
    getString: k => (obj && typeof obj[k] == 'string' ? obj[k].replace(/^"|"$/g, '') : ''),
    getInt: k => (obj && obj[k] != null ? parseInt(String(obj[k]), 10) : 0),
    getBoolean: k => (obj && obj[k] != null ? /^(1b|true|1)$/.test(String(obj[k])) : false),
    getLong: k => (obj && obj[k] != null ? parseInt(String(obj[k]), 10) : 0),
    toString: () => src != null ? src : JSON.stringify(obj),
  }
}
function stack(id, count, snbtStr) {
  const parsed = snbtStr ? snbt(snbtStr) : null
  const s = {
    id, count: count == null ? 1 : count, snbtStr: snbtStr || null, parsed,
    get nbt() { return this.parsed ? tagWrap(this.parsed, this.snbtStr) : null },
    isEmpty() { return this.count <= 0 || this.id == 'minecraft:air' },
    getItem() { const id = this.id; const blocks = ['minecraft:stone', 'minecraft:grass_block', 'minecraft:oak_planks', 'minecraft:chest', 'minecraft:tnt', 'minecraft:dirt']; return blocks.indexOf(id) >= 0 ? { getBlock: () => ({ defaultBlockState: () => ({ hasBlockEntity: () => id == 'minecraft:chest' }) }) } : {} },
    getCount() { return this.count },
    shrink(n) { this.count = Math.max(0, this.count - n) },
    copy() { return stack(this.id, this.count, this.snbtStr) },
    getHoverName() { const self = this; return { getString: () => { try { return JSON.parse(self.parsed.display.Name).text } catch (e) { return self.id.split(':')[1] } } } },
  }
  return s
}
const EMPTY = () => stack('minecraft:air', 0)
const sameItem = (a, b) => a.id == b.id && (a.snbtStr || '') == (b.snbtStr || '')

// ---------- world ----------
function blockAt(dim, x, y, z) {
  if (dim == NE) return y >= 127 ? 'minecraft:bedrock' : (y <= 40 ? 'minecraft:netherrack' : 'minecraft:air')
  return y <= 64 ? 'minecraft:stone' : 'minecraft:air'
}
const levels = {}
;[OW, NE].forEach(d => {
  levels[d] = {
    dimension: { toString: () => d },
    getBlock: (x, y, z) => { const id = W.placed[d + '|' + x + '|' + y + '|' + z] || blockAt(d, x, y, z); return { id, blockState: { blocksMotion: () => id != 'minecraft:air' } } },
    createExplosion: (x, y, z) => { const e = { dim: d, x, y, z, strength: 0, mode: null, fire: null, t: W.tick }; const c = { strength(v) { e.strength = v; return c }, causesFire(v) { e.fire = v; return c }, explosionMode(m) { e.mode = m; return c }, exploder() { return c }, explode() { W.explosions.push(e) } }; return c },
    getSharedSpawnPos: () => ({ getX: () => 0, getY: () => 65, getZ: () => 0 }),
    getDifficulty: () => ({ toString: () => 'NORMAL' }),
    getDayTime: () => W.dayTime,
    getWorldBorder: () => ({ isWithinBounds: (x, z) => Math.abs(x) < 5000 && Math.abs(z) < 5000 }),
  }
})
function tags(arr) { return { contains: t => arr.indexOf(t) >= 0, isEmpty: () => arr.length == 0, add: t => arr.push(t), arr } }
let uid = 0
function entity(type, dim, x, y, z, tagList, extra) {
  uid++
  return Object.assign({
    type, dim, x, y, z, _tags: tagList || [], uuid: 'e' + uid + '-0000', removed: false, alive: true, target: null, memories: {},
    get level() { return levels[this.dim] },
    getTags() { return tags(this._tags) }, getStringUuid() { return this.uuid }, getUuid() { return 'J' + this.uuid },
    getX() { return this.x }, getY() { return this.y }, getZ() { return this.z },
    isRemoved() { return this.removed }, isAlive() { return this.alive && !this.removed },
    discard() { this.removed = true }, isPlayer: () => false, getEncodeId() { return type }, addTag(t) { this._tags.push(t); return true },
    getBrain() { const self = this; return { setMemoryWithExpiry: (k, v) => { self.memories[k] = v }, setMemory: (k, v) => { self.memories[k] = v } } },
    setTarget(t) { this.target = t }, getTarget() { return this.target },
    getNavigation() { const self = this; return { moveTo: (x, y, z, s) => { self.nav = { x, y, z, s }; self.navs = (self.navs || 0) + 1; return true }, stop: () => { self.nav = null; self.stopped = true } } },
    get block() { const self = this; return { popItem: item => W.drops.push({ item: item.id, count: item.count, snbt: item.snbtStr, by: self.type }) } },
  }, extra || {})
}
const players = []
function player(name, faction, dim, x, y, z, op) {
  const slots = []
  for (let i = 0; i < 41; i++) slots.push(EMPTY())
  const p = entity('minecraft:player', dim, x, y, z, [], {
    name, faction, inbox: [], creative: false, op: !!op, yaw: 0, pitch: 0, online: true, selected: 0, ground: [],
    getGameProfile() { return { getName: () => this.name } }, isPlayer: () => true, getEncodeId: () => null,
    isCreative() { return this.creative }, isSpectator: () => false, hasPermissions(n) { return this.op },
    tell(c) { this.inbox.push(c && c.json ? c.json : String(c && c.text != null ? c.text : c)) },
    getYRot() { return this.yaw }, getXRot() { return this.pitch },
    drop(s, named) { W.drops.push({ item: s.id, count: s.count, snbt: s.snbtStr, by: 'drop:' + this.name }); return { item: s } },
    inventory: {
      getItem: i => { if (slots[i].count <= 0) slots[i] = EMPTY(); return slots[i] },
      setItem: (i, s) => { slots[i] = s },
      slots,
    },
    give(s) {
      let left = s.count
      for (let i = 0; i < 36 && left > 0; i++) {
        let cur = slots[i]
        if (cur.count > 0 && sameItem(cur, s) && cur.count < 64) { let k = Math.min(64 - cur.count, left); cur.count += k; left -= k }
      }
      for (let i = 0; i < 36 && left > 0; i++) {
        if (slots[i].count <= 0) { let k = Math.min(64, left); slots[i] = stack(s.id, k, s.snbtStr); left -= k }
      }
      if (left > 0) this.ground.push(stack(s.id, left, s.snbtStr))
    },
  })
  p.uuid = name.toLowerCase() + '-1111'
  Object.defineProperty(p, 'mainHandItem', { get() { return p.inventory.getItem(p.selected) } })
  Object.defineProperty(p, 'offHandItem', { get() { return p.inventory.getItem(40) } })
  p.gui = null
  p.openChestGUI = (title, rows, cb) => {
    if (W.noGui) throw new Error('openChestGUI is not a function')
    const g = { title: title.json || String(title), rows, slots: {},
      slot(x, y, fn) { const sl = { x, y, item: null, leftClicked: null, rightClicked: null }; fn(sl); this.slots[x + ',' + y] = sl } }
    cb(g)
    // Like KubeJS: opening a window (when none of its windows is open) takes slots 0-35 away until it closes.
    if (!p.gui && !p._captured) { p._captured = slots.slice(0, 36); for (let i = 0; i < 36; i++) slots[i] = EMPTY() }
    p.gui = g
  }
  // Like KubeJS 6: Minecraft's closeContainer() is only reachable as closeMenu(); there is no closeContainer.
  p.closeMenu = () => { const g = p.gui; p.gui = null; if (g && typeof g.closed == 'function') g.closed() }
  Object.defineProperty(p, 'containerMenu', { get() {
    return { getClass: () => ({ getSimpleName: () => p.gui ? 'CustomChestMenu' : 'InventoryMenu' }),
      data: p.gui ? { capturedInventory: { getContainerSize: () => 36, getItem: i => (p._captured || [])[i] || EMPTY() } } : null }
  } })
  return p
}
// The player's real inventory: while a KubeJS window has it away, the captured slots (what KubeJS hands back).
const realSlots = p => p._captured ? p._captured.concat(p.inventory.slots.slice(36)) : p.inventory.slots
const setReal = (p, i, st) => { if (p._captured && i < 36) p._captured[i] = st; else p.inventory.setItem(i, st) }
const text = p => p.inbox.join('\n')
const lastLine = p => p.inbox[p.inbox.length - 1] || ''

const server = {
  get players() { const on = players.filter(p => p.online); return { size: () => on.length, get: i => on[i] } },
  get entities() { const all = W.entities.filter(e => !e.removed).concat(players.filter(p => p.online)); return { size: () => all.length, get: i => all[i] } },
  get overworld() { return () => levels[OW] },
  get tickCount() { return W.tick },
  getLevel: d => levels[String(d)] || null,
  getPlayerList: () => ({ getPlayer: u => players.find(p => p.online && p.uuid == u) || null }),
  getProfileCache: () => ({ get: n => { const p = players.find(x => x.name.toLowerCase() == String(n).toLowerCase()); return { isPresent: () => !!p, get: () => ({ getId: () => p.uuid, getName: () => p.name }) } } }),
  persistentData: { getString: k => W.persistent[k] || '', putString: (k, v) => { W.persistent[k] = String(v) } },
  scheduleInTicks: (n, f) => W.q.push([W.tick + n, f]),
  runCommandSilent(c) {
    W.cmds.push({ t: W.tick, c })
    let m = c.match(/^execute in (\S+) run summon (\S+) (\S+) (\S+) (\S+) (\{.*\})$/)
    if (m && m[2] != 'minecraft:item') {
      const tm = m[6].match(/Tags:\[([^\]]*)\]/)
      const tagList = tm ? tm[1].split(',').map(s => s.replace(/"/g, '')) : []
      const e = entity(m[2], m[1], +m[3], +m[4], +m[5], tagList, { nbt: m[6] })
      if (!fireSpawn(e)) return 1
      W.entities.push(e)
      return 1
    }
    if ((m = c.match(/^kill @e\[tag=(\S+)\]$/))) {
      let n = 0
      W.entities.filter(e => !e.removed && e._tags.indexOf(m[1]) >= 0).forEach(e => { e.removed = true; n++ })
      return n
    }
    if ((m = c.match(/^execute in (\S+) run tp (\S+) (\S+) (\S+) (\S+)$/))) {
      const e = W.entities.find(x => x.uuid == m[2]); if (e) { e.x = +m[3]; e.y = +m[4]; e.z = +m[5] }
      const pl = players.find(x => x.uuid == m[2]); if (pl) { pl.dim = m[1]; pl.x = +m[3]; pl.y = +m[4]; pl.z = +m[5] }
      return e || pl ? 1 : 0
    }
    if ((m = c.match(/^execute in (\S+) run tp (\S+) (\S+) (\S+) (\S+)$/))) {
      const pl = players.find(x => x.uuid == m[2]); if (pl) { pl.dim = m[1]; pl.x = +m[3]; pl.y = +m[4]; pl.z = +m[5]; return 1 }
    }
    if ((m = c.match(/^execute in (\S+) run setblock (\S+) (\S+) (\S+) (\S+)$/))) { W.placed[m[1] + '|' + m[2] + '|' + m[3] + '|' + m[4]] = m[5]; return 1 }
    if (c == 'difficulty') return 2
    return 1
  },
}
const Utils = { server: null }

// ---------- Factions stub ----------
const flist = {}
const SECRET = { syndicate: true }
const facOf = p => (typeof p == 'string' ? (players.find(x => x.uuid == p) || {}).faction : p.faction) || 'unregistered'
const Factions = { DEFAULT: 'unregistered', getFaction: p => facOf(p), on: (n, cb) => { (flist[n] = flist[n] || []).push(cb) },
  visibleFaction: (viewer, target) => { const f = facOf(target); if (!SECRET[f]) return f; return viewer && (viewer.op || facOf(viewer) == f || viewer === target) ? f : 'unregistered' },
  getFactionIds: () => ['ministry', 'syndicate', 'unregistered'],
  hasRankAtLeast: (p, rank, fid) => { const order = ['Recruit', 'Loyalist', 'Enforcer', 'Minister']; return facOf(p) == fid && order.indexOf(p.rank || 'Recruit') >= order.indexOf(rank) },
  getMembers: id => players.filter(p => facOf(p) == id).map(p => ({ uuid: p.uuid, name: p.name, rank: 'x', online: p.online })) }

// ---------- KubeJS ----------
let handlers, roots
const Java = { loadClass: n => ({
  'net.minecraft.world.entity.ai.memory.MemoryModuleType': { ANGRY_AT: 'angry_at', ATTACK_TARGET: 'attack_target', WALK_TARGET: 'walk_target' },
  'net.minecraft.world.entity.ai.memory.WalkTarget': function (t) { this.t = t },
  'net.minecraft.network.chat.Component$Serializer': { fromJson: () => { throw new Error('ambiguous') }, fromJsonLenient: s => ({ json: s }) },
  'java.util.UUID': { fromString: s => s },
  'net.minecraft.world.level.Level$ExplosionInteraction': { NONE: 'NONE', TNT: 'TNT' },
  'net.minecraft.nbt.StringTag': { valueOf: s => s },
  'com.mojang.brigadier.arguments.StringArgumentType': { word: () => 'word', greedyString: () => 'greedy', getString: (ctx, n) => ctx.args[n] },
})[n] || (() => { throw new Error('no class ' + n) })() }
const mkText = t => ({ text: String(t), append(o) { this.text += o.text; return this } })
const Text = { red: mkText, gold: mkText, yellow: mkText, of: mkText, lightPurple: mkText }
const Item = { of: (id, a, b) => (typeof a == 'string' ? stack(id, 1, a) : stack(id, a == null ? 1 : a, b || null)), empty: EMPTY() }
const Ingredient = { of: id => ({ id }), custom: (base, pred) => ({ base, pred, custom: true }) }
function fire(n, ev) { for (const h of handlers[n] || []) { try { h(ev) } catch (e) { if (e instanceof Exit) { ev.cancelled = true; return } throw e } } }
function fireSpawn(e) { const ev = { entity: e, cancel() { throw new Exit() } }; fire('spawned', ev); return !ev.cancelled }
const node = (n, type) => ({ n, type, ch: [], getChild(c) { return this.ch.find(x => x.n == c) || null }, then(c) { this.ch.push(c); return this }, requires(f) { this.req = f; return this }, executes(f) { this.f = f; return this }, redirect(t) { this.redir = t; return this } })
const glob = { Factions }
const bmState = () => glob.blackMarketState
function loadOne(src) {
  const on = name => f => { (handlers[name] = handlers[name] || []).push(f) }
  const ev = {
    commands: { literal: n => node(n, 'lit'), argument: (n, t) => node(n, t) },
    arguments: { PLAYER: { create: () => 'player', getResult: (ctx, n) => ctx.args[n] }, INTEGER: { create: () => 'int', getResult: (ctx, n) => ctx.args[n] } },
    register: r => { roots[r.n] = r; return r },
  }
  new Function('PlayerEvents', 'EntityEvents', 'ServerEvents', 'ItemEvents', 'BlockEvents', 'Utils', 'Text', 'Item', 'Ingredient', 'console', 'global', 'Java', 'Date', src)(
    { loggedIn: on('loggedIn'), loggedOut: on('loggedOut'), chestOpened: on('chestOpened'), inventoryChanged: on('inventoryChanged') }, { hurt: on('hurt'), death: on('death'), spawned: on('spawned') },
    { loaded: on('loaded'), commandRegistry: f => f(ev), recipes: f => { const rev = { replaceInput: (filter, from, to) => W.recipes.push({ filter, from, to }), remove: filt => { (W.removedRecipes = W.removedRecipes || []).push(filt) } }; f(rev) } },
    { rightClicked: on('itemRightClicked'), entityInteracted: on('entityInteracted'), foodEaten: on('foodEaten'), pickedUp: on('pickedUp') }, { rightClicked: on('blockRightClicked'), placed: on('blockPlaced'), broken: on('blockBroken') },
    Utils, Text, Item, Ingredient,
    { info: m => W.logs.push('I ' + m), warn: m => W.logs.push('W ' + m), error: m => W.logs.push('E ' + m) }, glob, Java, Datex)
}
function loadAll(bmSrc, paSrc) {
  handlers = {}; roots = {}
  for (const k in flist) delete flist[k]
  glob.Factions = Object.assign({}, Factions)   // like the real thing: factions_core makes a new object on every load
  W.recipes = []
  loadOne(bmSrc || fs.readFileSync(BM_FILE, 'utf8'))   // economy/ loads before factions/
  if (!process.env.NO_ELI) loadOne(fs.readFileSync(ELI_FILE, 'utf8'))   // end_lockdown.js sorts between economy/ and factions/
  if (!process.env.NO_BOUNTY) loadOne(fs.readFileSync(BOUNTY_FILE, 'utf8'))
  loadOne(paSrc || fs.readFileSync(PA_FILE, 'utf8'))
  loadOne(fs.readFileSync(TRIALS_FILE, 'utf8'))
}
const replies = []
function cmd(line, as) {
  if (as && as.gui) { as.closeMenu(); advance(1) }   // nobody types a command with a window open
  const toks = line.replace(/^\//, '').split(' ')
  let n = roots[toks[0]], args = {}
  if (!n) throw new Error('no command ' + toks[0])
  const src = { server, getPlayer: () => as || null, hasPermission: lvl => !as || as.op, sendSystemMessage: t => replies.push(t.json || t.text) }
  if (n.req && !n.req(src)) { replies.push('DENIED'); return 0 }
  if (n.redir) n = n.redir
  for (let i = 1; i < toks.length; i++) {
    let lit = n.ch.find(c => c.type == 'lit' && c.n == toks[i])
    if (lit) { if (lit.req && !lit.req(src)) { replies.push('DENIED'); return 0 } n = lit; continue }
    let a = n.ch.find(c => c.type != 'lit')
    if (!a) throw new Error('bad command ' + line + ' at ' + toks[i])
    if (a.type == 'greedy') { args[a.n] = toks.slice(i).join(' '); n = a; break }
    args[a.n] = a.type == 'player' ? players.find(p => p.name == toks[i]) : a.type == 'int' ? parseInt(toks[i], 10) : toks[i]
    n = a
  }
  if (!n.f) throw new Error('not executable: ' + line)
  return n.f({ args, source: src })
}
const lastReply = () => replies[replies.length - 1] || ''
// KubeJS hands a captured inventory back at the end of a tick in which no window of its is open (overwriting slots 0-35).
function restoreInventories() { players.forEach(p => { if (p._captured && !p.gui) { for (let i = 0; i < 36; i++) p.inventory.slots[i] = p._captured[i]; p._captured = null } }) }
function advance(ticks) { for (let i = 0; i < ticks; i++) { W.tick++; W.time += 50; const due = W.q.filter(x => x[0] <= W.tick); W.q = W.q.filter(x => x[0] > W.tick); due.forEach(x => x[1]()); restoreInventories() } }
function click(p, onBlock) {
  const evB = { player: p, hand: 'MAIN_HAND', item: p.mainHandItem, cancelled: false, cancel() { throw new Exit() } }
  if (onBlock) fire('blockRightClicked', evB)
  const evI = { player: p, hand: 'MAIN_HAND', item: p.mainHandItem, cancelled: false, cancel() { throw new Exit() } }
  fire('itemRightClicked', evI)
  return { block: evB.cancelled, item: evI.cancelled }
}
const coinsOf = p => realSlots(p).slice(0, 36).filter(s => s.count > 0 && s.id == 'minecraft:gold_nugget' && s.parsed && s.parsed.trollcraft).reduce((a, s) => a + s.count, 0)
const findItem = (p, f) => realSlots(p).find(s => s.count > 0 && f(s))
const contractsOf = p => realSlots(p).filter(s => s.count > 0 && s.parsed && s.parsed.trollcraft && s.parsed.trollcraft.contract)
const cId = s => s.parsed.trollcraft.contract.id.replace(/"/g, '')
const DB = () => JSON.parse(W.persistent.economy || '{}')
const vendor = () => W.entities.find(e => !e.removed && e._tags.indexOf('black_market_vendor') >= 0)
const mobs = () => W.entities.filter(e => !e.removed && e.alive && e._tags.indexOf('portal_ambush') >= 0)
const putInHand = (p, s) => { setReal(p, p.selected, s) }
// /blackmarket test contract: clears the op's old contracts first, returns the new one
function testContract(tier, target) {
  realSlots(admin).forEach((s, i) => { if (s.count > 0 && s.parsed && s.parsed.trollcraft && s.parsed.trollcraft.contract) s.count = 0 })
  bob.yaw += 3   // Bob is active (not AFK)
  cmd('blackmarket test contract ' + tier + ' ' + target, admin)
  return contractsOf(admin)[0]
}
const json = l => { try { return JSON.parse(l) } catch (e) { return null } }
const flat = l => { const j = json(l); return j ? j.map(x => typeof x == 'string' ? x : x.text).join('') : l }


// =====================================================================
// end_lockdown.js and the Unsanctioned Eye at the Hooded Merchant
const END = 'minecraft:the_end'
levels[END] = Object.assign({}, levels[OW], { dimension: { toString: () => END }, getBlock: () => ({ id: 'minecraft:air', blockState: { blocksMotion: () => false } }) })
const emit = (n, ...a) => (flist[n] || []).forEach(cb => cb(...a))
const tc = s => s.count > 0 && s.parsed && s.parsed.trollcraft
const EYE = 'minecraft:ender_eye'
const ordinary = n => stack(EYE, n)
const isUns = s => s.count > 0 && s.id == EYE && tc(s) && tc(s).unsanctioned
const eyesOf = (p, f) => realSlots(p).filter(s => s.count > 0 && s.id == EYE && f(s)).reduce((a, s) => a + s.count, 0)
function setup(p) {
  p.inventory.containerSize = 41
  const ec = []; for (let i = 0; i < 27; i++) ec.push(EMPTY())
  p.enderChest = ec
  p.enderChestInventory = { containerSize: 27, getItem: i => ec[i] }
  p.getRespawnPosition = () => null
  p.getRespawnDimension = () => ({ location: () => OW })
  return p
}
loadAll()
Utils.server = server
fire('loaded', { server })
const admin = setup(player('Admin', 'ministry', OW, 1000.5, 65, 1000.5, true))
const ana = setup(player('Ana', 'syndicate', OW, 1001.5, 65, 1000.5))
const bo = setup(player('Bo', 'ministry', OW, 1002.5, 65, 1001.5))
players.push(admin, ana, bo)
advance(60)

// ----- recipes -----
ok('every recipe making an Eye of Ender is removed', W.recipes.some(r => r.removed && r.removed.output == EYE) || W.removedRecipes && W.removedRecipes.some(f => f.output == EYE), JSON.stringify(W.removedRecipes || ''))

// ----- confiscation (the const-in-a-loop bug: Eyes past slot 0 were never taken) -----
setReal(ana, 0, stack('minecraft:stone', 5)); setReal(ana, 7, ordinary(3)); setReal(ana, 30, ordinary(2)); setReal(ana, 40, ordinary(1))
ana.inbox = []
fire('inventoryChanged', { player: ana, item: ordinary(1) })
ok('an Eye entering the inventory: ordinary Eyes in every slot (hotbar, main, offhand) are confiscated', eyesOf(ana, () => true) == 0 && realSlots(ana)[0].count == 5, realSlots(ana).filter(s => s.count > 0).map(s => s.id + 'x' + s.count).join(','))
ok('... with the Ministry message', /Unauthorized Eye of Ender confiscated/.test(text(ana)), text(ana))
setReal(ana, 9, ordinary(1)); ana.inbox = []
fire('inventoryChanged', { player: ana, item: ordinary(1) })
ok('... a second confiscation within 30 s: no second message', eyesOf(ana, () => true) == 0 && !ana.inbox.length)
ana.creative = true; setReal(ana, 9, ordinary(4))
fire('inventoryChanged', { player: ana, item: ordinary(1) })
ok('creative players keep ordinary Eyes', eyesOf(ana, () => true) == 4)
ana.creative = false; setReal(ana, 9, EMPTY())
// ender chest at login
bo.enderChest[3] = ordinary(5); bo.enderChest[20] = ordinary(1); setReal(bo, 12, ordinary(2))
fire('loggedIn', { player: bo })
ok('login: ordinary Eyes in the inventory and the ender chest are confiscated', eyesOf(bo, () => true) == 0 && bo.enderChest[3].count == 0 && bo.enderChest[20].count == 0)
// pickup
const ent = { discarded: false, discard() { this.discarded = true } }
let pev = { player: ana, item: ordinary(1), itemEntity: ent, cancelled: false, cancel() { throw new Exit() } }
ana.inbox = []; ana.lastWarnReset = true
glob.endLockdownState.lastWarn = {}
fire('pickedUp', pev)
ok('picking up an ordinary Eye: refused, the dropped item removed, and the message shown (event.cancel() now comes last)', pev.cancelled && ent.discarded && /confiscated/.test(text(ana)), text(ana))

// ----- /endlockdown give, frames -----
cmd('endlockdown give Ana 12', admin)
ok('/endlockdown give: 12 tagged Unsanctioned Eyes, no error', eyesOf(ana, isUns) == 12 && /Gave 12 Unsanctioned/.test(flat(lastReply())), lastReply())
const g = realSlots(ana).find(isUns)
ok('... named, with the lore and the glint', /Unsanctioned Eye of Ender/.test(g.parsed.display.Name) && g.parsed.Enchantments && g.parsed.Enchantments[0].id == 'minecraft:unbreaking' && g.parsed.HideFlags == '1')
fire('inventoryChanged', { player: ana, item: g })
ok('Unsanctioned Eyes are never confiscated', eyesOf(ana, isUns) == 12)
let fev = { player: ana, block: { id: 'minecraft:end_portal_frame' }, item: ordinary(1), hand: 'MAIN_HAND', cancelled: false, cancel() { throw new Exit() } }
ana.inbox = []
fire('blockRightClicked', fev)
ok('an ordinary Eye on a portal frame: cancelled, with the message', fev.cancelled && /The End is closed/.test(text(ana)), text(ana))
fev = { player: ana, block: { id: 'minecraft:end_portal_frame' }, item: g, hand: 'MAIN_HAND', cancelled: false, cancel() { throw new Exit() } }
fire('blockRightClicked', fev)
ok('an Unsanctioned Eye on a frame: allowed', !fev.cancelled)

// ----- /endlockdown seal (the const-in-a-loop bug: only the first block was ever checked) -----
const sealed = {}
const frameAt = {}
for (let i = 0; i < 12; i++) frameAt[(1000 + (i % 4) - 2) + ',64,' + (1000 + Math.floor(i / 4) * 2 - 2)] = { facing: 'north', eye: i % 3 ? 'true' : 'false' }
const portalAt = { '1000,64,1001': 1, '1001,64,1001': 1, '999,64,1001': 1 }
const owGetBlock = levels[OW].getBlock
levels[OW].getBlock = (x, y, z) => {
  const k = x + ',' + y + ',' + z
  if (sealed[k]) return { id: sealed[k].id, properties: { get: n => sealed[k].props[n] }, set() { } }
  if (frameAt[k]) return { id: 'minecraft:end_portal_frame', properties: { get: n => frameAt[k][n] }, set: (id, props) => { sealed[k] = { id, props: props || {} } } }
  if (portalAt[k]) return { id: 'minecraft:end_portal', properties: { get: () => null }, set: (id) => { sealed[k] = { id, props: {} } } }
  return owGetBlock(x, y, z)
}
const filled = Object.keys(frameAt).filter(k => frameAt[k].eye == 'true').length
admin.x = 1000.5; admin.y = 64; admin.z = 1000.5
cmd('endlockdown seal 5', admin)
levels[OW].getBlock = owGetBlock
ok('/endlockdown seal: every filled frame emptied (facing kept) and every portal block removed', Object.keys(sealed).filter(k => sealed[k].id == 'minecraft:end_portal_frame' && sealed[k].props.eye == 'false' && sealed[k].props.facing == 'north').length == filled &&
  Object.keys(portalAt).every(k => sealed[k] && sealed[k].id == 'minecraft:air') && new RegExp('Sealed: ' + filled + ' frame eye\\(s\\) removed, 3 portal').test(flat(lastReply())), lastReply())

// ----- portal-only End -----
advance(60)   // positions sampled; the factions hook attached
ok('(the dimension hook is attached to factions_core)', (flist.enteredDimension || []).filter(cb => /onEntered/.test(String(cb))).length == 1, (flist.enteredDimension || []).length)
const travel = (p, to, x, y, z, how) => { const from = p.dim; p.dim = to; p.x = x; p.y = y; p.z = z; emit('enteredDimension', p, p.faction, from, to, how || 'travel') }
bo.x = 3000.5; bo.y = 70; bo.z = 3000.5; advance(41)
bo.inbox = []
travel(bo, END, 500.5, 60, 500.5)   // /home in the End
advance(2)
ok('reaching the End without a portal (a home, /tpa, a Waystone): sent back to where they were, with the message', bo.dim == OW && Math.abs(bo.x - 3000.5) < 0.1 && Math.abs(bo.z - 3000.5) < 0.1 && /There is nothing in the End/.test(text(bo)), bo.dim + ' ' + bo.x + ' ' + text(bo))
travel(bo, END, 100.5, 50, 0.5)   // the End portal's platform
advance(2)
ok('arriving through the End portal (on the obsidian platform): allowed', bo.dim == END)
emit('enteredDimension', bo, bo.faction, null, END, 'login'); advance(2)
ok('... and logging in there again later is fine', bo.dim == END)
travel(bo, OW, 3000.5, 70, 3000.5); advance(41)
bo.dim = END; bo.x = 400.5; bo.y = 60; bo.z = 400.5
emit('enteredDimension', bo, bo.faction, null, END, 'login'); advance(2)
ok('after leaving, a login in the End that didn\'t come by portal: sent back', bo.dim == OW)
ok('... the "came by portal" mark is saved with the world', JSON.parse(W.persistent.end_lockdown || '{}').legit !== undefined)
travel(admin, END, 500.5, 60, 500.5); advance(2)
ok('ops are exempt', admin.dim == END)
admin.dim = OW; admin.x = 1000.5; admin.z = 1000.5
ana.creative = true; travel(ana, END, 500.5, 60, 500.5); advance(2)
ok('creative players are exempt', ana.dim == END)
ana.creative = false; ana.dim = OW; ana.x = 1001.5; ana.z = 1000.5
// a player with no known position falls back to their spawn point
const cy = setup(player('Cy', 'unregistered', OW, 0, 65, 0)); players.push(cy)
cy.getRespawnPosition = () => ({ getX: () => 222, getY: () => 64, getZ: () => -40 })
cy.dim = END; cy.x = 600; cy.y = 60; cy.z = 600
emit('enteredDimension', cy, cy.faction, OW, END, 'travel'); advance(2)
ok('no remembered position: sent to their spawn point', cy.dim == OW && Math.abs(cy.x - 222.5) < 0.1 && Math.abs(cy.z + 39.5) < 0.1, cy.x + ',' + cy.z)
// /reload: re-attached once
loadAll(); fire('loaded', { server }); advance(60)
ok('/reload: the hook is attached exactly once', (flist.enteredDimension || []).filter(cb => /onEntered/.test(String(cb))).length == 1, (flist.enteredDimension || []).length)

// ----- the Hooded Merchant -----
cmd('blackmarket vendor addspot crossroads', admin)
cmd('blackmarket vendor spawn crossroads', admin); advance(45)
cmd('coins give Ana 300', admin)
realSlots(ana).forEach((s, i) => { if (isUns(s)) setReal(ana, i, EMPTY()) })
const openWin = p => { if (p.gui) { p.closeMenu(); advance(1) } fire('entityInteracted', { player: p, target: W.entities.find(e => !e.removed && e._tags.indexOf('black_market_vendor') >= 0), hand: 'MAIN_HAND', item: EMPTY(), cancel() { throw new Exit() } }) }
const slotName = (p, x, y) => { const sl = p.gui && p.gui.slots[x + ',' + y]; try { return JSON.parse(sl.item.parsed.display.Name).text } catch (e) { return sl && sl.item ? sl.item.id : '' } }
const slotLore = (p, x, y) => { const sl = p.gui.slots[x + ',' + y]; try { return sl.item.parsed.display.Lore.map(l => JSON.parse(l).text).join(' | ') } catch (e) { return '' } }
openWin(ana)
ok('the shop window has the Unsanctioned Eye at the end of the Protection & Tracking row, 20 coins', slotName(ana, 7, 1) == 'Unsanctioned Eye of Ender' && /20 Hush Coins each/.test(slotLore(ana, 7, 1)), slotName(ana, 7, 1))
let c0 = coinsOf(ana)
ana.gui.slots['7,1'].leftClicked({}); advance(3)
ok('clicking it buys one: 20 coins, one tagged Eye with a purchase id', coinsOf(ana) == c0 - 20 && eyesOf(ana, isUns) == 1 && /^e/.test(String(tc(realSlots(ana).find(isUns)).eyebatch)), coinsOf(ana) + ' ' + eyesOf(ana, isUns))
ana.closeMenu(); advance(1)
fire('inventoryChanged', { player: ana, item: realSlots(ana).find(isUns) })
ok('... and the lockdown treats it as Unsanctioned (kept)', eyesOf(ana, isUns) == 1)
c0 = coinsOf(ana)
cmd('bm buy eye 12', ana)
ok('/bm buy eye 12: 240 coins, 12 Eyes in one stack', coinsOf(ana) == c0 - 240 && eyesOf(ana, isUns) == 13 && realSlots(ana).filter(isUns).some(s => s.count == 12), lastReply())
cmd('bm buy eye 13', ana); ok('more than 12 at once: refused', /1 to 12 at a time/.test(flat(lastReply())))
cmd('bm buy eye 5', ana); ok('not enough coins: refused, nothing given', /100 Hush Coins for 5 Eyes/.test(flat(lastReply())) && eyesOf(ana, isUns) == 13, lastReply())
const batch = tc(realSlots(ana).find(s => isUns(s) && s.count == 12)).eyebatch
const DBe = () => JSON.parse(W.persistent.economy || '{}')
ok('the sale is logged: buyer and count', DBe().eyeBatches[batch] && DBe().eyeBatches[batch].buyerName == 'Ana' && DBe().eyeBatches[batch].count == 12)
setReal(admin, admin.selected, stack(EYE, 1, realSlots(ana).find(s => isUns(s) && s.count == 12).snbtStr))
cmd('bm inspect', admin)
ok('/bm inspect on a confiscated Eye: who bought it, when, how many', /12 sold to Ana on/.test(flat(lastReply())), lastReply())
setReal(admin, admin.selected, stack(EYE, 1, realSlots(admin).length && g.snbtStr))
cmd('bm inspect', admin)
ok('/bm inspect on a Ministry-issued Eye says so', /issued by the Ministry/.test(flat(lastReply())), lastReply())
cmd('bm hand add 5', admin)
ok('/bm hand add refuses Unsanctioned Eyes (sales stay logged)', /already for sale/.test(flat(lastReply())), lastReply())
setReal(admin, admin.selected, EMPTY())
cmd('blackmarket chatshop', ana)
ok('the chat menu lists it with [BUY 1] and [BUY 12]', /Unsanctioned Eye of Ender/.test(text(ana)) && /\/blackmarket buy eye 12/.test(text(ana)))
// without end_lockdown.js the Eye isn't sold
process.env.NO_ELI = '1'; delete glob.EndLockdown
loadAll(); fire('loaded', { server }); advance(45)
openWin(ana)
ok('without end_lockdown.js the Eye isn\'t in the window', slotName(ana, 7, 1) != 'Unsanctioned Eye of Ender', slotName(ana, 7, 1))
ana.closeMenu(); advance(1)
cmd('bm buy eye 1', ana); ok('... and /bm buy eye explains', /Nobody pays the merchant/.test(flat(lastReply())), lastReply())
delete process.env.NO_ELI

console.log(W.logs.filter(l => /^E /.test(l)).join('\n') || '(no errors logged)')
console.log(fails ? fails + ' FAILED' : 'ALL PASSED')
