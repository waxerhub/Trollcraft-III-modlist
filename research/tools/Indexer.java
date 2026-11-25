import java.io.*;
import java.nio.charset.StandardCharsets;
import java.nio.file.*;
import java.util.*;

/**
 * Indexes the extracted data/ trees of a modpack's jars.
 *
 * Usage: java Indexer <jarsRoot> <outDir>
 *
 * jarsRoot holds one directory per jar, each with data/** and META-INF/mods.toml.
 * Nothing from the jars is executed or loaded; only JSON text is read.
 */
public class Indexer {

  // ---------------------------------------------------------------- JSON ---

  static final class P {
    final String s; int i;
    P(String s) { this.s = s; }
    Object parse() { ws(); Object v = val(); ws(); return v; }
    void ws() { while (i < s.length() && Character.isWhitespace(s.charAt(i))) i++; }
    Object val() {
      char c = s.charAt(i);
      switch (c) {
        case '{': return obj();
        case '[': return arr();
        case '"': return str();
        case 't': i += 4; return Boolean.TRUE;
        case 'f': i += 5; return Boolean.FALSE;
        case 'n': i += 4; return null;
        default: return num();
      }
    }
    Map<String,Object> obj() {
      Map<String,Object> m = new LinkedHashMap<>();
      i++; ws();
      if (s.charAt(i) == '}') { i++; return m; }
      while (true) {
        ws(); String k = str(); ws(); i++; /* : */ ws();
        m.put(k, val()); ws();
        char c = s.charAt(i++);
        if (c == '}') return m;
      }
    }
    List<Object> arr() {
      List<Object> l = new ArrayList<>();
      i++; ws();
      if (s.charAt(i) == ']') { i++; return l; }
      while (true) {
        ws(); l.add(val()); ws();
        char c = s.charAt(i++);
        if (c == ']') return l;
      }
    }
    String str() {
      StringBuilder b = new StringBuilder();
      i++;
      while (true) {
        char c = s.charAt(i++);
        if (c == '"') return b.toString();
        if (c == '\\') {
          char e = s.charAt(i++);
          switch (e) {
            case 'n': b.append('\n'); break;
            case 't': b.append('\t'); break;
            case 'r': b.append('\r'); break;
            case 'b': b.append('\b'); break;
            case 'f': b.append('\f'); break;
            case 'u': b.append((char) Integer.parseInt(s.substring(i, i + 4), 16)); i += 4; break;
            default: b.append(e);
          }
        } else b.append(c);
      }
    }
    Double num() {
      int st = i;
      while (i < s.length() && "+-.eE0123456789".indexOf(s.charAt(i)) >= 0) i++;
      return Double.valueOf(s.substring(st, i));
    }
  }

  static Object json(Path p) {
    try {
      String t = new String(Files.readAllBytes(p), StandardCharsets.UTF_8);
      int b = 0;
      while (b < t.length() && t.charAt(b) != '{' && t.charAt(b) != '[') b++;
      if (b >= t.length()) return null;
      return new P(t.substring(b)).parse();
    } catch (Exception e) { return null; }
  }

  // --------------------------------------------------------------- state ---

  static final Set<String> OUT_KEYS = new HashSet<>(Arrays.asList(
      "result", "results", "output", "outputs", "output_item", "outputitem", "itemoutput",
      "primary_output", "secondary_output", "byproducts", "byproduct", "produces",
      "main_output", "mainoutput", "secondaryoutput", "item_output", "fluid_output", "gas_output",
      "chemical_output", "secondaries", "output_items", "outputitems"));

  static final Set<String> IN_KEYS = new HashSet<>(Arrays.asList(
      "ingredient", "ingredients", "input", "inputs", "key", "base", "addition", "template",
      "catalyst", "material", "materials", "reagent", "reagents", "item_input", "fluid_input", "cast",
      "gas_input", "chemical_input", "left_input", "right_input", "main_input", "extra_input",
      "pattern_items", "tools", "tool", "additives", "mana", "secondary_input", "bottom", "middle",
      "top", "sides", "fluid", "fluids", "sources", "source", "casting", "cast_consumed", "upgrade",
      "input_items", "inputitems", "input_item"));

  static StringBuilder recipes = new StringBuilder();
  static StringBuilder byOut = new StringBuilder();
  static StringBuilder byIn = new StringBuilder();
  static StringBuilder tags = new StringBuilder();
  static StringBuilder loot = new StringBuilder();
  static StringBuilder mods = new StringBuilder();
  static StringBuilder counts = new StringBuilder();
  static StringBuilder unparsed = new StringBuilder();

