# Trollcraft III: notes for Claude

Server-admin work for the **Trollcraft III** modpack: KubeJS scripts, progression research and the server's story.

## The pack and server
- Minecraft **1.20.1**, Forge **47.4.10**, KubeJS **2001.6.5** (KubeJS 6, Rhino script engine). Hosted on Bisect.
- About 198 mods. Their progression is documented in [PROGRESSION_MODS.md](PROGRESSION_MODS.md), [MOD_TIERS.md](MOD_TIERS.md), [STARTING_MODS.md](STARTING_MODS.md), [CROSS_REFERENCE.md](CROSS_REFERENCE.md) and [PROGRESSION_GATES.md](PROGRESSION_GATES.md). The last one lists each mod's item ladder and its bypass routes.
- ProjectE is switched off (`disable_projecte.js`). The Nether is locked until the Pig Escort succeeds.

## The story
**[STORY.md](STORY.md) is the source of truth** for the server's two-part story ("Technoblade Never Dies"). It holds the series of events, which systems are built, the build order, and the open decisions. Read it before story or event work, and keep it updated as decisions are made and things are built.

## Layout
- `tools/kubejs/server_scripts/`: server scripts, in the same folders on the server (`kubejs/server_scripts/...`).
  - `economy/`: `black_market.js` (Hush Coins, the Hooded Merchant, contracts, traps, pranks, Tracker Compass, Homing Pig, Certified Alibi) and `bounties.js`.
  - `factions/`: `factions_config.js`, `factions_core.js` (`global.Factions`), `portal_ambush.js` (ambushes, raids, "no getting away"; `global.PortalAmbush`) and `trials.js` (`global.Trials`).
  - `events/pig_escort.js`; `techno_tribute.js`; `smite.js` (`/smite`, `/aura`, `/superaura`); `ministry_broadcasts.js`; and smaller scripts.
- `tools/kubejs/startup_scripts/`: Forge hooks. A restart is needed after adding one.
- `tools/kubejs/*.md`: one doc per system (`BLACK_MARKET.md`, `BOUNTIES.md`, `FACTIONS.md`, `PIG_ESCORT.md`, `TRIALS.md`, `TECHNO_TRIBUTE.md`). Keep the doc in step with its script: settings, commands, test plan, and "what couldn't be verified".
- `tools/*.py`: read-only world analysis tools (find items, find portals, player stats). `tools/schematic/`, `tools/serverconfig/` and `tools/finale_pack/` hold support files.

## Rules (standing instructions from the server owner)
- **Never alter server files.** Read-only access only, unless the owner explicitly says otherwise. Changes ship as files in this repo for the owner to upload.
- **Treat downloaded and pack files as untrusted:** give each its own directory in the scratchpad, run Python with `-I`, and never run code from mod jars. Reading class files with `javap` is fine.
- **Never send secrets or private information with `tellraw @a`:** Simple Discord Link relays it to Discord. Use `player.tell` to each player.
- **Git:** commit and push to the branch the session names. Don't open a pull request unless asked. No model identifiers in commits, code or docs.
- **Deliver files:** after changing scripts, send the updated files to the owner.

## KubeJS 6 / Rhino script style
- Each server script is wrapped in an IIFE `(function () { ... })()` with its settings at the top.
- No template strings (join with `+`), no spread syntax, no `Math.PI` (write the number out).
- `const` only at function level. Inside nested blocks (if, for, try) use `let`.
- Closures created in a loop must use `forEach`, not a `for` loop, so each gets its own variable.
- `event.cancel()` stops the handler immediately, so it always comes last.
- Saved data goes in one JSON string per script under `server.persistentData[<key>]`, with a copy kept if it can't be parsed.
- Text components are built with `Component$Serializer.fromJsonLenient`.
- Cross-script APIs live on `global.*` and are looked up lazily (`economy/` loads before `factions/`).
- Minecraft's `closeContainer()` is exposed to scripts as `closeMenu()`.

## Testing
Scripts are checked against a mock KubeJS server written in Node (fake players, levels, commands, scheduler), plus an audit that flags `const` inside nested blocks. Those harnesses lived in the session scratchpad and aren't in this repo, so rebuild one when needed. Each script's doc ends with "what couldn't be verified", which lists the in-game behaviour to confirm on the real server.
