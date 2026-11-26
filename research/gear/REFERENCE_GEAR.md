# Reference gear ladder: vanilla, adventure and magic mods

Read-only balance check of the wearable and wieldable gear of vanilla, Twilight Forest, Botania, Ice and Fire, Alex's
Caves, Alex's Mobs (its sealed items), Ars Nouveau, EvilCraft, Reliquary, Hexerei, Immersive Engineering and Create,
against the Blood Pool tiers in `tools/kubejs/server_scripts/part2/blood_pool.js`. The Aether, Deeper and Darker and Blue
Skies are in `DIMENSION_GEAR.md` and the tech mods in `TECH_GEAR.md`.

The data is in `reference_gear.tsv` (479 rows, one per item, beside this file). This file has the set totals, the
abilities, the items that are sealed but usable anyway, the discrepancies with the earlier research and what couldn't be
read.

## How the numbers were read

- **R (read):** class files read with `javap -p -c`, data files read from the jars. Vanilla: the srg-named server jar
  in the test server's libraries (`server-1.20.1-20230612.114412-srg.jar`), names resolved through the two mapping files.
  Mod versions: twilightforest 4.3.2508, Botania 1.20.1-456, iceandfire 2.1.13-beta-5, alexscaves 2.0.2, alexsmobs
  1.22.9, ars_nouveau 4.12.7, EvilCraft 1.3.3, reliquary 2.0.65, hexerei 0.4.2.3, ImmersiveEngineering 10.2.0-183,
  create 6.0.8.
- **C (config):** Ice and Fire from the repo's shipped `tools/serverconfig/iceandfire-common.toml` `[Items]` (the same
  values as the test server's): Dragonsteel Sword Base Attack Strength 25.0, Base Armor 12, Base Armor Toughness 6.0,
  Base Durability 8000, Base Durability Equipment 8000, Dragon Bone Fire/Ice/Lightning Abilities true, Trolls Drop
  Weapon true. Ars Nouveau glyph damage from the test server's `config/ars_nouveau/glyph_*.toml`; EvilCraft and
  Reliquary from the test server's `config/evilcraft-common.toml` and `config/reliquary-common.toml` (none of these
  three are in `tools/serverconfig/`, so the live server may differ). Twilight Forest's shipped config only sets the
  Uncrafting Table off and two core ranges; the rest is default.
- **I (inferred):** marked in the row. Mostly ability details whose code wasn't followed to the end.
- **Weapon numbers** are the tooltip values: damage = 1 + item modifier + tier bonus, speed = 4 + modifier.
  **Per-second damage** below is damage x min(speed, 2): the vanilla hurt cooldown (`LivingEntity.hurt`, R) lets a
  target take a full hit only every 10 ticks; a faster second hit deals only its excess over the first.
- **tier** is `tierOf(id, null)` from the repo's own `tools/ftbquests/load_scripts.js`. **Effective tier** (in the
  `evidence` column) is the highest tier among the ingredients of the cheapest recipe in `research/index`, walked
  recursively (I). Forge's own tag data isn't in the index, so vanilla members of common forge tags were added by hand.
- **Locks** were parsed from the current `blood_pool.js` (`USE_LOCKS`, `WEAR_LOCKS`, `WIELD_LOCKS`). None of the
  items in this scope are in `WEAR_LOCKS` or `WIELD_LOCKS`; 17 are in `USE_LOCKS`.

## Full-set totals per family

Armour / toughness / knockback resistance for the whole set, total durability, and tier (tierOf; effective tier in
brackets where it is higher). Vanilla caps armour at 30 and toughness at 20 (`Attributes`, R).

