# Finale track pack

The sound for the Pig Escort finale track (`FINALE_TRACK` in `kubejs/server_scripts/events/pig_escort.js`).
Players need these files on their own computer. The server only tells their game to play
`trollcraft:finale_track`. The full steps are in `tools/kubejs/PIG_ESCORT.md` under "The finale track".

1. Put the track in `assets/trollcraft/sounds/` as `finale_track.ogg`. It must be Ogg Vorbis: a renamed MP3 won't play.
2. Get it to the players, in one of two ways:
   - **In the modpack:** copy `assets/trollcraft/` into the pack's `kubejs/assets/`, so it ends up as
     `kubejs/assets/trollcraft/sounds.json` and `kubejs/assets/trollcraft/sounds/finale_track.ogg`, then release a pack update.
   - **As a server resource pack:** zip `pack.mcmeta` and `assets/` (they must sit at the top of the zip) and set it in `server.properties`.
