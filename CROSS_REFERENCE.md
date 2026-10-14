# Trollcraft III — Progression Mod Cross-Reference

This file checks each progression mod in [PROGRESSION_MODS.md](PROGRESSION_MODS.md) against its official wiki,
GitHub repo and in-game guide. It is the source material for the step-by-step guides.

Mods are grouped here by size (major mods and smaller mods). The early–mid game (Tier 1) and end game (Tier 2)
split is in [PROGRESSION_MODS.md](PROGRESSION_MODS.md), and each mod's own stages are in [MOD_TIERS.md](MOD_TIERS.md).

## How this was checked

- **The pack's own jars come first.** Recipes, advancements, loot tables, worldgen and the in-game books were read
  straight out of the mod jars in `Trollcraft III Friendly Fire Trimmed.zip`. They match the exact versions players
  will run, so where a wiki and the jar disagree, the jar wins.
- **Official web docs second.** Wikis, docs sites and GitHub repos were opened and compared with the jar data. Each
  entry notes which Minecraft version a page covers. Many pages are written for older (1.12/1.16) or newer (1.21+)
  versions.
- **No pack overrides were available.** The zip only has the `mods/` folder (no `config/`, KubeJS or datapacks), so
  everything assumes each mod's default recipes and config. If the pack changes recipes, check JEI in-game.
- **Re-checked by hand.** The biggest corrections were confirmed directly in the recipe files: the Draconic Evolution
  cores, the MekaSuit, the Botania portal, the ProjectE condensers, the Alex's Caves biome list, the Blue Power gates,
  IE's Blast Brick, Ender IO's Grains of Infinity and Tinkers' cobalt worldgen.

### Reading the source tags

Each progression step ends with where it was confirmed:

- `[jar: data/<mod>/recipes/x.json]`: a file inside that mod's jar. Paths are relative to the jar's root.
  `thermal_core:` means the Thermal core jar, which is bundled inside Thermal Foundation
  (`META-INF/jarjar/thermal_core-1.20.1-11.0.6.24.jar`).
- `[advancement: x]`: the mod's in-game advancement tree, a good outline of intended progression.
- `[wiki]`, `[github]`, `[book]`, `[manual]`, `[lexicon]`: the official web docs, GitHub, or in-game book text.
- **(unverified)**: could not be confirmed from either source. Check in-game.

### Sites that could not be reached

- **CurseForge** blocks automated visitors with a Cloudflare check, so no CurseForge page was read. CurseForge links
  below come from the mods' own metadata or search results.
