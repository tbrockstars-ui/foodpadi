// One candidate photo from an image provider, normalised to a provider-
// agnostic shape so FoodImageService's relevance scoring and the cache row
// never need to know which API it came from.
export interface ProviderPhoto {
  /** Provider's own id, for logging/debugging only. */
  id: string;
  /** Display URL (provider CDN, hotlinked — never re-hosted). */
  imageUrl: string;
  /** Smaller variant; callers fall back to imageUrl when equal/empty. */
  thumbnailUrl: string;
  /** Alt text / description the provider supplied, lowercased — '' if none. Used for relevance scoring. */
  description: string;
  photographer: string;
  photographerUrl: string | null;
  /** The photo's page on the provider — the required visible attribution link. */
  sourceUrl: string;
  width: number;
  height: number;
  /**
   * Unsplash only: endpoint to GET when the photo is actually shown, per
   * their API guidelines. null for providers with no such requirement.
   */
  downloadLocation: string | null;
}

export interface FoodImageProvider {
  readonly name: 'pexels' | 'unsplash';
  /** True only when the provider has the credentials it needs to run. */
  isEnabled(): boolean;
  /**
   * Return up to `limit` candidate photos for a already-normalised query
   * string, or [] on any failure/timeout — never throws. The service picks
   * the best candidate; a provider must not pre-filter to one result.
   */
  search(query: string, limit: number, timeoutMs: number): Promise<ProviderPhoto[]>;
}
