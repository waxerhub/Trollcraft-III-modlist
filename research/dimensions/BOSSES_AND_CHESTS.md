# Bosses and structure chests: the Aether, Deeper and Darker, Blue Skies

Research for the Blood Pool's hooks (`boss_blood.js`, `twilight_bosses.js`, `deep_records.js`, `dragon_hoard.js`).
Jars: `aether-1.20.1-1.5.2-neoforge` (with its bundled `nitrogen_internals-1.0.12`), `deeperdarker-forge-1.20.1-1.3.3`,
`blue_skies-1.20.1-1.3.31` (with `structure_gel-1.20.1-2.16.2`). Vanilla numbers from the test server's
`server-1.20.1-…-srg.jar`; SRG names checked against its mapping files. Configs and the world's data packs from the
test server (a stand-in for the live server). KubeJS behaviour from `kubejs-forge-2001.6.5-build.26` (javap).

**Evidence marks:** **R** = read from the jar (class bytecode or JSON); **C** = read from the test server's config or
world; **I** = inferred. Gear tiers are not redone here (see `research/AETHER_DEEPERDARKER.md`; Blue Skies gear is
read separately in `BLUE_SKIES_GEAR.md`).

## 1. Bosses and mini-bosses

### The Aether (`aether:the_aether`)

Three bosses, tagged `forge:bosses` (R). Each is placed once, as an entity in its dungeon's `boss_room` structure
piece (R), and never respawns (I: nothing re-places it). None has armour (R: no armour attribute). All three can be
hurt only by a player standing inside the boss room (R: `BossRoomTracker.isPlayerWithinRoomInterior`), not in
Peaceful (R), and always by damage that bypasses invulnerability (`/kill`, the void) (R). Each dies through
`super.die()` (R), so the normal death event fires (I: Forge's `LivingDeathEvent`, which KubeJS's
`EntityEvents.death` uses). A dungeon boss carries an NBT `Dungeon` compound (origin, room bounds, the UUIDs of the
players tracked in the dungeon); a `/summon`ed one has none (R: nitrogen `BossMob.addBossSaveData`).

| Boss | Entity id | Health | Attacks (damage) | Where and how | Drops (entity loot) | Reward chest |
|---|---|---|---|---|---|---|
| Slider | `aether:slider` | 400 | Slides into you: 6 per hit (R: `CollideGoal`); crushes blocks in its way; faster at 100 health or less (R: `isCritical`) | Bronze dungeon boss room. Wakes when first hit. **Only a pickaxe hurts it**: a tool that can dig as one, anything in `#minecraft:pickaxes`, or the right tool for carved stone; of projectiles, only Quark's pickarang and flamerang (R: `canDamageSlider`, tags `aether:slider_damaging_items`, `aether:slider_damaging_projectiles`) | `aether:entities/slider`: bronze dungeon key, 7–9 carved stone (R) | Treasure Chest, `aether:chests/dungeon/bronze/bronze_dungeon_reward` |
| Valkyrie Queen | `aether:valkyrie_queen` | 500 | Melee 13.5 (R: attribute); homing thunder crystals, 5 each (R); teleports around her target (R) | Silver dungeon boss room. **She fights only a player carrying 10 Victory Medals, which she takes** (R: `handleNpcInteraction`, 10). Medals: 1 per Valkyrie (R: `aether:entities/valkyrie`); Valkyries (50 health, 10 melee, R) come out of trapped angelic stone in the dungeon (R: `AetherBlocks` `TrappedBlock` → `VALKYRIE`) | `aether:entities/valkyrie_queen`: silver dungeon key, a golden sword (R) | `…/silver/silver_dungeon_reward` |
| Sun Spirit | `aether:sun_spirit` | 500 | Fire crystals: 15 and 6 s of fire (R); ice crystals: 7 (R); a **Fire Minion** (`aether:fire_minion`, 40 health, 15 melee, R) each time a reflected ice crystal hits it (R) | Gold dungeon boss room; the fight follows its dialogue (R: chat lines; I: talking starts it). **Invulnerable except to cold damage or while frozen**: hitting its own ice crystal back into it freezes it for 175 ticks (8.75 s), and only then can players hurt it (R: `hurt`, `isInvulnerableTo`, tag `aether:is_cold`). Its death ends the Aether's eternal day (R) | `aether:entities/sun_spirit`: gold dungeon key, the Sun Altar (R) (any player can use it; whitelist off, C) | `…/gold/gold_dungeon_reward` |

