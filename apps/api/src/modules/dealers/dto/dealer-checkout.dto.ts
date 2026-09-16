import { IsIn, IsOptional, IsString, MaxLength } from 'class-validator';
import type { PaymentProvider } from '@foodpadi/shared';

export class DealerCheckoutDto {
  @IsOptional()
  @IsIn(['stripe', 'flutterwave'])
  provider?: PaymentProvider;
}

export class DealerCheckoutSyncDto {
  @IsOptional()
  @IsIn(['stripe', 'flutterwave'])
  provider?: PaymentProvider;

  @IsOptional() @IsString() @MaxLength(300) sessionId?: string;
  @IsOptional() @IsString() @MaxLength(200) txRef?: string;
  @IsOptional() @IsString() @MaxLength(200) transactionId?: string;
}
