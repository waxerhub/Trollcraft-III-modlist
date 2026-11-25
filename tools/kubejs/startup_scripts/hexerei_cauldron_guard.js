// Hexerei cauldron guard (client side: ships in the MODPACK, in each player's kubejs/startup_scripts/).
//
// The crash: in Hexerei 0.4.2.3's Mixing Cauldron window, clicking the fluid tank asks JEI for that fluid's recipes
// (left-click) or uses (right-click). With the cauldron empty, Hexerei hands JEI "air, 0 mB", JEI throws
// "Focus value is invalid: FluidStack{Fluid=Air (Flowing), Amount=0}", and the game crashes (crash-2026-11-14_17.25.16).
// Hexerei never checks for an empty tank (MixingCauldronScreen.mouseClicked -> HexereiJei.showRecipe/showUses), and it
// has no config option to turn the lookup off.
//
// The guard: a click on the tank while the cauldron is empty is cancelled before the window sees it. Every other
// click, and any click on a tank with liquid in it, goes through as before.
// - The tank: 16 x 32 pixels at (42, 56) inside the window (Hexerei's own numbers), plus a pixel of slack all round.
// - Only on the client: on a server the screen classes don't exist, so nothing is registered there.
// Players restart the game once after the modpack update. KubeJS 6 (Rhino): raw Forge events (ForgeEvents.onEvent)
// can only be listened to in startup scripts.

(function () {

const SCREEN = 'net.joefoxe.hexerei.screen.MixingCauldronScreen'
const TANK = { x: 42, y: 56, w: 16, h: 32, slack: 1 }

function tankEmpty(screen) {
  try { return !!screen.mixingCauldron.getFluidStack().isEmpty() } catch (e) { return false }
}
function overTank(screen, mx, my) {
  let left = 0, top = 0
  try { left = Number(screen.getGuiLeft()); top = Number(screen.getGuiTop()) } catch (e) { return false }
  const x = Math.floor(mx), y = Math.floor(my)
  return x >= left + TANK.x - TANK.slack && x < left + TANK.x + TANK.w + TANK.slack &&
    y >= top + TANK.y - TANK.slack && y < top + TANK.y + TANK.h + TANK.slack
}

let client = false
try { client = !!Platform.isClientEnvironment() } catch (e) { client = false }
let loaded = true
try { loaded = !!Platform.isLoaded('hexerei') } catch (e) { loaded = true }
if (!client || !loaded) return

try {
  ForgeEvents.onEvent('net.minecraftforge.client.event.ScreenEvent$MouseButtonPressed$Pre', event => {
    let screen = null
    try { screen = event.getScreen() } catch (e) { return }
    if (!screen || String(screen.getClass().getName()) != SCREEN) return
    if (!tankEmpty(screen) || !overTank(screen, event.getMouseX(), event.getMouseY())) return
    event.setCanceled(true)
  })
} catch (e) {
  console.warn('[HexereiGuard] Could not listen for screen clicks: ' + e)
}

})()
