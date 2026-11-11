# The Potato War upgrade tree (Part II)

A Hypixel-style upgrade tree in the **FTB Quests** book. The potato ranks are the trunk ([BLOOD_POOL.md](BLOOD_POOL.md), "The Potato War"). The branches are nodes you buy with potatoes and mod items. Each node unlocks something **for you alone**:
- the metals your Tinkers tools and armour may be made of;
- building your own smeltery and foundry;
- the autocrafters, the logistics blocks (funnels, conveyors, transporters, buses, conduits), automated mining and the farm and spawner machines, both placing them and using them.

**Hold Shift over an item** to see what it needs and whether you have it (the tooltip client script). `/potatowar next` says what to do next. The book opens with a "Start Here" chapter.

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
| `tools/ftbquests/quests/chapters/potato_war_*.snbt` (7 files) | `config/ftbquests/quests/chapters/` | The chapters: Start Here, The Ranks, The Blood Pool, Tinkers' Smithy, Logistics, Autocrafting, Farms |
| `tools/ftbquests/quests/chapter_groups.snbt` | `config/ftbquests/quests/` | The "Techno's Potato War" group. **If you already have this file** (your own quests), copy its one group entry into yours instead |
| `tools/kubejs/client_scripts/potato_tooltips.js` | **the modpack**: every player's `kubejs/client_scripts/` | The Shift tooltips. Generated; don't edit by hand |
| `tools/ftbquests/generate_quests.js` (+ `load_scripts.js`) | (stays in the repo) | Rebuilds the chapter files and the tooltip script from the scripts: `node tools/ftbquests/generate_quests.js` |

**Install:**
1. Add the four mods and restart once.
2. Copy the two scripts and the quest files to the server, and put the tooltip script in the modpack.
3. Run `/reload`, and `/ftbquests reload` from the server console, or restart again.

There's no `data.snbt` to copy. FTB Quests keeps its own defaults.

