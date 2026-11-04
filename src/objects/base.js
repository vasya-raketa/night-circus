import { arcVelocity } from '../systems/FixedArc.js';

// Base types for everything placed on the course. Objects are pure functions of world
// time: sync(t) only caches the current state, so the fairness check can replay them.
// Each subclass sets `static info = { id, name, group, rule, score }` and `static place(b)`.
export class CourseObject {
  constructor(tuning, spec = {}) {
    const info = this.constructor.info;
    this.tuning = tuning;
    this.id = info.id;
    this.group = info.group;
    this.cfg = tuning.objects[info.id];
    this.level = spec.level ?? 0;
    this.phase = spec.phase ?? 0;
    this.x = spec.x ?? 0;
    this.y = spec.y ?? 0;
    this.order = spec.order ?? 0;
    this.tempo = spec.tempo ?? 1;
    this.time = 0;
  }

  // Object-local clock. The generator raises `tempo` to shorten a moving object's cycle
  // when the run needs a safe jump moment sooner.
  clock(t) {
    return t * this.tempo;
  }

  // Difficulty-scaled value between min (level 0) and max (level 1).
  lv(min, max) {
    return min + (max - min) * this.level;
  }

  sync(t) {
    this.time = t;
  }

  get left() {
    return this.x;
  }

  get right() {
    return this.x;
  }

  draw() {}

  drawZones() {}
}

// Something the acrobat can hold. Default: a single fixed catch point.
export class GrabObject extends CourseObject {
  get points() {
    return 1;
  }

  catchRadius(tuning) {
    return tuning.catch.radius;
  }

  perfectRadius(tuning) {
    return tuning.catch.perfectRadius;
  }

  catchPoints(t) {
    const p = this.catchPoint(t);
    return p ? [p] : [];
  }

  catchPoint() {
    return { x: this.x, y: this.y };
  }

  lowestCatchY(t) {
    const pts = this.catchPoints(t);
    return pts.length ? Math.max(...pts.map((p) => p.y)) : this.y;
  }

  startHold() {
    return {};
  }

  holdPoint(t) {
    const p = this.catchPoint(t) ?? { x: this.x, y: this.y };
    return { x: p.x, y: p.y, angle: 0, angVel: 0 };
  }

  // null | { drop: reason } | { launch: velocity }
  holdEvent() {
    return null;
  }

  // null = the fixed arc, false = ignore the tap, or a velocity (cannon).
  tapVelocity() {
    return null;
  }

  // Where and how the generator expects you to leave this object (for placing the next one).
  referenceExit() {
    const p = this.catchPoint(0) ?? { x: this.x, y: this.y };
    return { x: p.x, y: p.y, v: arcVelocity(this.tuning) };
  }

  get holdLimit() {
    return Infinity;
  }

  drawZones(r) {
    const g = r.g;
    g.lineStyle(r.t.game.zoneLineWidth, r.p.teal, r.t.game.zoneAlpha);
    for (const p of this.catchPoints(r.time)) {
      g.strokeCircle(p.x, p.y, this.catchRadius(r.t));
      g.strokeCircle(p.x, p.y, this.perfectRadius(r.t));
    }
  }
}

// A trapeze on two parallel ropes. Empty, it follows its own idle motion; held, the
// acrobat swings it with a fixed amplitude. Subclasses change anchor / idle angle / rules.
export class TrapezeBar extends GrabObject {
  get rope() {
    return this.tuning.swing.ropeLength;
  }

  get barWidth() {
    return this.tuning.bars.width;
  }

  get slipsInRain() {
    return true;
  }

  anchorAt() {
    return { x: this.x, y: this.y };
  }

  idleAngle() {
    return 0;
  }

  naturalOmega() {
    return Math.sqrt(this.tuning.physics.gravity / this.rope) * this.tuning.swing.swingSpeed;
  }

  gripAt(t, angle) {
    const a = this.anchorAt(t);
    return { x: a.x + Math.sin(angle) * this.rope, y: a.y + Math.cos(angle) * this.rope };
  }

  catchPoint(t) {
    return this.broken ? null : this.gripAt(t, this.idleAngle(t));
  }

  lowestCatchY(t) {
    return this.gripAt(t, 0).y;
  }

  startHold(t, runner, extras) {
    const A = this.tuning.game.holdAmplitude;
    const phase0 = extras.phase0 ?? Math.asin(Math.max(-1, Math.min(1, this.idleAngle(t) / A)));
    return { phase0 };
  }

  holdOmega() {
    return this.naturalOmega() * this.tuning.game.holdSwingSpeed;
  }

  holdAngle(t, hold) {
    const w = this.holdOmega();
    const A = this.tuning.game.holdAmplitude;
    const s = w * (t - hold.tGrab) + hold.phase0;
    return { angle: A * Math.sin(s), angVel: A * w * Math.cos(s) };
  }

