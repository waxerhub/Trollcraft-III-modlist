// Run with: node tools/tests/run_all.js clean_slate   (or node tools/tests/suites/clean_slate.test.js)
const REPO_ROOT = require('path').resolve(__dirname, '..', '..', '..')
// Mock KubeJS 6 server running economy/black_market.js together with factions/portal_ambush.js.
const fs = require('fs')
const snbt = require('../lib/snbt.js')
const BM_FILE = process.env.BM_FILE || REPO_ROOT + '/tools/kubejs/server_scripts/economy/black_market.js'
const BOUNTY_FILE = process.env.BOUNTY_FILE || REPO_ROOT + '/tools/kubejs/server_scripts/economy/bounties.js'
const ELI_FILE = REPO_ROOT + '/tools/kubejs/server_scripts/end_lockdown.js'
const TRIALS_FILE = process.env.TRIALS_FILE || REPO_ROOT + '/tools/kubejs/server_scripts/factions/trials.js'
const PA_FILE = process.env.PA_FILE || REPO_ROOT + '/tools/kubejs/server_scripts/factions/portal_ambush.js'
const SS = REPO_ROOT + '/tools/kubejs/server_scripts/'
let fails = 0
const ok = (l, c, e) => { console.log((c ? 'ok   ' : 'FAIL ') + l + (e !== undefined && !c ? '  ' + e : '')); if (!c) fails++ }
class Exit extends Error {}

