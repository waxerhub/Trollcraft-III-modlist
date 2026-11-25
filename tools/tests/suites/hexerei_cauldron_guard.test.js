// startup_scripts/hexerei_cauldron_guard.js: a click on an empty Mixing Cauldron's tank is cancelled (it crashed the
// client: Hexerei hands JEI an empty fluid); everything else goes through; nothing is registered on a server.
// Run with: node tools/tests/run_all.js hexerei   (or node tools/tests/suites/hexerei_cauldron_guard.test.js)
const fs = require('fs')
const paths = require('../lib/paths')
const src = fs.readFileSync(paths.kubejs('startup_scripts/hexerei_cauldron_guard.js'), 'utf8')
let fails = 0
const ok = (l, c, e) => { console.log((c ? 'ok   ' : 'FAIL ') + l + (!c && e !== undefined ? '  ' + e : '')); if (!c) fails++ }

// Loads the script as KubeJS would, on the client or a server; returns the handlers it registered.
function load(opts) {
  const handlers = {}, logs = []
  const Platform = { isClientEnvironment: () => opts.client, isLoaded: id => (id == 'hexerei' ? opts.hexerei !== false : true) }
  new Function('ForgeEvents', 'Platform', 'console', src)(
    { onEvent: (name, h) => { if (opts.noEvent) throw new Error('ClassNotFoundException: ' + name); handlers[name] = h } },
    Platform, { info: m => logs.push(m), warn: m => logs.push('WARN ' + m), error: m => logs.push('ERR ' + m) })
  return { handlers, logs }
}
const EVENT = 'net.minecraftforge.client.event.ScreenEvent$MouseButtonPressed$Pre'
// A window of the given class, at (left, top), over a cauldron holding `mb` millibuckets.
function screen(cls, mb, left, top) {
  return { getClass: () => ({ getName: () => cls }), getGuiLeft: () => left, getGuiTop: () => top,
    mixingCauldron: { getFluidStack: () => ({ isEmpty: () => mb <= 0 }) } }
}
const CAULDRON = 'net.joefoxe.hexerei.screen.MixingCauldronScreen'
function click(h, scr, x, y, button) {
  const ev = { cancelled: false, getScreen: () => scr, getMouseX: () => x, getMouseY: () => y, getButton: () => button || 0, setCanceled(v) { this.cancelled = v } }
  h(ev)
  return ev.cancelled
}

const client = load({ client: true })
const h = client.handlers[EVENT]
ok('on the client: it listens for screen clicks (ScreenEvent.MouseButtonPressed.Pre)', typeof h == 'function')
const empty = screen(CAULDRON, 0, 100, 50)              // the window's corner at 100, 50: the tank is 142..157 x 106..137
ok('a left-click on an empty cauldron\'s tank is cancelled (it crashed the game)', click(h, empty, 150.5, 120.2, 0))
ok('... a right-click too (it asks JEI for uses, the same crash)', click(h, empty, 142, 106, 1))
ok('... and at the tank\'s edges, with a pixel of slack', click(h, empty, 141, 105) && click(h, empty, 158.9, 138.9))
ok('a click just past the slack, on the rest of the window, goes through', !click(h, empty, 160, 120) && !click(h, empty, 150, 140) && !click(h, empty, 120, 80))
ok('a click on the tank with liquid in it goes through (the JEI lookup works then)', !click(h, screen(CAULDRON, 1000, 100, 50), 150, 120))
ok('another window: nothing is touched', !click(h, screen('net.minecraft.client.gui.screens.inventory.InventoryScreen', 0, 100, 50), 150, 120))
const odd = { getClass: () => ({ getName: () => CAULDRON }), getGuiLeft: () => 100, getGuiTop: () => 50 }   // no cauldron field
ok('a cauldron window whose fluid can\'t be read: left alone', !click(h, odd, 150, 120))
ok('no screen at all: left alone', !click(h, null, 150, 120))

const server = load({ client: false })
ok('on a server: nothing is registered (the screen classes don\'t exist there)', Object.keys(server.handlers).length == 0)
ok('without Hexerei: nothing is registered', Object.keys(load({ client: true, hexerei: false }).handlers).length == 0)
const broken = load({ client: true, noEvent: true })
ok('if the event can\'t be listened to: a warning, no crash', broken.logs.some(l => /WARN \[HexereiGuard\] Could not listen/.test(l)))

console.log(fails ? fails + ' FAILED' : 'ALL PASSED')
