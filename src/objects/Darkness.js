import { AreaEffect } from './base.js';
import { drawShade } from '../render/Shade.js';

export default class Darkness extends AreaEffect {
  static info = {
    id: 'darkness', name: 'Darkness', group: 'area',
    rule: 'The lights go out: only spotlit areas (you and the next grab point) are visible.',
    score: '—'
  };

  apply(env) {
    env.dark = true;
  }

  drawOverlay(r) {
    if (r.runner.x < this.x0 || r.runner.x > this.x1) return;
    const body = r.runner.bodyCenter();
    const holes = [{ x: body.x, y: body.y, r: this.cfg.spotRadius }];
    if (r.nextGrab) holes.push({ x: r.nextGrab.x, y: r.nextGrab.y, r: this.cfg.spotRadius });
    drawShade(r.g, r.view, r.p.floor, this.cfg.alpha, holes, this.cfg.cell, r.t.shade.cellSoftness);
  }
}
