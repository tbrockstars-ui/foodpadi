import { Type } from 'class-transformer';
import { IsInt, IsOptional, Max, Min } from 'class-validator';

export class PlanPreviewQueryDto {
  // Query params arrive as strings; `transform: true` on the global
  // ValidationPipe + @Type coerces to a number before the Int/Min/Max checks.
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(7)
  days?: number;
}
