import { Controller, Get, UseGuards } from '@nestjs/common';
import { AdminApiGuard } from './admin-api.guard';
import { AdminAnalyticsService } from './admin-analytics.service';

@Controller('admin/analytics')
@UseGuards(AdminApiGuard)
export class AdminAnalyticsController {
  constructor(private readonly adminAnalyticsService: AdminAnalyticsService) {}

  @Get('overview')
  overview() {
    return this.adminAnalyticsService.overview();
  }
}
