// Compact curated row format:
// [id, name, aliases (pipe-separated), category, veg, kcal, protein, carbs, fat, fiber, servings, src?]
//   - nutrient values are per 100 g (or 100 ml for liquids)
//   - veg: 1 = vegetarian, 2 = contains egg, 3 = non-veg
//   - servings: array of [label, grams]; the first entry is the default portion.
//     "100 g" / "ml" are always available in the app regardless of this list.
//   - src (optional): reference tag. "nh" = Nutrition & Health textbook Annexure-5
//     (approximate calorific value of cooked preparations, ICMR/NIN based),
//     "nin" = NIN dietary guidelines, otherwise curated from standard references.

export const CATEGORIES = {
  breads: 'Rotis & Breads',
  rice: 'Rice & Grains',
  breakfast: 'Breakfast',
  south: 'South Indian',
  dal: 'Dal & Legumes',
  vegcurry: 'Veg Curries & Sabzi',
  nonveg: 'Chicken, Mutton & Seafood',
  eggs: 'Eggs',
  snacks: 'Snacks & Street Food',
  chinese: 'Indo-Chinese',
  fastfood: 'Fast Food & Bakery',
  sweets: 'Sweets & Desserts',
  beverages: 'Beverages',
  dairy: 'Dairy & Alternatives',
  fruits: 'Fruits',
  vegetables: 'Vegetables & Salads',
  nuts: 'Nuts, Seeds & Dry Fruits',
  packaged: 'Packaged & Namkeen',
  fitness: 'Protein & Fitness',
  condiments: 'Chutneys, Pickles & Spreads',
  raw: 'Raw Grains, Flours & Pulses',
  regional: 'Regional Specialities',
  meat: 'Meat, Poultry & Fish (raw)',
  spices: 'Spices & Herbs',
  oils: 'Oils & Fats'
};
