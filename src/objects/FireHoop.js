import { Hazard } from './base.js';

// Edge-on burning hoop that bobs up and down in your arc.
export default class FireHoop extends Hazard {
  static info = {
    id: 'fireHoop', name: 'Fire hoop', group: 'hazard',
    rule: 'Sits in your arc and moves up and down. Touch the burning rim and you fall.',
    score: 'Fly through the centre: +3.'
  };

  // Moves on its own clock: never placed right after a trampoline bounce.
  static timed = true;

  // Seconds until its motion repeats (used by the fairness check).
  get cycle() {
    return Math.PI * 2 / (this.lv(this.cfg.speedMin, this.cfg.speedMax) * this.tempo);
  }

  centerY(t) {
    return this.y + Math.sin(this.phase + this.clock(t) * this.lv(this.cfg.speedMin, this.cfg.speedMax)) * this.lv(this.cfg.moveMin, this.cfg.moveMax);
  }

  rimGap(body, r, t) {
    const cy = this.centerY(t);
    const R = this.cfg.radius;
    return Math.min(Math.hypot(body.x - this.x, body.y - (cy - R)), Math.hypot(body.x - this.x, body.y - (cy + R))) - this.cfg.rimRadius - r;
  }

  hit(body, r, t) {
    return this.rimGap(body, r, t) <= 0;
  }

  gap(body, r, t) {
    return this.rimGap(body, r, t);
  }

  through(prev, body, t) {
    return prev.x < this.x && body.x >= this.x && Math.abs(body.y - this.centerY(t)) < this.cfg.radius - this.cfg.rimRadius;
  }

  draw(r) {
    const g = r.g;
    const c = this.cfg;
    const cy = this.centerY(r.time);
    g.lineStyle(c.rimRadius + r.t.acrobat.outlineWidth * 2, r.p.outline, 1);
    g.strokeEllipse(this.x, cy, c.drawWidth, c.radius * 2);
    g.lineStyle(c.rimRadius, r.p.hazard, 1);
    g.strokeEllipse(this.x, cy, c.drawWidth, c.radius * 2);
    for (let i = 0; i < c.flameCount; i++) {
      const a = (i / c.flameCount) * Math.PI * 2;
      const flick = (1 + Math.sin(r.time * c.flameFlicker + i * c.flamePhaseStep)) / 2;
      g.fillStyle(i % 2 ? r.p.flame : r.p.hazard, c.flameAlpha);
      g.fillCircle(this.x + Math.cos(a) * c.drawWidth / 2, cy + Math.sin(a) * c.radius - flick * c.flameSize, c.flameSize * (1 + flick) / 2);
    }
  }

  drawZones(r) {
    const cy = this.centerY(r.time);
    r.g.lineStyle(r.t.game.zoneLineWidth, r.p.hazard, r.t.game.zoneAlpha);
    r.g.strokeCircle(this.x, cy - this.cfg.radius, this.cfg.rimRadius);
    r.g.strokeCircle(this.x, cy + this.cfg.radius, this.cfg.rimRadius);
  }

  static place(b) {
    return [new this(b.tuning, { ...b.bodyAt(b.cfg(this).pathAt), level: b.level, phase: b.rng.range(0, Math.PI * 2) })];
  }
}
