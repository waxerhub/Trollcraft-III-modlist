# The Syndicate Slayer

`server_scripts/syndicate_slayer.js` makes **The Syndicate Slayer**: a named Tinkers' Construct **Mattock** that deals **17 base damage** and **heals whoever holds it with every kill**. Ops hand it out; there's no recipe.

| Part (in the Mattock's order) | Material |
|---|---|
| Axe head | Nucleum (`taiga:nucleum`) |
| Handle | Valyrium (`taiga:valyrium`) |
| Adze head | Tritonite (`taiga:tritonite`) |

Tinkers' tooltip lists the two heads first and the handle last, which is why it shows Nucleum, Tritonite, Valyrium.

## How it works
- **Building it:** `/slayer give` creates a Mattock with just its three materials. Setting the item's tag makes Tinkers build the tool from them (`ToolStack.verifyTag` → `rebuildStats`): stats, traits and all.
- **17 damage:** the Slayer carries its own `AttributeModifiers`, +16 attack damage on a player's own 1, main hand only.
  - Vanilla reads an item's `AttributeModifiers` tag before the item's own attributes, so Tinkers' computed ones are set aside.
  - For a main-hand weapon, Tinkers takes the damage from the player's attack-damage attribute (`ToolAttackUtil.getAttributeAttackDamage`). So 17 is what it hits for, before Strength, critical hits and the tool's own modifiers and traits.
  - Both checked in the jars' class files.
- **Attack speed:** the tag replaces Tinkers' attack speed too, so it's set to a Mattock's own **0.9**.
- **Healing:** a kill made with the Slayer **in the main hand** heals **4 health (two hearts)**, or **10 (five hearts)** for a player. It doesn't count killing yourself, or a kill by something else (a mob, a fall).
- **The mark:** the Slayer carries `trollcraft:{slayer:1b}`. Renaming it on an anvil keeps the mark, the damage and the healing.

## Commands (op)
| Command | |
|---|---|
| `/slayer give <player>` | A new Slayer in their inventory |
| `/slayer bless` | The tool in your main hand becomes the Slayer as it is (its materials, modifiers and upgrades kept), with the damage, the healing, the name and the lore added. Use it to convert a Slayer someone already built |

## Settings (top of syndicate_slayer.js)
| Setting | Default | |
|---|---|---|
| `NAME`, `NAME_COLOR` | The Syndicate Slayer, dark red | Its name |
| `TOOL` | `tconstruct:mattock` | The Tinkers tool `/slayer give` builds |
| `MATERIALS` | nucleum, valyrium, tritonite | In the tool's part order (axe head, handle, adze head) |
| `DAMAGE` | 17 | Base attack damage, a player's own 1 included |
| `ATTACK_SPEED` | 0.9 | Attacks a second (a Mattock's own) |
| `HEAL_KILL`, `HEAL_PLAYER` | 4, 10 | Health healed per kill, and per player killed (2 = one heart) |
| `LORE` | "Every kill heals its wielder." | Lore lines under "17 damage" |

**API:** `global.SyndicateSlayer = { make(), isSlayer(stack) }`.

## Install
Copy `syndicate_slayer.js` to `kubejs/server_scripts/` and run `/reload`. It needs Tinkers' Construct and TAIGA (both in the pack).

## Test plan (an op and a second account)
1. `/slayer give <you>`: a Mattock named The Syndicate Slayer.
   - The tooltip shows Nucleum, Tritonite and Valyrium, "17 damage" in the lore, and "When in Main Hand: 17 Attack Damage, 0.9 Attack Speed".
2. **Damage:** hit a zombie or a training dummy. A plain hit does 17 (8.5 hearts) on an unarmoured target.
3. **Healing:**
   - lose a few hearts, then kill a mob with it in your main hand: two hearts back;
   - kill the second account: five hearts;
   - with the Slayer in your off hand, or another item in your main hand, a kill heals nothing.
4. **`/slayer bless`:** hold any Tinkers tool and run it. The name, the damage and the healing are added, and its materials and modifiers stay.

## Checked on the local test server (11 Nov 2026)
`/slayer give`'s item, built in real KubeJS with no player online, and read back:
- **Tinkers built it:** a `tconstruct:mattock` with the three TAIGA materials in order.
  - It got their traits as modifiers: TAIGA's **Decay**, **Mutate**, **Congenial** and **Whirl**, plus the Mattock's Tilling.
  - It got full stats: 1,044 durability, 14 mining speed, 0.9 attack speed.
- **The game's main-hand attributes** for it are +16 attack damage and −3.1 attack speed: 17 damage at 0.9 attacks a second.
- **Tinkers' own stat sheet says 8.69 attack damage,** which is what the materials alone compute. Players who hold Shift see that number, while the vanilla "When in Main Hand" line says 17. The 17 is what it hits for.

## What couldn't be verified
- **In a fight:** nobody has swung it or killed with it yet (no player online on the test server). Things to watch:
  - that a hit does 17, with Tinkers modifiers and traits that add damage (Sharpness, for example) still adding on top;
  - the heal on a kill;
  - what the four TAIGA traits do in combat.
- **Which tool it is:** from the screenshot it's a Mattock: two heads and a handle, called an axe. A Pickadze has the same layout. If yours is a Pickadze, set `TOOL` to `tconstruct:pickadze` and the first material to the pick head's, or simply `/slayer bless` the one you have.
