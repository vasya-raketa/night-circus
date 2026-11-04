// The one fixed jump. Launch velocity reaches `jumpHeight` above the release point and lands
// `jumpDistance` ahead under normal gravity, no matter how the acrobat was moving.
// Exceptions (trampoline, cannon) scale or replace it by fixed, known amounts.
export function arcVelocity(tuning, distanceScale = 1, heightScale = 1) {
  const g = tuning.physics.gravity;
  const vy = Math.sqrt(2 * g * tuning.game.jumpHeight * heightScale);
  return { vx: (tuning.game.jumpDistance * distanceScale) / ((2 * vy) / g), vy: -vy };
}

// Fixed-power launch along an angle (degrees above horizontal, forward).
export function angledVelocity(power, deg) {
  const a = (deg * Math.PI) / 180;
  return { vx: Math.cos(a) * power, vy: -Math.sin(a) * power };
}

// One flight step. `env` is the area effect state at the body's position.
export function stepFlight(body, env, gravity, dt) {
  body.vx += env.ax * dt;
  body.vy += gravity * env.gravityScale * dt;
  body.x += body.vx * dt;
  body.y += body.vy * dt;
}

// First point where a path crosses `y` going down, interpolated; null if it never does.
export function crossingDown(path, y) {
  for (let i = 1; i < path.length; i++) {
    const a = path[i - 1], b = path[i];
    if (b.y > a.y && a.y <= y && b.y >= y) {
      const k = (y - a.y) / (b.y - a.y);
      return { x: a.x + (b.x - a.x) * k, y, index: i };
    }
  }
  return null;
}

// Point at fraction f of the horizontal travel between path[0] and path[end].
export function pointAlong(path, f, end = path.length - 1) {
  const x0 = path[0].x;
  const x = x0 + (path[end].x - x0) * f;
  for (let i = 1; i <= end; i++) if (path[i].x >= x) return { x: path[i].x, y: path[i].y };
  return { x: path[end].x, y: path[end].y };
}
