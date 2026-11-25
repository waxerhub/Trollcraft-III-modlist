// Part II: Enchanted Potatoes, Enchanted Baked Potatoes, the Potato Press and the Potato Oven (see tools/kubejs/POTATO_PRESS.md).
//
// When the Blood Pool opens Tier 5, the Potato War's numbers are revealed to have counted Enchanted Potatoes (Tiers 6-8)
// and Enchanted Baked Potatoes (Tiers 9-12) all along (part2/blood_pool.js). Hypixel's ratios:
//   Potato Press: 160 potatoes        -> 1 Enchanted Potato         (craftable from Tier 5; potato crates count as 9)
//   Potato Oven:  160 Enchanted Potatoes -> 1 Enchanted Baked Potato (craftable from Tier 8)
// Each is a 27-slot block: the top two rows take its input, the bottom row holds what it made. Every second, each
// 160 inputs become one output. Hoppers, pipes, Create funnels and AE2 put input in from the top and sides and take
// output from the bottom; players open it with a right-click. Breaking one drops everything in it.
//
// Goes in the MODPACK (every player's kubejs/startup_scripts/) AND on the server (kubejs/startup_scripts/): both sides
// must have the same items and blocks, or players can't join. A restart is needed after adding or changing it.
// The server also needs this line in config/modernfix-mixins.properties (see the doc):
//   mixin.perf.faster_capabilities=false
// Without it the presses still work by hand, but hoppers and pipes can't reach them, and the log says so: ModernFix's
// faster capabilities can't call a scripted capability and would crash the server (seen on the test server).
//
// KubeJS 6 (Rhino): no template strings; `let` inside nested blocks.

