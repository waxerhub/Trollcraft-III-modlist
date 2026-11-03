// Run with: node tools/tests/run_all.js nether_portal_whitelist   (or node tools/tests/suites/nether_portal_whitelist.test.js)
const REPO_ROOT = require('path').resolve(__dirname, '..', '..', '..')
const fs = require('fs')
const src = fs.readFileSync(REPO_ROOT + '/tools/kubejs/startup_scripts/nether_portal_whitelist.js', 'utf8')
let handler, fails = 0
const ok = (l, c) => { console.log((c ? 'ok   ' : 'FAIL ') + l); if (!c) fails++ }
const global = {}, logs = []
const pd = {}
const server = { persistentData: { getBoolean: k => pd[k] === true } }
new Function('ForgeEvents', 'global', 'console', 'Utils', src)({ onEvent: (n, f) => { handler = f } }, global, { info: m => logs.push(m), error: m => logs.push('E ' + m) }, { server: null })
const ev = (x, srv) => ({ canceled: false, getPos: () => ({ x, y: 64, z: 200 }), getLevel: () => ({ dimension: { toString: () => 'minecraft:overworld' }, getServer: () => srv }), setCanceled(v) { this.canceled = v } })
let e = ev(5000, server); handler(e); ok('locked: a portal outside the whitelist is blocked', e.canceled)
e = ev(100, server); handler(e); ok('locked: an allowed portal lights', !e.canceled)
pd.trollcraft_nether_unlocked = true
e = ev(5000, server); handler(e); ok('saved flag unlocked: any portal lights', !e.canceled)
pd.trollcraft_nether_unlocked = false
global.netherPortalsUnlocked = true
e = ev(5000, server); handler(e); ok('global flag unlocked: any portal lights', !e.canceled)
global.netherPortalsUnlocked = false
e = ev(5000, { get persistentData() { throw new Error('boom') } }); handler(e); ok('error reading the switch: still blocked, logged once', e.canceled && logs.filter(l => /could not read the unlock switch/.test(l)).length == 1)
e = ev(5000, { get persistentData() { throw new Error('boom') } }); handler(e); ok('... not logged again', logs.filter(l => /could not read the unlock switch/.test(l)).length == 1)
console.log(fails ? fails + ' FAILED' : 'ALL PASSED')
