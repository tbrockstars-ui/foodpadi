import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { AnalyticsModule } from '../analytics/analytics.module';
import { FoodImageModule } from '../food-image/food-image.module';
import { EatNowController } from './eat-now.controller';
import { EatNowService } from './eat-now.service';

@Module({
  imports: [AuthModule, AnalyticsModule, FoodImageModule],
  controllers: [EatNowController],
  providers: [EatNowService],
  exports: [EatNowService], // reused directly by DecideModule
})
export class EatNowModule {}
