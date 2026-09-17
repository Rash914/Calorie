// Scale: a plain reference for the household measures used across the app.
// Weights follow ICMR-NIN / Indian Dietetic Association standard household measures
// (katori 150 ml, cup 200 ml, glass 250 ml, tsp 5 ml, tbsp 15 ml) and the portion sizes used in our database.
import { h, clear } from '../util.js';

const SECTIONS = [
  {
    title: 'Containers', emoji: '🥣',
    intro: 'Fill level matters: "1 katori" means filled level, not heaped.',
    rows: [
      ['Small katori', '100 ml', 'Palm-sized steel bowl; the small chutney/dal bowl in a thali. ≈ 100 g dal or sabzi.'],
      ['Katori (standard)', '150 ml', 'The everyday dal bowl (≈ 9–10 cm wide). ≈ 150 g cooked dal, rice or sabzi. This is our default "1 katori".'],
      ['Large katori / bowl', '200–250 ml', 'Soup or cereal bowl (≈ 12 cm). "1 bowl" in the app = 150 g unless the food says otherwise; a restaurant bowl is 200–300 g.'],
      ['Cup', '200 ml', 'Tea cup / measuring cup. 1 cup cooked rice ≈ 130–150 g; 1 cup of tea = 150 ml.'],
      ['Glass', '250 ml', 'A standard steel/water glass. Milk, lassi, juice servings use this. Large lassi glass = 300–350 ml.'],
      ['Mug', '250–300 ml', 'Coffee mug. Tall café glasses are 350–450 ml.'],
      ['Half plate', '150–200 g', 'Half a dinner plate of rice / biryani (street-food "half plate").'],
      ['Full plate', '250–300 g', 'A full 10-inch dinner plate of rice (250 g) or biryani (300 g). Restaurant biryani is often 350–500 g.'],
      ['Thali', '~650 g', 'Typical veg thali: 2 roti + 1 katori rice + dal + sabzi + salad + curd.']
    ]
  },
  {
    title: 'Spoons & hands', emoji: '🥄',
    rows: [
      ['Teaspoon (tsp)', '5 ml / ≈ 4–5 g', 'Sugar 4 g, ghee/oil 5 g, honey 7 g.'],
      ['Tablespoon (tbsp)', '15 ml / ≈ 12–15 g', 'Peanut butter 16 g, jam 20 g, cream 15 g, chutney 15 g.'],
      ['Indian serving spoon (chammach)', '≈ 10–12 g', 'Between tsp and tbsp; we count "1 spoon" as 10 g.'],
      ['Handful (mutthi)', '≈ 30 g', 'Closed fist of nuts, namkeen or chivda. Open palm = 40–50 g.'],
      ['Fingertip / thumb-tip', '≈ 5 g', 'Butter or ghee the size of your thumb tip ≈ 1 tsp.'],
      ['Palm', '≈ 100 g', 'A palm-sized (no fingers) piece of paneer, chicken or fish ≈ 100 g, about 1 cm thick.']
    ]
  },
  {
    title: 'Rotis & breads', emoji: '🫓',
    intro: 'Weights are cooked weight without ghee. Add ~5 g / 45 kcal for a teaspoon of ghee on top.',
    rows: [
      ['Small roti / phulka', '30 g · ~15 cm (6")', 'Thin, made from ~20 g atta. Typical in Gujarat/Maharashtra homes. ≈ 70 kcal.'],
      ['Medium roti (default)', '45 g · ~18 cm (7")', 'The common home chapati from ~30 g atta. ≈ 105 kcal. This is what "1 roti" means in the app.'],
      ['Large roti', '60 g · ~22 cm (8–9")', 'Thick or dhaba-style roti. ≈ 140 kcal.'],
      ['Tandoori roti', '70 g', 'Restaurant tandoor roti, thicker than a phulka. ≈ 175 kcal.'],
      ['Naan', '90–110 g', 'Restaurant naan; butter/garlic naan is 100–110 g and ≈ 300 kcal.'],
      ['Paratha', '70 g plain · 100 g stuffed', 'Plain 300 kcal/100 g; aloo paratha ≈ 240 kcal per 100 g piece.'],
      ['Poori', '30 g · ~10 cm', 'Small puffed poori ≈ 100 kcal; large (45 g) ≈ 150.'],
      ['Bread slice', '28–30 g', 'Standard sandwich slice; brown/multigrain ≈ 30 g.']
    ]
  },
  {
    title: 'Rice, dal & sabzi', emoji: '🍚',
    rows: [
      ['1 katori cooked rice', '150 g', '≈ 195 kcal. 1 cup ≈ 130 g. 1 plate ≈ 250 g (325 kcal).'],
      ['1 katori dal', '150 g', 'Home dal tadka ≈ 105 kcal/100 g → 160 kcal per katori. Thin sambar is lighter (≈ 90).'],
      ['1 katori dry sabzi', '100–150 g', 'Dry sabzi is denser; a heaped katori is ~150 g. Gravy sabzi: 150 g.'],
      ['1 katori paneer gravy', '150 g', '≈ 4–5 paneer cubes (60 g) with gravy.'],
      ['1 katori chicken curry', '150 g', '≈ 2 medium pieces with gravy.'],
      ['1 katori curd', '150 g', '≈ 90 kcal (full-fat).']
    ]
  },
  {
    title: 'Pieces', emoji: '🥟',
    rows: [
      ['Idli', 'small 25 g · medium 40 g · large 60 g', 'Hotel idli ≈ 40 g (56 kcal). Mini idli ≈ 15 g.'],
      ['Dosa', 'plain 80 g · masala 200 g', 'Plain dosa ≈ 130 kcal; masala dosa (with filling) ≈ 360 kcal.'],
      ['Medu vada', '50 g', '≈ 150 kcal each.'],
      ['Samosa', 'small 35 g · medium 85 g · large 110 g', 'Street samosa ≈ 85 g (≈ 220 kcal).'],
      ['Pakora / bhajiya', '25 g each', 'A plate is 6–8 pieces (150–200 g).'],
      ['Gulab jamun', '50 g (with syrup)', '≈ 150 kcal. Small (35 g) ≈ 105.'],
      ['Ladoo / barfi', '25–40 g', 'Motichoor ladoo 40 g (160 kcal); kaju katli 15 g (70 kcal).'],
      ['Egg', '50 g whole', 'Boiled egg ≈ 78 kcal; egg white alone ≈ 17.'],
      ['Chicken tikka', '30 g per piece', '4 pieces ≈ 120 g (≈ 215 kcal).'],
      ['Pizza slice', '100 g (regular 8-slice)', '≈ 250 kcal; a personal 7" pizza ≈ 300 g.'],
      ['Biscuit', 'Parle-G 4.5 g · Marie 5 g · cream biscuit 15 g', 'Multiply by how many you had.'],
      ['Chocolate bar', 'small 25 g · regular 45 g · Silk 60 g', '≈ 5.3 kcal per gram.']
    ]
  },
  {
    title: 'Fruits & veg', emoji: '🍌',
    rows: [
      ['Banana', 'small 60 g · medium 100 g · large 140 g', 'Elaichi banana = small.'],
      ['Apple / pear', 'small 110 g · medium 150 g · large 200 g', 'Tennis-ball size = medium.'],
      ['Orange / mosambi', '130 g (edible part)', ''],
      ['Mango', 'small 120 g · medium 200 g · large 300 g (flesh)', 'Alphonso ≈ medium; Banganapalli ≈ large.'],
      ['Guava / chikoo', '100 g · 80 g', ''],
      ['Papaya / watermelon', '1 bowl = 150–200 g', 'A bowl of cubes.'],
      ['Grapes', '1 cup = 100 g ≈ 30 grapes', ''],
      ['Dates / almonds / cashews', '8 g · 1.2 g · 1.7 g each', '10 almonds ≈ 12 g; 10 cashews ≈ 17 g.'],
      ['Onion / tomato / potato', 'medium 100 g · 100 g · 120 g', 'Small = 60 g, large = 150–180 g.'],
      ['Cucumber / carrot', '150 g · 80 g (medium)', '']
    ]
  },
  {
    title: 'Drinks', emoji: '🥤',
    rows: [
      ['Cutting chai', '90 ml', 'Half a cup.'],
      ['Cup of tea / coffee', '150 ml', '≈ 45–65 kcal with milk & sugar.'],
      ['Glass of milk', '250 ml', 'Full cream ≈ 160 kcal; toned ≈ 145.'],
      ['Lassi / shake', '250–300 ml', 'Large lassi 350 ml.'],
      ['Cold drink', 'can 300 ml · bottle 600 ml', '≈ 42 kcal per 100 ml.'],
      ['Beer / peg', 'pint 330 ml · small peg 30 ml · large peg 60 ml', ''],
      ['Water glass', '250 ml', 'Bottle 500 ml or 1 L. Our water target ≈ 35 ml per kg of body weight plus activity.']
    ]
  }
];

