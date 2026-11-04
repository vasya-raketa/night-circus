// Converts the "#RRGGBB" strings in tuning.colors into Phaser colour ints.
export function createPalette(colors) {
  const palette = {};
  for (const [name, hex] of Object.entries(colors)) palette[name] = parseInt(hex.slice(1), 16);
  return palette;
}

export const lerp = (a, b, k) => a + (b - a) * k;

// Frame-rate independent smoothing factor for exponential easing.
export const smoothing = (rate, dt) => 1 - Math.exp(-rate * dt);
