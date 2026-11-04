import { AcrobatState, launchVelocity, predictFlight } from '../systems/AcrobatController.js';

// Debug-only world overlay (?demo&debug): the launch-power bar above the acrobat
// and, when enabled, the predicted arc. Both use the exact release formula.
export default class DebugOverlay {
  constructor(scene, tuning, palette) {
    this.tuning = tuning;
    this.palette = palette;
    this.g = scene.add.graphics();
  }

  draw(ctrl) {
    const g = this.g;
    const t = this.tuning;
    const d = t.debug;
    const p = this.palette;
    g.clear();
    if (ctrl.state !== AcrobatState.SWING && ctrl.state !== AcrobatState.READY) return;

    const v = launchVelocity(t, ctrl.bar.angle, ctrl.bar.angVel);

    if (d.showArc && ctrl.state === AcrobatState.SWING) {
      const path = predictFlight(t, ctrl.x, ctrl.y, v, d.arcDt, d.arcMaxTime, t.world.netY);
      g.fillStyle(p.spotlight, d.arcAlpha);
      for (let i = 1; i < path.length; i++) g.fillCircle(path[i].x, path[i].y, d.arcDotRadius);
    }

    const l = t.launch;
    const fill = v.power / Math.max(l.power_back, l.power_bottom, l.power_front);
    const w = d.powerBarWidth, h = d.powerBarHeight;
    const x = ctrl.x - w / 2;
    const y = ctrl.y - d.powerBarOffset - h;
    const ol = t.acrobat.outlineWidth;
    g.fillStyle(p.outline, 1);
    g.fillRect(x - ol, y - ol, w + ol * 2, h + ol * 2);
    g.fillStyle(fill >= d.powerBarStrongAt ? p.teal : p.gold, 1);
    g.fillRect(x, y, w * fill, h);
  }
}
