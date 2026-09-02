import { Global, Module } from '@nestjs/common';
import { AnalyticsService } from './analytics.service';
import { ReferralsModule } from '../referrals/referrals.module';

@Global()
@Module({
  imports: [ReferralsModule],
  providers: [AnalyticsService],
  exports: [AnalyticsService],
})
export class AnalyticsModule {}
