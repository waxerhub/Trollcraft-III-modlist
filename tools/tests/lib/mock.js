// Minimal KubeJS 6 mock for pig_escort.js
const fs = require('fs')
function jset(arr) { return { contains: t => arr.indexOf(t) >= 0, isEmpty: () => arr.length == 0, add: t => arr.push(t), arr } }
function jlist(arr) { return { size: () => arr.length, get: i => arr[i], iterator() { let i = 0; return { hasNext: () => i < arr.length, next: () => arr[i++] } }, arr } }
let uuidN = 0
function newUuid() { uuidN++; const h = uuidN.toString(16).padStart(8, '0'); return h + 'aaaa-bbbb-cccc-dddd' + h + 'eeee' }

function makeWorld(opts) {
  const W = { tick: 0, queue: [], cmds: [], entities: [], handlers: {}, blocks: {}, forced: {}, gamerules: { keepInventory: 0 }, teams: {}, bossbars: {}, tells: [], global: {}, persistent: {}, files: {} }
  const ground = opts.ground || ((x, z) => 64)
  function blockAt(x, y, z) {
    const k = x + ',' + y + ',' + z
    let id = W.blocks[k]
    if (!id) id = y <= ground(x, z) ? 'minecraft:stone' : 'minecraft:air'
    return id
  }
  function blockObj(x, y, z) {
    const full = blockAt(x, y, z)
    const id = full.replace(/\[.*$/, '').replace(/\{.*$/, '')
    return { id, x, y, z, entityData: null, getDimension: () => 'minecraft:overworld',
      blockState: { blocksMotion: () => !/air|portal|water|lava/.test(id), toString: () => 'Block{' + id + '}' + (full.match(/\[.*\]/) || [''])[0] } }
  }
  const overworld = {
    // Like the live server: KubeJS's dimension getter wins (the ID itself). DIM_AS_METHOD = Minecraft's form.
    dimension: process.env.DIM_AS_METHOD ? () => ({ location: () => 'minecraft:overworld' }) : { toString: () => 'minecraft:overworld' },
    getBlock: blockObj, getSharedSpawnPos: () => ({ getX: () => 0, getY: () => 65, getZ: () => 0 }),
    getMaxBuildHeight: () => 320, getMinBuildHeight: () => -64,
    getWorldBorder: () => { throw new Error('nope') },
  }
  W.overworld = overworld
  function makeEntity(type, x, y, z, tags, extra) {
    const e = Object.assign({
      type, x, y, z, health: 20, maxHealth: 20, removed: false, alive: true, level: process.env.LEVEL_AS_METHOD ? () => overworld : overworld, getEncodeId() { return this.type == 'minecraft:player' ? null : this.type }, _tags: tags || [], uuid: newUuid(), effects: [], passengers: [],
      getTags() { return jset(this._tags) }, getStringUuid() { return this.uuid }, getUuid() { return this.uuid },
      isRemoved() { return this.removed }, isAlive() { return this.alive && !this.removed },
      isPassenger: () => false, getPassengers() { return jlist(this.passengers) }, isLeashed: () => false, getLeashHolder: () => null,
      getCustomName() { return this.customName ? { getString: () => this.customName } : null },
      getMaxHealth() { return this.maxHealth }, setHealth(h) { this.health = h }, heal(n) { this.health = Math.min(this.maxHealth, this.health + n) },
      getActiveEffects() { return jlist(this.effects) }, isOnFire: () => false, extinguish() {}, resetFallDistance() {},
      getBbWidth: () => 0.9, getBbHeight: () => 0.9, isPlayer: () => false, getTeam: () => null,
      getBrain() { throw new Error('no brain') },
    }, extra || {})
    // Like the live server: the .x/.y/.z properties are empty on non-player entities; getX() etc. always work.
    const pos = { x: e.x, y: e.y, z: e.z }
    delete e.x; delete e.y; delete e.z
    ;['x', 'y', 'z'].forEach(k => Object.defineProperty(e, k, {
      get() { return this.type == 'minecraft:player' ? pos[k] : undefined },
      set(v) { pos[k] = v }, enumerable: true }))
    e.getX = () => pos.x; e.getY = () => pos.y; e.getZ = () => pos.z
    e.pos = pos
    e.getHealth = function () { return this.health }
    e.setFoodLevel = function (n) { this.food = n }
    return e
  }
  W.makeEntity = makeEntity
  function parseCoord(s) { return parseFloat(s) }
  function exec(cmd) {
    W.cmds.push(cmd)
    let m
    cmd = cmd.replace(/^execute in minecraft:overworld run /, '')
    if ((m = cmd.match(/^gamerule keepInventory$/))) return W.gamerules.keepInventory
    if ((m = cmd.match(/^gamerule keepInventory (true|false)$/))) { W.gamerules.keepInventory = m[1] == 'true' ? 1 : 0; return 1 }
    if ((m = cmd.match(/^forceload query (\S+) (\S+)$/))) return W.forced[m[1] + ',' + m[2]] ? 1 : 0
    if ((m = cmd.match(/^forceload add (\S+) (\S+)$/))) { W.forced[(m[1] >> 4) + ',' + (m[2] >> 4)] = true; return 1 }
    if ((m = cmd.match(/^forceload remove (\S+) (\S+)$/))) { delete W.forced[(m[1] >> 4) + ',' + (m[2] >> 4)]; return 1 }
    if ((m = cmd.match(/^worldborder get$/))) return 59999968
    if ((m = cmd.match(/^difficulty$/))) return W.difficulty == null ? 3 : W.difficulty
    if ((m = cmd.match(/^setblock (\S+) (\S+) (\S+) (.+)$/))) { W.blocks[m[1] + ',' + m[2] + ',' + m[3]] = m[4]; return 1 }
    if ((m = cmd.match(/^fill (\S+) (\S+) (\S+) (\S+) (\S+) (\S+) (\S+)$/))) {
      const a = m.slice(1, 7).map(Number)
      for (let x = Math.min(a[0], a[3]); x <= Math.max(a[0], a[3]); x++) for (let y = Math.min(a[1], a[4]); y <= Math.max(a[1], a[4]); y++) for (let z = Math.min(a[2], a[5]); z <= Math.max(a[2], a[5]); z++) W.blocks[x + ',' + y + ',' + z] = m[7]
      return 1
    }
    if ((m = cmd.match(/^summon (\S+) (\S+) (\S+) (\S+) (\{.*\})$/))) {
      const tags = (m[5].match(/Tags:\["([^"]+)"\]/) || [])[1]
      const e = makeEntity(m[1], parseCoord(m[2]), parseCoord(m[3]), parseCoord(m[4]), tags ? [tags] : [])
      e.summonNbt = m[5]
      const mh = m[5].match(/generic.max_health",Base:(\d+)d/); if (mh) e.maxHealth = +mh[1]
      const h = m[5].match(/Health:([\d.]+)f/); if (h) e.health = +h[1]
      const cn = m[5].match(/"text":"([^"]+)"/); if (cn && m[1] == 'minecraft:pig') e.customName = cn[1]
      let cancelled = false
      W.fire('spawned', { entity: e, cancel() { cancelled = true } })
      if (!cancelled) W.entities.push(e)
      return cancelled ? 0 : 1
    }
    if ((m = cmd.match(/^kill @e\[tag=(\S+)\]$/))) {
      let n = 0
      W.entities.filter(e => !e.removed && e._tags.indexOf(m[1]) >= 0).forEach(e => { e.removed = true; e.alive = false; n++ })
      return n
    }
    if ((m = cmd.match(/^kill (\S+)$/))) { const e = W.entities.find(e => e.uuid == m[1]); if (e) { e.removed = true; return 1 } return 0 }
    if ((m = cmd.match(/^tellraw (\S+) (.+)$/))) { W.tells.push(JSON.parse(m[2])[2].text); return 1 }
    if ((m = cmd.match(/^tp (\S+) (\S+) (\S+) (\S+)/))) {
      const e = W.entities.concat(W.players).find(e => e.uuid == m[1] || e.name == m[1]); if (e) { e.x = +m[2]; e.y = +m[3]; e.z = +m[4] } return e ? 1 : 0
    }
    if ((m = cmd.match(/^team add (\S+)/))) { W.teams[m[1]] = []; return 1 }
    if ((m = cmd.match(/^team remove (\S+)/))) { const had = !!W.teams[m[1]]; delete W.teams[m[1]]; return had ? 1 : 0 }
    if ((m = cmd.match(/^team join (\S+) (\S+)/))) { if (!W.teams[m[1]]) return 0; W.teams[m[1]].push(m[2]); return 1 }
    if ((m = cmd.match(/^bossbar add (\S+)/))) { W.bossbars[m[1]] = {}; return 1 }
    if ((m = cmd.match(/^bossbar remove (\S+)/))) { const had = !!W.bossbars[m[1]]; delete W.bossbars[m[1]]; return had ? 1 : 0 }
    if ((m = cmd.match(/^bossbar set (\S+) (\S+) (.+)$/))) { if (W.bossbars[m[1]]) W.bossbars[m[1]][m[2]] = m[3]; return 1 }
    return 1
  }
  W.players = []
  W.server = {
    get tickCount() { return W.tick },
    runCommandSilent: exec,
    scheduleInTicks(n, f) { W.queue.push({ at: W.tick + n, f }) },
    get overworld() { return process.env.OVERWORLD_AS_OBJECT ? overworld : () => overworld },
    get players() { return jlist(W.players.filter(p => p.online)) },
    get entities() { return jlist(W.entities) },
    persistentData: { putString(k, v) { W.persistent[k] = v }, getString(k) { return W.persistent[k] || '' }, remove(k) { delete W.persistent[k] } },
  }
  W.advance = n => {
    for (let i = 0; i < n; i++) {
      W.tick++
      const due = W.queue.filter(q => q.at <= W.tick)
      W.queue = W.queue.filter(q => q.at > W.tick)
      due.forEach(q => q.f())
    }
  }
  // Like KubeJS 6: event.cancel() marks the event cancelled AND stops the handler (throws EventExit).
  const EXIT = { kubejsEventExit: true }
  W.fire = (name, ev) => (W.handlers[name] || []).forEach(h => {
    if (ev && typeof ev.cancel == 'function' && !ev.__wrapped) {
      const orig = ev.cancel; ev.__wrapped = true
      ev.cancel = function () { orig.call(ev); throw EXIT }
    }
    try { h(ev) } catch (e) { if (e !== EXIT) throw e }
  })
  W.addPlayer = (name, x, y, z) => {
    const p = makeEntity('minecraft:player', x, y, z, [], { name, online: true, facing: 'north', isPlayer: () => true, getGameProfile: () => ({ getName: () => name }), give(i) { (W.given = W.given || []).push([name, i]) }, foodLevel: 0 })
    W.players.push(p)
    return p
  }
  return W
}

function loadScript(W, file, patch) {
  let src = fs.readFileSync(file, 'utf8')
  if (patch) src = patch(src)
  const reg = name => f => { (W.handlers[name] = W.handlers[name] || []).push(f) }
  const env = {
    global: W.global,
    console: { info: m => W.log && console.log('  [info] ' + m), warn: m => { (W.warns = W.warns || []).push(String(m)); console.log('  [warn] ' + m) }, error: m => { console.log('  [ERROR] ' + m); W.errors = (W.errors || 0) + 1 } },
    Java: { loadClass: W.loadClass || (() => { throw new Error('class not available in mock') }) },
    Text: { gold: t => ({ append: x => ({ t: t + x }) }), yellow: t => t },
    Item: { of: (id, n) => id + ' x' + n },
    JsonIO: { write: (p, o) => { W.files[p] = JSON.stringify(o) }, read: p => W.files[p] ? { get: k => JSON.parse(W.files[p])[k] } : null },
    Utils: { get server() { return W.serverStarted ? W.server : null } },
    ServerEvents: { loaded: reg('loaded'), commandRegistry: reg('commandRegistry') },
    EntityEvents: { hurt: reg('hurt'), death: reg('death'), spawned: reg('spawned') },
    ItemEvents: { entityInteracted: reg('entityInteracted') },
    BlockEvents: { broken: reg('broken'), placed: reg('placed') },
    LevelEvents: { afterExplosion: reg('afterExplosion') },
    PlayerEvents: { loggedIn: reg('loggedIn'), loggedOut: reg('loggedOut') },
  }
  // Like the live server: Math.PI doesn't exist.
  env.Math = {}
  for (const k of Object.getOwnPropertyNames(Math)) if (k != 'PI') env.Math[k] = Math[k]
  const fn = new Function(...Object.keys(env), src)
  fn(...Object.values(env))
}

// Brigadier-ish command tree
function buildCommands(W) {
  const node = (name, kind) => ({ name, kind, children: [], exec: null, then(c) { this.children.push(c); return this }, executes(f) { this.exec = f; return this }, requires() { return this } })
  const Commands = { literal: n => node(n, 'lit'), argument: (n, t) => node(n, 'arg') }
  let root = null
  W.fire('commandRegistry', { commands: Commands, arguments: { INTEGER: { create: () => 'int', getResult: (ctx, n) => ctx.args[n] } }, register: r => { root = r } })
  W.cmd = (line, player) => {
    const parts = line.split(' ')
    let cur = root, args = {}
    for (let i = 1; i < parts.length; i++) {
      let next = cur.children.find(c => c.kind == 'lit' && c.name == parts[i]) || cur.children.find(c => c.kind == 'arg')
      if (!next) throw new Error('no command ' + line)
      if (next.kind == 'arg') args[next.name] = Number(parts[i])
      cur = next
    }
    const replies = []
    const ctx = { args, source: { server: W.server, getPlayer: () => player || null, sendSystemMessage: m => replies.push(m.t) } }
    const r = cur.exec(ctx)
    return { r, replies }
  }
}
module.exports = { makeWorld, loadScript, buildCommands }
