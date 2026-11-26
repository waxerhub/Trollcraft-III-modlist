# Tech gear and Tinkers: balance check against the Blood Pool tiers

Scope: Mekanism Tools, Mekanism (MekaSuit, Meka-Tool, jetpack, scuba, free runners, Atomic Disassembler, electric bow,
flamethrower), Mekanism Weaponry, Create Sabers, Redstone Arsenal, Modular Powersuits + Numina, Draconic Evolution,
Ender IO, Thermal, Extra Utilities Reborn, RFTools, Tinker's Rapier, Tinkers' Construct + TAIGA + TCIntegrations.
Also Create's netherite diving set (sealed at Tier 5, with an ability no lock holds).

The row-by-row data is in `tech_gear.tsv` (353 rows: 270 items, 83 Tinkers materials). Every value there is marked:
**R** read from a class or data file in the jar, **C** read from a config (file and key named), **I** inferred.
"Computed" Tinkers numbers apply the jar's own formula to the jar's data.

How to read the numbers:

- **attack_damage** and **attack_speed** are what the tooltip shows: the item's modifier plus the player's base 1 damage
  and 4 attacks per second. Checked in code: Mekanism Tools adds the item's damage to the material's `AttackDamage`
  (`ItemMekanismSword.m_43299_`, `m_41008_`); Tinkers' tooltip adds the player's base attribute
  (`TooltipBuilder.addWithAttribute`).
- **tier** is `BP.tierOf(item, null)` from `tools/ftbquests/load_scripts.js`. For a Tinkers material it's the tier of
  the rule that seals its material recipes (`TINKERS_MATERIALS`, or `tcintegrations`/`taiga` by namespace and the
  TAIGA alloy rule). Where the crafting chain needs a later tier, this file says **"craft tier"**.
