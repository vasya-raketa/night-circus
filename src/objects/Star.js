import { Collectible } from './base.js';
import { starPoints } from '../render/WorldRenderer.js';

export default class Star extends Collectible {
  static info = {
    id: 'star', name: 'Star', group: 'collect',
    rule: 'Placed right on the arc. Fly through it to collect it.',
    score: '+5 each.'
  };

  collect(body, r) {
    return Math.hypot(body.x - this.x, body.y - this.y) <= this.cfg.radius + r;
  }

  draw(r) {
    if (this.collected) return;
    const s = r.t.stars;
    const y = this.y + Math.sin(this.phase + r.time * s.bobSpeed) * s.bobAmount;
    const rot = r.time * s.spin;
    const ol = r.t.acrobat.outlineWidth;
    r.g.fillStyle(r.p.outline, 1);
    r.g.fillPoints(starPoints(this.x, y, this.cfg.radius + ol, (this.cfg.radius + ol) * s.innerRatio, rot), true);
    r.g.fillStyle(r.p.star, 1);
    r.g.fillPoints(starPoints(this.x, y, this.cfg.radius, this.cfg.radius * s.innerRatio, rot), true);
  }

  static place(b) {
    const c = b.cfg(this);
    const n = b.rng.int(c.countMin, c.countMax);
    return Array.from({ length: n }, (_, k) => {
      const f = n === 1 ? (c.pathFrom + c.pathTo) / 2 : c.pathFrom + ((c.pathTo - c.pathFrom) * k) / (n - 1);
      return new this(b.tuning, { ...b.bodyAt(f), level: b.level, phase: b.rng.range(0, Math.PI * 2) });
    });
  }
}