  holdPoint(t, hold) {
    const { angle, angVel } = this.holdAngle(t, hold);
    const p = this.gripAt(t, angle);
    return { x: p.x, y: p.y, angle, angVel };
  }

  referenceExit() {
    return { x: this.x, y: this.y + this.rope, v: arcVelocity(this.tuning) };
  }

  currentAngle(r) {
    return r.hold?.obj === this ? this.holdAngle(r.time, r.hold).angle : this.idleAngle(r.time);
  }

  ropeColor(r) {
    return r.p.rope;
  }

  barColor(r) {
    return r.p.gold;
  }

  draw(r) {
    const t = r.t;
    const g = r.g;
    const a = this.anchorAt(r.time);
    const hw = this.barWidth / 2;
    if (this.broken) {
      g.lineStyle(t.bars.ropeWidth, r.p.ropeFlash, 1);
      g.lineBetween(a.x - hw, a.y, a.x - hw, a.y + this.rope * t.objects.fragileBar.brokenRopeShare);
      g.lineBetween(a.x + hw, a.y, a.x + hw, a.y + this.rope * t.objects.fragileBar.brokenRopeShare);
      drawAnchors(r, a.x, a.y, hw);
      return;
    }
    const grip = this.gripAt(r.time, this.currentAngle(r));
    g.lineStyle(t.bars.ropeWidth, this.ropeColor(r), 1);
    g.lineBetween(a.x - hw, a.y, grip.x - hw, grip.y);
    g.lineBetween(a.x + hw, a.y, grip.x + hw, grip.y);
    drawAnchors(r, a.x, a.y, hw);
    drawBar(r, grip.x, grip.y, hw, this.barColor(r));
  }

  // Trapezes are placed so their rest grip sits on the landing spot.
  static place(b, landing) {
    return new this(b.tuning, { x: landing.x, y: landing.y - b.tuning.swing.ropeLength, level: b.level, phase: b.rng.range(0, Math.PI * 2) });
  }
}

// Touching = fail unless the subclass says otherwise.
export class Hazard extends CourseObject {
  get hitsWhileHolding() {
    return false;
  }
}

export class Collectible extends CourseObject {
  constructor(tuning, spec) {
    super(tuning, spec);
    this.collected = false;
  }
}

// A stretch of course [x0, x1] that changes the environment.
export class AreaEffect extends CourseObject {
  constructor(tuning, spec) {
    super(tuning, spec);
    this.x0 = spec.x0;
    this.x1 = spec.x1;
    this.sign = spec.sign ?? 1;
  }

  get left() {
    return this.x0;
  }

  get right() {
    return this.x1;
  }

  apply() {}

  covers(x) {
    return x >= this.x0 && x <= this.x1;
  }

  // Zones start at the current exit and last `segments` jumps.
  static place(b) {
    const span = b.tuning.game.jumpDistance * (b.areaSegments ?? b.tuning.objects[this.info.id].segments);
    return new this(b.tuning, { x0: b.exit.x, x1: b.exit.x + span, level: b.level, phase: b.rng.range(0, Math.PI * 2), sign: b.rng.chance(0.5) ? 1 : -1 });
  }
}

// Shared drawing helpers.
export function drawAnchors(r, x, y, hw) {
  r.g.fillStyle(r.p.outline, 1);
  r.g.fillCircle(x - hw, y, r.t.bars.anchorRadius);
  r.g.fillCircle(x + hw, y, r.t.bars.anchorRadius);
}

export function drawBar(r, x, y, hw, color) {
  const g = r.g;
  const th = r.t.bars.thickness;
  const ol = r.t.acrobat.outlineWidth;
  g.fillStyle(r.p.outline, 1);
  g.fillRoundedRect(x - hw - ol, y - th / 2 - ol, hw * 2 + ol * 2, th + ol * 2, (th + ol * 2) / 2);
  g.fillStyle(color, 1);
  g.fillRoundedRect(x - hw, y - th / 2, hw * 2, th, th / 2);
}

export function outlinedCircle(r, x, y, radius, color, alpha = 1) {
  r.g.fillStyle(r.p.outline, alpha);
  r.g.fillCircle(x, y, radius + r.t.acrobat.outlineWidth);
  r.g.fillStyle(color, alpha);
  r.g.fillCircle(x, y, radius);
}

export function segmentDistance(px, py, ax, ay, bx, by) {
  const dx = bx - ax, dy = by - ay;
  const len2 = dx * dx + dy * dy || 1;
  const k = Math.max(0, Math.min(1, ((px - ax) * dx + (py - ay) * dy) / len2));
  return { dist: Math.hypot(px - (ax + dx * k), py - (ay + dy * k)), k };
}
