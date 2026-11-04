import { TrapezeBar } from './base.js';
import { lerp } from '../render/palette.js';

export default class FragileBar extends TrapezeBar {
  static info = {
    id: 'fragileBar', name: 'Fragile bar', group: 'grab',
    rule: 'The rope flashes and snaps 2 s after you grab it: jump quickly.',
    score: '+1 per catch.'
  };

  get holdLimit() {
    return this.cfg.snapTime;
  }

  holdEvent(t, hold) {
    return t - hold.tGrab >= this.cfg.snapTime ? { drop: 'snap' } : null;
  }

  ropeColor(r) {
    if (r.hold?.obj !== this) return r.p.ropeFragile;
    const k = Math.min(1, (r.time - r.hold.tGrab) / this.cfg.snapTime);
    const rate = lerp(this.cfg.flashRateStart, this.cfg.flashRateEnd, k);
    return Math.sin(r.time * rate * Math.PI * 2) > 0 ? r.p.ropeFlash : r.p.stripeCream;
  }
}
