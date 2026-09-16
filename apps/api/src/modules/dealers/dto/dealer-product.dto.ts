import {
  IsBoolean,
  IsInt,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
  MinLength,
} from 'class-validator';

export class DealerProductDto {
  @IsString() @MinLength(2) @MaxLength(120) name!: string;

  @IsOptional() @IsString() @MaxLength(80) category?: string | null;
  @IsOptional() @IsString() @MaxLength(600) description?: string | null;

  // A pasted external https:// link — fetched and re-optimised server-side
  // through the same resize pipeline an upload goes through (see
  // product-image.util.ts's resizeRemoteProductImage) and stored as our own
  // imageData/imageMimeType, never kept as a raw external link. Omit the key
  // entirely to leave whatever image is already stored untouched (e.g. an
  // unrelated field edit); send '' or null to remove it.
  @IsOptional() @IsString() @MaxLength(2000) imageUrl?: string | null;
  // An uploaded photo as a JPEG/PNG/WebP data URL (client pre-compresses it —
  // see ProductsManager.tsx — the API re-resizes/re-encodes it again server-
  // side as the authoritative small-and-safe copy; same base64-in-JSON
  // convention as Scan's photo uploads). Omit the key to leave a previously
  // uploaded image untouched; send null to remove it.
  @IsOptional() @IsString() @MaxLength(1_500_000) imageDataUrl?: string | null;

  @IsOptional() @IsBoolean() available?: boolean;

  // Optional — a dealer can list a product without publishing a price (brief §18).
  @IsOptional() @IsInt() @Min(0) @Max(10_000_00) pricePence?: number | null;
  @IsOptional() @IsString() @MaxLength(40) unit?: string | null;
}
