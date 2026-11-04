import { Collectible } from './base.js';

// Edge-on gold ring on the arc: fly through the middle.
export default class GoldRing extends Collectible {
  static info = {
    id: 'goldRing', name: 'Gold ring', group: 'collect',
    rule: 'A gold ring on your arc. Fly through the middle.',
    score: '+3 and it counts towards the combo (like a perfect catch).'
  };

  collect(body, r, prev) {
    return prev.x < this.x && body.x >= this.x && Math.abs(body.y - this.y) < this.cfg.radius;
  }

  draw(r) {
    if (this.collected) return;
    const g = r.g;
    const c = this.cfg;
    g.lineStyle(c.drawWidth / 2 + r.t.acrobat.outlineWidth * 2, r.p.outline, 1);
    g.strokeEllipse(this.x, this.y, c.drawWidth, c.radius * 2);
    g.lineStyle(c.drawWidth / 2, r.p.gold, 1);
    g.strokeEllipse(this.x, this.y, c.drawWidth, c.radius * 2);
  }

  static place(b) {
    return [new this(b.tuning, { ...b.bodyAt(b.cfg(this).pathAt), level: b.level })];
  }
}
