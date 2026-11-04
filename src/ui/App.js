import { CATALOG, GROUPS, byId } from '../objects/catalog.js';
import { ratingsText } from './session.js';
import { loadData } from '../platform.js';

const el = (tag, props = {}, ...children) => {
  const node = Object.assign(document.createElement(tag), props);
  node.append(...children.filter((c) => c !== null && c !== undefined));
  return node;
};

// DOM screens on top of the canvas: main menu, playground, in-game bar and info card.
// Switching screens never reloads the page, so session data stays in memory.
export default class App {
  constructor(game, tuning, session) {
    this.game = game;
    this.tuning = tuning;
    this.session = session;
    this.root = document.getElementById('ui');
    this.menuEl = el('div', { className: 'screen menu' });
    this.playEl = el('div', { className: 'screen playground' });
    this.barEl = el('div', { className: 'game-bar' });
    this.cardEl = el('div', { className: 'info-card' });
    this.copyEl = el('div', { className: 'copy-box' });
    this.root.append(this.menuEl, this.playEl, this.barEl, this.cardEl, this.copyEl);
    for (const node of [this.menuEl, this.playEl, this.barEl, this.cardEl, this.copyEl]) {
      for (const type of ['pointerdown', 'touchstart', 'keydown']) node.addEventListener(type, (e) => e.stopPropagation());
    }
  }

  get scene() {
    return this.game.scene.getScene('Game');
  }

  show(screen) {
    this.menuEl.hidden = screen !== 'menu';
    this.playEl.hidden = screen !== 'playground';
    this.barEl.hidden = screen !== 'game';
    this.cardEl.hidden = true;
    this.copyEl.hidden = true;
    if (screen !== 'game') this.scene.startRun({ mode: 'menu' });
    this.scene.hudInset = 0;
  }

  async showMenu() {
    const best = await loadData(this.tuning.game.saveKey, 0);
    this.menuEl.replaceChildren(
      el('h1', { textContent: 'Night Circus' }),
      el('p', { className: 'tagline', textContent: 'Tap to let go. Same jump, every time.' }),
      el('p', { className: 'best', textContent: `Best score: ${Math.max(best, this.scene.best ?? 0)}` }),
      el('button', { className: 'big', textContent: 'Play', onclick: () => this.play() }),
      el('button', { className: 'big alt', textContent: 'Playground', onclick: () => this.showPlayground() })
    );
    this.show('menu');
  }

  play() {
    this.startGame({ mode: 'play' }, 'Menu', () => this.showMenu());
  }

  startGame(config, backLabel, back) {
    this.show('game');
    this.barEl.replaceChildren(el('button', { textContent: `☰ ${backLabel}`, onclick: back }));
    this.scene.startRun(config);
  }

  tryIt(id) {
    const cls = byId[id];
    const n = CATALOG.indexOf(cls) + 1;
    this.startGame({ mode: 'try', tryId: id }, 'Playground', () => this.showPlayground());
    this.cardEl.replaceChildren(
      el('strong', { textContent: `${n}. ${cls.info.name}` }),
      el('span', { textContent: cls.info.rule }),
      el('em', { textContent: cls.info.score })
    );
    this.cardEl.hidden = false;
    requestAnimationFrame(() => (this.scene.hudInset = this.cardEl.offsetHeight));
  }

  sandbox() {
    if (!this.session.toggles.size) return;
    this.startGame({ mode: 'sandbox', allowed: new Set(this.session.toggles) }, 'Playground', () => this.showPlayground());
  }

