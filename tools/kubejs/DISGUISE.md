# Disguise

An op can appear to every other player as someone else: **any name**, with **any Minecraft account's skin**.

## Files

| File | Where it goes | What it does |
|---|---|---|
| `server_scripts/disguise.js` | `kubejs/server_scripts/` | The disguise: commands, packets, chat, saved data |
| `startup_scripts/disguise_hooks.js` | `kubejs/startup_scripts/` | Sets your display name while disguised. **Restart** after adding it |
| `server_scripts/fake_players.js` (updated) | `kubejs/server_scripts/` | The join/leave lines and Discord posts (`announceAs`, `chatAs`) |
| `server_scripts/factions/factions_core.js` (updated) | as now | No faction prefix while you're disguised |
| `startup_scripts/tab_nicknames.js` + `server_scripts/tab_nicknames.js` | as now | The tab list shows display names (needed for the tab list) |

## Commands (ops only)

| Command | |
|---|---|
| `/disguise <name>` | Become `<name>`, with that account's skin (the default skin if there's no such account) |
| `/disguise <name> <skin account>` | Become `<name>` with another account's skin, e.g. `/disguise The_Minister Technoblade` |
| `/disguise list` | Who is disguised as whom (real names) |
| `/undisguise` | Back to yourself |

## What other players see

| Where | While disguised |
|---|---|
| Name above your head, your skin | The disguise name and the skin account's skin |
| Tab list | The disguise name and skin |
| Chat | `<Disguise> message`. Your real message is cancelled, and the copy is sent under the disguise |
| Discord chat | Your messages posted as the disguise, with the skin account's avatar |
| `/msg`, death and advancement messages, `/list` | The disguise name |
| Putting it on | "`<you> left the game`", then "`<disguise> joined the game`", in game and on Discord |
| Taking it off | "`<disguise> left the game`", then "`<you> joined the game`" |
| Faction prefix ("[Enforcer]") | Not shown |

- **Your records stay yours:** Troll Log, coins, charges and bounties all use your real account.
- **Persistence:** the disguise survives `/reload` and logging out and back in.
- **The real owner of the name logs in:** your disguise ends quietly so there are never two of them. You and the ops are told.
- **Names that can't be used:** the name of someone online right now, or a name another op is already wearing.

## Where your real name can still show (can't be fixed from the server)
- **Discord, when you actually log in or out while disguised:** Simple Discord Link posts the real account's join and leave. Take the disguise off before you log out, or put it on after logging in.
- **Messages from the server's other scripts** still use your real account name: Troll Log announcements, bounties, trials, the black market, the Pig Escort and Clean Slate. Those scripts also use the name to run commands on you (`/title`, `/gamemode`, `/tp`), so it can't simply be swapped. Tell me which messages matter and I'll change those one by one.
- **Command tab-completion and selectors:** typing `/msg ` suggests real names, and `/msg <your real name>` reaches you.
- **The server list** (the player names shown when hovering the player count), and **voice chat**, which use account names.
- **Client mods that read account names,** such as JourneyMap's map labels.
- **Your own screen** still shows your real name to you.
- **The server console and log** show the real name (on purpose).

## Settings (top of `disguise.js`)

| Setting | Default | |
|---|---|---|
| `ANNOUNCE` | true | The fake leave/join when it goes on and off |
| `LOOKUP_TIMEOUT_TICKS` | 100 | How long to wait for Mojang's skin answer (5 s) |
| `RESEND_DELAY_TICKS` | 20 | After someone logs in, how long before they're shown the disguises |

Saved in `persistentData["disguise"]`: who is disguised, as what, and with which skin.

## Test plan (you and a second account)
1. **Install:** add both scripts, restart once (for `disguise_hooks.js`), and make sure `tab_nicknames.js` is installed.
2. **`/disguise Technoblade`:**
   - the second account sees "Sipheon left the game" and "Technoblade joined the game";
   - your nameplate and skin are Technoblade's;
   - the tab list shows Technoblade with that skin;
   - Discord shows the leave and the join.
3. **Chat:** you get `<Technoblade> …` in game and on Discord, with no copy under your real name. Also check `/msg`, and a death message.
4. **`/disguise The_Minister Technoblade`:** a made-up name with Technoblade's skin.
5. **Relog** the second account: they still see the disguise.
6. **`/undisguise`:** everything is back.

## What couldn't be verified for KubeJS 6 on 1.20.1
A mock-server test passed 27 checks:
- the packets (tab entry removed and re-added with the same UUID, the disguise name and the skin; the body re-sent to players in range; only the profile for players out of range or in another dimension);
- the leave/join lines and the Discord posts;
- chat re-sent under the disguise, with the original cancelled;
- the name hook;
- late joiners;
- switching disguises;
- an unknown account (default skin);
- `/reload`;
- the real owner logging in;
- `/undisguise`;
- ops only.

The factions, fake players, black market, ambush and story tests still pass. These need the real game:
- **The body re-send** (the network packets that remove and re-add your player body): that nameplates and skins change straight away for nearby players. If they don't, they change once those players move out of sight and back.
- **That cancelling your chat stops Simple Discord Link** posting it under your real name. That depends on the order the two mods handle chat. If a real-name copy reaches Discord, tell me.
- **The display name hook** with FTB Essentials nicknames and the faction prefix together.
- **Armour on your body** right after it's re-sent (it's re-sent too).
