// gladiator_arena.js: the tile and its window, the challenge (accept, decline, time out), building and taking down the
// arena, rounds with lives, knockouts and ring-outs, deciding rounds, the time limit, kits and the vault, leaving,
// restarts, and the arena's protection.
// Run with: node tools/tests/run_all.js gladiator   (or node tools/tests/suites/gladiator_arena.test.js)
const fs = require('fs')
const paths = require('../lib/paths')
const src = fs.readFileSync(paths.server('gladiator_arena.js'), 'utf8')
let fails = 0
const ok = (l, c, e) => { console.log((c ? 'ok   ' : 'FAIL ') + l + (!c && e !== undefined ? '  ' + e : '')); if (!c) fails++ }

// ---------- the mock ----------
const OW = 'minecraft:overworld'
let T = 1700000000000
const realNow = Date.now
Date.now = () => T
let tick = 0, queue = []
function advance(n) { for (let i = 0; i < n; i++) { tick++; T += 50; const due = queue.filter(q => q[0] <= tick); queue = queue.filter(q => q[0] > tick); due.forEach(q => q[1]()) } }
const seconds = n => advance(n * 20)
const persistent = {}, cmds = [], logs = [], files = {}
const blocks = {}
let chunksAt = 0, piecesThere = true, placeWorks = true
function blockObj(x, y, z) { return { id: blocks[x + ',' + y + ',' + z] || 'minecraft:air', x, y, z, level, getDimension: () => OW } }
const level = {
  dimension: { location: () => OW }, getBlock: (x, y, z) => blockObj(x, y, z), hasChunk: () => tick >= chunksAt,
  getMaxBuildHeight: () => 320, getSharedSpawnPos: () => ({ getX: () => 0, getY: () => 64, getZ: () => 0 }),
}
const jlist = arr => ({ size: () => arr.length, get: i => arr[i], iterator() { let i = 0; return { hasNext: () => i < arr.length, next: () => arr[i++] } } })
function textOf(c) { return Array.isArray(c) ? c.map(x => (typeof x == 'string' ? x : x.text || '')).join('') : String(c) }
function stack(id, count, nbt, opts) {
  opts = opts || {}
  const s = { id, count: count == null ? 1 : count, nbt: nbt || null, isEmpty() { return this.count <= 0 || this.id == 'minecraft:air' },
    copy() { return stack(id, this.count, nbt) },
    serializeNBT() { return opts.unsavable ? '' : JSON.stringify({ id, Count: this.count, tag: nbt || null }) } }
  return s
}
const EMPTY = stack('minecraft:air', 0)
const Item = { of: (id, n, nbt) => stack(id, n == null ? 1 : n, nbt || null), empty: EMPTY }
const players = []
function player(name, opts) {
  opts = opts || {}
  const slots = []
  const p = { name, uuid: 'u-' + name.toLowerCase(), online: true, op: !!opts.op, x: opts.x || 0, y: 64, z: opts.z || 0, msgs: [], raw: [], health: 20,
    creative: false, fallDistance: 0, menu: 'InventoryMenu', gui: null, tags: [], fx: {}, level,
    isPlayer: () => true, getGameProfile: () => ({ getName: () => name }), getStringUuid: () => p.uuid,
    getX: () => p.x, getY: () => p.y, getZ: () => p.z, hasPermissions: () => p.op, isCreative: () => p.creative,
    tell: c => { p.msgs.push(textOf(c)); p.raw.push(c) },
    setHealth: h => { p.health = h }, getMaxHealth: () => 20, clearFire: () => { },
    inventory: { getContainerSize: () => 41, getItem: i => slots[i] || EMPTY, setItem: (i, s) => { slots[i] = s }, clearContent: () => { slots.length = 0 } },
    give: s => { for (let i = 0; i < 36; i++) if (!slots[i] || slots[i].isEmpty()) { slots[i] = s; return } }, slots,
    get containerMenu() { return { getClass: () => ({ getSimpleName: () => p.menu }) } },
    closeMenu: () => { p.menu = 'InventoryMenu' },
    openChestGUI: (title, rows, fn) => {
      const gui = { slots: {}, slot(x, y, f) { const s = {}; f(s); this.slots[x + ',' + y] = s } }
      fn(gui)
      p.gui = gui
      p.menu = 'CustomChestMenu'
    },
    rayTrace: () => ({ block: blockObj(3, 64, 3) }),
  }
  players.push(p)
  return p
}
const byName = n => players.find(p => p.name == n || p.uuid == n)
const server = {
  get players() { return jlist(players.filter(p => p.online)) },
  scheduleInTicks: (n, fn) => queue.push([tick + n, fn]),
  persistentData: { getString: k => persistent[k] || '', putString: (k, v) => { persistent[k] = v } },
  getAllLevels: () => jlist([level]),
  overworld: () => level,
  getStructureManager: () => ({ get: () => ({ isPresent: () => piecesThere }) }),
  runCommandSilent: c => {
    cmds.push(c)
    let m
    if ((m = c.match(/run tp (\S+) ([-\d.]+) ([-\d.]+) ([-\d.]+)/))) { const p = byName(m[1]); if (p) { p.x = +m[2]; p.y = +m[3]; p.z = +m[4] } return 1 }
    if ((m = c.match(/run spreadplayers ([-\d.]+) ([-\d.]+) \S+ \S+ \S+ (\S+)$/))) { const p = byName(m[3]); if (p) { p.x = +m[1]; p.y = 64; p.z = +m[2] } return 1 }
    if (/run place template /.test(c)) return placeWorks ? 1 : 0
    if ((m = c.match(/^tag (\S+) (add|remove) (\S+)$/))) {
      const p = byName(m[1])
      if (p) { if (m[2] == 'add') p.tags.push(m[3]); else p.tags = p.tags.filter(t => t != m[3]) }
      return 1
    }
    if ((m = c.match(/^effect give (\S+) minecraft:(\S+) (\d+) (\d+)/))) { const p = byName(m[1]); if (p) p.fx[m[2]] = +m[3]; return 1 }
    if ((m = c.match(/^effect clear (\S+)$/))) { const p = byName(m[1]); if (p) p.fx = {}; return 1 }
    return 1
  },
}
// KubeJS events: cancel() marks the event and stops the handler.
const handlers = {}
const on = name => h => { (handlers[name] = handlers[name] || []).push(h) }
const EXIT = { exit: true }
function fire(name, ev) {
  ev.cancelled = false
  ev.cancel = () => { ev.cancelled = true; throw EXIT }
  ;(handlers[name] || []).forEach(h => { try { h(ev) } catch (e) { if (e !== EXIT) throw e } })
  return ev
}
let cmdTree = null
const node = n => ({ n, ch: [], req: null, f: null, then(c) { this.ch.push(c); return this }, requires(f) { this.req = f; return this }, executes(f) { this.f = f; return this } })
const global = {}
let started = false
const Utils = { get server() { return started ? server : null } }
const NBT = { toTagCompound: s => s }
const ItemStackClass = { of: s => { const o = JSON.parse(s); return stack(o.id, o.Count, o.tag) } }
function RL(s) { this.s = s }
new Function('EntityEvents', 'BlockEvents', 'PlayerEvents', 'ServerEvents', 'LevelEvents', 'Java', 'Utils', 'Item', 'Text', 'JsonIO', 'NBT', 'console', 'global', src)(
  { hurt: on('hurt'), death: on('death'), spawned: on('spawned') },
  { broken: on('broken'), placed: on('placed'), rightClicked: on('rightClicked') },
  { loggedIn: on('loggedIn'), loggedOut: on('loggedOut'), respawned: on('respawned') },
  { loaded: on('loaded'), commandRegistry: h => h({ commands: { literal: node, argument: n => node(n) }, arguments: { INTEGER: { create: () => 'int', getResult: (ctx, k) => ctx.args[k] } }, register: t => { cmdTree = t } }) },
  { afterExplosion: on('afterExplosion') },
  { loadClass: n => {
    if (/Component\$Serializer/.test(n)) return { fromJsonLenient: j => JSON.parse(j) }
    if (/ItemStack$/.test(n)) return ItemStackClass
    if (/ResourceLocation/.test(n)) return RL
    if (/StringArgumentType/.test(n)) return { word: () => 'word', getString: (ctx, k) => ctx.args[k] }
    throw new Error('no class ' + n)
  } },
  Utils, Item, { of: s => s }, { write: (p, o) => { files[p] = JSON.parse(JSON.stringify(o)) } }, NBT,
  { info: m => logs.push(m), warn: m => logs.push('WARN ' + m), error: m => logs.push('ERR ' + m) },
  global)
