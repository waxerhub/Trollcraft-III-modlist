// Run with: node tools/tests/run_all.js pig_escort_finale   (or node tools/tests/suites/pig_escort_finale.test.js)
const REPO_ROOT = require('path').resolve(__dirname, '..', '..', '..')
// Mock test for the Pig Escort finale (the Syndicate reveal).
const { makeWorld, loadScript, buildCommands } = require('../lib/mock')
const FILE = REPO_ROOT + '/tools/kubejs/server_scripts/events/pig_escort.js'
let fails = 0
function check(label, cond, extra) { console.log((cond ? 'ok   ' : 'FAIL ') + label + (cond || extra === undefined ? '' : '  ' + extra)); if (!cond) fails++ }

function world(patch, defaults) {
  const W = makeWorld({})
  const pd = W.server.persistentData
  pd.putBoolean = (k, v) => { W.persistent[k] = !!v }
  pd.getBoolean = k => W.persistent[k] === true
  W.log2 = []
  const orig = W.server.runCommandSilent
  W.fakeJoinDelay = 30
  // visual-only lightning and the weather
  W.bolts = []
  W.weather = 'clear'
  W.overworld.createEntity = type => {
    const b = { type: type, visualOnly: false }
    return {
      setVisualOnly(v) { if (W.noVisualOnly) throw new Error('TypeError: setVisualOnly is not a function'); b.visualOnly = v },
      setPosition(x, y, z) { b.x = x; b.y = y; b.z = z },
      spawn() { b.t = W.tick; W.bolts.push(b) },
    }
  }
  W.overworld.isRaining = () => { if (W.noWeatherRead) throw new Error('no isRaining'); return W.weather != 'clear' }
  W.overworld.isThundering = () => { if (W.noWeatherRead) throw new Error('no isThundering'); return W.weather == 'thunder' }
  W.server.runCommandSilent = cmd => {
    W.log2.push({ t: W.tick, c: cmd })
    let w = cmd.match(/^(?:execute in \S+ run )?weather (clear|rain|thunder)$/)
    if (w) { W.weather = w[1]; return 1 }
    let m = cmd.match(/^fakejoin (\S+)$/)
    if (m) {
      if (W.noFakePlayers) return 0
      const fp = W.global.fakePlayers = W.global.fakePlayers || { fakes: {} }
      if (!W.noSay) fp.say = (name, text) => { if (!fp.fakes[String(name).toLowerCase()]) return name + ' is not a pretend player.'; (W.said = W.said || []).push({ t: W.tick, name, text }); return '<' + name + '> ' + text }
      if (fp.fakes[m[1].toLowerCase()]) return 0
      W.queue.push({ at: W.tick + W.fakeJoinDelay, f: () => { fp.fakes[m[1].toLowerCase()] = { name: m[1] }; W.joinedAt = W.tick } })
      return 1
    }
    return orig(cmd)
  }
  loadScript(W, FILE, s => {
    s = s.replace('const TEST_MODE = false', 'const TEST_MODE = true')
    s = s.replace('  seconds: 21, ', '  seconds: 0, ')   // most tests: no track (the track tests put one back)
    if (!defaults) {
      // the leader and the Jockie cue are off by default; most tests switch them back on
      s = s.replace("const LEADER_NAME = ''", "const LEADER_NAME = 'hypixel'").replace('  jockie: false, ', '  jockie: true, ')
    }
    return patch ? patch(s) : s
  })
  W.serverStarted = true
  W.fire('loaded', { server: W.server })
  buildCommands(W)
  W.advance(25)
  return W
}
function addPlayer(W, name, x, y, z, op) {
  const p = W.addPlayer(name, x, y, z)
  p.hasPermissions = n => !!op
  p.knocks = []
  p.knockback = function (s, dx, dz) { this.knocks.push([s, dx, dz]) }
  return p
}
const near = (a, b) => a != null && Math.abs(a - b) <= 2
const boltsIn = (W, from, to) => W.bolts.filter(b => b.t >= from && b.t <= to)
const heartbeats = (W, from, to) => W.log2.filter(e => e.t >= from && e.t <= to && /playsound minecraft:entity.warden.heartbeat master @a\[distance=..32\]/.test(e.c))
const weatherCmds = W => W.log2.filter(e => /weather /.test(e.c)).map(e => e.c.replace(/^execute in \S+ run /, ''))
// hypixel's lines: typing time (2 s + 1 s per 8 characters, 3..14 s), in whole ticks, added up
const LINE_TICKS = [260, 503, 731, 1001, 1096, 1291, 1519, 1619]
const since = (W, t0) => W.log2.filter(e => e.t >= t0)
const firstAt = (W, t0, re) => { const e = since(W, t0).find(e => re.test(e.c)); return e ? e.t - t0 : null }
const tellsJson = (W, t0) => since(W, t0).filter(e => /^tellraw @a /.test(e.c)).map(e => ({ t: e.t - t0, j: JSON.parse(e.c.slice(11)) }))
const lineText = j => j.map(p => typeof p == 'string' ? p : p.text).join('')
const blocksSnapshot = W => JSON.stringify(W.blocks)

// Starts an event with the portal where the admin stands (facing north: the portal spans x).
function startRun(W, admin, minutes) {
  W.cmd('pigescort setup', admin)
  admin.x = 0.5; admin.y = 65; admin.z = 0.5
  W.cmd('pigescort setstart', admin)
  admin.x = 0.5; admin.y = 65; admin.z = 60.5
  const r = W.cmd('pigescort setportal', admin)
  if (minutes) W.cmd('pigescort settime ' + minutes, admin)
  W.cmd('pigescort start', admin)
  W.advance(10 * 20 + 2)
  return r
}
function walkPigIn(W) {
  const pig = W.entities.find(e => e.type == 'minecraft:pig' && !e.removed)
  const cells = Object.keys(W.blocks).filter(k => /nether_portal/.test(W.blocks[k])).map(k => k.split(',').map(Number))
  const px = cells[0][0] + 0.5, py = cells[0][1], pz = cells[0][2] + 0.5
  for (let step = 0; step < 200; step++) {
    const dx = px - pig.pos.x, dz = pz - pig.pos.z, d = Math.sqrt(dx * dx + dz * dz)
    if (d < 0.01) break
    const k = Math.min(1, 10 / d)
    pig.pos.x += dx * k; pig.pos.z += dz * k; pig.pos.y = d <= 10 ? py : 65
    W.advance(20)
    if (W.global.pigEscortState.phase != 'running') break
  }
}

