import Phaser from 'phaser';
import defaults from './config/tuning.json';
import BackgroundScene from './scenes/BackgroundScene.js';
import GameScene from './scenes/GameScene.js';
import HudScene from './scenes/HudScene.js';
import DebugPanel from './ui/DebugPanel.js';
import App from './ui/App.js';
import { createSession } from './ui/session.js';

// ?            -> main menu (Play / Playground)
// ?playground  -> straight to the playground
// &debug adds the tuning panel, &seed=N fixes the course layout.
// The old demos live in src/old (see src/old/README.md).
const params = new URLSearchParams(location.search);

async function boot() {
  const tuning = structuredClone(defaults);
  const session = await createSession(tuning);
  const ratio = Math.min(window.devicePixelRatio || 1, tuning.display.maxPixelRatio);
  const size = () => ({ width: Math.round(window.innerWidth * ratio), height: Math.round(window.innerHeight * ratio) });

  // The canvas is rendered at device resolution and shown at CSS size for crisp lines.
  const game = new Phaser.Game({
    type: Phaser.AUTO,
    parent: 'game',
    backgroundColor: tuning.colors.background,
    ...size(),
    scale: { mode: Phaser.Scale.NONE, zoom: 1 / ratio },
    antialias: true,
    callbacks: {
      preBoot: (g) => {
        g.registry.set('tuning', tuning);
        g.registry.set('pixelRatio', ratio);
        g.registry.set('debug', params.has('debug'));
        g.registry.set('gameKey', 'Game');
        g.registry.set('session', session);
        const seed = params.get('seed');
        g.registry.set('seed', seed === null ? null : Number(seed));
      }
    },
    scene: [BackgroundScene, GameScene, HudScene]
  });

  window.addEventListener('resize', () => {
    const { width, height } = size();
    game.scale.resize(width, height);
  });

  // Wait until the game scene has been created before driving it from the UI.
  const whenReady = (fn) => (game.scene.getScene('Game')?.world ? fn() : requestAnimationFrame(() => whenReady(fn)));
  whenReady(() => {
    const app = new App(game, tuning, session);
    if (params.has('playground')) app.showPlayground();
    else app.showMenu();
    if (params.has('debug')) {
      window.__game = game;
      window.__app = app;
      new DebugPanel(tuning, defaults, { onRestart: () => game.scene.getScene('Game').resetRun(), sliders: tuning.game.sliders, checkboxes: [] });
    }
  });
}

boot();
