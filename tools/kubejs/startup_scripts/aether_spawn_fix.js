// The Aether's spawn checks, without their block scans (see tools/kubejs/AETHER_SPAWN_FIX.md).
//
// The Aether (1.5.2) looks at every block in a ball of radius 40, about 268,000 of them, each time a Swet could spawn (for
// a Swet banner) and one time in ten for an Aechor Plant (for flowers on enchanted grass). With nine players spread over
// the Aether those two scans were half of the server's tick there (test server, 25 November 2026).
//
// This gives both creatures the same rules without the scans:
//   - Swets: banners are block entities, so only the block entities of the chunks around are looked at. Same result.
//   - Aechor Plants: the Aether's own scan, but its answer is remembered for the chunk for FLOWER_SECONDS.
// Only natural spawning goes through this; anything else (spawners, eggs) asks the Aether's own rule, as does anything
// that goes wrong here.
//
// Server only (it does nothing on a player's game). Restart the server after adding or changing this file.
// Nothing here may log with console.error while the game starts: KubeJS would refuse to start the server.
// KubeJS 6 (Rhino): no template strings; `let` inside nested blocks.

(function () {

// ===================== SETTINGS =====================

const RADIUS = 40                 // the Aether's own distance for banners, armour stands with a Swet Cape, and enchanted flowers
const NEAR_RADIUS = 10            // the Aether's own distance for flowers near an Aechor Plant
const LIGHT = 8                   // the Aether's own: brighter than this
const BANNER = 'Block{minecraft:black_banner}'   // the Aether's own: a Swet banner is a standing black one with its pattern
const FLOWER_SECONDS = 300        // how long a chunk's answer about enchanted flowers is remembered
const REMEMBER_AT_MOST = 6000     // chunks

const STATS = { registered: 0, swets: 0, plants: 0, scans: 0, problem: '' }
global.AetherSpawnFix = { stats: () => STATS, on: true }


// ===================== CLASSES =====================

let client = false
try { client = !!Platform.isClientEnvironment() } catch (e) { client = false }
let loaded = false
try { loaded = !!Platform.isLoaded('aether') } catch (e) { loaded = false }
if (client || !loaded) return

let missing = ''
function load(name) { try { return Java.loadClass(name) } catch (e) { missing = missing || name; return null } }

const Operation = load('net.minecraftforge.event.entity.SpawnPlacementRegisterEvent$Operation')
const ForgeRegistries = load('net.minecraftforge.registries.ForgeRegistries')
const ResourceLocation = load('net.minecraft.resources.ResourceLocation')
const AABB = load('net.minecraft.world.phys.AABB')
const ArmorStand = load('net.minecraft.world.entity.decoration.ArmorStand')
const BannerEntity = load('net.minecraft.world.level.block.entity.BannerBlockEntity')

// The Aether's own classes, loaded when they are first needed (not while the game is still putting mods together).
const A = { swet: null, plant: null, blocks: null, equipment: null, pattern: null, ready: false }
function aether() {
  if (A.ready) return A
  A.swet = Java.loadClass('com.aetherteam.aether.entity.monster.Swet')
  A.plant = Java.loadClass('com.aetherteam.aether.entity.monster.AechorPlant')
  A.blocks = Java.loadClass('com.aetherteam.aether.block.AetherBlocks')
  A.equipment = Java.loadClass('com.aetherteam.aether.item.EquipmentUtil')
  A.pattern = A.blocks.SWET_BANNER_PATTERN.toListTag()
  A.ready = true
  return A
}
function problem(where, e) {
  if (!STATS.problem) console.warn('[AetherSpawnFix] ' + where + ' failed, so the Aether\'s own rule is used: ' + e)
  STATS.problem = where + ': ' + e
}


// ===================== THE RULES =====================

// What both rules ask first: the right ground, enough light, not peaceful.
function groundAndLight(level, pos, tag) {
  return level.getBlock(pos.below()).hasTag(tag) && Number(level.getRawBrightness(pos, 0)) > LIGHT && String(level.getDifficulty()) != 'PEACEFUL'
}
// A Swet banner within RADIUS.
function swetBannerNear(level, pos) {
  const px = Number(pos.getX()), py = Number(pos.getY()), pz = Number(pos.getZ()), source = level.getChunkSource()
  for (let cx = (px - RADIUS) >> 4; cx <= (px + RADIUS) >> 4; cx++) {
    for (let cz = (pz - RADIUS) >> 4; cz <= (pz + RADIUS) >> 4; cz++) {
      let chunk = source.getChunkNow(cx, cz)
      if (chunk == null) continue
      let map = chunk.getBlockEntities()
      if (map.isEmpty()) continue
      let it = map.values().iterator()
      while (it.hasNext()) {
        let be = it.next()
        if (!(be instanceof BannerEntity)) continue
        let p = be.getBlockPos(), dx = Number(p.getX()) - px, dy = Number(p.getY()) - py, dz = Number(p.getZ()) - pz
        if (dx * dx + dy * dy + dz * dz > RADIUS * RADIUS) continue
        if (String(be.getBlockState().getBlock()) != BANNER) continue
        if (A.pattern.equals(BannerEntity.getItemPatterns(be.getItem()))) return true
      }
    }
  }
  return false
}
// An armour stand wearing a Swet Cape.
function swetCapeNear(level, pos) {
  const box = AABB.ofSize(pos.getCenter(), 2 * RADIUS, 2 * RADIUS, 2 * RADIUS)
  return !!level.getEntitiesOfClass(ArmorStand, box).stream().anyMatch(s => A.equipment.hasSwetCape(s))
}
function swetMaySpawn(level, pos) {
  return groundAndLight(level, pos, 'aether:swet_spawnable_on') && !swetBannerNear(level, pos) && !swetCapeNear(level, pos)
}

const flowers = {}        // 'dimension chunkX chunkZ' -> [when, answer]
let flowerCount = 0
function enchantedFlowersNear(level, pos) {
  const now = Date.now()
  const key = String(level.dimension) + ' ' + (Number(pos.getX()) >> 4) + ' ' + (Number(pos.getZ()) >> 4)
  const known = flowers[key]
  if (known && now - known[0] < FLOWER_SECONDS * 1000) return known[1]
  if (!known) flowerCount++
  if (flowerCount > REMEMBER_AT_MOST) { Object.keys(flowers).forEach(k => { delete flowers[k] }); flowerCount = 1 }
  STATS.scans++
  const answer = !!A.plant.inRadiusOfEnchantedFlowers(level, pos, RADIUS)
  flowers[key] = [now, answer]
  return answer
}
function plantMaySpawn(level, pos, random) {
  return groundAndLight(level, pos, 'aether:aechor_plant_spawnable_on') && Number(random.nextInt(10)) == 0 &&
    !A.plant.inRadiusOfFlowers(level, pos, NEAR_RADIUS) && !enchantedFlowersNear(level, pos)
}

function natural(reason) { return String(reason) == 'NATURAL' && global.AetherSpawnFix.on }

const swetRule = (type, level, reason, pos, random) => {
  if (natural(reason)) {
    try { aether(); STATS.swets++; return swetMaySpawn(level.getLevel(), pos) } catch (e) { problem('the Swets\' rule', e) }
  }
  return Java.loadClass('com.aetherteam.aether.entity.monster.Swet').checkSwetSpawnRules(type, level, reason, pos, random)
}
const plantRule = (type, level, reason, pos, random) => {
  if (natural(reason)) {
    try { aether(); STATS.plants++; return plantMaySpawn(level.getLevel(), pos, random) } catch (e) { problem('the Aechor Plants\' rule', e) }
  }
  return Java.loadClass('com.aetherteam.aether.entity.monster.AechorPlant').checkAechorPlantSpawnRules(type, level, reason, pos, random)
}


// ===================== REPLACING THEM =====================

if (missing) {
  console.warn('[AetherSpawnFix] ' + missing + ' wasn\'t found: the Aether\'s own rules stay')
} else {
  // Forge asks every mod for its spawn rules, in load order. REPLACE fails if the Aether hasn't registered its own yet.
  ForgeModEvents.onEvent('net.minecraftforge.event.entity.SpawnPlacementRegisterEvent', event => {
    ;[['aether:blue_swet', swetRule], ['aether:golden_swet', swetRule], ['aether:aechor_plant', plantRule]].forEach(r => {
      try {
        event.register(ForgeRegistries.ENTITY_TYPES.getValue(new ResourceLocation(r[0])), r[1], Operation.REPLACE)
        STATS.registered++
      } catch (e) {
        console.warn('[AetherSpawnFix] ' + r[0] + ' keeps the Aether\'s own rule: ' + e)
      }
    })
    console.info('[AetherSpawnFix] ' + STATS.registered + ' of 3 spawn rules replaced')
  })
}

})()
