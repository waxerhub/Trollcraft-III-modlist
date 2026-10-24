// Stops Nether portals from lighting anywhere except the areas listed below.
// Copy to <server>/kubejs/startup_scripts/ and restart (startup scripts don't reload with /reload).
// Portals already lit keep working until broken - find them with tools/find_portals.py.
// Switched off (every portal allowed) by the Pig Escort finale, or by hand with /pigescort nether unlock;
// /pigescort nether lock switches it back on. The switch is saved with the world.
// Note: KubeJS 6's script engine (Rhino) has no `template strings`, so join strings with +.

// One entry per allowed portal: dimension, centre of the portal, and how many blocks around it count.
const ALLOWED_PORTALS = [
  { dim: 'minecraft:overworld',  x: 100, y: 64, z: 200, r: 8 },
  { dim: 'minecraft:the_nether', x: 12,  y: 70, z: 25,  r: 8 },
]

// Dimension ID of a level. KubeJS renames Minecraft's level.dimension() to getDimensionKey() and adds its own
// `dimension` getter, so this tries each form.
function portalWhitelistDimension(level) {
  let d = level.dimension
  if (typeof d == 'function') d = level.dimension()
  else if (d == null && typeof level.getDimensionKey == 'function') d = level.getDimensionKey()
  if (d != null && typeof d.location == 'function') d = d.location()
  return String(d)
}

// True once the whitelist has been switched off: global.netherPortalsUnlocked (set by pig_escort.js) or the
// saved 'trollcraft_nether_unlocked' flag, which survives restarts.
function portalWhitelistUnlocked(event) {
  if (global.netherPortalsUnlocked === true) return true
  try {
    let server = event.getLevel().getServer()
    if (server == null) server = Utils.server
    return server != null && !!server.persistentData.getBoolean('trollcraft_nether_unlocked')
  } catch (e) {
    if (!global.portalWhitelistUnlockError) console.error('Nether portal whitelist: could not read the unlock switch (whitelist stays on): ' + e)
    global.portalWhitelistUnlockError = true
    return false
  }
}

ForgeEvents.onEvent('net.minecraftforge.event.level.BlockEvent$PortalSpawnEvent', event => {
  if (portalWhitelistUnlocked(event)) return
  const pos = event.getPos()
  let dim = 'unknown'
  let allowed = false
  try {
    dim = portalWhitelistDimension(event.getLevel())
    allowed = ALLOWED_PORTALS.some(a => a.dim == dim &&
      Math.abs(pos.x - a.x) <= a.r && Math.abs(pos.y - a.y) <= a.r && Math.abs(pos.z - a.z) <= a.r)
  } catch (e) {
    // If anything goes wrong, block the portal rather than let it through.
    console.error('Nether portal whitelist error (portal blocked): ' + e)
  }
  if (!allowed) {
    event.setCanceled(true)
    console.info('Blocked Nether portal at ' + dim + ' ' + pos.x + ' ' + pos.y + ' ' + pos.z)
  }
})
