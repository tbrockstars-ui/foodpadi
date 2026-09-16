import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { CookTodayModule } from '../cook-today/cook-today.module';
import { CookingJourneyController } from './cooking-journey.controller';
import { CookingJourneyService } from './cooking-journey.service';

@Module({
  // AuthModule for JwtAuthGuard; CookTodayModule for CookTodayService (persist
  // a fresh recipe on journey start, stamp lastCookedAt on completion).
  // PrismaService and AnalyticsService are both @Global.
  imports: [AuthModule, CookTodayModule],
  controllers: [CookingJourneyController],
  providers: [CookingJourneyService],
  exports: [CookingJourneyService],
})
export class CookingJourneyModule {}
