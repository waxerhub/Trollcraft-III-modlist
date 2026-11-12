# The Frying Pan

`server_scripts/frying_pan.js` makes **The Frying Pan**: a super weapon that's really a Tinkers' Construct **Melting Pan**, a Seared Stone pan (`tconstruct:seared_stone`, its plating) on a Wood handle (`tconstruct:wood`, its limb). Ops hand it out; there's no recipe.

It's still a Melting Pan: it blocks like a shield and melts what it mines. On top of that, in the main hand:

| | What it does |
|---|---|
| **12 damage** | at 1 attack a second, set with the item's own `AttributeModifiers` (as for the Syndicate Slayer: vanilla reads the tag first, and Tinkers takes a main-hand weapon's damage from the player's attribute) |
| **BONK** | Every melee hit launches the target straight away from you, about 8–10 blocks for a mob on flat ground, with a clang and sparks. It **ignores knockback resistance**, so players in netherite fly too. It only launches on a hit that really hurt, so the Purge's sanctuary, spawn protection or invulnerability stop it |
| **SIZZLE** | Hits set the target alight for 3 seconds ("fresh off the stove"). Animals it kills drop cooked meat, as with Fire Aspect |
| **DING** | A falling hit (vanilla's critical hit: in the air, coming down, not in water) launches **harder and higher**, rings a bell, and leaves the target **dizzy**: nausea for 5 seconds, slowness II for 3. Better Combat's delayed hits count if the holder was falling up to 0.6 seconds before (as for the Anamian Axe's Judgement) |

Arrows and other projectiles launch nothing; it's melee only. The mark is `trollcraft:{frying_pan:1b}`. Renaming it on an anvil keeps it.

## Commands (op)
| Command | |
|---|---|
| `/pan give <player>` | A new Frying Pan in their inventory |
| `/pan bless` | The tool in your main hand becomes the Frying Pan as it is (materials and modifiers kept), with the damage, the name, the lore and the mark added |

## Settings (top of frying_pan.js)
| Setting | Default | |
|---|---|---|
| `NAME`, `NAME_COLOR` | The Frying Pan, gold | Its name |
| `TOOL`, `MATERIALS` | `tconstruct:melting_pan`; seared stone, wood | What `/pan give` builds (the pan's plating, then its handle) |
| `DAMAGE`, `ATTACK_SPEED` | 12, 1.0 | Base attack damage (a player's own 1 included) and attacks a second |
| `LAUNCH`, `LIFT` | 1.6, 0.45 | BONK: the speed the target is launched away and up at (blocks a tick) |
| `DING_LAUNCH`, `DING_LIFT` | 2.6, 0.7 | DING: the same, for a falling hit |
| `DIZZY_SECONDS` | 3 | DING: slowness II for this long, nausea 2 seconds longer |
| `CRIT_GRACE_MS` | 600 | Better Combat: a hit still counts as falling this long after the fall |
| `SIZZLE_SECONDS` | 3 | Seconds a hit target burns |
| `LORE` | three lines | Under "12 damage" |

**API:** `global.FryingPan = { make(), isPan(stack) }`.

## Install
Copy `frying_pan.js` to `kubejs/server_scripts/` and run `/reload`. It needs Tinkers' Construct.

## Test plan (an op and a second account)
1. `/pan give <you>`: a Melting Pan named The Frying Pan, with "12 damage" and the lore. "When in Main Hand" shows 12 Attack Damage and 1 Attack Speed.
2. **BONK:** hit a zombie on flat ground. It flies about 8–10 blocks, catches fire, and you hear a clang.
3. **Players:** have the second account wear netherite (knockback resistance) and hit it. It still flies.
4. **DING:** jump and hit something on the way down. It flies further and higher, there's a bell, and a player hit this way gets nausea and slowness.
5. **Cooking:** kill a cow or chicken with it. It drops cooked meat.
6. **Nothing happens:** at spawn, where the sanctuary or protection stops the damage; with a bow; or with an ordinary Melting Pan.
7. **`/pan bless`:** hold a Melting Pan with modifiers and run it. Its modifiers stay.

## Checked on the local test server (11 Nov 2026)
`/pan give`'s item, built in real KubeJS with no player online, and read back:
- **It matches the owner's Seared Stone-Wood Melting Pan:** 312 durability, block amount 10, knockback resistance 0.2 (shown as 2), mining speed 6, Stone tier.
- **Its modifiers came from Tinkers:** Fire Protection (the +10% Fire Resistance line), Melting, Tank and Tank Handler, and Cultivated.
- **The game's main-hand attributes** are +11 attack damage and −3 attack speed: 12 damage at 1 attack a second.

## What couldn't be verified
- **In a fight:** the mock tests pass (25 checks), but nobody has swung it yet. Things to watch:
  - how far the launch really goes, and whether players see their own launch at once (the motion is sent by setting `hurtMarked`, as the Pig Escort's push does);
  - that the pan's shield block still works;
  - whether 12 damage plus the launch feels right next to the Anamian Axe and the Syndicate Slayer (17 each).
