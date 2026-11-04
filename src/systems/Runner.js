import { arcVelocity, stepFlight } from './FixedArc.js';

export const RunState = Object.freeze({ HOLD: 'hold', FLY: 'fly', FALL: 'fall', DOWN: 'down' });

// The acrobat in the fixed-arc game. Holds any grab object, flies the fixed arc on tap,
// catches at the closest approach, falls into the net. Pure logic, shared by the live
// game and the fairness simulation. Positions are the hands; the body hangs below them.
export default class Runner {
  constructor(tuning, world) {
    this.tuning = tuning;
    this.world = world;
    this.reset();
  }

  reset() {
    this.state = RunState.DOWN;
    this.x = 0;
    this.y = 0;
    this.vx = 0;
    this.vy = 0;
    this.angle = 0;
    this.angVel = 0;
    this.hold = null;
    this.lastHold = null;
    this.released = null;
    this.fired = new Set();
    this.near = new Map();
    this.passed = new Set();
    this.candidate = null;
    this.candidateDist = Infinity;
  }

  holdOn(obj, t, extras = {}) {
    this.hold = { obj, tGrab: t, ...obj.startHold(t, this, extras) };
    this.lastHold = obj;
    this.state = RunState.HOLD;
    this.vx = 0;
    this.vy = 0;
    this.syncHold(t);
  }

  syncHold(t) {
    const p = this.hold.obj.holdPoint(t, this.hold);
    this.x = p.x;
    this.y = p.y;
    this.angle = p.angle ?? 0;
    this.angVel = p.angVel ?? 0;
  }

  bodyCenter() {
    const off = this.tuning.acrobat.bodyCenterOffset;
    if (this.state === RunState.HOLD) return { x: this.x + Math.sin(this.angle) * off, y: this.y + Math.cos(this.angle) * off };
    return { x: this.x, y: this.y + off };
  }

  // One input. Returns true if it launched.
  tap(events) {
    if (this.state !== RunState.HOLD) return false;
    const h = this.hold;
    const v = h.obj.tapVelocity(this.world.t, h, this);
    if (v === false) return false;
    this.launch(v ?? arcVelocity(this.tuning), events, false);
    return true;
  }

  launch(v, events, auto) {
    const obj = this.hold.obj;
    this.released = obj;
    this.hold = null;
    this.state = RunState.FLY;
    this.vx = v.vx;
    this.vy = v.vy;
    this.fired = new Set();
    this.near = new Map();
    this.passed = new Set();
    this.candidate = null;
    this.candidateDist = Infinity;
    events.push({ type: 'release', obj, auto });
  }

  drop(reason, events) {
    const obj = this.hold?.obj ?? null;
    if (obj) this.released = obj;
    this.hold = null;
    this.state = RunState.FALL;
    this.vx = 0;
    this.vy = 0;
    events.push({ type: 'drop', reason, obj });
  }

  // Knocked off whatever you were doing (the chaser): tumble away and fall.
  knock(vx, vy, events) {
    const obj = this.hold?.obj ?? null;
    if (obj) this.released = obj;
    this.hold = null;
    this.state = RunState.FALL;
    this.vx = vx;
    this.vy = vy;
    events.push({ type: 'drop', reason: 'bowled', obj });
  }

  step(dt, events) {
    const w = this.world;
    const t = w.t;
    if (this.state === RunState.HOLD) {
      const h = this.hold;
      this.syncHold(t);
      let ev = h.obj.holdEvent(t, h, this);
      if (!ev && h.obj.slipsInRain && t - h.tGrab > this.tuning.game.rainSlipTime && w.env(this.x).rain) ev = { drop: 'slip' };
      if (ev?.drop) this.drop(ev.drop, events);
      else if (ev?.launch) this.launch(ev.launch, events, true);
      if (this.state === RunState.HOLD) this.checkHazards(t, events, true);
      return;
    }
    if (this.state === RunState.DOWN) return;

    const prev = { x: this.x, y: this.y };
    stepFlight(this, w.env(this.x), this.tuning.physics.gravity, dt);

    if (this.state === RunState.FLY) {
      for (const o of w.impulses) {
        if (this.fired.has(o)) continue;
        const push = o.impulse(prev.x, this.x, t);
        if (!push) continue;
        this.fired.add(o);
        this.vx += push.vx;
        this.vy += push.vy;
        events.push({ type: 'push', obj: o });
      }
      this.checkHazards(t, events, false, prev);
      if (this.state === RunState.FLY && !w.sim) this.checkCollect(events);
      if (this.state === RunState.FLY) this.checkCatch(t, prev, events);
      if (this.state === RunState.FLY && this.belowAll(t)) {
        this.state = RunState.FALL;
        events.push({ type: 'miss' });
      }
    }
    const netContact = this.tuning.world.netY - this.tuning.acrobat.bodyCenterOffset - this.tuning.acrobat.bodyRadius;
    if (this.y >= netContact) {
      events.push({ type: 'net', x: this.x, speed: this.vy });
      this.y = netContact;
      this.vx = 0;
      this.vy = 0;
      this.state = RunState.DOWN;
    }
  }

