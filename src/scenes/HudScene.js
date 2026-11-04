import Phaser from 'phaser';
import { createPalette } from '../render/palette.js';
import { Phase } from './Phase.js';

// Score, best, combo and the ready / run-over messages. Reads state from the Demo scene.
export default class HudScene extends Phaser.Scene {
  constructor() {
    super({ key: 'Hud', active: true });
  }

  create() {
    const t = (this.tuning = this.registry.get('tuning'));
    this.palette = createPalette(t.colors);
    this.px = this.registry.get('pixelRatio');
    this.demo = this.scene.get(this.registry.get('gameKey'));

    this.panel = this.add.graphics();
    this.pressureG = this.add.graphics();
    this.scoreText = this.makeText(t.ui.scoreSize, t.colors.text).setOrigin(0.5, 0);
    this.bestText = this.makeText(t.ui.bestSize, t.colors.stripeCream).setOrigin(0.5, 0);
    this.comboText = this.makeText(t.juice.comboBaseSize, t.colors.teal).setOrigin(1, 0);
    this.message = this.makeText(t.ui.messageSize, t.colors.text).setOrigin(0.5);
    this.title = this.makeText(t.ui.titleSize, t.colors.gold).setOrigin(0.5);
    this.shownMultiplier = 1;
    this.time0 = 0;

    this.scale.on('resize', this.layout, this);
    this.layout();
  }

  makeText(size, color) {
    return this.add.text(0, 0, '', {
      fontFamily: this.tuning.ui.font,
      fontSize: `${size * this.px}px`,
      fontStyle: 'bold',
      color,
      stroke: this.tuning.colors.outline,
      strokeThickness: this.tuning.ui.stroke * this.px,
      align: 'center'
    });
  }

  layout() {
    const m = this.tuning.ui.margin * this.px;
    const w = this.scale.width;
    this.scoreText.setPosition(w / 2, m);
    this.bestText.setPosition(w / 2, m + this.tuning.ui.scoreSize * this.px);
    this.comboText.setPosition(w - m, m);
  }

  update(_time, delta) {
    const t = this.tuning;
    const d = this.demo;
    if (!d.score) return;
    this.time0 += delta / 1000;
    const w = this.scale.width, h = this.scale.height;
    const hidden = !!d.hudHidden;
    this.drawPressure(hidden ? null : d.pressureHud, w, h);
    for (const o of [this.scoreText, this.bestText, this.comboText, this.message, this.title, this.panel]) o.setVisible(!hidden);
    if (hidden) return;
    const inset = (d.hudInset ?? 0) * this.px;
    this.scoreText.setY(t.ui.margin * this.px + inset);
    this.bestText.setY(t.ui.margin * this.px + t.ui.scoreSize * this.px + inset);
    this.comboText.setY(t.ui.margin * this.px + inset);

    const records = d.recordsBest !== false;
    this.scoreText.setText(String(d.score.score));
    this.bestText.setText(records ? `BEST ${Math.max(d.best, d.score.score)}` : '');
    this.updateCombo(d.score.multiplier);

    this.panel.clear();
    this.title.setVisible(false);
    this.message.setVisible(d.phase !== Phase.PLAY);
    const pulse = 1 + Math.sin(this.time0 * t.ui.hintPulse) * t.ui.hintPulseAmount;

    if (d.phase === Phase.READY) {
      this.title.setVisible(true).setText(d.hudTitle ?? 'SWING & LET GO').setPosition(w / 2, h * t.ui.readyTitleY).setScale(1);
      this.message.setText(d.hudHint ?? 'TAP to jump on the bar\nthen TAP to let go').setPosition(w / 2, h * t.ui.readyHintY).setScale(pulse);
    } else if (d.phase === Phase.OVER) {
      const u = this.px;
      const pw = Math.min(w - t.ui.margin * 2 * u, t.ui.panelWidth * u);
      const ph = t.ui.panelHeight * u;
      this.panel.fillStyle(this.palette.outline, t.ui.panelAlpha);
      this.panel.fillRoundedRect(w / 2 - pw / 2, h / 2 - ph / 2, pw, ph, t.ui.panelRadius * u);
      this.title.setVisible(true).setText(d.overTitle ?? 'RUN OVER').setPosition(w / 2, h / 2 - ph * t.ui.overTitleOffset).setScale(1);
      const best = !records ? ' ' : d.newBest ? 'NEW BEST!' : `Best ${d.best}`;
      const hint = d.overTime >= t.world.restartDelay ? (d.overTitle ? 'Tap to play again' : 'Tap to restart') : ' ';
      this.message.setText(`Score ${d.score.score}\n${best}\n\n${hint}`).setPosition(w / 2, h / 2 + ph * t.ui.overTextOffset).setScale(1);
    }
  }

  // Red glow on the left edge and a distance bar at the top, both from the chaser's distance.
  drawPressure(info, w) {
    const g = this.pressureG;
    g.clear();
    if (!info) return;
    const pt = this.tuning.pressure;
    const u = this.px;
    for (let i = 1; i <= pt.glowSteps; i++) {
      g.fillStyle(this.palette.hazard, (pt.glowAlpha * info.intensity) / pt.glowSteps);
      g.fillRect(0, 0, (w * pt.glowShare * i) / pt.glowSteps, this.scale.height);
    }
    const bw = pt.barWidth * u, bh = pt.barHeight * u;
    const x = w / 2 - bw / 2, y = (pt.barTop + (this.demo.hudInset ?? 0)) * u;
    g.fillStyle(this.palette.outline, this.tuning.ui.panelAlpha);
    g.fillRoundedRect(x - bh, y - bh / 2, bw + bh * 2, bh * 2, bh);
    g.fillStyle(info.intensity > 0 ? this.palette.hazard : this.palette.teal, 1);
    g.fillRoundedRect(x, y, Math.max(bh, bw * info.share), bh, bh / 2);
    g.fillStyle(this.palette.stripeRed, 1);
    g.fillCircle(x, y + bh / 2, bh);
  }

  // The combo label pops when the multiplier doubles and grows with each level.
  updateCombo(mult) {
    const t = this.tuning;
    const level = Math.log2(mult);
    this.comboText.setText(mult > 1 ? `x${mult}` : '');
    if (mult === this.shownMultiplier) return;
    if (mult > this.shownMultiplier) {
      this.comboText.setFontSize(`${(t.juice.comboBaseSize + level * t.juice.comboGrowPerLevel) * this.px}px`);
      this.tweens.killTweensOf(this.comboText);
      this.comboText.setScale(t.juice.comboPopScale);
      this.tweens.add({ targets: this.comboText, scale: 1, duration: t.juice.comboPopMs, ease: 'Back.easeOut' });
    }
    this.shownMultiplier = mult;
  }
}
