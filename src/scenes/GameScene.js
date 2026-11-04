import ArcadeScene from './ArcadeScene.js';
import { Phase } from './Phase.js';
import World from '../systems/World.js';
import Course, { CourseMode } from '../systems/Course.js';
import { RunState } from '../systems/Runner.js';
import { arcVelocity } from '../systems/FixedArc.js';
import WorldRenderer from '../render/WorldRenderer.js';
import AcrobatRenderer from '../render/AcrobatRenderer.js';
import { lerp, smoothing } from '../render/palette.js';
import Pressure, { PressureMode } from '../systems/Pressure.js';

// The main game: the fixed-arc trapeze. Tap = let go, always the same arc.
// Modes: menu (idle backdrop), play, sandbox (only toggled items), try (one item, 5 times).
export default class GameScene extends ArcadeScene {
  constructor() {
    super('Game', 'game');
    this.runConfig = { mode: 'menu' };
    this.hudTitle = 'NIGHT CIRCUS';
    this.hudHint = 'TAP to start swinging\nTAP to let go: same jump every time';
  }

  get settings() {
    return this.registry.get('session').settings;
  }

  // Called by the app (menu / playground).
  startRun(config) {
    this.runConfig = config;
    this.resetRun();
  }

  setup() {
    const t = this.tuning;
    this.worldView = new WorldRenderer(this, t, this.palette);
    this.objG = this.add.graphics();
    this.arcG = this.add.graphics();
    this.acrobatView = new AcrobatRenderer(this, t, this.palette);
    this.overlayG = this.add.graphics();
    this.zoneG = this.add.graphics();
    this.worldView.g.setDepth(0);
    this.objG.setDepth(0.5);
    this.arcG.setDepth(1.5);
    this.acrobatView.g.setDepth(2);
    this.overlayG.setDepth(4);
    this.zoneG.setDepth(5);
  }

  get menu() {
    return this.runConfig.mode === 'menu';
  }

  get hudHidden() {
    return this.menu;
  }

  resetWorld() {
    const t = this.tuning;
    const s = this.settings;
    const c = this.runConfig;
    const session = this.registry.get('session');
    this.recordsBest = c.mode === CourseMode.PLAY;
    this.overTitle = null;
    this.golden = 0;
    this.started = false;
    this.respawnAt = null;
    this.pressure = new Pressure(t, s.pressure);
    this.tumble = null;
    this.heartClock = 0;
    this.wobble = 0;
    this.world = new World(t);
    this.course = new Course(t, this.world, {
      mode: c.mode === 'menu' ? CourseMode.PLAY : c.mode,
      allowed: c.allowed,
      tryId: c.tryId,
      frequency: s.frequency,
      difficulty: s.difficulty,
      seed: this.registry.get('seed') ?? undefined,
      log: session.fairnessLog,
      pressure: s.pressure.mode !== PressureMode.OFF
    });
    const first = this.course.start();
    this.world.runner.holdOn(first, 0, { phase0: -Math.PI / 2 });
    this.world.sync();
    this.acrobatView.reset();
    this.tuck = 0;
    this.platform = this.platformSpot(first);
    this.cameraX = this.platform.x + this.lead();
    this.cameras.main.centerOn(this.cameraX, t.world.cameraY);
    this.course.extend(this.viewRect().right + t.world.spawnAhead);
    this.timeScale = s.slowMo ? t.playground.slowMoScale : 1;
    this.setMirror(false);
  }

  platformSpot(first) {
    const a = this.tuning.acrobat;
    const grip = first.gripAt(0, -this.tuning.game.holdAmplitude);
    return { x: grip.x, y: grip.y + a.armLength + a.torsoLength + a.thighLength + a.shinLength };
  }

  lead() {
    return Math.min(this.cfg.cameraLead, this.viewRect().width * (0.5 - this.tuning.world.cameraMinEdge));
  }

  press() {
    if (this.menu) return;
    super.press();
  }

  onPress() {
    if (!this.started) {
      this.started = true;
      return;
    }
    const events = [];
    this.world.runner.tap(events);
    this.handle(events);
  }

