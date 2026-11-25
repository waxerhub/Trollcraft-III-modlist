// Shows FTB Essentials nicknames in the tab player list, without players needing FTB Essentials installed.
// FTB Essentials only updates the tab list from the client side, so on clients without the mod the tab list
// keeps showing real usernames. This sets each player's tab-list name to their server-side display name,
// which already includes the nickname (and team colour/prefix).
// Pair with server_scripts/tab_nicknames.js, which refreshes the list when a nickname changes.
// Copy to <server>/kubejs/startup_scripts/ and restart the server.

ForgeEvents.onEvent('net.minecraftforge.event.entity.player.PlayerEvent$TabListNameFormat', event => {
  try {
    event.setDisplayName(event.getEntity().getDisplayName())
  } catch (e) {
    console.error('[TabNicknames] ' + e)
  }
})
