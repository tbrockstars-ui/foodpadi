import { ArrayMaxSize, IsArray, IsInt, IsString, Min, MaxLength, MinLength } from 'class-validator';

export class AskCookingQuestionDto {
  @IsString()
  @MinLength(1)
  @MaxLength(200)
  recipeTitle!: string;

  @IsArray()
  @ArrayMaxSize(50)
  @IsString({ each: true })
  ingredients!: string[];

  @IsArray()
  @ArrayMaxSize(50)
  @IsString({ each: true })
  steps!: string[];

  @IsInt()
  @Min(0)
  currentStepIndex!: number;

  @IsString()
  @MinLength(1)
  @MaxLength(500)
  question!: string;
}