  step(h) {
    if (!this.started || this.menu) return;
    const w = this.world;
    if (this.respawnAt !== null) {
      if (w.t >= this.respawnAt) this.respawn();
      w.t += h;
      return;
    }
    this.handle(w.step(h));
    this.handle(this.pressure.step(h, w, this.viewRect().width));
    this.wobble = Math.max(0, this.wobble - h);
  }

  handle(events) {
    const t = this.tuning;
    const r = this.world.runner;
    for (const e of events) {
      const body = r.bodyCenter();
      switch (e.type) {
        case 'release':
          this.audio.whoosh();
          break;
        case 'catch':
          this.onCatch(e);
          break;
        case 'drop':
          if (e.reason === 'snap' || e.reason === 'pop') e.obj.broken = true;
          this.effects.sparks(body.x, body.y, this.palette.rope);
          if (e.reason === 'bowled') break;
          this.effects.popup(body.x, body.y - t.juice.popupRise, { snap: 'SNAP!', slip: 'SLIP!', pop: 'POP!', hit: 'OUCH!', burn: 'BURNT!' }[e.reason] ?? '!', t.colors.hazard);
          this.audio.click();
          break;
        case 'hit':
          this.effects.sparks(body.x, body.y, this.palette.hazard);
          this.effects.popup(body.x, body.y - t.juice.popupRise, 'OUCH!', t.colors.hazard);
          this.cameras.main.shake(t.juice.hitShakeMs, t.juice.hitShakeIntensity);
          break;
        case 'near': {
          const gained = this.score.add(t.score.nearMiss);
          this.slowmo = t.juice.slowmoTime;
          this.effects.popup(body.x, body.y - t.juice.popupRise, `NEAR MISS +${gained}`, t.colors.spotlight);
          break;
        }
        case 'through': {
          const gained = this.score.add(e.obj.cfg.points);
          this.effects.sparks(e.obj.x, e.obj.y, this.palette.flame);
          this.effects.popup(e.obj.x, e.obj.y - e.obj.cfg.radius, `HOOP +${gained}`, t.colors.flame);
          this.audio.sparkle();
          break;
        }
        case 'collect':
          this.onCollect(e.obj);
          break;
        case 'push':
          this.effects.sparks(body.x, body.y, this.palette.teal);
          this.effects.sparks(body.x, body.y, this.palette.star);
          this.effects.popup(body.x, body.y - t.juice.popupRise, 'WHOOSH!', t.colors.teal);
          this.audio.whoosh();
          break;
        case 'arrive':
          if (this.pressure.mode === PressureMode.SCROLL) this.pressure.line = Math.max(this.pressure.line, this.viewRect().x);
          if (this.pressure.mode !== PressureMode.ROPE) {
            this.audio.rumble();
            this.cameras.main.shake(t.pressure.arriveShakeMs, t.pressure.arriveShakeIntensity);
          }
          this.effects.popup(r.x, r.y - t.juice.popupRise * 2, { chaser: 'HERE IT COMES!', scroll: 'KEEP MOVING!', rope: 'ROPES ARE BURNING!' }[this.pressure.mode], t.colors.hazard);
          break;
        case 'pushback':
          this.wobble = t.pressure.wobbleTime;
          this.audio.whoosh();
          this.effects.popup(r.x, r.y - t.juice.popupRise * 2, `+${e.seconds}s`, t.colors.teal);
          break;
        case 'caught':
          this.tumble = 0;
          this.audio.boing();
          this.cameras.main.shake(t.juice.hitShakeMs, t.juice.hitShakeIntensity);
          this.effects.sparks(body.x, body.y, this.palette.stripeRed);
          this.effects.sparks(body.x, body.y, this.palette.stripeCream);
          this.effects.popup(body.x, body.y - t.juice.popupRise, this.pressure.mode === PressureMode.SCROLL ? 'LEFT BEHIND!' : 'BOWLED OVER!', t.colors.hazard);
          break;
        case 'escape':
          this.score.score += t.pressure.escapePoints;
          this.effects.popup(r.x, r.y - t.juice.popupRise * 2, `ESCAPE +${t.pressure.escapePoints}`, t.colors.teal);
          this.audio.sparkle();
          break;
        case 'net':
          this.worldView.dipNet(e.x, Math.min(1, e.speed / t.juice.netDipSpeed));
          if (this.settings.invincible) {
            this.audio.thud();
            this.respawnAt = this.world.t + t.game.respawnPause;
          } else {
            this.gameOver();
          }
          break;
      }
    }
  }

