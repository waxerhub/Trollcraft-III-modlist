# The Potato War upgrade tree (Part II)

A Hypixel-style upgrade tree in the **FTB Quests** book. The potato ranks are the trunk ([BLOOD_POOL.md](BLOOD_POOL.md), "The Potato War"). The branches are nodes you buy with potatoes and mod items. Each node unlocks something **for you alone**:
- the metals your Tinkers tools and armour may be made of;
- building your own smeltery and foundry;
- the autocrafters, the logistics blocks (funnels, conveyors, transporters, buses, conduits) and the farm machines, both placing them and using them.

**Nobody falls more than 2 tiers behind:** when the Blood Pool opens Tier T, everyone gets every node of Tier T−2 and below for free.

**Part II only.** It needs `part2/blood_pool.js`.

## Mods to add (server and every client)
| Mod | Version (Forge 1.20.1) | Why |
|---|---|---|
| FTB Quests | 2001.4.x (built against 2001.4.22) | The quest book: the tree |
| FTB Library | 2001.2.x or newer | Needed by FTB Quests (may already be there with FTB Essentials) |
| FTB Teams | 2001.3.x or newer | Needed by FTB Quests |
| FTB XMod Compat | 2.1.x | **Required.** It makes FTB Quests use KubeJS's stages and fire KubeJS events. Without it, nothing connects |

**Latency:** low.
- The book is client-side.
- The server re-checks each player's stage tasks once a second (about 40 tiny checks).
- The locks are a quick lookup on block-break, hit and right-click.
- Locked armour is checked every 2 seconds.

## Files
| File | Where it goes | What it does |
|---|---|---|
| `tools/kubejs/server_scripts/part2/potato_tree.js` | `kubejs/server_scripts/part2/` | The node list (settings), the locks, catch-up, parties off, rank credit, `/potatotree` |
| `tools/kubejs/server_scripts/part2/blood_pool.js` (updated) | `kubejs/server_scripts/part2/` | Blood Pool tier stages, catch-up crafting access, `creditStanding`, `/potatowar tree` |
| `tools/ftbquests/quests/chapters/potato_war_*.snbt` (5 files) | `config/ftbquests/quests/chapters/` | The chapters: The Ranks, Tinkers' Smithy, Logistics, Autocrafting, Farms |
| `tools/ftbquests/quests/chapter_groups.snbt` | `config/ftbquests/quests/` | The "Techno's Potato War" group. **If you already have this file** (your own quests), copy its one group entry into yours instead |
| `tools/ftbquests/generate_quests.js` | (stays in the repo) | Rebuilds the chapter files from the scripts: `node tools/ftbquests/generate_quests.js` |

**Install:**
1. Add the four mods and restart once.
2. Copy the two scripts and the quest files.
3. Run `/reload` and `/ftbquests reload`, or restart again.

There's no `data.snbt` to copy. FTB Quests keeps its own defaults.

## How it works
- **The book:** press the quest key or run `/potatowar tree`.
  - **The Ranks:** the 11 ranks. Each ticks when you reach it (or when catch-up gives you its crafting access).
  - **The branches:** one chapter each, drawn as trees with dependency lines.
- **Each node is a quest:**
  - **stage tasks** for its rank (`potato_standing_<n>`) and its Blood Pool tier (`blood_pool_tier_<n>`). These tick by themselves;
  - **item tasks** that take potatoes and the branch's items. Submit them in the book; partial submissions count;
  - **dependencies** on the nodes below it;
  - **a hidden stage reward** `potato_tree_<node>`. That stage is what the locks check.
- **Potatoes handed in count toward your rank.** When a node's potato task completes, its potatoes are added to your Potato Standing, as if offered with `/potatowar offer`, with the rank-up line. They never fill the Blood Pool.
  - Only plain potatoes count. Break crates first.
- **Personal:** the script switches FTB Teams **parties off**, so every player is their own team and has their own progress. Allies still work.
  - Parties made before install keep their shared progress, so disband them.

## The nodes
Costs are placeholders. Edit `NODES` in `potato_tree.js`, then run the generator.

**Tinkers' Smithy:**