| Family | Pieces | Armour | Tough. | KB res. | Durability | Tier | Set or piece abilities |
|---|---|---|---|---|---|---|---|
| Leather | 4 | 7 | 0 | 0 | 275 | 0 | |
| Gold | 4 | 11 | 0 | 0 | 385 | 0 | piglins neutral |
| Chainmail | 4 | 12 | 0 | 0 | 825 | 0 | |
| Iron | 4 | 15 | 0 | 0 | 825 | 0 | |
| Diamond | 4 | 20 | 8 | 0 | 1815 | 0 | |
| Netherite | 4 | 20 | 12 | 0.4 | 2035 | 5 | doesn't burn |
| Turtle helmet | 1 | 2 | 0 | 0 | 275 | 0 | Water Breathing 10 s out of water |
| TF naga (chest, legs) | 2 | 13 | 1 | 0 | 651 | 0 | crafted with Fire Prot III / Prot III |
| TF ironwood | 4 | 16 | 0 | 0 | 1100 | 0 | crafted enchanted (Aqua Affinity, Prot I x2, Feather Falling I) |
| TF phantom (helm, chest; loot) | 2 | 11 | 5 | 0 | 810 | 0 | never lost on death |
| TF steeleaf | 4 | 20 | 0 | 0 | 550 | 4 | crafted with Prot II, Blast Prot II, Fire Prot II, Feather Falling II |
| TF knightmetal | 4 | 20 | 4 | 0 | 1100 | 5 | |
| TF fiery | 4 | 24 | 6 | 0 | 1375 | 6 | melee attackers set alight: 80% chance, 10 s with the full set |
| TF yeti | 4 | 20 | 12 | 0 | 1100 | 6 | melee attackers get Frosty (amplifier 4, 25 ticks with the full set); crafted Prot II (boots also Feather Falling IV) |
| TF arctic (loot too) | 4 | 16 | 8 | 0 | 550 | 7 | dyeable, powder-snow walking |
| Hexerei witch (3) / druid (4) | 3 / 4 | 14 / 19 | 3 / 4 | 0 | 1000 / 1375 | 0 | witch-armour damage handler (not interpreted) |
| Ars sorcerer | 4 | 11 | 0 | 0 | 1375 | 2 | +30 max mana a piece, mana regen, perk slots |
| Ars arcanist | 4 | 15 | 0 | 0 | 1375 | 2 | as sorcerer |
| Ars battlemage | 4 | 20 | 8 | 0 | 1815 | 2 | as sorcerer |
| Botania manasteel | 4 | 15 | 0 | 0 | 880 | 2 | mana repair; 10% mana discount |
| Botania manaweave | 4 | 7 | 0 | 0 | 275 | 2 | 40% mana discount |
| Botania elementium | 4 | 15 | 0 | 0 | 990 | 2 (6) | 52% pixie chance when hurt (11/17/15/9%) |
| Botania terrasteel | 4 | 20 | 12 | **1.0** | 1870 | 2 (6) | knockback immune; 20% mana discount; regen without full hunger; Ancient Wills |
| IE steel | 4 | 17 | 4 | 0 | 1155 | 3 | |
| IE faraday | 4 | 7 | 0 | 0 | 55 | 3 | shock protection |
| Create copper backtank + diving helmet + boots | 3 | 7 | 0 | 0 | 280 | 1 | breathing from backtank air; sea-floor walking |
| Create netherite backtank + diving helmet + boots | 3 | 14 | 9 | 0.3 | 1480 | 5 | **with any netherite leggings: full fire and lava immunity** |
| IaF copper metal (loot) | 4 | 10 | 0 | 0 | 550 | 6 | |
| IaF silver metal (loot) | 4 | 12 | 0 | 0 | 825 | 6 | |
| IaF deathworm | 4 | 17 | 6 | 0 | 825 | 6 | |
| IaF troll leather | 4 | 17 | 4 | 0 | 1100 | 6 | projectile damage x0.3 |
| IaF myrmex | 4 | 20 | 0 | 0 | 1100 | 6 | |
| IaF sea serpent (tide) | 4 | 23 | 10 | 0 | 1650 | 6 | Water Breathing; in water or rain **Strength IV (+12 melee)** |
| IaF dragon scale (12 colours) | 4 | 26 | 8 | 0 | 1980 | 6 | dragon breath x0.3 |
| IaF dragonsteel (3 elements) | 4 | 34 (capped 30) | 24 (capped 20) | 0 | 8800 | 6 (9) | dragon breath x0.3 |
| AC primordial (3) | 3 | 9 | 0 | 0 | 840 | 6 | extra food saturation |
| AC hazmat | 4 | 13 | 2 | 0 | 1100 | 6 | radiation protection |
| AC diving suit (loot) | 4 | 15 | 0 | 0 | 1100 | 6 | +0.5 swim speed |
| AC gingerbread | 4 | 13 | 0 | 0 | 550 | 6 | |
| AC hood + cloak of darkness | 2 | 2 | 1 | 0 | 405 | 6 | **cloak: charged in darkness, keybind gives Darkness Incarnate: creative flight** |
| AC rainbounce boots | 1 | 2 | 0 | 0 | 78 | 6 | bounce on landing |
| AM tarantula hawk elytra | 1 | 3 | 0 | 0 | 800 | 8 (9: needs an elytra) | elytra flight |
| Vanilla elytra | 1 | 0 | 0 | 0 | 432 | 0 (End: 9) | elytra flight |