export function render(root) {
  clear(root);
  root.append(h('div', { class: 'card soft' },
    h('h3', null, '📏 Scale — what "1 katori" or "1 medium roti" means'),
    h('p', { class: 'muted small mt' }, 'Every portion in this app is based on these standard household measures (ICMR-NIN / Indian Dietetic Association). When you log "1 roti" or "1 katori dal", this is the amount we assume. If yours is bigger, pick the large option or enter grams.')
  ));
  for (const sec of SECTIONS) {
    const card = h('div', { class: 'card mt' }, h('h3', null, `${sec.emoji} ${sec.title}`));
    if (sec.intro) card.append(h('p', { class: 'muted small mt' }, sec.intro));
    const list = h('div', { class: 'list mt' });
    for (const [name, amt, note] of sec.rows) {
      list.append(h('div', { class: 'item', style: { alignItems: 'flex-start', padding: '10px 0' } },
        h('div', { class: 'grow' }, h('div', { class: 'name' }, name), note ? h('div', { class: 'sub' }, note) : null),
        h('div', { class: 'badge blue', style: { textAlign: 'right', whiteSpace: 'normal', maxWidth: '45%' } }, amt)));
    }
    card.append(list);
    root.append(card);
  }
  root.append(h('p', { class: 'faint tiny mt' }, 'Sources: ICMR-NIN Dietary Guidelines for Indians (standard household measures), IDA portion-size guides, Nutrition & Health Annexure-5. Values are rounded; restaurant portions are usually larger.'));
}
