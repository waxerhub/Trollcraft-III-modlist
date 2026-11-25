// =====================================================================
//  refined_obsidian_repellent.js  (KubeJS 6, Forge 1.20.1)
//  Place in: kubejs/server_scripts/refined_obsidian_repellent.js
//
//  1. Makes Refined Obsidian armor, tools, weapons and shield (Mekanism Tools)
//     cost Refined Obsidian BLOCKS instead of ingots. Same crafting shapes,
//     9x the cost.
//  2. Handles the Repellent enchantment (Ender IO) in one of two ways,
//     chosen with REPELLENT_MODE below:
//
//     'players_immune' (default)
//        Repellent still works against mobs, but PLAYERS are never
//        teleported by it. If a player hits someone wearing Repellent and
//        gets teleported, they are put right back where they were.
//
//     'remove'
//        Repellent is removed from the game: its enchanter recipe is
//        deleted, and ANY item or book carrying it is deleted the moment it
//        enters a player's inventory (covers enchanting tables, villagers,
//        loot, anvils, and old items). The player is told once, not spammed.
//
//  Event-driven only: nothing runs on a timer or every tick.
//  To undo: delete this file and run /reload.
// =====================================================================

// Wrapped in a function so its names can't clash with other KubeJS scripts
// (KubeJS 6 shares one scope across all server scripts).
;(function () {

// ---------------- SETTINGS ----------------

const REPELLENT_MODE = 'remove'   // 'remove' (Repellent disabled) or 'players_immune'

// The enchantment ID. VERIFY THIS (see notes at the bottom).
const REPELLENT_ID = 'enderio:repellent'

// Refined Obsidian gear whose recipes are changed from ingots to blocks.
// (The Paxel isn't listed: it's crafted from the axe, pickaxe and shovel,
// so it gets more expensive automatically.)
const GEAR = [
  // armor
  'mekanismtools:refined_obsidian_helmet',
  'mekanismtools:refined_obsidian_chestplate',
  'mekanismtools:refined_obsidian_leggings',
  'mekanismtools:refined_obsidian_boots',
  // tools and weapons
  'mekanismtools:refined_obsidian_sword',
  'mekanismtools:refined_obsidian_pickaxe',
  'mekanismtools:refined_obsidian_axe',
  'mekanismtools:refined_obsidian_shovel',
  'mekanismtools:refined_obsidian_hoe',
  // shield (delete this line to leave it on ingots)
  'mekanismtools:refined_obsidian_shield'
]

// What the armor recipes use instead of ingots. VERIFY THESE IDs (see notes).
const INGOT_ITEM = 'mekanism:ingot_refined_obsidian'
const INGOT_TAG = '#forge:ingots/refined_obsidian'
const BLOCK_ITEM = 'mekanism:block_refined_obsidian'

// players_immune mode: how far (in blocks) a player must have moved in one
// tick after hitting a Repellent wearer to count as "repelled"
const TELEPORT_DETECT_DISTANCE = 3

const WARNING_ENCHANT = '[MINISTRY] Items carrying the Repellent enchantment are contraband and have been confiscated.'

// The warning is shown at most once per player in this many seconds,
// no matter how many items are confiscated in that time.
const WARNING_COOLDOWN_SECONDS = 30

// ------------------------------------------

// ---------- RECIPES ----------
ServerEvents.recipes(event => {
  // Swap ingots for blocks in each gear recipe (keeps the original shape).
  // Both the item and the tag are replaced, since the recipe may use either.
  GEAR.forEach(id => {
    event.replaceInput({ output: id }, INGOT_ITEM, BLOCK_ITEM)
    event.replaceInput({ output: id }, INGOT_TAG, BLOCK_ITEM)
  })

  if (REPELLENT_MODE === 'remove') {
    // Ender IO's enchanter recipe for Repellent (matches either spelling)
    event.remove({ id: /repell[ae]nt/ })
  }
})

// ---------- HELPERS ----------
// Note: KubeJS replaces ItemStack.hasTag() with its own item-TAG check, so NBT is
// read through stack.nbt instead (null when the item has no NBT).
const nbtOf = (stack) => {
  if (!stack || stack.isEmpty()) return null
  try { return stack.nbt } catch (e) { return null }
}

const hasEnchant = (stack, id) => {
  const tag = nbtOf(stack)
  if (!tag || !tag.contains('Enchantments')) return false
  const list = tag.getList('Enchantments', 10)
  for (let i = 0; i < list.size(); i++) {
    if (String(list.getCompound(i).getString('id')) === id) return true
  }
  return false
}

const wearsRepellent = (entity) => {
  if (!entity || !entity.isLiving()) return false
  const it = entity.getArmorSlots().iterator()
  while (it.hasNext()) {
    if (hasEnchant(it.next(), REPELLENT_ID)) return true
  }
  return false
}

// true if the item carries Repellent, as an enchantment (gear) or stored on a book
const hasRepellent = (stack) => {
  const tag = nbtOf(stack)
  if (!tag) return false
  const keys = ['Enchantments', 'StoredEnchantments']
  for (let k = 0; k < keys.length; k++) {
    if (!tag.contains(keys[k])) continue
    let list = tag.getList(keys[k], 10)   // let: a const inside a loop can fail under Rhino
    for (let i = 0; i < list.size(); i++) {
      if (String(list.getCompound(i).getString('id')) === REPELLENT_ID) return true
    }
  }
  return false
}

// Deletes the stack. Returns true if it was a Repellent item.
const confiscate = (stack) => {
  if (!hasRepellent(stack)) return false
  stack.shrink(stack.count)
  return true
}

// One warning per player per cooldown, however many items are taken.
const lastWarned = {}
const warnOnce = (player) => {
  const id = String(player.username)
  const now = Date.now()
  if (lastWarned[id] && now - lastWarned[id] < WARNING_COOLDOWN_SECONDS * 1000) return
  lastWarned[id] = now
  player.tell(Text.red(WARNING_ENCHANT))
}

// ---------- MODE: players_immune ----------
// When a player damages someone wearing Repellent, remember where the player
// was. One tick later, if they've been flung away, put them back.
EntityEvents.hurt(event => {
  if (REPELLENT_MODE !== 'players_immune') return

  // KubeJS 6 calls the attacking entity "actual" (Minecraft's getEntity isn't exposed).
  // Damage with no attacker (falling, suffocating, fire...) has none, so it's skipped here.
  let attacker = null
  try { attacker = event.source.actual } catch (e) { return }
  if (!attacker || !attacker.isPlayer()) return
  if (!wearsRepellent(event.entity)) return

  const x = attacker.x, y = attacker.y, z = attacker.z
  const dim = String(attacker.level.dimension)
  const yaw = attacker.yaw, pitch = attacker.pitch

  attacker.server.scheduleInTicks(1, () => {
    if (!attacker.isAlive()) return
    if (String(attacker.level.dimension) !== dim) return
    const dx = attacker.x - x, dy = attacker.y - y, dz = attacker.z - z
    if (Math.sqrt(dx * dx + dy * dy + dz * dz) >= TELEPORT_DETECT_DISTANCE) {
      attacker.teleportTo(x, y, z)
      attacker.setRotation(yaw, pitch)
      attacker.resetFallDistance()
    }
  })
})

// ---------- MODE: remove ----------
// Minecraft hands this event a COPY of the changed item, so deleting event.item
// does nothing to the real one. Instead, the copy is only used to notice a
// Repellent item arrived, and then the player's real inventory is swept.
const sweepPlayer = (player) => {
  let found = false

  const inv = player.inventory
  for (let i = 0; i < inv.containerSize; i++) {
    if (confiscate(inv.getItem(i))) found = true
  }

  // the item held on the mouse cursor while an inventory screen is open
  try {
    if (confiscate(player.containerMenu.getCarried())) found = true
  } catch (e) { }

  return found
}

PlayerEvents.inventoryChanged(event => {
  if (REPELLENT_MODE !== 'remove') return
  if (!hasRepellent(event.item)) return
  if (sweepPlayer(event.player)) warnOnce(event.player)
})

// One sweep on login: inventory and ender chest
PlayerEvents.loggedIn(event => {
  if (REPELLENT_MODE !== 'remove') return
  const player = event.player
  let found = sweepPlayer(player)

  const ender = player.enderChestInventory
  for (let i = 0; i < ender.containerSize; i++) {
    if (confiscate(ender.getItem(i))) found = true
  }

  if (found) warnOnce(player)
})

// ---------------------------------------------------------------------
// NOTES
// - Verify the enchantment ID: hold an item with Repellent and run
//     /data get entity @s SelectedItem
//   and look for the id inside "Enchantments". If it isn't
//   "enderio:repellent", change REPELLENT_ID above.
// - Verify the armor, ingot, and block IDs: press F3+H in-game to show item
//   IDs in tooltips. After /reload, check the new recipes in JEI.
// - Mekanism Tools can make mobs spawn wearing its armor. To stop Refined
//   Obsidian armor appearing on mobs, check config/Mekanism/tools.toml for
//   the mob armor spawn settings.
// ---------------------------------------------------------------------

})()
