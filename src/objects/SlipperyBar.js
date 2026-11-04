import { TrapezeBar } from './base.js';

export default class SlipperyBar extends TrapezeBar {
  static info = {
    id: 'slipperyBar', name: 'Slippery bar', group: 'grab',
    rule: 'Wet and shiny: you slide off 1.2 s after grabbing it.',
    score: '+1 per catch.'
  };

  get holdLimit() {
    return this.cfg.slipTime;
  }

  holdEvent(t, hold) {
    return t - hold.tGrab >= this.cfg.slipTime ? { drop: 'slip' } : null;
  }

  barColor(r) {
    return r.p.teal;
  }

  draw(r) {
    super.draw(r);
    if (this.broken) return;
    const grip = this.gripAt(r.time, this.currentAngle(r));
    const k = (r.time / this.cfg.dripEvery) % 1;
    r.g.fillStyle(r.p.spotlight, 1 - k);
    r.g.fillCircle(grip.x, grip.y + r.t.bars.thickness + k * r.t.bars.width / 2, r.t.bars.ropeWidth);
  }
}
