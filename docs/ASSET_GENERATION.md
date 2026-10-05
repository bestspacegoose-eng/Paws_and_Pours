# Mixing asset generation record

All assets below were created with the built-in OpenAI image-generation tool and then copied into `client/assets/tilemap/`. Existing project art was passed as reference imagery; no fallback CLI or external model was used.

## Shared production constraints

- crisp hand-pixelled game art;
- dark plum/navy outlines and compact two-to-four-tone shading;
- upper-left tavern lighting, cream highlights, violet shadows;
- no text, logos, borders, watermark, or unrelated props;
- transparent object-sheet backgrounds with transparent gutters;
- fixed, evenly spaced atlas layouts and complete uncropped silhouettes.

## Prompt set

### `mixing-workspace.png`

Create a polished first-person 2D fantasy-tavern preparation workbench matching the three existing tavern backgrounds and current sprite scale. Use a straight-on approximately 5:3 composition, shelves in the upper background, and a broad wooden table with an empty inset mat and clear ingredient/tool zones. Keep the palette theme-neutral: dark plum, walnut, terracotta, cream, muted violet, and brass. Background only; no characters, paws, ingredients, tools, glassware, labels, or UI.

### `mixing-tools-spritesheet.png`

Create a transparent strict 3 × 2 atlas matching the ingredient sprites. Fixed order: silver/brass cocktail shaker; wooden bowl and stirring spoon; measured pouring bottle; empty tall cooler glass; cream moonmilk mug; teal tonic goblet. One centred object per equal cell with consistent scale and generous alpha padding.

### `mixing-effects-spritesheet.png`

Create a transparent strict 3 × 2 atlas matching the chibi bartender. Fixed order: neutral first-person cat paws; active/gripping paws; golden success sparkles; purple-red failure spill; teal/brass progress droplet; overlapping multiplayer paw indicator. One centred sprite per equal cell with transparent gutters.

### `counter-blocks-cozy.png`

Create a transparent strict 4 × 2 atlas of identical one-cell Cozy counter blocks, preserving the existing warm walnut, terracotta, plum, and brass style. Fixed order: standard; end-cap; corner; ingredient tray; mixing block with shaker emblem; service block with brass bell; damaged utility block; plain connector. Every frame must have the same square footprint, perspective, scale, and connectable seam endpoints.

### `counter-blocks-haunted.png`

Preserve the Cozy atlas layout and proportions, but restyle it from the existing Haunted counter/background using charcoal violet, slate, periwinkle/silver trim, moonlit highlights, a crescent/spoon mixing emblem, spectral bell, and cracked slate utility block.

### `counter-blocks-pirate.png`

Preserve the Cozy atlas layout and proportions, but restyle it from the existing Pirate counter/background using teal-stained ship timber, dark brown supports, weathered brass/iron, rope details, a shaker/anchor mixing emblem, ship bell, and split-plank utility block.

## Validation

- `mixing-workspace.png`: 1619 × 971 RGB PNG.
- Tool and effect atlases: 1536 × 1024 RGBA PNGs.
- Themed counter atlases: 1774 × 887 RGBA PNGs.
- All files are imported through Vite and sliced by `client/sprite-frames.ts` or equal atlas cells at runtime.
