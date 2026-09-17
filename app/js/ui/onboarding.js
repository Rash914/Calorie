// First-run: profile → optional goal → done.
import { h, clear, fmt, todayKey, round } from '../util.js';
import * as store from '../store.js';
import * as calc from '../calc.js';
import { sheet, toast, icon, field, segmented } from './components.js';
import { profileForm } from './me.js';

export function openOnboarding({ onDone }) {
  let step = 0;
  let profile = null;
  const body = h('div');
  const steps = h('div', { class: 'steps' }, h('i'), h('i'), h('i'));
  let api;
  function paint() { steps.querySelectorAll('i').forEach((i, idx) => i.classList.toggle('on', idx <= step)); clear(body); body.append(steps); if (step === 0) s0(); else if (step === 1) s1(); else s2(); }
  function s0() {
    const form = profileForm(store.get().profile, { compact: false });
    body.append(h('h2', null, 'Welcome to Aahar 🌿'), h('p', { class: 'muted small mb' }, 'Tell us about yourself so we can estimate how much you need each day. Everything stays on this device.'),
      form.el,
      h('button', { class: 'btn primary block mt-lg', onclick: () => { const r = form.read(); if (r.error) { toast(r.error, 'error'); return; } profile = r.value; store.setProfile(profile); store.logWeight(profile.weightKg); step = 1; paint(); } }, 'Continue', icon('right', 16)));
  }
  function s1() {
    const p = store.get().profile;
    const b = calc.bmi(p.weightKg, p.heightCm);
    const cat = calc.bmiCategory(b);
    const [lo, hi] = calc.healthyWeightRange(p.heightCm);
    const T = Math.round(calc.tdee(p));
    let mode = 'weight';
    const input = h('input', { class: 'input lg', type: 'number', inputmode: 'decimal', step: '0.1', placeholder: `e.g. ${round(Math.min(hi, Math.max(lo, p.weightKg - 5)))}` });
    const plans = h('div', { class: 'col mt' });
    let chosen = null;
    const seg = segmented([{ value: 'weight', label: 'Target weight (kg)' }, { value: 'bmi', label: 'Target BMI' }], mode, (v) => { mode = v; input.placeholder = v === 'bmi' ? 'e.g. 22' : `e.g. ${round(p.weightKg - 5)}`; compute(); });
    const compute = () => {
      clear(plans); chosen = null;
      const v = parseFloat(input.value); if (!Number.isFinite(v)) return;
      const tw = mode === 'weight' ? v : calc.weightForBmi(v, p.heightCm);
      if (tw < 30 || tw > 300) return;
      const r = calc.buildPlans(p, tw);
      for (const pl of r.plans) {
        const btn = h('button', { type: 'button', class: 'plan-card', onclick: () => { chosen = { pl, tw, r }; plans.querySelectorAll('.plan-card').forEach((c) => c.classList.toggle('selected', c === btn)); } },
          h('div', { class: 'row between' }, h('span', { class: 'bold' }, pl.label), h('span', { class: 'pk', style: { fontSize: '20px' } }, fmt(pl.targetKcal), h('small', null, ' kcal/day'))),
          h('div', { class: 'muted small' }, `${pl.delta > 0 ? '+' : ''}${fmt(pl.delta)} kcal/day${pl.weeklyKg ? ` · ${Math.abs(pl.weeklyKg)} kg/week` : ''}${pl.weeks ? ` · ~${pl.weeks} weeks` : ''}`));
        plans.append(btn);
      }
    };
    input.addEventListener('input', compute);
    body.append(h('h2', null, 'Set a goal (optional)'),
      h('div', { class: 'card soft mt' }, h('div', { class: 'row between' }, h('div', null, h('div', { class: 'muted tiny bold' }, 'YOUR BMI'), h('div', { style: { fontSize: '26px', fontWeight: 800 } }, fmt(b, 1), h('span', { class: 'small', style: { color: cat.color, fontWeight: 700 } }, ` ${cat.label}`))),
        h('div', { class: 'center' }, h('div', { class: 'muted tiny bold' }, 'MAINTENANCE'), h('div', { style: { fontSize: '26px', fontWeight: 800 } }, fmt(T), h('span', { class: 'muted small' }, ' kcal'))))),
      h('p', { class: 'muted small mt' }, `Healthy range for your height: ${fmt(lo)}–${fmt(hi)} kg.`),
      h('div', { class: 'mt' }, seg), h('div', { class: 'mt' }, input), plans,
      h('div', { class: 'row mt-lg', style: { gap: '8px' } },
        h('button', { class: 'btn secondary grow', onclick: () => { step = 2; paint(); } }, 'Skip for now'),
        h('button', { class: 'btn primary grow', onclick: () => { if (!chosen) { toast('Pick a plan, or skip', 'error'); return; } const { pl, tw, r } = chosen; store.setProfile({ targetWeightKg: round(tw, 1) }); store.setPlan({ id: pl.id, label: pl.label, targetKcal: pl.targetKcal, delta: pl.delta, startDate: todayKey(), startWeight: p.weightKg, targetWeight: round(tw, 1), weeks: pl.weeks, tdee: r.tdee }); step = 2; paint(); } }, 'Use this plan', icon('check', 16))));
  }
  function s2() {
    const s = store.get();
    const target = s.plan?.targetKcal || Math.round(calc.tdee(s.profile));
    body.append(h('h2', null, 'You’re set 🎉'),
      h('div', { class: 'card hero mt' }, h('div', { class: 'tiny', style: { opacity: .85, fontWeight: 700, letterSpacing: '.06em' } }, 'DAILY TARGET'), h('div', { style: { fontSize: '40px', fontWeight: 800 } }, `${fmt(target)} kcal`), h('div', { class: 'small', style: { opacity: .9 } }, s.plan ? `${s.plan.label} plan · ${s.plan.delta > 0 ? '+' : ''}${s.plan.delta} kcal/day` : 'Maintenance estimate')),
      h('div', { class: 'col mt' },
        h('div', { class: 'option' }, '🎤', h('div', null, h('div', { class: 't' }, 'Speak your meals'), h('div', { class: 'd' }, 'Tap the mic: “2 roti, 1 katori dal, ek glass doodh”. Hindi works too.'))),
        h('div', { class: 'option' }, '🏷️', h('div', null, h('div', { class: 't' }, 'Say the label calories'), h('div', { class: 'd' }, '“Protein shake 130 calories” uses your number instead of ours.'))),
        h('div', { class: 'option' }, '📅', h('div', null, h('div', { class: 't' }, 'Keep the streak'), h('div', { class: 'd' }, 'Log at least one item a day. The calendar shows how each day went.')))),
      h('button', { class: 'btn primary block mt-lg', onclick: () => { store.setSettings({ onboarded: true }); api.close(); onDone?.(); } }, 'Start tracking'));
  }
  api = sheet({ title: null, body: (el) => { el.append(body); paint(); }, onClose: () => { if (!store.get().settings.onboarded) { store.setSettings({ onboarded: true }); onDone?.(); } } });
  api.el.querySelector('.grab').remove();
}
