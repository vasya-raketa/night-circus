import { TrapezeBar } from './base.js';

export default class ElevatorBar extends TrapezeBar {
  static info = {
    id: 'elevatorBar', name: 'Elevator bar', group: 'grab',
    rule: 'Moves up and down. Catch it when it rises into your landing spot.',
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
    return { x: this.x, y: this.y + Math.sin(this.phase + this.clock(t) * this.lv(this.cfg.speedMin, this.cfg.speedMax)) * this.range };
  }

  draw(r) {
    const g = r.g;
    const hw = this.barWidth / 2;
    g.lineStyle(r.t.bars.ropeWidth, r.p.purple, 1);
    g.lineBetween(this.x - hw, this.y - this.range, this.x - hw, this.y + this.range);
    g.lineBetween(this.x + hw, this.y - this.range, this.x + hw, this.y + this.range);
    super.draw(r);
  }
}
