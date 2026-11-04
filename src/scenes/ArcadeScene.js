import Phaser from 'phaser';
import ScoreSystem from '../systems/ScoreSystem.js';
import AudioFX from '../systems/AudioFX.js';
import Effects from '../render/Effects.js';
import { createPalette } from '../render/palette.js';
import { loadData, saveData } from '../platform.js';
import { Phase } from './Phase.js';

// Shared shell for the quick demos: one input (press / release with tap, click or space),
// fixed-step simulation, score + best, instant retry, shake / freeze / particles / sounds.
// Subclasses implement setup(), resetWorld(), step(h), render(dt) and the input hooks.
export default class ArcadeScene extends Phaser.Scene {
  constructor(key, configKey) {
    super({ key, active: true });
    this.configKey = configKey;
  }

  create() {
    const t = (this.tuning = this.registry.get('tuning'));
    this.cfg = t[this.configKey];
    this.palette = createPalette(t.colors);
    this.audio = new AudioFX(t.audio);
    this.score = new ScoreSystem(t);
    this.effects = new Effects(this, t, this.palette);
    this.effects.trailG.setDepth(1);
    this.effects.g.setDepth(3);
    this.best = 0;
    this.holding = false;
    loadData(this.cfg.saveKey, 0).then((v) => (this.best = Math.max(this.best, v)));

    this.input.on('pointerdown', () => this.press());
    this.input.on('pointerup', () => this.letGo());
    this.input.on('pointerupoutside', () => this.letGo());
    this.input.keyboard.addCapture('SPACE');
    this.input.keyboard.on('keydown-SPACE', (e) => !e.repeat && this.press());
    this.input.keyboard.on('keyup-SPACE', () => this.letGo());

    this.scale.on('resize', this.layout, this);
    this.events.once('shutdown', () => this.scale.off('resize', this.layout, this));
    this.setup();
    this.layout();
    this.resetRun();
  }

  layout() {
    this.cameras.main.setZoom(Math.min(this.scale.height / this.cfg.viewHeight, this.scale.width / this.cfg.minViewWidth));
  }

  resetRun() {
    this.score.reset();
    this.effects.reset();
    this.phase = Phase.READY;
    this.freeze = 0;
    this.slowmo = 0;
    this.accumulator = 0;
    this.overTime = 0;
    this.newBest = false;
    this.resetWorld();
  }

  press() {
    this.audio.unlock();
    this.holding = true;
    if (this.phase === Phase.OVER) {
      if (this.overTime >= this.tuning.world.restartDelay) this.resetRun();
      return;
    }
    if (this.phase === Phase.READY) this.phase = Phase.PLAY;
    this.onPress();
  }

  letGo() {
    if (!this.holding) return;
    this.holding = false;
    if (this.phase === Phase.PLAY) this.onLetGo();
  }

  onPress() {}

  onLetGo() {}

  update(_time, delta) {
    const t = this.tuning;
    const dt = Math.min(delta / 1000, t.world.maxFrameDt);
    let simDt = 0;
    if (this.freeze > 0) {
      this.freeze -= dt;
    } else {
      simDt = dt * (this.timeScale ?? 1);
      if (this.slowmo > 0) {
        this.slowmo -= dt;
        simDt *= t.juice.slowmoScale;
      }
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

    this.effects.update(simDt);
    this.render(simDt, dt);
    this.effects.draw();
  }

  // Visible world rectangle for the current camera.
  viewRect() {
    const cam = this.cameras.main;
    const w = cam.width / cam.zoom;
    const h = cam.height / cam.zoom;
    return new Phaser.Geom.Rectangle(cam.midPoint.x - w / 2, cam.midPoint.y - h / 2, w, h);
  }

  // Juice helpers.
  perfectHit(x, y, label) {
    const t = this.tuning;
    this.freeze = t.juice.freeze;
    this.effects.starBurst(x, y);
    this.audio.chime(this.score.level);
    this.effects.popup(x, y - t.juice.popupRise, label, t.colors.teal);
  }

  gameOver() {
    const t = this.tuning;
    this.cameras.main.shake(t.juice.shakeMs, t.juice.shakeIntensity);
    this.audio.thud();
    this.phase = Phase.OVER;
    this.overTime = 0;
    if (this.score.score > this.best) {
      this.best = this.score.score;
      this.newBest = true;
      saveData(this.cfg.saveKey, this.best);
    }
  }
}
