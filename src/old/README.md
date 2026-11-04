# Old demos

Kept for reference; not linked from the menu or bundled.

- `scenes/DemoScene.js`: "Swing & Let Go" (phase-based launch, endless obstacles).
- `scenes/FixedJumpScene.js`: first fixed-arc prototype (now the main game in `src/scenes/GameScene.js`).
- `scenes/PyramidScene.js`: human pyramid.
- `scenes/FlipsScene.js`: trampoline flips.

To run one again, import it in `src/main.js`, add it to the Phaser `scene` list
and set the registry `gameKey` to its key (`Demo`, `FixedJump`, `Pyramid`, `Flips`).
- `objects/TentCollapse.js`: area effect #33, replaced by the pressure modes (chaser / burning rope / auto-scroll).

Their numbers are still in `src/config/tuning.json` (`swing`, `launch`, `generator`, `obstacles`, `fixedJump`, `pyramid`, `flips`).
