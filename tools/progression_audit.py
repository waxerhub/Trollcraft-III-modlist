"""Progression audit for Part II: the Blood Pool tiers, the potato ranks and the Potato War tree, checked against
the mods' own recipes. Read-only: it reads extracted mod jars (folders or .jar files) and writes a Markdown report.

    python3 -I tools/progression_audit.py --out PROGRESSION_AUDIT.md <mod folder or jar> [...]

The tier, rank and node data come from the scripts themselves (node tools/ftbquests/dump_progression.js), so the
report always matches what's installed. What it checks:
  1. ids in the tiers and the tree that no mod on hand defines (a typo makes a lock silently do nothing);
  2. crafting-table recipes of mod-specific types the rank check can't see (after the conversion in blood_pool.js);
  3. sealed items that another recipe still makes before their tier (secondary outputs, untiered recipes);
  4. collateral: recipes a mod lock removes although their result belongs to an open mod or vanilla;
  5. the tree against the tiers: nodes cheaper than what they unlock really needs; Tinkers materials in no node or tier;
  6. automation, logistics and farm blocks that no tree node covers.
Mods that aren't in the folders given are listed as not checked; /bloodpool audit (in game) covers everything loaded.
"""
import argparse, json, os, re, subprocess, sys, zipfile, collections

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(HERE)

# Crafting-table recipe types (they go through a crafting grid). Vanilla's are covered by the rank check; the
# converted ones too (blood_pool.js CONVERT_RECIPE_TYPES).
VANILLA_TABLE = {'minecraft:crafting_shaped', 'minecraft:crafting_shapeless', 'crafting_shaped', 'crafting_shapeless'}
CONVERTED = {'cucumber:shaped_no_mirror', 'cucumber:shaped_tag', 'mekanism:mek_data'}
TABLE_LIKE = re.compile(r'(crafting|shaped|shapeless|mek_data|copy_nbt|nbt_output|armor_upgrade|mana_upgrade|turn_and_copy|'
                        r'laputa_shard|bison_upgrade|dark_steel_upgrade|entity_storage|_upgrade$|fluid$)')
NOT_TABLE = {'tconstruct:material_fluid', 'tconstruct:material', 'create:mechanical_crafting', 'draconicevolution:fusion_crafting', 'enderio:fire_crafting',
             'twilightforest:uncrafting', 'minecraft:smithing_transform', 'minecraft:smithing_trim'}
AUTOMATION = re.compile(r'(crafter|assembler|assemblicator|fabricator|_bus$|import_bus|export_bus|storage_bus|plane$|'
                        r'transporter|logistical|conduit|duct$|pipe$|servo|filter_attachment|funnel|tunnel|chute|'
                        r'quarry|digital_miner|miner$|harvester|planter|plough|growth_accelerator|spawner$|'
                        r'mob_farm|vacuum|item_collector|hopperhock|cloche|insolator|deployer|mechanical_arm|interface$|'
                        r'pattern_provider|crafting_unit|crafting_storage|accelerator$|sorter|router|teleporter)')


# ---------------------------------------------------------------- reading the mods

def walk_sources(paths):
    """Yields (path inside the mod, bytes) for every recipe, tag and lang file in folders and .jar files."""
    want = re.compile(r'(data/[^/]+/recipes/.+\.json|data/[^/]+/tags/items/.+\.json|assets/[^/]+/lang/en_us\.json|'
                      r'data/[^/]+/loot_tables/blocks/.+\.json)$')
    for p in paths:
        if os.path.isfile(p) and p.endswith('.jar'):
            try:
                with zipfile.ZipFile(p) as z:
                    for n in z.namelist():
                        if want.search(n):
                            yield n, z.read(n)
            except zipfile.BadZipFile:
                pass
            continue
        for dp, dn, fn in os.walk(p):
            for f in fn:
                full = os.path.join(dp, f)
                if f.endswith('.jar'):
                    yield from walk_sources([full])
                    continue
                rel = full.replace('\\', '/')
                m = want.search(rel)
                if m:
                    try:
                        with open(full, 'rb') as fh:
                            yield m.group(1), fh.read()
                    except OSError:
                        pass


