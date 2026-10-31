# Story commands: acts and decrees

`story.js` runs Part I's acts and the Ministry's decrees. The story itself is in [STORY.md](../../STORY.md).

## Files

| File | Where it goes | What it does |
|---|---|---|
| `server_scripts/story.js` | `kubejs/server_scripts/` | Acts and decrees. Settings, act texts and decree presets are at the top. |

Copy it, run `/reload`, then run **`/story act set prologue`** once.

## Acts
Acts only move forward when an op says so.

| Act | id | Title / subtitle |
|---|---|---|
| Prologue | `prologue` | TROLLCRAFT III / Managed Trollocracy |
| Act II: Inspections | `act2` | ACT II / Inspections |
| Act III: The Loyalty Audit | `act3` | ACT III / The Loyalty Audit |
| Act IV: The End Lockdown | `act4` | ACT IV / The End Lockdown |
| Protocol Clean Slate | `finale` | PROTOCOL / CLEAN SLATE |

**Starting an act:**
- everyone gets the full-screen title and a raid horn;
- 4 seconds apart come the Ministry's opening lines, then the `[SIGNAL HIJACKED]` reply;
- edit `ACTS` to change any of it.

`global.Story.act()` and `global.Story.isAtLeast(id)` let other scripts (the Scout, the Archives, Clean Slate) check the act.

## Decrees
**Announcements only.** A decree is a numbered Ministry proclamation, starting at #41 "for continuity".
- **Announcing:** each one comes with a bell, and `/decrees` lists those in force for everyone.
- **Nothing is blocked by code.** Breaking a decree is something Enforcers can charge with `/accuse <player> Violation of Decree #41`.

**Presets** (`/story decree preset <id>`):

| id | Decree |
|---|---|
| `licence_act` | The Trolling Licence Act: all pranks require a permit. Permits are not available. |
| `chests_north` | All chests must face north. |
| `floor_safety` | The Mandatory Floor Safety Initiative. Questions are a known trip hazard. |
| `technoblade_phrase` | "Technoblade never dies" is under investigation under the Sanctity of Swine Act. |
| `end_lockdown` | The End Lockdown Initiative. There is nothing in the End. |
| `swine_dignity` | The Swine Dignity Fee. |
| `prayer_tax` | All prayer is taxed, in triplicate. |
| `mandatory_fun` | Mandatory Fun Day. Unapproved fun will be confiscated. |

Revoking one announces "Decree #n has been overturned. It was never issued."

## Commands

| Command | Who | |
|---|---|---|
| `/decrees` | anyone | The decrees in force |
| `/story status` | op | The act, since when, what's next, and how many decrees are in force |
| `/story act next`, `/story act set <id>` | op | Start the next act or a given one (announced) |
| `/story act replay` | op | Announce the current act again |
| `/story decree issue <text>` | op | A new decree |
| `/story decree preset <id>` | op | A ready-made decree |
| `/story decree revoke <n>` | op | Overturn a decree |
| `/story decree list` | op | Every decree, overturned ones included, with date and issuer |

## Settings (top of story.js)

| Setting | Default | |
|---|---|---|
| `TO_DISCORD` | true | Act lines and decrees go out with `tellraw @a`, so Simple Discord Link posts them. false = in game only. They're public propaganda: never put anything secret in them. |
| `DECREE_START` | 41 | The first decree's number |
| `ACTS` | five acts | Ids, names, titles, opening lines |
| `LINE_GAP_SECONDS` | 4 | Between opening lines |
| `DECREE_PRESETS` | eight | |

## Saved data
`persistentData["story"]`: the act, when it started, the history of act changes, and every decree.

## What couldn't be verified for KubeJS 6 on 1.20.1
The mock-server test (shared with trolls.js) covers:
- acts: setting, next, unknown ids, status, op-only, and the titles and lines;
- decrees: presets, issue, revoke, and `/decrees`;
- `/reload`.

In game, check that `title @a` and `tellraw @a` from the server show as expected and reach Discord.
