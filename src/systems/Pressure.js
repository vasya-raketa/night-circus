import { RunState } from './Runner.js';

export const PressureMode = Object.freeze({ CHASER: 'chaser', ROPE: 'rope', SCROLL: 'scroll', OFF: 'off' });

// Time pressure on each bar. Pure logic, shared by the game and the test bots.
// - chaser: a ball behind you moves right at a steady speed; touching it = bowled off.
// - scroll: same moving line, but it is the left screen edge.
// - rope: every grabbed rope burns and snaps after the current budget.
// The budget (average time you can stay on a bar) ramps from `start` to `min` over `rampBars`.
export default class Pressure {
  // settings: { mode, start, min, rampBars }
  constructor(tuning, settings) {
    this.tuning = tuning;
    this.settings = settings;
    this.reset();
  }

  reset() {
    this.active = false;
    this.bars = 0;
    this.line = -Infinity;
    this.speed = 0;
    this.escapeClock = 0;
    this.distance = 0;
  }

  get mode() {
    return this.settings.mode;
  }

  get on() {
    return this.mode !== PressureMode.OFF;
  }

  get moving() {
    return this.active && (this.mode === PressureMode.CHASER || this.mode === PressureMode.SCROLL);
  }

  // Seconds you can stay on each bar right now.
  budget() {
    const s = this.settings;
    const k = Math.min(1, this.bars / Math.max(1, s.rampBars));
    return s.start + (s.min - s.start) * k;
  }

  // A player who waits exactly `budget` on every bar keeps the same distance.
  speedFor(budget) {
    const g = this.tuning.game;
    const flight = 2 * Math.sqrt((2 * g.jumpHeight) / this.tuning.physics.gravity);
    return g.jumpDistance / (budget + flight);
  }

  // Seconds of room before the line reaches the body.
  lead(runner) {
    if (!this.moving) return Infinity;
    return (runner.bodyCenter().x - this.line) / this.speed;
  }

  // 0 (far) .. 1 (touching): drives the glow, heartbeat and distance bar.
  intensity(runner) {
    const lead = this.lead(runner);
    if (!Number.isFinite(lead)) return 0;
    return 1 - Math.max(0, Math.min(1, lead / this.tuning.pressure.warnLead));
  }

  // Called on every catch. Returns events.
  onCatch(runner, obj, perfect) {
    const p = this.tuning.pressure;
    const events = [];
    if (!this.on) return events;
    if (this.active) this.bars++;
    if (!this.active && obj.order >= p.graceBars) {
      this.active = true;
      this.speed = this.speedFor(this.budget());
      this.line = runner.bodyCenter().x - p.startLead * this.speed;
      events.push({ type: 'arrive' });
    } else if (this.active) {
      this.speed = this.speedFor(this.budget());
      if (perfect && this.moving) {
        this.line -= p.perfectPush * this.speed;
        events.push({ type: 'pushback', seconds: p.perfectPush });
      }
    }
    return events;
  }

  onStar() {
    const p = this.tuning.pressure;
    if (!this.moving) return [];
    this.line -= p.starPush * this.speed;
    return [{ type: 'pushback', seconds: p.starPush }];
  }

  // Chaser ball: its surface at bar height is at `line` (that is what the HUD distance uses);
  // contact is tested against the real circle.
  ball() {
    const t = this.tuning;
    const R = t.pressure.ballRadius;
    const cy = t.world.netY - R;
    const refY = t.world.ceilingY + t.swing.ropeLength + t.acrobat.bodyCenterOffset;
    const reach = Math.sqrt(Math.max(0, R * R - (cy - refY) ** 2));
    return { x: this.line - reach, y: cy, r: R };
  }

  touching(runner) {
    const body = runner.bodyCenter();
    const r = this.tuning.game.bodyHitRadius;
    if (this.mode === PressureMode.SCROLL) return body.x - r <= this.line;
    const b = this.ball();
    return Math.hypot(body.x - b.x, body.y - b.y) <= b.r + r || body.x < b.x;
  }

  // Scroll mode: the screen also follows you when you run ahead.
  pushWithView(runner, viewWidth) {
    if (this.mode !== PressureMode.SCROLL || !this.active) return;
    this.line = Math.max(this.line, runner.bodyCenter().x - viewWidth * this.tuning.pressure.scrollPushShare);
  }

  step(dt, world, viewWidth) {
    const p = this.tuning.pressure;
    const r = world.runner;
    const events = [];
    if (!this.active || r.state === RunState.DOWN) return events;

    if (this.mode === PressureMode.ROPE) {
      const h = r.hold;
      if (h && !h.obj.noChoice) {
        h.fuse ??= this.budget();
        if (world.t - h.tGrab >= h.fuse) {
          r.drop('burn', events);
        }
      }
      return events;
    }

    this.line += this.speed * dt;
    this.distance += this.speed * dt;
    this.pushWithView(r, viewWidth);
    const body = r.bodyCenter();
    if (r.state !== RunState.FALL && this.touching(r)) {
      r.knock(p.knockVx, p.knockVy, events);
      events.push({ type: 'caught' });
      return events;
    }
    if (this.mode === PressureMode.CHASER && body.x - this.line > viewWidth * p.escapeShare) {
      this.escapeClock += dt;
      if (this.escapeClock >= p.escapeEvery) {
        this.escapeClock -= p.escapeEvery;
        events.push({ type: 'escape' });
      }
    }
    return events;
  }
}
