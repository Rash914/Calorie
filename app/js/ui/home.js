// Home: day navigation, calorie ring, macros, meals.
import { h, clear, fmt, todayKey, addDays, fmtDate, MEALS, MEAL_LABEL, MEAL_ICON } from '../util.js';
import * as store from '../store.js';
import * as calc from '../calc.js';
import { icon, ring, macroBar, emojiFor } from './components.js';
import { openFoodSheet, openQuickAdd, openEditEntry, openVoiceSheet } from './add.js';
import { navigate } from '../router.js';

export const state = { date: todayKey() };

export function render(root) {
  clear(root);
  const s = store.get();
  const date = state.date;
  const isToday = date === todayKey();
  const totals = store.dayTotals(date);
  const target = s.plan?.targetKcal || Math.round(calc.tdee(s.profile));
  const remaining = target - totals.k;
  const macros = calc.macroTargets(s.profile, target);
  const st = calc.streak(s.logs);

  // day nav
  root.append(h('div', { class: 'daynav' },
    h('button', { class: 'icon', 'aria-label': 'Previous day', onclick: () => { state.date = addDays(date, -1); render(root); } }, icon('left', 18)),
    h('button', { class: 'title', onclick: () => { state.date = todayKey(); render(root); }, title: 'Jump to today' }, isToday ? 'Today' : date === addDays(todayKey(), -1) ? 'Yesterday' : fmtDate(date), h('div', { class: 'muted small', style: { fontWeight: 600 } }, fmtDate(date, { weekday: 'long', day: 'numeric', month: 'long' }))),
    h('button', { class: 'icon', 'aria-label': 'Next day', disabled: isToday, style: { opacity: isToday ? .3 : 1 }, onclick: () => { if (!isToday) { state.date = addDays(date, 1); render(root); } } }, icon('right', 18))
  ));

  // hero ring
  const ringEl = ring({ value: totals.k, max: target });
  const over = remaining < 0;
  root.append(h('div', { class: 'card hero' },
    h('div', { class: 'row between' },
      h('div', null, h('div', { class: 'tiny', style: { opacity: .85, fontWeight: 700, letterSpacing: '.06em', textTransform: 'uppercase' } }, s.plan ? `${s.plan.label || 'Plan'} target` : 'Maintenance estimate'), h('div', { style: { fontSize: '22px', fontWeight: 800 } }, `${fmt(target)} kcal`)),
      h('div', { class: 'badge', style: { background: 'rgba(255,255,255,.2)', color: '#fff' } }, icon('flame', 14), ` ${st.current} day streak`)),
    h('div', { class: 'ring-wrap mt' }, ringEl,
      h('div', { class: 'ring-text' }, h('div', { class: 'val num' }, fmt(Math.abs(Math.round(remaining)))), h('div', { class: 'lbl' }, over ? 'kcal over' : 'kcal left'))),
    h('div', { class: 'hero-stats' },
      h('div', null, h('div', { class: 'v num' }, fmt(Math.round(totals.k))), h('div', { class: 'l' }, 'Eaten')),
      h('div', null, h('div', { class: 'v num' }, fmt(target)), h('div', { class: 'l' }, 'Target')),
      h('div', null, h('div', { class: 'v num' }, `${totals.n}`), h('div', { class: 'l' }, 'Items')))
  ));

  // macros
  root.append(h('div', { class: 'card mt' },
    h('div', { class: 'row between mb' }, h('h3', null, 'Macros'), h('span', { class: 'muted small' }, 'today vs target')),
    h('div', { class: 'col' },
      macroBar('Protein', totals.p, macros.p, 'p'), macroBar('Carbs', totals.cb, macros.cb, 'c'), macroBar('Fat', totals.f, macros.f, 'f'), macroBar('Fibre', totals.fb, macros.fb, 'fb'))
  ));

  // quick actions
  root.append(h('div', { class: 'row mt', style: { gap: '8px' } },
    h('button', { class: 'btn primary grow', onclick: () => openVoiceSheet({ date, onAdded: () => render(root) }) }, icon('mic', 18), 'Speak'),
    h('button', { class: 'btn secondary grow', onclick: () => navigate('log') }, icon('search', 18), 'Search'),
    h('button', { class: 'btn secondary grow', onclick: () => openQuickAdd({ date, onAdded: () => render(root) }) }, icon('plus', 18), 'Quick')
  ));

  // meals
  const entries = store.entriesFor(date);
  for (const m of MEALS) {
    const list = entries.filter((e) => e.meal === m).sort((a, b) => a.t - b.t);
    const k = list.reduce((a, e) => a + e.k, 0);
    const box = h('div', { class: 'meal' },
      h('div', { class: 'meal-head' }, h('span', null, MEAL_ICON[m]), h('span', { class: 't' }, MEAL_LABEL[m]), h('span', { class: 'k' }, list.length ? `${fmt(Math.round(k))} kcal` : ''),
        h('button', { class: 'add', 'aria-label': `Add to ${MEAL_LABEL[m]}`, onclick: () => navigate('log', { meal: m, date }) }, '+')));
    if (!list.length) box.append(h('div', { class: 'empty-row' }, `Nothing logged for ${MEAL_LABEL[m].toLowerCase()} yet.`));
    for (const e of list) {
      box.append(h('button', { class: 'item clickable', type: 'button', onclick: () => openEditEntry(date, e, { onDone: () => render(root) }) },
        h('div', { class: 'avatar' }, emojiFor(e.foodId ? (store.get().custom.find((c) => c.id === e.foodId)?.c || catOf(e.foodId)) : 'custom')),
        h('div', { class: 'grow' }, h('div', { class: 'name ellipsis' }, e.name), h('div', { class: 'sub ellipsis' }, `${e.unit || ''}${e.p || e.cb || e.f ? ` · P ${fmt(e.p, 0)} · C ${fmt(e.cb, 0)} · F ${fmt(e.f, 0)}` : ''}`)),
        h('div', { class: 'kcal' }, fmt(Math.round(e.k)), h('small', null, ' kcal'))));
    }
    root.append(box);
  }

  // insight
  const avg = calc.weeklyAverage(s.logs);
  if (avg) {
    const diff = avg - target;
    root.append(h('div', { class: 'card soft mt' }, h('div', { class: 'row' }, icon('trend', 20), h('div', null, h('div', { class: 'bold' }, `7-day average: ${fmt(avg)} kcal`), h('div', { class: 'muted small' }, Math.abs(diff) < 100 ? 'Right on target — keep going.' : diff > 0 ? `About ${fmt(diff)} kcal/day above target. Small swaps (chaas for lassi, roti for naan) add up.` : `About ${fmt(-diff)} kcal/day under target. Make sure you’re eating enough protein.`)))));
  }
}
import * as foods from '../foods.js';
function catOf(id) { return foods.getFood(id)?.c || 'custom'; }
export { openFoodSheet };
