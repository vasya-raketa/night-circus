import Phaser from 'phaser';
import AcrobatController, { AcrobatState } from '../../systems/AcrobatController.js';
import LevelGenerator, { createRng } from '../../systems/LevelGenerator.js';
import ScoreSystem from '../../systems/ScoreSystem.js';
import AudioFX from '../../systems/AudioFX.js';
import WorldRenderer from '../../render/WorldRenderer.js';
import AcrobatRenderer from '../../render/AcrobatRenderer.js';
import Effects from '../../render/Effects.js';
import DebugOverlay from '../../render/DebugOverlay.js';
import { createPalette, smoothing } from '../../render/palette.js';
import { loadData, saveData } from '../../platform.js';

export const Phase = Object.freeze({ READY: 'ready', PLAY: 'play', OVER: 'over' });

// The playable "Swing & Let Go" demo: world simulation, scoring and juice.
// Background and HUD live in their own scenes and read state from here.
export default class DemoScene extends Phaser.Scene {
  constructor() {
    super({ key: 'Demo', active: true });
  }

  create() {
    const t = (this.tuning = this.registry.get('tuning'));
    this.palette = createPalette(t.colors);
    this.worldView = new WorldRenderer(this, t, this.palette);
    this.effects = new Effects(this, t, this.palette);
    this.acrobatView = new AcrobatRenderer(this, t, this.palette);
    this.worldView.g.setDepth(0);
    this.effects.trailG.setDepth(1);
    this.acrobatView.g.setDepth(2);
    this.effects.g.setDepth(3);
    if (this.registry.get('debug')) {
      this.debugOverlay = new DebugOverlay(this, t, this.palette);
      this.debugOverlay.g.setDepth(4);
    }

    this.ctrl = new AcrobatController(t);
    this.score = new ScoreSystem(t);
    this.audio = new AudioFX(t.audio);
    this.best = 0;
    loadData(t.score.saveKey, 0).then((v) => (this.best = Math.max(this.best, v)));

    this.input.on('pointerdown', () => this.onTap());
    this.input.keyboard.addCapture('SPACE');
    this.input.keyboard.on('keydown-SPACE', (e) => !e.repeat && this.onTap());

    this.scale.on('resize', this.layout, this);
    this.events.once('shutdown', () => this.scale.off('resize', this.layout, this));
    this.layout();
    this.resetRun();
  }

  layout() {
    const w = this.tuning.world;
    const cam = this.cameras.main;
    cam.setZoom(Math.min(this.scale.height / w.viewHeight, this.scale.width / w.minViewWidth));
  }

  resetRun() {
    const t = this.tuning;
    const seed = this.registry.get('seed');
    this.generator = new LevelGenerator(t, createRng(seed ?? (Math.random() * 2 ** 32) >>> 0));
    this.bars = [];
    this.hazards = [];
    this.stars = [];
    this.spawn();
    this.ctrl.reset(this.bars[0]);
    this.score.reset();
    this.effects.reset();
    this.acrobatView.reset();
    this.phase = Phase.READY;
    this.freeze = 0;
    this.slowmo = 0;
    this.accumulator = 0;
    this.overTime = 0;
    this.newBest = false;
    this.platform = this.platformSpot();
    this.cameraX = this.cameraTargetX();
    this.cameras.main.centerOn(this.cameraX, t.world.cameraY);
  }

  // The start platform sits under the feet of the acrobat holding the first bar pulled back.
  platformSpot() {
    const a = this.tuning.acrobat;
    const grip = this.bars[0].gripPoint(this.tuning);
    return { x: grip.x, y: grip.y + a.armLength + a.torsoLength + a.thighLength + a.shinLength };
  }

  spawn() {
    const t = this.tuning;
    const view = this.viewRect();
    let last = this.bars[this.bars.length - 1];
    while (!last || last.baseX < view.right + t.world.spawnAhead) {
      const { bar, hazards, stars } = this.generator.next(t.generator.firstBarOffset);
      this.bars.push(bar);
      this.hazards.push(...hazards);
      this.stars.push(...stars);
      last = bar;
    }
    const behind = view.x - t.world.cullBehind;
    this.bars = this.bars.filter((b) => b.occupied || b.baseX + t.obstacles.rail.range >= behind);
    this.hazards = this.hazards.filter((h) => !h.isBehind(behind));
    this.stars = this.stars.filter((s) => !s.isBehind(behind));
  }

  viewRect() {
    const cam = this.cameras.main;
    const w = cam.width / cam.zoom;
    const h = cam.height / cam.zoom;
    const cx = this.cameraX ?? 0;
    const cy = this.tuning.world.cameraY;
    return new Phaser.Geom.Rectangle(cx - w / 2, cy - h / 2, w, h);
  }

  // Keeps the acrobat ahead of the left edge; the lead shrinks in narrow (portrait) views.
  cameraTargetX() {
    const w = this.tuning.world;
    const maxLead = this.viewRect().width * (0.5 - w.cameraMinEdge);
    if (this.phase === Phase.READY) return this.platformSpot().x + maxLead;
    const lead = this.ctrl.state === AcrobatState.SWING ? w.cameraLeadSwing : w.cameraLeadFly;
    return this.ctrl.x + Math.min(lead, maxLead);
  }

  onTap() {
    this.audio.unlock();
    if (this.phase === Phase.READY) {
      this.ctrl.start();
      this.phase = Phase.PLAY;
    } else if (this.phase === Phase.PLAY) {
      if (this.ctrl.release()) this.audio.whoosh();
    } else if (this.overTime >= this.tuning.world.restartDelay) {
      this.resetRun();
    }
  }

