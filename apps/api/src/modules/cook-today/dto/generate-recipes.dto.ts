import { ArrayMinSize, IsArray, IsInt, IsOptional, IsString, Max, Min } from 'class-validator';

export class GenerateRecipesDto {
  @IsArray()
  @ArrayMinSize(1)
  @IsString({ each: true })
  ingredients!: string[];

  @IsOptional()
  @IsInt()
  @Min(5)
  @Max(240)
  timeConstraintMinutes?: number;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(12)
  servings?: number;
}
