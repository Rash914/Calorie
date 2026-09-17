// Builds app/data/foods.json from three sources:
//   1. curated/*.mjs   – hand-curated common Indian foods with household portions (highest priority)
//   2. sources/indb.json – Indian Nutrient Databank (INDB, Jaacks et al.) recipes, per 100 g
//   3. sources/ifct2017.json – ICMR-NIN Indian Food Composition Tables 2017 raw foods, per 100 g
// Run: node data-build/build.mjs
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import mains from './curated/mains.mjs';
import snacks from './curated/snacks-sweets.mjs';
import drinks from './curated/drinks-dairy-produce.mjs';
import regional2 from './curated/regional2.mjs';
import packaged2 from './curated/packaged2.mjs';
import chainsIntl from './curated/chains-intl.mjs';
import zlib from 'node:zlib';
import { buildOff } from './build-off.mjs';
import { CATEGORIES } from './curated/schema.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const OUT = path.join(__dirname, '..', 'app', 'data', 'foods.json');
const REPORT = path.join(__dirname, 'build-report.txt');

const warnings = [];
const warn = (m) => warnings.push(m);
const r1 = (x) => Math.round(x * 10) / 10;
const norm = (s) => s.toLowerCase().normalize('NFKD').replace(/[^\p{L}\p{N}\s]/gu, ' ').replace(/\s+/g, ' ').trim();

// ---------------------------------------------------------------- curated
const foods = [];
const ids = new Set();
const nameIndex = new Set(); // normalized names + aliases, to dedupe other sources
function addCurated(row, file) {
  const [id, name, aliases, cat, veg, k, p, c, f, fb, servings, src] = row;
  if (ids.has(id)) throw new Error(`${file}: duplicate id ${id}`);
  if (!CATEGORIES[cat]) throw new Error(`${file}: unknown category ${cat} for ${id}`);
  for (const [i, v] of [k, p, c, f, fb].entries()) {
    if (typeof v !== 'number' || !Number.isFinite(v) || v < 0) throw new Error(`${file}: bad nutrient #${i} in ${id}`);
  }
  if (!Array.isArray(servings) || !servings.length) throw new Error(`${file}: no servings for ${id}`);
  for (const s of servings) {
    if (!Array.isArray(s) || typeof s[0] !== 'string' || typeof s[1] !== 'number' || s[1] <= 0) throw new Error(`${file}: bad serving in ${id}`);
  }
  // Atwater sanity check (alcohol-free): kcal ≈ 4P + 4C + 9F, allow ±20% or ±25 kcal
  const est = 4 * p + 4 * c + 9 * f;
  if (k > 20 && Math.abs(est - k) > Math.max(25, 0.2 * k)) warn(`curated ${id}: kcal ${k} vs Atwater ${est.toFixed(0)}`);
  if (fb > c + 0.01) warn(`curated ${id}: fiber ${fb} > carbs ${c}`);
  ids.add(id);
  const a = aliases ? aliases.split('|').map((x) => x.trim()).filter(Boolean) : [];
  nameIndex.add(norm(name));
  for (const x of a) nameIndex.add(norm(x));
  foods.push({ id, n: name, a, c: cat, v: veg, k, p, cb: c, f, fb, s: servings, src: src || 'cur', t: 0 });
}
for (const r of mains) addCurated(r, 'mains');
for (const r of snacks) addCurated(r, 'snacks-sweets');
for (const r of drinks) addCurated(r, 'drinks-dairy-produce');
for (const r of regional2) addCurated(r, 'regional2');
for (const r of packaged2) addCurated(r, 'packaged2');
for (const r of chainsIntl) addCurated(r, 'chains-intl');
const curatedCount = foods.length;

