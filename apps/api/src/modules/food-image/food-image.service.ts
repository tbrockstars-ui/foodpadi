import { Injectable, Logger } from '@nestjs/common';
import type { FoodImageView } from '@foodpadi/shared';
import { PrismaService } from '../../prisma/prisma.service';
import { buildFoodImageQuery, normaliseFoodKey } from './food-image-query';
import { pickBestPhoto } from './food-image-relevance';
import type { FoodImageProvider, ProviderPhoto } from './providers/food-image-provider';
import { PexelsImageProvider } from './providers/pexels.provider';
import { UnsplashImageProvider } from './providers/unsplash.provider';

// How many candidates to pull per provider before the relevance re-rank.
// Enough to have a real choice, few enough to stay well inside provider rate
// limits (brief §27 — don't request 50 to show 3).
const SEARCH_LIMIT = 8;

// Per-provider network budget. A recommendation must never wait long on an
// image; if it blows this, the card just renders with a placeholder.
const PROVIDER_TIMEOUT_MS = 4000;

// A "nothing found" result is cached too, so a genuinely image-less dish
// doesn't re-hit the providers on every page load — but only briefly, so a
// later catalog/provider change can still surface an image.
const NEGATIVE_TTL_MS = 7 * 24 * 60 * 60 * 1000; // 7 days

// Max concurrent provider lookups when enriching a batch of recommendations.
const BATCH_CONCURRENCY = 4;

// Process-level cache in front of the DB, so the same dish resolves to the
// exact same photo on every subsequent request without even a DB round-trip
// — and, crucially, keeps working when the food_image_cache table isn't there
// yet (the DB layer is fail-soft and would otherwise re-hit the provider
// every time). A found image is pinned for a day; a miss is retried sooner.
const MEMORY_TTL_OK_MS = 24 * 60 * 60 * 1000;
const MEMORY_TTL_NONE_MS = 60 * 60 * 1000;
const MEMORY_MAX_ENTRIES = 1000;

interface ResolveOptions {
  /** Cuisine of the dish, if known — sharpens the image query (brief §29). */
  cuisine?: string;
}

type CacheRow = {
  status: string;
  provider: string | null;
  imageUrl: string | null;
  thumbnailUrl: string | null;
  photographerName: string | null;
  photographerUrl: string | null;
  sourceUrl: string | null;
  isRepresentative: boolean;
  retrievedAt: Date;
};

/**
 * Resolves a representative photo for a recommended dish, so the customer can
 * SEE what they're choosing (visual-redesign brief). Provider-agnostic: tries
 * Pexels first, then Unsplash, behind a small relevance filter.
 *
 * Two-tier cache, keyed by the normalised dish name, so the same request
 * always yields the same photo and a provider is hit at most once per dish:
 *  1. a process-level in-memory map (+ in-flight de-dupe) — survives a
 *     missing `food_image_cache` table and needs no DB round-trip on a hit;
 *  2. the `food_image_cache` table — shared across instances, survives
 *     restarts. Both cache misses too (`status = "none"`), briefly.
 *
 * Every public method is best-effort and returns null rather than throwing:
 * an image lookup must never break or delay a recommendation.
 */
@Injectable()
export class FoodImageService {
  private readonly logger = new Logger(FoodImageService.name);
  private readonly providers: FoodImageProvider[];

  // Resolved photo per normalised dish name (see MEMORY_TTL_* above).
  private readonly memory = new Map<string, { view: FoodImageView | null; at: number }>();
  // One in-flight resolve per key — concurrent callers (e.g. Decide and Eat
  // Now asking for the same dish at once) share the single lookup rather than
  // each firing their own, so everyone sees the same image.
  private readonly inflight = new Map<string, Promise<FoodImageView | null>>();

  constructor(
    private readonly prisma: PrismaService,
    pexels: PexelsImageProvider,
    unsplash: UnsplashImageProvider,
  ) {
    // Order matters: Pexels is the preferred MVP provider, Unsplash the fallback.
    this.providers = [pexels, unsplash];
  }

