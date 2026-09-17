// Natural-language food log parser (English / Hindi / Hinglish, Latin or Devanagari).
// "I had 2 chapatis and a katori of dal, plus a protein shake of 130 calories"
//   → [{qty:2, phrase:'chapati'}, {qty:1, unit:'katori', phrase:'dal'}, {qty:1, phrase:'protein shake', kcal:130}]
import { norm, transliterate, bestMatch, nutrientsFor } from './foods.js';

const NUM_WORDS = {
  // English
  a: 1, an: 1, one: 1, two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7, eight: 8, nine: 9, ten: 10, eleven: 11, twelve: 12,
  half: 0.5, quarter: 0.25, couple: 2, dozen: 12, single: 1, double: 2, triple: 3,
  // Hindi / Hinglish (keys are passed through norm())
  ek: 1, do: 2, teen: 3, tin: 3, char: 4, chaar: 4, panch: 5, paanch: 5, che: 6, chhe: 6, chah: 6, chha: 6, saat: 7, sat: 7, aath: 8, ath: 8, nau: 9, das: 10, dus: 10,
  gyarah: 11, barah: 12, aadha: 0.5, adha: 0.5, aadhi: 0.5, adhi: 0.5, aadhe: 0.5, dedh: 1.5, derh: 1.5, dhai: 2.5, dhaai: 2.5, sava: 1.25, sawa: 1.25, pauna: 0.75, paune: 0.75,
  // Marathi / Gujarati / Tamil / Telugu / Kannada common
  tran: 3, onnu: 1, rendu: 2, moonu: 3, okati: 1, ondu: 1, eradu: 2, mooru: 3
};
const NUMS = new Map(Object.entries(NUM_WORDS).map(([k, v]) => [norm(k), v]));

// container units → default grams (used when the food has no matching serving)
const UNITS = {
  katori: 150, vati: 150, bowl: 150, bowls: 150, cup: 200, cups: 200, glass: 250, glasses: 250, plate: 250, plates: 250, thali: 500,
  piece: null, pieces: null, pcs: null, pc: null, nos: null, tukda: null, tukde: null,
  slice: null, slices: null, scoop: null, scoops: null,
  tbsp: 15, tablespoon: 15, tablespoons: 15, tsp: 5, teaspoon: 5, teaspoons: 5, spoon: 10, spoons: 10, chammach: 10, chamach: 10,
  handful: 30, handfuls: 30, mutthi: 30, muthi: 30, fistful: 30,
  packet: null, packets: null, pack: null, packs: null, pkt: null, bottle: null, bottles: null, can: null, cans: null, mug: 250, mugs: 250, tumbler: 150,
  serving: null, servings: null, portion: null, portions: null, helping: null, bar: null, bars: null, sachet: null, cube: null, cubes: null,
  g: 1, gm: 1, gms: 1, gram: 1, grams: 1, ml: 1, millilitre: 1, milliliter: 1, litre: 1000, liter: 1000, l: 1000, kg: 1000, kilo: 1000
};
const UNIT_KEYS = new Map(Object.keys(UNITS).map((k) => [norm(k), k]));
const WEIGHT_UNITS = new Set(['g', 'gm', 'gms', 'gram', 'grams', 'ml', 'millilitre', 'milliliter', 'litre', 'liter', 'l', 'kg', 'kilo']);
const SIZE = { small: 'small', chota: 'small', choti: 'small', chote: 'small', mini: 'small', little: 'small', big: 'large', large: 'large', bada: 'large', badi: 'large', bade: 'large', medium: 'medium', regular: 'medium', normal: 'medium', full: 'large', xl: 'large', jumbo: 'large' };
const SIZES = new Map(Object.entries(SIZE).map(([k, v]) => [norm(k), v]));

