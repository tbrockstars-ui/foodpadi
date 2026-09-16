import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { AiModule } from '../ai/ai.module';
import { FeedbackModule } from '../feedback/feedback.module';
import { CookTodayController } from './cook-today.controller';
import { CookTodayService } from './cook-today.service';

@Module({
  // FeedbackModule provides CookingInsightsService — the cross-customer
  // "what other cooks reported" signal fed into generation prompts.
  imports: [AuthModule, AiModule, FeedbackModule],
  controllers: [CookTodayController],
  providers: [CookTodayService],
  exports: [CookTodayService], // reused directly by DecideModule
})
export class CookTodayModule {}
