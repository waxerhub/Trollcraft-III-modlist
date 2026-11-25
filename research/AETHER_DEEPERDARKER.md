# The Aether and Deeper and Darker against the Blood Pool (Part II)

Read-through of the two mods added on 2026-11-22, `aether-1.20.1-1.5.2-neoforge.jar` and
`deeperdarker-forge-1.20.1-1.3.3.jar`, against the Blood Pool's 12 tiers (`part2/blood_pool.js`). Built from the
jars' own data (745 recipes, 340 loot tables, their tags and structures), indexed with `research/tools/Indexer.java`
and checked with the Blood Pool's own `tierOf` (loaded through `tools/ftbquests/load_scripts.js`).

**Decided and built (owner, 22 November 2026):** the tiers in "Re-evaluated tiers" below are in `blood_pool.js`'s
`TIERS`, both dimensions stay open, and the sealed gear that can be looted or traded is held by the new wear and wield
locks (`WEAR_LOCKS`, `WIELD_LOCKS`; see `tools/kubejs/BLOOD_POOL.md`). The two sections that follow describe the mods
as they were before that.

## Where things stood before (nothing gated)

- **Both dimensions are open from day one.** `part2/dimension_gates.js` only knows the Nether and the End.
  - **The Aether** (`aether:the_aether`): a glowstone frame, lit with a water bucket. Glowstone comes mostly from
    the Nether (sealed until Tier 3), but also from cleric villagers, witches' glowstone dust, and the Aether's own
    ruined-portal chests (`aether:chests/ruined_portal` has glowstone dust).
  - **The Otherside** (`deeperdarker:otherside`): the reinforced-deepslate frame in an **ancient city**, lit with a
    **Heart of the Deep**, which every Warden drops. So it needs a Warden kill, nothing else.
- **Only 19 of the 745 recipes are held back**, all by netherite (sealed until Tier 5): Deeper and Darker's nine
  warden upgrades (`minecraft:netherite_* -> deeperdarker:warden_*`), the Aether's netherite gloves, and the Altar's
  netherite repairs. Everything else in both mods is craftable at Tier 0.
- **Their compat recipes are already covered:** Create crushing of the Otherside ores (`create:crushing/...`) and
  Mekanism sawing of echo wood and the Aether's Mekanism crushing/enriching recipes sit in the `create` and
  `mekanism` namespaces, which open at Tiers 1 and 4.

## The Aether's ladder

| Step | What | How | Strength |
|---|---|---|---|
| 1 | Skyroot and holystone tools | crafted | wood/stone |
| 2 | **Zanite** gear, the **Altar**, Freezer, Incubator, rings, pendants, gloves | crafted from zanite gemstones (ore) | about iron |
| 3 | **Gravitite** gear | ore enchanted at the Altar (`aether:enchanting`), then crafted | about diamond, plus gravity powers |
| Bronze dungeon (Slider) | Neptune armour, Valkyrie lance, phoenix bow, cloud staff, shield of repulsion | loot only | boss reward |
| Silver dungeon (Valkyrie Queen) | **Valkyrie gear** (the full set, gloves included, gives a jump-held lift of up to 52 ticks, 2.6 seconds, recharged on landing: not creative flight), invisibility cloak, regeneration stone, gravitite gear | loot only | boss reward |
| Gold dungeon (Sun Spirit) | **Phoenix armour** (fire immunity; turns into obsidian armour in water), **life shards** (+maximum health), enchanted gravitite | loot only | boss reward |

Also: the Aether adds **gloves to any vanilla loot that holds armour** of the same material (`aether:gloves_loot`),
netherite gloves included; and its "Debuff non-Aether tools" setting is on, so other mods' tools mine slowly there.

## Deeper and Darker's ladder

| Step | What | How | Strength |
|---|---|---|---|
| Overworld | Warden upgrade template (45% of ancient city chests), warden carapace (20%; 1-3 per Warden), Heart of the Deep (every Warden) | loot | keys |
| Otherside | Resonarium (ore), soul crystals, sculk bones, gloomslate and sculk-stone ores (iron to diamond) | mined/dropped there | |
| Otherside temples | **enchanted golden apples**, full diamond gear, echo shards, warden templates, the **sculk transmitter** (remote container access, loot only) | loot | strong |
| Resonarium gear | iron gear + resonarium plates (smithing) | crafted | above iron |
| **Sonorous staff** | heart of the deep + soul crystals + sculk bones | crafted | sonic-boom weapon |
| **Warden gear** | netherite gear + reinforced echo shard + template (smithing) | crafted | above netherite |
| **Soul elytra** | an elytra + Otherside materials | crafted | needs an elytra (the End, Tier 9) |

