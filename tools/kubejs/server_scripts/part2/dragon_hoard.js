// Part II: a dragon's hoard. Ice and Fire's dragon lair chests (fire, ice and lightning; the caves where a dragon
// sleeps, and the roosts) get bonus treasure the first time they're opened: gold, gems, silver and sapphires, dragon
// bones, scales of the lair's dragon type and a chance of its blood. Caves get 3-5 bonus stacks, roosts 1-3.
// Anything the Blood Pool still seals (global.BloodPool.isLocked) is skipped, so the hoard never jumps a tier.
// Same method as part2/deep_records.js: the chest is noted on the right-click while it still has its loot table,
// then topped up a couple of ticks later, once its own loot is in.
// Copy to <server>/kubejs/server_scripts/part2/ and run /reload. See tools/kubejs/DRAGON_HOARD.md.
// KubeJS 6 (Rhino): no template strings; `let` inside nested blocks.

(function () {

// ===================== SETTINGS =====================

// Loot tables (iceandfire-2.1.13-1.20.1) -> the lair's dragon type and whether it's a cave (where the dragon sleeps).
const LAIRS = {
  'iceandfire:chest/fire_dragon_female_cave':      { type: 'fire', cave: true },
  'iceandfire:chest/fire_dragon_male_cave':        { type: 'fire', cave: true },
  'iceandfire:chest/fire_dragon_roost':            { type: 'fire', cave: false },
  'iceandfire:chest/ice_dragon_female_cave':       { type: 'ice', cave: true },
  'iceandfire:chest/ice_dragon_male_cave':         { type: 'ice', cave: true },
  'iceandfire:chest/ice_dragon_roost':             { type: 'ice', cave: false },
  'iceandfire:chest/lightning_dragon_female_cave': { type: 'lightning', cave: true },
  'iceandfire:chest/lightning_dragon_male_cave':   { type: 'lightning', cave: true },
  'iceandfire:chest/lightning_dragon_roost':       { type: 'lightning', cave: false },
}
const STACKS = { cave: [3, 5], roost: [1, 3] }     // how many bonus stacks a chest gets (min, max)

// The hoard. weight: how likely; count: [min, max]. 'scales' and 'blood' become the lair's dragon type.
// Each chest takes different entries (no entry twice).
const HOARD = [
  { item: 'minecraft:gold_ingot', weight: 20, count: [8, 20] },
  { item: 'minecraft:gold_block', weight: 5, count: [1, 3] },
  { item: 'minecraft:diamond', weight: 10, count: [2, 5] },
  { item: 'minecraft:emerald', weight: 10, count: [3, 8] },
  { item: 'iceandfire:sapphire_gem', weight: 8, count: [2, 6] },
  { item: 'iceandfire:silver_ingot', weight: 10, count: [4, 12] },
  { item: 'iceandfire:dragonbone', weight: 15, count: [2, 6] },
  { item: 'scales', weight: 12, count: [3, 8] },
  { item: 'blood', weight: 4, count: [1, 1] },
  { item: 'minecraft:experience_bottle', weight: 6, count: [3, 8] },
  { item: 'minecraft:golden_apple', weight: 4, count: [1, 2] },
]
// Scale colours by dragon type (Ice and Fire spells amethyst "amythest").
const SCALES = {
  fire: ['red', 'green', 'bronze', 'gray'],
  ice: ['blue', 'white', 'sapphire', 'silver'],
  lightning: ['electric', 'amythest', 'copper', 'black'],
}
const BLOOD = { fire: 'iceandfire:fire_dragon_blood', ice: 'iceandfire:ice_dragon_blood', lightning: 'iceandfire:lightning_dragon_blood' }
const DATA_KEY = 'dragon_hoard'

// ===================== STATE =====================

const pending = {}
let data = null
function db() {
  if (data) return data
  data = { chests: 0, stacks: 0 }
  let raw = ''
  try { raw = String(Utils.server.persistentData.getString(DATA_KEY) || '') } catch (e) { }
  if (raw) {
    try {
      let d = JSON.parse(raw)
      if (d && typeof d.chests == 'number') data = d
    } catch (e) {
      console.error('[DragonHoard] Saved data could not be read; a copy is kept')
      try { Utils.server.persistentData.putString(DATA_KEY + '_unreadable_' + Date.now(), raw) } catch (e2) { }
    }
  }
  return data
}
function save() {
  try { Utils.server.persistentData.putString(DATA_KEY, JSON.stringify(db())) } catch (e) { console.error('[DragonHoard] Save failed: ' + e) }
}

// ===================== THE HOARD =====================

function randInt(a, b) { return a + Math.floor(Math.random() * (b - a + 1)) }
function itemFor(entry, type) {
  if (entry.item == 'scales') { let c = SCALES[type]; return 'iceandfire:dragonscales_' + c[Math.floor(Math.random() * c.length)] }
  if (entry.item == 'blood') return BLOOD[type]
  return entry.item
}
function sealed(id) {
  const BP = global.BloodPool
  if (!BP) return false
  try { return !!BP.isLocked(id) } catch (e) { return false }
}
// Rolls the bonus stacks for one chest: [{ id, count }].
function rollHoard(lair) {
  const range = lair.cave ? STACKS.cave : STACKS.roost
  const want = randInt(range[0], range[1])
  // Entries whose items the Pool still seals are left out (scales and blood: checked for this lair's type).
  let open = HOARD.filter(e => {
    if (e.item == 'scales') return !sealed('iceandfire:dragonscales_' + SCALES[lair.type][0])
    if (e.item == 'blood') return !sealed(BLOOD[lair.type])
    return !sealed(e.item)
  })
  const out = []
  while (out.length < want && open.length) {
    let total = open.reduce((a, e) => a + e.weight, 0)
    let r = Math.random() * total
    let pick = open[open.length - 1]
    for (let i = 0; i < open.length; i++) { r -= open[i].weight; if (r < 0) { pick = open[i]; break } }
    open = open.filter(e => e !== pick)
    out.push({ id: itemFor(pick, lair.type), count: randInt(pick.count[0], pick.count[1]) })
  }
  return out
}
// Puts each stack into an empty slot; stops when the chest is full.
function fill(container, stacks) {
  let placed = 0
  try {
    let size = container.getContainerSize()
    let slot = 0
    stacks.forEach(s => {
      while (slot < size && !container.getItem(slot).isEmpty()) slot++
      if (slot >= size) return
      container.setItem(slot, Item.of(s.id, s.count))
      placed++
      slot++
    })
    try { container.setChanged() } catch (e) { }
  } catch (e) { console.warn('[DragonHoard] Could not fill a chest: ' + e) }
  return placed
}

function lootTableOf(block) {
  try {
    let nbt = block.entityData
    if (nbt != null && nbt.contains('LootTable')) return String(nbt.getString('LootTable'))
  } catch (e) { }
  return ''
}

BlockEvents.rightClicked(event => {
  const b = event.block
  const table = lootTableOf(b)
  if (!table || !LAIRS[table]) return
  const x = Number(b.x), y = Number(b.y), z = Number(b.z), key = x + '|' + y + '|' + z
  if (pending[key]) return
  pending[key] = true
  const level = b.level, lair = LAIRS[table]
  event.server.scheduleInTicks(2, () => {
    delete pending[key]
    try {
      let block = level.getBlock(x, y, z)
      if (lootTableOf(block)) return                         // it didn't open
      let stacks = rollHoard(lair)
      let n = fill(block.entity, stacks)
      let D = db()
      D.chests++
      D.stacks += n
      save()
      console.info('[DragonHoard] ' + lair.type + ' dragon ' + (lair.cave ? 'cave' : 'roost') + ' chest at ' + x + ' ' + y + ' ' + z + ': ' +
        stacks.slice(0, n).map(s => s.count + ' ' + s.id).join(', '))
    } catch (e) { console.error('[DragonHoard] Chest: ' + e) }
  })
})

global.DragonHoard = {
  lairs: LAIRS,
  hoard: HOARD,
  stats: () => JSON.parse(JSON.stringify(db())),
}

})()
