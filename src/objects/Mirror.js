import { AreaEffect } from './base.js';

export default class Mirror extends AreaEffect {
  static info = {
    id: 'mirror', name: 'Mirror', group: 'area',
    rule: 'The screen flips left-right while you are in this stretch. The jump itself does not change.',
    score: '—'
  };

  apply(env) {
    env.mirror = true;
  }
}
