# Paws & Pours expansion plan

## Current architecture audit

Paws & Pours is a compact server-authoritative multiplayer prototype:

- `shared/game.ts` owns serializable game types, recipes, deterministic tavern generation, and shared lookup helpers.
- `server/index.ts` owns rooms, player identity/reconnection, movement, interactions, shift timing, orders, hazards, rewards, and round changes.
- `client/main.ts` owns the DOM shell, keyboard input, local movement prediction, canvas rendering, asset loading, and Socket.IO presentation.
- The generated tavern backgrounds are decorative 2.5D scenes. Stations are currently free-positioned points with no collision footprint.
- Recipes currently resolve from an unordered set of three gathered ingredients and produce a drink immediately at the mixer.
- The UI is derived from each server snapshot. Lobby, upgrade, and run-complete states use one modal layer; gameplay has no pause/settings state.
- The asset pipeline uses PNG imports through Vite. Runtime atlas rectangles are declared in the canvas renderer; there is no separate manifest file.

The repository has no persistent save or authored level files to migrate. Deterministic seeded taverns are the compatibility surface, so the grid migration must remain deterministic for an existing `(seed, round)` pair.

## Visual-language audit

The existing generated art establishes these rules for new assets:

- **Palette:** dark plum outlines and shadows, warm cream highlights, and compact theme palettes: amber/terracotta for Cozy, violet/periwinkle for Haunted, and teal/navy/brass for Pirate.
- **Line weight:** crisp dark silhouettes, normally two to four source pixels after down-sampling, with a slightly irregular hand-pixelled edge.
- **Shading:** two to four stepped values per material, selective bright specular pixels, soft scene glows, and restrained gradients only in environmental lighting.
- **Perspective:** a shallow 2.5D/isometric tavern floor; props use a high three-quarter view. The new mixing scene intentionally changes to first person while retaining the same shallow pixel-art perspective and lighting.
- **Characters:** chibi cats with a head approximately half the total height, large readable eyes, short limbs, and strong silhouettes.
- **Outlines:** near-black purple rather than pure black, plus a narrow coloured rim on lit edges.
- **Texture:** moderate material texture in backgrounds, simpler high-readability objects in atlases.
- **Canvas and export:** the game renders at `800 × 480` with nearest-neighbour scaling. Background sources are approximately `1619 × 971` RGB PNGs; current atlases are approximately `1320 × 1192` RGBA PNGs; current counter props are `1536 × 1024` RGBA PNGs.
- **Naming:** lowercase kebab-case PNG names under `client/assets/tilemap/`, with a subject and optional theme suffix.

## Architecture decisions

### Mixing workspace ownership

Each player receives an individual workspace while the shared tavern shift continues for everyone else.

This matches the existing per-player inventory and reconnect identity, does not freeze the authoritative room clock, and prevents one player from forcing all clients into a modal. The server owns a serializable mixing session per player. The client only presents that session and submits discrete actions. Other clients can see that the cat is busy, but do not receive control of the session.

### Data and authority

- `Recipe.ingredients` remains the sole ingredient list.
- Each recipe adds only preparation metadata: timed tool actions and their timing windows.
- A shared helper derives the complete action sequence from the ingredient list plus preparation metadata; the workspace never hardcodes a recipe.
- The server timestamps tool start/finish, validates sequence order, counts mistakes, resolves timeout/failure, computes quality, and awards the finished drink.
- Cancelling preserves gathered ingredients. Three mistakes or a session timeout fails the attempt and consumes them. Success consumes ingredients and creates a drink with a quality value.
- Movement and tavern interactions are disabled only for the player who is currently mixing. Other players and the shift simulation continue normally.
- Serving rewards combine remaining customer patience with drink quality, retaining the current customer-order loop while making preparation accuracy meaningful.

### Square counter primitive

