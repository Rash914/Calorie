# CalorieMate — Play Store release guide

Current release: **v1.5.0, versionCode 6** (2026-09-18). Files in `handoff/release/` and `dist/`:
- `caloriemate-v1.5.0-release.aab` — upload this to Play Console
- `caloriemate-v1.5.0-release-signed.apk` — installable release build (for sharing outside the store)
- `caloriemate-upload.jks` + `KEY-INFO.txt` — your signing key and its passwords

## 1. The signing key (most important thing in this folder)

- File: `release/caloriemate-upload.jks` (alias `caloriemate`; passwords in `release/KEY-INFO.txt`).
- Certificate: `CN=CalorieMate, OU=Odos, O=Odos, L=Pune, ST=Maharashtra, C=IN`, RSA 2048, valid 10,000 days.
- It is **git-ignored**; it exists only on this computer and in `handoff/release/`. **Back it up privately** (encrypted drive / password manager attachment). If it is lost, the app on Play Store can never be updated again (you'd have to publish a brand-new app with a new package id).
- Never share the passwords or commit the file.

## 2. Verify a build is signed
```
"C:\Program Files\Android\Android Studio\jbr\bin\jarsigner.exe" -verify android\app\build\outputs\bundle\release\app-release.aab
```
Expected: `jar verified.` (APK: apksigner prints `Verifies` and the CN above.)

## 3. Build the next release

1. Bump versions: `android\app\build.gradle` → `versionCode` +1 (Play Store rejects a reused number) and `versionName`; `app\js\ui\me.js` `APP_VERSION`; `package.json` `version`.
2. `npm test`, commit, push (web goes live).
3. In a terminal:
```
npm run android:prepare
npx cap sync android
cd android
set JAVA_HOME=C:\Program Files\Android\Android Studio\jbr
gradlew bundleRelease assembleRelease
```
Outputs: `android\app\build\outputs\bundle\release\app-release.aab` and `...\apk\release\app-release.apk`. Signing is automatic because `android\app\build.gradle` reads `release\keystore.properties`.

## 4. First upload to Google Play Console (play.google.com/console)

1. Pay the one-time developer registration; create app → name **CalorieMate**, app (not game), free.
2. **Play App Signing**: accept the default (Google holds the final key; your `.jks` is the *upload key*).
3. Upload the AAB under **Testing → Internal testing** first; add your own email as tester; install from the test link; then **Promote to Production**.
4. Package name is read from the AAB: `com.rash914.aahar` — it is permanent.

### Store listing (assets)
- App icon 512×512: `app/icons/icon-512.png` (PNG, no transparency needed — Play adds the mask).
- Feature graphic 1024×500 (make from the logo on the light blue-green gradient).
- Screenshots: at least 2 phone screenshots (Home ring, Log/voice, Calendar, Plan, Scale). Take them from the app on a phone or the emulator.
- Short description (≤ 80 chars): *Indian calorie tracker with voice logging, streaks and sustainable plans.*
- Full description: see §6.

### Questionnaires
- **Content rating**: utility/health app; no violence, no user-generated content shared, no gambling → "Everyone".
- **Data safety**: *Does your app collect or share user data?* → No. Data (food logs, weight, profile) is stored only on the device; the app makes internet requests only to download the food-database update from GitHub Pages and, when the user taps "Search online", to Open Food Facts. No accounts, no ads, no analytics, no crash reporting. Voice input uses the device's speech service (Google) — mention "Audio: processed on device/by the OS speech service, not stored".
- **Privacy policy URL**: required. Host a simple page (e.g. `https://rash914.github.io/Calorie/privacy.html`) saying the above.
- **Target audience**: 18+ (simplest) or 13+; the app is not designed for children.
- **Health apps declaration**: it is a general wellness/calorie tracker, not a medical device; it does not diagnose or treat.
- **Permissions used**: INTERNET, RECORD_AUDIO (voice logging). Explain RECORD_AUDIO as "speech-to-text for logging meals".

## 5. Updating an app already on Play Store
Build with a higher `versionCode` (§3), upload the new AAB to Production (or Internal testing first), write release notes, roll out. Food-data-only changes do **not** need this — they reach users automatically via the in-app database update.

## 6. Full description (ready to paste)

CalorieMate is a fast, private calorie tracker built for Indian food.

• 5,300+ foods with real household portions — roti, katori, plate, glass — plus branded packaged products and popular restaurant menus.
• Speak your meals: "2 roti, 1 katori dal aur ek glass doodh". Understands English, Hindi and Hinglish. Say the calories from a label ("protein shake 130 kcal, 27 g protein") and it creates the food for you.
• Daily target ring, protein / carbs / fat / fibre bars, water tracking with one-tap buttons.
• Calendar with streaks and a 14-day chart.
• BMI (Asian and WHO scales), BMR/TDEE, and three sustainable plans that boil down to one daily calorie number.
• Edit any food's nutrition to match your version; add your own foods; look up packaged items online (Open Food Facts).
• A plain-language "Scale" guide explaining what a katori, a medium roti or a glass actually weighs.
• Works offline. No account, no ads, no tracking — everything stays on your phone, with export/import backups.

Nutrition values are estimates based on ICMR-NIN tables and label data. Not medical advice.
