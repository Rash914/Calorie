// Reusable UI pieces: icons, sheets, toasts, rings, bars, rows.
import { h, svg, clear, fmt, kcal as fk } from '../util.js';

// ---------------------------------------------------------------- icons (Feather-style paths)
const PATHS = {
  home: 'M3 11l9-8 9 8v9a2 2 0 0 1-2 2h-4v-6H9v6H5a2 2 0 0 1-2-2z',
  plus: 'M12 5v14M5 12h14',
  calendar: 'M3 5h18v16H3zM16 3v4M8 3v4M3 10h18',
  target: 'M12 22a10 10 0 1 0 0-20 10 10 0 0 0 0 20zM12 18a6 6 0 1 0 0-12 6 6 0 0 0 0 12zM12 14a2 2 0 1 0 0-4 2 2 0 0 0 0 4z',
  user: 'M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2M12 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8z',
  mic: 'M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3zM19 10v2a7 7 0 0 1-14 0v-2M12 19v4M8 23h8',
  search: 'M21 21l-4.35-4.35M11 19a8 8 0 1 0 0-16 8 8 0 0 0 0 16z',
  left: 'M15 18l-6-6 6-6',
  right: 'M9 18l6-6-6-6',
  x: 'M18 6L6 18M6 6l12 12',
  trash: 'M3 6h18M8 6V4h8v2M19 6l-1 14H6L5 6',
  edit: 'M12 20h9M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4z',
  check: 'M20 6L9 17l-5-5',
  flame: 'M12 22c4.4 0 8-3.1 8-7.5 0-3-1.5-5-3.5-7.5-.5 2-1.5 3-3 3.5C13.8 8 13 5 10 2c0 4-2 5.5-4 8-1.5 2-2 3-2 4.5C4 18.9 7.6 22 12 22z',
  scale: 'M12 3v18M3 8l4 8h-8zM21 8l4 8h-8zM3 8h18',
  settings: 'M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6zM19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z',
  download: 'M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M7 10l5 5 5-5M12 15V3',
  upload: 'M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M17 8l-5-5-5 5M12 3v12',
  keyboard: 'M2 6h20v12H2zM6 10h.01M10 10h.01M14 10h.01M18 10h.01M6 14h.01M18 14h.01M9 14h6',
  info: 'M12 22a10 10 0 1 0 0-20 10 10 0 0 0 0 20zM12 16v-4M12 8h.01',
  leaf: 'M11 20A7 7 0 0 1 9.8 6.1C15.5 5 17 4.5 21 2c-1 2-1.5 3.5-2 6-1 6-4 8-8 12zM2 22c2-6 5-9 9-11',
  star: 'M12 2l3.1 6.3 6.9 1-5 4.9 1.2 6.8L12 17.8 5.8 21l1.2-6.8-5-4.9 6.9-1z',
  sparkle: 'M12 3l1.8 5.2L19 10l-5.2 1.8L12 17l-1.8-5.2L5 10l5.2-1.8zM19 17l.8 2.2L22 20l-2.2.8L19 23l-.8-2.2L16 20l2.2-.8z',
  trend: 'M23 6l-9.5 9.5-5-5L1 18M17 6h6v6',
  moon: 'M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8z',
  sun: 'M12 17a5 5 0 1 0 0-10 5 5 0 0 0 0 10zM12 1v2M12 21v2M4.2 4.2l1.4 1.4M18.4 18.4l1.4 1.4M1 12h2M21 12h2M4.2 19.8l1.4-1.4M18.4 5.6l1.4-1.4',
  chevron: 'M6 9l6 6 6-6',
  refresh: 'M23 4v6h-6M1 20v-6h6M20.5 9A9 9 0 0 0 5.6 5.6L1 10M23 14l-4.6 4.4A9 9 0 0 1 3.5 15'
};
export function icon(name, size = 22) {
  const el = svg('svg', { viewBox: '0 0 24 24', width: size, height: size, fill: 'none', stroke: 'currentColor', 'stroke-width': 2, 'stroke-linecap': 'round', 'stroke-linejoin': 'round', 'aria-hidden': 'true' });
  el.append(svg('path', { d: PATHS[name] || PATHS.info }));
  return el;
}

