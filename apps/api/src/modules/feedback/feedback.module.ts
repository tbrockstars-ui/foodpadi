import { Module } from '@nestjs/common';
import { CompanionModule } from '../companion/companion.module';
import { FeedbackController } from './feedback.controller';
import { FeedbackService } from './feedback.service';
import { CookingInsightsService } from './cooking-insights.service';

@Module({
  imports: [CompanionModule], // for PatternService
  controllers: [FeedbackController],
  providers: [FeedbackService, CookingInsightsService],
  // CookingInsightsService is the cross-customer "what other cooks reported"
  // signal — CookTodayModule / PlanAheadModule import this module to read it
  // when building an AI generation prompt.
  exports: [CookingInsightsService],
})
export class FeedbackModule {}
