// Enchanted Porkchop: a glowing porkchop crafted from two FULL stacks of porkchops (64 + 64), meant as an
// expensive crafting ingredient.
//
// Crafting: put a full stack of porkchops in any two crafting slots (table or inventory grid). The result
// only appears when both stacks are full, and taking it uses up both whole stacks. Machines that craft one
// item per slot (AE2, Create, ...) can't make it.
//
// The item is a vanilla cooked porkchop with a name, lore, the enchantment glint and a unique NBT tag:
//     TrollcraftItem: "enchanted_porkchop"
// Eating it is blocked (CAN_BE_EATEN below), so nobody swallows 128 porkchops by accident.
//
// Using it in other recipes: match the unique tag, not the whole item, so name or lore changes don't break
// anything. In any server script's ServerEvents.recipes:
//     const ENCHANTED_PORKCHOP = Item.of('minecraft:cooked_porkchop', '{TrollcraftItem:"enchanted_porkchop"}').weakNBT()
//     event.shaped('minecraft:netherite_ingot', ['PPP', 'PGP', 'PPP'], { P: ENCHANTED_PORKCHOP, G: 'minecraft:gold_block' })
// (weakNBT = "has at least this NBT". A plain 'minecraft:cooked_porkchop' would also accept normal porkchops.)
//
// Copy to <server>/kubejs/server_scripts/ and run /reload.
// Note: KubeJS 6's script engine (Rhino) has no `template strings`, so strings are joined with +.

(function () {

// ===================== SETTINGS =====================

const INPUT = 'minecraft:porkchop'   // raw porkchops; use 'minecraft:cooked_porkchop' for cooked ones
const PER_SLOT = 64                  // each of the two slots must hold this many (64 = a full stack)
const CAN_BE_EATEN = false           // true = it can be eaten like a normal porkchop
const RECIPE_ID = 'trollcraft:enchanted_porkchop'
const ACTION_ID = 'trollcraft_use_whole_stack'
const UNIQUE_TAG = 'enchanted_porkchop'

// The item itself (NBT in Minecraft's /give format).
const ENCHANTED_PORKCHOP_NBT = '{' +
  'TrollcraftItem:"' + UNIQUE_TAG + '",' +
  'display:{' +
    'Name:\'{"text":"Enchanted Porkchop","italic":false,"color":"light_purple"}\',' +
    'Lore:[' +
      '\'{"text":"Two full stacks of pork, compressed by Ministry decree.","italic":true,"color":"gray"}\',' +
      '\'{"text":"Crafting component. Not for eating.","italic":false,"color":"dark_gray"}\'' +
    ']' +
  '},' +
  'Enchantments:[{id:"minecraft:unbreaking",lvl:1s}],' +   // only there for the glint...
  'HideFlags:1' +                                           // ...and hidden from the tooltip
'}'


// ===================== HELPERS =====================

function isEnchantedPorkchop(stack) {
  if (!stack || stack.isEmpty() || String(stack.id) != 'minecraft:cooked_porkchop') return false
  const nbt = stack.nbt
  return nbt != null && String(nbt.getString('TrollcraftItem')) == UNIQUE_TAG
}

// When the result is taken, Minecraft removes one item from each slot. This removes the rest of the stack
// first (PER_SLOT - 1), so each slot loses exactly PER_SLOT. Runs before Minecraft's own removal.
Ingredient.registerCustomIngredientAction(ACTION_ID, (itemstack, index, inventory) => {
  let live = inventory.getItem(index)
  let extra = Math.min(PER_SLOT - 1, live.getCount() - 1)
  if (extra > 0) live.shrink(extra)
  return Item.empty   // nothing is left behind in the slot
})


// ===================== RECIPE =====================

ServerEvents.recipes(event => {
  // Only matches a plain stack of at least PER_SLOT (no NBT, so an Enchanted Porkchop can't be used).
  const fullStack = Ingredient.custom(Ingredient.of(INPUT), stack => stack.getCount() >= PER_SLOT && stack.nbt == null)
  event.shapeless(Item.of('minecraft:cooked_porkchop', ENCHANTED_PORKCHOP_NBT), [fullStack, fullStack])
    .customIngredientAction(INPUT, ACTION_ID)
    .id(RECIPE_ID)
})


// ===================== NO EATING =====================

if (!CAN_BE_EATEN) {
  ItemEvents.rightClicked('minecraft:cooked_porkchop', event => {
    if (!isEnchantedPorkchop(event.item)) return
    event.player.setStatusMessage(Text.lightPurple('The Enchanted Porkchop is a crafting component. The Ministry forbids eating it.'))
    event.cancel()   // last: in KubeJS 6, cancel() stops this function
  })
}

})()
