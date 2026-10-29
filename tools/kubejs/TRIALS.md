# Trials (add-on)

The Ministry's court:
- **Judges** file charges against players and rule on them.
- Everything ends up on the accused's **permanent record**, which anyone can read.
- A verdict is only recorded and announced. Any punishment (jail, a fine, a smiting) is handed out by hand.

## Files

| File | Where it goes | What it does |
|---|---|---|
| `server_scripts/factions/trials.js` | `kubejs/server_scripts/factions/` | The court. Settings are at the top. |
| `server_scripts/factions/factions_core.js` | `kubejs/server_scripts/factions/` | Used for the judges' rank. Without it, only ops are judges. |
| `server_scripts/economy/black_market.js` | `kubejs/server_scripts/economy/` | Used for the Certified Alibi (it sells it and keeps the serial numbers) and for the Homing Pig's automatic charges. |

Copy them and run `/reload`.

## Who's a judge

- **Ops**, and Crownsworn members (faction `ministry`) ranked **Enforcer or Minister** (`JUDGES`).
- The rank is checked every time, so a demoted Enforcer stops being a judge at once.
- The console and command blocks count as judges.
- **Nobody rules on a charge against themselves,** ops included.

## Charges

- **Filing:** `/accuse <player> <charge>`, for example `/accuse Bob Unlicensed standing near the Ministry`.
  - It gets the next number (#1, #2, …), which never repeats.
  - Everyone online is told: "[MINISTRY] Charge #N filed against Bob: … Filed by *Enforcer*."
  - Bob is told "You stand accused (#N): …".
  - Offline players the server knows can be charged; they're told when they next log in.
  - Up to 120 characters; you can't accuse yourself.
- **Automatic charges:** hurting a Homing Pig from the black market files "Violation of the Sanctity of Swine Act (struck a Homing Pig)", filed by The Ministry (once per pig per offender).
- **Ruling** (judges): everyone online is told, with a gavel sound, and the accused gets it on their next login if they're away.
  - `/trial guilty <#> [note]`: GUILTY, with a Ministry line ("The Ministry has never lost a trial.").
  - `/trial acquit <#> [note]`: ACQUITTED ("The Ministry regrets the inconvenience to itself.").
  - `/trial drop <#>`: withdrawn (filed by mistake). It stays on the record as withdrawn.
  - A closed charge can't be ruled on again.
- **The Certified Alibi:** bought from the Hooded Merchant (50 coins).
  - The accused right-clicks it to see their open charges with [USE] buttons, or types `/trial alibi <#>`.
  - The charge is dismissed ("alibi certified"), announced, and the paper is used up.
  - It only works on an **open** charge of your own, never after a verdict.
  - Each alibi has a serial number on record, so copies and forgeries are refused. See [BLACK_MARKET.md](BLACK_MARKET.md#tracking-and-alibis).

All announcements are sent to each player with `player.tell`, so they don't reach Discord.

## Commands

| Command | Who | |
|---|---|---|
| `/accuse <player> <charge>` | judges | File a charge |
| `/charges [player]` | anyone | Open charges (your own without a name) |
| `/record [player]` | anyone | The permanent record: every charge and how it ended, newest first (15 lines) |
| `/trial docket` | judges | Every open charge |
| `/trial guilty <#> [note]`, `/trial acquit <#> [note]`, `/trial drop <#>` | judges | Rule on a charge |
| `/trial alibi [#]` | the accused | Use a Certified Alibi (without a number: the list of your open charges) |
| `/trial log` | op | The last 15 things that happened (100 are kept) |

## Settings (top of trials.js)

| Setting | Default | |
|---|---|---|
| `JUDGES` | `ministry`, Enforcer | The faction and the lowest rank that can judge |
| `ANNOUNCE` | true | Tell everyone online about charges, verdicts and dismissals |
| `MAX_CHARGE_LENGTH` | 120 | |
| `RECORD_LINES` | 15 | How much `/record` shows |
| `GUILTY_LINES`, `ACQUIT_LINES` | | The Ministry's comments, picked at random |

## Saved data

`persistentData["trials"]`, one JSON string:
- every charge (accused, text, who filed it and when, status, who ruled and their note);
- the next charge number;
- the players the server knows (for offline charges);
- messages waiting for the next login;
- the last 100 log lines.

Records are permanent: nothing is pruned. It survives restarts and `/reload`.

## Test plan (an op, Enforcer E, Loyalist L and player P)

1. As L: `/accuse P Testing`: refused ("Only Enforcers and above").
2. As E: `/accuse P Loitering`: everyone sees charge #1; P is told.
3. As E: `/accuse E Anything`: refused (yourself).
4. P: `/charges`: #1 is listed. Anyone: `/charges P`.
5. As P: `/trial guilty 1`: refused.
6. Op: `/accuse E Overreach`. As E: `/trial acquit 2`: refused (own charge). Op: `/trial acquit 2`: ACQUITTED, announced.
7. As E: `/trial guilty 1 first offence`: GUILTY with the note; `/record P` shows it.
8. Log P out, `/accuse P Absence` as E, then log P in: P is told on login.
9. P buys a Certified Alibi, right-clicks it, clicks [USE] on #3: dismissed, the paper is gone. A second copy of it is refused.
10. Hit a Homing Pig as P: a Sanctity of Swine Act charge appears in `/trial docket`.
11. `/reload`: `/record P` is unchanged.

## What couldn't be verified for KubeJS 6 on 1.20.1

The mock-server test (with the black market, 84 checks for tracking and trials) covers:
- filing, the judge checks and ruling on your own charges;
- every verdict, the docket, records and offline notices;
- the alibi: using it, copies, forgeries, verdicts and other people's charges;
- the Homing Pig charge, and `/reload`.

These depend on the real game:
- **`/accuse`:** Brigadier's greedy string argument taking the rest of the line as the charge.
- **Command names:** no other mod in the pack registering `/record`, `/charges`, `/accuse` or `/trial` (the last one loaded would win).
- **Judges:** `global.Factions.hasRankAtLeast(player, 'Enforcer', 'ministry')` for the rank check.
