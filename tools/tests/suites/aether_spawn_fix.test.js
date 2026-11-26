// aether_spawn_fix.js: the Aether's Swet and Aechor Plant spawn rules without their block scans.
// Run with: node tools/tests/run_all.js aether_spawn   (or node tools/tests/suites/aether_spawn_fix.test.js)
const fs = require('fs')
const paths = require('../lib/paths')
const SRC = fs.readFileSync(paths.kubejs('startup_scripts/aether_spawn_fix.js'), 'utf8')
let fails = 0
const ok = (l, c, e) => { console.log((c ? 'ok   ' : 'FAIL ') + l + (!c && e !== undefined ? '  ' + e : '')); if (!c) fails++ }
const R = 40

// A small seeded generator, so a failure repeats.
let seed = 20261125
const rnd = () => { seed = (seed * 1103515245 + 12345) % 2147483648; return seed / 2147483648 }
const between = (a, b) => a + Math.floor(rnd() * (b - a + 1))

class Banner {
  constructor(x, y, z, block, pattern) { Object.assign(this, { x, y, z, block, pattern }) }
  getBlockPos() { return pos(this.x, this.y, this.z) }
  getBlockState() { return { getBlock: () => 'Block{minecraft:' + this.block + '}' } }
  getItem() { return this }
  static getItemPatterns(item) { return item.pattern }
}
class Chest { constructor(x, y, z) { Object.assign(this, { x, y, z }) } getBlockPos() { return pos(this.x, this.y, this.z) } }   // no banner: asking it for its state fails
function pos(x, y, z) { return { getX: () => x, getY: () => y, getZ: () => z, below: () => pos(x, y - 1, z), getCenter: () => ({ x: x + 0.5, y: y + 0.5, z: z + 0.5 }) } }

// One spot that could spawn something, with what's around it.
function scene(o) {
  const s = Object.assign({ grass: true, light: 15, difficulty: 'NORMAL', bes: [], stands: [], nearFlowers: false, enchanted: false, dim: 'aether:the_aether', unloaded: false }, o)
  const lv = {
    getLevel: () => lv, dimension: s.dim,
    getBlock: p => ({ hasTag: t => { s.tag = t; return s.grass } }),
    getRawBrightness: () => s.light,
    getDifficulty: () => s.difficulty,
    getChunkSource: () => ({ getChunkNow: (cx, cz) => {
      if (s.unloaded) return null
      const list = s.bes.filter(b => b.x >> 4 == cx && b.z >> 4 == cz)
      return { getBlockEntities: () => ({ isEmpty: () => !list.length, values: () => ({ iterator: () => { let i = 0; return { hasNext: () => i < list.length, next: () => list[i++] } } }) }) }
    } }),
    getEntitiesOfClass: (cls, box) => ({ stream: () => ({ anyMatch: f => s.stands.filter(e => Math.abs(e.x - box.c.x) <= box.x / 2 && Math.abs(e.y - box.c.y) <= box.y / 2 && Math.abs(e.z - box.c.z) <= box.z / 2).some(f) }) }),
    s,
  }
  return lv
}
const PATTERN = { equals: p => p === 'swet' }

// What the Aether's own rules do (read from its 1.5.2 code).
const calls = { swet: 0, plant: 0, flowers: 0, enchanted: 0 }
function ownSwet(type, lv, reason, p) {
  calls.swet++
  const s = lv.s
  if (!s.grass || !(s.light > 8) || s.difficulty == 'PEACEFUL') return false
  if (String(reason) != 'NATURAL') return true
  const banner = s.bes.some(b => b instanceof Banner && b.block == 'black_banner' && b.pattern === 'swet' && Math.pow(b.x - p.getX(), 2) + Math.pow(b.y - p.getY(), 2) + Math.pow(b.z - p.getZ(), 2) <= R * R)
  const c = p.getCenter()
  const cape = s.stands.some(e => e.cape && Math.abs(e.x - c.x) <= R && Math.abs(e.y - c.y) <= R && Math.abs(e.z - c.z) <= R)
  return !banner && !cape
}
function ownPlant(type, lv, reason, p, random) {
  calls.plant++
  const s = lv.s
  if (!s.grass || !(s.light > 8) || s.difficulty == 'PEACEFUL') return false
  if (String(reason) != 'NATURAL') return true
  return random.nextInt(10) == 0 && !s.nearFlowers && !s.enchanted
}

