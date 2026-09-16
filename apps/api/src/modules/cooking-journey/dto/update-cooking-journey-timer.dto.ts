import { IsIn, IsInt, IsOptional, Max, Min } from 'class-validator';

/**
 * PATCH /cooking-journey/:id/timer — the server owns the timestamp maths so
 * the remaining time is always computed, never a stored counter (brief §19).
 * `durationSeconds` is required for 'start' and 'reset'.
 */
export class UpdateCookingJourneyTimerDto {
  @IsIn(['start', 'pause', 'resume', 'reset', 'complete'])
  action!: 'start' | 'pause' | 'resume' | 'reset' | 'complete';

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(86_400)
  durationSeconds?: number;
}
