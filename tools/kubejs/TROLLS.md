# The Troll Log

Every troll is logged, scored and paid.

**The Blood Pool is saved for Part II's progression lock tree** (see [STORY.md](../../STORY.md)), so it isn't in Part I. Each player's lifetime points are kept, and trolls on the other faction are marked (hidden), so Part II can build its pool from them. An earlier copy of the pool in saved data is left untouched.

## Files

| File | Where it goes | What it does |
|---|---|---|
| `server_scripts/economy/trolls.js` | `kubejs/server_scripts/economy/` | The Troll Log. Settings are at the top. |
| `server_scripts/economy/black_market.js` | `kubejs/server_scripts/economy/` | Needed: logs its trolls here, and pays the coins. |
| `server_scripts/factions/factions_core.js` | (already installed) | To mark cross-faction trolls. Without it nothing is marked. |

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
- **Nothing counts** for trolling yourself, a player who has been AFK (not moving or turning) for 5 minutes, or a player on the same internet connection (alts).
  - The troller is told why, for example "Disguised TNT on Bo not counted: Bo has been AFK (not moving) for a few minutes." (`TELL_SKIPS`).
  - **Testing with a second account on your own connection never counts.** Test with someone on another connection, or set `SKIP_SAME_IP = false` for the test (and for good, if players share a house).
- **The same troller and victim within 24 hours:** the second troll counts half, the third and later a quarter, and the coins shrink the same way.
- **Revenge:** a victim who trolls their troller back within 24 hours scores double.
- **Cross-faction trolls** are marked in the log (`cross: true`), for Part II's Blood Pool bonus. The mark is never shown, so nothing can give away who's in the (secret) Syndicate.
- **Good sport:** the victim gets 10% of the points as their own score (no coins).
- **Anonymity:** the troller is told "Troll logged: …". The victim isn't told who did it. In `/trolls log`, players see "someone → Bo", and only ops see names.
- **Offline trollers** (a trap sprung while its owner is away) get their coins at their next login.

## The weekly recap
Every 7 days the Ministry sums up: "This week, N incidents of Unlicensed Humour were recorded (P points of damage to public order). The Ministry is not amused. The Ministry is never amused."

## Commands

| Command | Who | |
|---|---|---|
| `/trolls` or `/trolls me` | anyone | Your points, trolls, times trolled, coins earned, and your last 5 trolls |
| `/trolls log` | anyone | The last 10 trolls (anonymous for players) |
| `/trolls top` | anyone | The leaderboard |
| `/troll report <victim> <what>`, `/troll witness <n>` | players | Reports |
| `/troll pending`, `/troll approve <n> <points>`, `/troll deny <n>` | op | Judging reports |
| `/trolls check` | op | Troubleshooting: whether the black market is connected (and not an old version), who online is AFK, who shares a connection (names only, never addresses), the last 10 trolls that didn't count and why, and how many are logged |

## Settings (top of trolls.js)

| Setting | Default | |
|---|---|---|
| `TROLL_TYPES` | as in the table above | Points and coins per troll; `perCurse` for Cursed Food; `coinsPer100` for reports |
| `REVENGE` | ×2 within 24 h | |
| `REPEAT` | 24 h: 1, 0.5, 0.25 | The same victim again |
| `GOOD_SPORT` | 0.1 | The victim's share |
| `SKIP_AFK`, `SKIP_SAME_IP` | true | Set `SKIP_SAME_IP = false` if real players share a connection |
| `TELL_SKIPS` | true | Tell the troller when a troll doesn't count |
| `REPORT` | 1 witness, 120 characters, closed reports kept 14 days | |
| `RECAP_DAYS` | 7 | |

## Saved data
`persistentData["trolls"]`: the last 500 trolls, each player's totals, reports, the 24-hour history, coins owed, and the week's count. It survives restarts and `/reload`.

## When trolls aren't being logged
Run `/trolls check` as an op.
- **"Black market: NOT LOADED" or "an OLD version":** upload the new `economy/black_market.js` and `/reload`. Only the new one sends trolls to the log.
- **The troll is in "Not counted lately":** the reason is given. If it says `afk`, the victim must have moved in the last 5 minutes. If it says `same connection`, use players on different connections, or set `SKIP_SAME_IP = false`.
- **Nothing at all, and the black market is connected:** the troll never reached the log. Send me the server log lines with `[BlackMarket]` or `[Trolls]`.

Cursed Food bought before the new black market was installed has no buyer recorded, so eating it is never logged.

## Test plan (three players: A Syndicate, B Crownsworn, C anyone, all on different connections, all moving)
1. A sends B an Anonymous Summons: A is told "+50 points, +1 Hush Coin"; B isn't told who. The log entry is marked `cross` (only visible in the saved data).
2. A sends B two more: 25, then 13 points.
3. B sends A one: revenge, double.
4. A buys a cursed steak and C eats it: logged A → C.
5. B places a Mimic Chest and C opens it: logged B → C.
6. A: `/troll report B <what>`; C: `/troll witness 1`; an op: `/troll approve 1 300`.
7. `/trolls log` as C (anonymous) and as an op (names); `/trolls top`; `/trolls me`.

## What couldn't be verified for KubeJS 6 on 1.20.1
A mock-server test passed all 47 checks for this script and story.js:
- logging summons, cursed food (with and without a buyer) and Mimic Chests;
- self, alt (same IP) and AFK refusals, each explained to the troller, and `/trolls check` (including spotting an old black market);
- offline payouts;
- diminishing returns and revenge;
- the hidden cross-faction mark;
- reports from filing to approval and denial;
- anonymity in the log, the leaderboard;
- `/bloodpool` being gone, the weekly recap, and `/reload`.

The TNT, Teleport Trap and Homing Pig hooks are one line each, in the same places that already log those traps.

These depend on the real game:
- **AFK detection:** `player.getIpAddress()` for the same-IP rule, and the black market's AFK sampling.
- **Cursed Food:** `ItemEvents.foodEaten` still carrying the buyer's tag.
