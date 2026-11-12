# Twilight Forest boss chests (Part II)

When a Twilight Forest boss dies, TF rolls the boss's loot table into a chest where it died. `part2/twilight_bosses.js`
adds two pools to each of those eight tables and keeps all of TF's own loot:

- **potato crates** (Farmer's Delight, 9 potatoes each), for the Potato War: `/potatowar offer` raises a player's
  Standing, and `/bloodpool tithe` feeds the Pool;
- **spoils:** a few draws from a list of valuables. Harder bosses get more draws and better items.

## Files

- `tools/kubejs/server_scripts/part2/twilight_bosses.js` → `<server>/kubejs/server_scripts/part2/`, then `/reload`
  (loot tables reload with it; no restart). Part II only, because Twilight Forest is a Part II mod. It needs no other
  script.
- Tests: `tools/tests/suites/twilight_bosses.test.js`.

## The bosses, easiest first

The same ranking sets what each boss pays into the Blood Pool (`part2/boss_blood.js`, see `BOSS_BLOOD.md`).
Health is from the TF 4.3.2508 jar. The ranking is a judgement from health, damage and how each fight works. Ranks 2–4
come from play on the server: the Lich proved harder than the Minoshroom and the Alpha Yeti. If your players find two of
them the other way round, swap their rewards in `BOSSES` (and their `rank` in `boss_blood.js`).

| Rank | Boss | Health | Why it sits here |
|---|---|---|---|
| 1 | Naga | 120 | The first boss. It charges and bites in an open courtyard, with no ranged attack. |
| 2 | Minoshroom | 120 | It charges with a big axe at the end of the Labyrinth, past its minotaurs. Resists knockback. |
| 3 | Alpha Yeti | 200 | It grabs and throws players and brings down ice from the ceiling, but it's slow. |
| 4 | Lich | 100 | Shields that must be broken, then shadow clones and minions, then melee. Harder in play than ranks 2 and 3. |
| 5 | Knight Phantoms | 6 × 35 | Six armoured knights with knightmetal weapons, fought in formations after the Stronghold's goblin knights. |
| 6 | Hydra | 360 | The most health. Only its heads take damage, and they bite, breathe fire and lob mortars. |
| 7 | Ur-Ghast | 250 | It flies out of reach at the top of the Dark Tower, so you need the tower's ghast traps. It can't be knocked back. |
| 8 | Snow Queen | 200 | The hardest hits (7 damage), ice shields to break, and flying. Resists most knockback (0.75). |

TF's own order (from its advancements in the jar): the Naga, then the Lich, then three branches:

- Minoshroom, then Hydra;
- Knight Phantoms, then Ur-Ghast;
- Alpha Yeti, then Snow Queen.

The Hydra, the Ur-Ghast and the Snow Queen together open the Troll caves.

## What each chest gets now

TF's own loot is unchanged: trophies, Naga scales, the Lich's scepter and gold gear, the Minoshroom's axe and
stroganoff, Hydra chops and fiery blood, the Knight Phantoms' knightmetal and phantom gear, carminite and fiery tears,
Alpha Yeti fur and ice bombs, and the Snow Queen's bow. Added:

| Boss | Potato crates (potatoes) | Spoils draws | Spoils it can draw |
|---|---|---|---|
| Naga | 8–16 (72–144) | 2 | emeralds, gold, XP bottles, golden apples, 1–2 diamonds, Charm of Life I |
| Minoshroom | 12–24 (108–216) | 2 | emeralds, XP bottles, golden apples, 1–3 diamonds, an enchanted book (15–25 levels), Charm of Life I |
| Alpha Yeti | 16–32 (144–288) | 2 | XP bottles, 2–3 diamonds, emeralds, golden apples, a book (20–30), Charm of Keeping I, Charm of Life I |
| Lich | 20–40 (180–360) | 3 | lapis, XP bottles, a book (20–30), emeralds, 2–4 diamonds, Charm of Keeping I |
| Knight Phantoms | 24–48 (216–432) | 3 | 3–5 diamonds, XP bottles, a book (25–30), emerald blocks, golden apples, Charm of Life I, Charm of Keeping II |
| Hydra | 32–48 (288–432) | 3 | 4–6 diamonds, XP bottles, a treasure book (30), emerald blocks, golden apples, Charm of Life II, Charm of Keeping II, an enchanted golden apple |
| Ur-Ghast | 40–56 (360–504) | 4 | 4–8 diamonds, 32 XP bottles, a treasure book (30), emerald blocks, golden apples, Charm of Life II, Charm of Keeping II, an enchanted golden apple |
| Snow Queen | 48–64 (432–576) | 4 | XP bottles, a treasure book (30), diamond blocks, emerald blocks, Charm of Life II, an enchanted golden apple, a Totem of Undying, Charm of Keeping II |

A draw can repeat an item. For scale, Potato Farmer, the first rank, needs 250 potatoes, and Potato Peeler needs 1,000.
A "treasure" book can roll Mending and other treasure enchantments.

### Rules the spoils follow

- **No progression items:** TF counts holding a trophy, a Naga scale, any of the Lich's scepters or Alpha Yeti fur as
  having beaten that boss, and eating Meef Stroganoff opens the Hydra's area. So none of them may be added to the spoils,
  or a chest would open the next area early. `KEY_ITEMS` lists them, and the script skips any that appear in the spoils,
  with an error in the log.
- **No Blood Pool tier materials:** nothing in the spoils is gear or a material that a tier locks (ironwood, steeleaf,
  knightmetal, fiery, carminite, arctic or yeti gear, Charm of Keeping III). TF's own drops still include some, like the
  Knight Phantoms' knightmetal tools and the Lich's scepters. They were always in these chests, and the locks are
  crafting only. Knightmetal gear still needs its upgrade-tree node to work (`part2/potato_tree.js`).
- **Every chest fits:** a boss chest has 27 slots, and anything beyond that is lost. The fullest one (the Snow Queen's)
  can reach 16 stacks before TF spreads them across empty slots.

## How it's done

- The Knight Phantoms' chest is the chest loot table `twilightforest:chests/stronghold_boss`, which TF places when the
  last knight dies. The other seven are the bosses' entity loot tables, `twilightforest:entities/<boss>`, so the script
  uses `ServerEvents.chestLootTables` for one and `ServerEvents.entityLootTables` for the rest. TF also ships
  `chests/darktower_boss`, but nothing in the game uses it (only TF's data generator refers to it).
- `event.modify(id, table => ...)` hands over the table with TF's pools already in it, and the script adds its own pools
  after them.
- **If a table isn't found,** the script stops and logs `left as TF made it` rather than write a table holding only its
  own pools.
- **If an item id doesn't exist,** for example after a typo or a removed mod, that entry is skipped and logged. One bad
  id would make Minecraft drop the whole table.

## Settings (top of `twilight_bosses.js`)

- `CRATE`: the potato item, `farmersdelight:potato_crate`. Any item in `POTATO_WORTH` (`part2/blood_pool.js`) counts.
- `BOSSES`: one entry per boss, easiest first:
  - `crates: [min, max]`: the potato crates;
  - `rolls`: how many spoils it draws;
  - `spoils`: the list it draws from, each `{ item, count: [min, max], weight }` or
    `{ book: [min, max] levels, treasure, weight }`. Weights are relative: 20 is four times as likely as 5.
- `KEY_ITEMS`: TF's progression items, never added as spoils.

## Test plan (an op)

1. `/reload`. The log shows `[TwilightBosses] <boss>: added potato crates and N spoils` for all eight.
2. Give yourself each table's loot, a few times each:
   - `/loot give @s loot twilightforest:entities/naga`
   - the same for `lich`, `minoshroom`, `alpha_yeti`, `hydra`, `ur_ghast` and `snow_queen`
   - `/loot give @s loot twilightforest:chests/stronghold_boss`

   Each should give TF's usual drops plus potato crates and the spoils.
3. **A real kill:** `/summon twilightforest:naga ~ ~ ~5 {NoAI:1b}`, then `/kill @e[type=twilightforest:naga]`. A chest
   appears where it was, with scales, the trophy, crates and spoils.

## Tested on the local test server (8 November 2026)

- **At startup:** all eight tables got their pools, and the log showed no loot errors for TF.
- **Rolled tables:** each table, rolled twice into a chest with `/loot insert`, gave TF's drops plus one stack of crates
  in range and the spoils.
- **Real kill:** a Naga summoned and killed with `/kill` left a TF chest where it died. It held scales, the trophy,
  14 crates, emeralds and XP bottles, spread over 20 slots.
- **`/reload`:** after a reload, the Naga's table still had one crate pool and two draws, not twice as many.
- **Not from this script:** the Knight Phantoms' chest also rolled a Chance Cube. Another mod adds that to the table.

## What couldn't be verified

- **Real kills of the other seven:** only the Naga was killed for real. The other seven tables were rolled directly.
  The Knight Phantoms' chest comes from TF's stronghold code and the rest from TF's boss loot code. Both read these
  same tables, according to the jar.
- **Balance:** whether the amounts feel right on the live server. That's a judgement to adjust in `BOSSES`.
