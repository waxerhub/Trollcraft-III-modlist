// Run with: node tools/tests/run_all.js enchanted_porkchop   (or node tools/tests/suites/enchanted_porkchop.test.js)
const REPO_ROOT = require('path').resolve(__dirname, '..', '..', '..')
const fs = require('fs')
const src = fs.readFileSync(REPO_ROOT + '/tools/kubejs/server_scripts/enchanted_porkchop.js', 'utf8')
let fails = 0; const ok = (l, c, e) => { console.log((c ? 'ok   ' : 'FAIL ') + l + (e ? '  ' + e : '')); if (!c) fails++ }
const stack = (id, count, nbt) => ({ id, count, nbt: nbt || null, getCount() { return this.count }, shrink(n) { this.count -= n }, isEmpty() { return this.count <= 0 } })
let action, recipe, rc
class Exit extends Error {}
const Ingredient = { of: id => ({ id }), custom: (base, pred) => ({ base, pred }), registerCustomIngredientAction: (id, cb) => { action = { id, cb } } }
const Item = { empty: { empty: true }, of: (id, nbt) => ({ id, nbt }) }
const ServerEvents = { recipes: f => f({ shapeless: (out, ins) => { recipe = { out, ins }; return { customIngredientAction(filter, id) { recipe.filter = filter; recipe.action = id; return this }, id(x) { recipe.id = x; return this } } } }) }
const ItemEvents = { rightClicked: (item, f) => { rc = { item, f } } }
new Function('Ingredient', 'Item', 'ServerEvents', 'ItemEvents', 'Text', src)(Ingredient, Item, ServerEvents, ItemEvents, { lightPurple: t => t })
const pred = recipe.ins[0].pred
ok('two ingredients, both full-stack porkchops', recipe.ins.length == 2 && recipe.ins[0].base.id == 'minecraft:porkchop')
ok('full stack matches; 63 does not; NBT porkchop does not', pred(stack('minecraft:porkchop', 64)) && !pred(stack('minecraft:porkchop', 63)) && !pred(stack('minecraft:porkchop', 64, { x: 1 })))
ok('output is a cooked porkchop with the unique tag + glint', recipe.out.id == 'minecraft:cooked_porkchop' && /TrollcraftItem:"enchanted_porkchop"/.test(recipe.out.nbt) && /Enchantments/.test(recipe.out.nbt) && /HideFlags:1/.test(recipe.out.nbt))
ok('custom action wired up', recipe.action == action.id && recipe.filter == 'minecraft:porkchop' && recipe.id == 'trollcraft:enchanted_porkchop')
// Simulate taking the result: action runs, then vanilla removes 1 per slot.
const grid = [stack('minecraft:porkchop', 64), stack('minecraft:porkchop', 64)]
const inv = { getItem: i => grid[i] }
const rem = grid.map((s, i) => action.cb({ copy: true }, i, inv))
grid.forEach(s => s.shrink(1))
ok('taking the result uses exactly 128 porkchops, leaves nothing behind', grid.every(s => s.count == 0) && rem.every(r => r.empty))
// NBT string is valid SNBT-ish: balanced quotes/braces
const n = recipe.out.nbt
ok('NBT braces balanced', (n.match(/\{/g) || []).length == (n.match(/\}/g) || []).length && (n.match(/\[/g) || []).length == (n.match(/\]/g) || []).length, n)
const nameJson = n.match(/Name:'([^']*)'/)[1]; JSON.parse(nameJson)
const lore = [...n.matchAll(/'(\{"text"[^']*)'/g)].map(m => JSON.parse(m[1]))
ok('name and lore are valid JSON text', lore.length == 3)
// Eating blocked
let msg = null, cancelled = false
const ev = item => ({ item, player: { setStatusMessage: m => { msg = m } }, cancel() { cancelled = true; throw new Exit() } })
const tagNbt = { getString: k => k == 'TrollcraftItem' ? 'enchanted_porkchop' : '' }
try { rc.f(ev(stack('minecraft:cooked_porkchop', 1, tagNbt))) } catch (e) { if (!(e instanceof Exit)) throw e }
ok('eating an Enchanted Porkchop is blocked with a message', cancelled && /crafting component/.test(msg))
cancelled = false
rc.f(ev(stack('minecraft:cooked_porkchop', 1)))
ok('normal cooked porkchops can still be eaten', !cancelled)
console.log(fails ? fails + ' FAILED' : 'ALL PASSED')
