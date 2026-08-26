import { Body, Controller, Get, Post, Put, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CurrentUser, CurrentUserPayload } from '../../common/current-user.decorator';
import { AnalyticsService } from '../analytics/analytics.service';
import { GoalsService } from './goals.service';
import { SetGoalsDto } from './dto/set-goals.dto';
import { TrackGoalEventDto } from './dto/track-goal-event.dto';

@Controller('users/me/goals')
@UseGuards(JwtAuthGuard)
export class GoalsController {
  constructor(
    private readonly goalsService: GoalsService,
    private readonly analytics: AnalyticsService,
  ) {}

  @Get()
  getGoals(@CurrentUser() user: CurrentUserPayload) {
    return this.goalsService.getGoals(user.userId);
  }

  @Put()
  setGoals(@CurrentUser() user: CurrentUserPayload, @Body() dto: SetGoalsDto) {
    return this.goalsService.setGoals(user.userId, dto);
  }

  @Post('events')
  trackEvent(@CurrentUser() user: CurrentUserPayload, @Body() dto: TrackGoalEventDto) {
    return this.analytics.track(
      dto.eventType,
      { userId: user.userId },
      dto.goalType ? { goalType: dto.goalType } : undefined,
    );
  }
}
