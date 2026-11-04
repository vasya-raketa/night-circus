import { GrabObject, segmentDistance, outlinedCircle } from './base.js';
import { arcVelocity } from '../systems/FixedArc.js';

// A sloped cable: catch it anywhere, slide down, tap to drop into the fixed arc.
export default class Zipline extends GrabObject {
  static info = {
    id: 'zipline', name: 'Zipline', group: 'grab',
    rule: 'Catch the cable and slide along it; tap to drop into the fixed arc. At the end you let go automatically.',
    score: '+1 per catch.'
  };

  get dir() {
    const a = (this.cfg.slopeDeg * Math.PI) / 180;
    return { x: Math.cos(a), y: Math.sin(a) };
  }

  get end() {
    return { x: this.x + this.dir.x * this.cfg.length, y: this.y + this.dir.y * this.cfg.length };
  }

  get right() {
    return this.end.x;
  }

  get slipsInRain() {
    return false;
  }

  pointAt(s) {
    return { x: this.x + this.dir.x * this.cfg.length * s, y: this.y + this.dir.y * this.cfg.length * s };
  }

  catchPoints() {
    return [];
  }

  lowestCatchY() {
    return this.end.y;
  }

  contact(runner) {
    if (runner.vy <= 0) return null;
    const e = this.end;
    const { dist, k } = segmentDistance(runner.x, runner.y, this.x, this.y, e.x, e.y);
    return dist <= this.catchRadius(this.tuning) ? { dist, key: k } : null;
  }

  // Without a contact point (fairness replay) assume you caught it where the arc meets it.
  startHold(t, runner, extras) {
    return { s0: extras.key ?? this.cfg.entryShare };
  }

  get holdLimit() {
    return ((1 - this.cfg.entryShare) * this.cfg.length) / (this.cfg.speed * this.tempo);
  }

  slideAt(t, hold) {
    return hold.s0 + (this.cfg.speed * this.tempo * (t - hold.tGrab)) / this.cfg.length;
  }

  holdPoint(t, hold) {
    const p = this.pointAt(Math.min(1, this.slideAt(t, hold)));
    return { x: p.x, y: p.y, angle: 0, angVel: 0 };
  }

  holdEvent(t, hold) {
    return this.slideAt(t, hold) >= 1 ? { launch: arcVelocity(this.tuning) } : null;
  }

  referenceExit() {
    const p = this.pointAt(this.cfg.exitShare);
    return { x: p.x, y: p.y, v: arcVelocity(this.tuning) };
  }

  draw(r) {
    const g = r.g;
    const e = this.end;
    const ceil = r.t.world.ceilingY;
    g.lineStyle(r.t.platform.poleWidth / 2, r.p.purple, 1);
    g.lineBetween(this.x, ceil, this.x, this.y);
    g.lineBetween(e.x, ceil, e.x, e.y);
    g.lineStyle(this.cfg.thickness + r.t.acrobat.outlineWidth * 2, r.p.outline, 1);
    g.lineBetween(this.x, this.y, e.x, e.y);
    g.lineStyle(this.cfg.thickness, r.p.gold, 1);
    g.lineBetween(this.x, this.y, e.x, e.y);
    const p = r.hold?.obj === this ? this.holdPoint(r.time, r.hold) : this.pointAt(0);
    outlinedCircle(r, p.x, p.y, r.t.bars.anchorRadius * this.cfg.trolleyScale, r.p.stripeRed);
  }

  drawZones(r) {
    const e = this.end;
    r.g.lineStyle(this.catchRadius(r.t) * 2, r.p.teal, r.t.game.zoneAlpha / 3);
    r.g.lineBetween(this.x, this.y, e.x, e.y);
  }

  // The cable starts a little before the landing spot.
  static place(b, landing) {
    const c = b.tuning.objects.zipline;
    const a = (c.slopeDeg * Math.PI) / 180;
    const back = c.length * c.entryShare;
    return new this(b.tuning, { x: landing.x - Math.cos(a) * back, y: landing.y - Math.sin(a) * back, level: b.level });
  }
}
