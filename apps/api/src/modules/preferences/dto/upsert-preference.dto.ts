import { IsOptional, IsString } from 'class-validator';

export class UpsertPreferenceDto {
  @IsOptional()
  @IsString()
  cuisine?: string;

  @IsOptional()
  @IsString()
  likedMeal?: string;

  @IsOptional()
  @IsString()
  dislikedIngredient?: string;

  @IsOptional()
  @IsString()
  textureDislike?: string;

  @IsOptional()
  @IsString()
  cookingStyle?: string;
}
