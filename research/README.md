# Blood Pool tier research (Part II)

Read-only research for the 12 Blood Pool tiers in
`tools/kubejs/server_scripts/part2/blood_pool.js`. **Nothing here has been applied** — no server file,
pack file or script was changed.

Built on 2026-11-01 from the Part II jar set in the owner's Server Mods folder
(207 jars, 591 MB), plus the pack repo `waxerhub/Trollcraft-III-modlist` at branch
`claude/adoring-faraday-5kooyt`. Jars were opened read-only, only `data/**` and `META-INF/mods.toml`
were extracted, and nothing from them was executed.

| File | What it is |
|---|---|
| [TIER_PROPOSAL.md](TIER_PROPOSAL.md) | **The answer.** The 12 tiers at the doubled thresholds, tier-by-tier reasoning, the recipe-id lists, what is left unlocked, the twelve judgement calls (§5), the things the jars cannot answer (§6), and the **Potato Tithe** spec and code (§7) |
| [TIERS.snippet.js](TIERS.snippet.js) | The same `TIERS` array, paste-ready, syntax-checked for KubeJS 6 / Rhino (no template strings, no spread, single quotes) |
| [01_INDEX.md](01_INDEX.md) | Pass 1 — the mod inventory, counts, recipe types, and the finding that `unlocks.mods` matches **namespaces**, not Forge mod ids |
| [02_LADDERS.md](02_LADDERS.md) | Pass 2 — each mod's item ladder and the right lockable handle for it |
| [03_BYPASSES.md](03_BYPASSES.md) | Pass 3 — every cross-mod route, loot leak and recipe-id lever, with the ids |
| `index/` | The machine-readable index (gzipped TSV). Regenerate the `_resolved` views with `perl tools/resolve.pl research/index` |
| `tools/` | `Indexer.java` (the indexer), `resolve.pl` (tag flattening), `q.sh` (queries) |

## Three things to read first

1. **`unlocks.mods` entries are namespaces.** The whole Thermal Series is one namespace, **`thermal`**;
   `mods: ['thermal_foundation']` would lock nothing. See `01_INDEX.md`.
2. **Mystical Agriculture is the biggest bypass in the pack** — 312 essence recipes producing items in 26
   namespaces, including all four AE2 presses, Terrasteel, Draconium, Manyullyn and all four Twilight
   Forest boss metals. It needs recipe-id locks, not a tier. See `03_BYPASSES.md` §1 and
   `TIER_PROPOSAL.md` §3a.
3. **No loot table in the pack hands out a machine tier** — checked across 1,906 rows of non-block loot.
   The worry in the brief does not materialise. See `03_BYPASSES.md` §6.

**Three owner decisions are already in:** the Pool thresholds are **doubled** (20,000 → 3,000,000,
contents unchanged); potatoes can be tithed into the Pool at **4,000 potatoes = 1,000 Drops**; and the
tithe is **capped at 30,000 Drops/day** server-wide. `TIER_PROPOSAL.md` §7 has the command, the code, the
throughput numbers the cap is sized against, and the two alternatives to a cap. Net effect: the arc is
bounded at **8 weeks at the fastest and ~17 weeks if nobody farms**, so §1's schedule is a real floor and
ceiling rather than an estimate.

Nothing in the proposal is left as a question to you. `TIER_PROPOSAL.md` §5 lists every judgement call —
where the Infusion Altar sits, whether the Timewood Core stays on, what to do about the nuke, where the
Nether and End locks attach — with the one edit that overrules each. §6 is the shorter list of things only
the running server can answer: four JEI/config checks and one dragon kill.

## Querying the index

```bash
bash research/tools/q.sh makes tconstruct:cobalt_ingot   # every route to an item, cross-mod included
bash research/tools/q.sh uses  mekanism:steel_casing     # everything that consumes it
bash research/tools/q.sh outns thermal                   # every recipe that outputs a thermal item
bash research/tools/q.sh tag   forge:ingots/steel        # tag members
bash research/tools/q.sh loot  draconicevolution:dragon_heart
```
