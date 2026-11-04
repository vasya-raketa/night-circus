import { TrapezeBar } from './base.js';

export default class ShortBar extends TrapezeBar {
  static info = {
    id: 'shortBar', name: 'Short bar', group: 'grab',
    rule: 'Half-size catch zone: land the arc right on it.',
    score: '+2 per catch.'
  };

  get points() {
    return this.cfg.points;
  }

  get barWidth() {
    return this.tuning.bars.width * this.cfg.widthScale;
  }

  catchRadius(tuning) {
    return tuning.catch.radius * this.cfg.catchScale;
  }
}
