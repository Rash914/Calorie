import './setup.mjs';
import test from 'node:test';
import assert from 'node:assert/strict';
import * as foods from '../app/js/foods.js';
import { parse } from '../app/js/parser.js';

await foods.load();

const ids = (r) => r.items.map((i) => i.food?.id || null);

test('database loaded with enough foods', () => {
  assert.ok(foods.count() >= 2000, `only ${foods.count()} foods`);
});

test('search: exact and alias matches rank first', () => {
  assert.equal(foods.search('chapati')[0].food.id, 'chapati');
  assert.equal(foods.search('roti')[0].food.id, 'chapati');
  assert.equal(foods.search('रोटी')[0].food.id, 'chapati');
  assert.equal(foods.search('dal')[0].food.id, 'dal-tadka');
  assert.equal(foods.search('daal')[0].food.id, 'dal-tadka');
  assert.equal(foods.search('samosa')[0].food.id, 'samosa');
  assert.equal(foods.search('paneer tikka')[0].food.id, 'paneer-tikka');
  assert.equal(foods.search('anda')[0].food.id, 'boiled-egg');
  assert.equal(foods.search('maggi')[0].food.id, 'maggi');
  assert.equal(foods.search('chai')[0].food.id, 'chai');
  assert.equal(foods.search('doodh')[0].food.id, 'milk-full');
});

test('search: typos / phonetic variants', () => {
  assert.equal(foods.search('chapathi')[0].food.id, 'chapati');
  assert.equal(foods.search('bhindi masla')[0].food.id, 'bhindi-masala');
  assert.equal(foods.search('rasgula')[0].food.id, 'rasgulla');
  assert.equal(foods.search('idlee')[0].food.id, 'idli');
  assert.equal(foods.search('gulab jamoon')[0].food.id, 'gulab-jamun');
});

test('search: diet filter', () => {
  const veg = foods.search('chicken', { diet: 'veg' });
  assert.ok(veg.every((r) => r.food.v === 1));
});

test('parse: english multi-item with quantities', () => {
  const r = parse('I had 2 chapatis and a katori of dal');
  assert.deepEqual(ids(r), ['chapati', 'dal-tadka']);
  assert.equal(r.items[0].qty, 2);
  assert.equal(r.items[0].grams, 90);
  assert.equal(r.items[0].k, 207);
  assert.equal(r.items[1].qty, 1);
  assert.equal(r.items[1].unit, 'katori');
  assert.equal(r.items[1].grams, 150);
});

test('parse: label calories override', () => {
  const r = parse('protein shake 130 calories and some snacks around 80 calories');
  assert.equal(r.items.length, 2);
  assert.equal(r.items[0].k, 130);
  assert.equal(r.items[0].confidence, 'label');
  assert.equal(r.items[1].k, 80);
  assert.match(r.items[1].name, /snack/i);
});

test('parse: "of 130 kcal" phrasing', () => {
  const r = parse('a protein shake of 130 kcal');
  assert.equal(r.items.length, 1);
  assert.equal(r.items[0].k, 130);
});

test('parse: hinglish numbers and units', () => {
  const r = parse('do roti aur ek katori dal aur adha glass doodh');
  assert.deepEqual(ids(r), ['chapati', 'dal-tadka', 'milk-full']);
  assert.equal(r.items[0].qty, 2);
  assert.equal(r.items[1].grams, 150);
  assert.equal(r.items[2].qty, 0.5);
  assert.equal(r.items[2].grams, 125);
});

test('parse: devanagari', () => {
  const r = parse('दो रोटी और एक कटोरी दाल');
  assert.deepEqual(ids(r), ['chapati', 'dal-tadka']);
  assert.equal(r.items[0].qty, 2);
});

test('parse: grams and ml', () => {
  const r = parse('100 g paneer, 250 ml milk');
  assert.deepEqual(ids(r), ['paneer', 'milk-full']);
  assert.equal(r.items[0].grams, 100);
  assert.equal(r.items[0].k, 290);
  assert.equal(r.items[1].grams, 250);
});

test('parse: number after food, size words, half', () => {
  const r = parse('idli 3, 1 large samosa, half plate biryani');
  assert.deepEqual(ids(r), ['idli', 'samosa', 'veg-biryani']);
  assert.equal(r.items[0].qty, 3);
  assert.equal(r.items[0].grams, 120);
  assert.equal(r.items[1].grams, 110);
  assert.equal(r.items[2].grams, 150); // half of the biryani 'plate' serving (300 g)
});

test('parse: consecutive items without conjunction', () => {
  const r = parse('2 roti 1 katori dal 1 bowl rice');
  assert.deepEqual(ids(r), ['chapati', 'dal-tadka', 'rice-white']);
});

test('parse: "tea with milk" stays one item, "dal with rice" splits', () => {
  const a = parse('one cup tea with milk');
  assert.equal(a.items.length, 1);
  assert.equal(a.items[0].food.id, 'chai');
  const b = parse('dal with rice');
  assert.deepEqual(ids(b), ['dal-tadka', 'rice-white']);
});

test('parse: meal hint', () => {
  assert.equal(parse('for breakfast I had poha').meal, 'breakfast');
  assert.equal(parse('raat ko 2 roti').meal, 'dinner');
  assert.equal(parse('2 roti').meal, null);
});

test('parse: unknown food is kept as unmatched item', () => {
  const r = parse('1 plate xyzzyfoo');
  assert.equal(r.items.length, 1);
  assert.equal(r.items[0].food, null);
  assert.equal(r.items[0].confidence, 'none');
});

test('parse: empty / junk', () => {
  assert.equal(parse('').items.length, 0);
  assert.equal(parse('   ,, and ').items.length, 0);
});
