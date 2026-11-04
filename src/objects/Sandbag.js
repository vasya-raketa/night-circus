import { Hazard, outlinedCircle } from './base.js';

// A heavy bag on a long rope swinging across your arc.
export default class Sandbag extends Hazard {
  static info = {
    id: 'sandbag', name: 'Sandbag', group: 'hazard',
    rule: 'Swings low across your arc, crossing it twice per swing. Jump when it is out of the way.',
    score: 'Close call: +2 (near miss).'
  };

  // Moves on its own clock: never placed right after a trampoline bounce.
  static timed = true;

  // Seconds until its motion repeats (used by the fairness check).
  get cycle() {
    return Math.PI * 2 / (Math.sqrt(this.tuning.physics.gravity / this.length) * this.lv(this.cfg.speedMin, this.cfg.speedMax) * this.tempo);
  }

  constructor(tuning, spec) {
    super(tuning, spec);
    this.anchorY = tuning.world.ceilingY;
    this.length = this.y + this.cfg.dropBelow - this.anchorY;
  }

  get left() {
    return this.x - this.length;
  }

  get right() {
    return this.x + this.length;
  }

  pos(t) {
    const c = this.cfg;
    const w = Math.sqrt(this.tuning.physics.gravity / this.length) * this.lv(c.speedMin, c.speedMax);
    const a = this.lv(c.ampMin, c.ampMax) * Math.sin(this.phase + this.clock(t) * w);
    return { x: this.x + Math.sin(a) * this.length, y: this.anchorY + Math.cos(a) * this.length };
  }

  gap(body, r, t) {
    const p = this.pos(t);
    return Math.hypot(body.x - p.x, body.y - p.y) - this.cfg.radius - r;
  }

  hit(body, r, t) {
    return this.gap(body, r, t) <= 0;
  }

  draw(r) {
    const p = this.pos(r.time);
    r.g.lineStyle(r.t.bars.ropeWidth, r.p.rope, 1);
    r.g.lineBetween(this.x, this.anchorY, p.x, p.y);
    outlinedCircle(r, p.x, p.y, this.cfg.radius, r.p.hazard);
  }

  drawZones(r) {
    const p = this.pos(r.time);
    r.g.lineStyle(r.t.game.zoneLineWidth, r.p.hazard, r.t.game.zoneAlpha);
    r.g.strokeCircle(p.x, p.y, this.cfg.radius + r.t.game.bodyHitRadius);
  }

  static place(b) {
    return [new this(b.tuning, { ...b.bodyAt(b.cfg(this).pathAt), level: b.level, phase: b.rng.range(0, Math.PI * 2) })];
  }
}
