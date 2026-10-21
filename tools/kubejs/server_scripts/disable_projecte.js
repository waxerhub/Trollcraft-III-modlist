// Temporarily switches ProjectE off without deleting anyone's items.
// Applied Energistics 2 (ME systems) and its AppliedE addon are not touched.
//  - Removes every ProjectE crafting recipe
//  - Stops ProjectE blocks from being placed or opened (tables, condensers, collectors, relays, pedestals...)
//  - Stops ProjectE items from being right-clicked (Transmutation Tablet, Philosopher's Stone, rings, catalysts...)
// Alchemical Chests and Alchemical Bags stay usable so nobody is locked out of their stored items.
// Copy to <server>/kubejs/server_scripts/ and run /reload. To turn ProjectE back on, delete this file and /reload.
// Pair it with the EMC switch-off in config/ProjectE/mapping.toml, or EMC already stored in Klein Stars
// can still power keybind abilities and passive ring effects, which KubeJS can't block.
// Note: KubeJS 6's script engine (Rhino) has no `template strings`, so join strings with +.

const DISABLED_MODS = ['projecte']

// Still allowed, so players can get their stored items out
const STILL_ALLOWED = [/^projecte:alchemical_chest$/, /^projecte:.*_alchemical_bag$/]

// true = operators (permission level 2+) can still use ProjectE, e.g. for testing or handing out rewards
const OPS_BYPASS = false

const MESSAGE = 'ProjectE is disabled for now.'

function isDisabled(id) {
  id = String(id)
  if (DISABLED_MODS.indexOf(id.split(':')[0]) < 0) return false
  return !STILL_ALLOWED.some(re => re.test(id))
}

function blocked(event, id) {
  if (!isDisabled(id)) return false
  const player = event.player
  if (player && OPS_BYPASS && player.hasPermissions(2)) return false
  if (player) player.setStatusMessage(Text.red(MESSAGE))
  event.cancel()
  return true
}

ServerEvents.recipes(event => {
  DISABLED_MODS.forEach(mod => {
    event.remove({ mod: mod })
    event.remove({ output: '@' + mod })
  })
})

// Right-clicking with a ProjectE item in the air (Transmutation Tablet, rings, amulets...)
ItemEvents.rightClicked(event => { blocked(event, event.item.id) })

// Right-clicking a mob or player with a ProjectE item
ItemEvents.entityInteracted(event => { blocked(event, event.item.id) })

// Opening a ProjectE block, or using a ProjectE item on any block (Philosopher's Stone, catalysts...)
BlockEvents.rightClicked(event => {
  if (blocked(event, event.block.id)) return
  blocked(event, event.item.id)
})

// Placing ProjectE blocks
BlockEvents.placed(event => { blocked(event, event.block.id) })
