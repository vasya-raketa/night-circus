// Swing physics for the acrobat: pendulum on a trapeze, release, ballistic flight,
// auto-catch at closest approach, falling and landing in the net.
// Pure logic: no Phaser, no rendering. All numbers come from the live `tuning` object.

export const AcrobatState = Object.freeze({
  READY: 'ready',   // standing on the platform holding the first bar
  SWING: 'swing',
  FLY: 'fly',
  FALL: 'fall',
  LANDED: 'landed'
});

// Angular frequency of a bar's swing (rad/s).
export function swingOmega(tuning, swingMul = 1) {
  return Math.sqrt(tuning.physics.gravity / tuning.swing.ropeLength) * tuning.swing.swingSpeed * swingMul;
}

// Energy-equivalent amplitude of a pendulum state (rad).
export function pendulumAmplitude(angle, angVel, omega) {
  const e = (angVel * angVel) / (2 * omega * omega) + (1 - Math.cos(angle));
  return e >= 2 ? Math.PI : Math.acos(1 - e);
}

// Angular velocity at `angle` for a steady swing of amplitude `amp`.
export function pendulumSpeedAt(angle, amp, omega) {
  return omega * Math.sqrt(Math.max(0, 2 * (Math.cos(angle) - Math.cos(amp))));
}

// One semi-implicit Euler step of a driven pendulum `p` ({angle, angVel}).
// The drive pumps or damps energy so the swing settles on `targetAmp`.
export function stepPendulum(p, omega, targetAmp, pump, dt) {
  const amp = pendulumAmplitude(p.angle, p.angVel, omega);
  const drive = pump * omega * omega * (targetAmp - amp) * Math.sign(p.angVel);
  p.angVel += (-omega * omega * Math.sin(p.angle) + drive) * dt;
  p.angle += p.angVel * dt;
}

// Swing phase in [-1, 1]: +1 at the forward peak, 0 at the bottom, -1 on the back swing.
// Moving forward it follows the bar position; moving backward it drops from +1 to -1
// within `peakGrace` (fraction of the amplitude) after the forward peak, so it stays continuous.
export function swingPhase(tuning, angle, angVel) {
  const x = Math.max(-1, Math.min(1, angle / tuning.swing.amplitude));
  if (angVel >= 0) return x;
  const grace = tuning.launch.peakGrace;
  return -1 + 2 * Math.max(0, (x - (1 - grace)) / grace);
}

// Three-point curve over the phase: back (-1), bottom (0), front (+1).
const phaseCurve = (p, back, bottom, front) => (p < 0 ? bottom + (back - bottom) * -p : bottom + (front - bottom) * p);

// Launch power (0..1 of full speed) and angle (radians, forward-up) for a release at this swing state.
export function launchProfile(tuning, angle, angVel) {
  const l = tuning.launch;
  const phase = swingPhase(tuning, angle, angVel);
  const power = phaseCurve(phase, l.power_back, l.power_bottom, l.power_front);
  const deg = Math.max(l.angle_min, Math.min(l.angle_max, phaseCurve(phase, l.angle_back, l.angle_bottom, l.angle_front)));
  return { phase, power, angle: (deg * Math.PI) / 180 };
}

// Launch velocity for a release. Always forward (+x) and upward.
export function launchVelocity(tuning, angle, angVel) {
  const profile = launchProfile(tuning, angle, angVel);
  const speed = profile.power * tuning.launch.speed * tuning.launch.boost;
  return { vx: Math.cos(profile.angle) * speed, vy: -Math.sin(profile.angle) * speed, power: profile.power };
}

// Ballistic flight from (x, y) with launch velocity v, sampled every `dt` until
// it falls through `untilY` or `maxTime` runs out. Used by the planner and the debug arc.
export function predictFlight(tuning, x, y, v, dt, maxTime, untilY = Infinity) {
  const gravity = tuning.physics.gravity;
  let vy = v.vy;
  const path = [{ x, y }];
  for (let t = 0; t < maxTime; t += dt) {
    vy += gravity * dt;
    x += v.vx * dt;
    y += vy * dt;
    path.push({ x, y });
    if (vy > 0 && y >= untilY) break;
  }
  return path;
}

