import { AreaEffect } from './base.js';

export default class Rain extends AreaEffect {
  static info = {
    id: 'rain', name: 'Rain', group: 'area',
    rule: 'Every bar in the rain becomes slippery: you slide off 1.2 s after grabbing.',
    score: '—'
  };

  apply(env) {
    env.rain = true;
  }

  drawOverlay(r) {
    const c = this.cfg;
    const g = r.g;
    const x0 = Math.max(this.x0, r.view.x), x1 = Math.min(this.x1, r.view.right);
    if (x1 <= x0) return;
    const h = r.view.height;
    g.lineStyle(r.t.bars.ropeWidth / 2, r.p.teal, c.alpha);
    for (let i = 0; i < c.drops; i++) {
      const x = x0 + (i / c.drops) * (x1 - x0);
      const y = r.view.y + (((i * c.dropScatter * h + r.time * c.dropSpeed) % h) + h) % h;
      g.lineBetween(x, y, x - c.dropLength / 4, y + c.dropLength);
    }
  }
}
