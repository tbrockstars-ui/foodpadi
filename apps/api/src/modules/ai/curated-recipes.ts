import type { RawRecipeCandidate } from './claude.service';

/**
 * The deterministic recipe pool. Two distinct jobs, one dataset:
 *
 *  1. ClaudeService's demo fallback — with no ANTHROPIC_API_KEY set, Cook
 *     Today / Plan Ahead serve from here instead of a live model, so the
 *     features can be built and demoed end to end.
 *  2. The **guest** path — a guest must never trigger a paid AI call
 *     (see docs/AI_SAFETY_POLICY.md and the guest-mode brief). Guest Cook
 *     Today, guest Decide's "cook it" lane, and the guest Plan Ahead preview
 *     all draw from this pool via the pure helpers below — never
 *     `ClaudeService`.
 *
 * Everything here passes the same Layer 3 validation (recipe-validation.ts)
 * as a real model response. `import type` above keeps this file free of any
 * runtime dependency on ClaudeService, so there's no import cycle even
 * though ClaudeService imports the pool back.
 */
export const CURATED_RECIPES: RawRecipeCandidate[] = [
  {
    title: 'Homemade Pizza',
    cookTimeMinutes: 40,
    servings: 4,
    cuisine: 'Italian',
    ingredients: [
      { name: 'pizza dough', quantity: '2', unit: 'balls' },
      { name: 'tomato sauce', quantity: '200', unit: 'g' },
      { name: 'mozzarella', quantity: '250', unit: 'g' },
      { name: 'olive oil', quantity: '2', unit: 'tbsp' },
      { name: 'basil', quantity: 'a handful', unit: null },
      { name: 'garlic', quantity: '1 clove', unit: null },
    ],
    steps: [
      'Heat the oven as high as it will go, with a tray inside to preheat.',
      'Roll out the dough on a floured surface into a thin base.',
      'Spread over the tomato sauce (mixed with the crushed garlic), then scatter the mozzarella.',
      'Slide onto the hot tray and bake 10-12 minutes until the crust is golden and cheese is bubbling.',
      'Drizzle with olive oil and scatter over fresh basil before serving.',
    ],
  },
  {
    title: 'One-Pot Chicken & Rice',
    cookTimeMinutes: 35,
    servings: 4,
    cuisine: 'British',
    ingredients: [
      { name: 'chicken thighs', quantity: '4', unit: null },
      { name: 'rice', quantity: '300', unit: 'g' },
      { name: 'onion', quantity: '1', unit: null },
      { name: 'garlic', quantity: '2 cloves', unit: null },
      { name: 'chicken stock', quantity: '600', unit: 'ml' },
      { name: 'carrot', quantity: '2', unit: null },
    ],
    steps: [
      'Brown the chicken thighs in a large pot, then set aside.',
      'Soften the onion, garlic and carrot in the same pot.',
      'Stir in the rice, pour over the stock, and nestle the chicken back in.',
      'Cover and simmer for 20 minutes until the rice is tender and chicken is cooked through.',
    ],
  },
  {
    title: 'Tomato & Basil Pasta',
    cookTimeMinutes: 20,
    servings: 2,
    cuisine: 'Italian',
    ingredients: [
      { name: 'pasta', quantity: '200', unit: 'g' },
      { name: 'tinned tomatoes', quantity: '400', unit: 'g' },
      { name: 'garlic', quantity: '2 cloves', unit: null },
      { name: 'basil', quantity: 'a handful', unit: null },
      { name: 'olive oil', quantity: '2', unit: 'tbsp' },
      { name: 'parmesan', quantity: '30', unit: 'g' },
    ],
    steps: [
      'Cook the pasta in salted boiling water until al dente.',
      'Fry the garlic gently in olive oil, then add the tinned tomatoes and simmer for 10 minutes.',
      'Toss the drained pasta through the sauce, top with torn basil and grated parmesan.',
    ],
  },
  {
    title: 'Chickpea & Spinach Curry',
    cookTimeMinutes: 30,
    servings: 3,
    cuisine: 'Indian',
    ingredients: [
      { name: 'chickpeas', quantity: '2 tins', unit: null },
      { name: 'spinach', quantity: '150', unit: 'g' },
      { name: 'onion', quantity: '1', unit: null },
      { name: 'curry powder', quantity: '2', unit: 'tbsp' },
      { name: 'coconut milk', quantity: '400', unit: 'ml' },
      { name: 'ginger', quantity: '1 thumb', unit: null },
    ],
    steps: [
      'Soften the onion and ginger, then stir in the curry powder for a minute.',
      'Add the chickpeas and coconut milk, simmer for 15 minutes.',
      'Stir through the spinach until wilted, then serve with rice or flatbread.',
    ],
  },
  {
    title: 'Sheet-Pan Salmon & Veg',
    cookTimeMinutes: 25,
    servings: 2,
    cuisine: 'Mediterranean',
    ingredients: [
      { name: 'salmon fillets', quantity: '2', unit: null },
      { name: 'courgette', quantity: '1', unit: null },
      { name: 'cherry tomatoes', quantity: '200', unit: 'g' },
      { name: 'lemon', quantity: '1', unit: null },
      { name: 'olive oil', quantity: '2', unit: 'tbsp' },
    ],
    steps: [
      'Toss the courgette and cherry tomatoes with olive oil on a baking tray.',
      'Roast for 10 minutes, then add the salmon fillets and lemon slices on top.',
      'Roast for a further 12-15 minutes until the salmon is cooked through.',
    ],
  },
  {
    title: 'Beef & Black Bean Tacos',
    cookTimeMinutes: 25,
    servings: 4,
    cuisine: 'Mexican',
    ingredients: [
      { name: 'beef mince', quantity: '400', unit: 'g' },
      { name: 'black beans', quantity: '1 tin', unit: null },
      { name: 'taco seasoning', quantity: '1 packet', unit: null },
      { name: 'tortillas', quantity: '8', unit: null },
      { name: 'lettuce', quantity: 'a handful', unit: null },
      { name: 'cheese', quantity: '80', unit: 'g' },
    ],
    steps: [
      'Brown the beef mince in a pan, draining any excess fat.',
      'Stir in the taco seasoning and black beans, simmer for 5 minutes.',
      'Warm the tortillas and fill with the beef mixture, lettuce and cheese.',
    ],
  },
  {
    title: 'Miso Noodle Soup',
    cookTimeMinutes: 20,
    servings: 2,
    cuisine: 'Japanese',
    ingredients: [
      { name: 'noodles', quantity: '150', unit: 'g' },
      { name: 'miso paste', quantity: '2', unit: 'tbsp' },
      { name: 'spring onion', quantity: '2', unit: null },
      { name: 'mushroom', quantity: '100', unit: 'g' },
      { name: 'egg', quantity: '2', unit: null },
      { name: 'vegetable stock', quantity: '600', unit: 'ml' },
    ],
    steps: [
      'Soft-boil the eggs in a separate pan of simmering water for 6-7 minutes, then cool under cold water and peel.',
      'Bring the stock to a simmer and whisk in the miso paste.',
      'Add the mushrooms and cook for 5 minutes, then cook the noodles in the broth.',
      'Serve topped with the halved soft-boiled eggs and sliced spring onion.',
    ],
  },
  {
    title: 'Chicken & Avocado Salad',
    cookTimeMinutes: 15,
    servings: 2,
    cuisine: 'International',
    ingredients: [
      { name: 'chicken breast', quantity: '2', unit: null },
      { name: 'mixed salad leaves', quantity: '100', unit: 'g' },
      { name: 'avocado', quantity: '1', unit: null },
      { name: 'cherry tomatoes', quantity: '150', unit: 'g' },
      { name: 'cucumber', quantity: '0.5', unit: null },
      { name: 'olive oil', quantity: '1', unit: 'tbsp' },
    ],
    steps: [
      'Grill or pan-fry the chicken breast until cooked through, then slice.',
      'Toss the salad leaves, tomatoes and cucumber with olive oil.',
      'Top with the sliced chicken and avocado.',
    ],
  },
  {
    title: 'Greek Salad',
    cookTimeMinutes: 10,
    servings: 2,
    cuisine: 'Mediterranean',
    ingredients: [
      { name: 'cucumber', quantity: '1', unit: null },
      { name: 'tomatoes', quantity: '3', unit: null },
      { name: 'red onion', quantity: '0.5', unit: null },
      { name: 'feta cheese', quantity: '150', unit: 'g' },
      { name: 'olives', quantity: '80', unit: 'g' },
      { name: 'olive oil', quantity: '2', unit: 'tbsp' },
    ],
    steps: [
      'Chop the cucumber, tomatoes and red onion into chunks.',
      'Toss with the olives and olive oil.',
      'Top with crumbled feta and serve.',
    ],
  },
  {
    title: 'Loaded Jacket Potato',
    cookTimeMinutes: 60,
    servings: 2,
    cuisine: 'British',
    ingredients: [
      { name: 'baking potatoes', quantity: '2', unit: null },
      { name: 'baked beans', quantity: '1', unit: 'tin' },
      { name: 'cheddar cheese', quantity: '80', unit: 'g' },
      { name: 'butter', quantity: '1', unit: 'tbsp' },
    ],
    steps: [
      'Prick the potatoes and bake at 200°C for about 50-60 minutes until soft.',
      'Warm the baked beans.',
      'Split the potatoes open, top with butter, beans and grated cheese.',
    ],
  },
  {
    title: 'Chicken & Vegetable Stir Fry',
    cookTimeMinutes: 20,
    servings: 2,
    cuisine: 'Chinese',
    ingredients: [
      { name: 'chicken breast', quantity: '2', unit: null },
      { name: 'mixed stir-fry vegetables', quantity: '300', unit: 'g' },
      { name: 'soy sauce', quantity: '2', unit: 'tbsp' },
      { name: 'garlic', quantity: '2 cloves', unit: null },
      { name: 'ginger', quantity: '1 thumb', unit: null },
      { name: 'rice', quantity: '200', unit: 'g' },
    ],
    steps: [
      'Cook the rice according to packet instructions.',
      'Slice the chicken and stir-fry in a hot pan or wok until cooked through.',
      'Add the garlic, ginger and vegetables, stir-fry for 3-4 minutes.',
      'Stir in the soy sauce and serve over the cooked rice.',
    ],
  },
  {
    title: 'Veggie Bean Chilli',
    cookTimeMinutes: 30,
    servings: 4,
    cuisine: 'Mexican',
    ingredients: [
      { name: 'kidney beans', quantity: '2 tins', unit: null },
      { name: 'tinned tomatoes', quantity: '400', unit: 'g' },
      { name: 'onion', quantity: '1', unit: null },
      { name: 'pepper', quantity: '1', unit: null },
      { name: 'chilli powder', quantity: '1', unit: 'tbsp' },
      { name: 'rice', quantity: '250', unit: 'g' },
    ],
    steps: [
      'Cook the rice according to packet instructions.',
      'Soften the onion and pepper, then stir in the chilli powder.',
      'Add the kidney beans and tinned tomatoes, simmer for 20 minutes.',
      'Serve with the cooked rice.',
    ],
  },
  {
    title: 'Egg Fried Rice',
    cookTimeMinutes: 15,
    servings: 2,
    cuisine: 'Chinese',
    ingredients: [
      { name: 'cooked rice', quantity: '300', unit: 'g' },
      { name: 'egg', quantity: '2', unit: null },
      { name: 'frozen peas', quantity: '100', unit: 'g' },
      { name: 'spring onion', quantity: '2', unit: null },
      { name: 'soy sauce', quantity: '1', unit: 'tbsp' },
    ],
    steps: [
      'Scramble the eggs in a hot pan or wok, then set aside.',
      'Fry the rice and peas for a few minutes until hot through.',
      'Stir the egg back in with the soy sauce and spring onion.',
    ],
  },
  {
    title: 'Spaghetti Bolognese',
    cookTimeMinutes: 35,
    servings: 4,
    cuisine: 'Italian',
    ingredients: [
      { name: 'beef mince', quantity: '400', unit: 'g' },
      { name: 'spaghetti', quantity: '350', unit: 'g' },
      { name: 'tinned tomatoes', quantity: '400', unit: 'g' },
      { name: 'onion', quantity: '1', unit: null },
      { name: 'carrot', quantity: '1', unit: null },
      { name: 'garlic', quantity: '2 cloves', unit: null },
      { name: 'tomato purée', quantity: '2', unit: 'tbsp' },
    ],
    steps: [
      'Soften the finely chopped onion, carrot and garlic in a little oil.',
      'Turn up the heat, add the mince and brown it all over.',
      'Stir in the tomato purée, tinned tomatoes and a splash of water, then simmer for 20 minutes.',
      'Meanwhile cook the spaghetti until al dente, drain, and toss through the sauce.',
    ],
  },
  {
    title: 'Full English Breakfast',
    cookTimeMinutes: 25,
    servings: 2,
    cuisine: 'British',
    ingredients: [
      { name: 'sausages', quantity: '4', unit: null },
      { name: 'bacon', quantity: '4 rashers', unit: null },
      { name: 'egg', quantity: '2', unit: null },
      { name: 'baked beans', quantity: '1 tin', unit: null },
      { name: 'mushrooms', quantity: '100', unit: 'g' },
      { name: 'tomatoes', quantity: '2', unit: null },
      { name: 'toast', quantity: '2 slices', unit: null },
    ],
    steps: [
      'Grill the sausages and bacon, turning until browned and cooked through.',
      'Fry the mushrooms and halved tomatoes in a pan, then push aside and fry the eggs.',
      'Warm the beans in a small pan.',
      'Plate everything up with hot buttered toast.',
    ],
  },
  {
    title: 'Vegan Lentil Dahl',
    cookTimeMinutes: 30,
    servings: 4,
    cuisine: 'Indian',
    ingredients: [
      { name: 'red lentils', quantity: '250', unit: 'g' },
      { name: 'onion', quantity: '1', unit: null },
      { name: 'garlic', quantity: '3 cloves', unit: null },
      { name: 'ginger', quantity: '1 thumb', unit: null },
      { name: 'curry powder', quantity: '2', unit: 'tbsp' },
      { name: 'coconut milk', quantity: '400', unit: 'ml' },
      { name: 'spinach', quantity: '100', unit: 'g' },
    ],
    steps: [
      'Soften the onion, garlic and ginger, then stir in the curry powder.',
      'Add the rinsed lentils, coconut milk and 500ml water, and bring to a simmer.',
      'Cook for 20-25 minutes, stirring often, until the lentils collapse into a thick dahl.',
      'Stir through the spinach until wilted and season to taste.',
    ],
  },
  {
    title: 'Halloumi & Vegetable Traybake',
    cookTimeMinutes: 30,
    servings: 3,
    cuisine: 'Mediterranean',
    ingredients: [
      { name: 'halloumi', quantity: '250', unit: 'g' },
      { name: 'pepper', quantity: '2', unit: null },
      { name: 'red onion', quantity: '1', unit: null },
      { name: 'courgette', quantity: '1', unit: null },
      { name: 'cherry tomatoes', quantity: '200', unit: 'g' },
      { name: 'olive oil', quantity: '2', unit: 'tbsp' },
      { name: 'dried oregano', quantity: '1', unit: 'tsp' },
    ],
    steps: [
      'Chop the vegetables into chunks and spread over a baking tray with the oil and oregano.',
      'Roast at 200°C for 20 minutes.',
      'Add thick slices of halloumi and roast for a further 8-10 minutes until golden.',
    ],
  },
  {
    title: 'Tuna Pasta Bake',
    cookTimeMinutes: 30,
    servings: 4,
    cuisine: 'British',
    ingredients: [
      { name: 'pasta', quantity: '350', unit: 'g' },
      { name: 'tinned tuna', quantity: '2 tins', unit: null },
      { name: 'sweetcorn', quantity: '1 tin', unit: null },
      { name: 'crème fraîche', quantity: '300', unit: 'g' },
      { name: 'cheddar cheese', quantity: '100', unit: 'g' },
      { name: 'onion', quantity: '1', unit: null },
    ],
    steps: [
      'Cook the pasta until just short of al dente, then drain.',
      'Mix the pasta with the drained tuna, sweetcorn, softened onion and crème fraîche.',
      'Tip into an oven dish, scatter over the cheese, and bake at 200°C for 15-20 minutes until bubbling.',
    ],
  },
  {
    title: 'Sausage & Mash',
    cookTimeMinutes: 35,
    servings: 3,
    cuisine: 'British',
    ingredients: [
      { name: 'sausages', quantity: '6', unit: null },
      { name: 'potatoes', quantity: '900', unit: 'g' },
      { name: 'butter', quantity: '40', unit: 'g' },
      { name: 'milk', quantity: '100', unit: 'ml' },
      { name: 'onion', quantity: '2', unit: null },
      { name: 'beef stock', quantity: '400', unit: 'ml' },
    ],
    steps: [
      'Roast or fry the sausages until browned and cooked through.',
      'Boil the peeled, chopped potatoes until tender, then mash with the butter and milk.',
      'Slowly fry the sliced onions until soft and golden, add the stock and simmer into a gravy.',
      'Serve the sausages over the mash with the onion gravy.',
    ],
  },
  {
    title: 'Thai Green Chicken Curry',
    cookTimeMinutes: 30,
    servings: 4,
    cuisine: 'Thai',
    ingredients: [
      { name: 'chicken thighs', quantity: '600', unit: 'g' },
      { name: 'green curry paste', quantity: '3', unit: 'tbsp' },
      { name: 'coconut milk', quantity: '400', unit: 'ml' },
      { name: 'green beans', quantity: '150', unit: 'g' },
      { name: 'jasmine rice', quantity: '300', unit: 'g' },
      { name: 'lime', quantity: '1', unit: null },
    ],
    steps: [
      'Fry the curry paste in a little oil for a minute until fragrant.',
      'Add the sliced chicken and stir until sealed all over.',
      'Pour in the coconut milk, bring to a simmer, and cook for 12-15 minutes with the green beans.',
      'Finish with a squeeze of lime and serve with the cooked jasmine rice.',
    ],
  },
  {
    title: 'Shakshuka',
    cookTimeMinutes: 25,
    servings: 2,
    cuisine: 'Middle Eastern',
    ingredients: [
      { name: 'egg', quantity: '4', unit: null },
      { name: 'tinned tomatoes', quantity: '400', unit: 'g' },
      { name: 'pepper', quantity: '1', unit: null },
      { name: 'onion', quantity: '1', unit: null },
      { name: 'garlic', quantity: '2 cloves', unit: null },
      { name: 'ground cumin', quantity: '1', unit: 'tsp' },
      { name: 'paprika', quantity: '1', unit: 'tsp' },
    ],
    steps: [
      'Soften the sliced onion and pepper, then add the garlic, cumin and paprika.',
      'Pour in the tomatoes and simmer for 8-10 minutes until thickened.',
      'Make wells in the sauce, crack in the eggs, cover, and cook until the whites are just set.',
      'Serve straight from the pan with bread to mop up.',
    ],
  },
  {
    title: 'Beef Burgers & Chips',
    cookTimeMinutes: 30,
    servings: 4,
    cuisine: 'American',
    ingredients: [
      { name: 'beef mince', quantity: '500', unit: 'g' },
      { name: 'burger buns', quantity: '4', unit: null },
      { name: 'potatoes', quantity: '800', unit: 'g' },
      { name: 'cheese slices', quantity: '4', unit: null },
      { name: 'lettuce', quantity: 'a few leaves', unit: null },
      { name: 'tomato', quantity: '1', unit: null },
    ],
    steps: [
      'Cut the potatoes into chips, toss with oil and salt, and bake at 220°C for 25-30 minutes.',
      'Shape the mince into 4 patties and season well.',
      'Fry or grill the patties for 3-4 minutes a side, adding a cheese slice near the end.',
      'Build the burgers in the buns with lettuce and sliced tomato, and serve with the chips.',
    ],
  },
  {
    title: 'Peanut Butter Noodles',
    cookTimeMinutes: 15,
    servings: 2,
    cuisine: 'Asian',
    ingredients: [
      { name: 'noodles', quantity: '150', unit: 'g' },
      { name: 'peanut butter', quantity: '3', unit: 'tbsp' },
      { name: 'soy sauce', quantity: '2', unit: 'tbsp' },
      { name: 'lime', quantity: '1', unit: null },
      { name: 'garlic', quantity: '1 clove', unit: null },
      { name: 'spring onion', quantity: '2', unit: null },
    ],
    steps: [
      'Cook the noodles, then drain, keeping a mugful of the cooking water.',
      'Whisk the peanut butter, soy sauce, lime juice and crushed garlic with enough noodle water to make a pourable sauce.',
      'Toss the noodles through the sauce and top with sliced spring onion.',
    ],
  },
  {
    title: 'Jollof Rice with Chicken',
    cookTimeMinutes: 45,
    servings: 4,
    cuisine: 'West African',
    ingredients: [
      { name: 'long-grain rice', quantity: '400', unit: 'g' },
      { name: 'chicken drumsticks', quantity: '6', unit: null },
      { name: 'tinned tomatoes', quantity: '400', unit: 'g' },
      { name: 'red pepper', quantity: '1', unit: null },
      { name: 'onion', quantity: '2', unit: null },
      { name: 'tomato purée', quantity: '2', unit: 'tbsp' },
      { name: 'scotch bonnet', quantity: '0.5', unit: null },
    ],
    steps: [
      'Season and brown the chicken in a large pot, then set aside.',
      'Blend the tomatoes, pepper, one onion and the scotch bonnet, then fry this base with the purée and sliced remaining onion for 10 minutes.',
      'Stir in the rinsed rice, add stock to just cover, and return the chicken.',
      'Cover tightly and cook on a low heat for about 25 minutes until the rice is tender.',
    ],
  },
  {
    title: 'Butternut Squash Soup',
    cookTimeMinutes: 35,
    servings: 4,
    cuisine: 'British',
    ingredients: [
      { name: 'butternut squash', quantity: '1', unit: null },
      { name: 'onion', quantity: '1', unit: null },
      { name: 'garlic', quantity: '2 cloves', unit: null },
      { name: 'vegetable stock', quantity: '800', unit: 'ml' },
      { name: 'olive oil', quantity: '2', unit: 'tbsp' },
    ],
    steps: [
      'Peel and cube the squash, then soften with the onion and garlic in the oil for 10 minutes.',
      'Pour over the stock and simmer for 20 minutes until the squash is very tender.',
      'Blend until smooth and season to taste.',
    ],
  },
  {
    title: 'Chicken Fajitas',
    cookTimeMinutes: 25,
    servings: 4,
    cuisine: 'Mexican',
    ingredients: [
      { name: 'chicken breast', quantity: '4', unit: null },
      { name: 'pepper', quantity: '2', unit: null },
      { name: 'onion', quantity: '1', unit: null },
      { name: 'fajita seasoning', quantity: '1 packet', unit: null },
      { name: 'tortillas', quantity: '8', unit: null },
      { name: 'soured cream', quantity: '150', unit: 'g' },
    ],
    steps: [
      'Slice the chicken, peppers and onion into strips.',
      'Fry the chicken in a hot pan until nearly cooked, then add the vegetables and seasoning.',
      'Cook for 5 minutes more until the chicken is done and the vegetables are charred at the edges.',
      'Serve in warm tortillas with soured cream.',
    ],
  },
];

