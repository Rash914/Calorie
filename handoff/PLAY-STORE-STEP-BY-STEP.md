# Publishing CalorieMate on Google Play — step by step

What you need before starting (all already prepared):
- `handoff/release/caloriemate-v1.5.0-release.aab` (the file you upload)
- `app/icons/icon-512.png` (store icon)
- Privacy policy URL: `https://rash914.github.io/Calorie/privacy.html`
- A Google account, a credit/debit card for the one-time US$25 registration, and a government ID for verification
- 2–8 phone screenshots (see Step 6) and one feature graphic 1024×500 px (see Step 6)

Time: ~1–2 hours of form-filling, then Google's review takes from a few hours up to ~7 days for a first app.

---

## Step 1 — Create the developer account (one time)
1. Go to **https://play.google.com/console** and sign in with the Google account you want to own the app.
2. Choose account type **Personal** (or Organisation if you have a registered company; that needs a D-U-N-S number).
3. Fill your legal name, address, phone, and pay the **US$25 one-time fee**.
4. Complete **identity verification** (upload ID; may take 1–2 days). The console stays limited until verified.
5. Personal accounts must run a **closed test with ≥12 testers for 14 days** before Production is allowed. Plan for this (Step 8).

## Step 2 — Create the app
1. Console home → **Create app**.
2. App name: **CalorieMate**. Default language: English (India) or English (US).
3. App or game: **App**. Free or paid: **Free** (cannot be changed to paid later).
4. Tick the declarations (Developer Program Policies, US export laws). Click **Create app**.

## Step 3 — Set up app content (left menu → *Policy and programs → App content*)
Work through every item until each shows a green tick:

1. **Privacy policy** → paste `https://rash914.github.io/Calorie/privacy.html` → Save.
2. **App access** → "All functionality is available without special access" (there is no login) → Save.
3. **Ads** → "No, my app does not contain ads" → Save.
4. **Content rating** → Start questionnaire → category **Utility, Productivity, Communication, or Other** → answer **No** to everything (violence, sexuality, language, controlled substances, gambling, user-generated content, location sharing, purchases) → Save → Submit. Rating: Everyone / 3+.
5. **Target audience and content** → age groups: tick **18 and over** only (simplest; avoids child-directed rules) → "Does your app unintentionally appeal to children?" → No → Save.
6. **News apps** → No. **COVID-19** → No. **Government apps** → No. **Financial features** → No financial features.
7. **Data safety** → Start:
   - "Does your app collect or share any of the required user data types?" → **No**.
   - "Is all of the user data collected by your app encrypted in transit?" → Yes.
   - "Do you provide a way for users to request that their data is deleted?" → choose "No, but data is not collected" wording if offered; otherwise Yes and explain: *all data is stored only on the device and can be deleted in-app via Me → Reset app*.
   - Save → the summary should read "No data collected / No data shared".
8. **Health apps** → declare the app is a **health & fitness app that does not** provide medical diagnosis/treatment; it is a general wellness (calorie/nutrition tracking) app. Not a medical device.
9. **Advertising ID** → "No, my app does not use advertising ID".
10. **App categories / store settings** → Category **Health & Fitness**; tags: nutrition, diet, calorie counter. Contact email: your email. Website: `https://rash914.github.io/Calorie/`.

## Step 4 — App integrity / signing
1. Left menu → **Test and release → App integrity** (or it appears the first time you upload).
2. Choose **Use Google-generated key** (recommended). Google will hold the final app-signing key; your `caloriemate-upload.jks` is registered automatically as the **upload key** when you upload the first AAB.
3. Nothing else to do. (If you ever lose the upload key, Google can reset it via a support request — but keep it safe anyway.)

## Step 5 — Upload the app bundle to Internal testing (first upload)
1. Left menu → **Test and release → Testing → Internal testing** → **Create new release**.
2. Under *App bundles* click **Upload** → select `handoff/release/caloriemate-v1.5.0-release.aab`. Wait for the upload and processing (shows version code 6, size ~4 MB, 5 permissions… no errors expected).
3. Release name: `1.5.0 (6)` (auto-filled). Release notes:
   ```
   <en-IN>
   First release: 5,300+ Indian foods, voice logging (English/Hindi), streaks, calendar, water, BMI & plans. Works offline, no account needed.
   </en-IN>
   ```