## Weapons, by tier

| Tier | Weapon | Damage | Speed | Per second | Durability | Ability |
|---|---|---|---|---|---|---|
| 0 | diamond sword / axe | 7 / 9 | 1.6 / 1.0 | 11.2 / 9 | 1561 | |
| 0 | trident | 9 (thrown 8) | 1.1 | 9.9 | 250 | |
| 0 | bow / crossbow | 6 / 7 a shot | | | 384 / 465 | |
| 0 | TF ironwood sword | 6 | 1.6 | 9.6 | 512 | crafted Knockback I |
| 0 | TF ice sword (loot) | 7.5 | 1.6 | 12 | 32 | Frosty 10 s |
| 0 | TF diamond minotaur axe (boss drop) | 10 | 1.0 | 10 | 1561 | **+7 while sprinting (17)** |
| 0 | TF glass sword (Aurora Palace loot) | **40** | 1.6 | one hit | 1 | breaks after one hit |
| 0 | TF triple bow (Snow Queen) | 3 x 6 a shot | | | 384 | target's hurt cooldown reset: all three land |
| 0 | TF seeker / ice / ender bow | 3 / 6 / 6 | | | 384 | homing / Frosty / swap places |
| 1 | Create potato cannon | potato 5, golden carrot 12, blaze cake 15 | 15-20 tick reload | | 100 | effective tier 4 |
| 2 | Ars enchanter's sword | **8** | 1.6 | 12.8 | **2031** | netherite tier, from a diamond sword; casts its spell on hit |
| 2 | Ars spell books | Harm 5 (9 amplified), Fangs 6 (12), Flare 7 (13), Explosion 6 (11, area) | | | | Glide 180 s, Blink 8 (+3) |
| 2 | Botania manasteel / elementium sword | 6 | 1.6 | 9.6 | 300 / 720 | |
| 2 | Botania soulscribe | 6 | 2.75 | 12 | 69 | +20 to endermen |
| 2 | EvilCraft spikey claws / vein sword | 6 / 4 | 1.6 | 9.6 / 6.4 | 256 / 32 | |
| 3 | IE steel sword / axe | 7 / 9.5 | 1.6 / 0.9 | 11.2 / 8.6 | 641 | |
| 4 | TF steeleaf sword / axe | 7 / 10 | 1.6 / 1.0 | 11.2 / 10 | 131 | crafted Looting II / Efficiency II |
| 5 | netherite sword / axe | 8 / 10 | 1.6 / 1.0 | 12.8 / 10 | 2031 | |
| 5 | TF knightmetal sword / axe | 7 / 10 | 1.6 / 1.0 | 11.2 / 10 | 512 | +2 vs armoured / +2 vs unarmoured |
| 5 | TF block and chain | 10 thrown | | | 99 | breaks blocks, disables shields |
| 6 | TF fiery sword | 8 | 1.6 | 12.8 | 1024 | target alight 15 s |
| 6 | IaF dragonbone sword / axe | 8 / 10 | 1.6 / 1.0 | 12.8 / 10 | 1660 | |
| 6 | IaF fire / ice / lightning dragonbone sword | 9.5 | 1.6 | 15.2 | 2000 | fire 5 s / freeze + Slowness III / lightning; +13.5 or +9.5 vs dragons |
| 6 | IaF tide trident | 13 (thrown 12) | 1.1 | 14.3 | 400 | |
| 6 | IaF troll weapons (7; drops) | **17** | 0.5 | 8.5 | 300 | swing lands only at 95% charge |
| 6 | IaF dread knight sword (IDAS loot) | **17** | 1.6 | **27.2** | 1200 | |
| 6 | IaF ghost sword | **11** | **3.0** | **22** | 3000 | each swing also fires a 5-damage spectral sword |
| 6 | IaF stymphalian dagger | 6 | 3.0 | 12 | 500 | |
| 6 | IaF hippogryph sword | 6.5 | 1.6 | 10.4 | 500 | sweeps every mob within 3 blocks |
| 6 | IaF dragonbone arrow | **30 a shot** from any bow | | | | base damage 10; triple bow: 3 x 30 |
| 6 | IaF gorgon head (gorgon drop) | **kills** | | | consumed | first entity looked at within 32 blocks: player takes 2.1e9 damage, mob turned to stone |
| 6 | Reliquary mercy cross | 7 (13 vs undead) | 1.6 | 11.2 | 64 | |
| 6 | AC primitive club | 9 | 0.25 | 2.25 | | Stunned on hit |
| 7 | TF twilight / lifedrain scepter (Lich) | 6 a bolt / 1 per 5 ticks | | | 99 | lifedrain heals, finishes targets at 1 HP |
| 7 | TF fortification scepter (Lich) | | | | 9 | **5 shields, each cancels a whole attack**; 60 s cooldown |
| 8 | TF giant sword | 12 | 0.5 | 6 | 1024 | +2.5 block and entity reach |
| 9 | Botania terra blade | 8 + 8 beam | 1.6 | 12.8 | 2300 | beam hits up to 3 in a line, 100 mana a swing |
| 9 (eff.) | Botania thundercaller / starcaller | 8 | 2.5 / 1.6 | 16 / 12.8 | 2300 | chain lightning 5+4+3+2 / falling stars 5 (25%: 10) |
| 9 | AC extinction spear | 9 | 1.0 | 9 | | thrown; dinosaur spirits (damage not read) |
| 6 (eff. 9) | IaF dragonsteel sword / axe | **25 / 30** | 1.6 / 1.0 | **40 / 30** | 8000 | fire 15 s / freeze + Slowness III 15 s / lightning bolt |

