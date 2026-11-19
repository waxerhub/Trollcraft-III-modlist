// startup_scripts/potato_press.js: Enchanted Potatoes, Enchanted Baked Potatoes, the Potato Press and the Potato Oven.
// Checks what it registers, that 160 inputs make one output (and nothing else), and the hopper/pipe capability: the
// bottom face gives the output slots, the others the input slots; it's attached only on a server where ModernFix's
// faster capabilities is off (it crashed the test server otherwise), never on a player's game.
// Run with: node tools/tests/run_all.js press   (or node tools/tests/suites/potato_press.test.js)
const fs = require('fs')
const paths = require('../lib/paths')
const src = fs.readFileSync(paths.kubejs('startup_scripts/potato_press.js'), 'utf8')
let fails = 0
const ok = (l, c, e) => { console.log((c ? 'ok   ' : 'FAIL ') + l + (!c && e !== undefined ? '  ' + e : '')); if (!c) fails++ }

const stack = (id, count) => ({ id: id || 'minecraft:air', count: id ? count : 0, isEmpty() { return !id || this.count <= 0 } })
const EMPTY = () => stack(null, 0)
// A block's 27-slot inventory, as KubeJS's InventoryKJS (the methods the script uses).
function inventory() {
  const slots = []
  for (let i = 0; i < 27; i++) slots.push(EMPTY())
  return {
    slots, changed: 0,
    getStackInSlot: i => slots[i],
    setStackInSlot: (i, s) => { slots[i] = s },
    extractItem(i, n, sim) { const s = slots[i]; const k = Math.min(n, s.count); if (!sim) { s.count -= k; if (s.count <= 0) slots[i] = EMPTY() } return stack(s.id, k) },
    setChanged() { this.changed++ },
  }
}
const total = (inv, id, from, to) => inv.slots.slice(from || 0, to || 27).filter(s => !s.isEmpty() && s.id == id).reduce((a, s) => a + s.count, 0)

// Loads the script as KubeJS would. opts: client (a player's game), modernfix (null = not installed, true/false = the
// option's value, 'throw' = can't be read).
function load(opts) {
  const items = {}, blocks = {}, generic = [], logs = []
  const itemBuilder = id => { const b = { id, set: {} }; ['displayName', 'texture', 'glow', 'tooltip'].forEach(k => { b[k] = v => { b.set[k] = v; return b } }); items[id] = b; return b }
  const blockBuilder = id => {
    const b = { id, set: {}, textures: {}, info: null }
    ;['displayName', 'hardness', 'tagBlock', 'textureAll'].forEach(k => { b[k] = v => { b.set[k] = v; return b } })
    b.woodSoundType = () => { b.set.sound = 'wood'; return b }
    b.texture = (k, v) => { b.textures[k] = v; return b }
    b.blockEntity = fn => {
      const info = { inv: null, opens: false, tick: null }
      info.inventory = (w, h, filter) => { info.inv = { w, h, filter } }
      info.rightClickOpensInventory = () => { info.opens = true }
      info.serverTick = (interval, offset, cb) => { info.tick = { interval, offset, cb } }
      fn(info)
      b.info = info
      return b
    }
    blocks[id] = b
    return b
  }
  const StartupEvents = { registry: (type, fn) => fn({ create: id => (type == 'item' ? itemBuilder : blockBuilder)(id) }) }
  const ForgeEvents = { onGenericEvent: (ev, gen, fn) => generic.push({ ev, gen, fn }) }
  const Platform = { isClientEnvironment: () => !!opts.client, isLoaded: id => id == 'modernfix' ? opts.modernfix != null : true }
  const ITEM_HANDLER = { name: 'item_handler', equals(x) { return x === ITEM_HANDLER } }
  const DOWN = { name: 'down', equals(x) { return x === DOWN } }, UP = { name: 'up', equals(x) { return x === UP } }
  class InvWrapper { constructor(inv) { this.inv = inv } }
  class RangedWrapper { constructor(inner, from, to) { this.inner = inner; this.from = from; this.to = to } }
  class ResourceLocation { constructor(ns, path) { this.s = ns + ':' + path } }
  const classes = {
    'net.minecraftforge.common.capabilities.ForgeCapabilities': { ITEM_HANDLER },
    'net.minecraftforge.common.util.LazyOptional': { empty: () => ({ empty: true }), of: s => ({ empty: false, get: s }) },
    'net.minecraftforge.items.wrapper.InvWrapper': InvWrapper,
    'net.minecraftforge.items.wrapper.RangedWrapper': RangedWrapper,
    'net.minecraft.resources.ResourceLocation': ResourceLocation,
    'net.minecraft.core.Direction': { DOWN, UP },
    'org.embeddedt.modernfix.core.ModernFixMixinPlugin': { get instance() {
      if (opts.modernfix === 'throw') throw new Error('no plugin')
      return { config: { getOptionMap: () => ({ get: k => k == 'mixin.perf.faster_capabilities' ? { getValue: () => opts.modernfix } : null }) } }
    } },
  }
  const Java = { loadClass: n => { if (!classes[n]) throw new Error('no class ' + n); return classes[n] } }
  const Item = { of: (id, n) => stack(id, n == null ? 1 : n) }
  const Text = { gray: t => ({ text: t, color: 'gray' }) }
  const console = { info: m => logs.push('I ' + m), warn: m => logs.push('W ' + m), error: m => logs.push('E ' + m) }
  new Function('StartupEvents', 'ForgeEvents', 'Platform', 'Java', 'Item', 'Text', 'console', src)(StartupEvents, ForgeEvents, Platform, Java, Item, Text, console)
  return { items, blocks, generic, logs, ITEM_HANDLER, DOWN, UP }
}

