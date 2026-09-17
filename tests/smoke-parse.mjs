// Dev helper: node tests/smoke-parse.mjs "2 roti and dal"
import './setup.mjs';
import * as foods from '../app/js/foods.js';
import { parse } from '../app/js/parser.js';
await foods.load();
const qs = process.argv.slice(2).length ? process.argv.slice(2) : [
  'a protein shake with 130 kilocalorie of energy and 27 gram of protein',
  'protein shake 130 kcal, 27 g protein, 5g carbs and 2 g fat',
  '2 roti and dal with rice', 'chicken breast 200 g with 45 g protein', 'my oats bowl 300 calories',
  'one cup tea with milk', 'protein shake 130 calories and some snacks around 80 calories'];
for (const q of qs) {
  const r = parse(q);
  console.log(q);
  for (const i of r.items) console.log('  ', JSON.stringify({ name: i.name, id: i.food?.id, g: i.grams, k: i.k, p: i.p, cb: i.cb, f: i.f, nf: i.newFood, c: i.confidence }));
}
