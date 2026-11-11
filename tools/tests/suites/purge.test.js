// part2/purge.js: the Purge engine (timer, kills, sanctuary, kits and the vault) and its first mode, the Potato Heist.
// Run with: node tools/tests/run_all.js purge   (or node tools/tests/suites/purge.test.js)
const fs = require('fs')
const paths = require('../lib/paths')
const src = fs.readFileSync(paths.server('part2/purge.js'), 'utf8')
let fails = 0
const ok = (l, c, e) => { console.log((c ? 'ok   ' : 'FAIL ') + l + (!c && e !== undefined ? '  ' + e : '')); if (!c) fails++ }

// ---------- the mock ----------
const OW = 'minecraft:overworld'
let T = 1700000000000
const realNow = Date.now
Date.now = () => T
const persistent = {}, files = {}, cmds = [], logs = []
let failSave = false, tick = 0, queue = []
const players = []
const jlist = arr => ({ size: () => arr.length, get: i => arr[i] })
const server = {
  get players() { return jlist(players.filter(p => p.online)) },
  persistentData: {
    getString: k => persistent[k] || '',
    putString: (k, v) => { if (failSave && k == 'purge') throw new Error('disk full'); persistent[k] = v },
  },
  runCommandSilent: c => { cmds.push(c); return 1 },
  scheduleInTicks: (n, f) => { queue.push({ at: tick + n, f }) },
}
function advance(n) {
  for (let i = 0; i < n; i++) {
    tick++
    const due = queue.filter(q => q.at <= tick)
    queue = queue.filter(q => q.at > tick)
    due.forEach(q => q.f())
  }
}
const seconds = s => { T += s * 1000; advance(s * 20) }
let goneOk = false
const EMPTY = { id: 'minecraft:air', count: 0, nbt: null, isEmpty: () => true }
const Item = {
  of: (id, count, nbt) => {
    if (id == 'gone:item' && !goneOk) throw new Error('unknown item gone:item')
    return { id, count: count == null ? 1 : count, nbt: nbt || null, isEmpty: () => false }
  },
  empty: EMPTY,
}
function player(name, x, z, opts) {
  opts = opts || {}
  const slots = []
  for (let i = 0; i < 41; i++) slots.push(EMPTY)
  const p = { name, x, y: 64, z, dim: OW, online: true, op: !!opts.op, alive: true, creative: !!opts.creative, afk: false, msgs: [], dropped: [], slots,
    isPlayer: () => true, getGameProfile: () => ({ getName: () => p.name }), getStringUuid: () => 'U-' + name,
    getX: () => p.x, getY: () => p.y, getZ: () => p.z, get level() { return { dimension: { location: () => p.dim } } },
    isAlive: () => p.alive, isCreative: () => p.creative, isSpectator: () => false, hasPermissions: () => p.op,
    tell: c => p.msgs.push(text(c)),
    give: s => { const i = slots.findIndex((x, k) => k < 36 && x.isEmpty()); if (i >= 0) slots[i] = s; else p.dropped.push(s) },
    inventory: { getContainerSize: () => 41, getItem: i => slots[i], setItem: (i, s) => { slots[i] = s }, clearContent: () => { for (let i = 0; i < 41; i++) slots[i] = EMPTY } } }
  players.push(p)
  return p
}
const text = c => (Array.isArray(c) ? c.map(x => (typeof x == 'string' ? x : x.text)).join('') : String(c))
const said = (p, re) => p.msgs.some(m => re.test(m))