- **Fandom and wiki.gg wikis** (Alex's Caves, Alex's Mobs, Mowzie's Mobs, Draconic Evolution) were also blocked.
- **Everything else loaded**, including the Create, Thermal and Ender IO sites. None of those three has 1.20.1
  progression docs; see their entries.

---

## Quick reference

**Best 1.20.1 source** is the one to trust when writing the guide.

### Major mods

| Mod | Pack version | Best 1.20.1 source | Official web docs (and how well they fit 1.20.1) | In-game guide (how to get it) |
|-----|-------------|--------------------|---------------------------------------------------|-------------------------------|
| Create | 6.0.8 | Ponder + JEI | [Create Wiki](https://wiki.createmod.net/): changelogs and ComputerCraft pages only, no progression guide | **Ponder**: hold the Ponder key over an item (no book) |
| Mekanism | 10.4.16 | Wiki topic pages + JEI | [Mekanism wiki](https://wiki.aidancbrady.com/wiki/Main_Page): topic pages (Ore Processing, Fission, Fusion, SPS, MekaSuit) match v10; the main overview page is stale (v9) | None. Use JEI, Just Enough Mekanism Multiblocks and the advancements |
| Thermal Series | 11.0.x | In-game guidebook | [Team CoFH docs](https://teamcofh.com/docs/): stop at 1.16 ([Thermalpedia](https://teamcofh.com/docs/1.16/thermal-series/thermalpedia/)); nothing for 1.20 | **Thermal guidebook**: Book + Crescent Hammer |
| Immersive Engineering | 10.2.0 | Engineer's Manual | [GitHub wiki](https://github.com/BluSunrize/ImmersiveEngineering/wiki): from 2016, effectively empty | **Engineer's Manual**: Book + Lever |
| Ender IO | 6.2.18-beta | JEI + recipes | [GitHub](https://github.com/Team-EnderIO/EnderIO): marks 1.20.1 "Not Supported". enderio.com only links to the 1.12 wiki | None. The book in the jar is an empty placeholder |
| Applied Energistics 2 | 15.4.11 | In-game Guide | [AE2 guide, 1.20.1](https://guide.appliedenergistics.org/1.20.1/getting-started): matches the jar word for word. Pick **1.20.1** in the site's version menu | **Guide**: put a Book in a Charger, or hover over an item and press the guide key |
| RFTools | Base 5.0.7 / Dims 11.0.11 | Technology Guide | [mcjty.eu docs](https://mcjty.eu/docs/mods/rftools-dimensions): 1.20.1 config docs only, no walkthrough | **Technology Guide**: Book + 3 Iron Nuggets |
| Extreme Reactors 2 | 2.0.97 | The Extreme Book | No web wiki. The [Modrinth page](https://modrinth.com/mod/extreme-reactors) has an overview | **The Extreme Book**: Yellorium Ingot over a Book |
| Draconic Evolution | 3.1.2 | JEI + recipes | [GitHub](https://github.com/Draconic-Inc/Draconic-Evolution): wiki is empty, no official docs | None. The Information Tablet has no recipe and needs Project Intelligence (not in the pack) |
| Modular Powersuits | 2.3.13 | Tinker Table GUI + JEI | [GitHub](https://github.com/Lehjr/MachineMusePowersuits): no wiki. Modrinth has no 1.20.1 build | None |
| Botania | 1.20.1-456 | Lexica Botania | [Online lexicon](https://botaniamod.net/lexicon.html): tracks the newest dev version, may be ahead of 456 | **Lexica Botania**: Book + any sapling |
| ProjectE | PE1.0.1 | JEI + GitHub wiki | [GitHub wiki](https://github.com/sinkillerj/ProjectE/wiki): "under construction", no version stated; checked pages match | None |
| EvilCraft | 1.3.3 | Origins of Darkness | [Online book](https://evilcraft.rubensworks.net/book/): generated from the 1.21.1 build, close but not exact | **Origins of Darkness**: chest loot only (20% in many vanilla chests), no recipe |
| Mystical Agriculture | 7.0.24 | In-game book | [Blake's Mods wiki](https://blakesmods.com/wiki/mysticalagriculture): shows 26.1 content; mostly matches, but lists an Ore Infuser that 7.0.24 doesn't have | **Mystical Agriculture** book: Book + Inferium Essence |
| Tinkers' Construct | 3.11.2 | In-game books | [Slime Knights docs, 1.20 books](https://slimeknights.github.io/docs/books/): match. Avoid the Tinkers' Construct 2 (1.12) pages | **Materials and You** is given on first spawn; 5 more books are craftable |
| Alex's Caves | 2.0.2 | Cave Compendium | [Alex's Caves wiki](https://alexscaves.wiki.gg/wiki/Main_Page): blocked from here, unverified | **Cave Compendium**: Book + Cave Tablet + Gold Nugget |

### Smaller mods

| Mod | Pack version | Best 1.20.1 source | Official web docs | In-game guide |
|-----|-------------|--------------------|-------------------|---------------|
| Hexerei | 0.4.2.3 | Book of Shadows | [GitHub](https://github.com/JoeFoxe/Hexerei-1.19): no wiki | **Book of Shadows**, read on an Altar |
| Reliquary | 2.0.65 | JEI | [GitHub wiki](https://github.com/P3pp3rF1y/Reliquary/wiki): 2016–17, outdated | None |
| AgriCraft | 4.0.6 | Agricultural Journal | [agricraft.github.io](https://agricraft.github.io/): doesn't list 1.20.1 as supported | **Agricultural Journal**: Book and Quill + any AgriCraft seed |
| Extra Utilities Reborn | 1.0.1 | Item tooltips + JEI | No wiki or repo anywhere | None |
| Mowzie's Mobs | 1.8.2 | Advancements | [GitHub](https://github.com/BobMowzie/MowziesMobs); the fandom wiki was blocked | None |
| Alex's Mobs | 1.22.9 | Animal Dictionary | [GitHub](https://github.com/AlexModGuy/AlexsMobs); the fandom wiki was blocked | **Animal Dictionary**: Book + Green Dye + a mob drop |
| ~~Blue Power~~ | 0.10.323-alpha | n/a | [GitHub](https://github.com/Qmunity/BluePower) | Dropped from the guides: most of its features can't be crafted in this build |

---

## Major mods — Tech

### Create (6.0.8) + Create Crafts & Additions (1.3.3)

**References**
- GitHub repo: https://github.com/Creators-of-Create/Create. The README points to the in-game **Ponder** system as the documentation. The page shows the `mc1.21.1/dev` branch. The jar's mods.toml sets the issue tracker to this repo.
- GitHub wiki (outdated): https://github.com/Creators-of-Create/Create/wiki. The home page says the wiki "moved … to https://wiki.createmod.net/". Its sidebar has version pages from 0.0.x to 6.0.0.
- GitHub wiki, 6.0.0 changelog: https://github.com/Creators-of-Create/Create/wiki/6.0.0. It covers 1.20.1 and 1.21.1 and documents the new logistics blocks (Packager, Stock Ticker, Package Frogport, Factory Gauge). It matches the 6.0.x line.
- Official wiki: https://wiki.createmod.net/. The GitHub wiki names it as the new home. Its user section only has changelogs, development status and ComputerCraft integration pages, with no progression guide, so Ponder stays the main reference.
- CurseForge: https://www.curseforge.com/minecraft/mc-mods/create. This is the `displayURL` in the jar's mods.toml. The site was unreachable.
- Crafts & Additions GitHub repo: https://github.com/mrh0/createaddition. The README lists the features (Electric Motor, Alternator, Rolling Mill, Tesla Coil, Accumulator and others) and MC 1.16 to 1.21. It links no wiki. The page shows the 1.21.1 branch. The jar requires Create `[6.0.3,)`.
- In-game guide: Create has **no guide book**. Players use **Ponder**: hold the Ponder key while hovering over an item (default key W, unverified because the Ponder library jar wasn't extracted). C&A has no book either.

**Verified survival progression**
1. Mine **Zinc Ore** and craft **Andesite Alloy** by hand from andesite plus iron (or zinc) nuggets. [jar: create/data/create/recipes/crafting/materials/andesite_alloy.json]
2. Build the andesite-tier kinetics: Shafts, Cogwheels, **Water Wheel** or Windmill, then **Andesite Casing**, **Mechanical Press**, **Encased Fan** (fan processing) and Belts. [advancement: andesite_alloy → andesite_casing → mechanical_press → encased_fan → … → belt]
3. Add the **Mechanical Mixer** and **Basin**. Capture a blaze in an **Empty Blaze Burner** to get a **Blaze Burner** (Nether trip). [advancement: mechanical_mixer → burner; jar: recipes/crafting/kinetics/empty_blaze_burner.json]
4. Copper tier: **Copper Casing**, pumps and pipes, Spout and Item Drain, then **Steam Engine** power on a Fluid Tank boiler. [advancement: copper → copper_casing → spout → drain → steam_engine]
5. Make **Brass Ingot** by heated mixing of copper and zinc, which needs a Blaze Burner under the Basin. Then craft **Brass Casing**. [jar: recipes/mixing/brass_ingot.json ("heatRequirement":"heated"); advancement: brass → brass_casing]
6. Craft **Rose Quartz** and **Polished Rose Quartz**, then **Electron Tube**, then the **Deployer**. [advancement: rose_quartz → deployer; jar: recipes/crafting/materials/electron_tube.json]
7. Make the **Precision Mechanism** by Sequenced Assembly: a golden sheet with deployed Cogwheel, Large Cogwheel and iron nugget, over 5 loops. It unlocks Mechanical Arm, Mechanical Crafter and other brass-tier blocks. [jar: recipes/sequenced_assembly/precision_mechanism.json; advancement: precision_mechanism → speed_controller → mechanical_arm → mechanical_crafter]
8. Mechanical Crafting unlocks the **Crushing Wheel** (ore doubling). [jar: recipes/mechanical_crafting/crushing_wheel.json; advancement: crushing_wheel]
9. Make the **Sturdy Sheet** from powdered obsidian (crushed) filled with lava and pressed twice. Brass Casing plus Sturdy Sheet makes **Train Casing**. Then Train Track, Train Station and Train Controls let you build trains. [jar: recipes/sequenced_assembly/sturdy_sheet.json, recipes/item_application/railway_casing.json, recipes/sequenced_assembly/track.json; advancement: sturdy_sheet → train_casing_00 → train]
10. Create 6.0 logistics: **Packager** → **Stock Ticker** → **Package Frogport** → Factory Gauge. Cardboard comes from mixing. [advancement: mechanical_mixer → cardboard → packager → stock_ticker → frogport → table_cloth_shop → factory_gauge; github wiki 6.0.0]
11. Crafts & Additions FE bridge: the **Rolling Mill** (andesite tier) makes rods and wires, then Copper Spool and Capacitor. The **Electric Motor** (FE to rotation) and **Alternator** (rotation to FE) are made in a Mechanical Crafter; the Motor needs brass sheets. **Tesla Coil** needs an Electron Tube and Brass Casing. The **Accumulator** stores energy. [jar: createaddition/data/createaddition/recipes/crafting/rolling_mill.json, mechanical_crafting/{electric_motor,alternator,tesla_coil}.json]

**Corrections to the first-draft summary**
- The summary is broadly right. It is missing the copper/fluids/steam stage between andesite and brass.
- It omits that **brass needs a Blaze Burner**, so the player must catch a blaze in the Nether.
- It omits that trains are gated by the **Sturdy Sheet** (obsidian plus lava).
- "Automation and trains" could also mention the Create 6.0 package logistics (Packager, Stock Ticker, Frogport), which are new to the 6.x line.
- The Alternator only needs andesite, iron and a capacitor. The Electric Motor needs **brass sheets** and a Mechanical Crafter. Both are therefore mid-game, not an early FE source.

**Version caveats**
- Most online Create guides predate 6.0, so they lack the logistics blocks. 6.0 also changed some recipes, for example redstone links now need a transmitter ingredient (github wiki 6.0.0).
- The GitHub repo shows the 1.21.1 dev branch. Our build is the 1.20.1 Forge build. The Create Wiki has no recipe or progression pages to check against, so the jar data and Ponder are the reference.
- Crafts & Additions' README and GitHub page target 1.21.1. The 1.3.3 1.20.1 jar's recipes are the ones listed above.

### Mekanism (10.4.16, with Generators 10.4.16 and Tools 10.4.16)

**References**
- Official wiki: https://wiki.aidancbrady.com/wiki/Main_Page. Modrinth lists this as the wiki for Mekanism and Mekanism Generators. The overview page https://wiki.aidancbrady.com/wiki/Mekanism is stale: its header says v9.0.2, and it carries a 2024 notice that it is "largely outdated". The topic pages describe v10 mechanics and match the 10.4 jar data:
  - https://wiki.aidancbrady.com/wiki/Ore_Processing
  - https://wiki.aidancbrady.com/wiki/Getting_Started
  - https://wiki.aidancbrady.com/wiki/Fission_Reactor
  - https://wiki.aidancbrady.com/wiki/Fusion_Reactor
  - https://wiki.aidancbrady.com/wiki/Supercritical_Phase_Shifter (the SPS casing cost of 4 polonium and 1 plutonium pellets matches the jar)
  - https://wiki.aidancbrady.com/wiki/Mekasuit

  The pages are not tied to a specific Minecraft version. They also cover the 1.20.1 / 10.4 behaviour.
- GitHub repo: https://github.com/mekanism/Mekanism. The `1.20.x` branch (https://github.com/mekanism/Mekanism/tree/1.20.x) has the README "Mekanism for Minecraft 1.20". Its `docs/` folder holds only developer files (Development.md, Mekanism.xml), not player docs. The default branch is 1.21.x / 26.x.
- Modrinth: https://modrinth.com/mod/mekanism (checked through api.modrinth.com). It lists 1.20.1 among its versions and links the wiki above.
- In-game guide: none. The Mekanism, Generators and Tools jars contain no Patchouli book. Players should use JEI and the advancement tree (`data/mekanism/advancements`). JEMM (Just Enough Mekanism Multiblocks) in the pack helps with the multiblocks.

**Verified survival progression**
1. Mine Osmium, plus Tin, Lead, Uranium and Fluorite. The **Heat Generator** is the first power source; the Generators advancement tree starts there, as a child of "materials". [jar: data/mekanism/worldgen/placed_feature/ore_*.json; mekanismgenerators/advancements/heat_generator.json]
2. Craft the **Metallurgic Infuser** (iron, furnace, redstone, osmium). Make **Steel Ingot** (iron + carbon → Enriched Iron → steel dust → smelt), **Infused Alloy** (iron + redstone) and **Basic Control Circuit** (osmium + redstone). [jar: recipes/metallurgic_infuser.json, metallurgic_infusing/alloy/infused.json, control_circuit/basic.json; wiki Getting_Started]
3. Craft the **Steel Casing** (steel, glass, osmium). It is the base of almost every machine. The **Enrichment Chamber** (redstone, iron, basic circuit, steel casing) gives **2x** ore yield. [jar: recipes/steel_casing.json, enrichment_chamber.json]
4. **3x**: the **Purification Chamber** is built from an Enrichment Chamber, Infused Alloy and an **Advanced Control Circuit**. It uses oxygen from the Electrolytic Separator, and its output goes through a Crusher. [jar: recipes/purification_chamber.json; processing/iron/clump/*.json]
5. **4x**: the **Chemical Injection Chamber** is built from a Purification Chamber, **Reinforced Alloy** (infused alloy + diamond) and an **Elite Control Circuit**. It uses Hydrogen Chloride. [jar: recipes/chemical_injection_chamber.json; metallurgic_infusing/alloy/reinforced.json]
6. **5x**: the **Chemical Dissolution Chamber**, **Chemical Washer** and **Chemical Crystallizer** each need **Ultimate Control Circuits** (from **Atomic Alloy**, which needs Refined Obsidian) and **Refined Obsidian Ingots**. The line uses Sulfuric Acid and water. [jar: recipes/chemical_dissolution_chamber.json, chemical_washer.json, chemical_crystallizer.json; alloy/atomic.json; advancement chemical_crystallizer]
7. Fission fuel: **Yellow Cake Uranium** (enrich uranium ingots) → Chemical Oxidizer → uranium oxide, plus hydrofluoric acid (from fluorite) in the Chemical Infuser → uranium hexafluoride → **Isotopic Centrifuge** (ultimate circuits, lead) → Fissile Fuel. [jar: processing/uranium/*.json, isotopic_centrifuge.json]
8. Build the **Fission Reactor** (Mekanism: Generators): **Fission Reactor Casing** (lead + steel casing), **Fission Fuel Assembly**, **Control Rod Assembly**, ports, and water or sodium coolant. The steam goes to an **Industrial Turbine**. Store and handle the nuclear waste (Radioactive Waste Barrel, Hazmat suit). [jar: mekanismgenerators/recipes/fission_reactor/*.json; wiki Fission_Reactor]
9. Process nuclear waste. The **Solar Neutron Activator** makes Polonium and the **Isotopic Centrifuge** makes Plutonium. The **Pressurized Reaction Chamber** turns these (with fluorite dust and water) into **Polonium Pellets** and **Plutonium Pellets**. The PRC also makes **HDPE Sheets** (substrate → HDPE pellet → enrich 3 pellets into 1 sheet). [jar: processing/lategame/*.json; enriching/hdpe_sheet.json; advancements polonium/plutonium]
10. Polonium Pellets unlock several things at this point. Each one needs fission waste:
    - the **MekaSuit**: netherite armor + HDPE Sheets + Ultimate Control Circuit + Polonium Pellets + Basic Induction Cell, with the **Modification Station** for modules
    - the **Meka-Tool**
    - **Fusion Reactor Frames** (Atomic Alloy + polonium + steel casing)
    - **QIO** (its advancement is a child of polonium)

    [jar: recipes/mekasuit_*.json, meka_tool.json, modification_station.json; mekanismgenerators/recipes/reactor/frame.json]
11. **Fusion Reactor**: Fusion Reactor Frame, Fusion Reactor Controller, Reactor Glass, a **Laser Focus Matrix**, and a **Hohlraum** filled with D-T fuel. Ignite it with Lasers (at least 1 GFE through a Laser Amplifier) or with external heat. Deuterium comes from heavy water. Tritium comes from lithium in the Solar Neutron Activator. [jar: mekanismgenerators/recipes/reactor/*.json, hohlraum.json, activating/tritium.json; wiki Fusion_Reactor]
12. Endgame: the **SPS** (SPS Casing = HDPE + polonium and plutonium pellets; **SPS Port**; **Supercharged Coil**) turns polonium gas plus very large power into antimatter → **Antimatter Pellet**. Pellets are needed for the **Antiprotonic Nucleosynthesizer** and for a few top items: the MekaSuit Elytra Unit, Gravitational Modulating Unit, Teleportation Unit and the Supermassive QIO drive. [jar: recipes/sps_casing.json, sps_port.json, supercharged_coil.json, antiprotonic_nucleosynthesizer.json, module_gravitational_modulating_unit.json; advancements sps → antimatter → nucleosynthesizer; wiki Supercritical_Phase_Shifter]

**Corrections to the first-draft summary**
- The **MekaSuit does not require antimatter or the SPS.** Its gate is **fission**: Polonium Pellets come from fission waste. Netherite armor, HDPE Sheets, Ultimate Control Circuits and a Basic Induction Cell are also needed. Antimatter is needed only for a few top MekaSuit modules (Elytra, Gravitational Modulating, Teleportation) and for the Nucleosynthesizer.
- **Fission gates fusion.** Fusion Reactor Frames need Polonium Pellets. "Fission/fusion" should read as a strict order: fission, then fusion and the SPS.
- The 2x→5x tiers are gated as follows (worth stating):
  - 2x: Enrichment Chamber, basic circuit
  - 3x: Purification Chamber, advanced circuit and oxygen
  - 4x: Chemical Injection Chamber, elite circuit and HCl
  - 5x: Dissolution Chamber, Washer and Crystallizer, ultimate circuits and refined obsidian
- The multipliers are for **ore blocks** (silk touch). In 1.20.1 most players mine **raw ore**. Per raw ore the yields are about 1.33x (4 dust per 3 raw), 2x, 2.67x and 3.33x. [jar: processing/iron/*/from_raw_ore.json; wiki Ore_Processing says the same]
- The first draft listed Mekanism's Refined Obsidian as a Nether requirement. It isn't: Refined Obsidian is made from obsidian dust + diamond infusion and the Osmium Compressor. It does not require the Nether.

**Version caveats**
- The aidancbrady wiki's main Mekanism page describes v8/v9, including old tier mechanics and paxels. Point players to the topic pages instead. Fan guides written for 1.12 (Mekanism 9) describe a different fusion and fission system with no SPS, MekaSuit or QIO.
- The wiki calls the frame "Reactor Frame". In-game it is **Fusion Reactor Frame** (en_us).
- There is no in-game manual. Players depend on JEI, JEMM and advancements.

### Thermal Series (Foundation 11.0.6, Expansion 11.0.1, Dynamics 11.0.1, Innovation 11.0.1, Integration 11.0.1) + Redstone Arsenal (8.0.1)

**References**
- Official site: https://teamcofh.com/. It is the `displayURL` in every Thermal and Redstone Arsenal mods.toml and is linked from the GitHub READMEs. Its docs page (https://teamcofh.com/docs/) only covers 1.12, 1.16 (the Thermalpedia: https://teamcofh.com/docs/1.16/thermal-series/thermalpedia/) and Redstone Arsenal for 1.18, with nothing for 1.20. The 1.16 Thermal Series is the closest match; the in-game guidebook is the version-matched reference.
- GitHub repos: https://github.com/CoFH/ThermalExpansion and https://github.com/CoFH/RedstoneArsenal (both show the `1.20.x` branch). The READMEs contain only the license and links to teamcofh.com and Discord, with no docs. The org page https://github.com/CoFH also lists ThermalFoundation, ThermalCore, ThermalDynamics, ThermalInnovation, ThermalIntegration and the 1.12-Legacy repos. The legacy repos are not relevant.
- Issue tracker: https://github.com/cofh/feedback (from mods.toml, not fetched).
- CurseForge: blocked from here (see the intro).
- In-game guide: **Thermal Series guidebook** (a Patchouli book; Patchouli-1.20.1-85 is in the pack). Craft it shapeless from a **Book + Crescent Hammer**. [thermal_core: data/thermal/recipes/tools/guidebook.json] The Crescent Hammer is made from iron ingots and an Iron Gear. [thermal_core: recipes/tools/wrench.json] The book has entries for ores, alloys, dynamos, machines, devices, augments, Integral Components, the Tinker's Workbench and a FAQ. This is the best version-matched reference.

**Verified survival progression**
1. Mine the Thermal ores: tin, lead, silver, nickel, apatite, cinnabar, niter, sulfur, plus oil sand in desert and badlands biomes. [jar: thermal_foundation/data/thermal/forge/biome_modifier/*.json]
2. Hand-craft the early alloys with a **Fire Charge**: Bronze, Electrum, Invar and Constantan ingots. Craft gears from 4 ingots + 1 nugget. [jar: thermal_foundation/data/thermal/recipes/fire_charge/*.json; thermal_core: recipes/parts/iron_gear.json; guidebook: world/materials/alloys]
3. Craft the **Redstone Flux Coil** (gold + redstone) and **Redstone Servo** (iron + redstone). Then build the first power, a **Stirling Dynamo** (RF Coil, Iron Gear, stone, redstone). [thermal_core: recipes/rf_coil.json, redstone_servo.json; jar: thermal_expansion/data/thermal/recipes/dynamo_stirling.json]
4. Build the **Machine Frame** from iron, glass and a **Tin Gear**. Then make the first machines: **Pulverizer** (copper gear, piston, flint), **Redstone Furnace**, **Induction Smelter** (invar gear, blast furnace, sand) and **Sawmill**. [thermal_core: recipes/machine_frame.json; jar: thermal_expansion/data/thermal/recipes/machine_{pulverizer,furnace,smelter,sawmill}.json]
5. Add storage and transport: the **Redstone Flux Cell Frame** (lead, glass, electrum gear) leads to the **Redstone Flux Cell**. Thermal Dynamics adds **Fluxduct** and **Fluiduct** only. [thermal_core: recipes/energy_cell_frame.json; jar: thermal_dynamics/data/thermal/recipes/*]
6. Build the **Tinker's Workbench** to apply augments and charge tools, and the **Energetic Infuser** (charge bench). [thermal_core: recipes/tinker_bench.json, charge_bench.json; guidebook: technology/tinker_bench]
7. Make the end-tier alloys from dust mixes. **Signalum** = copper, silver and redstone dusts. **Lumium** = tin, silver and glowstone dusts. **Enderium** = lead dust, diamond dust and ender pearls; diamond dust needs a Pulverizer. Smelt them in a furnace or Induction Smelter, or hand-craft them with a Fire Charge. Also make **Hardened Glass** (obsidian, quartz, sand, Fire Charge). [thermal_core: recipes/{signalum,lumium,enderium}_dust_*.json, smelting/*_from_dust_*.json, fire_charge/*.json]
8. Upgrade machines, dynamos and devices with **Integral Components** (2x, 3x, 4x scale). **Hardened** = invar, gold gear, redstone, glass. **Reinforced** = electrum, signalum gear, quartz + Hardened. **Resonant** = enderium, lumium gear, hardened glass + Reinforced. Other augments include Flux Linkage Amplifier and Auxiliary Process Sieve. [thermal_core: recipes/augments/upgrade_augment_{1,2,3}.json; guidebook: technology/augments/integral_components]
9. More machines and devices: Magma Crucible, Blast Chiller, Fluid Encapsulator, Phytogenic Insolator, Fractionating Still, Pyrolyzer, Multiservo Press, Sequential Fabricator. Devices include the Igneous Extruder and Aqueous Accumulator. Thermal Innovation adds the Fluxbore, Fluxsaw, FluxoMagnet and Flux Capacitor. [jar: thermal_expansion/data/thermal/recipes/machine_*.json; thermal_innovation/data/thermal/recipes/*.json]
10. Redstone Arsenal: make the **Flux-Infused Ingot** by hand (gold ingot + 5 redstone + Fire Charge, or smelt Flux-Infused Dust). Alternatively use the Induction Smelter (electrum + 4 redstone). Make the **Flux-Infused Gem** from a diamond + 5 redstone, or diamond + Destabilized Redstone in the Fluid Encapsulator. Then make the **Obsidian Rod** (obsidian + blaze powder) and **Flux-Infused Obsidian Rod**, then the Flux-Infused tools and armor. [jar: redstone_arsenal/data/redstone_arsenal/recipes/materials/*.json, flux_sword.json, flux_chestplate.json; thermal_integration/data/thermal/recipes/compat/redstone_arsenal/*.json]

**Corrections to the first-draft summary**
- Augment tiers are named **Hardened → Reinforced → Resonant Integral Components**. "Integral → resonant" reads as if "integral" were the first tier. The lang file has a fourth tier, "Resonant+ Integral Components", but it has **no recipe** in the jars, so it appears to be creative-only.
- **Redstone Arsenal is not a post-augment endgame step.** Flux-Infused Ingots can be hand-crafted from gold, redstone and a fire charge without any machine. The gear really needs diamonds, obsidian and blaze powder, so it is a mid-game Nether-gated option, not the capstone.
- Worth adding: the first dynamo (Stirling) doesn't need a Machine Frame, and many alloys can be hand-crafted with Fire Charges.

**Version caveats**
- In 1.20 **Thermal Dynamics has no itemducts**: only Fluxduct, Fluiduct, the Logistical Item Buffer and attachments. The guidebook FAQ says so explicitly.
- Old 1.12 docs and wikis (Pyrotheum, Itemducts, Upgrade Kits, steel/platinum, Hardened/Reinforced/Signalum/Resonant machine block tiers) don't apply. In 1.20, machines are upgraded with Integral Component augments in the augment panel.
- Thermal Foundation's guidebook FAQ says platinum, steel and mana-infused were removed.
- The Thermal "core" content (frame, augments, guidebook) sits in the nested thermal_core jar. Anyone grepping the pack must look there.

### Immersive Engineering (10.2.0-183)

**References**
- GitHub repo: https://github.com/BluSunrize/ImmersiveEngineering. The page shows the 1.21.1 branch, so it is not version-specific for us. The jar's mods.toml sets the issue tracker to this repo.
- GitHub wiki: https://github.com/BluSunrize/ImmersiveEngineering/wiki and https://github.com/BluSunrize/ImmersiveEngineering/wiki/Getting-Started. It is very old (last edited 2016) and only says to craft the Engineer's Manual (book + lever) and use it. No 1.20.1 detail.
- CurseForge: https://minecraft.curseforge.com/projects/immersive-engineering/. This is the `displayURL` in mods.toml. CurseForge was unreachable.
- In-game guide: **Engineer's Manual**, crafted shapeless from a Book and a Lever. [jar: data/immersiveengineering/recipes/crafting/manual.json] The text lives under `assets/immersiveengineering/manual/en_us/` and is the authoritative 1.20.1 documentation. Getting the manual triggers the root advancement. I found no first-join book grant in the jar data.

**Verified survival progression**
1. Craft the **Engineer's Manual** (book + lever) and the **Engineer's Hammer** (iron, string, sticks). [jar: recipes/crafting/manual.json, recipes/crafting/hammer.json; advancement: main/main_root → craft_hammer]
2. Build the **Coke Oven** from 27 **Coke Brick** (clay, brick and sandstone) and form it with the hammer. It produces **Coal Coke** and Creosote Oil. [jar: recipes/crafting/cokebrick.json, recipes/cokeoven/coke.json; advancement: main/mb_cokeoven → creosote]
3. Turn creosote into **Treated Wood Planks**, then the **Engineer's Workbench** (blueprint crafting). [jar: recipes/crafting/treated_wood_horizontal.json, crafting/workbench.json; advancement: craft_treatedwood → craft_workbench]
4. Build the **Crude Blast Furnace** from **Blast Brick**, which needs **Nether Brick + Magma Block** plus brick, so it is a Nether trip. Smelt iron with coke to get **Steel Ingot**. [jar: recipes/crafting/blastbrick.json, recipes/blastfurnace/steel.json; manual: crude_blast_furnace.txt; advancement: mb_blastfurnace → make_steel]
5. Early power doesn't need steel. Make **LV Wire Coil** and **LV Wire Connector**, then build a **Windmill** (treated wood + iron) or **Water Wheel** (needs steel) on a **Kinetic Dynamo**, with an **LV Accumulator** for storage. The **Thermoelectric Generator** needs steel and constantan. [jar: recipes/crafting/{windmill,watermill,dynamo,wirecoil_copper,connector_lv,thermoelectric_generator}.json; advancement: connect_wire → place_dynamo → place_windmill]
6. Make the steel-tier parts: **Steel Scaffolding**, **Light Engineering Block** (iron sheetmetal, Iron Mechanical Component, copper), **Heavy Engineering Block** (steel sheetmetal, Steel Mechanical Component, electrum) and the **Redstone Engineering Block**. Steel unlocks the multiblocks advancement tab. [jar: recipes/crafting/{light,heavy}_engineering.json; advancement: multiblocks/multiblocks_root (Steel Ingot)]
7. First multiblocks: **Crusher** (ore doubling), **Metal Press** (plates, rods and molds), **Improved Blast Furnace** (Reinforced Blast Brick = Blast Brick + steel plate). [advancement: mb_crusher, mb_metalpress, mb_improvedblastfurnace; jar: recipes/crafting/blastbrick_reinforced.json]
8. Blueprints at the Engineer's Workbench: the **Components** blueprint needs an **aluminum** ingot (from bauxite) and gives Vacuum Tube and Circuit Backplane. The Molds blueprint gives Metal Press molds. [jar: recipes/crafting/blueprint_components.json, recipes/blueprint/*.json]
9. **Arc Furnace**, which follows the Improved Blast Furnace in the tree. It runs on **Graphite Electrode**s: coke dust goes into the **Squeezer** for HOP Graphite Dust, which is smelted to **HOP Graphite Ingot**, then pressed with a rod mold in the Metal Press (or made with a blueprint). [advancement: multiblocks/mb_arcfurnace; jar: recipes/squeezer/graphite_dust.json, metalpress/electrode.json, blueprint/graphite_electrode.json]
10. Fuel chain: **Squeezer** (Plant Oil) and **Fermenter** (Ethanol) feed the **Refinery**, which makes Biodiesel (saltpeter catalyst). Biodiesel or creosote runs the **Diesel Generator**. The Refinery also opens Duroplast. [advancement: mb_squeezer → mb_fermenter → mb_refinery → mb_dieselgen / craft_duroplast; jar: recipes/refinery/biodiesel.json, recipes/generator_fuel/*.json]
11. **Excavator** (after the Crusher) mines mineral veins. Use the **Core Sample Drill**, or buy ore-vein maps from IE villagers, to find veins. [advancement: mb_crusher → mb_excavator; main/buy_oremap; manual: excavator.txt]
12. Tools tab (after the Engineer's Workbench): Mining Drill, Revolver, Railgun, Chemical Thrower, Powerpack, and their upgrades. [advancement: tools/tools_root → craft_drill, craft_revolver, craft_railgun …]

**Corrections to the first-draft summary**
- The summary is mostly right, but it is missing the **Nether requirement for Blast Bricks** (nether brick + magma block) before any steel.
- It omits the **Engineer's Workbench, treated wood and blueprints** step.
- The order "steel → wiring/power" is misleading. Basic power (LV wire, Windmill + Kinetic Dynamo) is available before steel.
- The Diesel Generator needs the Squeezer + Fermenter + Refinery biodiesel chain.
- The Arc Furnace needs Graphite Electrodes (Squeezer + Metal Press).

**Version caveats**
- The GitHub wiki dates from 2016 and is effectively empty. Use the in-game manual, which is version-matched.
- Many older guides (1.12) describe making biodiesel directly from plant oil + ethanol without a Refinery multiblock, and an older steel/alloy kiln flow. In 10.x the Refinery multiblock is required (verified in recipes).
- The manual now has a "Crude Blast Furnace" page, and the Improved Blast Furnace is the automatable version.

### Ender IO (6.2.18-beta)

**References**
- GitHub repo: https://github.com/Team-EnderIO/EnderIO. The README's support table says **1.20.1 / Ender IO 6.x is "Not Supported"** (community maintenance PRs only). Active development is 1.21.1 (8.x). The jar's mods.toml issue tracker points here.
- GitHub docs folder: https://github.com/Team-EnderIO/EnderIO/tree/dev/1.21.1/docs. It contains only img, license, modpages and README, with no gameplay docs.
- GitHub wiki: https://github.com/SleepyTrousers/EnderIO-Rewrite/wiki (linked from the README) and https://github.com/SleepyTrousers/EnderIO-Rewrite/wiki/Getting-Started. They only cover install, dev and contributor info and the version table. There is no gameplay or progression content.
- Official site: https://www.enderio.com/ (mods.toml `displayURL`). It only links to CurseForge, the source code and the legacy 1.12 wiki (https://github.com/SleepyTrousers/EnderIO/wiki), so it has nothing for 6.x.
- CurseForge: blocked from here (see the intro).
- In-game guide: **effectively none.** The jar registers a Patchouli book `enderio:guide`, available only from the creative tab, and it has no crafting recipe. It is a placeholder: its title is "Book Title" and it holds a single "Test Entry". [jar: data/enderio/patchouli_books/guide/book.json, assets/enderio/patchouli_books/guide/en_us/entries/test_entry.json] Players should use JEI.

**Verified survival progression**
1. Get **Grains of Infinity** by lighting fire on **bedrock in the Overworld**. Each fire has a 50% chance to drop one. [jar: data/enderio/recipes/fire_crafting/infinity.json, loot_tables/fire_crafting/infinity.json]
2. Build the **Primitive Alloy Smelter** (furnaces, deepslate, Grains of Infinity). It is fuel-powered and needs no RF. [jar: recipes/primitive_alloy_smelter.json]
3. Alloy **Dark Steel Ingot** from iron, coal dust and obsidian. [jar: recipes/alloy_smelting/dark_steel_ingot.json]
4. Make the **Void Chassis** (iron, iron bars, Grains of Infinity) and the **Basic Capacitor** (copper, gold nuggets, Grains of Infinity). Machines show "Install a capacitor to be able to use the machine". [jar: recipes/void_chassis.json, basic_capacitor.json; en_us gui.enderio.no_capacitor]
5. Build the first powered machines on the Void Chassis with Dark Steel and an Infinity Bimetal Gear: the **Stirling Generator**, **Alloy Smelter** and **SAG Mill**. [jar: recipes/stirling_generator.json, alloy_smelter.json, sag_mill.json]
6. Make the alloys. **Conductive Alloy** (copper alloy, iron, redstone) gives the **Energy Conduit** (with Conduit Binder). **Redstone Alloy**, **Energetic Alloy** (gold, redstone, glowstone) and **Vibrant Alloy** (Energetic + ender pearl) follow. Item, Fluid and Redstone Conduits come next. [jar: recipes/alloy_smelting/*.json, recipes/energy_conduit.json]
7. Upgrade capacitors: **Double Layer Capacitor** (Energetic Alloy + 2 Basic + coal dust), then **Octadic Capacitor** (Vibrant Alloy + 2 Double Layer + glowstone). Capacitor Banks run Basic → Advanced → Vibrant. Loot capacitors also appear in vanilla chests. [jar: recipes/double_layer_capacitor.json, octadic_capacitor.json, *_capacitor_bank.json; loot_modifiers/common_loot.json; advancement: place_capacitor_bank]
8. Soul tier: **Soularium Ingot** (soul sand or soul soil + gold, a Nether trip) gives the **Ensouled Chassis**. The **Slice'N'Splice** then makes the **Z-Logic Controller** from soularium, a zombie head, silicon and redstone; silicon comes from the SAG Mill. [jar: recipes/alloy_smelting/soularium_ingot.json, ensouled_chassis.json, slice_and_splice.json, slicing/z_logic_controller.json]
9. Build the **Soul Binder** (Ensouled Chassis, Z-Logic Controller, Energized Bimetal Gear, Empty Soul Vial). Its recipes include Enticing, Ender and Prescient crystals, Soul Engine, Frank'N'Zombie and Sentient Ender. [jar: recipes/soul_binder.json, recipes/soulbinding/*.json]
10. Endgame and utility: **Powered Spawner** (a **Broken Spawner** from mining a vanilla spawner, Ensouled Chassis, Z-Logic Controller, vibrant crystals), **Enchanter**, XP Obelisk, Travel Anchor and Staff of Travelling, Photovoltaic Modules (solar), and **End Steel Ingot** (end stone + dark steel + obsidian, so an End trip). [jar: recipes/powered_spawner.json, loot_modifiers/broken_spawner.json, recipes/alloy_smelting/end_steel_ingot.json]

**Corrections to the first-draft summary**
- **Missing first step:** Grains of Infinity (fire on bedrock) → Primitive Alloy Smelter → Dark Steel → Void Chassis. The powered Alloy Smelter and SAG Mill both need Dark Steel and a Void Chassis, so "Alloy smelter" is not the entry point.
- **Capacitors are misplaced.** The Basic Capacitor is hand-crafted at the very start and is required for any machine to run. Only Double Layer and Octadic come later, so "conduits → capacitors" is backwards for the basic tier.
- The Soul Binder needs the Slice'N'Splice (for the Z-Logic Controller) and Soularium (Nether). The summary could say "soul binder → powered spawner" as the endgame.

**Version caveats**
- 6.2.18 is a **beta** of the 1.20.1 rewrite, and upstream marks 1.20.1 "Not Supported". Features differ from the classic 1.12 Ender IO, so 1.12 wikis are wrong for this pack.
- No dark steel armor or dark steel pickaxe was found in en_us; only the sword "The Ender" exists.
- No Combustion, Zombie or Lava generators exist; power comes from the Stirling Generator, Photovoltaic Modules and Soul Engine.
- No Vat was found in en_us.
- Machines use swappable capacitors rather than 1.12-style upgrade tiers.
- The in-game guide book is a non-functional placeholder.

### Applied Energistics 2 (15.4.11) + Advanced AE (1.3.6) + AppliedE (0.14.3)

**References**
- In-game guide: item **Guide** (`ae2:guide`). Make it by putting a vanilla **Book** in a **Charger** [jar: data/ae2/recipes/charger/guide.json]. You can also hover over any item and use the "Open Guide for Items" keybind (`key.ae2.guide`; default key not verified from data, commonly G). In 15.4.11 the guide runs on the separate **GuideME** mod, which mods.toml requires as `guideme [20.1.7,20.2.0)`. Its pages ship in the jar under `assets/ae2/ae2guide` ("Getting Started (1.20+)"). Advanced AE (`assets/advanced_ae/ae2guide`) and AppliedE (`assets/appliede/ae2guide`) add their own pages to the same guide.
- Official guide (web): https://guide.appliedenergistics.org/1.20.1/getting-started. It covers MC 1.20.1, and the text matches the jar's getting-started.md word for word. The site has a version picker covering 1.16.5 through 26.2, so players must stay on **1.20.1**.
- Official site: https://appliedenergistics.org/. This is where the Modrinth "wiki" link https://appliedenergistics.github.io/ redirects (301).
- GitHub repo: https://github.com/AppliedEnergistics/Applied-Energistics-2. The README links the Players Guide. The `forge/1.20.1` branch exists.
- Modrinth: https://modrinth.com/mod/ae2 (API lists 1.20.1).
- Advanced AE: GitHub https://github.com/pedroksl/AdvancedAE (README fetched; it has no separate docs site) and Modrinth https://modrinth.com/mod/advancedae (API confirmed).
- AppliedE: Modrinth https://modrinth.com/mod/appliede (API confirmed, 1.20.1). The source URL the API gives is https://github.com/62832/AppliedE (not fetched). The in-game guide pages are the main documentation.

**Verified survival progression**
1. Find a **meteorite**: a crater with Sky Stone, certus clusters and budding certus. To track one down, charge a vanilla **Compass** in a **Charger** to get a **Meteorite Compass**, which points at the nearest **Mysterious Cube** [jar: data/ae2/recipes/charger/meteorite_compass.json; ae2guide/getting-started.md].
2. Mine the **Mysterious Cube** without Silk Touch. It drops all four presses: **Inscriber Silicon Press**, Logic, Calculation and Engineering Processor Press. With Silk Touch it drops only the cube [jar: data/ae2/loot_tables/blocks/mysterious_cube.json]. You can copy a press later in the Inscriber with a press plus an Iron Block [jar: data/ae2/recipes/inscriber/silicon_press.json].
3. Collect **Certus Quartz Crystal**s from clusters and keep the budding certus blocks. Without Silk Touch a budding block drops one tier lower, and Flawless budding certus can never be moved or kept intact. Craft the **Charger** (iron + copper) and power it with a **Crank** or FE/AE [jar: recipes/network/blocks/crystal_processing_charger.json; ae2guide/items-blocks-machines/charger.md]. Advancement: "It's Chargin' Time !".
4. Make **Charged Certus Quartz Crystal**s in the Charger. Throw charged certus + redstone + nether quartz into water to get 2 **Fluix Crystal** [jar: recipes/transform/fluix_crystals.json]. Charged certus thrown in water with a certus block also makes or repairs budding certus. Build **Growth Accelerator**s around the budding blocks for steady certus [advancement: main/fluix, main/growth_accelerator].
5. Craft the **Inscriber** (iron, sticky piston, copper) [jar: recipes/network/blocks/inscribers.json]. Smelt **Certus Quartz Dust** into **Silicon**. Then print **Printed Silicon** and the gold, certus and diamond printed circuits, and combine them with redstone into **Logic**, **Calculation** and **Engineering Processor**s [jar: recipes/inscriber/*.json; smelting/silicon_from_certus_quartz_dust.json].
6. Build a first network: **ME Drive** (needs an Engineering Processor), **ME Terminal**/**ME Crafting Terminal**, **Energy Acceptor** fed FE (or a **Vibration Chamber**/**Crystal Resonance Generator**), cables, and **1k–256k ME Item Storage Cell**s [jar: recipes/network/blocks/storage_drive.json; ae2guide/getting-started.md; advancement: main/storage_cell].
7. Past 8 channels, add an **ME Controller** (Smooth Sky Stone + Fluix Crystal + Engineering Processor) and use smart or dense cables [jar: recipes/network/blocks/controller.json; advancements network1–3].
8. Autocrafting: **Pattern Encoding Terminal**, **Pattern Provider**, **Molecular Assembler**, and a **Crafting Unit**/crafting CPU multiblock [advancement: main/pattern_encoding_terminal → main/crafting_cpu].
9. Late game. **Singularity** comes from the **Matter Condenser**. Blowing up a singularity with ender dust gives 2 **Quantum Entangled Singularity**, which feed the **Quantum Network Bridge** (Quantum Link/Ring). **P2P Tunnel**s and **Spatial IO** follow [jar: recipes/transform/entangled_singularity.json; advancements main/p2p → main/qnb, main/spatial_ioport].
10. Advanced AE. The **Reaction Chamber** needs an ME/Matter Condenser and a Vibration Chamber. Run singularity + ender dust + sky dust + lava through it to get **Shattered Singularity**. That leads to Quantum Infusion and **Quantum Alloy**, the **Quantum Processor** press, and finally the **Quantum Computer Core** multiblock and Quantum armor [jar: AdvancedAE data/advanced_ae/recipes/reactionchamber.json, shatteredsingularity.json, quantum_alloy.json, quantumcore.json].
11. AppliedE (EMC bridge). The **ME Transmutation Module** needs Dark Matter Blocks, Red Matter Blocks, ae2 Singularities and a **Transmutation Tablet**. The **ME Transmutation Terminal**, Interface and Buses all need a Transmutation Tablet. So AppliedE is a late-ProjectE / late-AE2 step [jar: appliede data/appliede/recipes/emc_module.json, transmutation_terminal.json].

**Corrections to the first-draft summary**
- The summary is correct in outline. Two clarifications: "Meteorites/certus" should say that certus is grown from **budding certus** taken from meteorites (no certus ore exists in 15.x), and the presses come from the **Mysterious Cube** at the meteorite's centre. Also note that the Charger and Inscriber come before processors.
- Worth adding: AppliedE is gated behind Dark/Red Matter plus Transmutation Tablet plus Singularity, so it is not an early link.

**Version caveats**
- Pre-1.18 / AE2 rv6 (1.12) guides, and many videos, describe certus ore, quartz seeds, the Grindstone, and presses found in meteorite chests. None of these exist in 15.x.
- The online guide's default version is newer (26.x). Players must pick **1.20.1**.
- Mining a Mysterious Cube with Silk Touch gives the cube, not the presses.
- The Meteorite Compass is charged in a Charger, not shaped-crafted, so the guide's word "craft" is misleading.

### RFTools: Base 5.0.7, Utility 6.0.7, Builder 6.0.10, Dimensions 11.0.11 (MC 1.20)

**References**
- In-game guide: item **Technology Guide** (`rftoolsbase:manual`), a Patchouli book. Recipe: Book + 3 Iron Nuggets [jar: rftoolsbase data/rftoolsbase/recipes/manual.json; patchouli_books/manual/book.json]. Requires Patchouli, which the pack has. Each RFTools module adds its own categories (Base basics, Utility machines/logic, Builder, Dimensions dimlets/dimensions). I compared the Dimensions entries in the jar with the upstream `1.20` branch and they match.
- Official docs: https://mcjty.eu/docs/mods/rftools-dimensions. This is the Modrinth wiki link, which points to www.mcjty.eu and redirects to mcjty.eu. It explicitly targets **MC 1.20.1** but covers only server config (dimlet packages, costs), not a gameplay walkthrough. https://mcjty.eu/docs/mods/rftools only lists old tutorial videos (version not stated, likely 1.12-era).
- GitHub repos: https://github.com/McJtyMods/RFToolsDimensions. The `1.20` branch gradle.properties says `version=1.20-11.0.11`, an exact match, and its changelog.txt covers 11.0.0–11.0.11. https://github.com/McJtyMods/RFToolsBase has a `1.20` branch.
- Modrinth: https://modrinth.com/mod/rftools-dimensions and https://modrinth.com/mod/rftools-base (API confirmed for 1.20.1). rftools-utility and rftools-builder slugs exist (not checked further).

**Verified survival progression**
1. Mine **Dimensional Shard Ore** for **Dimensional Shard**s. It generates in the Overworld at Y −15 to 40, and also in the Nether and End [jar: rftoolsbase data/rftoolsbase/worldgen/placed_feature/dimshard_*.json]. Make the **Technology Guide**.
2. Craft the **Machine Frame** (iron, blue dye, gold nuggets) and **Machine Base** (gold nuggets + stone). Nearly every machine uses one of them [jar: rftoolsbase recipes/machine_frame.json, machine_base.json]. Shards also make the **Infused Diamond** and feed the **Machine Infuser**, which upgrades machines.
3. Utility blocks: **Crafter Tier 1–3**, **Screen**s (on a Machine Base), and **Matter Transmitter** + **Matter Receiver** + **Dialing Device** for teleporting [jar: rftoolsutility recipes/crafter1.json, matter_transmitter.json, screen.json].
4. **Builder** (Machine Frame + ender pearl + bricks + redstone) with a **Shape Card**. Upgrade it to **Shape Card (Quarry)** with a diamond pickaxe and shovel for quarrying. A **Space Chamber Controller** and **Space Card** handle moving structures. Shields and Projectors are optional [jar: rftoolsbuilder recipes/builder.json, shape_card_quarry.json].
5. Dimensions: collect **Lost Knowledge** (Common through Legendary). It drops from Endermen and is added as extra loot in vanilla chests (villages, desert and jungle temples, ruined portals, shipwrecks, dungeons, mineshafts, and more in outposts, buried treasure, mansions and End cities) [jar: rftoolsdim data/rftoolsdim/loot_modifiers/*.json]. 9 lower-tier knowledge items craft into 1 higher tier [jar: uncommon_lost_knowledge.json].
6. Make **Empty Dimlet**s (paper + Dimensional Shard) and build the **Researcher**, **Knowledge Holder** and **Dimlet Workbench**, each on a Machine Frame [jar: rftoolsdim recipes/researcher.json, knowledge_holder.json, dimlet_workbench.json]. Research Lost Knowledge in the Researcher, store the result in a Knowledge Holder placed next to the Dimlet Workbench, and craft ready dimlets there [manual: dimlets/*.json].
7. Workbench ingredients include **Common Energy Module**/memory parts (tiers 0–3) and **Common/Rare/Legendary Dimensional Essence**. Essence drops from **Common/Rare/Legendary Blob** mobs in RFTools dimensions. **Block/Fluid/Biome/Structure Absorber**s capture specific content for matching dimlets [jar: recipes/part_energy_0..3.json; loot_tables/entities/dimensional_blob_*.json; manual: dimlets/absorbers.json].
8. Put an **Empty Dimension Tab** (paper + redstone) in the **Enscriber** and arrange dimlets on it to make a **Realized Dimension Tab**. Aspects you leave out (terrain etc.) are filled randomly at extra cost [jar: recipes/enscriber.json, empty_dimension_tab.json; upstream source DimensionDescriptor.createRandomizedDescriptor].
9. Insert the tab in the **Dimension Builder** (Machine Frame, diamonds, emerald, ender pearls, gold) and feed it FE until the dimension is created. It then has to stay powered **and chunkloaded**. The Builder places a Matter Receiver at the new dimension's spawn platform, so you travel there with your Matter Transmitter and Dialing Device [jar: recipes/dimension_builder.json; lang message.rftoolsdim.dimension_builder.header; upstream DimensionBuilderTileEntity.createTeleporter].
10. Support items: carry a charged **Phased Field Generator** before entering unpowered or unstable dimensions. Also available are the **Dimension Monitor**, the **Dimension Editor** (changes existing tabs) and the **Activity Probe** [manual: dimensions/*.json].

**Corrections to the first-draft summary**
- "Machine frame → … → dimension builder" is too thin and leaves out the actual gate, which is **Dimensional Shards** (ore). The 1.20 dimension flow is **Lost Knowledge → Researcher → Knowledge Holder + Dimlet Workbench → dimlets → Enscriber (Empty → Realized Dimension Tab) → Dimension Builder (FE, chunkloaded)**.
- **No Dimlet Digitizer** exists in this version (nothing in jar recipes or lang). Dimlets come mostly from the Workbench via researched knowledge; random dimlets also turn up as rare loot.

**Version caveats**
- 1.12-era wikis and videos (RFTools Dimensions 5.x) describe a different system: random dimlets from loot, a Dimlet Researcher/Scrambler, the Dimension Enscriber, and RF costs from dimlets.json rules. McJty's own doc says the old dimlets.json system "is no longer used".
- RFTools Base 1.20 has no separate "RFTools" main mod. Machines are split across Utility, Builder, Dimensions etc. Storage, Power and Control are not in this pack (not checked).
- The Dimension Builder must be chunkloaded, or the dimension loses power. Its tooltip warns about this. What happens to players inside an unpowered dimension is unverified (the manual says it becomes "unsafe or unusable"; the Phased Field Generator protects against it).

### Extreme Reactors 2 (2.0.97; Zero CORE 2 2.1.48)

**References**
- In-game guide: **"The Extreme Book"**, a Patchouli book (`bigreactors:erguide`). Craft it shaped: a **Yellorium Ingot** (any `forge:ingots/yellorium`) above a **Book**. An alternative recipe uses any `forge:ingots/uranium` above a Book. Patchouli is in the pack. The book covers ores, a first reactor, passive and active cooling, reactor and turbine variants, coils, the Reprocessor, Fluidizer and Energizer. [jar: data/bigreactors/recipes/misc/book/erguide.json, erguide_alt.json; assets/bigreactors/patchouli_books/erguide/]
- GitHub repo: https://github.com/ZeroNoRyouki/ExtremeReactors2. The README is a title only. No GitHub wiki is visible.
- Modrinth: https://modrinth.com/mod/extreme-reactors (checked through the API). The description names 1.20/1.20.1 and says "To use the in-game manual you need the mod Patchouli". It describes Blutonium, the Reprocessor, the Fluidizer and the turbine coils (Ludicrite/Ridiculite/Inanite, about 45K/75K/115K FE/t in a Reinforced Turbine). It says up-to-date versions are on CurseForge.
- CurseForge: https://www.curseforge.com/minecraft/mc-mods/extreme-reactors (returned by search, unreachable from here).
- No official web wiki was found. The in-game book is the authoritative doc for this version.

**Verified survival progression**
1. Mine **Yellorite Ore** or **Deepslate Yellorite Ore** in the Overworld at low Y (stone variant up to about Y32, deepslate variant near the bottom). Smelt the **Raw Yellorium** into **Yellorium Ingots**. [jar: worldgen/placed_feature/yellorite_*.json, smelting/yellorium_from_raw.json; book intro/ores]
2. Smelt or blast coal, charcoal or a coal block into **Graphite Bar**. It is needed for reactor casings and fuel rods. [jar: recipes/smelting/graphite_from_*.json]
3. Build the **Basic Reactor** (max 5x5x5): 22 casings (iron + graphite + sand), a **Reactor Controller (Basic)** (casing, comparator, Yellorium, diamond, redstone), 1 Control Rod, 1 Fuel Rod, 1 Solid Access Port and 1 Active Forge Energy Power Tap. This is the passive-cooled setup. [book intro/first; jar: recipes/reactor/basic/*.json]
4. Feed Yellorium Ingots through the Solid Access Port (inlet mode). Use the **Extreme Wrench** to switch port modes. Spent fuel comes out as **Cyanite Ingots**. [book intro/first, reactor/reactants, misc/wrench]
5. Upgrade to the **Reinforced** variant for larger reactors (size set by config, up to 256). It needs steel ingots, which the pack has from Mekanism and IE, plus iron blocks and graphite. [jar: recipes/reactor/reinforced/casing.json; book reactor/reinforced-variant]
6. **Turbines need Cyanite.** Turbine casings and rotor blades are crafted with Cyanite Ingots, so a reactor has to run first. Switch the reactor to **active cooling** (Fluid Ports for coolant in and steam out) and pipe the steam into a **Turbine Controller (Basic)** multiblock (max 5x5x10). Later use a Reinforced Turbine. Rotor coils determine output. [jar: recipes/turbine/basic/casing.json, blade.json; book reactor/active, turbine/basic-variant, turbine/coils]
7. Build the **Reprocessor** (3x3x7): casing (iron + Cyanite + water bucket), a Reprocessor Controller (emerald, prismarine dust, Cyanite), Waste Injector, Fluid Injector, Collector, Output Port and Power Port, powered with FE. Recipe: 2 Cyanite + 1000 mB water → 1 **Blutonium Ingot**, a better fuel whose waste is Magentite. [jar: recipes/reprocessor/*.json; book reprocessor/*]
8. Late game, the Reprocessor chain gives **Ludicrite** (2 Blutonium + cyanite fluid) → **Ridiculite** → **Inanite** (and Rossinite → **Insanite**). Their blocks (Ludicrite also needs an End Crystal) are the top turbine coils. The optional **Fluidizer** (liquid and mixed fuels such as Verderium) and **Energizer** (energy storage) multiblocks follow. [jar: recipes/reprocessor/blutonium_to_ludicrite.json, turbine/ludicrite_block.json, fluidizer/*, energizer/*; Modrinth description]

**Corrections to the first-draft summary**
- "Yellorium → reactor multiblock → turbines → reprocessing" is right, but it leaves out two gates. **Graphite Bars** are needed to build the reactor. **Cyanite** (reactor waste) is needed to craft turbines and the Reprocessor. Reprocessing also feeds the late-game coil materials, not just recycled fuel.
- The ore is **Yellorite** and the ingot is **Yellorium**. Also mention the Basic → Reinforced variants (Reinforced needs steel).

**Version caveats**
- ER tags Yellorium as `forge:ingots/uranium`, `forge:ores/uranium` and `forge:raw_materials/uranium`. Mekanism uranium therefore fits ER's uranium-tagged recipes: the alt controller and fuel rod recipes, and the guide book. **AlmostUnified** may merge the two into one item. Whether Mekanism uranium also works as reactor fuel in the Solid Access Port is **(unverified)**. Test it in-game.
- Old Big Reactors / 1.12 guides describe Blutonium as a direct Yellorium equivalent and use different casing recipes. Use the in-game book.
- Benitoite (Nether) and Anglesite (End) ores spawn, but the book itself says the player has "no use" for them yet. Don't send players after them.

### Draconic Evolution (3.1.2.621; Brandon's Core 3.2.1, CodeChicken Lib)

**References**
- GitHub repo: https://github.com/Draconic-Inc/Draconic-Evolution. The default branch is 1.21. A `1.20` branch exists: its README, `DEConfig.java`, `handlers/LootEventHandler.java` and `items/InfoTablet.java` were read through raw.githubusercontent.com. This is the branch HEAD, not necessarily the exact 3.1.2.621 code.
- GitHub wiki: https://github.com/Draconic-Inc/Draconic-Evolution/wiki has only an empty Home page (2016).
- Modrinth: https://modrinth.com/mod/draconic-evolution (checked through the API). It lists 1.20.1 and links no wiki; its description says "this description is ancient".
- CurseForge: https://www.curseforge.com/minecraft/mc-mods/draconic-evolution (linked from the README, unreachable from here).
- **There is no official wiki and no usable in-game guide in this pack.** The **Information Tablet** item exists in the jar but has no crafting recipe. Its code only opens docs if **Project Intelligence** is installed, and the pack does not include it; otherwise it prints a chat link. The MODDEDMC wiki (moddedmc.net) was returned by search but could not be reached. Most other search hits were 9minecraft reposts, which this check does not use.

**Verified survival progression**
1. Find Draconium ore. In 1.20.1 it spawns in all three dimensions:
   - **Overworld**: **Draconium Ore** and **Deepslate Draconium Ore** at **Y -64 to -48**, vein size 8, in about 1 of 10 chunks
   - **Nether**: **Nether Draconium Ore** at Y 4–16, vein size 32, in about 1 of 30 chunks
   - **End**: **Ender Draconium Ore** at Y 0–70, 3 veins per chunk

   Ores drop 2–4 Draconium Dust (fortune applies). Smelt the dust or ore into **Draconium Ingots**. [jar: worldgen/placed_feature/*_draconium_ore.json, forge/biome_modifier/*.json, loot_tables/blocks/overworld_draconium_ore.json]
2. Craft the **Draconium Core** (draconium, gold, diamond). It unlocks the **Generator**, **Energy Pylon**, **Particle Generator**, **Wyvern Energy Controller** and the first fusion parts. [jar: recipes/components/draconium_core.json, components/wyvern_energy_core.json, machines/*.json]
3. Set up fusion crafting. The **Fusion Crafting Core** uses lapis blocks, diamonds and a Draconium Core. The **Draconium Fusion Crafting Injector** uses diamonds, a Draconium Core, stone and an iron block. Fusion recipes need injectors of at least the recipe's tier, and they draw OP/FE. [jar: recipes/machines/crafting_core.json, basic_crafting_injector.json]
4. **Wyvern tier (needs a Nether Star from the Wither, not the dragon).** The **Wyvern Core** is shaped crafting: draconium ingots + Draconium Cores + a Nether Star. Use it to fusion-craft the **Wyvern Fusion Crafting Injector** (Draconium tier). Wyvern gear (for example the Wyvern Pickaxe or Wyvern Chestpiece) is fusion-crafted from the diamond item + Draconium Core + Wyvern Energy Controller + relay crystals at Wyvern tier. [jar: recipes/components/wyvern_core.json, machines/wyvern_crafting_injector.json, tools/wyvern_*.json]
5. Build the **Energy Core** (Wyvern Core + Wyvern Energy Controllers + draconium) with **Energy Core Stabilizers** and **Energy Pylons** for multiblock power storage. [jar: recipes/machines/energy_core.json, energy_core_stabilizer.json, energy_pylon.json]
6. **Kill the Ender Dragon for the Dragon Heart.** Every dragon kill spawns one **Dragon Heart**, floating with no gravity above the exit portal. The kill also drops about 64 Draconium Dust, and by default a Dragon Egg spawns on every kill, not just the first. [github: 1.20 LootEventHandler.java; DEConfig.java `dragonEggSpawnOverride` default true, `dragonDustLootModifier` default 64]
7. **Draconic tier (Awakened Draconium).** At Wyvern tier, fusion-craft 4 Draconium Blocks (catalyst) + 6 Draconium Cores + 1 Dragon Heart → 4 **Awakened Draconium Blocks**. This is the only Dragon Heart use in the jar's recipes. Then make the **Draconic Core** (4 Wyvern Cores + awakened ingots + a Nether Star), the **Draconic Fusion Crafting Injector**, the **Draconic Energy Controller**, and Draconic gear (Wyvern item + netherite + awakened draconium). [jar: recipes/awakened_draconium_block.json, components/awakened_core.json, machines/awakened_crafting_injector.json, tools/draconic_*.json]
8. **Chaos Guardian.** Chaos Islands generate in the End on a 10,000-block grid by default (`chaosIslandSeparation` = 10000), with the crystal at Y 80. Fight the guardian and break the Chaos Crystal for **Chaos Shards** (5 by default). Each shard splits into 9 **Large Chaos Fragments**. [github: DEConfig.java "Chaos Island" and "Guardian Fight"; jar: worldgen/placed_feature/chaos_island.json, recipes/decompress/large_chaos_frag.json]
9. **Chaotic tier.** The **Chaotic Fusion Crafting Injector** (Draconic tier) needs Large Chaos Fragments + a **Dragon Egg** + diamonds. The **Chaotic Core** needs 4 Draconic Cores + Large Chaos Fragments + awakened draconium. Chaotic gear is fusion-crafted at Chaotic tier. [jar: recipes/machines/chaotic_crafting_injector.json, components/chaotic_core.json, tools/chaotic_*.json]
10. Endgame power: the **Draconic Reactor Core** (Chaos Shard catalyst + awakened draconium + Large Chaos Fragments) with Reactor Stabilizers and Reactor Injectors, all at Chaotic tier. [jar: recipes/machines/reactor_core.json, reactor_injector.json]

**Corrections to the first-draft summary**
- **The order is wrong.** The summary has Draconium core → Ender Dragon (dragon heart) → Wyvern. **Wyvern needs a Nether Star (the Wither), not the Dragon Heart.** The **Dragon Heart is needed only for Awakened Draconium**, which is the Draconic tier. The correct order is: Draconium → **Wither (Nether Star)** → Wyvern → **Ender Dragon (Dragon Heart)** → Draconic (Awakened Draconium) → Chaos Guardian (chaos shards) + **Dragon Egg** → Chaotic.
- The in-game tier names are **Draconium / Wyvern / Draconic / Chaotic** (for example "Draconic Fusion Crafting Injector" and "Draconic Core"). "Awakened" is the material (Awakened Draconium), not a gear tier.
- One heart covers 4 Awakened Draconium Blocks (36 ingots). Each dragon kill (respawn the dragon) gives another heart. The heart **floats above the exit portal**, so warn players not to miss it.
- The summary should say where draconium ore spawns: Overworld deepslate (Y -64 to -48), plus the Nether and the End.

**Version caveats**
- Many online guides are for 1.12 (DE 2.x). They describe a different Chaos Guardian fight, the old Information Tablet / Project Intelligence docs, old recipes and different tier gating. In 1.20.1 there is effectively no in-game documentation.
- In 1.20.1 the dragon drops one heart per kill. Fan sites (reposts) claim the guardian drops 2 hearts. The 1.20 branch loot code adds the heart only for `EnderDragon`. The guardian only adds Draconium Dust. Treat "guardian drops hearts" as **(unverified / likely false for 1.20.1)**.
- Several things in the repo's own "End" notes can change the fight and need an in-game check: YUNG's Better End Island and the "dragonfight" mod may alter how DE's heart and egg handling fires **(unverified)**.
- The Chaos Island coordinates (exact grid offset from 0,0) are **(unverified)**. Only the 10,000-block separation default is confirmed.

### MachineMuse's Modular Powersuits (2.3.13; Numina 2.3.13)

**References**
- GitHub repo: https://github.com/Lehjr/MachineMusePowersuits. Its branch list includes `1.20.1-Forge`, which matches the pack. The README covers only the 1.21.1 branch, and there is no wiki tab.
- Modrinth: https://modrinth.com/mod/modularpowersuits (checked through the API). Its game versions are 1.19.2, 1.19.3, 1.21.1 and 1.21.11, so **no 1.20.1 build is on Modrinth**; the pack's jar presumably comes from CurseForge (unreachable). The description says: build a Tinker Table and a powersuit item, and the Tinker Table lists the modules and their component costs.
- No official wiki or in-game guide was found. The jar has no Patchouli book.

**Verified survival progression**
1. Craft the **Power Armor Tinker Table** (iron, gold, blue dye, crafting table). [jar: data/powersuits/recipes/tinkertable.json]
2. Craft Numina **Wiring**: 2 copper + 1 redstone makes 8. The base items are made from Wiring + iron: **Power Armor Helmet**, **Power Armor Chestplate**, leggings, boots and the **Power Fist**. [jar: numina recipes/components/wiring.json; powersuits/recipes/powerarmor_*.json, power_fist.json]
3. **Make and install a battery first.** A **Basic Battery** (steel ingots, Wiring, redstone, Control Circuit) is what lets an item store energy. Its tooltip reads "Integrate a battery to allow the item to store energy". Upgrade path: Advanced → Elite (steel) → **Ultimate Battery** (needs **electrum**, which Thermal provides). [jar: numina recipes/energy_storage/*.json; numina lang]
4. Make the intermediate components: **Solenoid** (Wiring + iron), **Servo Motor**, and **Control Circuit** (Wiring, redstone, glowstone, gold, dye). Use them for the first modules: **Iron Plating**, the Power Fist **pickaxe/axe/shovel** modules, Sprint Assist and Jump Assist. [jar: numina recipes/components/*.json; powersuits/recipes/modules/*]
5. Mid-tier components: the **Hologram Emitter** (glass, wiring, dyes, glowstone) leads to the **Computer Chip** (diamond, comparators, daylight detector). The **Force Field Emitter** (solenoids + ender pearls) leads to the **Ion Thruster**. These gate **Diamond Plating**, the **Energy Shield**, **Night Vision**, the **Solar Generator**, and so on. [jar: numina recipes/components/hologram_emitter.json, computer_chip.json, field_emitter.json, ion_thruster.json; powersuits/recipes/modules/armor/*, energy_generation/*]
6. Late modules: **Jetpack**, **Flight Control**, **Blink Drive**, **Plasma Cannon**, Railgun, **Netherite Plating**, Vein Miner and Tunnel Bore. Charge suits with the **Charging Base** (Wiring, Basic Battery, Control Circuit, blackstone pressure plates) or an external FE charger. [jar: powersuits/recipes/modules/movement/*.json, weapon/*.json, armor/netherite_plating.json; numina recipes/blocks/charging_base.json]
7. Install, salvage and tweak modules in the Tinker Table GUI ("Install/Salvage" and "Tinker" tabs). Tradeoffs such as jetpack thrust are tuned there. [jar: powersuits lang `gui.powersuits.tab.install.salvage`, `module.tradeoff.*`]

**Corrections to the first-draft summary**
- The summary leaves out that **armor and tools need a battery module** (Basic Battery and up) to hold power. The Basic Battery already needs **steel**, and the Ultimate Battery needs **electrum**. Every module is built from **Numina components** (Wiring, Solenoid, Servo Motor, Control Circuit, Computer Chip, Force Field Emitter, Ion Thruster). Their key materials are copper, gold, glowstone, diamonds and ender pearls.
- Otherwise the line is accurate.

**Version caveats**
- Numina 2.3.13 ships its language file as `assets/numina/lang/us_en.json`, not `en_us.json`, and MPS's en_us.json defines no `item.numina.*` keys. Numina components and batteries will therefore likely show **raw translation keys** in-game (for example `item.numina.component_wiring`) **(likely; verify in-game)**. The names in this file come from that `us_en.json`.
- Older (1.7.10/1.12) MPS guides describe component recipes, module names and a different power system. They don't apply here. Modrinth has no 1.20.1 build, so guides tied to Modrinth versions are for other Minecraft versions.

---

## Major mods — Magic

### Botania (1.20.1-456)

**References**
- **Official site:** https://botaniamod.net/index.html, linked from the jar's `mods.toml` displayURL `https://botaniamod.net`. It is the mod's home page and is not tied to a version.
- **Official online lexicon:** https://botaniamod.net/lexicon.html. The page itself says it is a verbatim copy of the Lexica Botania, fed from the *bleeding-edge* Patchouli book, and that it "may be ahead of the currently-available Botania version". It is usable for 1.20.1, but where it disagrees, the in-game book wins.
- **Official changelog:** https://botaniamod.net/changelog.html (fetched). It covers all versions.
- **GitHub repo:** https://github.com/VazkiiMods/Botania. Branch `1.20.x` was shown, which matches the pack.
- **Modrinth (API):** https://api.modrinth.com/v2/project/botania. It lists 1.20.1, gives no wiki URL and points its source to the GitHub repo above.
- **In-game guide: Lexica Botania** (`botania:lexicon`, a Patchouli book). It is crafted shapeless from any sapling and a Book [jar: data/botania/recipes/lexicon.json]. The Elven half of the book is unlocked by trading the Lexica through the Alfheim portal [jar: data/botania/recipes/elven_trade/lexicon_elven.json].

**Verified survival progression**
1. Collect Mystical Flowers and petals, craft the **Lexica Botania**, then craft a **Petal Apothecary** (cobblestone and petals) [jar: data/botania/recipes/lexicon.json, apothecary_default.json; advancement main/flower_pickup].
2. Make a **Pure Daisy** in the apothecary. It turns adjacent logs and stone into **Livingwood** and **Livingrock** [jar: data/botania/recipes/pure_daisy/livingwood.json, livingrock.json; advancement main/pure_daisy_pickup].
3. Craft a **Wand of the Forest**, a generating flower (**Endoflame** or Hydroangeas), a **Mana Spreader** and a **Mana Pool**. In 1.20 the spreader needs a copper ingot (livingwood, copper, petal), and the pool is 5 Livingrock [jar: data/botania/recipes/mana_spreader.json, mana_pool.json; advancement main/generating_flower → main/mana_pool_pickup].
4. Infuse items in the pool to get Manasteel Ingots, Mana Pearls and Mana Diamonds. Build the **Runic Altar** from Livingrock plus a Mana Pearl, or a Mana Diamond in the alternate recipe, and make the elemental runes [jar: data/botania/recipes/runic_altar.json, runic_altar_alt.json; advancement main/rune_pickup].
5. Build the **Terrestrial Agglomeration Plate**: lapis blocks, the Water, Fire, Earth, Air and Mana runes, and a manasteel block. Place it on a Livingrock/Lapis checkerboard and toss on 1 Manasteel Ingot, 1 Mana Pearl and 1 Mana Diamond. That gives a **Terrasteel Ingot** for 500,000 mana [jar: data/botania/recipes/terra_plate.json, terra_plate/terrasteel_ingot.json; advancement main/terrasteel_pickup].
6. Craft the **Elven Gateway Core** (Livingwood and **Terrasteel nuggets**) and the **Natura Pylons** (Mana Pylon, Terrasteel nuggets, Eye of Ender). Build the portal from 8 Livingwood and 3 Glimmering Livingwood, with at least 2 Mana Pools that each have a Natura Pylon above them. Activate it with the Wand of the Forest [jar: data/botania/recipes/alfheim_portal.json, natura_pylon.json; lexicon page botania.page.aIntro1/aIntro5; advancement main/elf_portal_open, whose parent is terrasteel_pickup].
7. Trade through the portal for **Elementium Ingots**, **Pixie Dust**, **Dragonstone**, Dreamwood and elven quartz. Toss the Lexica in to unlock elven knowledge [jar: data/botania/recipes/elven_trade/*.json; advancement main/elf_lexicon_pickup].
8. Craft **Gaia Pylons** (Mana Pylon, Elementium, Pixie Dust) and place them around an active Beacon. Sneak-right-click the beacon with a Terrasteel Ingot to fight the **Guardian of Gaia**, which drops **Gaia Spirit** [jar: data/botania/recipes/gaia_pylon.json; loot_tables/gaia_guardian.json; lexicon botania.page.gaiaRitual0/3; advancement main/gaia_guardian_kill].
9. Optional endgame: a **Gaia Spirit Ingot** summons the harder Guardian. Its drops include the **Dice of Fate**, which rolls the Relics of the Aesir, plus the Ancient Wills [jar: data/botania/recipes/gaia_ingot.json; loot_tables/gaia_guardian_2.json; lexicon gaiaRitualHardmode1, relicInfo0]. Gaia Spirit also gates the **Flügel Tiara**, the Gaia Mana Spreader and similar items [advancement main/tiara_wings, whose parent is gaia_guardian_kill].

**Corrections to the first-draft summary**
- **Order is wrong.** Terrasteel comes **before** the elven gateway. The Elven Gateway Core and the Natura Pylons are both crafted from **Terrasteel nuggets**, and the advancement `elf_portal_open` has `terrasteel_pickup` as its parent. The correct order is Pure Daisy → mana spreader/pool → runic altar → **terrasteel → elven gateway (Alfheim portal)** → Gaia Guardian.
- It is also worth saying that Alfheim is a trade portal: players cannot enter it. The Gaia Guardian needs Alfheim materials (Elementium and Pixie Dust for the Gaia Pylons), and the fight takes place at a Beacon.

**Version caveats**
- botaniamod.net/lexicon.html tracks the newest dev book and may be ahead of 456. Pre-1.13 guides (and many older videos) are badly out of date: they cover metadata flowers, the older portal, and Terrasteel made with a different recipe or amount of mana.
- The 1.20.1 Mana Spreader recipe uses a **copper ingot**. Older guides show gold.
- The Runic Altar accepts either a Mana Pearl or a Mana Diamond (two recipes).

### ProjectE (PE1.0.1, MC 1.20.1) + AppliedE

**References**
- In-game guide: **None**. The jar has no Patchouli book or manual item. Upstream has an unmerged `patchouli_book` branch only. The **Tome of Knowledge** is *not* a guide: it unlocks all transmutation knowledge, and its recipe is disabled by default (`craftableTome=false` in the common config) [jar: data/projecte/recipes/tome.json conditions; upstream CommonConfig.java].
- GitHub repo: https://github.com/sinkillerj/ProjectE. The `mc1.20.x` branch gradle.properties says `projecte_version=1.0.1`, `minecraft_version=1.20.1`. Commit log: "Initial port to 1.20.1" on 2023-10-29, PE1.0.0B on 2023-11-11, PE1.0.1 on 2023-11-26. The Releases page is empty. The repo's Changelog.txt only covers the legacy 1.7.10 builds.
- GitHub wiki: https://github.com/sinkillerj/ProjectE/wiki. Fetched: about 56 pages, marked "under construction", with no version noted. https://github.com/sinkillerj/ProjectE/wiki/Energy-Condenser was last edited 2024-09-20 and shows only Mk1 and Mk2, consistent with the jar.
- CurseForge: README links https://www.curseforge.com/minecraft/mc-mods/projecte/files (unreachable from here). Modrinth: the API has no "projecte" project, so it is likely not on Modrinth (unverified).

**Verified survival progression**
1. Craft the **Philosopher's Stone** (diamond + redstone + glowstone; two layouts). It handles world transmutation, opens a portable crafting grid by keybind, and makes fuel upgrades [jar: recipes/philosophers_stone.json, philosophers_stone_alt.json; advancement: philosophers_stone].
2. Craft the **Transmutation Table** (obsidian + stone + Philosopher's Stone). Burning an item there **learns** it and adds its EMC to your personal pool. You can then create any learned item from EMC [jar: recipes/transmutation_table.json; advancement: transmutation_table].
3. Fuels (shapeless, each with the Philosopher's Stone): 4 Coal → **Alchemical Coal**, 4 Alchemical Coal → **Mobius Fuel**, 4 Mobius Fuel → **Aeternalis Fuel**. **Klein Star Ein** (mobius + diamond) up to **Klein Star Omega** stores EMC [jar: recipes/alchemical_coal.json, mobius_fuel.json, aeternalis_fuel.json, klein_star_ein.json; advancements klein_star_ein → klein_star_omega].
4. **Covalence Dust** (Low: cobblestone + charcoal, ×40) goes into the **Alchemical Chest** and Alchemical Bags [jar: recipes/low_covalence_dust.json, alchemical_chest.json; advancement: alchemical_chest].
5. **Energy Condenser** = obsidian + diamonds + **Alchemical Chest**. **Energy Collector MK1** = glowstone + glass + diamond block + furnace. Collectors generate EMC from light and can also upgrade fuel items. **Anti-Matter Relay MK1** (obsidian + glass + diamond block) links collectors to condensers [jar: recipes/condenser_mk1.json, collector_mk1.json, relay_mk1.json; advancements condenser → collector → relay].
6. **Dark Matter** = 8 Aeternalis Fuel + 1 Diamond Block. That unlocks **Dark Matter Block**, DM tools and armor, the **Dark Matter Furnace**, **Energy Collector MK2** and **Anti-Matter Relay MK2** [jar: recipes/dark_matter.json, collector_mk2.json; advancements dark_matter → dark_matter_block/pickaxe/furnace].
7. **Red Matter** = 6 Aeternalis Fuel + 3 Dark Matter. That unlocks RM tools and armor, **Red Matter Furnace**, **Energy Collector MK3**, **Anti-Matter Relay MK3**, and **Energy Condenser MK2**, which needs Red and Dark Matter Blocks around a Condenser [jar: recipes/red_matter.json, collector_mk3.json, condenser_mk2.json; advancement red_matter → red_matter_block/pickaxe/furnace].
8. **Transmutation Tablet** (portable table) = Transmutation Table + Dark Matter Blocks + stone. Late extras: **Dark Matter Pedestal** (needs red matter), Gem armor, Klein Star Omega [jar: recipes/transmutation_tablet.json, dm_pedestal.json; advancement: transmutation_tablet].
9. AE2 link (AppliedE). After you have a Transmutation Tablet, Red Matter Blocks and ae2 Singularities, the **ME Transmutation Module**/**ME Transmutation Terminal** exposes your EMC to an ME network for transmutation and autocrafting [jar: appliede recipes/emc_module.json, transmutation_terminal.json; appliede ae2guide/transmutation_module.md].

**Corrections to the first-draft summary**
- "collectors/condensers (Mk1–Mk3)" is **wrong for condensers**. Collectors and Anti-Matter Relays go up to **MK3**, but there are only two condensers: **Energy Condenser** (Mk1) and **Energy Condenser MK2**. No MK3 condenser exists (jar recipes plus the GitHub wiki page).
- Add the **Alchemical Chest** step, since the condenser recipe requires it, and the alchemical fuel ladder (Alchemical Coal → Mobius → Aeternalis), which is the actual gate to Dark Matter.
- The Dark Matter Pedestal and Transmutation Tablet are post-dark-matter, and AppliedE needs Red Matter Blocks. AppliedE is late game, not a mid-game AE2 tie-in.
- TconEmc (Tinkers' EMC values) was not checked.

**Version caveats**
- PE1.0.1 is **not a ground-up rewrite**. The "PE1.0.x" numbering restarted with the 1.18.2 port (2022), and 1.20.1-PE1.0.1 is a port of the 1.19.2 code with 1.20 additions: EMC/world-transmutation values for 1.20 blocks, trimmable DM/RM/gem armor, and a 1,000-EMC buffer cap on Alchemical Chests and DM Pedestals. EMC values are data-driven (`pe_custom_conversions`). The 1.7.10/1.12 Changelog.txt and older wikis can be outdated, especially about power flowers, which came from EE2/ProjectEX and are not in ProjectE (only the advancement name "Power flowers!" remains), and about a craftable Tome.
- No in-game guide exists. Players need JEI, which shows world transmutations and "Collector Fuel Upgrades".

### EvilCraft (1.3.3)

**References**
- **Official site:** https://evilcraft.rubensworks.net/ (fetched). It describes the Blood Infuser, Purifier, Spirit Furnace and Dark Temples ("Ancient structures hold Environmental Accumulators").
- **Official online book:** https://evilcraft.rubensworks.net/book/ (fetched). This is the web version of *Origins of Darkness*. Its footer says it was generated from **evilcraft-1.21.1-neoforge-1.2.98**, so it does **not** match the 1.20.1 Forge 1.3.3 jar exactly. Treat it as close but unverified for 1.20.1.
- **GitHub wiki:** https://github.com/CyclopsMC/EvilCraft/wiki. It has only 7 pages (Home, Advancements, commands, developer and MineTweaker pages), no progression guide, and links to the online book.
- **GitHub repo:** https://github.com/CyclopsMC/EvilCraft. It is listed as the source on Modrinth; the repo page itself could not be opened from here.
- **Modrinth (API):** https://api.modrinth.com/v2/project/evilcraft. It lists 1.20.1 and 1.20.4, and its wiki link points to the GitHub wiki.
- **CurseForge:** https://www.curseforge.com/minecraft/mc-mods/evilcraft is the jar's displayURL. It was unreachable (403).
- **In-game guide: Origins of Darkness** (`evilcraft:origins_of_darkness`). The jar has **no crafting recipe** for it. It is injected with a **20% chance** into the bonus chest, village toolsmith/weaponsmith/shepherd, nether fortress, dungeon, mineshaft, jungle temple, igloo and ancient city chests [jar: data/evilcraft/loot_modifiers/inject_origins_of_darkness_chests.json; advancement evil_source]. It is also tagged as a lectern/bookshelf book. A config option might give it on first spawn, but this is unverified.

**Verified survival progression**
1. Mine **Dark Ore** (needs an iron pickaxe; found around redstone depth and sometimes higher; Fortune also gives Crushed Dark Gems) to get **Dark Gems** [jar: book.xml first_age.new_world.dark_ore; advancement first_age "First Age"].
2. Find a Dark Temple. Its core is an **Environmental Accumulator**, which is **not craftable**. Throw a **Weather Container** (glass bottle and Dark Gem) into it to capture weather, and use thunderstorms to empower items [jar: book.xml first_age.new_world.dark_temple; recipes/environmental_accumulator/*].
3. Craft **Dark Spikes** (Dark Gem and iron ingot, makes 16) and then the **Blood Extractor** (3 Dark Spikes, glass, Dark Gem). Kill mobs with it in your inventory, or shift-right-click blood stains [jar: recipes/crafting/dark_spike.json, blood_extractor.json; advancement second_age "Second Age"].
4. Toss a Dark Gem into a pool of at least 5 Blood source blocks to get a **Dark Power Gem**. Break Hardened Blood with Flint and Steel to get **Hardened Blood Shards** [jar: book.xml second_age.powers_of_blood].
5. Craft the **Blood Infusion Core** (8 Hardened Blood Shards around a Dark Power Gem), then the **Blood Infuser** (cobblestone around the core) [jar: recipes/crafting/blood_infusion_core.json, blood_infuser.json].
6. Raise the infuser's tier with **Promises of Tenacity** (tiers 1 to 3), made from Bowls of Promises and iron, gold and diamond Promise Acceptors. Infuser recipes are gated at tiers 0 to 3. Side machines include the **Purifier**, Blood Chest, Sanguinary Pedestal and Exalted Crafter [jar: recipes/crafting/promise_tier_*.json, blood_infuser/core/*; "tier" field in blood_infuser/*; advancement power_crafting].
7. Catch Vengeance Spirits with a **Vengeance Focus** into a **Box of Eternal Closure** (Crushed Dark Gems, Potions of Weakness, Ender Chest) [jar: recipes/special/box_of_eternal_closure.json; advancement closure].
8. Infuse Dark Bricks into **Dark Blood Bricks** (infuser tier 2). Build the **Spirit Furnace** multiblock, a hollow cube of Dark Blood Bricks with one Spirit Furnace block (Dark Blood Bricks around a Blood Infusion Core). It turns boxed spirits into mob drops for Blood. The **Spirit Reanimator** respawns boxed spirits as live mobs [jar: recipes/crafting/spirit_furnace.json, blood_infuser/base/dark_blood_brick.json; advancement spirit_cooker].
9. Make a **Piercing Vengeance Focus** to kill spirits for **Vengeance Essence**. Turn that into Materialized Vengeance Essence, then infuse 50 B of Blood at **tier 3** into **Garmonbozia** [jar: recipes/crafting/vengeance_essence_materialized.json, blood_infuser/base/garmonbozia.json].
10. Garmonbozia endgame: the **Sanguinary Environmental Acc.** (a Blood-powered accumulator that needs an **Environmental Accumulation Core**, dropped by breaking a temple's Environmental Accumulator, and 8 surrounding blood tanks), the **Mace of Destruction**, Primed Pendant and others [jar: recipes/crafting/sanguinary_environmental_accumulator.json, mace_of_destruction.json]. Side line of weapons: Mace of Distortion → Necromancer's Staff [advancements master_distorter, player_devastator].

**Corrections to the first-draft summary**
- "Spirit Furnace" is correct: it is an in-game block and it has its own advancement (`spirit_cooker`, child of `second_age`).
- **"Environmental Accumulator" is misleading as a gate you build.** The Environmental Accumulator is a **non-craftable First Age block found in Dark Temples**. You use it early by throwing Weather Containers into it. The craftable late-game machine is the **Sanguinary Environmental Acc.** (in-game name), which needs **Garmonbozia** and the Environmental Accumulation Core.
- Missing: there is no separate "blood infuser tiers" machine. Tiers come from **Promises of Tenacity** inserted into the one Blood Infuser.
- Missing: the true capstone material is **Garmonbozia**.

A suggested rewrite: Dark Gems → Blood Extractor → Dark Power Gem / Blood Infuser (upgraded with Promises) → Box of Eternal Closure → Spirit Furnace → Garmonbozia → Sanguinary Environmental Acc. / Mace of Destruction. Environmental Accumulators are Dark Temple cores used early with Weather Containers.

**Version caveats**
- The online book is generated from the **1.21.1 NeoForge** build (1.2.98), not 1.20.1 Forge 1.3.3. Recipes may differ, so use the in-game book.
- The book is a **loot-only** item in this jar (20% per listed chest type). Many older guides say to craft it from a Book and a Dark Gem, which is not true here.

---

## Major mods — Resources and tools

### Mystical Agriculture (7.0.24, MC 1.20.1; no Mystical Agradditions)

**References**
- In-game guide: Patchouli book **Mystical Agriculture**, made shapeless from **Book + Inferium Essence**. The recipe is conditional on Patchouli being installed, which it is in this pack [jar: data/mysticalagriculture/recipes/guide_book.json; patchouli_books/guide/book.json]. Its landing text links to the online wiki.
- Official wiki: https://blakesmods.com/wiki/mysticalagriculture and https://blakesmods.com/wiki/mysticalagriculture/guides/getting-started. **It serves the 26.1 version by default.** The version picker is JS-only, and `?version=1.20` did not visibly change content (unverified). The content I checked (getting started, creating seeds, infusion crystals, awakening altar, awakened supremium, cognizant dust) matches 7.0.24 jar data, except where noted under caveats.
- Docs (config/modpack): https://blakesmods.com/docs/mysticalagriculture (linked from the README, not fetched).
- GitHub repo: https://github.com/BlakeBr0/MysticalAgriculture. The `1.20` branch's last commit is "Release 7.0.24", an exact match.
- Modrinth: https://modrinth.com/mod/mystical-agriculture (API confirmed for 1.20/1.20.1). CurseForge is linked from the README (unreachable).

**Verified survival progression**
1. Get **Inferium Essence** from **Inferium Ore** (Overworld, Y −32 to 64) and from mob kills, and **Prosperity Shard**s from **Prosperity Ore** (Overworld, Y −60 to 24) [jar: worldgen/placed_feature/inferium_ore.json, prosperity_ore.json; wiki getting-started]. Make the guide book and a **Wand** (stick + stone + inferium).
2. Craft **Inferium Seeds** (8 Inferium Essence + wheat seeds) and grow them. Right-click Farmland with essence, or craft, to make **Inferium Farmland** etc. Essence Farmland raises yield and gives second-seed chances [jar: recipes/inferium_seeds.json; manual basics/essence_farmland].
3. Craft the **Infusion Crystal** (prosperity shards + inferium + diamond; 1000 uses per the wiki). Upgrade essence **on a crafting table**: 4 lower essence + crystal gives 1 next tier, along the chain **Inferium → Prudentium → Tertium → Imperium → Supremium Essence** [jar: recipes/infusion_crystal.json, prudentium_essence.json … supremium_essence.json].
4. Build the **Infusion Altar** plus 8 **Infusion Pedestal**s (gold, red wool, stone). Activate with the Wand or a redstone signal [jar: recipes/infusion_altar.json, infusion_pedestal.json; manual basics/infusion_altar].
5. Make resource seeds on the altar: centre = **Prosperity Seed Base** (prosperity shards + wheat seeds), pedestals = the resource plus the crop's tier essence. Plain crafting-table seed recipes exist in the jar but are off by default (`seedCraftingRecipes=false`) [jar: recipes/seed/infusion/*.json, seed/crafting/*.json conditions; upstream ModConfigs.java]. Resource crops cannot be bonemealed.
6. Speed things up and add gear: **Growth Accelerator**s (Inferium–Supremium), essence ingots, tools, armor and upgrades, plus the **Tinkering Table** and augments. These need **Soulium Dust**, which comes from **Soulium Ore** in **Soulstone** veins in the Nether [jar: recipes/*_growth_accelerator.json, tinkering_table.json; forge/biome_modifier/soulstone.json].
7. Mob seeds: **Soulium Seed Base** (Prosperity Seed Base + 2 Soulium Dust) plus filled **Soul Jar**s, collected by killing mobs with a **Soulium Dagger** or via the **Soul Extractor** [jar: recipes/soulium_seed_base.json, soulium_dagger.json; manual souls/soul_jars].
8. Late automation: **Harvester**, **Soulium Spawner**, **Seed Reprocessor**, essence furnaces and machine upgrades [jar: recipes/harvester.json, soulium_spawner.json, seed_reprocessor.json].
9. Endgame: make the **Master Infusion Crystal** (infinite uses; Supremium Gemstone + Supremium Essence + prosperity shards). Grow elemental (Air, Earth, Water, Fire) essences. Enchant an essence weapon with **Mystical Enlightenment** at the **Enchanter** (3 Supremium + 64 Experience Essence) and kill the Wither or Ender Dragon with it for **Cognizant Dust** [jar: recipes/master_infusion_crystal.json, enchanter/mystical_enlightenment.json; wiki cognizant-dust].
10. Build the **Awakening Altar** + 4 **Awakening Pedestal**s + 4 **Essence Vessel**s (Soulstone-based). Infuse a **Supremium Block** with 4 Cognizant Dust and 10 of each elemental essence to get the **Awakened Supremium Block**, which leads to **Awakened Supremium Ingot**s and gear/upgrades with an extra augment slot [jar: recipes/awakening_altar.json, awakened_supremium_block_awakening.json, awakened_supremium_upgrade.json; wiki awakened-supremium].

**Corrections to the first-draft summary**
- The essence tiers and "no Agradditions, so no Insanium" are correct.
- **Missing core gates**: the **Infusion Crystal** (essence upgrades are done on a crafting table, not on the altar) and the **Infusion Altar + 8 pedestals** (how seeds are made by default). Prosperity Shards and seed bases also belong in the chain.
- **Missing endgame**: Soulium/Soul Jars for mob seeds, and **Awakening Altar → Awakened Supremium** using Cognizant Dust from boss kills.
- **Crux**: base MA 7.0.24 has the crux mechanic in its API and JEI ("Requires %s Below"), but **no base crop uses one**. Crux blocks come from Mystical Agradditions, which the pack lacks. Do not mention cruxes in the guide [upstream source: only `Crop.setCruxBlock` definition, no callers].

**Version caveats**
- The online wiki shows **26.1** content. For example, the **Ore Infuser** is listed there but does not exist in 7.0.24 (no item, recipe or lang key in the jar).
- The jar's Patchouli text for the Awakening Altar says the structure is "1 Infusion Altar, 4 Infusion Pedestals and 4 Essence Vessels". That is a text error. The recipes and wiki use the **Awakening Altar** and **Awakening Pedestal**s.
- Seed crafting-table recipes are configured off by default. If the pack enables them, JEI will show both methods.

### Tinkers' Construct (3.11.2.166) + Tinkers' Levelling Addon (1.4.3) + TCIntegrations (2.0.26)

**References**
- **Official docs:** https://slimeknights.github.io/docs/ (fetched). It applies to all versions since 1.16.5.
- **Official gameplay overview:** https://slimeknights.github.io/docs/gameplay/tinkers-construct-3/ (fetched). It covers Tinkers' Construct 3 (MC 1.16+) and matches the 1.20.1 progression. **Do not use** https://slimeknights.github.io/docs/gameplay/tinkers-construct-2 (1.8 to 1.12).
- **Official online books, 1.20:** https://slimeknights.github.io/docs/books/ (index). The 1.20 versions are at https://slimeknights.github.io/docs/books/1.20/materials-and-you/ and https://slimeknights.github.io/docs/books/1.20/tinkers-gadgetry/ (both returned 200), plus puny-smelting, mighty-smelting, fantastic-foundry and encyclopedia under the same path (linked from the index). The site warns that addon content is not shown and that the in-game books are the best source.
- **GitHub repo:** https://github.com/SlimeKnights/TinkersConstruct. The page shows branch 1.20.1, and its README links to the docs above.
- **Modrinth (API):** https://api.modrinth.com/v2/project/tinkers-construct. It lists 1.20.1 and gives https://slimeknights.github.io/docs/ as its wiki.
- **Tinkers' Levelling Addon:** source at https://github.com/Pyre540/tinkers-levelling-addon (from the Modrinth API; not fetched); the jar's displayURL is the CurseForge page (unreachable). Modrinth lists 1.20.1.
- **TCIntegrations:** GitHub wiki at https://github.com/wendall911/TCIntegrations/wiki and source at https://github.com/wendall911/TCIntegrations (both from the Modrinth API; not fetched). Modrinth lists 1.20.1.
- **In-game guides:**
  - **Materials and You** is given on first spawn when the `spawn_with_book` config is on, the default per the docs [jar: data/tconstruct/advancements/internal/starting_book.json, loot_tables/gameplay/starting_book.json]. It is also crafted from a Book and a Pattern [recipes/common/materials_and_you.json].
  - **Puny Smelting:** Book and Grout [recipes/common/puny_smelting.json].
  - **Mighty Smelting:** cast seared stone onto a Book on a casting table [recipes/common/mighty_smelting.json].
  - **Fantastic Foundry:** Book and Nether Grout [recipes/common/fantastic_foundry.json].
  - **Tinker's Gadgetry:** Book and a sky slimeball [recipes/common/tinkers_gadgetry.json].
  - **Encyclopedia of Tinkering:** cast molten gold onto a Book [recipes/common/encyclopedia.json].
  - Tinkers' Levelling Addon adds its "Improvable" page to the Mighty Smelting book and the Encyclopedia.

**Verified survival progression**
1. Make Patterns, then a **Part Builder** and a **Tinker Station** (Patterns over planks). Build tools from wood, stone, flint and other basic parts [jar: recipes/tables/part_builder.json, tinker_station.json; advancements tools/part_builder → tools/tinker_station → tools/tinker_tool].
2. Craft **Grout** (clay ball, sand, gravel, makes 2), smelt it into Seared Bricks, and build the **Seared Melter**, a Seared Heater or fuel tank, a Casting Table, a Casting Basin and a Faucet. Fuel it with solid fuel (800°) or lava (1000°). Use sand casts first, then gold casts [jar: recipes/smeltery/seared/grout.json, melting/fuel/*.json; advancement smeltery/melter].
3. Cast **molten copper onto Seared Bricks** in a basin to make the **Smeltery Controller**, then build the smeltery with seared drains and tanks [jar: recipes/smeltery/casting/seared/smeltery_controller.json; advancement smeltery/structure].
4. Alloy in the smeltery: Slimesteel (iron, sky slime, seared stone), Rose Gold, Amethyst Bronze and Pig Iron. Alloy blocks craft the **Tinker's Anvil**, which unlocks broad tools and stronger modifiers [jar: recipes/smeltery/alloys/*, tables/tinkers_anvil.json, tags/items/anvil_metal.json; advancement smeltery/tinkers_anvil].
5. Explore slime islands (Tinker's Gadgetry book): **earthslime** islands in overworld oceans, **skyslime** islands floating in the sky or over oceans, **clay** islands in the sky, **blood** islands in Nether lava oceans (the source of ichor), and **enderslime** islands on the End outer islands. There are also slime geodes [jar: worldgen/structure/*, book/tinkers_gadgetry/en_us/exploration/island/*; advancements world/*].
6. In the Nether, mine **Nether Cobalt Ore**. It spawns only in `#minecraft:is_nether` biomes: large veins between y=8 and y=32 and small veins at any height. **Cobalt shards** also come from ichor geodes [jar: forge/biome_modifier/cobalt_ore.json, worldgen/placed_feature/cobalt_ore_*.json; book exploration/cobalt_ore.json].
7. Craft **Nether Grout** (magma cream, soul sand or soul soil, gravel). Build the **Scorched Alloyer**, then cast molten obsidian onto scorched bricks to make the **Foundry Controller**. The foundry does not alloy but gives ore byproducts [jar: recipes/smeltery/scorched/nether_grout.json, casting/scorched/foundry_controller.json; advancements foundry/alloyer → foundry/structure].
8. Get **Blazing Blood**, which as fuel runs at 1500°. Sources are melting blazes in the smeltery or foundry, melting blaze heads, or melting ichor. It is required for Nether alloys above lava's 1000°: **Manyullyn** (cobalt and debris, 1200°), **Queen's Slime** (1150°), **Hepatizon** (1400°) and Cinderslime (1050°) [jar: recipes/smeltery/melting/fuel/blaze.json, alloys/molten_manyullyn.json etc., entity_melting/blaze.json; advancement foundry/blaze]. These alloys lead to netherite-tier tools and **Plate Armor** [advancements tools/netherite_tier, foundry/plate_armor].
9. **Modifiers start immediately and are not the last step.** Tools have about **3 upgrade slots** and **1 ability slot** (at most 2 more ability slots). Armor also has **defense** slots. **Slotless** modifiers include bonus-slot modifiers such as writable, recapitated, harmonious, forecast and gilded. Modifiers are applied in the Tinker Station or Anvil, and the **Modifier Worktable** configures or removes them [jar: book/materials_and_you/en_us/modifiers/*; advancements tools/modified, tools/upgrade_slots].
10. Addons:
    - **Tinkers' Levelling Addon** adds the **Improvable** modifier. Tools level up with use and gain bonus upgrade, ability, defense or soul slots and stats [jar: TinkersLevellingAddon assets/tinkerslevellingaddon/lang/en_us.json].
    - **TCIntegrations** adds materials and modifiers from other mods, e.g. Botania Manasteel, Livingwood, Livingrock and Mana String; Malum Soul Stained Steel; dragonsteels. Its declared optional dependencies include IE, Botania, Aquaculture, Malum and Create. Which ones are active depends on the pack (unverified) [jar: TCIntegrations META-INF/mods.toml, lang].

**Corrections to the first-draft summary**
- **"→ foundry → modifiers" is misleading.** Modifiers and slots are available from the first Tinker Station tool. The foundry is not an upgrade of the smeltery: it is a Nether-tier alternative that **does not alloy** but gives byproducts. Alloying in the Nether tier uses the **Scorched Alloyer** or the smeltery.
- **Missing: cobalt is Nether-only in 1.20.1** (Nether Cobalt Ore, densest at y 8–32), plus shards from ichor geodes. It is not found in the overworld or the End.
- **Missing gate: Blazing Blood.** Manyullyn, Hepatizon, Queen's Slime and Cinderslime cannot be alloyed with lava fuel.
- Slime islands cover 4 dimensions/locations: overworld ocean, overworld sky, Nether lava ocean and End. "Slime islands and the Nether/End" is acceptable, but the End is optional for the main tool progression; its enderslime is mostly for the slimesuit.
- Suggested rewrite: Part Builder/Tinker Station → grout → Seared Melter → smeltery (copper-cast controller) → alloys/Tinker's Anvil → slime islands → Nether cobalt → Nether grout/foundry/alloyer → Blazing Blood → Manyullyn/Hepatizon/Queen's Slime. Modifiers run alongside the whole way (Levelling Addon adds slots with use).

**Version caveats**
- Many online guides describe **Tinkers' Construct 2 (1.12)**: the tool forge, cobalt and ardite ores, a Nether-only Manyullyn made from ardite, and modifier counts. None of that applies here. Ardite does not exist in TC3.
- The anvil-metal tag also accepts bronze, brass, electrum, invar, constantan, enderium, lumium, signalum and other storage blocks when other mods supply them. With Thermal in the pack, the Tinker's Anvil may be craftable from Thermal alloys without Tinkers alloys [jar: tags/items/anvil_metal.json].
- The online books omit addon content (Levelling Addon, TCIntegrations).

---

## Major mods — Adventure

### Alex's Caves (2.0.2)

**References**
- **Wiki:** https://alexscaves.wiki.gg/wiki/Main_Page, listed as the wiki in the Modrinth API. It was **unreachable** (403, Cloudflare block), so its version coverage could not be checked.
- **GitHub repo:** https://github.com/AlexModGuy/AlexsCaves. The page showed branch `main` and no README, wiki or releases.
- **Modrinth (API):** https://api.modrinth.com/v2/project/alexs-caves. It lists 1.20.1.
- **CurseForge:** unreachable (403).
- **In-game guide: Cave Compendium** (`alexscaves:cave_book`). It is crafted shapeless from a Book, a **Cave Tablet** and a gold nugget [jar: data/alexscaves/recipes/cave_book.json; advancement cave_book]. You add entries to it with Cave Codices.

**Verified survival progression**
1. Find an **Underground Cabin**, a structure in ordinary overworld caves. Maps to cabins come from **Cartographer** villagers and are injected into **mineshaft chests** [jar: assets/alexscaves/books/en_us/root.txt; loot_modifiers/cabin_map.json; worldgen/structure/underground_cabin.json].
2. Get **Cave Tablets** from cabins, or from biome-specific vanilla loot [jar: loot_modifiers/cave_tablet_*.json]:
   - Magnetic Caves: bastion chests.
   - Primordial Caves: archaeology at desert wells, desert pyramids, trail ruins and warm or cold ocean ruins.
   - Toxic Caves: jungle temples.
   - Abyssal Chasm: underwater ruins and buried treasure.
   - Forlorn Hollows: woodland mansions.
   - Candy Cavity: witch huts.
3. Translate a tablet with paper at a **Spelunkery Table**, which is found in cabins and has no crafting recipe in the jar. Finishing 3 translations gives a **Cave Codex**. Craft extra codices with paper into a **Cave Biome Map**, which points to the nearest cave biome of that type [jar: root.txt; recipes/cave_map.json (special recipe); advancements cave_tablet → cave_codex → cave_map].
4. **Magnetic Caves:** Neodymium plus iron makes Neodymium ingots. Threats are the **Magnetron** (drops the **Heart of Iron**, used for the **Magnetic Quarry**; also leads to the Resistor Shield), the Teletor (drops the **Telecore**, which leads to the **Galena Gauntlet**), the Notor and the Boundroid [advancements defeat_magnetron, quarry, telecore; jar: recipes/magnetic_quarry.json].
5. **Primordial Caves:** dinosaurs. Craft the **Ominous Catalyst** (Heavy Bones and an Amber Curiosity) and toss it into a volcano to summon the **Luxtructosaurus**, the book's only explicitly named *boss* (600 hp). It drops **Tectonic Shards**, which craft the **Extinction Spear** [jar: books/en_us/primordial_caves/luxtructosaurus.txt; recipes/ominous_catalyst.json, extinction_spear.json; advancements summon/defeat_luxtructosaurus].
6. **Toxic Caves:** uranium and sulfur. Threats are the **Nucleeper** and the **Brainiac**. A Uranium Rod leads to the **Raygun**, **Nuclear Furnace**, **Nuclear Bomb** and Hazmat Armor [advancements uranium → defeat_nucleeper → uranium_rod → raygun / nuclear_bomb; defeat_brainiac → nuclear_furnace_component].
7. **Abyssal Chasm:** deep ocean. You need a Submarine or Diving Suit. Place a Pearl on an **Abyssal Altar** to trade with the **Deep Ones**, who trade the **Magic Conch**, **Gazing Pearl**, **Sea Staff** and **Ortholance**. Threats are the **Hullbreaker** (400 hp; drops the **Immortal Embryo**) and the Mine Guardian [jar: books/en_us/abyssal_chasm/hullbreaker.txt; advancement deep_one_items criteria].
8. **Forlorn Hollows:** Underzealots perform sacrifices that create the **Watcher** (from a Gloomoth; drops the **Occult Gem**, which leads to the Totem of Possession) and the **Forsaken** (from a Vesper; 250 hp; drops **Pure Darkness**, which leads to Shadow Silk, the **Dreadbow** and the Hood and Cloak of Darkness). The Corrodent also lives here [jar: books/en_us/forlorn_hollows/forsaken.txt, watcher.txt; recipes/dreadbow.json, totem_of_possession.json].
9. **Candy Cavity:** the **Gum Worm** (drops the **Sweet Tooth**, which leads to the **Sack of Sating**; it is summoned with a Gobthumper and ridden with Candy Cane Hooks), **Licowitches** (drop Radiant Essence, which leads to the **Conversion Crucible** for converting biomes), the Caniac and the Gumbeeper. Gear includes the Frostmint Spear [jar: books/en_us/candy_cavity/*.txt; recipes/sack_of_sating.json; advancements radiant_essence → conversion_crucible].
10. **Cross-biome capstone:** craft the **Tremorzilla Egg** from Tectonic Shards (Primordial), an Immortal Embryo (Abyssal) and a Tremorsaurus Egg. Hatch it with a nuclear explosion (Toxic) and tame it with Nuclear Waste [jar: recipes/tremorzilla_egg.json; advancements tremorzilla_egg → hatch_tremorzilla_egg → tame_tremorzilla].

**Corrections to the first-draft summary**
- **There are 6 cave biomes, not 5**: Magnetic Caves, Primordial Caves, Toxic Caves, Abyssal Chasm, Forlorn Hollows and **Candy Cavity** (added in 2.0) [jar: data/alexscaves/worldgen/biome/*.json; root.txt "six are known to exist"].
- **Cave maps:** Cartographers sell (and mineshaft chests contain) maps to **Underground Cabins**, not to the biomes. The biome-locating **Cave Biome Map** is **crafted** from Cave Codices, which come from translating Cave Tablets at a Spelunkery Table.
- **"Each biome's boss" overstates it.** Only the **Luxtructosaurus** is described as a boss (summoned, with a red-sky fight). The other biomes have major threats or minibosses instead: Magnetron and Teletor; Nucleeper and Brainiac; Hullbreaker; Forsaken and Watcher (both summoned by Underzealot rituals); Gum Worm and Licowitch.
- **"Endgame cave items"** should name the items: Extinction Spear, Ortholance, Sea Staff, Magic Conch, Galena Gauntlet, Raygun, Nuclear Bomb, Dreadbow, Totem of Possession, Sack of Sating, Conversion Crucible, Magnetic Quarry, and a tamed **Tremorzilla** as the cross-biome capstone.

**Version caveats**
- Guides written for 1.0.x/1.1.x describe **5 biomes** and leave out the Candy Cavity, the Conversion Crucible and the Gum Worm.
- The official wiki could not be reached, so the version it covers is unverified. All facts above come from the 2.0.2 jar.
- The Candy Cavity tablet also injects into `betterwitchhuts` and `nova_structures` witch huts **if those mods are present** (unverified for this pack). Otherwise it uses Alex's Caves' own witch hut table.

---

## Smaller mods

### Hexerei (0.4.2.3)
**References**
- GitHub repo: https://github.com/JoeFoxe/Hexerei-1.19 (fetched; despite the repo name the page shows a `1.20.1` branch. The README was not visible and the repo has no wiki tab.)
- Modrinth: https://api.modrinth.com/v2/project/hexerei (fetched; lists 1.20.1 and 1.21.1, and no wiki URL.)
- CurseForge: unreachable. No official wiki exists, so the in-game book is the primary doc.
- In-game guide: **Book of Shadows**. Crafted shaped from 2 Leather, a Book, Sage Seeds and one tallow item (Animal Fat, a candle or honeycomb). Sage Seeds come from breaking grass. Place the book on an **Altar** (willow / witch hazel / mahogany altar) to read it. [jar: data/hexerei/recipes/book_of_shadows.json, data/hexerei/tags/items/tallow_meltable.json, lang tooltip "Break grass to find."]

**Verified survival progression**
1. Explore swamps and the new Willow Swamp biome for willow, witch hazel and mahogany trees, Mandrake, Sage, Belladonna, Mugwort and Yellow Dock, and Selenite geodes. Animal Fat drops from cows, pigs and sheep. [jar: data/hexerei/forge/biome_modifier/*, data/hexerei/loot_modifiers/*]
2. Craft the **Book of Shadows** and an **Altar** to read it on. [jar: recipes/book_of_shadows.json, recipes/witch_hazel_altar.json]
3. Craft the **Mixing Cauldron**: a Cauldron, 2 Torches and 5 Iron Ingots. It is the hub for nearly every Hexerei recipe, which uses 8 items plus a fluid. Make the **Drying Rack** (Herb Drying Rack) and the **Pestle and Mortar** to process herbs. [jar: recipes/mixing_cauldron.json, recipes/herb_drying_rack.json, recipes/pestle_and_mortar_from_mixing_cauldron.json]
4. Heat the cauldron by putting a heat source under it, fill it with lava and make the **Blood Sigil** (4 Redstone + 4 Polished Blackstone). Put the sigil in the cauldron and jump in 3 times to bleed, then bottle the result as a **Bottle of Blood**. [jar: recipes/blood_sigil_from_mixing_cauldron.json; lang tooltip.hexerei.bottle_blood_shift]
5. Brooms are the tier ladder. All are made in a water-filled Mixing Cauldron with Bottle of Blood, Mandrake Root, wheat and the wood type's logs:
   - **Willow Broom**: 2 Gold Blocks.
   - **Witch Hazel Broom**: a Diamond.
   - **Mahogany Broom**: a Netherite Ingot. It is the fastest broom and fire-resistant as an item.
   [jar: recipes/willow_broom_from_mixing_cauldron.json, witch_hazel_broom_…, mahogany_broom_…; book text items_mahogany_broom_1]
6. Broom upgrades: Broom Brush, then Enhanced Broom Brush and Moon Dust Brush (drying rack). Further upgrades are the Broom Seat, the waterproof tip and the **Broom Netherite Tip**, which needs a heated cauldron with lava, a Selenite Shard, 3 Netherite Ingots and 4 Netherite Scrap, and lets the broom fly through lava. [jar: recipes/broom_netherite_tip_from_mixing_cauldron.json; book items_broom_netherite_tip_1]
7. Optional side gear: Witch armor (hat, chestplate, boots), the Crow Ankh Amulet (needs a Totem of Undying in a Regeneration-potion cauldron), satchels, the Crystal Ball, Courier depots and crow/owl familiars. [jar: recipes/crow_ankh_amulet_from_mixing_cauldron.json, recipes/witch_*.json]

**Corrections to the first-draft summary**: None. Optionally add that the broom ladder runs gold blocks, then diamond, then netherite, all gated on Bottles of Blood.

**Guide size**: Keep as a smaller mod. There is one short ladder (cauldron → blood → three brooms + netherite tip), and the Book of Shadows already covers it in game.

### Reliquary (2.0.65 — Reliquary Reincarnations)
**References**
- GitHub wiki: https://github.com/P3pp3rF1y/Reliquary/wiki (fetched). It has 9 pages: Blocks, Chargeable items, Other items, Mob drops, Tome of Alkahestry, Handgun, Potion System, Compat. **Outdated**: last edited 2017, and the Mob-drops page is from 2016. It names old items (Zombie/Skeleton/Creeper Pearls) and omits the Witch Hat and Guardian Spike drops. Use the jar data for 1.20.1.
- GitHub page: https://github.com/P3pp3rF1y/Reliquary/wiki/Mob-drops-and-crafting-ingredients (fetched; no drop rates).
- GitHub repo: https://github.com/P3pp3rF1y/Reliquary (via Modrinth API; the jar's issueTracker points here).
- CurseForge: https://www.curseforge.com/minecraft/mc-mods/reliquary-reincarnations (search result and the jar's displayURL; fetching it failed).
- In-game guide: none found in the jar (no Patchouli book). Use JEI.

**Verified survival progression**
1. Farm Reliquary mob drops. Each needs a **player kill** and has a base 2–3% chance, raised by Looting (and Severing). The drops:
   - Zombie Heart (zombies, husks, zombified piglins)
   - Rib Bone (skeleton/stray)
   - Withered Rib (wither skeleton)
   - Chelicerae (spiders)
   - Catalyzing Gland (creeper/ghast)
   - Eye of the Storm (*charged* creeper)
   - Slime Pearl (slime)
   - Molten Core (blaze/magma cube)
   - Nebulous Heart (enderman)
   - Witch Hat (witch)
   - Bat Wing, Squid Beak, Frozen Core (snow golem), Guardian Spike

   [jar: data/reliquary/loot_tables/inject/entities/*.json]
2. Early relics are single crafts from those drops, for example the Infernal Claw (Leather, Molten Core, Rib Bone, Slime Pearl) and the Void Tear (Ghast Tear, Nebulous Heart, Slime Pearl, Lapis). [jar: recipes/infernal_claw.json, recipes/void_tear.json]
3. **Hunter's Handgun**: the Barrel, Grip and Hammer Assemblies, plus iron and a Slime Pearl. Load it with magazines and bullets crafted from mob drops. [jar: recipes/handgun.json, recipes/barrel_assembly.json, recipes/bullets/, recipes/magazines/]
4. Potions: the **Apothecary Mortar** grinds ingredients into potion essence. The **Apothecary Cauldron** (Cauldron, 2 Catalyzing Glands, 3 Nebulous Hearts, 2 Infernal Claws, a Molten Core) brews it. [jar: recipes/apothecary_cauldron.json; lang tooltips]
5. **Tome of Alkahestry**: a Book, Molten Core, Witch Hat, Eye of the Storm, Catalyzing Gland, Slime Pearl, Chelicerae, Nebulous Heart and a Wither Skeleton Skull. Charge it with redstone or glowstone, then use it to duplicate common materials. The **Altar of Light** (Obsidian, Redstone Lamp, Nebulous Heart, Catalyzing Gland) grows glowstone from redstone. [jar: recipes/alkahestry_tome.json, recipes/alkahestry/*, recipes/alkahestry_altar.json]
6. Upgrade chains:
   - Void Tear → **Infernal Tear** (+ Witch Hat, Molten Core, Infernal Claw).
   - Angelheart Vial ×3 + Angelic Feather → **Phoenix Down**.
   - Mob Charm Fragments → **mob charm** → **Charm Belt**.
   - **Pedestals** automate placed relics.

   [jar: recipes/infernal_tear.json, phoenix_down.json, mob_charm.json, mob_charm_belt.json, recipes/pedestals/]

**Corrections to the first-draft summary**: Minor additions. Drops need a player kill at about 2–3% base (Looting helps), so expect a grind. Also mention the Apothecary potion system and the Void Tear → Infernal Tear and Phoenix Down chains. The official wiki is 2016–2017 era and should not be cited for 1.20.1 details.

**Guide size**: Keep as a smaller mod. Progression is a flat mob-drop grind with only 1–2 crafting steps per item, so one table of drops and key relics is enough.

### AgriCraft (4.0.6)
**References**
- Official wiki/docs: https://agricraft.github.io/ (fetched). Its version table lists only 1.21 (in progress), 1.20.4 ("experimental"), 1.18 ("only supported version") and 1.7.10–1.16 (closed). **1.20.1 is not in the table**, and the site notes that 1.20.1 lacks IE compat. The player wiki has only an FAQ and a mutation calculator:
  - https://agricraft.github.io/docs/wiki (fetched)
  - https://agricraft.github.io/docs/wiki/faq (fetched; confirms the six stats, values 1–10, and Seed Analyzer use)
- GitHub repo: https://github.com/AgriCraft/AgriCraft (via Modrinth API and the jar's issueTracker).
- Legacy docs: https://agridocs.readthedocs.io/en/latest/agri_mutation/ (search result only; targets the 1.16 JSON format).
- CurseForge: https://www.curseforge.com/minecraft/mc-mods/agricraft (jar displayURL; unreachable).
- In-game guide: **Agricultural Journal**. Craft it shapeless from a Book and Quill + any AgriCraft seed (tag `agricraft:seeds`). Put it on a Seed Analyzer and analyze seeds to fill in pages. [jar: data/agricraft/recipes/journal.json; lang agricraft.journal.introduction.*] The journal's own "Beta Notice" lists Greenhouses, Irrigation, Decorations and Rakes as not implemented. The rake recipes do exist in the jar.

**Verified survival progression**
1. Make **Crop Sticks** (4 sticks → 8) and plant seeds on them. Craft the **Magnifying Glass** to read stats and the **Seed Analyzer** with the Journal. [jar: recipes/wooden_crop_sticks.json, magnifying_glass.json, seed_analyzer.json]
2. Breed by planting two crops with one gap, then placing double crop sticks in the middle. Offspring inherit one gene of each pair and can mutate. [lang agricraft.journal.crop_breeding.*]
3. Raise the six stats, each 1–10:
   - **Gain**: yield
   - **Growth**: speed
   - **Strength**: tolerance of conditions
   - **Resistance**: protection from weeds
   - **Fertility**: cross-breed chance
   - **Mutativity**: chance of good mutations

   Plants also need the right light, soil humidity, acidity and nutrients. Tools: Plant Clipper, Gardening Trowel, Hand Rakes, and the Suspiciously Savvy Seed Sorting Sack. [lang agricraft.stat.*, agricraft.journal.stats.*; wiki FAQ]
4. Resource-crop mutation tree: 18 AgriCraft plants that yield nuggets or dusts. Each also needs the matching ore/block **placed under the soil**. The block condition has "strength": 11, above the max stat of 10, so it can't be bred around (inference).
   - Melon + Pumpkin → **Ferranium** (iron)
   - Ferranium + Carrot → **Cuprosia** (copper)
   - Ferranium + Cornflower → **Lapender** (lapis)
   - Ferranium + Lapender → **Redstodendron** (redstone)
   - Ferranium + Redstodendron → **Aurigold** (gold)
   - Lapender + Redstodendron → **Amathyllis** (amethyst)
   - Lapender + Wither Rose → **Carbonation** (coal)

   [jar: data/agricraft/agricraft/mutations/*.json, plants/*.json]
5. Late tree:
   - Aurigold + Nether Wart → **Nitor Wart** (glowstone)
   - Redstodendron + Nitor Wart → **Quartzanthemum** (quartz)
   - Amathyllis + Quartzanthemum → **Emeryllis** (emerald)
   - Amathyllis + Nitor Wart → **Diamahlia** (diamond nuggets)
   - Emeryllis + Diamahlia → **Nethereed** (Netherite Sliver)

   Shards and slivers craft back into Diamond, Emerald and Netherite Scrap. [jar: mutations/*.json, recipes/diamond.json, recipes/netherite_scrap.json]
6. Modded-metal branches off Ferranium: Jaslumine (aluminium), Niccissus (nickel), Petinia (tin), Plombean (lead), Osmonium (osmium), Platiolus (platinum). Each needs that ore under the soil. IE, Mekanism and Thermal supply most of these ores; platinum ore may not exist in the pack (unverified). [jar: mutations/*.json]
7. Upgrade to **Iron Crop Sticks** (iron nuggets) and **Obsidian Crop Sticks**. [jar: recipes/iron_crop_sticks.json, obsidian_crop_sticks.json]

**Corrections to the first-draft summary**:
- AgriCraft 4.x has **six** stats (Gain, Growth, Strength, Resistance, Fertility, Mutativity), not three.
- The mod also has its own resource-crop mutation tree (Ferranium → … → Diamahlia → Nethereed) that needs ore blocks under the soil. It is not only stat breeding.
- Irrigation and greenhouses are not in this build.
- The official site does not list 1.20.1 as a supported version. Treat the build as beta.

**Guide size**: Keep as a smaller mod, as a short guide with the mutation-tree table. There is a real 6-deep mutation chain, but it is a single mechanic and overlaps Mystical Agriculture.

### Extra Utilities Reborn (1.0.1)
**What it actually is (jar data)**
- An **MCreator-built**, unofficial re-imagining of Extra Utilities 2 by **inzhefop** (mods.toml: "Extra Utilities 2, reimagined for modern modded Minecraft", credits "Tysm MCreator!").
- The same author published earlier versions for 1.16.5 and 1.18.2 (per third-party listings), so this is a 1.20.1 build of an existing project, not RWTema's code.
- It is **not** "Extra Utilities Reborn Again (New)" (a different 1.20.1 port by another author) and not Excessive Utilities.
- No EU2 signature systems: no transfer nodes or pipes, Angel Ring, Quantum Quarry, Deep Dark, crusher, or Grid power. Their names don't appear in en_us.json.
- All 150 recipes are vanilla crafting (shaped/shapeless) plus one smelting recipe. The two machines' special recipes are coded and only documented in item tooltips:
  - **Resonator**: Coal → Red Coal, Lapis → Lunar Reactive Dust, Quartz Block → Quartzburnt, Polished Stone → Stoneburnt → Rainbow Stone, Light Weighted Pressure Plate → Upgrade Base.
  - **Enchanter**: Gold Ingot + Lapis → Enchanted Ingot; Bookshelf + Lapis → Magical Wood; 8 Iron Ingot + Nether Star → Evil Infused Iron Ingot; quarry speed and silk-touch upgrades.

**References**
- CurseForge: https://www.curseforge.com/minecraft/mc-mods/extra-utilities-reborn. This is the jar's displayURL. The page is unreachable here (DNS failure / 403), so 1.20.1 page content is unverified.
- Modrinth: not listed (an API search returned nothing).
- GitHub / wiki: none found.
- In-game guide: none (no Patchouli, no advancements beyond recipe unlocks). Rely on tooltips and JEI.

**Verified survival progression**
1. Early utilities from vanilla materials:
   - Compressed Cobblestone/Dirt/Gravel/Sand, up to Octuple Compressed Cobblestone
   - Trash Cans, Stone/Iron Drums, Spikes
   - Golden Feather (feather + gold) → **Angel Block** (2 Golden Feathers + obsidian)
   - Golden Bag of Holding, Gold Chest

   [jar: recipes/cc_*_rcp.json, angel_block_rcp.json, golden_feather_rcp.json, golden_bag_rcp.json]
2. First power. **Survival Generator** (cobble, iron, redstone, furnace). Then the **Machine Block** (iron, redstone, chest → 4), which makes the **Furnace Generator** and the **Electrical Furnace**. [jar: recipes/survival_generator_rcp.json, machine_block_rcp.json, furnace_generator_rcp.json]
3. Ender Shards and machines:
   - **Glass Cutter** + Ender Pearl → **Ender Shard** (6).
   - Ender Shard + 4 Redstone → **Redstone Crystal**.
   - Redstone Crystal → **Resonator** (with a coal block and iron).
   - Machine Block + Enchanted Book + diamonds + iron → **Enchanter**.

   [jar: recipes/ender_shard_rcp.json, redstone_crystal_rcp.json, resonator_rcp.json, enchanter_rcp.json; lang tooltips]
4. Fuel-specific generators, each made from a Furnace Generator: Culinary, Death, Disenchantment, Ender, TNT, Frosty, Halitosis, Netherstar, Overclocked, Pink, Potion, Slimey, Redstone and Magma. Also the Solar Panel and the **Lunar Panel** (Lunar Reactive Dust). [jar: recipes/*_generator_rcp.json, lunar_panel_rcp.json]
5. Mid/late items:
   - **Ender Quarry**: Ender Infused Obsidian, Ender Core (Magical Wood + Eye of Ender), Diamond Edged Computational Matrix (Quartzburnt), Ender Thermic Pump and a **Netherite Pickaxe**. Upgrades sit on an Ender Quarry Upgrade Base: Speed I, then II and III via the Enchanter, plus Silk-Touch and World-Hole.
   - Chicken Wing Ring (Enchanted Ingot, Golden Feather, Redstone Crystal) → Advanced Chicken Wing Ring (Evil Infused Iron Ingot), which also negates fall damage.

   [jar: recipes/ender_quarry_rcp.json, ender_core_rcp.json, decm_rcp.json, ender_quarry_*_rcp.json, chiken_wing_ring_rcp.json, advanced_chicken_ring_rcp.json]
6. Endgame:
   - **Rainbow Generator**: Top + Bottom, which together need one of each of the 18 generators, including the Netherstar Generator.
   - **Bedrockium Ingot**: Triple/Quadruple Compressed Cobblestone + Diamond Block.
   - **Kikoku**: Nether Stars, Netherite, Diamond Spikes, Etheric Sword.
   - **Unstable Ingot**: Devision Sigil + Iron Ingot + Diamond. The Devision Sigil (sic) "can be obtained by killing a Wither or Enderdragon" per its tooltip; no loot table found, so the mechanism is unverified.

   [jar: recipes/rainbow_gen_top_rcp.json, rainbow_gen_bottom_rcp.json, bedrockium_ingot_rcp.json, kikoku_rcp.json, unstable_ingot_rcp_2.json; lang devision_sigil.description_0]
7. Unverified: how to get the **Demon Ingot** (no recipe except from its block; EU2 dropped gold in a Nether portal) and the **Ender Lilly Seed** (no recipe or loot table in the data). Drop of Evil comes from Wither Skeletons at 10% per its tooltip and turns grass into Cursed Earth. [lang tooltips]

**Corrections to the first-draft summary**:
- "A new 1.20.1 remake" is half right. It is a 1.20.1 build of inzhefop's MCreator project, which has existed since about 2022 for 1.16/1.18.
- Contents are confirmed: around 18 single-fuel generators feed the Rainbow Generator, plus the Resonator, Enchanter, Ender Quarry with upgrades, Chicken Wing Rings, Angel Block, drums, spikes, compressed blocks, glass and tools.
- No EU2 transfer nodes, Deep Dark, Angel Ring or Grid power.
- Several sources (Demon Ingot, Ender Lilly Seed) are undocumented.
- The "Chunk Loading Ward" is marked "Under development" in its tooltip.

**Guide size**: Keep as a smaller mod. There is a modest ladder (Survival Generator → Machine Block → Resonator/Enchanter → Ender Quarry → Rainbow Generator), but there are no docs, so one page with the hidden machine recipes from the tooltips is valuable.

### Mowzie's Mobs (1.8.2)
**References**
- GitHub repo: https://github.com/BobMowzie/MowziesMobs (via Modrinth API and the jar's issueTracker).
- Modrinth: https://api.modrinth.com/v2/project/mowzies-mobs (fetched; covers 1.20.1 and 1.21.1, and its mob descriptions cover all versions).
- CurseForge: https://www.curseforge.com/minecraft/mc-mods/mowzies-mobs (search result; unreachable). The mowziesmobs.fandom.com wiki was unreachable.
- In-game guide: none. The advancement tree (root "Mowzie's Mobs") is the closest thing to one. [jar: data/mowziesmobs/advancements/*.json]

**Verified survival progression** (bosses are independent and can be fought in any order. Structure biomes are set by the mod config tag `has_mowzie_structure`, so which biomes are used is unverified.)
1. **Ferrous Wroughtnaut** (Wrought Chamber). A player kill always drops both the **Axe of a Thousand Metals** and the **Wrought Helm**; neither ever breaks. [jar: loot_tables/entities/ferrous_wroughtnaut.json; advancement kill_ferrous_wroughtnaut]
2. **Frostmaw** (frostmaw_spawn structure). It drops the **Ice Crystal** (an icy whirlwind item) if it still holds the crystal. You can also steal the crystal while the boss sleeps (advancement "Big Brain™ Time"). If the crystal is gone and it is raining, it drops the Petiole disc instead. [jar: loot_tables/entities/frostmaw.json; advancement steal_ice_crystal]
3. **Umvuthi, the Sunbird** (Umvuthana Grove). Umvuthana drop masks, and wearing one lets you sneak into the grove. Umvuthi **trades the Sun's Blessing** (Sunstrike, Solar Flare, Solar Beam, Supernova) and lets you replenish it for free. A player kill drops the **Sol Visage**, which summons mask minions. [jar: loot_tables/entities/umvuthi.json, umvuthana_*.json; lang entity.mowziesmobs.umvuthi.trade*, grant_suns_blessing.*; advancements sneak_grove, suns_blessing]
4. **Tongbi, the Sculptor** (Monastery). Kill a Bluff for a **Bluff Rod**, give it to the Sculptor and complete his parkour challenge to get the **Earthrend Gauntlet** (boulders, tunneling, pillar). Killing him drops Geomancer gear (Beads, Robe, Belt, Sandals) or the Sculptor staff; Geomancer pieces are also in monastery chests. [jar: loot_tables/entities/sculptor_test.json, sculptor.json, chests/monastery_chest.json; lang bluff_rod.text.0; advancement sculptor_challenge]
5. Mini-bosses and drops:
   - **Naga** → Naga Fang (Naga Fang Dagger, darts, Poison Resistance potion).
   - Foliaath → Foliaath Seed.
   - Grottol → diamond (Fortune/Silk Touch advancements).
   - Lantern → Luminous Jelly.
   - Elokosa Howler → Elokosa paws.

   [jar: loot_tables/entities/*.json, recipes/naga_fang_dagger.json, dart.json]

**Corrections to the first-draft summary**: Add **Tongbi, the Sculptor** (Earthrend Gauntlet via his challenge; Geomancer armor), the main boss missing from the list. Naga is better described as a mini-boss. Umvuthi's main reward is the Sun's Blessing, which you trade for, plus the Sol Visage.

**Guide size**: Keep as a smaller mod, as a boss/drop table. There is no crafting ladder, but four bosses give unique gear worth one page.

### Alex's Mobs (1.22.9)
**References**
- GitHub repo: https://github.com/AlexModGuy/AlexsMobs (via Modrinth API). The jar's issueTracker points to github.com/Alex-the-666/AlexsMobs.
- Modrinth: https://api.modrinth.com/v2/project/alexs-mobs (fetched; 1.20.1 is the latest version listed).
- CurseForge: https://www.curseforge.com/minecraft/mc-mods/alexs-mobs (search result; unreachable). The alexsmobs.fandom.com wiki was unreachable.
- In-game guide: **Animal Dictionary**. Crafted shapeless from a Book + Green Dye + any one of: Crocodile Scute, Bear Fur, Roadrunner Feather, Gazelle Horn, Rattlesnake Rattle, Komodo Spit, Cave Centipede Leg, Moose Antler, Raccoon Tail, Cockroach Wing, Spiked Scute, Straddlite, Emu Feather, Dropbear Claw, Cachalot Whale Tooth, Capsid, or Rocky Shell. It has a page per mob, including Void Worm. [jar: recipes/animal_dictionary.json, tags/items/animal_dictionary_ingredient.json, assets/alexsmobs/book/animal_dictionary/en_us/*.txt]

**Verified survival progression** (Void Worm chain + gear drops)
1. Craft the **Crimson Mosquito Larva** from a Maggot + Mosquito Proboscis. The proboscis drops from Crimson Mosquitoes, which spawn in Crimson Forests or form when a Fly enters the Nether. [jar: recipes/mosquito_larva.json, loot_tables/entities/crimson_mosquito.json; dictionary crimson_mosquito.txt]
2. In the End, kill an Enderiophage for a **Capsid**. Put the larva in the Capsid and it becomes a **Mysterious Worm** (about 120 ticks). [jar: loot_tables/entities/enderiophage.json, capsid_recipes/mysterious_worm.json; dictionary void_worm.txt; advancement mysterious_worm]
3. Toss the Mysterious Worm into the End's void to summon the **Void Worm**. Hit the head. Destroying body segments **splits** the worm into weaker copies. [dictionary void_worm.txt; advancements void_worm_summon, void_worm_split]
4. Drops: a **Void Worm Eye** and 2 **Void Worm Mandibles**. Two mandibles make the **Void Worm Beak** (a redstone trophy). Mandibles + eye + **2 Netherite Ingots** make the **Dimensional Carver**: 20 uses, each opening a portal to spawn. It becomes the Shattered Dimensional Carver in a Capsid. [jar: loot_tables/entities/void_worm.json, recipes/dimensional_carver.json, void_worm_beak.json, capsid_recipes/shattered_dimensional_carver.json; advancements void_worm_kill, dimensional_carver]
5. Mob-drop gear worth listing:

   | Gear | Made from |
   |------|-----------|
   | **Tarantula Hawk Elytra** | 9 Wing Fragments → Tarantula Hawk Wing; 2 wings + a vanilla **Elytra** (upgrade, not a substitute) |
   | **Froststalker Helmet** | Froststalker Horn |
   | **Rock Shell Chestplate** | Rocky Shell from the Rocky Roller |
   | **Spiked Turtle Shell** | Spiked Scute |
   | **Crocodile Chestplate** | Crocodile Scute |
   | **Cave Centipede Leggings** | Cave Centipede Leg |
   | **Roadrunner Boots** | Roadrunner Feather |
   | **Antler Headdress** | Moose Antler |
   | **Outback Leggings** | Emu Feather + Kangaroo Hide |
   | **Flying Fish Boots** | Flying Fish |
   | **Shield Of The Deep** | Shark teeth |
   | **Grappling Squok** | Lost Tentacle |
   | **Blood Sprayer** → **Hemolymph Blaster** | Mosquito drops (Blood Sprayer); Warped Mosco drops (Hemolymph Blaster) |

   [jar: recipes/*.json for each item; loot_tables/entities/*.json]

**Corrections to the first-draft summary**: The summary is fine. You could add the exact summon chain (Mosquito Larva → Capsid → Mysterious Worm → End void) and that the reward is the Dimensional Carver, which needs netherite. Also note the Tarantula Hawk Elytra needs an existing Elytra.

**Guide size**: Keep as a smaller mod, as a section with a Void Worm chain plus a gear table. The Animal Dictionary covers the rest in game.

### Blue Power (0.10.323-alpha)
**References**
- GitHub repo: https://github.com/Qmunity/BluePower (fetched). The README is generic: "in active development and may not always be stable". It says nothing about 1.20 port status. A wiki tab exists at https://github.com/Qmunity/BluePower/wiki (could not be opened from here), and it is likely 1.7.10/1.12-era.
- CurseForge: https://www.curseforge.com/minecraft/mc-mods/blue-power (search result; unreachable). The search summary said the listing includes 1.20.1, but the main file shown is 1.7.10.
- In-game guide: none. Advancements: root, "Wolfram but not alpha?" (mine tungsten), "That's Dope!" (doped wafer), "Well endowed" (Vorpal). The lang defines tube, sorting machine and integrated-circuit advancements, but there are no advancement files for them. [jar: data/bluepower/advancements/*.json, lang achievement.*]

**Verified survival progression**
1. Mine the new ores: Ruby, Sapphire, Green Sapphire, Amethyst (BP's own), Teslatite, Silver, Zinc and **Tungsten**. Gem tools, sickles and saws come from these. [jar: data/bluepower/worldgen/placed_feature/*, recipes/ruby_*.json etc.]
2. Craft the **Alloy Furnace** (8 Bricks) and the **Project Table**. Then make the alloys: **Red Alloy Ingot** (4 Redstone + iron), **Blue Alloy Ingot** (4 Teslatite Dust + silver), and **Tungsten Carbide** (tungsten + coal). [jar: recipes/alloyfurnace.json, project_table.json, recipes/alloy_furnace/*.json]
3. Silicon chain:
   - 8 Coal + 8 Sand → Silicon Boule.
   - **Diamond Saw** → 16 Silicon Wafers.
   - +4 Redstone or +4 Teslatite → Red/Blue Doped Wafer.
   - Doped wafer → Silicon Chip tile.

   [jar: recipes/alloy_furnace/silicon_boule.json, siliconwafer.json, red_doped_wafer.json, blue_doped_wafer.json, silicon_chip_tile.json]
4. Blulectric power: Battery and Battery Block, Solar Panel (8 Blue Doped Wafers + Blue Alloy), Blulectric Engine, Blulectric Cable, Blulectric Furnace and Alloy Furnace. [jar: recipes/battery.json, solar_panel.json, engine.json, blulectric_*.json]
5. Redstone machines: Block Breaker, Deployer, Ejector, Transposer, Buffer, Igniter. Lamps, lumar and decorative basalt or marble. [jar: recipes/*.json]
6. Logic gates: in this build **only the AND gate and NAND gate have active recipes**. The other 21 gate recipes are renamed `.jsonx`, so they are disabled. [jar: recipes/gate_*.jsonx]

**Corrections to the first-draft summary**:
- "Logic gates" overstates it. Only AND and NAND are craftable.
- No JSON recipe produces Red Alloy Wire, Bluestone Wire or insulated wires. Those blocks exist in en_us.json, but placeable red-alloy wiring appears uncraftable; only wire *tiles* (gate parts) and copper/iron wire are craftable. A code-side recipe is unverified.
- Tubes and the sorting machine are named in lang but have no recipes.
- What it actually offers is ores and gem tools, alloy smelting, silicon wafers, Blulectric power and a few redstone machines.

**Guide size**: Drop to "no guide needed" (a one-paragraph note at most). In this alpha the advertised redstone and logistics features are mostly not craftable, and nothing else in the pack gates on it.
