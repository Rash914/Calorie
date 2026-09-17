// Adding food: search, food detail sheet, quick add, custom food, edit entry, voice / natural-language sheet.
import { h, clear, fmt, todayKey, mealForHour, MEALS, MEAL_LABEL, MEAL_ICON, debounce, round } from '../util.js';
import * as store from '../store.js';
import * as foods from '../foods.js';
import * as speech from '../speech.js';
import { parse, resolve } from '../parser.js';
import { sheet, toast, icon, foodRow, stepper, segmented, field, vegDot, emojiFor } from './components.js';

const mealSeg = (value, onChange) => segmented(MEALS.map((m) => ({ value: m, label: `${MEAL_ICON[m]} ${MEAL_LABEL[m]}` })), value, onChange);

/** Open the detail sheet for a food and add it to the log. */
export function openFoodSheet(food, { date = todayKey(), meal, onAdded } = {}) {
  meal = meal || mealForHour(new Date().getHours());
  const servings = [...(food.s || [['1 serving (100 g)', 100]]), ['100 g', 100]];
  let servIdx = 0, qty = 1;
  const totals = h('div', { class: 'grid-3 mt' });
  const kcalBig = h('div', { class: 'row between mt' });
  const perLine = h('div', { class: 'muted small' });
  function grams() { return servings[servIdx][1] * qty; }
  function render() {
    const n = foods.nutrientsFor(food, grams());
    clear(kcalBig);
    kcalBig.append(h('div', null, h('div', { class: 'num', style: { fontSize: '34px', fontWeight: 800, letterSpacing: '-0.02em' } }, fmt(Math.round(n.k)), h('span', { class: 'muted', style: { fontSize: '14px', fontWeight: 700 } }, ' kcal')), perLine),
      h('span', { class: 'badge blue' }, `${fmt(grams())} g`));
    perLine.textContent = `${Math.round(food.k)} kcal per 100 g · ${food.edited ? 'edited by you' : sourceLabel(food)}`;
    clear(totals);
    for (const [lbl, v, cls] of [['Protein', n.p, 'p'], ['Carbs', n.cb, 'c'], ['Fat', n.f, 'f']]) {
      totals.append(h('div', { class: 'stat' }, h('div', { class: 'v', style: { fontSize: '18px' } }, fmt(v, 1), h('span', { class: 'muted small' }, ' g')), h('div', { class: 'l' }, lbl)));
    }
  }
  const servSel = h('select', { class: 'input', 'aria-label': 'Serving size', onchange: (e) => { servIdx = +e.target.value; render(); } }, ...servings.map((s, i) => h('option', { value: String(i) }, s[0])));
  const gramsInput = h('input', { class: 'input', type: 'number', inputmode: 'decimal', placeholder: 'grams', 'aria-label': 'Custom grams' });
  gramsInput.addEventListener('input', () => { const v = parseFloat(gramsInput.value); if (Number.isFinite(v) && v > 0 && v <= 20000) { servIdx = servings.length - 1; servSel.value = String(servIdx); qty = v / 100; qtyEl.querySelector('input').value = String(round(qty, 2)); render(); } });
  const qtyEl = stepper({ value: 1, onChange: (v) => { qty = v; render(); } });
  const s = sheet({
    title: null,
    body: (el) => {
      el.append(
        h('div', { class: 'row' }, h('div', { class: 'avatar', style: { width: '52px', height: '52px', fontSize: '26px' } }, emojiFor(food.c)),
          h('div', { class: 'grow' }, h('div', { class: 'row', style: { gap: '6px' } }, vegDot(food.v), h('h2', { style: { fontSize: '17px', margin: 0 } }, food.n)), h('div', { class: 'muted small' }, foods.categories()[food.c] || 'Custom food'))),
        kcalBig,
        h('div', { class: 'grid-2 mt' }, field('Serving', servSel), field('Quantity', qtyEl)),
        h('div', { class: 'mt' }, field('Or exact amount (g / ml)', gramsInput)),
        totals,
        h('div', { class: 'row between mt' },
          h('span', { class: 'muted small' }, food.edited ? 'Edited on this device' : 'Values not right for your version?'),
          h('button', { class: 'btn sm secondary', type: 'button', onclick: () => { s.close(); openEditNutrition(food, { onDone: () => openFoodSheet(foods.getFood(food.id) || food, { date, meal, onAdded }) }); } }, icon('edit', 14), food.edited ? 'Edit / reset' : 'Edit nutrition')),
        h('div', { class: 'mt' }, field('Meal', mealSeg(meal, (v) => { meal = v; })))
      );
      render();
    },
    actions: [
      { label: 'Cancel', onClick: ({ close }) => close() },
      { label: 'Add to log', kind: 'primary', onClick: ({ close }) => {
        const n = foods.nutrientsFor(food, grams());
        const label = servIdx === servings.length - 1 ? `${fmt(grams())} g` : `${round(qty, 2)} × ${servings[servIdx][0]}`;
        store.addEntry(date, { meal, name: food.n, foodId: food.id, qty, unit: label, g: grams(), k: n.k, p: n.p, cb: n.cb, f: n.f, fb: n.fb, src: food.src === 'custom' ? 'custom' : 'db' });
        toast(`Added ${food.n} · ${fmt(Math.round(n.k))} kcal`, 'success');
        close(); onAdded?.();
      } }
    ]
  });
  return s;
}
/** Edit the nutrition of a preloaded food (saved as a per-device override) or a custom food. */
export function openEditNutrition(food, { onDone } = {}) {
  const serv = (food.s || [['100 g', 100]])[0];
  const g = serv[1];
  const per = (v) => Math.round((v * g) / 100 * 10) / 10;
  const mk = (v) => h('input', { class: 'input', type: 'number', inputmode: 'decimal', min: 0, step: 'any', value: String(per(v)) });
  const k = mk(food.k), pr = mk(food.p), cb = mk(food.cb), f = mk(food.f), fb = mk(food.fb || 0);
  const name = h('input', { class: 'input', value: food.n, maxlength: 80 });
  const isCustom = food.src === 'custom';
  const base = isCustom ? null : foods.baseFood(food.id);
  const actions = [{ label: 'Cancel', onClick: ({ close }) => close() }];
  if (!isCustom && food.edited) actions.push({ label: 'Reset', kind: 'danger', onClick: ({ close }) => { store.clearOverride(food.id); toast('Restored original values'); close(); onDone?.(); } });
  actions.push({ label: 'Save', kind: 'primary', onClick: ({ close }) => {
    const nums = [k, pr, cb, f, fb].map((i) => parseFloat(i.value));
    if (nums.some((n) => !Number.isFinite(n) || n < 0)) { toast('Enter valid numbers', 'error'); return; }
    const scale = 100 / g;
    const vals = { k: nums[0] * scale, p: nums[1] * scale, cb: nums[2] * scale, f: nums[3] * scale, fb: nums[4] * scale };
    const nm = name.value.trim() || food.n;
    if (isCustom) store.update((st) => { const c = st.custom.find((x) => x.id === food.id); if (c) Object.assign(c, vals, { n: nm }); });
    else store.setOverride(food.id, { ...vals, n: nm !== base?.n ? nm : undefined });
    toast('Saved for this device', 'success'); close(); onDone?.();
  } });
  sheet({
    title: 'Edit nutrition',
    body: (el) => el.append(
      h('p', { class: 'muted small mb' }, `Values per ${serv[0]}. Your edit replaces the preloaded values on this device (search, voice and logging all use it). Backups include it.`),
      field('Name', name),
      h('div', { class: 'grid-2 mt' }, field('Calories (kcal)', k), field('Protein (g)', pr)),
      h('div', { class: 'grid-3 mt' }, field('Carbs (g)', cb), field('Fat (g)', f), field('Fibre (g)', fb)),
      base ? h('p', { class: 'faint tiny mt' }, `Original: ${fmt(per(base.k))} kcal · P ${fmt(per(base.p), 1)} · C ${fmt(per(base.cb), 1)} · F ${fmt(per(base.f), 1)}`) : null
    ),
    actions
  });
}
function sourceLabel(f) { return f.src === 'ifct' ? 'IFCT 2017 (NIN)' : f.src === 'indb' ? 'INDB recipe' : f.src === 'nh' ? 'Textbook-aligned' : f.src === 'custom' ? 'Your food' : 'Curated'; }

