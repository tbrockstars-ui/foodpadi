import { Global, Module } from '@nestjs/common';
import { AnalyticsController } from './analytics.controller';
import { AnalyticsService } from './analytics.service';
import { ReferralsModule } from '../referrals/referrals.module';
import { AuthModule } from '../auth/auth.module';

@Global()
@Module({
  // AuthModule only for AnalyticsController's GuestOrAuthGuard — the service
  // itself (still the only thing most feature modules need) has no auth
  // dependency at all.
  imports: [ReferralsModule, AuthModule],
  controllers: [AnalyticsController],
  providers: [AnalyticsService],
  exports: [AnalyticsService],
})
export class AnalyticsModule {}
