#!/usr/bin/env python3
"""Show how many of each item every player has crafted, placed and broken, from the world's stats files.

Usage:
    python3 player_item_stats.py <stats> [usercache.json] [--items id1,id2,...]

<stats> can be the world/stats folder or a .zip containing it.
usercache.json (from the server's main folder) turns UUIDs into player names; without it UUIDs are shown.
--items defaults to the three ProjectE Energy Collectors.

Notes:
  - "Crafted" counts crafting by hand (crafting table / inventory). It does not count items made by
    autocrafting (AE2, etc.), transmuted from EMC, given with /give, or picked up.
  - "Placed" minus "Broken" is roughly how many that player still has down in the world
    (it can't see blocks someone else broke, or ones moved by other mods).
  - Upgrading MK1 -> MK2 -> MK3 uses up the lower tier, so a crafted MK1 may now be an MK2 or MK3.
"""
import json
import os
import sys
import zipfile

DEFAULT_ITEMS = ["projecte:collector_mk1", "projecte:collector_mk2", "projecte:collector_mk3"]


def load_names(path):
    if not path:
        return {}
    with open(path, encoding="utf-8") as fh:
        return {entry["uuid"]: entry["name"] for entry in json.load(fh)}


def stats_files(path):
    """Yield (uuid, parsed json) for every <uuid>.json stats file."""
    if zipfile.is_zipfile(path):
        with zipfile.ZipFile(path) as z:
            for name in z.namelist():
                base = os.path.basename(name)
                if base.endswith(".json") and len(base) == 41:  # <36-char uuid>.json
                    yield base[:-5], json.loads(z.read(name))
        return
    for name in os.listdir(path):
        if name.endswith(".json") and len(name) == 41:
            with open(os.path.join(path, name), encoding="utf-8") as fh:
                yield name[:-5], json.load(fh)


def main(argv):
    items = DEFAULT_ITEMS
    if "--items" in argv:
        i = argv.index("--items")
        items = [s.strip() for s in argv[i + 1].split(",") if s.strip()]
        argv = argv[:i] + argv[i + 2:]
    if not argv:
        print(__doc__)
        return 1
    names = load_names(argv[1] if len(argv) > 1 else None)

    rows = []
    for uuid, data in stats_files(argv[0]):
        stats = data.get("stats", {})
        counts = {}
        for item in items:
            crafted = stats.get("minecraft:crafted", {}).get(item, 0)
            placed = stats.get("minecraft:used", {}).get(item, 0)
            broken = stats.get("minecraft:mined", {}).get(item, 0)
            if crafted or placed or broken:
                counts[item] = (crafted, placed, broken)
        if counts:
            rows.append((names.get(uuid, uuid), counts))

    if not rows:
        print("Nobody has crafted, placed or broken any of: " + ", ".join(items))
        return 0

    for player, counts in sorted(rows, key=lambda r: r[0].lower()):
        print("\n" + player)
        for item in items:
            if item in counts:
                crafted, placed, broken = counts[item]
                print("  %-34s crafted %4d   placed %4d   broken %4d   (still placed ~%d)"
                      % (item, crafted, placed, broken, max(0, placed - broken)))
    return 0


if __name__ == "__main__":
    sys.exit(main(sys.argv[1:]))
