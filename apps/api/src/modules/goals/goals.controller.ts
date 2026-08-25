import { Body, Controller, Get, Put, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CurrentUser, CurrentUserPayload } from '../../common/current-user.decorator';
import { GoalsService } from './goals.service';
import { SetGoalDto } from './dto/set-goal.dto';

@Controller('users/me/goal')
@UseGuards(JwtAuthGuard)
export class GoalsController {
  constructor(private readonly goalsService: GoalsService) {}

  @Get()
  getGoal(@CurrentUser() user: CurrentUserPayload) {
    return this.goalsService.getCurrentGoal(user.userId);
  }

  @Put()
  setGoal(@CurrentUser() user: CurrentUserPayload, @Body() dto: SetGoalDto) {
    return this.goalsService.setGoal(user.userId, dto.goalType);
  }
}
