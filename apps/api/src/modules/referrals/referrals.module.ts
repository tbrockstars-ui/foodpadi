import { Module } from '@nestjs/common';
import { ReferralsController } from './referrals.controller';
import { ReferralsService } from './referrals.service';

/**
 * Exports ReferralsService for two consumers:
 *  - AuthModule, to attribute a referral when a referred user registers.
 *  - AnalyticsModule, to flip a referral to "qualified" on a meaningful event.
 * This module itself imports nothing app-specific (Prisma is global), which is
 * what keeps that second edge from becoming a cycle.
 */
@Module({
  controllers: [ReferralsController],
  providers: [ReferralsService],
  exports: [ReferralsService],
})
export class ReferralsModule {}
