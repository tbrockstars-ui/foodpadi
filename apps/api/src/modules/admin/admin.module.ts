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

@Module({
  controllers: [
    AdminUsersController,
    AdminWaitlistController,
    AdminAuthController,
    AdminFoodIdeasController,
    AdminAnalyticsController,
  ],
  providers: [
    AdminUsersService,
    AdminWaitlistService,
    AdminAuthService,
    AdminFoodIdeasService,
    AdminAnalyticsService,
  ],
})
export class AdminModule {}