// Simple keyword-in-title-or-ingredient matching, same idea as EatNowService's
// matcher but far smaller in scope — this is a curated pool, not a search
// engine. `hint` is free text describing what the caller asked for (their
// ingredients / description); without it every request would return the same
// first few recipes.
export function scoreCuratedByHint(
  hint: string,
  pool: RawRecipeCandidate[] = CURATED_RECIPES,
): { recipe: RawRecipeCandidate; score: number }[] {
  const words = hint
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter((w) => w.length >= 3);

  const scored = pool.map((recipe) => {
    const haystack = `${recipe.title} ${(recipe.ingredients as { name: string }[])
      .map((i) => i.name)
      .join(' ')}`.toLowerCase();
    const score = words.reduce((s, w) => (haystack.includes(w) ? s + 1 : s), 0);
    return { recipe, score };
  });

  return scored.filter((s) => s.score > 0).sort((a, b) => b.score - a.score);
}

const minutesOf = (r: RawRecipeCandidate): number => {
  const n = Number(r.cookTimeMinutes);
  return Number.isFinite(n) ? n : Number.POSITIVE_INFINITY;
};

/**
 * Guest Cook Today / guest Decide "cook it" lane. Deterministic, no AI.
 *
 * Hint matches lead; if the hint matches nothing (or is blank) the whole pool
 * is used in order so the lane is never a dead end for a guest. A
 * `maxMinutes` constraint is applied *best-effort* — it's dropped rather than
 * returning nothing, because a slightly-too-long curated recipe still beats an
 * empty result the guest can't act on. Deduped by title, capped at `count`,
 * never larger than the pool.
 */
