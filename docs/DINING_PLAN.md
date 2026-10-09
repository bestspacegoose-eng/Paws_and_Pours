# Cozy kitchen and dining revision

1. Keep server authority, recipes, preparation sessions, shared pause, and drink quality/handoffs unchanged.
2. Author a left kitchen (columns 0–8) and right dining room (9–15), with a three-cell bar opening at rows 6–8. A compact preparation island keeps every pantry and working surface reachable.
3. Four dining destinations: two upholstered booths and two chair/table pairs. Each furniture component is exactly one grid cell, using the same collision geometry as counters. Decorative rugs remain walkable.
4. Assign each incoming order to an unoccupied table on the server. Display its number in the top ticket and show the seated customer in the room. Require the matching drink at that exact table. Wrong-table attempts retain the drink.
5. Replace high-frequency realistic material textures with muted, code-native pixel surfaces. Generate a pastel decoration atlas, proportionally contained at render time; use decorations over a flat title background.
6. Validate grid uniqueness, all-station reachability, safe spawns, build/types, and two-client mixing, handoff, wrong-table rejection, correct-table delivery, and shared pause. Inspect title/game visually in browser.

Save compatibility: solo saves contain profile/progress metadata, not old map coordinates or order geometry. Rooms receive the new authored layout on a new shift/server start. No saved profile schema change is needed.
