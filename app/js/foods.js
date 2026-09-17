// Food database: loading, normalisation (Latin + Devanagari), fuzzy search.
import * as store from './store.js';

let DB = null;          // { foods, categories, ... }
let INDEX = [];         // [{ f, keys:[norm strings], tokens:Set, full }]
const byId = new Map();

// ---------------------------------------------------------------- Devanagari → Latin (rough, for matching only)
const DV_VOWELS = { 'अ': 'a', 'आ': 'aa', 'इ': 'i', 'ई': 'ee', 'उ': 'u', 'ऊ': 'oo', 'ऋ': 'ri', 'ए': 'e', 'ऐ': 'ai', 'ओ': 'o', 'औ': 'au', 'ऑ': 'o' };
const DV_MATRA = { 'ा': 'aa', 'ि': 'i', 'ी': 'ee', 'ु': 'u', 'ू': 'oo', 'ृ': 'ri', 'े': 'e', 'ै': 'ai', 'ो': 'o', 'ौ': 'au', 'ॉ': 'o', 'ं': 'n', 'ँ': 'n', 'ः': 'h', '्': '' };
const DV_CONS = {
  'क': 'k', 'ख': 'kh', 'ग': 'g', 'घ': 'gh', 'ङ': 'n', 'च': 'ch', 'छ': 'chh', 'ज': 'j', 'झ': 'jh', 'ञ': 'n',
  'ट': 't', 'ठ': 'th', 'ड': 'd', 'ढ': 'dh', 'ण': 'n', 'त': 't', 'थ': 'th', 'द': 'd', 'ध': 'dh', 'न': 'n',
  'प': 'p', 'फ': 'ph', 'ब': 'b', 'भ': 'bh', 'म': 'm', 'य': 'y', 'र': 'r', 'ल': 'l', 'व': 'v', 'श': 'sh', 'ष': 'sh', 'स': 's', 'ह': 'h',
  'क़': 'k', 'ख़': 'kh', 'ग़': 'g', 'ज़': 'z', 'ड़': 'r', 'ढ़': 'rh', 'फ़': 'f', 'ळ': 'l'
};
const DV_DIGITS = { '०': '0', '१': '1', '२': '2', '३': '3', '४': '4', '५': '5', '६': '6', '७': '7', '८': '8', '९': '9' };
const NUKTA = '़';

export function transliterate(s) {
  if (!/[ऀ-ॿ]/.test(s)) return s;
  let out = '';
  const chars = [...s];
  for (let i = 0; i < chars.length; i++) {
    let ch = chars[i];
    if (chars[i + 1] === NUKTA) { ch = ch + NUKTA; i++; }
    if (DV_CONS[ch] != null) {
      out += DV_CONS[ch];
      const next = chars[i + 1];
      const nextIsMatra = next != null && DV_MATRA[next] != null;
      const atWordEnd = next == null || !/[ऀ-ॿ]/.test(next);
      if (!nextIsMatra && !atWordEnd) out += 'a'; // inherent vowel (schwa) except word-final
    } else if (DV_MATRA[ch] != null) out += DV_MATRA[ch];
    else if (DV_VOWELS[ch] != null) out += DV_VOWELS[ch];
    else if (DV_DIGITS[ch] != null) out += DV_DIGITS[ch];
    else if (ch === '।') out += ' ';
    else out += ch;
  }
  return out;
}

/** Aggressive phonetic normalisation so "dhaal", "daal", "dal", "दाल" all collapse to the same key. */
export function norm(s) {
  let t = transliterate(String(s || '').toLowerCase()).normalize('NFKD').replace(/[̀-ͯ]/g, '');
  t = t.replace(/[^a-z0-9\s]/g, ' ');
  t = t.replace(/aa/g, 'a').replace(/ee/g, 'i').replace(/oo/g, 'u').replace(/ou/g, 'u');
  t = t.replace(/ph/g, 'f').replace(/w/g, 'v').replace(/z/g, 'j').replace(/q/g, 'k').replace(/ck/g, 'k').replace(/x/g, 'ks');
  t = t.replace(/chh/g, 'ch').replace(/ch/g, 'C'); // protect "ch" (chai, chapati) from the aspirate + c→k rules below
  t = t.replace(/c/g, 'k').replace(/C/g, 'c');
  t = t.replace(/([bdgjkptsh])h/g, '$1'); // aspirates: kh→k, gh→g, th→t, dh→d, bh→b, sh→s
  t = t.replace(/y/g, 'i');
  t = t.replace(/(.)\1+/g, '$1'); // collapse doubles
  t = t.replace(/\s+/g, ' ').trim();
  return t.split(' ').map((w) => (w.length > 3 && w.endsWith('s') && !w.endsWith('ss') ? w.slice(0, -1) : w)).join(' ');
}

const STOP = new Set(['the', 'a', 'an', 'of', 'vith', 'and', 'ka', 'ki', 'ke', 'ko', 'me', 'se', 'i', 'had', 'ate', 'some', 'one', 'plate', 'bovl', 'katori', 'piece', 'pice', 'cup', 'glas', 'gram', 'g', 'ml', 'kcal', 'calorie', 'kalori', 'small', 'medium', 'large', 'big']);

