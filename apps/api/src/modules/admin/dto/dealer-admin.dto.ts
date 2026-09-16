import { IsBoolean, IsIn, IsOptional, IsString, MaxLength } from 'class-validator';
import type { AdminDealerAction } from '@foodpadi/shared';

export class DealerAdminActionDto {
  @IsIn(['approve', 'reject', 'request_changes', 'suspend', 'reactivate', 'verify', 'unverify'])
  action!: AdminDealerAction;

  // Required (validated in the service, where the specific action is known)
  // for 'reject' and 'request_changes' — shown to the dealer verbatim.
  @IsOptional() @IsString() @MaxLength(1000) note?: string;
}

export class UpdateDealerReportDto {
  @IsIn(['reviewed', 'actioned', 'dismissed'])
  status!: 'reviewed' | 'actioned' | 'dismissed';
}

export class UpdateDealerRatingDto {
  @IsBoolean()
  hidden!: boolean;
}
