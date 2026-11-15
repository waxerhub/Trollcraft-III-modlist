# The Shrine Awakens (Part II): spec

🔨 **Signed off (owner decisions 2026-11-14), being built in stages** as `server_scripts/part2/shrine.js`. Once it's built, this file becomes the system's doc: settings, commands, test plan and "what couldn't be verified". Built so far: see [Build progress](#build-progress).

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
- **How it ends:** the Pool is topped up to Tier 3, and the server breaks the third seal together, which opens the Nether.

**Each stage is one op command.** Nothing moves on by itself, so the ops set the pace and can wait for stragglers.

| Stage | Command | Length | Where |
|---|---|---|---|
| 0. The Signal | `/shrine signal` | the day before | everywhere |
| 1. The Summons | `/shrine summons` | ~10 min | the castle |
| 2. The Pilgrimage | `/shrine braziers` | ~30 min | three brazier sites |
| 3. The Shrine Rises | `/shrine rise` | ~15 min | the Shrine site |
| 4. The Ignition Rite | `/shrine rite` | ~20 min | the Shrine |
| 5. The Awakening | `/shrine awaken` | ~5 min | the Shrine |

## Setting up (before the night)
**Sites are set in game.** An op stands on the spot and runs:
- `/shrine site set`: the Shrine's centre, at ground level;
- `/shrine brazier set <1|2|3>`: each brazier.

Or give the coordinates, in the Overworld, which also works from the console: `/shrine site set <x> <y> <z>` and `/shrine brazier set <1-3> <x> <y> <z>`.

`/shrine status` shows the sites, the stage, and each brazier's distance and direction from the castle.

**The Shrine's site:**
- **Its size:** the statue is 42 × 43 blocks and 64 tall. The bottom 22 layers are a pedestal; the altar is on top of it, with Technoblade's head over the lectern.
- **What to pick:** flat, open ground with nothing built on it. The rise clears the whole box above ground before placing each layer.
- **Rehearse first** on the test server, with `/shrine reset confirm` between runs (see the commands below).

## 0. The Signal (the day before)
**`/shrine signal`** sends a scrambled, unsigned message to everyone online. Anyone who logs on in the next 24 hours gets it when they join.
- **How it looks:** red text with obfuscated stretches (`§k`), so only fragments read clearly.
- **Discord:** the owner posts the time there separately. The Signal itself is sent to each player, never with `tellraw @a`.

Draft (█ = scrambled):
> ██ █████ ███ ...*the third seal*... ████ ██ █ ...*three fires*... ███████ ...*gather at the castle*... ██ ███ ...*tomorrow, when the sun goes down*... █████

## 1. The Summons (at the castle)
**`/shrine summons`** gives everyone online the book ***A Summons***, signed *The Blood God*. The Castellan reads it out.
- **The brazier lines** give each fire's direction and distance from the castle (world spawn), worked out from the brazier sites when the command runs, so they're always right: "*the first:* about 900 blocks toward the rising sun" (owner decision).
- **Late arrivals** get the book when they join, until the Awakening.

Draft (each `>` block is a page):
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
**`/shrine braziers`** places an unlit brazier at each site. It needs all three sites set.
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
- **Deaths in an ambush** are ordinary deaths. Knockouts are for the rite at the Shrine.
- **Leftovers:** any ambushers still alive are taken away when the rise begins.

## 3. The Shrine Rises
**`/shrine rise`**, run once the pilgrims have gathered at the beam. The Shrine builds itself from the ground up.
1. **Clearing the way:** players standing inside the Shrine's footprint are moved to its edge. The beacon comes out and its ground is put back.
2. **Layer by layer:** for each of the 64 layers, the script clears that slice of the box, then places the layer, from `trollcraft:shrine/l_0` to `l_63`. One layer every **9 ticks** (a setting) takes about **29 seconds** for all 64. It was 4 seconds a layer (4½ minutes) until the owner watched it on the test server and asked for about 30 seconds (2026-11-14).
3. **The show** (sounds chosen by the owner on the test server, 2026-11-14):
   - stone sounds: deepslate set down at every layer, grinding stone every 3rd, and a wither's crunch every 8th;
   - the respawn anchor's charge, the Blood God's power gathering, as it starts, when the pedestal is done (layer 21) and when the head is placed (layer 63), with a thunderclap at the last two;
   - dust and smoke along the layer's edge.
4. **The finish:** the altar's lectern and Technoblade's head (with its skin) are placed exactly as in the schematic.

The chunks are force-loaded while it builds, as the Gladiator Arena does, and released afterwards.

**The Shrine stays** after the night, as the Shrine for the relic hunt (Act II).

## 4. The Ignition Rite
**`/shrine rite`** starts the waves. **Inspectors close in from the land around the Shrine**, spawning 30–45 blocks out, on solid ground and out of sight where they can.
- **Who counts as present:** the players within 64 blocks of the Shrine when the rite starts.
- **What the altar needs:** **8 potatoes per player present.** An op can change it with `/shrine need <n>`.

**The waves (defaults to tune at the rehearsal):**

| Wave | Inspectors | Gear | Potatoes each |
|---|---|---|---|
| 1 | 1 per player present (at least 3) | iron | 2 |
| 2 | 1½ per player | iron, with shields and crossbows | 2 |
| 3 | 1 per player | diamond | 2 |
| 4 | 1 per player, plus the **Senior Inspector** | diamond | 2 (the Senior Inspector: 8) |

- **The next wave** comes when three-quarters of the last one is dead, or after 3 minutes.
- **Enough, just about:** all four waves drop about 9 potatoes per player plus 8, so the server has to clear nearly every wave.
- **The Inspectors:**
  - vindicators and pillagers named **Inspector** in gold. Their iron or diamond armour protects them, though illagers don't show armour;
  - they don't despawn, and every one left is removed at the end;
  - they only go after players near the Shrine.
- **The Senior Inspector,** a mini-boss:
  - about 150 health, diamond gear, Resistance and a boss bar;
  - at half health he calls two Inspectors to help.

**The Potato King's Potatoes:**
- **What they are:** potatoes named *Potato King's Potato* in gold, with a glint and the lore "Technoblade's own. Hoarded by the Inspectors."
- **Only for the altar:** they can't be eaten or planted, and they don't count toward the Potato Tithe or anyone's Potato Standing.
- **Leftovers** crumble to nothing at the Awakening. The owner decided there's no keepsake.

**The altar:**
- **Offering:** right-clicking the lectern or Technoblade's head with the potatoes offers every one the player carries.
- **The bar:** a boss bar, "The Ignition Rite", fills toward the need. Each offering is counted for the player who made it.
- **The Shrine lights up stage by stage, from the feet to the head.** At each quarter of the bar:
  - invisible light blocks fill the next band of the statue (layers 0–15, 16–31, 32–47, 48–63);
  - flames rise along that band.

  At full, the whole statue glows at night.

**Knockouts instead of deaths** (owner decision), like the Gladiator Arena:
- **When:** lethal damage while the rite runs, to a player within 64 blocks of the Shrine.
- **What happens:** they're healed, their fire is put out, and they're set down at the Shrine's edge with a few seconds of Resistance. Nothing drops.
- **No credit:** a knockout is no kill for anything else (bounties, the Anamian Axe's Souls, the Maul's Grit and the rest). The script loads early (`// priority: 100`) so it cancels the death before other scripts see it.

## 5. The Awakening ✅ built
**`/shrine awaken`**, once the Shrine has risen. It's respectful: no jokes. About 46 seconds, step by step (`AWAKEN_STEPS`); a `/reload` or restart carries on from the next step.
- **Until the rite is built:** the rite will gate it (the bar full). For now, an op runs it once the Shrine stands.
1. **At once:**
   - **Clean-up:** every Inspector left is removed. (Leftover Potato King's Potatoes will crumble here once the rite exists.)
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
4. **The third seal** (44 seconds in):
   > The third seal is yours to break.
5. **The Pool** (46 seconds in):
   - **The top-up:** it's raised to **Tier 3's threshold (120,000)**, read from `blood_pool.js`'s tiers: about 54,000 Drops on the night.
   - **Who's credited:** the Drops go to each player in proportion to the potatoes they offered at the altar. If nobody offered any (as now, before the rite exists), they're shared equally among the players present.
   - **Already there:** if the Pool is already past the threshold, nothing is added.
   - **The vote:** while Tier 3 isn't open, the players present are asked to break the seal together, with a `[/bloodpool vote]` to click. The Pool also announces that the tier is ready, as it always does.

   Five votes break the third seal, and **the Nether opens**. With fewer than five players there, an op uses `/bloodpool unlock`.

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
| `/shrine site set [x y z]` / `/shrine brazier set <1-3> [x y z]` | Set the Shrine's centre or a brazier where you stand, or at those coordinates in the Overworld (the console can too) |
| `/shrine signal` | Stage 0 |
| `/shrine summons` | Stage 1: the books |
| `/shrine braziers` | Stage 2: place the braziers and start watching them |
| `/shrine fires light` / `/shrine fires out` | Light all three by hand (the beam goes up), or end a running clock early |
| `/shrine beam up` / `/shrine beam down` | Raise or lower the beam by hand |
| `/shrine ambush <player>` | An Inspector ambush on that player and the pilgrims near them |
| `/shrine rise` | Stage 3 |
| `/shrine rite` / `/shrine need <n>` | Stage 4; change what the altar needs |
| `/shrine awaken` | Stage 5 |
| `/shrine book` | Put the Regalia book back on the altar |
| `/shrine repair` | Put the Shrine back as it was built (every layer placed again; the head with its skin), then the book |
| `/regalia` | **Anyone:** the eight relics and their progress |
| `/shrine stop` | Stops whatever is running (waves, clock, rise), removes Inspectors and leaves the rest |
| `/shrine clearmobs` | Takes away the monsters in and right around the Shrine (event mobs and named ones stay) |
| `/shrine reset confirm` | **Test server:** removes the Shrine, the braziers and the beam, and forgets the night. It needs the word `confirm`, so it can't be run by accident on the live server |

## How it stays safe
- **No overlap:**
  - the Shrine's stages refuse to start while a Purge or a Gladiator match is on;
  - Purges and matches wait while the rite is running.
- **No secrets in Discord:** every message goes to each player by name (`player.tell`), never with `tellraw @a`.
- **The Ministry stays unnamed:**
  - the Inspectors, the Signal and every message are unsigned;
  - nothing says "Ministry".
- **The Blood Pool:**
  - the only Drops added are the Awakening's top-up, through `global.BloodPool.addDrops`;
  - the Potato King's Potatoes never reach the Tithe or anyone's Potato Standing.
- **A reload or restart mid-event:**
  - the stage, the brazier states, the bar and the offerings are saved, and `/shrine status` picks up from there;
  - a rise in progress carries on from its last layer.

## Built from
- **The statue:** `tools/kubejs/data/trollcraft/structures/shrine/l_0.nbt` … `l_63.nbt`. These were made from the owner's `technoblade_statue.schem` by `tools/schematic/schem_to_structures.js --layers`. They hold 7,237 blocks, and the lectern and the head keep their block data.
- **Placing structures and force-loading chunks:** the same way as `part2/gladiator_arena.js`.
- **The Inspectors' fighters:** from `factions/portal_ambush.js`.
- **The tribute:** `techno_tribute.js` (`/techno all`) and `smite.js` (`/superaura`).
- **The top-up:** `global.BloodPool.addDrops(n, 'shrine', uuid, name)`.

## Decided (owner, 2026-11-14)
1. **The brazier lines:** direction and distance from the castle, filled in automatically.
2. **Deaths during the rite:** knockouts, like the Gladiator Arena.
3. **Pilgrimage ambushes:** both: one automatic ambush per brazier team, and `/shrine ambush <player>` for more.
4. **The Summons' last page:** "They want the Pool full. So do I." stays.

## Still open
- **To tune at the rehearsal:**
  - the wave sizes;
  - the potatoes per Inspector;
  - how the braziers look.
- **Still needed from the owner:** the three brazier sites, the Shrine site and the date.

## Install (what's built so far)
1. Copy `server_scripts/part2/shrine.js` to `kubejs/server_scripts/part2/`.
2. Copy the 64 layers, `data/trollcraft/structures/shrine/l_0.nbt` … `l_63.nbt`, to `kubejs/data/trollcraft/structures/shrine/`.
3. Run a full `/reload` (it adds the `/shrine` command). `/shrine status` should say "The rise: not started" with no warning about missing layers.

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
- **Busy:** it won't start during a Purge or a Gladiator match. `global.Shrine.busy()` says "the Shrine is rising" while it runs.
- **Taking it down (test server):** `/shrine reset confirm` moves anyone off it, clears the box with four fills of air from the top, removes loose items, and forgets the night. The sites are kept.

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

## What couldn't be verified yet
- **Stage 5:**
  - the tribute and the Blood God's lines as players see them;
  - the top-up with a Pool below Tier 3 and five players voting (both are mock-tested);
  - the guard against breaking and building, in game.
- **Stage 2 with players:**
  - lighting a brazier with flint and steel, a fire charge or a flaming arrow (it was lit with `/setblock`);
  - the automatic ambush on a survival team on its way;
  - the Inspectors fighting;
  - how far away the beam shows.
- **The ground:** the test rise was in the sky. That clearing each slice first looks right on real terrain (grass, trees and the like giving way layer by layer) is still to see.
- **Players in the way:** nobody stood in the footprint during the test, so moving players out (onto the ground beside it) is checked only on the mock. Over a drop with no ground within 20 blocks, the edge spot falls back to the site's height.

## Build progress
| Part | State |
|---|---|
| The sites (`/shrine site set`, `/shrine brazier set`, where you stand or at coordinates) and `/shrine status`, with each brazier's direction and distance from the castle | ✅ built, mock checks in `tools/tests/suites/shrine.test.js`; tried on the test server |
| Stage 3, the rise, with `/shrine stop` and `/shrine reset confirm` | ✅ built, same checks; tried on the test server (see above) |
| No monsters in the Shrine, and `/shrine clearmobs` | ✅ built, 71 mock checks in all; tried on the test server |
| Stage 2, the braziers, the beam and the ambushes (the Shrine's own Inspectors) | ✅ built, 112 mock checks in all; tried on the test server (see above) |
| Stages 0–1, the Signal and the Summons | to do |
| Stage 4, the Ignition Rite (waves, potatoes, altar, knockouts) | to do |
| Stage 5, the Awakening, the Regalia book on the altar, a basic `/regalia`, the Shrine's guard and `/shrine repair` | ✅ built, 150 mock checks in all; tried on the test server (see above) |
