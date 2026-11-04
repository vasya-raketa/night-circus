import { TrapezeBar } from './base.js';

export default class StaticBar extends TrapezeBar {
  static info = {
    id: 'staticBar', name: 'Static bar', group: 'grab',
    rule: 'Hangs still. Your swing decides where the fixed arc starts.',
    score: '+1 per catch, perfect (centre) catch doubles the combo.'
  };
}
