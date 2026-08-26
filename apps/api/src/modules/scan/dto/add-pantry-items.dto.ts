import { Type } from 'class-transformer';
import { ArrayMinSize, IsArray, IsOptional, IsString, MaxLength, ValidateNested } from 'class-validator';

class PantryItemInputDto {
  @IsString()
  @MaxLength(120)
  name!: string;

  @IsOptional()
  @IsString()
  @MaxLength(40)
  quantity?: string;

  @IsOptional()
  @IsString()
  @MaxLength(40)
  unit?: string;
}

// The confirm-before-write step: the client posts back the exact reviewed
// list (possibly edited or trimmed from what /scan/photo suggested) rather
// than a scan result id, so nothing is persisted until the user has seen and
// approved it.
export class AddPantryItemsDto {
  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => PantryItemInputDto)
  items!: PantryItemInputDto[];
}
