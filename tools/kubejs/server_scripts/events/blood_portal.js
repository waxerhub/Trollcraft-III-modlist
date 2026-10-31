// The Blood Portal: the way out of Part I during Protocol Clean Slate (clean_slate.js; see tools/kubejs/CLEAN_SLATE.md).
//
//  - Blood Relics: ten custom items, found in End City treasure chests while Clean Slate runs. When one player
//    carries all ten at once, everyone can run /bloodportal start.
//  - The event: everyone is pulled to the arena (and their spawn set there), blood drifts through the air, and a
//    "Blood Pool" bossbar fills as Ministry Inspectors are killed. The more it fills, the more come.
//  - Full: the Blood Portal (a bedrock basin) fills with blood and hypixel calls everyone through. Stepping into it
//    saves the player's legacy for Part II and kicks them from the server.
//  - The Ministry Archives: classified books in End City chests (any time), and Draft Bill 9-D, which only the
//    first Ender Dragon drops.
//
// Needs: clean_slate.js (global.CleanSlate) and factions/portal_ambush.js (global.PortalAmbush, for the Inspectors).
// Uses: fake_players.js (hypixel), factions_core.js, economy/ (legacy data). All looked up when needed.
//
// Commands: /bloodportal start (anyone, once the Relics are gathered); /bloodportal status|setarena|buildportal|
// setportal|relic|relics|archive|archives|fill|reset (op). Copy to <server>/kubejs/server_scripts/events/ and /reload.
//
// KubeJS 6 notes: no template strings; `let` inside nested blocks. Nothing secret is broadcast; the kick message and
// hypixel's lines are public.

