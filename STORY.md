# Technoblade Never Dies: the story of Trollcraft III

The server's story in two parts.
- **Part I:** the Ministry of Trolling rules, and players are divided into Loyalists (Techno's Crownsworn) and the Blood God's Syndicate. It ends with everyone realising the Ministry is corrupt and uses Technoblade's name for power, and the world being destroyed.
- **Part II:** a new world and a rebuilt modpack. Everyone stands together under Techno's banner and lays siege to the Ministry.

The story **is** the progression:
- Ministry **decrees** lock progression tiers, and the rebellion lifts them.
- Boss kills and relics move the story on.

Legend: ✅ = built and running, 🔨 = still to build, *TBD* = open decision (see [Open decisions](#open-decisions)).

Tone: Technoblade passed away in 2022, and "Technoblade never dies" is how his community remembers him. The Ministry is played for comedy; Techno himself is treated with respect. Nothing makes light of his passing.

---

## PART I: The Ministry's Reign

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

### Act II: Inspections
10. **The Decrees Begin:** the Ministry issues numbered decrees. Each locks a shortcut or a progression tier (for example "Decree 12: Unlicensed Nuclear Fission is forbidden"). 🔨 (chapter and decree system)
11. **The Tyranny Meter:** the Ministry's grip, visible with `/ministry status` and event bossbars. It rises with Ministry actions and falls with resistance (inspectors killed, Purges survived, relics returned). 🔨
12. **The Scout Awakens:** the sleeping scout wakes as an NPC. Each conversation gives a piece of testimony, hinting that **the Ministry staged the Escort**. 🔨
13. **Treason Hunts:** Inspectors and Blood God raids keep up the pressure, still only on the Syndicate. ✅ (ambushes, raids, Ambush Contracts)

### Act III: The Loyalty Audit
14. **The Audit:** the Ministry turns on its own Loyalists: inspections of Crownsworn players, Hush Coin tithes, curfews. 🔨 (decrees, plus ambush settings)
15. **Show Trials:** Enforcers are pushed to prosecute. Certified Alibis become acts of quiet rebellion. ✅ (`factions/trials.js`, the black market's Certified Alibi)
16. **The First Defections:** Crownsworn players start to desert. ✅ (faction desertion)
17. **Purge Night I:** one announced hour:
    - every raid rolls the lethal tier;
    - contracts cost half;
    - bounties pay double;
    - safe zones shrink to spawn.

    "All crime is legal. Paperwork is still required." 🔨 (event scheduler)

### Act IV: The End Accord
18. **The End Accord:** the Ministry seals the End: "There is nothing in the End. The End is closed for paperwork." 🔨 (End lock, like the Nether lock)
19. **Breaking the Seal:** Loyalists and Syndicate fight the Ender Dragon together, the first act of open rebellion. 🔨 (dragon-kill trigger)
20. **The Ministry Archives:** End City chests hold Ministry documents: cover-ups, the order that sacrificed Oinkington, and proof the Ministry uses Techno's name for power. 🔨 (books added to End City loot; *TBD*: what exactly they reveal)
21. **The Realisation:** the Loyalists align with the Syndicate, and the Resistance forms (no friendly fire between them). The Tyranny Meter maxes out. 🔨

### Part I Finale: Protocol Clean Slate
22. **The Last Decree:** the cornered Ministry triggers Protocol Clean Slate, with a server-wide countdown bossbar. 🔨 (*TBD*: 72 h, a week, or a live night)
23. **The World Burns:**
    - thunder;
    - back-to-back Purges;
    - raids on everyone;
    - the broadcasts falling apart into static and denial.

    🔨
24. **The Exodus Satchel:** each player chooses a few items to save, filtered against mods Part II drops. They're saved to a file outside the world. 🔨 (*TBD*: slots)
25. **Beyond the Void:** the Syndicate reveals the only escape, the End's exit portal. Players jump and the **End Poem** plays: the end of Part I. ✅ (vanilla)
26. **The Last Broadcast:** the Ministry declares victory over an empty world, and the server goes dark.

---

## Intermission: The Rebuild (admin work)
27. **Archive Part I:** keep the old world as a download or a read-only tour.
28. **Schematics (WorldEdit):** the old spawn and Ministry HQ (for the Citadel), and famous bases (for ruins): the stronghold group's fortress, Tryhard's alchemy lab, the bastion raid site.
29. **The Part II modpack:** new mods and integrations, decree gates, and fixes for this season's leaks:
    - Mystical Agriculture cobalt and Netherite essence;
    - the Foundry's diamond-ore → molten debris → Netherite;
    - ProjectE's state (EMC on Nether Stars, the Dragon Egg and Netherite Scrap);
    - Tinkers' Levelling Addon modifier slots.

    See [PROGRESSION_GATES.md](PROGRESSION_GATES.md).
30. **The new world:** the Citadel pasted on an outer End island, and ruins across the Overworld (chests emptied, lore books placed). *TBD*: a new seed, or the same seed regenerated.

---

## PART II: Technoblade Never Dies
Everyone stands together under Techno's banner. The Ministry becomes a non-player enemy: its Inspectors and the Minister. *TBD*: whether some players can stay loyal as traitors.

### Act I: The Awakening
31. **Waking Up:** players arrive in the new world, as the End Poem promised. They get back their satchel items and legacy:
    - titles such as "Survivor of the Clean Slate" and "Founder of the Syndicate";
    - their Part I trial records, now evidence of the Ministry's crimes.

    🔨
32. **The Ruins:** the remains of Part I bases are lore sites, with books telling Part I's story. 🔨
33. **The Shrine:** the scout's last testimony reveals Technoblade's Shrine, and the relic hunt begins. 🔨

### Act II: The Regalia of the Blade
34. **The Relic Hunt:** eight relics, restored at the Shrine by the whole server. Each needs contributions from both former factions. Progress is tallied server-wide and credited to each contributor (`/regalia`). The amounts are placeholders, to be tuned by player count. 🔨

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

35. **Liberation:** each relic restored lifts a Ministry decree. Progression is the rebellion. 🔨
36. **Shrine Raids:** each relic raises the Tyranny Meter and brings Inspectors down on the Shrine. ✅ (raids) + 🔨 (Shrine targeting)

### Act III: The Seizure
37. **The Confiscation:** the Ministry "seizes" a relic in a scripted event. Only the Shrine's progress is at stake, never players' items. 🔨
38. **The Outpost Raid:** players storm a Ministry outpost to take it back. 🔨

### Act IV: Project Chaos
39. **Purge Nights:** recurring, timed around relic deliveries. 🔨
40. **Ministry Bounties:** the Ministry posts bounties on the strongest players. ✅ (`economy/bounties.js`) + 🔨 (Ministry-issued)
41. **Project Chaos Revealed:** the Ministry has kept the Chaos Guardian contained on a Chaos Island. Its shards complete the Crown. ✅ (Draconic Evolution)

### Act V: The Siege
42. **The Citadel:** the old Ministry HQ, floating in the void. Players bridge or fly to it. 🔨 (WorldEdit schematic)
43. **The Minister:** a boss fight with phases. Cornered, the Minister releases the Chaos Guardian. 🔨
44. **The Crown Restored:** the full Regalia set in place, with the Techno Tribute and a server-wide `/superaura`. ✅ (`techno_tribute.js`, `smite.js`)
45. **The Final Broadcast:** *"Technoblade never dies. This is not The End."*

---

## Systems already built (and how the story uses them)
| System | File | Story use |
|---|---|---|
| Factions, ranks, desertion | `factions/factions_core.js`, `factions_config.js` | Loyalists vs Syndicate; the defections; the Resistance |
| Portal ambushes, raids, "no getting away" | `factions/portal_ambush.js` | Inspector patrols, Blood God war parties, Purges |
| Pig Escort and the Nether lock | `events/pig_escort.js` | Oinkington; the template for scripted events and dimension locks |
| Black market (Hush Coins, contracts, traps, tracking, alibis) | `economy/black_market.js` | The underground economy; rebellion tools |
| Bounties | `economy/bounties.js` | Ministry bounties in Part II |
| Trials | `factions/trials.js` | Show trials; records carried into Part II as evidence |
| Ministry broadcasts | `ministry_broadcasts.js` | The narrator; per-act line pools to add |
| Techno Tribute, /superaura | `techno_tribute.js`, `smite.js` | Manifestations of Techno's legacy; the finale |

## Build order
1. The **chapter and decree system** and the **Tyranny Meter** (everything else hangs off these).
2. Act II: the **Scout NPC** and his testimony.
3. The **event scheduler** (Purge Nights).
4. Act IV: the **End lock**, the **Archive documents**, the **dragon-kill trigger**.
5. **Protocol Clean Slate:** the countdown, the decay, and exporting satchel and legacy data.
6. Part II:
   - satchel and legacy import;
   - the Shrine and relic tracker;
   - the Seizure;
   - the Minister boss.

## Open decisions
- How long each act lasts, and whether events are automated on a schedule or triggered live by ops.
- Decree gating: hard locks, or soft pressure (allowed, but Audits and Purges punish rushing).
- Whether active Crownsworn players will role-play the defection, or the loyalists are mostly NPCs.
- Exodus Satchel size, and the Clean Slate countdown length.
- Part II world: a new seed, or the same seed regenerated.
- Part II: whether players can choose to stay loyal (a traitor role).
- What the Archive documents reveal (for example who really killed Oinkington).
- Relic amounts (by player count); whether relics must be restored in order; whether a carrier killed in a Purge loses their delivery; rewards per relic.
- Whether the End is already open on the server (decides whether the End Accord is new or a retcon).
