# Tavern floor plan

The room uses a 16 × 11 grid. Each world cell is 58 × 58 units; the camera compresses vertical screen distance uniformly. Counter drawing and collision share `stationBounds`. Dining tables occupy two cells, while chair collision is narrower than a full cell.

```text
        0 1 2 3 4 5 6 7 8 9 A B C D E F
row 0   · C # S # K M # # · · · · · · ·
row 1   # · · · · · · · a s · b b · b b
row 2   L · · · · · · · # · · 1 = · 2 =
row 3   T · · X # · · · a s · · · · · ·
row 4   # · · # # · · · # · · · · · · ·
row 5   R · · H X · · · a s · · · · · ·
row 6   # · · · · · · · · · · c c · c c
row 7   F · · · · · · · · · · 3 = · 4 =
row 8   O · · · · · · · · · · · · · · ·
row 9   # · · · · · · · a s · · · · · ·
row A   · B # Q # # # # # · · · · · · ·
```

C catnip, S stardust, K kelp, M moonmilk, L lime, T tuna, F fizz, R cream, O tonic. X mixing workspace, H chopping board, B cleaning sink, Q scrap bin. b booth chair, c dining chair, s bar stool, a bar service counter, 1–4 serving tables, = the second half of a table. # is a preparation counter. Dots and rugs are clear floor.

The left kitchen has a compact preparation island. All ingredients remain on its left and back edges, away from guest service. A three-cell opening in the dividing bar leads into the dining room. Four players spawn in the lower kitchen. Each dining table seats two guests; four bar stools provide four further seats. The three themes share this collision layout and use their own furniture artwork with quiet lavender rugs.

Orders reserve individual seats and show Table 1 · A/B or Bar 1–4 on the ticket. Press E or tap Interact at the matching table, chair, or bar counter to serve. A table can accept a drink for either guest; a chair accepts its occupant's order. Wrong delivery retains the drink. The active-order limit remains two in solo and three in multiplayer, so available seats do not force a crowded room.

Finished drinks can be placed on preparation, ingredient, or mixing surfaces with E or the single mobile action button; Q remains a keyboard shortcut. The same action retrieves a drink occupying a work surface. Quality travels with the drink. Occupied hands and counters reject an overwrite. A new round starts with clean counters and clear spawns.

See [SEATING.md](SEATING.md) for seat assignments, save migration, visual alignment, and verification captures.
