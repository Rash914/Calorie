# CalorieMate — complete code guide (hand-off)

Snapshot of the full project as of **v1.5.0 (2026-09-18)**.
This folder is self-contained: `source/` is the whole repository (also zipped as `caloriemate-source.zip`), `caloriemate-v1.5.0.apk` is the current Android build, and `EDITING-GUIDE.md` has step-by-step recipes for common changes.

- Live web app / PWA: https://rash914.github.io/Calorie/
- Git repo: https://github.com/Rash914/Calorie (branch `main`; every push auto-deploys via GitHub Actions)
- Android package id: `com.rash914.aahar` (permanent — never change it, Play Store and existing installs depend on it)
- Credit: "Designed by Odos" (see §9)

---

## 1. What the app is

A privacy-first Indian calorie tracker. Plain HTML/CSS/JS (ES modules, **no framework, no build step**), wrapped by **Capacitor** for Android. Everything the user logs stays on the device (localStorage); the food database ships with the app and self-updates from GitHub Pages.

Features: voice/natural-language logging (English, Hindi, Hinglish, Devanagari); 5,300+ foods with household portions (roti/katori/plate); daily target ring + macros + water; calendar, streaks, 14-day chart; BMI (ethnicity-aware), BMR/TDEE, ICMR-2020 reference; 3 sustainable plans; editable preloaded foods; custom foods; Open Food Facts online lookup; Scale (portion guide) tab; offline PWA with in-app "Update now"; backup export/import.

## 2. Tech stack & requirements

| Piece | Choice |
|---|---|
| Frontend | Vanilla JS (ES2022 modules), CSS custom properties, no bundler |
| Storage | `localStorage` key `aahar.v1` (user data), IndexedDB db `caloriemate` (downloaded food DB) |
| Offline | Service worker `app/sw.js`, precache list, versioned by content hash |
| Android | Capacitor 8 + `@capacitor-community/speech-recognition`, `CapacitorHttp` enabled |
| Hosting | GitHub Pages (workflow `.github/workflows/pages.yml`) |
| Tests | `node --test` (Node ≥ 22) |
| Data build | Node scripts in `data-build/` |
| Icons | Python 3 + Pillow (`scripts/brand-icons.py`) |
| APK | Android Studio (SDK 34+, bundled JDK 21) |

Local run: `python -m http.server 8765 --directory app` → http://localhost:8765 (modules need http, not `file://`).

## 3. Folder structure

