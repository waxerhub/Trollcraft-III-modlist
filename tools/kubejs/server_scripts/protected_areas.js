// Stops anyone not on an area's "allowed" list from breaking, placing or right-clicking blocks inside it.
// Operators (permission level 2+) are never blocked.
// Copy to <server>/kubejs/server_scripts/ and run /reload.
// Not covered: explosions, Create drills/saws, pistons, fluids and other block-breaking machines.
// Note: KubeJS 6's script engine (Rhino) has no `template strings`, so join strings with +.

// One entry per area: two opposite corners (x1/y1/z1 and x2/y2/z2) and the usernames allowed in.
// Use real Minecraft usernames, not FTB Essentials nicknames.
// spawnRadius: N instead of corners protects every block within N of the world spawn (x and z, any height): the same
// square as vanilla's spawn-protection=N. With spawn-protection=0 in server.properties, this replaces vanilla spawn
// protection and lets the allowed players build there without being operators.
// allowUse: true lets everyone right-click blocks there (doors, buttons, levers, chests) while only the allowed
// players can break or place. Buckets, flint and steel and fire charges stay blocked (USE_BLOCKED_ITEMS).
// (Not wrapped in a function on purpose: black_market.js reads PROTECTED_AREAS so Disguised TNT breaks nothing here.)
const PROTECTED_AREAS = [
  { name: 'Power room', dim: 'minecraft:overworld',
    x1: 90, y1: 50, z1: 190, x2: 110, y2: 80, z2: 210,
    allowed: ['YourUsername', 'TeammateUsername'] },
  // Part II: spawn, kept by the Castellan. Set spawn-protection=0 in server.properties, put the old value as
  // spawnRadius, check her username, then remove the //. Everyone can still use doors, buttons and chests there.
  // { name: 'Spawn', dim: 'minecraft:overworld', spawnRadius: 16, allowed: ['KitKat'], allowUse: true },
  // Or just the castle by its corners:
  // { name: 'The Castle', dim: 'minecraft:overworld',
  //   x1: 0, y1: 60, z1: 0, x2: 0, y2: 120, z2: 0,
  //   allowed: ['CastellanUsername'], allowUse: true },
]
// Items that still can't be used on blocks in an allowUse area (they'd place fluids or fire).
const USE_BLOCKED_ITEMS = ['minecraft:flint_and_steel', 'minecraft:fire_charge']

// The world spawn (x, z), read live so it follows /setworldspawn.
function protectedAreasSpawn() {
  try {
    let server = Utils.server
    let ow = typeof server.overworld == 'function' ? server.overworld() : server.overworld
    let p = ow.getSharedSpawnPos()
    return { x: Number(p.getX()), z: Number(p.getZ()) }
  } catch (e) { return null }
}

function protectingArea(player, block) {
  if (!player || player.hasPermissions(2)) return null
  const dim = String(block.getDimension())
  const name = String(player.getGameProfile().getName())
  for (let a of PROTECTED_AREAS) {
    if (a.dim != dim || a.allowed.indexOf(name) >= 0) continue
    if (a.spawnRadius != null) {
      let sp = protectedAreasSpawn()
      if (sp && Math.abs(block.x - sp.x) <= a.spawnRadius && Math.abs(block.z - sp.z) <= a.spawnRadius) return a
      continue
    }
    if (block.x >= Math.min(a.x1, a.x2) && block.x <= Math.max(a.x1, a.x2) &&
        block.y >= Math.min(a.y1, a.y2) && block.y <= Math.max(a.y1, a.y2) &&
        block.z >= Math.min(a.z1, a.z2) && block.z <= Math.max(a.z1, a.z2)) return a
  }
  return null
}

function heldId(event) {
  let item = null
  try { item = event.item } catch (e) { }
  if (!item) { try { item = event.player.mainHandItem } catch (e) { } }
  if (!item || item.isEmpty()) return ''
  return String(item.id)
}
function useAllowed(area, event) {
  if (!area.allowUse) return false
  const id = heldId(event)
  return !(id && (USE_BLOCKED_ITEMS.indexOf(id) >= 0 || /bucket/.test(id)))
}

function deny(event, use) {
  const area = protectingArea(event.player, event.block)
  if (!area) return
  if (use && useAllowed(area, event)) return
  event.player.tell(Text.red(area.name + ' is protected.'))
  event.cancel()
}

BlockEvents.broken(event => deny(event, false))
BlockEvents.placed(event => deny(event, false))
BlockEvents.rightClicked(event => deny(event, true))
