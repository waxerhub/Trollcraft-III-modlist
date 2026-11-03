// Generates the Potato War's FTB Quests files (tools/ftbquests/quests/) from the node list in
// tools/kubejs/server_scripts/part2/potato_tree.js and the ranks in part2/blood_pool.js, so the quest book and the
// locks never drift apart. Run after changing NODES or the ranks:   node tools/ftbquests/generate_quests.js
// Then upload tools/ftbquests/quests/chapters/potato_war_*.snbt (and chapter_groups.snbt, see POTATO_TREE.md) to the
// server's config/ftbquests/quests/ and run /ftbquests reload (or restart).
//
// The format follows FTB Quests 2001.4.22 (BaseQuestFile.writeDataFull, Quest/Chapter/ItemTask/StageTask/StageReward
// writeData): one SNBT file per chapter, 16-hex-digit ids, item tasks that consume, stage rewards claimed invisibly.
'use strict'
const fs = require('fs')
const path = require('path')

const ROOT = path.resolve(__dirname, '..', '..')
const SCRIPTS = path.join(ROOT, 'tools', 'kubejs', 'server_scripts', 'part2')
const OUT = path.join(__dirname, 'quests')

// ---------- load the two scripts with do-nothing stand-ins for KubeJS ----------
function stub() {
  const f = function () { return stubObj }
  return new Proxy(f, { get: (t, k) => (k === Symbol.toPrimitive ? () => '' : stubObj), apply: () => stubObj })
}
const stubObj = stub()
const globalObj = {}
function load(file) {
  const src = fs.readFileSync(path.join(SCRIPTS, file), 'utf8')
  const names = ['ServerEvents', 'PlayerEvents', 'BlockEvents', 'ItemEvents', 'EntityEvents', 'Utils', 'Text', 'Item', 'JsonIO', 'Java', 'console', 'global']
  const quietConsole = { info() {}, warn() {}, error() {}, log() {} }
  const args = [stubObj, stubObj, stubObj, stubObj, stubObj, { server: null }, stubObj, stubObj, stubObj,
    { loadClass: () => { throw new Error('no classes here') } }, quietConsole, globalObj]
  new Function(...names, src)(...args)
}
load('blood_pool.js')
load('potato_tree.js')
const BP = globalObj.BloodPool, PT = globalObj.PotatoTree
if (!BP || !PT) throw new Error('could not load the scripts')

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
const chapterId = key => PT.chapterId(key)
const GROUP_ID = P + hex8(0xA001)
const fmt = n => String(n).replace(/\B(?=(\d{3})+(?!\d))/g, ',')

