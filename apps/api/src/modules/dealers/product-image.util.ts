import { BadRequestException } from '@nestjs/common';
import sharp from 'sharp';
import { assertPublicHttpUrl } from '../../common/ssrf-guard.util';

// Server-side floor under the client's own pre-compression (ProductsManager.tsx
// downsizes to 900px/quality 0.72 before upload) — this is what actually
// guarantees a small stored image regardless of what supplied it (a future
// mobile client, a pasted external link, a direct API caller, or a
// client-side compression bug).
const MAX_DIMENSION = 640;
const JPEG_QUALITY = 70;

const DATA_URL_RE = /^data:image\/[a-z0-9.+-]+;base64,([a-z0-9+/=]+)$/i;
const FETCH_TIMEOUT_MS = 8000;
const MAX_REMOTE_IMAGE_BYTES = 8 * 1024 * 1024;
const UNREACHABLE_MESSAGE = "Couldn't load that image link. Check the URL and try again, or upload a photo instead.";
const NOT_AN_IMAGE_MESSAGE =
  "That link doesn't point directly at an image. Paste a direct image link, or upload a photo instead.";
const TOO_LARGE_MESSAGE = 'That image is too large. Please use a smaller one, or upload a photo instead.';

async function resizeImageBuffer(raw: Buffer): Promise<{ data: Buffer; mimeType: string }> {
  const data = await sharp(raw)
    .rotate() // apply EXIF orientation before it's stripped by re-encoding
    .resize(MAX_DIMENSION, MAX_DIMENSION, { fit: 'inside', withoutEnlargement: true })
    .jpeg({ quality: JPEG_QUALITY, mozjpeg: true })
    .toBuffer();
  return { data, mimeType: 'image/jpeg' };
}

/** Decodes a `data:image/...;base64,...` upload, resizes it to fit within
 * MAX_DIMENSION and re-encodes as JPEG. Always returns 'image/jpeg' — the
 * re-encode makes the original format irrelevant. */
export async function resizeUploadedProductImage(dataUrl: string): Promise<{ data: Buffer; mimeType: string }> {
  const match = DATA_URL_RE.exec(dataUrl.trim());
  if (!match) {
    throw new BadRequestException('That image could not be read. Please choose a JPEG, PNG or WebP photo.');
  }
  try {
    return await resizeImageBuffer(Buffer.from(match[1], 'base64'));
  } catch {
    throw new BadRequestException("Couldn't process that photo. Please try a different one.");
  }
}

/**
 * A dealer pasting an external image link gets it fetched and re-encoded
 * server-side through the exact same resize pipeline an upload goes through
 * — the stored product image is always our own small re-encoded JPEG, served
 * from our own origin (GET /dealers/products/:id/image), never a hotlink to
 * a third-party URL that can change, disappear, or (as with a page URL like
 * an Unsplash listing rather than the actual image asset) never have been a
 * renderable image to begin with.
 */
export async function resizeRemoteProductImage(url: string): Promise<{ data: Buffer; mimeType: string }> {
  const parsed = await assertPublicHttpUrl(url, UNREACHABLE_MESSAGE);

  let response: Response;
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
    response = await fetch(parsed.toString(), {
      signal: controller.signal,
      headers: { 'User-Agent': 'Mozilla/5.0 (compatible; FoodPadiBot/1.0)' },
    });
    clearTimeout(timeout);
  } catch {
    throw new BadRequestException(UNREACHABLE_MESSAGE);
  }
  if (!response.ok) {
    throw new BadRequestException(UNREACHABLE_MESSAGE);
  }

  const contentType = response.headers.get('content-type') ?? '';
  if (!contentType.toLowerCase().startsWith('image/')) {
    throw new BadRequestException(NOT_AN_IMAGE_MESSAGE);
  }
  const declaredLength = Number(response.headers.get('content-length') ?? '0');
  if (declaredLength > MAX_REMOTE_IMAGE_BYTES) {
    throw new BadRequestException(TOO_LARGE_MESSAGE);
  }

  const raw = Buffer.from(await response.arrayBuffer());
  if (raw.byteLength > MAX_REMOTE_IMAGE_BYTES) {
    throw new BadRequestException(TOO_LARGE_MESSAGE);
  }

  try {
    return await resizeImageBuffer(raw);
  } catch {
    throw new BadRequestException(NOT_AN_IMAGE_MESSAGE);
  }
}
