// Food database: loading, normalisation (Latin + Devanagari), fuzzy search.
import * as store from './store.js';
import { emitter } from './util.js';

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
// Bundled copy (gzip) ships with the app; a newer copy published at REMOTE is downloaded once and kept in IndexedDB.
export const REMOTE = 'https://rash914.github.io/Calorie/data/';
const IDB_NAME = 'caloriemate', IDB_STORE = 'kv';
export const dbEvents = emitter();

function idb() {
  return new Promise((resolve) => {
    if (typeof indexedDB === 'undefined') return resolve(null);
    try {
      const req = indexedDB.open(IDB_NAME, 1);
      req.onupgradeneeded = () => req.result.createObjectStore(IDB_STORE);
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => resolve(null);
    } catch { resolve(null); }
  });
}
async function idbGet(key) {
  const db = await idb(); if (!db) return null;
  return new Promise((resolve) => { try { const r = db.transaction(IDB_STORE).objectStore(IDB_STORE).get(key); r.onsuccess = () => resolve(r.result ?? null); r.onerror = () => resolve(null); } catch { resolve(null); } });
}
async function idbSet(key, value) {
  const db = await idb(); if (!db) return false;
  return new Promise((resolve) => { try { const tx = db.transaction(IDB_STORE, 'readwrite'); tx.objectStore(IDB_STORE).put(value, key); tx.oncomplete = () => resolve(true); tx.onerror = () => resolve(false); } catch { resolve(false); } });
}
async function fetchDb(base, version, file = 'foods.json.gz') {
  // prefer the gzip file (≈ 1/5 the size); fall back to plain JSON where DecompressionStream is unavailable
  const q = version ? `?v=${version}` : '';
  if (typeof DecompressionStream !== 'undefined') {
    try {
      const res = await fetch(base + file + q, { cache: version ? 'no-store' : 'default' });
      if (res.ok && res.body) {
        const text = await new Response(res.body.pipeThrough(new DecompressionStream('gzip'))).text();
        return validateDb(JSON.parse(text));
      }
    } catch (e) { console.warn('gz load failed, falling back', e); }
  }
  if (file !== 'foods.json.gz') throw new Error('gzip required for ' + file);
  const res = await fetch(base + 'foods.json' + q, { cache: version ? 'no-store' : 'default' });
  if (!res.ok) throw new Error('Could not load food database');
  return validateDb(await res.json());
}
function validateDb(d) {
  if (!d || !Array.isArray(d.foods) || d.foods.length < 100) throw new Error('Invalid food database');
  d.foods = d.foods.filter((f) => f && typeof f.id === 'string' && typeof f.n === 'string' && Number.isFinite(f.k));
  return d;
}
export async function load() {
  if (DB) return DB;
  let bundledVersion = 0;
  try { const v = await fetch('./data/version.json').then((r) => r.json()); bundledVersion = Number(v.version) || 0; } catch { /* offline & uncached: fall through */ }
  bundledVersionNum = bundledVersion;
  const cached = await idbGet('foods');
  if (cached && Number(cached.version) > bundledVersion && Array.isArray(cached.foods)) DB = cached;
  else DB = await fetchDb('./data/');
  rebuildIndex();
  store.bus.on('change', () => { rebuildCustom(); refreshOverrides(); });
  return DB;
}
export const dbVersion = () => DB?.version || 0;

