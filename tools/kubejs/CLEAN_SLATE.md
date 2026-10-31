# Protocol Clean Slate and the Blood Portal

The end of Part I (see [STORY.md](../../STORY.md)).
- **The trigger:** killing the Ender Dragon. The dragon guarded the Ministry's Archives, so with the records exposed the Ministry fires Protocol Clean Slate to wipe them, and the world with them. The world has **4 days**.
- **The way out:** players find ten **Blood Relics** in End City chests, open the **Blood Portal** event, fill the **Blood Pool** with Ministry Inspectors' blood, and step through.
- **At zero:** anyone still here falls.
- **The Ministry Archives:** End City chests also hold the Ministry's classified documents, and the dragon drops a brand-new bill aimed at Goruk.

## Files

| File | Where it goes | What it does |
|---|---|---|
| `server_scripts/clean_slate.js` | `kubejs/server_scripts/` | The dragon trigger, the countdown, the burning world, the Last Broadcast |
| `server_scripts/events/blood_portal.js` | `kubejs/server_scripts/events/` | Relics, Archive books, Draft Bill 9-D, the Blood Portal event, the escapes |
| `server_scripts/story.js` | `kubejs/server_scripts/` | **Updated:** the finale act's lines, and entering the finale starts the countdown |
| `server_scripts/economy/trolls.js` | `kubejs/server_scripts/economy/` | **Updated:** the Blood Pool commands are gone (saved for Part II) |
| `factions/portal_ambush.js`, `fake_players.js` | (already installed) | The Inspectors, and hypixel's lines |

Copy them, then run `/reload`. Nothing is needed on the players' side.

## Setting up (before anyone kills the dragon)
1. **The arena:** stand at its centre and run `/bloodportal setarena [radius]` (default radius 32).
   - Everyone is teleported to within 3 blocks of this spot, at the same height, so pick open, flat ground.
   - Keep it well away from world spawn.
   - The Overworld is best: Inspectors there are vindicators, pillagers and, later, evokers.
2. **The portal:** stand where its centre should be and run `/bloodportal buildportal`.
   - It builds a bedrock basin, 1 deep: a 6x6 rim and floor around an empty 4x4 inside. **It replaces whatever blocks are there.** This is the only change the scripts make to the world, and it only happens when you run it.
   - **Built your own?** Stand inside its 4x4 (bedrock rim all round) and run `/bloodportal setportal` instead.
3. **Check:** `/cleanslate status` and `/bloodportal status` should show the arena and the portal.

Nothing else is needed. The first time the dragon dies, Protocol Clean Slate starts by itself. `/cleanslate start` is the backup.

## Protocol Clean Slate (`clean_slate.js`)

### The start
- **When:** about 12 seconds after the **first** Ender Dragon dies (in the End). Later dragons do nothing.
- **What happens:** the story act jumps to **`finale`** (story.js), which everyone sees:
  - the title PROTOCOL / CLEAN SLATE and a raid horn;
  - the Ministry announces it: "The Ministry's records have been accessed by unauthorised citizens. This is regrettable. Protocol Clean Slate is now in effect. All records, and the world they are kept in, will be cleaned. This is for your protection. Nothing incriminating was ever written down.";
  - the hijacked signal answers: "They are burning the world to bury what they did. Four days. The Ministry hid ten Blood Relics in the End City treasure chests. Go to the End Cities and find them. When one of you carries all ten, the Blood Portal opens. It is our way out. Technoblade never dies."
- **Other ways in:** an op can start it with `/cleanslate start [hours]`, or by setting the act to `finale` with `/story`.

### The 4 days
- **The bossbar:** "PROTOCOL CLEAN SLATE: 3d 23h 59m" for everyone, drawing down. It updates every 20 s, then every second in the last minute.
- **An endless thunderstorm,** renewed every 5 minutes.
  - **Fire spread is off** (`doFireTick false`) for the whole 4 days, so natural lightning can't burn bases down before the world is archived. The old setting is put back at the end, or on cancel.
