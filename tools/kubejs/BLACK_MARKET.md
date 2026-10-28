# Black Market (add-on)

A black market economy:
- Players earn **Blood Coins**, which are real items.
- They spend them at a wandering **Hooded Merchant**.
- They can buy **Ambush Contracts** that send hired killers after a chosen player.

The merchant is neutral and sells to everyone: Crownsworn (`ministry`), Syndicate and Unregistered alike.

Players don't need a modpack update: everything is a vanilla item with custom NBT, a name and lore.

## Files

| File | Where it goes | What it does |
|---|---|---|
| `server_scripts/economy/black_market.js` | `kubejs/server_scripts/economy/` | The whole add-on. All settings are at the top. |
| `server_scripts/factions/portal_ambush.js` | `kubejs/server_scripts/factions/` | Needed: contracts use its mobs. This version adds the `global.PortalAmbush` API the black market calls. |
| `server_scripts/factions/factions_core.js` | `kubejs/server_scripts/factions/` | Needed for factions (friendly fire, coordinate whispers). |

Copy them and run `/reload`; no restart is needed. With no vendor spots set up the merchant never appears, so add one first (see [The merchant](#the-merchant)).

## Blood Coins

- A Blood Coin is a **gold nugget** with hidden NBT (`{trollcraft:{coin:1b}}`), a dark red "Blood Coin" name, the lore "Accepted where questions are not." and the **enchantment glint**. The enchantment, Unbreaking I, is hidden from the tooltip; it only makes the coin shimmer.
- **Only items with that NBT count.** An anvil can't add NBT, so renaming a normal nugget doesn't make a coin. A renamed nugget has no glint either, so a real coin is easy to tell apart.
- Coins stack normally, and can be dropped, stolen, looted and kept in chests. There is no command-only balance.
- **Payment** comes from the main inventory and hotbar only, never from shulker boxes, ender chests or bags.
- **Earning coins:**
  - `/coins give <player> <amount>` (op).
  - **Other scripts**: `global.Economy.giveCoins(player, amount, reason)`. Anything that doesn't fit drops at the player's feet.
  - **Ambush mob drops** (`AMBUSH_COIN_DROPS`, off by default): portal-ambush mobs killed by a player drop 0–2 coins.
- **Things to know:**
  - **Vanilla piglins pick up gold nuggets**, so coins dropped near them can be lost (ambush piglins can't pick anything up).
  - **Crafting:** with `BLOCK_COIN_CRAFTING = true` (the default), vanilla crafting-table recipes only take plain gold nuggets, so coins can't be crafted into gold ingots or golden carrots by accident. Recipes that ask for the gold nugget *tag*, and modded machines, still accept coins.

**The merchant buys nothing from players.** Magical Crops, ProjectE and similar mods make most items farmable, so anything he bought would be an endless coin source.
- `SELL_LIST` at the top of the script can still be filled in, but only with things nobody can farm.
- With entries, a "He buys" section appears in the shop. Plain items only; anything renamed or enchanted is left alone.

## The merchant

- **The entity:** a wandering trader called **Hooded Merchant**, with no AI. He's invulnerable and silent, never despawns, and has no vanilla trades.
  - He can't be hurt, leashed or name-tagged.
  - If he's pushed, he's moved back to his spot within a second.
- **Spots:**
  - from `VENDOR_LOCATIONS` in the script (`{ dim, x, y, z, name }`), plus the ones ops add in game with `/bm vendor addspot <name>`;
  - in names, underscores stand for spaces (`old_crossroads` → "old crossroads").
- **Rotation:**
  - He turns up at a random spot for **90 minutes** (`VENDOR_STAY_MINUTES`), vanishes in a puff of smoke, and appears at a different spot **30 minutes** later (`VENDOR_GONE_MINUTES`).
  - With `NIGHT_ONLY = true`, he only appears during Overworld night.
  - He never appears within 64 blocks of an active Pig Escort portal.
- **Chunk loading:** the chunk he stands in is **forceloaded** while he's there, and the forceload is removed when he leaves.
- **Only one merchant exists at a time:**
  - every copy is removed on start-up and `/reload`;
  - an old copy found later in a chunk is removed as it loads;
  - after a `/reload` or restart within his stay, he reappears at the same spot.
- **Rumors:** when he appears, every online player gets "[RUMOR] A hooded merchant has been seen near *name*." It's sent to each player, so it doesn't reach Discord.
  - `RUMORS_TO_DISCORD = true` sends it with `tellraw @a` instead, which Simple Discord Link posts.
  - `WHISPER_COORDS_TO`, a list of faction ids, also gives those factions' members the exact coordinates.
- **The shop:** right-click him for a clickable chat menu.
  - Every buy and sell is checked on the server: you must be within **6 blocks** of him (`VENDOR_RANGE`), in the same dimension. Otherwise: "The merchant is not here." Typing the commands from home doesn't work.

## Shop

| Item | Price | What it does |
|---|---|---|
| Ambush Contract: Tip-off | 8 | 2 mobs, light-raid strength |
| Ambush Contract: Squad | 20 | 4 mobs, moderate-raid strength |
| Ambush Contract: War Party | 45 | 6–8 mobs, lethal-raid strength (1.5× health, 1.25× damage, Strength I), brutes or vindicators among them, no evokers |
| Writ of Protection | 15 | Turns away the next contract called on you (see below) |
| Custom stock | set by ops | Anything an op adds with `/bm hand add` |

- **Contract strength:** contracts use the health, damage and Strength of portal_ambush.js's `RAID_TIERS`, so balancing stays in one place. Size and mob mix are set per contract in `CONTRACTS`.
- **Heat:**
  - Every contract called on a player adds 1 heat for 24 hours (`HEAT_WINDOW_HOURS`).
  - A contract on them costs `base × (1 + 0.5 × heat)`, rounded up. With 1 heat, a Squad costs 30.
  - The target menu shows each player's price.
- **Buying a contract:**
  - [BUY] opens a second menu of every online player except you. Click a name to buy.
  - Someone offline can be typed: `/blackmarket buy contract squad <name>`, if the server has seen them before.
  - You can't target yourself. Same-faction contracts are allowed (`ALLOW_SAME_FACTION`).

**The contract item** is a skull banner pattern. It can't be placed and stacks to 1, and shows "Ambush Contract (*Tier*)" with a glint.
- Its lore: the target, "Right-click to call it in.", and the expiry date (7 real days, `TOKEN_EXPIRY_DAYS`).
- **The buyer is never on the item.** It's kept only in the server's data, keyed by the contract's id.

## Calling a contract

Hold it and right-click, in the air or on a block. Nothing is placed, and one click counts once.

1. **Void:** a contract whose id is unknown, or already used or refused, is deleted with "This contract is void." That covers a copy made in creative after the original has been used, and one forged with `/give`.
2. **Expired:** after 7 days it turns into a worthless "Void Contract".
3. **Checks:** if any fails, the contract is **not used up**, and the caller gets a short reason that never says where the target is:
   - the black market and Portal Ambush are on, and the world isn't Peaceful;
   - the target is online;
   - the target isn't AFK, meaning they've moved or turned in the last 5 minutes (`AFK_MINUTES`, sampled every 30 s);
   - the target isn't the caller, nor (with `ALLOW_SAME_FACTION = false`) the caller's faction;
   - the target isn't in creative or spectator;
   - the target isn't in a Pig Escort, a portal_ambush safe zone, within 64 blocks of world spawn, or within 64 blocks of the Pig Escort portal;
   - the target isn't already fighting an ambush or raid group;
   - the target isn't on the portal ambush cooldown or the 45-minute contract cooldown (`CONTRACT_COOLDOWN_MINUTES`);
   - the caller is in range of the target, if `MAX_CALL_RANGE` is set;
   - there's room under the server-wide ambush mob cap.
4. **Writ of Protection:** if the target carries one (main inventory, hotbar or offhand), the writ **and** the contract are both used up.
   - The caller gets "The contract was refused. The target was protected."
   - The target is told their writ turned a contract away.
5. **Otherwise:**
   - The target gets **"[CONTRACT] Someone has paid for your death."** with a sound.
   - 3 seconds later the mobs spawn 18–32 blocks away, out of sight where possible.
   - Only once they've spawned is the contract used up and 1 heat added. The caller then gets "Your contract has been called in."
   - If the spawn fails (no safe ground, the target logged off), the contract stays valid and the caller gets "The contract could not be carried out."
   - Nobody else is told anything.

**The mobs:**
- **In the Nether:** Blood-Marked Piglins.
- **Elsewhere:** **Hired Blades**, vindicators and pillagers in **black** leather, so they aren't mistaken for Ministry Inspectors. Their look, gear and reward are in `HIRED_BLADES`.
- **Rules:** they follow every portal ambush rule. They hunt only their target and can't hurt anyone else. They leave after 10 minutes or when the target is gone, drop no vanilla loot, and are tagged `portal_ambush` and `contract_ambush`.

**Outcome** (sent to the buyer, or kept for their next login):
- The target is killed by a contract mob: **"[CONTRACT] Contract fulfilled."** Listeners registered with `global.Economy.onContractFulfilled(fn)` get `fn(buyerUuid, targetUuid, contractId)`; that's the hook for future faction points.
- The group ends any other way: **"[CONTRACT] The target survived."**
- The group was ended by `/reload`, a restart or `/ambush clear`: **"[CONTRACT] The contract was interrupted."** The contract isn't returned.

**After a contract:** the target gets the 45-minute contract cooldown, plus portal_ambush's usual 10-minute cooldown when the group ends. Contracts check both.

## Custom stock (op only)

Ops can sell **any item exactly as it is**, NBT included, for example an item that runs a command when right-clicked:

- **`/bm hand add <price> [stock]`:** sells the item in your main hand, with its whole stack (count and full NBT), for `<price>` coins.
  - The stock (optional) is how many can be sold before it disappears; the default is unlimited.
  - The black market only stores and hands out the item. It never runs anything from its NBT.
  - **Refused:** an empty hand, a price below 1, and Blood Coins, contracts and writs.
  - **Allowed with a warning:** shulker boxes and bundles, whose contents are sold with them.
- **`/bm hand list`:** the entries, each with a [REMOVE] button. `/bm hand remove <id>` and `/bm hand price <id> <price>` change them.
- **In the shop:** custom stock has its own section. Hovering shows the item's real tooltip.
- **Buying:** the buy command only carries the entry's id; the server looks up the item and price itself. You must be at the merchant.
- **Saved:** entries are kept with the world and survive restarts and `/reload`.

## Commands

`/bm` works everywhere `/blackmarket` does.

| Command | Who | |
|---|---|---|
| `/blackmarket shop` | anyone at the merchant | Opens the shop menu (same as right-clicking him) |
| `/blackmarket buy contract <tier> [player]`, `buy writ`, `buy custom <id>`, `sell <item>` | anyone at the merchant | What the menu buttons run. Tiers: `tipoff`, `squad`, `warparty`. `sell` only works if `SELL_LIST` has entries. |
| `/blackmarket inspect` | op | While holding a contract: target, **buyer's name** (even if they're offline), tier, issue date, status. For Ministry trials: a confiscated contract proves who ordered the hit. |
| `/blackmarket contracts` | op | The 20 most recent contracts: id, tier, target, buyer, status |
| `/blackmarket heat <player> [reset]` | op | Their heat and contract cooldown, or reset the heat |
| `/blackmarket test contract <tier> <player>` | op | A free contract, no merchant needed |
| `/blackmarket vendor spawn [location]`, `move`, `remove`, `where` | op | Put him out now (at a spot, or a random one), move him, send him away, see where he is |
| `/blackmarket vendor addspot <name>`, `delspot <name>`, `spots` | op | Add a spot where you stand, remove a saved spot, list all spots |
| `/blackmarket toggle` | op | Open or close the black market (data is kept; the merchant leaves) |
| `/bm hand add <price> [stock]`, `list`, `remove <id>`, `price <id> <price>` | op | Custom stock |
| `/coins give\|take <player> <amount>`, `/coins check <player>` | op | Coins in a player's main inventory and hotbar |

## Saved data

Everything is in `persistentData["economy"]` as one JSON string:
- contracts (with buyer, buyer name, target and status);
- heat;
- contract cooldowns;
- the merchant's state and saved spots;
- notices waiting for the next login;
- custom stock.

Logging out, `/reload` and restarts never reset a cooldown or reuse a contract id. Finished contracts and old notices are pruned after 30 days.

## Settings (top of black_market.js)

| Setting | Default | |
|---|---|---|
| `ALLOW_SAME_FACTION` | true | Contracts on your own faction |
| `MAX_CALL_RANGE` | 0 | 0 = any distance; otherwise the caller must be this close to the target, in the same dimension |
| `BLOCK_COIN_CRAFTING` | true | Coins can't be used in vanilla crafting recipes |
| `AMBUSH_COIN_DROPS` | off, 0–2 | Coins from portal-ambush mobs killed by players |
| `SELL_LIST` | none | What the merchant buys from players (keep it to things nobody can farm) |
| `VENDOR_LOCATIONS` | none | Spots in the script (or use `/bm vendor addspot`) |
| `VENDOR_STAY_MINUTES` / `VENDOR_GONE_MINUTES` | 90 / 30 | His rotation |
| `NIGHT_ONLY` | false | Only at Overworld night |
| `VENDOR_RANGE` | 6 | How close you must be to trade |
| `RUMORS_TO_DISCORD` | false | Rumors with `tellraw @a`, which Simple Discord Link posts |
| `WHISPER_COORDS_TO` | none | Factions that get his exact coordinates |
| `CONTRACTS` | tipoff 8, squad 20, warparty 45 | Price, size, raid tier and mob mix per contract |
| `WRIT_PRICE` | 15 | |
| `TOKEN_EXPIRY_DAYS` | 7 | |
| `CONTRACT_COOLDOWN_MINUTES` | 45 | |
| `HEAT_WINDOW_HOURS` / `HEAT_PRICE_STEP` | 24 / 0.5 | |
| `AFK_MINUTES` | 5 | |
| `HIRED_BLADES` | black leather vindicators and pillagers | The look of contract mobs outside the Nether |

## Test plan (two accounts in survival: A buys, B is the target)

**Before you start:**
- A op account can also be A.
- Stand somewhere at least 64 blocks from world spawn and run `/bm vendor addspot test_spot`, then `/bm vendor spawn test_spot`.
- Give A coins with `/coins give A 200`.

1. **The merchant:**
   - he appears with a rumor for everyone, which names the spot but gives no coordinates;
   - push him and he slides back;
   - hit him and nothing happens;
   - right-click him and the shop opens, with no trade screen.
2. **Range:** walk 10 blocks away and click a [BUY] button, or type `/bm buy writ`: "The merchant is not here." Go back and it works.
3. **Counterfeits:** rename a plain gold nugget "Blood Coin" on an anvil and try to pay with only that. It's refused.
4. **Buying a contract:** [BUY] on Squad lists B with a price. Click B: 20 coins are taken and a contract appears. Hover over it: the buyer isn't shown anywhere.
5. **Using it:**
   - A right-clicks, once in the air and once on a block. Nothing is placed, and each click counts once.
   - B gets "Someone has paid for your death." and A gets nothing yet.
   - 3 s later, 4 Hired Blades in black chestplates arrive around B. They aren't gold Ministry Inspectors.
   - A's contract is gone and A gets "Your contract has been called in."
   - Nobody else sees anything.
6. **Not used up:** with a fresh contract each time (`/bm test contract tipoff B`), the contract stays in A's hand and A gets a short reason when B:
   - is offline;
   - hasn't moved or turned for 5 minutes;
   - is near world spawn or another safe zone;
   - is in a Pig Escort;
   - is on cooldown (straight after test 5).
7. **Spawn failure:** right-click a contract, and B logs off within 3 seconds. A gets "The contract could not be carried out." and keeps the contract.
8. **Writ:** B buys or gets a Writ of Protection, then A calls a contract on B. Both items are used up; A gets "refused… protected" and B is told.
9. **Dupes and forgeries:**
   - in creative, copy a contract (middle-click), then use the original;
   - the copy then says "This contract is void." and disappears;
   - a contract made with `/give` and invented NBT is void too.
10. **Heat:** after a contract is called on B, the target menu shows B at 30 for a Squad.
11. **Inspect:** an op holds A's contract and runs `/bm inspect`. It shows A as the buyer, also while A is offline.
12. **Outcomes:**
    - let the mobs kill B: A gets "Contract fulfilled." (or on their next login);
    - kill all the mobs: "The target survived.";
    - `/reload` while a contract's mobs are out: "The contract was interrupted."
13. **Custom stock:**
    - hold an item with a name, lore and command-running NBT, and run `/bm hand add 10`;
    - the shop shows it with its real tooltip;
    - B buys it: B gets an exact copy whose right-click still runs the command, and 10 coins are taken;
    - restart the server: it's still for sale;
    - `/bm hand add` with an empty hand, a coin, a contract or a writ is refused, and a non-op can't use `/bm hand`;
    - try `/bm hand price`, `/bm hand remove`, and `/bm hand add 5 1`, which sells once and then disappears.
14. **Rotation:** `/bm vendor where`, then `/bm vendor move`. He vanishes in smoke and appears at another spot, if you have two.

## What couldn't be verified for KubeJS 6 on 1.20.1

A mock-server test passed all 85 checks: coins, the merchant, the shop, range, contracts and every refusal, the writ, dupes and forgeries, heat, outcomes, `/reload`, custom stock, selling (refused by default; working when SELL_LIST has entries) and the rotation. These parts depend on the real game:

- **The shop menu:**
  - whether the clickable chat menu opens on the first right-click, and `ItemEvents.entityInteracted` cancelling the wandering trader's trade screen;
  - whether `show_item` hovers display custom stock's NBT tooltip (they're built from the stored SNBT).
- **The `/bm` alias** (Brigadier `redirect` to `/blackmarket`).
- **Right-clicking:** `ItemEvents.rightClicked` and `BlockEvents.rightClicked` both firing for one click on a block. It's handled once either way.
- **Inventory calls:** `player.give` dropping what doesn't fit, and `player.inventory.getItem` slot numbers (0–35 main and hotbar, 40 offhand).
- **The summon:** the vendor NBT (`NoAI`, `DespawnDelay:0`, `Offers:{Recipes:[]}`) and forceloading before he's summoned.
- **Contract hookups:**
  - offline names through `server.getProfileCache().get(name)`;
  - `event.source.actual` on a player's death, which is how a contract is marked fulfilled.
- **`BLOCK_COIN_CRAFTING`:** `Ingredient.custom` inside `replaceInput` for vanilla crafting recipes. It uses the same `Ingredient.custom` as `enchanted_porkchop.js`. If it fails, an error is logged and coins can still be crafted. Nothing else is affected.
