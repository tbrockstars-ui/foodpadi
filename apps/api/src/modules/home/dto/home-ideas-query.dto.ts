import { Type } from 'class-transformer';
import { IsInt, IsOptional, IsString, Max, MaxLength, Min } from 'class-validator';

// Live "what should I eat?" signals — mood/time/budget — layered on top of
// the member's standing pantry/preferences/goals context (home.service.ts).
// All optional and all best-effort: see home-ideas.ts's IdeaContext for the
// "never return nothing" contract shared with the rest of Cook Today/Plan
// Ahead's curated fallbacks.
export class HomeIdeasQueryDto {
  @IsOptional()
  @IsString()
  @MaxLength(200)
  mood?: string;

  // Query params arrive as strings; `transform: true` on the global
  // ValidationPipe + @Type coerces to a number before the Int/Min/Max checks
  // (same pattern as PlanPreviewQueryDto).
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(600)
  maxTime?: number;

  /** Whole pounds, e.g. `maxBudget=10` for "£10 or less" — converted to pence in the service. */
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(1000)
  maxBudget?: number;
}