  public static void main(String[] args) throws Exception {
    Path root = Paths.get(args[0]), out = Paths.get(args[1]);
    Files.createDirectories(out);

    mods.append("jar\tmodid\tname\tversion\tdeps\n");
    counts.append("jar\tnamespaces\trecipes\ttags\tloot_tables\tadvancements\tother_data\n");
    recipes.append("recipe_id\tjar\ttype\toutputs\tin_items\tin_tags\n");
    byOut.append("output\trecipe_id\ttype\tjar\n");
    byIn.append("input\trecipe_id\ttype\tjar\n");
    tags.append("tag\tjar\treplace\tmember\n");
    loot.append("loot_table\tjar\tentry\n");
    unparsed.append("recipe_id\tjar\ttype\n");

    List<Path> jarDirs = new ArrayList<>();
    try (DirectoryStream<Path> ds = Files.newDirectoryStream(root)) {
      for (Path p : ds) if (Files.isDirectory(p)) jarDirs.add(p);
    }
    Collections.sort(jarDirs);

    for (Path jd : jarDirs) doJar(jd);

    write(out.resolve("mods.tsv"), mods);
    write(out.resolve("counts.tsv"), counts);
    write(out.resolve("recipes.tsv"), recipes);
    write(out.resolve("by_output.tsv"), byOut);
    write(out.resolve("by_ingredient.tsv"), byIn);
    write(out.resolve("tags.tsv"), tags);
    write(out.resolve("loot.tsv"), loot);
    write(out.resolve("unparsed_recipes.tsv"), unparsed);
    System.out.println("jars=" + jarDirs.size());
  }

  static void write(Path p, StringBuilder b) throws IOException {
    Files.write(p, b.toString().getBytes(StandardCharsets.UTF_8));
    System.out.println(p.getFileName() + " " + b.length() + " bytes");
  }

  // ----------------------------------------------------------- per-jar ---

  static void doJar(Path jd) throws IOException {
    String jar = jd.getFileName().toString();

    Path toml = jd.resolve("META-INF/mods.toml");
    if (Files.exists(toml)) parseToml(jar, toml);
    else mods.append(jar).append("\t\t\t\t\n");

    Path data = jd.resolve("data");
    Set<String> ns = new TreeSet<>();
    int nR = 0, nT = 0, nL = 0, nA = 0, nO = 0;
    if (Files.isDirectory(data)) {
      List<Path> files = new ArrayList<>();
      walk(data, files);
      for (Path f : files) {
        String rel = data.relativize(f).toString().replace('\\', '/');
        int sl = rel.indexOf('/');
        if (sl < 0) continue;
        String namespace = rel.substring(0, sl);
        String rest = rel.substring(sl + 1);
        ns.add(namespace);
        if (!rest.endsWith(".json")) { nO++; continue; }
        if (rest.startsWith("recipes/")) {
          nR++; doRecipe(jar, namespace, rest.substring("recipes/".length()), f);
        } else if (rest.startsWith("recipe/")) {
          nR++; doRecipe(jar, namespace, rest.substring("recipe/".length()), f);
        } else if (rest.startsWith("tags/")) {
          nT++; doTag(jar, namespace, rest.substring("tags/".length()), f);
        } else if (rest.startsWith("loot_tables/")) {
          nL++; doLoot(jar, namespace, rest.substring("loot_tables/".length()), f);
        } else if (rest.startsWith("advancements/")) {
          nA++;
        } else nO++;
      }
    }
    counts.append(jar).append('\t').append(String.join(",", ns)).append('\t')
        .append(nR).append('\t').append(nT).append('\t').append(nL).append('\t')
        .append(nA).append('\t').append(nO).append('\n');
  }

  static void walk(Path dir, List<Path> acc) throws IOException {
    try (DirectoryStream<Path> ds = Files.newDirectoryStream(dir)) {
      for (Path p : ds) {
        if (Files.isDirectory(p)) walk(p, acc); else acc.add(p);
      }
    }
  }

