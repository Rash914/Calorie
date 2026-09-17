// Body metrics, energy needs, plans and streaks.
import { addDays, todayKey, parseKey } from './util.js';

export const ACTIVITY = {
  sedentary: { label: 'Sedentary', desc: 'Desk job, little or no exercise', factor: 1.2, icmr: 'sedentary' },
  light: { label: 'Lightly active', desc: 'Light exercise 1–3 days/week', factor: 1.375, icmr: 'sedentary' },
  moderate: { label: 'Moderately active', desc: 'Exercise 3–5 days/week or active job', factor: 1.55, icmr: 'moderate' },
  active: { label: 'Very active', desc: 'Hard exercise 6–7 days/week', factor: 1.725, icmr: 'heavy' },
  very: { label: 'Extremely active', desc: 'Physical job + daily training', factor: 1.9, icmr: 'heavy' }
};

// ICMR-NIN 2020 Recommended Dietary Allowances (energy, kcal/day) for reference adults
export const ICMR_2020 = {
  male: { sedentary: 2110, moderate: 2710, heavy: 3470 },
  female: { sedentary: 1660, moderate: 2130, heavy: 2720 },
  extra: { pregnant: 350, lactating0_6: 600, lactating7_12: 520 },
  infant: { '0-6 months': 550, '6-12 months': 670 }
};
export const CONDITIONS = {
  none: 'None',
  pregnant: 'Pregnant (+350 kcal, ICMR 2020)',
  lactating0_6: 'Lactating 0–6 months (+600 kcal)',
  lactating7_12: 'Lactating 7–12 months (+520 kcal)'
};

export function bmi(weightKg, heightCm) {
  const m = heightCm / 100;
  return m > 0 ? weightKg / (m * m) : 0;
}
// Asian-Indian BMI cut-offs (ICMR / WHO Asia-Pacific)
export function bmiCategory(b) {
  if (b < 18.5) return { key: 'under', label: 'Underweight', color: 'var(--blue)' };
  if (b < 23) return { key: 'normal', label: 'Healthy', color: 'var(--green)' };
  if (b < 25) return { key: 'over', label: 'Overweight', color: 'var(--amber)' };
  if (b < 30) return { key: 'obese1', label: 'Obese I', color: 'var(--orange)' };
  return { key: 'obese2', label: 'Obese II', color: 'var(--red)' };
}
export function weightForBmi(targetBmi, heightCm) { const m = heightCm / 100; return targetBmi * m * m; }
export function healthyWeightRange(heightCm) { return [weightForBmi(18.5, heightCm), weightForBmi(22.9, heightCm)]; }

/** Mifflin–St Jeor BMR */
export function bmr(p) {
  const base = 10 * p.weightKg + 6.25 * p.heightCm - 5 * p.age;
  return p.sex === 'male' ? base + 5 : base - 161;
}
export function tdee(p) {
  const extra = ICMR_2020.extra[p.condition] || 0;
  return bmr(p) * (ACTIVITY[p.activity]?.factor || 1.375) + extra;
}
/** ICMR 2020 reference intake for this profile (population reference, not individual) */
export function icmrReference(p) {
  const level = ACTIVITY[p.activity]?.icmr || 'sedentary';
  const base = ICMR_2020[p.sex === 'female' ? 'female' : 'male'][level];
  return base + (ICMR_2020.extra[p.condition] || 0);
}

const KCAL_PER_KG = 7700;
export function minKcal(p) {
  // never plan below 1200 (women) / 1500 (men) kcal, and not below 85% of BMR
  const floor = p.sex === 'female' ? 1200 : 1500;
  return Math.max(floor, Math.round(bmr(p) * 0.85));
}

/**
 * Build 3 sustainable plans towards a target weight.
 * Returns { tdee, bmr, direction: 'lose'|'gain'|'maintain', plans: [{id,label,delta,targetKcal,weeklyKg,weeks,eta,note}] }
 */
