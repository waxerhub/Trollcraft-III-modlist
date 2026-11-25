// Refreshes the tab player list so FTB Essentials nicknames show up (see startup_scripts/tab_nicknames.js).
// Runs when someone joins, and just after /nickname, /nicknamefor or /recording.
// Copy to <server>/kubejs/server_scripts/ and run /reload.

(function () {

const NICK_COMMANDS = ['nickname', 'nicknamefor', 'recording']

function refreshAll(server) {
  const players = server.players
  for (let i = 0; i < players.size(); i++) {
    try {
      players.get(i).refreshTabListName()
    } catch (e) {
      console.error('[TabNicknames] ' + e)
      return
    }
  }
}

// Wait a moment so FTB Essentials has finished applying the change first.
function refreshSoon(server, ticks) {
  server.scheduleInTicks(ticks, () => refreshAll(server))
}

PlayerEvents.loggedIn(event => refreshSoon(event.server, 20))

ServerEvents.command(event => {
  if (NICK_COMMANDS.indexOf(String(event.getCommandName())) >= 0) refreshSoon(event.server, 2)
})

// After a /reload, refresh anyone already online.
if (Utils.server) refreshSoon(Utils.server, 1)

})()