started = true
fire('loaded', { server })
function cmd(args, as) {
  const replies = []
  const ctx = { args: {}, source: { server, hasPermission: () => !!(as && as.op), getPlayer: () => as || null, sendSystemMessage: c => replies.push(textOf(c)) } }
  let n = cmdTree
  for (const a of args) {
    let next = n.ch.find(c => c.n == a)
    if (!next) { next = n.ch.find(c => c.n == 'id'); ctx.args.id = Number(a) }
    if (!next) throw new Error('no command ' + args.join(' '))
    if (next.req && !next.req(ctx.source)) return ['DENIED']
    n = next
  }
  n.f(ctx)
  return replies
}
const G = () => global.Gladiator
const state = () => G().state()
const said = (p, re) => p.msgs.some(m => re.test(m))
const since = c0 => cmds.slice(c0)
function clickTile(p, hand) { const ev = fire('rightClicked', { player: p, block: blockObj(3, 64, 3), hand: hand || 'MAIN_HAND', server }); advance(1); return ev }
function click(p, x, y) { const s = p.gui.slots[x + ',' + y]; s.leftClicked({}); advance(3) }
const slotName = (p, x, y) => { const it = p.gui.slots[x + ',' + y].item; const m = (it.nbt || '').match(/Name:'([^']*)'/); return m ? JSON.parse(m[1].replace(/\\'/g, "'")).text : '' }
function hit(victim, attacker, type) { return fire('hurt', { entity: victim, server, source: { getActual: () => attacker, getMsgId: () => type || 'player' } }).cancelled }
function die(victim, attacker, type) { return fire('death', { entity: victim, server, source: { getActual: () => attacker, getMsgId: () => type || 'player' } }).cancelled }
const corner = { x: 8000 - 82, y: 230, z: 8000 - 82 }
const dist = p => Math.hypot(p.x - 8000.5, p.z - 8000.5)
const fighter = n => state().cur.fighters['u-' + n.toLowerCase()]
// Every challenged player accepts (by clicking [Accept] in chat: /gladiator accept <id>).
function acceptAll(except) {
  const P = state().pending
  Object.keys(P.fighters).forEach(u => { if (!P.fighters[u].ok && u != except) cmd(['accept', String(P.id)], byName(u)) })
}
// From all accepted to the first round being fought: the arena builds (25 pieces), everyone's taken there, countdown.
function toFight() { advance(80); seconds(7) }

