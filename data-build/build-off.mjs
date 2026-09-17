// Turns data-build/sources/off-india.json (Open Food Facts snapshot) into app/data/foods-off.json.gz — the lazily
// loaded packaged-product catalogue. Filters junk, checks energy vs macros, dedupes, and skips foods already curated.
import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';

const NONVEG = /\b(chicken|mutton|meat|keema|fish|prawn|shrimp|tuna|salmon|sardine|crab|lamb|beef|pork|ham|bacon|salami|sausage|pepperoni|egg|omelette|anda)\b/i;
const EGG = /\b(egg|mayonnaise|mayo|cake|pastry|muffin|brownie|custard|meringue)\b/i;
const CAT = [
  [/beverage|drink|juice|water|soda|tea|coffee|milk(?!\s*chocolate)|lassi|shake|smoothie|energy-drink|soft-drink|dairy-drink/i, 'beverages'],
  [/chocolate|candy|confectioner|sweet|dessert|ice-cream|biscuit|cookie|cake|wafer|halwa|mithai/i, 'sweets'],
  [/chips|crisp|snack|namkeen|popcorn|nuts|extruded|puffs|mixture/i, 'packaged'],
  [/cereal|breakfast|oat|muesli|granola|flakes/i, 'breakfast'],
  [/spread|sauce|ketchup|pickle|chutney|jam|honey|condiment|dressing|mayonnaise/i, 'condiments'],
  [/noodle|pasta|instant|ready|meal/i, 'packaged'],
  [/yogurt|yoghurt|curd|cheese|paneer|butter|ghee|dairy|cream/i, 'dairy'],
  [/flour|rice|pulse|lentil|dal|legume|grain|atta|besan|sooji/i, 'raw'],
  [/oil|fat/i, 'oils'],
  [/protein|whey|supplement|nutrition/i, 'fitness']
];
const clean = (s) => String(s || '').replace(/\s+/g, ' ').replace(/[\u0000-\u001f]/g, '').trim();
const num = (v) => { const n = Number(v); return Number.isFinite(n) && n >= 0 ? n : null; };
const cap = (s) => s.replace(/\b([a-z])/g, (m) => m.toUpperCase());
function parseServing(s, max = 5000) {
  const m = /(\d+(?:[.,]\d+)?)\s*(g|ml|gm|gram|grams)\b/i.exec(String(s || ''));
  if (!m) return null; const v = parseFloat(m[1].replace(',', '.')); return v > 0 && v <= max ? v : null;
}

/** @param {Set<string>} nameIndex normalised curated names to skip; @param {(s)=>string} norm */
export function buildOff(srcPath, outDir, nameIndex, norm) {
  if (!fs.existsSync(srcPath)) { console.log('off: no snapshot, skipping extra tier'); return { count: 0 }; }
  const src = JSON.parse(fs.readFileSync(srcPath, 'utf8'));
  const seen = new Set();
  const out = [];
  let dropped = { name: 0, energy: 0, macros: 0, atwater: 0, dup: 0, curated: 0 };
  for (const p of src) {
    const name = clean(p.n);
    if (name.length < 3 || name.length > 90 || !/[a-z0-9]/i.test(name) || /[\u0400-\u04FF\u0600-\u06FF\u4E00-\u9FFF]/.test(name)) { dropped.name++; continue; } // skip non-Latin catalogue entries
    let k = num(p.k); if (k == null && num(p.kj) != null) k = num(p.kj) / 4.184;
    if (k == null && num(p.p) != null && num(p.c) != null && num(p.f) != null) k = 4 * num(p.p) + 4 * num(p.c) + 9 * num(p.f); // label without energy line
    if (k == null || k > 900 || (k === 0 && !/water|soda|zero|diet|sugar[- ]free/i.test(name))) { dropped.energy++; continue; }
    const pr = num(p.p), cb = num(p.c), f = num(p.f);
    if (pr == null || cb == null || f == null || pr > 100 || cb > 100 || f > 100) { dropped.macros++; continue; }
    const est = 4 * pr + 4 * cb + 9 * f;
    if (k > 30 && Math.abs(est - k) > Math.max(40, 0.3 * k)) { dropped.atwater++; continue; }
    const brand = clean(p.b).split(',')[0];
    const display = brand && !name.toLowerCase().includes(brand.toLowerCase()) ? `${cap(name)} (${cap(brand)})` : cap(name);
    const key = norm(display);
    if (seen.has(key)) { dropped.dup++; continue; }
    if (nameIndex.has(norm(name))) { dropped.curated++; continue; }
    seen.add(key);
    const cats = (p.cat || []).join(' ');
    const text = `${name} ${cats}`;
    let c = 'packaged';
    for (const [re, cat] of CAT) if (re.test(text)) { c = cat; break; }
    const sv = parseServing(p.sv), pack = sv ? null : parseServing(p.q, 300);
    const servings = [];
    if (sv) servings.push([`1 serving (${Math.round(sv)} g)`, sv]);
    else if (pack) servings.push([`1 pack (${Math.round(pack)} g)`, pack]);
    servings.push(['100 g', 100]);
    const v = NONVEG.test(text) ? 3 : EGG.test(text) ? 2 : 1;
    out.push({ id: 'off-' + String(p.code).replace(/[^\w-]/g, '').slice(0, 20), n: display, a: brand ? [brand] : [], c, v, k: Math.round(k), p: r1(pr), cb: r1(cb), f: r1(f), fb: r1(Math.min(num(p.fb) ?? 0, cb)), s: servings, src: 'off', t: 3 });
  }
  out.sort((a, b) => a.n.localeCompare(b.n));
  const version = Number(new Date().toISOString().replace(/[-T:]/g, '').slice(0, 12));
  const data = { version, count: out.length, source: 'Open Food Facts (India) snapshot, ODbL', foods: out };
  fs.writeFileSync(path.join(outDir, 'foods-off.json.gz'), zlib.gzipSync(JSON.stringify(data), { level: 9 }));
  console.log(`off tier: kept ${out.length} of ${src.length} (dropped: ${Object.entries(dropped).map(([k, v]) => `${k} ${v}`).join(', ')}) → foods-off.json.gz ${(fs.statSync(path.join(outDir, 'foods-off.json.gz')).size / 1024).toFixed(0)} KB`);
  return { count: out.length, version };
}
const r1 = (x) => Math.round(x * 10) / 10;
