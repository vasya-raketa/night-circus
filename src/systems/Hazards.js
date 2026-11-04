// Hazards and collectibles placed in the gaps between bars.
// Each `check(body, r, tuning)` returns a list of events for this step:
// 'hit' (run fails), 'near' (passed close without touching), 'through' / 'collect' (bonus).

// Tracks "entered the near-miss zone, then left it without a hit".
class NearMissTracker {
  constructor() {
    this.inside = false;
    this.done = false;
  }

  update(gap, nearDistance, events) {
    if (this.done) return;
    if (gap < nearDistance) {
      this.inside = true;
    } else if (this.inside) {
      this.done = true;
      events.push('near');
    }
  }
}

// A burning hoop seen edge-on: the danger is the top and bottom rim.
export class FireHoop {
  constructor({ x, y }) {
    this.type = 'hoop';
    this.x = x;
    this.y = y;
    this.time = 0;
    this.passed = false;
    this.near = new NearMissTracker();
    this.prevBodyX = null;
  }

  update(dt) {
    this.time += dt;
  }

  check(body, r, tuning) {
    const { radius, rimRadius } = tuning.obstacles.hoop;
    const events = [];
    const rimGap = Math.min(
      Math.hypot(body.x - this.x, body.y - (this.y - radius)),
      Math.hypot(body.x - this.x, body.y - (this.y + radius))
    ) - rimRadius - r;
    if (rimGap <= 0) {
      events.push('hit');
      return events;
    }
    if (!this.passed && this.prevBodyX !== null && this.prevBodyX < this.x && body.x >= this.x) {
      this.passed = true;
      if (Math.abs(body.y - this.y) < radius) events.push('through');
    }
    this.prevBodyX = body.x;
    this.near.update(rimGap, tuning.score.nearMissDistance, events);
    return events;
  }

  isBehind(x) {
    return this.x < x;
  }
}

// A sandbag on a long rope, swinging across the flight path.
export class Sandbag {
  constructor({ anchorX, anchorY, length, phase }) {
    this.type = 'sandbag';
    this.anchorX = anchorX;
    this.anchorY = anchorY;
    this.length = length;
    this.phase = phase;
    this.time = 0;
    this.angle = 0;
    this.near = new NearMissTracker();
  }

  update(dt, tuning) {
    this.time += dt;
    const { amplitude, speed } = tuning.obstacles.sandbag;
    const omega = Math.sqrt(tuning.physics.gravity / this.length) * speed;
    this.angle = amplitude * Math.sin(this.phase + this.time * omega);
  }

  position() {
    return {
      x: this.anchorX + Math.sin(this.angle) * this.length,
      y: this.anchorY + Math.cos(this.angle) * this.length
    };
  }

  check(body, r, tuning) {
    const p = this.position();
    const gap = Math.hypot(body.x - p.x, body.y - p.y) - tuning.obstacles.sandbag.radius - r;
    const events = [];
    if (gap <= 0) {
      events.push('hit');
      return events;
    }
    this.near.update(gap, tuning.score.nearMissDistance, events);
    return events;
  }

  isBehind(x) {
    return this.anchorX + this.length < x;
  }
}

export class Star {
  constructor({ x, y, phase }) {
    this.type = 'star';
    this.x = x;
    this.y = y;
    this.phase = phase;
    this.time = 0;
    this.collected = false;
  }

  update(dt) {
    this.time += dt;
  }

  check(body, r, tuning) {
    if (this.collected) return [];
    if (Math.hypot(body.x - this.x, body.y - this.y) > tuning.stars.radius + r) return [];
    this.collected = true;
    return ['collect'];
  }

  isBehind(x) {
    return this.x < x;
  }
}
