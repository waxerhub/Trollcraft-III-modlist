// Run with: node tools/tests/run_all.js tracker_alibi_trials   (or node tools/tests/suites/tracker_alibi_trials.test.js)
const REPO_ROOT = require('path').resolve(__dirname, '..', '..', '..')
// Mock KubeJS 6 server running economy/black_market.js together with factions/portal_ambush.js.
const fs = require('fs')
const snbt = require('../lib/snbt.js')
const BM_FILE = process.env.BM_FILE || REPO_ROOT + '/tools/kubejs/server_scripts/economy/black_market.js'
const BOUNTY_FILE = process.env.BOUNTY_FILE || REPO_ROOT + '/tools/kubejs/server_scripts/economy/bounties.js'
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
    { loggedIn: on('loggedIn'), loggedOut: on('loggedOut'), chestOpened: on('chestOpened') }, { hurt: on('hurt'), death: on('death'), spawned: on('spawned') },
    { loaded: on('loaded'), commandRegistry: f => f(ev), recipes: f => { const rev = { replaceInput: (filter, from, to) => W.recipes.push({ filter, from, to }) }; f(rev) } },
    { rightClicked: on('itemRightClicked'), entityInteracted: on('entityInteracted'), foodEaten: on('foodEaten') }, { rightClicked: on('blockRightClicked'), placed: on('blockPlaced'), broken: on('blockBroken') },
    Utils, Text, Item, Ingredient,
    { info: m => W.logs.push('I ' + m), warn: m => W.logs.push('W ' + m), error: m => W.logs.push('E ' + m) }, glob, Java, Datex)
}
function loadAll(bmSrc, paSrc) {
  handlers = {}; roots = {}
  for (const k in flist) delete flist[k]
  W.recipes = []
  loadOne(bmSrc || fs.readFileSync(BM_FILE, 'utf8'))   // economy/ loads before factions/
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
// Tracker Compass, Homing Pig, Certified Alibi and trials.js
const TDB = () => JSON.parse(W.persistent.trials || '{}')
const withSpawn = (p, s) => {
  p.spawn = s
  p.getRespawnPosition = () => p.spawn ? { getX: () => p.spawn.x, getY: () => p.spawn.y, getZ: () => p.spawn.z } : null
  p.getRespawnDimension = () => ({ location: () => (p.spawn ? p.spawn.dim : OW) })
  p.setStatusMessage = c => { p.status = c && c.json ? flat(c.json) : String(c) }
  return p
}
loadAll()
Utils.server = server
fire('loaded', { server })
const admin = withSpawn(player('Admin', 'ministry', OW, 1000.5, 65, 1000.5, true), null)
const alice = withSpawn(player('Alice', 'syndicate', OW, 1001.5, 65, 1000.5), null)
const bob = withSpawn(player('Bob', 'ministry', OW, 2000.5, 65, 2000.5), { dim: OW, x: 1100, y: 64, z: 1000 })
const carl = withSpawn(player('Carl', 'ministry', OW, 3000.5, 65, 3000.5), { dim: OW, x: -500, y: 70, z: 20 })
const dave = withSpawn(player('Dave', 'unregistered', OW, 1002.5, 65, 1001.5), null)
bob.rank = 'Enforcer'; carl.rank = 'Loyalist'
players.push(admin, alice, bob, carl, dave)
players.forEach(p => fire('loggedIn', { player: p }))
advance(40)
cmd('blackmarket vendor addspot crossroads', admin)
cmd('blackmarket vendor spawn crossroads', admin); advance(45)
ok('(vendor out)', !!vendor())
cmd('coins give Alice 400', admin)
carl.online = false; fire('loggedOut', { player: carl })
ok('beds are remembered on login/logout, for offline targets', DB().beds['carl-1111'] && DB().beds['carl-1111'].x == -500 && DB().beds['alice-1111'].none === true, JSON.stringify(DB().beds))

const openWin = p => { if (p.gui) { p.closeMenu(); advance(1) } fire('entityInteracted', { player: p, target: vendor(), hand: 'MAIN_HAND', item: EMPTY(), cancel() { throw new Exit() } }) }
function guiClick(p, x, y) {
  const sl = p.gui && p.gui.slots[x + ',' + y]
  if (!sl || !sl.leftClicked) throw new Error('no button at ' + x + ',' + y + ' in ' + (p.gui && p.gui.title))
  sl.leftClicked({})
  advance(2)
}
const slotName = (p, x, y) => { const sl = p.gui && p.gui.slots[x + ',' + y]; try { return JSON.parse(sl.item.parsed.display.Name).text } catch (e) { return sl && sl.item ? sl.item.id : '' } }
const slotLore = (p, x, y) => { const sl = p.gui.slots[x + ',' + y]; try { return sl.item.parsed.display.Lore.map(l => JSON.parse(l).text).join(' | ') } catch (e) { return '' } }
const findHead = (p, name) => { for (const k in p.gui.slots) { if (slotName(p, +k.split(',')[0], +k.split(',')[1]) == name && p.gui.slots[k].item.id == 'minecraft:player_head') return k.split(',').map(Number) } return null }
// one click per player every few ticks (the script ignores a second event within 4 ticks: one click can fire two)
const clickT = (p, b) => { advance(5); return click(p, b) }
const tc = s => s.count > 0 && s.parsed && s.parsed.trollcraft
const slotOf = (p, f) => realSlots(p).findIndex(s => s.count > 0 && f(s))
const hold = (p, f) => { const i = slotOf(p, f); if (i < 0) throw new Error('not carrying it'); const st = realSlots(p)[i]; setReal(p, i, EMPTY()); setReal(p, p.selected, st); return st }
// The mock pig walks 3 blocks a second toward its navigation target.
function walk(pig, seconds) {
  for (let i = 0; i < seconds; i++) {
    advance(20)
    if (!pig.nav) continue
    const dx = pig.nav.x - pig.x, dz = pig.nav.z - pig.z, d = Math.sqrt(dx * dx + dz * dz)
    if (d > 0.01) { const k = Math.min(1, 3 / d); pig.x += dx * k; pig.z += dz * k }
  }
}
const ftext = p => p.inbox.map(flat).join('\n')
const isTracker = s => tc(s) && tc(s).tracker
const isPigEgg = s => tc(s) && tc(s).homingPig
const isAlibi = s => tc(s) && tc(s).alibi
const hurtPig = (pig, src) => { const ev = { entity: pig, source: src, cancelled: false, cancel() { throw new Exit() } }; fire('hurt', ev); return ev.cancelled }

// ----- the shop window -----
openWin(alice)
ok('row 1 is Protection & Tracking: Writ, Certified Alibi, Tracker Compass, Homing Pig', slotName(alice, 0, 1) == 'Protection & Tracking' && slotName(alice, 2, 1) == 'Writ of Protection' &&
  slotName(alice, 3, 1) == 'Certified Alibi' && slotName(alice, 5, 1) == 'Tracker Compass' && slotName(alice, 6, 1) == 'Homing Pig', [2, 3, 5, 6].map(x => slotName(alice, x, 1)).join(','))
ok('... with their prices (25, 20, 50)', /25 Hush Coins/.test(slotLore(alice, 5, 1)) && /20 Hush Coins/.test(slotLore(alice, 6, 1)) && /50 Hush Coins/.test(slotLore(alice, 3, 1)))

// ----- Tracker Compass: buying -----
guiClick(alice, 5, 1)
ok('Tracker Compass page: online players only (Carl is offline)', /Tracker Compass: who/.test(alice.gui.title) && findHead(alice, 'Bob') && !findHead(alice, 'Carl') && !findHead(alice, 'Alice'))
let c0 = coinsOf(alice), bh = findHead(alice, 'Bob')
guiClick(alice, bh[0], bh[1])
advance(1)
const comp1 = realSlots(alice).find(isTracker)
ok('bought: 25 coins, a compass for Bob, switched off and spinning (no LodestonePos)', coinsOf(alice) == c0 - 25 && comp1 && tc(comp1).tracker.targetName == 'Bob' &&
  /^0L?$/.test(tc(comp1).tracker.expires) && comp1.parsed.LodestoneTracked == '0b' && !comp1.parsed.LodestonePos, JSON.stringify(comp1 && comp1.parsed))
ok('... on record with its buyer, unused', Object.values(DB().trackItems).some(t => t.kind == 'tracker' && t.buyerName == 'Alice' && t.targetName == 'Bob' && !t.used))
alice.closeMenu(); advance(1)
cmd('bm buy tracker Alice', alice); ok('no compass on yourself', /always know where you are/.test(flat(lastReply())), lastReply())
cmd('bm buy tracker Carl', alice); ok('no compass on an offline player', /only people who are around/.test(flat(lastReply())), lastReply())
c0 = coinsOf(dave); cmd('bm buy tracker Bob', dave); ok('not enough coins: refused, nothing given', /costs 25 Hush Coins/.test(flat(lastReply())) && !realSlots(dave).some(isTracker), lastReply())

// ----- switching it on -----
hold(alice, isTracker); bob.inbox = []
let r = clickT(alice, false)
let cur = alice.mainHandItem
ok('right-click switches it on: 5 minutes, cancelled (no lodestone binding)', r.item && parseInt(tc(cur).tracker.expires) == W.time + 300000, tc(cur) && tc(cur).tracker.expires)
ok('... the target only feels watched (no name, no item)', /You feel watched/.test(text(bob)) && !/Alice|Compass/.test(text(bob)), text(bob))
ok('... it points at Bob now (same dimension)', cur.parsed.LodestonePos && cur.parsed.LodestonePos.X == '2000' && cur.parsed.LodestonePos.Z == '2000' && cur.parsed.LodestoneDimension == OW, JSON.stringify(cur.parsed))
ok('... and the action bar shows the trail and the time left', /Tracking Bob\s+5:00|Tracking Bob\s+4:5\d/.test(alice.status), alice.status)
const rB = clickT(alice, true)
ok('clicking a block with it is cancelled too (no lodestone)', rB.block)
bob.x += 2; advance(20)
ok('Bob moves 2 blocks: not rewritten (no hand bobbing)', alice.mainHandItem.parsed.LodestonePos.X == '2000')
bob.x += 3; advance(20)
ok('Bob moves 5 blocks: rewritten', alice.mainHandItem.parsed.LodestonePos.X == '2005', alice.mainHandItem.parsed.LodestonePos.X)
bob.dim = NE; advance(20)
ok('Bob in the Nether: the trail is cold (spins) and the action bar says so', !alice.mainHandItem.parsed.LodestonePos && /The trail is cold/.test(alice.status), alice.status)
bob.dim = OW; advance(20)
ok('Bob back: it points again', alice.mainHandItem.parsed.LodestonePos && alice.mainHandItem.parsed.LodestonePos.X == '2005')
bob.online = false; advance(20)
ok('Bob offline: cold', !alice.mainHandItem.parsed.LodestonePos)
bob.online = true; advance(20)
// a second compass while one runs
cmd('bm buy tracker Dave', alice)
setReal(alice, 1, realSlots(alice).find((s, i) => isTracker(s) && i != alice.selected && parseInt(tc(s).tracker.expires) == 0) || EMPTY())
const second = realSlots(alice).filter(isTracker).find(s => parseInt(tc(s).tracker.expires) == 0)
alice.selected = realSlots(alice).indexOf(second); alice.inbox = []
clickT(alice, false)
ok('a second compass can\'t be switched on while one runs', /One trail at a time/.test(text(alice)) && parseInt(tc(alice.mainHandItem).tracker.expires) == 0, text(alice))
alice.selected = 0
// copies and fakes
const usedCopy = stack('minecraft:compass', 1, comp1.snbtStr)
setReal(alice, 8, usedCopy); alice.selected = 8; alice.inbox = []
clickT(alice, false)
ok('a copy of an already-used compass won\'t switch on', /already been used/.test(text(alice)), text(alice))
setReal(alice, 8, stack('minecraft:compass', 1, '{trollcraft:{tracker:{id:"tFAKE",target:"bob-1111",targetName:"Bob",expires:0L,at:""}}}')); alice.inbox = []
clickT(alice, false)
ok('a forged compass is refused', /never smelled anyone/.test(text(alice)), text(alice))
setReal(alice, 8, EMPTY()); alice.selected = 0
// running out (in a chest-like slot: anywhere in the inventory)
advance(20 * 300)
ok('after 5 minutes it becomes a Spent Tracker Compass, and Alice is told', realSlots(alice)[0].id == 'minecraft:compass' && !tc(realSlots(alice)[0]) && /Spent Tracker Compass/.test(realSlots(alice)[0].parsed.display.Name) && /lost the scent of Bob/.test(text(alice)), JSON.stringify(realSlots(alice)[0].parsed))
alice.selected = realSlots(alice).indexOf(second)
clickT(alice, false)
ok('now the second one switches on', parseInt(tc(alice.mainHandItem).tracker.expires) > W.time)
alice.selected = 0

// ----- Homing Pig: buying -----
openWin(alice); guiClick(alice, 6, 1)
ok('Homing Pig page: online players and offline ones whose bed is known (Carl, marked offline)', /Homing Pig: whose bed/.test(alice.gui.title) && findHead(alice, 'Bob') && findHead(alice, 'Carl') &&
  /offline/.test(slotLore(alice, findHead(alice, 'Carl')[0], findHead(alice, 'Carl')[1])))
c0 = coinsOf(alice); bh = findHead(alice, 'Bob')
guiClick(alice, bh[0], bh[1]); alice.closeMenu(); advance(1)
const egg = realSlots(alice).find(isPigEgg)
ok('bought: 20 coins, a pig spawn egg named Homing Pig for Bob', coinsOf(alice) == c0 - 20 && egg && egg.id == 'minecraft:pig_spawn_egg' && tc(egg).homingPig.targetName == 'Bob' && /Homing Pig/.test(egg.parsed.display.Name))
c0 = coinsOf(alice)
cmd('bm buy pig Dave', alice); ok('no bed known: refused, nothing taken', /no bed it knows of/.test(flat(lastReply())) && coinsOf(alice) == c0, lastReply())
cmd('bm buy pig Alice', alice); ok('not on yourself', /your own bed/.test(flat(lastReply())))
cmd('bm buy pig Carl', alice); ok('an offline player with a known bed: sold', realSlots(alice).filter(isPigEgg).length == 2 && coinsOf(alice) == c0 - 20, lastReply())

// ----- releasing -----
hold(alice, s => isPigEgg(s) && tc(s).homingPig.targetName == 'Bob')
alice.dim = NE; alice.inbox = []
let rr = clickT(alice, true)
ok('in another dimension: the pig sits down, the egg is kept, no ordinary pig (cancelled)', rr.block && /isn't in this world/.test(text(alice)) && isPigEgg(alice.mainHandItem) && !W.entities.some(e => e.type == 'minecraft:pig'), text(alice))
alice.dim = OW; bob.inbox = []; alice.inbox = []
rr = clickT(alice, true)
let pig = W.entities.find(e => !e.removed && e.type == 'minecraft:pig')
ok('released at Alice\'s feet: a named, persistent, tagged pig; the egg is used up', rr.block && pig && /Homing Pig/.test(pig.nbt) && /PersistenceRequired:1b/.test(pig.nbt) && pig._tags.indexOf('homing_pig') >= 0 &&
  Math.abs(pig.x - alice.x) < 0.01 && !realSlots(alice).some(s => isPigEgg(s) && tc(s).homingPig.targetName == 'Bob'), text(alice))
ok('... on record, 3 minutes, the bed\'s centre; Bob feels watched', Object.values(DB().homingPigs).length == 1 && Object.values(DB().homingPigs)[0].expires == W.time + 180000 &&
  Object.values(DB().homingPigs)[0].bed.x == 1100.5 && /You feel watched/.test(text(bob)))
hold(alice, s => isPigEgg(s)); alice.inbox = []
clickT(alice, true)
ok('one pig out at a time', /One pig at a time/.test(text(alice)) && isPigEgg(alice.mainHandItem), text(alice))
advance(20)
ok('it walks: a waypoint 12 blocks toward the bed, at speed 1.5', pig.nav && Math.abs(pig.nav.x - (pig.x + 12)) < 0.1 && Math.abs(pig.nav.z - pig.z) < 0.5 && pig.nav.s == 1.5, JSON.stringify(pig.nav))
walk(pig, 6)
ok('walking: still straight ahead (toward the bed)', Math.abs(pig.nav.z - pig.z) < 0.5 && pig.nav.x > pig.x, JSON.stringify(pig.nav))
advance(20 * 9)
const side = pig.nav.z - pig.z
ok('stuck for 4 s: the next waypoint is 45 degrees to one side', Math.abs(Math.abs(side) - 12 * Math.sin(Math.PI / 4)) < 0.2, JSON.stringify(pig.nav) + ' pig z ' + pig.z)
walk(pig, 6)
ok('moving again: straight again', Math.abs(Math.atan2(pig.nav.z - pig.z, pig.nav.x - pig.x) - Math.atan2(1000.5 - pig.z, 1100.5 - pig.x)) < 0.05, JSON.stringify(pig.nav) + ' at ' + pig.x + ',' + pig.z)
pig.x = 1093.5; pig.z = 1000.5; walk(pig, 1)
ok('within 12 blocks: it heads for the bed itself', pig.nav.x == 1100.5 && pig.nav.z == 1000.5 && pig.nav.y == 64, JSON.stringify(pig.nav))
W.cmds = []
pig.x = 1099.5; pig.y = 64; advance(60)
ok('at the bed: it stops, oinks and shows hearts', pig.stopped && W.cmds.some(x => /particle minecraft:heart/.test(x.c)) && W.cmds.some(x => /entity.pig.ambient/.test(x.c)))

// ----- the Sanctity of Swine Act -----
players.forEach(p => { p.inbox = [] })
const byAlice = { actual: alice, getMsgId: () => 'player', getDirectEntity: () => alice }
ok('hurting it is cancelled', hurtPig(pig, byAlice))
ok('... the Ministry names Alice to everyone online, and a charge is filed', [admin, bob, dave].every(p => /Alice has struck a Homing Pig in violation of the Sanctity of Swine Act\. Charges have been filed\./.test(text(p))) &&
  Object.values(TDB().charges).length == 1 && Object.values(TDB().charges)[0].targetName == 'Alice' && /Sanctity of Swine Act/.test(Object.values(TDB().charges)[0].text) &&
  Object.values(TDB().charges)[0].byName == 'The Ministry', text(bob))
ok('... not with tellraw @a (Discord)', !W.cmds.some(x => /^tellraw @a/.test(x.c)))
hurtPig(pig, byAlice); hurtPig(pig, byAlice)
ok('more swings at the same pig: still cancelled, no second charge', Object.values(TDB().charges).length == 1)
ok('a zombie hurting it: cancelled, no charge', hurtPig(pig, { actual: entity('minecraft:zombie', OW, 0, 0, 0, []), getMsgId: () => 'mob' }) && Object.values(TDB().charges).length == 1)
ok('/kill still works on it', !hurtPig(pig, { actual: null, getMsgId: () => 'genericKill' }))
let iev = { player: alice, target: pig, hand: 'MAIN_HAND', item: stack('minecraft:lead', 1), cancelled: false, cancel() { throw new Exit() } }
fire('entityInteracted', iev)
ok('no leads, saddles or breeding (interaction cancelled)', iev.cancelled)
const stray = entity('minecraft:pig', OW, 5, 65, 5, ['homing_pig'])
ok('a leftover Homing Pig (not on record) is removed as it loads', !fireSpawn(stray))
ok('the live pig reloading with its chunk is kept', fireSpawn(pig))
advance(20 * 170)
advance(20 * 31)   // the next save
ok('after 3 minutes the pig vanishes and its record goes', pig.removed && !Object.keys(DB().homingPigs).length && W.cmds.some(x => /particle minecraft:poof/.test(x.c)))
ok('... and then Alice can let the next one out', (() => { hold(alice, isPigEgg); alice.inbox = []; clickT(alice, true); return Object.keys(DB().homingPigs).length == 1 })(), text(alice))
const pig2 = W.entities.find(e => !e.removed && e.type == 'minecraft:pig')
fire('death', { entity: pig2, source: {} })
advance(20 * 31)
ok('a pig that dies (/kill) is taken off the record', !Object.keys(DB().homingPigs).length)

// ----- trials -----
const tReply = () => flat(lastReply())
cmd('accuse Alice Loitering', carl.online = true && carl) ; carl.online = false
ok('a Loyalist can\'t file charges', /Only Enforcers/.test(tReply()), tReply())
players.forEach(p => { p.inbox = [] })
cmd('accuse Alice Loitering near the merchant', bob)
ok('an Enforcer files charge #2 against Alice: everyone online told, with the filer', /Charge #2 filed/.test(tReply()) && [admin, dave].every(p => /Charge #2 filed against Alice: Loitering near the merchant\. Filed by Bob\./.test(text(p))) &&
  /You stand accused \(#2\)/.test(text(alice)), text(admin))
cmd('accuse Bob Being Bob', bob); ok('no accusing yourself', /can't accuse yourself/.test(tReply()))
cmd('accuse Carl Absence', bob)
ok('an offline player can be charged (#3); told on login', TDB().charges['3'] && TDB().charges['3'].targetName == 'Carl' && TDB().notices['carl-1111'])
carl.online = true; carl.inbox = []; fire('loggedIn', { player: carl })
ok('... Carl hears about it when he logs in', /While you were away: You stand accused \(#3\)/.test(text(carl)), text(carl))
alice.inbox = []; cmd('charges', alice)
ok('/charges: Alice\'s open charges', /#1 /.test(text(alice)) && /#2 /.test(text(alice)) && !/#3 /.test(text(alice)), text(alice))
cmd('trial guilty 3', alice); ok('Alice isn\'t a judge', /Only Enforcers/.test(tReply()))
cmd('trial guilty 3', carl); ok('Carl (Loyalist) isn\'t either', /Only Enforcers/.test(tReply()))
players.forEach(p => { p.inbox = [] })
cmd('trial guilty 3 skipped the parade', bob)
ok('Bob rules: GUILTY, with the note, announced', TDB().charges['3'].status == 'guilty' && TDB().charges['3'].note == 'skipped the parade' && /Carl is found GUILTY of Absence/.test(text(dave)) && /Note: skipped the parade/.test(text(dave)), text(dave))
cmd('trial acquit 3', bob); ok('a closed charge can\'t be ruled on again', /already closed/.test(tReply()))
cmd('accuse Bob Excessive enforcement', admin)
cmd('trial acquit 4', bob); ok('nobody rules on a charge against themselves', /against yourself/.test(tReply()) && TDB().charges['4'].status == 'open')
cmd('trial acquit 4', admin); ok('an op can', TDB().charges['4'].status == 'acquitted' && /ACQUITTED/.test(text(dave)))
cmd('accuse Dave Typo', bob); cmd('trial drop 5', bob); ok('/trial drop withdraws', TDB().charges['5'].status == 'dropped')
bob.inbox = []; cmd('trial docket', bob)
ok('/trial docket: the open charges', /#1 Alice/.test(ftext(bob)) && /#2 Alice/.test(ftext(bob)) && !/#3/.test(ftext(bob)), ftext(bob))
cmd('trial docket', alice); ok('... judges only', /Only Enforcers/.test(tReply()))
dave.inbox = []; cmd('record Carl', dave)
ok('/record: anyone can read the permanent record', /permanent record of Carl \(1 charge, 1 guilty\)/.test(tReply()) && /#3 Absence - GUILTY/.test(ftext(dave)), tReply() + ftext(dave))
cmd('record Dave', dave); ok('... dropped charges are on it too', /withdrawn/.test(ftext(dave)))

// ----- the Certified Alibi -----
c0 = coinsOf(alice)
cmd('bm buy alibi', alice)
const al = realSlots(alice).find(isAlibi)
ok('bought: 50 coins, a serial-numbered paper on file', coinsOf(alice) == c0 - 50 && al && al.id == 'minecraft:paper' && DB().alibis[tc(al).alibi.serial] && !DB().alibis[tc(al).alibi.serial].used)
const serial = tc(al).alibi.serial
hold(alice, isAlibi); alice.inbox = []
clickT(alice, false)
ok('right-click: her open charges with [USE] buttons', /Which charge does your alibi cover/.test(text(alice)) && /\/trial alibi 1/.test(text(alice)) && /\/trial alibi 2/.test(text(alice)), text(alice))
cmd('trial alibi 3', alice); ok('not someone else\'s charge', /no charge #3/.test(tReply()) && realSlots(alice).some(isAlibi))
players.forEach(p => { p.inbox = [] })
cmd('trial alibi 2', alice)
ok('charge #2 dismissed: alibi certified, announced, the paper used up', TDB().charges['2'].status == 'dismissed' && /dismissed: alibi certified/.test(text(dave)) && !realSlots(alice).some(isAlibi) && DB().alibis[serial].used && DB().alibis[serial].on == '#2',
  [TDB().charges['2'].status, text(dave), realSlots(alice).some(isAlibi), JSON.stringify(DB().alibis[serial])].join(' / '))
setReal(alice, 5, stack('minecraft:paper', 1, al.snbtStr))
cmd('trial alibi 1', alice); ok('a copy of a used alibi is refused', /already used \(#2\)/.test(tReply()) && TDB().charges['1'].status == 'open', tReply())
setReal(alice, 5, stack('minecraft:paper', 1, '{trollcraft:{alibi:{serial:"NOPE"}}}'))
cmd('trial alibi 1', alice); ok('a forged one too', /isn't on file/.test(tReply()))
setReal(alice, 5, EMPTY())
cmd('trial alibi 1', alice); ok('without one: refused', /aren't carrying/.test(tReply()))
cmd('bm buy alibi', alice); cmd('accuse Alice Smirking', bob); cmd('trial guilty 6', bob)
cmd('trial alibi 6', alice); ok('alibis don\'t undo verdicts', /only work before the verdict/.test(tReply()) && realSlots(alice).some(isAlibi))
alice.inbox = []; cmd('charges', bob)
dave.inbox = []; cmd('charges', dave); ok('nothing to be accused of', /accused of nothing/.test(text(dave) + tReply()))

// ----- /bm inspect -----
setReal(admin, admin.selected, stack('minecraft:paper', 1, al.snbtStr)); cmd('bm inspect', admin)
ok('/bm inspect on an alibi: buyer and use', /Certified Alibi No\. .* bought by Alice/.test(tReply()) && /used by Alice on #2/.test(tReply()), tReply())
setReal(admin, admin.selected, stack('minecraft:compass', 1, comp1.snbtStr)); cmd('bm inspect', admin)
ok('/bm inspect on a compass: buyer and who switched it on', /Tracker Compass .* on Bob, bought by Alice/.test(tReply()) && /used by Alice/.test(tReply()), tReply())
setReal(admin, admin.selected, stack('minecraft:paper', 1, '{trollcraft:{alibi:{serial:"NOPE"}}}')); cmd('bm inspect', admin)
ok('... a forged alibi: not on file', /not on file\. Forged/.test(tReply()))
setReal(admin, admin.selected, EMPTY())
cmd('bm hand add 10', admin)
setReal(admin, admin.selected, stack('minecraft:paper', 1, al.snbtStr)); cmd('bm hand add 10', admin)
ok('alibis can\'t be put up for sale with /bm hand add', /can't be sold this way/.test(tReply()), tReply())

// ----- the Unsigned Declaration (with a stand-in for part2/purge.js's global.Purge) -----
const purgeCalls = []
const PurgeStub = {
  why: '', last: 0,
  start: (mode, minutes, kit, opts) => { if (PurgeStub.why) return PurgeStub.why; purgeCalls.push({ mode, minutes, kit, opts }); PurgeStub.why = 'A Purge is already counting down.'; return '' },
  busy: () => PurgeStub.why,
  lastEnded: () => PurgeStub.last,
  modes: { heist: { name: 'The Potato Heist', kits: ['soldier', 'peasant', 'archer', 'gladiator'] } },
  kits: { soldier: { name: 'Soldier', blurb: 'iron' }, peasant: { name: 'Peasant', blurb: 'wood' }, archer: { name: 'Archer', blurb: 'bow' }, gladiator: { name: 'Gladiator', blurb: 'diamond' } },
}
const isDecl = s => tc(s) && tc(s).declaration
const dReply = () => flat(lastReply())
openWin(alice)
ok('without part2/purge.js there\'s no Unsigned Declaration in the shop (just the blank pane)', slotName(alice, 8, 0) != 'Unsigned Declaration' && slotName(alice, 8, 0).trim() == '')
glob.Purge = PurgeStub
cmd('coins give Alice 100', admin)
openWin(alice)
ok('with it, the top row ends with the Unsigned Declaration: 60 Hush Coins, for anyone (no rank)', slotName(alice, 8, 0) == 'Unsigned Declaration' &&
  /60 Hush Coins/.test(slotLore(alice, 8, 0)) && !/Needs/.test(slotLore(alice, 8, 0)), slotLore(alice, 8, 0))
const dc0 = coinsOf(alice)
guiClick(alice, 8, 0)
const decl = findItem(alice, isDecl)
const dSerial = decl ? String(tc(decl).declaration.serial).replace(/"/g, '') : ''
ok('bought: 60 coins, a serial-numbered paper, on file with its buyer, not posted', coinsOf(alice) == dc0 - 60 && !!decl && decl.id == 'minecraft:paper' &&
  !!DB().declarations[dSerial] && DB().declarations[dSerial].buyerName == 'Alice' && !DB().declarations[dSerial].used, dSerial)
alice.closeMenu(); advance(1)
hold(alice, isDecl)
PurgeStub.last = W.time - 3 * 3600000
alice.inbox = []; clickT(alice)
ok('right-click 3 hours after the last Purge: too soon (12 hours), and it\'s kept', /Too soon after the last Purge: try again in 9 h/.test(ftext(alice)) && !!findItem(alice, isDecl), ftext(alice))
PurgeStub.last = W.time - 13 * 3600000
const carlWas = carl.online
bob.online = false; carl.online = false; admin.creative = true
alice.inbox = []; clickT(alice)
ok('... with only Alice and Dave playing (the admin in creative): not enough people about (3 needed)', /needs 3 players online/.test(ftext(alice)) && /There are 2/.test(ftext(alice)), ftext(alice))
bob.online = true; carl.online = carlWas; admin.creative = false
alice.inbox = []; clickT(alice)
const menu = alice.inbox.join('\n')
ok('... with enough people: a menu of the four kits, each with 5, 10, 15 and 30 minutes', /choose the kit and how long/i.test(ftext(alice)) &&
  ['soldier', 'peasant', 'archer', 'gladiator'].every(k => [5, 10, 15, 30].every(m => menu.indexOf('/blackmarket declare ' + dSerial + ' ' + k + ' ' + m) >= 0)) && !purgeCalls.length, ftext(alice))
ok('... that says nobody will know', /Nobody will know it was you/.test(ftext(alice)))
cmd('blackmarket declare ' + dSerial + ' gladiator 7', alice)
ok('only the offered lengths', /lasts 5, 10, 15, 30 minutes/.test(dReply()) && !purgeCalls.length, dReply())
cmd('blackmarket declare ' + dSerial + ' wizard 10', alice)
ok('... and the kits', /no kit called "wizard"/.test(dReply()) && !purgeCalls.length)
cmd('blackmarket declare ' + dSerial + ' gladiator 15', bob)
ok('Bob can\'t post Alice\'s declaration', /don't have that declaration on you/.test(dReply()) && !purgeCalls.length)
PurgeStub.why = 'A Purge is already running.'
cmd('blackmarket declare ' + dSerial + ' gladiator 15', alice)
ok('while a Purge runs: refused, kept', /already running or counting down/.test(dReply()) && !!findItem(alice, isDecl) && !purgeCalls.length, dReply())
PurgeStub.why = ''
cmd('blackmarket declare ' + dSerial + ' gladiator 15', alice)
ok('posted: the Purge\'s countdown starts (the Heist, gladiator, 15 minutes, declared)', purgeCalls.length == 1 && purgeCalls[0].mode == 'heist' && purgeCalls[0].kit == 'gladiator' &&
  purgeCalls[0].minutes == 15 && purgeCalls[0].opts && purgeCalls[0].opts.declared === true, JSON.stringify(purgeCalls))
ok('... the paper is used up and on file as posted', !findItem(alice, isDecl) && !!DB().declarations[dSerial].used && DB().declarations[dSerial].postedBy == 'Alice' &&
  DB().declarations[dSerial].kit == 'gladiator' && DB().declarations[dSerial].minutes == 15)
ok('... and Alice is told privately', /Your declaration has been posted\. Nobody will know it was you\./.test(dReply()))
setReal(alice, alice.selected, stack('minecraft:paper', 1, decl.snbtStr))
alice.inbox = []; clickT(alice)
ok('a copy of a posted declaration does nothing', /has already been posted/.test(ftext(alice)), ftext(alice))
setReal(alice, alice.selected, stack('minecraft:paper', 1, '{trollcraft:{declaration:{serial:"FAKE1"}}}'))
alice.inbox = []; clickT(alice)
ok('... nor does a forged one', /isn't on file\. A forgery/.test(ftext(alice)), ftext(alice))
setReal(alice, alice.selected, EMPTY())
cmd('bm declarations', alice)
ok('/bm declarations is op-only', lastReply() == 'DENIED')
cmd('bm declarations', admin)
ok('... and shows ops who bought and who posted it', replies.some(r => new RegExp('No\\. ' + dSerial + ': bought by Alice .*posted by Alice .*\\(gladiator, 15 min\\)').test(flat(r))), replies.slice(-3).map(flat).join(' / '))
setReal(admin, admin.selected, stack('minecraft:paper', 1, decl.snbtStr)); cmd('bm inspect', admin)
ok('/bm inspect on a declaration: its buyer', /Unsigned Declaration No\. .* bought by Alice/.test(dReply()) && /already posted/.test(dReply()), dReply())
cmd('bm hand add 10', admin)
ok('... and it can\'t be put up for sale with /bm hand add', /declarations can't be sold this way/.test(dReply()), dReply())
setReal(admin, admin.selected, EMPTY())
delete glob.Purge

// ----- /reload keeps everything -----
const before = W.persistent.trials
loadAll(); fire('loaded', { server }); advance(5)
cmd('record Carl', dave)
ok('/reload: the record is still there', /GUILTY/.test(ftext(dave)) && JSON.parse(W.persistent.trials).next == JSON.parse(before).next)
ok('no Discord relays anywhere', !W.cmds.some(x => /tellraw @a/.test(x.c)))

console.log(W.logs.filter(l => /^E /.test(l)).join('\n') || '(no errors logged)')
console.log(fails ? fails + ' FAILED' : 'ALL PASSED')
