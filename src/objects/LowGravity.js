import { AreaEffect } from './base.js';

// Same launch, weaker gravity: a longer, floatier arc by a fixed factor.
export default class LowGravity extends AreaEffect {
  static info = {
    id: 'lowGravity', name: 'Low gravity', group: 'area',
    rule: 'Gravity drops to a fixed fraction: the same jump flies longer and higher. The preview shows it.',
    score: '—'
  };

  apply(env) {
    env.gravityScale *= this.cfg.scale;
  }

  draw(r) {
    const c = this.cfg;
    const g = r.g;
    const x0 = Math.max(this.x0, r.view.x), x1 = Math.min(this.x1, r.view.right);
    if (x1 <= x0) return;
    g.fillStyle(r.p.purple, c.tintAlpha);
    g.fillRect(x0, r.view.y, x1 - x0, r.view.height);
    const h = r.t.world.netY - r.t.world.ceilingY;
    g.fillStyle(r.p.spotlight, r.t.game.zoneAlpha);
    for (let i = 0; i < c.sparkles; i++) {
      const x = this.x0 + ((i + 1) / (c.sparkles + 1)) * (this.x1 - this.x0);
      const y = r.t.world.netY - ((((i * c.sparkleScatter * h + r.time * c.sparkleSpeed) % h) + h) % h);
      if (x >= x0 && x <= x1) g.fillCircle(x, y, r.t.bars.ropeWidth);
    }
  }
}