  static void parseToml(String jar, Path toml) throws IOException {
    List<String> lines = Files.readAllLines(toml, StandardCharsets.UTF_8);
    String id = null, name = null, ver = null;
    String curDepOf = null;
    List<String> deps = new ArrayList<>();
    String depId = null; Boolean depMand = null;
    List<String[]> out = new ArrayList<>();
    for (String raw : lines) {
      String l = raw.trim();
      if (l.startsWith("#")) continue;
      if (l.startsWith("[[mods]]")) {
        if (id != null) out.add(new String[]{id, name, ver});
        id = null; name = null; ver = null; curDepOf = null;
        continue;
      }
      if (l.startsWith("[[dependencies")) {
        if (depId != null) { deps.add(depId + (Boolean.FALSE.equals(depMand) ? "(opt)" : "")); }
        depId = null; depMand = null;
        curDepOf = l.substring("[[dependencies.".length()).replace("]]", "").replace("\"", "");
        continue;
      }
      int eq = l.indexOf('=');
      if (eq < 0) continue;
      String k = l.substring(0, eq).trim();
      String v = l.substring(eq + 1).trim();
      if (v.startsWith("\"")) v = v.substring(1, Math.max(1, v.lastIndexOf('"')));
      if (curDepOf == null) {
        if (k.equals("modId")) id = v;
        else if (k.equals("displayName")) name = v;
        else if (k.equals("version")) ver = v;
      } else {
        if (k.equals("modId")) {
          if (depId != null) deps.add(depId + (Boolean.FALSE.equals(depMand) ? "(opt)" : ""));
          depId = v; depMand = null;
        } else if (k.equals("mandatory")) depMand = Boolean.valueOf(v.replace("\"", ""));
      }
    }
    if (depId != null) deps.add(depId + (Boolean.FALSE.equals(depMand) ? "(opt)" : ""));
    if (id != null) out.add(new String[]{id, name, ver});
    if (out.isEmpty()) { mods.append(jar).append("\t\t\t\t\n"); return; }
    for (int i = 0; i < out.size(); i++) {
      String[] m = out.get(i);
      mods.append(jar).append('\t').append(nz(m[0])).append('\t').append(nz(m[1])).append('\t')
          .append(nz(m[2])).append('\t').append(i == 0 ? String.join(",", deps) : "").append('\n');
    }
  }

  static String nz(String s) { return s == null ? "" : s; }

  // ---------------------------------------------------------- recipes ---

  static void doRecipe(String jar, String ns, String rest, Path f) {
    String id = ns + ":" + rest.substring(0, rest.length() - 5);
    Object o = json(f);
    if (!(o instanceof Map)) { unparsed.append(id).append('\t').append(jar).append("\t<bad-json>\n"); return; }
    Map<?,?> m = (Map<?,?>) o;
    String type = str(m.get("type"));
    Set<String> outs = new LinkedHashSet<>(), inItems = new LinkedHashSet<>(), inTags = new LinkedHashSet<>();
    collect(m, 0, outs, inItems, inTags);
    if (outs.isEmpty()) unparsed.append(id).append('\t').append(jar).append('\t').append(type).append('\n');
    recipes.append(id).append('\t').append(jar).append('\t').append(type).append('\t')
        .append(String.join(",", outs)).append('\t')
        .append(String.join(",", inItems)).append('\t')
        .append(String.join(",", inTags)).append('\n');
    for (String s : outs) byOut.append(s).append('\t').append(id).append('\t').append(type).append('\t').append(jar).append('\n');
    for (String s : inItems) byIn.append(s).append('\t').append(id).append('\t').append(type).append('\t').append(jar).append('\n');
    for (String s : inTags) byIn.append('#').append(s).append('\t').append(id).append('\t').append(type).append('\t').append(jar).append('\n');
  }

