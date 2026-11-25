# Part II test report

Local test server, Forge 47.4.10, two players (leelinda, TryHardArtist), 2026-11-03 and 04, plus one session on the online server. Branch `local-testing`, not pushed.

**Status: paused on 2026-11-05 while the owner sets up the new server, not finished.** Ranks up to Tier 5, catch-up, the quest book, gear locks, tithes and donations, tier opening and the dimension gates all behaved as designed in game. Most autocrafting machines and everything above Tier 5 by hand haven't been tried in game, and the reload kicks are unexplained. See "Not tested yet".

## Fixed: ranks didn't gate vanilla-format crafting recipes (`315d110`)

KubeJS only runs a result check on its own recipe types, and the script attached the check to vanilla recipes without changing their type. At Tier 1, 770 of the 971 recipes meant to need a rank ignored it. Each recipe that needs a check is now switched to `kubejs:shaped` or `kubejs:shapeless` where it stands.

**In game at Tier 1**, leelinda Unenlisted and TryHardArtist a Potato Farmer:

| Test | leelinda | TryHardArtist |
|---|---|---|
| Andesite alloy (shaped), inventory grid and table, both diagonals | No result | Crafts |
| Inferium ingot (shapeless) | No result | Crafts |
| Prudentium essence, using an infusion crystal | No result | Crafts; the crystal stays with `Damage: 1` |
| Tinkers Crafting Station, alloy | Result shows but can't be taken | Crafts |
| Create Blueprint, alloy | No result | Crafts |
| Oak planks (no rank needed) | Crafts | Crafts |

**On the server:**

- **Before and after, every crafting recipe at Tier 11, with every open tier's recipes switched:** 17,120 recipes, 6,416 switched, and none lost, added or changed in group, category, notification, size, result or ingredients.
- **`/bloodpool gatecheck`,** which reads the recipes the game holds: 971 of 971 live at Tier 1 before the autocrafter change, 1,501 of 1,501 at Tier 3 after it. One recipe failed to load at Tier 11 (`mekanism_weaponry:alien_paint_bucket`), so there's nothing to gate there.

## Fixed: autocrafters could make what a player hadn't unlocked (`f95b737`)

**The rule (owner decision):** an autocrafter can't make what a player hasn't unlocked. KubeJS tells a recipe's check nothing about the block crafting, so a script can't tell whose machine it is, and the rule applies to everyone:

| Recipe's tier at Pool Tier T | By hand | Autocrafters, Create's Mixer and Press |
|---|---|---|
| T−2 or lower (open to everyone through catch-up) | Everyone | Yes |
| T−1 and T | Players with the rank | No, not for anyone |

**The cost:** top ranks can't automate the two newest tiers. AE2 opens at Tier 6, but its assemblers can't make Tier 6 crafting-table recipes until Tier 8.

**Banned:** Bibliocraft's 11 Fancy Crafters and the Ars Nouveau Wixie read a recipe's result themselves, so no check reaches them. Their recipes are removed, and placing or using them is refused, including the Wixie Charm. Ops and creative players are exempt. Delete an id from `BANNED_CRAFTERS` to allow one again, which breaks the rule for that block. Only the Fancy Crafter's leak was seen in game. The Wixie's was read from its jar, and I haven't confirmed that its potion brewing goes with it.

**Rank to place:** 4 for the Quark Crafter and Crafty Crate, 7 for Blue Power's Auto Project Table, through two new upgrade tree nodes, Simple Crafters and Project Automation.

**In game:**

