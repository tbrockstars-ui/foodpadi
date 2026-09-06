import { PLAN_CUISINE_IMAGES, type ImageAsset } from './imageAssets';

// Static sample content for Home's "Ideas for you" section — used only as a
// fallback when GET /home/ideas itself fails, so the section still renders
// something rather than breaking Home (see HomeHub.tsx's loadIdeaCards).
// "Recently cooked" used to have an equivalent placeholder here too, but that
// section is now real cook history (GET /home/recently-cooked) with no
// fabricated fallback — see loadRecentlyCooked's comment in HomeHub.tsx for
// why.

export interface HomeIdeaPlaceholder {
  title: string;
  timeMinutes: number;
  difficulty: 'Easy' | 'Medium' | 'Hard';
  priceBand: '£' | '££' | '£££';
  matchPercent: number;
  badge?: string;
  image: ImageAsset;
}

export const HOME_IDEAS: HomeIdeaPlaceholder[] = [
  {
    title: 'Mediterranean Chickpea Bowl',
    timeMinutes: 20,
    difficulty: 'Easy',
    priceBand: '£',
    matchPercent: 90,
    badge: 'Best match',
    image: PLAN_CUISINE_IMAGES.mediterranean,
  },
  {
    title: 'Spaghetti Carbonara',
    timeMinutes: 25,
    difficulty: 'Easy',
    priceBand: '££',
    matchPercent: 70,
    image: PLAN_CUISINE_IMAGES.italian,
  },
  {
    title: 'Indian Curry Bowl',
    timeMinutes: 35,
    difficulty: 'Medium',
    priceBand: '££',
    matchPercent: 65,
    image: PLAN_CUISINE_IMAGES.indian,
  },
];