// A stand-in for part2/blood_pool.js's Potato War (tested in blood_pool.test.js): totals by UUID, ranks kept.
const RANKS = [250, 1000, 2500, 25000, 50000, 100000]
const standing = {}
const tierOf = n => RANKS.filter(r => n >= r).length
const BloodPool = {
  standingOfUuid: u => { const s = standing[u] || { potatoes: 0, peak: 0 }; return { potatoes: s.potatoes, tier: Math.max(s.peak, tierOf(s.potatoes)) } },
  takeStanding: (u, name, n) => { const s = standing[u]; if (!s) return 0; const t = Math.min(s.potatoes, n); s.potatoes -= t; return t },
  giveStanding: (u, name, n) => { const s = standing[u] = standing[u] || { potatoes: 0, peak: 0 }; s.potatoes += n; s.peak = Math.max(s.peak, tierOf(s.potatoes)) },
}
const setPotatoes = (p, n) => { standing['u-' + p.name.toLowerCase()] = { potatoes: n, peak: tierOf(n) } }
const potatoes = p => (standing['u-' + p.name.toLowerCase()] || { potatoes: 0 }).potatoes
const global = { BloodPool, Economy: { isAfk: p => !!p.afk } }
const PROTECTED_AREAS = [{ name: 'Spawn', dim: OW, spawnRadius: 16, allowed: ['KitKat'], allowUse: true },
  { name: 'Power room', dim: OW, x1: 90, y1: 50, z1: 190, x2: 110, y2: 80, z2: 210, allowed: [] }]
const protectedAreasSpawn = () => ({ x: 0, z: 0 })

let H, cmdTree
const EXIT = { exit: true }
const node = (n, kind) => ({ n, kind, ch: [], req: null, f: null, then(c) { this.ch.push(c); return this }, requires(f) { this.req = f; return this }, executes(f) { this.f = f; return this }, suggests() { return this } })
function load() {
  H = { hurt: [], death: [], respawned: [], loggedOut: [], loggedIn: [], loaded: [], command: {} }
  const reg = k => h => H[k].push(h)
  new Function('ServerEvents', 'EntityEvents', 'PlayerEvents', 'Java', 'Utils', 'Item', 'Text', 'JsonIO', 'console', 'global', 'PROTECTED_AREAS', 'protectedAreasSpawn', src)(
    { loaded: reg('loaded'), commandRegistry: h => h({ commands: { literal: n => node(n, 'lit'), argument: n => node(n, 'arg') },
        arguments: { INTEGER: { create: () => 'int', getResult: (ctx, n) => Number(ctx.args[n]) } }, register: t => { cmdTree = t } }),
      command: (name, h) => { (H.command[name] = H.command[name] || []).push(h) } },
    { hurt: reg('hurt'), death: reg('death') },
    { respawned: reg('respawned'), loggedOut: reg('loggedOut'), loggedIn: reg('loggedIn') },
    { loadClass: c => (/Serializer/.test(c) ? { fromJsonLenient: j => JSON.parse(j) } : { word: () => 'word', getString: (ctx, n) => ctx.args[n] }) },
    { server }, Item, { of: s => s },
    { write: (p, o) => { files[p] = JSON.parse(JSON.stringify(o)) } },
    { info: m => logs.push(m), warn: m => logs.push('WARN ' + m), error: m => logs.push('ERR ' + m) },
    global, PROTECTED_AREAS, protectedAreasSpawn)
}
function fire(kind, ev) {
  let cancelled = false
  ev.cancel = () => { cancelled = true; throw EXIT }
  H[kind].forEach(h => { try { h(ev) } catch (e) { if (e !== EXIT) throw e } })
  return cancelled
}
function hurt(victim, attacker) { return fire('hurt', { entity: victim, server, source: { getActual: () => attacker || null, getMsgId: () => 'player' } }) }
function die(victim, killer, msgId) {
  fire('death', { entity: victim, server, source: { getActual: () => killer || null, getMsgId: () => msgId || (killer ? 'player' : 'fall') } })
  victim.alive = false
}
function respawn(p) { p.alive = true; fire('respawned', { player: p, server }) }
function logout(p) { fire('loggedOut', { player: p, server }); p.online = false }
function login(p) { p.online = true; fire('loggedIn', { player: p, server }) }
function typed(p, cmd) {
  let c = false
  ;(H.command[cmd] || []).forEach(h => { try { h({ getParseResults: () => ({ getContext: () => ({ getSource: () => ({ getPlayer: () => p }) }) }), cancel() { c = true; throw EXIT } }) } catch (e) { if (e !== EXIT) throw e } })
  return c
}
function run(line, as) {
  const parts = line.split(' ').slice(1), replies = [], args = {}
  const source = { server, hasPermission: () => !as || as.op, getPlayer: () => as || null, sendSystemMessage: c => replies.push(text(c)) }
  let n = cmdTree
  for (const a of parts) {
    const next = n.ch.find(c => c.kind == 'lit' && c.n == a) || n.ch.find(c => c.kind == 'arg')
    if (!next) return ['NO SUCH COMMAND']
    if (next.req && !next.req(source)) return ['DENIED']
    if (next.kind == 'arg') args[next.n] = a
    n = next
  }
  if (n.req && !n.req(source)) return ['DENIED']
  n.f({ source, args })
  return replies
}
const DB = () => JSON.parse(persistent.purge)
const slot = (p, i) => p.slots[i]
const lifeOf = s => ((s.nbt || '').match(/PurgeLife:"([^"]+)"/) || [])[1]
const isKit = s => /PurgeKit:1b/.test(s.nbt || '')

