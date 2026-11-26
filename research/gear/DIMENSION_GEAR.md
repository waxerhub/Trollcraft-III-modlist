# Dimension gear: balance check and lock proof

The Aether 1.5.2 (`aether-1.20.1-1.5.2-neoforge.jar`), Deeper and Darker 1.3.3 (`deeperdarker-forge-1.20.1-1.3.3.jar`) and
Blue Skies 1.3.31 (`blue_skies-1.20.1-1.3.31.jar`), against the Blood Pool's `TIERS`, `WEAR_LOCKS` and `WIELD_LOCKS`
(`tools/kubejs/server_scripts/part2/blood_pool.js`). Read-only. 25 November 2026. One row per item, with every number,
is in `dimension_gear.tsv` beside this file (175 items).

**How it was read.** Classes with `javap -p -c`/`-v` only, from the three jars (and, for the lock paths, the test
server's KubeJS 2001.6.5, Architectury 9.2.14, Curios 5.14.1 and Forge 47.4.10 patched Minecraft classes). Obfuscated
names resolved from the test server's two mapping files (read as text, joined by a small script). Data files (tags,
damage types, handle types, Curios slots) read from the jars and the vanilla data jar. Tiers from the Blood Pool's own
`tierOf` (through `tools/ftbquests/load_scripts.js`). Marks: **R** read (class or file), **C** config (file and key),
**I** inferred.

