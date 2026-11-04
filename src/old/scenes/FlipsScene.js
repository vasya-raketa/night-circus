import ArcadeScene from '../../scenes/ArcadeScene.js';
import { Phase } from './DemoScene.js';
import AcrobatRenderer from '../../render/AcrobatRenderer.js';
import { lerp, smoothing } from '../../render/palette.js';

const TAU = Math.PI * 2;
const Jump = Object.freeze({ STAND: 'stand', AIR: 'air', CRASH: 'crash', DOWN: 'down' });

// Signed distance from upright, in degrees (-180..180).
const uprightError = (rot) => (((((rot % TAU) + TAU + Math.PI) % TAU) - Math.PI) * 180) / Math.PI;

// Demo C: automatic bounces to a fixed height. Hold to spin, let go to stop.
// Land within the tolerance to score flips; anything else is a crash.
export default class FlipsScene extends ArcadeScene {
  constructor() {
    super('Flips', 'flips');
    this.hudTitle = 'TRAMPOLINE FLIPS';
    this.hudHint = 'HOLD to spin, LET GO to stop\nland upright!';
  }

  setup() {
    this.g = this.add.graphics().setDepth(0);
    this.view = new AcrobatRenderer(this, this.tuning, this.palette);
    this.view.g.setDepth(2);
  }

  // Body centre above the bed when standing.
  get standOffset() {
    const a = this.tuning.acrobat;
    return a.armLength + a.torsoLength + a.thighLength + a.shinLength - a.bodyCenterOffset;
  }

  resetWorld() {
    this.state = Jump.STAND;
    this.x = 0;
    this.y = -this.standOffset;
    this.vx = 0;
    this.vy = 0;
    this.rot = 0;
    this.spinVel = 0;
    this.flipsShown = 0;
    this.bedDip = 0;
    this.view.reset();
    this.cameras.main.centerOn(0, this.cfg.cameraY);
  }

  bounceSpeed() {
    return Math.sqrt(2 * this.tuning.physics.gravity * this.cfg.bounceHeight);
  }

  onPress() {
    if (this.state === Jump.STAND) {
      this.state = Jump.AIR;
      this.vy = -this.bounceSpeed();
      this.audio.click();
    }
  }

  step(h) {
    const t = this.tuning;
    const c = this.cfg;
    this.bedDip = lerp(this.bedDip, 0, smoothing(c.bedRecover, h));
    if (this.state === Jump.STAND || this.state === Jump.DOWN) return;

    this.vy += t.physics.gravity * h;
    this.x += this.vx * h;
    this.y += this.vy * h;

    if (this.state === Jump.AIR) {
      if (this.holding) this.rot += c.spinRate * h;
      const flips = Math.floor(Math.abs(this.rot) / TAU);
      if (flips > this.flipsShown) {
        this.flipsShown = flips;
        this.audio.sparkle();
        this.effects.popup(this.x, this.y - c.flipPopupOffset, `${flips}!`, t.colors.spotlight);
      }
      if (this.vy > 0 && this.y >= -this.standOffset) this.land();
    } else if (this.state === Jump.CRASH) {
      this.rot += this.spinVel * h;
      if (this.y >= c.floorY - c.crashRestOffset) {
        this.y = c.floorY - c.crashRestOffset;
        this.state = Jump.DOWN;
        this.rot = Math.sign(this.vx) * Math.PI / 2;
        this.effects.sparks(this.x, c.floorY, this.palette.stripeCream);
        this.gameOver();
      }
    }
  }

  land() {
    const t = this.tuning;
    const c = this.cfg;
    const err = uprightError(this.rot);
    const flips = Math.round(Math.abs(this.rot) / TAU);
    this.y = -this.standOffset;
    this.bedDip = 1;

    if (Math.abs(err) > c.landTolerance) {
      this.crash(err);
      return;
    }
    this.vy = -this.bounceSpeed();
    this.rot = 0;
    this.flipsShown = 0;
    this.audio.click();
    if (flips === 0) return;

    const perfect = Math.abs(err) <= c.perfectTolerance;
    this.score.combo(perfect);
    const gained = this.score.add((flips * (flips + 1)) / 2);
    const label = `${c.flipNames[Math.min(flips, c.flipNames.length) - 1]} +${gained}`;
    if (perfect) this.perfectHit(this.x, this.y - c.flipPopupOffset, `PERFECT ${label}`);
    else this.effects.popup(this.x, this.y - c.flipPopupOffset, label, t.colors.gold);
  }

