import { TrapezeBar } from './base.js';

export default class GoldenBar extends TrapezeBar {
  static info = {
    id: 'goldenBar', name: 'Golden bar', group: 'grab',
    rule: 'A shining bar. Catching it powers up your next catches.',
    score: 'x2 points for the next 5 catches.'
  };

  get golden() {
    return true;
  }

  barColor(r) {
    return Math.sin(r.time * Math.PI * 2 * this.cfg.shimmerRate) > 0 ? r.p.star : r.p.spotlight;
  }

  draw(r) {
    if (!this.broken && r.hold?.obj !== this) {
      const grip = this.gripAt(r.time, this.currentAngle(r));
      r.g.fillStyle(r.p.gold, this.cfg.glowAlpha);
      r.g.fillCircle(grip.x, grip.y, this.barWidth * this.cfg.glowScale);
    }
    super.draw(r);
  }
}
