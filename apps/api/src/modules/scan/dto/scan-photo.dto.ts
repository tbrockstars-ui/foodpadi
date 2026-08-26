import { IsIn, IsOptional, IsString, MaxLength, MinLength } from 'class-validator';
import { DEMO_SCENARIO_KEYS, DemoScenarioKey } from '../demo-scan-analyzer';

const ALLOWED_MEDIA_TYPES = ['image/jpeg', 'image/png', 'image/webp'] as const;

// Either a real photo (imageBase64 + mediaType) or an explicit demo scenario
// is required — enforced in ScanService, not here, since class-validator
// doesn't cross-validate "at least one of" cleanly.
export class ScanPhotoDto {
  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(7_000_000) // ~5MB image, base64-inflated — matches Anthropic's per-image limit
  imageBase64?: string;

  @IsOptional()
  @IsIn(ALLOWED_MEDIA_TYPES)
  mediaType?: (typeof ALLOWED_MEDIA_TYPES)[number];

  @IsOptional()
  @IsIn(DEMO_SCENARIO_KEYS)
  demoScenario?: DemoScenarioKey;
}
