import { Hazard, segmentDistance, outlinedCircle } from './base.js';

// A spinning wheel of blades; fly through the gaps.
export default class KnifeWheel extends Hazard {
  static info = {
    id: 'knifeWheel', name: 'Knife wheel', group: 'hazard',
    rule: 'A rotating wheel of blades sits across your arc. Time the jump to pass through a gap.',
    score: 'Close call: +2 (near miss).'
  };

  // Moves on its own clock: never placed right after a trampoline bounce.
  static timed = true;

  // Seconds until its motion repeats (used by the fairness check).
  get cycle() {
    return Math.PI * 2 / (this.lv(this.cfg.speedMin, this.cfg.speedMax) * this.tempo * this.blades);
  }

  get blades() {
    return Math.round(this.lv(this.cfg.bladesMin, this.cfg.bladesMax));
  }

  get cy() {
    return this.y - this.cfg.radius * this.cfg.centerAbove;
  }

  get left() {
    return this.x - this.cfg.radius;
  }

  get right() {
    return this.x + this.cfg.radius;
  }

  tips(t) {
    const n = this.blades;
    const spin = this.phase + this.clock(t) * this.lv(this.cfg.speedMin, this.cfg.speedMax);
    return Array.from({ length: n }, (_, k) => {
      const a = spin + (k * Math.PI * 2) / n;
      return { x: this.x + Math.cos(a) * this.cfg.radius, y: this.cy + Math.sin(a) * this.cfg.radius };
    });
  }

  gap(body, r, t) {
    let best = Math.hypot(body.x - this.x, body.y - this.cy) - this.cfg.bladeWidth * this.cfg.hubScale - r;
    for (const tip of this.tips(t)) {
      best = Math.min(best, segmentDistance(body.x, body.y, this.x, this.cy, tip.x, tip.y).dist - this.cfg.bladeWidth / 2 - r);
    }
    return best;
  }

  hit(body, r, t) {
    return this.gap(body, r, t) <= 0;
  }

  draw(r) {
    const g = r.g;
    const ol = r.t.acrobat.outlineWidth;
    g.lineStyle(r.t.bars.ropeWidth, r.p.rope, 1);
    g.lineBetween(this.x, r.t.world.ceilingY, this.x, this.cy);
    for (const tip of this.tips(r.time)) {
      g.lineStyle(this.cfg.bladeWidth + ol * 2, r.p.outline, 1);
      g.lineBetween(this.x, this.cy, tip.x, tip.y);
      g.lineStyle(this.cfg.bladeWidth, r.p.spotlight, 1);
      g.lineBetween(this.x, this.cy, tip.x, tip.y);
      g.fillStyle(r.p.hazard, 1);
      g.fillCircle(tip.x, tip.y, this.cfg.bladeWidth / 2);
    }
    outlinedCircle(r, this.x, this.cy, this.cfg.bladeWidth * this.cfg.hubScale, r.p.hazard);
  }

  drawZones(r) {
    r.g.lineStyle(r.t.game.zoneLineWidth, r.p.hazard, r.t.game.zoneAlpha);
    r.g.strokeCircle(this.x, this.cy, this.cfg.radius);
  }

  static place(b) {
    return [new this(b.tuning, { ...b.bodyAt(b.cfg(this).pathAt), level: b.level, phase: b.rng.range(0, Math.PI * 2) })];
  }
}