| Test | Tier | Player's rank | Result |
|---|---|---|---|
| Place or open a Quark Crafter without the node | 1 | None | Refused with a message |
| Quark Crafter, alloy (Tier 1) | 1 | None | Nothing; ingredients kept |
| Fancy Crafter, alloy, before the ban | 1 | None | **Made the alloy** |
| Mixer, flint and steel (no rank needed) | 1 | None | Works |
| Mixer, inferium ingot (Tier 1) | 1 | None | Nothing; ingredients kept |
| Alloy by hand, and in the Quark Crafter | 3 | None | Both work (Tier 1 is caught up) |
| Mixer, inferium ingot | 3 | None | Works |
| Redstone Root (Tier 2), by hand and in the Quark Crafter | 3 | None | Neither |
| Redstone Root, by hand | 3 | 2 | Works |
| Redstone Root, in the Quark Crafter | 3 | 2 | Nothing; ingredients kept |
| Place or use a Fancy Crafter, after the ban | 3 | 0 and 1, both with Simple Crafters | Refused with a message |

**How far this is proven:** of the machines, only the Quark Crafter and the Mixer were tried, at two tiers. Higher tiers rest on `gatecheck` and on reading the jars.

## Quest book and upgrade tree

Both players were reset to no rank, no nodes and a fresh book at Tier 1 first. My earlier jump to Tier 11 had caught them up to 29 of 31 nodes, which lowering the tier doesn't undo.

**In game at Tier 1:**

| Test | Result |
|---|---|
| Book shows Techno's Potato War with 7 chapters, Start Here first, and the new autocrafter line | Both players: yes |
| `/ftbteams party create test` | Both players: refused |
| `/potatowar offer 250`, then hand in 250 potatoes and 16 bricks for Seared Smeltery | TryHardArtist: quest completes, total 500 |
| Hand in the same with no rank | leelinda: quest completes, and the 250 potatoes make them a Potato Farmer |
| Place a Smeltery Controller without the node | Refused, and it stays in hand |
| Place and open a Smeltery Controller with the node | TryHardArtist: works |
| Simple Crafters and Project Automation show what they need | TryHardArtist: yes. leelinda hasn't answered |
| `/potatowar next` and `/potatowar tree` | Both players: make sense |

**Not explained:** TryHardArtist reported "750 to go" at 500 potatoes, and "Potato Private (rank 5)". The server says 500 to go, and the script has Private at rank 4. Neither could be reproduced, and he may have read an older chat line and counted Unenlisted as a rank.

**Catch-up:** see the final round below.

## Online server, Tier 0 (2026-11-04)

Read from leelinda's client log, which shows only what leelinda's screen showed. That server's files weren't read, and nothing on it was changed.

| Test | Player | Game mode and op | Result |
|---|---|---|---|
| Place a Fancy Crafter | leelinda | Creative, with and then without op | Places: creative players are exempt by design |
| Place and open a Fancy Crafter | Goruk_LoHaus | Creative, op | Works: also exempt |
| Place a Fancy Crafter | Goruk_LoHaus | Survival, no op | Refused with the message |
| Place or use a Fancy Crafter | leelinda | Survival, no op | Refused with the message |
| Craft a Quest Book from a Book and a stone | Goruk_LoHaus | Creative, op | Works |

- **What this adds:** the ban's first run in game at Tier 0. It had only been tried at Tier 3.
- **Not confirmed:** the Mechanical Crafter's refusal. Upgrade tree refusals show above the hotbar, not in chat, so the log can't confirm them either way.
- **Smeltery Controller placed at Tier 0 with no rank, not a lock failure as far as the log shows:** at 18:39 the Pool was raised to Tier 3, and catch-up granted leelinda Seared Smeltery, Create Logistics and Create Farming. Lowering the tier and `/potatowar set <player> 0` don't take nodes back, by design. leelinda was also an op, which is exempt. Goruk_LoHaus's own grant wasn't visible from this log, and neither player has been retested after `/potatotree revoke`.
- **Not explained:** after the tier dropped to 0, Goruk_LoHaus failed to place a controller three times with no message, then succeeded. The node check gives the same answer each time and shows a message when it refuses, so it doesn't look like this lock, but the cause wasn't found.
- **Crafting Station "memory", from lowering the tier:** at Tier 2, leelinda with no rank could craft the alloy only on a station where it had been crafted before. Read from the Tinkers jar, a station keeps its last recipe and reuses it while the grid matches, with no reload hook, and doesn't save it. At Tier 3 the alloy is open to everyone, so that copy has no rank check, and it outlived the drop to Tier 2. Crafting something else there, replacing the station or restarting clears it. Tiers only rise in normal play, so a station can't hold a looser copy then. The final round below repeats this and tests the tier going up.
- **Client crash, not from these scripts:** opening the creative inventory crashed the client twice (17:50 and 17:55) with `Registry Object not present: tinker_rapier:slender_blade`. The client has Tinkers' Rapier, and the server's data lacked its item tags, which points to the jar missing from the server. After the rejoin at 17:57, the log has neither the error nor the tag warning, and leelinda was in creative from 18:07.

