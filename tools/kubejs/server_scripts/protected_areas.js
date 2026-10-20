// Stops anyone not on an area's "allowed" list from breaking, placing or right-clicking blocks inside it.
// Operators (permission level 2+) are never blocked.
// Copy to <server>/kubejs/server_scripts/ and run /reload.
// Not covered: explosions, Create drills/saws, pistons, fluids and other block-breaking machines.
// Note: KubeJS 6's script engine (Rhino) has no `template strings`, so join strings with +.

// One entry per area: two opposite corners (x1/y1/z1 and x2/y2/z2) and the usernames allowed in.
// Use real Minecraft usernames, not FTB Essentials nicknames.
const PROTECTED_AREAS = [
  { name: 'Power room', dim: 'minecraft:overworld',
    x1: 90, y1: 50, z1: 190, x2: 110, y2: 80, z2: 210,
    allowed: ['YourUsername', 'TeammateUsername'] },
]

function protectingArea(player, block) {
  if (!player || player.hasPermissions(2)) return null
  const dim = String(block.level.dimension().location())
  const name = String(player.getGameProfile().getName())
  for (const a of PROTECTED_AREAS) {
    if (a.dim != dim || a.allowed.indexOf(name) >= 0) continue
    if (block.x >= Math.min(a.x1, a.x2) && block.x <= Math.max(a.x1, a.x2) &&
        block.y >= Math.min(a.y1, a.y2) && block.y <= Math.max(a.y1, a.y2) &&
        block.z >= Math.min(a.z1, a.z2) && block.z <= Math.max(a.z1, a.z2)) return a
  }
  return null
}

function deny(event) {
  const area = protectingArea(event.player, event.block)
  if (!area) return
  event.player.tell(Text.red(area.name + ' is protected.'))
  event.cancel()
}

BlockEvents.broken(deny)
BlockEvents.placed(deny)
BlockEvents.rightClicked(deny)
