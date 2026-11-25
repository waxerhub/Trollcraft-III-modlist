// Can every upgrade-tree node be bought? Checked against every recipe in the Part II jars (research/index) and the
// scripts' own tiers and nodes: at the Blood Pool tier a node opens, its item cost must be makeable without the node
// itself (or one above it). Players found the case this guards against on 2026-11-25: Create Automation, which lets you
// place a Deployer, cost precision mechanisms, which only Deployers make. It knows recipes, not the world: an item
// nothing makes counts as found, and so does anything a loot table gives.
// It also checks the cost items against Almost Unified, which replaces duplicate metals at load time.
// Run with: node tools/tests/run_all.js tree_costs
const fs = require('fs'), path = require('path'), zlib = require('zlib')
const paths = require('../lib/paths')
let fails = 0
const ok = (l, c, e) => { console.log((c ? 'ok   ' : 'FAIL ') + l + (!c && e !== undefined ? '  ' + e : '')); if (!c) fails++ }

const INDEX = paths.repo('research/index')
const has = f => fs.existsSync(path.join(INDEX, f + '.tsv.gz'))
if (!['recipes', 'tag_members', 'loot'].every(has)) {
  ok('no recipe index here (research/index): nothing to check', true)
  console.log('ALL PASSED')
  process.exit(0)
}
const read = f => zlib.gunzipSync(fs.readFileSync(path.join(INDEX, f + '.tsv.gz'))).toString('utf8').split('\n').slice(1).filter(Boolean).map(l => l.split('\t'))
const { BP, PT } = require(paths.repo('tools/ftbquests/load_scripts.js'))()

// ---------- the recipes, tags and found things ----------
const list = s => (s || '').split(',').filter(Boolean)
const recipes = read('recipes').map(r => ({ id: r[0], type: r[2].replace(/^minecraft:/, ''), outs: list(r[3]), items: list(r[4]), tags: list(r[5]) }))
const members = {}
read('tag_members').forEach(([kind, tag, jar, m]) => { if (kind == 'items' || kind == 'item') (members[tag] = members[tag] || new Set()).add(m) })
const found = new Set()      // given by a loot table other than its own block's
read('loot').forEach(([table, jar, entry]) => {
  const m = table.match(/^([^:]+):blocks\/(.+)$/)
  if (entry && entry[0] != '#' && !(m && entry == m[1] + ':' + m[2])) found.add(entry)
})

