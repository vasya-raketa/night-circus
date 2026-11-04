import { GrabObject, outlinedCircle } from './base.js';
import { angledVelocity } from '../systems/FixedArc.js';

const rad = (d) => (d * Math.PI) / 180;

// You land inside; it tilts between two angles; tap fires a fixed-power shot.
export default class Cannon extends GrabObject {
  static timed = true;

  static info = {
    id: 'cannon', name: 'Cannon', group: 'grab',
    rule: 'Land in its mouth. It rotates between 2 angles; tap fires a fixed-power shot (the preview shows the path).',
    score: '+1 per catch.'
  };

  // Seconds until its motion repeats (used by the fairness check).
  get cycle() {
    return (2 * (this.cfg.holdTime + this.cfg.turnTime)) / this.tempo;
  }

  constructor(tuning, spec) {
    super(tuning, spec);
    this.exitAngle = spec.exitAngle ?? this.cfg.angleA;
  }

  get hidesRunner() {
    return true;
  }

  get showsPreview() {
    return true;
  }

  // Holds angle A, turns to B, holds, turns back.
  angleAt(t) {
    const { angleA, angleB, holdTime, turnTime } = this.cfg;
    const period = 2 * (holdTime + turnTime);
    const k = ((((this.clock(t) + this.phase) % period) + period) % period);
    const ease = (u) => (1 - Math.cos(Math.PI * u)) / 2;
    if (k < holdTime) return angleA;
    if (k < holdTime + turnTime) return angleA + (angleB - angleA) * ease((k - holdTime) / turnTime);
    if (k < 2 * holdTime + turnTime) return angleB;
    return angleB + (angleA - angleB) * ease((k - 2 * holdTime - turnTime) / turnTime);
  }

  mouthAt(angle) {
    return { x: this.x + Math.cos(rad(angle)) * this.cfg.length, y: this.y - Math.sin(rad(angle)) * this.cfg.length };
  }

  catchRadius() {
    return this.cfg.catchRadius;
  }

  catchPoint(t) {
    return this.mouthAt(this.angleAt(t));
  }

  get slipsInRain() {
    return false;
  }

  tapVelocity(t) {
    return angledVelocity(this.cfg.power, this.angleAt(t));
  }

  referenceExit() {
    const m = this.mouthAt(this.exitAngle);
    return { x: m.x, y: m.y, v: angledVelocity(this.cfg.power, this.exitAngle) };
  }

  draw(r) {
    const g = r.g;
    const c = this.cfg;
    const ol = r.t.acrobat.outlineWidth;
    g.lineStyle(r.t.platform.poleWidth, r.p.purple, 1);
    g.lineBetween(this.x, this.y, this.x, r.t.world.netY);
    for (const a of [c.angleA, c.angleB]) {
      const m = this.mouthAt(a);
      g.lineStyle(r.t.bars.ropeWidth, r.p.stripeCream, r.t.game.zoneAlpha);
      g.lineBetween(this.x, this.y, this.x + (m.x - this.x) * c.tickScale, this.y + (m.y - this.y) * c.tickScale);
    }
    const m = this.mouthAt(this.angleAt(r.time));
    g.lineStyle(c.width + ol * 2, r.p.outline, 1);
    g.lineBetween(this.x, this.y, m.x, m.y);
    g.lineStyle(c.width, r.p.stripeRed, 1);
    g.lineBetween(this.x, this.y, m.x, m.y);
    outlinedCircle(r, m.x, m.y, c.width / 2, r.p.gold);
    g.fillStyle(r.p.outline, 1);
    g.fillCircle(m.x, m.y, c.width / 3);
    outlinedCircle(r, this.x, this.y, c.baseRadius, r.p.purple);
  }

  static place(b, landing) {
    const c = b.tuning.objects.cannon;
    const mid = rad((c.angleA + c.angleB) / 2);
    return new this(b.tuning, {
      x: landing.x - Math.cos(mid) * c.length,
      y: landing.y + Math.sin(mid) * c.length,
      level: b.level,
      phase: b.rng.range(0, 2 * (c.holdTime + c.turnTime)),
      exitAngle: b.rng.chance(0.5) ? c.angleA : c.angleB
    });
  }
}
