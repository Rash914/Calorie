# CalorieMate — editing guide (recipes)

Every recipe ends with: `npm test` → commit → push (web deploys itself) → `npm run android:apk` if the APK must change. Data-only changes (§1–§3) reach installed apps **without** a new APK.

## 1. Add or fix a food
File: `data-build/curated/*.mjs` (pick the file by category; `regional2.mjs`, `packaged2.mjs`, `chains-intl.mjs` for those areas).
Row format (values **per 100 g**):
```js
['unique-id', 'Display name', 'alias one|alias two|हिन्दी', 'category', veg(1/2/3), kcal, protein, carbs, fat, fibre,
 [['1 medium (45 g)', 45], ['1 large (60 g)', 60]], 'src-tag(optional)'],
```
- Category keys: see `data-build/curated/schema.mjs` (`breads`, `rice`, `dal`, `vegcurry`, `nonveg`, `sweets`, `beverages`, `packaged`, `regional`, `intl`, …).
- First serving = default portion. `100 g` is always added automatically.
- Aliases: Hinglish + Devanagari + brand names help voice/search.
- Then `node data-build/build.mjs`. The build refuses duplicate ids and warns if kcal ≠ 4P+4C+9F ±20 %.

## 2. Change a portion size everywhere
Edit the serving grams in the food row (e.g. chapati `45`), rebuild. Update `app/js/ui/scale.js` text if the guide mentions it.

## 3. Refresh the packaged catalogue / remove junk
`node data-build/fetch-off.mjs` (new snapshot) → `node data-build/build.mjs`. Filters (kcal range, Atwater tolerance, category regexes, non-veg words) are in `data-build/build-off.mjs`.

## 4. Change colours / fonts / spacing
`app/css/app.css` top `:root` block (light) and `:root[data-theme="dark"]`. `--grad` is the blue→green gradient used by the ring, FAB, buttons. Font stack: `--font`; the Google font is loaded in `main.js → loadWebFont()`.

## 5. Change wording / labels
Search the string in `app/js/ui/*.js`. Meal names: `util.js` (`MEAL_LABEL`). Onboarding text: `ui/onboarding.js`. Scale guide: `ui/scale.js` `SECTIONS`. About text: `ui/me.js aboutCard()`.

## 6. Add a new tab
1. Create `app/js/ui/mytab.js` exporting `render(root, params)` (build DOM with `h()` from `util.js`).
2. `main.js`: import it, add to `VIEWS` and `TABS` (`['mytab', 'Label', 'iconName']`); add an icon path in `ui/components.js PATHS` if needed.
3. `router.js`: add `'mytab'` to `VIEWS`.
4. `sw.js`: add `'./js/ui/mytab.js'` to `SHELL`.

## 7. Change the calorie target formula / BMI scale / water target
`app/js/calc.js`: `tdee()`, `buildPlans()` (deficits, floors), `macroTargets()`, `waterTarget()`, `ETHNICITY` cut-offs, `ICMR_2020` table. Tests in `tests/calc.test.mjs` and `tests/v11.test.mjs` pin the numbers — update them together.

## 8. Voice / parser behaviour
`app/js/parser.js`: `NUM_WORDS` (number words), `UNITS` (container grams), `SIZE`, `FILLER` (words to ignore), `SPLIT_STRONG` (separators), `MACRO_WORDS`/`KCAL_RE` (spoken nutrition), `GENERIC` (words never auto-matched). Test with `node tests/smoke-parse.mjs "2 roti and dal"`.

## 9. Search ranking
`app/js/foods.js`: `search()` score table and `TIER_BONUS`; `norm()` spelling rules; `STOP` words.

## 10. Change the app name / logo / colours of icons
- Name: `app/index.html` (title, apple-mobile-web-app-title), `app/manifest.webmanifest`, `main.js` brand text, `android/app/src/main/res/values/strings.xml`, `capacitor.config.json appName`. **Do not change `appId` / `package_name`.**
- Logo: replace `branding/logo.png` (square tile on white/transparent) → `python scripts/brand-icons.py` → rebuild APK.
- Theme colour: `index.html` theme-color, `manifest.webmanifest theme_color`, `theme.js`.

## 11. Change the "Designed by" credit
`node scripts/set-credit.mjs "New Name"` → commit. Never hand-edit `credit.js`.

## 12. Release a web update
Push to `main`. CI runs tests, stamps `sw.js`, deploys. Users see "A new version is ready → Update now".

## 13. Release a new APK
1. Bump `versionCode` (+1) and `versionName` in `android/app/build.gradle`; bump `APP_VERSION` in `ui/me.js` and `version` in `package.json`.
2. `npm run android:apk` → `android/app/build/outputs/apk/debug/app-debug.apk`.
3. For Play Store: `cd android && ./gradlew bundleRelease` with a signing config (keystore) — see Android Studio → Build → Generate Signed Bundle.

## 14. Storage / backups
Schema and sanitizers: `app/js/store.js`. Adding a field: add to `defaults()`, the relevant `sanitize*()`, and the merge branch of `importJSON()`. Never rename the localStorage key `aahar.v1` (would wipe users' data).

## 15. Where the remote DB update points
`app/js/foods.js` `REMOTE = 'https://rash914.github.io/Calorie/data/'`. If the repo/site moves, change this and the `connect-src` list in `app/index.html`.

## 16. Run & debug locally
`python -m http.server 8765 --directory app`, open http://localhost:8765. Clear a stale service worker in DevTools → Application → Service Workers → Unregister, or run in console: `caches.keys().then(k=>k.forEach(c=>caches.delete(c)))`.

## 17. Common pitfalls
- Edited a file but the app shows the old one → service worker cache; bump via push (CI stamps) or `node scripts/stamp-sw.mjs`.
- Android build "Invalid file path" → `android/local.properties` must use forward slashes.
- `JAVA_HOME` not set → use Android Studio's `jbr` folder.
- Windows line endings: repo is `eol=lf` via `.gitattributes`; warnings are harmless.
