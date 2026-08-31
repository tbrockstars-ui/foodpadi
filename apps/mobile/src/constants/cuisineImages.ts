// Mobile counterpart to apps/web/lib/imageAssets.ts's PLAN_CUISINE_IMAGES —
// same Pexels photos (same license: free for commercial + personal use, no
// attribution required — https://www.pexels.com/license/), kept separate
// since mobile has no shared "lib" with web to import from. One real photo
// per cuisine, not per dish — recipe titles are AI-generated/curated-
// fallback, so there's no specific photo of e.g. "One-Pot Chicken & Rice" to
// source. Update both files together if these ever change.

function pexels(id: number, width: number): string {
  return `https://images.pexels.com/photos/${id}/pexels-photo-${id}.jpeg?auto=compress&cs=tinysrgb&w=${width}`;
}

interface CuisineImage {
  url: string;
  alt: string;
}

const CUISINE_IMAGES: Record<string, CuisineImage> = {
  british: { url: pexels(34991330, 300), alt: 'Roast dinner with meat, potatoes and vegetables' },
  italian: { url: pexels(546945, 300), alt: 'Close-up of spaghetti carbonara topped with parmesan' },
  indian: { url: pexels(33643313, 300), alt: 'Indian curry served in a traditional bowl' },
  mediterranean: { url: pexels(5083910, 300), alt: 'Mediterranean dishes including salads and hummus, shot from above' },
  mexican: { url: pexels(18574186, 300), alt: 'Mexican tacos topped with onion, cilantro and lime' },
  japanese: { url: pexels(19957865, 300), alt: 'Sushi rolls topped with sesame seeds' },
};

const CUISINE_FALLBACK: CuisineImage = {
  url: pexels(37823049, 300),
  alt: 'A home-cooked meal of rice, soup and vegetables',
};

/** Case-insensitive lookup with a generic fallback for any cuisine not curated above. */
export function getCuisineImage(cuisine: string | null): CuisineImage {
  if (!cuisine) return CUISINE_FALLBACK;
  return CUISINE_IMAGES[cuisine.trim().toLowerCase()] ?? CUISINE_FALLBACK;
}
