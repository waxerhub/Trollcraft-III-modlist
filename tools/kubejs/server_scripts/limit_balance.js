// Disables a set of ProjectE / Extra Utilities Reborn items for game balance.
// Copy to <server>/kubejs/server_scripts/ and run /reload.
// Note: KubeJS 6's script engine (Rhino) has no `template strings`, so join strings with +.

const DISABLED_ITEMS = [
  // ProjectE EMC factory top tiers
  'projecte:condenser_mk2',
  'projecte:collector_mk3',
  'projecte:relay_mk3',
  // ProjectE items
  'projecte:watch_of_flowing_time',
  'projecte:swiftwolf_rending_gale', // also makes the Ring of Arcana uncraftable (it's an ingredient)
  'projecte:rm_helmet', 'projecte:rm_chestplate', 'projecte:rm_leggings', 'projecte:rm_boots',
  'projecte:gem_helmet', 'projecte:gem_chestplate', 'projecte:gem_leggings', 'projecte:gem_boots',
  // Extra Utilities Reborn
  'extrautilitiesreborn:ender_quarry',
  'extrautilitiesreborn:chunk_loading_ward', // has no recipe in this version; listed so placing/holding it is blocked too
  // Explosives
  'alexscaves:nuclear_bomb',
  'thermal:nuke_tnt',
  'thermal:nuke_tnt_minecart',
  'thermal:nuke_grenade',
  'projecte:nova_cataclysm'
]

// 1. Nobody can craft them
ServerEvents.recipes(event => {
  DISABLED_ITEMS.forEach(id => event.remove({ output: id }))
})

// 2. Existing ones can't be placed or used
BlockEvents.placed(event => {
  if (DISABLED_ITEMS.indexOf(String(event.block.id)) >= 0) event.cancel()
})
ItemEvents.rightClicked(event => {
  if (DISABLED_ITEMS.indexOf(String(event.item.id)) >= 0) {
    event.player.tell(Text.red('That item is disabled on this server.'))
    event.cancel()
  }
})

// 3. Remove them from inventories on login (armor, Swiftwolf and the Watch work just by being carried)
PlayerEvents.loggedIn(event => {
  DISABLED_ITEMS.forEach(id => {
    event.server.runCommandSilent('clear ' + event.player.username + ' ' + id)
  })
})
