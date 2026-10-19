#!/usr/bin/env python3
"""List every Nether portal recorded in a Minecraft world's POI files.

Usage:
    python3 find_portals.py [--dim minecraft:the_nether] <path> [<path> ...]

Each <path> can be:
  - a single POI region file (r.X.Z.mca)
  - a poi folder (world/poi, world/DIM-1/poi)
  - a whole world folder (scans world/poi and world/DIM-1/poi)
  - a .zip of any of the above

The dimension is worked out from the folder (DIM-1 = Nether). For a loose r.X.Z.mca file
with no folder around it, pass --dim to say which dimension it came from.

Only needs Python 3, no extra packages. Run it on a copy of the world, or with the server stopped.
"""
import gzip
import io
import os
import re
import struct
import sys
import zipfile
import zlib
from collections import deque

PORTAL_TYPE = "minecraft:nether_portal"
FORCED_DIM = None


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

    def read_payload(tag):
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
            return [read_payload(sub) for _ in range(max(n, 0))]
        if tag == 10:
            out = {}
            while True:
                (t,) = struct.unpack(">b", take(1))
                if t == 0:
                    return out
                name = read_str()
                out[name] = read_payload(t)
        if tag == 11:
            (n,) = struct.unpack(">i", take(4))
            return list(struct.unpack(">%di" % n, take(4 * n)))
        if tag == 12:
            (n,) = struct.unpack(">i", take(4))
            return list(struct.unpack(">%dq" % n, take(8 * n)))
        raise ValueError("unknown NBT tag %d" % tag)

    (root_tag,) = struct.unpack(">b", take(1))
    read_str()
    return read_payload(root_tag)


# --- Region (.mca) reader -------------------------------------------------

def chunks_in_region(data):
    if len(data) < 8192:
        return
    for i in range(1024):
        entry = data[i * 4:i * 4 + 4]
        offset = int.from_bytes(entry[:3], "big")
        if offset == 0:
            continue
        start = offset * 4096
        if start + 5 > len(data):
            continue
        length, comp = struct.unpack(">iB", data[start:start + 5])
        raw = data[start + 5:start + 4 + length]
        try:
            if comp == 1:
                yield read_nbt(gzip.decompress(raw))
            elif comp == 2:
                yield read_nbt(zlib.decompress(raw))
            elif comp == 3:
                yield read_nbt(raw)
            # 4 (LZ4) and 128+ (external .mcc) are not used for POI data in 1.20.1
        except Exception as e:  # skip a corrupt chunk instead of failing the whole run
            print("  ! skipped a chunk: %s" % e, file=sys.stderr)


def portal_blocks(region_bytes):
    for chunk in chunks_in_region(region_bytes):
        for section in chunk.get("Sections", {}).values():
            for rec in section.get("Records", []):
                if rec.get("type") == PORTAL_TYPE:
                    yield tuple(rec["pos"])


# --- Input handling -------------------------------------------------------

def dimension_for(path):
    if FORCED_DIM:
        return FORCED_DIM
    p = path.replace("\\", "/")
    if "DIM-1/" in p or "the_nether" in p:
        return "minecraft:the_nether"
    if "DIM1/" in p or "the_end" in p:
        return "minecraft:the_end"
    m = re.search(r"dimensions/([^/]+)/([^/]+)/poi/", p)
    if m:
        return "%s:%s" % (m.group(1), m.group(2))
    return "minecraft:overworld"


def is_poi_region(name):
    n = name.replace("\\", "/")
    return n.endswith(".mca") and ("/poi/" in "/" + n or os.path.basename(n).startswith("r."))


def collect(path, found):
    if zipfile.is_zipfile(path):
        with zipfile.ZipFile(path) as z:
            names = [n for n in z.namelist() if n.endswith(".mca")]
            poi_names = [n for n in names if "/poi/" in "/" + n] or names
            for n in poi_names:
                for b in portal_blocks(z.read(n)):
                    found.setdefault(dimension_for(n), set()).add(b)
        return
    if os.path.isdir(path):
        for root, _, files in os.walk(path):
            in_poi = os.path.basename(root) == "poi"
            for f in files:
                if f.endswith(".mca") and (in_poi or os.path.basename(path) == "poi"):
                    full = os.path.join(root, f)
                    with open(full, "rb") as fh:
                        for b in portal_blocks(fh.read()):
                            found.setdefault(dimension_for(full + "/"), set()).add(b)
        return
    with open(path, "rb") as fh:
        for b in portal_blocks(fh.read()):
            found.setdefault(dimension_for(path), set()).add(b)


# --- Group blocks into portals --------------------------------------------

def group(blocks):
    left = set(blocks)
    portals = []
    while left:
        start = left.pop()
        comp = [start]
        q = deque([start])
        while q:
            x, y, z = q.popleft()
            for dx, dy, dz in ((1, 0, 0), (-1, 0, 0), (0, 1, 0), (0, -1, 0), (0, 0, 1), (0, 0, -1)):
                n = (x + dx, y + dy, z + dz)
                if n in left:
                    left.remove(n)
                    comp.append(n)
                    q.append(n)
        portals.append(comp)
    return portals


def main(argv):
    global FORCED_DIM
    if "--dim" in argv:
        i = argv.index("--dim")
        FORCED_DIM = argv[i + 1]
        argv = argv[:i] + argv[i + 2:]
    if not argv:
        print(__doc__)
        return 1
    found = {}
    for p in argv:
        collect(p, found)

    total = 0
    for dim in sorted(found):
        portals = group(found[dim])
        portals.sort(key=lambda c: (min(b[0] for b in c), min(b[2] for b in c)))
        total += len(portals)
        print("\n=== %s: %d portal(s) ===" % (dim, len(portals)))
        for i, comp in enumerate(portals, 1):
            xs, ys, zs = zip(*comp)
            bottom = min(comp, key=lambda b: (b[1], b[0], b[2]))
            axis = "x" if len(set(xs)) > 1 else "z"
            print("%3d. %4d blocks  axis=%s  from (%d %d %d) to (%d %d %d)"
                  % (i, len(comp), axis, min(xs), min(ys), min(zs), max(xs), max(ys), max(zs)))
            print("     tp:     /execute in %s run tp @s %d %d %d" % (dim, bottom[0], bottom[1], bottom[2]))
            print("     remove: /execute in %s run setblock %d %d %d minecraft:air" % (dim, *bottom))
    print("\nTotal: %d portal(s)" % total)
    if total == 0:
        print("No portals found. Check you pointed it at a poi folder or r.X.Z.mca file from inside one.")
    return 0


if __name__ == "__main__":
    sys.exit(main(sys.argv[1:]))
