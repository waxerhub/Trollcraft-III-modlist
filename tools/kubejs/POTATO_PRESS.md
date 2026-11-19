# The Potato Press and the Potato Oven (Part II)

`startup_scripts/potato_press.js` adds:
- two items: **Enchanted Potato** and **Enchanted Baked Potato**;
- two blocks that make them: the **Potato Press** and the **Potato Oven**.

They're the currency of the Potato War after the price is revealed. When the Blood Pool opens Tier 5, the war's numbers for Tiers 6–8 turn out to count Enchanted Potatoes, and for Tiers 9–12 Enchanted Baked Potatoes (see "The price revealed" in [BLOOD_POOL.md](BLOOD_POOL.md)).

The ratios are Hypixel's (owner decision, 15 November 2026):

| Machine | Takes | Makes | Craftable from |
|---|---|---|---|
| Potato Press | 160 potatoes | 1 Enchanted Potato | Tier 5 (the reveal) |
| Potato Oven | 160 Enchanted Potatoes | 1 Enchanted Baked Potato (25,600 potatoes) | Tier 8 |

**Why a block and not a recipe:** a crafting grid holds 9 items, and Create's basin keeps each item type to one slot of 64 (checked in Create 6.0.8's code), so nothing in the pack takes 160 of one item. The owner chose a block that converts what's put in it, like Hypixel's Super Compactor, over a crafting chain or a new mod.

## How it works
- **27 slots.** The top two rows take the machine's input (only potatoes in the Press, only Enchanted Potatoes in the Oven). The bottom row holds what it made.
- **Every second,** each 160 inputs become one output, while the output row has room. If the output row is full, nothing is used up. A full input row (1,152) makes 7 in a second.
- **Players** open it with a right-click, like a chest.
- **Hoppers, pipes, Create funnels and AE2** put input in through the top and sides, and take output out through the bottom only. So a hopper under a Press takes the Enchanted Potatoes and never the raw potatoes waiting to be pressed. AE2 can autocraft through it with a processing pattern: 160 potatoes in, 1 Enchanted Potato back.
- **Breaking one** drops it and everything in it.
- **Looks:** the Press uses the barrel's textures, the Oven the lit smoker's. The items are the vanilla potato and baked potato, with the enchantment glow.

## Install
1. **Every player and the server** need `startup_scripts/potato_press.js` in `kubejs/startup_scripts/`. The items and blocks are registered at startup, and Minecraft refuses to connect a player whose game has different ones. So this needs a **modpack update** and a server restart.
2. **The server** needs one line added at the bottom of `config/modernfix-mixins.properties`:
   ```
   mixin.perf.faster_capabilities=false
   ```
   The player's modpack doesn't need it.
3. Restart the server. The log should say `[PotatoPress] Hoppers and pipes can reach the Potato Press and Oven`.

The recipes are in `part2/blood_pool.js` (`MACHINE_RECIPES`), sealed with the Blood Pool tiers.

## The ModernFix setting
- **Why it's needed:** KubeJS 6's block entities don't offer Forge's item capability, which is how hoppers, pipes and AE2 see a block's inventory. The script attaches one with Forge's `AttachCapabilitiesEvent`.
- **The crash:** ModernFix's "faster capabilities" generates bytecode that calls every capability provider directly. A provider made by a script is a Java proxy that this generated code isn't allowed to call. The first time a press loaded, the test server crashed ("Error constructing dispatcher", `IllegalAccessError`). With the option off, Forge's ordinary dispatcher calls it fine.
- **The guard:** the script reads ModernFix's option before attaching (`ModernFixMixinPlugin.instance.config`). If it's on, or can't be read, nothing is attached and the log says what to change:

  > [PotatoPress] Hoppers and pipes can't reach the Potato Press and Oven: ModernFix's mixin.perf.faster_capabilities is on. Add "mixin.perf.faster_capabilities=false" to config/modernfix-mixins.properties and restart. They still work by hand.

  So a server without the line doesn't crash; the machines just work by hand only.
- **Only on the server:** players' games never attach it, so their ModernFix stays as it is.
- **Cost:** ModernFix's optimisation of capability lookups is off for the whole server. The cost should be small (it's Forge's normal path), but it hasn't been measured.

## Settings (top of `potato_press.js`)
| Setting | Default | What it does |
|---|---|---|
| `RATIO` | 160 | Inputs per output, for both machines |
| `IN_SLOTS`, `SLOTS` | 18, 27 | The input rows, and the whole box |
| `MAX_PER_SECOND` | 8 | Outputs one block makes a second at most. A full input makes 7, so it never binds as set |
| `MACHINES` | the Press and the Oven | Each one's name, input, output and textures |

Changing the items' or blocks' ids, or adding a machine, needs the modpack updated too.

## Tests
`tools/tests/suites/potato_press.test.js` (26 checks):
- the items and blocks it registers, with their inventory, filter, tick and textures;
- the conversion: the leftover, the full input, spread-out stacks, a full output row (nothing used), other items left alone, and the Oven not taking plain potatoes;
- errors in a tick logged, not thrown;
- the capability: bottom face output slots, other faces input slots, only on the two blocks;
- the ModernFix guard: on, unreadable, not installed, and a player's game.

`blood_pool.test.js` covers the recipes (sealed until their tier, no rank needed).

## On the test server
16 November 2026, by console (no player online):
- **The prototype** (one press, no filter): a hopper above pushed potatoes in, and one on the side did too. A hopper below took only the Enchanted Potatoes into a chest. 197 potatoes made 1 Enchanted Potato, with 37 left. Breaking the press dropped it and its contents.
- **The crash** above, with ModernFix's default, and none with the option off.
- **The finished script:**
  - it read ModernFix's option as off and attached the capability;
  - the Press refused dirt from a hopper and took the potatoes;
  - the Oven made 168 Enchanted Potatoes into 1 Enchanted Baked Potato with 8 left;
  - the recipes followed their tiers.

## What couldn't be verified
- **A player's view:** the blocks' and items' looks, names and glow, opening the box, and taking items out by hand.
- **Pipes, Create funnels and AE2.** They use the same Forge capability as hoppers, so they should work, but only hoppers were tried.
- **A Create contraption moving a press.** Its contents should travel with it, but KubeJS block entities on contraptions weren't tried.
- **The server-wide cost** of turning off ModernFix's faster capabilities.
