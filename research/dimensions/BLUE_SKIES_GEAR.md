# Blue Skies against the Blood Pool (Part II)

Read-through of `blue_skies-1.20.1-1.3.31.jar` (with `structure_gel-1.20.1-2.16.2.jar` beside it) against the Blood Pool's
12 tiers (`part2/blood_pool.js`), done the way `research/AETHER_DEEPERDARKER.md` was. 25 November 2026.

**How it was read.** The jar's data (695 recipes, 641 loot tables, its tags, worldgen and structure files) from the
prepared index and the extracted data tree; its classes with `javap -p -c` only (item and armour registries, tiers and
materials, the outside-gear hooks, the boss, keystone, trade and arc classes, the mixins); its English language file. Obfuscated
Minecraft names in the bytecode were resolved with the test server's own mapping files (`mcp_config ... mappings-merged.txt`
and `server-1.20.1-... -mappings.txt`, read as text). Tiers of comparable items come from the Blood Pool's `tierOf`
(through `tools/ftbquests/load_scripts.js`). No wiki was used. Each claim is marked **read** (with the class or file) or
**inferred**.

## Where things stand (nothing gated)

- **Both dimensions are open from day one.** A Gatekeeper (in Gatekeeper houses in the Overworld) sells the **Zeal
  Lighter** for 8 emeralds (`blue_skies-common.toml`: `zeal_lighter_cost = 8`; clamped to 1–64 in
  `GatekeeperEntity.getTradesForProgression`, read). It can also be crafted from charoite and a moonstone shard (read: recipe
  `blue_skies:zeal_lighter`).
- **Nothing in Blue Skies is sealed.** `tierOf` is 0 for every `blue_skies:` id checked (the namespace is in no tier).
- **No other mod in the pack touches Blue Skies gear.** The pack's earlier index has no recipe or loot entry naming
  `blue_skies`; only log and plant tags from Create, Alex's Caves and Supplementaries (read).

## Blue Skies' own rules (read from the code)

### Outside gear works poorly in the Everbright and the Everdawn

All in `SkiesEvents.onLivingHurt` (a `LivingDamageEvent`, so after armour), `SkiesEntityHooks`, `PlayerHooks`,
`LivingEntityHooks` and the `PlayerEntityMixin`/`LivingEntityMixin` (read). It applies only while the player is in one of the
two Blue Skies dimensions.

| What | Rule (read) |
|---|---|
| **Melee** | A hit by a player holding an "outside" weapon does `min(7, damage x 0.3)`, and the action bar says "It seems this weapon doesn't work as well here." (`SkiesEntityHooks.nerfDamage`; only when the player's attack damage is above 1, i.e. not a bare fist). A netherite sword's 8 becomes 2.4; anything above 23.3 is capped at 7. |
| **Projectiles and indirect hits** | Any projectile or indirect damage that isn't an explosion (`DamageTypeTags.IS_PROJECTILE` or `isIndirect()`, and not `IS_EXPLOSION`) is capped at **5**. A player's own projectile keeps its full damage only if its entity is a Blue Skies one (spears, venom spit) (`nerfIndirectDamage`). Arrows, tridents and other mods' projectiles are capped at 5. |
| **Armour** | Each worn armour piece that isn't Blue Skies armour (and isn't leather, gold or turtle) takes `max(2, min(4, defence/2))` off the player's armour value (`LivingEntityHooks.getArmorValue`). Full diamond or netherite (20) shows 9; full iron (15) shows 6. Toughness isn't touched. (If the penalty would reach the whole value, nothing is taken.) |
| **Mining** | An outside tool mines at 0.999 speed (bare-hand speed) on blocks it's the right tool for (`PlayerHooks.modifyBreakSpeed`), and on blocks that need at least a stone tool it can neither harvest nor break them (`SkiesPlayerEvents.harvestCheck` and `destroyBlock` via `isBreakingNerfed`). |
| **What counts as "outside"** | `PlayerHooks.isNerfableTool`: any item whose id isn't in the `blue_skies` namespace and that is a `TieredItem` of a tier other than vanilla wood, stone or gold, **or** whose id path is or ends with one of: axe, pickaxe, shovel, hoe, hammer, mattock, pickadze, excavator, kama, scythe, sword, dagger, cleaver, rapier, saber, scabbard, scimitar, shortsword, greatsword, katana, spear. |
| **Who is exempt** | Creative players, and players who have "completed progression": **Everbright progression ≥ 3 and Everdawn progression ≥ 3** (`EntityUtil.hasPlayerCompletedProgression`). |

