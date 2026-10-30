# Technoblade Never Dies: the story of Trollcraft III

The server's story in two parts.
- **Part I:** the Ministry of Trolling rules, and players are divided into Loyalists (Techno's Crownsworn) and the Blood God's Syndicate. It ends with everyone realising the Ministry is corrupt and uses Technoblade's name for power, and the world being destroyed.
- **Part II:** a new world and a rebuilt modpack. Everyone stands together under Techno's banner and lays siege to the Ministry.

**Trolling drives the story.**
- Every troll is logged and scored.
- In Part I, trolls fill the two meters (**Order** and **Chaos**) that end each act.
- In Part II, trolls fill the **Blood Pool** that unlocks all progression.
- Ministry **decrees** lock tiers, and boss kills and relics carry the plot.

Legend: ✅ = built and running, 🔨 = still to build, *TBD* = open decision (see [Open decisions](#open-decisions)).

Tone: Technoblade passed away in 2022, and "Technoblade never dies" is how his community remembers him. The Ministry is played for comedy; Techno himself is treated with respect. Nothing makes light of his passing.

---

## The heart of the story: trolling

### The theme
- **The Ministry of Trolling** claims it exists **to secure the right of trollers to troll freely**. In practice it runs **Managed Trollocracy**: trolling licensed, taxed and turned into control. "Trolling equality is a right. Being trolled is a responsibility." (`ministry_broadcasts.js`)
- **Technoblade** (an anarchist on Dream SMP) stands for **free chaos**. The rebellion is about taking trolling back.

### The Troll Log 🔨 (`trolls.js`, planned)
Every troll is recorded: who, on whom, what, where and when.
- **Logged automatically,** from triggers the black market already sees:
  - Disguised TNT or a Teleport Trap sprung on someone else;
  - a Mimic Chest opened;
  - Cursed Food eaten;
  - an Anonymous Summons delivered;
  - a Homing Pig reaching the target's bed.
- **Not logged automatically: Butterfingers and Itching Powder.** They're too easy to land and would flood the meters. Those trolls go through manual reports, where an admin weighs them and sets fair points.
- **Manual reports,** for these and anything creative the game can't detect:
  1. the troller files `/troll report <victim> <what they did>`;
  2. witnesses back it with `/troll witness <id>`;
  3. an admin approves it with `/troll approve <id> <points>`, setting the points, or denies it.
- **Commands:**
  - `/trolls log` shows recent trolls;
  - `/trolls top` shows the leaderboard;
  - `/trolls me` shows your own record.
- **A weekly recap broadcast** in the Ministry's voice: "This week, 47 incidents of Unlicensed Humour were recorded. The Ministry is not amused. The Ministry is never amused."

### Scoring
The same value counts as **Order or Chaos** in Part I (by the troller's faction) and as **Drops of Blood** in Part II. The numbers are proposals.

| Troll | Value |
|---|---|
| Anonymous Summons | 50 |
| Cursed Food eaten | 100, + 25 per curse |
| Mimic Chest opened | 150 |
| Homing Pig reaching the bed | 150 |
| Teleport Trap | 200 |
| Disguised TNT | 250 |
| Approved manual report (including Butterfingers and Itching Powder) | set by the admin, typically 25–500 |

- **Cross-faction bonus ×1.5:** for trolling someone of the opposite faction (in Part II, for trolling Ministry NPCs).
  - The Syndicate is a secret faction, so the bonus is **added straight to the meter and never shown per troll**. `/trolls me` shows base points only, and nobody can work out a victim's faction from their score.
- **Revenge ×2:** a victim who trolls their troller back within 24 hours.
- **Diminishing returns:** the same victim within 24 hours counts ×0.5, then ×0.25.
- **Nothing counts** for trolling yourself, AFK players or players on the same IP.
- **Good sport:** victims get a small share of the points too.
- **Hush Coins per troll:** every logged troll pays the troller some Hush Coins.
  - The payout is always kept **below the cost of the troll item used**, so two friends can't print coins by trolling each other.
  - Exact payouts *TBD*.

### Guardrails
- Pranks cost time, not progress: no permanent loss of gear or bases outside story events.
- Disguised TNT should only break blocks during Prank Purges or story operations.
- The court (`trials.js`) rules on trolling versus griefing.

---

## PART I: The Ministry's Reign

### Order vs Chaos: the two meters 🔨
Two satirical meters, shown together with `/ministry status` and on event bossbars, always in the Ministry's spin.
- **Both fill the same way: by trolling.**
  - **Loyalists' (Crownsworn) trolls fill Order:** "Licensed Trolling", in defence of trolling rights. The Ministry calls it the "Citizen Compliance Index", officially always "99.7% and rising".
  - **The Syndicate's trolls fill Chaos:** "Incidents of Unlicensed Humour".
  - **Unregistered players' trolls are "unlicensed",** so they fill Chaos.
- **Flavour only:** Ministry paperwork such as "Form 27B/6: Declaration of Having Nothing to Declare". It doesn't fill the meters.
- **When a meter fills, the ops are told and an op confirms** before anything happens. The next act begins either way.

**ORDER fills: "Trolling Rights Secured!"**
- The Ministry "protects" trolling into oblivion with a new regulation "for your protection", escalating each time:
  1. **Trolling Licences:** troll items cost Loyalists less and the Syndicate more at the merchant.
  2. **Troll Quotas:** Loyalists who don't troll enough get audited ("Insufficient enthusiasm noted").
  3. **The Trolling Moratorium:** for a few hours, unlicensed troll items fizzle with "[DENIED] Prank not processed. Please resubmit in triplicate."
- **Mandatory Fun Day** for the Loyalists: compulsory fireworks and Certificates of Compliance.
- **The underdog bonus:** the Syndicate's cross-faction bonus rises for the next act.
- **The satire:** every Ministry "win" makes it more controlling, which is what drives Loyalists to doubt it.

**CHAOS fills: "The Free Trolling Movement"**
- **A Ministry Meltdown:**
  - broadcasts glitch and contradict themselves;
  - Inspectors drop a paperwork piñata (Hush Coins and troll items) and flee;
  - the merchant holds a Liberation Sale;
  - one active decree is overturned.
- **Next act:** the Syndicate gets a perk, and the Loyalists' cross-faction bonus rises.

**Either way:**
- Both meters reset, and the next act's meters are larger, because the Ministry adapts.
- The next act takes its tone from who won: the Ministry tightening its grip, or reeling.

### Prologue (already happened)
1. **The First Days:** players start in the Overworld and push through caves, oceans and dangers.
2. **The Stronghold:** Lord_Anamy, Goruk, Stang and Sipheon find a massive stronghold and take an early lead.
3. **The Alchemist:** Tryhard masters ProjectE and dominates the early resource game.
4. **The Bastion Raid:** Sipheon and a reluctant Goruk raid a bastion remnant. Many piglins and swine-folk die.
5. **The CNAI:** the Ministry's Controlled Nether Access Initiative allows Nether entry only through public strongholds, controlled by Goruk, Anamy and Stang.
6. **The Piglin Uprising:** the piglin factions turn on the Ministry and swear to a darker power. They hijack the Nether lockdown and cut the Ministry off. ✅ (Nether lock: `events/pig_escort.js`, `startup_scripts/nether_portal_whitelist.js`)
7. **The Renunciation:** Tryhard, too powerful to be challenged, lays down his arms and starts from scratch.
8. **The Pig Escort:** **Ambassador Oinkington** is sent to negotiate and is slaughtered. A voice from the portal accuses the Ministry of betraying Technoblade's legacy. The Ministry denies everything. ✅ (`events/pig_escort.js`)
9. **The Nether Reopens:** "which was always the plan." Inspectors are dispatched to hunt treasonous thoughts. A scout comes back asleep and covered in red jam. ✅ (Return Inspections and raids: `factions/portal_ambush.js`)
10. **The Odin Incident and the ELI** (Ministry dispatch, posted on Discord):
    - The Ministry finally acknowledges the Syndicate, and denies it exists.
    - It condemns the Syndicate's killing of **Odin**, Goruk_LoHaus's pet dinosaur.
    - It announces the **End Lockdown Initiative (ELI)**, for vaguely sinister reasons: records overdue for destruction; voices in the void; an archive that has never existed; the Ender Dragon appointed Head of Records Security; and Oinkington having "nothing to do with the End".
    - ✅ (`end_lockdown.js`: Eyes of Ender confiscated and uncraftable, the End portal-only, **Unsanctioned Eyes of Ender** sold by the Hooded Merchant as the way in)

### Act II: Inspections
Starts when the first meter fill is confirmed.
11. **The Decrees Begin:** the Ministry issues numbered decrees. Each locks a shortcut or a progression tier, and some are just absurd ("Decree 42: all chests must face north"). 🔨 (chapter and decree system)
12. **The Trolling Licence Act:** all pranks need a permit. Unlicensed trolling becomes a chargeable offence (`/accuse … Unlicensed trolling`), and the black market goes truly underground. ✅ (trials) + 🔨 (the decree)
13. **The Scout Awakens:** the sleeping scout wakes as an NPC. Each conversation gives a piece of testimony, hinting that **the Ministry staged the Escort**. 🔨
14. **Treason Hunts:** Inspectors and Blood God raids keep up the pressure on the Syndicate. Now and then Inspectors turn up, do paperwork and leave. ✅ (ambushes, raids, Ambush Contracts)

### Act III: The Loyalty Audit
Starts when the second meter fill is confirmed.
15. **The Audit:** the Ministry turns on its own Loyalists: inspections of Crownsworn players, Hush Coin tithes, curfews, and (after an Order win) Troll Quotas. 🔨 (decrees, plus ambush settings)
16. **Show Trials:** Enforcers are pushed to prosecute. Certified Alibis become acts of quiet rebellion. ✅ (`factions/trials.js`, the black market's Certified Alibi)
17. **The First Defections:** Crownsworn players start to desert. ✅ (faction desertion)
18. **The Prank Purge:** one announced hour:
    - troll items are discounted, and trap limits are off;
    - every raid rolls the lethal tier;
    - contracts cost half, and bounties pay double.

    The Ministry calls it "a controlled release of comedic pressure." 🔨 (event scheduler)
19. **Resistance operations:** story missions, each one a prank on the Ministry, logged as trolls:
    - **Operation Pig Swap:** replace the Ministry statue with a pig in a crown.
    - **Operation Red Tape:** fill a Ministry outpost with Mimic Chests and Disguised TNT.
    - **Operation Return to Sender:** send the Ministry its own Anonymous Summons.
    - **Operation Fake News:** a hijacked broadcast, with `[SIGNAL HIJACKED]` cutting into Ministry announcements.

    🔨

### Act IV: The End Lockdown
Starts when the third meter fill is confirmed.
20. **The End Lockdown Initiative:** already in force (see 10). "There is nothing in the End." The black-market Unsanctioned Eyes are the Resistance's way in, and every sale is on the merchant's books for a trial. ✅ (`end_lockdown.js`)
21. **Breaking the Seal:** Loyalists and Syndicate fight the Ender Dragon together, the first act of open rebellion. 🔨 (dragon-kill trigger)
22. **The Ministry Archives:** End City chests hold Ministry documents: cover-ups, the order that sacrificed Oinkington, and proof the Ministry uses Techno's name for power. 🔨 (books added to End City loot; *TBD*: what exactly they reveal)
23. **The Realisation:** the Archives reveal that **the Order meter literally powers the Ministry's decrees**. Every Loyalist troll was harvested to control the server.
    - The Loyalists defect, and from then on their trolls count as Chaos.
    - The Resistance forms, with no friendly fire between its members.

    🔨

### Part I Finale: Protocol Clean Slate
Fires on **whichever meter fills last** in Act IV, after an op confirms:
- **Chaos fills:** the Ministry panics and fires the protocol.
- **Order fills:** the Ministry declares total victory and fires it itself, **"to protect trolling rights from trolls."**

The world ends either way.

24. **The Fake-out:** before the real thing, the Ministry runs a "test of the emergency broadcast system". A full doomsday countdown hits zero, then: "This was a test. Please resume compliance." 🔨
25. **The Last Decree:** Protocol Clean Slate, with a server-wide countdown bossbar. 🔨 (*TBD*: 72 h, a week, or a live night)
26. **The World Burns:**
    - thunder;
    - back-to-back Purges;
    - raids on everyone;
    - the broadcasts falling apart into static and denial.

    🔨
27. **The Exodus Satchel:** each player chooses a few items to save, filtered against mods Part II drops. They're saved to a file outside the world. 🔨 (*TBD*: slots)
28. **Beyond the Void:** the Syndicate reveals the only escape, the End's exit portal. Players jump and the **End Poem** plays: the end of Part I. ✅ (vanilla)
29. **The Last Broadcast:** the Ministry declares victory over an empty world, and the server goes dark.

---

## Intermission: The Rebuild (admin work)
30. **Archive Part I:** keep the old world as a download or a read-only tour.
31. **Schematics (WorldEdit):** the old spawn and Ministry HQ (for the Citadel), and famous bases (for ruins): the stronghold group's fortress, Tryhard's alchemy lab, the bastion raid site.
32. **The Part II modpack:**
    - new mods and integrations;
    - the Blood Pool tiers (see Part II);
    - fixes for this season's leaks:
      - Mystical Agriculture cobalt and Netherite essence;
      - the Foundry's diamond-ore → molten debris → Netherite;
      - ProjectE's state (EMC on Nether Stars, the Dragon Egg and Netherite Scrap);
      - Tinkers' Levelling Addon modifier slots.

    See [PROGRESSION_GATES.md](PROGRESSION_GATES.md).
33. **The new world:** the Citadel pasted on an outer End island, and ruins across the Overworld (chests emptied, lore books placed). *TBD*: a new seed, or the same seed regenerated.

---

## PART II: Technoblade Never Dies
Everyone stands together under Techno's banner. There are no Loyalists. The Ministry becomes a non-player enemy: its Inspectors and the Minister.

### Blood for the Blood God: the Blood Pool 🔨
**All progression in Part II is locked.** Tiers open only through the server-wide **Blood Pool**.
- **It's filled by:**
  - **trolls:** each logged troll adds its value as Drops of Blood (see [Scoring](#scoring));
  - **Hush Coins:** donated at **1,000 Drops each**, a sink for the economy.
- **Group unlocks:** when the Pool reaches a milestone, that tier unlocks for everyone. **An op confirms each unlock**; the confirm includes the `/reload` that brings the tier's recipes back.
- **A locked tier blocks crafting and use:**
  - its recipes are removed;
  - its blocks and items can't be placed or used.

  Tiers are defined as lists of mods, items or recipes.
- **The pace:** about 9 contributors, about 8 weeks, **12 tiers, about 1.5 million Drops in total**.
  - **Estimate:** about 25,000 Drops a day (about 30 trolls a day, plus about 20 coins a day).
  - **Cumulative thresholds** (settings, to be tuned):

    | Tier | Drops | Expected |
    |---|---|---|
    | 1 | 10,000 | about day 1 |
    | 2 | 30,000 | |
    | 3 | 60,000 | |
    | 4 | 100,000 | |
    | 5 | 160,000 | about week 1 |
    | 6 | 240,000 | |
    | 7 | 350,000 | about week 2 |
    | 8 | 500,000 | about week 3 |
    | 9 | 700,000 | about week 4 |
    | 10 | 950,000 | |
    | 11 | 1,200,000 | |
    | 12 | 1,500,000 | about week 8: the Siege |

  - **What each tier unlocks will be ranked once the Part II modpack is put together.** The only fixed point: **Tier 12 is the Siege**, when the Citadel's Bureaucratic Barrier falls.

### Act I: The Awakening
34. **Waking Up:** players arrive in the new world, as the End Poem promised. They get back their satchel items and legacy:
    - titles such as "Survivor of the Clean Slate", "Founder of the Syndicate" and "Grand Trollmaster";
    - their Part I trial records, now evidence of the Ministry's crimes.

    🔨
35. **The Ruins:** the remains of Part I bases are lore sites, with books telling Part I's story. 🔨
36. **The Shrine:** the scout's last testimony reveals Technoblade's Shrine, and the Blood Pool and the relic hunt begin. 🔨

### Act II: The Regalia of the Blade
37. **The Relic Hunt:** eight relics, restored at the Shrine by the whole server. Progress is tallied server-wide and credited to each contributor (`/regalia`). The amounts are placeholders. 🔨 (*TBD*: whether each relic also needs a Blood offering)

| Relic | Techno reference | The grind | Pulls players through |
|---|---|---|---|
| The Potato Tithe | The Potato War | 10,000 potatoes | Farming automation (Create, Mystical Agriculture, AgriCraft) |
| The Axe of Peace | His Dream SMP axe | A Tinkers broad axe meeting set conditions (Manyullyn or Hepatizon head, Netherite upgrade, set modifiers) | Tinkers' end game |
| The Totem Hoard | Never dying | 64 Totems of Undying | Raids, woodland mansions |
| The Wither's Due | He set Withers on L'Manberg | 8 Nether Stars | Wither kills (and Draconic's Wyvern tier) |
| The Chalice of Blood | "Blood for the Blood God" | 1,000 buckets of EvilCraft blood | EvilCraft, mob farming |
| Carl's Bridle | Carl, his horse | A horse bred to near-perfect speed and jump | Horse breeding |
| The Swine's Oath | The pig with the crown | 10 completed Pig Escorts | The server's own events |
| The Crown of the Blade | His crown | Awakened Draconium + a Dragon Heart + Gaia Spirit + a Chaos Shard | Draconic and Botania end game (last) |

38. **Shrine Raids:** each relic restored brings Inspectors down on the Shrine. ✅ (raids) + 🔨 (Shrine targeting)

### Act III: The Seizure
39. **The Confiscation:** the Ministry "seizes" a relic in a scripted event. Only the Shrine's progress is at stake, never players' items. 🔨
40. **The Outpost Raid:** players storm a Ministry outpost to take it back. 🔨

### Act IV: Project Chaos
41. **Prank Purges:** recurring, timed around relic deliveries. 🔨
42. **Ministry Bounties:** the Ministry posts bounties on the strongest players. ✅ (`economy/bounties.js`) + 🔨 (Ministry-issued)
43. **Project Chaos Revealed:** the Ministry has kept the Chaos Guardian contained on a Chaos Island. Its shards complete the Crown. ✅ (Draconic Evolution)

### Act V: The Siege
Needs Blood Pool Tier 12 and the full Regalia.
44. **The Citadel:** the old Ministry HQ, floating in the void behind the Bureaucratic Barrier. Players bridge or fly to it. 🔨 (WorldEdit schematic)
45. **The Minister:** a troll war with phases.
    - **The Minister's tricks:** fake deaths ("he's dead!" … "Phase 2"), hotbar swaps, a Cursed Food buffet, a decoy Minister, and a paperwork phase.
    - **The players' weapon:** trolls landed on him do real damage.
    - **Last phase:** cornered, he releases the Chaos Guardian.

    🔨
46. **The Crown Restored:** the full Regalia set in place, with the Techno Tribute and a server-wide `/superaura`. A single `/fakejoin Technoblade` as the tribute. There's no `/fakesay`, so no words are put in his mouth, and it's posted to Discord. ✅ (`techno_tribute.js`, `smite.js`, `fake_players.js`)
47. **The Final Broadcast:** *"Technoblade never dies. This is not The End."*

---

## Systems already built (and how the story uses them)
| System | File | Story use |
|---|---|---|
| Factions, ranks, desertion | `factions/factions_core.js`, `factions_config.js` | Loyalists vs Syndicate; the defections; the Resistance |
| Portal ambushes, raids, "no getting away" | `factions/portal_ambush.js` | Inspector patrols, Blood God war parties, Purges |
| Pig Escort and the Nether lock | `events/pig_escort.js` | Oinkington; the template for scripted events and dimension locks |
| The End Lockdown Initiative | `end_lockdown.js` | The End sealed: Eyes confiscated, portal-only entry, Unsanctioned Eyes on the black market |
| Black market (Hush Coins, contracts, traps, pranks, tracking, alibis) | `economy/black_market.js` | The troll tools behind the Troll Log; the underground economy |
| Bounties | `economy/bounties.js` | Ministry bounties in Part II |
| Trials | `factions/trials.js` | Show trials; "unlicensed trolling" charges; trolling vs griefing; records carried into Part II |
| Ministry broadcasts | `ministry_broadcasts.js` | The narrator; per-act line pools to add |
| Techno Tribute, /superaura, fake players | `techno_tribute.js`, `smite.js`, `fake_players.js` | Manifestations of Techno's legacy; the finale |
| **Troll Log, Order vs Chaos, Blood Pool** | `trolls.js` 🔨 (planned; hooks into `black_market.js`) | The engine of the whole story |

## Build order
1. The **chapter and decree system** (acts, decrees, op-confirmed advances).
2. **`trolls.js`:** the Troll Log, scoring, Hush Coin payouts, manual reports (witnesses + admin points), Order and Chaos with op-confirmed fills.
3. Act II: the **Scout NPC** and his testimony; the Trolling Licence Act.
4. The **event scheduler** (Prank Purges, Mandatory Fun Day, the Moratorium).
5. Act IV: the **Archive documents** and the **dragon-kill trigger** (the End lock is done: `end_lockdown.js`).
6. **Protocol Clean Slate:** the fake-out, the countdown, the decay, and exporting satchel and legacy data.
7. Part II (with the new modpack):
   - the **Blood Pool and tier lockdown**;
   - satchel and legacy import;
   - the Shrine and relic tracker;
   - the Seizure;
   - the Minister fight.

## Open decisions
- **Meters:** each act's meter size; what each Order and Chaos reward does exactly; how long the Moratorium lasts.
- **Troll Log:** the final value of each troll; exact Hush Coin payouts per troll; whether Anonymous Summons (cheap, needs no aim) should also go to manual reports.
- **Decree gating in Part I:** hard locks, or soft pressure.
- **Crownsworn players:** whether active Crownsworn players will role-play the defection, or the loyalists are mostly NPCs.
- **Clean Slate:** the Exodus Satchel size, and the countdown length.
- **Part II world:** a new seed, or the same seed regenerated.
- **Archive documents:** what they reveal (for example who really killed Oinkington).
- **Part II tiers:** what each of the 12 Blood Pool tiers unlocks, decided with the Part II modpack.
- **Regalia:**
  - relic amounts;
  - whether relics need a Blood offering;
  - whether relics must be restored in order;
  - whether a carrier killed in a Purge loses their delivery;
  - rewards per relic.
