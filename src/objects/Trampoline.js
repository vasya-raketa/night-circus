import { GrabObject } from './base.js';
import { arcVelocity, crossingDown } from '../systems/FixedArc.js';

// Land on it feet first and it bounces you into a fixed, bigger arc.
export default class Trampoline extends GrabObject {
  static info = {
    id: 'trampoline', name: 'Trampoline', group: 'grab',
    rule: 'Land on it to bounce automatically into a fixed bigger arc to the next bar.',
    score: '+1 per bounce, perfect in the centre.'
  };

  get feet() {
    const a = this.tuning.acrobat;
    return a.armLength + a.torsoLength + a.thighLength + a.shinLength;
  }

  get slipsInRain() {
    return false;
  }

  // You do not choose when the bounce happens.
  get noChoice() {
    return true;
  }

  catchPoints() {
    return [];
  }

  lowestCatchY() {
    return this.y - this.feet;
  }

  contact(runner, prev) {
    const feetNow = runner.y + this.feet;
    const feetPrev = prev.y + this.feet;
    const dx = Math.abs(runner.x - this.x);
    if (runner.vy <= 0 || feetPrev > this.y || feetNow < this.y || dx > this.cfg.width / 2) return null;
    return { dist: dx, key: runner.x };
  }

  // The bounce always leaves from the centre of the bed, so its arc is exactly fixed.
  holdPoint() {
    return { x: this.x, y: this.y - this.feet, angle: 0, angVel: 0 };
  }

  bounceVelocity() {
    return arcVelocity(this.tuning, this.cfg.distanceScale, this.cfg.heightScale);
  }

  holdEvent() {
    return { launch: this.bounceVelocity() };
  }

  tapVelocity() {
    return false;
  }

  referenceExit() {
    return { x: this.x, y: this.y - this.feet, v: this.bounceVelocity() };
  }

  draw(r) {
    const g = r.g;
    const c = this.cfg;
    const hw = c.width / 2;
    const net = r.t.world.netY;
    g.lineStyle(r.t.bars.thickness, r.p.purple, 1);
    g.lineBetween(this.x - hw, this.y, this.x - hw - c.legSplay, net);
    g.lineBetween(this.x + hw, this.y, this.x + hw + c.legSplay, net);
    for (let x = this.x - hw, i = 0; x < this.x + hw; x += r.t.platform.stripeWidth, i++) {
      g.fillStyle(i % 2 ? r.p.stripeCream : r.p.stripeRed, 1);
      g.fillRect(x, this.y, Math.min(r.t.platform.stripeWidth, this.x + hw - x), c.frameHeight);
    }
    g.lineStyle(r.t.bars.thickness + r.t.acrobat.outlineWidth * 2, r.p.outline, 1);
    g.lineBetween(this.x - hw, this.y, this.x + hw, this.y);
    g.lineStyle(r.t.bars.thickness, r.p.gold, 1);
    g.lineBetween(this.x - hw, this.y, this.x + hw, this.y);
  }

  drawZones(r) {
    r.g.lineStyle(r.t.game.zoneLineWidth, r.p.teal, r.t.game.zoneAlpha);
    r.g.strokeRect(this.x - this.cfg.width / 2, this.y - r.t.game.zoneLineWidth * 4, this.cfg.width, r.t.game.zoneLineWidth * 8);
  }

  // Put the bed where the incoming arc drops `drop` below the landing height.
  static place(b, landing) {
    const c = b.tuning.objects.trampoline;
    const a = b.tuning.acrobat;
    const bedY = landing.y + c.drop;
    const hit = crossingDown(b.path, bedY - (a.armLength + a.torsoLength + a.thighLength + a.shinLength));
    return new this(b.tuning, { x: hit ? hit.x : landing.x, y: bedY, level: b.level });
  }
}