**Where the book comes from** (checked in FTB Quests 2001.4.22's own code, `ServerQuestFile` and `BaseQuestFile`):
- **Only from the server:** the server reads every `.snbt` file in `config/ftbquests/quests/chapters/` (that folder only, not subfolders) and sends the book to each player when they join.
  - The client never reads quest files from disk. A copy in the modpack or in `defaultconfigs/` is never used.
  - This version has no `lang/` translation files: the text is in the chapter files themselves.
- **A running server keeps its book in memory.** New files only show after a restart, or after `/ftbquests reload` typed in the **server console** (an op in game can only run it with editing mode on).
- **A running server can write its old book back over your new files.** When anything marks the book changed, its next save writes every chapter from memory: every world save (about 5 minutes) and at shutdown.
  - Changes include an op moving or editing anything in editing mode, or a duplicate id found while loading.
  - So upload chapter files **with the server stopped**, or run the console reload right after uploading.
- **A second copy of a chapter loads too.** For example, a browser-renamed `potato_war_ranks (1).snbt` next to the original.
  - The first file read keeps the ids. The other gets new random ids, so the book shows two "Ranks" chapters, one of them old.
  - Keep exactly one file per chapter, named as in `tools/ftbquests/quests/chapters/`.

**If the book still shows old numbers:**
1. Stop the server.
2. In `config/ftbquests/quests/chapters/`, delete any extra copies, then replace the seven `potato_war_*.snbt` files with the repo's.
3. Start the server. Make no edits in editing mode before checking the book.

## How it works
- **The book:** press the quest key or run `/potatowar tree`.
  - **Start Here:** eight short pages: the Blood Pool, your rank, tithe versus offer, the tree, catch-up, the black market, the commands.
  - **The Ranks:** the 11 ranks. Each ticks when you reach it (or when catch-up gives you its crafting access).
  - **The Blood Pool:** the 12 tiers. Each ticks when it opens and lists what it opens.
  - **The branches:** one chapter each, drawn as trees with dependency lines.
- **Each node is a quest:**
  - **stage tasks** for its rank (`potato_standing_<n>`) and its Blood Pool tier (`blood_pool_tier_<n>`). These tick by themselves;
  - **item tasks** that take potatoes and the branch's items. Submit them in the book; partial submissions count;
  - **dependencies** on the nodes below it;
  - **a hidden stage reward** `potato_tree_<node>`. That stage is what the locks check.
  - In the files, the stage tasks and rewards have type `gamestage`, the name FTB Quests 2001.4.22 uses. (An earlier version of these files used `stage`, which FTB Quests ignores: re-upload the chapters.)
- **Potatoes handed in count toward your rank.** When a node's potato task completes, its potatoes are added to your Potato Standing, as if offered with `/potatowar offer`, with the rank-up line. They never fill the Blood Pool.
  - Only plain potatoes count. Break crates first.
- **Personal:** the script switches FTB Teams **parties off**, so every player is their own team and has their own progress. Allies still work.
  - Parties made before install keep their shared progress, so disband them.

## The nodes
Costs are placeholders. Edit `NODES` in `potato_tree.js`, then run the generator.

**Tinkers' Smithy:**

**Potato costs from Tier 4 up are 5× the launch numbers** (owner decision, November 2026, matching the rank change). Tier 0–3 nodes and all item costs are unchanged.

| Node | Needs | Cost | Unlocks |
|---|---|---|---|
| Seared Smeltery | Potato Farmer | 250 potatoes, 16 seared bricks | Placing and using a smeltery controller |
| Steel Smithing | Potato Recruit, Tier 3, Seared Smeltery | 2,500, 32 steel ingots | Steel Tinkers tools |
| Osmium & Steeleaf | Potato Private, Tier 4, Steel | 25,000, 16 osmium, 16 steeleaf | Osmium and steeleaf tools; TF steeleaf gear |
| The Foundry | Potato Soldier, Tier 5, Seared Smeltery | 25,000, 64 scorched bricks | Placing and using a foundry controller and scorched alloyer |
| Cobalt Smithing | Potato Soldier, Tier 5, Osmium & Steeleaf | 50,000, 32 cobalt, 8 knightmetal | Cobalt, knightmetal, knightly and scorched stone tools; TF knightmetal gear |
| Alloy Smithing | Potato Sergeant, Tier 6, Cobalt | 100,000, 16 electrum, 8 fiery | Electrum, invar, constantan, silver, lead, pewter, aluminum and fiery; TF fiery gear |
| Masterwork | Potato Captain, Tier 8, Alloy and Foundry | 300,000, 16 manyullyn, 16 hepatizon | Manyullyn, hepatizon, queen's slime, cinderslime, necronium, blazing bone, blazewood, ancient, enderslime and ichor |
| Dragonsteel | Potato General, Tier 9, Masterwork | 500,000, 8 of each dragonsteel | Dragon scale and the three dragonsteels |

Metals in no node (wood, stone, iron, copper, bronze and the rest) are free.

**Logistics:**

| Node | Needs | Cost | Place and use |
|---|---|---|---|
| Create Logistics | Potato Farmer, Tier 1 | 500, 16 andesite alloy | Funnels (also on belts), tunnels, smart chute, portable storage interface |
| Create Automation | Potato Private, Tier 4, Create Logistics | 25,000, 8 precision mechanisms | Deployer, Mechanical Arm (and so Sequenced Assembly) |
| Immersive Logistics | Potato Recruit, Tier 3 | 2,500, 16 IE steel | Conveyor, sorter, fluid sorter |
| Logistical Transport | Potato Private, Tier 4 | 25,000, 8 basic control circuits | Logistical transporters (all tiers), restrictive and diversion transporters, logistical sorter, QIO importer and exporter |
| Thermal Servos | Potato Soldier, Tier 5 | 50,000, 8 tin gears | Servo, turbo servo and filter attachments (placing only) |
| Item Conduits | Potato Soldier, Tier 5 | 50,000, 16 conduit binder | Ender IO item conduits (placing only); the Vacuum Chest and XP Vacuum |
| ME Logistics | Potato Sergeant, Tier 6 | 100,000, 16 logic processors | Import, export and storage buses; interfaces; annihilation and formation planes; toggle buses; P2P tunnels; Advanced AE's import/export and stock export buses; ME conduits (placing). **Basic ME storage and terminals need no node** |
| Automated Mining | Potato Lieutenant, Tier 7 | 175,000, 32 osmium | Digital Miner, Mechanical Miner, Ender Quarry (Tier 11 to make), Alex's Caves Quarry (Tier 9 to make) |

**Autocrafting:**

| Node | Needs | Cost | Place and use |
|---|---|---|---|
| Mechanical Crafting | Potato Private, Tier 4, Create Automation | 25,000, 8 precision mechanisms | Mechanical Crafter |
| Formulaic Assembly | Potato Private, Tier 4 | 25,000, 4 basic control circuits | Formulaic Assemblicator |
| Ender IO Crafting | Potato Soldier, Tier 5 | 50,000, 2 void chassis | Ender IO Crafter |
| Thermal Fabrication | Potato Soldier, Tier 5 | 50,000, 4 machine frames | Sequential Fabricator |
| Immersive Assembly | Potato Private, Tier 4 | 25,000, 8 steel mechanical components | Using IE's Assembler multiblock (it's formed with the hammer, so only using it is locked) |
| ME Autocrafting | Potato Sergeant, Tier 6, ME Logistics | 100,000, 16 engineering processors | Pattern providers (AE2 and Advanced AE), the pattern encoding terminal, crafting units, accelerators, crafting storage, monitors and Molecular Assemblers; the wireless crafting and pattern terminals (AE2, AE2WTLib, Advanced AE) |
| RFTools Crafting | Potato Lieutenant, Tier 7, Ender IO Crafting | 175,000, 4 RFTools machine frames | RFTools Crafters 1–3 |
| Quantum Crafting | Potato Emperor, Tier 11, ME Autocrafting | 500,000, 16 calculation processors | Advanced AE's Quantum Crafter (and its terminal). Tier 11 because its parts are Tier 11 items |