def load_mods(paths):
    recipes, tags, ids = {}, collections.defaultdict(set), set()
    for rel, data in walk_sources(paths):
        try:
            j = json.loads(data.decode('utf-8'))
        except Exception:
            continue
        parts = rel.split('/')
        ns = parts[1]
        if '/recipes/' in rel:
            rid = ns + ':' + '/'.join(parts[3:])[:-5]
            if isinstance(j, dict):
                recipes[rid] = unwrap(j)
        elif '/tags/items/' in rel:
            tag = ns + ':' + '/'.join(parts[4:])[:-5]
            for v in (j.get('values') or []):
                v = v.get('id') if isinstance(v, dict) else v
                if isinstance(v, str):
                    tags[tag].add(v)
        elif rel.endswith('en_us.json'):
            for k in j:
                p = k.split('.')
                if len(p) == 3 and p[0] in ('block', 'item'):
                    ids.add(p[1] + ':' + p[2])
        elif '/loot_tables/blocks/' in rel:
            ids.add(ns + ':' + parts[-1][:-5])
    for r in recipes.values():
        for i in item_ids(r.get('_outputs', [])):
            ids.add(i)
    return recipes, resolve_tags(tags), ids


def resolve_tags(tags):
    out = {}
    def res(t, seen):
        if t in out:
            return out[t]
        acc = set()
        for v in tags.get(t, ()):
            if v.startswith('#'):
                if v[1:] not in seen:
                    acc |= res(v[1:], seen | {v[1:]})
            else:
                acc.add(v)
        out[t] = acc
        return acc
    for t in list(tags):
        res(t, {t})
    return out


def unwrap(j):
    """forge:conditional → its first recipe. Adds _outputs (every item/tag in result-like fields) and _inputs."""
    if j.get('type') == 'forge:conditional' and j.get('recipes'):
        j = dict(j['recipes'][0].get('recipe', {}))
    outs, ins = [], []
    for k, v in j.items():
        (outs if re.search(r'^(result|results|output|outputs|output_item|result_item|item_output)$', k) else ins).append(v)
    j['_outputs'] = outs
    j['_inputs'] = ins
    return j


def item_ids(node, tags_too=False):
    """Item ids (and '#tags' if asked) mentioned in a recipe fragment."""
    out = []
    if isinstance(node, str):
        if re.match(r'^[a-z0-9_.-]+:[a-z0-9_/.-]+$', node):
            out.append(node)
    elif isinstance(node, list):
        for x in node:
            out += item_ids(x, tags_too)
    elif isinstance(node, dict):
        for k in ('item', 'id', 'output'):
            if isinstance(node.get(k), str):
                out.append(node[k])
        if tags_too and isinstance(node.get('tag'), str):
            out.append('#' + node['tag'])
        for k, v in node.items():
            if k not in ('item', 'id', 'tag', 'type', 'fluid', 'count', 'nbt', 'chance') and isinstance(v, (list, dict)):
                out += item_ids(v, tags_too)
    return [o for o in out if not o.startswith('minecraft:air')]


# ---------------------------------------------------------------- the progression data

def load_progression():
    out = subprocess.run(['node', os.path.join(ROOT, 'tools', 'ftbquests', 'dump_progression.js')],
                         capture_output=True, text=True, check=True).stdout
    return json.loads(out)


