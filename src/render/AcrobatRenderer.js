import { AcrobatState } from '../systems/AcrobatController.js';
import { lerp, smoothing } from './palette.js';

// Stick-figure acrobat drawn with Graphics. The skeleton is built in a local frame
// (hands at the origin, +y down the body, +x forward) and blended between poses:
// swing (legs pike forward / knees bend back), tuck while flying, flail while falling.
export default class AcrobatRenderer {
  constructor(scene, tuning, palette) {
    this.tuning = tuning;
    this.palette = palette;
    this.g = scene.add.graphics();
    this.reset();
  }

  reset() {
    this.orient = 0;       // body axis angle used to place the body around the hands
    this.spin = 0;         // drawing rotation around the body centre
    this.pike = 0;
    this.knee = 0;
    this.tuck = 0;
    this.flail = 0;
    this.time = 0;
    this.prevState = null;
  }

  update(dt, ctrl, nearestBarDist) {
    const a = this.tuning.acrobat;
    const k = smoothing(a.poseLerp, dt);
    this.time += dt;
    let pike = 0, knee = 0, tuck = 0, flail = 0;

    switch (ctrl.state) {
      case AcrobatState.READY:
        this.orient = lerp(this.orient, 0, k);
        this.spin = this.orient;
        break;
      case AcrobatState.SWING: {
        const s = Math.max(-1, Math.min(1, ctrl.bar.angVel / a.angVelRef));
        pike = Math.max(0, s);
        knee = Math.max(0, -s);
        this.orient = lerp(this.orient, ctrl.bar.angle, smoothing(a.swingOrientLerp, dt));
        this.spin = this.orient;
        break;
      }
      // No somersault: the body settles upright and always faces right (+x).
      case AcrobatState.FLY:
        tuck = nearestBarDist < a.openDistance ? 0 : 1;
        this.orient = lerp(this.orient, 0, smoothing(a.uprightLerp, dt));
        this.spin = this.orient;
        break;
      case AcrobatState.FALL:
        flail = 1;
        this.orient = lerp(this.orient, 0, smoothing(a.uprightLerp, dt));
        this.spin = this.orient;
        break;
      case AcrobatState.LANDED:
        this.orient = lerp(this.orient, a.landedAngle, smoothing(a.uprightLerp, dt));
        this.spin = this.orient;
        flail = ctrl.vy !== 0 ? a.landedFlail : 0;
        break;
    }

    const tuckK = smoothing(a.tuckIn, dt);
    this.pike = lerp(this.pike, pike, k);
    this.knee = lerp(this.knee, knee, k);
    this.tuck = lerp(this.tuck, tuck, tuckK);
    this.flail = lerp(this.flail, flail, k);
  }

  // Local skeleton, hands at the origin.
  skeleton() {
    const a = this.tuning.acrobat;
    const tuck = this.tuck;
    const flailT = this.time * a.flailFreq;
    const shoulderY = a.armLength * (1 - tuck * a.tuckShoulderPull);
    const hip = { x: 0, y: shoulderY + a.torsoLength };
    const head = { x: tuck * a.headRadius * a.tuckHeadForward, y: shoulderY - a.headLift };

    const legs = [-1, 1].map((side) => {
      let thigh = a.legForward * this.pike + a.kneeThigh * this.knee + side * a.legSplit;
      let bend = a.kneeBend * this.knee;
      thigh = lerp(thigh, a.tuckThigh, tuck);
      bend = lerp(bend, a.tuckKnee, tuck);
      thigh = lerp(thigh, Math.sin(flailT + side) * a.flailLegAmp, this.flail);
      bend = lerp(bend, (1 + Math.sin(flailT * a.flailKneeRate + side)) * a.flailLegAmp, this.flail);
      const knee = { x: hip.x + Math.sin(thigh) * a.thighLength, y: hip.y + Math.cos(thigh) * a.thighLength };
      const foot = { x: knee.x + Math.sin(thigh - bend) * a.shinLength, y: knee.y + Math.cos(thigh - bend) * a.shinLength };
      return { knee, foot };
    });

    const arms = [-1, 1].map((side, i) => {
      const shoulder = { x: side * a.shoulderHalf * (1 - tuck), y: shoulderY };
      const grip = { x: side * a.handHalf, y: 0 };
      const leg = legs[i];
      const hug = { x: lerp(leg.knee.x, leg.foot.x, a.tuckHugShin), y: lerp(leg.knee.y, leg.foot.y, a.tuckHugShin) };
      const flailAngle = side * (a.flailArmBase + Math.sin(flailT + i * Math.PI) * a.flailArmAmp);
      const flail = { x: shoulder.x + Math.sin(flailAngle) * a.armLength, y: shoulder.y + Math.cos(flailAngle) * a.armLength };
      let hand = { x: lerp(grip.x, hug.x, tuck), y: lerp(grip.y, hug.y, tuck) };
      hand = { x: lerp(hand.x, flail.x, this.flail), y: lerp(hand.y, flail.y, this.flail) };
      return { shoulder, hand };
    });

    const center = { x: 0, y: a.bodyCenterOffset };
    return { head, hip, legs, arms, center, shoulderY };
  }