// ---------- the quests ----------
function rankTask(n, k, rank) {
  return { id: taskId(n, k), type: 'stage', stage: 'potato_standing_' + rank, title: 'Rank: ' + BP.rankName(rank) }
}
function nodeQuest(N) {
  const tasks = []
  let k = 0
  if (N.rank > 0) tasks.push(rankTask(N.n, k++, N.rank))
  if (N.tier > 0) tasks.push({ id: taskId(N.n, k++), type: 'stage', stage: 'blood_pool_tier_' + N.tier, title: 'Blood Pool: Tier ' + N.tier })
  if (N.potatoes > 0) {
    tasks.push({ id: taskId(N.n, k++), type: 'item', item: 'minecraft:potato', count: L(N.potatoes), consume_items: true,
      tags: ['potato_offer'], title: fmt(N.potatoes) + ' potatoes for the war chest' })
  }
  ;(N.items || []).forEach(it => {
    const t = { id: taskId(N.n, k++), type: 'item', item: it[0], consume_items: true }
    if (it[1] > 1) t.count = L(it[1])
    tasks.push(t)
  })
  const unlocks = []
  if ((N.materials || []).length) unlocks.push('Tinkers materials: ' + N.materials.map(m => m.split(':')[1].replace(/_/g, ' ')).join(', '))
  if ((N.places || []).length) unlocks.push('Place' + ((N.use == null || N.use.length) ? ' and use' : '') + ': ' + N.places.map(m => m.split(':')[1].replace(/_/g, ' ')).join(', '))
  if ((N.wireless || []).length) unlocks.push('Wireless terminals: ' + N.wireless.map(m => m.split(':')[1].replace(/_/g, ' ')).join(', '))
  const needs = (N.needs || []).map(id => PT.nodes.find(x => x.id === id))
  const desc = [N.desc, '', '&6Unlocks&r']
    .concat(unlocks.map(u => '- ' + u))
    .concat(['', '&7Needs ' + (N.rank ? BP.rankName(N.rank) : 'no rank') + (N.tier ? ', Blood Pool Tier ' + N.tier : '') +
      (needs.length ? ', and ' + needs.map(x => x.name).join(' and ') : '') + '.',
    '&7Potatoes handed in here count toward your rank. Items are taken when you submit them.',
    '&7Falls to you for free once the Blood Pool is ' + BP.catchUpGap + ' tiers past Tier ' + Math.max(1, N.tier || 0, N.rank || 0) + ' (catch-up).'])
  const q = {
    id: questId(N.n), title: N.name, icon: N.icon, x: D(N.x), y: D(N.y),
    subtitle: (N.rank ? BP.rankName(N.rank) : 'No rank') + (N.tier ? ' · Tier ' + N.tier : ''),
    description: desc, tags: ['potato_tree'],
    tasks: tasks,
    rewards: [{ id: rewardId(N.n, 0), type: 'stage', stage: PT.stagePrefix + N.id, auto: 'invisible' }],
  }
  if (needs.length) q.dependencies = needs.map(x => questId(x.n))
  return q
}
function rankQuest(r) {
  const n = 100 + r
  const q = {
    id: questId(n), title: BP.rankName(r), icon: r == BP.rankCount ? 'minecraft:golden_carrot' : 'minecraft:potato',
    x: D(0), y: D(-(r - 1) * 1.5), subtitle: 'Rank ' + r,
    description: ['Offer potatoes with &6/potatowar offer&r (or hand them in for nodes in this book).',
      'Rank ' + r + ' lets you craft Tier ' + r + '\'s items at a crafting table, once the Blood Pool opens it.',
      '&7Catch-up: when the Blood Pool is ' + BP.catchUpGap + ' tiers past Tier ' + r + ', you can craft it whatever your rank.'],
    tags: ['potato_rank'],
    tasks: [rankTask(n, 0, r)],
  }
  if (r > 1) q.dependencies = [questId(100 + r - 1)]
  return q
}

// ---------- the files ----------
const order = Object.keys(PT.chapters)
function chapterFile(key, quests, subtitle) {
  const c = PT.chapters[key]
  return {
    id: chapterId(key), group: GROUP_ID, order_index: order.indexOf(key), filename: c[3], title: c[1], icon: c[2],
    subtitle: subtitle, default_quest_shape: '', default_hide_dependency_lines: false, quests: quests, quest_links: [],
  }
}
const files = {}
const ranks = []
for (let r = 1; r <= BP.rankCount; r++) ranks.push(rankQuest(r))
files.ranks = chapterFile('ranks', ranks, ['Techno\'s Potato War: your rank, from the potatoes you offer.', 'Each rank opens a tier of crafting-table recipes.'])
const subtitles = {
  smithy: ['Your own smeltery and foundry, and the metals your Tinkers tools may be made of.'],
  logistics: ['Moving items between machines.'],
  autocrafting: ['Machines that craft for you.'],
  farms: ['Machines that grow and harvest for you.'],
}
Object.keys(subtitles).forEach(key => { files[key] = chapterFile(key, PT.nodes.filter(N => N.chapter === key).map(nodeQuest), subtitles[key]) })

fs.mkdirSync(path.join(OUT, 'chapters'), { recursive: true })
Object.keys(files).forEach(key => {
  fs.writeFileSync(path.join(OUT, 'chapters', PT.chapters[key][3] + '.snbt'), snbt(files[key]) + '\n')
})
fs.writeFileSync(path.join(OUT, 'chapter_groups.snbt'), snbt({ chapter_groups: [{ id: GROUP_ID, title: 'Techno\'s Potato War', icon: 'minecraft:potato' }] }) + '\n')
console.log('Wrote ' + Object.keys(files).length + ' chapters (' + PT.nodes.length + ' nodes, ' + BP.rankCount + ' ranks) to ' + OUT)
