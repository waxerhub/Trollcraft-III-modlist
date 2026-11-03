// Prints the progression data (Blood Pool tiers, ranks, tree nodes) as JSON, for tools/progression_audit.py.
// Regexes in the tiers' recipe rules are written as { "re": "<source>" }.
'use strict'
const { BP, PT } = require('./load_scripts.js')()
const tiers = BP.tiers.map(T => ({
  tier: T.tier, name: T.name, drops: T.drops,
  mods: T.unlocks.mods || [], items: T.unlocks.items || [], tags: T.unlocks.tags || [],
  recipes: (T.unlocks.recipes || []).map(r => (r instanceof RegExp ? { re: r.source } : r)),
}))
process.stdout.write(JSON.stringify({
  tiers, netherTier: BP.netherTier, endTier: BP.endTier, catchUpGap: BP.catchUpGap,
  ranks: Array.from({ length: BP.rankCount + 1 }, (x, i) => BP.rankName(i)), standing: BP.standingThresholds,
  autocrafters: Object.keys(BP.autocrafters), nodes: PT.nodes, chapters: PT.chapters,
}, null, 1))