/** Quick add: name + calories (+ optional macros) */
export function openQuickAdd({ date = todayKey(), meal, onAdded, preset } = {}) {
  meal = meal || mealForHour(new Date().getHours());
  const name = h('input', { class: 'input', placeholder: 'e.g. Protein shake', maxlength: 80, value: preset?.name || '' });
  const k = h('input', { class: 'input lg', type: 'number', inputmode: 'decimal', placeholder: 'kcal', min: 0, value: preset?.k ?? '' });
  const p = h('input', { class: 'input', type: 'number', inputmode: 'decimal', placeholder: 'protein g', min: 0 });
  const c = h('input', { class: 'input', type: 'number', inputmode: 'decimal', placeholder: 'carbs g', min: 0 });
  const f = h('input', { class: 'input', type: 'number', inputmode: 'decimal', placeholder: 'fat g', min: 0 });
  const save = h('input', { type: 'checkbox', id: 'qa-save' });
  sheet({
    title: 'Quick add (from label)',
    body: (el) => el.append(
      h('p', { class: 'muted small mb' }, 'Type what the pack says. Macros are optional.'),
      field('Name', name), h('div', { class: 'mt' }, field('Calories', k)),
      h('div', { class: 'grid-3 mt' }, field('Protein', p), field('Carbs', c), field('Fat', f)),
      h('div', { class: 'mt' }, field('Meal', mealSeg(meal, (v) => { meal = v; }))),
      h('label', { class: 'row mt', for: 'qa-save' }, save, h('span', { class: 'small' }, 'Save as my food for next time'))
    ),
    actions: [
      { label: 'Cancel', onClick: ({ close }) => close() },
      { label: 'Add', kind: 'primary', onClick: ({ close }) => {
        const nm = name.value.trim(), kk = parseFloat(k.value);
        if (!nm) { toast('Give it a name', 'error'); name.focus(); return; }
        if (!Number.isFinite(kk) || kk < 0 || kk > 20000) { toast('Enter calories', 'error'); k.focus(); return; }
        const pp = num(p.value), cc = num(c.value), ff = num(f.value);
        let foodId = null;
        if (save.checked) {
          const cf = store.addCustomFood({ n: nm, k: kk, p: pp, cb: cc, f: ff, fb: 0, s: [['1 serving', 100]] });
          foodId = cf.id;
        }
        store.addEntry(date, { meal, name: nm, foodId, qty: 1, unit: '1 serving', g: 0, k: kk, p: pp, cb: cc, f: ff, fb: 0, src: 'quick' });
        toast(`Added ${nm} · ${fmt(Math.round(kk))} kcal`, 'success');
        close(); onAdded?.();
      } }
    ]
  });
}
const num = (v) => { const n = parseFloat(v); return Number.isFinite(n) && n >= 0 ? Math.min(5000, n) : 0; };

