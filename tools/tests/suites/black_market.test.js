// Run with: node tools/tests/run_all.js black_market   (or node tools/tests/suites/black_market.test.js)
const REPO_ROOT = require('path').resolve(__dirname, '..', '..', '..')
// Mock KubeJS 6 server running economy/black_market.js together with factions/portal_ambush.js.
const fs = require('fs')
const snbt = require('../lib/snbt.js')
const BM_FILE = process.env.BM_FILE || REPO_ROOT + '/tools/kubejs/server_scripts/economy/black_market.js'
const BOUNTY_FILE = process.env.BOUNTY_FILE || REPO_ROOT + '/tools/kubejs/server_scripts/economy/bounties.js'
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
loadAll()
Utils.server = server
fire('loaded', { server })
const admin = player('Admin', 'ministry', OW, 1000.5, 65, 1000.5, true)
const alice = player('Alice', 'syndicate', OW, 1001.5, 65, 1000.5)
const bob = player('Bob', 'ministry', OW, 2000.5, 65, 2000.5)
players.push(admin, alice, bob)
advance(40)

// ----- recipes -----
ok('coin crafting block off by default: no recipe is rewritten (it broke Ender IO capacitors)', W.recipes.length == 0)

// ----- coins -----
cmd('coins give Alice 70', admin)
ok('/coins give: 70 coins as identical stacks (64 + 6), NBT tagged, named', coinsOf(alice) == 70 && realSlots(alice).filter(s => s.count > 0).length == 2 &&
  /Hush Coin/.test(realSlots(alice)[0].parsed.display.Name), JSON.stringify(realSlots(alice).slice(0, 2).map(s => s.count)))
ok('... with the enchantment glint, its tooltip line hidden', realSlots(alice)[0].parsed.Enchantments && realSlots(alice)[0].parsed.Enchantments[0].id == 'minecraft:unbreaking' && realSlots(alice)[0].parsed.HideFlags == '1', JSON.stringify(realSlots(alice)[0].parsed))

cmd('coins check Alice', admin)
ok('/coins check', /Alice carries 70 Hush Coins/.test(flat(lastReply())), lastReply())
cmd('coins take Alice 5', admin)
ok('/coins take', coinsOf(alice) == 65)
ok('/coins is op only', cmd('coins check Alice', alice) == 0 && lastReply() == 'DENIED')
glob.Economy.giveCoins(alice, 5, 'test')
ok('global.Economy.giveCoins', coinsOf(alice) == 70 && glob.Economy.countCoins(alice) == 70)

// ----- vendor -----
advance(20 * 35)
ok('no spots: the vendor never appears', !vendor() && !DB().vendor.present)
admin.x = 1003.5; admin.z = 1000.5
cmd('blackmarket vendor addspot old_crossroads', admin)
ok('/bm vendor addspot saves the op\'s position', DB().vendorSpots.length == 1 && DB().vendorSpots[0].name == 'old crossroads' && DB().vendorSpots[0].x == 1003)
cmd('bm vendor spots', admin)
ok('/bm alias works: spots listed', /old crossroads: minecraft:overworld 1003 65 1000 \(saved\)/.test(flat(lastReply())), lastReply())
advance(20 * 35)
ok('the vendor appears at the saved spot (forceloaded first, summoned after)', !!vendor() && W.cmds.some(x => /forceload add 1003 1000/.test(x.c)) && DB().vendor.present, W.cmds.slice(-5).map(x => x.c).join(' | '))
const v1 = vendor()
ok('vendor NBT: NoAI, invulnerable, silent, persistent, no despawn, no trades, named, tagged', v1 && /NoAI:1b/.test(v1.nbt) && /Invulnerable:1b/.test(v1.nbt) && /Silent:1b/.test(v1.nbt) && /PersistenceRequired:1b/.test(v1.nbt) &&
  /DespawnDelay:0/.test(v1.nbt) && /Offers:\{Recipes:\[\]\}/.test(v1.nbt) && /Hooded Merchant/.test(v1.nbt) && v1.type == 'minecraft:wandering_trader' && v1._tags.indexOf('bm_vendor_' + DB().vendor.id) >= 0)
ok('rumor to every player, named place, no coordinates, not tellraw @a', [admin, alice, bob].every(p => /A hooded merchant has been seen near old crossroads\./.test(text(p)) && !/1003/.test(text(p))) &&
  !W.cmds.some(x => /^tellraw @a/.test(x.c)))