## What doesn't fit the tiers today

1. **Two open dimensions with diamond-to-netherite-plus rewards at Tier 0.** The Aether's gravitite gear (diamond)
   is craftable from day one, and its dungeons hand out a short flight boost (the Valkyrie set, 2.6 seconds at a time), fire immunity and permanent health.
   The Otherside hands out enchanted golden apples and full diamond sets. For comparison, the Blood Pool holds
   diamond-plus modded gear around Tiers 4-5 (steeleaf, cobalt, netherite) and flight at Tier 7 (Powersuits) and
   Tier 9 (the flight tiara).
2. **Warden gear only waits on netherite (Tier 5)**, though it is stronger than netherite. The comparable gear sits
   at Tier 8 (manyullyn, Mekanism tools).
3. **Netherite gloves** aren't on the Tier 5 netherite list (`aether:netherite_gloves`).
4. **Loot-only rewards can't be sealed by crafting locks** (the Blood Pool locks crafting, not use). Gating each
   dimension is what holds them back; otherwise they're boss rewards, as Twilight Forest's are. *Since built:* the
   tiered gear that's also loot (the zanite sword; gravitite gear) can't be worn or wielded before its tier.
5. **Loot Integrations** (`lootintegrations`, in the pack) mixes modded items into other structures' chests by
   value. With these two mods loaded, Aether and Otherside items could turn up in Overworld chests early. Not
   checked in game: open a few vanilla chests (desert temples, mineshafts) and look.

## The numbers (read from the jars' code, default configs)

