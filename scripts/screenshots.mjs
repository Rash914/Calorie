// Play Store phone screenshots (1080x2340) using the installed Chrome via puppeteer-core.
// Usage: (server running: python -m http.server 8765 --directory app)
//        npm i --no-save puppeteer-core   then   node scripts/screenshots.mjs
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const OUT = path.join(root, 'handoff', 'store-assets', 'screenshots'); fs.mkdirSync(OUT, { recursive: true });
const require = createRequire(process.env.PUPPETEER_PATH ? path.join(process.env.PUPPETEER_PATH, 'x.js') : import.meta.url);
const puppeteer = require('puppeteer-core');
const CHROME = ['C:/Program Files/Google/Chrome/Application/chrome.exe', 'C:/Program Files (x86)/Google/Chrome/Application/chrome.exe', 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe'].find(fs.existsSync);
const BASE = process.env.BASE || 'http://localhost:8765/';

// demo data: 12 days of logs, water, an active plan, a weight trend
const today = new Date(); const key = (d) => { const x = new Date(today); x.setDate(x.getDate() - d); return `${x.getFullYear()}-${String(x.getMonth() + 1).padStart(2, '0')}-${String(x.getDate()).padStart(2, '0')}`; };
const e = (meal, name, foodId, unit, g, k, p, cb, f) => ({ id: Math.random().toString(36).slice(2), t: Date.now(), meal, name, foodId, qty: 1, unit, g, k, p, cb, f, fb: 2, src: 'db' });
const day = () => [
  e('breakfast', 'Poha (kanda poha)', 'poha', '1 bowl (150 g)', 150, 248, 4.5, 42, 6.8), e('breakfast', 'Tea with milk & sugar (chai)', 'chai', '1 cup (150 ml)', 150, 68, 2.3, 10.5, 2),
  e('lunch', 'Chapati / Roti (phulka, no ghee)', 'chapati', '2 × 1 medium (45 g)', 90, 207, 6.8, 40.5, 2.3), e('lunch', 'Dal tadka (toor/arhar)', 'dal-tadka', '1 katori (150 g)', 150, 158, 7.5, 21, 4.5), e('lunch', 'Bhindi masala', 'bhindi-masala', '1 katori (150 g)', 150, 150, 3, 13.5, 9.8),
  e('snacks', 'Whey protein (1 scoop, with water)', 'whey-protein', '1 scoop (30 g)', 30, 120, 22.5, 3, 1.8), e('snacks', 'Banana', 'banana', '1 medium (100 g)', 100, 89, 1.1, 22, 0.3),
  e('dinner', 'Grilled chicken breast', 'chicken-breast-grilled', '150 g', 150, 248, 46.5, 0, 5.4), e('dinner', 'Steamed white rice', 'rice-white', '1 katori (150 g)', 150, 195, 4.1, 42, 0.5), e('dinner', 'Curd / Dahi', 'curd', '1 katori (150 g)', 150, 90, 5.3, 6.8, 4.5)
];
const logs = {}, water = {}, weights = [];
for (let d = 0; d < 12; d++) { const list = day(); if (d === 0) list.splice(7); if (d % 5 === 3) list.splice(3); logs[key(d)] = list; water[key(d)] = d === 0 ? 1500 : 2250; }
for (let d = 40; d >= 0; d -= 5) weights.push({ d: key(d), kg: Math.round((82 - (40 - d) * 0.09) * 10) / 10 });
const state = { v: 1, created: Date.now(), profile: { name: 'Yash', sex: 'male', age: 29, heightCm: 176, weightKg: 78.4, activity: 'light', condition: 'none', ethnicity: 'asian', targetWeightKg: 72 },
  plan: { id: 'steady', label: 'Steady', targetKcal: 1950, delta: -500, startDate: key(40), startWeight: 82, targetWeight: 72, weeks: 22, tdee: 2450 },
  logs, water, overrides: {}, weights, custom: [], recent: ['chapati', 'dal-tadka', 'poha', 'chai', 'banana', 'curd'], settings: { lang: 'en-IN', theme: 'light', diet: 'all', onboarded: true } };

const shots = [['01-home', '#home'], ['02-voice', '#home?demo=voice'], ['03-log', '#log?demo=search'], ['04-calendar', '#calendar'], ['05-plan', '#plan'], ['06-scale', '#scale']];
const browser = await puppeteer.launch({ executablePath: CHROME, headless: true, args: ['--no-first-run', '--disable-gpu', '--hide-scrollbars'] });
const page = await browser.newPage();
await page.setViewport({ width: 412, height: 824, deviceScaleFactor: 2.625, isMobile: true, hasTouch: true });
// seed from a non-app page on the same origin, otherwise the app's save-on-unload would overwrite it
await page.goto(BASE + 'privacy.html', { waitUntil: 'networkidle0' });
await page.evaluate((s) => { localStorage.setItem('aahar.v1', s); return caches.keys().then((k) => Promise.all(k.map((c) => caches.delete(c)))); }, JSON.stringify(state));
for (const [name, hash] of shots) {
  await page.goto(BASE + 'privacy.html', { waitUntil: 'load' });
  await page.goto(BASE + hash, { waitUntil: 'networkidle0' });
  await new Promise((r) => setTimeout(r, 1800));
  await page.evaluate(() => document.querySelectorAll('.toast-wrap').forEach((t) => t.remove()));
  await page.screenshot({ path: path.join(OUT, name + '.png'), clip: { x: 0, y: 0, width: 411.43, height: 822.86 } }); // → 1080×2160 (2:1, Play Store limit)
  console.log('wrote', name);
}
await browser.close();
