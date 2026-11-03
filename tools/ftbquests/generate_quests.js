// Generates, from the scripts' own lists (part2/blood_pool.js tiers and ranks, part2/potato_tree.js NODES):
//   tools/ftbquests/quests/            the Potato War's FTB Quests files (seven chapters and the group)
//   tools/kubejs/client_scripts/potato_tooltips.js   the item tooltips (for the modpack)
// so the book, the tooltips and the locks never drift apart. Run after changing the tiers, ranks or nodes:
//   node tools/ftbquests/generate_quests.js
// Then upload the changed chapter files to the server's config/ftbquests/quests/ (and /ftbquests reload), and put
// the tooltip script in the modpack's kubejs/client_scripts/.
//
// The format follows FTB Quests 2001.4.22 (checked in its jar): one SNBT file per chapter, 16-hex-digit ids, task
// types "item", "gamestage" and "checkmark", reward type "gamestage" claimed invisibly ("auto": "invisible").
'use strict'
const fs = require('fs')
const path = require('path')
const { BP, PT } = require('./load_scripts.js')()

const ROOT = path.resolve(__dirname, '..', '..')
const OUT = path.join(__dirname, 'quests')
const CLIENT_OUT = path.join(ROOT, 'tools', 'kubejs', 'client_scripts', 'potato_tooltips.js')