load()
// ---------- the players ----------
const anamy = player('Anamy', 100, 100), goruk = player('Goruk', 110, 100), stang = player('Stang', 120, 100)
const kitkat = player('KitKat', 3, 3), admin = player('Admin', 500, 500, { op: true, creative: true })
setPotatoes(anamy, 30000); setPotatoes(goruk, 60000); setPotatoes(stang, 1000); setPotatoes(kitkat, 5000)
anamy.slots[0] = Item.of('minecraft:netherite_sword', 1, '{Enchantments:[{id:"minecraft:sharpness",lvl:5s}]}')
anamy.slots[7] = Item.of('minecraft:potato', 40)
anamy.slots[38] = Item.of('minecraft:diamond_chestplate', 1, '{Damage:12}')
anamy.slots[40] = Item.of('minecraft:totem_of_undying', 1)
goruk.slots[3] = Item.of('minecraft:golden_apple', 12)
kitkat.slots[0] = Item.of('minecraft:diamond_sword', 1)

// ---------- starting ----------
ok('/purge with nothing running', /No Purge is running/.test(run('/purge', anamy)[0]))
ok('/purge start is op-only', run('/purge start heist 30', anamy)[0] == 'DENIED')
ok('an unknown mode is refused', /no mode called "tag"/.test(run('/purge start tag 30', admin)[0]))
ok('0 minutes is refused', /1 to 240 minutes/.test(run('/purge start heist 0', admin)[0]))
ok('an unknown kit is refused', /no kit called "wizard"/.test(run('/purge start heist 30 wizard', admin)[0]))
ok('/purge modes and /purge kits list them', /heist: The Potato Heist/.test(run('/purge modes', anamy)[0]) && run('/purge kits', anamy).length == 4)
ok('/purge start heist 30 peasant', /Started/.test(run('/purge start heist 30 peasant', admin)[0]))
ok('... a second Purge is refused', /already running/.test(run('/purge start heist 10', admin)[0]))
ok('... midnight, thunder, the raid horn and a title for everyone', cmds.includes('time set midnight') && cmds.some(c => /^weather thunder 1800s$/.test(c)) &&
  cmds.some(c => /execute as Anamy at @s run playsound minecraft:event.raid.horn/.test(c)) && cmds.some(c => /title Goruk title .*THE PURGE/.test(c)))