const OW = 'minecraft:overworld', NE = 'minecraft:the_nether', EN = 'minecraft:the_end'
const W = { files: {}, chests: {}, placed: {}, explosions: [], time: 1.7e12, tick: 0, q: [], cmds: [], logs: [], drops: [], persistent: {}, entities: [], recipes: [], dayTime: 15000 }
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
;[OW, NE, EN].forEach(d => {
  levels[d] = {
    dimension: { toString: () => d },
    getBlock: (x, y, z) => {
      const key = d + '|' + x + '|' + y + '|' + z, ch = W.chests && W.chests[key]
      if (ch) return chestBlock(d, x, y, z, ch)
      const id = W.placed[key] || blockAt(d, x, y, z); return { id, x, y, z, blockState: { blocksMotion: () => id != 'minecraft:air' } } },
    getHeight: (type, x, z) => (d == EN && x == 0 && z == 0 ? 68 : 65),
    createEntity: t => { throw new Error('no createEntity in the mock') },
    createExplosion: (x, y, z) => { const e = { dim: d, x, y, z, strength: 0, mode: null, fire: null, t: W.tick }; const c = { strength(v) { e.strength = v; return c }, causesFire(v) { e.fire = v; return c }, explosionMode(m) { e.mode = m; return c }, exploder() { return c }, explode() { W.explosions.push(e) } }; return c },
    getSharedSpawnPos: () => ({ getX: () => 0, getY: () => 65, getZ: () => 0 }),
    getDifficulty: () => ({ toString: () => 'NORMAL' }),
    getDayTime: () => W.dayTime,
    getWorldBorder: () => ({ isWithinBounds: (x, z) => Math.abs(x) < 5000 && Math.abs(z) < 5000 }),
  }
})
// A chest: { lootTable, items: [27 stacks], opened }. Opening it (the right-click going through) generates the loot.
function chestBlock(d, x, y, z, ch) {
  return { id: ch.id || 'minecraft:chest', x, y, z, get level() { return levels[d] },
    get entityData() { return { contains: k => k == 'LootTable' && !!ch.lootTable, getString: k => ch.lootTable || '' } },
    entity: { getContainerSize: () => 27, getItem: i => ch.items[i], setItem: (i, s) => { ch.items[i] = s }, setChanged: () => { ch.changed = true } } }
}
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
    isCreative() { return this.creative }, isSpectator() { return !!this.spectator }, hasPermissions(n) { return this.op },
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
  new Function('PlayerEvents', 'EntityEvents', 'ServerEvents', 'ItemEvents', 'BlockEvents', 'Utils', 'Text', 'Item', 'Ingredient', 'console', 'global', 'Java', 'Date', 'JsonIO', src)(
    { loggedIn: on('loggedIn'), loggedOut: on('loggedOut'), chestOpened: on('chestOpened'), inventoryChanged: on('inventoryChanged') }, { hurt: on('hurt'), death: on('death'), spawned: on('spawned') },
    { loaded: on('loaded'), commandRegistry: f => f(ev), recipes: f => { const rev = { replaceInput: (filter, from, to) => W.recipes.push({ filter, from, to }), remove: filt => { (W.removedRecipes = W.removedRecipes || []).push(filt) } }; f(rev) } },
    { rightClicked: on('itemRightClicked'), entityInteracted: on('entityInteracted'), foodEaten: on('foodEaten'), pickedUp: on('pickedUp') }, { rightClicked: on('blockRightClicked'), placed: on('blockPlaced'), broken: on('blockBroken') },
    Utils, Text, Item, Ingredient,
    { info: m => W.logs.push('I ' + m), warn: m => W.logs.push('W ' + m), error: m => W.logs.push('E ' + m) }, glob, Java, Datex,
    { write: (path, obj) => { W.files[path] = JSON.parse(JSON.stringify(obj)) }, read: path => W.files[path] || null })
}
function loadAll(bmSrc, paSrc) {
  handlers = {}; roots = {}
  for (const k in flist) delete flist[k]
  glob.Factions = Object.assign({}, Factions)   // like the real thing: factions_core makes a new object on every load
  W.recipes = []
  loadOne(fs.readFileSync(SS + 'clean_slate.js', 'utf8'))             // clean_slate.js sorts first
  loadOne(bmSrc || fs.readFileSync(BM_FILE, 'utf8'))   // economy/ loads before factions/
  if (!process.env.NO_ELI) loadOne(fs.readFileSync(ELI_FILE, 'utf8'))   // end_lockdown.js sorts between economy/ and factions/
  if (!process.env.NO_BOUNTY) loadOne(fs.readFileSync(BOUNTY_FILE, 'utf8'))
  loadOne(fs.readFileSync(REPO_ROOT + '/tools/kubejs/server_scripts/economy/trolls.js', 'utf8'))
  loadOne(fs.readFileSync(SS + 'events/blood_portal.js', 'utf8'))      // events/ before factions/
  loadOne(paSrc || fs.readFileSync(PA_FILE, 'utf8'))
  loadOne(fs.readFileSync(TRIALS_FILE, 'utf8'))
  loadOne(fs.readFileSync(REPO_ROOT + '/tools/kubejs/server_scripts/story.js', 'utf8'))
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
// clean_slate.js and events/blood_portal.js (with story.js, trolls.js, portal_ambush.js loaded)
const CDB = () => JSON.parse(W.persistent.clean_slate || '{}')
const BDB = () => JSON.parse(W.persistent.blood_portal || '{}')
const SDB = () => JSON.parse(W.persistent.story || '{}')
const cmdsSince = n => W.cmds.slice(n).map(x => x.c)
const said = n => cmdsSince(n).filter(c => /^tellraw @a /.test(c)).map(c => flat(c.replace(/^tellraw @a /, '')))
const inbox = p => p.inbox.map(flat).join('\n')
const EC = 'minecraft:chests/end_city_treasure'
W.fireTick = 1
W.bloodOk = false
W.hypixel = []
W.joined = {}
glob.fakePlayers = { say: (n, t) => { if (!W.joined[n]) return n + ' is not a pretend player. /fakejoin them first.'; W.hypixel.push(t); return '<' + n + '> ' + t } }
const baseRun = server.runCommandSilent.bind(server)
server.runCommandSilent = function (c) {
  let m
  if (c == 'gamerule doFireTick') { W.cmds.push({ t: W.tick, c }); return W.fireTick }
  if ((m = c.match(/^gamerule doFireTick (true|false)$/))) { W.cmds.push({ t: W.tick, c }); W.fireTick = m[1] == 'true' ? 1 : 0; return 1 }
  if ((m = c.match(/^gamemode spectator (\S+)$/))) { W.cmds.push({ t: W.tick, c }); const p = players.find(x => x.name == m[1]); if (p) p.spectator = true; return p ? 1 : 0 }
  if ((m = c.match(/^fakejoin (\S+)$/))) { W.cmds.push({ t: W.tick, c }); W.joined[m[1]] = true; return 1 }
  if ((m = c.match(/^execute in (\S+) run tp ([A-Za-z_]\w*) (\S+) (\S+) (\S+)$/))) {
    W.cmds.push({ t: W.tick, c }); const p = players.find(x => x.name == m[2]); if (p) { p.dim = m[1]; p.x = +m[3]; p.y = +m[4]; p.z = +m[5] } return p ? 1 : 0
  }
  if ((m = c.match(/^execute in (\S+) run fill (-?\d+) (-?\d+) (-?\d+) (-?\d+) (-?\d+) (-?\d+) (\S+)$/))) {
    W.cmds.push({ t: W.tick, c })
    if (m[8] == 'evilcraft:blood' && !W.bloodOk) return 0
    let n = 0
    for (let x = +m[2]; x <= +m[5]; x++) for (let y = +m[3]; y <= +m[6]; y++) for (let z = +m[4]; z <= +m[7]; z++) { W.placed[m[1] + '|' + x + '|' + y + '|' + z] = m[8]; n++ }
    return n
  }
  return baseRun(c)
}
W.fightKilled = false
levels[EN].getDragonFight = () => ({ hasPreviouslyKilledDragon: () => W.fightKilled })
loadAll()
Utils.server = server
fire('loaded', { server })
const mk = (n, f, dim, x, z, op) => {
  const p = player(n, f, dim, x, 65, z, op); p.ip = '10.0.0.' + players.length; p.getIpAddress = () => p.ip
  p.connection = { disconnect: c => { p.kicked = (p.kicked || []).concat([c.json || c.text]); p.online = false } }
  return p
}
const admin = mk('Admin', 'ministry', OW, 500.5, 500.5, true), ana = mk('Ana', 'syndicate', OW, 1001.5, 1000.5), bo = mk('Bo', 'ministry', OW, 1002.5, 1000.5)
admin.creative = true
players.push(admin, ana, bo)
players.forEach(p => fire('loggedIn', { player: p, server }))
advance(60)
const realRandom = Math.random
const chestAt = (x, y, z) => { W.chests[EN + '|' + x + '|' + y + '|' + z] = { lootTable: EC, items: Array.from({ length: 27 }, () => EMPTY()) }; return W.chests[EN + '|' + x + '|' + y + '|' + z] }
// A player right-clicks the chest; if `opens`, the loot is generated (the LootTable goes) as the window opens.
function openChest(p, x, y, z, opens) {
  const ch = W.chests[EN + '|' + x + '|' + y + '|' + z]
  fire('blockRightClicked', { player: p, server, block: levels[EN].getBlock(x, y, z), cancel() { throw new Exit() } })
  if (opens) { ch.lootTable = null; ch.items[0] = stack('minecraft:diamond', 3) }
  advance(3)
  return ch
}
const relicIn = s => s.count > 0 && s.parsed && s.parsed.trollcraft && s.parsed.trollcraft.relic
const bookIn = s => s.count > 0 && s.id == 'minecraft:written_book' && s.parsed && s.parsed.trollcraft
const killDragon = by => {
  const d = entity('minecraft:ender_dragon', EN, 0, 80, 0, [])
  fire('death', { entity: d, source: { actual: by || null }, server })
}

// ----- before anything -----
cmd('cleanslate status', admin)
ok('/cleanslate status before: not started, the dragon alive', /Not started/.test(replies.slice(-3).map(flat).join(' ')) && /The dragon: not killed yet/.test(replies.slice(-3).map(flat).join(' ')), replies.slice(-3).map(flat).join(' | '))
ok('/cleanslate is op-only', cmd('cleanslate status', ana) == 0 && lastReply() == 'DENIED')
cmd('bloodportal start', bo)
ok('/bloodportal start before the Relics: refused', /must carry all 10 Blood Relics/.test(flat(lastReply())), lastReply())

// ----- Archives in End City chests (any time), Relics only during Clean Slate -----
Math.random = () => 0.1
let ch = chestAt(100, 60, 100)
openChest(ana, 100, 60, 100, true)
let book = ch.items.find(bookIn)
ok('an End City chest before Clean Slate: an Archive book, but no Relic', book && !ch.items.some(relicIn), JSON.stringify(ch.items.filter(s => s.count > 0).map(s => s.id)))
ok('... a signed book: title within 32 characters, the Ministry as author, pages, CLASSIFIED lore', book && book.parsed.title.length <= 32 && /Ministry of Trolling \(CLASSIFIED\)/.test(book.parsed.author) &&
  book.parsed.pages.length >= 3 && book.parsed.generation == '0' && /CLASSIFIED: Archive Record #/.test(book.parsed.display.Lore[0]), book && JSON.stringify(book.parsed).slice(0, 300))
ok('... the vanilla loot is kept', ch.items[0].id == 'minecraft:diamond' && ch.items[0].count == 3)
const before1 = BDB().chestsRolled
openChest(ana, 100, 60, 100, false)
ok('the same chest again (already looted): nothing more', BDB().chestsRolled == before1 && ch.items.filter(bookIn).length == 1)
let ch2 = chestAt(110, 60, 100)
openChest(ana, 110, 60, 100, false)
ok('a right-click that doesn\'t open the chest (still unlooted): nothing rolled', BDB().chestsRolled == before1 && !ch2.items.some(s => s.count > 0))
W.chests[OW + '|5|70|5'] = { lootTable: EC, items: Array.from({ length: 27 }, () => EMPTY()) }
fire('blockRightClicked', { player: ana, server, block: levels[OW].getBlock(5, 70, 5) }); W.chests[OW + '|5|70|5'].lootTable = null; advance(3)
ok('an end_city_treasure chest outside the End: nothing', !W.chests[OW + '|5|70|5'].items.some(s => s.count > 0))

// ----- a test run, and cancel -----
let c0 = W.cmds.length
admin.inbox = []
cmd('cleanslate test', admin)
ok('/cleanslate test: running, only the op sees it (no tellraw @a, no weather, no gamerule)', CDB().state == 'running' && CDB().test == 'admin-1111' &&
  !cmdsSince(c0).some(c => /^tellraw @a|^weather|^gamerule/.test(c)) && /Protocol Clean Slate is now in effect/.test(inbox(admin)) && /burning the world to bury/.test(inbox(admin)) && cmdsSince(c0).some(c => /bossbar set trollcraft:clean_slate players Admin/.test(c)), cmdsSince(c0).join(' | '))
ok('... the story act isn\'t changed by a test', SDB().act != 'finale')
W.time += 3 * 60000; advance(40)
advance(20 * 10)
ok('... at zero: the Last Broadcast to the op only, nobody put in spectator, back to idle', CDB().state == 'idle' && !players.some(p => p.spectator) && /Protocol Clean Slate is complete/.test(inbox(admin)) &&
  !/complete/.test(inbox(bo)) && !cmdsSince(c0).some(c => /^tellraw @a/.test(c)) && W.fireTick == 1, inbox(admin).slice(-300))

// ----- /story act set finale starts it too -----
c0 = W.cmds.length
cmd('story act set finale', admin); advance(20)
ok('/story act set finale: Clean Slate starts (the countdown, doFireTick off, thunder)', CDB().state == 'running' && !CDB().test && W.fireTick == 0 && cmdsSince(c0).some(c => /^weather thunder/.test(c)))
advance(20 * 30)
cmd('cleanslate cancel', admin)
ok('/cleanslate cancel: idle, doFireTick back, bossbar gone, weather clear', CDB().state == 'idle' && W.fireTick == 1 && cmdsSince(c0).some(c => c == 'bossbar remove trollcraft:clean_slate') && cmdsSince(c0).some(c => c == 'weather clear'))

// ----- the dragon -----
ana.dim = EN; ana.x = 3.5; ana.y = 64; ana.z = 3.5
c0 = W.cmds.length
killDragon(ana)
advance(5)
ok('the dragon dies: Clean Slate is pending for a few seconds', CDB().state == 'pending' && CDB().dragonKilled.by == 'Ana')
advance(20 * 12)
const startCmds = cmdsSince(c0)
ok('... then it starts: the finale act (PROTOCOL / CLEAN SLATE), bossbar, thunder, doFireTick off', CDB().state == 'running' && SDB().act == 'finale' &&
  startCmds.some(c => /^title @a title .*PROTOCOL/.test(c)) && startCmds.some(c => /bossbar add trollcraft:clean_slate/.test(c)) && W.fireTick == 0, startCmds.join(' | ').slice(0, 600))
advance(20 * 30)
const finaleLines = cmdsSince(c0).filter(c => /^tellraw @a .*(MINISTRY|SIGNAL HIJACKED)/.test(c))
ok('... the Ministry fires it to wipe the records, then the hijacked signal answers', /MINISTRY/.test(finaleLines[0]) && /records have been accessed/.test(finaleLines[0]) &&
  finaleLines.some(c => /Nothing incriminating was ever written down/.test(c)) &&
  finaleLines.findIndex(c => /SIGNAL HIJACKED/.test(c)) > finaleLines.findIndex(c => /Nothing incriminating/.test(c)) && !finaleLines.some(c => /emergency broadcast/.test(c)), finaleLines.map(c => c.slice(0, 90)).join(' | '))
ok('... and the hijacked signal sends everyone to the End City treasure chests for the Relics', finaleLines.some(c => /SIGNAL HIJACKED/.test(c) && /ten Blood Relics in the End City treasure chests/.test(c)))
const billBook = realSlots(ana).find(st => st.count > 0 && st.id == 'minecraft:written_book' && st.parsed && st.parsed.title == 'Draft Bill 9-D')
ok('... Draft Bill 9-D goes straight into the killer\'s inventory (nothing dropped on the ground), dated today', billBook && !cmdsSince(c0).some(c => /summon minecraft:item .*written_book/.test(c)) &&
  billBook.parsed.pages[0].indexOf(new Date(W.time).getUTCFullYear() + '') > 0, billBook && billBook.parsed.pages[0])
ok('... a valid book (title, author, 6 pages), Goruk not informed', billBook && billBook.parsed.pages.length == 6 && /Ministry of Trolling/.test(billBook.parsed.author) &&
  /Goruk not informed/.test(billBook.parsed.pages.join(' ')) && /SECOND READING PASSED/.test(billBook.parsed.pages[0]))
ok('... and Ana is told privately', inbox(ana).indexOf('newest bill. It\'s in your inventory') >= 0 && !said(c0).some(c => /in your inventory/.test(c)))
ok('... and the hijacked line about the records', cmdsSince(c0).some(c => /dragon guarded the Ministry.s records. Read them before they burn/.test(c)))
const started = CDB().startedAt
c0 = W.cmds.length
killDragon(ana); advance(20 * 15)
ok('a second dragon: no second bill, Clean Slate not restarted', CDB().startedAt == started && !cmdsSince(c0).some(c => /written_book/.test(c)))
// The kill not credited to a player: the nearest player in the End gets the bill; with nobody in the End, it's dropped on the pillar.
const resetBill = () => { const d = BDB(); delete d.billDropped; W.persistent.blood_portal = JSON.stringify(d); loadAll(); fire('loaded', { server }); advance(2) }
resetBill()
bo.dim = EN; bo.x = 1.5; bo.y = 70; bo.z = 1.5
killDragon(null); advance(5)
ok('no credited killer: the nearest player in the End (Bo) gets the bill', realSlots(bo).some(st => st.count > 0 && st.parsed && st.parsed.title == 'Draft Bill 9-D') && BDB().billDropped.to == 'Bo')
realSlots(bo).forEach(st => { if (st.parsed && st.parsed.title == 'Draft Bill 9-D') st.count = 0 })
bo.dim = OW; bo.x = 1002.5; bo.y = 65; bo.z = 1000.5
const anaDim = ana.dim; ana.dim = OW
resetBill()
c0 = W.cmds.length
killDragon(null); advance(5)
ok('nobody in the End: dropped on the exit portal pillar instead', cmdsSince(c0).some(c => /summon minecraft:item 0.5 \S+ 0.5 .*Draft Bill 9-D/.test(c)) && BDB().billDropped && BDB().billDropped.to == '')
ana.dim = anaDim

// ----- the countdown -----
c0 = W.cmds.length
advance(20 * 21)
ok('the bossbar shows the time left', cmdsSince(c0).some(c => /bossbar set trollcraft:clean_slate name .*PROTOCOL CLEAN SLATE: .*3d 23h/.test(c)), cmdsSince(c0).filter(c => /bossbar/.test(c)).join(' | ').slice(0, 300))
ok('visual-only lightning near Overworld players (sparks and thunder in the mock)', cmdsSince(c0).some(c => /particle minecraft:electric_spark/.test(c)) || W.cmds.some(c => /electric_spark/.test(c.c)))
c0 = W.cmds.length
W.time += 25 * 3600000; advance(40); advance(100)
const m72 = cmdsSince(c0).filter(c => /^tellraw @a/.test(c))
const m72t = said(c0)
ok('under 72 h left: the Ministry\'s line (hand records in for safe burning), then the hijacked reply', m72t.some(c => /MINISTRY/.test(c) && /safe/.test(c) && /burning/.test(c)) && m72t.some(c => /Three days/.test(c)), m72t.join(' | ').slice(0, 400))
ok('... the 72 h reply names the End City treasure chests', m72t.some(c => /Three days. Ten Blood Relics sleep in the End City treasure chests/.test(c)))
ok('every 6 hours until the Relics are gathered: a hijacked reminder about the End City chests, with the count found', m72t.some(c => /SIGNAL HIJACKED/.test(c) && /End City treasure chests/.test(c) && /\(0 of 10 have surfaced so far\.\)/.test(c)), m72t.join(' | ').slice(0, 600))
W.time += 60 * 60000; advance(20 * 60)
ok('thunder is renewed every few minutes', cmdsSince(c0).filter(c => /^weather thunder/.test(c)).length >= 1)

// ----- the Relics -----
const relicsBefore = BDB().found
for (let i = 0; i < 12; i++) { chestAt(200 + i * 3, 60, 200); openChest(ana, 200 + i * 3, 60, 200, true) }
const F = BDB().found
ok('during Clean Slate: each chest also gets a Relic, the least-found first (10 different before any repeats)', Object.keys(F).length == 10 && Object.keys(F).every(k => F[k] >= 1 && F[k] <= 2), JSON.stringify(F))
ok('... Archive books too, never the dragon\'s bill', !BDB().foundArchives.dwarf_bill && Object.keys(BDB().foundArchives).length == 10, JSON.stringify(BDB().foundArchives))
// Quark replaces End City chests with purpur chests; other loot tables in the End don't count.
const qc = chestAt(300, 60, 300); qc.id = 'quark:purpur_chest'
openChest(ana, 300, 60, 300, true)
ok('a Quark purpur chest with the End City loot table: gets a Relic and a book too', qc.items.some(relicIn) && qc.items.some(bookIn), JSON.stringify(qc.items.filter(s => s.count > 0).map(s => s.id)))
ok('... and it\'s written to the server log', W.logs.some(l => /Unlooted quark:purpur_chest opened at 300 60 300 \(minecraft:chests\/end_city_treasure\)/.test(l)))
const oc = chestAt(310, 60, 300); oc.lootTable = 'minecraft:chests/simple_dungeon'
const rolled0 = BDB().chestsRolled
openChest(ana, 310, 60, 300, true)
ok('another loot table in the End: nothing added, but logged with its table (to spot modded End City loot)', BDB().chestsRolled == rolled0 && !oc.items.some(s => relicIn(s) || bookIn(s)) &&
  W.logs.some(l => /loot table minecraft:chests\/simple_dungeon \(not in END_CITY_LOOT\)/.test(l)))
Math.random = realRandom
// five each on two players: not unlocked
cmd('bloodportal relic give Ana blade_shard', admin); cmd('bloodportal relic give Ana crown_jewel', admin); cmd('bloodportal relic give Ana carl_horseshoe', admin)
cmd('bloodportal relic give Ana last_potato', admin); cmd('bloodportal relic give Ana oinkington_letter', admin)
cmd('bloodportal relic give Bo swine_tusk', admin); cmd('bloodportal relic give Bo blood_god_tear', admin); cmd('bloodportal relic give Bo unredacted_act', admin)
cmd('bloodportal relic give Bo anarchist_banner', admin); cmd('bloodportal relic give Bo undying_ember', admin)
advance(40)
ok('ten Relics split between two players: not enough', !BDB().unlocked && realSlots(ana).filter(relicIn).length == 5)
ok('a Relic: the right name, glint, hidden tag', (() => { const s = realSlots(ana).find(relicIn); return s && /Shard of the Blade/.test(s.parsed.display.Name) && s.id == 'minecraft:echo_shard' && s.snbtStr.indexOf('Enchantments') > 0 })())
cmd('bloodportal relic give Ana nonsense', admin); ok('an unknown Relic id lists them', /Relics: blade_shard/.test(flat(lastReply())))
realSlots(bo).forEach((s, i) => { if (relicIn(s)) { ana.give(s.copy()); s.count = 0 } })
players.forEach(p => { p.inbox = [] })
advance(40)
ok('all ten in Ana\'s inventory: /bloodportal start opens for everyone; hypixel joins and says so', BDB().unlocked && BDB().unlocked.by == 'Ana' && W.joined.hypixel && /bloodportal start/.test(text(bo)), JSON.stringify(BDB().unlocked) + ' ' + text(bo))
advance(20 * 5)
ok('... hypixel\'s lines', W.hypixel.some(l => /All ten Relics/.test(l)) && W.hypixel.some(l => /\/bloodportal start/.test(l)), W.hypixel.join(' | '))
c0 = W.cmds.length
W.time += 7 * 3600000; advance(40); advance(100)
ok('once the Relics are gathered: no more reminders', !said(c0).some(c => /End City chests|surfaced so far/.test(c)), said(c0).join(' | ').slice(0, 300))

// ----- setting up and starting the event -----
cmd('bloodportal start', bo)
ok('start without an arena or portal: refused, ask an admin', /isn.t ready/.test(flat(lastReply())), lastReply())
admin.dim = OW; admin.x = 500.5; admin.y = 65; admin.z = 500.5
cmd('bloodportal setarena 24', admin)
ok('/bloodportal setarena 24', BDB().arena && BDB().arena.r == 24 && BDB().arena.x == 500.5)
admin.x = 520.5; admin.z = 520.5
c0 = W.cmds.length
cmd('bloodportal buildportal', admin)
ok('/bloodportal buildportal: a 7x7 bedrock basin centred on the op, the 5x5 inside left empty', BDB().portal && BDB().portal.x == 518 && BDB().portal.y == 65 && BDB().portal.z == 518 && BDB().portal.size == 5 &&
  W.placed[OW + '|517|65|517'] == 'minecraft:bedrock' && W.placed[OW + '|518|64|518'] == 'minecraft:bedrock' && W.placed[OW + '|518|65|518'] == 'minecraft:air' && W.placed[OW + '|522|65|522'] == 'minecraft:air' &&
  W.placed[OW + '|523|65|523'] == 'minecraft:bedrock' && W.placed[OW + '|520|65|523'] == 'minecraft:bedrock', cmdsSince(c0).join(' | '))
cmd('bloodportal setportal', admin)
ok('/bloodportal setportal finds the same 5x5 basin when standing inside it', BDB().portal.x == 518 && BDB().portal.z == 518 && BDB().portal.size == 5 && /5x5/.test(flat(lastReply())), flat(lastReply()))
ana.dim = OW; ana.x = 900; ana.z = 900; bo.x = 950; bo.z = 950
c0 = W.cmds.length
cmd('bloodportal start', bo)
ok('/bloodportal start (any player): the event runs', BDB().state == 'running' && BDB().startedBy == 'Bo', lastReply())
ok('... everyone (not spectators) pulled to the arena, and their spawn set there', Math.abs(ana.x - 500.5) < 4 && Math.abs(bo.z - 500.5) < 4 &&
  cmdsSince(c0).some(c => /spawnpoint Ana 500 65 500/.test(c)) && cmdsSince(c0).some(c => /spawnpoint Admin/.test(c)), cmdsSince(c0).filter(c => /tp|spawnpoint/.test(c)).join(' | '))
ok('... the "Blood Pool" bossbar', cmdsSince(c0).some(c => /bossbar add trollcraft:blood_pool .*Blood Pool/.test(c)))
cmd('bloodportal start', ana); ok('starting again: refused', /already begun/.test(flat(lastReply())))
c0 = W.cmds.length
advance(20 * 6)
const wave1 = mobs().filter(e => e._tags.indexOf('blood_portal') >= 0)
ok('Inspectors come (through portal_ambush), 3 to begin with, tagged for the event', wave1.length >= 2 && wave1.length <= 3 && wave1.every(e => /Ministry Inspector/.test(e.nbt)), wave1.length + ' ' + (wave1[0] && wave1[0].nbt.slice(0, 200)))
ok('... blood particles in the arena', cmdsSince(c0).some(c => /particle minecraft:(dust 0.6 0 0|crimson_spore)/.test(c)))

// ----- filling the pool -----
const killMob = e => { e.alive = false; fire('death', { entity: e, source: { actual: ana }, server }); e.removed = true }
killMob(wave1[0])
ok('an Inspector killed: +1', BDB().points == 1 && BDB().kills == 1)
killMob(entity('minecraft:evoker', OW, 505, 65, 505, ['portal_ambush', 'blood_portal']))
killMob(entity('minecraft:vex', OW, 505, 65, 505, ['portal_ambush', 'blood_portal']))
ok('an evoker: +3; a vex: 0', BDB().points == 4 && BDB().kills == 3)
killMob(entity('minecraft:vindicator', OW, 505, 65, 505, ['portal_ambush']))
ok('a mob that isn\'t the event\'s: nothing', BDB().points == 4)
for (let i = 0; i < 20; i++) killMob(entity('minecraft:vindicator', OW, 505, 65, 505, ['portal_ambush', 'blood_portal']))
c0 = W.cmds.length
advance(20 * 6)
ok('half full: more Inspectors wanted, a tougher tier', mobs().filter(e => e._tags.indexOf('blood_portal') >= 0).length > wave1.length - 1, mobs().length)
W.hypixel = []
for (let i = 0; i < 16; i++) killMob(entity('minecraft:vindicator', OW, 505, 65, 505, ['portal_ambush', 'blood_portal']))
ok('40 points: the Pool is full', BDB().state == 'full')
ok('... the Inspectors left are removed', mobs().filter(e => e._tags.indexOf('blood_portal') >= 0).length == 0)
ok('... the portal fills (EvilCraft blood unavailable in the mock: red glass instead)', cmdsSince(c0).some(c => /fill 518 65 518 522 65 522 evilcraft:blood/.test(c)) && W.placed[OW + '|520|65|520'] == 'minecraft:red_stained_glass')
advance(20 * 10)
ok('... hypixel: "The time has come to escape, players! COME TO THE NEW WORLD!"', W.hypixel.some(l => /The time has come to escape, players!/.test(l)) && W.hypixel.some(l => /COME TO THE NEW WORLD/.test(l)), W.hypixel.join(' | '))

// ----- escaping -----
admin.x = 520.5; admin.y = 65; admin.z = 520.5
advance(20)
ok('a creative op in the portal: not taken', !BDB().escaped['admin-1111'] && admin.online)
ana.x = 522.5; ana.y = 66; ana.z = 522.7   // the 5th row and column
c0 = W.cmds.length
advance(20)
ok('Ana steps in: escaped and kicked with the thematic message', BDB().escaped['ana-1111'] && ana.kicked && /The blood takes you/.test(ana.kicked[0]) && /Technoblade never dies/.test(ana.kicked[0]), JSON.stringify(ana.kicked))
const ex = W.files['kubejs/exodus/Ana_ana-1111.json']
ok('... her legacy is saved for Part II (inventory with the Relics, faction, troll stats)', ex && ex.inventory.filter(s => /relic/.test(s.nbt)).length == 10 && ex.legacy.faction == 'syndicate', ex && JSON.stringify(ex.legacy))
ok('... and announced', cmdsSince(c0).some(c => /Ana has passed through the Blood Portal/.test(c)))
ana.online = true; ana.kicked = null
fire('loggedIn', { player: ana, server }); advance(60)
ok('Ana logs back in: kicked again', ana.kicked && /already passed through/.test(ana.kicked[0]))

// ----- /reload in the middle -----
const leftBefore = CDB().endsAt
loadAll(); fire('loaded', { server }); advance(40)
ok('/reload: Clean Slate still running, the portal still open, escapes kept', CDB().state == 'running' && CDB().endsAt == leftBefore && BDB().state == 'full' && glob.BloodPortal.hasEscaped('ana-1111'))
cmd('cleanslate status', admin)
ok('/cleanslate status shows the Blood Portal too', /Blood Portal: Relics gathered by Ana, event full, 1 escaped/.test(replies.slice(-4).map(flat).join(' ')), replies.slice(-4).map(flat).join(' | '))

// ----- extend, pause, resume -----
const ends0 = CDB().endsAt
cmd('cleanslate extend 2', admin)
ok('/cleanslate extend 2: two more hours', CDB().endsAt == ends0 + 2 * 3600000)
cmd('cleanslate pause', admin)
const paused = CDB().pausedLeft
W.time += 3600000; advance(40)
ok('/cleanslate pause: time stops (an hour later, the same time left)', CDB().pausedLeft == paused && CDB().state == 'running')
cmd('cleanslate resume', admin)
ok('/cleanslate resume: it carries on from there', Math.abs(CDB().endsAt - W.time - paused) < 100 && CDB().pausedLeft == null)

// ----- zero -----
c0 = W.cmds.length
W.time = CDB().endsAt + 1000; advance(40); advance(20 * 12)
ok('zero: the Last Broadcast (all records destroyed, no evidence of anything)', said(c0).some(c => /All records have been destroyed/.test(c)) && said(c0).some(c => /There is no evidence of anything/.test(c)) && said(c0).some(c => /This broadcast will now end/.test(c)), said(c0).join(' | '))
ok('... Bo (still here, survival) falls: spectator and the title', bo.spectator && CDB().fallen['bo-1111'] && cmdsSince(c0).some(c => /title Bo title .*CLEAN SLATE/.test(c)))
ok('... the creative op is left alone', !admin.spectator)
ok('... ended: bossbar gone, weather clear, doFireTick back', CDB().state == 'ended' && W.fireTick == 1 && cmdsSince(c0).some(c => c == 'bossbar remove trollcraft:clean_slate') && cmdsSince(c0).some(c => c == 'weather clear'))
const cy = mk('Cy', 'unregistered', OW, 10, 10); players.push(cy)
fire('loggedIn', { player: cy, server }); advance(60)
ok('someone logging in afterwards falls too', cy.spectator)
cmd('cleanslate start', admin); ok('it can\'t simply start again once over', /already happened/.test(flat(lastReply())))

// ----- archive give -----
const goruk = mk('Goruk', 'ministry', OW, 0, 0); players.push(goruk)
cmd('bloodportal archive give Goruk all', admin)
const books = realSlots(goruk).filter(bookIn)
ok('/bloodportal archive give <player> all: all 11 books, the bill included, every title within 32 characters', books.length == 11 && books.every(b => b.parsed.title.length <= 32) && books.some(b => b.parsed.title == 'Draft Bill 9-D'))
cmd('bloodportal archive give Goruk 12', admin); ok('an archive number out of range: refused', /1 to 11/.test(flat(lastReply())))

// ----- /cleanslate rearm and the backup detector (/kill fires no death event) -----
replies.length = 0
cmd('cleanslate rearm', admin)
ok('/cleanslate rearm: idle again, the dragon kill and the bill forgotten, fallen players mentioned', CDB().state == 'idle' && !CDB().dragonKilled && CDB().fightBaseline == null &&
  !BDB().billDropped && /Re-armed/.test(flat(lastReply())) && /fallen player/.test(flat(lastReply())), flat(lastReply()))
goruk.dim = EN; goruk.x = 2.5; goruk.y = 64; goruk.z = 2.5
W.fightKilled = true
advance(120)
ok('the first reading is only the baseline: a fight already marked "killed" starts nothing', CDB().state == 'idle' && CDB().fightBaseline === true)
W.fightKilled = false; advance(120)
ok('the fight reset (YUNG\'s /end_island reset): baseline back to "never killed"', CDB().fightBaseline === false && CDB().state == 'idle')
const startedLogs = () => W.logs.filter(l => /\[CleanSlate\] Started by/.test(l)).length
let st0 = startedLogs()
W.fightKilled = true; advance(120)
ok('the fight ends with no death event (/kill): treated as the kill, Clean Slate pending', CDB().state == 'pending' && CDB().dragonKilled && CDB().dragonKilled.by == '')
ok('... and the nearest player in the End (Goruk) gets the bill', realSlots(goruk).some(st => st.count > 0 && st.parsed && st.parsed.title == 'Draft Bill 9-D') && BDB().billDropped.to == 'Goruk')
advance(20 * 13)
ok('... then it starts', CDB().state == 'running' && startedLogs() == st0 + 1)
cmd('cleanslate rearm', admin)
ok('/cleanslate rearm while running: stopped quietly (bossbar gone, doFireTick back)', CDB().state == 'idle' && W.fireTick == 1)
realSlots(goruk).forEach(st => { if (st.parsed && st.parsed.title == 'Draft Bill 9-D') st.count = 0 })
advance(120)
st0 = startedLogs()
killDragon(goruk); advance(120); advance(20 * 13)
ok('a real kill after rearm: starts once (the backup doesn\'t fire too), and the killer gets the bill again', CDB().state == 'running' && startedLogs() == st0 + 1 &&
  CDB().dragonKilled.by == 'Goruk' && BDB().billDropped.to == 'Goruk' && realSlots(goruk).some(st => st.count > 0 && st.parsed && st.parsed.title == 'Draft Bill 9-D'))
cmd('cleanslate status', admin)
ok('/cleanslate status explains the dragon and the End\'s fight', /only the first kill counts/.test(replies.slice(-4).map(flat).join(' ')) && /fight says: dragon previously killed/.test(replies.slice(-4).map(flat).join(' ')), replies.slice(-4).map(flat).join(' | '))

// ----- /bloodportal reset and reset all -----
cmd('bloodportal reset', admin)
ok('/bloodportal reset keeps the unlock, Relic counts and escapes', BDB().state == 'idle' && BDB().unlocked && Object.keys(BDB().found).length == 10 && BDB().escaped['ana-1111'])
cmd('bloodportal reset all', admin)
ok('/bloodportal reset all also clears the unlock, counts and escapes (arena and portal kept)', !BDB().unlocked && Object.keys(BDB().found).length == 0 && !BDB().escaped['ana-1111'] && BDB().chestsRolled == 0 && BDB().arena && BDB().portal)

// A portal saved before the size was kept (4x4) stays 4x4.
const oldP = BDB(); delete oldP.portal.size; W.persistent.blood_portal = JSON.stringify(oldP)
loadAll(); fire('loaded', { server }); advance(2)
c0 = W.cmds.length
cmd('bloodportal reset', admin)
ok('an old saved portal without a size is still 4x4 (drained 4x4, status says 4x4)', cmdsSince(c0).some(c => /fill 518 65 518 521 65 521 minecraft:air/.test(c)), cmdsSince(c0).join(' | '))
cmd('bloodportal status', admin)
ok('... /bloodportal status', replies.slice(-6).map(flat).some(r => /\(4x4\)/.test(r)))

console.log(W.logs.filter(l => /^E /.test(l)).join('\n') || '(no errors logged)')
console.log(fails ? fails + ' FAILED' : 'ALL PASSED')
