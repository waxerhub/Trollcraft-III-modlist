# Boss Blood (Part II)

Killing a Twilight Forest boss pays Drops of Blood into the Blood Pool. The harder the boss, the more it pays. The
ranking is the same one the boss chests use (`part2/twilight_bosses.js`, see `TWILIGHT_BOSSES.md`).

## Files

- `tools/kubejs/server_scripts/part2/boss_blood.js` → `<server>/kubejs/server_scripts/part2/`, then `/reload`.
  It needs `part2/blood_pool.js` (`global.BloodPool`). Without it, kills pay nothing and the log says so once.
- Tests: `tools/tests/suites/boss_blood.test.js`.

## What each boss pays

Each rank pays about a quarter more than the one before. The two ends stayed where they were: 200 for the Naga and
1,000 for the Snow Queen.

| Rank | Boss | Drops | Before | Why it sits here |
|---|---|---|---|---|
| I | Naga | 200 | 200 | 120 health; it charges and bites, with no ranged attack |
| II | Minoshroom | 250 | 350 | Axe charges at the end of the Labyrinth |
| III | Alpha Yeti | 300 | 800 | 200 health; it throws you, but it's slow, and you reach it straight after the Lich |
| IV | Lich | 400 | 300 | Shields, then shadow clones and minions, then melee: harder in play than II and III |
| V | Knight Phantoms | 500 | 400 | Six armoured knights with knightmetal weapons, fighting in formations |
| VI | Hydra | 650 | 600 | The most health (360); only its heads take damage, and they breathe fire |
| VII | Ur-Ghast | 800 | 600 | It flies out of reach at the top of the Dark Tower, so you need the ghast traps |
| VIII | Snow Queen | 1,000 | 1,000 | The hardest hits (7 damage), ice shields, and flying |

All eight once each come to 4,100 Drops (4,250 before).

**Why the order changed:** the old ladder tried to follow Twilight Forest's progression, but put the Alpha Yeti fourth.
In fact it's reached straight after the Lich, so it paid more than the Hydra. TF's real order is the Naga, then the
Lich, then three branches: the Minoshroom then the Hydra, the Knight Phantoms then the Ur-Ghast, and the Alpha Yeti
then the Snow Queen. Since the branches can be done in any order, reward by difficulty, not by progression. Ranks II–IV
come from play on the server: the Lich proved harder than the Minoshroom and the Alpha Yeti.

**For scale:** Tier 1 opens at 20,000 Drops, and the Potato Tithe can add up to 30,000 a day. A boss is a bonus on
top of the Pool's main sources. Its chest also holds potato crates, which can be tithed at 4 potatoes per Drop.

## Who gets the credit

- **The Pool** gets the full amount, recorded as source `boss`.
- **The credit** on `/bloodpool top` is split equally among the fighters: survival players within `FIGHTER_RADIUS` (64)
  blocks, in the same dimension, when the boss dies. The killer, if one of them, also takes what's left over from
  the split.
- **The announcement** goes to every player online with `player.tell`, never `tellraw @a`.

## What doesn't pay

- **Lich clones:** the Lich's shadow clones. Only the real Lich pays.
- **Knight Phantoms before the last:** they come six to a group, and the group pays once, when the last one dies.
  That's the same moment TF places their chest.
- **`/kill` and the void.**
- **A boss with no survival player nearby.**
- **Minions:** they have their own entity ids.

## Commands

- `/bossblood` (anyone): the eight bosses in rank order, what each pays and what each has paid so far.
- `/bossblood log` (op): the last 20 kills, with who shared each.

## Settings (top of `boss_blood.js`)

- `BOSSES`: `drops` and `rank` per boss. Keep `rank` in the same order as `BOSSES` in `twilight_bosses.js`; a test checks
  that.
- `FIGHTER_RADIUS`, `NO_PAY_DAMAGE`, `ANNOUNCE`, `LOG_SIZE`.
- `DATA_KEY` (`boss_blood`): where the kill counts and the log are saved. Don't change it on a live server.

## Test plan (an op and a player)

1. `/bossblood`: eight rows, I. Naga 200 to VIII. Snow Queen 1,000.
2. As the player, in survival, stand near `/summon twilightforest:naga ~ ~ ~5` and kill it. The Pool rises by 200,
   and everyone online sees the Blood God's line.
3. Kill one with `/kill @e[type=twilightforest:naga]`: nothing is paid.
4. `/bossblood log` shows the first kill.

## What couldn't be verified

- **In game with a player:** the rebalance wasn't run in game with a player, because the test server had no player
  online. The tests cover the payments, the split, Lich clones, the Knight Phantom group, `/kill` and the listing.
- **Balance:** whether the amounts feel right on the live server. Adjust `drops` in `BOSSES`.
