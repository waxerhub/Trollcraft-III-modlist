// Chunk Loader Ban: Forge event hook (see server_scripts/chunk_loader_ban.js and tools/kubejs/CHUNK_LOADER_BAN.md).
//
// Why this is a startup script: in KubeJS 6, raw Forge events (ForgeEvents.onEvent) can only be listened to
// from startup scripts, and server scripts have no chunk-load event.
//   - ChunkEvent$Load   every loader keeps its own chunk loaded, so its chunk loads at server start (or, with
//     ChickenChunks, when its owner logs in). This notes any loader in a chunk as it loads, and the
//     server script removes it a moment later. Nothing in the world is changed here: the chunk is still loading.
// It looks only at the chunk's block-entity spots (getBlockEntitiesPos, which also covers ones still pending from
// disk), so a chunk without a loader costs a few lookups.
// Server only (it does nothing on a player's game). Restart the server after adding or changing this file.

global.chunkLoaderBanHooksInstalled = 1

const CHUNK_LOADER_BAN_BLOCKS = ['chickenchunks:chunk_loader', 'chickenchunks:spot_loader', 'ae2:spatial_anchor']
let chunkLoaderBanRegistry = null
try { chunkLoaderBanRegistry = Java.loadClass('net.minecraftforge.registries.ForgeRegistries').BLOCKS } catch (e) { }

function chunkLoaderBanBlockId(state) {
  const block = state.getBlock()
  try { if (chunkLoaderBanRegistry) return String(chunkLoaderBanRegistry.getKey(block)) } catch (e) { }
  const m = String(block).match(/\{([^}]+)\}/)   // "Block{chickenchunks:chunk_loader}"
  return m ? m[1] : String(block)
}

// KubeJS makes level.dimension the id itself, not a method (on the real server, 2026-11-25: calling it threw, so no placed
// loader was ever found). Either form works here.
function chunkLoaderBanDim(level) {
  let d = level.dimension
  if (typeof d == 'function') d = level.dimension()
  if (d != null && typeof d.location == 'function') d = d.location()
  return String(d)
}

ForgeEvents.onEvent('net.minecraftforge.event.level.ChunkEvent$Load', event => {
  try {
    let level = event.getLevel()
    if (!level || level.isClientSide()) return
    let chunk = event.getChunk()
    if (!chunk || typeof chunk.getBlockEntitiesPos != 'function') return
    let found = []
    let dim = ''
    chunk.getBlockEntitiesPos().forEach(pos => {
      let id = chunkLoaderBanBlockId(chunk.getBlockState(pos))
      if (CHUNK_LOADER_BAN_BLOCKS.indexOf(id) < 0) return
      if (!dim) dim = chunkLoaderBanDim(level)
      found.push({ dim: dim, x: Number(pos.getX()), y: Number(pos.getY()), z: Number(pos.getZ()), id: id })
    })
    if (!found.length) return
    let api = global.ChunkLoaderBan
    if (api && api.found) api.found(found)
    else {
      if (!global.chunkLoaderBanQueue) global.chunkLoaderBanQueue = []
      found.forEach(f => global.chunkLoaderBanQueue.push(f))
    }
  } catch (e) {
    console.error('[ChunkLoaderBan] chunk hook: ' + e)
  }
})