// ---------- when the Blood Pool lets a recipe exist ----------
const ITEM = {}, MOD = {}, TAG = {}, IDS = []
BP.tiers.forEach(T => {
  const u = T.unlocks || {}
  ;(u.items || []).forEach(i => { ITEM[i] = T.tier })
  ;(u.mods || []).forEach(m => { if (MOD[m] == null) MOD[m] = T.tier })
  ;(u.tags || []).forEach(t => { TAG[String(t).replace(/^#/, '')] = T.tier })
  ;(u.recipes || []).forEach(r => IDS.push([r, T.tier]))
})
const tierMemo = {}
function tierOf(i) {
  if (tierMemo[i] != null) return tierMemo[i]
  let t = ITEM[i]
  if (t == null) {
    t = MOD[i.split(':')[0]] || 0
    Object.keys(TAG).forEach(k => { if (members[k] && members[k].has(i)) t = Math.max(t, TAG[k]) })
  }
  return (tierMemo[i] = t)
}
recipes.forEach(r => {
  r.tier = r.outs.length ? tierOf(r.outs[0]) : 0
  IDS.forEach(([x, t]) => { if (x instanceof RegExp ? x.test(r.id) : x == r.id) r.tier = Math.max(r.tier, t) })
})
// The machines a node lets you place, and the recipes that need one (any of the nodes named will do).
const NEEDS_NODE = {
  'create:deploying': ['create_automation'], 'create:sequenced_assembly': ['create_automation'],
  'create:mechanical_crafting': ['mechanical_crafting'], 'immersiveengineering:cloche': ['garden_cloche'],
  'thermal:insolator': ['insolation'], 'tconstruct:alloy': ['seared_smeltery', 'foundry'], 'tconstruct:entity_melting': ['seared_smeltery'],
}
const makers = {}
recipes.forEach(r => r.outs.forEach(o => (makers[o] = makers[o] || []).push(r)))
// What can't be made at Pool tier T by someone with these nodes.
function unmakeable(T, owned) {
  const bad = new Set()
  const usable = r => r.tier <= T && (!NEEDS_NODE[r.type] || NEEDS_NODE[r.type].some(n => owned.has(n))) &&
    !r.items.some(i => bad.has(i)) && !r.tags.some(t => members[t] && members[t].size && [...members[t]].every(m => bad.has(m)))
  for (let again = true; again;) {
    again = false
    Object.keys(makers).forEach(o => { if (!bad.has(o) && !found.has(o) && !makers[o].some(usable)) { bad.add(o); again = true } })
  }
  return bad
}
const nodeTier = N => Math.max(1, N.tier || 0, N.rank || 0)
// Buys every node it can, tier by tier. Returns what's stuck at the node's own tier: [{ node, why }].
function walk(costs) {
  const owned = new Set(), stuck = []
  for (let T = 1; T <= BP.tiers.length; T++) {
    for (let again = true; again;) {
      again = false
      const bad = unmakeable(T, owned)
      PT.nodes.forEach(N => {
        if (owned.has(N.id) || nodeTier(N) > T || !(N.needs || []).every(x => owned.has(x))) return
        if (!costs(N).some(i => bad.has(i[0]))) { owned.add(N.id); again = true }
      })
    }
    const bad = unmakeable(T, owned)
    PT.nodes.filter(N => nodeTier(N) == T && !owned.has(N.id)).forEach(N => stuck.push({ node: N.id, why: costs(N).filter(i => bad.has(i[0])).map(i => i[0]).join(', ') || 'waits for ' + N.needs.filter(x => !owned.has(x)).join(', ') }))
  }
  return stuck
}
const show = s => s.map(x => x.node + ' (' + x.why + ')').join('; ')

const stuck = walk(N => N.items || [])
ok('every node (' + PT.nodes.length + ') can be bought at its own tier, without what it unlocks', stuck.length == 0, show(stuck))
// ... and this check would have caught the one players found
const before = walk(N => N.id == 'create_automation' ? [['create:precision_mechanism', 8]] : N.items || [])
ok('with the old cost it names Create Automation, and Mechanical Crafting behind it', before.map(x => x.node).sort().join() == 'create_automation,mechanical_crafting' &&
  /precision_mechanism/.test(show(before)), show(before))

// ---------- Almost Unified ----------
// Its defaults, as the pack runs them on the test server (config/almostunified/unify.json, 2026-11-25): where several
// mods have the same metal part, every recipe makes the one from the first mod here, and the others can't be made.
// So a cost naming another mod's can't be paid.
const PRIORITY = ['minecraft', 'kubejs', 'crafttweaker', 'create', 'thermal', 'immersiveengineering', 'mekanism']
const MATERIALS = ('aeternium aluminum amber apatite bitumen brass bronze charcoal chrome cinnabar coal coal_coke cobalt constantan copper diamond electrum elementium emerald ' +
  'enderium fluorite gold graphite invar iridium iron lapis lead lumium mithril netherite nickel obsidian osmium peridot platinum potassium_nitrate ruby sapphire signalum silver ' +
  'steel sulfur tin tungsten uranium zinc').split(' ')
const KINDS = ['nuggets', 'dusts', 'gears', 'gems', 'ingots', 'raw_materials', 'plates', 'rods', 'wires', 'storage_blocks']
function unifiedTo(item) {
  for (let k = 0; k < KINDS.length; k++) {
    for (let m = 0; m < MATERIALS.length; m++) {
      const set = members['forge:' + KINDS[k] + '/' + MATERIALS[m]]
      if (!set || !set.has(item) || set.size < 2) continue
      for (const mod of PRIORITY) { const hit = [...set].filter(x => x.split(':')[0] == mod); if (hit.length) return hit.indexOf(item) >= 0 ? null : hit[0] }
    }
  }
  return null
}
// Known, and left as they are: both nodes are Tier 3, and catch-up gives them to everyone at Tier 5 (POTATO_TREE.md).
const KNOWN = { steel_smithing: 'thermal:steel_ingot', immersive_logistics: 'thermal:steel_ingot' }
const replaced = []
PT.nodes.forEach(N => (N.items || []).forEach(i => { const to = unifiedTo(i[0]); if (to) replaced.push([N.id, i[0], to]) }))
const unknown = replaced.filter(r => KNOWN[r[0]] != r[2])
ok('no node asks for a metal Almost Unified replaces, but the two known ones', unknown.length == 0 && replaced.length == Object.keys(KNOWN).length, replaced.map(r => r.join(' ')).join('; '))

console.log(fails ? fails + ' FAILED' : 'ALL PASSED')