// ---------- the tile and the window ----------
const admin = player('Admin', { op: true }), ana = player('Ana'), bob = player('Bob', { x: 30 }), cara = player('Cara', { x: -40 })
ok('/gladiator tile set is op-only', cmd(['tile', 'set'], ana)[0] == 'DENIED')
ok('/gladiator tile set marks the block the op looks at', /The arena tile is the minecraft:air at 3 64 3/.test(cmd(['tile', 'set'], admin)[0]) && state().tile.x == 3)
clickTile(ana)
ok('right-clicking the tile opens the arena window', !!ana.gui && ana.menu == 'CustomChestMenu')
ok('... with a head for each online player (sorted), Ana picked to start with', slotName(ana, 0, 0) == 'Admin' && slotName(ana, 1, 0) == 'Ana' && slotName(ana, 2, 0) == 'Bob' && slotName(ana, 3, 0) == 'Cara' &&
  /In the fight/.test(ana.gui.slots['1,0'].item.nbt) && !/In the fight/.test(ana.gui.slots['2,0'].item.nbt))
ok('... rounds 3 and lives 3, and own gear chosen', slotName(ana, 2, 4) == 'Rounds: 3' && slotName(ana, 6, 4) == 'Lives: 3' && /Chosen/.test(ana.gui.slots['0,5'].item.nbt))
let ev = clickTile(ana, 'OFF_HAND')
ok('the click on the tile is cancelled (whatever block it is), and the off hand doesn\'t open a second window', ev.cancelled)
click(ana, 2, 0)
ok('clicking Bob\'s head adds him (the window closes, then reopens)', /In the fight/.test(ana.gui.slots['2,0'].item.nbt) && ana.menu == 'CustomChestMenu')
click(ana, 3, 4); click(ana, 3, 4)
ok('more rounds: 5', slotName(ana, 2, 4) == 'Rounds: 5')
for (let i = 0; i < 12; i++) click(ana, 7, 4)
ok('more lives stops at 10', slotName(ana, 6, 4) == 'Lives: 10')
for (let i = 0; i < 12; i++) click(ana, 5, 4)
ok('fewer lives stops at 1', slotName(ana, 6, 4) == 'Lives: 1')
click(ana, 7, 4)
click(ana, 1, 5)
ok('choosing the Soldier kit', /Chosen/.test(ana.gui.slots['1,5'].item.nbt) && !/Chosen/.test(ana.gui.slots['0,5'].item.nbt))
click(ana, 0, 5)
click(ana, 2, 0)
click(ana, 8, 5)
ok('sending with only herself picked: refused', said(ana, /Pick at least two fighters/) && !state().pending)
click(ana, 2, 0)