/** Create a reusable custom food (per 100 g or per serving) */
export function openCustomFood({ onSaved } = {}) {
  const name = h('input', { class: 'input', placeholder: 'e.g. Mom’s rajma', maxlength: 80 });
  const servLabel = h('input', { class: 'input', placeholder: 'e.g. 1 katori', maxlength: 40, value: '1 serving' });
  const servG = h('input', { class: 'input', type: 'number', inputmode: 'decimal', placeholder: 'g', value: '100', min: 1 });
  const k = h('input', { class: 'input', type: 'number', inputmode: 'decimal', placeholder: 'kcal', min: 0 });
  const p = h('input', { class: 'input', type: 'number', inputmode: 'decimal', placeholder: 'g', min: 0 });
  const c = h('input', { class: 'input', type: 'number', inputmode: 'decimal', placeholder: 'g', min: 0 });
  const f = h('input', { class: 'input', type: 'number', inputmode: 'decimal', placeholder: 'g', min: 0 });
  let veg = 1;
  sheet({
    title: 'New custom food',
    body: (el) => el.append(
      field('Name', name),
      h('div', { class: 'grid-2 mt' }, field('Serving name', servLabel), field('Serving weight (g)', servG)),
      h('p', { class: 'muted small mt' }, 'Nutrition per serving:'),
      h('div', { class: 'grid-2 mt' }, field('Calories', k), field('Protein', p)),
      h('div', { class: 'grid-2 mt' }, field('Carbs', c), field('Fat', f)),
      h('div', { class: 'mt' }, field('Type', segmented([{ value: 1, label: 'Veg' }, { value: 2, label: 'Egg' }, { value: 3, label: 'Non-veg' }], 1, (v) => { veg = v; })))
    ),
    actions: [
      { label: 'Cancel', onClick: ({ close }) => close() },
      { label: 'Save food', kind: 'primary', onClick: ({ close }) => {
        const nm = name.value.trim(); const g = parseFloat(servG.value); const kk = parseFloat(k.value);
        if (!nm) { toast('Name required', 'error'); return; }
        if (!Number.isFinite(g) || g <= 0) { toast('Serving weight must be > 0', 'error'); return; }
        if (!Number.isFinite(kk) || kk < 0) { toast('Enter calories', 'error'); return; }
        const scale = 100 / g;
        const food = store.addCustomFood({ n: nm, v: veg, k: kk * scale, p: num(p.value) * scale, cb: num(c.value) * scale, f: num(f.value) * scale, fb: 0, s: [[`${servLabel.value.trim() || '1 serving'} (${round(g)} g)`, g]] });
        toast('Saved to My foods', 'success'); close(); onSaved?.(food);
      } }
    ]
  });
}