// pushed: snaps back
v1.x += 3
advance(25)
ok('pushed vendor is put back within a second', Math.abs(v1.x - 1003.5) < 0.01, v1.x)
// can't be hurt
let hev = { entity: v1, source: {}, cancelled: false, cancel() { throw new Exit() } }
fire('hurt', hev)
ok('vendor damage is cancelled', hev.cancelled)
// stale vendor
const stale = entity('minecraft:wandering_trader', OW, 5, 65, 5, ['black_market_vendor', 'bm_vendor_old'])
ok('a stale vendor (old id) is removed as it loads', !fireSpawn(stale))
// right-click: shop
let iev = { player: alice, target: v1, hand: 'MAIN_HAND', item: EMPTY(), cancelled: false, cancel() { throw new Exit() } }
alice.inbox = []
fire('entityInteracted', iev)
ok('right-clicking the vendor opens the shop WINDOW (6 rows, "Hooded Merchant") and cancels the trade screen', iev.cancelled && alice.gui && alice.gui.rows == 6 && /Hooded Merchant/.test(alice.gui.title) && Object.keys(alice.gui.slots).length == 54)
alice.closeMenu(); advance(1)   // the player closes the window: KubeJS hands the inventory back
cmd('blackmarket chatshop', alice)
ok('/bm chatshop: the chat menu (the fallback)', /You carry 70 Hush Coins/.test(text(alice).replace(/\\"/g, '"')) && /\/blackmarket buy contract squad/.test(text(alice)) && /\/blackmarket buy writ/.test(text(alice)))
ok('... with no "He buys" section: the merchant buys nothing by default', !/He buys/.test(text(alice)) && !/\/blackmarket sell/.test(text(alice)))

// ----- buying: range -----
alice.x = 1100.5
cmd('blackmarket buy writ', alice)
ok('buying away from the vendor is refused', /The merchant is not here\./.test(flat(lastReply())) && coinsOf(alice) == 70)
alice.x = 1001.5
cmd('blackmarket buy writ', alice)
ok('buying a writ at the vendor', /Writ of Protection bought/.test(flat(lastReply())) && coinsOf(alice) == 55 && !!findItem(alice, s => s.parsed && s.parsed.trollcraft && s.parsed.trollcraft.writ))
// renamed nugget isn't money
const fake = stack('minecraft:gold_nugget', 64, '{display:{Name:\'{"text":"Hush Coin","color":"dark_red"}\'}}')
const carl = player('Carl', 'syndicate', OW, 1002.5, 65, 1000.5); players.push(carl)
setReal(carl, 0, fake)
cmd('blackmarket buy writ', carl)
ok('coins renamed on an anvil don\'t count as payment', /costs 15 Hush Coins\. You have 0/.test(flat(lastReply())) && realSlots(carl)[0].count == 64)
// contract target menu
alice.inbox = []
cmd('blackmarket buy contract squad', alice)
ok('contract [BUY] opens the target menu: everyone else, with the price', /buy contract squad Bob/.test(text(alice)) && /- 20 coins/.test(text(alice)) && !/buy contract squad Alice/.test(text(alice)))
cmd('blackmarket buy contract squad Alice', alice)
ok('no contract on yourself', /yourself/.test(flat(lastReply())))
cmd('blackmarket buy contract squad Bob', alice)
let ct = contractsOf(alice)[0]
ok('buying a contract on Bob: 20 coins, a contract item for Bob', coinsOf(alice) == 35 && ct && ct.id == 'minecraft:skull_banner_pattern' && /Bob/.test(ct.parsed.trollcraft.contract.targetName) &&
  /Ambush Contract \(Squad\)/.test(ct.parsed.display.Name), coinsOf(alice))
ok('... the buyer is not on the item (tooltip or NBT)', !/alice/i.test(ct.snbtStr), ct.snbtStr)
ok('... the server record has the buyer and status issued', DB().contracts[cId(ct)].buyerName == 'Alice' && DB().contracts[cId(ct)].status == 'issued')

// ----- using a contract: refusals (not used up) -----
const useHeld = (p, s, onBlock) => { advance(5); putInHand(p, s); p.inbox = []; return click(p, onBlock) }
const ctStack = ct
bob.online = false
let r = useHeld(alice, ctStack)
ok('target offline: refused, not used up', r.item && /The target is not around/.test(text(alice)) && ctStack.count == 1 && DB().contracts[cId(ctStack)].status == 'issued', text(alice))
bob.online = true
// AFK: Bob doesn't move for 6 minutes (Alice and the vendor keep the loops going)
advance(20 * 60 * 6)
r = useHeld(alice, ctStack)
ok('target AFK: refused, not used up', /isn't moving/.test(text(alice)) && ctStack.count == 1, text(alice))
bob.x += 1; advance(20 * 31)
// safe zone: near world spawn
bob.x = 10.5; bob.z = 10.5
r = useHeld(alice, ctStack)
ok('target in a safe zone: refused (without saying where)', /somewhere the hired hands won't go/.test(text(alice)) && !/10/.test(text(alice)) && ctStack.count == 1, text(alice))
// pig escort participant
bob.x = 2000.5; bob.z = 2000.5
glob.pigEscortState = { phase: 'running', run: { site: { x: 5000, y: 65, z: 5000 } } }
bob._tags.push('pig_escort_participant')
r = useHeld(alice, ctStack)
ok('target in a Pig Escort: refused', /somewhere the hired hands won't go/.test(text(alice)) && ctStack.count == 1, text(alice) + ' / ' + JSON.stringify(r) + ' ' + W.logs.slice(-3).join(';'))
bob._tags.pop(); glob.pigEscortState = null
// spawn fails: Bob logs off during the 3 s warning
r = useHeld(alice, ctStack, true)
ok('one click that fires both the block and item events is handled once, both cancelled', r.block && r.item && bob.inbox.filter(l => /Someone has paid for your death/.test(l)).length == 1 && !/already being called in/.test(text(alice)), text(alice))
ok('... the target is warned (dark gray tag, red text), with a sound', /"text":"\[CONTRACT\]","color":"dark_gray"/.test(lastLine(bob)) && /Someone has paid for your death\.","color":"red"/.test(lastLine(bob)) && W.cmds.some(x => /playsound minecraft:entity.wither.ambient/.test(x.c)))
ok('... the contract is "calling" meanwhile', DB().contracts[cId(ctStack)].status == 'calling')
r = useHeld(alice, ctStack)
ok('... clicking again while calling does nothing', /already being called in/.test(text(alice)))
bob.online = false
advance(65)
ok('spawn fails (target gone): not used up, "could not be carried out"', /could not be carried out/.test(text(alice)) && ctStack.count == 1 && DB().contracts[cId(ctStack)].status == 'issued' && !mobs().length, text(alice))
bob.online = true
advance(20 * 31)

// ----- the call -----
const dupe = stack(ctStack.id, 1, ctStack.snbtStr)   // a creative copy
let fulfilledCalls = []
glob.Economy.onContractFulfilled((b, t, id) => fulfilledCalls.push([b, t, id]))
glob.Economy.onContractFulfilled(() => { throw new Error('bad listener') })
r = useHeld(alice, ctStack)
ok('valid contract: the target is warned', /Someone has paid for your death/.test(text(bob)) && !/paid for your death/.test(text(alice)) && !/paid for your death/.test(text(admin)))
advance(65)
const cm = mobs()
ok('3 s later: 4 Hired Blades 8-10 blocks around Bob, tagged contract_ambush, black chestplate, light/moderate stats', cm.length == 4 && cm.every(m => /vindicator|pillager/.test(m.type) && m._tags.indexOf('contract_ambush') >= 0 &&
  /Hired Blade/.test(m.nbt) && new RegExp('color:' + 0x1D1D21 + '\\b').test(m.nbt)) && cm.every(m => { const d = Math.hypot(m.x - bob.x, m.z - bob.z); return d >= 7.2 && d <= 10.8 }), cm.map(m => m.type + '@' + Math.hypot(m.x - bob.x, m.z - bob.z).toFixed(1)).join(','))
ok('... the contract item is used up, the caller told, status active', ctStack.count == 0 && /Your contract has been called in/.test(text(alice)) && DB().contracts[cId(ctStack)].status == 'active')
ok('... heat 1 and a contract cooldown on Bob', (DB().heat[bob.uuid] || []).length == 1 && DB().cooldowns[bob.uuid] > W.time)
ok('... nobody else is told anything', !/CONTRACT/.test(text(admin)) && !/CONTRACT/.test(text(carl)))
// dupe of a used contract
r = useHeld(alice, dupe)
ok('a duped copy of a called contract is void and deleted', /This contract is void/.test(text(alice)) && dupe.count == 0)
const forged = stack('minecraft:skull_banner_pattern', 1, '{trollcraft:{contract:{id:"cmadeup",tier:"squad",target:"bob-1111",targetName:"Bob",issued:1L}}}')
r = useHeld(alice, forged)
ok('a forged contract (unknown id) is void', /This contract is void/.test(text(alice)) && forged.count == 0)
// fulfilled: Bob killed by a contract mob
alice.online = false
fire('death', { entity: bob, source: { actual: cm[0] }, server })
ok('target killed by a contract mob: fulfilled, listeners called (a failing one is logged)', DB().contracts[cId(ctStack)].status == 'fulfilled' && fulfilledCalls.length == 1 &&
  fulfilledCalls[0][0] == 'alice-1111' && fulfilledCalls[0][1] == 'bob-1111' && W.logs.some(l => /listener failed/.test(l)))
ok('... the offline buyer gets "Contract fulfilled." on login', !/Contract fulfilled/.test(text(alice)) && (alice.online = true, fire('loggedIn', { player: alice }), /Contract fulfilled\./.test(text(alice))))
cmd('ambush clear', admin)
ok('a fulfilled contract stays fulfilled when the group ends', DB().contracts[cId(ctStack)].status == 'fulfilled')

// ----- heat raises prices -----
alice.inbox = []
cmd('blackmarket buy contract squad', alice)
ok('heat raises the price: 20 x 1.5 = 30 for Bob', /buy contract squad Bob/.test(text(alice)) && /- 30 coins \(heat 1\)/.test(text(alice)), text(alice))
cmd('blackmarket heat Bob', admin)
ok('/blackmarket heat shows heat and cooldown', /Bob: heat 1/.test(flat(lastReply())))
// cooldown: a new contract on Bob is refused
let ct2 = testContract('tipoff', 'Bob')
r = useHeld(admin, ct2)
ok('target on the contract cooldown: refused, not used up', /hit recently/.test(text(admin)) && ct2.count == 1, text(admin))
cmd('blackmarket heat Bob reset', admin)
ok('heat reset', !DB().heat[bob.uuid])

// ----- inspect -----
putInHand(admin, ct2)
cmd('blackmarket inspect', admin)
ok('/blackmarket inspect shows the buyer\'s name', /bought by Admin/.test(flat(lastReply())) && /tipoff on Bob/.test(flat(lastReply())), lastReply())
alice.online = false
const aliceCopy = stack(ctStack.id, 1, ctStack.snbtStr)
putInHand(admin, aliceCopy)
cmd('blackmarket inspect', admin)
ok('... also for a contract whose buyer is offline', /bought by Alice/.test(flat(lastReply())) && /fulfilled/.test(flat(lastReply())), lastReply())
alice.online = true
ok('/blackmarket inspect is op only', cmd('blackmarket inspect', alice) == 0 && lastReply() == 'DENIED')

// ----- writ, survived, interrupted -----
const fresh = () => { const c = DB(); delete c.cooldowns[bob.uuid]; W.persistent.economy = JSON.stringify(c) }
// The script keeps its data in memory; clear Bob's cooldowns through the commands instead:
W.time += 46 * 60000
advance(20 * 31)
let ct3 = testContract('tipoff', 'Bob')
const bobWrit = stack('minecraft:paper', 1, '{trollcraft:{writ:1b}}')
setReal(bob, 5, bobWrit)
r = useHeld(admin, ct3)
ok('Writ of Protection: both the writ and the contract are used up, the caller is told', bobWrit.count == 0 && ct3.count == 0 && /refused\. The target was protected/.test(text(admin)) &&
  /Writ of Protection turned away/.test(text(bob)) && DB().contracts[cId(ct3)].status == 'refused', text(admin))
// survived: all mobs killed
let ct4 = testContract('tipoff', 'Bob')
r = useHeld(admin, ct4); advance(65)
ok('tip-off: 2 mobs', mobs().length == 2, mobs().length)
mobs().forEach(m => { m.alive = false; fire('death', { entity: m, source: { actual: bob }, server }) })
advance(25)
ok('all contract mobs killed: "The target survived."', DB().contracts[cId(ct4)].status == 'survived' && /The target survived\./.test(text(admin)), DB().contracts[cId(ct4)].status)
ok('... Hired Blades drop their reward (iron nuggets), not Ministry emeralds', W.drops.some(d => d.item == 'minecraft:iron_nugget') && !W.drops.some(d => d.item == 'minecraft:emerald'), JSON.stringify(W.drops))
// interrupted by /reload (the vendor is put back out first: the time jumps outlasted his stay)
W.time += 46 * 60000; advance(20 * 31)
cmd('blackmarket vendor spawn old_crossroads', admin); advance(45)
ok('/bm vendor spawn <location> puts him out at once', !!vendor() && /appears near old crossroads/.test(flat(lastReply())), lastReply())
let ct5 = testContract('warparty', 'Bob')
r = useHeld(admin, ct5); advance(65)
ok('war party: 6-8 vindicators/pillagers with lethal stats, no evokers', mobs().length >= 6 && mobs().length <= 8 && mobs().every(m => /vindicator|pillager/.test(m.type)) &&
  W.cmds.some(x => /effect give \S+ minecraft:strength infinite 0 true/.test(x.c)), mobs().map(m => m.type).join(','))
admin.inbox = []
loadAll(); advance(5)
ok('/reload during a contract: the caller is told it was interrupted', DB().contracts[cId(ct5)].status == 'interrupted' && /The contract was interrupted\./.test(text(admin)), DB().contracts[cId(ct5)].status + ' ' + text(admin))
ok('... the vendor is back after the reload (same spot, new id), old one removed', !!vendor() || (advance(45), !!vendor()))

// ----- expired -----
let ct6 = testContract('tipoff', 'Bob')
W.time += 8 * 86400000
r = useHeld(admin, ct6)
ok('an expired contract turns into a Void Contract', ct6.count == 0 && !!findItem(admin, s => s.parsed && /Void Contract/.test(s.parsed.display && s.parsed.display.Name)) && /expired/.test(text(admin)))

// ----- /bm hand -----
const special = stack('minecraft:stick', 1, '{display:{Name:\'{"text":"Wand of Smiting"}\',Lore:[\'{"text":"Right-click to smite"}\']},RunCommand:"smite @p"}')
putInHand(admin, special)
cmd('bm hand add 10', admin)
const entry = Object.keys(DB().shop.custom)[0]
ok('/bm hand add 10: stored with the full NBT', entry && DB().shop.custom[entry].snbt == special.snbtStr && DB().shop.custom[entry].price == 10 && /Wand of Smiting/.test(flat(lastReply())), lastReply())
putInHand(admin, EMPTY())
cmd('bm hand add 10', admin)
ok('empty hand refused', /Hold the item/.test(flat(lastReply())))
;[stack('minecraft:gold_nugget', 1, '{trollcraft:{coin:1b}}'), stack('minecraft:paper', 1, '{trollcraft:{writ:1b}}'), stack('minecraft:skull_banner_pattern', 1, '{trollcraft:{contract:{id:"x"}}}')].forEach(s => {
  putInHand(admin, s); cmd('bm hand add 10', admin)
  ok('refused: ' + s.id, /can't be sold this way/.test(flat(lastReply())), lastReply())
})
putInHand(alice, special)
ok('a non-op can\'t use /bm hand', cmd('bm hand add 10', alice) == 0 && lastReply() == 'DENIED')
putInHand(admin, stack('minecraft:shulker_box', 1, '{BlockEntityTag:{Items:[]}}'))
cmd('bm hand add 50 1', admin)
ok('a shulker box is allowed with a warning; stock 1', /contents are sold with it/.test(flat(lastReply())) && /1 in stock/.test(flat(lastReply())))
const boxId = Object.keys(DB().shop.custom).find(k => DB().shop.custom[k].item == 'minecraft:shulker_box')
alice.inbox = []
cmd('blackmarket chatshop', alice)
ok('custom stock shows in the shop with the real item tooltip (show_item + NBT)', /"action":"show_item","contents":\{"id":"minecraft:stick","count":1,"tag":/.test(text(alice)) && /RunCommand/.test(text(alice)))
alice.x = 1100.5
cmd('blackmarket buy custom ' + entry, alice)
ok('buying custom stock away from the vendor is refused', /The merchant is not here/.test(flat(lastReply())))
alice.x = 1001.5
cmd('coins give Alice 100', admin)
const before = coinsOf(alice)
alice.selected = 8; putInHand(alice, EMPTY())
cmd('blackmarket buy custom ' + entry, alice)
const got = findItem(alice, s => s.id == 'minecraft:stick')
ok('buying it gives an exact copy and takes 10 coins', got && got.snbtStr == special.snbtStr && coinsOf(alice) == before - 10, lastReply())
cmd('blackmarket buy custom ' + boxId, alice)
ok('limited stock sells out and disappears', !DB().shop.custom[boxId] && /Bought/.test(flat(lastReply())))
cmd('blackmarket buy custom ' + boxId, alice)
ok('... and can\'t be bought again', /isn't for sale/.test(flat(lastReply())))
cmd('bm hand price ' + entry + ' 25', admin)
ok('/bm hand price', DB().shop.custom[entry].price == 25)
cmd('bm hand list', admin)
ok('/bm hand list with a [REMOVE] button', /\/blackmarket hand remove /.test(lastReply()))
cmd('bm hand remove ' + entry, admin)
ok('/bm hand remove', !DB().shop.custom[entry])
// persists across a reload
putInHand(admin, special); cmd('bm hand add 7', admin)
loadAll(); advance(45)   // the vendor comes back 2 s after a reload
ok('custom stock survives a reload', Object.keys(DB().shop.custom).length == 1)

// ----- selling -----
cmd('blackmarket vendor spawn old_crossroads', admin); advance(45)   // the 8-day jump outlasted his stay
setReal(alice, 20, stack('minecraft:diamond', 3))
setReal(alice, 21, stack('minecraft:rotten_flesh', 70))
setReal(alice, 22, stack('minecraft:diamond', 2, '{display:{Name:\'{"text":"Shiny"}\'}}'))
let c0 = coinsOf(alice)
cmd('blackmarket sell diamond', alice)
ok('default: selling is refused ("He isn\'t buying anything."), nothing taken or paid', /He isn't buying anything\./.test(flat(lastReply())) && coinsOf(alice) == c0 &&
  realSlots(alice)[20].count == 3, lastReply())
// The selling code still works when SELL_LIST has entries:
const withSells = fs.readFileSync(BM_FILE, 'utf8').replace('const SELL_LIST = []', "const SELL_LIST = [{ key: 'diamond', item: 'minecraft:diamond', per: 1, coins: 2 }, { key: 'rotten_flesh', item: 'minecraft:rotten_flesh', per: 32, coins: 1 }]")
if (withSells.indexOf("key: 'diamond'") < 0) throw new Error('SELL_LIST patch failed')
loadAll(withSells); advance(45)
alice.inbox = []
cmd('blackmarket chatshop', alice)
ok('with a SELL_LIST: the "He buys" section and [SELL] buttons appear', /He buys/.test(text(alice)) && /\/blackmarket sell diamond/.test(text(alice)))
cmd('blackmarket sell diamond', alice)
ok('selling plain diamonds: 3 x 2 coins; the named one is kept', coinsOf(alice) == c0 + 6 && realSlots(alice)[22].count == 2, lastReply())
cmd('blackmarket sell rotten_flesh', alice)
ok('rotten flesh: 1 coin per 32 (64 sold, 6 kept)', coinsOf(alice) == c0 + 8 && realSlots(alice)[21].count == 6, lastReply())
loadAll(); advance(45)   // back to the real script

// ----- vendor leaves and comes back -----
W.time += 91 * 60000; advance(20 * 31)
ok('after his stay the vendor vanishes in smoke and the forceload is removed', !vendor() && W.cmds.some(x => /particle minecraft:large_smoke/.test(x.c)) && W.cmds.some(x => /forceload remove 1003 1000/.test(x.c)) && !DB().vendor.present)
W.time += 31 * 60000; advance(20 * 31 + 45)
ok('... and is back after his time away', !!vendor() && DB().vendor.present)
cmd('blackmarket toggle', admin)
ok('/blackmarket toggle closes the market (vendor gone) and keeps the data', !DB().enabled && !vendor() && Object.keys(DB().contracts).length > 0)
cmd('blackmarket toggle', admin)

// ======================= The shop window, traps and pranks =======================
cmd('blackmarket vendor spawn old_crossroads', admin); advance(45)
cmd('coins give Alice 300', admin)
const openWin = p => { if (p.gui) { p.closeMenu(); advance(1) } fire('entityInteracted', { player: p, target: vendor(), hand: 'MAIN_HAND', item: EMPTY(), cancel() { throw new Exit() } }) }
function guiClick(p, x, y) {
  const sl = p.gui && p.gui.slots[x + ',' + y]
  if (!sl || !sl.leftClicked) throw new Error('no button at ' + x + ',' + y + ' in ' + (p.gui && p.gui.title))
  sl.leftClicked({})
  advance(2)
}
const slotName = (p, x, y) => { const sl = p.gui && p.gui.slots[x + ',' + y]; try { return JSON.parse(sl.item.parsed.display.Name).text } catch (e) { return sl && sl.item ? sl.item.id : '' } }
const slotLore = (p, x, y) => { const sl = p.gui.slots[x + ',' + y]; try { return sl.item.parsed.display.Lore.map(l => JSON.parse(l).text).join(' | ') } catch (e) { return '' } }
openWin(alice)
ok('window layout: contracts, writ, traps, pranks, coins, close', slotName(alice, 2, 0) == 'Ambush Contract: Tip-off' && slotName(alice, 4, 0) == 'Ambush Contract: War Party' &&
  slotName(alice, 2, 1) == 'Writ of Protection' && slotName(alice, 2, 2) == 'Disguised TNT' && slotName(alice, 3, 2) == 'Mimic Chest' &&
  slotName(alice, 2, 3) == 'Itching Powder' && slotName(alice, 3, 3) == 'Cursed Food' && slotName(alice, 4, 3) == 'Anonymous Summons' &&
  /You carry \d+ Hush Coins/.test(slotName(alice, 0, 5)) && slotName(alice, 8, 5) == 'Close' && slotName(alice, 5, 5) == ' ', [0, 1, 2, 3, 4, 5].map(y => [0, 1, 2, 3, 4, 8].map(x => slotName(alice, x, y)).join('/')).join(' || '))
ok('... prices in the tooltips', /25 Hush Coins per block/.test(slotLore(alice, 2, 2)) && /15 Hush Coins/.test(slotLore(alice, 2, 1)))
// writ from the window
let cw = coinsOf(alice)
guiClick(alice, 2, 1)
ok('clicking the writ buys it; the window reopens with the new coin count', coinsOf(alice) == cw - 15 && /Writ of Protection bought/.test(text(alice)) && alice.gui && new RegExp('You carry ' + (cw - 15) + ' ').test(slotName(alice, 0, 5)), slotName(alice, 0, 5))
// contract from the window: target page
guiClick(alice, 3, 0)
ok('clicking a contract opens the target page (player heads with prices)', /who\?/.test(alice.gui.title) && Object.values(alice.gui.slots).some(sl => sl.item && sl.item.id == 'minecraft:player_head' && /Bob/.test(sl.item.snbtStr)))
const bobHead = Object.values(alice.gui.slots).find(sl => sl.item && sl.item.id == 'minecraft:player_head' && /SkullOwner:'Bob'/.test(sl.item.snbtStr))
cw = coinsOf(alice)
bobHead.leftClicked({}); advance(2)
ok('clicking Bob buys the contract on Bob and goes back to the main page', contractsOf(alice).some(st => /Bob/.test(st.parsed.trollcraft.contract.targetName)) && coinsOf(alice) < cw && /Hooded Merchant/.test(alice.gui.title))
// away from the merchant
alice.x = 1100.5
guiClick(alice, 2, 1)
ok('a window click away from the merchant is refused and the window closes', /The merchant is not here/.test(lastLine(alice)) && alice.gui == null)
alice.x = 1001.5
// fallback: no window support
W.noGui = true; alice.inbox = []
openWin(alice)
ok('if the window can\'t open, the chat menu is used instead', alice.gui == null && /\/blackmarket buy tnt/.test(text(alice)) && /\/blackmarket buy summons/.test(text(alice)) && W.logs.some(l => /Shop window failed/.test(l)))
W.noGui = false

// ----- Disguised TNT -----
alice.selected = 0
setReal(alice, 0, stack('minecraft:iron_sword', 1))
openWin(alice); cw = coinsOf(alice); guiClick(alice, 2, 2)
ok('Disguised TNT needs a block in hand (a sword is refused, nothing paid)', /isn't a block you can place/.test(text(alice)) && coinsOf(alice) == cw)
setReal(alice, 0, stack('minecraft:chest', 1))
guiClick(alice, 2, 2)
ok('... a block that holds things (chest) is refused', /can't be disguised/.test(text(alice)) && coinsOf(alice) == cw)
setReal(alice, 0, stack('minecraft:stone', 5))
guiClick(alice, 2, 2)
const tntItem = findItem(alice, st => st.id == 'minecraft:stone' && st.parsed && st.parsed.trollcraft)
ok('holding 5 stone: ONE becomes Disguised TNT (lore says so), 25 coins', tntItem && tntItem.count == 1 && realSlots(alice)[0].count == 4 && coinsOf(alice) == cw - 25 &&
  tntItem.parsed.trollcraft.trap == 'tnt' && /Disguised TNT/.test(tntItem.snbtStr) && /is now Disguised TNT/.test(text(alice)), JSON.stringify(tntItem && tntItem.parsed))
// place it
const placeAs = (p, st, x, y, z, dim) => {
  if (p.gui) { p.closeMenu(); advance(1) }   // nobody places blocks with a window open
  setReal(p, p.selected, st)
  W.placed[(dim || OW) + '|' + x + '|' + y + '|' + z] = st.id
  const ev = { entity: p, block: { id: st.id, x, y, z, getDimension: () => dim || OW }, cancelled: false, cancel() { throw new Exit() } }
  fire('blockPlaced', ev)
  return ev
}
placeAs(alice, tntItem, 1020, 64, 1020)
ok('placing it registers a trap (owner Alice)', DB().traps && DB().traps['minecraft:overworld|1020|64|1020'] && DB().traps['minecraft:overworld|1020|64|1020'].ownerName == 'Alice' && DB().traps['minecraft:overworld|1020|64|1020'].kind == 'tnt')
placeAs(alice, stack('minecraft:stone', 1), 1021, 64, 1020)
ok('placing a plain block registers nothing', !DB().traps['minecraft:overworld|1021|64|1020'])
// Bob walks across it (sprinting 8 blocks between two checks)
bob.x = 1016.5; bob.y = 65; bob.z = 1020.5
advance(12)
bob.x = 1024.5
const nx = W.explosions.length
advance(12)
const boom = W.explosions[W.explosions.length - 1]
ok('Bob sprints across it between two checks: it goes off (power 8, real TNT blast, no fire, at the block)', W.explosions.length == nx + 1 && boom.strength == 8 && boom.mode == 'TNT' && boom.fire === false &&
  boom.x == 1020.5 && boom.y == 64.5 && boom.z == 1020.5, JSON.stringify(boom))
ok('... the trap is used up and logged (with owner and victim)', !DB().traps['minecraft:overworld|1020|64|1020'] && (DB().trapLog || []).some(l => /placed by Alice went off under Bob/.test(l)))
// owner sets it off too; jumping over doesn't
const t2 = disguisedFor => { const st = stack('minecraft:stone', 1, '{trollcraft:{trap:"tnt"}}'); return st }
placeAs(alice, t2(), 1030, 64, 1030)
bob.x = 1028.5; bob.z = 1030.5; bob.y = 67.5; advance(12); bob.x = 1032.5; advance(12)
ok('jumping high over it doesn\'t set it off', !!DB().traps['minecraft:overworld|1030|64|1030'])
alice.x = 1029.5; alice.z = 1030.5; alice.y = 65; advance(12); alice.x = 1030.5; advance(12)
ok('its owner sets it off too', !DB().traps['minecraft:overworld|1030|64|1030'] && W.explosions[W.explosions.length - 1].x == 1030.5)
alice.x = 1001.5; alice.z = 1000.5
// protected: near world spawn -> no block damage
placeAs(alice, t2(), 20, 64, 20)
bob.x = 19.5; bob.z = 20.5; bob.y = 65; advance(12); bob.x = 20.5; advance(12)
ok('near world spawn (a safe zone): it goes off without breaking blocks', W.explosions[W.explosions.length - 1].x == 20.5 && W.explosions[W.explosions.length - 1].mode == 'NONE')
// replaced block: trap gone, no blast
placeAs(alice, t2(), 1040, 64, 1040)
W.placed['minecraft:overworld|1040|64|1040'] = 'minecraft:dirt'
const ne = W.explosions.length
bob.x = 1039.5; bob.z = 1040.5; advance(12); bob.x = 1040.5; advance(12)
ok('a trap whose block was replaced (piston, edit) is dropped without a blast', W.explosions.length == ne && !DB().traps['minecraft:overworld|1040|64|1040'])
// breaking defuses
placeAs(alice, t2(), 1050, 64, 1050)
fire('blockBroken', { player: bob, block: { id: 'minecraft:stone', x: 1050, y: 64, z: 1050, getDimension: () => OW }, cancel() { throw new Exit() } })
ok('breaking a trap block removes the trap', !DB().traps['minecraft:overworld|1050|64|1050'])
// limit per player
for (let i = 0; i < 10; i++) placeAs(alice, t2(), 1100 + i, 64, 1100)
const over = placeAs(alice, t2(), 1111, 64, 1100)
ok('the 11th Disguised TNT is refused (10 per player)', over.cancelled && !DB().traps['minecraft:overworld|1111|64|1100'] && /already have 10/.test(text(alice)))
cmd('bm traps list Alice', admin)
ok('/bm traps list <player>', /tnt \(minecraft:stone\) at minecraft:overworld 1109 64 1100/.test(replies.map(flat).join('\n')))
cmd('bm traps clear Alice', admin)
ok('/bm traps clear <player> defuses them', /10 trap\(s\) by Alice defused/.test(flat(lastReply())) && !Object.keys(DB().traps).some(k => DB().traps[k].ownerName == 'Alice'))
cmd('bm traps log', admin)
ok('/bm traps log', /went off under Bob/.test(replies.map(flat).join('\n')))
ok('/bm traps is op only', cmd('bm traps log', alice) == 0 && lastReply() == 'DENIED')

// ----- Mimic Chest -----
openWin(alice); cw = coinsOf(alice); guiClick(alice, 3, 2)
const mim = findItem(alice, st => st.id == 'minecraft:chest' && st.parsed && st.parsed.trollcraft && st.parsed.trollcraft.trap == 'mimic')
ok('Mimic Chest bought (12 coins)', mim && coinsOf(alice) == cw - 12)
placeAs(alice, mim, 1060, 65, 1060)
const openChest = p => fire('chestOpened', { player: p, block: { x: 1060, y: 65, z: 1060, getDimension: () => OW } })
const sf0 = W.cmds.filter(x => /summon minecraft:silverfish/.test(x.c)).length
openChest(alice)
ok('its owner opens it: nothing happens', W.cmds.filter(x => /summon minecraft:silverfish/.test(x.c)).length == sf0 && !!DB().traps['minecraft:overworld|1060|65|1060'])
bob.inbox = []
openChest(bob)
ok('Bob opens it: 6 silverfish and a laugh, and it becomes a normal chest', W.cmds.filter(x => /summon minecraft:silverfish/.test(x.c)).length == sf0 + 6 && /You should have read the label/.test(text(bob)) && !DB().traps['minecraft:overworld|1060|65|1060'])
openChest(bob)
ok('... only once', W.cmds.filter(x => /summon minecraft:silverfish/.test(x.c)).length == sf0 + 6)

// ----- Itching Powder -----
openWin(alice); cw = coinsOf(alice); guiClick(alice, 2, 3)
const itch = findItem(alice, st => st.id == 'minecraft:snowball' && st.parsed && st.parsed.trollcraft)
ok('Itching Powder: 4 named snowballs for 4 coins', itch && itch.count == 4 && /Itching Powder/.test(itch.parsed.display.Name) && coinsOf(alice) == cw - 4)
const ball = entity('minecraft:snowball', OW, 0, 0, 0, [], { getItem: () => stack('minecraft:snowball', 1, itch.snbtStr) })
bob.inbox = []
fire('hurt', { entity: bob, source: { getDirectEntity: () => ball, actual: alice }, cancel() { throw new Exit() } })
ok('Bob hit by it: Nausea, Slowness and Glowing for 30 s', ['nausea 30 1', 'slowness 30 1', 'glowing 30 0'].every(e => W.cmds.some(x => x.c == 'effect give bob-1111 minecraft:' + e)) && /itching powder/.test(text(bob)))
const plain = entity('minecraft:snowball', OW, 0, 0, 0, [], { getItem: () => stack('minecraft:snowball', 1) })
const nc = W.cmds.length
fire('hurt', { entity: bob, source: { getDirectEntity: () => plain, actual: alice }, cancel() { throw new Exit() } })
ok('a plain snowball does nothing', !W.cmds.slice(nc).some(x => /effect give bob/.test(x.c)))

// ----- Cursed Food -----
openWin(alice); guiClick(alice, 3, 3)
ok('Cursed Food opens its own page: 6 foods at 8 coins each', /Cursed Food/.test(alice.gui.title) &&
  ['Cursed Steak', 'Cursed Cooked Mutton', 'Cursed Bread', 'Cursed Golden Carrot', 'Cursed Golden Apple', 'Cursed Enchanted Golden Apple'].every((n, i) => slotName(alice, 1 + i, 2) == n) &&
  /8 Hush Coins/.test(slotLore(alice, 1, 2)), [1, 2, 3, 4, 5, 6].map(x => slotName(alice, x, 2)).join(' / '))
cw = coinsOf(alice); guiClick(alice, 1, 2)
const steak = findItem(alice, st => st.id == 'minecraft:cooked_beef' && st.parsed && st.parsed.trollcraft)
ok('buying a steak: 8 coins, real cooked beef with only the hidden marker (no name or lore), back on the food page', steak && coinsOf(alice) == cw - 8 && !steak.parsed.display &&
  /prank:"food"/.test(steak.snbtStr) && /Cursed Food/.test(alice.gui.title), steak && steak.snbtStr)
cw = coinsOf(alice); guiClick(alice, 6, 2)
const ega = findItem(alice, st => st.parsed && st.parsed.trollcraft && /enchanted_golden_apple/.test(st.snbtStr))
ok('the "Enchanted Golden Apple" is a golden apple dressed as one: light purple name, glint, hidden marker', ega && ega.id == 'minecraft:golden_apple' &&
  /"text":"Enchanted Golden Apple","color":"light_purple","italic":false/.test(ega.snbtStr) && /Enchantments/.test(ega.snbtStr) && coinsOf(alice) == cw - 8, ega && (ega.id + ' ' + ega.snbtStr))
ok('... and the shop never hands out a real minecraft:enchanted_golden_apple', !realSlots(alice).some(st => st.count > 0 && st.id == 'minecraft:enchanted_golden_apple'))
cw = coinsOf(alice)
cmd('bm buy food golden_apple', alice)
const gap = findItem(alice, st => st.id == 'minecraft:golden_apple' && st.parsed && st.parsed.trollcraft && /food:"golden_apple"/.test(st.snbtStr))
ok('/bm buy food golden_apple: a plain-looking golden apple, 8 coins', gap && !gap.parsed.display && coinsOf(alice) == cw - 8)
cmd('bm buy food cake', alice)
ok('/bm buy food with an unknown food is refused, nothing taken', /no cursed cake/.test(flat(lastReply())) && coinsOf(alice) == cw - 8)
const realRandom2 = Math.random
const curseLog = () => { const l = W.logs.filter(x => /ate a cursed/.test(x)); const m = (l[l.length - 1] || '').match(/: ([a-z_, ]+)$/); return m ? m[1].split(', ') : [] }
const eat = (who, st) => fire('foodEaten', { entity: who, item: st })
Math.random = () => 0.1
let nl = W.cmds.length
eat(bob, stack('minecraft:cooked_beef', 1, steak.snbtStr))
ok('a low roll: one curse (Launch: Levitation II)', curseLog().length == 1 && curseLog()[0] == 'launch' && W.cmds.slice(nl).some(x => x.c == 'effect give bob-1111 minecraft:levitation 6 1') && /tasted\.\.\. wrong/.test(text(bob)), curseLog().join(','))
Math.random = () => 0.7
eat(bob, stack('minecraft:cooked_beef', 1, steak.snbtStr))
ok('a roll of 0.7: two different curses', curseLog().length == 2 && curseLog()[0] != curseLog()[1], curseLog().join(','))
Math.random = () => 0.95
nl = W.cmds.length
eat(bob, stack('minecraft:cooked_beef', 1, steak.snbtStr))
const three = curseLog()
ok('the top roll: three different curses', three.length == 3 && new Set(three).size == 3, three.join(','))
ok('... the loud one: Glowing, plus a goat horn and a pig squeal for everyone around', three.indexOf('loud') >= 0 && W.cmds.slice(nl).some(x => x.c == 'effect give bob-1111 minecraft:glowing 30 0') &&
  W.cmds.slice(nl).some(x => /execute as bob-1111 at @s run playsound minecraft:item.goat_horn.sound.0 player @a/.test(x.c)) && /Everyone heard that/.test(text(bob)))
ok('... the wrong turn: a short spreadplayers hop on ground below head height', three.indexOf('wrong_turn') >= 0 && W.cmds.slice(nl).some(x => /execute as bob-1111 at @s run spreadplayers ~ ~ 4 16 under \d+ false @s/.test(x.c)))
Math.random = realRandom2
const counts = {}
for (let i = 0; i < 300; i++) { eat(bob, stack('minecraft:cooked_beef', 1, steak.snbtStr)); let c = curseLog(); counts[c.length] = (counts[c.length] || 0) + 1; if (new Set(c).size != c.length) counts.dupe = true }
ok('over 300 bites: mostly 1 curse, some 2, a few 3, never the same curse twice', counts[1] > counts[2] && counts[2] > (counts[3] || 0) && counts[3] > 0 && !counts.dupe && !counts[0], JSON.stringify(counts))
nl = W.cmds.length
eat(bob, stack('minecraft:golden_apple', 1, ega.snbtStr)); advance(1)
ok('eating the fake Enchanted Golden Apple strips the apple buffs (now and a tick later)', ['regeneration', 'absorption', 'resistance', 'fire_resistance'].every(e => W.cmds.slice(nl).filter(x => x.c == 'effect clear bob-1111 minecraft:' + e).length == 2))
nl = W.cmds.length
eat(bob, stack('minecraft:cooked_beef', 1, steak.snbtStr))
ok('a cursed steak doesn\'t strip anything', !W.cmds.slice(nl).some(x => /effect clear/.test(x.c)))
nl = W.cmds.length; const nlog = W.logs.length
eat(bob, stack('minecraft:cooked_beef', 1))
ok('a normal steak does nothing', W.cmds.length == nl && W.logs.length == nlog)
eat(bob, stack('minecraft:cookie', 1, '{trollcraft:{prank:"snack"}}'))
ok('a Cursed Snack cookie sold before the food menu still curses', /ate a cursed cookie/.test(W.logs[W.logs.length - 1]))

// ----- Anonymous Summons -----
openWin(alice); guiClick(alice, 4, 3)
ok('Anonymous Summons opens the player list', /Anonymous Summons: who\?/.test(alice.gui.title))
const bobHead2 = Object.values(alice.gui.slots).find(sl => sl.item && /SkullOwner:'Bob'/.test(sl.item.snbtStr))
cw = coinsOf(alice); bob.inbox = []
bobHead2.leftClicked({}); advance(2)
ok('Bob gets an official-looking [MINISTRY] notice (not naming Alice), 5 coins', coinsOf(alice) == cw - 5 && /\[MINISTRY\]/.test(text(bob)) && !/Alice/.test(text(bob)) && /delivered/.test(text(alice)))
// commands work too (chat menu path)
cw = coinsOf(alice)
cmd('bm buy itching', alice); cmd('bm buy food bread', alice); cmd('bm buy summons Bob', alice)
ok('/bm buy itching|food <food>|summons <player> work from chat', coinsOf(alice) == cw - 4 - 8 - 5, coinsOf(alice) + ' vs ' + (cw - 17))
alice.x = 1100.5
cmd('bm buy mimic', alice)
ok('... and refuse away from the merchant', /The merchant is not here/.test(flat(lastReply())))
alice.x = 1001.5

// ======================= Butterfingers =======================
openWin(alice)
ok('window: Butterfingers in the Pranks row (5,3); Place a Bounty (6,0) and Wanted (7,0) in the top row', slotName(alice, 5, 3) == 'Butterfingers' && slotName(alice, 6, 0) == 'Place a Bounty' && slotName(alice, 7, 0) == 'Wanted',
  [slotName(alice, 5, 3), slotName(alice, 6, 0), slotName(alice, 7, 0)].join(' / '))
cw = coinsOf(alice); guiClick(alice, 5, 3)
const bf = findItem(alice, st => st.id == 'minecraft:egg' && st.parsed && st.parsed.trollcraft)
ok('Butterfingers: 3 named eggs for 5 coins', bf && bf.count == 3 && bf.parsed.trollcraft.prank.replace(/"/g, '') == 'butterfingers' && /Butterfingers/.test(bf.parsed.display.Name) && coinsOf(alice) == cw - 5)
bob.selected = 0
setReal(bob, 0, stack('minecraft:diamond_sword', 1, '{display:{Name:\'{"text":"Excalibob"}\'}}'))
const eggOf = st => entity('minecraft:egg', OW, 0, 0, 0, [], { getItem: () => st })
const hitBy = (victim, proj, by) => fire('hurt', { entity: victim, source: { getDirectEntity: () => proj, actual: by || alice }, cancel() { throw new Exit() } })
const nd = W.drops.length; bob.inbox = []
hitBy(bob, eggOf(stack('minecraft:egg', 1, bf.snbtStr)))
ok('Bob hit by it: his held item is dropped (NBT kept) and his hand is empty', bob.mainHandItem.isEmpty() && W.drops.length == nd + 1 && W.drops[nd].item == 'minecraft:diamond_sword' && /Excalibob/.test(W.drops[nd].snbt) &&
  W.drops[nd].by == 'drop:Bob' && /Butterfingers!/.test(text(bob)), JSON.stringify(W.drops.slice(nd)))
setReal(bob, 0, stack('minecraft:diamond_sword', 1))
hitBy(bob, eggOf(stack('minecraft:egg', 1)))
ok('a plain egg does nothing', !bob.mainHandItem.isEmpty() && W.drops.length == nd + 1)
hitBy(bob, entity('minecraft:snowball', OW, 0, 0, 0, [], { getItem: () => stack('minecraft:snowball', 1, bf.snbtStr) }))
ok('the Butterfingers NBT on a snowball does nothing (eggs only)', !bob.mainHandItem.isEmpty() && W.drops.length == nd + 1)
setReal(bob, 0, EMPTY()); bob.inbox = []
hitBy(bob, eggOf(stack('minecraft:egg', 1, bf.snbtStr)))
ok('an empty hand: nothing happens', W.drops.length == nd + 1 && !/Butterfingers/.test(text(bob)))
bob.creative = true; setReal(bob, 0, stack('minecraft:diamond', 3))
hitBy(bob, eggOf(stack('minecraft:egg', 1, bf.snbtStr)))
ok('a creative player keeps their item', bob.mainHandItem.count == 3 && W.drops.length == nd + 1)
bob.creative = false; setReal(bob, 0, EMPTY())
cw = coinsOf(alice); cmd('bm buy butterfingers', alice)
ok('/bm buy butterfingers works from chat', coinsOf(alice) == cw - 5)

// ======================= Bounties =======================
const BDB = () => JSON.parse(W.persistent.bounties || '{}')
const pot = name => { const b = BDB().bounties || {}; const u = Object.keys(b).find(k => b[k].targetName == name); return u ? b[u].total : 0 }
const setCoins = (p, n) => { realSlots(p).forEach(s => { if (s.count > 0 && s.id == 'minecraft:gold_nugget' && s.parsed && s.parsed.trollcraft) s.count = 0 }); if (n) cmd('coins give ' + p.name + ' ' + n, admin) }
const dave = player('Dave', 'unregistered', OW, 1002.5, 65, 1001.5); players.push(dave)
const eve = player('Eve', 'syndicate', OW, 1002.5, 65, 999.5); players.push(eve)
;[dave, eve].forEach(p => fire('loggedIn', { player: p }))
const kill = (victim, by) => fire('death', { entity: victim, source: { actual: by }, server })
const allInbox = () => players.filter(p => p.online).map(text).join('\n')
const clearInboxes = () => players.forEach(p => { p.inbox = [] })
ok('global.Bounties is there and the black market API has the merchant checks', !!glob.Bounties && typeof glob.Economy.merchantRequired == 'function' && glob.Economy.merchantRequired() === true)
// the window: whose head?
setCoins(alice, 30)
openWin(alice); guiClick(alice, 6, 0)
ok('Place a Bounty opens the player heads page', /Bounty: whose head\?/.test(alice.gui.title) && Object.values(alice.gui.slots).some(sl => sl.item && /SkullOwner:'Bob'/.test(sl.item.snbtStr)) &&
  !Object.values(alice.gui.slots).some(sl => sl.item && /SkullOwner:'Alice'/.test(sl.item.snbtStr)))
const headAt = (p, n) => { const k = Object.keys(p.gui.slots).find(k => p.gui.slots[k].item && new RegExp("SkullOwner:'" + n + "'").test(p.gui.slots[k].item.snbtStr)); return k ? k.split(',').map(Number) : null }
let hb = headAt(alice, 'Bob')
ok('... Bob\'s head says there\'s no price yet', /No price on their head yet/.test(slotLore(alice, hb[0], hb[1])))
guiClick(alice, hb[0], hb[1])
ok('clicking Bob: the amount page, presets she can afford (5, 10, 25) and All 30', /Bounty on Bob: how much\?/.test(alice.gui.title) && slotName(alice, 1, 2) == '5 Hush Coins' && slotName(alice, 2, 2) == '10 Hush Coins' &&
  slotName(alice, 3, 2) == '25 Hush Coins' && slotName(alice, 4, 2) == 'All 30 Hush Coins' && slotName(alice, 5, 2) == ' ', [1, 2, 3, 4, 5].map(x => slotName(alice, x, 2)).join(' / '))
ok('the amount page shows the coins she really carries (30), not 0 while the window has her inventory', slotName(alice, 0, 5) == 'You carry 30 Hush Coins', slotName(alice, 0, 5))
clearInboxes()
guiClick(alice, 1, 2)
ok('placing 5 from the window: 5 coins taken, the pot is 5, back to the main page', coinsOf(alice) == 25 && pot('Bob') == 5 && /Hooded Merchant/.test(alice.gui.title) && /Your 5 Hush Coins are on Bob's head/.test(text(alice)))
ok('... everyone online is told "[WANTED] Bob - 5 Hush Coins on their head", Alice is not named, no tellraw @a', [admin, bob, carl, dave, eve].every(p => /Bob - 5 Hush Coins on their head/.test(text(p)) && /\[WANTED\]/.test(text(p))) &&
  !/Alice/.test(players.filter(p => p !== alice).map(text).join('\n')) && !W.cmds.some(x => /^tellraw @a/.test(x.c)))
setCoins(carl, 20)
cmd('bounty Bob 10', carl)
ok('Carl places 10 by command: the pot stacks to 15', pot('Bob') == 15 && coinsOf(carl) == 10 && /Bob - 15 Hush Coins/.test(text(bob)))
cmd('bounty Bob 5', alice)
ok('Alice placing on Bob again is refused, nothing taken', /already have 5 Hush Coins on Bob/.test(flat(lastReply())) && coinsOf(alice) == 25 && pot('Bob') == 15)
setCoins(dave, 3)
cmd('bounty Bob 10', dave)
ok('more than you carry is refused', /only carry 3 Hush Coins/.test(flat(lastReply())) && coinsOf(dave) == 3 && pot('Bob') == 15)
cmd('bounty Bob 0', dave)
ok('0 is refused', /at least 1/.test(flat(lastReply())) && coinsOf(dave) == 3)
cmd('bounty Alice 1', alice)
ok('a bounty on yourself is refused', /your own head/.test(flat(lastReply())) && coinsOf(alice) == 25)
cmd('bounty Nobody 1', alice)
ok('an unknown player is refused', /Nobody has heard of Nobody/.test(flat(lastReply())) && coinsOf(alice) == 25)
alice.x = 1100.5
cmd('bounty Eve 1', alice)
ok('away from the merchant: refused', /Find him first/.test(flat(lastReply())) && coinsOf(alice) == 25 && !pot('Eve'))
cmd('bounty cancel Bob', alice)
ok('... cancelling away from the merchant is refused too', /Find him first/.test(flat(lastReply())) && pot('Bob') == 15)
alice.x = 1001.5
// cancelling
clearInboxes()
cmd('bounty cancel Bob', alice)
ok('Alice cancels: 5 back, the pot drops to 10, nobody else is told', coinsOf(alice) == 30 && pot('Bob') == 10 && /withdrawn/.test(flat(lastReply())) && !/WANTED/.test(players.filter(p => p !== alice).map(text).join('\n')))
cmd('bounty cancel Bob', dave)
ok('cancelling without a bounty there is refused', /You have no bounty on Bob/.test(flat(lastReply())) && coinsOf(dave) == 3)
cmd('bounty Bob 5', alice)
ok('after cancelling, Alice can place again (pot 15)', pot('Bob') == 15 && coinsOf(alice) == 25)
// cancel from the window
openWin(alice); guiClick(alice, 6, 0); hb = headAt(alice, 'Bob')
ok('the heads page shows the pot and "Your bounty: 5 coins. Click to cancel it."', /15 Hush Coins on their head/.test(slotLore(alice, hb[0], hb[1])) && /Your bounty: 5 coins\. Click to cancel it\./.test(slotLore(alice, hb[0], hb[1])), slotLore(alice, hb[0], hb[1]))
guiClick(alice, hb[0], hb[1])
ok('clicking it opens the cancel page', /Cancel your bounty on Bob\?/.test(alice.gui.title) && slotName(alice, 3, 2) == 'Cancel my bounty' && slotName(alice, 5, 2) == 'Keep it')
guiClick(alice, 5, 2)
ok('"Keep it" goes back to the heads page, nothing changed', /whose head/.test(alice.gui.title) && pot('Bob') == 15 && coinsOf(alice) == 25)
guiClick(alice, hb[0], hb[1]); guiClick(alice, 3, 2)
ok('"Cancel my bounty": refunded, pot 10, back to the heads page', coinsOf(alice) == 30 && pot('Bob') == 10 && /whose head/.test(alice.gui.title))
// last placer cancels: gone
cmd('bounty Eve 2', carl)
cmd('bounty cancel Eve', carl)
ok('when the last placer cancels, the bounty is gone', !(BDB().bounties || {})[eve.uuid] && coinsOf(carl) == 10)
cmd('bounty Bob 5', alice)
// wanted page and list
openWin(alice); guiClick(alice, 7, 0)
hb = headAt(alice, 'Bob')
ok('the Wanted page: Bob with his pot', /Wanted/.test(alice.gui.title) && hb && /15 Hush Coins on their head/.test(slotLore(alice, hb[0], hb[1])))
alice.inbox = []
cmd('bounty list', alice)
ok('/bounty list for players: the pots, no placers', /Bob - 15 Hush Coins/.test(text(alice)) && !/Carl/.test(text(alice)))
admin.inbox = []
cmd('bounties', admin)
ok('/bounties for ops: who placed what', /Bob - 15 Hush Coins/.test(text(admin)) && /Alice 5/.test(text(admin)) && /Carl 10/.test(text(admin)), text(admin))
// chat picker
alice.inbox = []
cmd('bounty', alice)
ok('/bounty alone: the chat picker, with a cancel button where she has a bounty and amounts elsewhere', /\/bounty cancel Bob/.test(text(alice)) && /\/bounty Eve 5/.test(text(alice)) && /\/bounty Eve 25/.test(text(alice)), text(alice).slice(0, 600))
alice.inbox = []
cmd('bounty Eve', alice)
ok('/bounty <player>: the amount buttons for that player', /How much on Eve\?/.test(text(alice)) && /\/bounty Eve 10/.test(text(alice)) && /\/bounty Eve 25/.test(text(alice)) && !/\/bounty Eve 50/.test(text(alice)))
// the chat shop has a Bounties line
alice.inbox = []
cmd('blackmarket chatshop', alice)
ok('the chat shop has a Bounties line ([PLACE] and [WANTED]) and Butterfingers', /Bounties/.test(text(alice)) && /"value":"\/bounty"/.test(text(alice)) && /\/blackmarket buy butterfingers/.test(text(alice)))
// deaths that don't pay
const zombie = entity('minecraft:zombie', OW, 0, 0, 0, [])
kill(bob, zombie)
ok('Bob killed by a zombie: no payout, the pot stays', pot('Bob') == 15)
kill(bob, null)
ok('Bob dies from a fall (no attacker): no payout', pot('Bob') == 15)
glob.pigEscortState = { phase: 'running', run: { site: { x: 0, z: 0 } } }
bob._tags.push('pig_escort_participant')
let cc = coinsOf(eve)
kill(bob, eve)
ok('in a Pig Escort: no payout', pot('Bob') == 15 && coinsOf(eve) == cc)
bob._tags = bob._tags.filter(t => t != 'pig_escort_participant'); glob.pigEscortState = null
// Carl (a placer, rival faction) kills Bob: he collects, no rival bonus (he's a placer)
cc = coinsOf(carl); clearInboxes()
kill(bob, carl)
ok('Carl, a placer, kills Bob: he collects the 15, no rival bonus for placers', coinsOf(carl) == cc + 15 && !pot('Bob') && !/rival bonus/.test(text(carl)))
ok('... everyone is told "Carl collected the 15-coin bounty on Bob"', [admin, alice, bob, dave, eve].every(p => /Carl collected the 15-coin bounty on Bob/.test(text(p))))
cmd('bounty Bob 5', alice)
ok('after collection Alice can place on Bob again', pot('Bob') == 5 && coinsOf(alice) == 20)
// rival bonus
setCoins(dave, 32)
cmd('bounty Bob 32', dave)
ok('pot 37 on Bob (Alice 5 + Dave 32)', pot('Bob') == 37)
cc = coinsOf(eve); clearInboxes()
kill(bob, eve)
ok('Eve (Syndicate, not a placer) kills Bob (Ministry): 37 + a 9-coin rival bonus (25%)', coinsOf(eve) == cc + 46 && /\+9 rival bonus/.test(text(eve)), coinsOf(eve) - cc)
ok('... the public message only gives the pot (the bonus is told to Eve alone)', /Eve collected the 37-coin bounty on Bob/.test(text(alice)) && !/rival/.test(players.filter(p => p !== eve).map(text).join('\n')))
cmd('bounty Bob 20', alice)
cc = coinsOf(eve); kill(bob, eve)
ok('the same killer and target within 2 h: no bonus', coinsOf(eve) == cc + 20)
W.time += 121 * 60000
cmd('bounty Bob 20', carl)
cc = coinsOf(eve); kill(bob, eve)
ok('... after 2 h, the bonus again (20 -> +5)', coinsOf(eve) == cc + 25, coinsOf(eve) - cc)
setCoins(alice, 200); setCoins(carl, 100)
cmd('bounty Bob 40', alice)
cc = coinsOf(eve); kill(bob, eve)
W.time += 121 * 60000
cmd('bounty Bob 80', alice)
cc = coinsOf(eve); kill(bob, eve)
ok('the bonus is capped at 10 (pot 80 -> +10)', coinsOf(eve) == cc + 90, coinsOf(eve) - cc)
cmd('bounty Bob 4', carl)
const eve2 = player('Zed', 'syndicate', OW, 1002.5, 65, 1003.5); players.push(eve2)
cc = coinsOf(eve2); kill(bob, eve2)
ok('a pot under 5: no bonus', coinsOf(eve2) == cc + 4)
cmd('bounty Bob 10', carl)
cc = coinsOf(admin); kill(bob, admin)
ok('same faction (Ministry kills Ministry): no bonus', coinsOf(admin) == cc + 10)
cmd('bounty Bob 10', carl)
cc = coinsOf(dave); kill(bob, dave)
ok('a killer with no faction: no bonus', coinsOf(dave) == cc + 10)
cmd('bounty Eve 10', carl)
cc = coinsOf(bob); kill(eve, bob)
ok('Bob (Ministry) kills Eve (secret Syndicate): no bonus, it would give her faction away', coinsOf(bob) == cc + 10 && !/rival/.test(text(bob)))
// offline targets
const frank = player('Frank', 'ministry', OW, 3000.5, 65, 3000.5); players.push(frank)
fire('loggedIn', { player: frank }); frank.online = false
openWin(alice); guiClick(alice, 6, 0)
const hf = headAt(alice, 'Frank'), hbob = headAt(alice, 'Bob')
ok('the heads page lists offline players after the online ones, marked offline', hf && hbob && (hf[1] * 9 + hf[0]) > (hbob[1] * 9 + hbob[0]) && /offline/.test(slotLore(alice, hf[0], hf[1])), JSON.stringify([hf, hbob]))
guiClick(alice, hf[0], hf[1]); guiClick(alice, 1, 2)
ok('placing 5 on offline Frank from the window', pot('Frank') == 5)
frank.online = true; fire('loggedIn', { player: frank })
cc = coinsOf(eve); kill(frank, eve)
ok('Frank logs in and Eve kills him: she collects (5, +1 rival bonus)', coinsOf(eve) == cc + 6 && !pot('Frank'), coinsOf(eve) - cc)
// op clear with refunds (one placer offline)
setCoins(dave, 7)
cmd('bounty Bob 6', alice); cmd('bounty Bob 7', dave)
dave.online = false
let ca = coinsOf(alice)
cmd('bounty clear Bob', admin)
ok('/bounty clear: removed, online placers refunded at once', !pot('Bob') && coinsOf(alice) == ca + 6 && /13-coin bounty on Bob is cleared/.test(flat(lastReply())))
ok('... offline placers on their next login', coinsOf(dave) == 0 && (dave.online = true, fire('loggedIn', { player: dave }), coinsOf(dave) == 7) && /called off while you were away/.test(text(dave)))
ok('/bounty clear is op only', cmd('bounty clear Bob', alice) == 0 && lastReply() == 'DENIED')
// survives a reload
cmd('bounty Bob 3', alice)
loadAll(); advance(45)
ok('a bounty survives /reload', pot('Bob') == 3 && glob.Bounties.potOf(bob.uuid) == 3)
// with the black market closed, bounties work anywhere
cmd('blackmarket toggle', admin)
alice.x = 1200.5
cmd('bounty Eve 2', alice)
ok('black market closed: bounties can be placed anywhere', pot('Eve') == 2)
cmd('blackmarket toggle', admin); advance(45)
alice.x = 1001.5
// /bounty toggle
cmd('bounty toggle', admin)
cmd('bounty Eve 2', carl)
ok('/bounty toggle off: placing refused', /Bounties are closed/.test(flat(lastReply())) && pot('Eve') == 2)
cc = coinsOf(carl); kill(eve, carl)
ok('... and kills don\'t pay (the pot is kept)', pot('Eve') == 2 && coinsOf(carl) == cc)
ca = coinsOf(alice)
cmd('blackmarket vendor spawn old_crossroads', admin); advance(45)
cmd('bounty cancel Eve', alice)
ok('... but cancelling still works', !pot('Eve') && coinsOf(alice) == ca + 2)
cmd('bounty toggle', admin)
cmd('bounty log', admin)
ok('/bounty log shows placements and collections (with placers, for ops)', /collected/.test(replies.map(flat).join('\n')) && /placed by/.test(replies.map(flat).join('\n')))

// ======================= Hush Coins: the rename and old coins =======================
const coinNbtFresh = realSlots(alice).find(st => st.count > 0 && st.id == 'minecraft:gold_nugget' && st.parsed && st.parsed.trollcraft).snbtStr
ok('coins are named "Hush Coin" (same hidden tag, same lore)', /"text":"Hush Coin"/.test(coinNbtFresh) && /trollcraft:\{coin:1b\}/.test(coinNbtFresh) && /Accepted where questions are not/.test(coinNbtFresh))
const oldNbt = coinNbtFresh.replace('Hush Coin', 'Blood Coin')
setReal(alice, 20, stack('minecraft:gold_nugget', 7, oldNbt))
ca = coinsOf(alice)
ok('an old "Blood Coin" stack still counts as money', glob.Economy.countCoins(alice) == ca && realSlots(alice)[20].count == 7)
fire('loggedIn', { player: alice })
ok('on login it becomes a Hush Coin stack of the same count, identical to new coins (so they stack)', realSlots(alice)[20].count == 7 && realSlots(alice)[20].snbtStr == coinNbtFresh && glob.Economy.countCoins(alice) == ca)
setReal(alice, 21, stack('minecraft:gold_nugget', 3, oldNbt))
setReal(alice, 40, stack('minecraft:gold_nugget', 2, oldNbt))
openWin(alice)
ok('... and when the shop opens (offhand too)', realSlots(alice)[21].snbtStr == coinNbtFresh && realSlots(alice)[21].count == 3 && realSlots(alice)[40].snbtStr == coinNbtFresh)
alice.closeMenu(); advance(1)
setReal(alice, 22, stack('minecraft:gold_nugget', 4, oldNbt))
advance(20 * 31)
ok('... and every 30 s for everyone online', realSlots(alice)[22].snbtStr == coinNbtFresh)
const plainNamed = stack('minecraft:gold_nugget', 5, '{display:{Name:\'{"text":"Hush Coin","color":"dark_red"}\'}}')
setReal(alice, 23, plainNamed)
fire('loggedIn', { player: alice })
ok('a plain nugget renamed "Hush Coin" is left alone and isn\'t money', realSlots(alice)[23].snbtStr == plainNamed.snbtStr && glob.Economy.countCoins(alice) == coinsOf(alice))
setReal(alice, 23, EMPTY())
ok('bounty messages use the name from black_market.js', glob.Economy.coinText(1) == '1 Hush Coin' && glob.Economy.coinText(3) == '3 Hush Coins')

// ======================= Ambush coin drops =======================
const realRandom = Math.random
const ambushMob = extraTags => entity('minecraft:piglin', NE, 10, 50, 10, ['portal_ambush'].concat(extraTags || []))
const coinDrops = () => W.drops.filter(d => d.item == 'minecraft:gold_nugget' && /coin:1b/.test(d.snbt || '')).length
const killMob = (m, by) => { m.alive = false; fire('death', { entity: m, source: { actual: by }, server }) }
let d0 = coinDrops()
Math.random = () => 0.1
killMob(ambushMob(), alice)
ok('a raid/ambush mob killed by a player, roll under 25%: drops 1 coin', coinDrops() == d0 + 1 && W.drops[W.drops.length - 1].count == 1 && W.drops[W.drops.length - 1].by == 'minecraft:piglin')
Math.random = () => 0.3
killMob(ambushMob(), alice)
ok('... roll over 25%: nothing', coinDrops() == d0 + 1)
Math.random = () => 0.1
killMob(ambushMob(), entity('minecraft:zombie', NE, 0, 0, 0, []))
killMob(ambushMob(), null)
ok('killed by a zombie, or by a fall (no attacker): nothing', coinDrops() == d0 + 1)
killMob(ambushMob(['contract_ambush']), bob)
ok('an Ambush Contract mob killed by a player drops like any other', coinDrops() == d0 + 2)
killMob(ambushMob(['portal_ambush_summoned']), alice)
ok('a vex summoned by an evoker: nothing', coinDrops() == d0 + 2)
killMob(entity('minecraft:piglin_brute', OW, 0, 65, 0, ['pig_escort_mob']), alice)
ok('a mob that isn\'t an ambush mob (e.g. Pig Escort waves): nothing', coinDrops() == d0 + 2)
Math.random = realRandom
d0 = coinDrops()
for (let i = 0; i < 400; i++) killMob(ambushMob(), alice)
const rate = (coinDrops() - d0) / 400
ok('over 400 kills about a quarter drop a coin (15-35%)', rate > 0.15 && rate < 0.35, rate)

// ======================= Teleport Trap =======================
alice.x = 1001.5; alice.z = 1000.5; alice.y = 65; alice.dim = OW
setCoins(alice, 200)
alice.selected = 0
setReal(alice, 0, stack('minecraft:stone', 3))
openWin(alice)
ok('window: Teleport Trap in the Traps row (4,2) with its price', slotName(alice, 4, 2) == 'Teleport Trap' && /20 Hush Coins per block/.test(slotLore(alice, 4, 2)))
alice.inbox = []
guiClick(alice, 4, 2)
ok('clicking it closes the window and puts /bmbuy tpblock in the chat box (suggest_command)', alice.gui == null && /"suggest_command","value":"\/bmbuy tpblock "/.test(text(alice)))
alice.inbox = []
cmd('bm buy tpblock', alice)
ok('/bm buy tpblock alone explains it', /\/bmbuy tpblock <x> <y> <z>/.test(text(alice)))
glob.netherPortalsUnlocked = false
ca = coinsOf(alice)
cmd('bmbuy tpblock 500 70 -300 nether', alice)
ok('Nether destinations are refused while the Nether lock is on', /Nether is still sealed/.test(flat(lastReply())) && coinsOf(alice) == ca)
glob.netherPortalsUnlocked = true
cmd('bmbuy tpblock 0 400 0', alice)
ok('a height outside the dimension is refused', /between -64 and 319/.test(flat(lastReply())) && coinsOf(alice) == ca)
cmd('bmbuy tpblock 0 70 0 moon', alice)
ok('an unknown dimension is refused', /Unknown dimension "moon"/.test(flat(lastReply())) && coinsOf(alice) == ca)
cmd('bmbuy tpblock 9000 70 0 overworld', alice)
ok('outside the world border is refused', /outside the world border/.test(flat(lastReply())) && coinsOf(alice) == ca)
setReal(alice, 0, stack('minecraft:iron_sword', 1))
cmd('bmbuy tpblock 500 70 -300 nether', alice)
ok('it needs a plain block in hand', /isn't a block you can place/.test(flat(lastReply())) && coinsOf(alice) == ca)
setReal(alice, 0, stack('minecraft:stone', 3))
alice.x = 1100.5
cmd('bmbuy tpblock 500 70 -300 nether', alice)
ok('away from the merchant: refused', /The merchant is not here/.test(flat(lastReply())) && coinsOf(alice) == ca)
alice.x = 1001.5
setReal(dave, dave.selected, stack('minecraft:stone', 1)); setCoins(dave, 5)
cmd('bmbuy tpblock 500 70 -300 nether', dave)
ok('not enough coins: refused', /costs 20 Hush Coins\. You have 5/.test(flat(lastReply())) && dave.mainHandItem.count == 1)
cmd('bmbuy tpblock 500 70 -300 nether', alice)
const tpItem = findItem(alice, st => st.id == 'minecraft:stone' && st.parsed && st.parsed.trollcraft && st.parsed.trollcraft.trap == '"tp"' || (st.parsed && st.parsed.trollcraft && String(st.parsed.trollcraft.trap).replace(/"/g, '') == 'tp'))
ok('/bmbuy tpblock 500 70 -300 nether: 20 coins, ONE of the 3 stone becomes a Teleport Trap with the destination in its lore', tpItem && tpItem.count == 1 && realSlots(alice)[0].count == 2 && coinsOf(alice) == ca - 20 &&
  /Teleport Trap/.test(tpItem.snbtStr) && /500 70 -300 \(Nether\)/.test(tpItem.snbtStr) && /now a Teleport Trap to 500 70 -300 \(Nether\)/.test(flat(lastReply())), tpItem && tpItem.snbtStr)
cmd('bm buy tpblock 1300 60 1300', alice)
const tpItem2 = realSlots(alice).find(st => st.count > 0 && st.parsed && st.parsed.trollcraft && /1300/.test(st.snbtStr))
ok('/bm buy tpblock works too; no dimension = the buyer\'s own (Overworld)', tpItem2 && /\(Overworld\)/.test(tpItem2.snbtStr) && coinsOf(alice) == ca - 40)
placeAs(alice, tpItem, 1200, 64, 1200)
const tk = 'minecraft:overworld|1200|64|1200'
ok('placing it registers a Teleport Trap with its destination', DB().traps[tk] && DB().traps[tk].kind == 'tp' && DB().traps[tk].dest.dim == NE && DB().traps[tk].dest.x == 500 && DB().traps[tk].dest.z == -300)
admin.x = 1201.5; admin.z = 1200.5; cmd('bm traps near', admin)
ok('/bm traps near shows where it sends people', replies.map(flat).some(l => /tp \(minecraft:stone\) at 1200 64 1200.*sends to minecraft:the_nether 500 70 -300/.test(l)))
admin.x = 1003.5; admin.z = 1000.5
bob.dim = OW; bob.x = 1198.5; bob.y = 65; bob.z = 1200.5; bob.inbox = []
advance(12); bob.x = 1202.5; advance(12)
ok('Bob walks over it: teleported to the Nether at 500.5 70 -299.5', bob.dim == NE && bob.x == 500.5 && bob.y == 70 && bob.z == -299.5 && /The ground had other plans/.test(text(bob)), [bob.dim, bob.x, bob.y, bob.z].join(' '))
ok('... the block is consumed (air) and the trap is gone and logged', W.placed[tk] == 'minecraft:air' && !DB().traps[tk] && DB().trapLog.some(l => /Teleport Trap \(minecraft:stone\) placed by Alice sent Bob/.test(l)))
ok('... with particles and the enderman sound at both ends', W.cmds.some(x => /execute in minecraft:overworld run playsound minecraft:entity.enderman.teleport/.test(x.c)) && W.cmds.some(x => /execute in minecraft:the_nether run particle minecraft:reverse_portal/.test(x.c)))
// safe landing: destination inside stone
placeAs(alice, tpItem2, 1210, 64, 1210)
bob.dim = OW; bob.x = 1208.5; bob.y = 65; bob.z = 1210.5
advance(12); bob.x = 1212.5; advance(12)
ok('a destination inside blocks (y 60 in stone): lands at the first 2-block gap (y 65)', bob.dim == OW && bob.x == 1300.5 && bob.y == 65, [bob.dim, bob.x, bob.y].join(' '))
// owner sets it off too
const tp3 = () => stack('minecraft:stone', 1, '{trollcraft:{trap:"tp",tp:{dim:"minecraft:overworld",x:1500,y:70,z:1500}}}')
placeAs(alice, tp3(), 1220, 64, 1220)
alice.x = 1218.5; alice.z = 1220.5; advance(12); alice.x = 1222.5; advance(12)
ok('its owner sets it off too', alice.x == 1500.5 && !DB().traps['minecraft:overworld|1220|64|1220'])
alice.x = 1001.5; alice.y = 65; alice.z = 1000.5; alice.dim = OW
// Pig Escort players are left alone
placeAs(alice, tp3(), 1230, 64, 1230)
glob.pigEscortState = { phase: 'running', run: { site: { x: 0, z: 0 } } }; bob._tags.push('pig_escort_participant')
bob.dim = OW; bob.x = 1228.5; bob.y = 65; bob.z = 1230.5; advance(12); bob.x = 1232.5; advance(12)
ok('a Pig Escort participant isn\'t teleported; the trap waits', bob.x == 1232.5 && !!DB().traps['minecraft:overworld|1230|64|1230'])
bob._tags = bob._tags.filter(t => t != 'pig_escort_participant'); glob.pigEscortState = null
// survives a reload
loadAll(); advance(45)
bob.x = 1228.5; advance(12)
ok('a placed Teleport Trap survives /reload and still works', bob.x == 1500.5 && !DB().traps['minecraft:overworld|1230|64|1230'])
// replaced block: no teleport
placeAs(alice, tp3(), 1240, 64, 1240)
W.placed['minecraft:overworld|1240|64|1240'] = 'minecraft:dirt'
bob.dim = OW; bob.x = 1238.5; bob.y = 65; bob.z = 1240.5; advance(12); bob.x = 1242.5; advance(12)
ok('a trap whose block was replaced does nothing and is dropped', bob.x == 1242.5 && !DB().traps['minecraft:overworld|1240|64|1240'])
// a hand-made tp item with no destination isn't a trap
placeAs(alice, stack('minecraft:stone', 1, '{trollcraft:{trap:"tp"}}'), 1250, 64, 1250)
ok('a Teleport Trap item without a destination registers nothing', !DB().traps['minecraft:overworld|1250|64|1250'])
// limit
for (let i = 0; i < 10; i++) placeAs(alice, tp3(), 1300 + i, 64, 1400)
const overTp = placeAs(alice, tp3(), 1311, 64, 1400)
ok('the 11th Teleport Trap is refused (10 per player)', overTp.cancelled && !DB().traps['minecraft:overworld|1311|64|1400'])
cmd('bm traps clear Alice', admin)
// the chat shop line
alice.inbox = []
cmd('blackmarket chatshop', alice)
ok('the chat shop lists the Teleport Trap with a [BUY] that fills in /bmbuy tpblock', /Teleport Trap/.test(text(alice)) && /"suggest_command","value":"\/bmbuy tpblock "/.test(text(alice)))

// ======================= The window and the captured inventory =======================
openWin(alice)
const heldCoins = coinsOf(alice)
ok('(window open: KubeJS has her inventory away)', !!alice._captured && alice.inventory.slots.slice(0, 36).every(st => st.count <= 0))
ok('the main page counts the real coins', slotName(alice, 0, 5) == 'You carry ' + heldCoins + ' Hush Coins', slotName(alice, 0, 5))
guiClick(alice, 6, 0)
ok('after a page change the inventory is back while the page is built, then away again', /whose head/.test(alice.gui.title) && !!alice._captured && coinsOf(alice) == heldCoins)
fire('hurt', { entity: alice, source: { getDirectEntity: () => null, actual: entity('minecraft:zombie', OW, 0, 0, 0, []) }, cancel() { throw new Exit() } })
advance(1)
ok('taking damage closes the shop window and the inventory comes back at the end of the tick', alice.gui == null && !alice._captured && coinsOf(alice) == heldCoins && alice.inventory.slots.slice(0, 36).some(st => st.count > 0))

// ----- if the window can't be closed, nothing is bought on the empty inventory -----
openWin(alice)
const keepClose = alice.closeMenu
alice.closeMenu = () => { throw new Error('Cannot find function closeMenu') }
cw = coinsOf(alice); alice.inbox = []
guiClick(alice, 2, 3); advance(2)
ok('a window that won\'t close: the purchase is skipped with a message, no coins taken, nothing given', coinsOf(alice) == cw && /didn't close properly/.test(text(alice)) && !/Itching Powder costs/.test(text(alice)), text(alice))
alice.closeMenu = keepClose
alice.closeMenu(); advance(1)
ok('... and once it closes, the inventory is all back', coinsOf(alice) == cw && !alice._captured)

// ----- /bm debug window -----
admin.inbox = []
cmd('bm debug window', admin)
advance(6)
ok('/bm debug window reports each step', ['before', 'window opened', 'tick 1', 'window closed', 'tick 2', 'tick 2, reopened', 'tick 4, closed again'].every(k => text(admin).indexOf(k) >= 0) && admin.gui == null, text(admin))
console.log(text(admin).split('\n').filter(l => /BM debug/.test(l)).join('\n'))

console.log(W.logs.filter(l => /^E /.test(l)).join('\n') || '(no errors logged)')
console.log(fails ? fails + ' FAILED' : 'ALL PASSED')
