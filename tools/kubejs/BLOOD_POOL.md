# The Blood Pool (Part II)

**Blood for the Blood God.** In Part II all progression is locked into 12 tiers. The server fills one shared **Blood Pool** by trolling and by giving Hush Coins. When the Pool reaches a tier, an op breaks the Ministry's seal and that tier opens for everyone. See [STORY.md](../../STORY.md).

**Part II only.** It doesn't belong on the Part I server.

## Files

| File | Where it goes | What it does |
|---|---|---|
| `server_scripts/part2/blood_pool.js` | `kubejs/server_scripts/part2/` | The Pool, the tiers and the locks. Settings and the tier lists are at the top |
| `server_scripts/economy/trolls.js` | `kubejs/server_scripts/economy/` | Updated: every logged troll fills the Pool |
| `server_scripts/economy/black_market.js` | (as Part I) | Hush Coins for donations |

Copy them and run `/reload`. The script creates `kubejs/blood_pool_tier.json` by itself (see "Why there's a file").

## Filling the Pool
- **Every troll in the Troll Log** adds its points as Drops: Anonymous Summons 50, Disguised TNT 250, approved reports as set by the admin, and so on. Repeats and revenge are already applied by the Troll Log. Part II has no factions, so there's no cross-faction bonus.
- **Hush Coins:** `/bloodpool donate <coins>` gives coins from your inventory at **1,000 Drops each**.
- **Ops** can `/bloodpool add <drops>` or `/bloodpool set <drops>`.
- **Credit:** every Drop is credited to whoever gave it (`/bloodpool top`), for Part II titles.
- **Part I:** troll points don't count. The Pool starts at 0.

## Tiers and unlocking
| Tier | Name | Drops (total) |
|---|---|---|
| 1 | A Trickle | 10,000 |
| 2 | A Puddle | 30,000 |
| 3 | A Basin | 60,000 |
| 4 | A Font | 100,000 |
| 5 | A Spring | 160,000 |
| 6 | A Stream | 240,000 |
| 7 | A River | 350,000 |
| 8 | A Flood | 500,000 |
| 9 | A Tide | 700,000 |
| 10 | A Sea | 950,000 |
| 11 | An Ocean | 1,200,000 |
| 12 | The Siege | 1,500,000 |

1. **When the Pool reaches a tier,** everyone sees "[BLOOD GOD] The Blood Pool overflows. Tier 3 (A Basin) waits for the Ministry's seal to break." (it goes to Discord too), and ops are told to unlock it. Nothing opens yet.
2. **An op runs `/bloodpool unlock`.** The next tier opens:
   - a title for everyone ("THE BLOOD POOL / Tier 3: A Basin"), a Wither roar and a public line;
   - a second later the server runs **`/reload`**, so the tier's recipes come back (in JEI too).
3. **One tier per unlock.** If donations jump past several tiers, unlock them one at a time.
4. **Tier 12 is the Siege:** it opens the Citadel's Bureaucratic Barrier (`part2/citadel.js`, later).

## What each tier opens (fill in for the Part II modpack)
`TIERS` at the top of `blood_pool.js`, one entry per tier:

```js
{ tier: 5, name: 'A Spring', drops: 160000, unlocks: { mods: ['mekanism', 'mekanismgenerators'], items: ['ae2:charger'], tags: ['forge:ingots/osmium'] } },
```

- **`mods`:** every item, block and recipe of that mod.
- **`items`:** single items. An item listed in an **earlier** tier than its mod can be used from that earlier tier, and its recipe is kept (if the recipe comes from its own mod).
- **`tags`:** item or block tags, without the `#`.
- **Anything not listed** in any tier is always open (vanilla, and every mod you leave out).

PROGRESSION_GATES.md lists each mod's ladder, which is a good guide for which tier a mod belongs in.

## The locks
A sealed thing:
- **can't be crafted:** its recipes are removed, in every kind of machine too. They disappear from JEI.
- **can't be placed.**
- **can't be used:** right-clicking it in the air, on a block or on a mob, and opening its block, are all blocked.
- **does no damage** when you hit with it.
- **can't be worn:** sealed armour moves back into your inventory within 5 seconds, or drops if the inventory is full.

The player sees why on the action bar: "Sealed by the Ministry. The Blood Pool must reach Tier 5 (A Spring)."

**Getting** a sealed item is allowed (loot, trades, mob drops). Players just can't use it yet.

**Ops** can use everything (`OPS_BYPASS`), for building and testing. Set it to `false` to test as a player.

