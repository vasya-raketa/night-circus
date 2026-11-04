import { Hazard } from './base.js';

// Every few seconds a blinding spotlight hides the next bar.
export default class SpotlightGlare extends Hazard {
  static info = {
    id: 'spotlightGlare', name: 'Spotlight glare', group: 'hazard',
    rule: 'A blinding light hides the next bar for a moment every few seconds. Remember where it was.',
    score: 'No touch damage.'
  };

  active(t) {
    const period = this.lv(this.cfg.periodEasy, this.cfg.periodHard);
    const k = (((t + this.phase) % period) + period) % period;
    return k < this.lv(this.cfg.durationMin, this.cfg.durationMax);
  }

  drawOverlay(r) {
    if (!this.active(r.time)) return;
    const g = r.g;
    const c = this.cfg;
    for (let i = c.rays; i > 0; i--) {
      g.fillStyle(r.p.spotlight, c.alpha / c.rays);
      g.fillCircle(this.x, this.y, (c.radius * c.rayLength * i) / c.rays);
    }
    g.fillStyle(r.p.spotlight, c.alpha);
    g.fillCircle(this.x, this.y, c.radius);
  }

  static place(b) {
    return [new this(b.tuning, { x: b.landing.x, y: b.landing.y, level: b.level, phase: b.rng.range(0, b.cfg(this).periodEasy) })];
  }
}