  checkHazards(t, events, holding, prev) {
    const w = this.world;
    const body = this.bodyCenter();
    const r = this.tuning.game.bodyHitRadius;
    for (const h of w.hazards) {
      if (holding && !h.hitsWhileHolding) continue;
      if (h.hit(body, r, t)) {
        events.push({ type: 'hit', obj: h });
        if (this.state === RunState.HOLD) this.drop('hit', events);
        else this.state = RunState.FALL;
        return;
      }
      if (holding || w.sim) continue;
      if (h.through && !this.passed.has(h) && prev && h.through({ x: prev.x, y: prev.y + this.tuning.acrobat.bodyCenterOffset }, body, t)) {
        this.passed.add(h);
        events.push({ type: 'through', obj: h });
      }
      if (h.gap) {
        const gap = h.gap(body, r, t);
        const inside = gap < this.tuning.score.nearMissDistance;
        if (inside) this.near.set(h, true);
        else if (this.near.get(h) === true) {
          this.near.set(h, 'done');
          events.push({ type: 'near', obj: h });
        }
      }
    }
  }

  checkCollect(events) {
    const body = this.bodyCenter();
    const prevBody = { x: body.x - this.vx * this.tuning.physics.fixedStep, y: body.y - this.vy * this.tuning.physics.fixedStep };
    for (const c of this.world.collectibles) {
      if (c.collected) continue;
      if (c.collect(body, this.tuning.game.bodyHitRadius, prevBody)) events.push({ type: 'collect', obj: c });
    }
  }

  catchable(obj) {
    return !obj.broken && (!this.released || obj.order > this.released.order);
  }

  // Catch at the closest approach inside the catch radius (or at once inside the perfect radius).
  // Objects offer one or more catch points ({x, y, key}); `contact` objects decide themselves.
  checkCatch(t, prev, events) {
    const tuning = this.tuning;
    let nearest = null;
    let nearestDist = Infinity;
    for (const obj of this.world.grabs) {
      if (!this.catchable(obj)) continue;
      if (obj.contact) {
        const hit = obj.contact(this, prev, t);
        if (hit) return this.grab({ obj, key: hit.key }, hit.dist, events, t);
        continue;
      }
      for (const p of obj.catchPoints(t)) {
        const d = Math.hypot(p.x - this.x, p.y - this.y);
        if (d <= obj.catchRadius(tuning) && d < nearestDist) {
          nearest = { obj, key: p.key };
          nearestDist = d;
        }
      }
    }
    if (!nearest) {
      if (this.candidate) this.grab(this.candidate, this.candidateDist, events, t);
      return;
    }
    if (nearest.obj !== this.candidate?.obj || nearest.key !== this.candidate?.key) {
      this.candidate = nearest;
      this.candidateDist = nearestDist;
    }
    if (nearestDist <= nearest.obj.perfectRadius(tuning)) this.grab(nearest, nearestDist, events, t);
    else if (nearestDist > this.candidateDist) this.grab(nearest, this.candidateDist, events, t);
    else this.candidateDist = nearestDist;
  }

  grab({ obj, key }, dist, events, t) {
    const incoming = { vx: this.vx, vy: this.vy, x: this.x, y: this.y };
    this.candidate = null;
    this.candidateDist = Infinity;
    this.holdOn(obj, t, { incoming, key });
    events.push({ type: 'catch', obj, perfect: dist <= obj.perfectRadius(this.tuning), dist });
  }

  belowAll(t) {
    if (this.vy <= 0) return false;
    let lowest = -Infinity;
    for (const obj of this.world.grabs) {
      if (!this.catchable(obj) || Math.abs(obj.x - this.x) > this.tuning.game.jumpDistance * 2) continue;
      const y = obj.lowestCatchY(t);
      if (y !== null) lowest = Math.max(lowest, y);
    }
    return this.y > lowest + this.tuning.catch.radius + this.tuning.game.fallMargin;
  }
}
