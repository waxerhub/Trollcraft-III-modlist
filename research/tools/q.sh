#!/usr/bin/env bash
# Query helper for the pack index built by tools/Indexer.java + tools/resolve.pl.
# Works whether the .tsv files are plain or gzipped.
#
#   q.sh makes <item>          what recipes output <item>   (tags resolved to members)
#   q.sh uses <item>           what recipes consume <item>  (tags resolved to members)
#   q.sh recipe <id>           one recipe row (outputs, item inputs, tag inputs)
#   q.sh type <recipe_type>    every recipe of a type
#   q.sh ns <modid>            every recipe whose RECIPE ID namespace is <modid>
#   q.sh outns <modid>         every recipe whose OUTPUT item namespace is <modid>
#   q.sh tag <tag>             members of a tag, e.g. forge:ingots/steel
#   q.sh intag <item>          which tags contain <item>
#   q.sh loot <item>           which loot tables can yield <item>
#   q.sh lootof <table>        what a loot table yields
#   q.sh mod <jarsubstring>    mods.tsv rows
#   q.sh counts <jarsubstring> counts.tsv rows
#
# IDX overrides the index directory (default: ../index next to this script).
I="${IDX:-$(cd "$(dirname "$0")/../index" && pwd)}"

cat_idx() {           # cat_idx <basename-without-.tsv>
  if   [ -f "$I/$1.tsv" ];    then cat "$I/$1.tsv"
  elif [ -f "$I/$1.tsv.gz" ]; then gzip -dc "$I/$1.tsv.gz"
  else echo "missing: $I/$1.tsv[.gz]" >&2; return 1
  fi
}

cmd="$1"; arg="$2"
case "$cmd" in
  makes)   cat_idx by_output_resolved     | awk -F'\t' -v a="$arg" '$1==a' ;;
  uses)    cat_idx by_ingredient_resolved | awk -F'\t' -v a="$arg" '$1==a' ;;
  recipe)  cat_idx recipes                | awk -F'\t' -v a="$arg" '$1==a' ;;
  type)    cat_idx recipes                | awk -F'\t' -v a="$arg" '$3==a' ;;
  ns)      cat_idx recipes                | awk -F'\t' -v a="^$arg:" '$1 ~ a' ;;
  outns)   cat_idx by_output_resolved     | awk -F'\t' -v a="^$arg:" '$1 ~ a' ;;
  tag)     cat_idx tag_members            | awk -F'\t' -v a="$arg" '$2==a' ;;
  intag)   cat_idx tag_members            | awk -F'\t' -v a="$arg" '$4==a' ;;
  loot)    cat_idx loot                   | awk -F'\t' -v a="$arg" '$3==a' ;;
  lootof)  cat_idx loot                   | awk -F'\t' -v a="$arg" '$1==a' ;;
  mod)     cat_idx mods                   | grep -i -- "$arg" ;;
  counts)  cat_idx counts                 | grep -i -- "$arg" ;;
  *) sed -n '2,25p' "$0" ;;
esac