ok('... everyone is told the rules, the kit and the sanctuary', said(anamy, /THE POTATO HEIST has begun\. 30 minutes/) && said(anamy, /Kit: Peasant/) && said(anamy, /sanctuary at the castle is neutral ground/))
ok('... nothing names the Ministry', !players.some(p => p.msgs.some(m => /Ministry/.test(m))))
ok('... the boss bar shows the mode, the time and the richest war chest', cmds.some(c => /^bossbar add purge:timer/.test(c)) && cmds.some(c => /bossbar set purge:timer name .*THE POTATO HEIST  30:00.*Richest war chest: Goruk \(60,000\)/.test(c)))
// the vault
let D = DB()
ok('Anamy is vaulted: her 4 stacks are saved, with their slots and NBT', D.vaults['u-anamy'] && D.vaults['u-anamy'].slots.length == 4 &&
  D.vaults['u-anamy'].slots.some(s => s.slot == 0 && s.id == 'minecraft:netherite_sword' && /sharpness/.test(s.nbt)) && D.vaults['u-anamy'].slots.some(s => s.slot == 40 && s.id == 'minecraft:totem_of_undying'))
ok('... and a backup file', files['kubejs/purge_vaults/Anamy_u-anamy.json'] && files['kubejs/purge_vaults/Anamy_u-anamy.json'].slots.length == 4)
ok('... she holds the Peasant kit: wooden sword, bread, leather armour in the armour slots', slot(anamy, 0).id == 'minecraft:wooden_sword' && slot(anamy, 1).id == 'minecraft:bread' &&
  slot(anamy, 39).id == 'minecraft:leather_helmet' && slot(anamy, 36).id == 'minecraft:leather_boots' && slot(anamy, 40).isEmpty() && slot(anamy, 7).isEmpty())
ok('... every kit item is tagged with her and her first life, and has the lore', lifeOf(slot(anamy, 0)) == 'u-anamy#1' && /Purge issue\. Returned at the end\./.test(slot(anamy, 0).nbt))
ok('... and she\'s told', said(anamy, /belongings are held until the Purge ends \(4 stacks\)\. Your kit: Peasant/))
ok('KitKat, in the sanctuary, keeps her own gear and is told why', slot(kitkat, 0).id == 'minecraft:diamond_sword' && !D.vaults['u-kitkat'] && said(kitkat, /in the sanctuary: nobody fights here/))
ok('the creative op isn\'t vaulted', !D.vaults['u-admin'])

