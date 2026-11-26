// Run with: node tools/tests/run_all.js blood_pool   (or node tools/tests/suites/blood_pool.test.js)
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

const OW = 'minecraft:overworld', NE = 'minecraft:the_nether', EN = 'minecraft:the_end'
const W = { files: {}, placed: {}, explosions: [], time: 1.7e12, tick: 0, q: [], cmds: [], logs: [], drops: [], persistent: {}, entities: [], recipes: [], dayTime: 15000 }
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
  p._stages = new Set()
  p.stages = { has: s => p._stages.has(s), add: s => { p._stages.add(s); return true }, remove: s => { p._stages.delete(s); return true } }
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
    if (p._menu) return p._menu
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
  // What the game holds after a reload: only KubeJS's recipe types carry a result check. W.forceVanilla models a
  // recipe that stayed vanilla, W.brokenRecipes one that failed to load.
  getRecipeManager: () => ({ getRecipes: () => {
    const removed = id => (W.removedRecipes || []).some(f => f.id && (f.id === id || (/^re:/.test(f.id) && new RegExp(f.id.slice(3)).test(id))))
    const live = (id, type, gate) => {
      const o = { getId: () => id }
      if (/^kubejs:/.test(type) && !(W.forceVanilla || {})[id]) o.kjs$getModifyResult = () => gate || null
      return o
    }
    return (W.mockRecipes || []).filter(r => !removed(r.id)).map(r => live(r.id, r.getType(), r.gate))
      .concat((W.addedRecipes || []).map(r => live(r.rid, r.type, r.gate)))
      .filter(o => !(W.brokenRecipes || {})[o.getId()])
  } }),
  getPlayerList: () => ({ getPlayer: u => players.find(p => p.online && p.uuid == u) || null }),
  getProfileCache: () => ({ get: () => { throw new Error('The choice of Java method GameProfileCache.get is ambiguous') } }),   // as on a real server (2026-11-25)
  persistentData: { getString: k => W.persistent[k] || '', putString: (k, v) => { W.persistent[k] = String(v) }, putBoolean: (k, v) => { W.persistent[k] = !!v }, getBoolean: k => !!W.persistent[k] },
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
    if ((m = c.match(/^execute in (\S+) run fill (\S+) (\S+) (\S+) (\S+) (\S+) (\S+) (\S+)$/))) {
      if ((W.failBlocks || []).indexOf(m[8]) >= 0) return 0
      const n = m.slice(2, 8).map(Number)
      let k = 0
      for (let x = Math.min(n[0], n[3]); x <= Math.max(n[0], n[3]); x++) for (let y = Math.min(n[1], n[4]); y <= Math.max(n[1], n[4]); y++) for (let z = Math.min(n[2], n[5]); z <= Math.max(n[2], n[5]); z++) { W.placed[m[1] + '|' + x + '|' + y + '|' + z] = m[8]; k++ }
      return k
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
  'net.minecraftforge.common.ForgeHooks': { getCraftingPlayer: () => W.craftingPlayer || null },
  'net.minecraft.network.chat.Component$Serializer': { fromJson: () => { throw new Error('ambiguous') }, fromJsonLenient: s => ({ json: s }) },
  'java.util.UUID': { fromString: s => s },
  // java.time, as the tithe uses it: the zone is a fixed UTC-5 here (Central daylight time).
  'java.time.ZoneId': { of: z => ({ z }) },
  'java.time.ZonedDateTime': { now: zone => { W.zoneAsked = zone.z; const mk = ms => ({ minusHours: h => mk(ms - h * 3600000), toLocalDate: () => ({ toString: () => new Date(ms).toISOString().slice(0, 10) }) }); return mk(W.time - 5 * 3600000) } },
  'net.minecraft.world.level.Level$ExplosionInteraction': { NONE: 'NONE', TNT: 'TNT' },
  'net.minecraft.nbt.StringTag': { valueOf: s => s },
  'com.mojang.brigadier.arguments.StringArgumentType': { word: () => 'word', greedyString: () => 'greedy', getString: (ctx, n) => ctx.args[n] },
  // Curios 5.14.1: getCuriosInventory -> LazyOptional<ICuriosItemHandler>; a player's p.curios is its equipped handler.
  'top.theillusivec4.curios.api.CuriosApi': { getCuriosInventory: p => ({ resolve: () => p.curios
    ? { isPresent: () => true, get: () => ({ getEquippedCurios: () => p.curios }) } : { isPresent: () => false } }) },
})[n] || (() => { throw new Error('no class ' + n) })() }
const mkText = t => ({ text: String(t), append(o) { this.text += o.text; return this } })
const Text = { red: mkText, gold: mkText, yellow: mkText, of: mkText, lightPurple: mkText }
// KubeJS hands back an empty stack for an item that is not registered, which W.missingItems models.
const Item = { of: (id, a, b) => (W.missingItems || {})[String(id)] ? EMPTY()
  : (typeof a == 'string' ? stack(id, 1, a) : stack(id, a == null ? 1 : a, b || null)), empty: EMPTY() }
