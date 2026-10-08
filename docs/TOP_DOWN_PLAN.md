# Elevated tavern redesign

The reference informs the high camera, connected kitchen counters, generous work aisles, and illustrated order tickets. Paws & Pours keeps its purple fantasy palette, cat animation, ingredient drawings, and private mixing workspace.

1. Expand the shared world to 16 × 11 square cells. Build a perimeter supply bar, two 2 × 4 preparation islands, and a front service run. Leave two-cell upper aisles and three-cell central/lower circulation. Use the same cell rectangles for drawing and collision.
2. Store finished drinks (recipe plus quality) on authoritative station state. E transfers drinks at ordinary counters; Q transfers at other work surfaces. Transfers are atomic, refuse occupied hands/surfaces, and are visible to the entire crew. Round changes create fresh surfaces.
3. Render an elevated orthographic floor with a short visible counter front. Replace the mismatched scenic backdrop and isolated cube atlas in the tavern only. Reuse existing character/ingredient assets. Keep pixel edges and distinct theme palettes.
4. Reserve a top strip for illustrated orders, ingredients, and patience. Reserve a separate playfield below it so UI cannot obscure the back of the room.
5. Validate every station's reachability, collision along counter faces/corners, clear spawns, transfer ownership/quality, and the real two-client gathering → mixing → counter handoff → serving flow. Inspect the composed browser scene.

The layout is authored and themes remain seeded. Decorative floor details never introduce collision. Gameplay data, rendering, and order UI remain separate. Existing solo saves hold profile/progression rather than station snapshots, so no persisted room migration is required.