## Audit at every tier (2026-11-04, nobody online)

Current scripts on the test server, using `/bloodpool settier`, `/bloodpool audit` and `/bloodpool gatecheck` at each tier. A full restart at Tier 3 also kept the checks live, with no KubeJS errors.

| Pool tier | Recipes | Rank checks live | Crafting recipes without a check | Recipes still making a sealed item |
|---|---|---|---|---|
| 0 | 17,075 | 0 of 0 | 0 | 0 |
| 1 | 19,733 | 971 of 971 | 89 | 4 |
| 2 | 21,879 | 2,076 of 2,076 | 114 | 4 |
| 3 | 22,968 | 1,501 of 1,501 | 41 | 4 |
| 4 | 24,464 | 608 of 608 | 74 | 4 |
| 5 | 27,863 | 1,547 of 1,547 | 62 | 0 |
| 6 | 29,920 | 2,752 of 2,752 | 26 | 4 |
| 7 | 30,806 | 2,064 of 2,064 | 48 | 4 |
| 8 | 32,241 | 1,040 of 1,041 | 26 | 4 |
| 9 | 32,492 | 541 of 542 | 9 | 4 |
| 10 | 32,586 | 220 of 220 | 10 | 0 |
| 11 | 32,654 | 104 of 104 | 2 | 0 |

- **The missing check at Tiers 8 and 9:** `mekanism_weaponry:alien_paint_bucket`, which failed to load, so there's nothing to gate.
- **Still making a sealed item:** 8 recipes in all, the 4 electrum nugget ones below and 4 `bigreactors:reprocessor/*_to_*` at Tiers 6 to 9. Those 4 make Tier 10 ingots, but every Reprocessor part needs the Tier 10 casing, so nobody can build one until then. No script change is needed.
- **No rank check:** see "251 crafting recipes" below.

## Final round, leelinda alone (2026-11-05)

On the local test server, in survival without op. No script changed.

**Catch-up:**

| Test | Result |
|---|---|
| Tier raised from 3 to 5 while offline, then log in | Private message lists Steel Smithing, Immersive Logistics, Growth Acceleration and Garden Cloche |
| The book and the saved progress | All four complete, items included; potato total unchanged at 250 |
| `/potatowar` at Tier 5, rank 1 | "Crafting access: Tier 3 (catch-up)". At Tier 3, rank 1 it rightly doesn't mention it, because access isn't above the rank |
| Funnel and Smart Chute with Create Logistics | Place |
| Growth Accelerator | Refused at Tier 3, places after catch-up gives the node |
| Simple Crafters, Project Automation | Show the right rank, tier and cost |

**Create Logistics and Create Farming showed 50% in the book, with their items open.** The server's Nov 3 log ends 2.5 minutes after that catch-up with no shutdown. The player's stages were saved at logout, but the quest progress wasn't, and the same save lost the Tier 3 ticks. Catch-up skips a node whose stage the player already has, so nothing repairs it. `/potatotree grant` fixes one. Catch-up itself is fine, as the table shows. Stop servers cleanly, because a crash can leave this behind for nodes granted just before it.

