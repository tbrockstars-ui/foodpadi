import { Body, Controller, Get, Patch, UseGuards } from '@nestjs/common';
import type { DailyReminderPreferencesView } from '@foodpadi/shared';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CurrentUser, CurrentUserPayload } from '../../common/current-user.decorator';
import { DailyRemindersService } from './daily-reminders.service';
import { UpdateDailyReminderPreferencesDto } from './dto/update-daily-reminder-preferences.dto';

/**
 * FoodPadi Daily Companion Reminders (docs brief). Account-only — same
 * JwtAuthGuard posture as PreferencesController/GoalsController, since a
 * guest has no account row to persist this against (brief §19). `userId`
 * always comes from the verified JWT, never the request body (brief §41).
 */
@Controller('users/me/daily-reminders')
@UseGuards(JwtAuthGuard)
export class DailyRemindersController {
  constructor(private readonly dailyReminders: DailyRemindersService) {}

  @Get()
  getPreferences(@CurrentUser() user: CurrentUserPayload): Promise<DailyReminderPreferencesView> {
    return this.dailyReminders.getPreferences(user.userId);
  }

  @Patch()
  updatePreferences(
    @CurrentUser() user: CurrentUserPayload,
    @Body() dto: UpdateDailyReminderPreferencesDto,
  ): Promise<DailyReminderPreferencesView> {
    return this.dailyReminders.updatePreferences(user.userId, dto);
  }
}