- **Visual-only lightning near players:** one bolt near each player in the Overworld every 2 minutes at first, rising to every 15 s at the end. No damage, no fire. It strikes the surface, so players underground only hear it.
- **Broadcasts falling apart:**
  - **When:** at 72, 48, 24, 12, 6 and 1 hours, 30 minutes, 10 minutes and 1 minute left.
  - **The Ministry's lines** count down to the wipe ("Citizens in possession of Ministry records should hand them in for safe burning", "there were never any records. That is why they must be destroyed") and break up into static (garbled words) more as zero comes closer.
  - **The hijacked replies** send players to the End City treasure chests for the Relics ("Three days. Ten Blood Relics sleep in the End City treasure chests. Find them."). Once someone has carried all ten, they switch to the Blood Portal ("/bloodportal start").
- **Relic reminders:** every 6 hours, until one player has carried all ten Relics, the hijacked signal reminds everyone where they are. The three lines take turns, each with a count: "The Ministry hid ten Blood Relics in the End City treasure chests. Find them before they burn. (3 of 10 have surfaced so far.)" The count is how many different Relics have turned up in chests.
  - These go out with `tellraw @a`, so Discord sees them.
- **The last 10 seconds:** a 10…1 title for everyone.

### Zero
- **The Last Broadcast:** "Protocol Clean Slate is complete. All records have been destroyed. There is no evidence of wrongdoing. There is no evidence of anything. Compliance is at one hundred percent. The Ministry thanks you for your cooperation. This broadcast will now end."
- **Everyone still here falls:** every online player in survival or adventure who didn't escape gets a lightning flash, the title "CLEAN SLATE / You did not escape." and **spectator mode**. Players in creative are left alone.
  - Anyone who logs in later (and didn't escape) falls the same way.
- **The bossbar and the storm stop.** Then shut the server down when you're ready. Nothing in the world has been changed, so it's ready to archive.

## The Blood Relics
Ten custom items, each a vanilla item with a dark red name, lore and the enchantment glint. They're told apart by a hidden tag, so renaming an item doesn't make a Relic.

| id | Relic | Base item |
|---|---|---|
| `blade_shard` | Shard of the Blade | echo shard |
| `crown_jewel` | Jewel of the Crown | heart of the sea |
| `carl_horseshoe` | Carl's Horseshoe | iron horse armour |
| `last_potato` | The Last Potato of the Potato War | clay ball |
| `oinkington_letter` | Oinkington's Final Letter | paper |
| `swine_tusk` | Tusk of the First Swine | goat horn |
| `blood_god_tear` | Tear of the Blood God | ghast tear |
| `unredacted_act` | The Unredacted Swine Act | paper |
| `anarchist_banner` | Scrap of the Anarchist's Banner | piglin banner pattern |
| `undying_ember` | The Undying Ember | magma cream |

- **Where they come from:** End City **treasure chests**, the first time each is opened, **while Clean Slate runs**. Each chest has a 60% chance of one Relic.
  - **Any block counts** as long as it has the End City loot table (`minecraft:chests/end_city_treasure`). That includes **Quark's purpur chests**, which replace the vanilla chests in End Cities in this pack.
- **Which Relic:** always the one found the fewest times, so all ten turn up within about 17 chests before any repeats. A Relic that's lost can turn up again.
- **Chests opened before Clean Slate** have already generated their loot, so they never get a Relic.
- **Unlocking the event:** the moment **one player carries all ten at once** (anywhere in their inventory), `/bloodportal start` opens for everyone, and it stays open.
  - hypixel joins if needed and says: "All ten Relics are in one pair of hands. The Blood Portal can be opened. Anyone: /bloodportal start".
  - Everyone also gets a hijacked line.
- **Crafting:** Relics can't be made by crafting, but they can be used up in a recipe like their base item. Their lore says not to.

## The Ministry Archives
Signed books ("written by" The Ministry of Trolling (CLASSIFIED)) with a red "CLASSIFIED: Archive Record #n" line.

**In End City treasure chests** (any time; a 50% chance per chest, the least-found first):

| # | Title | What it reveals |
|---|---|---|
| 1 | The Sanctity of Swine Act | The full Act: only the Ministry may say "Technoblade"; pigs must bow to officials; the Swine Dignity Fee; unlicensed grief is a pork-related offence; Clause 6 doesn't exist |
| 2 | Memo: Re: Oinkington | "The Escort must fail. Make it look like the piglins." The scout sent home asleep on purpose |
| 3 | Legacy Committee Minutes | The vote to rebrand "Technoblade never dies" as "fondly remembered, within regulations"; the objector reassigned |
| 4 | Asset Disposal Receipt #7 | The Crown melted into 400 lapel pins, sold for 30 Hush Coins each |
| 5 | Potato Requisition Order | The potato farm seized; potatoes taxed per eye; "unlicensed remembrance" |
| 6 | Personnel File: Carl | Carl reassigned to parking enforcement. Carl did not consent. Carl remembers |
| 7 | Trademark Application TM-41 | The Ministry trademarks "Blood for the Blood God" |
| 8 | ELI: Internal Version | The real reason for the End Lockdown: to hide these records. "If the dragon falls, so do we." |
| 9 | Merchandise Catalogue | Official Technoblade™ memorial goods, profits to the Minister's hot tub |
| 10 | Protocol Clean Slate SOP | The Ministry's plan if the records are ever exposed: activate, evacuate officials first and citizens never, call it protection. "Burn the Archives first." |

**From the Ender Dragon only: Draft Bill 9-D, the Dwarf Management Act.**
- **What it is:** brand new legislation, stamped "DRAFT: SECOND READING PASSED. Royal Assent expected within the week" and dated the day the dragon dies. It's written to turn **Goruk the Dwarf**:
  - reduced-height doors for dwarves;
  - a beard tax per inch (braids count double);
  - dwarven mining output reclassified as Ministry property;
  - no standing on blocks in official photographs;
  - complaints filed on the bottom shelf;
  - Goruk kept on "as a useful mascot until the beard tax is fully implemented" (vote unanimous, Goruk not informed).
- **How it's given:** one copy, the moment the **first** dragon dies, **straight into the inventory of the player who killed it** (a full inventory drops it at their feet).
  - **They're told privately:** "[SIGNAL HIJACKED] The dragon was carrying the Ministry's newest bill. It's in your inventory. Read it."
  - **If the kill isn't credited to a player,** the nearest player in the End gets it instead.
  - **Only with nobody in the End** is it dropped on top of the exit portal's pillar, glowing and never despawning.
  - **What everyone sees,** 40 seconds after the kill (after the Ministry's announcement): "[SIGNAL HIJACKED] The dragon guarded the Ministry's records. Read them before they burn." It doesn't say who has the bill.
  - **Already given on this world** (a dragon was killed before this update)? Hand one out with `/bloodportal archive give <player> 11`.
- It never appears in chests.

## The Blood Portal event (`events/blood_portal.js`)
1. **`/bloodportal start`:** any player can run it, once the Relics are gathered and Clean Slate is running. The Relics aren't used up.
2. **Everyone online** (not in spectator, not already escaped) is teleported to the arena, and **their spawn is set there**. Players who log in during the event are brought in too.
3. **The arena:** red dust and crimson spores drift through it, and a **"Blood Pool"** bossbar (dark red, notched) appears for everyone.
4. **Ministry Inspectors:**
   - **Who:** they come through portal_ambush.js, so they're the same tuned mobs as the raids: no morphing, they follow you, and vexes chase fliers.
   - **How many:** about 3 alive at the start, rising to 14 as the pool fills.
   - **The tier:** light, then moderate (from 33%), then lethal (from 66%, with evokers).
5. **Filling the pool:** each event Inspector killed fills it by 1, and an evoker by 3 (vexes count 0, because evokers summon them endlessly). **40 points fill it.**
6. **When it's full:**
   - the remaining Inspectors vanish in smoke;
   - the basin fills with **EvilCraft blood** (red stained glass if that block can't be placed);
   - a Wither roar;
   - hypixel: **"The time has come to escape, players!" "COME TO THE NEW WORLD!" "Step into the blood. Technoblade never dies."**
7. **Escaping:** any player in survival or adventure who steps into the blood:
   - **What's saved first:** their whole inventory (with NBT) and legacy (faction, rank, troll stats, Hush Coins carried), to `kubejs/exodus/<name>_<uuid>.json` on the server. A copy goes in world data (`blood_portal_exodus`). Their items stay where they are in the world. These files are for Part II.
   - **What everyone sees:** "[SIGNAL HIJACKED] <name> has passed through the Blood Portal."
   - **The kick:** with this message: *The blood takes you. / Technoblade never dies. / Neither will you. / See you in the new world.*
   - **Logging back in** kicks them again ("You have already passed through the Blood Portal."). Ops are exempt, so you can't lock yourself out.

## Commands

| Command | Who | |
|---|---|---|
| `/cleanslate` or `/cleanslate status` | op | State, time left, the dragon, and a Blood Portal summary |
| `/cleanslate start [hours]` | op | Start it now (the backup; normally the dragon does it). Default 96 h |
| `/cleanslate test` | op | A 2-minute run only you see: no broadcast to others, no weather, no gamerule, no spectator at the end |
| `/cleanslate extend <hours>` | op | More time |
| `/cleanslate pause`, `/cleanslate resume` | op | Stop and restart the clock |
| `/cleanslate cancel` | op | Stop it quietly (bossbar, storm and fire spread put back). The dragon won't start it again |
| `/bloodportal` | anyone | A one-line summary |
| `/bloodportal start` | anyone | Open the event (needs the ten Relics gathered and Clean Slate running) |
| `/bloodportal start force` | op | Open it anyway |
| `/bloodportal status` | op | Relics placed, the arena, the portal, the pool, who escaped |
| `/bloodportal setarena [radius]`, `buildportal`, `setportal` | op | Setup (above) |
| `/bloodportal relic give <player> <id\|all>`, `/bloodportal relics` | op | Give Relics (for testing or replacing a lost one); the list |
| `/bloodportal archive give <player> <n\|all>`, `/bloodportal archives` | op | Give Archive books (11 is Draft Bill 9-D); the list |
| `/bloodportal fill` | op | Fill the pool now |
| `/bloodportal reset` | op | End the event and drain the portal (Relics, arena, portal and escapes are kept) |

## Settings
**clean_slate.js:**

| Setting | Default | |
|---|---|---|
| `START_ON_DRAGON_KILL` | true | The first dragon kill starts it |
| `START_DELAY_SECONDS` | 12 | After the kill |
| `DURATION_HOURS` | 96 | 4 days |
| `TO_DISCORD` | true | Broadcasts with `tellraw @a` |
| `THUNDER_EVERY_MINUTES` | 5 | |
| `STOP_FIRE_SPREAD` | true | `doFireTick` off while it runs |
| `LIGHTNING` | every 120 s → 15 s, 6–20 blocks away | |
| `FALL_ON_LOGIN` | true | Late arrivals fall too |
| `MILESTONES`, `LAST_BROADCAST`, `FALLEN_TITLE` | | The texts. A milestone's `hijack` is used while the Relics are hunted, `gathered` after |
| `RELIC_REMINDER_HOURS`, `RELIC_REMINDERS` | 6, three lines | The Relic reminders (0 = none) |

**events/blood_portal.js:**

| Setting | Default | |
|---|---|---|
| `END_CITY_LOOT` | `['minecraft:chests/end_city_treasure']` | Loot tables whose containers get Relics and books, whatever the block is. Add a table here if a mod gives End Cities its own (the server log names it) |
| `RELIC_CHANCE` | 0.6 | Per End City treasure chest |
| `RELICS_ONLY_DURING_CLEAN_SLATE` | true | |
| `ARCHIVE_CHANCE` | 0.5 | Per End City treasure chest |
| `ARCHIVES_FROM_ACT` | '' | '' = any time; `'act4'` = only from Act IV |
| `DRAGON_DROPS_BILL` | true | |
| `BILL_LINE_DELAY_SECONDS` | 40 | The public hijacked line about the bill, this long after the kill |
| `ARENA_RADIUS` | 32 | |
| `BLOOD_BLOCK` / `BLOOD_FALLBACK` | `evilcraft:blood` / red stained glass | |
| `WAVES` | 3 → 14 alive, groups of up to 8, tiers at 0/33/66% | |
| `KILLS_TO_FILL` | 40 | |
| `POINTS` | evoker 3, vex 0, others 1 | |
| `UNLOCK_LINES`, `FULL_LINES`, `KICK_MESSAGE`, `REJOIN_MESSAGE` | | The texts |
| `REJOIN` | 'kick' | 'allow' lets escaped players back in |
| `RELICS`, `ARCHIVES`, `BILL` | | The items and books |

## Saved data
- **`persistentData["clean_slate"]`:** the state, start and end times, which broadcasts have gone out, the old `doFireTick`, the dragon kill, and who fell.
- **`persistentData["blood_portal"]`:** the arena, the portal, the unlock, the event state and points, Relics and books placed, the bill, participants and escapes.
- **`persistentData["blood_portal_exodus"]`:** a copy of every exodus file.

Times are real time, so restarts and `/reload` lose nothing.

## Test plan (an op, plus two players A and B)
1. `/cleanslate test` on your own: the bossbar, broadcasts and lightning near you, the 10…1 count and the Last Broadcast, all within 2 minutes. Nobody else sees it.
2. **Set up** the arena and portal. Then `/bloodportal relic give A all`: within a second, hypixel joins and announces it.
3. **Start Clean Slate** with `/cleanslate start` (or kill a dragon in a test world): the finale title and lines, then thunder, the bossbar, and fire spread off (`/gamerule doFireTick` → false).
4. **The event:** B runs `/bloodportal start`.
   - Everyone is teleported and their spawn set.
   - The Inspectors come, and the bar fills as they die.
   - `/bloodportal fill` skips to the end.
5. **Escaping:** A steps into the blood and is kicked with the message. Check `kubejs/exodus/` on the server, then have A log in again and be kicked again.
6. **The end:** `/cleanslate extend` and `pause`/`resume`, then let it end (or start one with `/cleanslate start 1`). B falls into spectator. `/cleanslate cancel` resets it; put B back with `/gamemode survival B`.
7. **Books:** `/bloodportal archive give <you> all` and read all 11.

## What couldn't be verified for KubeJS 6 on 1.20.1
A mock-server test passed 78 checks:
- the test run;
- the start from the dragon and from `/story`;
- cancel, extend, pause and resume;
- the finale lines in order;
- the bill given straight to the killer (or the nearest player in the End, or dropped on the pillar with nobody there), its date and contents, and only one bill;
- the bossbar, milestones and thunder;
- the hijacked lines sending players to the End City chests, the 6-hour Relic reminders with the count, and no reminders once the Relics are gathered;
- Relics and books in chests (only unlooted End City treasure chests, Quark purpur chests included, least-found first, never the bill; other loot tables logged and skipped);
- unlocking with all ten in one inventory but not split between two players;
- the arena, the portal built and found;
- the event: teleport, spawn, Inspectors through portal_ambush, points, full, fallback blood, hypixel;
- escaping, the exodus file, the kick and the rejoin kick;
- `/reload` mid-countdown;
- zero: the Last Broadcast, spectator, and late arrivals;
- all 11 books with titles within the 32-character limit.

The trolls/story test (42 checks) and the black market, tracking, ambush, factions and End Lockdown tests still pass.

These depend on the real game:
- **The chest hook:** `BlockEvents.rightClicked` comes before the loot is generated, `block.entityData` still shows the `LootTable`, and the Relic is put in through the chest's block entity two ticks later.
  - **Every unlooted container opened in the End is logged:** `[BloodPortal] Unlooted quark:purpur_chest opened at … (minecraft:chests/end_city_treasure)`, then `[BloodPortal] Relic … placed` when one goes in.
  - **A container with a different loot table** shows "… with loot table X (not in END_CITY_LOOT)". If End City chests show that, add X to `END_CITY_LOOT`.
  - **No line at all** means the chest had already been opened, or the right-click never reached the script.
- **EvilCraft's blood block id** (`evilcraft:blood`). If it's wrong, the log says so and red glass is used instead.
- **The dragon's death:** `EntityEvents.death` for `minecraft:ender_dragon`, and the killer read from the damage source.
- **Visual-only lightning:** `level.createEntity('minecraft:lightning_bolt')` + `setVisualOnly(true)` (the same way smite.js does it), and `level.getHeight` for the surface.
- **The kick:** `player.connection.disconnect(...)`, falling back to `/kick`.
- **`JsonIO.write` into `kubejs/exodus/`.** If that folder can't be created, it writes `kubejs/exodus_<name>_<uuid>.json` instead, and the world-data copy is always made.
- **hypixel:** `fakejoin hypixel` from a script, and the 3-second wait before he speaks.
- **`gamerule doFireTick`:** reading it back to restore it.
