// DOM slider panel (?demo&debug). Sliders write straight into the live tuning
// object, so changes apply on the next physics step.
const getPath = (obj, path) => path.split('.').reduce((o, k) => o[k], obj);
const setPath = (obj, path, value) => {
  const keys = path.split('.');
  const last = keys.pop();
  keys.reduce((o, k) => o[k], obj)[last] = value;
};

export default class DebugPanel {
  constructor(tuning, defaults, { onRestart, sliders = tuning.debug.sliders, checkboxes = [['Predicted arc', 'debug.showArc']] }) {
    this.tuning = tuning;
    this.defaults = defaults;
    this.inputs = [];

    const root = (this.root = document.createElement('div'));
    root.className = 'debug-panel';
    const header = document.createElement('div');
    header.className = 'debug-header';
    const title = document.createElement('strong');
    title.textContent = 'Tuning';
    const toggle = this.button('–', () => {
      root.classList.toggle('collapsed');
      toggle.textContent = root.classList.contains('collapsed') ? '+' : '–';
    });
    header.append(title, toggle);
    root.append(header);

    const body = document.createElement('div');
    body.className = 'debug-body';
    for (const s of sliders) body.append(this.slider(s));
    for (const [label, path] of checkboxes) body.append(this.checkbox(label, path));
    const actions = document.createElement('div');
    actions.className = 'debug-actions';
    actions.append(
      this.button('Defaults', () => this.resetDefaults()),
      this.button('Restart run', onRestart),
      this.button('Copy JSON', () => navigator.clipboard?.writeText(JSON.stringify(tuning, null, 2)))
    );
    body.append(actions);
    root.append(body);

    // Keep taps on the panel from reaching the game.
    for (const type of ['pointerdown', 'touchstart', 'keydown']) root.addEventListener(type, (e) => e.stopPropagation());
    document.body.append(root);
  }

  button(label, onClick) {
    const b = document.createElement('button');
    b.type = 'button';
    b.textContent = label;
    b.addEventListener('click', onClick);
    return b;
  }

  slider({ label, path, min, max, step }) {
    const row = document.createElement('label');
    row.className = 'debug-row';
    const name = document.createElement('span');
    name.textContent = label;
    const value = document.createElement('output');
    const input = document.createElement('input');
    Object.assign(input, { type: 'range', min, max, step, value: getPath(this.tuning, path) });
    const show = () => (value.textContent = Number(input.value).toString());
    input.addEventListener('input', () => {
      setPath(this.tuning, path, Number(input.value));
      show();
      input.blur();
    });
    show();
    this.inputs.push({ input, path, show });
    row.append(name, value, input);
    return row;
  }

  checkbox(label, path) {
    const row = document.createElement('label');
    row.className = 'debug-check';
    const input = document.createElement('input');
    input.type = 'checkbox';
    input.checked = getPath(this.tuning, path);
    input.addEventListener('change', () => {
      setPath(this.tuning, path, input.checked);
      input.blur();
    });
    const name = document.createElement('span');
    name.textContent = label;
    row.append(input, name);
    return row;
  }

  resetDefaults() {
    for (const { input, path, show } of this.inputs) {
      const v = getPath(this.defaults, path);
      setPath(this.tuning, path, v);
      input.value = v;
      show();
    }
  }
}
