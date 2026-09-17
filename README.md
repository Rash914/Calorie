# Aahar — Indian Calorie Tracker

A fast, offline-first calorie tracker built around **Indian food**: 2,100+ foods with household portions (roti, katori, plate), **voice logging in English & Hindi/Hinglish**, a daily target ring, streaks, a calendar view, BMI/BMR/TDEE, and three sustainable weight plans that boil down to one number — your daily calorie target.

- **Web / PWA:** https://rash914.github.io/Calorie/ (installable on Android, iPhone and desktop)
- **Android APK:** built with Capacitor from the same code (`android/`)
- **Privacy:** everything is stored on your device (localStorage). No accounts, no servers, no analytics. Export/import a JSON backup from **Me → Your data**.

## Features

| | |
|---|---|
| 🎤 Voice & natural language | "2 roti and a katori of dal", "do idli aur sambar", "दो रोटी और दाल", "protein shake 130 calories" |
| 🏷️ Label calories win | If you say/type the calories from a pack, that number is used and macros are scaled to match |
| 🔎 Search 2,171 foods | Phonetic matching: *chapathi / chapati / रोटी / dhal / daal* all work; category browsing; veg / egg / non-veg filter |
| 🎯 Daily target ring | Remaining calories shrink as you log; macro bars for protein, carbs, fat, fibre |
| 🔥 Streaks & calendar | Consecutive logging days, best streak, on-target days, month grid coloured by intake, 14-day chart |
| ⚖️ BMI / BMR / TDEE | Asian-Indian BMI cut-offs, Mifflin-St Jeor, ICMR-NIN 2020 reference (incl. pregnancy/lactation) |
| 📉 Plans | Enter a target weight or BMI → Gentle / Steady / Focused plans with kcal/day, kg/week, ETA and a safe floor |
| ⭐ Custom foods & quick add | Save your own recipes; quick-add anything with calories from the label |
| 💧 Water | Quick +100/150/250/500/750/1000 ml buttons, daily target ≈ 35 ml/kg + activity |
| 📏 Scale tab | Plain-language guide to every household measure used (katori, roti sizes, glass, spoon…) |
| ✏️ Editable foods | Change any preloaded food's nutrition; saved on-device and used everywhere |
| 🗣️ Spoken nutrition | "protein shake 130 kcal and 27 g protein" creates a reusable custom food |
| 🌍 Ethnicity-aware BMI | Asian (ICMR / WHO Asia-Pacific) vs WHO international cut-offs |
| 📴 Offline PWA | Service worker caches the app + database; installs to the home screen; in-app "Update now" prompt |

## Run locally

Any static server works (modules + `fetch` need http, not `file://`):

```bash
python -m http.server 8765 --directory app
```

Then open http://localhost:8765. Voice input needs Chrome/Edge (Web Speech API) and mic permission.

## Project layout

```
app/                 the web app (this folder is what GitHub Pages serves and Capacitor wraps)
  index.html, sw.js, manifest.webmanifest, css/, icons/
  js/                ES modules, no build step
    foods.js         DB load, Devanagari transliteration, phonetic normalisation, fuzzy search
    parser.js        natural-language → log items (EN/HI numbers, units, sizes, label calories)
    speech.js        Web Speech API (browser) / Capacitor plugin (Android)
    calc.js          BMI, BMR, TDEE, ICMR 2020 table, plans, streaks
    store.js         localStorage persistence + strict import validation
    ui/              views (home, log, calendar, plan, me) and sheets
  data/foods.json    generated food database
data-build/          sources + curated lists + build script → app/data/foods.json
tests/               node:test unit tests (parser, search, calculations)
scripts/             icon generator, Android prep
android/             Capacitor Android project
```

## Food database

Built by `node data-build/build.mjs` from three tiers (see [DATA_SOURCES.md](DATA_SOURCES.md)):

1. **Curated** (1,035) — common dishes, snacks, sweets, drinks, packaged foods with real Indian household portions; textbook-aligned rows tagged `nh`.
2. **INDB** (661) — Indian Nutrient Databank recipes (per 100 g). Fried recipes whose energy is inflated by the full frying-oil quantity are dropped in favour of curated entries; rows with inconsistent macros are dropped.
3. **IFCT 2017** (475) — ICMR-NIN raw foods (fruits, vegetables, grains, pulses, meat, fish…) with Hindi/Tamil names as search aliases.

The build validates every row (unique ids, numeric ranges, Atwater energy check, fibre ≤ carbs) and writes a report to `data-build/build-report.txt`.

## Tests

```bash
npm test
```

Covers search ranking (aliases, Devanagari, typos), the parser (English/Hinglish/Devanagari quantities, units, sizes, label calories, splitting rules), and the calculators (BMI categories, BMR/TDEE, ICMR table, plan floors, streaks).

## Deploy to GitHub Pages

The workflow in `.github/workflows/pages.yml` runs the tests and publishes `app/` on every push to `main`.
One-time setup on GitHub: **Settings → Pages → Source: GitHub Actions**.

```bash
git add -A
git commit -m "Aahar v1"
git push -u origin main
```

## Android APK

Requires Android Studio (SDK 34+, JDK 17+ — the JDK bundled with Android Studio works).

```bash
npm install
npm run android:apk
```

The debug APK is at `android/app/build/outputs/apk/debug/app-debug.apk`. `scripts/prepare-android.mjs` copies `app/` to `android-www/` and relaxes the CSP just enough for Capacitor's injected bridge script. For a Play Store release, open `android/` in Android Studio and build a signed bundle.

## Designed-by credit

`app/js/credit.js` is generated by `node scripts/set-credit.mjs "Name"`. The text is XOR-encoded and locked to a SHA-256 digest; the app refuses to start if either is edited.

## Security notes

- Strict Content-Security-Policy (no inline scripts, no external scripts, `connect-src 'self'`); Google Fonts is the only external resource and falls back to system fonts offline.
- The UI never uses `innerHTML`; all user text goes through `textContent`.
- Imported backups are schema-validated and clamped (types, ranges, lengths, sizes) before use.
- No network calls except loading the app's own files.

## Disclaimer

Nutrition values are estimates — home and restaurant portions vary. The plans are general guidance, not medical advice; consult a doctor if pregnant, under 18, or managing a medical condition.