  update(_time, delta) {
    const t = this.tuning;
    const dt = Math.min(delta / 1000, t.world.maxFrameDt);
    let simDt = 0;
    if (this.freeze > 0) {
      this.freeze -= dt;
    } else {
      let scale = 1;
      if (this.slowmo > 0) {
        this.slowmo -= dt;
        scale = t.juice.slowmoScale;
      }
      simDt = dt * scale;
    }
    if (this.phase === Phase.OVER) this.overTime += dt;

    this.accumulator += simDt;
    const step = t.physics.fixedStep;
    let n = 0;
    while (this.accumulator >= step && n < t.physics.maxSubsteps) {
      this.step(step);
      this.accumulator -= step;
      n++;
    }
    if (n === t.physics.maxSubsteps) this.accumulator = 0;

    if (this.phase === Phase.READY) this.platform = this.platformSpot();
    this.acrobatView.update(simDt, this.ctrl, this.nearestBarDistance());
    this.effects.update(simDt);
    this.effects.updateTrail(simDt, this.ctrl.bodyCenter(), this.ctrl.state === AcrobatState.FLY);

    this.cameraX += (this.cameraTargetX() - this.cameraX) * smoothing(t.world.cameraLerp, dt);
    this.cameras.main.centerOn(this.cameraX, t.world.cameraY);
    this.spawn();

    this.worldView.draw(this.viewRect(), this, simDt);
    this.acrobatView.draw(this.ctrl);
    this.effects.draw();
    this.debugOverlay?.draw(this.ctrl);
  }

  step(h) {
    const t = this.tuning;
    for (const bar of this.bars) {
      if (bar.update(h, t) === 'snap') this.onSnap(bar);
    }
    for (const hz of this.hazards) hz.update(h, t);
    for (const s of this.stars) s.update(h);

    for (const e of this.ctrl.update(h, this.bars)) {
      if (e.type === 'catch') this.onCatch(e);
      else if (e.type === 'net') this.onNet(e);
    }

    if (this.ctrl.state !== AcrobatState.FLY) return;
    const body = this.ctrl.bodyCenter();
    const r = t.acrobat.bodyRadius;
    for (const hz of this.hazards) {
      for (const ev of hz.check(body, r, t)) {
        if (ev === 'hit') this.onHazardHit(body);
        else if (ev === 'near') this.onNearMiss(body);
        else if (ev === 'through') this.onHoop(hz);
      }
      if (this.ctrl.state !== AcrobatState.FLY) return;
    }
    for (const s of this.stars) {
      if (s.check(body, r, t).length) this.onStar(s);
    }
  }

  nearestBarDistance() {
    if (this.ctrl.state !== AcrobatState.FLY) return Infinity;
    let best = Infinity;
    for (const bar of this.bars) {
      if (!this.ctrl.catchable(bar)) continue;
      const p = bar.gripPoint(this.tuning);
      best = Math.min(best, Math.hypot(p.x - this.ctrl.x, p.y - this.ctrl.y));
    }
    return best;
  }

  onCatch({ bar, perfect }) {
    const t = this.tuning;
    const gained = this.score.catchBar(perfect);
    const p = bar.gripPoint(t);
    this.audio.click();
    if (perfect) {
      this.freeze = t.juice.freeze;
      this.effects.starBurst(p.x, p.y);
      this.audio.chime(this.score.level);
      this.effects.popup(p.x, p.y - t.juice.popupRise, `PERFECT x${this.score.multiplier}`, t.colors.teal);
    } else {
      this.effects.popup(p.x, p.y - t.juice.popupRise, `+${gained}`, t.colors.gold);
    }
  }

  onSnap(bar) {
    const t = this.tuning;
    const p = bar.debris;
    this.ctrl.drop();
    this.effects.sparks(p.x, p.y, this.palette.rope);
    this.effects.popup(p.x, p.y - t.juice.popupRise, 'SNAP!', t.colors.hazard);
    this.audio.click();
  }

  onHazardHit(body) {
    const t = this.tuning;
    this.ctrl.drop();
    this.effects.sparks(body.x, body.y, this.palette.hazard);
    this.effects.popup(body.x, body.y - t.juice.popupRise, 'OUCH!', t.colors.hazard);
    this.cameras.main.shake(t.juice.hitShakeMs, t.juice.hitShakeIntensity);
  }

  onNearMiss(body) {
    const t = this.tuning;
    const gained = this.score.add(t.score.nearMiss);
    this.slowmo = t.juice.slowmoTime;
    this.effects.popup(body.x, body.y - t.juice.popupRise, `NEAR MISS +${gained}`, t.colors.spotlight);
  }

  onHoop(hoop) {
    const t = this.tuning;
    const gained = this.score.add(t.score.hoop);
    this.effects.sparks(hoop.x, hoop.y, this.palette.flame);
    this.effects.popup(hoop.x, hoop.y - t.obstacles.hoop.radius, `HOOP +${gained}`, t.colors.flame);
    this.audio.sparkle();
  }

  onStar(star) {
    const t = this.tuning;
    const gained = this.score.add(t.score.star);
    this.effects.sparks(star.x, star.y, this.palette.star);
    this.effects.popup(star.x, star.y - t.juice.popupRise, `+${gained}`, t.colors.star);
    this.audio.sparkle();
  }

  onNet(e) {
    const t = this.tuning;
    this.cameras.main.shake(t.juice.shakeMs, t.juice.shakeIntensity);
    this.worldView.dipNet(e.x, Math.min(1, e.speed / t.juice.netDipSpeed));
    this.audio.thud();
    this.phase = Phase.OVER;
    this.overTime = 0;
    if (this.score.score > this.best) {
      this.best = this.score.score;
      this.newBest = true;
      saveData(t.score.saveKey, this.best);
    }
  }
}
