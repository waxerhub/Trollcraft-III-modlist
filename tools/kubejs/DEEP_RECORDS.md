# The Deep Records (Part II)

`server_scripts/part2/deep_records.js` puts eight written books, the **Deep Records**, into structure chests. Read in order, they reveal the Ministry's real objective in the new world.

## The secret (admins only: spoiler)
**The Harvest.**
- The seals on the new world's progression aren't a prison. They're a **pump**.
- The Ministry sealed everything so the server would pour blood into the Blood Pool to break them.
- At the twelfth seal it plans to **drain the full Pool** to power its Citadel's **Bureaucratic Barrier** for a century.
- The Blood God's cult is tolerated because "faith fills faster than force". The tithe is "a quota".

This ties together:
- the Valuable Resource Acquisition Initiative broadcast;
- the Seizure (Act III);
- the Siege of the Citadel (Act V).

**The Ministry is still unrevealed.** The books are signed `[REDACTED]`, speak of "the Office", and never say "Ministry". Readers of Part I's Archives will recognise the voice.

## The books
| # | Title | Blood Pool tier | Where | What it gives away |
|---|---|---|---|---|
| 1 | Site Survey: New Holding | 0 | overworld | The new world is "suitable for cultivation"; the crop is left blank. "The subjects arrived on schedule, through the red door." |
| 2 | Records Security Transfer | 0 | overworld | The Warden replaced the dead dragon as Head of Records Security; the old records are kept in the deep cities |
| 3 | Seal Maintenance Log | 1 | overworld | "Do NOT reinforce the seals. They are there to be broken, slowly, at the right price." |
| 4 | Memo: Re: The Blood God | 3 | overworld | "Let them believe it is listening… Faith fills faster than force." |
| 5 | Yield Projections, Q3 | 5 | overworld | Trolls, coins and potatoes as yield; "full yield by the twelfth seal" |
| 6 | Requisition: Pumping Station | 9 | **End Cities only** | A blood pump beneath the basin. "Do NOT let them ask why a pool needs a drain." |
| 7 | Citadel Power Budget | 10 | **End Cities only** | One full Blood Pool runs the Bureaucratic Barrier for a century. "They are filling it for us." |
| 8 | Protocol Full Measure | 11 | **End Cities only** | Open the drain at the twelfth seal. In the margin: "They will think they won." |

- **A book can only turn up once the Blood Pool has reached its tier**, so the reveal follows the season.
- **The biggest plot points (6–8) are only in End City chests** (owner decision). The End opens at Tier 9.
- **In each place, the least-found unlocked book comes first**, so every book turns up before any repeats.

## Where they're found
| Site | Loot tables | Chance per unlooted chest | Books |
|---|---|---|---|
| Ancient cities | `chests/ancient_city`, `chests/ancient_city_ice_box` | 50% | 1–5 |
| Strongholds | `chests/stronghold_library`, `stronghold_corridor`, `stronghold_crossing` | 20% | 1–5 |
| Buried and ruined | `chests/buried_treasure`, `underwater_ruin_small`, `underwater_ruin_big` | 15% | 1–5 |
| Mineshafts and dungeons | `chests/abandoned_mineshaft` (chest minecarts), `chests/simple_dungeon` | 10% | 1–5 |
| End Cities | `chests/end_city_treasure` | 50% | 6–8 |

**How a book gets in:**
- A chest's loot is made when it's first opened. So the chest is noted on the right-click, while it still has its loot table, and the book goes into its first empty slot two ticks later.
- Chest minecarts (mineshafts) are handled the same way.
- A full chest gets no book.

**Archaeology (suspicious sand and gravel) isn't covered:** it isn't a chest. Trail and ocean ruins' *chests* are covered.

## Adding modded structures
Every unlooted container opened with a loot table that isn't in `SITES` is counted. The first time each table appears, the server log gets `[DeepRecords] Unlisted loot table <name>`.

To add some:
1. Run `/deeprecords tables` to see the tables seen so far (YUNG's, Twilight Forest, Ice and Fire…).
2. Add a row to `SITES`, e.g. `{ name: 'Twilight Forest', chance: 0.2, books: OVERWORLD_BOOKS, tables: ['twilightforest:…'] }`.
3. Run `/reload`.

## Commands (op)
| Command | What it does |
|---|---|
| `/deeprecords list` | The current tier, chests rolled per site, and each book: its tier, where it's found, unlocked or sealed, and times found |
| `/deeprecords give <player> <1-8>` | Hand out one book (to replace a lost one, or to seed the story) |
| `/deeprecords give <player> all` | All eight, to read them through |
| `/deeprecords tables` | Unlisted loot tables seen, most common first |

## Settings (top of deep_records.js)
| Setting | Meaning |
|---|---|
| `RECORDS` | The books: id, `minTier`, title (32 characters at most) and pages (about 250 characters each) |
| `OVERWORLD_BOOKS`, `END_BOOKS` | Which books each kind of site can hold |
| `SITES` | Name, loot tables, chance, books |
| `AUTHOR`, `LORE` | `[REDACTED]`, and "CLASSIFIED: Deep Record #n" |
| `DISCOVERY_LOG` | Count and log unlisted loot tables (true) |

**Saved data:** `server.persistentData["deep_records"]` holds the books found, the chests rolled per site and the unlisted tables. Unreadable data is kept under `deep_records_unreadable_<time>`.

**API:** `global.DeepRecords = { records, sites, found() }`.

## Install
Copy `deep_records.js` to `kubejs/server_scripts/part2/` (next to `blood_pool.js`) and run `/reload`. It works without the Blood Pool too, but then only the tier-0 books appear.

## Test plan
1. **Commands:** `/deeprecords list` shows tier 0 with books 1 and 2 unlocked. `/deeprecords give <you> all` gives all eight: read them through.
2. **An ancient city:** open unlooted chests. About half get a book, and the console logs each one.
3. **A stronghold and a mineshaft:** books turn up less often (20% and 10%), including in the chest minecarts.
4. **A modded structure's chest:** `/deeprecords tables` lists its loot table.
5. **Later tiers (test server):** `/bloodpool settier 5`, and books 3–5 start appearing.
6. **End Cities (test server):** `/bloodpool settier 11`, and End City chests give books 6–8; overworld chests never do.

## What couldn't be verified
- **The chest timing:** that a chest's loot is in place two ticks after the right-click on 1.20.1. The same method works for `events/blood_portal.js`'s End City books in Part I.
- **Chest minecarts:** that `ItemEvents.entityInteracted` and a minecart's container slots work from KubeJS.
- **Lootr** (per-player chests), if it's in the pack: those containers may not be filled this way. `/deeprecords tables` and the log show what's happening.