```
app/                       ← the web app; GitHub Pages serves this folder; Capacitor wraps a copy of it
  index.html               shell + CSP meta + manifest/icon links; loads js/main.js
  manifest.webmanifest     PWA name/icons/theme/shortcuts
  sw.js                    service worker (VERSION is stamped by scripts/stamp-sw.mjs)
  css/app.css              entire design system (tokens, components, layouts, dark mode)
  icons/                   favicon.png, apple-touch-icon.png, icon-192/512.png, icon-maskable-512.png (generated)
  data/
    foods.json             core DB (readable; used only as fallback where gzip can't be decoded)
    foods.json.gz          core DB (what the app actually loads, ~110 KB)
    foods-off.json.gz      packaged-product catalogue (lazy tier, ~90 KB)
    version.json           {version, count, extraCount, files} — drives remote updates
  js/
    main.js                boot: credit check → shell (header, tabs, FAB) → load DB → router → onboarding → SW/update prompt → lazy tier + remote DB check
    router.js              hash router (#home #log #calendar #plan #scale #me)
    theme.js               light/dark/auto → data-theme attribute + theme-color meta
    util.js                h() DOM builder (no innerHTML), svg(), date helpers, meal helpers, emitter
    store.js               ALL persistent state + sanitizers + export/import (see §5)
    foods.js               DB loading (gzip/IndexedDB/remote), Devanagari transliteration, phonetic norm(), fuzzy search, overrides, lazy extra tier
    parser.js              natural language → log items (numbers EN/HI, units, sizes, "130 kcal 27 g protein", splitting rules)
    speech.js              Web Speech API (browser) / Capacitor plugin (Android) wrapper
    calc.js                BMI (Asian/WHO scales), BMR, TDEE, ICMR-2020 table, plans, macro targets, water target, streaks, projection
    off.js                 Open Food Facts online search + product→food mapping
    credit.js              GENERATED "Designed by" credit (XOR-encoded, SHA-256-locked) — regenerate with scripts/set-credit.mjs
    ui/
      components.js        icons (SVG paths), sheet(), toast(), confirm(), ring(), macroBar(), foodRow(), stepper(), segmented(), field()
      home.js              Home tab: day nav, ring, macros+water bar, quick actions, meals, water row, 7-day insight
      log.js               Log tab: search, category chips, recent/my foods, Open Food Facts button, quick add / custom food
      add.js               sheets: food detail (portion/qty/meal), edit nutrition (override), quick add, custom food, edit entry, voice sheet, search picker
      calendar.js          Calendar tab: streak stats, month grid, day detail, 14-day bar chart
      plan.js              Plan tab: BMI gauge, active plan card, target weight/BMI → 3 plans, weight log + chart
      scale.js             Scale tab: static portion/measure reference (edit the SECTIONS array)
      me.js                Me tab: profile form (shared with onboarding), preferences, data export/import/reset, about + credit + version
      onboarding.js        first-run popup: profile → goal/plan → done (✕ to skip)
data-build/                ← how app/data/* is produced
  build.mjs                merges tiers, validates, writes foods.json(.gz), foods-off.json.gz, version.json, build-report.txt
  build-off.mjs            filters the Open Food Facts snapshot into the lazy tier
  fetch-off.mjs            downloads the OFF India snapshot → sources/off-india.json (run occasionally)
  curated/schema.mjs       CATEGORIES map + row format doc
  curated/mains.mjs        rotis, rice, breakfast, south, dal, veg curries, non-veg, eggs
  curated/snacks-sweets.mjs snacks/street, Indo-Chinese, fast food/bakery, sweets, packaged/namkeen
  curated/drinks-dairy-produce.mjs  beverages, dairy, fruits, veg/salads, nuts, fitness, condiments, raw grains, regional
  curated/regional2.mjs    deeper regional coverage (NE, Kashmir, Himalayan, Bihar/Odisha/Bengal, Konkan/Goa, South, Rajasthan/Gujarat/MP, Sindhi/Parsi/Bohri)
  curated/packaged2.mjs    branded products with label values
  curated/chains-intl.mjs  restaurant chains (McD/KFC/Domino's/…) + international dishes
  sources/ifct2017.json    ICMR-NIN IFCT 2017 extract (raw foods)
  sources/indb.json        Indian Nutrient Databank extract (recipes)
  sources/off-india.json   Open Food Facts snapshot (10.5k products)
scripts/
  stamp-sw.mjs             hashes app/ → writes VERSION into sw.js (run before deploy/APK; CI does it)
  prepare-android.mjs      copies app/ → android-www/ with relaxed CSP for Capacitor, drops plain foods.json
  brand-icons.py           branding/logo.png → all web + Android icons + splash
  set-credit.mjs           generates app/js/credit.js from a name
tests/                     node:test suites (parser, search, calc, store, v1.1+ features, OFF mapping, performance)
android/                   Capacitor Android project (build.gradle has versionCode/versionName)
branding/logo.png          master logo
capacitor.config.json      appId, appName, webDir=android-www, CapacitorHttp enabled
package.json               scripts: build:data, build:icons, test, serve, stamp, android:prepare, android:sync, android:apk
.github/workflows/pages.yml  CI: build data → tests → stamp SW → deploy app/ to Pages
README.md, DATA_SOURCES.md, LICENSE
dist/                      built APKs (not in git)
```

## 4. Runtime flow

1. `main.js` → `verifyCredit()` (refuses to run if credit.js was altered) → builds shell.
2. `foods.load()` reads bundled `data/version.json`; if IndexedDB holds a newer downloaded DB it uses that, else loads `foods.json.gz` via `DecompressionStream` (falls back to `foods.json`).
3. Router renders the current tab; onboarding opens if `settings.onboarded` is false.
4. 1.2 s after first paint: `foods.loadExtra()` loads `foods-off.json.gz` and indexes it in idle slices; then `foods.checkForUpdate()` fetches `https://rash914.github.io/Calorie/data/version.json`; if newer, downloads both gzips, stores in IndexedDB, re-indexes, toasts "Food database updated".
5. Service worker: precaches shell + data; navigation network-first; assets cache-first; `version.json` and URLs with `?` are network-only. A new SW waits until the user taps "Update now" (message `SKIP_WAITING`), then the page reloads.

## 5. Data model (store.js, localStorage `aahar.v1`)

```js
{
  v: 1, created: ts,
  profile: { name, sex:'male'|'female', age, heightCm, weightKg, activity:'sedentary'|'light'|'moderate'|'active'|'very',
             condition:'none'|'pregnant'|'lactating0_6'|'lactating7_12', ethnicity:'asian'|'other', targetWeightKg|null },
  plan: null | { id, label, targetKcal, delta, startDate, startWeight, targetWeight, weeks, tdee },
  logs: { 'YYYY-MM-DD': [ { id, t, meal:'breakfast'|'lunch'|'snacks'|'dinner', name, foodId|null, qty, unit, g, k, p, cb, f, fb, src:'db'|'custom'|'voice'|'quick' } ] },
  water: { 'YYYY-MM-DD': ml },
  overrides: { [foodId]: { k,p,cb,f,fb (per 100 g), n?, t } },   // user edits of preloaded foods
  weights: [ { d:'YYYY-MM-DD', kg } ],
  custom: [ food objects, src:'custom' ],
  recent: [ foodId… ],
  settings: { lang:'en-IN'|'hi-IN', theme:'auto'|'light'|'dark', diet:'all'|'veg'|'egg', onboarded }
}
```
Every write goes through a sanitizer (types, ranges, lengths, date keys, prototype-pollution guards). Backups are `{app:'caloriemate', v:1, exported, data}`; import accepts `app:'aahar'` too.