  crash(err) {
    const c = this.cfg;
    this.state = Jump.CRASH;
    const dir = Math.sign(err) || 1;
    this.vx = dir * c.crashVx;
    this.vy = -c.crashBounce;
    this.spinVel = dir * c.crashSpin;
    this.audio.boing();
    this.cameras.main.shake(this.tuning.juice.hitShakeMs, this.tuning.juice.hitShakeIntensity);
    this.effects.popup(this.x, this.y - c.flipPopupOffset, 'OOPS!', this.tuning.colors.hazard);
  }

  render(simDt) {
    const c = this.cfg;
    const p = this.palette;
    const g = this.g;
    const view = this.viewRect();
    const ol = this.tuning.acrobat.outlineWidth;
    g.clear();

    // Floor.
    g.fillStyle(p.floor, 1);
    g.fillRect(view.x, c.floorY, view.width, view.bottom - c.floorY);

    // Trampoline: legs, striped frame, sagging bed.
    const hw = c.bedWidth / 2;
    g.lineStyle(c.legWidth, p.purple, 1);
    g.lineBetween(-hw, 0, -hw - c.legSplay, c.floorY);
    g.lineBetween(hw, 0, hw + c.legSplay, c.floorY);
    for (let x = -hw, i = 0; x < hw; x += c.stripeWidth, i++) {
      g.fillStyle(i % 2 === 0 ? p.stripeRed : p.stripeCream, 1);
      g.fillRect(x, c.frameTop, Math.min(c.stripeWidth, hw - x), c.frameHeight);
    }
    const dip = this.bedDip * c.bedSag;
    g.lineStyle(c.bedWidthLine + ol * 2, p.outline, 1);
    g.beginPath();
    g.moveTo(-hw, 0);
    g.lineTo(this.x, dip);
    g.lineTo(hw, 0);
    g.strokePath();
    g.lineStyle(c.bedWidthLine, p.gold, 1);
    g.beginPath();
    g.moveTo(-hw, 0);
    g.lineTo(this.x, dip);
    g.lineTo(hw, 0);
    g.strokePath();

    // Acrobat: tuck while spinning, flail in a crash.
    const v = this.view;
    const k = smoothing(this.tuning.acrobat.tuckIn, simDt);
    const spinning = this.state === Jump.AIR && this.holding;
    v.time += simDt;
    v.setPose({
      spin: this.rot,
      tuck: lerp(v.tuck, spinning ? 1 : 0, k),
      flail: lerp(v.flail, this.state === Jump.CRASH ? 1 : 0, k),
      pike: 0,
      knee: this.state === Jump.STAND ? 0 : c.airKnee
    });
    this.effects.updateTrail(simDt, { x: this.x, y: this.y }, spinning);
    v.drawAt(this.x, this.y + (this.state === Jump.STAND ? dip : 0));

    if (this.phase === Phase.PLAY && this.state === Jump.AIR) this.drawUprightDial();
  }

  // Small dial above the bed: the needle shows the body angle, the green wedge is "upright".
  drawUprightDial() {
    const c = this.cfg;
    const g = this.g;
    const p = this.palette;
    const r = c.dialRadius;
    const cx = c.dialX, cy = c.dialY;
    const tol = (c.landTolerance * Math.PI) / 180;
    const up = -Math.PI / 2;
    g.fillStyle(p.outline, c.dialAlpha);
    g.fillCircle(cx, cy, r);
    g.fillStyle(p.teal, c.dialAlpha);
    g.slice(cx, cy, r, up - tol, up + tol, false);
    g.fillPath();
    const a = up - this.rot;
    g.lineStyle(c.dialNeedle, p.gold, 1);
    g.lineBetween(cx, cy, cx + Math.cos(a) * r, cy + Math.sin(a) * r);
  }
}
