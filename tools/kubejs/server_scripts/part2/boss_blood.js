// Part II: Twilight Forest boss kills fill the Blood Pool. Each boss pays Drops of Blood by how hard it is: the same
// ranking, easiest first, as the boss chests in part2/twilight_bosses.js. The Pool gets the full amount; the credit
// (/bloodpool top) is split equally among the fighters, the survival players within FIGHTER_RADIUS blocks when the
// boss dies. Every kill pays.
//   - The Lich's shadow clones are also "twilightforest:lich": only the real Lich pays.
//   - Knight Phantoms come six to a group: the group pays once, when the last one dies.
//   - /kill and the void pay nothing, and nor does a boss with no player nearby.
// Needs part2/blood_pool.js (global.BloodPool). Copy to <server>/kubejs/server_scripts/part2/ and run /reload.
// See tools/kubejs/BOSS_BLOOD.md.
// KubeJS 6 (Rhino): no template strings; `let` inside nested blocks.

(function () {

// ===================== SETTINGS =====================

// Entity id -> what it's worth. rank: how hard it is, 1 = easiest (keep in step with BOSSES in twilight_bosses.js).
// Each rank pays about a quarter more than the one before, from 200 for the Naga to 1,000 for the Snow Queen.
const BOSSES = {
  'twilightforest:naga':           { name: 'the Naga', drops: 200, rank: 1 },             // 120 health, melee only
  'twilightforest:minoshroom':     { name: 'the Minoshroom', drops: 250, rank: 2 },       // axe charges, end of the Labyrinth
  'twilightforest:alpha_yeti':     { name: 'the Alpha Yeti', drops: 300, rank: 3 },       // 200 health, throws, slow
  'twilightforest:lich':           { name: 'the Lich', drops: 400, rank: 4 },             // harder in play than those two
  'twilightforest:knight_phantom': { name: 'the Knight Phantoms', drops: 500, rank: 5 },  // six armoured knights
  'twilightforest:hydra':          { name: 'the Hydra', drops: 650, rank: 6 },            // 360 health, heads only, fire
  'twilightforest:ur_ghast':       { name: 'the Ur-Ghast', drops: 800, rank: 7 },         // flies; needs the ghast traps
  'twilightforest:snow_queen':     { name: 'the Snow Queen', drops: 1000, rank: 8 },      // hardest hits, shields, flies
}
const NUMERALS = ['I', 'II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII', 'IX', 'X']
const LICH_ID = 'twilightforest:lich'
const KNIGHT_ID = 'twilightforest:knight_phantom'
const FIGHTER_RADIUS = 64            // players this close (same dimension) when the boss dies share the credit
const NO_PAY_DAMAGE = ['genericKill', 'outOfWorld']   // /kill and the void
const ANNOUNCE = true                // tell every player online (player.tell, never tellraw @a)
const LOG_SIZE = 20                  // kills kept for /bossblood log
const DATA_KEY = 'boss_blood'
const VOICE = { tag: '[BLOOD GOD]', tagColor: 'dark_red', textColor: 'red' }

// ===================== STATE =====================

let Serializer = null
try { Serializer = Java.loadClass('net.minecraft.network.chat.Component$Serializer') } catch (e) { }
let warnedNoPool = false
let data = null

function server0() { return Utils.server }
function db() {
  if (data) return data
  data = { kills: {}, drops: {}, log: [] }
  let raw = ''
  try { raw = String(server0().persistentData.getString(DATA_KEY) || '') } catch (e) { }
  if (raw) {
    try {
      let d = JSON.parse(raw)
      if (d && d.kills && d.drops && d.log) data = d
    } catch (e) {
      console.error('[BossBlood] Saved data could not be read; a copy is kept')
      try { server0().persistentData.putString(DATA_KEY + '_unreadable_' + Date.now(), raw) } catch (e2) { }
    }
  }
  return data
}
function save() {
  try { server0().persistentData.putString(DATA_KEY, JSON.stringify(db())) } catch (e) { console.error('[BossBlood] Save failed: ' + e) }
}

// ===================== HELPERS =====================

function typeOf(e) { try { let id = e.getEncodeId(); return id == null ? '' : String(id) } catch (err) { return '' } }
function nameOf(p) { return String(p.getGameProfile().getName()) }
function uuidOf(e) {
  try { return String(e.getStringUuid()).toLowerCase() } catch (err) { }
  return String(e.getStringUUID()).toLowerCase()
}
function levelOf(e) { const l = e.level; return typeof l == 'function' ? e.level() : l }
function dimOf(e) {
  let d = levelOf(e).dimension
  if (typeof d == 'function') d = levelOf(e).dimension()
  if (d != null && typeof d.location == 'function') d = d.location()
  return String(d)
}
function pos(e) {
  try { return { x: Number(e.getX()), y: Number(e.getY()), z: Number(e.getZ()) } } catch (err) { }
  return { x: Number(e.x), y: Number(e.y), z: Number(e.z) }
}
function dist(a, b) { const dx = a.x - b.x, dy = a.y - b.y, dz = a.z - b.z; return Math.sqrt(dx * dx + dy * dy + dz * dz) }
function list(javaList) { const out = []; for (let i = 0; i < javaList.size(); i++) out.push(javaList.get(i)); return out }
function isOp(p) { try { return p.hasPermissions(2) } catch (e) { return false } }
function fmt(n) { return String(Math.round(n)).replace(/\B(?=(\d{3})+(?!\d))/g, ',') }
function comp(parts) {
  const json = JSON.stringify([''].concat(parts))
  if (Serializer) { try { return Serializer.fromJsonLenient(json) } catch (e) { } }
  return Text.of(parts.map(p => (typeof p == 'string' ? p : p.text || '')).join(''))
}
function voiced(text) { return comp([{ text: VOICE.tag, color: VOICE.tagColor, bold: true }, { text: ' ' + text, color: VOICE.textColor }]) }
function names(arr) {
  if (arr.length <= 1) return arr.join('')
  return arr.slice(0, -1).join(', ') + ' and ' + arr[arr.length - 1]
}
function damageType(source) {
  try { return String(typeof source.getMsgId == 'function' ? source.getMsgId() : source.getType()) } catch (e) { return '' }
}
function killerOf(source) {
  try { return typeof source.getActual == 'function' ? source.getActual() : source.getEntity() } catch (e) { return null }
}

// The real Lich, not one of its shadow clones.
function isShadowClone(e) {
  try { if (typeof e.isShadowClone == 'function') return !!e.isShadowClone() } catch (err) { }
  try { return !!e.getNbt().getBoolean('ShadowClone') } catch (err) { }
  try { return !!e.nbt.getBoolean('ShadowClone') } catch (err) { }
  return false
}
// Another living Knight Phantom of the same group (Twilight Forest uses 64 blocks too).
function otherKnightsAlive(server, e) {
  const d = dimOf(e), here = pos(e)
  return list(server.entities).some(o => {
    if (o === e || typeOf(o) != KNIGHT_ID) return false
    try { if (!o.isAlive()) return false } catch (err) { }
    return dimOf(o) == d && dist(pos(o), here) <= 64
  })
}
function fightersNear(server, e) {
  const d = dimOf(e), here = pos(e)
  return list(server.players).filter(p => {
    try { if (p.isCreative() || p.isSpectator()) return false } catch (err) { }
    return dimOf(p) == d && dist(pos(p), here) <= FIGHTER_RADIUS
  })
}

// ===================== THE REWARD =====================

function pay(server, B, id, fighters, killer) {
  const BP = global.BloodPool
  // The killer (if among the fighters) first: they take the remainder of the split.
  let k = -1
  if (killer) fighters.forEach((p, i) => { if (k < 0 && uuidOf(p) == uuidOf(killer)) k = i })
  const ordered = k > 0 ? [fighters[k]].concat(fighters.filter((p, i) => i != k)) : fighters.slice()
  const share = Math.floor(B.drops / ordered.length)
  const rest = B.drops - share * ordered.length
  ordered.forEach((p, i) => { BP.addDrops(share + (i == 0 ? rest : 0), 'boss', uuidOf(p), nameOf(p)) })
  const D = db()
  D.kills[id] = (D.kills[id] || 0) + 1
  D.drops[id] = (D.drops[id] || 0) + B.drops
  D.log.unshift({ t: Date.now(), boss: id, drops: B.drops, by: ordered.map(nameOf) })
  if (D.log.length > LOG_SIZE) D.log.length = LOG_SIZE
  save()
  const who = names(ordered.map(nameOf))
  console.info('[BossBlood] ' + B.name + ' fell to ' + who + ': +' + B.drops + ' Drops')
  if (!ANNOUNCE) return
  const verb = B.name == 'the Knight Phantoms' ? ' have fallen to ' : ' has fallen to '
  const c = voiced(B.name.charAt(0).toUpperCase() + B.name.slice(1) + verb + who + '. +' + fmt(B.drops) + ' Drops of Blood.')
  list(server.players).forEach(p => { try { p.tell(c) } catch (e) { } })
}

EntityEvents.death(event => {
  const e = event.entity
  let isPlayer = false
  try { isPlayer = e.isPlayer() } catch (err) { }
  if (isPlayer) return
  const id = typeOf(e)
  const B = BOSSES[id]
  if (!B) return
  if (!global.BloodPool) {
    if (!warnedNoPool) console.warn('[BossBlood] part2/blood_pool.js is not installed: boss kills pay nothing')
    warnedNoPool = true
    return
  }
  const server = event.server || Utils.server
  if (id == LICH_ID && isShadowClone(e)) return
  if (NO_PAY_DAMAGE.indexOf(damageType(event.source)) >= 0) return
  if (id == KNIGHT_ID && otherKnightsAlive(server, e)) return
  const fighters = fightersNear(server, e)
  if (!fighters.length) return
  pay(server, B, id, fighters, killerOf(event.source))
})

// ===================== COMMANDS =====================

ServerEvents.commandRegistry(event => {
  const Commands = event.commands
  const reply = (ctx, text) => { ctx.source.sendSystemMessage(comp([{ text: '[Boss Blood] ', color: 'dark_red' }, { text: text, color: 'gray' }])); return 1 }
  const safe = fn => ctx => { try { return fn(ctx) } catch (e) { console.error('[BossBlood] ' + e); return reply(ctx, 'Error: ' + e) } }
  event.register(Commands.literal('bossblood')
    .executes(safe(ctx => {
      const D = db()
      reply(ctx, 'Twilight Forest bosses fill the Blood Pool, easiest first (the credit is shared by everyone within ' + FIGHTER_RADIUS + ' blocks):')
      Object.keys(BOSSES).sort((a, b) => BOSSES[a].rank - BOSSES[b].rank).forEach(id => {
        let B = BOSSES[id]
        reply(ctx, (NUMERALS[B.rank - 1] || String(B.rank)) + '. ' + B.name.charAt(0).toUpperCase() + B.name.slice(1) +
          ': ' + fmt(B.drops) + ' Drops' + (D.kills[id] ? ' (slain ' + D.kills[id] + 'x, ' + fmt(D.drops[id]) + ' so far)' : ''))
      })
      return 1
    }))
    .then(Commands.literal('log').requires(src => src.hasPermission(2)).executes(safe(ctx => {
      const D = db()
      if (!D.log.length) return reply(ctx, 'No boss has paid yet.')
      D.log.forEach(k => reply(ctx, new Date(k.t).toISOString().slice(0, 16).replace('T', ' ') + ' ' +
        (BOSSES[k.boss] ? BOSSES[k.boss].name : k.boss) + ' +' + fmt(k.drops) + ' (' + k.by.join(', ') + ')'))
      return 1
    }))))
})

global.BossBlood = {
  bosses: BOSSES,
  stats: () => JSON.parse(JSON.stringify(db())),
}

})()