**Food object (foods.json):** `{ id, n (name), a (aliases[]), c (category key), v (1 veg / 2 egg / 3 non-veg), k, p, cb, f, fb (per 100 g), s: [[label, grams], …] (first = default portion), src:'cur'|'nh'|'indb'|'ifct'|'off'|'custom', t: tier (-1 custom, 0 curated, 1 INDB, 2 IFCT, 3 catalogue) }`.

## 6. Search & parser essentials

- `norm()` in foods.js transliterates Devanagari and collapses spellings (aa→a, ee→i, ph→f, aspirates, doubles, plurals) so "chapathi / chapati / रोटी" match.
- `search()` scores: exact name 100 > exact alias 92 > starts-with + all tokens 84 > all tokens 74 > starts 68 > all prefixes 58 > bigram similarity; plus tier bonus (custom +12, curated +10, INDB +3, IFCT 0, catalogue −6), recent +6, shorter names win ties.
- `parser.parse(text)` → segments (split on and/aur/comma/with…), numbers (EN/HI words, fractions, "1 and a half"), units (katori/bowl/cup/glass/plate/tbsp/g/ml…), sizes (small/medium/large + Hindi), label nutrition ("130 kcal", "27 g protein", also reversed order; leading/trailing nutrition-only pieces attach to the food), meal hints. Items with spoken nutrition become **new custom foods** when logged.

## 7. Calculations (calc.js)

- BMI cut-offs: asian [18.5, 23, 25, 30], other/WHO [18.5, 25, 30, 35]; healthy top 22.9 / 24.9.
- BMR Mifflin-St Jeor; TDEE = BMR × {1.2, 1.375, 1.55, 1.725, 1.9} + pregnancy 350 / lactation 600 / 520.
- ICMR 2020 reference: men 2110/2710/3470, women 1660/2130/2720.
- Plans: lose −300/−500/−min(750, 25 % TDEE); gain +250/+400/+550; floor max(1200 F / 1500 M, 85 % BMR); 7700 kcal per kg.
- Macros: protein 1.4 g/kg clamped 20–35 % kcal, fat 27 %, carbs rest, fibre 25–40 g. Water: 35 ml/kg + activity 0–1000 + condition, clamp 1.5–4 L.

## 8. Build, test, deploy, release

Play Store: signed AAB via `cd android && gradlew bundleRelease` (reads `release/keystore.properties`; keystore is git-ignored — see `PLAY-STORE-GUIDE.md` and keep `release/caloriemate-upload.jks` backed up).

```bash
npm install                     # once (Capacitor deps)
npm test                        # 41 tests
node data-build/build.mjs       # rebuild app/data/* after editing curated files
node data-build/fetch-off.mjs   # optional: refresh the Open Food Facts snapshot (~10 min, then build)
python scripts/brand-icons.py   # after replacing branding/logo.png
git add -A && git commit -m "…" && git push   # → CI tests + deploys Pages; installed apps get update prompts
npm run android:apk             # debug APK → android/app/build/outputs/apk/debug/app-debug.apk
```
Windows note: set `JAVA_HOME` to Android Studio's JBR (`C:\Program Files\Android\Android Studio\jbr`) and keep `android/local.properties` = `sdk.dir=C:/Users/<you>/AppData/Local/Android/Sdk` (forward slashes).

Versions live in three places — bump together: `package.json` `version`, `app/js/ui/me.js` `APP_VERSION`, `android/app/build.gradle` `versionCode` (+1 every release) / `versionName`.

## 9. Credit / integrity

`app/js/credit.js` is generated: `node scripts/set-credit.mjs "Designed by name"` (pass only the name). The name is XOR-encoded and its SHA-256 digest is embedded; `main.js` refuses to boot if either changes. Shown in Me → About and at the end of onboarding. (A determined developer can still delete the check — it only prevents casual edits.)

## 10. Security notes

Strict CSP (no inline scripts; `connect-src` limited to self, rash914.github.io, openfoodfacts.org); UI never uses innerHTML; imports sanitized; only network calls: own files, version/DB updates, Open Food Facts on explicit user tap. Android copy relaxes `script-src` to allow Capacitor's injected bridge only.

## 11. Data sources & licences

IFCT 2017 (ICMR-NIN), INDB (Jaacks et al.), Open Food Facts (ODbL), curated household portions cross-checked with NIN guidelines and *Nutrition & Health* Annexure-5, ICMR-NIN 2020 RDA. Full detail: `source/DATA_SOURCES.md`. Code licence: MIT.
