import { stepPendulum, swingOmega } from './AcrobatController.js';

export const BarKind = Object.freeze({ NORMAL: 'normal', RAIL: 'rail', FRAGILE: 'fragile' });

// A trapeze bar hanging from two parallel ropes. When nobody holds it, it idles
// with a small swing; the AcrobatController drives it while it is held.
export default class Trapeze {
  // `motion` (optional, used by other demos): { slideRange, slideSpeed, bobRange, bobSpeed, idleAmplitude }
  constructor({ index, x, y, swingMul = 1, kind = BarKind.NORMAL, phase = 0, motion = null }) {
    this.motion = motion;
    this.baseY = y;
    this.index = index;
    this.baseX = x;
    this.anchorX = x;
    this.anchorY = y;
    this.anchorVx = 0;
    this.swingMul = swingMul;
    this.kind = kind;
    this.phase = phase;
    this.time = 0;
    this.angle = 0;
    this.angVel = 0;
    this.occupied = false;
    this.wasGrabbed = false;
    this.fragileTimer = 0;
    this.broken = false;
    this.debris = null;
  }

  gripPoint(tuning) {
    const L = tuning.swing.ropeLength;
    return { x: this.anchorX + Math.sin(this.angle) * L, y: this.anchorY + Math.cos(this.angle) * L };
  }

  // Seeds the idle swing so neighbouring bars are not in lockstep.
  startIdle(tuning) {
    const omega = swingOmega(tuning, this.swingMul);
    const amp = this.idleAmplitude(tuning);
    this.angle = amp * Math.sin(this.phase);
    this.angVel = amp * omega * Math.cos(this.phase);
  }

  idleAmplitude(tuning) {
    return this.motion?.idleAmplitude ?? tuning.bars.idleAmplitude;
  }

  // Returns 'snap' on the step a fragile bar breaks.
  update(dt, tuning) {
    this.time += dt;
    if (this.kind === BarKind.RAIL) {
      const { range, speed } = tuning.obstacles.rail;
      const prevX = this.anchorX;
      this.anchorX = this.baseX + Math.sin(this.phase + this.time * speed) * range;
      this.anchorVx = (this.anchorX - prevX) / dt;
    }
    const m = this.motion;
    if (m?.slideRange) {
      const prevX = this.anchorX;
      this.anchorX = this.baseX + Math.sin(this.phase + this.time * m.slideSpeed) * m.slideRange;
      this.anchorVx = (this.anchorX - prevX) / dt;
    }
    if (m?.bobRange) this.anchorY = this.baseY + Math.sin(this.phase + this.time * m.bobSpeed) * m.bobRange;
    if (this.broken) {
      this.debris.vy += tuning.bars.brokenGravity * dt;
      this.debris.y += this.debris.vy * dt;
      return null;
    }
    if (!this.occupied) {
      stepPendulum(this, swingOmega(tuning, this.swingMul), this.idleAmplitude(tuning), tuning.bars.idlePump, dt);
      return null;
    }
    if (this.kind === BarKind.FRAGILE) {
      if (!this.wasGrabbed) {
        this.wasGrabbed = true;
        this.fragileTimer = tuning.obstacles.fragile.snapTime;
      }
      this.fragileTimer -= dt;
      if (this.fragileTimer <= 0) {
        this.snap(tuning);
        return 'snap';
      }
    }
    return null;
  }

  snap(tuning) {
    this.broken = true;
    const p = this.gripPoint(tuning);
    this.debris = { x: p.x, y: p.y, vy: 0 };
  }

  // 0..1 progress towards snapping, for the rope flash.
  fragileProgress(tuning) {
    if (this.kind !== BarKind.FRAGILE || !this.wasGrabbed) return 0;
    return 1 - Math.max(0, this.fragileTimer) / tuning.obstacles.fragile.snapTime;
  }
}
