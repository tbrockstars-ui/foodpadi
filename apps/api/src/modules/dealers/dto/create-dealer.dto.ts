import { IsIn, IsString, MaxLength, MinLength } from 'class-validator';
import { DEALER_TYPES, type DealerType } from '@foodpadi/shared';

export class CreateDealerDto {
  @IsString()
  @MinLength(2)
  @MaxLength(120)
  name!: string;

  @IsIn(DEALER_TYPES as unknown as string[])
  dealerType!: DealerType;
}
