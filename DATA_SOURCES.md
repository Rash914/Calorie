# Data sources & methodology

All nutrient values are **per 100 g (or 100 ml)** in `app/data/foods.json`; per-portion values are derived from the household serving weights attached to each food.

## 1. ICMR-NIN Indian Food Composition Tables 2017 (IFCT)

Longvah T, Ananthan R, Bhaskarachary K, Venkaiah K. *Indian Food Composition Tables 2017*. National Institute of Nutrition, ICMR, Hyderabad. https://www.nin.res.in/ebooks/IFCT2017.pdf

- 528 raw foods measured across six Indian regions; energy (kJ → kcal ÷ 4.184), protein, available carbohydrate, fat, dietary fibre.
- Machine-readable copy: the `@ifct2017/compositions` package (github.com/ifct2017/compositions). Regional names from the same table feed the search index (Hindi and Tamil names).
- Numbered varietal replicates (Brinjal-1…21, Chillies-1…7) are collapsed to the "all varieties" row.
- Foods normally eaten cooked (cereals, pulses, meat, fish) are labelled "(raw)".

## 2. Indian Nutrient Databank (INDB)

Jaacks LM et al. Indian Nutrient Databank — nutrient values for 1,014 recipes commonly consumed in India, computed from IFCT 2017 / NVIF 2004 ingredient data with USDA retention factors. https://github.com/lindsayjaacks/Indian-Nutrient-Databank-INDB-

Filters applied in `data-build/build.mjs`:
- Deep-fried recipes report the *entire* frying-oil quantity as absorbed (e.g. potato samosa 577 kcal/100 g), so recipes matching fried-food keywords with > 350 kcal/100 g and any recipe > 450 kcal/100 g (unless it is a sweet ≤ 520) are dropped; the curated tier covers those foods with realistic values.
- Rows whose energy disagrees with their macros by more than 50 % (mostly soups) are dropped.
- Serving sizes: INDB serving weights are used when they fall inside a plausible range for the stated unit; otherwise a standard unit weight (bowl 150 g, plate 250 g, glass 250 ml, …) is used.

## 3. Curated household portions

1,035 foods written for this app: everyday dishes, regional specialities, street food, sweets, drinks, packaged snacks, fitness foods, raw grains and pulses. Per-100 g values were compiled from IFCT/INDB where available and from widely used Indian nutrition references, then sanity-checked with the Atwater factors (4/4/9). Serving weights follow common Indian household measures:

| Measure | Weight used |
|---|---|
| Phulka / chapati | 45 g medium (30 g small, 60 g large) |
| Katori (small bowl) | 150 g cooked dal / sabzi / rice |
| Plate of rice | 250 g |
| Plate of biryani | 300 g |
| Glass | 250 ml |
| Cup of tea | 150 ml |
| Idli | 40 g · Dosa 80 g · Masala dosa 200 g |
| Samosa | 85 g medium · Pakora 25 g each |

### Textbook cross-check (rows tagged `nh`)

Approximate calorific values of cooked preparations from *Nutrition and Health*, Annexure-5 (ICMR-based), e.g. rice 1 cup 170 kcal, phulka 80, paratha 150, puri 100, idli (2) 150, dosa 125, plain dal ½ cup 100, sambar 1 cup 110, boiled egg 90, omelette 160, samosa 200, pakora (8) 280, dahi vada (2) 180, besan barfi (2) 400, chikki (2) 290, ice-cream ½ cup 200, tea 75, coffee 110, lassi 110, cold drink 200 ml 150, almonds (10) 85, cashews (10) 95, apple 65, banana 90, mango 180, guava 50, papaya 80. Curated portions for these foods were aligned to land within ~±20 % of these figures.

Protein content ranges (g/100 g) from the same book, used as a sanity check: milk 3.2–4.3, meat 18–26, egg 13, fish 15–23, cereals 6–13, pulses 21–28, vegetables 1–4, fruits 1–3, nuts 4.5–29, soybean 43.2, oils/fats nil, sugar/jaggery nil.

## 4. Energy requirements

- **BMR:** Mifflin–St Jeor. **TDEE:** BMR × activity factor (1.2 / 1.375 / 1.55 / 1.725 / 1.9).
- **ICMR-NIN 2020 RDA (energy, kcal/day)** shown as a population reference:

| Group | Sedentary | Moderate | Heavy |
|---|---|---|---|
| Adult men | 2110 | 2710 | 3470 |
| Adult women | 1660 | 2130 | 2720 |
| Pregnant | +350 | | |
| Lactating 0–6 m | +600 | | |
| Lactating 7–12 m | +520 | | |
| Infants 0–6 m / 6–12 m | 550 / 670 | | |

Pregnancy/lactation additions are also applied to the TDEE-based target when selected in the profile.

- **Plans:** 7,700 kcal ≈ 1 kg body fat. Deficits of 300 / 500 / min(750, 25 % TDEE) kcal/day; targets never below 1,200 kcal (women) / 1,500 kcal (men) or 85 % of BMR. Surpluses of 250 / 400 / 550 for weight gain.
- **BMI categories:** Asian-Indian cut-offs — < 18.5 underweight, 18.5–22.9 healthy, 23–24.9 overweight, 25–29.9 obese I, ≥ 30 obese II.
- **Macro targets:** protein 1.4 g/kg (bounded to 20–35 % of energy), fat 27 %, carbohydrate the remainder, fibre 25–40 g.

## Limitations

Portion weights vary between kitchens; restaurant dishes typically carry more oil and sugar than home versions. Voice recognition quality depends on the device's speech service. Nothing here is medical advice.