function load(opts) {
  opts = opts || {}
  const W = { logs: [], rules: {}, now: 1.7e12, handler: null, classes: 0 }
  const g = {}
  W.global = g
  const classes = {
    'net.minecraftforge.event.entity.SpawnPlacementRegisterEvent$Operation': { REPLACE: 'REPLACE' },
    'net.minecraftforge.registries.ForgeRegistries': { ENTITY_TYPES: { getValue: rl => String(rl) } },
    'net.minecraft.resources.ResourceLocation': function (s) { this.toString = () => s },
    'net.minecraft.world.phys.AABB': { ofSize: (c, x, y, z) => ({ c, x, y, z }) },
    'net.minecraft.world.entity.decoration.ArmorStand': 'ArmorStand',
    'net.minecraft.world.level.block.entity.BannerBlockEntity': Banner,
    'com.aetherteam.aether.entity.monster.Swet': { checkSwetSpawnRules: ownSwet },
    'com.aetherteam.aether.entity.monster.AechorPlant': { checkAechorPlantSpawnRules: ownPlant, inRadiusOfFlowers: (lv, p, r) => { calls.flowers++; if (r != 10) throw new Error('radius ' + r); return lv.s.nearFlowers }, inRadiusOfEnchantedFlowers: (lv, p, r) => { calls.enchanted++; if (r != 40) throw new Error('radius ' + r); return lv.s.enchanted } },
    'com.aetherteam.aether.block.AetherBlocks': { SWET_BANNER_PATTERN: { toListTag: () => PATTERN } },
    'com.aetherteam.aether.item.EquipmentUtil': { hasSwetCape: e => !!e.cape },
  }
  const Java = { loadClass: c => { W.classes++; if ((opts.without || []).indexOf(c) >= 0 || !classes[c]) throw new Error('no ' + c); return classes[c] } }
  function FakeDate() { return new Date(W.now) }
  FakeDate.now = () => W.now
  new Function('Platform', 'Java', 'ForgeModEvents', 'console', 'global', 'Date', SRC)(
    { isClientEnvironment: () => !!opts.client, isLoaded: m => m == 'aether' && !opts.noAether },
    Java, { onEvent: (cls, h) => { W.cls = cls; W.handler = h } },
    { info: m => W.logs.push(m), warn: m => W.logs.push('WARN ' + m), error: m => W.logs.push('ERR ' + m) }, g, FakeDate)
  W.fire = fail => W.handler({ register: (type, rule, op) => { if (fail && fail(type)) throw new Error('nonnull placement type'); if (op != 'REPLACE') throw new Error('operation ' + op); W.rules[type] = rule } })
  return W
}
const zero = { nextInt: () => 0 }

