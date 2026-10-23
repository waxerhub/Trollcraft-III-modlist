// Puts limits on /give for players who aren't operators (e.g. an FTB Ranks rank given command.give).
// Operators, the server console and command blocks are never limited.
// Every /give by a limited player is logged to the server log and shown to any operators online.
// Copy to <server>/kubejs/server_scripts/ and run /reload.
// Note: KubeJS 6's script engine (Rhino) has no `template strings`, so strings are joined with +.

(function () {

// ===================== SETTINGS =====================

// Items that can't be given. * matches anything, e.g. 'projecte:*' or '*_spawn_egg'.
const BLOCKED_ITEMS = [
  // Admin / creative-only
  'minecraft:command_block', 'minecraft:chain_command_block', 'minecraft:repeating_command_block',
  'minecraft:command_block_minecart', 'minecraft:structure_block', 'minecraft:structure_void', 'minecraft:jigsaw',
  'minecraft:barrier', 'minecraft:light', 'minecraft:debug_stick', 'minecraft:knowledge_book',
  'minecraft:bedrock', 'minecraft:end_portal_frame', 'minecraft:reinforced_deepslate', 'minecraft:spawner',
  '*:*creative*',
  '*spawn_egg*',
  // Server balance
  'projecte:*',
  'alexscaves:nuclear_bomb', 'thermal:nuke_*',
  'extrautilitiesreborn:ender_quarry',
  'minecraft:enchanted_golden_apple', 'minecraft:totem_of_undying', 'minecraft:elytra', 'minecraft:dragon_egg',
]

// If this has anything in it, ONLY these items can be given (BLOCKED_ITEMS still applies on top).
// Example: ['minecraft:oak_log', 'minecraft:cooked_beef', 'minecraft:torch', 'create:*']
const ALLOWED_ONLY = []

const MAX_COUNT = 64            // most items one /give can hand out
const BLOCK_NBT = true          // true = no /give with {NBT} (custom enchantments, names, contents...)
const BLOCK_MULTI_TARGET = true // true = no @a, @e or @r; one named player (or @s / @p) at a time
const BLOCK_SELF = true         // true = can't give to yourself; the target must be another player, by name
                                //        (selectors like @s or @p aren't allowed, since they can pick yourself)
const MAX_USES_PER_HOUR = 30    // per player; 0 = no limit
const NOTIFY_OPS = true         // show every limited /give to operators who are online


// ===================== HELPERS =====================

if (!global.giveLimits) global.giveLimits = { uses: {} }
const state = global.giveLimits

function wildcardToRegex(pattern) {
  return new RegExp('^' + pattern.replace(/[.+?^${}()|[\]\\]/g, '\\$&').replace(/\*/g, '.*') + '$')
}
const BLOCKED = BLOCKED_ITEMS.map(wildcardToRegex)
const ALLOWED = ALLOWED_ONLY.map(wildcardToRegex)

function matchesAny(id, list) {
  for (let i = 0; i < list.length; i++) if (list[i].test(id)) return true
  return false
}

// Splits "/give <targets> <item>[{nbt}] [count]". Selectors like @p[distance=..5] can contain spaces,
// so brackets and braces are kept together. Returns null if it can't be understood.
function parseGive(input) {
  const s = String(input).replace(/^\s*\//, '')
  const parts = []
  let cur = '', depth = 0
  for (let i = 0; i < s.length; i++) {
    let c = s.charAt(i)
    if (c == '[' || c == '{') depth++
    if (c == ']' || c == '}') depth--
    if (c == ' ' && depth == 0) {
      if (cur.length) parts.push(cur)
      cur = ''
    } else {
      cur += c
    }
  }
  if (cur.length) parts.push(cur)
  if (parts.length < 3 || parts.length > 4) return null
  const itemFull = parts[2]
  const brace = itemFull.indexOf('{')
  let id = brace >= 0 ? itemFull.substring(0, brace) : itemFull
  if (id.indexOf(':') < 0) id = 'minecraft:' + id
  const count = parts.length == 4 ? Number(parts[3]) : 1
  return { target: parts[1], id: id.toLowerCase(), hasNbt: brace >= 0, count: count }
}

// Returns null if the /give is allowed, otherwise the reason it isn't.
function checkGive(give, name, uuid) {
  if (!give) return 'use the simple form: /give <player> <item> [amount]'
  if (BLOCK_SELF) {
    if (give.target.charAt(0) == '@') return 'give to another player by name (selectors like @s or @p are not allowed)'
    if (give.target.toLowerCase() == name.toLowerCase() || give.target.toLowerCase() == uuid) return 'you cannot give items to yourself'
  }
  if (BLOCK_MULTI_TARGET && /^@[aer]/.test(give.target)) return 'give to one player at a time (no @a, @e or @r)'
  if (BLOCK_NBT && give.hasNbt) return 'items with {NBT} data are not allowed'
  if (!(give.count >= 1) || give.count > MAX_COUNT) return 'the most you can give at once is ' + MAX_COUNT
  if (matchesAny(give.id, BLOCKED)) return give.id + ' is on the restricted list'
  if (ALLOWED.length && !matchesAny(give.id, ALLOWED)) return give.id + ' is not on the approved list'
  if (MAX_USES_PER_HOUR > 0) {
    let now = Date.now()
    let recent = (state.uses[name] || []).filter(t => now - t < 3600000)
    state.uses[name] = recent
    if (recent.length >= MAX_USES_PER_HOUR) return 'you have used /give ' + MAX_USES_PER_HOUR + ' times in the last hour'
  }
  return null
}

function tellPlayer(server, name, text, color) {
  server.runCommandSilent('tellraw ' + name + ' ' + JSON.stringify(['',
    { text: '[MINISTRY] ', color: 'gold', bold: true }, { text: text, color: color }]))
}

function notifyOps(server, text) {
  if (!NOTIFY_OPS) return
  const players = server.players
  for (let i = 0; i < players.size(); i++) {
    let p = players.get(i)
    let op = false
    try { op = p.isOp() } catch (e) { }
    if (op) tellPlayer(server, String(p.getGameProfile().getName()), text, 'gray')
  }
}


// ===================== THE CHECK =====================

ServerEvents.command('give', event => {
  const source = event.getParseResults().getContext().getSource()
  const player = source.getPlayer()
  if (player == null || source.hasPermission(2)) return // console, command blocks and operators: no limits

  const server = event.server
  const name = String(player.getGameProfile().getName())
  const input = String(event.getInput())
  const give = parseGive(input)
  let uuid = ''
  try { uuid = String(player.getStringUuid()).toLowerCase() } catch (e) { }
  const problem = checkGive(give, name, uuid)

  if (problem) {
    tellPlayer(server, name, 'Requisition denied: ' + problem + '.', 'red')
    console.warn('[GiveLimits] DENIED ' + name + ': /' + input.replace(/^\//, '') + ' (' + problem + ')')
    notifyOps(server, name + ' was denied: /' + input.replace(/^\//, '') + ' (' + problem + ')')
    event.cancel()   // last: in KubeJS 6, cancel() stops this function immediately
  }

  if (MAX_USES_PER_HOUR > 0) state.uses[name].push(Date.now())
  console.info('[GiveLimits] ' + name + ': /' + input.replace(/^\//, ''))
  notifyOps(server, name + ' used /' + input.replace(/^\//, ''))
})

})()
