import { Type } from 'class-transformer';
import { IsIn, IsInt, IsNumber, IsOptional, IsString, Max, MaxLength, Min } from 'class-validator';
import { DEALER_TYPES, type DealerType } from '@foodpadi/shared';

export class DealerSearchDto {
  @IsOptional() @IsString() @MaxLength(160) q?: string;
  @IsOptional() @IsString() @MaxLength(120) locality?: string;

  @IsOptional() @Type(() => Number) @IsNumber() @Min(-90) @Max(90) latitude?: number;
  @IsOptional() @Type(() => Number) @IsNumber() @Min(-180) @Max(180) longitude?: number;

  @IsOptional() @IsString() @MaxLength(80) category?: string;
  @IsOptional() @IsIn(DEALER_TYPES as unknown as string[]) dealerType?: DealerType;

  @IsOptional() @Type(() => Number) @IsInt() @Min(1) @Max(50) page?: number;
}

export class RecordDealerEventDto {
  @IsIn(['profile_view', 'website_click', 'phone_click', 'direction_click', 'order_click'])
  type!: 'profile_view' | 'website_click' | 'phone_click' | 'direction_click' | 'order_click';
}

export class DealerReportDto {
  @IsIn(['wrong_business', 'closed', 'incorrect_info', 'inappropriate'])
  reason!: 'wrong_business' | 'closed' | 'incorrect_info' | 'inappropriate';

  @IsOptional() @IsString() @MaxLength(1000) detail?: string;
}
