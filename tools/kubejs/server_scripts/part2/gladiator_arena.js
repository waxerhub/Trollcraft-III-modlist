// priority: 100
// (Loads before the other scripts, so its death handler cancels a knockout before any of theirs sees it: an arena
// knockout is no kill for Blood Harvest, bounties, Grit, Souls and the rest.)
// The Gladiator Arena: PvP matches in an arena that's built in the sky, far from spawn, for the match, and taken down
// after it.
//
// Starting one: right-click the arena statue at spawn (an armour stand in a heroic pose under a floating title, put up
// by an op with /gladiator tile set where they stand). A window asks who
// fights (any online players, two or more), how many rounds (1-9), how many lives each fighter has per round (1-10),
// and the gear: everyone's own, or one of the preset kits (each fighter's belongings are then held safely and handed
// back at the end). Everyone chosen gets the challenge in chat with [Accept] and [Decline]. The match starts only
// once all of them accept, within INVITE_SECONDS.
//
// The match: the arena (165 x 67 x 165) is placed piece by piece from kubejs/data/trollcraft/structures/
// gladiator_arena/, high over the site (DEFAULT_SITE or one an op set), and the fighters are taken there.
//   - A round: every fighter has the chosen lives. Lethal damage is a knockout, not a death: healed and back at a
//     spawn point away from the others (a fresh kit in a kit match). Losing the last life puts a fighter out of the
//     round, onto the wall to watch. The last one standing wins the round.
//   - Leaving the arena (falling off, an ender pearl, /home) counts as a knockout.
//   - The match: whoever wins the most rounds wins. It ends early once nobody can catch up; a tie for the lead is
//     settled by a deciding round between those tied. A round still undecided after ROUND_MINUTES goes to whoever
//     has the most lives left.
//   - At the end everyone is taken back to spawn and the arena is taken down.
// Nobody dies, so nothing drops. Hits from or to anyone not fighting in the current round are cancelled, and the
// arena's blocks can't be broken, built on or blown up. A Purge and a match can't run at the same time.
// Part II only. Copy to <server>/kubejs/server_scripts/part2/ and the structure pieces to <server>/kubejs/data/trollcraft/structures/
// gladiator_arena/, then /reload. See tools/kubejs/GLADIATOR_ARENA.md.
// KubeJS 6 (Rhino): no template strings; `let` inside nested blocks; event.cancel() last.