## Abilities, by mod (triggers in the TSV)

- **Twilight Forest.** Crafted ironwood, steeleaf, naga and yeti gear comes enchanted (recipe result NBT). Knightmetal
  sword and pickaxe +2 against armoured targets, axe +2 against unarmoured (`ToolEvents`). Fiery armour burns melee
  attackers (5 per piece: n/25 chance, n/2 seconds); fiery sword and pickaxe set targets alight 15 s, the pickaxe
  smelts drops. Yeti armour chills attackers. Minotaur axes +7 when the wielder is sprinting. Giant sword and pickaxe
  +2.5 reach. Triple bow: three arrows, the target's hurt cooldown is reset so all land. Ender bow swaps places.
  Scepters: twilight bolt 6; lifedrain beam; zombie; fortification (5 temporary shields, each cancelling a whole
  attack). Block and chain: 10 thrown, breaks blocks, disables shields. Charms (inventory or Curios): life I (8 HP +
  Regen I 5 s), life II (full HP, Regen IV, Resistance, Fire Resistance 30 s), keeping I/II/III (armour and offhand /
  plus hotbar / everything). Phantom armour is never lost on death. The glass sword (40) breaks after one hit.
- **Botania.** Terrasteel armour gives knockback resistance = armour / 20 per piece (1.0 for the set). Flügel tiara:
  creative flight with a flight bar (1200; the lexicon says about 30 s of continuous use), recharged on the ground,
  sprint dash. Cloaks (10 s recharge each): Virtue cancels one hit, Sin reflects the hit's damage onto every hostile mob
  within 6 blocks, Balance halves a hit and reflects the half. Tectonic girdle: knockback +1.0. Ring of far reach +3.5
  reach. Cirrus / Nimbus amulets: double / triple jump. Sashes: speed and fall buffer. Crimson pendant: all fire damage
  cancelled. Ring of Odin: +20 max health and immunity to the Odin damage types; relics are soulbound (anyone else
  holding one takes 2 damage every 10 ticks).
