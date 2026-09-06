import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { AiModule } from '../ai/ai.module';
import { AnalyticsModule } from '../analytics/analytics.module';
import { CookingAssistantController } from './cooking-assistant.controller';
import { CookingAssistantService } from './cooking-assistant.service';

@Module({
  imports: [AuthModule, AiModule, AnalyticsModule],
  controllers: [CookingAssistantController],
  providers: [CookingAssistantService],
})
export class CookingAssistantModule {}
