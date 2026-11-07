# Script tests

These are offline checks for the KubeJS scripts in `tools/kubejs/`. There's a mock KubeJS 6 server written in Node (fake players, levels, commands, a tick scheduler, `persistentData`, FTB Quests and FTB Teams stubs), a lint for the Rhino rules in CLAUDE.md, and a check that the generated FTB Quests files are current and valid.

They run in about 6 seconds and touch nothing outside the repo (the generated-files check writes only to a temp folder). Run them after every script change, before anything goes on a server.

## Setup
You need Node 18 or newer. Install once:
```
cd tools/tests
npm install
```
`npm install` brings in acorn and acorn-walk, which only the lint needs. The suites themselves need nothing beyond Node.

## Running
| Command (from the repo root) | Runs |
|---|---|
| `node tools/tests/run_all.js` | the lint, then every suite; a summary table; exit 1 on any failure |
| `node tools/tests/run_all.js pool tree` | only suites whose name contains `pool` or `tree` (the lint still runs) |
| `node tools/tests/run_all.js --verbose` | every check, not just the failures |
| `node tools/tests/run_all.js --no-lint` | the suites only |
| `node tools/tests/suites/potato_tree.test.js` | one suite, printing every check |
| `node tools/tests/lint_rhino.js [files]` | the lint only (all scripts, or just the files given) |

From `tools/tests`, `npm test` runs `run_all.js`.

Each check prints one line, `ok   <what>` or `FAIL <what>  <detail>`, and each suite ends with `ALL PASSED` or `N FAILED`. The runner shows the FAIL lines, plus the last lines of any suite that crashed or timed out.

## The suites
| Suite | Scripts loaded | Covers |
|---|---|---|
| `blood_pool` | `part2/blood_pool.js`, `blood_tank.js`, `dimension_gates.js` and the Part I economy, factions and story | Tiers and what each one seals, the Potato Tithe, Potato Standing and ranks, rank-locked crafting (including autocrafters), the conversion of mod crafting formats, `/bloodpool audit`, the dimension gates, the Blood Tank, the black market's standing locks |
| `potato_tree` | the same plus `part2/potato_tree.js` | Tree nodes: gear (Tinkers materials, armour), placing and using, AE2 parts, handed-in potatoes counting toward rank, catch-up at Tier T−2, `/potatowar next`, `/potatotree`, running without FTB Quests |
| `generated_files` | `tools/ftbquests/generate_quests.js` | The committed quest files and `potato_tooltips.js` are what the generator makes now. The quest files only use FTB Quests 2001.4.22 task and reward types. Ids are valid and unique, and every node has its quest and stage |
| `potato_tooltips` | `client_scripts/potato_tooltips.js` | The tier, rank and node lines, and their ✔/✘ against a player's stages |
| `black_market` | `economy/black_market.js`, `bounties.js`, `factions/portal_ambush.js` | Hush Coins, the Hooded Merchant, the shop window, contracts, traps, pranks, bounties |
| `tracker_alibi_trials` | the black market and `factions/trials.js` | The Tracker Compass, Homing Pig, Certified Alibi and trials |
| `end_lockdown` | `end_lockdown.js` and the economy and factions | Unsanctioned Eyes, the frame and portal seal, the portal-only End |
| `factions` | `factions/factions_config.js`, `factions_core.js` | Factions, ranks, invites, faction chat, `/faction` commands |
| `portal_ambush` | `factions/portal_ambush.js` | Portal ambushes, raids, "no getting away" |
| `story` | `story.js` and the Part I scripts | Acts, decrees, the record |
| `clean_slate` | `clean_slate.js`, `events/blood_portal.js` and the Part I scripts | The finale countdown, the Blood Portal, Blood Relics, the Archive books |
| `pig_escort_finale` | `events/pig_escort.js` | The Pig Escort and its finale |
| `pig_escort_hard` | `events/pig_escort.js` | Hard mode: growing waves, elite raiders, pig damage scaling |
| `disguise` | `disguise.js` | `/disguise` and `/undisguise` |
| `techno_tribute` | `techno_tribute.js` | The `/techno` show |
| `smite`, `superaura` | `smite.js` | `/smite`, `/aura`, `/superaura` |
| `fake_players` | `fake_players.js` | The pretend players |
| `give_limits` | `give_limits.js` | Which `/give` commands are refused |
| `back_toll` | `back_toll.js` | `/back` costs 2 Hush Coins: charged, refused, refunded when no teleport happens, refunds owed across a logout |
| `protected_areas` | `protected_areas.js` | Only allowed players break, place or right-click in an area; `allowUse` areas (the Castellan's castle) let everyone use doors and buttons but not buckets or fire |
| `enchanted_porkchop`, `fairy_wings` | those scripts | Their items |
| `nether_portal_whitelist` | `startup_scripts/nether_portal_whitelist.js` | The Nether unlock |

## The lint (`lint_rhino.js`)
**Errors:**
- `const` inside a nested block (if, for, while, switch, try);
- a name declared twice in one function where either declaration is `const`;
- template strings, spread syntax and `Math.PI`;
- a server script that isn't wrapped in an IIFE.

**Warnings:**
- **A function made in a loop that reads a variable the loop declares,** unless an array method like `some` or `filter` runs it on the spot. Rhino keeps one copy of a loop's variables for every pass, so a callback that runs later (scheduled, or an event) sees the last pass's values. Use `forEach`. Node gives each pass its own copy, so **the suites can't catch this; only the lint can.**
- **Three older live-server scripts** written before the IIFE rule (`limit_balance.js`, `ministry_broadcasts.js`, `protected_areas.js`). They're listed in `LEGACY_NO_IIFE`; wrap one and take it off the list.

## How a suite works
Each suite is one file that builds its own mock and then runs checks against it. The suites came out of separate rounds of work, so their mocks have drifted apart. They weren't merged into one shared mock, to avoid breaking checks that pass today.

**The bigger suites** (the Blood Pool, tree, economy and story ones) share one shape:
- `player(name, faction, dim, x, y, z, op)` and `mk(...)` make players with inventories, stages and `tell`.
- `loadAll()` reads the scripts from `tools/kubejs/server_scripts/` and runs them with stand-ins for `ServerEvents`, `PlayerEvents`, `BlockEvents`, `ItemEvents`, `EntityEvents`, `Java.loadClass`, `JsonIO` and `global`.
- `cmd('potatowar offer 250', player)` runs a command through the registered Brigadier tree. `lastReply()` is what the player was told; `'DENIED'` means the permission check refused it.
- `advance(ticks)` moves time on and runs what the scripts scheduled.
- `W.persistent` is `server.persistentData` (`PDB()` reads the Blood Pool's JSON). `W.removedRecipes`, `W.addedRecipes` and `W.ftbqCmds` record what the scripts asked for.
- `ok(label, condition, detail)` records one check.

**To add a check:** find the section of the suite that sets up the state you need (the `// ----- ... -----` headings), and add an `ok(...)` line after it. Run that suite alone while you work on it.

**To test a new script:** copy the nearest suite and change what `loadAll()` reads. The file must print one `ok`/`FAIL` line per check and finish with `ALL PASSED` or `N FAILED`.

## What these tests can't show
The mock checks the scripts' own logic. It can't show:
- the real recipes or items other mods add;
- GUIs (the quest book, JEI, shop windows);
- real block entities, chunk loading, and how other mods react;
- Rhino quirks that Node doesn't share (only the lint covers some of them).

Each system's doc in `tools/kubejs/*.md` ends with "what couldn't be verified": those are the checks to do on a test server. In game, `/bloodpool audit` checks every recipe that's actually loaded.
