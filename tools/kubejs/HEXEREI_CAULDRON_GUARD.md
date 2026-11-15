# Hexerei cauldron guard (modpack fix)

`startup_scripts/hexerei_cauldron_guard.js` stops a client crash in Hexerei's Mixing Cauldron. It's a **client-side** fix: it ships in the **modpack**, not on the server.

## The crash
- **What players did:** clicked the fluid tank in an **empty** Mixing Cauldron's window (crash-2026-11-14_17.25.16-client).
- **What happens:**
  - In that window, a left-click on the tank asks JEI for the fluid's recipes, and a right-click for its uses.
  - Hexerei 0.4.2.3 never checks whether the tank is empty. It hands JEI "air, 0 mB", and JEI throws `IllegalArgumentException: Focus value is invalid: FluidStack{Fluid=Air (Flowing), Amount=0}`. Nothing catches it, so the game crashes.
- **Where it is in Hexerei's code** (read with `javap`): `MixingCauldronScreen.mouseClicked` calls `HexereiJei.showRecipe` or `showUses` with the cauldron's fluid when the mouse is over the tank.
- **No other way round it:**
  - Hexerei has no config option for the JEI lookup.
  - 0.4.2.3 appears to be the newest 1.20.1 build, and no fix or bug report turned up.

## The fix
A click on the tank **while the cauldron is empty** is cancelled before the window sees it. It listens to Forge's `ScreenEvent$MouseButtonPressed$Pre`, which can be cancelled.
- **Only that window:** Hexerei's `MixingCauldronScreen`.
- **Only that spot:** the tank, 16 × 32 pixels at (42, 56) inside the window, as Hexerei draws it, with a pixel of slack all round. The window's corner comes from `getGuiLeft()` and `getGuiTop()`.
- **Only when empty:** it reads the window's public `mixingCauldron` field. With liquid in the tank, the click goes through, and the JEI lookup works as Hexerei meant.
- **Everything else is untouched:** every other click in the window and every other window.
- **Only on the client:** `Platform.isClientEnvironment()`. On a server the screen classes don't exist, so nothing is registered. It also does nothing without Hexerei.

All the names were checked against the real files:
- the event and its `setCanceled`, in Forge 47.4.10's jars;
- `getGuiLeft()` and `getGuiTop()`, in Forge's patched client classes;
- the field and the tank's numbers, in Hexerei 0.4.2.3;
- the `Platform` methods, in KubeJS 2001.6.5.

## Install (modpack)
1. Put `hexerei_cauldron_guard.js` in the modpack's `kubejs/startup_scripts/` (next to `kubejs/client_scripts/`), and publish the modpack update.
2. Players update and **restart the game** (startup scripts load only at launch).

It isn't needed on the server. If it does end up there, it does nothing.

## Test plan (a client with the update)
1. Place a Mixing Cauldron, leave it empty, and open it.
2. Left-click and right-click the fluid tank: nothing happens, and no crash.
3. Fill it with water, open it, and left-click the tank: JEI's recipes for water open as before.
4. Everything else in the window still works: the slots and the drain button.

## Tests
`tools/tests/suites/hexerei_cauldron_guard.test.js`, 12 checks on the mock:
- **cancelled:** left- and right-clicks on an empty tank, and its edges;
- **let through:**
  - a click past the slack, and the rest of the window;
  - a tank with liquid;
  - another window;
  - an unreadable cauldron, or no screen at all;
- **nothing registered:** on a server, or without Hexerei;
- **a warning, not a crash,** if the event can't be listened to.

## What couldn't be verified
**The real client:** the scripts were only checked on a dedicated server and the mock, so it's still to see in the game itself (test plan above) that:
- the guard loads;
- the click is cancelled;
- nothing else in the window changes.
