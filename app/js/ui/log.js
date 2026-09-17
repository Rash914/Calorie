// Log view: search & browse the food database, recent foods, my foods.
import { h, clear, fmt, todayKey, debounce, MEAL_LABEL } from '../util.js';
import * as store from '../store.js';
import * as foods from '../foods.js';
import { icon, foodRow, toast } from './components.js';
import { openFoodSheet, openQuickAdd, openCustomFood, openVoiceSheet } from './add.js';
import { confirm } from './components.js';
import { searchOnline } from '../off.js';

export const state = { query: '', cat: null };

export function render(root, params = {}) {
  clear(root);
  const date = params.date || todayKey();
  const meal = params.meal || null;
  const s = store.get();
  const input = h('input', { class: 'input', placeholder: 'Search 2,000+ Indian foods… (roti, दाल, biryani)', value: state.query, autocomplete: 'off', 'aria-label': 'Search foods' });
  const lead = icon('search', 20); lead.setAttribute('class', 'lead');
  const mic = h('button', { class: 'mic', 'aria-label': 'Voice input', onclick: () => openVoiceSheet({ date, onAdded: () => render(root, params) }) }, icon('mic', 20));
  root.append(h('div', { class: 'search' }, lead, input, mic));
  if (meal) root.append(h('div', { class: 'muted small mt' }, `Adding to ${MEAL_LABEL[meal]}`));

  const cats = foods.categories();
  const chips = h('div', { class: 'chips mt' },
    h('button', { class: `chip ${!state.cat ? 'active' : ''}`, onclick: () => { state.cat = null; run(); } }, 'All'),
    h('button', { class: `chip ${state.cat === '__recent' ? 'active' : ''}`, onclick: () => { state.cat = '__recent'; run(); } }, '🕘 Recent'),
    h('button', { class: `chip ${state.cat === '__mine' ? 'active' : ''}`, onclick: () => { state.cat = '__mine'; run(); } }, '⭐ My foods'),
    ...Object.entries(cats).map(([k, v]) => h('button', { class: `chip ${state.cat === k ? 'active' : ''}`, onclick: () => { state.cat = k; run(); } }, v))
  );
  root.append(chips);
  const list = h('div', { class: 'card list mt', style: { padding: '4px 12px' } });
  root.append(list);
  root.append(h('div', { class: 'row mt', style: { gap: '8px' } },
    h('button', { class: 'btn secondary grow', onclick: () => openQuickAdd({ date, meal, onAdded: () => render(root, params) }) }, icon('plus', 18), 'Quick add (label)'),
    h('button', { class: 'btn secondary grow', onclick: () => openCustomFood({ onSaved: () => { state.cat = '__mine'; run(); } }) }, icon('star', 18), 'New custom food')
  ));

  function run() {
    state.query = input.value.trim();
    // refresh chip states
    chips.querySelectorAll('.chip').forEach((c, i) => c.classList.toggle('active', (i === 0 && !state.cat) || (i === 1 && state.cat === '__recent') || (i === 2 && state.cat === '__mine') || (i > 2 && Object.keys(cats)[i - 3] === state.cat)));
    clear(list);
    const diet = s.settings.diet;
    let items = [];
    let title = '';
    if (state.query) {
      items = foods.search(state.query, { limit: 60, diet, recent: s.recent }).map((r) => r.food);
      if (state.cat && !state.cat.startsWith('__')) items = items.filter((f) => f.c === state.cat);
      if (state.cat === '__mine') items = items.filter((f) => f.src === 'custom');
      title = `${items.length} result${items.length === 1 ? '' : 's'}`;
    } else if (state.cat === '__recent') {
      items = s.recent.map((id) => foods.getFood(id)).filter(Boolean);
      title = 'Recently logged';
    } else if (state.cat === '__mine') {
      items = s.custom;
      title = 'My foods';
    } else if (state.cat) {
      items = foods.byCategory(state.cat).filter((f) => diet === 'all' || (diet === 'veg' ? f.v === 1 : f.v !== 3));
      title = cats[state.cat];
    } else {
      items = s.recent.map((id) => foods.getFood(id)).filter(Boolean).slice(0, 8);
      title = items.length ? 'Recent' : '';
      if (!items.length) {
        items = ['chapati', 'rice-white', 'dal-tadka', 'chai', 'boiled-egg', 'curd', 'banana', 'poha', 'idli', 'paneer-butter-masala', 'chicken-curry', 'samosa'].map(foods.getFood).filter(Boolean);
        title = 'Popular';
      }
    }
    if (title) list.append(h('div', { class: 'row between', style: { padding: '10px 4px 4px' } }, h('span', { class: 'muted small bold' }, title), state.query ? h('span', { class: 'faint tiny' }, 'tap a food to set portion') : null));
    if (!items.length) {
      list.append(h('div', { class: 'empty' }, h('div', { class: 'big' }, '🍽️'), h('div', null, state.cat === '__mine' ? 'No custom foods yet.' : 'No matches.'), h('div', { class: 'small mt' }, 'Try another spelling, or use Quick add with the calories from the label.')));
      if (state.query) list.append(onlineButton());
      return;
    }
    for (const f of items.slice(0, 80)) {
      const row = foodRow(f, { onClick: () => openFoodSheet(f, { date, meal, onAdded: () => { /* stay here for multi-add */ } }) });
      if (f.src === 'custom') {
        row.append(h('button', { class: 'btn icon secondary', 'aria-label': 'Delete custom food', onclick: async (e) => { e.stopPropagation(); if (await confirm({ title: 'Delete custom food?', message: `Remove "${f.n}" from My foods. Past log entries stay.`, okLabel: 'Delete', danger: true })) { store.removeCustomFood(f.id); toast('Deleted'); run(); } } }, icon('trash', 16)));
      }
      list.append(row);
    }
    if (items.length > 80) list.append(h('div', { class: 'muted small center', style: { padding: '10px' } }, `Showing 80 of ${items.length} — refine your search`));
    if (state.query) list.append(onlineButton());
  }
  // Open Food Facts fallback (packaged / branded products); results save as custom foods when logged
  function onlineButton() {
    const wrap = h('div', { style: { padding: '8px 4px 12px' } });
    const btn = h('button', { class: 'btn secondary block', type: 'button', onclick: async () => {
      if (!navigator.onLine) { toast('You are offline — online search needs internet', 'error'); return; }
      btn.disabled = true; btn.textContent = 'Searching Open Food Facts…';
      try {
        const res = await searchOnline(state.query);
        clear(wrap);
        if (!res.length) { wrap.append(h('div', { class: 'muted small center' }, 'Nothing found online for this name.')); return; }
        wrap.append(h('div', { class: 'row between', style: { padding: '6px 4px' } }, h('span', { class: 'muted small bold' }, `Online results · Open Food Facts`), h('span', { class: 'faint tiny' }, 'label values, per pack')));
        for (const f of res) wrap.append(foodRow(f, { sub: `${f.s[0][0]} · P ${fmt(f.p * f.s[0][1] / 100, 1)}g${f.india ? ' · 🇮🇳' : ''}`, onClick: () => {
          const saved = store.addCustomFood({ n: f.n, v: f.v, k: f.k, p: f.p, cb: f.cb, f: f.f, fb: f.fb, s: f.s });
          openFoodSheet(foods.getFood(saved.id) || saved, { date, meal, onAdded: () => {} });
        } }));
      } catch (e) { btn.disabled = false; btn.textContent = 'Search online (Open Food Facts)'; toast(e.message || 'Online search failed', 'error'); }
    } }, icon('search', 16), 'Search online (Open Food Facts)');
    wrap.append(btn, h('div', { class: 'faint tiny center', style: { marginTop: '6px' } }, 'For packaged / branded items not in our list. Uses internet; the food is saved to My foods once you log it.'));
    return wrap;
  }
  input.addEventListener('input', debounce(run, 110));
  input.addEventListener('keydown', (e) => { if (e.key === 'Enter') { const first = list.querySelector('.item'); first?.click(); } });
  run();
  if (!state.query) setTimeout(() => input.focus({ preventScroll: true }), 60);
}
