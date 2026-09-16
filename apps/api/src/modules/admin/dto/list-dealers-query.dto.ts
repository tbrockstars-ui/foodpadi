import { Type } from 'class-transformer';
import { IsIn, IsInt, IsOptional, IsString, Max, MaxLength, Min } from 'class-validator';

export class ListDealersQueryDto {
  @IsOptional() @IsString() @MaxLength(120) q?: string;
  @IsOptional()
  @IsIn(['draft', 'pending_review', 'changes_requested', 'approved', 'active', 'rejected', 'suspended', 'expired'])
  status?: string;
  @IsOptional() @IsIn(['reported']) filter?: string;
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) @Max(500) page?: number;
}