| Node | Needs | Cost | Unlocks |
|---|---|---|---|
| Seared Smeltery | Potato Farmer | 250 potatoes, 16 seared bricks | Placing and using a smeltery controller |
| Steel Smithing | Potato Recruit, Tier 3, Seared Smeltery | 2,500, 32 steel ingots | Steel Tinkers tools |
| Osmium & Steeleaf | Potato Private, Tier 4, Steel | 5,000, 16 osmium, 16 steeleaf | Osmium and steeleaf tools; TF steeleaf gear |
| The Foundry | Potato Soldier, Tier 5, Seared Smeltery | 5,000, 64 scorched bricks | Placing and using a foundry controller and scorched alloyer |
| Cobalt Smithing | Potato Soldier, Tier 5, Osmium & Steeleaf | 10,000, 32 cobalt, 8 knightmetal | Cobalt, knightmetal and scorched stone tools; TF knightmetal gear |
| Alloy Smithing | Potato Sergeant, Tier 6, Cobalt | 20,000, 16 electrum, 8 fiery | Electrum, invar, constantan, silver, lead, pewter, aluminum and fiery; TF fiery gear |
| Masterwork | Potato Captain, Tier 8, Alloy and Foundry | 60,000, 16 manyullyn, 16 hepatizon | Manyullyn, hepatizon, queen's slime, cinderslime, necronium, blazing bone, blazewood, ancient, enderslime and ichor |
| Dragonsteel | Potato General, Tier 9, Masterwork | 100,000, 8 of each dragonsteel | Dragon scale and the three dragonsteels |

Metals in no node (wood, stone, iron, copper, bronze and the rest) are free.

**Logistics:**

| Node | Needs | Cost | Place and use |
|---|---|---|---|
| Create Logistics | Potato Farmer, Tier 1 | 500, 16 andesite alloy | Funnels, tunnels, smart chute, portable storage interface |
| Create Automation | Potato Private, Tier 4, Create Logistics | 5,000, 8 precision mechanisms | Deployer, Mechanical Arm (and so Sequenced Assembly) |
| Immersive Logistics | Potato Recruit, Tier 3 | 2,500, 16 IE steel | Conveyor, sorter, fluid sorter |
| Logistical Transport | Potato Private, Tier 4 | 5,000, 8 basic control circuits | Logistical transporters (all tiers), restrictive and diversion transporters, logistical sorter, QIO importer and exporter |
| Thermal Servos | Potato Soldier, Tier 5 | 10,000, 8 tin gears | Servo, turbo servo and filter attachments (placing only) |
| Item Conduits | Potato Soldier, Tier 5 | 10,000, 16 conduit binder | Ender IO item conduits (placing only) |
| ME Logistics | Potato Sergeant, Tier 6 | 20,000, 16 logic processors | Import and export buses, interfaces, ME conduits; **opening any AE2 terminal** (on a cable, and the plain wireless terminal) |

**Autocrafting:**

| Node | Needs | Cost | Place and use |
|---|---|---|---|
| Mechanical Crafting | Potato Private, Tier 4, Create Automation | 5,000, 8 precision mechanisms | Mechanical Crafter |
| Formulaic Assembly | Potato Private, Tier 4 | 5,000, 4 basic control circuits | Formulaic Assemblicator |
| Ender IO Crafting | Potato Soldier, Tier 5 | 10,000, 2 void chassis | Ender IO Crafter |
| Thermal Fabrication | Potato Soldier, Tier 5 | 10,000, 4 machine frames | Sequential Fabricator |
| ME Autocrafting | Potato Sergeant, Tier 6, ME Logistics | 20,000, 16 engineering processors | Pattern providers, the pattern encoding terminal, crafting units, accelerators, crafting storage, monitors and Molecular Assemblers; the wireless crafting and pattern terminals (AE2, AE2WTLib, Advanced AE) |
| RFTools Crafting | Potato Lieutenant, Tier 7, Ender IO Crafting | 35,000, 4 RFTools machine frames | RFTools Crafters 1–3 |
| Quantum Crafting | Potato Captain, Tier 8, ME Autocrafting | 60,000, 16 calculation processors | Advanced AE's Quantum Crafter (and its terminal) |

**Farms:**

