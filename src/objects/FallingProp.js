import { Hazard } from './base.js';

// A shadow warns where a heavy prop will drop: onto the next bar or onto your arc.
export default class FallingProp extends Hazard {
  static info = {
    id: 'fallingProp', name: 'Falling prop', group: 'hazard',
    rule: 'A shadow shows where a prop will drop: through a bar\'s catch spot or across your arc. It only hurts while you fly.',
    score: 'Close call: +2 (near miss).'
  };

  // Moves on its own clock: never placed right after a trampoline bounce.
  static timed = true;

  // Seconds until its motion repeats (used by the fairness check).
  get cycle() {
    return this.period;
  }

  get fallTime() {
    return (this.tuning.world.netY - this.tuning.world.ceilingY + this.cfg.topOffset) / this.cfg.fallSpeed;
  }

  // Tempo shortens the quiet gap between drops, never the shadow warning or the fall.
  get period() {
    return Math.max(this.cfg.warn + this.fallTime, this.lv(this.cfg.periodEasy, this.cfg.periodHard) / this.tempo);
  }

  stateAt(t) {
    const c = this.cfg;
    const k = (((t + this.phase) % this.period) + this.period) % this.period;
    if (k < c.warn) return { mode: 'warn', k: k / c.warn };
    const y = this.tuning.world.ceilingY - c.topOffset + c.fallSpeed * (k - c.warn);
    return y > this.tuning.world.netY ? { mode: 'idle' } : { mode: 'fall', y };
  }

  gap(body, r, t) {
    const s = this.stateAt(t);
    if (s.mode !== 'fall') return Infinity;
    const hw = this.cfg.width / 2, hh = this.cfg.height / 2;
    const dx = Math.max(0, Math.abs(body.x - this.x) - hw);
    const dy = Math.max(0, Math.abs(body.y - s.y) - hh);
    return Math.hypot(dx, dy) - r;
  }

  hit(body, r, t) {
    return this.gap(body, r, t) <= 0;
  }

  draw(r) {
    const g = r.g;
    const c = this.cfg;
    const s = this.stateAt(r.time);
    if (s.mode === 'warn') {
      g.fillStyle(r.p.outline, s.k * r.t.game.zoneAlpha * 2);
      g.fillEllipse(this.x, this.y, c.width * c.shadowScale * s.k, c.height / 2);
    } else if (s.mode === 'fall') {
      const ol = r.t.acrobat.outlineWidth;
      g.fillStyle(r.p.outline, 1);
      g.fillRect(this.x - c.width / 2 - ol, s.y - c.height / 2 - ol, c.width + ol * 2, c.height + ol * 2);
      for (let i = 0; i < 3; i++) {
        g.fillStyle(i % 2 ? r.p.stripeCream : r.p.stripeRed, 1);
        g.fillRect(this.x - c.width / 2 + (i * c.width) / 3, s.y - c.height / 2, c.width / 3, c.height);
      }
    }
  }

  drawZones(r) {
    r.g.lineStyle(r.t.game.zoneLineWidth, r.p.hazard, r.t.game.zoneAlpha);
    r.g.lineBetween(this.x, r.t.world.ceilingY, this.x, r.t.world.netY);
  }

  static place(b) {
    const c = b.cfg(this);
    const spot = b.rng.chance(c.onBarChance) ? { x: b.landing.x, y: b.landing.y + b.tuning.acrobat.bodyCenterOffset } : b.bodyAt(c.pathAt);
    return [new this(b.tuning, { ...spot, level: b.level, phase: b.rng.range(0, c.periodEasy) })];
  }
}