  /** role: 0 = neutral, 1 = output, 2 = input */
  static void collect(Object node, int role, Set<String> outs, Set<String> inItems, Set<String> inTags) {
    if (node instanceof Map) {
      Map<?,?> m = (Map<?,?>) node;
      // a leaf-ish stack / ingredient / fluid object; role 0 adds nothing
      String item = firstStr(m, "item", "id", "block");
      String fluid = str(m.get("fluid"));
      String tag = str(m.get("tag"));
      String name = str(m.get("name"));
      if (item != null && looksLikeId(item)) add(role, item, outs, inItems, inTags);
      if (fluid != null && looksLikeId(fluid)) add(role, "fluid:" + fluid, outs, inItems, inTags);
      if (item == null && name != null && looksLikeId(name))
        add(role, (m.containsKey("amount") ? "fluid:" : "") + name, outs, inItems, inTags);
      if (tag != null && looksLikeId(tag) && role != 0) {
        if (role == 1) outs.add("#" + tag); else inTags.add(tag);
      }
      for (Map.Entry<?,?> e : m.entrySet()) {
        String k = String.valueOf(e.getKey()).toLowerCase(Locale.ROOT);
        if (k.equals("type") || k.equals("conditions") || k.equals("pattern")) continue;
        int r = OUT_KEYS.contains(k) ? 1 : IN_KEYS.contains(k) ? 2 : role;
        Object v = e.getValue();
        boolean leafKey = k.equals("item") || k.equals("tag") || k.equals("fluid")
            || k.equals("id") || k.equals("name") || k.equals("block");
        // leaf keys were already handled above when their value was a plain string;
        // when it is an object or list, keep walking (e.g. enderio "item": { "item": ... })
        if (leafKey) { if (!(v instanceof String)) collect(v, r, outs, inItems, inTags); continue; }
        if (v instanceof String) {
          String s = (String) v;
          if (looksLikeId(s) && r != 0) add(r, s, outs, inItems, inTags);
        } else collect(v, r, outs, inItems, inTags);
      }
    } else if (node instanceof List) {
      for (Object x : (List<?>) node) {
        if (x instanceof String) {
          String s = (String) x;
          if (looksLikeId(s) && role != 0) add(role, s, outs, inItems, inTags);
        } else collect(x, role, outs, inItems, inTags);
      }
    }
  }

  static void add(int role, String id, Set<String> outs, Set<String> inItems, Set<String> inTags) {
    if (role == 1) outs.add(id);
    else if (role == 2) inItems.add(id);
  }

  static String firstStr(Map<?,?> m, String... keys) {
    for (String k : keys) { String v = str(m.get(k)); if (v != null) return v; }
    return null;
  }

  static String str(Object o) { return o instanceof String ? (String) o : null; }

  static boolean looksLikeId(String s) {
    int c = s.indexOf(':');
    if (c <= 0 || c == s.length() - 1) return false;
    if (s.indexOf(' ') >= 0) return false;
    for (int i = 0; i < s.length(); i++) {
      char ch = s.charAt(i);
      if (!(Character.isLetterOrDigit(ch) || ch == '_' || ch == '/' || ch == ':' || ch == '.' || ch == '-')) return false;
    }
    return true;
  }

  // ------------------------------------------------------------- tags ---

  static void doTag(String jar, String ns, String rest, Path f) {
    // rest = <kind>/<path>.json  e.g. items/ingots/steel.json
    String id = ns + ":" + rest.substring(0, rest.length() - 5);
    Object o = json(f);
    if (!(o instanceof Map)) return;
    Map<?,?> m = (Map<?,?>) o;
    boolean rep = Boolean.TRUE.equals(m.get("replace"));
    Object vs = m.get("values");
    if (vs instanceof List) {
      for (Object v : (List<?>) vs) {
        String s = v instanceof String ? (String) v
            : (v instanceof Map ? str(((Map<?,?>) v).get("id")) : null);
        if (s != null) tags.append(id).append('\t').append(jar).append('\t').append(rep).append('\t').append(s).append('\n');
      }
    }
  }

  // ------------------------------------------------------------- loot ---

  static void doLoot(String jar, String ns, String rest, Path f) {
    String id = ns + ":" + rest.substring(0, rest.length() - 5);
    Object o = json(f);
    if (o == null) return;
    Set<String> items = new LinkedHashSet<>();
    lootWalk(o, items);
    for (String s : items) loot.append(id).append('\t').append(jar).append('\t').append(s).append('\n');
  }

  static void lootWalk(Object node, Set<String> acc) {
    if (node instanceof Map) {
      Map<?,?> m = (Map<?,?>) node;
      String type = str(m.get("type"));
      String name = str(m.get("name"));
      if (type != null && name != null) {
        String t = type.contains(":") ? type.substring(type.indexOf(':') + 1) : type;
        if (t.equals("item")) acc.add(name);
        else if (t.equals("loot_table")) acc.add("table:" + name);
        else if (t.equals("tag")) acc.add("#" + name);
        else if (t.equals("dynamic")) acc.add("dynamic:" + name);
      }
      // set_contents / item functions that add items
      String fn = str(m.get("function"));
      if (fn != null) {
        String v = firstStr(m, "item", "id");
        if (v != null && looksLikeId(v)) acc.add(v);
      }
      for (Object v : m.values()) lootWalk(v, acc);
    } else if (node instanceof List) {
      for (Object x : (List<?>) node) lootWalk(x, acc);
    }
  }
}
