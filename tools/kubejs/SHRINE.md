# The Shrine Awakens (Part II): spec

✅ **All six stages built** (2026-11-19) as `server_scripts/part2/shrine.js`, from the owner's decisions of 2026-11-14 to 11-19. Next: a rehearsal with players on the test server. This file is the system's doc: settings, commands, test plan and "what couldn't be verified". See [Build progress](#build-progress).

The story is in [STORY.md](../../STORY.md), Act I #36. This file says how each stage works in game.

## What it is
**One big evening, about 90 minutes, run live by ops.**
- **When:** early Part II, with the server at Blood Pool Tier 2 (about 66,000 Drops).
- **What happens, in order** (owner decision 2026-11-19, at the fourth run: "I want the shrine to be the climax ending instead of in the middle"):
  - the Blood God summons the server;
  - three teams light three far-apart braziers, and a red beam rises over the empty Shrine site;
  - the server defends the beam from Inspector waves and feeds it Potato King's Potatoes;
  - the Blood God speaks at the beam, names the Regalia of the Blade, and breaks the third and fourth seals himself, with no vote, which opens the Nether. The Pool is raised to a quarter of the way past Tier 4 (230,000 Drops), credited to nobody;
  - **last of all, Technoblade's Shrine rises out of the ground,** layer by layer, and the night ends when it stands.

**Up to the beam, each stage is one op command; from there the night runs itself** (owner decisions 2026-11-19):
- **The Ignition Rite** begins by itself once every pilgrim online has gathered at the beam.
- **When the offering is full,** the Inspectors vanish and everyone is brought back to watch. The Awakening then begins by itself.
- **When the Awakening ends,** the Shrine rises. When it stands, the night ends.

The ops set the pace up to the beam and can wait for stragglers. `/shrine stop` holds the rite or the Awakening while it's due.

**The night's kit** (owner decision 2026-11-19): from `/shrine braziers` to the night's end, everyone fights in a kit that won't break, and their own belongings are held safe (below).

**Effects** (owner decision 2026-11-19): every stage has its own (each stage below says which).
- **What they are:** titles, sounds, particles, fireworks, and lightning that can't burn or hurt.
- **The sky:** during the event it turns to night and storm when the rite begins, and clears to day when the night ends.

The stages keep their numbers from the first plan (Stage 3 is the rise), but they're run in this order:

| Order | Stage | How it starts | Length | Where |
|---|---|---|---|---|
| 1 | 0. The Signal | `/shrine signal` | the day before | everywhere |
| 2 | 1. The Summons | `/shrine summons` | ~10 min | the castle |
| 3 | 2. The Pilgrimage | `/shrine braziers` | ~30 min | three brazier sites, then the beam |
| 4 | 4. The Ignition Rite | by itself once everyone is at the beam (`/shrine rite` by hand) | ~20 min | around the beam |
| 5 | 5. The Awakening | by itself once the offering is full (`/shrine awaken` by hand) | ~1 min | the viewing spots, facing the beam |
| 6 | 3. The Shrine Rises | by itself once the Awakening ends (`/shrine rise force` by hand) | ~30 s, then the night ends | the viewing spots |

## Setting up (before the night)
**Sites are set in game.** An op stands on the spot and runs:
- `/shrine site set`: the Shrine's centre, at ground level;
- `/shrine brazier set <1|2|3>`: each brazier;
- `/shrine start set`: the start, where `/shrine braziers` brings every player (near the castle, say);
- `/shrine view set`: the viewing platform, where everyone watches the Awakening and the rise (owner decisions at the fifth run, 2026-11-20). Fly to a spot in the sky with the whole site in view and run it there: a 6 x 6 floor of barriers is laid just under you (`PLATFORM`), with an invisible rail 2 high round its edge so nobody steps off. Its rail can't be over the Shrine's footprint. Running it again somewhere else takes the old platform down. Until it's set, a spot on the ground east of the steps is picked by itself.

Or give the coordinates, in the Overworld, which also works from the console: `/shrine site set <x> <y> <z>`, `/shrine brazier set <1-3> <x> <y> <z>`, `/shrine start set <x> <y> <z>` and `/shrine view set <x> <y> <z>`.

`/shrine status` shows the sites, the stage, and each brazier's distance and direction from the castle.

**The Shrine's site:**
- **Its size:** the statue is 42 × 43 blocks and 64 tall. The bottom 22 layers are a pedestal; the altar is on top of it, with Technoblade's head over the lectern.
- **What to pick:** flat, open ground with nothing built on it. The rise clears the whole box above ground before placing each layer.
- **Rehearse first** on the test server, with `/shrine reset confirm` between runs (see the commands below).

## 0. The Signal (the day before) ✅ built
**`/shrine signal`** sends a scrambled, unsigned message to everyone online. Anyone who logs on in the next 24 hours (`SIGNAL_HOURS`) gets it 5 seconds after they join, once each.
- **How it looks:** dark red obfuscated stretches (shifting glyphs), so only the fragments, in red italics, read clearly.
- **Discord:** the owner posts the time there separately. The Signal itself is sent to each player, never with `tellraw @a`.
- **The reply** says how many got it. `/shrine status` says when it went, to how many, and how long late arrivals still get it.
- **Again:** running it again sends it to everyone online again and starts a fresh 24 hours.

The text (█ = scrambled, as approved):
> ██ █████ ███ ...*the third seal*... ████ ██ █ ...*three fires*... ███████ ...*gather at the castle*... ██ ███ ...*tomorrow, when the sun goes down*... █████

## 1. The Summons (at the castle) ✅ built
**`/shrine summons`** gives everyone online the book ***A Summons***, signed *The Blood God*. The Castellan reads it out.
- **The brazier lines** give each fire's direction and distance from the castle (world spawn), worked out from the brazier sites when the command runs, so they're always right: "*the first:* about 900 blocks toward the rising sun" (owner decision). Each fire has its own line, so the page stays within a book page's 14 lines even with three long directions.
- **It needs all three braziers set,** and refuses until they are ("Set the three braziers first").
- **The reply** says how many got a copy and gives the three lines, so the ops can check them.
- **Late arrivals** get the same book 5 seconds after they join, once each, until the Awakening is done, and are told "A book was left for you: A Summons."
- **Again:** running it again gives everyone online a fresh copy (say a brazier was moved).

The book (each `>` block is a page):
> BLOOD FOR THE BLOOD GOD.
> You have bled for their seals. Two lie broken. The third still holds.

> Beneath this land sleeps something older than any seal: my Shrine.
> It will not wake for one of you. It wakes for all of you, or for none.

> Three fires wait in three far places:
> *the first:* about [distance] blocks [direction]
> *the second:* about [distance] blocks [direction]
> *the third:* about [distance] blocks [direction]

(Directions: "toward the rising sun" for east, "toward the setting sun" for west, then north, south, north-east and so on. Distances are rounded to the nearest 50 blocks.)

> Light them as one. A fire that burns alone will die within the minute.
> When all three burn, I will show you where to stand.

> Bring your blades. They will come for what is mine.
> Take back from them what they took from me.

> They want the Pool full.
> So do I.

The last page is the first hint of the two threads (kept: owner decision).

## 2. The Pilgrimage: three braziers ✅ built
**`/shrine braziers`** places an unlit brazier at each site and **starts the night's event** (below). It needs all three brazier sites and the start set, and it won't start during a Purge or a Gladiator match.
- **Everyone to the start:** every player online is teleported to the start and told "The pilgrimage begins. Until the Shrine awakens, falling is not the end: you wake by the last fire lit, or here."
- **Armed for the night:** everyone in survival is given the night's kit there, and their own belongings are held (see "The night's kit" below).
- **The opening** (owner decisions, 2026-11-20: "let's make the start of the event more dramatic"; fires on the horizon and an Inspector broadcast, about 30 seconds, nobody held; `OPENING`, `OPENING_BROADCAST`). Players can move from the first second; it plays around them:
  - 1 s: **"THE PILGRIMAGE"** on every screen ("Three fires must burn as one"), with a deep bell;
  - 4, 9 and 14 s: **each fire flares** in turn: "The first fire" on screen with its distance and direction from the start, lightning on the brazier (only for show), thunder from its direction for each player, and for 3 seconds a pillar of fire, orange sparks and signal smoke. A brazier more than 96 blocks from the start (`horizon`) flares on the horizon toward it, 96 blocks out, so it can be seen through the fog (the pillar also burns over the brazier itself, for anyone there);
  - 19, 21.5 and 24 s: **the Inspectors' channel, overheard:** three scrambled, unsigned lines to each player (never `tellraw @a`), tagged `[INTERCEPTED]`, with a crackle: "...all units, all units... an unregistered gathering at the castle...", "...three fire sites. No fire is to be lit...", "...Inspectors to every site. Bring them in, and keep the potatoes where they are...". It never names who they work for;
  - 28 s: **"Light the fires"** ("before they put them out"), with a blaze's roar.
  - **Cut short** by `/shrine stop` ("The opening is cut short"), by all three fires burning, by the rise or a reset. A `/reload` drops the rest of it (its steps aren't saved); the night goes on.
  - **The Inspectors wait for it** (seen on the test server, 2026-11-21: its start is beside the braziers, and 21 Inspectors came at second 0 and knocked the owner out 3 seconds in): no ambush and no brazier wave until it ends. After a `/reload` mid-opening the wait still ends on time.
- **The fires' coordinates in chat** (owner decision 2026-11-21: "the coordinates should be released into chat at the start in case the fires are out of view distance"): at `/shrine braziers`, each player is told "The three fires wait at:", then each fire's coordinates with how far and which way from the start, then how to light them. Anyone joining while the fires are still out gets the same, measured from where they are (a lit one says "burning").
- **The pillars again every 30 seconds** (owner decision 2026-11-21: "the fire pillars should fire every 30 seconds after start so players can track them"; `FLARE_AGAIN`): from 30 seconds after `/shrine braziers` until all three burn, each fire not yet lit sends up its pillar of fire and smoke for 3 seconds, with a roar heard near it. A lit one doesn't. The time is saved, so a `/reload` keeps the rhythm.
- **Effects** (2026-11-19):
  - each fire that catches sends up a column of flame and signal smoke, with a blaze's roar everyone hears;
  - when all three burn, lightning strikes each brazier (only for show), and "THREE FIRES BURN" fills every screen ("A red light rises over the Shrine").
- **The brazier:** a 3 × 3 plinth of polished blackstone bricks on the ground, an unlit campfire on it in the middle, and blackstone walls with chains at the corners (`BRAZIER_PARTS`).
- **Building them:** each brazier's chunk is force-loaded while the fires are watched, so each is built once its chunk loads, even with nobody near.
- **Protected:** the braziers can't be broken outside creative ("The brazier will not move").

**Lighting them:**
- **By kneeling** (owner decision 2026-11-21: "instead of flint and steel lighting them immediately players should have to shift for 2 seconds without taking damage to light them"; `KINDLE`): a pilgrim (survival or adventure) within 3 blocks of an unlit brazier's fire, **holding sneak for a second and a half without being hurt**, lights it (2 seconds at first; at the sixth run's rerun the owner tried 1, "maybe reduce the lighting time to 1 second", then "make it 1.5 seconds").
  - **Near one, not sneaking:** the action bar says "Hold sneak to kindle the first fire".
  - **Sneaking:** "Kindling the first fire" with a bar filling over the second and a half, sparks on the fire and a crackle.
  - **A blow** (health or absorption hearts lost, or hit at all) scatters it: "Struck! The kindling scatters. Start again."
  - **Done:** "The fire takes." The log says who ("leelinda kindled brazier 2"). Checked every 5 ticks.
  - **Flint and steel and fire charges** are refused at a brazier while the fires wait ("The fire won't take from that. Kneel at a fire to light it: hold sneak beside it for a second and a half without being hurt."). A fire lit any other way (a flaming arrow) is put out within a second, and those within 16 blocks are told the same.
  - **Ops:** `/shrine fires light` lights all three as before; other scripts can light one with `global.Shrine.kindle(i)`.
  - The flint and steel has left the kit.
- **Everyone is told:** "Far away, a fire catches. 1 of 3. The others have 45 seconds." Then "Another fire catches. 2 of 3."
- **The window:** the first one lit starts a 45-second clock (`FIRE_WINDOW_SECONDS`; 60 until the owner cut it, 2026-11-21: "decrease the timer after a fire is lit to 45 seconds instead of 60"). Everyone sees it as a boss bar, "The fires: 1 / 3   0:37", counting down.
- **Too slow:** if all three aren't burning before it runs out, the lit ones gutter out (smoke and a hiss), and the teams try again. Nothing else is lost.
  - A fire put out before the others catch counts as out.
  - If all of them are put out, the clock stops.
- **Done:** when all three burn, everyone is told "Three fires burn as one", hears the beacon, and the beam goes up.
  - The fires stay lit for the rest of the night: one put out or taken away is lit again within a second.
- **Ops:** `/shrine fires light` lights all three by hand (say a team can't get there), and `/shrine fires out` ends a clock early.

**The beam:**
- **What it is:** a red beacon beam over the Shrine site.
- **How it's made:**
  - a real beacon two blocks under the site's centre, on a 3 × 3 of iron blocks;
  - red stained glass in the ground above it, so the only thing that shows is a red glass block where the Shrine will stand.
  - The blocks it replaces are saved, and they're put back when the rise begins (or with `/shrine beam down`).
- **What it needs:** open sky above the site's centre. The log warns if anything is in the way.
- **How far it shows:** a beacon beam shows only as far as the player's render distance (at most 256 blocks). So it guides the teams in once they're on their way back, not from the braziers.
- **Ops:** `/shrine beam up` and `/shrine beam down` raise and lower it by hand.

**Ambushes on the way:**
- **What they are:** unsigned **Inspectors** (never "Ministry Inspector") stop "unregistered pilgrims": "Remain where you are."
- **Who they are:** the Shrine's own Inspectors.
  - The Part I patrols (`factions/portal_ambush.js`) aren't on the Part II server, so the Shrine spawns its own.
  - They're vindicators with iron axes and pillagers with crossbows, in iron armour, named **Inspector** in gold.
  - They're tagged `shrine_inspector` and `shrine_ambush`, so the Shrine's no-monster rule lets them through.
  - They don't despawn, and they drop nothing.
- **How many:** 2 plus 1 for each pilgrim within 32 blocks of the one targeted, at most 6. They appear on the ground in a ring 8 to 12 blocks around that pilgrim.
- **Who starts them:** both (owner decision).
  - **One automatic ambush per team:** the nearest pilgrim within 200 blocks of a brazier that isn't lit yet is ambushed there, with the pilgrims near them. Once per brazier.
  - Players in creative or spectator are never ambushed.
  - **More by hand:** `/shrine ambush <player>`, whenever the ops want one.
  - **Waves at the braziers** (owner decision at the fifth run's rerun, 2026-11-20: "There will be 7 to 8 players on the event at the same time. Make sure to balance it accordingly. Waves should continuously spawn"; settings in `BRAZIER_WAVES`):
    - **When:** while a brazier is unlit and the night's event is on, anyone in survival within **40 blocks** of it draws a group every **20 seconds**.
    - **How many:** 3, plus 1 per pilgrim within those 40 blocks, at most 8 a group. A team of 3 faces 6 every 20 seconds; all 8 at one fire, 8. (Made harder before release, owner decision 2026-11-21: it was 2 + 1, at most 6, every 30 seconds, up to 12.)
    - **Where:** 6 to 12 blocks from the fire, on dry ground (as the rite's waves), in iron; vindicators and pillagers in turn. They're tagged to their brazier (`shrine_brazier_<n>`).
    - **The limit:** no more come while 16 of that brazier's own are up (the last group tops it up to 16), so a team that's struggling isn't buried.
    - **When it's lit,** that brazier sends no more (if the fires gutter out, they start again). **Once all three burn,** every Inspector left from the brazier stage is driven off ("The Inspectors fall back from the fires."), so the rite begins clean at the beam.
    - **The log:** "Brazier 2 wave: 5 Inspectors for 3 near (x y z; ...)".
    - On the test server the start is within 200 blocks of all three braziers, so all three ambushes on the way fire at once as everyone arrives; on the live server, with the start at the castle, they come one at a time as teams travel.
- **Deaths in an ambush:** none. The night's event is on from `/shrine braziers`, so a lethal hit is a knockout (below).
- **Leftovers:** any ambushers still alive are driven off when all three fires burn (and taken away when the offering is full, or when the rise begins).

## The night's event: knockouts for everyone ✅ built
**Owner decision 2026-11-15**, after an ambush killed the owner on the test server: "once the command /shrine braziers is run consider it an event trigger. all players are teleported and event rules engage until the end".
- **When:** from `/shrine braziers` until the Awakening ends. `/shrine reset confirm` ends it too. `/shrine status` shows whether it's on.
- **Who and where:** every player, anywhere in any dimension.
- **A lethal hit is a knockout:** the player is healed, their fire put out, their effects cleared (as the arena and the Purge do) and given 3 seconds of Resistance V. Nothing drops. `/kill` still kills.
- **Where they wake** (the owner's rule):
  - beside the **last brazier lit** that still burns (3 blocks east of it, on the ground): "You wake beside the last fire lit.";
  - at **the start** if none burns yet, or they guttered out: "You wake where the pilgrimage began.";
  - near the Shrine during the rite, at the Shrine's edge, as before.
- **The log** says who, what would have killed them, and where they woke ("Knockout: leelinda (mob), woken at the start").
- **No overlap:** the Purge and the Gladiator Arena wait for the whole event (`global.Shrine.busy()` says "the Shrine Awakens is on"), and the Shrine won't start a stage during either. The Shrine asks the Purge whether one is running or counting down (`active()`, `pending()`), not `busy()`, which names the Shrine itself as a reason (that made the Shrine wait on itself on the test server).
- **Without the event** (a rehearsal with `/shrine rise force` and no braziers), only the rite's knockouts at the Shrine apply.

## The night's kit ✅ built
**Owner decisions at the rehearsal, 2026-11-19:** "my armor and weapons kept breaking during the event, I would like there to be a kit similar to the gladiatorial arena ... When the shrine awakens the player inventories are restored".
- **The kit** (`KIT`): a diamond sword with Sharpness IV, 16 steak, a full set of diamond armour (worn), and a shield in the off hand.
- **Made new every 3rd knockout** (owner decision 2026-11-21: "kits need to be refreshed after every 3 knock outs"; `KIT_REFRESH_KNOCKOUTS`): each kitted player's knockouts in the night's event are counted, and at the 3rd, 6th and so on their kit is made new: every kit piece they still carry is replaced by a fresh one where it is (whole again, the steak back to 16), and any piece they've lost goes back in its own slot, or the first free one. Nothing else they carry is touched, the Potato King's Potatoes most of all. They're told "Your kit is made new: whole again, and the steak restocked", with a clink.
  - **Every piece of gear has Unbreaking X.** The food doesn't need it.
  - **The lore:** each piece is marked as the night's kit (`ShrineKit` in its data, and "Issued for the Shrine Awakens. Taken back at its end.").
- **Who gets it:** everyone in survival or adventure, when `/shrine braziers` brings them to the start.
  - **Anyone joining mid-event** gets it when they arrive. Their Summons, if due, is given after the kit, so it stays in their hands.
  - **Creative and spectators** are left alone. **Anyone who switches to survival mid-event** gets it within 10 seconds (`KIT_SWEEP_TICKS`). At the fifth run (2026-11-20) the owner was in creative at `/shrine braziers`, switched afterwards, got no kit, and was knocked out over and over in their own clothes.
  - **Whose belongings couldn't be held** is told once, not at every check.
- **Their own belongings are held safe,** as the Gladiator Arena and the Purge do it:
  - **What's held:** every inventory slot, the worn curios, and Tool Belt's belt slot.
  - **How:** each item is saved whole (so a backpack keeps its contents), and every one is checked to rebuild before anything is cleared.
  - **A backup file:** `kubejs/shrine_vault_<name>_<uuid>.json` on the server. KubeJS won't create the `kubejs/shrine_vaults/` folder the script tries first, so the files land there only if someone makes it (seen at the third run; the arena's and the Purge's do the same). Each file is marked `restored` once handed back.
  - **If something can't be stored safely,** that player fights in their own gear, and is told so. So are the ops.
- **Handed back:**
  - **When:** when the Awakening ends (or at `/shrine reset confirm`), to the slots they came from. Anyone offline then gets theirs when they next join.
  - **The kit:** it's taken back as well: from the inventory, the curios and the ender chest.
  - **If something can't be rebuilt,** it stays in the vault and the backup file, and the ops are told.
- **`/kill` mid-event:** the kit drops as usual; when they respawn, they're given a fresh kit (their belongings are still held).
- **Kit items can't leave the night:**
  - **The check:** outside the event, any kit item found on a player is taken back, and they're told. That covers the inventory, curios and ender chest, every 10 seconds (`KIT_SWEEP_TICKS`).
  - **The catch:** a kit item put in a chest during the event is only taken back once someone carries it.
- **`/shrine status`** lists whose belongings are held.

## 3. The Shrine Rises: the night's last act
**It rises by itself when the Awakening ends** (owner decision 2026-11-19, at the fourth run: the Shrine is the climax). Everyone watches from the viewing spots, held there, still in the kit; the Shrine builds itself from the ground up over the beam's site.

**It rises last:** `/shrine rise` refuses until the Awakening is done ("The Shrine rises last"). `/shrine rise force` raises it anyway (a rehearsal, or if it couldn't rise by itself: the log and the ops say why, and the night ends without it). A rise that was paused carries on without the check. (Until 2026-11-19 the rise came before the rite and waited for the beam.)

**When it stands** (`shrineStands`):
- it burns from its feet to its crown: all four bands of light go in at once (the light blocks the rite used to light band by band);
- the Regalia book is laid on its altar ("The Regalia of the Blade lies on the Shrine's altar. [/regalia]"), and the steps go up to it;
- "TECHNOBLADE'S SHRINE, stands once more" fills every screen, with the End portal's sound, a ring of lightning (8 bolts, 26 out), fireworks and soul fire;
- 5 seconds later (`FINALE_TICKS`) **the night ends:** the sky clears to day, everyone is let go from their spots, deaths are deaths again, and the kit goes as everyone's belongings come back;
- a `/reload` or restart mid-rise carries on, and the night still ends when it stands (one due in those 5 seconds ends at once).

1. **Clearing the way:** players standing inside the Shrine's footprint are moved to its edge. The beacon comes out and its ground is put back.
2. **Layer by layer:** for each of the 64 layers, the script clears that slice of the box, then places the layer, from `trollcraft:shrine/l_0` to `l_63`. One layer every **14 ticks** (`LAYER_TICKS`) takes about **45 seconds** for all 64 (owner decision 2026-11-21, at the sixth run: "increase the length of time for the shrine to build to 45 seconds"). It was 4 seconds a layer (4½ minutes) until the owner asked for about 30 seconds (2026-11-14), then 9 ticks (29 seconds) until the sixth run.
3. **The fire** (owner decision 2026-11-21: "make more particle effects. the fire columns are very good on the brazier but I think the major climax of the shrine being built would be fantastic"; `RISE_FIRE`):
   - **Pillars of fire** like the braziers' stand on a ring 6 blocks beyond the Shrine's corners (about 36 blocks from its centre), 8 of them, on the ground. None stands within 13 blocks of the viewing platform, so the watchers aren't inside one.
   - **They grow with the statue:** each burns 6 blocks above the layer being set (at least 10 tall), with orange sparks, lava at its foot and smoke at its head, pulsing every 7 ticks.
   - **The last stone, the climax:** every pillar roars to full height (70 blocks) with blasts up its length; the crown blasts (an explosion's burst and boom, for show: nothing breaks); a shockwave of fire rolls out along the ground from the base in five rings; and the pillars burn on at full height until the night ends (5 seconds later, with the lights, the fireworks and the soul fire as before).
4. **The show** (sounds chosen by the owner on the test server, 2026-11-14):
   - stone sounds: deepslate set down at every layer, grinding stone every 3rd, and a wither's crunch every 8th;
   - the respawn anchor's charge, the Blood God's power gathering, as it starts, when the pedestal is done (layer 21) and when the head is placed (layer 63), with a thunderclap at the last two;
   - dust and smoke along the layer's edge;
   - **the sky** (2026-11-19, during the event only, since it's the whole Overworld's): night falls and a thunderstorm rolls in as the rise begins. It clears to day when the Awakening ends (or at a reset);
   - **fire as the ground shakes** (the owner swapped out the Darkness pulses at the third run: "I would rather use more particle and sound effects and lightning or fire"):
     - flames run along every layer, and lava sparks every 3rd;
     - with every wither's crunch (every 8th layer), fire bursts across the layer with a blaze's roar, and a bolt (only for show) strikes one of the Shrine's corners, 3 blocks out, going round in turn (8 in all);
   - **lightning** rings the Shrine (6 bolts, 28 blocks out) when the head is placed.
5. **The finish:** the altar's lectern and Technoblade's head (with its skin) are placed exactly as in the schematic.
6. **The steps up to the altar** (owner decision 2026-11-14, from the owner's idea): the pedestal is 22 blocks high, so the script lays a flight of **barrier blocks**: solid, invisible, and no monster can spawn on them.
   - **Where:** 3 wide, in the lectern's row, from the platform's edge east of the lectern down toward the rising sun, one block out and one down per step, until it meets the ground (at most 12 below the base). On the test server's ground that was 21 steps.
   - **They only fill air,** so they never cut into the build or the land.
   - **Faint red dust** marks the middle of each step once a second while anyone is within 48 blocks. The owner, climbing them in survival: "stairs are perfect, I can see where they are and everything".
   - `/shrine repair` lays any missing steps again (and gives a Shrine risen before the steps existed its flight). `/shrine reset confirm` takes them away with the Shrine.

The chunks are force-loaded while it builds, as the Gladiator Arena does, and released afterwards.

**The Shrine stays** after the night, as the Shrine for the relic hunt (Act II).

## 4. The Ignition Rite ✅ built
**It's fought around the beam, before the Shrine has risen** (owner decision 2026-11-19, at the fourth run). The Shrine's site is empty ground under the red beam; the potatoes go into the beam.

**It begins by itself** during the night's event, once the beam is up and **every pilgrim online has gathered at it** (within 64 blocks of the site; checked once a second while the fires burn). They're told "All are gathered. Something stirs on the land around the beam.", and 8 seconds later (`AUTO_RITE_SECONDS`) the first wave comes. Night falls and a storm rolls in as it begins.
- **Someone still away** (or in another dimension) holds it: an op can start it with **`/shrine rite`** any time once the beam is up.
- **Holding it:** `/shrine stop` while it's due cancels it, and it isn't queued again until a reset ("The rite won't begin by itself. Start it with /shrine rite.").
- **A `/reload` or restart** while it's due keeps the time, and it begins once.
- **Outside the event** (the beam raised by hand with `/shrine beam up`), it never begins by itself.
- (A Shrine raised first with `/shrine rise force`, as in the earlier rehearsals, works too: the rite is then fought at the Shrine and the potatoes go on its altar.)

**Where the Inspectors come from** (owner decision 2026-11-20, at the fifth run's setup: "I find they often spawn in caves underground or in water"):
- **First, the braziers:** until half the potatoes are offered, each wave appears around the braziers, **3–7 blocks** from each (`BRAZIER_WAVE`), the braziers taking the Inspectors in turn. The rite opens with "Figures gather by the braziers", and each wave is announced as coming from them.
- **Then, the red glass:** at the beam's second surge (half the offering; `GLASS_WAVE.fromSurge`), those present are told "Half the offering burns in the beam. The Inspectors come for it now: the next waves rise around the beam itself." From the next wave on, they appear **4–6 blocks** from the glass, right on the offering place.
- **Braziers too far away aren't used:** a brazier more than 64 blocks from the beam is skipped, since its Inspectors (who see 64 blocks) couldn't find the pilgrims. With none that near, or with a Shrine already raised by `/shrine rise force`, the waves come from the old ring, 30–45 blocks from the site.
- **The ground:** each Inspector's spot is the top of the ground there, through leaves and hanging plants (vines, glow lichen and the like) to the forest floor.
  - **Skipped:** anything wet (water, lava, kelp or seagrass reaching the surface, lily pads, any waterlogged block; `wetGround`), a tree trunk, the steps, or a spot under a hill.
  - **How far up and down it looks:** near the braziers and the glass, from 12 blocks above that spot to 6 below (`NEAR_SCAN`), so no ravine floors or cave mouths. On the old ring, 40 above to 20 below the site.
  - **Retries:** twelve spots are tried round its place (`SPAWN_TRIES`), then twelve anywhere round the same centre. Only then is one placed regardless, with a warning in the log ("No dry ground ...").
  - **Elsewhere:**
    - **The Stage 2 ambushes** find their ground the same way, 12 above to 6 below the player (at the fifth run one stood stuck on a spot 26 blocks above a brazier).
    - **A Senior's two helpers** land 2–5 blocks from him on dry ground (before 2026-11-20 they used an older check that could put them on water or down a cave).
  - **The log** says where each wave came from and where every Inspector landed ("Rite wave 3: 4 Inspectors, from the braziers (10519 72 4324; ...; Senior 10531 73 4285)").
- **Nobody near the beam:** with no player (an op in creative counts) within 64 blocks, the rite waits: no waves, no Senior marked as fallen. The Inspectors' chunks aren't loaded then, so the script can't see them. On the test server (2026-11-20), a rite left running with nobody online took every wave for beaten and spawned 49 waves, 147 Inspectors, into the dark.
- **Strays from another night:** every Inspector carries a tag for the rite it belongs to (`shrine_rs_<serial>`), or the night for an ambush (`shrine_ev_<start time>`). One that loads with its chunk while it doesn't belong (another rite, or its rite no longer running) is taken away before it can fight or drop anything ("A stray Inspector from an earlier night" in the log). Those that wander out of the loaded chunks are out of the reach of a reset, a stop or the full offering: at the fifth run, 16 of run 4's, five Seniors with their potatoes among them, were found in a lake 100 blocks off, a reset and a day later.
- **Who counts as present:** the players in survival or adventure within 64 blocks of the Shrine when the rite starts (at least 1).
- **What the altar needs:** **8 potatoes per player present.** An op can change it with `/shrine need <n>`.
- **The rite's boss bar,** for everyone: "The Ignition Rite: 8 / 16 potatoes".
- **The Purge and the arena wait** while the rite is on (and while the Shrine rises), and the rite won't start while either is on.

**The waves** (owner decisions at the rehearsal, 2026-11-19, after the altar filled in under 2 minutes):
- **They keep coming until the altar is full.** There's no last wave.
- **Senior Inspectors lead every wave,** and only the Seniors carry the Potato King's Potatoes: **2 each**. The ordinary Inspectors and the Seniors' helpers drop nothing.
- **More Seniors as the waves go on** (owner decision 2026-11-21: "8 waves but instead of each senior inspector dropping 8 make it each drops 2 but add more senior inspectors as the waves increase"): wave n is led by `SENIORS_PER_PLAYER[n]` x the players present, rounded up, at least 1. The shares (0.25, 0.25, 0.375, 0.5, 0.5, 0.625, 0.75, 0.75) add up to 4 Seniors per player, which is the 8 potatoes per player at 2 each, so **the offering fills at about the 8th wave** whatever the number of players. Waves after the 8th (potatoes lost, say) use the last share.

| Players | Seniors in waves 1 to 8 | In all |
|---|---|---|
| 8 | 2, 2, 3, 4, 4, 5, 6, 6 | 32 (64 potatoes) |
| 7 | 2, 2, 3, 4, 4, 5, 6, 6 | 32 (56 needed: full at wave 8) |
| 4 | 1, 1, 2, 2, 2, 3, 3, 3 | 17 (32 needed: full at wave 8) |
| 2 | 1, 1, 1, 1, 1, 2, 2, 2 | 11 (16 needed: full at wave 7) |

| Wave | Ordinary Inspectors | Gear |
|---|---|---|
| 1 | 1 per player present (at least 3) | iron |
| 2 | 1½ per player (at least 3) | iron; the vindicators carry shields |
| 3 | 1 per player (at least 3) | diamond |
| 4 and every wave after | 1½ per player (at least 3) | diamond; the vindicators carry shields |

Each wave also has its Senior Inspectors. At most 12 ordinary Inspectors in a wave (`WAVE_MAX`). One in three is a pillager with a crossbow; the rest are vindicators with axes. The list is `WAVES`, and every wave after it uses its last entry.
- **The next wave** comes once three-quarters of the last one is down (its Seniors count among them), or after 3 minutes (`NEXT_WAVE`). So two waves' Seniors can be up at once. With 8 players the last waves are heavy: 12 ordinary Inspectors and 6 Seniors, each calling 2 helpers at half health, up to 30 at once (`RITE_ALIVE_MAX` holds the next wave until they're thinned).
- **A rite nobody fights** stops growing: no new wave comes while 30 of the rite's Inspectors are up (`RITE_ALIVE_MAX`).
- **The Inspectors:**
  - vindicators and pillagers named **Inspector** in gold. Their armour protects them, though illagers don't show it;
  - they see players up to 64 blocks away, and once a second any without a target is sent after the nearest pilgrim at the Shrine;
  - they don't despawn, and every one left is removed at the Awakening;
  - they drop nothing.
- **The Senior Inspectors,** mini-bosses, leading every wave:
  - 150 health, diamond armour, a netherite axe, Resistance I, and the name in bold;
  - one boss bar per wave with their health together: "Senior Inspector (wave 1)" for one, "Senior Inspectors (wave 6): 4 of 5 standing" for more, so two waves up at once show two bars. Each is tagged with his place in the wave (`shrine_sid_<wave>_<k>`);
  - at half health each calls two Inspectors in diamond to help, once;
  - when one falls, he drops 2 Potato King's Potatoes, and those present hear "The Senior Inspector falls. His clipboard does not." (with several: "A Senior Inspector falls. His clipboard does not. 3 more of wave 6 still stand.")

**The Potato King's Potatoes:**
- **What they are:** potatoes named *Potato King's Potato* in gold, with a glint and the lore "Technoblade's own. Hoarded by the Inspectors."
  - They're dropped where a Senior Inspector dies, 2 each (`SENIOR.potatoes`).
  - They're marked (`trollcraft.kingspotato`), so the script knows them.
- **Only for the offering:**
  - they can't be eaten or planted ("Only the Shrine's altar will take these"), and a right-click on any block but the beam's red glass (or, with a Shrine standing, its altar) is refused;
  - the Blood Pool's tithe and `/potatowar offer` ignore them (`blood_pool.js` skips marked items).
- **Leftovers** crumble to nothing at the Awakening, in pockets and on the ground. The owner decided there's no keepsake.

**The offering: into the beam** (owner decision 2026-11-19):
- **Where:** right-click **the beam's red glass**, where it comes out of the ground at the site's centre, with the potatoes: every one the player carries is offered. Each offering is counted for the player who made it, and everyone present is told ("Carol offers 6 Potato King's Potatoes to the beam. 10 of 40.").
- **The beam can't be broken** while it's up, outside creative ("The beam will not be broken"): its red glass, beacon and iron.
- **The beam surges at each quarter of the bar:** a ring of fire round it, 3 blocks out at the first quarter and 3 more at each after, lava sparks, a blaze's roar, and a bolt for show into the beam.
- **(With a Shrine already standing,** from a rise forced first, the offering goes on its altar, the lectern or Technoblade's head, and each quarter lights the next band of the statue, as before.)
- **Full:** "The beam blazes. Beneath it, something enormous stirs." No more waves come.
  - **During the event, the night carries on by itself** (owner decision 2026-11-19, from "Once the event potatoes are offered at the altar, inspectors should despawn and the players should teleport to in front of the stairs to watch the shrine awaken"):
    - every Inspector vanishes at once in a puff of smoke, the Seniors' bars with them: "The Inspectors crumble to ash. Nothing stands between you and the Shrine now.";
    - 3 seconds later (`GATHER_DELAY_TICKS`), everyone online but spectators is **brought back from the beam to the viewing spots** ("You are drawn back from the beam. Watch."), facing the beam 20 blocks up. Soul fire rises at the site's corners.
      - **Where:** on the viewing platform (`/shrine view set`; it's built again first if it's gone): the first on the owner's spot, the rest on the cells nearest it, up to 36. Mobs can't spawn on barriers, and nothing on the ground reaches that high. At the fifth run, held on the ground, the owner had mobs spawning round them and couldn't move away.
      - **When the night ends** (and at `/shrine stop`, which lets them go), everyone on the platform is **set down in front of the lectern**, facing it (the owner's choice), if the Shrine stands, at the start if not, and the platform is taken away. Anyone offline then, still where it was, is set down there when they next join. A reset sets them down at the start.
      - **Without a platform,** east of the site, 4 blocks beyond the furthest the steps can reach (about 55 blocks from the centre, so the whole statue will be in view and nobody stands where a step will be laid), in the same rows, **on the ground**: through leaves and vines, never on top of a tree. At the fifth run (2026-11-20) the spot picked by itself was on a canopy, vines between the owner and the Shrine.
    - they're **held there** until the night ends (through the Awakening and the rise): anyone more than 2½ blocks from their spot (`HOLD_RADIUS`) is put back, once a second;
    - the Awakening **begins by itself** 10 seconds later (`AUTO_AWAKEN_SECONDS`). The ops are told when, and `/shrine status` counts down;
    - `/shrine stop` while it's due holds it and lets everyone move ("Start it with /shrine awaken"). A `/reload` or restart keeps the time.
  - **Outside the event** (a forced rehearsal), ops are told "/shrine awaken", and the Inspectors stay until the Awakening.
- **The Awakening waits for a full offering:** `/shrine awaken` refuses until then, and `/shrine awaken force` goes ahead anyway.
- **Effects** (2026-11-19):
  - each wave comes with a raid horn and "WAVE 3" on the screens of those present ("A Senior Inspector leads them");
  - a Senior falls in a burst of red dust with a flash;
  - each quarter, the beam surges (above).

**Pausing:** `/shrine stop` during the rite stops the waves and takes the Inspectors away; the altar keeps its count. `/shrine rite` carries on, and the wave that was cleared away comes again, with its Senior. A Senior from an earlier wave who was still up is gone with his potatoes.

**Knockouts instead of deaths** (owner decision), like the Gladiator Arena:
- **When:** lethal damage to a player within 64 blocks of the Shrine, from the start of the rite until the Awakening. (On the night, the event's knockouts cover everyone else too.)
- **What happens:**
  - they're healed and their fire is put out;
  - they're set down at the Shrine's edge (the nearest side, 3 blocks out, on the ground) with 3 seconds of Resistance V;
  - nothing drops.
  - `/kill` still kills.
- **The log** says who was knocked out and what would have killed them ("Knockout: leelinda (mob)").
- **No credit:** a knockout is no kill for anything else (bounties, the Anamian Axe's Souls, the Maul's Grit and the rest). The script loads early (`// priority: 100`) so it cancels the death before other scripts see it.

## 5. The Awakening ✅ built
**It's held at the beam, before the Shrine rises** (owner decision 2026-11-19), with everyone watching from the viewing spots. **During the event it begins by itself** once the offering is full (Stage 4). Otherwise **`/shrine awaken`**, once the offering is full (`/shrine awaken force` goes ahead anyway). It's respectful: no jokes. About 49 seconds, step by step (`AWAKEN_STEPS`); a `/reload` or restart carries on from the next step. **When it ends, the Shrine rises** (Stage 3), and the night ends when it stands.
- **Effects** (2026-11-19):
  - **the Blood God's words** fill everyone's screen a sentence at a time (2 seconds each, `LINE_TICKS`), as well as in chat, each line with red fireworks bursting high over the statue. His very last sentence fills the screen as a title: "BLOOD FOR THE BLOOD GOD.";
  - **while he speaks** (the owner, at the third run: "I need more dramatic effect while the blood god is talking. Fire particles, lightning, heart beats. The works"), with the settings in `SPEAK`:
    - a heartbeat everyone hears (the Warden's) once a second, twice as fast on his last line;
    - a dragon's growl as each line begins, and a blood-red mist around the Shrine with each beat;
    - with each sentence: a column of fire up the beam (where the statue will stand), lava and soul fire raining from 64 blocks up, flames at the watchers' feet, and two bolts for show in a ring 34 blocks out;
  - **as he breaks the seals:** lightning rings the site (8 bolts, 26 blocks out), with more fireworks;
  - **soul fire** rises at the site's corners as it begins and as he breaks the seals;
  - **the end** (49 seconds in, 3 seconds after his last words): the Shrine begins to rise. (With a Shrine already standing, from a rise forced first, the night ends here instead.)
- **Lightning is only for show:** a bolt made "visual only" can't set fires or hurt anyone. If the game won't make one, flashes, sparks and thunder take its place, never a real bolt.
1. **At once:**
   - **Clean-up:** every Inspector left is removed, and leftover Potato King's Potatoes crumble.
   - **The title:** everyone at the Shrine (within 64 blocks) sees "The Shrine awakens" and hears a respawn anchor set.
   - **The tribute:** the Techno Tribute for everyone at the Shrine (`/techno all`), and a server-wide `/superaura @a`.
2. **The Blood God speaks** once the tribute has played (28 seconds in), in lines to everyone online ([BLOOD GOD], as the Pool's own messages):
   > You lit my fires. You fed my Shrine. You remembered.

   Then 6 seconds later:

   > Eight things were mine. They were scattered, stolen, forgotten. Restore them here, and my name returns with them.
3. **The Regalia** (38 seconds in):
   - `/regalia` opens on the eight relics, and everyone is told, with a `[/regalia]` to click: "The Blood God has named the Regalia of the Blade. Its book will lie on his Shrine's altar.";
   - the book *The Regalia of the Blade* is laid on the altar's lectern when the Shrine stands, with sparkles and a page turning (at once, if a Shrine already stands).
4. **The seals** (44 seconds in), with lightning round the site 2 seconds later:
   > I break the third seal, and the fourth with it. Blood for the Blood God.
5. **The Pool, when the night ends** (`breakSeals`), after the Shrine has risen and stood: everyone has been let go and has their belongings back. Owner decisions 2026-11-19: no vote; the Blood God breaks the seals himself.
   - **Why at the end** (owner decision at the fifth run, 2026-11-20: "the blood pool increase needs to happen after the whole shrine is completely built, the reload skips the best part of the shrine being built"). Opening a tier reloads the server. At the fifth run, with the Pool still in the Awakening, the reload stalled the server for 5.6 seconds. The rise began a second later, while the server caught up, so its first layers appeared all at once.
   - **Once a night** (`awake.pooled`): a `/reload` or restart at the end doesn't do it twice. `/shrine status` says "the seals break and the Pool rises when the night ends" until then.
   - **With a Shrine already standing** (a rise forced first), the night ends as the Awakening does, and the Pool rises then.
   - **The Drops:** the Pool is raised to **a quarter of the way from Tier 4's threshold to Tier 5's** (`POOL_AFTER`). With `blood_pool.js`'s tiers (200,000 and 320,000) that's **230,000 Drops**, about 164,000 added on the night (from 66,000).
   - **Credited to nobody** (owner decision at the rehearsal, 2026-11-19): the Drops count toward the tiers but go on no player's contribution (`/bloodpool top`), as with an op's `/bloodpool add`. The potatoes offered at the altar fill the rite's bar and nothing else.
   - **Already there:** if the Pool is already past 230,000, nothing is added.
   - **The seals:** the Shrine opens every tier up to **Tier 4** itself (`OPEN_TIER`, through `global.BloodPool.openTo(4, 'the Shrine')`), whatever the Pool holds. Tier 3 opens **the Nether**.
     - The Pool announces it as it does any opening: its title and lines for Tier 4, "A Font", with the Nether's own message, then a `/reload` for the recipes.
     - The log says "[Shrine] The Awakening broke the seals: Tier 2 to 4".
     - A tier already open stays as it is: nothing is ever closed.
     - With an older `blood_pool.js` (no `openTo`), the log warns and the seals stay for a vote or an op.
   - **The order:** the seals break first, then the Drops land. Otherwise the Pool would see the sealed tiers as ready and call for a vote a moment before the Shrine opens them (seen at the rehearsal).

**The reward is the Drops:** there's no title or keepsake (owner decision).

**The altar:**
- **Before the Awakening:** in the schematic, the lectern is in its "has a book" state with nothing in it. So when the Shrine has risen, the lectern is emptied, and it waits for the book.
- **A taken book:** a book taken from the lectern is replaced within 5 seconds, so the taker keeps a copy and the altar keeps the book. `/shrine book` puts it back by hand.

**Protecting the Shrine** (added after the test, where a stray left-click in creative broke the lectern and Technoblade's head):
- outside creative, the Shrine's blocks can't be broken or built on;
- **the altar (the lectern and the head) can't be broken even in creative;**
- explosions in it break nothing.
- **`/shrine repair`** puts it back as it was built: every layer placed again over it, so only missing or broken blocks change, and the head comes back with its skin. Then the book goes back on the altar, if the Regalia is open.

### The Regalia of the Blade (the book on the lectern)
Signed *The Blood God*. One page per relic: what it honours, then what it asks. The last line, "When the Crown returns, so does my name.", has a page of its own, since a page holds only 14 lines (on the test server it was cut off at the end of the Crown's page). So the book has 10 pages. The amounts are placeholders until the owner sets them.

> THE REGALIA OF THE BLADE
> Eight things were mine. Restore them at my Shrine, and my name returns with them.

(The Axe of Peace's and the Swine's Oath's pages changed 2026-11-20, with their relics: 1,000 blocks of cobalt and 128 blocks of pig iron; Carl's Bridle's too, from a bred horse to his tack; STORY.md #37.)

> **THE WAR CHEST**
> For the Potato War, which I won.
> Fill it again: ten thousand potatoes.

> **THE AXE OF PEACE**
> I carried it in peace. Mostly.
> Bring me the metal to forge its equal: a thousand blocks of cobalt.

> **THE TOTEM HOARD**
> I never died. I simply declined to.
> Bring me sixty-four Totems of Undying.

> **THE WITHER'S DUE**
> I once loosed withers on a nation that wronged me.
> Bring me eight Nether Stars.

> **THE CHALICE OF BLOOD**
> Blood for the Blood God. It was never a metaphor.
> Fill it: a thousand buckets of blood.

> **CARL'S BRIDLE**
> For Carl, the finest horse who ever lived.
> Bring me his tack: thirty-two saddles and sixteen suits of diamond horse armour.

> **THE SWINE'S OATH**
> For the pig who wore the crown.
> Forge me pig iron, iron and blood made one: a hundred and twenty-eight blocks.

> **THE CROWN OF THE BLADE**
> My crown. They wore it. They used it.
> Last, and hardest: awakened draconium, a dragon's heart, a Gaia spirit and a shard of chaos.

> When the Crown returns, so does my name.

The Crown's page plants the final act: "They wore it" points at the Ministry ruling in his name.

## `/regalia` ✅ built (the basic one)
**`/shrine awaken` opens the relic hunt**, so a basic `/regalia` exists for the night. It's for everyone, not just ops:
- **Before the Awakening:** "The Blood God has named nothing yet."
- **After it:**
  - the eight relics, with how many are restored;
  - each relic's progress, e.g. "The War Chest  0 / 10,000 potatoes", with its top three contributors;
  - hovering over a relic shows what it honours and what it asks.
- **The Shrine holds the progress,** server-wide. Other scripts can read it through `global.Regalia` (`isOpen()`, `relics`, `progress(id)`, `isRestored(id)`, `restoredForSeals()`, `sealRelics`).
- **Each relic is shown in its own unit** (blocks of cobalt, buckets of blood), with its top three contributors, and the last line counts the relics for the seals: "each one restored breaks another seal (2 of 7)".

## Act II: the Regalia restored at the altar ✅ built (2026-11-20)
**Relics break the seals** (owner decisions 2026-11-20, STORY.md #37): from Tier 5, each Blood Pool seal also needs one more relic restored (Tier 5: 1 ... Tier 11: 7). The Crown isn't one of them: it's for the final act. The Blood Pool's side is in [BLOOD_POOL.md](BLOOD_POOL.md#relics-break-the-seals).
- **The words:** the Blood God's Regalia line at the Awakening ends "With each one returned, I break another seal.", and the book's first page reads "Eight things were mine. Restore them at my Shrine: each one returned breaks another seal, and with the last, my name returns."
- **Delivering:** once the Shrine stands and the Regalia is named, right-click the altar (the lectern, or Technoblade's head above it) holding what a relic asks. The whole stack goes in, and the same relic's things anywhere else in the inventory with it (totems and saddles don't stack), up to what the relic still needs; the rest stays. Worn armour and the off hand are left alone. Anything else lets the lectern's book open as usual.
  - **What each takes** (`DELIVER`; each relic keeps its tally in base units, `per` of them to one of its unit):

    | Relic | Takes | Counted as |
    |---|---|---|
    | The War Chest | potatoes, and Quark's, Farmer's Delight's and Thermal's potato crates (9 each); never the Potato King's | 10,000 potatoes, for the relic only (no Standing, no Drops) |
    | The Axe of Peace | anything tagged `forge:ingots/cobalt` (1) or `forge:storage_blocks/cobalt` (9) | 1,000 blocks (9,000 ingots) |
    | The Totem Hoard | Totems of Undying | 64 |
    | The Wither's Due | Nether Stars | 8 |
    | The Chalice of Blood | EvilCraft blood (`evilcraft:blood`), drained from whatever holds it: a bucket of blood, or a tank. The container comes back empty | 1,000 buckets (1,000,000 mB) |
    | Carl's Bridle | saddles and diamond horse armour (neither can be crafted in this pack), each filled on its own | 32 saddles and 16 diamond horse armour |
    | The Swine's Oath | `forge:ingots/pig_iron` (1) or `forge:storage_blocks/pig_iron` (9) | 128 blocks (1,152 ingots) |
    | The Crown of the Blade | nothing yet: it waits for the final act | |

  - **Credit:** each giver is told ("You give 64 blocks of cobalt to The Axe of Peace: 64 of 1,000 blocks of cobalt."), and `/regalia` credits them. Everyone online is told at each quarter ("The Axe of Peace is half restored").
- **Carl's Bridle** (owner decision 2026-11-20; it was a near-perfect bred horse, ridden up to the Shrine): its tack. Saddles and diamond horse armour come only from structure chests, villagers and fishing, so it's an exploration hunt. `/regalia` shows each part ("saddles 12 / 32, diamond horse armour 3 / 16").
- **A relic restored:**
  - **Everyone sees and hears it:** "THE TOTEM HOARD / is restored" on every screen, a challenge sound, lightning round the Shrine, red fireworks and soul fire.
  - **The Blood God says it:** "[BLOOD GOD] The Totem Hoard is mine again. Another seal will break for you.", and the count goes out: "1 of 7 relics for the seals".
  - **The Blood Pool hears of it** (`global.BloodPool.relicsChanged`): if the ready tier's seal no longer waits, the vote opens.
  - **A Shrine raid** (STORY.md #38, `RELIC_RAID`): 10 seconds later, Inspectors in diamond come for it on the ring 30–45 blocks round the Shrine, one per player within 64 blocks (3 to 10). Outside the night's event, these deaths are real deaths. Set `RELIC_RAID.min` to 0 to turn raids off.


## Commands (op)
| Command | What it does |
|---|---|
| `/shrine status` | The sites, the stage, the braziers, the rite's bar and who offered what |
| `/shrine site set [x y z]` / `/shrine brazier set <1-3> [x y z]` / `/shrine start set [x y z]` / `/shrine view set [x y z]` | Set the Shrine's centre, a brazier, the start or the viewing platform where you stand, or at those coordinates in the Overworld (the console can too). The viewing platform is built at once (6 x 6 barriers, a rail round it), clear of the Shrine's footprint; it can't move while everyone is on it |
| `/shrine signal` | Stage 0: the scrambled message to everyone online, and to anyone who joins in the next 24 hours |
| `/shrine summons` | Stage 1: the book *A Summons* for everyone online, and for anyone who joins until the Awakening (needs the three braziers set) |
| `/shrine braziers` | Stage 2: place the braziers, bring everyone to the start, start the event (knockouts for everyone until the Awakening ends) |
| `/shrine fires light` / `/shrine fires out` | Light all three by hand (the beam goes up), or end a running clock early |
| `/shrine beam up` / `/shrine beam down` | Raise or lower the beam by hand |
| `/shrine ambush <player>` | An Inspector ambush on that player and the pilgrims near them |
| `/shrine rise` / `/shrine rise force` | Stage 3, the last act: it rises by itself when the Awakening ends; `/shrine rise` by hand once the Awakening is done, `force` any time |
| `/shrine rite` / `/shrine need <n>` | Stage 4 by hand, once the beam is up (during the event it begins by itself once everyone has gathered at the beam), or carry on after `/shrine stop`; change what the offering needs |
| `/shrine awaken` / `/shrine awaken force` | Stage 5 by hand (during the event it begins by itself once the altar is full), once the altar is full; `force` goes ahead anyway |
| `/shrine book` | Put the Regalia book back on the altar |
| `/shrine repair` | Put the Shrine back as it was built (every layer placed again; the head with its skin), then the book and any missing steps |
| `/regalia` | **Anyone:** the eight relics and their progress |
| `/shrine stop` | Stops whatever is running (the opening, waves, clock, rise), removes Inspectors and leaves the rest; a rite or an Awakening due to begin by itself won't (a held rite isn't queued again; everyone held at the viewing spots is let go) |
| `/shrine clearmobs` | Takes away the monsters in and right around the Shrine (event mobs and named ones stay) |
| `/shrine reset confirm` | **Test server:** removes the Shrine, the braziers, the beam and the steps, ends the event, clears the sky, hands everyone's belongings back, and forgets the night, the Signal and the Summons included (the sites and the start are kept). It needs the word `confirm`, so it can't be run by accident on the live server |

## How it stays safe
- **No overlap:**
  - the Shrine's stages refuse to start while a Purge or a Gladiator match is on;
  - Purges and matches wait from `/shrine braziers` until the Awakening ends.
- **No secrets in Discord:** every message goes to each player by name (`player.tell`), never with `tellraw @a`.
- **The Ministry stays unnamed:**
  - the Inspectors, the Signal and every message are unsigned;
  - nothing says "Ministry".
- **The Blood Pool:**
  - the only Drops added are the Awakening's, through `global.BloodPool.addDrops`, and the only tiers opened are its seals, through `global.BloodPool.openTo` (which never lowers the tier);
  - the Potato King's Potatoes never reach the Tithe or anyone's Potato Standing.
- **A reload or restart mid-event:**
  - the stage, the brazier states, the bar and the offerings are saved, and `/shrine status` picks up from there;
  - a rise in progress carries on from its last layer.

## Built from
- **The statue:** `tools/kubejs/data/trollcraft/structures/shrine/l_0.nbt` … `l_63.nbt`. These were made from the owner's `technoblade_statue.schem` by `tools/schematic/schem_to_structures.js --layers`. They hold 7,237 blocks, and the lectern and the head keep their block data.
- **Placing structures and force-loading chunks:** the same way as `part2/gladiator_arena.js`.
- **The Inspectors' fighters:** from `factions/portal_ambush.js`.
- **The tribute:** `techno_tribute.js` (`/techno all`) and `smite.js` (`/superaura`).
- **The Drops and the seals:** `global.BloodPool.addDrops(n, 'shrine', uuid, name)` and `global.BloodPool.openTo(4, 'the Shrine')`.

## Decided (owner, 2026-11-14)
1. **The brazier lines:** direction and distance from the castle, filled in automatically.
2. **Deaths during the rite:** knockouts, like the Gladiator Arena.
3. **Pilgrimage ambushes:** both: one automatic ambush per brazier team, and `/shrine ambush <player>` for more.
4. **The Summons' last page:** "They want the Pool full. So do I." stays.
5. **The way up to the altar:** barrier steps, marked with dust (after the test rite, where nobody in survival could reach the lectern).
6. **The rise waits for the beam,** with `force` to skip it.
7. **The night's event** (2026-11-15): `/shrine braziers` brings everyone to a set start, and knockouts cover everyone until the Awakening ends, waking at the last brazier lit or the start.
8. **The Awakening's end** (2026-11-19): no vote. The Pool is raised to a quarter of the way past Tier 4 (230,000 Drops), and the Shrine breaks the third and fourth seals itself. The Blood God's last line: "I break the third seal, and the fourth with it. Blood for the Blood God."
9. **The rite begins by itself** after the rise (2026-11-19).
10. **The Signal and the Summons** as drafted (2026-11-19).
11. **The Awakening's Drops are credited to nobody** (2026-11-19, at the rehearsal): "I would rather this blood not be credited to any player".
12. **The rite's waves** (2026-11-19, at the rehearsal): "I don't like how easily the event potatoes are dropped". Waves come until the altar is full, each led by a Senior Inspector, and only the Seniors drop the potatoes, a fixed 8 each; the next wave comes as before (three-quarters down, or 3 minutes).
13. **The night ends by itself** (2026-11-19, after the second run): "I need the event to start automating itself. Once the event potatoes are offered at the altar, inspectors should despawn and the players should teleport to in front of the stairs to watch the shrine awaken."
14. **The night's kit** (2026-11-19): diamond armour, a diamond sword with Sharpness IV, a shield and a flint and steel (added at the third run), all Unbreaking X, plus 16 steak. It's given at `/shrine braziers` and to anyone joining mid-event, and belongings come back when the Awakening ends.
15. **Cinematic effects** at every stage (2026-11-19): the fires and the beam, the rise (with night and a storm), the rite, and the Awakening.
16. **Knockouts stay as they are** (2026-11-19), after the second run's loop at the Shrine's edge.
17. **The Shrine is the climax** (2026-11-19, at the fourth run): "I want the shrine to be the climax ending instead of in the middle". The order is now the braziers and the beam, the Ignition Rite around the beam, the Awakening at the beam, and the Shrine rising last; the night ends when it stands.
18. **The offering goes into the beam** (2026-11-19): right-click its red glass; each quarter, the beam surges with a ring of fire and a bolt.
19. **The waves come from the braziers, then the glass** (2026-11-20): "How about we make the inspectors spawn around the braziers and then at the red glass where potatoes are deposited", because "they often spawn in caves underground or in water". Around the braziers until half the offering, then 4–6 blocks from the red glass (the owner's pick of the distance).
20. **The Pool rises after the Shrine is built** (2026-11-20, at the fifth run): "the blood pool increase needs to happen after the whole shrine is completely built, the reload skips the best part of the shrine being built". The seals break and the Drops land when the night ends; the Blood God's words and their lightning stay in the Awakening.
21. **The owner sets the viewing spot** (2026-11-20, at the fifth run, after being put on a tree canopy with vines in the way): `/shrine view set`. Without it, the spot picked by itself is on the ground.
22. **The viewing platform in the sky** (2026-11-20, at the fifth run's rerun): "mobs kept spawning near me when I couldn't move away while the shrine spawned. instead I would like to set a spot in the sky using a command that will create a 6x6 platform of barrier blocks which all players are teleported to". When the night ends, "everyone is teleported to infront of the lecturn".
23. **Waves at the braziers** (2026-11-20, at the fifth run's rerun, after "the initial wave of inspectors just stops once killed during the brazier lighting"): "There will be 7 to 8 players on the event at the same time. Make sure to balance it accordingly. Waves should continuously spawn". The numbers are `BRAZIER_WAVES` (above), to tune at the next rehearsal.
24. **The opening** (2026-11-20): "let's make the start of the event more dramatic". Chosen: fires on the horizon and an Inspector broadcast; nobody held ("Free to move"); about 30 seconds. Not chosen: the Blood God speaking at the start, night falling at the start.
25. **Tuned before release** (2026-11-21): the brazier waves made harder (every 20 seconds, 3 + 1 per pilgrim, at most 8 a group, 16 up); each Senior Inspector drops 2 instead of 8, with more Seniors as the waves go on, so the rite still takes about 8 waves. The potatoes per player (8) and the braziers' look stay as they are.
26. **The fires easier to find** (2026-11-21, at the sixth run): the pillars go up again every 30 seconds until each is lit, and everyone gets the fires' coordinates in chat at the start.
27. **Lit by kneeling** (2026-11-21, at the sixth run): "instead of flint and steel lighting them immediately players should have to shift for 2 seconds without taking damage to light them". The flint and steel left the kit. At the rerun: "maybe reduce the lighting time to 1 second", so it's a second. Then 1.5: "make it 1.5 seconds".
28. **A longer rise, with more fire** (2026-11-21, at the sixth run's rerun): 45 seconds instead of 29, with pillars of fire round the Shrine that grow with it and a climax with the last stone.
29. **Less time to light them** (2026-11-21): the window after the first fire is lit is 45 seconds instead of 60.
30. **The kit made new every 3rd knockout** (2026-11-21): "kits need to be refreshed after every 3 knock outs". The owner's verdict after the sixth run's nights: "I think this is ready".

## Still open
- **Still needed from the owner:** the three brazier sites, the Shrine site and the date.

## Install (what's built so far)
1. Copy `server_scripts/part2/shrine.js` to `kubejs/server_scripts/part2/`.
2. Copy the 64 layers, `data/trollcraft/structures/shrine/l_0.nbt` … `l_63.nbt`, to `kubejs/data/trollcraft/structures/shrine/`.
3. Copy `server_scripts/part2/blood_pool.js` from the same update: the Awakening opens the seals through its `openTo`.
4. Run a full `/reload` (it adds the `/shrine` command). `/shrine status` should say "The rise: not started" with no warning about missing layers, and end with "The Signal: not sent" and "The Summons: not given".

## How the rise works (built)
- **The box:** 42 × 43 blocks and 64 tall, centred on the site, from the site's ground level up. `/shrine site set` says its corners.
- **Each layer:** every 14 ticks (`LAYER_TICKS`), about 45 seconds for all 64 (9 ticks until 2026-11-21):
  - its slice of the box is cleared to air;
  - the statue's layer is placed with `/place template trollcraft:shrine/l_<n>`;
  - stone sounds play: `block.deepslate.place` at every layer, `block.grindstone.use` every 3rd and `entity.wither.break_block` every 8th, and dust and smoke rise along it;
  - `block.respawn_anchor.charge` sounds at layer 0, layer 21 (the pedestal's top) and layer 63 (the head), with thunder at the last two.
  - the pillars of fire round it grow by a block (see "The fire" above), and with the last layer comes the climax.
- **Players in the way:** anyone inside the footprint is moved to the nearest side, 3 blocks out, onto the ground there, and told to stand back. It's checked again at every layer, so walking back in doesn't work.
- **Who's told:** players within 128 blocks get the narration and a "The Shrine rises" title when it begins, and "Technoblade's Shrine stands" when the last stone settles.
- **Chunks:** the box is force-loaded while it rises, and released after. If its chunks don't load within 90 seconds, the rise pauses.
- **Pausing and failures:** `/shrine stop` pauses it, and a layer that won't place pauses it at that layer (with an error in the log). `/shrine rise` carries on from there.
- **Restarts:** `/reload` or a restart mid-rise carries on from the last layer, with one loop only.
- **The beam first:** a new rise refuses until the beam is up, unless `force`.
- **The steps:** laid when the last layer settles (see Stage 3).
- **Busy:** it won't start during a Purge or a Gladiator match. `global.Shrine.busy()` says "the Shrine is rising" while it runs.
- **Taking it down (test server):** `/shrine reset confirm` moves anyone off it, clears the box with four fills of air from the top, takes the steps away (barriers only), removes loose items, and forgets the night. The sites are kept.

## No monsters in the Shrine (built)
The owner saw a lot of mobs spawning inside the Shrine on the test server. Lighting it up would only cover the dark inside: at night monsters also spawn on its open surfaces (the pedestal's platform, the statue's shoulders). Full light would also spoil the Ignition Rite, where the statue lights up band by band. So the script keeps them out instead:
- **No spawns:** once any of the Shrine stands (rising, paused or risen), no monster can spawn in its box or within 2 blocks of it (`SPAWN_MARGIN`), from its base to above the head. Below the base (caves) and further out, spawning is as usual.
- **Who's let in:**
  - event mobs, which carry a tag from this script, the ambushes, the Purge or the arena (`KEEP_TAGS`), so the rite's Inspectors and the ambushes still work;
  - mobs with a name, so an op can still summon a named mob for a set-piece;
  - animals.
- **Monsters already there** are taken away when the rise starts and when it finishes (some get walled in), and an op can clear them any time with `/shrine clearmobs`.
- **How a monster is recognised:** by its category, through `entity.entityType`, or `isMonster()`. `entity.getType()` is only the id as text in KubeJS 6, which is why the Gladiator Arena's spawn block never worked (fixed the same day).

**Checked on the test server:**
- `/shrine clearmobs` took away the 3 monsters standing in the Shrine;
- **refused:** zombies summoned inside it (on the pedestal and in mid-air) and a skeleton in the 2-block margin;
- **let in:** a named zombie and a cow inside, a zombie 9 blocks outside, and one below the base.

## Tried on the test server (2026-11-14)
The rise ran three times at a site in the sky (6000 150 6000), with the owner watching as leelinda.
- **The look:** "it looks fantastic". The owner asked for a faster rise, about 30 seconds instead of 4½ minutes. The second and third rises, at 9 ticks a layer, each took 28.4 seconds on the server's clock.
- **The sounds:** the Warden's dig, every 8th layer, sounded like "a strange squishing" rather than stone. The owner heard six candidates played in game, kept the deepslate sound, and liked all the others, so the rise now uses grinding stone, the wither's crunch and the respawn anchor's charge instead. The third rise with them: "perfect".
- **The blocks:** a sample of 508 blocks (400 at random, every block of the small top layers, the lectern and the head) was checked with `execute if block`, each with its full state. All 508 matched the statue's files after the first rise, and again after the faster second one. This covered all 64 layers, including the facing and shape of stairs, slab halves, panes, walls and the lectern.
- **Technoblade's head** kept its skin (its `SkullOwner` and texture), and the lectern stands on the altar.
- **Setting the site from the console** (`/shrine site set <x> <y> <z>`), `/shrine status`, the brazier directions, the `/reload` that adds the command, and `/shrine reset confirm` all worked.
- **The chunks** unload when the rise ends and lets go of them, unless a player is nearby. That's expected: on the night, the pilgrims are standing there.

## Stage 2 on the test server (2026-11-14)
The braziers were set 100 blocks around the sky site and `/shrine braziers` run from the console; lighting was done with `/setblock`.
- **Building:** all three were built (the unlit campfire, the plinth and the chains all checked).
- **The clock:** one lit started it. The boss bar read "The fires: 1 / 3   0:57" with a value of 57, shown to leelinda.
- **Guttering:** with two lit and no third after a minute, both guttered out (back to unlit), and the stage went back to waiting.
- **The beam:** with all three lit, it went up.
  - The beacon, the glass and the iron were in place.
  - The beacon reported `Levels: 1`, so its base is complete and the beam shines (the sky was clear).
- **Burning for the night:** a campfire put out after all three burned was lit again within a second.
- **`/shrine ambush leelinda`:** 3 Inspectors, named "Inspector" in gold, in iron chestplates.
- **When the rise began:**
  - the beam came out (the block under the site was air again, as before);
  - the fires went to "done" and stayed lit;
  - the ambushers were taken away;
  - the Shrine rose as usual.

## Stage 5 on the test server (2026-11-14)
The Awakening ran on the risen sky Shrine with leelinda standing by the altar.
- **The whole sequence played:** it began, then reported done 46 seconds later, and the book was on the lectern (`Book.tag.title` "The Regalia of the Blade").
- **The Pool:** the test server's Pool was already at 120,000 with Tier 3 open, so no Drops were added and no vote was asked for, as intended.
- **leelinda's feedback:**
  - **"I broke the lectern and techno's skull":** in creative, a left-click breaks a block. The book step put a lectern back with the book on it, but the head was gone. The Shrine is now guarded (above), and `/shrine repair` brought the head back on the test server, skin and all (its `SkullOwner` texture checked).
  - **"last page looks cut off":** the Crown's page ran past the page's 14 lines and lost the end of "When the Crown returns, so does my name." That line now has its own page (page 10, checked on the server). A check in the tests estimates every page's lines and would have caught it.

## Stage 4 on the test server (2026-11-14)
The Shrine rose on real ground at 10490 71 4304 (28 seconds), and leelinda ran the rite alone in survival, in a diamond kit.
- **The waves:** all four came, 3 Inspectors each, then 4 with the Senior Inspector. Wave 3 came early (1 minute 19 seconds after wave 2), once three-quarters of wave 2 was down. Waves 2 and 4 came on the 3-minute clock, with one Inspector of the wave before still about.
- **The Senior Inspector** fell, and his call for help worked: she carried 32 potatoes, and without his two helpers the Inspectors she killed could have dropped only 30.
- **The potatoes:** the dead Inspectors' King's Potatoes went into her pockets, marked (32 by the end).
- **The altar:** one right-click on the lectern offered all 32 at once. The altar was full (32 of 8), all four bands lit (light blocks found in each quarter of the statue's height) and ops were told to awaken.
- **The Awakening** took away the last Inspector and the one King's Potato left on the ground, left no boss bar behind, and finished in 46 seconds. The rite's status reads "done (32 potatoes offered)".
- **A knockout** came 6 seconds in, while she was away from the keyboard and not yet in her armour. She woke at the Shrine's edge, alive.
- **What it found, fixed the same night:**
  - **"I can't reach the lectern":** the pedestal is 22 blocks high, and the guard stops anyone building up it. So the barrier steps (Stage 3), the owner's idea. After `/shrine repair` laid them (21 steps), she climbed them in survival: "stairs are perfect".
  - **"one of the inspectors spawned underground":** the old spot search started 20 blocks above the site's height, so under a taller hill it found a cave. Another landed in a lake. Spots are now the top of the ground, coming down from 40 above, and water, trunks and the steps are skipped (above).
  - **She asked why the Shrine rose without the braziers** (they were skipped for this test): the rise now waits for the beam, her choice.
  - **The knockout's log line** didn't say what hit her; it does now.

## The whole night on the test server (2026-11-15)
The owner ran the whole night from `/shrine braziers` to the Awakening with the script's own commands, alone in survival, as an op, on real ground. The Pool was first put back to the night's start (Tier 2, 66,000 Drops), the braziers set 40–72 blocks from the Shrine site, the start beside it.
- **The first try** found that an ambush death was a real death (all three ambushes come at once when the braziers are this close: 9 Inspectors). The owner made `/shrine braziers` the event's trigger (above), and the run was reset.
- **The second run:**
  - `/shrine start set`, then `/shrine braziers`: she was brought to the start, and the event came on;
  - the three ambushes knocked her out, and she woke at the start ("woken at the start");
  - she lit the three braziers with flint and steel, and the beam went up (`Levels: 1`);
  - **`/shrine rise` was refused:** "A Purge is on", while `/purge` said none was running. The Shrine asked the Purge's `busy()`, which named the Shrine. Fixed (the event section above) and reloaded mid-run; the event, fires and beam carried on;
  - `/shrine rise` then worked under the beam with no `force`; the Shrine stood in 28 seconds, and the rise laid 21 steps itself;
  - **`/shrine rite`** (the owner had expected the Inspectors to come on their own after the rise; each stage is its own op command): 1 present, 8 potatoes. A knockout during the rite woke her at the Shrine's edge;
  - **an Inspector in a lake:** a lake fills the whole north side of the ring, so all twelve nearby tries failed and the fallback put one in the water. Fixed: the whole ring is searched first (the Stage 4 section above), and installed after the run;
  - the altar was full at 8 of 8 during wave 2, and she ran `/shrine awaken`. In 46 seconds it added 54,000 Drops credited to her (66,000 to 120,000), Tier 3 was ready, and the event ended ("deaths are deaths again");
  - afterwards: no Inspectors, boss bars or King's Potatoes left, and the Regalia book on the lectern.
- **The vote** needs 5 votes, so the seal couldn't be broken with one player. (The vote has since gone: the Shrine breaks the seals itself, owner decision 2026-11-19.)
- **The owner asked** whether everyone is told how long the rise takes: only the op's reply says so ("about 29 seconds"); players within 128 blocks get the shaking ground and a title. Left as it is for now.

## The rehearsal on the test server (2026-11-19)
The whole night with two players in survival, leelinda and Sipheon, every stage run from the console over RCON. The Shrine was first reset and the Pool put back to Tier 2, 66,000 Drops. The test copy of `blood_pool.js` took 2 votes to break a seal instead of 5.
- **Stages 0–1:** `/shrine signal` and `/shrine summons` reached both players. All three fires on the Summons' page read "about 11350 blocks toward the rising sun", since the test braziers stand together far from spawn.
- **Stage 2:** both were brought to the start and the event came on. All three ambushes came at once, 4 Inspectors each (the braziers are 10–25 blocks from the start). leelinda was knocked out four times and woke at the start each time. All three fires burned 47 seconds later, and the beam went up.
- **Stage 3:** `/shrine rise` under the beam with no `force`. The Shrine stood in 28.5 seconds with 21 steps.
- **Stage 4, beginning by itself:** the rite began 7.9 seconds after the rise ("began by itself"). 2 present, 16 potatoes. Waves 1 to 3 came about 30 seconds apart (3 Inspectors each, the minimum), Sipheon was knocked out four times and leelinda once, waking at the Shrine's edge. The altar was full 1 minute 39 seconds after the rite began, during wave 3.
- **Stage 5:** the Awakening ran its 46 seconds. The Pool went from 66,000 to 230,000 (164,000 Drops, all credited to leelinda, who offered all 16 potatoes; the owner then decided the Drops go to nobody). The seals broke from Tier 2 to 4 "by the Shrine", the Nether opened, the event ended, and the recipe reload had 0 failures.
- **Found and fixed the same night:** the Drops were added before the seals broke, so for a moment the Pool saw Tiers 3 and 4 as ready and told everyone to break the third seal with `/bloodpool vote`, just before the Shrine opened both. The seals now break first, then the Drops land (a check in the tests).
- **To tune** (for the owner): with two players the rite lasted under 2 minutes, not the 20 planned. The waves are at their minimum of 3 Inspectors, and 16 potatoes take 8 kills. **Changed the same night** (owner decisions): waves until the altar is full, a Senior Inspector leading each, and only the Seniors drop the potatoes, 8 each (Stage 4 above). Run in the second run below.

### The second run, the same night
Reset to the night's start (the Pool back to 66,000, Tier 2), and the contributors list cleared with the new `/bloodpool top clear confirm`. An op in game ran the rise.
- **Late arrivals:** the Signal and the Summons went out with one player on; leelinda joined after and got both.
- **The braziers:**
  - three ambushes of 4;
  - five knockouts, one of them waking Sipheon **beside a lit brazier**, the first time that was seen live;
  - the beam went up.
- **The new rite:**
  - it began by itself 8 seconds after the rise;
  - five waves of 3 Inspectors and a Senior;
  - the altar was full at 24 of 16, and 32 had been offered by the end.
- **The Awakening:**
  - the seals broke from Tier 2 to 4 first, then 164,000 Drops landed credited to nobody, with no "ready" or vote lines this time;
  - the Pool was at 230,000, `/bloodpool top` was empty, the Nether opened, and the recipe reload was clean;
  - no script errors all evening.
- **A knockout loop:** during the rite, leelinda was knocked out about 45 times in 3 minutes (Sipheon 16). She woke at the Shrine's edge with 3 seconds of protection, and the Inspectors there downed her again. The owner decided on no change.
- **What the owner asked for afterwards,** built the same night:
  - the night ending by itself once the altar is full;
  - a kit that doesn't break;
  - cinematic effects throughout.

### The third run, with the kit, the automatic ending and the effects
Reset again (66,000, Tier 2, contributors cleared); the two players ran the night in game, the ops' commands from both of them.
- **The kit:** both were kitted at `/shrine braziers`.
  - They had no way to light the braziers, so the owner asked for a flint and steel. It was added to the kit, and each was given one mid-run, marked as kit.
- **The braziers:**
  - three ambushes of 4 at the start;
  - about 30 knockouts there before any fire was lit, all woken at the start;
  - then all three fires and the beam.
- **The rise and the rite:**
  - the rise ran with the first version of the effects;
  - the owner then swapped the Darkness for fire and lightning (Stage 3), which wasn't seen at this run's rise;
  - the rite began by itself and ran three waves; the altar was full at 24 of 16.
- **The automatic ending, seen in game:**
  - the Inspectors vanished, and 13 seconds before the Awakening both were brought to the steps;
  - the Awakening began by itself, broke the seals from Tier 2 to 4, and added 164,000 Drops credited to nobody;
  - the event ended, and both players' belongings were handed back (backups marked `restored`: 7 stacks and 13);
  - it was day again (`time query daytime`: 1000).
- **Found:** the backup files went to `kubejs/shrine_vault_<name>_<uuid>.json`, not the `shrine_vaults/` folder (KubeJS doesn't make it). The docs and the ops' message now say so.

## The fifth run on the test server (2026-11-20): the new order, with one player
- **Before it:** the fourth run's rite resumed when the server started, with nobody online, and spawned 49 waves (147 Inspectors) into unloaded chunks; `/shrine reset confirm` with the site's chunks force-loaded took them away. Fixed: the rite waits with nobody near.
- **Seen working:**
  - the Signal, the Summons and the braziers;
  - the rite beginning 8 seconds after the owner reached the beam;
  - waves 1 to 3 coming from the braziers, spread over all three, on dry ground and none in water;
  - the switch at half the offering, the altar full (12 of 8);
  - the Inspectors vanishing, the owner drawn back to watch, the Awakening beginning by itself;
  - the seals broken from Tier 2 to 4 and 164,000 Drops credited to nobody;
  - the rise (29 seconds, 21 steps), the Shrine standing, and the night ending 5 seconds later with the owner's belongings handed back. The Pool ended at 230,000 with Tier 4 open.
- **Found and fixed:**
  - **No kit:** the owner was in creative at `/shrine braziers`, switched to survival, and had no kit. Knocked out about every 5 seconds by the Inspectors at their wake spot, 21 times. The kit now reaches anyone switching to survival.
  - **Strays:** 16 of run 4's Inspectors, five Seniors among them, in a lake 100 blocks away. Dropped into the void by hand; now taken away as their chunk loads.
  - **The ambush:** one ambush Inspector stood 26 blocks above a brazier. Ambushes now look 12 up and 6 down.
  - **The reload:** the Pool's reload at the end of the Awakening stalled the server 5.6 seconds, and the rise's first layers came all at once. The Pool now rises when the night ends.
  - **The viewing spot:** it was on a tree canopy with vines in the way. The leaves and vines were cleared by hand that night; now `/shrine view set`, and the spot picked by itself is on the ground.
- **Not seen:** where wave 4 rose (round the glass, by the code): the owner cut it down within 5 seconds, and the log didn't record spawn spots then. It does now.
- **Not explained:** the owner's own `/shrine stop` during the knockouts didn't take; the console's did.

### The reruns the same evening (2026-11-20)
- **The second night** (21:45 to 21:48): waves 1 to 3 from the braziers; the rise in 28 seconds with nothing skipped; the night ended at 21:47:46, and only then did the seals break and the Pool rise to 230,000 (the reload's 4.5-second stall came after). The Pool's move to the night's end works in game.
- **A 35-second stall** (21:58:01 to 21:58:36) during the brazier stage of a third start: not the garbage collector (4 seconds of it in all since the restart, no full collections) and nothing in the log; most likely the PC, running the game and the server side by side. A watchdog for thread dumps saw nothing more.
- **The last night** (22:08 to 22:11), the owner alone: brazier waves at all three fires and a second round 30 seconds later; all three lit in 39 seconds; rite waves 1 and 2 from the braziers; the altar full at 22:09:51; the owner brought onto the platform 20 blocks up; the Awakening, then the rise in 28 seconds; at the night's end the owner was set down at the altar and the platform's barriers were gone; then the Pool rose to 230,000 at Tier 4. No knockouts all night. The owner: "this will work".
- **Still not seen:** a wave rising round the red glass (the 8 potatoes went in at once each time).

## The sixth run on the test server (2026-11-21): the opening, with one player
The owner alone (as leelinda), with the test server's copy giving more Senior Inspectors a wave (`SENIORS_PER_PLAYER` [1, 1, 2, 2, 2, 3, 3, 3], marked TEST SERVER ONLY).
- **The opening** played in full, 16:57:51 to 16:58:19. But the test server's start is within 25 blocks of all three braziers, so at second 0 three ambushes and three brazier waves (21 Inspectors) came, and knocked the owner out 3 seconds in. Fixed: the Inspectors now wait for the opening.
- **The owner's verdict, "Something was off":** the pillars should go up every 30 seconds so players can track them, and the coordinates should be given in chat in case the fires are out of view (decision 26). Then: light them by kneeling, not flint and steel (decision 27).
- **The fires** all burned at 16:58:52; the rite began by itself 8 seconds after.
- **Rite waves 1 to 6** came 1, 1, 2, 2, 2 and 3 Seniors strong. **The waves moved to the red glass at wave 5**, once half the offering was in: the first time that switch was seen in game.
- **Six knockouts** in the rite, alone against it, each woken at the Shrine's edge.
- **The altar filled** at 17:00:39 (20 offered for the 8 needed: an offering takes every King's potato carried). Then the Awakening at 17:00:52, the rise at 17:01:41, the Shrine standing at 17:02:10, and the night's end at 17:02:15, with the owner's belongings handed back.
- **The relic delivery** (17:12:48): 8 Nether Stars at the altar restored The Wither's Due ("1 of 7 for the seals"); the Blood Pool logged "Tier 5's seal no longer waits on relics" and went on to the vote; the relic raid came 10 seconds later, 3 Inspectors.
- **The rerun** (17:14:16, after `/shrine reset confirm`, which also forgot the relic): no Inspector during the opening; then the three ambushes and the brazier waves at 17:14:47. **Kneeling worked:** "leelinda kindled brazier 1" at 17:16:11. But alone, within 40 blocks of all three braziers at once, the owner drew all three fires' waves (12 every 20 seconds, 48 up at the end) and was knocked out over and over; brazier 1 guttered out at 17:17:12. The waves are sized for teams split between the fires.
- **After the Inspectors were cleared and kindling cut to 1 second** (17:17:32): the owner kindled brazier 2 at 17:18:03, 1 at 17:18:08 and 3 at 17:18:17, all three in 14 seconds; the rite ran 5 waves (all from the braziers: the offering went in at once, at 17:19:39, 12 for the 8 needed); the Awakening, the 29-second rise and the night's end at 17:21:14 followed. Then the owner asked for 1.5 seconds and the 45-second rise with more fire (decisions 27 and 28).

## What couldn't be verified yet
- **The kit made new** (2026-11-21, mock-tested only): the fresh pieces and the off-hand shield as a player sees them, and the count carrying across a `/reload` (it's in the saved data).
- **The fires' coordinates and the pillars every 30 seconds** (2026-11-21, mock-tested only): how the coordinates look in chat, and whether a pillar is seen from far off.
- **The rise's fire** (2026-11-21, mock-tested only): how the pillars and the climax look from the platform, whether 8 pillars of up to 70 blocks plus the shockwave weigh on players' frame rates (the counts are in `risePillar` and `RISE_FIRE`), and the pillars kept clear of the platform (that part isn't covered by a test).
- **The opening** (2026-11-20, mock-tested only): whether the fire pillars, 96 blocks out, read as fire on the horizon through the fog at the server's view distance; the thunder's direction (`execute ... facing ... ^ ^ ^16`); how the `[INTERCEPTED]` lines look in chat and on Discord (they go to each player, so Discord shouldn't get them); the sounds `block.sculk_sensor.clicking` and `block.note_block.bit` as the crackle.
- **The relic deliveries** (2026-11-20, mock-tested only):
  - item tags (`item.hasTag('forge:ingots/cobalt')`) and the lectern's right-click with a relic item in hand (the book shouldn't open);
  - draining blood through Forge's fluid capability (`ForgeCapabilities.FLUID_HANDLER_ITEM`, `drain`, `getContainer`) for EvilCraft's tanks. Only the plain bucket of blood was mock-tested; if the capability can't be read, only buckets count;
  - taking a relic's things from the whole inventory (`p.inventory.getItem`, slots 0 to 35) as well as the hand;
  - the relic raid's Inspectors at the Shrine.
- **The new order:**
  - the waves round the red glass after the switch (the log now gives every spot);
  - whether the whole statue is in view as it rises, from a spot set with `/shrine view set`;
  - the Pool rising when the night ends: its tier titles and reload as the night clears;
  - a stray Inspector taken away as its chunk loads (cancelling `EntityEvents.spawned` for an entity loaded from disk, with a discard the next tick as a fallback; mock-tested);
  - the kit reaching someone who switches to survival mid-event (mock-tested);
  - the viewing platform: the barriers laid by `fill ... replace air`, the view of the rise from it, and the landing in front of the lectern (room to stand there, facing the book). All mock-tested;
  - the waves at the braziers with 7 or 8 players: whether every 20 seconds and up to 8 a group (16 up) is the right pressure (mock-tested only);
  - several Senior Inspectors to a wave: the wave's one bar as players see it, and how the last waves (6 Seniors with 8 players) play (mock-tested only).
- **The night's kit:**
  - the kit as players see it: Unbreaking X and Sharpness IV, the lore, the armour worn and the shield in the off hand;
  - the vault with a backpack's contents, worn curios and Tool Belt's belt slot (both players' belongings came back at the third run, but what they carried wasn't checked item by item);
  - the hand-back at a join after the night, and the fresh kit after a `/kill` mid-event (mock-tested).
- **The night ending by itself:** what players see while held at the steps, and `/shrine stop` or a `/reload` while it's due (mock-tested; the rest was seen at the third run).
- **The effects:**
  - **Lightning for show** is made with `level.createEntity('minecraft:lightning_bolt')`, `setVisualOnly(true)`, `moveTo` and `spawn()` (`createEntity` and `spawn` were confirmed in KubeJS 2001.6.5's jar). The log can't say whether players saw real bolts or the fallback of flashes, sparks and thunder; the players can.
  - **The rest, as players see them:** the titles, the raid horn, the fireworks (they burst 2 blocks above the statue's top, far from anyone at the steps), the rise's fire and corner bolts, and the storm.
- **Stages 0–1:** how the Signal looks in chat and the Summons as a book, as players see them. The second run showed a late arrival getting both (the status counted them), but nobody recorded what they saw.
- **The rite beginning by itself:** `/shrine stop` and a `/reload` while it's due (mock-tested; the start itself was seen at both runs).
- **The new waves:** two Seniors' bars at once as players see them, and the 30-Inspector limit (mock-tested; the second run had five waves and no overlap reported).
- **Where the waves come from** (2026-11-20, mock-tested):
  - the braziers' Inspectors finding their way to the pilgrims at the beam (about 40 blocks on the test server);
  - the switch to the glass at half the offering;
  - `wetGround`'s check for waterlogged blocks (`blockState.fluidState.isEmpty()`; the mock only has block ids, so only the named blocks were tested);
  - the rite waiting with nobody near the beam.
- **The night's event:**
  - the teleport to the start with players in another dimension;
  - the whole-ring search for dry ground in game (the lake case is mock-tested).
- **Stage 4:**
  - the new ground search for Inspectors in game (it's mock-tested, with a hill, a lake, the steps and a canopy; the test rite ran before it);
  - a knockout from a real fight (the one seen was while she was away), and the knockout's new log line;
  - the King's Potatoes refused when eaten or planted, and skipped by the tithe (both mock-tested);
  - the Senior Inspector's boss bar and his call for help, as players see them;
  - a rite with several players, and `/shrine stop` and `/shrine rite` mid-rite;
  - the refusal of a beamless `/shrine rise` in game (`/shrine rise force` was checked to parse).
- **Stage 5:**
  - the tribute and the Blood God's lines as players see them;
  - the guard against breaking and building, in game.
- **Stage 2 with players:**
  - kindling a brazier by sneaking (mock-tested only, 2026-11-21): `isCrouching()` on the server, the action bar, a blow read from health, absorption and `hurtTime`; flint and steel refused through `BlockEvents.rightClicked` (`event.item`), and a flaming arrow's fire put out;
  - the automatic ambush on a survival team on its way;
  - the Inspectors fighting;
  - how far away the beam shows.
- **The ground:** the Stage 4 test rose on real ground and looked right, but its blocks weren't sampled there.
- **Players in the way:** nobody stood in the footprint during the test, so moving players out (onto the ground beside it) is checked only on the mock. Over a drop with no ground within 20 blocks, the edge spot falls back to the site's height.

## Build progress
| Part | State |
|---|---|
| The sites (`/shrine site set`, `/shrine brazier set`, where you stand or at coordinates) and `/shrine status`, with each brazier's direction and distance from the castle | ✅ built, mock checks in `tools/tests/suites/shrine.test.js`; tried on the test server |
| Stage 3, the rise, with `/shrine stop` and `/shrine reset confirm` | ✅ built, same checks; tried on the test server (see above) |
| No monsters in the Shrine, and `/shrine clearmobs` | ✅ built, 71 mock checks in all; tried on the test server |
| Stage 2, the braziers, the beam and the ambushes (the Shrine's own Inspectors) | ✅ built, 112 mock checks in all; tried on the test server (see above) |
| Stages 0–1, the Signal and the Summons (late arrivals too) | ✅ built 2026-11-19, 24 mock checks; run at the rehearsal (see above) |
| The rite beginning by itself after the rise; the Awakening's new end (230,000 Drops, the Shrine opens Tiers 3 and 4, no vote) | ✅ built 2026-11-19, mock checks plus `openTo` in the Blood Pool suite; run at both rehearsal runs, and the seals now break before the Drops land |
| The night's kit and vault; the night ending by itself (Inspectors gone, everyone to the steps, the Awakening); the effects | ✅ built 2026-11-19, mock checks; the kit and the automatic ending seen at the third run |
| **The new order** (the rite and the Awakening at the beam, the Shrine rising last as the climax; the offering into the beam; the rite beginning once everyone is at the beam) | ✅ built 2026-11-19, mock checks (the Shrine suite has 318 in all); not yet tried in game |
| Stage 4, the Ignition Rite (waves, the Senior Inspector, the King's Potatoes, the altar and its light, knockouts) | ✅ built, mock checks plus one in the Blood Pool suite; tried on the test server (see above) |
| The steps up to the altar, the Inspectors' ground, and the rise waiting for the beam | ✅ built; the steps tried on the test server |
| The night's event: `/shrine start set`, everyone to the start, knockouts for everyone until the Awakening ends | ✅ built, 224 mock checks in all; the whole night run on the test server (see above) |
| Stage 5, the Awakening, the Regalia book on the altar, a basic `/regalia`, the Shrine's guard and `/shrine repair` | ✅ built, 150 mock checks in all; tried on the test server (see above) |