const FILLER = [
  'i had', 'i have had', 'i ate', 'i have eaten', 'i have', 'i took', 'i drank', 'i also had', 'i also ate', 'ive had', 'had', 'ate', 'eaten', 'drank', 'took',
  'for breakfast', 'for lunch', 'for dinner', 'for snacks', 'for snack', 'as a snack', 'in the morning', 'in the afternoon', 'in the evening', 'at night', 'this morning', 'tonight', 'today', 'yesterday',
  'maine', 'mene', 'mai ne', 'main ne', 'khaya', 'khayi', 'khaye', 'kha liya', 'khaya hai', 'piya', 'pi li', 'pi liya', 'liya', 'liye', 'li', 'aaj', 'subah', 'subah me', 'dopahar me', 'dopahar', 'sham ko', 'sham', 'raat ko', 'raat', 'naashte me', 'nashte me', 'nashta', 'naashta', 'lunch me', 'dinner me', 'ko', 'mein', 'me', 'tha', 'the', 'thi',
  'some', 'a bit of', 'a little', 'little', 'bit of', 'just', 'about', 'around', 'approximately', 'approx', 'roughly', 'like', 'only', 'nearly', 'almost', 'please', 'add', 'log', 'record', 'note', 'okay', 'ok', 'so', 'um', 'uh', 'hmm', 'thoda', 'thodi', 'thode', 'sa', 'si', 'se', 'wala', 'wali', 'wale', 'jo', 'that', 'which', 'it', 'was', 'is', 'were', 'of', 'ka', 'ki', 'ke'
].sort((a, b) => b.length - a.length);
const FILLER_RES = FILLER.map((f) => new RegExp('\\s' + f.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '\\s', 'g'));
const SPLIT_STRONG = /\s*(?:,|;|\band\b|\baur\b|\bplus\b|&|\bthen\b|\bafter that\b|\balso\b|\balong with\b|\bke saath\b|\bke sath\b|\bsaath me\b|\bsath me\b|\bfollowed by\b|\bor\b|\bund\b|\bor\b|\+)\s*/i;
const KCAL_RE = /(\d+(?:\.\d+)?)\s*(?:k\s?cal(?:ories?|s)?|kcals?|cal(?:ories?|s)?|kailori|kaloree|kalori|कैलोरी|केलोरी|कैलोरीज)\b/i;
// words that describe *a* food rather than *the* food – never auto-match these to a database item
const GENERIC = new Set(['snack', 'snacks', 'snek', 'food', 'foods', 'meal', 'meals', 'something', 'stuff', 'item', 'items', 'khana', 'khaana', 'nashta', 'naashta', 'lunch', 'dinner', 'breakfast', 'dish', 'sweets', 'sweet', 'mithai', 'dessert', 'drink', 'drinks', 'juice', 'shake', 'supplement', 'namkeen', 'chips', 'biscuit', 'biscuits', 'cookie', 'cookies', 'chocolate', 'fruit', 'fruits', 'veg', 'vegetables', 'sabzi', 'sabji', 'curry', 'rice', 'bread', 'salad', 'soup'].map((w) => norm(w)));
const MEAL_HINT = [
  [/\b(breakfast|nashta|naashta|nashte|subah|morning|brekkie)\b/i, 'breakfast'],
  [/\b(lunch|dopahar|afternoon|noon)\b/i, 'lunch'],
  [/\b(snack|snacks|evening|sham|shaam|tea time|teatime)\b/i, 'snacks'],
  [/\b(dinner|raat|night|tonight)\b/i, 'dinner']
];

function numberFromToken(tok) {
  if (/^\d+(\.\d+)?$/.test(tok)) return parseFloat(tok);
  if (/^\d+\/\d+$/.test(tok)) { const [a, b] = tok.split('/').map(Number); return b ? a / b : NaN; }
  const n = NUMS.get(norm(tok));
  return n == null ? NaN : n;
}