/** Edit an existing log entry (quantity scale, meal, or delete) */
export function openEditEntry(date, entry, { onDone } = {}) {
  const food = entry.foodId ? foods.getFood(entry.foodId) : null;
  let qty = entry.qty || 1, meal = entry.meal;
  const base = { k: entry.k / qty, p: entry.p / qty, cb: entry.cb / qty, f: entry.f / qty, fb: (entry.fb || 0) / qty, g: (entry.g || 0) / qty };
  const kcalEl = h('span', { class: 'num', style: { fontSize: '28px', fontWeight: 800 } });
  const kIn = h('input', { class: 'input', type: 'number', inputmode: 'decimal', value: String(Math.round(entry.k)), min: 0 });
  const render = () => { kcalEl.textContent = fmt(Math.round(base.k * qty)); kIn.value = String(Math.round(base.k * qty)); };
  sheet({
    title: 'Edit entry',
    body: (el) => { el.append(
      h('div', { class: 'row' }, h('div', { class: 'avatar' }, emojiFor(food?.c)), h('div', { class: 'grow' }, h('div', { class: 'bold' }, entry.name), h('div', { class: 'muted small' }, entry.unit || ''))),
      h('div', { class: 'row between mt' }, h('div', null, kcalEl, h('span', { class: 'muted', style: { fontWeight: 700 } }, ' kcal')), stepper({ value: qty, onChange: (v) => { qty = v; render(); } })),
      h('div', { class: 'mt' }, field('Override calories (optional)', kIn)),
      h('div', { class: 'mt' }, field('Meal', mealSeg(meal, (v) => { meal = v; })))
    ); render(); },
    actions: [
      { label: 'Delete', kind: 'danger', onClick: ({ close }) => { store.removeEntry(date, entry.id); toast('Removed'); close(); onDone?.(); } },
      { label: 'Save', kind: 'primary', onClick: ({ close }) => {
        const override = parseFloat(kIn.value);
        const k = Number.isFinite(override) && override >= 0 ? override : base.k * qty;
        const ratio = base.k > 0 ? k / (base.k * qty) : 1;
        const unit = food && entry.unit ? entry.unit.replace(/^[\d.]+ ×/, `${round(qty, 2)} ×`) : entry.unit;
        store.updateEntry(date, entry.id, { qty, meal, unit, g: base.g * qty, k, p: base.p * qty * ratio, cb: base.cb * qty * ratio, f: base.f * qty * ratio, fb: base.fb * qty * ratio });
        close(); onDone?.();
      } }
    ]
  });
}

