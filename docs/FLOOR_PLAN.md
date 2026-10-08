# Tavern floor plan

The three tavern maps now share one readable work triangle, so players can learn the room while each theme keeps its own floor material and lighting. Counter art remains a separate one-cell gameplay object; the new backgrounds contain only floor runners and a central motif.

## Authored grid

`·` is walkable space. The grid is 12 columns wide; row 0 belongs to the rear-wall margin. West and east pantry wings sit over the long inlaid floor runners. The middle remains an aisle leading to the mixing medallion. The service bell and utility stations occupy the lower perimeter.

```text
       0  1  2  3  4  5  6  7  8  9 10 11
row 0  ·  ·  ·  ·  ·  ·  ·  ·  ·  ·  ·  ·
row 1  ·  C  S  ·  ·  K  ·  ·  ·  M  L  ·
row 2  ·  ·  ·  ·  ·  ·  ·  ·  ·  ·  ·  ·
row 3  ·  T  F  ·  ·  ·  X  ·  ·  O  R  ·
row 4  B  ·  ·  ·  Q  ·  ·  ·  V  ·  ·  ·
```

Ingredient keys: C catnip, R cream, K kelp, M moonmilk, L lime, T tuna, F fizz, O tonic, S stardust. X is the mixer, V the service bell, B the mop bucket, and Q the scrap bin.

This puts common recipes across both wings, increasing travel without creating a maze. The two pantry pairs in each wing form purposeful supply islands rather than one long wall of counters. A free central lane, open row 2, and bottom circuit provide alternate routes and multiplayer passing room. All four spawn positions start on the clear southern circuit.

## Visual and collision rules

- Cozy uses an amber inlaid rug, Haunted a moonlit medallion, and Pirate a compass rose. Each retains its original wall and floor perspective.
- Each counter remains exactly one `58 × 58` world-space cell. Floor art is decorative and never adds hidden collision.
- The playfield is visually lowered a little in its full-screen canvas so the rear floor edge is not crowded by the HUD.
- Every generated station must have a reachable interaction point from the spawn; tests validate this over multiple deterministic seeds and rounds.
