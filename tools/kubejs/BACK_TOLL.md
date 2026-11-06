# /back Toll

`server_scripts/back_toll.js` makes FTB Essentials' `/back` cost **2 Hush Coins** for players who aren't operators. The coins are destroyed (owner decision). `/back` after a death costs the same as `/back` after a teleport.

FTB Essentials still applies its own 5 s warmup and 30 s cooldown (`tools/serverconfig/ftbessentials.snbt`); the toll comes on top.

## How it works
1. **A player runs `/back`.**
   - With fewer than 2 coins, it's refused before FTB Essentials sees it: "/back costs 2 Hush Coins. You have 1."
   - Otherwise 2 coins are taken from their inventory, and they're told "2 Hush Coins paid for /back. (Given back if it doesn't happen.)" Then FTB Essentials runs the command as usual.
2. **The coins come back if no teleport happens.** FTB Essentials can still turn `/back` down after the coins are taken: on cooldown, nothing to go back to, or the warmup broken by moving or being hurt.
   - For 8 seconds (the warmup + 3 s) the player is looked at every half second.
   - A change of dimension, or a jump of more than 32 blocks between two looks, counts as the teleport.
   - If neither happens, the 2 coins are given back: "/back didn't happen: your 2 Hush Coins are back."
   - A `/back` to somewhere within 32 blocks is refunded too (in the player's favour).
3. **One at a time.** A second `/back` while the first is still being watched is refused ("Your last /back is still on its way."), so spamming it can't charge twice.
4. **Logging out while waiting** saves the refund. It's given back at the next login.

**Who pays nothing:**
- operators (permission level 2), the console and command blocks;
- everyone, if `economy/black_market.js` isn't installed. Its coins are needed, and one warning is logged.

Messages go only to the player (never `tellraw @a`). The server log gets one `[BackToll]` line per charge, refund and logout.

## Settings (top of back_toll.js)
| Setting | Default | Meaning |
|---|---|---|
| `PRICE` | 2 | Hush Coins per `/back` |
| `COMMAND` | `'back'` | The command that's charged |
| `WARMUP_SECONDS` | 5 | FTB Essentials' `back.warmup`; keep the two in step |
| `CHECK_SECONDS` | warmup + 3 | How long to wait for the teleport before refunding |
| `SAMPLE_TICKS` | 10 | How often the player is looked at while waiting |
| `JUMP_BLOCKS` | 32 | A move this far between two looks is the teleport (elytra flight and horses stay under it) |
| `EXEMPT_OPS` | true | Operators pay nothing |
| `DATA_KEY` | `back_toll` | `server.persistentData` key for refunds owed to players who logged out while waiting |

## Install
Copy `back_toll.js` to `kubejs/server_scripts/` next to `black_market.js` and run `/reload`. It works in Part I and Part II.

## Test plan (a player account and an op)
1. **Not enough coins:** with 1 Hush Coin, `/back`: refused with the price, nothing taken, no teleport.
2. **Paid:** with 3 coins and somewhere to go back to, `/back`: 2 coins taken, then the teleport after 5 s, and no refund.
3. **On cooldown:** `/back` again within 30 s: 2 coins taken, FTB Essentials refuses, and 8 s later the coins come back.
4. **Warmup broken:** `/back`, then walk away during the 5 s: refunded after 8 s.
5. **Spam:** `/back` twice quickly: the second is refused, and only 2 coins are taken.
6. **Logout:** `/back`, then disconnect at once: no coins lost. Log back in and they're returned with a message.
7. **Op:** `/back` as an op: no charge, no message.
8. **Console:** `[BackToll]` lines for each of the above.

## What couldn't be verified
- That KubeJS 6's `ServerEvents.command('back', …)` sees FTB Essentials' `/back` under that name. Test 1 shows it at once: if `/back` isn't refused with 1 coin, the event isn't firing.
- What FTB Essentials does with the warmup when the player moves or is hurt. Whatever it does, a `/back` that doesn't teleport is refunded.
- `/reload` during the 8-second wait drops that player's check, so those 2 coins aren't refunded. It's rare; an op can give them back with `/coins give`.
