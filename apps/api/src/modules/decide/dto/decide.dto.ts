import { IsInt, IsOptional, IsString, Max, MaxLength, Min, MinLength } from 'class-validator';

export class DecideDto {
  @IsString()
  @MinLength(3)
  @MaxLength(300)
  description!: string;

  @IsOptional()
  @IsInt()
  @Min(5)
  @Max(240)
  timeMinutes?: number;

  @IsOptional()
  @IsInt()
  @Min(0)
  budgetPence?: number;
}