// ---------- the challenge ----------
click(ana, 8, 5)
const P1 = state().pending
ok('the challenge: Ana and Bob, 5 rounds, 2 lives, own gear; Ana has accepted (she sent it)', !!P1 && P1.rounds == 5 && P1.lives == 2 && P1.gear == 'own' &&
  P1.fighters['u-ana'].ok && !P1.fighters['u-bob'].ok && Object.keys(P1.fighters).length == 2)
ok('everyone online hears it (player.tell, never tellraw)', said(cara, /Ana calls Bob to the arena: 5 rounds, 2 lives a round, their own gear/) && !cmds.some(c => /tellraw/.test(c)))
const inv = bob.raw[bob.raw.length - 1]
ok('Bob gets [Accept] and [Decline] that run /gladiator accept|decline <id>', JSON.stringify(inv).indexOf('/gladiator accept ' + P1.id) >= 0 && JSON.stringify(inv).indexOf('/gladiator decline ' + P1.id) >= 0)
clickTile(cara)
ok('while it waits, the tile only says what\'s going on', said(cara, /A challenge is already waiting for answers\. Waiting for Bob to accept/) && cara.menu != 'CustomChestMenu')
ok('Cara can\'t accept a challenge she wasn\'t in', /You weren't challenged/.test(cmd(['accept', String(P1.id)], cara)[0]))
cmd(['decline', String(P1.id)], bob)
ok('Bob declines: the challenge is off, and both are told', !state().pending && said(ana, /The challenge is off: Bob declined/) && said(bob, /The challenge is off: Bob declined/))
ok('an old challenge\'s buttons do nothing', /isn't open any more/.test(cmd(['accept', String(P1.id)], bob)[0]))
clickTile(ana); click(ana, 8, 5)
seconds(61)
ok('nobody answers for 60 s: called off, naming who didn\'t answer', !state().pending && said(ana, /Bob didn't answer in time/))
global.Purge = { busy: () => 'A Purge is already running.' }
clickTile(ana)
ok('during a Purge the tile refuses', said(ana, /A Purge is on/) && ana.menu != 'CustomChestMenu')
delete global.Purge

// ---------- building the arena ----------
clickTile(ana); click(ana, 8, 5)
const P2 = state().pending
chunksAt = tick + 20                          // the site's chunks take a second to load
let c0 = cmds.length
acceptAll()
ok('Bob accepts: everyone has, so the match begins', !state().pending && state().cur && state().cur.phase == 'building' && said(ana, /Bob accepts \(2 of 2\)/))
ok('... and the site is force-loaded (the whole 165 x 165)', cmds.includes('execute in minecraft:overworld run forceload add 7918 7918 8082 8082'))
advance(10)
ok('nothing is placed until the chunks are loaded', !since(c0).some(c => /place template/.test(c)))
advance(70)
const places = since(c0).filter(c => /place template/.test(c))
ok('then the 25 pieces, a piece every 2 ticks, at corner + 33 x (i, k), 230 up', places.length == 25 &&
  places.includes('execute in minecraft:overworld run place template trollcraft:gladiator_arena/p_0_0 7918 230 7918') &&
  places.includes('execute in minecraft:overworld run place template trollcraft:gladiator_arena/p_4_4 8050 230 8050') &&
  places.includes('execute in minecraft:overworld run place template trollcraft:gladiator_arena/p_2_3 7984 230 8017'), places.length)
ok('the arena is up', state().arena.state == 'built' && state().arena.site.x == 8000)
ok('both are tagged and on the bossbar', ana.tags.includes('gladiator') && bob.tags.includes('gladiator') && cmds.some(c => /^bossbar set trollcraft:gladiator players @a\[tag=gladiator\]$/.test(c)))
ok('... and taken to spawn points on the floor, apart, facing the middle', dist(ana) > 30 && dist(ana) < 60 && dist(bob) > 30 && dist(bob) < 60 &&
  Math.hypot(ana.x - bob.x, ana.z - bob.z) > 50 && ana.y >= 230 && since(c0).some(c => /run tp Ana [-\d.]+ [-\d.]+ [-\d.]+ -?\d+ 0$/.test(c)), ana.x + ' ' + ana.z + ' / ' + bob.x + ' ' + bob.z)
ok('everyone online hears the gladiators are in', said(cara, /The gladiators are in the arena: Ana and Bob/))
ok('round 1: a countdown first', state().cur.phase == 'countdown' && state().cur.round == 1 && cmds.some(c => /title @a\[tag=gladiator\] title .*Round 1 of 5/.test(c)))
ok('during the countdown nobody can be hurt', hit(bob, ana) && hit(ana, null, 'fall'))
seconds(6)
ok('then FIGHT', state().cur.phase == 'fight' && cmds.some(c => /FIGHT!/.test(c)))

// ---------- a round ----------
ok('fighters can hurt each other now', !hit(bob, ana) && !hit(ana, null, 'fall'))
ok('Cara (not in the match) can\'t hurt Bob, and Ana can\'t hurt Cara', hit(bob, cara) && hit(cara, ana))
c0 = cmds.length
ok('lethal damage to Bob: no death (cancelled)', die(bob, ana))
ok('... a knockout: one of his 2 lives gone, healed, credited to Ana, sent to the spawn point furthest from her', fighter('Bob').left == 1 && bob.health == 20 && fighter('Ana').kills == 1 &&
  Math.hypot(ana.x - bob.x, ana.z - bob.z) > 40 && said(bob, /Knocked out by Ana\. 1 life left/), Math.hypot(ana.x - bob.x, ana.z - bob.z))
ok('... with a few seconds\' resistance', since(c0).includes('effect give Bob minecraft:resistance 3 4 true'))
die(bob, ana)
ok('his last life: out of the round, up on the wall', fighter('Bob').out && dist(bob) > 70 && dist(bob) < 84 && bob.y == 230 + 15 && said(bob, /out of this round: watch from the wall/))
ok('... and Ana takes round 1', state().cur.phase == 'between' && fighter('Ana').wins == 1 && said(bob, /Round 1 goes to Ana\. Rounds won: Ana 1, Bob 0/))
ok('between rounds, nobody can be hurt', hit(ana, bob) && hit(bob, ana))
seconds(7)
ok('round 2: lives back, everyone back on the floor', state().cur.round == 2 && fighter('Bob').left == 2 && !fighter('Bob').out && dist(bob) < 60 && state().cur.phase == 'countdown')
seconds(6)
// a ring-out: Bob is hit, then falls off the edge
hit(bob, ana)
bob.x = 8000 + 90
seconds(1)
ok('leaving the arena (falling off, a pearl): rung out, a life gone, credited to whoever hit him last', fighter('Bob').left == 1 && fighter('Ana').kills == 3 && said(bob, /Rung out by Ana/) && dist(bob) < 60)
bob.x = 8000 + 300; bob.y = 64
T += 11000                                    // no hit in the last 10 seconds
seconds(1)
ok('... rung out again with no recent hit: nobody credited, and out of the round', fighter('Bob').out && fighter('Ana').kills == 3)
ok('Ana leads 2-0 after round 2', fighter('Ana').wins == 2 && state().cur.phase == 'between')
seconds(7); seconds(6)
// round 3: Ana wins again: 3-0 with 2 rounds left, nobody can catch up
die(bob, ana); die(bob, ana)
ok('round 3 to Ana: 3-0', fighter('Ana').wins == 3)
c0 = cmds.length
seconds(7)
ok('with 3 wins and 2 rounds left, Bob can\'t catch up: Ana wins the match', !state().cur && said(cara, /Ana wins the gladiator match against Bob\. Rounds won: Ana 3, Bob 0\./))
ok('... both go back to spawn, untagged; the bossbar goes', Math.hypot(ana.x, ana.z) < 1 && Math.hypot(bob.x, bob.z) < 1 && !ana.tags.length && !bob.tags.length && since(c0).includes('bossbar remove trollcraft:gladiator'))
seconds(5)
const fills = since(c0).filter(c => /run fill /.test(c))
ok('... and the arena comes down: 75 fills of air (33 x 23 x 33, under the 32,768 limit), loose items swept, the chunks let go', fills.length == 75 &&
  fills.includes('execute in minecraft:overworld run fill 7918 230 7918 7950 252 7950 minecraft:air') && fills.includes('execute in minecraft:overworld run fill 8050 276 8050 8082 296 8082 minecraft:air') &&
  since(c0).some(c => /kill @e\[type=minecraft:item,x=7918,y=228,z=7918,dx=164,dy=70,dz=164\]/.test(c)) &&
  since(c0).includes('execute in minecraft:overworld run forceload remove 7918 7918 8082 8082') && state().arena.state == 'none', fills.length)
ok('/gladiator history', /#\d+: Ana won \(Ana 3, Bob 0\)/.test(cmd(['history'], cara)[0]))

// ---------- a tie and a deciding round; the time limit ----------
G().state()
clickTile(ana); click(ana, 3, 0)               // Cara in too: Ana, Bob, Cara
for (let i = 0; i < 4; i++) click(ana, 1, 4)   // 1 round
click(ana, 5, 4)                               // 1 life
click(ana, 8, 5)
acceptAll(); toFight()
ok('a three-way match, 1 round, 1 life', Object.keys(state().cur.fighters).length == 3 && state().cur.rounds == 1 && state().cur.lives == 1 && state().cur.phase == 'fight')
seconds(10 * 60)
ok('nobody falls in 10 minutes: the round has no winner (all tied on lives)', state().cur.phase == 'between' && said(ana, /Round 1 has no winner \(time ran out\)/))
seconds(7)
ok('all three tied at 0 wins with no rounds left: a deciding round between the three', state().cur.deciders.length == 3 && state().cur.deciding == 1 && said(ana, /Deciding round: Ana, Bob and Cara are tied/))
seconds(6)
die(cara, bob)
ok('Cara is out of the deciding round', fighter('Cara').out && state().cur.phase == 'fight')
seconds(10 * 60)
ok('time runs out with Ana and Bob on 1 life each: no winner again', state().cur.phase == 'between')
seconds(7); seconds(6)
die(bob, ana)
die(cara, ana)
seconds(7)
ok('the second deciding round: Ana outlasts both and wins the match', !state().cur && said(bob, /Ana wins the gladiator match against Bob and Cara/))
seconds(5)

// ---------- a kit match: the vault ----------
ana.slots[0] = stack('minecraft:netherite_sword', 1, '{Enchantments:[{id:"minecraft:sharpness",lvl:5s}]}')
ana.slots[39] = stack('minecraft:netherite_helmet', 1)
bob.slots[3] = stack('minecraft:cookie', 7)
clickTile(ana); click(ana, 3, 0)               // Cara out again
click(ana, 4, 5)                               // the Gladiator kit
click(ana, 7, 4)                               // 2 lives
click(ana, 8, 5)
acceptAll(); toFight()
ok('a Gladiator-kit match: Ana\'s belongings are held (saved whole), her inventory is the kit', !!state().vaults['u-ana'] && state().vaults['u-ana'].slots.length == 2 &&
  ana.slots[0].id == 'minecraft:diamond_sword' && /GladiatorKit:1b/.test(ana.slots[0].nbt) && ana.slots[39].id == 'minecraft:diamond_helmet')
ok('... with a backup file', !!files['kubejs/gladiator_vaults/Ana_u-ana.json'])
ana.slots[0] = EMPTY
die(ana, bob)
ok('a knockout gives a fresh kit', ana.slots[0].id == 'minecraft:diamond_sword' && fighter('Ana').left == 1)
c0 = cmds.length
cmd(['stop'], admin)
ok('/gladiator stop: no winner, and everyone goes home', !state().cur && said(cara, /The gladiator match is over with no winner: an op stopped it/))
ok('... with their own things back where they were, the kit gone', ana.slots[0].id == 'minecraft:netherite_sword' && /sharpness/.test(ana.slots[0].nbt) && ana.slots[39].id == 'minecraft:netherite_helmet' &&
  !ana.slots.some(s => s && /GladiatorKit/.test(s.nbt || '')) && bob.slots[3].id == 'minecraft:cookie' && !state().vaults['u-ana'])
seconds(5)
// an item that can't be stored safely: nobody fights, nothing is lost
bob.slots[5] = stack('weird:bag', 1, null, { unsavable: true })
ana.slots[0] = stack('minecraft:netherite_sword', 1)
clickTile(ana); click(ana, 8, 5)
acceptAll()
const anaAt = [ana.x, ana.z]
advance(80)
ok('Bob holds an item that can\'t be stored safely: called off, Ana\'s things back, nobody moved', !state().cur && said(ana, /called off: Bob: 1 of their items \(weird:bag\) could not be stored safely/) &&
  ana.slots[0].id == 'minecraft:netherite_sword' && bob.slots[5].id == 'weird:bag' && !state().vaults['u-ana'] && ana.x == anaAt[0] && ana.z == anaAt[1])
seconds(5)
bob.slots[5] = EMPTY

// ---------- leaving, /kill, restarts ----------
clickTile(ana); click(ana, 0, 5)                // own gear
click(ana, 8, 5)
acceptAll(); toFight()
bob.online = false
fire('loggedOut', { player: bob, server })
ok('Bob logs out mid-match: he\'s out of it, and with one fighter left, Ana wins', !state().cur && said(cara, /Ana wins the gladiator match against Bob \(the others left\)/))
ok('... Bob is owed a trip home', state().owed['u-bob'] === true)
seconds(5)
bob.online = true
fire('loggedIn', { player: bob, server })
advance(21)
ok('he logs back in: taken home', Math.hypot(bob.x, bob.z) < 1 && !state().owed['u-bob'])
clickTile(ana); click(ana, 3, 0); click(ana, 8, 5)
acceptAll(); toFight()
ok('/kill (genericKill) still kills: not cancelled, and Cara leaves the match', !die(cara, null, 'genericKill') && fighter('Cara').gone)
fire('respawned', { player: cara, server })
advance(3)
ok('... she respawns and is taken home; the match goes on for Ana and Bob', Math.hypot(cara.x, cara.z) < 1 && !!state().cur && !cara.tags.length)
ok('a fighter who left can be hurt as usual again', !hit(cara, cara, 'fall'))
fire('loaded', { server })                     // the server restarts mid-match
ok('a restart mid-match ends it (no winner) and owes everyone a trip home', !state().cur && said(admin, /no winner: the server restarted/))
seconds(5)
ok('... and the arena comes down', state().arena.state == 'none')

// ---------- the arena's protection, and the ops' commands ----------
ok('/gladiator build is op-only', cmd(['build'], ana)[0] == 'DENIED')
cmd(['build'], admin)
advance(80)
ok('/gladiator build puts it up without a match', state().arena.state == 'built')
ev = fire('broken', { player: ana, block: blockObj(8000, 240, 8000), server })
ok('breaking a block in the arena: cancelled', ev.cancelled && said(ana, /The arena can't be changed/))
ok('... placing too; outside it, anything goes; in creative, anything goes', fire('placed', { player: ana, block: blockObj(8010, 236, 8010), server }).cancelled &&
  !fire('broken', { player: ana, block: blockObj(100, 64, 100), server }).cancelled && (() => { admin.creative = true; const r = !fire('broken', { player: admin, block: blockObj(8000, 240, 8000), server }).cancelled; admin.creative = false; return r })())
let removed = false
fire('afterExplosion', { x: 8000, y: 240, z: 8000, level, removeAllAffectedBlocks: () => { removed = true }, server })
ok('an explosion in the arena breaks no blocks', removed)
const zombie = { getX: () => 8000, getY: () => 236, getZ: () => 8000, level, isPlayer: () => false, getType: () => ({ getCategory: () => 'MONSTER' }) }
const cow = { getX: () => 8000, getY: () => 236, getZ: () => 8000, level, isPlayer: () => false, getType: () => ({ getCategory: () => 'CREATURE' }) }
ok('no monsters spawn in it (a cow may)', fire('spawned', { entity: zombie, server }).cancelled && !fire('spawned', { entity: cow, server }).cancelled)
ok('/gladiator site here refuses while it\'s up', /Not while the arena is up/.test(cmd(['site', 'here'], admin)[0]))
cmd(['clear'], admin)
seconds(5)
ok('/gladiator clear takes it down', state().arena.state == 'none')
admin.x = 20000.4; admin.z = -500.7
ok('/gladiator site here: centred on the op, from y 230', /centred on 20000 -501 in minecraft:overworld, from y 230 to 296/.test(cmd(['site', 'here'], admin)[0]) && G().site().x == 20000)
cmd(['site', 'reset'], admin)
blocks['7998,236,7998'] = 'minecraft:stone'    // a mountain where the arena would go (the check samples every 8 blocks)
clickTile(ana); click(ana, 8, 5)
const anaBefore = [ana.x, ana.z]
acceptAll()
c0 = cmds.length
advance(60)
ok('something already at the site: nothing is placed, the match is called off, nobody moved', !state().cur && !since(c0).some(c => /place template|run fill/.test(c)) &&
  said(ana, /no winner: the arena could not be built: something is already there \(minecraft:stone at 7998 236 7998\)/) && ana.x == anaBefore[0] && state().arena.state == 'none')
delete blocks['7998,236,7998']
piecesThere = false
clickTile(ana); click(ana, 8, 5)
acceptAll()
advance(10)
ok('the structure files missing: called off, saying so', !state().cur && said(ana, /its structure files are missing/))
piecesThere = true
const unexpected = logs.filter(l => /^ERR/.test(l) && !/The arena could not be built: something is already there/.test(l))
ok('no errors logged (but the blocked site, on purpose)', !unexpected.length, unexpected.join(' | '))

Date.now = realNow
console.log(fails ? fails + ' FAILED' : 'ALL PASSED')
