// Run with: node tools/tests/run_all.js give_limits   (or node tools/tests/suites/give_limits.test.js)
const REPO_ROOT = require('path').resolve(__dirname, '..', '..', '..')
const fs = require('fs')
const src = fs.readFileSync(REPO_ROOT + '/tools/kubejs/server_scripts/give_limits.js', 'utf8')
let handler, filter
const tells = [], logs = []
const global = {}
const opP = { isOp: () => true, getGameProfile: () => ({ getName: () => 'Boss' }) }
const server = { runCommandSilent: c => { tells.push(c); return 1 }, players: { size: () => 1, get: () => opP } }
new Function('ServerEvents', 'console', 'global', src)(
  { command: (f, h) => { filter = f; handler = h } },
  { info: m => logs.push(m), warn: m => logs.push(m) }, global)
function give(input, opts) {
  opts = opts || {}
  const player = opts.console ? null : { getGameProfile: () => ({ getName: () => opts.name || 'Helper' }), getStringUuid: () => '1234-abcd' }
  let cancelled = false
  const ev = { server, cancel() { cancelled = true; throw { exit: 1 } }, getInput: () => input,
    getParseResults: () => ({ getContext: () => ({ getSource: () => ({ getPlayer: () => player, hasPermission: () => !!opts.op }) }) }) }
  tells.length = 0
  try { handler(ev) } catch (e) { if (!e.exit) throw e }
  return { cancelled, msg: (tells.find(t => /Requisition denied/.test(t)) || '').replace(/.*Requisition denied: /, '').replace(/".*$/, '') }
}
let fails = 0
function t(label, input, expectDenied, opts) {
  const r = give(input, opts)
  const ok = r.cancelled == expectDenied && (!expectDenied || r.msg.length > 0)   // a denial must also tell the player why
  if (!ok) fails++
  console.log((ok ? 'ok   ' : 'FAIL ') + (expectDenied ? 'deny  ' : 'allow ') + input + (r.msg ? '   -> ' + r.msg : ''))
}
console.log('filter:', filter)
t('basic', 'give Bob minecraft:oak_log 64', false)
t('no namespace', 'give Bob torch 16', false)
t('modded ok', 'give Bob create:andesite_alloy 32', false)
t('too many', 'give Bob minecraft:oak_log 65', true)
t('nbt', 'give Bob minecraft:diamond_sword{Enchantments:[{id:"sharpness",lvl:100}]} 1', true)
t('command block', 'give Bob minecraft:command_block', true)
t('creative', 'give Bob mekanism:creative_energy_cube', true)
t('spawn egg', 'give Bob minecraft:zombie_spawn_egg', true)
t('projecte (no longer listed: the mod is gone)', 'give Bob projecte:philosophers_stone', false)
t('nuke', 'give Bob thermal:nuke_tnt', true)
t('@a', 'give @a minecraft:dirt', true)
t('@e selector with space', 'give @e[type=player, limit=1] minecraft:dirt', true)
t('@p (could be self)', 'give @p[distance=..5] minecraft:bread 8', true)
t('@s (self)', 'give @s minecraft:bread', true)
t('own name', 'give Helper minecraft:bread', true)
t('own name, other case', 'give helper minecraft:bread', true)
t('own UUID', 'give 1234-ABCD minecraft:bread', true)
t('another player', 'give Bob minecraft:bread', false)
t('garbage', 'give Bob', true)
t('op unrestricted', 'give @a minecraft:command_block 64', false, { op: true })
t('console unrestricted', 'give @a minecraft:command_block 64', false, { console: true })
for (let i = 0; i < 30; i++) give('give Bob minecraft:stick 1', { name: 'Spammer' })
t('31st use in an hour', 'give Bob minecraft:stick 1', true, { name: 'Spammer' })
console.log('log sample:', logs.slice(0, 2))
console.log(fails ? fails + ' FAILED' : 'ALL PASSED')