export function buildPlans(p, targetWeightKg) {
  const T = Math.round(tdee(p));
  const B = Math.round(bmr(p));
  const floor = minKcal(p);
  const diff = targetWeightKg != null ? targetWeightKg - p.weightKg : 0;
  const direction = Math.abs(diff) < 0.5 ? 'maintain' : diff < 0 ? 'lose' : 'gain';
  const mk = (id, label, delta, note) => {
    let target = T + delta;
    let capped = false;
    if (direction === 'lose' && target < floor) { target = floor; capped = true; }
    const effDelta = target - T;
    const weeklyKg = (effDelta * 7) / KCAL_PER_KG;
    const weeks = weeklyKg !== 0 && direction !== 'maintain' ? Math.abs(diff) / Math.abs(weeklyKg) : 0;
    const eta = weeks > 0 ? addDays(todayKey(), Math.round(weeks * 7)) : null;
    return { id, label, delta: Math.round(effDelta), targetKcal: Math.round(target), weeklyKg: Math.round(weeklyKg * 100) / 100, weeks: Math.round(weeks * 10) / 10, eta, note, capped, tdee: T };
  };
  let plans;
  if (direction === 'lose') {
    // cap deficit at 25% of TDEE for the most aggressive plan
    const maxDef = Math.min(750, Math.round(T * 0.25));
    plans = [
      mk('gentle', 'Gentle', -300, 'Barely noticeable. Best for long-term habits and preserving muscle.'),
      mk('steady', 'Steady', -500, 'The classic ~0.5 kg/week. Sustainable for most people.'),
      mk('focused', 'Focused', -maxDef, 'Faster but demanding. Prioritise protein and sleep; not below your safe floor.')
    ];
  } else if (direction === 'gain') {
    plans = [
      mk('lean', 'Lean gain', 250, 'Slow surplus to keep gains mostly lean.'),
      mk('steady', 'Steady gain', 400, 'Balanced surplus, ~0.35 kg/week.'),
      mk('bulk', 'Bulk', 550, 'Faster gain; expect some fat gain too.')
    ];
  } else {
    plans = [
      mk('maintain', 'Maintain', 0, 'Eat at your estimated maintenance (TDEE).'),
      mk('recomp', 'Recomposition', -150, 'Slight deficit with high protein; slow fat loss while training.'),
      mk('flex', 'Flexible', 100, 'Small buffer for active days.')
    ];
  }
  return { tdee: T, bmr: B, floor, direction, diff: Math.round(diff * 10) / 10, plans, icmr: icmrReference(p) };
}

/** Macro targets for a calorie target: protein 1.4 g/kg (min 25%..max 35% kcal), fat 27%, carbs rest */
export function macroTargets(p, kcal) {
  let protein = 1.4 * p.weightKg;
  protein = Math.min(Math.max(protein, (kcal * 0.2) / 4), (kcal * 0.35) / 4);
  const fat = (kcal * 0.27) / 9;
  const carbs = Math.max(0, (kcal - protein * 4 - fat * 9) / 4);
  const fiber = Math.round(Math.min(40, Math.max(25, kcal / 1000 * 14)));
  return { p: Math.round(protein), f: Math.round(fat), cb: Math.round(carbs), fb: fiber };
}

/** Streak: consecutive days (ending today or yesterday) with at least one logged entry. */
export function streak(logs, today = todayKey()) {
  const has = (k) => Array.isArray(logs[k]) && logs[k].length > 0;
  let start = today;
  if (!has(start)) { start = addDays(today, -1); if (!has(start)) return { current: 0, best: bestStreak(logs), active: false }; }
  let n = 0, k = start;
  while (has(k)) { n++; k = addDays(k, -1); if (n > 5000) break; }
  return { current: n, best: Math.max(n, bestStreak(logs)), active: has(today) };
}
export function bestStreak(logs) {
  const days = Object.keys(logs).filter((k) => logs[k]?.length).sort();
  let best = 0, run = 0, prev = null;
  for (const d of days) {
    run = prev && addDays(prev, 1) === d ? run + 1 : 1;
    best = Math.max(best, run);
    prev = d;
  }
  return best;
}
/** Completed days (yesterday backwards, last N) where intake landed between 60% and 105% of target. */
export function onTargetDays(logs, targetKcal, n = 7, today = todayKey()) {
  let hit = 0, logged = 0;
  for (let i = 1; i <= n; i++) {
    const k = addDays(today, -i);
    const list = logs[k];
    if (!list?.length) continue;
    logged++;
    const total = list.reduce((a, e) => a + e.k, 0);
    if (total <= targetKcal * 1.05 && total >= targetKcal * 0.6) hit++;
  }
  return { hit, logged };
}

/** Weekly average kcal for the last 7 logged days */
export function weeklyAverage(logs, today = todayKey()) {
  let sum = 0, n = 0;
  for (let i = 0; i < 7; i++) {
    const list = logs[addDays(today, -i)];
    if (list?.length) { sum += list.reduce((a, e) => a + e.k, 0); n++; }
  }
  return n ? Math.round(sum / n) : 0;
}

/** Projected weight from calorie balance since plan start (for the plan page) */
export function projection(plan, logs, today = todayKey()) {
  if (!plan) return null;
  let days = 0, balance = 0;
  let k = plan.startDate;
  const end = parseKey(addDays(today, -1)).getTime(); // today is still in progress
  while (parseKey(k).getTime() <= end && days < 3660) {
    const list = logs[k];
    if (list?.length) { balance += list.reduce((a, e) => a + e.k, 0) - plan.tdee; days++; }
    k = addDays(k, 1);
  }
  return { loggedDays: days, balanceKcal: Math.round(balance), estKgChange: Math.round((balance / KCAL_PER_KG) * 100) / 100 };
}
