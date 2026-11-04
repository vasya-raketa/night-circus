import { TrapezeBar } from './base.js';

export default class RailBar extends TrapezeBar {
  static info = {
    id: 'railBar', name: 'Rail bar', group: 'grab',
    rule: 'Its anchor slides left and right along a rail.',
    score: '+1 per catch.'
  };

  // Moves on its own clock: never placed right after a trampoline bounce.
  static timed = true;

  // Seconds until its motion repeats (used by the fairness check).
  get cycle() {
    return Math.PI * 2 / (this.lv(this.cfg.speedMin, this.cfg.speedMax) * this.tempo);
  }

  get range() {
    return this.lv(this.cfg.rangeMin, this.cfg.rangeMax);
  }

  anchorAt(t) {
    return { x: this.x + Math.sin(this.phase + this.clock(t) * this.lv(this.cfg.speedMin, this.cfg.speedMax)) * this.range, y: this.y };
  }

  get left() {
    return this.x - this.range;
  }

  get right() {
    return this.x + this.range;
  }

  draw(r) {
    const g = r.g;
    const hw = this.barWidth / 2 + this.range;
    g.lineStyle(r.t.bars.thickness + r.t.acrobat.outlineWidth * 2, r.p.outline, 1);
    g.lineBetween(this.x - hw, this.y, this.x + hw, this.y);
    g.lineStyle(r.t.bars.thickness, r.p.purple, 1);
    g.lineBetween(this.x - hw, this.y, this.x + hw, this.y);
    super.draw(r);
  }
}
