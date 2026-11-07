# Boss Blood (Part II)

`server_scripts/part2/boss_blood.js` turns Twilight Forest boss kills into Drops of Blood for the [Blood Pool](BLOOD_POOL.md). It needs `part2/blood_pool.js`.

## The reward ladder
In Twilight Forest's progression order (owner decision):

| Rung | Boss | Drops |
|---|---|---|
| I | Naga | 200 |
| I | Lich | 300 |
| II | Minoshroom | 350 |
| II | Knight Phantoms (the whole group of six) | 400 |
| III | Hydra | 600 |
| III | Ur-Ghast | 600 |
| IV | Alpha Yeti | 800 |
| IV | Snow Queen | 1,000 |

- **Every kill pays the full amount** (owner decision). Each boss guards its own structure, so exploring is the limit.
- **For scale:** a full Twilight Forest run is worth 4,250 Drops, and Blood Pool Tier 1 needs 20,000. Boss blood is a bonus beside trolls, coins and the tithe.

## How a kill is counted
- **Who gets credit.** The **Pool** gets the full amount. The **credit** on `/bloodpool top` is split equally among the **fighters**:
  - fighters are the players in survival or adventure, in the same dimension, within 64 blocks when the boss dies;
  - an uneven split's remainder goes to the killer (e.g. 350 between three: 118, 116, 116).
- **No fighters, no blood.** A boss killed by other mobs, or cleared by an op in creative, pays nothing. So does a boss that dies to `/kill` or the void.
- **The Lich:** its shadow clones are also `twilightforest:lich`, but only the real Lich pays. Shadow clones are recognised by Twilight Forest's `isShadowClone()`, or the `ShadowClone` NBT flag.
- **Knight Phantoms:** the group pays once, when the last one dies (no other living Knight Phantom within 64 blocks). That's when Twilight Forest drops its treasure chest.
- **The announcement:** every player online is told in the Blood God's voice, e.g. "**[BLOOD GOD]** The Naga has fallen to Ana and Bo. +200 Drops of Blood." It's sent to each player (`player.tell`), not with `tellraw @a`, so it doesn't go to Discord.
- **The Blood Pool's usual "Tier N is ready" message** still fires when a kill takes the Pool over a threshold.

## Commands
| Command | Who | What it does |
|---|---|---|
| `/bossblood` | anyone | The ladder, with how often each boss has been slain and its Drops so far |
| `/bossblood log` | op | The last 20 paid kills: time, boss, Drops, fighters |

## Settings (top of boss_blood.js)
| Setting | Default | Meaning |
|---|---|---|
| `BOSSES` | the ladder above | Entity id → name, Drops, rung |
| `FIGHTER_RADIUS` | 64 | How close a player must be to share the credit |
| `NO_PAY_DAMAGE` | `genericKill`, `outOfWorld` | Deaths that pay nothing (`/kill`, the void) |
| `ANNOUNCE` | true | Tell every player online |
| `LOG_SIZE` | 20 | Kills kept for `/bossblood log` |

**Saved data:** `server.persistentData["boss_blood"]` holds kills and Drops per boss, plus the log. Unreadable data is kept under `boss_blood_unreadable_<time>`.

**API:** `global.BossBlood = { bosses, stats() }`.

## Install
Copy `boss_blood.js` to `kubejs/server_scripts/part2/` (next to `blood_pool.js`) and run `/reload`.

## Test plan (two survival players and an op)
1. **Naga:** A and B kill a Naga together. Both see the Blood God line, `/bloodpool` rises by 200, and `/bloodpool top` shows 100 each.
2. **Lich:** kill a Lich. One payment of 300, none for its shadow clones.
3. **Knight Phantoms:** clear a Knight Stronghold's six. Nothing until the last one dies, then 400 once.
4. **`/kill`:** `/kill @e[type=twilightforest:naga]` near a Naga pays nothing.
5. **Creative op alone:** an op in creative kills a boss alone. Nothing paid.
6. **`/bossblood`** shows the counts, and `/bossblood log` (op) lists the kills.

## What couldn't be verified
- **The shadow clone check:** that Rhino can call the Lich's `isShadowClone()`. If not, the NBT check is the fallback. Test 2 shows whether clones are skipped.
- **Damage-type ids:** that `/kill` and the void report `genericKill` and `outOfWorld` through KubeJS on 1.20.1. These are the same ids `black_market.js` already uses.
- **Spread-out Knight Phantoms:** a group more than 64 blocks apart could pay twice. Twilight Forest uses the same 64-block range for its own "last knight" check.
- **Bosses from other mods** (e.g. Mowzie's Mobs, Ice and Fire, Alex's Caves) aren't on the ladder yet. Each one is a single line in `BOSSES`.
