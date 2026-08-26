import { IsInt, IsOptional, IsString, MaxLength, Min, MinLength } from 'class-validator';

export class SearchEatNowDto {
  @IsString()
  @MinLength(3)
  @MaxLength(280)
  query!: string;

  @IsOptional()
  @IsInt()
  @Min(100)
  maxPricePence?: number;

  @IsOptional()
  @IsString()
  @MaxLength(60)
  cuisine?: string;
}
