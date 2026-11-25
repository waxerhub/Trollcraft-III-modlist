# Pass 1 — Index of the Part II pack

Built from the owner's Server Mods folder (the Part II jar set) on 2026-11-01.
Everything below comes from the jars' own `data/**` and `META-INF/mods.toml`. No mod code was run;
jars were opened read-only, only `data/**` and `META-INF/mods.toml` were extracted, and `javap` was
not needed for this pass.

## Totals

| | |
|---|---|
| Jars | **207** (591 MB) |
| Mod entries in `mods.toml` | 209 (two jars declare two mods each) |
| Jars with no `data/` payload at all | **64** (libraries, performance, client QoL) |
| Recipes | **35,682** |
| Distinct recipe types | **387** |
| Tag files | 7,413 → **4,557 distinct tags**, 169k membership rows after transitive closure |
| Loot tables | **16,796** |
| Advancements | 14,406 |
| Distinct craftable output items | **21,347** |

Part II's mod changes, confirmed against the jars:

- **Removed:** no ProjectE, no AppliedE, no TconEmc jar is present. (`appliede:emc_module` still appears
  in the old pack's `PROGRESSION_GATES.md`; it is gone from this jar set.)
- **Added and present:** `twilightforest-1.20.1-4.3.2508`, `iceandfire-2.1.13-1.20.1-beta-5`,
  `ars_nouveau-1.20.1-4.12.7`, `taiga-1.20.1-forge-2.0.0-port.5`, `tinker_rapier-1.0.1-1.20.1`.
  TAIGA sits **alongside** `TConstruct-1.20.1-3.11.2.166` + `Mantle` + `TCIntegrations` +
  `TinkersLevellingAddon` — it is an alloying addon, not a replacement.
- **Not present:** no Nether structure mod (MNS). `MoogsSoaringStructures`, `MoogsStructureLib` and
  `lootintegrations_moog` are in, so if MNS is added later only its own structures and loot tables need
  re-checking, not the tiers' crafting locks.

## The single most important finding for `blood_pool.js`

**`unlocks.mods` entries are matched as item/recipe *namespaces*, not Forge mod ids.** The engine does

```js
event.remove({ output: '@' + m })   // m is matched against the OUTPUT ITEM's namespace
event.remove({ mod: m })            // m is matched against the RECIPE ID's namespace
```

and `tierOf()` reads `MOD_TIER[id.split(':')[0]]` — the item's namespace again. Where a jar's mod id
and its item namespace differ, listing the mod id locks **nothing**.

In this pack that is true for the whole Thermal Series and a few others:

| Jar / mod id in `mods.toml` | Namespace you must actually list |
|---|---|
| `thermal_foundation`, `thermal_expansion`, `thermal_dynamics`, `thermal_innovation`, `thermal_integration` | **`thermal`** (one namespace for all five jars) |
| `ExtremeReactors2` → mod id `bigreactors` | `bigreactors` (and it also injects compat recipes into `thermal`) |
| `Nether Ores Plus+` → mod id `netheroresplus` | its recipes are in the `netheroresplus` id namespace but output **`minecraft:` items**, so only `{mod:'netheroresplus'}` bites, not `output:'@netheroresplus'` |
| `MekanismGenerators`, `MekanismTools` | `mekanismgenerators`, `mekanismtools` — these do match, listed only because people forget they are separate from `mekanism` |

Mod ids in the pack that **never appear as an item namespace**, so `mods: ['<that id>']` would be a
no-op: `thermal_foundation thermal_expansion thermal_dynamics thermal_innovation thermal_integration
brandonscore mantle cucumber cyclopscore zerocore mcjtylib cofh_core` plus every library and QoL jar.
(`cofh_core` does own a few recipe types but no items.)

Conversely, namespaces that exist in recipe outputs but are **not** any installed mod's id — these come
from `forge:conditional` compat recipes for mods that are *not* in the pack, and are inert:
`aether appflux astralsorcery atmospheric autumnity betterendforge biomesoplenty biomeswevegone byg
ceramics druidcraft dyenamics endergetic environmental exnihilosequentia ftbic galosphere
hauntedharvest ic2 ilikewood infernalexp integrateddynamics malum megacells neapolitan netherexp
oreganized pneumaticcraft powah refinedstorage silentgear silentgems simplefarming the_vault
upgrade_aquatic vampirism`. Two of those namespaces **are** real here and must not be mistaken for
compat stubs: **`thermal`** and **`ironchest`**.

## Cross-namespace recipe injection

Jars that write recipes into a namespace that is not their own mod id. These matter because the
`{mod: m}` half of the lock keys off the **recipe id**, so a sealed mod's recipes can live in another
jar's file and an open mod's recipes can live under the sealed mod's namespace.

| Jar | injects recipe ids into |
|---|---|
| `thermal_foundation`, `thermal_expansion`, `thermal_dynamics`, `thermal_innovation`, `thermal_integration` | `thermal` |
| `ExtremeReactors2` | `thermal` |
| `createaddition`, `create_aquatic_ambitions`, `createdeco`, `sliceanddice` | `create` |
| `createappliedkinetics` | `ae2` — it **overrides `ae2:inscriber/silicon_press`** and the other press recipes |
| `alexsdelight` | `alexsmobs` |
| `Quark`, `bibliocraft`, `iceandfire`, `pamhc2foodcore` | `minecraft` |
| `ironchest` | `ironchest` (its `mods.toml` has a typo — `[[dependenciesironchest]]` instead of `[[dependencies.ironchest]]`, which makes naive parsers read its mod id as `forge`) |

Items produced **outside their own namespace** is the bigger leak, and the two worst offenders are
visible straight from the index:

- **`MysticalAgriculture` outputs items in 26 namespaces**: `ae2 alexscaves astralsorcery bigreactors
  bluepower botania chisel create createaddition createbigcannons draconicevolution enderio iceandfire
  immersiveengineering integrateddynamics mekanism minecraft mysticalagriculture patchouli
  pneumaticcraft powah redstone_arsenal refinedstorage tcintegrations tconstruct thermal twilightforest`.
  Every one of those is a potential tier bypass; pass 3 enumerates them.
- **`TConstruct` outputs items in 21 namespaces** (its smeltery melts and casts other mods' metals):
  `agricraft alexscaves bigreactors bluepower botania ceramics cofh_core create createaddition
  createbigcannons enderio farmersdelight ftbic iceandfire immersiveengineering mekanism minecraft
  tcintegrations tconstruct thermal twilightforest`.
- `thermal_integration` likewise makes `tconstruct:`, `mekanism:` and other mods' ingots.

## Recipe types pack-wide

387 distinct types. The lock has to remove in **all** of them, and the heavyweights are not the
crafting table:

`minecraft:crafting_shaped` 9424 · `minecraft:crafting_shapeless` 4160 · `forge:conditional` 3821 ·
`minecraft:stonecutting` 3401 · `mekanism:sawing` 1804 · `hexerei:woodcutting` 1066 ·
`mekanism:painting` 976 · `tconstruct:melting` 687 · `tconstruct:casting_table` 628 ·
`thermal:press` 366 · `minecraft:smelting` 364 · `tconstruct:material` 313 · `mekanism:crushing` 312 ·
`farmersdelight:cutting` 309 · `cucumber:shaped_no_mirror` 278 · `mekanism:enriching` 252 ·
`create:milling` 241 · `minecraft:blasting` 237 · `thermal:insolator` 232 · `create:crushing` 226 ·
`tconstruct:casting_basin` 208 · `tconstruct:damagable_melting` 207 · `mysticalagriculture:infusion` 192 ·
`botania:mana_infusion` 139 · `tconstruct:ore_melting` 136 · `mysticalagriculture:reprocessor` 136 ·
`thermal:smelter` 108 · `immersiveengineering:crusher` 108 · `thermal:pulverizer` 102 ·
`immersiveengineering:metal_press` 97 · `immersiveengineering:arc_furnace` 78 ·
`ars_nouveau:enchanting_apparatus` 75 · `enderio:sag_milling` 65 · `tconstruct:alloy` 50 ·
`draconicevolution:fusion_crafting` 39 · `twilightforest:crumble_horn` 36 ·
`twilightforest:transformation_powder` 16 · `botania:orechid` 16 · `botania:orechid_ignem` 3 ·
`iceandfire:dragonforge` 3 · `twilightforest:uncrafting` 2 (switched off by config).

Two quirks worth knowing: **147 recipes use the bare type `crafting_shaped`** and 65 use
`crafting_shapeless` (no `minecraft:` prefix) — chiefly in Ice and Fire and Pam's HarvestCraft. They
still work in game, and `event.remove({output: ...})` still catches them, but a type-based filter would
miss them.

## What the index files are

All in `research/index/`. Large ones are gzipped; `research/tools/q.sh` reads either form.

| File | Columns | What it answers |
|---|---|---|
| `mods.tsv` | jar, modid, name, version, deps | the mod inventory |
| `counts.tsv` | jar, namespaces, recipes, tags, loot_tables, advancements, other | per-jar payload size |
| `recipes.tsv` | recipe_id, jar, type, outputs, item inputs, tag inputs | one row per recipe |
| `by_output.tsv` | output, recipe_id, type, jar | **what makes X** (raw; tag outputs stay as `#tag`) |
| `by_output_resolved.tsv` | output, via_tag, recipe_id, type, jar | **what makes X**, tags expanded to members |
| `by_ingredient.tsv` / `_resolved.tsv` | input, …, recipe_id, type, jar | **what X feeds into** — the inverse, for bypass hunting |
| `tags.tsv` | tag (`ns:kind/path`), jar, replace, member | raw tag files, one row per member |
| `tag_members.tsv` | kind, tag (`ns:path`), jar, member | tags with nested tags flattened |
| `loot.tsv` | loot_table, jar, entry | which loot tables can yield which item (`table:` = a reference, `#` = a tag entry, `dynamic:` = block-entity contents) |
| `unparsed_recipes.tsv` | recipe_id, jar, type | the 1,428 recipes with no item output (see below) |

Tools in `research/tools/`:

- `Indexer.java` — single-file Java 17 indexer (hand-written JSON parser, `java.util.zip` not needed
  because the jars are pre-extracted). `javac -d classes Indexer.java && java -cp classes Indexer <jarsRoot> <outDir>`.
- `resolve.pl` — builds `tag_members.tsv` and the two `_resolved` views. `perl resolve.pl research/index`
- `q.sh` — the query helper. `bash research/tools/q.sh makes mekanism:steel_casing`

Useful queries:

```bash
bash research/tools/q.sh makes  tconstruct:cobalt_ingot   # every route to an item, cross-mod included
bash research/tools/q.sh uses   mekanism:steel_casing     # everything that consumes it
bash research/tools/q.sh outns  thermal                   # every recipe that outputs a thermal item
bash research/tools/q.sh ns     thermal                   # every recipe whose id is thermal:*
bash research/tools/q.sh tag    forge:ingots/steel        # tag members
bash research/tools/q.sh loot   draconicevolution:dragon_heart
```

## Verification done

- **Recipe counts match the jars.** For eight sampled jars the indexed recipe count equals
  `unzip -l <jar> | grep -cE '^data/[^/]+/recipes?/.*\.json$'`: Botania 1302, Mekanism 4223, Create 1766,
  TConstruct 2950, Twilight Forest 444, Ars Nouveau 635, Ice and Fire 413, TAIGA 789.
- **Extraction is complete.** 207 of 207 jars extracted; 86,392 files, 83,397 JSON. Botania's extracted
  file count (3,379) equals its `data/` entry count in the jar listing exactly.
- **Outputs spot-checked against raw JSON** for `mekanism:steel_casing`, `botania:terrasteel_ingot`,
  `tconstruct:cobalt_ingot`, `ae2:silicon_press`, `tconstruct:smeltery/casting/metal/cobalt/ingot_gold_cast`
  (tag output `#forge:ingots/cobalt`, correctly resolved) and `tconstruct:tools/materials/casting/cobalt`
  (a `tconstruct:material_fluid` whose "output" is the **material id** `tconstruct:cobalt`, not an item).
- **No silent skips**: every jar is either indexed or listed below as having no `data/` payload.

### The 1,428 recipes with no item output

Not a parse failure — these types genuinely produce something that is not an item stack, and none of
them can hand a player a sealed item:

`tconstruct:material` 313 (material stat definitions) · `tconstruct:modifier_salvage` 176 ·
`ars_nouveau:enchantment` 96 · `rftoolsutility:spawner` 70 · `ae2:matter_cannon` 68 (ammo values) ·
`enderio:enchanting` 41 · `mysticalagriculture:enchanter` 39 · `forge:conditional` 37 (wrappers whose
inner recipe is for an absent mod) · `twilightforest:crumble_horn` 36 (block→block) ·
`mysticalagriculture:soul_extraction` 36 · `reliquary:infernal_tear_value` 32 ·
`ars_nouveau:caster_tome` 27 · `mekanism:rotary` 20 (gas↔fluid) · `botania:brew` 20 ·
`mysticalagriculture:soulium_spawner` 19 · `quark:smithing_rune` 18 ·
`twilightforest:transformation_powder` 16 (mob→mob) · plus ~30 smaller fuel, salvage and
repair types. Pass 3 checks `crumble_horn`, `transformation_powder`, the enchanter types and the
`forge:conditional` remainder individually.

## Jars with no `data/` payload (64)

Nothing in these can be locked by recipe, and nothing in them needs a tier. Libraries, performance and
client-side QoL:

`accessories` (7 tag files only) `addonslib` `adlods` `ae2ct` `agricreatecompat` `almostunified`
`appleskin` `bcc` `betterfpsdist` `bfendcities` `bisecthosting` `brandonscore` `chunky` `cloth_config`
`clumps` `configured` `connectivity` `corpse` `cosmeticarmorreworked` `craftedcore` `craftingtweaks`
`craterlib` `creativecore` `cryonicconfig` `cupboard` `dragonfight` `fastleafdecay` `ferritecore`
`forgeendertech` `fragmentum` `ftblibrary` `ftbranks` `fusion` `geckolib` `guideme`
`inventoryessentials` `inzhefopcore` `jade` `jadeaddons` `jei` `jei_mekanism_multiblocks` `jeresources`
`journeymap` `kotlinforforge` `mcjtylib` `mezz_config` `modernfix` `mru` `netherportalfix`
`nochatreports` `playeranimator` `polyeng` `polymorph` `rechiseledae2` `remorphed` `resourcefulconfig`
`rhino` `ritchiesprojectilelib` `sdlink` `spark` `stalapi` `supermartijn642configlib` `thejokebook`
`voicechat` `worldedit` `yungsapi` `zerocore`

Note `dragonfight` and `bfendcities` ship no data but **do** change the Ender Dragon fight and End
cities at runtime — pass 3 flags the Dragon Heart drop as unverifiable from data alone.

## Full mod inventory

Blank "Item ns" / "Recipe-id ns" means the same as the mod id. "Needs" lists mandatory dependencies
other than `forge` and `minecraft`.

| Jar | mod id | Name | Version | Item ns | Recipe-id ns | Recipes | Tags | Loot | Adv | Needs |
|---|---|---|---|---|---|---|---|---|---|---|
| `accessories-neoforge-1.0.0-beta.48+1.20.1` | `accessories` | Accessories | 1.0.0-beta48+1.20.1 |  |  |  | 7 |  |  | cloth_config |
| `addonslib-forge-1.20.1-1.11` | `addonslib` | AddonsLib | 1.20.1-1.11 |  |  |  |  |  |  |  |
| `AdLods-1.20.1-8.1.12.0-build.2294` | `adlods` | Large Ore Deposits | 8.1.12.0 |  |  |  | 11 |  |  | forgeendertech |
| `AdvancedAE-1.3.6-1.20.1` | `advanced_ae` | Advanced AE | 1.3.6-1.20.1 | `advanced_ae,ae2,appflux,megacells` |  | 99 | 26 | 16 | 65 | ae2 |
| `ae2ct-1.20.1-1.1.1` | `ae2ct` | ae2CraftingTree | 1.20.1-1.1.1 |  |  |  |  |  |  |  |
| `ae2insertexportcard-1.20.1-1.3.0` | `ae2insertexportcard` | AE2 Insert Export Card | ${file.jarVersion} |  |  | 2 |  |  |  | ae2 |
| `ae2wtlib-15.3.3-forge` | `ae2wtlib` | AE2WTLib | 15.3.3-forge |  |  | 11 | 1 |  | 10 | ae2, cloth_config, architectury, curios |
| `AEAdditions-1.20.1-5.1.1` | `ae2additions` | AE Additions | 5.1.1 |  |  | 111 |  |  | 59 | ae2 |
| `AgriCraft-forge-1.20.1-4.0.6` | `agricraft` | AgriCraft | 4.0.6 | `agricraft,minecraft` |  | 19 | 54 |  | 18 | resourcefulconfig |
| `agricreatecompat-1.20.1-1.0.0` | `agricreatecompat` | AgriCraft Create Compatibility | 1.0.0 |  |  |  |  |  |  | agricraft, create |
| `alexscaves-2.0.2` | `alexscaves` | Alex's Caves | 2.0.2 | `alexscaves,minecraft` |  | 467 | 213 | 407 | 146 |  |
| `alexsdelight-1.5` | `alexsdelight` | Alex's Delight | 1.5 | `alexsdelight,alexsmobs,farmersdelight` | `alexsdelight,alexsmobs` | 40 | 2 | 2 |  |  |
| `alexsmobs-1.22.9` | `alexsmobs` | Alex's Mobs | 1.22.9 | `alexsmobs,minecraft` |  | 84 | 256 | 139 | 106 |  |
| `almostunified-forge-1.20.1-0.11.0` | `almostunified` | AlmostUnified | 1.20.1-0.11.0 |  |  |  |  |  |  |  |
| `appleskin-forge-mc1.20.1-2.5.1` | `appleskin` | AppleSkin | ${file.jarVersion} |  |  |  |  |  |  |  |
| `applied-botanics-forge-1.5.2` | `appbot` | Applied Botanics | 1.5.2 |  |  | 12 | 2 | 1 | 12 | ae2, botania |
| `Applied-Mekanistics-1.4.3` | `appmek` | Applied Mekanistics | 1.4.3 |  |  | 11 | 1 |  | 11 | mekanism |
| `appliedcooking-4.0.0` | `appliedcooking` | Applied Cooking | 4.0.0 |  |  | 1 | 1 | 1 |  | ae2, cookingforblockheads, sebastrnlib |
| `appliedenergistics2-forge-15.4.11` | `ae2` | Applied Energistics 2 | 15.4.11 | `ae2,minecraft` |  | 487 | 67 | 104 | 408 | guideme |
| `architectury-9.2.14-forge` | `architectury` | Architectury | 9.2.14 |  |  |  |  |  |  |  |
| `ars_nouveau-1.20.1-4.12.7-all` | `ars_nouveau` | Ars Nouveau | ${file.jarVersion} | `ars_nouveau,minecraft` |  | 635 | 160 | 174 | 314 | curios, geckolib |
| `balm-forge-1.20.1-7.3.44` | `balm` | Balm | 7.3.44 |  |  |  | 31 |  |  |  |
| `baubley-heart-canisters-1.20.1-1.2.0` | `bhc` | Baubley Heart Canisters | ${file.jarVersion} | `bhc,minecraft` |  | 30 | 3 |  |  |  |
| `bellsandwhistles-0.4.5-1.20.x-Create6.0+` | `bellsandwhistles` | Create: Bells & Whistles | 0.4.3-1.20.x |  |  | 53 | 2 | 36 |  | create |
| `bettercombat-forge-1.9.0+1.20.1` | `bettercombat` | Better Combat | 1.9.0+1.20.1 |  |  |  |  |  |  | playeranimator, cloth_config |
| `BetterCompatibilityChecker-forge-4.0.8+mc1.20.1` | `bcc` | Better Compatibility Checker | 4.0.8 |  |  |  |  |  |  |  |
| `betterfpsdist-1.20.1-6.0` | `betterfpsdist` | betterfpsdist mod | ${file.jarVersion} |  |  |  |  |  |  | cupboard |
| `bfendcities-1.0` | `bfendcities` | Big F&$%ing End Cities | ${file.jarVersion} |  |  |  |  |  |  |  |
| `BHStats_Forge_1.20+` | `bisecthosting` | BisectHosting | 1.20-1.0.6 |  |  |  |  |  |  |  |
| `bibliocraft-1.20.1-1.3.1` | `bibliocraft` | BiblioCraft Legacy | 1.20.1-1.3.1 | `bibliocraft,minecraft` | `bibliocraft,minecraft` | 1490 | 66 | 947 |  |  |
| `bluepower-1.20.1-0.10.323-alpha-universal` | `bluepower` | Blue Power | 0.10.323-alpha | `bluepower,minecraft` |  | 300 | 61 | 25 | 4 |  |
| `Bookshelf-Forge-1.20.1-20.2.15` | `bookshelf` | Bookshelf | 20.2.15 |  |  |  | 31 |  |  |  |
| `Botania-1.20.1-456-FORGE` | `botania` | Botania | ${file.jarVersion} | `botania,minecraft` |  | 1302 | 293 | 827 | 857 | patchouli, curios |
| `BrandonsCore-1.20.1-3.2.1.302-universal` | `brandonscore` | Brandon's Core | 3.2.1.302 |  |  |  |  |  |  | codechickenlib |
| `bygonenether-1.3.2-1.20.x` | `bygonenether` | Bygone Nether | 1.3.2 | `bygonenether,minecraft` |  | 58 | 20 | 29 | 9 |  |
| `caelus-forge-3.2.0+1.20.1` | `caelus` | Caelus API | 3.2.0+1.20.1 |  |  |  | 1 |  |  |  |
| `ChanceCubes-1.20.1-5.0.2.489` | `chancecubes` | Chance Cubes | ${file.jarVersion} |  |  | 6 | 3 | 1 |  |  |
| `ChickenChunks-1.20.1-2.10.0.100-universal` | `chickenchunks` | ChickenChunks | 2.10.0.100 |  |  | 2 | 1 | 2 |  | codechickenlib |
| `chisel-forge-2.0.0+mc1.20.1` | `chisel` | Chisel Reborn | 2.0.0+mc1.20.1 |  |  | 1 | 6 | 1293 |  | architectury, cryonicconfig |
| `Chunky-1.3.146` | `chunky` | Chunky | 1.3.146 |  |  |  |  |  |  |  |
| `citadel-2.6.3-1.20.1` | `citadel` | Citadel | 2.6.3 |  |  |  |  | 1 |  |  |
| `cloth-config-11.1.136-forge` | `cloth_config` | Cloth Config v10 API | 11.1.136 |  |  |  |  |  |  |  |
| `Clumps-forge-1.20.1-12.0.0.4` | `clumps` | Clumps | ${file.jarVersion} |  |  |  |  |  |  |  |
| `cmpackagepipebomb-forge-2.1.0` | `cmpackagepipebomb` | Create More: Pipe Bombs in Packages | 2.1.0 |  |  | 3 |  |  |  | create |
| `CodeChickenLib-1.20.1-4.4.0.528-universal` | `codechickenlib` | CodeChicken Lib | 4.4.0.528 |  |  |  | 34 |  |  |  |
| `cofh_core-1.20.1-11.0.2.56` | `cofh_core` | CoFH Core | 11.0.2 |  |  | 1 | 19 | 1 |  |  |
| `configured-forge-1.20.1-2.2.3` | `configured` | Configured | 2.2.3 |  |  |  |  |  |  |  |
| `connectivity-1.20.1-7.7` | `connectivity` | Connectivity Mod | ${file.jarVersion} |  |  |  |  |  |  | cupboard |
| `cookingforblockheads-forge-1.20.1-16.0.15` | `cookingforblockheads` | CookingForBlockheads | 16.0.15 |  |  | 53 | 9 | 45 |  | balm |
| `corpse-forge-1.20.1-1.0.23` | `corpse` | Corpse | 1.20.1-1.0.23 |  |  |  |  |  |  |  |
| `cosmeticarmorreworked-1.20.1-v1a` | `cosmeticarmorreworked` | CosmeticArmorReworked | 1.20.1-v1a |  |  |  |  |  |  |  |
| `craftedcore-5.8.2` | `craftedcore` | CraftedCore | 5.8.2 |  |  |  |  |  |  |  |
| `craftingtweaks-forge-1.20.1-18.2.9` | `craftingtweaks` | CraftingTweaks | 18.2.9 |  |  |  |  |  |  | balm |
| `CraterLib-Forge-1.20-3.1.3` | `craterlib` | CraterLib | 3.1.3 |  |  |  |  |  |  |  |
| `create-1.20.1-6.0.8` | `create` | Create | 6.0.8 | `ae2,aether,alexsmobs,ars_nouveau,atmospheric,autumnity,betterendforge,biomesoplenty,biomeswevegone,create,druidcraft,endergetic,environmental,exnihilosequentia,farmersdelight,galosphere,hauntedharvest,ic2,iceandfire,immersiveengineering,infernalexp,mekanism,minecraft,neapolitan,netherexp,oreganized,quark,regions_unexplored,silentgems,simplefarming,supplementaries,the_vault,thermal,vampirism` |  | 1766 | 173 | 640 | 1118 | flywheel, ponder |
| `create_aquatic_ambitions-1.20.1-6.0.8-2.0.2` | `create_aquatic_ambitions` | Create: Aquatic Ambitions | 1.20.1-2.0.2 | `create,create_aquatic_ambitions,minecraft,upgrade_aquatic` | `create,create_aquatic_ambitions` | 85 | 32 | 3 | 12 | create |
| `create_radar-0.4.6+mc1.20.1` | `create_radar` | Create: Radars | 0.4.5 |  |  | 21 | 5 | 15 |  | create |
| `create_sabers-1.20.1+2.0.3` | `create_sabers` | Create Sabers | 2.0.3 | `create,create_sabers` |  | 10 | 3 |  |  | create, stalapi |
| `createaddition-1.20.1-1.3.3` | `createaddition` | Create Crafts & Additions | ${file.jarVersion} | `ae2,alexscaves,bluepower,create,createaddition,immersiveengineering,mekanism,minecraft,tconstruct` | `create,createaddition` | 135 | 40 | 15 |  | create |
| `createappliedkinetics-1.5.1-1.20.1` | `createappliedkinetics` | Create Applied Kinetics | ${file.jarVersion} | `ae2,createappliedkinetics` | `ae2,createappliedkinetics` | 18 |  | 2 |  | ae2, create |
| `createbigcannons-5.11.4-mc.1.20.1-forge` | `createbigcannons` | Create Big Cannons | 5.11.4 | `createbigcannons,minecraft` |  | 150 | 103 | 163 | 72 | create, ritchiesprojectilelib |
| `createdeco-2.0.3-1.20.1-forge` | `createdeco` | Create Deco | 2.0.3-1.20.1-forge | `create,createdeco,minecraft` | `create,createdeco` | 1731 | 47 | 397 | 1717 | create |
| `CreativeCore_FORGE_v2.12.40_mc1.20.1` | `creativecore` | CreativeCore | 2.12.40 |  |  |  |  |  |  |  |
| `cryonicconfig-forge-1.0.0+mc1.20.1` | `cryonicconfig` | Cryonic Config | 1.0.0+mc1.20.1 |  |  |  |  |  |  |  |
| `Cucumber-1.20.1-7.0.16` | `cucumber` | Cucumber Library | ${file.jarVersion} |  |  |  | 2 |  |  |  |
| `cupboard-1.20.1-4.2` | `cupboard` | Cupboard utilities | ${file.jarVersion} |  |  |  |  |  |  |  |
| `curios-forge-5.14.1+1.20.1` | `curios` | Curios API | ${file.jarVersion} |  |  |  |  |  |  |  |
| `CyclopsCore-1.20.1-1.22.3` | `cyclopscore` | Cyclops Core | ${file.jarVersion} |  |  |  |  |  |  |  |
| `Draconic-Evolution-1.20.1-3.1.2.621-universal` | `draconicevolution` | Draconic Evolution | 3.1.2.621 |  |  | 179 | 56 | 51 |  | codechickenlib, brandonscore |
| `dragonfight-1.20.1-5.0` | `dragonfight` | dragonfight mod | ${file.jarVersion} |  |  |  |  |  |  | cupboard |
| `elevatorid-1.20.1-1.9.1-forge` | `elevatorid` | Elevator Mod | 1.20.1-1.9.1-forge |  |  | 32 | 2 | 16 |  |  |
| `elytraslot-forge-6.4.4+1.20.1` | `elytraslot` | Elytra Slot | 6.4.4+1.20.1 |  |  |  | 2 |  |  | curios, caelus |
| `EnderIO-1.20.1-6.2.18-beta-all` | `enderio` | Ender IO | 6.2.18-beta | `ae2,alexscaves,enderio,immersiveengineering,mekanism,minecraft` |  | 1163 | 152 | 809 | 930 |  |
| `EnderStorage-1.20.1-2.11.0.188-universal` | `enderstorage` | EnderStorage | 2.11.0.188 |  |  | 6 | 1 |  |  | codechickenlib |
| `EvilCraft-1.20.1-1.3.3` | `evilcraft + evilcraftcompat` | EvilCraft | ${file.jarVersion} | `evilcraft,minecraft` | `evilcraft,evilcraftcompat` | 184 | 51 | 51 | 12 | cyclopscore, evilcraft, cyclopscore |
| `extrautilitiesreborn-1.0.1-forge-1.20.1` | `extrautilitiesreborn` | Extra Utilities Reborn | 1.0.1 | `extrautilitiesreborn,minecraft` |  | 150 | 53 | 122 | 75 |  |
| `ExtremeReactors2-1.20.1-2.0.97` | `bigreactors` | Extreme Reactors | ${file.jarVersion} | `bigreactors,minecraft,patchouli` | `bigreactors,thermal` | 175 | 76 | 88 | 111 | zerocore |
| `factory_blocks-forge-1.4.0+mc1.20.1` | `factory_blocks` | Factory Blocks | 1.4.0+mc1.20.1 |  |  | 3 | 5 | 49 |  | architectury |
| `farmers-cutting-regions-unexplored-1.20.1-1.1b-forge` | `` |  |  | `farmersdelight,minecraft,regions_unexplored` | `fcru` | 195 |  |  |  |  |
| `FarmersDelight-1.20.1-1.3.4` | `farmersdelight` | Farmer's Delight | 1.20.1-1.3.4 | `farmersdelight,minecraft,silentgear` |  | 333 | 162 | 112 | 218 |  |
| `FastLeafDecay-32` | `fastleafdecay` | Fast Leaf Decay | 32 |  |  |  |  |  |  |  |
| `ferritecore-6.0.1-forge` | `ferritecore` | Ferrite Core | ${file.jarVersion} |  |  |  |  |  |  |  |
| `ForgeEndertech-1.20.1-11.1.11.1-build.2351` | `forgeendertech` | ForgeEndertech | 11.1.11.1 |  |  |  |  |  |  |  |
| `fragmentum-5.3.0+1.20.1-forge` | `fragmentum` | Fragmentum | 5.3.0 |  |  |  |  |  |  |  |
| `ftb-essentials-forge-2001.2.4` | `ftbessentials` | FTB Essentials | 2001.2.4 |  |  |  | 2 |  |  | ftblibrary |
| `ftb-library-forge-2001.2.13` | `ftblibrary` | FTB Library | 2001.2.13 |  |  |  |  |  |  | architectury |
| `ftb-ranks-forge-2001.1.7` | `ftbranks` | FTB Ranks | 2001.1.7 |  |  |  |  |  |  | architectury, ftblibrary |
| `fusion-1.3.16-forge-mc1.20.1` | `fusion` | Fusion | 1.3.16 |  |  |  |  |  |  |  |
| `geckolib-forge-1.20.1-4.8.4` | `geckolib` | GeckoLib 4 | 4.8.4 |  |  |  |  |  |  |  |
| `gml-4.0.11-all` | `` |  |  |  |  |  |  |  |  |  |
| `gravitygunforge-1.20.1-1.0.0` | `gravitygun` | Gravity Gun | 1.20.1-1.0.0 |  |  | 2 |  |  |  |  |
| `guideme-20.1.15` | `guideme` | GuideME | 20.1.15 |  |  |  |  |  |  |  |
| `hexerei-0.4.2.3` | `hexerei` | Hexerei | 1.20.1-0.4.2.3 | `hexerei,minecraft` |  | 1271 | 78 | 194 | 1090 |  |
| `iceandfire-2.1.13-1.20.1-beta-5` | `iceandfire` | Ice and Fire | ${file.jarVersion} | `iceandfire,minecraft` | `iceandfire,minecraft` | 413 | 128 | 173 | 362 |  |
| `idas_forge-1.13.0+1.20.1` | `idas` | Integrated Dungeons and Structures | ${file.jarVersion} |  |  | 1 | 121 | 166 | 23 | quark, create, supplementaries, integrated_api |
| `ImmersiveEngineering-1.20.1-10.2.0-183` | `immersiveengineering` | Immersive Engineering | 1.20.1-10.2.0-183 | `alexscaves,bigreactors,bluepower,create,createaddition,createbigcannons,enderio,iceandfire,immersiveengineering,mekanism,minecraft,regions_unexplored,tcintegrations,tconstruct,thermal` |  | 1109 | 280 | 307 | 625 |  |
| `integrated_api-forge-1.20.1-1.9.1` | `integrated_api` | Integrated API | 1.9.1 |  |  |  | 51 |  |  |  |
| `integrated_stronghold-1.1.2+1.20.1-forge` | `integrated_stronghold` | Integrated Stronghold | 1.1.2+1.20.1-forge |  |  | 1 | 5 | 20 | 1 | integrated_api, create, supplementaries, quark |
| `integrated_villages-1.3.2+1.20.1-forge` | `integrated_villages` | Integrated Villages | 1.3.2+1.20.1-forge |  |  |  | 67 | 153 | 13 | integrated_api, create, supplementaries |
| `inventoryessentials-forge-1.20.1-8.2.19` | `inventoryessentials` | Inventory Essentials | 8.2.19 |  |  |  |  |  |  | balm |
| `inzhefopcore-1.0.0-forge-1.20.1` | `inzhefopcore` | inzhefop's core | 1.0.0 |  |  |  |  |  |  |  |
| `ironchest-1.20.1-14.4.4` | `ironchest` | Iron Chests | 1.20.1-14.4.4 |  |  | 22 | 4 | 14 | 22 |  |
| `Jade-1.20.1-Forge-11.13.3` | `jade` | Jade | ${file.jarVersion} |  |  |  |  |  |  |  |
| `JadeAddons-1.20.1-Forge-5.5.1` | `jadeaddons` | Jade Addons | ${file.jarVersion} |  |  |  |  |  |  | jade |
| `jei-1.20.1-forge-15.62.0.219` | `jei` | Just Enough Items | 15.62.0.219 |  |  |  |  |  |  |  |
| `journeymap-forge-1.20.1-6.0.7` | `journeymap` | Journeymap | 1.20.1-6.0.7 |  |  |  |  |  |  | commonnetworking |
| `JustEnoughMekanismMultiblocks-1.20.1-4.27` | `jei_mekanism_multiblocks` | Just Enough Mekanism Multiblocks | 4.27 |  |  |  |  |  |  | jei, mekanism |
| `JustEnoughResources-1.20.1-1.4.0.247` | `jeresources` | Just Enough Resources | 1.4.0.247 |  |  |  |  |  |  | jei |
| `kotlinforforge-4.12.0-all` | `` |  |  |  |  |  |  |  |  |  |
| `kubejs-forge-2001.6.5-build.26` | `kubejs` | KubeJS | 2001.6.5-build.26 |  |  |  |  |  |  | rhino, architectury |
| `lootintegrations-1.20.1-4.7` | `lootintegrations` | Lootintegrations mod | ${file.jarVersion} |  |  |  | 1 | 7 |  | cupboard |
| `lootintegrations_moog-2.2` | `lootintegrations_moog` | lootintegrations_moog mod | 1 |  |  |  |  |  |  | lootintegrations |
| `Mantle-1.20.1-1.11.104` | `mantle` | Mantle | 1.11.104 |  |  |  | 5 |  |  |  |
| `mcjtylib-1.20-8.0.8` | `mcjtylib` | McJtyLib | ${file.jarVersion} |  |  |  |  |  |  |  |
| `mcw-bridges-3.1.2-mc1.20.1forge` | `mcwbridges` | Macaw's Bridges | 3.1.2 | `mcwbridges,minecraft` |  | 256 | 19 | 145 | 146 |  |
| `mcw-doors-1.1.5-mc1.20.1forge` | `mcwdoors` | Macaw's Doors | 1.1.5 |  |  | 257 | 33 | 239 | 12 |  |
| `mcw-mcwfences-1.2.1-mc1.20.1forge` | `mcwfences` | Macaw's Fences and Walls | 1.2.1 |  |  | 222 | 28 | 180 | 21 |  |
| `mcw-mcwstairs-1.0.2-mc1.20.1forge` | `mcwstairs` | Macaw's Stairs and Balconies | 1.0.2 |  |  | 224 | 10 | 196 | 23 |  |
| `mcw-mcwwindows-2.4.2-mc1.20.1forge` | `mcwwindows` | Macaw's Windows | 2.4.2 |  |  | 317 | 20 | 310 | 32 |  |
| `mcw-roofs-2.3.2-mc1.20.1forge` | `mcwroofs` | Macaw's Roofs | 2.3.2 |  |  | 607 | 4 | 605 | 42 |  |
| `mcw-trapdoors-1.1.5-mc1.20.1forge` | `mcwtrpdoors` | Macaw's Trapdoors | 1.1.5 |  |  | 191 | 22 | 179 | 180 |  |
| `mcwregionsunexplored-1.20.1-1.6` | `mcwregionsunexplored` | Macaw's Regions Unexplored | 1.20.1-1.6 |  |  | 3481 | 112 |  | 3481 | regions_unexplored, addonslib |
| `Measurements-forge-1.20.1-2.0.1` | `measurements` | Measurements | ${file.jarVersion} |  |  | 1 |  |  |  |  |
| `Mekanism-1.20.1-10.4.16.80` | `mekanism` | Mekanism | 10.4.16 | `ae2,biomesoplenty,byg,farmersdelight,ilikewood,mekanism,minecraft` |  | 4223 | 264 | 180 | 93 |  |
| `mekanism_weaponry-1.1.3` | `mekanism_weaponry` | Mekanism Weaponry | 1.1.3 |  |  | 26 | 2 | 1 |  | mekanism, geckolib |
| `mekanismcurios-1.20.1-1.2.1` | `mekanismcurios` | Mekanism Curios | 1.2.1 |  |  |  | 2 |  |  | mekanism, curios |
| `MekanismGenerators-1.20.1-10.4.16.80` | `mekanismgenerators` | Mekanism: Generators | 10.4.16 |  |  | 35 | 15 | 24 | 4 | mekanism |
| `MekanismTools-1.20.1-10.4.16.80` | `mekanismtools` | Mekanism: Tools | 10.4.16 | `mekanism,mekanismtools,minecraft` |  | 87 | 95 |  | 6 | mekanism |
| `mezz_config-1.20.1-forge-0.6.8` | `mezz_config` | MezzConfig | 0.6.8 |  |  |  |  |  |  |  |
| `modernfix-forge-5.27.88+mc1.20.1` | `modernfix` | ModernFix | 5.27.88+mc1.20.1 |  |  |  |  |  |  |  |
| `ModularPowersuits-Forge-1.20.1-2.3.13` | `powersuits` | MachineMuse's Modular Powersuits | 2.3.13 |  |  | 57 | 1 | 1 |  | numina |
| `MoogsSoaringStructures-universal-1.20-2.2.0` | `` |  |  |  |  |  | 15 | 22 |  |  |
| `MoogsStructureLib-forge-1.20-3.4.2` | `moogs_structures` | Moog's Structure Lib | 3.4.2 |  |  |  |  |  |  |  |
| `moonlight-1.20-2.16.36-forge` | `moonlight` | Moonlight Library | 1.20-2.16.36 |  |  |  |  |  |  |  |
| `mowziesmobs-1.8.2` | `mowziesmobs` | Mowzie's Mobs | 1.8.2 | `minecraft,mowziesmobs` |  | 12 | 56 | 26 | 16 | geckolib |
| `MRU-1.0.4+1.20.1+forge` | `mru` | Mineblock's Repeated Utilities | 1.0.4+1.20.1+forge |  |  |  |  |  |  |  |
| `MysticalAgriculture-1.20.1-7.0.24` | `mysticalagriculture` | Mystical Agriculture | ${file.jarVersion} | `ae2,alexscaves,astralsorcery,bigreactors,bluepower,botania,chisel,create,createaddition,createbigcannons,draconicevolution,enderio,iceandfire,immersiveengineering,integrateddynamics,mekanism,minecraft,mysticalagriculture,patchouli,pneumaticcraft,powah,redstone_arsenal,refinedstorage,tcintegrations,tconstruct,thermal,twilightforest` |  | 1167 | 139 | 70 |  | cucumber |
| `Nether Ores Plus+ 1.0.0 - 1.20.1` | `netheroresplus` | Nether Ores Plus+ | 1.0.0 | `minecraft` |  | 7 | 1 | 22 |  |  |
| `netherportalfix-forge-1.20-13.0.1` | `netherportalfix` | NetherPortalFix | 13.0.1 |  |  |  |  |  |  | balm |
| `NoChatReports-FORGE-1.20.1-v2.2.3` | `nochatreports` | No Chat Reports | 1.20.1-v2.2.3 |  |  |  |  |  |  |  |
| `Numina-Forge-1.20.1-2.3.13` | `numina` | Numina | 2.3.13 |  |  | 23 | 4 | 1 |  |  |
| `pamhc2foodcore-1.20.4-1.0.5` | `pamhc2foodcore` | Pam's HarvestCraft 2 - Food Core | ${file.jarVersion} | `minecraft,pamhc2foodcore` | `minecraft,pamhc2foodcore` | 199 | 196 |  | 18 |  |
| `pamhc2foodextended-1.20.4-1.0.1` | `pamhc2foodextended` | Pam's HarvestCraft 2 - Food Extended | ${file.jarVersion} | `minecraft,pamhc2foodextended` |  | 887 | 393 |  |  |  |
| `Patchouli-1.20.1-85-FORGE` | `patchouli` | Patchouli | ${file.jarVersion} |  |  |  | 2 |  |  |  |
| `player-animation-lib-forge-1.0.2-rc1+1.20` | `playeranimator` | Player Animator | 1.0.2-rc1+1.20 |  |  |  |  |  |  |  |
| `polyeng-forge-0.1.1-1.20.1` | `polyeng` | Polymorphic Energistics | 0.1.1-1.20.1 |  |  |  |  |  |  | ae2, polymorph |
| `polymorph-forge-0.49.11+1.20.1` | `polymorph` | Polymorph | 0.49.11+1.20.1 |  |  |  |  |  |  |  |
| `Quark-4.0-462` | `quark` | Quark | ${file.jarVersion} | `minecraft,quark` | `minecraft,quark` | 1602 | 255 | 835 | 29 | zeta |
| `Quark_Recipes_Unexplored_1.20.1(ver.1.0)` | `quark_recipes_unexplored` | Quark Recipes Unexplored | 1.0 | `minecraft` |  | 2 | 1 |  |  | regions_unexplored, quark |
| `rechiseled-1.2.6-forge-mc1.20.1` | `rechiseled` | Rechiseled | 1.2.6 |  |  | 1 | 271 | 3627 | 1 | supermartijn642corelib, supermartijn642configlib, fusion |
| `rechiseledae2-forge-1.20-1.20.1-1.2.0` | `rechiseledae2` | Rechiseled: AE2 | 1.2.0 |  |  |  | 2 |  |  | ae2, rechiseled |
| `rechiseledcreate-1.1.1-forge-mc1.20` | `rechiseledcreate` | Rechiseled: Create | 1.1.1 |  |  | 1 | 2 | 242 | 1 | supermartijn642corelib, rechiseled, create |
| `redstone_arsenal-1.20.1-8.0.1.24` | `redstone_arsenal` | Redstone Arsenal | 8.0.1 |  |  | 36 | 4 | 3 |  | cofh_core |
| `RegionsUnexploredForge-0.5.6+1.20.1` | `regions_unexplored` | Regions Unexplored | 0.5.6 | `minecraft,regions_unexplored` |  | 656 | 321 | 790 | 671 | terrablender |
| `reliquary-1.20.1-2.0.65.1565` | `reliquary` | Reliquary | 2.0.65.1565 | `minecraft,reliquary` |  | 226 | 6 | 70 | 66 |  |
| `remorphed-4.2` | `remorphed` | ReMorphed | 4.2 |  |  |  |  |  |  | craftedcore, walkers |
| `resourcefulconfig-forge-1.20.1-2.1.3` | `resourcefulconfig` | Resourcefulconfig | 2.1.3 |  |  |  |  |  |  |  |
| `rftoolsbase-1.20-5.0.7` | `rftoolsbase` | RFToolsBase | ${file.jarVersion} |  |  | 12 | 9 | 5 | 12 | mcjtylib |
| `rftoolsbuilder-1.20-6.0.10` | `rftoolsbuilder` | RFToolsBuilder | ${file.jarVersion} |  |  | 42 | 2 | 22 | 40 | mcjtylib, rftoolsbase |
| `rftoolsdim-1.20-11.0.11` | `rftoolsdim` | RFToolsDimensions | ${file.jarVersion} |  |  | 56 | 2 | 22 | 56 | mcjtylib, rftoolsbase |
| `rftoolsutility-1.20-6.0.7` | `rftoolsutility` | RFToolsUtility | ${file.jarVersion} |  |  | 137 | 6 | 27 | 67 | mcjtylib, rftoolsbase |
| `rhino-forge-2001.2.3-build.10` | `rhino` | Rhino | 2001.2.3-build.10 |  |  |  |  |  |  |  |
| `ritchiesprojectilelib-2.1.1-mc.1.20.1-forge` | `ritchiesprojectilelib` | Ritchie's Projectile Library | 2.1.1 |  |  |  |  |  |  |  |
| `RUExpansion-1.0.1+1.20.1` | `ru_expansion` | Regions Unexplored: Expansion | 1.0.1 |  |  |  |  |  |  | regions_unexplored |
| `sebastrnlib-4.0.0` | `sebastrnlib` | Sebastrn Lib | 4.0.0 |  |  | 1 |  |  |  | patchouli |
| `SecretRooms-1.20.1-Unofficial-20260510` | `secretroomsmod` | Secret Rooms: Reborn (1.20.1) | 20260510 |  |  | 26 | 4 | 21 | 26 |  |
| `SimpleDiscordLink-Universal-3.4.5` | `sdlink` | Simple Discord Link | 3.4.5 |  |  |  |  |  |  | craterlib |
| `simplehats-forge-1.20.1-0.4.0a` | `simplehats` | SimpleHats | 0.4.0a |  |  | 13 | 2 |  |  | accessories |
| `SkyVillages-1.0.4-1.19.2-1.20.1-forge-release` | `skyvillages` | Sky Villages | 1.0.4 |  |  |  | 1 | 12 |  |  |
| `sliceanddice-forge-3.6.0` | `sliceanddice` | Create Slice & Dice | 3.6.0 | `farmersdelight,minecraft,sliceanddice` | `create,sliceanddice` | 8 | 9 | 3 | 3 | create, kotlinforforge |
| `spark-1.10.53-forge` | `spark` | spark | 1.10.53 |  |  |  |  |  |  |  |
| `stalapi-1.20.1+1.0.4` | `stalapi` | StalApi | 1.0.4 |  |  |  |  |  |  |  |
| `supermartijn642configlib-1.1.8-forge-mc1.20` | `supermartijn642configlib` | SuperMartijn642's Config Library | 1.1.8 |  |  |  |  |  |  |  |
| `supermartijn642corelib-1.1.25-forge-mc1.20.1` | `supermartijn642corelib` | SuperMartijn642's Core Lib | 1.1.25 |  |  |  | 7 |  |  |  |
| `supplementaries-1.20-3.1.44-forge` | `supplementaries` | Supplementaries | 1.20-3.1.44 | `minecraft,quark,supplementaries` |  | 306 | 224 | 178 | 182 | moonlight |
| `suppsquared-1.20-1.1.29` | `suppsquared` | Supplementaries Squared | 1.20-1.1.29 | `supplementaries,suppsquared` |  | 39 | 15 | 51 |  | moonlight, supplementaries |
| `taiga-1.20.1-forge-2.0.0-port.5` | `taiga` | TAIGA - Tinkers Alloying Addon (Unofficial Port) | 2.0.0-port.5 |  |  | 789 | 311 | 56 |  | mantle, tconstruct |
| `TCIntegrations-1.20.1-2.0.26.0` | `tcintegrations` | TCIntegrations | 2.0.26.0 | `ars_nouveau,botania,iceandfire,malum,tcintegrations,tconstruct` |  | 288 | 62 | 1 | 4 | tconstruct |
| `TConstruct-1.20.1-3.11.2.166` | `tconstruct` | Tinkers' Construct | 3.11.2.166 | `agricraft,alexscaves,bigreactors,bluepower,botania,ceramics,cofh_core,create,createaddition,createbigcannons,enderio,farmersdelight,ftbic,iceandfire,immersiveengineering,mekanism,minecraft,tcintegrations,tconstruct,thermal,twilightforest` |  | 2950 | 802 | 342 | 411 | mantle |
| `TerraBlender-forge-1.20.1-3.0.1.10` | `terrablender` | TerraBlender | ${file.jarVersion} |  |  |  | 2 |  |  |  |
| `tesseract-1.0.39-forge-mc1.20.1` | `tesseract` | Tesseract | 1.0.39 |  |  | 1 | 1 | 1 | 1 | supermartijn642corelib, supermartijn642configlib |
| `thejokebook-0.1.0-1.20.1` | `thejokebook` | The Joke Book | 0.1.0-1.20.1 |  |  |  |  |  |  |  |
| `thermal_dynamics-1.20.1-11.0.1.23` | `thermal_dynamics` | Thermal Dynamics | 11.0.1 | `thermal` | `thermal` | 8 | 6 | 4 |  | cofh_core, thermal |
| `thermal_expansion-1.20.1-11.0.1.29` | `thermal_expansion` | Thermal Expansion | 11.0.1 | `minecraft,thermal` | `thermal` | 499 | 7 | 22 |  | cofh_core, thermal |
| `thermal_foundation-1.20.1-11.0.6.70` | `thermal_foundation` | Thermal Foundation | 11.0.6 | `minecraft,thermal` | `thermal` | 269 | 163 | 54 |  | cofh_core, thermal |
| `thermal_innovation-1.20.1-11.0.1.23` | `thermal_innovation` | Thermal Innovation | 11.0.1 | `thermal` | `thermal` | 7 | 4 |  |  | cofh_core, thermal |
| `thermal_integration-1.20.1-11.0.1.27` | `thermal_integration` | Thermal Integration | 11.0.1 | `biomesoplenty,create,dyenamics,farmersdelight,immersiveengineering,mekanism,minecraft,mysticalagriculture,quark,redstone_arsenal,refinedstorage,tconstruct,thermal` | `thermal` | 487 | 27 | 2 |  | cofh_core, thermal |
| `tinker_rapier-1.0.1-1.20.1 (1)` | `tinker_rapier` | Tinkers' Rapier | 1.0.1-1.20.1 |  |  | 13 | 17 |  |  | tconstruct |
| `TinkersLevellingAddon-1.20.1-1.4.3` | `tinkerslevellingaddon` | Tinkers' Levelling Addon | 1.4.3 |  |  | 2 |  |  |  | tconstruct |
| `ToolBelt-1.20.1-1.20.03` | `toolbelt` | Tool Belt | ${file.jarVersion} |  |  | 11 | 1 |  | 11 |  |
| `trashcans-1.1.1a-forge-mc1.20.4` | `trashcans` | Trash Cans | 1.1.1+a |  |  | 4 | 1 | 4 | 6 | supermartijn642corelib, supermartijn642configlib |
| `twilightforest-1.20.1-4.3.2508-universal` | `twilightforest` | The Twilight Forest | ${file.jarVersion} | `minecraft,twilightforest` |  | 444 | 282 | 532 | 321 |  |
| `voicechat-forge-1.20.1-2.6.22` | `voicechat + voicechat_api` | Simple Voice Chat | 1.20.1-2.6.22 |  |  |  |  |  |  |  |
| `walkers-5.8.13` | `walkers` | Walkers | 5.8.13 |  |  |  |  |  |  | craftedcore |
| `waystones-forge-1.20.1-14.1.21` | `waystones` | Waystones | 14.1.21 |  |  | 34 | 23 | 25 |  | balm |
| `worldedit-mod-7.2.15` | `worldedit` | WorldEdit | 7.2.15+6463-5ca4dff |  |  |  |  |  |  |  |
| `YungsApi-1.20-Forge-4.0.6` | `yungsapi` | YUNG's API | 1.20-Forge-4.0.6 |  |  |  |  |  |  |  |
| `YungsBetterDesertTemples-1.20-Forge-3.0.3` | `betterdeserttemples` | YUNG's Better Desert Temples | 1.20-Forge-3.0.3 |  |  |  | 3 | 10 | 3 | yungsapi |
| `YungsBetterEndIsland-1.20-Forge-2.0.6` | `betterendisland` | YUNG's Better End Island | 1.20-Forge-2.0.6 |  |  |  | 2 |  |  | yungsapi |
| `YungsBetterJungleTemples-1.20-Forge-2.0.5` | `betterjungletemples` | YUNG's Better Jungle Temples | 1.20-Forge-2.0.5 |  |  |  | 4 | 3 |  | yungsapi |
| `YungsBetterMineshafts-1.20-Forge-4.0.4` | `bettermineshafts` | YUNG's Better Mineshafts | 1.20-Forge-4.0.4 |  |  |  | 16 |  |  | yungsapi |
| `YungsBetterNetherFortresses-1.20-Forge-2.0.6` | `betterfortresses` | YUNG's Better Nether Fortresses | 1.20-Forge-2.0.6 |  |  |  | 4 | 9 | 1 | yungsapi |
| `YungsBetterOceanMonuments-1.20-Forge-3.0.4` | `betteroceanmonuments` | YUNG's Better Ocean Monuments | 1.20-Forge-3.0.4 |  |  |  | 3 | 1 |  | yungsapi |
| `YungsBridges-1.20-Forge-4.0.3` | `yungsbridges` | YUNG's Bridges | 1.20-Forge-4.0.3 |  |  |  | 5 |  |  | yungsapi |
| `YungsExtras-1.20-Forge-4.0.3` | `yungsextras` | YUNG's Extras | 1.20-Forge-4.0.3 |  |  |  | 3 | 3 |  | yungsapi |
| `ZeroCore2-1.20.1-2.1.48` | `zerocore` | Zero CORE 2 | ${file.jarVersion} |  |  |  |  |  |  |  |
| `Zeta-1.0-31` | `zeta` | Zeta | ${file.jarVersion} |  |  |  |  |  |  |  |

