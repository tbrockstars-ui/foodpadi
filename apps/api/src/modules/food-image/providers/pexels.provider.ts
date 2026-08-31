import { Injectable, Logger } from '@nestjs/common';
import type { FoodImageProvider, ProviderPhoto } from './food-image-provider';

const PEXELS_SEARCH_URL = 'https://api.pexels.com/v1/search';

interface PexelsPhoto {
  id: number;
  width: number;
  height: number;
  url: string;
  photographer: string;
  photographer_url: string;
  alt: string | null;
  src: {
    large: string;
    large2x: string;
    medium: string;
    small: string;
    tiny: string;
  };
}

interface PexelsSearchResponse {
  photos?: PexelsPhoto[];
}

/**
 * Preferred MVP provider (brief §6). Auth is a single API key in the
 * `Authorization` header — server-side only, never shipped to a client.
 * Pexels License allows free commercial use; their ToS still wants a visible
 * link to Pexels plus photographer credit, which the UI renders from the
 * `sourceUrl` / `photographer` fields below. Photos are hotlinked from the
 * Pexels CDN (`src.*`) as their terms expect — nothing is re-hosted.
 */
@Injectable()
export class PexelsImageProvider implements FoodImageProvider {
  readonly name = 'pexels' as const;
  private readonly logger = new Logger(PexelsImageProvider.name);

  isEnabled(): boolean {
    return !!process.env.PEXELS_API_KEY;
  }

  async search(query: string, limit: number, timeoutMs: number): Promise<ProviderPhoto[]> {
    const apiKey = process.env.PEXELS_API_KEY;
    if (!apiKey) return [];

    const url = `${PEXELS_SEARCH_URL}?query=${encodeURIComponent(query)}&per_page=${limit}&orientation=landscape`;
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);

    try {
      const res = await fetch(url, {
        headers: { Authorization: apiKey },
        signal: controller.signal,
      });
      if (!res.ok) {
        this.logger.warn(`Pexels search for "${query}" returned ${res.status}`);
        return [];
      }
      const body = (await res.json()) as PexelsSearchResponse;
      return (body.photos ?? []).map((p) => ({
        id: String(p.id),
        // Deliberately the small/medium CDN renditions, not `large`/`original`
        // — the card image is a compact thumbnail (brief §12/§13: don't ship
        // full-resolution originals).
        imageUrl: p.src.medium || p.src.small || p.src.large,
        thumbnailUrl: p.src.small || p.src.tiny || p.src.medium,
        description: (p.alt ?? '').toLowerCase(),
        photographer: p.photographer,
        photographerUrl: p.photographer_url || null,
        sourceUrl: p.url,
        width: p.width ?? 0,
        height: p.height ?? 0,
        downloadLocation: null,
      }));
    } catch (err) {
      if ((err as Error).name === 'AbortError') {
        this.logger.warn(`Pexels search for "${query}" timed out after ${timeoutMs}ms`);
      } else {
        this.logger.warn(`Pexels search for "${query}" failed: ${(err as Error).message}`);
      }
      return [];
    } finally {
      clearTimeout(timer);
    }
  }
}