4. **Next** → fix any warnings (they are informational) → **Save** → **Start rollout to Internal testing** → confirm.
5. **Testers** tab → Create email list → add your own Gmail (and friends') → Save → copy the **opt-in URL**. Open it on your phone, accept, then install from Play. This proves the signed build works.

## Step 6 — Store listing (left menu → *Grow → Store presence → Main store listing*)
1. **App name**: CalorieMate.
2. **Short description** (max 80): `Indian calorie tracker with voice logging, streaks & sustainable weight plans.`
3. **Full description**: paste from `PLAY-STORE-GUIDE.md` §6.
4. **App icon**: upload `app/icons/icon-512.png` (512×512, ≤1 MB).
5. **Feature graphic** (1024×500 PNG/JPG, required): make one with the logo centred on the light blue-green gradient — Canva or any editor; or ask me and I'll generate it.
6. **Phone screenshots**: 2–8 images, 16:9 or 9:16, each side 320–3840 px. Take them on your phone (Home ring with some food logged, Log tab with voice sheet, Calendar, Plan, Scale, Me). Screenshots from the installed test build look best.
7. Optional: 7-inch/10-inch tablet screenshots (skip; not required for phones-only).
8. **Save**.

## Step 7 — Countries and pricing
1. Left menu → **Testing → Internal testing** already targets your testers. For Production: **Production → Countries/regions → Add countries** → select **India** (and any others, or *All*) → Save.
2. **Monetise → App pricing** → Free.

## Step 8 — Closed testing requirement (personal accounts)
Google requires new personal accounts to run a **closed test** with at least **12 opted-in testers for 14 consecutive days** before applying for production access.
1. **Testing → Closed testing → Create track** (or use the default "Alpha") → **Create new release** → reuse the same AAB (select from library) → rollout.
2. Add testers (email list or Google Group) — 12+ people must opt in via the link and keep the app installed for 14 days.
3. After 14 days: **Dashboard → Apply for production access** → answer the short questionnaire (how you recruited testers, what feedback you got, how you improved) → submit. Approval usually takes a few days.
(Organisation accounts skip this step.)

## Step 9 — Production release
1. **Test and release → Production → Create new release** → **Add from library** → pick the same bundle (or upload a newer one with a higher versionCode) → release notes → **Next**.
2. **Save** → **Review release** → check the pre-launch checklist has no red errors → **Start rollout to Production** → **Rollout**.
3. Status becomes **In review**. Google reviews (hours to ~7 days). You get an email when it is **Live**. The Play link will be `https://play.google.com/store/apps/details?id=com.rash914.aahar`.

## Step 10 — After it is live
- **Updates**: bump `versionCode`/`versionName`, run `gradlew bundleRelease` (see `PLAY-STORE-GUIDE.md` §3), upload to Production → Create new release. Only code/UI changes need this; food-data changes update automatically inside the app.
- **Pre-launch report** (Console → *Test and release → Pre-launch report*): Google's automated device tests; review any crashes.
- **Ratings & reviews**: reply from Console.
- **Policy emails**: Google sends policy updates; usually nothing to do for this app (no ads, no data collection).

## Common rejections and fixes
| Message | Fix |
|---|---|
| "Privacy policy link missing/invalid" | Must be the exact URL above, reachable, and must mention the app name — it does. |
| "Permission RECORD_AUDIO needs justification" | In Data safety / permissions declaration: "Speech-to-text for logging meals by voice; audio is not stored or transmitted". |
| "Health apps declaration incomplete" | App content → Health → declare general wellness, not medical. |
| "Version code already used" | Increase `versionCode` in `android/app/build.gradle` and rebuild. |
| "Upload key mismatch" | Build with `release/caloriemate-upload.jks` (automatic via `keystore.properties`); never generate a new keystore. |
| "App does not comply with Families policy" | Target audience must be 18+ (Step 3.5). |
