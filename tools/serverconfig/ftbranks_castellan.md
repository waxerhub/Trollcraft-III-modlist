# The Castellan's title (FTB Ranks)

The Castellan (Part II's keeper of the spawn castle, see [STORY.md](../../STORY.md)) gets a `[Castellan]` title through FTB Ranks, which is already on the server.

## 1. Add the rank to `ranks.snbt`
The file is in the world's `serverconfig/ftbranks/` folder (`world/serverconfig/ftbranks/ranks.snbt`). Add this entry inside the outer `{ }`, next to the ranks already there:

```
castellan: {
	name: "Castellan"
	power: 50
	ftbranks.name_format: "<&6[Castellan]&r {name}>"
}
```
- **No `condition`:** the rank only applies to players it's given to.
- **`power: 50`** beats the default member rank (power 1), so her title wins. Give it a lower power than any staff rank you want to show instead.
- **Match the brackets to your existing ranks.** If your `member` rank's `name_format` has `<…>` around the name, keep them as above; if it doesn't, drop them.
- **Check it against your own file before saving.** This follows FTB Ranks' documented format; the FTB Ranks jar wasn't on hand to confirm the exact layout. A typo is reported in the server log and the old ranks stay in force.

## 2. Give it to her
```
/ftbranks reload
/ftbranks add <her username> castellan
```
Take it away with `/ftbranks remove <her username> castellan`.

## Where it shows
- **In-game chat:** FTB Ranks' `name_format` changes how her name looks in chat messages.
- **Tab list and Discord:** these use the player's display name, which FTB Ranks may not change. If the title doesn't show there, add it as an FTB Essentials nickname as well: `/nicknamefor <her username> &6[Castellan]&r <her name>`. `tab_nicknames.js` refreshes the tab list, and Simple Discord Link uses the display name.

## The castle
Her building rights in the castle come from `kubejs/server_scripts/protected_areas.js`: uncomment the "The Castle" entry, fill in the castle's two corners and her username, then `/reload`. `allowUse: true` lets everyone open doors and press buttons there. Only she (and ops) can break or place.

**Vanilla spawn protection:** if `spawn-protection` in `server.properties` covers the castle, she can't build there either, because only ops are exempt. Set it to `0` and let `protected_areas.js` do the job.
