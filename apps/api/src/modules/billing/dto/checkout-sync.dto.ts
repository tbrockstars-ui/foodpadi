import { IsIn, IsOptional, IsString, Matches, MaxLength } from 'class-validator';
import type { PaymentProvider } from '@foodpadi/shared';

export class CheckoutSyncDto {
  @IsOptional()
  @IsIn(['stripe', 'flutterwave'])
  provider?: PaymentProvider;

  // Stripe: Checkout Session id from the success redirect (`?session_id=cs_...`).
  @IsOptional()
  @IsString()
  @MaxLength(200)
  @Matches(/^cs_[A-Za-z0-9_]+$/, { message: 'sessionId must be a Stripe Checkout Session id.' })
  sessionId?: string;

  // Flutterwave: the reference we generated + Flutterwave's transaction id,
  // both taken from the redirect query. Ownership is still verified in the
  // service (the tx_ref must be the one stored for this user) and the
  // transaction is re-verified with Flutterwave before anything is written.
  @IsOptional()
  @IsString()
  @MaxLength(120)
  @Matches(/^[A-Za-z0-9_-]+$/, { message: 'txRef is malformed.' })
  txRef?: string;

  @IsOptional()
  @IsString()
  @MaxLength(64)
  @Matches(/^[A-Za-z0-9_-]+$/, { message: 'transactionId is malformed.' })
  transactionId?: string;
}
