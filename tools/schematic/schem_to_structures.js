// Splits a Sponge .schem (v2 or v3) into pieces saved as vanilla structure files (.nbt), so a script can place a large
// build a piece at a time with /place template.
//
// Usage: node schem_to_structures.js <input.schem> <output dir> [piece size, default 33]
//        node schem_to_structures.js <input.schem> <output dir> --layers
//
// - Square pieces: each is <size> x <full height> x <size>, named p_<i>_<k>.nbt (i along x, k along z, from 0), placed
//   at corner + (i * size, 0, k * size). It also prints the layout for gladiator_arena.js: standing spots (offsets
//   from the corner, feet position), SPAWNS on the floor between the centre and the wall and STANDS on top of the
//   wall. A standing spot has a solid full block under it, room for a player, and open sky above.
// - --layers: one piece per horizontal layer, W x 1 x L, named l_<y>.nbt and placed at corner + (0, y, 0), for a
//   build that rises layer by layer (the Shrine). Empty layers get no file; the layout lists the ones that do.
// - Air is left out, so placing a piece never clears anything.
// - Block entities (a player head's skin, a lectern, signs, chests) are copied exactly into their blocks.
//   Entities (armour stands, item frames) are not.
// - The pieces keep the schematic's DataVersion, so Minecraft upgrades any block that changed since it was saved.
// Only reads the input; writes only into the output folder. Needs Node, nothing else.
const fs = require('fs')
const path = require('path')
const { read, readTyped, write, varints, T } = require('./nbt.js')

const [input, outDir, modeArg] = process.argv.slice(2)
if (!input || !outDir) { console.error('usage: node schem_to_structures.js <input.schem> <output dir> [piece size | --layers]'); process.exit(1) }
const LAYERS = modeArg === '--layers'
const PIECE = LAYERS ? 0 : Number(modeArg || 33)
const raw = fs.readFileSync(input)
let s = read(raw).value
if (s.Schematic) s = s.Schematic
const v3 = !!s.Blocks
const W = s.Width, H = s.Height, L = s.Length
const palette = v3 ? s.Blocks.Palette : s.Palette
const ids = varints(v3 ? s.Blocks.Data : s.BlockData)
if (ids.length !== W * H * L) throw new Error('block data has ' + ids.length + ' entries, expected ' + W * H * L)
if ((s.Entities || []).length) console.warn('Note: ' + s.Entities.length + ' entities are not copied')

// Block entities, with their exact tag types: "x,y,z" -> the structure block's nbt (id plus the data, no Pos).
let ts = readTyped(raw).value
if (ts.v.Schematic) ts = ts.v.Schematic
const tbe = v3 ? (ts.v.Blocks && ts.v.Blocks.v.BlockEntities) : ts.v.BlockEntities
const blockNbt = {}
;(tbe ? tbe.v : []).forEach(be => {
  const f = be.v, p = f.Pos.v
  const data = v3 && f.Data ? Object.assign({}, f.Data.v) : Object.assign({}, f)
  delete data.Pos
  delete data.Id
  data.id = T.string(f.Id.v)
  blockNbt[p[0] + ',' + p[1] + ',' + p[2]] = T.compound(data)
})
if (Object.keys(blockNbt).length) console.log('block entities copied: ' + Object.keys(blockNbt).map(k => k + ' ' + blockNbt[k].v.id.v).join('; '))
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
let total = 0
// Writes the box (x0, y0, z0) .. +(w, h, l) as a structure file; returns its block count (0: nothing written).
function writePiece(file, x0, y0, z0, w, h, l) {
  const states = [], index = {}, blocks = []
  for (let y = 0; y < h; y++) for (let z = 0; z < l; z++) for (let x = 0; x < w; x++) {
    const id = at(x0 + x, y0 + y, z0 + z)
    if (isAir(id)) continue
    if (index[id] == null) { index[id] = states.length; states.push(id) }
    const b = { pos: T.list('int', [T.int(x), T.int(y), T.int(z)]), state: T.int(index[id]) }
    const nbt = blockNbt[(x0 + x) + ',' + (y0 + y) + ',' + (z0 + z)]
    if (nbt) b.nbt = nbt
    blocks.push(T.compound(b))
  }
  if (!blocks.length) return 0
  const pal = states.map(st => {
    const p = parseState(st), c = { Name: T.string(p.name) }
    if (Object.keys(p.props).length) c.Properties = T.compound(Object.fromEntries(Object.entries(p.props).map(([a, b]) => [a, T.string(b)])))
    return T.compound(c)
  })
  fs.writeFileSync(path.join(outDir, file), write('', T.compound({
    DataVersion: T.int(s.DataVersion), size: T.list('int', [T.int(w), T.int(h), T.int(l)]),
    palette: T.list('compound', pal), blocks: T.list('compound', blocks), entities: T.list('compound', []),
  })))
  return blocks.length
}
if (LAYERS) {
  for (let y = 0; y < H; y++) {
    const file = 'l_' + y + '.nbt', n = writePiece(file, 0, y, 0, W, 1, L)
    if (n) { pieces.push({ y, file, blocks: n }); total += n }
  }
  console.log(pieces.map(p => p.file + ' ' + p.blocks).join('\n'))
  console.log(JSON.stringify({ size: [W, H, L], layers: pieces.map(p => p.y), blocks: total,
    blockEntities: Object.keys(blockNbt).map(k => ({ pos: k.split(',').map(Number), id: blockNbt[k].v.id.v })) }))
  process.exit(0)
}
const nx = Math.ceil(W / PIECE), nz = Math.ceil(L / PIECE)
for (let i = 0; i < nx; i++) for (let k = 0; k < nz; k++) {
  const x0 = i * PIECE, z0 = k * PIECE, w = Math.min(PIECE, W - x0), l = Math.min(PIECE, L - z0)
  const file = 'p_' + i + '_' + k + '.nbt', n = writePiece(file, x0, 0, z0, w, H, l)
  pieces.push({ i, k, file, blocks: n })
  total += n
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
