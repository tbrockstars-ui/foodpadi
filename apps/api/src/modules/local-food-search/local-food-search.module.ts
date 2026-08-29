import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { AnalyticsModule } from '../analytics/analytics.module';
import { LocalFoodSearchController } from './local-food-search.controller';
import { LocalFoodSearchService } from './local-food-search.service';

@Module({
  imports: [AuthModule, AnalyticsModule],
  controllers: [LocalFoodSearchController],
  providers: [LocalFoodSearchService],
})
export class LocalFoodSearchModule {}
