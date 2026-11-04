import ArcadeScene from '../../scenes/ArcadeScene.js';
import { Phase } from './DemoScene.js';
import AcrobatController, { AcrobatState, predictFlight } from '../../systems/AcrobatController.js';
import Trapeze, { BarKind } from '../../systems/Trapeze.js';
import { createRng } from '../../systems/LevelGenerator.js';
import WorldRenderer from '../../render/WorldRenderer.js';
import AcrobatRenderer from '../../render/AcrobatRenderer.js';
import { lerp, smoothing } from '../../render/palette.js';

// Demo A: every release flies the same fixed arc. The skill is timing the release
// so the next (swinging / sliding / bobbing) bar is where the arc lands.
export default class FixedJumpScene extends ArcadeScene {
  constructor() {
    super('FixedJump', 'fixedJump');
    this.hudTitle = 'FIXED JUMP';
    this.hudHint = 'TAP to grab the bar\nTAP to let go: same jump every time';
  }

  setup() {
    const t = this.tuning;
    this.worldView = new WorldRenderer(this, t, this.palette);
    this.acrobatView = new AcrobatRenderer(this, t, this.palette);
    this.guide = this.add.graphics();
    this.worldView.g.setDepth(0);
    this.guide.setDepth(1);
    this.acrobatView.g.setDepth(2);
    this.ctrl = new AcrobatController(t);
  }

  resetWorld() {
    const seed = this.registry.get('seed');
    this.rng = createRng(seed ?? (Math.random() * 2 ** 32) >>> 0);
    this.bars = [];
    this.nextIndex = 0;
    this.spawn(this.cfg.firstBarOffset);
    this.ctrl.reset(this.bars[0]);
    this.acrobatView.reset();
    this.platform = this.platformSpot();
    this.cameraX = this.platform.x + this.lead();
    this.cameras.main.centerOn(this.cameraX, this.tuning.world.cameraY);
  }

  platformSpot() {
    const a = this.tuning.acrobat;
    const grip = this.bars[0].gripPoint(this.tuning);
    return { x: grip.x, y: grip.y + a.armLength + a.torsoLength + a.thighLength + a.shinLength };
  }

  lead() {
    return Math.min(this.cfg.cameraLead, this.viewRect().width * (0.5 - this.tuning.world.cameraMinEdge));
  }

  // The one fixed launch: apex `jumpHeight` above the release point, lands `jumpDistance` ahead.
  fixedVelocity() {
    const g = this.tuning.physics.gravity;
    const { jumpDistance, jumpHeight } = this.cfg;
    const vy = Math.sqrt(2 * g * jumpHeight);
    return { vx: jumpDistance / ((2 * vy) / g), vy: -vy };
  }

  newBar(x) {
    const c = this.cfg;
    const i = this.nextIndex++;
    const rng = this.rng;
    const k = Math.min(1, Math.max(0, (i - c.easyBars) / c.rampBars)) * c.motionScale;
    const kind = i === 0 ? 'still' : rng.weighted(c.motionWeights);
    const motion = { idleAmplitude: this.tuning.bars.idleAmplitude };
    if (kind === 'swing') motion.idleAmplitude = lerp(c.swingAmpStart, c.swingAmpMax, k);
    if (kind === 'slide') Object.assign(motion, { slideRange: lerp(c.slideRangeStart, c.slideRangeMax, k), slideSpeed: lerp(c.slideSpeedStart, c.slideSpeedMax, k) });
    if (kind === 'bob') Object.assign(motion, { bobRange: lerp(c.bobRangeStart, c.bobRangeMax, k), bobSpeed: lerp(c.bobSpeedStart, c.bobSpeedMax, k) });
    const y = this.tuning.world.ceilingY + (i === 0 ? 0 : rng.range(-c.heightJitter, c.heightJitter));
    const bar = new Trapeze({ index: i, x, y, kind: kind === 'slide' ? BarKind.RAIL : BarKind.NORMAL, phase: rng.range(0, Math.PI * 2), motion });
    bar.startIdle(this.tuning);
    return bar;
  }

  spawn(firstX) {
    const c = this.cfg;
    let last = this.bars[this.bars.length - 1];
    const view = this.viewRect();
    while (!last || last.baseX < view.right + this.tuning.world.spawnAhead) {
      const x = last ? last.baseX + c.jumpDistance + this.rng.range(-c.gapJitter, c.gapJitter) : firstX;
      last = this.newBar(x);
      this.bars.push(last);
    }
    const behind = view.x - this.tuning.world.cullBehind;
    this.bars = this.bars.filter((b) => b.occupied || b.baseX + c.slideRangeMax >= behind);
  }

  onPress() {
    if (this.ctrl.state === AcrobatState.READY) this.ctrl.start();
    else if (this.ctrl.release(this.fixedVelocity())) this.audio.whoosh();
  }

  step(h) {
    for (const bar of this.bars) bar.update(h, this.tuning);
    for (const e of this.ctrl.update(h, this.bars)) {
      if (e.type === 'catch') this.onCatch(e);
      else if (e.type === 'net') this.onNet(e);
    }
  }

  onCatch({ bar, perfect }) {
    const t = this.tuning;
    const p = bar.gripPoint(t);
    this.score.combo(perfect);
    const gained = this.score.add(t.score.catch);
    this.audio.click();
    if (perfect) this.perfectHit(p.x, p.y, `PERFECT x${this.score.multiplier}`);
    else this.effects.popup(p.x, p.y - t.juice.popupRise, `+${gained}`, t.colors.gold);
  }

  onNet(e) {
    this.worldView.dipNet(e.x, Math.min(1, e.speed / this.tuning.juice.netDipSpeed));
    this.gameOver();
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

  render(simDt, dt) {
    const t = this.tuning;
    if (this.phase === Phase.READY) this.platform = this.platformSpot();
    this.acrobatView.update(simDt, this.ctrl, this.nearestBarDistance());
    this.effects.updateTrail(simDt, this.ctrl.bodyCenter(), this.ctrl.state === AcrobatState.FLY);

    const target = this.phase === Phase.READY ? this.platform.x + this.lead() : this.ctrl.x + this.lead();
    this.cameraX += (target - this.cameraX) * smoothing(t.world.cameraLerp, dt);
    this.cameras.main.centerOn(this.cameraX, t.world.cameraY);
    this.spawn();

    this.worldView.draw(this.viewRect(), { bars: this.bars, hazards: [], stars: [], platform: this.platform }, simDt);
    this.drawGuide();
    this.acrobatView.draw(this.ctrl);
  }

  // Faint dotted fixed arc from the hands, shown while learning (first bars only).
  drawGuide() {
    const c = this.cfg;
    const g = this.guide;
    g.clear();
    const ctrl = this.ctrl;
    if (ctrl.state !== AcrobatState.SWING && ctrl.state !== AcrobatState.READY) return;
    if (ctrl.bar.index >= c.arcGuideBars) return;
    const v = this.fixedVelocity();
    const flightTime = (2 * -v.vy) / this.tuning.physics.gravity;
    const path = predictFlight(this.tuning, ctrl.x, ctrl.y, v, c.arcDotStep, flightTime * c.arcOvershoot);
    g.fillStyle(this.palette.spotlight, c.arcAlpha);
    for (let i = 1; i < path.length; i++) g.fillCircle(path[i].x, path[i].y, c.arcDotRadius);
    g.lineStyle(c.arcDotRadius, this.palette.teal, c.arcAlpha);
    g.strokeCircle(ctrl.x + c.jumpDistance, ctrl.y, this.tuning.catch.perfectRadius);
  }
}