**The Treasure Chest** (`aether:treasure_chest`, 27 slots, R) is placed with the boss room (a "Treasure Chest" data
marker sets its loot table, R), not on death. NBT: `LootTable` (until opened), `Kind` = `aether:bronze|silver|gold`,
`Locked` (R). The first right-click with the matching key unlocks it and uses up the key without opening it; the next
right-click opens it and rolls the loot (R: `TreasureChestBlock.use`, `tryUnlock`).

Mini-mobs, not bosses: Mimic (`aether:mimic`, 40 health, 3 melee, R; 2 in 5 dungeon "chests" are Mimics, R), Sentry
(`aether:sentry`, 10 health, R), Valkyrie (above), Fire Minion (above).

### Deeper and Darker (`deeperdarker:otherside`)

**No boss.** Nothing in the jar is tagged as one (R). The nearest is a mini-boss:

| Mob | Entity id | Health / armour | Attacks | Where and how | Drops |
|---|---|---|---|---|---|
| **Stalker** | `deeperdarker:stalker` | 200 / 4; knockback-immune (R) | Melee **22** (R). A "ring": while players are within 10 blocks (8 up and down), a countdown runs; then for 200 ticks every player in range is hit for 2 (as often as hurt cooldowns allow, I) and 1–3 sculk leeches appear every 40 ticks; it repeats every 440 ticks (R). Hunts by vibrations, like the Warden (R: implements `VibrationSystem`; I: sneaking avoids it) | **Only from Otherside temple vases.** Breaking a vase placed by world generation (not Silk Touch, not Peaceful): 16% are fake (C: `fakeVaseChance`); a fake one spawns a Stalker 31.25% of the time (C: `stalkerSpawnChance`), else 1–3 sculk leeches (R). So about **5% of vases** (I). Player-placed vases are "safe" (R). It emerges for 70 ticks, and has a boss bar (R) | `deeperdarker:entities/stalker`: 1 soul crystal (+0–1 Looting) (R) |

Others for reference: Shriek Worm (`deeperdarker:shriek_worm`, 100 health, 7 melee, can't move, R); Shattered (50,
6), Sculk Centipede (20, 3), Sludge (16, 4), Sculk Snapper (12, 3), Sculk Leech (4) (R). No reward chest exists.

**The Warden is the Otherside's key:** every Warden drops a Heart of the Deep and 1–3 warden carapace (R:
`deeperdarker:warden_heart_from_warden`, `…_carapace_from_warden` loot modifiers). The temples have 7 sculk
shriekers across their pieces, all with `can_summon=true` (R: structure NBT), so **Wardens can be summoned in the
Otherside too**, as in ancient cities (I).

### Blue Skies (`blue_skies:everbright`, `blue_skies:everdawn`)

