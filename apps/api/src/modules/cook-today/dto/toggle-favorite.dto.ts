import { IsBoolean } from 'class-validator';

export class ToggleFavoriteDto {
  @IsBoolean()
  isFavorite!: boolean;
}