class Tiers:
    def __init__(self, prog, tags):
        self.item, self.mod, self.tag, self.rules = {}, {}, [], []
        for T in prog['tiers']:
            for i in T['items']:
                self.item[i] = T['tier']
            for m in T['mods']:
                self.mod.setdefault(m, T['tier'])
            for t in T['tags']:
                self.tag.append((t, T['tier']))
            for r in T['recipes']:
                self.rules.append((re.compile(r['re'].replace('\\/', '/')) if isinstance(r, dict) else r, T['tier']))
        self.tags = tags

    def of(self, item):
        if item.startswith('#'):
            # a tag output gives one of its members; count the cheapest, so only real leaks show
            members = self.tags.get(item[1:], set())
            tiers = [self.of(m)[0] for m in members]
            return min(tiers, default=0), 'tag'
        if item in self.item:
            return self.item[item], 'item'
        for t, n in self.tag:
            if item in self.tags.get(t, ()):
                return n, 'tag ' + t
        m = self.mod.get(item.split(':')[0])
        return (m, 'mod') if m else (0, '')

    def rule(self, rid):
        best = 0
        for r, n in self.rules:
            if (r.search(rid) if hasattr(r, 'search') else r == rid):
                best = max(best, n)
        return best

    def recipe_seal(self, rid, r):
        """The tier this recipe exists from (the highest lock that removes it): its namespace, its id rules and
        its first output (KubeJS sees a mod recipe's main result)."""
        ns = self.mod.get(rid.split(':')[0], 0)
        outs = item_ids(r['_outputs'], tags_too=True)
        # a tag result (Tinkers casting, Mystical Agriculture's tag recipes) may be invisible to KubeJS's item locks,
        # so it doesn't count as removing the recipe
        first = self.of(outs[0])[0] if outs and not outs[0].startswith('#') else 0
        return max(ns, self.rule(rid), first)


# ---------------------------------------------------------------- the checks

