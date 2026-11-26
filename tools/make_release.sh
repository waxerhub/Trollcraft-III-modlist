#!/usr/bin/env bash
# Builds the upload folder for the Part II server's new-dimensions update (Blue Skies with the Aether and Deeper and
# Darker, the lag fixes, the crate button and the Potato Press fix):
#   release/part2_new_dimensions/server/    laid out like the server's folder (drag its contents in)
#   release/part2_new_dimensions/modpack/   laid out like a player's instance (the modpack update)
#   release/part2_new_dimensions/README.md  the checklist (copied from tools/release_checklist.md)
#   release/part2_new_dimensions/PREGENERATION.md  the pregeneration plan (tools/serverconfig/)
# The four mod jars aren't in the repo. Set SERVER_MODS to the folder that holds them and they're put in both
# server/mods/ and modpack/mods/; without it the checklist says to add them by hand:
#   SERVER_MODS="/path/to/Server Mods" bash tools/make_release.sh
# Run from anywhere. release/ is ignored by git; it's rebuilt from the repo each time.
# The update before this one (the Enchanted Potatoes, the Shrine night, the Aether and Deeper and Darker) is in the
# git history of this file (commit 30db8bc).
set -euo pipefail
REPO="$(cd "$(dirname "$0")/.." && pwd)"
OUT="$REPO/release/part2_new_dimensions"
K="$REPO/tools/kubejs"
rm -rf "$OUT"
put() { mkdir -p "$(dirname "$OUT/$2")"; cp "$1" "$OUT/$2"; }

# --- the server ---
put "$K/server_scripts/part2/potato_tree.js"         server/kubejs/server_scripts/part2/potato_tree.js
put "$K/server_scripts/part2/blood_pool.js"          server/kubejs/server_scripts/part2/blood_pool.js
put "$K/server_scripts/adaptive_distance.js"         server/kubejs/server_scripts/adaptive_distance.js
put "$K/server_scripts/chunk_loader_ban.js"          server/kubejs/server_scripts/chunk_loader_ban.js
put "$K/startup_scripts/chunk_loader_ban_hooks.js"   server/kubejs/startup_scripts/chunk_loader_ban_hooks.js
put "$K/startup_scripts/aether_spawn_fix.js"         server/kubejs/startup_scripts/aether_spawn_fix.js
put "$K/startup_scripts/potato_press.js"             server/kubejs/startup_scripts/potato_press.js
for f in "$K"/data/kubejs/tags/items/potato_*_input.json; do put "$f" "server/kubejs/data/kubejs/tags/items/$(basename "$f")"; done
for f in "$REPO"/tools/ftbquests/quests/chapters/potato_war_*.snbt; do put "$f" "server/config/ftbquests/quests/chapters/$(basename "$f")"; done

# --- the modpack (every player) ---
put "$K/startup_scripts/potato_press.js"             modpack/kubejs/startup_scripts/potato_press.js
put "$K/client_scripts/potato_tooltips.js"           modpack/kubejs/client_scripts/potato_tooltips.js

# --- the four mods, both sides ---
JARS="aether-1.20.1-1.5.2-neoforge.jar deeperdarker-forge-1.20.1-1.3.3.jar blue_skies-1.20.1-1.3.31.jar structure_gel-1.20.1-2.16.2.jar"
if [ -n "${SERVER_MODS:-}" ]; then
  for j in $JARS; do
    [ -f "$SERVER_MODS/$j" ] || { echo "missing $SERVER_MODS/$j" >&2; exit 1; }
    put "$SERVER_MODS/$j" "server/mods/$j"
    put "$SERVER_MODS/$j" "modpack/mods/$j"
  done
  MODS="with the four mods"
else
  MODS="without the mod jars (set SERVER_MODS to include them)"
fi

put "$REPO/tools/release_checklist.md" README.md
put "$REPO/tools/serverconfig/PREGENERATION.md" PREGENERATION.md
( cd "$OUT" && find . -type f ! -name FILES.txt | sort | sed 's|^\./||' > FILES.txt )
echo "Built $OUT: $(wc -l < "$OUT/FILES.txt") files, $MODS"