- Shared constants define grid origin, cell size, board bounds, and player collision radius.
- Every station occupies one `gridX/gridY` cell and exposes a square world-space collision box exactly one cell wide and high.
- Station world positions are derived from the cell centre, not independently authored.
- The deterministic generator places the ingredient bank, mixer, service bell, and utility station into unique cells.
- One shared axis-separated collision resolver is used by server movement and client prediction. This preserves responsiveness without client/server disagreement.
- Counter art is rendered into one fixed cell-sized destination. Connected variants change the drawing within that footprint; they never change gameplay dimensions.

## Implementation phases and dependencies

### Phase 1 — foundation

1. Add grid/counter types, recipe preparation metadata, mixing-session types, and pure helpers in shared code.
2. Migrate deterministic tavern generation to unique grid cells.
3. Add pure collision, sequence, timing, and quality tests.

Dependency: complete before changing server or client behavior so both consumers use the same rules.

### Phase 2 — authoritative mixing loop

1. Replace instant crafting at the mix station with session creation.
2. Add ingredient selection, timed-tool start/finish, cancel, timeout, mistake, failure, and success messages.
3. Store drink quality and combine it with order patience during serving.
4. Clear or safely retain sessions across round changes, disconnects, and reconnects.

Dependency: shared phase complete.

### Phase 3 — art production and integration

1. Generate the workspace background and atlases using existing tavern, ingredient, character, and counter art as references.
2. Keep source alpha on object sheets and validate dimensions/transparency before integration.
3. Import every runtime asset through Vite and document atlas rectangles.
4. Retain existing ingredient art rather than replacing it.

Dependency: asset inventory and runtime frame plan complete. This phase can overlap with the workspace renderer after filenames and layout are fixed.

### Phase 4 — client workspace and counters

1. Add a dedicated mixing presentation module with its own canvas, input mapping, accessibility labels, progress, cancel control, and server event adapter.
2. Transition only the active player from the tavern canvas to the first-person workspace and return automatically on success/failure/cancel.
3. Suppress local movement input while mixing and show a multiplayer “mixing” indicator on the shared crew state.
4. Render one square counter block per station, apply connection variants, and remove the old stretched ingredient table.
5. Run local prediction through the shared collision resolver.

Dependency: phases 1–3.

### Phase 5 — verification and handoff

1. Run type checking, production build, and automated tests.
2. Test ingredient gathering → workspace → ordered ingredients → timed tool → finished drink → serve.
3. Test wrong order, mistimed tool, three-mistake failure, cancel, timeout, and reconnect.
4. Test movement against every counter edge and corner, including simultaneous two-client movement.
5. Open two independent browser contexts in one room and verify one player can mix while the other moves/interacts, with synchronized results.
6. Update README and testing notes; list deferred UI work explicitly.

## Mixing workspace sprite inventory

### Workspace background

- `mixing-workspace.png` — first-person tavern workbench, rear shelves, clear table surface, neutral enough to harmonize with all three themes.
- Reuse theme colour tint/lighting in code rather than duplicating a full workspace per theme in the first slice.

### Table and tabletop

- The front lip, work surface, soft shadow zones, and inset preparation mat are part of `mixing-workspace.png` so the perspective remains coherent.
- Square tavern counter tops are separate themed atlases listed below.

### Ingredient containers and ingredients

- Reuse all nine frames in `ingredients-spritesheet.png`: catnip, lime, fizz, moonmilk, cream, stardust, tuna, tonic, and kelp.
- Bottles, jugs, and bundles already function as their ingredient containers; no duplicate icon set is needed.

### Mixing tools and glassware

- `mixing-tools-spritesheet.png`, transparent 3 × 2 atlas:
  - cocktail shaker;
  - stirring spoon and small mixing bowl;
  - measured pouring bottle;
  - tall cooler glass;
  - moonmilk mug;
  - tonic goblet.

### Garnishes

- The current recipes use lime, catnip, kelp, and stardust as ingredients and visual garnish cues; their existing frames are reused.
- Dedicated garnish-only frames are deferred until garnishing becomes an authored preparation action.

