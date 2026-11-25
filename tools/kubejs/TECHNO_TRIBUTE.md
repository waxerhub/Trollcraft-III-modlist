# Techno Tribute

A pack of short tributes to Technoblade for ops to run. **Nothing is permanent:**
- no blocks are placed and nothing goes into anyone's inventory;
- every pig, display and rocket the script spawns is removed by the script;
- anything left over after a `/reload` or restart is removed as its chunk loads;
- the weather is put back after the storm.

**Install:** copy `server_scripts/techno_tribute.js` to `kubejs/server_scripts/` and run `/reload`.

## Commands (op level 2)

`[targets]` is any selector: `@a`, `@p` or a player name. Without one, the tribute plays for you. Each targeted player gets their own show, up to 10 players per command (`MAX_TARGETS`).

| Command | What happens |
|---|---|
| `/techno face [targets] [small\|normal\|huge]` | A firework rocket goes up about 12 blocks in front of each player and bursts into Technoblade's face (a pink pig with a gold crown) drawn in coloured particles. It hangs for about 3 s, facing the player. Sizes: about 5, 8 or 13 blocks across. |
| `/techno crown [targets]` | A golden crown with a red jewel floats over each player's head for 30 s. |
| `/techno parade [targets]` | 8 glowing "♛ Technoblade" pigs in a ring around each player, oinking. They're invulnerable and drop nothing, and they vanish in a puff of smoke after 30 s. |
| `/techno blood [targets]` | "BLOOD FOR THE BLOOD GOD" title (subtitle "Technoblade never dies"), a red particle storm for 10 s and visual-only lightning (no damage, no fire). In the Overworld, a 10 s thunderstorm, after which the weather goes back to what it was. |
| `/techno potatoes [targets]` | Baked potatoes rain down around each player for 10 s. They're item displays, not items, so nobody (not even a hopper) can pick them up, and each one disappears when it lands. |
| `/techno quote [targets]` | "Technoblade never dies." with "If you wish to defeat me, train for another hundred years." floats in front of each player for 20 s. |
| `/techno all [targets]` | The full show in order: blood, crown, parade, potatoes, quote, then three face fireworks, the last one huge. About 20 seconds. |
| `/techno stop` | Ends everything at once, removes anything still out, and puts the weather back. |

Command blocks and the console have no player of their own, so give them targets: `/techno all @a`.

## Changing it

The settings are at the top of the script:
- the face pixel art (`FACE`: one character per pixel, `.` = blank) and its colours (`COLOURS`, 0–255 RGB);
- sizes, timings, the number of pigs, the potato radius and the quote text.

## Load

- **Face:** about 190 coloured pixels, redrawn 15 times, so roughly 2,900 particle commands over 3 s per player.
- **Everything else** is lighter.
- **Large groups:** fine for occasional use. For big groups, prefer `@a` over running it several times.

## Not verified on a real server

A mock-server test covers every tribute, the clean-up, the weather restore and the limits. These parts depend on the real game:
- display entities and their slide animation (`item_display`, `text_display`, `interpolation_duration`);
- visual-only lightning, using `createEntity` the same way the Pig Escort finale does;
- reading the rocket's position just before it bursts. If that fails, the face appears about 20 blocks above the launch spot.
