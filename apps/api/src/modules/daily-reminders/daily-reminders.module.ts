import { Module } from '@nestjs/common';
import { DailyRemindersController } from './daily-reminders.controller';
import { DailyRemindersService } from './daily-reminders.service';

// PrismaService/AnalyticsService are both @Global() (see their own modules)
// so, like PreferencesModule/GoalsModule, nothing needs importing here.
@Module({
  controllers: [DailyRemindersController],
  providers: [DailyRemindersService],
})
export class DailyRemindersModule {}
