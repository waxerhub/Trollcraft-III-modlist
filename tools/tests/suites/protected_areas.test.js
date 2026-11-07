// protected_areas.js: only the allowed players (and ops) break, place or right-click in an area; allowUse areas
// (the Castellan's castle) let everyone use doors and buttons, but not buckets or fire.
// Run with: node tools/tests/run_all.js protected_areas   (or node tools/tests/suites/protected_areas.test.js)
const fs = require('fs')
const paths = require('../lib/paths')
let src = fs.readFileSync(paths.server('protected_areas.js'), 'utf8')
let fails = 0
const ok = (l, c, e) => { console.log((c ? 'ok   ' : 'FAIL ') + l + (!c && e !== undefined ? '  ' + e : '')); if (!c) fails++ }

// Turn the commented castle example into a live area with test values, as the owner would.
src = src.replace(/\/\/ \{ name: 'The Castle'[\s\S]*?allowUse: true \},/, m =>
  m.replace(/^\s*\/\/ ?/gm, '').replace("x1: 0, y1: 60, z1: 0, x2: 0, y2: 120, z2: 0", "x1: -20, y1: 60, z1: -20, x2: 20, y2: 120, z2: 20")
    .replace("'CastellanUsername'", "'Castellan'"))
ok('the castle example can be switched on by removing the //', /\{ name: 'The Castle'/.test(src) && !/\/\/ \{ name: 'The Castle'/.test(src))

const handlers = {}
const BlockEvents = { broken: h => { handlers.broken = h }, placed: h => { handlers.placed = h }, rightClicked: h => { handlers.rightClicked = h } }
const Text = { red: s => ({ text: s }) }
new Function('BlockEvents', 'Text', src)(BlockEvents, Text)

class Cancel extends Error {}
function player(name, op) {
  const p = { msgs: [], hand: '', hasPermissions: () => !!op, getGameProfile: () => ({ getName: () => name }), tell: t => p.msgs.push(t.text) }
  Object.defineProperty(p, 'mainHandItem', { get: () => ({ id: p.hand, isEmpty: () => !p.hand }) })
  return p
}
function act(kind, p, x, y, z, item) {
  let cancelled = false
  const ev = { player: p, block: { x, y, z, getDimension: () => 'minecraft:overworld' }, cancel() { cancelled = true; throw new Cancel() } }
  if (item !== undefined) ev.item = { id: item, isEmpty: () => !item }
  try { handlers[kind](ev) } catch (e) { if (!(e instanceof Cancel)) throw e }
  return cancelled
}

const cast = player('Castellan'), ana = player('Ana'), op = player('Admin', true)
ok('a visitor can\'t break a block in the castle', act('broken', ana, 0, 70, 0))
ok('... is told it\'s protected', /The Castle is protected/.test(ana.msgs[0]), ana.msgs[0])
ok('... or place one', act('placed', ana, 5, 70, 5))
ok('the Castellan can break and place there', !act('broken', cast, 0, 70, 0) && !act('placed', cast, 0, 70, 0))
ok('an op can too', !act('broken', op, 0, 70, 0))
ok('a visitor can open doors and press buttons (empty hand)', !act('rightClicked', ana, 0, 70, 0, ''))
ok('... or holding food', !act('rightClicked', ana, 0, 70, 0, 'minecraft:bread'))
ok('... but not with a lava bucket', act('rightClicked', ana, 0, 70, 0, 'minecraft:lava_bucket'))
ok('... or a water bucket', act('rightClicked', ana, 0, 70, 0, 'minecraft:water_bucket'))
ok('... or flint and steel', act('rightClicked', ana, 0, 70, 0, 'minecraft:flint_and_steel'))
ok('the held item is read from the hand when the event has none', (() => { ana.hand = 'minecraft:lava_bucket'; return act('rightClicked', ana, 0, 70, 0) })())
ana.hand = ''
ok('outside the castle: anything goes', !act('broken', ana, 50, 70, 50) && !act('rightClicked', ana, 50, 70, 50, 'minecraft:lava_bucket'))
ok('the old Power room (no allowUse) still blocks right-clicks', act('rightClicked', ana, 100, 60, 200, ''))
ok('... and its allowed player can use it', !act('rightClicked', player('YourUsername'), 100, 60, 200, ''))

console.log(fails ? fails + ' FAILED' : 'ALL PASSED')
