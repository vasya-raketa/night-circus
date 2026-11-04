import Phaser from 'phaser';
import { createPalette } from '../render/palette.js';

// Screen-space backdrop: dark blue tent with soft drifting spotlights that
// scroll with a little parallax against the game camera.
export default class BackgroundScene extends Phaser.Scene {
  constructor() {
    super({ key: 'Background', active: true });
  }

  create() {
    this.tuning = this.registry.get('tuning');
    this.palette = createPalette(this.tuning.colors);
    this.g = this.add.graphics();
    this.time0 = 0;
  }

  update(_time, delta) {
    const b = this.tuning.background;
    const p = this.palette;
    const g = this.g;
    const w = this.scale.width;
    const h = this.scale.height;
    const demo = this.scene.get(this.registry.get('gameKey'));
    const cam = demo.cameras && demo.cameras.main;
    const scroll = cam ? cam.scrollX * cam.zoom : 0;
    const unit = h / this.tuning.world.viewHeight;
    this.time0 += delta / 1000;

    g.clear();
    g.fillStyle(p.background, 1);
    g.fillRect(0, 0, w, h);

    // Soft tent folds.
    const band = w / b.bandCount;
    g.fillStyle(p.purple, b.bandAlpha);
    for (let i = 0; i < b.bandCount; i += 2) g.fillRect(i * band, 0, band, h);

    const spacing = b.spotSpacing * unit;
    const total = spacing * b.spotlights;
    const offset = scroll * b.spotParallax;
    for (let i = 0; i < b.spotlights; i++) {
      const x = ((((i * spacing - offset) % total) + total) % total) - spacing / 2;
      const drift = Math.sin(this.time0 * b.spotDrift + i) * b.spotDriftAmount * unit;
      const y = h * (b.spotY + Math.sin(i * b.spotPhaseStep) * b.spotYJitter);
      for (let k = x; k < w + spacing; k += total) this.spot(k + drift, y, b.spotRadius * unit);
    }
  }

  spot(x, y, radius) {
    const b = this.tuning.background;
    this.g.fillStyle(this.palette.spotlight, b.spotAlpha);
    for (let r = 1; r <= b.spotRings; r++) this.g.fillCircle(x, y, (radius * r) / b.spotRings);
  }
}
