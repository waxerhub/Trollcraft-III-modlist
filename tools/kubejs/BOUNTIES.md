# Bounties (add-on)

Players put **Hush Coins** on another player's head. Whoever kills that player collects the whole pot.

- **Pots stack:** everyone who places a bounty on the same player adds to one pot.
- **One part per placer:** you can have only one bounty on a given player until it's collected (or you cancel yours).
- **Any amount** from 1 up to the coins you carry. The pot is exactly what was placed; nothing is added.
- **Public pots, secret placers:** everyone sees "[WANTED] Bob - 37 Hush Coins on their head". Players never see who paid; ops can.
- **Any player who kills the target collects,** placers included. Deaths from mobs, falls and so on pay nothing.
- **Never expires.** Offline players can be targeted; the pot waits until someone kills them.
- **Cancelling:** you can withdraw your own part at any time before it's collected and get your coins back. Nobody is told; the pot just shrinks.
- **The faction link (rival bonus):** a killer from a rival faction gets a small bonus on top. See [Rival bonus](#rival-bonus).

## Files

| File | Where it goes | What it does |
|---|---|---|
| `server_scripts/economy/bounties.js` | `kubejs/server_scripts/economy/` | Bounties. All settings are at the top. |
| `server_scripts/economy/black_market.js` | `kubejs/server_scripts/economy/` | Needed: Hush Coins, the Hooded Merchant, and the shop window's bounty pages. |
| `server_scripts/factions/factions_core.js` | `kubejs/server_scripts/factions/` | Used for the rival bonus. Without it there's no bonus; everything else works. |
| `server_scripts/factions/portal_ambush.js` | `kubejs/server_scripts/factions/` | Used to skip Pig Escort deaths. |

Copy them and run `/reload`. Bounties are their own script so they keep working when the black market is closed (`/bm toggle`).

## Placing a bounty

- **Where:** at the Hooded Merchant (within 6 blocks), like every other black market trade.
  - While the black market is closed, or has no vendor spots, bounties can be placed and cancelled anywhere instead.
- **In the shop window:** click **Place a Bounty**, then a player's head, then an amount (see [The shop window](#the-shop-window)).
- **In chat:** `/bounty` lists players with amount buttons; `/bounty <player>` shows the amounts for one player; `/bounty <player> <amount>` places any amount.
- **Refused, with nothing taken:**
  - yourself;
  - a player the server has never seen;
  - less than 1, or more coins than you carry (main inventory and hotbar);
  - a player you already have a bounty on: "It stays until someone collects it (or you cancel it)."
- **When it's placed:** the coins are taken, and everyone online is told "[WANTED] *Bob* - *N* Hush Coins on their head." with the new pot. It's sent to each player, so it doesn't reach Discord. The placer is never named.

## Collecting

- **Pays out** when a **player** kills the target. The killer gets the pot (anything that doesn't fit drops at their feet), plus any rival bonus.
- Everyone online is told "[WANTED] *Alice* collected the *N*-coin bounty on *Bob*." The killer alone is told about a rival bonus.
- The bounty is then gone, so everyone can place on that player again.
- **No payout:** deaths with no player killer (mobs, contract mobs, falls, lava, `/kill`), killing yourself, and deaths during a Pig Escort. The pot stays.
- Totems of Undying: the player didn't die, so nothing is collected.

## Cancelling

- `/bounty cancel <player>`, the [CANCEL] button in `/bounty`, or in the window: the head of a player you have a bounty on says "Your bounty: N coins. Click to cancel it." and asks to confirm.
- Only your own part. Your coins come back, the pot drops by that much, and if nobody else has a part the bounty is removed.
- No announcement. You can place on that player again afterwards.
- Also at the merchant (or anywhere while the black market is closed).

## Rival bonus

When the killer and the target are both in a faction and in **different** factions, the killer gets extra coins on top of the pot. They're made new by the server, so they're limited (`RIVAL_BONUS`):
- **25%** of the pot, at most **10** coins, and only for a pot of at least **5**;
- never when the killer has a part in this bounty (no paying yourself a bonus);
- once per killer and target every **2 hours**, so two friends staging kills can't print coins;
- **secret factions:** no bonus when the target's faction is secret to the killer, since a bonus would give their membership away (`respectSecret`). With the default factions, the Syndicate is secret, so a Syndicate killer of a Crownsworn target gets the bonus, but not the other way round. Set `respectSecret: false` to pay it both ways (and accept the leak).
- No faction (Unregistered) on either side: no bonus.

## The shop window

In the merchant's window, the Contracts row has two more buttons:
- **Place a Bounty** (a wither skeleton skull): a page of player heads. Online players come first, then offline players the server knows (marked "offline"). Each head shows its current pot.
  - Click a head: the **amount page**. It shows the amounts you can afford (5, 10, 25, 50, 100) and "All *N*" for everything you carry. Click one to place it. The window goes back to the main page.
  - A head you already have a bounty on opens the **cancel page** instead: Cancel my bounty, or Keep it.
- **Wanted** (paper): every player with a price on their head, biggest pot first. Just to look at.

Without bounties.js the two buttons aren't shown.

## Commands

| Command | Who | |
|---|---|---|
| `/bounty` | players (at the merchant) | The chat picker: players, pots, amount or cancel buttons |
| `/bounty <player>` | players (at the merchant) | The amounts for one player |
| `/bounty <player> <amount>` | players (at the merchant) | Place a bounty |
| `/bounty cancel <player>` | players (at the merchant) | Withdraw your part and get it back |
| `/bounty list`, `/bounties` | anyone, anywhere | The pots. Ops also see who placed what. |
| `/bounty clear <player>` | op | Remove a bounty and give every placer their part back (offline placers get it on their next login) |
| `/bounty toggle` | op | Close or open bounties. While closed, pots are kept; nothing is placed or collected; cancelling still works. |
| `/bounty log` | op | The last placements, cancellations and collections, with placers |

## Settings (top of bounties.js)

| Setting | Default | |
|---|---|---|
| `PRESETS` | 5, 10, 25, 50, 100 | The amount buttons |
| `REQUIRE_MERCHANT` | true | Placing and cancelling at the merchant (only while the black market is open and has spots) |
| `ANNOUNCE` | true | Tell everyone when a pot grows or is collected |
| `RIVAL_BONUS` | on, 25%, max 10, pot ≥ 5, 120 min, respectSecret | See [Rival bonus](#rival-bonus) |

## Saved data

`persistentData["bounties"]`, one JSON string:
- the bounties (target, pot, each placer's name, amount and time);
- the players the server knows (for offline targets), filled at login and from the factions' member lists;
- refunds waiting for offline placers;
- rival-bonus cooldowns;
- the last 50 log lines.

It survives restarts and `/reload`.

## Test plan (three accounts in survival: A and C place, B is the target)

1. Give A and C some coins (`/coins give`). Go to the merchant.
2. A: window → Place a Bounty → B's head → 5. Everyone sees "[WANTED] B - 5 Hush Coins on their head"; A isn't named.
3. C: `/bounty B 10`. The pot is 15.
4. A: try 5 more on B: refused, no coins taken. Try more than A carries: refused.
5. A: walk away from the merchant and try `/bounty cancel B`: refused. Go back, cancel from the window: 5 coins back, pot 10, nobody told. Place again.
6. `/bounty list` as A: no names. As an op: who placed what.
7. Let a zombie kill B: no payout; the pot stays.
8. C kills B: C gets the pot, everyone is told, and the pot is gone. A can place on B again.
9. Rival bonus: with B in the Crownsworn and a Syndicate player D who hasn't placed, D kills B: the pot plus 25% (at most 10), told to D only. D kills B again within 2 hours: no bonus.
10. Place a bounty on an offline player from the window (they're after the online heads). They log in; someone kills them; it pays.
11. `/bounty clear B` as an op: everyone's part goes back (offline placers on login).
12. `/reload`: bounties are still there.

## What couldn't be verified for KubeJS 6 on 1.20.1

The mock-server test (shared with the black market, 235 checks) covers placing, stacking, every refusal, cancelling from chat and the window, the Wanted list, collecting, the deaths that don't pay, the Pig Escort, the rival bonus and each of its limits, offline targets, the op clear with offline refunds, `/reload`, the black market being closed, and `/bounty toggle`. These parts depend on the real game:
- `event.source.actual` being the killing player on a player's death (also used by the black market's contracts). Arrows and tridents count as the player who shot them.
- Offline names through `server.getProfileCache().get(name)`, and player heads showing skins for offline players (`SkullOwner` by name).
- Brigadier choosing `/bounty list`, `cancel`, `clear`, `toggle` and `log` over a player with that name (a player literally called "list" can still be targeted from the window).