// ---------- what's replaced ----------
{
  const W = load()
  ok('it waits for Forge to ask for spawn rules', W.cls == 'net.minecraftforge.event.entity.SpawnPlacementRegisterEvent' && typeof W.handler == 'function')
  W.fire()
  ok('both Swets and the Aechor Plant get a rule, and nothing else', Object.keys(W.rules).sort().join() == 'aether:aechor_plant,aether:blue_swet,aether:golden_swet', Object.keys(W.rules).join())
  ok('... and the log says so', W.logs.some(l => /3 of 3 spawn rules replaced/.test(l)) && W.global.AetherSpawnFix.stats().registered == 3)
  const late = load()
  late.fire(t => t == 'aether:golden_swet')
  ok('one the Aether hasn\'t registered yet keeps the Aether\'s rule, with a warning; the others are still replaced', Object.keys(late.rules).length == 2 && late.logs.some(l => /^WARN .*golden_swet keeps the Aether's own rule/.test(l)) && late.logs.some(l => /2 of 3/.test(l)))
  ok('nothing without the Aether, or on a player\'s game', !load({ noAether: true }).handler && !load({ client: true }).handler)
  const gone = load({ without: ['net.minecraft.world.level.block.entity.BannerBlockEntity'] })
  ok('a class that isn\'t there: a warning, and nothing is replaced', !gone.handler && gone.logs.some(l => /^WARN .*BannerBlockEntity wasn't found/.test(l)))
  ok('never an error in the log while the game starts (KubeJS would refuse to start the server)', ![W, late, gone].some(w => w.logs.some(l => /^ERR/.test(l))) && !/console\.error\(/.test(SRC))
}

// ---------- Swets: the same answer as the Aether's, always ----------
{
  const W = load(); W.fire()
  const rule = W.rules['aether:blue_swet']
  let differ = 0, yes = 0, no = 0, byBanner = 0, first = ''
  for (let k = 0; k < 4000; k++) {
    const px = between(-200, 200), py = between(10, 200), pz = between(-200, 200), p = pos(px, py, pz)
    const bes = [], stands = []
    for (let n = between(0, 3); n > 0; n--) bes.push(new Banner(px + between(-50, 50), py + between(-45, 45), pz + between(-50, 50), ['black_banner', 'black_banner', 'black_wall_banner', 'white_banner'][between(0, 3)], ['swet', 'swet', 'other'][between(0, 2)]))
    if (rnd() < 0.3) bes.push(new Chest(px + 3, py, pz - 2))
    for (let n = between(0, 2); n > 0; n--) stands.push({ x: px + between(-60, 60), y: py + between(-60, 60), z: pz + between(-60, 60), cape: rnd() < 0.4 })
    const s = scene({ grass: rnd() < 0.85, light: between(0, 15), difficulty: rnd() < 0.9 ? 'NORMAL' : 'PEACEFUL', bes, stands })
    const reason = rnd() < 0.9 ? 'NATURAL' : 'SPAWNER'
    const mine = rule('t', s, reason, p, zero), own = ownSwet('t', s, reason, p)
    if (mine !== own) { differ++; first = first || JSON.stringify(s.s) }
    if (own) yes++; else no++
    if (!own && s.s.grass && s.s.light > 8 && s.s.difficulty != 'PEACEFUL') byBanner++
  }
  ok('4,000 made-up spots: the same answer as the Aether\'s rule at each', differ == 0, differ + ' differ, ' + first)
  ok('... (a fair mix: some allowed, some refused, some by a banner or cape alone)', yes > 300 && no > 300 && byBanner > 200, yes + ' ' + no + ' ' + byBanner)
  ok('... (and it was this rule that answered: nothing failed on the way)', W.global.AetherSpawnFix.stats().problem == '' && W.global.AetherSpawnFix.stats().swets > 3000 && !W.logs.some(l => /^WARN|^ERR/.test(l)), W.global.AetherSpawnFix.stats().problem)
  ok('... and it asks about the Aether\'s own ground', (() => { const s = scene({}); rule('t', s, 'NATURAL', pos(0, 64, 0), zero); return s.s.tag == 'aether:swet_spawnable_on' })())
  const edge = (dx, dy, dz) => rule('t', scene({ bes: [new Banner(dx, 64 + dy, dz, 'black_banner', 'swet')] }), 'NATURAL', pos(0, 64, 0), zero)
  ok('a banner exactly 40 blocks away counts, one just past doesn\'t', edge(40, 0, 0) === false && edge(0, -40, 0) === false && edge(40, 1, 0) === true && edge(-41, 0, 0) === true)
  ok('... whatever chunk it\'s in', edge(-40, 0, 0) === false && edge(-24, 24, 20) === false && edge(0, 0, 40) === false && edge(0, 0, -40) === false && edge(0, 0, -41) === true)
  ok('chunks that aren\'t loaded are left alone, not loaded', rule('t', scene({ unloaded: true, bes: [new Banner(1, 64, 1, 'black_banner', 'swet')] }), 'NATURAL', pos(0, 64, 0), zero) === true)
}

// ---------- Aechor Plants ----------
{
  const W = load(); W.fire()
  const rule = W.rules['aether:aechor_plant']
  let differ = 0, yes = 0
  for (let k = 0; k < 2000; k++) {
    const p = pos(k * 16, 64, 0)                                   // a chunk of its own each time
    const s = scene({ grass: rnd() < 0.85, light: between(0, 15), difficulty: rnd() < 0.9 ? 'NORMAL' : 'PEACEFUL', nearFlowers: rnd() < 0.3, enchanted: rnd() < 0.3 })
    const roll = between(0, 9), reason = rnd() < 0.9 ? 'NATURAL' : 'SPAWN_EGG', random = { nextInt: n => (n == 10 ? roll : -1) }
    const mine = rule('t', s, reason, p, random), own = ownPlant('t', s, reason, p, random)
    if (mine !== own) differ++
    if (own) yes++
  }
  ok('2,000 made-up spots in chunks of their own: the same answer as the Aether\'s rule', differ == 0 && yes > 60, differ + ' differ, ' + yes + ' allowed')
  ok('... and it asks about the Aether\'s own ground', (() => { const s = scene({}); rule('t', s, 'NATURAL', pos(900000, 64, 0), zero); return s.s.tag == 'aether:aechor_plant_spawnable_on' })())
  const V = load(); V.fire()
  const r = V.rules['aether:aechor_plant'], at = (x, o) => r('t', scene(o || {}), 'NATURAL', pos(x, 64, 5), zero)
  calls.enchanted = 0
  ok('the big scan runs once for a chunk', at(3) === true && at(9) === true && at(15) === true && calls.enchanted == 1, calls.enchanted)
  ok('... and its answer is remembered: flowers planted since count a little later', at(4, { enchanted: true }) === true && calls.enchanted == 1)
  V.now += 301 * 1000
  ok('... after 5 minutes it looks again', at(4, { enchanted: true }) === false && calls.enchanted == 2)
  ok('another chunk, or another dimension, is asked for itself', at(20) === true && r('t', scene({ dim: 'other:dim' }), 'NATURAL', pos(4, 64, 5), zero) === true && calls.enchanted == 4, calls.enchanted)
  ok('no scan when an earlier condition already refuses', (() => { calls.enchanted = 0; at(500, { light: 3 }); at(520, { grass: false }); at(540, { nearFlowers: true }); r('t', scene({}), 'NATURAL', pos(560, 64, 5), { nextInt: () => 4 }); return calls.enchanted == 0 })())
  for (let k = 0; k < 6100; k++) at(100000 + k * 16)
  ok('what it remembers is bounded', V.global.AetherSpawnFix.stats().scans > 6000 && !V.logs.some(l => /^WARN|^ERR/.test(l)))
}

// ---------- everything else asks the Aether ----------
{
  const W = load(); W.fire()
  const swet = W.rules['aether:golden_swet'], plant = W.rules['aether:aechor_plant']
  calls.swet = calls.plant = 0
  ;['SPAWNER', 'SPAWN_EGG', 'CHUNK_GENERATION', 'EVENT'].forEach(reason => { swet('t', scene({}), reason, pos(0, 64, 0), zero); plant('t', scene({}), reason, pos(0, 64, 0), zero) })
  ok('spawners, eggs and the rest get the Aether\'s own rule', calls.swet == 4 && calls.plant == 4 && W.global.AetherSpawnFix.stats().swets == 0)
  swet('t', scene({}), 'NATURAL', pos(0, 64, 0), zero)
  ok('... natural spawning doesn\'t', calls.swet == 4 && W.global.AetherSpawnFix.stats().swets == 1)
  W.global.AetherSpawnFix.on = false
  swet('t', scene({}), 'NATURAL', pos(0, 64, 0), zero); plant('t', scene({}), 'NATURAL', pos(0, 64, 0), zero)
  ok('global.AetherSpawnFix.on = false: the Aether\'s own rules again', calls.swet == 5 && calls.plant == 5)
  const B = load({ without: ['com.aetherteam.aether.item.EquipmentUtil'] }); B.fire()
  calls.swet = 0
  const s = scene({}), a = B.rules['aether:blue_swet']('t', s, 'NATURAL', pos(0, 64, 0), zero)
  B.rules['aether:blue_swet']('t', s, 'NATURAL', pos(0, 64, 0), zero)
  ok('anything that fails falls back to the Aether\'s rule, with one warning', a === true && calls.swet == 2 && B.logs.filter(l => /^WARN/.test(l)).length == 1 && /EquipmentUtil/.test(B.global.AetherSpawnFix.stats().problem), B.logs.join('|'))
}

console.log(fails ? fails + ' FAILED' : 'ALL PASSED')