// ---------------------------------------------------------------- extra tier: packaged-product catalogue (loaded lazily, indexed in idle slices)
let EXTRA = null, extraIndexing = false;
export const extraCount = () => EXTRA?.foods?.length || 0;
export async function loadExtra() {
  if (EXTRA || extraIndexing) return;
  extraIndexing = true;
  try {
    const cached = await idbGet('foods-off');
    let data = cached && Number(cached.version) > (bundledVersionNum || 0) && Array.isArray(cached.foods) ? cached : null;
    if (!data) { try { data = await fetchDb('./data/', null, 'foods-off.json.gz'); } catch (e) { console.warn('extra tier unavailable', e); } }
    if (data) await indexExtra(data);
  } finally { extraIndexing = false; }
}
async function indexExtra(data) {
  // remove a previous extra tier, then append the new one in slices so the UI never stalls
  INDEX = INDEX.filter((e) => e.f.t !== 3);
  for (const id of [...byId.keys()]) if (id.startsWith('off-')) byId.delete(id);
  EXTRA = data;
  const foods = data.foods;
  for (let i = 0; i < foods.length; i += 400) {
    for (const f of foods.slice(i, i + 400)) { const e = entry(f); INDEX.push(e); byId.set(f.id, e.f); }
    await new Promise((r) => (typeof requestIdleCallback === 'function' ? requestIdleCallback(r, { timeout: 200 }) : setTimeout(r, 0)));
  }
  dbEvents.emit('extra', { count: foods.length });
}
let bundledVersionNum = 0;
/** Look for a newer database online; swaps it in and resolves {count} when updated, null otherwise. */
export async function checkForUpdate() {
  if (!DB || (typeof navigator !== 'undefined' && navigator.onLine === false)) return null;
  try {
    const v = await fetch(REMOTE + 'version.json?t=' + Date.now(), { cache: 'no-store' }).then((r) => (r.ok ? r.json() : null));
    if (!v || !(Number(v.version) > dbVersion())) return null;
    const fresh = await fetchDb(REMOTE, v.version);
    if (!(Number(fresh.version) > dbVersion())) return null;
    await idbSet('foods', fresh);
    DB = fresh;
    rebuildIndex();
    if (v.files?.extra) {
      try { const extra = await fetchDb(REMOTE, v.version, v.files.extra); await idbSet('foods-off', extra); await indexExtra(extra); } catch (e) { console.warn('extra tier update failed', e); }
    }
    dbEvents.emit('updated', { count: DB.foods.length + extraCount(), version: DB.version });
    return { count: DB.foods.length + extraCount(), version: DB.version };
  } catch (e) { console.warn('db update check failed', e); return null; }
}
/** Apply the device's edits (store.overrides) on top of a preloaded food. */
function merged(base) {
  const o = store.getOverride(base.id);
  if (!o) return base;
  return { ...base, k: o.k, p: o.p, cb: o.cb, f: o.f, fb: o.fb, n: o.n || base.n, edited: true };
}
function entry(base) {
  const f = merged(base);
  const keys = [norm(f.n), ...(f.a || []).map(norm)].filter(Boolean);
  const tokArr = [...new Set(keys.flatMap((k) => k.split(' ')))];
  const tokens = new Set(tokArr);
  return { f, base, keys, tokens, tokArr, bg: bigrams(keys[0]) };
}
function rebuildIndex() {
  INDEX = [];
  byId.clear();
  for (const f of store.get().custom) { INDEX.push(entry(f)); byId.set(f.id, f); }
  for (const f of DB.foods) { const e = entry(f); INDEX.push(e); byId.set(f.id, e.f); }
  lastOverrides = ovStamp(store.get().overrides);
}
let lastOverrides = null;
const ovStamp = (ov) => Object.keys(ov).map((k) => k + ':' + (ov[k].t || 0) + ':' + ov[k].k).join('|');
function refreshOverrides() {
  const ov = store.get().overrides;
  const stamp = ovStamp(ov);
  if (stamp === lastOverrides) return;
  lastOverrides = stamp;
  for (let i = 0; i < INDEX.length; i++) {
    const e = INDEX[i];
    if (e.f.src === 'custom') continue;
    if (ov[e.base.id] || e.f.edited) { INDEX[i] = entry(e.base); byId.set(e.base.id, INDEX[i].f); }
  }
}
export const baseFood = (id) => INDEX.find((e) => e.base.id === id)?.base || null;
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
export const coreCount = () => DB?.foods?.length || 0;
export function byCategory(cat, limit = 400) { return INDEX.filter((e) => e.f.c === cat).map((e) => e.f).slice(0, limit); }
export function all() { return INDEX.map((e) => e.f); }

// ---------------------------------------------------------------- search
const TIER_BONUS = { '-1': 12, 0: 10, 1: 3, 2: 0, 3: -6 }; // 3 = packaged catalogue (Open Food Facts snapshot)

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
      const allPrefix = qTokens.length && qTokens.every((t) => t.length >= 2 && e.tokArr.some((x) => x.startsWith(t)));
      if (starts && allWhole) score = 84;
      else if (allWhole) score = qTokens.length === 1 ? 62 : 74; // a lone word buried inside a longer alias is weak evidence
      else if (starts) score = 68;
      else if (allPrefix) score = 58;
      else {
        const sim = Math.max(dice(qbg, e.bg), ...(qTokens.length > 1 ? [] : e.keys.slice(1, 6).map((k) => dice(qbg, bigrams(k)))));
        if (sim >= 0.55) score = 30 + sim * 30;
        else if (qTokens.length > 1) {
          // partial token match: at least half of tokens present
          const hits = qTokens.filter((t) => e.tokens.has(t) || (t.length >= 3 && e.tokArr.some((x) => x.startsWith(t)))).length;
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
