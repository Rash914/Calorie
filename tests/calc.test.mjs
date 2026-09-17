import './setup.mjs';
import test from 'node:test';
import assert from 'node:assert/strict';
import * as calc from '../app/js/calc.js';

const male = { sex: 'male', age: 30, heightCm: 175, weightKg: 80, activity: 'light', condition: 'none' };
const female = { sex: 'female', age: 28, heightCm: 160, weightKg: 55, activity: 'sedentary', condition: 'none' };

test('bmi and categories (Asian cut-offs)', () => {
  assert.equal(Math.round(calc.bmi(80, 175) * 10) / 10, 26.1);
  assert.equal(calc.bmiCategory(17).key, 'under');
  assert.equal(calc.bmiCategory(22).key, 'normal');
  assert.equal(calc.bmiCategory(24).key, 'over');
  assert.equal(calc.bmiCategory(27).key, 'obese1');
  assert.equal(Math.round(calc.weightForBmi(22, 175)), 67);
});

test('bmr / tdee (Mifflin-St Jeor)', () => {
  assert.equal(Math.round(calc.bmr(male)), 1749); // 800 + 1093.75 - 150 + 5
  assert.equal(Math.round(calc.tdee(male)), 2405); // 1748.75 × 1.375
  assert.equal(Math.round(calc.bmr(female)), 1249); // 550 + 1000 - 140 - 161
});

test('ICMR 2020 reference table', () => {
  assert.equal(calc.icmrReference(male), 2110);
  assert.equal(calc.icmrReference({ ...male, activity: 'moderate' }), 2710);
  assert.equal(calc.icmrReference({ ...male, activity: 'very' }), 3470);
  assert.equal(calc.icmrReference(female), 1660);
  assert.equal(calc.icmrReference({ ...female, activity: 'moderate' }), 2130);
  assert.equal(calc.icmrReference({ ...female, activity: 'active' }), 2720);
  assert.equal(calc.icmrReference({ ...female, condition: 'pregnant' }), 1660 + 350);
  assert.equal(calc.icmrReference({ ...female, condition: 'lactating0_6' }), 1660 + 600);
  assert.equal(calc.icmrReference({ ...female, condition: 'lactating7_12' }), 1660 + 520);
  assert.equal(Math.round(calc.tdee({ ...female, condition: 'pregnant' })), Math.round(calc.tdee(female)) + 350);
});

test('plans: lose weight, three options with safe floor', () => {
  const r = calc.buildPlans(male, 72);
  assert.equal(r.direction, 'lose');
  assert.equal(r.plans.length, 3);
  assert.equal(r.plans[1].delta, -500);
  assert.equal(r.plans[1].targetKcal, r.tdee - 500);
  assert.ok(r.plans[1].weeks > 10 && r.plans[1].weeks < 20);
  assert.ok(r.plans.every((p) => p.targetKcal >= r.floor));
  assert.ok(r.plans[2].eta);
});

test('plans: floor is enforced for small women', () => {
  const tiny = { ...female, weightKg: 48, heightCm: 150, age: 40 };
  const r = calc.buildPlans(tiny, 45);
  assert.ok(r.plans.every((p) => p.targetKcal >= 1200));
  assert.ok(r.plans.some((p) => p.capped));
});

test('plans: gain and maintain', () => {
  assert.equal(calc.buildPlans({ ...male, weightKg: 60 }, 68).direction, 'gain');
  assert.equal(calc.buildPlans(male, 80).direction, 'maintain');
  assert.equal(calc.buildPlans(male, null).direction, 'maintain');
});

test('macro targets are consistent with kcal', () => {
  const m = calc.macroTargets(male, 2000);
  const total = m.p * 4 + m.cb * 4 + m.f * 9;
  assert.ok(Math.abs(total - 2000) < 20, `got ${total}`);
  assert.ok(m.p >= 100 && m.p <= 175);
});

test('streaks', () => {
  const today = '2026-09-17';
  const e = [{ k: 100 }];
  assert.deepEqual(calc.streak({}, today).current, 0);
  assert.equal(calc.streak({ '2026-09-17': e, '2026-09-16': e, '2026-09-15': e }, today).current, 3);
  assert.equal(calc.streak({ '2026-09-16': e, '2026-09-15': e }, today).current, 2); // yesterday keeps streak alive
  assert.equal(calc.streak({ '2026-09-15': e, '2026-09-14': e }, today).current, 0);
  assert.equal(calc.bestStreak({ '2026-09-01': e, '2026-09-02': e, '2026-09-03': e, '2026-09-10': e }), 3);
  assert.equal(calc.streak({ '2026-09-17': [] }, today).current, 0);
});

test('on-target days and weekly average', () => {
  const logs = { '2026-09-17': [{ k: 1800 }], '2026-09-16': [{ k: 2600 }], '2026-09-15': [{ k: 1900 }] };
  const r = calc.onTargetDays(logs, 2000, 7, '2026-09-17'); // today (17th) is in progress and excluded
  assert.deepEqual(r, { hit: 1, logged: 2 });
  assert.equal(calc.weeklyAverage(logs, '2026-09-17'), 2100);
});
