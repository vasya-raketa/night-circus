import { TrapezeBar } from './base.js';

export default class SwingingBar extends TrapezeBar {
  static info = {
    id: 'swingingBar', name: 'Swinging bar', group: 'grab',
    rule: 'Swings on its own rhythm. Jump so it is in your landing spot when you arrive.',
    score: '+1 per catch.'
  };

  // Moves on its own clock: never placed right after a trampoline bounce.
  static timed = true;

  // Seconds until its motion repeats (used by the fairness check).
  get cycle() {
    return Math.PI * 2 / (this.naturalOmega() * this.lv(this.cfg.speedMin, this.cfg.speedMax) * this.tempo);
  }

  idleAngle(t) {
    const c = this.cfg;
    return this.lv(c.ampMin, c.ampMax) * Math.sin(this.phase + this.clock(t) * this.naturalOmega() * this.lv(c.speedMin, c.speedMax));
  }
}