// Simulates releases over a whole swing (forward and back) from a bar anchored at (ax, ay)
// and returns where each flight crosses `targetY` on the way down. Used by the level
// generator to keep gaps reachable and to place hoops, sandbags and stars on a real flight path.
export function planJumps(tuning, ax, ay, swingMul, targetY) {
  const g = tuning.generator;
  const L = tuning.swing.ropeLength;
  const amp = tuning.swing.amplitude;
  const omega = swingOmega(tuning, swingMul);
  const jumps = [];
  for (const dir of [1, -1]) {
    for (let i = 0; i <= g.planSteps; i++) {
      const angle = -amp + (2 * amp * i) / g.planSteps;
      const v = launchVelocity(tuning, angle, dir * pendulumSpeedAt(angle, amp, omega));
      const path = predictFlight(tuning, ax + Math.sin(angle) * L, ay + Math.cos(angle) * L, v, g.planDt, g.planMaxTime, targetY);
      const a = path[path.length - 2], b = path[path.length - 1];
      if (b.y < targetY) continue;
      const landX = a.x + (b.x - a.x) * ((targetY - a.y) / (b.y - a.y));
      jumps.push({ angle, dir, landX, path });
    }
  }
  return jumps;
}

export function maxReach(jumps, ax) {
  return jumps.reduce((best, j) => Math.max(best, j.landX - ax), 0);
}

// The planned jump that lands closest to `targetX`.
export function jumpTowards(jumps, targetX) {
  let best = null;
  for (const j of jumps) {
    if (!best || Math.abs(j.landX - targetX) < Math.abs(best.landX - targetX)) best = j;
  }
  return best;
}

// Point on a planned path at fraction `f` of its horizontal travel.
export function pathPointAt(path, f) {
  const x0 = path[0].x;
  const targetX = x0 + (path[path.length - 1].x - x0) * f;
  for (let i = 1; i < path.length; i++) {
    if (path[i].x >= targetX) return { x: path[i].x, y: path[i].y };
  }
  return path[path.length - 1];
}

export default class AcrobatController {
  constructor(tuning) {
    this.tuning = tuning;
    this.reset(null);
  }

  reset(bar) {
    this.state = AcrobatState.READY;
    this.bar = bar;
    this.releasedBar = null;
    this.x = 0;
    this.y = 0;
    this.vx = 0;
    this.vy = 0;
    this.flightTime = 0;
    this.candidate = null;
    this.candidateDist = Infinity;
    if (bar) {
      bar.angle = -this.tuning.swing.amplitude;
      bar.angVel = 0;
      bar.occupied = true;
      this.syncToBar();
    }
  }

  get isAirborne() {
    return this.state === AcrobatState.FLY || this.state === AcrobatState.FALL;
  }

  omega() {
    return swingOmega(this.tuning, this.bar ? this.bar.swingMul : 1);
  }

  // Leave the platform and start swinging.
  start() {
    if (this.state !== AcrobatState.READY) return false;
    this.state = AcrobatState.SWING;
    return true;
  }

  // Let go of the bar. Returns true when a release happened.
  // `velocity` overrides the phase-based launch (e.g. a fixed-arc jump).
  release(velocity = null) {
    if (this.state !== AcrobatState.SWING) return false;
    const bar = this.bar;
    const v = velocity ?? launchVelocity(this.tuning, bar.angle, bar.angVel);
    this.vx = v.vx;
    this.vy = v.vy;
    this.detach(AcrobatState.FLY);
    return true;
  }

  // Lose the grip without a launch (bar snapped, hazard hit).
  drop() {
    if (this.state === AcrobatState.SWING || this.state === AcrobatState.READY) {
      const bar = this.bar;
      const L = this.tuning.swing.ropeLength;
      this.vx = Math.cos(bar.angle) * L * bar.angVel + bar.anchorVx;
      this.vy = -Math.sin(bar.angle) * L * bar.angVel;
      this.detach(AcrobatState.FALL);
    } else if (this.state === AcrobatState.FLY) {
      this.state = AcrobatState.FALL;
    }
  }

  detach(nextState) {
    this.bar.occupied = false;
    this.releasedBar = this.bar;
    this.bar = null;
    this.state = nextState;
    this.flightTime = 0;
    this.candidate = null;
    this.candidateDist = Infinity;
  }

  syncToBar() {
    const p = this.bar.gripPoint(this.tuning);
    this.x = p.x;
    this.y = p.y;
  }

  // Collision centre of the body (hands are at x, y).
  bodyCenter() {
    const off = this.tuning.acrobat.bodyCenterOffset;
    if (this.state === AcrobatState.SWING) {
      return { x: this.x + Math.sin(this.bar.angle) * off, y: this.y + Math.cos(this.bar.angle) * off };
    }
    return { x: this.x, y: this.y + off };
  }

