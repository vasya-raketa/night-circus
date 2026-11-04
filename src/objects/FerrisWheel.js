import { GrabObject, drawBar } from './base.js';

const rad = (d) => (d * Math.PI) / 180;

// Handles ride a turning wheel; catch whichever is in your landing spot and ride it.
export default class FerrisWheel extends GrabObject {
  static info = {
    id: 'ferrisWheel', name: 'Ferris wheel', group: 'grab',
    rule: 'Handles turn on a wheel. Catch the one in your landing spot and ride it; tap to let go.',
    score: '+1 per catch.'
  };

  // Moves on its own clock: never placed right after a trampoline bounce.
  static timed = true;

  // Seconds until its motion repeats (used by the fairness check).
  get cycle() {
    return Math.PI * 2 / (this.speed * this.tempo * this.cfg.handles);
  }

  get speed() {
    return this.lv(this.cfg.speedMin, this.cfg.speedMax);
  }

  get left() {
    return this.x - this.cfg.radius;
  }

  get right() {
    return this.x + this.cfg.radius;
  }

  get slipsInRain() {
    return false;
  }

  handleAngle(t, k) {
    return this.phase + this.clock(t) * this.speed + (k * Math.PI * 2) / this.cfg.handles;
  }

  handle(t, k) {
    const a = this.handleAngle(t, k);
    return { x: this.x + Math.cos(a) * this.cfg.radius, y: this.y + Math.sin(a) * this.cfg.radius, key: k };
  }

  catchPoints(t) {
    if (this.broken) return [];
    return Array.from({ length: this.cfg.handles }, (_, k) => this.handle(t, k));
  }

  lowestCatchY() {
    return this.y + this.cfg.radius;
  }

  startHold(t, runner, extras) {
    if (extras.key !== undefined) return { key: extras.key };
    const entry = this.entry ?? { x: this.x, y: this.y - this.cfg.radius };
    const pts = this.catchPoints(t);
    pts.sort((a, b) => Math.hypot(a.x - entry.x, a.y - entry.y) - Math.hypot(b.x - entry.x, b.y - entry.y));
    return { key: pts[0]?.key ?? 0 };
  }

  holdPoint(t, hold) {
    const p = this.handle(t, hold.key);
    return { x: p.x, y: p.y, angle: 0, angVel: 0 };
  }

  referenceExit() {
    const a = rad(this.cfg.exitDeg);
    const exit = super.referenceExit();
    return { ...exit, x: this.x + Math.cos(a) * this.cfg.radius, y: this.y + Math.sin(a) * this.cfg.radius };
  }

  draw(r) {
    const g = r.g;
    const R = this.cfg.radius;
    const net = r.t.world.netY;
    g.lineStyle(r.t.platform.poleWidth / 2, r.p.purple, 1);
    g.lineBetween(this.x, this.y, this.x - R / 2, net);
    g.lineBetween(this.x, this.y, this.x + R / 2, net);
    g.lineStyle(r.t.bars.ropeWidth, r.p.rope, 1);
    for (let k = 0; k < this.cfg.handles; k++) {
      const p = this.handle(r.time, k);
      g.lineBetween(this.x, this.y, p.x, p.y);
    }
    g.lineStyle(r.t.bars.thickness, r.p.purple, 1);
    g.strokeCircle(this.x, this.y, R);
    g.fillStyle(r.p.outline, 1);
    g.fillCircle(this.x, this.y, r.t.bars.anchorRadius * 2);
    for (let k = 0; k < this.cfg.handles; k++) {
      const p = this.handle(r.time, k);
      drawBar(r, p.x, p.y, this.cfg.handleRadius * 2, r.p.gold);
    }
  }

  // The wheel sits so that its rim passes through the landing spot.
  static place(b, landing) {
    const c = b.tuning.objects.ferrisWheel;
    const a = rad(c.placeDeg);
    const wheel = new this(b.tuning, { x: landing.x - Math.cos(a) * c.radius, y: landing.y - Math.sin(a) * c.radius, level: b.level, phase: b.rng.range(0, Math.PI * 2) });
    wheel.entry = { x: landing.x, y: landing.y };
    return wheel;
  }
}
