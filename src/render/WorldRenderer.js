import { BarKind } from '../systems/Trapeze.js';
import { lerp, smoothing } from './palette.js';

// Draws everything in the world except the acrobat: ceiling rig, start platform,
// trapezes, hazards, stars and the safety net. One Graphics, redrawn every frame.
export default class WorldRenderer {
  constructor(scene, tuning, palette) {
    this.tuning = tuning;
    this.palette = palette;
    this.g = scene.add.graphics();
    this.netDip = 0;
    this.netDipX = 0;
  }

  dipNet(x, amount) {
    this.netDipX = x;
    this.netDip = Math.max(this.netDip, amount);
  }

  draw(view, world, dt) {
    const g = this.g;
    g.clear();
    if (world.ceiling !== false) this.drawCeiling(view);
    if (world.platform) this.drawPlatform(world.platform);
    for (const h of world.hazards) {
      if (h.type === 'sandbag') this.drawSandbag(h);
    }
    for (const bar of world.bars) this.drawBar(bar);
    for (const h of world.hazards) {
      if (h.type === 'hoop') this.drawHoop(h);
    }
    for (const s of world.stars) {
      if (!s.collected) this.drawStar(s.x, s.y + Math.sin(s.phase + s.time * this.tuning.stars.bobSpeed) * this.tuning.stars.bobAmount, s.time);
    }
    this.drawNet(view, dt);
  }

  drawCeiling(view) {
    const { ceilingY } = this.tuning.world;
    const g = this.g;
    g.fillStyle(this.palette.backgroundDeep, 1);
    g.fillRect(view.x, view.y, view.width, ceilingY - view.y - this.tuning.generator.anchorMinY / 2);
  }

  drawPlatform(pf) {
    const { width, deckHeight, stripeWidth, poleWidth } = this.tuning.platform;
    const { netY } = this.tuning.world;
    const g = this.g;
    const p = this.palette;
    const ol = this.tuning.acrobat.outlineWidth;
    const left = pf.x - width / 2;

    g.fillStyle(p.outline, 1);
    g.fillRect(pf.x - poleWidth / 2 - ol, pf.y, poleWidth + ol * 2, netY - pf.y);
    g.fillStyle(p.purple, 1);
    g.fillRect(pf.x - poleWidth / 2, pf.y, poleWidth, netY - pf.y);

    g.fillStyle(p.outline, 1);
    g.fillRect(left - ol, pf.y - ol, width + ol * 2, deckHeight + ol * 2);
    for (let x = left, i = 0; x < left + width; x += stripeWidth, i++) {
      g.fillStyle(i % 2 === 0 ? p.stripeRed : p.stripeCream, 1);
      g.fillRect(x, pf.y, Math.min(stripeWidth, left + width - x), deckHeight);
    }
  }

  drawBar(bar) {
    const t = this.tuning;
    const g = this.g;
    const p = this.palette;
    const hw = t.bars.width / 2;
    const ol = t.acrobat.outlineWidth;
    const ax = bar.anchorX, ay = bar.anchorY;

    if (bar.kind === BarKind.RAIL) {
      const r = (bar.motion?.slideRange ?? t.obstacles.rail.range) + hw;
      g.lineStyle(t.bars.thickness + ol * 2, p.outline, 1);
      g.lineBetween(bar.baseX - r, ay, bar.baseX + r, ay);
      g.lineStyle(t.bars.thickness, p.purple, 1);
      g.lineBetween(bar.baseX - r, ay, bar.baseX + r, ay);
      g.fillStyle(p.gold, 1);
      g.fillCircle(bar.baseX - r, ay, t.bars.anchorRadius);
      g.fillCircle(bar.baseX + r, ay, t.bars.anchorRadius);
    }

    if (bar.broken) {
      const d = bar.debris;
      g.lineStyle(1 + ol, p.ropeFlash, 1);
      g.lineBetween(ax - hw, ay, ax - hw, ay + t.swing.ropeLength * t.obstacles.fragile.brokenRopeShare);
      g.lineBetween(ax + hw, ay, ax + hw, ay + t.swing.ropeLength * t.obstacles.fragile.brokenRopeShare);
      this.drawGoldBar(d.x, d.y, hw);
      this.drawAnchors(ax, ay, hw);
      return;
    }

    const grip = bar.gripPoint(t);
    let ropeColor = p.rope;
    if (bar.kind === BarKind.FRAGILE && bar.wasGrabbed) {
      const prog = bar.fragileProgress(t);
      const { flashRateStart, flashRateEnd } = t.obstacles.fragile;
      const rate = lerp(flashRateStart, flashRateEnd, prog);
      ropeColor = Math.sin(bar.time * rate * Math.PI * 2) > 0 ? p.ropeFlash : p.stripeCream;
    } else if (bar.kind === BarKind.FRAGILE) {
      ropeColor = p.ropeFragile;
    }
    g.lineStyle(t.bars.ropeWidth, ropeColor, 1);
    g.lineBetween(ax - hw, ay, grip.x - hw, grip.y);
    g.lineBetween(ax + hw, ay, grip.x + hw, grip.y);
    this.drawAnchors(ax, ay, hw);
    this.drawGoldBar(grip.x, grip.y, hw);
  }

