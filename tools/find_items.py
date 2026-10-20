#!/usr/bin/env python3
"""Find every copy of an item or block in a Minecraft 1.20.1 world: placed, stored, carried or dropped.

Usage:
    python3 find_items.py <world folder or .zip> [usercache.json] [--items id1,id2,...]

--items defaults to the three ProjectE Energy Collectors.
usercache.json (from the server's main folder) turns player UUIDs into names.

What it reads:
  - region/*.mca     placed blocks (with coordinates) and block-entity inventories
                     (chests, barrels, Iron Chests, Create vaults, shulker boxes inside chests, ...)
  - entities/*.mca   dropped items, item frames, chest minecarts, mobs holding items
  - playerdata/*.dat player inventories, ender chests, Curios slots, ProjectE Alchemical Bags
  - any other .dat   e.g. world/data and mod save files
  - AE2 storage cells (best effort: items stored inside drives / chests / inventories)
for the Overworld, Nether, End and modded dimensions.

It also lists "mentions": places the item ID appears without being an actual item stack,
such as a player's ProjectE transmutation knowledge or an AE2 pattern. Those aren't counted.

Stop the server (or use a copy of the world) so the files are up to date. Only needs Python 3.
"""
import gzip
import json
import os
import re
import struct
import sys
import zipfile
import zlib
from collections import defaultdict

DEFAULT_ITEMS = ["projecte:collector_mk1", "projecte:collector_mk2", "projecte:collector_mk3"]


# --- NBT reader -----------------------------------------------------------

def read_nbt(buf):
    pos = 0

    def take(n):
        nonlocal pos
        out = buf[pos:pos + n]
        pos += n
        return out

    def read_str():
        (n,) = struct.unpack(">H", take(2))
        return take(n).decode("utf-8", "replace")

    def payload(tag):
        if tag == 1:
            return struct.unpack(">b", take(1))[0]
        if tag == 2:
            return struct.unpack(">h", take(2))[0]
        if tag == 3:
            return struct.unpack(">i", take(4))[0]
        if tag == 4:
            return struct.unpack(">q", take(8))[0]
        if tag == 5:
            return struct.unpack(">f", take(4))[0]
        if tag == 6:
            return struct.unpack(">d", take(8))[0]
        if tag == 7:
            (n,) = struct.unpack(">i", take(4))
            return take(n)
        if tag == 8:
            return read_str()
        if tag == 9:
            sub, n = struct.unpack(">bi", take(5))
            return [payload(sub) for _ in range(max(n, 0))]
        if tag == 10:
            out = {}
            while True:
                (t,) = struct.unpack(">b", take(1))
                if t == 0:
                    return out
                name = read_str()
                out[name] = payload(t)
        if tag == 11:
            (n,) = struct.unpack(">i", take(4))
            return list(struct.unpack(">%di" % n, take(4 * n)))
        if tag == 12:
            (n,) = struct.unpack(">i", take(4))
            return list(struct.unpack(">%dq" % n, take(8 * n)))
        raise ValueError("unknown NBT tag %d" % tag)

    (root,) = struct.unpack(">b", take(1))
    read_str()
    return payload(root)


def decompress_dat(data):
    if data[:2] == b"\x1f\x8b":
        return gzip.decompress(data)
    try:
        return zlib.decompress(data)
    except zlib.error:
        return data


def region_chunks(data):
    """Yield the raw (decompressed) NBT bytes of every chunk in a region file."""
    if len(data) < 8192:
        return
    for i in range(1024):
        offset = int.from_bytes(data[i * 4:i * 4 + 3], "big")
        if offset == 0:
            continue
        start = offset * 4096
        if start + 5 > len(data):
            continue
        length, comp = struct.unpack(">iB", data[start:start + 5])
        raw = data[start + 5:start + 4 + length]
        try:
            if comp == 1:
                yield gzip.decompress(raw)
            elif comp == 2:
                yield zlib.decompress(raw)
            elif comp == 3:
                yield raw
        except Exception as e:
            print("  ! skipped a damaged chunk: %s" % e, file=sys.stderr)


# --- Results --------------------------------------------------------------

class Results:
    def __init__(self, items):
        self.items = items
        self.placed = defaultdict(list)     # item -> [(dimension, x, y, z)]
        self.stored = defaultdict(list)     # item -> [(count, where)]
        self.mentions = defaultdict(list)   # item -> [where]

    def add_stack(self, item, count, where):
        self.stored[item].append((count, where))


def walk_items(node, res, where, path=""):
    """Count item stacks of the target items anywhere inside an NBT structure."""
    if isinstance(node, dict):
        item_id = node.get("id")
        if isinstance(item_id, str) and item_id in res.items and "Count" in node:
            res.add_stack(item_id, node["Count"], where)
        # AE2 storage cell contents: parallel lists of keys and amounts
        keys, amts = node.get("keys"), node.get("amts")
        if isinstance(keys, list) and isinstance(amts, list) and len(keys) == len(amts):
            for key, amt in zip(keys, amts):
                if isinstance(key, dict) and key.get("id") in res.items:
                    res.add_stack(key["id"], amt, where + " [AE2 storage cell]")
        for k, v in node.items():
            if k in ("keys", "amts"):
                continue
            walk_items(v, res, where, path + "/" + k)
    elif isinstance(node, list):
        for v in node:
            walk_items(v, res, where, path)
    elif isinstance(node, str) and node in res.items:
        if not path.endswith("/id"):
            res.mentions[node].append(where + "  (" + path.lstrip("/") + ")")