**Ranks by hand at Tier 5 (catch-up covers Tiers 1 to 3):**

| Recipe (tier) | Rank 0 or 1 | Rank 4 | Rank 5 |
|---|---|---|---|
| Cogwheel (1) | Crafts | Crafts | Not retried |
| Mekanism Dictionary (4) | No | Crafts | Not retried |
| Steeleaf from essence, a rebuilt recipe (4) | No | Crafts | Not retried |
| Yeta Wrench (5) | No | No | Crafts |
| Purification Chamber, a rebuilt recipe (5) | No | No | Crafts |

**Tinkers memory, asked for by the owner:** the same mechanic in both blocks, repeatable, and only when an op lowers the tier.

| Test | Result |
|---|---|
| Crafting Station that made the alloy at Tier 3, now Tier 2, no rank | Crafts |
| A station that never made it | Result shows, can't be taken |
| The first station, after crafting sticks in it | Result shows, can't be taken |
| Tier going up: a Potato Farmer crafts at Tier 2, then Tier 3 with no rank | Crafts, in that station and a fresh one. A remembered copy checks the player's access at the moment of crafting, so it never wrongly refuses |
| Smeltery that melted raw cobalt at Tier 5, now Tier 4, same slot | Melts |
| A different slot | Doesn't melt |
| Same slot after replacing the controller | Doesn't melt |

A sealed recipe doesn't exist until its tier opens, so no block can remember it early in normal play.

**Gear locks at Tier 5:**

| Test | Without the node | With the node |
|---|---|---|
| Cobalt pickaxe, Steeleaf Pickaxe, mining | Refused with a message | Mines |
| Cobalt sledge hammer | Nothing breaks, middle or surrounding blocks | Mines, surrounding blocks too |
| Cobalt pickaxe on a pig | No real damage, but the "pierced" effect lands | Real damage |
| Cobalt longbow | Shows the draw, message, no arrow | Draws and fires |
| Steeleaf Chestplate | Comes off within seconds, into the inventory | Stays on |
| Tooltips | ✘ with the right node | Changes after the grant |

Steel tools work with Steel Smithing.

**The Blood Pool:**

| Test | Result |
|---|---|
| `/bloodpool tithe` with 100 potatoes and 2 crates | 116 potatoes, 29 Drops, 2 potatoes left |
| `/bloodpool tithe 3` | Refused |
| `/potatowar` after a tithe | Unchanged |
| Cap lowered to 100 on the test copy, 29 already tithed | 284 potatoes, 71 Drops, "fills the day's tithe"; the next tithe is refused |
| `/bloodpool donate 2`, twice | 2 coins and 2,000 Drops each time |
| `/bloodpool top` | Right total |
| Pool reaches 120,000, then `/bloodpool unlock` | "Overflows" line, seal line, Nether line and private message in chat; Nether opens; 1,501 of 1,501 checks live |
| `/bloodpool check` on an item in no tier | Says it can always be crafted |

**Dimension gates:**

| Test | Result |
|---|---|
| Light an obsidian frame at Tier 2 | Doesn't light |
| Step into an End portal at Tier 2 | Sent back, with the Ministry line |
| Real `/home` (FTB Essentials) to a home set in the Nether, then Tier 2 | Sent back within a second, with the Ministry line |
| Plain teleport to the Nether at Tier 2, and the End at Tier 3 | Sent back within a second |

The check runs once a second on where each player is, so it doesn't matter how they got there. Ops, creative and spectator players are exempt. `/tpa` itself wasn't tried, because it needs a second player.

**Not answered before pausing:** what the tier opening looked and sounded like, whether the frame lights at Tier 3, and whether `/bloodpool tiers` reads well.

## Netherite locked to Tier 5 (2026-11-05)

Owner decision, added after the final round. Checked on the test server, not by a player crafting.

