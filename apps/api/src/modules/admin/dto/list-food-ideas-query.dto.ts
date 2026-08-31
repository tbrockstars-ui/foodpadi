import { Type } from 'class-transformer';
import { IsBooleanString, IsInt, IsOptional, IsString, Max, Min } from 'class-validator';

export class ListFoodIdeasQueryDto {
  @IsOptional()
  @IsString()
  search?: string;

  // String, not boolean — query params always arrive as strings; validated
  // as "true"/"false" text then parsed in the service (matches how
  // ListUsersQueryDto's numeric fields use @Type(() => Number) for the same
  // reason, just for a boolean instead).
  @IsOptional()
  @IsBooleanString()
  isActive?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(200)
  pageSize?: number;
}
