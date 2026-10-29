# Factions (core)

Techno's Crownsworn (id `ministry`), The Blood God's Syndicate (id `syndicate`) and the Unregistered Citizens.

## Files

| File | Goes in | What it is |
|---|---|---|
| `factions_config.js` | `kubejs/server_scripts/factions/` | Factions, ranks, wording and settings. Edit this one. |
| `factions_core.js` | `kubejs/server_scripts/factions/` | Storage, commands, chat, dimension tracking, `global.Factions`. |
| `factions_hooks.js` | `kubejs/startup_scripts/` | Passes Forge's "player changed dimension" event to the core. |

**Trials:** `factions/trials.js` is an optional add-on that uses the ranks: Crownsworn Enforcers and Ministers (and ops) file charges and judge them. See [TRIALS.md](TRIALS.md).

**Install:** copy all three, then **restart the server once** so the startup hook loads. After that, `/reload` is enough for changes to the two server scripts. Until you restart, ops get a reminder on login and dimension events only fire on login, logout and respawn.

**Data:** stored by UUID in `server.persistentData["factions"]`. It survives restarts, `/reload` and name changes. The script never clears it, and only touches its own key (Pig Escort keeps its own key there too). If the saved data is ever unreadable, a copy is kept under `factions_unreadable_<time>` before starting over.

## Assigning factions and ranks

| Command | Who | What it does |
|---|---|---|
| `/faction set <player> <faction> [rank]` | ops | Puts an online player in a faction. The rank is optional and defaults to the lowest. Names with spaces work: `/faction set Goruk syndicate Cell Leader`. |
| `/faction rank <player> <rank>` | ops | Changes their rank within their faction. |
| `/faction remove <player>` | ops | Back to Unregistered. Silent: no desertion notice. |
| `/faction whois <name>` | ops | Shows anyone's faction, including secret ones and offline players on record. |
| `/faction list [faction]` | ops | Members by rank, secret ones included. `*` = offline. |
| `/faction` or `/faction me` | everyone | Your own faction and rank, privately. |
| `/faction info` | everyone | The public factions. Syndicate members also see the Syndicate. |
| `/faction invite <player>` | Enforcer+ (Ministry), Cell Leader (Syndicate) | Invites an Unregistered player. |
| `/faction accept [faction]` / `/faction decline [faction]` | invited player | Answers an invite. Invites expire after 5 minutes. |
| `/faction leave` | members | Back to Unregistered. Leaving the Ministry is announced as desertion; leaving the Syndicate is silent. |
| `/faction chat <message>` | members | Only online members of your faction see it (gold for the Ministry, dark red for the Syndicate). |

The ranks only change titles and who can invite. The Enforcers' real permissions (`/tp`, `/invsee`, spectator) still come from your FTB Ranks rank. The script never touches FTB Ranks.

**Invites never give anything away.** The inviter always gets the same reply ("Your request has been filed."), whether the invite was sent or not. They can't tell whether the other player is in the Syndicate, in the Ministry or on cooldown. Only the player who accepts is ever named back to the inviter. Declines and expiries tell the inviter nothing.

## Adding or changing a faction