**Farms:**

| Node | Needs | Cost | Place and use |
|---|---|---|---|
| Create Farming | Potato Farmer, Tier 1 | 500, 8 andesite casings | Mechanical Harvester, Plough |
| Growth Acceleration | Potato Peeler, Tier 1 | 1,000, 16 inferium essence | The five growth accelerators, the MA Harvester |
| Garden Cloche | Potato Recruit, Tier 3 | 2,500, 8 treated planks | Garden Cloche |
| Phytogenic Insolation | Potato Soldier, Tier 5, Garden Cloche | 50,000, 4 phyto-gro | Phytogenic Insolator |
| Mob Spawning | Potato Soldier, Tier 5 | 50,000, 8 soulium ingots | Ender IO's Powered Spawner, Mystical Agriculture's Soulium Spawner, the RFTools Spawner, Draconic's Stabilized Spawner (each also needs its own tier to be made) |

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
- **Placing:**
  - **Blocks** are refused when placed, which also stops deployers placing them for you.
  - **Parts placed onto another block** (AE2 parts on cables, Thermal attachments on ducts, Ender IO conduits) never fire a placement. So right-clicking with one in hand is refused instead. That's the node's `parts` list.
  - **Holding a locked block** doesn't stop you right-clicking things, so you can still open a chest.
- **Using:** right-clicking a node's block is refused, **whoever placed it**: opening it, configuring it, putting patterns in.
  - **Basic AE2 storage is free:** drives, cables, terminals and the plain wireless terminal.
- **Not locked:**
  - **regular machines** (pulverizers, enrichment chambers, crushers, mixers). They follow the Blood Pool, and crafting them at a table already needs the rank;
  - **faucets and casting tables**, so iron and copper casting stays open.
- **Gaps left by design:**
  1. **Machines fed by their owner's hoppers, belts or pipes** keep working for whatever reaches them. That's the owner choosing to share.
  2. **AE2 autocraft requests:** a player with ME Logistics but not ME Autocrafting can order crafts at a terminal on someone else's network that already has crafters. AE2 doesn't tell scripts who ordered.
  3. **Mining add-ons that live inside other items** (RFTools Builder quarry cards, Modular Powersuits miner modules) can't be locked. Crafting them still needs the rank.

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
| `/potatowar next` | players | Your rank, your crafting access, the nodes you can buy now, and what the next ones need |
| `/potatotree check <player>` | op | Their nodes |
| `/potatotree grant <player> <node>` | op | Completes the node's quest and gives its stage. Nothing taken, nothing credited |
| `/potatotree revoke <player> <node>` | op | Resets the quest and takes the stage. Nothing is given back |
| `/potatotree catchup` | op | Runs catch-up now |

Node ids are in `NODES` (e.g. `cobalt_smithing`). `/ftbquests change_progress` also works, but completing a node that way **does** credit its potatoes; use `/potatotree grant` instead.

## Settings (top of `potato_tree.js`)
| Setting | Default | |
|---|---|---|
| `NODES` | 29 nodes | Every node: number `n` (fixes its quest id; never reuse one), rank, tier, needs, potatoes, items, materials, gear, places, parts, use, wireless, position, description |
| `CHAPTERS` | 7 | Chapter ids, titles, icons and file names, in book order |
| `NO_PARTIES` | true | Switch FTB Teams parties off |
| `LOCK_ARMOR`, `ARMOR_CHECK_TICKS` | true, 40 | Take locked armour off, every 2 s |
| `MESSAGE_COOLDOWN_TICKS` | 60 | Between action bar notes |
| `CATCH_UP_LOGIN_DELAY_TICKS` | 60 | After a login, before catching that player up |
| `CATCH_UP_GAP` (in `blood_pool.js`) | 2 | Tiers behind the Pool before catch-up; 0 = off |

**After editing `NODES`, the tiers or the ranks:**
1. Run `node tools/ftbquests/generate_quests.js`. It rebuilds the chapters and the tooltip script.
2. Upload the changed chapter files (best with the server stopped; see "Where the book comes from"), and update the tooltip script in the modpack.
3. Run `/ftbquests reload` from the server console, and `/reload`.
4. Run the audit again (`python3 -I tools/progression_audit.py …`, see PROGRESSION_AUDIT.md).