const Ingredient = { of: id => ({ id, getItemIds: () => { const t = String(id).replace(/^#/, ''); const l = (W.tagItems || {})[t] || []; return { toArray: () => l.slice() } } }), custom: (base, pred) => ({ base, pred, custom: true }) }
function fire(n, ev) { for (const h of handlers[n] || []) { try { h(ev) } catch (e) { if (e instanceof Exit) { ev.cancelled = true; return } throw e } } }
function fireSpawn(e) { const ev = { entity: e, cancel() { throw new Exit() } }; fire('spawned', ev); return !ev.cancelled }
const node = (n, type) => ({ n, type, ch: [], getChild(c) { return this.ch.find(x => x.n == c) || null }, then(c) { this.ch.push(c); return this }, requires(f) { this.req = f; return this }, executes(f) { this.f = f; return this }, redirect(t) { this.redir = t; return this } })
const glob = { Factions }
const bmState = () => glob.blackMarketState
function loadOne(src) {
  const on = name => f => { (handlers[name] = handlers[name] || []).push(f) }
  const ev = {
    commands: { literal: n => node(n, 'lit'), argument: (n, t) => node(n, t) },
    arguments: { PLAYER: { create: () => 'player', getResult: (ctx, n) => ctx.args[n] }, INTEGER: { create: () => 'int', getResult: (ctx, n) => ctx.args[n] }, BLOCK_POS: { create: () => 'blockpos', getResult: (ctx, n) => ctx.args[n] } },
    register: r => { roots[r.n] = r; return r },
  }
  new Function('PlayerEvents', 'EntityEvents', 'ServerEvents', 'ItemEvents', 'BlockEvents', 'Utils', 'Text', 'Item', 'Ingredient', 'console', 'global', 'Java', 'Date', 'JsonIO', src)(
    { loggedIn: on('loggedIn'), loggedOut: on('loggedOut'), chestOpened: on('chestOpened'), inventoryChanged: on('inventoryChanged') }, { hurt: on('hurt'), death: on('death'), spawned: on('spawned') },
    { loaded: on('loaded'), tick: on('tick'), commandRegistry: f => f(ev), tags: (reg, f) => f({ add: (t, v) => { (W.addedTags = W.addedTags || {})[reg + ' ' + t] = v } }), recipes: f => { (W.mockRecipes || []).forEach(r => { r.type = r.baseType; r.gate = null }); const rev = { replaceInput: (filter, from, to) => W.recipes.push({ filter, from, to }), remove: filt => { (W.removedRecipes = W.removedRecipes || []).push(JSON.parse(JSON.stringify(filt, (k, v) => v instanceof RegExp ? 're:' + v.source : v))) },
      forEachRecipe: (filt, cb) => {
        W.forEachCalls = (W.forEachCalls || 0) + 1
        const all = filt === '*', types = all ? [] : (Array.isArray(filt) ? filt : [filt]).map(x => x.type)
        const removedNow = id => (W.removedRecipes || []).some(f => f.id && (f.id === id || (/^re:/.test(f.id) && new RegExp(f.id.slice(3)).test(id))))
        ;(W.mockRecipes || []).forEach(r => { if ((all || types.indexOf(r.getType()) >= 0) && !removedNow(r.id)) cb(r) })
      },
      custom: j => { const c = { json: j, id(x) { c.rid = x; return c } }; (W.customRecipes = W.customRecipes || []).push(c); return c },
      shaped: (result, pattern, key) => {
        const r = { id: null, type: 'kubejs:shaped', result, pattern, key, mirror: true, gate: null, staged: null,
          getType() { return this.type },
          noMirror() { this.mirror = false; return this }, id(x) { this.id = x; return this }, modifyResult(cb) { this.gate = cb; return this } }
        r.id = function (x) { r.rid = x; return r }
        ;(W.addedRecipes = W.addedRecipes || []).push(r)
        return r
      } }; rev.shaped.idString = 'kubejs:shaped'; rev.shapeless = Object.assign(() => { throw new Error('nothing adds shapeless recipes') }, { idString: 'kubejs:shapeless' }); f(rev) } },
    { rightClicked: on('itemRightClicked'), entityInteracted: on('entityInteracted'), foodEaten: on('foodEaten'), pickedUp: on('pickedUp') }, { rightClicked: on('blockRightClicked'), placed: on('blockPlaced'), broken: on('blockBroken') },
    Utils, Text, Item, Ingredient,
    { info: m => W.logs.push('I ' + m), warn: m => W.logs.push('W ' + m), error: m => W.logs.push('E ' + m) }, glob, Java, Datex,
    { write: (path, obj) => { W.files[path] = JSON.parse(JSON.stringify(obj)) }, read: path => { const o = W.files[path]; if (!o) throw new Error('no file ' + path); return { get: k => o[k] } } })
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
  loadOne(global.POOL_SRC)
  if (global.TANK_SRC) loadOne(global.TANK_SRC)
  if (global.GATES_SRC) loadOne(global.GATES_SRC)
}
const replies = []
function cmd(line, as) {
  if (as && as.gui) { as.closeMenu(); advance(1) }   // nobody types a command with a window open
  const toks = line.replace(/^\//, '').split(' ')
  let n = roots[toks[0]], args = {}
  if (!n) throw new Error('no command ' + toks[0])
  const src = { server, getLevel: () => levels[as ? as.dim : OW], getPlayer: () => as || null, hasPermission: lvl => !as || as.op, sendSystemMessage: t => replies.push(t.json || t.text) }
  if (n.req && !n.req(src)) { replies.push('DENIED'); return 0 }
  if (n.redir) n = n.redir
  for (let i = 1; i < toks.length; i++) {
    let lit = n.ch.find(c => c.type == 'lit' && c.n == toks[i])
    if (lit) { if (lit.req && !lit.req(src)) { replies.push('DENIED'); return 0 } n = lit; continue }
    let a = n.ch.find(c => c.type != 'lit')
    if (!a) throw new Error('bad command ' + line + ' at ' + toks[i])
    if (a.type == 'greedy') { args[a.n] = toks.slice(i).join(' '); n = a; break }
    if (a.type == 'blockpos') { const v = toks.slice(i, i + 3).map((t, j) => /^~/.test(t) ? Math.floor([as.x, as.y, as.z][j]) + Number(t.slice(1) || 0) : Number(t)); args[a.n] = { getX: () => v[0], getY: () => v[1], getZ: () => v[2] }; i += 2; n = a; continue }
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
// part2/blood_pool.js with the real tiers + part2/dimension_gates.js
const PDB = () => JSON.parse(W.persistent.blood_pool || '{}')
const cmdsSince = n => W.cmds.slice(n).map(x => x.c)
const said = n => cmdsSince(n).filter(c => /^tellraw @a /.test(c)).map(c => flat(c.replace(/^tellraw @a /, '')))
global.POOL_SRC = fs.readFileSync(REPO_ROOT + '/tools/kubejs/server_scripts/part2/blood_pool.js', 'utf8')
global.TANK_SRC = fs.readFileSync(REPO_ROOT + '/tools/kubejs/server_scripts/part2/blood_tank.js', 'utf8')
global.GATES_SRC = fs.readFileSync(REPO_ROOT + '/tools/kubejs/server_scripts/part2/dimension_gates.js', 'utf8')
W.time = Date.UTC(2026, 10, 2, 15, 0, 0)   // Nov 2, 10 am Central
W.removedRecipes = []
Utils.server = server
loadAll()
fire('loaded', { server })
const mk = (n, x, isOp) => { const p = player(n, 'unregistered', OW, x, 65, 100.5, isOp); p.setStatusMessage = () => {}; return p }
const admin = mk('Admin', 1000.5, true), ana = mk('Ana', 1001.5), bo = mk('Bo', 1002.5)
players.push(admin, ana, bo)
players.forEach(p => fire('loggedIn', { player: p }))
advance(60)
const rem = () => (W.removedRecipes || []).map(f => JSON.stringify(f))
const has = s => rem().indexOf(s) >= 0
const reload = () => { W.removedRecipes = []; loadAll(); fire('loaded', { server }); advance(5) }
const errors = () => W.logs.filter(l => /^E /.test(l))

// ----- tier 0: what's sealed -----
ok('tier 0: Create and Mystical Agriculture sealed (namespace and output)', has('{"output":"@create"}') && has('{"mod":"create"}') && has('{"output":"@mysticalagriculture"}'))
ok('tier 0: Twilight Forest and Tinkers are never sealed as namespaces', !rem().some(r => /@twilightforest|"mod":"twilightforest"|@tconstruct|"mod":"tconstruct"/.test(r)))
ok('tier 0: TF chestplates and blocks are sealed', has('{"output":"twilightforest:steeleaf_chestplate"}') && has('{"output":"twilightforest:knightmetal_chestplate"}') &&
  has('{"output":"twilightforest:fiery_chestplate"}') && has('{"output":"twilightforest:yeti_chestplate"}') && has('{"output":"twilightforest:arctic_chestplate"}') && has('{"output":"twilightforest:carminite_block"}'))
ok('tier 0: ironwood is open', !rem().some(r => /ironwood/.test(r)))
ok('tier 0: recipe rules removed by id (regex and exact)', rem().some(r => /"id":"re:\^tconstruct:tools.*materials.*\(steel\)/.test(r)) && has('{"id":"agricraft:diamond"}') && has('{"id":"iceandfire:dragonforge/dragonsteel_fire_ingot"}'))
ok('tier 0: the steel tag and the Ender Eye are sealed', has('{"output":"#forge:ingots/steel"}') && has('{"output":"minecraft:ender_eye"}'))
// Secondary outputs are invisible to KubeJS, so the create namespace lock misses these three.
// /bloodpool audit at Tier 0 reported them as "recipes still making a sealed item".
ok('tier 0: Create Aquatic Ambitions crushing recipes leaking Tier 1 Create items are removed by id',
  has('{"id":"create_aquatic_ambitions:crushing/prismarine_bricks_to_lapis_and_copper"}') &&
  has('{"id":"create_aquatic_ambitions:crushing/nautilus_shards"}') &&
  has('{"id":"create_aquatic_ambitions:crushing/prismarine_to_lapis"}'))
ok('no errors while loading', errors().length == 0, errors().join(' | '))

// ----- tier 4: a mod opens, its later items stay sealed -----
cmd('bloodpool settier 4', admin); advance(25); reload()
ok('tier 4: Create open (no namespace removal)', !has('{"output":"@create"}') && !has('{"mod":"create"}'))
ok('... but its later items stay sealed (trains at 7)', has('{"output":"create:sturdy_sheet"}') && has('{"output":"create:track"}'))
ok('... and its tier-3/4 items are back', !has('{"output":"create:brass_casing"}') && !has('{"output":"create:precision_mechanism"}'))
ok('tier 4: steel and steeleaf recipe rules lifted; cobalt and knightmetal still sealed',
  !rem().some(r => /\(steel\)|osmium\|steeleaf/.test(r)) && rem().some(r => /cobalt\|scorched_stone\|knightmetal/.test(r)))
ok('tier 4: TF steeleaf chestplate open, knightmetal chestplate sealed', !has('{"output":"twilightforest:steeleaf_chestplate"}') && has('{"output":"twilightforest:knightmetal_chestplate"}'))
ok('tier 4: the Aquatic Ambitions crushing rules are lifted (their items opened at Tier 1)',
  !rem().some(r => /create_aquatic_ambitions:crushing/.test(r)))
ok('API: tierOf follows item > mod', glob.BloodPool.tierOf('create:track') == 7 && glob.BloodPool.tierOf('create:andesite_casing') == 1 && glob.BloodPool.tierOf('twilightforest:ironwood_ingot') == 0)
replies.length = 0
cmd('bloodpool tiers', bo)
ok('/bloodpool tiers lists recipe rules and the dimensions', replies.length == 12 && /Tier 3 .*recipe rules.*the Nether/.test(flat(replies[2])) && /Tier 9 .*the End/.test(flat(replies[8])) && /Tier 1 · A Trickle · 20,000 Drops/.test(flat(replies[0])), replies.map(flat).join(' | '))

// ----- the Potato Tithe -----
const give = (p, id, n) => { while (n > 0) { let k = Math.min(64, n); p.give(stack(id, k)); n -= k } }
const countOf = (p, id) => realSlots(p).slice(0, 36).filter(s => s.count > 0 && s.id == id).reduce((a, s) => a + s.count, 0)
const drops0 = PDB().drops
give(ana, 'minecraft:potato', 100); give(ana, 'quark:potato_crate', 2)
cmd('bloodpool tithe', ana)
ok('tithe everything: 118 potatoes (100 loose + 2 crates) = 29 Drops; 116 taken, 2 change back as potatoes',
  PDB().drops == drops0 + 29 && PDB().from.potatoes == 29 && countOf(ana, 'minecraft:potato') == 2 && countOf(ana, 'quark:potato_crate') == 0, flat(lastReply()))
ok('... credited to the player', PDB().contributors['ana-1111'] && PDB().contributors['ana-1111'].drops == 29)
cmd('bloodpool tithe', ana); ok('2 potatoes: too few for a Drop, nothing taken', /in fours/.test(flat(lastReply())) && countOf(ana, 'minecraft:potato') == 2)
cmd('bloodpool tithe -5', ana); ok('a negative amount is refused', /stays in the Pool/.test(flat(lastReply())) && countOf(ana, 'minecraft:potato') == 2)
// The Shrine's Potato King's Potatoes (marked) are for its altar only: the tithe doesn't count or take them.
ana.give(stack('minecraft:potato', 8, '{trollcraft:{kingspotato:1b}}'))
const marked = () => realSlots(ana).slice(0, 36).filter(s => s.count > 0 && s.parsed && s.parsed.trollcraft).reduce((a, s) => a + s.count, 0)
cmd('bloodpool tithe', ana)
ok('the Shrine\'s Potato King\'s Potatoes don\'t count for the tithe: 2 plain ones are still too few, and the 8 are kept', /in fours/.test(flat(lastReply())) && marked() == 8, flat(lastReply()))
realSlots(ana).forEach(s => { if (s.parsed && s.parsed.trollcraft) s.count = 0 })
give(bo, 'minecraft:potato', 50)
cmd('bloodpool tithe 41', bo)
ok('tithe 41: 10 Drops, 40 potatoes taken (whole Drops only)', countOf(bo, 'minecraft:potato') == 10 && /40 potatoes spilled into the Pool/.test(flat(lastReply())), flat(lastReply()))
cmd('bloodpool tithe 500', bo); ok('asking for more than you carry is refused', /only carry 10/.test(flat(lastReply())))
ok('the tithe day uses America/Chicago', W.zoneAsked == 'America/Chicago')
// fill the daily quota: 36 stacks of crates a trip (20,736 potatoes = 5,184 Drops)
let trips = 0
while (trips < 8) {
  give(bo, 'thermal:potato_block', 64 * 36 - 64)   // 35 stacks, the 10 potatoes keep a slot
  cmd('bloodpool tithe', bo)
  trips++
  if (/day's tithe|drunk its fill/.test(flat(lastReply()))) break
}
const today = PDB().potatoDrops
ok('the quota stops at 30,000 Drops for the day (and says so)', today == 30000 && /fills the day's tithe/.test(flat(lastReply())), today + ' ' + flat(lastReply()))
cmd('bloodpool tithe', bo)
ok('a full quota refuses, and nothing is taken', /drunk its fill of potatoes today/.test(flat(lastReply())) && PDB().potatoDrops == 30000)
W.time = Date.UTC(2026, 10, 3, 8, 59, 0)   // Nov 3, 3:59 am Central: still Nov 2's tithe day
cmd('bloodpool tithe', bo); ok('3:59 am: still the same tithe day', /drunk its fill/.test(flat(lastReply())))
W.time = Date.UTC(2026, 10, 3, 9, 1, 0)    // 4:01 am Central: a new day
cmd('bloodpool tithe', bo); ok('4:01 am: the quota is open again', PDB().potatoDrops > 0 && PDB().potatoDrops < 30000 && PDB().potatoDay == '2026-11-03', flat(lastReply()))

// ----- cross-mod compat recipes (the in-game audit at Tier 5 found 134 leaking sealed items) -----
// Their results are tags or secondary outputs, so KubeJS cannot see them and the item locks miss them.
// COMPAT(n) seals each by exact id until the tier of the item it leaks.
const remById = id => (W.removedRecipes || []).some(f => typeof f.id == 'string' &&
  (f.id === id || (/^re:/.test(f.id) && new RegExp(f.id.slice(3)).test(id))))
cmd('bloodpool settier 5', admin); advance(25); reload()
ok('tier 5: compat recipes leaking tiers 6-11 are removed by id',
  remById('enderio:smelting/alexscaves/furnace/cooked_lanternfish_smelting') &&                  // tier 6
  remById('botania:elven_trade/elementium') &&                                                   // tier 6
  remById('thermal:compat/redstone_arsenal/smelter_rsa_flux_dust') &&                            // tier 7
  remById('enderio:smelting/taiga/smelting/imperomite_dust') &&                                  // tier 8
  remById('thermal:compat/tconstruct/smelter_alloy_tconstruct_queens_slime_ingot') &&            // tier 8
  remById('enderio:smelting/bigreactors/smelting/blutonium_from_dust') &&                        // tier 10
  remById('enderio:smelting/draconicevolution/components/awakened_draconium_ingot_from_dust'))   // tier 11
// Exact ids, not a per-mod regex: Ender IO's bigreactors smelting spans tiers 6 and 10, so at tier 6
// the graphite and cyanite recipes must lift while blutonium and magentite stay sealed until 10.
cmd('bloodpool settier 6', admin); advance(25); reload()
ok('tier 6: a split-tier compat prefix lifts only its tier-6 half',
  !remById('enderio:smelting/bigreactors/smelting/graphite_from_coal') &&
  !remById('enderio:smelting/bigreactors/smelting/cyanite_from_dust') &&
  remById('enderio:smelting/bigreactors/smelting/blutonium_from_dust') &&
  remById('enderio:smelting/bigreactors/smelting/magentite_from_dust'))
cmd('bloodpool settier 9', admin); advance(25); reload()
ok('tier 9: tier 6-8 compat rules lift, tier 10 and 11 stay sealed',
  !remById('enderio:smelting/alexscaves/furnace/cooked_lanternfish_smelting') &&
  !remById('botania:elven_trade/elementium') &&
  !remById('enderio:smelting/taiga/smelting/imperomite_dust') &&
  remById('enderio:smelting/bigreactors/smelting/blutonium_from_dust') &&
  remById('enderio:smelting/draconicevolution/components/awakened_draconium_ingot_from_dust'))

// ----- netherite opens at Tier 5 (owner decision); its crops stay at Tier 8 -----
const NETHERITE_ITEMS = ['minecraft:netherite_scrap', 'minecraft:netherite_ingot', 'minecraft:netherite_block', 'minecraft:netherite_pickaxe',
  'minecraft:netherite_chestplate', 'tconstruct:debris_nugget', 'mekanism:dust_netherite', 'createdeco:netherite_sheet',
  'bygonenether:netherite_scrap_nugget', 'create:netherite_backtank', 'farmersdelight:netherite_knife']
const NETHERITE_ROUTES = ['tconstruct:smeltery/casting/metal/netherite/scrap_gold_cast', 'tconstruct:smeltery/casting/metal/netherite/ingot_sand_cast',
  'tconstruct:smeltery/melting/metal/netherite/ingot', 'tconstruct:smeltery/melting/metal/molten_debris/ore', 'tconstruct:smeltery/alloys/molten_netherite',
  'tconstruct:tools/modifiers/upgrade/netherite', 'tconstruct:tools/modifiers/salvage/upgrade/netherite',
  'mekanism:processing/netherite/ancient_debris_to_scrap', 'mekanism:processing/netherite/dust_to_ancient_debris',
  'immersiveengineering:arcfurnace/netherite_scrap', 'immersiveengineering:mineral/ancient_debris', 'botania:orechid_ignem/ancient_debris',
  'bygonenether:crushing/withered_stone', 'bygonenether:splashing/crushed_withered_debris', 'bygonenether:pressing/netherite_scrap_ingot']
const NETHERITE_CROPS = ['agricraft:netherite_scrap', 'mysticalagriculture:essence/minecraft/netherite_ingot', 'mysticalagriculture:seed/infusion/netherite']
cmd('bloodpool settier 4', admin); advance(25); reload()
ok('tier 4: netherite items are sealed until Tier 5', NETHERITE_ITEMS.every(i => glob.BloodPool.tierOf(i) == 5 && glob.BloodPool.isLocked(i)),
  NETHERITE_ITEMS.filter(i => glob.BloodPool.tierOf(i) != 5).join())
ok('tier 4: every other route to netherite is removed', NETHERITE_ROUTES.every(remById), NETHERITE_ROUTES.filter(i => !remById(i)).join())
ok('tier 4: unrelated recipes stay, like the rest of Tinkers\' melting', !remById('tconstruct:smeltery/melting/metal/iron/ingot'))
ok('mining debris and the smithing template aren\'t locked', glob.BloodPool.tierOf('minecraft:ancient_debris') == 0 && glob.BloodPool.tierOf('minecraft:netherite_upgrade_smithing_template') == 0)
cmd('bloodpool settier 5', admin); advance(25); reload()
ok('tier 5: netherite opens', NETHERITE_ITEMS.every(i => !glob.BloodPool.isLocked(i)) && !NETHERITE_ROUTES.some(remById), NETHERITE_ROUTES.filter(remById).join())
ok('tier 5: netherite crops stay sealed until Tier 8', NETHERITE_CROPS.every(remById), NETHERITE_CROPS.filter(i => !remById(i)).join())
cmd('bloodpool settier 8', admin); advance(25); reload()
ok('tier 8: netherite crops open', !NETHERITE_CROPS.some(remById))

// ----- dimension gates -----
cmd('bloodpool settier 2', admin); advance(25); reload()
ok('tier 2: the Nether portal switch is off (global and saved)', glob.netherPortalsUnlocked === false && W.persistent.trollcraft_nether_unlocked === false)
ana.dim = EN; ana.x = 0; ana.y = 60; ana.z = 0
admin.dim = NE
advance(25)
ok('a player in the sealed End is sent back to their last Overworld spot', ana.dim == OW && Math.floor(ana.x) == 1001 && /End is sealed until the Blood Pool reaches Tier 9/.test(text(ana)))
ok('an op in the sealed Nether is left alone', admin.dim == NE)
bo.dim = NE; bo.x = 5; advance(25)
ok('a player in the sealed Nether is sent back', bo.dim == OW && /Nether is sealed until the Blood Pool reaches Tier 3/.test(text(bo)))
c0 = W.cmds.length
cmd('bloodpool set 120000', admin)
cmd('bloodpool unlock', admin)
ok('unlocking tier 3 opens the Nether at once, with the Ministry line', PDB().tier == 3 && glob.netherPortalsUnlocked === true && W.persistent.trollcraft_nether_unlocked === true &&
  said(c0).some(l => /seal on the Nether shatters/.test(l)), said(c0).join(' | '))
bo.dim = NE; advance(25)
ok('tier 3: players stay in the Nether', bo.dim == NE)
cmd('bloodpool settier 9', admin); advance(25)
ana.dim = EN; advance(25)
ok('tier 9: players stay in the End; settier is quiet (no announcement)', ana.dim == EN && glob.DimensionGates.isOpen('minecraft:the_end'))
cmd('dimensiongates', admin); ok('/dimensiongates reports', /Nether: open\. End: open/.test(flat(lastReply())), flat(lastReply()))
cmd('dimensiongates', bo); ok('/dimensiongates is op-only', lastReply() == 'DENIED')
cmd('bloodpool settier 0', admin); advance(25); reload()
ok('settier 0 seals both again', glob.netherPortalsUnlocked === false && !glob.DimensionGates.isOpen('minecraft:the_end'))
const loops = W.q.length
reload(); reload(); advance(100)
ok('/reload does not stack the gate loops', W.q.length <= loops + 2, loops + ' -> ' + W.q.length)


// =====================================================================
// part2/blood_tank.js
const at = (x, y, z, d) => W.placed[(d || OW) + '|' + x + '|' + y + '|' + z] || blockAt(d || OW, x, y, z)
const layersOf = (cx, cy, cz) => { let n = 0; for (let i = 1; i <= 6; i++) if (/evilcraft:blood|red_stained_glass/.test(at(cx, cy + i, cz))) n++; return n }
const TX = 1010, TY = 65, TZ = 120
admin.dim = OW; admin.x = 1005.5; admin.y = 65; admin.z = 118.5
cmd('bloodpool settier 0', admin); advance(25); reload()
cmd('bloodtank build ' + TX + ' ' + TY + ' ' + TZ, admin)
ok('build: floor and roof are chiseled nether bricks', at(TX - 2, TY, TZ - 2) == 'minecraft:chiseled_nether_bricks' && at(TX + 2, TY + 7, TZ + 2) == 'minecraft:chiseled_nether_bricks' && at(TX, TY, TZ) == 'minecraft:chiseled_nether_bricks')
ok('build: corners are nether gold ore, sides glass, chamber empty at tier 0',
  at(TX - 2, TY + 3, TZ + 2) == 'minecraft:nether_gold_ore' && at(TX + 2, TY + 6, TZ - 2) == 'minecraft:nether_gold_ore' &&
  at(TX, TY + 3, TZ - 2) == 'minecraft:glass' && at(TX + 2, TY + 1, TZ + 1) == 'minecraft:glass' && at(TX, TY + 4, TZ) == 'minecraft:air' && layersOf(TX, TY, TZ) == 0, flat(lastReply()))
ok('build registers it', /Tank 1 registered/.test(flat(lastReply())) && glob.BloodTank.count() == 1)
cmd('bloodtank build ' + TX + ' ' + TY + ' ' + TZ, admin); ok('the same spot twice is refused', /already registered/.test(flat(lastReply())))
const tankAt = t => { cmd('bloodpool settier ' + t, admin); advance(25); return layersOf(TX, TY, TZ) }
ok('tier 1: 0 layers; tier 2: 1; tier 5: 2; tier 12: all 6', tankAt(1) == 0 && tankAt(2) == 1 && tankAt(5) == 2 && tankAt(12) == 6)
ok('blood is EvilCraft blood, air above the fill', (tankAt(4), at(TX, TY + 2, TZ) == 'evilcraft:blood' && at(TX + 1, TY + 1, TZ - 1) == 'evilcraft:blood' && at(TX, TY + 3, TZ) == 'minecraft:air'))
ok('settier 0 drains it', tankAt(0) == 0 && at(TX, TY + 1, TZ) == 'minecraft:air')
c0 = W.cmds.length
cmd('bloodpool set 120000', admin); cmd('bloodpool unlock', admin); cmd('bloodpool unlock', admin); advance(25)
ok('an unlock that adds a layer plays the rising effect', layersOf(TX, TY, TZ) == 1 && cmdsSince(c0).some(c => /bubble_column/.test(c)) && cmdsSince(c0).some(c => /particle minecraft:dust/.test(c)))
// fallback
W.failBlocks = ['evilcraft:blood']
cmd('bloodpool settier 6', admin); advance(25)
ok('if EvilCraft blood can\'t be placed, red stained glass is used (once warned)', layersOf(TX, TY, TZ) == 3 && at(TX, TY + 1, TZ) == 'minecraft:red_stained_glass' && W.logs.some(l => /could not be placed; using minecraft:red_stained_glass/.test(l)))
W.failBlocks = []
// repair loop: someone empties a layer by hand (or the tank was unloaded at the unlock)
W.placed[OW + '|' + TX + '|' + (TY + 2) + '|' + TZ] = 'minecraft:air'
advance(10 * 20 + 5)
ok('the loop repairs a loaded tank that is out of step', layersOf(TX, TY, TZ) == 3)
// unloaded tank: nobody near
const old = { x: admin.x, z: admin.z }
players.forEach(p => { p.x += 5000 })
cmd('bloodpool settier 10', admin); advance(25)
ok('an unloaded tank is left alone at the unlock', layersOf(TX, TY, TZ) == 3)
players.forEach(p => { p.x -= 5000 })
advance(10 * 20 + 5)
ok('... and filled when a player comes near', layersOf(TX, TY, TZ) == 5)
// protection
const brk = (p, x, y, z) => { const ev = { player: p, block: { x, y, z, level: levels[OW], getDimension: () => OW, id: "minecraft:glass" }, cancel() { throw new Exit() } }; fire('blockBroken', ev); return !!ev.cancelled }
const plc = (p, x, y, z) => { const ev = { player: p, block: { x, y, z, level: levels[OW], getDimension: () => OW, id: "minecraft:glass" }, cancel() { throw new Exit() } }; fire('blockPlaced', ev); return !!ev.cancelled }
ok('a non-op can\'t break the glass or place on the roof; told why', brk(ana, TX, TY + 3, TZ - 2) && plc(ana, TX, TY + 7, TZ) && /The Blood Pool is sacred/.test(text(ana)))
ok('an op can; blocks outside the tank are fine', !brk(admin, TX, TY + 3, TZ - 2) && !brk(ana, TX + 3, TY + 1, TZ) && !brk(ana, TX, TY + 8, TZ))
// add: a hand-built tank
const HX = 1030
cmd('bloodtank add ' + HX + ' ' + TY + ' ' + TZ, admin)
ok('add on bare ground: refused, naming the first wrong block', /Not a tank yet: 1028 65 118 should be minecraft:chiseled_nether_bricks/.test(flat(lastReply())), flat(lastReply()))
cmd('bloodtank build ' + HX + ' ' + TY + ' ' + TZ, admin); cmd('bloodtank remove 2', admin)
W.placed[OW + '|' + (HX + 2) + '|' + (TY + 4) + '|' + (TZ - 2)] = 'minecraft:stone'
cmd('bloodtank add ' + HX + ' ' + TY + ' ' + TZ, admin)
ok('a wrong corner is named', /1032 69 118 should be minecraft:nether_gold_ore \(found minecraft:stone\)/.test(flat(lastReply())), flat(lastReply()))
W.placed[OW + '|' + (HX + 2) + '|' + (TY + 4) + '|' + (TZ - 2)] = 'minecraft:nether_gold_ore'
cmd('bloodtank add ~25 ~ ~2', admin)
ok('add with ~ coordinates registers a correct hand-built tank and fills it', /Tank 2 registered at minecraft:overworld 1030 65 120: 5 of 6 layers/.test(flat(lastReply())) && layersOf(1030, 65, 120) == 5, flat(lastReply()))
replies.length = 0
cmd('bloodtank list', admin); ok('/bloodtank list', replies.length == 3 && /5 of 6 layers/.test(flat(replies[0])), replies.map(flat).join(' | '))
cmd('bloodtank list', ana); ok('/bloodtank is op-only', lastReply() == 'DENIED')
const qt = W.q.length; reload(); reload(); advance(400)
ok('/reload does not stack the tank loop', W.q.length <= qt + 3, qt + ' -> ' + W.q.length)


// =====================================================================
// The Potato War
const recipe = (id, type, out, json) => ({ id, type, baseType: type, out: out ? stack(out, 1) : null, staged: null, gate: null, getId() { return this.id }, getType() { return typeof this.type == 'string' ? this.type : this.type.idString },
  getOriginalRecipeResult() { return this.out || EMPTY() }, json: JSON.stringify(json || {}),
  stage(s) { this.staged = s; return this }, modifyResult(cb) { this.gate = cb; return this } })
const shapedJson = (result, key) => ({ pattern: ['EEE', 'E E', 'EEE'], key: key || { E: { item: 'mysticalagriculture:steeleaf_essence' } }, result })
// The rank a recipe's result check asks for: the lowest rank whose player gets the result.
const probe = n => { const s = new Set(); for (let i = 1; i <= n; i++) s.add('potato_standing_' + i); return { stages: { has: x => s.has(x) } } }
const gateTier = r => {
  if (!r.gate) return null
  // In the game a vanilla-format recipe ignores the check (seen on the test server, TEST_REPORT.md).
  if (!/^kubejs:/.test(typeof r.getType == 'function' ? r.getType() : r.type)) return null
  const res = stack('x:result', 1)
  for (let n = 0; n <= 11; n++) { const pl = probe(n); if (r.gate({ getPlayer: () => pl, getMenu: () => null }, res) === res) return 'potato_standing_' + n }
  return 'never'
}
W.mockRecipes = [
  recipe('create:crafting/kinetics/cogwheel', 'minecraft:crafting_shaped', 'create:cogwheel'),            // Create, tier 1
  recipe('create:crafting/materials/brass_casing', 'minecraft:crafting_shaped', 'create:brass_casing'),   // listed item, tier 3
  recipe('mekanism:shaft_compat', 'minecraft:crafting_shapeless', 'create:shaft'),                       // Mekanism's (4) recipe for a Create (1) item
  recipe('thermal:machine_frame', 'minecraft:crafting_shaped', 'thermal:machine_frame'),                   // tier 5
  recipe('minecraft:stick', 'minecraft:crafting_shaped', 'minecraft:stick'),                               // in no tier
  recipe('mysticalagriculture:essence/minecraft/iron_ingot', 'minecraft:crafting_shaped', 'minecraft:iron_ingot'),   // MA namespace, tier 1
  recipe('mysticalagriculture:essence/common/silver_ingot', 'minecraft:crafting_shaped', 'minecraft:gold_ingot'),    // recipe rule, tier 5
  recipe('mekanism:elite_control_circuit', 'minecraft:crafting_shaped', 'mekanism:elite_control_circuit'), // tier 6: sealed at 5
  recipe('create:mechanical_crafting/cogwheel', 'create:mechanical_crafting', 'create:cogwheel'),          // not a crafting table recipe
  recipe('hexerei:mixing_cauldron', 'minecraft:crafting_shaped', 'hexerei:mixing_cauldron'),               // listed item, tier 2
  recipe('thermal:machine_pulverizer', 'thermal:pulverizer', 'thermal:copper_dust'),                       // a machine: never staged
  // ore melting: a byproduct that goes, one that stays, and both in one recipe
  recipe('tconstruct:smeltery/melting/diamond/ore_singular', 'tconstruct:ore_melting', null, { type: 'tconstruct:ore_melting', byproducts: [{ amount: 90, fluid: 'tconstruct:molten_debris', rate: 'metal' }], conditions: [{ type: 'mantle:tag_combination_filled' }], ingredient: { tag: 'forge:ores/diamond' }, rate: 'gem', result: { amount: 100, fluid: 'tconstruct:molten_diamond' }, temperature: 1450, time: 197 }),
  recipe('tconstruct:smeltery/melting/metal/iron/raw', 'tconstruct:ore_melting', null, { type: 'tconstruct:ore_melting', byproducts: [{ amount: 30, fluid: 'tconstruct:molten_nickel', rate: 'metal' }], result: { amount: 90, fluid: 'tconstruct:molten_iron' } }),
  recipe('tconstruct:smeltery/melting/test/two_byproducts', 'tconstruct:ore_melting', null, { type: 'tconstruct:ore_melting', byproducts: [{ amount: 90, tag: 'tconstruct:molten_debris' }, { amount: 30, fluid: 'tconstruct:molten_gold' }], result: { amount: 90, fluid: 'tconstruct:molten_iron' } }),
  // mods' own crafting-table formats (converted)
  recipe('mysticalagriculture:essence/twilightforest/steeleaf_ingot', 'cucumber:shaped_no_mirror', null, shapedJson({ item: 'twilightforest:steeleaf_ingot', count: 4 })),
  recipe('mysticalagriculture:essence/common/titanium_ingot', 'cucumber:shaped_tag', null, shapedJson({ tag: 'forge:ingots/titanium', count: 2 })),
  recipe('mysticalagriculture:essence/common/nothing_ingot', 'cucumber:shaped_tag', null, shapedJson({ tag: 'forge:ingots/nothing', count: 2 })),
  recipe('mysticalagriculture:essence/chisel/marble', 'cucumber:shaped_no_mirror', null, shapedJson({ item: 'chisel:marble/raw', count: 16 })),
  recipe('mysticalagriculture:essence/minecraft/iron_ingot_mod', 'cucumber:shaped_no_mirror', null, shapedJson({ item: 'minecraft:iron_ingot', count: 6 })),
  recipe('mekanism:purification_chamber', 'mekanism:mek_data', null, shapedJson({ item: 'mekanism:purification_chamber' }, { E: { item: 'mekanism:enrichment_chamber' }, C: { tag: 'forge:circuits/advanced' } })),
  recipe('mekanism:energy_cube/advanced', 'mekanism:mek_data', null, shapedJson({ item: 'mekanism:advanced_energy_cube' }, { E: { item: 'mekanism:basic_energy_cube' } })),
  recipe('mekanism:factory/basic/smelting', 'mekanism:mek_data', null, shapedJson({ item: 'mekanism:basic_smelting_factory' }, { E: { item: 'mekanism:energized_smelter' } })),
  recipe('mekanism:jetpack_armored', 'mekanism:mek_data', null, shapedJson({ item: 'mekanism:jetpack_armored' }, { E: { item: 'mekanism:jetpack' } })),
  recipe('mekanism:jetpack', 'mekanism:mek_data', null, shapedJson({ item: 'mekanism:jetpack' }, { E: { item: 'mekanism:ingot_steel' } })),
  recipe('mekanism:odd', 'mekanism:mek_data', null, shapedJson({ item: 'mekanism:odd_thing' }, { E: { type: 'forge:nbt', item: 'mekanism:x', nbt: '{a:1}' } })),
  recipe('mekanism:qio_drive_array', 'mekanism:mek_data', null, shapedJson({ item: 'mekanism:qio_drive_array' }, { E: { item: 'mekanism:ingot_steel' } })),
  // for the in-game audit: a crafting-type recipe the rank check doesn't cover, and a machine that makes a sealed item
  recipe('thermal:crafting/fluid_thing', 'immersiveengineering:shaped_fluid', 'thermal:redstone_servo'),
  recipe('immersiveengineering:crafting/treated_wood_horizontal', 'immersiveengineering:shaped_fluid', 'immersiveengineering:treated_wood_horizontal', {}),
  recipe('somemod:machine/manyullyn_maker', 'somemod:machine', null, { result: { item: 'tconstruct:manyullyn_ingot' } }),
]
W.tagItems = { 'forge:ingots/titanium': ['thermal:titanium_ingot', 'mekanism:ingot_titanium'] }
// Chisel 2.0.0 for 1.20.1 dropped marble, basalt and limestone, but Mystical Agriculture still ships
// essence recipes for them behind forge:mod_loaded for chisel, so the result item is not registered.
W.missingItems = { 'chisel:marble/raw': true }
W.addedRecipes = []
const stagedOf = id => gateTier(W.mockRecipes.find(r => r.id == id))
cmd('bloodpool settier 5', admin); advance(25); W.forEachCalls = 0; reload()
// At Tier 5, catch-up gives everyone Tiers 1-3, so only Tiers 4 and 5 keep a check.
ok('recipes above catch-up get their tier\'s result check', stagedOf('thermal:machine_frame') == 'potato_standing_5', W.mockRecipes.map(r => r.id + '=' + stagedOf(r.id)).join(' '))
const noCheckVanilla = id => !W.mockRecipes.find(r => r.id == id).gate && /^minecraft:/.test(W.mockRecipes.find(r => r.id == id).getType())
ok('recipes at or below catch-up have no check and stay vanilla, so any machine can make them', noCheckVanilla('create:crafting/kinetics/cogwheel') &&
  noCheckVanilla('create:crafting/materials/brass_casing') && noCheckVanilla('hexerei:mixing_cauldron') && noCheckVanilla('mysticalagriculture:essence/minecraft/iron_ingot'))
ok('a recipe gets the highest lock: its mod (Mekanism 4) over its result (Create 1)', stagedOf('mekanism:shaft_compat') == 'potato_standing_4')
ok('recipe id rules count (an MA essence recipe in Tier 5)', stagedOf('mysticalagriculture:essence/common/silver_ingot') == 'potato_standing_5')
ok('Create\'s Mixer, Press and Mechanical Crafter skip recipes with a check, through Create\'s own list', ['kubejs:shaped', 'kubejs:shapeless'].every(t =>
  ((W.addedTags || {})['minecraft:recipe_serializer create:automation_ignore'] || []).indexOf(t) >= 0), JSON.stringify(W.addedTags))
ok('untiered, sealed-tier, machine and mechanical crafting recipes are left alone', !stagedOf('minecraft:stick') && !stagedOf('mekanism:elite_control_circuit') &&
  !stagedOf('create:mechanical_crafting/cogwheel') && !stagedOf('thermal:machine_pulverizer'))
ok('one read of the ore melting recipes, one of the mod formats, one pass over the crafting recipes', W.forEachCalls == 3, W.forEachCalls)
// ----- mods' own crafting-table formats -----
const added = id => W.addedRecipes.find(r => r.rid == id)
const removedIds = () => (W.removedRecipes || []).filter(f => typeof f.id == 'string').map(f => f.id)
const steel = added('mysticalagriculture:essence/twilightforest/steeleaf_ingot')
ok('a mod-format recipe at or below catch-up is left as it is', !added('mysticalagriculture:essence/minecraft/iron_ingot_mod') && removedIds().indexOf('mysticalagriculture:essence/minecraft/iron_ingot_mod') < 0)
ok('a Mystical Agriculture essence recipe is rebuilt: same id, pattern, ingredient, result and count, no mirroring', !!steel && !steel.mirror &&
  steel.result.id == 'twilightforest:steeleaf_ingot' && steel.result.count == 4 && steel.pattern.join('|') == 'EEE|E E|EEE' && steel.key.E == 'mysticalagriculture:steeleaf_essence' &&
  removedIds().indexOf('mysticalagriculture:essence/twilightforest/steeleaf_ingot') >= 0)
ok('... and gets the rank check of its tier (steeleaf: rank 4)', gateTier(steel) == 'potato_standing_4', gateTier(steel))
const tit = added('mysticalagriculture:essence/common/titanium_ingot')
ok('a tag result resolves to the tag\'s first item (and its mod\'s tier: Thermal, rank 5)', !!tit && tit.result.id == 'thermal:titanium_ingot' && tit.result.count == 2 && gateTier(tit) == 'potato_standing_5')
ok('an empty tag: left as it is', !added('mysticalagriculture:essence/common/nothing_ingot') && removedIds().indexOf('mysticalagriculture:essence/common/nothing_ingot') < 0)
// An empty result would make event.shaped log "ItemStack 'result' can't be empty!" on every reload, so the
// recipe is skipped instead. It can make nothing, so leaving it ungated opens no route.
// (The unregistered-result check is in the Tier 1 block below, where that fixture is above catch-up.)
const pur = added('mekanism:purification_chamber')
ok('a Mekanism base machine is rebuilt with its tags and items, and its rank (Tier 5 item)', !!pur && pur.key.C == '#forge:circuits/advanced' && pur.key.E == 'mekanism:enrichment_chamber' && gateTier(pur) == 'potato_standing_5')
ok('Mekanism upgrades are left as they are: tier upgrades, factories, and anything made from a data-carrying item (jetpack)',
  !added('mekanism:energy_cube/advanced') && !added('mekanism:factory/basic/smelting') && !added('mekanism:jetpack_armored') &&
  removedIds().indexOf('mekanism:energy_cube/advanced') < 0 && removedIds().indexOf('mekanism:jetpack_armored') < 0)
ok('... while the plain jetpack (from components) is rebuilt (Mekanism, rank 4)', !!added('mekanism:jetpack') && gateTier(added('mekanism:jetpack')) == 'potato_standing_4')
ok('an ingredient only the mod understands: left as it is', !added('mekanism:odd') && removedIds().indexOf('mekanism:odd') < 0)
ok('a recipe whose tier is still sealed is removed, not rebuilt (QIO drive array, Tier 10)', !added('mekanism:qio_drive_array') && removedIds().indexOf('mekanism:qio_drive_array') >= 0)
ok('the log says what was rebuilt', W.logs.some(l => /Mod crafting recipes: 4 rebuilt with the rank check; 3 Mekanism upgrades left as they are; 2 skipped .*; 1 sealed/.test(l)), W.logs.filter(l => /Mod crafting/.test(l)).join(' | '))
ok('no recipe is staged (stages would block autocrafters)', W.mockRecipes.every(r => !r.staged))
// ----- vanilla-format recipes: the type switch -----
const mockOf = id => W.mockRecipes.find(r => r.id == id)
ok('a shaped recipe with a rank check switches to KubeJS\'s shaped type', mockOf('thermal:machine_frame').getType() == 'kubejs:shaped', mockOf('thermal:machine_frame').getType())
ok('a shapeless one switches to KubeJS\'s shapeless type', mockOf('mekanism:shaft_compat').getType() == 'kubejs:shapeless', mockOf('mekanism:shaft_compat').getType())
ok('the switch happens in place: the recipe is neither removed nor added again', removedIds().indexOf('thermal:machine_frame') < 0 && !added('thermal:machine_frame') &&
  removedIds().indexOf('mekanism:shaft_compat') < 0 && !added('mekanism:shaft_compat'))
ok('recipes without a rank check keep their type: no tier, a sealed tier, a machine', mockOf('minecraft:stick').getType() == 'minecraft:crafting_shaped' &&
  mockOf('mekanism:elite_control_circuit').getType() == 'minecraft:crafting_shaped' && mockOf('thermal:machine_pulverizer').getType() == 'thermal:pulverizer')
ok('one shared check per tier, not one per recipe', !!mockOf('thermal:machine_frame').gate && mockOf('thermal:machine_frame').gate === mockOf('mysticalagriculture:essence/common/silver_ingot').gate)
ok('the log counts the staged recipes', W.logs.some(l => /Potato War: 3 crafting recipes need a rank/.test(l)), W.logs.filter(l => /Potato War/.test(l)).join(' | '))
ok('no errors from the recipe step', errors().length == 0, errors().join(' | '))
// ----- catch-up decides which recipes keep a check -----
const atTier = t => { W.addedRecipes = []; cmd('bloodpool settier ' + t, admin); advance(25); reload() }

// ----- the Foundry's molten debris byproduct is off at every tier; the ore still melts (owner decision) -----
W.customRecipes = []; W.addedRecipes = []; reload()
const rebuilt = id => W.customRecipes.filter(c => c.rid == id)[0]
const orePlain = rebuilt('tconstruct:smeltery/melting/diamond/ore_singular')
ok('diamond ore melting is rebuilt with the same id, without the debris',
  remById('tconstruct:smeltery/melting/diamond/ore_singular') && !!orePlain && !orePlain.json.byproducts)
ok('... and everything else about it stays', !!orePlain && orePlain.json.result.fluid == 'tconstruct:molten_diamond' && orePlain.json.result.amount == 100 &&
  orePlain.json.ingredient.tag == 'forge:ores/diamond' && orePlain.json.temperature == 1450 && orePlain.json.time == 197 && orePlain.json.rate == 'gem' && orePlain.json.type == 'tconstruct:ore_melting')
ok('the conditions it already passed aren\'t kept', !!orePlain && !orePlain.json.conditions)
ok('another byproduct in the same recipe stays', (rebuilt('tconstruct:smeltery/melting/test/two_byproducts') || { json: {} }).json.byproducts.length == 1 &&
  rebuilt('tconstruct:smeltery/melting/test/two_byproducts').json.byproducts[0].fluid == 'tconstruct:molten_gold')
ok('a recipe with other byproducts is left alone', !rebuilt('tconstruct:smeltery/melting/metal/iron/raw') && !remById('tconstruct:smeltery/melting/metal/iron/raw'))
atTier(1)
ok('Tier 1: nothing is caught up, so Create and Mystical Agriculture recipes need rank 1', stagedOf('create:crafting/kinetics/cogwheel') == 'potato_standing_1' &&
  stagedOf('mysticalagriculture:essence/minecraft/iron_ingot') == 'potato_standing_1')
ok('... and a mod-format recipe is rebuilt with its check', gateTier(added('mysticalagriculture:essence/minecraft/iron_ingot_mod')) == 'potato_standing_1')
// An empty result would make event.shaped log "ItemStack 'result' can't be empty!" on every reload, so the
// recipe is skipped instead. It can make nothing, so leaving it ungated opens no route.
ok('a result item that is not registered: left as it is, and no empty-result recipe is added',
  !added('mysticalagriculture:essence/chisel/marble') && removedIds().indexOf('mysticalagriculture:essence/chisel/marble') < 0 &&
  !W.addedRecipes.some(r => r.result && typeof r.result.isEmpty == 'function' && r.result.isEmpty()))
atTier(3)
ok('Tier 3: Tier 1 is caught up (no check), Tiers 2 and 3 keep theirs', noCheckVanilla('create:crafting/kinetics/cogwheel') &&
  stagedOf('hexerei:mixing_cauldron') == 'potato_standing_2' && stagedOf('create:crafting/materials/brass_casing') == 'potato_standing_3')
atTier(5)
ok('Tier 5 again: the wrappers are fresh, so caught-up recipes are vanilla once more', noCheckVanilla('create:crafting/materials/brass_casing'))

// offering
players.forEach(p => { p.inventory.slots.forEach((s, i) => { if (i < 36) p.inventory.slots[i] = EMPTY() }) })
const pool0 = PDB().drops, tithed0 = PDB().potatoDrops
give(ana, 'minecraft:potato', 300)
const c1 = W.cmds.length
cmd('potatowar offer 100', ana)
ok('offer 100: Standing 100, not ranked yet; 100 potatoes taken', PDB().standing['ana-1111'].potatoes == 100 && countOf(ana, 'minecraft:potato') == 200 &&
  /100 potatoes' worth offered.*Unenlisted.*Potato Farmer at 250 potatoes \(150 potatoes to go\)/.test(flat(lastReply())), flat(lastReply()))
ok('... and none of it went into the Blood Pool or the tithe', PDB().drops == pool0 && PDB().potatoDrops == tithed0)
ok('... her rank gives no stage yet, but catch-up (Pool Tier 5, gap 2) gives Tiers 1-3 to everyone', ana.stages.has('potato_standing_3') && !ana.stages.has('potato_standing_4') && glob.BloodPool.craftAccess(ana) == 3 && glob.BloodPool.standing(ana).tier == 0)
ok('... and the open Pool tiers as stages', ana.stages.has('blood_pool_tier_5') && !ana.stages.has('blood_pool_tier_6'))
cmd('potatowar', ana); ok('/potatowar shows the catch-up access', /Unenlisted.*Crafting access: Tier 3 \(catch-up: the Blood Pool is at Tier 5\)/.test(flat(lastReply())), flat(lastReply()))
cmd('potatowar offer', ana)
ok('offer (everything): 300, Potato Farmer, stage potato_standing_1', PDB().standing['ana-1111'].potatoes == 300 && countOf(ana, 'minecraft:potato') == 0 &&
  ana.stages.has('potato_standing_1') && !ana.stages.has('potato_standing_4'))
ok('the rank-up: a title to her and a public line', cmdsSince(c1).some(c => /^title Ana title .*Potato Farmer/.test(c)) && said(c1).some(l => /Ana has risen to Potato Farmer in Techno's Potato War/.test(l)), said(c1).join(' | '))
ok('the Pool is still untouched', PDB().drops == pool0)
give(ana, 'minecraft:potato', 3); give(ana, 'farmersdelight:potato_crate', 2)
cmd('potatowar offer 10', ana)
ok('offer 10 from 3 loose + crates: 3 loose and 1 crate taken, 2 potatoes change', PDB().standing['ana-1111'].potatoes == 310 && countOf(ana, 'minecraft:potato') == 2 && countOf(ana, 'farmersdelight:potato_crate') == 1)
cmd('potatowar offer 50', ana); ok('more than you carry: refused', /only carry 11/.test(flat(lastReply())) && PDB().standing['ana-1111'].potatoes == 310)
cmd('potatowar offer -1', ana); ok('a negative amount: refused', /doesn't hand them out/.test(flat(lastReply())))
give(bo, 'minecraft:potato', 40)
cmd('bloodpool tithe', bo)
ok('after the reveal (Tier 5 open) the tithe toward Tier 6 takes Enchanted Potatoes: 40 potatoes are refused, none taken',
  /takes Enchanted Potatoes in fours/.test(flat(lastReply())) && PDB().drops == pool0 && countOf(bo, 'minecraft:potato') == 40, flat(lastReply()))
give(bo, 'kubejs:enchanted_potato', 40)
const st0 = PDB().standing['bo-1111']
cmd('bloodpool tithe', bo)
ok('the tithe fills the Pool and never raises rank (40 Enchanted Potatoes and the 40 potatoes: 10 Drops, 4 Enchanted each)', PDB().drops == pool0 + 10 && !PDB().standing['bo-1111'] && st0 === undefined && /don't raise your rank/.test(flat(lastReply())), flat(lastReply()))
cmd('potatowar', ana); ok('/potatowar shows your rank', /310 potatoes' worth offered: Potato Farmer\. Potato Peeler at 1,000 potatoes/.test(flat(lastReply())), flat(lastReply()))
ok('API: global.BloodPool.standing', glob.BloodPool.standing(ana).tier == 1 && glob.BloodPool.standing(ana).rank == 'Potato Farmer' && glob.BloodPool.standing(bo).tier == 0 && glob.BloodPool.rankName(5) == 'Potato Soldier')

// op commands
cmd('potatowar set Ana 50000', admin)
ok('op set 50,000: Potato Soldier, stages 1-5', glob.BloodPool.standing(ana).tier == 5 && [1, 2, 3, 4, 5].every(i => ana.stages.has('potato_standing_' + i)) && !ana.stages.has('potato_standing_6'))
cmd('potatowar set Ana 1000', admin)
ok('op set 1,000: back to Potato Peeler, stages 4-5 taken away (1-3 stay through catch-up)', glob.BloodPool.standing(ana).tier == 2 && ana.stages.has('potato_standing_3') && !ana.stages.has('potato_standing_4') && !ana.stages.has('potato_standing_5'))
cmd('potatowar add Ana 1500', admin); ok('op add', PDB().standing['ana-1111'].potatoes == 2500 && glob.BloodPool.standing(ana).tier == 3)
cmd('potatowar check Ana', admin); ok('op check', /Ana: 2,500 potatoes' worth offered: Potato Recruit/.test(flat(lastReply())), flat(lastReply()))
cmd('potatowar set Ana 5', bo); ok('set is op-only', lastReply() == 'DENIED')
cmd('potatowar check Ana', bo); ok('check is op-only', lastReply() == 'DENIED')
cmd('potatowar set Nobody 5', admin); ok('an unknown player is refused', /Nobody by that name/.test(flat(lastReply())))
replies.length = 0; cmd('potatowar top', bo)
ok('/potatowar top', replies.length == 2 && /1\. Ana: Potato Recruit \(2,500\)/.test(flat(replies[1])), replies.map(flat).join(' | '))
replies.length = 0; cmd('potatowar ranks', bo)
ok('/potatowar ranks: 11 ranks with what they craft', replies.length == 11 && /4\. Potato Private: 25,000 potatoes/.test(flat(replies[3])) && /5\. Potato Soldier: 50,000 potatoes · crafts Tier 5 \(A Spring\)/.test(flat(replies[4])) && /6\. Potato Sergeant: 400,000 Enchanted Potatoes/.test(flat(replies[5])) && /11\. Potato Emperor: 4,400,000 Enchanted Baked Potatoes/.test(flat(replies[10])), replies.map(flat).join(' | '))
replies.length = 0; cmd('bloodpool tiers', bo)
ok('/bloodpool tiers names the rank each tier\'s crafting needs', /Tier 5 .*crafting needs Potato Soldier/.test(flat(replies[4])) && !/crafting needs/.test(flat(replies[11])), flat(replies[4]) + ' | ' + flat(replies[11]))
setReal(ana, ana.selected, stack('thermal:machine_frame', 1))
cmd('bloodpool check', ana); ok('/bloodpool check names the rank and yours', /also needs Potato Soldier in the Potato War \(you: Potato Recruit\)/.test(flat(lastReply())), flat(lastReply()))
// The Pool caps rank: at most one rank above the open tier (RANK_LEAD). Potatoes past the cap wait for the tier.
cmd('potatowar set Ana 112000000', admin)
ok('Pool Tier 5: 700,000 Enchanted Potatoes\' worth (enough for Potato Lieutenant, rank 7) makes Ana a Potato Sergeant (rank 6), no higher',
  glob.BloodPool.standing(ana).tier == 6 && glob.BloodPool.standing(ana).earned == 7 && ana.stages.has('potato_standing_6') && !ana.stages.has('potato_standing_7'),
  JSON.stringify(glob.BloodPool.standing(ana)))
cmd('potatowar', ana)
ok('... /potatowar says the next rank waits for the Pool', /112,000,000 potatoes' worth offered: Potato Sergeant\. Potato Lieutenant waits for the Blood Pool to open Tier 6 \(your offerings already cover it\)\./.test(flat(lastReply())), flat(lastReply()))
replies.length = 0; cmd('potatowar ranks', bo)
ok('/potatowar ranks says the Pool tier each rank needs (Potato Farmer needs none)', /6\. Potato Sergeant: 400,000 Enchanted Potatoes .* · needs the Blood Pool at Tier 5$/.test(flat(replies[5])) &&
  !/needs the Blood Pool/.test(flat(replies[0])), flat(replies[5]) + ' | ' + flat(replies[0]))
const cR = W.cmds.length
cmd('bloodpool unlock force', admin); advance(25)
ok('opening Tier 6 gives her the rank she had earned, with the rank-up line', glob.BloodPool.standing(ana).tier == 7 && ana.stages.has('potato_standing_7') &&
  said(cR).some(l => /Ana has risen to Potato Lieutenant/.test(l)), said(cR).join(' | '))
cmd('bloodpool settier 0', admin); advance(25)
ok('at Tier 0 nobody is above Potato Farmer, whatever they have offered', glob.BloodPool.standing(ana).tier == 1 && glob.BloodPool.standing(ana).rank == 'Potato Farmer' && !ana.stages.has('potato_standing_2'))
ok('... and the quiet /bloodpool settier announces no rank changes', !said(cR).some(l => /has risen to Potato Farmer/.test(l)))
cmd('bloodpool settier 5', admin); advance(25); reload()
cmd('potatowar set Ana 2500', admin)
ok('back at Tier 5 with 2,500 potatoes, she is a Potato Recruit again', glob.BloodPool.standing(ana).tier == 3 && glob.BloodPool.standing(ana).held == 0)
// Ranks players already held above the cap when it first loaded are kept: a one-time snapshot from their potatoes.
ok('the snapshot was taken when the script first loaded (nobody had offered yet)', !!PDB().rankFloorSince && Object.keys(PDB().rankFloor || {}).length == 0)
const savedPool = W.persistent.blood_pool
const pre = JSON.parse(savedPool)
delete pre.rankFloorSince; delete pre.rankFloor
pre.standing['old-1111'] = { name: 'Old', potatoes: 112000000 }   // a server from before the cap: rank 7 at Tier 5 (700,000 Enchanted Potatoes' worth)
W.persistent.blood_pool = JSON.stringify(pre)
const nL = W.logs.length
reload()
const oldie = mk('Old', 1004.5)
ok('first load with the cap: a player above it keeps the rank they had (Old: Potato Lieutenant at Tier 5)',
  glob.BloodPool.standing(oldie).tier == 7 && glob.BloodPool.standing(oldie).kept && PDB().rankFloor['old-1111'] == 7, JSON.stringify(glob.BloodPool.standing(oldie)))
ok('... the log names who kept what', W.logs.slice(nL).some(l => /Kept from before: Old \(Potato Lieutenant\)/.test(l)), W.logs.slice(nL).filter(l => /Kept/.test(l)).join(' | '))
cmd('potatowar check Old', admin)
ok('... /potatowar says the rank was kept, and the next one still waits for its tier (Tier 7)',
  /Potato Lieutenant \(kept from before ranks waited for the Blood Pool\)\. Potato Captain waits for the Blood Pool to open Tier 7/.test(flat(lastReply())), flat(lastReply()))
ok('... players within the cap keep nothing extra (Ana, Potato Recruit)', glob.BloodPool.standing(ana).tier == 3 && !glob.BloodPool.standing(ana).kept && PDB().rankFloor['ana-1111'] == null)
cmd('potatowar set Bo 112000000', admin)
ok('progress after the snapshot follows the cap: Bo, with the same potatoes as Old, is a Potato Sergeant', glob.BloodPool.standing(bo).tier == 6)
reload()
ok('the snapshot is taken once: after a reload Old keeps the rank and Bo gets none', glob.BloodPool.standing(oldie).tier == 7 && glob.BloodPool.standing(bo).tier == 6)
cmd('potatowar set Old 1000', admin)
ok('an op can still lower a kept rank (Old set to 1,000 potatoes: Potato Peeler)', glob.BloodPool.standing(oldie).tier == 2)
W.persistent.blood_pool = savedPool; reload()
ok('(the test data is put back)', glob.BloodPool.standing(ana).tier == 3 && !PDB().standing['old-1111'])
// Breaking the seal by vote: 5 players' /bloodpool vote opens the next tier (ops can still /bloodpool unlock).
const poolDrops0 = PDB().drops
const vee = mk('Vee', 1005.5), wes = mk('Wes', 1006.5)
cmd('bloodpool vote', ana)
ok('/bloodpool vote before the next tier is ready: refused, with what it needs', /Tier 6 \(A Stream\) isn't ready: the Pool needs [\d,]+ more Drops/.test(flat(lastReply())), flat(lastReply()))
ana.inbox.length = 0; bo.inbox.length = 0
cmd('bloodpool set 480000', admin)
ok('when the Pool reaches Tier 6, everyone online is told how to vote', /Tier 6 \(A Stream\) is ready\. 0 of 5 votes break the Ministry's seal\. Vote with \/bloodpool vote\./.test(text(ana)), text(ana))
cmd('bloodpool', bo)
ok('/bloodpool shows the count', /ready\. 0 of 5 votes to break the seal \(\/bloodpool vote\)/.test(flat(lastReply())), flat(lastReply()))
cmd('bloodpool vote', ana)
ok('Ana votes: 1 of 5, and the tier stays sealed', /Your vote is counted: 1 of 5/.test(flat(lastReply())) && PDB().tier == 5, flat(lastReply()))
ok('... everyone online hears it', /Ana voted to break the seal on Tier 6 \(A Stream\): 1 of 5\. \/bloodpool vote/.test(text(bo)), text(bo))
cmd('bloodpool vote', ana)
ok('... a second vote from the same player is refused', /already voted to break the seal on Tier 6 \(1 of 5\)/.test(flat(lastReply())) && Object.keys(PDB().vote.voters).length == 1, flat(lastReply()))
bo.inbox.length = 0
cmd('bloodpool unvote', ana)
ok('/bloodpool unvote takes the vote back: 0 of 5', /Your vote is withdrawn: 0 of 5/.test(flat(lastReply())) && Object.keys(PDB().vote.voters).length == 0, flat(lastReply()))
ok('... and everyone online hears it', /Ana withdrew a vote to break the seal on Tier 6 \(A Stream\): 0 of 5\./.test(text(bo)), text(bo))
cmd('bloodpool unvote', ana)
ok('... withdrawing twice is refused: there is no vote to take back', /You haven't voted on Tier 6 \(A Stream\), so there is no vote to take back/.test(flat(lastReply())), flat(lastReply()))
cmd('bloodpool unvote')
ok('... the console can\'t withdraw one', /Players only/.test(flat(lastReply())))
cmd('bloodpool vote', ana)
ok('... and the player can vote again: 1 of 5', /Your vote is counted: 1 of 5/.test(flat(lastReply())) && Object.keys(PDB().vote.voters).length == 1, flat(lastReply()))
cmd('bloodpool vote')
ok('the console can\'t vote', /Players only/.test(flat(lastReply())))
cmd('bloodpool vote', bo); cmd('bloodpool vote', admin); cmd('bloodpool vote', vee)
ok('four votes: still sealed', PDB().tier == 5 && Object.keys(PDB().vote.voters).length == 4)
reload()
cmd('bloodpool', bo)
ok('votes are saved: after a reload the count is still 4', /ready\. 4 of 5 votes/.test(flat(lastReply())), flat(lastReply()))
wes.inbox.length = 0; ana.inbox.length = 0
fire('loggedIn', { player: wes }); fire('loggedIn', { player: ana })
advance(50)
const readyLine = p => p.inbox.map(flat).filter(l => /is ready\. \d of 5 votes/.test(l))
ok('a player who logs on isn\'t told straight away (the join messages come first)', readyLine(wes).length == 0)
advance(60)
ok('... then is told, with the count, and whether they have voted', /Tier 6 \(A Stream\) is ready\. 4 of 5 votes break the Ministry's seal\. Vote with \/bloodpool vote\./.test(readyLine(wes).join()) &&
  /4 of 5 votes break the Ministry's seal\. You have voted\./.test(readyLine(ana).join()), readyLine(wes).join() + ' | ' + readyLine(ana).join())
const cV = W.cmds.length
cmd('bloodpool vote', wes)
ok('the fifth vote breaks the seal: Tier 6 opens', PDB().tier == 6 && /Yours was the vote that broke the seal\. Tier 6 \(A Stream\) is open/.test(flat(lastReply())), flat(lastReply()))
ok('... with the public lines: who broke it, then the seal breaking', said(cV).some(l => /5 voices broke the Ministry's seal: Ana, Bo, Admin, Vee, Wes\./.test(l)) &&
  said(cV).some(l => /The seal breaks\. Tier 6 \(A Stream\) is open/.test(l)), said(cV).join(' | '))
ok('... and the votes start again for the next tier', PDB().vote == null)
advance(25)
cmd('bloodpool vote', ana)
ok('Tier 7 isn\'t ready yet, so there is nothing to vote on', /Tier 7 \(A River\) isn't ready/.test(flat(lastReply())), flat(lastReply()))
cmd('bloodpool unvote', wes)
ok('... and a vote that broke the seal can\'t be taken back', /You haven't voted on Tier 7 \(A River\)/.test(flat(lastReply())) && PDB().tier == 6, flat(lastReply()))
cmd('bloodpool settier 5', admin); advance(25); reload()
cmd('bloodpool set ' + poolDrops0, admin)
ok('(the test tier and Drops are put back)', PDB().tier == 5 && PDB().drops == poolDrops0)
// Relics break the seals (owner decisions 2026-11-20, STORY.md #37): with part2/shrine.js counting them (global.Regalia),
// a seal from Tier 5 also needs one more of the Regalia's relics restored. Without it (as above), no seal waits on relics.
let relicsIn = 1
glob.Regalia = { restoredForSeals: () => relicsIn }
ana.inbox.length = 0
const cR0 = W.cmds.length
cmd('bloodpool set 480000', admin)
ok('Tier 6 ready with 1 of its 2 relics restored: the seal holds, and the Blood God says what it needs', said(cR0).some(l => /The seal on Tier 6 holds\. Bring me 1 more of my Regalia\./.test(l)) &&
  /Tier 6 \(A Stream\) is ready, but its seal holds until 1 more of the Blood God's Regalia is restored at his Shrine \(\/regalia\)/.test(text(ana)), said(cR0).join(' | ') + ' || ' + text(ana))
cmd('bloodpool vote', ana)
ok('... a vote is refused while it holds', /The seal on Tier 6 holds\. Bring me 1 more of my Regalia\. \(1 of 2 relics restored at the Shrine; \/regalia\)/.test(flat(lastReply())) && !PDB().vote, flat(lastReply()))
cmd('bloodpool', bo)
ok('... /bloodpool says why', /ready, but its seal holds until 1 more of the Blood God's Regalia is restored at his Shrine \(1 of 2; \/regalia\)/.test(flat(lastReply())), flat(lastReply()))
cmd('bloodpool unlock', admin)
ok('... and so is /bloodpool unlock (force still opens it)', /Tier 6's seal waits on the Regalia: 1 of 2 relics restored at the Shrine\. \(\/bloodpool unlock force to open it anyway\.\)/.test(flat(lastReply())) && PDB().tier == 5,
  flat(lastReply()))
relicsIn = 2
ana.inbox.length = 0
const cR1 = W.cmds.length
glob.BloodPool.relicsChanged()
ok('the second relic restored: the seal can break now, and the vote opens', said(cR1).some(l => /The seal on Tier 6 \(A Stream\) can break now\./.test(l)) &&
  /Tier 6 \(A Stream\) is ready\. 0 of 5 votes break the Ministry's seal/.test(text(ana)), said(cR1).join(' | ') + ' || ' + text(ana))
cmd('bloodpool vote', ana)
ok('... and votes count again', /Your vote is counted: 1 of 5/.test(flat(lastReply())), flat(lastReply()))
ok('the relics each seal needs: none before Tier 5, then one more a tier, seven at most (the Crown is the final act\'s)', [4, 5, 6, 11, 12].map(n => glob.BloodPool.relicsNeeded(n)).join() == '0,1,2,7,7')
delete glob.Regalia
cmd('bloodpool settier 5', admin); advance(25); reload()
cmd('bloodpool set ' + poolDrops0, admin)
ok('(the test tier, votes and Drops are put back)', PDB().tier == 5 && PDB().drops == poolDrops0 && !PDB().vote)
// Extra Utilities' spikes (and the compressed cobblestone stone spikes need) open at Tier 2, ahead of the mod (Tier 7).
const XU_EARLY = ['wooden_spikes', 'stone_spikes', 'iron_spikes', 'golden_spikes', 'diamond_spikes', 'compressed_cobblestone'].map(i => 'extrautilitiesreborn:' + i)
const xuFilters = rem().map(s => JSON.parse(s)).filter(f => f.output == '@extrautilitiesreborn' || f.mod == 'extrautilitiesreborn')
ok('Tier 5: Extra Utilities is still sealed, but its spikes and compressed cobblestone keep their recipes',
  xuFilters.length == 2 && xuFilters.every(f => f.not && XU_EARLY.every(i => f.not.output.indexOf(i) >= 0)), JSON.stringify(xuFilters))
ok('... spikes are Tier 2; the rest of the mod stays Tier 7 (double compressed cobblestone, the angel ring)', XU_EARLY.every(i => glob.BloodPool.tierOf(i) == 2) &&
  glob.BloodPool.tierOf('extrautilitiesreborn:double_compressed_cobblestone') == 7 && glob.BloodPool.tierOf('extrautilitiesreborn:angel_ring') == 7)

// the result check with real players (Ana is a Potato Recruit, rank 3; she holds rank 4's stage for these checks)
const frame = W.mockRecipes.find(r => r.id == 'thermal:machine_frame'), shaft = W.mockRecipes.find(r => r.id == 'mekanism:shaft_compat')
ana._stages.add('potato_standing_4')
const res = stack('x:result', 1)
ok('at a crafting table: Ana gets a Tier 4 result but not a Tier 5 one', shaft.gate({ getPlayer: () => ana, getMenu: () => null }, res) === res &&
  frame.gate({ getPlayer: () => ana, getMenu: () => null }, res).isEmpty())
const modMenu = { equals: o => o === modMenu }
ana._menu = modMenu
ok('a mod\'s crafting grid (no player given): found through her open window, and checked', frame.gate({ getPlayer: () => null, getMenu: () => modMenu }, res).isEmpty() &&
  shaft.gate({ getPlayer: () => null, getMenu: () => modMenu }, res) === res)
ana._menu = null
// The Tinkers Crafting Station has no window KubeJS can see. It names the player to Forge while it assembles.
const noWindow = { getPlayer: () => null, getMenu: () => null }
W.craftingPlayer = ana
ok('a grid with no window that names its player to Forge (the Crafting Station): checked', frame.gate(noWindow, res).isEmpty() && shaft.gate(noWindow, res) === res)
W.craftingPlayer = { name: 'machine fake player' }
ok('a machine\'s fake player named to Forge is not online, so it counts as a machine: no result', shaft.gate(noWindow, res).isEmpty())
W.craftingPlayer = null
ok('an autocrafter (no player, no window or nobody\'s window) gets nothing from a recipe with a check, whatever anyone\'s rank', shaft.gate(noWindow, res).isEmpty() &&
  shaft.gate({ getPlayer: () => null, getMenu: () => ({ equals: () => false }) }, res).isEmpty())
ana._stages.delete('potato_standing_4')
const nE = errors().length
ok('an error inside the check gives the result (and is logged)', frame.gate({ getPlayer: () => ({ stages: { has: () => { throw new Error('boom') } } }), getMenu: () => null }, res) === res && errors().length == nE + 1)
W.logs = W.logs.filter(l => !/Potato War crafting check/.test(l))

// stages after login and /reload
ana._stages.clear(); fire('loggedIn', { player: ana })
ok('login gives the stages back', ana.stages.has('potato_standing_3') && !ana.stages.has('potato_standing_4'))
ana._stages.clear(); reload()
ok('/reload syncs online players', ana.stages.has('potato_standing_1') && ana.stages.has('potato_standing_3'))
ok('Standing survives /reload', glob.BloodPool.standing(ana).potatoes == 2500)

// the black market locks
cmd('blackmarket vendor addspot pw_spot', admin)
cmd('blackmarket vendor spawn pw_spot', admin); advance(45)
const v = vendor()
;[ana, bo].forEach(p => { p.x = v.x + 1; p.y = v.y; p.z = v.z; p.dim = v.dim })
cmd('coins give Bo 200', admin); cmd('coins give Ana 200', admin)
const bc = coinsOf(bo)
cmd('blackmarket buy itching', bo)
ok('unranked: Itching Powder (rank 1) refused, no coins taken', /only sells that to a Potato Farmer or higher/.test(flat(lastReply())) && coinsOf(bo) == bc, flat(lastReply()))
cmd('blackmarket buy writ', bo); ok('... the Writ (rank 3) too', /Potato Recruit or higher/.test(flat(lastReply())) && coinsOf(bo) == bc)
cmd('blackmarket buy contract warparty Ana', bo); ok('... and the War Party contract (rank 8)', /Potato Captain or higher/.test(flat(lastReply())) && coinsOf(bo) == bc)
const ac = coinsOf(ana)
cmd('blackmarket buy writ', ana); ok('Ana (rank 3) buys the Writ', /Writ of Protection bought/.test(flat(lastReply())) && coinsOf(ana) == ac - 15, flat(lastReply()))
cmd('blackmarket buy tracker Bo', ana); ok('... but not the Tracker Compass (rank 4)', /Potato Private or higher/.test(flat(lastReply())) && coinsOf(ana) == ac - 15)
cmd('blackmarket buy contract tipoff Bo', ana); ok('... and the Tip-off contract (rank 2) is hers', !/or higher/.test(flat(lastReply())) && coinsOf(ana) < ac - 15, flat(lastReply()))
// chat menu
bo.inbox.length = 0; cmd('blackmarket chatshop', bo)
ok('chat shop: locked items show the rank instead of [BUY]', /\(needs Potato Farmer\)/.test(text(bo)) && /\(needs Potato Captain\)/.test(text(bo)) && /\(needs Potato Sergeant\)/.test(text(bo)))
const alibiLine = bo.inbox.filter(l => /Certified Alibi/.test(l)).join('')
ok('... an unlocked item (the Certified Alibi) keeps its [BUY]', /\[BUY\]/.test(alibiLine) && !/needs/.test(alibiLine), alibiLine)
// shop window
cmd('blackmarket shop', bo)
const gslot = (p, x, y) => p.gui.slots[x + ',' + y]
const lore = sl => JSON.stringify(sl.item.parsed)
ok('window: a red "Needs <rank>" lore line on locked items', /Needs Potato Farmer \(Potato Standing\)/.test(lore(gslot(bo, 2, 3))) && /Needs Potato Recruit/.test(lore(gslot(bo, 2, 1))), lore(gslot(bo, 2, 3)))
const bc2 = coinsOf(bo)
gslot(bo, 2, 3).leftClicked({}); advance(4)
ok('window: clicking a locked item explains and buys nothing', /only sells that to a Potato Farmer/.test(text(bo)) && coinsOf(bo) == bc2)
gslot(bo, 2, 0).leftClicked({}); advance(4)
ok('window: a locked contract doesn\'t open the target page', bo.gui && !/who\?/.test(bo.gui.title), bo.gui && bo.gui.title)
cmd('potatowar set Bo 250', admin)
cmd('blackmarket buy itching', bo); ok('at Potato Farmer, Bo buys Itching Powder', /Itching Powder bought/.test(flat(lastReply())), flat(lastReply()))
// placing an autocrafter needs its tier's rank
const place = (p, id) => { const ev = { player: p, block: { id, x: 3000, y: 64, z: 3000, level: levels[OW], getDimension: () => OW }, cancel() { throw new Exit() } }; fire('blockPlaced', ev); return !ev.cancelled }
bo.inbox.length = 0
ok('Potato Farmer: can\'t place an AE2 Molecular Assembler (rank 6), told why', !place(bo, 'ae2:molecular_assembler') &&
  /Only a Potato Sergeant or higher knows how to set up a Molecular Assembler\. You are Potato Farmer/.test(text(bo)), text(bo))
ok('... nor a Mechanical Crafter (rank 4); ordinary blocks are fine', !place(bo, 'create:mechanical_crafter') && place(bo, 'minecraft:stone') && place(bo, 'ae2:controller'))
const CHEAP_CRAFTERS = ['quark:crafter', 'botania:crafty_crate']
ok('... nor the cheap autocrafters: Quark Crafter, Crafty Crate (fixed rank 4)', CHEAP_CRAFTERS.every(id => !place(bo, id)), CHEAP_CRAFTERS.filter(id => place(bo, id)).join(','))
cmd('potatowar set Bo ' + (400000 * (glob.BloodPool.revealed() ? 160 : 1)), admin)   // Potato Sergeant
ok('Potato Sergeant: Molecular Assembler, Mechanical Crafter, Assemblicator, Ender IO Crafter yes; RFTools Crafter (7) and Quantum Crafter (8) no',
  place(bo, 'ae2:molecular_assembler') && place(bo, 'create:mechanical_crafter') && place(bo, 'mekanism:formulaic_assemblicator') && place(bo, 'enderio:crafter') &&
  !place(bo, 'rftoolsutility:crafter3') && !place(bo, 'advanced_ae:quantum_crafter'))
ok('... the cheap autocrafters yes; Blue Power\'s Auto Project Table (its tier, 7) no', CHEAP_CRAFTERS.every(id => place(bo, id)) && !place(bo, 'bluepower:auto_project_table'))
// Fancy Crafters and the Wixie read a recipe's result themselves, so no check reaches them: they're out of the game.
const BANNED_BLOCKS = ['bibliocraft:oak_fancy_crafter', 'bibliocraft:warped_fancy_crafter', 'bibliocraft:dark_oak_fancy_crafter', 'ars_nouveau:wixie_cauldron']
const useOn = (p, id, item) => { const ev = { player: p, block: { id, x: 3000, y: 64, z: 3000, level: levels[OW], getDimension: () => OW }, item: item || EMPTY(), cancel() { throw new Exit() } }; fire('blockRightClicked', ev); return !ev.cancelled }
bo.inbox.length = 0
ok('Fancy Crafters and the Wixie Cauldron can\'t be placed, whatever the rank', BANNED_BLOCKS.every(id => !place(bo, id)), BANNED_BLOCKS.filter(id => place(bo, id)).join(','))
ok('... and the player is told why', /can't be used/.test(text(bo)), text(bo))
ok('... or used, if one is there already', BANNED_BLOCKS.every(id => !useOn(bo, id)))
ok('a Wixie Charm can\'t be used on a block; other items and blocks are fine', !useOn(bo, 'minecraft:cauldron', stack('ars_nouveau:wixie_charm', 1)) && useOn(bo, 'minecraft:cauldron', stack('minecraft:stone', 1)) && useOn(bo, 'minecraft:stone'))
// Found in game: holding a Fancy Crafter, even in the off-hand, made every block refuse the player.
ok('holding a banned block doesn\'t stop a player using other blocks; it\'s only refused when placed', useOn(bo, 'minecraft:furnace', stack('bibliocraft:oak_fancy_crafter', 1)) &&
  useOn(bo, 'minecraft:chest', stack('bibliocraft:oak_fancy_crafter', 1)) && useOn(bo, 'minecraft:furnace', stack('ars_nouveau:wixie_cauldron', 1)))
// Found in game: after a refused placement the client thinks the item was used and takes it off the screen, while the
// server still holds it and never corrects it, because its own copy didn't change. The whole window has to be sent again.
const syncCount = (p, fn) => {
  advance(2)   // resends still queued from earlier refusals in this suite
  const menu = { equals: o => o === menu, sendAllDataToRemote() { W.syncs = (W.syncs || 0) + 1 } }
  p._menu = menu; W.syncs = 0
  fn()
  const soon = W.syncs
  advance(2)
  p._menu = null
  return [soon, W.syncs]
}
ok('a refused placement sends the player\'s inventory again, a tick later', syncCount(bo, () => place(bo, 'bibliocraft:oak_fancy_crafter')).join() == '0,1' &&
  syncCount(bo, () => place(bo, 'rftoolsutility:crafter3')).join() == '0,1')
ok('... and a refused click', syncCount(bo, () => useOn(bo, 'bibliocraft:oak_fancy_crafter')).join() == '0,1')
ok('... but not an allowed placement or click', syncCount(bo, () => place(bo, 'minecraft:stone')).join() == '0,0' && syncCount(bo, () => useOn(bo, 'minecraft:stone')).join() == '0,0')
ok('their recipes are removed at any tier', has('{"output":"bibliocraft:oak_fancy_crafter"}') && has('{"output":"bibliocraft:warped_fancy_crafter"}') && has('{"output":"ars_nouveau:wixie_charm"}') && has('{"output":"ars_nouveau:wixie_cauldron"}'))
ok('ops can still place and use them', place(admin, 'bibliocraft:oak_fancy_crafter') && useOn(admin, 'ars_nouveau:wixie_cauldron'))
ok('ops are exempt', place(admin, 'advanced_ae:quantum_crafter'))
const cy = mk('Cy', 1003.5); players.push(cy); cy.creative = true
ok('creative players are exempt', place(cy, 'advanced_ae:quantum_crafter') && place(cy, 'bibliocraft:oak_fancy_crafter') && useOn(cy, 'ars_nouveau:wixie_cauldron'))
cy.online = false
setReal(bo, bo.selected, stack('ae2:molecular_assembler', 1))
cmd('bloodpool check', bo); ok('/bloodpool check says the rank needed to place it', /Placing it needs Potato Sergeant/.test(flat(lastReply())), flat(lastReply()))
// ----- Use locks: players kept their Part I inventories, so a sealed raygun (Tier 6) must not work before its tier -----
const flatT = l => { const j = json(l); return j ? j.map(x => typeof x == 'string' ? x : x.text != null ? x.text : '<' + x.translate + '>').join('') : l }
const watchBar = p => { p.status = []; p.setStatusMessage = c => p.status.push(flatT(c.json)) }
const useItem = (p, s, hand) => { const ev = { player: p, hand: hand || 'MAIN_HAND', item: s, cancel() { throw new Exit() } }; fire('itemRightClicked', ev); return !ev.cancelled }
const gun = () => stack('alexscaves:raygun', 1)
watchBar(bo)
ok('every use, place and spawn lock is in a tier, with a valid mode (nothing logged at load)', !W.logs.some(l => /(USE|PLACE|SPAWN)_LOCKS/.test(l)), W.logs.filter(l => /(USE|PLACE|SPAWN)_LOCKS/.test(l)).join(' | '))
ok('Tier 5: a raygun can\'t be used, in either hand', !useItem(bo, gun()) && !useItem(bo, gun(), 'OFF_HAND'))
ok('... and the action bar says until when, with the item\'s own (translated) name', bo.status.length == 2 &&
  bo.status[0] == 'The <item.alexscaves.raygun> is sealed until the Blood Pool opens Tier 6 (A Stream).', bo.status.join(' | '))
ok('... the refusal sends the inventory again (the client may have spent ammo on its own screen)', syncCount(bo, () => useItem(bo, gun())).join() == '0,1')
ok('... sealed items not on the list (Ice and Fire\'s dragonbone bow, weak gear) and ordinary items are left alone', useItem(bo, stack('iceandfire:dragonbone_bow', 1)) && useItem(bo, stack('minecraft:bow', 1)) && useItem(bo, EMPTY()))
ok('... while the Sea Staff, found as loot, is held now (all sealed gear with a power, 25 Nov)', !useItem(bo, stack('alexscaves:sea_staff', 1)))
watchBar(admin)
ok('ops in survival are refused too (so an op can test it); creative players aren\'t', !useItem(admin, gun()) && admin.status.length == 1 && useItem(cy, gun()))
setReal(bo, bo.selected, gun())
cmd('bloodpool check', bo)
ok('/bloodpool check says using one is sealed too', /alexscaves:raygun can be crafted from Tier 6 \(A Stream\): sealed for now, and so is using one/.test(flat(lastReply())), flat(lastReply()))
// ----- Wear and wield locks (owner decision 2026-11-22): the Aether's and Deeper and Darker's sealed gear, looted -----
const ticks = n => { for (let i = 0; i < n; i++) fire('tick', { server }) }
const hit = (p, target) => { const ev = { entity: target || entity('minecraft:zombie', OW, 0, 64, 0, []), source: { player: p, actual: p, getMsgId: () => 'player' }, cancel() { throw new Exit() } }; fire('hurt', ev); return !ev.cancelled }
const breakWith = p => { const ev = { player: p, block: { x: 9000, y: 64, z: 9000, level: levels[OW], getDimension: () => OW, id: 'minecraft:stone' }, cancel() { throw new Exit() } }; fire('blockBroken', ev); return !ev.cancelled }
const clickBlockWith = (p, s) => { const ev = { player: p, item: s, hand: 'MAIN_HAND', block: { x: 9000, y: 64, z: 9000, level: levels[OW], getDimension: () => OW, id: 'minecraft:stone' }, cancel() { throw new Exit() } }; fire('blockRightClicked', ev); return !ev.cancelled }
const heldSave = bo.inventory.getItem(bo.selected)
ok('every wear and wield lock is in a tier (nothing logged at load)', !W.logs.some(l => /(WEAR|WIELD)_LOCKS/.test(l)), W.logs.filter(l => /(WEAR|WIELD)_LOCKS/.test(l)).join(' | '))
ok('their tiers: gravitite 4, zanite sword 5, resonarium tools 4 and armour 7 (6 until 26 Nov), warden gear 7, the sonorous staff 9',
  glob.BloodPool.tierOf('aether:gravitite_chestplate') == 4 && glob.BloodPool.tierOf('aether:zanite_sword') == 5 && glob.BloodPool.tierOf('deeperdarker:resonarium_sword') == 4 &&
  glob.BloodPool.tierOf('deeperdarker:resonarium_chestplate') == 7 && glob.BloodPool.tierOf('deeperdarker:warden_sword') == 7 && glob.BloodPool.tierOf('deeperdarker:sonorous_staff') == 9 &&
  glob.BloodPool.tierOf('aether:zanite_chestplate') == 0)
bo.status = []
setReal(bo, 38, stack('deeperdarker:resonarium_chestplate', 1)); setReal(bo, 39, stack('aether:gravitite_helmet', 1))
ticks(19)
ok('a sealed chestplate worn (resonarium, Tier 7, at Tier 5) stays on until the next check (every second)', bo.inventory.getItem(38).id == 'deeperdarker:resonarium_chestplate')
ticks(1)
ok('... then it\'s taken off into the inventory, and the action bar says until when', bo.inventory.getItem(38).count <= 0 &&
  bo.inventory.slots.slice(0, 36).some(s => s.id == 'deeperdarker:resonarium_chestplate' && s.count == 1) &&
  bo.status.some(l => l == 'The <item.deeperdarker.resonarium_chestplate> is sealed until the Blood Pool opens Tier 7 (A River).'), bo.status.join(' | '))
ok('... an open piece (gravitite, Tier 4) stays on', bo.inventory.getItem(39).id == 'aether:gravitite_helmet')
const mainSave = bo.inventory.slots.slice(0, 36).map(s => s)
for (let i = 0; i < 36; i++) setReal(bo, i, stack('minecraft:cobblestone', 64))
setReal(bo, 36, stack('deeperdarker:warden_boots', 1)); bo.ground = []
const dropsBefore = W.drops.length
ticks(20)
ok('... with no room in the inventory, the sealed piece is dropped at the player\'s feet', bo.inventory.getItem(36).count <= 0 &&
  W.drops.slice(dropsBefore).some(d => d.item == 'deeperdarker:warden_boots' && d.by == 'drop:' + bo.name))
// Warden armour clears Blindness and Darkness from main slot 3 too (the 4th hotbar slot), worn or not.
setReal(bo, 3, EMPTY())
setReal(bo, 36, stack('deeperdarker:warden_boots', 1))
ticks(20)
ok('... and with only slot 3 free (the 4th hotbar slot, where warden armour works unworn), it\'s dropped rather than put there',
  bo.inventory.getItem(3).count <= 0 && W.drops.slice(dropsBefore).filter(d => d.item == 'deeperdarker:warden_boots').length == 2)
for (let i = 0; i < 36; i++) setReal(bo, i, mainSave[i])
setReal(bo, 3, stack('deeperdarker:warden_leggings', 1)); bo.status = []
ticks(20)
ok('a sealed warden piece kept in hotbar slot 4 (main slot 3) is moved out of it, and the action bar says why',
  bo.inventory.getItem(3).count <= 0 && bo.inventory.slots.slice(0, 36).some((s, i) => i != 3 && s.id == 'deeperdarker:warden_leggings') &&
  bo.status.some(l => /warden_leggings> is sealed until the Blood Pool opens Tier 7/.test(l)), bo.status.join(' | '))
setReal(bo, 3, stack('deeperdarker:warden_helmet', 1))
fire('inventoryChanged', { player: bo, item: stack('deeperdarker:warden_helmet', 1) })
ok('... at once when it\'s put there (the inventory event)', bo.inventory.getItem(3).count <= 0)
setReal(bo, 3, stack('deeperdarker:resonarium_chestplate', 1))
ticks(20)
ok('... while other sealed armour may sit there (it does nothing unworn)', bo.inventory.getItem(3).id == 'deeperdarker:resonarium_chestplate')
for (let i = 0; i < 36; i++) setReal(bo, i, mainSave[i])
// The Aether's gloves sit in a Curios slot. The test takes any sealed piece there: at Tier 5 the gloves are all open.
const curioSlots = [stack('aether:netherite_gloves', 1), stack('deeperdarker:resonarium_leggings', 1)]
bo.curios = { getSlots: () => curioSlots.length, getStackInSlot: i => curioSlots[i], setStackInSlot: (i, s) => { curioSlots[i] = s } }
ticks(20)
ok('a sealed piece in a Curios slot is taken off too; open gloves (netherite, Tier 5) stay on',
  curioSlots[1].count <= 0 && curioSlots[0].id == 'aether:netherite_gloves' && bo.inventory.slots.slice(0, 36).some(s => s.id == 'deeperdarker:resonarium_leggings'))
ok('... and the log says whose and what', W.logs.some(l => /Took sealed gear off .*deeperdarker:resonarium_leggings/.test(l)), W.logs.slice(-3).join(' | '))
ok('Curios loaded without a warning', !W.logs.some(l => /Curios not found/.test(l)))
delete bo.curios
// Put on between two checks (the inventory screen, a dispenser): it comes off at once, so its powers never work.
setReal(bo, 38, stack('deeperdarker:resonarium_chestplate', 1)); bo.status = []
fire('inventoryChanged', { player: bo, item: stack('deeperdarker:resonarium_chestplate', 1) })
ok('sealed armour put on between checks comes off at once (the inventory event), not up to a second later',
  bo.inventory.getItem(38).count <= 0 && bo.inventory.slots.slice(0, 36).some(s => s.id == 'deeperdarker:resonarium_chestplate') &&
  bo.status.some(l => /resonarium_chestplate> is sealed until the Blood Pool opens Tier 7/.test(l)), bo.status.join(' | '))
setReal(bo, 38, stack('aether:gravitite_chestplate', 1))
fire('inventoryChanged', { player: bo, item: stack('aether:gravitite_chestplate', 1) })
ok('... an open piece put on stays on (gravitite, Tier 4)', bo.inventory.getItem(38).id == 'aether:gravitite_chestplate')
setReal(bo, 38, EMPTY())
ok('right-clicking sealed armour to put it on is refused (warden, Tier 7); open armour still goes on',
  !useItem(bo, stack('deeperdarker:warden_helmet', 1)) && useItem(bo, stack('aether:gravitite_helmet', 1)))
ok('... but clicking a block while holding it isn\'t refused (a chest still opens)', clickBlockWith(bo, stack('deeperdarker:warden_helmet', 1)))
cy.online = true
setReal(cy, 38, stack('deeperdarker:warden_chestplate', 1))
ticks(20)
ok('creative players keep sealed armour on', cy.inventory.getItem(38).id == 'deeperdarker:warden_chestplate')
cy.online = false
setReal(bo, bo.selected, stack('deeperdarker:warden_sword', 1)); bo.status = []
ok('a hit with a sealed sword (warden, Tier 7) does nothing, and says why', !hit(bo) && bo.status.some(l => /warden_sword> is sealed until the Blood Pool opens Tier 7 \(A River\)/.test(l)), bo.status.join(' | '))
ok('... nor can it break a block', !breakWith(bo))
// Better Combat's dual wielding swings the off-hand weapon while the main hand still reads as the other one.
setReal(bo, bo.selected, stack('minecraft:diamond_sword', 1)); setReal(bo, 40, stack('deeperdarker:warden_sword', 1)); bo.status = []
ok('a sealed sword in the off hand (Better Combat dual wielding) stops hits too, and says why',
  !hit(bo) && bo.status.some(l => /warden_sword> is sealed until the Blood Pool opens Tier 7/.test(l)), bo.status.join(' | '))
setReal(bo, 40, stack('aether:zanite_sword', 1))
ok('... an open one there (zanite, Tier 5) doesn\'t', hit(bo))
setReal(bo, 40, EMPTY())
setReal(bo, bo.selected, stack('aether:zanite_sword', 1))
ok('the zanite sword (Tier 5) works at Tier 5; so do ordinary weapons and bare hands', hit(bo) && (setReal(bo, bo.selected, stack('minecraft:diamond_sword', 1)), hit(bo)) && (setReal(bo, bo.selected, EMPTY()), hit(bo)))
setReal(bo, bo.selected, stack('deeperdarker:warden_pickaxe', 1))
ok('a sealed tool can\'t break blocks', !breakWith(bo))
setReal(bo, bo.selected, stack('aether:gravitite_pickaxe', 1))
ok('... an open one (gravitite, Tier 4) can', breakWith(bo))
ok('right-clicking a sealed staff (sonorous, Tier 9) is refused, in the air and on a block', !useItem(bo, stack('deeperdarker:sonorous_staff', 1)) && !clickBlockWith(bo, stack('deeperdarker:sonorous_staff', 1)))
ok('... and a sealed tool on a block (a warden pickaxe), while an open one (gravitite: floating blocks) works', !clickBlockWith(bo, stack('deeperdarker:warden_pickaxe', 1)) && clickBlockWith(bo, stack('aether:gravitite_pickaxe', 1)))
cy.creative = true
setReal(cy, cy.selected, stack('deeperdarker:warden_sword', 1))
ok('creative players can hit and mine with sealed weapons', hit(cy) && breakWith(cy))
setReal(bo, bo.selected, stack('deeperdarker:warden_chestplate', 1))
cmd('bloodpool check', bo)
ok('/bloodpool check says wearing one is sealed too', /deeperdarker:warden_chestplate can be crafted from Tier 7 \(A River\): sealed for now, and so is wearing one/.test(flat(lastReply())), flat(lastReply()))
setReal(bo, bo.selected, stack('deeperdarker:sonorous_staff', 1))
cmd('bloodpool check', bo)
ok('... and using a wield-locked one', /deeperdarker:sonorous_staff can be crafted from Tier 9 \(A Tide\): sealed for now, and so is using one/.test(flat(lastReply())), flat(lastReply()))
// ----- All sealed gear with a power (owner decision 2026-11-25): per-item lock tiers, kits, carried items, arrows -----
const BPg = glob.BloodPool
ok('every lock list is in a tier (nothing logged at load: use, wear, wield, carry, projectile)',
  !W.logs.some(l => /(USE|WEAR|WIELD|CARRY|PROJECTILE)_LOCKS/.test(l)), W.logs.filter(l => /_LOCKS/.test(l)).join(' | '))
ok('locks wait for an item\'s true tier where its namespace says less: MekaSuit helmet 10 (Mekanism 4), dragonsteel 9 (Ice and Fire 6), terrasteel 6 and the Ring of Odin 9 (Botania 2), Draconic 10-11 (9)',
  BPg.lockTierOf('mekanism:mekasuit_helmet') == 10 && BPg.tierOf('mekanism:mekasuit_helmet') == 4 &&
  BPg.lockTierOf('iceandfire:dragonsteel_fire_sword') == 9 && BPg.tierOf('iceandfire:dragonsteel_fire_sword') == 6 &&
  BPg.lockTierOf('botania:terrasteel_helmet') == 6 && BPg.lockTierOf('botania:odin_ring') == 9 &&
  BPg.lockTierOf('draconicevolution:wyvern_sword') == 10 && BPg.lockTierOf('draconicevolution:chaotic_chestpiece') == 11 &&
  BPg.lockTierOf('draconicevolution:wyvern_bow') == 10 && BPg.lockTierOf('iceandfire:armor_red_chestplate') == 6)
setReal(bo, 39, stack('mekanism:mekasuit_helmet', 1)); bo.status = []
ticks(20)
ok('a MekaSuit helmet (crafting Tier 4, open) is taken off until Tier 10, and the action bar names Tier 10',
  bo.inventory.getItem(39).count <= 0 && bo.status.some(l => /mekasuit_helmet> is sealed until the Blood Pool opens Tier 10/.test(l)), bo.status.join(' | '))
setReal(bo, bo.selected, stack('iceandfire:dragonsteel_ice_sword', 1)); bo.status = []
ok('a dragonsteel sword (Ice and Fire, Tier 6) can\'t hit until Tier 9', !hit(bo) && bo.status.some(l => /dragonsteel_ice_sword> is sealed until the Blood Pool opens Tier 9/.test(l)), bo.status.join(' | '))
cmd('bloodpool check', bo)
ok('/bloodpool check says the lock waits for a later tier than the recipe',
  /iceandfire:dragonsteel_ice_sword can be crafted from Tier 6 \(A Stream\): sealed for now\. Using one waits for Tier 9 \(A Tide\), however it was got\./.test(flat(lastReply())), flat(lastReply()))
ok('Kikoku, troll weapons and Create\'s sabers can\'t hit; the gorgon head, scepters, brooms and dislocators can\'t be used',
  ['extrautilitiesreborn:kikoku', 'iceandfire:troll_weapon_hammer', 'create_sabers:brass_saber', 'mekanism:meka_tool'].every(id => (setReal(bo, bo.selected, stack(id, 1)), !hit(bo))) &&
  ['iceandfire:gorgon_head', 'twilightforest:fortification_scepter', 'hexerei:willow_broom', 'draconicevolution:player_dislocator'].every(id => !useItem(bo, stack(id, 1))))
ok('the gear check\'s tier moves (26 Nov): resonarium armour 7, sea serpent 7, Kikoku and the Etheric Sword 9, the dread knight and ghost swords 8, dragonbone arrows 8, Tinker\'s Rapier 8, the terra blade, Thundercaller and Starcaller 6, the giant sword 5, arctic armour 5, the enchanter\'s sword 5',
  BPg.tierOf('deeperdarker:resonarium_boots') == 7 && BPg.tierOf('iceandfire:tide_red_chestplate') == 7 &&
  BPg.tierOf('extrautilitiesreborn:kikoku') == 9 && BPg.tierOf('extrautilitiesreborn:etheric_sword') == 9 &&
  BPg.tierOf('iceandfire:dread_knight_sword') == 8 && BPg.tierOf('iceandfire:ghost_sword') == 8 && BPg.tierOf('iceandfire:dragonbone_arrow') == 8 &&
  BPg.tierOf('tinker_rapier:rapier_tic') == 8 && BPg.tierOf('botania:terra_sword') == 6 && BPg.lockTierOf('botania:thunder_sword') == 6 &&
  BPg.lockTierOf('botania:star_sword') == 6 && BPg.tierOf('twilightforest:giant_sword') == 5 && BPg.tierOf('twilightforest:arctic_helmet') == 5 &&
  BPg.tierOf('ars_nouveau:enchanters_sword') == 5 && BPg.tierOf('extrautilitiesreborn:healing_axe') == 7)
// Kit items from the arena, the Purge and the Shrine are never held (the arena's troll and Terra Knight kits are sealed gear).
setReal(bo, bo.selected, stack('iceandfire:troll_weapon_hammer', 1, '{GladiatorKit:1b}'))
ok('a Gladiator Arena kit\'s troll hammer still hits (kit items are never held)', hit(bo))
setReal(bo, 38, stack('botania:terrasteel_chestplate', 1, '{PurgeKit:1b}')); setReal(bo, 39, stack('iceandfire:armor_red_helmet', 1, '{ShrineKit:1b}'))
ticks(20)
ok('... nor are Purge or Shrine kit pieces taken off', bo.inventory.getItem(38).id == 'botania:terrasteel_chestplate' && bo.inventory.getItem(39).id == 'iceandfire:armor_red_helmet')
setReal(bo, 38, EMPTY()); setReal(bo, 39, EMPTY())
// Carried items (CARRY_LOCKS) go to the ender chest.
const ender = []
for (let i = 0; i < 27; i++) ender.push(EMPTY())
bo.enderChestInventory = { getContainerSize: () => 27, getItem: i => ender[i], setItem: (i, s) => { ender[i] = s } }
setReal(bo, 5, stack('reliquary:phoenix_down', 1)); bo.status = []
fire('inventoryChanged', { player: bo, item: stack('reliquary:phoenix_down', 1) })
ok('a sealed phoenix down (Reliquary, Tier 6) carried goes into the ender chest at once, and the action bar says so',
  bo.inventory.getItem(5).count <= 0 && ender.some(s => s.id == 'reliquary:phoenix_down') &&
  bo.status.some(l => /phoenix_down> is sealed until the Blood Pool opens Tier 6 \(A Stream\)\. It's in your ender chest\./.test(l)), bo.status.join(' | '))
setReal(bo, 40, stack('reliquary:angelic_feather', 1))
ticks(20)
ok('... from the off hand too, at the check', bo.inventory.getItem(40).count <= 0 && ender.some(s => s.id == 'reliquary:angelic_feather'))
const curioCarry = [stack('twilightforest:charm_of_keeping_3', 1)]
bo.curios = { getSlots: () => 1, getStackInSlot: i => curioCarry[i], setStackInSlot: (i, s) => { curioCarry[i] = s } }
ticks(20)
ok('... and from a Curios slot (a charm of keeping III, Twilight, Tier 7)', curioCarry[0].count <= 0 && ender.some(s => s.id == 'twilightforest:charm_of_keeping_3'))
delete bo.curios
for (let i = 0; i < 27; i++) ender[i] = stack('minecraft:dirt', 64)
setReal(bo, 6, stack('reliquary:angelheart_vial', 1))
const dropsCarry = W.drops.length
ticks(20)
ok('... with a full ender chest it\'s dropped at the player\'s feet', bo.inventory.getItem(6).count <= 0 &&
  W.drops.slice(dropsCarry).some(d => d.item == 'reliquary:angelheart_vial'))
setReal(bo, 7, stack('reliquary:mob_charm', 1))
ticks(20)
ok('... unlisted items stay put', bo.inventory.getItem(7).id == 'reliquary:mob_charm')
setReal(bo, 7, EMPTY()); delete bo.enderChestInventory
// Sealed arrows: the hit of a dragonbone arrow fired from any bow does nothing.
const shoot = (p, type) => { const ev = { entity: entity('minecraft:zombie', OW, 0, 64, 0, []), source: { player: p, actual: p, directEntity: entity(type, OW, 0, 64, 0, []), getMsgId: () => 'arrow' }, cancel() { throw new Exit() } }; fire('hurt', ev); return !ev.cancelled }
setReal(bo, bo.selected, stack('minecraft:bow', 1)); bo.status = []
ok('a dragonbone arrow (Ice and Fire, Tier 8 since 26 Nov) shot from an open bow hits for nothing, and says why',
  !shoot(bo, 'iceandfire:dragon_arrow') && bo.status.some(l => /item\.iceandfire\.dragonbone_arrow> is sealed until the Blood Pool opens Tier 8/.test(l)), bo.status.join(' | '))
ok('... an ordinary arrow hits', shoot(bo, 'minecraft:arrow'))
setReal(bo, bo.selected, heldSave)
cmd('bloodpool settier 6', admin); advance(25)
ok('at Tier 6, dragon scale armour, the gorgon head and the terra blade open; dragonbone arrows (8), dragonsteel (9) and Kikoku (9) stay held',
  (setReal(bo, 39, stack('iceandfire:armor_red_helmet', 1)), ticks(20), bo.inventory.getItem(39).id == 'iceandfire:armor_red_helmet') &&
  useItem(bo, stack('iceandfire:gorgon_head', 1)) && !shoot(bo, 'iceandfire:dragon_arrow') &&
  (setReal(bo, bo.selected, stack('botania:terra_sword', 1)), hit(bo)) &&
  (setReal(bo, bo.selected, stack('iceandfire:dragonsteel_fire_sword', 1)), !hit(bo)) &&
  (setReal(bo, bo.selected, stack('extrautilitiesreborn:kikoku', 1)), !hit(bo)))
setReal(bo, 39, EMPTY()); setReal(bo, bo.selected, heldSave)
ok('Tier 6 open: the raygun works for everyone', useItem(bo, gun()) && useItem(admin, gun()))
cmd('bloodpool settier 5', admin); advance(25); reload()
ok('... and it\'s refused again back at Tier 5 (after a reload too)', !useItem(bo, gun()))
// The rest of what Part I players may have brought: guns, staffs and teleporters; tools used on blocks or mobs; and
// placing (or dispensing) the Tier 11 blocks.
const canUse = id => useItem(bo, stack(id, 1))
const SEALED_USE = ['ae2:matter_cannon', 'reliquary:handgun', 'reliquary:rending_gale', 'mekanism_weaponry:tesla_minigun', 'draconicevolution:dislocator', 'alexsmobs:dimensional_carver', 'evilcraft:mace_of_destruction']
ok('Tier 5: sealed guns, staffs and teleporters can\'t be used', SEALED_USE.every(id => !canUse(id)), SEALED_USE.filter(canUse).join(','))
ok('... but the ones whose tier is open work (Revolver, Tier 3; Staff of Travelling, Tier 5; EvilCraft broom, Tier 2)', ['immersiveengineering:revolver', 'enderio:staff_of_travelling', 'evilcraft:broom'].every(canUse))
ok('a sealed tool used on blocks (the Entropy Manipulator) is refused on a block and in the air', !useOn(bo, 'minecraft:stone', stack('ae2:entropy_manipulator', 1)) && !canUse('ae2:entropy_manipulator'))
ok('... but holding a sealed gun doesn\'t stop a player opening a chest, and an open tier\'s rod works on blocks (Rod of the Lands, Tier 2)',
  useOn(bo, 'minecraft:chest', gun()) && useOn(bo, 'minecraft:stone', stack('botania:dirt_rod', 1)))
const onMob = (p, s) => { const ev = { player: p, hand: 'MAIN_HAND', item: s, target: entity('minecraft:cow', OW, 3001, 64, 3000), cancel() { throw new Exit() } }; fire('entityInteracted', ev); return !ev.cancelled }
ok('a sealed item used on mobs (the Totem of Possession) is refused on a mob; other items on a mob are fine', !onMob(bo, stack('alexscaves:totem_of_possession', 1)) && onMob(bo, gun()) && onMob(bo, stack('minecraft:lead', 1)))
bo.status.length = 0
const TIER11_BLOCKS = ['alexscaves:nuclear_bomb', 'alexscaves:tremorzilla_egg', 'extrautilitiesreborn:ender_quarry']
ok('Tier 5: the Nuclear Bomb, Tremorzilla Egg and Ender Quarry can\'t be placed; other blocks can', TIER11_BLOCKS.every(id => !place(bo, id)) && place(bo, 'minecraft:stone'), TIER11_BLOCKS.filter(id => place(bo, id)).join(','))
ok('... the player is told why, with the block\'s name', bo.status[0] == 'The <block.alexscaves.nuclear_bomb> is sealed until the Blood Pool opens Tier 11 (An Ocean).', bo.status.join(' | '))
ok('... nor by an op in survival, nor by something that isn\'t a player; a creative player can', !place(admin, 'alexscaves:nuclear_bomb') && !place(null, 'alexscaves:nuclear_bomb') && place(cy, 'alexscaves:nuclear_bomb'))
const nuke = () => entity('alexscaves:nuclear_bomb', OW, 3000, 64, 3000)
ok('a primed Nuclear Bomb (a dispenser fires one with no block placed) is stopped from spawning, and logged; other entities spawn',
  !fireSpawn(nuke()) && W.logs.some(l => /Stopped alexscaves:nuclear_bomb from spawning: alexscaves:nuclear_bomb is sealed until Tier 11/.test(l)) && fireSpawn(entity('minecraft:cow', OW, 0, 64, 0)))
setReal(bo, bo.selected, stack('alexscaves:nuclear_bomb', 1))
cmd('bloodpool check', bo)
ok('/bloodpool check says placing one is sealed too', /sealed for now, and so is placing one/.test(flat(lastReply())), flat(lastReply()))
cmd('bloodpool settier 11', admin); advance(25)
ok('Tier 11 open: the bomb can be placed and fired, and the Mace of Destruction used', place(bo, 'alexscaves:nuclear_bomb') && fireSpawn(nuke()) && canUse('evilcraft:mace_of_destruction'))
cmd('bloodpool settier 5', admin); advance(25); reload()
// ----- /potatowar next (without the tree) -----
replies.length = 0; cmd('potatowar next', ana)
ok('/potatowar next: rank and crafting access', replies.some(r => /Crafting access: Tier 3 of 5 open\. Potato Soldier crafts it all: 47,500 potatoes to go/.test(flat(r))), replies.map(flat).join(' | '))
// ----- /bloodpool audit -----
cmd('bloodpool audit', bo); ok('/bloodpool audit is op-only', lastReply() == 'DENIED')
cmd('bloodpool audit', admin)
ok('/bloodpool audit asks for the report and reloads', W.files['kubejs/progression_audit_request.json'].requested == 'true' && /progression_audit\.json/.test(flat(lastReply())))
W.addedRecipes = []; advance(25); reload()
const rep = W.files['kubejs/progression_audit.json']
ok('the report is written, and the request cleared', !!rep && W.files['kubejs/progression_audit_request.json'].requested == 'false')
ok('... it lists a crafting-type recipe above catch-up without the rank check, and not one below (IE treated wood, Tier 3)', rep && rep.ungatedCraftingRecipes.some(x => x.id == 'thermal:crafting/fluid_thing' && x.tier == 5) && !rep.ungatedCraftingRecipes.some(x => x.id == 'immersiveengineering:crafting/treated_wood_horizontal'), JSON.stringify(rep && rep.ungatedCraftingRecipes))
ok('... and a recipe that still makes a sealed item, unseen by KubeJS', rep && rep.sealedItemsStillMade.some(x => x.id == 'somemod:machine/manyullyn_maker' && x.tier == 8 && x.kubejsSeesIt === false))
ok('... and the counts (rank-checked recipes per tier, conversions)', rep && rep.gatedByTier[5] >= 1 && rep.converted.done == 4)
ok('the log has the audit summary', W.logs.some(l => /Audit \(tier 5, \d+ recipes\)/.test(l)))
// ----- /bloodpool gatecheck: what the game holds, not what the script tried -----
cmd('bloodpool gatecheck', bo); ok('/bloodpool gatecheck is op-only', lastReply() == 'DENIED')
cmd('bloodpool gatecheck', admin)
const gc = () => flat(lastReply())
ok('/bloodpool gatecheck: every rank check is live', /(\d+) of \1 rank checks are live/.test(gc()) && !/of 0 /.test(gc()), gc())
W.forceVanilla = { 'thermal:machine_frame': true }; W.brokenRecipes = { 'mekanism:shaft_compat': true }
cmd('bloodpool gatecheck', admin)
ok('... it names a recipe that ignores its check', !/(\d+) of \1 rank checks/.test(gc()) && /thermal:machine_frame/.test(gc()), gc())
ok('... and a recipe that failed to load', /mekanism:shaft_compat/.test(gc()), gc())
W.forceVanilla = null; W.brokenRecipes = null
const n0 = W.logs.length; reload()
ok('the next reload doesn\'t run it again', !W.logs.slice(n0).some(l => /Audit \(/.test(l)))
// ---------- ranks are never lost: the peak (and the Purge's Potato Heist) ----------
{
  const D0 = PDB()
  D0.standing['peak-old'] = { name: 'OldRecord', potatoes: 30000 }    // saved before `peak` existed: rank 4 (25,000)
  W.persistent.blood_pool = JSON.stringify(D0)
  reload()
  const BP = glob.BloodPool                                            // the reloaded script's API
  ok('a record from before the peak keeps exactly the rank its potatoes buy now (no old thresholds brought back)', BP.standingOfUuid('peak-old').earned == 4)
  const rich = { getStringUuid: () => 'heist-rich', getGameProfile: () => ({ getName: () => 'Rich' }), server }
  BP.creditStanding(rich, 60000)
  ok('heist setup: 60,000 potatoes earns Potato Soldier (rank 5)', BP.standingOfUuid('heist-rich').earned == 5 && BP.standingOfUuid('HEIST-RICH').potatoes == 60000)
  ok('takeStanding takes what is asked and returns it', BP.takeStanding('heist-rich', 'Rich', 2500) == 2500 && BP.standingOfUuid('heist-rich').potatoes == 57500)
  ok('... never more than they have', BP.takeStanding('heist-rich', 'Rich', 999999) == 57500 && BP.standingOfUuid('heist-rich').potatoes == 0)
  ok('... and the rank is kept (the peak)', BP.standingOfUuid('heist-rich').earned == 5 && PDB().standing['heist-rich'].peak == 5)
  ok('... nothing to take: 0', BP.takeStanding('heist-rich', 'Rich', 100) == 0 && BP.takeStanding('nobody-at-all', 'Nobody', 100) == 0)
  BP.creditStanding(rich, 1000)
  ok('offering more after a theft never lowers the kept rank', BP.standingOfUuid('heist-rich').earned == 5 && PDB().standing['heist-rich'].potatoes == 1000)
  cmd('potatowar add Rich 100', admin)
  ok('/potatowar add keeps it too', BP.standingOfUuid('heist-rich').earned == 5 && PDB().standing['heist-rich'].potatoes == 1100)
  cmd('potatowar set Rich 1100', admin)
  ok('/potatowar set (op) can lower it to what the potatoes now buy', BP.standingOfUuid('heist-rich').earned == 2 && PDB().standing['heist-rich'].peak == 2)
  BP.giveStanding('heist-new', 'Newcomer', 3000)
  ok('giveStanding works for a player the Potato War has never seen (offline): rank 3', BP.standingOfUuid('heist-new').potatoes == 3000 && BP.standingOfUuid('heist-new').earned == 3 && PDB().standing['heist-new'].name == 'Newcomer')
  BP.giveStanding('heist-new', '', 0)
  ok('... 0 or less does nothing, and a blank name keeps the old one', BP.standingOfUuid('heist-new').potatoes == 3000 && PDB().standing['heist-new'].name == 'Newcomer')
}

// ---------- the potato share (Option A), the price revealed (Tier 5), the Oven (Tier 8), Full Measure (Tier 12) ----------
{
  const saved = W.persistent.blood_pool
  const BPx = () => glob.BloodPool
  const empty = p => { p.inventory.slots.forEach((s, i) => { if (i < 36) p.inventory.slots[i] = EMPTY() }) }
  const edit = fn => { const D = PDB(); fn(D); W.persistent.blood_pool = JSON.stringify(D); reload() }
  const reply = () => flat(lastReply())
  const fixture = recipe('kubejs:potato_press', 'minecraft:crafting_shaped', 'kubejs:potato_press')
  const tier11 = recipe('mekanism:sps_casing', 'minecraft:crafting_shaped', 'mekanism:sps_casing')     // a Tier 11 item
  W.mockRecipes.push(fixture, tier11)
  // --- before the reveal ---
  W.addedRecipes = []
  cmd('bloodpool settier 4', admin); advance(25); reload()
  ok('before the reveal (Tier 4): not revealed, and nobody has the stage', !BPx().revealed() && !ana.stages.has('potato_war_revealed'))
  // event.remove doesn't reach a recipe added in the same event (seen on the test server), so a sealed one is never added.
  ok('... the Potato Press and Oven get no recipe while sealed (Press: Tier 5, Oven: Tier 8)', !W.addedRecipes.some(r => /^kubejs:potato_(press|oven)$/.test(r.rid || '')),
    W.addedRecipes.map(r => r.rid).join(','))
  replies.length = 0; cmd('potatowar ranks', bo)
  ok('... /potatowar ranks prices every rank in potatoes (rank 6: 400,000 potatoes)', /6\. Potato Sergeant: 400,000 potatoes/.test(flat(replies[5])) &&
    /11\. Potato Emperor: 4,400,000 potatoes/.test(flat(replies[10])), flat(replies[5]))
  cmd('potatowar set Ana 1000000', admin)
  ok('... a million potatoes earns rank 7 at the old prices, held at Potato Soldier by the Pool', BPx().standing(ana).earned == 7 && BPx().standing(ana).tier == 5,
    JSON.stringify(BPx().standing(ana)))
  // the potato share: Tier 5 is 200,000 to 320,000 Drops; potatoes may pay 75% of that 120,000 = 90,000
  edit(D => { D.drops = 200000; D.potatoByTier = {}; D.potatoDrops = 0; D.potatoByPlayer = {} })
  empty(bo); give(bo, 'minecraft:potato', 400)
  cmd('bloodpool tithe', bo)
  ok('the tithe fills the next tier (5) with potatoes: 400 potatoes, 100 Drops, counted toward Tier 5\'s share',
    PDB().drops == 200100 && PDB().potatoByTier['5'] == 100 && countOf(bo, 'minecraft:potato') == 0, reply())
  cmd('bloodpool', bo)
  ok('/bloodpool says how much potatoes may still pay', /Potatoes may pay 90,000 of its 120,000 Drops \(100 paid\); the rest must be blood\./.test(reply()), reply())
  edit(D => { D.potatoByTier = { 5: 89990 } })
  give(bo, 'minecraft:potato', 400); cmd('bloodpool tithe', bo)
  ok('near the share: only what is left (10 Drops, 40 potatoes) is taken, and it says why', PDB().drops == 200110 && PDB().potatoByTier['5'] == 90000 &&
    countOf(bo, 'minecraft:potato') == 360 && /That is all potatoes may pay toward Tier 5; the rest must be blood\./.test(reply()), reply())
  cmd('bloodpool tithe', bo)
  ok('... then the tithe is refused: the rest must be blood', /Potatoes have paid all they may toward Tier 5 \(90,000 of its 120,000 Drops\)\. The rest must be blood/.test(reply()) &&
    countOf(bo, 'minecraft:potato') == 360, reply())
  global.BloodPoolAddDrops = null
  BPx().addDrops(5000, 'troll', 'bo-1111', 'Bo')
  ok('... while blood still fills it (a troll\'s Drops count, past the potatoes\' share)', PDB().drops == 205110)
  edit(D => { D.potatoByTier = {}; D.drops = 319990 })
  cmd('bloodpool tithe', bo)
  ok('potatoes never fill a tier past its threshold: 10 Drops to reach 320,000, "That fills Tier 5."', PDB().drops == 320000 && /That fills Tier 5\./.test(reply()) &&
    countOf(bo, 'minecraft:potato') == 320, reply())
  cmd('bloodpool tithe', bo)
  ok('... and a full tier waits for its seal: refused', /Tier 5 \(A Spring\) is full\. Its seal must break before the Pool takes more potatoes\./.test(reply()) && PDB().drops == 320000, reply())
  // --- the reveal: Tier 5 opens with an announcement ---
  const cRv = W.cmds.length, nRv = W.logs.length
  cmd('bloodpool unlock', admin)
  ok('opening Tier 5 queues the reveal for after the reload', PDB().tier == 5 && PDB().pending.indexOf('reveal') >= 0)
  ok('... and prices ranks in their units: Ana\'s million potatoes no longer buy rank 7 (her peak comes down to 5)',
    PDB().standing['ana-1111'].peak == 5 && BPx().standing(ana).earned == 5 && W.logs.slice(nRv).some(l => /Peaks lowered: Ana 7->5/.test(l)),
    JSON.stringify(PDB().standing['ana-1111']))
  ok('... everyone online gets the stage potato_war_revealed', [admin, ana, bo].every(p => p.stages.has('potato_war_revealed')))
  advance(25); reload(); advance(130)
  const rv = said(cRv)
  ok('after the reload the Blood God reveals it (naming the Ministry), with a title', rv.some(l => /Did you think that was all they were\?/.test(l)) &&
    rv.some(l => /holds back the Ministry/.test(l)) && rv.some(l => /The numbers have not changed\. Only what they count\./.test(l)) &&
    rv.some(l => /The Potato Press is yours to craft: 160 potatoes make one Enchanted Potato/.test(l)) &&
    cmdsSince(cRv).some(c => /^title @a title .*IT WAS NEVER POTATOES/.test(c)), rv.join(' | '))
  ok('... once: the queue is empty and another reload says nothing', PDB().pending.length == 0 && (() => { const c = W.cmds.length; reload(); advance(130); return !said(c).some(l => /Did you think/.test(l)) })())
  ok('... the Potato Press recipe is added now (the Oven\'s still isn\'t), with its pattern', (() => {
    const r = W.addedRecipes.find(x => x.rid == 'kubejs:potato_press')
    return !!r && r.result == 'kubejs:potato_press' && r.pattern.join('/') == 'CCC/PBP/III' && r.key.B == 'minecraft:barrel' && !W.addedRecipes.some(x => x.rid == 'kubejs:potato_oven')
  })(), W.addedRecipes.map(r => r.rid).join(','))
  ok('... and needs no rank (Potato Soldier\'s Tier 5 recipes do)', !has('{"output":"kubejs:potato_press"}') &&
    stagedOf('kubejs:potato_press') == null && stagedOf('thermal:machine_frame') == 'potato_standing_5', stagedOf('kubejs:potato_press') + ' / ' + stagedOf('thermal:machine_frame'))
  replies.length = 0; cmd('potatowar ranks', bo)
  ok('/potatowar ranks: the same numbers, revealed (5: 50,000 potatoes; 6: 400,000 Enchanted Potatoes; 9: 2,000,000 Enchanted Baked Potatoes)',
    /5\. Potato Soldier: 50,000 potatoes/.test(flat(replies[4])) && /6\. Potato Sergeant: 400,000 Enchanted Potatoes/.test(flat(replies[5])) &&
    /9\. Potato General: 2,000,000 Enchanted Baked Potatoes/.test(flat(replies[8])), replies.map(flat).join(' | '))
  cmd('potatowar', ana)
  ok('/potatowar shows the next rank in Enchanted Potatoes', /1,000,000 potatoes' worth offered: Potato Soldier\. Potato Sergeant at 400,000 Enchanted Potatoes \(393,750 Enchanted Potatoes to go\)/.test(reply()), reply())
  empty(ana); give(ana, 'kubejs:enchanted_potato', 3)
  cmd('potatowar offer 2', ana)
  ok('/potatowar offer 2 counts in her next rank\'s unit: 2 Enchanted Potatoes (320 potatoes\' worth)', PDB().standing['ana-1111'].potatoes == 1000320 &&
    countOf(ana, 'kubejs:enchanted_potato') == 1 && /320 potatoes' worth offered/.test(reply()), reply())
  // the tithe toward Tier 6 takes Enchanted Potatoes; change from an Enchanted Baked Potato comes back as Enchanted Potatoes
  edit(D => { D.drops = 320000; D.potatoByTier = {}; D.potatoDrops = 0; D.potatoByPlayer = {} })
  empty(bo); give(bo, 'kubejs:enchanted_baked_potato', 1)
  cmd('bloodpool tithe 4', bo)
  ok('tithe 4 (Enchanted Potatoes) from an Enchanted Baked Potato: 1 Drop, 156 Enchanted Potatoes back as change', PDB().drops == 320001 &&
    countOf(bo, 'kubejs:enchanted_baked_potato') == 0 && countOf(bo, 'kubejs:enchanted_potato') == 156 && countOf(bo, 'minecraft:potato') == 0, reply())
  // --- the Oven: Tier 8 opens with its line ---
  cmd('bloodpool settier 7', admin); advance(25); reload()
  edit(D => { D.drops = 1000000 })
  const cOv = W.cmds.length
  cmd('bloodpool unlock', admin); advance(25); reload(); advance(130)
  ok('opening Tier 8 announces the Potato Oven, and its recipe is added', said(cOv).some(l => /The Potato Oven can be crafted: 160 Enchanted Potatoes bake into one Enchanted Baked Potato/.test(l)) &&
    W.addedRecipes.some(x => x.rid == 'kubejs:potato_oven' && x.key.P == 'kubejs:potato_press'), said(cOv).join(' | '))
  edit(D => { D.potatoByTier = {}; D.potatoDrops = 0; D.potatoByPlayer = {} })
  cmd('bloodpool tithe', bo)
  ok('toward Tier 9 the tithe takes Enchanted Baked Potatoes: 156 Enchanted Potatoes aren\'t enough for one Drop', /takes Enchanted Baked Potatoes in fours/.test(reply()) &&
    countOf(bo, 'kubejs:enchanted_potato') == 156, reply())
  give(bo, 'kubejs:enchanted_baked_potato', 4); cmd('bloodpool tithe 4', bo)
  ok('... 4 Enchanted Baked Potatoes make 1 Drop', PDB().drops == 1000001 && countOf(bo, 'kubejs:enchanted_baked_potato') == 0 && countOf(bo, 'kubejs:enchanted_potato') == 156, reply())
  // --- Full Measure ---
  cmd('bloodpool settier 11', admin); advance(25); reload()
  ok('Tier 11: catch-up gives Tiers 1-9 to everyone, not 10 and 11', BPx().craftAccess(bo) == 9 && bo.stages.has('potato_standing_9') && !bo.stages.has('potato_standing_10'))
  ok('... so a Tier 11 crafting recipe still needs Potato Emperor', stagedOf('mekanism:sps_casing') == 'potato_standing_11', stagedOf('mekanism:sps_casing'))
  cmd('bloodpool settier 12', admin); advance(25); reload()
  ok('Tier 12 (Full Measure): every tier\'s crafting opens to everyone (all 11 rank stages)', BPx().craftAccess(bo) == 11 && bo.stages.has('potato_standing_11') && BPx().openAllTier == 12)
  ok('... and no crafting recipe keeps a rank check', W.mockRecipes.every(r => stagedOf(r.id) == null), W.mockRecipes.filter(r => stagedOf(r.id)).map(r => r.id).join(','))
  // --- without the startup script ---
  W.missingItems['kubejs:potato_press'] = true; W.missingItems['kubejs:potato_oven'] = true; W.addedRecipes = []; reload()
  ok('without startup_scripts/potato_press.js the machines get no recipe (and nothing is logged as an error)', !W.addedRecipes.some(r => /potato_(press|oven)/.test(r.rid || '')))
  delete W.missingItems['kubejs:potato_press']; delete W.missingItems['kubejs:potato_oven']
  W.mockRecipes.splice(W.mockRecipes.indexOf(fixture), 1)
  W.mockRecipes.splice(W.mockRecipes.indexOf(tier11), 1)
  W.persistent.blood_pool = saved; reload()
  ok('(the test data is put back)', PDB().tier == JSON.parse(saved).tier)
}

// ---------- openTo: a story event opens tiers with no vote (part2/shrine.js's Awakening) ----------
{
  const saved = W.persistent.blood_pool
  cmd('bloodpool settier 2', admin); advance(25); reload()
  const c0 = W.cmds.length
  const now = glob.BloodPool.openTo(4, 'the Shrine')
  ok('global.BloodPool.openTo(4, "the Shrine") from Tier 2: Tiers 3 and 4 open at once, announced like an unlock', now == 4 && PDB().tier == 4 &&
    cmdsSince(c0).some(c => /^title @a subtitle .*Tier 4: A Font/.test(c)) && said(c0).some(l => /The seal breaks\. Tier 4 \(A Font\) is open/.test(l)) &&
    PDB().unlocks.slice(-1)[0].by == 'the Shrine', cmdsSince(c0).join(' | '))
  advance(25)
  ok('... then the server reloads, so the recipes come back', cmdsSince(c0).indexOf('reload') >= 0)
  ok('... it never lowers the tier or opens one twice', glob.BloodPool.openTo(3, 'x') == 4 && glob.BloodPool.openTo(4, 'x') == 4 && PDB().tier == 4 &&
    PDB().unlocks.slice(-1)[0].by == 'the Shrine')
  W.persistent.blood_pool = saved; reload()
}

// ---------- /bloodpool top clear confirm: the contributors list emptied, for the test server between rehearsals ----------
{
  const saved = W.persistent.blood_pool
  const before = PDB(), n = Object.keys(before.contributors).length
  ok('(there are contributors to clear)', n > 0, n)
  cmd('bloodpool top clear', ana)
  ok('/bloodpool top clear is op only', lastReply() == 'DENIED')
  cmd('bloodpool top clear', admin)
  ok('/bloodpool top clear alone only explains (it needs confirm)', /bloodpool top clear confirm/.test(flat(lastReply())) && Object.keys(PDB().contributors).length == n)
  cmd('bloodpool top clear confirm', admin)
  ok('/bloodpool top clear confirm: the list is empty, the Drops and the tier as they were', Object.keys(PDB().contributors).length == 0 &&
    new RegExp('\\(' + n + ' players? cleared\\)').test(flat(lastReply())) && PDB().drops == before.drops && PDB().tier == before.tier &&
    JSON.stringify(PDB().standing) == JSON.stringify(before.standing), flat(lastReply()))
  cmd('bloodpool top', ana)
  ok('... and /bloodpool top says nobody has given blood yet', /Nobody has given blood yet/.test(flat(lastReply())))
  W.persistent.blood_pool = saved; reload()
}

// The gate check test above logs one error on purpose.
const stray = errors().filter(l => l.indexOf('Gate check: these recipes ignore their rank check: thermal:machine_frame') < 0)
ok('no other errors logged in the Potato War tests', stray.length == 0, stray.join(' | '))

console.log(errors().join('\n') || '(no errors logged)')
console.log(fails ? fails + ' FAILED' : 'ALL PASSED')
