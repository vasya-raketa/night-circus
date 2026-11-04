import { TrapezeBar, drawAnchors, drawBar } from './base.js';

// A second acrobat hangs by the knees from a swinging trapeze; their hands are the catch point.
export default class PartnerCatcher extends TrapezeBar {
  static info = {
    id: 'partnerCatcher', name: 'Partner catcher', group: 'grab',
    rule: 'A catcher swings on their own rhythm. You are caught only if their hands are in your landing spot.',
    score: '+1 per catch.'
  };

  // Moves on its own clock: never placed right after a trampoline bounce.
  static timed = true;

  // Seconds until its motion repeats (used by the fairness check).
  get cycle() {
    return Math.PI * 2 / (this.naturalOmega() * this.lv(this.cfg.speedMin, this.cfg.speedMax) * this.tempo);
  }

  get reach() {
    return this.rope + this.cfg.bodyLength;
  }

  idleAngle(t) {
    const c = this.cfg;
    return this.lv(c.ampMin, c.ampMax) * Math.sin(this.phase + this.clock(t) * this.naturalOmega() * this.lv(c.speedMin, c.speedMax));
  }

  gripAt(t, angle) {
    const a = this.anchorAt(t);
    return { x: a.x + Math.sin(angle) * this.reach, y: a.y + Math.cos(angle) * this.reach };
  }

  lowestCatchY(t) {
    return this.gripAt(t, 0).y;
  }

  // You swing with the catcher, on their rhythm.
  holdAngle(t) {
    const dt = this.tuning.physics.fixedStep;
    const angle = this.idleAngle(t);
    return { angle, angVel: (this.idleAngle(t + dt) - angle) / dt };
  }

  referenceExit() {
    const e = super.referenceExit();
    return { ...e, y: this.y + this.reach };
  }

  draw(r) {
    const g = r.g;
    const t = r.t;
    const ac = t.acrobat;
    const a = this.anchorAt(r.time);
    const angle = this.currentAngle(r);
    const s = Math.sin(angle), c = Math.cos(angle);
    const hw = this.barWidth / 2;
    const bar = { x: a.x + s * this.rope, y: a.y + c * this.rope };
    g.lineStyle(t.bars.ropeWidth, r.p.rope, 1);
    g.lineBetween(a.x - hw, a.y, bar.x - hw, bar.y);
    g.lineBetween(a.x + hw, a.y, bar.x + hw, bar.y);
    drawAnchors(r, a.x, a.y, hw);
    drawBar(r, bar.x, bar.y, hw, r.p.rope);
    // Upside-down catcher: knees over the bar, body and arms hanging down to the hands.
    const at = (d) => ({ x: bar.x + s * d, y: bar.y + c * d });
    const hip = at(ac.thighLength);
    const shoulder = at(ac.thighLength + ac.torsoLength);
    const head = at(ac.thighLength + ac.torsoLength + ac.headRadius);
    const hands = this.gripAt(r.time, angle);
    const lines = [[bar, hip, ac.limbWidth, r.p.purple], [hip, shoulder, ac.torsoWidth, r.p.purple], [shoulder, hands, ac.limbWidth, r.p.skin]];
    for (const [p, q, w] of lines) {
      g.lineStyle(w + ac.outlineWidth * 2, r.p.outline, 1);
      g.lineBetween(p.x, p.y, q.x, q.y);
    }
    for (const [p, q, w, col] of lines) {
      g.lineStyle(w, col, 1);
      g.lineBetween(p.x, p.y, q.x, q.y);
    }
    g.fillStyle(r.p.outline, 1);
    g.fillCircle(head.x, head.y, ac.headRadius + ac.outlineWidth);
    g.fillStyle(r.p.skin, 1);
    g.fillCircle(head.x, head.y, ac.headRadius);
    g.fillStyle(r.p.gold, 1);
    g.fillCircle(hands.x, hands.y, ac.limbWidth);
  }

  static place(b, landing) {
    const reach = b.tuning.swing.ropeLength + b.tuning.objects.partnerCatcher.bodyLength;
    return new this(b.tuning, { x: landing.x, y: landing.y - reach, level: b.level, phase: b.rng.range(0, Math.PI * 2) });
  }
}