def count_placed(chunk, res, dim):
    """Find target blocks in a chunk's block palettes and work out their coordinates."""
    cx, cz = chunk.get("xPos", 0), chunk.get("zPos", 0)
    for section in chunk.get("sections", []):
        states = section.get("block_states", {})
        palette = states.get("palette", [])
        wanted = {i: p.get("Name") for i, p in enumerate(palette) if p.get("Name") in res.items}
        if not wanted:
            continue
        sy = section.get("Y", 0)
        data = states.get("data")
        if not data:  # single-block section: palette has one entry, no data array
            for name in wanted.values():
                for idx in range(4096):
                    res.placed[name].append((dim, cx * 16 + (idx & 15), sy * 16 + (idx >> 8), cz * 16 + ((idx >> 4) & 15)))
            continue
        bits = max(4, (len(palette) - 1).bit_length())
        per_long = 64 // bits
        mask = (1 << bits) - 1
        for idx in range(4096):
            word = data[idx // per_long] & 0xFFFFFFFFFFFFFFFF
            value = (word >> ((idx % per_long) * bits)) & mask
            if value in wanted:
                res.placed[wanted[value]].append(
                    (dim, cx * 16 + (idx & 15), sy * 16 + (idx >> 8), cz * 16 + ((idx >> 4) & 15)))


# --- Reading the world ----------------------------------------------------

def dimension_of(path):
    p = path.replace("\\", "/")
    m = re.search(r"dimensions/([^/]+)/([^/]+)/(region|entities)/", p)
    if m:
        return m.group(1) + ":" + m.group(2)
    if "DIM-1/" in p:
        return "minecraft:the_nether"
    if "DIM1/" in p:
        return "minecraft:the_end"
    return "minecraft:overworld"


def process_file(name, data, res, names, needles):
    p = name.replace("\\", "/")
    folder = p.split("/")[-2] if "/" in p else ""
    base = os.path.basename(p)

    if p.endswith(".mca") and folder in ("region", "entities"):
        dim = dimension_of(p)
        for raw in region_chunks(data):
            if not any(n in raw for n in needles):
                continue  # fast skip: no target ID anywhere in this chunk
            chunk = read_nbt(raw)
            if folder == "region":
                count_placed(chunk, res, dim)
                for be in chunk.get("block_entities", []):
                    where = "%s %s at %s %s %s" % (dim, be.get("id", "?"), be.get("x"), be.get("y"), be.get("z"))
                    walk_items(be, res, where)
            else:
                for ent in chunk.get("Entities", []):
                    pos = ent.get("Pos", [0, 0, 0])
                    where = "%s %s at %d %d %d" % (dim, ent.get("id", "?"), pos[0], pos[1], pos[2])
                    walk_items(ent, res, where)
        return

    if p.endswith((".dat", ".nbt")):
        raw = decompress_dat(data)
        if not any(n in raw for n in needles):
            return
        try:
            root = read_nbt(raw)
        except Exception as e:
            print("  ! couldn't read %s: %s" % (p, e), file=sys.stderr)
            return
        if folder == "playerdata" and len(base) == 40:  # <uuid>.dat
            uuid = base[:-4]
            who = "player " + names.get(uuid, uuid)
            for key, value in root.items():
                walk_items(value, res, who + " / " + key)
        else:
            walk_items(root, res, "file " + p)


def scan(path, res, names):
    needles = [i.encode() for i in res.items]
    if zipfile.is_zipfile(path):
        with zipfile.ZipFile(path) as z:
            for name in z.namelist():
                if name.endswith((".mca", ".dat", ".nbt")):
                    process_file(name, z.read(name), res, names, needles)
        return
    for root, _, files in os.walk(path):
        for f in files:
            if f.endswith((".mca", ".dat", ".nbt")):
                full = os.path.join(root, f)
                with open(full, "rb") as fh:
                    process_file(os.path.relpath(full, path), fh.read(), res, names, needles)


# --- Output ---------------------------------------------------------------

def report(res):
    for item in res.items:
        placed = res.placed.get(item, [])
        stored = res.stored.get(item, [])
        total_stored = sum(c for c, _ in stored)
        print("\n" + "=" * 70)
        print("%s:  %d placed,  %d in inventories/containers" % (item, len(placed), total_stored))
        print("=" * 70)
        if placed:
            print("  Placed:")
            for dim, x, y, z in sorted(placed):
                print("    %s  %d %d %d" % (dim, x, y, z))
        if stored:
            print("  Stored / carried:")
            by_place = defaultdict(int)
            for count, where in stored:
                by_place[where] += count
            for where, count in sorted(by_place.items()):
                print("    %4d  %s" % (count, where))
        mentions = res.mentions.get(item, [])
        if mentions:
            print("  Mentioned (not counted - e.g. ProjectE knowledge, AE2 patterns, filters):")
            for m in sorted(set(mentions)):
                print("          " + m)
        if not (placed or stored or mentions):
            print("  None found.")


def main(argv):
    items = DEFAULT_ITEMS
    if "--items" in argv:
        i = argv.index("--items")
        items = [s.strip() for s in argv[i + 1].split(",") if s.strip()]
        argv = argv[:i] + argv[i + 2:]
    if not argv:
        print(__doc__)
        return 1
    names = {}
    if len(argv) > 1:
        with open(argv[1], encoding="utf-8") as fh:
            names = {e["uuid"]: e["name"] for e in json.load(fh)}
    res = Results(set(items))
    scan(argv[0], res, names)
    res.items = items  # keep the requested order for the report
    report(res)
    return 0


if __name__ == "__main__":
    sys.exit(main(sys.argv[1:]))