def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--out', default=os.path.join(ROOT, 'PROGRESSION_AUDIT.md'))
    ap.add_argument('--pack', help='a mods list (one "file | modid | name" per line) to say which mods weren\'t checked')
    ap.add_argument('--notes', help='a hand-written review to put at the top of the report')
    ap.add_argument('paths', nargs='+')
    a = ap.parse_args()

    prog = load_progression()
    recipes, tags, ids = load_mods(a.paths)
    T = Tiers(prog, tags)
    have_ns = {i.split(':')[0] for i in ids} | {r.split(':')[0] for r in recipes}
    nodes = prog['nodes']
    rank_name = prog['ranks']
    lines = []
    P = lines.append

    P('# Progression audit (Part II)\n')
    if a.notes:
        with open(a.notes, encoding='utf-8') as fh:
            P(fh.read().rstrip() + '\n\n---\n\n# The generated report\n')
    P('Generated by `tools/progression_audit.py` from the scripts\' own tier and node lists and the recipes of %d mods '
      '(%d recipes). Mods not on hand are listed at the end; `/bloodpool audit` in game covers everything loaded.\n'
      % (len(have_ns), len(recipes)))

    # 1. ids that don't exist
    P('## 1. Ids that no mod on hand defines\n')
    refs = []
    for t in prog['tiers']:
        refs += [(i, 'Tier %d item' % t['tier']) for i in t['items']]
        refs += [('#' + g, 'Tier %d tag' % t['tier']) for g in t['tags']]
    for n in nodes:
        for k in ('places', 'use', 'gear', 'wireless'):
            refs += [(i, 'node %s %s' % (n['id'], k)) for i in (n.get(k) or [])]
        refs += [(i[0], 'node %s cost' % n['id']) for i in n.get('items', [])]
    refs += [(i, 'AUTOCRAFTERS') for i in prog['autocrafters']]
    missing, unchecked = [], []
    for i, where in refs:
        if i.startswith('#'):
            if i[1:] not in tags:
                (missing if True else unchecked).append((i, where))
            continue
        if i in ids or i == 'ae2:cable_bus':
            continue
        (missing if i.split(':')[0] in have_ns else unchecked).append((i, where))
    P('**Missing (the mod is on hand but has no such item):** ' + (', '.join('`%s` (%s)' % m for m in missing) or 'none') + '\n')
    P('**Not checked (mod not on hand):** ' + (', '.join('`%s` (%s)' % m for m in unchecked) or 'none') + '\n')

    # 2. crafting-table recipes the rank check can't see
    P('## 2. Crafting-table recipes the rank check doesn\'t cover\n')
    P('Vanilla crafting recipes and the converted types (%s) carry the rank check. These other crafting-grid types don\'t, '
      'so any rank can make them once the tier is open. "Tier" is when the recipe exists.\n' % ', '.join(sorted(CONVERTED)))
    esc = collections.defaultdict(list)
    for rid, r in recipes.items():
        t = r.get('type', '')
        if t in VANILLA_TABLE or t in NOT_TABLE or not TABLE_LIKE.search(t.split(':')[-1]):
            continue
        seal = T.recipe_seal(rid, r)
        if t in CONVERTED:
            if t == 'mekanism:mek_data' and is_mek_upgrade(r, recipes):
                esc[t + ' (upgrade, left as is)'].append((seal, rid))
            continue
        if seal >= 1:
            esc[t].append((seal, rid))
    P('| Type | Recipes in a tier | Tiers | Examples |\n|---|---|---|---|')
    for t, lst in sorted(esc.items(), key=lambda x: -len(x[1])):
        lst.sort()
        P('| `%s` | %d | %s | %s |' % (t, len(lst), ', '.join(str(x) for x in sorted({s for s, _ in lst})),
                                      ', '.join('`%s`' % r for _, r in lst[:4])))
    P('')

    # 3. sealed items made before their tier
    P('## 3. Sealed items another recipe makes before their tier\n')
    P('A recipe that exists from Tier A but also outputs an item sealed until a later Tier B. For first outputs this '
      'assumes KubeJS sees the result (it does for most mod recipes; `/bloodpool audit` confirms in game); '
      '**secondary outputs are never seen**, so these are real gaps until fixed with a recipe-id lock.\n')
    leaks = []
    for rid, r in recipes.items():
        if '/recycling/' in rid:
            continue                      # Tinkers recycling gives back what the tool was made of
        seal = T.recipe_seal(rid, r)
        outs = item_ids(r['_outputs'], tags_too=True)
        for k, o in enumerate(outs):
            tier, why = T.of(o)
            if tier > seal:
                leaks.append((tier, rid, r.get('type', ''), o, 'first' if k == 0 else 'secondary', seal))
    groups = collections.defaultdict(list)
    for tier, rid, t, o, which, seal in leaks:
        groups[(tier, o)].append((seal, rid, t, which))
    P('Grouped by item, the biggest jumps first. Most remaining rows are intermediates (gears, plates, coins, dusts of '
      'Thermal\'s metals) or base metals one tier early, which are harmless: the machines that use them are sealed too.\n')
    P('| Item (sealed until) | Made from Tier | Recipes | Example | Type |\n|---|---|---|---|---|')
    for (tier, o), lst in sorted(groups.items(), key=lambda kv: (-(kv[0][0] - min(x[0] for x in kv[1])), kv[0][1])):
        lst.sort()
        P('| `%s` (%d) | %d | %d | `%s` (%s) | `%s` |' % (o, tier, lst[0][0], len(lst), lst[0][1], lst[0][3], lst[0][2]))
    P('')

    # 4. collateral
    P('## 4. Collateral: recipes a mod lock holds back although their result is open\n')
    P('A mod lock removes every recipe in that mod\'s namespace. These results belong to vanilla or to a mod that opens '
      'earlier, so they stay uncraftable (by that route) until the mod\'s tier. Usually harmless (another route exists); '
      'check the list for anything players need early.\n')
    coll = collections.defaultdict(list)
    for rid, r in recipes.items():
        ns = rid.split(':')[0]
        nt = T.mod.get(ns, 0)
        if not nt:
            continue
        outs = item_ids(r['_outputs'])
        if not outs:
            continue
        o = outs[0]
        if o.split(':')[0] != ns and T.of(o)[0] < nt:
            coll[(nt, ns)].append(o)
    P('| Mod (tier) | Results held back | Examples |\n|---|---|---|')
    for (nt, ns), lst in sorted(coll.items()):
        c = collections.Counter(lst)
        P('| %s (%d) | %d | %s |' % (ns, nt, len(lst), ', '.join('`%s`' % i for i, _ in c.most_common(8))))
    P('')

    # 5. the tree against the tiers
    P('## 5. The tree against the Blood Pool\n')
    avail = availability(recipes, T)
    rows, later = [], []
    for n in nodes:
        need = max(n.get('tier') or 0, n.get('rank') or 0)
        unl = (n.get('places') or []) + (n.get('gear') or [])
        if not unl:
            continue
        av = {i: avail.get(i, T.of(i)[0]) for i in unl}
        if min(av.values()) > need:
            rows.append('- **%s** (Tier/rank %d) is useless until Tier %d: nothing it unlocks can be made earlier.' % (n['name'], need, min(av.values())))
        for i, t in sorted(av.items()):
            if need < t <= 12 and min(av.values()) <= need:
                later.append('`%s` (Tier %d, node %s)' % (i, t, n['name']))
    mat_tier = {}
    for r, t in T.rules:
        src = r.pattern if hasattr(r, 'pattern') else r
        m = re.search(r'^\^(tconstruct|tcintegrations):tools.*materials.*\(([a-z_|]+)\)\(', src)
        if m:
            for mat in m.group(2).split('|'):
                mat_tier.setdefault(m.group(1) + ':' + mat, t)
    in_nodes = {}
    for n in nodes:
        for mat in n.get('materials') or []:
            in_nodes[mat] = n
    for mat, n in sorted(in_nodes.items()):
        t = mat_tier.get(mat)
        if t is not None and t != n['tier']:
            rows.append('- **%s** (Tier %d) covers `%s`, which the Blood Pool seals until Tier %d.' % (n['name'], n['tier'], mat, t))
    # materials whose source item is sealed later than the material itself
    for rid, r in sorted(recipes.items()):
        if r.get('type') != 'tconstruct:material' or not r.get('material'):
            continue
        src = item_ids(r.get('ingredient', {}), tags_too=True)
        st = max([T.of(x)[0] for x in src], default=0)
        mat = r['material']
        mt = max(mat_tier.get(mat, 0), T.rule(rid))
        node = in_nodes.get(mat)
        if st > mt:
            rows.append('- Tinkers material `%s` comes from %s (Tier %d), but the Blood Pool doesn\'t seal the material (recipe `%s`)%s.'
                        % (mat, ', '.join('`%s`' % x for x in src), st, rid, '' if node else ' and no tree node covers it'))
    all_mats = sorted({d[0] + ':' + d[1] for d in walk_material_defs(a.paths)})
    free = [m for m in all_mats if m not in in_nodes and m not in mat_tier]
    P('\n'.join(rows) if rows else 'No mismatches.')
    if later:
        P('\n**Unlocked by a node but made later (family members, fine):** ' + ', '.join(later))
    P('\n**Tinkers materials in no node and no tier (free for everyone):** ' + (', '.join('`%s`' % m for m in free) or 'none') + '\n')

    # 6. automation the tree misses
    P('## 6. Automation, logistics and farm blocks no node covers\n')
    covered = set()
    for n in nodes:
        for k in ('places', 'use', 'wireless'):
            covered |= set(n.get(k) or [])
    cand = collections.defaultdict(list)
    for i in sorted(ids):
        ns, path = i.split(':', 1)
        if i in covered or not AUTOMATION.search(path) or re.search(r'(ore|_slab|_stairs|_wall|bucket|spawn_egg|_cover|card$|upgrade)', path):
            continue
        cand[ns].append((T.of(i)[0], path))
    P('| Mod | Candidates (tier) |\n|---|---|')
    for ns, lst in sorted(cand.items()):
        P('| %s | %s |' % (ns, ', '.join('`%s` (%d)' % (p, t) for t, p in lst[:30]) + (' …' if len(lst) > 30 else '')))
    P('')

    if a.pack:
        pack = set()
        for line in open(a.pack, encoding='utf-8'):
            parts = [x.strip() for x in line.split('|')]
            if len(parts) > 1 and parts[1]:
                pack.add(parts[1])
        P('## Mods in the pack that weren\'t checked\n')
        P(', '.join(sorted(pack - have_ns)) + '\n')

    with open(a.out, 'w', encoding='utf-8') as f:
        f.write('\n'.join(lines) + '\n')
    print('wrote %s: %d missing ids, %d rank gaps, %d leaks, %d collateral groups, %d tree rows' %
          (a.out, len(missing), sum(len(v) for k, v in esc.items() if 'upgrade' not in k), len(leaks), len(coll), len(rows)))