// ---------------------------------------------------------------- toast
let toastWrap = null;
export function toast(msg, type = '', ms = 2600) {
  if (!toastWrap) { toastWrap = h('div', { class: 'toast-wrap', role: 'status', 'aria-live': 'polite' }); document.body.append(toastWrap); }
  const t = h('div', { class: `toast ${type}` }, msg);
  toastWrap.append(t);
  setTimeout(() => { t.style.opacity = '0'; t.style.transition = 'opacity .3s'; setTimeout(() => t.remove(), 300); }, ms);
}

// ---------------------------------------------------------------- sheet (bottom modal)
const openSheets = [];
export function sheet({ title, body, actions = [], onClose, wide = false }) {
  const content = h('div', { class: 'sheet', role: 'dialog', 'aria-modal': 'true', 'aria-label': title || 'Dialog' }, h('div', { class: 'grab' }));
  if (title) content.append(h('div', { class: 'row between' }, h('h2', null, title), h('button', { class: 'btn icon secondary', 'aria-label': 'Close', onclick: () => close() }, icon('x', 18))));
  const bodyEl = h('div', { class: 'sheet-body' });
  if (typeof body === 'function') body(bodyEl, { close }); else if (body) bodyEl.append(body);
  content.append(bodyEl);
  let actionsEl = null;
  if (actions.length) {
    actionsEl = h('div', { class: 'actions' }, ...actions.map((a) => h('button', { class: `btn ${a.kind || 'secondary'} ${a.block ? 'block' : ''} grow`, onclick: () => a.onClick?.({ close }), disabled: a.disabled }, a.label)));
    content.append(actionsEl);
  }
  const backdrop = h('div', { class: 'sheet-backdrop', onclick: (e) => { if (e.target === backdrop) close(); } }, content);
  if (wide) content.style.maxWidth = '820px';
  const prevFocus = document.activeElement;
  function onKey(e) { if (e.key === 'Escape') close(); }
  function close(result) {
    backdrop.remove();
    document.removeEventListener('keydown', onKey);
    openSheets.splice(openSheets.indexOf(api), 1);
    if (!openSheets.length) document.body.style.overflow = '';
    onClose?.(result);
    prevFocus?.focus?.();
  }
  document.addEventListener('keydown', onKey);
  document.body.append(backdrop);
  document.body.style.overflow = 'hidden';
  const api = { close, el: content, body: bodyEl, actions: actionsEl };
  openSheets.push(api);
  const first = content.querySelector('input, button.primary, select');
  setTimeout(() => first?.focus?.({ preventScroll: true }), 50);
  return api;
}
export function closeAllSheets() { [...openSheets].forEach((s) => s.close()); }

export function confirm({ title, message, okLabel = 'Confirm', danger = false }) {
  return new Promise((resolve) => {
    let done = false;
    sheet({
      title, body: h('p', { class: 'muted' }, message),
      actions: [
        { label: 'Cancel', onClick: ({ close }) => { done = true; close(); resolve(false); } },
        { label: okLabel, kind: danger ? 'danger' : 'primary', onClick: ({ close }) => { done = true; close(); resolve(true); } }
      ],
      onClose: () => { if (!done) resolve(false); }
    });
  });
}

// ---------------------------------------------------------------- ring
export function ring({ value, max, size = 210, stroke = 14 }) {
  const r = (size - stroke) / 2, c = 2 * Math.PI * r;
  const pct = max > 0 ? Math.min(1, Math.max(0, value / max)) : 0;
  const over = max > 0 && value > max;
  const el = svg('svg', { viewBox: `0 0 ${size} ${size}` },
    svg('circle', { class: 'track', cx: size / 2, cy: size / 2, r }),
    svg('circle', { class: `prog ${over ? 'over' : ''}`, cx: size / 2, cy: size / 2, r, 'stroke-dasharray': c, 'stroke-dashoffset': c })
  );
  requestAnimationFrame(() => requestAnimationFrame(() => { el.querySelector('.prog').setAttribute('stroke-dashoffset', String(c * (1 - pct))); }));
  return el;
}