Armour: total defense / toughness / knockback resistance for a full set. Weapons: sword damage (attack speed 1.6
unless noted). "Tier" is the Blood Pool tier the comparable item already sits at (effective tier: an item's own tier or
its ingredients', whichever is later).

| Gear | Armour | Weapon | Ability | Comparable, already tiered |
|---|---|---|---|---|
| Aether zanite | 15 / 0 / 0 (iron) | sword **6, rising to 13 as it wears** (9 at half worn, 11 at three-quarters); tools iron, slow when new and faster as they wear | none | iron, ironwood (Tier 0); 13 damage beats netherite (8, Tier 5) and matches refined obsidian (12, Tier 8) |
| Aether gravitite | 20 / 8 / 0 (diamond) | 7 (diamond); tools 1561 durability | set (with gloves): higher jump, no fall damage; sword knocks targets up; tools float blocks | diamond (Tier 0), steeleaf 20/0 and 7 (Tier 4), knightmetal 20/4 and 7 (Tier 5) |
| Aether Neptune (loot) | 15 / 4 / 0 | | faster swimming | iron (Tier 0) |
| Aether Valkyrie (loot) | 20 / 8 / 0 | lance 7, reach 6.5; tools +3.5 reach | set: 2.5 s lift recharged on landing, no fall damage | diamond (Tier 0) |
| Aether Phoenix (loot) → obsidian | 20 / 8 → 20 / 12 / 0 | phoenix bow: 20 s of fire | set: immune to fire and lava; turns into obsidian armour (netherite) after ~15 s wet | netherite (Tier 5) |
| Aether dungeon swords (loot) | | 7 each: 30 s of fire, lightning, +8.25 against undead, 1 HP per hit, +16 against pigs | | diamond (Tier 0), fiery 8 and fire (Tier 6) |
| Aether gloves | none | +0.25 (leather) to +1.0 (netherite, Valkyrie, Phoenix) damage | needed for set bonuses | |
| Aether life shards (loot) | | | +2 max health each, 10 at most (+20) | heart canisters (Tier 0) |
| Aether regeneration stone / invisibility cloak / shield of repulsion (loot) | | | 0.4 HP/s (stacks) / mobs can't target you / reflects projectiles while standing still | Reliquary's angelic feather and phoenix down (Tier 6) |
| Aether zanite ring and pendant | | | mining ×1.4 to ×1.73 each, multiplying | |
| Resonarium tools | | 7 (diamond); 1193 durability | mines anything (its tier isn't registered; nothing in this pack needs more than diamond) | diamond (Tier 0), steeleaf (Tier 4) |
| **Resonarium armour** | 18 / 4 / 0 | | **a full set cancels every armour-bypassing hit** (falls, poison, wither, magic, drowning, starving, the void, sonic booms), paid in durability | dragon scale 26/8 and terrasteel 20/12 with abilities (Tier 6) |
| **Warden gear** | **24 / 16 / 0.4**, leggings +50% walking speed, no blindness or darkness | 9; tools 2519 durability, level 5 | boots silence your vibrations | fiery 24/6 and 8 (Tier 6); osmium 21/12 and refined obsidian 31/20/0.8 and 12 (Tier 8) |
| **Sonorous staff** | | **up to 50 damage to everything along an 18-block beam, ignoring armour and Protection**; ×1.5 on Hard; 1 shot a second; 320 durability | a full resonarium set cancels it | dragonsteel sword 25 (effective Tier 9), refined obsidian 12 (Tier 8) |
| Soul elytra | 3 / 0 / 0 | | elytra with a rocket-like boost every 30 s; 956 durability | needs an elytra, from the End (Tier 9) |
| Sculk transmitter (loot) | | | opens one linked vanilla container from any distance in the same dimension | AE2 wireless terminals (Tier 6) |

**The Aether polices itself.** With its default `tools_debuff`, any non-Aether weapon's damage against Aether mobs is
cut to its 0.6th power (8 becomes 3.5, 20 becomes 6), non-Aether tools mine Aether blocks at bare-hand speed, and every
point of non-Aether armour adds 1/15 damage to each Aether mob's hit. So gear from other mods can't skip the
Aether's own ladder, and opening the dimension early doesn't hand anyone a shortcut.

## Re-evaluated tiers (cohesive with what's already tiered): built

| What | Tier | Why |
|---|---|---|
| The Aether and the Otherside (dimensions) | open | Twilight Forest's precedent; the Aether's tool debuff and the Warden fight are their gates |
| Skyroot, holystone, zanite armour and tools, rings, pendants, Altar, Freezer, Incubator | 0 | iron-equivalent, like ironwood |
| **Zanite sword** | **5** | reaches 11 to 13 damage as it wears, beyond netherite (8, Tier 5); cheap to make and wear down |
| Gravitite armour, tools and gloves, enchanted gravitite | 4 | diamond with modest set powers, like steeleaf (Tier 4) |
| Resonarium tools | 4 | diamond-equivalent, like steeleaf |
| **Resonarium armour** | **6** | its damage cancelling (falls, wither, poison, void) is a Tier 6 ability, like dragon scale and terrasteel |
| Aether netherite gloves | 5 | the netherite list |
| **Warden gear**, reinforced echo shard, template copying | **7** | between fiery (Tier 6) and refined obsidian (Tier 8) on every number |
| **Sonorous staff** | **9** | 50 armour-ignoring damage outclasses everything but dragonsteel (Tier 9) |
| Dungeon and temple loot, life shards, the sculk transmitter | not sealed | loot; heart canisters and totems are already Tier 0, Twilight's boss loot is unsealed |
| Soul elytra | no lock | needs an elytra from the End (Tier 9) |

**Looted or traded copies** of the sealed armour and gloves are taken off every second until their tier opens (armour
and Curios slots); sealed weapons and tools in the main hand deal no damage and break no blocks, and right-clicking
with them is refused. Creative players are exempt. `WEAR_LOCKS` and `WIELD_LOCKS` in `blood_pool.js`.

**For the Purge and the Gladiator Arena:** in "own gear" matches the sonorous staff ignores armour, and a resonarium
set cancels it. Worth keeping out of own-gear fights, or relying on the kits. (Still open: the owner's call.)

## Options as first laid out (before the stat review)

- **The Aether dimension:** with the Nether at **Tier 3** (glowstone is a Nether material); or **open from day
  one** with its gear tiered by item, as Twilight Forest is.
- **Gravitite gear and enchanting gravitite** (`aether:gravitite_*`, `aether:enchanted_gravitite`): **Tier 4**,
  with Twilight's steeleaf gear.
- **The Otherside dimension:** **Tier 6** (with Ice and Fire and Alex's Caves) or Tier 5 (with netherite).
- **Warden gear** (`deeperdarker:warden_*`, `deeperdarker:reinforced_echo_shard`): **Tier 8**, with manyullyn and
  Mekanism's tools. **Sonorous staff**: with the Otherside.
- **`aether:netherite_gloves`**: add to Tier 5's netherite list.
- **Implementation:** generalise `dimension_gates.js` from two dimensions to a list (`{ dim, tier }`), so anyone in
  a sealed dimension is sent back, as for the Nether and the End; the items go into `blood_pool.js`'s `TIERS`.
