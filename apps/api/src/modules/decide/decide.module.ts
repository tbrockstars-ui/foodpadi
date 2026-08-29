import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { AnalyticsModule } from '../analytics/analytics.module';
import { CookTodayModule } from '../cook-today/cook-today.module';
import { EatNowModule } from '../eat-now/eat-now.module';
import { DecideController } from './decide.controller';
import { DecideService } from './decide.service';

@Module({
  imports: [AuthModule, AnalyticsModule, CookTodayModule, EatNowModule],
  controllers: [DecideController],
  providers: [DecideService],
})
export class DecideModule {}
