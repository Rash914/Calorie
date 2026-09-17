// Open Food Facts lookup (free, no key). Results are mapped to the app's food shape (per 100 g) and saved as
// custom foods when logged, so they work offline afterwards.
// Resilience: 8 s timeout per attempt, two mirrors, retry with backoff, in-memory cache; inside the Android app
// requests go through CapacitorHttp (native), so CORS never applies there.
const FIELDS = 'code,product_name,product_name_en,brands,quantity,serving_size,nutriments,countries_tags';
// cgi/search.pl sends CORS headers (search.openfoodfacts.org does not, so it is only usable natively)
const MIRRORS = ['https://world.openfoodfacts.org/cgi/search.pl', 'https://in.openfoodfacts.org/cgi/search.pl'];
const NATIVE_FAST = 'https://search.openfoodfacts.org/search';
const cache = new Map();

const num = (v) => { const n = Number(v); return Number.isFinite(n) && n >= 0 ? n : null; };
const isNative = () => typeof window !== 'undefined' && !!window.Capacitor?.isNativePlatform?.();

async function getJson(url, ms = 8000) {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), ms);
  try {
    const res = await fetch(url, { signal: ctrl.signal, headers: { Accept: 'application/json' } });
    if (!res.ok) throw new Error('HTTP ' + res.status);
    return await res.json();
  } finally { clearTimeout(t); }
}

/** Search OFF for `query`. Throws a friendly error only when every attempt fails. */
export async function searchOnline(query, { limit = 12 } = {}) {
  const q = String(query || '').trim().toLowerCase();
  if (q.length < 2) return [];
  if (cache.has(q)) return cache.get(q);
  const attempts = [];
  if (isNative()) attempts.push(`${NATIVE_FAST}?q=${encodeURIComponent(q)}&page_size=${limit * 2}&fields=${FIELDS}`);
  for (const m of MIRRORS) attempts.push(`${m}?search_terms=${encodeURIComponent(q)}&search_simple=1&action=process&json=1&page_size=${limit * 2}&fields=${FIELDS}`);
  let products = null;
  for (let round = 0; round < 2 && !products; round++) {
    for (const url of attempts) {
      try {
        const d = await getJson(url);
        const list = d.products || d.hits;
        if (Array.isArray(list)) { products = list; break; }
      } catch { /* try the next mirror */ }
    }
    if (!products && round === 0) await new Promise((r) => setTimeout(r, 1500));
  }
  if (!products) throw new Error(typeof navigator !== 'undefined' && navigator.onLine === false ? 'You are offline' : 'Open Food Facts is not responding — try again in a moment');
  products = products.slice().sort((a, b) => Number(isIndia(b)) - Number(isIndia(a)));
  const out = [];
  for (const p of products) { const f = mapProduct(p); if (f) out.push(f); if (out.length >= limit) break; }
  cache.set(q, out);
  return out;
}

/** Map an OFF product to our food shape; returns null when energy is missing. */
export function mapProduct(p) {
  const n = p?.nutriments || {};
  let k = num(n['energy-kcal_100g']);
  if (k == null && num(n.energy_100g) != null) k = num(n.energy_100g) / 4.184; // kJ
  if (k == null || k > 900) return null;
  const name = String(p.product_name_en || p.product_name || '').trim();
  if (!name) return null;
  const brand = (Array.isArray(p.brands) ? p.brands[0] : String(p.brands || '').split(',')[0] || '').trim();
  const sv = parseServing(p.serving_size);
  const pack = sv ? null : parseServing(p.quantity, 300);
  const servings = [];
  if (sv) servings.push([`1 serving (${Math.round(sv)} g)`, sv]);
  else if (pack) servings.push([`1 pack (${Math.round(pack)} g)`, pack]);
  servings.push(['100 g', 100]);
  return {
    id: 'off-' + String(p.code || name).replace(/[^\w-]/g, '').slice(0, 40),
    n: brand && !name.toLowerCase().includes(brand.toLowerCase()) ? `${name} (${brand})` : name,
    a: [], c: 'packaged', v: 1,
    k: Math.round(k), p: num(n.proteins_100g) ?? 0, cb: num(n.carbohydrates_100g) ?? 0, f: num(n.fat_100g) ?? 0, fb: num(n.fiber_100g) ?? 0,
    s: servings, src: 'off', t: 3, india: isIndia(p), code: p.code ? String(p.code) : null
  };
}

const isIndia = (p) => Array.isArray(p?.countries_tags) && p.countries_tags.some((t) => /india/.test(t));

/** "70 g", "250ml", "1 pack (30g)" → grams; `max` rejects large pack quantities */
export function parseServing(s, max = 5000) {
  if (!s) return null;
  const m = /(\d+(?:[.,]\d+)?)\s*(g|ml|gm|gram|grams)\b/i.exec(String(s));
  if (!m) return null;
  const v = parseFloat(m[1].replace(',', '.'));
  return v > 0 && v <= max ? v : null;
}
