import { IsOptional, IsString, MaxLength, MinLength } from 'class-validator';

// Body for POST /plan-ahead/:planId/items/:itemId/regenerate. All optional —
// an empty body keeps the original behaviour (a fresh AI-picked meal for that
// day). `focus` lets the user steer that day specifically when the generated
// meal isn't what they wanted: "something with fish", "a quick pasta",
// "vegetarian".
export class RegeneratePlanItemDto {
  @IsOptional()
  @IsString()
  @MinLength(2)
  @MaxLength(200)
  focus?: string;
}
