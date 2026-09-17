// Calendar: month grid coloured by intake vs target, streaks, 14-day chart, day detail.
import { h, svg, clear, fmt, todayKey, addDays, parseKey, fmtDate, MEAL_LABEL, MEAL_ICON } from '../util.js';
import * as store from '../store.js';
import * as calc from '../calc.js';
import { icon } from './components.js';
import { navigate } from '../router.js';
import { state as homeState } from './home.js';

export const state = { month: null, selected: todayKey() };
const DOW = ['Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa', 'Su'];

function monthKey(d) { return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`; }

export function render(root) {
  clear(root);
  const s = store.get();
  const target = s.plan?.targetKcal || Math.round(calc.tdee(s.profile));
  const today = todayKey();
  if (!state.month) state.month = monthKey(new Date());
  const [y, m] = state.month.split('-').map(Number);
  const first = new Date(y, m - 1, 1);
  const st = calc.streak(s.logs);
  const onT = calc.onTargetDays(s.logs, target, 30);

  root.append(h('div', { class: 'stat-grid' },
    h('div', { class: 'stat' }, h('div', { class: 'v', style: { color: 'var(--orange)' } }, `🔥 ${st.current}`), h('div', { class: 'l' }, 'Day streak')),
    h('div', { class: 'stat' }, h('div', { class: 'v' }, `${st.best}`), h('div', { class: 'l' }, 'Best streak')),
    h('div', { class: 'stat' }, h('div', { class: 'v', style: { color: 'var(--green-deep)' } }, `${onT.hit}/${onT.logged}`), h('div', { class: 'l' }, 'On target (30d)'))
  ));

  // month grid
  const card = h('div', { class: 'card mt' });
  card.append(h('div', { class: 'cal-head' },
    h('button', { class: 'btn icon secondary', 'aria-label': 'Previous month', onclick: () => { state.month = monthKey(new Date(y, m - 2, 1)); render(root); } }, icon('left', 18)),
    h('h3', null, first.toLocaleDateString('en-IN', { month: 'long', year: 'numeric' })),
    h('button', { class: 'btn icon secondary', 'aria-label': 'Next month', onclick: () => { state.month = monthKey(new Date(y, m, 1)); render(root); } }, icon('right', 18))));
  const grid = h('div', { class: 'cal-grid' }, ...DOW.map((d) => h('div', { class: 'dow' }, d)));
  const startOffset = (first.getDay() + 6) % 7; // Monday first
  const daysInMonth = new Date(y, m, 0).getDate();
  for (let i = 0; i < startOffset; i++) grid.append(h('div'));
  for (let d = 1; d <= daysInMonth; d++) {
    const key = `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
    const list = s.logs[key];
    const k = list?.length ? Math.round(list.reduce((a, e) => a + e.k, 0)) : 0;
    const cls = key > today ? 'future' : !list?.length ? '' : k > target * 1.05 ? 'over' : k < target * 0.6 ? 'under' : 'ok';
    grid.append(h('button', { class: `cal-day ${cls} ${key === today ? 'today' : ''} ${key === state.selected ? 'selected' : ''}`, 'aria-label': `${fmtDate(key)}${k ? `, ${k} kcal` : ''}`, onclick: () => { state.selected = key; render(root); } },
      h('span', null, String(d)), k ? h('span', { class: 'k num' }, fmt(k)) : null));
  }
  card.append(grid);
  card.append(h('div', { class: 'legend' },
    h('span', null, h('i', { style: { background: 'color-mix(in srgb, var(--green) 22%, var(--surface))' } }), 'within target'),
    h('span', null, h('i', { style: { background: 'color-mix(in srgb, var(--amber) 28%, var(--surface))' } }), 'over'),
    h('span', null, h('i', { style: { background: 'color-mix(in srgb, var(--blue) 14%, var(--surface))' } }), 'well under'),
    h('span', null, h('i', { style: { background: 'var(--surface-2)', border: '1px solid var(--line)' } }), 'not logged')));
  root.append(card);

  // selected day detail
  const sel = state.selected;
  const list = (s.logs[sel] || []).slice().sort((a, b) => a.t - b.t);
  const t = store.dayTotals(sel);
  const detail = h('div', { class: 'card mt' },
    h('div', { class: 'row between' }, h('h3', null, fmtDate(sel, { weekday: 'long', day: 'numeric', month: 'long' })),
      h('button', { class: 'btn sm secondary', onclick: () => { homeState.date = sel; navigate('home'); } }, 'Open day', icon('right', 14))));
  if (!list.length) detail.append(h('div', { class: 'empty small' }, 'No entries for this day.'));
  else {
    detail.append(h('div', { class: 'row wrap mt', style: { gap: '6px' } },
      h('span', { class: `badge ${t.k > target * 1.05 ? 'amber' : t.k < target * 0.6 ? 'blue' : 'green'}` }, `${fmt(Math.round(t.k))} / ${fmt(target)} kcal`),
      h('span', { class: 'badge gray' }, `P ${fmt(t.p)}g`), h('span', { class: 'badge gray' }, `C ${fmt(t.cb)}g`), h('span', { class: 'badge gray' }, `F ${fmt(t.f)}g`)));
    const byMeal = {};
    for (const e of list) (byMeal[e.meal] = byMeal[e.meal] || []).push(e);
    for (const [meal, items] of Object.entries(byMeal)) {
      detail.append(h('div', { class: 'muted small bold mt' }, `${MEAL_ICON[meal]} ${MEAL_LABEL[meal]}`));
      for (const e of items) detail.append(h('div', { class: 'item', style: { padding: '8px 0' } }, h('div', { class: 'grow' }, h('div', { class: 'name' }, e.name), h('div', { class: 'sub' }, e.unit || '')), h('div', { class: 'kcal' }, fmt(Math.round(e.k)), h('small', null, ' kcal'))));
    }
  }
  root.append(detail);

  // 14-day chart
  root.append(h('div', { class: 'card mt chart' }, h('div', { class: 'row between mb' }, h('h3', null, 'Last 14 days'), h('span', { class: 'muted small' }, `target ${fmt(target)}`)), barChart(s.logs, target, 14)));
}

