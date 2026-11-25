// Run with: node tools/tests/run_all.js story   (or node tools/tests/suites/story.test.js)
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
  loadOne(fs.readFileSync(REPO_ROOT + '/tools/kubejs/server_scripts/economy/trolls.js', 'utf8'))
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
// story.js and economy/trolls.js
const TDB = () => JSON.parse(W.persistent.trolls || '{}')
const SDB = () => JSON.parse(W.persistent.story || '{}')
const cmdsSince = n => W.cmds.slice(n).map(x => x.c)
loadAll()
Utils.server = server
fire('loaded', { server })
const mk = (n, f, x) => { const p = player(n, f, OW, x, 65, 1000.5, n == 'Admin'); p.ip = '10.0.0.' + x; p.getIpAddress = () => p.ip; return p }
const admin = mk('Admin', 'ministry', 1000.5), ana = mk('Ana', 'syndicate', 1001.5), bo = mk('Bo', 'ministry', 1002.5), cy = mk('Cy', 'unregistered', 1003.5)
players.push(admin, ana, bo, cy)
players.forEach(p => fire('loggedIn', { player: p }))
advance(60)

// ----- acts -----
let c0 = W.cmds.length
cmd('story act set prologue', admin)
ok('/story act set prologue: saved, with a full-screen title and a horn', SDB().act == 'prologue' && cmdsSince(c0).some(c => /^title @a title .*TROLLCRAFT III/.test(c)) && cmdsSince(c0).some(c => /event.raid.horn/.test(c)), cmdsSince(c0).join(' | '))
advance(20 * 10)
ok('... then the Ministry\'s opening lines, a few seconds apart, with tellraw @a (public, so Discord sees them)', cmdsSince(c0).filter(c => /^tellraw @a .*\[MINISTRY\]/.test(c)).length == 2 && cmdsSince(c0).some(c => /Freedom is mandatory/.test(c)))
c0 = W.cmds.length
cmd('story act next', admin); advance(20 * 15)
ok('/story act next: Act II, with the [SIGNAL HIJACKED] reply after the Ministry', SDB().act == 'act2' && cmdsSince(c0).some(c => /title @a subtitle .*Inspections/.test(c)) && cmdsSince(c0).some(c => /SIGNAL HIJACKED.*counting your trolls/.test(c)))
ok('global.Story knows the act', glob.Story.act() == 'act2' && glob.Story.isAtLeast('prologue') && glob.Story.isAtLeast('act2') && !glob.Story.isAtLeast('act3'))
cmd('story act set nonsense', admin); ok('an unknown act is refused with the list', /Acts: prologue, act2/.test(flat(lastReply())))
cmd('story status', admin); ok('/story status', replies.slice(-3).map(flat).join(' ').match(/Now in Act II: Inspections/) && /Next: Act III/.test(replies.slice(-3).map(flat).join(' ')), replies.slice(-3).map(flat).join(' | '))
ok('/story is op-only', cmd('story status', ana) == 0 && lastReply() == 'DENIED')

