// Small, hand-curated MVP dataset of generic food ideas — deliberately NOT
// tied to any real restaurant, brand, or live price/availability (we have no
// licensed UK product/restaurant data source yet, see docs/IMPLEMENTATION_PLAN.md
// Phase 4). Framed as "things you could eat" suggestions, same honesty bar as
// Cook Today's recipes. Swappable later: EatNowService.search's interface
// stays the same whether ranking comes from this static list or, once a real
// data source and ANTHROPIC_API_KEY-backed ranking are in place, from Layer 5.

export type BudgetTier = 'low' | 'medium' | 'high';

export interface FoodIdea {
  id: string;
  title: string;
  description: string;
  cuisine: string;
  budgetTier: BudgetTier;
  tags: string[];
}

export const EAT_NOW_CATALOG: FoodIdea[] = [
  { id: 'shawarma-wrap', title: 'Chicken shawarma wrap', description: 'Warm pitta, spiced chicken, garlic sauce — ready in minutes from most kebab shops.', cuisine: 'Middle Eastern', budgetTier: 'low', tags: ['spicy', 'quick', 'takeaway', 'chicken', 'wrap'] },
  { id: 'fish-and-chips', title: 'Fish and chips', description: 'Classic battered fish with chips — a British takeaway staple.', cuisine: 'British', budgetTier: 'medium', tags: ['british', 'takeaway', 'fried', 'comfort'] },
  { id: 'chow-mein', title: 'Chicken chow mein', description: 'Stir-fried noodles with chicken and vegetables from your local Chinese takeaway.', cuisine: 'Chinese', budgetTier: 'medium', tags: ['noodles', 'takeaway', 'chicken', 'quick'] },
  { id: 'chicken-curry', title: 'Chicken curry and rice', description: 'A warming curry with rice — order in or grab a ready meal.', cuisine: 'Indian', budgetTier: 'medium', tags: ['curry', 'spicy', 'chicken', 'comfort'] },
  { id: 'pizza-slice', title: 'Pizza', description: 'A hot pizza slice or a whole pie delivered — quick and filling.', cuisine: 'Italian', budgetTier: 'medium', tags: ['pizza', 'cheese', 'takeaway', 'quick'] },
  { id: 'burger-and-chips', title: 'Burger and chips', description: 'A classic burger with fries from a local grill or takeaway.', cuisine: 'American', budgetTier: 'medium', tags: ['burger', 'quick', 'comfort'] },
  { id: 'ramen-bowl', title: 'Bowl of ramen', description: 'Rich broth, noodles, and toppings — filling and warming.', cuisine: 'Japanese', budgetTier: 'medium', tags: ['noodles', 'soup', 'comfort', 'warm'] },
  { id: 'pho-bowl', title: 'Bowl of pho', description: 'Fragrant Vietnamese noodle soup with herbs and your choice of protein.', cuisine: 'Vietnamese', budgetTier: 'medium', tags: ['noodles', 'soup', 'light', 'fresh'] },
  { id: 'burrito', title: 'Burrito', description: 'A big wrap packed with rice, beans, meat or veg, and salsa.', cuisine: 'Mexican', budgetTier: 'medium', tags: ['spicy', 'quick', 'wrap', 'filling'] },
  { id: 'jerk-chicken', title: 'Jerk chicken with rice and peas', description: 'Smoky, spiced jerk chicken — a Caribbean favourite.', cuisine: 'Caribbean', budgetTier: 'medium', tags: ['spicy', 'chicken', 'comfort'] },
  { id: 'biryani', title: 'Chicken biryani', description: 'Fragrant spiced rice layered with chicken — a hearty one-bowl meal.', cuisine: 'Indian', budgetTier: 'medium', tags: ['spicy', 'rice', 'chicken', 'filling'] },
  { id: 'sushi-box', title: 'Sushi box', description: 'A mixed sushi selection — light, fresh, and quick to grab.', cuisine: 'Japanese', budgetTier: 'high', tags: ['fish', 'light', 'fresh', 'quick'] },
  { id: 'falafel-wrap', title: 'Falafel wrap', description: 'Crispy falafel, salad, and hummus in a warm wrap — a solid veggie option.', cuisine: 'Middle Eastern', budgetTier: 'low', tags: ['vegetarian', 'vegan', 'quick', 'wrap', 'light'] },
  { id: 'meal-deal-sandwich', title: 'Meal deal sandwich', description: 'A sandwich, snack, and drink from any supermarket meal deal — quick and cheap.', cuisine: 'British', budgetTier: 'low', tags: ['quick', 'cheap', 'lunch', 'easy'] },
  { id: 'ready-meal-curry', title: 'Ready meal curry', description: 'A microwaveable curry ready meal from the supermarket — minimal effort.', cuisine: 'Indian', budgetTier: 'low', tags: ['curry', 'easy', 'quick', 'home', 'spicy'] },
  { id: 'instant-noodles', title: 'Instant noodles', description: 'Add hot water and you have dinner in five minutes.', cuisine: 'Asian', budgetTier: 'low', tags: ['noodles', 'quick', 'cheap', 'easy', 'home'] },
  { id: 'cheese-toastie', title: 'Cheese toastie', description: 'Grilled cheese sandwich — five minutes, minimal ingredients.', cuisine: 'British', budgetTier: 'low', tags: ['cheese', 'quick', 'easy', 'home', 'comfort'] },
  { id: 'jacket-potato', title: 'Jacket potato with beans and cheese', description: 'A baked potato loaded with toppings — filling and low-effort.', cuisine: 'British', budgetTier: 'low', tags: ['vegetarian', 'easy', 'home', 'comfort'] },
  { id: 'soup-and-bread', title: 'Soup and bread', description: 'A bowl of soup with crusty bread — quick, warm, and light.', cuisine: 'British', budgetTier: 'low', tags: ['light', 'quick', 'home', 'warm', 'vegetarian'] },
  { id: 'salad-bowl', title: 'Big salad bowl', description: 'Leaves, protein, and toppings of your choice — light and fresh.', cuisine: 'International', budgetTier: 'medium', tags: ['salad', 'light', 'fresh', 'healthy'] },
  { id: 'pad-thai', title: 'Pad thai', description: 'Stir-fried rice noodles with egg, peanuts, and a tangy sauce.', cuisine: 'Thai', budgetTier: 'medium', tags: ['noodles', 'spicy', 'takeaway'] },
  { id: 'tacos', title: 'Tacos', description: 'Soft or crispy tacos with your choice of filling — quick to make or order.', cuisine: 'Mexican', budgetTier: 'medium', tags: ['spicy', 'quick', 'takeaway'] },
  { id: 'dumplings', title: 'Dumplings', description: 'Steamed or fried dumplings — a quick, satisfying snack or light meal.', cuisine: 'Chinese', budgetTier: 'medium', tags: ['takeaway', 'quick', 'comfort'] },
  { id: 'katsu-curry', title: 'Chicken katsu curry', description: 'Crispy breaded chicken with a mild Japanese curry sauce and rice.', cuisine: 'Japanese', budgetTier: 'medium', tags: ['curry', 'chicken', 'comfort'] },
  { id: 'full-english', title: 'Full English breakfast', description: 'Eggs, bacon, sausage, beans, and toast — a hearty British classic.', cuisine: 'British', budgetTier: 'medium', tags: ['breakfast', 'comfort', 'filling'] },
];
