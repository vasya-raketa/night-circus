import { GrabObject, drawBar, outlinedCircle } from './base.js';
import { arcVelocity } from '../systems/FixedArc.js';

// Hang from it while it rises; it pops after 3 s.
export default class Balloon extends GrabObject {
  static info = {
    id: 'balloon', name: 'Balloon', group: 'grab',
    rule: 'Hang from it while it rises. It pops 3 s after you grab it: let go before that.',
    score: '+1 per catch.'
  };

  get holdLimit() {
    return this.cfg.popTime;
  }

  get slipsInRain() {
    return false;
  }

  catchPoint(t) {
    if (this.broken) return null;
    return { x: this.x, y: this.y + Math.sin(this.phase + t * this.cfg.bobSpeed) * this.cfg.bob };
  }

  lowestCatchY() {
    return this.y + this.cfg.bob;
  }

  startHold(t) {
    return { y0: this.catchPoint(t)?.y ?? this.y };
  }

  holdPoint(t, hold) {
    return { x: this.x, y: hold.y0 - this.cfg.riseSpeed * (t - hold.tGrab), angle: 0, angVel: 0 };
  }

  holdEvent(t, hold) {
    return t - hold.tGrab >= this.cfg.popTime ? { drop: 'pop' } : null;
  }

  referenceExit() {
    return { x: this.x, y: this.y - this.cfg.riseSpeed * this.cfg.exitTime, v: arcVelocity(this.tuning) };
  }

  draw(r) {
    if (this.broken) return;
    const g = r.g;
    const p = r.hold?.obj === this ? this.holdPoint(r.time, r.hold) : this.catchPoint(r.time);
    const top = p.y - this.cfg.stringLength;
    g.lineStyle(r.t.bars.ropeWidth / 2, r.p.rope, 1);
    g.lineBetween(p.x, p.y, p.x, top);
    const left = r.hold?.obj === this ? Math.max(0, 1 - (r.time - r.hold.tGrab) / this.cfg.popTime) : 1;
    outlinedCircle(r, p.x, top - this.cfg.radius, this.cfg.radius, left > this.cfg.warnShare ? r.p.teal : r.p.ropeFlash);
    g.fillStyle(r.p.spotlight, r.t.game.zoneAlpha);
    g.fillCircle(p.x - this.cfg.radius / 3, top - this.cfg.radius * this.cfg.shineHeight, this.cfg.radius / 4);
    drawBar(r, p.x, p.y, r.t.bars.width / 3, r.p.gold);
  }

  static place(b, landing) {
    return new this(b.tuning, { x: landing.x, y: landing.y, level: b.level, phase: b.rng.range(0, Math.PI * 2) });
  }
}
