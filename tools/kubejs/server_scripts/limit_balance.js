// Removes the crafting recipes for a set of items for game balance.
// The items themselves still work, so admins can hand them out as rewards.
// Copy to <server>/kubejs/server_scripts/ and run /reload.

const RECIPE_ONLY = [
  // Extra Utilities Reborn
  'extrautilitiesreborn:ender_quarry',
  // Explosives
  'alexscaves:nuclear_bomb',
  'thermal:nuke_tnt',
  'thermal:nuke_tnt_minecart',
  'thermal:nuke_grenade'
]

ServerEvents.recipes(event => {
  RECIPE_ONLY.forEach(id => event.remove({ output: id }))
})
