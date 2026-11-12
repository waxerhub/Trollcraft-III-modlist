// Run with: node tools/tests/run_all.js twilight   (or node tools/tests/suites/twilight_bosses.test.js)
const REPO_ROOT = require('path').resolve(__dirname, '..', '..', '..')
const fs = require('fs')
const SRC = fs.readFileSync(REPO_ROOT + '/tools/kubejs/server_scripts/part2/twilight_bosses.js', 'utf8')
let fails = 0
const ok = (l, c, e) => { console.log((c ? 'ok   ' : 'FAIL ') + l + (!c && e !== undefined ? '  ' + e : '')); if (!c) fails++ }

// The boss tables, cut down to one marker pool each (the real ones are in the Twilight Forest jar).
const TF_TABLES = ['entities/naga', 'entities/lich', 'entities/minoshroom', 'entities/hydra', 'entities/ur_ghast',
  'entities/alpha_yeti', 'entities/snow_queen', 'chests/stronghold_boss']
// Most item stacks each TF table can put in the chest (rolls x entries, from the 4.3.2508 jar's tables).
const TF_MAX_STACKS = { naga: 2, lich: 8, minoshroom: 7, hydra: 3, stronghold_boss: 8, ur_ghast: 7, alpha_yeti: 3, snow_queen: 11 }
const CHEST_SLOTS = 27

// A KubeJS 6 loot event: modify(id, fn) builds <ns>:<dir>/<path>, hands fn a builder holding the table's pools, and
// writes the result back only if fn returns (an exception leaves the table alone).
function setup(opts) {
  opts = opts || {}
  const W = { tables: {}, written: {}, errors: [], infos: [], handlers: {} }
  TF_TABLES.filter(t => (opts.missing || []).indexOf(t) < 0).forEach(t => {
    W.tables['twilightforest:' + t] = { pools: [{ marker: 'tf:' + t, rolls: 1, entries: [{ type: 'minecraft:item', name: 'tf:' + t }] }] }
  })
  const makeEvent = dir => ({
    modify(id, fn) {
      const ns = id.split(':')[0], path = id.split(':')[1], full = ns + ':' + dir + '/' + path
      const old = W.tables[full]
      const pools = old ? old.pools.slice() : []
      pools.size = () => pools.length
      const builder = { pools, addPool(f) {
        const p = { rolls: 1, entries: [], setUniformRolls(a, b) { this.rolls = a == b ? a : [a, b] }, addEntry(j) { this.entries.push(JSON.parse(JSON.stringify(j))) } }
        f(p); pools.push({ rolls: p.rolls, entries: p.entries }) } }
      fn(builder)
      W.written[full] = { pools: pools.slice() }
    },
  })
  const ServerEvents = { entityLootTables: f => { W.handlers.entity = f }, chestLootTables: f => { W.handlers.chest = f } }
  const Item = { exists: id => (opts.noItems || []).indexOf(String(id)) < 0 }
  const console2 = { info: m => W.infos.push(m), error: m => W.errors.push(m), log: m => W.infos.push(m) }
  const g = {}
  let src = SRC
  if (opts.patch) src = opts.patch(src)
  new Function('ServerEvents', 'Item', 'console', 'global', src)(ServerEvents, Item, console2, g)
  W.global = g
  W.run = () => { W.handlers.entity(makeEvent('entities')); W.handlers.chest(makeEvent('chests')) }
  return W
}

let W = setup()
W.run()
const B = W.global.TwilightBosses.BOSSES
ok('eight bosses, ranked 1 to 8 in order', B.length == 8 && B.every((b, i) => b.rank == i + 1), B.map(b => b.rank).join())
ok('... easiest first: Naga, Minoshroom, Alpha Yeti, Lich, Knight Phantoms, Hydra, Ur-Ghast, Snow Queen',
  B.map(b => b.name).join(', ') == 'Naga, Minoshroom, Alpha Yeti, Lich, Knight Phantoms, Hydra, Ur-Ghast, Snow Queen', B.map(b => b.name).join(', '))
ok('all eight TF tables are written, and nothing else', Object.keys(W.written).sort().join() == TF_TABLES.map(t => 'twilightforest:' + t).sort().join(), Object.keys(W.written).join())
ok('the Knight Phantoms\' loot is the stronghold_boss chest table', !!W.written['twilightforest:chests/stronghold_boss'] && !W.written['twilightforest:entities/knight_phantom'])
ok('no errors with the real settings', W.errors.length == 0, W.errors.join(' | '))