(function () {

// ===================== SETTINGS =====================

const RATIO = 160               // input worth per output (Hypixel's 160 potatoes per Enchanted Potato, 160 per Enchanted Baked)
const IN_SLOTS = 18             // slots 0-17 take input; 18-26 hold output
const SLOTS = 27
const MAX_PER_SECOND = 8        // outputs one block makes per second at most
// inputs: what each machine takes, and its worth. The Press takes potato crates at 9 (owner decision, 2026-11-19), so
// a farm that packs its potatoes needs no unpacking; what's left of a crate after a 160 is kept in the block as credit.
const MACHINES = {
  potato_press: { name: 'Potato Press', output: 'kubejs:enchanted_potato',
    inputs: { 'minecraft:potato': 1, 'quark:potato_crate': 9, 'farmersdelight:potato_crate': 9, 'thermal:potato_block': 9 },
    textures: { all: 'minecraft:block/barrel_side', up: 'minecraft:block/barrel_top', down: 'minecraft:block/barrel_bottom' } },
  potato_oven: { name: 'Potato Oven', output: 'kubejs:enchanted_baked_potato',
    inputs: { 'kubejs:enchanted_potato': 1 },
    textures: { all: 'minecraft:block/smoker_front_on', up: 'minecraft:block/smoker_top', down: 'minecraft:block/smoker_bottom' } },
}
const CREDIT_KEY = 'credit'     // in the block's data: input worth left over from a crate, used before anything else
const FASTER_CAPS = 'mixin.perf.faster_capabilities'

// Each machine's inputs from mods that are installed, and their worths smallest first (loose potatoes go before crates).
Object.keys(MACHINES).forEach(id => {
  const M = MACHINES[id]
  M.accepted = Object.keys(M.inputs).filter(i => Platform.isLoaded(i.split(':')[0]))
  M.worths = M.accepted.map(i => M.inputs[i]).filter((w, k, a) => a.indexOf(w) == k).sort((a, b) => a - b)
})

// ===================== ITEMS =====================

StartupEvents.registry('item', event => {
  event.create('enchanted_potato').displayName('Enchanted Potato').texture('minecraft:item/potato').glow(true)
    .tooltip(Text.gray('160 potatoes, pressed in the Potato Press.'))
  event.create('enchanted_baked_potato').displayName('Enchanted Baked Potato').texture('minecraft:item/baked_potato').glow(true)
    .tooltip(Text.gray('160 Enchanted Potatoes, baked in the Potato Oven.'))
})

// ===================== THE MACHINES =====================

function creditOf(be) { try { return Number(be.data.getInt(CREDIT_KEY)) || 0 } catch (e) { return 0 } }
function setCredit(be, n) { try { be.data.putInt(CREDIT_KEY, n) } catch (e) { } }
// Turns each RATIO of input worth into one output, up to MAX_PER_SECOND, while the output slots have room. The
// block's credit is used first, then the smallest inputs; what's left of the last one taken becomes the credit.
function work(be, M) {
  const inv = be.inventory
  if (!inv) return 0
  const credit0 = creditOf(be)
  let have = credit0, bank = credit0
  for (let i = 0; i < IN_SLOTS; i++) {
    let s = inv.getStackInSlot(i), w = M.inputs[String(s.id)]
    if (w) have += w * s.count
  }
  let made = 0
  while (have >= RATIO && made < MAX_PER_SECOND) {
    let slot = -1
    for (let j = IN_SLOTS; j < SLOTS; j++) {
      let o = inv.getStackInSlot(j)
      if (o.isEmpty() || (String(o.id) == M.output && o.count < 64)) { slot = j; break }
    }
    if (slot < 0) break
    let need = RATIO
    let fromBank = Math.min(bank, need)
    bank -= fromBank
    need -= fromBank
    for (let k = 0; k < M.worths.length && need > 0; k++) {
      let w = M.worths[k]
      for (let i = 0; i < IN_SLOTS && need > 0; i++) {
        let s = inv.getStackInSlot(i)
        if (M.inputs[String(s.id)] != w) continue
        let take = Math.min(s.count, Math.ceil(need / w))
        inv.extractItem(i, take, false)
        need -= take * w
      }
    }
    if (need < 0) bank += -need
    let o = inv.getStackInSlot(slot)
    inv.setStackInSlot(slot, Item.of(M.output, o.isEmpty() ? 1 : o.count + 1))
    have -= RATIO
    made++
  }
  if (bank != credit0) setCredit(be, bank)
  if (made) inv.setChanged()
  return made
}

StartupEvents.registry('block', event => {
  Object.keys(MACHINES).forEach(id => {
    const M = MACHINES[id]
    event.create(id).displayName(M.name).woodSoundType().hardness(2.5).tagBlock('minecraft:mineable/axe')
      .textureAll(M.textures.all).texture('up', M.textures.up).texture('down', M.textures.down)
      .blockEntity(info => {
        info.inventory(9, 3, M.accepted)
        info.rightClickOpensInventory()
        info.serverTick(20, 0, be => { try { work(be, M) } catch (e) { console.error('[PotatoPress] ' + id + ': ' + e) } })
      })
  })
})

// ===================== HOPPERS AND PIPES =====================

// Hoppers, pipes, Create funnels and AE2 see a block's items through Forge's item capability, which KubeJS's block
// entity doesn't offer, so it's attached here: the bottom face gives the output slots, every other face the input
// slots (only the machine's input goes in). Server only: players' games don't need it.
// true = ModernFix's faster capabilities is on (attaching would crash the server), false = off, null = can't tell.
function fasterCapsOn() {
  if (!Platform.isLoaded('modernfix')) return false
  try {
    let plugin = Java.loadClass('org.embeddedt.modernfix.core.ModernFixMixinPlugin').instance
    let opt = plugin.config.getOptionMap().get(FASTER_CAPS)
    return opt == null ? false : String(opt.getValue()) == 'true'
  } catch (e) {
    console.warn('[PotatoPress] Could not read ModernFix\'s ' + FASTER_CAPS + ': ' + e)
    return null
  }
}

function attachCapabilities() {
  const caps = fasterCapsOn()
  if (caps !== false) {
    console.error('[PotatoPress] Hoppers and pipes can\'t reach the Potato Press and Oven: ModernFix\'s ' + FASTER_CAPS +
      (caps ? ' is on' : ' may be on') + '. Add "' + FASTER_CAPS + '=false" to config/modernfix-mixins.properties and restart. ' +
      'They still work by hand.')
    return false
  }
  const ForgeCaps = Java.loadClass('net.minecraftforge.common.capabilities.ForgeCapabilities')
  const LazyOptional = Java.loadClass('net.minecraftforge.common.util.LazyOptional')
  const InvWrapper = Java.loadClass('net.minecraftforge.items.wrapper.InvWrapper')
  const RangedWrapper = Java.loadClass('net.minecraftforge.items.wrapper.RangedWrapper')
  const ResourceLocation = Java.loadClass('net.minecraft.resources.ResourceLocation')
  const Direction = Java.loadClass('net.minecraft.core.Direction')
  const CAP_ID = new ResourceLocation('kubejs', 'potato_machine_items')
  ForgeEvents.onGenericEvent('net.minecraftforge.event.AttachCapabilitiesEvent', 'net.minecraft.world.level.block.entity.BlockEntity', event => {
    const be = event.getObject()
    let id = ''
    try { id = String(be.getBlockState().getBlock().id) } catch (e) { return }
    if (id.indexOf('kubejs:') != 0 || !MACHINES[id.substring(7)]) return
    event.addCapability(CAP_ID, (cap, side) => {
      if (!ForgeCaps.ITEM_HANDLER.equals(cap)) return LazyOptional.empty()
      const inv = be.inventory
      if (!inv) return LazyOptional.empty()
      const whole = new InvWrapper(inv)
      const part = side != null && Direction.DOWN.equals(side) ? new RangedWrapper(whole, IN_SLOTS, SLOTS) : new RangedWrapper(whole, 0, IN_SLOTS)
      return LazyOptional.of(() => part)
    })
  })
  console.info('[PotatoPress] Hoppers and pipes can reach the Potato Press and Oven')
  return true
}
if (!Platform.isClientEnvironment()) attachCapabilities()

})()