Moving nodes around in the book's editor is fine. Keep the ids, and re-run the generator only if you also want your edits replaced.

## Test plan (an op and a second account)
1. **Install:** install the mods, scripts and files. The book shows a "Techno's Potato War" group with seven chapters, Start Here first. Try "Create Party" in the FTB Teams screen: refused.
2. **Tiers:** `/bloodpool settier 1`. The second account offers 250 potatoes (`/potatowar offer 250`): The Ranks' first quest ticks.
3. **Buying a node:** open Seared Smeltery and submit 250 potatoes and 16 seared bricks.
   - The quest completes, and the potatoes count toward the rank (`/potatowar` shows 500).
   - A smeltery controller can now be placed and opened.
   - Without it, placing or right-clicking one is refused.
4. **Gear:** `/give` the second account a cobalt Tinkers pickaxe (build one in creative). It won't mine. `/potatotree grant <name> cobalt_smithing`: it mines.
5. **AE2:** as the op, place a drive, a terminal and an import bus. The second account can open the terminal (basic storage is free) but can't put a storage bus on the cable without ME Logistics.
   - Holding a Molecular Assembler, it can still open a chest; placing the assembler is refused.
6. **Catch-up:** `/bloodpool settier 5` with an unranked account online. It's told it was granted Seared Smeltery, Steel Smithing, Create Logistics, Immersive Logistics, Create Farming, Growth Acceleration and Garden Cloche, and the book shows them done.
7. **A Tinkers hammer** without its node: does its area mining stop too?
8. **Tooltips:** hold Shift over a sealed item, an autocrafter and a cobalt tool. The lines show ✘, and turn ✔ after `/bloodpool settier` or `/potatotree grant` (you may need to reopen the inventory).
9. **`/potatowar next`** and the message when a tier opens (`/bloodpool unlock force`): each player is told privately what they can craft and buy.

## What couldn't be verified for KubeJS 6 on 1.20.1
A mock-server test passed 111 checks (with the Blood Pool's tests). The Blood Pool's own suite passes with the tree absent (135), and the tooltip script passed 10:
- **gear:** Tinkers NBT, the variant suffix, TF gear, ops and creative exempt, armour taken off and kept on;
- **placing:** the held item and the block fallback, AE2 parts and Thermal attachments, a node letting an unranked player place a Mechanical Crafter (`blood_pool.js`'s rank rule stepping aside);
- **using:** someone else's blocks, free basic AE2 storage, the wireless terminals; the new nodes (spawners, Digital Miner, IE Assembler, vacuums);
- **parts versus blocks:** parts checked on right-click, blocks on placement, holding a block doesn't block chests, belt funnels;
- **`/potatowar next`, `status()`, and the private tier-open messages** (never `tellraw @a`);
- **tooltips:** tier, rank and node lines with ✔/✘ from the stages, Tinkers materials, tags, the Shift hint;
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

**Checked against the owner's jars** (FTB Quests 2001.4.22, FTB Teams 2001.3.2, FTB Library 2001.2.13, FTB XMod Compat 2.1.3):
- **XMod Compat:**
  - it picks **KubeJS stages** when KubeJS is loaded (its default);
  - it fires `FTBQuestsEvents.completed` for `'#' + tag`, and the event has `player`, `object` and `onlineMembers`;
  - its KubeJS class filter allows `dev.ftb.mods.ftbteams`, so the script may load `FTBTeamsAPI`.
- **FTB Teams 2001.3.2:** `FTBTeamsAPI.api().setPartyCreationFromAPIOnly(boolean)` exists, and both the "Create Party" button and `/ftbteams party create` check it.
- **FTB Library 2001.2.13:** its SNBT reader (the source matches this exact version) reads the generated files' syntax: newline-separated entries, quoted strings, `L` and `d` numbers, empty lists.

In game:
- **FTB Quests:** that the book loads the files, stage tasks tick, item tasks take the potatoes, the hidden stage reward is claimed, and `change_progress` from the console completes a quest for a named player.
- **The `#potato_offer` event** reaching the script in game, with the player and the task's count (the classes and names are confirmed in the jar).
- **Parties off:** that the call from the script takes effect on the live server ("Create Party" refused).
- **Gear locks on real Tinkers tools:** area mining (hammers, excavators), Tinkers bows, and armour moving off.
- **Right-click cancelling** placing AE2 parts and Thermal attachments.
- **The tooltips in game:** `addAdvancedToAll`, `event.shift` inside the callback, and the client seeing the synced stages straight after they change.
- **Deployers** placing a locked block (they should be refused).
