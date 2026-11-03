// The FTB Quests files and the tooltip client script are generated from the scripts' own lists by
// tools/ftbquests/generate_quests.js. This checks:
//   - the committed files are what the generator makes now (else: re-run it and commit the result)
//   - the quest files only use task and reward types FTB Quests 2001.4.22 has (a quest file once used "stage"
//     where FTB Quests calls it "gamestage", and every stage task and reward was silently dropped)
//   - ids are 16 hex digits (first digit 0-7) and unique, dependencies exist, every tree node has its quest
// Run with: node tools/tests/run_all.js generated   (or node tools/tests/suites/generated_files.test.js)
const fs = require('fs'), path = require('path'), os = require('os'), cp = require('child_process')
const paths = require('../lib/paths')
let fails = 0
const ok = (l, c, e) => { console.log((c ? 'ok   ' : 'FAIL ') + l + (!c && e !== undefined ? '  ' + e : '')); if (!c) fails++ }

const GEN = paths.repo('tools/ftbquests/generate_quests.js')
const QUESTS = paths.repo('tools/ftbquests/quests')
const TOOLTIPS = paths.kubejs('client_scripts/potato_tooltips.js')

// ---------- 1. the committed files are current ----------
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'tc3-quests-'))
const tmpQuests = path.join(tmp, 'quests'), tmpTips = path.join(tmp, 'potato_tooltips.js')
const run = cp.spawnSync(process.execPath, [GEN], { env: Object.assign({}, process.env, { QUEST_OUT: tmpQuests, TOOLTIP_OUT: tmpTips }), encoding: 'utf8' })
ok('the generator runs', run.status === 0, (run.stderr || '').slice(0, 800))
const listFiles = dir => {
  const out = []
  const walk = (d, rel) => { if (fs.existsSync(d)) fs.readdirSync(d, { withFileTypes: true }).forEach(e => {
    if (e.isDirectory()) walk(path.join(d, e.name), rel + e.name + '/')
    else out.push(rel + e.name)
  }) }
  walk(dir, '')
  return out.sort()
}
const norm = s => s.replace(/\r\n/g, '\n')   // a Windows checkout may have CRLF line endings
if (run.status === 0) {
  const made = listFiles(tmpQuests), committed = listFiles(QUESTS)
  ok('the same quest files as committed', made.join(',') == committed.join(','), 'generated: ' + made.join(', ') + ' / committed: ' + committed.join(', '))
  const stale = made.filter(f => !fs.existsSync(path.join(QUESTS, f)) ||
    norm(fs.readFileSync(path.join(QUESTS, f), 'utf8')) != norm(fs.readFileSync(path.join(tmpQuests, f), 'utf8')))
  ok('every committed quest file is current', stale.length == 0, stale.join(', ') + ' (run: node tools/ftbquests/generate_quests.js)')
  ok('the committed tooltip script is current', fs.existsSync(TOOLTIPS) &&
    norm(fs.readFileSync(TOOLTIPS, 'utf8')) == norm(fs.readFileSync(tmpTips, 'utf8')), 'run: node tools/ftbquests/generate_quests.js')
}