function bigrams(s) { const out = new Set(); const t = s.replace(/\s/g, ''); for (let i = 0; i < t.length - 1; i++) out.add(t.slice(i, i + 2)); return out; }
function dice(a, b) { if (!a.size || !b.size) return 0; let n = 0; for (const x of a) if (b.has(x)) n++; return (2 * n) / (a.size + b.size); }

// ---------------------------------------------------------------- loading
export async function load(url = './data/foods.json') {
  if (DB) return DB;
  const res = await fetch(url, { cache: 'force-cache' });
  if (!res.ok) throw new Error('Could not load food database');
  DB = await res.json();
  rebuildIndex();
  store.bus.on('change', rebuildCustom);
  return DB;
}
function entry(f) {
  const keys = [norm(f.n), ...(f.a || []).map(norm)].filter(Boolean);
  const tokens = new Set(keys.flatMap((k) => k.split(' ')));
  return { f, keys, tokens, full: keys.join(' | '), bg: bigrams(keys[0]) };
}
function rebuildIndex() {
  INDEX = [];
  byId.clear();
  for (const f of store.get().custom) { INDEX.push(entry(f)); byId.set(f.id, f); }
  for (const f of DB.foods) { INDEX.push(entry(f)); byId.set(f.id, f); }
}
function rebuildCustom() {
  // custom foods may change; cheap to rebuild only the custom section
  INDEX = INDEX.filter((e) => e.f.src !== 'custom');
  for (const id of [...byId.keys()]) if (id.startsWith('custom-')) byId.delete(id);
  for (const f of store.get().custom) { INDEX.unshift(entry(f)); byId.set(f.id, f); }
}

export const ready = () => !!DB;
export const getFood = (id) => byId.get(id) || null;
export const categories = () => DB?.categories || {};
export const count = () => INDEX.length;
export function byCategory(cat, limit = 400) { return INDEX.filter((e) => e.f.c === cat).map((e) => e.f).slice(0, limit); }
export function all() { return INDEX.map((e) => e.f); }

// ---------------------------------------------------------------- search
const TIER_BONUS = { '-1': 12, 0: 10, 1: 3, 2: 0 };

/**
 * Search foods. Returns [{food, score}] sorted by score desc.
 * @param {string} query
 * @param {{limit?:number, diet?:'all'|'veg'|'egg', recent?:string[]}} opts
 */
export function search(query, opts = {}) {
  const limit = opts.limit || 20;
  const q = norm(query);
  if (!q) return [];
  const qTokens = q.split(' ').filter((t) => t && !STOP.has(t));
  const qCore = qTokens.join(' ') || q;
  const qbg = bigrams(qCore);
  const recent = new Set(opts.recent || []);
  const diet = opts.diet || 'all';
  const results = [];
  for (const e of INDEX) {
    const f = e.f;
    if (diet === 'veg' && f.v !== 1) continue;
    if (diet === 'egg' && f.v === 3) continue;
    let score = 0;
    if (e.keys[0] === qCore || e.keys[0] === q) score = 100;
    else if (e.keys.includes(qCore) || e.keys.includes(q)) score = 92;
    else {
      const starts = e.keys.some((k) => k.startsWith(qCore + ' ') || k.startsWith(qCore));
      const allWhole = qTokens.length && qTokens.every((t) => e.tokens.has(t));
      const allPrefix = qTokens.length && qTokens.every((t) => t.length >= 2 && [...e.tokens].some((x) => x.startsWith(t)));
      if (starts && allWhole) score = 84;
      else if (allWhole) score = qTokens.length === 1 ? 62 : 74; // a lone word buried inside a longer alias is weak evidence
      else if (starts) score = 68;
      else if (allPrefix) score = 58;
      else {
        const sim = Math.max(dice(qbg, e.bg), ...(qTokens.length > 1 ? [] : e.keys.slice(1, 6).map((k) => dice(qbg, bigrams(k)))));
        if (sim >= 0.55) score = 30 + sim * 30;
        else if (qTokens.length > 1) {
          // partial token match: at least half of tokens present
          const hits = qTokens.filter((t) => e.tokens.has(t) || [...e.tokens].some((x) => x.startsWith(t) && t.length >= 3)).length;
          if (hits >= Math.ceil(qTokens.length / 2)) score = 20 + (hits / qTokens.length) * 25;
        }
      }
    }
    if (!score) continue;
    score += TIER_BONUS[f.t] || 0;
    if (recent.has(f.id)) score += 6;
    // shorter names win ties (e.g., "Chapati" over "Chapati with ghee")
    score -= Math.min(6, e.keys[0].length / 12);
    results.push({ food: f, score });
  }
  results.sort((a, b) => b.score - a.score);
  return results.slice(0, limit);
}

/** Best single match for a spoken/typed phrase, or null if not confident. */
export function bestMatch(phrase, opts = {}) {
  const r = search(phrase, { ...opts, limit: 3 });
  if (!r.length) return null;
  const top = r[0];
  if (top.score < (opts.minScore ?? 56)) return null;
  return top;
}

/** Nutrients for a given food and gram amount */
export function nutrientsFor(food, grams) {
  const k = grams / 100;
  return { k: food.k * k, p: food.p * k, cb: food.cb * k, f: food.f * k, fb: (food.fb || 0) * k };
}
