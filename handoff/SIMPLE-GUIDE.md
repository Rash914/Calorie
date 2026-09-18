# CalorieMate — the plain-English owner's guide

No coding knowledge assumed. Read this once; keep it next to the app folder.

## 1. What you own

- **The app folder** on your computer: `F:\AI Projects\Calorie`. Everything is inside it. `handoff\source` is a frozen copy of the same thing (backup).
- **The website**: https://rash914.github.io/Calorie/ — it is the same app, running from your GitHub account (**github.com/Rash914/Calorie**). Anyone opening that link gets the app; on a phone they can "Add to Home Screen" and it works like an installed app.
- **The Android app (APK)**: file `caloriemate-v1.5.0.apk`. Sending this file to someone lets them install it.
- **Your data is not on any server.** Whatever people log stays on their own phone. You cannot see their data; they can back it up from *Me → Your data*.

## 2. How the pieces talk to each other (one-minute mental model)

```
Your computer  ──(push)──►  GitHub  ──(automatic, ~1 min)──►  Website
                                                                  │
   Android APK  ◄─────────── you build it on your computer        │
        └── both the website and the APK quietly check ◄──────────┘
            "is there a newer food list?" every time they open
```
- Change **food data** → push → everyone (web *and* APK) gets the new foods automatically. No new APK needed.
- Change **how the app looks or behaves** → push → website updates itself; the APK needs to be rebuilt and re-sent (or re-uploaded to Play Store).

## 3. The three files you'll actually touch

| I want to… | Open this file | Notes |
|---|---|---|
| Add a food / fix calories | `data-build\curated\mains.mjs` (everyday dishes), `snacks-sweets.mjs`, `drinks-dairy-produce.mjs`, `regional2.mjs`, `packaged2.mjs` (branded), `chains-intl.mjs` (restaurants / foreign) | See §4 |
| Change the portion guide text | `app\js\ui\scale.js` | Plain text inside quotes |
| Change what the welcome popup says | `app\js\ui\onboarding.js` | Text inside quotes |

Open them with **Notepad** (right-click → Open with → Notepad) or, better, the free **VS Code** editor. Only change text between quotes or numbers; don't delete commas, brackets or quotes.

## 4. Adding a food (the most common job)

Each food is one line that looks like this:

```
['besan-ladoo', 'Besan ladoo', 'besan laddu|बेसन लड्डू', 'sweets', 1, 450, 9, 55, 22, 3, [['1 ladoo (30 g)', 30]]],
```
Reading left to right:
1. `'besan-ladoo'` — a short unique id (lowercase, hyphens, must not already exist).
2. `'Besan ladoo'` — the name people see.
3. `'besan laddu|बेसन लड्डू'` — other spellings, separated by `|` (helps voice & search). Can be empty `''`.
4. `'sweets'` — the category. Allowed words: breads, rice, breakfast, south, dal, vegcurry, nonveg, eggs, snacks, chinese, fastfood, sweets, beverages, dairy, fruits, vegetables, nuts, packaged, fitness, condiments, raw, regional, intl.
5. `1` — 1 = veg, 2 = contains egg, 3 = non-veg.
6. `450, 9, 55, 22, 3` — **per 100 g**: calories, protein, carbs, fat, fibre.
7. `[['1 ladoo (30 g)', 30]]` — the portion(s): label and its weight in grams. The first one is the default. You can list several: `[['1 small (25 g)', 25], ['1 large (45 g)', 45]]`.

**To add one:** copy an existing line, paste it at the end of the list (before the final `];`), change the values, save.

**Tip for "per 100 g":** if a label says 130 kcal for a 30 g scoop, per 100 g = 130 ÷ 30 × 100 = 433.

Then run the three commands in §6. If you typed something wrong (duplicate id, missing bracket) the first command stops and prints the problem — fix that line and run again.

## 5. Things you should NOT change

- The folder names, and the id `com.rash914.aahar` anywhere (the Android app's permanent identity).
- `app\js\credit.js` (the Designed-by line). To change the name, use the command in §7.
- `app\js\store.js` unless you understand it — it holds everyone's saved data format.
- The words `aahar.v1` — that's the name of the storage box on users' phones; renaming it would erase their history.

## 6. The commands (copy-paste into the terminal)

Open the folder in the terminal: in File Explorer go to `F:\AI Projects\Calorie`, click the address bar, type `cmd`, press Enter.

**A. Food data changed → publish to everyone**
```
node data-build\build.mjs
npm test
git add -A
git commit -m "Added foods"
git push
```
Wait ~1 minute; the website and all installed apps will pick it up on their next open.

**B. Anything else changed (text, colours) → website + new APK**
```
npm test
git add -A
git commit -m "Describe the change"
git push
npm run android:apk
```
The new APK appears at `android\app\build\outputs\apk\debug\app-debug.apk`. Before building an APK, raise the version numbers (see §8).

**C. New logo**
Replace `branding\logo.png` (square picture), then:
```
python scripts\brand-icons.py
```
then do B.

If a command says "not recognized", install: **Node.js** (nodejs.org, LTS), **Git** (git-scm.com), **Python** (python.org, tick "Add to PATH") and, for APKs, **Android Studio**.

## 7. Change the "Designed by" name
```
node scripts\set-credit.mjs "New Name"
```
then do B. Never edit the credit file by hand — the app will refuse to start if it is altered.

## 8. Version numbers (bump before every APK)

- `android\app\build.gradle`: `versionCode 6` → `7` (always +1) and `versionName "1.5.0"` → `"1.6.0"`.
- `app\js\ui\me.js`: `APP_VERSION = '1.5.0'` → `'1.6.0'`.
- `package.json`: `"version": "1.5.0"` → `"1.6.0"`.

## 9. Everyday questions

- **A user says a food's calories are wrong.** They can fix it themselves: open the food → *Edit nutrition* (saved only on their phone). To fix it for everyone: edit the food line (§4) and publish (§6-A).
- **A food is missing.** Users can use *Search online (Open Food Facts)* or *Quick add*. To add it for everyone: §4.
- **Someone says the app is "modified / integrity check failed".** Their copy's credit file was tampered with; tell them to reinstall from the official link.
- **Website isn't updating.** GitHub → your repo → *Actions* tab: the latest run should be green. If it failed, open it and read the red line (usually a typo in a food line; `npm test` would have caught it).
- **I want someone else / another AI to work on it.** Give them the `handoff` folder (or the zip) — `README` explains every file; `EDITING-GUIDE` has the recipes.

## 10. Play Store
Done: the signing key lives in `release\caloriemate-upload.jks` (passwords in `release\KEY-INFO.txt`, copy in `handoffelease`). **Back it up privately — without it the app can never be updated on Play Store.** The signed bundle (`.aab`) is built with `cd android` then `gradlew bundleRelease` (signing is automatic). Full upload steps, store text and questionnaire answers: `PLAY-STORE-GUIDE`.