  // Advances the simulation by dt. Returns a list of events:
  // {type:'catch', bar, perfect, distance} | {type:'miss'} | {type:'net', x}
  update(dt, bars) {
    const t = this.tuning;
    const events = [];
    switch (this.state) {
      case AcrobatState.READY:
        this.bar.angle = -t.swing.amplitude;
        this.bar.angVel = 0;
        this.syncToBar();
        break;
      case AcrobatState.SWING:
        stepPendulum(this.bar, this.omega(), t.swing.amplitude, t.swing.pump, dt);
        this.syncToBar();
        break;
      case AcrobatState.FLY:
        this.integrate(dt);
        this.flightTime += dt;
        this.checkCatch(bars, events);
        if (this.state === AcrobatState.FLY && this.belowAllBars(bars)) {
          this.state = AcrobatState.FALL;
          events.push({ type: 'miss' });
        }
        this.checkNet(events);
        break;
      case AcrobatState.FALL:
        this.integrate(dt);
        this.checkNet(events);
        break;
      case AcrobatState.LANDED:
        this.vx *= Math.max(0, 1 - t.physics.fallDrag * dt);
        this.integrate(dt);
        this.bounceOnNet();
        break;
    }
    return events;
  }

  integrate(dt) {
    this.vy += this.tuning.physics.gravity * dt;
    this.x += this.vx * dt;
    this.y += this.vy * dt;
  }

  catchable(bar) {
    return !bar.broken && bar !== this.releasedBar && bar.index > this.releasedBar.index;
  }

  // Catch happens at the closest approach inside the catch radius,
  // or immediately once inside the perfect radius.
  checkCatch(bars, events) {
    const { radius, perfectRadius } = this.tuning.catch;
    let nearest = null;
    let nearestDist = Infinity;
    for (const bar of bars) {
      if (!this.catchable(bar)) continue;
      const p = bar.gripPoint(this.tuning);
      const d = Math.hypot(p.x - this.x, p.y - this.y);
      if (d < nearestDist) {
        nearest = bar;
        nearestDist = d;
      }
    }
    if (!nearest || nearestDist > radius) {
      if (this.candidate) this.grab(this.candidate, this.candidateDist, events);
      return;
    }
    if (nearest !== this.candidate) {
      this.candidate = nearest;
      this.candidateDist = nearestDist;
    }
    if (nearestDist <= perfectRadius) {
      this.grab(nearest, nearestDist, events);
    } else if (nearestDist > this.candidateDist) {
      this.grab(nearest, this.candidateDist, events);
    } else {
      this.candidateDist = nearestDist;
    }
  }

  grab(bar, distance, events) {
    const t = this.tuning;
    const L = t.swing.ropeLength;
    const tx = Math.cos(bar.angle);
    const ty = -Math.sin(bar.angle);
    const tangential = (this.vx - bar.anchorVx) * tx + this.vy * ty;
    const omega = swingOmega(t, bar.swingMul);
    const maxAngVel = pendulumSpeedAt(0, t.swing.amplitude, omega) * t.swing.maxAngVelFactor;
    bar.angVel = Math.max(-maxAngVel, Math.min(maxAngVel, (tangential / L) * t.swing.catchMomentum));
    bar.occupied = true;
    this.bar = bar;
    this.state = AcrobatState.SWING;
    this.candidate = null;
    this.candidateDist = Infinity;
    this.vx = 0;
    this.vy = 0;
    this.syncToBar();
    events.push({ type: 'catch', bar, perfect: distance <= t.catch.perfectRadius, distance });
  }

  // True once the acrobat is falling below every bar that could still be caught.
  belowAllBars(bars) {
    if (this.vy <= 0) return false;
    let lowestReachable = -Infinity;
    for (const bar of bars) {
      if (!this.catchable(bar)) continue;
      lowestReachable = Math.max(lowestReachable, bar.gripPoint(this.tuning).y);
    }
    return this.y > lowestReachable + this.tuning.catch.radius + this.tuning.catch.fallMargin;
  }

  netContactY() {
    return this.tuning.world.netY - this.tuning.acrobat.bodyCenterOffset - this.tuning.acrobat.bodyRadius;
  }

  checkNet(events) {
    if (this.y < this.netContactY()) return;
    events.push({ type: 'net', x: this.x, speed: this.vy });
    this.state = AcrobatState.LANDED;
    this.bounceOnNet();
  }

  bounceOnNet() {
    const contact = this.netContactY();
    if (this.y < contact || this.vy < 0) return;
    this.y = contact;
    this.vy = this.vy > this.tuning.physics.netSettleSpeed ? -this.vy * this.tuning.physics.netBounce : 0;
  }
}