Four bosses, tagged `blue_skies:bosses` (R). Each waits in a dungeon until summoned at its **keystone** with **4
dungeon keys** (used up, R: `isCorrectKey` needs a stack of 4, `shrink(4)`) or with **its own arc** (the boss's drop),
which isn't used up but goes on a **3,600-tick (3-minute) cooldown** (R). An arc summon sets `BossRespawned` (R) and
makes the boss one difficulty level harder (R). Health is set at summoning and **grows with the players in the
dungeon** (R: `getBossHealth`). A hit can do at most 15 or 20 damage (R: `getDamageCap`). Each heals itself (R:
`getHealAmount`) and has a second phase at half health (R). Dies through `super.die()` then `onBossDeath` (R). NBT:
`DungeonSpawned`, `BossRespawned`, `DifficultyID`, `BossHomePos` (R).

| Boss | Entity id | Health | Armour, melee | Notes on the fight (R unless marked) | Dungeon, key, arc | Progression |
|---|---|---|---|---|---|---|
| Summoner | `blue_skies:summoner` | 350 + 200 per extra player | 0, 2 (default) | Caster: summons Artificial Golems (10 health; melee and ranged kinds), sphere attack; heals 40; cap 15 per hit; immune to lightning, and **teleports away from projectiles** | Everbright blinding dungeon; `blinding_key` ×4; `ethereal_arc` | first (none needed) |
| Alchemist | `blue_skies:alchemist` | 500 + 150 per extra player | 0, 2 | Caster: potion clouds, fire-arrow volleys, decaying spikes (5 each), liquid conversion, blindness; heals 40; cap 20; projectiles make it teleport | Everdawn blinding dungeon; `blinding_key` ×4; `dusk_arc` | first |
| Starlit Crusher | `blue_skies:starlit_crusher` | 500 + 150 per extra player | 0, **10**; knockback-immune | Roots, ground smash (3 per slam), spin, leaf spew, owls, spewters, wooden walls (hits on its walls go to it); heals 30; cap 20; reach 4.15 | Nature dungeon (Everbright); `nature_key` ×4; `nature_arc` | 1 (I: Summoner beaten) |
| Arachnarch | `blue_skies:arachnarch` | 500 + 200 per extra player | **6**, **14**; knockback-immune; strong knockback (4) | Venom, screech, lunges, climbs onto the ceiling and drops, nested spiders (10 health); heals 50; cap 15; reach 5.08 | Poison dungeon (Everdawn); `poison_key` ×4; `poison_arc` | 1 (I: Alchemist beaten) |

**Drops: no chest.** On death every player within 15 blocks of the boss's home gets their own loot bag and trophy as an
item only they can see (R: `onBossDeath`, `dropLootBag`, `setVisiblePlayerId`), if `doMobLoot` is on (R). The bag
rolls `blue_skies:loot_bags/<boss>/<common|uncommon|rare>` (R: the tables; I: the id is built from the boss's id and
rarity). Rarity weights common/uncommon/rare by level (R): Easy 70/25/5, Normal 60/30/10, Hard 50/30/20, Platinum
0/60/40; an arc summon is one level up. The test world is Normal (C).

What a bag holds (R): the boss's **arc** (always; re-summons it), an armour-trim template, materials (emeralds, soul
fragments or ventium, moonstone shards, aquite, string, logs), and sometimes the boss's weapon or item: Summoner
`soulbound_spear` (always), `summoning_table`, `summoning_tome`; Alchemist `spike_shield` (always), `alchemy_table`,
`alchemy_scroll`; Starlit Crusher `crushing_hammer`, `defying_starlight`; Arachnarch `different_sword`, `venom_sac`,
`venomous_encounter`.

**Keys** come from the dungeon's own chests (`library_chest_key`, both `prison_chest_*`, `study_chest`: one
`blinding_key` each; `nature_dungeon/chest_key`, `poison_dungeon/chest_key`: one key each, R), and clicking a
keystone unlocks a key trade (R: advancements `progression/unlock_*_key_trade`; I: a villager trade, price not read).

### Vanilla bosses: not in `BOSSES`

`BOSSES` in `boss_blood.js` holds only the eight Twilight Forest bosses (R: repo). The Warden, the Wither and the Ender
Dragon pay nothing today. (The Anamian Axe and the Deepdelver Maul count the Wither, 300, and the Dragon, 500, for
their own Souls and Grit; not the Warden.)

| Boss | Entity id | Health, armour | Melee | Notes |
|---|---|---|---|---|
| Warden | `minecraft:warden` | 500, 0 (R) | **30** (R); sonic boom through armour (10, R) | Re-summonable from `can_summon` shriekers (ancient cities, Otherside temples). One that digs away doesn't die, so pays nothing (I) |
| Wither | `minecraft:wither` | 300, 4 (R) | skulls | Built at will from 3 wither skeleton skulls (Nether: Tier 3) |
| Ender Dragon | `minecraft:ender_dragon` | 200 (R) | | The End opens at Tier 9; respawned with 4 End Crystals. `clean_slate.js` and `blood_portal.js` already catch its death with `EntityEvents.death` (repo) |