1. In `factions_config.js`, copy one of the faction blocks inside `factions: [ ... ]`, give it a new `id` (lowercase), and change the wording. The fields are explained at the top of that file.
2. Set `secret: true` to make it behave like the Syndicate: hidden everywhere, described only to members, leaving is silent.
3. Run `/reload`. If something is wrong (an unknown colour, a duplicate rank, an `inviteRank` that isn't one of its ranks, a missing comma...), the log and any online ops get a `[Factions]` message, and the last working config stays in use.

**Don't rename an `id` once players are in that faction.** Saved members would count as Unregistered until you change it back. Their data is kept, so nothing is lost. Renaming `displayName`, ranks text and wording is safe. If you rename a rank, members holding the old rank drop to the lowest rank, so set them again with `/faction rank`.

## Chat prefixes

- **Public factions:** the prefix (e.g. gold `[Enforcer]`) goes in front of the player's name: `[Enforcer] <Goruk> hello`. It's added to the player's **display name** through Forge's `NameFormat` event in `factions_hooks.js`.
  - **Where it shows:** before the name in chat, death messages, `/msg`, the vanilla join and leave messages, and on Discord. Simple Discord Link uses the display name for the chat author and in its join and leave posts, e.g. "[Enforcer] Goruk has deployed".
  - **Where it doesn't:** the tab list and the nameplate above a player's head don't use the server's display name, so they're unchanged.
  - **FTB Essentials:** the nickname is set first (it runs at Forge's HIGHEST priority), then the prefix, then the recording or streaming icon (LOWEST). So you get `⏺ [Enforcer] Nick`.
  - **Changes:** the name updates as soon as someone joins, leaves, is promoted or demoted, and after `/reload`.
  - **Before the restart:** until the server restarts with the updated `factions_hooks.js`, the prefix is added to the message instead (`<Goruk> [Enforcer] hello`), and ops get a reminder on login.
  - **Turning it off:** set `SHOW_PUBLIC_PREFIX: false`.
- **Secret factions:** never in the display name. By default, members chat exactly like Unregistered players, with no prefix for anyone.
- **`SECRET_PREFIX_FOR_MEMBERS: true` (off by default)** shows Syndicate members their own prefix in front of the name (`[Cell Leader] <Dana> hi`), while everyone else sees the plain message. To do that, each of their chat messages is cancelled and every viewer is sent their own copy. The trade-offs:
  - **Discord:** whether Simple Discord Link still relays those messages depends on when its library (CraterLib) reads chat, which I couldn't check. They may stop reaching Discord, and Syndicate members' messages going missing would itself be a giveaway. Test it before relying on it.
  - **How they look:** the re-sent copies are server messages, not player chat. Players without mods won't notice, but Chat Heads may not show the head next to them. Both groups of viewers get the same kind of copy, so the difference doesn't give away who's in the Syndicate.
  - **Muting still works:** FTB Essentials' mute runs before this, so muted players stay muted.

## Using it from another script

Put the module in `kubejs/server_scripts/`, keep the default priority (0) so it loads after the core, and wrap it in an IIFE:

```js
(function () {
const F = global.Factions

// React to changes. Listeners are cleared on /reload; every script re-registers when it reloads.
F.on('joinedFaction', (player, oldFaction, newFaction) => {
  if (newFaction == 'ministry') player.tell(Text.gold('Your Ministry ration card is in the mail.'))
})
F.on('enteredDimension', (player, faction, from, to) => {
  if (to == 'minecraft:the_nether' && faction == 'syndicate') { /* Nether module goes here */ }
})

// Ask questions inside events or commands (not at the top level: on a fresh start the server
// isn't ready while scripts load).
ItemEvents.rightClicked('minecraft:paper', event => {
  const p = event.player
  if (F.isInFaction(p, 'ministry') && F.hasRankAtLeast(p, 'Enforcer')) p.tell('You may stamp this.')
})
})()
```

| Call | Returns |
|---|---|
| `getFaction(p)` / `getRank(p)` | A faction id and a rank name. `p` is a player or a UUID string. |
| `isInFaction(p, id)` | true/false |
| `hasRankAtLeast(p, rank[, factionId])` | Whether their rank is at least `rank`, within their own faction. |
| `setFaction(p, id[, rank, { silent: true }])` | `{ ok, error }`. The player must be online. Shows the welcome unless `silent`. |
| `getMembers(id)` | `[{ uuid, name, rank, online }]`. For `unregistered`, online players only. |
| `on(event, callback)` | A function that unsubscribes. |
| `visibleFaction(viewer, target)` | **Use this whenever you show a faction to a player.** It returns `unregistered` for a secret member unless the viewer is that player, a fellow member or an op. |
| `getFactionIds()`, `getFactionInfo(id)`, `isSecret(id)`, `DEFAULT` | Config lookups. |

Events:
- `joinedFaction(player, oldFaction, newFaction)`: not fired when someone becomes Unregistered.
- `leftFaction(player, faction)`: moving straight from one faction to another fires `leftFaction` first, then `joinedFaction`.
- `rankChanged(player, oldRank, newRank)`.
- `enteredDimension(player, faction, from, to, how)` and `leftDimension(player, faction, dimension, how)`: they fire when a player:
  - arrives through a portal or a cross-dimension `/tp` (`leftDimension`, then `enteredDimension`; `how` = `'travel'`);
  - logs in (`enteredDimension` with `from = null`, `how` = `'login'`);
  - logs out (`leftDimension`, `how` = `'logout'`);
  - respawns in a different dimension from the one they died in (both, `how` = `'respawn'`).

  `'travel'` doesn't say whether it was a portal or `/tp`. Portal Ambush tells them apart by Minecraft's short portal cooldown (set just before every portal trip), or else by a portal block where the player arrived.

  Portals blocked by `nether_portal_whitelist.js` fire nothing. A listener that throws is logged and doesn't stop the others or the change itself.

**Keeping the Syndicate secret in your own modules:** never broadcast with `/tellraw @a` (Simple Discord Link relays it). Use `visibleFaction` before showing anyone's faction, and don't write Syndicate membership to the log.

## Test plan (local or test server, two accounts)

Use **A** (op) and **B** (not op). Copy the three files, restart, and join with both.

**Give each client its own game folder,** or read the results from each client's chat screen. Two clients started from the same instance folder write to the same `logs/latest.log`, so lines appear twice or get overwritten. That once made a message look like a secrecy leak when it wasn't.

1. **Startup:** the log has no `[Factions]` errors, and A gets no "factions_hooks.js is not active" message.
2. **Defaults:** B runs `/faction` and is told they're an Unregistered Citizen. B runs `/faction set` and gets "unknown command". Tab completion shows B no `set`, `rank`, `remove`, `whois` or `list`.
3. **Ministry:** A runs `/faction set A ministry Enforcer`. A sees the gold MINISTRY title and welcome, and B sees nothing. A types in chat, and both see a gold `[Enforcer] <A> ...`. Set a nickname with `/nickname Goruk`: chat shows `[Enforcer] <Goruk> ...`. A death message reads `[Enforcer] A was slain by ...`.
4. **Invite and accept:** A runs `/faction invite B`. A sees "Your request has been filed...", and B sees the invitation naming A with Accept and Decline buttons. B clicks Accept, gets the welcome, and A is told B accepted. Then `/faction leave` as B: everyone sees the desertion notice.
5. **Syndicate secrecy (the important one):** A runs `/faction set A syndicate Cell Leader`. Then, as **B**, check:
   - A's chat messages have no prefix.
   - The tab list and A's nameplate look the same as before.
   - `/faction info` doesn't mention the Syndicate.
   - `/faction invite A` gives exactly the same reply as `/faction invite <anyone>`, and A gets no invite.
   - B never saw a message when A joined.
   - Discord shows nothing about it.
6. **Syndicate invite:** A runs `/faction invite B`. B gets the [SIGNAL HIJACKED] invitation, which doesn't name A. B accepts, then both run `/faction info` and see the Syndicate. Try `/faction chat hi` from both, and `/faction me` (marked secret).
7. **Silent leave:** B runs `/faction leave`. B is told privately, and A and the chat see no announcement.
8. **Admin views:** A runs `/faction whois B`, `/faction list` and `/faction list syndicate`. Secret members are shown, marked [SECRET].
9. **Persistence:** set B to the Ministry. Run `/reload` and check `/faction whois B`; then restart and check again. Membership is saved by UUID, so a player who changes their Minecraft name keeps their faction.
10. **Config safety:** break `factions_config.js` (delete a comma) and run `/reload`. A gets a `[Factions]` message, and commands still work with the old config. Fix it and `/reload`, and the message is gone.
11. **Dimensions (with a test module):** add a two-line module that tells you when events fire, using `global.Factions.on('enteredDimension', (p, f, from, to) => p.tell(from + ' -> ' + to))`. Then:
    - go through the allowed Nether portal and back;
    - use `/execute in minecraft:the_nether run tp @s 0 100 0`;
    - die in the Nether and respawn in the Overworld;
    - log out and in.

    Each should produce one message. A blocked portal should produce none.
12. **Pig Escort:** start a Pig Escort with a Ministry member and a Syndicate member taking part. The `[Escort]` team prefix and faction prefixes both show, and factions are unchanged after the event.

## Not verified on a real server

Everything above passed a mock-server test (73 checks). These parts rely on server behaviour I couldn't run here:

- **The order of `NameFormat` against FTB Essentials:** that a nickname comes out as `[Enforcer] Nick`. If the prefix ever disappears when a nickname is set, the nickname is being applied after the prefix.
- **`SECRET_PREFIX_FOR_MEMBERS` mode:** whether Discord still receives those messages, and how Chat Heads handles the re-sent copies (see above).
- **Forge firing `PlayerChangedDimensionEvent` for cross-dimension `/tp`.** Forge patches teleporting to do this. Reading the dimension from `getFrom()`/`getTo()` has a fallback for either format.
- **If Minecraft's text reader ever fails,** messages are rebuilt with KubeJS's own text methods, keeping colours but losing click and hover. The log then shows one `[Factions] Text error` line with the reason.

**Confirmed on the live server** (by the KubeJS test report):
- the title packets;
- invite secrecy;
- the silent Syndicate leave;
- persistence across `/reload`;
- `/ambush status` with the hooks loaded.
- **Size limit.** The saved data is one NBT text value, which has a limit of about 64 KB. That's roughly 600 faction members. Unregistered players aren't stored.

---

# Portal Ambush (add-on)

Punishes faction members for travelling into the dimension hostile to their faction. Crownsworn (`ministry`) are hunted in the Nether, and Syndicate (`syndicate`) members are hunted in the Overworld.

| Mechanic | Trigger | What comes |
|---|---|---|
| 1. Nether Ambush | A ministry player comes into the Nether **through a Nether portal**. 50% chance. | A war party of Blood-Marked Piglins: piglins with a Sharpness V / Fire Aspect II netherite sword or a fast multishot crossbow, and brutes with a Sharpness V netherite axe, in dark red leather. 3 mobs, +1 per extra target, up to 8. |
| 2. Return Inspection | A syndicate player comes back to the Overworld through a portal. 50% chance, and **only if nobody outside the Syndicate is within 48 blocks**. | A patrol of Ministry Inspectors: vindicators with Sharpness V netherite axes and pillagers shooting Harming arrows, in gold leather. 2 mobs, +1 per extra target, up to 6. |
| 3. Random Raid | Every **10 minutes** spent in their hostile dimension (the countdown pauses during a fight and restarts with each raid): **50% a light raid, 25% a moderate one, 10% a lethal one**, 15% nothing. The cooldown doesn't apply to these rolls. | A light, moderate or lethal group (see below), 8–10 blocks away and out of sight where possible (this close, some may appear in view). A warning comes 3 seconds before they arrive. Overworld raids follow the same secrecy rule: with a witness nearby, the raid is postponed 2–5 minutes, up to 3 times, and keeps its tier. |

**Raid tiers** (`RAID_TIERS` near the top of `portal_ambush.js`). Every tier adds +1 mob per extra target, up to 8:

| Tier | Chance | Mobs | Strength | Warning |
|---|---|---|---|---|
| Light | 50% | 2–3. Nether: piglins only. Overworld: vindicators and pillagers. | ¾ health and damage | the usual one |
| Moderate | 25% | 3–5, the normal war party or patrol | as in the table below | the usual one |
| Lethal | 10% | 6–8. Nether: mostly brutes, plus piglins, evokers and vexes. Overworld: mostly vindicators, plus pillagers, evokers and vexes. At most 2 evokers. | 1.5× health, 1.25× damage, and Strength I for as long as they live | Nether: [SIGNAL HIJACKED] "The Blood God demands your blood." Overworld: [MINISTRY] "Lethal force has been authorised." |

- **Evokers and vexes** come only in lethal raids, with the group's name and leather chestplate.
- **Summoned vexes:** the vexes an evoker summons join its group. They only go after the group's targets, are removed with it, and drop no reward. Vanilla also gives them a short life.
- **Vexes hit hard:** every vex in a group, both the raid's own and the ones its evokers summon, gets **Strength III** (+9 melee damage) and **Speed III** for as long as it lives, instead of the tier's Strength I (`VEX_EFFECTS` in portal_ambush.js).
- **Base stats:** evokers have 60 health, vexes 20 with a Sharpness III iron sword. Lethal raids multiply these too.
- **Odds and timing:** change `chance` in `RAID_TIERS` and `RAID_MINUTES`.

**Mob strength.** The ambush mobs are tuned for players in full diamond or netherite with Protection IV. Each has more health, melee damage and built-in (invisible) armour than vanilla. These are the `stats` in `MOB_KINDS` near the top of `portal_ambush.js`:

| Mob | Health (vanilla) | Weapon | Hit on netherite + Prot IV (Normal) |
|---|---|---|---|
| Piglin | 40 (16) | Netherite sword, Sharpness V, Fire Aspect II, or a Quick Charge III multishot crossbow | about 1.2 hearts, plus fire |
| Piglin brute | 90 (50) | Netherite axe, Sharpness V | about 2 hearts |
| Vindicator | 50 (24) | Netherite axe, Sharpness V | about 1.4 hearts |
| Pillager | 36 (24) | Quick Charge II crossbow with 64 Harming arrows | about 1 heart per arrow (Harming ignores armour) |
| Evoker (lethal raids) | 60 (24) | none: fangs and summoned vexes | fangs ignore armour |
| Vex (lethal raids) | 20 (14) | Iron sword, Sharpness III | about 1 heart |

Hard difficulty is 1.5 times those hits. Without Protection enchantments they're about 3 times. To make them tougher or weaker, change `health`, `damage`, `armor` and `toughness`, the weapon enchantments, or the group sizes (`NETHER_AMBUSH_BASE_SIZE`, `PATROL_BASE_SIZE`, each raid tier's `size`). Then run `/reload`.

## Files

| File | Goes in | |
|---|---|---|
| `portal_ambush.js` | `kubejs/server_scripts/factions/` | Everything. All settings, names and messages are at the top. |
| `portal_ambush_hooks.js` | `kubejs/startup_scripts/` | Stops ambush mobs targeting anyone outside their group, and powers the `ZERO_XP` option. |

Both also need `factions_core.js` and `factions_hooks.js`, which is how portal arrivals are detected. **Restart once** after adding the startup file. `/ambush status` shows whether both hooks are loaded.

## Rules

- **Who they attack:** mobs only attack their own group's targets. They're steered to their targets every second, and the hook refuses any other target. Damage from them, arrows included, to anyone or anything else is cancelled. So they never fight other players, villagers, iron golems, normal piglins or each other.
- **Targets:**
  - **Portal ambushes:** the players who came through, plus other eligible players of the hunted faction within 24 blocks.
  - **Raids:** hunted-faction players within 32 blocks.
  - **Never targeted:** players in creative or spectator, players taking part in a Pig Escort, and, for portal ambushes, players on cooldown.
  - **Switching:** mobs switch to the nearest target within 32 blocks.
- **Ending a group:** the group ends, quietly and with no drops, when:
  - all its mobs are killed;
  - 60 seconds pass with every target dead, offline or more than 64 blocks away;
  - every target has escaped (a target who leaves the dimension just drops out of the group);
  - it reaches 10 minutes;
  - someone runs `/ambush clear`.

  Each target then gets a **10-minute cooldown** against portal ambushes. Raid rolls ignore it; their countdown pauses while the player is in a group instead.
- **Drops:**
  - **Vanilla loot and equipment:** none.
  - **Reward per kill:** Blood-Marked Piglins drop 1–3 gold nuggets, Ministry Inspectors 0–1 emerald.
  - **XP:** vanilla, unless `ZERO_XP = true`.
  - **Other:** they can't pick up items or barter. Inspectors never join or start raids, and give no Bad Omen.
- **Caps:** 8 mobs per group and 24 ambush mobs on the whole server.
- **Where nothing happens:**
  - within 64 blocks of world spawn;
  - within 64 blocks of an active Pig Escort portal;
  - inside the `SAFE_ZONES` areas.

  Raid countdowns pause there too.
- **Peaceful:** everything is skipped and countdowns pause.
- **Saved data:** cooldowns and countdowns are stored by UUID in `persistentData["portal_ambush"]`, so logging out, `/reload` and restarts don't reset them. A countdown keeps its remaining time when the player leaves and comes back.
- **Leftovers:** ambush mobs from before a restart or `/reload` are removed as they load.

## API for other scripts

`global.PortalAmbush` is refreshed on every load, and `economy/black_market.js` uses it for Ambush Contracts:
- `startGroup({ targets: [uuid], mechanic, dim, size, def, tier, onEnd, contractId })` spawns a group the way a raid does, 8–10 blocks away and out of sight where possible, and returns it, or null if nothing spawned.
  - `onEnd(group, reason)` runs once when the group ends, with `killed_all`, `timeout`, `targets_lost`, `cleared` or `reload`.
  - A `contract` group's mobs are also tagged `contract_ambush`.
  - The reward comes from `def` if one is given.
- `cooldownLeftMs(uuid)` and `startCooldown(uuid)`: the shared cooldown.
- `inGroup(uuid)` and `groupOf(entity)`.
- `inSafeZone(server, dim, pos)` and `isPigEscortParticipant(player)`.
- `isEnabled()` and `isPeaceful(server)`.
- `mobRoom()`, `groupMax` and `tiers` (`RAID_TIERS`).

Nothing about portal arrivals or raids changed.

## Commands (op level 2)

| Command | |
|---|---|
| `/ambush test nether <player>` | A war party on the player in 3 seconds. Skips the roll, cooldown and safe zones, and targets them whatever their faction. |
| `/ambush test overworld <player>` | An inspection patrol in 3 seconds. Also skips the secrecy check. |
| `/ambush test raid <player> [light\|moderate\|lethal]` | A raid in their hostile dimension (they must be there). With no tier, one is rolled by the odds (never "nothing"). Skips the countdown but **keeps the secrecy postponement**. |
| `/ambush timer <player>` | Their raid countdown, the odds when it runs out, any postponement and its tier, their cooldown, whether they're in a group, and their last trip between dimensions with the reason it did or didn't lead to an ambush (e.g. `overworld -> the_nether (travel): rolled 71%, needed under 50%`). Use it first when an ambush doesn't happen. |
| `/ambush status` | On or off, hooks, and the active groups with their mechanic, targets, mob count and age. |
| `/ambush clear` | Ends every group and removes every ambush mob. No cooldowns are given. |
| `/ambush toggle` | Turns the add-on on or off. The setting is saved, and no data is lost. Turning it off ends the active groups. |

## Test plan (two accounts in survival: A = ministry, B = syndicate)

Set up as an op: `/faction set A ministry` and `/faction set B syndicate`. Keep away from world spawn (64 blocks) for everything except step 9. To test the chances quickly, temporarily set `NETHER_AMBUSH_CHANCE` and `OVERWORLD_PATROL_CHANCE` to `1`, then `/reload`.

1. **Nether ambush through a portal:** A goes through an allowed Nether portal. After 3 seconds, Blood-Marked Piglins (dark red chestplates, names showing) appear 8–10 blocks away. Only A sees "[SIGNAL HIJACKED] Blood for the Blood God." They attack A even if A wears gold.
2. **No ambush from `/tp`:** go back to the Overworld and wait until `/ambush timer A` shows no cooldown (10 minutes). Then use `/execute in minecraft:the_nether run tp A ~ 100 ~`. No ambush appears. Going through the portal again now would trigger one.
3. **Return inspection:** B comes back to the Overworld through a portal with A more than 48 blocks away. Ministry Inspectors appear, and only B sees "[MINISTRY] Routine border inspection...". Repeat after the cooldown with **A standing within 48 blocks** of the arrival portal: nothing happens, and nobody gets a message.
4. **Raids:** with B in the Overworld, run `/ambush test raid B`. B gets "[MINISTRY] Inspectors have been dispatched..." and a patrol arrives 3 seconds later, 8–10 blocks away. Then, with A standing within 48 blocks of B, run `/ambush test raid B` again (after `/ambush clear`). The reply says the raid was postponed, and `/ambush timer B` shows "postponed moderate raid, 1/3" (or whichever tier was rolled). With A in the Nether, `/ambush test raid A` sends a war party after "[SIGNAL HIJACKED] The Blood God has found you." Then try each tier: `/ambush test raid A light` (2–3 weaker piglins), `moderate`, and `lethal` ("The Blood God demands your blood.", 6–8 mobs with brutes, evokers and vexes, all with Strength). Watch an evoker summon vexes: they should only attack A and should disappear with the group after `/ambush clear`.
5. **Wrong faction ignored:** during a war party on A, B stands among the piglins. They never target or hurt B. During a patrol on B, A stands among the inspectors and is ignored. Nearby villagers and iron golems aren't attacked.
6. **Drops:** each killed piglin drops 1–3 gold nuggets and nothing else (never their weapons or arrows, no loot). Inspectors drop 0–1 emerald.
7. **Despawning:** start a group and run more than 64 blocks away. About 60 seconds later the group vanishes without drops. Or go back through the portal: you escape, and the group ends once nobody is left.
8. **Cooldowns:** after a group ends, `/ambush timer A` shows a cooldown of about 10 minutes, and portal trips trigger nothing until it's over. Restart the server and check that the cooldown and countdown survived.
9. **Safe zones and caps:**
   - near world spawn, portal arrivals and raids never trigger;
   - `/ambush status` never shows more than 8 mobs in a group or 24 in total;
   - on Peaceful nothing happens and `/ambush timer` stops counting down.

## Not verified on a real server

The mock-server test passed all 94 checks, including the raid tiers (the roll, sizes, stats, Strength, evoker cap, lethal warnings, evoker vexes joining their group, no cooldown, postponed raids keeping their tier, old countdowns being shortened): mob gear and stats (the summon NBT is parsed), portal travel versus `/tp` versus respawn, shared rolls, secrecy skips and postponements, sizes and caps, target and damage filtering, rewards, quiet despawning, escapes, cooldowns, persistence across `/reload`, Peaceful, toggle and stray removal. These parts depend on the real game:

- **Whether Forge's `LivingChangeTargetEvent` also covers the piglin brain's own target choice.** If it doesn't, piglins are still re-aimed every second, and their hits on anyone else are cancelled.
- **Whether the change-target cancel holds against vanilla "revenge" targeting** (mobs turning on whoever hit them). Same safety net as above.
- **Whether `CanPickUpLoot:0b` fully stops piglins taking gold to barter.**
- **Whether `block.popItem` works for the rewards.** If it doesn't, the reward is spawned with `/summon item`.
- **Whether `EntityEvents.spawned` fires for mobs loading from saved chunks.** That's how leftovers are removed. `/ambush clear` also removes any loaded ones.
- **Whether the portal-block check works with mods that teleport you next to a portal.**
- **Whether pillagers shoot the Harming arrows from their off hand.** If they shoot plain arrows instead, they're only weaker; nothing else changes.
- **Whether `vex.getOwner()` and `addTag` work from the script on an evoker's summoned vex.** If they don't, those vexes stay plain vanilla vexes: they can attack any nearby player, but they die within 30–120 seconds on their own. A warning is logged if tagging fails.
- **`/effect give <uuid> minecraft:strength infinite`** for the lethal mobs. `infinite` needs 1.19.4 or later, which 1.20.1 is.
