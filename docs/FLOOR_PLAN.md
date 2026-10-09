# Tavern floor plan

The room uses a 16 × 11 square grid in an elevated top-down projection. Each world cell is 58 × 58 units; the camera compresses vertical screen distance uniformly. Counter drawing and collision both use `stationBounds`, including connected runs and island corners.

```text
        0 1 2 3 4 5 6 7 8 9 A B C D E F
row 0   · C # S # K # M # · · · · · · ·
row 1   # · · · · · · · # · · b · · b ·
row 2   # · · · · · · · # · · 1 · · 2 ·
row 3   T · · X # · · · L · · · · · · ·
row 4   # · · # # · · · # · · · · · · ·
row 5   # · · # X · · · R · · · · · · ·
row 6   # · · · · · · · · · · c · · c ·
row 7   F · · · · · · · · · · 3 · · 4 ·
row 8   # · · · · · · · · · · · · · · ·
row 9   # · · · · · · · O · · · · · · ·
row A   · B # Q # # # # # · · · · · · ·
```

C catnip, S stardust, K kelp, M moonmilk, L lime, T tuna, F fizz, R cream, O tonic. X mixing workspace, B cleaning sink, Q scrap bin. b upholstered booth, c dining chair, 1–4 serving tables. # is a usable preparation counter. Dots and rugs are clear floor.

The left kitchen has a compact preparation island and distributed ingredients. A three-cell opening in the dividing bar leads into the right dining room. All four players spawn in the lower kitchen. Players must carry drinks to the matching numbered table and press E. Server-owned orders reserve unique tables; wrong-table delivery retains the drink. Guests appear at their seats while orders are active.

Finished drinks can be placed on any preparation, ingredient, or mixing surface with Q. E also handles ordinary-counter handoffs and retrieves a drink occupying a work surface. Ownership changes on the server; quality travels with the drink. Occupied hands and occupied counters reject an overwrite. A new round starts with clean counters and clear spawns.

The room uses muted lavender, rose, sage and cream code-native surfaces instead of high-frequency wood textures. Proportionally contained pixel decorations are described in [COZY_DINING_ART.md](COZY_DINING_ART.md). Ornaments never introduce hidden collision. Orders and illustrated ingredients occupy the top strip.
