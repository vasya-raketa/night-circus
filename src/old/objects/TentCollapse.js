import { AreaEffect } from '../../objects/base.js';

// A collapsing tent wall chases you from behind: no waiting around on a bar.
export default class TentCollapse extends AreaEffect {
  static info = {
    id: 'tentCollapse', name: 'Tent collapse', group: 'area',
    rule: 'A wall chases you from behind. If it reaches you, you fall: you cannot wait on a bar too long.',
    score: '—'
  };

  constructor(tuning, spec) {
    super(tuning, spec);
    this.tStart = null;
  }

  get hitsWhileHolding() {
    return true;
  }

  // Waiting longer than this on each bar lets the wall catch up over a few jumps.
  get holdLimit() {
    const g = this.tuning.game;
    const flight = 2 * Math.sqrt((2 * g.jumpHeight) / this.tuning.physics.gravity);
    return Math.max(this.cfg.minWait, g.jumpDistance / this.lv(this.cfg.speedMin, this.cfg.speedMax) - flight - this.cfg.waitMargin);
  }

  // Started by the game when the runner enters the stretch.
  start(t, runnerX) {
    this.tStart = t;
    this.wall0 = runnerX - this.cfg.startBehind;
  }

  wallX(t) {
    if (this.tStart === null) return -Infinity;
    return Math.min(this.x1, this.wall0 + this.lv(this.cfg.speedMin, this.cfg.speedMax) * (t - this.tStart));
  }

  hit(body, r, t) {
    return this.tStart !== null && body.x < this.x1 && body.x - r <= this.wallX(t);
  }

  drawOverlay(r) {
    if (this.tStart === null) return;
    const x = this.wallX(r.time);
    if (x < r.view.x) return;
    const g = r.g;
    const c = this.cfg;
    g.fillStyle(r.p.floor, c.shadeAlpha);
    g.fillRect(r.view.x, r.view.y, x - r.view.x, r.view.height);
    for (let y = r.view.y, i = 0; y < r.view.bottom; y += c.stripeWidth, i++) {
      g.fillStyle(i % 2 ? r.p.stripeCream : r.p.stripeRed, 1);
      g.fillRect(x - c.wallWidth, y, c.wallWidth, c.stripeWidth);
    }
  }
}
