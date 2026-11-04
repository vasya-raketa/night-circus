import { starPoints } from './WorldRenderer.js';

// Shape-only juice: star bursts, sparks, the flight trail and floating score popups.
export default class Effects {
  constructor(scene, tuning, palette) {
    this.scene = scene;
    this.tuning = tuning;
    this.palette = palette;
    this.trailG = scene.add.graphics();
    this.trailG.setDepth(-1);
    this.g = scene.add.graphics();
    this.particles = [];
    this.trail = [];
    this.trailClock = 0;
  }

  reset() {
    this.particles.length = 0;
    this.trail.length = 0;
  }

  starBurst(x, y) {
    const j = this.tuning.juice;
    for (let i = 0; i < j.burstCount; i++) {
      const a = (i / j.burstCount) * Math.PI * 2 + Math.random() * j.burstJitter;
      const speed = j.burstSpeed * (1 - j.burstJitter + Math.random() * j.burstJitter);
      this.particles.push({ x, y, vx: Math.cos(a) * speed, vy: Math.sin(a) * speed, life: j.burstLife, max: j.burstLife, size: j.burstSize, star: true, color: this.palette.star, rot: a });
    }
  }

  sparks(x, y, color) {
    const j = this.tuning.juice;
    for (let i = 0; i < j.sparkCount; i++) {
      const a = Math.random() * Math.PI * 2;
      const speed = j.sparkSpeed * Math.random();
      this.particles.push({ x, y, vx: Math.cos(a) * speed, vy: Math.sin(a) * speed, life: j.sparkLife, max: j.sparkLife, size: j.burstSize / 2, star: false, color, rot: 0 });
    }
  }

  popup(x, y, text, color) {
    const j = this.tuning.juice;
    const label = this.scene.add.text(x, y, text, {
      fontFamily: this.tuning.ui.font,
      fontSize: `${j.popupSize}px`,
      fontStyle: 'bold',
      color,
      stroke: this.tuning.colors.outline,
      strokeThickness: j.popupStroke
    }).setOrigin(0.5).setDepth(10);
    this.scene.tweens.add({
      targets: label,
      y: y - j.popupRise,
      alpha: 0,
      duration: j.popupTime * 1000,
      ease: 'Cubic.easeOut',
      onComplete: () => label.destroy()
    });
  }

  // Records the body position while flying; the trail fades out otherwise.
  updateTrail(dt, point, active) {
    const j = this.tuning.juice;
    this.trailClock += dt;
    if (this.trailClock >= j.trailEvery) {
      this.trailClock = 0;
      if (active) this.trail.push({ x: point.x, y: point.y });
      if (this.trail.length > j.trailLength || (!active && this.trail.length)) this.trail.shift();
    }
  }

  update(dt) {
    const grav = this.tuning.juice.particleGravity;
    for (const p of this.particles) {
      p.vy += grav * dt;
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.rot += dt * this.tuning.juice.particleSpin;
      p.life -= dt;
    }
    this.particles = this.particles.filter((p) => p.life > 0);
  }

  draw() {
    const j = this.tuning.juice;
    const tg = this.trailG;
    tg.clear();
    const n = this.trail.length;
    for (let i = 0; i < n; i++) {
      const k = (i + 1) / n;
      tg.fillStyle(this.palette.teal, k * j.trailAlpha);
      tg.fillCircle(this.trail[i].x, this.trail[i].y, j.trailRadius * k);
    }

    const g = this.g;
    g.clear();
    for (const p of this.particles) {
      const k = p.life / p.max;
      g.fillStyle(p.color, k);
      if (p.star) g.fillPoints(starPoints(p.x, p.y, p.size * k, p.size * k * this.tuning.stars.innerRatio, p.rot), true);
      else g.fillCircle(p.x, p.y, p.size * k);
    }
  }
}