B.forEach(b => {
  const key = 'twilightforest:' + (b.table == 'chest' ? 'chests/' : 'entities/') + b.id.split(':')[1]
  const t = W.written[key], pools = t ? t.pools : []
  const crate = pools[1], spoils = pools[2]
  ok(b.name + ': TF\'s own pool is kept, first and unchanged', pools[0] && pools[0].marker == 'tf:' + key.split(':')[1] && pools[0].entries[0].name == 'tf:' + key.split(':')[1])
  ok(b.name + ': then one roll of potato crates, ' + b.crates.join('-'), pools.length == 3 && crate.rolls == 1 && crate.entries.length == 1 &&
    crate.entries[0].name == 'farmersdelight:potato_crate' && crate.entries[0].functions[0].function == 'minecraft:set_count' &&
    crate.entries[0].functions[0].count.min == b.crates[0] && crate.entries[0].functions[0].count.max == b.crates[1], JSON.stringify(crate))
  ok(b.name + ': then ' + b.rolls + ' rolls of its ' + b.spoils.length + ' spoils', spoils && spoils.rolls == b.rolls && spoils.entries.length == b.spoils.length)
  const books = spoils ? spoils.entries.filter(e => e.name == 'minecraft:book') : []
  ok(b.name + ': ' + (b.rank == 1 ? 'no book' : 'its book is enchanted (enchant_with_levels on a plain book)'), (b.rank == 1 ? books.length == 0 : books.length == 1) && books.every(e => e.functions[0].function == 'minecraft:enchant_with_levels' && e.functions[0].levels.min >= 15))
  ok(b.name + ': every count fits in one stack', b.crates[1] <= 64 && b.spoils.every(s => !s.count || s.count[1] <= 64))
  const most = TF_MAX_STACKS[key.split('/')[1]] + 1 + b.rolls
  ok(b.name + ': at most ' + most + ' stacks, so the chest (' + CHEST_SLOTS + ' slots) never overflows', most <= CHEST_SLOTS)
})

ok('harder bosses never give fewer crates or rolls', B.every((b, i) => i == 0 || (b.crates[0] >= B[i - 1].crates[0] && b.crates[1] >= B[i - 1].crates[1] && b.rolls >= B[i - 1].rolls)))
const KEYS = W.global.TwilightBosses.KEY_ITEMS
const added = []
Object.keys(W.written).forEach(k => W.written[k].pools.slice(1).forEach(p => p.entries.forEach(e => added.push(e.name))))
ok('no boss chest gets a TF progression item (trophies, scales, scepters, fur, stroganoff)', added.every(n => KEYS.indexOf(n) < 0), added.filter(n => KEYS.indexOf(n) >= 0).join())
ok('... and every trophy is on that list', ['naga', 'lich', 'minoshroom', 'hydra', 'knight_phantom', 'ur_ghast', 'alpha_yeti', 'snow_queen'].every(n => KEYS.indexOf('twilightforest:' + n + '_trophy') >= 0))
ok('no Tier-locked TF gear or materials in the spoils', added.every(n => !/knightmetal|fiery|carminite|steeleaf|ironwood|arctic|yeti|charm_of_keeping_3/.test(n)), added.join())

// A table that isn't there is left alone (a modify would otherwise write a table holding only our pools).
W = setup({ missing: ['entities/hydra'] })
W.run()
ok('a missing table: nothing is written for it', !W.written['twilightforest:entities/hydra'])
ok('... the error is logged', W.errors.some(e => /Hydra/.test(e) && /not found/.test(e) && /left as TF made it/.test(e)), W.errors.join(' | '))
ok('... and the other seven are still done', Object.keys(W.written).length == 7)

// A progression item slipped into the spoils is skipped.
W = setup({ patch: s => s.replace("{ item: 'minecraft:emerald', count: [3, 6], weight: 20 },", "{ item: 'twilightforest:lich_trophy', count: [1, 1], weight: 20 },") })
W.run()
const naga = W.written['twilightforest:entities/naga'].pools[2].entries.map(e => e.name)
ok('a trophy put in the Naga\'s spoils is not added', naga.indexOf('twilightforest:lich_trophy') < 0 && naga.length == 5, naga.join())
ok('... and the error says why', W.errors.some(e => /lich_trophy/.test(e) && /progression/.test(e)))

// An item that doesn't exist (a typo, or a mod removed) is skipped; one bad id would empty the whole table.
W = setup({ noItems: ['minecraft:totem_of_undying'] })
W.run()
const queen = W.written['twilightforest:entities/snow_queen'].pools[2].entries.map(e => e.name)
ok('an unknown item is skipped and the rest are added', queen.indexOf('minecraft:totem_of_undying') < 0 && queen.length == 7, queen.join())
ok('... with an error', W.errors.some(e => /totem_of_undying/.test(e)))
W = setup({ noItems: ['farmersdelight:potato_crate'] })
W.run()
ok('without Farmer\'s Delight: no crate pool, the spoils still go in', W.written['twilightforest:entities/naga'].pools.length == 2 && W.errors.some(e => /potato_crate/.test(e)))

console.log(fails ? fails + ' FAILED' : 'ALL PASSED')
