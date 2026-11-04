import Trapeze, { BarKind } from './Trapeze.js';
import { FireHoop, Sandbag, Star } from './Hazards.js';
import { planJumps, maxReach, jumpTowards, pathPointAt } from './AcrobatController.js';

// Small seeded RNG so runs can be replayed with ?seed=N.
export function createRng(seed) {
  let s = seed >>> 0;
  const next = () => {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  return {
    next,
    range: (min, max) => min + (max - min) * next(),
    int: (min, max) => Math.floor(min + (max - min + 1) * next()),
    chance: (p) => next() < p,
    weighted: (weights) => {
      const entries = Object.entries(weights);
      let roll = next() * entries.reduce((sum, [, w]) => sum + w, 0);
      for (const [key, w] of entries) {
        roll -= w;
        if (roll <= 0) return key;
      }
      return entries[entries.length - 1][0];
    }
  };
}

// Endless bar layout. Gaps and swing speed ramp with distance, the first bars are
// always easy, and every gap is checked against a simulated jump so it stays reachable.
export default class LevelGenerator {
  constructor(tuning, rng) {
    this.tuning = tuning;
    this.rng = rng;
    this.prev = null;
    this.count = 0;
  }

  // Returns { bar, hazards, stars } for the next bar.
  next(startX) {
    const t = this.tuning;
    const g = t.generator;
    const i = this.count++;
    const rng = this.rng;
    const hard = Math.max(0, i - g.easyCount);
    const swingMul = Math.min(g.swingSpeedMax, 1 + g.swingSpeedGrowthPerBar * hard);
    const phase = rng.range(0, Math.PI * 2);

    if (!this.prev) {
      const bar = new Trapeze({ index: i, x: startX, y: t.world.ceilingY, swingMul, phase });
      bar.startIdle(t);
      this.prev = bar;
      return { bar, hazards: [], stars: [] };
    }

    const prev = this.prev;
    const withObstacles = i >= g.obstacleStartBar;
    let obstacle = withObstacles && rng.chance(g.obstacleChance) ? rng.weighted(g.obstacleWeights) : null;
    // A fragile bar only gives a short window to jump, so keep the next gap clear.
    if (prev.kind === BarKind.FRAGILE && (obstacle === 'hoop' || obstacle === 'sandbag')) obstacle = null;
    const kind = obstacle === 'rail' ? BarKind.RAIL : obstacle === 'fragile' ? BarKind.FRAGILE : BarKind.NORMAL;

    const anchorY = i <= g.easyCount
      ? t.world.ceilingY
      : Math.min(g.anchorMaxY, Math.max(g.anchorMinY, prev.anchorY + rng.range(-g.heightJitter, g.heightJitter)));
    const targetY = anchorY + t.swing.ropeLength;

    const jumps = planJumps(t, prev.baseX, prev.anchorY, prev.swingMul, targetY);
    let reach = maxReach(jumps, prev.baseX) * g.reachSafety;
    if (kind === BarKind.RAIL) reach -= t.obstacles.rail.range * t.obstacles.rail.reachShare;

    const wanted = i <= g.easyCount
      ? g.easyGap
      : Math.min(g.gapMax, g.gapStart + g.gapGrowthPerBar * hard) + rng.range(-g.gapJitter, g.gapJitter);
    const gap = Math.max(g.minGap, Math.min(wanted, reach));
    const x = prev.baseX + gap;

    const bar = new Trapeze({ index: i, x, y: anchorY, swingMul, kind, phase });
    bar.startIdle(t);
    this.prev = bar;

    const hazards = [];
    const stars = [];
    const jump = jumpTowards(jumps, x);
    // Hazards and stars sit on the body's path, which hangs below the hands.
    const bodyAt = (f) => {
      const p = pathPointAt(jump.path, f);
      return { x: p.x, y: p.y + t.acrobat.bodyCenterOffset };
    };
    if (jump) {
      if (obstacle === 'hoop') {
        hazards.push(new FireHoop(bodyAt(g.hoopPathAt)));
      } else if (obstacle === 'sandbag') {
        const p = bodyAt(g.sandbagPathAt);
        const anchorYBag = t.world.ceilingY;
        hazards.push(new Sandbag({
          anchorX: p.x,
          anchorY: anchorYBag,
          length: p.y + t.obstacles.sandbag.pathDrop - anchorYBag,
          phase: rng.range(0, Math.PI * 2)
        }));
      } else if (rng.chance(g.starChance)) {
        const n = rng.int(g.starMin, g.starMax);
        for (let k = 0; k < n; k++) {
          const f = n === 1 ? (g.starPathFrom + g.starPathTo) / 2 : g.starPathFrom + (g.starPathTo - g.starPathFrom) * (k / (n - 1));
          stars.push(new Star({ ...bodyAt(f), phase: rng.range(0, Math.PI * 2) }));
        }
      }
    }
    return { bar, hazards, stars };
  }
}
