# Part I's scripts in Part II: keep, adapt or remove

Part II's premise ([STORY.md](STORY.md)) is that everyone stands under Techno's banner. There are no player factions, and the Ministry becomes an NPC enemy. Every script on the live Part I server was sorted against that. Part II also adds two rules every script must follow:
- **Respect the Blood Pool.** Nothing may unlock content or a dimension before its tier.
- **Load order.** The Blood Pool's recipe removal runs in `part2/`, so a script that *adds* a recipe after it (alphabetically later) can undo a lock.

## The triage

| Script | Part I | Part II | What changes for Part II |
|---|---|---|---|
| `economy/black_market.js` | ✅ keep | 🔧 adapt | Coins still feed the Blood Pool (`/bloodpool donate`). Remove **Unsanctioned Eyes** (the End Lockdown is replaced by the Tier 9 gate) and **Certified Alibis** (no trials). Faction-based pricing and targets fall back to "everyone". The merchant smuggles *for* Techno's side. **Already in:** the Potato Standing locks (`STANDING_LOCKS`), which only act when `part2/blood_pool.js` is installed. Re-check them after removing items |
| `economy/trolls.js` | ✅ keep | ✅ keep | Already pays the Blood Pool; the cross-faction bonus never applies without factions |
| `economy/bounties.js` | ✅ keep | 🔧 adapt | Act IV: **the Ministry posts bounties** on the strongest players (Ministry-issued) |
| `factions/factions_config.js`, `factions/factions_core.js` | ✅ keep | ❌ remove | "There are no Loyalists." Part I membership becomes legacy titles (`part2/arrival.js`) |
| `factions/portal_ambush.js` | ✅ keep | 🔧 rework | Becomes `part2/ministry.js`: **Inspectors raid everyone**, plus Shrine raids. The "no getting away" mechanics carry over; Crownsworn and Syndicate targeting goes |
| `factions/trials.js` | ✅ keep | ❌ remove | Part I records become evidence books in `part2/arrival.js`. The Homing Pig's automatic charge goes with it |
| `story.js` | ✅ keep | 🔧 adapt | Part II acts (Awakening → Regalia → Seizure → Project Chaos → Siege). The `finale` act and its Clean Slate link go |
| `clean_slate.js` | ✅ keep | ❌ remove | Part I's finale |
| `events/blood_portal.js` | ✅ keep | ❌ remove | Part I's escape. `part2/arrival.js` reads its exodus files |
| `end_lockdown.js` | ✅ keep | ❌ remove | Replaced by `part2/dimension_gates.js` (the End opens at Tier 9) |
| `events/pig_escort.js` | ✅ keep | 🔧 adapt | **The Swine's Oath relic needs 10 completed Escorts**, so it stays as a repeatable event. Its Nether unlock and the Syndicate-reveal finale **must go**: they flip the same Nether switch `dimension_gates.js` uses, and would open the Nether before Tier 3 |
| `smite.js`, `fake_players.js` | ✅ keep | ✅ keep | Part II's finale uses `/superaura` and `/fakejoin Technoblade` |
| `give_limits.js` | ✅ keep | ✅ keep | |
| `limit_balance.js` | ✅ keep | 🔧 adapt | Its permanent bans (Ender Quarry, the nukes) **conflict** with the Blood Pool, which opens them at Tier 11. Keep only bans meant to last forever (e.g. the enchanted golden apple) |
| `refined_obsidian_repellent.js` | ✅ keep | ✅ keep | Works alongside the tiers |
| `restore_ae2_inscriber.js` | ✅ keep | ❌ remove | **A bypass in Part II:** it adds an Inscriber recipe after the Blood Pool's removal has run, so AE2's Inscriber would be craftable at Tier 0 instead of Tier 6 |
| `disable_projecte.js`, `limit_appliede.js` | ❌ remove | ❌ remove | ProjectE and AppliedE are out of the pack |
| `example.js` and the `*.js.disable` copies | ❌ remove | ❌ remove | KubeJS's sample and old copies |

**In the repo but not on the live server:**
- **Part II's finale needs** `techno_tribute.js`.
- **Useful in both parts:** `ministry_broadcasts.js` (the narrator) and `protected_areas.js`.
- **Optional extras:** `tab_nicknames.js`, `enchanted_porkchop.js` and `fairy_wings.js`.

## What the Part II server starts with
- **As they are:**
  - `economy/trolls.js`, `smite.js`, `fake_players.js`, `give_limits.js` and `refined_obsidian_repellent.js`;
  - `part2/blood_pool.js` (with the Potato War), `part2/dimension_gates.js`, `part2/blood_tank.js` and `part2/potato_tree.js` (with FTB Quests and the quest files in `tools/ftbquests/`, see `tools/kubejs/POTATO_TREE.md`);
  - in the **modpack**: `kubejs/client_scripts/potato_tooltips.js` (the Shift tooltips);
  - `startup_scripts/nether_portal_whitelist.js` (with an empty list).
- **Once adapted:**
  - `economy/black_market.js`, `economy/bounties.js`, `events/pig_escort.js`, `limit_balance.js` and `story.js`;
  - `part2/ministry.js` (from `portal_ambush.js`).
- **Later:** `techno_tribute.js` (the finale), and `ministry_broadcasts.js` with Part II lines.

## Order to adapt them
1. **`events/pig_escort.js`:** take out the Nether switch and the reveal finale, and count completed Escorts for the Swine's Oath. This one matters most: as it is, it would open the Nether early.
2. **`limit_balance.js`:** leave only the permanent bans. `restore_ae2_inscriber.js` is simply not installed.
3. **`economy/black_market.js` and `economy/bounties.js`:** remove the shop items that no longer exist, and add the Ministry-issued bounties.
4. **`story.js`'s Part II acts and `part2/ministry.js`:** already on STORY.md's build order.
