import { Body, Controller, Post, UseGuards } from '@nestjs/common';
import { CurrentUser, CurrentUserPayload } from '../../common/current-user.decorator';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { AskCookingQuestionDto } from './dto/ask-cooking-question.dto';
import { CheckCookingStepDto } from './dto/check-cooking-step.dto';
import { CookingAssistantService } from './cooking-assistant.service';

// Account-only, no guest access — both routes are paid AI calls (one vision,
// one text), same posture as ScanController/FoodContentController.
@Controller('cooking-assistant')
@UseGuards(JwtAuthGuard)
export class CookingAssistantController {
  constructor(private readonly cookingAssistant: CookingAssistantService) {}

  @Post('check-step')
  checkStep(@Body() dto: CheckCookingStepDto, @CurrentUser() user: CurrentUserPayload) {
    return this.cookingAssistant.checkStep(dto, user.userId);
  }

  @Post('ask')
  ask(@Body() dto: AskCookingQuestionDto, @CurrentUser() user: CurrentUserPayload) {
    return this.cookingAssistant.ask(dto, user.userId);
  }
}