function barChart(logs, target, n) {
  const W = 600, H = 200, padL = 40, padB = 26, padT = 12;
  const today = todayKey();
  const days = Array.from({ length: n }, (_, i) => addDays(today, -(n - 1 - i)));
  const vals = days.map((k) => (logs[k] || []).reduce((a, e) => a + e.k, 0));
  const max = Math.max(target * 1.3, ...vals, 100);
  const el = svg('svg', { viewBox: `0 0 ${W} ${H}`, role: 'img', 'aria-label': 'Daily calories, last 14 days' });
  const y = (v) => padT + (H - padT - padB) * (1 - v / max);
  const bw = (W - padL - 8) / n;
  // gridlines
  for (const v of [0, max / 2, max]) {
    el.append(svg('line', { x1: padL, x2: W, y1: y(v), y2: y(v), stroke: 'var(--line)', 'stroke-width': 1 }));
    el.append(svg('text', { x: padL - 6, y: y(v) + 4, 'text-anchor': 'end', 'font-size': 11, fill: 'var(--faint)' }, fmt(Math.round(v))));
  }
  days.forEach((k, i) => {
    const v = vals[i];
    const x = padL + i * bw + 4;
    const hgt = v ? Math.max(3, y(0) - y(v)) : 0;
    const fill = !v ? 'var(--line)' : v > target * 1.05 ? 'var(--amber)' : v < target * 0.6 ? 'var(--blue-2)' : 'var(--green)';
    if (v) el.append(svg('rect', { x, y: y(v), width: bw - 8, height: hgt, rx: 5, fill }));
    else el.append(svg('rect', { x, y: y(0) - 3, width: bw - 8, height: 3, rx: 1.5, fill }));
    const d = parseKey(k);
    if (i % 2 === (n - 1) % 2) el.append(svg('text', { x: x + (bw - 8) / 2, y: H - 8, 'text-anchor': 'middle', 'font-size': 11, fill: 'var(--muted)' }, `${d.getDate()}/${d.getMonth() + 1}`));
  });
  el.append(svg('line', { x1: padL, x2: W, y1: y(target), y2: y(target), stroke: 'var(--blue)', 'stroke-width': 1.5, 'stroke-dasharray': '6 4' }));
  return el;
}