  /** True when at least one provider has credentials — lets callers skip work entirely. */
  isConfigured(): boolean {
    return this.providers.some((p) => p.isEnabled());
  }

  async resolve(foodName: string, opts: ResolveOptions = {}): Promise<FoodImageView | null> {
    const key = normaliseFoodKey(foodName);
    if (!key) return null;

    const mem = this.memoryGet(key);
    if (mem !== undefined) return mem;

    const pending = this.inflight.get(key);
    if (pending) return pending;

    const work = this.resolveUncached(key, foodName, opts)
      .then((view) => {
        this.memorySet(key, view);
        return view;
      })
      .catch((err) => {
        this.logger.warn(`Image resolve for "${foodName}" failed: ${(err as Error).message}`);
        return null;
      })
      .finally(() => {
        this.inflight.delete(key);
      });

    this.inflight.set(key, work);
    return work;
  }

  private async resolveUncached(
    key: string,
    foodName: string,
    opts: ResolveOptions,
  ): Promise<FoodImageView | null> {
    // Cache read is fail-soft: if the food_image_cache table doesn't exist yet
    // (migration not deployed) or the DB is unreachable, we fall through to a
    // live provider lookup rather than returning no image. So photos start
    // showing the moment PEXELS_API_KEY is set, even before the migration runs
    // — the migration just makes it fast (one provider call per dish, ever).
    const cached = await this.readCache(key);
    if (cached && !this.isStale(cached)) {
      return cached.status === 'ok' ? this.toView(cached) : null;
    }

    if (!this.isConfigured()) {
      return cached && cached.status === 'ok' ? this.toView(cached) : null;
    }

    const query = buildFoodImageQuery(foodName, opts.cuisine);

    let found: { provider: FoodImageProvider; photo: ProviderPhoto } | null;
    try {
      found = await this.searchProviders(query, foodName);
    } catch (err) {
      this.logger.warn(`Image provider lookup for "${foodName}" failed: ${(err as Error).message}`);
      return null;
    }

    if (found) {
      if (found.provider.name === 'unsplash' && found.photo.downloadLocation) {
        this.pingUnsplashDownload(found.photo.downloadLocation);
      }
      const view = this.toView({
        status: 'ok',
        provider: found.provider.name,
        imageUrl: found.photo.imageUrl,
        thumbnailUrl: found.photo.thumbnailUrl,
        photographerName: found.photo.photographer,
        photographerUrl: found.photo.photographerUrl,
        sourceUrl: found.photo.sourceUrl,
        isRepresentative: true,
        retrievedAt: new Date(),
      });
      await this.writeCache(key, foodName, query, {
        status: 'ok',
        provider: found.provider.name,
        imageUrl: found.photo.imageUrl,
        thumbnailUrl: found.photo.thumbnailUrl,
        photographerName: found.photo.photographer,
        photographerUrl: found.photo.photographerUrl,
        sourceUrl: found.photo.sourceUrl,
        downloadLocation: found.photo.downloadLocation,
      });
      return view;
    }

    await this.writeCache(key, foodName, query, { status: 'none' });
    return null;
  }

  // Returns the cached view (which may itself be null = "no image"), or
  // `undefined` when there's no live entry. Stale entries are evicted here.
  private memoryGet(key: string): FoodImageView | null | undefined {
    const entry = this.memory.get(key);
    if (!entry) return undefined;
    const ttl = entry.view ? MEMORY_TTL_OK_MS : MEMORY_TTL_NONE_MS;
    if (Date.now() - entry.at > ttl) {
      this.memory.delete(key);
      return undefined;
    }
    return entry.view;
  }

  private memorySet(key: string, view: FoodImageView | null): void {
    // Cheap FIFO bound — Map preserves insertion order, so the first key is
    // the oldest. Re-set an existing key at the end so hot dishes survive.
    this.memory.delete(key);
    if (this.memory.size >= MEMORY_MAX_ENTRIES) {
      const oldest = this.memory.keys().next().value;
      if (oldest !== undefined) this.memory.delete(oldest);
    }
    this.memory.set(key, { view, at: Date.now() });
  }

