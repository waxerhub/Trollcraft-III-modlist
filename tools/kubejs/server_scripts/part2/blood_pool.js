// Part II: Blood for the Blood God. The Blood Pool and its tier locks (see STORY.md, tools/kubejs/BLOOD_POOL.md).
//
//  - All progression is locked into 12 tiers. A tier's mods, items and tags can't be crafted (recipes removed) or used
//    (placed, right-clicked, swung, worn) until the server-wide Blood Pool reaches it AND an op breaks the seal with
//    /bloodpool unlock (which reloads, so the recipes come back). Getting a locked item (loot, trades) is allowed.
//  - The Pool fills with every troll in the Troll Log (economy/trolls.js) and with donated Hush Coins.
//  - Anything not listed in any tier is always open.
//
// Commands: /bloodpool [donate <coins>|top|tiers|check] (anyone); /bloodpool unlock [force]|settier <n>|add|set (op).
// Copy to <server>/kubejs/server_scripts/part2/ and run /reload. Part II only: not for the Part I server.
//
// KubeJS 6 notes: no template strings; `let` inside nested blocks; event.cancel() last. Recipes load before the world
// (and its saved data) at server start, so the open tier is also kept in TIER_FILE, which the recipe event reads.

(function () {

// ===================== SETTINGS =====================

// The tiers, in order. drops: the Pool total that makes it ready. unlocks: what it opens.
//   mods:  mod ids (every item and block of the mod, and its recipes)
//   items: item ids (an item listed here opens at this tier even if its mod opens later; it still can't be
//          crafted from a recipe of a mod that's locked)
//   tags:  item/block tags without the # (e.g. 'forge:ingots/osmium')
// The contents are filled in once the Part II modpack is chosen. Examples (from PROGRESSION_GATES.md):
//   { mods: ['mekanism', 'mekanismgenerators'] }   { mods: ['ae2'], items: ['ae2:charger'] }   { mods: ['draconicevolution'] }
const TIERS = [
  { tier: 1, name: 'A Trickle', drops: 10000, unlocks: { mods: [], items: [], tags: [] } },
  { tier: 2, name: 'A Puddle', drops: 30000, unlocks: { mods: [], items: [], tags: [] } },
  { tier: 3, name: 'A Basin', drops: 60000, unlocks: { mods: [], items: [], tags: [] } },
  { tier: 4, name: 'A Font', drops: 100000, unlocks: { mods: [], items: [], tags: [] } },
  { tier: 5, name: 'A Spring', drops: 160000, unlocks: { mods: [], items: [], tags: [] } },
  { tier: 6, name: 'A Stream', drops: 240000, unlocks: { mods: [], items: [], tags: [] } },
  { tier: 7, name: 'A River', drops: 350000, unlocks: { mods: [], items: [], tags: [] } },
  { tier: 8, name: 'A Flood', drops: 500000, unlocks: { mods: [], items: [], tags: [] } },
  { tier: 9, name: 'A Tide', drops: 700000, unlocks: { mods: [], items: [], tags: [] } },
  { tier: 10, name: 'A Sea', drops: 950000, unlocks: { mods: [], items: [], tags: [] } },
  { tier: 11, name: 'An Ocean', drops: 1200000, unlocks: { mods: [], items: [], tags: [] } },
  // Tier 12 opens the Siege: part2/citadel.js checks global.BloodPool.tier() >= 12 for the Bureaucratic Barrier.
  { tier: 12, name: 'The Siege', drops: 1500000, unlocks: { mods: [], items: [], tags: [] } },
]
const DROPS_PER_TROLL_POINT = 1        // each Troll Log point
const DROPS_PER_COIN = 1000            // each donated Hush Coin
const OPS_BYPASS = true                // ops can use locked things (building, testing)
const TO_DISCORD = true                // public Pool lines with tellraw @a (posted to Discord); false = in game only
const TIER_FILE = 'kubejs/blood_pool_tier.json'
const RELOAD_DELAY_TICKS = 20          // /bloodpool unlock reloads this long after announcing
const ARMOUR_CHECK_SECONDS = 5         // locked armour being worn goes back into the inventory

const VOICE_BLOOD = { tag: '[BLOOD GOD]', tagColor: 'dark_red', textColor: 'red' }
const VOICE_POOL = { tag: '[Blood Pool]', tagColor: 'dark_red', textColor: 'gray' }
const LINES = {
  ready: 'The Blood Pool overflows. Tier %n (%name) waits for the Ministry\'s seal to break.',
  unlocked: 'The seal breaks. Tier %n (%name) is open. Blood for the Blood God.',
  locked: 'Sealed by the Ministry. The Blood Pool must reach Tier %n (%name).',
}


// ===================== STATE =====================

const DATA_KEY = 'blood_pool'
if (!global.bloodPoolState) global.bloodPoolState = { token: 0 }
const S = global.bloodPoolState
S.token++

let Serializer = null
try { Serializer = Java.loadClass('net.minecraft.network.chat.Component$Serializer') } catch (e) { }

function onlinePlayers(server) {
  const list = server.players, out = []
  for (let i = 0; i < list.size(); i++) out.push(list.get(i))
  return out
}
function nameOf(p) { return String(p.getGameProfile().getName()) }
function uuidOf(e) {
  try { return String(e.getStringUuid()).toLowerCase() } catch (err) { }
  return String(e.getStringUUID()).toLowerCase()
}
function isOp(p) { try { return p.hasPermissions(2) } catch (e) { return false } }
function fmt(n) { return String(Math.round(n)).replace(/\B(?=(\d{3})+(?!\d))/g, ',') }
function comp(parts) {
  const json = JSON.stringify([''].concat(parts))
  if (Serializer) {
    try { return Serializer.fromJsonLenient(json) } catch (e) { }
  }
  return Text.of(parts.map(p => (typeof p == 'string' ? p : p.text || '')).join(''))
}
function voiceParts(voice, text) {
  return [{ text: voice.tag, color: voice.tagColor, bold: true }, { text: ' ' + text, color: voice.textColor }]
}
function tell(p, voice, text) { try { p.tell(comp(voiceParts(voice, text))) } catch (e) { } }
function announce(server, voice, text) {
  const parts = voiceParts(voice, text)
  if (TO_DISCORD) {
    try { server.runCommandSilent('tellraw @a ' + JSON.stringify([''].concat(parts))); return } catch (e) { }
  }
  const c = comp(parts)
  onlinePlayers(server).forEach(p => { try { p.tell(c) } catch (e) { } })
}
function line(key, T) { return LINES[key].replace('%n', T.tier).replace('%name', T.name) }
function tierDef(n) { return TIERS.filter(T => T.tier == n)[0] || null }


// ===================== SAVED DATA =====================
// server.persistentData['blood_pool'] = JSON { v, drops, tier, announced: { n: true }, from: { troll, coins, op },
//   contributors: { uuid: { name, drops, coins } }, unlocks: [ { tier, t, by } ] }

let DB = null
function db() {
  if (DB) return DB
  let raw = ''
  try { raw = String(Utils.server.persistentData.getString(DATA_KEY) || '') } catch (e) { }
  let parsed = null
  if (raw) {
    try { parsed = JSON.parse(raw) } catch (e) {
      try { Utils.server.persistentData.putString(DATA_KEY + '_unreadable_' + Date.now(), raw) } catch (e2) { }
      console.error('[BloodPool] Saved data could not be read (' + e + '); a copy was kept and it starts fresh.')
    }
  }
  DB = parsed && parsed.v ? parsed : { v: 1 }
  if (!DB.drops) DB.drops = 0
  if (!DB.tier) DB.tier = 0
  if (!DB.announced) DB.announced = {}
  if (!DB.from) DB.from = { troll: 0, coins: 0, op: 0 }
  if (!DB.contributors) DB.contributors = {}
  if (!DB.unlocks) DB.unlocks = []
  return DB
}
function save() {
  try { Utils.server.persistentData.putString(DATA_KEY, JSON.stringify(db())) } catch (e) { console.error('[BloodPool] Save failed: ' + e) }
}

// The open tier in TIER_FILE, or null if it's missing or unreadable.
function readTierFile() {
  try {
    let m = JsonIO.read(TIER_FILE)
    if (m == null) return null
    let v = typeof m.get == 'function' ? m.get('tier') : m.tier
    let n = Number(v)
    return isFinite(n) && n >= 0 ? Math.floor(n) : null
  } catch (e) { return null }
}
// The open tier, as the recipe event sees it. Missing or unreadable = 0 (everything stays locked).
function tierFromFile() { const n = readTierFile(); return n == null ? 0 : n }
function writeTierFile(n) {
  try { JsonIO.write(TIER_FILE, { tier: String(n) }); return true } catch (e) {
    console.error('[BloodPool] Could not write ' + TIER_FILE + ' (recipes will stay locked after a restart): ' + e)
    return false
  }
}


// ===================== WHAT EACH TIER LOCKS =====================
// An item listed in a tier wins over its tag, which wins over its mod.

const ITEM_TIER = {}, MOD_TIER = {}, TAG_TIERS = []
TIERS.forEach(T => {
  const u = T.unlocks || {}
  ;(u.items || []).forEach(id => { ITEM_TIER[String(id)] = T.tier })
  ;(u.mods || []).forEach(m => { if (MOD_TIER[m] == null) MOD_TIER[String(m)] = T.tier })
  ;(u.tags || []).forEach(t => TAG_TIERS.push({ tag: String(t).replace(/^#/, ''), tier: T.tier }))
})

function hasTag(obj, tag) {
  if (!obj) return false
  try { return !!obj.hasTag(tag) } catch (e) { return false }
}
// The tier that opens this item/block (0 = not in any tier). obj: the stack or block, for tag checks.
function tierOf(id, obj) {
  id = String(id || '')
  if (!id || id == 'minecraft:air') return 0
  if (ITEM_TIER[id] != null) return ITEM_TIER[id]
  for (let i = 0; i < TAG_TIERS.length; i++) if (hasTag(obj, TAG_TIERS[i].tag)) return TAG_TIERS[i].tier
  const m = MOD_TIER[id.split(':')[0]]
  return m != null ? m : 0
}
function isLocked(id, obj) { return tierOf(id, obj) > db().tier }


// ===================== RECIPES =====================

ServerEvents.recipes(event => {
  const open = tierFromFile()
  let removed = 0
  TIERS.forEach(T => {
    if (T.tier <= open) return
    const u = T.unlocks || {}
    ;(u.mods || []).forEach(m => {
      // Items of this mod that open earlier (and are open now) keep their recipes.
      let keep = Object.keys(ITEM_TIER).filter(id => id.split(':')[0] == m && ITEM_TIER[id] <= open)
      let filter = keep.length ? { output: '@' + m, not: { output: keep } } : { output: '@' + m }
      event.remove(filter)
      event.remove(keep.length ? { mod: m, not: { output: keep } } : { mod: m })
      removed++
    })
    ;(u.items || []).forEach(id => { event.remove({ output: id }); removed++ })
    ;(u.tags || []).forEach(t => { event.remove({ output: '#' + String(t).replace(/^#/, '') }); removed++ })
  })
  console.info('[BloodPool] Recipes: tier ' + open + ' open; ' + removed + ' locked entries removed')
})


// ===================== FILLING THE POOL =====================

function credit(uuid, name, drops, coins) {
  if (!uuid) return
  const C = db().contributors
  if (!C[uuid]) C[uuid] = { name: name || '?', drops: 0, coins: 0 }
  if (name) C[uuid].name = name
  C[uuid].drops += drops
  C[uuid].coins += coins || 0
}
// The next tiers the Pool has reached are announced once each (an op still has to unlock them).
function checkReady(server) {
  const D = db()
  TIERS.forEach(T => {
    if (T.tier <= D.tier || D.announced[T.tier] || D.drops < T.drops) return
    D.announced[T.tier] = true
    if (!server) return
    announce(server, VOICE_BLOOD, line('ready', T))
    onlinePlayers(server).filter(isOp).forEach(o => tell(o, VOICE_POOL, 'Tier ' + T.tier + ' is ready. Unlock it with /bloodpool unlock (one tier at a time).'))
    console.info('[BloodPool] Tier ' + T.tier + ' is ready (' + D.drops + ' Drops)')
  })
}
function addDrops(n, source, uuid, name, coins) {
  n = Math.max(0, Math.round(Number(n) || 0))
  if (!n) return 0
  const D = db()
  D.drops += n
  D.from[source] = (D.from[source] || 0) + n
  credit(uuid, name, n, coins)
  checkReady(Utils.server)
  save()
  return n
}
function nextTier() { return tierDef(db().tier + 1) }
function statusText() {
  const D = db(), cur = tierDef(D.tier), next = nextTier()
  let t = 'The Blood Pool: ' + fmt(D.drops) + ' Drops. ' + (cur ? 'Tier ' + cur.tier + ' (' + cur.name + ') is open.' : 'No tier is open yet.')
  if (!next) return t + ' Every tier is open.'
  t += ' Next: Tier ' + next.tier + ' (' + next.name + ') at ' + fmt(next.drops)
  return t + (D.drops >= next.drops ? ': ready, waiting for the seal to break.' : ' (' + fmt(next.drops - D.drops) + ' to go).')
}
function contents(T) {
  const u = T.unlocks || {}, parts = []
  if ((u.mods || []).length) parts.push('mods: ' + u.mods.join(', '))
  if ((u.items || []).length) parts.push(u.items.length + ' item' + (u.items.length == 1 ? '' : 's'))
  if ((u.tags || []).length) parts.push('tags: ' + u.tags.join(', '))
  return parts.length ? parts.join('; ') : (T.tier == 12 ? 'the Siege' : 'nothing listed yet')
}

// Opens tier n (and everything below): saved, written to TIER_FILE, announced, then /reload brings the recipes back.
function setTier(server, n, by, announceIt) {
  const D = db()
  D.tier = Math.max(0, Math.min(TIERS.length, n))
  D.unlocks.push({ tier: D.tier, t: Date.now(), by: by })
  Object.keys(D.announced).forEach(k => { if (Number(k) <= D.tier) delete D.announced[k] })
  save()
  writeTierFile(D.tier)
  const T = tierDef(D.tier)
  if (announceIt && T) {
    try {
      server.runCommandSilent('title @a times 10 80 20')
      server.runCommandSilent('title @a subtitle ' + JSON.stringify({ text: 'Tier ' + T.tier + ': ' + T.name, color: 'red' }))
      server.runCommandSilent('title @a title ' + JSON.stringify({ text: 'THE BLOOD POOL', color: 'dark_red', bold: true }))
      server.runCommandSilent('playsound minecraft:entity.wither.spawn master @a ~ ~ ~ 100 0.7')
    } catch (e) { }
    announce(server, VOICE_BLOOD, line('unlocked', T))
  }
  checkReady(server)
  save()
  console.info('[BloodPool] Tier set to ' + D.tier + ' by ' + by + '; reloading')
  server.scheduleInTicks(RELOAD_DELAY_TICKS, () => { try { server.runCommandSilent('reload') } catch (e) { console.error('[BloodPool] reload: ' + e) } })
}

// The saved data is the authority; keep the file in step (a restart then loads the right recipes).
function syncFile(server) {
  const D = db(), f = readTierFile()
  if (f == D.tier) return
  writeTierFile(D.tier)
  if (f == null && D.tier == 0) return                         // first run: nothing was open anyway
  console.warn('[BloodPool] ' + TIER_FILE + ' said tier ' + f + ', the saved data says ' + D.tier + '; file fixed. Run /reload to apply the recipes.')
  onlinePlayers(server).filter(isOp).forEach(o => tell(o, VOICE_POOL, 'The tier file was out of step (' + f + ' vs ' + D.tier + '); fixed. Run /reload so recipes match.'))
}


// ===================== THE LOCKS =====================

function sealed(p, need) {
  const T = tierDef(need)
  try { p.setStatusMessage(comp([{ text: T ? line('locked', T) : 'Sealed by the Ministry.', color: 'dark_red' }])) } catch (e) { }
}
// True if `player` may not use id/obj (and says why).
function blockedFor(player, id, obj) {
  if (!player) return false
  const need = tierOf(id, obj)
  if (need <= db().tier) return false
  if (OPS_BYPASS && isOp(player)) return false
  sealed(player, need)
  return true
}
function playerOf(event) {
  let p = null
  try { p = event.player } catch (e) { }
  if (!p) { try { let en = event.entity; if (en && en.isPlayer()) p = en } catch (e) { } }
  return p
}

ItemEvents.rightClicked(event => {
  if (blockedFor(event.player, event.item.id, event.item)) event.cancel()
})
ItemEvents.entityInteracted(event => {
  if (blockedFor(event.player, event.item.id, event.item)) event.cancel()
})
BlockEvents.rightClicked(event => {
  const p = event.player
  let bad = blockedFor(p, event.block.id, event.block)
  if (!bad && event.item && !event.item.isEmpty()) bad = blockedFor(p, event.item.id, event.item)
  if (bad) event.cancel()
})
BlockEvents.placed(event => {
  if (blockedFor(playerOf(event), event.block.id, event.block)) event.cancel()
})
// Hitting with a locked weapon does nothing.
EntityEvents.hurt(event => {
  let a = null
  try { a = event.source.actual } catch (e) { }
  if (!a) { try { a = event.source.getActual() } catch (e) { } }
  let isPlayer = false
  try { isPlayer = !!(a && a.isPlayer()) } catch (e) { }
  if (!isPlayer) return
  const held = a.mainHandItem
  if (!held || held.isEmpty()) return
  if (blockedFor(a, held.id, held)) event.cancel()
})

// Locked armour can't stay on: it goes back into the inventory (or drops if that's full).
function checkArmour(server) {
  onlinePlayers(server).forEach(p => {
    if (OPS_BYPASS && isOp(p)) return
    for (let i = 36; i < 40; i++) {
      let s = null
      try { s = p.inventory.getItem(i) } catch (e) { }
      if (!s || s.isEmpty() || !isLocked(s.id, s)) continue
      let copy = s.copy()
      try {
        p.inventory.setItem(i, Item.empty)
        p.give(copy)
        sealed(p, tierOf(copy.id, copy))
      } catch (e) { console.warn('[BloodPool] Armour: ' + e) }
    }
  })
}
function startLoop(server) {
  const token = S.token
  const loop = () => {
    if (token != S.token) return
    try { checkArmour(server) } catch (e) { console.error('[BloodPool] ' + e) }
    server.scheduleInTicks(ARMOUR_CHECK_SECONDS * 20, loop)
  }
  server.scheduleInTicks(ARMOUR_CHECK_SECONDS * 20, loop)
}
ServerEvents.loaded(event => { syncFile(event.server); startLoop(event.server) })
if (Utils.server) { syncFile(Utils.server); startLoop(Utils.server) }


// ===================== API FOR OTHER SCRIPTS =====================

global.BloodPool = {
  drops: () => db().drops,
  tier: () => db().tier,
  // source: 'troll', 'coins', 'op' or another script's name. uuid/name: who to credit.
  addDrops: (n, source, uuid, name) => addDrops(Number(n) * (source == 'troll' ? DROPS_PER_TROLL_POINT : 1), source || 'other', uuid ? String(uuid) : '', name ? String(name) : ''),
  isLocked: (id, obj) => isLocked(id, obj),
  tierOf: (id, obj) => tierOf(id, obj),
  tierCount: TIERS.length,
}


// ===================== COMMANDS =====================

ServerEvents.commandRegistry(event => {
  const Commands = event.commands
  const Arguments = event.arguments
  const reply = (ctx, text, bad) => {
    ctx.source.sendSystemMessage(comp([{ text: '[Blood Pool] ', color: 'dark_red' }, { text: text, color: bad ? 'red' : 'gray' }]))
    return bad ? 0 : 1
  }
  const safe = fn => ctx => {
    try { return fn(ctx) } catch (e) {
      console.error('[BloodPool] ' + e)
      return reply(ctx, 'Error: ' + e, true)
    }
  }
  const int = name => Commands.argument(name, Arguments.INTEGER.create(event))
  const num = (ctx, name) => Number(Arguments.INTEGER.getResult(ctx, name))
  const op = src => src.hasPermission(2)
  const me = ctx => ctx.source.getPlayer()
  const who = ctx => { const p = me(ctx); return p ? nameOf(p) : 'the console' }
  const unlock = (ctx, force) => {
    const D = db(), next = nextTier()
    if (!next) return reply(ctx, 'Every tier is already open.', true)
    if (!force && D.drops < next.drops) return reply(ctx, 'Tier ' + next.tier + ' needs ' + fmt(next.drops) + ' Drops; the Pool has ' + fmt(D.drops) + '. (/bloodpool unlock force to open it anyway.)', true)
    setTier(ctx.source.server, next.tier, who(ctx), true)
    return reply(ctx, 'Tier ' + next.tier + ' (' + next.name + ') unlocked: ' + contents(next) + '. Reloading so its recipes come back.')
  }

  event.register(Commands.literal('bloodpool')
    .executes(safe(ctx => reply(ctx, statusText())))
    .then(Commands.literal('donate').then(int('coins').executes(safe(ctx => {
      const p = me(ctx), e = global.Economy, n = Math.floor(num(ctx, 'coins'))
      if (!p) return reply(ctx, 'Players only.', true)
      if (!e) return reply(ctx, 'The Blood Pool can\'t take coins right now.', true)
      if (!(n >= 1)) return reply(ctx, 'Give at least one coin.', true)
      const have = e.countCoins(p)
      if (have < n) return reply(ctx, 'You only carry ' + have + ' Hush Coin' + (have == 1 ? '' : 's') + '.', true)
      e.takeCoins(p, n)
      addDrops(n * DROPS_PER_COIN, 'coins', uuidOf(p), nameOf(p), n)
      console.info('[BloodPool] ' + nameOf(p) + ' gave ' + n + ' coins')
      return reply(ctx, n + ' Hush Coin' + (n == 1 ? '' : 's') + ' given to the Blood Pool (' + fmt(n * DROPS_PER_COIN) + ' Drops). ' + statusText())
    }))))
    .then(Commands.literal('top').executes(safe(ctx => {
      const C = db().contributors, list = Object.keys(C).sort((a, b) => C[b].drops - C[a].drops).slice(0, 10)
      if (!list.length) return reply(ctx, 'Nobody has given blood yet.')
      reply(ctx, 'The Blood Pool\'s greatest contributors:')
      list.forEach((u, i) => reply(ctx, '  ' + (i + 1) + '. ' + C[u].name + ': ' + fmt(C[u].drops) + ' Drops' + (C[u].coins ? ' (' + C[u].coins + ' coins)' : '')))
      return 1
    })))
    .then(Commands.literal('tiers').executes(safe(ctx => {
      const D = db()
      TIERS.forEach(T => reply(ctx, 'Tier ' + T.tier + ' · ' + T.name + ' · ' + fmt(T.drops) + ' Drops · ' + contents(T) + ' · ' +
        (T.tier <= D.tier ? 'OPEN' : D.drops >= T.drops ? 'READY' : 'sealed')))
      return 1
    })))
    .then(Commands.literal('check').executes(safe(ctx => {
      const p = me(ctx)
      if (!p) return reply(ctx, 'Players only.', true)
      const s = p.mainHandItem
      if (!s || s.isEmpty()) return reply(ctx, 'Hold the item to check.', true)
      const n = tierOf(s.id, s), T = tierDef(n)
      if (!n) return reply(ctx, String(s.id) + ' isn\'t in any tier: always open.')
      return reply(ctx, String(s.id) + ' opens at Tier ' + n + (T ? ' (' + T.name + ')' : '') + ': ' + (n <= db().tier ? 'open.' : 'sealed.'))
    })))
    .then(Commands.literal('unlock').requires(op)
      .executes(safe(ctx => unlock(ctx, false)))
      .then(Commands.literal('force').executes(safe(ctx => unlock(ctx, true)))))
    .then(Commands.literal('settier').requires(op).then(int('tier').executes(safe(ctx => {
      const n = num(ctx, 'tier')
      if (!(n >= 0 && n <= TIERS.length)) return reply(ctx, 'A tier from 0 (everything sealed) to ' + TIERS.length + '.', true)
      setTier(ctx.source.server, n, who(ctx), false)
      return reply(ctx, 'Open tier set to ' + n + ' (quietly). Reloading.')
    }))))
    .then(Commands.literal('add').requires(op).then(int('drops').executes(safe(ctx => {
      addDrops(num(ctx, 'drops'), 'op', '', '')
      return reply(ctx, statusText())
    }))))
    .then(Commands.literal('set').requires(op).then(int('drops').executes(safe(ctx => {
      const D = db()
      D.drops = Math.max(0, num(ctx, 'drops'))
      Object.keys(D.announced).forEach(k => { let T = tierDef(Number(k)); if (T && D.drops < T.drops) delete D.announced[k] })
      checkReady(ctx.source.server)
      save()
      return reply(ctx, statusText())
    })))))
})

})()
