import World from './World.js';
import { createRng } from './LevelGenerator.js';
import { crossingDown, pointAlong } from './FixedArc.js';
import { checkSegment } from './Fairness.js';
import { CATALOG, byId } from '../objects/catalog.js';
import StaticBar from '../objects/StaticBar.js';

export const CourseMode = Object.freeze({ PLAY: 'play', SANDBOX: 'sandbox', TRY: 'try' });

// Builds the course one segment (= one jump) at a time. Each segment simulates the fixed arc
// from the previous grab's exit, puts the next grab on the landing spot, places hazards and
// collectibles on the path, and runs the fairness check before anything is added.
export default class Course {
  // config: { mode, allowed (Set of ids), tryId, frequency, difficulty, seed, log (array),
  //          pressure (true = every jump needs a safe moment within pressure.safeWindow) }
  constructor(tuning, world, config) {
    this.tuning = tuning;
    this.world = world;
    this.config = config;
    this.rng = createRng(config.seed ?? (Math.random() * 2 ** 32) >>> 0);
    this.segment = 0;
    this.order = 0;
    this.finishOrder = Infinity;
    this.log = config.log ?? [];
  }

  start() {
    const t = this.tuning;
    const first = new StaticBar(t, { x: t.game.firstBarOffset, y: t.world.ceilingY, order: this.order });
    this.world.add(first);
    this.last = first;
    return first;
  }

  extend(untilX) {
    while (this.last.x < untilX && this.segment < this.maxSegments) this.buildSegment();
  }

  get maxSegments() {
    const g = this.tuning.game;
    return this.config.mode === CourseMode.TRY ? g.tryLeadBars + g.tryCount + 1 : Infinity;
  }

  activeAreas(x) {
    return this.world.areas.filter((a) => a.x1 > x);
  }

  // Features for the next segment: { grab, hazard, collect, area } classes (or null) and a level.
  pickFeatures(i) {
    const g = this.tuning.game;
    const c = this.config;
    const rng = this.rng;
    const none = { grab: null, hazard: null, collect: null, area: null, level: 0 };
    if (c.mode === CourseMode.TRY) {
      const k = i - g.tryLeadBars;
      if (k < 0 || k >= g.tryCount) return none;
      const cls = byId[c.tryId];
      const ramp = g.tryLevelFrom + ((g.tryLevelTo - g.tryLevelFrom) * k) / Math.max(1, g.tryCount - 1);
      const level = Math.min(1, ramp * c.difficulty * 2);
      const group = cls.info.group;
      // Area effects and long hazards span several jumps: place them once, at the start.
      if ((group === 'area' || cls === byId.lightning) && k > 0) return { ...none, level };
      return { ...none, level, [group]: cls };
    }
    if (i < g.easySegments) return none;
    const play = c.mode === CourseMode.PLAY;
    const freq = play ? g.playFrequency : c.frequency;
    const allowed = CATALOG.filter((cls) => (play ? this.tuning.catalog[cls.info.id].tier <= i : c.allowed.has(cls.info.id)));
    const noChoice = !!this.last.noChoice;
    const pick = (group, chance) => {
      const list = allowed.filter((cls) => cls.info.group === group && cls !== StaticBar && !(noChoice && cls.timed));
      if (!list.length || !rng.chance(freq * chance)) return null;
      const weights = Object.fromEntries(list.map((cls) => [cls.info.id, this.tuning.catalog[cls.info.id].weight]));
      return byId[rng.weighted(weights)];
    };
    const busy = this.activeAreas(this.last.x).length > 0;
    return {
      grab: pick('grab', g.grabChance),
      hazard: pick('hazard', g.hazardChance),
      collect: pick('collect', g.collectChance),
      area: busy ? null : pick('area', g.areaChance),
      level: play ? Math.min(1, i / g.playDifficultyRamp) : c.difficulty
    };
  }