  onCatch({ obj, perfect }) {
    const t = this.tuning;
    const p = this.world.runner;
    this.score.combo(perfect);
    let points = obj.points * (this.golden > 0 ? t.objects.goldenBar.multiplier : 1);
    if (this.golden > 0) this.golden--;
    const gained = this.score.add(points);
    this.audio.click();
    if (obj.golden) {
      this.golden = t.objects.goldenBar.catches;
      this.effects.popup(p.x, p.y - t.juice.popupRise * 2, `GOLDEN x${t.objects.goldenBar.multiplier}!`, t.colors.star);
    }
    if (perfect) this.perfectHit(p.x, p.y, `PERFECT x${this.score.multiplier}`);
    else this.effects.popup(p.x, p.y - t.juice.popupRise, `+${gained}`, t.colors.gold);
    if (obj.order >= this.course.finishOrder) this.laneComplete();
    this.handle(this.pressure.onCatch(p, obj, perfect));
  }

  onCollect(obj) {
    const t = this.tuning;
    obj.collected = true;
    if (obj.id === 'goldRing') this.score.combo(true);
    const gained = this.score.add(obj.cfg.points);
    this.effects.sparks(obj.x, obj.y, this.palette.star);
    this.effects.popup(obj.x, obj.y - t.juice.popupRise, obj.id === 'goldRing' ? `RING +${gained} x${this.score.multiplier}` : `+${gained}`, t.colors.star);
    this.audio.sparkle();
    if (obj.id === 'star') this.handle(this.pressure.onStar());
  }

  laneComplete() {
    this.overTitle = 'LANE CLEAR!';
    this.audio.chime(this.score.level + 1);
    this.effects.starBurst(this.world.runner.x, this.world.runner.y);
    this.phase = Phase.OVER;
    this.overTime = 0;
  }

  gameOver() {
    this.overTitle = null;
    if (!this.recordsBest) {
      this.cameras.main.shake(this.tuning.juice.shakeMs, this.tuning.juice.shakeIntensity);
      this.audio.thud();
      this.phase = Phase.OVER;
      this.overTime = 0;
      return;
    }
    super.gameOver();
  }

  // Invincible mode: back on the last thing you held.
  respawn() {
    const w = this.world;
    const obj = w.runner.lastHold;
    obj.broken = false;
    this.respawnAt = null;
    w.runner.released = null;
    w.runner.holdOn(obj, w.t, { phase0: 0 });
    this.tumble = null;
    // Give the chaser's room back after a respawn.
    const pr = this.pressure;
    if (pr.moving) pr.line = Math.min(pr.line, w.runner.bodyCenter().x - this.tuning.pressure.startLead * pr.speed);
  }

  setMirror(on) {
    if (this.mirrored === on) return;
    this.mirrored = on;
    this.game.canvas.style.transform = on ? 'scaleX(-1)' : '';
  }

  nextGrab() {
    const r = this.world.runner;
    const from = r.hold?.obj ?? r.released ?? r.lastHold;
    return this.world.grabs.find((g) => g.order === (from?.order ?? 0) + 1) ?? null;
  }