  draw(ctrl) {
    // Body centre sits along `orient` from the hands; the figure is drawn rotated by `spin` around it.
    const c = this.tuning.acrobat.bodyCenterOffset;
    this.drawAt(ctrl.x + Math.sin(this.orient) * c, ctrl.y + Math.cos(this.orient) * c);
  }

  // Sets the pose directly (for demos without an AcrobatController). Missing fields keep their value.
  setPose({ spin, tuck, pike, knee, flail } = {}) {
    if (spin !== undefined) this.spin = spin;
    if (tuck !== undefined) this.tuck = tuck;
    if (pike !== undefined) this.pike = pike;
    if (knee !== undefined) this.knee = knee;
    if (flail !== undefined) this.flail = flail;
  }

  // Draws the figure around its body centre. Pass clear=false to draw several figures on one Graphics.
  drawAt(cx, cy, clear = true) {
    const a = this.tuning.acrobat;
    const p = this.palette;
    const g = this.g;
    const sk = this.skeleton();
    const cos = Math.cos(this.spin), sin = Math.sin(this.spin);
    const w = (pt) => {
      const lx = pt.x - sk.center.x, ly = pt.y - sk.center.y;
      return { x: cx + lx * cos + ly * sin, y: cy - lx * sin + ly * cos };
    };

    const neck = w({ x: 0, y: sk.shoulderY });
    const hip = w(sk.hip);
    const segments = [];
    for (const arm of sk.arms) segments.push([w(arm.shoulder), w(arm.hand), a.limbWidth, p.skin]);
    for (const leg of sk.legs) {
      const knee = w(leg.knee);
      segments.push([hip, knee, a.limbWidth, p.teal]);
      segments.push([knee, w(leg.foot), a.limbWidth, p.skin]);
    }
    segments.push([neck, hip, a.torsoWidth, p.teal]);

    if (clear) g.clear();
    for (const [s, e, width] of segments) {
      g.lineStyle(width + a.outlineWidth * 2, p.outline, 1);
      g.lineBetween(s.x, s.y, e.x, e.y);
      g.fillStyle(p.outline, 1);
      g.fillCircle(s.x, s.y, width / 2 + a.outlineWidth);
      g.fillCircle(e.x, e.y, width / 2 + a.outlineWidth);
    }
    for (const [s, e, width, color] of segments) {
      g.lineStyle(width, color, 1);
      g.lineBetween(s.x, s.y, e.x, e.y);
      g.fillStyle(color, 1);
      g.fillCircle(s.x, s.y, width / 2);
      g.fillCircle(e.x, e.y, width / 2);
    }
    const head = w(sk.head);
    g.fillStyle(p.outline, 1);
    g.fillCircle(head.x, head.y, a.headRadius + a.outlineWidth);
    g.fillStyle(p.skin, 1);
    g.fillCircle(head.x, head.y, a.headRadius);
  }
}
