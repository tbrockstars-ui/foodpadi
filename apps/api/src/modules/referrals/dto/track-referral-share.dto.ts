import { IsIn } from 'class-validator';
import type { ReferralShareChannel } from '@foodpadi/shared';

const CHANNELS: ReferralShareChannel[] = ['whatsapp', 'copy', 'native', 'other'];

export class TrackReferralShareDto {
  @IsIn(CHANNELS)
  channel!: ReferralShareChannel;
}
