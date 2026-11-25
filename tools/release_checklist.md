# Part II: the Enchanted Potatoes, the Shrine night, the Aether and Deeper and Darker

This folder holds what the Part II server and the modpack need for the Enchanted Potatoes (the Potato Press and Oven, the Potato War's ranks and quests), the Shrine night (Act I #36 and the Regalia at the altar), and the Blood Pool's tiers for the two new mods, the Aether and Deeper and Darker. It's built from the repo by `tools/make_release.sh`. `FILES.txt` lists every file.

The rest of Part II's scripts (`dimension_gates.js`, `blood_tank.js`, `boss_blood.js` and the others) aren't in it. They haven't changed.

**Never copy a file from the test server to the live one.** The test server's `blood_pool.js` needs only 2 votes to break a seal (`VOTES_TO_BREAK = 2`). The live one needs 5, as the file here has.

## 1. The modpack update (every player)
Copy the contents of `modpack/` into the modpack, so every player gets:
- `kubejs/startup_scripts/potato_press.js`: registers the Enchanted Potatoes, the Enchanted Baked Potatoes, the Potato Press and the Potato Oven. **A player without it can't join**, because the server and the player must register the same items and blocks.
- `kubejs/client_scripts/potato_tooltips.js`: the Shift tooltips that show which rank and tier an item needs (now with the two new mods' gear).

Add the two new mods to the modpack's `mods/` too, the same versions as the server's. They aren't in this folder:
- `aether-1.20.1-1.5.2-neoforge.jar` (it carries its own Cumulus, Nitrogen and Curios inside; the pack's newer Curios 5.14.1 wins);
- `deeperdarker-forge-1.20.1-1.3.3.jar`.

**A player without them can't join** once the server has them.

## 2. The server (stop it first)
1. **Stop the server.** While it runs, FTB Quests can write its old book back over new chapter files.
2. **Put the two new mods in the server's `mods/`**, if they aren't there yet: `aether-1.20.1-1.5.2-neoforge.jar` and `deeperdarker-forge-1.20.1-1.3.3.jar`. Back up the world first. Both dimensions open from day one (their gear is what's tiered), so nothing else needs setting.
3. **Copy the contents of `server/` into the server's folder.** It goes into `kubejs/` and `config/`, and replaces the files of the same name:

   | In `server/` | What it is |
   |---|---|
   | `kubejs/server_scripts/part2/blood_pool.js` | The Blood Pool, the tiers, the Potato War. It now holds the seals from Tier 5 until the Regalia are restored, tiers the Aether's and Deeper and Darker's gear (gravitite and resonarium tools 4, zanite sword 5, resonarium armour 6, warden gear 7, sonorous staff 9), and won't let that gear be worn or wielded before its tier, however it was got |
   | `kubejs/server_scripts/part2/potato_tree.js` | The Potato War's upgrade tree. `/potatowar pay <node>` now takes crates and Enchanted Potatoes toward a node, a part at a time (it needs the new `blood_pool.js` too). Create Automation now costs 8 brass hands and 8 electron tubes (it was precision mechanisms, which need the Deployer it unlocks); the new Logistics chapter has it |
   | `kubejs/server_scripts/part2/shrine.js` | The Shrine night, its opening, and the Regalia delivered at the altar |
   | `kubejs/server_scripts/fake_players.js` | `/fakejoin` and `/fakesay`. Its Discord posts no longer name the Ministry |
   | `kubejs/startup_scripts/potato_press.js` | The same file as the modpack's (both sides need it) |
   | `kubejs/data/trollcraft/structures/shrine/l_0.nbt` … `l_63.nbt` | The Shrine's 64 layers |
   | `kubejs/data/alexsmobs/loot_tables/gameplay/transmutation_table_*.json` | The Transmutation Table's three lists, without Nether and End items or diamonds |
   | `config/alexsmobs.toml` | `limitTransmutingToLootTables = true`: the Transmutation Table offers only those lists |
   | `config/ftbquests/quests/chapters/potato_war_*.snbt` | The seven Potato War chapters. Keep exactly one file per chapter (no `(1)` copies) |
   | `config/ftbquests/quests/chapter_groups.snbt` | The "Techno's Potato War" group. **If the server already has quests of its own,** don't replace this file: copy its one group entry into yours |

4. **Make these changes by hand:**
   - `config/modernfix-mixins.properties`: included in `server/config/`, your server's own file with `mixin.perf.faster_capabilities=false` added under "User overrides go here". **The server won't start without that line** with the older `potato_press.js` (it logged an error, which stops KubeJS). Without it the Potato Press and Oven can't take hoppers or pipes. (With ModernFix's faster capabilities on, the test server crashed.)
   - `config/simple-discord-link/simple-discord-link.toml`: set the join and leave messages to these, so they don't name the Ministry before the Tier 5 reveal (and so they match the fake players' posts):
     - `playerJoined`: `🩸 **%player%** stepped out of the blood. Somewhere, someone has made a note of it, and does not approve.`
     - `playerLeft`: `🌫️ **%player%** slipped back into the static. Whoever was watching has lost track of them, again.`

## 3. Start the server and check
- The log says `[PotatoPress] Hoppers and pipes can reach the Potato Press and Oven`.
- KubeJS loads every server script with 0 errors (`logs/kubejs/server.log`: "Loaded … KubeJS server scripts … with 0 errors").
- `/shrine status` says "The rise: not started", with no warning about missing layers.
- `/bloodpool` shows the open tier, and `/potatowar` your rank.
- `/potatowar pay` lists the nodes you can pay toward. In the book, a node's page has a gold line "▶ Hand in the potatoes you carry"; click it with potatoes or crates on you and the task's number goes up.
- The log has no `[BloodPool] WEAR_LOCKS`, `WIELD_LOCKS` or "Curios not found" warnings.
- In survival, `/give @s deeperdarker:resonarium_chestplate` and run `/bloodpool check` with it in hand: Tier 6 (A Stream), "and so is wearing one". Put it on: below Tier 6 it comes off within a second. (Creative players are exempt.)
- The quest book has the "Techno's Potato War" chapters. If it still shows old ones, run `/ftbquests reload` from the **server console**.
- **Optional, while nobody is on:** pregenerate the Aether and the Otherside around spawn, the bases and the nearest ancient cities, so exploring them doesn't cause lag spikes. `PREGENERATION.md` in this folder has the plan, the Chunky commands and the time and disk each radius takes.

## 4. Before the night: set the sites (once, as op, in the Overworld)
Stand on each spot and run:
- `/shrine site set`: the Shrine's centre, at ground level. It needs flat, open ground about 42 × 43 blocks, with nothing built on it (the statue is 64 tall).
- `/shrine brazier set 1`, `2`, `3`: the three braziers. Within 64 blocks of the Shrine's centre, the rite's waves can come from them.
- `/shrine start set`: where everyone is brought when the night begins (near the castle, say).
- `/shrine view set`: fly up to a spot with the whole site in view. A 6 × 6 floor of barriers is laid under you, and everyone watches the Awakening and the rise from there.

Then run `/shrine status` to check them all.

## 5. The night
**The day before:**
1. Optionally, hypixel's hint (Discord shows his join and leave):
   ```
   /fakejoin hypixel
   /fakesay hypixel No portal this time. You're welcome.
   /fakesay hypixel You've been pouring a lot of blood into that pool. Did any of you wonder who drinks it?
   /fakesay hypixel He's waking up. Not all the way. Enough to be annoyed.
   /fakesay hypixel Soon you'll get a message you can't read. Then a letter you can. Do what it says.
   /fakesay hypixel Three fires, lit together. Not one at a time. Together. Bring friends.
   /fakesay hypixel The Inspectors will be there. They've been keeping his potatoes. Take them back and feed them to the light.
   /fakesay hypixel Do it right and the seals on that pool start to crack. Some doors open. One of them is warm.
   /fakesay hypixel He'd like his name back. He's been patient about it. It doesn't suit him.
   /fakesay hypixel Blood for the Blood God.
   /fakeleave hypixel
   ```
2. `/shrine signal`: the scrambled message, to everyone online and to anyone joining in the next 24 hours.

**On the night:**
1. `/shrine summons` at the castle: the Blood God's book, with the way to each brazier.
2. `/shrine braziers`: the night begins. Everyone is brought to the start and armed, their belongings held, and knockouts replace deaths. The 30-second opening plays.

From there it runs itself:
- **The braziers:** each is lit by kneeling at it (holding sneak beside it for a second and a half without being hurt; flint and steel won't do it). Everyone gets their coordinates in chat at the start, and each unlit one sends up a pillar of fire every 30 seconds. All three lit within 45 seconds of the first raise the beam.
- **Knockouts, not deaths,** all night; every 3rd knockout, a player's kit is made new.
- **The Ignition Rite** begins once everyone is at the beam. About 8 waves, more Senior Inspectors each time, each dropping 2 King's potatoes. The offering needs 8 per player.
- **The Awakening** begins on the platform once the offering is full.
- **The Shrine rises** (about 45 seconds, ringed by pillars of fire, with a climax at the last stone).
- **The night ends:** everyone is set down in front of the lectern with their belongings back, and the Pool rises to Tiers 3–4 (the Nether opens).

**If you need to step in:**
- `/shrine stop` pauses whatever is running.
- `/shrine rite` and `/shrine awaken` start those stages by hand.
- `/shrine fires light` lights all three braziers.
- `/shrine ambush <player>` sends an extra ambush.
- `/shrine repair` puts the Shrine back as it was built.
- **Never run `/shrine reset confirm` on the live server.** It takes the Shrine down and forgets the night.

**After the night:** the Regalia hunt is open (`/regalia`). From Tier 5, each seal needs one more relic restored at the altar.

## Still to see in game
Mock-tested, not yet seen on a server. Full lists are in `tools/kubejs/SHRINE.md`, `tools/kubejs/POTATO_PRESS.md` and `tools/kubejs/BLOOD_POOL.md` ("What couldn't be verified").

**The Shrine night:**
- the opening;
- the waves at the red glass;
- several Senior Inspectors to a wave;
- the harder brazier waves with 7 or 8 players.

**The Regalia:**
- a relic delivered at the altar breaking a seal, and its raid;
- EvilCraft blood drained from a tank.

**The Enchanted Potatoes:**
- the gold line on a node's page clicked by a player, and `/potatowar pay` typed (paying itself was seen on the test server with a stand-in player);
- pipes, Create funnels and AE2 into the Press;
- potato crates from each mod.

**The Aether and Deeper and Darker** (stress-tested on the test server: both dimensions generate at 20 TPS, and the scripts load clean with the new tiers):
- (seen on the test server: sealed armour and the Aether's gloves coming off, sealed swords dealing no damage, the gear working at its tier)
- a sealed pickaxe breaking nothing, and the sonorous staff not firing, by hand;
- whether Loot Integrations puts Aether or Otherside items in Overworld chests.
