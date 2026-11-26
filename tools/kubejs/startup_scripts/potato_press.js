// Part II: Enchanted Potatoes, Enchanted Baked Potatoes, the Potato Press and the Potato Oven (see tools/kubejs/POTATO_PRESS.md).
//
// When the Blood Pool opens Tier 5, the Potato War's numbers are revealed to have counted Enchanted Potatoes (Tiers 6-8)
// and Enchanted Baked Potatoes (Tiers 9-12) all along (part2/blood_pool.js). Hypixel's ratios:
//   Potato Press: 160 potatoes        -> 1 Enchanted Potato         (craftable from Tier 5; potato crates count as 9)
//   Potato Oven:  160 Enchanted Potatoes -> 1 Enchanted Baked Potato (craftable from Tier 8)
// Each is a 27-slot block: the top two rows take its input, the bottom row holds what it made. Every second, each
// 160 inputs become one output. Hoppers, pipes, Create funnels and AE2 can reach it from any face: only its input goes
// in, and only what it made comes out. Players open it with a right-click. Breaking one drops everything in it.
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
// filter: the item tag that says what may go in, by hand or by hopper (tools/kubejs/data/kubejs/tags/items/). It has
// to be a tag: the filter is made while blocks are registered, before any mod's items exist, so a list of item ids
// kept only the vanilla potato (until 2026-11-25 the Press refused every crate and the Oven its Enchanted Potatoes).
// A tag is read when an item is offered. Keep each tag file the same as `inputs`.
const MACHINES = {
  potato_press: { name: 'Potato Press', output: 'kubejs:enchanted_potato', filter: '#kubejs:potato_press_input',
    inputs: { 'minecraft:potato': 1, 'quark:potato_crate': 9, 'farmersdelight:potato_crate': 9, 'thermal:potato_block': 9 },
    textures: { all: 'minecraft:block/barrel_side', up: 'minecraft:block/barrel_top', down: 'minecraft:block/barrel_bottom' } },
  potato_oven: { name: 'Potato Oven', output: 'kubejs:enchanted_baked_potato', filter: '#kubejs:potato_oven_input',
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
// Input found in the output row (a stack shift-clicked in can spill there) is pressed too, so none sits there to be
// pulled out by a hopper.
function work(be, M) {
  const inv = be.inventory
  if (!inv) return 0
  const credit0 = creditOf(be)
  let have = credit0, bank = credit0
  for (let i = 0; i < SLOTS; i++) {
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
      for (let i = 0; i < SLOTS && need > 0; i++) {
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
        info.inventory(9, 3, M.filter)
        info.rightClickOpensInventory()
        info.serverTick(20, 0, be => { try { work(be, M) } catch (e) { console.error('[PotatoPress] ' + id + ': ' + e) } })
      })
  })
})

// ===================== HOPPERS AND PIPES =====================

// Hoppers, pipes, Create funnels and AE2 see a block's items through Forge's item capability, which KubeJS's block
// entity doesn't offer, so it's attached here. Every face follows the same rules (machineHandler): only the machine's
// input goes in, into the top two rows, and only what it made comes out. Until 2026-11-25 each face showed one part of
// the box (the bottom the output row, the others the input rows), so a funnel or pipe on a side could pull the crates
// back out (owner: "only enchanted potatoes should be able to be funneled out"). Server only: players' games don't
// need it.
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

// What automation sees: all 27 slots, but it may put only the machine's input into the top two rows, and take out only
// the machine's output, wherever it sits. A crate left in the output row can't be pulled out (the next tick presses
// it). The rules are a script object; Rhino makes it a Java item handler when it's passed to RangedWrapper.
function machineHandler(inv, M, J) {
  const whole = new J.InvWrapper(inv)
  const isInput = st => !st.isEmpty() && !!M.inputs[String(st.id)]
  const isOutput = st => !st.isEmpty() && String(st.id) == M.output
  const rules = {
    getSlots: () => SLOTS,
    getStackInSlot: slot => whole.getStackInSlot(slot),
    getSlotLimit: slot => whole.getSlotLimit(slot),
    isItemValid: (slot, st) => slot < IN_SLOTS && isInput(st),
    insertItem: (slot, st, simulate) => (slot < IN_SLOTS && isInput(st) ? whole.insertItem(slot, st, simulate) : st),
    extractItem: (slot, amount, simulate) => (isOutput(whole.getStackInSlot(slot)) ? whole.extractItem(slot, amount, simulate) : J.EMPTY),
    setStackInSlot: (slot, st) => { if (st.isEmpty() || (slot < IN_SLOTS ? isInput(st) : isOutput(st))) whole.setStackInSlot(slot, st) },
  }
  return new J.RangedWrapper(rules, 0, SLOTS)
}

function attachCapabilities() {
  const caps = fasterCapsOn()
  if (caps !== false) {
    // A warning, never an error: KubeJS refuses to start a dedicated server when a startup script has logged any error
    // (the live server wouldn't start without the ModernFix line, 2026-11-21). The machines still work by hand.
    console.warn('[PotatoPress] Hoppers and pipes can\'t reach the Potato Press and Oven: ModernFix\'s ' + FASTER_CAPS +
      (caps ? ' is on' : ' may be on') + '. Add "' + FASTER_CAPS + '=false" to config/modernfix-mixins.properties and restart. ' +
      'They still work by hand.')
    return false
  }
  let ForgeCaps = null, LazyOptional = null, J = null, CAP_ID = null
  try {
    ForgeCaps = Java.loadClass('net.minecraftforge.common.capabilities.ForgeCapabilities')
    LazyOptional = Java.loadClass('net.minecraftforge.common.util.LazyOptional')
    J = {
      InvWrapper: Java.loadClass('net.minecraftforge.items.wrapper.InvWrapper'),
      RangedWrapper: Java.loadClass('net.minecraftforge.items.wrapper.RangedWrapper'),
      EMPTY: Java.loadClass('net.minecraft.world.item.ItemStack').EMPTY,
    }
    CAP_ID = new (Java.loadClass('net.minecraft.resources.ResourceLocation'))('kubejs', 'potato_machine_items')
  } catch (e) {
    // A warning, never an error (an error would stop the server starting): the machines still work by hand.
    console.warn('[PotatoPress] Hoppers and pipes can\'t reach the Potato Press and Oven: ' + e)
    return false
  }
  ForgeEvents.onGenericEvent('net.minecraftforge.event.AttachCapabilitiesEvent', 'net.minecraft.world.level.block.entity.BlockEntity', event => {
    const be = event.getObject()
    let id = ''
    try { id = String(be.getBlockState().getBlock().id) } catch (e) { return }
    if (id.indexOf('kubejs:') != 0 || !MACHINES[id.substring(7)]) return
    const M = MACHINES[id.substring(7)]
    // One handler per block, made when first asked for (the inventory doesn't exist yet when this event fires), the
    // same from every face, and let go of when the block is removed.
    let lazy = null
    event.addCapability(CAP_ID, (cap, side) => {
      if (!ForgeCaps.ITEM_HANDLER.equals(cap)) return LazyOptional.empty()
      if (!lazy) {
        let inv = be.inventory
        if (!inv) return LazyOptional.empty()
        let handler = machineHandler(inv, M, J)
        lazy = LazyOptional.of(() => handler)
      }
      return lazy
    })
    event.addListener(() => { if (lazy) lazy.invalidate() })
  })
  console.info('[PotatoPress] Hoppers and pipes can reach the Potato Press and Oven')
  return true
}
if (!Platform.isClientEnvironment()) attachCapabilities()

})()
