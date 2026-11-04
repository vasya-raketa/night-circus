import { Hazard, outlinedCircle } from './base.js';

// A column of juggling pins flying up through your arc, in waves with a gap.
export default class JugglingPins extends Hazard {
  static info = {
    id: 'jugglingPins', name: 'Juggling pins', group: 'hazard',
    rule: 'Pins fly up across your arc in waves. Jump so you pass through the gap between waves.',
    score: 'Close call: +2 (near miss).'
  };

  // Moves on its own clock: never placed right after a trampoline bounce.
  static timed = true;

  // Seconds until its motion repeats (used by the fairness check).
  get cycle() {
    return ((Math.round(this.lv(this.cfg.perWaveMin, this.cfg.perWaveMax)) + this.cfg.gapSlots) * this.cfg.spacing) / (this.lv(this.cfg.speedMin, this.cfg.speedMax) * this.tempo);
  }

  get slots() {
    return Math.ceil((this.tuning.world.netY - this.tuning.world.ceilingY) / this.cfg.spacing);
  }

  pins(t) {
    const c = this.cfg;
    const perWave = Math.round(this.lv(c.perWaveMin, c.perWaveMax));
    const period = perWave + c.gapSlots;
    const span = this.slots * c.spacing;
    const travel = this.clock(t) * this.lv(c.speedMin, c.speedMax) + this.phase * span;
    const out = [];
    for (let j = 0; j < this.slots; j++) {
      if (j % period >= perWave) continue;
      const y = this.tuning.world.netY - ((((travel + j * c.spacing) % span) + span) % span);
      out.push({ x: this.x, y });
    }
    return out;
  }

  gap(body, r, t) {
    let best = Infinity;
    for (const p of this.pins(t)) best = Math.min(best, Math.hypot(body.x - p.x, body.y - p.y) - this.cfg.pinRadius - r);
    return best;
  }

  hit(body, r, t) {
    return this.gap(body, r, t) <= 0;
  }

  draw(r) {
    const c = this.cfg;
    for (const p of this.pins(r.time)) {
      outlinedCircle(r, p.x, p.y + c.pinRadius * c.pinHead, c.pinRadius, r.p.stripeCream);
      outlinedCircle(r, p.x, p.y - c.pinRadius, c.pinRadius * c.pinHead, r.p.hazard);
    }
  }

  drawZones(r) {
    r.g.lineStyle(r.t.game.zoneLineWidth, r.p.hazard, r.t.game.zoneAlpha);
    for (const p of this.pins(r.time)) r.g.strokeCircle(p.x, p.y, this.cfg.pinRadius + r.t.game.bodyHitRadius);
  }

  static place(b) {
    return [new this(b.tuning, { ...b.bodyAt(b.cfg(this).pathAt), level: b.level, phase: b.rng.next() })];
  }
}
