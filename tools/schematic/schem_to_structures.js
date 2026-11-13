// Splits a Sponge .schem (v2 or v3) into square pieces saved as vanilla structure files (.nbt), so a script can place
// a large build a piece at a time with /place template, and works out where people can stand in a round arena.
//
// Usage: node schem_to_structures.js <input.schem> <output dir> [piece size, default 33]
//
// - Each piece is <size> x <full height> x <size>, named p_<i>_<k>.nbt (i along x, k along z, from 0), placed at
//   corner + (i * size, 0, k * size). Air is left out, so placing a piece never clears anything.
// - The pieces keep the schematic's DataVersion, so Minecraft upgrades any block that changed since it was saved.
// - It prints the layout for gladiator_arena.js: the size, the pieces, and standing spots (offsets from the corner,
//   feet position): SPAWNS on the floor between the centre and the wall, STANDS on top of the wall. A standing spot
//   has a solid full block under it, room for a player, and open sky above (not under a tree or an overhang).
// Only reads the input; writes only into the output folder. Needs Node, nothing else.
const fs = require('fs')
const path = require('path')
const { read, write, varints, T } = require('./nbt.js')

const [input, outDir, sizeArg] = process.argv.slice(2)
if (!input || !outDir) { console.error('usage: node schem_to_structures.js <input.schem> <output dir> [piece size]'); process.exit(1) }
const PIECE = Number(sizeArg || 33)
let s = read(fs.readFileSync(input)).value
if (s.Schematic) s = s.Schematic
const v3 = !!s.Blocks
const W = s.Width, H = s.Height, L = s.Length
const palette = v3 ? s.Blocks.Palette : s.Palette
const ids = varints(v3 ? s.Blocks.Data : s.BlockData)
if (ids.length !== W * H * L) throw new Error('block data has ' + ids.length + ' entries, expected ' + W * H * L)
if (((v3 ? s.Blocks.BlockEntities : s.BlockEntities) || []).length) console.warn('Note: block entities (chests, signs) are not copied')
if ((s.Entities || []).length) console.warn('Note: entities are not copied')
const byId = {}
Object.keys(palette).forEach(k => { byId[palette[k]] = k })
const at = (x, y, z) => (x < 0 || y < 0 || z < 0 || x >= W || y >= H || z >= L ? 'minecraft:air' : byId[ids[(y * L + z) * W + x]])
const isAir = id => /^minecraft:(air|cave_air|void_air)$/.test(id)

// "minecraft:oak_stairs[facing=east,half=top]" -> { Name, Properties }
function parseState(state) {
  const m = state.match(/^([^\[]+)(?:\[(.*)\])?$/)
  const props = {}
  if (m[2]) m[2].split(',').forEach(kv => { const i = kv.indexOf('='); props[kv.slice(0, i)] = kv.slice(i + 1) })
  return { name: m[1], props }
}

// ---- the pieces ----
fs.mkdirSync(outDir, { recursive: true })
const pieces = []
const nx = Math.ceil(W / PIECE), nz = Math.ceil(L / PIECE)
let total = 0
for (let i = 0; i < nx; i++) for (let k = 0; k < nz; k++) {
  const x0 = i * PIECE, z0 = k * PIECE, w = Math.min(PIECE, W - x0), l = Math.min(PIECE, L - z0)
  const states = [], index = {}, blocks = []
  for (let y = 0; y < H; y++) for (let z = 0; z < l; z++) for (let x = 0; x < w; x++) {
    const id = at(x0 + x, y, z0 + z)
    if (isAir(id)) continue
    if (index[id] == null) { index[id] = states.length; states.push(id) }
    blocks.push(T.compound({ pos: T.list('int', [T.int(x), T.int(y), T.int(z)]), state: T.int(index[id]) }))
  }
  const pal = states.map(st => {
    const p = parseState(st), c = { Name: T.string(p.name) }
    if (Object.keys(p.props).length) c.Properties = T.compound(Object.fromEntries(Object.entries(p.props).map(([a, b]) => [a, T.string(b)])))
    return T.compound(c)
  })
  const file = 'p_' + i + '_' + k + '.nbt'
  fs.writeFileSync(path.join(outDir, file), write('', T.compound({
    DataVersion: T.int(s.DataVersion), size: T.list('int', [T.int(w), T.int(H), T.int(l)]),
    palette: T.list('compound', pal), blocks: T.list('compound', blocks), entities: T.list('compound', []),
  })))
  pieces.push({ i, k, file, blocks: blocks.length })
  total += blocks.length
}

// ---- where people can stand ----
const plant = id => /^minecraft:(grass|tall_grass|fern|large_fern|poppy|dandelion|[a-z_]*_carpet)(\[|$)/.test(id)
const clear = id => isAir(id) || plant(id)
const ground = id => !clear(id) && !/leaves|fence|wall|trapdoor|slab|stairs|glass|lantern|door|anvil|cauldron/.test(id)
// The standing spot in a column: the highest feet position on solid ground with open sky above, or -1.
function spot(x, z) {
  for (let y = H - 1; y >= 1; y--) {
    if (!clear(at(x, y, z))) {
      if (!ground(at(x, y, z))) return -1             // the top of the column isn't solid ground (a tree, a fence)
      return y + 1 <= H - 2 ? y + 1 : -1
    }
  }
  return -1
}
const cx = Math.floor(W / 2), cz = Math.floor(L / 2)
function pick(count, rMin, rMax, rWant, highest) {
  const cands = []
  for (let z = 0; z < L; z++) for (let x = 0; x < W; x++) {
    const r = Math.hypot(x - cx, z - cz)
    if (r < rMin || r > rMax) continue
    const y = spot(x, z)
    if (y >= 0 && clear(at(x, y + 1, z))) cands.push({ x, y, z, r, a: Math.atan2(z - cz, x - cx) })
  }
  const out = []
  for (let n = 0; n < count; n++) {
    const want = -3.14159265 + (n + 0.5) * 2 * 3.14159265 / count
    let best = null, bestScore = Infinity
    cands.forEach(c => {
      let da = Math.abs(c.a - want)
      if (da > 3.14159265) da = 2 * 3.14159265 - da
      const score = da * 40 + Math.abs(c.r - rWant) - (highest ? c.y * 2 : 0)
      if (score < bestScore) { bestScore = score; best = c }
    })
    if (best) out.push([best.x, best.y, best.z])
  }
  return out
}
// The wall: along 16 directions, how far out the floor stays low (top below 10), i.e. the wall's inner edge.
const inner = []
for (let n = 0; n < 16; n++) {
  const a = n * 2 * 3.14159265 / 16
  let r = 20
  for (; r < Math.min(cx, cz); r++) {
    const x = Math.round(cx + Math.cos(a) * r), z = Math.round(cz + Math.sin(a) * r)
    let y = H - 1
    while (y > 0 && isAir(at(x, y, z))) y--
    if (y >= 10 && r > 60) break
  }
  inner.push(r)
}
const spawns = pick(16, 30, 58, 46, false)
const stands = pick(8, 72, 81, 77, true)
const layout = { size: [W, H, L], piece: PIECE, pieces: pieces.length, blocks: total, centre: [cx, cz], wallInnerRadius: Math.min.apply(null, inner), spawns, stands }
console.log(pieces.map(p => p.file + ' ' + p.blocks).join('\n'))
console.log(JSON.stringify(layout))