| Check | Result |
|---|---|
| Recipe lookups with Tier 4 live | Gone: ingot, scrap, block, smithing, Tinkers' alloy, casting and melting, Mekanism, Immersive Engineering's arc furnace and vein, Botania, AgriCraft, Create Deco, Thermal. The smithing template stays |
| Recipes, before and after | Tier 0: 66 fewer. Tier 2: 73 fewer. Tier 4: 81 fewer. Tier 5: no change, so nothing else was caught |
| Audit at Tiers 0, 2, 4 and 5 | No new recipe still making a sealed item, and no new recipe without a rank check |
| `/bloodpool gatecheck` | All live at Tiers 2, 4 and 5; Tier 5 goes from 1,547 to 1,560 |
| Script load | 0 errors |

**The Foundry's diamond route, turned off (owner decision):** melting diamond ore in a Foundry also gave molten debris, which casts into scrap. The recipes are now rebuilt without that byproduct. On a real Foundry at Tier 5, with no player:

| Melted | Before | After |
|---|---|---|
| 1 diamond ore | 100 molten diamond and 30 molten debris | 100 molten diamond |
| 8 more diamond ore | | 900 molten diamond in all, no debris |
| 1 ancient debris | | 90 molten debris and 10 molten netherite, as normal |

One recipe was rebuilt in this pack, `diamond/ore_singular`. The sparse, dense and Geore versions in Tinkers' jar don't load here, but would be caught if they did. A scan of every mod's recipe files found no other recipe giving molten debris as a byproduct.

## Open: players sometimes get kicked after a reload

`EncoderException: NullPointerException: Cannot read the array length because "array" is null`

| Players online at the reload | Reloads | With a kick |
|---|---|---|
| One | 9 | 0 |
| Two | 13 | 4 (leelinda three times, TryHardArtist once) |

- **Where it fails:** while writing the recipe sync packet, on Tinkers tipped-arrow recipes (`tconstruct:tools/building/arrow_from_tipped`, `tconstruct:smeltery/casting/filling/tipped_arrow_clean`). Rejoining worked every time.
- **Cause unknown.** One idea: two connections encode the same recipes at once while an ingredient's item cache is being cleared. Mantle's encoder does call `Ingredient.getItems()`, but the idea is untested and the sample is small. It also hasn't been tried without the Blood Pool, so the script isn't ruled out.
- **Since `315d110`:** all four kicks came before it, and the reloads with two players online since then had none. That's too few to say the fix helped.
- **Why it matters:** every tier opening reloads the server, and the real server has more players online.

## Open: smaller items

