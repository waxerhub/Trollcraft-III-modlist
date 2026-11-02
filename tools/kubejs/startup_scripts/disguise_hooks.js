// Disguise: Forge event hook (see server_scripts/disguise.js and tools/kubejs/DISGUISE.md).
//
// Why this is a startup script: in KubeJS 6, raw Forge events (ForgeEvents.onEvent) can only be listened to
// from startup scripts.
//   - PlayerEvent$NameFormat   while an op is disguised, their display name is the disguise name, so chat, /msg,
//     death and advancement messages, /list and (with tab_nicknames.js) the tab list all show it. FTB Essentials
//     sets nicknames before this (HIGHEST priority); this file loads before factions_hooks.js, and factions_core.js
//     leaves out the faction prefix for a disguised player.
//
// The hook only passes the event to global.disguiseHooks, which server_scripts/disguise.js defines, so the logic
// stays reloadable. It returns straight away when nobody is disguised.
// Restart the server after adding or changing this file (/reload doesn't reload startup scripts).

global.disguiseHooksInstalled = 1

ForgeEvents.onEvent('net.minecraftforge.event.entity.player.PlayerEvent$NameFormat', event => {
  const h = global.disguiseHooks
  if (!h || !h.onNameFormat) return
  try {
    h.onNameFormat(event)
  } catch (e) {
    console.error('[Disguise] name hook: ' + e)
  }
})
