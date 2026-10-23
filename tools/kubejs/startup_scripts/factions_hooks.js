// Factions: Forge event hook.
//
// Why this is a startup script: in KubeJS 6, raw Forge events (ForgeEvents.onEvent) can only be listened to
// from startup scripts, and KubeJS has no "player changed dimension" event of its own.
//   - PlayerEvent$PlayerChangedDimensionEvent   a player arrived in another dimension (portal, /tp, mods).
//     It only fires once the trip has happened, so portals blocked by nether_portal_whitelist.js and trips
//     cancelled by pig_escort.js never reach it.
//
// The hook only passes the event to global.factionsHooks, which server_scripts/factions/factions_core.js
// defines, so all the logic stays reloadable.
// Restart the server after adding or changing this file (/reload doesn't reload startup scripts).

global.factionsHooksInstalled = 1

ForgeEvents.onEvent('net.minecraftforge.event.entity.player.PlayerEvent$PlayerChangedDimensionEvent', event => {
  const h = global.factionsHooks
  if (!h) return
  try {
    h.onChangedDimension(event)
  } catch (e) {
    console.error('[Factions] dimension hook failed: ' + e)
  }
})
