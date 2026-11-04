import { CATALOG } from '../objects/catalog.js';
import { loadData, saveData } from '../platform.js';

const KEY = 'night-circus.playground';

// Playground state for this session: settings, sandbox toggles, ratings and the fairness log.
export async function createSession(tuning) {
  const saved = (await loadData(KEY, null)) ?? {};
  const session = {
    settings: {
      ...tuning.playground,
      pressure: { mode: tuning.pressure.mode, start: tuning.pressure.startBudget, min: tuning.pressure.minBudget, rampBars: tuning.pressure.rampBars },
      ...saved.settings
    },
    toggles: new Set(saved.toggles ?? CATALOG.map((c) => c.info.id)),
    ratings: { ...saved.ratings },
    fairnessLog: [],
    save() {
      saveData(KEY, { settings: this.settings, toggles: [...this.toggles], ratings: this.ratings });
    }
  };
  return session;
}

// Plain-text ratings list to paste back.
export function ratingsText(session) {
  const lines = ['Night Circus obstacle ratings'];
  const groups = { keep: [], maybe: [], cut: [], unrated: [] };
  CATALOG.forEach((cls, i) => groups[session.ratings[cls.info.id] ?? 'unrated'].push(`${i + 1} ${cls.info.name}`));
  for (const [k, list] of Object.entries(groups)) lines.push(`${k[0].toUpperCase() + k.slice(1)} (${list.length}): ${list.join(', ') || '-'}`);
  return lines.join('\n');
}
