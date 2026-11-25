#!/usr/bin/env bash
# Builds the upload folder for the Part II server's Enchanted Potatoes and the Shrine night:
#   release/part2_potatoes_and_shrine/server/   laid out like the server's folder (drag its contents in)
#   release/part2_potatoes_and_shrine/modpack/  laid out like a player's instance (the modpack update)
#   release/part2_potatoes_and_shrine/README.md the checklist (copied from tools/release_checklist.md)
#   release/part2_potatoes_and_shrine/PREGENERATION.md  the optional pregeneration plan (tools/serverconfig/)
# Run from anywhere: bash tools/make_release.sh. release/ is ignored by git; it's rebuilt from the repo each time.
set -euo pipefail
REPO="$(cd "$(dirname "$0")/.." && pwd)"
OUT="$REPO/release/part2_potatoes_and_shrine"
K="$REPO/tools/kubejs"
rm -rf "$OUT"
put() { mkdir -p "$(dirname "$OUT/$2")"; cp "$1" "$OUT/$2"; }

# --- the server ---
put "$K/server_scripts/part2/blood_pool.js"  server/kubejs/server_scripts/part2/blood_pool.js
put "$K/server_scripts/part2/potato_tree.js" server/kubejs/server_scripts/part2/potato_tree.js
put "$K/server_scripts/part2/shrine.js"      server/kubejs/server_scripts/part2/shrine.js
put "$K/server_scripts/fake_players.js"      server/kubejs/server_scripts/fake_players.js
put "$K/startup_scripts/potato_press.js"     server/kubejs/startup_scripts/potato_press.js
for f in "$K"/data/trollcraft/structures/shrine/l_*.nbt; do put "$f" "server/kubejs/data/trollcraft/structures/shrine/$(basename "$f")"; done
for f in "$K"/data/alexsmobs/loot_tables/gameplay/transmutation_table_*.json; do put "$f" "server/kubejs/data/alexsmobs/loot_tables/gameplay/$(basename "$f")"; done
put "$REPO/tools/serverconfig/alexsmobs.toml" server/config/alexsmobs.toml
put "$REPO/tools/serverconfig/modernfix-mixins.properties" server/config/modernfix-mixins.properties
for f in "$REPO"/tools/ftbquests/quests/chapters/potato_war_*.snbt; do put "$f" "server/config/ftbquests/quests/chapters/$(basename "$f")"; done
put "$REPO/tools/ftbquests/quests/chapter_groups.snbt" server/config/ftbquests/quests/chapter_groups.snbt

# --- the modpack (every player) ---
put "$K/startup_scripts/potato_press.js"     modpack/kubejs/startup_scripts/potato_press.js
put "$K/client_scripts/potato_tooltips.js"   modpack/kubejs/client_scripts/potato_tooltips.js

put "$REPO/tools/release_checklist.md" README.md
put "$REPO/tools/serverconfig/PREGENERATION.md" PREGENERATION.md
( cd "$OUT" && find . -type f ! -name FILES.txt | sort | sed 's|^\./||' > FILES.txt )
echo "Built $OUT: $(wc -l < "$OUT/FILES.txt") files"
