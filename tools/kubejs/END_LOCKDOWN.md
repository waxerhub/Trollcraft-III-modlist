# The End Lockdown Initiative (ELI)

The Ministry has closed the End. Eyes of Ender are contraband, and the only way in is an End portal opened with **Unsanctioned Eyes of Ender** from the Hooded Merchant. (Story: [STORY.md](../../STORY.md), Act IV.)

## Files

| File | Where it goes | What it does |
|---|---|---|
| `server_scripts/end_lockdown.js` | `kubejs/server_scripts/` | The lockdown. Settings are at the top. |
| `server_scripts/economy/black_market.js` | `kubejs/server_scripts/economy/` | Sells Unsanctioned Eyes while the lockdown is on (see [BLACK_MARKET.md](BLACK_MARKET.md#tracking-and-alibis)). |
| `server_scripts/factions/factions_core.js` and `startup_scripts/factions_hooks.js` | (already installed) | Report dimension changes. Without them the portal-only rule is off; the rest still works. |

Copy them and run `/reload`. **To end the lockdown,** delete `end_lockdown.js` and `/reload`: Eye recipes come back, Eyes stop being confiscated, every route into the End opens, and the merchant stops selling Unsanctioned Eyes.

## What it does
1. **No Eyes can be crafted.** Every recipe that makes an Eye of Ender is removed, vanilla or modded.
2. **Ordinary Eyes are confiscated.**
   - **When it happens:**
     - whenever an Eye enters a player's inventory (the whole inventory, offhand and the item on the cursor are swept);
     - at login, the player's ender chest is swept too;
     - a dropped ordinary Eye can't be picked up and is removed.
   - **The message:** "[MINISTRY] Unauthorized Eye of Ender confiscated under the End Lockdown Initiative. Your cooperation has been noted.", at most once every 30 seconds.
   - **Creative players** keep theirs.
3. **Ordinary Eyes can't go into End Portal frames:** "The End is closed. This frame is Ministry property." Unsanctioned Eyes can.
4. **The End is portal-only.**
   - **By portal:** a player who arrives on the End's obsidian platform (within 3 blocks of 100, 50, 0, where the End portal puts everyone) came through a portal, and is let in. That's remembered, so logging out and back in there is fine.
   - **Any other way** (`/home`, `/back`, `/tpa`, `/warp`, Waystones, `/tp`): the player is sent back to where they were (their last position outside the End, recorded every 2 seconds), or else their spawn point, or else world spawn. "[MINISTRY] There is nothing in the End. You have been returned to where you never left."
   - **A login inside the End** without having come through a portal: sent back the same way.
   - **Exempt:** creative and spectator players, and ops (`EXEMPT_OPS`).
   - **Edge case:** a home or Waystone set right on the obsidian platform counts as a portal arrival.

## The Unsanctioned Eye
A vanilla Eye of Ender with a hidden marker (`trollcraft:{unsanctioned:1b}`), the name "Unsanctioned Eye of Ender" in dark red, the lore "Possession is a crime." / "Sold by no one. Bought by no one." and a glint. The marker is what counts: an anvil can't add it, so a renamed Eye is still confiscated.
- **The merchant** sells them for 20 Hush Coins each (`UNSANCTIONED_EYE` in black_market.js):
  - one per click in the shop window;
  - `/bm buy eye <count>` for up to 12 (enough for a portal), and the chat menu has [BUY 1] and [BUY 12].
  - **Each purchase is logged** with its buyer and count, and the Eyes carry its id. `/bm inspect` on a confiscated Eye shows who bought it, for a trial.
- **Ops** can hand them out with `/endlockdown give` (marked as "issued by the Ministry").

## Commands (op level 2)

| Command | |
|---|---|
| `/endlockdown seal [radius]` | Stand in a stronghold portal room: removes the eyes from every End Portal frame within the radius (default 12, at most 32), keeping each frame's direction, and removes portal blocks. |
| `/endlockdown give <player> [count]` | Unsanctioned Eyes (1–64). |

## Settings (top of end_lockdown.js)

| Setting | Default | |
|---|---|---|
| `EXEMPT_CREATIVE` | true | Creative players keep ordinary Eyes and can use them |
| `SWEEP_ENDER_CHEST` | true | Sweep ender chests at login |
| `WARN_COOLDOWN_MS` | 30000 | One confiscation message per player per 30 s |
| `DEFAULT_SEAL_RADIUS` | 12 | |
| `PORTAL_ONLY` | true | The End only through a portal |
| `PLATFORM`, `PLATFORM_RADIUS`, `PLATFORM_Y` | 100.5 / 50 / 0.5, 3, 47–53 | What counts as arriving through the portal |
| `EXEMPT_OPS` | true | Ops aren't sent back |
| `POSITION_SAMPLE_TICKS` | 40 | How often positions outside the End are remembered |
| Names and messages | | `UNSANCTIONED_NAME`, the lore lines, `CONFISCATED_MSG`, `FRAME_BLOCKED_MSG`, `BOUNCED_MSG` |

## Saved data
`persistentData["end_lockdown"]`: the players who came into the End through a portal. Eye purchases are in the black market's data (`eyeBatches`, kept 30 days).

## Test plan (an op and a player in survival)
1. Give yourself ordinary Eyes in several slots and the offhand: all are confiscated, with one message.
2. Put Eyes in your ender chest, log out and in: gone.
3. Drop an ordinary Eye from creative and pick it up in survival: refused, and the item disappears.
4. Click a portal frame with an ordinary Eye: refused. With an Unsanctioned Eye (`/endlockdown give`): it goes in.
5. Buy Eyes at the merchant (window and `/bm buy eye 12`); `/bm inspect` on one shows you as the buyer.
6. Fill a stronghold portal with Unsanctioned Eyes and jump in: you're let in. Log out and in: still there.
7. Set a `/home` in the End, leave through the exit portal, and `/home` back: you're sent back with the Ministry message. The same with `/tpa` to someone in the End.
8. `/endlockdown seal` in the portal room: the frames are empty and the portal is closed.

## What couldn't be verified for KubeJS 6 on 1.20.1
A mock-server test passed all 36 checks: confiscation in every slot, the cursor and the ender chest; the message cooldown; pickups; frames; give; seal; the portal-only rule (homes, logins, the platform, exemptions, falling back to the spawn point, `/reload`); and buying, logging and inspecting Eyes at the merchant. These depend on the real game:
- **Whether `PlayerEvents.inventoryChanged` fires** for every way an Eye arrives (hoppers into a player don't apply; shift-clicking out of a chest does).
- **The cursor and the ender chest:** `player.containerMenu.getCarried()` for the item on the cursor, and `player.enderChestInventory`.
- **Frames:** `BlockEvents.rightClicked` stopping an Eye going into a frame, including from a Create Deployer.
- **The portal-only rule:**
  - FTB Essentials' and Waystones' teleports into the End firing Forge's dimension-change event (factions_hooks.js), which is what the rule listens to;
  - and the End portal placing players at (100, 50, 0).
- **Seal:** `block.properties` and `block.set(id, properties)` for the seal command.
