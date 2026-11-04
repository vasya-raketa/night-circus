import World from './World.js';
import { RunState } from './Runner.js';

// Fairness check: from `from` (the object you will be holding), is there a release time
// that reaches `to` without touching a hazard, for several arrival times? Objects are pure
// functions of time, so each try is a short replay of the flight only.
// opts.pressure: a safe jump moment must exist between minReaction and safeWindow after landing.
export function checkSegment(tuning, from, to, objects, opts = {}) {
  const f = tuning.fairness;
  const env = new World(tuning, { sim: true });
  env.add(...objects);
  const exit = from.referenceExit();
  const rainLimit = from.slipsInRain && env.env(exit.x).rain ? tuning.game.rainSlipTime : Infinity;
  const p = tuning.pressure;
  const minWait = opts.pressure ? p.minReaction : 0;
  const maxWait = Math.min(opts.pressure ? p.safeWindow : f.maxWait, from.holdLimit, rainLimit, ...objects.map((o) => o.holdLimit ?? Infinity));
  const holdRisk = objects.some((o) => o.hitsWhileHolding);
  const timed = [from, to, ...objects].some((o) => o.constructor.timed || o.tStart !== undefined);
  const dense = timed && (opts.pressure || maxWait < f.maxWait || from.noChoice || holdRisk);
  // Arrival times must cover the longest cycle involved, or a slow obstacle could hide a long blocked spell.
  const cycle = Math.min(f.maxCycle, Math.max(f.denseSpan, ...[from, to, ...objects].map((o) => o.cycle ?? 0)));
  const step = Math.max(f.denseStep, cycle / f.maxArrivals);
  const arrivals = !timed ? [0] : dense ? Array.from({ length: Math.ceil(cycle / step) }, (_, i) => i * step) : f.arrivals;
  for (const arrival of arrivals) {
    const t0 = f.timeBase * (from.order + 1) + arrival;
    if (from.noChoice) {
      // The bounce happens when it happens: every arrival must work as is.
      if (!tryRelease(tuning, from, to, objects, t0, 0)) return { ok: false, arrival };
      continue;
    }
    let streak = 0;
    for (let d = minWait; d <= maxWait && streak < f.minHits; d += f.releaseStep) {
      streak = tryRelease(tuning, from, to, objects, t0, d) ? streak + 1 : 0;
    }
    if (streak < f.minHits) return { ok: false, arrival };
  }
  return { ok: true };
}

function tryRelease(tuning, from, to, objects, t0, delay) {
  const w = new World(tuning, { sim: true });
  w.add(from, ...objects);
  const r = w.runner;
  r.holdOn(from, t0, { phase0: 0 });
  // Hazards that hit you while you hang on (falling props, tent wall) count too.
  for (let t = t0; t < t0 + delay; t += tuning.fairness.holdStep) {
    w.t = t;
    w.sync();
    r.syncHold(t);
    const events = [];
    r.checkHazards(t, events, true);
    if (events.length) return false;
  }
  const result = simulateRelease(w, t0 + delay);
  return result?.type === 'catch' && result.obj.order >= to.order;
}

// Replays "tap at time t" in a sim world whose runner is already holding something.
// Returns the first decisive event (catch / hit / net / drop), or null on timeout.
export function simulateRelease(w, t) {
  const f = w.tuning.fairness;
  const r = w.runner;
  w.t = t;
  w.sync();
  r.syncHold(t);
  r.tap([]);
  const step = w.tuning.physics.fixedStep;
  for (let time = 0; time < f.maxFlight; time += step) {
    for (const e of w.step(step)) {
      if (e.type === 'catch' || e.type === 'hit' || e.type === 'net' || e.type === 'drop') return e;
    }
    if (r.state === RunState.FALL || r.state === RunState.DOWN) return { type: 'fall' };
  }
  return null;
}