- **Ice and Fire.** Dragon scale and dragonsteel sets cut dragon breath to x0.3; troll leather cuts projectiles to x0.3.
  Sea serpent armour: Water Breathing, and in water or rain Strength (pieces - 1), Strength IV with the set. Silver
  weapons hit undead again for (stat + 3) as magic; myrmex weapons hit non-arthropods again for (stat + 5): with the
  hurt cooldown only the excess over the first hit lands (I). Dragonsteel and the elemental dragonbone swords: fire,
  freezing or lightning on hit (config on). Gorgon head petrifies. Ghost sword fires a spectral sword each swing.
- **Alex's Caves.** Cloak of darkness: flight (Darkness Incarnate) after charging in darkness. Primitive club stuns.
  Raygun, dreadbow, galena gauntlet and totem of possession are use-locked.
- **Create.** The full netherite diving set (helmet, backtank, any netherite leggings, boots) makes its wearer fire
  immune (`NetheriteDivingHandler.setFireImmune`).
- **Ars Nouveau.** Spell damage is per glyph, from config (above); Glide is 180 s of elytra flight from a spell.
- **Reliquary.** Phoenix down and angelheart vial prevent a death (100% / 25% heal); angelic feather cancels fall
  damage; salamander eye puts the holder out and stops fireballs; rod of Lyssa steals items from players
  (`stealFromPlayers = true`).
- **Hexerei.** Willow, witch hazel and mahogany brooms: right-click spawns a rideable flying broom.

## Sealed items with abilities that no lock holds

Every lock in this scope except `USE_LOCKS` is crafting only, and none of these items is in `WEAR_LOCKS` or
`WIELD_LOCKS`. Two ways they arrive early:

**1. Looted or dropped before their tier (no Part I needed).**

| Item | Tier | How it's got | Ability that matters |
|---|---|---|---|
| `iceandfire:gorgon_head` | 6 | gorgon drop | one-shot kill of a player or mob in sight within 32 blocks (consumed) |
| `twilightforest:fortification_scepter` | 7 | Lich drop | 5 whole attacks cancelled; 60 s cooldown; 9 charges |
| `twilightforest:lifedrain_scepter`, `twilight_scepter`, `zombie_scepter` | 7 | Lich drop | life drain that finishes targets at 1 HP; 6-damage bolts; summoned zombie |
| `iceandfire:troll_weapon_*` (7) | 6 | troll drop (config: Trolls Drop Weapon = true) | 17 a hit |
| `iceandfire:dread_knight_sword` | 6 | IDAS dread citadel chests | 17 a hit at sword speed (27 a second) |
| `twilightforest:giant_sword`, `giant_pickaxe` | 8 | armored giant / giant miner drops | +2.5 reach |
| `twilightforest:knightmetal_sword`, `_axe`, `_pickaxe`, `_chestplate` | 5 | Knight Phantom chest, Aurora Palace | knightmetal bonus damage |
| `twilightforest:arctic_*` | 7 | Aurora Palace | 16 / 8 (no ability) |
| `alexscaves:desolate_dagger`, `ortholance`, `sea_staff`, `sugar_staff` | 6 | underzealot drop, Deep One barter, licowitch drop | spectral daggers, water waves, homing water bolts (damage not read) |
| `iceandfire:silver_*`, `copper_*` metal armour and swords | 6 | dragon roosts and caves, graveyards | iron level or below: harmless |