  render(simDt, dt) {
    const t = this.tuning;
    const w = this.world;
    const r = w.runner;

    const pr = this.pressure;
    let target = this.started ? r.x + this.lead() : this.platform.x + this.lead();
    if (pr.mode === PressureMode.SCROLL && pr.active) target = pr.line + this.viewRect().width / 2;
    this.cameraX += (target - this.cameraX) * smoothing(t.world.cameraLerp, dt);
    this.cameras.main.centerOn(this.cameraX, t.world.cameraY);
    const view = this.viewRect();
    this.course.extend(view.right + t.world.spawnAhead);
    const behind = view.x - t.world.cullBehind;
    w.removeWhere((o) => o.right < behind && o !== r.hold?.obj && o !== r.lastHold);
    this.setMirror(!this.menu && w.env(r.x).mirror);

    const next = this.nextGrab();
    const nextPoint = next ? next.catchPoints(w.t)[0] ?? { x: next.x, y: next.y } : null;
    const ctx = { g: this.objG, p: this.palette, t, time: w.t, hold: r.hold, runner: r, view, nextGrab: nextPoint };

    // World backdrop.
    const wv = this.worldView;
    wv.draw(view, { bars: [], hazards: [], stars: [], platform: this.platform }, simDt);

    this.objG.clear();
    for (const o of w.objects) o.draw(ctx);

    this.drawArc(view);
    this.drawPressure(ctx, dt);
    this.drawAcrobat(simDt);
    this.effects.updateTrail(simDt, r.bodyCenter(), r.state === RunState.FLY);

    this.overlayG.clear();
    const octx = { ...ctx, g: this.overlayG };
    for (const o of w.objects) o.drawOverlay?.(octx);

    this.zoneG.clear();
    if (this.settings.showZones) {
      const zctx = { ...ctx, g: this.zoneG };
      for (const o of w.objects) o.drawZones(zctx);
      const body = r.bodyCenter();
      this.zoneG.lineStyle(t.game.zoneLineWidth, this.palette.spotlight, t.game.zoneAlpha);
      this.zoneG.strokeCircle(body.x, body.y, t.game.bodyHitRadius);
    }
  }

  // The chaser ball, the burning fuse, the heartbeat, and the numbers the HUD shows.
  drawPressure(ctx, dt) {
    const t = this.tuning;
    const pt = t.pressure;
    const pr = this.pressure;
    const r = this.world.runner;
    const g = this.objG;
    const intensity = this.phase === Phase.PLAY ? pr.intensity(r) : 0;
    const lead = pr.lead(r);
    this.pressureHud = pr.moving && this.phase === Phase.PLAY ? { intensity, share: Math.max(0, Math.min(1, lead / pt.maxShownLead)) } : null;

    if (pr.moving && intensity > 0 && this.phase === Phase.PLAY) {
      this.heartClock -= dt;
      if (this.heartClock <= 0) {
        this.audio.heartbeat(intensity);
        this.heartClock = lerp(pt.heartSlow, pt.heartFast, intensity);
      }
    }

    if (pr.mode === PressureMode.CHASER && pr.active) {
      const { x: cx, y: cy, r: R } = pr.ball();
      const wob = this.wobble > 0 ? 1 + Math.sin(this.wobble * pt.wobbleRate) * pt.wobbleAmount * (this.wobble / pt.wobbleTime) : 1;
      const rx = R * wob, ry = R / wob;
      const roll = pr.distance / R;
      g.fillStyle(this.palette.outline, 1);
      g.fillEllipse(cx, cy, (rx + t.acrobat.outlineWidth * 2) * 2, (ry + t.acrobat.outlineWidth * 2) * 2);
      const n = pt.ballStripes;
      for (let i = 0; i < n; i++) {
        const a0 = roll + (i * Math.PI * 2) / n;
        const a1 = a0 + (Math.PI * 2) / n;
        g.fillStyle(i % 2 ? this.palette.stripeCream : this.palette.stripeRed, 1);
        g.beginPath();
        g.moveTo(cx, cy);
        for (let k = 0; k <= pt.ballArcSteps; k++) {
          const a = a0 + ((a1 - a0) * k) / pt.ballArcSteps;
          g.lineTo(cx + Math.cos(a) * rx, cy + Math.sin(a) * ry);
        }
        g.closePath();
        g.fillPath();
      }
      g.fillStyle(this.palette.gold, 1);
      g.fillCircle(cx, cy, R * pt.ballHub);
      g.fillStyle(this.palette.spotlight, t.game.zoneAlpha);
      g.fillCircle(cx - R * pt.ballShineX, cy - R * pt.ballShineY, R * pt.ballShineSize);
    }

    if (pr.mode === PressureMode.ROPE && pr.active && r.state === RunState.HOLD && r.hold.fuse) {
      const h = r.hold;
      const k = Math.min(1, (this.world.t - h.tGrab) / h.fuse);
      const flick = (1 + Math.sin(this.world.t * t.objects.fireHoop.flameFlicker)) / 2;
      if (h.obj.rope && h.obj.anchorAt) {
        const a = h.obj.anchorAt(this.world.t);
        const hw = h.obj.barWidth / 2;
        const burn = { x: lerp(r.x, a.x, k), y: lerp(r.y, a.y, k) };
        for (const side of [-1, 1]) {
          g.lineStyle(t.bars.ropeWidth, this.palette.outline, 1);
          g.lineBetween(r.x + side * hw, r.y, burn.x + side * hw, burn.y);
          g.fillStyle(this.palette.flame, 1);
          g.fillCircle(burn.x + side * hw, burn.y, pt.fuseFlame * (1 + flick) / 2);
        }
      } else {
        g.lineStyle(t.bars.ropeWidth, this.palette.flame, 1);
        g.beginPath();
        g.arc(r.x, r.y, t.catch.perfectRadius * 2, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * (1 - k), false);
        g.strokePath();
      }
      this.fuseClock = (this.fuseClock ?? 0) - dt;
      if (this.fuseClock <= 0) {
        this.fuseClock = pt.fuseSparkEvery;
        this.effects.particles.push({ x: r.x, y: r.y, vx: (Math.random() - 0.5) * t.juice.sparkSpeed, vy: -Math.random() * t.juice.sparkSpeed, life: t.juice.sparkLife, max: t.juice.sparkLife, size: t.juice.burstSize / 3, star: false, color: this.palette.flame, rot: 0 });
      }
    }
  }

