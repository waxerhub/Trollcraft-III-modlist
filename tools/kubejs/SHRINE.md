# The Shrine Awakens (Part II): spec

🔨 **Spec for sign-off, not built yet.** It will become `server_scripts/part2/shrine.js`. Once it's built, this file becomes the system's doc: settings, commands, test plan and "what couldn't be verified".

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

`/shrine status` shows the sites, the stage, and each brazier's distance and direction from the castle.

**The Shrine's site:**
- **Its size:** the statue is 42 × 43 blocks and 64 tall. The bottom 22 layers are a pedestal; the altar is on top of it, with Technoblade's head over the lectern.
- **What to pick:** flat, open ground with nothing built on it. The rise clears the whole box above ground before placing each layer.
- **Rehearse first** on the test server, with `/shrine reset` between runs (see the test commands below).

## 0. The Signal (the day before)
**`/shrine signal`** sends a scrambled, unsigned message to everyone online. Anyone who logs on in the next 24 hours gets it when they join.
- **How it looks:** red text with obfuscated stretches (`§k`), so only fragments read clearly.
- **Discord:** the owner posts the time there separately. The Signal itself is sent to each player, never with `tellraw @a`.

Draft (█ = scrambled):
> ██ █████ ███ ...*the third seal*... ████ ██ █ ...*three fires*... ███████ ...*gather at the castle*... ██ ███ ...*tomorrow, when the sun goes down*... █████

## 1. The Summons (at the castle)
**`/shrine summons`** gives everyone online the book ***A Summons***, signed *The Blood God*. The Castellan reads it out.
- **The brazier lines** are written from the brazier sites when the command runs, so they're always right (see open question 1).
- **Late arrivals** get the book when they join, until the Awakening.

Draft (each `>` block is a page):
> BLOOD FOR THE BLOOD GOD.
> You have bled for their seals. Two lie broken. The third still holds.

> Beneath this land sleeps something older than any seal: my Shrine.
> It will not wake for one of you. It wakes for all of you, or for none.

> Three fires wait in three far places:
> *the first:* [direction and distance from the castle, or a riddle]
> *the second:* [...]
> *the third:* [...]

> Light them as one. A fire that burns alone will die within the minute.
> When all three burn, I will show you where to stand.

> Bring your blades. They will come for what is mine.
> Take back from them what they took from me.

> They want the Pool full.
> So do I.

The last page is the first hint of the two threads. It's optional (open question 4).

## 2. The Pilgrimage: three braziers
**`/shrine braziers`** places an unlit brazier at each site: a campfire on a small blackstone plinth with chains.

**Lighting them:**
- **Any way works:** flint and steel, a fire charge or a flaming arrow. The script checks each brazier's flame once a second.
- **The window:** when the first one catches, a 60-second clock starts. Everyone sees it as a boss bar: "The fires: 1 / 3, 0:47".
- **Too slow:** if all three aren't burning before it runs out, the lit ones gutter out (smoke and a hiss), and the teams try again. Nothing else is lost.
- **Done:** when all three burn, they stay lit for the rest of the night.

**The beam:**
- **What it is:** a red beacon beam rises from the Shrine site, visible from far off.
- **How it's made:** a real beacon on a hidden iron base under the ground, with red glass. The blocks it replaces are saved, and they're put back when the rise begins.
- **What it needs:** open sky above the site's centre.

**Ambushes on the way:**
- **What they are:** unsigned **Inspector** patrols (never "Ministry Inspector") stop "unregistered pilgrims".
- **What they use:** the Part I patrols' fighters, from `factions/portal_ambush.js`, renamed.
- **Who starts them:** see open question 3. The recommendation is an op command, `/shrine ambush <player>`, so the ops can time them for drama.