// ---------------------------------------------------------------- INDB
const indb = JSON.parse(fs.readFileSync(path.join(__dirname, 'sources', 'indb.json'), 'utf8'));
// unit → [default grams, min, max]; computed serving grams are used only when inside [min,max]
const UNIT = {
  'tea cup': [150, 80, 250], 'tall glass': [300, 200, 400], glass: [250, 150, 350], 'juice glass': [200, 120, 300], cup: [200, 100, 300],
  bowl: [150, 80, 300], 'small bowl': [100, 50, 200], 'soup bowl': [200, 120, 350], 'curry bowl': [150, 80, 300],
  plate: [250, 120, 400], dish: [200, 100, 350], 'shallow dish': [200, 100, 350], 'casserole dish': [250, 120, 400], 'small casserole dish': [150, 80, 300],
  triangle: [60, 30, 120], 'toasted triangle': [60, 30, 120], toast: [40, 25, 80], slice: [40, 15, 120], 'large slice': [80, 40, 150],
  egg: [55, 40, 80], omelette: [110, 60, 200], pancake: [60, 30, 120], cheela: [70, 40, 120], chapati: [40, 25, 70], roti: [50, 25, 90],
  parantha: [80, 40, 130], poori: [30, 15, 50], naan: [90, 50, 130], bhatura: [90, 50, 130], idli: [40, 20, 70], dosa: [100, 40, 250],
  uttapam: [130, 60, 220], pesarattu: [80, 40, 150], appam: [70, 40, 120], 'kaathi roll': [180, 100, 260], piece: [50, 8, 200], 'large piece': [100, 40, 250],
  capsicum: [120, 60, 200], brinjal: [120, 60, 200], tomato: [100, 50, 180], kofta: [40, 15, 80], gushtaba: [80, 40, 150], chop: [70, 30, 150], chops: [70, 30, 150],
  kabab: [60, 20, 120], kebab: [60, 20, 120], chicken: [150, 60, 400], fillet: [120, 60, 250], fish: [120, 50, 250], joint: [150, 60, 300],
  vada: [40, 15, 90], bonda: [40, 15, 90], gunjia: [40, 15, 80], teaspoon: [5, 3, 8], tablespoon: [15, 8, 25], 'ice-cream cup': [90, 40, 200], 'souffle cup': [90, 40, 200],
  kulfi: [80, 40, 150], burfi: [30, 10, 60], ladoo: [35, 15, 70], 'gulab jamun': [45, 20, 80], malqura: [40, 20, 80], tukra: [60, 20, 120], samosa: [80, 30, 130],
  kachori: [60, 25, 100], cutlet: [60, 25, 120], burger: [150, 80, 250], 'spring roll': [80, 30, 150], tart: [60, 25, 120], pie: [120, 50, 250], puff: [60, 25, 120],
  'éclair': [60, 25, 120], patty: [60, 25, 120], 'swiss roll': [40, 15, 100], pastry: [80, 30, 150], finger: [20, 8, 50], cookie: [15, 5, 40], biscuit: [10, 4, 30],
  muthia: [30, 10, 60], tikki: [60, 25, 120], cheela_: [70, 40, 120], 'ice cream cup': [90, 40, 200], sandwich: [130, 60, 250], momo: [30, 15, 60],
  mug: [250, 150, 400], ball: [30, 10, 80], scoop: [70, 40, 120], serving: [150, 60, 350], portion: [150, 60, 350], wedge: [80, 30, 150], square: [30, 10, 80]
};
const FRIED_RE = /\b(poori|puri|pakor|pakod|bhaji|bhajji|bajji|vada|bonda|samosa|kachori|cutlet|fried|fry|tikki|chop\b|muthia|namak para|mathri|khasta|luchi|bhatura|kofta|gunjia|gujiya|malpua|jalebi|imarti|chips|fritter|balushahi|patty|puff|spring roll|scotch egg|cheese balls|toast\b|tali)/i;
const SWEET_RE = /\b(burfi|barfi|ladoo|laddu|laddoo|biscuit|cookie|chikki|halwa|cake|namkeen|chivda|mixture|peda|katli|mysore pak|soan papdi|chocolate|toffee|brittle|shrikhand|kheer|payasam)/i;
function indbCategory(name, src) {
  const n = name.toLowerCase();
  if (/\b(tea|coffee|juice|lassi|milk shake|milkshake|sharbat|squash|panna|jaljeera|lemonade|smoothie|drink|shake|cocoa|buttermilk|chaas|soda|punch|thandai|kanji)\b/.test(n)) return 'beverages';
  if (/\b(soup|shorba)\b/.test(n)) return 'chinese';
  if (/\b(biryani|biriyani|pulao|pulav|rice|khichdi|khichri|bath|pongal|kheer)\b/.test(n) && !/\b(kheer)\b/.test(n)) return 'rice';
  if (/\b(chapati|roti|paratha|parantha|naan|kulcha|poori|puri|bhatura|thepla|bread|bun|loaf|toast|luchi)\b/.test(n)) return 'breads';
  if (/\b(idli|dosa|uttapam|vada|sambar|sambhar|rasam|appam|upma|pesarattu|adai|paniyaram|puttu|idiyappam|kootu|poriyal|avial|payasam|bisi bele)\b/.test(n)) return 'south';
  if (/\b(dal|dhal|rajma|rajmah|chole|chana|channa|lobia|sprouts|kadhi|sambar|usal|moong|masoor|urad|beans curry)\b/.test(n)) return 'dal';
  if (/\b(chicken|mutton|meat|keema|kheema|fish|prawn|shrimp|crab|lamb|beef|pork|liver|kebab|kabab|seekh|tikka|tandoori)\b/.test(n)) return 'nonveg';
  if (/\b(egg|omelette|omelet|scrambled|bhurji)\b/.test(n)) return 'eggs';
  if (/\b(halwa|ladoo|laddu|burfi|barfi|kheer|jamun|rasgulla|rasmalai|jalebi|peda|sweet|pudding|custard|ice cream|ice-cream|cake|pastry|mousse|tart|pie|souffle|kulfi|shrikhand|malpua|gujiya|gunjia|chikki|toffee|fudge|chocolate|biscuit|cookie|cookies|muffin|brownie|dessert|sandesh|mithai|payasam|phirni|rabri|basundi|meetha|meethi)\b/.test(n)) return 'sweets';
  if (/\b(pakora|pakoda|samosa|kachori|cutlet|tikki|chaat|bhel|puri|dhokla|khandvi|momos|roll|bonda|bajji|bhajia|fritter|patties|puff|sandwich|burger|pizza|namkeen|mathri|mixture|chivda|snack|nachos|wrap|frankie|kathi)\b/.test(n)) return 'snacks';
  if (/\b(raita|curd|dahi|paneer|cheese|yogurt|lassi|milk)\b/.test(n)) return 'dairy';
  if (/\b(salad|kachumber|koshimbir)\b/.test(n)) return 'vegetables';
  if (/\b(chutney|pickle|achar|sauce|dip|spread|jam|marmalade)\b/.test(n)) return 'condiments';
  if (/\b(noodles|chowmein|manchurian|fried rice|chilli|schezwan|pasta|macaroni|spaghetti|lasagna|pizza)\b/.test(n)) return 'chinese';
  if (/\b(sabzi|subzi|curry|bhaji|bharta|masala|kofta|korma|fry|gobi|aloo|bhindi|baingan|palak|methi|lauki|matar|mushroom|kadhai|karahi|stuffed|vegetable|veg|saag|paneer)\b/.test(n)) return 'vegcurry';
  if (/\b(porridge|daliya|dalia|oats|cereal|poha|muesli|pancake|waffle|cheela|chilla)\b/.test(n)) return 'breakfast';
  return 'regional';
}
function indbVeg(name) {
  const n = name.toLowerCase();
  if (/\b(chicken|mutton|meat|keema|kheema|fish|prawn|shrimp|crab|lamb|beef|pork|liver|goat|hen|duck|squid|lobster|turkey|bacon|ham|sausage|salami|minced)\b/.test(n)) return 3;
  if (/\b(egg|omelette|omelet|omlette|mayonnaise|cake|pastry|muffin|brownie|souffle|custard|meringue|mousse|pie|tart|éclair|eclair|cookie|biscuit|pancake|waffle|swiss roll|doughnut|donut|scotch)\b/.test(n)) return 2;
  return 1;
}
function parseName(raw) {
  // "Pea paneer curry (Matar paneer)" → name "Matar paneer (Pea paneer curry)", aliases from parentheses & slashes
  let s = raw.replace(/\s+/g, ' ').trim();
  const aliases = [];
  const m = s.match(/^(.*?)\s*\((.*)\)\s*$/);
  let main = s;
  if (m) {
    main = m[1].trim();
    for (const part of m[2].split(/\/|,/)) { const t = part.trim(); if (t) aliases.push(t); }
  }
  for (const part of main.split('/')) { const t = part.trim(); if (t && t !== main) aliases.push(t); }
  // prefer the Indian name as display name when present
  const display = aliases.length && m ? `${aliases[0]} (${main})` : main;
  return { display, aliases: [main, ...aliases].filter((x, i, arr) => arr.indexOf(x) === i) };
}
let indbKept = 0, indbDroppedFried = 0, indbDroppedDup = 0, indbDroppedBad = 0;
for (const r of indb) {
  if (!Number.isFinite(r.kcal) || r.kcal <= 0 || !Number.isFinite(r.prot) || !Number.isFinite(r.carb) || !Number.isFinite(r.fat)) { indbDroppedBad++; continue; }
  const fried = FRIED_RE.test(r.name);
  const sweet = SWEET_RE.test(r.name);
  // INDB counts all frying oil in the recipe, inflating fried items; curated set covers those.
  if (r.kcal > 450 && !(sweet && r.kcal <= 520) && !/\b(ghee|oil|butter|nuts?|coconut)\b/i.test(r.name)) { indbDroppedFried++; continue; }
  if (fried && r.kcal > 350) { indbDroppedFried++; continue; }
  const { display, aliases } = parseName(r.name);
  const nn = aliases.map(norm);
  if (nn.some((x) => nameIndex.has(x))) { indbDroppedDup++; continue; }
  const unit = (r.unit || 'serving').toLowerCase().trim();
  const u = UNIT[unit] || UNIT.serving;
  const computed = r.skcal > 0 ? (r.skcal / r.kcal) * 100 : NaN;
  const grams = Number.isFinite(computed) && computed >= u[1] && computed <= u[2] ? Math.round(computed) : u[0];
  const label = `1 ${unit} (${grams} g)`;
  const id = 'indb-' + r.code.toLowerCase();
  if (ids.has(id)) continue;
  ids.add(id);
  for (const x of nn) nameIndex.add(x);
  const est = 4 * r.prot + 4 * r.carb + 9 * r.fat;
  // macros inconsistent with energy (mostly INDB soups) → drop rather than show wrong macros
  if (Math.abs(est - r.kcal) > 0.5 * Math.max(r.kcal, est)) { indbDroppedBad++; ids.delete(id); continue; }
  if (Math.abs(est - r.kcal) > Math.max(30, 0.25 * r.kcal)) warn(`indb ${r.code} ${r.name}: kcal ${r.kcal.toFixed(0)} vs Atwater ${est.toFixed(0)}`);
  foods.push({
    id, n: display, a: aliases.filter((x) => x !== display), c: indbCategory(r.name), v: indbVeg(r.name),
    k: Math.round(r.kcal), p: r1(r.prot), cb: r1(r.carb), f: r1(r.fat), fb: r1(Math.min(r.fib || 0, r.carb)),
    s: [[label, grams]], src: 'indb', t: 1
  });
  indbKept++;
}

