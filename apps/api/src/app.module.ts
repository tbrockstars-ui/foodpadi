import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { PrismaModule } from './prisma/prisma.module';
import { AuthModule } from './modules/auth/auth.module';
import { UsersModule } from './modules/users/users.module';
import { GoalsModule } from './modules/goals/goals.module';
import { PreferencesModule } from './modules/preferences/preferences.module';
import { AnalyticsModule } from './modules/analytics/analytics.module';
import { CookTodayModule } from './modules/cook-today/cook-today.module';
import { PlanAheadModule } from './modules/plan-ahead/plan-ahead.module';
import { EatNowModule } from './modules/eat-now/eat-now.module';
import { LocalFoodSearchModule } from './modules/local-food-search/local-food-search.module';
import { DecideModule } from './modules/decide/decide.module';
import { RecipeImportModule } from './modules/recipe-import/recipe-import.module';
import { ScanModule } from './modules/scan/scan.module';
import { AdminModule } from './modules/admin/admin.module';
import { WaitlistModule } from './modules/waitlist/waitlist.module';
import { ReferralsModule } from './modules/referrals/referrals.module';
import { AppController } from './app.controller';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    PrismaModule,
    AnalyticsModule,
    AuthModule,
    UsersModule,
    GoalsModule,
    PreferencesModule,
    CookTodayModule,
    PlanAheadModule,
    EatNowModule,
    LocalFoodSearchModule,
    DecideModule,
    RecipeImportModule,
    ScanModule,
    AdminModule,
    WaitlistModule,
    ReferralsModule,
  ],
  controllers: [AppController],
})
export class AppModule {}