### 1b. Proposed Boss Blood amounts

On the existing scale (each rank about a quarter more: 200, 250, 300, 400, 500, 650, 800, 1,000). These bosses hit
far harder than Twilight's (13.5 to 30 against the Snow Queen's 7), so they sit by fight difficulty, not hit size.

| Boss | Drops | Twilight peer | Why |
|---|---|---|---|
| Slider | **200** | Naga | 400 health but one predictable attack (6); needs only a pickaxe. The commonest boss of all (a bronze dungeon can start in every 6×6-chunk cell), so keep it at the bottom |
| Stalker (mini-boss) | **250** | Minoshroom | 200 health, 4 armour, 22-damage hits, the ring and leeches; but a random 5%-per-vase spawn, not a planned fight |
| Summoner | **400** | Lich | Caster with minions, heals, dodges projectiles, capped hits; the Everbright's first boss |
| Alchemist | **500** | Knight Phantoms | As the Summoner with more health (500) and fire, poison and blindness; the Everdawn's first boss |
| Valkyrie Queen | **650** | Hydra | 500 health, 13.5 melee, homing crystals, teleports; and the 10-Valkyrie medal hunt first |
| Starlit Crusher | **650** | Hydra | 500 health, 10 melee, knockback-immune, area attacks and summons; second Everbright boss |
| Arachnarch | **800** | Ur-Ghast | 500 health, 6 armour, 14 melee, ceiling drops, spiders, heals 50, capped hits; second Everdawn boss |
| Sun Spirit | **1,000** | Snow Queen | Only hurt in 8.75-second windows after reflecting its own crystals; 15-damage fire and 15-damage minions; the Aether's last boss |
| Warden | **500 once per player**, then 100 (or a daily cap) | Knight Phantoms | The hardest hitter here and the Otherside's key, but re-summonable from shriekers |
| Wither | **500** | Knight Phantoms | 300 health and armour, but built at will once the Nether opens; can be trapped |
| Ender Dragon | **1,250 first kill on the server**, 250 respawned | (rank IX) | A server milestone at Tier 9; respawns cost 4 End Crystals |