// ---------- what it registers ----------
const S = load({ modernfix: false })
const ep = S.items.enchanted_potato, ebp = S.items.enchanted_baked_potato
ok('two items: Enchanted Potato and Enchanted Baked Potato, glowing, on the vanilla textures',
  ep && ebp && ep.set.displayName == 'Enchanted Potato' && ebp.set.displayName == 'Enchanted Baked Potato' && ep.set.glow === true && ebp.set.glow === true &&
  ep.set.texture == 'minecraft:item/potato' && ebp.set.texture == 'minecraft:item/baked_potato')
const press = S.blocks.potato_press, oven = S.blocks.potato_oven
ok('two blocks: the Potato Press and the Potato Oven', press && oven && press.set.displayName == 'Potato Press' && oven.set.displayName == 'Potato Oven')
ok('... each a 27-slot box (9 x 3) that only takes its input, opened with a right-click, working every second',
  press.info.inv.w == 9 && press.info.inv.h == 3 && press.info.inv.filter == 'minecraft:potato' && oven.info.inv.filter == 'kubejs:enchanted_potato' &&
  press.info.opens && oven.info.opens && press.info.tick.interval == 20 && oven.info.tick.interval == 20)
ok('... mined with an axe, with barrel and smoker textures', press.set.tagBlock == 'minecraft:mineable/axe' && press.set.textureAll == 'minecraft:block/barrel_side' &&
  press.textures.up == 'minecraft:block/barrel_top' && oven.textures.up == 'minecraft:block/smoker_top')

// ---------- the work ----------
const tick = (b, inv) => b.info.tick.cb({ inventory: inv })
let inv = inventory()
inv.slots[0] = stack('minecraft:potato', 64); inv.slots[1] = stack('minecraft:potato', 64); inv.slots[2] = stack('minecraft:potato', 64); inv.slots[3] = stack('minecraft:potato', 5)
tick(press, inv)
ok('the Press: 197 potatoes make 1 Enchanted Potato in the first output slot, 37 potatoes stay', total(inv, 'kubejs:enchanted_potato', 18) == 1 &&
  inv.slots[18].id == 'kubejs:enchanted_potato' && total(inv, 'minecraft:potato') == 37 && inv.changed == 1)
tick(press, inv)
ok('... fewer than 160 left: nothing more happens', total(inv, 'kubejs:enchanted_potato') == 1 && total(inv, 'minecraft:potato') == 37 && inv.changed == 1)
inv = inventory()
for (let i = 0; i < 18; i++) inv.slots[i] = stack('minecraft:potato', 64)
tick(press, inv)
ok('a full input (18 stacks, 1,152 potatoes) is pressed in one second: 7 Enchanted Potatoes, 32 potatoes left', total(inv, 'kubejs:enchanted_potato') == 7 &&
  total(inv, 'minecraft:potato') == 32 && total(inv, 'kubejs:enchanted_potato', 18, 19) == 7)
