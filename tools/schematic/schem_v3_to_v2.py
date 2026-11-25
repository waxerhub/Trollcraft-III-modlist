"""Convert a Sponge v3 .schem (saved by WorldEdit 7.3+ on Minecraft 1.20.5+) into a Sponge v2 .schem that
WorldEdit 7.2 on Minecraft 1.20.1 can load. Fixes the error "Schematic file is missing a "Version" tag".

Usage:
    python3 schem_v3_to_v2.py <input.schem> <output.schem>

It renames blocks that changed name after 1.20.1 (short_grass -> grass), removes block properties 1.20.1
doesn't have, and converts container items back to the 1.20.1 format. Anything it had to drop is listed.
Blocks that only exist in newer versions are listed too; they'll be missing when pasted.
Only needs Python 3.
"""
import gzip, os, sys, collections
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import nbt
from nbt import Tag, BYTE, SHORT, INT, STRING, LIST, COMPOUND, BYTE_ARRAY, INT_ARRAY

BLOCK_RENAMES = {'minecraft:short_grass': 'minecraft:grass'}           # renamed in 1.20.3
REMOVED_PROPERTIES = {'minecraft:decorated_pot': {'cracked'}}          # added in 1.20.3
DATA_VERSION_1201 = 3465

def varints(data):
    out, val, shift = [], 0, 0
    for b in data:
        val |= (b & 0x7F) << shift
        if b & 0x80: shift += 7
        else: out.append(val); val, shift = 0, 0
    return out

def to_varints(values):
    out = bytearray()
    for v in values:
        while True:
            b = v & 0x7F; v >>= 7
            if v: out.append(b | 0x80)
            else: out.append(b); break
    return out

def fix_state(state):
    block, _, props = state.partition('[')
    block = BLOCK_RENAMES.get(block, block)
    if props:
        props = props.rstrip(']')
        drop = REMOVED_PROPERTIES.get(block, set())
        kept = [p for p in props.split(',') if p.split('=')[0] not in drop]
        return block + ('[' + ','.join(kept) + ']' if kept else '')
    return block

notes = collections.Counter()

def fix_item(item):
    """1.20.5+ item {id, count:int, components} -> 1.20.1 {id, Count:byte, tag}."""
    v = dict(item.value)
    if 'count' in v:
        v['Count'] = Tag(BYTE, max(-128, min(127, v.pop('count').value)))
    if 'components' in v:
        comps = v.pop('components').value
        if comps: notes['item components dropped: ' + ', '.join(sorted(comps))] += 1
    return Tag(COMPOUND, v)

def fix_block_entity(be_id, data):
    d = dict(data)
    for key in ('Items',):
        if key in d:
            d[key] = Tag(LIST, [fix_item(i) for i in d[key].value], COMPOUND)
    if 'Book' in d: d['Book'] = fix_item(d['Book'])
    if 'item' in d and be_id == 'minecraft:decorated_pot':     # pot contents are 1.20.3+
        d.pop('item'); notes['decorated pot contents dropped'] += 1
    if 'bees' in d:                                            # renamed from Bees in 1.20.5
        bees = d.pop('bees').value
        if bees: notes['bees in hives dropped'] += len(bees)
        d['Bees'] = Tag(LIST, [], COMPOUND)
    if be_id == 'minecraft:banner' and 'patterns' in d:
        d.pop('patterns'); notes['banner patterns dropped (1.20.5 format)'] += 1
    return d

def convert(src, dst):
    name, root = nbt.read(gzip.decompress(open(src, 'rb').read()))
    s = root.value['Schematic'].value
    assert s['Version'].value == 3, 'not a v3 schematic'
    blocks = s['Blocks'].value
    old_pal = {idx.value: state for state, idx in blocks['Palette'].value.items()}
    new_pal, remap = {}, {}
    for idx in sorted(old_pal):
        fixed = fix_state(old_pal[idx])
        if fixed not in new_pal: new_pal[fixed] = len(new_pal)
        remap[idx] = new_pal[fixed]
    data = varints(blocks['Data'].value)
    w, h, l = s['Width'].value, s['Height'].value, s['Length'].value
    assert len(data) == w * h * l, 'block count mismatch'
    new_data = to_varints(remap[v] for v in data)

    rel = s['Offset'].value                                    # min corner relative to the copy origin
    origin = s['Metadata'].value['WorldEdit'].value['Origin'].value
    v2 = {
        'Version': Tag(INT, 2),
        'DataVersion': Tag(INT, DATA_VERSION_1201),
        'Metadata': Tag(COMPOUND, {'WEOffsetX': Tag(INT, rel[0]), 'WEOffsetY': Tag(INT, rel[1]), 'WEOffsetZ': Tag(INT, rel[2])}),
        'Width': Tag(SHORT, w), 'Height': Tag(SHORT, h), 'Length': Tag(SHORT, l),
        'Offset': Tag(INT_ARRAY, [origin[0] + rel[0], origin[1] + rel[1], origin[2] + rel[2]]),
        'PaletteMax': Tag(INT, len(new_pal)),
        'Palette': Tag(COMPOUND, {k: Tag(INT, v) for k, v in new_pal.items()}),
        'BlockData': Tag(BYTE_ARRAY, new_data),
    }
    bes = []
    for be in blocks.get('BlockEntities', Tag(LIST, [])).value:
        bv = be.value
        be_id = bv['Id'].value
        entry = {'Pos': Tag(INT_ARRAY, list(bv['Pos'].value)), 'Id': Tag(STRING, be_id)}
        entry.update(fix_block_entity(be_id, bv.get('Data', Tag(COMPOUND, {})).value))
        bes.append(Tag(COMPOUND, entry))
    v2['BlockEntities'] = Tag(LIST, bes, COMPOUND)
    if 'Entities' in s and s['Entities'].value: notes['entities dropped'] += len(s['Entities'].value)
    if 'Biomes' in s: notes['biomes dropped'] += 1
    open(dst, 'wb').write(gzip.compress(nbt.write('Schematic', Tag(COMPOUND, v2))))
    return dict(size=(w, h, l), palette=(len(old_pal), len(new_pal)), blocks=len(data), block_entities=len(bes), notes=dict(notes))

def main(argv):
    if len(argv) != 2:
        print(__doc__)
        return 1
    r = convert(argv[0], argv[1])
    print('Converted %s -> %s' % (argv[0], argv[1]))
    print('  size %dx%dx%d, %d blocks, %d block entities' % (r['size'] + (r['blocks'], r['block_entities'])))
    for note, n in r['notes'].items():
        print('  note: %s (%d)' % (note, n))
    return 0


if __name__ == '__main__':
    sys.exit(main(sys.argv[1:]))
