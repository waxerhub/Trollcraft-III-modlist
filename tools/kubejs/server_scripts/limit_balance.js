// Removes the crafting recipes for a set of items for game balance.
// The items themselves still work, so admins can hand them out as rewards.
// Copy to <server>/kubejs/server_scripts/ and run /reload.

const RECIPE_ONLY = [
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
  // Explosives
  'alexscaves:nuclear_bomb',
  'thermal:nuke_tnt',
  'thermal:nuke_tnt_minecart',
  'thermal:nuke_grenade',
  'projecte:nova_cataclysm'
]

ServerEvents.recipes(event => {
  RECIPE_ONLY.forEach(id => event.remove({ output: id }))
})
