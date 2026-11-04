// Score and combo multiplier. Perfect catches double the multiplier up to the cap,
// normal catches reset it. Every award is multiplied by the current multiplier.
export default class ScoreSystem {
  constructor(tuning) {
    this.tuning = tuning;
    this.reset();
  }

  reset() {
    this.score = 0;
    this.multiplier = 1;
    this.catches = 0;
  }

  // Number of doublings so far (x1 = 0, x2 = 1, x4 = 2 ...).
  get level() {
    return Math.log2(this.multiplier);
  }

  catchBar(perfect) {
    this.catches++;
    this.combo(perfect);
    return this.add(this.tuning.score.catch);
  }

  // Perfect doubles the multiplier (capped), anything else resets it to x1.
  combo(perfect) {
    this.multiplier = perfect ? Math.min(this.tuning.score.maxMultiplier, this.multiplier * 2) : 1;
  }

  add(points) {
    const gained = points * this.multiplier;
    this.score += gained;
    return gained;
  }
}
