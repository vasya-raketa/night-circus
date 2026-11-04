import ArcadeScene from '../../scenes/ArcadeScene.js';
import Trapeze from '../../systems/Trapeze.js';
import WorldRenderer from '../../render/WorldRenderer.js';
import AcrobatRenderer from '../../render/AcrobatRenderer.js';
import { lerp, smoothing } from '../../render/palette.js';

const Drop = Object.freeze({ HANG: 'hang', FALL: 'fall', WAIT: 'wait', TOPPLE: 'topple', DONE: 'done' });

// Demo B: acrobats swing in on a trapeze above a growing tower; tap to drop one straight down.
// Overhang makes the tower sway, too much topples it; a centred drop steadies it.
export default class PyramidScene extends ArcadeScene {
  constructor() {
    super('Pyramid', 'pyramid');
    this.hudTitle = 'HUMAN PYRAMID';
    this.hudHint = 'TAP to drop the acrobat\nstack them straight!';
  }

  setup() {
    const t = this.tuning;
    this.worldView = new WorldRenderer(this, t, this.palette);
    this.towerView = new AcrobatRenderer(this, t, this.palette);
    this.flyerView = new AcrobatRenderer(this, t, this.palette);
    this.worldView.g.setDepth(0);
    this.towerView.g.setDepth(2);
    this.flyerView.g.setDepth(2);
  }

  // Standing figure: feet to hands.
  get figureHeight() {
    const a = this.tuning.acrobat;
    return a.armLength + a.torsoLength + a.thighLength + a.shinLength;
  }

  // Body centre below the hands.
  get centerFromHands() {
    return this.tuning.acrobat.bodyCenterOffset;
  }

  resetWorld() {
    const c = this.cfg;
    this.baseY = -c.pedestalHeight;
    this.tower = [{ x: 0 }];
    this.swayX = 0;
    this.swayV = 0;
    this.toppleAngle = 0;
    this.toppleVel = 0;
    this.bar = new Trapeze({ index: 0, x: 0, y: 0, motion: { idleAmplitude: c.swingAmplitude } });
    this.bar.anchorY = this.bar.baseY = this.targetAnchorY();
    this.flyer = null;
    this.spawnFlyer();
    this.cameraY = this.targetCameraY();
    this.cameras.main.centerOn(0, this.cameraY);
  }

  // Hands of member i (its feet stand on the hands of member i-1).
  handsY(i) {
    return this.baseY - (i + 1) * this.figureHeight;
  }

  topHandsY() {
    return this.handsY(this.tower.length - 1);
  }

  // Displayed x of member i: the sway grows with height, the base stays planted.
  memberX(i) {
    const frac = this.tower.length > 1 ? i / (this.tower.length - 1) : 0;
    return this.tower[i].x + this.swayX * frac;
  }

  // Lowest point of the hanging acrobat's feet stays `clearance` above the tower top.
  targetAnchorY() {
    return this.topHandsY() - this.cfg.clearance - this.figureHeight - this.tuning.swing.ropeLength;
  }

  targetCameraY() {
    return this.topHandsY() + this.cfg.cameraTopOffset;
  }

  spawnFlyer() {
    const c = this.cfg;
    const bar = this.bar;
    bar.swingMul = Math.min(c.speedMax, 1 + c.speedGrowth * (this.tower.length - 1));
    bar.angle = -c.swingAmplitude * c.swingInSide;
    bar.angVel = 0;
    this.flyer = { state: Drop.HANG, x: 0, y: 0, vy: 0, spin: 0 };
    this.flyerView.reset();
  }

  onPress() {
    const f = this.flyer;
    if (!f || f.state !== Drop.HANG) return;
    const grip = this.bar.gripPoint(this.tuning);
    f.state = Drop.FALL;
    f.x = grip.x;
    f.y = grip.y + this.centerFromHands;
    f.vy = 0;
    f.spin = this.bar.angle;
    this.audio.whoosh();
  }

  step(h) {
    const t = this.tuning;
    const c = this.cfg;
    this.bar.update(h, t);
    const anchorTarget = this.targetAnchorY();
    this.bar.anchorY = this.bar.baseY = lerp(this.bar.anchorY, anchorTarget, smoothing(c.riseRate, h));

    if (this.flyer.state === Drop.TOPPLE || this.flyer.state === Drop.DONE) {
      this.toppleVel += Math.sign(this.toppleAngle || 1) * c.toppleAccel * h;
      this.toppleAngle += this.toppleVel * h;
      if (this.flyer.state === Drop.TOPPLE && Math.abs(this.toppleAngle) > c.toppleMaxAngle) {
        this.flyer.state = Drop.DONE;
        this.toppleVel = 0;
        this.gameOver();
      }
      if (this.flyer.state === Drop.DONE) this.toppleAngle = Math.sign(this.toppleAngle) * c.toppleMaxAngle;
      return;
    }

    // Tower sway: damped spring on the top displacement.
    this.swayV += (-c.swayStiffness * this.swayX - c.swayDamping * this.swayV) * h;
    this.swayX += this.swayV * h;
    if (Math.abs(this.swayX) > c.maxSwayPx) this.topple(Math.sign(this.swayX));

    const f = this.flyer;
    if (f.state === Drop.FALL) {
      f.vy += t.physics.gravity * h;
      f.y += f.vy * h;
      f.spin = lerp(f.spin, 0, smoothing(t.acrobat.uprightLerp, h));
      const feetY = f.y - this.centerFromHands + this.figureHeight;
      if (feetY >= this.topHandsY()) this.land(f);
    } else if (f.state === Drop.WAIT) {
      f.wait -= h;
      if (f.wait <= 0) this.spawnFlyer();
    }
  }