export function pickCuratedRecipes(
  hint: string,
  count: number,
  opts: { maxMinutes?: number } = {},
): RawRecipeCandidate[] {
  const matched = hint.trim() ? scoreCuratedByHint(hint).map((s) => s.recipe) : [];
  // Hint matches first, then the rest of the pool as top-up.
  const ordered = [...matched, ...CURATED_RECIPES];

  const withinTime = opts.maxMinutes
    ? ordered.filter((r) => minutesOf(r) <= opts.maxMinutes!)
    : ordered;
  // If the time filter emptied the list, ignore it — see the doc comment.
  const source = withinTime.length > 0 ? withinTime : ordered;

  const result: RawRecipeCandidate[] = [];
  const seen = new Set<unknown>();
  for (const recipe of source) {
    if (result.length >= count) break;
    if (seen.has(recipe.title)) continue;
    seen.add(recipe.title);
    result.push(recipe);
  }
  return result;
}

/**
 * Guest Plan Ahead preview, and ClaudeService's own no-API-key plan fallback.
 * Always returns exactly `days` recipes: a preview or demo plan failing to
 * fill just because a free-text steer doesn't keyword-match the pool is a
 * dead end for the feature. Hint matches lead, deduped by title, then the
 * pool wraps to fill any remaining days.
 */
export function curatedPlanForDays(days: number, hint?: string): RawRecipeCandidate[] {
  const matched = hint?.trim() ? scoreCuratedByHint(hint).map((s) => s.recipe) : [];
  const ordered = [...matched, ...CURATED_RECIPES];

  const result: RawRecipeCandidate[] = [];
  const seenTitles = new Set<unknown>();
  for (const recipe of ordered) {
    if (result.length >= days) break;
    if (seenTitles.has(recipe.title)) continue;
    seenTitles.add(recipe.title);
    result.push(recipe);
  }
  for (let i = 0; result.length < days; i++) {
    result.push(CURATED_RECIPES[i % CURATED_RECIPES.length]);
  }
  return result;
}