## 3. The Shrine Rises
**`/shrine rise`**, run once the pilgrims have gathered at the beam. The Shrine builds itself from the ground up.
1. **Clearing the way:** players standing inside the Shrine's footprint are moved to its edge. The beacon comes out and its ground is put back.
2. **Layer by layer:** for each of the 64 layers, the script clears that slice of the box, then places the layer, from `trollcraft:shrine/l_0` to `l_63`. One layer every **4 seconds** (a setting) takes about 4½ minutes.
3. **The show:**
   - deep rumbles and stone sounds at every layer;
   - dust and smoke along the layer's edge;
   - a thunderclap when the pedestal is done (layer 21), and another when the head is placed (layer 63).
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

**Deaths** are ordinary deaths, with items in a corpse as usual (open question 2).

## 5. The Awakening
**`/shrine awaken`**, once the bar is full (an op can also force it). It's respectful: no jokes.
1. **Clean-up:** the waves stop, every Inspector is removed, and leftover Potato King's Potatoes crumble.
2. **The tribute:**
   - the Techno Tribute for everyone at the Shrine (`/techno all`);
   - a server-wide `/superaura`.
3. **The Blood God speaks,** in lines sent to each player:
   > You lit my fires. You fed my Shrine. You remembered.

   > Eight things were mine. They were scattered, stolen, forgotten. Restore them here, and my name returns with them.

   > The third seal is yours to break.
4. **The Regalia:**
   - the book *The Regalia of the Blade* appears on the altar's lectern, readable by anyone (draft below);
   - `/regalia` opens on the eight relics.
5. **The Pool:**
   - it's topped up to **Tier 3's threshold (120,000)**, about 54,000 Drops on the night;
   - the Drops are credited to each player in proportion to the potatoes they offered;
   - everyone present is then asked to `/bloodpool vote`.

   Five votes break the third seal, and **the Nether opens**. With fewer than five players there, an op uses `/bloodpool unlock`.

**The reward is the Drops:** there's no title or keepsake (owner decision).

### The Regalia of the Blade (the book on the lectern)
Signed *The Blood God*. One page per relic: what it honours, then what it asks. The amounts are placeholders until the owner sets them.

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

## `/regalia` (what the event needs)
**`/shrine awaken` opens the relic hunt**, so a basic `/regalia` has to exist by the night:
- `/regalia` lists the eight relics, each one's progress, and who has contributed;
- **the Shrine holds the progress**, server-wide.

The deliveries, Shrine raids and rewards are Act II's work and get their own spec. STORY.md lists what's still open: the amounts, a Blood offering, the order, and Purge losses.

## Commands (op)
| Command | What it does |
|---|---|
| `/shrine status` | The sites, the stage, the braziers, the rite's bar and who offered what |
| `/shrine site set` / `/shrine brazier set <1-3>` | Set the Shrine's centre or a brazier where you stand |
| `/shrine signal` | Stage 0 |
| `/shrine summons` | Stage 1: the books |
| `/shrine braziers` | Stage 2: place the braziers and start watching them |
| `/shrine ambush <player>` | An Inspector patrol on that player (stage 2) |
| `/shrine rise` | Stage 3 |
| `/shrine rite` / `/shrine need <n>` | Stage 4; change what the altar needs |
| `/shrine awaken` | Stage 5 |
| `/shrine stop` | Stops whatever is running (waves, clock, rise), removes Inspectors and leaves the rest |
| `/shrine reset` | **Test server:** removes the Shrine, the braziers and the beam, and forgets the night |

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

## Open questions for the owner
1. **The brazier lines in the Summons:** direction and distance from the castle, filled in automatically ("the first: about 900 blocks toward the rising sun"), or your own riddles?
2. **Deaths during the rite:** ordinary deaths (corpses, as usual), or knockouts like the Gladiator Arena?
3. **Pilgrimage ambushes:** started by an op (`/shrine ambush <player>`), or automatic (one per team on the way)?
4. **The Summons' last page:** keep "They want the Pool full. So do I."?
5. **To tune at the rehearsal:**
   - the rise's speed (4 s a layer);
   - the wave sizes;
   - the potatoes per Inspector;
   - how the braziers look.
6. **Still needed from the owner:** the three brazier sites, the Shrine site and the date.