The eight dimension bosses once each come to 4,450 Drops (Twilight's eight: 4,100).

**Detecting the kill** (all by entity id through `EntityEvents.death`, as now; none is multi-part):

- **Aether:** one per dungeon. To ignore `/summon`ed ones, require the NBT `Dungeon` tag (R). Its tracked-player
  UUIDs could replace the 64-block radius for credit (R: `DungeonPlayers` in the tag; optional).
- **Blue Skies:** **farmable**: an arc summons the boss again every 3 minutes, each kill dropping a fresh bag per
  player. Pay only when `BossRespawned` is false (a key summon) and `DungeonSpawned` is true, and at most once per
  `BossHomePos` (keys can also be bought). Walls and roots aren't the boss (they have their own ids, R).
- **Stalker:** finite (vases don't come back, and placed ones are safe, R).
- **Warden:** farmable through shriekers; pay once per player or cap per day.
- `/kill` and the void are already excluded (`NO_PAY_DAMAGE`); minions have their own ids
  (`aether:fire_minion`, `aether:valkyrie`, `blue_skies:artificial_golem`, `blue_skies:nested_spider`,
  `deeperdarker:sculk_leech`).
- **The test** `boss_blood.test.js` asserts exactly eight bosses ranked 1–8 and matching `twilight_bosses.js` (R: repo),
  so the new ones belong in a second table (or the test changes). `/bossblood`'s header says "Twilight Forest bosses".

## 2. Boss reward chests: room for bonus loot?

| Boss | Reward | Table id | Can it take Twilight-style pools? | How a script recognises it |
|---|---|---|---|---|
| Slider | Treasure Chest | `aether:chests/dungeon/bronze/bronze_dungeon_reward` | Yes (a chest table rolled on first open), but it already averages 20 stacks in 27 slots and overflows 2% of the time (I: simulated from the JSON, 20,000 rolls) | `ServerEvents.chestLootTables`, `event.modify('aether:dungeon/bronze/bronze_dungeon_reward', …)` (R: KubeJS's chest event prefixes `chests/`). On the block: `aether:treasure_chest`, `LootTable` as above, `Kind` `aether:bronze` |
| Valkyrie Queen | Treasure Chest | `aether:chests/dungeon/silver/silver_dungeon_reward` | Yes: 14 stacks on average, at most 17 (I: simulated) | the same, `Kind` `aether:silver` |
| Sun Spirit | Treasure Chest | `aether:chests/dungeon/gold/gold_dungeon_reward` | **Not as pools**: it averages 24 stacks and **overflows 27 slots in about 31% of openings** already (I: simulated). Add stacks into empty slots after opening instead (Dragon Hoard's method) | the same, `Kind` `aether:gold` |
| Blue Skies bosses | per-player bags | `blue_skies:loot_bags/<boss>/<rarity>` (JSON type `minecraft:chest`, R) | Possible but unwise: one bag per player per kill, and arc re-summons every 3 minutes | `ServerEvents.genericLootTables`, `event.modify('blue_skies:loot_bags/summoner/common', …)` (R: the generic event adds no prefix and all six loot events share one map; it rewrites the type to `minecraft:generic`, I: harmless). Better: a death hook that checks `BossRespawned` |
| Stalker | none | (entity) `deeperdarker:entities/stalker` | Only as ground drops | `ServerEvents.entityLootTables`, `event.modify('deeperdarker:stalker', …)` |
| Warden | none | (entity) `minecraft:entities/warden` | Ground drops; Deeper and Darker's heart and carapace are added on top by loot modifiers (R) | `event.modify('minecraft:warden', …)` |

Only modify the top-level reward tables: their sub-tables (`bronze_dungeon_treasure`, `gold_dungeon_treasure`,
`silver_dungeon_valkyrie`, …) are also drawn from inside other pools (R). The Deep Records/Dragon Hoard right-click
method works on Treasure Chests: the unlocking click leaves `LootTable` in place, so the two-tick check sees "didn't
open" and waits for the real opening (R + I).

## 3. Structures with chests

How common: a vanilla `random_spread` places at most one per `spacing`×`spacing`-chunk cell, at least `separation`
chunks in from its edge. Structure Gel's `grid_placement` (Blue Skies) puts one candidate per `spacing`-chunk grid cell,
offset randomly by up to `offset` chunks, kept with chance `frequency`, never within 12 chunks of 0,0 (R:
`GridStructurePlacement`). All need their biome as well.

### The Aether

| Structure | Chest tables | Contents (R) | Placement (R) |
|---|---|---|---|
| `aether:bronze_dungeon` (up to 8 rooms) | `aether:chests/dungeon/bronze/bronze_dungeon` (3 of 5 chest spots; the rest Mimics); `…/bronze_dungeon_reward` (Treasure Chest) | Ordinary: zanite tools (zanite sword at Tier 5), darts, swet cape, ice pendant, ambrosium, a music disc; 7 stacks on average. Reward: one Neptune armour piece, Valkyrie Lance / Hammer of Kingbdogz / Sentry Boots or Slider's disc, 3–5 of zanite armour, shield of repulsion, cloud staff, phoenix bow, flaming sword, agility cape…, 4–15 lightning knives and darts | random_spread 6/5, triangular, kept 4 chunks from silver/gold dungeons; every Aether biome. It searches nearby chunks for terrain big enough (R), so not every cell has one (I) |
| `aether:silver_dungeon` | `…/silver/silver_dungeon` (3 of 5 spots); `…/silver_dungeon_reward` | Ordinary: zanite sword, dart shooters, moa eggs, pendants, healing stones. Reward: a Valkyrie piece guaranteed, 2–3 treasure draws (Valkyrie gear, lightning and holy swords, invisibility cloak, regeneration stone), 6–10 more (gravitite gear, Valkyrie gear, Valkyrie cape, C: cape on, golden feather off) | random_spread 36/24, shared with gold, 3 in 4 picks |
| `aether:gold_dungeon` | `…/gold/gold_dungeon_reward` only | 2–5 Phoenix pieces or life shards, 5–8 of vampire blade, pig slayer, iron bubble, gravitite gear, enchanted gravitite, life shards, ice ring/pendant; 4–20 gummy swets, healing stones, berries | the same set, 1 in 4 picks: the rarest |
| `aether:large_aercloud` | none | | 6/3 |
| Overworld: Aether ruined portals | `aether:chests/ruined_portal` | glowstone dust, iron gear, enchanted berries, book of lore | **Not generating**: the `builtin/aether_ruined_portal` pack is disabled on the test world (C) |

### Deeper and Darker

| Structure | Chest tables (chests per piece, R: structure NBT) | Contents (R) | Placement (R) |
|---|---|---|---|
| `deeperdarker:ancient_temple` (jigsaw, size 7, 18–28 above the bottom) | `deeperdarker:chests/ancient_temple_apex` (2, in 2 of 5 upper variants); `…_secret` (1, in 1 of 8 aisle variants); `…_basement` (3–4, in staircases 3–5); `…_storage` (2–4, in 4 of 8 basement rooms); `…_fountain` (1, in most upper corners and rooms) | Apex: 5–6 draws of echo shards, sculk, diamonds (4–8), emeralds, TNT, amber, sculk catalysts and sensors; rarely enchanted diamond armour, an enchanted golden apple, warden carapace. Secret: echo shards, diamonds, a warden upgrade template, and **always a sculk transmitter**. Basement: soul dust, echo shards, gold, diamonds, name tags, enchanted golden apples (weight 3), the Otherside disc, warden carapace, plus 2 draws of enchanted iron/diamond gear. Fountain: ingots, diamonds, a treasure-enchanted diamond sword, soul crystals. Storage: stone, logs, raw ores. 4–7 stacks each (I: simulated) | random_spread 28/8; **Deeplands biome only** (one of four Otherside biomes) |
| Overworld: ancient cities (vanilla) | `minecraft:chests/ancient_city` | Deeper and Darker adds a warden upgrade template (45%) and warden carapace (20%) (R) | vanilla |

Not chests: crystallized amber blocks (`deeperdarker:chests/crystallized_amber`, one item inside) and the vases
(`deeperdarker:blocks/ancient_vase`: diamonds, golden and enchanted golden apples, carapace; 1–2 draws).

### Blue Skies

| Structure | Dimension, biome | Chest tables (`blue_skies:chests/…`) | Contents (R) | Placement (R) |
|---|---|---|---|---|
| `everbright_blinding_dungeon` | Everbright: calming skies, brisk meadow, brightlands, snow-covered pines | `blinding_dungeon/library_chest`, `library_chest_key`, `prison_chest_everbright`, `study_chest` | Library: paper, books, 0–2 enchanted books. Key chests: a blinding key each. Prison: bread, fruit, a worn aquite axe. Study: books, gems, aquite, diopside, a disc | grid 45, 75%, 10 chunks from nature dungeons |
| `everdawn_blinding_dungeon` | Everdawn: shaded woodlands, crystal dunes, sunset maple, crescent orchard, crystal roughs, searing grassland | the same, with `prison_chest_everdawn` | as above | grid 45, 75%, 10 chunks from poison dungeons |
| `nature_dungeon` | Everbright, snow-covered pines | `nature_dungeon/chest`, `chest_key` | saplings, nature stone, brewberries; 40%: pyrope, aquite; 10%: diopside, aquite axe, starlit spear, books; 5%: enchanted spear, saddle, charoite | grid 63, 80% |
| `poison_dungeon` | Everdawn, sunset maple forest | `poison_dungeon/chest`, `chest_key` | string, moonstone, poison stone; 40%: spider eyes, webbing, gems; 10%: horizonite ingot, moonstone shield; 5%: aquite sword, camel saddle, charoite | grid 63, 80% |
| `frozen_bunker` | Everbright, slushlands | `bunker/common`, `bunker/rare` | Rare: falsite ingot, aquite, **pyrope chestplate**, books | grid 25, 70% |
| `village_*` (6) | three per dimension | `village/<biome>`, `village/profession/<everbright|everdawn>/<job>` | emeralds, books, pyrope, food; smiths: aquite gear, falsite, horizonite, diopside | grid 28, 75%, 7 chunks from dungeons |
| cave spawners (a feature) | both | `cave_spawner/chest_everbright`, `chest_everdawn` | ventium/horizonite ingot, aquite, worn pyrope pickaxe, books, name tag, saddle | 1 try per 4 chunks, y 0–49 |
| Overworld: `gatekeeper_house_*` | mountains; plains/savanna; snowy/taiga | `gatekeeper_house/mountain`, `plains`, `snowy`, `book` | food, wool, logs; the "book" chest: a book, paper, maps, moonstone shards, emeralds | grid 33, 75% |

Gatekeeper houses only appear in Overworld chunks generated since the mods were added on 22 November (I). Deeper and
Darker's ancient-city additions reach any ancient city chest not yet opened, old ones included, since loot modifiers act
when a chest is rolled (I). The three dimensions are entirely new.

### Which suit Deep Records books, and which a hoard

| Site | Deep Records | Hoard (bonus stacks) | Why |
|---|---|---|---|
| Otherside temples: `ancient_temple_apex`, `ancient_temple_secret` | **50%**, books 1–5 | **Yes** (5–6 stacks in 27 slots) | The books' own lore: "the old records are kept below, in the deep cities… the Warden will hear them" (#2), and the Surveyor names "the deep cities, where the Warden listens" (#9). Reaching it takes a Warden kill |
| Otherside temples: `…_basement`, `…_storage`, `…_fountain` | 15–20% | small | Many chests per temple |
| Aether Treasure Chests (`…_dungeon_reward`) | **50%**, books 1–5 | **Yes**, into empty slots after opening (bronze small, silver medium, gold large) | Boss vaults, like Twilight's "key rooms"; the gold one is often full already |
| Aether dungeon chests (`bronze_dungeon`, `silver_dungeon`) | 10–15% | no | Very common (bronze) |
| Blue Skies blinding-dungeon libraries (`library_chest`, `library_chest_key`) | **50%** | no | Literally libraries |
| Blue Skies `study_chest`, nature/poison `chest`, `chest_key` | 20–30% | small | Dungeon crawl rewards |
| Blue Skies cave spawners, villages, bunkers | 10% | no | Like vanilla monster rooms and villages |
| Gatekeeper house `book` chest (Overworld) | 15% | no | A "book" chest, but only in new chunks |

## 4. Sealed items in this loot

Every item these three mods' chest, entity and bag tables can hand out (356, nested tables expanded, plus the dungeon
keys, the Heart of the Deep and the Aether's gloves) checked with `BP.tierOf` (R: repo, through `load_scripts.js`):

| Item | Tier | Where | Held after looting? |
|---|---|---|---|
| `aether:gravitite_helmet`, `_chestplate`, `_leggings`, `_boots`, `_gloves` | 4 | silver and gold rewards (and `silver_dungeon_gravitite`) | **Yes**, `WEAR_LOCKS` |
| `aether:gravitite_sword`, `_axe`, `_pickaxe` | 4 | silver and gold rewards | **Yes**, `WIELD_LOCKS` |
| `aether:enchanted_gravitite` | 4 | gold reward | Crafting lock only. A material: what it makes is sealed by its own tier, so no lock needed |
| `aether:zanite_sword` | 5 | bronze and silver dungeon chests | **Yes**, `WIELD_LOCKS` |
| `aether:netherite_gloves` | 5 | added by the Aether's `gloves_loot_netherite` to any table that rolls netherite armour (none in these mods) | **Yes**, `WEAR_LOCKS` |
| `deeperdarker:warden_upgrade_smithing_template` | 7 | temple secret chest; 45% of ancient city chests | Crafting lock only. An ingredient: warden gear's recipes are sealed by item, so nothing to hold |

Nothing else is sealed: Phoenix, Valkyrie and Neptune gear, life shards, the sculk transmitter and enchanted golden
apples are loot-only and open by owner decision (`AETHER_DEEPERDARKER.md`). **Blue Skies isn't in `TIERS` yet**, so all
its items read 0. Gear in its loot that a Blue Skies tier would need to hold with `WEAR_LOCKS`/`WIELD_LOCKS` (as loot,
not crafting): `pyrope_chestplate` (bunker), `pyrope_pickaxe` (cave spawners), `aquite_*` tools and armour (prisons,
dungeons, village smiths), `starlit_spear`, `moonstone_shield`, and the bag items `soulbound_spear`, `spike_shield`,
`crushing_hammer`, `different_sword` and the four arcs (Curios accessories, which re-summon bosses).

## 5. Ideas for the Blood Pool

1. **Boss Blood, second table**: the eight dimension bosses and the three vanilla ones (section 1b), in their own list so
   Twilight's ranks and test stay as they are. Guard Blue Skies with `BossRespawned`, `DungeonSpawned` and once per
   `BossHomePos`; the Warden once per player; the Dragon's first kill as a milestone.
2. **Story beats from the mods' own moments**: the first Warden kill (the Deep Records call it the Office's "Head of
   Records Security"); the first Heart of the Deep (the Otherside opens); the Sun Spirit's death, which ends the
   Aether's eternal day (a Blood God line about the sun going out).
3. **Treasure Chest hoards** (Aether), Dragon Hoard style: keyed by `Kind`, filled into empty slots after opening,
   skipping sealed items (`isLocked`), with potato crates for the Potato War, as Twilight's chests have.
4. **Blue Skies rewards through the death hook**, not the bag tables: crates or spoils to the fighters of a key-summoned
   boss only, so the 3-minute arc loop can't farm them.
5. **Deep Records sites** (section 3): Otherside temples above all, then Aether Treasure Chests and Blue Skies libraries.
   The Otherside could even hold a record of its own (the "deep cities" archive the books keep pointing to).
6. **Never add as spoils** (as Twilight's `KEY_ITEMS`): Aether dungeon keys and Victory Medals (they open fights), Blue
   Skies keys and arcs (they summon bosses), the Heart of the Deep (it lights the Otherside portal).
7. **Souls and Grit**: add the new bosses to the Anamian Axe's `BOSS_SOULS` and the Deepdelver Maul's `BOSS_GRIT`, which
   list only Twilight, Ice and Fire, the Wither and the Dragon.

## 6. What couldn't be determined

- **In game:** nothing was tested in game. That each boss's death reaches `EntityEvents.death` is inferred from the
  bytecode (each calls `super.die()`); the Treasure Chest timing with the right-click method, the Blue Skies bag-table
  modify through `genericLootTables`, and the 15-block bag radius are untested.
- **Some attack numbers:** the Summoner's sphere, the Alchemist's potions and fire arrows, the Crusher's roots and spin,
  the Arachnarch's venom, the Valkyrie Queen's lunge, and the Warden's sonic boom as dealt (only the class constants
  were read). The Aether's tool debuff against its bosses is taken from `AETHER_DEEPERDARKER.md`, not re-read.
- **How common structures really are:** spacing is read, but how often a cell's biome or terrain allows one (the Aether's
  bronze dungeon search, the single-biome Blue Skies and Otherside dungeons) wasn't measured.
- **Overflow figures** are a simulation of the loot JSON (20,000 rolls, each draw one stack), not observed chests.
- **Live server:** configs, difficulty and data packs are the test server's. A different difficulty changes Blue Skies
  bag rarity and every mob's damage.
- **Loot Integrations** builds its pools at runtime; whether it pulls these mods' items into vanilla chests (flagged in
  `AETHER_DEEPERDARKER.md`) wasn't checked.
- **Blue Skies key trades:** which villager sells keys, and for what, wasn't read.