**Things the script can't stop:**
- machines that run on their own (a pipe feeding a sealed item into an open machine);
- abilities on key presses;
- curios and baubles slots.

Keep whole machine mods in one tier to avoid gaps.

### Why there's a file
At server start, recipes load **before** the world and its saved data, so the recipe step can't see the open tier. The tier is therefore also written to **`kubejs/blood_pool_tier.json`**, and the recipe step reads that.
- **The saved data is the authority.** If the two ever disagree, the file is fixed and ops are told to `/reload`.
- **If the file is missing or broken,** every tier's recipes stay removed (nothing opens by accident).
- **Don't edit the file by hand.** Use `/bloodpool settier`.

## Commands

| Command | Who | |
|---|---|---|
| `/bloodpool` | anyone | Drops, the open tier, the next tier and how far off it is (or "ready") |
| `/bloodpool donate <coins>` | players | Give Hush Coins (1,000 Drops each) |
| `/bloodpool top` | anyone | The 10 biggest contributors |
| `/bloodpool tiers` | anyone | Every tier: threshold, what it opens, OPEN / READY / sealed |
| `/bloodpool check` | anyone | Which tier opens the item in your hand |
| `/bloodpool unlock` | op | Open the next tier (it must be ready); announces and reloads |
| `/bloodpool unlock force` | op | Open the next tier even if the Pool isn't there |
| `/bloodpool settier <0-12>` | op | Set the open tier directly, quietly (testing, or undoing a mistake); reloads |
| `/bloodpool add <drops>`, `/bloodpool set <drops>` | op | Adjust the Pool |

## Settings

| Setting | Default | |
|---|---|---|
| `TIERS` | 12 tiers, contents empty | Names, thresholds and what each opens |
| `DROPS_PER_TROLL_POINT` | 1 | |
| `DROPS_PER_COIN` | 1000 | |
| `OPS_BYPASS` | true | Ops can use sealed things |
| `TO_DISCORD` | true | Ready and unlock lines with `tellraw @a` |
| `TIER_FILE` | `kubejs/blood_pool_tier.json` | |
| `RELOAD_DELAY_TICKS` | 20 | Between the unlock announcement and `/reload` |
| `ARMOUR_CHECK_SECONDS` | 5 | |
| `LINES` | | The texts |

## Saved data
- **`persistentData["blood_pool"]`:** the Drops, the open tier, which tiers have been announced as ready, totals by source (trolls, coins, ops), contributors, and every unlock (who, when).
- **`kubejs/blood_pool_tier.json`:** a copy of the open tier, for the recipe step.

## Test plan (an op and a player, with two test tiers filled in)
1. Fill in Tier 1 and Tier 2 (for example a small mod and one item), then `/reload`. `/bloodpool tiers` shows them as sealed, and JEI shows no recipes for them.
2. **As the player** (or with `OPS_BYPASS = false`): try a sealed item and block. Placing, using, opening, hitting and wearing should all be blocked, with the action-bar reason.
3. **Fill to Tier 1:** troll someone (`/trolls log` and `/bloodpool` both go up), then `/bloodpool donate 10`. The ready line appears.
4. **`/bloodpool unlock`:** the title appears, the server reloads, and Tier 1 can be crafted and used. Tier 2 still can't.
5. **Restart the server:** Tier 1 stays open (the file).
6. **`/bloodpool settier 0`** puts everything back.

## What couldn't be verified for KubeJS 6 on 1.20.1
A mock-server test passed 35 checks:
- trolls and donations filling the Pool, credit;
- the ready line at each threshold (not opened);
- unlock, force and settier, the tier file and the reload;
- recipes removed for sealed tiers (mods, items, tags, and an early item kept from its mod's removal), and back after unlocking;
- a missing or out-of-step file;
- place, use, open, hit and wear blocked for sealed things and allowed for open ones;
- ops bypass;
- `/bloodpool`, `check`, `tiers` and `top`;
- `/reload`.

The Troll Log, black market, End Lockdown, ambush, faction and finale tests still pass.

These depend on the real game:
- **Recipe filters with `not`:** `event.remove({ output: '@mod', not: { output: [...] } })`, used only when an item opens before its mod. Check that the early item's recipe really stays.
- **`hasTag` on items and blocks**, for tag-based tiers.
- **Running `reload` from a script.** If it doesn't reload, run `/reload` by hand after unlocking.
- **JsonIO** writing `kubejs/blood_pool_tier.json`. The server log says if it can't.
- **Cancelling `EntityEvents.hurt`** to stop sealed weapons.
- **The armour slots** being 36–39 of the player's inventory.
