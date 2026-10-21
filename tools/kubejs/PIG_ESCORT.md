# Pig Escort Detail

A Ministry of Trolling server event for KubeJS 6 (Minecraft 1.20.1 Forge). It runs on the server only, and players need nothing installed.

All players are **Escorts**. They walk **Ambassador Oinkington** to a temporary Ministry-Approved Portal while waves of Piglins, Piglin Brutes and Hoglins try to kill him.
- **Escorts win** when the pig steps into the portal.
- **The Piglins win** if the pig dies or the time runs out.

Nothing ever travels through the event portal.

## Files

| File | Goes in | Why |
|---|---|---|
| `server_scripts/events/pig_escort.js` | `kubejs/server_scripts/events/` | All the event logic and commands. You can reload it with `/reload`, but a reload during an event voids that event. |
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
   - After 20 s (or right away with `/pigescort wave`), a wave appears 20–35 blocks from the pig. The mobs glow red and carry gold swords, crossbows or gold axes.
   - They go for the pig when within 16 blocks of it, and for you otherwise.
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
5. **Mods that react to a right-click on the pig at a higher priority** than KubeJS's could act before the cancel. Tamper detection is the backstop.

## Known limitations

- **A Totem of Undying is used up before the death interception runs**, the same as in vanilla.
- **A fatal hit clears all of a player's effects, beneficial ones included**, and then reapplies Glowing.
- **Nether travellers can arrive at the event portal.** Someone coming from the Nether whose exit is within about 128 blocks may land in it. They're simply pushed out.
- **Choosing a random portal generates chunks up to 600 blocks away,** which can cause a short lag spike at `/pigescort start` or `setportal random`.
- **`/reload` during an event voids it,** as specified.