// ---------------------------------------------------------------- IFCT 2017
const ifct = JSON.parse(fs.readFileSync(path.join(__dirname, 'sources', 'ifct2017.json'), 'utf8'));
const GROUP = {
  'Cereals and Millets': ['raw', [['30 g', 30], ['1 katori raw (100 g)', 100]], ' (raw)'],
  'Grain Legumes': ['raw', [['30 g', 30], ['50 g', 50], ['1 katori raw (100 g)', 100]], ' (raw)'],
  'Green Leafy Vegetables': ['vegetables', [['1 cup chopped (50 g)', 50], ['100 g', 100]], ' (raw)'],
  'Other Vegetables': ['vegetables', [['100 g', 100], ['1 cup chopped (120 g)', 120]], ' (raw)'],
  'Fruits': ['fruits', [['100 g', 100]], ''],
  'Roots and Tubers': ['vegetables', [['100 g', 100]], ' (raw)'],
  'Condiments and Spices': ['spices', [['1 tsp (3 g)', 3], ['1 tbsp (8 g)', 8]], ''],
  'Nuts and Oil Seeds': ['nuts', [['1 handful (30 g)', 30], ['1 tbsp (10 g)', 10]], ''],
  'Sugars': ['condiments', [['1 tsp (5 g)', 5], ['1 tbsp (15 g)', 15]], ''],
  'Mushrooms': ['vegetables', [['100 g', 100]], ' (raw)'],
  'Miscellaneous Foods': ['beverages', [['1 glass (250 ml)', 250]], ''],
  'Milk and Milk Products': ['dairy', [['100 g', 100], ['1 glass (250 ml)', 250]], ''],
  'Egg and Egg Products': ['eggs', [['1 egg (50 g)', 50], ['2 eggs (100 g)', 100]], ''],
  'Poultry': ['meat', [['100 g', 100], ['150 g', 150]], ' (raw)'],
  'Animal Meat': ['meat', [['100 g', 100], ['150 g', 150]], ' (raw)'],
  'Marine Fish': ['meat', [['100 g', 100], ['1 piece (80 g)', 80]], ' (raw)'],
  'Marine Shellfish': ['meat', [['100 g', 100]], ' (raw)'],
  'Marine Mollusks': ['meat', [['100 g', 100]], ' (raw)'],
  'Fresh Water Fish and Shellfish': ['meat', [['100 g', 100], ['1 piece (80 g)', 80]], ' (raw)'],
  'Edible Oils and Fats': ['oils', [['1 tsp (5 g)', 5], ['1 tbsp (15 g)', 15]], '']
};
// per-item serving overrides (grams) for common produce
const PIECE = {
  'Apple, big': [['1 big apple (200 g)', 200]], 'Apple, small': [['1 small apple (110 g)', 110]], 'Apple, green': [['1 apple (150 g)', 150]],
  'Banana, ripe, robusta': [['1 banana (100 g)', 100]], 'Banana, ripe, poovam': [['1 small banana (60 g)', 60]], 'Banana, ripe, montham': [['1 banana (120 g)', 120]], 'Banana, ripe, red': [['1 banana (110 g)', 110]],
  'Guava, white flesh': [['1 guava (100 g)', 100]], 'Guava, pink flesh': [['1 guava (100 g)', 100]], 'Orange, pulp': [['1 orange (130 g)', 130]], 'Lime, sweet, pulp': [['1 mosambi (120 g)', 120]],
  'Papaya, ripe': [['1 bowl (150 g)', 150]], 'Pineapple': [['1 bowl (150 g)', 150]], 'Sapota': [['1 chikoo (80 g)', 80]], 'Pear': [['1 pear (150 g)', 150]], 'Peach': [['1 peach (150 g)', 150]],
  'Plum': [['1 plum (60 g)', 60]], 'Custard apple': [['1 fruit (140 g)', 140]], 'Litchi': [['10 pieces (100 g)', 100]], 'Strawberry': [['1 cup (150 g)', 150]], 'Fig': [['1 fig (50 g)', 50]],
  'Dates, dry, pale brown': [['3 dates (24 g)', 24]], 'Dates, dry, dark brown': [['3 dates (24 g)', 24]], 'Dates, processed': [['3 dates (24 g)', 24]], 'Raisins, dried, black': [['1 tbsp (10 g)', 10]], 'Raisins, dried, golden': [['1 tbsp (10 g)', 10]],
  'Coconut Water': [['1 coconut (300 ml)', 300]], 'Sugarcane, juice': [['1 glass (250 ml)', 250]], 'Toddy': [['1 glass (250 ml)', 250]],
  'Egg, poultry, whole, boiled': [['1 egg (50 g)', 50], ['2 eggs (100 g)', 100]], 'Egg, poultry, omlet': [['1 egg omelette (60 g)', 60]], 'Egg, duck, whole, boiled': [['1 egg (70 g)', 70]], 'Egg, quial, whole, boiled': [['1 egg (10 g)', 10], ['4 eggs (40 g)', 40]],
  'Paneer': [['100 g', 100], ['1 cube (20 g)', 20]], 'Khoa': [['30 g', 30]], 'Milk, whole, Cow': [['1 glass (250 ml)', 250]], 'Milk, whole, Buffalo': [['1 glass (250 ml)', 250]],
  'Almond': [['10 almonds (12 g)', 12], ['1 handful (30 g)', 30]], 'Cashew nut': [['10 cashews (17 g)', 17]], 'Walnut': [['4 halves (16 g)', 16]], 'Pistachio nuts': [['10 pistachios (8 g)', 8]], 'Ground nut': [['1 handful (30 g)', 30]],
  'Jaggery, cane': [['1 piece (10 g)', 10]], 'Ghee': [['1 tsp (5 g)', 5], ['1 tbsp (15 g)', 15]],
  'Potato, brown skin, big': [['1 medium (120 g)', 120]], 'Potato, brown skin, small': [['1 small (80 g)', 80]], 'Potato, red skin': [['1 medium (120 g)', 120]], 'Sweet potato, brown skin': [['1 medium (130 g)', 130]], 'Sweet potato, pink skin': [['1 medium (130 g)', 130]],
  'Carrot, orange': [['1 medium (80 g)', 80]], 'Carrot, red': [['1 medium (80 g)', 80]], 'Beet root': [['1 medium (100 g)', 100]], 'Tomato, ripe, hybrid': [['1 medium (100 g)', 100]], 'Tomato, ripe, local': [['1 medium (100 g)', 100]],
  'Onion, big': [['1 medium (100 g)', 100]], 'Onion, small': [['5 small onions (50 g)', 50]], 'Cucumber, green, elongate': [['1 medium (150 g)', 150]], 'Cucumber, green, short': [['1 medium (120 g)', 120]],
  'Corn, Baby': [['5 pieces (50 g)', 50]], 'Maize, tender, sweet': [['1 cup (100 g)', 100]], 'Maize, tender, local': [['1 cob (150 g)', 150]], 'Peas, fresh': [['1/2 cup (80 g)', 80]], 'Water Chestnut': [['5 pieces (50 g)', 50]],
  'Garlic, big clove': [['1 clove (3 g)', 3]], 'Garlic, small clove': [['1 clove (2 g)', 2]], 'Ginger, fresh': [['1 tsp (5 g)', 5]], 'Chillies, green - all varieties': [['1 chilli (5 g)', 5]], 'Lemon, juice': [['juice of 1 lemon (30 ml)', 30]],
  'Coriander leaves': [['2 tbsp (5 g)', 5]], 'Mint leaves': [['2 tbsp (5 g)', 5]], 'Curry leaves': [['10 leaves (2 g)', 2]]
};
const SKIP_IFCT = /^(Brinjal-\d+|Chillies, green-\d+)$/; // numbered varietal replicates; keep "all varieties"
let ifctKept = 0, ifctSkipped = 0, ifctDup = 0;
for (const r of ifct) {
  if (SKIP_IFCT.test(r.name)) { ifctSkipped++; continue; }
  const g = GROUP[r.grup];
  if (!g) { warn(`ifct: unknown group ${r.grup}`); continue; }
  const kcal = r.kj / 4.184;
  if (!Number.isFinite(kcal) || kcal < 0) { ifctSkipped++; continue; }
  const [cat, defServ, suffix] = g;
  // Hindi local name → alias (lang string like "H. Gai ka doodh; Kan. ...")
  const aliases = [];
  const hm = /(?:^|;\s*)H\.\s*([^;]+)/.exec(r.lang || '');
  if (hm) for (const t of hm[1].split(/,|\//)) { const x = t.trim(); if (x && x.length < 30) aliases.push(x); }
  const tm = /(?:^|;\s*)Tam\.\s*([^;]+)/.exec(r.lang || '');
  if (tm) { const x = tm[1].split(/,|\//)[0].trim(); if (x && x.length < 30) aliases.push(x); }
  const base = r.name.replace(/\s+/g, ' ').trim();
  if (nameIndex.has(norm(base))) { ifctDup++; continue; } // curated entry with household portions wins
  const name = base + suffix;
  const servings = PIECE[base] || defServ;
  const id = 'ifct-' + r.code.toLowerCase();
  if (ids.has(id)) continue;
  ids.add(id);
  const veg = /^(M)/.test(r.code) ? 2 : /^(N|O|P|Q|R|S)/.test(r.code) ? 3 : 1;
  foods.push({
    id, n: name, a: aliases, c: cat, v: veg,
    k: Math.round(kcal), p: r1(r.prot), cb: r1(r.carb), f: r1(r.fat), fb: r1(r.fib),
    s: servings, src: 'ifct', t: 2
  });
  ifctKept++;
}

// ---------------------------------------------------------------- write
foods.sort((a, b) => a.t - b.t || a.n.localeCompare(b.n));
const byCat = {};
for (const f of foods) byCat[f.c] = (byCat[f.c] || 0) + 1;
const out = {
  version: 1,
  generated: new Date().toISOString().slice(0, 10),
  count: foods.length,
  categories: CATEGORIES,
  sources: {
    cur: 'Curated household portions (standard Indian references; "nh" rows cross-checked with Nutrition & Health, Annexure-5)',
    indb: 'Indian Nutrient Databank (INDB) – Jaacks et al., recipes per 100 g',
    ifct: 'ICMR-NIN Indian Food Composition Tables 2017 (raw foods per 100 g)'
  },
  foods
};
fs.mkdirSync(path.dirname(OUT), { recursive: true });
const json = JSON.stringify(out);
fs.writeFileSync(OUT, json);
// gzip copy for the app (small download / small APK) + version manifest for remote updates
const gz = zlib.gzipSync(json, { level: 9 });
fs.writeFileSync(OUT + '.gz', gz);
const dbVersion = Number(new Date().toISOString().replace(/[-T:]/g, '').slice(0, 12)); // YYYYMMDDHHMM
out.version = dbVersion;
fs.writeFileSync(OUT, JSON.stringify(out));
fs.writeFileSync(OUT + '.gz', zlib.gzipSync(JSON.stringify(out), { level: 9 }));
const off = buildOff(path.join(__dirname, 'sources', 'off-india.json'), path.dirname(OUT), nameIndex, norm);
fs.writeFileSync(path.join(path.dirname(OUT), 'version.json'), JSON.stringify({ version: dbVersion, count: foods.length, extraCount: off.count, files: { core: 'foods.json.gz', extra: 'foods-off.json.gz' }, bytes: fs.statSync(OUT + '.gz').size, generated: out.generated }));
const report = [
  `Generated ${out.generated}`,
  `Total foods: ${foods.length}`,
  `  curated: ${curatedCount}`,
  `  INDB kept: ${indbKept} (dropped fried/inflated: ${indbDroppedFried}, duplicates of curated: ${indbDroppedDup}, bad rows: ${indbDroppedBad})`,
  `  IFCT kept: ${ifctKept} (skipped varietal replicates: ${ifctSkipped}, duplicates of curated: ${ifctDup})`,
  `By category: ${Object.entries(byCat).sort((a, b) => b[1] - a[1]).map(([k, v]) => `${k}=${v}`).join(', ')}`,
  `Output: ${OUT} (${(fs.statSync(OUT).size / 1024).toFixed(0)} KB, gz ${(fs.statSync(OUT + '.gz').size / 1024).toFixed(0)} KB, db version ${dbVersion})`,
  '',
  `Warnings (${warnings.length}):`,
  ...warnings
].join('\n');
fs.writeFileSync(REPORT, report);
console.log(report.split('\n').slice(0, 8).join('\n'));
console.log(`Warnings: ${warnings.length} (see data-build/build-report.txt)`);
