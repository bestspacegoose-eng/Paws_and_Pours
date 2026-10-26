# Minigame pixel art

`client/assets/tilemap/minigame-props-v1.png` is the new transparent 1536 × 1024 atlas. Its twelve drawings share the tavern's cocoa, plum, cream, lavender, rose, and sage palette: wooden bowl, separate spoon, chopping board, cleaver, shaker, pouring bottle, left and right paws, tuna pieces, lime wedges, kelp ribbons, and catnip leaves. It was generated using the built-in imagegen tool; the exact prompt is saved in [MINIGAME_ART_PROMPTS.txt](MINIGAME_ART_PROMPTS.txt).

All five preparation activities use the new art:

- Shaking: illustrated shaker with separate gripping paws.
- Stirring: fixed wooden bowl, recipe-colored liquid, independently moving spoon, and a painted foreground rim that hides the submerged tip.
- Pouring: illustrated bottle rotating about its measured spout, with the stream ending inside the serving glass.
- Chopping: illustrated board and cleaver, with lime or kelp matching the recipe. A small second group of pieces appears as chopping progresses.
- Paw mixing: illustrated bowl and spoon, with separate alternating paws. The bowl remains stationary.

The new ingredient drawings also appear when adding ingredients. Existing serving-glass art, finished drinks, workbench background, menu, and original colors are retained.

`client/minigame-art-layout.ts` contains the measured sprite rectangles and source anchors. `client/minigame-art.ts` loads the atlas once, redraws on load, and shares its drawing helpers between the preparation scenes. Glass crops remain separate in `client/mixing-layout.ts`; the bottle's crop and tip travel with its pouring layout, including in the collision regression test.

## Verification

- All ten preparation actions across seven recipes checked in Chromium at 1200 × 950, 390 × 844, and 844 × 390, without page errors or horizontal overflow.
- All seven drinks completed against the game server with actual touch events, including a 320 × 740 spoon scene and landscape pouring/paw-mixing scenes. Finished drinks were placed on and picked up from counters.
- Pixel captures confirmed visible shaker, spoon, cleaver, and paw movement; the bowl body remains unchanged between spoon frames. All five activities remain still under pause and reduced motion.
- 42 automated tests, client/server TypeScript checks, production build, multiplayer smoke test, and `git diff --check` passed. Pouring geometry still clears all three cup shapes throughout the tilt.
- Browser checks used Chrome mobile emulation, not physical phones or Safari.

## Review captures

- [Stirring](minigame-art-moonmilk-0-canvas.png)
- [Shaking](minigame-art-lunar-fizz-1-canvas.png)
- [Pouring](minigame-art-tuna-0-canvas.png)
- [Chopping](minigame-art-lunar-fizz-0-canvas.png)
- [Paw mixing](minigame-art-kelp-swirl-0-canvas.png)
- [Small phone](minigame-art-live-moonmilk-320.png)
- [Landscape phone](minigame-art-live-tuna-844.png)

The interactive recipe/action picker is available at `/scripts/mixing-preview.html` on the development server.
