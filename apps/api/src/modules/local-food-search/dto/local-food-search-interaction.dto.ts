import { IsIn, IsObject, IsOptional } from 'class-validator';
import type { LocalFoodSearchInteractionType } from '@foodpadi/shared';

// Client-only actions the server can never observe on its own (a permission
// prompt's outcome, tapping a maps/order link) — "Find Near Me" brief §16.
// search_initiated/search_completed/results_found/no_results are already
// covered by the existing local_food_search_performed event (resultCount
// tells the found/no-results story) and are deliberately not duplicated here.
export const LOCAL_FOOD_SEARCH_INTERACTION_TYPES: LocalFoodSearchInteractionType[] = [
  'find_near_me_clicked',
  'location_permission_granted',
  'location_permission_denied',
  'manual_location_used',
  'place_viewed',
  'directions_clicked',
  'external_ordering_clicked',
];

export class LocalFoodSearchInteractionDto {
  @IsIn(LOCAL_FOOD_SEARCH_INTERACTION_TYPES)
  interactionType!: LocalFoodSearchInteractionType;

  @IsOptional()
  @IsObject()
  metadata?: Record<string, unknown>;
}