export function macroBar(label, value, target, cls) {
  const pct = target > 0 ? Math.min(100, (value / target) * 100) : 0;
  const over = target > 0 && value > target * 1.1;
  const fill = h('i', { class: `${cls} ${over ? 'over' : ''}` });
  requestAnimationFrame(() => { fill.style.width = pct + '%'; });
  return h('div', { class: 'macro' },
    h('div', { class: 'lbl' }, h('span', null, label), h('span', { class: 'num' }, `${fmt(Math.round(value))}`, h('span', { class: 'faint' }, ` / ${fmt(target)} g`))),
    h('div', { class: 'bar' }, fill)
  );
}

export function vegDot(v) { return h('i', { class: `veg-dot v${v || 1}`, title: v === 3 ? 'Non-veg' : v === 2 ? 'Contains egg' : 'Veg' }); }

export function foodRow(food, { sub, onClick, right } = {}) {
  const def = food.s?.[0];
  const perServ = def ? Math.round((food.k * def[1]) / 100) : food.k;
  return h('button', { class: 'item clickable', onclick: onClick, type: 'button' },
    h('div', { class: 'avatar' }, emojiFor(food.c)),
    h('div', { class: 'grow' },
      h('div', { class: 'row', style: { gap: '6px' } }, vegDot(food.v), h('span', { class: 'name ellipsis' }, food.n)),
      h('div', { class: 'sub ellipsis' }, sub ?? `${def ? def[0] : '100 g'} · P ${fmt(food.p * (def ? def[1] : 100) / 100, 1)}g`)),
    right ?? h('div', { class: 'kcal' }, fmt(perServ), h('small', null, ' kcal'))
  );
}

const EMOJI = { breads: '🫓', rice: '🍚', breakfast: '🥣', south: '🥞', dal: '🍲', vegcurry: '🥘', nonveg: '🍗', eggs: '🥚', snacks: '🥟', chinese: '🍜', fastfood: '🍔', sweets: '🍮', beverages: '🥤', dairy: '🥛', fruits: '🍎', vegetables: '🥗', nuts: '🥜', packaged: '🍪', fitness: '💪', condiments: '🫙', raw: '🌾', regional: '🍛', meat: '🥩', spices: '🌿', oils: '🫗', custom: '⭐' };
export function emojiFor(cat) { return EMOJI[cat] || '🍽️'; }

export function stepper({ value = 1, min = 0.25, step = 0.5, onChange }) {
  const input = h('input', { type: 'number', inputmode: 'decimal', min: String(min), step: 'any', value: String(value), 'aria-label': 'Quantity' });
  const set = (v) => { v = Math.max(min, Math.round(v * 100) / 100); input.value = String(v); onChange?.(v); };
  input.addEventListener('input', () => { const v = parseFloat(input.value); if (Number.isFinite(v) && v >= min) onChange?.(Math.min(1000, v)); });
  input.addEventListener('blur', () => { const v = parseFloat(input.value); if (!Number.isFinite(v) || v < min) set(min); });
  return h('div', { class: 'stepper' },
    h('button', { type: 'button', 'aria-label': 'Decrease', onclick: () => set((parseFloat(input.value) || 1) - step) }, '−'),
    input,
    h('button', { type: 'button', 'aria-label': 'Increase', onclick: () => set((parseFloat(input.value) || 0) + step) }, '+')
  );
}

export function segmented(options, value, onChange) {
  const el = h('div', { class: 'seg', role: 'tablist' });
  const render = () => { clear(el); for (const o of options) el.append(h('button', { type: 'button', role: 'tab', class: o.value === value ? 'active' : '', 'aria-selected': o.value === value ? 'true' : 'false', onclick: () => { value = o.value; render(); onChange(value); } }, o.label)); };
  render();
  return el;
}

export function field(label, control) { return h('div', { class: 'field' }, h('label', null, label), control); }

export function kcalText(n) { return fk(n); }
