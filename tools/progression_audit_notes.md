## The review (read this first)

**Asked:** make sure nothing is locked that shouldn't be, and nothing is unlocked that shouldn't be, across the Blood Pool tiers, the potato ranks and the Potato War tree.

**How:** `tools/progression_audit.py` cross-checks the scripts' own lists against 20,000+ recipes from the 79 content mods on hand, plus Minecraft and Forge. The generated report is below. In game, `/bloodpool audit` checks every recipe actually loaded, including mods not on hand.

### Fixed
| Problem | Kind | Fix |
|---|---|---|
| The rank check only saw Minecraft's own crafting recipes. About 620 Mystical Agriculture recipes (essences → resources) and Mekanism's machine recipes use their own formats, so any rank could make them | unlocked | `blood_pool.js` rebuilds them as KubeJS recipes (same id, pattern, ingredients, result; no mirroring) with the rank check. Mekanism tier upgrades are left as they are, so contents and upgrades carry over |
| The quest files used task and reward type `stage`. FTB Quests 2001.4.22 calls both `gamestage`, so every rank, tier and node quest would have lost its stage tasks and rewards | broken | Generator fixed. The validator now checks types against the jar's list |
| Results that are **tags** are invisible to item locks. IE's arc furnace made **manyullyn** (and hepatizon, queen's slime) at Tier 3; IE made **cobalt** at Tier 3; the Tinkers smeltery alloyed and cast **enderium, lumium and signalum** from day 0, plus **fiery** and **refined obsidian** and **refined glowstone** | unlocked | Recipe-id locks at their tiers: 4 refined glowstone, 5 cobalt (IE) and Thermal's alloys (Tinkers), 6 fiery, 7 refined obsidian, 8 manyullyn and friends (IE) |
| The **knightly** Tinkers material (knightmetal shards, netherite-level) was sealed nowhere | unlocked | Blood Pool Tier 5 and the Cobalt Smithing node |
| **Quantum Crafting** sat at Tier 8, but the Quantum Crafter's parts are Tier 11 | mismatch | Moved to Tier 11 (rank 11) |
| **Automated Mining**: the Digital Miner needs a Tier 7 part | mismatch | Tier 7 (rank 7) |
| A Create funnel placed on a belt becomes a **belt funnel** block, which the place check didn't know | unlocked | Added to Create Logistics |
| Opening **any AE2 terminal** needed ME Logistics, so basic storage was locked behind a logistics node | locked | Basic ME storage and terminals are free. ME Logistics locks buses, planes, interfaces and P2P |
| **Holding** a locked block blocked right-clicking anything, even a chest | locked | The held-item check now only covers parts placed onto blocks (AE2 parts, Thermal attachments, conduits) |
| Automation no node covered | unlocked | Added (owner decision): Automated Mining (Digital Miner, Mechanical Miner, Ender Quarry, Alex's Caves Quarry); AE2 planes, storage, toggle buses and P2P, and Advanced AE's buses and pattern providers; Mob Spawning (Ender IO, Mystical Agriculture, RFTools and Draconic spawners); Immersive Assembly (IE's Assembler); Ender IO's vacuums |

### Checked and left as they are (on purpose)
- **Rank gaps still in section 2:**
  - Mystical Agriculture gear upgrades that keep durability, and Mekanism tier upgrades;
  - Reliquary's alkahestry (needs the tome), RFTools shape-card copies, Botania and Numina upgrades, and IE, EvilCraft and Botania specials.
  - Each needs an item that is already rank-locked, or is cosmetic.
- **Section 3's remaining rows:**
  - Thermal's gears, plates, coins and dusts made by IE or Tinkers before Tier 5;
  - base metals (tin, lead, silver, nickel, aluminum, osmium, bronze, invar, tungsten) a tier or two early from ore.
  - They're raw materials; every machine that uses them is still sealed.
- **Section 4 (collateral):** a mod's lock also holds back that mod's machine recipes for vanilla items (e.g. Mekanism crushing to gravel). Vanilla routes always exist.
- **Free Tinkers materials:** basic, vanilla and compat materials (wood, stone, iron, copper, bronze, brass, Botania's livingwood and manasteel, …). The strong ones are all in a tier and a node.
- **Section 6 leftovers:** fluid and energy pipes, Tinkers ducts and chutes, Create chutes, teleporters, boss spawners and Botania's Hopperhock aren't item automation. They stay free.

### Still to confirm in game
`/bloodpool audit` writes `kubejs/progression_audit.json`:
- every crafting-type recipe that still lacks the rank check;
- every recipe that still makes a sealed item, with whether KubeJS sees its result.

Run it on the test server at Tier 0 and again at Tier 5, and send the file back.
