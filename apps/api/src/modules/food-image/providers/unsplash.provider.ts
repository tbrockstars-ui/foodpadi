import { Injectable, Logger } from '@nestjs/common';
import type { FoodImageProvider, ProviderPhoto } from './food-image-provider';

const UNSPLASH_SEARCH_URL = 'https://api.unsplash.com/search/photos';

// Unsplash's attribution guidelines require referral UTM params on every
// link back to unsplash.com / a photographer's profile.
const UTM = 'utm_source=foodpadi&utm_medium=referral';

interface UnsplashPhoto {
  id: string;
  width: number;
  height: number;
  description: string | null;
  alt_description: string | null;
  urls: { regular: string; small: string; thumb: string };
  links: { html: string; download_location: string };
  user: { name: string; links: { html: string } };
}

interface UnsplashSearchResponse {
  results?: UnsplashPhoto[];
}

function withUtm(url: string): string {
  return url.includes('?') ? `${url}&${UTM}` : `${url}?${UTM}`;
}

/**
 * Fallback provider (brief §7/§8) — only runs when Pexels found nothing
 * suitable. Dormant until `UNSPLASH_ACCESS_KEY` is set. Unlike Pexels,
 * Unsplash's API guidelines require: attribution links carrying referral UTM
 * params (handled here), and a GET to `links.download_location` whenever a
 * photo is actually displayed — `downloadLocation` is carried through to the
 * cache row and pinged by FoodImageService. Images are hotlinked from the
 * Unsplash CDN (`urls.regular`); nothing is re-hosted.
 */
@Injectable()
export class UnsplashImageProvider implements FoodImageProvider {
  readonly name = 'unsplash' as const;
  private readonly logger = new Logger(UnsplashImageProvider.name);

  isEnabled(): boolean {
    return !!process.env.UNSPLASH_ACCESS_KEY;
  }

  async search(query: string, limit: number, timeoutMs: number): Promise<ProviderPhoto[]> {
    const accessKey = process.env.UNSPLASH_ACCESS_KEY;
    if (!accessKey) return [];

    const url =
      `${UNSPLASH_SEARCH_URL}?query=${encodeURIComponent(query)}` +
      `&per_page=${limit}&orientation=landscape&content_filter=high`;
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);

    try {
      const res = await fetch(url, {
        headers: { Authorization: `Client-ID ${accessKey}`, 'Accept-Version': 'v1' },
        signal: controller.signal,
      });
      if (!res.ok) {
        this.logger.warn(`Unsplash search for "${query}" returned ${res.status}`);
        return [];
      }
      const body = (await res.json()) as UnsplashSearchResponse;
      return (body.results ?? []).map((p) => ({
        id: p.id,
        // `small` (~400px), not `regular` (~1080px) — the card image is a
        // compact thumbnail (brief §12/§13).
        imageUrl: p.urls.small || p.urls.regular,
        thumbnailUrl: p.urls.thumb || p.urls.small,
        description: (p.alt_description ?? p.description ?? '').toLowerCase(),
        photographer: p.user.name,
        photographerUrl: p.user.links?.html ? withUtm(p.user.links.html) : null,
        sourceUrl: withUtm(p.links.html),
        width: p.width ?? 0,
        height: p.height ?? 0,
        downloadLocation: p.links.download_location ?? null,
      }));
    } catch (err) {
      if ((err as Error).name === 'AbortError') {
        this.logger.warn(`Unsplash search for "${query}" timed out after ${timeoutMs}ms`);
      } else {
        this.logger.warn(`Unsplash search for "${query}" failed: ${(err as Error).message}`);
      }
      return [];
    } finally {
      clearTimeout(timer);
    }
  }
}
