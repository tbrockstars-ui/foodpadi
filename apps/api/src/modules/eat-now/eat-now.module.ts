import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { AnalyticsModule } from '../analytics/analytics.module';
import { EatNowController } from './eat-now.controller';
import { EatNowService } from './eat-now.service';

@Module({
  imports: [AuthModule, AnalyticsModule],
  controllers: [EatNowController],
  providers: [EatNowService],
})
export class EatNowModule {}
