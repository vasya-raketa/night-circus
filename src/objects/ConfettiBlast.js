import { Hazard } from './base.js';

// A floor cannon blasts confetti that pushes you mid-flight by a fixed amount.
export default class ConfettiBlast extends Hazard {
  static info = {
    id: 'confettiBlast', name: 'Confetti blast', group: 'hazard',
    rule: 'Pushes you mid-flight by a fixed amount when you pass the arrow. The aim preview shows the push.',
    score: 'No touch damage.'
  };

  // Placed before the landing spot is computed, because it changes the arc.
  static get modifier() {
    return true;
  }

  impulse(prevX, x) {
    return prevX < this.x && x >= this.x ? { vx: this.cfg.pushX, vy: this.cfg.pushY } : null;
  }

  draw(r) {
    const g = r.g;
    const c = this.cfg;
    const net = r.t.world.netY;
    g.fillStyle(r.p.outline, 1);
    g.fillTriangle(this.x - c.coneWidth / 2, net, this.x + c.coneWidth / 2, net, this.x, net - c.coneHeight);
    g.fillStyle(r.p.stripeRed, 1);
    g.fillTriangle(this.x - c.coneWidth * c.innerShare / 2, net, this.x + c.coneWidth * c.innerShare / 2, net, this.x, net - c.coneHeight * c.innerShare);
    // Warning arrow in the push direction.
    const len = Math.hypot(c.pushX, c.pushY);
    const ux = c.pushX / len, uy = c.pushY / len;
    const tipX = this.x + ux * c.arrowLength, tipY = this.y + uy * c.arrowLength;
    g.lineStyle(r.t.bars.thickness, r.p.flame, 1);
    g.lineBetween(this.x, this.y, tipX, tipY);
    g.fillStyle(r.p.flame, 1);
    g.fillTriangle(tipX + ux * c.coneWidth / 2, tipY + uy * c.coneWidth / 2, tipX - uy * c.coneWidth / 2, tipY + ux * c.coneWidth / 2, tipX + uy * c.coneWidth / 2, tipY - ux * c.coneWidth / 2);
  }

  static place(b) {
    return [new this(b.tuning, { ...b.bodyAt(b.cfg(this).pathAt), level: b.level })];
  }
}
