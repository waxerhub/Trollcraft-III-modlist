// Runs the Rhino lint, then every suite in tools/tests/suites/, each in its own node process.
//   node tools/tests/run_all.js                 everything
//   node tools/tests/run_all.js pool tree       only suites whose name contains "pool" or "tree" (the lint still runs)
//   node tools/tests/run_all.js --verbose       print every check, not just the failures
//   node tools/tests/run_all.js --no-lint       skip the lint
// Exit code 1 if the lint has errors or any suite has a FAIL line, crashes, or doesn't finish.
const fs = require('fs'), path = require('path'), cp = require('child_process')
const args = process.argv.slice(2)
const verbose = args.indexOf('--verbose') >= 0, noLint = args.indexOf('--no-lint') >= 0
const filters = args.filter(a => !/^--/.test(a))
const TIMEOUT_MS = 120000
let bad = false

if (!noLint) {
  const r = cp.spawnSync(process.execPath, [path.join(__dirname, 'lint_rhino.js')], { encoding: 'utf8' })
  const out = (r.stdout || '') + (r.stderr || '')
  const lines = out.split('\n').filter(Boolean)
  lines.filter(l => verbose || /^(ERROR|warn)/.test(l) || r.status == 2).forEach(l => console.log(l))
  console.log(lines[lines.length - 1] || 'lint: no output')
  if (r.status !== 0) bad = true
  console.log('')
}

const dir = path.join(__dirname, 'suites')
const suites = fs.readdirSync(dir).filter(f => /\.test\.js$/.test(f)).sort()
  .filter(f => !filters.length || filters.some(x => f.indexOf(x) >= 0))
if (!suites.length) { console.log('No suites match ' + filters.join(', ')); process.exit(1) }

const rows = []
suites.forEach(f => {
  const name = f.replace(/\.test\.js$/, '')
  const t0 = Date.now()
  const r = cp.spawnSync(process.execPath, [path.join(dir, f)], { encoding: 'utf8', timeout: TIMEOUT_MS, maxBuffer: 64 * 1024 * 1024 })
  const out = (r.stdout || '') + (r.stderr || '')
  const lines = out.split('\n')
  const passed = lines.filter(l => /^ok /.test(l)).length
  const failed = lines.filter(l => /^FAIL /.test(l))
  const finished = lines.some(l => /^(ALL PASSED|\d+ FAILED)$/.test(l.trim()))
  let problem = ''
  if (r.error && r.error.code == 'ETIMEDOUT') problem = 'timed out after ' + (TIMEOUT_MS / 1000) + ' s'
  else if (r.status !== 0) problem = 'crashed (exit ' + r.status + ')'
  else if (!finished) problem = 'stopped before the end'
  if (failed.length || problem) bad = true
  rows.push({ name, passed, failed: failed.length, problem, ms: Date.now() - t0 })
  if (verbose) lines.forEach(l => { if (l) console.log('  [' + name + '] ' + l) })
  else failed.forEach(l => console.log('  [' + name + '] ' + l))
  if (problem && !verbose) {
    console.log('  [' + name + '] ' + problem + ':')
    lines.filter(Boolean).slice(-15).forEach(l => console.log('  [' + name + ']   ' + l))
  }
})

const w = Math.max.apply(null, rows.map(r => r.name.length).concat([5]))
const pad = (s, n) => (s + ' '.repeat(n)).slice(0, n)
console.log('')
console.log(pad('suite', w) + '  passed  failed  time')
rows.forEach(r => console.log(pad(r.name, w) + '  ' + pad(String(r.passed), 6) + '  ' + pad(String(r.failed), 6) + '  ' +
  (r.ms / 1000).toFixed(1) + ' s' + (r.problem ? '  ' + r.problem.toUpperCase() : '')))
const total = rows.reduce((a, r) => a + r.passed, 0), totalFail = rows.reduce((a, r) => a + r.failed, 0)
console.log('')
console.log(bad ? 'FAILED: ' + totalFail + ' failing checks' + (rows.some(r => r.problem) ? ', ' + rows.filter(r => r.problem).length + ' suites did not finish' : '') +
  ' (' + total + ' passed)' : 'ALL PASSED: ' + total + ' checks in ' + rows.length + ' suites')
process.exit(bad ? 1 : 0)
