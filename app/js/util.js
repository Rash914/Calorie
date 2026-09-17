// Small DOM + formatting helpers. All user-facing text is set via textContent / DOM nodes — never innerHTML.

/** Create an element: h('div', {class:'x', onclick: fn, dataset:{...}, attrs...}, ...children) */
export function h(tag, props = null, ...children) {
  const el = document.createElement(tag);
  if (props) {
    for (const [k, v] of Object.entries(props)) {
      if (v == null || v === false) continue;
      if (k === 'class') el.className = v;
      else if (k === 'style') { if (typeof v !== 'object') throw new Error('style must be an object (CSP forbids style attributes)'); Object.assign(el.style, v); }
      else if (k === 'dataset') Object.assign(el.dataset, v);
      else if (k.startsWith('on') && typeof v === 'function') el.addEventListener(k.slice(2).toLowerCase(), v);
      else if (k === 'html') throw new Error('innerHTML is not allowed');
      else if (k in el && k !== 'list' && k !== 'form' && typeof v !== 'object') el[k] = v;
      else el.setAttribute(k, v === true ? '' : String(v));
    }
  }
  append(el, children);
  return el;
}

/** SVG element helper */
export function svg(tag, attrs = {}, ...children) {
  const el = document.createElementNS('http://www.w3.org/2000/svg', tag);
  for (const [k, v] of Object.entries(attrs)) if (v != null) el.setAttribute(k, String(v));
  append(el, children);
  return el;
}

function append(el, children) {
  for (const c of children.flat(Infinity)) {
    if (c == null || c === false) continue;
    el.append(c instanceof Node ? c : document.createTextNode(String(c)));
  }
}

export function clear(el) { while (el.firstChild) el.removeChild(el.firstChild); }

export const $ = (sel, root = document) => root.querySelector(sel);

export function fmt(n, d = 0) {
  if (!Number.isFinite(n)) return '–';
  return n.toLocaleString('en-IN', { maximumFractionDigits: d, minimumFractionDigits: 0 });
}
export const kcal = (n) => `${fmt(Math.round(n))} kcal`;
export const g = (n, d = 0) => `${fmt(n, d)} g`;

export function todayKey(d = new Date()) {
  const y = d.getFullYear(), m = String(d.getMonth() + 1).padStart(2, '0'), dd = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${dd}`;
}
export function parseKey(key) { const [y, m, d] = key.split('-').map(Number); return new Date(y, m - 1, d); }
export function addDays(key, n) { const d = parseKey(key); d.setDate(d.getDate() + n); return todayKey(d); }
export function fmtDate(key, opts = { weekday: 'short', day: 'numeric', month: 'short' }) {
  return parseKey(key).toLocaleDateString('en-IN', opts);
}
export function fmtTime(ts) { return new Date(ts).toLocaleTimeString('en-IN', { hour: 'numeric', minute: '2-digit' }); }

export function uid() {
  if (crypto?.randomUUID) return crypto.randomUUID();
  const a = new Uint8Array(16); crypto.getRandomValues(a);
  return [...a].map((b) => b.toString(16).padStart(2, '0')).join('');
}

export function debounce(fn, ms) { let t; return (...a) => { clearTimeout(t); t = setTimeout(() => fn(...a), ms); }; }
export const clamp = (n, lo, hi) => Math.min(hi, Math.max(lo, n));
export const round = (n, d = 0) => { const p = 10 ** d; return Math.round(n * p) / p; };

/** Meal slot by hour */
export function mealForHour(hr) {
  if (hr < 11) return 'breakfast';
  if (hr < 15) return 'lunch';
  if (hr < 19) return 'snacks';
  return 'dinner';
}
export const MEALS = ['breakfast', 'lunch', 'snacks', 'dinner'];
export const MEAL_LABEL = { breakfast: 'Breakfast', lunch: 'Lunch', snacks: 'Snacks', dinner: 'Dinner' };
export const MEAL_ICON = { breakfast: '🌅', lunch: '☀️', snacks: '🍵', dinner: '🌙' };

/** Simple pub/sub */
export function emitter() {
  const subs = new Map();
  return {
    on(ev, fn) { (subs.get(ev) || subs.set(ev, new Set()).get(ev)).add(fn); return () => subs.get(ev)?.delete(fn); },
    emit(ev, data) { subs.get(ev)?.forEach((fn) => { try { fn(data); } catch (e) { console.error(e); } }); }
  };
}
