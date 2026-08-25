import { IsOptional, IsString, MaxLength } from 'class-validator';

export class AddAvoidedIngredientDto {
  @IsString()
  ingredientName!: string;

  // Free text — treated as potentially special-category data. Never
  // solicited as "why" (no medical framing anywhere in the UI copy);
  // if a user volunteers it anyway, it's stored, not analysed.
  @IsOptional()
  @IsString()
  @MaxLength(500)
  note?: string;
}
