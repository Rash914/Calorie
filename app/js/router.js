// Tiny hash router: #home, #log, #calendar, #plan, #me
import { emitter } from './util.js';
export const VIEWS = ['home', 'log', 'calendar', 'plan', 'me'];
export const bus = emitter();
let params = {};
export function current() {
  const hsh = (location.hash || '#home').slice(1).split('?')[0];
  return VIEWS.includes(hsh) ? hsh : 'home';
}
export function navigate(view, p = {}) {
  params = p;
  if (current() === view) bus.emit('route', { view, params });
  else location.hash = '#' + view;
}
export function getParams() { const p = params; params = {}; return p; }
window.addEventListener('hashchange', () => bus.emit('route', { view: current(), params }));