- **Part I scripts have the vanishing-item problem too:** `protected_areas.js` and `pig_escort.js` refuse placements the way the Part II locks did, so a refused item probably vanishes from the player's screen. `black_market.js` also has a placing handler that hasn't been checked. These run on the live server, so they weren't changed.
- **Machines not tried in game:** the Crafty Crate, Mechanical Crafter, Formulaic Assemblicator, Ender IO Crafter, Thermal's Sequential Fabricator, RFTools Crafters, AE2's assemblers, IE's Assembler and the Auto Project Table. Their jars show they use the recipe's check, but one could still lose ingredients when it gets an empty result. The Press and Mechanical Crafter use the Mixer's skip list but weren't tried themselves.
- **IE's Metal Press with an Unpacking Mold:** read from its jar, it takes the result directly for single-ingredient recipes, so it may skip the check. You'd already need the block it unpacks. Not tried in game.
- **Botania's Assembly Halo and Mekanism's QIO window:** read from their jars, they count as machines, so they make nothing above catch-up, even for a player of the rank. Not tried in game.
- **Easing the AE2 cost:** patterns are encoded in a player's own window, which the check can see, so AE2 could perhaps be exempted. Not tried.
- **A locked Tinkers tool's on-hit effects:** a cobalt pickaxe without its node does no real damage to a pig, but the "pierced" effect still lands. Other effects, such as setting a target on fire, might too. Not tried.
- **Electrum nugget leak, Tiers 1 to 4:** `create:crushing/tuff`, `tuff_recycling`, `ochrum` and `ochrum_recycling` can give `thermal:electrum_nugget` (Tier 5) as a secondary output, through Create Crafts & Additions. Sealing them also removes those recipes' other outputs until Tier 5, so this is the owner's call.
- **251 crafting recipes carry no rank check** across Tiers 1 to 11, on special types from Botania, IE, EvilCraft, Ars Nouveau, Ender IO, Mystical Agriculture, Mekanism and others. They're mostly upgrades or copies that need a locked item already. They were reviewed by type, not one by one. Worth a closer look: `enderio:powered_spawner` (Tier 9, `enderio:shaped_entity_storage`).
- **Mod load errors, not from these scripts:** KubeJS warns it can't parse `pamhc2foodcore:honeymuffinitem` and `create_radar:crafting/identification_transponder`, and `create_radar` loot tables reference items that don't exist.
- **The Mixer that couldn't be seen:** TryHardArtist couldn't see my first Mixer, though the server held it and leelinda could see it. They can see it now, and the cause wasn't found.

## Other fixes

| Commit | Fix | Checked by |
|---|---|---|
| `919d7c8` | 3 Create Aquatic Ambitions crushing recipes leaked Tier 1 items as secondary outputs | Tier 0 audit 6 to 0 |
| `fd0c20c` | 134 cross-mod compat recipes leaked items from Tiers 6 to 11 | Tier 5 audit 134 to 0; recipe count fell by exactly 134 |
| `5384192` | 3 Mystical Agriculture recipes with a Chisel result that isn't registered logged KubeJS errors on every reload | Reload shows no KubeJS errors |
| `ae6630f` | Holding a Fancy Crafter made every block refuse the player, a bug in the ban itself | Test; a chest opened with one in hand |
| `d3e0720` | A refused placement made the item vanish from the player's screen while the server kept it | Test; a refused Smeltery Controller stayed in hand |
| `723dec0` | ProjectE removed from the current-state docs and tools, except the row in `PART2_SCRIPTS.md`, the only reminder to delete `disable_projecte.js` and `limit_appliede.js` from the live server | Tests; the two Python tools weren't run because this machine has no Python |

## Not tested yet

- **The progression audit:** `tools/progression_audit.py` needs re-running because the tree changed, but this machine has no Python, so `PROGRESSION_AUDIT.md` predates `f95b737`.
- **Crafting grids:** AE2's crafting terminal, and an AE2 pattern crafting while someone has the assembler's screen open.
- **Machines:** the autocrafters listed under "Open: smaller items".
- **Player-side checks:** crafting by hand at Tiers 6 and up, a rank surviving a rejoin, the last questions of the Pool round, `/tpa`, deployers placing a locked block, and AE2 parts and Thermal attachments being refused.
- **Tooltips:** leelinda's client has an older `potato_tooltips.js`, without Simple Crafters and Project Automation. The lines for other items looked right.
- **Blood tank:** only checked over RCON (`list` and `refill`), not by eye.

## Test server notes

- `online-mode=false` so a second account could join, so anyone who can reach the port can join under any name. Don't leave it running exposed.
- `ops.json` is empty on purpose, because ops are exempt from the locks.
- The server is at Tier 3 with 120,000 Drops, and its Part II scripts match the repo. leelinda has no rank and 9 nodes: Seared Smeltery, Steel Smithing, Osmium & Steeleaf, Cobalt Smithing, Create Logistics, Immersive Logistics, Create Farming, Growth Acceleration and Garden Cloche. TryHardArtist has 500 offered (Potato Farmer) and Seared Smeltery, and is due Tier 1's other nodes when he logs back in.