**2. Crafted, so only Part I carry-overs (or another route) get them early.** Nothing stops a copy from working:

| Item | Tier | Ability that matters |
|---|---|---|
| `hexerei:willow_broom`, `witch_hazel_broom` / `mahogany_broom` | 6 / 8 | flight (EvilCraft's broom is in `USE_LOCKS`; these are not) |
| `alexscaves:cloak_of_darkness` | 6 | flight |
| `botania:flight_tiara` | 9 | flight |
| `alexsmobs:tarantula_hawk_elytra` | 8 | elytra flight |
| `create:netherite_backtank`, `netherite_diving_helmet`, `netherite_diving_boots` | 5 | fire and lava immunity (set) |
| `iceandfire:tide_*` armour | 6 | Strength IV in rain or water |
| `iceandfire:dragonsteel_*` (27 items) | 6 (crafting 9) | 25 / 30 damage, 34 armour |
| `iceandfire:dragonbone_arrow` | 6 | 30 a shot |
| `iceandfire:ghost_sword` | 6 | 22 a second plus projectiles |
| `botania:holy_cloak`, `unholy_cloak`, `balance_cloak` | 2 (Gaia spirit: 9) | a hit cancelled or reflected every 10 s |
| `botania:terra_sword`, `thunder_sword`, `star_sword` | 9 / 2 (eff. 9) | beam, chain lightning, falling stars |
| `reliquary:phoenix_down`, `angelheart_vial` | 6 | death prevention |
| `twilightforest:fiery_*`, `yeti_*` | 6 | burning / chilling attackers |

**A trap for adding locks.** `WEAR_LOCKS` and `WIELD_LOCKS` release an item at its own `tierOf`, which for a mod sealed
as a namespace is the namespace's tier. Ice and Fire's dragonsteel gear is Tier 6 by namespace (only its ingots are 9),
Botania's terrasteel armour, elementium gear, cloaks and thundercaller/starcaller are Tier 2 by namespace (their
ingredients are 6 or 9). A lock on those ids would open at 6 or 2. To hold them to their real tier, list the gear
itself under that tier's `items` as well (crafting is already held by the ingots, so nothing else changes).

## Placement observations (for the owner's call)

- **Twilight's giant sword and pickaxe (Tier 8)** do 6 a second (12 at 0.5): below a Tier 0 diamond sword. Their only
  edge is +2.5 reach. Their numbers fit Tier 4-5.
- **Twilight's arctic armour (Tier 7)** is 16 / 8 with no ability, below yeti (20 / 12, Tier 6) and fiery (24 / 6,
  Tier 6). It fits Tier 5-6; it is also Aurora Palace loot.
- **Ars Nouveau's enchanter's sword (Tier 2)** has netherite's numbers (8 damage, 2031 uses, harvest level 4) and is
  made from a diamond sword; the netherite sword is Tier 5.
- **Ice and Fire's ghost sword (Tier 6)**: 11 at 3.0 (22 a second, hurt-cooldown capped) plus a 5-damage projectile
  each swing, against netherite's 12.8. Closer to Tier 8.
- **Ice and Fire's sea serpent armour (Tier 6)**: 23 / 10 plus Strength IV (+12 a hit) in rain or water. The strongest
  damage boost in this scope below Tier 9.
- **Botania's tectonic girdle (Tier 2)** makes its wearer knockback immune; terrasteel (6) does the same as a set;
  netherite gives 0.4.
- **Botania's terra blade (Tier 9)** is 8 plus an 8-damage beam, about netherite with a ranged swing, while Tier 9's
  dragonsteel sword is 25. Its numbers fit Tier 6 with terrasteel (thundercaller and starcaller follow it, as they
  need one).
- **Twilight's diamond minotaur axe (Tier 0, boss drop)** hits 17 while sprinting and the **glass sword** 40 once; both
  matter for own-gear Purge and Gladiator matches more than for progression.
