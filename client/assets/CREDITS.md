# Photo credits

These source photos were downloaded from Unsplash and transformed locally by
background removal (the hero image) and pixelation.

- Tabby — Kabo, [Unsplash](https://unsplash.com/photos/p6yH8VmGqxo)
- Siamese — Alex Meier, [Unsplash](https://unsplash.com/photos/KGiQFgF7dkc)
- Maine Coon — [Unsplash](https://unsplash.com/photos/1543055484-ac8fe612bf31)
- Black cat — Bob van Aubel, [Unsplash](https://unsplash.com/photos/mkR6kHxBARU)
- Calico — Tim van der Kuip, [Unsplash](https://unsplash.com/photos/mdRJhxlsuGM)

# Environment art

The Cozy Village Pub, Haunted Moonlit Inn, and Pirate Cat Tavern backgrounds
were generated with OpenAI's image-generation tool using the project's supplied
`purple-counter.png`, `cat-base.png`, and `cat-eyes.png` artwork as visual-style
references. The generated files are used as the three runtime tavern maps.

The animated cat-bartender spritesheet, nine-ingredient spritesheet, and three
theme-matched counter props were generated with the same tool and the runtime
tavern maps as style references. Their transparent originals are kept intact and
sliced by the canvas renderer at runtime.

The first-person `mixing-workspace.png`, transparent `mixing-tools-spritesheet.png`,
transparent `mixing-effects-spritesheet.png`, and the Cozy, Haunted, and Pirate
`counter-blocks-*.png` atlases were generated with OpenAI's image-generation tool.
The existing tavern backgrounds, ingredient atlas, bartender atlas, and counter
props were supplied as visual references so palette, outlines, lighting, texture,
and pixel scale remain consistent. The themed block atlases share an identical
4 × 2 runtime frame order and the object atlases preserve their generated alpha.