// ---------- 2. the quest files are valid for FTB Quests 2001.4.22 ----------
// FTB Library's SNBT: entries split by newlines or commas, key: value, quoted strings, L/d suffixes, true/false.
function parse(text) {
  let i = 0
  const ws = () => { while (i < text.length && ' \t\r\n,'.indexOf(text[i]) >= 0) i++ }
  const word = () => { const j = i; while (i < text.length && /[A-Za-z0-9_.+\-]/.test(text[i])) i++; return text.slice(j, i) }
  const string = () => {
    i++; let out = ''
    while (text[i] != '"') { if (text[i] == '\\') i++; out += text[i]; i++ }
    i++
    return out
  }
  const value = () => {
    ws()
    const c = text[i]
    if (c == '{') {
      i++; const d = {}
      for (;;) {
        ws()
        if (text[i] == '}') { i++; return d }
        const k = text[i] == '"' ? string() : word()
        ws()
        if (text[i] != ':') throw new Error('expected : at ' + i)
        i++
        d[k] = value()
      }
    }
    if (c == '[') {
      i++; const l = []
      for (;;) { ws(); if (text[i] == ']') { i++; return l } l.push(value()) }
    }
    if (c == '"') return string()
    const w = word()
    if (w == 'true' || w == 'false') return w == 'true'
    if (/^-?\d+L$/.test(w)) return { long: parseInt(w, 10) }
    if (/^-?\d+(\.\d+)?d$/.test(w)) return { double: parseFloat(w) }
    if (/^-?\d+$/.test(w)) return parseInt(w, 10)
    throw new Error('bad token "' + w + '" at ' + i)
  }
  const v = value(); ws()
  if (i != text.length) throw new Error('trailing data at ' + i)
  return v
}
// The type names registered in ftb-quests-forge-2001.4.22.jar (TaskTypes / RewardTypes).
const TASK_TYPES = ['advancement', 'biome', 'checkmark', 'custom', 'dimension', 'fluid', 'gamestage', 'item', 'kill', 'location', 'observation', 'stat', 'structure', 'xp']
const ids = {}, quests = {}, deps = [], errs = []
const reg = (id, what) => {
  if (!/^[0-7][0-9A-F]{15}$/.test(id)) errs.push('bad id ' + id + ' (' + what + ')')
  if (ids[id]) errs.push('duplicate id ' + id + ' (' + ids[id] + ', ' + what + ')')
  ids[id] = what
}
const rewardStages = {}
let groups = null
try { groups = parse(fs.readFileSync(path.join(QUESTS, 'chapter_groups.snbt'), 'utf8')) } catch (e) { ok('chapter_groups.snbt parses', false, e.message) }
const gids = groups ? groups.chapter_groups.map(g => g.id) : []
gids.forEach(g => reg(g, 'group'))
const chapterFiles = fs.existsSync(path.join(QUESTS, 'chapters')) ? fs.readdirSync(path.join(QUESTS, 'chapters')).filter(f => /\.snbt$/.test(f)).sort() : []
ok('seven chapter files', chapterFiles.length == 7, chapterFiles.join(', '))
chapterFiles.forEach(f => {
  let c
  try { c = parse(fs.readFileSync(path.join(QUESTS, 'chapters', f), 'utf8')) } catch (e) { errs.push(f + ' does not parse: ' + e.message); return }
  reg(c.id, f)
  if (gids.indexOf(c.group) < 0) errs.push(f + ': unknown group ' + c.group)
  if (c.filename + '.snbt' != f) errs.push(f + ': filename says ' + c.filename)
  ;(c.quests || []).forEach(q => {
    reg(q.id, q.title || q.id); quests[q.id] = q
    if (!q.x || q.x.double === undefined || !q.y || q.y.double === undefined) errs.push((q.title || q.id) + ': x/y are not doubles')
    ;(q.dependencies || []).forEach(d => deps.push([q.title || q.id, d]))
    ;(q.tasks || []).forEach(t => {
      reg(t.id, (q.title || q.id) + ' task')
      if (TASK_TYPES.indexOf(t.type) < 0) errs.push((q.title || q.id) + ': task type "' + t.type + '" is not one FTB Quests 2001.4.22 has')
      if (t.type == 'gamestage' && !t.stage) errs.push((q.title || q.id) + ': a gamestage task with no stage')
      if (t.type == 'item') {
        if (!t.item) errs.push((q.title || q.id) + ': an item task with no item')
        if (t.consume_items !== true) errs.push((q.title || q.id) + ': item task does not consume ' + t.item)
        if (t.count !== undefined && t.count.long === undefined) errs.push((q.title || q.id) + ': count is not a long')
      }
    })
    ;(q.rewards || []).forEach(r => {
      reg(r.id, (q.title || q.id) + ' reward')
      if (r.type != 'gamestage' || r.auto != 'invisible' || !r.stage) errs.push((q.title || q.id) + ': reward is not an invisible gamestage (' + r.type + ')')
      else rewardStages[r.stage] = q.id
    })
  })
})
deps.forEach(d => { if (!quests[d[1]]) errs.push(d[0] + ': depends on missing quest ' + d[1]) })
ok('quest files: valid types, ids and dependencies (' + Object.keys(ids).length + ' ids, ' + Object.keys(quests).length + ' quests)', errs.length == 0, errs.slice(0, 20).join('; '))

// ---------- 3. every tree node has its quest and stage ----------
let PT = null
try { PT = require(paths.repo('tools/ftbquests/load_scripts.js'))().PT } catch (e) { ok('the part2 scripts load', false, e.message) }
if (PT) {
  const missing = PT.nodes.filter(n => !quests[PT.questId(n.id)])
  ok('every tree node has a quest (' + PT.nodes.length + ' nodes)', missing.length == 0, missing.map(n => n.id).join(', '))
  const noStage = PT.nodes.filter(n => rewardStages[PT.stagePrefix + n.id] != PT.questId(n.id))
  ok('... whose reward is the node\'s stage (' + PT.stagePrefix + '<node>)', noStage.length == 0, noStage.map(n => n.id).join(', '))
}

try { fs.rmSync(tmp, { recursive: true, force: true }) } catch (e) {}
console.log(fails ? fails + ' FAILED' : 'ALL PASSED')
