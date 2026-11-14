# Technoblade Never Dies: the story of Trollcraft III

The server's story in two parts.
- **Part I:** the Ministry of Trolling rules, and players are divided into Loyalists (Techno's Crownsworn) and the Blood God's Syndicate. It ends with everyone realising the Ministry is corrupt and uses Technoblade's name for power, and the world being destroyed.
- **Part II:** a new world and a rebuilt modpack. Everyone stands together under Techno's banner and lays siege to the Ministry.

**Trolling drives the story.**
- Every troll is logged and scored.
- In Part I, trolls are logged, scored and paid, and every point is kept for Part II. Acts move forward when an op says so. Part I ends with **Protocol Clean Slate**, and the way out is the **Blood Portal**.
- In Part II, the **Blood Pool** unlocks all progression (its progression lock tree), and each player's rank in **Techno's Potato War** decides what they may craft from it. Neither is part of Part I.
- Ministry **decrees** are announcements; boss kills and relics carry the plot.

Legend: ✅ = built and running, 🔨 = still to build, *TBD* = open decision (see [Open decisions](#open-decisions)).

Tone: Technoblade passed away in 2022, and "Technoblade never dies" is how his community remembers him. The Ministry is played for comedy; Techno himself is treated with respect. Nothing makes light of his passing.

---

## The heart of the story: trolling

### The theme
- **The Ministry of Trolling** claims it exists **to secure the right of trollers to troll freely**. In practice it runs **Managed Trollocracy**: trolling licensed, taxed and turned into control. "Trolling equality is a right. Being trolled is a responsibility." (`ministry_broadcasts.js`)
- **Technoblade** (an anarchist on Dream SMP) stands for **free chaos**. The rebellion is about taking trolling back.

### The Troll Log ✅ (`economy/trolls.js`, see [TROLLS.md](tools/kubejs/TROLLS.md))
Every troll is recorded: who, on whom, what, where and when.
- **Logged automatically,** from triggers the black market already sees:
  - Disguised TNT or a Teleport Trap sprung on someone else;
  - a Mimic Chest opened;
  - Cursed Food eaten;
  - an Anonymous Summons delivered;
  - a Homing Pig reaching the target's bed.
- **Not logged automatically: Butterfingers and Itching Powder.** They're too easy to land and would flood the log. Those trolls go through manual reports, where an admin weighs them and sets fair points.
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
These are the script's settings. In Part II the same value goes into the **Blood Pool** as Drops of Blood; Part I keeps each player's points for it.

| Troll | Value | Hush Coins |
|---|---|---|
| Anonymous Summons | 50 | 1 |
| Cursed Food eaten | 100, + 25 per curse | 2 |
| Mimic Chest opened | 150 | 3 |
| Homing Pig reaching the bed | 150 | 5 |
| Teleport Trap | 200 | 5 |
| Disguised TNT | 250 | 6 |
| Approved manual report (including Butterfingers and Itching Powder) | set by the admin, typically 25–500 | 1 per 100 points |

- **Cross-faction bonus ×1.5:** for trolling someone of the opposite faction (in Part II, for trolling Ministry NPCs).
  - The Syndicate is a secret faction, so the bonus is **never shown per troll**. In Part I such trolls are only marked (hidden) in the log; Part II's Blood Pool pays the bonus. `/trolls me` shows base points only, and nobody can work out a victim's faction from their score.
- **Revenge ×2:** a victim who trolls their troller back within 24 hours.
- **Diminishing returns:** the same victim within 24 hours counts ×0.5, then ×0.25.
- **Nothing counts** for trolling yourself, AFK players or players on the same IP.
- **Good sport:** victims get a small share of the points too.
- **Hush Coins per troll:** every logged troll pays the troller some Hush Coins (the table above), always **below the cost of the troll item used**, so two friends can't print coins by trolling each other.
- **Anonymity:** victims aren't told who trolled them, and the public log shows "someone"; only ops see names.

### Guardrails
- Pranks cost time, not progress: no permanent loss of gear or bases outside story events.
- Disguised TNT should only break blocks during Prank Purges or story operations.
- The court (`trials.js`) rules on trolling versus griefing.

---

## PART I: The Ministry's Reign

### How Part I moves forward ✅ (`story.js`, see [STORY_COMMANDS.md](tools/kubejs/STORY_COMMANDS.md))
- **Acts are advanced by an op** with `/story act next` (or `/story act set <id>`), when the story is ready. Each act opens with a full-screen title, the Ministry's lines and a `[SIGNAL HIJACKED]` reply.
- **Decrees are announcements only:** numbered proclamations from #41, issued with `/story decree issue|preset`, listed with `/decrees`, and overturned with `/story decree revoke`. Breaking one is something Enforcers can charge with `/accuse`; nothing is blocked by code.
- **The Blood Pool is saved for Part II's progression lock tree** (owner decision). Part I keeps every player's troll points, and the hidden cross-faction marks, for it.
- **Ministry events** (Prank Purge, Mandatory Fun Day, the Trolling Moratorium, a Ministry Meltdown) are op-run (next batch).
- **Dropped:** the Order and Chaos meters (owner decision).

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
Starts with `/story act next`.
11. **The Decrees Begin:** the Ministry issues numbered decrees. They're announcements (nothing is blocked), some serious and some just absurd ("Decree 42: all chests must face north"). ✅ (`story.js`)
12. **The Trolling Licence Act:** all pranks need a permit. Unlicensed trolling becomes a chargeable offence (`/accuse … Unlicensed trolling`), and the black market goes truly underground. ✅ (trials; `/story decree preset licence_act`)
13. **The Scout Awakens:** the sleeping scout wakes as an NPC. Each conversation gives a piece of testimony, hinting that **the Ministry staged the Escort**. 🔨
14. **Treason Hunts:** Inspectors and Blood God raids keep up the pressure on the Syndicate. Now and then Inspectors turn up, do paperwork and leave. ✅ (ambushes, raids, Ambush Contracts)

### Act III: The Loyalty Audit
Starts with `/story act next`.
15. **The Audit:** the Ministry turns on its own Loyalists: inspections of Crownsworn players, Hush Coin tithes, curfews, and Troll Quotas. ✅ (decrees) + 🔨 (Audit events)
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
Starts with `/story act next`.
20. **The End Lockdown Initiative:** already in force (see 10). "There is nothing in the End." The black-market Unsanctioned Eyes are the Resistance's way in, and every sale is on the merchant's books for a trial. ✅ (`end_lockdown.js`)
21. **Breaking the Seal:** Loyalists and Syndicate fight the Ender Dragon together, the first act of open rebellion. The dragon was the Ministry's Head of Records Security, so **killing it exposes the Archives, and the Ministry fires Protocol Clean Slate** (the finale). ✅ (`clean_slate.js`)
22. **The Ministry Archives:** End City treasure chests hold ten classified Ministry documents (a 50% chance per chest, any time): the full Sanctity of Swine Act, the memo ordering the Escort to fail, the committee that rebranded "Technoblade never dies", the Crown melted into lapel pins, the Potato Requisition Order, Carl's personnel file, the "Blood for the Blood God" trademark, the ELI's internal version, the merchandise catalogue, and the Clean Slate procedure itself ("Burn the Archives first."). ✅ (`events/blood_portal.js`)
23. **The Realisation:** the Archives reveal the Ministry's crimes against Technoblade's legacy: it has been using his name for power.
    - **Draft Bill 9-D, the Dwarf Management Act:** brand new and about to become law, given only to whoever kills the dragon. It's the Ministry's openly bigoted plan for dwarves, written to turn **Goruk the Dwarf**. ✅
    - The Loyalists defect.
    - The Resistance forms, with no friendly fire between its members.

    (Played out by the players.)

### Part I Finale: Protocol Clean Slate ✅ (`clean_slate.js`, `events/blood_portal.js`, see [CLEAN_SLATE.md](tools/kubejs/CLEAN_SLATE.md))
**The Ministry fires it, to wipe the records that incriminate it.** With the dragon (its Head of Records Security) dead, the Archives in the End are exposed, so the Ministry burns the world and the evidence with it. It starts automatically about 12 seconds after the first dragon kill (an op can also start it with `/cleanslate start`). The world has **4 days**.

24. **The Activation:** the finale act opens with the Ministry: "The Ministry's records have been accessed by unauthorised citizens. This is regrettable. Protocol Clean Slate is now in effect. All records, and the world they are kept in, will be cleaned. This is for your protection. Nothing incriminating was ever written down." The hijacked signal answers: "They are burning the world to bury what they did." No fake-out countdown (owner decision). ✅
25. **The Countdown:** a server-wide bossbar counting down 4 days. ✅
26. **The World Burns** (no blocks changed):
    - an endless thunderstorm (fire spread is switched off for the 4 days, so bases survive for the archive);
    - visual-only lightning near players, more often as zero comes closer;
    - the Ministry's countdown to the wipe ("hand in Ministry records for safe burning"), falling apart into static, answered by the hijacked signal, which keeps sending players to the End City treasure chests for the Relics (and reminds everyone every 6 hours until they're gathered).

    ✅
27. **The Blood Relics:** ten custom Relics of Technoblade's legacy, found in End City treasure chests while Clean Slate runs (60% per chest). One player must carry all ten at once. Then anyone can run `/bloodportal start`. ✅
28. **The Blood Portal:** everyone is pulled to a preset arena and their spawn set there. Blood drifts through the air, and a **"Blood Pool"** bossbar fills as Ministry Inspectors are killed; the fuller it gets, the more come. When it's full, the bedrock basin fills with blood and hypixel calls: "The time has come to escape, players! COME TO THE NEW WORLD!" Stepping into the blood saves the player's inventory and legacy for Part II and kicks them from the server with a farewell. ✅
29. **The Last Broadcast:** at zero, the Ministry declares the records destroyed and victory over an empty world ("There is no evidence of wrongdoing. There is no evidence of anything."). Anyone still here falls (spectator mode), and the server goes dark. ✅

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
      - ~~ProjectE's state~~ ProjectE removed from the pack (with AppliedE and Tinkers' EMC);
      - Tinkers' Levelling Addon modifier slots.

    See [PROGRESSION_GATES.md](PROGRESSION_GATES.md).
33. **The new world:** the Citadel pasted on an outer End island, and ruins across the Overworld (chests emptied, lore books placed). *TBD*: a new seed, or the same seed regenerated.

---

## PART II: Technoblade Never Dies
Everyone stands together under Techno's banner. There are no Loyalists. The Ministry becomes a non-player enemy: its Inspectors and the Minister.

### The two threads (owner decisions 2026-11-13; still being built)
Part II runs on two goals that want the same thing, the seals broken, for opposite reasons. Players see the first, and only slowly glimpse the second.
- **The Blood God is real.** He is the spirit of Technoblade. This is only ever implied, never stated.
- **His purpose: to take back his name.** The Ministry ruled in Techno's name in Part I, and the Blood God wants it back. The players can agree with that.
- **The Ministry's purpose** is to take the Blood God's power, and with it control Technoblade's legacy. It ruled in his name in Part I; now it wants his power itself. What that gets it:
  - **a puppet god:** his voice and name become the Ministry's, so it can speak as the Blood God, and rule as Techno, without anyone questioning it;
  - **a god that never dies:** Techno's undying quality, and with it a Ministry that never dies.
- **Why the players fill the Pool, not the Ministry:** only freely given blood feeds the Blood God: trolls, tithes, offerings and fights. So the Ministry sealed the world and made every step of progress cost blood. "Faith fills faster than force."
  - **The means:** the Harvest. The seals are a pump. At the twelfth seal the Ministry drains the Pool's essence and seals it in a Chaos Guardian (the Deep Records).
  - **The Purges' Tithe** is a second pump.
- **Why a Chaos Guardian:** in the last series, Technoblade made himself infamous by killing several Chaos Guardians. The Ministry binds his power into the creature he was famous for killing.
- **The Crown is the key for both sides:** the Ministry needs it to make the binding hold for good, and the restored Crown is how the Blood God takes back his name.
- **The Blood God knows,** and hints at it ("They want the Pool full. So do I.").
- **The twelfth seal isn't the end:** it begins the final act (Act V): the drain, the vessel and the race for the Crown.
- **The players can't lose:** the good ending is always reachable. Whatever they fail to win back makes the final fight harder.
- **The Citadel doesn't exist yet:** its reveal can come later in the story. Nothing is planned around it for now.
- **Hints only, until the final act:** both goals are hinted at, never spelled out, and built up across Part II. The Shrine Awakens (#36) is the first night both are glimpsed.

Owner decisions 2026-11-13: his purpose, the puppet god, the freely given blood, the Chaos Guardian vessel, the Crown, the final act, the players can't lose, and the Citadel left for later.

### Blood for the Blood God: the Blood Pool ✅ (`part2/blood_pool.js`, `part2/dimension_gates.js`, see [BLOOD_POOL.md](tools/kubejs/BLOOD_POOL.md))
**All progression in Part II is locked.** The Ministry, exposed at the end of Part I, sealed the new world's progression to keep everyone weak. Each tier is one of **the Ministry's seals**, and only blood breaks them. Tiers open only through the server-wide **Blood Pool**. It starts at 0: Part I troll points don't count (owner decision); they only become legacy titles.
- **It's filled by:**
  - **trolls:** each logged troll adds its value as Drops of Blood (see [Scoring](#scoring));
  - **Hush Coins:** donated at **1,000 Drops each**, a sink for the economy;
  - **the Potato Tithe:** potatoes spilled into the Pool for the Blood God. **4,000 potatoes = 1,000 Drops**, capped at **30,000 Drops a day** server-wide. The quota reopens at 4 am Central (owner decisions). Tithed potatoes never count toward anyone's Potato War rank;
  - **boss kills** ✅ (`part2/boss_blood.js`, see [BOSS_BLOOD.md](tools/kubejs/BOSS_BLOOD.md)): Twilight Forest bosses pay by how hard they are, the same ranking as the boss chests in `part2/twilight_bosses.js`: the Naga 200 up to the Snow Queen 1,000. Every kill pays, and the credit is split among the fighters within 64 blocks (owner decisions).
- **Group unlocks:** when the Pool reaches a milestone, that tier unlocks for everyone. **The players break the seal by vote** (owner decision, 2026-11-10): five different players' `/bloodpool vote` open it (`/bloodpool unvote` takes a vote back while the seal holds), and an op's `/bloodpool unlock` still opens it at once. Everyone who logs on while a tier is ready is told, with the count. Opening includes the `/reload` that brings the tier's recipes back.
- **A locked tier blocks crafting only** (owner decision): its recipes are removed in every recipe type. Sealed items that players find, loot or trade for work normally. The exception is what players may have brought from Part I, since they kept their inventories (owner decisions, 2026-11-09). 39 items that work by being used (guns, bows, staffs, teleporters, the Raygun) can't be used until their tier opens (`USE_LOCKS` in `blood_pool.js`). The Nuclear Bomb, Tremorzilla Egg and Ender Quarry can't be placed until Tier 11 (`PLACE_LOCKS`), and a dispensed Nuclear Bomb doesn't spawn (`SPAWN_LOCKS`). Gear that's worn or wielded isn't locked yet.

  The tiers are lists of mods, items, tags and recipe ids in `blood_pool.js`, filled from the progression research ([research/TIER_PROPOSAL.md](research/TIER_PROPOSAL.md)). Twilight Forest and Tinkers are open from day 0 (gear tiered by item); ironwood is open.
- **The tank** (`part2/blood_tank.js`): a tower of chiseled nether bricks, glass and nether gold ore whose 3×3×6 chamber fills one layer of blood for every 2 tiers. It's full at the twelfth seal, and the drain empties it (Act V).
- **Dimensions:** the **Nether opens at Tier 3** and the **End at Tier 9** (owner decision). Until then Nether portals don't light, Eyes of Ender can't be crafted, and anyone who gets in is sent back by the Ministry. When the tier opens, the Blood God announces that the Ministry's seal has shattered.
- **Voices:** the Blood God speaks for the Pool (ready, unlocked, the tithe). The Ministry speaks only as the enemy holding the seals (sending players back). Nothing in Part II has the Ministry granting, permitting or weighing anything.
- **The pace:** about 9 contributors, **12 tiers, 4.4 million Drops in total** (thresholds doubled, owner decision; Tier 12 raised from 3,000,000 to 4,400,000, owner decision 2026-11-13).
  - **Estimate:** about 25,000 Drops a day from trolls and coins, plus up to 30,000 a day from the Potato Tithe: **about 11½ weeks if the server farms, about 25 if it only trolls**.
  - Tier 11 comes at about week 6 (week 14 if the server only trolls), and the last seal then takes 2,000,000 Drops more.
  - **Cumulative thresholds** (settings):

    | Tier | Drops | Expected |
    |---|---|---|
    | 1 | 20,000 | about day 1 |
    | 2 | 60,000 | |
    | 3 | 120,000 | about day 2: the Nether |
    | 4 | 200,000 | |
    | 5 | 320,000 | about week 1 |
    | 6 | 480,000 | |
    | 7 | 700,000 | about week 2 |
    | 8 | 1,000,000 | about week 3 |
    | 9 | 1,400,000 | about week 4: the End |
    | 10 | 1,900,000 | |
    | 11 | 2,400,000 | |
    | 12 | 4,400,000 | about week 11: the last seal and the final act |

    (Expected times assume the tithe quota is filled daily; trolls and coins alone take about twice as long.)

  - **What each tier unlocks** is decided (BLOOD_POOL.md, from the research). **Tier 12, Full Measure, is the last seal.** It begins the final act (Act V) and unlocks no recipes.
    - **The name** (owner decision 2026-11-13): it was "The Siege". Like the other tiers, it's a measure of water, and it quietly echoes the Ministry's Protocol Full Measure (Deep Record #8).
    - **The quest book** lists it as "The last seal", with no Citadel.

### Techno's Potato War: each player's Potato Standing ✅ (`part2/blood_pool.js`, `economy/black_market.js`, see [BLOOD_POOL.md](tools/kubejs/BLOOD_POOL.md#the-potato-war-each-players-potato-standing))
Technoblade's Potato War, revived. **The Pool decides what the server can make; your rank decides what you can make** (owner decisions).
- **Raising your rank:** `/potatowar offer` gives potatoes to Techno's war chest. Your **Potato Standing** is the lifetime total, with no cap. Offered potatoes only count toward rank and never fill the Pool, and tithed potatoes never count toward rank.
- **Ranks:** 11, from **Potato Farmer** (250) through **Potato Soldier** (50,000) and **Potato General** (2,000,000) to **Potato Emperor** (4,400,000). Owner decisions, 2026-11-09: ranks 4 and 5 are 25,000 and 50,000, and ranks 6 and up are 20x the first ladder. Tree nodes from Potato Private up cost 5x their first draft (owner decision, same day). **Ranks wait for the Blood Pool** (owner decision, same day): a rank can be at most one above the Pool's open tier, so rank n needs Tier n−1. Potatoes offered past that still count, and the rank comes when the tier opens. Ranks players already held above the cap when it arrived are kept (owner decision, same day); only later progress is capped. **A rank, once earned, is never lost** (owner decision): it's the highest the potatoes have ever bought, so a Purge's Potato Heist can take potatoes but not the rank; only an op's `/potatowar set` can lower it. Each rank-up gets a title and a server-wide line ("Ana has risen to Potato Soldier in Techno's Potato War").
- **What a rank unlocks:**
  - **Crafting:** rank n lets a player craft Tier n's items **at a crafting table**, once the Pool has opened that tier. Machines stay server-wide (they can't tell who's using them).
  - **Autocrafters** only make what every player can already craft, and setting one up (and using one) takes its node in the upgrade tree.
  - **The black market:** the Hooded Merchant only sells certain items to high enough ranks: pranks from Potato Farmer, the Writ from Potato Recruit, Disguised TNT and the Tracker from Potato Private, up to the War Party contract at Potato Captain. There's no discount (owner decision).
- **The early ranks are cheap** so a hand farm reaches IE's Garden Cloche (Tier 3), and the Cloche reaches Thermal's Insolator (Tier 5).
- **The upgrade tree** ✅ (`part2/potato_tree.js` + FTB Quests, see [POTATO_TREE.md](tools/kubejs/POTATO_TREE.md)): Hypixel-style branches on top of the ranks (owner decisions).
  - **The book:** an FTB Quests chapter group, "Techno's Potato War": The Ranks, Tinkers' Smithy, Logistics, Autocrafting and Farms.
  - **Nodes** cost potatoes plus branch items. The potatoes count toward rank.
  - **Each node unlocks, for that player only:**
    - the Tinkers metals their gear may be made of (found and traded gear included);
    - building and using a smeltery or foundry;
    - placing and using autocrafters, logistics blocks, AE2 terminals and farm machines.
  - **Personal:** FTB Teams parties are switched off, so progress is per player.
  - **Clarity:**
    - the book opens with "Start Here" and has a "Blood Pool" chapter that ticks as tiers open;
    - Shift tooltips show what any item needs and whether you have it;
    - `/potatowar next` says what to do next;
    - when a tier opens, each player is told privately what it means for them.
  - **Cohesion audit** ([PROGRESSION_AUDIT.md](PROGRESSION_AUDIT.md)): the tiers, ranks and tree are checked against every mod's recipes. Mods' own crafting formats now carry the rank check, and the cross-mod routes that made sealed metals early are locked.
- **Nobody falls behind** (owner decision): when the Blood Pool opens Tier T, every player gets crafting access and every tree node for Tiers 1..T−2 for free. Their rank's name and black market perks still come from potatoes only.

### Act I: The Awakening
34. **Waking Up:** players arrive in the new world through the Blood Portal. Each keeps **their whole inventory** (owner decision 2026-11-05, replacing the earlier 9-item pick), and gets their legacy:
    - titles such as "Survivor of the Clean Slate", "Founder of the Syndicate" and "Grand Trollmaster";
    - their Part I trial records, now evidence of the Ministry's crimes.

    🔨
35. **The Ruins:** the remains of Part I bases are lore sites, with books telling Part I's story. 🔨
36. **The Shrine Awakens** (the next major event; owner decisions 2026-11-13): one big evening, about 90 minutes, run live by ops.
    - **Where the server is:** Part II, early, at Blood Pool Tier 2 with about 66,000 Drops.
    - **What it does:** the Blood God reveals Technoblade's Shrine, the relic hunt (Act II) begins, and the Pool reaches its third seal, which opens the Nether.
    1. **The Signal** (the day before): a scrambled, unsigned broadcast, plus a Discord post with the time. Gather at the castle.
    2. **The Summons** (about 10 minutes, at the castle): the testimony is the **Blood God's** (owner decision 2026-11-13; it was the scout's). His words come as a book that everyone gets, and the Castellan reads them out. They name **three braziers**, far apart.
    3. **The Pilgrimage: three braziers, three teams** (about 30 minutes).
       - **Lighting them:** the server splits up, and the braziers must all be lit within 60 seconds of each other. Otherwise the lit ones gutter out, and the teams try again.
       - **The beam:** once all three burn, a beacon beam rises at the Shrine site, visible from far off.
       - **Ambushes:** unsigned Inspector patrols ambush "unregistered pilgrims" on the way.
    4. **The Shrine Rises** (about 15 minutes; changed 2026-11-13 from a Shrine hidden underground): the beam stands over empty ground. Once the pilgrims have gathered there, an op starts the rise, and the Shrine **builds itself layer by layer from the ground up** out of the owner's schematic, with rumbling and particles. It stays afterwards as the Shrine for the relic hunt.
    5. **The Ignition Rite** (about 20 minutes, at the Shrine).
       - **The waves:** Inspectors close in on the Shrine from the land around it, escalating from iron-tier to diamond-tier. The last wave brings a **Senior Inspector** mini-boss, who drops the most.
       - **The potatoes:** every Inspector carries **Potato King's Potatoes**, Techno's own potatoes, which the Inspectors had been hoarding.
       - **The offering:** offered at the altar, each potato fills the rite's bar and lights the Shrine stage by stage. It needs **8 potatoes per player present**.
    6. **The Awakening** (about 5 minutes, respectful, no jokes).
       - **The tribute:** the Techno Tribute and a server-wide `/superaura`.
       - **The Regalia:** the Blood God names the **Regalia of the Blade**, and `/regalia` opens on the eight relics.
       - **The book:** the book *The Regalia of the Blade* appears on the altar's lectern, under Technoblade's head (owner decision 2026-11-13). It has one page per relic: what each honours and what it asks. Anyone can read it there.
       - **The Pool:** the rite tops it up to **Tier 3's threshold** (120,000; about 54,000 Drops), credited to each player by the potatoes they offered. Everyone present then breaks the third seal together with `/bloodpool vote`, and **the Nether opens** that night.
    - **The reward is the Drops** (owner decision): no title or keepsake.
    - **Still needed:**
      - **From the owner:** the Shrine's schematic (with an altar), the three brazier sites and the Shrine site, and the date;
      - **To write:** the Blood God's summons (the book) and the Signal;
      - **To build:** `part2/shrine.js`: the op-run stages, the braziers and the beam, the layer-by-layer rise (the schematic converted into one structure piece per layer, by `tools/schematic/schem_to_structures.js`), the Inspector waves and the Senior Inspector, the Potato King's Potato and the altar bar, the Drops top-up, the Awakening, and the start of `/regalia`.

    🔨

**The Deep Records** ✅ (`part2/deep_records.js`, see [DEEP_RECORDS.md](tools/kubejs/DEEP_RECORDS.md)). The old world wasn't burned, it was **buried**: an ancient city turned out to be part of it, and the Warden replaced the dead dragon as Records Security. Eight `[REDACTED]` books in structure chests reveal the Ministry's real objective, without naming it.
- **The Harvest (owner decision):** the seals are a pump, not a prison. The Ministry sealed the new world so the server would fill the Blood Pool. At the twelfth seal it drains the Pool's essence and seals it in a Chaos Guardian: a puppet god that never dies, speaking in Techno's name (see [The two threads](#the-two-threads-owner-decisions-2026-11-13-still-being-built)). "They will think they won."
- **Paced by the Pool:** each book waits for a Blood Pool tier. Books 1–5 turn up in overworld chests (ancient cities, strongholds, buried and ruined sites, mineshafts and dungeons) in Twilight Forest chests (the Lich Tower library and boss treasure most often) and in Ice and Fire dragon lairs. The lairs also hold a real hoard (`part2/dragon_hoard.js`, see [DRAGON_HOARD.md](tools/kubejs/DRAGON_HOARD.md)). The biggest reveals, books 6–8 (the pump, the Binding Order, Protocol Full Measure), are in End City chests only (owner decision).
- **The Surveyor's notes** (Deep Record #9, given by command only): the admins placed them in a dragon lair. A dead Office surveyor read the orders they carried; the notes hint at the drain and point to where the other books are kept.
- **What it sets up:** the final act (Act V). Book 7 names the vessel, a Chaos Guardian, and books 7 and 8 say the binding needs the Crown.

**The Castellan** (a player role; owner decision). A Part I **Enforcer** keeps the spawn castle.
- **The story:** the castle was the Ministry's **Induction Castle**, where recruits were processed and Enforcers stationed. When Clean Slate fired, the Ministry evacuated "officials first" (its own SOP), and its Enforcer at the castle was left to burn with everyone else.
- **Her loyalty is never confirmed.** The Ministry's files list her as "Enforcer, status: under review". She plays it however she likes.
- **A light role:** the `[Castellan]` title (FTB Ranks, see [tools/serverconfig/ftbranks_castellan.md](tools/serverconfig/ftbranks_castellan.md)) and spawn as her seat. She builds there **without being an op**: vanilla spawn protection is off, and `protected_areas.js` protects the same square around world spawn (`spawnRadius`) with her on its allowed list. Everyone can still use doors and buttons there (`allowUse`).
- **Optional ceremonial jobs:** swearing in arrivals under Techno's banner, reading Purge declarations, and neutral ground for ransom handovers.
- **A Part II Ministry broadcast line** for `ministry_broadcasts.js`: "The Ministry has not forgotten its Enforcer at the castle. Her file remains open. Her pension does not."

  ✅ (title and castle files) + 🔨 (the broadcast line, with the other Part II lines)

### Act II: The Regalia of the Blade
37. **The Relic Hunt:** eight relics, restored at the Shrine by the whole server. Progress is tallied server-wide and credited to each contributor (`/regalia`). The amounts are placeholders. 🔨 (*TBD*: whether each relic also needs a Blood offering)

| Relic | Techno reference | The grind | Pulls players through |
|---|---|---|---|
| The War Chest | The Potato War | 10,000 potatoes, counted for the relic only (no Potato Standing, no Drops) | Farming automation (Create, Mystical Agriculture, AgriCraft) |
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
41. **The Purges:** recurring, timed around relic deliveries, with a different game mode each week. ✅ (the engine and the first mode: `part2/purge.js`, see [PURGE.md](tools/kubejs/PURGE.md)) + 🔨 (more modes, scheduling, patrons)
    - **The premise (owner decisions):**
      - Inspired by Mianite's Purges.
      - **The declarations are unsigned.** Nobody knows who runs the Purges, and the script never names the Ministry. The Castellan reads them out at the castle.
      - **Mianite-style rules:** a gear rule per Purge (the preset kits), most points wins, and a trophy that carries over on a tie.
    - **The Tithe (the hidden Harvest):** a cut of what each Purge moves quietly vanishes into a secret count (`/purge tithe`, ops only).
      - The reveal comes later, in a Deep Record or an End City book: the Purges were the Ministry's fastest pump. *"Supervised recreational bloodletting, held weekly, raises yield by 340%. Participants believe it to be their own tradition."*
      - The count becomes the evidence ("your Purges gave them N").
    - **The patrons (planned):**
      - the **Blood God** (Techno) backs a champion with honest gifts;
      - the unnamed **Benefactor** (secretly the Ministry) gives better gifts, and every kill made with them feeds the Tithe.
    - **The first mode, the Potato Heist** ✅. Every kill steals from the victim's Potato War total. Owner decisions:
      - 5% per kill (50 to 2,500), and **ranks are never lost**;
      - 80% to the killer, and **20% vanishes into the Tithe**;
      - only rank 3+ can be robbed; repeat robberies are worth less, and revenge on your robber takes double;
      - **preset kits for everyone** (Soldier, Peasant, Archer, Gladiator), so no player has the clear advantage. Everyone online fights; their belongings are vaulted and handed back at the end;
      - the spawn castle is the **sanctuary**, where nobody fights.
    - **Modes to build next (brainstorm):**
      - **the Swine Heist** (Mianite's Purge 2.0: steal pigs into your pen, with the castle as the neutral hall);
      - Hot Potato (the Tithe Potato), Body Swap Roulette, Manhunt, Masquerade (Friendly Fire), Blood Moon (co-op), Seize the Hill;
      - and a Grand Purge before the Siege, with a wheel of mutators.
    - **Super weapons** are the Purges' prizes, each one held by whoever can keep it:
      - **Leelinda's Stake:** the Minotaur Axe from the Minoshroom's labyrinth. Announced by hand.
      - **The Anamian Axe** ✅ (`anamian_axe.js`, see [ANAMIAN_AXE.md](tools/kubejs/ANAMIAN_AXE.md)): a living weapon forged for Lord Anamy. It gains Souls from kills, bosses, felled trees and offerings, and levels I–X. It learns Timber, Cleave, Bloodthirst and Blood Harvest, turns netherite at VIII, and calls lightning on crits at X (Judgement). Only one exists; whoever holds it keeps its level, and the server is told when it changes hands or goes loose (owner decisions).
42. **Ministry Bounties:** the Ministry posts bounties on the strongest players. ✅ (`economy/bounties.js`) + 🔨 (Ministry-issued)
43. **Project Chaos Revealed:** the Ministry keeps a Chaos Guardian contained somewhere in the End: the vessel the drain will fill (Act V). Deep Record #7 names it (Tier 10). Chaos Guardians' shards complete the Crown. ✅ (Draconic Evolution) + 🔨 (the reveal)

### Act V: The Drain (the final act)
Starts at Blood Pool Tier 12. **The twelfth seal isn't the end of Part II; it begins the final act** (owner decisions 2026-11-13). 🔨 (all of it, except where marked)
44. **The Twelfth Seal:** the server breaks the last seal by vote and celebrates. Then the drain opens.
    - The Blood Pool's essence is drained and sealed in a Chaos Guardian, Project Chaos's vessel, and the tank empties. "They will think they won."
    - **The tiers stay open:** the drain is story only, and every unlocked recipe stays unlocked.
45. **The Puppet Speaks:** the Ministry speaks as the Blood God.
    - Decrees come "by order of the Blood God", with Techno's lines said wrong.
    - His real voice is faint, and players learn to tell it from the fake.
    - The Ministry still doesn't sign its own name.
46. **The Hunt for the Vessel:** the Guardian is hidden on a far Chaos Island. Clues lead players to it: the Deep Records, the Surveyor's notes and the Blood God's whispers.
47. **The Dragonslayer** (the god that never dies): the vessel is reborn after every kill, each time as a "revised edition".
    - **Each kill frees part of the essence** back to the Shrine, and the Blood God's voice comes back a little.
    - The server kills it again and again, as Techno did.
    - **Only the restored Crown** lets it die for good.
48. **His Return:** with no seals left, freely given blood goes straight to the Blood God.
    - The Pool refills as his strength, which powers the players against the vessel (buffs, smites).
    - So trolling still matters after the last tier.
49. **The Race for the Crown:** the Ministry needs the Crown to make the binding hold, so after the drain Inspectors come for the Regalia at the Shrine. Whoever holds the Crown decides whether the vessel can fall.
50. **The Crown Restored:** the full Regalia set in place takes back his name, and the vessel dies for good.
    - **The tribute:** the Techno Tribute and a server-wide `/superaura`, with a single `/fakejoin Technoblade`.
    - **Nothing in his mouth:** there's no `/fakesay`, so no words are put in his mouth.
    - **Posted to Discord.**

    ✅ (`techno_tribute.js`, `smite.js`, `fake_players.js`)
51. **The Final Broadcast:** *"Technoblade never dies. This is not The End."*

- **The players can't lose:** every share of the essence left in the vessel makes its last fight harder, and the ending reflects how much was won back. The good ending is always reachable.
- **Still to decide:**
  - how many kills the vessel takes;
  - what each "revised edition" changes;
  - how the Pool's strength helps in the fight;
  - where the vessel is kept;
  - whether the puppet's decrees are op-run or scripted.

**Parked for a later reveal: the Citadel and the Minister.** The Citadel doesn't exist yet (owner decision 2026-11-13), and nothing in the final act depends on it. The ideas so far:
- **The Citadel:** the old Ministry HQ, floating in the void behind the Bureaucratic Barrier. Players bridge or fly to it (a WorldEdit schematic).
- **The Minister:** a troll war with phases.
  - **The Minister's tricks:** fake deaths ("he's dead!" … "Phase 2"), hotbar swaps, a Cursed Food buffet, a decoy Minister, and a paperwork phase.
  - **The players' weapon:** trolls landed on him do real damage.
  - **Last phase:** cornered, he releases the Chaos Guardian.

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
| **Troll Log** | `economy/trolls.js` (hooks in `black_market.js`) | The engine of the whole story; points kept for Part II's Blood Pool |
| Acts and decrees | `story.js` | Op-advanced acts with titles and lines; numbered decrees |
| Protocol Clean Slate | `clean_slate.js` | The dragon-kill trigger, the 4-day countdown, the burning world, the Last Broadcast |
| Blood Relics, Archives, the Blood Portal | `events/blood_portal.js` | End City Relics and books, Draft Bill 9-D from the dragon, the escape event |
| The Blood Pool, its tiers and the Potato Tithe; the Nether and End gates; the tank | `part2/blood_pool.js`, `part2/dimension_gates.js`, `part2/blood_tank.js` | Part II's progression: blood breaks the Ministry's seals |
| Techno's Potato War (Potato Standing) | `part2/blood_pool.js`, `economy/black_market.js` | Each player's rank: what they may craft and buy |
| The Potato War upgrade tree | `part2/potato_tree.js`, `tools/ftbquests/` (FTB Quests) | Per-player nodes: Tinkers metals, smelteries, autocrafting, logistics, farms; catch-up |
| The Purges (engine, kits and vault, the Potato Heist) | `part2/purge.js` | Act IV's weekly Purges; the hidden Tithe for the Harvest reveal |

## Build order
1. ✅ **Batch 1:** `story.js` (acts and decrees) and `economy/trolls.js` (the Troll Log, payouts, reports). The Blood Pool was taken out again and saved for Part II.
2. ✅ **The finale (built before batch 2):** `clean_slate.js` and `events/blood_portal.js`: the dragon-kill trigger, the Archive books and Draft Bill 9-D, the Blood Relics, the 4-day countdown and the burning world, the Blood Portal event, and the exodus files.
3. 🔨 **Batch 2:** the **Scout NPC** and his testimony; op-run **events** (Prank Purge, Mandatory Fun Day, the Trolling Moratorium, a Ministry Meltdown).
4. **Part II** (same platform: MC 1.20.1, Forge, KubeJS 6). Scripts go in `part2/`. In order:
   1. ✅ **The Blood Pool and tier locks** (`part2/blood_pool.js`), with the tier contents from the progression research, the Potato Tithe, and the Nether and End gates (`part2/dimension_gates.js`). The tank (`part2/blood_tank.js`).
   1a. ✅ **Techno's Potato War** (in `part2/blood_pool.js`): each player's Potato Standing gates crafting-table recipes, and the black market's `STANDING_LOCKS`.
   1b. ✅ **The upgrade tree** (`part2/potato_tree.js`, FTB Quests chapters in `tools/ftbquests/`) and catch-up.
   2. 🔨 **A Part I patch, before the finale is played:** the exodus files also save trial records and what titles need.
   3. 🔨 **Arrival** (`part2/arrival.js`): legacy titles, and trial records as books. No satchel is needed: players keep their whole inventory through edited player files that keep only the inventory and ender chest and place them at the new world's spawn. XP, effects, game mode, respawn points, the recipe book and mods' saved player data reset.
   4. 🔨 **The Part II story driver** (`story.js` with Part II acts).
   4a. 🔨 **Part I scripts adapted for Part II** (see [PART2_SCRIPTS.md](PART2_SCRIPTS.md)): the Pig Escort without its Nether unlock and reveal (it counts Escorts for the Swine's Oath), `limit_balance.js` reduced to permanent bans, and the black market and bounties without Part I-only items. Factions, trials, Clean Slate, the Blood Portal and the End Lockdown don't carry over.
   5. 🔨 **The Ministry as the enemy** (`part2/ministry.js`): Inspectors raid everyone, Ministry bounties, and trolls on Ministry NPCs.
   6. 🔨 **The Shrine and the Regalia** (`part2/shrine.js`): first **the Shrine Awakens** event (Act I, #36: next up), then `/regalia`, the deliveries, Shrine raids, the Seizure and the Outpost raid.
   7. ✅ + 🔨 **Events:** the Purge engine and the Potato Heist (`part2/purge.js`); more Purge modes to come.
   8. 🔨 **The final act** (Act V, a new `part2/` script):
      - the drain at the twelfth seal;
      - the puppet's decrees;
      - the reborn vessel;
      - the Pool as his strength;
      - the race for the Crown;
      - the Crown Restored.

      The Citadel and the Minister wait for a later reveal.
   9. 🔨 **The ruins:** lore books.

## Open decisions
- **Events:** how long the Moratorium lasts, and what a Ministry Meltdown gives.
- **Troll Log:** tune the values and payouts after a week of play; whether Anonymous Summons (cheap, needs no aim) should go to manual reports.
- **Crownsworn players:** whether active Crownsworn players will role-play the defection, or the loyalists are mostly NPCs.
- **Clean Slate:** tune the Blood Portal event (40 kill points to fill, the Relic chance) once it's been tried.
- **Part II world:** a new seed, or the same seed regenerated.
- **The final act (Act V):**
  - how many kills the vessel takes, and what each "revised edition" changes;
  - how the Pool's strength helps in the fight;
  - where the vessel is kept;
  - whether the puppet's decrees are op-run or scripted.
- **The Castellan:** her loyalty stays unconfirmed, unless she wants a story arc later (e.g. a double-agent turn in Act III, the Seizure).
- **Part II tiers:** decided (see BLOOD_POOL.md). Still to check on the server: Thermal's machine-frame recipes in JEI, the AlmostUnified config, and a Dragon Heart drop before Tier 10.
- **The Potato War:**
  - tune the rank thresholds and the black market locks after a week of Part II;
  - **autocrafting** (decided, changed 2026-11-03): an autocrafter can't make what a player hasn't unlocked. A script can't tell whose machine is crafting, so machines only make what everyone can already craft (Tiers up to T−2), and the newest two tiers are crafted by hand. Fancy Crafters and the Wixie are banned because no check reaches them. Placing and using an autocrafter needs its node in the upgrade tree. The remaining gaps: machines fed by their owner's hoppers or belts, and AE2 crafts ordered on someone else's network. Watch whether that matters in play;
  - **netherite** (decided 2026-11-05): crafting it opens at Blood Pool Tier 5, and its crops at Tier 8. Debris can still be mined, and looted netherite keeps working. The Foundry's molten debris byproduct from melting diamond ore is off at every tier, so netherite needs a Nether trip until the crops open; diamond ore still melts;
  - **the upgrade tree's costs** are placeholders: tune them after a week of Part II;
  - the first relic, renamed **"The War Chest"** (owner decisions 2026-11-13; it was "The Potato Tithe", the Blood Pool tithe's name): its 10,000 potatoes count **for the relic only**. Handing them in gives no Potato Standing and fills no Pool, so potatoes don't pay three times.
- **Regalia:**
  - relic amounts;
  - whether relics need a Blood offering;
  - whether relics must be restored in order;
  - whether a carrier killed in a Purge loses their delivery;
  - rewards per relic.
