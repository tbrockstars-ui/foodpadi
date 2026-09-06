// Vegan detection shared by every "does this food get the Vegan flag" call
// site across web + mobile (DecideFlow, Home's "Ideas for you" / "Recently
// cooked", Eat Now, Plan Ahead). Two different shapes of food carry vegan
// information differently:
//
//  - A FoodIdeaView ("Get it" options / Eat Now / Plan Ahead results) has a
//    real `tags` array — `tags.includes('vegan')` is authoritative there.
//  - A RecipeView/Recipe ("Cook it" options, Cook Today, Home's real recipe
//    cards) carries no tags at all (spec §13 Principle 6 — no master
//    ingredient catalog to tag against), so the only signal available is the
//    title itself. Curated/AI-written vegan recipe titles say so plainly
//    (e.g. "Vegan Lentil Dahl") specifically so this heuristic works — it's
//    a best-effort text match, not a nutritional judgement.
//
// This one function covers both: pass `tags` when you have them (a food
// idea), pass `title`/`reason` for whatever text is available otherwise (a
// recipe, or a Decide option that may be either). Never throws off a false
// negative into a false "not vegan" claim — worst case it just doesn't show
// the flag on a vegan dish whose title doesn't say so.
export function isVeganFood(input: { tags?: string[] | null; title?: string | null; reason?: string | null }): boolean {
  if (input.tags?.includes('vegan')) return true;
  const haystack = `${input.title ?? ''} ${input.reason ?? ''}`.toLowerCase();
  return haystack.includes('vegan');
}
