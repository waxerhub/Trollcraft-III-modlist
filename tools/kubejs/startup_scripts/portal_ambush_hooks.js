// Portal Ambush: Forge event hooks.
//
// Why this is a startup script: in KubeJS 6, raw Forge events (ForgeEvents.onEvent) can only be listened to
// from startup scripts.
//   - LivingChangeTargetEvent      stops a portal_ambush mob picking any target that isn't one of its group's
//                                  targets (other players, villagers, golems, each other, normal piglins)
//   - LivingExperienceDropEvent    removes their XP when ZERO_XP is on in portal_ambush.js
//
// Each hook only passes the event to global.portalAmbushHooks, which server_scripts/factions/portal_ambush.js
// defines, so the logic stays reloadable. They return straight away unless an ambush group is active.
// Restart the server after adding or changing this file (/reload doesn't reload startup scripts).

global.portalAmbushHooksInstalled = 1

function portalAmbushForward(name, event) {
  const h = global.portalAmbushHooks
  if (!h || !h.anyActive) return
  try {
    h[name](event)
  } catch (e) {
    console.error('[PortalAmbush] ' + name + ' hook failed: ' + e)
  }
}

ForgeEvents.onEvent('net.minecraftforge.event.entity.living.LivingChangeTargetEvent', event => portalAmbushForward('onChangeTarget', event))
ForgeEvents.onEvent('net.minecraftforge.event.entity.living.LivingExperienceDropEvent', event => portalAmbushForward('onXpDrop', event))
