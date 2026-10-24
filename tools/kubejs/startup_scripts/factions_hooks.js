// Factions: Forge event hooks.
//
// Why this is a startup script: in KubeJS 6, raw Forge events (ForgeEvents.onEvent) can only be listened to
// from startup scripts, and KubeJS has no "player changed dimension" event of its own.
//   - PlayerEvent$PlayerChangedDimensionEvent   a player arrived in another dimension (portal, /tp, mods).
//     It only fires once the trip has happened, so portals blocked by nether_portal_whitelist.js and trips
//     cancelled by pig_escort.js never reach it.
//   - PlayerEvent$NameFormat   puts a public faction's rank prefix in front of the player's display name, so
//     chat reads "[Enforcer] <Goruk> hi". FTB Essentials sets nicknames before this (HIGHEST priority) and
//     adds its recording icon after it (LOWEST); KubeJS listens at NORMAL, in between.
//
// The hooks only pass the events to global.factionsHooks, which server_scripts/factions/factions_core.js
// defines, so all the logic stays reloadable.
// Restart the server after adding or changing this file (/reload doesn't reload startup scripts).

global.factionsHooksInstalled = 1
global.factionsNameHookInstalled = 1

ForgeEvents.onEvent('net.minecraftforge.event.entity.player.PlayerEvent$PlayerChangedDimensionEvent', event => {
  const h = global.factionsHooks
  if (!h) return
  try {
    h.onChangedDimension(event)
  } catch (e) {
    console.error('[Factions] dimension hook failed: ' + e)
  }
})

ForgeEvents.onEvent('net.minecraftforge.event.entity.player.PlayerEvent$NameFormat', event => {
  const h = global.factionsHooks
  if (!h || !h.onNameFormat) return
  try {
    h.onNameFormat(event)
  } catch (e) {
    console.error('[Factions] name hook failed: ' + e)
  }
})
