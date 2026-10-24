# Pig Escort Detail

A Ministry of Trolling server event for KubeJS 6 (Minecraft 1.20.1 Forge). It runs on the server only, and players need nothing installed.

All players are **Escorts**. They walk **Ambassador Oinkington** to a temporary Ministry-Approved Portal while waves of Piglins, Piglin Brutes and Hoglins try to kill him.
- **Escorts win** when the pig steps into the portal.
- **The Piglins win** if the pig dies or the time runs out.

Either way, the event ends with **the reveal of the Blood God's Syndicate** (see [The finale](#the-finale-the-syndicate-reveal)). `FINALE_ENABLED = false` brings back the old Ministry endings.

Nothing ever travels through the event portal.

## Files

| File | Goes in | Why |
|---|---|---|
| `server_scripts/events/pig_escort.js` | `kubejs/server_scripts/events/` | All the event logic and commands. You can reload it with `/reload`, but a reload during an event voids that event. |
| `startup_scripts/nether_portal_whitelist.js` | `kubejs/startup_scripts/` | Optional. Only lets Nether portals light in the allowed spots. The finale switches it off at the end. **Restart after updating it.** |
| `server_scripts/fake_players.js` | `kubejs/server_scripts/` | Needed for the Syndicate leader's arrival (`/fakejoin`). Without it, the finale goes on without the join message. |
| `startup_scripts/pig_escort_hooks.js` | `kubejs/startup_scripts/` | KubeJS 6 only lets startup scripts listen to raw Forge events. This file forwards six of them to the server script: dimension travel, teleports, mounting, effects, the second kind of right-click, and damage scaling. **It needs a server restart** after you add or change it. |

## Commands (op level 2)

