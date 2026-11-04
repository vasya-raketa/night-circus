import { Hazard } from './base.js';

// Drifting smoke clouds cover part of the screen.
export default class Smoke extends Hazard {
  static info = {
    id: 'smoke', name: 'Smoke', group: 'hazard',
    rule: 'Thick smoke drifts over part of the course and hides what is behind it.',
    score: 'No touch damage.'
  };

  get left() {
    return this.x - this.cfg.span / 2;
  }

  get right() {
    return this.x + this.cfg.span / 2;
  }

  drawOverlay(r) {
    const c = this.cfg;
    const g = r.g;
    const alpha = this.lv(c.alphaMin, c.alphaMax);
    for (let i = 0; i < c.puffs; i++) {
      const x = this.left + ((((i / c.puffs) * c.span + c.drift * r.time + this.phase) % c.span) + c.span) % c.span;
      const y = this.y + Math.sin(i * c.puffPhaseStep + this.phase) * c.radius * c.heightShare;
      for (let k = c.rings; k > 0; k--) {
        g.fillStyle(r.p.backgroundDeep, alpha / c.rings);
        g.fillCircle(x, y, (c.radius * k) / c.rings);
      }
    }
  }

  static place(b) {
    return [new this(b.tuning, { ...b.bodyAt(0.5), level: b.level, phase: b.rng.range(0, b.cfg(this).span) })];
  }
}
