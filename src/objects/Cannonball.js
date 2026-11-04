import { Hazard, outlinedCircle } from './base.js';

// Every few seconds a warning flashes, then a cannonball crosses at your arc's height.
export default class Cannonball extends Hazard {
  static info = {
    id: 'cannonball', name: 'Cannonball', group: 'hazard',
    rule: 'A warning flashes for 1 s, then a cannonball shoots diagonally across your arc from the upper right.',
    score: 'Close call: +2 (near miss).'
  };

  // Moves on its own clock: never placed right after a trampoline bounce.
  static timed = true;

  // Seconds until its motion repeats (used by the fairness check).
  get cycle() {
    return this.period;
  }

  get travelTime() {
    return this.cfg.span / this.lv(this.cfg.speedMin, this.cfg.speedMax);
  }

  // Tempo shortens the quiet gap between shots, never the 1 s warning or the flight.
  get period() {
    return Math.max(this.cfg.warn + this.travelTime, this.lv(this.cfg.periodEasy, this.cfg.periodHard) / this.tempo);
  }

  get left() {
    return this.x - this.cfg.span / 2;
  }

  get right() {
    return this.x + this.cfg.span / 2;
  }

  // Unit vector pointing back along the flight (towards where the ball comes from).
  get dir() {
    const a = (this.cfg.angleDeg * Math.PI) / 180;
    return { x: Math.cos(a), y: -Math.sin(a) };
  }

  // 'warn' | 'fly' | 'idle' and the ball position. It flies through (x, y) diagonally.
  stateAt(t) {
    const c = this.cfg;
    const speed = this.lv(c.speedMin, c.speedMax);
    const k = (((t + this.phase) % this.period) + this.period) % this.period;
    if (k < c.warn) return { mode: 'warn', k };
    const s = c.span / 2 - speed * (k - c.warn);
    if (s < -c.span / 2) return { mode: 'idle' };
    const d = this.dir;
    return { mode: 'fly', x: this.x + d.x * s, y: this.y + d.y * s };
  }

  gap(body, r, t) {
    const s = this.stateAt(t);
    return s.mode === 'fly' ? Math.hypot(body.x - s.x, body.y - s.y) - this.cfg.radius - r : Infinity;
  }

  hit(body, r, t) {
    return this.gap(body, r, t) <= 0;
  }

  draw(r) {
    const s = this.stateAt(r.time);
    if (s.mode === 'fly') {
      outlinedCircle(r, s.x, s.y, this.cfg.radius, r.p.outline);
      r.g.fillStyle(r.p.hazard, 1);
      r.g.fillCircle(s.x - this.cfg.radius / 3, s.y - this.cfg.radius / 3, this.cfg.radius / 4);
    }
  }

  // The warning arrow sits where the ball will enter the screen, pointing along its path.
  drawOverlay(r) {
    const st = this.stateAt(r.time);
    if (st.mode !== 'warn' || Math.sin(st.k * this.cfg.warnBlink * Math.PI * 2) < 0) return;
    const d = this.dir;
    const z = this.cfg.warnSize;
    let s = this.cfg.span / 2;
    const inside = (q) => q.x < r.view.right - z * 2 && q.y > r.view.y + z * 2;
    while (s > 0 && !inside({ x: this.x + d.x * s, y: this.y + d.y * s })) s -= z;
    const p = { x: this.x + d.x * s, y: this.y + d.y * s };
    const n = { x: -d.y, y: d.x };
    r.g.fillStyle(r.p.hazard, 1);
    r.g.fillTriangle(p.x + d.x * z + n.x * z, p.y + d.y * z + n.y * z, p.x + d.x * z - n.x * z, p.y + d.y * z - n.y * z, p.x - d.x * z, p.y - d.y * z);
  }

  drawZones(r) {
    const d = this.dir;
    const h = this.cfg.span / 2;
    r.g.lineStyle(r.t.game.zoneLineWidth, r.p.hazard, r.t.game.zoneAlpha);
    r.g.lineBetween(this.x - d.x * h, this.y - d.y * h, this.x + d.x * h, this.y + d.y * h);
  }

  static place(b) {
    const c = b.cfg(this);
    return [new this(b.tuning, { ...b.bodyAt(c.pathAt), level: b.level, phase: b.rng.range(0, c.periodEasy) })];
  }
}