**Configs.** The repo's `tools/serverconfig/` has no file for these three mods. The test server's were read:
`world/serverconfig/aether-server.toml` ("Require gloves for set abilities" = true, "Maximum consumable Life Shards" =
10, "Cooldown for the Hammer of Kingbdogz projectile" = 50, "Cooldown for the Cloud Staff" = 40, "Golden Feather in
loot" = false, "Debuff non-Aether tools" = true, "Balance Invisibility Cloak for PVP" = false),
`config/deeperdarker-common.toml` (`soulElytraCooldown = 600`), `config/blue_skies-common.toml` (nothing that changes
gear). Whether the live server's per-world `aether-server.toml` matches is unknown.

## The short version

- **The wield lock holds for every sealed weapon and tool.** Every on-hit effect of the sealed (and proposed) weapons is
  in `Item.hurtEnemy` or is an attribute; every tool power is in `Item.useOn`; the sonorous staff fires from
  `Item.use`/`releaseUsing`. The hit lock cancels Forge's `LivingAttackEvent` at priority HIGH, the first thing
  `hurt()` does, so `hurtEnemy` never runs; the right-click refusals stop `use` and `useOn` before Minecraft calls them.
  Nothing these three mods attach to `AttackEntityEvent` or a higher-priority `LivingAttackEvent` belongs to sealed gear.
- **The wear lock has two gaps** (details and fixes below):
  1. **Warden armour in the 4th hotbar slot.** `WardenArmorItem.inventoryTick` strips Blindness and Darkness every tick
     whenever any warden piece sits at index 3 of its inventory compartment, which is the worn helmet *or main
     inventory slot 3*. The wear lock never looks there (and its own `p.give` can put a removed piece there).
  2. **The 20-tick window with right-click re-equip.** Sealed armour and gloves can be put straight back on by
     right-clicking (vanilla `ArmorItem.use`; Curios' right-click equip for the Aether's gloves), and the check runs on
     a fixed global 20-tick clock, so a piece is worn up to ~19 ticks of every 20. Inside that window the gravitite set's
     jump and fall cancel, a resonarium set's damage cancel, the warden leggings' speed and the warden boots' silence all
     work.
- **The earlier read-through had the resonarium armour backwards.** It does *not* cancel armour-bypassing damage (falls,
  poison, wither, void, sonic booms); it skips exactly those and cancels everything else: each piece takes 1/4 off every
  ordinary hit after armour, so a full set is immune to melee, arrows, explosions, lava, lightning and fire blocks until
  its durability runs out. So **a resonarium set does not stop the sonorous staff** (sonic boom bypasses armour).
- **Open gear already beats some sealed gear**: the Valkyrie set (open boss loot) matches gravitite and adds lift; the
  Crushing Hammer (12, plus an armour-ignoring slam) and the Different Sword (11) out-hit the Tier 7 warden sword (9); the
  Pig Slayer does 22 to piglins and hoglins; sentry boots cancel fall damage alone.

## 1. How the locks meet these mods (the KubeJS event finding)

| Lock in `blood_pool.js` | KubeJS 6 event | Posted from (Forge event, priority) | What a cancel stops (Forge 47.4.10 code) |
|---|---|---|---|
| Hit lock | `EntityEvents.hurt` | Architectury `EntityEvent.LIVING_HURT` ← `LivingAttackEvent`, **HIGH** (R: `KubeJSEntityEventHandler.init`; Architectury `EventHandlerImplCommon.event(LivingAttackEvent)`, `@SubscribeEvent(priority = HIGH)`, registered on `MinecraftForge.EVENT_BUS` by `EventHandlerImpl.registerCommon`) | `Player.hurt` (its `ForgeHooks.onPlayerAttack`) and `LivingEntity.hurt` (`ForgeHooks.onLivingAttack`) post it first thing and return false: no shield check, no `LivingHurtEvent`, no armour, no `LivingDamageEvent`. In `Player.attack`, knockback, sweep, `doPostHurtEffects`, `doPostDamageEffects` and `ItemStack.hurtEnemy` sit in the hurt-succeeded branch; the failed branch clears the Fire Aspect pre-ignite (R: `Player.attack`, `LivingEntity.hurt`, `actuallyHurt`) |
| Use refusal (air) | `ItemEvents.rightClicked` | `InteractionEvent.RIGHT_CLICK_ITEM` ← `PlayerInteractEvent.RightClickItem`, **HIGH** | `ServerPlayerGameMode.useItem`: cooldown check, then `ForgeHooks.onItemRightClick` returns the cancel result before `ItemStack.use` (R). KubeJS doesn't post while the item is on cooldown, but then vanilla returns before `use` too (R) |
| Use refusal (block) | `BlockEvents.rightClicked` | `RIGHT_CLICK_BLOCK` ← `RightClickBlock`, **HIGH**; Architectury also sets useItem and useBlock to DENY | `ServerPlayerGameMode.useItemOn` returns right after a cancelled `RightClickBlock`, before `onItemUseFirst`, the block's `use` and `ItemStack.useOn` (R) |
| Break lock | `BlockEvents.broken` | `BlockEvent.BREAK` ← `BlockEvent.BreakEvent`, **HIGH** | `ServerPlayerGameMode.destroyBlock` returns before `onBlockStartBreak`, `mineBlock` and `playerDestroy` (R) |
| (not used for wield locks) | `ItemEvents.entityInteracted` | `INTERACT_ENTITY` ← `EntityInteract`, HIGH | `useLockOf(s, 'mob')` returns '' for `WIELD_LOCKS` items, so right-clicking a mob with one is not refused. No sealed item overrides `interactLivingEntity` or `onLeftClickEntity` (R: method lists), so nothing gets through today |
| Wear lock | `ServerEvents.tick` | every tick; acts when a global counter hits a multiple of 20 | empties armour slots 36-39 and Curios' equipped handler; returns pieces with `p.give` (first free slot, I) |

**What can still run when the hit is cancelled:** anything on `AttackEntityEvent` (posted at the start of
`Player.attack`, before damage), `Item.onLeftClickEntity`, `CriticalHitEvent`, and `LivingAttackEvent` listeners at
HIGHEST (or HIGH ones registered before Architectury's). Forge's bus skips later listeners of a cancelled event unless
they ask for cancelled events (I). Survey of the three mods (R, all `@SubscribeEvent` with no priority = NORMAL unless
said):

| Mod | Listener | Event | Effect | Sealed gear? |
|---|---|---|---|---|
| Aether | `ToolAbilityListener.onEntityAttack` | `AttackEntityEvent` | only cancels a hit that is out of reach | no |
| Aether | `ArmorAbilityListener.onEntityAttack` | `LivingAttackEvent` | Phoenix set cancels fire damage (target side) | no |
| Aether | `AccessoryAbilityListener.onEntityHurt` | `LivingAttackEvent` | bookkeeping for the invisibility cloak; magma | no |
| Blue Skies | `SkiesPlayerEvents.attackEntity` | `AttackEntityEvent` | **horizonite tools set the target on fire for 3 s even if the hit is then cancelled** | horizonite is not sealed or proposed |
| Blue Skies | `SkiesPlayerEvents.entityAttackedEvent` | `LivingAttackEvent` | debug sword | no |
| Deeper and Darker | none | | | |

So, per on-hit ability, with the hurt event cancelled:

| Ability | Path | Fires when the hit is cancelled? |
|---|---|---|
| Gravitite sword launch | `hurtEnemy` | no |
| Zanite sword wear damage | MAINHAND attribute | no (no damage is dealt at all) |
| Different Sword (target Regeneration IV) | `hurtEnemy` | no |
| Resonarium, warden, charoite, diopside weapons | none (stats only) | nothing to fire |
| Sonorous staff beam | `releaseUsing` → `hurt(sonicBoom(player))` | each beam hit is cancelled while the staff is in the main hand; the use refusal stops it earlier in either hand |
| Unsealed, for reference: flaming, holy, pig slayer | `LivingDamageEvent` | no |
| Unsealed: lightning sword, vampire blade, candy cane | `hurtEnemy` | no |
| Unsealed: horizonite fire | `AttackEntityEvent` (+ `hurtEnemy`) | **yes** (only matters if horizonite is ever sealed) |

**Putting gear on.** Every armour piece here is a vanilla `ArmorItem`, whose `use` is `swapWithEquipmentSlot`
(R: Forge 47.4.10 `ArmorItem`), so a right-click puts it on. The Aether's gloves are `AccessoryItem`s with
`canEquipFromUse` = true (R) and Curios equips them from `CuriosEventHandler.curioRightClick` on `RightClickItem` at
NORMAL (R: Curios 5.14.1). `refuseUse` only refuses `USE_LOCKS` and `WIELD_LOCKS` items, so both equip paths stay open
for `WEAR_LOCKS` items. Dispensers also equip armour (vanilla) and the Aether's accessories (`AetherDispenseBehaviors`).

## 2. Full-set totals

Durability per piece is factor × 11/16/15/13 (helmet/chest/legs/boots) for every material here (R). Defence and toughness
are per-piece sums; knockback resistance is per piece × 4. "Damage taken" applies vanilla `CombatRules` to the set's
totals (I: vanilla formula, not re-read; before Protection and before any ability).

| Set | Tier | Defence (h/c/l/b) | Toughness | KB | Durability (h/c/l/b) | Ench. | Taken from a 10 / 20 / 40 hit | Set ability |
|---|---|---|---|---|---|---|---|---|
| Aether gravitite | 4 | **20** (3/8/6/3) | **8** | 0 | 363/528/495/429 | 10 | 3.0 / 8.0 / 24.0 | with gravitite gloves (C: gloves required): +1.0 jump velocity while the Gravitite Jump key (Space) is held; no fall damage |
| Aether zanite | 0 | 15 (2/6/5/2) | 0 | 0 | 165/240/225/195 | 9 | 6.0 / 16.0 / 35.2 | none |
| Aether Valkyrie (loot) | 0 | 20 (3/8/6/3) | 8 | 0 | 363/528/495/429 | 10 | 3.0 / 8.0 / 24.0 | with gloves: jump-held lift (speed up to 0.375/tick, ~50 ticks, recharged on landing); no fall damage |
| Aether Phoenix (loot) | 0 | 20 | 8 | 0 | 363/528/495/429 | 10 | 3.0 / 8.0 / 24.0 | with gloves: fire damage cancelled, lava swimming; wet pieces wear every 15 ticks and become obsidian |
| Aether obsidian | 0 | 20 | **12** | 0 | 407/592/555/481 | 15 | 2.8 / 7.2 / 20.8 | none |
| Aether Neptune (loot) | 0 | 15 (2/6/5/2) | 4 | 0 | 165/240/225/195 | 10 | 5.3 / 13.3 / 35.2 | with gloves: faster swimming |
| Aether sentry boots (loot) | 0 | 2 (boots only) | 0 | 0 | 195 | 9 | | **no fall damage, alone** |
| Resonarium | 6 | 18 (3/7/6/2) | 4 | 0 | 330/480/450/390 | 10 (no table, no Protection or Mending) | 4.1 / 10.9 / 32.5 **then ×0 with 4 pieces** | each piece −25% of every non-armour-bypassing hit (see 3.6) |
| Warden | 7 | **24** (4/9/7/4) | **16** | **0.4** | 440/640/600/520 | 18 | 2.0 / 4.0 / 12.3 | leggings +0.05 speed; helmet (and slot 4) clears Blindness/Darkness; boots silence steps |
| Blue Skies charoite (proposed 4) | 0 | 20 (3/8/6/3) | 8 | 0 | 363/528/495/429 | 10 | 3.0 / 8.0 / 24.0 | none |
| Blue Skies diopside (proposed 4) | 0 | 16 (2/7/5/2) | **18** | 0 | 396/576/540/468 | 9 | 4.2 / 9.7 / 24.3 | none |
| Blue Skies pyrope / aquite / horizonite | 0 | 12 / 15 / 12 | 0 | 0 | 165/240/225/195 | 12 / 9 / 12 | | none |
| *Vanilla diamond / netherite (I, not re-read)* | 0 / 5 | 20 / 20 | 8 / 12 | 0 / 0.4 | | | 3.0 / 8.0 / 24.0; 2.8 / 7.2 / 20.8 | |

Gloves (Curios `aether_gloves`, attack damage while worn, R): leather +0.25 (59), golden +0.25 (32), chainmail +0.35 (131),
iron +0.5 (250), Neptune +0.5 (250), zanite +0.25/+0.5/+0.75 by wear (250), diamond +0.75 (1561), **gravitite +0.75 (1561,
Tier 4)**, Valkyrie +1.0 (1561), Phoenix +1.0 (1561), obsidian +1.0 (2031), **netherite +1.0 (2031, fire-resistant, Tier 5)**.

## 3. Abilities: mechanics and trigger paths (sealed and proposed)

### 3.1 Gravitite armour and gloves (Tier 4) — R, C
- **Set check:** `EquipmentUtil.hasArmorSet`: the four gravitite pieces in their slots and, when
  `AetherConfig.SERVER.require_gloves` (C: true on the test server), gravitite gloves found by Curios `findFirstCurio`.
- **Jump:** Forge `LivingJumpEvent`, NORMAL → `ArmorAbilityListener.onEntityJump` → `GravititeArmor.boostedJump`: for a
  player, on the ground and with `isGravititeJumpActive` (a synced flag from the client key `GRAVITITE_JUMP_ABILITY`,
  default 32 = Space), `push(0, 1.0, 0)` on top of the normal 0.42 jump.
- **Fall:** `LivingFallEvent`, NORMAL → `AbilityHooks$ArmorHooks.fallCancellation`: cancelled with sentry boots, a full
  gravitite set or a full Valkyrie set.
- **Lock:** wear lock. Both effects act whenever the full set happens to be on, i.e. inside the ≤20-tick window (gap 2).
  Note the fall cancel is already available from open gear (sentry boots alone, the Valkyrie set).

### 3.2 Gravitite sword (Tier 4) — R
7 damage, 1.6 speed, 1561 uses. `hurtEnemy` → `GravititeWeapon.launchEntity`: at full attack strength
(`EquipmentUtil.isFullStrength`, attack strength ≥ 1), if the target is on the ground or in a fluid and not
`#aether:unlaunchable` (the aechor plant), `push(0, 1.0, 0)`. **Held:** `hurtEnemy` is only called after `hurt()`
returned true.

### 3.3 Gravitite pickaxe, axe, shovel, hoe (Tier 4) — R
Right-click (`useOn`, not sneaking) on a block the tool is right for, with a free block above, no block entity, hardness ≥
0, not a double block, not `#aether:gravitite_ability_blacklist` (buttons, pressure plates, trapdoors, fence gates): the
block becomes a `FloatingBlockEntity` that rises (anvils hurt what they land on: 2 per block fallen, max 40); 4
durability. **Held:** use refusal on `RightClickBlock` (HIGH), in either hand; `useItemOn` returns before `useOn`. This
also matters because floating a block moves it without a `BreakEvent`.

### 3.4 Zanite sword (Tier 5) — R
6 damage new, 1.6 speed, 250 uses. `getAttributeModifiers` (MAINHAND) → `ZaniteWeapon.increaseDamage`: base modifier 5
(1 is the player's own), buff = 5 × (2·d/250 + 0.5), bonus = max(0, round(buff − 5)), d = durability used. Tooltip =
6 + max(0, round(d/25 − 2.5)):

| d (used of 250) | <75 | 75 | 100 | 125 | 150 | 175 | 200 | 225-249 |
|---|---|---|---|---|---|---|---|---|
| damage | 6 | 7 | 8 | 9 | 10 | 11 | 12 | 13 |

**Held:** an attribute, so it only counts in a landed hit, which the hit lock cancels.

### 3.5 Netherite gloves (Tier 5) — R
+1.0 attack damage in the Curios gloves slot (`GlovesItem.getAttributeModifiers(SlotContext, ...)`), 2031 durability,
fire-resistant, no set. Wear lock; worth +1 damage inside the window.

### 3.6 Resonarium armour (Tier 6) — R
`DeeperDarkerEvents.livingDamageEvent`, Forge `LivingDamageEvent`, NORMAL (after armour and Protection, before
absorption hearts):
1. if the source is in `#minecraft:bypasses_armor`, **return** (nothing happens);
2. otherwise, for each worn `ArmorItem` in `#deeperdarker:resonarium_armor` (the four pieces), take **original/4** off the
   damage, and damage that piece by **(int) original** durability.

`#minecraft:bypasses_armor` (vanilla data, R): on_fire, in_wall, cramming, drown, fly_into_wall, generic, wither,
dragon_breath, starve, fall, freeze, stalagmite, magic (so poison and harming), indirect_magic, out_of_world,
generic_kill, sonic_boom, outside_border; plus `aether:armor_piercing_attack`, `aether:inebriation`,
`blue_skies:summoned_lightning`, `venom_spit`, `rock_stab`, `slam` (R: the mods' tag files; other mods in the pack not
scanned). So a full set takes **no damage at all** from player and mob melee, arrows and other projectiles, explosions,
standing in fire or lava, lightning, cactus, thorns..., and normal damage from everything in the list. Each blocked hit
costs every piece its damage in durability on top of vanilla armour wear; the 330-durability helmet goes first. It
cannot take Protection (any kind) or Mending (`canApplyAtEnchantingTable`), and is not table-enchantable
(`isEnchantable` false); Unbreaking can go on by anvil (I). **Lock:** wear lock, with the window gap: inside it,
25% per piece.

### 3.7 Resonarium and warden tools (Tiers 4 and 7) — R
Plain vanilla `SwordItem`/`PickaxeItem`/`AxeItem`/`ShovelItem`/`HoeItem` on `DDTiers` (resonarium: level 3, 1193
uses, speed 8, +3, enchantability 15; warden: level 5, 2519 uses, speed 10, +5, enchantability 18, fire-resistant).
No ability. Level 5 is not in Forge's tier sorting, so it falls back to the vanilla level test and mines what level 3+
mines (I). **Held** by the wield lock (hits, breaking) and the block right-click refusal (strip, path, till).

### 3.8 Warden armour (Tier 7) — R
- **Leggings:** `getAttributeModifiers` returns, for `warden_leggings` in LEGS, the armour modifiers plus
  **MOVEMENT_SPEED +0.05 (ADDITION)** on the player's 0.1 base = +50% walking speed.
- **Blindness and Darkness:** `WardenArmorItem.inventoryTick`: for a `ServerPlayer`, **if slotId == 3**, remove
  Blindness and Darkness. Forge 47.4.10's `IForgeItem.onInventoryTick` passes the index *inside each compartment*
  (main 0-35, armour 0-3 where 3 = head, offhand 0) (R), so this fires for the worn helmet **and for any warden piece
  (helmet, chestplate, leggings or boots) in main inventory slot 3, the 4th hotbar slot**, worn or not.
- **Boots:** `VibrationListenerMixin.deeperdarker_handleGameEvent`: if the FEET item is in
  `#deeperdarker:dampens_vibrations` (only `warden_boots`) and the game event is in `#deeperdarker:feet_vibrations`
  (step, hit_ground, swim, splash), the vibration is ignored (sculk sensors, shriekers, wardens). The chest variant
  checks the same tag in the chest slot, which nothing can fill.
- **Lock:** wear lock for the worn effects (window gap); **gap 1** for the hotbar-slot effect.

### 3.9 Sonorous staff (Tier 9) — R
`use` → `startUsingItem` (bow animation, 72000-tick use). `releaseUsing` with t = ticks charged:
- damage **D = round(50 / (1 + 16·e^(−0.06·t)))**, range **R = min(40, round(3·ln(t + 1)))** blocks;
- the beam steps i = 0..R−1 along the look vector from the eyes, stopping at the first non-air block that occludes;
  every living entity (not the user) whose box meets that cell inflated by 0.4 takes **(int)(D × (1 − (i/R)²/3))**
  from `damageSources().sonicBoom(player)` and is pushed along the beam × (1 − knockback resistance);
- 1 durability per shot (320 total, repaired with soul crystals), then a **20-tick cooldown**.

| charge | 0 | 0.5 s | 1 s | 2 s | 3 s | 4 s | 5 s | 6.15 s | 20 s | 1 min | 1 h (max) |
|---|---|---|---|---|---|---|---|---|---|---|---|
| D | 3 | 5 | 9 | 20 | 35 | 44 | 48 | **50** | 50 | 50 | 50 |
| range (blocks) | 0 | 7 | 9 | 11 | 12 | 13 | 14 | 14 | 18 | 21 | 34 |
| damage in the last cell | – | 3 | 6 | 14 | 25 | 31 | 34 | 35 | 35 | 34 | 34 |

`minecraft:sonic_boom` is in `bypasses_armor` and `bypasses_enchantments` (no armour, no Protection), not in
`bypasses_resistance`, and has `"scaling": "always"`, so against **players** it is difficulty-scaled (×1.5 on Hard: 75)
(R: vanilla JSON; the scaling numbers are vanilla `Player.hurt`, I). **Held:** the use refusal cancels
`RightClickItem` at HIGH, `useItem` returns before `Item.use`, so the server never starts using it; a client that
predicts the charge sends a release that lands on an empty server-side use item and does nothing (I). The hit lock
would also cancel each beam hit while the staff is in the main hand.

### 3.10 Reinforced echo shard (Tier 7), enchanted gravitite (Tier 4)
Materials; nothing worn or wielded (R for the echo shard as a repair ingredient; I for enchanted gravitite, a block).

### 3.11 Blue Skies charoite and diopside (proposed Tier 4) — R
- **Armour:** `SkyArmorItem` adds only the falsite bar and a tooltip; no event, hook or mixin names charoite or diopside.
  Stats only.
- **Tools** (`SkySwordItem`, `SkyPickaxeItem`, `SkyAxeItem`, `SkyShovelItem`, `SkyHoeItem`): `hurtEnemy` only does
  something for horizonite (fire) and the Different Sword; the hoes' damage modifier is fixed at 0 (tooltip 1). Durability
  and the attack-speed modifier are scaled by the handle stick in the stack's NBT (`ToolUtils`; data
  `blue_skies/tool_handle_types`: durability ×0.9-1.2, speed modifier ×0.95-1.05, vanilla stick ×1.0).

| Tool | Charoite (level 3, speed 8, ench 10) | Diopside (level 3, speed 6, ench 14) |
|---|---|---|
| sword | 7, 1.6 (1.48-1.72) | **9, 1.2** (1.06-1.34) |
| pickaxe | 5, 1.2 | 7, 1.2 |
| axe | 9, 1.0 | **12, 0.5** (0.32-0.68) |
| shovel | 5.5, 1.0 | 7.5, 1.0 |
| hoe | 1, 4.0 | 1, 4.0 |
| uses | 1561 (1405-1873 by handle) | 1661 (1495-1993) |

- **Falsite coating** (both armour and tools): absorbs durability loss first, **max(30, floor(maxDamage/5))** uses per
  coating (`IFalsiteItem.getMaxFalsiteUses`).
- **Different Sword (option 5):** 11, 1.6, 1000 uses, enchantability 0; `hurtEnemy` gives the *target* Regeneration IV
  (amplifier 3) for 40 ticks. A wield lock would hold all of it.
- **Lock:** the proposed wear and wield locks would hold everything; the armour's window gives armour values only.

## 4. Lock gaps and how to close them

**Gap 1 — warden armour in hotbar slot 4 (Blindness and Darkness immunity).** A sealed warden piece kept in main
inventory slot 3 runs `inventoryTick(slotId 3)` every tick and strips Blindness and Darkness (the Warden's pulses, sculk
shriekers, splash potions in PvP). `takeOffSealed` only looks at slots 36-39 and Curios, and returns removed pieces with
`p.give`, which fills the first free slot, possibly slot 3 itself (I).
*Close it:* in `takeOffSealed`, also look at `p.inventory.getItem(3)`: if it is a locked `deeperdarker:warden_*`
piece, move it to a free slot from 9 up (or drop it), and give removed armour back with an explicit slot other than 3
rather than `p.give`. Running that every tick (cheap: one slot) closes it fully; at 20 ticks it leaves the same short
window as gap 2.

**Gap 2 — the 20-tick window, re-equippable by right-click (all `WEAR_LOCKS`).** The check runs when a global counter
hits a multiple of 20, so a piece put on right after a check stays on ~19 ticks, and a right-click puts it back at once
(vanilla `ArmorItem.use`; Curios' `curioRightClick` for gloves; also dispensers). A player who arranges the hotbar can keep
pieces on most of the time; a macro makes it easy. What works in the window: armour values; gravitite set jump and fall
cancel (needs 5 pieces on); resonarium −25% per piece (a full set is immune to ordinary hits); warden leggings +50%
speed, helmet's effect removal, boots' silence; gloves' +0.75/+1.0 damage.
*Close it:*
1. Refuse the right-click equip: in `useLockOf`, return `'use'` for a locked `WEAR_LOCKS` id when `where == 'use'`.
   `ItemEvents.rightClicked` cancels `RightClickItem` at HIGH, before Curios' NORMAL `curioRightClick` and before
   `ArmorItem.use`.
2. Check armour slots (and Curios) every tick instead of every 20 (four slot reads per player), or react to
   `PlayerEvents.inventoryChanged`. That also catches inventory-screen shift-clicks and dispensers within a tick.

**Notes (not gaps today):**
- `ItemEvents.entityInteracted` is not refused for `WIELD_LOCKS` items; no sealed item acts on a mob right-click.
- The hit lock only reads the main hand. No sealed item has an off-hand effect, and the use refusal covers both hands.
- The hit lock acts on `LivingAttackEvent`, so a sealed weapon still breaks boats, minecarts, item frames, paintings and
  end crystals (they are not living). Trivial.
- If horizonite is ever sealed, its fire fires on `AttackEntityEvent` (before the hurt lock) and needs its own stop.
- Fake players (Create's Deployer) go through the same Forge events as players (I; Create not read here).

## 5. Open gear stronger than sealed gear (the ladder)

| Open (Tier 0) item | Numbers | Sealed item it matches or beats |
|---|---|---|
| Aether Valkyrie set + gloves (silver dungeon) | 20/8, lift ~2.5 s, no fall damage | gravitite set (Tier 4): same stats, weaker power |
| Aether sentry boots (bronze dungeon) | fall damage cancelled alone | gravitite set's fall cancel |
| Aether obsidian armour (from Phoenix) | 20/12 | netherite (Tier 5) minus knockback resistance; beats gravitite (4) |
| Aether Phoenix set | 20/8 + fire and lava immunity | |
| Aether vampire blade | 7, 2031 uses, heals 1 per hit | gravitite and resonarium swords (Tier 4) |
| Aether holy sword | 7 (+8.25 against undead = 15.25) | warden sword (9, Tier 7) against undead |
| Aether pig slayer | 6 (+16 against pigs, piglins, brutes, zombified piglins, hoglins, zoglins = 22) | anything in the Nether |
| Aether Valkyrie lance | 7 at 1.3, 6.5 reach | |
| Blue Skies Crushing Hammer (Starlit Crusher bags) | **12** at 0.7; charged slam: 6 `blue_skies:slam` (ignores armour and shields) to everything on the ground within 7 blocks each way, thrown up, 4 s cooldown | warden sword (9, Tier 7), warden axe (11), zanite sword below 13 |
| Blue Skies Different Sword (Arachnarch bags; option 5) | **11** at 1.6 (heals its target) | warden sword (9, Tier 7) |
| Blue Skies diopside axe / sword (proposed 4, option 5) | 12 at 0.5 / 9 at 1.2 | netherite axe/sword per hit (Tier 5); warden sword equals 9 |
| Blue Skies spears | thrown 7.2-8.8 by wood | |

Per second the slow Blue Skies weapons are weaker (diopside axe 6/s, Crushing Hammer 8.4/s, warden sword 14.4/s), so the
ladder holds for sustained fighting; per hit (PvP openers, the arena's own-gear rounds) it doesn't.

## 6. Discrepancies with the earlier documents

`research/AETHER_DEEPERDARKER.md`, "The numbers" and the tier reasons:
1. **Resonarium armour, backwards.** Written: "a full set cancels every armour-bypassing hit (falls, poison, wither,
   magic, drowning, starving, the void, sonic booms), paid in durability". Read: it returns immediately for
   armour-bypassing damage and cancels 1/4 per piece of *every other* hit (§3.6). The Tier 6 reason in "Re-evaluated
   tiers" rests on the wrong mechanic; the real one (immunity to melee, projectiles and explosions while durability
   lasts) is the stronger combat power. Worth re-deciding.
2. **"A full resonarium set cancels" the sonorous staff — wrong** (sonic boom bypasses armour, so resonarium skips it).
   Also repeated in the "For the Purge and the Gladiator Arena" note and in `research/DIMENSIONS_INTEGRATION.md`
   ("Own-gear fights: ... a resonarium set cancels it").
3. **Sonorous staff "18-block beam ... 1 shot a second".** Range grows with charge time: 14 blocks at full damage
   (6.15 s), 18 after ~20 s, up to 34 at the 1-hour limit; damage falls to about 2/3 in the last cell; the 20-tick
   cooldown comes after each release, on top of the charge (a 1-second shot does 9). "×1.5 on Hard" is right but only
   against players.
4. **Warden "no blindness or darkness":** worn, only the helmet does it; but any warden piece in the 4th hotbar slot does
   it too (gap 1). "Boots silence your vibrations": only steps, landings, swimming and splashes.
5. **Dungeon swords "7 each":** the pig slayer is 6 (PIG_SLAYER tier +2), the candy cane sword 4 and the Hammer of
   Kingbdogz 6; the pig slayer's +16 covers piglins, piglin brutes, zombified piglins, hoglins and zoglins as well as
   pigs; the flaming sword's 30 s grows by 4 s per Fire Aspect level; the holy sword's +8.25 grows by 2.5 per Smite level.
6. **Valkyrie lance:** attack speed 1.3, not the table's default 1.6.
7. Confirmed as written: zanite 6→13 (9 at half, 11 at three-quarters); gravitite 20/8/0, 7, 1561; Neptune 15/4/0;
   Valkyrie 20/8/0 and +3.5 reach; Phoenix/obsidian 20/8 → 20/12; gloves +0.25 to +1.0; life shards +2 each up to 10
   (C); regeneration stone 0.4 HP/s; zanite ring/pendant ×1.4-1.73; resonarium tools 7, 1193; resonarium armour 18/4/0;
   warden 24/16/0.4, leggings +50%, 9, 2519, level 5; staff 50 max, 320 uses; soul elytra 3 armour, 956 uses, 30 s
   (C).

`research/dimensions/BLUE_SKIES_GEAR.md`: every gear number checked matches (charoite 20/8 and 7/9, diopside 16/18 and
9/12/7/7.5, pyrope, aquite, horizonite, Different Sword 11 and 1000, Crushing Hammer 12 (0.7), 6-damage slam, 4 s
cooldown, spike shield 6 (1.2) 850, moonstone shield 460, spears 4 (1.1) and 8 thrown, soulbound 450). Corrections and
additions:
- spear durability depends on the spear's own wood (bluebright and lunar 250, starlit and dusk 225, frostbright and maple
  275, comet 300), not 250 for all; thrown damage likewise per wood (8 / 8.8 / 7.2 / 7.2);
- the falsite coating's uses, left open there, are max(30, floor(maxDamage/5));
- the Crushing Hammer's slam is `blue_skies:slam`, which bypasses armour and shields; it reaches 7 blocks *each way*
  (a 14-wide box, 1 up or down), hits only targets on the ground with knockback resistance below 1, and also lifts the
  user (0.2);
- enchantability: charoite 10 (armour and tools), diopside armour 9 and tools 14, Different Sword 0.

`research/dimensions/MACHINES_FOOD_LOOT.md`: consistent ("the tree's right-click lock stops its beam": yes, `use` is
where it starts; "a Curios lock on the gloves alone would switch off the set abilities": yes, with require_gloves true, C).
`research/DIMENSIONS_INTEGRATION.md`: only the resonarium-versus-staff line (item 2 above).

## 7. What couldn't be determined

- **Live configs:** the live server's `world/serverconfig/aether-server.toml` (the gloves rule, cooldowns, life shard
  cap) and its difficulty (the staff's ×1.5 against players on Hard). Only the test server's files were read.
- **Not tried in game:** right-click re-equip timing against the 20-tick check; Curios right-click equip of a sealed
  glove; the warden slot-3 effect; where `p.give` puts a removed piece; fake-player (Deployer) paths; the client-side
  staff release landing on an empty server use item.
- **Other mods' damage types** in `#minecraft:bypasses_armor` (they change what resonarium skips): only vanilla and these
  three mods were read.
- **Comparison items, numbers not worked out:** the Phoenix bow's fire seconds and the Phoenix-to-obsidian timing (a
  15-tick period and a 1501 constant seen), the Hammer of Kingbdogz projectile (a 7.0 constant, likely damage), cloud
  staff minions, the shield of repulsion's standing-still condition, the ice ring's radius, venom spit, alchemy spikes,
  fluctuant sphere and Artificial Golem stats, skyroot/holystone drop rates, the arcs' exact numbers beyond the speed
  boosts (taken from the earlier doc).
- **Vanilla rules used but not re-read:** `CombatRules` (the damage-taken illustration), the difficulty scaling numbers in
  `Player.hurt`, Forge's skipping of cancelled events, `TierSortingRegistry`'s fallback for level 5.
