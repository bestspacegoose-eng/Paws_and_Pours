# Depth tile integration

The three project-owner-supplied 1254 × 1254 PNGs are stored unchanged in `client/assets/tilemap/`. `client/depth-tiles.ts` owns their crop coordinates and drawing helpers; `client/tavern-renderer.ts` integrates them into the existing in-game canvas.

- Cozy: lavender ceramic kitchen, warm wood dining floor, plaster-and-wood walls, lavender counter tops.
- Haunted: lavender kitchen and worn stone dining floor, recessed stone walls, sage counter tops.
- Pirate: lavender kitchen, dark wood dining floor, timber walls, wood counter tops.

Floor crops follow the painted column boundaries (0, 316, 629, 943), with warm wood, dark wood, ceramic, and stone at y=0, 314, 631, and 933 respectively. The irregular gutters on the counter and wall sheets require explicit crops rather than dividing the entire image into sixteen equal squares.

Counter tops are raised by 22 screen pixels. The fascia is drawn only on exposed southern edges, and the long bar has an eastern face toward the dining room. Props and the interaction outline follow the raised surface. Shadows are drawn under furniture before the existing objects are sorted by world depth. The floor projection, station footprints, interactions, movement, multiplayer state, and collision rules are unchanged. Existing surface art remains the fallback while the new images load.

Open `http://localhost:5173/scripts/depth-preview.html` with Vite running to inspect all three themes. The preview uses the real floor and counter renderer and authored station layout. Reference captures are in `docs/depth-cozy-preview.png`, `docs/depth-haunted-preview.png`, and `docs/depth-pirate-preview.png`.

Validation: production client/server builds, TypeScript checks, 28 existing tests, and all three theme previews without browser errors.

## Dining tiles and wall alignment

`client/dining-art.ts` uses `dining-furniture-v2.png` for the new tables, chairs, booth seats, and rugs. It reads measured alpha bounds, fits furniture to the existing station cells, and draws each rug as one continuous sprite. All themes retain the original lavender rug with a single rose-cream border; the table and upholstery match the existing rose-beige and mauve palette. Table numbers, customers, order bubbles, and patience indicators remain visible. Decorative dishes and candles were removed from tabletops.

Windows now share the same centerline at floor-top minus 61px, are scaled to 61px high, and sit at 10%, 50%, and 90% of the back wall. Shelves sit between them at 30% and 70%; smaller candle decorations stay clear of the counter line.

The preview includes a customer/order toggle. `docs/dining-occupied-preview.png` shows all four tables occupied, including an urgent order.
