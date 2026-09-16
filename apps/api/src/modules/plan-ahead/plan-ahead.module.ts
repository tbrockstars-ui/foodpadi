import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { AiModule } from '../ai/ai.module';
import { BillingModule } from '../billing/billing.module';
import { FeedbackModule } from '../feedback/feedback.module';
import { PlanAheadController } from './plan-ahead.controller';
import { PlanPreviewController } from './plan-preview.controller';
import { PlanAheadService } from './plan-ahead.service';

@Module({
  // FeedbackModule provides CookingInsightsService — the cross-customer
  // "what other cooks reported" signal fed into generation prompts.
  // BillingModule provides EntitlementService — Plan Ahead's "week"/"custom"
  // scopes are Premium-only (user instruction 2026-09-12); guest/trial are
  // capped at a 1-day plan.
  imports: [AuthModule, AiModule, BillingModule, FeedbackModule],
  controllers: [PlanAheadController, PlanPreviewController],
  providers: [PlanAheadService],
})
export class PlanAheadModule {}
