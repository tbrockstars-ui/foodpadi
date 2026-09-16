import { Module } from '@nestjs/common';
import { ClaudeService } from './claude.service';
import { AiAccessService } from './ai-access.service';
import { BillingModule } from '../billing/billing.module';

@Module({
  // BillingModule provides EntitlementService + BillingConfigService for the
  // AI access gate. It imports nothing, so there is no cycle. PrismaService and
  // AnalyticsService are @Global.
  imports: [BillingModule],
  providers: [ClaudeService, AiAccessService],
  exports: [ClaudeService, AiAccessService],
})
export class AiModule {}
