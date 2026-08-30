// Small, hand-curated MVP dataset of generic food ideas — deliberately NOT
// tied to any real restaurant, brand, or live price/availability (we have no
// licensed UK product/restaurant data source yet, see docs/IMPLEMENTATION_PLAN.md
// Phase 4). Framed as "things you could eat" suggestions, same honesty bar as
// Cook Today's recipes. Swappable later: EatNowService.search's interface
// stays the same whether ranking comes from this static list or, once a real
// data source and ANTHROPIC_API_KEY-backed ranking are in place, from Layer 5.
//
// EAT_NOW_CATALOG itself is no longer read at runtime — EatNowService now
// queries the `FoodIdea` DB table (admin/food-ideas manages it) instead, so a
// dish can be added/edited/disabled without a code deploy. This array is kept
// only as the one-time seed source (scripts/seed-food-ideas.ts) and as the
// FoodIdea/BudgetTier type definitions, which are still used everywhere.

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
  { id: 'margherita-pizza', title: 'Margherita pizza', description: 'Classic tomato, mozzarella and basil on a wood-fired base — simple and always good.', cuisine: 'Italian', budgetTier: 'medium', tags: ['pizza', 'cheese', 'vegetarian', 'takeaway', 'quick'] },
  { id: 'pepperoni-pizza', title: 'Pepperoni pizza', description: 'Loaded with spicy pepperoni and melted cheese — a takeaway favourite.', cuisine: 'Italian', budgetTier: 'medium', tags: ['pizza', 'cheese', 'spicy', 'takeaway', 'quick'] },
  { id: 'veggie-pizza', title: 'Vegetarian pizza', description: 'Peppers, mushrooms, onion and olives on a cheesy base — meat-free and filling.', cuisine: 'Italian', budgetTier: 'medium', tags: ['pizza', 'cheese', 'vegetarian', 'takeaway', 'quick'] },
  { id: 'meat-feast-pizza', title: 'Meat feast pizza', description: 'Pepperoni, ham, sausage and beef piled onto one pizza — for a proper hunger.', cuisine: 'Italian', budgetTier: 'high', tags: ['pizza', 'cheese', 'meat', 'takeaway', 'filling'] },
  { id: 'bbq-chicken-pizza', title: 'BBQ chicken pizza', description: 'Smoky barbecue sauce, chicken and red onion on a cheesy base — a sweeter twist on the classic.', cuisine: 'Italian', budgetTier: 'medium', tags: ['pizza', 'cheese', 'chicken', 'takeaway'] },
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

  // Added to close a real gap: these three cuisines are offered as favourite-
  // cuisine options during onboarding (PreferencesScreen's CUISINES list) but
  // previously had zero matching entries here — someone picking "Nigerian &
  // West African" as a favourite got nothing relevant back, ever.
  { id: 'jollof-rice', title: 'Jollof rice with chicken', description: 'Smoky, spiced tomato rice with chicken — a West African favourite.', cuisine: 'Nigerian & West African', budgetTier: 'medium', tags: ['spicy', 'rice', 'chicken', 'comfort'] },
  { id: 'egusi-soup', title: 'Egusi soup with pounded yam', description: 'Rich ground melon-seed stew with leafy greens, served with pounded yam.', cuisine: 'Nigerian & West African', budgetTier: 'medium', tags: ['spicy', 'filling', 'comfort'] },
  { id: 'suya-skewers', title: 'Suya skewers', description: 'Grilled, thinly-sliced beef coated in a spiced peanut suya mix — a popular West African street food.', cuisine: 'Nigerian & West African', budgetTier: 'low', tags: ['spicy', 'quick', 'skewers', 'peanut'] },
  { id: 'souvlaki-wrap', title: 'Souvlaki wrap', description: 'Grilled meat skewers wrapped in warm pitta with tzatziki and salad.', cuisine: 'Mediterranean', budgetTier: 'low', tags: ['quick', 'wrap', 'grilled'] },
  { id: 'greek-salad', title: 'Greek salad with feta', description: 'Tomatoes, cucumber, olives and feta with olive oil — light and fresh.', cuisine: 'Mediterranean', budgetTier: 'medium', tags: ['vegetarian', 'light', 'fresh', 'salad'] },
  { id: 'croque-monsieur', title: 'Croque monsieur', description: 'Grilled ham and cheese sandwich with a rich béchamel top.', cuisine: 'French', budgetTier: 'low', tags: ['cheese', 'quick', 'comfort'] },
  { id: 'ratatouille', title: 'Ratatouille with crusty bread', description: 'Stewed Mediterranean vegetables in a classic French style — warm and comforting.', cuisine: 'French', budgetTier: 'medium', tags: ['vegetarian', 'light', 'comfort', 'home'] },

  // Widened from the original 31-item MVP set — more depth per cuisine (every
  // onboarding CUISINES option now has 4+ entries, not 1-3), plus more
  // breakfast, vegetarian/vegan, and quick/cheap/home options so a wider
  // range of queries actually match something instead of falling through to
  // "no recipes match" (see EatNowService.search's substring scoring).
  { id: 'spaghetti-bolognese', title: 'Spaghetti bolognese', description: 'Rich meat sauce over spaghetti — a reliable Italian classic.', cuisine: 'Italian', budgetTier: 'medium', tags: ['pasta', 'beef', 'comfort', 'filling'] },
  { id: 'lasagne', title: 'Lasagne', description: 'Layers of pasta, meat sauce and cheese, baked until bubbling.', cuisine: 'Italian', budgetTier: 'medium', tags: ['pasta', 'cheese', 'comfort', 'filling'] },
  { id: 'mushroom-risotto', title: 'Mushroom risotto', description: 'Creamy Italian rice dish, slow-stirred with mushrooms and parmesan.', cuisine: 'Italian', budgetTier: 'medium', tags: ['rice', 'vegetarian', 'comfort'] },
  { id: 'caprese-salad', title: 'Caprese salad', description: 'Tomato, mozzarella and basil with olive oil — simple and fresh.', cuisine: 'Italian', budgetTier: 'low', tags: ['vegetarian', 'light', 'fresh', 'salad'] },
  { id: 'hot-dog', title: 'Hot dog', description: 'A classic American hot dog loaded with your favourite toppings.', cuisine: 'American', budgetTier: 'low', tags: ['quick', 'cheap', 'takeaway'] },
  { id: 'mac-and-cheese', title: 'Mac and cheese', description: 'Creamy baked pasta with cheese — easy comfort food.', cuisine: 'American', budgetTier: 'low', tags: ['cheese', 'comfort', 'easy', 'home', 'vegetarian'] },
  { id: 'bbq-ribs', title: 'BBQ ribs with fries', description: 'Smoky, sticky barbecue ribs — a hearty American favourite.', cuisine: 'American', budgetTier: 'high', tags: ['comfort', 'filling'] },
  { id: 'banh-mi', title: 'Banh mi', description: 'Vietnamese baguette sandwich with pork, pickled veg and herbs.', cuisine: 'Vietnamese', budgetTier: 'low', tags: ['quick', 'sandwich', 'fresh'] },
  { id: 'vietnamese-spring-rolls', title: 'Fresh spring rolls', description: 'Rice paper rolls with prawns, herbs and noodles — light and fresh.', cuisine: 'Vietnamese', budgetTier: 'medium', tags: ['light', 'fresh', 'healthy'] },
  { id: 'curry-goat', title: 'Curry goat with rice and peas', description: 'Slow-cooked spiced goat curry — a Caribbean Sunday classic.', cuisine: 'Caribbean', budgetTier: 'medium', tags: ['spicy', 'comfort', 'filling'] },
  { id: 'ackee-and-saltfish', title: 'Ackee and saltfish', description: 'Jamaica’s national dish — savoury ackee with salted cod.', cuisine: 'Caribbean', budgetTier: 'medium', tags: ['comfort', 'breakfast'] },
  { id: 'jamaican-patty', title: 'Jamaican beef patty', description: 'Flaky, spiced pastry with a savoury beef filling — quick and portable.', cuisine: 'Caribbean', budgetTier: 'low', tags: ['quick', 'cheap', 'takeaway'] },
  { id: 'thai-green-curry', title: 'Thai green curry', description: 'Coconut curry with vegetables and your choice of protein.', cuisine: 'Thai', budgetTier: 'medium', tags: ['curry', 'spicy', 'comfort'] },
  { id: 'tom-yum-soup', title: 'Tom yum soup', description: 'Hot and sour Thai soup with prawns or chicken.', cuisine: 'Thai', budgetTier: 'medium', tags: ['soup', 'spicy', 'light'] },
  { id: 'thai-fried-rice', title: 'Thai fried rice', description: 'Fragrant fried rice with egg and vegetables — quick and filling.', cuisine: 'Thai', budgetTier: 'low', tags: ['rice', 'quick', 'easy'] },
  { id: 'sweet-and-sour-chicken', title: 'Sweet and sour chicken', description: 'Crispy chicken in a tangy sweet and sour sauce.', cuisine: 'Chinese', budgetTier: 'medium', tags: ['chicken', 'takeaway', 'comfort'] },
  { id: 'egg-fried-rice', title: 'Egg fried rice', description: 'Simple, fast fried rice with egg and spring onion.', cuisine: 'Chinese', budgetTier: 'low', tags: ['rice', 'quick', 'cheap', 'easy', 'home'] },
  { id: 'kung-pao-chicken', title: 'Kung pao chicken', description: 'Spicy stir-fried chicken with peanuts and chilli.', cuisine: 'Chinese', budgetTier: 'medium', tags: ['spicy', 'chicken', 'takeaway'] },
  { id: 'tikka-masala', title: 'Chicken tikka masala with naan', description: 'Creamy spiced curry — a British-Indian favourite.', cuisine: 'Indian', budgetTier: 'medium', tags: ['curry', 'chicken', 'comfort'] },
  { id: 'dal', title: 'Dal with rice', description: 'Comforting spiced lentils — cheap, filling and vegan.', cuisine: 'Indian', budgetTier: 'low', tags: ['vegetarian', 'vegan', 'easy', 'home', 'filling'] },
  { id: 'vegetable-samosas', title: 'Vegetable samosas', description: 'Crispy pastry parcels with spiced potato and peas.', cuisine: 'Indian', budgetTier: 'low', tags: ['vegetarian', 'quick', 'snack'] },
  { id: 'moin-moin', title: 'Moin moin', description: 'Steamed bean pudding, gently spiced — filling and vegetarian.', cuisine: 'Nigerian & West African', budgetTier: 'low', tags: ['vegetarian', 'filling', 'home'] },
  { id: 'pepper-soup', title: 'Pepper soup', description: 'Light, spicy Nigerian broth — warming and quick.', cuisine: 'Nigerian & West African', budgetTier: 'medium', tags: ['spicy', 'soup', 'light'] },
  { id: 'hummus-plate', title: 'Hummus and pitta plate', description: 'Smooth hummus with warm pitta and olive oil — light and vegan.', cuisine: 'Mediterranean', budgetTier: 'low', tags: ['vegetarian', 'vegan', 'light', 'quick'] },
  { id: 'grilled-halloumi-salad', title: 'Grilled halloumi salad', description: 'Salty grilled halloumi over fresh salad — light and satisfying.', cuisine: 'Mediterranean', budgetTier: 'medium', tags: ['vegetarian', 'light', 'fresh'] },
  { id: 'mixed-grill-kebab', title: 'Mixed grill kebab plate', description: 'Grilled meats with rice and salad — filling and smoky.', cuisine: 'Middle Eastern', budgetTier: 'medium', tags: ['grilled', 'filling', 'takeaway'] },
  { id: 'lamb-kofta', title: 'Lamb kofta with rice', description: 'Spiced grilled lamb kofta — comforting and filling.', cuisine: 'Middle Eastern', budgetTier: 'medium', tags: ['spicy', 'comfort'] },
  { id: 'quiche-lorraine', title: 'Quiche lorraine with salad', description: 'Savoury egg and bacon tart — easy and light.', cuisine: 'French', budgetTier: 'medium', tags: ['light', 'easy'] },
  { id: 'french-onion-soup', title: 'French onion soup', description: 'Sweet caramelised onions in a rich broth, topped with cheese.', cuisine: 'French', budgetTier: 'low', tags: ['soup', 'comfort', 'vegetarian'] },
  { id: 'shepherds-pie', title: "Shepherd's pie", description: 'Minced lamb or beef under creamy mashed potato — British comfort food.', cuisine: 'British', budgetTier: 'medium', tags: ['comfort', 'filling', 'home'] },
  { id: 'bangers-and-mash', title: 'Bangers and mash', description: 'Sausages with creamy mash and gravy — a British staple.', cuisine: 'British', budgetTier: 'medium', tags: ['comfort', 'filling', 'home'] },
  { id: 'beans-on-toast', title: 'Beans on toast', description: 'Baked beans on buttered toast — cheap, quick and easy.', cuisine: 'British', budgetTier: 'low', tags: ['quick', 'cheap', 'easy', 'home', 'vegetarian'] },
  { id: 'stir-fry-veg', title: 'Vegetable stir-fry with rice', description: 'Quick stir-fried vegetables over rice — light and easy to make at home.', cuisine: 'Asian', budgetTier: 'low', tags: ['vegetarian', 'vegan', 'quick', 'easy', 'home'] },
  { id: 'cheese-omelette', title: 'Cheese and vegetable omelette', description: 'Fluffy eggs with cheese and vegetables — quick any time of day.', cuisine: 'International', budgetTier: 'low', tags: ['vegetarian', 'quick', 'easy', 'home', 'breakfast'] },
  { id: 'porridge', title: 'Porridge with fruit', description: 'Warm oats topped with fruit — an easy, filling breakfast.', cuisine: 'International', budgetTier: 'low', tags: ['breakfast', 'easy', 'home', 'vegetarian', 'vegan'] },
  { id: 'pancakes', title: 'Pancakes with syrup', description: 'Fluffy pancakes — an easy breakfast or weekend treat.', cuisine: 'International', budgetTier: 'low', tags: ['breakfast', 'home', 'easy', 'vegetarian'] },
];