### Interaction, progress, and result effects

- `mixing-effects-spritesheet.png`, transparent 3 × 2 atlas:
  - neutral first-person cat paws;
  - active/pressing cat paws;
  - success sparkle burst;
  - failure spill/splash;
  - timing/progress droplet;
  - multiplayer mixing indicator.
- DOM focus rings and text labels remain code-native for keyboard accessibility and localisation.

### Counter blocks

Each file is a transparent 4 × 2 atlas with identical cell layout:

- `counter-blocks-cozy.png`
- `counter-blocks-haunted.png`
- `counter-blocks-pirate.png`

Atlas order:

1. standard block;
2. end-cap block;
3. corner block;
4. ingredient station block;
5. mixing/preparation block;
6. decorative/service block;
7. damaged/utility block;
8. reserved blank-compatible block.

All visual variants occupy the same square gameplay footprint. Runtime neighbour selection may choose a connected face, but never changes collision or placement.

## Risks and mitigations

- **Perspective transition:** a modal can feel detached from gameplay. Use the same palette, hard pixel edges, ingredient sprites, cat paws, and a short visual transition; keep shift status visible.
- **Multiplayer desynchronization:** never allow the client to advance a step locally as authoritative truth. Show optimistic press feedback only; render progress from the next server snapshot.
- **Clock disagreement:** measure timed tools using server timestamps. Client animation is presentation only.
- **Movement snap-back:** use one shared collision resolver for local prediction and the server, and preserve movement sequence acknowledgements.
- **Procedural overlap:** validate unique occupied cells and deterministic output in tests.
- **Generated atlas inconsistency:** use the same reference images and one explicit frame layout per sheet; inspect alpha, silhouettes, and frame bounds before coding rectangles.
- **Accessibility:** canvas art alone is insufficient. Mirror each interactive ingredient/tool with labelled buttons, keyboard focus, status text, and reduced-motion styling.
- **Environment validation:** the current shell does not expose Node/npm on `PATH`; implementation can proceed, but build/test verification requires locating the installed project runtime or restoring that toolchain.

## Larger game roadmap

1. **Core co-op foundation:** authoritative collision, square stations, reconnect-safe activities, input abstraction, deterministic level validation.
2. **Bartending depth:** multiple preparation actions, stations, ingredient states, recipe modifiers, shared hand-offs, hazards that affect preparation, and richer quality scoring.
3. **Roguelike structure:** persistent run inventory, upgrade application rather than message-only upgrades, themed room layouts, difficulty curves, bosses/events, and seeded run summaries.
4. **Content pipeline:** authored recipe data, atlas manifests, animation metadata, art validation, audio cues, and theme-specific props.
5. **UX/accessibility:** menu/settings system, remapping, controller/touch support, readable status alternatives, reduced motion, scalable/pixel-perfect rendering, audio mixing, and localisation.
6. **Online hardening:** rate limits, explicit session expiry, host migration, spectator/rejoin rules, metrics, persistence, and deployment smoke tests.

## Future UI redesign (planned, not part of this feature pass)

The next UI phase should introduce a UI state store independent from `GameState`. Local menu state must never pause, mutate, or disconnect the shared simulation.

Planned surfaces:

- persistent gameplay menu button with keyboard/controller shortcut;
- non-blocking pause/settings shell (the online shift continues and says so clearly);
- fullscreen, resolution/scaling, pixel-perfect mode, brightness, and reduced motion;
- master/music/effects volume and mute;
- keyboard remapping, mouse sensitivity where relevant, controller mapping, and focus-visible navigation;
- safe-area/responsive HUD layouts and text-scale controls;
- local persistence for preferences, separate from room and simulation state.

Foundation allowed in this pass: the mixing workspace will keep modal/presentation state separate from authoritative simulation state and expose accessible DOM controls. A general settings menu is intentionally deferred until its state/input architecture can be applied consistently across lobby, tavern, and mixing views.
