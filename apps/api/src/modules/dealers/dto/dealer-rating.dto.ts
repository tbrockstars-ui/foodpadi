import { Type } from 'class-transformer';
import { IsInt, IsOptional, IsString, Max, MaxLength, Min } from 'class-validator';
import { DEALER_RATING_MAX, DEALER_RATING_MIN } from '@foodpadi/shared';

export class SubmitDealerRatingDto {
  @Type(() => Number)
  @IsInt()
  @Min(DEALER_RATING_MIN)
  @Max(DEALER_RATING_MAX)
  rating!: number;

  @IsOptional()
  @IsString()
  @MaxLength(600)
  comment?: string;
}

export class ListDealerRatingsQueryDto {
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) @Max(500) page?: number;
}
