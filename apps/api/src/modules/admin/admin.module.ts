import { Module } from '@nestjs/common';
import { AdminUsersController } from './admin-users.controller';
import { AdminUsersService } from './admin-users.service';
import { AdminWaitlistController } from './admin-waitlist.controller';
import { AdminWaitlistService } from './admin-waitlist.service';
import { AdminAuthController } from './admin-auth.controller';
import { AdminAuthService } from './admin-auth.service';
import { AdminFoodIdeasController } from './admin-food-ideas.controller';
import { AdminFoodIdeasService } from './admin-food-ideas.service';
import { AdminAnalyticsController } from './admin-analytics.controller';
import { AdminAnalyticsService } from './admin-analytics.service';
import { AdminBillingController } from './admin-billing.controller';
import { AdminDealersController } from './admin-dealers.controller';
import { AdminDealersService } from './admin-dealers.service';
import { BillingModule } from '../billing/billing.module';
import { DealersModule } from '../dealers/dealers.module';

@Module({
  imports: [BillingModule, DealersModule],
  controllers: [
    AdminUsersController,
    AdminWaitlistController,
    AdminAuthController,
    AdminFoodIdeasController,
    AdminAnalyticsController,
    AdminBillingController,
    AdminDealersController,
  ],
  providers: [
    AdminUsersService,
    AdminWaitlistService,
    AdminAuthService,
    AdminFoodIdeasService,
    AdminAnalyticsService,
    AdminDealersService,
  ],
})
export class AdminModule {}
