import { IsIn, IsString, MaxLength, MinLength } from 'class-validator';

const ALLOWED_MEDIA_TYPES = ['image/jpeg', 'image/png', 'image/webp'] as const;

// Same shape/limits as ScanFoodContentDto — a real photo is always required,
// there's no "demo scenario" shortcut for a live cooking-step check.
export class CheckCookingStepDto {
  @IsString()
  @MinLength(1)
  @MaxLength(7_000_000) // ~5MB image, base64-inflated — matches Anthropic's per-image limit
  imageBase64!: string;

  @IsIn(ALLOWED_MEDIA_TYPES)
  mediaType!: (typeof ALLOWED_MEDIA_TYPES)[number];

  @IsString()
  @MinLength(1)
  @MaxLength(200)
  recipeTitle!: string;

  @IsString()
  @MinLength(1)
  @MaxLength(1000)
  stepText!: string;
}