tick(press, inv)
ok('... the next second, nothing more', total(inv, 'kubejs:enchanted_potato') == 7 && total(inv, 'minecraft:potato') == 32)
inv = inventory()
inv.slots[0] = stack('minecraft:potato', 64); inv.slots[1] = stack('minecraft:potato', 64); inv.slots[2] = stack('minecraft:potato', 64)
for (let j = 18; j < 27; j++) inv.slots[j] = stack('kubejs:enchanted_potato', 64)
tick(press, inv)
ok('output slots full: no potatoes are used up', total(inv, 'minecraft:potato') == 192 && total(inv, 'kubejs:enchanted_potato') == 9 * 64)
inv.slots[20] = stack('minecraft:dirt', 64)
tick(press, inv)
ok('... and an output slot holding something else isn\'t used either', total(inv, 'minecraft:potato') == 192 && inv.slots[20].id == 'minecraft:dirt')
inv = inventory()
inv.slots[0] = stack('minecraft:potato', 64); inv.slots[5] = stack('minecraft:dirt', 64); inv.slots[9] = stack('minecraft:potato', 64); inv.slots[17] = stack('minecraft:potato', 40)
tick(press, inv)
ok('potatoes spread over the input slots count together (other things are left alone)', total(inv, 'kubejs:enchanted_potato') == 1 && total(inv, 'minecraft:potato') == 8 && inv.slots[5].count == 64)
inv = inventory()
inv.slots[0] = stack('kubejs:enchanted_potato', 64); inv.slots[1] = stack('kubejs:enchanted_potato', 64); inv.slots[2] = stack('kubejs:enchanted_potato', 32)
tick(oven, inv)
ok('the Oven: 160 Enchanted Potatoes make 1 Enchanted Baked Potato', total(inv, 'kubejs:enchanted_baked_potato', 18) == 1 && total(inv, 'kubejs:enchanted_potato') == 0)
inv = inventory(); inv.slots[0] = stack('minecraft:potato', 64); inv.slots[1] = stack('minecraft:potato', 64); inv.slots[2] = stack('minecraft:potato', 64)
tick(oven, inv)
ok('... and takes no plain potatoes', total(inv, 'minecraft:potato') == 192 && total(inv, 'kubejs:enchanted_baked_potato') == 0)
const nE = S.logs.filter(l => /^E /.test(l)).length
press.info.tick.cb({ inventory: { getStackInSlot: () => { throw new Error('boom') } } })
ok('an error in a tick is logged, not thrown (the block entity keeps ticking)', S.logs.filter(l => /^E \[PotatoPress\] potato_press: .*boom/.test(l)).length == nE + 1)
press.info.tick.cb({ inventory: null })
ok('... and a block entity with no inventory yet is skipped', S.logs.filter(l => /^E /.test(l)).length == nE + 1)

// ---------- hoppers and pipes ----------
ok('on the server with faster capabilities off: the capability is attached to block entities', S.generic.length == 1 &&
  S.generic[0].ev == 'net.minecraftforge.event.AttachCapabilitiesEvent' && S.generic[0].gen == 'net.minecraft.world.level.block.entity.BlockEntity' &&
  S.logs.some(l => /^I \[PotatoPress\] Hoppers and pipes can reach the Potato Press and Oven/.test(l)))
const attach = (blockId, be) => {
  const added = []
  S.generic[0].fn({ getObject: () => Object.assign({ getBlockState: () => ({ getBlock: () => ({ id: blockId }) }) }, be || {}), addCapability: (id, p) => added.push({ id, p }) })
  return added
}
ok('... only to the Press and the Oven', attach('kubejs:potato_press').length == 1 && attach('kubejs:potato_oven').length == 1 &&
  attach('minecraft:chest').length == 0 && attach('kubejs:something_else').length == 0)
const theInv = inventory()
const cap = attach('kubejs:potato_press', { inventory: theInv })[0]
const down = cap.p(S.ITEM_HANDLER, S.DOWN), up = cap.p(S.ITEM_HANDLER, S.UP), none = cap.p(S.ITEM_HANDLER, null)
ok('the bottom face gives the output slots (18-26)', !down.empty && down.get().from == 18 && down.get().to == 27 && down.get().inner.inv === theInv)
ok('every other face (and no face) gives the input slots (0-17)', up.get().from == 0 && up.get().to == 18 && none.get().from == 0 && none.get().to == 18)
ok('other capabilities: none', cap.p({ equals: () => false }, S.DOWN).empty === true)
ok('a block entity whose inventory isn\'t made yet offers nothing (asked again later)', attach('kubejs:potato_press', { inventory: null })[0].p(S.ITEM_HANDLER, S.UP).empty === true)

const on = load({ modernfix: true })
ok('faster capabilities on: nothing attached (it would crash the server), and the log says what to change', on.generic.length == 0 &&
  on.logs.some(l => /^E \[PotatoPress\] Hoppers and pipes can't reach .*faster_capabilities is on\. Add "mixin\.perf\.faster_capabilities=false" to config\/modernfix-mixins\.properties/.test(l)))
ok('... the machines are still registered (they work by hand)', !!on.blocks.potato_press && !!on.blocks.potato_oven)
const unknown = load({ modernfix: 'throw' })
ok('the option can\'t be read: nothing attached either, with a warning and the same advice', unknown.generic.length == 0 &&
  unknown.logs.some(l => /^W \[PotatoPress\] Could not read ModernFix/.test(l)) && unknown.logs.some(l => /^E .*may be on/.test(l)))
ok('ModernFix not installed: attached', load({ modernfix: null }).generic.length == 1)
const client = load({ client: true, modernfix: true })
ok('on a player\'s game: nothing attached and nothing logged (only the server needs it)', client.generic.length == 0 && client.logs.length == 0 && !!client.blocks.potato_press)

console.log(fails ? fails + ' FAILED' : 'ALL PASSED')
process.exit(fails ? 1 : 0)
