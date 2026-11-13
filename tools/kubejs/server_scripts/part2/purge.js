// Part II: the Purges. A timed server event with a game mode, run by ops with /purge.
//   - The engine: the timer and boss bar, the opening and closing, kill detection (with last-hit credit and combat
//     logging), the sanctuary (no fighting there), a score ledger, the history and the hidden Tithe count.
//   - Kits: a mode can make everyone fight with the same preset kit. Each fighter's own inventory is locked in a vault
//     (saved data plus a backup file) and handed back slot for slot at the end.
//   - The arena (/purge arena set): fighters are taken to random spots in it and brought back to where they were at
//     the end. A fatal blow there is a knockout (healed, fresh kit, a new spot), not a death.
//   - Modes plug in as entries in MODES. The first is the Potato Heist: every kill steals from the victim's Potato War
//     total (part2/blood_pool.js), and a cut of every theft quietly vanishes (the Tithe).
// The Purge's declarations are unsigned. Nothing here names the Ministry.
// Needs part2/blood_pool.js (global.BloodPool) for the Heist. Uses protected_areas.js (the sanctuary) and
// economy/black_market.js (AFK) when they're installed.
// Copy to <server>/kubejs/server_scripts/part2/ and run /reload. See tools/kubejs/PURGE.md.
// KubeJS 6 (Rhino): no template strings; `let` inside nested blocks; event.cancel() last.