  private async readCache(key: string): Promise<CacheRow | null> {
    try {
      return (await this.prisma.foodImageCache.findUnique({ where: { key } })) as CacheRow | null;
    } catch (err) {
      this.logger.warn(`food_image_cache read failed (continuing without cache): ${(err as Error).message}`);
      return null;
    }
  }

  private async writeCache(
    key: string,
    foodName: string,
    searchQuery: string,
    data: Partial<{
      status: string;
      provider: string;
      imageUrl: string;
      thumbnailUrl: string;
      photographerName: string;
      photographerUrl: string | null;
      sourceUrl: string;
      downloadLocation: string | null;
    }>,
  ): Promise<void> {
    const row = { status: 'none', isRepresentative: true, ...data };
    try {
      await this.prisma.foodImageCache.upsert({
        where: { key },
        create: { key, foodName, searchQuery, ...row },
        update: { searchQuery, retrievedAt: new Date(), ...row },
      });
    } catch (err) {
      this.logger.warn(`food_image_cache write failed (image still returned): ${(err as Error).message}`);
    }
  }

  /**
   * Enrich a batch of recommendations at once — dedupes by dish name and caps
   * concurrency so a page of Eat Now results doesn't fan out into a dozen
   * simultaneous provider calls. Returns a map keyed by the *original*
   * `name` string each caller passed in.
   */
  async resolveMany(
    items: { name: string; cuisine?: string }[],
  ): Promise<Map<string, FoodImageView | null>> {
    const result = new Map<string, FoodImageView | null>();
    const unique = new Map<string, { name: string; cuisine?: string }>();
    for (const item of items) {
      if (!unique.has(item.name)) unique.set(item.name, item);
    }

    const queue = [...unique.values()];
    const workers = Array.from({ length: Math.min(BATCH_CONCURRENCY, queue.length) }, async () => {
      for (;;) {
        const next = queue.shift();
        if (!next) return;
        result.set(next.name, await this.resolve(next.name, { cuisine: next.cuisine }));
      }
    });
    await Promise.all(workers);

    // Fill any names that only appeared as duplicates.
    for (const item of items) {
      if (!result.has(item.name)) result.set(item.name, null);
    }
    return result;
  }

  private isStale(row: CacheRow): boolean {
    if (row.status === 'ok') return false; // positive results are kept indefinitely
    return Date.now() - row.retrievedAt.getTime() > NEGATIVE_TTL_MS;
  }

  private async searchProviders(query: string, foodName: string) {
    for (const provider of this.providers) {
      if (!provider.isEnabled()) continue;
      const photos = await provider.search(query, SEARCH_LIMIT, PROVIDER_TIMEOUT_MS);
      const photo = pickBestPhoto(photos, foodName);
      if (photo) return { provider, photo };
    }
    return null;
  }

  // Unsplash guideline: register a "download" when a photo is displayed. Fire
  // and forget — a failed ping must not affect the response.
  private pingUnsplashDownload(downloadLocation: string): void {
    const accessKey = process.env.UNSPLASH_ACCESS_KEY;
    if (!accessKey) return;
    void fetch(downloadLocation, { headers: { Authorization: `Client-ID ${accessKey}` } }).catch(() => {
      /* best-effort */
    });
  }

  private toView(row: CacheRow): FoodImageView {
    return {
      url: row.imageUrl as string,
      thumbnailUrl: row.thumbnailUrl || (row.imageUrl as string),
      provider: (row.provider as 'pexels' | 'unsplash') ?? 'pexels',
      photographer: row.photographerName ?? 'Unknown',
      photographerUrl: row.photographerUrl,
      sourceUrl: row.sourceUrl as string,
      isRepresentative: row.isRepresentative,
    };
  }
}
