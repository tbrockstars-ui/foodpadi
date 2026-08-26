import { IsBoolean, IsOptional, IsString } from 'class-validator';

export class AddShoppingListItemDto {
  @IsString()
  ingredientName!: string;

  @IsOptional()
  @IsString()
  quantity?: string;

  @IsOptional()
  @IsString()
  unit?: string;
}

export class UpdateShoppingListItemDto {
  @IsOptional()
  @IsBoolean()
  checked?: boolean;

  @IsOptional()
  @IsString()
  quantity?: string;

  @IsOptional()
  @IsString()
  unit?: string;
}
