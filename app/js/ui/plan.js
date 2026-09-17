// Plan: BMI, target, three sustainable plans, active plan progress, weight log.
import { h, svg, clear, fmt, todayKey, fmtDate, round, parseKey } from '../util.js';
import * as store from '../store.js';
import * as calc from '../calc.js';
import { icon, sheet, toast, confirm, field, segmented } from './components.js';
import { navigate } from '../router.js';

export const state = { targetMode: 'weight', targetInput: null };

export function render(root) {
  clear(root);
  const s = store.get();
  const p = s.profile;
  const b = calc.bmi(p.weightKg, p.heightCm);
  const cat = calc.bmiCategory(b);
  const [lo, hi] = calc.healthyWeightRange(p.heightCm);
  const T = Math.round(calc.tdee(p)), B = Math.round(calc.bmr(p));

  // BMI card
  root.append(h('div', { class: 'card' },
    h('div', { class: 'row between' }, h('h3', null, 'Body'), h('button', { class: 'btn sm secondary', onclick: () => navigate('me') }, icon('edit', 14), 'Edit profile')),
    h('div', { class: 'row mt', style: { gap: '16px' } },
      h('div', { class: 'gauge', style: { width: '150px', flex: 'none' } }, gauge(b)),
      h('div', { class: 'grow' },
        h('div', { style: { fontSize: '34px', fontWeight: 800, letterSpacing: '-0.02em', lineHeight: 1 } }, fmt(b, 1), h('span', { class: 'muted', style: { fontSize: '13px', fontWeight: 700 } }, ' BMI')),
        h('div', { class: 'badge mt', style: { background: `color-mix(in srgb, ${cat.color} 15%, transparent)`, color: cat.color } }, cat.label),
        h('div', { class: 'muted small mt' }, `${p.weightKg} kg · ${p.heightCm} cm · ${p.age} y`),
        h('div', { class: 'muted small' }, `Healthy range for you: ${fmt(lo)}–${fmt(hi)} kg`))),
    h('div', { class: 'grid-3 mt' },
      h('div', { class: 'stat' }, h('div', { class: 'v', style: { fontSize: '18px' } }, fmt(B)), h('div', { class: 'l' }, 'BMR kcal')),
      h('div', { class: 'stat' }, h('div', { class: 'v', style: { fontSize: '18px' } }, fmt(T)), h('div', { class: 'l' }, 'Maintenance')),
      h('div', { class: 'stat' }, h('div', { class: 'v', style: { fontSize: '18px' } }, fmt(calc.icmrReference(p))), h('div', { class: 'l' }, 'ICMR 2020 ref'))),
    h('p', { class: 'faint tiny mt' }, 'BMI uses Asian-Indian cut-offs (23 overweight, 25 obese). Maintenance = Mifflin-St Jeor BMR × activity. ICMR 2020 is the population RDA for your sex & activity, for reference only.')
  ));

  // active plan
  if (s.plan) {
    const pl = s.plan;
    const proj = calc.projection(pl, s.logs);
    const latestW = s.weights.length ? s.weights[s.weights.length - 1].kg : p.weightKg;
    const lost = round(pl.startWeight - latestW, 1);
    const toGo = pl.targetWeight != null ? round(latestW - pl.targetWeight, 1) : null;
    const total = pl.targetWeight != null ? Math.abs(pl.startWeight - pl.targetWeight) : 0;
    const pct = total > 0 ? Math.min(100, Math.max(0, (Math.abs(lost) / total) * 100 * (Math.sign(lost) === Math.sign(pl.startWeight - pl.targetWeight) ? 1 : 0))) : 0;
    const fill = h('i');
    requestAnimationFrame(() => { fill.style.width = pct + '%'; });
    root.append(h('div', { class: 'card hero mt' },
      h('div', { class: 'row between' }, h('div', null, h('div', { class: 'tiny', style: { opacity: .85, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.06em' } }, 'Active plan'), h('div', { style: { fontSize: '22px', fontWeight: 800 } }, `${pl.label} · ${fmt(pl.targetKcal)} kcal/day`)),
        h('button', { class: 'btn sm', style: { background: 'rgba(255,255,255,.2)', color: '#fff' }, onclick: async () => { if (await confirm({ title: 'Stop this plan?', message: 'Your daily target will go back to maintenance. Logs are kept.', okLabel: 'Stop plan', danger: true })) { store.setPlan(null); render(root); } } }, 'Stop')),
      h('div', { class: 'hero-stats mt' },
        h('div', null, h('div', { class: 'v num' }, `${pl.startWeight} kg`), h('div', { class: 'l' }, `start · ${fmtDate(pl.startDate)}`)),
        h('div', null, h('div', { class: 'v num' }, `${latestW} kg`), h('div', { class: 'l' }, 'now')),
        h('div', null, h('div', { class: 'v num' }, pl.targetWeight != null ? `${pl.targetWeight} kg` : '—'), h('div', { class: 'l' }, 'goal'))),
      pl.targetWeight != null ? h('div', { class: 'bar mt', style: { background: 'rgba(255,255,255,.25)' } }, fill) : null,
      h('div', { class: 'row between mt small', style: { opacity: .92 } },
        h('span', null, lost !== 0 ? `${lost > 0 ? 'Lost' : 'Gained'} ${Math.abs(lost)} kg` : 'No change yet', toGo != null && toGo !== 0 ? ` · ${Math.abs(toGo)} kg to go` : ''),
        h('span', null, proj?.loggedDays ? `est. ${proj.estKgChange > 0 ? '+' : ''}${proj.estKgChange} kg from ${proj.loggedDays} completed day${proj.loggedDays === 1 ? '' : 's'}` : 'projection appears after your first full day'))
    ));
  }

  // target + plans
  const targetCard = h('div', { class: 'card mt' });
  root.append(targetCard);
  renderTarget(targetCard, root);

  // weight log
  root.append(weightCard(root));
}

function renderTarget(card, root) {
  clear(card);
  const s = store.get();
  const p = s.profile;
  const savedTarget = p.targetWeightKg;
  let mode = state.targetMode;
  let val = state.targetInput ?? (mode === 'weight' ? savedTarget ?? '' : savedTarget ? round(calc.bmi(savedTarget, p.heightCm), 1) : '');
  const input = h('input', { class: 'input lg', type: 'number', inputmode: 'decimal', step: '0.1', value: val === null ? '' : String(val), placeholder: mode === 'weight' ? 'e.g. 68' : 'e.g. 22' });
  const hint = h('div', { class: 'muted small mt' });
  const plansEl = h('div', { class: 'col mt' });
  const seg = segmented([{ value: 'weight', label: 'Target weight (kg)' }, { value: 'bmi', label: 'Target BMI' }], mode, (v) => { state.targetMode = v; state.targetInput = null; renderTarget(card, root); });
  card.append(h('h3', null, 'Your goal'), h('p', { class: 'muted small' }, 'Pick a target and choose how fast to get there. Every plan is expressed as one number: your daily calorie target.'),
    h('div', { class: 'mt' }, seg), h('div', { class: 'mt' }, input), hint, plansEl);
  function compute() {
    const v = parseFloat(input.value);
    state.targetInput = input.value;
    let targetW = null;
    if (Number.isFinite(v)) targetW = mode === 'weight' ? v : calc.weightForBmi(v, p.heightCm);
    clear(plansEl);
    if (targetW == null) { hint.textContent = 'Enter a target to see plans.'; return; }
    if (targetW < 30 || targetW > 300) { hint.textContent = 'That target looks unrealistic.'; return; }
    const tBmi = calc.bmi(targetW, p.heightCm);
    const tc = calc.bmiCategory(tBmi);
    hint.textContent = `${round(targetW, 1)} kg → BMI ${round(tBmi, 1)} (${tc.label}). ${tBmi < 18.5 ? '⚠️ Below the healthy range — consider a higher target.' : ''}`;
    const r = calc.buildPlans(p, targetW);
    const title = r.direction === 'lose' ? `Lose ${Math.abs(r.diff)} kg` : r.direction === 'gain' ? `Gain ${Math.abs(r.diff)} kg` : 'Maintain';
    plansEl.append(h('div', { class: 'row between' }, h('span', { class: 'bold' }, title), h('span', { class: 'muted small' }, `maintenance ${fmt(r.tdee)} kcal`)));
    for (const pl of r.plans) {
      const selected = s.plan?.id === pl.id && s.plan?.targetKcal === pl.targetKcal;
      plansEl.append(h('button', { class: `plan-card ${selected ? 'selected' : ''}`, type: 'button', onclick: () => choose(pl, targetW, r) },
        h('div', { class: 'row between' }, h('div', { class: 'bold' }, pl.label, selected ? h('span', { class: 'badge green', style: { marginLeft: '8px' } }, 'Active') : null),
          h('div', { class: 'pk' }, fmt(pl.targetKcal), h('small', null, ' kcal/day'))),
        h('div', { class: 'row wrap mt', style: { gap: '6px' } },
          h('span', { class: 'badge blue' }, `${pl.delta > 0 ? '+' : ''}${fmt(pl.delta)} kcal/day`),
          pl.weeklyKg ? h('span', { class: 'badge gray' }, `${Math.abs(pl.weeklyKg)} kg/week`) : null,
          pl.eta ? h('span', { class: 'badge gray' }, `~${pl.weeks} weeks · ${fmtDate(pl.eta, { day: 'numeric', month: 'short', year: 'numeric' })}`) : null,
          pl.capped ? h('span', { class: 'badge amber' }, `capped at safe floor ${fmt(r.floor)}`) : null),
        h('div', { class: 'muted small mt' }, pl.note)));
    }
    plansEl.append(h('p', { class: 'faint tiny mt' }, `Estimates assume ~7,700 kcal per kg of body fat and are never set below ${fmt(r.floor)} kcal (your safe floor). Re-check after every 3–4 kg change since maintenance drops as you lose weight. Not medical advice — talk to a doctor if pregnant, under 18, or managing a condition.`));
  }
  function choose(pl, targetW, r) {
    store.setProfile({ targetWeightKg: round(targetW, 1) });
    store.setPlan({ id: pl.id, label: pl.label, targetKcal: pl.targetKcal, delta: pl.delta, startDate: todayKey(), startWeight: p.weightKg, targetWeight: round(targetW, 1), weeks: pl.weeks, tdee: r.tdee });
    if (!s.weights.some((w) => w.d === todayKey())) store.logWeight(p.weightKg);
    toast(`Plan set: ${fmt(pl.targetKcal)} kcal/day`, 'success');
    render(root);
  }
  input.addEventListener('input', compute);
  compute();
}

function weightCard(root) {
  const s = store.get();
  const w = s.weights;
  const card = h('div', { class: 'card mt chart' });
  const input = h('input', { class: 'input', type: 'number', inputmode: 'decimal', step: '0.1', placeholder: `${s.profile.weightKg}`, 'aria-label': 'Weight in kg' });
  const add = () => { const v = parseFloat(input.value); if (!Number.isFinite(v) || v < 20 || v > 400) { toast('Enter a weight between 20 and 400 kg', 'error'); return; } store.logWeight(v); toast('Weight logged', 'success'); render(root); };
  input.addEventListener('keydown', (e) => { if (e.key === 'Enter') add(); });
  card.append(h('div', { class: 'row between' }, h('h3', null, 'Weight log'), h('span', { class: 'muted small' }, w.length ? `${w.length} entries` : '')),
    h('div', { class: 'input-row mt' }, input, h('button', { class: 'btn primary', onclick: add }, icon('plus', 16), 'Log today')));
  if (w.length >= 2) card.append(h('div', { class: 'mt' }, lineChart(w)));
  if (w.length) {
    const recent = w.slice(-5).reverse();
    const list = h('div', { class: 'list mt' });
    for (const e of recent) list.append(h('div', { class: 'item', style: { padding: '8px 0' } }, h('span', { class: 'grow small' }, fmtDate(e.d, { day: 'numeric', month: 'short', year: 'numeric' })), h('span', { class: 'bold num' }, `${e.kg} kg`),
      h('button', { class: 'btn icon secondary', 'aria-label': 'Delete', onclick: () => { store.removeWeight(e.d); render(root); } }, icon('trash', 14))));
    card.append(list);
  } else card.append(h('div', { class: 'empty small' }, 'Log your weight weekly (same time of day) to see the trend.'));
  return card;
}

function lineChart(w) {
  const W = 600, H = 180, padL = 40, padR = 12, padT = 14, padB = 24;
  const pts = w.slice(-60);
  const t0 = parseKey(pts[0].d).getTime(), t1 = Math.max(parseKey(pts[pts.length - 1].d).getTime(), t0 + 86400000 * 6);
  const kgs = pts.map((p) => p.kg);
  let lo = Math.min(...kgs), hi = Math.max(...kgs);
  const pad = Math.max(1, (hi - lo) * 0.25); lo -= pad; hi += pad;
  const x = (d) => padL + ((parseKey(d).getTime() - t0) / (t1 - t0)) * (W - padL - padR);
  const y = (v) => padT + (1 - (v - lo) / (hi - lo)) * (H - padT - padB);
  const el = svg('svg', { viewBox: `0 0 ${W} ${H}`, role: 'img', 'aria-label': 'Weight trend' });
  for (const v of [lo + pad, hi - pad]) { el.append(svg('line', { x1: padL, x2: W - padR, y1: y(v), y2: y(v), stroke: 'var(--line)' })); el.append(svg('text', { x: padL - 6, y: y(v) + 4, 'text-anchor': 'end', 'font-size': 11, fill: 'var(--faint)' }, round(v, 1))); }
  const d = pts.map((p, i) => `${i ? 'L' : 'M'}${x(p.d).toFixed(1)},${y(p.kg).toFixed(1)}`).join(' ');
  const area = `${d} L${x(pts[pts.length - 1].d).toFixed(1)},${H - padB} L${x(pts[0].d).toFixed(1)},${H - padB} Z`;
  const defs = svg('defs', {}, svg('linearGradient', { id: 'wg', x1: 0, y1: 0, x2: 0, y2: 1 }, svg('stop', { offset: '0%', 'stop-color': 'var(--teal)', 'stop-opacity': .35 }), svg('stop', { offset: '100%', 'stop-color': 'var(--teal)', 'stop-opacity': 0 })));
  el.append(defs, svg('path', { d: area, fill: 'url(#wg)' }), svg('path', { d, fill: 'none', stroke: 'var(--blue)', 'stroke-width': 2.5, 'stroke-linejoin': 'round' }));
  for (const p of pts) el.append(svg('circle', { cx: x(p.d), cy: y(p.kg), r: 3.5, fill: 'var(--surface)', stroke: 'var(--blue)', 'stroke-width': 2 }));
  el.append(svg('text', { x: padL, y: H - 6, 'font-size': 11, fill: 'var(--muted)' }, fmtDate(pts[0].d, { day: 'numeric', month: 'short' })));
  el.append(svg('text', { x: W - padR, y: H - 6, 'text-anchor': 'end', 'font-size': 11, fill: 'var(--muted)' }, fmtDate(pts[pts.length - 1].d, { day: 'numeric', month: 'short' })));
  return el;
}

function gauge(b) {
  // semicircle gauge 15..35
  const W = 150, H = 92, cx = 75, cy = 80, r = 62;
  const segs = [[15, 18.5, 'var(--blue)'], [18.5, 23, 'var(--green)'], [23, 25, 'var(--amber)'], [25, 30, 'var(--orange)'], [30, 35, 'var(--red)']];
  const ang = (v) => Math.PI + (Math.min(35, Math.max(15, v)) - 15) / 20 * Math.PI;
  const pt = (a, rr) => [cx + rr * Math.cos(a), cy + rr * Math.sin(a)];
  const el = svg('svg', { viewBox: `0 0 ${W} ${H}` });
  for (const [a, bb, col] of segs) {
    const [x1, y1] = pt(ang(a), r), [x2, y2] = pt(ang(bb), r);
    el.append(svg('path', { d: `M${x1},${y1} A${r},${r} 0 0 1 ${x2},${y2}`, stroke: col, 'stroke-width': 12, fill: 'none', 'stroke-linecap': 'butt', opacity: .9 }));
  }
  const [nx, ny] = pt(ang(b), r - 2);
  el.append(svg('line', { x1: cx, y1: cy, x2: nx, y2: ny, stroke: 'var(--text)', 'stroke-width': 3, 'stroke-linecap': 'round' }));
  el.append(svg('circle', { cx, cy, r: 5, fill: 'var(--text)' }));
  el.append(svg('text', { x: 12, y: H - 2, 'font-size': 9, fill: 'var(--faint)' }, '15'), svg('text', { x: W - 22, y: H - 2, 'font-size': 9, fill: 'var(--faint)' }, '35'));
  return el;
}