(function () {

// ===================== SETTINGS =====================

// The arena, from tools/schematic/schem_to_structures.js: the pieces are STRUCTURE/p_<i>_<k> (i along x, k along z),
// each PIECE wide and the full height, placed at corner + (i * PIECE, 0, k * PIECE).
const STRUCTURE = 'trollcraft:gladiator_arena'
const SIZE = [165, 67, 165], PIECE = 33
const CENTRE = [82, 82]                  // the middle, as an offset from the corner
// Standing spots (feet), as offsets from the corner: SPAWNS on the floor, STANDS on top of the wall.
const SPAWNS = [[37, 4, 75], [44, 12, 56], [56, 5, 44], [73, 5, 37], [91, 5, 37], [108, 5, 44], [120, 8, 56], [127, 8, 73],
  [126, 7, 90], [120, 7, 108], [108, 8, 120], [91, 6, 127], [73, 6, 127], [56, 4, 120], [44, 5, 108], [37, 5, 92]]
const STANDS = [[11, 15, 51], [51, 15, 11], [113, 15, 11], [153, 15, 51], [153, 15, 113], [113, 15, 153], [51, 15, 153], [11, 15, 113]]
const RING_RADIUS = 84                   // a fighter further than this from the middle (or below the arena) is rung out
const FLOOR_RADIUS = 70                  // inside this a fighter who's out is on the floor: they're sent back up the wall
// Where the arena goes: its middle (x, z) and its bottom (y), in the sky, far from spawn. /gladiator site here moves it.
const DEFAULT_SITE = { dim: 'minecraft:overworld', x: 8000, y: 230, z: 8000 }
const PIECES_PER_STEP = 1, STEP_TICKS = 2   // building: a piece every 2 ticks (about 3 seconds for the 25)
const CLEAR_SLAB = 23                    // taking it down: fills of 33 x 23 x 33 blocks (fill's limit is 32,768): 75 of them
const FILLS_PER_STEP = 3
const LOAD_WAIT_SECONDS = 90             // how long to wait for the site's chunks to load (or generate) before giving up
const HOME_RADIUS = 4                    // fighters go back to world spawn, within this many blocks

const ROUNDS = { min: 1, max: 9, def: 3 }
const LIVES = { min: 1, max: 10, def: 3 }
const INVITE_SECONDS = 60
const COUNTDOWN_SECONDS = 5              // before each round: nobody can be hurt
const BETWEEN_SECONDS = 6                // after each round
const ROUND_MINUTES = 10                 // then the most lives left wins the round (a tie: nobody wins it)
const MAX_DECIDERS = 3                   // deciding rounds before a tie is called a draw
const RESPAWN_RESISTANCE_SECONDS = 3
const LAST_HIT_SECONDS = 10              // a ring-out or a fall this soon after a hit counts as that fighter's knockout
const STRIP_SECONDS = 10                 // how often everyone not in a kit match is checked for arena kit items
const TAG = 'gladiator'                  // a vanilla tag on the fighters while the match is on
const BOSSBAR = 'trollcraft:gladiator'
const HISTORY = 20
const DATA_KEY = 'gladiator_arena'
const VAULT_DIR = 'kubejs/gladiator_vaults/'

// The kits, the same for everyone. items: [id, count, extra NBT (optional)]; armor: [head, chest, legs, feet];
// offhand: one item.
const KITS = {
  soldier: { name: 'Soldier', icon: 'minecraft:iron_sword', blurb: 'iron sword, shield, bow and 32 arrows, iron armour, 16 steak',
    items: [['minecraft:iron_sword', 1], ['minecraft:bow', 1], ['minecraft:arrow', 32], ['minecraft:cooked_beef', 16]],
    armor: ['minecraft:iron_helmet', 'minecraft:iron_chestplate', 'minecraft:iron_leggings', 'minecraft:iron_boots'],
    offhand: 'minecraft:shield' },
  peasant: { name: 'Peasant', icon: 'minecraft:wooden_sword', blurb: 'wooden sword, leather armour, 8 bread',
    items: [['minecraft:wooden_sword', 1], ['minecraft:bread', 8]],
    armor: ['minecraft:leather_helmet', 'minecraft:leather_chestplate', 'minecraft:leather_leggings', 'minecraft:leather_boots'] },
  archer: { name: 'Archer', icon: 'minecraft:bow', blurb: 'bow and 64 arrows, stone sword, chainmail, 16 steak',
    items: [['minecraft:bow', 1], ['minecraft:stone_sword', 1], ['minecraft:arrow', 64], ['minecraft:cooked_beef', 16]],
    armor: ['minecraft:chainmail_helmet', 'minecraft:chainmail_chestplate', 'minecraft:chainmail_leggings', 'minecraft:chainmail_boots'] },
  gladiator: { name: 'Gladiator', icon: 'minecraft:diamond_sword', blurb: 'diamond sword (Sharpness I) and axe, diamond armour, 4 golden apples, 16 steak',
    items: [['minecraft:diamond_sword', 1, 'Enchantments:[{id:"minecraft:sharpness",lvl:1s}]'], ['minecraft:diamond_axe', 1], ['minecraft:golden_apple', 4], ['minecraft:cooked_beef', 16]],
    armor: ['minecraft:diamond_helmet', 'minecraft:diamond_chestplate', 'minecraft:diamond_leggings', 'minecraft:diamond_boots'] },
}
// The modded kits (Part II's pack: Ice and Fire, Twilight Forest, Alex's Caves, Botania, Create Sabers).
const STEAK = ['minecraft:cooked_beef', 16]
function dragonslayer(kind, name) {
  return { name: name + ' Dragonslayer', icon: 'iceandfire:dragonsteel_' + kind + '_sword',
    blurb: kind + ' dragonsteel sword and armour, a dragonbone bow and 32 dragonbone arrows, 16 steak',
    items: [['iceandfire:dragonsteel_' + kind + '_sword', 1], ['iceandfire:dragonbone_bow', 1], ['iceandfire:dragonbone_arrow', 32], STEAK],
    armor: ['helmet', 'chestplate', 'leggings', 'boots'].map(s => 'iceandfire:dragonsteel_' + kind + '_' + s) }
}
KITS.troll = { name: 'Troll Smasher', icon: 'iceandfire:troll_weapon_hammer', blurb: 'a troll\'s war hammer (slow, huge knockback), mountain troll leather armour, 4 golden apples, 16 steak',
  items: [['iceandfire:troll_weapon_hammer', 1], ['minecraft:golden_apple', 4], STEAK],
  armor: ['helmet', 'chestplate', 'leggings', 'boots'].map(s => 'iceandfire:mountain_troll_leather_' + s) }
KITS.dragon_fire = dragonslayer('fire', 'Fire')
KITS.dragon_ice = dragonslayer('ice', 'Ice')
KITS.dragon_lightning = dragonslayer('lightning', 'Lightning')
KITS.twilight_knight = { name: 'Twilight Knight', icon: 'twilightforest:knightmetal_sword', blurb: 'knightmetal sword, armour and shield, the block and chain (a flail you throw), 16 steak',
  items: [['twilightforest:knightmetal_sword', 1], ['twilightforest:block_and_chain', 1], STEAK],
  armor: ['helmet', 'chestplate', 'leggings', 'boots'].map(s => 'twilightforest:knightmetal_' + s), offhand: 'twilightforest:knightmetal_shield' }
KITS.twilight_ranger = { name: 'Twilight Ranger', icon: 'twilightforest:triple_bow', blurb: 'triple, seeker (homing) and ice (slowing) bows, 64 arrows, an ironwood sword, steeleaf armour, 16 steak',
  items: [['twilightforest:triple_bow', 1], ['twilightforest:seeker_bow', 1], ['twilightforest:ice_bow', 1], ['twilightforest:ironwood_sword', 1], ['minecraft:arrow', 64], STEAK],
  armor: ['helmet', 'chestplate', 'leggings', 'boots'].map(s => 'twilightforest:steeleaf_' + s) }
KITS.myrmex = { name: 'Myrmex Venom', icon: 'iceandfire:myrmex_desert_sword_venom', blurb: 'a venom sword (poisons), a death worm gauntlet (pulls people in), desert myrmex armour, 16 steak',
  items: [['iceandfire:myrmex_desert_sword_venom', 1], ['iceandfire:deathworm_gauntlet_red', 1], STEAK],
  armor: ['helmet', 'chestplate', 'leggings', 'boots'].map(s => 'iceandfire:myrmex_desert_' + s) }
KITS.caveman = { name: 'Caveman', icon: 'alexscaves:primitive_club', blurb: 'a primitive club (stuns), two limestone spears to throw, primordial hides, 16 steak',
  items: [['alexscaves:primitive_club', 1], ['alexscaves:limestone_spear', 1], ['alexscaves:limestone_spear', 1], STEAK],
  armor: ['alexscaves:primordial_helmet', 'alexscaves:primordial_tunic', 'alexscaves:primordial_pants', 'minecraft:leather_boots'] }
KITS.terra = { name: 'Terra Knight', icon: 'botania:terra_sword', blurb: 'the Terra Blade (swings fire a beam), terrasteel armour, 16 steak',
  items: [['botania:terra_sword', 1], STEAK],
  armor: ['helmet', 'chestplate', 'leggings', 'boots'].map(s => 'botania:terrasteel_' + s) }
KITS.saber = { name: 'Saber Duel', icon: 'create_sabers:double_brass_saber', blurb: 'a brass saber and a double-bladed one (right-click to light them), no armour, 16 steak',
  items: [['create_sabers:brass_saber', 1], ['create_sabers:double_brass_saber', 1], STEAK], armor: [] }
const KIT_ORDER = ['soldier', 'peasant', 'archer', 'gladiator', 'troll', 'dragon_fire', 'dragon_ice', 'dragon_lightning',
  'twilight_knight', 'twilight_ranger', 'myrmex', 'caveman', 'terra', 'saber']
const KIT_LORE = 'Arena issue. Taken back at the end.'
// The statue at spawn that opens the window. /gladiator tile set puts it where the op stands, facing their way: an
// armour stand in a heroic pose under a floating title, inside an invisible click box (an interaction entity).
const TILE_TAG = 'gladiator_tile'
const TITLE = [{ text: '⚔ THE GLADIATOR ARENA ⚔', color: 'gold', bold: true }, { text: '\nRight-click to fight', color: 'gray', bold: false }]
const TITLE_HEIGHT = 2.5                 // the title's height above the statue's feet
const STATUE_POSE = '{Head:[-12f,0f,0f],Body:[0f,8f,0f],RightArm:[-165f,10f,10f],LeftArm:[-35f,-25f,-12f],RightLeg:[-8f,0f,4f],LeftLeg:[12f,0f,-4f]}'
const TRIM = 'Trim:{material:"minecraft:gold",pattern:"minecraft:rib"}'
const STATUE_ARMOR = ['minecraft:netherite_boots', 'minecraft:netherite_leggings', 'minecraft:netherite_chestplate', 'minecraft:netherite_helmet']
const STATUE_HANDS = ['{id:"minecraft:netherite_sword",Count:1b,tag:{Enchantments:[{id:"minecraft:sharpness",lvl:5s}]}}',
  '{id:"minecraft:shield",Count:1b,tag:{BlockEntityTag:{Base:14,Patterns:[{Pattern:"cr",Color:4}]}}}']

// ===================== STATE =====================

let Serializer = null, StringArg = null, ItemStackClass = null, ResourceLocation = null
try { Serializer = Java.loadClass('net.minecraft.network.chat.Component$Serializer') } catch (e) { }
try { StringArg = Java.loadClass('com.mojang.brigadier.arguments.StringArgumentType') } catch (e) { }
try { ItemStackClass = Java.loadClass('net.minecraft.world.item.ItemStack') } catch (e) { }
try { ResourceLocation = Java.loadClass('net.minecraft.resources.ResourceLocation') } catch (e) { }
let CuriosApi = null, BeltSlot = null
try { CuriosApi = Java.loadClass('top.theillusivec4.curios.api.CuriosApi') } catch (e) { }
try { BeltSlot = Java.loadClass('dev.gigaherz.toolbelt.slot.BeltExtensionSlot') } catch (e) { }
// drafts: uuid -> the window's choices. clickAt: the statue's last right-click per player. lastHit: victim -> the last
// fighter who hit them. The loop, build and take-down tokens are on global, so a /reload stops the old ones.
const S = { drafts: {}, clickAt: {}, lastHit: {}, said: {} }
let data = null
// D.tile: the block that opens the window. D.site: where the arena goes (null: DEFAULT_SITE). D.arena: { state:
// 'none' | 'building' | 'built' | 'clearing', site }. D.pending: a challenge waiting for answers. D.cur: the match.
// D.vaults: uuid -> a fighter's belongings in a kit match. D.owed: uuid -> true for fighters to take home when they
// next log in.
function db() {
  if (data) return data
  data = { tile: null, site: null, arena: { state: 'none', site: null }, pending: null, cur: null, vaults: {}, owed: {}, seq: 0, history: [] }
  let raw = ''
  try { raw = String(Utils.server.persistentData.getString(DATA_KEY) || '') } catch (e) { }
  if (raw) {
    try {
      let d = JSON.parse(raw)
      if (d && d.arena && d.vaults) data = d
    } catch (e) {
      console.error('[Gladiator] Saved data could not be read; a copy is kept')
      try { Utils.server.persistentData.putString(DATA_KEY + '_unreadable_' + Date.now(), raw) } catch (e2) { }
    }
  }
  if (!data.owed) data.owed = {}
  if (!data.earned) data.earned = {}                 // uuid -> advancements earned in a match, revoked at home
  return data
}
function save() {
  try { Utils.server.persistentData.putString(DATA_KEY, JSON.stringify(db())); return true } catch (e) {
    console.error('[Gladiator] Save failed: ' + e)
    return false
  }
}

// ===================== HELPERS =====================

function snbtString(s) { return "'" + String(s).replace(/\\/g, '\\\\').replace(/'/g, "\\'") + "'" }
function comp(parts) {
  const json = JSON.stringify([''].concat(parts))
  if (Serializer) { try { return Serializer.fromJsonLenient(json) } catch (e) { } }
  return Text.of(parts.map(p => (typeof p == 'string' ? p : p.text || '')).join(''))
}
function nameOf(p) { return String(p.getGameProfile().getName()) }
function uuidOf(e) {
  try { return String(e.getStringUuid()).toLowerCase() } catch (err) { }
  return String(e.getStringUUID()).toLowerCase()
}
function isPlayer(e) { try { return !!e && e.isPlayer() } catch (err) { return false } }
function levelOfEntity(e) { const l = e.level; return typeof l == 'function' ? e.level() : l }
function dimKey(lv) {
  let d = lv.dimension
  if (typeof d == 'function') d = lv.dimension()
  if (d != null && typeof d.location == 'function') d = d.location()
  return String(d)
}
function dimOf(e) { return dimKey(levelOfEntity(e)) }
function pos(e) {
  try { return { x: Number(e.getX()), y: Number(e.getY()), z: Number(e.getZ()) } } catch (err) { }
  return { x: Number(e.x), y: Number(e.y), z: Number(e.z) }
}
function list(javaList) { const out = []; for (let i = 0; i < javaList.size(); i++) out.push(javaList.get(i)); return out }
function num(n) { return (Math.round(n * 100) / 100).toFixed(2) }
function run(server, c) { try { return server.runCommandSilent(c) } catch (e) { console.warn('[Gladiator] ' + c + ': ' + e); return 0 } }
function voice(text, color) { return [{ text: '[ARENA] ', color: 'gold', bold: true }, { text: text, color: color || 'yellow' }] }
function tell(p, text, color) { try { p.tell(comp(voice(text, color))) } catch (e) { } }
function tellParts(p, parts) { try { p.tell(comp(voice('', 'yellow').slice(0, 1).concat(parts))) } catch (e) { } }
// Everyone online (player.tell to each: never tellraw @a, which Simple Discord Link relays).
function tellAll(server, text, color) { list(server.players).forEach(p => tell(p, text, color)) }
function players(server) { return list(server.players) }
function playerByUuid(server, u) { return players(server).filter(p => uuidOf(p) == u)[0] || null }
function playerByName(server, n) { return players(server).filter(p => nameOf(p).toLowerCase() == String(n).toLowerCase())[0] || null }
function bool(fn) { try { return !!fn() } catch (e) { return false } }
function sameEntity(a, b) { if (!a || !b) return false; try { return uuidOf(a) == uuidOf(b) } catch (e) { return a === b } }
function attackerOf(source) {
  try { return typeof source.getActual == 'function' ? source.getActual() : source.getEntity() } catch (e) { return null }
}
function damageType(source) {
  try { return String(typeof source.getMsgId == 'function' ? source.getMsgId() : source.getType()) } catch (e) { return '' }
}
function names(arr) {
  if (arr.length <= 1) return arr.join('')
  return arr.slice(0, -1).join(', ') + ' and ' + arr[arr.length - 1]
}
function plural(n, word) { return n + ' ' + word + (n == 1 ? '' : 's') }
function livesText(n) { return n + (n == 1 ? ' life' : ' lives') }
function gearName(g) { return g == 'own' ? 'their own gear' : 'the ' + KITS[g].name + ' kit' }
function purgeBusy() {
  try { return global.Purge && typeof global.Purge.busy == 'function' ? String(global.Purge.busy() || '') : '' } catch (e) { return '' }
}

// ===================== THE SITE AND THE ARENA'S BLOCKS =====================

function siteNow() { return db().site || DEFAULT_SITE }
function corner(st) { return { dim: st.dim, x: st.x - CENTRE[0], y: st.y, z: st.z - CENTRE[1] } }
function centreOf(st) { return { x: st.x + 0.5, y: st.y, z: st.z + 0.5 } }
function sameSite(a, b) { return !!a && !!b && a.dim == b.dim && a.x == b.x && a.y == b.y && a.z == b.z }
function levelByDim(server, dim) {
  try {
    let it = server.getAllLevels().iterator()
    while (it.hasNext()) {
      let lv = it.next()
      if (dimKey(lv) == dim) return lv
    }
  } catch (e) { }
  try { if (dim == 'minecraft:overworld') return server.overworld() } catch (e) { }
  return null
}
function forceload(server, st, add) {
  const c = corner(st)
  run(server, 'execute in ' + st.dim + ' run forceload ' + (add ? 'add ' : 'remove ') + c.x + ' ' + c.z + ' ' + (c.x + SIZE[0] - 1) + ' ' + (c.z + SIZE[2] - 1))
}
// Whether every chunk under the arena is loaded.
function chunksReady(lv, c) {
  for (let cx = Math.floor(c.x / 16); cx <= Math.floor((c.x + SIZE[0] - 1) / 16); cx++) {
    for (let cz = Math.floor(c.z / 16); cz <= Math.floor((c.z + SIZE[2] - 1) / 16); cz++) {
      let loaded = false
      try { loaded = !!lv.hasChunk(cx, cz) } catch (e) { }
      if (!loaded) return false
    }
  }
  return true
}
// Something already in the arena's space (a sample every few blocks), or ''.
function obstruction(lv, c) {
  for (let x = 0; x < SIZE[0]; x += 8) for (let z = 0; z < SIZE[2]; z += 8) for (let y = 0; y < SIZE[1]; y += 6) {
    let id = String(lv.getBlock(c.x + x, c.y + y, c.z + z).id)
    if (!/air$/.test(id)) return id + ' at ' + (c.x + x) + ' ' + (c.y + y) + ' ' + (c.z + z)
  }
  return ''
}
// Whether the pieces are installed (kubejs/data/trollcraft/structures/gladiator_arena/). Unknown counts as yes.
function piecesInstalled(server) {
  try { return !!server.getStructureManager().get(new ResourceLocation(STRUCTURE + '/p_0_0')).isPresent() } catch (e) { return true }
}
function insideBox(st, d, q) {
  if (!st || d != st.dim) return false
  const c = corner(st)
  return q.x >= c.x && q.x < c.x + SIZE[0] && q.z >= c.z && q.z < c.z + SIZE[2] && q.y >= c.y - 1 && q.y < c.y + SIZE[1] + 2
}
function arenaUp() { const A = db().arena; return A.state != 'none' && A.site ? A.site : null }

// Builds the arena over the site, a piece at a time, once its chunks are loaded. done(ok, why).
function buildArena(server, done) {
  const A = db().arena, st = siteNow()
  if (A.state == 'built' && sameSite(A.site, st)) { done(true, ''); return }
  if (A.state == 'built' || A.state == 'clearing') { done(false, 'the last arena is still being taken down'); return }
  const ours = A.state == 'building' && sameSite(A.site, st)   // a build cut short by /reload: our own blocks
  const lv = levelByDim(server, st.dim)
  if (!lv) { done(false, 'there is no dimension ' + st.dim); return }
  if (!piecesInstalled(server)) { done(false, 'its structure files are missing (kubejs/data/trollcraft/structures/gladiator_arena/)'); return }
  A.state = 'building'
  A.site = st
  save()
  forceload(server, st, true)
  const c = corner(st), pieces = []
  for (let i = 0; i < Math.ceil(SIZE[0] / PIECE); i++) for (let k = 0; k < Math.ceil(SIZE[2] / PIECE); k++) pieces.push([i, k])
  const token = (global.__gladiatorBuild = (global.__gladiatorBuild || 0) + 1)   // one build, even across /reload
  let idx = 0, waited = 0, checked = ours
  const fail = why => {
    console.error('[Gladiator] The arena could not be built: ' + why)
    if (idx > 0) clearArena(server, null)             // take down the pieces already placed
    else { A.state = 'none'; A.site = null; save(); forceload(server, st, false) }
    done(false, why)
  }
  const step = () => {
    if (token != global.__gladiatorBuild || db().arena.state != 'building') return
    if (!chunksReady(lv, c)) {
      waited += STEP_TICKS
      if (waited > LOAD_WAIT_SECONDS * 20) { fail('its chunks did not load within ' + LOAD_WAIT_SECONDS + ' seconds'); return }
      server.scheduleInTicks(STEP_TICKS, step)
      return
    }
    if (!checked) {
      checked = true
      let what = ''
      try { what = obstruction(lv, c) } catch (e) { }
      if (what) { fail('something is already there (' + what + '). An op can move the site with /gladiator site here'); return }
    }
    for (let n = 0; n < PIECES_PER_STEP && idx < pieces.length; n++) {
      let pc = pieces[idx]
      let ok = run(server, 'execute in ' + st.dim + ' run place template ' + STRUCTURE + '/p_' + pc[0] + '_' + pc[1] + ' ' +
        (c.x + pc[0] * PIECE) + ' ' + c.y + ' ' + (c.z + pc[1] * PIECE))
      if (!ok) { fail('piece p_' + pc[0] + '_' + pc[1] + ' could not be placed'); return }
      idx++
    }
    if (idx < pieces.length) { server.scheduleInTicks(STEP_TICKS, step); return }
    db().arena.state = 'built'
    save()
    console.info('[Gladiator] Arena built at ' + st.dim + ' ' + st.x + ' ' + st.y + ' ' + st.z)
    done(true, '')
  }
  server.scheduleInTicks(1, step)
}
// Takes the arena down: anyone still in it goes to spawn, loose items and arrows go, then fills of air. done() after.
function clearArena(server, done) {
  const A = db().arena
  if (A.state == 'none' || !A.site) { if (done) done(); return }
  A.state = 'clearing'
  save()
  global.__gladiatorBuild = (global.__gladiatorBuild || 0) + 1   // a build still running stops
  const st = A.site, c = corner(st), lv = levelByDim(server, st.dim)
  forceload(server, st, true)
  const fills = []
  for (let i = 0; i < Math.ceil(SIZE[0] / PIECE); i++) for (let k = 0; k < Math.ceil(SIZE[2] / PIECE); k++) {
    for (let y0 = 0; y0 < SIZE[1]; y0 += CLEAR_SLAB) {
      fills.push([c.x + i * PIECE, c.y + y0, c.z + k * PIECE, Math.min(c.x + SIZE[0], c.x + (i + 1) * PIECE) - 1,
        Math.min(c.y + SIZE[1], c.y + y0 + CLEAR_SLAB) - 1, Math.min(c.z + SIZE[2], c.z + (k + 1) * PIECE) - 1])
    }
  }
  const token = (global.__gladiatorClear = (global.__gladiatorClear || 0) + 1)
  let idx = 0, waited = 0, swept = false
  const step = () => {
    if (token != global.__gladiatorClear || db().arena.state != 'clearing') return
    if (lv && !chunksReady(lv, c)) {
      waited += STEP_TICKS
      if (waited > LOAD_WAIT_SECONDS * 20) { console.error('[Gladiator] The arena\'s chunks did not load; it is taken down at the next start'); return }
      server.scheduleInTicks(STEP_TICKS, step)
      return
    }
    if (!swept) {
      swept = true
      players(server).forEach(p => { if (insideBox(st, dimOf(p), pos(p))) { goHome(server, p); tell(p, 'The arena is coming down. Back to spawn.', 'gray') } })
      sweep(server, st)
    }
    for (let n = 0; n < FILLS_PER_STEP && idx < fills.length; n++) {
      let f = fills[idx]
      run(server, 'execute in ' + st.dim + ' run fill ' + f.join(' ') + ' minecraft:air')
      idx++
    }
    if (idx < fills.length) { server.scheduleInTicks(STEP_TICKS, step); return }
    sweep(server, st)
    forceload(server, st, false)
    A.state = 'none'
    A.site = null
    save()
    console.info('[Gladiator] Arena taken down')
    if (done) done()
  }
  server.scheduleInTicks(1, step)
}
// Whatever's left lying in the arena's space: items, experience, arrows, and anything else that isn't a creature or a
// player (thrown spears and tridents, the block and chain, mods' projectiles), which would hang in the sky otherwise.
function sweep(server, st) {
  const c = corner(st)
  const box = 'x=' + c.x + ',y=' + (c.y - 2) + ',z=' + c.z + ',dx=' + (SIZE[0] - 1) + ',dy=' + (SIZE[1] + 3) + ',dz=' + (SIZE[2] - 1)
  // A corpse (Corpse mod: a fighter /kill'ed in an own-gear match) holds their real things: it goes to spawn, not away.
  let sx = 0, sy = 64, sz = 0
  try { let sp = server.overworld().getSharedSpawnPos(); sx = Number(sp.getX()); sy = Number(sp.getY()); sz = Number(sp.getZ()) } catch (e) { }
  run(server, 'execute in ' + st.dim + ' run tp @e[type=corpse:corpse,' + box + '] ' + sx + ' ' + (sy + 1) + ' ' + sz)
  const types = ['minecraft:item', 'minecraft:experience_orb', '#minecraft:arrows', 'minecraft:trident']
  types.forEach(t => run(server, 'execute in ' + st.dim + ' run kill @e[type=' + t + ',' + box + ']'))
  let all = []
  try { all = list(server.entities) } catch (e) { return }
  all.forEach(e => {
    if (isPlayer(e) || bool(() => e.isLiving())) return
    let type = ''
    try { type = String(e.getEncodeId()) } catch (err) { }
    if (type == 'corpse:corpse') return
    if (!insideBox(st, dimOf(e), pos(e))) return
    try { e.discard() } catch (err) { try { e.kill() } catch (err2) { } }
  })
}

// ===================== MOVING PEOPLE =====================

function worldPoint(st, off) { const c = corner(st); return { x: c.x + off[0] + 0.5, y: c.y + off[1], z: c.z + off[2] + 0.5 } }
// The yaw that faces the arena's middle from (x, z).
function yawToCentre(st, q) {
  const m = centreOf(st)
  return Math.round(Math.atan2(-(m.x - q.x), m.z - q.z) * 180 / 3.14159265)
}
function tpTo(server, p, st, q) {
  run(server, 'execute in ' + st.dim + ' run tp ' + nameOf(p) + ' ' + num(q.x) + ' ' + num(q.y) + ' ' + num(q.z) + ' ' + yawToCentre(st, q) + ' 0')
  try { p.fallDistance = 0 } catch (e) { }
}
function freshen(server, p) {
  const n = nameOf(p)
  try { p.setHealth(p.getMaxHealth()) } catch (e) { try { p.health = 20 } catch (e2) { } }
  try { p.clearFire() } catch (e) { }
  try { p.fallDistance = 0 } catch (e) { }
  run(server, 'effect clear ' + n)
  run(server, 'effect give ' + n + ' minecraft:saturation 1 20 true')
}
// Back to world spawn (in the overworld, on solid ground near the spawn point).
function goHome(server, p) {
  let x = 0, z = 0
  try {
    let sp = server.overworld().getSharedSpawnPos()
    x = Number(sp.getX())
    z = Number(sp.getZ())
  } catch (e) { }
  run(server, 'execute in minecraft:overworld run spreadplayers ' + x + ' ' + z + ' 0 ' + HOME_RADIUS + ' false ' + nameOf(p))
  try { p.fallDistance = 0 } catch (e) { }
}
// A spawn point away from the other fighters in the round (the one furthest from the nearest of them).
function respawnPoint(server, st, u) {
  const C = db().cur, others = []
  Object.keys(C.fighters).forEach(v => {
    if (v == u || !active(v)) return
    let q = playerByUuid(server, v)
    if (q) others.push(pos(q))
  })
  let best = SPAWNS[Math.floor(Math.random() * SPAWNS.length)], bestD = -1
  SPAWNS.forEach(s => {
    const w = worldPoint(st, s)
    let d = Infinity
    others.forEach(o => { d = Math.min(d, (o.x - w.x) * (o.x - w.x) + (o.z - w.z) * (o.z - w.z)) })
    if (d > bestD) { bestD = d; best = s }
  })
  return worldPoint(st, best)
}
function standPoint(st, n) { return worldPoint(st, STANDS[((n % STANDS.length) + STANDS.length) % STANDS.length]) }

// ===================== KITS AND THE VAULT =====================
// As in part2/purge.js: a kit match holds each fighter's belongings (all 41 slots, saved whole with serializeNBT so
// items that keep their contents in a Forge capability come back full), checks every stack rebuilds before anything
// is cleared, keeps a backup file, and hands them back at the end (or at the next login).

function emptyStack() { try { return Item.empty } catch (e) { return Item.of('minecraft:air') } }
function stackNbt(s) { try { return s.nbt != null ? String(s.nbt) : '' } catch (e) { return '' } }
function stackFull(s) { try { return String(s.serializeNBT()) } catch (e) { return '' } }
function savedStack(s, slot) { return { id: String(s.id), count: Number(s.count), nbt: stackNbt(s), full: stackFull(s), slot: slot } }
function rebuild(r) {
  if (!r.full) return Item.of(r.id, r.count, r.nbt || null)
  if (!ItemStackClass || typeof NBT == 'undefined') throw new Error('ItemStack.of is not available')
  const st = ItemStackClass.of(NBT.toTagCompound(r.full))
  if (!st || st.isEmpty()) throw new Error('unknown item ' + r.id)
  return st
}
function rebuilds(r) {
  if (!r.full) return false
  try {
    let st = rebuild(r)
    if (String(st.id) != r.id || Number(st.count) != r.count) return false
    return !/ForgeCaps/.test(r.full) || /ForgeCaps/.test(stackFull(st))
  } catch (e) {
    console.error('[Gladiator] Can\'t rebuild ' + r.id + ': ' + e)
    return false
  }
}
function invSize(p) { try { return Number(p.inventory.getContainerSize()) } catch (e) { return 41 } }
function clearInventory(p) {
  try { p.inventory.clearContent(); return } catch (e) { }
  const n = invSize(p)
  for (let i = 0; i < n; i++) { try { p.inventory.setItem(i, emptyStack()) } catch (e) { } }
}
function isKitItem(s) {
  try { let t = s.nbt; return t != null && !!t.contains('GladiatorKit') } catch (e) { }   // cheap: no NBT to string
  return /GladiatorKit:1b/.test(stackNbt(s))
}
// The player's worn curios (Curios API) as an item handler: getSlots, getStackInSlot, setStackInSlot. null without.
function curiosOf(p) {
  if (!CuriosApi) return null
  try {
    let opt = CuriosApi.getCuriosInventory(p).resolve()
    if (opt.isPresent()) return opt.get().getEquippedCurios()
  } catch (e) { }
  try {
    let opt2 = CuriosApi.getCuriosHelper().getEquippedCurios(p).resolve()
    if (opt2.isPresent()) return opt2.get()
  } catch (e) { }
  return null
}
// Tool Belt's own belt slot (separate from Curios): getContents / setContents, or null without the mod.
function beltSlotOf(p) {
  if (!BeltSlot) return null
  try {
    let opt = BeltSlot.get(p).resolve()
    if (opt.isPresent()) return opt.get().getBelt()
  } catch (e) { }
  return null
}
// Kit items can't leave the arena. Anyone not in a kit match loses any they carry: inventory, curios, ender chest.
// (A kit item only gets out by a route nothing else closes; this catches it as soon as it shows up.) Returns how many.
function stripKit(p) {
  let n = 0
  const take = (get, set, size) => {
    for (let i = 0; i < size; i++) {
      let s = get(i)
      if (s && !s.isEmpty() && isKitItem(s)) { set(i, emptyStack()); n++ }
    }
  }
  try { take(i => p.inventory.getItem(i), (i, s) => p.inventory.setItem(i, s), invSize(p)) } catch (e) { }
  const cur = curiosOf(p)
  if (cur) { try { take(i => cur.getStackInSlot(i), (i, s) => cur.setStackInSlot(i, s), Number(cur.getSlots())) } catch (e) { } }
  try {
    let ec = p.getEnderChestInventory()
    take(i => ec.getItem(i), (i, s) => ec.setItem(i, s), Number(ec.getContainerSize()))
  } catch (e) { }
  return n
}
function inKitMatch(u) { const C = db().cur; return inMatch(u) && C.gear != 'own' }
function stripAll(server) {
  players(server).forEach(p => {
    const u = uuidOf(p)
    if (inKitMatch(u)) return
    const n = stripKit(p)
    if (!n) return
    tell(p, 'Arena kit can\'t leave the arena: ' + plural(n, 'item') + ' taken back.', 'gray')
    console.warn('[Gladiator] Took ' + n + ' arena kit items from ' + nameOf(p))
  })
}
function kitSnbt(extra) { return '{GladiatorKit:1b,' + (extra ? extra + ',' : '') + 'display:{Lore:[' + snbtString(JSON.stringify({ text: KIT_LORE, color: 'dark_gray', italic: false })) + ']}}' }
function giveKit(p, kitId) {
  const K = KITS[kitId], nbt = kitSnbt('')
  clearInventory(p)
  K.items.forEach((it, i) => { p.inventory.setItem(i, Item.of(it[0], it[1], it[2] ? kitSnbt(it[2]) : nbt)) })
  K.armor.forEach((id, i) => { p.inventory.setItem(39 - i, Item.of(id, 1, nbt)) })   // 39 head .. 36 feet
  if (K.offhand) p.inventory.setItem(40, Item.of(K.offhand, 1, nbt))
}
function backup(rec) {
  const file = rec.name + '_' + rec.uuid + '.json'
  try { JsonIO.write(VAULT_DIR + file, rec) } catch (e) {
    try { JsonIO.write('kubejs/gladiator_vault_' + file, rec) } catch (e2) { console.warn('[Gladiator] Backup file for ' + rec.name + ': ' + e2) }
  }
}
// Holds a fighter's belongings: the inventory, the worn curios and Tool Belt's belt slot (a belt, a backpack or a
// wireless terminal worn there could otherwise hide kit gear). Returns '' or why it couldn't (then nothing was touched).
function vault(p) {
  const D = db(), u = uuidOf(p)
  if (D.vaults[u]) return 'they still have belongings held from an earlier match'
  const slots = [], worn = [], n = invSize(p), cur = curiosOf(p), beltSlot = beltSlotOf(p)
  let belt = null
  if (beltSlot) {
    let b = beltSlot.getContents()
    if (b && !b.isEmpty() && !isKitItem(b)) belt = savedStack(b, 0)
  }
  for (let i = 0; i < n; i++) {
    let s = p.inventory.getItem(i)
    if (s && !s.isEmpty() && !isKitItem(s)) slots.push(savedStack(s, i))
  }
  if (cur) {
    for (let i = 0; i < Number(cur.getSlots()); i++) {
      let s = cur.getStackInSlot(i)
      if (s && !s.isEmpty() && !isKitItem(s)) worn.push(savedStack(s, i))
    }
  }
  const bad = slots.concat(worn).concat(belt ? [belt] : []).filter(s => !rebuilds(s))
  if (bad.length) return bad.length + ' of their items (' + bad[0].id + ') could not be stored safely'
  const rec = { name: nameOf(p), uuid: u, t: Date.now(), match: D.cur ? D.cur.id : 0, slots: slots, curios: worn, belt: belt }
  D.vaults[u] = rec
  if (!save()) { delete D.vaults[u]; return 'their belongings could not be saved' }
  backup(rec)
  clearInventory(p)
  worn.forEach(r => { try { cur.setStackInSlot(r.slot, emptyStack()) } catch (e) { } })
  if (belt) { try { beltSlot.setContents(emptyStack()) } catch (e) { } }
  return ''
}
// Hands belongings back: clears the inventory (kit), then every slot. What can't be rebuilt stays in the vault.
function unvault(server, p) {
  const D = db(), u = uuidOf(p), V = D.vaults[u]
  if (!V) return true
  if (!V.partial) clearInventory(p)
  const bad = [], badWorn = [], cur = curiosOf(p)
  V.slots.forEach(s => {
    try {
      if (V.partial) p.give(rebuild(s))
      else p.inventory.setItem(s.slot, rebuild(s))
    } catch (e) { bad.push(s); console.error('[Gladiator] ' + V.name + ' slot ' + s.slot + ' (' + s.id + '): ' + e) }
  })
  ;(V.curios || []).forEach(s => {
    try {
      let st = rebuild(s)
      if (cur && !V.partial && cur.getStackInSlot(s.slot).isEmpty()) cur.setStackInSlot(s.slot, st)
      else p.give(st)                                 // no curio slot free (or no Curios): into the inventory
    } catch (e) { badWorn.push(s); console.error('[Gladiator] ' + V.name + ' curio ' + s.slot + ' (' + s.id + '): ' + e) }
  })
  if (V.belt) {
    try {
      let st = rebuild(V.belt), bs = beltSlotOf(p)
      if (bs && !V.partial && bs.getContents().isEmpty()) bs.setContents(st)
      else p.give(st)
    } catch (e) { badWorn.push(V.belt); console.error('[Gladiator] ' + V.name + ' belt slot (' + V.belt.id + '): ' + e) }
    V.belt = null
  }
  if (bad.length || badWorn.length) {
    V.curios = badWorn
    V.slots = bad
    V.partial = true
    save()
    backup(V)
    players(server).forEach(o => { if (bool(() => o.hasPermissions(2))) tell(o, (bad.length + badWorn.length) + ' of ' + V.name + '\'s items could not be handed back. They are kept in ' + VAULT_DIR + '.', 'red') })
    return false
  }
  V.restored = Date.now()
  backup(V)
  delete D.vaults[u]
  save()
  tell(p, 'Your belongings are back.', 'gold')
  return true
}

// ===================== THE CHALLENGE =====================

function draftOf(p) {
  const u = uuidOf(p)
  if (!S.drafts[u]) { S.drafts[u] = { picked: {}, rounds: ROUNDS.def, lives: LIVES.def, gear: 'own' }; S.drafts[u].picked[u] = nameOf(p) }
  return S.drafts[u]
}
// Why no challenge can be made now, or ''.
function busyWhy() {
  const D = db()
  if (D.cur) return 'A match is already on (' + names(Object.keys(D.cur.fighters).map(u => D.cur.fighters[u].name)) + ').'
  if (D.pending) return 'A challenge is already waiting for answers.'
  if (D.arena.state == 'building' || D.arena.state == 'clearing') return 'The arena is still being ' + (D.arena.state == 'building' ? 'built' : 'taken down') + '. Try again in a moment.'
  const pb = purgeBusy()
  if (pb) return 'A Purge is on. No arena matches until it ends.'
  return ''
}
// Sends the challenge from a draft. Returns '' or why not.
function challenge(server, p, draft) {
  const why = busyWhy()
  if (why) return why
  const picked = Object.keys(draft.picked).filter(u => playerByUuid(server, u))
  if (picked.length < 2) return 'Pick at least two fighters (who are online).'
  if (draft.gear != 'own' && !KITS[draft.gear]) return 'That kit doesn\'t exist.'
  const D = db(), id = ++D.seq, by = uuidOf(p)
  D.pending = { id: id, by: { uuid: by, name: nameOf(p) }, rounds: draft.rounds, lives: draft.lives, gear: draft.gear,
    expires: Date.now() + INVITE_SECONDS * 1000, fighters: {} }
  picked.forEach(u => { D.pending.fighters[u] = { name: nameOf(playerByUuid(server, u)), ok: u == by } })
  save()
  const who = picked.map(u => D.pending.fighters[u].name)
  const terms = plural(draft.rounds, 'round') + ', ' + livesText(draft.lives) + ' a round, ' + gearName(draft.gear)
  tellAll(server, nameOf(p) + ' calls ' + names(who.filter(n => n != nameOf(p))) + ' to the arena: ' + terms + '.', 'gold')
  picked.forEach(u => {
    if (u == by) return
    let q = playerByUuid(server, u)
    tellParts(q, [{ text: nameOf(p) + ' challenges you to the arena (' + terms + ', with ' + names(who.filter(n => n != D.pending.fighters[u].name)) + '). ', color: 'yellow' },
      { text: '[Accept]', color: 'green', bold: true, clickEvent: { action: 'run_command', value: '/gladiator accept ' + id }, hoverEvent: { action: 'show_text', contents: 'Fight' } },
      ' ',
      { text: '[Decline]', color: 'red', bold: true, clickEvent: { action: 'run_command', value: '/gladiator decline ' + id }, hoverEvent: { action: 'show_text', contents: 'Not this time' } },
      { text: ' (' + INVITE_SECONDS + ' s)', color: 'gray' }])
  })
  console.info('[Gladiator] Challenge ' + id + ' by ' + nameOf(p) + ': ' + who.join(', ') + '; ' + terms)
  return ''
}
function pendingNames(P) { return Object.keys(P.fighters).map(u => P.fighters[u].name) }
function tellPending(server, P, text, color) {
  const sent = {}
  Object.keys(P.fighters).concat([P.by.uuid]).forEach(u => {
    if (sent[u]) return
    sent[u] = true
    let q = playerByUuid(server, u)
    if (q) tell(q, text, color)
  })
}
function callOff(server, why) {
  const P = db().pending
  if (!P) return
  db().pending = null
  save()
  tellPending(server, P, 'The challenge is off: ' + why, 'red')
  console.info('[Gladiator] Challenge ' + P.id + ' called off: ' + why)
}
// An answer to the challenge. Returns what to tell the player.
function answer(server, p, id, yes) {
  const P = db().pending, u = uuidOf(p)
  if (!P || P.id != id) return 'That challenge isn\'t open any more.'
  const f = P.fighters[u]
  if (!f) return 'You weren\'t challenged.'
  if (!yes) { callOff(server, f.name + ' declined.'); return '' }
  if (f.ok) return 'You\'ve already accepted.'
  f.ok = true
  save()
  const all = Object.keys(P.fighters), done = all.filter(v => P.fighters[v].ok).length
  tellPending(server, P, f.name + ' accepts (' + done + ' of ' + all.length + ').', 'green')
  if (done == all.length) begin(server)
  return ''
}

// ===================== THE MATCH =====================

function active(u) {
  const C = db().cur, f = C && C.fighters[u]
  return !!f && !f.gone && !f.out && C.inRound.indexOf(u) >= 0
}
function isFighter(u) { const C = db().cur; return !!(C && C.fighters[u]) }
// In the match: a fighter who hasn't left it (a fighter who left is an ordinary player again).
function inMatch(u) { const C = db().cur; return !!(C && C.fighters[u] && !C.fighters[u].gone) }
function inRoundCount() { const C = db().cur; return C.inRound.filter(u => active(u)).length }

// Everyone accepted: build the arena, then gather the fighters.
function begin(server) {
  const D = db(), P = D.pending
  D.pending = null
  D.cur = { id: P.id, by: P.by.name, rounds: P.rounds, lives: P.lives, gear: P.gear, round: 0, deciding: 0, deciders: [],
    phase: 'building', until: 0, roundEnds: 0, inRound: [], started: Date.now(), fighters: {} }
  Object.keys(P.fighters).forEach(u => { D.cur.fighters[u] = { name: P.fighters[u].name, wins: 0, left: 0, out: true, gone: false, kills: 0, kos: 0 } })
  save()
  tellFighters(server, 'Everyone is in. The arena is rising...', 'gold')
  buildArena(server, (ok, why) => {
    if (!ok) { endMatch(server, null, 'the arena could not be built: ' + why); return }
    gather(server)
  })
}
function tellFighters(server, text, color) {
  const C = db().cur
  if (!C) return
  Object.keys(C.fighters).forEach(u => { let q = playerByUuid(server, u); if (q) tell(q, text, color) })
}
function onlineFighters(server) {
  const C = db().cur, out = []
  Object.keys(C.fighters).forEach(u => { let q = playerByUuid(server, u); if (q && !C.fighters[u].gone) out.push(q) })
  return out
}
// The arena is up: close any windows (a KubeJS window holds the inventory away), then vault (kit matches), tag and
// take everyone there.
function gather(server) {
  const C = db().cur
  Object.keys(C.fighters).forEach(u => { if (!playerByUuid(server, u)) { C.fighters[u].gone = true; db().owed[u] = true } })
  save()
  const here = onlineFighters(server)
  here.forEach(p => closeWindow(p))
  server.scheduleInTicks(3, () => {
    const C2 = db().cur
    if (!C2 || C2.id != C.id) return
    if (C2.gear != 'own') {
      let failed = ''
      let held = []
      onlineFighters(server).forEach(p => {
        if (failed) return
        if (windowStillOpen(p)) { failed = nameOf(p) + ' has a window open'; return }
        let why = vault(p)
        if (why) failed = nameOf(p) + ': ' + why
        else held.push(p)
      })
      if (failed) {                                   // nobody fights: belongings already held go straight back
        held.forEach(p => unvault(server, p))
        endMatch(server, null, 'called off: ' + failed)
        return
      }
    }
    C2.gathered = true                                // from here on, the end takes everyone home
    run(server, 'bossbar add ' + BOSSBAR + ' ' + JSON.stringify({ text: 'Gladiators' }))
    run(server, 'bossbar set ' + BOSSBAR + ' color red')
    onlineFighters(server).forEach(p => {
      run(server, 'tag ' + nameOf(p) + ' add ' + TAG)
      db().owed[uuidOf(p)] = true                    // taken home at the end, even if they're offline by then
    })
    run(server, 'bossbar set ' + BOSSBAR + ' players @a[tag=' + TAG + ']')
    save()
    if (Object.keys(C2.fighters).filter(u => !C2.fighters[u].gone).length < 2) { endMatch(server, null, 'called off: not enough fighters are here'); return }
    tellAll(server, 'The gladiators are in the arena: ' + names(Object.keys(C2.fighters).filter(u => !C2.fighters[u].gone).map(u => C2.fighters[u].name)) + '.', 'gold')
    startRound(server)
  })
}
// A round: everyone in it gets their lives back, a spot spread around the floor, and a countdown.
function startRound(server) {
  const C = db().cur, st = db().arena.site
  if (C.deciders.length) C.deciding++
  else C.round++
  C.inRound = (C.deciders.length ? C.deciders : Object.keys(C.fighters)).filter(u => !C.fighters[u].gone)
  Object.keys(C.fighters).forEach(u => {
    const f = C.fighters[u]
    f.left = C.inRound.indexOf(u) >= 0 ? C.lives : 0
    f.out = C.inRound.indexOf(u) < 0
  })
  const n = C.inRound.length, step = SPAWNS.length / Math.max(1, n), offset = Math.floor(Math.random() * SPAWNS.length)
  C.inRound.forEach((u, i) => {
    let p = playerByUuid(server, u)
    if (!p) return
    freshen(server, p)
    if (C.gear != 'own') giveKit(p, C.gear)
    tpTo(server, p, st, worldPoint(st, SPAWNS[Math.floor(offset + i * step) % SPAWNS.length]))
  })
  Object.keys(C.fighters).forEach((u, i) => {
    if (C.inRound.indexOf(u) >= 0 || C.fighters[u].gone) return
    let p = playerByUuid(server, u)
    if (p) { freshen(server, p); tpTo(server, p, st, standPoint(st, i)) }
  })
  C.phase = 'countdown'
  C.until = Date.now() + COUNTDOWN_SECONDS * 1000
  S.said = {}
  save()
  const label = C.deciders.length ? 'Deciding round' + (C.deciding > 1 ? ' ' + C.deciding : '') : 'Round ' + C.round + ' of ' + C.rounds
  title(server, label, livesText(C.lives) + ' each', 'gold')
  if (C.deciders.length) tellFighters(server, label + ': ' + names(C.inRound.map(u => C.fighters[u].name)) + ' are tied. Last one standing takes the match.', 'gold')
}
function title(server, big, small, color) {
  run(server, 'title @a[tag=' + TAG + '] times 5 30 10')
  if (small) run(server, 'title @a[tag=' + TAG + '] subtitle ' + JSON.stringify({ text: small, color: 'gray' }))
  run(server, 'title @a[tag=' + TAG + '] title ' + JSON.stringify({ text: big, color: color || 'gold', bold: true }))
}
function sound(server, id, pitch) { run(server, 'execute as @a[tag=' + TAG + '] at @s run playsound ' + id + ' master @s ~ ~ ~ 1 ' + (pitch || 1)) }
// Lethal damage (or leaving the arena) for a fighter in the round: a life gone. killer: { uuid, name } or null.
function knockout(server, p, u, killer, how) {
  const C = db().cur, f = C.fighters[u], st = db().arena.site
  f.left = Math.max(0, f.left - 1)
  f.kos++
  if (killer && C.fighters[killer.uuid] && killer.uuid != u) C.fighters[killer.uuid].kills++
  delete S.lastHit[u]
  freshen(server, p)
  const by = killer && killer.uuid != u ? ' by ' + killer.name : ''
  if (f.left > 0) {
    if (C.gear != 'own') giveKit(p, C.gear)
    tpTo(server, p, st, respawnPoint(server, st, u))
    run(server, 'effect give ' + nameOf(p) + ' minecraft:resistance ' + RESPAWN_RESISTANCE_SECONDS + ' 4 true')
    tell(p, (how || 'Knocked out') + by + '. ' + livesText(f.left) + ' left.', 'red')
    tellFighters(server, f.name + ' is down' + by + ' (' + f.left + ' left).', 'gray')
  } else {
    f.out = true
    tpTo(server, p, st, standPoint(st, Object.keys(C.fighters).indexOf(u)))
    tell(p, (how || 'Knocked out') + by + '. You\'re out of this round: watch from the wall.', 'red')
    tellFighters(server, f.name + ' is out of the round' + by + '.', 'gold')
  }
  save()
  checkRound(server)
}
// The round is over once one fighter (or none) is left in it.
function checkRound(server) {
  const C = db().cur
  if (!C || (C.phase != 'fight' && C.phase != 'countdown')) return
  const left = C.inRound.filter(u => active(u))
  if (left.length <= 1) endRound(server, left[0] || null, '')
}
function endRound(server, winner, why) {
  const C = db().cur
  if (winner) C.fighters[winner].wins++
  C.phase = 'between'
  C.until = Date.now() + BETWEEN_SECONDS * 1000
  C.lastWinner = winner || ''
  save()
  const label = C.deciders.length ? 'The deciding round' : 'Round ' + C.round
  if (winner) {
    title(server, C.fighters[winner].name, label + (why ? ' (' + why + ')' : ''), 'gold')
    tellFighters(server, label + ' goes to ' + C.fighters[winner].name + (why ? ' (' + why + ')' : '') + '. ' + standings(), 'gold')
  } else {
    title(server, 'No winner', label, 'gray')
    tellFighters(server, label + ' has no winner' + (why ? ' (' + why + ')' : '') + '. ' + standings(), 'gray')
  }
  sound(server, 'minecraft:entity.player.levelup', 0.8)
}
function standings() {
  const C = db().cur
  return 'Rounds won: ' + Object.keys(C.fighters).map(u => C.fighters[u].name + ' ' + C.fighters[u].wins).join(', ') + '.'
}
// After a round: the next round, a deciding round, or the end.
function nextOrEnd(server) {
  const C = db().cur, here = Object.keys(C.fighters).filter(u => !C.fighters[u].gone)
  if (here.length < 2) { endMatch(server, here[0] || null, here.length ? 'the others left' : 'everyone left'); return }
  if (C.deciders.length) {
    if (C.lastWinner) { endMatch(server, C.lastWinner, ''); return }
    if (C.deciding >= MAX_DECIDERS) { endMatch(server, null, 'a draw after ' + plural(MAX_DECIDERS, 'deciding round')); return }
    startRound(server)
    return
  }
  const ranked = here.slice().sort((a, b) => C.fighters[b].wins - C.fighters[a].wins)
  const lead = C.fighters[ranked[0]].wins, second = ranked.length > 1 ? C.fighters[ranked[1]].wins : 0, left = C.rounds - C.round
  if (lead > second + left) { endMatch(server, ranked[0], ''); return }      // nobody can catch up
  if (left > 0) { startRound(server); return }
  const top = ranked.filter(u => C.fighters[u].wins == lead)
  if (top.length == 1) { endMatch(server, top[0], ''); return }
  C.deciders = top
  save()
  startRound(server)
}
// The end: results for everyone, the fighters home (their belongings back in a kit match), the arena down.
function endMatch(server, winner, why) {
  const D = db(), C = D.cur
  if (!C) return
  C.phase = 'over'
  const all = Object.keys(C.fighters), score = all.map(u => C.fighters[u].name + ' ' + C.fighters[u].wins).join(', ')
  let text = ''
  if (winner) {
    let others = all.filter(u => u != winner).map(u => C.fighters[u].name)
    text = C.fighters[winner].name + ' wins the gladiator match against ' + names(others) + (why ? ' (' + why + ')' : '') + '. Rounds won: ' + score + '.'
  } else text = 'The gladiator match is over with no winner' + (why ? ': ' + why + '.' : '.') + (C.round ? ' Rounds won: ' + score + '.' : '')
  tellAll(server, text, winner ? 'gold' : 'gray')
  if (winner) {
    let w = playerByUuid(server, winner)
    if (w) { title(server, 'Victory', C.fighters[winner].name, 'gold'); sound(server, 'minecraft:ui.toast.challenge_complete', 1) }
  }
  D.history.unshift({ id: C.id, by: C.by, started: C.started, ended: Date.now(), rounds: C.rounds, lives: C.lives, gear: C.gear,
    winner: winner ? C.fighters[winner].name : '', why: why || '', fighters: all.map(u => ({ name: C.fighters[u].name, wins: C.fighters[u].wins, kills: C.fighters[u].kills, kos: C.fighters[u].kos })) })
  D.history = D.history.slice(0, HISTORY)
  D.cur = null
  save()
  console.info('[Gladiator] Match ' + C.id + ' over: ' + text)
  if (C.gathered) all.forEach(u => { let p = playerByUuid(server, u); if (p) sendHome(server, p) })   // never taken there: left where they are
  run(server, 'bossbar remove ' + BOSSBAR)
  S.lastHit = {}
  clearArena(server, null)
}
// A fighter after the match (or after leaving it): home, healed, untagged, belongings back.
function sendHome(server, p) {
  const D = db(), u = uuidOf(p)
  run(server, 'tag ' + nameOf(p) + ' remove ' + TAG)
  freshen(server, p)
  goHome(server, p)
  unvault(server, p)
  revokeEarned(server, p)
  delete D.owed[u]
  save()
}
// Advancements are progress (Twilight Forest opens its areas by them), and arena kit gear earns some the moment it's
// handed out. So every advancement a fighter earned in a match is taken back when they go home (recipe-book unlocks
// aside: they're no progress). Recorded by PlayerEvents.advancement below; kept until they're home.
function revokeEarned(server, p) {
  const D = db(), u = uuidOf(p), E = D.earned[u] || []
  E.forEach(id => run(server, 'advancement revoke ' + nameOf(p) + ' only ' + id))
  if (E.length) {
    tell(p, plural(E.length, 'advancement') + ' earned in the arena taken back: the arena doesn\'t count towards progress.', 'gray')
    console.info('[Gladiator] Revoked ' + nameOf(p) + '\'s arena advancements: ' + E.join(', '))
  }
  delete D.earned[u]
}
function advId(event) {
  const a = event.advancement
  try { return String(a.id()) } catch (e) { }
  try { return String(a.getId()) } catch (e) { }
  try { return String(event.getAdvancement().getId()) } catch (e) { }
  return ''
}
PlayerEvents.advancement(event => {
  const p = event.player, C = db().cur
  if (!C || !C.gathered || !isPlayer(p)) return
  const u = uuidOf(p)
  if (!inMatch(u)) return
  const id = advId(event)
  if (!id || /(^|:)recipes\//.test(id)) return
  const D = db()
  if (!D.earned[u]) D.earned[u] = []
  if (D.earned[u].indexOf(id) < 0) { D.earned[u].push(id); save() }
})

// ===================== THE CLOCK =====================

function tick(server) {
  const D = db(), now = Date.now()
  if (!S.stripAt || now - S.stripAt >= STRIP_SECONDS * 1000) {
    S.stripAt = now
    try { stripAll(server) } catch (e) { console.error('[Gladiator] Kit check: ' + e) }
  }
  const P = D.pending
  if (P && now >= P.expires) {
    let late = Object.keys(P.fighters).filter(u => !P.fighters[u].ok).map(u => P.fighters[u].name)
    callOff(server, names(late) + ' didn\'t answer in time.')
  }
  const C = D.cur
  if (!C || C.phase == 'building' || C.phase == 'over') return
  const st = D.arena.site
  if (!st) return
  if (C.phase == 'countdown') {
    let secs = Math.ceil((C.until - now) / 1000)
    if (secs > 0 && secs <= 3 && !S.said[secs]) { S.said[secs] = true; title(server, String(secs), '', 'yellow'); sound(server, 'minecraft:block.note_block.hat', 1) }
    if (now >= C.until) {
      C.phase = 'fight'
      C.roundEnds = now + ROUND_MINUTES * 60000
      save()
      title(server, 'FIGHT!', '', 'red')
      sound(server, 'minecraft:entity.ender_dragon.growl', 1.2)
    }
  } else if (C.phase == 'between') {
    if (now >= C.until) nextOrEnd(server)
    if (!db().cur) return
  } else if (C.phase == 'fight' && now >= C.roundEnds) {
    let left = C.inRound.filter(u => active(u)).sort((a, b) => C.fighters[b].left - C.fighters[a].left)
    let best = left.length ? C.fighters[left[0]].left : 0
    let top = left.filter(u => C.fighters[u].left == best)
    endRound(server, top.length == 1 ? top[0] : null, 'time ran out')
  }
  if (!db().cur) return
  patrol(server, st)
  bossbar(server)
}
// Fighters who leave the arena: rung out (a knockout) in a round, otherwise brought back. Fighters who are out stay
// up on the wall.
function patrol(server, st) {
  const C = db().cur, m = centreOf(st), c = corner(st)
  onlineFighters(server).forEach(p => {
    const u = uuidOf(p), q = pos(p), d = Math.sqrt((q.x - m.x) * (q.x - m.x) + (q.z - m.z) * (q.z - m.z))
    const outside = dimOf(p) != st.dim || d > RING_RADIUS || q.y < c.y - 3
    if (active(u)) {
      if (!outside) return
      if (C.phase == 'fight') knockout(server, p, u, recentHit(u), 'Rung out')
      else tpTo(server, p, st, respawnPoint(server, st, u))
    } else if (outside || d < FLOOR_RADIUS) tpTo(server, p, st, standPoint(st, Object.keys(C.fighters).indexOf(u)))
  })
}
function bossbar(server) {
  const C = db().cur
  run(server, 'bossbar set ' + BOSSBAR + ' players @a[tag=' + TAG + ']')   // fighters who left lose it
  const label = C.deciders.length ? 'Deciding round' : 'Round ' + C.round + '/' + C.rounds
  const parts = C.inRound.map(u => C.fighters[u].name + ' ' + (C.fighters[u].out ? 'out' : C.fighters[u].left + '❤') + ' ★' + C.fighters[u].wins)
  run(server, 'bossbar set ' + BOSSBAR + ' name ' + JSON.stringify({ text: '⚔ ' + label + ' · ' + parts.join(' · '), color: 'gold' }))
  if (C.phase == 'fight') {
    run(server, 'bossbar set ' + BOSSBAR + ' max ' + ROUND_MINUTES * 60)
    run(server, 'bossbar set ' + BOSSBAR + ' value ' + Math.max(0, Math.round((C.roundEnds - Date.now()) / 1000)))
  }
}
function recentHit(u) {
  const h = S.lastHit[u]
  return h && Date.now() - h.t <= LAST_HIT_SECONDS * 1000 ? { uuid: h.uuid, name: h.name } : null
}
function startLoop(server) {
  const token = (global.__gladiatorLoop = (global.__gladiatorLoop || 0) + 1)   // one loop, even across /reload
  const step = () => {
    if (token != global.__gladiatorLoop) return
    try { tick(server) } catch (e) { console.error('[Gladiator] Tick: ' + e) }
    server.scheduleInTicks(20, step)
  }
  server.scheduleInTicks(20, step)
}

// ===================== EVENTS =====================

// Hits: only between fighters in the round, while it's being fought. Anyone else (out, waiting, not in the match)
// can't hurt a fighter or be hurt by one.
EntityEvents.hurt(event => {
  const C = db().cur
  if (!C || C.phase == 'building' || C.phase == 'over') return
  const v = event.entity, a = attackerOf(event.source)
  const vu = isPlayer(v) ? uuidOf(v) : '', au = isPlayer(a) ? uuidOf(a) : ''
  const vf = !!vu && inMatch(vu), af = !!au && inMatch(au) && au != vu
  if (!vf && !af) return
  let ok = C.phase == 'fight'
  if (vf && !active(vu)) ok = false
  if (af && !active(au)) ok = false
  if (au && au != vu && (!vf || !af)) ok = false     // a fighter and someone outside the match
  if (ok) {
    if (vf && af) S.lastHit[vu] = { uuid: au, name: nameOf(a), t: Date.now() }
    return
  }
  event.cancel()
})
// Lethal damage to a fighter: a knockout, never a death (no drops, no corpse). /kill still kills, and that fighter
// leaves the match.
EntityEvents.death(event => {
  const C = db().cur, v = event.entity
  if (!C || !isPlayer(v) || C.phase == 'building' || C.phase == 'over') return
  const u = uuidOf(v), server = event.server || Utils.server
  if (!inMatch(u)) return
  if (damageType(event.source) == 'genericKill') { leave(server, v, u, 'was killed'); return }
  const a = attackerOf(event.source)
  let killer = null
  if (isPlayer(a) && uuidOf(a) != u) killer = { uuid: uuidOf(a), name: nameOf(a) }
  else killer = recentHit(u)
  if (active(u) && C.phase == 'fight') knockout(server, v, u, killer, '')
  else freshen(server, v)
  event.cancel()
})
// A fighter leaving the match (logging out, /kill): out of it for good, taken home when they're next online.
function leave(server, p, u, how) {
  const C = db().cur, f = C.fighters[u]
  f.gone = true
  f.out = true
  f.left = 0
  db().owed[u] = true
  save()
  tellFighters(server, f.name + ' ' + how + ' and is out of the match.', 'gray')
  const here = Object.keys(C.fighters).filter(w => !C.fighters[w].gone)
  if (here.length < 2) { endMatch(server, here[0] || null, here.length ? 'a walkover: ' + f.name + ' ' + how : 'everyone left'); return }
  checkRound(server)
}
PlayerEvents.loggedOut(event => {
  const D = db(), p = event.player, u = uuidOf(p), server = event.server || Utils.server
  if (D.pending && D.pending.fighters[u]) callOff(server, nameOf(p) + ' logged out.')
  const C = D.cur
  if (C && C.fighters[u] && !C.fighters[u].gone && C.phase != 'over') leave(server, p, u, 'logged out')
})
// Back from a match that ended (or that they left) while they were offline: home, untagged, belongings back.
PlayerEvents.loggedIn(event => {
  const D = db(), p = event.player, u = uuidOf(p), server = event.server || Utils.server
  const C = D.cur
  if (C && C.fighters[u] && !C.fighters[u].gone) return
  if (D.owed[u] || D.vaults[u]) server.scheduleInTicks(20, () => { if (!inMatch(u)) sendHome(server, p) })
})
// A fighter /kill'ed out of the match: home with their belongings once they respawn.
PlayerEvents.respawned(event => {
  const D = db(), p = event.player, u = uuidOf(p), server = event.server || Utils.server
  if ((D.owed[u] || D.vaults[u]) && !inMatch(u)) server.scheduleInTicks(2, () => sendHome(server, p))
})
// The arena's blocks can't be broken or built on (creative excepted), and explosions don't break them.
function inArena(d, x, y, z) { const st = arenaUp(); return !!st && insideBox(st, d, { x: x, y: y, z: z }) }
function guardBlock(event) {
  const p = event.player, b = event.block
  if (!b || !arenaUp()) return
  if (p && bool(() => p.isCreative())) return
  let d = ''
  try { d = String(b.getDimension()) } catch (e) { try { d = dimKey(b.level) } catch (e2) { return } }
  if (!inArena(d, Number(b.x), Number(b.y), Number(b.z))) return
  if (p) tell(p, 'The arena can\'t be changed.', 'gray')
  event.cancel()
}
BlockEvents.broken(event => guardBlock(event))
BlockEvents.placed(event => guardBlock(event))
LevelEvents.afterExplosion(event => {
  const st = arenaUp()
  if (!st) return
  try {
    let q = { x: Number(event.x), y: Number(event.y), z: Number(event.z) }
    if (insideBox(st, dimKey(event.level), q)) event.removeAllAffectedBlocks()
  } catch (e) { }
})
// No monsters spawn in the arena's space.
EntityEvents.spawned(event => {
  const st = arenaUp(), e = event.entity
  if (!st || isPlayer(e)) return
  let monster = false
  try { monster = String(e.getType().getCategory()).toLowerCase().indexOf('monster') >= 0 } catch (err) { return }
  if (!monster || !insideBox(st, dimOf(e), pos(e))) return
  event.cancel()
})

// ===================== THE STATUE AND THE WINDOW =====================
// KubeJS's chest window (player.openChestGUI) holds the player's inventory away while it's open and hands it back
// the tick after it closes. So, as in the black market's shop, every click closes the window first, waits for the
// inventory to come back, then acts and reopens it.

const CLOSE_WAYS = [p => p.closeMenu(), p => p.closeContainer()]
function closeWindow(p) {
  for (let i = 0; i < CLOSE_WAYS.length; i++) { try { CLOSE_WAYS[i](p); return true } catch (e) { } }
  return false
}
function menuName(p) { try { return String(p.containerMenu.getClass().getSimpleName()) } catch (e) { return '?' } }
function windowStillOpen(p) { return menuName(p) == 'CustomChestMenu' }
function withWindowClosed(p, fn) {
  Utils.server.scheduleInTicks(1, () => closeWindow(p))
  Utils.server.scheduleInTicks(3, () => {
    if (windowStillOpen(p)) { tell(p, 'The window didn\'t close properly. Press Esc and try again.', 'red'); return }
    try { fn() } catch (e) { console.error('[Gladiator] Window: ' + e) }
  })
}
function guiItem(id, name, color, lore, opts) {
  opts = opts || {}
  const parts = ['display:{Name:' + snbtString(JSON.stringify({ text: name, color: color, italic: false, bold: !!opts.bold })) +
    ',Lore:[' + lore.map(l => snbtString(JSON.stringify(typeof l == 'string' ? { text: l, color: 'gray', italic: false } : { text: l.text, color: l.color || 'gray', italic: !!l.italic }))).join(',') + ']}']
  if (opts.glint) parts.push('Enchantments:[{id:"minecraft:unbreaking",lvl:1s}]')
  parts.push('HideFlags:127')
  if (opts.extra) parts.push(opts.extra)
  return Item.of(id, opts.count || 1, '{' + parts.join(',') + '}')
}
// The window's gear area: own gear, then the kits, along rows 3 and 4. [x, y] of the n-th (0 = own gear).
function gearSlot(n) { return [n % 9, 3 + Math.floor(n / 9)] }
function guiButton(gui, x, y, item, onClick) {
  gui.slot(x, y, s => {
    s.item = item
    s.leftClicked = e => onClick()
    s.rightClicked = e => onClick()
  })
}
function openMenu(p) {
  const why = busyWhy()
  if (why) { tell(p, why + ' ' + statusLine(), 'gray'); return }
  showMenu(p)
}
function refresh(p) { withWindowClosed(p, () => openMenu(p)) }
function showMenu(p) {
  const server = Utils.server, d = draftOf(p)
  p.openChestGUI(comp([{ text: 'The Gladiator Arena', color: 'dark_red' }]), 6, gui => {
    const cells = []
    for (let i = 0; i < 54; i++) cells.push(i)
    cells.forEach(i => gui.slot(i % 9, Math.floor(i / 9), s => { s.item = guiItem('minecraft:gray_stained_glass_pane', ' ', 'gray', []) }))
    // Rows 0-2: who fights.
    const online = players(server).sort((a, b) => (nameOf(a).toLowerCase() < nameOf(b).toLowerCase() ? -1 : 1)).slice(0, 27)
    online.forEach((q, i) => {
      const u = uuidOf(q), n = nameOf(q), on = !!d.picked[u]
      guiButton(gui, i % 9, Math.floor(i / 9), guiItem('minecraft:player_head', n, on ? 'green' : 'white',
        [on ? { text: '✔ In the fight', color: 'green' } : 'Click to add', on ? { text: 'Click to take out', color: 'dark_gray', italic: true } : ''].filter(x => x),
        { glint: on, extra: 'SkullOwner:"' + n + '"' }), () => {
        if (d.picked[u]) delete d.picked[u]
        else d.picked[u] = n
        refresh(p)
      })
    })
    // Rows 3-4: the gear (own gear, then the kits in KIT_ORDER).
    guiButton(gui, 0, 3, guiItem('minecraft:chest', 'Own gear', d.gear == 'own' ? 'green' : 'white',
      ['Everyone fights with what they carry.', 'Nothing is lost: nobody dies.'].concat(d.gear == 'own' ? [{ text: '✔ Chosen', color: 'green' }] : []), { glint: d.gear == 'own' }),
      () => { d.gear = 'own'; refresh(p) })
    KIT_ORDER.slice(0, 17).forEach((k, i) => {
      const K = KITS[k], on = d.gear == k, at = gearSlot(i + 1)
      guiButton(gui, at[0], at[1], guiItem(K.icon, K.name + ' kit', on ? 'green' : 'white',
        [K.blurb, 'Belongings are held and handed back.'].concat(on ? [{ text: '✔ Chosen', color: 'green' }] : []), { glint: on }),
        () => { d.gear = k; refresh(p) })
    })
    // Row 5: rounds and lives, cancel, send.
    const stepper = (x, label, value, lim, icon, set) => {
      guiButton(gui, x, 5, guiItem('minecraft:red_stained_glass_pane', 'Fewer ' + label, 'red', []), () => { set(Math.max(lim.min, value - 1)); refresh(p) })
      guiButton(gui, x + 1, 5, guiItem(icon, label.charAt(0).toUpperCase() + label.slice(1) + ': ' + value, 'gold', [], { count: value }), () => { })
      guiButton(gui, x + 2, 5, guiItem('minecraft:lime_stained_glass_pane', 'More ' + label, 'green', []), () => { set(Math.min(lim.max, value + 1)); refresh(p) })
    }
    stepper(0, 'rounds', d.rounds, ROUNDS, 'minecraft:clock', v => { d.rounds = v })
    stepper(3, 'lives', d.lives, LIVES, 'minecraft:totem_of_undying', v => { d.lives = v })
    guiButton(gui, 7, 5, guiItem('minecraft:barrier', 'Cancel', 'red', []), () => { Utils.server.scheduleInTicks(1, () => closeWindow(p)) })
    const who = Object.keys(d.picked).map(u => d.picked[u])
    guiButton(gui, 8, 5, guiItem('minecraft:bell', 'Send the challenge', 'gold',
      [{ text: (who.length ? names(who) : 'Nobody picked yet'), color: 'white' }, plural(d.rounds, 'round') + ', ' + livesText(d.lives) + ' a round',
        gearName(d.gear).charAt(0).toUpperCase() + gearName(d.gear).slice(1), { text: 'Everyone picked must accept in chat (' + INVITE_SECONDS + ' s).', color: 'dark_gray', italic: true }], { glint: true }),
      () => withWindowClosed(p, () => {
        const r = challenge(Utils.server, p, d)
        if (r) tell(p, r, 'red')
        else tell(p, 'Challenge sent. Waiting for everyone to accept.', 'green')
      }))
  })
}
// The statue: the armour stand (its gear can't be taken: DisabledSlots), the title over it, and the click box. Any
// statue already up goes first.
function itemSnbt(id, extra) { return '{id:"' + id + '",Count:1b' + (extra ? ',tag:{' + extra + '}' : '') + '}' }
function buildStatue(server, T) {
  removeStatue(server)
  const at = num(T.x) + ' ' + num(T.y) + ' ' + num(T.z), inDim = 'execute in ' + T.dim + ' run '
  run(server, inDim + 'summon minecraft:armor_stand ' + at + ' {Tags:["' + TILE_TAG + '"],ShowArms:1b,NoBasePlate:1b,Invulnerable:1b,' +
    'NoGravity:1b,PersistenceRequired:1b,DisabledSlots:4144959,Rotation:[' + num(T.yaw) + 'f,0f],Pose:' + STATUE_POSE + ',' +
    'ArmorItems:[' + STATUE_ARMOR.map(id => itemSnbt(id, TRIM)).join(',') + '],HandItems:[' + STATUE_HANDS.join(',') + ']}')
  run(server, inDim + 'summon minecraft:text_display ' + num(T.x) + ' ' + num(T.y + TITLE_HEIGHT) + ' ' + num(T.z) +
    ' {Tags:["' + TILE_TAG + '"],billboard:"center",shadow:1b,text:' + snbtString(JSON.stringify(TITLE)) + '}')
  run(server, inDim + 'summon minecraft:interaction ' + at + ' {Tags:["' + TILE_TAG + '"],width:1.2f,height:2.3f,response:1b}')
}
function removeStatue(server) { run(server, 'kill @e[tag=' + TILE_TAG + ']') }
function isTile(e) { try { return !!e && !!e.getTags().contains(TILE_TAG) } catch (err) { return false } }
// Right-clicking the statue (its click box) opens the window. Nothing else happens to it.
ItemEvents.entityInteracted(event => {
  if (!isTile(event.target)) return
  const p = event.player, u = uuidOf(p), now = Date.now()
  let hand = ''
  try { hand = String(event.hand) } catch (e) { }
  if ((!hand || hand.indexOf('MAIN') >= 0) && (!S.clickAt[u] || now - S.clickAt[u] > 500)) {
    S.clickAt[u] = now
    Utils.server.scheduleInTicks(1, () => { try { openMenu(p) } catch (e) { console.error('[Gladiator] Menu: ' + e) } })
  }
  event.cancel()
})

// ===================== COMMANDS =====================

function statusLine() {
  const D = db(), C = D.cur, P = D.pending
  if (P) return 'Waiting for ' + names(Object.keys(P.fighters).filter(u => !P.fighters[u].ok).map(u => P.fighters[u].name)) + ' to accept (' + Math.max(0, Math.ceil((P.expires - Date.now()) / 1000)) + ' s).'
  if (C) {
    if (C.phase == 'building') return 'The arena is being built for ' + names(Object.keys(C.fighters).map(u => C.fighters[u].name)) + '.'
    return (C.deciders.length ? 'Deciding round. ' : 'Round ' + C.round + ' of ' + C.rounds + '. ') + standings()
  }
  return 'No match is on.'
}
ServerEvents.commandRegistry(event => {
  const Commands = event.commands, Arguments = event.arguments
  const reply = (ctx, text, bad) => { ctx.source.sendSystemMessage(comp(voice(text, bad ? 'red' : 'yellow'))); return bad ? 0 : 1 }
  const safe = fn => ctx => { try { return fn(ctx) } catch (e) { console.error('[Gladiator] ' + e); return reply(ctx, 'Error: ' + e, true) } }
  const op = src => src.hasPermission(2)
  const self = ctx => ctx.source.getPlayer()
  const int = name => Commands.argument(name, Arguments.INTEGER.create(event))
  const numArg = (ctx, name) => Number(Arguments.INTEGER.getResult(ctx, name))
  const respond = (ctx, yes) => {
    const p = self(ctx)
    if (!p) return reply(ctx, 'Only a player can answer.', true)
    const r = answer(ctx.source.server, p, numArg(ctx, 'id'), yes)
    return r ? reply(ctx, r, true) : 1
  }
  // The statue goes where the op stands (the middle of that block), facing the way they face.
  const setTile = ctx => {
    const p = self(ctx)
    if (!p) return reply(ctx, 'Run this as a player, standing where the statue should go.', true)
    const q = pos(p)
    let yaw = 0
    try { yaw = Number(p.getYRot()) } catch (e) { try { yaw = Number(p.yaw) } catch (e2) { } }
    const T = { dim: dimOf(p), x: Math.floor(q.x) + 0.5, y: Math.floor(q.y + 0.01), z: Math.floor(q.z) + 0.5, yaw: Math.round(yaw / 45) * 45 }
    db().tile = T
    save()
    buildStatue(ctx.source.server, T)
    return reply(ctx, 'The arena statue stands at ' + Math.floor(T.x) + ' ' + T.y + ' ' + Math.floor(T.z) + '. Right-clicking it opens the arena window. Step off its spot.')
  }
  const siteHere = ctx => {
    const p = self(ctx)
    if (!p) return reply(ctx, 'Run this as a player.', true)
    if (db().cur || db().pending || db().arena.state != 'none') return reply(ctx, 'Not while the arena is up or a match is on.', true)
    const q = pos(p), st = { dim: dimOf(p), x: Math.floor(q.x), y: DEFAULT_SITE.y, z: Math.floor(q.z) }
    let top = 320
    try { top = Number(levelOfEntity(p).getMaxBuildHeight()) } catch (e) { }
    if (st.y + SIZE[1] > top) return reply(ctx, 'The arena doesn\'t fit under this dimension\'s build limit.', true)
    db().site = st
    save()
    return reply(ctx, 'The arena will be built centred on ' + st.x + ' ' + st.z + ' in ' + st.dim + ', from y ' + st.y + ' to ' + (st.y + SIZE[1] - 1) + '.')
  }
  event.register(Commands.literal('gladiator')
    .executes(safe(ctx => reply(ctx, statusLine())))
    .then(Commands.literal('accept').then(int('id').executes(safe(ctx => respond(ctx, true)))))
    .then(Commands.literal('decline').then(int('id').executes(safe(ctx => respond(ctx, false)))))
    .then(Commands.literal('menu').requires(op).executes(safe(ctx => { const p = self(ctx); if (p) openMenu(p); return 1 })))
    .then(Commands.literal('tile').requires(op)
      .executes(safe(ctx => {
        const T = db().tile
        return reply(ctx, T && T.yaw != null ? 'The arena statue is at ' + Math.floor(T.x) + ' ' + T.y + ' ' + Math.floor(T.z) + ' in ' + T.dim + '. /gladiator tile fix puts it back if it\'s gone.' : 'There is no arena statue. Stand where it should go and run /gladiator tile set.')
      }))
      .then(Commands.literal('set').executes(safe(setTile)))
      .then(Commands.literal('fix').executes(safe(ctx => {
        const T = db().tile
        if (!T || T.yaw == null) return reply(ctx, 'There is no arena statue yet: /gladiator tile set.', true)
        buildStatue(ctx.source.server, T)
        return reply(ctx, 'The arena statue is rebuilt where it was.')
      })))
      .then(Commands.literal('clear').executes(safe(ctx => { removeStatue(ctx.source.server); db().tile = null; save(); return reply(ctx, 'The arena statue is gone.') }))))
    .then(Commands.literal('site').requires(op)
      .executes(safe(ctx => { const st = siteNow(); return reply(ctx, 'The arena is built centred on ' + st.x + ' ' + st.z + ' in ' + st.dim + ', from y ' + st.y + '.' + (db().site ? '' : ' (the default)')) }))
      .then(Commands.literal('here').executes(safe(siteHere)))
      .then(Commands.literal('reset').executes(safe(ctx => { db().site = null; save(); return reply(ctx, 'The arena site is back to the default.') }))))
    .then(Commands.literal('build').requires(op).executes(safe(ctx => {
      const why = busyWhy()
      if (why) return reply(ctx, why, true)
      buildArena(ctx.source.server, (ok, w) => { if (ok) reply(ctx, 'The arena is up. /gladiator clear takes it down.'); else reply(ctx, 'It could not be built: ' + w, true) })
      return reply(ctx, 'Building the arena...')
    })))
    .then(Commands.literal('clear').requires(op).executes(safe(ctx => {
      if (db().cur) return reply(ctx, 'A match is on. /gladiator stop ends it (and takes the arena down).', true)
      if (db().arena.state == 'none') return reply(ctx, 'The arena isn\'t up.', true)
      clearArena(ctx.source.server, () => reply(ctx, 'The arena is down.'))
      return reply(ctx, 'Taking the arena down...')
    })))
    .then(Commands.literal('stop').requires(op).executes(safe(ctx => {
      if (db().pending) { callOff(ctx.source.server, 'an op called it off.'); return reply(ctx, 'Challenge called off.') }
      if (!db().cur) return reply(ctx, 'No match is on.', true)
      endMatch(ctx.source.server, null, 'an op stopped it')
      return reply(ctx, 'Match stopped. Everyone is going home and the arena is coming down.')
    })))
    .then(Commands.literal('history').executes(safe(ctx => {
      const H = db().history
      if (!H.length) return reply(ctx, 'No matches yet.')
      H.slice(0, 5).forEach(h => reply(ctx, '#' + h.id + ': ' + (h.winner ? h.winner + ' won' : 'no winner') + ' (' + h.fighters.map(f => f.name + ' ' + f.wins).join(', ') + ')' + (h.why ? ', ' + h.why : '')))
      return 1
    }))))
})

// ===================== STARTING UP =====================

// A server start: a match from before the restart can't go on. It ends (fighters are taken home and get their
// belongings back when they log in), and an arena left up comes down.
ServerEvents.loaded(event => {
  const server = event.server, D = db()
  if (D.pending) { D.pending = null; save() }
  if (D.cur) {
    Object.keys(D.cur.fighters).forEach(u => { D.owed[u] = true })
    save()
    endMatch(server, null, 'the server restarted')
  } else if (D.arena.state == 'building' || D.arena.state == 'clearing') clearArena(server, null)
  startLoop(server)
})
// After /reload: the match goes on; a build or a take-down that was under way picks up again.
try {
  if (Utils.server) {
    let server = Utils.server, D = db()
    startLoop(server)
    if (D.arena.state == 'clearing') clearArena(server, null)
    else if (D.arena.state == 'building' && D.cur && D.cur.phase == 'building') {
      buildArena(server, (ok, why) => { if (!ok) endMatch(server, null, 'the arena could not be built: ' + why); else gather(server) })
    } else if (D.arena.state == 'building') buildArena(server, () => { })   // an op's /gladiator build
    else if (D.cur && D.cur.phase == 'building' && D.arena.state == 'built') gather(server)
  }
} catch (e) { console.error('[Gladiator] After reload: ' + e) }

// ===================== API =====================

global.Gladiator = {
  busy: () => !!(db().cur || db().pending),
  state: () => JSON.parse(JSON.stringify(db())),
  isFighter: u => isFighter(String(u).toLowerCase()),
  site: () => siteNow(),
  arenaUp: () => arenaUp(),
}

})()
