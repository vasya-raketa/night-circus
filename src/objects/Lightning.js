import { Hazard } from './base.js';
import { drawShade } from '../render/Shade.js';

// A storm stretch: the screen goes dark and lightning flashes reveal the bars.
export default class Lightning extends Hazard {
  static info = {
    id: 'lightning', name: 'Lightning (storm)', group: 'hazard',
    rule: 'The screen goes dark; short lightning flashes reveal the bars. Jump from memory.',
    score: 'No touch damage.'
  };

  constructor(tuning, spec) {
    super(tuning, spec);
    this.x0 = spec.x0;
    this.x1 = spec.x1;
  }

  get left() {
    return this.x0;
  }

  get right() {
    return this.x1;
  }

  flashing(t) {
    const period = this.lv(this.cfg.periodEasy, this.cfg.periodHard);
    return (((t + this.phase) % period) + period) % period < this.cfg.flash;
  }

  drawOverlay(r) {
    if (r.runner.x < this.x0 || r.runner.x > this.x1) return;
    if (this.flashing(r.time)) {
      r.g.fillStyle(r.p.spotlight, r.t.game.zoneAlpha);
      r.g.fillRect(r.view.x, r.view.y, r.view.width, r.view.height);
      return;
    }
    const body = r.runner.bodyCenter();
    drawShade(r.g, r.view, r.p.floor, this.cfg.darkAlpha, [{ x: body.x, y: body.y, r: r.t.acrobat.bodyCenterOffset * 2 }], this.cfg.cell, r.t.shade.cellSoftness);
  }

  static place(b) {
    const D = b.tuning.game.jumpDistance;
    return [new this(b.tuning, { x0: b.exit.x - D / 2, x1: b.exit.x + D * (b.areaSegments ?? b.cfg(this).segments), x: b.exit.x, level: b.level, phase: b.rng.range(0, b.cfg(this).periodEasy) })];
  }
}
