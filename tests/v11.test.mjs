import './setup.mjs';
import test from 'node:test';
import assert from 'node:assert/strict';
import * as foods from '../app/js/foods.js';
import * as store from '../app/js/store.js';
import * as calc from '../app/js/calc.js';
import { parse } from '../app/js/parser.js';

await foods.load();

test('spoken nutrition creates a new food item', () => {
  const r = parse('a protein shake with 130 kilocalorie of energy and 27 gram of protein');
  assert.equal(r.items.length, 1);
  const it = r.items[0];
  assert.equal(it.k, 130); assert.equal(it.p, 27); assert.equal(it.newFood, true); assert.equal(it.name, 'Protein Shake');
  const r2 = parse('protein shake 130 kcal, 27 g protein, 5g carbs and 2 g fat');
  assert.equal(r2.items.length, 1);
  assert.deepEqual([r2.items[0].k, r2.items[0].p, r2.items[0].cb, r2.items[0].f], [130, 27, 5, 2]);
  const r3 = parse('protein of 25 grams and 120 calories in my shake');
  assert.equal(r3.items.length, 1); assert.equal(r3.items[0].p, 25); assert.equal(r3.items[0].k, 120);
});

test('spoken macros on a known food keep DB energy; "with" splitting still works', () => {
  const r = parse('chicken breast 200 g with 45 g protein');
  assert.equal(r.items.length, 1); assert.equal(r.items[0].p, 45); assert.equal(r.items[0].k, 330);
  assert.deepEqual(parse('dal with rice').items.map((i) => i.food.id), ['dal-tadka', 'rice-white']);
  assert.equal(parse('2 roti and 1 katori dal').items.length, 2);
});

test('BMI scale follows ethnicity', () => {
  assert.equal(calc.bmiCategory(24, 'asian').key, 'over');
  assert.equal(calc.bmiCategory(24, 'other').key, 'normal');
  assert.equal(calc.bmiCategory(27, 'other').key, 'over');
  assert.equal(calc.bmiCategory(31, 'other').key, 'obese1');
  assert.equal(calc.bmiCategory(36, 'other').key, 'obese2');
  assert.equal(Math.round(calc.healthyWeightRange(175, 'other')[1]), 76);
  assert.equal(Math.round(calc.healthyWeightRange(175, 'asian')[1]), 70);
});

test('water target and logging', () => {
  assert.equal(calc.waterTarget({ weightKg: 70, activity: 'sedentary', condition: 'none' }), 2450);
  assert.equal(calc.waterTarget({ weightKg: 40, activity: 'sedentary', condition: 'none' }), 1500);
  assert.equal(calc.waterTarget({ weightKg: 150, activity: 'very', condition: 'none' }), 4000);
  store.resetAll();
  store.addWater('2026-09-17', 250); store.addWater('2026-09-17', 500);
  assert.equal(store.waterFor('2026-09-17'), 750);
  store.addWater('2026-09-17', -1000);
  assert.equal(store.waterFor('2026-09-17'), 0);
  assert.equal(store.get().water['2026-09-17'], undefined);
});

test('per-device override of a preloaded food flows into search, parser and getFood', () => {
  store.resetAll();
  const base = foods.getFood('whey-protein');
  assert.equal(base.p, 75);
  store.setOverride('whey-protein', { k: 400, p: 93, cb: 10, f: 6, fb: 1 }); // 28 g protein per 30 g scoop
  const f = foods.getFood('whey-protein');
  assert.equal(f.p, 93); assert.equal(f.edited, true);
  assert.equal(foods.search('protein shake')[0].food.p, 93);
  assert.equal(parse('1 scoop protein shake').items[0].p, 27.9);
  assert.equal(foods.baseFood('whey-protein').p, 75);
  store.clearOverride('whey-protein');
  assert.equal(foods.getFood('whey-protein').p, 75);
  assert.equal(foods.getFood('whey-protein').edited, undefined);
});

test('overrides survive export/import and hostile keys are dropped', () => {
  store.resetAll();
  store.setOverride('chapati', { k: 250, p: 8, cb: 48, f: 3, fb: 5 });
  const json = store.exportJSON();
  store.resetAll();
  store.importJSON(json, 'replace');
  assert.equal(store.getOverride('chapati').k, 250);
  store.importJSON(JSON.stringify({ app: 'aahar', data: { overrides: { '__proto__': { k: 1 }, 'a b': { k: 1 }, 'ok-id': { k: 'x', p: -1 } } } }), 'replace');
  assert.deepEqual(Object.keys(store.get().overrides), ['ok-id']);
  assert.equal(store.get().overrides['ok-id'].k, 0);
});

test('profile ethnicity sanitized', () => {
  store.resetAll();
  store.setProfile({ ethnicity: 'martian' });
  assert.equal(store.get().profile.ethnicity, 'asian');
  store.setProfile({ ethnicity: 'other' });
  assert.equal(store.get().profile.ethnicity, 'other');
});

test('open food facts mapping', async () => {
  const { mapProduct } = await import('../app/js/off.js');
  const f = mapProduct({ code: '8901058851304', brands: ['Nestle'], countries_tags: ['en:india'], product_name: 'Maggi Masala Noodles', serving_size: '70 g', nutriments: { 'energy-kcal_100g': 427, proteins_100g: 8, carbohydrates_100g: 63.5, fat_100g: 15.7, fiber_100g: 3.6 } });
  assert.equal(f.k, 427); assert.equal(f.p, 8); assert.equal(f.india, true); assert.equal(f.s[0][1], 70); assert.match(f.n, /Nestle/);
  assert.equal(mapProduct({ product_name: 'x', nutriments: {} }), null);
  assert.equal(mapProduct({ product_name: 'kJ only', nutriments: { energy_100g: 1000 } }).k, 239);
});

test('search stays fast on the bigger database', () => {
  const qs = ['paneer', 'chicken biryani', 'dal', 'kfc zinger', 'protien shake', 'दाल', 'xyzzy'];
  const t0 = performance.now();
  for (let i = 0; i < 3; i++) for (const q of qs) foods.search(q);
  const per = (performance.now() - t0) / (3 * qs.length);
  assert.ok(per < 60, `avg ${per.toFixed(1)} ms per search`);
  assert.ok(foods.count() >= 2800, `count ${foods.count()}`);
});