  // The aim preview: the exact path a tap would fly from here, including fixed exceptions.
  drawArc() {
    const g = this.arcG;
    g.clear();
    const t = this.tuning;
    const c = this.cfg;
    const w = this.world;
    const r = w.runner;
    if (this.menu || r.state !== RunState.HOLD) return;
    const obj = r.hold.obj;
    const v = obj.tapVelocity(w.t, r.hold, r);
    if (v === false) return;
    const path = w.predict(r.x, r.y, v ?? arcVelocity(t), c.arcPreviewTime, c.arcDotStep);
    const special = obj.showsPreview || path.some((p) => {
      const e = w.env(p.x);
      return e.ax !== 0 || e.gravityScale !== 1;
    }) || w.impulses.some((o) => o.x > r.x && o.x < path[path.length - 1].x);
    const learning = obj.order < c.arcGuideBars && this.runConfig.mode === CourseMode.PLAY;
    if (!special && !learning && !this.settings.alwaysArc) return;
    g.fillStyle(special ? this.palette.teal : this.palette.spotlight, special ? c.arcAlphaSpecial : c.arcAlpha);
    for (let i = 1; i < path.length; i++) g.fillCircle(path[i].x, path[i].y, c.arcDotRadius);
  }

  drawAcrobat(simDt) {
    const t = this.tuning;
    const a = t.acrobat;
    const r = this.world.runner;
    const v = this.acrobatView;
    v.g.clear();
    if (r.state === RunState.HOLD && r.hold.obj.hidesRunner) return;
    v.time += simDt;
    if (!this.started) {
      v.setPose({ spin: 0, tuck: 0, pike: 0, knee: 0, flail: 0 });
      v.drawAt(r.x, r.y + a.bodyCenterOffset);
      return;
    }
    let tuck = 0, flail = 0, spin = 0, pike = 0, knee = 0;
    if (r.state === RunState.HOLD) {
      spin = r.angle;
      const s = Math.max(-1, Math.min(1, r.angVel / a.angVelRef));
      pike = Math.max(0, s);
      knee = Math.max(0, -s);
    } else if (r.state === RunState.FLY) {
      let nearest = Infinity;
      for (const g of this.world.grabs) {
        if (!r.catchable(g)) continue;
        for (const p of g.catchPoints(this.world.t)) nearest = Math.min(nearest, Math.hypot(p.x - r.x, p.y - r.y));
      }
      tuck = nearest < a.openDistance ? 0 : 1;
    } else if (r.state === RunState.FALL) {
      flail = 1;
      if (this.tumble !== null) {
        this.tumble += t.pressure.tumbleRate * simDt;
        spin = this.tumble;
      }
    } else {
      spin = a.landedAngle;
    }
    this.tuck = lerp(this.tuck, tuck, smoothing(a.tuckIn, simDt || 0));
    v.setPose({ spin, tuck: this.tuck, pike, knee, flail });
    const body = r.bodyCenter();
    v.drawAt(body.x, body.y);
  }
}