// ---------- the Heist ----------
die(goruk, anamy)
ok('Anamy kills Goruk (60,000): 2,500 taken (5% capped), she keeps 2,000, 500 tithed', potatoes(goruk) == 57500 && potatoes(anamy) == 32000 && DB().tithe == 500 && DB().titheBy.heist == 500)
ok('... she gets a title, he\'s told his rank is safe, everyone hears it', cmds.some(c => /title Anamy title .*\+2,000 potatoes/.test(c)) && said(goruk, /raided by Anamy: -2,500 potatoes\. Your rank is safe/) && said(stang, /Anamy raided Goruk's war chest\./))
ok('... potato particles (never real items) at the body', cmds.some(c => /particle minecraft:item minecraft:potato 110 65 100/.test(c)))
ok('... nothing drops: his kit is cleared on death', goruk.slots.every(s => s.isEmpty()))
respawn(goruk)
ok('Goruk respawns with a fresh kit (life 2) and Resistance V', lifeOf(slot(goruk, 0)) == 'u-goruk#2' && cmds.includes('effect give Goruk minecraft:resistance 10 4 true'))
die(goruk, anamy); respawn(goruk)
ok('robbing him again is worth half: 1,250 taken, 1,000 kept', potatoes(goruk) == 56250 && potatoes(anamy) == 33000 && DB().tithe == 750)
die(anamy, goruk); respawn(anamy)
ok('Goruk kills Anamy, who robbed him: a grudge takes double (33,000 x 5% x 2 = 3,300)', potatoes(anamy) == 29700 && potatoes(goruk) == 56250 + 2640, potatoes(anamy) + ' / ' + potatoes(goruk))
die(anamy, goruk); respawn(anamy)
ok('... the grudge is spent: next time it\'s a repeat (half of 1,485)', potatoes(anamy) == 29700 - 743, potatoes(anamy))
const a0 = potatoes(anamy)
die(stang, anamy); respawn(stang)
ok('Stang (rank 2) can\'t be robbed: nothing taken, Anamy told', potatoes(stang) == 1000 && potatoes(anamy) == a0 && cmds.some(c => /title Anamy actionbar .*too small to raid/.test(c)))
die(anamy, stang); respawn(anamy)
const s1 = potatoes(stang)
ok('Stang robs Anamy (rank 4) as normal', s1 > 1000 && potatoes(anamy) < a0)
die(stang, anamy); respawn(stang)
ok('... and Anamy\'s revenge ignores the rank floor (a grudge)', potatoes(stang) < s1, potatoes(stang) + ' vs ' + s1)
// no theft
const g0 = potatoes(goruk)
goruk.afk = true; die(goruk, anamy); respawn(goruk); goruk.afk = false
ok('an AFK victim: nothing', potatoes(goruk) == g0)
die(goruk, goruk); respawn(goruk)
ok('killing yourself: nothing', potatoes(goruk) == g0)
// last hit within 10 seconds
hurt(goruk, anamy); seconds(4); die(goruk, null, 'fall'); respawn(goruk)
ok('a fall 4 seconds after Anamy\'s hit is her kill', potatoes(goruk) < g0)
const g1 = potatoes(goruk)
hurt(goruk, anamy); seconds(11); die(goruk, null, 'fall'); respawn(goruk)
ok('... 11 seconds later it isn\'t', potatoes(goruk) == g1)
// the sanctuary
ok('no fighting into the sanctuary: a hit on KitKat is cancelled', hurt(kitkat, anamy))
die(kitkat, anamy); respawn(kitkat)
ok('... and a death there pays nothing', potatoes(kitkat) == 5000)
ok('her /home still works inside the sanctuary', !typed(kitkat, 'home'))
kitkat.x = 40; seconds(1)
ok('KitKat steps out: vaulted, Peasant kit', DB().vaults['u-kitkat'] && DB().vaults['u-kitkat'].slots[0].id == 'minecraft:diamond_sword' && slot(kitkat, 0).id == 'minecraft:wooden_sword')
kitkat.x = 3; seconds(1)
ok('... once she\'s fighting, going back in doesn\'t give her gear back', slot(kitkat, 0).id == 'minecraft:wooden_sword')
// no escaping
ok('/home, /back and /tpa are refused for fighters', typed(anamy, 'home') && typed(anamy, 'back') && typed(anamy, 'tpa') && said(anamy, /\/home doesn't work during the Purge/))
ok('... ops can still use them', !typed(admin, 'home'))
ok('... other commands aren\'t touched', !H.command.sethome)
// keeping it fair
anamy.slots[5] = Item.of('minecraft:diamond', 3)
anamy.slots[6] = Item.of('minecraft:wooden_sword', 1, slot(goruk, 0).nbt)                  // Goruk's kit
anamy.slots[8] = Item.of('minecraft:bread', 8, slot(anamy, 1).nbt.replace(/#\d+/, '#1'))    // her kit from before she died
seconds(1)
ok('a diamond from a chest goes to her vault\'s extras, and she\'s told once', slot(anamy, 5).isEmpty() && DB().vaults['u-anamy'].extras.some(e => e.id == 'minecraft:diamond' && e.count == 3) && anamy.msgs.filter(m => /Only your kit can be used/.test(m)).length == 1)
ok('another player\'s kit, or her own from an earlier life, is taken away (not kept)', slot(anamy, 6).isEmpty() && slot(anamy, 8).isEmpty() && DB().vaults['u-anamy'].extras.length == 1)
ok('her current kit stays', slot(anamy, 0).id == 'minecraft:wooden_sword' && slot(anamy, 1).id == 'minecraft:bread')
// combat logging
const g2 = potatoes(goruk)
hurt(goruk, anamy); seconds(3); logout(goruk)
ok('Goruk logs out 3 seconds after a hit: robbed as if killed', potatoes(goruk) < g2 && said(anamy, /Anamy raided Goruk's war chest \(they ran\)/))
// the boss bar and the glow
seconds(5)
ok('the richest war chests online glow', cmds.some(c => /^effect give Anamy minecraft:glowing/.test(c)))
ok('the boss bar counts down', cmds.some(c => /bossbar set purge:timer value \d+/.test(c)))
// the commands
ok('/purge shows the mode, the kit, the time left and your score', run('/purge', anamy).some(r => /The Potato Heist \(kit: Peasant\): \d+:\d\d left/.test(r)) && run('/purge', anamy).some(r => /^\[The Purge\] You: \d+ kills, \d+ deaths/.test(r)))
ok('/purge top ranks by net potatoes', /1\. \w+: [+-][\d,]+ net potatoes/.test(run('/purge top', stang)[0]))
ok('/purge tithe is op-only (it\'s secret)', run('/purge tithe', anamy)[0] == 'DENIED' && /The Tithe \(secret\): [\d,]+ in all\. heist/.test(run('/purge tithe', admin)[0]))
ok('/purge vaults (op) lists who is vaulted', run('/purge vaults', admin).some(r => /Anamy: 4 stacks, 1 extras \(fighting now\)/.test(r)))
ok('/purge restore refuses a fighter mid-Purge', /fighting in this Purge/.test(run('/purge restore Anamy', admin)[0]))

// ---------- a restart mid-Purge ----------
const rich0 = potatoes(anamy)
load()
H.loaded.forEach(h => h({ server }))
ok('after a restart the Purge carries on (boss bar shown again, vaults kept)', cmds.filter(c => /^bossbar add purge:timer/.test(c)).length >= 2 && DB().cur && DB().vaults['u-anamy'])
die(stang, anamy); respawn(stang)
ok('... kills still count', potatoes(anamy) >= rich0)
// someone logs in mid-Purge
const late = player('Late', 200, 200)
late.slots[2] = Item.of('minecraft:elytra', 1)
login(late)
seconds(2)
ok('a player logging in mid-Purge is vaulted and gets the kit', DB().vaults['u-late'] && slot(late, 0).id == 'minecraft:wooden_sword' && said(late, /The Potato Heist is running/))
logout(stang)                       // Stang ends the Purge offline
anamy.slots[33] = EMPTY
D = DB(); D.vaults['u-anamy'].slots.push({ slot: 20, id: 'gone:item', count: 1, nbt: '' }); persistent.purge = JSON.stringify(D); load()
die(goruk.online ? goruk : kitkat, null, 'lava')       // KitKat dies just before the end (her vault waits for her respawn)

// ---------- the end ----------
T = DB().cur.endsAt + 1; advance(40)
ok('time runs out: the Purge ends', !DB().cur && DB().history.length == 1 && DB().history[0].mode == 'heist' && DB().history[0].kit == 'peasant')
ok('... the winner and the biggest hauls are announced', said(stang.online ? stang : anamy, /wins the Purge \([+]/) && said(anamy, /Biggest hauls: /))
ok('... each fighter is told their own result', said(anamy, /Your Purge: \d+ kills?, \d+ deaths?, [+-][\d,]+ net potatoes/))
ok('... the boss bar and the glow are cleared, and loose kit on the ground removed', cmds.includes('bossbar remove purge:timer') && cmds.includes('effect clear Anamy minecraft:glowing') &&
  cmds.includes('kill @e[type=minecraft:item,nbt={Item:{tag:{PurgeKit:1b}}}]'))
ok('Anamy gets her belongings back, slot for slot, with their NBT', slot(anamy, 0).id == 'minecraft:netherite_sword' && /sharpness/.test(slot(anamy, 0).nbt) &&
  slot(anamy, 38).id == 'minecraft:diamond_chestplate' && slot(anamy, 38).nbt == '{Damage:12}' && slot(anamy, 40).id == 'minecraft:totem_of_undying' && slot(anamy, 7).count == 40)
ok('... and the diamond she picked up', anamy.slots.some(s => s.id == 'minecraft:diamond' && s.count == 3))
ok('... no kit left on her', !anamy.slots.some(isKit))
ok('... but one item that no longer exists stays in the vault, and the ops are told', DB().vaults['u-anamy'] && DB().vaults['u-anamy'].slots.length == 1 && DB().vaults['u-anamy'].partial && said(admin, /1 of Anamy's items could not be handed back/))
goneOk = true
ok('/purge restore gives the rest without clearing what she has (no duplicates)', /Handed back/.test(run('/purge restore Anamy', admin)[0]) && !DB().vaults['u-anamy'] &&
  slot(anamy, 0).id == 'minecraft:netherite_sword' && anamy.slots.filter(s => s.id == 'gone:item').length == 1 && anamy.slots.filter(s => s.id == 'minecraft:diamond').length == 1)
ok('... the backup file is marked restored', !!files['kubejs/purge_vaults/Anamy_u-anamy.json'].restored)
ok('KitKat was dead at the end: her vault waits', !!DB().vaults['u-kitkat'] && !kitkat.slots.some(s => s.id == 'minecraft:diamond_sword'))
respawn(kitkat); advance(2)
ok('... and comes back when she respawns', !DB().vaults['u-kitkat'] && slot(kitkat, 0).id == 'minecraft:diamond_sword' && !kitkat.slots.some(isKit))
ok('Stang (offline) still has his vault', !!DB().vaults['u-stang'])
login(stang); advance(25)
ok('... handed back when he logs in', !DB().vaults['u-stang'] && !stang.slots.some(isKit) && said(stang, /belongings are back/))
login(goruk); advance(45)
ok('Goruk, who ran, is told about the raid at his next login', said(goruk, /logged out mid-fight in the Purge\. Anamy raided your war chest: -[\d,]+ potatoes/))
ok('after the Purge, /home works again', !typed(anamy, 'home'))
ok('/purge history (op) lists it', /The Potato Heist \(peasant\), \d+ min, \d+ fighters: \w+ won/.test(run('/purge history', admin)[0]))

// ---------- a failed save ----------
ok('/purge stop with nothing running', /No Purge is running/.test(run('/purge stop', admin)[0]))
const careful = player('Careful', 3, 3)
careful.slots[0] = Item.of('minecraft:beacon', 1)
ok('a random kit when none is named', /Started/.test(run('/purge start heist 5', admin)[0]) && ['soldier', 'peasant', 'archer', 'gladiator'].indexOf(DB().cur.kit) >= 0)
failSave = true
careful.x = 50; seconds(1)
failSave = false
ok('if their belongings can\'t be saved, the player is left untouched and sits it out', slot(careful, 0).id == 'minecraft:beacon' && !DB().vaults['u-careful'] && said(admin, /Careful's belongings could not be saved/))
seconds(2)
ok('... and isn\'t tried again every second', slot(careful, 0).id == 'minecraft:beacon' && admin.msgs.filter(m => /Careful's belongings could not be saved/.test(m)).length == 1)
ok('/purge stop ends it early', /Stopped/.test(run('/purge stop', admin)[0]) && !DB().cur && DB().history[0].reason == 'stopped' && said(anamy, /\(Ended early\.\)/))
ok('the soldier kit puts the shield in the off-hand', (() => {
  run('/purge start heist 5 soldier', admin)
  const ok2 = slot(anamy, 40).id == 'minecraft:shield' && slot(anamy, 38).id == 'minecraft:iron_chestplate' && slot(anamy, 2).id == 'minecraft:arrow' && slot(anamy, 2).count == 32
  run('/purge stop', admin)
  return ok2 && slot(anamy, 0).id == 'minecraft:netherite_sword'
})())
ok('the API', typeof global.Purge.start == 'function' && global.Purge.active() === false && global.Purge.tithed() == DB().tithe && global.Purge.kits.gladiator.armor.length == 4)
ok('no errors logged (apart from the item that no longer exists and the failed save)', !logs.some(l => /^ERR/.test(l) && !/gone:item|disk full|Could not vault Careful/.test(l)), logs.filter(l => /^ERR/.test(l)).join('; '))

Date.now = realNow
console.log(fails ? fails + ' FAILED' : 'ALL PASSED')