  showPlayground() {
    const s = this.session;
    const save = () => s.save();
    const check = (label, key) =>
      el('label', { className: 'check' }, el('input', { type: 'checkbox', checked: s.settings[key], onchange: (e) => { s.settings[key] = e.target.checked; save(); } }), el('span', { textContent: label }));
    const slider = (label, key) => {
      const out = el('output', { textContent: s.settings[key].toFixed(2) });
      return el('label', { className: 'slider' }, el('span', { textContent: label }), out,
        el('input', { type: 'range', min: 0, max: 1, step: 0.05, value: s.settings[key], oninput: (e) => { s.settings[key] = Number(e.target.value); out.textContent = s.settings[key].toFixed(2); save(); } }));
    };
    const sandboxBtn = el('button', { className: 'big', onclick: () => this.sandbox() });
    const updateSandbox = () => (sandboxBtn.textContent = `Sandbox run (${s.toggles.size} items)`);
    updateSandbox();

    const settings = el('section', { className: 'settings' },
      el('h2', { textContent: 'Settings' }),
      check('Invincible (falling respawns you on the last bar)', 'invincible'),
      check('Slow motion 0.5x', 'slowMo'),
      check('Always show the arc', 'alwaysArc'),
      check('Show catch / hit zones', 'showZones'),
      check('Painted background (generated art)', 'paintedBg'),
      slider('Obstacle frequency (sandbox)', 'frequency'),
      slider('Difficulty', 'difficulty'),
      el('div', { className: 'row' }, sandboxBtn, el('button', { textContent: 'Copy my ratings', onclick: () => this.copyRatings() }))
    );

    const pr = s.settings.pressure;
    const ps = this.tuning.pressure.sliders;
    const modes = [['chaser', 'Chaser'], ['rope', 'Burning rope'], ['scroll', 'Auto-scroll'], ['off', 'Off']];
    const pslider = (label, key, unit) => {
      const [min, max, step] = ps[key];
      const fmt = (v) => (unit ? `${v.toFixed(1)} ${unit}` : String(v));
      const out = el('output', { textContent: fmt(pr[key]) });
      return el('label', { className: 'slider' }, el('span', { textContent: label }), out,
        el('input', { type: 'range', min, max, step, value: pr[key], oninput: (e) => { pr[key] = Number(e.target.value); out.textContent = fmt(pr[key]); save(); } }));
    };
    const pressure = el('section', { className: 'settings' },
      el('h2', { textContent: 'Pressure' }),
      el('div', { className: 'row modes' }, ...modes.map(([id, label]) =>
        el('label', { className: 'check' }, el('input', { type: 'radio', name: 'pressure', checked: pr.mode === id, onchange: () => { pr.mode = id; save(); } }), el('span', { textContent: label })))),
      pslider('Start time per bar', 'start', 's'),
      pslider('Minimum time per bar', 'min', 's'),
      pslider('Bars to reach the minimum (ramp)', 'rampBars')
    );

    const groups = GROUPS.map((group) => {
      const items = CATALOG.filter((cls) => cls.info.group === group.id).map((cls) => this.itemCard(cls, updateSandbox));
      const all = el('button', { className: 'small', textContent: 'all', onclick: () => { items.forEach((c) => c.setToggle(true)); updateSandbox(); } });
      const none = el('button', { className: 'small', textContent: 'none', onclick: () => { items.forEach((c) => c.setToggle(false)); updateSandbox(); } });
      return el('section', {}, el('h2', {}, group.title, ' ', all, none), el('div', { className: 'grid' }, ...items.map((c) => c.node)));
    });

    const log = s.fairnessLog;
    const fairness = el('details', { className: 'fairness' },
      el('summary', { textContent: `Fairness log (${log.length} segment${log.length === 1 ? '' : 's'} failed the simulation)` }),
      log.length
        ? el('ul', {}, ...log.map((e) => el('li', { textContent: `segment ${e.segment}: ${e.items.join(', ') || 'plain bar'} → ${e.resolution}` })))
        : el('p', { textContent: 'Every placed segment passed so far.' })
    );

    this.playEl.replaceChildren(
      el('header', {}, el('button', { textContent: '← Menu', onclick: () => this.showMenu() }), el('h1', { textContent: 'Playground' })),
      settings, pressure, ...groups, fairness
    );
    this.show('playground');
  }

  itemCard(cls, onToggle) {
    const s = this.session;
    const id = cls.info.id;
    const n = CATALOG.indexOf(cls) + 1;
    const toggle = el('input', { type: 'checkbox', checked: s.toggles.has(id) });
    const setToggle = (on) => {
      toggle.checked = on;
      if (on) s.toggles.add(id);
      else s.toggles.delete(id);
      s.save();
    };
    toggle.onchange = () => { setToggle(toggle.checked); onToggle(); };
    const rateBtns = ['keep', 'maybe', 'cut'].map((r) => el('button', { className: `rate ${r}`, textContent: r[0].toUpperCase() + r.slice(1) }));
    const paint = () => rateBtns.forEach((b, i) => b.classList.toggle('on', s.ratings[id] === ['keep', 'maybe', 'cut'][i]));
    rateBtns.forEach((b, i) => (b.onclick = () => {
      const r = ['keep', 'maybe', 'cut'][i];
      s.ratings[id] = s.ratings[id] === r ? undefined : r;
      if (!s.ratings[id]) delete s.ratings[id];
      s.save();
      paint();
    }));
    paint();
    const node = el('article', { className: 'item' },
      el('div', { className: 'item-head' }, el('label', { className: 'check' }, toggle, el('strong', { textContent: `${n}. ${cls.info.name}` })),
        el('button', { className: 'try', textContent: 'Try it', onclick: () => this.tryIt(id) })),
      el('p', { textContent: cls.info.rule }),
      el('p', { className: 'score', textContent: cls.info.score }),
      el('div', { className: 'rates' }, ...rateBtns)
    );
    return { node, setToggle };
  }

  // Clipboard needs https; on a phone over plain http, show the text to copy by hand.
  async copyRatings() {
    const text = ratingsText(this.session);
    try {
      await navigator.clipboard.writeText(text);
      this.flashCopy(text, 'Copied! Paste it into the chat.');
    } catch {
      this.flashCopy(text, 'Select all and copy:');
    }
  }

  flashCopy(text, label) {
    const area = el('textarea', { value: text, readOnly: true });
    this.copyEl.replaceChildren(el('p', { textContent: label }), area, el('button', { textContent: 'Close', onclick: () => (this.copyEl.hidden = true) }));
    this.copyEl.hidden = false;
    area.focus();
    area.select();
  }
}
