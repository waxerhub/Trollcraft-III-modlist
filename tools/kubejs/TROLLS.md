# The Troll Log and the Blood Pool

Every troll is logged, scored and paid, and its blood goes into the **Blood Pool**. When the pool is full, the Blood Gate to the new world can open (Protocol Clean Slate, see [STORY.md](../../STORY.md)).

## Files

| File | Where it goes | What it does |
|---|---|---|
| `server_scripts/economy/trolls.js` | `kubejs/server_scripts/economy/` | The Troll Log and the Blood Pool. Settings are at the top. |
| `server_scripts/economy/black_market.js` | `kubejs/server_scripts/economy/` | Needed: logs its trolls here, and pays the coins. |
| `server_scripts/factions/factions_core.js` | (already installed) | For the cross-faction bonus. Without it there's no bonus. |

Copy them and run `/reload`.

## What gets logged
**Automatically,** by the black market:

| Troll | When | Points | Hush Coins |
|---|---|---|---|
| Anonymous Summons | delivered | 50 | 1 |
| Cursed Food | eaten (by someone other than its buyer) | 100 + 25 per curse | 2 |
| Mimic Chest | opened by someone other than its owner | 150 | 3 |
| Homing Pig | reaches the target's bed (once per pig) | 150 | 5 |
| Teleport Trap | sprung by someone other than its owner | 200 | 5 |
| Disguised TNT | sprung by someone other than its owner | 250 | 6 |

- **Payouts are about a quarter of the item's price,** so two friends can't print coins by trolling each other.
- **Cursed Food bought before this update** doesn't know its buyer, so it isn't logged when eaten.

**By report:** Butterfingers, Itching Powder, and anything creative the game can't see.
1. The troller files `/troll report <victim> <what they did>`, and the ops online are told.
2. Witnesses back it: `/troll witness <number>`. The troller and the victim can't.
3. An op looks at `/troll pending` and decides: `/troll approve <number> <points>` or `/troll deny <number>`.
   - An approved report counts at the full points the op gave, and pays 1 coin per 100 points.

## The rules
- **Nothing counts** for trolling yourself, an AFK player, or a player on the same IP (alts).
- **The same troller and victim within 24 hours:** the second troll counts half, the third and later a quarter, and the coins shrink the same way.
- **Revenge:** a victim who trolls their troller back within 24 hours scores double.
- **Cross-faction bonus:** trolling someone of the other faction puts **50% more blood into the pool**. It's never shown in anyone's points, so no score can give away who's in the (secret) Syndicate.
- **Good sport:** the victim gets 10% of the points as their own score (no coins).
- **Anonymity:** the troller is told "Troll logged: …". The victim isn't told who did it. In `/trolls log`, players see "someone → Bo", and only ops see names.
- **Offline trollers** (a trap sprung while its owner is away) get their coins at their next login.

## The Blood Pool
- **Every logged troll** adds its points (with the cross-faction bonus) as Drops of Blood.
- **Hush Coins can be donated:** `/bloodpool donate <coins>`, at 1,000 Drops per coin.
- **The quota:** 100,000 Drops (`POOL.exodusQuota`).
- **Milestones:** at 25, 50, 75 and 100%, everyone gets a `[SIGNAL HIJACKED]` line. At 100% the ops are also told that the Blood Gate can open.
- **The Blood Gate itself** is part of Protocol Clean Slate (the next batch). Other scripts check `global.Trolls.poolFull()`.

## The weekly recap
Every 7 days the Ministry sums up: "This week, N incidents of Unlicensed Humour were recorded (P points of damage to public order). The Ministry is not amused. The Ministry is never amused."

## Commands

| Command | Who | |
|---|---|---|
| `/trolls` or `/trolls me` | anyone | Your points, trolls, times trolled, coins earned and donated, and your last 5 trolls |
| `/trolls log` | anyone | The last 10 trolls (anonymous for players) |
| `/trolls top` | anyone | The leaderboard |
| `/troll report <victim> <what>`, `/troll witness <n>` | players | Reports |
| `/troll pending`, `/troll approve <n> <points>`, `/troll deny <n>` | op | Judging reports |
| `/bloodpool` | anyone | How full the pool is |
| `/bloodpool donate <coins>` | players | Give Hush Coins to the pool |
| `/bloodpool add <drops>`, `/bloodpool set <drops>` | op | Adjust it (set also re-arms milestones below the new level) |

## Settings (top of trolls.js)

| Setting | Default | |
|---|---|---|
| `TROLL_TYPES` | as in the table above | Points and coins per troll; `perCurse` for Cursed Food; `coinsPer100` for reports |
| `CROSS_FACTION_BONUS` | 1.5 | Extra blood for trolling the other faction |
| `REVENGE` | ×2 within 24 h | |
| `REPEAT` | 24 h: 1, 0.5, 0.25 | The same victim again |
| `GOOD_SPORT` | 0.1 | The victim's share |
| `SKIP_AFK`, `SKIP_SAME_IP` | true | |
| `POOL` | 1,000 Drops per coin, quota 100,000, milestones 25/50/75/100 | |
| `REPORT` | 1 witness, 120 characters, closed reports kept 14 days | |
| `RECAP_DAYS` | 7 | |

## Saved data
`persistentData["trolls"]`: the last 500 trolls, each player's totals, reports, the pool, the 24-hour history, coins owed, and the week's count. It survives restarts and `/reload`.

## Test plan (three players: A Syndicate, B Crownsworn, C anyone)
1. A sends B an Anonymous Summons: A is told "+50 points, +1 Hush Coin"; B isn't told who. `/bloodpool` rises by 75 (the cross-faction bonus).
2. A sends B two more: 25, then 13 points.
3. B sends A one: revenge, double.
4. A buys a cursed steak and C eats it: logged A → C.
5. B places a Mimic Chest and C opens it: logged B → C.
6. A: `/troll report B <what>`; C: `/troll witness 1`; an op: `/troll approve 1 300`.
7. `/trolls log` as C (anonymous) and as an op (names); `/trolls top`; `/trolls me`.
8. `/bloodpool donate 5`; an op: `/bloodpool add 100000`. Everyone sees the milestones.

## What couldn't be verified for KubeJS 6 on 1.20.1
A mock-server test passed all 47 checks for this script and story.js:
- logging summons, cursed food (with and without a buyer) and Mimic Chests;
- self, alt (same IP) and offline payouts;
- diminishing returns and revenge;
- the hidden cross-faction bonus;
- reports from filing to approval and denial;
- anonymity in the log, the leaderboard;
- donations, milestones, the weekly recap, and `/reload`.

The TNT, Teleport Trap and Homing Pig hooks are one line each, in the same places that already log those traps.

These depend on the real game:
- **AFK detection:** `player.getIpAddress()` for the same-IP rule, and the black market's AFK sampling.
- **Cursed Food:** `ItemEvents.foodEaten` still carrying the buyer's tag.