// ======================= Ending A: a real delivery =======================
{
  const W = world()
  const admin = addPlayer(W, 'Admin', 0.5, 65, 0.5, true), bob = addPlayer(W, 'Bob', 3.5, 65, 3.5, false)
  startRun(W, admin)
  W.cmd('pigescort wave', admin)
  const mob = W.entities.find(e => e._tags.indexOf('pig_escort_raider') >= 0 && !e.removed)
  W.fire('death', { entity: mob, source: { getActual: () => bob, getType: () => 'player' }, cancel() {} })
  mob.removed = true
  const builtBlocks = Object.keys(W.blocks).filter(k => /nether_portal\[|^minecraft:obsidian$/.test(W.blocks[k]))
  W.given = []
  walkPigIn(W)
  const S = W.global.pigEscortState
  check('delivery starts the finale', S.phase == 'finale' && S.fin.kind == 'success' && !S.fin.test, S.phase)
  const t0 = W.log2.find(e => /Swine has been delivered/.test(e.c)).t
  W.advance(1)
  check('pig and raiders gone at once, bossbar removed', !W.entities.some(e => !e.removed && e._tags.length) && !W.bossbars['kubejs:pig_escort'])
  check('no old ending (DELIVERED title, Top Escort line)', !W.log2.some(e => /DELIVERED|Top Escort|safely delivered/.test(e.c)))
  check('rewards given quietly: a diamond each + top killer bonus for Bob', W.given.filter(g => /diamond/.test(g[1])).length == 3 && W.given.filter(g => g[0] == 'Bob').length == 2, JSON.stringify(W.given))
  check('the event is still marked active during the finale', W.global.trollcraftEventActive === true)
  check('fireworks summoned at T+0, high above the frame', since(W, t0 - 1).filter(e => { const m = e.c.match(/summon minecraft:firework_rocket \S+ (\d+) .*Colors:\[I;16766720,16755200\]/); return m && +m[1] >= 77 }).length == 5, since(W, t0 - 1).filter(e => /firework/.test(e.c)).map(e => e.c)[0])
  // A player at the portal for the explosion push
  const cells = Object.keys(W.blocks).filter(k => /nether_portal/.test(W.blocks[k])).map(k => k.split(',').map(Number))
  bob.x = cells[0][0] + 0.5; bob.y = cells[0][1]; bob.z = cells[0][2] + 3.5
  admin.x = 500; admin.z = 500
  const beforeExplosion = Object.assign({}, W.blocks)
  // firework damage during the finale
  let ev = { entity: bob, source: { getActual: () => null, getType: () => 'fireworks' }, cancelled: false, cancel() { this.cancelled = true } }
  W.fire('hurt', ev); check('firework damage to players is cancelled during the finale', ev.cancelled)
  ev = { entity: bob, source: { getActual: () => null, getType: () => 'fall' }, cancelled: false, cancel() { this.cancelled = true } }
  W.fire('hurt', ev); check('other damage is untouched', !ev.cancelled)
  // walking into the still-lit portal before the explosion
  check('hooks stay on during the finale (the portal stays closed)', W.global.pigEscort.running === true)
  const cara = addPlayer(W, 'Cara', cells[0][0] + 0.5, cells[0][1], cells[0][2] + 0.5, false)
  let tev = { getEntity: () => cara, canceled: false, setCanceled(v) { this.canceled = v } }
  W.global.pigEscort.onTravel(tev)
  check('a player in the event portal during the finale does not travel; put in front of it and told', tev.canceled && Math.abs(cara.z - (cells[0][2] + 0.5)) >= 1.5 && cara.y == cells[0][1] - 1 &&
    W.log2.some(e => /^tellraw Cara .*closed pending an inquiry/.test(e.c)), cara.x + ' ' + cara.y + ' ' + cara.z)
  const zomb = W.makeEntity('minecraft:zombie', 999, 65, 999, [])
  tev = { getEntity: () => zomb, canceled: false, setCanceled(v) { this.canceled = v } }
  W.global.pigEscort.onTravel(tev)
  check('other portals still work during the finale', !tev.canceled)
  cara.online = false

  W.advance(20 * 30)
  const tells = tellsJson(W, t0)
  const at = re => { const x = tells.find(m => re.test(lineText(m.j))); return x ? x.t : null }
  check('T+5 Form 88-D', near(at(/Form 88-D/), 100), at(/Form 88-D/))
  check('T+9 portal hum + darkness near the portal', near(firstAt(W, t0, /playsound minecraft:block.portal.trigger master @a\[distance=..48\]/), 180) && near(firstAt(W, t0, /effect give @a\[distance=..48\] minecraft:darkness 3 0 true/), 180))
  const thanks = tells.find(m => /Thank you for the escort/.test(lineText(m.j)))
  check('T+11 hijack line with obfuscated characters around it', thanks && near(thanks.t, 220) && thanks.j[1].obfuscated && thanks.j[thanks.j.length - 1].obfuscated && thanks.j.some(p => p.text == '[SIGNAL HIJACKED]' && p.color == 'dark_red') && thanks.j.some(p => / Thank you/.test(p.text) && p.color == 'red'), JSON.stringify(thanks))
  check('[MINISTRY] gold tag, yellow text', tells[0].j.some(p => p.text == '[MINISTRY]' && p.color == 'gold') && tells[0].j.some(p => p.color == 'yellow'))
  check('T+14 explosion: emitters, smoke, lava, both sounds within 96 blocks', near(firstAt(W, t0, /particle minecraft:explosion_emitter/), 280) && since(W, t0).filter(e => /particle minecraft:explosion_emitter/.test(e.c)).length == 5 &&
    near(firstAt(W, t0, /particle minecraft:large_smoke/), 280) && near(firstAt(W, t0, /particle minecraft:lava/), 280) &&
    near(firstAt(W, t0, /playsound minecraft:entity.generic.explode master @a\[distance=..96\] ~ ~ ~ 1 1 1/), 280) && near(firstAt(W, t0, /playsound minecraft:entity.wither.spawn master @a\[distance=..96\]/), 280))
  const changed = Object.keys(W.blocks).filter(k => W.blocks[k] != beforeExplosion[k])
  check('explosion changes only the frame (crying obsidian) and the portal (air)', changed.length == 20 &&
    changed.filter(k => W.blocks[k] == 'minecraft:crying_obsidian').length == 14 && changed.filter(k => W.blocks[k] == 'minecraft:air').length == 6, changed.length)
  const exBolts = boltsIn(W, t0 + 270, t0 + 320)
  const airAt = (W.log2.find(e => e.t > t0 && /setblock \S+ \S+ \S+ minecraft:air/.test(e.c)) || {}).t
  check('explosion lightning: 7 visual-only bolts over 1.5 s, the first in the middle of the portal on the same tick the portal goes',
    exBolts.length == 7 && exBolts.every(b => b.visualOnly && b.type == 'minecraft:lightning_bolt') && exBolts[0].t == airAt &&
    Math.abs(exBolts[0].x - (cells[0][0] + 1)) <= 1.01 && Math.abs(exBolts[0].z - (cells[0][2] + 0.5)) < 0.01 && exBolts[6].t - exBolts[0].t == 30 &&
    exBolts.slice(1).every(b => { const d = Math.hypot(b.x - exBolts[0].x, b.z - exBolts[0].z); return d >= 0.99 && d <= 6.01 }),
    JSON.stringify(exBolts.map(b => [b.t - t0, Math.round(b.x * 10) / 10, b.y, Math.round(b.z * 10) / 10])))
  check('no real explosion or summon of anything harmful', !since(W, t0).some(e => /summon minecraft:(tnt|lightning_bolt|end_crystal|creeper)|^(execute .* run )?explode/.test(e.c)))
  check('Bob (3 blocks from the portal) gently pushed away, Admin (far) not', bob.knocks.length == 1 && bob.knocks[0][0] == 0.8 && bob.knocks[0][2] < 0 && bob.hurtMarked === true && admin.knocks.length == 0, JSON.stringify(bob.knocks))
  check('T+17 second hijack line', near(at(/Now every door is open/), 340))
  check('T+21 reveal title for everyone (THE BLOOD GOD\'S / SYNDICATE) + curse sound', near(firstAt(W, t0, /^title @a title \{"text":"THE BLOOD GOD'S","color":"dark_red","bold":true\}$/), 420) &&
    near(firstAt(W, t0, /^title @a subtitle \{"text":"SYNDICATE","color":"red","bold":true\}$/), 420) && near(firstAt(W, t0, /playsound minecraft:entity.elder_guardian.curse/), 420))
  check('T+25 "Honor the player" line', near(at(/Honor the player, not the statue/), 500))
  check('T+29 /fakejoin hypixel', near(firstAt(W, t0, /^fakejoin hypixel$/), 580), firstAt(W, t0, /^fakejoin hypixel$/))
  W.advance(20 * 10)
  const joinedRel = W.joinedAt - t0
  check('leader effects 2 s after the join message: thunder, column, title', near(firstAt(W, t0, /playsound minecraft:entity.lightning_bolt.thunder master/), joinedRel + 40) &&
    near(firstAt(W, t0, /particle minecraft:dust 0.8 0 0 2 /), joinedRel + 40) && near(firstAt(W, t0, /^title @a title \{"text":"Hypixel","color":"dark_red","bold":true\}$/), joinedRel + 40) &&
    near(firstAt(W, t0, /^title @a subtitle \{"text":"has joined the server","color":"gray"\}$/), joinedRel + 40) &&
    since(W, t0).some(e => e.t - t0 == joinedRel + 40 && e.c == 'title @a times 10 100 20'), joinedRel)
  const arr = boltsIn(W, W.joinedAt + 39, W.joinedAt + 52)
  check('leader arrival: 3 visual-only bolts 2 s after the join, 2-5 blocks out', arr.length == 3 && arr.every(b => b.visualOnly) && arr[0].t == W.joinedAt + 40 && arr[2].t == W.joinedAt + 50 &&
    arr.every(b => { const d = Math.hypot(b.x - exBolts[0].x, b.z - exBolts[0].z); return d >= 1.99 && d <= 5.01 }), JSON.stringify(arr.map(b => b.t - W.joinedAt)))
  check('the weather turns to rain when the leader joins', weatherCmds(W).length == 1 && weatherCmds(W)[0] == 'weather rain' && Math.abs(W.log2.find(e => /weather rain/.test(e.c)).t - W.joinedAt) <= 1, JSON.stringify(weatherCmds(W)))
  check('ops told about the speech and the delay, others not', W.log2.some(e => /^tellraw Admin .*hypixel has joined. They say 8 lines. The rest of the finale runs in 88.95 s/.test(e.c)) && !W.log2.some(e => /^tellraw Bob .*hypixel has joined/.test(e.c)),
    (W.log2.find(e => /^tellraw Admin .*hypixel has joined/.test(e.c)) || {}).c)
  W.advance(20 * 80)
  const said = (W.said || []).map(x => ({ t: x.t - W.joinedAt, name: x.name, text: x.text }))
  check('hypixel types each line: the first at 13 s, longer lines later (13, 12.15, 11.4, 13.5, 4.75, 9.75, 11.4, 5 s apart)', said.length == 8 && said.every(x => x.name == 'hypixel') &&
    said.every((x, i) => x.t == LINE_TICKS[i]) && said[0].text == 'Sorry about the portal.' && /friend of Technoblade's/.test(said[1].text) && said[7].text == 'Blood for the Blood God.', JSON.stringify(said.map(x => x.t)))
  check('the lines are not sent with /tellraw (Discord would post them as server chat)', !W.log2.some(e => /tellraw @a .*Sorry about the portal/.test(e.c)))
  const lineBolts = LINE_TICKS.slice(0, 7).map(t => boltsIn(W, W.joinedAt + t, W.joinedAt + t))
  check('a bolt of lightning 3-10 blocks out with each of the first 7 lines', lineBolts.every(l => l.length == 1 && l[0].visualOnly && (d => d >= 2.99 && d <= 10.01)(Math.hypot(l[0].x - exBolts[0].x, l[0].z - exBolts[0].z))),
    JSON.stringify(lineBolts.map(l => l.length)))
  const ringT = W.joinedAt + LINE_TICKS[7], ring = boltsIn(W, ringT, ringT + 20)
  check('the last line: a ring of 10 bolts 6 blocks out over 1 s, darkness and the curse sound nearby', ring.length == 10 && ring.every(b => b.visualOnly && Math.abs(Math.hypot(b.x - exBolts[0].x, b.z - exBolts[0].z) - 6) < 0.01) &&
    ring[0].t == ringT && ring[9].t == ringT + 20 &&
    W.log2.some(e => e.t == ringT && /effect give @a\[distance=..32\] minecraft:darkness 3 0 true/.test(e.c)) &&
    W.log2.some(e => e.t == ringT && /playsound minecraft:entity.elder_guardian.curse master @a\[distance=..32\]/.test(e.c)), ring.length)
  const hb = heartbeats(W, W.joinedAt, W.joinedAt + 1779)
  check('the ruins pulse every 2 s while hypixel speaks: heartbeat, red dust swirl, crimson spores', hb.length >= 43 && hb.length <= 45 && hb[1].t - hb[0].t == 40 &&
    W.log2.filter(e => e.t == hb[0].t && /particle minecraft:dust 0.6 0 0 2 /.test(e.c)).length == 8 && W.log2.some(e => e.t == hb[0].t && /particle minecraft:crimson_spore/.test(e.c)), hb.length)
  W.advance(20 * 10)
  check('Ministry response 8 s after the last line', near(at2(W, t0, /preceding broadcast was not authorized/), joinedRel + 1779), at2(W, t0, /preceding broadcast/) + ' vs ' + (joinedRel + 1779))
  check('the pulsing stops when the Ministry has the floor', heartbeats(W, W.joinedAt + 1782, W.tick).length == 0)
  W.advance(20 * 10)
  check('then the Nether is unlocked and announced', W.persistent.trollcraft_nether_unlocked === true && W.global.netherPortalsUnlocked === true && near(at2(W, t0, /unscheduled structural event/), joinedRel + 1879))
  check('the weather is put back (clear) when the finale ends', weatherCmds(W).join(',') == 'weather rain,weather clear' && W.weather == 'clear', JSON.stringify(weatherCmds(W)))
  check('no real lightning ever', !W.log2.some(e => /summon minecraft:lightning_bolt/.test(e.c)) && W.bolts.every(b => b.visualOnly))
  check('the event ends with the usual cleanup', S.phase == 'idle' && !W.global.trollcraftEventActive && !W.teams.pe_escorts && W.gamerules.keepInventory == 0 && Object.keys(W.forced).length == 0 && !W.persistent.pig_escort_snapshot)
  check('the land is put back (no obsidian, crying obsidian or portal blocks)', !Object.values(W.blocks).some(b => /nether_portal|obsidian/.test(b)) && builtBlocks.length == 20)
  check('hooks off after the end', W.global.pigEscort.running === false)
  check('/fakejoin was run once; hypixel stays online', W.log2.filter(e => /^fakejoin/.test(e.c)).length == 1 && !W.log2.some(e => /fakeleave/.test(e.c)))
  check('no script errors', !W.errors, W.errors)
  const n = W.log2.length
  W.advance(20 * 60)
  check('nothing runs after the end', W.log2.length == n)

  // nether commands
  let r = W.cmd('pigescort nether status', admin); check('nether status: unlocked', /Unlocked/.test(r.replies[0]))
  r = W.cmd('pigescort nether lock', admin); check('nether lock', W.persistent.trollcraft_nether_unlocked === false && W.global.netherPortalsUnlocked === false)
  r = W.cmd('pigescort nether status', admin); check('nether status: locked', /Locked/.test(r.replies[0]))
}
function at2(W, t0, re) { const x = tellsJson(W, t0).find(m => re.test(lineText(m.j))); return x ? x.t : null }

// ======================= Ending B: the pig dies, reveal continue =======================
{
  const W = world()
  const admin = addPlayer(W, 'Admin', 0.5, 65, 0.5, true)
  const bob = addPlayer(W, 'Bob', 2.5, 65, 2.5, false), cara = addPlayer(W, 'Cara', 4.5, 65, 2.5, false)
  startRun(W, admin)
  const dave = addPlayer(W, 'Dave', -30.5, 65, 10.5, false)   // joined after the start: not an escort
  admin.x = 40.5; admin.z = 5.5            // far away (about 65 blocks)
  bob.x = 0.5; bob.z = 50.5                // close to the portal already (about 10 blocks)
  cara.x = -20.5; cara.z = -100.5          // very far
  W.cmd('pigescort wave', admin)
  const mob = W.entities.find(e => e._tags.indexOf('pig_escort_raider') >= 0 && !e.removed)
  const pig = W.entities.find(e => e.type == 'minecraft:pig' && !e.removed)
  pig.pos.x = 0.5; pig.pos.y = 65; pig.pos.z = 20.5
  W.given = []
  W.fire('death', { entity: pig, source: { getActual: () => mob, getType: () => 'mob' }, cancel() {} })
  W.advance(2)
  const S = W.global.pigEscortState
  check('pig death starts Ending B', S.phase == 'finale' && S.fin.kind == 'fail' && S.fin.from.z == 20.5)
  const t0 = W.log2.find(e => /Swine has been lost/.test(e.c)).t
  const c = S.fin.frame.center
  const tps = W.log2.filter(e => /^execute in minecraft:overworld run tp \S+ \S+ \S+ \S+ facing /.test(e.c))
  check('the party is brought to the portal: far escorts only (not one already near it, not a non-escort)', tps.length == 2 &&
    tps.every(e => e.t == t0) && tps.some(e => e.c.indexOf(' tp ' + admin.uuid) > 0) && tps.some(e => e.c.indexOf(' tp ' + cara.uuid) > 0) && bob.z == 50.5 && dave.x == -30.5, JSON.stringify(tps.map(e => e.c)))
  check('... 10 blocks in front, on the side the pig died on, 2 blocks apart, on the ground, facing the portal',
    [admin, cara].every(p => Math.abs(p.z - (c.z - 10)) < 0.01 && p.y == 65 && Math.abs(p.x - c.x) <= 1.5) && Math.abs(admin.x - cara.x) == 2 &&
    tps.every(e => / facing [\d.-]+ [\d.-]+ [\d.-]+$/.test(e.c) && e.c.indexOf(' facing ' + c.x + ' ' + c.y + ' ' + c.z) > 0), JSON.stringify([admin.x, admin.y, admin.z, cara.x, cara.z, c]))
  check('... and told why', W.log2.some(e => e.t == t0 && /^tellraw Admin .*report to the portal/.test(e.c)) && W.log2.some(e => /^tellraw Cara .*report to the portal/.test(e.c)) &&
    !W.log2.some(e => /^tellraw (Bob|Dave) .*report to the portal/.test(e.c)))
  check('no old ending, no rewards (no kills)', !W.log2.some(e => /DIPLOMATIC INCIDENT|has fallen/.test(e.c)) && W.given.length == 0)
  W.advance(20 * 20)
  check('T+4 Nether access denied', near(at2(W, t0, /Nether access is denied indefinitely/), 80))
  const dust = since(W, t0).filter(e => /particle minecraft:dust 0.7 0 0 1.5/.test(e.c))
  check('T+8 blood trail: 13 bursts over 3 s, from 20 blocks out towards the death spot (40 out) to the portal, particles only', dust.length == 13 && near(dust[0].t - t0, 160) && near(dust[dust.length - 1].t - t0, 220) &&
    / 0.75 66.75 40.5 /.test(dust[0].c) && !W.log2.filter(e => e.t >= t0 + 155 && e.t <= t0 + 230).some(e => /setblock|summon|effect/.test(e.c)), dust.length + ' ' + (dust[0] && dust[0].c))
  check('T+11 "Spilled blood" with obfuscated characters', (() => { const m = tellsJson(W, t0).find(x => /Spilled blood/.test(lineText(x.j))); return m && near(m.t, 220) && m.j[1].obfuscated })())
  check('T+14 explosion, T+17 last hijack line', near(firstAt(W, t0, /particle minecraft:explosion_emitter/), 280) && near(at2(W, t0, /We spent him/), 340))
  W.advance(20 * 15)
  let r = W.cmd('pigescort status', admin); check('status shows the finale waiting on the leader', /Ending B .*waiting/.test(r.replies[0]), r.replies[0])
  const before = W.tick
  r = W.cmd('pigescort reveal continue', admin)
  check('reveal continue: the Ministry response comes straight away', r.r == 1 && at2(W, before, /preceding broadcast/) === null)
  W.advance(2)
  check('... (next tick)', at2(W, before, /preceding broadcast/) != null)
  r = W.cmd('pigescort reveal continue', admin); check('a second continue does nothing', r.r == 0)
  const saidAtContinue = (W.said || []).length
  W.advance(20 * 30)
  check('Ministry response only once (the timed one was skipped)', tellsJson(W, t0).filter(m => /preceding broadcast/.test(lineText(m.j))).length == 1)
  check('reveal continue cut the rest of the speech', saidAtContinue < 8 && (W.said || []).length == saidAtContinue, saidAtContinue + ' / ' + (W.said || []).length)
  check('... and the pulsing and line lightning', heartbeats(W, before + 2, W.tick).length == 0 && boltsIn(W, before + 2, W.tick).length == 0)
  check('weather rain during the speech, put back to clear at the end', weatherCmds(W).join(',') == 'weather rain,weather clear', JSON.stringify(weatherCmds(W)))
  check('event ended and cleaned up', S.phase == 'idle' && !Object.values(W.blocks).some(b => /nether_portal|obsidian/.test(b)))
  check('no script errors', !W.errors)
}

// ======================= Timeout = Ending B; stop and reload mid-finale =======================
{
  const W = world()
  const admin = addPlayer(W, 'Admin', 0.5, 65, 0.5, true)
  startRun(W, admin, 1)
  W.advance(20 * 62)
  const S = W.global.pigEscortState
  check('timeout plays Ending B', S.phase == 'finale' && S.fin.kind == 'fail' && W.log2.some(e => /Swine has been lost/.test(e.c)) && !W.log2.some(e => /Time has expired/.test(e.c)))
  check('timeout blood trail starts where the pig stood', S.fin.from && S.fin.from.z < 30)
  W.advance(20 * 5)
  const r = W.cmd('pigescort stop', admin)
  check('/pigescort stop mid-finale cleans up', r.r == 1 && S.phase == 'idle' && !W.global.trollcraftEventActive && !Object.values(W.blocks).some(b => /nether_portal|obsidian/.test(b)))
  const n = W.log2.length
  W.advance(20 * 120)
  check('no finale step runs after stop', W.log2.length == n, W.log2.slice(n, n + 3).map(e => e.c).join(' | '))
  check('Nether stays locked', W.persistent.trollcraft_nether_unlocked !== true)

  // reload during the finale
  startRun(W, admin, 1)
  W.advance(20 * 62)
  check('second timeout finale running', W.global.pigEscortState.phase == 'finale')
  W.advance(20 * 15)   // after the explosion
  loadScript(W, FILE, s => s.replace('const TEST_MODE = false', 'const TEST_MODE = true'))
  buildCommands(W)
  W.advance(3)
  check('/reload mid-finale: cleanup puts everything back', !W.global.trollcraftEventActive && !Object.values(W.blocks).some(b => /nether_portal|obsidian/.test(b)) && W.global.pigEscortState.phase == 'idle')
  const n2 = W.log2.length
  W.advance(20 * 60)
  check('old finale steps stopped after the reload', !W.log2.slice(n2).some(e => /tellraw @a|fakejoin|particle/.test(e.c)))
  check('no script errors', !W.errors)
}

// ======================= /pigescort finale test at the staged portal site =======================
{
  const W = world()
  const admin = addPlayer(W, 'Admin', 0.5, 65, 60.5, true)
  let r = W.cmd('pigescort finale test success', admin)
  check('test refused without a frame or a staged portal', r.r == 0 && /PORTAL_FRAME_FROM/.test(r.replies[0]))
  W.cmd('pigescort setup', admin)
  W.cmd('pigescort setportal', admin)
  const land = blocksSnapshot(W)
  W.given = []
  r = W.cmd('pigescort finale test fail', admin)
  check('test at the staged site: portal built, finale running', r.r == 1 && Object.values(W.blocks).filter(b => /nether_portal\[/.test(b)).length == 6 && W.global.pigEscortState.fin.test)
  r = W.cmd('pigescort start', admin); check('cannot start a real event during a test', r.r == 0)
  W.advance(20 * 60)
  W.advance(20 * 70)
  const S = W.global.pigEscortState
  check('test ran to the end: explosion, reveal, fakejoin, unlock message', W.log2.some(e => /explosion_emitter/.test(e.c)) && W.log2.some(e => /THE BLOOD GOD'S/.test(e.c)) && W.log2.some(e => /^fakejoin hypixel/.test(e.c)) && W.log2.some(e => /unscheduled structural event/.test(e.c)))
  check('test: no rewards, Nether NOT unlocked, ops told', W.given.length == 0 && W.persistent.trollcraft_nether_unlocked !== true && W.log2.some(e => /^tellraw Admin .*Test run: the Nether was NOT unlocked/.test(e.c)))
  check('test: land put back exactly (stone below 65, air above)', Object.keys(W.blocks).length > 100 && Object.keys(W.blocks).every(k => W.blocks[k] == (+k.split(',')[1] <= 64 ? 'minecraft:stone' : 'minecraft:air')), land)
  check('test: the setup is kept (still staged, same portal)', S.phase == 'staged' && S.setup && S.setup.portal)
  // hypixel is still "online" from the test
  const n = W.log2.length
  r = W.cmd('pigescort finale test success', admin)
  W.advance(20 * 32)
  check('leader already fake-online: no second /fakejoin, ops warned', !W.log2.slice(n).some(e => /^fakejoin/.test(e.c)) && W.log2.slice(n).some(e => /^tellraw Admin .*already pretending to be online/.test(e.c)))
  W.advance(20 * 80)
  check('no script errors', !W.errors)
}

// ======================= Corner frame test + restoreframe; fakejoin missing =======================
{
  const W = world(s => s.replace('const PORTAL_FRAME_FROM = null', 'const PORTAL_FRAME_FROM = { x: 200, y: 65, z: 300 }')
    .replace('const PORTAL_FRAME_TO = null', 'const PORTAL_FRAME_TO = { x: 203, y: 69, z: 300 }'))
  W.noFakePlayers = true
  const admin = addPlayer(W, 'Admin', 201.5, 65, 303.5, true)
  let r = W.cmd('pigescort finale restoreframe', admin)
  const frameCount = () => Object.keys(W.blocks).filter(k => W.blocks[k] == 'minecraft:obsidian').length
  const portalKeys = Object.keys(W.blocks).filter(k => /nether_portal\[axis=x\]/.test(W.blocks[k]))
  check('restoreframe builds a 4x5 frame and lights it', r.r == 1 && frameCount() == 14 && portalKeys.length == 6 && portalKeys.every(k => /^20[12],6[678],300$/.test(k)), frameCount() + ' ' + portalKeys)
  r = W.cmd('pigescort finale test fail', admin)
  W.advance(20 * 16)
  check('corner test: frame -> crying obsidian, portal -> air', Object.values(W.blocks).filter(b => b == 'minecraft:crying_obsidian').length == 14 && !Object.values(W.blocks).some(b => /nether_portal/.test(b)))
  check('blood trail starts 15 blocks in front of the portal', W.log2.some(e => /particle minecraft:dust 0.7 0 0 1.5 202 66.5 315/.test(e.c)), (W.log2.find(e => /dust 0.7/.test(e.c)) || {}).c)
  W.advance(20 * 30)
  check('fakejoin missing: ops told, finale goes on', W.log2.some(e => /^tellraw Admin .*fakejoin hypixel failed/.test(e.c)))
  check('... and no lines are attempted (nobody to say them)', !(W.said || []).length && !W.log2.some(e => /lines need fake_players/.test(e.c)))
  W.advance(20 * 40)
  check('corner test ended; the frame stays crying obsidian', W.global.pigEscortState.phase == 'idle' && Object.values(W.blocks).filter(b => b == 'minecraft:crying_obsidian').length == 14)
  r = W.cmd('pigescort finale restoreframe', admin)
  check('restoreframe puts the obsidian and portal back', frameCount() == 14 && Object.values(W.blocks).filter(b => /nether_portal\[axis=x\]/.test(b)).length == 6)
  check('no script errors', !W.errors)
}
{
  const W = world(s => s.replace('const PORTAL_FRAME_FROM = null', 'const PORTAL_FRAME_FROM = { x: 200, y: 65, z: 300 }')
    .replace('const PORTAL_FRAME_TO = null', 'const PORTAL_FRAME_TO = { x: 203, y: 69, z: 301 }'))
  const admin = addPlayer(W, 'Admin', 0, 65, 0, true)
  const r = W.cmd('pigescort finale test success', admin)
  check('a frame that isn\'t flat is refused clearly', r.r == 0 && /same x or the same z/.test(r.replies[0]))
}
// z-axis frame
{
  const W = world(s => s.replace('const PORTAL_FRAME_FROM = null', 'const PORTAL_FRAME_FROM = { x: 50, y: 70, z: 10 }')
    .replace('const PORTAL_FRAME_TO = null', 'const PORTAL_FRAME_TO = { x: 50, y: 74, z: 13 }'))
  const admin = addPlayer(W, 'Admin', 0, 65, 0, true)
  W.cmd('pigescort finale restoreframe', admin)
  check('frame along z gets axis=z portal blocks', Object.keys(W.blocks).filter(k => /nether_portal\[axis=z\]/.test(W.blocks[k])).every(k => /^50,7[123],1[12]$/.test(k)) && Object.values(W.blocks).filter(b => /axis=z/.test(b)).length == 6)
}

// ======================= Speech: stop mid-speech, no lines, say() missing =======================
{
  const W = world()
  const admin = addPlayer(W, 'Admin', 0.5, 65, 60.5, true)
  W.cmd('pigescort setup', admin); W.cmd('pigescort setportal', admin)
  W.cmd('pigescort finale test success', admin)
  W.advance(20 * 30); W.advance(W.fakeJoinDelay + 20 * 27)
  check('mid-speech: two lines said', (W.said || []).length == 2, (W.said || []).length)
  const stopT = W.tick
  W.cmd('pigescort stop', admin)
  W.advance(20 * 90)
  check('/pigescort stop mid-speech: no more lines, no Ministry response', W.said.length == 2 && !W.log2.some(e => /preceding broadcast/.test(e.c)))
  check('/pigescort stop mid-speech: no more pulses or lightning, the weather is put back', heartbeats(W, stopT + 1, W.tick).length == 0 && boltsIn(W, stopT + 1, W.tick).length == 0 &&
    weatherCmds(W).join(',') == 'weather rain,weather clear' && W.weather == 'clear', JSON.stringify(weatherCmds(W)))
  check('no script errors', !W.errors)
}
{
  const W = world(s => s.replace(/const LEADER_LINES = \[[\s\S]*?\n\]\n/, 'const LEADER_LINES = []\n'))
  const admin = addPlayer(W, 'Admin', 0.5, 65, 60.5, true)
  W.cmd('pigescort setup', admin); W.cmd('pigescort setportal', admin)
  W.cmd('pigescort finale test success', admin)
  W.advance(20 * 30); W.advance(W.fakeJoinDelay)
  const join = W.joinedAt
  W.advance(20 * 25)
  const t = W.log2.find(e => /preceding broadcast/.test(e.c))
  check('LEADER_LINES = []: no lines, the Ministry responds 20 s after the join', !(W.said || []).length && t && near(t.t - join, 400) &&
    W.log2.some(e => /^tellraw Admin .*hypixel has joined. The rest of the finale runs in 20 s/.test(e.c)), t && (t.t - join))
}
{
  const W = world()
  W.noSay = true
  const admin = addPlayer(W, 'Admin', 0.5, 65, 60.5, true)
  W.cmd('pigescort setup', admin); W.cmd('pigescort setportal', admin)
  W.cmd('pigescort finale test success', admin)
  W.advance(20 * 140)
  check('fake_players.js without say(): ops told once, finale finishes', W.log2.filter(e => /^tellraw Admin .*lines need fake_players.js/.test(e.c)).length == 1 && W.log2.some(e => /preceding broadcast/.test(e.c)) && W.global.pigEscortState.phase == 'staged')
}

// ======================= Far death: the blood trail starts 20 blocks out; Ending A gathers nobody =======================
{
  const W = world()
  const admin = addPlayer(W, 'Admin', 0.5, 65, 0.5, true)
  startRun(W, admin)
  const pig = W.entities.find(e => e.type == 'minecraft:pig' && !e.removed)
  W.cmd('pigescort wave', admin)
  const mob = W.entities.find(e => e._tags.indexOf('pig_escort_raider') >= 0 && !e.removed)
  pig.pos.x = 0.5; pig.pos.y = 65; pig.pos.z = -39.5    // 100 blocks from the portal
  admin.x = 0.5; admin.z = 0.5
  W.fire('death', { entity: pig, source: { getActual: () => mob, getType: () => 'mob' }, cancel() {} })
  W.advance(20 * 12)
  const c = W.global.pigEscortState.fin.frame.center
  const dust = W.log2.filter(e => /particle minecraft:dust 0.7 0 0 1.5/.test(e.c)).map(e => e.c.split(' ').slice(10, 13).map(Number))
  check('a far death: the blood trail starts 20 blocks from the portal, towards where the pig died', dust.length == 13 && Math.abs(dust[0][0] - c.x) < 0.15 && Math.abs(dust[0][2] - (c.z - 20)) < 0.01, JSON.stringify(dust[0]) + ' ' + JSON.stringify(c))
  check('... and the admin (an escort, 60 blocks away) was brought to the portal', Math.abs(admin.z - (c.z - 10)) < 0.01, JSON.stringify([admin.x, admin.y, admin.z]) + W.log2.filter(e => /facing|Brought/.test(e.c)).map(e => e.c).join('|'))
}
{
  const W = world()
  const admin = addPlayer(W, 'Admin', 0.5, 65, 0.5, true)
  startRun(W, admin)
  const pig = W.entities.find(e => e.type == 'minecraft:pig' && !e.removed)
  const bob = addPlayer(W, 'Bob', 0.5, 65, 50.5, false)   // joined after the start: not an escort
  admin.x = 300; admin.z = 300
  walkPigIn(W)
  const c = W.global.pigEscortState.fin.frame.center
  const tp = W.log2.filter(e => / facing /.test(e.c))
  check('Ending A: a far escort is brought 10 blocks in front, on the start side, facing the portal, at T+0', tp.length == 1 && Math.abs(admin.z - (c.z - 10)) < 0.01 && Math.abs(admin.x - c.x) <= 0.5 &&
    tp[0].t == W.log2.find(e => /Swine has been delivered/.test(e.c)).t, JSON.stringify([admin.x, admin.z, c, tp.map(e => e.c)]))
  check('... told the ceremony message, not the inquiry one', W.log2.some(e => /^tellraw Admin .*commendation ceremony/.test(e.c)) && !W.log2.some(e => /^tellraw Admin .*for the inquiry/.test(e.c)))
}
{
  // the route's start on the other side of the portal: escorts land on that side
  const W = world()
  const admin = addPlayer(W, 'Admin', 0.5, 65, 120.5, true)
  W.cmd('pigescort setup', admin)
  W.cmd('pigescort setstart', admin)
  admin.x = 0.5; admin.y = 65; admin.z = 60.5
  W.cmd('pigescort setportal', admin)
  W.cmd('pigescort start', admin)
  W.advance(10 * 20 + 2)
  admin.x = -300; admin.z = 400
  walkPigIn(W)
  const c = W.global.pigEscortState.fin.frame.center
  check('Ending A from the other side: brought to the start side (z = portal + 10)', Math.abs(admin.z - (c.z + 10)) < 0.01, JSON.stringify([admin.z, c.z]))
}
{
  const W = world()
  const admin = addPlayer(W, 'Admin', 0.5, 65, 60.5, true)
  W.cmd('pigescort setup', admin); W.cmd('pigescort setportal', admin)
  admin.x = 100.5; admin.z = 100.5
  W.cmd('pigescort finale test success', admin)
  W.advance(2)
  const c = W.global.pigEscortState.fin.frame.center
  check('a test of Ending A brings the op who ran it', Math.abs(admin.z - (c.z + 10)) < 0.01 && W.log2.some(e => /^tellraw Admin .*commendation ceremony/.test(e.c)))
}
{
  const W = world()
  const admin = addPlayer(W, 'Admin', 0.5, 65, 60.5, true), bob = addPlayer(W, 'Bob', 200.5, 65, 200.5, false)
  W.cmd('pigescort setup', admin); W.cmd('pigescort setportal', admin)
  admin.x = 100.5; admin.z = 100.5
  W.cmd('pigescort finale test fail', admin)
  W.advance(2)
  const c = W.global.pigEscortState.fin.frame.center
  check('a test of Ending B brings only the op who ran it (to the side the test trail comes from)', Math.abs(admin.z - (c.z + 10)) < 0.01 && bob.x == 200.5, JSON.stringify([admin.x, admin.z, c]))
  W.advance(20 * 150)
  check('no script errors', !W.errors)
}

// ======================= The finale track =======================
{
  // not set up (seconds: 0): no track, ops reminded, timing as before (checked in Ending A above)
  const W = speechRun()
  check('track not set up: not played, ops reminded once', !W.log2.some(e => /playsound trollcraft:finale_track/.test(e.c)) &&
    W.log2.filter(e => /^tellraw Admin .*FINALE_TRACK.seconds .*isn't set/.test(e.c)).length == 1)
}
const withTrack = s => s.replace("  seconds: 0, ", "  seconds: 30, ").replace("  jockie: true,", "  jockie: false,").replace("  sound: '',", "  sound: 'trollcraft:finale_track',")
{
  const W = speechRun(withTrack)
  const j = W.joinedAt, play = W.log2.filter(e => /playsound trollcraft:finale_track/.test(e.c))
  check('track: played once for everyone, where they stand, 4 s after the last line', play.length == 1 && play[0].c == 'execute as @a at @s run playsound trollcraft:finale_track master @s ~ ~ ~ 1 1 1' && play[0].t == j + 1619 + 80,
    play.map(e => (e.t - j) + ' ' + e.c).join(' | '))
  const m = W.log2.find(e => /preceding broadcast/.test(e.c))
  check('... the Ministry responds when it ends + 2 s (30 s track)', m && m.t == j + 1619 + 80 + 600 + 40 + 1, m && (m.t - j))
  check('... the ops notice counts it', W.log2.some(e => /^tellraw Admin .*The rest of the finale runs in 116.95 s/.test(e.c)) && !W.log2.some(e => /isn't set/.test(e.c)))
  check('... the heartbeat is silent while it plays, the dust still swirls', heartbeats(W, j + 1699, j + 2339).length == 0 && heartbeats(W, j + 1562, j + 1698).length >= 3 &&
    W.log2.some(e => e.t > j + 1762 && e.t < j + 2262 && /particle minecraft:dust 0.6 0 0/.test(e.c)))
  check('... no stopsound when it has ended by itself', !W.log2.some(e => /stopsound/.test(e.c)))
  check('no script errors', !W.errors)
}
{
  const W = world(withTrack)
  const admin = addPlayer(W, 'Admin', 0.5, 65, 60.5, true)
  W.cmd('pigescort setup', admin); W.cmd('pigescort setportal', admin)
  W.cmd('pigescort finale test success', admin)
  W.advance(20 * 30); W.advance(W.fakeJoinDelay + 1619 + 80 + 200)   // 10 s into the track
  check('reveal continue during the track: the track is cut, the Ministry responds', W.cmd('pigescort reveal continue', admin).r == 1 &&
    W.log2.some(e => e.c == 'stopsound @a master trollcraft:finale_track'))
  W.advance(20 * 60)
  check('... Ministry once, no second stopsound', W.log2.filter(e => /preceding broadcast/.test(e.c)).length == 1 && W.log2.filter(e => /stopsound/.test(e.c)).length == 1)
}
{
  const W = world(withTrack)
  const admin = addPlayer(W, 'Admin', 0.5, 65, 60.5, true)
  W.cmd('pigescort setup', admin); W.cmd('pigescort setportal', admin)
  W.cmd('pigescort finale test success', admin)
  W.advance(20 * 30); W.advance(W.fakeJoinDelay + 1619 + 80 + 200)
  W.cmd('pigescort stop', admin)
  check('/pigescort stop during the track: the track is cut', W.log2.some(e => e.c == 'stopsound @a master trollcraft:finale_track'))
  W.cmd('pigescort setup', admin); W.cmd('pigescort setportal', admin)
  const n = W.log2.length
  W.cmd('pigescort finale test success', admin)
  W.advance(20 * 30); W.advance(W.fakeJoinDelay + 20 * 20)
  W.cmd('pigescort stop', admin)
  check('/pigescort stop before the track: no stopsound needed, and it never plays', !W.log2.slice(n).some(e => /stopsound|playsound trollcraft/.test(e.c)) && (W.advance(20 * 120), !W.log2.slice(n).some(e => /playsound trollcraft/.test(e.c))))
}
{
  const W = world(s => withTrack(s).replace(/const LEADER_LINES = \[[\s\S]*?\n\]\n/, 'const LEADER_LINES = []\n'))
  const admin = addPlayer(W, 'Admin', 0.5, 65, 60.5, true)
  W.cmd('pigescort setup', admin); W.cmd('pigescort setportal', admin)
  W.cmd('pigescort finale test success', admin)
  W.advance(20 * 30); W.advance(W.fakeJoinDelay + 20 * 60)
  const play = W.log2.find(e => /playsound trollcraft:finale_track/.test(e.c)), m = W.log2.find(e => /preceding broadcast/.test(e.c))
  check('no lines: the track plays 20 s after the join, the Ministry after it', play && play.t - W.joinedAt == 400 && m && m.t - W.joinedAt == 400 + 640 + 1, play && (play.t - W.joinedAt) + ' ' + (m && m.t - W.joinedAt))
}

// ======================= The track through Jockie (the default) =======================
const withJockie = s => s.replace("  seconds: 0, ", "  seconds: 21, ")
{
  const W = world(withJockie)
  const admin = addPlayer(W, 'Admin', 0.5, 65, 60.5, true), bob = addPlayer(W, 'Bob', 3.5, 65, 55.5, false)
  W.cmd('pigescort setup', admin); W.cmd('pigescort setportal', admin)
  W.cmd('pigescort finale test success', admin)
  W.advance(20 * 150)
  const j = W.joinedAt, start = j + 1619 + 80
  const bars = W.log2.filter(e => /^title \S+ actionbar .*Finale track \(Jockie\) in/.test(e.c))
  check('jockie: a 5..1 countdown for ops only, one a second before the cue', bars.length == 5 && bars.every(e => /^title Admin /.test(e.c)) &&
    bars.map(e => e.t - start).join(',') == '-100,-80,-60,-40,-20' && /in 5\.\.\./.test(bars[0].c) && /in 1\.\.\./.test(bars[4].c), bars.map(e => (e.t - start) + ' ' + e.c).join(' | '))
  check('... the cue: title, pling and a click-to-copy m!resume for ops only, 4 s after the last line', W.log2.some(e => e.t == start && /^title Admin title .*START THE TRACK/.test(e.c)) &&
    W.log2.some(e => e.t == start && /^title Admin subtitle .*Jockie: m!resume/.test(e.c)) && W.log2.some(e => e.t == start && /note_block.pling/.test(e.c) && / Admin /.test(e.c)) &&
    W.log2.some(e => e.t == start && /^tellraw Admin .*"clickEvent":\{"action":"copy_to_clipboard","value":"m!resume"\}/.test(e.c)) &&
    !W.log2.some(e => /^(title|tellraw) Bob .*(START THE TRACK|Jockie|m!resume)/.test(e.c)))
  check('... no in-game sound (sound: \'\')', !W.log2.some(e => /playsound trollcraft|stopsound/.test(e.c)))
  const m = W.log2.find(e => /preceding broadcast/.test(e.c))
  check('... the Ministry responds 21 + 2 s after the cue; nothing about stopping Jockie', m && m.t == start + 420 + 40 + 1 && !W.log2.some(e => /m!stop/.test(e.c)), m && (m.t - start))
  check('... the ops notice counts it', W.log2.some(e => /^tellraw Admin .*The rest of the finale runs in 107.95 s/.test(e.c)))
  check('no script errors', !W.errors)
}
{
  const W = world(withJockie)
  const admin = addPlayer(W, 'Admin', 0.5, 65, 60.5, true)
  W.cmd('pigescort setup', admin); W.cmd('pigescort setportal', admin)
  W.cmd('pigescort finale test success', admin)
  W.advance(20 * 30); W.advance(W.fakeJoinDelay + 1619 + 80 + 100)   // 5 s into the track
  W.cmd('pigescort reveal continue', admin)
  check('jockie: reveal continue mid-track tells ops to stop it (click to copy m!stop)', W.log2.some(e => /^tellraw Admin .*cut short.*"value":"m!stop"/.test(e.c)))
  const n = W.log2.length
  W.cmd('pigescort setup', admin)
  W.advance(20 * 30)
  W.cmd('pigescort stop', admin)
  check('... once only', W.log2.filter(e => /m!stop/.test(e.c)).length == 1)
}
{
  const W = world(withJockie)
  const admin = addPlayer(W, 'Admin', 0.5, 65, 60.5, true)
  W.cmd('pigescort setup', admin); W.cmd('pigescort setportal', admin)
  W.cmd('pigescort finale test success', admin)
  W.advance(20 * 30); W.advance(W.fakeJoinDelay + 1619 + 80 - 60)   // during the countdown
  W.cmd('pigescort stop', admin)
  W.advance(20 * 60)
  const dbg = W.log2.filter(e => /Jockie|m!/.test(e.c)).map(e => e.c.slice(0, 60)); check('jockie: stop during the countdown: no cue, no m!stop', !W.log2.some(e => /START THE TRACK|m!stop|m!resume/.test(e.c)) && W.log2.filter(e => /Finale track \(Jockie\) in/.test(e.c)).length == 3, JSON.stringify(dbg))
}
{
  const W = world(withJockie)
  const admin = addPlayer(W, 'Admin', 0.5, 65, 60.5, true), bob = addPlayer(W, 'Bob', 3.5, 65, 55.5, false)
  const r = W.cmd('pigescort track test', admin)
  W.advance(20 * 6)
  check('/pigescort track test: countdown and cue for ops, nothing else', r.r == 1 && /cue comes in 5 s/.test(r.replies[0]) && /21 s long/.test(r.replies[0]) &&
    W.log2.filter(e => /^title Admin actionbar .*Jockie/.test(e.c)).length == 5 && W.log2.some(e => /^tellraw Admin .*m!resume/.test(e.c)) &&
    !W.log2.some(e => /Bob/.test(e.c)) && W.global.pigEscortState.phase == 'idle' && !W.errors)
}

// ======================= Lightning fallback, `after`, the weather options =======================
function speechRun(patch, before) {
  const W = world(patch)
  if (before) before(W)
  const admin = addPlayer(W, 'Admin', 0.5, 65, 60.5, true)
  W.cmd('pigescort setup', admin); W.cmd('pigescort setportal', admin)
  W.cmd('pigescort finale test success', admin)
  W.advance(20 * 150)
  return W
}
{
  const W = speechRun(null, W => { W.noVisualOnly = true })
  const sparks = W.log2.filter(e => /particle minecraft:electric_spark/.test(e.c)), thunder = W.log2.filter(e => /playsound minecraft:entity.lightning_bolt.thunder weather @a ~ ~ ~ 4 1/.test(e.c))
  check('no visual-only bolts possible: sparks + thunder instead (7 + 3 + 7 + 10 = 27), never a real bolt', W.bolts.length == 0 && sparks.length == 27 && thunder.length == 27 &&
    !W.log2.some(e => /summon minecraft:lightning_bolt/.test(e.c)), sparks.length + ' ' + thunder.length)
  check('... warned once in the log, finale still finishes', (W.warns || []).filter(w => /Visual-only lightning failed/.test(w)).length == 1 && W.global.pigEscortState.phase == 'staged' && !W.errors, (W.warns || []).length)
}
{
  const W = speechRun(s => s.replace('{ text: "Sorry about the portal." }', '{ after: 3, text: "Sorry about the portal." }'))
  const said = W.said.map(x => x.t - W.joinedAt)
  check('a first line with `after: 3` still waits the 13 s minimum; the next keeps its typing time', said[0] == 260 && said[1] == 260 + 243, JSON.stringify(said.slice(0, 2)))
}
{
  const W = speechRun(null, W => { W.weather = 'rain' })
  check('already raining: the weather is left alone', weatherCmds(W).length == 0 && W.weather == 'rain')
  const W2 = speechRun(null, W => { W.weather = 'thunder' })
  check('a thunderstorm is not calmed to rain, and left alone', weatherCmds(W2).length == 0 && W2.weather == 'thunder')
  const W3 = speechRun(s => s.replace("weather: 'rain',", "weather: 'none',"))
  check("weather 'none': no weather commands", weatherCmds(W3).length == 0)
  const W4 = speechRun(s => s.replace("weather: 'rain',", "weather: 'thunder',"))
  check("weather 'thunder': thunder, then back to clear", weatherCmds(W4).join(',') == 'weather thunder,weather clear')
  const W5 = speechRun(null, W => { W.noWeatherRead = true })
  check('weather unreadable: left alone with a warning, finale finishes', weatherCmds(W5).length == 0 && (W5.warns || []).some(w => /Could not read the weather/.test(w)) && W5.global.pigEscortState.phase == 'staged' && !W5.errors)
}
{
  const W = speechRun(s => s.replace("{ text: \"Sorry about the portal.\" }", "{ text: \"Sorry about the portal.\", effect: 'none' }").replace("effect: 'ring' }", "effect: 'bogus' }"))
  const t1 = W.joinedAt + 260, t8 = W.joinedAt + 1619
  check("effect 'none': no bolt; an unknown effect: warned, one strike", boltsIn(W, t1, t1).length == 0 && boltsIn(W, t8, t8 + 20).length == 1 && (W.warns || []).some(w => /Unknown leader line effect "bogus"/.test(w)),
    boltsIn(W, t1, t1).length + ' ' + boltsIn(W, t8, t8 + 20).length)
}

// ======================= The defaults: no leader, no track =======================
{
  const W = world(s => s.replace('  seconds: 0, ', '  seconds: 21, '), true)   // the real defaults (the track length as shipped)
  const admin = addPlayer(W, 'Admin', 0.5, 65, 0.5, true), bob = addPlayer(W, 'Bob', 3.5, 65, 3.5, false)
  startRun(W, admin)
  walkPigIn(W)
  const S = W.global.pigEscortState
  const t0 = W.log2.find(e => /Swine has been delivered/.test(e.c)).t
  W.advance(20 * 60)
  const at = re => { const e = W.log2.find(x => x.t >= t0 && re.test(x.c)); return e ? e.t - t0 : null }
  check('defaults, Ending A: reveal at T+21, the Ministry denial at T+29, the unlock at T+34, the end at T+37',
    near(at(/THE BLOOD GOD'S/), 420) && near(at(/Honor the player/), 500) && near(at(/preceding broadcast was not authorized/), 580) &&
    near(at(/unscheduled structural event/), 680) && S.phase == 'idle', [at(/THE BLOOD GOD'S/), at(/preceding broadcast/), at(/unscheduled structural event/), S.phase].join(' '))
  check('... no hypixel: no /fakejoin, no join title, no lines, no op notice',
    !W.log2.some(e => /fakejoin|fakesay|"text":"Hypixel"|has joined the server|has joined\. They say/.test(e.c)) && !(W.said || []).length)
  check('... no speech effects: no weather, no heartbeat, no Jockie cue or reminder',
    !W.log2.some(e => /weather |warden.heartbeat|Jockie|m!resume|FINALE_TRACK/.test(e.c)))
  check('... the Nether is unlocked and the land put back', W.persistent.trollcraft_nether_unlocked === true && !Object.values(W.blocks).some(b => /nether_portal|obsidian/.test(b)))
  check('no script errors', !W.errors)
}
{
  const W = world(null, true)
  const admin = addPlayer(W, 'Admin', 0.5, 65, 60.5, true)
  W.cmd('pigescort setup', admin); W.cmd('pigescort setportal', admin)
  W.cmd('pigescort finale test fail', admin)
  W.advance(20 * 10)
  let r = W.cmd('pigescort reveal continue', admin)
  check('defaults: reveal continue before the reveal says it hasn\'t got there yet', r.r == 0 && /hasn't reached that part yet/.test(r.replies[0]), r.replies[0])
  r = W.cmd('pigescort status', admin)
  check('... status doesn\'t mention a leader', !/leader/.test(r.replies[0]), r.replies[0])
  W.advance(20 * 30)
  check('defaults, Ending B test: the Ministry denial 8 s after the reveal, finale over by about T+37', W.log2.some(e => /preceding broadcast/.test(e.c)) && W.global.pigEscortState.phase == 'staged' && !W.log2.some(e => /fakejoin/.test(e.c)))
  r = W.cmd('pigescort reveal continue', admin)
  check('... reveal continue afterwards: no finale running', r.r == 0)
  check('no script errors', !W.errors)
}

console.log(fails ? fails + ' FAILED' : 'ALL PASSED')