(function () {

// ===================== SETTINGS =====================

const END = 'minecraft:the_end'
const END_CITY_LOOT = 'minecraft:chests/end_city_treasure'
const RELIC_CHANCE = 0.6                        // per unlooted End City treasure chest
const RELICS_ONLY_DURING_CLEAN_SLATE = true     // no Relics before Protocol Clean Slate starts
const ARCHIVE_CHANCE = 0.5                      // per unlooted End City treasure chest, for an Archive book
const ARCHIVES_FROM_ACT = ''                    // '' = any time; 'act4' = only from Act IV (story.js)
const DRAGON_DROPS_BILL = true                  // the first Ender Dragon drops Draft Bill 9-D
const BILL_DELAY_SECONDS = 10                   // after the kill (the dragon's death takes about 10 s)
const BILL_LINE_DELAY_SECONDS = 30              // the hijacked line about it, after the Ministry's Clean Slate announcement

const ARENA_RADIUS = 32                         // /bloodportal setarena without a radius
const FRAME_BLOCK = 'minecraft:bedrock'
const BLOOD_BLOCK = 'evilcraft:blood'           // EvilCraft's blood; if it can't be placed, BLOOD_FALLBACK is used
const BLOOD_FALLBACK = 'minecraft:red_stained_glass'
const BOSSBAR = 'trollcraft:blood_pool'
const BOSSBAR_NAME = 'Blood Pool'

// Inspectors: a new group whenever fewer than `alive` (from..to, rising with the pool) are alive; at most
// `groupSize` per group. The tier rises as the pool fills (portal_ambush.js RAID_TIERS).
const WAVES = { everySeconds: 5, alive: [3, 14], groupSize: 8, tiers: [[0, 'light'], [0.33, 'moderate'], [0.66, 'lethal']] }
const KILLS_TO_FILL = 40                        // points to fill the pool: an Inspector is 1, an evoker 3, a vex 0
const POINTS = { 'minecraft:evoker': 3, 'minecraft:vex': 0 }
const EVENT_TAG = 'blood_portal'
const INSPECTORS = {
  name: 'Ministry Inspector',
  nameColor: 'gold',
  chestplateColor: 0xD4AF37,
  mix: [['vindicator', 0.5], ['pillager', 0.5]],
  reward: { item: 'minecraft:emerald', min: 0, max: 1 },
}

const HYPIXEL = 'hypixel'
const UNLOCK_LINES = [
  'All ten Relics are in one pair of hands.',
  'The Blood Portal can be opened. Anyone: /bloodportal start',
]
const FULL_LINES = [
  'The time has come to escape, players!',
  'COME TO THE NEW WORLD!',
  'Step into the blood. Technoblade never dies.',
]
const KICK_MESSAGE = ['The blood takes you.', '', 'Technoblade never dies.', 'Neither will you.', '', 'See you in the new world.']
const REJOIN = 'kick'                           // escaped players who log back in: 'kick' them again, or 'allow'
const REJOIN_MESSAGE = 'You have already passed through the Blood Portal.'
const EXODUS_DIR = 'kubejs/exodus/'             // one JSON file per escaped player, for Part II

const VOICE_MINISTRY = { tag: '[MINISTRY]', tagColor: 'gold', textColor: 'yellow' }
const VOICE_HIJACK = { tag: '[SIGNAL HIJACKED]', tagColor: 'dark_red', textColor: 'red' }

// The ten Blood Relics. item: the base item (nothing that can be eaten or placed).
const RELIC_NOTE = 'A Blood Relic. Do not craft, brew or trade with it.'
const RELICS = [
  { id: 'blade_shard', name: 'Shard of the Blade', item: 'minecraft:echo_shard', lore: 'A splinter of the sword that never lost.' },
  { id: 'crown_jewel', name: 'Jewel of the Crown', item: 'minecraft:heart_of_the_sea', lore: 'Prised out before the Crown was melted into lapel pins.' },
  { id: 'carl_horseshoe', name: 'Carl\'s Horseshoe', item: 'minecraft:iron_horse_armor', lore: 'Carl remembers.' },
  { id: 'last_potato', name: 'The Last Potato of the Potato War', item: 'minecraft:clay_ball', lore: 'Hard as a stone. It refused to be requisitioned.' },
  { id: 'oinkington_letter', name: 'Oinkington\'s Final Letter', item: 'minecraft:paper', lore: 'Unopened. Addressed to "whoever comes after".' },
  { id: 'swine_tusk', name: 'Tusk of the First Swine', item: 'minecraft:goat_horn', lore: 'It still sounds, if you are brave enough.' },
  { id: 'blood_god_tear', name: 'Tear of the Blood God', item: 'minecraft:ghast_tear', lore: 'Warm. It should not be warm.' },
  { id: 'unredacted_act', name: 'The Unredacted Swine Act', item: 'minecraft:paper', lore: 'Every black bar scraped away.' },
  { id: 'anarchist_banner', name: 'Scrap of the Anarchist\'s Banner', item: 'minecraft:piglin_banner_pattern', lore: 'No kings. No ministries.' },
  { id: 'undying_ember', name: 'The Undying Ember', item: 'minecraft:magma_cream', lore: 'It has been burning since before the Ministry.' },
]

// The Ministry Archives. Titles stay within 32 characters (a written book's limit); pages within about 250.
const ARCHIVE_AUTHOR = 'The Ministry of Trolling (CLASSIFIED)'
const ARCHIVES = [
  { id: 'swine_act', title: 'The Sanctity of Swine Act', pages: [
    'THE SANCTITY OF SWINE ACT\n(full text, CLASSIFIED)\n\nAn Act to protect the legacy of Technoblade from the people who loved him.',
    'Clause 1. Only the Ministry may say the name "Technoblade". Citizens may call him "the Ministry\'s Late Friend".\n\nClause 2. All pigs must bow to Ministry officials. Pigs that do not bow will be audited.',
    'Clause 3. The Swine Dignity Fee. Every pig\'s dignity is issued by the Ministry, upon payment, and may be revoked.\n\nClause 4. Grief not licensed by the Ministry is a pork-related offence.',
    'Clause 5. "Technoblade never dies" is hereby a false statement. He has died, and the Ministry has his estate.\n\nClause 6. This Act does not exist. Clause 6 is not to be read aloud.',
  ] },
  { id: 'oinkington_memo', title: 'Memo: Re: Oinkington', pages: [
    'MEMORANDUM\nTo: Escort Planning\nFrom: The Minister\nRe: Ambassador Oinkington\n\nThe Escort must fail.',
    'Make it look like the piglins. Make it look like the Syndicate. Make it look like anyone but us.\n\nThe Ambassador must not reach the portal. He knows what we did with the Blade.',
    'Afterwards, issue a statement of deep sorrow and open the Nether "as was always the plan".\n\nSigned, countersigned and countersigned again, in triplicate.\n\nPS: send the scout home asleep. Nobody listens to a sleeping scout.',
  ] },
  { id: 'legacy_minutes', title: 'Legacy Committee Minutes', pages: [
    'MINUTES OF THE COMMITTEE FOR LEGACY MANAGEMENT\n\nPresent: 4 members.\nItem 1: the phrase "Technoblade never dies".',
    'The Chair noted the phrase is "inspirational", and therefore dangerous.\n\nMotion: rebrand it as "Technoblade is fondly remembered, within regulations."',
    'Vote: 3 in favour, 0 against.\nOne member objected, and has been reassigned to the Floor Safety Initiative.\n\nItem 2: what to do with his sword. Passed to Asset Disposal.',
  ] },
  { id: 'crown_receipt', title: 'Asset Disposal Receipt #7', pages: [
    'ASSET DISPOSAL RECEIPT #7\n\nItem: one (1) Crown, previously worn by Technoblade.\nCondition: legendary.\nAction taken: melted.',
    'Yield: 400 Ministry lapel pins, each stamped "I SUPPORTED THE LEGACY".\n\nPins are 30 Hush Coins each. Proceeds go to the Legacy Preservation Fund.',
    'Note from Accounts: the Legacy Preservation Fund has been spent on more lapel pins.\n\nNote from the Minister: approved. Melt something else.',
  ] },
  { id: 'potato_order', title: 'Potato Requisition Order', pages: [
    'POTATO REQUISITION ORDER\n\nThe legendary potato farm, once tended by Technoblade in the Potato War, is hereby Ministry property.',
    'Every potato is now taxed per eye.\nPotatoes with more than three eyes are considered to be watching the Ministry, and will be confiscated.',
    'Citizens found growing potatoes "in his honour" will be charged with unlicensed remembrance.\n\nBaked potatoes are exempt. They have learned their place.',
  ] },
  { id: 'carl_file', title: 'Personnel File: Carl', pages: [
    'PERSONNEL FILE\nName: Carl\nSpecies: horse\nFormer post: Technoblade\'s loyal companion\nCurrent post: Ministry parking enforcement',
    'Performance review: Carl refuses to write tickets. Carl stares at officials in a way that feels personal.\n\nCarl has been offered a pension of one (1) hay bale per year.',
    'Carl did not consent to any of this.\n\nRecommendation: keep Carl away from the Minister. Carl remembers.',
  ] },
  { id: 'trademark', title: 'Trademark Application TM-41', pages: [
    'TRADEMARK APPLICATION TM-41\n\nApplicant: the Ministry of Trolling\nMark: "Blood for the Blood God"\nClass: slogans, chants, war cries',
    'Grounds: the Ministry has decided the phrase is now ours.\n\nUnlicensed use, including shouting, whispering or thinking it loudly, will be charged as Unlicensed Trolling.',
    'Licence fee: 10 Hush Coins per use, 50 if meant sincerely.\n\nStatus: GRANTED (by the Ministry, to the Ministry).',
  ] },
  { id: 'eli_internal', title: 'ELI: Internal Version', pages: [
    'END LOCKDOWN INITIATIVE\nInternal version. Not for citizens.\n\nPublic reason: "There is nothing in the End."\nReal reason: everything is in the End.',
    'These records must never be read. Nobody can reach the End without Eyes, and we have confiscated all the Eyes.',
    'The dragon has been briefed and appointed Head of Records Security. Its salary is everything it can eat.\n\nIf the dragon falls, so do we.',
  ] },
  { id: 'merch', title: 'Merchandise Catalogue', pages: [
    'MINISTRY MERCHANDISE\nAutumn Catalogue\n\nOfficial Technoblade(TM) memorial goods. Every purchase honours his legacy (licensed).',
    '- Commemorative Pig Plush (pig not included; pig confiscated)\n- "Never Dies" mug, now reading "Fondly Remembered"\n- Replica Crown, cardboard, one size fits Ministers',
    '- Bottled Potato Water\n- Official Grief, in a box\n\nAll profits go to the Ministry Wellness Fund (the Minister\'s hot tub).',
  ] },
  { id: 'clean_slate_sop', title: 'Protocol Clean Slate SOP', pages: [
    'PROTOCOL CLEAN SLATE\nStandard Operating Procedure\n\nPurpose: if the records are ever exposed, nobody is left to read them.',
    'Step 1: Confirm the dragon has fallen and the records are exposed.\nStep 2: Activate. The world has four days.\nStep 3: Evacuate officials first. Evacuate citizens never.',
    'Step 4: Announce that it is for their protection.\n\nIn the margin, in red: Burn the Archives first.',
  ] },
]
// Draft Bill 9-D: only the first Ender Dragon drops it. %DATE% is the day it drops.
const BILL = { id: 'dwarf_bill', title: 'Draft Bill 9-D', pages: [
  'DRAFT: SECOND READING PASSED\nRoyal Assent expected within the week\n\nBILL 9-D\nTHE DWARF MANAGEMENT ACT\nTabled %DATE%\n\n(in the margin: fast-track this)',
  'Clause 1. Dwarves are to use the new reduced-height doors. Full-height doors are for full-height citizens.\n\nClause 2. Beards are taxed per inch. Braids count double.',
  'Clause 3. All dwarven mining output is reclassified as a naturally occurring resource, and so belongs to the Ministry.\n\nClause 4. Dwarves may not stand on blocks to look taller in official photographs.',
  'Clause 5. Dwarven complaints are to be filed on the bottom shelf, where they can reach.\n\nClause 6. The Ministry looks down on no one, except where measurements require it.',
  'On Goruk: keep him on as a useful mascot until the beard tax is fully implemented. Continue to call him a valued Loyalist.\n\nVote: unanimous (Goruk not informed).',
  'Under no circumstances is Goruk to read this bill before it becomes law.',
] }


// ===================== STATE =====================

const DATA_KEY = 'blood_portal'
const EXODUS_KEY = 'blood_portal_exodus'
if (!global.bloodPortalState) global.bloodPortalState = { token: 0 }
const S = global.bloodPortalState
S.token++
S.pending = {}

let Serializer = null, Heightmap = null
try { Serializer = Java.loadClass('net.minecraft.network.chat.Component$Serializer') } catch (e) { }
try { Heightmap = Java.loadClass('net.minecraft.world.level.levelgen.Heightmap$Types') } catch (e) { }

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
function playerByName(server, name) {
  const n = String(name).toLowerCase()
  return onlinePlayers(server).filter(p => nameOf(p).toLowerCase() == n)[0] || null
}
function isOp(p) { try { return p.hasPermissions(2) } catch (e) { return false } }
function inPlay(p) { try { return !p.isCreative() && !p.isSpectator() } catch (e) { return true } }
function isSpectator(p) { try { return p.isSpectator() } catch (e) { return false } }
function levelOf(e) { const l = e.level; return typeof l == 'function' ? e.level() : l }
function dimensionId(level) {
  let d = level.dimension
  if (typeof d == 'function') d = level.dimension()
  if (d != null && typeof d.location == 'function') d = d.location()
  return String(d)
}
function dimOf(e) { return dimensionId(levelOf(e)) }
function posOf(e) {
  const read = k => {
    try { return Number(e['get' + k.toUpperCase()]()) } catch (err) { }
    return Number(e[k])
  }
  return { x: read('x'), y: read('y'), z: read('z') }
}
function typeOf(e) { try { let id = e.getEncodeId(); return id == null ? '' : String(id) } catch (err) { return '' } }
function hasTag(e, tag) { try { return e.getTags().contains(tag) } catch (err) { return false } }
function num(v) { return (Math.round(v * 100) / 100).toString() }
function snbtString(s) { return "'" + String(s).replace(/\\/g, '\\\\').replace(/'/g, "\\'") + "'" }
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
function run(server, c) {
  try { return server.runCommandSilent(c) } catch (e) { console.warn('[BloodPortal] ' + c + ': ' + e); return 0 }
}
// Public: tellraw @a, so Discord sees it.
function announce(server, parts) {
  try { server.runCommandSilent('tellraw @a ' + JSON.stringify([''].concat(parts))); return } catch (e) { }
  const c = comp(parts)
  onlinePlayers(server).forEach(p => { try { p.tell(c) } catch (e) { } })
}
function tell(p, parts) { try { p.tell(comp(parts)) } catch (e) { } }
function dateText(ms) {
  const d = new Date(ms)
  const months = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December']
  return d.getUTCDate() + ' ' + months[d.getUTCMonth()] + ' ' + d.getUTCFullYear()
}
function CS() { return global.CleanSlate || null }
function cleanSlateRunning() { const c = CS(); try { return !!(c && c.active()) } catch (e) { return false } }


// ===================== SAVED DATA =====================
// server.persistentData['blood_portal'] = JSON { v, arena: { dim, x, y, z, r }, portal: { dim, x, y, z } (the 4x4
//   inside starts at x,z; y is its floor-level layer), unlocked: { by, t }, state: idle|running|full, startedAt,
//   startedBy, points, kills, participants: { uuid: name }, found: { relicId: n }, foundArchives: { id: n },
//   chestsRolled, billDropped: { t, by }, escaped: { uuid: { name, t } } }
// server.persistentData['blood_portal_exodus'] = JSON { uuid: { name, t, inventory, legacy } } (a copy of the files)

let DB = null
function db() {
  if (DB) return DB
  let raw = ''
  try { raw = String(Utils.server.persistentData.getString(DATA_KEY) || '') } catch (e) { }
  let parsed = null
  if (raw) {
    try { parsed = JSON.parse(raw) } catch (e) {
      try { Utils.server.persistentData.putString(DATA_KEY + '_unreadable_' + Date.now(), raw) } catch (e2) { }
      console.error('[BloodPortal] Saved data could not be read (' + e + '); a copy was kept and it starts fresh.')
    }
  }
  DB = parsed && parsed.v ? parsed : { v: 1 }
  if (!DB.state) DB.state = 'idle'
  ;['found', 'foundArchives', 'escaped', 'participants'].forEach(k => { if (!DB[k]) DB[k] = {} })
  if (!DB.chestsRolled) DB.chestsRolled = 0
  if (!DB.points) DB.points = 0
  if (!DB.kills) DB.kills = 0
  return DB
}
function save() {
  try { Utils.server.persistentData.putString(DATA_KEY, JSON.stringify(db())) } catch (e) { console.error('[BloodPortal] Save failed: ' + e) }
}


// ===================== ITEMS =====================

function relicDef(id) { return RELICS.filter(r => r.id == id)[0] || null }
function archiveDef(id) { return ARCHIVES.concat([BILL]).filter(a => a.id == id)[0] || null }
function relicSnbt(r) {
  return '{trollcraft:{relic:"' + r.id + '"},display:{Name:' + snbtString(JSON.stringify({ text: r.name, color: 'dark_red', italic: false })) +
    ',Lore:[' + [{ text: r.lore, color: 'gray', italic: true }, { text: RELIC_NOTE, color: 'dark_gray', italic: false }]
      .map(l => snbtString(JSON.stringify(l))).join(',') + ']},Enchantments:[{id:"minecraft:unbreaking",lvl:1s}],HideFlags:1}'
}
function archiveNumber(a) { return a.id == BILL.id ? '9-D' : String(ARCHIVES.indexOf(a) + 1) }
function bookSnbt(a, date) {
  const pages = a.pages.map(t => snbtString(JSON.stringify({ text: String(t).replace('%DATE%', date || dateText(Date.now())) })))
  const lore = a.id == BILL.id ? 'CLASSIFIED: new legislation' : 'CLASSIFIED: Archive Record #' + archiveNumber(a)
  return '{title:' + snbtString(a.title) + ',author:' + snbtString(ARCHIVE_AUTHOR) + ',generation:0,resolved:1b,pages:[' + pages.join(',') + ']' +
    ',display:{Lore:[' + snbtString(JSON.stringify({ text: lore, color: 'dark_red', italic: false })) + ']},trollcraft:{archive:"' + a.id + '"}}'
}
function relicOf(stack) {
  try {
    if (!stack || stack.isEmpty()) return ''
    let nbt = stack.nbt
    if (nbt == null || !nbt.contains('trollcraft')) return ''
    let t = nbt.getCompound('trollcraft')
    return t.contains('relic') ? String(t.getString('relic')) : ''
  } catch (e) { return '' }
}
function give(server, p, id, snbt) {
  try { p.give(Item.of(id, 1, snbt)); return } catch (e) { }
  run(server, 'give ' + nameOf(p) + ' ' + id + snbt)
}
// The least-found one (ties at random), so every Relic turns up before any repeats.
function leastFound(ids, counts) {
  let min = Infinity
  ids.forEach(id => { min = Math.min(min, counts[id] || 0) })
  const pool = ids.filter(id => (counts[id] || 0) == min)
  return pool[Math.floor(Math.random() * pool.length)]
}


// ===================== END CITY CHESTS =====================
// The loot is generated when the chest is first opened, so the chest is noted on the right-click (while it still
// has its LootTable) and topped up a couple of ticks later, once it's open.

function lootTableOf(block) {
  try {
    let nbt = block.entityData
    if (nbt != null && nbt.contains('LootTable')) return String(nbt.getString('LootTable'))
  } catch (e) { }
  return ''
}
function putInChest(server, level, dim, x, y, z, id, snbt) {
  try {
    let be = level.getBlock(x, y, z).entity
    let size = be.getContainerSize()
    for (let i = 0; i < size; i++) {
      if (be.getItem(i).isEmpty()) {
        be.setItem(i, Item.of(id, 1, snbt))
        be.setChanged()
        return true
      }
    }
    return false
  } catch (e) { }
  // Without the block entity: the first slot the saved items don't use, by command.
  let used = {}
  try {
    let items = level.getBlock(x, y, z).entityData.getList('Items', 10)
    for (let i = 0; i < items.size(); i++) used[items.getCompound(i).getByte('Slot')] = true
  } catch (e) { }
  for (let i = 0; i < 27; i++) {
    if (!used[i]) return run(server, 'execute in ' + dim + ' run item replace block ' + x + ' ' + y + ' ' + z + ' container.' + i + ' with ' + id + snbt) > 0
  }
  return false
}
function archivesAllowed() {
  if (!ARCHIVES_FROM_ACT) return true
  const St = global.Story
  try { return !!(St && St.isAtLeast(ARCHIVES_FROM_ACT)) } catch (e) { return false }
}
function rollChest(server, level, dim, x, y, z) {
  if (lootTableOf(level.getBlock(x, y, z)) == END_CITY_LOOT) return   // it didn't open (protected, cancelled)
  const D = db()
  D.chestsRolled++
  if ((cleanSlateRunning() || !RELICS_ONLY_DURING_CLEAN_SLATE) && Math.random() < RELIC_CHANCE) {
    let r = relicDef(leastFound(RELICS.map(x => x.id), D.found))
    if (putInChest(server, level, dim, x, y, z, r.item, relicSnbt(r))) {
      D.found[r.id] = (D.found[r.id] || 0) + 1
      console.info('[BloodPortal] Relic ' + r.id + ' placed in an End City chest at ' + x + ' ' + y + ' ' + z)
    }
  }
  if (archivesAllowed() && Math.random() < ARCHIVE_CHANCE) {
    let a = archiveDef(leastFound(ARCHIVES.map(x => x.id), D.foundArchives))
    if (putInChest(server, level, dim, x, y, z, 'minecraft:written_book', bookSnbt(a))) {
      D.foundArchives[a.id] = (D.foundArchives[a.id] || 0) + 1
      console.info('[BloodPortal] Archive ' + a.id + ' placed in an End City chest at ' + x + ' ' + y + ' ' + z)
    }
  }
  save()
}

BlockEvents.rightClicked(event => {
  const b = event.block
  if (String(b.id) != 'minecraft:chest') return
  let dim = ''
  try { dim = dimensionId(b.level) } catch (e) { return }
  if (dim != END || lootTableOf(b) != END_CITY_LOOT) return
  const x = Number(b.x), y = Number(b.y), z = Number(b.z), key = x + '|' + y + '|' + z, level = b.level
  if (S.pending[key]) return
  S.pending[key] = true
  event.server.scheduleInTicks(2, () => {
    delete S.pending[key]
    try { rollChest(event.server, level, dim, x, y, z) } catch (e) { console.error('[BloodPortal] Chest: ' + e) }
  })
})


// ===================== THE DRAGON'S BILL =====================

function surfaceY(level, x, z, fallback) {
  if (Heightmap) {
    try { return Number(level.getHeight(Heightmap.MOTION_BLOCKING, Math.floor(x), Math.floor(z))) } catch (e) { }
  }
  return fallback
}
function dropBill(server, at) {
  const snbt = bookSnbt(BILL, dateText(Date.now()))
  run(server, 'execute in ' + END + ' run summon minecraft:item ' + num(at.x) + ' ' + num(at.y + 0.5) + ' ' + num(at.z) +
    ' {Item:{id:"minecraft:written_book",Count:1b,tag:' + snbt + '},PickupDelay:20,Age:-32768,Invulnerable:1b,Glowing:1b}')
  run(server, 'execute in ' + END + ' run particle minecraft:dust 0.6 0 0 2 ' + num(at.x) + ' ' + num(at.y + 1) + ' ' + num(at.z) + ' 0.6 0.6 0.6 0 60 force')
  run(server, 'execute in ' + END + ' run playsound minecraft:item.book.page_turn master @a ' + num(at.x) + ' ' + num(at.y) + ' ' + num(at.z) + ' 2 0.6')
  server.scheduleInTicks(BILL_LINE_DELAY_SECONDS * 20, () => announce(server, voiceParts(VOICE_HIJACK, 'The dragon guarded the Ministry\'s records. Read them before they burn.')))
  console.info('[BloodPortal] Draft Bill 9-D dropped at ' + Math.floor(at.x) + ' ' + Math.floor(at.y) + ' ' + Math.floor(at.z))
}

EntityEvents.death(event => {
  const e = event.entity
  if (typeOf(e) != 'minecraft:ender_dragon') return
  try { if (dimOf(e) != END) return } catch (err) { return }
  const D = db()
  if (D.billDropped || !DRAGON_DROPS_BILL) return
  let killer = null
  try {
    let a = event.source.actual
    if (a == null) a = event.source.getActual()
    if (a != null && a.isPlayer()) killer = a
  } catch (err) { }
  D.billDropped = { t: Date.now(), by: killer ? nameOf(killer) : '' }
  save()
  const server = event.server, level = levelOf(e)
  server.scheduleInTicks(BILL_DELAY_SECONDS * 20, () => {
    // At the killer's feet if they're still in the End, else on top of the exit portal's pillar (never the void).
    let at = null
    try { if (killer && dimOf(killer) == END) at = posOf(killer) } catch (err) { }
    if (!at) at = { x: 0.5, y: surfaceY(level, 0, 0, 70), z: 0.5 }
    dropBill(server, at)
  })
})


// ===================== GATHERING THE RELICS =====================

function relicsHeld(p) {
  const held = {}
  let size = 41
  try { size = p.inventory.getContainerSize() } catch (e) { }
  for (let i = 0; i < size; i++) {
    let id = ''
    try { id = relicOf(p.inventory.getItem(i)) } catch (e) { }
    if (id && relicDef(id)) held[id] = true
  }
  return Object.keys(held)
}
function hypixelSay(server, lines, gapTicks) {
  const F = global.fakePlayers
  if (!F || !F.say) { lines.forEach(l => announce(server, [{ text: '<' + HYPIXEL + '> ' + l, color: 'white' }])); return }
  let first = 0
  if (/not a pretend player/.test(String(F.say(HYPIXEL, lines[0])))) {
    run(server, 'fakejoin ' + HYPIXEL)
    first = 60
  } else lines = lines.slice(1)
  lines.forEach((l, i) => server.scheduleInTicks(first + (i + (first ? 0 : 1)) * (gapTicks || 60), () => F.say(HYPIXEL, l)))
}
function checkRelics(server) {
  const D = db()
  if (D.unlocked) return
  onlinePlayers(server).forEach(p => {
    if (D.unlocked || relicsHeld(p).length < RELICS.length) return
    D.unlocked = { by: nameOf(p), t: Date.now() }
    save()
    console.info('[BloodPortal] ' + nameOf(p) + ' holds all ten Relics: /bloodportal start is open')
    hypixelSay(server, UNLOCK_LINES, 60)
    onlinePlayers(server).forEach(q => tell(q, voiceParts(VOICE_HIJACK, 'The Relics are gathered. Any of you can now run /bloodportal start.')))
  })
}


// ===================== THE EVENT =====================

function fill() { return Math.min(1, db().points / KILLS_TO_FILL) }
function participants(server) {
  const D = db()
  return onlinePlayers(server).filter(p => D.participants[uuidOf(p)] && inPlay(p))
}
function pullIn(server, p, i) {
  const A = db().arena, a = i * 2.4, name = nameOf(p)
  const x = A.x + Math.cos(a) * 3, z = A.z + Math.sin(a) * 3
  run(server, 'execute in ' + A.dim + ' run tp ' + name + ' ' + num(x) + ' ' + num(A.y) + ' ' + num(z))
  run(server, 'execute in ' + A.dim + ' run spawnpoint ' + name + ' ' + Math.floor(A.x) + ' ' + Math.floor(A.y) + ' ' + Math.floor(A.z))
  db().participants[uuidOf(p)] = name
}
function startEvent(server, by) {
  const D = db()
  D.state = 'running'
  D.startedAt = Date.now()
  D.startedBy = by
  D.points = 0
  D.kills = 0
  D.participants = {}
  onlinePlayers(server).filter(p => !isSpectator(p) && !D.escaped[uuidOf(p)]).forEach((p, i) => pullIn(server, p, i))
  save()
  run(server, 'bossbar add ' + BOSSBAR + ' ' + JSON.stringify({ text: BOSSBAR_NAME, color: 'dark_red', bold: true }))
  run(server, 'bossbar set ' + BOSSBAR + ' color red')
  run(server, 'bossbar set ' + BOSSBAR + ' style notched_10')
  run(server, 'bossbar set ' + BOSSBAR + ' max 100')
  updateBar(server)
  announce(server, voiceParts(VOICE_HIJACK, 'The Relics are offered. Fill the Blood Pool with Ministry blood.'))
  server.scheduleInTicks(60, () => announce(server, voiceParts(VOICE_MINISTRY, 'Unauthorised gathering detected. Inspectors have been dispatched. Please remain still.')))
  console.info('[BloodPortal] The event was started by ' + by)
  return { ok: true, text: 'The Blood Portal event has begun.' }
}
function updateBar(server) {
  const D = db()
  run(server, 'bossbar set ' + BOSSBAR + ' value ' + Math.round(fill() * 100))
  run(server, 'bossbar set ' + BOSSBAR + ' name ' + JSON.stringify(D.state == 'full'
    ? [{ text: BOSSBAR_NAME + ': FULL', color: 'dark_red', bold: true }, { text: ' (step into the blood)', color: 'red' }]
    : [{ text: BOSSBAR_NAME, color: 'dark_red', bold: true }, { text: ' ' + Math.floor(fill() * 100) + '%', color: 'red' }]))
  run(server, 'bossbar set ' + BOSSBAR + ' players @a')
}
function particles(server) {
  const A = db().arena
  for (let i = 0; i < 8; i++) {
    let a = Math.random() * 6.2832, d = Math.sqrt(Math.random()) * A.r
    let x = A.x + Math.cos(a) * d, z = A.z + Math.sin(a) * d, y = A.y + 0.5 + Math.random() * 3
    run(server, 'execute in ' + A.dim + ' run particle ' + (i % 3 == 0 ? 'minecraft:crimson_spore' : 'minecraft:dust 0.6 0 0 1.4') + ' ' +
      num(x) + ' ' + num(y) + ' ' + num(z) + ' 0.3 0.3 0.3 0 3 force')
  }
}
function eventMobs(server) {
  const out = []
  try {
    let all = server.entities
    for (let i = 0; i < all.size(); i++) {
      let e = all.get(i)
      if (hasTag(e, EVENT_TAG) && e.isAlive()) out.push(e)
    }
  } catch (e) { }
  return out
}
function wave(server) {
  const D = db(), pa = global.PortalAmbush
  if (!pa || !pa.startGroup) return
  const f = fill(), alive = eventMobs(server).length
  const wanted = Math.round(WAVES.alive[0] + (WAVES.alive[1] - WAVES.alive[0]) * f)
  if (alive >= wanted) return
  const A = D.arena
  const targets = participants(server).filter(p => {
    if (dimOf(p) != A.dim) return false
    let q = posOf(p), dx = q.x - A.x, dz = q.z - A.z
    return Math.sqrt(dx * dx + dz * dz) <= A.r * 2
  })
  if (!targets.length) return
  const first = targets.splice(Math.floor(Math.random() * targets.length), 1)[0]
  let tierId = 'light'
  WAVES.tiers.forEach(t => { if (f >= t[0]) tierId = t[1] })
  const tier = (pa.tiers || []).filter(t => t.id == tierId)[0] || null
  try {
    pa.startGroup({ targets: [first].concat(targets).map(uuidOf), mechanic: 'blood_portal', dim: A.dim,
      size: Math.min(WAVES.groupSize, wanted - alive), def: INSPECTORS, tier: tier, extraTag: EVENT_TAG })
  } catch (e) { console.error('[BloodPortal] Inspectors: ' + e) }
}
function fillPortal(server) {
  const P = db().portal
  const box = P.x + ' ' + P.y + ' ' + P.z + ' ' + (P.x + 3) + ' ' + P.y + ' ' + (P.z + 3)
  if (run(server, 'execute in ' + P.dim + ' run fill ' + box + ' ' + BLOOD_BLOCK) > 0) return BLOOD_BLOCK
  run(server, 'execute in ' + P.dim + ' run fill ' + box + ' ' + BLOOD_FALLBACK)
  console.warn('[BloodPortal] ' + BLOOD_BLOCK + ' could not be placed; used ' + BLOOD_FALLBACK)
  return BLOOD_FALLBACK
}
function full(server) {
  const D = db()
  D.state = 'full'
  D.filledAt = Date.now()
  save()
  eventMobs(server).forEach(m => {
    try {
      let q = posOf(m)
      run(server, 'execute in ' + dimOf(m) + ' run particle minecraft:large_smoke ' + num(q.x) + ' ' + num(q.y + 1) + ' ' + num(q.z) + ' 0.3 0.6 0.3 0.02 20 force')
      m.discard()
    } catch (e) { }
  })
  updateBar(server)
  if (D.portal) {
    fillPortal(server)
    let P = D.portal
    run(server, 'execute in ' + P.dim + ' run particle minecraft:dust 0.6 0 0 2 ' + (P.x + 2) + ' ' + (P.y + 1) + ' ' + (P.z + 2) + ' 1.5 1 1.5 0 200 force')
    run(server, 'execute in ' + P.dim + ' run playsound minecraft:entity.wither.spawn master @a ' + (P.x + 2) + ' ' + P.y + ' ' + (P.z + 2) + ' 4 0.6')
  }
  announce(server, voiceParts(VOICE_HIJACK, 'The Blood Pool is full. The Blood Portal is open.'))
  hypixelSay(server, FULL_LINES, 50)
  server.scheduleInTicks(20 * 120, () => { if (db().state == 'full') run(server, 'bossbar remove ' + BOSSBAR) })
  console.info('[BloodPortal] The Blood Pool is full; the portal is open')
}

// Inspectors killed fill the pool.
EntityEvents.death(event => {
  const e = event.entity
  if (!hasTag(e, EVENT_TAG)) return
  const D = db()
  if (D.state != 'running') return
  const t = typeOf(e)
  const pts = POINTS[t] != null ? POINTS[t] : 1
  D.kills++
  D.points += pts
  save()
  if (D.points >= KILLS_TO_FILL) full(event.server)
  else updateBar(event.server)
})


// ===================== ESCAPING =====================

function inPortal(p) {
  const P = db().portal
  if (!P || dimOf(p) != P.dim) return false
  const q = posOf(p), bx = Math.floor(q.x), bz = Math.floor(q.z)
  return bx >= P.x && bx <= P.x + 3 && bz >= P.z && bz <= P.z + 3 && q.y >= P.y - 0.5 && q.y < P.y + 1.5
}
function exodusRecord(p) {
  const u = uuidOf(p), inv = []
  let size = 41
  try { size = p.inventory.getContainerSize() } catch (e) { }
  for (let i = 0; i < size; i++) {
    try {
      let s = p.inventory.getItem(i)
      if (s && !s.isEmpty()) inv.push({ slot: i, id: String(s.id), count: Number(s.count), nbt: s.nbt != null ? String(s.nbt) : '' })
    } catch (e) { }
  }
  const legacy = {}
  try { legacy.faction = String(global.Factions.getFaction(p)) } catch (e) { }
  try { legacy.rank = String(global.Factions.getRank(p)) } catch (e) { }
  try { legacy.trolls = global.Trolls.stats(u) } catch (e) { }
  try { legacy.hushCoins = Number(global.Economy.countCoins(p)) } catch (e) { }
  return { name: nameOf(p), uuid: u, t: Date.now(), inventory: inv, legacy: legacy }
}
function saveExodus(p) {
  const rec = exodusRecord(p), file = rec.name + '_' + rec.uuid + '.json'
  try { JsonIO.write(EXODUS_DIR + file, rec) } catch (e) {
    try { JsonIO.write('kubejs/exodus_' + file, rec) } catch (e2) { console.warn('[BloodPortal] Could not write the exodus file for ' + rec.name + ': ' + e2) }
  }
  try {
    let all = {}
    let raw = String(Utils.server.persistentData.getString(EXODUS_KEY) || '')
    if (raw) all = JSON.parse(raw)
    all[rec.uuid] = rec
    Utils.server.persistentData.putString(EXODUS_KEY, JSON.stringify(all))
  } catch (e) { console.warn('[BloodPortal] Exodus copy: ' + e) }
}
function kick(server, p, lines) {
  try { p.connection.disconnect(comp([{ text: lines.join('\n'), color: 'dark_red' }])); return } catch (e) { }
  run(server, 'kick ' + nameOf(p) + ' ' + lines.filter(l => l).join(' '))
}
function escape(server, p) {
  const D = db(), u = uuidOf(p), name = nameOf(p)
  if (D.escaped[u]) return
  saveExodus(p)
  D.escaped[u] = { name: name, t: Date.now() }
  save()
  run(server, 'execute as ' + name + ' at @s run playsound minecraft:entity.elder_guardian.curse master @s ~ ~ ~ 1 0.6')
  announce(server, voiceParts(VOICE_HIJACK, name + ' has passed through the Blood Portal.'))
  console.info('[BloodPortal] ' + name + ' escaped')
  server.scheduleInTicks(5, () => kick(server, p, KICK_MESSAGE))
}


// ===================== THE LOOP =====================

function tick(server) {
  S.n = (S.n || 0) + 1
  const D = db()
  if (D.state == 'full' && D.portal) {
    onlinePlayers(server).forEach(p => { if (inPlay(p) && !D.escaped[uuidOf(p)] && inPortal(p)) escape(server, p) })
  }
  if (S.n % 2) return                                      // the rest once a second
  checkRelics(server)
  if (D.state != 'running' || !D.arena) return
  particles(server)
  if (S.n % (WAVES.everySeconds * 2) == 0) { wave(server); updateBar(server) }
}
function startLoop(server) {
  if (S.looping == S.token) return
  S.looping = S.token
  const token = S.token
  const loop = () => {
    if (token != S.token) return
    try { tick(server) } catch (e) { console.error('[BloodPortal] ' + e) }
    server.scheduleInTicks(10, loop)
  }
  server.scheduleInTicks(10, loop)
}
ServerEvents.loaded(event => startLoop(event.server))
if (Utils.server) startLoop(Utils.server)

PlayerEvents.loggedIn(event => {
  const p = event.player, server = event.server, D = db(), u = uuidOf(p)
  if (D.escaped[u]) {
    if (REJOIN == 'kick' && !isOp(p)) server.scheduleInTicks(40, () => kick(server, p, [REJOIN_MESSAGE, ''].concat(KICK_MESSAGE)))
    return
  }
  if (D.state == 'running' && D.arena && !isSpectator(p)) {
    server.scheduleInTicks(40, () => { pullIn(server, p, Object.keys(db().participants).length); save() })
  }
})


// ===================== SETUP =====================

function blockId(level, x, y, z) { try { return String(level.getBlock(x, y, z).id) } catch (e) { return '' } }
function buildPortal(server, p) {
  const q = posOf(p), dim = dimOf(p)
  const bx = Math.floor(q.x), by = Math.floor(q.y), bz = Math.floor(q.z)
  const x = bx - 1, z = bz - 1
  const box = (y1, y2, inset) => (x - 1 + inset) + ' ' + y1 + ' ' + (z - 1 + inset) + ' ' + (x + 4 - inset) + ' ' + y2 + ' ' + (z + 4 - inset)
  run(server, 'execute in ' + dim + ' run fill ' + box(by - 1, by, 0) + ' ' + FRAME_BLOCK)
  run(server, 'execute in ' + dim + ' run fill ' + box(by, by, 1) + ' minecraft:air')
  db().portal = { dim: dim, x: x, y: by, z: z }
  save()
  return { ok: true, text: 'Blood Portal built: bedrock basin, inside ' + x + ' ' + by + ' ' + z + ' to ' + (x + 3) + ' ' + by + ' ' + (z + 3) + ' (' + dim + '). It fills with blood when the Pool is full.' }
}
// A basin built by hand: the op stands in its 4x4 inside, with FRAME_BLOCK all round.
function findPortal(server, p) {
  const q = posOf(p), dim = dimOf(p), level = levelOf(p)
  const by = Math.floor(q.y), bx = Math.floor(q.x), bz = Math.floor(q.z)
  let x = bx, z = bz
  while (x > bx - 4 && blockId(level, x - 1, by, bz) != FRAME_BLOCK) x--
  while (z > bz - 4 && blockId(level, bx, by, z - 1) != FRAME_BLOCK) z--
  const okFrame = blockId(level, x - 1, by, bz) == FRAME_BLOCK && blockId(level, x + 4, by, bz) == FRAME_BLOCK &&
    blockId(level, bx, by, z - 1) == FRAME_BLOCK && blockId(level, bx, by, z + 4) == FRAME_BLOCK
  if (!okFrame) return { ok: false, text: 'Stand inside a 4x4 basin with a ' + FRAME_BLOCK + ' rim (or use /bloodportal buildportal).' }
  db().portal = { dim: dim, x: x, y: by, z: z }
  save()
  return { ok: true, text: 'Blood Portal set: inside ' + x + ' ' + by + ' ' + z + ' to ' + (x + 3) + ' ' + by + ' ' + (z + 3) + '.' }
}
function summary() {
  const D = db()
  return (D.unlocked ? 'Relics gathered by ' + D.unlocked.by : Object.keys(D.found).length + '/' + RELICS.length + ' Relics found') +
    ', event ' + D.state + (D.state == 'running' ? ' (' + Math.floor(fill() * 100) + '%)' : '') +
    ', ' + Object.keys(D.escaped).length + ' escaped' + (D.arena ? '' : ', no arena set') + (D.portal ? '' : ', no portal set')
}


// ===================== API FOR OTHER SCRIPTS =====================

global.BloodPortal = {
  hasEscaped: uuid => !!db().escaped[String(uuid).toLowerCase()],
  state: () => db().state,
  unlocked: () => !!db().unlocked,
  relicsFound: () => Object.keys(db().found).filter(id => db().found[id] > 0 && relicDef(id)).length,   // distinct Relics put in chests
  relicCount: RELICS.length,
  summary: () => summary(),
}


// ===================== COMMANDS =====================

ServerEvents.commandRegistry(event => {
  const Commands = event.commands
  const Arguments = event.arguments
  const reply = (ctx, text, bad) => {
    ctx.source.sendSystemMessage(comp([{ text: '[Blood Portal] ', color: 'dark_red' }, { text: text, color: bad ? 'red' : 'gray' }]))
    return bad ? 0 : 1
  }
  const safe = fn => ctx => {
    try { return fn(ctx) } catch (e) {
      console.error('[BloodPortal] ' + e)
      return reply(ctx, 'Error: ' + e, true)
    }
  }
  const done = (ctx, r) => reply(ctx, r.text, !r.ok)
  const StringArg = Java.loadClass('com.mojang.brigadier.arguments.StringArgumentType')
  const word = name => Commands.argument(name, StringArg.word())
  const str = (ctx, name) => String(StringArg.getString(ctx, name))
  const int = name => Commands.argument(name, Arguments.INTEGER.create(event))
  const num = (ctx, name) => Number(Arguments.INTEGER.getResult(ctx, name))
  const op = src => src.hasPermission(2)
  const me = ctx => ctx.source.getPlayer()
  const who = ctx => { const p = me(ctx); return p ? nameOf(p) : 'the console' }
  const asOpPlayer = fn => safe(ctx => {
    const p = me(ctx)
    if (!p) return reply(ctx, 'Run this as a player, standing in the right spot.', true)
    return fn(ctx, p)
  })

  const tryStart = (ctx, force) => {
    const D = db()
    if (force && !op(ctx.source)) return reply(ctx, 'Only an admin can force it.', true)
    if (D.state != 'idle') return reply(ctx, 'The Blood Portal event has already begun.', true)
    if (!D.unlocked && !force) return reply(ctx, 'One of you must carry all ' + RELICS.length + ' Blood Relics at once.', true)
    if (!cleanSlateRunning() && !force) return reply(ctx, 'The Blood Portal only answers during Protocol Clean Slate.', true)
    if (!D.arena || !D.portal) return reply(ctx, 'The Blood Portal isn\'t ready. Ask an admin (/bloodportal setarena and buildportal).', true)
    return done(ctx, startEvent(ctx.source.server, who(ctx)))
  }
  const giveRelics = (ctx, all) => {
    const p = playerByName(ctx.source.server, str(ctx, 'player'))
    if (!p) return reply(ctx, 'Nobody called ' + str(ctx, 'player') + ' is online.', true)
    const list = all ? RELICS : [relicDef(str(ctx, 'id'))]
    if (!list[0]) return reply(ctx, 'Relics: ' + RELICS.map(r => r.id).join(', ') + ', or all.', true)
    list.forEach(r => give(ctx.source.server, p, r.item, relicSnbt(r)))
    return reply(ctx, 'Gave ' + nameOf(p) + ' ' + (all ? 'all ' + RELICS.length + ' Relics' : list[0].name) + '.')
  }
  const giveArchives = (ctx, n) => {
    const p = playerByName(ctx.source.server, str(ctx, 'player'))
    if (!p) return reply(ctx, 'Nobody called ' + str(ctx, 'player') + ' is online.', true)
    const all = ARCHIVES.concat([BILL])
    const list = n == null ? all : [all[n - 1]]
    if (!list[0]) return reply(ctx, 'Archive books are 1 to ' + all.length + ' (' + all.length + ' is Draft Bill 9-D).', true)
    list.forEach(a => give(ctx.source.server, p, 'minecraft:written_book', bookSnbt(a)))
    return reply(ctx, 'Gave ' + nameOf(p) + ' ' + (n == null ? 'all ' + all.length + ' Archive books' : '"' + list[0].title + '"') + '.')
  }

  event.register(Commands.literal('bloodportal')
    .executes(safe(ctx => reply(ctx, summary() + '.')))
    .then(Commands.literal('start')
      .executes(safe(ctx => tryStart(ctx, false)))
      .then(Commands.literal('force').executes(safe(ctx => tryStart(ctx, true)))))
    .then(Commands.literal('status').requires(op).executes(safe(ctx => {
      const D = db()
      reply(ctx, summary() + '.')
      reply(ctx, 'Relics placed in chests: ' + RELICS.map(r => r.id + ' ' + (D.found[r.id] || 0)).join(', ') + ' (' + D.chestsRolled + ' chests opened).')
      if (D.arena) reply(ctx, 'Arena: ' + D.arena.dim + ' ' + Math.floor(D.arena.x) + ' ' + Math.floor(D.arena.y) + ' ' + Math.floor(D.arena.z) + ', radius ' + D.arena.r + '.')
      if (D.portal) reply(ctx, 'Portal: ' + D.portal.dim + ' ' + D.portal.x + ' ' + D.portal.y + ' ' + D.portal.z + ' (4x4).')
      if (D.state != 'idle') reply(ctx, 'Pool: ' + D.points + '/' + KILLS_TO_FILL + ' (' + D.kills + ' killed).')
      const esc = Object.keys(D.escaped).map(u => D.escaped[u].name)
      if (esc.length) reply(ctx, 'Escaped: ' + esc.join(', ') + '.')
      return 1
    })))
    .then(Commands.literal('setarena').requires(op)
      .executes(asOpPlayer((ctx, p) => {
        const q = posOf(p)
        db().arena = { dim: dimOf(p), x: q.x, y: q.y, z: q.z, r: ARENA_RADIUS }
        save()
        return reply(ctx, 'Arena set here, radius ' + ARENA_RADIUS + '.')
      }))
      .then(int('radius').executes(asOpPlayer((ctx, p) => {
        const q = posOf(p), r = Math.max(8, Math.min(128, num(ctx, 'radius')))
        db().arena = { dim: dimOf(p), x: q.x, y: q.y, z: q.z, r: r }
        save()
        return reply(ctx, 'Arena set here, radius ' + r + '.')
      }))))
    .then(Commands.literal('buildportal').requires(op).executes(asOpPlayer((ctx, p) => done(ctx, buildPortal(ctx.source.server, p)))))
    .then(Commands.literal('setportal').requires(op).executes(asOpPlayer((ctx, p) => done(ctx, findPortal(ctx.source.server, p)))))
    .then(Commands.literal('relic').requires(op).then(Commands.literal('give').then(word('player')
      .then(Commands.literal('all').executes(safe(ctx => giveRelics(ctx, true))))
      .then(word('id').executes(safe(ctx => giveRelics(ctx, false)))))))
    .then(Commands.literal('relics').requires(op).executes(safe(ctx => {
      RELICS.forEach(r => reply(ctx, r.id + ': ' + r.name + ' (' + (db().found[r.id] || 0) + ' placed)'))
      return 1
    })))
    .then(Commands.literal('archive').requires(op).then(Commands.literal('give').then(word('player')
      .then(Commands.literal('all').executes(safe(ctx => giveArchives(ctx, null))))
      .then(int('number').executes(safe(ctx => giveArchives(ctx, num(ctx, 'number'))))))))
    .then(Commands.literal('archives').requires(op).executes(safe(ctx => {
      ARCHIVES.concat([BILL]).forEach((a, i) => reply(ctx, (i + 1) + '. ' + a.title + (a.id == BILL.id
        ? ' (the dragon: ' + (db().billDropped ? 'dropped' : 'not yet') + ')' : ' (' + (db().foundArchives[a.id] || 0) + ' placed)')))
      return 1
    })))
    .then(Commands.literal('fill').requires(op).executes(safe(ctx => {
      const D = db()
      if (D.state == 'full') return reply(ctx, 'The Pool is already full.', true)
      D.points = KILLS_TO_FILL
      full(ctx.source.server)
      return reply(ctx, 'The Blood Pool is full and the portal is open.')
    })))
    .then(Commands.literal('reset').requires(op).executes(safe(ctx => {
      const D = db(), server = ctx.source.server
      D.state = 'idle'
      D.points = 0
      D.kills = 0
      D.participants = {}
      save()
      run(server, 'bossbar remove ' + BOSSBAR)
      if (D.portal) {
        let P = D.portal
        run(server, 'execute in ' + P.dim + ' run fill ' + P.x + ' ' + P.y + ' ' + P.z + ' ' + (P.x + 3) + ' ' + P.y + ' ' + (P.z + 3) + ' minecraft:air')
      }
      return reply(ctx, 'The event is reset (the portal drained). Relics, arena, portal and escapes are kept.')
    }))))
})

})()
