// Screen darkness drawn as a grid of cells (shapes only): cells inside a hole are clear,
// with a soft edge, the rest are dark. Used by darkness and lightning.
export function drawShade(g, view, color, alpha, holes, cell, softness) {
  if (alpha <= 0) return;
  const x0 = Math.floor(view.x / cell) * cell;
  const y0 = Math.floor(view.y / cell) * cell;
  for (let y = y0; y < view.bottom; y += cell) {
    for (let x = x0; x < view.right; x += cell) {
      let a = alpha;
      for (const h of holes) {
        const d = Math.hypot(x + cell / 2 - h.x, y + cell / 2 - h.y) / h.r;
        if (d < 1) a = Math.min(a, alpha * Math.max(0, (d - (1 - softness)) / softness));
      }
      if (a <= 0) continue;
      g.fillStyle(color, a);
      g.fillRect(x, y, cell, cell);
    }
  }
}