// ----- decrees -----
c0 = W.cmds.length
cmd('story decree preset licence_act', admin)
ok('a preset decree: #41, announced publicly with a bell', SDB().decrees['41'] && /Trolling Licence Act/.test(SDB().decrees['41'].text) && cmdsSince(c0).some(c => /DECREE #41: .*Trolling Licence Act/.test(c)) && cmdsSince(c0).some(c => /block.bell.use/.test(c)))
cmd('story decree issue All chests must face north.', admin)
ok('/story decree issue <text>: #42', SDB().decrees['42'] && SDB().decrees['42'].text == 'All chests must face north.')
ana.inbox = []; cmd('decrees', ana)
ok('/decrees (anyone): the decrees in force', replies.slice(-3).map(flat).some(r => /#41: The Trolling Licence Act/.test(r)) && replies.slice(-3).map(flat).some(r => /#42: All chests must face north/.test(r)))
c0 = W.cmds.length
cmd('story decree revoke 42', admin)
ok('/story decree revoke 42: overturned, "It was never issued."', SDB().decrees['42'].revoked && cmdsSince(c0).some(c => /Decree #42 has been overturned. It was never issued/.test(c)))
cmd('decrees', ana); ok('... and gone from /decrees', !replies.slice(-2).map(flat).some(r => /#42/.test(r)))
cmd('story decree preset nope', admin); ok('an unknown preset lists the presets', /licence_act, chests_north/.test(flat(lastReply())))

// ----- the Troll Log through the black market -----
cmd('blackmarket vendor addspot crossroads', admin); cmd('blackmarket vendor spawn crossroads', admin); advance(45)
cmd('coins give Ana 200', admin); cmd('coins give Bo 200', admin); cmd('coins give Cy 200', admin)
let coinsAna = coinsOf(ana)
ana.inbox = []
cmd('bm buy summons Bo', ana)
ok('an Anonymous Summons is logged: Ana → Bo, 50 points, 1 coin back', TDB().log.length == 1 && TDB().log[0].byName == 'Ana' && TDB().log[0].onName == 'Bo' && TDB().log[0].pts == 50 && coinsOf(ana) == coinsAna - 5 + 1 && /Troll logged: Anonymous Summons on Bo. \+50 points, \+1 Hush Coin/.test(text(ana)), JSON.stringify(TDB().log) + ' ' + text(ana))
ok('... and Bo isn\'t told who', !/Ana/.test(text(bo)))
ok('... cross-faction (Syndicate → Crownsworn): marked (hidden) for Part II; Ana sees 50, and there is no pool', TDB().log[0].cross === true && TDB().players['ana-1111'].points == 50 && !TDB().pool)
cmd('bm buy summons Bo', ana)
ok('the same victim again within 24 h: half (25 points, no coin)', TDB().log[1].pts == 25 && /same victim again: less/.test(text(ana)))
cmd('bm buy summons Bo', ana)
ok('... a third time: a quarter (13)', TDB().log[2].pts == 13)
bo.inbox = []
cmd('bm buy summons Ana', bo)
ok('revenge: Bo trolls Ana back within 24 h: ×2 (100)', TDB().log[3].pts == 100 && /revenge/.test(text(bo)), text(bo))
// cursed food: buyer → eater
cmd('bm buy food steak', ana)
const steak = realSlots(ana).find(s => s.count > 0 && s.id == 'minecraft:cooked_beef')
ok('Cursed Food now carries its buyer', steak && steak.parsed.trollcraft.by == 'ana-1111')
fire('foodEaten', { entity: cy, item: steak })
const fe = TDB().log[TDB().log.length - 1]
ok('Cy eats Ana\'s cursed steak: logged Ana → Cy, 100 + 25 per curse', fe.type == 'food' && fe.byName == 'Ana' && fe.onName == 'Cy' && (fe.pts - 100) % 25 == 0 && fe.pts >= 125, JSON.stringify(fe))
const oldFood = stack('minecraft:bread', 1, '{trollcraft:{prank:"food",food:"bread"}}')
let n0 = TDB().log.length
fire('foodEaten', { entity: cy, item: oldFood })
ok('cursed food from before (no buyer) isn\'t logged', TDB().log.length == n0)
// mimic chest via the trap events
cmd('bm buy mimic', bo)
const mimic = realSlots(bo).find(s => s.count > 0 && s.id == 'minecraft:chest' && s.parsed && s.parsed.trollcraft)
setReal(bo, bo.selected, mimic)
const block = { id: 'minecraft:chest', x: 1010, y: 65, z: 1010, getDimension: () => OW }
fire('blockPlaced', { entity: bo, block, cancel() { throw new Exit() } })
n0 = TDB().log.length
fire('chestOpened', { player: cy, block })
ok('a Mimic Chest bites Cy: logged Bo → Cy, 150, 3 coins', TDB().log.length == n0 + 1 && TDB().log[n0].type == 'mimic' && TDB().log[n0].byName == 'Bo' && TDB().log[n0].pts == 150)
// self, AFK, same IP
n0 = TDB().log.length
ok('trolling yourself: nothing', glob.Trolls.record(ana, ana, 'tnt') == null && TDB().log.length == n0)
cy.ip = ana.ip
ana.inbox = []
ok('a victim on the same IP (an alt): nothing', glob.Trolls.record(ana, cy, 'tnt') == null && TDB().log.length == n0)
ok('... and the troller is told why', /Disguised TNT on Cy not counted: you and Cy are on the same internet connection/.test(text(ana)), text(ana))
replies.length = 0
cmd('trolls check', admin)
const chk = replies.map(flat).join(' | ')
ok('/trolls check (op): black market connected, who shares a connection, and the refused troll', /Black market: connected/.test(chk) && /Sharing a connection: Ana \+ Cy/.test(chk) && /Disguised TNT, Ana -> Cy: same connection/.test(chk), chk)
ok('/trolls check is op-only', cmd('trolls check', ana) == 0 && lastReply() == 'DENIED')
cy.ip = '10.0.0.99'
const realAfk = glob.Economy.isAfk
glob.Economy.isAfk = p => p === cy
ana.inbox = []
ok('an AFK victim: nothing, and the troller is told', glob.Trolls.record(ana, cy, 'tnt') == null && /not counted: Cy has been AFK/.test(text(ana)), text(ana))
glob.Economy.isAfk = realAfk
const oldIsAfk = glob.Economy.isAfk
delete glob.Economy.isAfk
replies.length = 0
cmd('trolls check', admin)
ok('/trolls check spots an old black_market.js (no isAfk)', /an OLD version/.test(replies.map(flat).join(' ')))
glob.Economy.isAfk = oldIsAfk
// offline troller paid at login
cy.online = false
let cyc = coinsOf(cy)
glob.Trolls.record({ uuid: 'cy-1111', name: 'Cy' }, bo, 'tnt')
ok('a trap sprung while its owner is offline: points now, coins owed', TDB().players['cy-1111'].points >= 250 && TDB().pendingCoins['cy-1111'] == 6 && coinsOf(cy) == cyc)
cy.online = true; cy.inbox = []
fire('loggedIn', { player: cy })
ok('... paid at the next login', coinsOf(cy) == cyc + 6 && !TDB().pendingCoins['cy-1111'] && /paid 6 Hush Coins while you were away/.test(text(cy)), text(cy))

// ----- manual reports -----
cmd('troll report Bo stole his boots with Butterfingers', ana)
ok('/troll report: report #1, ops told', TDB().reports['1'] && TDB().reports['1'].status == 'open' && /Troll report #1: Ana → Bo/.test(text(admin)))
cmd('troll witness 1', bo); ok('the victim can\'t witness', /can't witness their own troll/.test(flat(lastReply())))
cmd('troll witness 1', cy); ok('a bystander can', TDB().reports['1'].witnesses['cy-1111'] == 'Cy')
cmd('troll pending', admin); ok('/troll pending shows it with its witness', replies.map(flat).some(r => /#1 Ana → Bo: stole his boots with Butterfingers .*witnesses: Cy/.test(r)))
coinsAna = coinsOf(ana); n0 = TDB().log.length
cmd('troll approve 1 300', admin)
ok('/troll approve 1 300: 300 points as a reported troll, 3 coins, full value (no diminishing)', TDB().log[n0].type == 'manual' && TDB().log[n0].pts == 300 && coinsOf(ana) == coinsAna + 3 && TDB().reports['1'].status == 'approved', JSON.stringify(TDB().log[n0]))
cmd('troll report Cy splashed him', bo); cmd('troll deny 2', admin)
ok('/troll deny', TDB().reports['2'].status == 'denied')
ok('approving is op-only', cmd('troll approve 2 50', ana) == 0 && lastReply() == 'DENIED')
cmd('troll report Ana myself', ana); ok('you can\'t report trolling yourself', /doesn't count/.test(flat(lastReply())))

// ----- public views -----
const chat = p => p.inbox.map(flat).join('\n')
cy.inbox = []; cmd('trolls log', cy)
ok('/trolls log for players: trollers stay anonymous ("someone")', /someone → /.test(chat(cy)) && !/(Ana|Bo) → /.test(chat(cy)), chat(cy))
admin.inbox = []; cmd('trolls log', admin)
ok('... ops see the names', /(Ana|Bo|Cy) → /.test(chat(admin)), chat(admin))
cy.inbox = []; cmd('trolls top', cy); ok('/trolls top: the leaderboard', /The greatest trolls/.test(replies.map(flat).slice(-2).join(' ')) && /1\. .*points/.test(chat(cy)), chat(cy))
cmd('trolls me', ana); ok('/trolls me', /You: .* points, .* trolls?/.test(flat(replies[replies.length - 1 - Math.min(5, TDB().log.filter(e => e.by == 'ana-1111').length)])))

// ----- the Blood Pool is saved for Part II -----
let threw = false
try { cmd('bloodpool', cy) } catch (e) { threw = /no command bloodpool/.test(String(e)) }
ok('/bloodpool is gone (saved for Part II), and so is the pool API', threw && glob.Trolls.poolFull === undefined && glob.Trolls.addDrops === undefined)

// ----- weekly recap -----
players.forEach(p => { p.inbox = [] })
W.time += 8 * 86400000
advance(6100)
ok('after 7 days: the Ministry\'s weekly recap', /incidents of Unlicensed Humour were recorded .*The Ministry is never amused/.test(text(cy)), text(cy))

// ----- /reload keeps everything -----
const before = TDB().log.length
loadAll(); fire('loaded', { server }); advance(10)
cmd('trolls me', ana)
ok('/reload: the log, players and story are kept', TDB().log.length == before && glob.Story.act() == 'act2' && TDB().players['ana-1111'].points > 0)

console.log(W.logs.filter(l => /^E /.test(l)).join('\n') || '(no errors logged)')
console.log(fails ? fails + ' FAILED' : 'ALL PASSED')