(function () {

// ===================== SETTINGS: THE ENGINE =====================

const VOICE = { tag: '[The Purge]', tagColor: 'dark_red', textColor: 'red' }
const MAX_MINUTES = 240
const COUNTDOWN_SECONDS = 30          // between /purge start (or an Unsigned Declaration) and the Purge; 0 = at once
const COUNTDOWN_MARKS = [30, 20, 10, 5, 4, 3, 2, 1]   // seconds left when everyone gets a title and a tick
const TICK = 20                       // the engine runs every second
const SLOW_EVERY = 5                  // boss bar, glow and the mode's onTick every 5 seconds
const BOSSBAR = 'purge:timer'
const LAST_HIT_SECONDS = 10           // a death (fall, lava, mobs) this soon after a player's hit counts as their kill
const COMBAT_LOG_SECONDS = 15         // logging out this soon after a player's hit counts as being killed by them
const RESPAWN_RESISTANCE_SECONDS = 10 // Resistance V after respawning, against spawn camping
// Areas from protected_areas.js (by name) where nobody fights. Players who start the Purge inside keep their own gear
// until they step out.
const SANCTUARY = ['Spawn', 'The Castle']
// FTB Essentials commands fighters can't use during a Purge (no teleporting out of a fight).
const BLOCKED_COMMANDS = ['home', 'back', 'spawn', 'warp', 'tpa', 'tpahere', 'tpaccept', 'rtp', 'tpl']
const BLOCK_OPS_TOO = false           // ops can still use them
const SKIP_AFK = true                 // an AFK victim's death counts for nothing
const HISTORY_SIZE = 20
const VAULT_DIR = 'kubejs/purge_vaults/'
// The arena (set in game with /purge arena set [radius]): every fighter is taken there when they join the fight, and
// back to where they were at the end. Lethal damage there is a knockout, not a death: healed, a fresh kit, and sent to
// another random spot in the arena. Without an arena, fighters fight where they stand and die as usual.
// While a Purge runs, everyone in it glows (seen through walls) and their name over their head is hidden, through two
// vanilla scoreboard teams. Players a mode marks (the Heist: the richest war chests) glow gold, everyone else white.
// Each player's own team, if they had one, is noted and given back at the end. Creative and spectator are left alone.
const INVISIBLE_EVERYONE = true       // everyone in the Purge is invisible, with no particles (armour and held items
                                      // still show; with the glow, they're seen as an outline)
const GLOW_EVERYONE = true            // false: only the marked players glow
const HIDE_NAMETAGS = true            // with both false, no teams are used (the marked still glow, in white)
const TEAM_ALL = 'purge'              // white glow
const TEAM_MARKED = 'purge_marked'    // gold glow
const MARKED_COLOR = 'gold'
const ARENA_RADIUS = 40              // default landing radius around the arena point (0 = all on the point)
const ARENA_HEADROOM = 0              // land below arena y + this (for an arena under a roof); 0 = the surface.
                                      // In the Nether the roof is always avoided (arena y + 10).
const DATA_KEY = 'purge'

// The kits. Plain, unenchanted, the same for everyone. armor: [head, chest, legs, feet]; offhand: one item.
const KITS = {
  soldier: { name: 'Soldier', blurb: 'iron sword, shield, bow and 32 arrows, iron armour, 16 steak',
    items: [['minecraft:iron_sword', 1], ['minecraft:bow', 1], ['minecraft:arrow', 32], ['minecraft:cooked_beef', 16]],
    armor: ['minecraft:iron_helmet', 'minecraft:iron_chestplate', 'minecraft:iron_leggings', 'minecraft:iron_boots'],
    offhand: 'minecraft:shield' },
  peasant: { name: 'Peasant', blurb: 'wooden sword, leather armour, 8 bread. The old rules',
    items: [['minecraft:wooden_sword', 1], ['minecraft:bread', 8]],
    armor: ['minecraft:leather_helmet', 'minecraft:leather_chestplate', 'minecraft:leather_leggings', 'minecraft:leather_boots'] },
  archer: { name: 'Archer', blurb: 'bow and 64 arrows, stone sword, chainmail, 16 steak',
    items: [['minecraft:bow', 1], ['minecraft:stone_sword', 1], ['minecraft:arrow', 64], ['minecraft:cooked_beef', 16]],
    armor: ['minecraft:chainmail_helmet', 'minecraft:chainmail_chestplate', 'minecraft:chainmail_leggings', 'minecraft:chainmail_boots'] },
  gladiator: { name: 'Gladiator', blurb: 'diamond sword and axe, diamond armour, 4 golden apples, 16 steak',
    items: [['minecraft:diamond_sword', 1], ['minecraft:diamond_axe', 1], ['minecraft:golden_apple', 4], ['minecraft:cooked_beef', 16]],
    armor: ['minecraft:diamond_helmet', 'minecraft:diamond_chestplate', 'minecraft:diamond_leggings', 'minecraft:diamond_boots'] },
}
const KIT_LORE = 'Purge issue. Returned at the end.'

// ===================== SETTINGS: THE POTATO HEIST =====================

const STEAL_SHARE = 0.05              // of the victim's Potato War total, per kill
const STEAL_MIN = 50
const STEAL_MAX = 2500
const TITHE_SHARE = 0.2               // vanishes (the hidden Tithe count); the killer gets the rest
const MIN_VICTIM_RANK = 3             // players below this rank can't be robbed (a grudge ignores it)
const REPEAT_FACTORS = [1, 0.5, 0.25] // the same killer robbing the same victim again in one Heist
const GRUDGE_FACTOR = 2               // robbing back someone who robbed you
const GLOW_TOP = 3                    // the richest war chests online glow

// ===================== STATE =====================

let Serializer = null, StringArg = null, ItemStackClass = null
try { Serializer = Java.loadClass('net.minecraft.network.chat.Component$Serializer') } catch (e) { }
try { StringArg = Java.loadClass('com.mojang.brigadier.arguments.StringArgumentType') } catch (e) { }
try { ItemStackClass = Java.loadClass('net.minecraft.world.item.ItemStack') } catch (e) { }
const S = { lastHit: {}, slow: 0, team: {}, said: {} }   // team: name -> the Purge team they're on (memo);
                                                         // said: countdown marks already announced
let data = null

// D.cur: the running Purge or null. D.vaults: uuid -> a fighter's locked inventory (until it's handed back).
function db() {
  if (data) return data
  data = { cur: null, pending: null, vaults: {}, tithe: 0, titheBy: {}, reports: {}, history: [] }
  let raw = ''
  try { raw = String(Utils.server.persistentData.getString(DATA_KEY) || '') } catch (e) { }
  if (raw) {
    try {
      let d = JSON.parse(raw)
      if (d && d.vaults && d.history) data = d
    } catch (e) {
      console.error('[Purge] Saved data could not be read; a copy is kept')
      try { Utils.server.persistentData.putString(DATA_KEY + '_unreadable_' + Date.now(), raw) } catch (e2) { }
    }
  }
  return data
}
function save() {
  try { Utils.server.persistentData.putString(DATA_KEY, JSON.stringify(db())); return true } catch (e) {
    console.error('[Purge] Save failed: ' + e)
    return false
  }
}

// ===================== HELPERS =====================

function comp(parts) {
  const json = JSON.stringify([''].concat(parts))
  if (Serializer) { try { return Serializer.fromJsonLenient(json) } catch (e) { } }
  return Text.of(parts.map(p => (typeof p == 'string' ? p : p.text || '')).join(''))
}
function voiced(text, color) { return [{ text: VOICE.tag + ' ', color: VOICE.tagColor, bold: true }, { text: text, color: color || VOICE.textColor }] }
function nameOf(p) { return String(p.getGameProfile().getName()) }
function uuidOf(e) {
  try { return String(e.getStringUuid()).toLowerCase() } catch (err) { }
  return String(e.getStringUUID()).toLowerCase()
}
function isPlayer(e) { try { return !!e && e.isPlayer() } catch (err) { return false } }
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
function r2(n) { return Math.round(Number(n) * 100) / 100 }
// Where a player is, facing included: the spot they're taken back to after the Purge.
function whereIs(p) {
  const q = pos(p)
  let yaw = 0, pitch = 0
  try { yaw = Number(p.getYRot()); pitch = Number(p.getXRot()) } catch (e) {
    try { yaw = Number(p.yaw) || 0; pitch = Number(p.pitch) || 0 } catch (e2) { }
  }
  return { dim: dimOf(p), x: r2(q.x), y: r2(q.y), z: r2(q.z), yaw: r2(yaw), pitch: r2(pitch) }
}
function list(javaList) { const out = []; for (let i = 0; i < javaList.size(); i++) out.push(javaList.get(i)); return out }
function players(server) { try { return list(server.players) } catch (e) { return [] } }
function playerByUuid(server, u) { return players(server).filter(p => uuidOf(p) == u)[0] || null }
function playerByName(server, n) { return players(server).filter(p => nameOf(p).toLowerCase() == String(n).toLowerCase())[0] || null }
function isOp(p) { try { return p.hasPermissions(2) } catch (e) { return false } }
function isAlive(p) { try { return p.isAlive() } catch (e) { return true } }
function notPlaying(p) { try { return p.isCreative() || p.isSpectator() } catch (e) { return false } }
function fmt(n) { return (n < 0 ? '-' : '') + String(Math.abs(Math.round(n))).replace(/\B(?=(\d{3})+(?!\d))/g, ',') }
function signed(n) { return (n > 0 ? '+' : '') + fmt(n) }
function clock(ms) {
  const s = Math.max(0, Math.ceil(ms / 1000)), m = Math.floor(s / 60), r = s % 60
  return m + ':' + (r < 10 ? '0' : '') + r
}
function run(server, c) { try { return server.runCommandSilent(c) } catch (e) { console.warn('[Purge] ' + c + ': ' + e); return 0 } }
function tell(p, text, color) { try { p.tell(comp(voiced(text, color))) } catch (e) { } }
function tellAll(server, text, color) {
  const c = comp(voiced(text, color))
  players(server).forEach(p => { try { p.tell(c) } catch (e) { } })
}
function tellOps(server, text) { players(server).filter(isOp).forEach(p => tell(p, text, 'gold')) }
function title(server, name, big, small, color) {
  run(server, 'title ' + name + ' times 10 60 20')
  run(server, 'title ' + name + ' subtitle ' + JSON.stringify({ text: small || '', color: 'gray' }))
  run(server, 'title ' + name + ' title ' + JSON.stringify({ text: big, color: color || 'dark_red', bold: true }))
}
function actionbar(server, name, text, color) { run(server, 'title ' + name + ' actionbar ' + JSON.stringify({ text: text, color: color || 'gold' })) }

// ===================== THE ARENA =====================

function arena() { const A = db().arena; return A && A.dim ? A : null }
// Sends a player to a random safe spot within the arena's radius (vanilla spreadplayers: no lava, water or fire),
// or onto the arena point if the radius is 0 or no safe spot is found.
function sendToArena(server, p) {
  const A = arena()
  if (!A) return false
  const n = nameOf(p), r = Math.max(0, Math.round(Number(A.radius) || 0))
  if (r >= 1) {
    let under = ''
    if (ARENA_HEADROOM > 0) under = ' under ' + Math.floor(A.y + ARENA_HEADROOM)
    else if (/the_nether$/.test(A.dim)) under = ' under ' + Math.floor(A.y + 10)
    if (run(server, 'execute in ' + A.dim + ' run spreadplayers ' + A.x + ' ' + A.z + ' 0 ' + r + under + ' false ' + n)) return true
  }
  run(server, 'execute in ' + A.dim + ' run tp ' + n + ' ' + A.x + ' ' + A.y + ' ' + A.z)
  return true
}
// Takes a player back to where they were when they joined the fight (once).
function goBack(server, p, V) {
  const f = V.from
  if (!f) return
  run(server, 'execute in ' + f.dim + ' run tp ' + nameOf(p) + ' ' + f.x + ' ' + f.y + ' ' + f.z + ' ' + f.yaw + ' ' + f.pitch)
  delete V.from
}
// ===================== THE GLOW AND THE HIDDEN NAMES =====================

function useTeams() { return GLOW_EVERYONE || HIDE_NAMETAGS }
// Who's in the event: a fighter (kit modes), or anyone playing (modes without kits). Never creative or spectator.
function inEvent(p) {
  const C = db().cur
  if (!C || notPlaying(p)) return false
  return C.kit ? !!C.fighters[uuidOf(p)] : true
}
function ensureTeams(server) {
  if (!useTeams()) return
  const tags = HIDE_NAMETAGS ? 'never' : 'always'
  ;[[TEAM_ALL, 'white'], [TEAM_MARKED, MARKED_COLOR]].forEach(t => {
    run(server, 'team add ' + t[0])                  // already there after a restart: that's fine
    run(server, 'team modify ' + t[0] + ' color ' + t[1])
    run(server, 'team modify ' + t[0] + ' nametagVisibility ' + tags)
    run(server, 'team modify ' + t[0] + ' friendlyFire true')
    run(server, 'team modify ' + t[0] + ' seeFriendlyInvisibles false')
  })
}
function markedNames(server) {
  const C = db().cur, M = C ? MODES[C.mode] : null
  if (!M || !M.marked) return []
  try { return M.marked(server) || [] } catch (e) { return [] }
}
// Puts a player on a Purge team, noting their own team the first time (given back at the end).
function joinTeam(server, p, team) {
  const C = db().cur, u = uuidOf(p), n = nameOf(p)
  if (!C.teams) C.teams = {}
  if (!C.teams[u]) {
    let own = ''
    try {
      let t = p.getTeam()
      if (t != null) own = String(t.getName())
    } catch (e) { }
    if (own == TEAM_ALL || own == TEAM_MARKED) own = ''
    C.teams[u] = { name: n, team: own }
    save()
  }
  if (S.team[n] == team) return
  run(server, 'team join ' + team + ' ' + n)
  S.team[n] = team
}
function glow(server, n) { run(server, 'effect give ' + n + ' minecraft:glowing ' + (SLOW_EVERY + 2) + ' 0 true') }
// One player: their team (marked or not) and their glow. 'marked' is worked out if not given.
function highlightOne(server, p, marked) {
  if (!inEvent(p)) return
  if (!marked) marked = markedNames(server)
  const n = nameOf(p), isMarked = marked.indexOf(n) >= 0
  if (useTeams()) joinTeam(server, p, isMarked ? TEAM_MARKED : TEAM_ALL)
  if (GLOW_EVERYONE || isMarked) glow(server, n)
  if (INVISIBLE_EVERYONE) {
    run(server, 'effect give ' + n + ' minecraft:invisibility ' + (SLOW_EVERY + 2) + ' 0 true')   // true: no particles
    let C = db().cur
    if (!C.lit) C.lit = {}
    if (!C.lit[uuidOf(p)]) { C.lit[uuidOf(p)] = n; save() }   // made invisible: cleared at the end
  }
}
function highlight(server) {
  if (!db().cur) return
  const marked = markedNames(server)
  players(server).forEach(p => highlightOne(server, p, marked))
}
// The end: everyone back on their own team (by name, so offline players too), then the Purge teams go.
function restoreTeams(server, C) {
  const T = C.teams || {}
  Object.keys(T).forEach(u => { if (T[u].team) run(server, 'team join ' + T[u].team + ' ' + T[u].name) })
  if (useTeams() || Object.keys(T).length) {
    run(server, 'team remove ' + TEAM_ALL)
    run(server, 'team remove ' + TEAM_MARKED)
  }
  S.team = {}
}

// Lethal damage to a fighter in the arena: healed, a fresh kit (a new life), and a new random spot in the arena.
function knockout(server, p, u) {
  const C = db().cur, n = nameOf(p)
  try { p.setHealth(p.getMaxHealth()) } catch (e) { try { p.health = 20 } catch (e2) { } }
  try { p.clearFire() } catch (e) { }
  try { p.fallDistance = 0 } catch (e) { }
  run(server, 'effect clear ' + n)
  const life = (C.lives[u] || 0) + 1
  C.lives[u] = life
  save()
  giveKit(server, p, C.kit, life)
  sendToArena(server, p)
  highlightOne(server, p)                            // the effect clear took the glow
  run(server, 'effect give ' + n + ' minecraft:saturation 1 20 true')
  run(server, 'effect give ' + n + ' minecraft:resistance ' + RESPAWN_RESISTANCE_SECONDS + ' 4 true')
  tell(p, 'Knocked out. Back in the arena with a fresh kit.', 'red')
}
function soundAt(server, name, sound, vol, pitch) {
  run(server, 'execute as ' + name + ' at @s run playsound ' + sound + ' master @s ~ ~ ~ ' + (vol || 1) + ' ' + (pitch || 1))
}
function damageType(source) {
  try { return String(typeof source.getMsgId == 'function' ? source.getMsgId() : source.getType()) } catch (e) { return '' }
}
function attackerOf(source) {
  try { return typeof source.getActual == 'function' ? source.getActual() : source.getEntity() } catch (e) { return null }
}
function econ() { return global.Economy || null }
function afk(p) {
  const E = econ()
  if (!SKIP_AFK || !E || typeof E.isAfk != 'function') return false
  try { return !!E.isAfk(p) } catch (e) { return false }
}
function emptyStack() { try { return Item.empty } catch (e) { return Item.of('minecraft:air') } }
function stackNbt(s) { try { return s.nbt != null ? String(s.nbt) : '' } catch (e) { return '' } }
// A vaulted stack is saved whole (Forge's serializeNBT: id, Count, tag and ForgeCaps). Some mods keep an item's contents
// in a Forge capability outside its tag: Extra Utilities' Golden Bag of Holding keeps its 54 slots there, EvilCraft's
// Broom its blood. Rebuilt from id + tag, such an item comes back empty. 'nbt' is kept for reading and older records.
// (KubeJS's own toNBTJS() is hidden from scripts: calling it fails, which is why serializeNBT is used.)
function stackFull(s) { try { return String(s.serializeNBT()) } catch (e) { return '' } }
function savedStack(s, slot) {
  const r = { id: String(s.id), count: Number(s.count), nbt: stackNbt(s), full: stackFull(s) }
  if (slot != null) r.slot = slot
  return r
}
// Rebuilds a saved stack: whole with ItemStack.of (as the game loads a chest), or a record saved before 'full' from its
// id, count and tag. Throws if it can't, so the stack stays in the vault.
function rebuild(r) {
  if (!r.full) return Item.of(r.id, r.count, r.nbt || null)
  if (!ItemStackClass || typeof NBT == 'undefined') throw new Error('ItemStack.of is not available')
  const st = ItemStackClass.of(NBT.toTagCompound(r.full))
  if (!st || st.isEmpty()) throw new Error('unknown item ' + r.id)
  return st
}
// Whether a saved stack was saved whole and comes back as the same item and count, with its ForgeCaps if it had any.
// Checked before a fighter's inventory is cleared.
function rebuilds(r) {
  if (!r.full) { console.error('[Purge] Can\'t save ' + r.id + ' whole'); return false }
  try {
    let st = rebuild(r)
    if (String(st.id) != r.id || Number(st.count) != r.count) return false
    return !/ForgeCaps/.test(r.full) || /ForgeCaps/.test(stackFull(st))
  } catch (e) {
    console.error('[Purge] Can\'t rebuild ' + r.id + ': ' + e)
    return false
  }
}

// ===================== THE SANCTUARY =====================

function sanctuaryAreas() {
  if (typeof PROTECTED_AREAS == 'undefined' || !PROTECTED_AREAS) return []
  return PROTECTED_AREAS.filter(a => SANCTUARY.indexOf(a.name) >= 0)
}
function inSanctuary(p) {
  const areas = sanctuaryAreas()
  if (!areas.length) return false
  const d = dimOf(p), q = pos(p), x = Math.floor(q.x), y = Math.floor(q.y), z = Math.floor(q.z)
  return areas.some(a => {
    if (a.dim != d) return false
    if (a.spawnRadius != null) {
      let sp = typeof protectedAreasSpawn == 'function' ? protectedAreasSpawn() : null
      return !!sp && Math.abs(x - sp.x) <= a.spawnRadius && Math.abs(z - sp.z) <= a.spawnRadius
    }
    return x >= Math.min(a.x1, a.x2) && x <= Math.max(a.x1, a.x2) && y >= Math.min(a.y1, a.y2) && y <= Math.max(a.y1, a.y2) &&
      z >= Math.min(a.z1, a.z2) && z <= Math.max(a.z1, a.z2)
  })
}

// ===================== THE LEDGER =====================

function entry(uuid, name) {
  const L = db().cur.ledger
  if (!L[uuid]) L[uuid] = { name: name || '?', kills: 0, deaths: 0, gain: 0, loss: 0 }
  if (name) L[uuid].name = name
  return L[uuid]
}
function curMode() { const C = db().cur; return C ? MODES[C.mode] : null }
function scoreOf(e) { const M = curMode(); return M && M.score ? M.score(e) : e.kills }
function ranked() {
  const L = db().cur.ledger
  return Object.keys(L).map(u => ({ uuid: u, e: L[u], score: scoreOf(L[u]) })).sort((a, b) => b.score - a.score)
}
function addTithe(n, source) {
  n = Math.floor(Number(n) || 0)
  if (!(n > 0)) return
  const D = db()
  D.tithe += n
  D.titheBy[source || 'other'] = (D.titheBy[source || 'other'] || 0) + n
  save()
}

// ===================== KITS AND THE VAULT =====================

function kitMode() { const C = db().cur; return !!(C && C.kit) }
function isFighter(uuid) { const C = db().cur; return !!(C && C.fighters[uuid]) }
// Kit items carry their owner and "life" (it goes up at every respawn): a kit item from another player, or from
// before a death, is taken away. So dropping and picking up kit never adds up to more than one kit.
function lifeTag(uuid, life) { return uuid + '#' + life }
function kitSnbt(uuid, life) {
  return '{PurgeKit:1b,PurgeLife:"' + lifeTag(uuid, life) + '",display:{Lore:[' +
    "'" + JSON.stringify({ text: KIT_LORE, color: 'dark_gray', italic: false }) + "'" + ']}}'
}
function lifeOf(s) { const m = stackNbt(s).match(/PurgeLife:"([^"]+)"/); return m ? m[1] : '' }
function isKitItem(s) { return /PurgeKit:1b/.test(stackNbt(s)) }
function invSize(p) { try { return Number(p.inventory.getContainerSize()) } catch (e) { return 41 } }
function clearInventory(p) {
  try { p.inventory.clearContent(); return } catch (e) { }
  const n = invSize(p)
  for (let i = 0; i < n; i++) { try { p.inventory.setItem(i, emptyStack()) } catch (e) { } }
}
function giveKit(server, p, kitId, life) {
  const K = KITS[kitId], u = uuidOf(p), nbt = kitSnbt(u, life)
  clearInventory(p)
  K.items.forEach((it, i) => { p.inventory.setItem(i, Item.of(it[0], it[1], nbt)) })
  K.armor.forEach((id, i) => { p.inventory.setItem(39 - i, Item.of(id, 1, nbt)) })   // 39 head .. 36 feet
  if (K.offhand) p.inventory.setItem(40, Item.of(K.offhand, 1, nbt))
}
function vaultRecord(p) {
  const slots = [], n = invSize(p)
  for (let i = 0; i < n; i++) {
    let s = p.inventory.getItem(i)
    if (s && !s.isEmpty() && !isKitItem(s)) slots.push(savedStack(s, i))
  }
  return { name: nameOf(p), uuid: uuidOf(p), t: Date.now(), purge: db().cur ? db().cur.id : 0, slots: slots, extras: [] }
}
// JsonIO doesn't create folders: without kubejs/purge_vaults/ the file goes in kubejs/ (as blood_portal.js does).
function backup(rec) {
  const file = rec.name + '_' + rec.uuid + '.json'
  try { JsonIO.write(VAULT_DIR + file, rec) } catch (e) {
    try { JsonIO.write('kubejs/purge_vault_' + file, rec) } catch (e2) { console.warn('[Purge] Backup file for ' + rec.name + ': ' + e2) }
  }
}
// Makes a player a fighter: vault, clear, kit. Only clears the inventory once the vault is safely saved.
function enlist(server, p) {
  const C = db().cur, u = uuidOf(p)
  if (!C || !C.kit || C.fighters[u] || C.skipped[u]) return false
  if (notPlaying(p) || !isAlive(p)) return false
  if (db().vaults[u] && !restore(server, p, true)) {  // an old vault from an earlier Purge comes back first
    C.skipped[u] = true
    tellOps(server, nameOf(p) + ' still has belongings from an earlier Purge that could not be handed back, so they sit this Purge out.')
    return false
  }
  const rec = vaultRecord(p)
  const bad = rec.slots.filter(s => !rebuilds(s))
  if (bad.length) {                                   // never clear what couldn't be handed back
    C.skipped[u] = true
    tellOps(server, nameOf(p) + ' sits this Purge out: ' + bad.length + ' of their items (' + bad[0].id + ') could not be saved safely. Check the server log.')
    console.error('[Purge] Could not vault ' + nameOf(p) + ': ' + bad.map(s => s.id).join(', ') + ' would not rebuild; left untouched')
    return false
  }
  if (arena()) rec.from = whereIs(p)                  // taken back here at the end
  db().vaults[u] = rec
  if (!save()) {
    delete db().vaults[u]
    C.skipped[u] = true
    tellOps(server, nameOf(p) + '\'s belongings could not be saved, so they sit this Purge out. Check the server log.')
    console.error('[Purge] Could not vault ' + nameOf(p) + ': left untouched')
    return false
  }
  backup(rec)
  const life = (C.lives[u] || 0) + 1
  C.lives[u] = life
  C.fighters[u] = { name: nameOf(p) }
  delete C.sheltered[u]
  entry(u, nameOf(p))
  save()
  run(server, 'effect clear ' + nameOf(p))
  giveKit(server, p, C.kit, life)
  if (sendToArena(server, p)) tell(p, 'To the arena. You\'ll be brought back here when the Purge ends.', 'gold')
  highlightOne(server, p)
  tell(p, 'Your belongings are held until the Purge ends (' + rec.slots.length + ' stacks). Your kit: ' + KITS[C.kit].name + '.', 'gold')
  console.info('[Purge] ' + nameOf(p) + ' is fighting: ' + rec.slots.length + ' stacks vaulted')
  return true
}
// Anything a fighter holds that isn't their own current kit: kit from another life or player is taken away; anything
// else goes to their vault's extras, handed back at the end.
function enforce(server, p) {
  const C = db().cur, u = uuidOf(p), V = db().vaults[u]
  if (!V) return
  const mine = lifeTag(u, C.lives[u] || 0), n = invSize(p)
  let kept = 0
  for (let i = 0; i < n; i++) {
    let s = p.inventory.getItem(i)
    if (!s || s.isEmpty()) continue
    let life = lifeOf(s)
    if (life == mine) continue
    if (!life && !isKitItem(s)) { V.extras.push(savedStack(s)); kept++ }
    p.inventory.setItem(i, emptyStack())
  }
  if (!kept) return
  save()
  backup(V)
  if (!C.warned[u]) { C.warned[u] = true; tell(p, 'Only your kit can be used in this Purge. Anything else is kept for you until it ends.', 'gold') }
}
// Hands a vault back: clear the inventory (kit), put every slot back, then the extras. A dead player gets it at respawn.
// If something can't be handed back, only that part stays in the vault (marked partial: a retry gives, never clears).
function restore(server, p, quiet) {
  const D = db(), u = uuidOf(p), V = D.vaults[u]
  if (!V || !isAlive(p)) return false
  goBack(server, p, V)                                // back to where they were when they joined the fight
  if (!V.partial) clearInventory(p)
  const badSlots = [], badExtras = []
  V.slots.forEach(s => {
    try {
      if (V.partial) p.give(rebuild(s))
      else p.inventory.setItem(s.slot, rebuild(s))
    } catch (e) { badSlots.push(s); console.error('[Purge] ' + V.name + ' slot ' + s.slot + ' (' + s.id + '): ' + e) }
  })
  V.extras.forEach(s => {
    try { p.give(rebuild(s)) } catch (e) { badExtras.push(s); console.error('[Purge] ' + V.name + ' extra ' + s.id + ': ' + e) }
  })
  if (badSlots.length || badExtras.length) {
    V.slots = badSlots
    V.extras = badExtras
    V.partial = true
    save()
    backup(V)
    tellOps(server, (badSlots.length + badExtras.length) + ' of ' + V.name + '\'s items could not be handed back. They stay in the vault (/purge vaults) and in ' + VAULT_DIR + '.')
    return false
  }
  V.restored = Date.now()
  backup(V)
  delete D.vaults[u]
  save()
  run(server, 'effect clear ' + nameOf(p) + ' minecraft:glowing')
  if (!quiet) tell(p, 'Your belongings are back: ' + V.slots.length + ' stacks' + (V.extras.length ? ', plus ' + V.extras.length + ' you picked up' : '') + '.', 'gold')
  console.info('[Purge] Handed back ' + V.name + '\'s vault')
  return true
}
// A vault from an earlier Purge (or this one, once it's over) that should go back to its owner.
function owesVault(u) {
  const D = db(), C = D.cur, V = D.vaults[u]
  return !!V && !(C && C.fighters[u] && V.purge == C.id)
}
function restoreIfOwed(server, p) { if (owesVault(uuidOf(p))) restore(server, p, false) }

// ===================== THE MODES =====================
// A mode: { name, blurb, rules: [lines], kits: [kit ids] (omit for no kits), score(entry), scoreLabel,
//   onStart(server), onKill(server, ctx), onTick(server), bossbar(server) -> text, status(server, player) -> text,
//   marked(server) -> [names] (they glow gold),
//   onEnd(server, ranked) -> [lines] }. ctx = { killer, killerUuid, killerName, victim (null if offline), victimUuid,
//   victimName, offline }.

const MODES = {
  heist: {
    name: 'The Potato Heist',
    blurb: 'Every kill steals from the victim\'s Potato War total.',
    rules: [
      'Every kill steals ' + Math.round(STEAL_SHARE * 100) + '% of the victim\'s Potato War total (up to ' + fmt(STEAL_MAX) + '). Ranks are never lost.',
      'Players below rank ' + MIN_VICTIM_RANK + ' can\'t be robbed. Rob the same player again and it\'s worth less.',
      'Kill someone who robbed you and you take back double.',
      GLOW_EVERYONE ? 'The richest war chests glow gold.' : 'The richest war chests glow.',
    ],
    kits: ['soldier', 'peasant', 'archer', 'gladiator'],
    score: e => (e.gain || 0) - (e.loss || 0),
    scoreLabel: 'net potatoes',
    onStart: server => { db().cur.modeData = { pairs: {}, robbed: {} } },
    onKill: (server, ctx) => heistKill(server, ctx),
    marked: server => richestList(server).slice(0, GLOW_TOP).map(r => r.name),
    bossbar: server => {
      const r = richest(server)
      return r ? 'Richest war chest: ' + r.name + ' (' + fmt(r.potatoes) + ')' : ''
    },
    status: (server, p) => {
      const r = richest(server)
      return r ? 'Richest war chest online: ' + r.name + ' (' + fmt(r.potatoes) + ').' : ''
    },
    onEnd: (server, rows) => heistSummary(server, rows),
  },
}

// ===================== THE POTATO HEIST =====================

function pool() { return global.BloodPool || null }
function potatoesOf(uuid) { const BP = pool(); try { return BP.standingOfUuid(uuid) } catch (e) { return { potatoes: 0, tier: 0 } } }
function richestList(server) {
  if (!pool()) return []
  return players(server).filter(p => isFighter(uuidOf(p)) || !kitMode())
    .map(p => ({ name: nameOf(p), p: p, potatoes: potatoesOf(uuidOf(p)).potatoes }))
    .filter(r => r.potatoes > 0).sort((a, b) => b.potatoes - a.potatoes)
}
function richest(server) { return richestList(server)[0] || null }
function stealBase(potatoes) { return Math.min(STEAL_MAX, Math.max(STEAL_MIN, Math.round(potatoes * STEAL_SHARE))) }
function heistKill(server, ctx) {
  const BP = pool()
  if (!BP || typeof BP.takeStanding != 'function') { console.warn('[Purge] part2/blood_pool.js (with takeStanding) is not installed: the Heist steals nothing'); return }
  const M = db().cur.modeData, k = ctx.killerUuid, v = ctx.victimUuid
  const grudge = !!(M.robbed[k] && M.robbed[k][v])          // the victim robbed the killer earlier in this Heist
  const vs = potatoesOf(v)
  if (!grudge && vs.tier < MIN_VICTIM_RANK) {
    if (ctx.killer) actionbar(server, ctx.killerName, ctx.victimName + '\'s war chest is too small to raid.', 'gray')
    return
  }
  const pair = k + '>' + v, n = M.pairs[pair] || 0
  M.pairs[pair] = n + 1
  const factor = grudge ? GRUDGE_FACTOR : REPEAT_FACTORS[Math.min(n, REPEAT_FACTORS.length - 1)]
  const want = Math.min(vs.potatoes, Math.round(stealBase(vs.potatoes) * factor))
  if (!(want > 0)) return
  const taken = BP.takeStanding(v, ctx.victimName, want)
  if (!(taken > 0)) return
  const gain = Math.floor(taken * (1 - TITHE_SHARE)), tithe = taken - gain
  BP.giveStanding(k, ctx.killerName, gain)
  addTithe(tithe, 'heist')
  if (grudge) delete M.robbed[k][v]
  if (!M.robbed[v]) M.robbed[v] = {}
  M.robbed[v][k] = true
  entry(k, ctx.killerName).gain += gain
  entry(v, ctx.victimName).loss += taken
  save()
  const what = (grudge ? 'took back ' : 'stole ') + fmt(gain) + ' potatoes from ' + ctx.victimName + '\'s war chest'
  if (ctx.killer) {
    title(server, ctx.killerName, '+' + fmt(gain) + ' potatoes', (grudge ? 'Revenge on ' : 'Stolen from ') + ctx.victimName, 'gold')
    actionbar(server, ctx.killerName, 'You ' + what + '.', 'gold')
    soundAt(server, ctx.killerName, 'minecraft:entity.player.levelup', 1, 1.4)
  }
  if (ctx.victim) {
    let q = pos(ctx.victim), d = dimOf(ctx.victim)
    run(server, 'execute in ' + d + ' run particle minecraft:item minecraft:potato ' + q.x + ' ' + (q.y + 1) + ' ' + q.z + ' 0.4 0.6 0.4 0.15 40 force')
    run(server, 'execute in ' + d + ' run playsound minecraft:entity.item.pickup master @a ' + q.x + ' ' + q.y + ' ' + q.z + ' 1 0.6')
    tell(ctx.victim, 'Your war chest was raided by ' + ctx.killerName + ': -' + fmt(taken) + ' potatoes. Your rank is safe. Kill them back to take double.', 'red')
  } else {
    report(v, 'You logged out mid-fight in the Purge. ' + ctx.killerName + ' raided your war chest: -' + fmt(taken) + ' potatoes.')
  }
  tellAll(server, ctx.killerName + ' ' + (grudge ? 'took revenge on ' : 'raided ') + ctx.victimName + '\'s war chest' + (ctx.offline ? ' (they ran)' : '') + '.', 'gold')
  console.info('[Purge] Heist: ' + ctx.killerName + ' took ' + taken + ' from ' + ctx.victimName + ' (' + gain + ' kept, ' + tithe + ' tithed' + (grudge ? ', grudge' : '') + ')')
}
function heistSummary(server, rows) {
  const lines = []
  const gains = rows.filter(r => r.score > 0).slice(0, 3)
  const losses = rows.filter(r => r.score < 0).sort((a, b) => a.score - b.score).slice(0, 3)
  if (gains.length) lines.push('Biggest hauls: ' + gains.map(r => r.e.name + ' ' + signed(r.score)).join(', ') + '.')
  if (losses.length) lines.push('Hardest hit: ' + losses.map(r => r.e.name + ' ' + signed(r.score)).join(', ') + '.')
  return lines
}
function report(uuid, text) {
  const R = db().reports
  if (!R[uuid]) R[uuid] = []
  R[uuid].push(text)
  save()
}

// ===================== THE ENGINE =====================

function loop(server) {
  const token = (global.__purgeLoop = (global.__purgeLoop || 0) + 1)   // one loop, even across /reload
  const tick = () => {
    if (global.__purgeLoop != token) return
    try { step(server) } catch (e) { console.error('[Purge] Tick: ' + e) }
    if (db().cur) server.scheduleInTicks(TICK, tick)
  }
  server.scheduleInTicks(TICK, tick)
}
function step(server) {
  const C = db().cur
  if (!C) return
  if (Date.now() >= C.endsAt) { finish(server, 'time'); return }
  if (C.kit) {
    players(server).forEach(p => {
      let u = uuidOf(p)
      if (C.fighters[u]) { if (isAlive(p)) enforce(server, p); return }
      if (C.skipped[u] || notPlaying(p) || !isAlive(p)) return
      if (inSanctuary(p) && !arena()) {                // with an arena, everyone is taken in
        if (!C.sheltered[u]) { C.sheltered[u] = true; tell(p, 'You\'re in the sanctuary: nobody fights here. Step out and you fight with the kit.', 'gold') }
        return
      }
      enlist(server, p)
    })
  }
  S.slow++
  if (S.slow % SLOW_EVERY) return
  const M = MODES[C.mode]
  if (M.onTick) { try { M.onTick(server) } catch (e) { console.error('[Purge] ' + C.mode + ' tick: ' + e) } }
  highlight(server)
  updateBossbar(server)
}
function updateBossbar(server) {
  const C = db().cur, M = MODES[C.mode]
  let extra = ''
  if (M.bossbar) { try { extra = M.bossbar(server) || '' } catch (e) { } }
  const left = C.endsAt - Date.now()
  run(server, 'bossbar set ' + BOSSBAR + ' name ' + JSON.stringify({ text: M.name.toUpperCase() + '  ' + clock(left) + (extra ? '  ·  ' + extra : ''), color: 'red', bold: true }))
  run(server, 'bossbar set ' + BOSSBAR + ' value ' + Math.max(0, Math.ceil(left / 1000)))
  run(server, 'bossbar set ' + BOSSBAR + ' players @a')
}
function showBossbar(server) {
  const C = db().cur
  run(server, 'bossbar add ' + BOSSBAR + ' ' + JSON.stringify({ text: 'THE PURGE', color: 'red' }))
  run(server, 'bossbar set ' + BOSSBAR + ' color red')
  run(server, 'bossbar set ' + BOSSBAR + ' max ' + Math.max(1, Math.round(C.minutes * 60)))
  run(server, 'bossbar set ' + BOSSBAR + ' visible true')
  updateBossbar(server)
}

// Why a Purge can't be started now ('' if it can).
function busy() {
  const D = db()
  if (D.cur) return 'A Purge is already running (' + MODES[D.cur.mode].name + '). /purge stop ends it.'
  if (D.pending) return 'A Purge is already counting down (' + clock(D.pending.at - Date.now()) + ' left). /purge stop calls it off.'
  try { if (global.Gladiator && global.Gladiator.busy()) return 'A gladiator match is on in the arena (gladiator_arena.js). /gladiator stop ends it.' } catch (e) { }
  return ''
}
// When the last Purge ended (0 if there hasn't been one).
function lastEnded() {
  const h = db().history[0]
  if (!h) return 0
  return h.ended || (h.started + h.minutes * 60000)
}
// Starts the countdown (or the Purge itself, with no countdown). opts.declared: set off by an Unsigned Declaration.
// Returns '' when it's under way, or why not.
function start(server, modeId, minutes, kitId, opts) {
  const D = db()
  opts = opts || {}
  modeId = String(modeId || '').toLowerCase()
  const M = MODES[modeId]
  const why = busy()
  if (why) return why
  if (!M) return 'There\'s no mode called "' + modeId + '". Modes: ' + Object.keys(MODES).join(', ') + '.'
  minutes = Math.round(Number(minutes))
  if (!(minutes >= 1 && minutes <= MAX_MINUTES)) return 'A Purge lasts 1 to ' + MAX_MINUTES + ' minutes.'
  let kit = null
  if (M.kits && M.kits.length) {
    kit = kitId ? String(kitId).toLowerCase() : M.kits[Math.floor(Math.random() * M.kits.length)]
    if (M.kits.indexOf(kit) < 0) return 'There\'s no kit called "' + kitId + '" for ' + M.name + '. Kits: ' + M.kits.join(', ') + '.'
  }
  if (!(COUNTDOWN_SECONDS > 0)) { begin(server, modeId, minutes, kit); return '' }
  D.pending = { mode: modeId, kit: kit, minutes: minutes, at: Date.now() + COUNTDOWN_SECONDS * 1000, declared: !!opts.declared }
  save()
  const lead = opts.declared ? 'An unsigned declaration has been posted. ' : ''
  tellAll(server, lead + 'THE PURGE begins in ' + COUNTDOWN_SECONDS + ' seconds: ' + M.name + ', ' + minutes + ' minutes' +
    (kit ? ', kit: ' + KITS[kit].name : '') + '.', 'red')
  if (kit) tellAll(server, 'Your belongings will be held until it ends' + (arena() ? ', and you\'ll be taken to the arena.' : '.') + ' Get ready.', 'gray')
  S.said = {}
  countdown(server)
  console.info('[Purge] Countdown: ' + modeId + ' for ' + minutes + ' minutes' + (kit ? ' (kit ' + kit + ')' : '') + (opts.declared ? ', declared' : ''))
  return ''
}
// The countdown: a title and a tick for everyone at each of COUNTDOWN_MARKS, then the Purge. One loop, even across
// /reload; it reads the saved countdown each second, so a restart carries on (or begins at once if it ran out).
function countdown(server) {
  const token = (global.__purgeCountdown = (global.__purgeCountdown || 0) + 1)
  const tick = () => {
    if (global.__purgeCountdown != token) return
    const D = db(), P = D.pending
    if (!P) return
    const left = Math.ceil((P.at - Date.now()) / 1000)
    if (left <= 0) {
      D.pending = null
      save()
      try { begin(server, P.mode, P.minutes, P.kit) } catch (e) { console.error('[Purge] Begin: ' + e) }
      return
    }
    if (COUNTDOWN_MARKS.indexOf(left) >= 0 && !S.said[left]) {
      S.said[left] = true
      players(server).forEach(p => {
        let n = nameOf(p)
        if (left <= 5) title(server, n, String(left), '', 'red')
        else title(server, n, 'THE PURGE', 'begins in ' + left + ' seconds', 'dark_red')
        soundAt(server, n, left <= 5 ? 'minecraft:block.note_block.pling' : 'minecraft:block.bell.use', 1, left <= 5 ? 0.5 + (6 - left) * 0.25 : 1)
      })
    }
    server.scheduleInTicks(TICK, tick)
  }
  tick()
}
// Calls off a countdown. Returns false if there wasn't one.
function callOff(server) {
  const D = db()
  if (!D.pending) return false
  D.pending = null
  save()
  global.__purgeCountdown = (global.__purgeCountdown || 0) + 1
  players(server).forEach(p => run(server, 'title ' + nameOf(p) + ' clear'))
  tellAll(server, 'The Purge has been called off.', 'gray')
  console.info('[Purge] Countdown called off')
  return true
}
// The Purge itself, after the countdown.
function begin(server, modeId, minutes, kit) {
  const D = db(), M = MODES[modeId]
  if (D.cur) return
  const now = Date.now()
  D.cur = { id: now, mode: modeId, kit: kit, minutes: minutes, started: now, endsAt: now + minutes * 60000,
    ledger: {}, fighters: {}, sheltered: {}, skipped: {}, lives: {}, warned: {}, modeData: {} }
  if (M.onStart) M.onStart(server)
  save()
  S.lastHit = {}
  run(server, 'time set midnight')
  run(server, 'weather thunder ' + (minutes * 60) + 's')     // a time argument: s = seconds
  players(server).forEach(p => {
    let n = nameOf(p)
    title(server, n, 'THE PURGE', M.name + ' has begun', 'dark_red')
    soundAt(server, n, 'minecraft:event.raid.horn', 64, 1)
  })
  tellAll(server, M.name.toUpperCase() + ' has begun. ' + minutes + ' minutes.', 'red')
  M.rules.forEach(r => tellAll(server, r, 'gray'))
  if (kit) tellAll(server, 'Kit: ' + KITS[kit].name + ' (' + KITS[kit].blurb + '). Everyone fights with it; your own belongings are held and handed back at the end.', 'gray')
  if (kit && arena()) tellAll(server, 'Everyone is taken to the arena, and brought back to where they were when it ends. Nobody dies in there: a fatal blow knocks you out, and you\'re back in with a fresh kit.', 'gray')
  else if (sanctuaryAreas().length) tellAll(server, 'The sanctuary at the castle is neutral ground. Leave it and you fight.', 'gray')
  const seen = INVISIBLE_EVERYONE && GLOW_EVERYONE ? 'is invisible, but glows' : INVISIBLE_EVERYONE ? 'is invisible' : GLOW_EVERYONE ? 'glows' : ''
  if (seen) tellAll(server, 'Everyone in the fight ' + seen + (HIDE_NAMETAGS ? ', and no names show over heads.' : '.'), 'gray')
  else if (HIDE_NAMETAGS) tellAll(server, 'No names show over heads during the fight.', 'gray')
  tellAll(server, 'Your participation is appreciated.', 'dark_gray')
  S.team = {}
  ensureTeams(server)
  if (kit) step(server)                   // enlist everyone now (not in a second)
  highlight(server)
  showBossbar(server)
  loop(server)
  console.info('[Purge] Started ' + modeId + ' for ' + minutes + ' minutes' + (kit ? ' (kit ' + kit + ')' : ''))
  return ''
}

function finish(server, reason) {
  const D = db(), C = D.cur
  if (!C) return
  const M = MODES[C.mode]
  const rows = ranked()
  let lines = []
  if (M.onEnd) { try { lines = M.onEnd(server, rows) || [] } catch (e) { console.error('[Purge] ' + C.mode + ' end: ' + e) } }
  const top = rows[0] && rows[0].score > 0 ? rows[0] : null
  D.history.unshift({ mode: C.mode, kit: C.kit, started: C.started, ended: Date.now(), minutes: Math.round((Date.now() - C.started) / 60000), reason: reason,
    winner: top ? top.e.name : '', score: top ? top.score : 0, fighters: Object.keys(C.ledger).length })
  if (D.history.length > HISTORY_SIZE) D.history.length = HISTORY_SIZE
  D.cur = null
  save()
  global.__purgeLoop = (global.__purgeLoop || 0) + 1     // stop the loop
  run(server, 'bossbar remove ' + BOSSBAR)
  run(server, 'kill @e[type=minecraft:item,nbt={Item:{tag:{PurgeKit:1b}}}]')
  players(server).forEach(p => {
    let n = nameOf(p), u = uuidOf(p)
    run(server, 'effect clear ' + n + ' minecraft:glowing')
    if (C.lit && C.lit[u]) run(server, 'effect clear ' + n + ' minecraft:invisibility')   // only those it made invisible
    title(server, n, 'THE PURGE IS OVER', 'Your participation has been recorded. Thank you.', 'gray')
    if (D.vaults[u]) restore(server, p, false)       // a dead player gets it when they respawn
    let e = C.ledger[u]
    if (e) tell(p, 'Your Purge: ' + e.kills + ' kill' + (e.kills == 1 ? '' : 's') + ', ' + e.deaths + ' death' + (e.deaths == 1 ? '' : 's') + ', ' + signed(scoreOf(e)) + ' ' + (M.scoreLabel || 'points') + '.', 'gold')
  })
  restoreTeams(server, C)                            // names over heads come back; own teams given back
  tellAll(server, M.name + ' is over.' + (reason == 'stopped' ? ' (Ended early.)' : ''), 'red')
  lines.forEach(l => tellAll(server, l, 'gold'))
  if (top) tellAll(server, top.e.name + ' wins the Purge (' + signed(top.score) + ' ' + (M.scoreLabel || 'points') + ').', 'gold')
  console.info('[Purge] Ended ' + C.mode + ' (' + reason + ')' + (top ? ': ' + top.e.name + ' wins with ' + top.score : ''))
}

// A kill: the killer struck the blow, or hit the victim in the last LAST_HIT_SECONDS.
function creditKill(server, killerUuid, killerName, victim, victimUuid, victimName, offline) {
  const C = db().cur
  if (!C || !killerUuid || killerUuid == victimUuid) return
  const killer = playerByUuid(server, killerUuid)
  if (victim && !offline && afk(victim)) return
  if ((victim && inSanctuary(victim)) || (killer && inSanctuary(killer))) return
  entry(killerUuid, killerName).kills++
  entry(victimUuid, victimName).deaths++
  save()
  const M = MODES[C.mode]
  if (M.onKill) {
    try { M.onKill(server, { killer: killer, killerUuid: killerUuid, killerName: killerName, victim: offline ? null : victim, victimUuid: victimUuid, victimName: victimName, offline: !!offline }) } catch (e) { console.error('[Purge] ' + C.mode + ' kill: ' + e) }
  }
}
function recentHit(victimUuid, seconds) {
  const h = S.lastHit[victimUuid]
  return h && Date.now() - h.t <= seconds * 1000 ? h : null
}

EntityEvents.hurt(event => {
  if (!db().cur) return
  const v = event.entity
  if (!isPlayer(v)) return
  const a = attackerOf(event.source)
  if (!isPlayer(a) || uuidOf(a) == uuidOf(v)) return
  if (inSanctuary(v) || inSanctuary(a)) {
    try { actionbar(event.server || Utils.server, nameOf(a), 'No fighting in the sanctuary.', 'gray') } catch (e) { }
    event.cancel()
  }
  S.lastHit[uuidOf(v)] = { uuid: uuidOf(a), name: nameOf(a), t: Date.now() }
})

EntityEvents.death(event => {
  const C = db().cur
  if (!C) return
  const v = event.entity
  if (!isPlayer(v)) return
  const server = event.server || Utils.server, vu = uuidOf(v)
  const a = attackerOf(event.source)
  let killer = null
  if (isPlayer(a) && uuidOf(a) != vu) killer = { uuid: uuidOf(a), name: nameOf(a) }
  else if (damageType(event.source) != 'genericKill') killer = recentHit(vu, LAST_HIT_SECONDS)
  delete S.lastHit[vu]
  if (killer) creditKill(server, killer.uuid, killer.name, v, vu, nameOf(v), false)
  if (!C.kit || !C.fighters[vu]) return
  if (arena() && damageType(event.source) != 'genericKill') {   // /kill still kills
    knockout(server, v, vu)                          // like a totem: no death, no drops, no corpse
    event.cancel()
  }
  clearInventory(v)                                  // a real death: nothing drops, no kit on the ground, no corpse
})

PlayerEvents.respawned(event => {
  const p = event.player, server = event.server || Utils.server, u = uuidOf(p), C = db().cur
  if (C && C.kit && C.fighters[u]) {
    let life = (C.lives[u] || 0) + 1
    C.lives[u] = life
    save()
    giveKit(server, p, C.kit, life)
    sendToArena(server, p)
    highlightOne(server, p)
    run(server, 'effect give ' + nameOf(p) + ' minecraft:resistance ' + RESPAWN_RESISTANCE_SECONDS + ' 4 true')
    return
  }
  if (owesVault(u)) server.scheduleInTicks(1, () => restoreIfOwed(server, p))
})

PlayerEvents.loggedOut(event => {
  const C = db().cur
  if (!C) return
  const p = event.player, u = uuidOf(p), server = event.server || Utils.server
  const h = recentHit(u, COMBAT_LOG_SECONDS)
  delete S.lastHit[u]
  if (!h || inSanctuary(p)) return
  console.info('[Purge] ' + nameOf(p) + ' logged out mid-fight: counted as killed by ' + h.name)
  creditKill(server, h.uuid, h.name, p, u, nameOf(p), true)
})

PlayerEvents.loggedIn(event => {
  const p = event.player, u = uuidOf(p), server = event.server || Utils.server, D = db(), C = D.cur
  if (owesVault(u)) server.scheduleInTicks(20, () => restoreIfOwed(server, p))
  if (D.reports[u]) {
    let lines = D.reports[u]
    delete D.reports[u]
    save()
    server.scheduleInTicks(40, () => lines.forEach(l => tell(p, l, 'red')))
  }
  if (C) server.scheduleInTicks(40, () => {
    tell(p, MODES[C.mode].name + ' is running: ' + clock(C.endsAt - Date.now()) + ' left.' + (C.kit ? ' Kit: ' + KITS[C.kit].name + '.' : ''), 'red')
  })
})

// Fighters can't teleport out of a fight.
function blocksCommand(p, cmd) {
  const C = db().cur
  if (!C || !p || BLOCKED_COMMANDS.indexOf(String(cmd)) < 0) return false
  if (!BLOCK_OPS_TOO && isOp(p)) return false
  return !C.kit || !!C.fighters[uuidOf(p)] || !inSanctuary(p)
}
BLOCKED_COMMANDS.forEach(cmd => {
  ServerEvents.command(cmd, event => {
    let p = null
    try { p = event.getParseResults().getContext().getSource().getPlayer() } catch (e) { }
    if (!p || !blocksCommand(p, cmd)) return
    tell(p, '/' + cmd + ' doesn\'t work during the Purge. No getting away.', 'red')
    event.cancel()
  })
})

// After a restart or /reload: carry on (or wrap up a Purge whose time ran out while the server was down).
function resume(server) {
  const C = db().cur
  if (!C && db().pending) {                        // a countdown was on: carry on (or begin, if it ran out)
    S.said = {}
    countdown(server)
    console.info('[Purge] Resumed the countdown')
    return
  }
  if (!C) return
  if (Date.now() >= C.endsAt) { finish(server, 'time'); return }
  ensureTeams(server)
  showBossbar(server)
  loop(server)
  console.info('[Purge] Resumed ' + C.mode + ': ' + clock(C.endsAt - Date.now()) + ' left')
}
ServerEvents.loaded(event => resume(event.server))
try { if (Utils.server) resume(Utils.server) } catch (e) { }

// ===================== COMMANDS =====================

ServerEvents.commandRegistry(event => {
  const Commands = event.commands, Arguments = event.arguments
  const reply = (ctx, text, bad) => { ctx.source.sendSystemMessage(comp(voiced(text, bad ? 'red' : 'gray'))); return bad ? 0 : 1 }
  const safe = fn => ctx => { try { return fn(ctx) } catch (e) { console.error('[Purge] ' + e); return reply(ctx, 'Error: ' + e, true) } }
  const op = src => src.hasPermission(2)
  const str = (ctx, name) => String(StringArg.getString(ctx, name))
  const suggest = (arg, values) => {
    try { return arg.suggests((c, b) => { values().forEach(v => b.suggest(v)); return b.buildFuture() }) } catch (e) { return arg }
  }
  const word = (name, values) => suggest(Commands.argument(name, StringArg.word()), values)
  const status = ctx => {
    const C = db().cur, server = ctx.source.server, P = db().pending
    if (!C && P) return reply(ctx, MODES[P.mode].name + (P.kit ? ' (kit: ' + KITS[P.kit].name + ')' : '') + ', ' + P.minutes + ' minutes, begins in ' + clock(P.at - Date.now()) + '.')
    if (!C) {
      let h = db().history[0]
      return reply(ctx, 'No Purge is running.' + (h ? ' The last was ' + MODES[h.mode].name + (h.winner ? ', won by ' + h.winner : '') + '.' : ''))
    }
    const M = MODES[C.mode], p = ctx.source.getPlayer()
    reply(ctx, M.name + (C.kit ? ' (kit: ' + KITS[C.kit].name + ')' : '') + ': ' + clock(C.endsAt - Date.now()) + ' left.')
    if (p && C.ledger[uuidOf(p)]) {
      let e = C.ledger[uuidOf(p)]
      reply(ctx, 'You: ' + e.kills + ' kills, ' + e.deaths + ' deaths, ' + signed(scoreOf(e)) + ' ' + (M.scoreLabel || 'points') + '.')
    }
    if (M.status) { let s = M.status(server, p); if (s) reply(ctx, s) }
    return 1
  }
  const top = ctx => {
    const C = db().cur
    if (!C) return reply(ctx, 'No Purge is running.', true)
    const rows = ranked().slice(0, 10), M = MODES[C.mode]
    if (!rows.length) return reply(ctx, 'Nobody has scored yet.')
    rows.forEach((r, i) => reply(ctx, (i + 1) + '. ' + r.e.name + ': ' + signed(r.score) + ' ' + (M.scoreLabel || 'points') + ' (' + r.e.kills + ' kills, ' + r.e.deaths + ' deaths)'))
    return 1
  }
  const startCmd = (ctx, withKit) => {
    const why = start(ctx.source.server, str(ctx, 'mode'), Number(Arguments.INTEGER.getResult(ctx, 'minutes')), withKit ? str(ctx, 'kit') : '')
    return why ? reply(ctx, why, true) : reply(ctx, COUNTDOWN_SECONDS > 0 ? 'Started: the countdown is on (' + COUNTDOWN_SECONDS + ' seconds).' : 'Started.')
  }
  const arenaText = A => A.dim + ' ' + Math.floor(A.x) + ' ' + A.y + ' ' + Math.floor(A.z) + ', radius ' + A.radius
  const arenaShow = ctx => {
    const A = arena()
    return A ? reply(ctx, 'Arena: ' + arenaText(A) + '. Fighters are taken there and brought back at the end.')
      : reply(ctx, 'No arena is set: fighters fight where they stand. An op sets one with /purge arena set [radius], standing on the spot.')
  }
  const arenaSet = (ctx, radius) => {
    const p = ctx.source.getPlayer()
    if (!p) return reply(ctx, 'Run it in game, standing where the arena should be.', true)
    radius = Math.round(Number(radius))
    if (!(radius >= 0 && radius <= 500)) return reply(ctx, 'The radius is 0 to 500 blocks.', true)
    const w = whereIs(p)
    db().arena = { dim: w.dim, x: Math.floor(w.x) + 0.5, y: Math.floor(w.y), z: Math.floor(w.z) + 0.5, radius: radius }
    save()
    return reply(ctx, 'Arena set: ' + arenaText(db().arena) + '.' + (db().cur ? ' Used from now on in this Purge.' : ''))
  }
  const restoreCmd = ctx => {
    const name = str(ctx, 'player'), server = ctx.source.server, p = playerByName(server, name)
    if (!p) return reply(ctx, name + ' must be online to get their belongings back.', true)
    const u = uuidOf(p), C = db().cur
    if (!db().vaults[u]) return reply(ctx, name + ' has nothing in the vault.', true)
    if (C && C.fighters[u]) return reply(ctx, name + ' is fighting in this Purge: it comes back at the end.', true)
    if (!isAlive(p)) return reply(ctx, name + ' is dead: it comes back when they respawn.', true)
    return restore(server, p, false) ? reply(ctx, 'Handed back ' + name + '\'s belongings.') : reply(ctx, 'Something could not be handed back: see the server log and ' + VAULT_DIR + '.', true)
  }
  event.register(Commands.literal('purge')
    .executes(safe(status))
    .then(Commands.literal('top').executes(safe(top)))
    .then(Commands.literal('modes').executes(safe(ctx => {
      Object.keys(MODES).forEach(id => reply(ctx, id + ': ' + MODES[id].name + '. ' + MODES[id].blurb + (MODES[id].kits ? ' Kits: ' + MODES[id].kits.join(', ') + '.' : '')))
      return 1
    })))
    .then(Commands.literal('kits').executes(safe(ctx => {
      Object.keys(KITS).forEach(id => reply(ctx, id + ' (' + KITS[id].name + '): ' + KITS[id].blurb + '.'))
      return 1
    })))
    .then(Commands.literal('start').requires(op).then(word('mode', () => Object.keys(MODES))
      .then(Commands.argument('minutes', Arguments.INTEGER.create(event)).executes(safe(ctx => startCmd(ctx, false)))
        .then(word('kit', () => Object.keys(KITS)).executes(safe(ctx => startCmd(ctx, true)))))))
    .then(Commands.literal('stop').requires(op).executes(safe(ctx => {
      if (callOff(ctx.source.server)) return reply(ctx, 'Called off: the countdown is stopped.')
      if (!db().cur) return reply(ctx, 'No Purge is running.', true)
      finish(ctx.source.server, 'stopped')
      return reply(ctx, 'Stopped.')
    })))
    .then(Commands.literal('vaults').requires(op).executes(safe(ctx => {
      const V = db().vaults, keys = Object.keys(V)
      if (!keys.length) return reply(ctx, 'Every vault has been handed back.')
      keys.forEach(u => reply(ctx, V[u].name + ': ' + V[u].slots.length + ' stacks, ' + V[u].extras.length + ' extras' + (isFighter(u) ? ' (fighting now)' : ' (waiting for them to log in)')))
      return 1
    })))
    .then(Commands.literal('restore').requires(op).then(word('player', () => Object.keys(db().vaults).map(u => db().vaults[u].name)).executes(safe(restoreCmd))))
    .then(Commands.literal('history').requires(op).executes(safe(ctx => {
      const H = db().history
      if (!H.length) return reply(ctx, 'No Purge has been held yet.')
      H.forEach(h => reply(ctx, new Date(h.started).toISOString().slice(0, 16).replace('T', ' ') + ' ' + (MODES[h.mode] ? MODES[h.mode].name : h.mode) +
        (h.kit ? ' (' + h.kit + ')' : '') + ', ' + h.minutes + ' min, ' + h.fighters + ' fighters: ' + (h.winner ? h.winner + ' won (' + signed(h.score) + ')' : 'no winner') + (h.reason == 'stopped' ? ', stopped early' : '')))
      return 1
    })))
    .then(Commands.literal('arena')
      .executes(safe(arenaShow))
      .then(Commands.literal('set').requires(op)
        .executes(safe(ctx => arenaSet(ctx, ARENA_RADIUS)))
        .then(Commands.argument('radius', Arguments.INTEGER.create(event)).executes(safe(ctx => arenaSet(ctx, Number(Arguments.INTEGER.getResult(ctx, 'radius')))))))
      .then(Commands.literal('clear').requires(op).executes(safe(ctx => {
        db().arena = null
        save()
        return reply(ctx, 'Arena cleared. Fighters now fight where they stand' + (db().cur ? ' (anyone already in the arena is still brought back at the end).' : '.'))
      }))))
    .then(Commands.literal('tithe').requires(op).executes(safe(ctx => {
      const D = db()
      return reply(ctx, 'The Tithe (secret): ' + fmt(D.tithe) + ' in all. ' + Object.keys(D.titheBy).map(k => k + ' ' + fmt(D.titheBy[k])).join(', '))
    }))))
})

// ===================== API =====================

global.Purge = {
  start: (mode, minutes, kit, opts) => start(Utils.server, mode, minutes, kit, opts),   // '' when under way, else why not
  busy: () => busy(),                                // why a Purge can't start now ('' if it can)
  pending: () => (db().pending ? JSON.parse(JSON.stringify(db().pending)) : null),
  lastEnded: () => lastEnded(),
  maxMinutes: MAX_MINUTES,
  stop: reason => { if (!callOff(Utils.server)) finish(Utils.server, reason || 'stopped') },   // a countdown is called off
  active: () => !!db().cur,
  mode: () => (db().cur ? db().cur.mode : ''),
  kitActive: () => kitMode(),
  arena: () => (arena() ? JSON.parse(JSON.stringify(arena())) : null),
  isFighter: player => isFighter(uuidOf(player)),
  blocksCommand: (player, cmd) => blocksCommand(player, cmd),
  ledger: () => (db().cur ? JSON.parse(JSON.stringify(db().cur.ledger)) : {}),
  tithed: () => db().tithe,
  addTithe: (n, source) => addTithe(n, source),
  modes: MODES,
  kits: KITS,
}

})()
