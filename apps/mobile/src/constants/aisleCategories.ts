// Deterministic keyword-based aisle grouping for the shopping list — inspired
// by Samsung Food's "sort by aisle" shopping list feature. Keyword matching,
// not AI: works with no external dependency and no ANTHROPIC_API_KEY.

export const AISLE_ORDER = [
  'Fruit & Veg',
  'Meat & Fish',
  'Dairy & Eggs',
  'Bakery',
  'Frozen',
  'Pantry & Dry Goods',
  'Drinks',
  'Household',
  'Other',
] as const;

export type AisleCategory = (typeof AISLE_ORDER)[number];

const KEYWORDS: Partial<Record<AisleCategory, string[]>> = {
  'Fruit & Veg': [
    'onion', 'garlic', 'pepper', 'tomato', 'potato', 'carrot', 'spinach', 'lettuce',
    'cucumber', 'apple', 'banana', 'lemon', 'lime', 'avocado', 'courgette', 'broccoli',
    'mushroom', 'ginger', 'coriander', 'parsley', 'basil', 'chilli', 'celery', 'kale',
    'cabbage', 'leek', 'sweetcorn', 'aubergine',
  ],
  'Meat & Fish': [
    'chicken', 'beef', 'pork', 'lamb', 'bacon', 'sausage', 'mince', 'salmon', 'prawn',
    'fish', 'turkey', 'ham', 'steak',
  ],
  'Dairy & Eggs': ['milk', 'cheese', 'butter', 'yoghurt', 'yogurt', 'cream', 'egg'],
  'Bakery': ['bread', 'bun', 'baguette', 'tortilla', 'pitta', 'roll', 'bagel'],
  'Frozen': ['frozen', 'ice cream'],
  'Drinks': ['juice', 'water', 'wine', 'beer', 'soda', 'cola', 'squash'],
  'Household': ['foil', 'cling film', 'bin bag', 'kitchen roll', 'washing up', 'napkin'],
  'Pantry & Dry Goods': [
    'rice', 'pasta', 'flour', 'sugar', 'oil', 'salt', 'stock', 'tin ', 'tinned', 'can of',
    'lentil', 'bean', 'spice', 'sauce', 'vinegar', 'oat', 'cereal', 'noodle', 'honey',
  ],
};

export function categorizeIngredient(name: string): AisleCategory {
  const lower = name.toLowerCase();
  for (const category of AISLE_ORDER) {
    const keywords = KEYWORDS[category];
    if (keywords?.some((keyword) => lower.includes(keyword))) {
      return category;
    }
  }
  return 'Other';
}
