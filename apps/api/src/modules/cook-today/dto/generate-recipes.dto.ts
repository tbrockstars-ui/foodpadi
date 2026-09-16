import { ArrayMaxSize, ArrayMinSize, IsArray, IsInt, IsOptional, IsString, Max, MaxLength, Min } from 'class-validator';

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

  // "None of these? Try another set" — recipe titles already shown for this
  // same request, so a second generate() call doesn't just hand back the
  // identical options (the guest/curated path is fully deterministic; the
  // AI path is steered away from repeats too). Capped well below what a
  // real session would ever accumulate.
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(30)
  @IsString({ each: true })
  @MaxLength(200, { each: true })
  excludeTitles?: string[];
}
