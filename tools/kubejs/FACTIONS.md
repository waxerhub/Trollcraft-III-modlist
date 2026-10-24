# Factions (core)

Techno's Crownsworn (id `ministry`), The Blood God's Syndicate (id `syndicate`) and the Unregistered Citizens.

## Files

| File | Goes in | What it is |
|---|---|---|
| `factions_config.js` | `kubejs/server_scripts/factions/` | Factions, ranks, wording and settings. Edit this one. |
| `factions_core.js` | `kubejs/server_scripts/factions/` | Storage, commands, chat, dimension tracking, `global.Factions`. |
| `factions_hooks.js` | `kubejs/startup_scripts/` | Passes Forge's "player changed dimension" event to the core. |

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

- **Public factions:** the prefix (e.g. gold `[Enforcer]`) is added to the message itself: `<Goruk> [Enforcer] hello`. It isn't added to the player's display name, because Simple Discord Link's join and leave posts and FTB Essentials nicknames use the display name, and the tab list shows it. The same prefix may also appear on Discord.
- **Secret factions:** by default, members chat exactly like Unregistered players, with no prefix for anyone.
- **`SECRET_PREFIX_FOR_MEMBERS: true` (off by default)** shows Syndicate members their own prefix, while everyone else sees the plain message. To do that, each of their chat messages is cancelled and every viewer is sent their own copy. The trade-offs:
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
- `enteredDimension(player, faction, from, to)` and `leftDimension(player, faction, dimension)`: they fire when a player:
  - arrives through a portal or a cross-dimension `/tp` (`leftDimension`, then `enteredDimension`);
  - logs in (`enteredDimension` with `from = null`);
  - logs out (`leftDimension`);
  - respawns in a different dimension from the one they died in (both).

  Portals blocked by `nether_portal_whitelist.js` fire nothing. A listener that throws is logged and doesn't stop the others or the change itself.

**Keeping the Syndicate secret in your own modules:** never broadcast with `/tellraw @a` (Simple Discord Link relays it). Use `visibleFaction` before showing anyone's faction, and don't write Syndicate membership to the log.

## Test plan (local or test server, two accounts)

Use **A** (op) and **B** (not op). Copy the three files, restart, and join with both.

1. **Startup:** the log has no `[Factions]` errors, and A gets no "factions_hooks.js is not active" message.
2. **Defaults:** B runs `/faction` and is told they're an Unregistered Citizen. B runs `/faction set` and gets "unknown command". Tab completion shows B no `set`, `rank`, `remove`, `whois` or `list`.
3. **Ministry:** A runs `/faction set A ministry Enforcer`. A sees the gold MINISTRY title and welcome, and B sees nothing. A types in chat, and both see `<A> [Enforcer] ...`.
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

Everything above passed a mock-server test (61 checks). These parts rely on server behaviour I couldn't run here:

- **Where the public prefix shows, and whether it reaches Discord.** It's set through `PlayerEvents.decorateChat` → `setComponent`, which edits the message text. Simple Discord Link may or may not include the prefix, depending on when CraterLib reads chat.
- **`SECRET_PREFIX_FOR_MEMBERS` mode:** whether Discord still receives those messages, and how Chat Heads handles the re-sent copies (see above).
- **The title packets** (`ClientboundSetTitleTextPacket` and the others) through KubeJS's name mapping. If they fail, the title text appears in chat instead, with a warning in the log.
- **Forge firing `PlayerChangedDimensionEvent` for cross-dimension `/tp`.** Forge patches teleporting to do this. Reading the dimension from `getFrom()`/`getTo()` has a fallback for either format.
- **`Component$Serializer.toJson`**, which is used to keep the original message when adding a prefix. `fromJson` already works on your server, because `/fakejoin` uses it.
- **Size limit.** The saved data is one NBT text value, which has a limit of about 64 KB. That's roughly 600 faction members. Unregistered players aren't stored.