// ---------- SNBT writer (FTB Library style) ----------
class Long { constructor(v) { this.v = v } }
class Dbl { constructor(v) { this.v = v } }
const L = v => new Long(v), D = v => new Dbl(v)
function str(s) { return '"' + String(s).replace(/\\/g, '\\\\').replace(/"/g, '\\"') + '"' }
function snbt(v, ind) {
  ind = ind || ''
  const next = ind + '\t'
  if (v instanceof Long) return v.v + 'L'
  if (v instanceof Dbl) return (Number.isInteger(v.v) ? v.v.toFixed(1) : String(v.v)) + 'd'
  if (typeof v === 'boolean') return v ? 'true' : 'false'
  if (typeof v === 'number') return String(v)
  if (typeof v === 'string') return str(v)
  if (Array.isArray(v)) {
    if (!v.length) return '[ ]'
    if (v.every(x => typeof x === 'string')) return '[' + v.map(str).join(', ') + ']'
    return '[\n' + v.map(x => next + snbt(x, next)).join('\n') + '\n' + ind + ']'
  }
  const keys = Object.keys(v).sort()
  return '{\n' + keys.map(k => next + k + ': ' + snbt(v[k], next)).join('\n') + '\n' + ind + '}'
}

// ---------- ids ----------
const P = PT.idPrefix
const hex8 = v => ('00000000' + v.toString(16).toUpperCase()).slice(-8)
const questId = n => P + hex8(0x10000 + n)
const taskId = (n, k) => P + hex8(0x20000 + n * 16 + k)
const rewardId = (n, k) => P + hex8(0x30000 + n * 16 + k)
const GROUP_ID = P + hex8(0xA001)
// quest numbers: nodes use their n (1-99); ranks 100 + rank; Blood Pool tiers 200 + tier; Start Here 300 + k
const fmt = n => String(n).replace(/\B(?=(\d{3})+(?!\d))/g, ',')
const pretty = id => id.split(':')[1].replace(/_/g, ' ')
const TASK_STAGE = 'gamestage', TASK_ITEM = 'item', TASK_CHECK = 'checkmark', REWARD_STAGE = 'gamestage'

// ---------- the node quests ----------
function rankTask(n, k, rank) {
  return { id: taskId(n, k), type: TASK_STAGE, stage: 'potato_standing_' + rank, title: 'Rank: ' + BP.rankName(rank) }
}
function tierTask(n, k, tier) {
  return { id: taskId(n, k), type: TASK_STAGE, stage: 'blood_pool_tier_' + tier, title: 'Blood Pool: Tier ' + tier }
}
function nodeQuest(N) {
  const tasks = []
  let k = 0
  if (N.rank > 0) tasks.push(rankTask(N.n, k++, N.rank))
  if (N.tier > 0) tasks.push(tierTask(N.n, k++, N.tier))
  if (N.potatoes > 0) {
    tasks.push({ id: taskId(N.n, k++), type: TASK_ITEM, item: 'minecraft:potato', count: L(N.potatoes), consume_items: true,
      tags: ['potato_offer'], title: fmt(N.potatoes) + ' potatoes for the war chest' })
  }
  ;(N.items || []).forEach(it => {
    const t = { id: taskId(N.n, k++), type: TASK_ITEM, item: it[0], consume_items: true }
    if (it[1] > 1) t.count = L(it[1])
    tasks.push(t)
  })
  const unlocks = []
  if ((N.materials || []).length) unlocks.push('Tinkers materials: ' + N.materials.map(pretty).join(', '))
  if ((N.gear || []).length) unlocks.push('Gear: ' + N.gear.map(pretty).join(', '))
  const usable = N.use != null ? N.use : (N.places || [])
  if ((N.places || []).length) unlocks.push('Place: ' + N.places.map(pretty).join(', '))
  if (usable.length) unlocks.push('Use (whoever placed it): ' + usable.map(pretty).join(', '))
  if ((N.wireless || []).length) unlocks.push('Wireless terminals: ' + N.wireless.map(pretty).join(', '))
  const needs = (N.needs || []).map(id => PT.nodes.find(x => x.id === id))
  const desc = [N.desc, '', '&6Unlocks&r'].concat(unlocks.map(u => '- ' + u))
    .concat(['', '&7Needs ' + (N.rank ? BP.rankName(N.rank) : 'no rank') + (N.tier ? ', Blood Pool Tier ' + N.tier : '') +
      (needs.length ? ', and ' + needs.map(x => x.name).join(' and ') : '') + '.',
    '&7Potatoes handed in here count toward your rank. Items are taken when you submit them (loose potatoes only).',
    '&7Comes to you for free once the Blood Pool is ' + BP.catchUpGap + ' tiers past Tier ' + Math.max(1, N.tier || 0, N.rank || 0) + ' (catch-up).'])
  const q = {
    id: questId(N.n), title: N.name, icon: N.icon, x: D(N.x), y: D(N.y),
    subtitle: (N.rank ? BP.rankName(N.rank) : 'No rank') + (N.tier ? ' · Tier ' + N.tier : ''),
    description: desc, tags: ['potato_tree'], tasks: tasks,
    rewards: [{ id: rewardId(N.n, 0), type: REWARD_STAGE, stage: PT.stagePrefix + N.id, auto: 'invisible' }],
  }
  if (needs.length) q.dependencies = needs.map(x => questId(x.n))
  return q
}
function rankQuest(r) {
  const n = 100 + r
  const T = BP.tiers.find(x => x.tier === r)
  const q = {
    id: questId(n), title: BP.rankName(r), icon: r == BP.rankCount ? 'minecraft:golden_carrot' : 'minecraft:potato',
    x: D(0), y: D(-(r - 1) * 1.5), subtitle: 'Rank ' + r + ' · ' + fmt(BP.standingThresholds[r - 1]) + ' potatoes',
    description: ['Offer potatoes with &6/potatowar offer&r, or hand them in for nodes in this book.',
      'Rank ' + r + ' lets you craft Tier ' + r + (T ? ' (' + T.name + ')' : '') + '\'s items at a crafting table, once the Blood Pool opens it.',
      '&7Catch-up: when the Blood Pool is ' + BP.catchUpGap + ' tiers past Tier ' + r + ', you can craft it whatever your rank (this quest then ticks too).'],
    tags: ['potato_rank'], tasks: [rankTask(n, 0, r)],
  }
  if (r > 1) q.dependencies = [questId(100 + r - 1)]
  return q
}
function tierQuest(T) {
  const n = 200 + T.tier
  const u = T.unlocks
  const lines = ['The whole server fills the Blood Pool: trolls in the Troll Log, Hush Coins (/bloodpool donate) and the Potato Tithe (/bloodpool tithe).',
    '', '&6Opens at ' + fmt(T.drops) + ' Drops&r']
  if ((u.mods || []).length) lines.push('- Mods: ' + u.mods.join(', '))
  if ((u.items || []).length) lines.push('- ' + u.items.length + ' items, e.g. ' + u.items.slice(0, 6).map(pretty).join(', '))
  if ((u.tags || []).length) lines.push('- Tags: ' + u.tags.join(', '))
  if (T.tier === BP.netherTier) lines.push('- &cThe Nether&r')
  if (T.tier === BP.endTier) lines.push('- &5The End&r')
  if (T.tier > BP.rankCount) lines.push('- The Siege of the Citadel')
  if (T.tier <= BP.rankCount) lines.push('', '&7Crafting its items at a table also needs ' + BP.rankName(T.tier) + ' (or catch-up at Tier ' + (T.tier + BP.catchUpGap) + '). Machines work for everyone.')
  const q = {
    id: questId(n), title: 'Tier ' + T.tier + ': ' + T.name, icon: T.tier === BP.netherTier ? 'minecraft:netherrack' : T.tier === BP.endTier ? 'minecraft:ender_eye' : 'minecraft:redstone',
    x: D(0), y: D(-(T.tier - 1) * 1.5), subtitle: fmt(T.drops) + ' Drops', description: lines, tags: ['blood_pool_tier'],
    tasks: [tierTask(n, 0, T.tier)],
  }
  if (T.tier > 1) q.dependencies = [questId(200 + T.tier - 1)]
  return q
}
const START = [
  ['Welcome to the Potato War', 'minecraft:potato', [
    'Technoblade\'s Potato War is back. Everything you can make in Part II is unlocked in two ways:',
    '- &cthe Blood Pool&r, which the whole server fills together, opens a tier for everyone;',
    '- &6your rank and upgrade tree&r, which you earn with potatoes, decide what YOU can make from it.',
    'Hold Shift over an item to see what it needs and whether you have it.']],
  ['The Blood Pool', 'minecraft:redstone_block', [
    'Every troll logged in the Troll Log, every Hush Coin donated (/bloodpool donate) and every potato tithed (/bloodpool tithe) fills it.',
    'It has 12 tiers. Each opens a batch of mods and items for crafting; the Nether opens at Tier ' + BP.netherTier + ' and the End at Tier ' + BP.endTier + '.',
    'Until a tier opens, its items can\'t be crafted by anyone. Things you find or trade still work.',
    'See the chapter "The Blood Pool" and /bloodpool tiers.']],
  ['Your rank', 'minecraft:baked_potato', [
    'Offer potatoes with &6/potatowar offer&r (crates count as 9). Your rank is the lifetime total, with no cap.',
    'Rank n lets you craft Tier n\'s items at a crafting table (also mods\' own crafting recipes). Machines work for everyone.',
    'See the chapter "The Ranks" and /potatowar.']],
  ['Tithe or offer?', 'minecraft:poisonous_potato', [
    '&6/bloodpool tithe&r: potatoes fill the Blood Pool for everyone (capped each day). They never raise your rank.',
    '&6/potatowar offer&r: potatoes raise your rank. They never fill the Pool.',
    'Potatoes handed in for nodes in this book count toward your rank too.']],
  ['The upgrade tree', 'tconstruct:smeltery_controller', [
    'Four chapters of nodes: Tinkers\' Smithy, Logistics, Autocrafting and Farms.',
    'Each node needs a rank, a Blood Pool tier and the nodes below it, and costs potatoes plus some of that branch\'s items.',
    'A node unlocks things for you alone: Tinkers metals your tools may be made of, building smelteries, and placing and using autocrafters, logistics and farm machines.']],
  ['Nobody falls behind', 'minecraft:clock', [
    'When the Blood Pool is ' + BP.catchUpGap + ' tiers past something, it comes to everyone for free: crafting access and every tree node up to that tier.',
    'Your rank\'s name and black market perks still come only from potatoes.']],
  ['The black market', 'minecraft:gold_nugget', [
    'The Hooded Merchant sells some items only to high enough ranks: pranks from Potato Farmer, up to the War Party contract at Potato Captain.']],
  ['Useful commands', 'minecraft:writable_book', [
    '&6/potatowar&r your rank · &6/potatowar next&r what to do next · &6/potatowar tree&r this book',
    '&6/potatowar offer [count]&r · &6/potatowar ranks&r · &6/potatowar top&r',
    '&6/bloodpool&r the Pool · &6/bloodpool tiers&r · &6/bloodpool check&r (hold an item)']],
]
function startQuest(entry, k) {
  const n = 300 + k
  const q = { id: questId(n), title: entry[0], icon: entry[1], x: D(0), y: D(-k * 1.5), description: entry[2], tags: ['potato_start'],
    tasks: [{ id: taskId(n, 0), type: TASK_CHECK, title: 'Read it' }] }
  if (k > 0) q.dependencies = [questId(300 + k - 1)]
  return q
}

// ---------- the chapter files ----------
const order = Object.keys(PT.chapters)
function chapterFile(key, quests, subtitle) {
  const c = PT.chapters[key]
  return {
    id: PT.chapterId(key), group: GROUP_ID, order_index: order.indexOf(key), filename: c[3], title: c[1], icon: c[2],
    subtitle: subtitle, default_quest_shape: '', default_hide_dependency_lines: false, quests: quests, quest_links: [],
  }
}
const files = {}
files.start = chapterFile('start', START.map(startQuest), ['How the Blood Pool, your rank and the upgrade tree fit together.'])
const ranks = []
for (let r = 1; r <= BP.rankCount; r++) ranks.push(rankQuest(r))
files.ranks = chapterFile('ranks', ranks, ['Techno\'s Potato War: your rank, from the potatoes you offer.', 'Each rank opens a tier of crafting-table recipes.'])
files.blood_pool = chapterFile('blood_pool', BP.tiers.map(tierQuest), ['The server\'s Blood Pool: each tier ticks when it opens.'])
const subtitles = {
  smithy: ['Your own smeltery and foundry, and the metals your Tinkers tools may be made of.'],
  logistics: ['Moving items between machines, and automated mining.'],
  autocrafting: ['Machines that craft for you.'],
  farms: ['Machines that grow, harvest and spawn for you.'],
}
Object.keys(subtitles).forEach(key => { files[key] = chapterFile(key, PT.nodes.filter(N => N.chapter === key).map(nodeQuest), subtitles[key]) })

fs.mkdirSync(path.join(OUT, 'chapters'), { recursive: true })
Object.keys(files).forEach(key => {
  fs.writeFileSync(path.join(OUT, 'chapters', PT.chapters[key][3] + '.snbt'), snbt(files[key]) + '\n')
})
fs.writeFileSync(path.join(OUT, 'chapter_groups.snbt'), snbt({ chapter_groups: [{ id: GROUP_ID, title: 'Techno\'s Potato War', icon: 'minecraft:potato' }] }) + '\n')

// ---------- the tooltip client script ----------
const itemTier = {}, modTier = {}, tagTiers = []
BP.tiers.forEach(T => {
  ;(T.unlocks.items || []).forEach(i => { itemTier[i] = T.tier })
  ;(T.unlocks.mods || []).forEach(m => { if (modTier[m] == null) modTier[m] = T.tier })
  ;(T.unlocks.tags || []).forEach(t => tagTiers.push([t, T.tier]))
})
const nodeName = {}, gear = {}, material = {}, place = {}, wireless = {}
PT.nodes.forEach(N => {
  nodeName[N.id] = N.name
  ;(N.gear || []).forEach(i => { gear[i] = N.id })
  ;(N.materials || []).forEach(m => { material[m] = N.id })
  ;(N.places || []).forEach(i => { place[i] = N.id })
  ;(N.wireless || []).forEach(i => { wireless[i] = N.id })
})
const ranksList = []
for (let r = 0; r <= BP.rankCount; r++) ranksList.push(BP.rankName(r))
const J = o => JSON.stringify(o)
const client = `// GENERATED by tools/ftbquests/generate_quests.js from part2/blood_pool.js and part2/potato_tree.js. Don't edit:
// change those scripts and run the generator again.
//
// Part II: item tooltips for the Potato War. Hold Shift over an item to see what it needs and whether you have it:
// its Blood Pool tier (open or sealed), the rank that crafts it at a table, and the upgrade-tree node it needs to be
// used or placed. ✔/✘ come from the stages the server syncs to you (blood_pool_tier_<n>, potato_standing_<n>,
// potato_tree_<node>). Goes in the MODPACK (every player's kubejs/client_scripts/), not only on the server.
//
// KubeJS 6 notes: no template strings; \`let\` inside nested blocks.

(function () {

const ITEM_TIER = ${J(itemTier)}
const MOD_TIER = ${J(modTier)}
const TAG_TIERS = ${J(tagTiers)}
const RANKS = ${J(ranksList)}
const NODE_NAME = ${J(nodeName)}
const GEAR = ${J(gear)}
const MATERIAL = ${J(material)}
const PLACE = ${J(place)}
const WIRELESS = ${J(wireless)}

function stagesOf() { try { return Client.player ? Client.player.stages : null } catch (e) { return null } }
function has(st, s) { try { return st != null && !!st.has(s) } catch (e) { return false } }
function tierOf(id, item) {
  if (ITEM_TIER[id] != null) return ITEM_TIER[id]
  for (let i = 0; i < TAG_TIERS.length; i++) { try { if (item.hasTag(TAG_TIERS[i][0])) return TAG_TIERS[i][1] } catch (e) { } }
  const m = MOD_TIER[id.split(':')[0]]
  return m != null ? m : 0
}
function materialNode(item) {
  try {
    let tag = item.nbt
    if (!tag || !tag.contains('tic_materials')) return null
    let list = tag.getList('tic_materials', 8)
    for (let i = 0; i < list.size(); i++) {
      let n = MATERIAL[String(list.getString(i)).split('#')[0]]
      if (n) return n
    }
  } catch (e) { }
  return null
}
function line(ok, text) { return Text.of((ok ? '✔ ' : '✘ ') + text)[ok ? 'green' : 'red']() }

ItemEvents.tooltip(event => {
  event.addAdvancedToAll((item, advanced, text) => {
    try {
      let id = String(item.id)
      let tier = tierOf(id, item)
      let useNode = GEAR[id] || materialNode(item) || WIRELESS[id]
      let placeNode = PLACE[id]
      if (!tier && !useNode && !placeNode) return
      if (!event.shift) { text.add(Text.of('Hold Shift: Potato War').darkGray()); return }
      let st = stagesOf()
      text.add(Text.of('Potato War').gold())
      if (tier) {
        text.add(line(has(st, 'blood_pool_tier_' + tier), 'Blood Pool Tier ' + tier + (has(st, 'blood_pool_tier_' + tier) ? ' (open)' : ' (sealed)')))
        if (tier < RANKS.length) text.add(line(has(st, 'potato_standing_' + tier), 'Craft at a table: ' + RANKS[tier]))
      }
      if (useNode) text.add(line(has(st, 'potato_tree_' + useNode), 'Use: ' + NODE_NAME[useNode]))
      if (placeNode) text.add(line(has(st, 'potato_tree_' + placeNode), 'Place and use: ' + NODE_NAME[placeNode]))
    } catch (e) { }
  })
})

})()
`
fs.mkdirSync(path.dirname(CLIENT_OUT), { recursive: true })
fs.writeFileSync(CLIENT_OUT, client)
console.log('Wrote ' + Object.keys(files).length + ' chapters (' + PT.nodes.length + ' nodes, ' + BP.rankCount + ' ranks, ' + BP.tiers.length + ' tiers) to ' + OUT + ', and ' + CLIENT_OUT)