- Configs: `tools/serverconfig/` has none of these mods, so the values come from the test server:
  `config/Mekanism/{tools,gear,generators-gear}.toml`, `config/mekanism_weaponry-common.toml`,
  `config/brandon3055/{DraconicEvolution,ModuleStats}.cfg` (every Equipment value is `-99`, which means "use the internal
  default"; I used the defaults printed in that file's comments), `config/enderio/*.toml`,
  `config/tinker_rapier-common.toml`, `config/tconstruct-common.toml` and `world/serverconfig/{powersuits,numina,
  redstone_arsenal,thermal,taiga-traits,tinkerslevellingaddon}-server.toml`.

For comparison, vanilla netherite is a sword 8 at 1.6 per second and armour 20 / 12 / 0.4 (vanilla values: I).

---

## 1. Full sets and headline weapons, by family

| Family (tier) | Full set: armour / toughness / KBR | Best melee (tooltip @ attacks/s) | Notes |
|---|---|---|---|
| Mekanism Tools lapis (8) | 9 / 0 / 0 | sword 5, paxel 7 | stone mining level |
| Mekanism Tools bronze (8) | 18 / 4 / 0 | sword 6, paxel 11 @ 1.6 | iron level |
| Mekanism Tools refined glowstone (8) | 20 / 0 / 0 | sword 6, paxel 10 | diamond level, efficiency 15; armour keeps piglins neutral |
| Mekanism Tools steel (8) | 20 / 8 / 0 | sword 7, paxel 12 @ 1.6 | diamond level |
| Mekanism Tools osmium (8) | **21 / 12 / 0.4** | sword 8, axe 13 @ 0.7, **paxel 14 @ 1.6** | iron level, efficiency only 4 |
| Mekanism Tools refined obsidian (8) | **31 / 20 / 0.8** | sword 12, axe 16 @ 1.1, **paxel 17 @ 1.6** | netherite level; 4,096 uses (paxel 8,192); shield 1,680 |
| Mekanism Tools vanilla paxels (8) | | netherite paxel 11 @ 1.6, diamond 10 | sealed at 8 with the mod |
| MekaSuit (helmet/pants/boots 4, body 10; craft tier 10) | 20 / 12 / 0.4 | | with energy, a full suit absorbs **100%** of damage that doesn't bypass armour |
| Meka-Tool (10) | | **37 @ 1.6** (5 without the attack units) | mines anything at up to 128 speed; teleports 100 blocks |
| Atomic Disassembler (4; craft tier 7) | | **21 @ 1.6** charged (5 empty) | mines anything at up to 128 speed |
| Mekanism jetpack (4) | armoured version 8 / 2 | | **real flight at Tier 4** (hydrogen) |
| Mekanism Weaponry (8) | | plasma rifle 8 × 3.3/s; railgun 16 (32 in mode 2); minigun 2.5 × 5/s; gauntlet 6 @ 1.0 | guns are ranged |
| Create Sabers (8) | | 4 @ 1.6 (zinc 1.8), Better Combat sweeps | parry cancels frontal melee and deflects projectiles |
| Redstone Arsenal flux (7) | 20 / 4 / 0 while charged | sword 7.5 @ 1.6, axe 10, trident 10.5 @ 1.1 | each armour piece cancels one whole hit every 30 s |
| Modular Powersuits (7) | **30 / 14 / KBR capped at 1** (netherite plating) | power fist: melee assist up to 10, plasma cannon up to 40 per charged shot, railgun 5-30 | jetpack and jet boots need a Tier 11 part |
| Draconic wyvern (9; craft tier 10) | chest 8 / 2 + shield | sword 8.75 @ 2.0 base, **+4 per damage module (no limit)** | chestpiece shield ~750 points (I) |
| Draconic draconic (9; craft tier 11) | chest 8 / 2 + shield | sword 12.25 @ 2.4, +8 per module; staff 15.75 @ 0.75 | creative flight; shield ~2,650 (I) |
| Draconic chaotic (9; craft tier 11) | chest 8 / 2 + shield | sword 17.5 @ 3.2, +16 per module; staff 22.5 @ 1.0 | creative flight; shield ~9,300 (I) |
| Ender IO (5) | | The Ender (dark steel sword) 7 @ 1.6 | also drops from Ender IO loot chests |
| Thermal (5) | | flux drill 3 (more with augments) | tools only |
| Extra Utilities Reborn (7) | | **Kikoku 14 @ 3.2, unbreakable**; Etheric Sword 9 @ 19 (no cooldown) | |
| Tinkers plate armour | see §2 | see §2 | |

Full-set sums are computed from the per-piece values in the TSV.

**MekaSuit damage absorption (C, R).** Each piece covers a share of every hit: helmet 15%, body 40%, pants 30%, boots
15% (`ItemMekaSuitArmor` constructor; I matched the pieces by their laser numbers). The cost is 100,000 J per point of
damage (`energyUsageDamage`). With a full suit, the ratio for types not on the list is 1.0 (`unspecifiedDamageReductionRatio`),
so melee, arrows and explosions are all absorbed. On the list: fall, fire, lava, wither, generic, freeze and others at
1.0, and sonic boom at 0.75. Damage that bypasses armour is absorbed only if it's in `mekanism:mekasuit_always_supported`.
Magic needs the Inhalation Purification Unit.

Base energy is 16 MJ per piece, doubled by each Energy Unit (up to 8, so 4.096 GJ). That's 160 damage points per
piece with no energy units, and about 41,000 with all eight.

---

## 2. Tinkers: materials and worked examples

### Formula, read from Tinkers 3.11.2 (R)

- Each stat is built as `(sum of adds) × (1 + sum of percents) × multiplier` (`FloatToolStat.build`).
- A head part adds `stat × part scale` (`HeadMaterialStats.apply`). A handle adds a percent × scale
  (`HandleMaterialStats.apply`). Scales come from the tool definition and default to 1, with no normalising
  (`StatScaleField`).
- `base_stats` adds to the stat. `multiply_stats` multiplies it.
- Sword: small blade (1) + 2 tool handles (0.5 each). Base 3 damage and 1.6 speed. Damage ×1.
- Cleaver: broad blade (0.75) + large plate (0.25) + 2 tough handles (0.5 each). Base 3 damage and 1.0 speed.
  **Damage ×1.5.**
- Tooltip = 1 + attack stat. A check: an all-iron Tinkers sword computes to 6.0, the same as a vanilla iron sword.

Plate armour is the plating stats per piece; the maille adds traits only. Tinkers' own armour stat caps at 30 per piece,
and vanilla's armour attribute caps at 30 in total.

### Worked examples per Blood Pool tier (computed, tooltip damage @ attacks per second)

"Own best" means that tier's newly sealed material with the highest sword damage, used for every part. "Mix" means
the best head available up to that tier, with the best handles available up to that tier: **nahuatl** (open,
+25% damage) wins at every tier.

| Tier | Own best material | Sword | Cleaver | Rapier (see §3) | Mix (head + handles) | Mix sword / cleaver / rapier |
|---|---|---|---|---|---|---|
| 0 (open) | nahuatl (iron for contrast: 6.0 / 8.5) | **8.5 @ 1.44** | 12.25 @ 0.9 | 12.25 @ 2.2 | nahuatl + nahuatl | 8.5 / 12.25 / 12.25 |
| 3 | steel | 7.04 @ 1.6 | 10.06 @ 1.0 | 8.7 @ 2.75 | nahuatl + nahuatl | 8.5 / 12.25 / 12.25 |
| 4 | steeleaf (osmium: 6.0 / 8.5) | 7.0 @ 1.84 | 10.0 @ 1.15 | 8.5 @ 3.58 | nahuatl + nahuatl | 8.5 / 12.25 / 12.25 |
| 5 | knightmetal (cobalt: 6.25 / 8.88) | 7.9 @ 1.68 | 11.35 @ 1.05 | 10.75 @ 3.03 | knightmetal + nahuatl | 8.5 / 12.25 / 12.25 |
| 6 | fiery (pewter: 8.2 / 11.8) | 8.47 @ 1.44 | 12.21 @ 0.9 | 12.05 @ 2.2 | fiery + nahuatl | 9.13 / 13.19 / 13.75 |
| 8 | Tinkers: manyullyn | 8.8 @ 1.52 | 12.7 @ 0.95 | 12.9 @ 2.48 | | |
| 8 | TAIGA: **triberium** (vibranium 12.1 / 17.65) | **12.35 @ 1.6** | **18.02 @ 1.0** | 19.2 @ 2.75 | triberium + nahuatl | **15.19 / 22.28 / 28.3** |
| 9 | dragonsteel (TCIntegrations; head only, so +0 handles) | **24 @ 1.6** | **35.5 @ 1.0** | 42.5 @ 2.75 | dragonsteel + nahuatl | **29.75 / 44.13 / 63.25** |

Other computed tools (all-manyullyn): hand axe 12.4 @ 0.86 (base 6, unscaled head); broad axe ×1.65 multiplier.

### Plate sets (computed: armour per piece = total; toughness and KBR are set totals)

| Tier | Material | Plate set | Toughness | KBR |
|---|---|---|---|---|
| 0 | iron | 2/5/4/2 = 13 | 0 | 0 |
| 0 | bronze / slimesteel / amethyst bronze | 15 | 0 / 0 / 8 | 0.4 / 0 / 0 |
| 3 | steel | 2/7/5/2 = 16 | 8 | 0 |
| 4 | steeleaf / osmium | 16 / 11 | 0 / 0 | 0 / 0.2 |
| 5 | cobalt / knightmetal | 16 / 16 | 4 / 8 | 0.2 / 0.2 |
| 6 | fiery | 3/8/6/3 = 20 | 6 | 0 |
| 8 | manyullyn / hepatizon / queen's slime | 16 / 16 / 16 | 12 / 8 / 4 | 0.2 / 0.4 / 0 |
| 8 | TAIGA vibranium (adamant 16/12/0.32, craft tier 9) | 16 | 10 | 0.32 |
| 9 | dragonsteel | **7/12/9/6 = 34** (over the 30 cap) | **16** | 0 |

Tinkers' own end-game metals (manyullyn and the rest) are **weaker than netherite armour** (16 armour against 20) and
barely above a netherite sword (8.8 against 8).

### Material stats that matter (R: `data/<ns>/tinkering/materials/stats/*.json`)

Head attack / durability / mining tier, then handle damage % / speed %:

- **Tier 3:** steel 2.75 / 775 / diamond; handle +5% / 0.
- **Tier 4:** osmium 2.0 / 500 / iron; handle 0 / -10%. Steeleaf 3.0 / 200 / diamond; handle 0 / +15%.
- **Tier 5:** cobalt 2.25 / 800 / diamond; handle 0 / +5%. Knightmetal 3.0 / 512 / netherite; handle +15% / +5%.
  Scorched stone 2.5 / 120 / iron. Knightly: arrow heads only.
- **Tier 6:** fiery 3.5 / 1,024 / netherite; handle +15% / -10%. Pewter 3.0 / 316 / diamond; handle +20% / 0.
  Invar 2.5 / 630; electrum 1.5 / 225 / iron; constantan 1.75; silver 2.25 / 300 / iron; lead 1.75 / 200 / iron.
  Aluminum: grip, limb and plating only (no head).
- **Tier 8:** manyullyn 3.5 / 1,250 / netherite; handle +20% / -5%. Hepatizon 2.5 / 975; handle -10%.
  Queen's slime 2.0 / 1,650; handle -5%. Cinderslime 2.25 / 1,221; handle 0 / -10%.
  Necronium 2.75 / 357 / diamond; handle +10% / +15%. Blazing bone 3.0 / 530 / iron; handle +5% / +20%.
  Ancient 2.5 / 745 / netherite.
  Blazewood, enderslime and ichor are arrow, shaft and repair-kit materials only.
- **Tier 9:** dragon scale is arrow head and maille only. Dragonsteel ×3 (TCIntegrations): head **20** / 2,500 /
  netherite, no handle stats.
- **TAIGA heads** (sword / cleaver all one material). Every TAIGA handle gives +0% damage:
  - triberium 8.35 (12.35 / 18.02)
  - nucleum 9.5 (13.5 / 19.75)
  - vibranium 8.1 (12.1 / 17.65)
  - uru 7.2 (11.2 / 16.3)
  - solarium 7.0 (11.0 / 16.0)
  - fractum 6.93 (10.93)
  - palladium 6.8 (10.8)
  - ignitz 6.66 (10.66)
  - prometheum 6.6 (10.6)
  - adamant 6.0 (10.0)
- **Open materials:** nahuatl 3.0 / 350 / diamond, handle **+25%**; pig iron 2.5; slimesteel 2.5 / 1,040; bronze 2.25 / 760;
  amethyst bronze 1.5; plated slimewood 2.0; rose gold 1.0; iron 2.0 / 250 / iron.

### Tinkers traits that matter in a fight (R: Tinkers lang; TAIGA values C: `taiga-traits.toml`)

- **Tinkers:**
  - Manyullyn: *insatiable*, more damage with each consecutive hit; on armour, *kinetic*, more damage each time you're hit.
  - Hepatizon: *momentum*; on armour, *recurrent protection*.
  - Queen's slime: *overlord* + *overslime*. Cinderslime: *overburn*.
  - Knightmetal and knightly: *valiant*, more damage against armoured targets; knightmetal armour: *stalwart*, less
    damage from armed attackers.
  - Cobalt: *lightweight*; armour *melee protection*.
  - Fiery: *autosmelt*; armour *tempered protection*.
  - Pewter: *raging*, more damage at low health; armour *vital protection*.
  - Steel: *ductile*. Invar: *solid*. Electrum: *shock*. Lead: *heavy*. Silver: *smite*; armour *consecrated*.
  - Necronium: *decay*, withers. Blazing bone: *conducting*, multiplied damage while you're on fire.
  - Scorched stone: *scorching*. Nahuatl: *lacerating*, bleed. Ancient: *vintage* + *worldbound*.
  - Dragon scale armour: *dragonborn*, more protection and attack while airborne.
  - The estoc has *piercing*: damage through armour.
- **TAIGA:**
  - Triberium *fragile*: +1 damage, durability ×0.85.
  - Vibranium *heroic*: +0.15 damage multiplier.
  - Adamant *berserk*: up to +0.4 at full missing health.
  - Nihilite *souleater*: damage grows with kills, cap 20.
  - Eezo and solarium *superheavy*: +1.5 damage, attack speed ×0.85.
  - Solarium *crushing*: +0.2 against targets above 80% health.
  - Valyrium *congenial*: +0.15 above 90% health.
  - Dyonite *tantrum*: ×0.85 to ×1.35. Tiberium *unstable*: ×0.75 to ×1.25.
  - Astrium *ported*: a 10-block teleport.
  - TAIGA armour traits are capped at 30% damage reduction in total (`armor_rules.maximumDamageReduction`).
- **TCIntegrations dragonsteel:** *flamed* / *iced* / *zapped* (ignite, freeze or lightning, plus knockback); armour
  *ductile* + *dragonscales*.
- **Tinkers Levelling Addon** (C): tools reach level 5, gaining upgrade, upgrade, upgrade, ability, upgrade slots in
  that order, with no stat gains. That's 4 more upgrade slots for Sharpness and the like, on top of the base 3 + 1.
  Not counted in the numbers above.

---

## 3. Abilities worth knowing (trigger and numbers in the TSV)

- **Mekanism:**
  - MekaSuit: absorption as in §1. Modules:
    - gravitational modulating: creative flight at 1 kJ per tick; needs antimatter, so craft tier 11
    - elytra unit: craft tier 11
    - jetpack unit: 48,000 mB
    - inhalation purification: blocks magic and removes bad effects
    - locomotive boosting: sprint +0.5
    - hydraulic propulsion: jump +5, step +2
    - boots: fall damage fully absorbed at 50 J per half-heart
    - geothermal unit: up to 80% less heat damage
  - Meka-Tool: Attack Amplification ×4 (MAX) adds +32 damage at 16 kJ per hit. Teleport unit: 100 blocks.
    Excavation up to 128. Extended vein mining is on in the config.
  - Jetpack: +0.15 per tick up to 0.5 m/t, hover mode, 1 mB per tick, so 20 minutes per 24,000 mB tank.
  - Free runners: step +0.5, fall damage absorbed.
  - Flamethrower: 10 damage per flame, sets on fire.
  - Atomic Disassembler: 21 damage while it holds 2 kJ.
- **Mekanism Weaponry:** fire-rate chips take 1 to 4 ticks off a gun's cooldown. On the minigun (cooldown 4), chip 4
  means a shot every tick: 2.5 × 20 per second, until heat stops it. The railgun's second mode doubles its stats.
- **Create Sabers:**
  - Lit: +3 damage (4 on the tooltip); unlit: no attack bonus.
  - On hit: Brass Nausea (brass) or Scattered Zinc (zinc) for 10 s.
  - Better Combat: claymore moves (sweep ×0.75, stab ×1.0, slam ×1.25, 2.75 reach) or twin-blade sweeps.
  - **Parry**: while blocking with a lit saber, frontal melee hits are cancelled and projectiles deflected.
  - The Laceration enchantment only sends the attacker a visual overlay.
- **Redstone Arsenal:**
  - **Flux shielding**: each armour piece holds one charge that cancels a whole attack under 500 damage, then
    recharges in 600 ticks. A full set cancels 4 hits every 30 s.
  - Armour attributes count only while charged.
  - Sword, when empowered: a Flux Slash on every swing (2 + Sharpness).
  - Shield: repel (range 4). Trident: plunge attack.
  - Flux elytra with controller boost. Its armour value is 0, because the CoFH material puts the 5 on leggings.
- **Modular Powersuits** (C):
  - Netherite plating: 7.5 armour, 3.5 toughness and 1.5 KBR per piece. One piece already gives full knockback
    immunity (the attribute caps at 1).
  - Energy shield: up to 6 armour per piece.
  - Plasma cannon: up to 40 damage plus an explosion when charged 50 ticks.
  - Railgun: damage = impulse / 100, so 5 to 30.
  - Lightning summoner: 4.9 MJ; craft tier 11.
  - Blink drive: 64 blocks; craft tier 11.
  - Dimensional tear generator: Overworld ↔ Nether; needs an ender eye, Tier 9.
  - Active camouflage (invisibility), mob repulsor, sprint up to +2.59.
  - **Jetpack and jet boots need `numina:component_ion_thruster` (Tier 11).**
- **Draconic Evolution** (C, R):
  - Damage modules are 1×1 with no install limit (`ModuleTypes.DAMAGE`): +4, +8 or +16 each, for 1,024 OP per damage
    point per hit.
  - Tool grids: 4×4, 6×5, 8×6. Staffs: 8×6 and 10×8. Chestpieces: 6×5, 8×6, 10×8.
  - A filled wyvern sword reaches about 68.75; draconic about 236; chaotic about 770 (I, energy permitting).
  - Shield modules: 25 / 50 / 100 points (1×1), or 125 / 250 / 500 (2×2). Recharge waits 20 / 10 / 5 s after a hit.
  - Undying module (one): +6 / 12 / 20 health, +25 / 50 / 100 shield, 2-3 s invulnerable, 120 / 60 / 45 s recharge.
  - Flight: wyvern is elytra only; draconic and chaotic add creative flight (`enableCreativeFlight=true`).
  - The chestpiece can be worn in the Curios **body** slot.
- **Ender IO:**
  - The Ender: 7% chance of a mob head on a kill.
  - Staff of Levity: Levitation, toggled, 1 FE per tick.
  - Staff of Travelling: blink 24 blocks.
- **Extra Utilities Reborn:**
  - Kikoku never wears out (Tier uses 0).
  - Etheric Sword: 19 swings per second.
  - Healing Axe: on hit, sets the target's health by about 4 (I).
  - Reinforced glass cutter: +3 damage on hit.
  - Advanced chicken wing ring: no fall damage, jumps ×1.25.
- **Tinker's Rapier:**
  - The rapier's parts are unscaled: two head parts and two handles, all at full weight. That is about 1.5 times a
    sword's damage at 2.75 base speed.
  - **Sting**: against a target without a chestplate, it first hits for about 1.4 × its attack at full charge, then
    resets the target's invulnerability so the normal hit lands too. Mobs take roughly 2.4× per swing.
  - Right-click: a lunge.
- **Create netherite diving set** (Tier 5): helmet + backtank + boots + any netherite leggings give **fire and lava
  immunity** (`NetheriteDivingHandler`, all four bits).

---

## 4. Misplaced or outlying items (recommendations for the owner)

1. **Extra Utilities Reborn's Kikoku and Etheric Sword (Tier 7).** Kikoku is 14 damage at 3.2 per second and never
   breaks. That is about 45 damage per second on the tooltip, and still about 28 against one target once invulnerability
   frames cut it to 2 hits a second (I). It beats every Tier 8 weapon, including the refined obsidian sword (12 @ 1.6).
   The Etheric Sword (9 @ 19 per second) has no swing cooldown at all. Suggest listing both at Tier 9 or later, with
   `WIELD_LOCKS`. The Healing Axe (5 @ 6.0) is minor.
2. **Atomic Disassembler: Tier 4 by namespace, craft tier 7.** It hits for 21 at sword speed and mines anything, more
   than any Tier 8 sword. Suggest listing it at Tier 7 or 8 in `items`, with a `WIELD_LOCKS` entry.
3. **Mekanism Tools paxels (Tier 8).** They do axe-level damage at sword speed: refined obsidian 17 @ 1.6, osmium 14 @
   1.6, steel 12. The refined obsidian paxel is the strongest Tier 8 melee weapon outside TAIGA. This may be intended,
   but it outclasses the refined obsidian sword (12).
4. **MekaSuit helmet, pants, boots and every module are Tier 4 items** (the `mekanism` namespace). Only
   `mekasuit_bodyarmor` and `meka_tool` are listed at Tier 10. Their recipes need polonium, so crafting waits for Tier 10,
   but as items they count as Tier 4. Suggest listing all four pieces at Tier 10, and `module_gravitational_modulating_unit`
   and `module_elytra_unit` at 11. Add them to `WEAR_LOCKS` if Part I suits exist.
5. **Tinker's Rapier (Tier 4).** Two full heads plus two full handles, at 2.75 base speed. Triberium (Tier 8) gives 19.2
   (28.3 with nahuatl handles); dragonsteel (Tier 9) gives 42.5 to 63.25. Add the sting against mobs and unarmoured players.
   The material locks (tree nodes) still apply to its parts, but for the same materials it's well above a sword or
   cleaver. Consider Tier 8, or accept it as the Tinkers top end.
6. **Nahuatl is open (Tier 0) and the best handle in the pack** (+25% damage). An all-nahuatl sword (8.5) already
   matches a netherite sword (8, sealed at Tier 5), and nahuatl handles raise every sealed head material. Suggest sealing
   it with netherite at Tier 5, through `TINKERS_MATERIALS(['nahuatl'])`. Its recipe is the composite
   `tconstruct:tools/materials/composite/nahuatl`: wood + molten obsidian.
7. **TAIGA at Tier 8 outclasses Tinkers' own end-game and Mekanism Tools,** with sword 12.35 and cleaver 18.02
   (triberium), against manyullyn's 8.8 and 12.7. The tier split doesn't follow TAIGA's real dependencies:
   - Alloys 09 to 11 (solarium, adamant, nihilite) are Tier 8 by recipe id, but they need nucleum (22-24) or iox (18-19),
     which are Tier 9.
   - Anything with an End ore needs the End, which opens at Tier 9. Aurorium, palladium and abyssum are End ores, so
     fractum, violium, proxii, imperomite and astrium are craft tier 9 too.
   - Triberium (Nether tiberium + basalt) and vibranium (an Overworld ore, 1 vein per chunk, y -32 to 32) are the real
     Tier 8 materials. Suggest Tier 9 for triberium and vibranium, or accept TAIGA as the top of Tier 8.
   - **No Potato War node covers TAIGA** (nor TCIntegrations brass and manasteel), so they have the crafting seal only.
8. **Draconic Evolution damage modules stack without a limit.** A wyvern sword can reach about 68.75 (craft tier 10),
   which dwarfs everything at Tiers 9 to 10. `ModuleStats.cfg` can override `damage_boost` per module (`override=true`).
   Suggest lowering it, or accepting DE as the end-game.
9. **Modular Powersuits armour at Tier 7:** 30 armour and 14 toughness with netherite plating, against netherite's 20 /
   12 and refined obsidian's 31 / 20 at Tier 8. It also gives full knockback immunity. Strong for Tier 7.
10. **Redstone Arsenal flux armour at Tier 7** cancels 4 whole hits every 30 s. Strong for Tier 7 in PvP.
11. **Tinkers dragonsteel plate (Tier 9)** reaches 34 armour (capped at 30) with 16 toughness: at 30 armour and 16
    toughness, a hit of up to 60 damage is cut by the maximum 80%. It's the best armour short of MekaSuit or Draconic.

---

## 5. Sealed items with abilities that no lock holds

Usable by anyone who has them (Part I inventories, trades from a higher-ranked player, loot), before or regardless of
their tier. None of these is in `USE_LOCKS`, `WEAR_LOCKS` or `WIELD_LOCKS`:

| Item(s) | Tier | Ability that matters |
|---|---|---|
| `mekanism:mekasuit_*` (body 10, others 4) | 4 / 10 | 100% damage absorption with energy, creative flight, jetpack |
| `mekanism:meka_tool` | 10 | 37 damage, mines anything, 100-block teleport |
| `mekanism:atomic_disassembler` | 4 | 21 damage, mines anything |
| `mekanism:jetpack`, `jetpack_armored`, `free_runners*` | 4 | flight; no fall damage |
| `mekanism:portable_teleporter` | 4 | **in `USE_LOCKS`, but bypassed**: Mekanism Curios adds a "teleporter" curio slot and a Quick-Teleport key (`QuickTeleportActionPacket`), so no right-click happens |
| `mekanism_weaponry:plasma_rifle`, `gauntlet` | 8 | ranged 26.7 DPS; knockback melee (the railgun and minigun *are* use-locked) |
| `create_sabers:*` | 8 | parry, on-hit effects |
| `redstone_arsenal:flux_*` armour, sword, shield, elytra; **`flux_crossbow`** | 7 | flux shielding; empowered slash; repel; elytra flight. The flux bow is use-locked, but the flux crossbow isn't |
| `powersuits:*` | 7 | 30 armour, invisibility, blink, Nether tear, 40-damage plasma, flight (if built) |
| `draconicevolution:*_sword/_axe/_staff/_chestpiece/_capacitor`, **`advanced_dislocator`, `player_dislocator`** | 9 | module damage, shield, undying, creative flight; teleports (only the basic `dislocator` is use-locked) |
| `extrautilitiesreborn:kikoku`, `etheric_sword`, `healing_axe`, `advanced_chicken_wing_ring` | 7 | see §4; no fall damage |
| `enderio:staff_of_levity` | 5 | Levitation (the Staff of Travelling is use-locked) |
| `enderio:dark_steel_sword` | 5 | also in `enderio:chests/common_loot` (index), so looted before Tier 5 (7 damage, mob heads: minor) |
| `rftoolsutility:charged_porter`, `advanced_charged_porter` | 7 | teleport to matter receivers |
| `mekanismtools:*` (paxels, refined obsidian armour) | 8 | 17-damage paxel, 31 / 20 armour |
| `create:netherite_diving_helmet`, `netherite_backtank`, `netherite_diving_boots` | 5 | fire and lava immunity |
| TAIGA and TCIntegrations (brass, manasteel) Tinkers tools | 8 / 9 | crafting seal only, no tree node (§4 item 7) |

Tinkers tools made of the other sealed materials *are* held per player by the Potato War tree (`gearLock` reads
`tic_materials`). Mobs' Tinkers drops are all `tconstruct:ancient` (`data/tconstruct/tinkering/mob_equipment`), which
the Masterwork node holds.

---

## 6. Discrepancies with the earlier research

- **AETHER_DEEPERDARKER.md "osmium 21/12" and "refined obsidian 31/20/0.8 and 12": correct** (C `tools.toml`).
  Osmium's KBR is 0.4 and its sword is 8.
- **AETHER_DEEPERDARKER.md "flight at Tier 7 (Powersuits)": wrong.** Powersuits' jetpack and jet boots need
  `numina:component_ion_thruster`, which is sealed at Tier 11, so powered flight from Powersuits is Tier 11. At Tier 7
  there's only gliding (the Powersuits glider, the Redstone Arsenal flux elytra). **Real flight already exists at Tier 4**
  through Mekanism's hydrogen jetpack, and at Tier 9 (craft tier 11) through Draconic creative flight.
- **AETHER_DEEPERDARKER.md "comparable gear sits at Tier 8 (manyullyn, Mekanism tools)":** the Tinkers manyullyn plate
  (16 / 12 / 0.2) and sword (8.8) are *weaker* than the Warden gear placed at Tier 7 (24 / 16 / 0.4, 9). Only refined
  obsidian (31 / 20 / 0.8, sword 12, paxel 17), TAIGA (Tier 8) and Powersuits' plated suit (Tier 7) exceed it.
- **AETHER_DEEPERDARKER.md: the sonorous staff's 50 damage "outclasses everything but dragonsteel":** not quite. The
  Meka-Tool hits for 37 (Tier 10), a filled Draconic wyvern sword for about 69, and a Tinkers dragonsteel rapier for
  42.5 to 63. The "dragonsteel sword 25" there is Ice and Fire's item. The Tinkers dragonsteel sword is 24 to 29.75.
- **02_LADDERS.md "Tinker's Rapier adds one tool": two.** `tinker_rapier:rapier_tic` and `estoc_tic`, plus the
  `slender_blade` part.
- **02_LADDERS.md: TCIntegrations' calorite, desh, neptunium, ostrum, soul_stained_steel** (and pendorite) **don't
  exist here.** Their definitions need the metal's tag, `forceIntegrationMaterials = false` (`tconstruct-common.toml`),
  and none of those mods is installed. The present ones are brass, manasteel, manastring, livingwood, livingrock and
  dragonsteel ×3.
- **02_LADDERS.md / TIER_PROPOSAL.md: TAIGA "as one block at Tier 8", "numbered in tier order".** The live `TIERS` seals
  alloys 14-27 at Tier 9, but alloy numbers don't track real dependencies (§4 item 7).
- **TIER_PROPOSAL.md Tier 10 "the MekaSuit":** only the body armour and the Meka-Tool are listed there. The other three
  pieces and every module are Tier 4 items, held back only by polonium in their recipes (§4 item 4).
- **TIER_PROPOSAL.md "the Wyvern tier is tier 10": correct for crafting** (`wyvern_energy_core`), but the Draconic gear
  *items* are Tier 9 by namespace and nothing locks their use.

---

## 7. What I couldn't determine

- **Draconic Evolution:**
  - Exactly what the shield blocks (damage types, the recharge per tick), and the practical loadouts. Shield and damage
    totals above assume the grid is filled (I).
  - Module sizes come from `DEModules`/`ModuleTypes`; I took modules without a size argument as their type's default.
  - Tool harvest levels (`useToolTierTags=false`).
- **MekaSuit:**
  - The piece-to-absorption mapping is read through a compiler switch map. I matched it by the laser values.
  - How a *partial* suit behaves against unlisted damage types (I).
- **Mekanism Weaponry:** the heat cap, cooldown between overheats, and the number of addon slots per gun.
- **Redstone Arsenal:**
  - Per-item energy: I took the 800,000 / 10,000 in `ModItems.register()` as shared by every item.
  - The flux tools' damage, assumed to be value + tier bonus 2.5 as in vanilla tool classes.
  - What empowered mode does for the bow and crossbow.
- **Modular Powersuits:** module heat limits; module slot counts other than the one armour slot per piece. The railgun
  damage formula (impulse / 100) is from partial bytecode.
- **Create Sabers:** the exact movement and view effects of Brass Nausea and Scattered Zinc (constants read, not the
  full behaviour).
- **Extra Utilities Reborn:** the Healing Axe's exact on-hit and inventory effect.
- **Thermal:** the flux drill and saw with each Upgrade augment level (only the base formula was read).
- **Ender IO:** the hang glider's item ids. The `HangGliderItem` class exists, but the lang has no glider item. The dark
  steel pickaxe and axe classes exist, but only the sword is registered.
- **Tinkers:** the effect of modifiers (Sharpness and the rest) and of levelling slots on the worked examples. Ice and
  Fire items, the Aether, Deeper and Darker and vanilla are other reports' scope.
- **Outside the brief, not checked:** Immersive Engineering (steel armour reads 2/7/6/2 = 17 with toughness 1 per piece;
  the revolver, railgun and chemthrower are already use-locked), the rest of Create, AE2, Blue Power and Create Big
  Cannons gear.
- **Which of these items players actually carried over from Part I:** that needs the world data.