/** Voice + natural language sheet */
export function openVoiceSheet({ date = todayKey(), onAdded, startListening = true } = {}) {
  const settings = store.get().settings;
  let lang = settings.lang || 'en-IN';
  let parsed = null, meal = mealForHour(new Date().getHours());
  const transcript = h('div', { class: 'transcript muted' }, 'Tap the mic and say what you ate…');
  const orb = h('button', { class: 'voice-orb', type: 'button', 'aria-label': 'Start listening' }, icon('mic', 36));
  const status = h('div', { class: 'muted small' }, speech.isSupported() ? 'Ready' : 'Voice not supported here — type instead');
  const textIn = h('textarea', { class: 'input', rows: 2, placeholder: 'Or type: "2 roti, 1 katori dal, chai"', maxlength: 400 });
  const results = h('div', { class: 'parsed list mt' });
  const addBtnLabel = () => `Add ${parsed?.items.filter((i) => i.k > 0 || i.food).length || 0} item${parsed?.items.length === 1 ? '' : 's'}`;
  let sheetApi;

  function setTranscript(t, live) { transcript.textContent = t || 'Listening…'; transcript.classList.toggle('live', !!live); transcript.classList.remove('muted'); }
  function analyse(text) {
    parsed = parse(text, { diet: settings.diet, recent: store.get().recent });
    if (parsed.meal) meal = parsed.meal;
    renderResults();
  }
  function renderResults() {
    clear(results);
    if (!parsed || !parsed.items.length) { results.append(h('div', { class: 'empty small' }, 'Nothing recognised yet.')); updateAction(); return; }
    parsed.items.forEach((it, idx) => {
      const sub = it.newFood ? `${it.unitLabel} · will be saved as a new food (P ${fmt(it.p, 1)} · C ${fmt(it.cb, 1)} · F ${fmt(it.f, 1)})` : it.food ? `${it.unitLabel} · ${fmt(it.grams)} g${it.kcalOverride != null ? ' · label calories' : ''}` : it.kcalOverride != null ? `${it.unitLabel} · label calories` : 'Not found — tap to choose a food';
      const row = h('div', { class: 'item' },
        h('i', { class: `conf ${it.confidence}`, title: it.confidence }),
        h('div', { class: 'grow' }, h('div', { class: 'name' }, it.name), h('div', { class: 'sub' }, sub), h('div', { class: 'tiny faint' }, `“${it.raw}”`)),
        h('div', { class: 'col', style: { alignItems: 'flex-end', gap: '4px' } },
          h('div', { class: 'kcal' }, fmt(it.k), h('small', null, ' kcal')),
          h('div', { class: 'row', style: { gap: '4px' } },
            h('button', { class: 'btn sm secondary', type: 'button', title: 'Change food', onclick: () => pickFood(idx) }, icon('search', 14)),
            h('button', { class: 'btn sm secondary', type: 'button', title: 'Change quantity', onclick: () => changeQty(idx) }, icon('edit', 14)),
            h('button', { class: 'btn sm secondary', type: 'button', title: 'Remove', onclick: () => { parsed.items.splice(idx, 1); renderResults(); } }, icon('x', 14))))
      );
      results.append(row);
    });
    const total = parsed.items.reduce((a, i) => a + i.k, 0);
    results.append(h('div', { class: 'row between mt' }, h('span', { class: 'bold' }, 'Total'), h('span', { class: 'bold num' }, `${fmt(total)} kcal`)));
    results.append(h('div', { class: 'mt' }, field('Meal', mealSeg(meal, (v) => { meal = v; }))));
    updateAction();
  }
  function updateAction() { const b = sheetApi?.actions?.querySelector('button.primary'); if (b) { b.textContent = addBtnLabel(); b.disabled = !parsed?.items.some((i) => i.k > 0 || i.food); } }
  function pickFood(idx) {
    const it = parsed.items[idx];
    openSearchPicker({ query: it.phrase, onPick: (food) => { parsed.items[idx] = resolve({ raw: it.raw, phrase: it.phrase, qty: it.qty, unit: it.unit, unitGrams: it.unitGrams, size: it.size, kcal: it.kcalOverride, meal: it.meal }, { food, score: 100 }); renderResults(); } });
  }
  function changeQty(idx) {
    const it = parsed.items[idx];
    let q = it.qty;
    sheet({ title: 'Quantity', body: (el) => el.append(h('div', { class: 'row between' }, h('span', null, it.name), stepper({ value: q, onChange: (v) => { q = v; } }))),
      actions: [{ label: 'Done', kind: 'primary', onClick: ({ close }) => { parsed.items[idx] = resolve({ raw: it.raw, phrase: it.phrase, qty: q, unit: it.unit, unitGrams: it.unitGrams, size: it.size, kcal: it.kcalOverride != null ? it.kcalOverride * (q / it.qty) : null, meal: it.meal }, it.food ? { food: it.food, score: it.score } : null); renderResults(); close(); } }] });
  }
  async function listen() {
    if (!speech.isSupported()) { toast('Voice input needs Chrome/Edge (or the Android app).', 'error'); textIn.focus(); return; }
    if (speech.isListening()) { speech.stop(); return; }
    orb.classList.add('on'); status.textContent = lang === 'hi-IN' ? 'सुन रहा हूँ…' : 'Listening…'; setTranscript('', true);
    try {
      await speech.start({
        lang,
        onInterim: (t) => setTranscript(t, true),
        onResult: (t) => { setTranscript(t, false); textIn.value = t; analyse(t); },
        onError: (code) => { status.textContent = speech.ERROR_TEXT[code] || `Error: ${code}`; if (!textIn.value.trim()) { transcript.textContent = 'Type below instead, or fix the mic permission.'; transcript.classList.remove('live'); } if (code !== 'no-speech' && code !== 'aborted') toast(speech.ERROR_TEXT[code] || 'Voice error', 'error'); },
        onEnd: () => { orb.classList.remove('on'); if (status.textContent.startsWith('Listening') || status.textContent.startsWith('सुन')) status.textContent = 'Tap mic to speak again'; if (transcript.textContent === 'Listening…') { transcript.textContent = 'Didn’t catch that — tap the mic again, or type below.'; transcript.classList.remove('live'); transcript.classList.add('muted'); } }
      });
    } catch (e) {
      orb.classList.remove('on'); status.textContent = speech.ERROR_TEXT[e?.message] || 'Could not start the microphone';
    }
  }
  orb.addEventListener('click', listen);
  const onType = debounce(() => { const t = textIn.value.trim(); if (t) { setTranscript(t, false); analyse(t); } }, 350);
  textIn.addEventListener('input', onType);

  const examples = ['2 roti and 1 katori dal', 'ek plate chicken biryani', 'protein shake 130 calories', 'दो इडली और सांभर', 'masala dosa with filter coffee', '100 g paneer, 2 boiled eggs'];
  sheetApi = sheet({
    title: 'Speak or type your meal',
    body: (el) => el.append(
      h('div', { class: 'voice-status' }, orb, status,
        segmented([{ value: 'en-IN', label: 'English' }, { value: 'hi-IN', label: 'हिन्दी' }], lang, (v) => { lang = v; store.setSettings({ lang: v }); }),
        transcript),
      h('div', { class: 'mt' }, textIn),
      h('div', { class: 'examples' }, ...examples.map((ex) => h('button', { type: 'button', onclick: () => { textIn.value = ex; setTranscript(ex); analyse(ex); } }, ex))),
      results
    ),
    actions: [
      { label: 'Close', onClick: ({ close }) => close() },
      { label: 'Add', kind: 'primary', disabled: true, onClick: ({ close }) => {
        let n = 0, total = 0;
        for (const it of parsed.items) {
          if (!(it.k > 0 || it.food)) continue;
          let foodId = it.food?.id || null, unit = it.unitLabel;
          if (it.newFood) {
            // "protein shake 130 kcal 27 g protein" → becomes a reusable custom food (per serving = what was spoken)
            const q = it.qty || 1;
            const cf = store.addCustomFood({ n: it.name, v: it.food?.v || 1, k: (it.k / q), p: it.p / q, cb: it.cb / q, f: it.f / q, fb: it.fb / q, s: [['1 serving (100 g)', 100]] });
            foodId = cf.id; unit = `${q} × 1 serving`;
          }
          store.addEntry(date, { meal, name: it.name, foodId, qty: it.qty, unit, g: it.grams, k: it.k, p: it.p, cb: it.cb, f: it.f, fb: it.fb, src: it.spoken ? 'quick' : 'voice' });
          n++; total += it.k;
        }
        toast(`Added ${n} item${n === 1 ? '' : 's'} · ${fmt(total)} kcal`, 'success');
        close(); onAdded?.();
      } }
    ],
    onClose: () => speech.abort()
  });
  renderResults();
  if (startListening && speech.isSupported()) listen();
  else setTimeout(() => textIn.focus(), 100);
}

/** Search-only picker (used to fix a mis-recognised voice item) */
export function openSearchPicker({ query = '', onPick }) {
  const input = h('input', { class: 'input', placeholder: 'Search foods…', value: query, autocomplete: 'off' });
  const list = h('div', { class: 'list mt' });
  let api;
  const run = () => { clear(list); const q = input.value.trim(); const res = q ? foods.search(q, { limit: 25, diet: store.get().settings.diet }) : []; if (!res.length) list.append(h('div', { class: 'empty small' }, q ? 'No matches' : 'Type to search 2,000+ Indian foods')); for (const r of res) list.append(foodRow(r.food, { onClick: () => { onPick(r.food); api.close(); } })); };
  input.addEventListener('input', debounce(run, 120));
  const lead = icon('search', 20); lead.setAttribute('class', 'lead');
  api = sheet({ title: 'Choose food', body: (el) => { el.append(h('div', { class: 'search' }, lead, input), list); run(); } });
}

export { mealSeg };
