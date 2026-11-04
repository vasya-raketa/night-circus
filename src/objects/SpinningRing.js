import { TrapezeBar, drawAnchors } from './base.js';

const deg = (d) => (d * Math.PI) / 180;

export default class SpinningRing extends TrapezeBar {
  static info = {
    id: 'spinningRing', name: 'Spinning ring', group: 'grab',
    rule: 'A ring with an opening. You can only catch it while the opening faces you.',
    score: '+1 per catch.'
  };

  // Moves on its own clock: never placed right after a trampoline bounce.
  static timed = true;

  // Seconds until its motion repeats (used by the fairness check).
  get cycle() {
    return Math.PI * 2 / (this.lv(this.cfg.speedMin, this.cfg.speedMax) * this.tempo);
  }

  // Direction of the opening (radians, 0 = right, PI = towards you).
  openingAt(t) {
    return this.phase + this.clock(t) * this.lv(this.cfg.speedMin, this.cfg.speedMax);
  }

  facing(t) {
    const d = Math.atan2(Math.sin(this.openingAt(t) - Math.PI), Math.cos(this.openingAt(t) - Math.PI));
    return Math.abs(d) <= deg(this.cfg.facingDeg);
  }

  catchPoint(t) {
    return !this.broken && this.facing(t) ? this.gripAt(t, 0) : null;
  }

  draw(r) {
    const g = r.g;
    const a = this.anchorAt(r.time);
    const grip = this.gripAt(r.time, this.currentAngle(r));
    const R = this.cfg.radius;
    g.lineStyle(r.t.bars.ropeWidth, r.p.rope, 1);
    g.lineBetween(a.x, a.y, grip.x, grip.y - R);
    drawAnchors(r, a.x, a.y, 0);
    const open = this.openingAt(r.time);
    const half = deg(this.cfg.gapDeg) / 2;
    const color = this.facing(r.time) ? r.p.gold : r.p.rope;
    for (const [w, c] of [[this.cfg.thickness + r.t.acrobat.outlineWidth * 2, r.p.outline], [this.cfg.thickness, color]]) {
      g.lineStyle(w, c, 1);
      g.beginPath();
      g.arc(grip.x, grip.y, R, open + half, open - half + Math.PI * 2, false);
      g.strokePath();
    }
  }
}
