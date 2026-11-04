// Save/load bridge for the host platform. By default data lives in memory for the
// session (no localStorage). A portal SDK can plug in with setStorageAdapter().
const memory = new Map();
let adapter = null;

// adapter: { save(key, value): Promise|void, load(key): Promise<any>|any }
export function setStorageAdapter(next) {
  adapter = next;
}

export async function saveData(key, value) {
  memory.set(key, JSON.stringify(value));
  if (!adapter) return;
  try {
    await adapter.save(key, value);
  } catch (err) {
    console.warn('[platform] save failed, kept in memory', err);
  }
}

export async function loadData(key, fallback = null) {
  if (adapter) {
    try {
      const value = await adapter.load(key);
      if (value !== undefined && value !== null) return value;
    } catch (err) {
      console.warn('[platform] load failed, using memory', err);
    }
  }
  return memory.has(key) ? JSON.parse(memory.get(key)) : fallback;
}
