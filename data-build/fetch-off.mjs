// Downloads Open Food Facts products sold in India (nutrition facts completed) into data-build/sources/off-india.json.
// Run occasionally: node data-build/fetch-off.mjs   (≈ 2 minutes, polite 1 req/s). The build then filters/dedupes it.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const OUT = path.join(__dirname, 'sources', 'off-india.json');
const UA = 'CalorieMate-build/1.4 (https://github.com/Rash914/Calorie)';
const FIELDS = 'code,product_name,product_name_en,brands,quantity,serving_size,nutriments,categories_tags,unique_scans_n,countries_tags';
const PAGE = 100;
// search-a-licious (no CORS issue from Node, far more stable than cgi/search.pl). ES caps page*size at 10 000.
const QUERIES = ['countries_tags:"en:india" AND states_tags:"en:nutrition-facts-completed"', 'countries_tags:"en:india"'];
const base = (q, page) => `https://search.openfoodfacts.org/search?q=${encodeURIComponent(q)}&sort_by=-unique_scans_n&page_size=${PAGE}&page=${page}&fields=${FIELDS}`;

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
async function getJson(url, tries = 4) {
  for (let i = 0; i < tries; i++) {
    try {
      const res = await fetch(url, { headers: { 'User-Agent': UA, Accept: 'application/json' } });
      if (res.ok) return await res.json();
      console.warn('HTTP', res.status, 'retrying…');
    } catch (e) { console.warn('fetch error', e.message, 'retrying…'); }
    await sleep(3000 * (i + 1));
  }
  throw new Error('gave up: ' + url);
}

const all = new Map();
if (fs.existsSync(OUT + '.partial')) for (const p of JSON.parse(fs.readFileSync(OUT + '.partial', 'utf8'))) all.set(p.code, p); // resume
const keep = (p) => { if (p?.code) all.set(p.code, p); };
for (const q of QUERIES) {
  const first = await getJson(base(q, 1));
  const pages = Math.min(100, Math.ceil(first.count / PAGE));
  console.log(`query "${q}": ${first.count} products (${pages} pages)`);
  first.hits.forEach(keep);
  for (let page = 2; page <= pages; page++) {
    await sleep(400);
    const d = await getJson(base(q, page));
    if (!d.hits?.length) break;
    d.hits.forEach(keep);
    if (page % 10 === 0) { console.log(`  page ${page}/${pages} → ${all.size} products`); fs.writeFileSync(OUT + '.partial', JSON.stringify([...all.values()])); }
  }
}
// keep only fields we use, to keep the snapshot small
const slim = [...all.values()].map((p) => ({
  code: p.code, n: p.product_name_en || p.product_name || '', b: Array.isArray(p.brands) ? p.brands.join(', ') : (p.brands || ''), q: p.quantity || '', sv: p.serving_size || '',
  k: p.nutriments?.['energy-kcal_100g'], kj: p.nutriments?.energy_100g, p: p.nutriments?.proteins_100g, c: p.nutriments?.carbohydrates_100g, f: p.nutriments?.fat_100g, fb: p.nutriments?.fiber_100g, su: p.nutriments?.sugars_100g,
  cat: (p.categories_tags || []).slice(0, 6), scans: p.unique_scans_n || 0
}));
fs.writeFileSync(OUT, JSON.stringify(slim));
fs.rmSync(OUT + '.partial', { force: true });
console.log(`wrote ${slim.length} products → ${OUT} (${(fs.statSync(OUT).size / 1024).toFixed(0)} KB)`);
