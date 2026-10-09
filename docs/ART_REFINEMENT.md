# Pixel art refinement

The elevated room keeps gameplay geometry authored in the 16 × 11 shared grid. New materials and ornaments add detail without moving any collision edge. The original cat and ingredient artwork is reused.

## Integrated assets

- `client/assets/tilemap/drinks-complete-atlas.png`: all seven recipes, with tight per-drink bounds in `client/drink-sprites.ts`. One renderer serves orders, carried and placed drinks, recipe pages, and mixing results. The saved PNG has an alpha channel; the RGB-only generation preview can display colors in otherwise transparent regions.
- `client/assets/tilemap/tavern-materials.png`: six opaque swatches, three floors and three countertops. Source swatches are mapped into the exact gameplay rectangles.
- `client/assets/tilemap/tavern-decor.png`: transparent shelves, stained-glass window, planter, barrel, candlestick, and books. Wall and perimeter decorations do not occupy walkable space; counter ornaments remain inside their cells and clear when a drink is placed.

Generated with the built-in image generation tool. Final prompt set:

1. **Drink atlas:** Create a new 4-column, 2-row pixel-art atlas on genuine transparency, using the original drink sheet as style reference. Seven isolated drinks in recipe order: Catnip Cooler (green soda, catnip, lime); Moonmilk Latte (lavender mug, cream, crescent); Tuna Tonic (turquoise goblet, fish garnish, kelp); Lunar Fizz (lilac fizz, crescent lime); Kelp Swirl (seafoam goblet, kelp spiral); Star Spritz (pink-purple spritz, star, lime); Seafoam Shake (teal mug, whipped cream, fish garnish). Eighth cell empty. Deep plum outlines, gold details, lavender highlights, consistent pixel size and light. No backdrop, text, frames, shadows, or glow outside silhouettes.
2. **Material atlas:** Six equal 512-pixel square panels in a 3 × 2 atlas. Top row: honey oak parquet, moonlit lavender flagstone, weathered teak. Bottom row: polished plum walnut, midnight blue slate, petrol-teal wood. Straight overhead material surfaces, detailed 16-bit pixel clusters, fine grain and wear, restrained contrast. No objects, text, gutters, borders, cast shadows, or perspective.
3. **Decor atlas:** Six isolated props on transparency in a 3 × 2 grid: ornate potion-and-herb shelf, arched purple crescent stained-glass window, fern planter, gold-hooped oak barrel with plum cloth, three-arm candlestick, stacked purple recipe books. Detailed pixel art, elevated 3/4 view, aubergine outlines, amber light, violet shadows. No floor, scene, text, labels, or external glow.

## Character alignment

`client/character-anchors.ts` records head, eye, neck, and foot landmarks in source pixels for each animation frame and portrait. `client/accessory-art.ts` is shared by title and gameplay rendering. Sprite padding and tails no longer determine accessory centers. Right-facing source crops exclude the next row; back-facing crops include the ear tips. Portraits use consistent visible-body height and leave room for the hat.

The development-only gallery at `/scripts/art-preview.html` covers every combination. `docs/art-alignment-preview.png` records the visual inspection. No generated file outside the repository is needed at runtime.
