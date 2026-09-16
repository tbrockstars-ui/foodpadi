import { IsIn, IsOptional } from 'class-validator';
import type { PaymentProvider } from '@foodpadi/shared';

export class CreateCheckoutDto {
  // Defaults to 'stripe'. 'flutterwave' is the Nigeria journey; the service
  // still validates it can be used (plan configured, user not already premium).
  @IsOptional()
  @IsIn(['stripe', 'flutterwave'])
  provider?: PaymentProvider;
}
