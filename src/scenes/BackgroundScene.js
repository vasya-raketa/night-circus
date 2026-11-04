import Phaser from 'phaser';
import { createPalette } from '../render/palette.js';

// Screen-space backdrop. Painted: the generated tent image (wide on landscape, tall on portrait),
// scaled to the screen height and scrolled with parallax; alternate copies are mirrored so the
// repeats meet without a seam. Otherwise (Playground toggle): dark blue tent with soft drifting
// spotlights drawn with shapes.
export default class BackgroundScene extends Phaser.Scene {
  constructor() {
    super({ key: 'Background', active: true });
  }

  preload() {
    const imgs = this.registry.get('tuning').background.images;
    for (const [key, url] of Object.entries(imgs)) this.load.image(`bg_${key}`, url);
  }

  create() {
    this.tuning = this.registry.get('tuning');
    this.palette = createPalette(this.tuning.colors);
    this.tiles = [];
    this.g = this.add.graphics();
    this.g.setDepth(1);
    this.time0 = 0;
  }

  get painted() {
    return this.registry.get('session')?.settings.paintedBg !== false;
  }

  // Positions mirrored copies of the image across the screen; returns false if it is not loaded.
  drawImage(w, h, scroll) {
    const key = w >= h ? 'bg_wide' : 'bg_tall';
    if (!this.textures.exists(key)) return false;
    const src = this.textures.get(key).getSourceImage();
    const scale = Math.max(h / src.height, w / src.width);
    const tw = src.width * scale;
    const offset = scroll * this.tuning.background.imageParallax;
    const first = Math.floor(offset / tw);
    const count = Math.ceil(w / tw) + 1;
    while (this.tiles.length < count) this.tiles.push(this.add.image(0, 0, key).setOrigin(0, 0).setDepth(0));
    this.tiles.forEach((img, i) => {
      if (i >= count) return img.setVisible(false);
      const k = first + i;
      img.setTexture(key).setVisible(true).setScale(scale).setFlipX(k % 2 !== 0);
      img.setPosition(k * tw - offset, (h - src.height * scale) / 2);
    });
    return true;
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
    if (this.painted && this.drawImage(w, h, scroll)) {
      // A light wash of the tent blue keeps gameplay objects on top easy to read.
      g.fillStyle(p.background, b.imageDim);
      g.fillRect(0, 0, w, h);
      return;
    }
    for (const img of this.tiles) img.setVisible(false);
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
