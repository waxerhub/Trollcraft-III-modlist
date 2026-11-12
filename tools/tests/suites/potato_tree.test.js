// Run with: node tools/tests/run_all.js potato_tree   (or node tools/tests/suites/potato_tree.test.js)
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
    getList: (k, type) => { const arr = obj && Array.isArray(obj[k]) ? obj[k] : []; return { size: () => arr.length, getString: i => String(arr[i]).replace(/^"|"$/g, '') } },
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
  getPlayerList: () => ({ getPlayer: u => players.find(p => p.online && p.uuid == u) || null }),
  getProfileCache: () => ({ get: n => { const p = players.find(x => x.name.toLowerCase() == String(n).toLowerCase()); return { isPresent: () => !!p, get: () => ({ getId: () => p.uuid, getName: () => p.name }) } } }),
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
    if ((m = c.match(/^ftbquests change_progress (\S+) (complete|reset) (\S+)$/))) {
      W.ftbqCmds = (W.ftbqCmds || []).concat([c])
      const pl = players.find(x => x.name == m[1]), PT = glob.PotatoTree
      const N = PT && PT.nodes.find(x => PT.questId(x.id) == m[3])
      if (!pl || !N) return 0
      if (m[2] == 'complete') { pl.stages.add(PT.stagePrefix + N.id); fireFtbq('#potato_offer', { player: pl, object: { getMaxProgress: () => N.potatoes } }) }
      else pl.stages.remove(PT.stagePrefix + N.id)
      return 1
    }
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
  // java.time, as the tithe uses it: the zone is a fixed UTC-5 here (Central daylight time).
  'java.time.ZoneId': { of: z => ({ z }) },
  'java.time.ZonedDateTime': { now: zone => { W.zoneAsked = zone.z; const mk = ms => ({ minusHours: h => mk(ms - h * 3600000), toLocalDate: () => ({ toString: () => new Date(ms).toISOString().slice(0, 10) }) }); return mk(W.time - 5 * 3600000) } },
  'net.minecraft.world.level.Level$ExplosionInteraction': { NONE: 'NONE', TNT: 'TNT' },
  'net.minecraft.nbt.StringTag': { valueOf: s => s },
  'dev.ftb.mods.ftbteams.api.FTBTeamsAPI': { api: () => ({ setPartyCreationFromAPIOnly: v => { W.partyApiOnly = v } }) },
  'com.mojang.brigadier.arguments.StringArgumentType': { word: () => 'word', greedyString: () => 'greedy', getString: (ctx, n) => ctx.args[n] },
})[n] || (() => { throw new Error('no class ' + n) })() }
const mkText = t => ({ text: String(t), append(o) { this.text += o.text; return this } })
const Text = { red: mkText, gold: mkText, yellow: mkText, of: mkText, lightPurple: mkText }
const Item = { of: (id, a, b) => (typeof a == 'string' ? stack(id, 1, a) : stack(id, a == null ? 1 : a, b || null)), empty: EMPTY() }
const Ingredient = { of: id => ({ id, getItemIds: () => { const t = String(id).replace(/^#/, ''); const l = (W.tagItems || {})[t] || []; return { toArray: () => l.slice() } } }), custom: (base, pred) => ({ base, pred, custom: true }) }
function fireFtbq(tag, ev) { (handlers['ftbq:' + tag] || []).forEach(h => h(ev)) }
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
  const ftbq = W.noFtbq ? undefined : { completed: (tag, cb) => { (handlers['ftbq:' + tag] = handlers['ftbq:' + tag] || []).push(cb) } }
  new Function('PlayerEvents', 'EntityEvents', 'ServerEvents', 'ItemEvents', 'BlockEvents', 'Utils', 'Text', 'Item', 'Ingredient', 'console', 'global', 'Java', 'Date', 'JsonIO', 'FTBQuestsEvents', src)(
    { loggedIn: on('loggedIn'), loggedOut: on('loggedOut'), chestOpened: on('chestOpened'), inventoryChanged: on('inventoryChanged') }, { hurt: on('hurt'), death: on('death'), spawned: on('spawned') },
    { loaded: on('loaded'), commandRegistry: f => f(ev), tags: (reg, f) => f({ add: (t, v) => { (W.addedTags = W.addedTags || {})[reg + ' ' + t] = v } }), recipes: f => { const rev = { replaceInput: (filter, from, to) => W.recipes.push({ filter, from, to }), remove: filt => { (W.removedRecipes = W.removedRecipes || []).push(JSON.parse(JSON.stringify(filt, (k, v) => v instanceof RegExp ? 're:' + v.source : v))) },
      forEachRecipe: (filt, cb) => {
        W.forEachCalls = (W.forEachCalls || 0) + 1
        const all = filt === '*', types = all ? [] : (Array.isArray(filt) ? filt : [filt]).map(x => x.type)
        const removedNow = id => (W.removedRecipes || []).some(f => f.id && (f.id === id || (/^re:/.test(f.id) && new RegExp(f.id.slice(3)).test(id))))
        ;(W.mockRecipes || []).forEach(r => { if ((all || types.indexOf(r.type) >= 0) && !removedNow(r.id)) cb(r) })
      },
      shaped: (result, pattern, key) => {
        const r = { id: null, type: 'kubejs:shaped', result, pattern, key, mirror: true, gate: null, staged: null,
          noMirror() { this.mirror = false; return this }, id(x) { this.id = x; return this }, modifyResult(cb) { this.gate = cb; return this } }
        r.id = function (x) { r.rid = x; return r }
        ;(W.addedRecipes = W.addedRecipes || []).push(r)
        return r
      } }; f(rev) } },
    { rightClicked: on('itemRightClicked'), entityInteracted: on('entityInteracted'), foodEaten: on('foodEaten'), pickedUp: on('pickedUp') }, { rightClicked: on('blockRightClicked'), placed: on('blockPlaced'), broken: on('blockBroken') },
    Utils, Text, Item, Ingredient,
    { info: m => W.logs.push('I ' + m), warn: m => W.logs.push('W ' + m), error: m => W.logs.push('E ' + m) }, glob, Java, Datex,
    { write: (path, obj) => { W.files[path] = JSON.parse(JSON.stringify(obj)) }, read: path => { const o = W.files[path]; if (!o) throw new Error('no file ' + path); return { get: k => o[k] } } }, ftbq)
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
  if (global.TREE_SRC) loadOne(global.TREE_SRC)
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


global.TREE_SRC = fs.readFileSync(REPO_ROOT + '/tools/kubejs/server_scripts/part2/potato_tree.js', 'utf8')

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
ok('no errors while loading', errors().length == 0, errors().join(' | '))

// ----- tier 4: a mod opens, its later items stay sealed -----
cmd('bloodpool settier 4', admin); advance(25); reload()
ok('tier 4: Create open (no namespace removal)', !has('{"output":"@create"}') && !has('{"mod":"create"}'))
ok('... but its later items stay sealed (trains at 7)', has('{"output":"create:sturdy_sheet"}') && has('{"output":"create:track"}'))
ok('... and its tier-3/4 items are back', !has('{"output":"create:brass_casing"}') && !has('{"output":"create:precision_mechanism"}'))
ok('tier 4: steel and steeleaf recipe rules lifted; cobalt and knightmetal still sealed',
  !rem().some(r => /\(steel\)|osmium\|steeleaf/.test(r)) && rem().some(r => /cobalt\|scorched_stone\|knightmetal/.test(r)))
ok('tier 4: TF steeleaf chestplate open, knightmetal chestplate sealed', !has('{"output":"twilightforest:steeleaf_chestplate"}') && has('{"output":"twilightforest:knightmetal_chestplate"}'))
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
// The Potato War upgrade tree (part2/potato_tree.js)
const PT = () => glob.PotatoTree
const SP = id => 'potato_tree_' + id
const statusOf = p => (p.status || []).map(c => (c && c.json) ? flat('[' + c.json + ']') : String(c && c.text != null ? c.text : c)).join(' | ')
;[admin, ana, bo].forEach(p => { p.status = []; p.setStatusMessage = c => p.status.push(c) })
const mk2 = (n, x) => { const p = mk(n, x); p.status = []; p.setStatusMessage = c => p.status.push(c); players.push(p); fire('loggedIn', { player: p }); return p }
const tool = (id, mats) => stack(id, 1, '{tic_materials:[' + mats.map(m => '"' + m + '"').join(',') + ']}')
const brk2 = (p) => { const ev = { player: p, block: { id: 'minecraft:stone', x: 0, y: 64, z: 0, level: levels[OW], getDimension: () => OW }, cancel() { throw new Exit() } }; fire('blockBroken', ev); return !!ev.cancelled }
const hit = (p) => { const victim = entity('minecraft:zombie', OW, 0, 64, 0); const ev = { entity: victim, source: { actual: p }, cancel() { throw new Exit() } }; fire('hurt', ev); return !!ev.cancelled }
const useItem = (p, s) => { const ev = { player: p, item: s, hand: 'MAIN_HAND', cancel() { throw new Exit() } }; fire('itemRightClicked', ev); return !!ev.cancelled }
const rclick = (p, blockId, held) => { const ev = { player: p, item: held || EMPTY(), hand: 'MAIN_HAND', block: { id: blockId, x: 0, y: 64, z: 0, level: levels[OW], getDimension: () => OW }, cancel() { throw new Exit() } }; fire('blockRightClicked', ev); return !!ev.cancelled }
const place = (p, id) => { const ev = { player: p, block: { id, x: 3000, y: 64, z: 3000, level: levels[OW], getDimension: () => OW }, cancel() { throw new Exit() } }; fire('blockPlaced', ev); return !!ev.cancelled }

ok('tree loaded: API, placing taken over, FTB Teams parties switched off', !!PT() && PT().handlesPlacing === true && W.partyApiOnly === true)
ok('quest and chapter ids', PT().questId('cobalt_smithing') == '507A700000010005' && PT().chapterId('ranks') == '507A70000000C001')
// The Blood Pool tests above went up to Tier 12, so catch-up already gave everyone every node; catch-up never takes
// nodes back when an op lowers the tier. Start the tree tests from a clean slate at Tier 5.
cmd('bloodpool settier 5', admin); advance(25)
ok('lowering the tier leaves caught-up nodes in place', bo.stages.has(SP('dragonsteel')))
players.forEach(p => { [...p._stages].filter(x => /^potato_tree_/.test(x)).forEach(x => p._stages.delete(x)) })
reload(); advance(30)
ok('after the reset, catch-up at Tier 5 gives back only Tier 3 and below', bo.stages.has(SP('steel_smithing')) && !bo.stages.has(SP('cobalt_smithing')))
players.forEach(p => { p.status = p.status || [] })

// ----- gear -----
const cobaltPick = tool('tconstruct:pickaxe', ['tconstruct:cobalt', 'tconstruct:wood#minecraft:oak'])
const ironPick = tool('tconstruct:pickaxe', ['tconstruct:iron', 'tconstruct:wood#minecraft:oak'])
putInHand(bo, cobaltPick)
ok('a cobalt Tinkers pickaxe without Cobalt Smithing: no breaking, no hitting, no right-click', brk2(bo) && hit(bo) && useItem(bo, bo.mainHandItem))
ok('... with a note on the action bar naming the node', /Cobalt Smithing needed \(\/potatowar tree\)/.test(statusOf(bo)), statusOf(bo))
putInHand(bo, ironPick)
ok('an iron Tinkers pickaxe works for anyone', !brk2(bo) && !hit(bo) && !useItem(bo, bo.mainHandItem))
putInHand(bo, stack('twilightforest:knightmetal_sword', 1))
ok('Twilight Forest knightmetal gear is locked by the same node', hit(bo))
putInHand(admin, cobaltPick)
ok('ops are exempt', !brk2(admin) && !hit(admin))
const boStanding0 = glob.BloodPool.standing(bo).potatoes
cmd('potatotree grant Bo cobalt_smithing', admin)
ok('/potatotree grant: the stage, the quest completed through FTB Quests, nothing credited', bo.stages.has(SP('cobalt_smithing')) &&
  W.ftbqCmds.some(c => c == 'ftbquests change_progress Bo complete 507A700000010005') && glob.BloodPool.standing(bo).potatoes == boStanding0, flat(lastReply()))
putInHand(bo, cobaltPick)
ok('... and the cobalt pickaxe works', !brk2(bo) && !hit(bo))
cmd('potatotree grant Bo cobalt_smithing', bo); ok('/potatotree is op-only', lastReply() == 'DENIED')
// armour
setReal(bo, 39, stack('twilightforest:fiery_helmet', 1))
advance(45)
ok('locked armour is taken off into the inventory', realSlots(bo)[39].isEmpty() && countOf(bo, 'twilightforest:fiery_helmet') == 1)
setReal(bo, 38, stack('twilightforest:knightmetal_chestplate', 1)); advance(45)
ok('... unlocked armour stays on', realSlots(bo)[38].id == 'twilightforest:knightmetal_chestplate')

// ----- placing and using -----
bo.status = []
ok('placing a Molecular Assembler without ME Autocrafting: refused when placed', place(bo, 'ae2:molecular_assembler'))
ok('... but holding one doesn\'t stop you opening a chest (only parts are checked when right-clicking)', !rclick(bo, 'minecraft:chest', stack('ae2:molecular_assembler', 1)))
ok('a storage bus or annihilation plane onto a cable needs ME Logistics', rclick(bo, 'ae2:cable_bus', stack('ae2:storage_bus', 1)) && rclick(bo, 'ae2:cable_bus', stack('ae2:annihilation_plane', 1)))
ok('Advanced AE\'s pattern provider part needs ME Autocrafting; its block needs it when placed', rclick(bo, 'ae2:cable_bus', stack('advanced_ae:adv_pattern_provider_part', 1)) && place(bo, 'advanced_ae:adv_pattern_provider'))
ok('a Create funnel placed on a belt (a belt funnel block) needs Create Logistics too', bo.stages.has(SP('create_logistics')) ? !place(bo, 'create:andesite_belt_funnel') : place(bo, 'create:andesite_belt_funnel'))
ok('... AE2 parts on a cable (a pattern provider) and Thermal servos on a duct are refused', rclick(bo, 'ae2:cable_bus', stack('ae2:cable_pattern_provider', 1)) && rclick(bo, 'thermal:energy_duct', stack('thermal:servo_attachment', 1)))
ok('... the message names the node', /ME Autocrafting needed/.test(statusOf(bo)) || /ME Logistics needed/.test(statusOf(bo)), statusOf(bo))
ok('ordinary blocks are placed as normal', !rclick(bo, 'minecraft:stone', stack('minecraft:stone', 1)) && !place(bo, 'minecraft:stone') && !place(bo, 'thermal:machine_pulverizer'))
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
ok('a placement or click the tree refuses sends the player\'s inventory again, a tick later', syncCount(bo, () => place(bo, 'create:mechanical_crafter')).join() == '0,1' &&
  syncCount(bo, () => rclick(bo, 'thermal:machine_insolator')).join() == '0,1')
ok('... but not an ordinary placement', syncCount(bo, () => place(bo, 'minecraft:stone')).join() == '0,0')
cmd('potatotree grant Bo mechanical_crafting', admin)
ok('with Mechanical Crafting, an Unenlisted player places a Mechanical Crafter (blood_pool.js\'s rank rule steps aside)', glob.BloodPool.standing(bo).tier == 0 && !place(bo, 'create:mechanical_crafter') && !rclick(bo, 'minecraft:stone', stack('create:mechanical_crafter', 1)))
ok('using someone else\'s Insolator or RFTools Crafter without the node: refused', rclick(bo, 'thermal:machine_insolator') && rclick(bo, 'rftoolsutility:crafter2'))
const SIMPLE = ['quark:crafter', 'botania:crafty_crate']
ok('placing or using a cheap autocrafter without Simple Crafters: refused', SIMPLE.every(id => place(bo, id) && rclick(bo, id)), SIMPLE.filter(id => !place(bo, id) || !rclick(bo, id)).join(','))
ok('placing or using Blue Power\'s Auto Project Table needs Project Automation', place(bo, 'bluepower:auto_project_table') && rclick(bo, 'bluepower:auto_project_table'))
cmd('potatotree grant Bo simple_crafting', admin); cmd('potatotree grant Bo project_automation', admin)
ok('with the nodes, all of them work', SIMPLE.concat('bluepower:auto_project_table').every(id => !place(bo, id) && !rclick(bo, id)))
ok('... but not Fancy Crafters or a Wixie, which no node unlocks', place(bo, 'bibliocraft:oak_fancy_crafter') && rclick(bo, 'bibliocraft:oak_fancy_crafter') && rclick(bo, 'minecraft:cauldron', stack('ars_nouveau:wixie_charm', 1)))
cmd('potatotree revoke Bo simple_crafting', admin); cmd('potatotree revoke Bo project_automation', admin)
ok('... the Garden Cloche (caught up at Tier 3) can be used', !rclick(bo, 'immersiveengineering:cloche'))
ok('... ordinary machines can be used by anyone', !rclick(bo, 'thermal:machine_pulverizer') && !rclick(bo, 'minecraft:chest'))
ok('basic AE2 storage is free: opening a terminal on a cable, and the plain wireless terminal, need no node', !rclick(bo, 'ae2:cable_bus') && !useItem(bo, stack('ae2:wireless_terminal', 1)))
ok('wireless crafting and pattern terminals need ME Autocrafting', useItem(bo, stack('ae2wtlib:wireless_universal_terminal', 1)) && useItem(bo, stack('ae2:wireless_crafting_terminal', 1)))
ok('spawners need Mob Spawning; the Digital Miner needs Automated Mining; IE\'s Assembler needs Immersive Assembly to use', place(bo, 'mysticalagriculture:soulium_spawner') &&
  place(bo, 'draconicevolution:stabilized_spawner') && place(bo, 'mekanism:digital_miner') && rclick(bo, 'immersiveengineering:assembler') && place(bo, 'enderio:vacuum_chest'))
cmd('potatotree grant Bo me_logistics', admin)
ok('... with ME Logistics: a storage bus goes onto a cable; the universal wireless terminal still needs ME Autocrafting',
  !rclick(bo, 'ae2:cable_bus', stack('ae2:storage_bus', 1)) && useItem(bo, stack('ae2wtlib:wireless_universal_terminal', 1)))
const cy = mk2('Cy', 1004.5); cy.creative = true
ok('creative players are exempt', !place(cy, 'advanced_ae:quantum_crafter') && !rclick(cy, 'ae2:cable_bus'))
cy.creative = false
setReal(bo, bo.selected, stack('ae2:molecular_assembler', 1))
cmd('bloodpool check', bo); ok('/bloodpool check names the node needed to place it', /Placing it needs ME Autocrafting \(\/potatowar tree\)/.test(flat(lastReply())), flat(lastReply()))

// ----- potatoes handed in count toward rank -----
const anaP = glob.BloodPool.standing(ana).potatoes, pool0 = PDB().drops
fireFtbq('#potato_offer', { player: ana, object: { getMaxProgress: () => 2500 } })
ok('a completed potato task credits the potatoes to rank (the Pool is untouched)', glob.BloodPool.standing(ana).potatoes == anaP + 2500 && PDB().drops == pool0)

// ----- catch-up -----
const dee = mk('Dee', 1005.5); dee.status = []; dee.setStatusMessage = () => {}; dee.online = false; players.push(dee)
W.ftbqCmds = []
const cyStanding = glob.BloodPool.standing(cy).potatoes
cmd('potatotree catchup', admin)
const early = ['seared_smeltery', 'steel_smithing', 'create_logistics', 'immersive_logistics', 'create_farming', 'growth_acceleration', 'garden_cloche']
ok('catch-up at Pool Tier 5: Cy (Unenlisted) gets every node of Tier 3 and below', early.every(id => cy.stages.has(SP(id))), early.filter(id => !cy.stages.has(SP(id))).join(','))
ok('... and nothing above it', ['osmium_steeleaf', 'foundry', 'logistical_transport', 'mechanical_crafting', 'insolation'].every(id => !cy.stages.has(SP(id))))
ok('... completed through FTB Quests, nothing credited, told privately', W.ftbqCmds.some(c => /^ftbquests change_progress Cy complete 507A7000000100(01|0B)$/.test(c)) &&
  glob.BloodPool.standing(cy).potatoes == cyStanding && /The war waits for no one\. The Blood Pool reached Tier 5, so you have been granted: .*Seared Smeltery/.test(text(cy)), text(cy))
ok('... the rank name stays from potatoes, crafting access catches up', glob.BloodPool.standing(cy).rank == 'Unenlisted' && glob.BloodPool.craftAccess(cy) == 3)
const n1 = W.ftbqCmds.length; cmd('potatotree catchup', admin)
ok('... running it again grants nothing new', W.ftbqCmds.length == n1)
cmd('bloodpool settier 6', admin); advance(25)
ok('opening Tier 6 catches everyone up to Tier 4 at once', ['osmium_steeleaf', 'logistical_transport', 'mechanical_crafting', 'formulaic_assembly'].every(id => cy.stages.has(SP(id))) && !cy.stages.has(SP('foundry')))
dee.online = true; fire('loggedIn', { player: dee }); advance(70)
ok('a player who was offline is caught up at login', dee.stages.has(SP('osmium_steeleaf')) && dee.stages.has(SP('seared_smeltery')) && !dee.stages.has(SP('foundry')))
setReal(bo, bo.selected, stack('minecraft:stone', 1))
cmd('blackmarket chatshop', cy)
ok('the black market still uses the real rank (catch-up doesn\'t buy perks)', glob.BloodPool.standing(cy).tier == 0)

// ----- /potatowar next and the tier-open messages -----
replies.length = 0; cmd('potatowar next', cy)
ok('/potatowar next: catch-up access, and the next nodes with what they need', replies.some(r => /Crafting access: Tier 4 \(catch-up\) of 6 open/.test(flat(r))) &&
  replies.some(r => /Next: The Foundry \(needs Potato Soldier\)/.test(flat(r))), replies.map(flat).join(' | '))
ok('global.PotatoTree.status: owned, ready and soon', PT().status(cy).owned.indexOf('Seared Smeltery') >= 0 && PT().status(cy).ready.length == 0 && PT().status(cy).soon.some(x => x.name == 'Cobalt Smithing'))
cmd('potatowar set Cy 400000', admin)
ok('at Potato Sergeant, nodes up to Tier 6 are ready to buy', ['The Foundry', 'Cobalt Smithing', 'Mob Spawning'].every(n => PT().status(cy).ready.indexOf(n) >= 0), PT().status(cy).ready.join(','))
cy.inbox.length = 0; dee.inbox.length = 0
const cT = W.cmds.length
cmd('bloodpool unlock force', admin); advance(25)
ok('opening a tier tells each player privately what it means for them', cy.inbox.map(x => flat(x)).some(l => /Tier 7 \(A River\) is open\. Crafting its items at a table needs Potato Lieutenant: 300,000 more potatoes .*catch-up at Tier 9\. Ready in the upgrade tree .*Alloy Smithing, ME Logistics/.test(l)) &&
  dee.inbox.map(x => flat(x)).some(l => /Tier 7 \(A River\) is open/.test(l)), cy.inbox.map(x => flat(x)).join(' || '))
ok('... never through tellraw @a (Discord)', !W.cmds.slice(cT).some(x => /^tellraw @a .*Crafting its items/.test(x.c)))
cmd('bloodpool settier 6', admin); advance(25)

// ----- commands -----
cmd('potatowar tree', bo)
ok('/potatowar tree opens the book at the ranks chapter for the player', W.cmds.some(x => x.c == 'execute as Bo run ftbquests open_book 507A70000000C001'))
replies.length = 0; cmd('potatotree check Bo', admin)
ok('/potatotree check lists the nodes', /Bo has \d+ of 31 nodes: .*Cobalt Smithing/.test(flat(lastReply())), flat(lastReply()))
cmd('potatotree revoke Bo cobalt_smithing', admin)
ok('/potatotree revoke: the stage goes and the quest is reset', !bo.stages.has(SP('cobalt_smithing')) && W.ftbqCmds.some(c => c == 'ftbquests change_progress Bo reset 507A700000010005'))
cmd('potatotree grant Bo nonsense', admin); ok('an unknown node is refused with the list of ids', /No such node\. Ids: seared_smeltery/.test(flat(lastReply())))
const qn = W.q.length; reload(); reload(); advance(200)
ok('/reload doesn\'t stack the armour loop', W.q.length <= qn + 3, qn + ' -> ' + W.q.length)
ok('no errors logged with the tree', errors().length == 0, errors().join(' | '))

// ----- without FTB Quests, and with catch-up off -----
W.noFtbq = true; reload(); advance(30)
ok('without FTB Quests: a warning, and the locks still work', W.logs.some(l => /^W \[PotatoTree\] FTB Quests .* isn't installed/.test(l)) && (putInHand(bo, cobaltPick), brk2(bo)))
W.noFtbq = false
global.POOL_SRC = global.POOL_SRC.replace('const CATCH_UP_GAP = 2', 'const CATCH_UP_GAP = 0'); reload(); advance(30)
const eve = mk2('Eve', 1006.5); advance(70)
ok('CATCH_UP_GAP = 0: no catch-up nodes and no catch-up crafting access', !eve.stages.has(SP('seared_smeltery')) && !eve.stages.has('potato_standing_1') && glob.BloodPool.craftAccess(eve) == 0)
ok('no errors logged at all', errors().length == 0, errors().join(' | '))

console.log(errors().join('\n') || '(no errors logged)')
console.log(fails ? fails + ' FAILED' : 'ALL PASSED')
