import Runner from './Runner.js';
import { stepFlight } from './FixedArc.js';

const BASE_ENV = Object.freeze({ gravityScale: 1, ax: 0, rain: false, dark: false, mirror: false, storm: false });

// Everything placed on the course plus the runner. Objects are pure functions of time
// (`sync(t)`), so the same World type runs the live game and the fairness simulation.
export default class World {
  constructor(tuning, { sim = false } = {}) {
    this.tuning = tuning;
    this.sim = sim;
    this.t = 0;
    this.objects = [];
    this.index();
    this.runner = new Runner(tuning, this);
  }

  add(...objs) {
    this.objects.push(...objs);
    this.index();
  }

  removeWhere(pred) {
    this.objects = this.objects.filter((o) => !pred(o));
    this.index();
  }

  index() {
    this.grabs = this.objects.filter((o) => o.group === 'grab');
    this.hazards = this.objects.filter((o) => o.hit);
    this.impulses = this.objects.filter((o) => o.impulse);
    this.collectibles = this.objects.filter((o) => o.group === 'collect');
    this.areas = this.objects.filter((o) => o.group === 'area');
  }

  // Combined area effects at x.
  env(x) {
    let env = BASE_ENV;
    for (const a of this.areas) {
      if (x < a.x0 || x > a.x1) continue;
      if (env === BASE_ENV) env = { ...BASE_ENV };
      a.apply(env);
    }
    return env;
  }

  sync() {
    for (const o of this.objects) o.sync(this.t);
  }

  step(dt) {
    this.t += dt;
    this.sync();
    const events = [];
    this.runner.step(dt, events);
    return events;
  }

  // The flight path from (x, y) with launch v, integrated exactly like the runner (same step,
  // area effects and confetti pushes included). Samples a point every `sampleEvery` seconds
  // and stops when it falls past `untilY`.
  predict(x, y, v, maxTime, sampleEvery, untilY = this.tuning.world.netY) {
    const dt = this.tuning.physics.fixedStep;
    const body = { x, y, vx: v.vx, vy: v.vy };
    const path = [{ x, y }];
    const fired = new Set();
    let sinceSample = 0;
    for (let time = 0; time < maxTime; time += dt) {
      const prevX = body.x;
      stepFlight(body, this.env(body.x), this.tuning.physics.gravity, dt);
      for (const o of this.impulses) {
        if (fired.has(o)) continue;
        const push = o.impulse(prevX, body.x, this.t + time);
        if (!push) continue;
        fired.add(o);
        body.vx += push.vx;
        body.vy += push.vy;
      }
      sinceSample += dt;
      if (sinceSample >= sampleEvery - 1e-9) {
        sinceSample = 0;
        path.push({ x: body.x, y: body.y });
      }
      if (body.vy > 0 && body.y > untilY) break;
    }
    return path;
  }
}