  drawAnchors(x, y, hw) {
    const g = this.g;
    g.fillStyle(this.palette.outline, 1);
    g.fillCircle(x - hw, y, this.tuning.bars.anchorRadius);
    g.fillCircle(x + hw, y, this.tuning.bars.anchorRadius);
  }

  drawGoldBar(x, y, hw) {
    const g = this.g;
    const { thickness } = this.tuning.bars;
    const ol = this.tuning.acrobat.outlineWidth;
    g.fillStyle(this.palette.outline, 1);
    g.fillRoundedRect(x - hw - ol, y - thickness / 2 - ol, hw * 2 + ol * 2, thickness + ol * 2, (thickness + ol * 2) / 2);
    g.fillStyle(this.palette.gold, 1);
    g.fillRoundedRect(x - hw, y - thickness / 2, hw * 2, thickness, thickness / 2);
  }

  drawHoop(h) {
    const g = this.g;
    const p = this.palette;
    const { radius, rimRadius, drawWidth, flameCount, flameSize, flameFlicker, flameSpread, flamePhaseStep, flameAlpha } = this.tuning.obstacles.hoop;
    const ol = this.tuning.acrobat.outlineWidth;
    g.lineStyle(rimRadius + ol * 2, p.outline, 1);
    g.strokeEllipse(h.x, h.y, drawWidth, radius * 2);
    g.lineStyle(rimRadius, p.hazard, 1);
    g.strokeEllipse(h.x, h.y, drawWidth, radius * 2);
    for (let i = 0; i < flameCount; i++) {
      const a = (i / flameCount) * Math.PI * 2;
      const flick = (1 + Math.sin(h.time * flameFlicker + i * flamePhaseStep)) / 2;
      const fx = h.x + Math.cos(a) * (drawWidth / 2 + flameSize * flick * flameSpread);
      const fy = h.y + Math.sin(a) * (radius + flameSize * flick * flameSpread);
      g.fillStyle(i % 2 ? p.flame : p.hazard, flameAlpha);
      g.fillCircle(fx, fy - flick * flameSize, flameSize * (1 - flameSpread + flick * flameSpread));
    }
  }

  drawSandbag(s) {
    const g = this.g;
    const p = this.palette;
    const pos = s.position();
    const { radius: r, shineOffset, shineSize, shineAlpha } = this.tuning.obstacles.sandbag;
    const ol = this.tuning.acrobat.outlineWidth;
    g.lineStyle(this.tuning.bars.ropeWidth, p.rope, 1);
    g.lineBetween(s.anchorX, s.anchorY, pos.x, pos.y);
    g.fillStyle(p.outline, 1);
    g.fillCircle(s.anchorX, s.anchorY, this.tuning.bars.anchorRadius);
    g.fillCircle(pos.x, pos.y, r + ol);
    g.fillStyle(p.hazard, 1);
    g.fillCircle(pos.x, pos.y, r);
    g.fillStyle(p.flame, shineAlpha);
    g.fillCircle(pos.x - r * shineOffset, pos.y - r * shineOffset, r * shineSize);
  }

  drawStar(x, y, time, radius = this.tuning.stars.radius, alpha = 1) {
    const g = this.g;
    const pts = starPoints(x, y, radius, radius * this.tuning.stars.innerRatio, time * this.tuning.stars.spin);
    g.fillStyle(this.palette.outline, alpha);
    g.fillPoints(starPoints(x, y, radius + this.tuning.acrobat.outlineWidth, (radius + this.tuning.acrobat.outlineWidth) * this.tuning.stars.innerRatio, time * this.tuning.stars.spin), true);
    g.fillStyle(this.palette.star, alpha);
    g.fillPoints(pts, true);
  }

  drawNet(view, dt) {
    const g = this.g;
    const p = this.palette;
    const { netY, netSag, netSagWidth, netSagRecover } = this.tuning.world;
    this.netDip = lerp(this.netDip, 0, smoothing(netSagRecover, dt));

    g.fillStyle(p.floor, 1);
    g.fillRect(view.x, netY, view.width, view.bottom - netY);

    const sagAt = (x) => {
      const d = (x - this.netDipX) / netSagWidth;
      return netY + this.netDip * netSag * Math.exp(-d * d);
    };
    const step = this.tuning.world.netMesh;
    const x0 = Math.floor(view.x / step) * step;
    g.lineStyle(this.tuning.world.netMeshWidth, p.net, this.tuning.world.netMeshAlpha);
    for (let x = x0; x < view.right + step; x += step) {
      g.lineBetween(x, sagAt(x), x + step / 2, netY + step / 2);
      g.lineBetween(x + step, sagAt(x + step), x + step / 2, netY + step / 2);
    }
    g.lineStyle(this.tuning.bars.ropeWidth, p.net, 1);
    g.beginPath();
    g.moveTo(x0, sagAt(x0));
    for (let x = x0; x < view.right + step; x += step / 2) g.lineTo(x, sagAt(x));
    g.strokePath();
  }
}

export function starPoints(x, y, outer, inner, rotation) {
  const pts = [];
  for (let i = 0; i < 10; i++) {
    const r = i % 2 === 0 ? outer : inner;
    const a = rotation - Math.PI / 2 + (i * Math.PI) / 5;
    pts.push({ x: x + Math.cos(a) * r, y: y + Math.sin(a) * r });
  }
  return pts;
}
