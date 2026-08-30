import { IsIn, IsString, MaxLength, MinLength } from 'class-validator';

const ALLOWED_MEDIA_TYPES = ['image/jpeg', 'image/png', 'image/webp'] as const;

// Unlike ScanPhotoDto, both fields are required here — this mode has no
// "demoScenario" shortcut (there's no equivalent of "sample kitchen" for a
// single dish), so a real photo is always expected.
export class ScanFoodContentDto {
  @IsString()
  @MinLength(1)
  @MaxLength(7_000_000) // ~5MB image, base64-inflated — matches Anthropic's per-image limit
  imageBase64!: string;

  @IsIn(ALLOWED_MEDIA_TYPES)
  mediaType!: (typeof ALLOWED_MEDIA_TYPES)[number];
}