  land(f) {
    const t = this.tuning;
    const c = this.cfg;
    const top = this.tower.length - 1;
    const overhang = f.x - this.memberX(top);
    const handsY = this.topHandsY();
    this.tower.push({ x: f.x - this.swayX });
    f.state = Drop.WAIT;
    f.wait = c.respawnDelay;

    if (Math.abs(overhang) >= c.toppleOverhang) {
      this.effects.popup(f.x, handsY - t.juice.popupRise, 'WHOA!', t.colors.hazard);
      this.topple(Math.sign(overhang));
      return;
    }
    const perfect = Math.abs(overhang) <= c.perfectPx;
    this.score.combo(perfect);
    const gained = this.score.add(t.score.catch);
    this.audio.click();
    this.effects.sparks(f.x, handsY, this.palette.gold);
    if (perfect) {
      this.swayX *= c.steadyFactor;
      this.swayV *= c.steadyFactor;
      this.perfectHit(f.x, handsY, `PERFECT x${this.score.multiplier}`);
    } else {
      this.swayV += overhang * c.swayPerPx;
      this.effects.popup(f.x, handsY - t.juice.popupRise, `+${gained}`, t.colors.gold);
    }
  }

  topple(dir) {
    if (this.flyer.state === Drop.TOPPLE || this.flyer.state === Drop.DONE) return;
    this.flyer.state = Drop.TOPPLE;
    this.toppleAngle = dir * this.cfg.toppleStart;
    this.toppleVel = 0;
    this.audio.boing();
  }

  render(simDt, dt) {
    const t = this.tuning;
    const c = this.cfg;
    const toppling = this.flyer.state === Drop.TOPPLE || this.flyer.state === Drop.DONE;
    this.cameraY += (this.targetCameraY() - this.cameraY) * smoothing(t.world.cameraLerp, dt);
    this.cameras.main.centerOn(0, this.cameraY);

    // Floor, pedestal, trapeze.
    const view = this.viewRect();
    const wv = this.worldView;
    wv.g.clear();
    wv.drawPlatform({ x: 0, y: this.baseY });
    wv.g.fillStyle(this.palette.floor, 1);
    wv.g.fillRect(view.x, 0, view.width, Math.max(0, view.bottom));
    wv.g.lineStyle(t.bars.ropeWidth, this.palette.net, 1);
    wv.g.lineBetween(view.x, 0, view.right, 0);
    wv.drawBar(this.bar);

    // Tower (rotates around the base when toppling).
    const tv = this.towerView;
    tv.g.clear();
    tv.time += simDt;
    const pivotY = this.baseY;
    const cos = Math.cos(this.toppleAngle), sin = Math.sin(this.toppleAngle);
    for (let i = 0; i < this.tower.length; i++) {
      const lx = this.memberX(i);
      const ly = this.handsY(i) + this.centerFromHands - pivotY;
      tv.setPose({ spin: -this.toppleAngle, tuck: 0, pike: 0, knee: 0, flail: toppling ? 1 : 0 });
      tv.drawAt(lx * cos - ly * sin, pivotY + lx * sin + ly * cos, false);
    }

    // The acrobat on the trapeze, or falling.
    const f = this.flyer;
    const fv = this.flyerView;
    fv.time += simDt;
    fv.g.clear();
    if (f.state === Drop.HANG) {
      const grip = this.bar.gripPoint(t);
      fv.setPose({ spin: this.bar.angle, tuck: 0, pike: Math.max(0, this.bar.angVel / t.acrobat.angVelRef), knee: Math.max(0, -this.bar.angVel / t.acrobat.angVelRef), flail: 0 });
      fv.drawAt(grip.x + Math.sin(this.bar.angle) * this.centerFromHands, grip.y + Math.cos(this.bar.angle) * this.centerFromHands, true);
    } else if (f.state === Drop.FALL) {
      fv.setPose({ spin: f.spin, pike: 0, knee: c.fallKnee, flail: 0 });
      fv.drawAt(f.x, f.y, true);
    }
  }
}