- In tier order the armour ladder is otherwise consistent: diamond-class 20 / 8 at 0-4, netherite and knightmetal at
  5, fiery, yeti, dragon scale and tide (23-26 / 6-12) at 6, dragonsteel (capped 30 / 20) at 9.

## Discrepancies with the earlier research

1. `research/AETHER_DEEPERDARKER.md` (section "What doesn't fit", item 1): "flight at Tier 7 (Powersuits) and Tier 9
   (the flight tiara)". Flight items in this scope open earlier: EvilCraft's broom (Tier 2; use-locked for Part I
   copies), Ars Nouveau's Glide glyph (Tier 2, 180 s), Hexerei's willow and witch hazel brooms (Tier 6), Alex's Caves'
   cloak of darkness (Tier 6), Reliquary's rending gale (Tier 6, use-locked), Alex's Mobs' tarantula hawk elytra (Tier
   8). Ice and Fire's rideable dragons, hippogryphs and amphitheres aren't items and are open at Tier 0.
2. Same file, "Comparable" column: "terrasteel 20/12 (Tier 6)". Correct numbers, but the set also has knockback
   resistance 1.0, and the armour's own tier is 2 (Botania's namespace); 6 is its ingots'.
3. Same file: "dragonsteel sword 25 (effective Tier 9)". Correct (C: 25.0); its `tierOf` is 6. The axe is 30.
4. Same file: "13 damage beats netherite (8, Tier 5)" for the zanite sword. Netherite's 8 is right, but several things
   at or below Tier 6 already hit harder: the Tier 0 diamond minotaur axe (17 sprinting), Ice and Fire's troll weapons
   and dread knight sword (17), the fire/ice/lightning dragonbone swords (9.5) and the Tier 0 glass sword (40, once).
5. Same file: steeleaf "20/0 and 7", knightmetal "20/4 and 7", fiery "24/6 and 8", dragon scale "26/8": all confirmed.
6. `research/dimensions/BLUE_SKIES_GEAR.md`: netherite "20/12/0.4 and 8", axe 10, diamond sword 11.2 and axe 9 a
   second: confirmed.
7. `research/02_LADDERS.md` (Twilight Forest item list) and `research/TIER_PROPOSAL.md` (Tier 4-6 snippets) leave out
   every Twilight chestplate (ironwood, steeleaf, knightmetal, fiery, yeti, arctic) and the naga chestplate. The live
   `TIERS` has them, so only the documents are behind.

## What couldn't be determined

- Alex's Caves: extinction spear dinosaur-spirit damage, desolate dagger, ortholance wave, sea staff and sugar staff
  damage, Darkness Incarnate's duration, rainbounce fall handling, raygun/dreadbow/galena numbers (use-locked anyway).
- Botania: magic missile, flame ring and Gate of Babylon damage; the Ring of Odin's immune damage types; the tiara's
  exact mana cost; the Pyroclast pendant's effect; elementium tool abilities (marked I).
- Ice and Fire: the venom swords' extra effect (none found in the classes read); cockatrice scepter tick rate; siren
  flute effect; deathworm gauntlet damage.
- Immersive Engineering: steel and faraday armour slot order inferred from the durability pattern; faraday durability
  reads as 11-16 a piece; guns and drills not read.
- Hexerei: the witch and druid armour are assumed to use its only material (infused fabric); `WitchArmorEvent`'s
  numbers (1.25, 0.15) not interpreted.
- EvilCraft: vengeance pickaxe and mace numbers in detail; Reliquary: infernal claws and kraken shell mechanisms.
- Whether IDAS's dread citadel and archmage tower generate in this world, whether Loot Integrations copies these
  items into other chests, and how far Twilight Forest's progression lock delays the Aurora Palace and the giants.
- Better Combat is in the pack; these are attribute values and don't account for its swing patterns or reach.
- Whether any mod raises the vanilla armour (30) and toughness (20) caps: none found by name in the mod list.
- Ars Nouveau, EvilCraft and Reliquary configs came from the test server, not `tools/serverconfig/`; the live server
  may differ.
