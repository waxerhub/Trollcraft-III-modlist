# The Shrine Awakens (Part II): spec

✅ **All six stages built** (2026-11-19) as `server_scripts/part2/shrine.js`, from the owner's decisions of 2026-11-14 to 11-19. Next: a rehearsal with players on the test server. This file is the system's doc: settings, commands, test plan and "what couldn't be verified". See [Build progress](#build-progress).

The story is in [STORY.md](../../STORY.md), Act I #36. This file says how each stage works in game.

## What it is
**One big evening, about 90 minutes, run live by ops.**
- **When:** early Part II, with the server at Blood Pool Tier 2 (about 66,000 Drops).
- **What happens:**
  - the Blood God summons the server;
  - three teams light three far-apart braziers;
  - Technoblade's Shrine rises out of the ground, layer by layer;
  - the server defends it from Inspector waves and feeds it Potato King's Potatoes;
  - the Blood God names the Regalia of the Blade.
- **How it ends:** the Blood God breaks the third and fourth seals himself, with no vote, which opens the Nether. The Pool is raised to a quarter of the way past Tier 4 (230,000 Drops), credited to nobody (owner decisions 2026-11-19).

**Each stage is one op command,** except the Ignition Rite, which begins by itself 8 seconds after the Shrine has risen on the night (owner decision 2026-11-19). The ops set the pace and can wait for stragglers.

| Stage | Command | Length | Where |
|---|---|---|---|
| 0. The Signal | `/shrine signal` | the day before | everywhere |
| 1. The Summons | `/shrine summons` | ~10 min | the castle |
| 2. The Pilgrimage | `/shrine braziers` | ~30 min | three brazier sites |
| 3. The Shrine Rises | `/shrine rise` | ~15 min | the Shrine site |
| 4. The Ignition Rite | begins by itself after the rise (`/shrine rite` by hand) | ~20 min | the Shrine |
| 5. The Awakening | `/shrine awaken` | ~5 min | the Shrine |

## Setting up (before the night)
**Sites are set in game.** An op stands on the spot and runs:
- `/shrine site set`: the Shrine's centre, at ground level;
- `/shrine brazier set <1|2|3>`: each brazier;
- `/shrine start set`: the start, where `/shrine braziers` brings every player (near the castle, say).

Or give the coordinates, in the Overworld, which also works from the console: `/shrine site set <x> <y> <z>`, `/shrine brazier set <1-3> <x> <y> <z>` and `/shrine start set <x> <y> <z>`.

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
- **The brazier:** a 3 × 3 plinth of polished blackstone bricks on the ground, an unlit campfire on it in the middle, and blackstone walls with chains at the corners (`BRAZIER_PARTS`).
- **Building them:** each brazier's chunk is force-loaded while the fires are watched, so each is built once its chunk loads, even with nobody near.
- **Protected:** the braziers can't be broken outside creative ("The brazier will not move").

**Lighting them:**
- **Any way works:** flint and steel, a fire charge or a flaming arrow. The script checks each brazier's campfire once a second.
- **Everyone is told:** "Far away, a fire catches. 1 of 3. The others have a minute." Then "Another fire catches. 2 of 3."
- **The window:** the first one lit starts a 60-second clock (`FIRE_WINDOW_SECONDS`). Everyone sees it as a boss bar, "The fires: 1 / 3   0:47", counting down.
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
- **Deaths in an ambush:** none. The night's event is on from `/shrine braziers`, so a lethal hit is a knockout (below).
- **Leftovers:** any ambushers still alive are taken away when the rise begins.

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

## 3. The Shrine Rises
**`/shrine rise`**, run once the pilgrims have gathered at the beam. The Shrine builds itself from the ground up.

**It waits for the beam** (owner decision 2026-11-14, so it can't be started out of order by mistake): until the braziers' beam is up, `/shrine rise` refuses and says the braziers come first. `/shrine rise force` raises it anyway (for a rehearsal, or if the braziers go wrong on the night). A rise that was paused carries on without the check.

1. **Clearing the way:** players standing inside the Shrine's footprint are moved to its edge. The beacon comes out and its ground is put back.
2. **Layer by layer:** for each of the 64 layers, the script clears that slice of the box, then places the layer, from `trollcraft:shrine/l_0` to `l_63`. One layer every **9 ticks** (a setting) takes about **29 seconds** for all 64. It was 4 seconds a layer (4½ minutes) until the owner watched it on the test server and asked for about 30 seconds (2026-11-14).
3. **The show** (sounds chosen by the owner on the test server, 2026-11-14):
   - stone sounds: deepslate set down at every layer, grinding stone every 3rd, and a wither's crunch every 8th;
   - the respawn anchor's charge, the Blood God's power gathering, as it starts, when the pedestal is done (layer 21) and when the head is placed (layer 63), with a thunderclap at the last two;
   - dust and smoke along the layer's edge.
4. **The finish:** the altar's lectern and Technoblade's head (with its skin) are placed exactly as in the schematic.
5. **The steps up to the altar** (owner decision 2026-11-14, from the owner's idea): the pedestal is 22 blocks high, so the script lays a flight of **barrier blocks**: solid, invisible, and no monster can spawn on them.
   - **Where:** 3 wide, in the lectern's row, from the platform's edge east of the lectern down toward the rising sun, one block out and one down per step, until it meets the ground (at most 12 below the base). On the test server's ground that was 21 steps.
   - **They only fill air,** so they never cut into the build or the land.
   - **Faint red dust** marks the middle of each step once a second while anyone is within 48 blocks. The owner, climbing them in survival: "stairs are perfect, I can see where they are and everything".
   - `/shrine repair` lays any missing steps again (and gives a Shrine risen before the steps existed its flight). `/shrine reset confirm` takes them away with the Shrine.

The chunks are force-loaded while it builds, as the Gladiator Arena does, and released afterwards.

**The Shrine stays** after the night, as the Shrine for the relic hunt (Act II).

## 4. The Ignition Rite ✅ built
**It begins by itself** (owner decision 2026-11-19, after the full run, where the owner expected the Inspectors to come on their own): during the night's event, 8 seconds after the Shrine has risen (`AUTO_RITE_SECONDS`), players near the Shrine are told "Something stirs on the land around the Shrine.", and then the first wave comes.
- **By hand:** **`/shrine rite`** starts it any time once the Shrine has risen, for instance after a rise forced outside the event, when it doesn't begin by itself.
- **Holding it:** `/shrine stop` while it's due cancels it ("The rite won't begin by itself. Start it with /shrine rite.").
- **A `/reload` or restart** while it's due keeps the time, and it begins once.

**Inspectors close in from the land around the Shrine**, appearing 30–45 blocks from its centre, on the ground.
- **Where exactly:** each one's spot is the top of the ground there, through any leaves to the forest floor. A spot is skipped if it's water or lava, a tree trunk, the steps, or under a hill too high to see over (40 blocks above the site). Twelve spots are tried round its place in the ring (`SPAWN_TRIES`), then twelve anywhere on the ring (a lake filled the whole north side of the test ring), and only then is one placed regardless, with a warning in the log ("No dry ground ..."). The Stage 2 ambushes find their ground the same way.
- **Who counts as present:** the players in survival or adventure within 64 blocks of the Shrine when the rite starts (at least 1).
- **What the altar needs:** **8 potatoes per player present.** An op can change it with `/shrine need <n>`.
- **The rite's boss bar,** for everyone: "The Ignition Rite: 8 / 16 potatoes".
- **The Purge and the arena wait** while the rite is on (and while the Shrine rises), and the rite won't start while either is on.

**The waves** (owner decisions at the rehearsal, 2026-11-19, after the altar filled in under 2 minutes):
- **They keep coming until the altar is full.** There's no last wave.
- **Every wave is led by a Senior Inspector,** and only the Seniors carry the Potato King's Potatoes: **8 each**. The ordinary Inspectors and the Seniors' helpers drop nothing.
- **So the altar needs one Senior to fall for each player present** (8 potatoes per player, 8 per Senior): 2 players, 2 Seniors; 9 players, 9.

| Wave | Ordinary Inspectors | Gear |
|---|---|---|
| 1 | 1 per player present (at least 3) | iron |
| 2 | 1½ per player (at least 3) | iron; the vindicators carry shields |
| 3 | 1 per player (at least 3) | diamond |
| 4 and every wave after | 1½ per player (at least 3) | diamond; the vindicators carry shields |

Each wave also has its Senior Inspector. At most 12 ordinary Inspectors in a wave (`WAVE_MAX`). One in three is a pillager with a crossbow; the rest are vindicators with axes. The list is `WAVES`, and every wave after it uses its last entry.
- **The next wave** comes once three-quarters of the last one is down (its Senior counts as one of them), or after 3 minutes (`NEXT_WAVE`). So two Seniors can be up at once.
- **A rite nobody fights** stops growing: no new wave comes while 30 of the rite's Inspectors are up (`RITE_ALIVE_MAX`).
- **The Inspectors:**
  - vindicators and pillagers named **Inspector** in gold. Their armour protects them, though illagers don't show it;
  - they see players up to 64 blocks away, and once a second any without a target is sent after the nearest pilgrim at the Shrine;
  - they don't despawn, and every one left is removed at the Awakening;
  - they drop nothing.
- **The Senior Inspectors,** mini-bosses, one per wave:
  - 150 health, diamond armour, a netherite axe, Resistance I, and the name in bold;
  - each has his own boss bar showing his health, "Senior Inspector (wave 3)", so two up at once show two bars;
  - at half health each calls two Inspectors in diamond to help, once;
  - when one falls, he drops 8 Potato King's Potatoes, and those present hear "The Senior Inspector falls. His clipboard does not."

**The Potato King's Potatoes:**
- **What they are:** potatoes named *Potato King's Potato* in gold, with a glint and the lore "Technoblade's own. Hoarded by the Inspectors."
  - They're dropped where a Senior Inspector dies, 8 each (`SENIOR.potatoes`).
  - They're marked (`trollcraft.kingspotato`), so the script knows them.
- **Only for the altar:**
  - they can't be eaten or planted ("Only the Shrine's altar will take these");
  - the Blood Pool's tithe and `/potatowar offer` ignore them (`blood_pool.js` skips marked items).
- **Leftovers** crumble to nothing at the Awakening, in pockets and on the ground. The owner decided there's no keepsake.

**The altar:**
- **Offering:** right-clicking the lectern or Technoblade's head with the potatoes offers every one the player carries. Each offering is counted for the player who made it (the Awakening's Drops follow these counts), and everyone present is told.
- **The Shrine lights up stage by stage, from the feet to the head.** At each quarter of the bar:
  - the next band of the statue lights up (layers 0–15, 16–31, 32–47, 48–63);
  - invisible light blocks (level 15) go every 4 blocks where there's air, and flames rise along the band.

  The light stays, so the statue glows at night. It also keeps monsters off it.
- **Full:** "The last band catches. The Shrine burns from its feet to its crown."
  - No more waves come. The Inspectors still about stay until the Awakening.
  - Ops are told "/shrine awaken".
- **The Awakening waits for a full altar:** `/shrine awaken` refuses until then, and `/shrine awaken force` goes ahead anyway.

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
**`/shrine awaken`**, once the altar is full (`/shrine awaken force` goes ahead anyway). It's respectful: no jokes. About 46 seconds, step by step (`AWAKEN_STEPS`); a `/reload` or restart carries on from the next step.
1. **At once:**
   - **Clean-up:** every Inspector left is removed, and leftover Potato King's Potatoes crumble.
   - **The title:** everyone at the Shrine (within 64 blocks) sees "The Shrine awakens" and hears a respawn anchor set.
   - **The tribute:** the Techno Tribute for everyone at the Shrine (`/techno all`), and a server-wide `/superaura @a`.
2. **The Blood God speaks** once the tribute has played (28 seconds in), in lines to everyone online ([BLOOD GOD], as the Pool's own messages):
   > You lit my fires. You fed my Shrine. You remembered.

   Then 6 seconds later:

   > Eight things were mine. They were scattered, stolen, forgotten. Restore them here, and my name returns with them.
3. **The Regalia** (38 seconds in):
   - the book *The Regalia of the Blade* appears on the altar's lectern, with sparkles and a page turning;
   - `/regalia` opens on the eight relics;
   - everyone is told, with a `[/regalia]` to click.
4. **The seals** (44 seconds in):
   > I break the third seal, and the fourth with it. Blood for the Blood God.
5. **The Pool** (46 seconds in). Owner decisions 2026-11-19: no vote; the Blood God breaks the seals himself.
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

> **THE WAR CHEST**
> For the Potato War, which I won.
> Fill it again: ten thousand potatoes.

> **THE AXE OF PEACE**
> I carried it in peace. Mostly.
> Forge me its equal: a broad axe of manyullyn or hepatizon, made netherite.

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
> Breed me his equal: swift as wind, and a jump to clear any wall.

> **THE SWINE'S OATH**
> For the pig who wore the crown.
> See the pigs safely home, ten times over.

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
- **The Shrine holds the progress,** server-wide. Other scripts can read it through `global.Regalia` (`isOpen()`, `relics`, `progress(id)`).

The deliveries, Shrine raids and rewards are Act II's work and get their own spec. STORY.md lists what's still open: the amounts, a Blood offering, the order, and Purge losses.

## Commands (op)
| Command | What it does |
|---|---|
| `/shrine status` | The sites, the stage, the braziers, the rite's bar and who offered what |
| `/shrine site set [x y z]` / `/shrine brazier set <1-3> [x y z]` / `/shrine start set [x y z]` | Set the Shrine's centre, a brazier or the start where you stand, or at those coordinates in the Overworld (the console can too) |
| `/shrine signal` | Stage 0: the scrambled message to everyone online, and to anyone who joins in the next 24 hours |
| `/shrine summons` | Stage 1: the book *A Summons* for everyone online, and for anyone who joins until the Awakening (needs the three braziers set) |
| `/shrine braziers` | Stage 2: place the braziers, bring everyone to the start, start the event (knockouts for everyone until the Awakening ends) |
| `/shrine fires light` / `/shrine fires out` | Light all three by hand (the beam goes up), or end a running clock early |
| `/shrine beam up` / `/shrine beam down` | Raise or lower the beam by hand |
| `/shrine ambush <player>` | An Inspector ambush on that player and the pilgrims near them |
| `/shrine rise` / `/shrine rise force` | Stage 3, once the beam is up; `force` raises it anyway |
| `/shrine rite` / `/shrine need <n>` | Stage 4 by hand (it begins by itself 8 seconds after the rise, during the event), or carry on after `/shrine stop`; change what the altar needs |
| `/shrine awaken` / `/shrine awaken force` | Stage 5, once the altar is full; `force` goes ahead anyway |
| `/shrine book` | Put the Regalia book back on the altar |
| `/shrine repair` | Put the Shrine back as it was built (every layer placed again; the head with its skin), then the book and any missing steps |
| `/regalia` | **Anyone:** the eight relics and their progress |
| `/shrine stop` | Stops whatever is running (waves, clock, rise), removes Inspectors and leaves the rest; a rite due to begin by itself won't |
| `/shrine clearmobs` | Takes away the monsters in and right around the Shrine (event mobs and named ones stay) |
| `/shrine reset confirm` | **Test server:** removes the Shrine, the braziers, the beam and the steps, ends the event, and forgets the night, the Signal and the Summons included (the sites and the start are kept). It needs the word `confirm`, so it can't be run by accident on the live server |

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

## Still open
- **To tune at the rehearsal:**
  - the wave sizes;
  - the potatoes per Inspector;
  - how the braziers look.
- **Still needed from the owner:** the three brazier sites, the Shrine site and the date.

## Install (what's built so far)
1. Copy `server_scripts/part2/shrine.js` to `kubejs/server_scripts/part2/`.
2. Copy the 64 layers, `data/trollcraft/structures/shrine/l_0.nbt` … `l_63.nbt`, to `kubejs/data/trollcraft/structures/shrine/`.
3. Copy `server_scripts/part2/blood_pool.js` from the same update: the Awakening opens the seals through its `openTo`.
4. Run a full `/reload` (it adds the `/shrine` command). `/shrine status` should say "The rise: not started" with no warning about missing layers, and end with "The Signal: not sent" and "The Summons: not given".

## How the rise works (built)
- **The box:** 42 × 43 blocks and 64 tall, centred on the site, from the site's ground level up. `/shrine site set` says its corners.
- **Each layer:** every 9 ticks (`LAYER_TICKS`), about 29 seconds for all 64:
  - its slice of the box is cleared to air;
  - the statue's layer is placed with `/place template trollcraft:shrine/l_<n>`;
  - stone sounds play: `block.deepslate.place` at every layer, `block.grindstone.use` every 3rd and `entity.wither.break_block` every 8th, and dust and smoke rise along it;
  - `block.respawn_anchor.charge` sounds at layer 0, layer 21 (the pedestal's top) and layer 63 (the head), with thunder at the last two.
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
- **To tune** (for the owner): with two players the rite lasted under 2 minutes, not the 20 planned. The waves are at their minimum of 3 Inspectors, and 16 potatoes take 8 kills. **Changed the same night** (owner decisions): waves until the altar is full, a Senior Inspector leading each, and only the Seniors drop the potatoes, 8 each (Stage 4 above). Not yet run in game.

## What couldn't be verified yet
- **Stages 0–1:**
  - how the Signal looks in chat and the Summons as a book, as players see them (the players' view wasn't recorded at the rehearsal);
  - the Signal and the Summons reaching a player who joins later (mock-tested; nobody joined late at the rehearsal).
- **The rite beginning by itself:** `/shrine stop` and a `/reload` while it's due (mock-tested; the start itself was seen at the rehearsal).
- **The seals before the Drops** (the rehearsal's fix): mock-tested, not yet run in game.
- **The new waves** (2026-11-19, mock-tested): a Senior Inspector in every wave, only the Seniors dropping potatoes, two Seniors' bars at once, and waves past the fourth.
- **The night's event:**
  - waking beside a brazier (only the start and the Shrine's edge were seen live; the brazier is mock-tested);
  - the teleport to the start with several players, and with players in another dimension;
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
  - lighting a brazier with flint and steel, a fire charge or a flaming arrow (it was lit with `/setblock`);
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
| The rite beginning by itself after the rise; the Awakening's new end (230,000 Drops, the Shrine opens Tiers 3 and 4, no vote) | ✅ built 2026-11-19, mock checks (the Shrine suite has 258 in all, plus `openTo` in the Blood Pool suite); run at the rehearsal, and the seals now break before the Drops land |
| Stage 4, the Ignition Rite (waves, the Senior Inspector, the King's Potatoes, the altar and its light, knockouts) | ✅ built, mock checks plus one in the Blood Pool suite; tried on the test server (see above) |
| The steps up to the altar, the Inspectors' ground, and the rise waiting for the beam | ✅ built; the steps tried on the test server |
| The night's event: `/shrine start set`, everyone to the start, knockouts for everyone until the Awakening ends | ✅ built, 224 mock checks in all; the whole night run on the test server (see above) |
| Stage 5, the Awakening, the Regalia book on the altar, a basic `/regalia`, the Shrine's guard and `/shrine repair` | ✅ built, 150 mock checks in all; tried on the test server (see above) |
