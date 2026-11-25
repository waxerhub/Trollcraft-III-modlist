# Dragon Hoard (Part II)

`server_scripts/part2/dragon_hoard.js` gives Ice and Fire's dragon lair chests a real hoard. On their own, the chests mostly hold iron, bones, cobwebs and manuscripts. The first time a lair chest is opened, bonus treasure goes into its empty slots on top of its own loot.

## Which chests
These are the loot tables in `iceandfire-2.1.13-1.20.1`:

| Lair | Loot tables (`iceandfire:chest/…`) | Bonus stacks |
|---|---|---|
| Caves (where the dragon sleeps) | `fire_dragon_female_cave`, `fire_dragon_male_cave`, `ice_dragon_female_cave`, `ice_dragon_male_cave`, `lightning_dragon_female_cave`, `lightning_dragon_male_cave` | 3–5 |
| Roosts | `fire_dragon_roost`, `ice_dragon_roost`, `lightning_dragon_roost` | 1–3 |

## The hoard
Each bonus stack is a different entry, drawn by weight:

| Item | Weight | Count |
|---|---|---|
| Gold ingots | 20 | 8–20 |
| Blocks of gold | 5 | 1–3 |
| Diamonds | 10 | 2–5 |
| Emeralds | 10 | 3–8 |
| Sapphires (Ice and Fire) | 8 | 2–6 |
| Silver ingots (Ice and Fire) | 10 | 4–12 |
| Dragon bones | 15 | 2–6 |
| Dragon scales of the lair's type | 12 | 3–8 |
| Dragon blood of the lair's type | 4 | 1 |
| Bottles o' enchanting | 6 | 3–8 |
| Golden apples | 4 | 1–2 |

**Scales by dragon type.** One colour is picked at random:
- **Fire:** red, green, bronze or gray.
- **Ice:** blue, white, sapphire or silver.
- **Lightning:** electric, amethyst (Ice and Fire spells it `amythest`), copper or black.

**The Blood Pool comes first.** Anything the Pool still seals is skipped, and the other entries are drawn instead. Ice and Fire opens at **Tier 6**, so until then a hoard is vanilla treasure only: gold, diamonds, emeralds, bottles o' enchanting and golden apples. From Tier 6 the dragon materials join in.

**Lair chests can also hold Deep Records books 1–5** (25%), from `part2/deep_records.js`. See [DEEP_RECORDS.md](DEEP_RECORDS.md).

## Settings (top of dragon_hoard.js)
| Setting | Meaning |
|---|---|
| `LAIRS` | Loot table → the dragon type and whether it's a cave |
| `STACKS` | Bonus stacks: caves `[3, 5]`, roosts `[1, 3]` |
| `HOARD` | The entries: item, weight, count. `scales` and `blood` become the lair's type |
| `SCALES`, `BLOOD` | The scale colours and blood item for each type |

**Saved data:** `server.persistentData["dragon_hoard"]` counts chests and stacks. Every hoard is also written to the server log (`[DragonHoard] fire dragon cave chest at … : 12 minecraft:gold_ingot, …`).

**API:** `global.DragonHoard = { lairs, hoard, stats() }`.

## Install
Copy `dragon_hoard.js` to `kubejs/server_scripts/part2/` (next to `blood_pool.js`) and run `/reload`. Without the Blood Pool, nothing is skipped.

## Test plan
1. **A dragon cave chest:** open an unopened one. It has its own loot plus 3–5 more stacks, and the console logs the hoard.
2. **A roost chest:** it gets 1–3 more stacks.
3. **Before Tier 6:** no dragon bones, scales, blood, silver or sapphires.
4. **At Tier 6 or above (test server):** dragon materials appear, with scales matching the lair's dragon type.

## What couldn't be verified
- **The chest timing:** that a lair chest's own loot is in place two ticks after the right-click. This is the same method as the Deep Records.
- **Lootr:** if Lootr (per-player chests) is in the pack, its chests may not be filled this way.
- **Item ids:** they come from the jar, `iceandfire-2.1.13-1.20.1-beta-5`. A different Ice and Fire version could rename them; an unknown id would fail to load into the chest, and the log would show it.