**Nobody can complete it in survival.** Progression only rises when a dungeon boss dies (`SkiesEvents.onEntityDeath`:
every player within 25 blocks across and 15 up or down, who is at the step before), and Blue Skies 1.3.31 has two bosses a
dimension, at progression 1 and 2 (`getProgression()` in the four boss classes; `isEverbrightBoss()`). So 3 is out of reach and
**the penalty applies to every survival player for good**. The only other setter is an op command, `/blue_skies
set_progression everbright|everdawn <0-4>` (permission level 2; it acts on the player who runs it, so `/execute as <player>
run blue_skies set_progression ...` for someone else) (read: `BlueSkiesCommand`).

**No config switch.** `blue_skies-common.toml` has only Debug, Holiday Content, Gatekeeper (`zeal_lighter_cost`) and Mod
Compatibility (read: the test server's file and `BlueSkiesConfig$CommonConfig`).

**What this means for the Pool:** like the Aether's tool debuff, the Blue Skies dimensions police themselves: gear from other
mods (Pool gear, the Aether's, Deeper and Darker's) can't skip Blue Skies' own ladder there. But **Blue Skies gear is never
penalised anywhere else**, so in the Overworld (and the Nether, End, Twilight Forest, Otherside) it works at its full numbers.
That's what the tiers below are about.

Also enforced by Blue Skies (read):
- **Bosses cap the damage of a hit**: 20 by default, 15 for the Summoner and the Arachnarch (`ISkyBoss.getDamageCap`,
  `capBossDamage`), and ignore player hits from farther than 4.15 blocks (Starlit Crusher) or 5.08 (Arachnarch)
  (`nerfReachAttacks`).
- **Dungeons can't be dug through**: until a player has beaten a dungeon's boss, only "generic" blocks can be broken or
  placed in it (`SkiesPlayerEvents$DungeonBalancingChecks`).

### Dungeons, keys and bosses, in order

| Order | Boss (HP) | Dimension, dungeon | To summon | Gives (loot bag; read: `loot_bags/*`) | Opens |
|---|---|---|---|---|---|
| Everbright 1 | **Summoner** (350) | Everbright Blinding dungeon | 4 blinding keys at its keystone | **Ethereal arc**, soulbound spear, trim template, emeralds, soul fragments, aquite; 0–2 of summoning table, star flare, disc, enchanted book; uncommon/rare bags: 25%/50% for one of summoning tome, falsite, a randomly enchanted book | Everbright progression 1: the Nature keystone and the Gatekeeper's nature key trade |
| Everdawn 1 | **Alchemist** (500) | Everdawn Blinding dungeon | 4 blinding keys | **Dusk arc**, spike shield, trim template, emeralds, ventium, aquite; 0–2 of **alchemy table**, star flare, disc, book; uncommon/rare: alchemy scroll, horizonite, book | Everdawn progression 1: the Poison keystone and its key trade |
| Everbright 2 | **Starlit Crusher** (500) | Nature dungeon (Snow-Covered Pines) | 4 nature keys | **Nature arc**, trim template, starlit logs, aquite; 0–2 of cryo root, falsite, disc, book; uncommon/rare: crushing hammer, diopside gems, saddle | Everbright progression 2 |
| Everdawn 2 | **Arachnarch** (500) | Poison dungeon (Sunset Maple Forest) | 4 poison keys | **Poison arc**, trim template, string, webbing, aquite; 0–2 of poison potion, horizonite, disc, book; uncommon/rare: venom sac, diopside gems, **Different Sword** | Everdawn progression 2 |

- **Keys** (read): a keystone takes a full stack of **4 keys**, used up (`KeystoneBlockEntity.isCorrectKey`, `KeystoneBlock.spawnBoss`).
  Blinding keys are in the Blinding dungeons' library, prison and study chests (one each); nature and poison keys in their
  dungeons' key chests. The Gatekeeper also trades them (1 a trade, 4 uses) once the player has right-clicked that keystone
  (advancements `progression/unlock_*_key_trade`): blinding key for 6 books and 1 emerald; nature key for 6 nature stone and
  16 starlit saplings (needs Everbright progression 1); poison key for 6 poison stone and 16 spider eyes (needs Everdawn
  progression 1) (`GatekeeperEntity.getTradesForProgression`, `SkiesVillagerTrades$KeyTrade`).
- **Bag rarity** (read: `ISkyBoss$BossLevel`): the bag is common/uncommon/rare by weight: Bronze 70/25/5, Silver 60/30/10,
  Gold 50/30/20, Platinum 0/60/40. A boss's level is Gold on Hard, Silver on Normal, Bronze below (`getDefaultDifficultyID`).
  An arc used on its own keystone re-summons the boss "at higher difficulty" (language file) and puts the arc on a
  3-minute cooldown (read: `spawnBoss`, 3600 ticks); the level it raises to is inferred.
- **Each boss also drops a trophy block** (`dropTrophy`, read) and there's a dungeon map trade at every cartographer: Blinding
  dungeon for 8 emeralds, Nature or Poison for 12 (read: `SkiesEvents.onVillagerTradesAssigned`).
- The language file names Aquatic and Life keys and dungeons, but they aren't in 1.3.31 (not registered; no structure).

## (a) The ladder

| Step | What | How | Strength |
|---|---|---|---|
| 1 | Wood tools (six woods), **comet** wood tools (stone level), turquoise and lunar stone tools | crafted (Blue Skies' code-built tool recipes) | wood/stone; outside tools can't break Blue Skies stone |
| 2 | **Pyrope** gear | pyrope gems from ore (both dimensions, 17 veins a chunk, y 0–83, stone pick) | chainmail armour; stone-level tools, very fast (efficiency 11) |
| 3 | **Aquite** gear | raw aquite (both, 15 a chunk, y 0–54, stone pick), smelted | iron |
| 3 | **Horizonite** gear | raw horizonite (Everdawn only, 10 a chunk, y 0–24, stone pick), smelted | iron-ish, sets targets on fire, auto-smelts |
| 3 | Ventium (Everbright, 20 a chunk) and falsite (Everbright, 20 a chunk) | ore, smelted | utility: buckets, shears, anvil, Tool Box, falsite coating |
| Boss 1 | Summoner (Everbright), Alchemist (Everdawn) | 4 blinding keys | arcs, staffs, the Alchemy and Summoning Tables |
| 4 | **Charoite** gear | raw charoite (both, **1 vein a chunk, y 0–13, iron pick**), smelted; also rarely in Nature and Poison dungeon chests (a 5% pool, one of three items), Nightwatcher villagers (3 for 9 emeralds) | **diamond** |
| 4 | **Diopside** gear | diopside gems straight from ore (both, 1 vein a chunk, y 0–19, iron pick); dungeon and village chests | **diamond-level**, heavy weapons |
| Boss 2 | Starlit Crusher, Arachnarch | 4 nature or poison keys, after boss 1 | arcs, Crushing Hammer, Different Sword |
| (none) | Shadow armour, Infused Arc Sword, Aquatic/Life/Runic arcs | no recipe, no loot table, no code that hands them out | unfinished ("unfinished"/"unused" tooltips) |

Everything is reachable at Tier 0 today. Ores: tool levels from `minecraft:needs_stone_tool`/`needs_iron_tool` tags; veins from
`worldgen/placed_feature/ore_*.json` (read). Nothing in Blue Skies needs a diamond pick. Emerald ore is in both dimensions
too (3–8 single blocks a chunk, y 4–31, iron pick).

## (b) The numbers (read from the jar's code)

Armour: total defence / toughness / knockback resistance for a full set, pieces given as helmet/chest/legs/boots
(`SkiesArmorMaterial`; its `armorValues` takes boots, legs, chest, helmet; knockback resistance is 0 for every material). Weapons: damage, attack speed in brackets when not 1.6
(`SkiesItemTier` plus each item's registration in `SkiesItems.init`: damage = 1 + tier bonus + item base; speed = 4 +
modifier). A tool's handle stick changes its durability (x0.9 to x1.2), swing-speed penalty (x0.95 to x1.05) and thrown
damage (x0.9 to x1.1) (`data/blue_skies/blue_skies/tool_handle_types`). "Comparable" tiers are `tierOf` today.

| Gear | Armour | Weapon | Ability | Comparable, already tiered |
|---|---|---|---|---|
| Wood, comet, turquoise and lunar stone tools | | swords 4 / 4.5 / 5; axes 7 / 7.5 / 9 (0.8) | comet wood mines at stone level | vanilla wood and stone (0) |
| Pyrope | 12 / 0 / 0 (2/5/4/1, chainmail's) | sword 5.5 (2.0); axe 8.5 (1.0); tools stone level, 200 uses, efficiency 11 | none | chainmail and iron (0) |
| Aquite | 15 / 0 / 0 (2/6/5/2, iron's) | sword 6; axe 9 (0.9); tools iron level, 270 uses, enchantability 32 | none | iron (0), ironwood (0), zanite armour (0) |
| Horizonite | 12 / 0 / 0 (2/5/4/1) | sword 6; axe 9 (1.0); tools diamond level but **250 uses**, efficiency 8 | every horizonite tool sets its target alight for 3 s (`SkySwordItem.hurtEnemy`, `SkiesPlayerEvents.attackEntity`) and smelts block drops through the normal smelting recipes (`getSmeltedResult`) | iron (0); Fire Aspect I is a vanilla enchantment |
| Spears (7 woods, crafted) | | melee 4 (1.1); **thrown 8** (7.2–8.8 by handle); 250 uses | Loyalty and Piercing enchantable; a Blue Skies projectile, so not capped at 5 in its dimensions | trident (0) |
| Soulbound spear (Summoner loot) | | as spears; 450 uses | built-in Loyalty | trident (0) |
| Moonstone shield (crafted) | | | shield, 460 uses | shield, 336 uses (0) |
| **Charoite** | **20 / 8 / 0** (3/8/6/3, toughness 2 a piece, durability factor 33: diamond's) | **sword 7; axe 9 (1.0)**; tools diamond level, **1561 uses**, efficiency 8 | none: diamond's exact numbers | diamond (0); steeleaf 20/0 and 7 (4); gravitite 20/8 and 7 (4); resonarium tools 7 (4) |
| **Diopside** | **16 / 18 / 0** (2/7/5/2, **toughness 4.5 a piece**, factor 36) | **sword 9 (1.2); axe 12 (0.5)**; pickaxe 7 (1.2); shovel 7.5; tools diamond level, **1661 uses**, efficiency 6 | none. Per hit above netherite (8 sword, 10 axe); per second below diamond (sword 10.8 against 11.2; axe 6 against 9). The armour stops less than diamond's under ordinary hits (a 20-damage hit: 9.7 taken against diamond's 8.0) and about the same at 40 | diamond (0); netherite 20/12/0.4 and 8 (5); gravitite (4); zanite sword (5) |
| Shadow armour (no source) | 20 / 12 / 0 | | "unfinished"; no recipe or loot | netherite (5) |
| **Different Sword** (Arachnarch, uncommon/rare bags) | | **11**; 1000 uses | every hit gives the **target** Regeneration IV for 2 s (`SkySwordItem.hurtEnemy`, `MobEffects.REGENERATION`, 40 ticks, amplifier 3) | netherite 8 (5); zanite sword up to 13 (5); fiery 8 (6); warden 9 (7) |
| **Crushing Hammer** (Starlit Crusher, uncommon/rare) | | **12 (0.7)**; 250 uses | charged slam: **6 damage to everything within 7 blocks** across (1 up or down), thrown up; 4 s cooldown | Aether dungeon loot (unsealed) |
| Spike Shield (Alchemist loot) | | 6 (1.2) | a shield too; 850 uses | shield (0) |
| Venom Sac / Alchemy Scroll / Summoning Tome (boss loot) | | | charged venom spit / a line of falling spikes, 4 s cooldown / a projectile or an Artificial Golem ally (a 60 s cooldown is in its code); 250 uses each (projectile damage not read) | EvilCraft necromancer staff (2), Reliquary staffs (6) |
| Infused Arc Sword (no source) | | 9; 900 uses (+0.7 a stored hit up to 30, partly read) | no recipe, loot or code path gives it | |
| **Arcs** (boss loot; Blue Skies' own arc slots) | | | **Ethereal** +10/15/20% speed; **Dusk** invisible while sneaking; **Nature** 2/4/6 HP of extra health that soaks damage first and refills 1 HP a 10 s out of combat; **Poison** +1/2/3 attack damage while poisoned (common/uncommon/rare; the fourth level needs the unobtainable Runic arc) | heart canisters (0); the Aether's life shards and invisibility cloak (loot, unsealed) |

Read in: `EtherealArcItem` (`MULTIPLY_TOTAL` 0.1/0.15/0.2/0.25), `NatureArcItem` (`(level + 1) x 2`, every 200 ticks) and
`SkiesPlayerEvents.onPlayerHurt` (nature health absorbs damage), `DuskArcItem`, `PoisonArcItem` (+1/+2/+3 `ADDITION`),
`ArcItem.getFunctionalLevel`, the loot function `blue_skies:set_arc_rarity` (0–2).

**Where things are worn.** Blue Skies armour goes in the vanilla armour slots. **Arcs go in Blue Skies' own four arc slots**
(`capability/ArcInventory`, `SIZE = 4`, saved in the player's Blue Skies capability; its screen is titled "Arcs"; the client
GUI wasn't read), **not Curios**: Blue Skies doesn't depend on Curios (`META-INF/mods.toml`: forge, minecraft, structure_gel). No other
worn accessories, set bonuses or armour abilities exist: `SkyArmorItem` only adds the falsite durability bar and the
"unfinished" tooltip, and no event code reads an armour set (read: grep of every class for the armour items).

## (c) Proposed tiers (cohesive with what's already tiered)

| What | Tier | Why |
|---|---|---|
| The Everbright and the Everdawn | open | as the Aether and the Otherside; Blue Skies' own penalty keeps outside gear weak there whatever the tier |
| Wood, comet and stone tools; **pyrope**, **aquite** and **horizonite** armour and tools; spears; moonstone shield; ventium shears and bucket; Zeal Lighter; astrolabe; Tool Box; Horizonite Forge; Snowcap Oven; Bag of Spoils; keys; every gem, ingot and ore | 0 | wood to iron-equivalent, like ironwood and zanite (horizonite mines at diamond level but has 250 uses; the vanilla diamond pickaxe is already 0) |
| **Charoite armour and tools** | **4** | diamond's exact numbers. Modded diamond-equivalent gear sits at 4 even without powers (resonarium tools), with steeleaf and gravitite. *Alternative: 0, since it is no stronger than vanilla diamond (0).* Sealing it means Blue Skies' second bosses are fought in iron-level Blue Skies gear until Tier 4, as the Aether's later dungeons are before gravitite |
| **Diopside armour and tools** | **4** | diamond-level overall (armour a little under diamond; tools 1661 uses at level 3) |
| *Option:* diopside sword and axe | 5 | if per-hit burst matters (the arena's own-gear matches): 9 and 12 a hit beat netherite's 8 and 10, the zanite sword's reason for 5, though both are slower than diamond per second |
| Boss loot: arcs, Different Sword, Crushing Hammer, Venom Sac, Alchemy Scroll, Summoning Tome, soulbound spear, spike shield, Summoning Table, trophies, trim templates, discs | not sealed | loot only, as Twilight's and the Aether's boss rewards are (none has a recipe) |
| *Option:* Different Sword | 5 | the strongest Blue Skies weapon (11 a hit); a looted copy can only be held by `WIELD_LOCKS`. By precedent it stays open |
| **Alchemy Table** (Alchemist loot only) | **3, with a place lock** (recommended) | it's the job site of Blue Skies' Alchemist villager, who sells blaze rods, and it turns redstone into glowstone and sand into soul sand: Nether things before the Nether (see leaks 1 and 2). It has no recipe, so a tier only acts through `PLACE_LOCKS` |
| Shadow armour, Infused Arc Sword, Aquatic/Life/Runic arcs, debug sword | not sealed | no survival source in 1.3.31. Shadow armour (20/12) would be netherite-like if a later version hands it out: re-check then |
| Soul fragments, keys, Blue Journal and the other materials | not sealed | no gear power of their own |

The gems themselves (`blue_skies:charoite`, `blue_skies:diopside_gem`) are better left open: they're in Blue Skies' own tags
only (`blue_skies:gems/*`, plus the generic `forge:gems`), no other mod's recipe uses them, and they also make the Zeal
Lighter, Blue Skies' enchanting table and jukebox recipes, blocks and trades. The ore drops diopside gems directly, so sealing
`diopside_gem` would only remove the block and silk-touch smelting recipes anyway.

## (d) Item ids and locks

**Tier 4 `items` (18):**
```js
'blue_skies:charoite_helmet', 'blue_skies:charoite_chestplate', 'blue_skies:charoite_leggings', 'blue_skies:charoite_boots',
'blue_skies:charoite_sword', 'blue_skies:charoite_pickaxe', 'blue_skies:charoite_axe', 'blue_skies:charoite_shovel',
'blue_skies:charoite_hoe',
'blue_skies:diopside_helmet', 'blue_skies:diopside_chestplate', 'blue_skies:diopside_leggings', 'blue_skies:diopside_boots',
'blue_skies:diopside_sword', 'blue_skies:diopside_pickaxe', 'blue_skies:diopside_axe', 'blue_skies:diopside_shovel',
'blue_skies:diopside_hoe',
```
**Tier 4 `recipes` (insurance, see leak 4):** `/^blue_skies:(charoite|diopside)_(sword|pickaxe|axe|shovel|hoe)$/` (the tool
recipes' ids equal the item ids: `data/blue_skies/recipes/diopside_sword.json` and so on).

**Tier 3 `items` (recommended):** `'blue_skies:alchemy_table'`, and the same id in **`PLACE_LOCKS`**.

**`WEAR_LOCKS` (8):** the four charoite and four diopside armour pieces.
- Needed: **diopside** armour. Blue Skies swaps it into the trades of vanilla armorers living in Blue Skies villages (in place
  of their enchanted diamond armour; `SkiesTradeModifiers.replaceOffers`, read), so it can be bought.
- Charoite armour has no loot or trade source found; listed for the same reason the warden armour is (any copy is held).

**`WIELD_LOCKS` (10):** the five charoite and five diopside tools.
- Needed: `charoite_sword` and `charoite_axe` (Blue Skies-village weaponsmiths, in place of diamond sword and axe);
  `diopside_pickaxe`, `_axe`, `_shovel`, `_hoe` (toolsmiths, in place of diamond tools); `charoite_shovel` and `diopside_shovel`
  (the Shoveler: 10 emeralds and a charoite, or 5 and a gem, enchanted at level 17 or 12; `SkiesVillagerTrades$ToolWithFalsiteTrade`).
- `charoite_pickaxe`, `charoite_hoe` and `diopside_sword` have no trade or loot source found; listed for consistency.
- With the options: add `diopside_sword`/`diopside_axe` at Tier 5 instead, and `blue_skies:different_sword` at Tier 5.

**`USE_LOCKS`:** none. The wield lock already refuses right-clicks with a sealed tool in either hand (tilling, stripping,
pathing), and none of the proposed sealed items acts on use otherwise.

**A slot the wear lock can't see: the arcs.** They sit in Blue Skies' own arc inventory, which is neither an armour slot nor
Curios. They aren't proposed for sealing, so nothing is needed now. If one ever is, the wear lock would need a Blue Skies hook:
`com.legacy.blue_skies.capability.SkiesPlayer.getIfPresent(player, fn, fallback)` gives the player's `ISkiesPlayer`, whose
`getArcInventory()` is a 4-slot `Container` (read; not tried from KubeJS, and whether emptying a slot that way also calls the
arc's `onUnequip` to remove its speed or damage bonus wasn't checked).

**Rank check:** the armour recipes are plain `minecraft:crafting_shaped`, so they get the Potato War rank check at Tier 4. The
tool recipes are Blue Skies' own types (`blue_skies:diopside_sword`...), which `stageCrafting` (crafting_shaped/shapeless only)
and `CONVERT_RECIPE_TYPES` don't cover, and whose JSON has no pattern to rebuild from. So once Tier 4 opens, the tools can be
crafted without the rank (catch-up opens them to everyone at Tier 6 anyway). Closing it would mean removing those 10 recipes
and adding KubeJS shaped ones (pattern from `ToolRecipe$RecipeShapes`, gem plus stick); the stick choice that Blue Skies
copies into the tool would be lost.

## (e) Leaks and risks

1. **Blaze rods before the Nether.** Blue Skies' Alchemist *villager* (a profession; its job site is the Alchemy Table) sells
   **3 blaze rods for 1 emerald at novice level** (read: `SkiesVillagerTrades.ALCHEMIST_OFFERS`; `Items.BLAZE_ROD` resolved from
   the mappings). The table comes only from the Alchemist boss's bag (60–100% chance of 0–3 picks among four items) and is in no
   structure (all of Blue Skies' structure files searched: villages have the Stargazer's star emitter, the Wrangler's trough, the
   Nightwatcher's bag of spoils and one Shoveler's tool box, but no alchemy or summoning table). The Alchemist boss is open at
   Tier 0, so blaze rods (brewing, blaze powder) arrive before Tier 3. Blaze rods were already taken out of the Transmutation
   Table for this reason. **Closing it:** the Alchemy Table at Tier 3 with a place lock (above). Whether any villager type can
   take the profession, outside Blue Skies too, wasn't checked (no type restriction was found in `VillagerHooks`).
2. **The Alchemy Table's conversions are invisible to KubeJS.** They're Blue Skies' own data
   (`data/blue_skies/blue_skies/alchemy_recipes/*.json`, types `blue_skies:transmute` and `blue_skies:catylist`), not Minecraft
   recipes, so no recipe lock reaches them. Nether and End materials they make: **glowstone dust from redstone** (and back),
   nether brick(s) from brick(s), **soul sand from sand** and **soul soil from dirt** (each with a soul fragment, which
   Everbright frost spirits and polargeists drop), netherrack from stone (with a nether wart), blackstone from netherrack, crimson
   and warped swaps; end stone from stone needs a chorus fruit (End). Each conversion uses up one input and one catalyst
   (`AlchemyTableMenu$2.onTake`). None is sealed by id (`tierOf` 0), and glowstone already has Overworld sources (clerics,
   witches), but it's an unlimited one. The place lock in 1 closes these too; the alternative is overriding those JSON files
   from `kubejs/data/blue_skies/blue_skies/alchemy_recipes/` (how Blue Skies' loader takes an override wasn't tested).
3. **Smaller Nether items:** the Hero of the Village gift of a Blue Skies Alchemist villager is 1–2 blaze powder
   (`gameplay/hero_of_the_village/alchemist_gift.json`); the **Bag of Spoils** (fox pelts and string, Tier 0) pick-pockets any
   villager for that same gift table (`SkiesPlayerEvents.getVillagerGifts` rolls the hero gift tables), so clerics' glowstone
   too; the Snowcap Oven freezes magma blocks into netherrack (`snowcap_oven_freezing_recipes`, also Blue Skies' own data).
   Everdawn caves have magma blocks. All minor.
4. **Blue Skies' tool recipes name no result in their JSON** (`{"type":"blue_skies:diopside_sword"}`; the serializer builds
   the recipe in code). `ToolRecipe` extends `ShapedRecipe` with the tool as its result (read), so KubeJS should find it when it
   asks the recipe for its result and `event.remove({ output })` should catch it (**inferred**). `/bloodpool audit` reads results
   from the recipe JSON, so it **can't** report these if they survive. Hence the id regex in (d), and a look in JEI after the
   reload. The armour, smelting and block recipes are ordinary and get caught as usual.
5. **Trades the crafting locks can't stop** (hence the wear and wield locks): Blue Skies-village armorers, weaponsmiths and
   toolsmiths sell diopside armour and tools and charoite swords and axes; the Shoveler sells shovels up to charoite; the
   Nightwatcher sells 3 charoite for 9 emeralds. These swaps happen only in the two Blue Skies dimensions, for villagers of
   Blue Skies villager types (`SkiesTradeModifiers.replaceOffers`). Blue Skies' own professions (Stargazer, Wrangler, Shoveler,
   Nightwatcher, Summoner, Alchemist) have job sites players can place (`SkiesPoiTypes`): four are craftable (star emitter,
   trough, Tool Box, Bag of Spoils); the Summoning and Alchemy Tables are boss loot.
6. **An emerald supply.** Emerald ore in both dimensions (3–8 a chunk) plus Blue Skies villagers buying common drops. Any
   emerald trade in the pack that sells a sealed item gets cheaper; other mods' villager trades weren't audited here.
7. **The penalty is permanent and blind to tiers** (see above). Every non-Blue Skies weapon does at most 7 a hit there,
   including the Anamian Axe (a diamond or netherite axe), the Syndicate Slayer (`tconstruct:mattock`) and the Deepdelver's Maul
   (netherite pickaxe, later `tconstruct:vein_hammer`), and every Pool weapon; ranged hits do at most 5. Items that are not
   `TieredItem`s and whose ids don't end in one of the 21 words escape it: e.g. the Frying Pan (`tconstruct:melting_pan`; that
   Tinkers' tools aren't `TieredItem`s is inferred), maces, staffs; so do vanilla wood, stone and gold tools. Explosions escape
   the ranged cap. Worth knowing before
   holding an event in the Everbright or Everdawn. `/blue_skies set_progression` lifts it per player.
8. **Arcs survive kit fights.** The Purge vaults the main inventory (`purge.js`, `vaultRecord`), and the arena's and the
   Shrine's kits work the same way; arcs in their own slots keep working (up to +20% speed, 6 HP of extra health, invisibility
   while sneaking). The Aether's Curios accessories have the same gap. Owner's call.
9. **Own-gear fights:** the Different Sword (11 a hit) and the Crushing Hammer (an area slam) are the strongest Blue Skies
   weapons; spears keep full thrown damage (8) where other mods' projectiles are capped. As with the sonorous staff, kits avoid it.
10. **Loot Integrations** could put Blue Skies items into Overworld chests by value. Not checked.
11. **Not a leak, checked:** no Blue Skies recipe or loot makes netherite, ender eyes, or any other mod's sealed item; its
    vanilla outputs (anvil, furnace, enchanting table with charoite, jukebox, stonecutter, cake, dyes, emeralds from its ore) are
    all Tier 0; its one netherite recipe (`gold_lol`) turns a netherite ingot *into* gold. The Horizonite Forge uses the normal
    smelting recipes (`RecipeType.SMELTING`), so sealed smelting stays sealed. The Zeal Lighter is a flint-and-steel subclass that
    also lights Nether portals in the Overworld (`shouldLightNetherPortal`); `nether_portal_whitelist.js` blocks portals at
    Forge's `PortalSpawnEvent`, so it should stop that too (inferred, not tried). Blue Skies' portable Bag of Spoils (5 slots,
    keeps its contents) adds nothing: Quark's backpack and Hexerei's satchels are already Tier 0.

## (f) What couldn't be determined

- **In game, not tried:** that `event.remove({ output })` really removes the code-built tool recipes (leak 4); that the
  wield lock's right-click refusal stops Blue Skies' shovels, hoes and axes (same mechanism as gravitite, expected to); whether
  Blue Skies' professions take any villager (Overworld ones included); how the Alchemy recipe loader treats an override file.
- **Numbers not read:** the venom spit's, alchemy spikes' and fluctuant sphere's damage, the Artificial Golem's stats, the
  falsite coating's exact number of uses (constants 5 and 30 seen in `IFalsiteItem.getMaxFalsiteUses`, formula not worked out),
  the Infused Arc Sword's full mechanics, hoe damage, the default number of uses of Blue Skies' simple trades.
- **Inferred, not read:** which boss level an arc re-summon raises to (and so whether Platinum bags happen); that a loot bag and
  a trophy drop for each player present (`dropLootBag(Player)` and `dropTrophy(Player)` take a player; the caller wasn't traced);
  KubeJS 6's matching of unknown recipe types by the recipe's own result; that Tinkers' tools aren't `TieredItem`s and that
  Tinkers' and Mekanism's armour are `ArmorItem`s (so penalised).
- **The live server's difficulty** decides boss levels and so how often the uncommon and rare bags (the only source of the
  Different Sword, Crushing Hammer, tome, scroll and venom sac) drop.
- Whether Blue Skies items exist on the live server already (`research/BLUE_SKIES.md` says it was only on the test server).