| Command | What it does |
|---|---|
| `/pigescort setup` | Stage an event. Nothing spawns yet. |
| `/pigescort setstart` | Pig start point = where you stand. The default is world spawn. |
| `/pigescort setportal` | Portal = where you stand. The block under your feet becomes its platform, and you walk through it in the direction you're facing. |
| `/pigescort setportal random` | A random spot 300–600 blocks from the start. This is the default. |
| `/pigescort settime <minutes>` | Event length. The default is 20. |
| `/pigescort difficulty easy\|medium\|hard` | The default is medium. |
| `/pigescort addcheckpoint` / `clearcheckpoints` | Your own respawn checkpoints, used instead of the automatic ones at ⅓ and ⅔ of the route. |
| `/pigescort preview` | Particles at the start, checkpoints and portal for 30 s, visible only to you. Nothing is built. |
| `/pigescort start` | Launch it. Everything after this is automatic. |
| `/pigescort stop` | End now with no winner and clean up. |
| `/pigescort cancel` | Discard a staged setup. |
| `/pigescort status` | State, settings, time left, pig health and the Escorts' stats. It also shows how the last raider wave went. |
| `/pigescort wave` | Send a raider wave now, for testing. It reports how many spawned and why any failed. |
| `/pigescort purge` | Remove stray event pigs and mobs from loaded chunks. Only works when no event is running. |
| `/pigescort diagnostics` | Shows whether the hooks are installed and which version of each uncertain API is in use. |
| `/pigescort finale test success\|fail` | Play Ending A or B right now, without a pig run. Everyone online sees and hears it. No rewards, and the Nether is not unlocked. See [Testing the finale](#testing-the-finale). |
| `/pigescort finale restoreframe` | Rebuild the test frame (`PORTAL_FRAME_FROM` / `PORTAL_FRAME_TO`) in obsidian and relight it. |
| `/pigescort reveal continue` | After the leader has joined, run the rest of the finale now instead of waiting `LEADER_FINALE_DELAY_SECONDS`. |
| `/pigescort nether lock\|unlock\|status` | Switch `nether_portal_whitelist.js` on or off by hand. The finale unlocks it; use `lock` to undo that. The switch is saved with the world. |

## Behaviour summary

- **Teams:**
  - Every player joins the green "Escorts" team, with friendly fire off and an infinite Glowing outline.
  - The mobs join the red "Piglin Delegation" team, so they never target each other.
  - Players who were on another vanilla team are put back on it afterwards.
- **Fatal hits:**
  - The death is cancelled. The player is healed, with fire and all effects cleared, and teleported to the latest secured checkpoint (or the start).
  - They then get 6 seconds of Slowness and Blindness, the "Ministry processing" penalty, and are immune to damage during it.
  - No items are dropped and no corpse is made. The Corpse mod never sees a cancelled death.
- **The pig:**
  - Only event mobs can damage it, scaled by difficulty: ×0.25 / ×0.5 / ×0.75.
  - It regenerates 1 HP every 3 s and is immune to all effects.
  - The only right-clicks allowed are a lead, or an empty hand to unhook it from yourself. Feeding is blocked, because it would heal the pig.
  - It can't be ridden or put in vehicles.
- **Tampering:** checked every second.
  - Triggers: the pig is missing, it left the Overworld, it moved more than 15 blocks horizontally (or 60 vertically) in one second, it's riding or being ridden, it's attached to something that isn't a player or fence, or its name, tag or max health changed.
  - When that happens, all copies are removed, a fresh pig is spawned at the last valid spot with its last valid health, and the likely culprit glows with Slowness for 30 s.
  - More than 10 tampering incidents void the event.
- **Portal:**
  - Every block replaced is saved first, in world data plus `kubejs/pig_escort_snapshot.json`, and restored exactly afterwards.
  - Sites that contain block entities, fluids or bedrock, or that sit next to another Nether portal, are refused.
  - The frame can't be broken, survives explosions, and is rebuilt if a machine removes part of it. No blocks can be placed in its footprint, so it can't be walled off.
- **Performance:**
  - No tick handlers at all.
  - While running, one check per second.
  - The pig's chunk and the portal's chunks are force-loaded. Chunks that were already force-loaded by someone else are left alone.

## The finale (the Syndicate reveal)

The escort plays exactly as before. Only the ending changes. All the texts, titles, sounds and timings are in the **CONFIG: THE FINALE** block at the top of `pig_escort.js`. The timelines are lists of steps (`{ at: seconds, ministry/hijack: 'text' }` or `{ at, action }`), so lines can be reworded, moved or added without touching the code.

**How it starts:**
- **Ending A** starts when the pig reaches the portal.
- **Ending B** starts when the pig dies, and also when time runs out.

**At the start:**
- The pig and the raiders leave at once, so nobody is fighting during the cutscene, and the bossbar goes.
- The usual rewards are given quietly: a diamond each on a delivery, plus the top-killer bonus in both endings.
- Teams, Glowing and keepInventory stay until the end, then the normal cleanup runs.

| Ending A (delivered) | Ending B (lost, or out of time) |
|---|---|
| T+0 gold fireworks above the portal. [MINISTRY] "The Swine has been delivered…" | T+0 the escort party is brought to the portal (see below). [MINISTRY] "The Swine has been lost…" |
| T+5 [MINISTRY] Form 88-D | T+4 [MINISTRY] "Nether access is denied indefinitely…" |
| T+9 the portal hum gets louder; 3 s of Darkness for everyone within 48 blocks | T+8 red dust rises from where the pig died (at most 20 blocks out) and drifts into the portal (particles only) |
| T+11 [SIGNAL HIJACKED] "Thank you for the escort." (scrambled characters around it) | T+11 [SIGNAL HIJACKED] "Spilled blood still pays the toll." (scrambled) |
| T+14 **the explosion** | T+14 **the explosion** |
| T+17 [SIGNAL HIJACKED] "The Ministry wanted one door…" | T+17 [SIGNAL HIJACKED] "They would have kept him behind a wall of laws…" |
| T+21 **the reveal** | T+21 **the reveal** |

**Ending B brings the party to the portal** (the `gather` step, `FINALE_GATHER`), so they see the finale even if the pig died far away:
- **Who:** escorts who are online, in the Overworld, and more than 16 blocks from the portal. Players who weren't in the event aren't moved, and nor are escorts already close by.
- **Where:** 10 blocks in front of the portal, on the side the pig died on, side by side 2 blocks apart, facing the portal. Each one is told "All Escorts are to report to the portal for the inquiry."
- **Tests:** in a `/pigescort finale test fail`, only the op who ran it is brought, and only if they're more than 16 blocks away.
- **Turning it off:** remove the `{ at: 0, action: 'gather' }` line from `ENDING_FAIL`. Ending A has no gather step, since the party is already at the portal.

**The explosion is visual only:**
- **Effects:** `explosion_emitter` particles at the frame's four corners and centre, plus smoke and lava particles. The explode and Wither-spawn sounds play for everyone within 96 blocks.
- **Lightning:** 7 bolts over 1.5 s (`FINALE_LIGHTNING.explosion`). The first strikes the middle of the portal the moment it goes out, and the rest land up to 6 blocks around it.
  - Every bolt in the finale is **visual only**: the flash and the thunder, but no damage and no fire. Pigs and villagers nearby don't change either. It's the same kind of bolt as `/aura`.
  - If the game won't make one, sparks and a thunder sound are used instead, with a warning in the log. A real bolt is never summoned.
- **Blocks:** the portal blocks become air and the frame becomes crying obsidian. Nothing else changes. No real explosion, no block damage, no player damage.
- **Push:** players within 6 blocks get a gentle shove away from the portal.
- **Afterwards:** the normal cleanup at the very end puts the original land back, as it always has.
- **Before the explosion,** the still-lit portal stays closed: anyone walking in is put back in front of it.

**The reveal:**
- **R+0:** everyone online gets the title "THE BLOOD GOD'S SYNDICATE" with the subtitle "Blood for the Blood God." and the Elder Guardian curse sound.
- **R+4:** [SIGNAL HIJACKED] "Honor the player, not the statue…"
- **R+8:** the leader, `/fakejoin hypixel` (`LEADER_NAME`). That shows the join message, puts hypixel on the tab list with their skin, and posts the join to Discord.
- **2 s after the join message:** thunder for everyone, 3 visual-only bolts around the ruins, a red particle column at the portal, and the title "hypixel / has entered the server.". Ops get a note saying how many lines follow and how long until the rest runs.
- **hypixel speaks:** the 8 lines in `LEADER_LINES`, from "Sorry about the portal." to "Blood for the Blood God.", over about 73 s.
  - **Typing time:** each line takes as long as hypixel would need to type it (`LEADER_TYPING`): a 2 s pause plus 1 s per 8 characters, between 3 and 14 s. So the short lines come quickly and the long ones take longer. The gaps are 4.9, 12.15, 11.4, 13.5, 4.75, 9.75, 11.4 and 5 s.
  - **While hypixel speaks** (`FINALE_SPEECH`):
    - it starts to rain (put back the way it was when the finale ends);
    - every 2 s the ruins pulse with a swirl of red dust, crimson spores and a heartbeat for everyone within 32 blocks;
    - a bolt of lightning hits near the ruins with each line;
    - on the last line, "Blood for the Blood God.", a ring of 10 bolts strikes around the ruins, with 3 s of Darkness and the Elder Guardian curse sound.
  - They're sent with `/fakesay` (fake_players.js), so in-game they look exactly like real chat: `<hypixel> …`, with the same name hover as a real player.
  - Simple Discord Link posts them to the Discord chat channel as hypixel (hypixel's name and avatar), like a real player's message.
- **8 s after the last line** (`LEADER_LINES_END_PAUSE_SECONDS`, or straight away with `/pigescort reveal continue`, which also cuts the speech short): [MINISTRY] "The preceding broadcast was not authorized…". With `LEADER_LINES = []` there's no speech, and this comes 20 s after the join message (`LEADER_FINALE_DELAY_SECONDS`).
- **+5 s:** the Nether is unlocked (`UNLOCK_NETHER`) with [MINISTRY] "Due to an unscheduled structural event…".
- **+8 s:** the event ends and cleans up.

**Leader notes:**
- **Editing the speech:** add, remove or reword lines in `LEADER_LINES` at the top of `pig_escort.js`.
  - The timing follows each line's length (`LEADER_TYPING`). To fix one line's timing, give it `after: N` (seconds since the line before).
  - `effect: 'ring'` gives a line the ring of lightning, and `effect: 'none'` gives it no lightning. The default is one bolt.
- **The weather:** `FINALE_SPEECH.weather` is `'rain'`, `'thunder'` or `'none'`. It's left alone if it's already raining or storming. `'thunder'` also brings Minecraft's own real lightning anywhere in the world, which can start fires, so `'rain'` is the default.
- **If the join failed** (fake_players.js missing), the lines are skipped, because nobody is there to say them.
- **Speaking live:** an op can also type as hypixel at any time with `/fakesay hypixel <message>`.
- hypixel stays on the tab list until you run `/fakeleave hypixel`. If hypixel is still "online" at the next finale, there's no second join message and ops are told so.

**Discord:** like every Pig Escort announcement, the [MINISTRY] and [SIGNAL HIJACKED] lines use `tellraw @a`, which Simple Discord Link relays to Discord as server chat. So the reveal shows up in Discord too. hypixel's lines are the exception: they post as hypixel speaking.

**Stopping:** `/pigescort stop` during the finale ends it at once and cleans up, and puts the weather back. A `/reload` or restart during it does the same and no later step runs, but the rain is left to clear by itself.

## Testing the finale

Test on a **copy of the world**. A test is announced to everyone online, and the hypixel join is posted to Discord if Simple Discord Link is set up on that server.

0. **Lightning first:** run `/aura <yourself>`. You should see flashes and hear thunder, with no fire and no damage. The finale's lightning is made the same way.
1. **Test at the event's own portal (no config needed).**
   - Run `/pigescort setup`, then stand somewhere flat and run `/pigescort setportal`.
   - Run `/pigescort finale test success`. The portal is built, and the whole of Ending A plays. Check each step against the table above.
   - At T+14 the frame turns to crying obsidian, the portal goes out, and lightning strikes it and around it. Stand within 6 blocks to feel the push and check you take no damage, nothing catches fire, and there are no "Visual-only lightning failed" warnings in the server log.
   - After the reveal, the land at the site is put back exactly, and the setup is still staged (`/pigescort status`).
   - `/pigescort nether status` still says Locked, because tests never unlock. Ops are told "Test run: the Nether was NOT unlocked".
2. **Ending B:**
   - Stand more than 16 blocks from the portal and run `/pigescort finale test fail`.
   - You're brought 10 blocks in front of the portal, facing it.
   - At T+8, red dust drifts past you into the portal from 15 blocks out.
3. **hypixel's chat on its own (no finale):**
   - Run `/fakejoin hypixel`, then `/fakesay hypixel test`.
   - In-game it reads `<hypixel> test`, exactly like real chat, and the server console shows it too.
   - In Discord it appears in the chat channel as hypixel speaking, not as the server. The command's reply says "Discord: sent." or why not.
   - Run `/fakeleave hypixel` afterwards.
4. **The leader and the speech:**
   - Before the test, run `/fakeleave hypixel`.
   - About 29 s in, "hypixel joined the game" appears, with hypixel on the tab list and their skin.
   - 2 s later come the thunder, lightning, the red column and the "hypixel" title, and ops get the "They say 8 lines. The rest of the finale runs in 80.85 s" note.
   - It starts raining. The ruins pulse (red dust, spores, a heartbeat) every 2 s.
   - The eight lines arrive about 5, 17, 28, 42, 47, 56, 68 and 73 s after the join, in-game and in Discord's chat channel. Each one comes with a bolt, and the last with a ring of lightning and Darkness.
   - The Ministry response follows 8 s after the last line. The pulsing stops then, and the rain stops when the finale ends.
5. **`/pigescort reveal continue`:**
   - Run another test and use it during the speech: the remaining lines are dropped and the Ministry response comes at once.
   - Run it again: "Already continuing."
   - Run it before the leader step: "hasn't reached the leader yet."
6. **`/pigescort stop` mid-finale:** everything is cleaned up, nothing else is said or struck afterwards, and the weather goes back to what it was.
7. **Walking into the portal before T+14:** you're put back in front of it with "This portal is closed pending an inquiry."
8. **A fixed test frame (optional):**
   - Set `PORTAL_FRAME_FROM` / `PORTAL_FRAME_TO` to the outer corners of a frame (it must be flat: the same x or the same z) and run `/reload`.
   - `/pigescort finale restoreframe` builds and lights it. `finale test fail` blows it up, and it stays crying obsidian afterwards.
   - `restoreframe` puts it back.
9. **Unlocking:**
   - `/pigescort nether unlock`, then light a Nether portal outside the whitelist: it lights.
   - `/pigescort nether lock`: it's refused again.
   - Restart the server between unlock and lighting to check that the switch is saved.
10. **A real run:**
   - With `TEST_MODE = true`, `/pigescort settime 2`, and walk the pig in (Ending A).
   - Then run again, walk well away from the portal, and let it time out (Ending B). You should be brought back to the portal at T+0.
   - After the real Ending A, `/pigescort nether status` says Unlocked. Run `/pigescort nether lock` if this was only a test.

## Test plan (local server, 1–2 accounts)

**Before you start:** set `TEST_MODE = true` at the top of `pig_escort.js`. That lets you start the event alone. Put it back to `false` when you're done.

1. **Install**
   - Copy both files into place and restart the server.
   - Check `logs/kubejs/startup.log` and `logs/kubejs/server.log` for errors.
2. **Diagnostics:** run `/pigescort diagnostics`.
   - It should say *Startup hooks installed: yes*.
   - Note what it says about each "clean API". With `USE_CLEAN_APIS = false`, the fallbacks are in use regardless.
3. **Setup**
   - Run `/pigescort setup`, then `/pigescort setstart` somewhere open.
   - Walk about 40 blocks away and run `/pigescort setportal` while looking north.
   - Run `/pigescort settime 5` and `/pigescort difficulty easy`.
4. **Preview:** run `/pigescort preview`.
   - Expect: flames at the start, a light column and a frame outline at the portal, and green sparkles at the checkpoints.
   - Expect: the distance in chat.
   - Expect: **no blocks placed and no pig.**
   - Run `/pigescort status`; it should show "Staged".
5. **Start:** run `/pigescort start`.
   - Expect: the announcement and a 10…1 title countdown.
   - Then: "YOU ARE AN ESCORT", your name green and glowing, and the pig at the start with a gold name and Glowing.
   - Also: the portal built and lit on its platform, the bossbar (health / distance / time), and the light column.
   - Run `/pigescort diagnostics` again: the *Hook calls* counts should start rising as you play. **That proves the startup hooks reach the server script.**
6. **Pig protection.** Each of these should fail:
   - hitting the pig: no damage and no knockback;
   - right-clicking it with a saddle, name tag, carrot, dye or bucket;
   - pushing it into a boat or minecart;
   - `/tp @e[tag=pig_escort_ambassador] ~ ~ ~5`: you should get "Unauthorized relocation… declined", which tests the teleport hook;
   - `/effect give @e[tag=pig_escort_ambassador] minecraft:poison 30`: the effect should be gone within about a second;
   - leading it through lava or off a cliff: no damage, and the fire goes out.

   A **lead** works, and holding a carrot makes it follow.
7. **Tamper detection**
   - Run `/execute as @e[tag=pig_escort_ambassador] run data merge entity @s {Pos:[0d,120d,0d]}` (pick coordinates far away). This moves the pig without firing an event.
   - Within a second: "Tampering … detected", the pig reappears where it was, and you (the last player who touched it) glow and are slowed for 30 s.
8. **Raiders.** Test in **survival**: mobs ignore creative players, although they still go for the pig. The world must not be on Peaceful, or the event refuses to start.
   - After 20 s (or right away with `/pigescort wave`), a wave appears 10–15 blocks from the pig. The mobs glow red and carry gold swords, crossbows or gold axes.
   - They head for the pig. If you (in survival) get within 8 blocks of one, it turns on you instead. With `USE_CLEAN_APIS = true`, hoglins target the pig too; with the fallbacks, hoglins only attack players near them.
   - Wait more than 15 s: piglins must **not** turn into zombified piglins.
   - Kill one: the chat says "Escort … has neutralized a Piglin".
   - Let one hit the pig: the bossbar health drops, scaled by difficulty.
9. **Fatal hits:** run `/kill @s`, or let mobs kill you.
   - You don't die and drop nothing, and no corpse appears.
   - You're healed, teleported to the start (or the latest checkpoint), see "MINISTRY PROCESSING", and are blind and slow for 6 s.
10. **Checkpoints:** lead the pig to the green sparkles.
    - Expect "Checkpoint 1 of 2 secured".
    - Then `/kill @s` sends you there.
11. **Portal protection**
    - Try to break the frame (blocked) and to place a block in front of it (blocked).
    - Light TNT next to it: the frame should survive.
    - Use `/setblock` to replace one obsidian block with air: it's rebuilt within a second.
    - Stand in the portal for 4 s in survival, or walk in in creative: you're pushed out with "reserved for diplomatic swine".
12. **Win:** lead the pig into the portal.
    - Expect: DELIVERED, a sound, hearts and totem particles, and a diamond for each Escort plus the top-killer bonus.
    - Then check everything is restored: the portal is gone and the terrain is back, there's no bossbar, no teams (`/team list`), no Glowing, `/gamerule keepInventory` is back to its old value, `/forceload query` shows nothing new, and `/pigescort status` says Idle.
13. **Losses**
    - Run again with `/pigescort settime 1` and let it time out: "Time has expired".
    - Run again and let the mobs kill the pig. On hard it's quicker, or use `/data merge entity <pig> {Health:5f}`. Expect "Ambassador Oinkington has fallen".
14. **Stop and cancel**
    - `/pigescort stop` mid-event cleans up with no winner.
    - `/pigescort stop` during the countdown builds nothing.
    - `/pigescort setup` then `/pigescort cancel` returns to Idle.
15. **Crash recovery**
    - Start an event and run `/reload`: it's voided and everything is restored within a tick.
    - Start an event, then stop the server with `stop`, or kill the process to simulate a crash.
    - Start the server again: within about a second of loading, the portal, teams, bossbar and gamerule are cleaned up. A pig or mobs in chunks that weren't loaded are removed when those chunks load (`STRAY_PIG_GUARD_WHEN_IDLE`), or with `/pigescort purge`.
16. **Second account**
    - Log the second account out mid-event: "has left the Escort detail", and it's removed from the team with its Glowing cleared.
    - Log it back in: it's not on a team.
    - Log an account in that wasn't online at the start: it sees the bossbar but has no team.
17. **Finish:** set `TEST_MODE = false` and run `/reload`.

## What couldn't be verified for KubeJS 6 on 1.20.1

**Checked against your KubeJS jar (2001.6.5-build.26) and Forge 47.4.10:**
- `ForgeEvents` is startup-only.
- Which KubeJS events can be cancelled.
- `EntityEvents.hurt` fires on Forge's `LivingAttackEvent`, at HIGH priority.
- The command-registry methods and the integer argument.
- `runCommandSilent` returns an int.
- The `BlockContainerJS` methods.
- Removing blocks and entities from an explosion.
- All six Forge event classes exist, and which ones can be cancelled.
- The Corpse mod ignores cancelled deaths.

**Not verified.** The fallbacks are used unless noted:

1. **Startup hooks calling server-script functions through `global`.** There's no fallback; this is how the hooks work. Test step 5's *Hook calls* counters show it working.
2. **`JsonIO.write/read` with a plain path.** This is the crash-snapshot file; the copy in world data is the backup. `/pigescort diagnostics` shows OK or FAILED.
3. **Clean APIs, off by default (`USE_CLEAN_APIS = false`):**
   - `Heightmap$Types` for finding ground. The fallback scans the column downward.
   - `MemoryModuleType` brain calls for mob targeting. The fallback writes piglin anger with `/data merge` every 3 s, and hoglins then only go for players.
   - `Event$Result.DENY` for blocking effects. The fallback clears effects every second.
   - `getWorldBorder()` min/max. The fallback is `/worldborder get` and **assumes the border is centred on 0,0**.
   - `entity.discard()`. The fallback is `/kill` with the script's own damage blocking switched off.

   If diagnostics says every clean API is OK, you can set `USE_CLEAN_APIS = true` and `/reload`.
4. **Plain Minecraft methods called by their Mojang names**, which KubeJS normally remaps: `getActiveEffects`, `getBbWidth`, `resetFallDistance`, `getSharedSpawnPos`, `getMsgId`, `getLeashHolder`, `blocksMotion`, `getMaxBuildHeight` and others. These are standard, but untested on your server.
5. **The finale:**
   - **The explosion push** uses Minecraft's `knockback(...)` and then sets `hurtMarked` so the player's game gets the new motion. If either fails, the push is skipped and a warning is logged; nothing else is affected.
   - **The unlock switch** is read inside the whitelist's startup handler through `event.getLevel().getServer().persistentData`. If that can't be read, the whitelist stays on, and the error is logged once. `/pigescort nether unlock` also sets a `global` flag the whitelist checks first, so it still works until the next restart.
   - **`/fakejoin` run from the script:** the server runs it with full permission, so this should work. If it fails, ops are told and the finale goes on.
   - **hypixel's chat on Discord:** `/fakesay` builds Simple Discord Link's chat message (`DiscordAuthor.of(name, uuid, name)` with `MessageType.CHAT`) the same way Simple Discord Link does for a real player's chat. If it fails, the command's reply and the log say where. The in-game line is not affected.
   - **The fireworks:** the NBT format (`FireworksItem`) and the damage name `fireworks` used to cancel firework damage. The fireworks explode 12 blocks above the frame, out of their 5-block damage range anyway.
   - **`explosion_emitter` with `force`:** it should show for everyone, at any distance.
   - **Visual-only lightning** (`createEntity('minecraft:lightning_bolt')` + `setVisualOnly(true)`): this is the same code as `/aura`. If KubeJS doesn't expose `setVisualOnly`, sparks and a thunder sound are used instead and one warning is logged. A real bolt is never summoned.
   - **The weather:** it's read with `isRaining()` / `isThundering()` on the overworld. If that fails, the weather is left alone and a warning is logged.
   - **The heartbeat sound** `minecraft:entity.warden.heartbeat` and the `crimson_spore` particle are vanilla 1.20.1 IDs. A wrong ID would only make that effect silent or invisible.
6. **Mods that react to a right-click on the pig at a higher priority** than KubeJS's could act before the cancel. Tamper detection is the backstop.

## Known limitations

- **A Totem of Undying is used up before the death interception runs**, the same as in vanilla.
- **A fatal hit clears all of a player's effects, beneficial ones included**, and then reapplies Glowing.
- **Nether travellers can arrive at the event portal.** Someone coming from the Nether whose exit is within about 128 blocks may land in it. They're simply pushed out.
- **Choosing a random portal generates chunks up to 600 blocks away,** which can cause a short lag spike at `/pigescort start` or `setportal random`.
- **`/reload` during an event voids it,** as specified.
