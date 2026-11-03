// Run with: node tools/tests/run_all.js potato_tooltips   (or node tools/tests/suites/potato_tooltips.test.js)
const REPO_ROOT = require('path').resolve(__dirname, '..', '..', '..')
const fs = require('fs'), snbt = require('../lib/snbt.js')
const src = fs.readFileSync(REPO_ROOT + '/tools/kubejs/client_scripts/potato_tooltips.js', 'utf8')
let fails = 0; const ok = (l, c, e) => { console.log((c ? 'ok   ' : 'FAIL ') + l + (!c && e !== undefined ? '  ' + e : '')); if (!c) fails++ }
let handler = null, shift = false
const stages = new Set()
const T = s => { const t = { s, color: null }; ['green', 'red', 'gold', 'darkGray', 'gray'].forEach(c => { t[c] = () => { t.color = c; return t } }); return t }
const Text = { of: T }
const Client = { get player() { return { stages: { has: x => stages.has(x) } } } }
const ItemEvents = { tooltip: f => f({ get shift() { return shift }, addAdvancedToAll: cb => { handler = cb } }) }
new Function('ItemEvents', 'Text', 'Client', src)(ItemEvents, Text, Client)
const item = (id, tags, nbtStr) => { const parsed = nbtStr ? snbt(nbtStr) : null; return { id, hasTag: t => (tags || []).indexOf(t) >= 0,
  get nbt() { return parsed ? { contains: k => k in parsed, getList: k => ({ size: () => parsed[k].length, getString: i => parsed[k][i] }) } : null } } }
const show = it => { const out = []; handler(it, false, { add: x => out.push(x) }); return out }
const txt = l => l.map(x => x.s + '[' + x.color + ']').join(' / ')
ok('a handler was registered', typeof handler == 'function')
ok('an untiered item gets nothing', show(item('minecraft:dirt')).length == 0)
ok('a tiered item without Shift: a hint only', txt(show(item('create:brass_casing'))) == 'Hold Shift: Potato War[darkGray]', txt(show(item('create:brass_casing'))))
shift = true
let l = show(item('create:brass_casing'))
ok('with Shift: Blood Pool tier (sealed) and the rank, both ✘', /✘ Blood Pool Tier 3 \(sealed\)\[red\]/.test(txt(l)) && /✘ Craft at a table: Potato Recruit\[red\]/.test(txt(l)), txt(l))
stages.add('blood_pool_tier_3'); stages.add('potato_standing_3')
l = show(item('create:brass_casing'))
ok('... ✔ once the tier is open and the rank is held', /✔ Blood Pool Tier 3 \(open\)\[green\]/.test(txt(l)) && /✔ Craft at a table: Potato Recruit\[green\]/.test(txt(l)), txt(l))
l = show(item('tconstruct:pickaxe', [], '{tic_materials:["tconstruct:cobalt","tconstruct:wood#minecraft:oak"]}'))
ok('a cobalt Tinkers tool: Use: Cobalt Smithing ✘', /✘ Use: Cobalt Smithing/.test(txt(l)), txt(l))
stages.add('potato_tree_cobalt_smithing')
ok('... ✔ with the node', /✔ Use: Cobalt Smithing/.test(txt(show(item('tconstruct:pickaxe', [], '{tic_materials:["tconstruct:cobalt"]}')))))
l = show(item('ae2:molecular_assembler'))
ok('an autocrafter: its tier and Place and use: ME Autocrafting', /Blood Pool Tier 6/.test(txt(l)) && /✘ Place and use: ME Autocrafting/.test(txt(l)), txt(l))
l = show(item('mekanism:ingot_steel', ['forge:ingots/steel']))
ok('a tagged item (steel ingot) shows the tag\'s tier (3)', /Blood Pool Tier 3/.test(txt(l)), txt(l))
l = show(item('draconicevolution:chaotic_core'))
ok('Tier 11 item: rank Potato Emperor', /Craft at a table: Potato Emperor/.test(txt(l)), txt(l))
console.log(fails ? fails + ' FAILED' : 'ALL PASSED')
