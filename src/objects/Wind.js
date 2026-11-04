import { AreaEffect } from './base.js';

// Constant sideways push: the arc shifts by a fixed, known amount (the preview shows it).
export default class Wind extends AreaEffect {
  static info = {
    id: 'wind', name: 'Wind', group: 'area',
    rule: 'Shifts your arc by a fixed amount; the flags show the direction and the preview shows the new arc.',
    score: '—'
  };

  get accel() {
    return this.sign * this.lv(this.cfg.accelMin, this.cfg.accelMax);
  }

  apply(env) {
    env.ax += this.accel;
  }

  draw(r) {
    const g = r.g;
    const c = this.cfg;
    const y = r.t.world.ceilingY;
    const dir = Math.sign(this.accel);
    for (let x = this.x0; x <= this.x1; x += c.flagSpacing) {
      const wave = Math.sin(r.time * c.flagWave + x) * c.flagSize * c.flagFlutter;
      g.lineStyle(r.t.bars.ropeWidth, r.p.rope, 1);
      g.lineBetween(x, y - c.flagSize, x, y + c.flagSize);
      g.fillStyle(r.p.teal, 1);
      g.fillTriangle(x, y - c.flagSize, x, y, x + dir * c.flagSize * c.flagLength, y - c.flagSize / 2 + wave);
    }
  }
}