  buildSegment() {
    const i = this.segment++;
    const features = this.pickFeatures(i);
    // Retry plan: [level factor, tempo]. Faster tempo shortens moving cycles so a safe moment
    // comes sooner; each try also re-rolls start positions (phases).
    let attempt = null;
    for (const [levelFactor, tempo] of this.tuning.fairness.retryPlan) {
      attempt = this.trySegment(features, features.level * levelFactor, tempo);
      if (attempt.ok) break;
    }
    if (!attempt.ok) {
      const names = Object.values(features).filter((v) => v && v.info).map((v) => v.info.id);
      const plainFeatures = { grab: null, hazard: null, collect: features.collect, area: null };
      let plain = this.trySegment(plainFeatures, 0);
      let resolution = 'replaced with a plain bar';
      if (!plain.ok) {
        // An earlier (not yet seen) hazard blocks even a plain jump: take it out.
        const blockers = plain.nearby;
        this.world.removeWhere((o) => blockers.includes(o));
        plain = this.trySegment(plainFeatures, 0);
        resolution = `${plain.ok ? 'removed' : 'UNFIXED after removing'} earlier ${blockers.map((o) => o.id).join(', ') || 'nothing'}`;
      }
      const entry = { segment: i, items: names, arrival: attempt.arrival, resolution };
      this.log.push(entry);
      console.warn('[fairness] segment failed, ', entry);
      attempt = plain;
    }
    this.world.add(...attempt.objects);
    this.prevCheck = attempt.check;
    this.order = attempt.grab.order;
    this.last = attempt.grab;
    if (this.config.mode === CourseMode.TRY && i === this.tuning.game.tryLeadBars + this.tuning.game.tryCount) this.finishOrder = attempt.grab.order;
  }

  // Builds one candidate segment and checks it. Does not touch the world.
  trySegment(features, level, tempo = 1) {
    const t = this.tuning;
    const rng = this.rng;
    const prev = this.last;
    const exit = prev.referenceExit();
    const objects = [];
    const sim = new World(t, { sim: true });
    sim.add(...this.activeAreas(exit.x));

    const b = {
      tuning: t, rng, level, exit, path: null, landing: null, grab: null,
      areaSegments: this.config.mode === CourseMode.TRY ? t.game.tryCount : null,
      cfg: (cls) => t.objects[cls.info.id],
      bodyAt: (frac) => {
        const p = pointAlong(b.path, frac, b.landing ? b.landing.index : b.path.length - 1);
        return { x: p.x, y: p.y + t.acrobat.bodyCenterOffset };
      }
    };
    const computePath = () => {
      b.path = sim.predict(exit.x, exit.y, exit.v, t.fairness.maxFlight, t.physics.fixedStep);
    };

    if (features.area) {
      const area = features.area.place(b);
      objects.push(area);
      sim.add(area);
    }
    computePath();
    if (features.hazard?.modifier) {
      const mods = features.hazard.place(b);
      objects.push(...mods);
      sim.add(...mods);
      computePath();
    }

    const jitter = this.config.mode === CourseMode.TRY ? 0 : rng.range(-t.game.barHeightJitter, t.game.barHeightJitter);
    const targetY = t.world.ceilingY + t.swing.ropeLength + jitter;
    b.landing = crossingDown(b.path, targetY) ?? { ...b.path[b.path.length - 1], index: b.path.length - 1 };

    const grabCls = features.grab ?? StaticBar;
    const grab = grabCls.place(b, b.landing);
    grab.order = this.order + 1;
    b.grab = grab;
    objects.push(grab);

    if (features.hazard && !features.hazard.modifier) objects.push(...features.hazard.place(b));
    if (features.collect) objects.push(...features.collect.place(b));

    for (const o of objects) o.tempo = tempo;
    const areas = this.activeAreas(exit.x);
    const D = t.game.jumpDistance;
    const nearby = this.world.objects.filter((o) => o.hit && o.group !== 'area' && o.right >= exit.x - D && o.left <= b.landing.x + D);
    const all = [...areas, ...nearby, ...objects];
    const check = { from: prev, to: grab, objects: all, x0: exit.x - D, x1: b.landing.x + D };
    const opts = { pressure: this.config.pressure };
    const result = checkSegment(t, prev, grab, all, opts);
    if (!result.ok) return { ok: false, arrival: result.arrival, objects, grab, nearby, check };

    // New hazards / areas must not break the previous jump either.
    const p = this.prevCheck;
    const reaching = p ? objects.filter((o) => o !== grab && (o.hit || o.impulse || o.group === 'area') && o.right >= p.x0 && o.left <= p.x1) : [];
    if (reaching.length && !checkSegment(t, p.from, p.to, [...p.objects, ...reaching], opts).ok) {
      return { ok: false, arrival: 'previous jump', objects, grab, nearby, check };
    }
    return { ok: true, objects, grab, nearby, check };
  }
}