def is_mek_upgrade(r, recipes):
    """A Mekanism tier upgrade: an input is the same item one tier down, or the result is a factory, or an input is
    itself made by a mek_data recipe (it carries data: drives, jetpacks, machines). blood_pool.js uses the same rule."""
    out = item_ids(r['_outputs'])
    if not out:
        return False
    fam = lambda i: re.sub(r'^(basic|advanced|elite|ultimate)_', '', i.split(':', 1)[1])
    if 'factory' in out[0]:
        return True
    data_items = {item_ids(x['_outputs'])[0] for x in recipes.values() if x.get('type') == 'mekanism:mek_data' and item_ids(x['_outputs'])}
    for i in item_ids(r.get('key', {})):
        if i.startswith('mekanism') and (fam(i) == fam(out[0]) or i in data_items):
            return True
    return False


def availability(recipes, T, depth=1):
    """The earliest tier each item can be made: its own tier, or the cheapest recipe's ingredients' own tiers."""
    by_out = collections.defaultdict(list)
    for rid, r in recipes.items():
        o = item_ids(r['_outputs'])
        if o:
            by_out[o[0]].append(r)
    memo = {}
    def av(i, d):
        if i in memo:
            return memo[i]
        base = T.of(i)[0]
        if d == 0 or i not in by_out:
            return base
        memo[i] = base
        best = None
        for r in by_out[i]:
            ins = [x for x in item_ids(r.get('key', {}) or r['_inputs']) if ':' in x]
            v = max([av(x, d - 1) for x in ins] + [base])
            best = v if best is None else min(best, v)
        memo[i] = max(base, best if best is not None else base)
        return memo[i]
    return {i: av(i, depth) for i in list(by_out)}


def walk_material_defs(paths):
    """(namespace, material) for every Tinkers material definition that isn't a redirect."""
    found = []
    for rel, data in walk_material_files(paths):
        try:
            j = json.loads(data.decode('utf-8'))
        except Exception:
            continue
        if 'redirect' in j:
            continue
        parts = rel.split('/')
        found.append((parts[1], parts[-1][:-5]))
    return found


def walk_material_files(paths):
    want = re.compile(r'(data/[^/]+/tinkering/materials/definition/[^/]+\.json)$')
    for p in paths:
        if os.path.isfile(p) and p.endswith('.jar'):
            with zipfile.ZipFile(p) as z:
                for n in z.namelist():
                    if want.search(n):
                        yield n, z.read(n)
            continue
        for dp, dn, fn in os.walk(p):
            for f in fn:
                full = os.path.join(dp, f)
                if f.endswith('.jar'):
                    yield from walk_material_files([full])
                    continue
                m = want.search(full.replace('\\', '/'))
                if m:
                    yield m.group(1), open(full, 'rb').read()


if __name__ == '__main__':
    main()