| Node | Needs | Cost | Place and use |
|---|---|---|---|
| Create Farming | Potato Farmer, Tier 1 | 500, 8 andesite casings | Mechanical Harvester, Plough |
| Growth Acceleration | Potato Peeler, Tier 1 | 1,000, 16 inferium essence | The five growth accelerators, the MA Harvester |
| Garden Cloche | Potato Recruit, Tier 3 | 2,500, 8 treated planks | Garden Cloche |
| Phytogenic Insolation | Potato Soldier, Tier 5, Garden Cloche | 10,000, 4 phyto-gro | Phytogenic Insolator |
| Powered Spawning | Potato General, Tier 9 | 100,000, 4 broken spawners | Powered Spawner |

Every block and item id was checked against the mods' jars, including the AE2WTLib ids, which were checked in its source.

## The locks
Ops, creative and spectator players are exempt. A refusal shows "<Node> needed (/potatowar tree)" on the action bar, at most once every 3 seconds.
- **Gear:**
  - **What's checked:** a Tinkers tool or armour piece lists its materials in NBT (`tic_materials`). If any material needs a node you don't have, the gear is locked. The Twilight Forest gear listed in a node is locked the same way.
  - **Locked gear:**
    - won't break blocks or hurt anything;
    - can't be right-clicked (bows, crossbows, shields);
    - armour is taken off into your inventory (dropped if it's full).
  - **Found, traded and cast gear is covered too.** That closes the old "cast it in someone else's smeltery" gap.
- **Placing:** holding a node's item and right-clicking a block is refused. That covers blocks, AE2 parts on cables, Thermal attachments on ducts, and conduits. Placing the block itself is refused as a fallback, which also stops deployers placing it for you.
- **Using:** right-clicking a node's block is refused, **whoever placed it**: opening it, configuring it, putting patterns in. AE2 terminals on cables need ME Logistics, since right-clicking any AE2 cable bus is refused without it.
- **Not locked:**
  - **regular machines** (pulverizers, enrichment chambers, crushers, mixers). They follow the Blood Pool, and crafting them at a table already needs the rank;
  - **faucets and casting tables**, so iron and copper casting stays open.
- **Gaps left by design:**
  1. **Machines fed by their owner's hoppers, belts or pipes** keep working for whatever reaches them. That's the owner choosing to share.
  2. **AE2 autocraft requests:** a player with ME Logistics but not ME Autocrafting can order crafts at a terminal on someone else's network that already has crafters. AE2 doesn't tell scripts who ordered.
  3. **Holding a node's item** while right-clicking any block (even a chest) is refused. Put it away first.

## Catch-up
When the Blood Pool opens Tier T, everyone gets everything of Tier T−2 and below. `CATCH_UP_GAP` in `blood_pool.js` sets the gap; 0 turns it off.
- **Crafting:** you can craft Tiers 1..T−2 at a table whatever your rank. `/potatowar` shows "Crafting access: Tier 3 (catch-up)".
  - Your **rank's name**, the rank-up lines and the **black market** still use your real rank. Those are earned with potatoes.
- **Nodes:**
  - **Which ones:** every node whose tier is T−2 or lower is completed for you, through FTB Quests (`/ftbquests change_progress … complete`), so the book shows it done. A node's tier is its Blood Pool tier or its rank, whichever is higher.
  - **Nothing is taken,** and no potatoes are credited.
  - You're told privately what you got.
- **When it runs:** when a tier opens, at login (for players who were offline), and after `/reload`.
- **It never takes anything back.** If an op lowers the tier (testing), caught-up nodes stay. Remove them with `/potatotree revoke`.

## Commands
| Command | Who | |
|---|---|---|
| `/potatowar tree` | players | Opens the book at the Potato War |
| `/potatotree check <player>` | op | Their nodes |
| `/potatotree grant <player> <node>` | op | Completes the node's quest and gives its stage. Nothing taken, nothing credited |
| `/potatotree revoke <player> <node>` | op | Resets the quest and takes the stage. Nothing is given back |
| `/potatotree catchup` | op | Runs catch-up now |

Node ids are in `NODES` (e.g. `cobalt_smithing`). `/ftbquests change_progress` also works, but completing a node that way **does** credit its potatoes; use `/potatotree grant` instead.

## Settings (top of `potato_tree.js`)
| Setting | Default | |
|---|---|---|
| `NODES` | 27 nodes | Every node: number `n` (fixes its quest id; never reuse one), rank, tier, needs, potatoes, items, materials, gear, places, use, wireless, position, description |
| `CHAPTERS` | 5 | Chapter ids, titles, icons and file names |
| `NO_PARTIES` | true | Switch FTB Teams parties off |
| `LOCK_ARMOR`, `ARMOR_CHECK_TICKS` | true, 40 | Take locked armour off, every 2 s |
| `MESSAGE_COOLDOWN_TICKS` | 60 | Between action bar notes |
| `CATCH_UP_LOGIN_DELAY_TICKS` | 60 | After a login, before catching that player up |
| `CATCH_UP_GAP` (in `blood_pool.js`) | 2 | Tiers behind the Pool before catch-up; 0 = off |

**After editing `NODES`:**
1. Run `node tools/ftbquests/generate_quests.js`.
2. Upload the changed chapter files.
3. Run `/ftbquests reload` and `/reload`.

Moving nodes around in the book's editor is fine. Keep the ids, and re-run the generator only if you also want your edits replaced.

## Test plan (an op and a second account)
1. **Install:** install the mods, scripts and files. The book shows a "Techno's Potato War" group with five chapters. Try "Create Party" in the FTB Teams screen: refused.
2. **Tiers:** `/bloodpool settier 1`. The second account offers 250 potatoes (`/potatowar offer 250`): The Ranks' first quest ticks.
3. **Buying a node:** open Seared Smeltery and submit 250 potatoes and 16 seared bricks.
   - The quest completes, and the potatoes count toward the rank (`/potatowar` shows 500).
   - A smeltery controller can now be placed and opened.
   - Without it, placing or right-clicking one is refused.
4. **Gear:** `/give` the second account a cobalt Tinkers pickaxe (build one in creative). It won't mine. `/potatotree grant <name> cobalt_smithing`: it mines.
5. **AE2:** as the op, place a drive and terminal. The second account can't open the terminal without ME Logistics.
6. **Catch-up:** `/bloodpool settier 5` with an unranked account online. It's told it was granted Seared Smeltery, Steel Smithing, Create Logistics, Immersive Logistics, Create Farming, Growth Acceleration and Garden Cloche, and the book shows them done.
7. **A Tinkers hammer** without its node: does its area mining stop too?

## What couldn't be verified for KubeJS 6 on 1.20.1
A mock-server test passed 101 checks (with the Blood Pool's tests), and the Blood Pool's own suite still passes with the tree absent (116):
- **gear:** Tinkers NBT, the variant suffix, TF gear, ops and creative exempt, armour taken off and kept on;
- **placing:** the held item and the block fallback, AE2 parts and Thermal attachments, a node letting an unranked player place a Mechanical Crafter (`blood_pool.js`'s rank rule stepping aside);
- **using:** someone else's blocks, AE2 cable terminals, the wireless terminals;
- **rank credit**, and the Pool untouched;
- **catch-up:**
  - only Tier ≤ T−2 nodes, and nothing credited;
  - a tier opening, a login, no repeats;
  - the real rank kept, crafting access raised;
  - `CATCH_UP_GAP = 0`;
- `/potatowar tree` and `/potatotree`;
- parties off;
- running without FTB Quests;
- no stacked loops after `/reload`.

The quest files were checked by a separate parser against FTB Quests 2001.4.22's source: ids, groups, dependencies, task and reward fields, and every item id against the mod jars.

In game:
- **FTB Quests:** that the book loads the files, stage tasks tick, item tasks take the potatoes, the hidden stage reward is claimed, and `change_progress` from the console completes a quest for a named player.
- **The `#potato_offer` event** from FTB XMod Compat reaching the script, with the player and the task's count.
- **Parties off:** `FTBTeamsAPI.api().setPartyCreationFromAPIOnly(true)` from a script (KubeJS may block the class; the log says so).
- **Gear locks on real Tinkers tools:** area mining (hammers, excavators), Tinkers bows, and armour moving off.
- **Right-click cancelling** opening an AE2 terminal on a cable, and placing AE2 parts and Thermal attachments.
- **Deployers** placing a locked block (they should be refused).
