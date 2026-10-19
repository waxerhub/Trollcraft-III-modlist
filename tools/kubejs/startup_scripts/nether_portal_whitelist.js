// Stops Nether portals from lighting anywhere except the areas listed below.
// Copy to <server>/kubejs/startup_scripts/ and restart (startup scripts don't reload with /reload).
// Portals already lit keep working until broken - find them with tools/find_portals.py.

// One entry per allowed portal: dimension, centre of the portal, and how many blocks around it count.
const ALLOWED_PORTALS = [
  { dim: 'minecraft:overworld',  x: 100, y: 64, z: 200, r: 8 },
  { dim: 'minecraft:the_nether', x: 12,  y: 70, z: 25,  r: 8 },
]

ForgeEvents.onEvent('net.minecraftforge.event.level.BlockEvent$PortalSpawnEvent', event => {
  const pos = event.getPos()
  const dim = String(event.getLevel().dimension().location())
  const allowed = ALLOWED_PORTALS.some(a => a.dim == dim &&
    Math.abs(pos.x - a.x) <= a.r && Math.abs(pos.y - a.y) <= a.r && Math.abs(pos.z - a.z) <= a.r)
  if (!allowed) {
    event.setCanceled(true)
    console.info(`Blocked Nether portal at ${dim} ${pos.x} ${pos.y} ${pos.z}`)
  }
})