function preprocess(text) {
  let t = transliterate(String(text || '')).toLowerCase();
  t = t.replace(/½/g, ' 0.5 ').replace(/¼/g, ' 0.25 ').replace(/¾/g, ' 0.75 ').replace(/[“”"’']/g, '');
  t = t.replace(/(\d+)\s*(?:and|aur)\s*(?:a\s+)?half\b/g, (_, n) => String(parseFloat(n) + 0.5));
  t = t.replace(/\b(one|two|three|four|five|six|ek|do|teen|char|panch)\s+(?:and|aur)\s+(?:a\s+)?(?:half|aadha|adha)\b/g, (_, w) => String((NUMS.get(norm(w)) || 0) + 0.5));
  t = t.replace(/\b(\d+)\s*-\s*(\d+)\b/g, (_, a, b) => String((+a + +b) / 2)); // "2-3 rotis" → 2.5
  t = t.replace(/(\d)([a-z])/g, '$1 $2'); // "2chapati" / "100g" → "2 chapati" / "100 g"
  return t;
}

function stripFiller(seg) {
  let s = ' ' + seg.replace(/[^\p{L}\p{N}\s./]/gu, ' ').replace(/\s+/g, ' ').trim() + ' ';
  for (const re of FILLER_RES) s = s.replace(re, ' ');
  return s.replace(/\s+/g, ' ').trim();
}

function parseSegment(raw, meal) {
  let seg = raw;
  let kcal = null;
  const km = KCAL_RE.exec(seg);
  if (km) { kcal = parseFloat(km[1]); seg = seg.replace(km[0], ' '); seg = seg.replace(/\b(of|worth|around|about|approx|approximately|which had|which has|that had|having|with|wala|wali|ka|ki|ke|jo|tha|thi|the)\b\s*$/i, '').trim(); }
  seg = stripFiller(seg);
  const tokens = seg.split(' ').filter(Boolean);
  let qty = null, unit = null, size = null, unitGrams = null;
  const rest = [];
  for (let i = 0; i < tokens.length; i++) {
    const tok = tokens[i];
    const n = numberFromToken(tok);
    if (qty == null && Number.isFinite(n) && (tok.length > 1 || /^\d$/.test(tok) || tok === 'a')) {
      // "a" only counts as 1 when it precedes a unit or is at the start
      if (tok === 'a' || tok === 'an') { const nxt = tokens[i + 1]; if (i !== 0 && !(nxt && UNIT_KEYS.has(norm(nxt)))) { rest.push(tok); continue; } }
      qty = n; continue;
    }
    const uk = UNIT_KEYS.get(norm(tok));
    if (uk && !unit && rest.length === 0) { unit = uk; unitGrams = UNITS[uk]; continue; }
    if (uk && !unit && qty != null && i === tokens.length - 1) { unit = uk; unitGrams = UNITS[uk]; continue; }
    const sz = SIZES.get(norm(tok));
    if (sz && !size) { size = sz; continue; }
    if (tok === 'of' || tok === 'ka' || tok === 'ki' || tok === 'ke') continue;
    rest.push(tok);
  }
  // trailing unit word ("dal 1 katori") handled above; also "dal ek katori" where number after phrase
  const phrase = rest.join(' ').trim();
  if (!phrase && !kcal) return null;
  return { raw: raw.trim(), phrase, qty: qty ?? 1, unit, unitGrams, size, kcal, meal };
}

function splitSegments(text) {
  const out = [];
  for (const part of text.split(SPLIT_STRONG)) {
    const p = (part || '').trim();
    if (!p) continue;
    // split "2 roti 1 katori dal" at a number that starts a new item
    const toks = p.split(/\s+/);
    let cur = [];
    let hasFoodWord = false, hasNum = false;
    for (const tok of toks) {
      const isNum = Number.isFinite(numberFromToken(tok)) && tok !== 'a' && tok !== 'an';
      if (isNum && hasFoodWord && hasNum) { out.push(cur.join(' ')); cur = []; hasFoodWord = false; hasNum = false; }
      if (isNum) hasNum = true;
      else if (!UNIT_KEYS.has(norm(tok)) && !SIZES.has(norm(tok)) && !FILLER.includes(tok) && !NUMS.has(norm(tok))) hasFoodWord = true;
      cur.push(tok);
    }
    if (cur.length) out.push(cur.join(' '));
  }
  return out;
}

/**
 * Parse free text into log items. `opts.match(phrase)` → {food, score} | null (defaults to foods.bestMatch).
 * Returns { items: [...], meal: 'breakfast'|null }
 */
export function parse(text, opts = {}) {
  const match = opts.match || ((phrase) => bestMatch(phrase, { diet: opts.diet, recent: opts.recent }));
  const pre = preprocess(text);
  let meal = null;
  for (const [re, m] of MEAL_HINT) if (re.test(pre)) { meal = m; break; }
  const items = [];
  const segments = [];
  for (const seg of splitSegments(pre)) {
    if (/\bwith\b|\bke sath\b|\bke saath\b/.test(seg) && !KCAL_RE.test(seg)) {
      // "dal with rice" → two items unless the whole phrase is itself a known dish ("tea with milk")
      const whole = parseSegment(seg, meal);
      const m = whole?.phrase ? match(whole.phrase) : null;
      if (m && m.score >= 80) { segments.push(seg); continue; }
      for (const s of seg.split(/\bwith\b|\bke sath\b|\bke saath\b/)) if (s.trim()) segments.push(s.trim());
    } else segments.push(seg);
  }
  for (const seg of segments) {
    const it = parseSegment(seg, meal);
    if (!it) continue;
    // generic words ("snacks", "something") only match when no label calories were given
    let m = it.phrase && !(it.kcal != null && GENERIC.has(norm(it.phrase))) ? match(it.phrase) : null;
    // retry without a leading/trailing generic word ("some", "plain") if no match
    if (!m && it.phrase.split(' ').length > 1) {
      const words = it.phrase.split(' ');
      m = match(words.slice(1).join(' ')) || match(words.slice(0, -1).join(' '));
    }
    items.push(resolve(it, m));
  }
  return { items, meal };
}

/** Turn a parsed segment + match into a concrete log item with grams and nutrients. */
export function resolve(it, m) {
  const food = m?.food || null;
  let grams = 0, unitLabel = '', name = it.phrase ? titleCase(it.phrase) : 'Food';
  if (food) {
    name = food.n;
    const servings = food.s || [['1 serving (100 g)', 100]];
    if (it.unit && WEIGHT_UNITS.has(it.unit)) {
      grams = it.qty * (UNITS[it.unit] || 1);
      unitLabel = it.unit === 'ml' || it.unit === 'l' || it.unit === 'litre' || it.unit === 'liter' ? `${grams} ml` : `${grams} g`;
    } else if (it.unit) {
      const u = norm(it.unit).replace(/s$/, '');
      const sv = servings.find((s) => norm(s[0]).includes(u)) || (it.size ? servings.find((s) => norm(s[0]).includes(it.size)) : null);
      if (sv) { grams = sv[1] * it.qty; unitLabel = `${fmtQty(it.qty)} × ${sv[0]}`; }
      else if (it.unitGrams) { grams = it.unitGrams * it.qty * sizeFactor(it.size); unitLabel = `${fmtQty(it.qty)} ${it.size ? it.size + ' ' : ''}${it.unit}`; }
      else { grams = servings[0][1] * it.qty * sizeFactor(it.size); unitLabel = `${fmtQty(it.qty)} × ${servings[0][0]}`; }
    } else {
      let sv = servings[0];
      if (it.size) sv = servings.find((s) => norm(s[0]).includes(it.size)) || sv;
      const scale = it.size && sv === servings[0] ? sizeFactor(it.size) : 1;
      grams = sv[1] * it.qty * scale;
      unitLabel = `${fmtQty(it.qty)} × ${sv[0]}`;
    }
  } else if (it.unit && WEIGHT_UNITS.has(it.unit)) {
    grams = it.qty * (UNITS[it.unit] || 1); unitLabel = `${grams} g`;
  } else {
    unitLabel = `${fmtQty(it.qty)}${it.unit ? ' ' + it.unit : ''}`;
  }
  let nut = food ? nutrientsFor(food, grams) : { k: 0, p: 0, cb: 0, f: 0, fb: 0 };
  if (it.kcal != null && it.phrase && (!food || (m?.score || 0) < 74)) name = titleCase(it.phrase); // label calories: keep the user's own words unless the match is strong
  if (it.kcal != null) {
    // user-declared calories (from a label) win; scale macros of the matched food to keep ratios
    const ratio = nut.k > 0 ? it.kcal / nut.k : 0;
    nut = { k: it.kcal, p: nut.p * ratio, cb: nut.cb * ratio, f: nut.f * ratio, fb: nut.fb * ratio };
  }
  return {
    raw: it.raw, phrase: it.phrase, qty: it.qty, unit: it.unit, size: it.size, kcalOverride: it.kcal, meal: it.meal,
    food, score: m?.score || 0, name, grams: Math.round(grams), unitLabel, ...roundNut(nut),
    confidence: it.kcal != null ? 'label' : !food ? 'none' : m.score >= 80 ? 'high' : m.score >= 60 ? 'medium' : 'low'
  };
}
function sizeFactor(size) { return size === 'small' ? 0.7 : size === 'large' ? 1.35 : 1; }
function fmtQty(q) { return Number.isInteger(q) ? String(q) : String(Math.round(q * 100) / 100); }
function roundNut(n) { return { k: Math.round(n.k), p: r1(n.p), cb: r1(n.cb), f: r1(n.f), fb: r1(n.fb) }; }
function r1(x) { return Math.round(x * 10) / 10; }
function titleCase(s) { return s.replace(/\b\p{L}/gu, (c) => c.toUpperCase()); }
